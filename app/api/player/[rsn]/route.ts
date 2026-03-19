import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const WOM_PLAYER_URL = "https://api.wiseoldman.net/v2/players";
const SKILLS = [
  "attack","strength","defence","ranged","magic","prayer",
  "runecrafting","construction","hitpoints","agility","herblore",
  "thieving","crafting","fletching","slayer","hunter","mining",
  "smithing","fishing","cooking","firemaking","woodcutting","farming","sailing"
];

const BOSSES = [
  "abyssal_sire", "alchemical_hydra", "amoxliatl", "araxxor", "artio",
  "barrows_chests", "brutus", "bryophyta", "callisto", "calvarion",
  "cerberus", "chambers_of_xeric", "chambers_of_xeric_challenge_mode",
  "chaos_elemental", "chaos_fanatic", "commander_zilyana", "corporeal_beast",
  "crazy_archaeologist", "dagannoth_prime", "dagannoth_rex", "dagannoth_supreme",
  "deranged_archaeologist", "doom_of_mokhaiotl", "duke_sucellus", "general_graardor",
  "giant_mole", "grotesque_guardians", "hespori", "kalphite_queen",
  "king_black_dragon", "kraken", "kreearra", "kril_tsutsaroth", "lunar_chests",
  "mimic", "nex", "nightmare", "phosanis_nightmare", "obor", "phantom_muspah",
  "sarachnis", "scorpia", "scurrius", "shellbane_gryphon", "skotizo", "sol_heredit",
  "spindel", "tempoross", "the_corrupted_gauntlet", "the_gauntlet", "the_hueycoatl",
  "the_leviathan", "the_royal_titans", "the_whisperer", "theatre_of_blood",
  "theatre_of_blood_hard_mode", "thermonuclear_smoke_devil", "tombs_of_amascut",
  "tombs_of_amascut_expert", "tzkal_zuk", "tztok_jad", "vardorvis", "venenatis",
  "vetion", "vorkath", "wintertodt", "yama", "zalcano", "zulrah"
];

const HEADERS = {
  "Content-Type": "application/json",
  "User-Agent": "MettleOS/1.0",
};

const UPDATE_DELAY_MS = 1_200;
const UPDATE_TIMEOUT_MS = 3_500;
const SNAPSHOT_TIMEOUT_MS = 5_000;
const HOT_CACHE_TTL_MS = 15_000;
const STALE_CACHE_TTL_MS = 5 * 60_000;
const RESPONSE_CACHE_CONTROL = "private, max-age=15, stale-while-revalidate=60";

type SnapshotData = {
  rsn: string;
  skills: Record<string, number>;
  bosses: Record<string, number>;
};

type SnapshotSuccess = SnapshotData & {
  meta: {
    source: "live" | "cache";
    stale: boolean;
    refreshed: boolean;
    cachedAt: number;
    warning: string | null;
    warningCode: string | null;
  };
};

type SnapshotCacheEntry = {
  cachedAt: number;
  data: SnapshotData;
};

type SnapshotWarning = {
  code: string;
  message: string;
  retryable: boolean;
};

class WomRouteError extends Error {
  status: number;
  code: string;
  retryable: boolean;

  constructor(status: number, code: string, message: string, retryable = true) {
    super(message);
    this.name = "WomRouteError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

const globalWomState = globalThis as typeof globalThis & {
  __mettleWomCache__?: Map<string, SnapshotCacheEntry>;
  __mettleWomInflight__?: Map<string, Promise<SnapshotSuccess>>;
};

const womCache =
  globalWomState.__mettleWomCache__ ??
  (globalWomState.__mettleWomCache__ = new Map<string, SnapshotCacheEntry>());

const womInflight =
  globalWomState.__mettleWomInflight__ ??
  (globalWomState.__mettleWomInflight__ = new Map<string, Promise<SnapshotSuccess>>());

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeRsn(value: string) {
  return typeof value === "string" ? value.trim() : "";
}

function cacheKeyForRsn(value: string) {
  return normalizeRsn(value).toLowerCase();
}

function playerUrl(rsn: string) {
  return `${WOM_PLAYER_URL}/${encodeURIComponent(rsn)}`;
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function toWarning(code: string, message: string, retryable = true): SnapshotWarning {
  return { code, message, retryable };
}

function normalizeError(error: unknown) {
  if (error instanceof WomRouteError) return error;
  if (isAbortError(error)) {
    return new WomRouteError(
      504,
      "WOM_TIMEOUT",
      "Wise Old Man took too long to respond.",
      true
    );
  }
  if (error instanceof Error) {
    return new WomRouteError(
      502,
      "WOM_UPSTREAM_UNREACHABLE",
      "Could not reach Wise Old Man right now.",
      true
    );
  }
  return new WomRouteError(
    502,
    "WOM_UNKNOWN_ERROR",
    "Wise Old Man could not be reached right now.",
    true
  );
}

function readCacheEntry(cacheKey: string, maxAgeMs: number) {
  const cached = womCache.get(cacheKey);
  if (!cached) return null;
  if (Date.now() - cached.cachedAt > maxAgeMs) return null;
  return cached;
}

function cacheSnapshot(cacheKey: string, data: SnapshotData) {
  const entry = {
    cachedAt: Date.now(),
    data,
  };
  womCache.set(cacheKey, entry);
  return entry;
}

function withMeta(
  entry: SnapshotCacheEntry,
  source: "live" | "cache",
  warning: SnapshotWarning | null = null,
  stale = false,
  refreshed = true
): SnapshotSuccess {
  return {
    ...entry.data,
    meta: {
      source,
      stale,
      refreshed,
      cachedAt: entry.cachedAt,
      warning: warning?.message ?? null,
      warningCode: warning?.code ?? null,
    },
  };
}

function createErrorResponse(error: WomRouteError) {
  return NextResponse.json(
    {
      error: error.message,
      code: error.code,
      retryable: error.retryable,
    },
    {
      status: error.status,
      headers: {
        "Cache-Control": RESPONSE_CACHE_CONTROL,
      },
    }
  );
}

function createSuccessResponse(payload: SnapshotSuccess) {
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": RESPONSE_CACHE_CONTROL,
    },
  });
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  timeoutError: WomRouteError
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (isAbortError(error)) {
      throw timeoutError;
    }
    throw normalizeError(error);
  } finally {
    clearTimeout(timeout);
  }
}

async function triggerRefresh(rsn: string) {
  try {
    const response = await fetchWithTimeout(
      playerUrl(rsn),
      {
        method: "POST",
        headers: HEADERS,
      },
      UPDATE_TIMEOUT_MS,
      new WomRouteError(
        504,
        "WOM_REFRESH_TIMEOUT",
        "Wise Old Man took too long to refresh that player.",
        true
      )
    );

    if (response.ok) return null;
    if (response.status === 429) {
      return toWarning(
        "WOM_REFRESH_RATE_LIMITED",
        "Wise Old Man is rate limiting refresh requests right now."
      );
    }
    if (response.status === 404 || response.status === 409) {
      return toWarning(
        "WOM_REFRESH_SKIPPED",
        "Wise Old Man did not immediately refresh that player."
      );
    }
    return toWarning(
      "WOM_REFRESH_FAILED",
      `Wise Old Man refresh returned ${response.status}.`
    );
  } catch (error) {
    const normalized = normalizeError(error);
    return toWarning(normalized.code, normalized.message, normalized.retryable);
  }
}

async function fetchSnapshotPayload(rsn: string) {
  const response = await fetchWithTimeout(
    playerUrl(rsn),
    {
      headers: HEADERS,
      cache: "no-store",
    },
    SNAPSHOT_TIMEOUT_MS,
    new WomRouteError(
      504,
      "WOM_SNAPSHOT_TIMEOUT",
      "Wise Old Man took too long to return player data.",
      true
    )
  );

  if (!response.ok) {
    if (response.status === 404) {
      throw new WomRouteError(
        404,
        "WOM_PLAYER_NOT_FOUND",
        "Wise Old Man could not find that player.",
        false
      );
    }
    if (response.status === 429) {
      throw new WomRouteError(
        429,
        "WOM_RATE_LIMITED",
        "Wise Old Man is rate limiting requests right now.",
        true
      );
    }
    throw new WomRouteError(
      response.status >= 500 ? 503 : response.status,
      "WOM_BAD_RESPONSE",
      `Wise Old Man returned ${response.status}.`,
      response.status >= 500 || response.status === 429
    );
  }

  return response.json();
}

function normalizeSnapshot(data: unknown, fallbackRsn: string): SnapshotData {
  const record = data && typeof data === "object" ? data as Record<string, unknown> : {};
  const displayName = typeof record.displayName === "string" ? record.displayName : fallbackRsn;
  const latestSnapshot =
    record.latestSnapshot && typeof record.latestSnapshot === "object"
      ? record.latestSnapshot as Record<string, unknown>
      : null;
  const snapshot =
    latestSnapshot?.data && typeof latestSnapshot.data === "object"
      ? latestSnapshot.data as Record<string, unknown>
      : null;

  if (!snapshot) {
    throw new WomRouteError(
      404,
      "WOM_SNAPSHOT_PENDING",
      "Player snapshot not available yet. Try again in a few seconds.",
      true
    );
  }

  const snapshotSkills =
    snapshot.skills && typeof snapshot.skills === "object"
      ? snapshot.skills as Record<string, { level?: number }>
      : {};
  const snapshotBosses =
    snapshot.bosses && typeof snapshot.bosses === "object"
      ? snapshot.bosses as Record<string, { kills?: number }>
      : {};

  const skills: Record<string, number> = {};
  for (const skill of SKILLS) {
    skills[skill] = typeof snapshotSkills[skill]?.level === "number" ? snapshotSkills[skill].level : 1;
  }

  const bosses: Record<string, number> = {};
  for (const boss of BOSSES) {
    bosses[boss] = typeof snapshotBosses[boss]?.kills === "number" ? snapshotBosses[boss].kills : 0;
  }

  return {
    rsn: displayName,
    skills,
    bosses,
  };
}

async function loadPlayerSnapshot(rsn: string) {
  const cacheKey = cacheKeyForRsn(rsn);
  const hotCache = readCacheEntry(cacheKey, HOT_CACHE_TTL_MS);
  if (hotCache) {
    return withMeta(hotCache, "cache", null, false, false);
  }

  const inFlight = womInflight.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const pendingRequest = (async () => {
    const refreshWarning = await triggerRefresh(rsn);
    await delay(UPDATE_DELAY_MS);

    try {
      const livePayload = normalizeSnapshot(await fetchSnapshotPayload(rsn), rsn);
      const cached = cacheSnapshot(cacheKey, livePayload);
      return withMeta(cached, "live", refreshWarning, false, true);
    } catch (error) {
      const normalized = normalizeError(error);
      const staleCache = readCacheEntry(cacheKey, STALE_CACHE_TTL_MS);

      if (staleCache && normalized.retryable) {
        return withMeta(
          staleCache,
          "cache",
          toWarning(normalized.code, normalized.message, normalized.retryable),
          true,
          false
        );
      }

      throw normalized;
    } finally {
      womInflight.delete(cacheKey);
    }
  })();

  womInflight.set(cacheKey, pendingRequest);
  return pendingRequest;
}

export function __resetWomCacheForTests() {
  womCache.clear();
  womInflight.clear();
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ rsn: string }> }
) {
  const { rsn } = await params;
  const normalizedRsn = normalizeRsn(rsn);

  if (!normalizedRsn) {
    return createErrorResponse(
      new WomRouteError(400, "INVALID_RSN", "An RSN is required to fetch player data.", false)
    );
  }

  try {
    const payload = await loadPlayerSnapshot(normalizedRsn);
    return createSuccessResponse(payload);
  } catch (error) {
    const normalized = normalizeError(error);

    console.error("[wom-route]", {
      rsn: normalizedRsn,
      status: normalized.status,
      code: normalized.code,
      message: normalized.message,
    });

    return createErrorResponse(normalized);
  }
}
