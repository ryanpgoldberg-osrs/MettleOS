import { KEY_BOSSES, SKILLS } from "../data/constants.js";
import { normalizeQuestState } from "./questSync.js";

export const ACCOUNT_SYNC_FORMAT = "mettle-account-sync";
export const ACCOUNT_SYNC_VERSION = 1;

function normalizeRsn(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeId(value) {
  if (typeof value !== "string") return null;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || null;
}

function numberOrDefault(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function numberOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function timestampOrZero(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function normalizeMap(source, keys, fallback) {
  const normalized = {};
  const raw = source && typeof source === "object" && !Array.isArray(source) ? source : {};
  for (const key of keys) {
    normalized[key] = numberOrDefault(raw[key], fallback);
  }
  return normalized;
}

function idsFromList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const ids = [];

  for (const item of list) {
    const candidate =
      typeof item === "string"
        ? item
        : typeof item?.id === "string"
          ? item.id
          : typeof item?.name === "string"
            ? item.name
            : null;
    const normalized = normalizeId(candidate);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    ids.push(normalized);
  }

  return ids.sort();
}

export function createEmptyDiaryState() {
  return {
    completedTaskIds: [],
    completedTierIds: [],
    totalCompletedTasks: null,
    source: null,
    syncVersion: null,
    syncAccountType: null,
    syncSourceRsn: "",
    updatedAt: 0,
  };
}

export function normalizeDiaryState(raw) {
  const base = createEmptyDiaryState();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;

  return {
    ...base,
    completedTaskIds: idsFromList(raw.completedTaskIds ?? raw.completedTasks ?? raw.tasks),
    completedTierIds: idsFromList(raw.completedTierIds ?? raw.completedTiers ?? raw.tiers),
    totalCompletedTasks: numberOrNull(raw.totalCompletedTasks ?? raw.completedTaskCount),
    source: typeof raw.source === "string" && raw.source.trim() ? raw.source.trim() : null,
    syncVersion: numberOrNull(raw.syncVersion ?? raw.version),
    syncAccountType: typeof raw.syncAccountType === "string"
      ? raw.syncAccountType
      : typeof raw.accountType === "string"
        ? raw.accountType
        : null,
    syncSourceRsn: normalizeRsn(raw.syncSourceRsn ?? raw.rsn),
    updatedAt: timestampOrZero(raw.updatedAt),
  };
}

export function summarizeDiaryState(raw) {
  const state = normalizeDiaryState(raw);
  return {
    completedTaskCount: state.totalCompletedTasks ?? state.completedTaskIds.length,
    completedTierCount: state.completedTierIds.length,
    hasSyncData: Boolean(
      state.completedTaskIds.length ||
      state.completedTierIds.length ||
      state.totalCompletedTasks !== null ||
      state.updatedAt
    ),
    sourceLabel: state.source || "manual",
    lastUpdatedLabel: state.updatedAt ? new Date(state.updatedAt).toLocaleString() : "Not synced yet",
  };
}

function unwrapAccountSyncPayload(raw) {
  if (raw?.format === ACCOUNT_SYNC_FORMAT && raw.payload && typeof raw.payload === "object") {
    return raw.payload;
  }
  if (raw?.format === ACCOUNT_SYNC_FORMAT && raw.sync && typeof raw.sync === "object") {
    return raw.sync;
  }
  return raw;
}

export function parseAccountSyncPayload(raw, options = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Account sync payload must be a JSON object.");
  }
  if (raw.format && raw.format !== ACCOUNT_SYNC_FORMAT) {
    throw new Error("That file is not a Mettle account sync payload.");
  }

  const payload = unwrapAccountSyncPayload(raw);
  const player = payload?.player && typeof payload.player === "object" ? payload.player : null;
  const rsn = normalizeRsn(payload?.rsn ?? player?.rsn);
  const expectedRsn = normalizeRsn(options.expectedRsn);

  if (!rsn) {
    throw new Error("Account sync payload is missing an RSN.");
  }
  if (expectedRsn && expectedRsn.toLowerCase() !== rsn.toLowerCase()) {
    throw new Error(`Account sync RSN mismatch. Expected ${expectedRsn}, received ${rsn}.`);
  }
  if (!payload?.skills || typeof payload.skills !== "object" || Array.isArray(payload.skills)) {
    throw new Error("Account sync payload is missing skills.");
  }
  if (!payload?.bosses || typeof payload.bosses !== "object" || Array.isArray(payload.bosses)) {
    throw new Error("Account sync payload is missing bosses.");
  }

  const syncedAt = payload?.syncedAt ?? raw?.syncedAt ?? Date.now();
  const accountType = typeof player?.accountType === "string" ? player.accountType : null;
  const source = payload?.source ?? raw?.source ?? "mettle-runelite-plugin";
  const syncVersion = numberOrDefault(payload?.version ?? raw?.version, ACCOUNT_SYNC_VERSION);

  const questState = normalizeQuestState({
    ...(payload?.quests && typeof payload.quests === "object" ? payload.quests : {}),
    source,
    syncVersion,
    syncAccountType: accountType,
    syncSourceRsn: rsn,
    updatedAt: syncedAt,
  });

  const diaryState = normalizeDiaryState({
    ...(payload?.achievementDiaries && typeof payload.achievementDiaries === "object"
      ? payload.achievementDiaries
      : {}),
    source,
    syncVersion,
    syncAccountType: accountType,
    syncSourceRsn: rsn,
    updatedAt: syncedAt,
  });

  return {
    format: ACCOUNT_SYNC_FORMAT,
    version: syncVersion,
    source,
    syncedAt: timestampOrZero(syncedAt) || Date.now(),
    player: {
      rsn,
      accountType,
    },
    skills: normalizeMap(payload.skills, SKILLS, 1),
    bosses: normalizeMap(payload.bosses, KEY_BOSSES, 0),
    questState,
    diaryState,
  };
}

export function parseAccountSyncText(rawText, options = {}) {
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error("Account sync file is not valid JSON.");
  }
  return parseAccountSyncPayload(parsed, options);
}
