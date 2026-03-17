import { SKILLS } from "../data/constants.js";
import { skillLabel } from "./labels.js";

const COMBAT_SKILLS = ["attack", "strength", "defence", "ranged", "magic"];

const NON_LEVEL_OBJECTIVE_PATTERNS = [
  /\bquest points\b/,
  /\b\d+\s+qp\b/,
  /\btotal level\b/,
  /\btotal slayer kills\b/,
  /\bslayer tasks?\b/,
];

function normalizeText(value) {
  return (value ?? "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const SKILL_NAME_ENTRIES = SKILLS.map((skill) => [skill, normalizeText(skillLabel(skill))])
  .sort((a, b) => b[1].length - a[1].length);

function objectiveText(task) {
  return normalizeText(`${task?.title ?? ""} ${task?.objective ?? ""}`);
}

function parseNumber(value) {
  const parsed = parseInt(String(value).replace(/,/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildTargetAdjustments(skillLevels, skillIds, targetLevel) {
  return skillIds
    .filter((skill) => SKILLS.includes(skill))
    .map((skill) => ({
      skill,
      fromLevel: skillLevels?.[skill] ?? 1,
      toLevel: Math.max(skillLevels?.[skill] ?? 1, targetLevel),
    }))
    .filter(({ toLevel, fromLevel }) => toLevel > fromLevel);
}

function buildIncrementAdjustments(skillLevels, skillIds, amount) {
  return skillIds
    .filter((skill) => SKILLS.includes(skill))
    .map((skill) => ({
      skill,
      fromLevel: skillLevels?.[skill] ?? 1,
      toLevel: (skillLevels?.[skill] ?? 1) + amount,
    }))
    .filter(({ toLevel, fromLevel }) => toLevel > fromLevel);
}

function findSkillsInText(text) {
  const matches = [];
  for (const [skill, label] of SKILL_NAME_ENTRIES) {
    if (label && text.includes(label)) {
      matches.push(skill);
    }
  }
  return matches;
}

function findSingleSkillInText(text) {
  const matches = findSkillsInText(text);
  return matches.length === 1 ? matches[0] : null;
}

function parseReachSkillTarget(text) {
  for (const [skill, label] of SKILL_NAME_ENTRIES) {
    const patterns = [
      new RegExp(`\\bbring ${escapeRegExp(label)} to level (\\d+)\\b`),
      new RegExp(`\\bbring ${escapeRegExp(label)} to (\\d+)\\b`),
      new RegExp(`\\breach level (\\d+) in ${escapeRegExp(label)}\\b`),
      new RegExp(`\\breach (\\d+) in ${escapeRegExp(label)}\\b`),
      new RegExp(`\\breach (\\d+) ${escapeRegExp(label)}\\b`),
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return { skill, targetLevel: parseNumber(match[1]) };
      }
    }
  }
  return null;
}

function parseSingleSkillIncrement(text) {
  for (const [skill, label] of SKILL_NAME_ENTRIES) {
    const patterns = [
      new RegExp(`\\bgain (\\d+) levels? in ${escapeRegExp(label)}\\b`),
      new RegExp(`\\braise ${escapeRegExp(label)} by (\\d+) levels?\\b`),
      new RegExp(`\\btrain ${escapeRegExp(label)} by (\\d+) levels?\\b`),
      new RegExp(`\\bclose (\\d+) levels? of the gap in ${escapeRegExp(label)}\\b`),
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return { skill, amount: parseNumber(match[1]) };
      }
    }
  }
  return null;
}

export function getSkillLevelAdjustments(task, skillLevels = {}) {
  if (!task) return [];

  const text = objectiveText(task);
  if (!text || NON_LEVEL_OBJECTIVE_PATTERNS.some((pattern) => pattern.test(text))) {
    return [];
  }

  if (/\bxp\b/.test(text)) {
    return [];
  }

  const combatTargetMatch = text.match(/\breach (\d+) in every combat stat\b/);
  if (combatTargetMatch) {
    return buildTargetAdjustments(skillLevels, COMBAT_SKILLS, parseNumber(combatTargetMatch[1]));
  }

  const everySkillAboveMatch = text.match(/\b(?:raise|bring) every skill above (\d+)\b/);
  if (everySkillAboveMatch) {
    const targetLevel = parseNumber(everySkillAboveMatch[1]) + 1;
    return buildTargetAdjustments(skillLevels, SKILLS, targetLevel);
  }

  const eachGainMatch = text.match(/\bgain (\d+) levels? in each:? (.+)$/);
  if (eachGainMatch) {
    const amount = parseNumber(eachGainMatch[1]);
    const skills = findSkillsInText(eachGainMatch[2]);
    return buildIncrementAdjustments(skillLevels, skills, amount);
  }

  const eachGapMatch = text.match(/\bclose (\d+) levels? of the gap in each of (.+?)(?: toward|$)/);
  if (eachGapMatch) {
    const amount = parseNumber(eachGapMatch[1]);
    const skills = findSkillsInText(eachGapMatch[2]);
    return buildIncrementAdjustments(skillLevels, skills, amount);
  }

  const withinMatch = text.match(/\bwithin (\d+) levels of each other\b/);
  if (withinMatch && text.includes("(")) {
    const range = parseNumber(withinMatch[1]);
    const skills = findSkillsInText(text);
    if (skills.length >= 2) {
      const highestLevel = Math.max(...skills.map((skill) => skillLevels?.[skill] ?? 1));
      const minimumLevel = Math.max(1, highestLevel - range);
      return buildTargetAdjustments(skillLevels, skills, minimumLevel);
    }
  }

  const reachTarget = parseReachSkillTarget(text);
  if (reachTarget) {
    return buildTargetAdjustments(skillLevels, [reachTarget.skill], reachTarget.targetLevel);
  }

  const singleIncrement = parseSingleSkillIncrement(text);
  if (singleIncrement) {
    return buildIncrementAdjustments(skillLevels, [singleIncrement.skill], singleIncrement.amount);
  }

  const singleSkill = findSingleSkillInText(text);
  if (singleSkill && /\braise\b/.test(text) && /\babove your account average\b/.test(text)) {
    const average = Object.values(skillLevels).reduce((sum, level) => sum + level, 0) / Math.max(Object.keys(skillLevels).length, 1);
    return buildTargetAdjustments(skillLevels, [singleSkill], Math.floor(average) + 1);
  }

  return [];
}

export function applySkillLevelAdjustments(currentSkillLevels, adjustments) {
  if (!currentSkillLevels || !Array.isArray(adjustments) || adjustments.length === 0) {
    return currentSkillLevels;
  }

  const nextSkillLevels = { ...currentSkillLevels };
  adjustments.forEach(({ skill, toLevel }) => {
    if (!skill || !Number.isFinite(toLevel)) return;
    nextSkillLevels[skill] = Math.max(nextSkillLevels[skill] ?? 1, toLevel);
  });
  return nextSkillLevels;
}
