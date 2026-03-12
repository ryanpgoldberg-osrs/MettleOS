import { BOSS_BANDS, PRODUCTION, SKILLS, SKILLING } from "../data/constants.js";

function accountBossSeed(skillLevels = {}, bossKC = {}) {
  const skillSeed = Object.entries(skillLevels).reduce(
    (sum, [skill, level], index) => sum + (index + 1) * (level ?? 0) * (skill.length + 3),
    0
  );
  const bossSeed = Object.entries(bossKC).reduce(
    (sum, [boss, kc], index) => sum + (index + 1) * (kc ?? 0) * (boss.length + 7),
    0
  );
  return skillSeed + bossSeed;
}

function seededChoice(pool, seed) {
  if (pool.length === 0) return undefined;
  const normalized = Math.abs(seed) % pool.length;
  return pool[normalized];
}

export function hardestUntouchedBoss(bossKC, skillLevels = {}) {
  const seed = accountBossSeed(skillLevels, bossKC);
  for (const band of BOSS_BANDS) {
    const untouched = band.filter(b => (bossKC[b] ?? 0) === 0);
    if (untouched.length > 0) return seededChoice(untouched, seed);
  }
  return seededChoice(BOSS_BANDS[0], seed) || BOSS_BANDS[0][0];
}

export function firstUntouchedFromPool(pool, bossKC, skillLevels = {}) {
  const untouched = pool.filter(b => (bossKC[b] ?? 0) === 0);
  if (untouched.length > 0) return seededChoice(untouched, accountBossSeed(skillLevels, bossKC));
  return lowestKCBoss(bossKC, pool, skillLevels);
}

export function lowestSkill(skillLevels, exclude = []) {
  return [...SKILLS]
    .filter(s => !exclude.includes(s))
    .sort((a, b) => skillLevels[a] - skillLevels[b])[0];
}

export function lowestNSkills(skillLevels, n, onlySkilling = false) {
  const pool = onlySkilling ? SKILLING : SKILLS;
  return [...pool].sort((a, b) => skillLevels[a] - skillLevels[b]).slice(0, n);
}

export function lowestProductionSkill(skillLevels) {
  return [...PRODUCTION].sort((a, b) => skillLevels[a] - skillLevels[b])[0];
}

export function lowestKCBoss(bossKC, eligibleBosses, skillLevels = {}) {
  const seed = accountBossSeed(skillLevels, bossKC);
  const minKC = eligibleBosses.reduce((lowest, boss) => Math.min(lowest, bossKC[boss] ?? 0), Infinity);
  const candidates = eligibleBosses.filter(b => (bossKC[b] ?? 0) === minKC);
  return seededChoice(candidates, seed) || eligibleBosses[0];
}

export function accountAverage(skillLevels) {
  const vals = Object.values(skillLevels);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export function gapScores(skillLevels) {
  const avg = accountAverage(skillLevels);
  const scores = {};
  Object.entries(skillLevels).forEach(([s, l]) => {
    scores[s] = Math.max(0, (avg - l) / avg);
  });
  return scores;
}
