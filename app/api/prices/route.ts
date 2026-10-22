import { NextResponse } from "next/server";
import { buildMerchantItems, type MappingById, type MerchantItem, type WikiMappingEntry, type WikiLatestEntry, type WikiHourlyEntry } from "@/components/merchant/marketEngine";

export const runtime = "nodejs";

const REPO_URL = "https://github.com/ryanpgoldberg-osrs/MettleOS";
const MAPPING_URL = "https://prices.runescape.wiki/api/v1/osrs/mapping";
const LATEST_URL = "https://prices.runescape.wiki/api/v1/osrs/latest";
const FIVE_MINUTE_URL = "https://prices.runescape.wiki/api/v1/osrs/5m";
const HOURLY_URL = "https://prices.runescape.wiki/api/v1/osrs/1h";

const DATA_TTL_MS = 60_000;
const MAPPING_TTL_MS = 24 * 60 * 60_000;

const HEADERS = {
  "User-Agent": `MettleOS merchant utility (+${REPO_URL})`,
};


type MerchantCache = {
  cachedAt: number;
  mappingFetchedAt: number;
  mappingById: MappingById;
  items: MerchantItem[];
};

const globalMerchantCache = globalThis as typeof globalThis & {
  __mettleMerchantCacheV2__?: MerchantCache;
};

const cache =
  globalMerchantCache.__mettleMerchantCacheV2__ ??
  (globalMerchantCache.__mettleMerchantCacheV2__ = {
    cachedAt: 0,
    mappingFetchedAt: 0,
    mappingById: {},
    items: [],
  });

async function fetchJson<T>(url: string, revalidateSeconds: number) {
  const res = await fetch(url, {
    headers: HEADERS,
    next: { revalidate: revalidateSeconds },
  });

  if (!res.ok) {
    throw new Error(`RuneScape Wiki price API returned ${res.status} for ${url}`);
  }

  return (await res.json()) as T;
}

async function loadMapping() {
  const now = Date.now();
  if (cache.mappingFetchedAt && now - cache.mappingFetchedAt < MAPPING_TTL_MS) {
    return cache.mappingById;
  }

  const mapping = await fetchJson<WikiMappingEntry[]>(MAPPING_URL, 3600);
  const mappingById: MappingById = {};

  for (const item of mapping) {
    if (!item || typeof item.id !== "number" || !item.name) continue;
    mappingById[item.id] = {
      name: item.name,
      limit: typeof item.limit === "number" ? item.limit : 0,
      members: Boolean(item.members),
    };
  }

  cache.mappingById = mappingById;
  cache.mappingFetchedAt = now;
  return mappingById;
}

async function loadVolume() {
  const now = Date.now() / 1000;
  try {
    const hourly = await fetchJson<{ timestamp?: number; data: Record<string, WikiHourlyEntry> }>(HOURLY_URL, 60);
    if (hourly.timestamp && now - hourly.timestamp <= 7200) return { ...hourly, window: 3600 };
  } catch { /* Try the shorter feed before pausing sizing. */ }
  try {
    const short = await fetchJson<{ timestamp?: number; data: Record<string, WikiHourlyEntry> }>(FIVE_MINUTE_URL, 60);
    return { ...short, window: 300 };
  } catch {
    return { timestamp: 0, data: {}, window: 3600 };
  }
}

async function refreshCache() {
  const now = Date.now();
  if (cache.cachedAt && now - cache.cachedAt < DATA_TTL_MS && cache.items.length > 0) {
    return cache;
  }

  try {
    const [mappingById, latestPayload, hourlyPayload] = await Promise.all([
      loadMapping(),
      fetchJson<{ data: Record<string, WikiLatestEntry> }>(LATEST_URL, 60),
      loadVolume(),
    ]);

    cache.items = buildMerchantItems(
      mappingById,
      latestPayload.data ?? {},
      hourlyPayload.data ?? {},
      { volumeTimestamp: hourlyPayload.timestamp ?? 0, volumeWindowSeconds: hourlyPayload.window }
    );
    cache.cachedAt = now;
  } catch (error) {
    console.error("[merchant-prices] Failed to refresh prices", error);
    if (!cache.cachedAt || cache.items.length === 0) {
      throw error;
    }
  }

  return cache;
}

export async function GET() {
  try {
    const data = await refreshCache();

    return NextResponse.json(
      {
        cachedAt: data.cachedAt,
        count: data.items.length,
        items: data.items,
        note: "Cached merchant utility data for the built-in GE flip panel.",
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to load merchant price data." },
      { status: 502 }
    );
  }
}
