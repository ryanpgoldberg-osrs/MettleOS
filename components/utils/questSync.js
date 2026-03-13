export const QUEST_SYNC_FORMAT = "mettle-quest-sync";
export const QUEST_SYNC_VERSION = 1;

function normalizeRsn(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeQuestId(value) {
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

function questIdsFromList(list) {
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
    const normalized = normalizeQuestId(candidate);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    ids.push(normalized);
  }

  return ids.sort();
}

function numberOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function timestampOrNow(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
}

function unwrapQuestSyncPayload(raw) {
  if (raw?.format === QUEST_SYNC_FORMAT && raw.payload && typeof raw.payload === "object") {
    return raw.payload;
  }
  if (raw?.format === QUEST_SYNC_FORMAT && raw.sync && typeof raw.sync === "object") {
    return raw.sync;
  }
  return raw;
}

export function createEmptyQuestState() {
  return {
    completedQuestIds: [],
    startedQuestIds: [],
    syncedQuestPoints: null,
    manualQuestPoints: null,
    questCapeDetected: false,
    source: null,
    syncVersion: null,
    syncAccountType: null,
    syncSourceRsn: "",
    updatedAt: 0,
  };
}

export function normalizeQuestState(raw) {
  const base = createEmptyQuestState();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;

  const completedQuestIds = questIdsFromList(raw.completedQuestIds ?? raw.completed ?? raw.questIds);
  const completedSet = new Set(completedQuestIds);
  const startedQuestIds = questIdsFromList(raw.startedQuestIds ?? raw.started).filter((id) => !completedSet.has(id));

  return {
    ...base,
    completedQuestIds,
    startedQuestIds,
    syncedQuestPoints: numberOrNull(raw.syncedQuestPoints ?? raw.questPoints),
    manualQuestPoints: numberOrNull(raw.manualQuestPoints),
    questCapeDetected: Boolean(raw.questCapeDetected),
    source: typeof raw.source === "string" && raw.source.trim() ? raw.source.trim() : null,
    syncVersion: numberOrNull(raw.syncVersion ?? raw.version),
    syncAccountType: typeof raw.syncAccountType === "string"
      ? raw.syncAccountType
      : typeof raw.accountType === "string"
        ? raw.accountType
        : null,
    syncSourceRsn: normalizeRsn(raw.syncSourceRsn ?? raw.rsn),
    updatedAt: raw.updatedAt ? timestampOrNow(raw.updatedAt) : 0,
  };
}

export function summarizeQuestState(raw) {
  const state = normalizeQuestState(raw);
  const questPoints = state.manualQuestPoints ?? state.syncedQuestPoints;
  const hasSyncData = Boolean(
    state.completedQuestIds.length ||
    state.startedQuestIds.length ||
    questPoints !== null ||
    state.updatedAt
  );

  return {
    completedCount: state.completedQuestIds.length,
    startedCount: state.startedQuestIds.length,
    questPoints,
    questCapeDetected: state.questCapeDetected,
    hasSyncData,
    sourceLabel: state.source || "manual",
    lastUpdatedLabel: state.updatedAt ? new Date(state.updatedAt).toLocaleString() : "Not synced yet",
  };
}

export function parseQuestSyncPayload(raw, options = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Quest sync payload must be a JSON object.");
  }
  if (raw.format && raw.format !== QUEST_SYNC_FORMAT) {
    throw new Error("That file is not a Mettle quest sync payload.");
  }

  const payload = unwrapQuestSyncPayload(raw);
  const player = payload?.player && typeof payload.player === "object" ? payload.player : null;
  const questData = payload?.quests && typeof payload.quests === "object"
    ? payload.quests
    : payload?.questState && typeof payload.questState === "object"
      ? payload.questState
      : payload;

  const hasQuestFields = Boolean(
    questData &&
    typeof questData === "object" &&
    (
      "completedQuestIds" in questData ||
      "completed" in questData ||
      "startedQuestIds" in questData ||
      "started" in questData ||
      "questPoints" in questData ||
      "syncedQuestPoints" in questData ||
      "questCapeDetected" in questData
    )
  );

  if (!hasQuestFields) {
    throw new Error("Quest sync payload is missing quest data.");
  }

  const sourceRsn = normalizeRsn(payload?.rsn ?? player?.rsn ?? questData?.rsn);
  const expectedRsn = normalizeRsn(options.expectedRsn);
  if (expectedRsn && sourceRsn && expectedRsn.toLowerCase() !== sourceRsn.toLowerCase()) {
    throw new Error(`Quest sync RSN mismatch. Expected ${expectedRsn}, received ${sourceRsn}.`);
  }

  return normalizeQuestState({
    completedQuestIds: questData.completedQuestIds ?? questData.completed ?? [],
    startedQuestIds: questData.startedQuestIds ?? questData.started ?? [],
    syncedQuestPoints: questData.syncedQuestPoints ?? questData.questPoints ?? null,
    manualQuestPoints: questData.manualQuestPoints ?? null,
    questCapeDetected: questData.questCapeDetected ?? false,
    source: payload?.source ?? raw?.source ?? "mettle-runelite-plugin",
    syncVersion: payload?.version ?? raw?.version ?? QUEST_SYNC_VERSION,
    syncAccountType: player?.accountType ?? payload?.accountType ?? null,
    syncSourceRsn: sourceRsn,
    updatedAt: payload?.syncedAt ?? raw?.syncedAt ?? Date.now(),
  });
}

export function parseQuestSyncText(rawText, options = {}) {
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error("Quest sync file is not valid JSON.");
  }
  return parseQuestSyncPayload(parsed, options);
}
