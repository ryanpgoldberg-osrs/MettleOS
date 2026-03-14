import {
  ACCOUNT_MODIFIERS,
  COMBAT_MODIFIERS,
  SKILLING_MODIFIERS,
  TIER_SEAL_REWARDS,
} from "../data/constants.js";

export function rollModifier(task) {
  if (Math.random() > 0.35) return null;
  let pool;
  if (["PvM Intro","PvM Endurance"].includes(task.category)) pool = COMBAT_MODIFIERS;
  else if (["Skill Gap","Economic"].includes(task.category)) pool = SKILLING_MODIFIERS;
  else if (["Endurance"].includes(task.category)) pool = [...SKILLING_MODIFIERS, ...ACCOUNT_MODIFIERS];
  else if (["Quest","Exploration"].includes(task.category)) pool = ACCOUNT_MODIFIERS;
  else pool = ACCOUNT_MODIFIERS;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function getModifierForCategory(category, severity) {
  let pool;
  if (["PvM Intro","PvM Endurance"].includes(category)) pool = COMBAT_MODIFIERS;
  else if (["Skill Gap","Economic"].includes(category)) pool = SKILLING_MODIFIERS;
  else if (["Endurance"].includes(category)) pool = [...SKILLING_MODIFIERS, ...ACCOUNT_MODIFIERS];
  else pool = [...ACCOUNT_MODIFIERS, ...SKILLING_MODIFIERS];

  const idx = Math.min(Math.floor(severity * pool.length * 0.6), pool.length - 1);
  return pool[idx];
}

export function sealsForTask(task) {
  return TIER_SEAL_REWARDS[task?.tier] ?? 1;
}

export function modifierXpBonus(task) {
  if (!task) return 0;
  const modifierCount = (task.modifier ? 1 : 0) + (task.trialModifier ? 1 : 0);
  if (modifierCount === 0) return 0;
  return Math.max(25, Math.round((task.xp ?? 0) * 0.25 * modifierCount));
}

export function taskXp(task) {
  return (task?.xp ?? 0) + modifierXpBonus(task);
}

export function streakSealBonus(streak) {
  if (streak > 0 && streak % 10 === 0) return 5;
  if (streak > 0 && streak % 5 === 0) return 2;
  if (streak > 0 && streak % 3 === 0) return 1;
  return 0;
}
