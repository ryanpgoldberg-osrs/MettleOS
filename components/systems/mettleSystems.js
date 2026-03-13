import {
  KEY_BOSSES,
  MAX_METTLE_XP,
  METTLE_UNLOCKS,
  RECKONING_CATEGORIES,
  TIER_GATES,
  TIER_ORDER,
  XP_BREAKPOINTS,
} from "../data/constants.js";
import { FORK_WRITS } from "../data/forkDefs.js";
import { LANDMARK_WRITS } from "../data/landmarkDefs.js";
import { WRIT_POOL } from "../data/writPool.js";
import { getModifierForCategory, rollModifier } from "../utils/modifiers.js";
import { accountAverage, gapScores } from "../utils/skillHelpers.js";
import { generateFinalTrialDraft, computePath as computePathFromPool } from "../data/finalTrialDefs.js";

export function materializeWrit(writ, skillLevels, bossKC) {
  if (!writ) return writ;
  return {
    ...writ,
    title: writ.titleFn ? writ.titleFn(skillLevels, bossKC) : writ.title,
    objective: writ.objectiveFn ? writ.objectiveFn(skillLevels, bossKC) : writ.objective,
  };
}

export function meetsRequirements(writ, skillLevels, bossKC) {
  if (writ.requiresFn) return writ.requiresFn(skillLevels, bossKC);
  return true;
}

export function xpToLevel(xp) {
  for (let i = 1; i < XP_BREAKPOINTS.length; i++) {
    const prev = XP_BREAKPOINTS[i - 1];
    const curr = XP_BREAKPOINTS[i];
    if (xp < curr.xp) {
      const t = (xp - prev.xp) / (curr.xp - prev.xp);
      return Math.floor(prev.level + t * (curr.level - prev.level));
    }
  }
  return 99;
}

export function xpForLevel(level) {
  if (level <= 1) return 0;
  if (level >= 99) return MAX_METTLE_XP;
  for (let i = 1; i < XP_BREAKPOINTS.length; i++) {
    const prev = XP_BREAKPOINTS[i - 1];
    const curr = XP_BREAKPOINTS[i];
    if (level >= prev.level && level <= curr.level) {
      const t = (level - prev.level) / (curr.level - prev.level);
      return Math.floor(prev.xp + t * (curr.xp - prev.xp));
    }
  }
  return MAX_METTLE_XP;
}

export function levelProgressPct(xp) {
  const level = xpToLevel(xp);
  if (level >= 99) return 100;
  const cur = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return Math.round(((xp - cur) / (next - cur)) * 100);
}

export function tierForLevel(level) {
  if (level <= 20) return "Guthix";
  if (level <= 40) return "Saradomin";
  if (level <= 60) return "Bandos";
  if (level <= 80) return "Zamorak";
  return "Zaros";
}

export function unlockedFeatures(level) {
  return METTLE_UNLOCKS.filter(x => level >= x.level);
}

export function getDebtStatus(debtWrits, mustClearAll, streak, favoredDrawsRemaining) {
  if (mustClearAll) return "blocked";
  if (debtWrits.length >= 1) return "cursed";
  if ((favoredDrawsRemaining ?? 0) > 0) return "favored";
  if (streak >= 15) return "hot_streak";
  return "normal";
}

export function draftSizeFromStatus(status) {
  if (status === "cursed") return 2;
  if (status === "favored") return 4;
  if (status === "hot_streak") return 4;
  return 3;
}

export function getPendingTrial(mettleLevel, completedIds) {
  const trials = WRIT_POOL.filter(w => w.trial);
  for (const t of trials.sort((a, b) => a.triggerLevel - b.triggerLevel)) {
    if (mettleLevel >= t.triggerLevel && !completedIds.includes(t.id)) {
      return t;
    }
  }
  return null;
}

export function generateReckoningWrit(category, reckoningCount, mettleLevel, skillLevels, bossKC) {
  const currentTier = tierForLevel(mettleLevel);
  const eligible = WRIT_POOL.filter(w =>
    !w.trial &&
    (w.category === category ||
      (category === "PvM Intro" && w.category === "PvM Endurance") ||
      (category === "PvM Endurance" && w.category === "PvM Intro")) &&
    TIER_ORDER.indexOf(w.tier) <= TIER_ORDER.indexOf(currentTier) &&
    meetsRequirements(w, skillLevels, bossKC)
  );

  let baseWrit = eligible[0];
  if (eligible.length > 1) {
    const idx = Math.floor(Math.random() * Math.min(3, eligible.length));
    baseWrit = eligible[idx];
  }

  const severity = Math.min(reckoningCount, 3);
  const xpMultiplier = severity === 1 ? 1.5 : severity === 2 ? 2 : 3;
  const modifier = getModifierForCategory(category, (severity - 1) / 2);
  const baseXP = baseWrit ? baseWrit.xp : 300;
  const baseObjective = baseWrit ? materializeWrit(baseWrit, skillLevels, bossKC).objective : `Complete a ${category} challenge`;

  return {
    id: `reckoning_${category}_${Date.now()}`,
    title: `Reckoning: ${category}`,
    category,
    tier: currentTier,
    difficulty: severity >= 3 ? "Elite" : severity >= 2 ? "Hard" : "Medium",
    xp: Math.round(baseXP * xpMultiplier),
    modifier,
    reckoning: true,
    reckoningCount: severity,
    objective: `${baseObjective} — MODIFIER: ${modifier}`,
  };
}

function computeWeight(writ, skillLevels, bossKC, completedIds, suppressedIds, mettleLevel) {
  if (writ.trial) return 0;
  if (!writ.repeatable && completedIds.includes(writ.id)) return 0;
  if (suppressedIds.includes(writ.id)) return 0;
  if (!meetsRequirements(writ, skillLevels, bossKC)) return 0;
  if (TIER_ORDER.indexOf(writ.tier) > TIER_ORDER.indexOf(tierForLevel(mettleLevel))) return 0;

  const gaps = gapScores(skillLevels);
  const maxGap = Math.max(...Object.values(gaps));
  const combatAvg = (skillLevels.attack + skillLevels.strength + skillLevels.defence) / 3;
  const touchedBosses = KEY_BOSSES.filter(boss => (bossKC[boss] ?? 0) > 0).length;
  const totalBossKC = KEY_BOSSES.reduce((sum, boss) => sum + (bossKC[boss] ?? 0), 0);
  const freshBossingAccount = touchedBosses === 0;
  const earlyBossingAccount = touchedBosses > 0 && touchedBosses <= 4;

  let weight = 1;
  if (writ.category === "Skill Gap" && maxGap > 0.10) weight *= 2 + maxGap * 5;
  if ((writ.category === "PvM Intro" || writ.category === "PvM Endurance") && combatAvg > 85) weight *= 3;
  if (writ.category === "Quest") weight *= 2;
  if (writ.category === "Endurance") weight *= 1.2;
  if (writ.category === "Economic") weight *= 0.8;

  if (writ.category === "PvM Intro" || writ.category === "PvM Endurance") {
    if (freshBossingAccount) {
      weight *= writ.category === "PvM Intro" ? 3 : 0.35;
      if (writ.difficulty === "Hard") weight *= 0.75;
      if (writ.difficulty === "Elite") weight *= 0.55;
    } else if (earlyBossingAccount) {
      weight *= writ.category === "PvM Intro" ? 1.8 : 0.75;
    } else if (touchedBosses >= 12) {
      weight *= writ.category === "PvM Endurance" ? 1.25 : 0.9;
    }

    if (combatAvg < 70 && writ.tier !== "Guthix") weight *= 0.8;
    if (totalBossKC >= 100 && writ.category === "PvM Endurance") weight *= 1.15;
  }

  const bossMap = { g_pvm_2: "obor", g_pvm_3: "bryophyta" };
  if (bossMap[writ.id]) {
    const kc = bossKC[bossMap[writ.id]] ?? 0;
    if (kc === 0) weight *= 3;
    else if (kc <= 5) weight *= 2;
    else if (kc > 20) weight *= 0.5;
  }
  if (writ.id === "g_pvm_1" || writ.id === "g_pvm_7") {
    const kc = bossKC.barrows_chests ?? 0;
    if (kc === 0) weight *= 3;
    else if (kc <= 5) weight *= 2;
    else if (kc > 20) weight *= 0.5;
  }
  if (writ.id === "z_pvm_14") {
    const untouchedBosses = KEY_BOSSES.filter(boss => (bossKC[boss] ?? 0) === 0).length;
    if (untouchedBosses > 0) weight *= 1.6 + Math.min(untouchedBosses / 40, 0.8);
    if (freshBossingAccount) weight *= 0.8;
  }
  return Math.max(0.1, weight);
}

export function generateDraft(skillLevels, bossKC, completedIds, recentDraftHistory, debtWrits, mettleLevel, requestedSize = null, streak = 0, favoredDrawsRemaining = 0) {
  const status = getDebtStatus(debtWrits, false, streak, favoredDrawsRemaining);
  const draftSize = requestedSize ?? draftSizeFromStatus(status);
  const suppressedIds = recentDraftHistory.flat();

  const weighted = WRIT_POOL
    .filter(w => !w.trial)
    .map(w => ({ ...w, weight: computeWeight(w, skillLevels, bossKC, completedIds, suppressedIds, mettleLevel) }))
    .filter(w => w.weight > 0);

  if (weighted.length === 0) return [];

  const pool = [...weighted];
  const selected = [];
  const seenObjectives = new Set();

  for (let i = 0; i < Math.min(draftSize, pool.length); i++) {
    const total = pool.reduce((sum, current) => sum + current.weight, 0);
    let rand = Math.random() * total;
    let idx = 0;
    for (idx = 0; idx < pool.length; idx++) {
      rand -= pool[idx].weight;
      if (rand <= 0) break;
    }
    idx = Math.min(idx, pool.length - 1);

    const writ = materializeWrit(pool[idx], skillLevels, bossKC);
    if (seenObjectives.has(writ.objective)) {
      pool.splice(idx, 1);
      i--;
      continue;
    }

    const mod = rollModifier(writ);
    if (mod) {
      writ.modifier = mod;
      writ.objective = `${writ.objective} — MODIFIER: ${mod}`;
    }

    seenObjectives.add(writ.objective);
    selected.push(writ);
    pool.splice(idx, 1);
  }

  return selected;
}

export const computePath = computePathFromPool;
export { generateFinalTrialDraft };
export { RECKONING_CATEGORIES, TIER_GATES, TIER_ORDER, FORK_WRITS, LANDMARK_WRITS };
