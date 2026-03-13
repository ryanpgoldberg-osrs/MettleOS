import { normalizeQuestState } from "./questSync.js";

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

function completedQuestSet(raw) {
  return new Set(normalizeQuestState(raw).completedQuestIds);
}

function currentQuestPoints(raw) {
  const state = normalizeQuestState(raw);
  return state.manualQuestPoints ?? state.syncedQuestPoints;
}

function anyBossCompleted(bossKeys, bossKC = {}) {
  if (!Array.isArray(bossKeys) || bossKeys.length === 0) return false;
  return bossKeys.some((bossKey) => (bossKC?.[bossKey] ?? 0) > 0);
}

export function hasQuestCape(raw) {
  return normalizeQuestState(raw).questCapeDetected;
}

export function hasCompletedAnyQuest(raw, questIds) {
  const completed = completedQuestSet(raw);
  return (questIds ?? []).some((questId) => {
    const normalized = normalizeQuestId(questId);
    return normalized ? completed.has(normalized) : false;
  });
}

export function hasCompletedAllQuests(raw, questIds) {
  const completed = completedQuestSet(raw);
  return (questIds ?? []).every((questId) => {
    const normalized = normalizeQuestId(questId);
    return normalized ? completed.has(normalized) : false;
  });
}

export function isQuestObjectiveAlreadyComplete(entity, questState, bossKC = {}) {
  if (!entity || typeof entity !== "object") return false;

  if (entity.category === "Quest" && hasQuestCape(questState)) {
    return true;
  }

  if (entity.requiresQuestCape && hasQuestCape(questState)) {
    return true;
  }

  if (typeof entity.questPointsTarget === "number") {
    const questPoints = currentQuestPoints(questState);
    if (questPoints !== null && questPoints >= entity.questPointsTarget) {
      return true;
    }
  }

  if (entity.questCompleteAnyOf && hasCompletedAnyQuest(questState, entity.questCompleteAnyOf)) {
    return true;
  }

  if (entity.questCompleteAllOf && hasCompletedAllQuests(questState, entity.questCompleteAllOf)) {
    return true;
  }

  if (entity.bossCompleteAnyOf && anyBossCompleted(entity.bossCompleteAnyOf, bossKC)) {
    return true;
  }

  return false;
}
