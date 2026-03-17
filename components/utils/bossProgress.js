import { KEY_BOSSES } from "../data/constants.js";
import { bossLabel } from "./labels.js";

function normalizeText(value) {
  return (value ?? "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const BOSS_NAME_ENTRIES = KEY_BOSSES
  .map((bossId) => [bossId, normalizeText(bossLabel(bossId))])
  .sort((a, b) => b[1].length - a[1].length);

const BOSS_ALIASES = {
  barrows_chests: ["barrows run", "barrows runs", "barrows"],
  sol_heredit: ["fortis colosseum", "colosseum"],
  tzkal_zuk: ["inferno"],
};

const EXCLUDED_OBJECTIVE_PATTERNS = [
  /\bkill any\b/,
  /\bdefeat any\b/,
  /\bcomplete any\b/,
  /\bkill the same boss\b/,
  /\bkill 3 different bosses\b/,
  /\bkill 5 different wilderness bosses\b/,
  /\bkill 3 different wilderness bosses\b/,
  /\bkill 10 wilderness bosses\b/,
  /\bsurvive 10 wilderness boss kills\b/,
  /\benter chambers of xeric\b/,
  /\bunlock and enter the gauntlet\b/,
  /\battempt zulrah\b/,
  /\battempt the fortis colosseum\b/,
  /\benter god wars dungeon and defeat any general\b/,
  /\btheatre of blood entry mode\b/,
];

function isExcludedObjective(text) {
  return EXCLUDED_OBJECTIVE_PATTERNS.some((pattern) => pattern.test(text));
}

function objectiveText(task) {
  return normalizeText(`${task?.title ?? ""} ${task?.objective ?? ""}`);
}

function getAliasesForBoss(bossId) {
  return BOSS_ALIASES[bossId] ?? [];
}

function textMentionsBoss(text, bossId) {
  const label = normalizeText(bossLabel(bossId));
  if (label && text.includes(label)) return true;
  return getAliasesForBoss(bossId).some((alias) => text.includes(normalizeText(alias)));
}

function findMentionedBosses(text) {
  const matches = [];
  for (const [bossId, label] of BOSS_NAME_ENTRIES) {
    if (label && text.includes(label)) {
      matches.push(bossId);
    }
  }
  for (const bossId of Object.keys(BOSS_ALIASES)) {
    if (matches.includes(bossId)) continue;
    if (getAliasesForBoss(bossId).some((alias) => text.includes(normalizeText(alias)))) {
      matches.push(bossId);
    }
  }
  return matches;
}

function findSingleBoss(task, text) {
  if (Array.isArray(task?.bossCompleteAnyOf) && task.bossCompleteAnyOf.length > 1) {
    return null;
  }
  if (Array.isArray(task?.bossCompleteAnyOf) && task.bossCompleteAnyOf.length === 1) {
    return task.bossCompleteAnyOf[0];
  }
  const matches = findMentionedBosses(text);
  return matches.length === 1 ? matches[0] : null;
}

function parseRunCount(text) {
  const totalMatch = text.match(/\bcomplete\s+(\d+)\s+.*?\bruns?\s+total\b/);
  if (totalMatch) {
    return { amount: parseInt(totalMatch[1], 10), isTotal: true };
  }

  const runMatch = text.match(/\bcomplete\s+(\d+)\s+.*?\bruns?\b/);
  if (runMatch) {
    return { amount: parseInt(runMatch[1], 10), isTotal: false };
  }

  return null;
}

function parseKillCount(text) {
  const totalMatch = text.match(/\b(?:kill|defeat|subdue)\s+.*?\b(\d+)\s+times\s+total\b/);
  if (totalMatch) {
    return { amount: parseInt(totalMatch[1], 10), isTotal: true };
  }

  const killMatch = text.match(/\b(?:kill|defeat|subdue)\s+.*?\b(\d+)\s+times\b/);
  if (killMatch) {
    return { amount: parseInt(killMatch[1], 10), isTotal: false };
  }

  return null;
}

function resolveSingleBossAmount(task, bossId, bossKC, text) {
  const currentKc = bossKC?.[bossId] ?? 0;
  const runCount = parseRunCount(text);
  if (runCount) {
    return runCount.isTotal ? Math.max(0, runCount.amount - currentKc) : runCount.amount;
  }

  const killCount = parseKillCount(text);
  if (killCount) {
    return killCount.isTotal ? Math.max(0, killCount.amount - currentKc) : killCount.amount;
  }

  if (/\bfor the first time\b/.test(text)) return 1;
  if (/\bonce\b/.test(text) && textMentionsBoss(text, bossId)) return 1;
  if (/\breturn to\b/.test(text) && textMentionsBoss(text, bossId)) return 1;
  if (/\b(?:kill|defeat|subdue|complete|obtain)\b/.test(text) && textMentionsBoss(text, bossId)) return 1;
  return 0;
}

export function getBossKcAdjustments(task, bossKC = {}) {
  if (!task) return [];

  const text = objectiveText(task);
  if (!text || isExcludedObjective(text)) return [];

  if (/\bkill all three dagannoth kings\b/.test(text)) {
    return [
      { bossId: "dagannoth_rex", amount: 1 },
      { bossId: "dagannoth_prime", amount: 1 },
      { bossId: "dagannoth_supreme", amount: 1 },
    ];
  }

  if (/\bkill all four dt2 bosses\b/.test(text)) {
    return [
      { bossId: "vardorvis", amount: 1 },
      { bossId: "duke_sucellus", amount: 1 },
      { bossId: "the_leviathan", amount: 1 },
      { bossId: "the_whisperer", amount: 1 },
    ];
  }

  const bossId = findSingleBoss(task, text);
  if (!bossId) return [];

  const amount = resolveSingleBossAmount(task, bossId, bossKC, text);
  if (amount <= 0) return [];
  return [{ bossId, amount }];
}

export function applyBossKcAdjustments(currentBossKC, adjustments) {
  if (!currentBossKC || !Array.isArray(adjustments) || adjustments.length === 0) {
    return currentBossKC;
  }

  const nextBossKC = { ...currentBossKC };
  adjustments.forEach(({ bossId, amount }) => {
    if (!bossId || !Number.isFinite(amount) || amount <= 0) return;
    nextBossKC[bossId] = Math.max(0, (nextBossKC[bossId] ?? 0) + amount);
  });
  return nextBossKC;
}
