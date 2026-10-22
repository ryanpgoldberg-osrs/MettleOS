import { skillLabel } from "../utils/labels.js";
import { getModifierForCategory } from "../utils/modifiers.js";
import { countCompletedDiaryTiers, countStartedQuests } from "../utils/questProgress.js";
import { accountAverage } from "../utils/skillHelpers.js";
import { tierForLevel } from "./mettleSystems.js";

export const ACCUSATION_SPACING_MIN = 5;
export const ACCUSATION_REFUSAL_DRAW_PENALTY = 2;
export const ACCUSATION_ACCOUNT_MIN_COMPLETIONS = 10;
export const ACCUSATION_ACCOUNT_MIN_LEVEL = 20;

const GOD_WARS_BOSSES = [
  "general_graardor",
  "commander_zilyana",
  "kreearra",
  "kril_tsutsaroth",
];
const WILDERNESS_BOSSES = [
  "artio",
  "callisto",
  "calvarion",
  "chaos_elemental",
  "chaos_fanatic",
  "crazy_archaeologist",
  "scorpia",
  "spindel",
  "venenatis",
  "vetion",
];
const RAID_BOSSES = [
  "chambers_of_xeric",
  "chambers_of_xeric_challenge_mode",
  "theatre_of_blood",
  "theatre_of_blood_hard_mode",
  "tombs_of_amascut",
  "tombs_of_amascut_expert",
];

const PVM_CATEGORIES = new Set(["PvM Intro", "PvM Endurance"]);
const SINGLE_SKILL_LEVEL_TARGETS = {
  Medium: [
    { min: 1, max: 39, amount: 5 },
    { min: 40, max: 59, amount: 3 },
    { min: 60, max: 74, amount: 2 },
    { min: 75, max: 84, amount: 1 },
  ],
  Hard: [
    { min: 1, max: 39, amount: 6 },
    { min: 40, max: 59, amount: 4 },
    { min: 60, max: 74, amount: 3 },
    { min: 75, max: 84, amount: 2 },
  ],
  Elite: [
    { min: 1, max: 39, amount: 8 },
    { min: 40, max: 59, amount: 5 },
    { min: 60, max: 74, amount: 4 },
    { min: 75, max: 84, amount: 3 },
  ],
};
const HIGH_LEVEL_XP_TARGETS = {
  Medium: 25000,
  Hard: 35000,
  Elite: 50000,
};
const JUDGMENT_SKILL_MILESTONES = [20, 40, 50, 60, 65, 70, 75, 80, 85, 90, 95, 99];

function averageCombat(skillLevels) {
  return (skillLevels.attack + skillLevels.strength + skillLevels.defence) / 3;
}

function getTierIndex(tier) {
  return ["Guthix", "Saradomin", "Bandos", "Zamorak", "Zaros"].indexOf(tier);
}

function makeVerdictLine(severity, fallback = "The ledger records this avoidance.") {
  if (severity >= 3) return "The ledger calls this cowardice.";
  return fallback;
}

function createTaskId(prefix, key) {
  return `${prefix}_${key.replace(/[^a-z0-9]+/gi, "_")}`;
}

function numberOrDefault(value, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function buildChargeText(lines) {
  return lines.filter(Boolean);
}

function getMemoryBoost(memoryEntry) {
  if (!memoryEntry) return 0;
  if ((memoryEntry.timesRefused ?? 0) > 0) return 1;
  if ((memoryEntry.timesIssued ?? 0) > 0 && (memoryEntry.timesResolved ?? 0) === 0) return 1;
  return 0;
}

function getLowestSkill(skillLevels) {
  return Object.entries(skillLevels).reduce(
    (lowest, current) => (current[1] < lowest[1] ? current : lowest),
    ["attack", skillLevels.attack]
  );
}

function resolveSingleSkillGainTarget(level, difficulty) {
  if (level >= 85) {
    return { unit: "xp", amount: HIGH_LEVEL_XP_TARGETS[difficulty] ?? HIGH_LEVEL_XP_TARGETS.Medium };
  }

  const band = (SINGLE_SKILL_LEVEL_TARGETS[difficulty] || SINGLE_SKILL_LEVEL_TARGETS.Medium)
    .find(({ min, max }) => level >= min && level <= max);

  return { unit: "levels", amount: band?.amount ?? 1 };
}

function resolveJudgmentSkillTarget(level, difficulty) {
  const target = resolveSingleSkillGainTarget(level, difficulty);
  if (target.unit === "xp") return target;

  const minimumLevel = Math.min(99, level + target.amount);
  const milestone = JUDGMENT_SKILL_MILESTONES.find((value) => value >= minimumLevel);
  return { unit: "level_target", amount: milestone ?? minimumLevel };
}

function formatJudgmentSkillObjective(skill, level, average, difficulty) {
  const target = resolveJudgmentSkillTarget(level, difficulty);
  const label = skillLabel(skill);
  if (target.unit === "xp") {
    return `Gain ${target.amount.toLocaleString()} XP in ${label}. The ledger requires visible repair of the gap (currently ${level} vs avg ${average.toFixed(0)}).`;
  }
  return `Bring ${label} to level ${target.amount}. The ledger will not leave the gap open (currently ${level} vs avg ${average.toFixed(0)}).`;
}

function totalBossKc(bossKeys, bossKC = {}) {
  return bossKeys.reduce((sum, boss) => sum + (bossKC?.[boss] ?? 0), 0);
}

function diaryExpectationForLevel(mettleLevel) {
  if (mettleLevel >= 80) return { count: 5, difficulty: "Elite" };
  if (mettleLevel >= 60) return { count: 3, difficulty: "Hard" };
  if (mettleLevel >= 40) return { count: 2, difficulty: "Medium" };
  return { count: 1, difficulty: "Easy" };
}

function isDiaryDraftTask(task) {
  return Boolean(task?.diaryTierAnyOf || typeof task?.diaryTierCountTarget === "number");
}

function isQuestDraftTask(task) {
  return task?.category === "Quest";
}

export function createAccusationOpportunityCounts(raw = null) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    pvmIgnored: numberOrDefault(source.pvmIgnored),
    skillGapIgnored: numberOrDefault(source.skillGapIgnored),
    questIgnored: numberOrDefault(source.questIgnored),
    diaryIgnored: numberOrDefault(source.diaryIgnored),
  };
}

export const normalizeAccusationOpportunityCounts = createAccusationOpportunityCounts;

export function recordAccusationOpportunityChoice(currentCounts, currentDraft, chosenTask) {
  const counts = createAccusationOpportunityCounts(currentCounts);
  const draft = Array.isArray(currentDraft) ? currentDraft : [];
  const task = chosenTask && typeof chosenTask === "object" ? chosenTask : {};
  const isPvmTask = PVM_CATEGORIES.has(task.category);
  const isSkillGapTask = task.category === "Skill Gap";
  const isQuestTask = isQuestDraftTask(task);
  const isDiaryTask = isDiaryDraftTask(task);

  return {
    pvmIgnored:
      counts.pvmIgnored +
      (draft.some((draftTask) => PVM_CATEGORIES.has(draftTask.category)) && !isPvmTask ? 1 : 0),
    skillGapIgnored:
      counts.skillGapIgnored +
      (draft.some((draftTask) => draftTask.category === "Skill Gap") && !isSkillGapTask ? 1 : 0),
    questIgnored:
      counts.questIgnored +
      (draft.some((draftTask) => isQuestDraftTask(draftTask)) && !isQuestTask ? 1 : 0),
    diaryIgnored:
      counts.diaryIgnored +
      (draft.some((draftTask) => isDiaryDraftTask(draftTask)) && !isDiaryTask ? 1 : 0),
  };
}

export function isAccusationBoardCalm({
  activeTask,
  trialPhase,
  pendingTrialTask,
  pendingTrial,
  activeFork,
  activeLandmark,
  currentDraftLength = 0,
  reckoningTaskCount = 0,
  mustClearAll = false,
  deferredTaskCount = 0,
  gateBlocked = false,
}) {
  return (
    !activeTask &&
    !trialPhase &&
    !pendingTrialTask &&
    !pendingTrial &&
    !activeFork &&
    !activeLandmark &&
    currentDraftLength === 0 &&
    reckoningTaskCount === 0 &&
    !mustClearAll &&
    deferredTaskCount < 3 &&
    !gateBlocked
  );
}

export function canEvaluateAccusationWindow({
  statsLoaded,
  activeAccusation,
  pendingAccusationCandidate,
  completedTasksSinceLastAccusation,
  accusationSpacingMin,
}) {
  return Boolean(
    statsLoaded &&
      !activeAccusation &&
      !pendingAccusationCandidate &&
      completedTasksSinceLastAccusation >= accusationSpacingMin
  );
}

export function getAccusationRefusalPenalty() {
  return {
    drawPenalty: ACCUSATION_REFUSAL_DRAW_PENALTY,
    forcedModifierReady: true,
  };
}

export function buildForcedJudgmentTask(accusation, now = Date.now()) {
  if (!accusation?.judgmentTask) return null;
  const modifier = getModifierForCategory(accusation.judgmentTask.category, 1);
  return {
    ...accusation.judgmentTask,
    acceptedAt: now,
    accusationTask: true,
    accusationResponseType: "judgment",
    accusationSourceId: accusation.id,
    accusationKey: accusation.key,
    accusationTitle: accusation.title,
    modifier,
    objective: `${accusation.judgmentTask.objective} — MODIFIER: ${modifier}`,
  };
}

function buildZulrahCandidate({ mettleLevel, skillLevels, bossKC, accusationMemory, opportunityCounts = {} }) {
  const combatAvg = averageCombat(skillLevels);
  if (combatAvg < 85 || (bossKC.zulrah ?? 0) > 0) return null;
  if (mettleLevel < ACCUSATION_ACCOUNT_MIN_LEVEL) return null;
  if ((opportunityCounts.pvmIgnored ?? 0) < 2) return null;
  const tier = tierForLevel(mettleLevel);

  const key = "avoidance:zulrah";
  const memory = accusationMemory[key];
  const severity = Math.min(3, (combatAvg >= 95 ? 2 : 1) + getMemoryBoost(memory));
  const repeated = (memory?.timesIssued ?? 0) > 0 && (memory?.timesResolved ?? 0) === 0;

  return {
    key,
    family: "avoidance",
    severity,
    domainCategory: "PvM Intro",
    title: repeated ? "Unanswered Venom" : "Venom Unfaced",
    chargeText: buildChargeText([
      repeated
        ? "This account was warned about Zulrah."
        : "This account claims mastery of combat,",
      repeated ? "It still has not acted." : "yet has never faced Zulrah.",
      makeVerdictLine(severity),
    ]),
    evidence: [`Combat average ${Math.round(combatAvg)}`, `Zulrah KC ${bossKC.zulrah ?? 0}`],
    triggerSource: "high combat with zero Zulrah KC",
    priority: 120 + severity,
    judgmentTask: {
      id: createTaskId("judgment", key),
      title: "Judgment: Zulrah",
      category: "PvM Intro",
      difficulty: severity >= 3 ? "Elite" : "Hard",
      tier,
      xp: severity >= 3 ? 1000 : 850,
      objective: "Kill Zulrah once",
    },
    defenseTask: {
      id: createTaskId("defense", key),
      title: "Defense Trial: Prove Combat Claim",
      category: "PvM Endurance",
      difficulty: severity >= 3 ? "Elite" : "Hard",
      tier,
      xp: severity >= 3 ? 1100 : 900,
      objective: "Kill 3 different bosses in one session",
    },
  };
}

function buildGodWarsCandidate({ mettleLevel, bossKC, accusationMemory, opportunityCounts = {} }) {
  const tier = tierForLevel(mettleLevel);
  if (getTierIndex(tier) < getTierIndex("Bandos")) return null;
  if ((opportunityCounts.pvmIgnored ?? 0) < 2) return null;
  const totalGwdKC = GOD_WARS_BOSSES.reduce((sum, boss) => sum + (bossKC[boss] ?? 0), 0);
  if (totalGwdKC > 0) return null;

  const key = "avoidance:god_wars";
  const memory = accusationMemory[key];
  const severity = Math.min(3, (getTierIndex(tier) >= getTierIndex("Zamorak") ? 2 : 1) + getMemoryBoost(memory));
  const repeated = (memory?.timesIssued ?? 0) > 0 && (memory?.timesResolved ?? 0) === 0;

  return {
    key,
    family: "avoidance",
    severity,
    domainCategory: "PvM Intro",
    title: repeated ? "The Dungeon Still Unentered" : "The Closed Gates",
    chargeText: buildChargeText([
      repeated
        ? "This account was warned about God Wars."
        : "This account has trained combat for years,",
      repeated ? "It still has not entered God Wars." : "yet has never entered the God Wars Dungeon.",
      severity >= 3 ? "The ledger calls this evasion." : "The ledger records this omission.",
    ]),
    evidence: [`Current tier ${tier}`, `God Wars KC ${totalGwdKC}`],
    triggerSource: "Bandos-or-higher run with zero God Wars progress",
    priority: 100 + severity,
    judgmentTask: {
      id: createTaskId("judgment", key),
      title: "Judgment: God Wars",
      category: "PvM Intro",
      difficulty: severity >= 3 ? "Elite" : "Hard",
      tier,
      xp: severity >= 3 ? 1050 : 875,
      objective: "Enter God Wars Dungeon and defeat any general",
    },
    defenseTask: {
      id: createTaskId("defense", key),
      title: "Defense Trial: Prove Combat Breadth",
      category: "PvM Endurance",
      difficulty: severity >= 3 ? "Elite" : "Hard",
      tier,
      xp: severity >= 3 ? 1150 : 925,
      objective: "Kill 3 different bosses in one session",
    },
  };
}

function buildSkillGapCandidate({ mettleLevel, skillLevels, accusationMemory, opportunityCounts = {} }) {
  if (mettleLevel < ACCUSATION_ACCOUNT_MIN_LEVEL) return null;
  if ((opportunityCounts.skillGapIgnored ?? 0) < 2) return null;

  const [skill, level] = getLowestSkill(skillLevels);
  const avg = accountAverage(skillLevels);
  const gap = avg - level;
  if (gap < 18) return null;

  const key = `neglect:${skill}`;
  const memory = accusationMemory[key];
  const severity = Math.min(3, (gap >= 28 ? 2 : 1) + getMemoryBoost(memory));
  const repeated = (memory?.timesIssued ?? 0) > 0 && (memory?.timesResolved ?? 0) === 0;
  const label = skillLabel(skill);
  const judgmentDifficulty = severity >= 3 ? "Elite" : severity >= 2 ? "Hard" : "Medium";
  const defenseDifficulty = severity >= 3 ? "Elite" : "Hard";

  return {
    key,
    family: "neglect",
    severity,
    domainCategory: "Skill Gap",
    title: repeated ? `${label} Still Neglected` : `${label} Left Behind`,
    chargeText: buildChargeText([
      repeated
        ? `This account was warned about ${label}.`
        : `This account has built strength elsewhere,`,
      repeated ? `It still leaves ${label} behind.` : `but still leaves ${label} behind.`,
      severity >= 3 ? "The ledger calls this neglect." : "The ledger records this imbalance.",
    ]),
    evidence: [`Account average ${Math.round(avg)}`, `${label} ${level}`],
    triggerSource: "lowest skill is far below account average",
    priority: 70 + severity,
    judgmentTask: {
      id: createTaskId("judgment", key),
      title: `Judgment: Repair ${label}`,
      category: "Skill Gap",
      difficulty: judgmentDifficulty,
      tier: tierForLevel(mettleLevel),
      xp: severity >= 3 ? 1250 : severity >= 2 ? 1050 : 850,
      objective: formatJudgmentSkillObjective(skill, level, avg, judgmentDifficulty),
    },
    defenseTask: {
      id: createTaskId("defense", key),
      title: `Defense Trial: Prove Breadth`,
      category: "Skill Gap",
      difficulty: defenseDifficulty,
      tier: tierForLevel(mettleLevel),
      xp: severity >= 3 ? 1350 : 1125,
      objective: "Gain 5 total levels across any 3 skills without deferring",
    },
  };
}

function buildQuestStagnationCandidate({ mettleLevel, questState, accusationMemory, opportunityCounts = {} }) {
  if (mettleLevel < ACCUSATION_ACCOUNT_MIN_LEVEL) return null;
  if ((opportunityCounts.questIgnored ?? 0) < 2) return null;

  const startedQuestCount = countStartedQuests(questState);
  if (startedQuestCount < 2) return null;

  const key = "stagnation:quest_backlog";
  const memory = accusationMemory[key];
  const severity = Math.min(3, (startedQuestCount >= 4 ? 2 : 1) + getMemoryBoost(memory));
  const repeated = (memory?.timesIssued ?? 0) > 0 && (memory?.timesResolved ?? 0) === 0;
  const tier = tierForLevel(mettleLevel);

  return {
    key,
    family: "stagnation",
    severity,
    domainCategory: "Quest",
    title: repeated ? "The Journal Still Open" : "The Journal Left Open",
    chargeText: buildChargeText([
      repeated
        ? "This account was warned about its unfinished quests."
        : "This account opens quests and leaves them unfinished.",
      repeated ? "The backlog still grows." : "The ledger calls the pattern stagnation.",
      severity >= 3 ? "The ledger demands closure." : "The ledger wants the story advanced.",
    ]),
    evidence: [`Started quests ${startedQuestCount}`, `Ignored quest draws ${opportunityCounts.questIgnored ?? 0}`],
    triggerSource: "started-quest backlog plus ignored quest pressure",
    priority: 95 + severity,
    judgmentTask: {
      id: createTaskId("judgment", key),
      title: "Judgment: Finish The Story",
      category: "Quest",
      difficulty: severity >= 3 ? "Elite" : severity >= 2 ? "Hard" : "Medium",
      tier,
      xp: severity >= 3 ? 1200 : severity >= 2 ? 1000 : 825,
      objective:
        startedQuestCount >= 4
          ? "Complete 2 quests you have already started"
          : "Complete 1 quest you have already started",
    },
    defenseTask: {
      id: createTaskId("defense", key),
      title: "Defense Trial: Prove Progress",
      category: "Quest",
      difficulty: severity >= 3 ? "Elite" : "Hard",
      tier,
      xp: severity >= 3 ? 1300 : 1050,
      objective: "Gain 15 quest points without deferring",
    },
  };
}

function buildDiaryNeglectCandidate({ mettleLevel, diaryState, accusationMemory, opportunityCounts = {} }) {
  if (mettleLevel < ACCUSATION_ACCOUNT_MIN_LEVEL) return null;
  if ((opportunityCounts.diaryIgnored ?? 0) < 2) return null;

  const completedDiaryTiers = countCompletedDiaryTiers(diaryState);
  const expectation = diaryExpectationForLevel(mettleLevel);
  if (completedDiaryTiers >= expectation.count) return null;

  const key = "neglect:diaries";
  const memory = accusationMemory[key];
  const severity = Math.min(
    3,
    (expectation.count - completedDiaryTiers >= 2 ? 2 : 1) + getMemoryBoost(memory)
  );
  const repeated = (memory?.timesIssued ?? 0) > 0 && (memory?.timesResolved ?? 0) === 0;
  const tier = tierForLevel(mettleLevel);

  return {
    key,
    family: "neglect",
    severity,
    domainCategory: "Exploration",
    title: repeated ? "The Provinces Still Unanswered" : "The Provinces Unanswered",
    chargeText: buildChargeText([
      repeated
        ? "This account was warned about its empty regional record."
        : "This account has crossed the world without honoring its provinces.",
      repeated ? "The diary ledger still looks bare." : "The ledger calls this neglect of the realm.",
      severity >= 3 ? "Regional proof is now demanded." : "Regional proof is expected.",
    ]),
    evidence: [
      `Diary tiers complete ${completedDiaryTiers}`,
      `Ignored diary draws ${opportunityCounts.diaryIgnored ?? 0}`,
    ],
    triggerSource: "regional diary neglect plus ignored diary pressure",
    priority: 82 + severity,
    judgmentTask: {
      id: createTaskId("judgment", key),
      title: "Judgment: Answer The Provinces",
      category: "Exploration",
      difficulty: severity >= 3 ? "Elite" : severity >= 2 ? "Hard" : "Medium",
      tier,
      xp: severity >= 3 ? 1175 : severity >= 2 ? 950 : 775,
      objective: `Complete any unfinished ${expectation.difficulty} Achievement Diary tier`,
    },
    defenseTask: {
      id: createTaskId("defense", key),
      title: "Defense Trial: Regional Proof",
      category: "Exploration",
      difficulty: severity >= 3 ? "Elite" : "Hard",
      tier,
      xp: severity >= 3 ? 1250 : 1000,
      objective: "Complete 5 Achievement Diary tasks in one region without deferring",
    },
  };
}

function buildWildernessAvoidanceCandidate({ mettleLevel, skillLevels, bossKC, accusationMemory, opportunityCounts = {} }) {
  if (mettleLevel < ACCUSATION_ACCOUNT_MIN_LEVEL) return null;
  if ((opportunityCounts.pvmIgnored ?? 0) < 2) return null;

  const combatAvg = averageCombat(skillLevels);
  if (combatAvg < 75) return null;

  const wildernessKc = totalBossKc(WILDERNESS_BOSSES, bossKC);
  if (wildernessKc > 0) return null;

  const key = "avoidance:wilderness";
  const memory = accusationMemory[key];
  const severity = Math.min(3, (combatAvg >= 90 ? 2 : 1) + getMemoryBoost(memory));
  const repeated = (memory?.timesIssued ?? 0) > 0 && (memory?.timesResolved ?? 0) === 0;
  const tier = tierForLevel(mettleLevel);

  return {
    key,
    family: "avoidance",
    severity,
    domainCategory: "PvM Intro",
    title: repeated ? "The Frontier Still Avoided" : "The Frontier Unentered",
    chargeText: buildChargeText([
      repeated
        ? "This account was warned about the Wilderness."
        : "This account has combat power, yet keeps the Wilderness at a distance.",
      repeated ? "It still will not cross the line." : "The ledger reads fear of contested ground.",
      makeVerdictLine(severity, "The ledger names the frontier avoidance plainly."),
    ]),
    evidence: [`Combat average ${Math.round(combatAvg)}`, `Wilderness KC ${wildernessKc}`],
    triggerSource: "high combat with zero wilderness-boss progress",
    priority: 118 + severity,
    judgmentTask: {
      id: createTaskId("judgment", key),
      title: "Judgment: Enter The Wilderness",
      category: "PvM Intro",
      difficulty: severity >= 3 ? "Elite" : "Hard",
      tier,
      xp: severity >= 3 ? 1125 : 900,
      objective: "Defeat any wilderness boss once",
    },
    defenseTask: {
      id: createTaskId("defense", key),
      title: "Defense Trial: Prove Nerve",
      category: "PvM Endurance",
      difficulty: severity >= 3 ? "Elite" : "Hard",
      tier,
      xp: severity >= 3 ? 1200 : 975,
      objective: "Kill 3 different bosses in one session",
    },
  };
}

function buildRaidAvoidanceCandidate({ mettleLevel, bossKC, accusationMemory, opportunityCounts = {} }) {
  if (mettleLevel < 60) return null;
  if ((opportunityCounts.pvmIgnored ?? 0) < 2) return null;

  const raidKc = totalBossKc(RAID_BOSSES, bossKC);
  if (raidKc > 0) return null;

  const tier = tierForLevel(mettleLevel);
  const key = "avoidance:raids";
  const memory = accusationMemory[key];
  const severity = Math.min(3, (getTierIndex(tier) >= getTierIndex("Zamorak") ? 2 : 1) + getMemoryBoost(memory));
  const repeated = (memory?.timesIssued ?? 0) > 0 && (memory?.timesResolved ?? 0) === 0;

  return {
    key,
    family: "avoidance",
    severity,
    domainCategory: "PvM Intro",
    title: repeated ? "The Great Chambers Still Closed" : "The Great Chambers Closed",
    chargeText: buildChargeText([
      repeated
        ? "This account was warned about raids."
        : "This account has reached raid level, yet still has no raid claim.",
      repeated ? "It still has not answered the scale of the content." : "The ledger calls this endgame avoidance.",
      severity >= 3 ? "A raid answer is now required." : "A raid answer is expected.",
    ]),
    evidence: [`Current tier ${tier}`, `Raid KC ${raidKc}`],
    triggerSource: "raid-ready account with zero raid completions",
    priority: 126 + severity,
    judgmentTask: {
      id: createTaskId("judgment", key),
      title: "Judgment: Claim A Raid",
      category: "PvM Intro",
      difficulty: severity >= 3 ? "Elite" : "Hard",
      tier,
      xp: severity >= 3 ? 1250 : 975,
      objective: "Complete any raid once",
    },
    defenseTask: {
      id: createTaskId("defense", key),
      title: "Defense Trial: Prove Endgame Breadth",
      category: "PvM Endurance",
      difficulty: severity >= 3 ? "Elite" : "Hard",
      tier,
      xp: severity >= 3 ? 1325 : 1025,
      objective: "Kill 4 different bosses in one session",
    },
  };
}

function buildPvmDeferCandidate({ mettleLevel, deferredTasks, categoryDeferCounts, reckoningTotals, accusationMemory, historyCount = 0 }) {
  const livePvMDefers = deferredTasks.filter((task) => PVM_CATEGORIES.has(task.category)).length;
  const pvmWarningCount = (categoryDeferCounts["PvM Intro"] ?? 0) + (categoryDeferCounts["PvM Endurance"] ?? 0);
  const pvmReckonings = (reckoningTotals["PvM Intro"] ?? 0) + (reckoningTotals["PvM Endurance"] ?? 0);
  const pressure = livePvMDefers + pvmWarningCount + pvmReckonings * 2;
  if (historyCount < 4 || pressure < 4) return null;

  const key = "cowardice:pvm_pressure";
  const memory = accusationMemory[key];
  const severity = Math.min(3, (pressure >= 5 ? 2 : 1) + getMemoryBoost(memory));
  const repeated = (memory?.timesIssued ?? 0) > 0 && (memory?.timesResolved ?? 0) === 0;

  return {
    key,
    family: "cowardice",
    severity,
    domainCategory: "PvM Endurance",
    title: repeated ? "PvM Still Unanswered" : "Retreat Under Pressure",
    chargeText: buildChargeText([
      repeated
        ? "This account was warned about retreating from PvM."
        : "This account repeatedly retreats from PvM pressure.",
      repeated ? "It still refuses a clean answer." : "The ledger reads a pattern of avoidance.",
      makeVerdictLine(severity, "The ledger names the habit plainly."),
    ]),
    evidence: [`Live PvM defers ${livePvMDefers}`, `PvM pressure score ${pressure}`],
    triggerSource: "repeated PvM defers and reckoning pressure",
    priority: 140 + severity,
    judgmentTask: {
      id: createTaskId("judgment", key),
      title: "Judgment: Answer PvM",
      category: "PvM Endurance",
      difficulty: severity >= 3 ? "Elite" : "Hard",
      tier: tierForLevel(mettleLevel),
      xp: severity >= 3 ? 1100 : 900,
      objective: "Defeat any boss on this account with 0 KC",
    },
    defenseTask: {
      id: createTaskId("defense", key),
      title: "Defense Trial: Hold The Line",
      category: "PvM Endurance",
      difficulty: severity >= 3 ? "Elite" : "Hard",
      tier: tierForLevel(mettleLevel),
      xp: severity >= 3 ? 1200 : 975,
      objective: "Kill 3 different bosses in one session",
    },
  };
}

export function buildAccusationCandidate(context) {
  const accountStateUnlocked =
    (context.completedTaskCount ?? 0) >= ACCUSATION_ACCOUNT_MIN_COMPLETIONS &&
    (context.mettleLevel ?? 0) >= ACCUSATION_ACCOUNT_MIN_LEVEL;

  const candidates = [
    buildPvmDeferCandidate(context),
    accountStateUnlocked ? buildRaidAvoidanceCandidate(context) : null,
    accountStateUnlocked ? buildWildernessAvoidanceCandidate(context) : null,
    accountStateUnlocked ? buildZulrahCandidate(context) : null,
    accountStateUnlocked ? buildGodWarsCandidate(context) : null,
    accountStateUnlocked ? buildQuestStagnationCandidate(context) : null,
    accountStateUnlocked ? buildDiaryNeglectCandidate(context) : null,
    accountStateUnlocked ? buildSkillGapCandidate(context) : null,
  ].filter(Boolean);

  candidates.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return candidates[0] ?? null;
}
