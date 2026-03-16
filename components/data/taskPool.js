import { GUTHIX_BOSSES, KEY_BOSSES, PRODUCTION, SKILLS } from "./constants.js";
import {
  accountAverage,
  firstUntouchedFromPool,
  hardestUntouchedBoss,
  lowestKCBoss,
  lowestNSkills,
  lowestProductionSkill,
  lowestSkill,
} from "../utils/skillHelpers.js";
import { bossLabel, skillLabel } from "../utils/labels.js";
import { countStartedQuests, hasCompletedAnyQuest } from "../utils/questProgress.js";
import { normalizeQuestState } from "../utils/questSync.js";

const SINGLE_SKILL_LEVEL_TARGETS = {
  Easy: [
    { min: 1, max: 39, amount: 3 },
    { min: 40, max: 59, amount: 2 },
    { min: 60, max: 84, amount: 1 },
  ],
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
  Easy: 15000,
  Medium: 25000,
  Hard: 35000,
  Elite: 50000,
};

function averageLevel(skillLevels, skills) {
  const total = skills.reduce((sum, skill) => sum + (skillLevels[skill] ?? 1), 0);
  return total / skills.length;
}

function resolveSingleSkillGainTarget(level, difficulty) {
  if (level >= 85) {
    return { unit: "xp", amount: HIGH_LEVEL_XP_TARGETS[difficulty] ?? HIGH_LEVEL_XP_TARGETS.Medium };
  }

  const band = (SINGLE_SKILL_LEVEL_TARGETS[difficulty] || SINGLE_SKILL_LEVEL_TARGETS.Medium)
    .find(({ min, max }) => level >= min && level <= max);

  return { unit: "levels", amount: band?.amount ?? 1 };
}

function formatSingleSkillGainObjective(skill, level, difficulty, verb = "Gain", descriptor = "") {
  const target = resolveSingleSkillGainTarget(level, difficulty);
  const progress = target.unit === "xp"
    ? `${verb} ${target.amount.toLocaleString()} XP in ${skillLabel(skill)}`
    : `${verb} ${target.amount} level${target.amount === 1 ? "" : "s"} in ${skillLabel(skill)}`;
  if (!descriptor) return `${progress} (currently ${level})`;
  return `${progress} — ${descriptor} ${level}`;
}

function formatAverageGapClosureObjective(skill, level, average, difficulty) {
  const target = resolveSingleSkillGainTarget(level, difficulty);
  if (target.unit === "xp") {
    return `Gain ${target.amount.toLocaleString()} XP in ${skillLabel(skill)} toward your account average (currently ${level} vs avg ${average.toFixed(0)})`;
  }
  return `Close ${target.amount} level${target.amount === 1 ? "" : "s"} of the gap in ${skillLabel(skill)} (currently ${level} vs avg ${average.toFixed(0)})`;
}

function resolveMultiSkillGapTarget(skillLevels, skills) {
  const avg = averageLevel(skillLevels, skills);
  if (avg >= 85) return { unit: "xp", amount: 15000 };
  if (avg >= 60) return { unit: "levels_each", amount: 1 };
  if (avg >= 40) return { unit: "levels_each", amount: 2 };
  return { unit: "levels_each", amount: 3 };
}

function resolveBalancedGrowthTarget(skillLevels) {
  const fiveSkills = lowestNSkills(skillLevels, 5);
  if (averageLevel(skillLevels, fiveSkills) < 60) {
    return { skills: fiveSkills, unit: "levels", amount: 1 };
  }

  const threeSkills = lowestNSkills(skillLevels, 3);
  if (averageLevel(skillLevels, threeSkills) < 80) {
    return { skills: threeSkills, unit: "levels", amount: 1 };
  }

  return { skills: threeSkills, unit: "xp", amount: 15000 };
}

function resolveProductionSessionTarget(skillLevels) {
  const avg = averageLevel(skillLevels, PRODUCTION);
  if (avg < 60) return { unit: "levels", amount: 6 };
  if (avg < 80) return { unit: "levels", amount: 4 };
  return { unit: "xp", amount: 45000 };
}

function resolveWeeklyGrindTarget(skillLevels) {
  const skill = lowestSkill(skillLevels);
  const level = skillLevels[skill];
  if (level < 60) return { skill, level, unit: "levels", amount: 8 };
  if (level < 80) return { skill, level, unit: "levels", amount: 5 };
  return { skill, level, unit: "xp", amount: 60000 };
}

const EARLY_QUEST_POOL = [
  { id: "priest_in_peril", label: "Priest in Peril" },
  { id: "lost_city", label: "Lost City" },
  { id: "tree_gnome_village", label: "Tree Gnome Village" },
  { id: "the_grand_tree", label: "The Grand Tree" },
  { id: "death_to_the_dorgeshuun", label: "Death to the Dorgeshuun" },
  { id: "the_dig_site", label: "The Dig Site" },
  { id: "druidic_ritual", label: "Druidic Ritual" },
  { id: "animal_magnetism", label: "Animal Magnetism" },
  { id: "bone_voyage", label: "Bone Voyage" },
  { id: "fairytale_i_growing_pains", label: "Fairytale I - Growing Pains" },
];

const MASTER_QUEST_POOL = [
  { id: "legends_quest", label: "Legends' Quest" },
  { id: "monkey_madness_i", label: "Monkey Madness I" },
  { id: "desert_treasure_i", label: "Desert Treasure I" },
  { id: "dream_mentor", label: "Dream Mentor" },
  { id: "grim_tales", label: "Grim Tales" },
  { id: "swan_song", label: "Swan Song" },
  { id: "curse_of_arrav", label: "Curse of Arrav" },
  { id: "perilous_moons", label: "Perilous Moons" },
];

const GRANDMASTER_QUEST_POOL = [
  { id: "dragon_slayer_ii", label: "Dragon Slayer II" },
  { id: "song_of_the_elves", label: "Song of the Elves" },
  { id: "monkey_madness_ii", label: "Monkey Madness II" },
  { id: "desert_treasure_ii", label: "Desert Treasure II" },
];

const BALANCE_QUEST_POOL = [
  { id: "tears_of_guthix", label: "Tears of Guthix" },
  { id: "nature_spirit", label: "Nature Spirit" },
  { id: "druidic_ritual", label: "Druidic Ritual" },
];

const ORDER_QUEST_POOL = [
  { id: "merlins_crystal", label: "Merlin's Crystal" },
  { id: "holy_grail", label: "Holy Grail" },
  { id: "kings_ransom", label: "King's Ransom" },
  { id: "recruitment_drive", label: "Recruitment Drive" },
  { id: "wanted", label: "Wanted!" },
];

const BANDOS_QUEST_POOL = [
  { id: "another_slice_of_ham", label: "Another Slice of H.A.M." },
  { id: "land_of_the_goblins", label: "Land of the Goblins" },
  { id: "the_chosen_commander", label: "The Chosen Commander" },
];

const ZAMORAK_QUEST_POOL = [
  { id: "hazeel_cult", label: "Hazeel Cult" },
  { id: "desert_treasure_i", label: "Desert Treasure I" },
  { id: "sins_of_the_father", label: "Sins of the Father" },
  { id: "desert_treasure_ii", label: "Desert Treasure II" },
];

const ZAROS_QUEST_POOL = [
  { id: "desert_treasure_i", label: "Desert Treasure I" },
  { id: "curse_of_arrav", label: "Curse of Arrav" },
  { id: "desert_treasure_ii", label: "Desert Treasure II" },
  { id: "while_guthix_sleeps", label: "While Guthix Sleeps" },
];

const MAJOR_UNLOCK_QUEST_POOL = [
  { id: "priest_in_peril", label: "Priest in Peril" },
  { id: "lost_city", label: "Lost City" },
  { id: "fairytale_ii_cure_a_queen", label: "Fairytale II - Cure a Queen" },
  { id: "bone_voyage", label: "Bone Voyage" },
  { id: "lunar_diplomacy", label: "Lunar Diplomacy" },
  { id: "kings_ransom", label: "King's Ransom" },
  { id: "a_kingdom_divided", label: "A Kingdom Divided" },
  { id: "desert_treasure_i", label: "Desert Treasure I" },
];

const FOUNDATION_UNLOCK_QUEST_POOL = [
  { id: "x_marks_the_spot", label: "X Marks the Spot" },
  { id: "below_ice_mountain", label: "Below Ice Mountain" },
  { id: "client_of_kourend", label: "Client of Kourend" },
  { id: "children_of_the_sun", label: "Children of the Sun" },
  { id: "witchs_house", label: "Witch's House" },
  { id: "waterfall_quest", label: "Waterfall Quest" },
];

const FREMENNIK_QUEST_POOL = [
  { id: "the_fremennik_trials", label: "The Fremennik Trials" },
  { id: "olafs_quest", label: "Olaf's Quest" },
  { id: "the_fremennik_isles", label: "The Fremennik Isles" },
  { id: "the_fremennik_exiles", label: "The Fremennik Exiles" },
  { id: "lunar_diplomacy", label: "Lunar Diplomacy" },
];

const MYREQUE_QUEST_POOL = [
  { id: "in_search_of_the_myreque", label: "In Search of the Myreque" },
  { id: "in_aid_of_the_myreque", label: "In Aid of the Myreque" },
  { id: "darkness_of_hallowvale", label: "Darkness of Hallowvale" },
  { id: "a_taste_of_hope", label: "A Taste of Hope" },
  { id: "sins_of_the_father", label: "Sins of the Father" },
];

const TROLL_QUEST_POOL = [
  { id: "death_plateau", label: "Death Plateau" },
  { id: "troll_stronghold", label: "Troll Stronghold" },
  { id: "eadgars_ruse", label: "Eadgar's Ruse" },
  { id: "my_arms_big_adventure", label: "My Arm's Big Adventure" },
  { id: "making_friends_with_my_arm", label: "Making Friends with My Arm" },
];

const ELVEN_QUEST_POOL = [
  { id: "underground_pass", label: "Underground Pass" },
  { id: "regicide", label: "Regicide" },
  { id: "roving_elves", label: "Roving Elves" },
  { id: "mournings_end_part_i", label: "Mourning's End Part I" },
  { id: "mournings_end_part_ii", label: "Mourning's End Part II" },
  { id: "song_of_the_elves", label: "Song of the Elves" },
];

const DESERT_EPIC_QUEST_POOL = [
  { id: "contact", label: "Contact!" },
  { id: "devious_minds", label: "Devious Minds" },
  { id: "beneath_cursed_sands", label: "Beneath Cursed Sands" },
  { id: "desert_treasure_i", label: "Desert Treasure I" },
  { id: "desert_treasure_ii", label: "Desert Treasure II" },
];

const QUEST_SERIES_CAPSTONE_POOL = [
  { id: "recipe_for_disaster", label: "Recipe for Disaster" },
  { id: "monkey_madness_ii", label: "Monkey Madness II" },
  { id: "song_of_the_elves", label: "Song of the Elves" },
  { id: "sins_of_the_father", label: "Sins of the Father" },
  { id: "dragon_slayer_ii", label: "Dragon Slayer II" },
  { id: "desert_treasure_ii", label: "Desert Treasure II" },
];

function createSpecificQuestTasks(prefix, tier, quests) {
  return quests.map((quest, index) => ({
    id: `${prefix}_q_extra_${index + 1}`,
    title: quest.label,
    category: "Quest",
    tier,
    difficulty: quest.difficulty,
    xp: quest.xp,
    repeatable: false,
    questCompleteAnyOf: [quest.id],
    objective: `Complete ${quest.label}`,
  }));
}

const GUTHIX_SPECIFIC_QUEST_TASKS = createSpecificQuestTasks("g", "Guthix", [
  { id: "demon_slayer", label: "Demon Slayer", difficulty: "Easy", xp: 100 },
  { id: "ernest_the_chicken", label: "Ernest the Chicken", difficulty: "Easy", xp: 75 },
  { id: "rune_mysteries", label: "Rune Mysteries", difficulty: "Easy", xp: 75 },
  { id: "lost_city", label: "Lost City", difficulty: "Medium", xp: 150 },
  { id: "the_grand_tree", label: "The Grand Tree", difficulty: "Medium", xp: 175 },
  { id: "priest_in_peril", label: "Priest in Peril", difficulty: "Medium", xp: 150 },
  { id: "x_marks_the_spot", label: "X Marks the Spot", difficulty: "Easy", xp: 75 },
  { id: "below_ice_mountain", label: "Below Ice Mountain", difficulty: "Easy", xp: 100 },
  { id: "client_of_kourend", label: "Client of Kourend", difficulty: "Easy", xp: 100 },
  { id: "children_of_the_sun", label: "Children of the Sun", difficulty: "Easy", xp: 100 },
  { id: "witchs_house", label: "Witch's House", difficulty: "Medium", xp: 150 },
  { id: "waterfall_quest", label: "Waterfall Quest", difficulty: "Medium", xp: 175 },
]);

const SARADOMIN_SPECIFIC_QUEST_TASKS = createSpecificQuestTasks("s", "Saradomin", [
  { id: "heroes_quest", label: "Heroes' Quest", difficulty: "Hard", xp: 375 },
  { id: "underground_pass", label: "Underground Pass", difficulty: "Hard", xp: 425 },
  { id: "lunar_diplomacy", label: "Lunar Diplomacy", difficulty: "Hard", xp: 400 },
  { id: "throne_of_miscellania", label: "Throne of Miscellania", difficulty: "Medium", xp: 275 },
  { id: "royal_trouble", label: "Royal Trouble", difficulty: "Hard", xp: 375 },
  { id: "horror_from_the_deep", label: "Horror from the Deep", difficulty: "Medium", xp: 250 },
  { id: "family_crest", label: "Family Crest", difficulty: "Medium", xp: 275 },
  { id: "ghosts_ahoy", label: "Ghosts Ahoy", difficulty: "Medium", xp: 300 },
  { id: "troll_stronghold", label: "Troll Stronghold", difficulty: "Medium", xp: 275 },
]);

const BANDOS_SPECIFIC_QUEST_TASKS = createSpecificQuestTasks("b", "Bandos", [
  { id: "the_fremennik_isles", label: "The Fremennik Isles", difficulty: "Hard", xp: 475 },
  { id: "darkness_of_hallowvale", label: "Darkness of Hallowvale", difficulty: "Hard", xp: 500 },
  { id: "defender_of_varrock", label: "Defender of Varrock", difficulty: "Hard", xp: 525 },
  { id: "land_of_the_goblins", label: "Land of the Goblins", difficulty: "Medium", xp: 350 },
  { id: "contact", label: "Contact!", difficulty: "Hard", xp: 475 },
  { id: "devious_minds", label: "Devious Minds", difficulty: "Hard", xp: 500 },
  { id: "a_taste_of_hope", label: "A Taste of Hope", difficulty: "Hard", xp: 525 },
  { id: "roving_elves", label: "Roving Elves", difficulty: "Hard", xp: 475 },
  { id: "the_temple_at_senntisten", label: "The Temple at Senntisten", difficulty: "Hard", xp: 550 },
]);

const ZAMORAK_SPECIFIC_QUEST_TASKS = createSpecificQuestTasks("z", "Zamorak", [
  { id: "dream_mentor", label: "Dream Mentor", difficulty: "Hard", xp: 725 },
  { id: "beneath_cursed_sands", label: "Beneath Cursed Sands", difficulty: "Hard", xp: 750 },
  { id: "grim_tales", label: "Grim Tales", difficulty: "Hard", xp: 700 },
  { id: "regicide", label: "Regicide", difficulty: "Hard", xp: 700 },
  { id: "mournings_end_part_i", label: "Mourning's End Part I", difficulty: "Hard", xp: 725 },
  { id: "eadgars_ruse", label: "Eadgar's Ruse", difficulty: "Hard", xp: 650 },
  { id: "my_arms_big_adventure", label: "My Arm's Big Adventure", difficulty: "Hard", xp: 700 },
  { id: "the_path_of_glouphrie", label: "The Path of Glouphrie", difficulty: "Hard", xp: 725 },
]);

const ZAROS_SPECIFIC_QUEST_TASKS = createSpecificQuestTasks("zr", "Zaros", [
  { id: "the_fremennik_exiles", label: "The Fremennik Exiles", difficulty: "Elite", xp: 1050 },
  { id: "secrets_of_the_north", label: "Secrets of the North", difficulty: "Elite", xp: 1050 },
  { id: "a_night_at_the_theatre", label: "A Night at the Theatre", difficulty: "Elite", xp: 1100 },
  { id: "mournings_end_part_ii", label: "Mourning's End Part II", difficulty: "Elite", xp: 1150 },
  { id: "making_friends_with_my_arm", label: "Making Friends with My Arm", difficulty: "Elite", xp: 1050 },
  { id: "perilous_moons", label: "Perilous Moons", difficulty: "Elite", xp: 1050 },
  { id: "the_curse_of_arrav", label: "The Curse of Arrav", difficulty: "Elite", xp: 1150 },
  { id: "dragon_slayer_ii", label: "Dragon Slayer II", difficulty: "Elite", xp: 1200 },
  { id: "monkey_madness_ii", label: "Monkey Madness II", difficulty: "Elite", xp: 1150 },
  { id: "the_temple_at_senntisten", label: "The Temple at Senntisten", difficulty: "Elite", xp: 1100 },
  { id: "a_taste_of_hope", label: "A Taste of Hope", difficulty: "Elite", xp: 1050 },
]);

function createSpecificBossTasks(prefix, tier, bosses) {
  return bosses.map((boss, index) => {
    const bossIds = boss.bossCompleteAnyOf ?? [boss.id];
    const primaryBossId = boss.id ?? bossIds[0];
    const title = boss.title ?? bossLabel(primaryBossId);
    return {
      id: `${prefix}_pvm_extra_${index + 1}`,
      title,
      category: boss.category ?? "PvM Intro",
      tier,
      difficulty: boss.difficulty,
      xp: boss.xp,
      repeatable: boss.repeatable ?? false,
      bossCompleteAnyOf: bossIds,
      requiresFn: boss.requiresFn ?? ((_s, kc) => (kc[primaryBossId] ?? 0) === 0),
      objective: boss.objective ?? `Defeat ${title} for the first time`,
    };
  });
}

const SARADOMIN_SPECIFIC_BOSS_TASKS = createSpecificBossTasks("s", "Saradomin", [
  { id: "king_black_dragon", difficulty: "Medium", xp: 250 },
  { id: "chaos_elemental", difficulty: "Medium", xp: 250 },
  { id: "deranged_archaeologist", difficulty: "Easy", xp: 175 },
  { id: "kalphite_queen", difficulty: "Hard", xp: 400 },
]);

const BANDOS_SPECIFIC_BOSS_TASKS = createSpecificBossTasks("b", "Bandos", [
  { id: "kraken", difficulty: "Medium", xp: 350 },
  { id: "callisto", difficulty: "Hard", xp: 575 },
  { id: "calvarion", difficulty: "Medium", xp: 350 },
  { id: "abyssal_sire", difficulty: "Hard", xp: 525 },
  { id: "skotizo", difficulty: "Medium", xp: 375 },
]);

const ZAMORAK_SPECIFIC_BOSS_TASKS = createSpecificBossTasks("z", "Zamorak", [
  { id: "corporeal_beast", difficulty: "Hard", xp: 725 },
  { id: "venenatis", difficulty: "Hard", xp: 725 },
  { id: "vetion", difficulty: "Hard", xp: 725 },
  { id: "araxxor", difficulty: "Elite", xp: 875 },
  { id: "chambers_of_xeric_challenge_mode", title: "Chambers of Xeric: Challenge Mode", category: "PvM Endurance", difficulty: "Elite", xp: 900, objective: "Complete Chambers of Xeric: Challenge Mode once" },
]);

const ZAROS_SPECIFIC_BOSS_TASKS = createSpecificBossTasks("zr", "Zaros", [
  { id: "theatre_of_blood_hard_mode", title: "Theatre of Blood: Hard Mode", category: "PvM Endurance", difficulty: "Elite", xp: 1200, objective: "Complete Theatre of Blood: Hard Mode once" },
  { id: "tombs_of_amascut_expert", title: "Tombs of Amascut: Expert Mode", category: "PvM Endurance", difficulty: "Elite", xp: 1200, objective: "Complete Tombs of Amascut: Expert Mode once" },
  { id: "phosanis_nightmare", title: "Phosani's Nightmare", difficulty: "Elite", xp: 1150 },
  { id: "amoxliatl", difficulty: "Elite", xp: 1050 },
  { id: "brutus", difficulty: "Elite", xp: 1050 },
  { id: "doom_of_mokhaiotl", difficulty: "Elite", xp: 1100 },
  { id: "shellbane_gryphon", difficulty: "Elite", xp: 1050 },
  { id: "the_hueycoatl", title: "The Hueycoatl", difficulty: "Elite", xp: 1100 },
  { id: "the_royal_titans", title: "The Royal Titans", difficulty: "Elite", xp: 1150 },
  { id: "yama", difficulty: "Elite", xp: 1250 },
  { id: "mimic", difficulty: "Elite", xp: 1050, objective: "Defeat the Mimic from a clue reward casket" },
]);

const DIARY_REGIONS = [
  { id: "ardougne", label: "Ardougne" },
  { id: "desert", label: "Desert" },
  { id: "falador", label: "Falador" },
  { id: "fremennik", label: "Fremennik" },
  { id: "kandarin", label: "Kandarin" },
  { id: "karamja", label: "Karamja" },
  { id: "kourend", label: "Kourend & Kebos" },
  { id: "lumbridge", label: "Lumbridge & Draynor" },
  { id: "morytania", label: "Morytania" },
  { id: "varrock", label: "Varrock" },
  { id: "western", label: "Western Provinces" },
  { id: "wilderness", label: "Wilderness" },
];

function createDiaryTasks({ mettleTier, diaryTier, difficulty, xp, prefix }) {
  const diaryLabel = diaryTier[0].toUpperCase() + diaryTier.slice(1);
  return DIARY_REGIONS.map((region) => ({
    id: `${prefix}_diary_${region.id}_${diaryTier}`,
    title: `${region.label} ${diaryLabel} Diary`,
    category: "Exploration",
    tier: mettleTier,
    difficulty,
    xp,
    repeatable: false,
    diaryTierAnyOf: [`${region.id}_${diaryTier}`],
    objective: `Complete the ${region.label} ${diaryLabel} Diary`,
  }));
}

const EASY_DIARY_TASKS = createDiaryTasks({
  mettleTier: "Guthix",
  diaryTier: "easy",
  difficulty: "Easy",
  xp: 125,
  prefix: "g",
});

const MEDIUM_DIARY_TASKS = createDiaryTasks({
  mettleTier: "Saradomin",
  diaryTier: "medium",
  difficulty: "Medium",
  xp: 275,
  prefix: "s",
});

const HARD_DIARY_TASKS = createDiaryTasks({
  mettleTier: "Bandos",
  diaryTier: "hard",
  difficulty: "Hard",
  xp: 575,
  prefix: "b",
});

const ELITE_DIARY_TASKS = createDiaryTasks({
  mettleTier: "Zaros",
  diaryTier: "elite",
  difficulty: "Elite",
  xp: 1050,
  prefix: "zr",
});

function hasQuestSyncData(questState) {
  const state = normalizeQuestState(questState);
  return Boolean(
    state.completedQuestIds.length ||
    state.startedQuestIds.length ||
    state.syncedQuestPoints !== null ||
    state.manualQuestPoints !== null ||
    state.updatedAt
  );
}

function firstIncompleteQuestOption(questState, pool) {
  if (!hasQuestSyncData(questState)) return null;
  const completed = new Set(normalizeQuestState(questState).completedQuestIds);
  return pool.find((quest) => !completed.has(quest.id)) ?? null;
}

function firstUnstartedQuestOption(questState, pool) {
  if (!hasQuestSyncData(questState)) return null;
  const state = normalizeQuestState(questState);
  const completed = new Set(state.completedQuestIds);
  const started = new Set(state.startedQuestIds);
  return pool.find((quest) => !completed.has(quest.id) && !started.has(quest.id))
    ?? firstIncompleteQuestOption(questState, pool);
}

function themedQuestTitle(baseTitle, questState, pool) {
  const nextQuest = firstIncompleteQuestOption(questState, pool);
  return nextQuest ? `${baseTitle}: ${nextQuest.label}` : baseTitle;
}

function themedQuestObjective(fallbackObjective, questState, pool, lead = "Complete") {
  const nextQuest = firstIncompleteQuestOption(questState, pool);
  return nextQuest ? `${lead} ${nextQuest.label}` : fallbackObjective;
}

export const TASK_POOL = [

  // ══════════════ GUTHIX ══════════════

  // Trials — dynamically resolved against account state
  { id:"trial_10", category:"Trial", tier:"Guthix", triggerLevel:10, difficulty:"Hard", xp:500, repeatable:false, trial:true,
    trialPool: ["obor","bryophyta","scurrius","giant_mole"],
    titleFn: (s, kc) => { const pool=["obor","bryophyta","scurrius","giant_mole"]; const boss=firstUntouchedFromPool(pool, kc, s); return `Trial of Mettle: ${bossLabel(boss)}`; },
    title:"Trial of Mettle: First Real Boss",
    objectiveFn: (s, kc) => { const pool=["obor","bryophyta","scurrius","giant_mole"]; const boss=firstUntouchedFromPool(pool, kc, s); return `Defeat ${bossLabel(boss)} — your first real boss test. ${(kc[boss]??0)} KC. Non-skippable.`; },
    objective:"Defeat an entry-level boss. Non-skippable." },
  { id:"trial_20", category:"Trial", tier:"Guthix", triggerLevel:20, difficulty:"Hard", xp:600, repeatable:false, trial:true,
    titleFn: (s, kc) => { const boss = lowestKCBoss(kc, GUTHIX_BOSSES, s); return `Trial of Mettle: ${bossLabel(boss)}`; },
    title:"Trial of Mettle: Guthix Endurance",
    objectiveFn: (s, kc) => { const boss = lowestKCBoss(kc, GUTHIX_BOSSES, s); return `Kill ${bossLabel(boss)} 3 times — your lowest KC Guthix boss at ${kc[boss]??0} KC. Non-skippable.`; },
    objective:"Endurance test against your weakest Guthix-tier boss. Non-skippable." },

  // PvM Intro (8)
  { id:"g_pvm_1", title:"Barrows Initiate",  category:"PvM Intro", tier:"Guthix", difficulty:"Medium", xp:200, repeatable:false,
    requiresFn: (_s, kc) => (kc.barrows_chests ?? 0) === 0,
    objective:"Complete one full Barrows run" },
  { id:"g_pvm_2", title:"Giant's Awakening", category:"PvM Intro", tier:"Guthix", difficulty:"Medium", xp:150, repeatable:false,
    requiresFn: (_s, kc) => (kc.obor ?? 0) === 0,
    objective:"Defeat Obor" },
  { id:"g_pvm_3", title:"Mossbreaker",        category:"PvM Intro", tier:"Guthix", difficulty:"Medium", xp:150, repeatable:false,
    requiresFn: (_s, kc) => (kc.bryophyta ?? 0) === 0,
    objective:"Defeat Bryophyta" },
  { id:"g_pvm_4", title:"Dungeon Descent",    category:"PvM Intro", tier:"Guthix", difficulty:"Easy",   xp:100, repeatable:false, objective:"Kill a boss inside Taverley Dungeon" },
  { id:"g_pvm_5", title:"First Slayer Boss",  category:"PvM Intro", tier:"Guthix", difficulty:"Easy",   xp:75,  repeatable:false, objective:"Defeat any Slayer boss once" },
  { id:"g_pvm_6", title:"Giant Slayer",        category:"PvM Intro", tier:"Guthix", difficulty:"Easy",   xp:75,  repeatable:true,  objective:"Kill 50 hill giants or moss giants" },
  { id:"g_pvm_7", title:"Barrows Endurance",  category:"PvM Endurance", tier:"Guthix", difficulty:"Hard", xp:400, repeatable:true, objective:"Complete three Barrows runs" },
  { id:"g_pvm_8",
    titleFn: (s, kc) => { const b = lowestKCBoss(kc, GUTHIX_BOSSES, s); return `First Blood: ${bossLabel(b)}`; },
    title:"Boss Hunter",
    category:"PvM Intro", tier:"Guthix", difficulty:"Medium", xp:200, repeatable:true,
    objectiveFn: (s, kc) => { const b = lowestKCBoss(kc, GUTHIX_BOSSES, s); return `Kill ${bossLabel(b)} — you have ${kc[b] ?? 0} KC. Face it.`; },
    objective:"Kill any boss you have 0 KC on" },
  { id:"g_pvm_9", title:"Adventurer's Ledger", category:"PvM Intro", tier:"Guthix", difficulty:"Easy", xp:125, repeatable:false, objective:"Complete 3 Easy Combat Achievement tasks" },

  // Quest (7)
  { id:"g_q_1", title:"The Forgotten Path",  category:"Quest", tier:"Guthix", difficulty:"Medium", xp:200, repeatable:true,  objective:"Complete 3 unfinished quests" },
  { id:"g_q_2", title:"Knowledge Seeker",    category:"Quest", tier:"Guthix", difficulty:"Easy",   xp:100, repeatable:true,  objective:"Gain 10 quest points" },
  { id:"g_q_3", title:"Guild Access",         category:"Exploration", tier:"Guthix", difficulty:"Easy", xp:75, repeatable:false, objective:"Unlock a new guild" },
  { id:"g_q_4", title:"Druidic Wisdom",      category:"Quest", tier:"Guthix", difficulty:"Easy",   xp:100, repeatable:false, questCompleteAnyOf:["druidic_ritual"], objective:"Complete Druidic Ritual to unlock Herblore" },
  { id:"g_q_5", title:"Mastery of Travel",   category:"Quest", tier:"Guthix", difficulty:"Easy",   xp:100, repeatable:false, objective:"Complete a quest that unlocks a major teleport method" },
  { id:"g_q_6",
    titleFn: (_s, _kc, questState) => themedQuestTitle("Story of Balance", questState, BALANCE_QUEST_POOL),
    title:"Story of Balance",
    category:"Quest", tier:"Guthix", difficulty:"Medium", xp:150, repeatable:false,
    questPoolAnyOf: BALANCE_QUEST_POOL.map(({ id }) => id),
    objectiveFn: (_s, _kc, questState) => themedQuestObjective("Complete a Guthix-aligned quest", questState, BALANCE_QUEST_POOL),
    objective:"Complete a Guthix-aligned quest" },
  { id:"g_q_7", title:"Unfinished Business", category:"Quest", tier:"Guthix", difficulty:"Easy",   xp:75,  repeatable:false, objective:"Complete the oldest incomplete quest on your account" },
  { id:"g_q_8",
    titleFn: (_s, _kc, questState) => themedQuestTitle("Foundations of the Realm", questState, FOUNDATION_UNLOCK_QUEST_POOL),
    title:"Foundations of the Realm",
    category:"Quest", tier:"Guthix", difficulty:"Medium", xp:150, repeatable:true,
    questPoolAnyOf: FOUNDATION_UNLOCK_QUEST_POOL.map(({ id }) => id),
    objectiveFn: (_s, _kc, questState) => themedQuestObjective("Complete an early unlock quest from the current pool", questState, FOUNDATION_UNLOCK_QUEST_POOL),
    objective:"Complete an early unlock quest from the current pool" },
  ...GUTHIX_SPECIFIC_QUEST_TASKS,

  // Skill Gap (10)
  { id:"g_sk_1",
    titleFn: (s) => `Weakest Link: ${skillLabel(lowestSkill(s))}`,
    title:"Weakest Link",
    category:"Skill Gap", tier:"Guthix", difficulty:"Easy", xp:75, repeatable:true,
    objectiveFn: (s) => {
      const sk = lowestSkill(s);
      return formatSingleSkillGainObjective(sk, s[sk], "Easy", "Gain", "your lowest skill at");
    },
    objective:"Gain 3 levels in your lowest skill" },

  { id:"g_sk_2",
    titleFn: (s) => {
      const { skills } = resolveBalancedGrowthTarget(s);
      return `Balanced Growth: ${skills.map(skillLabel).join(", ")}`;
    },
    title:"Balanced Growth",
    category:"Skill Gap", tier:"Guthix", difficulty:"Medium", xp:150, repeatable:true,
    objectiveFn: (s) => {
      const { skills, unit, amount } = resolveBalancedGrowthTarget(s);
      return unit === "xp"
        ? `Gain ${amount.toLocaleString()} XP in each: ${skills.map(k => `${skillLabel(k)} (${s[k]})`).join(", ")}`
        : `Gain ${amount} level in each: ${skills.map(k => `${skillLabel(k)} (${s[k]})`).join(", ")}`;
    },
    objective:"Gain 1 level in five different skills" },

  { id:"g_sk_3",
    titleFn: (s) => `Artisan's Trial: ${skillLabel(lowestProductionSkill(s))}`,
    title:"Artisan's Trial",
    category:"Skill Gap", tier:"Guthix", difficulty:"Medium", xp:150, repeatable:true,
    objectiveFn: (s) => {
      const sk = lowestProductionSkill(s);
      return formatSingleSkillGainObjective(sk, s[sk], "Medium", "Gain", "your lowest production skill at");
    },
    objective:"Gain 5 levels in any production skill" },

  { id:"g_sk_4",  title:"Gatherer's Path",      category:"Skill Gap", tier:"Guthix", difficulty:"Easy",   xp:75,  repeatable:true,  objective:"Collect 500 of any raw resource" },
  { id:"g_sk_5",  title:"The Grind Begins",     category:"Endurance", tier:"Guthix", difficulty:"Easy",   xp:75,  repeatable:true,  objective:"Train any skill for 30 continuous minutes" },
  { id:"g_sk_6",  title:"Tool Upgrade",          category:"Skill Gap", tier:"Guthix", difficulty:"Easy",   xp:75,  repeatable:false, objective:"Craft or acquire an upgraded skilling tool" },
  { id:"g_sk_7",  title:"Artisan Contract",     category:"Skill Gap", tier:"Guthix", difficulty:"Easy",   xp:100, repeatable:true,  objective:"Produce 100 items of any craftable" },

  { id:"g_sk_8",
    titleFn: (s) => `Skill Breakthrough: ${skillLabel(lowestSkill(s))}`,
    title:"Skill Breakthrough",
    category:"Skill Gap", tier:"Guthix", difficulty:"Medium", xp:150, repeatable:true,
    objectiveFn: (s) => {
      const sk = lowestSkill(s);
      const avg = accountAverage(s);
      return formatAverageGapClosureObjective(sk, s[sk], avg, "Medium");
    },
    objective:"Raise a skill above your account average" },

  { id:"g_sk_9",
    titleFn: (s) => { const sk = lowestSkill(s, ["attack","strength","defence","hitpoints","ranged","magic","prayer","slayer"]); return `Neglected: ${skillLabel(sk)}`; },
    title:"Neglected Discipline",
    category:"Skill Gap", tier:"Guthix", difficulty:"Medium", xp:150, repeatable:true,
    objectiveFn: (s) => {
      const sk = lowestSkill(s, ["attack","strength","defence","hitpoints","ranged","magic","prayer","slayer"]);
      const target = resolveSingleSkillGainTarget(s[sk], "Medium");
      const progress = target.unit === "xp"
        ? `Train ${skillLabel(sk)} for ${target.amount.toLocaleString()} XP`
        : `Train ${skillLabel(sk)} by ${target.amount} level${target.amount === 1 ? "" : "s"}`;
      return `${progress} — your lowest non-combat skill at ${s[sk]}`;
    },
    objective:"Train your lowest non-combat skill by 5 levels" },

  { id:"g_sk_10", title:"Economic Insight", category:"Economic", tier:"Guthix", difficulty:"Easy", xp:100, repeatable:true, objective:"Earn 100k GP from skilling" },
  { id:"g_sk_11", title:"Sea Legs", category:"Skill Gap", tier:"Guthix", difficulty:"Easy", xp:125, repeatable:false, requiresFn:(s)=>s.sailing<20, objective:"Reach 20 Sailing" },

  // Exploration (5)
  { id:"g_ex_1", title:"The Deep",         category:"Exploration", tier:"Guthix", difficulty:"Easy",   xp:75,  repeatable:false, objective:"Enter Kalphite Lair" },
  { id:"g_ex_2", title:"Frozen Frontier",  category:"Exploration", tier:"Guthix", difficulty:"Easy",   xp:75,  repeatable:false, objective:"Reach God Wars Dungeon" },
  { id:"g_ex_3", title:"Ancient Treasure", category:"Exploration", tier:"Guthix", difficulty:"Medium", xp:150, repeatable:true,  objective:"Open 5 clue scroll caskets" },
  { id:"g_ex_4", title:"The Unknown",      category:"Exploration", tier:"Guthix", difficulty:"Easy",   xp:75,  repeatable:true,  objective:"Visit three areas you have never entered before" },
  { id:"g_ex_5", title:"Merchant's Trial", category:"Economic",   tier:"Guthix", difficulty:"Easy",   xp:100, repeatable:true,  objective:"Flip or trade items for profit" },
  { id:"g_ex_6", title:"First Charts",     category:"Exploration", tier:"Guthix", difficulty:"Easy",   xp:125, repeatable:true,  objective:"Complete 1 Beginner or Easy clue scroll" },
  { id:"g_ex_7", title:"Fresh Slot",       category:"Exploration", tier:"Guthix", difficulty:"Easy",   xp:125, repeatable:true,  objective:"Fill 1 new Collection Log slot" },
  { id:"g_ex_8", title:"Wintertodt Warm-Up", category:"Exploration", tier:"Guthix", difficulty:"Medium", xp:175, repeatable:false, requiresFn: (s, kc) => s.firemaking >= 50 && (kc.wintertodt ?? 0) === 0, objective:"Subdue Wintertodt once" },
  { id:"g_ex_9", title:"Cove Rescue",        category:"Exploration", tier:"Guthix", difficulty:"Medium", xp:175, repeatable:false, requiresFn: (s, kc) => s.fishing >= 35 && (kc.tempoross ?? 0) === 0, objective:"Subdue Tempoross once" },
  ...EASY_DIARY_TASKS,

  // Endurance (5)
  { id:"g_en_1", title:"Slayer's Commitment", category:"Endurance", tier:"Guthix", difficulty:"Easy",   xp:100, repeatable:true, objective:"Complete two Slayer tasks in a row" },
  { id:"g_en_2", title:"Dungeon Marathon",    category:"Endurance", tier:"Guthix", difficulty:"Medium", xp:200, repeatable:true, objective:"Kill 200 monsters in a single dungeon" },
  { id:"g_en_3", title:"Focused Training",    category:"Endurance", tier:"Guthix", difficulty:"Medium", xp:150, repeatable:true, objective:"Train one skill for 60 uninterrupted minutes" },
  { id:"g_en_4", title:"Resource Run",        category:"Endurance", tier:"Guthix", difficulty:"Medium", xp:150, repeatable:true, objective:"Gather 600 resources of any type" },
  { id:"g_en_5", title:"Hold the Ground",       category:"Endurance", tier:"Guthix", difficulty:"Medium", xp:200, repeatable:true, objective:"Kill 300 monsters without leaving an area" },

  // ══════════════ SARADOMIN ══════════════

  { id:"trial_30", category:"Trial", tier:"Saradomin", triggerLevel:30, difficulty:"Hard", xp:700, repeatable:false, trial:true,
    titleFn: (s, kc) => { const pool=["tztok_jad","barrows_chests","scorpia","chaos_fanatic"]; const boss=lowestKCBoss(kc, pool, s); if((kc.tztok_jad??0)===0 && boss==="tztok_jad") return "Trial of Mettle: The Fire Cape"; return `Trial of Mettle: ${bossLabel(boss)}`; },
    title:"Trial of Mettle: Saradomin Proving",
    objectiveFn: (s, kc) => { const pool=["tztok_jad","barrows_chests","scorpia","chaos_fanatic"]; const boss=lowestKCBoss(kc, pool, s); if((kc.tztok_jad??0)===0 && boss==="tztok_jad") return "Obtain the Fire Cape from TzTok-Jad. Non-skippable."; return `Defeat ${bossLabel(boss)} — untouched at ${kc[boss]??0} KC. Non-skippable.`; },
    objective:"A Saradomin-tier proving. Non-skippable." },
  { id:"trial_40", category:"Trial", tier:"Saradomin", triggerLevel:40, difficulty:"Hard", xp:800, repeatable:false, trial:true,
    titleFn: (s, kc) => { const pool=["zulrah","dagannoth_rex","dagannoth_prime","dagannoth_supreme","sarachnis"]; const boss=lowestKCBoss(kc, pool, s); if((kc.zulrah??0)===0 && boss==="zulrah") return "Trial of Mettle: First Zulrah Kill"; return `Trial of Mettle: ${bossLabel(boss)}`; },
    title:"Trial of Mettle: Mechanical Boss",
    objectiveFn: (s, kc) => { const pool=["zulrah","dagannoth_rex","dagannoth_prime","dagannoth_supreme","sarachnis"]; const boss=lowestKCBoss(kc, pool, s); if((kc.zulrah??0)===0 && boss==="zulrah") return "Kill Zulrah for the first time. Non-skippable."; return `Kill ${bossLabel(boss)} — ${kc[boss]??0} KC. Non-skippable.`; },
    objective:"Mechanical boss introduction. Non-skippable." },

  { id:"s_pvm_1",  title:"Barrows Escalation",     category:"PvM Intro",     tier:"Saradomin", difficulty:"Medium", xp:250, repeatable:false, requiresFn:(_,kc)=>(kc.barrows_chests??0)<5, objective:"Complete 5 Barrows runs total" },
  { id:"s_pvm_2",  title:"First Blood (Dagannoth)",  category:"PvM Intro",     tier:"Saradomin", difficulty:"Medium", xp:250, repeatable:false, requiresFn:(_,kc)=>(kc.dagannoth_rex??0)===0||(kc.dagannoth_prime??0)===0||(kc.dagannoth_supreme??0)===0, objective:"Kill a Dagannoth Rex, Prime, or Supreme" },
  { id:"s_pvm_3",  title:"Sarachnis Awakens",        category:"PvM Intro",     tier:"Saradomin", difficulty:"Medium", xp:200, repeatable:false, requiresFn:(_,kc)=>(kc.sarachnis??0)===0, objective:"Defeat Sarachnis" },
  { id:"s_pvm_4",  title:"Mole Hunter",               category:"PvM Intro",     tier:"Saradomin", difficulty:"Easy",   xp:150, repeatable:false, requiresFn:(_,kc)=>(kc.giant_mole??0)===0, objective:"Defeat the Giant Mole" },
  { id:"s_pvm_5",  title:"Scorpia's Domain",          category:"PvM Intro",     tier:"Saradomin", difficulty:"Medium", xp:200, repeatable:false, requiresFn:(_,kc)=>(kc.scorpia??0)===0, objective:"Defeat Scorpia" },
  { id:"s_pvm_6",  title:"Chaos Fanatic",              category:"PvM Intro",     tier:"Saradomin", difficulty:"Easy",   xp:150, repeatable:false, requiresFn:(_,kc)=>(kc.chaos_fanatic??0)===0, objective:"Defeat the Chaos Fanatic" },
  { id:"s_pvm_7",  title:"Crazy Archaeologist",        category:"PvM Intro",     tier:"Saradomin", difficulty:"Easy",   xp:150, repeatable:false, requiresFn:(_,kc)=>(kc.crazy_archaeologist??0)===0, objective:"Defeat the Crazy Archaeologist" },
  { id:"s_pvm_8",  title:"Slayer Escalation",          category:"PvM Endurance", tier:"Saradomin", difficulty:"Medium", xp:300, repeatable:true,  objective:"Complete 5 Slayer tasks in a row without skipping" },
  { id:"s_pvm_9",  title:"The King's Court",           category:"PvM Intro",     tier:"Saradomin", difficulty:"Hard",   xp:400, repeatable:false, objective:"Obtain any Barrows item" },
  { id:"s_pvm_10", title:"Wilderness Contract",        category:"PvM Intro",     tier:"Saradomin", difficulty:"Medium", xp:250, repeatable:true,  objective:"Kill any wilderness boss once" },
  { id:"s_pvm_11", title:"Proven Mechanics",           category:"PvM Endurance", tier:"Saradomin", difficulty:"Medium", xp:325, repeatable:false, objective:"Complete 5 Medium Combat Achievement tasks" },
  ...SARADOMIN_SPECIFIC_BOSS_TASKS,

  { id:"s_q_1", title:"The Long Road",        category:"Quest", tier:"Saradomin", difficulty:"Medium", xp:300, repeatable:false, questPointsTarget:200, objective:"Reach 200 quest points" },
  { id:"s_q_2", title:"Dragon Slayer",         category:"Quest", tier:"Saradomin", difficulty:"Medium", xp:250, repeatable:false, questCompleteAnyOf:["dragon_slayer_i"], objective:"Complete Dragon Slayer I" },
  { id:"s_q_3", title:"A Kingdom Divided",     category:"Quest", tier:"Saradomin", difficulty:"Hard",   xp:400, repeatable:false, questCompleteAnyOf:["a_kingdom_divided"], objective:"Complete A Kingdom Divided" },
  { id:"s_q_4", title:"Piety Unlocked",        category:"Quest", tier:"Saradomin", difficulty:"Hard",   xp:400, repeatable:false, questCompleteAnyOf:["kings_ransom"], objective:"Complete King's Ransom to unlock Piety" },
  { id:"s_q_5", title:"Fairy Counsel",         category:"Quest", tier:"Saradomin", difficulty:"Hard",   xp:400, repeatable:false, questCompleteAnyOf:["fairytale_ii_cure_a_queen"], objective:"Complete Fairytale II - Cure a Queen" },
  { id:"s_q_6",
    titleFn: (_s, _kc, questState) => themedQuestTitle("Master's Calling", questState, MASTER_QUEST_POOL),
    title:"Master's Calling",
    category:"Quest", tier:"Saradomin", difficulty:"Hard", xp:400, repeatable:true,
    questPoolAnyOf: MASTER_QUEST_POOL.map(({ id }) => id),
    objectiveFn: (_s, _kc, questState) => themedQuestObjective("Complete any unfinished Master quest from the current pool", questState, MASTER_QUEST_POOL),
    objective:"Complete a quest with a Master difficulty rating" },
  { id:"s_q_7",
    titleFn: (_s, _kc, questState) => themedQuestTitle("Story of Order", questState, ORDER_QUEST_POOL),
    title:"Story of Order",
    category:"Quest", tier:"Saradomin", difficulty:"Medium", xp:250, repeatable:false,
    questPoolAnyOf: ORDER_QUEST_POOL.map(({ id }) => id),
    objectiveFn: (_s, _kc, questState) => themedQuestObjective("Complete a Saradomin-aligned quest", questState, ORDER_QUEST_POOL),
    objective:"Complete a Saradomin-aligned quest" },
  { id:"s_q_8",
    titleFn: (_s, _kc, questState) => {
      const nextQuest = firstUnstartedQuestOption(questState, EARLY_QUEST_POOL);
      return nextQuest ? `Breadth of Knowledge: ${nextQuest.label}` : "Breadth of Knowledge";
    },
    title:"Breadth of Knowledge",
    category:"Quest", tier:"Saradomin", difficulty:"Medium", xp:300, repeatable:true,
    questPoolAnyOf: EARLY_QUEST_POOL.map(({ id }) => id),
    objectiveFn: (_s, _kc, questState) => {
      const nextQuest = firstUnstartedQuestOption(questState, EARLY_QUEST_POOL);
      return nextQuest ? `Complete ${nextQuest.label} — a quest you have not started yet` : "Complete an unstarted quest from the early-game pool";
    },
    objective:"Complete 5 quests you have never attempted" },
  { id:"s_q_9",
    title:"Loose Ends",
    category:"Quest", tier:"Saradomin", difficulty:"Medium", xp:300, repeatable:false,
    requiresFn: (_s, _kc, questState) => countStartedQuests(questState) >= 2,
    objectiveFn: (_s, _kc, questState) => {
      const startedCount = countStartedQuests(questState);
      return `Complete 2 quests you have already started${startedCount > 0 ? ` (${startedCount} currently in progress)` : ""}`;
    },
    objective:"Complete 2 quests you have already started" },
  { id:"s_q_10",
    titleFn: (_s, _kc, questState) => themedQuestTitle("Northern Sagas", questState, FREMENNIK_QUEST_POOL),
    title:"Northern Sagas",
    category:"Quest", tier:"Saradomin", difficulty:"Hard", xp:425, repeatable:true,
    questPoolAnyOf: FREMENNIK_QUEST_POOL.map(({ id }) => id),
    objectiveFn: (_s, _kc, questState) => themedQuestObjective("Complete a Fremennik quest from the current pool", questState, FREMENNIK_QUEST_POOL),
    objective:"Complete a Fremennik quest from the current pool" },
  ...SARADOMIN_SPECIFIC_QUEST_TASKS,

  { id:"s_sk_1",
    titleFn: (s) => { const skills = lowestNSkills(s,2,true); return `Close the Gap: ${skills.map(skillLabel).join(" & ")}`; },
    title:"Closing the Distance",
    category:"Skill Gap", tier:"Saradomin", difficulty:"Medium", xp:300, repeatable:true,
    objectiveFn: (s) => {
      const avg = accountAverage(s);
      const skills = lowestNSkills(s,2,true);
      const target = resolveMultiSkillGapTarget(s, skills);
      return target.unit === "xp"
        ? `Gain ${target.amount.toLocaleString()} XP in each of ${skills.map(k => `${skillLabel(k)} (${s[k]})`).join(" and ")} toward your account average of ${avg.toFixed(0)}`
        : `Close ${target.amount} level${target.amount === 1 ? "" : "s"} of the gap in each of ${skills.map(k => `${skillLabel(k)} (${s[k]})`).join(" and ")} toward your account average of ${avg.toFixed(0)}`;
    },
    objective:"Raise two skills above your account average" },

  { id:"s_sk_2",
    titleFn: (s) => { const sk = lowestSkill(s); return `The Long Grind: ${skillLabel(sk)}`; },
    title:"The Long Grind",
    category:"Skill Gap", tier:"Saradomin", difficulty:"Hard", xp:400, repeatable:true,
    objectiveFn: (s) => { const sk = [...SKILLS].filter(x=>s[x]<70).sort((a,b)=>s[a]-s[b])[0] || lowestSkill(s); return `Reach level 70 in ${skillLabel(sk)} (currently ${s[sk]})`; },
    requiresFn: (s) => SKILLS.some(sk => s[sk] < 70),
    objective:"Reach level 70 in any skill currently below 70" },

  { id:"s_sk_3",
    title:"Artisan's Discipline",
    category:"Skill Gap", tier:"Saradomin", difficulty:"Hard", xp:400, repeatable:true,
    objectiveFn: (s) => {
      const target = resolveProductionSessionTarget(s);
      return target.unit === "xp"
        ? `Gain ${target.amount.toLocaleString()} XP across production skills in one session`
        : `Gain ${target.amount} total levels across production skills in one session`;
    },
    objective:"Gain 10 levels across production skills in one session" },
  { id:"s_sk_4",  title:"Fisher's Trial",         category:"Skill Gap", tier:"Saradomin", difficulty:"Medium", xp:250, repeatable:false, requiresFn:(s)=>s.fishing<65, objective:"Reach 65 Fishing" },
  { id:"s_sk_5",  title:"The Alchemist",          category:"Economic",  tier:"Saradomin", difficulty:"Medium", xp:250, repeatable:true,  objective:"Earn 500k GP from any non-combat skilling method" },
  { id:"s_sk_6",  title:"Runecraft Reckoning",    category:"Skill Gap", tier:"Saradomin", difficulty:"Hard",   xp:400, repeatable:false, requiresFn:(s)=>s.runecrafting<50, objective:"Reach 50 Runecrafting" },
  { id:"s_sk_7",  title:"Farmer's Debt",          category:"Skill Gap", tier:"Saradomin", difficulty:"Medium", xp:250, repeatable:false, requiresFn:(s)=>s.farming<65,      objective:"Reach 65 Farming" },
  { id:"s_sk_8",  title:"Forged in Fire",         category:"Skill Gap", tier:"Saradomin", difficulty:"Medium", xp:300, repeatable:false, requiresFn:(s)=>s.smithing<70,     objective:"Reach 70 Smithing" },
  { id:"s_sk_9",  title:"The Disciplined Mind",   category:"Endurance", tier:"Saradomin", difficulty:"Medium", xp:250, repeatable:true,  objective:"Train the same skill 3 sessions in a row" },

  { id:"s_sk_10",
    titleFn: (s) => { const skills = lowestNSkills(s,3,true); return `Convergence: ${skills.map(skillLabel).join(", ")}`; },
    title:"Skill Convergence",
    category:"Skill Gap", tier:"Saradomin", difficulty:"Hard", xp:400, repeatable:true,
    objectiveFn: (s) => { const skills = lowestNSkills(s,3,true); return `Bring ${skills.map(k=>`${skillLabel(k)} (${s[k]})`).join(", ")} within 10 levels of each other`; },
    objective:"Bring your three lowest skills within 10 levels of each other" },
  { id:"s_sk_11", title:"Open Waters", category:"Skill Gap", tier:"Saradomin", difficulty:"Medium", xp:325, repeatable:false, requiresFn:(s)=>s.sailing<40, objective:"Reach 40 Sailing" },

  { id:"s_en_1", title:"The Long Watch",       category:"Endurance", tier:"Saradomin", difficulty:"Medium", xp:300, repeatable:true, objective:"Complete a 2-hour uninterrupted grind session" },
  { id:"s_en_2", title:"Slayer Marathon",      category:"Endurance", tier:"Saradomin", difficulty:"Medium", xp:300, repeatable:true, objective:"Complete 10 Slayer tasks total" },
  { id:"s_en_3", title:"Boss Endurance",       category:"Endurance", tier:"Saradomin", difficulty:"Hard",   xp:400, repeatable:true, objective:"Kill the same boss 10 times in one session" },
  { id:"s_en_4", title:"The Sustained Effort", category:"Endurance", tier:"Saradomin", difficulty:"Hard",   xp:450, repeatable:true, objective:"Earn 1M GP in a single session without dying" },
  { id:"s_en_5", title:"Resource Hoarder",     category:"Endurance", tier:"Saradomin", difficulty:"Medium", xp:300, repeatable:true, objective:"Gather 5000 resources of any single type" },
  { id:"s_en_6", title:"Dungeon Delve",        category:"Endurance", tier:"Saradomin", difficulty:"Medium", xp:300, repeatable:true, objective:"Kill 500 monsters in dungeons total" },
  { id:"s_en_7", title:"The Unflinching",      category:"Endurance", tier:"Saradomin", difficulty:"Hard",   xp:450, repeatable:true, objective:"Complete any boss 3 times in a row without dying" },

  { id:"s_ex_1", title:"Morytania Passage", category:"Exploration", tier:"Saradomin", difficulty:"Medium", xp:250, repeatable:false, questCompleteAnyOf:["priest_in_peril"], objective:"Complete Priest in Peril to unlock Morytania" },
  { id:"s_ex_2", title:"Raid Recon",          category:"Exploration", tier:"Saradomin", difficulty:"Medium", xp:250, repeatable:false, requiresFn:(_,kc)=>(kc.chambers_of_xeric??0)===0, objective:"Enter the Chambers of Xeric for the first time" },
  { id:"s_ex_3", title:"Fairy Network",       category:"Exploration", tier:"Saradomin", difficulty:"Medium", xp:250, repeatable:false, objective:"Complete the quest chain to unlock the fairy ring network" },
  { id:"s_ex_4", title:"The God Wars",        category:"Exploration", tier:"Saradomin", difficulty:"Medium", xp:250, repeatable:false, objective:"Enter God Wars Dungeon and kill any enemy inside" },
  { id:"s_ex_5", title:"Spirit Realm",        category:"Exploration", tier:"Saradomin", difficulty:"Medium", xp:250, repeatable:false, objective:"Complete the quest chain to unlock the Spirit Tree network" },
  { id:"s_ex_6", title:"Clue Cartographer",   category:"Exploration", tier:"Saradomin", difficulty:"Medium", xp:300, repeatable:true,  objective:"Complete 2 Medium or Hard clue scrolls" },
  { id:"s_ex_7", title:"Ledger Growth",       category:"Exploration", tier:"Saradomin", difficulty:"Medium", xp:325, repeatable:true,  objective:"Fill 2 new Collection Log slots" },
  { id:"s_ex_8", title:"Guild Contract",      category:"Exploration", tier:"Saradomin", difficulty:"Medium", xp:275, repeatable:true,  requiresFn:(s)=>s.farming>=45, objective:"Complete 3 Farming Contracts" },
  { id:"s_ex_9", title:"Rumour Board",        category:"Exploration", tier:"Saradomin", difficulty:"Medium", xp:300, repeatable:true,  requiresFn:(s)=>s.hunter>=46, objective:"Complete 3 Hunters' Rumours" },
  ...MEDIUM_DIARY_TASKS,

  // ══════════════ BANDOS ══════════════

  { id:"trial_50", category:"Trial", tier:"Bandos", triggerLevel:50, difficulty:"Hard", xp:900, repeatable:false, trial:true,
    titleFn: (s, kc) => { const pool=["general_graardor","kreearra","kril_tsutsaroth","commander_zilyana"]; const boss = lowestKCBoss(kc, pool, s); if((kc[boss]??0)===0) return `Trial of Mettle: ${bossLabel(boss)}`; return "Trial of Mettle: Dragon Slayer II"; },
    title:"Trial of Mettle: Bandos Proving",
    objectiveFn: (s, kc) => { const pool=["general_graardor","kreearra","kril_tsutsaroth","commander_zilyana"]; const boss = lowestKCBoss(kc, pool, s); if((kc[boss]??0)===0) return `Kill ${bossLabel(boss)} for the first time — the God Wars demand your presence. Non-skippable.`; return "Complete Dragon Slayer II. Non-skippable."; },
    objective:"A Bandos-tier proving. Non-skippable." },
  { id:"trial_60", category:"Trial", tier:"Bandos", triggerLevel:60, difficulty:"Elite", xp:1000, repeatable:false, trial:true,
    titleFn: (s, kc) => { if((kc.chambers_of_xeric??0)===0) return "Trial of Mettle: First Raid"; const gwd=["general_graardor","kreearra","kril_tsutsaroth","commander_zilyana"]; const low=lowestKCBoss(kc, gwd, s); return `Trial of Mettle: ${bossLabel(low)} Endurance`; },
    title:"Trial of Mettle: First Raid",
    objectiveFn: (s, kc) => { if((kc.chambers_of_xeric??0)===0) return "Complete Chambers of Xeric. Your first full raid. Non-skippable."; const gwd=["general_graardor","kreearra","kril_tsutsaroth","commander_zilyana"]; const low=lowestKCBoss(kc, gwd, s); return `Kill ${bossLabel(low)} 10 times in one session (${kc[low]??0} KC). Non-skippable.`; },
    objective:"First raid or GWD endurance. Non-skippable." },

  { id:"b_pvm_1",  title:"Dagannoth Dynasty",   category:"PvM Intro",     tier:"Bandos", difficulty:"Hard",   xp:550, repeatable:false, requiresFn:(_,kc)=>(kc.dagannoth_rex??0)<3, objective:"Kill all three Dagannoth Kings" },
  { id:"b_pvm_2",  title:"The Spider's Web",    category:"PvM Endurance", tier:"Bandos", difficulty:"Medium", xp:350, repeatable:true,  objective:"Kill Sarachnis 10 times" },
  { id:"b_pvm_3",  title:"Mole Infestation",    category:"PvM Endurance", tier:"Bandos", difficulty:"Easy",   xp:250, repeatable:true,  objective:"Kill the Giant Mole 5 times" },
  { id:"b_pvm_4",  title:"Bandos Foothold",     category:"PvM Intro",     tier:"Bandos", difficulty:"Hard",   xp:600, repeatable:false, requiresFn:(_,kc)=>(kc.general_graardor??0)===0, objective:"Get your first kill at General Graardor" },
  { id:"b_pvm_5",  title:"Armadyl Rising",      category:"PvM Intro",     tier:"Bandos", difficulty:"Hard",   xp:600, repeatable:false, requiresFn:(_,kc)=>(kc.kreearra??0)===0, objective:"Get your first kill at Kree'arra" },
  { id:"b_pvm_6",  title:"Zamorak's General",   category:"PvM Intro",     tier:"Bandos", difficulty:"Hard",   xp:600, repeatable:false, requiresFn:(_,kc)=>(kc.kril_tsutsaroth??0)===0, objective:"Get your first kill at K'ril Tsutsaroth" },
  { id:"b_pvm_7",  title:"Saradomin's Champion",category:"PvM Intro",     tier:"Bandos", difficulty:"Hard",   xp:600, repeatable:false, requiresFn:(_,kc)=>(kc.commander_zilyana??0)===0, objective:"Get your first kill at Commander Zilyana" },
  { id:"b_pvm_8",  title:"Barrows Regular",     category:"PvM Endurance", tier:"Bandos", difficulty:"Medium", xp:350, repeatable:true,  objective:"Complete 10 Barrows runs total" },
  { id:"b_pvm_9",  title:"Wilderness Warlord",  category:"PvM Intro",     tier:"Bandos", difficulty:"Hard",   xp:650, repeatable:true,  objective:"Kill 3 different wilderness bosses (mandatory from Bandos tier)" },
  { id:"b_pvm_10", title:"Slayer Milestone",    category:"PvM Endurance", tier:"Bandos", difficulty:"Medium", xp:300, repeatable:false, objective:"Reach 500 total Slayer kills" },
  { id:"b_pvm_11", title:"Serpent's Initiation",category:"PvM Intro",     tier:"Bandos", difficulty:"Hard",   xp:550, repeatable:false, requiresFn:(_,kc)=>(kc.zulrah??0)===0, objective:"Attempt Zulrah for the first time if not yet done" },
  { id:"b_pvm_12", title:"Sustained Assault",   category:"PvM Endurance", tier:"Bandos", difficulty:"Hard",   xp:550, repeatable:true,
    titleFn:(s,kc)=>{ const gwd=["general_graardor","kreearra","kril_tsutsaroth","commander_zilyana"]; const target=lowestKCBoss(kc, gwd, s); return `Sustained Assault: ${bossLabel(target)}`; },
    objectiveFn:(s,kc)=>{ const gwd=["general_graardor","kreearra","kril_tsutsaroth","commander_zilyana"]; const target=lowestKCBoss(kc, gwd, s); return `Kill ${bossLabel(target)} 5 times in one session (${kc[target]??0} KC)`; },
    objective:"Kill any GWD boss 5 times in one session" },
  { id:"b_pvm_13", title:"War Ledger",          category:"PvM Endurance", tier:"Bandos", difficulty:"Hard",   xp:575, repeatable:false, objective:"Complete 5 Hard Combat Achievement tasks" },
  ...BANDOS_SPECIFIC_BOSS_TASKS,

  { id:"b_q_1", title:"Monkey See",          category:"Quest", tier:"Bandos", difficulty:"Hard",   xp:450, repeatable:false, questCompleteAnyOf:["monkey_madness_i", "monkey_madness_ii"], objective:"Complete Monkey Madness I or II" },
  { id:"b_q_2", title:"Recipe for Disaster", category:"Quest", tier:"Bandos", difficulty:"Elite",  xp:700, repeatable:false, questCompleteAnyOf:["recipe_for_disaster"], objective:"Complete Recipe for Disaster" },
  { id:"b_q_3", title:"The Fremennik",       category:"Quest", tier:"Bandos", difficulty:"Medium", xp:300, repeatable:false, questCompleteAnyOf:["the_fremennik_trials"], objective:"Complete The Fremennik Trials" },
  // FIX: removed incorrect requiresFn that was checking prayer level against QP value
  { id:"b_q_4", title:"225 Quest Points",    category:"Quest", tier:"Bandos", difficulty:"Hard",   xp:550, repeatable:false, questPointsTarget:225, objective:"Reach 225 quest points" },
  { id:"b_q_5", title:"The Grand History",   category:"Quest", tier:"Bandos", difficulty:"Hard",   xp:650, repeatable:true,  objective:"Complete 3 Master-difficulty quests" },
  { id:"b_q_6",
    titleFn: (_s, _kc, questState) => themedQuestTitle("Bandos Allegiance", questState, BANDOS_QUEST_POOL),
    title:"Bandos Allegiance",
    category:"Quest", tier:"Bandos", difficulty:"Medium", xp:325, repeatable:false,
    questPoolAnyOf: BANDOS_QUEST_POOL.map(({ id }) => id),
    objectiveFn: (_s, _kc, questState) => themedQuestObjective("Complete a quest tied to Bandos lore", questState, BANDOS_QUEST_POOL),
    objective:"Complete a quest tied to Bandos lore" },
  { id:"b_q_7", title:"The Slayer Codex",    category:"Skill Gap", tier:"Bandos", difficulty:"Hard",   xp:500, repeatable:false, requiresFn:(s)=>s.slayer<80, objective:"Reach 80 Slayer" },
  { id:"b_q_8",
    titleFn: (_s, _kc, questState) => themedQuestTitle("Master of Chains", questState, QUEST_SERIES_CAPSTONE_POOL),
    title:"Master of Chains",
    category:"Quest", tier:"Bandos", difficulty:"Hard", xp:550, repeatable:true,
    questPoolAnyOf: QUEST_SERIES_CAPSTONE_POOL.map(({ id }) => id),
    objectiveFn: (_s, _kc, questState) => themedQuestObjective("Complete an entire quest series from start to finish", questState, QUEST_SERIES_CAPSTONE_POOL),
    objective:"Complete an entire quest series from start to finish" },
  { id:"b_q_9", title:"Legends Bound",       category:"Quest", tier:"Bandos", difficulty:"Hard",   xp:575, repeatable:false, questCompleteAnyOf:["legends_quest"], objective:"Complete Legends' Quest" },
  { id:"b_q_10",
    titleFn: (_s, _kc, questState) => themedQuestTitle("Shadows of Morytania", questState, MYREQUE_QUEST_POOL),
    title:"Shadows of Morytania",
    category:"Quest", tier:"Bandos", difficulty:"Hard", xp:600, repeatable:true,
    questPoolAnyOf: MYREQUE_QUEST_POOL.map(({ id }) => id),
    objectiveFn: (_s, _kc, questState) => themedQuestObjective("Complete a Myreque quest from the current pool", questState, MYREQUE_QUEST_POOL),
    objective:"Complete a Myreque quest from the current pool" },
  { id:"b_q_11",
    titleFn: (_s, _kc, questState) => themedQuestTitle("Mountain March", questState, TROLL_QUEST_POOL),
    title:"Mountain March",
    category:"Quest", tier:"Bandos", difficulty:"Hard", xp:575, repeatable:true,
    questPoolAnyOf: TROLL_QUEST_POOL.map(({ id }) => id),
    objectiveFn: (_s, _kc, questState) => themedQuestObjective("Complete a troll-country quest from the current pool", questState, TROLL_QUEST_POOL),
    objective:"Complete a troll-country quest from the current pool" },
  ...BANDOS_SPECIFIC_QUEST_TASKS,

  { id:"b_sk_1",  title:"Combat Ready",
    category:"Skill Gap", tier:"Bandos", difficulty:"Hard", xp:600, repeatable:false,
    titleFn:(s)=>{ const combatSkills=["attack","strength","defence","ranged","magic"]; const low=[...combatSkills].sort((a,b)=>s[a]-s[b])[0]; return `Combat Ready: ${skillLabel(low)}`; },
    objectiveFn:(s)=>{ const combatSkills=["attack","strength","defence","ranged","magic"]; const low=[...combatSkills].sort((a,b)=>s[a]-s[b])[0]; return `Reach 90 in ${skillLabel(low)} (currently ${s[low]})`; },
    requiresFn:(s)=>["attack","strength","defence","ranged","magic"].some(sk=>s[sk]<90),
    objective:"Reach 90 in any combat stat" },
  { id:"b_sk_2",  title:"The Disciplined Crafter", category:"Skill Gap", tier:"Bandos", difficulty:"Medium", xp:375, repeatable:false,
    titleFn:(s)=>{ const sk=lowestProductionSkill(s); return `Disciplined: ${skillLabel(sk)}`; },
    objectiveFn:(s)=>{ const sk=lowestProductionSkill(s); return `Reach 75 in ${skillLabel(sk)} — your lowest production skill at ${s[sk]}`; },
    requiresFn:(s)=>PRODUCTION.some(sk=>s[sk]<75), objective:"Reach 75 in any production skill" },
  { id:"b_sk_3",  title:"Runecraft Reckoning II", category:"Skill Gap", tier:"Bandos", difficulty:"Hard",   xp:550, repeatable:false, requiresFn:(s)=>s.runecrafting<65, objective:"Reach 65 Runecrafting" },
  { id:"b_sk_4",  title:"Fisher King",           category:"Skill Gap", tier:"Bandos", difficulty:"Medium", xp:375, repeatable:false, requiresFn:(s)=>s.fishing<76,      objective:"Reach 76 Fishing" },
  { id:"b_sk_5",  title:"The Sustained Miner",   category:"Endurance", tier:"Bandos", difficulty:"Hard",   xp:550, repeatable:true,  objective:"Mine 2000 ore total" },
  { id:"b_sk_6",  title:"Smith or Die",          category:"Skill Gap", tier:"Bandos", difficulty:"Hard",   xp:450, repeatable:true,  objective:"Smith 500 bars total" },
  { id:"b_sk_7",  title:"Herblore Discipline",   category:"Skill Gap", tier:"Bandos", difficulty:"Medium", xp:350, repeatable:false, requiresFn:(s)=>s.herblore<70, objective:"Reach 70 Herblore" },
  { id:"b_sk_8",  title:"Woodcutter's Burden",   category:"Skill Gap", tier:"Bandos", difficulty:"Medium", xp:375, repeatable:false, requiresFn:(s)=>s.woodcutting<75, objective:"Reach 75 Woodcutting" },
  { id:"b_sk_9",  title:"Economic Discipline",   category:"Economic",  tier:"Bandos", difficulty:"Hard",   xp:600, repeatable:true,  objective:"Earn 2M GP through non-combat methods" },
  { id:"b_sk_10", title:"Skill Mastery",
    category:"Skill Gap", tier:"Bandos", difficulty:"Hard", xp:550, repeatable:true,
    titleFn:(s)=>{ const sk=[...SKILLS].filter(x=>s[x]<80).sort((a,b)=>s[a]-s[b])[0]; return sk?`Skill Mastery: ${skillLabel(sk)}`:"Skill Mastery"; },
    objectiveFn:(s)=>{ const sk=[...SKILLS].filter(x=>s[x]<80).sort((a,b)=>s[a]-s[b])[0]; return sk?`Reach level 80 in ${skillLabel(sk)} (currently ${s[sk]})`:"Reach level 80 in any skill currently below 80"; },
    requiresFn:(s)=>SKILLS.some(sk=>s[sk]<80), objective:"Reach level 80 in any skill currently below 80" },
  { id:"b_sk_11", title:"Broadside Discipline", category:"Skill Gap", tier:"Bandos", difficulty:"Hard", xp:575, repeatable:false, requiresFn:(s)=>s.sailing<60, objective:"Reach 60 Sailing" },

  { id:"b_en_1", title:"The Iron Will",       category:"Endurance", tier:"Bandos", difficulty:"Hard",  xp:650, repeatable:true, objective:"Complete a 3-hour uninterrupted grind session" },
  { id:"b_en_2", title:"Slayer Dedicated",    category:"Endurance", tier:"Bandos", difficulty:"Medium",xp:350, repeatable:true, objective:"Complete 25 Slayer tasks total" },
  { id:"b_en_3", title:"Boss Marathon",       category:"Endurance", tier:"Bandos", difficulty:"Hard",  xp:650, repeatable:true, objective:"Kill the same boss 20 times in one session" },
  { id:"b_en_4", title:"The Grind Never Stops",category:"Endurance",tier:"Bandos", difficulty:"Hard",  xp:600, repeatable:true, objective:"Train any skill for 5 hours total across sessions" },
  { id:"b_en_5", title:"Wilderness Survivor", category:"Endurance", tier:"Bandos", difficulty:"Hard",  xp:650, repeatable:true, objective:"Kill 3 wilderness bosses without dying" },
  { id:"b_en_6", title:"Sustained Bossing",   category:"Endurance", tier:"Bandos", difficulty:"Hard",  xp:550, repeatable:true, objective:"Kill 3 different bosses in a single session" },
  { id:"b_en_7", title:"The Unbroken",        category:"Endurance", tier:"Bandos", difficulty:"Hard",  xp:575, repeatable:true, objective:"Complete 5 tasks in a row without deferring" },

  { id:"b_ex_1", title:"The Gauntlet Awaits", category:"Exploration", tier:"Bandos", difficulty:"Hard",   xp:600, repeatable:false, requiresFn:(_,kc)=>(kc.the_gauntlet??0)===0, objective:"Unlock and enter The Gauntlet" },
  { id:"b_ex_2", title:"Ancient Arsenal",     category:"Exploration", tier:"Bandos", difficulty:"Hard",   xp:525, repeatable:false, objective:"Unlock Ancient Magicks and cast 100 spells" },
  { id:"b_ex_3", title:"The Slayer Ascent",   category:"Exploration", tier:"Bandos", difficulty:"Medium", xp:300, repeatable:false, objective:"Unlock a new Slayer master" },
  { id:"b_ex_4", title:"Hard Clue Pursuit",   category:"Exploration", tier:"Bandos", difficulty:"Hard",   xp:550, repeatable:true,  objective:"Complete 3 Hard clue scrolls" },
  { id:"b_ex_5", title:"Bossman's Ledger",    category:"Exploration", tier:"Bandos", difficulty:"Hard",   xp:575, repeatable:true,  objective:"Fill 3 new Collection Log slots" },
  { id:"b_ex_6", title:"Rift Responder",      category:"Exploration", tier:"Bandos", difficulty:"Hard",   xp:525, repeatable:true,  requiresFn:(s,_kc,questState)=>s.runecrafting>=27 && hasCompletedAnyQuest(questState, ["temple_of_the_eye"]), objective:"Complete 3 Guardians of the Rift rounds" },
  { id:"b_ex_7", title:"Giant Commission",    category:"Exploration", tier:"Bandos", difficulty:"Hard",   xp:525, repeatable:true,  requiresFn:(s,_kc,questState)=>s.smithing>=15 && hasCompletedAnyQuest(questState, ["sleeping_giants"]), objective:"Complete 5 Giants' Foundry commissions" },
  ...HARD_DIARY_TASKS,

  // ══════════════ ZAMORAK ══════════════

  { id:"trial_70", category:"Trial", tier:"Zamorak", triggerLevel:70, difficulty:"Elite", xp:1000, repeatable:false, trial:true,
    titleFn: (s, kc) => { const pool=["vorkath","zulrah","cerberus","alchemical_hydra","grotesque_guardians"]; const boss=lowestKCBoss(kc, pool, s); return `Trial of Mettle: ${bossLabel(boss)}`; },
    title:"Trial of Mettle: Zamorak Proving",
    trialModifier:"Inventory limit (16 slots)",
    objectiveFn: (s, kc) => { const pool=["vorkath","zulrah","cerberus","alchemical_hydra","grotesque_guardians"]; const boss=lowestKCBoss(kc, pool, s); return `Defeat ${bossLabel(boss)} with modifier: Inventory limit (16 slots). ${kc[boss]??0} KC. Non-skippable.`; },
    objective:"Defeat a Zamorak-tier boss with modifier. Non-skippable." },
  { id:"trial_80", category:"Trial", tier:"Zamorak", triggerLevel:80, difficulty:"Elite", xp:1200, repeatable:false, trial:true,
    titleFn:(s,kc)=>{ const b=hardestUntouchedBoss(kc, s); return `Trial of Mettle: ${bossLabel(b)}`; },
    title:"Trial of Mettle: Endgame Boss",
    objectiveFn:(s,kc)=>{ const b=hardestUntouchedBoss(kc, s); return `Kill ${bossLabel(b)} — the hardest boss you've never touched. ${(kc[b]??0)} KC. Non-skippable.`; },
    objective:"Hardest uncompleted boss. Non-skippable." },

  { id:"z_pvm_1",  title:"Zulrah Tamed",          category:"PvM Endurance", tier:"Zamorak", difficulty:"Hard",   xp:650, repeatable:true,  objective:"Kill Zulrah 10 times" },
  { id:"z_pvm_2",  title:"Vorkath's Debt",         category:"PvM Intro",     tier:"Zamorak", difficulty:"Hard",   xp:700, repeatable:false, requiresFn:(_,kc)=>(kc.vorkath??0)===0, objective:"Kill Vorkath for the first time" },
  { id:"z_pvm_3",  title:"Vorkath Committed",      category:"PvM Endurance", tier:"Zamorak", difficulty:"Hard",   xp:700, repeatable:true,  objective:"Kill Vorkath 10 times" },
  { id:"z_pvm_4",  title:"Theatre Initiate",       category:"PvM Intro",     tier:"Zamorak", difficulty:"Hard",   xp:700, repeatable:false, requiresFn:(_,kc)=>(kc.theatre_of_blood??0)===0, objective:"Complete Theatre of Blood entry mode" },
  { id:"z_pvm_5",  title:"Chambers Regular",       category:"PvM Endurance", tier:"Zamorak", difficulty:"Hard",   xp:750, repeatable:true,  objective:"Complete 5 Chambers of Xeric runs" },
  { id:"z_pvm_6",  title:"The Grotesque",          category:"PvM Endurance", tier:"Zamorak", difficulty:"Medium", xp:500, repeatable:true,  objective:"Kill Grotesque Guardians 10 times" },
  { id:"z_pvm_7",  title:"Cerberus Unleashed",     category:"PvM Intro",     tier:"Zamorak", difficulty:"Hard",   xp:650, repeatable:false, requiresFn:(_,kc)=>(kc.cerberus??0)===0, objective:"Kill Cerberus for the first time" },
  { id:"z_pvm_8",  title:"Thermonuclear Trial",    category:"PvM Endurance", tier:"Zamorak", difficulty:"Medium", xp:500, repeatable:true,  objective:"Kill Thermonuclear Smoke Devil 10 times" },
  { id:"z_pvm_9",  title:"Alchemical Hydra",       category:"PvM Intro",     tier:"Zamorak", difficulty:"Hard",   xp:750, repeatable:false, requiresFn:(_,kc)=>(kc.alchemical_hydra??0)===0, objective:"Kill the Alchemical Hydra for the first time" },
  { id:"z_pvm_10", title:"Zamorak's Wrath",        category:"PvM Endurance", tier:"Zamorak", difficulty:"Hard",   xp:650, repeatable:true,  objective:"Kill K'ril Tsutsaroth 20 times" },
  { id:"z_pvm_11", title:"Wilderness Domination",  category:"PvM Endurance", tier:"Zamorak", difficulty:"Hard",   xp:700, repeatable:true,  objective:"Kill 5 different wilderness bosses total" },
  { id:"z_pvm_12", title:"Modified Combat",        category:"PvM Endurance", tier:"Zamorak", difficulty:"Elite",  xp:800, repeatable:true,
    titleFn:(s,kc)=>{ const gwd=["general_graardor","kreearra","kril_tsutsaroth","commander_zilyana","vorkath","zulrah","cerberus"]; const target=lowestKCBoss(kc, gwd, s); return `Modified Combat: ${bossLabel(target)}`; },
    objectiveFn:(s,kc)=>{ const gwd=["general_graardor","kreearra","kril_tsutsaroth","commander_zilyana","vorkath","zulrah","cerberus"]; const target=lowestKCBoss(kc, gwd, s); return `Kill ${bossLabel(target)} with a modifier active (${kc[target]??0} KC)`; },
    objective:"Complete any hard boss with a modifier active" },
  { id:"z_pvm_13", title:"The Sustained Killer",   category:"PvM Endurance", tier:"Zamorak", difficulty:"Hard",   xp:550, repeatable:true,
    titleFn:(s,kc)=>{ const gwd=["general_graardor","kreearra","kril_tsutsaroth","commander_zilyana"]; const target=lowestKCBoss(kc, gwd, s); return `Sustained: ${bossLabel(target)}`; },
    objectiveFn:(s,kc)=>{ const gwd=["general_graardor","kreearra","kril_tsutsaroth","commander_zilyana"]; const target=lowestKCBoss(kc, gwd, s); return `Kill ${bossLabel(target)} 3 times in one session (${kc[target]??0} KC)`; },
    objective:"Kill any GWD boss 3 times in one session" },
  { id:"z_pvm_14", title:"The Black Ledger",
    category:"PvM Intro", tier:"Zamorak", difficulty:"Hard", xp:725, repeatable:true,
    titleFn:(s,kc)=>{ const boss = lowestKCBoss(kc, KEY_BOSSES, s); return `The Black Ledger: ${bossLabel(boss)}`; },
    objectiveFn:(s,kc)=>{
      const boss = lowestKCBoss(kc, KEY_BOSSES, s);
      const current = kc[boss] ?? 0;
      return current === 0
        ? `Defeat ${bossLabel(boss)} for the first time — your ledger still shows 0 KC.`
        : `Return to ${bossLabel(boss)} — it remains your lowest KC boss at ${current}.`;
    },
    objective:"Face your lowest-KC boss anywhere on the account" },
  { id:"z_pvm_15", title:"Cruel Standards",       category:"PvM Endurance", tier:"Zamorak", difficulty:"Elite",  xp:850, repeatable:false, objective:"Complete 5 Elite Combat Achievement tasks" },
  ...ZAMORAK_SPECIFIC_BOSS_TASKS,

  { id:"z_q_1", title:"275 Quest Points",    category:"Quest", tier:"Zamorak", difficulty:"Hard",   xp:650, repeatable:false, questPointsTarget:275, objective:"Reach 275 QP" },
  { id:"z_q_2",
    titleFn: (_s, _kc, questState) => themedQuestTitle("The Grand Library", questState, MAJOR_UNLOCK_QUEST_POOL),
    title:"The Grand Library",
    category:"Quest", tier:"Zamorak", difficulty:"Hard", xp:700, repeatable:true,
    questPoolAnyOf: MAJOR_UNLOCK_QUEST_POOL.map(({ id }) => id),
    objectiveFn: (_s, _kc, questState) => themedQuestObjective("Complete 5 quests that each unlock a new area or spellbook", questState, MAJOR_UNLOCK_QUEST_POOL),
    objective:"Complete 5 quests that each unlock a new area or spellbook" },
  { id:"z_q_3",
    titleFn: (_s, _kc, questState) => themedQuestTitle("Zamorak's Path", questState, ZAMORAK_QUEST_POOL),
    title:"Zamorak's Path",
    category:"Quest", tier:"Zamorak", difficulty:"Hard", xp:650, repeatable:false,
    questPoolAnyOf: ZAMORAK_QUEST_POOL.map(({ id }) => id),
    objectiveFn: (_s, _kc, questState) => themedQuestObjective("Complete a Zamorak-aligned quest chain", questState, ZAMORAK_QUEST_POOL),
    objective:"Complete a Zamorak-aligned quest chain" },
  { id:"z_q_4", title:"Desert Accord",       category:"Quest", tier:"Zamorak", difficulty:"Hard",   xp:725, repeatable:false, questCompleteAnyOf:["beneath_cursed_sands"], objective:"Complete Beneath Cursed Sands" },
  { id:"z_q_5", title:"The Slayer Codex II", category:"Skill Gap", tier:"Zamorak", difficulty:"Hard",   xp:700, repeatable:false, requiresFn:(s)=>s.slayer<85, objective:"Reach 85 Slayer" },
  { id:"z_q_6",
    titleFn: (_s, _kc, questState) => themedQuestTitle("Master of Quests", questState, QUEST_SERIES_CAPSTONE_POOL),
    title:"Master of Quests",
    category:"Quest", tier:"Zamorak", difficulty:"Hard", xp:650, repeatable:true,
    questPoolAnyOf: QUEST_SERIES_CAPSTONE_POOL.map(({ id }) => id),
    objectiveFn: (_s, _kc, questState) => themedQuestObjective("Complete every quest in a single skill quest chain", questState, QUEST_SERIES_CAPSTONE_POOL),
    objective:"Complete every quest in a single skill quest chain" },
  { id:"z_q_7",
    titleFn: (_s, _kc, questState) => themedQuestTitle("The Zamorak Codex", questState, ZAMORAK_QUEST_POOL),
    title:"The Zamorak Codex",
    category:"Quest", tier:"Zamorak", difficulty:"Hard", xp:650, repeatable:true,
    questPoolAnyOf: ZAMORAK_QUEST_POOL.map(({ id }) => id),
    objectiveFn: (_s, _kc, questState) => themedQuestObjective("Complete a quest chain with a Zamorak-aligned NPC", questState, ZAMORAK_QUEST_POOL),
    objective:"Complete a quest chain with a Zamorak-aligned NPC" },
  { id:"z_q_8", title:"Chainbreaker",        category:"Quest", tier:"Zamorak", difficulty:"Hard",   xp:750, repeatable:true,  objective:"Complete 2 Master or Grandmaster quests" },
  { id:"z_q_9", title:"Crystal Testament",   category:"Quest", tier:"Zamorak", difficulty:"Elite",  xp:850, repeatable:false, questCompleteAnyOf:["song_of_the_elves"], objective:"Complete Song of the Elves" },
  { id:"z_q_10", title:"Night at the Cathedral", category:"Quest", tier:"Zamorak", difficulty:"Elite", xp:825, repeatable:false, questCompleteAnyOf:["sins_of_the_father"], objective:"Complete Sins of the Father" },
  { id:"z_q_11",
    titleFn: (_s, _kc, questState) => themedQuestTitle("Elven Reckoning", questState, ELVEN_QUEST_POOL),
    title:"Elven Reckoning",
    category:"Quest", tier:"Zamorak", difficulty:"Elite", xp:850, repeatable:true,
    questPoolAnyOf: ELVEN_QUEST_POOL.map(({ id }) => id),
    objectiveFn: (_s, _kc, questState) => themedQuestObjective("Complete an elven quest from the current pool", questState, ELVEN_QUEST_POOL),
    objective:"Complete an elven quest from the current pool" },
  { id:"z_q_12",
    titleFn: (_s, _kc, questState) => themedQuestTitle("Desert Dominion", questState, DESERT_EPIC_QUEST_POOL),
    title:"Desert Dominion",
    category:"Quest", tier:"Zamorak", difficulty:"Hard", xp:800, repeatable:true,
    questPoolAnyOf: DESERT_EPIC_QUEST_POOL.map(({ id }) => id),
    objectiveFn: (_s, _kc, questState) => themedQuestObjective("Complete a desert epic from the current pool", questState, DESERT_EPIC_QUEST_POOL),
    objective:"Complete a desert epic from the current pool" },
  ...ZAMORAK_SPECIFIC_QUEST_TASKS,

  { id:"z_sk_1",
    titleFn:(s)=>{ const sk=[...SKILLS].filter(x=>s[x]<85).sort((a,b)=>s[a]-s[b])[0]; return sk?`The 85 Club: ${skillLabel(sk)}`:"The 85 Club"; },
    title:"The 85 Club", category:"Skill Gap", tier:"Zamorak", difficulty:"Hard", xp:650, repeatable:true,
    objectiveFn:(s)=>{ const sk=[...SKILLS].filter(x=>s[x]<85).sort((a,b)=>s[a]-s[b])[0]; return sk?`Reach 85 in ${skillLabel(sk)} (currently ${s[sk]})`:"Reach 85 in any skill currently below 85"; },
    requiresFn:(s)=>SKILLS.some(sk=>s[sk]<85), objective:"Reach 85 in any skill currently below 85" },
  { id:"z_sk_2",  title:"Runecraft Mastery",     category:"Skill Gap", tier:"Zamorak", difficulty:"Elite",  xp:800, repeatable:false, requiresFn:(s)=>s.runecrafting<77, objective:"Reach 77 Runecrafting (Blood runes unlocked)" },
  { id:"z_sk_3",  title:"Herblore Advanced",     category:"Skill Gap", tier:"Zamorak", difficulty:"Elite",  xp:800, repeatable:false, requiresFn:(s)=>s.herblore<90,     objective:"Reach 90 Herblore" },
  { id:"z_sk_4",  title:"Agility Discipline",    category:"Skill Gap", tier:"Zamorak", difficulty:"Hard",   xp:650, repeatable:false, requiresFn:(s)=>s.agility<80,      objective:"Reach 80 Agility" },
  { id:"z_sk_5",
    titleFn:(s)=>{ const target = resolveWeeklyGrindTarget(s); return `The Relentless Grinder: ${skillLabel(target.skill)}`; },
    title:"The Relentless Grinder",
    category:"Endurance", tier:"Zamorak", difficulty:"Hard", xp:700, repeatable:true,
    objectiveFn:(s)=>{
      const target = resolveWeeklyGrindTarget(s);
      return target.unit === "xp"
        ? `Gain ${target.amount.toLocaleString()} XP in ${skillLabel(target.skill)} within one week (currently ${target.level})`
        : `Gain ${target.amount} levels in ${skillLabel(target.skill)} within one week (currently ${target.level})`;
    },
    objective:"Gain 10 levels in a single skill in one week" },
  { id:"z_sk_6",  title:"Construction Push",     category:"Skill Gap", tier:"Zamorak", difficulty:"Elite",  xp:800, repeatable:false, requiresFn:(s)=>s.construction<83, objective:"Reach 83 Construction" },
  { id:"z_sk_7",  title:"Thieving Mastery",      category:"Skill Gap", tier:"Zamorak", difficulty:"Hard",   xp:700, repeatable:false, requiresFn:(s)=>s.thieving<85,     objective:"Reach 85 Thieving" },
  { id:"z_sk_8",  title:"Hunter's Mark",         category:"Skill Gap", tier:"Zamorak", difficulty:"Hard",   xp:650, repeatable:false, requiresFn:(s)=>s.hunter<80,       objective:"Reach 80 Hunter" },
  { id:"z_sk_9",
    title:"Skill Reckoning", category:"Skill Gap", tier:"Zamorak", difficulty:"Elite", xp:800, repeatable:true,
    objectiveFn:(s)=>{ const below=SKILLS.filter(sk=>s[sk]<70); return below.length>0?`Bring every skill above 70 — still below: ${below.map(skillLabel).join(", ")}`:"Bring every skill above 70"; },
    requiresFn:(s)=>SKILLS.some(sk=>s[sk]<70), objective:"Bring every skill above 70" },
  { id:"z_sk_10",
    titleFn:(s)=>{ const sk=lowestSkill(s); return `Final Gap: ${skillLabel(sk)}`; },
    title:"The Final Gap", category:"Skill Gap", tier:"Zamorak", difficulty:"Elite", xp:800, repeatable:true,
    objectiveFn:(s)=>{
      const sk=lowestSkill(s);
      const avg=accountAverage(s);
      return formatAverageGapClosureObjective(sk, s[sk], avg, "Elite");
    },
    objective:"Close the largest remaining skill gap on your account" },
  { id:"z_sk_11", title:"Storm Reader", category:"Skill Gap", tier:"Zamorak", difficulty:"Hard", xp:825, repeatable:false, requiresFn:(s)=>s.sailing<75, objective:"Reach 75 Sailing" },

  { id:"z_en_1", title:"The Long Campaign",    category:"Endurance", tier:"Zamorak", difficulty:"Hard",   xp:700, repeatable:true, objective:"Complete 50 Slayer tasks total" },
  { id:"z_en_2", title:"Chaos Endurance",      category:"Endurance", tier:"Zamorak", difficulty:"Hard",   xp:700, repeatable:true, objective:"Kill any Zamorak-aligned boss 30 times total" },
  { id:"z_en_3", title:"Modified Grind",       category:"Endurance", tier:"Zamorak", difficulty:"Elite",  xp:850, repeatable:true, objective:"Complete 3 tasks with modifiers in a row" },
  { id:"z_en_4", title:"The Unrelenting",      category:"Endurance", tier:"Zamorak", difficulty:"Elite",  xp:950, repeatable:true, objective:"Complete a 5-hour grind session" },
  { id:"z_en_5", title:"Raid Regularity",      category:"Endurance", tier:"Zamorak", difficulty:"Hard",   xp:775, repeatable:true, objective:"Complete 10 raids total across any type" },
  { id:"z_en_6", title:"Wilderness Veteran",   category:"Endurance", tier:"Zamorak", difficulty:"Hard",   xp:750, repeatable:true, objective:"Survive 10 wilderness boss kills without dying" },
  { id:"z_en_7", title:"The Defer Collector",  category:"Endurance", tier:"Zamorak", difficulty:"Hard",   xp:700, repeatable:true, objective:"Clear all deferred tasks within a single tier" },
  { id:"z_en_8", title:"Streak Master",        category:"Endurance", tier:"Zamorak", difficulty:"Hard",   xp:725, repeatable:true, objective:"Complete 7 tasks in a row without deferring" },

  { id:"z_ex_1", title:"Theatre Unlocked",       category:"Exploration", tier:"Zamorak", difficulty:"Elite",  xp:900, repeatable:false, objective:"Complete Theatre of Blood entry mode with a modifier" },
  { id:"z_ex_2", title:"Tombs of Amascut",       category:"Exploration", tier:"Zamorak", difficulty:"Elite",  xp:900, repeatable:false, requiresFn:(_,kc)=>(kc.tombs_of_amascut??0)===0, objective:"Enter and complete Tombs of Amascut for the first time" },
  { id:"z_ex_3", title:"Slayer Dungeon Deep",    category:"Exploration", tier:"Zamorak", difficulty:"Hard",   xp:700, repeatable:true,  objective:"Complete a Slayer task in every major dungeon" },
  { id:"z_ex_4", title:"Ancient Secrets",        category:"Exploration", tier:"Zamorak", difficulty:"Elite",  xp:950, repeatable:false, questCompleteAnyOf:["desert_treasure_ii"], objective:"Complete Desert Treasure II" },
  { id:"z_ex_5", title:"Farming Mastery",        category:"Exploration", tier:"Zamorak", difficulty:"Hard",   xp:550, repeatable:false, objective:"Unlock the Farming Guild" },
  { id:"z_ex_6", title:"The Grand Exchange Gamble",category:"Economic",  tier:"Zamorak", difficulty:"Hard",   xp:700, repeatable:true,  objective:"Earn 5M GP through merching or flipping" },
  { id:"z_ex_7", title:"Elite Cartography",      category:"Exploration", tier:"Zamorak", difficulty:"Elite",  xp:900, repeatable:true,  objective:"Complete 2 Elite clue scrolls" },
  { id:"z_ex_8", title:"Black Ledger Growth",    category:"Exploration", tier:"Zamorak", difficulty:"Hard",   xp:800, repeatable:true,  objective:"Fill 5 new Collection Log slots" },
  { id:"z_ex_9", title:"Sepulchre Run",          category:"Exploration", tier:"Zamorak", difficulty:"Elite",  xp:900, repeatable:true,  requiresFn:(s,_kc,questState)=>s.agility>=52 && hasCompletedAnyQuest(questState, ["sins_of_the_father"]), objective:"Complete 1 Hallowed Sepulchre run" },
  { id:"z_ex_10", title:"Housing Orders",        category:"Exploration", tier:"Zamorak", difficulty:"Hard",   xp:775, repeatable:true,  requiresFn:(s)=>s.construction>=50, objective:"Complete 5 Mahogany Homes contracts" },

  // ══════════════ ZAROS ══════════════

  { id:"trial_90", category:"Trial", tier:"Zaros", triggerLevel:90, difficulty:"Elite", xp:1500, repeatable:false, trial:true,
    titleFn:(s,kc)=>{ const b=hardestUntouchedBoss(kc, s); return `Trial of Mettle: ${bossLabel(b)}`; },
    title:"Trial of Mettle: Elite Challenge",
    objectiveFn:(s,kc)=>{ const b=hardestUntouchedBoss(kc, s); return `Kill ${bossLabel(b)} — the ledger has spoken. ${(kc[b]??0)} KC. Non-skippable.`; },
    objective:"Highest-difficulty uncompleted boss. Non-skippable." },
  { id:"trial_99", title:"The Final Trial", category:"Trial", tier:"Zaros", triggerLevel:99, difficulty:"Elite", xp:2000, repeatable:false, trial:true, finalTrial:true, objective:"The series finale. Your path is revealed. Five tasks are drawn. You choose one." },

  { id:"zr_pvm_1",  title:"Vorkath Mastered",    category:"PvM Endurance", tier:"Zaros", difficulty:"Elite",  xp:1000, repeatable:true,  objective:"Kill Vorkath 50 times total" },
  { id:"zr_pvm_2",  title:"Zulrah Mastered",     category:"PvM Endurance", tier:"Zaros", difficulty:"Elite",  xp:1000, repeatable:true,  objective:"Kill Zulrah 50 times total" },
  { id:"zr_pvm_3",  title:"The Nightmare",       category:"PvM Intro",     tier:"Zaros", difficulty:"Elite",  xp:1100, repeatable:false, requiresFn:(_,kc)=>(kc.nightmare??0)===0, objective:"Kill the Nightmare for the first time" },
  { id:"zr_pvm_4",  title:"Nex Awakened",        category:"PvM Intro",     tier:"Zaros", difficulty:"Elite",  xp:1100, repeatable:false, requiresFn:(_,kc)=>(kc.nex??0)===0, objective:"Kill Nex for the first time" },
  { id:"zr_pvm_5",  title:"Phantom Muspah",      category:"PvM Endurance", tier:"Zaros", difficulty:"Elite",  xp:1000, repeatable:true,  objective:"Kill Phantom Muspah 10 times" },
  { id:"zr_pvm_6",  title:"One DT2 Boss",        category:"PvM Endurance", tier:"Zaros", difficulty:"Elite",  xp:1200, repeatable:true,
    titleFn:(s,kc)=>{ const dt2=["vardorvis","duke_sucellus","the_leviathan","the_whisperer"]; const low=lowestKCBoss(kc, dt2, s); return `DT2: ${bossLabel(low)}`; },
    objectiveFn:(s,kc)=>{ const dt2=["vardorvis","duke_sucellus","the_leviathan","the_whisperer"]; const low=lowestKCBoss(kc, dt2, s); return `Kill ${bossLabel(low)} 20 times (currently ${kc[low]??0} KC)`; },
    objective:"Kill any single DT2 boss 20 times (player's choice)" },
  { id:"zr_pvm_7",  title:"Chambers Master",     category:"PvM Endurance", tier:"Zaros", difficulty:"Elite",  xp:1200, repeatable:true,  objective:"Complete Chambers of Xeric 20 times" },
  { id:"zr_pvm_8",  title:"Theatre Master",      category:"PvM Endurance", tier:"Zaros", difficulty:"Elite",  xp:1200, repeatable:true,  objective:"Complete Theatre of Blood 10 times" },
  { id:"zr_pvm_9",  title:"The Gauntlet",        category:"PvM Endurance", tier:"Zaros", difficulty:"Elite",  xp:1000, repeatable:true,  objective:"Complete the Gauntlet or Corrupted Gauntlet" },
  { id:"zr_pvm_10", title:"Colosseum",           category:"PvM Intro",     tier:"Zaros", difficulty:"Elite",  xp:1400, repeatable:false, requiresFn:(_,kc)=>(kc.sol_heredit??0)===0, objective:"Attempt the Fortis Colosseum" },
  { id:"zr_pvm_11", title:"Master's Ledger",     category:"PvM Endurance", tier:"Zaros", difficulty:"Elite",  xp:1300, repeatable:false, objective:"Complete 3 Master or Grandmaster Combat Achievement tasks" },
  ...ZAROS_SPECIFIC_BOSS_TASKS,

  { id:"zr_q_3",
    titleFn: (_s, _kc, questState) => themedQuestTitle("The Last Chapter", questState, GRANDMASTER_QUEST_POOL),
    title:"The Last Chapter",
    category:"Quest", tier:"Zaros", difficulty:"Elite", xp:1000, repeatable:true,
    questPoolAnyOf: GRANDMASTER_QUEST_POOL.map(({ id }) => id),
    objectiveFn: (_s, _kc, questState) => themedQuestObjective("Complete any unfinished Grandmaster quest from the current pool", questState, GRANDMASTER_QUEST_POOL),
    objective:"Complete the final quest in any major quest chain" },
  { id:"zr_q_4",
    titleFn: (_s, _kc, questState) => themedQuestTitle("Zaros Ascendant", questState, ZAROS_QUEST_POOL),
    title:"Zaros Ascendant",
    category:"Quest", tier:"Zaros", difficulty:"Elite", xp:1000, repeatable:false,
    questPoolAnyOf: ZAROS_QUEST_POOL.map(({ id }) => id),
    objectiveFn: (_s, _kc, questState) => themedQuestObjective("Complete a quest that unlocks Zaros-aligned content", questState, ZAROS_QUEST_POOL),
    objective:"Complete a quest that unlocks Zaros-aligned content" },
  { id:"zr_q_5", title:"Quest Cape",         category:"Quest",       tier:"Zaros", difficulty:"Elite",  xp:1800, repeatable:false, landmark:true, requiresQuestCape:true, objective:"Complete all quests" },
  { id:"zr_q_6", title:"Three Hundred Points", category:"Quest",     tier:"Zaros", difficulty:"Elite",  xp:1200, repeatable:false, questPointsTarget:300, objective:"Reach 300 quest points" },
  { id:"zr_q_7", title:"Guthix Awakens",        category:"Quest",    tier:"Zaros", difficulty:"Elite",  xp:1200, repeatable:false, questCompleteAnyOf:["while_guthix_sleeps"], objective:"Complete While Guthix Sleeps" },
  { id:"zr_q_8",
    titleFn: (_s, _kc, questState) => themedQuestTitle("The Last Great Quest", questState, GRANDMASTER_QUEST_POOL),
    title:"The Last Great Quest",
    category:"Quest", tier:"Zaros", difficulty:"Elite", xp:1300, repeatable:true,
    questPoolAnyOf: GRANDMASTER_QUEST_POOL.map(({ id }) => id),
    objectiveFn: (_s, _kc, questState) => themedQuestObjective("Complete one of the remaining great quests in the current pool", questState, GRANDMASTER_QUEST_POOL),
    objective:"Complete one of the remaining great quests in the current pool" },
  ...ZAROS_SPECIFIC_QUEST_TASKS,

  { id:"zr_sk_1", title:"The 90 Club",
    category:"Skill Gap", tier:"Zaros", difficulty:"Elite", xp:1000, repeatable:false,
    titleFn:(s)=>{ const combatSkills=["attack","strength","defence","ranged","magic"]; const low=[...combatSkills].filter(x=>s[x]<90).sort((a,b)=>s[a]-s[b])[0]; return low?`The 90 Club: ${skillLabel(low)}`:"The 90 Club"; },
    objectiveFn:(s)=>{ const combatSkills=["attack","strength","defence","ranged","magic"]; const below=[...combatSkills].filter(x=>s[x]<90); return below.length>0?`Reach 90 in every combat stat — still below: ${below.map(k=>`${skillLabel(k)} (${s[k]})`).join(", ")}`:"Reach 90 in every combat stat"; },
    requiresFn:(s)=>["attack","strength","defence","ranged","magic"].some(sk=>s[sk]<90), objective:"Reach 90 in every combat stat" },
  { id:"zr_sk_2", title:"Completionist's Path", category:"Skill Gap", tier:"Zaros", difficulty:"Elite", xp:1300, repeatable:true,
    titleFn:(s)=>{ const sk=[...SKILLS].filter(x=>s[x]<99).sort((a,b)=>s[a]-s[b])[0]; return sk?`First 99: ${skillLabel(sk)}`:"First 99"; },
    objectiveFn:(s)=>{ const sk=[...SKILLS].filter(x=>s[x]<99).sort((a,b)=>s[a]-s[b])[0]; return sk?`Reach level 99 in ${skillLabel(sk)} (currently ${s[sk]})`:"Reach level 99 in any skill"; },
    objective:"Reach level 99 in any skill" },
  { id:"zr_sk_3", title:"The Final Discipline",
    category:"Skill Gap", tier:"Zaros", difficulty:"Elite", xp:1000, repeatable:true,
    objectiveFn:(s)=>{ const below=SKILLS.filter(sk=>s[sk]<80); return below.length>0?`Raise every skill above 80 — still below: ${below.map(skillLabel).join(", ")}`:"Raise every skill above 80"; },
    requiresFn:(s)=>SKILLS.some(sk=>s[sk]<80), objective:"Raise every skill above 80" },
  { id:"zr_sk_4", title:"Runecraft Pinnacle",   category:"Skill Gap", tier:"Zaros", difficulty:"Elite",  xp:1000, repeatable:false, requiresFn:(s)=>s.runecrafting<91, objective:"Reach 91 Runecrafting" },
  { id:"zr_sk_5", title:"Herblore Pinnacle",    category:"Skill Gap", tier:"Zaros", difficulty:"Elite",  xp:1000, repeatable:false, requiresFn:(s)=>s.herblore<94,     objective:"Reach 94 Herblore" },
  { id:"zr_sk_6", title:"Total Mastery",        category:"Skill Gap", tier:"Zaros", difficulty:"Elite",  xp:1300, repeatable:false, objective:"Reach 1900 total level" },
  { id:"zr_sk_7", title:"The Last Gap",
    titleFn:(s)=>{ const sk=lowestSkill(s); return `Last Gap: ${skillLabel(sk)}`; },
    category:"Skill Gap", tier:"Zaros", difficulty:"Elite", xp:1000, repeatable:true,
    objectiveFn:(s)=>{
      const sk=lowestSkill(s);
      const avg=accountAverage(s);
      return formatAverageGapClosureObjective(sk, s[sk], avg, "Elite");
    },
    objective:"Eliminate the single largest remaining skill gap" },
  { id:"zr_sk_8", title:"Master Mariner", category:"Skill Gap", tier:"Zaros", difficulty:"Elite", xp:1200, repeatable:false, requiresFn:(s)=>s.sailing<90, objective:"Reach 90 Sailing" },

  { id:"zr_en_1", title:"The Final Campaign",     category:"Endurance", tier:"Zaros", difficulty:"Elite",  xp:1300, repeatable:true, objective:"Complete 100 Slayer tasks total" },
  { id:"zr_en_2", title:"Elite Endurance",        category:"Endurance", tier:"Zaros", difficulty:"Elite",  xp:1300, repeatable:true, objective:"Complete the Corrupted Gauntlet 5 times" },
  { id:"zr_en_3", title:"Mastery Under Pressure", category:"Endurance", tier:"Zaros", difficulty:"Elite",  xp:1350, repeatable:true, objective:"Complete 3 hard boss tasks with modifiers in a row" },
  { id:"zr_en_4", title:"The Unbreakable",        category:"Endurance", tier:"Zaros", difficulty:"Elite",  xp:1300, repeatable:true, objective:"Complete 10 tasks in a row without deferring" },
  { id:"zr_en_5", title:"Raid Veteran",           category:"Endurance", tier:"Zaros", difficulty:"Elite",  xp:1450, repeatable:true, objective:"Complete 50 raids total" },

  { id:"zr_ex_1", title:"The Wilderness Throne", category:"Exploration", tier:"Zaros", difficulty:"Elite",  xp:1000, repeatable:true,  objective:"Kill Artio, Spindel, and Calvar'ion at least once each" },
  { id:"zr_ex_3", title:"The Final Frontier",    category:"Exploration", tier:"Zaros", difficulty:"Elite",  xp:1200, repeatable:true,  objective:"Unlock and enter every major endgame area" },
  { id:"zr_ex_4", title:"Master's Trail",        category:"Exploration", tier:"Zaros", difficulty:"Elite",  xp:1200, repeatable:true,  objective:"Complete 1 Master clue scroll" },
  { id:"zr_ex_5", title:"Completionist's Ledger",category:"Exploration", tier:"Zaros", difficulty:"Elite",  xp:1300, repeatable:true,  objective:"Fill 8 new Collection Log slots" },
  { id:"zr_ex_6", title:"Crystal Furnace",       category:"Exploration", tier:"Zaros", difficulty:"Elite",  xp:1100, repeatable:false, requiresFn:(s,kc,questState)=>s.mining>=70 && s.smithing>=70 && hasCompletedAnyQuest(questState, ["song_of_the_elves"]) && (kc.zalcano??0)===0, objective:"Defeat Zalcano" },
  { id:"zr_ex_7", title:"Hespori Harvest",      category:"Exploration", tier:"Zaros", difficulty:"Elite",  xp:1000, repeatable:false, requiresFn:(s,kc)=>s.farming>=65 && (kc.hespori??0)===0, objective:"Defeat Hespori" },
  ...ELITE_DIARY_TASKS,
];

// ─────────────────────────────────────────────
// FORK TASKS — standalone events, not in draft pool
// ─────────────────────────────────────────────
