import { BOSS_BANDS, PRODUCTION, SKILLS, SKILLING } from "../data/constants.js";

export function hardestUntouchedBoss(bossKC) {
  for (const band of BOSS_BANDS) {
    const untouched = band.filter(b => (bossKC[b] ?? 0) === 0);
    if (untouched.length > 0) return untouched[0];
  }
  return BOSS_BANDS[0][0];
}

export function firstUntouchedFromPool(pool, bossKC) {
  return pool.find(b => (bossKC[b] ?? 0) === 0) || pool[0];
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

export function lowestKCBoss(bossKC, eligibleBosses) {
  const zeroes = eligibleBosses.filter(b => (bossKC[b] ?? 0) === 0);
  if (zeroes.length > 0) return zeroes[0];
  return [...eligibleBosses].sort((a, b) => (bossKC[a] ?? 0) - (bossKC[b] ?? 0))[0];
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
