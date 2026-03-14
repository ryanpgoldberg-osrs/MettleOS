import { normalizeDiaryState } from "./accountSync.js";
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

function normalizeDiaryTierId(value) {
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

function normalizeQuestPoolIds(questIds) {
  return (questIds ?? [])
    .map((quest) => {
      if (typeof quest === "string") return normalizeQuestId(quest);
      if (quest && typeof quest === "object" && typeof quest.id === "string") {
        return normalizeQuestId(quest.id);
      }
      return null;
    })
    .filter(Boolean);
}

function currentQuestPoints(raw) {
  const state = normalizeQuestState(raw);
  return state.manualQuestPoints ?? state.syncedQuestPoints;
}

function startedQuestIds(raw) {
  return normalizeQuestState(raw).startedQuestIds;
}

function completedDiaryTierSet(raw) {
  return new Set(normalizeDiaryState(raw).completedTierIds);
}

function diaryDifficultyForTierId(value) {
  const normalized = normalizeDiaryTierId(value);
  if (!normalized) return null;
  const parts = normalized.split("_");
  return parts[parts.length - 1] ?? null;
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

export function countStartedQuests(raw) {
  return startedQuestIds(raw).length;
}

export function countCompletedQuestPool(raw, questIds) {
  const completed = completedQuestSet(raw);
  return normalizeQuestPoolIds(questIds).filter((questId) => completed.has(questId)).length;
}

export function hasCompletedAnyDiaryTier(raw, tierIds) {
  const completed = completedDiaryTierSet(raw);
  return (tierIds ?? []).some((tierId) => {
    const normalized = normalizeDiaryTierId(tierId);
    return normalized ? completed.has(normalized) : false;
  });
}

export function hasCompletedAllDiaryTiers(raw, tierIds) {
  const completed = completedDiaryTierSet(raw);
  return (tierIds ?? []).every((tierId) => {
    const normalized = normalizeDiaryTierId(tierId);
    return normalized ? completed.has(normalized) : false;
  });
}

export function countCompletedDiaryTiers(raw, difficulty = null) {
  const tiers = normalizeDiaryState(raw).completedTierIds;
  if (!difficulty) return tiers.length;
  return tiers.filter((tierId) => diaryDifficultyForTierId(tierId) === difficulty).length;
}

export function isTaskObjectiveAlreadyComplete(entity, questState, bossKC = {}, diaryState = null) {
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

  if (entity.questPoolAnyOf) {
    const poolIds = normalizeQuestPoolIds(entity.questPoolAnyOf);
    if (poolIds.length > 0 && countCompletedQuestPool(questState, poolIds) >= poolIds.length) {
      return true;
    }
  }

  if (entity.bossCompleteAnyOf && anyBossCompleted(entity.bossCompleteAnyOf, bossKC)) {
    return true;
  }

  if (entity.diaryTierAnyOf && hasCompletedAnyDiaryTier(diaryState, entity.diaryTierAnyOf)) {
    return true;
  }

  if (entity.diaryTierAllOf && hasCompletedAllDiaryTiers(diaryState, entity.diaryTierAllOf)) {
    return true;
  }

  if (typeof entity.diaryTierCountTarget === "number") {
    const completedCount = countCompletedDiaryTiers(diaryState, entity.diaryDifficulty ?? null);
    if (completedCount >= entity.diaryTierCountTarget) {
      return true;
    }
  }

  return false;
}

export const isQuestObjectiveAlreadyComplete = isTaskObjectiveAlreadyComplete;
