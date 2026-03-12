"use client";
import { useState, useEffect } from "react";

const SKILLS = [
  "attack","strength","defence","ranged","magic","prayer",
  "runecrafting","construction","hitpoints","agility","herblore",
  "thieving","crafting","fletching","slayer","hunter","mining",
  "smithing","fishing","cooking","firemaking","woodcutting","farming","sailing"
];

const KEY_BOSSES = [
  "abyssal_sire","alchemical_hydra","amoxliatl","araxxor","artio",
  "barrows_chests","brutus","bryophyta","callisto","calvarion",
  "cerberus","chambers_of_xeric","chambers_of_xeric_challenge_mode",
  "chaos_elemental","chaos_fanatic","commander_zilyana","corporeal_beast",
  "crazy_archaeologist","dagannoth_prime","dagannoth_rex","dagannoth_supreme",
  "deranged_archaeologist","doom_of_mokhaiotl","duke_sucellus","general_graardor",
  "giant_mole","grotesque_guardians","hespori","kalphite_queen",
  "king_black_dragon","kraken","kreearra","kril_tsutsaroth","lunar_chests",
  "mimic","nex","nightmare","phosanis_nightmare","obor","phantom_muspah",
  "sarachnis","scorpia","scurrius","shellbane_gryphon","skotizo","sol_heredit",
  "spindel","tempoross","the_corrupted_gauntlet","the_gauntlet","the_hueycoatl",
  "the_leviathan","the_royal_titans","the_whisperer","theatre_of_blood",
  "theatre_of_blood_hard_mode","thermonuclear_smoke_devil","tombs_of_amascut",
  "tombs_of_amascut_expert","tzkal_zuk","tztok_jad","vardorvis","venenatis",
  "vetion","vorkath","wintertodt","yama","zalcano","zulrah"
];

const GUTHIX_BOSSES = ["obor","bryophyta","giant_mole","sarachnis","barrows_chests","chaos_fanatic","crazy_archaeologist","scorpia"];
const SKILLING = ["runecrafting","construction","agility","herblore","thieving","crafting","fletching","hunter","mining","smithing","fishing","cooking","firemaking","woodcutting","farming","sailing"];
const PRODUCTION = ["herblore","crafting","fletching","smithing","cooking","firemaking"];

// Bosses ranked by difficulty (hardest first) for dynamic trial resolution
const BOSS_BANDS = [
  ["tzkal_zuk","sol_heredit","the_whisperer"],
  ["the_leviathan","duke_sucellus","vardorvis"],
  ["nex","nightmare","phosanis_nightmare"],
  ["the_corrupted_gauntlet","the_gauntlet"],
  ["tombs_of_amascut_expert","tombs_of_amascut"],
  ["theatre_of_blood_hard_mode","theatre_of_blood"],
  ["chambers_of_xeric_challenge_mode","chambers_of_xeric"],
  ["alchemical_hydra","cerberus","grotesque_guardians","thermonuclear_smoke_devil"],
  ["vorkath","zulrah","araxxor","phantom_muspah"],
  ["corporeal_beast","kalphite_queen","commander_zilyana","general_graardor","kreearra","kril_tsutsaroth"],
  ["dagannoth_prime","dagannoth_rex","dagannoth_supreme"],
  ["sarachnis","giant_mole","barrows_chests","obor","bryophyta"]
];

// Returns the hardest untouched boss within a randomized difficulty band
function hardestUntouchedBoss(bossKC) {
  for (const band of BOSS_BANDS) {
    const untouched = band.filter(b => (bossKC[b] ?? 0) === 0);
    if (untouched.length > 0) return untouched[Math.floor(Math.random() * untouched.length)];
  }
  return BOSS_BANDS[0][0];
}

// Roll a modifier for a writ during draft (30-40% chance)
function rollModifier(writ) {
  if (Math.random() > 0.35) return null; // ~35% chance
  let pool;
  if (["PvM Intro","PvM Endurance"].includes(writ.category)) pool = COMBAT_MODIFIERS;
  else if (["Skill Gap","Economic"].includes(writ.category)) pool = SKILLING_MODIFIERS;
  else if (["Endurance"].includes(writ.category)) pool = [...SKILLING_MODIFIERS, ...ACCOUNT_MODIFIERS];
  else if (["Quest","Exploration"].includes(writ.category)) pool = ACCOUNT_MODIFIERS;
  else pool = ACCOUNT_MODIFIERS;
  return pool[Math.floor(Math.random() * pool.length)];
}

const XP_BREAKPOINTS = [
  { xp:0,     level:1  },
  { xp:2000,  level:20 },
  { xp:7000,  level:40 },
  { xp:17000, level:60 },
  { xp:37000, level:80 },
  { xp:67000, level:99 },
];

// ─────────────────────────────────────────────
// MODIFIER POOLS (for Reckoning Writs)
// ─────────────────────────────────────────────
const COMBAT_MODIFIERS = ["No food","No overhead prayers","Gear cap (max Rune)","Inventory limit (16 slots)","Time limit (15 min)","No potions","No special attacks","Protection prayers disabled","No safespots","Weapon locked after entering fight","Must equip one cosmetic item","Max 1 teleport item"];
const SKILLING_MODIFIERS = ["No teleporting","No banking","Ironman-style gathering","Limited inventory (16 slots)","Tool downgrade (steel tier)","No stamina potions","Must process gathered resources","Randomized resource order"];
const ACCOUNT_MODIFIERS = ["Must complete in one session","Must stream the attempt","Viewer-chosen gear","Hardcore attempt (fail = reset)","Complete within 2 hours","Random equipment slot locked"];

const REMOVE_MODIFIER_COST = 3;
const REROLL_COST = 2;
const EXTRA_CHOICE_COST = 5;

const METTLE_UNLOCKS = [
  { level: 10, unlock: "Trials" },
  { level: 20, unlock: "Draft (3 options)" },
  { level: 40, unlock: "Endurance Writs" },
  { level: 60, unlock: "Elite modifiers" },
  { level: 80, unlock: "Mythic pressure" },
];

const TIER_SEAL_REWARDS = { Guthix: 1, Saradomin: 2, Bandos: 3, Zamorak: 4, Zaros: 5 };

function getModifierForCategory(category, severity) {
  let pool;
  if (["PvM Intro","PvM Endurance"].includes(category)) pool = COMBAT_MODIFIERS;
  else if (["Skill Gap","Economic"].includes(category)) pool = SKILLING_MODIFIERS;
  else if (["Endurance"].includes(category)) pool = [...SKILLING_MODIFIERS, ...ACCOUNT_MODIFIERS];
  else pool = [...ACCOUNT_MODIFIERS, ...SKILLING_MODIFIERS];

  // Higher severity = pick from harder end of pool
  const idx = Math.min(Math.floor(severity * pool.length * 0.6), pool.length - 1);
  return pool[idx];
}

function sealsForWrit(writ) {
  return TIER_SEAL_REWARDS[writ?.tier] ?? 1;
}

function modifierXpBonus(writ) {
  if (!writ) return 0;
  const modifierCount = (writ.modifier ? 1 : 0) + (writ.trialModifier ? 1 : 0);
  if (modifierCount === 0) return 0;
  return Math.max(25, Math.round((writ.xp ?? 0) * 0.25 * modifierCount));
}

function writXp(writ) {
  return (writ?.xp ?? 0) + modifierXpBonus(writ);
}

function streakSealBonus(streak) {
  if (streak > 0 && streak % 10 === 0) return 5;
  if (streak > 0 && streak % 5 === 0) return 2;
  if (streak > 0 && streak % 3 === 0) return 1;
  return 0;
}

function unlockedFeatures(level) {
  return METTLE_UNLOCKS.filter(x => level >= x.level);
}

// ─────────────────────────────────────────────
// DYNAMIC OBJECTIVE HELPERS
// ─────────────────────────────────────────────

function lowestSkill(skillLevels, exclude = []) {
  return [...SKILLS]
    .filter(s => !exclude.includes(s))
    .sort((a,b) => skillLevels[a] - skillLevels[b])[0];
}

function lowestNSkills(skillLevels, n, onlySkilling = false) {
  const pool = onlySkilling ? SKILLING : SKILLS;
  return [...pool].sort((a,b) => skillLevels[a] - skillLevels[b]).slice(0, n);
}

function lowestProductionSkill(skillLevels) {
  return [...PRODUCTION].sort((a,b) => skillLevels[a] - skillLevels[b])[0];
}

function lowestKCBoss(bossKC, eligibleBosses) {
  const zeroes = eligibleBosses.filter(b => (bossKC[b] ?? 0) === 0);
  if (zeroes.length > 0) return zeroes[Math.floor(Math.random() * zeroes.length)];
  return eligibleBosses.sort((a,b) => (bossKC[a]??0) - (bossKC[b]??0))[0];
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function bossLabel(b) { return b.replace(/_/g," ").replace(/\b\w/g, c => c.toUpperCase()); }
function skillLabel(s) { return cap(s); }

function resolveObjective(writ, skillLevels, bossKC) {
  if (writ.objectiveFn) return writ.objectiveFn(skillLevels, bossKC);
  return writ.objective;
}

function resolveTitle(writ, skillLevels, bossKC) {
  if (writ.titleFn) return writ.titleFn(skillLevels, bossKC);
  return writ.title;
}

function meetsRequirements(writ, skillLevels, bossKC) {
  if (writ.requiresFn) return writ.requiresFn(skillLevels, bossKC);
  return true;
}

// ─────────────────────────────────────────────
// WRIT POOL — all 5 tiers
// ─────────────────────────────────────────────
const WRIT_POOL = [

  // ══════════════ GUTHIX ══════════════

  // Trials — dynamically resolved against account state
  { id:"trial_10", category:"Trial", tier:"Guthix", triggerLevel:10, difficulty:"Hard", xp:500, repeatable:false, trial:true,
    trialPool: ["obor","bryophyta","scurrius","giant_mole"],
    titleFn: (_s, kc) => { const pool=["obor","bryophyta","scurrius","giant_mole"]; const target=pool.filter(b=>(kc[b]??0)===0); const boss=target.length>0?target[Math.floor(Math.random()*target.length)]:pool[0]; return `Trial of Mettle: ${bossLabel(boss)}`; },
    title:"Trial of Mettle: First Real Boss",
    objectiveFn: (_s, kc) => { const pool=["obor","bryophyta","scurrius","giant_mole"]; const target=pool.filter(b=>(kc[b]??0)===0); const boss=target.length>0?target[Math.floor(Math.random()*target.length)]:pool[0]; return `Defeat ${bossLabel(boss)} — your first real boss test. ${(kc[boss]??0)} KC. Non-skippable.`; },
    objective:"Defeat an entry-level boss. Non-skippable." },
  { id:"trial_20", category:"Trial", tier:"Guthix", triggerLevel:20, difficulty:"Hard", xp:600, repeatable:false, trial:true,
    titleFn: (_s, kc) => { const pool=GUTHIX_BOSSES; const sorted=[...pool].sort((a,b)=>(kc[a]??0)-(kc[b]??0)); return `Trial of Mettle: ${bossLabel(sorted[0])}`; },
    title:"Trial of Mettle: Guthix Endurance",
    objectiveFn: (_s, kc) => { const pool=GUTHIX_BOSSES; const sorted=[...pool].sort((a,b)=>(kc[a]??0)-(kc[b]??0)); const boss=sorted[0]; return `Kill ${bossLabel(boss)} 3 times — your lowest KC Guthix boss at ${kc[boss]??0} KC. Non-skippable.`; },
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
    titleFn: (_s, kc) => { const b = lowestKCBoss(kc, GUTHIX_BOSSES); return `First Blood: ${bossLabel(b)}`; },
    title:"Boss Hunter",
    category:"PvM Intro", tier:"Guthix", difficulty:"Medium", xp:200, repeatable:true,
    objectiveFn: (_s, kc) => { const b = lowestKCBoss(kc, GUTHIX_BOSSES); return `Kill ${bossLabel(b)} — you have 0 KC. Face it.`; },
    objective:"Kill any boss you have 0 KC on" },

  // Quest (7)
  { id:"g_q_1", title:"The Forgotten Path",  category:"Quest", tier:"Guthix", difficulty:"Medium", xp:200, repeatable:true,  objective:"Complete 3 unfinished quests" },
  { id:"g_q_2", title:"Knowledge Seeker",    category:"Quest", tier:"Guthix", difficulty:"Easy",   xp:100, repeatable:true,  objective:"Gain 10 quest points" },
  { id:"g_q_3", title:"Guild Access",         category:"Exploration", tier:"Guthix", difficulty:"Easy", xp:75, repeatable:false, objective:"Unlock a new guild" },
  { id:"g_q_4", title:"Ancient Knowledge",   category:"Quest", tier:"Guthix", difficulty:"Medium", xp:200, repeatable:false, objective:"Complete a quest that unlocks a spellbook" },
  { id:"g_q_5", title:"Mastery of Travel",   category:"Quest", tier:"Guthix", difficulty:"Easy",   xp:100, repeatable:false, objective:"Complete a quest that unlocks a major teleport method" },
  { id:"g_q_6", title:"Story of Balance",    category:"Quest", tier:"Guthix", difficulty:"Medium", xp:150, repeatable:false, objective:"Complete a Guthix-aligned quest" },
  { id:"g_q_7", title:"Unfinished Business", category:"Quest", tier:"Guthix", difficulty:"Easy",   xp:75,  repeatable:false, objective:"Complete the oldest incomplete quest on your account" },

  // Skill Gap (10)
  { id:"g_sk_1",
    titleFn: (s) => `Weakest Link: ${skillLabel(lowestSkill(s))}`,
    title:"Weakest Link",
    category:"Skill Gap", tier:"Guthix", difficulty:"Easy", xp:75, repeatable:true,
    objectiveFn: (s) => { const sk = lowestSkill(s); return `Gain 3 levels in ${skillLabel(sk)} (your lowest skill at ${s[sk]})`; },
    objective:"Gain 3 levels in your lowest skill" },

  { id:"g_sk_2",
    titleFn: (s) => { const skills = lowestNSkills(s, 5); return `Balanced Growth: ${skills.map(skillLabel).join(", ")}`; },
    title:"Balanced Growth",
    category:"Skill Gap", tier:"Guthix", difficulty:"Easy", xp:100, repeatable:true,
    objectiveFn: (s) => { const skills = lowestNSkills(s, 5); return `Gain 1 level in each: ${skills.map(k => `${skillLabel(k)} (${s[k]})`).join(", ")}`; },
    objective:"Gain 1 level in five different skills" },

  { id:"g_sk_3",
    titleFn: (s) => `Artisan's Trial: ${skillLabel(lowestProductionSkill(s))}`,
    title:"Artisan's Trial",
    category:"Skill Gap", tier:"Guthix", difficulty:"Medium", xp:150, repeatable:true,
    objectiveFn: (s) => { const sk = lowestProductionSkill(s); return `Gain 5 levels in ${skillLabel(sk)} — your lowest production skill at ${s[sk]}`; },
    objective:"Gain 5 levels in any production skill" },

  { id:"g_sk_4",  title:"Gatherer's Path",      category:"Skill Gap", tier:"Guthix", difficulty:"Easy",   xp:75,  repeatable:true,  objective:"Collect 500 of any raw resource" },
  { id:"g_sk_5",  title:"The Grind Begins",     category:"Endurance", tier:"Guthix", difficulty:"Easy",   xp:75,  repeatable:true,  objective:"Train any skill for one continuous hour" },
  { id:"g_sk_6",  title:"Tool Upgrade",          category:"Skill Gap", tier:"Guthix", difficulty:"Easy",   xp:75,  repeatable:false, objective:"Craft or acquire an upgraded skilling tool" },
  { id:"g_sk_7",  title:"Artisan Contract",     category:"Skill Gap", tier:"Guthix", difficulty:"Easy",   xp:100, repeatable:true,  objective:"Produce 100 items of any craftable" },

  { id:"g_sk_8",
    titleFn: (s) => `Skill Breakthrough: ${skillLabel(lowestSkill(s))}`,
    title:"Skill Breakthrough",
    category:"Skill Gap", tier:"Guthix", difficulty:"Medium", xp:150, repeatable:true,
    objectiveFn: (s) => { const sk = lowestSkill(s); const avg = accountAverage(s); return `Raise ${skillLabel(sk)} above your account average (currently ${s[sk]} vs avg ${avg.toFixed(0)})`; },
    objective:"Raise a skill above your account average" },

  { id:"g_sk_9",
    titleFn: (s) => { const sk = lowestSkill(s, ["attack","strength","defence","hitpoints","ranged","magic","prayer","slayer"]); return `Neglected: ${skillLabel(sk)}`; },
    title:"Neglected Discipline",
    category:"Skill Gap", tier:"Guthix", difficulty:"Medium", xp:150, repeatable:true,
    objectiveFn: (s) => { const sk = lowestSkill(s, ["attack","strength","defence","hitpoints","ranged","magic","prayer","slayer"]); return `Train ${skillLabel(sk)} by 5 levels — your lowest non-combat skill at ${s[sk]}`; },
    objective:"Train your lowest non-combat skill by 5 levels" },

  { id:"g_sk_10", title:"Economic Insight", category:"Economic", tier:"Guthix", difficulty:"Easy", xp:100, repeatable:true, objective:"Earn 250k GP from skilling" },

  // Exploration (5)
  { id:"g_ex_1", title:"The Deep",         category:"Exploration", tier:"Guthix", difficulty:"Easy",   xp:75,  repeatable:false, objective:"Enter Kalphite Lair" },
  { id:"g_ex_2", title:"Frozen Frontier",  category:"Exploration", tier:"Guthix", difficulty:"Easy",   xp:75,  repeatable:false, objective:"Reach God Wars Dungeon" },
  { id:"g_ex_3", title:"Ancient Treasure", category:"Exploration", tier:"Guthix", difficulty:"Medium", xp:150, repeatable:true,  objective:"Open 5 clue scroll caskets" },
  { id:"g_ex_4", title:"The Unknown",      category:"Exploration", tier:"Guthix", difficulty:"Easy",   xp:75,  repeatable:true,  objective:"Visit three areas you have never entered before" },
  { id:"g_ex_5", title:"Merchant's Trial", category:"Economic",   tier:"Guthix", difficulty:"Easy",   xp:100, repeatable:true,  objective:"Flip or trade items for profit" },

  // Endurance (5)
  { id:"g_en_1", title:"Slayer's Commitment", category:"Endurance", tier:"Guthix", difficulty:"Easy",   xp:100, repeatable:true, objective:"Complete two Slayer tasks in a row" },
  { id:"g_en_2", title:"Dungeon Marathon",    category:"Endurance", tier:"Guthix", difficulty:"Medium", xp:200, repeatable:true, objective:"Kill 200 monsters in a single dungeon" },
  { id:"g_en_3", title:"Focused Training",    category:"Endurance", tier:"Guthix", difficulty:"Medium", xp:150, repeatable:true, objective:"Train one skill for 90 uninterrupted minutes" },
  { id:"g_en_4", title:"Resource Run",        category:"Endurance", tier:"Guthix", difficulty:"Medium", xp:150, repeatable:true, objective:"Gather 1000 resources of any type" },
  { id:"g_en_5", title:"Hunter's Path",       category:"Endurance", tier:"Guthix", difficulty:"Medium", xp:200, repeatable:true, objective:"Kill 300 monsters without leaving an area" },

  // ══════════════ SARADOMIN ══════════════

  { id:"trial_30", category:"Trial", tier:"Saradomin", triggerLevel:30, difficulty:"Hard", xp:700, repeatable:false, trial:true,
    titleFn: (_s, kc) => { const pool=["tztok_jad","barrows_chests","scorpia","chaos_fanatic"]; const zero=pool.filter(b=>(kc[b]??0)===0); if(zero.includes("tztok_jad")) return "Trial of Mettle: The Fire Cape"; const boss=zero.length>0?zero[0]:pool[0]; return `Trial of Mettle: ${bossLabel(boss)}`; },
    title:"Trial of Mettle: Saradomin Proving",
    objectiveFn: (_s, kc) => { const pool=["tztok_jad","barrows_chests","scorpia","chaos_fanatic"]; const zero=pool.filter(b=>(kc[b]??0)===0); if(zero.includes("tztok_jad")) return "Obtain the Fire Cape from TzTok-Jad. Non-skippable."; const boss=zero.length>0?zero[0]:pool[0]; return `Defeat ${bossLabel(boss)} — untouched at ${kc[boss]??0} KC. Non-skippable.`; },
    objective:"A Saradomin-tier proving. Non-skippable." },
  { id:"trial_40", category:"Trial", tier:"Saradomin", triggerLevel:40, difficulty:"Hard", xp:800, repeatable:false, trial:true,
    titleFn: (_s, kc) => { const pool=["zulrah","dagannoth_rex","dagannoth_prime","dagannoth_supreme","sarachnis"]; const zero=pool.filter(b=>(kc[b]??0)===0); if(zero.includes("zulrah")) return "Trial of Mettle: First Zulrah Kill"; const boss=zero.length>0?zero[0]:pool[0]; return `Trial of Mettle: ${bossLabel(boss)}`; },
    title:"Trial of Mettle: Mechanical Boss",
    objectiveFn: (_s, kc) => { const pool=["zulrah","dagannoth_rex","dagannoth_prime","dagannoth_supreme","sarachnis"]; const zero=pool.filter(b=>(kc[b]??0)===0); if(zero.includes("zulrah")) return "Kill Zulrah for the first time. Non-skippable."; const boss=zero.length>0?zero[0]:pool[0]; return `Kill ${bossLabel(boss)} — ${kc[boss]??0} KC. Non-skippable.`; },
    objective:"Mechanical boss introduction. Non-skippable." },

  { id:"s_pvm_1",  title:"The Gauntlet Begins",     category:"PvM Intro",     tier:"Saradomin", difficulty:"Medium", xp:250, repeatable:false, requiresFn:(_,kc)=>(kc.barrows_chests??0)<5, objective:"Complete 5 Barrows runs total" },
  { id:"s_pvm_2",  title:"First Blood (Dagannoth)",  category:"PvM Intro",     tier:"Saradomin", difficulty:"Medium", xp:250, repeatable:false, requiresFn:(_,kc)=>(kc.dagannoth_rex??0)===0||(kc.dagannoth_prime??0)===0||(kc.dagannoth_supreme??0)===0, objective:"Kill a Dagannoth Rex, Prime, or Supreme" },
  { id:"s_pvm_3",  title:"Sarachnis Awakens",        category:"PvM Intro",     tier:"Saradomin", difficulty:"Medium", xp:200, repeatable:false, requiresFn:(_,kc)=>(kc.sarachnis??0)===0, objective:"Defeat Sarachnis" },
  { id:"s_pvm_4",  title:"Mole Hunter",               category:"PvM Intro",     tier:"Saradomin", difficulty:"Easy",   xp:150, repeatable:false, requiresFn:(_,kc)=>(kc.giant_mole??0)===0, objective:"Defeat the Giant Mole" },
  { id:"s_pvm_5",  title:"Scorpia's Domain",          category:"PvM Intro",     tier:"Saradomin", difficulty:"Medium", xp:200, repeatable:false, requiresFn:(_,kc)=>(kc.scorpia??0)===0, objective:"Defeat Scorpia" },
  { id:"s_pvm_6",  title:"Chaos Fanatic",              category:"PvM Intro",     tier:"Saradomin", difficulty:"Easy",   xp:150, repeatable:false, requiresFn:(_,kc)=>(kc.chaos_fanatic??0)===0, objective:"Defeat the Chaos Fanatic" },
  { id:"s_pvm_7",  title:"Crazy Archaeologist",        category:"PvM Intro",     tier:"Saradomin", difficulty:"Easy",   xp:150, repeatable:false, requiresFn:(_,kc)=>(kc.crazy_archaeologist??0)===0, objective:"Defeat the Crazy Archaeologist" },
  { id:"s_pvm_8",  title:"Slayer Escalation",          category:"PvM Endurance", tier:"Saradomin", difficulty:"Medium", xp:300, repeatable:true,  objective:"Complete 5 Slayer tasks in a row without skipping" },
  { id:"s_pvm_9",  title:"The King's Court",           category:"PvM Intro",     tier:"Saradomin", difficulty:"Hard",   xp:400, repeatable:false, objective:"Obtain any Barrows item" },
  { id:"s_pvm_10", title:"Wilderness Contract",        category:"PvM Intro",     tier:"Saradomin", difficulty:"Medium", xp:250, repeatable:true,  objective:"Kill any wilderness boss once" },

  { id:"s_q_1", title:"The Long Road",        category:"Quest", tier:"Saradomin", difficulty:"Medium", xp:300, repeatable:false, objective:"Reach 200 quest points" },
  { id:"s_q_2", title:"Dragon Slayer",         category:"Quest", tier:"Saradomin", difficulty:"Medium", xp:250, repeatable:false, objective:"Complete Dragon Slayer I" },
  { id:"s_q_3", title:"Legends Bound",         category:"Quest", tier:"Saradomin", difficulty:"Hard",   xp:400, repeatable:false, objective:"Complete Legends' Quest" },
  { id:"s_q_4", title:"Piety Unlocked",        category:"Quest", tier:"Saradomin", difficulty:"Hard",   xp:400, repeatable:false, objective:"Complete the quest chain to unlock Piety" },
  { id:"s_q_5", title:"Desert Treasure I",     category:"Quest", tier:"Saradomin", difficulty:"Hard",   xp:450, repeatable:false, objective:"Complete Desert Treasure I" },
  { id:"s_q_6", title:"The Last Wish",         category:"Quest", tier:"Saradomin", difficulty:"Hard",   xp:400, repeatable:true,  objective:"Complete a quest with a Master difficulty rating" },
  { id:"s_q_7", title:"Story of Order",        category:"Quest", tier:"Saradomin", difficulty:"Medium", xp:250, repeatable:false, objective:"Complete a Saradomin-aligned quest" },
  { id:"s_q_8", title:"Breadth of Knowledge", category:"Quest", tier:"Saradomin", difficulty:"Medium", xp:300, repeatable:true,  objective:"Complete 5 quests you have never attempted" },

  { id:"s_sk_1",
    titleFn: (s) => { const skills = lowestNSkills(s,2,true); return `Close the Gap: ${skills.map(skillLabel).join(" & ")}`; },
    title:"Closing the Distance",
    category:"Skill Gap", tier:"Saradomin", difficulty:"Medium", xp:300, repeatable:true,
    objectiveFn: (s) => { const avg = accountAverage(s); const skills = lowestNSkills(s,2,true); return `Raise ${skills.map(k=>`${skillLabel(k)} (${s[k]})`).join(" and ")} above your account average of ${avg.toFixed(0)}`; },
    objective:"Raise two skills above your account average" },

  { id:"s_sk_2",
    titleFn: (s) => { const sk = lowestSkill(s); return `The Long Grind: ${skillLabel(sk)}`; },
    title:"The Long Grind",
    category:"Skill Gap", tier:"Saradomin", difficulty:"Hard", xp:400, repeatable:true,
    objectiveFn: (s) => { const sk = [...SKILLS].filter(x=>s[x]<70).sort((a,b)=>s[a]-s[b])[0] || lowestSkill(s); return `Reach level 70 in ${skillLabel(sk)} (currently ${s[sk]})`; },
    requiresFn: (s) => SKILLS.some(sk => s[sk] < 70),
    objective:"Reach level 70 in any skill currently below 70" },

  { id:"s_sk_3",  title:"Artisan's Discipline",   category:"Skill Gap", tier:"Saradomin", difficulty:"Medium", xp:300, repeatable:true,  objective:"Gain 10 levels across production skills in one session" },
  { id:"s_sk_4",  title:"Fisher's Trial",         category:"Skill Gap", tier:"Saradomin", difficulty:"Medium", xp:250, repeatable:false, requiresFn:(s)=>s.fishing<65, objective:"Reach 65 Fishing" },
  { id:"s_sk_5",  title:"The Alchemist",          category:"Economic",  tier:"Saradomin", difficulty:"Medium", xp:250, repeatable:true,  objective:"Earn 500k GP from any non-combat skilling method" },
  { id:"s_sk_6",  title:"Runecraft Reckoning",    category:"Skill Gap", tier:"Saradomin", difficulty:"Hard",   xp:400, repeatable:false, requiresFn:(s)=>s.runecrafting<50, objective:"Gain 5 Runecrafting levels" },
  { id:"s_sk_7",  title:"Farmer's Debt",          category:"Skill Gap", tier:"Saradomin", difficulty:"Medium", xp:250, repeatable:false, requiresFn:(s)=>s.farming<65,      objective:"Reach 65 Farming" },
  { id:"s_sk_8",  title:"Forged in Fire",         category:"Skill Gap", tier:"Saradomin", difficulty:"Medium", xp:300, repeatable:false, requiresFn:(s)=>s.smithing<70,     objective:"Reach 70 Smithing" },
  { id:"s_sk_9",  title:"The Disciplined Mind",   category:"Endurance", tier:"Saradomin", difficulty:"Medium", xp:250, repeatable:true,  objective:"Train the same skill 3 sessions in a row" },

  { id:"s_sk_10",
    titleFn: (s) => { const skills = lowestNSkills(s,3,true); return `Convergence: ${skills.map(skillLabel).join(", ")}`; },
    title:"Skill Convergence",
    category:"Skill Gap", tier:"Saradomin", difficulty:"Hard", xp:400, repeatable:true,
    objectiveFn: (s) => { const skills = lowestNSkills(s,3,true); return `Bring ${skills.map(k=>`${skillLabel(k)} (${s[k]})`).join(", ")} within 10 levels of each other`; },
    objective:"Bring your three lowest skills within 10 levels of each other" },

  { id:"s_en_1", title:"The Long Watch",       category:"Endurance", tier:"Saradomin", difficulty:"Medium", xp:300, repeatable:true, objective:"Complete a 2-hour uninterrupted grind session" },
  { id:"s_en_2", title:"Slayer Marathon",      category:"Endurance", tier:"Saradomin", difficulty:"Medium", xp:300, repeatable:true, objective:"Complete 10 Slayer tasks total" },
  { id:"s_en_3", title:"Boss Endurance",       category:"Endurance", tier:"Saradomin", difficulty:"Hard",   xp:400, repeatable:true, objective:"Kill the same boss 10 times in one session" },
  { id:"s_en_4", title:"The Sustained Effort", category:"Endurance", tier:"Saradomin", difficulty:"Hard",   xp:450, repeatable:true, objective:"Earn 1M GP in a single session without dying" },
  { id:"s_en_5", title:"Resource Hoarder",     category:"Endurance", tier:"Saradomin", difficulty:"Medium", xp:300, repeatable:true, objective:"Gather 5000 resources of any single type" },
  { id:"s_en_6", title:"Dungeon Delve",        category:"Endurance", tier:"Saradomin", difficulty:"Medium", xp:300, repeatable:true, objective:"Kill 500 monsters in dungeons total" },
  { id:"s_en_7", title:"The Unflinching",      category:"Endurance", tier:"Saradomin", difficulty:"Hard",   xp:450, repeatable:true, objective:"Complete any boss 3 times in a row without dying" },

  { id:"s_ex_1", title:"The Ancestral Path", category:"Exploration", tier:"Saradomin", difficulty:"Hard",   xp:450, repeatable:false, objective:"Complete Desert Treasure I to unlock Ancient Magicks" },
  { id:"s_ex_2", title:"Raid Recon",          category:"Exploration", tier:"Saradomin", difficulty:"Medium", xp:250, repeatable:false, requiresFn:(_,kc)=>(kc.chambers_of_xeric??0)===0, objective:"Enter the Chambers of Xeric for the first time" },
  { id:"s_ex_3", title:"Fairy Network",       category:"Exploration", tier:"Saradomin", difficulty:"Medium", xp:250, repeatable:false, objective:"Complete the quest chain to unlock the fairy ring network" },
  { id:"s_ex_4", title:"The God Wars",        category:"Exploration", tier:"Saradomin", difficulty:"Medium", xp:250, repeatable:false, objective:"Enter God Wars Dungeon and kill any enemy inside" },
  { id:"s_ex_5", title:"Spirit Realm",        category:"Exploration", tier:"Saradomin", difficulty:"Medium", xp:250, repeatable:false, objective:"Complete the quest chain to unlock the Spirit Tree network" },

  // ══════════════ BANDOS ══════════════

  { id:"trial_50", category:"Trial", tier:"Bandos", triggerLevel:50, difficulty:"Hard", xp:900, repeatable:false, trial:true,
    titleFn: (s, kc) => { const pool=["general_graardor","kreearra","kril_tsutsaroth","commander_zilyana"]; const zero=pool.filter(b=>(kc[b]??0)===0); if(zero.length>0) return `Trial of Mettle: ${bossLabel(zero[0])}`; return "Trial of Mettle: Dragon Slayer II"; },
    title:"Trial of Mettle: Bandos Proving",
    objectiveFn: (s, kc) => { const pool=["general_graardor","kreearra","kril_tsutsaroth","commander_zilyana"]; const zero=pool.filter(b=>(kc[b]??0)===0); if(zero.length>0) return `Kill ${bossLabel(zero[0])} for the first time — the God Wars demand your presence. Non-skippable.`; return "Complete Dragon Slayer II. Non-skippable."; },
    objective:"A Bandos-tier proving. Non-skippable." },
  { id:"trial_60", category:"Trial", tier:"Bandos", triggerLevel:60, difficulty:"Elite", xp:1000, repeatable:false, trial:true,
    titleFn: (_s, kc) => { if((kc.chambers_of_xeric??0)===0) return "Trial of Mettle: First Raid"; const gwd=["general_graardor","kreearra","kril_tsutsaroth","commander_zilyana"]; const low=[...gwd].sort((a,b)=>(kc[a]??0)-(kc[b]??0))[0]; return `Trial of Mettle: ${bossLabel(low)} Endurance`; },
    title:"Trial of Mettle: First Raid",
    objectiveFn: (_s, kc) => { if((kc.chambers_of_xeric??0)===0) return "Complete Chambers of Xeric. Your first full raid. Non-skippable."; const gwd=["general_graardor","kreearra","kril_tsutsaroth","commander_zilyana"]; const low=[...gwd].sort((a,b)=>(kc[a]??0)-(kc[b]??0))[0]; return `Kill ${bossLabel(low)} 10 times in one session (${kc[low]??0} KC). Non-skippable.`; },
    objective:"First raid or GWD endurance. Non-skippable." },

  { id:"b_pvm_1",  title:"Dagannoth Dynasty",   category:"PvM Intro",     tier:"Bandos", difficulty:"Hard",   xp:500, repeatable:false, requiresFn:(_,kc)=>(kc.dagannoth_rex??0)<3, objective:"Kill all three Dagannoth Kings" },
  { id:"b_pvm_2",  title:"The Spider's Web",    category:"PvM Endurance", tier:"Bandos", difficulty:"Medium", xp:350, repeatable:true,  objective:"Kill Sarachnis 10 times" },
  { id:"b_pvm_3",  title:"Mole Infestation",    category:"PvM Endurance", tier:"Bandos", difficulty:"Easy",   xp:250, repeatable:true,  objective:"Kill the Giant Mole 5 times" },
  { id:"b_pvm_4",  title:"Bandos Foothold",     category:"PvM Intro",     tier:"Bandos", difficulty:"Hard",   xp:500, repeatable:false, requiresFn:(_,kc)=>(kc.general_graardor??0)===0, objective:"Get your first kill at General Graardor" },
  { id:"b_pvm_5",  title:"Armadyl Rising",      category:"PvM Intro",     tier:"Bandos", difficulty:"Hard",   xp:500, repeatable:false, requiresFn:(_,kc)=>(kc.kreearra??0)===0, objective:"Get your first kill at Kree'arra" },
  { id:"b_pvm_6",  title:"Zamorak's General",   category:"PvM Intro",     tier:"Bandos", difficulty:"Hard",   xp:500, repeatable:false, requiresFn:(_,kc)=>(kc.kril_tsutsaroth??0)===0, objective:"Get your first kill at K'ril Tsutsaroth" },
  { id:"b_pvm_7",  title:"Saradomin's Champion",category:"PvM Intro",     tier:"Bandos", difficulty:"Hard",   xp:500, repeatable:false, requiresFn:(_,kc)=>(kc.commander_zilyana??0)===0, objective:"Get your first kill at Commander Zilyana" },
  { id:"b_pvm_8",  title:"Barrows Regular",     category:"PvM Endurance", tier:"Bandos", difficulty:"Medium", xp:350, repeatable:true,  objective:"Complete 10 Barrows runs total" },
  { id:"b_pvm_9",  title:"Wilderness Warlord",  category:"PvM Intro",     tier:"Bandos", difficulty:"Hard",   xp:500, repeatable:true,  objective:"Kill 3 different wilderness bosses (mandatory from Bandos tier)" },
  { id:"b_pvm_10", title:"Slayer Milestone",    category:"PvM Endurance", tier:"Bandos", difficulty:"Medium", xp:350, repeatable:false, objective:"Reach 500 total Slayer kills" },
  { id:"b_pvm_11", title:"The Nightmare Begins",category:"PvM Intro",     tier:"Bandos", difficulty:"Hard",   xp:500, repeatable:false, requiresFn:(_,kc)=>(kc.zulrah??0)===0, objective:"Attempt Zulrah for the first time if not yet done" },
  { id:"b_pvm_12", title:"Sustained Assault",   category:"PvM Endurance", tier:"Bandos", difficulty:"Hard",   xp:500, repeatable:true,
    titleFn:(_,kc)=>{ const gwd=["general_graardor","kreearra","kril_tsutsaroth","commander_zilyana"]; const target=[...gwd].sort((a,b)=>(kc[a]??0)-(kc[b]??0))[0]; return `Sustained Assault: ${bossLabel(target)}`; },
    objectiveFn:(_,kc)=>{ const gwd=["general_graardor","kreearra","kril_tsutsaroth","commander_zilyana"]; const target=[...gwd].sort((a,b)=>(kc[a]??0)-(kc[b]??0))[0]; return `Kill ${bossLabel(target)} 5 times in one session (${kc[target]??0} KC)`; },
    objective:"Kill any GWD boss 5 times in one session" },

  { id:"b_q_1", title:"Monkey See",          category:"Quest", tier:"Bandos", difficulty:"Hard",   xp:500, repeatable:false, objective:"Complete Monkey Madness I or II" },
  { id:"b_q_2", title:"Recipe for Disaster", category:"Quest", tier:"Bandos", difficulty:"Elite",  xp:700, repeatable:false, objective:"Complete Recipe for Disaster" },
  { id:"b_q_3", title:"The Fremennik",       category:"Quest", tier:"Bandos", difficulty:"Medium", xp:350, repeatable:false, objective:"Complete The Fremennik Trials" },
  // FIX: removed incorrect requiresFn that was checking prayer level against QP value
  { id:"b_q_4", title:"225 Quest Points",    category:"Quest", tier:"Bandos", difficulty:"Hard",   xp:500, repeatable:false, objective:"Reach 225 quest points" },
  { id:"b_q_5", title:"The Grand History",   category:"Quest", tier:"Bandos", difficulty:"Hard",   xp:500, repeatable:true,  objective:"Complete 3 Master-difficulty quests" },
  { id:"b_q_6", title:"Bandos Allegiance",   category:"Quest", tier:"Bandos", difficulty:"Medium", xp:350, repeatable:false, objective:"Complete a quest tied to Bandos lore" },
  { id:"b_q_7", title:"The Slayer Codex",    category:"Quest", tier:"Bandos", difficulty:"Hard",   xp:500, repeatable:false, requiresFn:(s)=>s.slayer<80, objective:"Reach 80 Slayer" },
  { id:"b_q_8", title:"Master of Chains",    category:"Quest", tier:"Bandos", difficulty:"Hard",   xp:500, repeatable:true,  objective:"Complete an entire quest series from start to finish" },

  { id:"b_sk_1",  title:"Combat Ready",
    category:"Skill Gap", tier:"Bandos", difficulty:"Hard", xp:500, repeatable:false,
    titleFn:(s)=>{ const combatSkills=["attack","strength","defence","ranged","magic"]; const low=[...combatSkills].sort((a,b)=>s[a]-s[b])[0]; return `Combat Ready: ${skillLabel(low)}`; },
    objectiveFn:(s)=>{ const combatSkills=["attack","strength","defence","ranged","magic"]; const low=[...combatSkills].sort((a,b)=>s[a]-s[b])[0]; return `Reach 90 in ${skillLabel(low)} (currently ${s[low]})`; },
    requiresFn:(s)=>["attack","strength","defence","ranged","magic"].some(sk=>s[sk]<90),
    objective:"Reach 90 in any combat stat" },
  { id:"b_sk_2",  title:"The Disciplined Crafter", category:"Skill Gap", tier:"Bandos", difficulty:"Medium", xp:350, repeatable:false,
    titleFn:(s)=>{ const sk=lowestProductionSkill(s); return `Disciplined: ${skillLabel(sk)}`; },
    objectiveFn:(s)=>{ const sk=lowestProductionSkill(s); return `Reach 75 in ${skillLabel(sk)} — your lowest production skill at ${s[sk]}`; },
    requiresFn:(s)=>PRODUCTION.some(sk=>s[sk]<75), objective:"Reach 75 in any production skill" },
  { id:"b_sk_3",  title:"Runecraft Reckoning II", category:"Skill Gap", tier:"Bandos", difficulty:"Hard",   xp:500, repeatable:false, requiresFn:(s)=>s.runecrafting<65, objective:"Reach 65 Runecrafting" },
  { id:"b_sk_4",  title:"Fisher King",           category:"Skill Gap", tier:"Bandos", difficulty:"Medium", xp:350, repeatable:false, requiresFn:(s)=>s.fishing<76,      objective:"Reach 76 Fishing" },
  { id:"b_sk_5",  title:"The Sustained Miner",   category:"Endurance", tier:"Bandos", difficulty:"Hard",   xp:500, repeatable:true,  objective:"Mine 2000 ore total" },
  { id:"b_sk_6",  title:"Smith or Die",          category:"Skill Gap", tier:"Bandos", difficulty:"Hard",   xp:500, repeatable:true,  objective:"Smith 500 bars total" },
  { id:"b_sk_7",  title:"Herblore Discipline",   category:"Skill Gap", tier:"Bandos", difficulty:"Medium", xp:350, repeatable:false, requiresFn:(s)=>s.herblore<70, objective:"Reach 70 Herblore" },
  { id:"b_sk_8",  title:"Woodcutter's Burden",   category:"Skill Gap", tier:"Bandos", difficulty:"Medium", xp:350, repeatable:false, requiresFn:(s)=>s.woodcutting<75, objective:"Reach 75 Woodcutting" },
  { id:"b_sk_9",  title:"Economic Discipline",   category:"Economic",  tier:"Bandos", difficulty:"Hard",   xp:500, repeatable:true,  objective:"Earn 2M GP through non-combat methods" },
  { id:"b_sk_10", title:"Skill Mastery",
    category:"Skill Gap", tier:"Bandos", difficulty:"Hard", xp:500, repeatable:true,
    titleFn:(s)=>{ const sk=[...SKILLS].filter(x=>s[x]<80).sort((a,b)=>s[a]-s[b])[0]; return sk?`Skill Mastery: ${skillLabel(sk)}`:"Skill Mastery"; },
    objectiveFn:(s)=>{ const sk=[...SKILLS].filter(x=>s[x]<80).sort((a,b)=>s[a]-s[b])[0]; return sk?`Reach level 80 in ${skillLabel(sk)} (currently ${s[sk]})`:"Reach level 80 in any skill currently below 80"; },
    requiresFn:(s)=>SKILLS.some(sk=>s[sk]<80), objective:"Reach level 80 in any skill currently below 80" },

  { id:"b_en_1", title:"The Iron Will",       category:"Endurance", tier:"Bandos", difficulty:"Hard",  xp:500, repeatable:true, objective:"Complete a 3-hour uninterrupted grind session" },
  { id:"b_en_2", title:"Slayer Dedicated",    category:"Endurance", tier:"Bandos", difficulty:"Medium",xp:350, repeatable:true, objective:"Complete 25 Slayer tasks total" },
  { id:"b_en_3", title:"Boss Marathon",       category:"Endurance", tier:"Bandos", difficulty:"Hard",  xp:500, repeatable:true, objective:"Kill the same boss 20 times in one session" },
  { id:"b_en_4", title:"The Grind Never Stops",category:"Endurance",tier:"Bandos", difficulty:"Hard",  xp:500, repeatable:true, objective:"Train any skill for 5 hours total across sessions" },
  { id:"b_en_5", title:"Wilderness Survivor", category:"Endurance", tier:"Bandos", difficulty:"Hard",  xp:500, repeatable:true, objective:"Kill 3 wilderness bosses without dying" },
  { id:"b_en_6", title:"Sustained Bossing",   category:"Endurance", tier:"Bandos", difficulty:"Hard",  xp:500, repeatable:true, objective:"Kill 3 different bosses in a single session" },
  { id:"b_en_7", title:"The Unbroken",        category:"Endurance", tier:"Bandos", difficulty:"Hard",  xp:500, repeatable:true, objective:"Complete 5 writs in a row without deferring" },

  { id:"b_ex_1", title:"The Gauntlet Awaits", category:"Exploration", tier:"Bandos", difficulty:"Hard",   xp:500, repeatable:false, requiresFn:(_,kc)=>(kc.the_gauntlet??0)===0, objective:"Unlock and enter The Gauntlet" },
  { id:"b_ex_2", title:"Ancient Arsenal",     category:"Exploration", tier:"Bandos", difficulty:"Hard",   xp:500, repeatable:false, objective:"Unlock Ancient Magicks and cast 100 spells" },
  { id:"b_ex_3", title:"The Slayer Ascent",   category:"Exploration", tier:"Bandos", difficulty:"Medium", xp:350, repeatable:false, objective:"Unlock a new Slayer master" },

  // ══════════════ ZAMORAK ══════════════

  { id:"trial_70", category:"Trial", tier:"Zamorak", triggerLevel:70, difficulty:"Elite", xp:1000, repeatable:false, trial:true,
    titleFn: (_s, kc) => { const pool=["vorkath","zulrah","cerberus","alchemical_hydra","grotesque_guardians"]; const zero=pool.filter(b=>(kc[b]??0)===0); const boss=zero.length>0?zero[0]:pool[0]; return `Trial of Mettle: ${bossLabel(boss)}`; },
    title:"Trial of Mettle: Zamorak Proving",
    trialModifier:"Inventory limit (16 slots)",
    objectiveFn: (_s, kc) => { const pool=["vorkath","zulrah","cerberus","alchemical_hydra","grotesque_guardians"]; const zero=pool.filter(b=>(kc[b]??0)===0); const boss=zero.length>0?zero[0]:pool[0]; return `Defeat ${bossLabel(boss)} with modifier: Inventory limit (16 slots). ${kc[boss]??0} KC. Non-skippable.`; },
    objective:"Defeat a Zamorak-tier boss with modifier. Non-skippable." },
  { id:"trial_80", category:"Trial", tier:"Zamorak", triggerLevel:80, difficulty:"Elite", xp:1200, repeatable:false, trial:true,
    titleFn:(_,kc)=>{ const b=hardestUntouchedBoss(kc); return `Trial of Mettle: ${bossLabel(b)}`; },
    title:"Trial of Mettle: Endgame Boss",
    objectiveFn:(_,kc)=>{ const b=hardestUntouchedBoss(kc); return `Kill ${bossLabel(b)} — the hardest boss you've never touched. ${(kc[b]??0)} KC. Non-skippable.`; },
    objective:"Hardest uncompleted boss. Non-skippable." },

  { id:"z_pvm_1",  title:"Zulrah Tamed",          category:"PvM Endurance", tier:"Zamorak", difficulty:"Hard",   xp:600, repeatable:true,  objective:"Kill Zulrah 10 times" },
  { id:"z_pvm_2",  title:"Vorkath's Debt",         category:"PvM Intro",     tier:"Zamorak", difficulty:"Hard",   xp:600, repeatable:false, requiresFn:(_,kc)=>(kc.vorkath??0)===0, objective:"Kill Vorkath for the first time" },
  { id:"z_pvm_3",  title:"Vorkath Committed",      category:"PvM Endurance", tier:"Zamorak", difficulty:"Hard",   xp:600, repeatable:true,  objective:"Kill Vorkath 10 times" },
  { id:"z_pvm_4",  title:"Theatre Initiate",       category:"PvM Intro",     tier:"Zamorak", difficulty:"Hard",   xp:600, repeatable:false, requiresFn:(_,kc)=>(kc.theatre_of_blood??0)===0, objective:"Complete Theatre of Blood entry mode" },
  { id:"z_pvm_5",  title:"Chambers Regular",       category:"PvM Endurance", tier:"Zamorak", difficulty:"Hard",   xp:600, repeatable:true,  objective:"Complete 5 Chambers of Xeric runs" },
  { id:"z_pvm_6",  title:"The Grotesque",          category:"PvM Endurance", tier:"Zamorak", difficulty:"Medium", xp:450, repeatable:true,  objective:"Kill Grotesque Guardians 10 times" },
  { id:"z_pvm_7",  title:"Cerberus Unleashed",     category:"PvM Intro",     tier:"Zamorak", difficulty:"Hard",   xp:600, repeatable:false, requiresFn:(_,kc)=>(kc.cerberus??0)===0, objective:"Kill Cerberus for the first time" },
  { id:"z_pvm_8",  title:"Thermonuclear Trial",    category:"PvM Endurance", tier:"Zamorak", difficulty:"Medium", xp:450, repeatable:true,  objective:"Kill Thermonuclear Smoke Devil 10 times" },
  { id:"z_pvm_9",  title:"Alchemical Hydra",       category:"PvM Intro",     tier:"Zamorak", difficulty:"Hard",   xp:600, repeatable:false, requiresFn:(_,kc)=>(kc.alchemical_hydra??0)===0, objective:"Kill the Alchemical Hydra for the first time" },
  { id:"z_pvm_10", title:"Zamorak's Wrath",        category:"PvM Endurance", tier:"Zamorak", difficulty:"Hard",   xp:600, repeatable:true,  objective:"Kill K'ril Tsutsaroth 20 times" },
  { id:"z_pvm_11", title:"Wilderness Domination",  category:"PvM Endurance", tier:"Zamorak", difficulty:"Hard",   xp:600, repeatable:true,  objective:"Kill 5 different wilderness bosses total" },
  { id:"z_pvm_12", title:"Modified Combat",        category:"PvM Endurance", tier:"Zamorak", difficulty:"Elite",  xp:800, repeatable:true,
    titleFn:(_,kc)=>{ const gwd=["general_graardor","kreearra","kril_tsutsaroth","commander_zilyana","vorkath","zulrah","cerberus"]; const target=[...gwd].sort((a,b)=>(kc[a]??0)-(kc[b]??0))[0]; return `Modified Combat: ${bossLabel(target)}`; },
    objectiveFn:(_,kc)=>{ const gwd=["general_graardor","kreearra","kril_tsutsaroth","commander_zilyana","vorkath","zulrah","cerberus"]; const target=[...gwd].sort((a,b)=>(kc[a]??0)-(kc[b]??0))[0]; return `Kill ${bossLabel(target)} with a modifier active (${kc[target]??0} KC)`; },
    objective:"Complete any hard boss with a modifier active" },
  { id:"z_pvm_13", title:"The Sustained Killer",   category:"PvM Endurance", tier:"Zamorak", difficulty:"Hard",   xp:600, repeatable:true,
    titleFn:(_,kc)=>{ const gwd=["general_graardor","kreearra","kril_tsutsaroth","commander_zilyana"]; const target=[...gwd].sort((a,b)=>(kc[a]??0)-(kc[b]??0))[0]; return `Sustained: ${bossLabel(target)}`; },
    objectiveFn:(_,kc)=>{ const gwd=["general_graardor","kreearra","kril_tsutsaroth","commander_zilyana"]; const target=[...gwd].sort((a,b)=>(kc[a]??0)-(kc[b]??0))[0]; return `Kill ${bossLabel(target)} 3 times in one session (${kc[target]??0} KC)`; },
    objective:"Kill any GWD boss 3 times in one session" },

  { id:"z_q_1", title:"275 Quest Points",    category:"Quest", tier:"Zamorak", difficulty:"Hard",   xp:600, repeatable:false, objective:"Reach 275 QP" },
  { id:"z_q_2", title:"The Grand Library",   category:"Quest", tier:"Zamorak", difficulty:"Hard",   xp:600, repeatable:true,  objective:"Complete 5 quests that each unlock a new area or spellbook" },
  { id:"z_q_3", title:"Zamorak's Path",      category:"Quest", tier:"Zamorak", difficulty:"Hard",   xp:600, repeatable:false, objective:"Complete a Zamorak-aligned quest chain" },
  { id:"z_q_4", title:"Recipe Mastered",     category:"Quest", tier:"Zamorak", difficulty:"Elite",  xp:800, repeatable:false, objective:"Complete Recipe for Disaster if not already done" },
  { id:"z_q_5", title:"The Slayer Codex II", category:"Quest", tier:"Zamorak", difficulty:"Hard",   xp:600, repeatable:false, requiresFn:(s)=>s.slayer<85, objective:"Reach 85 Slayer" },
  { id:"z_q_6", title:"Master of Quests",    category:"Quest", tier:"Zamorak", difficulty:"Hard",   xp:600, repeatable:true,  objective:"Complete every quest in a single skill quest chain" },
  { id:"z_q_7", title:"The Zamorak Codex",  category:"Quest", tier:"Zamorak", difficulty:"Hard",   xp:600, repeatable:true,  objective:"Complete a quest chain with a Zamorak-aligned NPC" },
  { id:"z_q_8", title:"Master of Quests",    category:"Quest", tier:"Zamorak", difficulty:"Hard",   xp:600, repeatable:true,  objective:"Complete every quest in a single skill quest chain" },

  { id:"z_sk_1",
    titleFn:(s)=>{ const sk=[...SKILLS].filter(x=>s[x]<85).sort((a,b)=>s[a]-s[b])[0]; return sk?`The 85 Club: ${skillLabel(sk)}`:"The 85 Club"; },
    title:"The 85 Club", category:"Skill Gap", tier:"Zamorak", difficulty:"Hard", xp:600, repeatable:true,
    objectiveFn:(s)=>{ const sk=[...SKILLS].filter(x=>s[x]<85).sort((a,b)=>s[a]-s[b])[0]; return sk?`Reach 85 in ${skillLabel(sk)} (currently ${s[sk]})`:"Reach 85 in any skill currently below 85"; },
    requiresFn:(s)=>SKILLS.some(sk=>s[sk]<85), objective:"Reach 85 in any skill currently below 85" },
  { id:"z_sk_2",  title:"Runecraft Mastery",     category:"Skill Gap", tier:"Zamorak", difficulty:"Elite",  xp:800, repeatable:false, requiresFn:(s)=>s.runecrafting<77, objective:"Reach 77 Runecrafting (Blood runes unlocked)" },
  { id:"z_sk_3",  title:"Herblore Advanced",     category:"Skill Gap", tier:"Zamorak", difficulty:"Elite",  xp:800, repeatable:false, requiresFn:(s)=>s.herblore<90,     objective:"Reach 90 Herblore" },
  { id:"z_sk_4",  title:"Agility Discipline",    category:"Skill Gap", tier:"Zamorak", difficulty:"Hard",   xp:600, repeatable:false, requiresFn:(s)=>s.agility<80,      objective:"Reach 80 Agility" },
  { id:"z_sk_5",  title:"The Relentless Grinder",category:"Endurance", tier:"Zamorak", difficulty:"Hard",   xp:600, repeatable:true,  objective:"Gain 10 levels in a single skill in one week" },
  { id:"z_sk_6",  title:"Construction Push",     category:"Skill Gap", tier:"Zamorak", difficulty:"Elite",  xp:800, repeatable:false, requiresFn:(s)=>s.construction<83, objective:"Reach 83 Construction" },
  { id:"z_sk_7",  title:"Thieving Mastery",      category:"Skill Gap", tier:"Zamorak", difficulty:"Hard",   xp:600, repeatable:false, requiresFn:(s)=>s.thieving<85,     objective:"Reach 85 Thieving" },
  { id:"z_sk_8",  title:"Hunter's Mark",         category:"Skill Gap", tier:"Zamorak", difficulty:"Hard",   xp:600, repeatable:false, requiresFn:(s)=>s.hunter<80,       objective:"Reach 80 Hunter" },
  { id:"z_sk_9",
    title:"Skill Reckoning", category:"Skill Gap", tier:"Zamorak", difficulty:"Elite", xp:800, repeatable:true,
    objectiveFn:(s)=>{ const below=SKILLS.filter(sk=>s[sk]<70); return below.length>0?`Bring every skill above 70 — still below: ${below.map(skillLabel).join(", ")}`:"Bring every skill above 70"; },
    requiresFn:(s)=>SKILLS.some(sk=>s[sk]<70), objective:"Bring every skill above 70" },
  { id:"z_sk_10",
    titleFn:(s)=>{ const sk=lowestSkill(s); return `Final Gap: ${skillLabel(sk)}`; },
    title:"The Final Gap", category:"Skill Gap", tier:"Zamorak", difficulty:"Elite", xp:800, repeatable:true,
    objectiveFn:(s)=>{ const sk=lowestSkill(s); const avg=accountAverage(s); return `Close the largest remaining gap — ${skillLabel(sk)} at ${s[sk]} vs account average ${avg.toFixed(0)}`; },
    objective:"Close the largest remaining skill gap on your account" },

  { id:"z_en_1", title:"The Long Campaign",    category:"Endurance", tier:"Zamorak", difficulty:"Hard",   xp:600, repeatable:true, objective:"Complete 50 Slayer tasks total" },
  { id:"z_en_2", title:"Chaos Endurance",      category:"Endurance", tier:"Zamorak", difficulty:"Hard",   xp:600, repeatable:true, objective:"Kill any Zamorak-aligned boss 30 times total" },
  { id:"z_en_3", title:"Modified Grind",       category:"Endurance", tier:"Zamorak", difficulty:"Elite",  xp:800, repeatable:true, objective:"Complete 3 writs with modifiers in a row" },
  { id:"z_en_4", title:"The Unrelenting",      category:"Endurance", tier:"Zamorak", difficulty:"Elite",  xp:800, repeatable:true, objective:"Complete a 5-hour grind session" },
  { id:"z_en_5", title:"Raid Regularity",      category:"Endurance", tier:"Zamorak", difficulty:"Hard",   xp:600, repeatable:true, objective:"Complete 10 raids total across any type" },
  { id:"z_en_6", title:"Wilderness Veteran",   category:"Endurance", tier:"Zamorak", difficulty:"Hard",   xp:600, repeatable:true, objective:"Survive 10 wilderness boss kills without dying" },
  { id:"z_en_7", title:"The Defer Collector",  category:"Endurance", tier:"Zamorak", difficulty:"Medium", xp:450, repeatable:true, objective:"Clear all deferred writs within a single tier" },
  { id:"z_en_8", title:"Streak Master",        category:"Endurance", tier:"Zamorak", difficulty:"Hard",   xp:600, repeatable:true, objective:"Complete 7 writs in a row without deferring" },

  { id:"z_ex_1", title:"Theatre Unlocked",       category:"Exploration", tier:"Zamorak", difficulty:"Elite",  xp:800, repeatable:false, objective:"Complete Theatre of Blood entry mode with a modifier" },
  { id:"z_ex_2", title:"Tombs of Amascut",       category:"Exploration", tier:"Zamorak", difficulty:"Elite",  xp:800, repeatable:false, requiresFn:(_,kc)=>(kc.tombs_of_amascut??0)===0, objective:"Enter and complete Tombs of Amascut for the first time" },
  { id:"z_ex_3", title:"Slayer Dungeon Deep",    category:"Exploration", tier:"Zamorak", difficulty:"Hard",   xp:600, repeatable:true,  objective:"Complete a Slayer task in every major dungeon" },
  { id:"z_ex_4", title:"Ancient Curses",         category:"Exploration", tier:"Zamorak", difficulty:"Elite",  xp:800, repeatable:false, objective:"Complete the quest chain to unlock Ancient Curses" },
  { id:"z_ex_5", title:"Farming Mastery",        category:"Exploration", tier:"Zamorak", difficulty:"Hard",   xp:600, repeatable:false, objective:"Unlock the Farming Guild" },
  { id:"z_ex_6", title:"The Grand Exchange Gamble",category:"Economic",  tier:"Zamorak", difficulty:"Hard",   xp:600, repeatable:true,  objective:"Earn 5M GP through merching or flipping" },

  // ══════════════ ZAROS ══════════════

  { id:"trial_90", category:"Trial", tier:"Zaros", triggerLevel:90, difficulty:"Elite", xp:1500, repeatable:false, trial:true,
    titleFn:(_,kc)=>{ const b=hardestUntouchedBoss(kc); return `Trial of Mettle: ${bossLabel(b)}`; },
    title:"Trial of Mettle: Elite Challenge",
    objectiveFn:(_,kc)=>{ const b=hardestUntouchedBoss(kc); return `Kill ${bossLabel(b)} — the board has spoken. ${(kc[b]??0)} KC. Non-skippable.`; },
    objective:"Highest-difficulty uncompleted boss. Non-skippable." },
  { id:"trial_99", title:"The Final Trial", category:"Trial", tier:"Zaros", triggerLevel:99, difficulty:"Elite", xp:2000, repeatable:false, trial:true, finalTrial:true, objective:"The series finale. Your Path is revealed. Five writs drawn. You choose one." },

  { id:"zr_pvm_1",  title:"Vorkath Mastered",    category:"PvM Endurance", tier:"Zaros", difficulty:"Elite",  xp:1000, repeatable:true,  objective:"Kill Vorkath 50 times total" },
  { id:"zr_pvm_2",  title:"Zulrah Mastered",     category:"PvM Endurance", tier:"Zaros", difficulty:"Elite",  xp:1000, repeatable:true,  objective:"Kill Zulrah 50 times total" },
  { id:"zr_pvm_3",  title:"The Nightmare",       category:"PvM Intro",     tier:"Zaros", difficulty:"Elite",  xp:1000, repeatable:false, requiresFn:(_,kc)=>(kc.nightmare??0)===0, objective:"Kill the Nightmare for the first time" },
  { id:"zr_pvm_4",  title:"Nex Awakened",        category:"PvM Intro",     tier:"Zaros", difficulty:"Elite",  xp:1000, repeatable:false, requiresFn:(_,kc)=>(kc.nex??0)===0, objective:"Kill Nex for the first time" },
  { id:"zr_pvm_5",  title:"Phantom Muspah",      category:"PvM Endurance", tier:"Zaros", difficulty:"Elite",  xp:1000, repeatable:true,  objective:"Kill Phantom Muspah 10 times" },
  { id:"zr_pvm_6",  title:"One DT2 Boss",        category:"PvM Endurance", tier:"Zaros", difficulty:"Elite",  xp:1000, repeatable:true,
    titleFn:(_,kc)=>{ const dt2=["vardorvis","duke_sucellus","the_leviathan","the_whisperer"]; const low=[...dt2].sort((a,b)=>(kc[a]??0)-(kc[b]??0))[0]; return `DT2: ${bossLabel(low)}`; },
    objectiveFn:(_,kc)=>{ const dt2=["vardorvis","duke_sucellus","the_leviathan","the_whisperer"]; const low=[...dt2].sort((a,b)=>(kc[a]??0)-(kc[b]??0))[0]; return `Kill ${bossLabel(low)} 20 times (currently ${kc[low]??0} KC)`; },
    objective:"Kill any single DT2 boss 20 times (player's choice)" },
  { id:"zr_pvm_7",  title:"Chambers Master",     category:"PvM Endurance", tier:"Zaros", difficulty:"Elite",  xp:1000, repeatable:true,  objective:"Complete Chambers of Xeric 20 times" },
  { id:"zr_pvm_8",  title:"Theatre Master",      category:"PvM Endurance", tier:"Zaros", difficulty:"Elite",  xp:1000, repeatable:true,  objective:"Complete Theatre of Blood 10 times" },
  { id:"zr_pvm_9",  title:"The Gauntlet",        category:"PvM Endurance", tier:"Zaros", difficulty:"Elite",  xp:1000, repeatable:true,  objective:"Complete the Gauntlet or Corrupted Gauntlet" },
  { id:"zr_pvm_10", title:"Colosseum",           category:"PvM Intro",     tier:"Zaros", difficulty:"Elite",  xp:1200, repeatable:false, requiresFn:(_,kc)=>(kc.sol_heredit??0)===0, objective:"Attempt the Fortis Colosseum" },

  { id:"zr_q_3", title:"The Last Chapter",   category:"Quest",       tier:"Zaros", difficulty:"Elite",  xp:1000, repeatable:true,  objective:"Complete the final quest in any major quest chain" },
  { id:"zr_q_4", title:"Zaros Ascendant",    category:"Quest",       tier:"Zaros", difficulty:"Elite",  xp:1000, repeatable:false, objective:"Complete a quest that unlocks Zaros-aligned content" },
  { id:"zr_q_5", title:"Quest Cape",         category:"Quest",       tier:"Zaros", difficulty:"Elite",  xp:1500, repeatable:false, landmark:true, objective:"Complete all quests" },

  { id:"zr_sk_1", title:"The 90 Club",
    category:"Skill Gap", tier:"Zaros", difficulty:"Elite", xp:1000, repeatable:false,
    titleFn:(s)=>{ const combatSkills=["attack","strength","defence","ranged","magic"]; const low=[...combatSkills].filter(x=>s[x]<90).sort((a,b)=>s[a]-s[b])[0]; return low?`The 90 Club: ${skillLabel(low)}`:"The 90 Club"; },
    objectiveFn:(s)=>{ const combatSkills=["attack","strength","defence","ranged","magic"]; const below=[...combatSkills].filter(x=>s[x]<90); return below.length>0?`Reach 90 in every combat stat — still below: ${below.map(k=>`${skillLabel(k)} (${s[k]})`).join(", ")}`:"Reach 90 in every combat stat"; },
    requiresFn:(s)=>["attack","strength","defence","ranged","magic"].some(sk=>s[sk]<90), objective:"Reach 90 in every combat stat" },
  { id:"zr_sk_2", title:"Completionist's Path", category:"Skill Gap", tier:"Zaros", difficulty:"Elite", xp:1200, repeatable:true,
    titleFn:(s)=>{ const sk=[...SKILLS].filter(x=>s[x]<99).sort((a,b)=>s[a]-s[b])[0]; return sk?`First 99: ${skillLabel(sk)}`:"First 99"; },
    objectiveFn:(s)=>{ const sk=[...SKILLS].filter(x=>s[x]<99).sort((a,b)=>s[a]-s[b])[0]; return sk?`Reach level 99 in ${skillLabel(sk)} (currently ${s[sk]})`:"Reach level 99 in any skill"; },
    objective:"Reach level 99 in any skill" },
  { id:"zr_sk_3", title:"The Final Discipline",
    category:"Skill Gap", tier:"Zaros", difficulty:"Elite", xp:1000, repeatable:true,
    objectiveFn:(s)=>{ const below=SKILLS.filter(sk=>s[sk]<80); return below.length>0?`Raise every skill above 80 — still below: ${below.map(skillLabel).join(", ")}`:"Raise every skill above 80"; },
    requiresFn:(s)=>SKILLS.some(sk=>s[sk]<80), objective:"Raise every skill above 80" },
  { id:"zr_sk_4", title:"Runecraft Pinnacle",   category:"Skill Gap", tier:"Zaros", difficulty:"Elite",  xp:1000, repeatable:false, requiresFn:(s)=>s.runecrafting<91, objective:"Reach 91 Runecrafting" },
  { id:"zr_sk_5", title:"Herblore Pinnacle",    category:"Skill Gap", tier:"Zaros", difficulty:"Elite",  xp:1000, repeatable:false, requiresFn:(s)=>s.herblore<94,     objective:"Reach 94 Herblore" },
  { id:"zr_sk_6", title:"Total Mastery",        category:"Skill Gap", tier:"Zaros", difficulty:"Elite",  xp:1200, repeatable:false, objective:"Reach 1900 total level" },
  { id:"zr_sk_7", title:"The Last Gap",
    titleFn:(s)=>{ const sk=lowestSkill(s); return `Last Gap: ${skillLabel(sk)}`; },
    category:"Skill Gap", tier:"Zaros", difficulty:"Elite", xp:1000, repeatable:true,
    objectiveFn:(s)=>{ const sk=lowestSkill(s); return `Eliminate the largest remaining gap — ${skillLabel(sk)} at ${s[sk]}`; },
    objective:"Eliminate the single largest remaining skill gap" },

  { id:"zr_en_1", title:"The Final Campaign",     category:"Endurance", tier:"Zaros", difficulty:"Elite",  xp:1200, repeatable:true, objective:"Complete 100 Slayer tasks total" },
  { id:"zr_en_2", title:"Elite Endurance",        category:"Endurance", tier:"Zaros", difficulty:"Elite",  xp:1200, repeatable:true, objective:"Complete the Corrupted Gauntlet 5 times" },
  { id:"zr_en_3", title:"Mastery Under Pressure", category:"Endurance", tier:"Zaros", difficulty:"Elite",  xp:1200, repeatable:true, objective:"Complete 3 hard boss writs with modifiers in a row" },
  { id:"zr_en_4", title:"The Unbreakable",        category:"Endurance", tier:"Zaros", difficulty:"Elite",  xp:1200, repeatable:true, objective:"Complete 10 writs in a row without deferring" },
  { id:"zr_en_5", title:"Raid Veteran",           category:"Endurance", tier:"Zaros", difficulty:"Elite",  xp:1200, repeatable:true, objective:"Complete 50 raids total" },

  { id:"zr_ex_1", title:"The Wilderness Throne", category:"Exploration", tier:"Zaros", difficulty:"Elite",  xp:1000, repeatable:true,  objective:"Kill Artio, Spindel, and Calvar'ion at least once each" },
  { id:"zr_ex_2", title:"Elite Diary",           category:"Exploration", tier:"Zaros", difficulty:"Elite",  xp:1000, repeatable:true,  objective:"Complete any elite achievement diary" },
  { id:"zr_ex_3", title:"The Final Frontier",    category:"Exploration", tier:"Zaros", difficulty:"Elite",  xp:1000, repeatable:true,  objective:"Unlock and enter every major endgame area" },
];

// ─────────────────────────────────────────────
// FORK WRITS — standalone events, not in draft pool
// ─────────────────────────────────────────────
const FORK_WRITS = [
  { id:"fork_ancient_path", title:"The Ancient Path", tier:"Zamorak", triggerLevel:65, difficulty:"Elite", xp:900, category:"Fork",
    optionA: { label:"Desert Treasure II", objective:"Complete Desert Treasure II", questId:"dt2" },
    optionB: { label:"Dragon Slayer II", objective:"Complete Dragon Slayer II", questId:"ds2" },
  },
  { id:"fork_elven_choice", title:"The Elven Choice", tier:"Zamorak", triggerLevel:75, difficulty:"Elite", xp:900, category:"Fork",
    optionA: { label:"Song of the Elves", objective:"Complete Song of the Elves", questId:"sote" },
    optionB: { label:"Sins of the Father", objective:"Complete Sins of the Father", questId:"sotf" },
  },
  { id:"fork_endgame", title:"The Endgame", tier:"Zaros", triggerLevel:85, difficulty:"Elite", xp:1200, category:"Fork",
    optionA: { label:"Tombs of Amascut (Full)", objective:"Complete Tombs of Amascut in full", questId:"toa" },
    optionB: { label:"Theatre of Blood (Full)", objective:"Complete Theatre of Blood in full", questId:"tob" },
  },
  { id:"fork_final_reckoning", title:"The Final Reckoning", tier:"Zaros", triggerLevel:92, difficulty:"Elite", xp:1500, category:"Fork",
    optionA: { label:"The Inferno", objective:"Attempt and complete the Inferno", questId:"inferno" },
    optionB: { label:"The Nightmare", objective:"Kill the Nightmare", questId:"nightmare" },
  },
];

function getPendingFork(mettleLevel, completedForks, completedIds) {
  for (const fork of FORK_WRITS) {
    if (mettleLevel >= fork.triggerLevel && !completedForks[fork.id]) {
      return fork;
    }
  }
  return null;
}

// ─────────────────────────────────────────────
// LANDMARK WRITS — auto-trigger on condition
// ─────────────────────────────────────────────
const LANDMARK_WRITS = [
  { id:"landmark_first_99", title:"First Level 99", category:"Landmark", tier:"Zaros", difficulty:"Elite", xp:1000,
    conditionFn: (skills, _kc) => SKILLS.some(s => skills[s] >= 99),
    objectiveFn: (skills) => { const maxed = SKILLS.filter(s => skills[s] >= 99); return `You have reached 99 in ${maxed.map(skillLabel).join(", ")}. The board acknowledges mastery.`; },
    objective:"Reach level 99 in any skill." },
  { id:"landmark_quest_cape", title:"Quest Cape", category:"Landmark", tier:"Zaros", difficulty:"Elite", xp:1500, landmark:true,
    conditionFn: () => false, // Manual trigger — we can't detect quest completion from WOM API skill data alone
    objective:"Complete all quests. One of the defining moments of any OSRS account." },
  { id:"landmark_total_1900", title:"Total Level 1900", category:"Landmark", tier:"Zaros", difficulty:"Elite", xp:1000,
    conditionFn: (skills) => { const total = Object.values(skills).reduce((a,b) => a+b, 0); return total >= 1900; },
    objectiveFn: (skills) => { const total = Object.values(skills).reduce((a,b) => a+b, 0); return `Total level ${total} — you've reached the 1900 milestone. The board marks this moment.`; },
    objective:"Reach 1900 total level." },
  { id:"landmark_first_raid", title:"First Raid Completion", category:"Landmark", tier:"Bandos", difficulty:"Hard", xp:800,
    conditionFn: (_s, kc) => (kc.chambers_of_xeric??0) > 0 || (kc.theatre_of_blood??0) > 0 || (kc.tombs_of_amascut??0) > 0,
    objective:"Complete any raid for the first time. A defining account moment." },
];

function getPendingLandmark(skillLevels, bossKC, completedLandmarks) {
  for (const lm of LANDMARK_WRITS) {
    if (completedLandmarks.includes(lm.id)) continue;
    if (lm.conditionFn && lm.conditionFn(skillLevels, bossKC)) {
      return {
        ...lm,
        objective: lm.objectiveFn ? lm.objectiveFn(skillLevels, bossKC) : lm.objective,
      };
    }
  }
  return null;
}

// ─────────────────────────────────────────────
// FINAL TRIAL PATH SYSTEM (Level 99)
// ─────────────────────────────────────────────
function computePath(history) {
  const cats = { pvm:0, scholar:0, survivor:0 };
  for (const h of history) {
    if (h.category === "PvM Intro" || h.category === "PvM Endurance") cats.pvm++;
    else if (h.category === "Quest" || h.category === "Skill Gap") cats.scholar++;
    else if (h.category === "Endurance" || h.category === "Exploration") cats.survivor++;
  }
  const max = Math.max(cats.pvm, cats.scholar, cats.survivor);
  if (max === 0) return "Balanced";
  const dominant = Object.entries(cats).filter(([_,v]) => v === max);
  if (dominant.length > 1) return "Balanced";
  if (dominant[0][0] === "pvm") return "Warrior";
  if (dominant[0][0] === "scholar") return "Scholar";
  return "Survivor";
}

const FINAL_TRIAL_POOLS = {
  Warrior: [
    { id:"ft_w1", title:"Inferno Bound",     objective:"Complete the Inferno (attempts allowed)", xp:2000 },
    { id:"ft_w2", title:"Nex Undying",        objective:"Kill Nex 5 times", xp:1800 },
    { id:"ft_w3", title:"Solo Raid",           objective:"Complete Chambers of Xeric solo", xp:2000 },
    { id:"ft_w4", title:"DT2 Sweep",          objective:"Kill all four DT2 bosses in one session", xp:1800 },
    { id:"ft_w5", title:"Theatre Veteran",     objective:"Complete Theatre of Blood regular mode", xp:1600 },
    { id:"ft_w6", title:"Vorkath Capped",      objective:"Kill Vorkath 10 times with a gear cap modifier", xp:1500 },
    { id:"ft_w7", title:"Colosseum Final",     objective:"Complete the Fortis Colosseum", xp:2000 },
    { id:"ft_w8", title:"GWD Legacy",          objective:"Kill any GWD boss 50 times total", xp:1500 },
  ],
  Scholar: [
    { id:"ft_s1", title:"Quest Cape",          objective:"Achieve Quest Cape (if not already a Landmark)", xp:2000 },
    { id:"ft_s2", title:"Elite Region",        objective:"Complete all elite achievement diaries in one region", xp:1800 },
    { id:"ft_s3", title:"Skill Pinnacle",      objective:"Reach level 99 in your lowest skill at Guthix tier", xp:2000 },
    { id:"ft_s4", title:"Modified Mastery",    objective:"Complete every quest in a major quest chain with a modifier", xp:1800 },
    { id:"ft_s5", title:"Total 1900",          objective:"Reach 1900 total level (if not yet done)", xp:1600 },
    { id:"ft_s6", title:"Ancient Complete",    objective:"Complete both DT2 and DS2", xp:1500 },
    { id:"ft_s7", title:"The Long Arc",        objective:"Max any skill that was below account average when the series began", xp:1800 },
    { id:"ft_s8", title:"Five Masters",        objective:"Complete 5 Master-difficulty quests total", xp:1500 },
  ],
  Survivor: [
    { id:"ft_sv1", title:"Slayer Century",      objective:"Complete 100 Slayer tasks total", xp:1800 },
    { id:"ft_sv2", title:"Wilderness Clean",    objective:"Kill 10 wilderness bosses without dying in a single session", xp:2000 },
    { id:"ft_sv3", title:"Gauntlet Mastered",   objective:"Complete the Corrupted Gauntlet (attempts allowed)", xp:2000 },
    { id:"ft_sv4", title:"Raid Half-Century",   objective:"Complete 50 raids total", xp:1800 },
    { id:"ft_sv5", title:"Modified Streak",     objective:"Complete any hard boss 20 times with a modifier across the run", xp:1500 },
    { id:"ft_sv6", title:"Elite Wilderness",    objective:"Complete an elite diary in a wilderness-adjacent region", xp:1600 },
    { id:"ft_sv7", title:"Wilderness Sweep",    objective:"Kill every wilderness boss at least once", xp:1800 },
    { id:"ft_sv8", title:"Flawless Ten",        objective:"Complete 10 writs in a row without failure or debt", xp:1500 },
  ],
  Balanced: [
    { id:"ft_b1", title:"Warrior's Remnant",    objective:"Highest-weight uncompleted PvM writ on the account", xp:1800 },
    { id:"ft_b2", title:"Scholar's Remnant",    objective:"Highest-weight uncompleted Quest/Skill writ on the account", xp:1800 },
    { id:"ft_b3", title:"Survivor's Remnant",   objective:"Highest-weight uncompleted Endurance writ on the account", xp:1800 },
    { id:"ft_b4", title:"The Wildcard I",       objective:"Highest remaining skill gap — algorithmically identified", xp:1600 },
    { id:"ft_b5", title:"The Wildcard II",      objective:"Hardest untouched boss on the account — algorithmically identified", xp:2000 },
    { id:"ft_b6", title:"The Long Debt",        objective:"Clear any remaining debt writs from the entire run", xp:1500 },
    { id:"ft_b7", title:"The Open Road",        objective:"Complete any 3 writs from any tier pool", xp:1500 },
    { id:"ft_b8", title:"The Reckoning",        objective:"Complete any 1 writ from each of the other three pools", xp:1800 },
  ],
};

function generateFinalTrialDraft(path) {
  const pool = [...(FINAL_TRIAL_POOLS[path] || FINAL_TRIAL_POOLS.Balanced)];
  const selected = [];
  for (let i = 0; i < 5 && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    selected.push({ ...pool[idx], category:"Final Trial", tier:"Zaros", difficulty:"Elite", trial:true, finalTrial:true });
    pool.splice(idx, 1);
  }
  return selected;
}
// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function accountAverage(skillLevels) {
  const vals = Object.values(skillLevels);
  return vals.reduce((a,b) => a+b, 0) / vals.length;
}
function xpToLevel(xp) {
  for (let i = 1; i < XP_BREAKPOINTS.length; i++) {
    const prev = XP_BREAKPOINTS[i-1], curr = XP_BREAKPOINTS[i];
    if (xp < curr.xp) { const t=(xp-prev.xp)/(curr.xp-prev.xp); return Math.floor(prev.level+t*(curr.level-prev.level)); }
  }
  return 99;
}
function xpForLevel(level) {
  if (level<=1) return 0; if (level>=99) return 67000;
  for (let i=1; i<XP_BREAKPOINTS.length; i++) {
    const prev=XP_BREAKPOINTS[i-1], curr=XP_BREAKPOINTS[i];
    if (level>=prev.level&&level<=curr.level) { const t=(level-prev.level)/(curr.level-prev.level); return Math.floor(prev.xp+t*(curr.xp-prev.xp)); }
  }
  return 67000;
}
function levelProgressPct(xp) {
  const level=xpToLevel(xp); if(level>=99) return 100;
  const cur=xpForLevel(level),next=xpForLevel(level+1);
  return Math.round(((xp-cur)/(next-cur))*100);
}
function tierForLevel(l) {
  if(l<=20) return "Guthix"; if(l<=40) return "Saradomin";
  if(l<=60) return "Bandos"; if(l<=80) return "Zamorak"; return "Zaros";
}
const TIER_ORDER = ["Guthix","Saradomin","Bandos","Zamorak","Zaros"];
const TIER_GATES = [20, 40, 60, 80]; // levels where defer + reckoning must be cleared

function gapScores(skillLevels) {
  const avg=accountAverage(skillLevels); const scores={};
  Object.entries(skillLevels).forEach(([s,l])=>{ scores[s]=Math.max(0,(avg-l)/avg); });
  return scores;
}

// ─── DRAFT STATUS
function getDebtStatus(debtWrits, mustClearAll, streak, favoredDrawsRemaining) {
  if (mustClearAll) return "blocked";
  if (debtWrits.length >= 1) return "cursed";
  if ((favoredDrawsRemaining ?? 0) > 0) return "favored";
  if (streak >= 15) return "hot_streak";
  return "normal";
}
function draftSizeFromStatus(status) {
  if (status === "cursed") return 2;
  if (status === "favored") return 5;
  if (status === "hot_streak") return 4;
  return 3;
}

// ─── TRIAL CHECK: returns the next trial that should auto-trigger, or null
function getPendingTrial(mettleLevel, completedIds) {
  const trials = WRIT_POOL.filter(w => w.trial);
  // Find the lowest-level uncompleted trial that we've reached or passed
  for (const t of trials.sort((a,b) => a.triggerLevel - b.triggerLevel)) {
    if (mettleLevel >= t.triggerLevel && !completedIds.includes(t.id)) {
      return t;
    }
  }
  return null;
}

// ─── RECKONING: generate a reckoning writ for a category
const RECKONING_CATEGORIES = ["PvM Intro","PvM Endurance","Quest","Skill Gap","Endurance","Exploration","Economic"];

function generateReckoningWrit(category, reckoningCount, mettleLevel, skillLevels, bossKC) {
  // Find a writ from that category in or below the current tier to base the reckoning on
  const currentTier = tierForLevel(mettleLevel);
  const eligible = WRIT_POOL.filter(w =>
    !w.trial && (w.category === category || (category === "PvM Intro" && w.category === "PvM Endurance") || (category === "PvM Endurance" && w.category === "PvM Intro")) &&
    TIER_ORDER.indexOf(w.tier) <= TIER_ORDER.indexOf(currentTier) &&
    meetsRequirements(w, skillLevels, bossKC)
  );

  // Pick highest-weight eligible writ as the base
  let baseWrit = eligible[0];
  if (eligible.length > 1) {
    const idx = Math.floor(Math.random() * Math.min(3, eligible.length));
    baseWrit = eligible[idx];
  }

  const severity = Math.min(reckoningCount, 3); // 1, 2, or 3+
  const xpMultiplier = severity === 1 ? 1.5 : severity === 2 ? 2 : 3;
  const modifier = getModifierForCategory(category, (severity - 1) / 2);
  const baseXP = baseWrit ? baseWrit.xp : 300;
  const baseObjective = baseWrit ? resolveObjective(baseWrit, skillLevels, bossKC) : `Complete a ${category} challenge`;

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

// ─── WEIGHTING
function computeWeight(writ, skillLevels, bossKC, completedIds, suppressedIds, mettleLevel) {
  if (writ.trial) return 0;
  if (!writ.repeatable && completedIds.includes(writ.id)) return 0;
  if (suppressedIds.includes(writ.id)) return 0;
  if (!meetsRequirements(writ, skillLevels, bossKC)) return 0;

  if (TIER_ORDER.indexOf(writ.tier) > TIER_ORDER.indexOf(tierForLevel(mettleLevel))) return 0;

  const gaps = gapScores(skillLevels);
  const maxGap = Math.max(...Object.values(gaps));
  const combatAvg = (skillLevels.attack+skillLevels.strength+skillLevels.defence)/3;

  let w = 1;
  if (writ.category==="Skill Gap" && maxGap>0.10) w *= (2 + maxGap * 5);
  if ((writ.category==="PvM Intro"||writ.category==="PvM Endurance") && combatAvg>85) w *= 3;
  if (writ.category==="Quest")     w *= 2;
  if (writ.category==="Endurance") w *= 1.2;
  if (writ.category==="Economic")  w *= 0.8;

  const bossMap = { g_pvm_2:"obor", g_pvm_3:"bryophyta" };
  if (bossMap[writ.id]) {
    const kc=bossKC[bossMap[writ.id]]??0;
    if(kc===0) w*=3; else if(kc<=5) w*=2; else if(kc>20) w*=0.5;
  }
  if (writ.id==="g_pvm_1"||writ.id==="g_pvm_7") {
    const kc=bossKC.barrows_chests??0;
    if(kc===0) w*=3; else if(kc<=5) w*=2; else if(kc>20) w*=0.5;
  }
  return Math.max(0.1, w);
}

function generateDraft(skillLevels, bossKC, completedIds, recentDraftHistory, debtWrits, mettleLevel, requestedSize = null, streak = 0, favoredDrawsRemaining = 0) {
  const status = getDebtStatus(debtWrits, false, streak, favoredDrawsRemaining);
  const draftSize = requestedSize ?? draftSizeFromStatus(status);
  const suppressedIds = recentDraftHistory.flat();

  const weighted = WRIT_POOL
    .filter(w => !w.trial)
    .map(w => ({ ...w, weight: computeWeight(w, skillLevels, bossKC, completedIds, suppressedIds, mettleLevel) }))
    .filter(w => w.weight > 0);

  if (weighted.length===0) return [];
  const pool=[...weighted]; const selected=[]; const seenObjectives=new Set();
  for (let i=0; i<Math.min(draftSize,pool.length); i++) {
    const total=pool.reduce((s,c)=>s+c.weight,0);
    let rand=Math.random()*total; let idx=0;
    for(idx=0;idx<pool.length;idx++){rand-=pool[idx].weight;if(rand<=0)break;}
    idx=Math.min(idx,pool.length-1);
    const w=pool[idx];
    const resolved = {
      ...w,
      title:    resolveTitle(w, skillLevels, bossKC),
      objective:resolveObjective(w, skillLevels, bossKC),
    };
    // Deduplicate: if two dynamic writs resolve to the same objective, skip and try next
    if (seenObjectives.has(resolved.objective)) {
      pool.splice(idx,1);
      i--; // retry this slot
      continue;
    }
    // Roll modifier (~35% chance on non-trial writs)
    const mod = rollModifier(w);
    if (mod) {
      resolved.modifier = mod;
      resolved.objective = `${resolved.objective} — MODIFIER: ${mod}`;
    }
    seenObjectives.add(resolved.objective);
    selected.push(resolved);
    pool.splice(idx,1);
  }
  return selected;
}

// ─────────────────────────────────────────────
// PERSISTENCE
// ─────────────────────────────────────────────
const SAVE_KEY = "mettle_run_v7";
function loadSave() {
  if (typeof window==="undefined") return null;
  try { const raw=localStorage.getItem(SAVE_KEY); return raw?JSON.parse(raw):null; } catch { return null; }
}
function writeSave(data) {
  if (typeof window==="undefined") return;
  try { localStorage.setItem(SAVE_KEY,JSON.stringify(data)); } catch {}
}

const DEFAULT_SKILLS = Object.fromEntries(SKILLS.map(s=>[s,1]));
const DEFAULT_KC     = Object.fromEntries(KEY_BOSSES.map(b=>[b,0]));

const DIFF_COLORS = { Easy:"#4ade80",Medium:"#fbbf24",Hard:"#fb923c",Elite:"#f87171" };
const TIER_COLORS = { Guthix:"#6ee7b7",Saradomin:"#93c5fd",Bandos:"#fb923c",Zamorak:"#f87171",Zaros:"#d8b4fe" };
const CAT_COLORS  = {
  "PvM Intro":"#93c5fd","PvM Endurance":"#818cf8","Quest":"#d8b4fe",
  "Skill Gap":"#6ee7b7","Endurance":"#fcd34d","Exploration":"#7dd3fc","Economic":"#a3e635",
  "Fork":"#dc2626","Landmark":"#3b82f6","Final Trial":"#d8b4fe",
};


function trialFlavorLine(trial) {
  if (!trial) return "The board has made its judgment.";
  if (trial.tier === "Zaros") return "Your path narrows. Only proof remains.";
  if (trial.category === "Trial") return "The board has measured your account and found a weakness worth naming.";
  return "Comfort is not part of this trial.";
}

function trialCeremonyLabel(trial) {
  if (!trial) return "A writ has been drawn";
  if (trial.tier === "Guthix") return "A writ has been drawn";
  if (trial.tier === "Saradomin") return "A sealed directive emerges";
  if (trial.tier === "Bandos") return "A harsher writ is invoked";
  if (trial.tier === "Zamorak") return "A blood-marked decree descends";
  if (trial.tier === "Zaros") return "The final reckoning stirs";
  return "A writ has been drawn";
}

function activeTrialPrompt(trial) {
  if (!trial) return "Proof is demanded.";
  if (trial.acceptedAt) {
    if (trial.trialModifier) return "The terms are fixed. Enter prepared and clear the trial.";
    if (trial.tier === "Zaros") return "The trial stands open. Only execution remains.";
    if (trial.tier === "Zamorak") return "No more ceremony. The board expects action.";
    return "The writ is now active. Enter and settle it.";
  }
  if (trial.trialModifier) return "Restriction imposed. Completion now carries weight.";
  if (trial.tier === "Zaros") return "No lesser answer will satisfy this trial.";
  if (trial.tier === "Zamorak") return "This writ does not ask politely.";
  return "The moment has arrived. Only completion settles the draw.";
}

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────
export default function MettlePrototype() {
  const [inputMode,    setInputMode]    = useState("manual");
  const [rsn,          setRsn]          = useState("");
  const [loading,      setLoading]      = useState(false);
  const [fetchError,   setFetchError]   = useState("");
  const [statsLoaded,  setStatsLoaded]  = useState(false);
  const [manualSkills, setManualSkills] = useState(DEFAULT_SKILLS);
  const [manualKC,     setManualKC]     = useState(DEFAULT_KC);
  const [skillLevels,  setSkillLevels]  = useState(DEFAULT_SKILLS);
  const [bossKC,       setBossKC]       = useState(DEFAULT_KC);

  const [mettleXP,       setMettleXP]       = useState(0);
  const [mettleSeals,    setMettleSeals]    = useState(0);
  const [streak,         setStreak]         = useState(0);
  const [completedIds,   setCompletedIds]   = useState([]);
  const [history,        setHistory]        = useState([]);
  const [debtWrits,      setDebtWrits]      = useState([]);
  const [mustClearAll,   setMustClearAll]   = useState(false);
  const [draftHistory,   setDraftHistory]   = useState([]);
  const [currentDraft,   setCurrentDraft]   = useState([]);
  const [activeWrit,     setActiveWrit]     = useState(null);
  const [activeView,     setActiveView]     = useState("board");
  const [xpDrop,         setXpDrop]         = useState(null);

  // ── TRIAL REVEAL STATE
  const [trialPhase,     setTrialPhase]     = useState(null); // null | "approaching" | "revealed"
  const [pendingTrialData, setPendingTrialData] = useState(null);
  const [trialCeremonyStep, setTrialCeremonyStep] = useState(0);

  // ── HISTORY EXPAND
  const [expandedHistoryIdx, setExpandedHistoryIdx] = useState(null);

  // ── RESET CONFIRM
  const [confirmReset, setConfirmReset] = useState(false);

  // ── RECKONING STATE
  const [categoryDeferCounts, setCategoryDeferCounts] = useState({}); // { "PvM Intro": 2, "Quest": 1 }
  const [reckoningWrits,      setReckoningWrits]      = useState([]); // active reckoning writs (max 2)
  const [reckoningTotals,     setReckoningTotals]     = useState({}); // cumulative reckoning count per category (for escalation)

  // ── FAVORED STATE
  const [favoredDrawsRemaining, setFavoredDrawsRemaining] = useState(0); // 5 draws of Favored after Trial completion

  // ── FORK STATE
  const [completedForks, setCompletedForks] = useState({}); // { "fork_ancient_path": { chosen: "a", rejected: "b" } }
  const [activeFork, setActiveFork]         = useState(null); // the fork currently being presented
  const [forkPhase, setForkPhase]           = useState(null); // null | "presenting"

  // ── LANDMARK STATE
  const [completedLandmarks, setCompletedLandmarks] = useState([]); // ids of completed landmarks
  const [activeLandmark, setActiveLandmark]         = useState(null); // landmark currently being presented
  const [landmarkPhase, setLandmarkPhase]           = useState(null); // null | "revealed"

  // ── FINAL TRIAL PATH STATE
  const [assignedPath, setAssignedPath]             = useState(null); // "Warrior" | "Scholar" | "Survivor" | "Balanced"
  const [pathRevealed, setPathRevealed]             = useState(false);

  // ── LOAD
  useEffect(() => {
    const save=loadSave(); if(!save) return;
    if(save.skillLevels)         setSkillLevels(save.skillLevels);
    if(save.bossKC)              setBossKC(save.bossKC);
    if(save.mettleXP)            setMettleXP(save.mettleXP);
    if(save.mettleSeals)         setMettleSeals(save.mettleSeals);
    if(save.streak)              setStreak(save.streak);
    if(save.completedIds)        setCompletedIds(save.completedIds);
    if(save.history)             setHistory(save.history);
    if(save.debtWrits)           setDebtWrits(save.debtWrits);
    if(save.mustClearAll)        setMustClearAll(save.mustClearAll);
    if(save.draftHistory)        setDraftHistory(save.draftHistory);
    if(save.statsLoaded)         setStatsLoaded(save.statsLoaded);
    if(save.rsn)                 setRsn(save.rsn);
    if(save.categoryDeferCounts) setCategoryDeferCounts(save.categoryDeferCounts);
    if(save.reckoningWrits)      setReckoningWrits(save.reckoningWrits);
    if(save.reckoningTotals)     setReckoningTotals(save.reckoningTotals);
    if(save.favoredDrawsRemaining) setFavoredDrawsRemaining(save.favoredDrawsRemaining);
    if(save.completedForks)      setCompletedForks(save.completedForks);
    if(save.completedLandmarks)  setCompletedLandmarks(save.completedLandmarks);
    if(save.assignedPath)        setAssignedPath(save.assignedPath);
    if(save.pathRevealed)        setPathRevealed(save.pathRevealed);
  }, []);

  // ── SAVE
  useEffect(() => {
    if(!statsLoaded) return;
    writeSave({ skillLevels,bossKC,mettleXP,mettleSeals,streak,completedIds,history,debtWrits,mustClearAll,draftHistory,statsLoaded,rsn,categoryDeferCounts,reckoningWrits,reckoningTotals,favoredDrawsRemaining,completedForks,completedLandmarks,assignedPath,pathRevealed });
  }, [skillLevels,bossKC,mettleXP,mettleSeals,streak,completedIds,history,debtWrits,mustClearAll,draftHistory,statsLoaded,rsn,categoryDeferCounts,reckoningWrits,reckoningTotals,favoredDrawsRemaining,completedForks,completedLandmarks,assignedPath,pathRevealed]);

  const mettleLevel = xpToLevel(mettleXP);
  const currentTier = tierForLevel(mettleLevel);
  const progressPct = levelProgressPct(mettleXP);
  const xpToNext    = xpForLevel(mettleLevel+1)-mettleXP;
  const draftStatus = getDebtStatus(debtWrits, mustClearAll, streak, favoredDrawsRemaining);
  const avg         = accountAverage(skillLevels);
  const unlocked    = unlockedFeatures(mettleLevel);
  const nextUnlock  = METTLE_UNLOCKS.find(x => mettleLevel < x.level);

  // ── TIER GATE CHECK: are we at a gate level with uncleared debt/reckoning?
  const atTierGate = TIER_GATES.includes(mettleLevel) || TIER_GATES.some(g => mettleLevel > g && mettleLevel <= g + 1);
  const gateBlocked = atTierGate && (debtWrits.length > 0 || reckoningWrits.length > 0);

  // ── TRIAL CHECK
  const pendingTrial = getPendingTrial(mettleLevel, completedIds);

  // ── WARNING CATEGORIES (at 2 defers)
  const warningCategories = Object.entries(categoryDeferCounts)
    .filter(([_, count]) => count >= 2 && count < 3)
    .map(([cat]) => cat);

  useEffect(() => {
    if (trialPhase !== "revealed") {
      setTrialCeremonyStep(0);
      return;
    }
    setTrialCeremonyStep(1);
    const timers = [
      setTimeout(() => setTrialCeremonyStep(2), 260),
      setTimeout(() => setTrialCeremonyStep(3), 760),
      setTimeout(() => setTrialCeremonyStep(4), 1320),
      setTimeout(() => setTrialCeremonyStep(5), 1820),
    ];
    return () => timers.forEach(clearTimeout);
  }, [trialPhase, pendingTrialData]);

  function confirmManualStats() { setSkillLevels({...manualSkills}); setBossKC({...manualKC}); setStatsLoaded(true); setFetchError(""); }

  async function loadPlayerStats() {
    const trimmed=rsn.trim(); if(!trimmed) return;
    setLoading(true); setFetchError("");
    try {
      const res=await fetch(`/api/player/${encodeURIComponent(trimmed)}`);
      if(!res.ok) throw new Error(`${res.status}`);
      const data=await res.json();
      const levels={}; SKILLS.forEach(s=>{levels[s]=data?.skills?.[s]??1;});
      setSkillLevels(levels); setManualSkills(levels);
      const kc={}; KEY_BOSSES.forEach(b=>{kc[b]=data?.bosses?.[b]??0;});
      setBossKC(kc); setManualKC(kc); setStatsLoaded(true);
    } catch { setFetchError("Failed to load — check your RSN and try again."); }
    finally { setLoading(false); }
  }

  function drawWrits() {
    if (activeWrit) return;
    if (mustClearAll || debtWrits.length >= 3) return;
    if (reckoningWrits.length > 0) return;
    if (activeFork || activeLandmark) return;

    // Landmark check — auto-trigger if conditions met
    const pendingLandmark = getPendingLandmark(skillLevels, bossKC, completedLandmarks);
    if (pendingLandmark) {
      setActiveLandmark(pendingLandmark);
      setLandmarkPhase("revealed");
      return;
    }

    // Fork check — auto-trigger if conditions met
    const pendingFork = getPendingFork(mettleLevel, completedForks, completedIds);
    if (pendingFork) {
      setActiveFork(pendingFork);
      setForkPhase("presenting");
      return;
    }

    // Trial reveal sequence
    if (pendingTrial) {
      if (!trialPhase) {
        const resolved = {
          ...pendingTrial,
          title: resolveTitle(pendingTrial, skillLevels, bossKC),
          objective: resolveObjective(pendingTrial, skillLevels, bossKC),
        };
        setPendingTrialData(resolved);
        setTrialPhase("approaching");
        return;
      }
    }

    const last5=draftHistory.slice(-5);
    const draft=generateDraft(skillLevels,bossKC,completedIds,last5,debtWrits,mettleLevel,null,streak,favoredDrawsRemaining);
    setCurrentDraft(draft);
    setDraftHistory(prev=>[...prev,draft.map(w=>w.id)]);
    // Decrement favored draws if active
    if (favoredDrawsRemaining > 0) {
      setFavoredDrawsRemaining(prev => prev - 1);
    }
  }

  function rerollCurrentDraft() {
    if (currentDraft.length === 0 || mettleSeals < REROLL_COST) return;
    const last5 = draftHistory.slice(-5);
    const draft = generateDraft(skillLevels, bossKC, completedIds, last5, debtWrits, mettleLevel, currentDraft.length);
    setMettleSeals(prev => prev - REROLL_COST);
    setCurrentDraft(draft);
    setDraftHistory(prev => [...prev, draft.map(w => w.id)]);
  }

  function buyExtraDraftChoice() {
    if (currentDraft.length === 0 || currentDraft.length >= 5 || mettleSeals < EXTRA_CHOICE_COST) return;
    const last5 = draftHistory.slice(-5);
    const expanded = generateDraft(skillLevels, bossKC, completedIds, last5, debtWrits, mettleLevel, currentDraft.length + 1);
    setMettleSeals(prev => prev - EXTRA_CHOICE_COST);
    setCurrentDraft(expanded);
    setDraftHistory(prev => [...prev, expanded.map(w => w.id)]);
  }

  function revealTrial() {
    setTrialCeremonyStep(0);
    setTrialPhase("revealed");
  }

  function acceptTrial() {
    if (!pendingTrialData || trialCeremonyStep < 5) return;
    setActiveWrit({ ...pendingTrialData, acceptedAt: Date.now() });
    setTrialPhase(null);
    setPendingTrialData(null);
    setTrialCeremonyStep(0);
  }

  function chooseWrit(writ) { setCurrentDraft([]); setActiveWrit(writ); }

  // ── FORK HANDLERS
  function chooseForkOption(fork, option) {
    // option is "a" or "b"
    const chosen = option === "a" ? fork.optionA : fork.optionB;
    const rejected = option === "a" ? fork.optionB : fork.optionA;
    setCompletedForks(prev => ({ ...prev, [fork.id]: { chosen: chosen.label, rejected: rejected.label, option } }));
    // Create an active writ from the chosen fork option
    setActiveWrit({
      id: fork.id,
      title: `${fork.title}: ${chosen.label}`,
      category: "Fork",
      tier: fork.tier,
      difficulty: fork.difficulty,
      xp: fork.xp,
      objective: chosen.objective,
      fork: true,
      forkTitle: fork.title,
      chosenLabel: chosen.label,
      rejectedLabel: rejected.label,
    });
    setActiveFork(null);
    setForkPhase(null);
  }

  // ── LANDMARK HANDLERS
  function acknowledgeLandmark() {
    if (!activeLandmark) return;
    const lm = activeLandmark;
    setCompletedLandmarks(prev => [...prev, lm.id]);
    const xpGained = lm.xp;
    const sealsGained = 3; // landmark bonus
    setMettleXP(prev => Math.min(67000, prev + xpGained));
    setMettleSeals(prev => prev + sealsGained);
    setXpDrop({ amount: xpGained, id: Date.now() });
    setTimeout(() => setXpDrop(null), 1800);
    setHistory(prev => [{ ...lm, result: "landmark", xpGained, sealsGained, timestamp: Date.now() }, ...prev]);
    setActiveLandmark(null);
    setLandmarkPhase(null);
  }

  // ── PATH ASSIGNMENT (auto-assign when entering Zaros tier)
  useEffect(() => {
    if (mettleLevel >= 81 && !assignedPath && history.length > 0) {
      const path = computePath(history);
      setAssignedPath(path);
    }
  }, [mettleLevel, history, assignedPath]);

  function removeActiveModifier() {
    if (!activeWrit?.modifier || mettleSeals < REMOVE_MODIFIER_COST) return;
    setMettleSeals(prev => prev - REMOVE_MODIFIER_COST);
    setActiveWrit(prev => {
      if (!prev) return prev;
      const cleanedObjective = prev.objective.replace(/\s+— MODIFIER: .*$/, "");
      return { ...prev, modifier: null, objective: cleanedObjective, modifierRemoved: true };
    });
  }

  function resolveWrit(result) {
    if (!activeWrit) return;
    if (activeWrit.trial && result === "defer") return;
    let xpGained=0;
    let sealsGained=0;
    let nextStreak = streak;
    if (result==="complete") {
      xpGained=writXp(activeWrit);
      sealsGained=sealsForWrit(activeWrit);
      nextStreak = streak + 1;
      sealsGained += streakSealBonus(nextStreak);
      if(!completedIds.includes(activeWrit.id)) setCompletedIds(prev=>[...prev,activeWrit.id]);
      setXpDrop({amount:writXp(activeWrit),id:Date.now()});
      setTimeout(()=>setXpDrop(null),1800);
      // Grant Favored state for 5 draws after completing a Trial
      if (activeWrit.trial) {
        setFavoredDrawsRemaining(prev => prev + 5);
      }
    } else if (result==="defer") {
      nextStreak = 0;
      const cat = activeWrit.category;
      const newDeferCounts = { ...categoryDeferCounts, [cat]: (categoryDeferCounts[cat] || 0) + 1 };
      setCategoryDeferCounts(newDeferCounts);

      const newDebt=[...debtWrits,{...activeWrit}];
      setDebtWrits(newDebt);
      if (newDebt.length>=3) setMustClearAll(true);

      // Check if this category hit reckoning threshold (3 defers)
      if (newDeferCounts[cat] >= 3 && reckoningWrits.length < 2) {
        const totalForCat = (reckoningTotals[cat] || 0) + 1;
        setReckoningTotals(prev => ({ ...prev, [cat]: totalForCat }));
        const rw = generateReckoningWrit(cat, totalForCat, mettleLevel, skillLevels, bossKC);
        setReckoningWrits(prev => [...prev, rw]);
        // Reset the category defer count
        setCategoryDeferCounts(prev => ({ ...prev, [cat]: 0 }));
      }
    }
    if(xpGained>0) setMettleXP(prev=>Math.min(67000,prev+xpGained));
    if(sealsGained>0) setMettleSeals(prev=>prev+sealsGained);
    setStreak(nextStreak);
    setHistory(prev=>[{...activeWrit,result,xpGained,sealsGained,baseXp:activeWrit.xp,modifierXpBonus:modifierXpBonus(activeWrit),streakAfter:nextStreak,timestamp:Date.now()},...prev]);
    setActiveWrit(null);
  }

  function clearDebtWrit(id) {
    const c=debtWrits.find(x=>x.id===id); if(!c) return;
    const newDebt=debtWrits.filter(x=>x.id!==id);
    const nextStreak = streak + 1;
    const sealsGained = sealsForWrit(c) + streakSealBonus(nextStreak);
    setDebtWrits(newDebt);
    if (newDebt.length===0) setMustClearAll(false);
    setMettleXP(prev=>Math.min(67000,prev+writXp(c)));
    setMettleSeals(prev=>prev+sealsGained);
    setStreak(nextStreak);
    if(!completedIds.includes(c.id)) setCompletedIds(prev=>[...prev,c.id]);
    setHistory(prev=>[{...c,result:"debt_cleared",xpGained:writXp(c),sealsGained,baseXp:c.xp,modifierXpBonus:modifierXpBonus(c),streakAfter:nextStreak,timestamp:Date.now()},...prev]);
  }

  function clearReckoningWrit(id) {
    const rw = reckoningWrits.find(x => x.id === id); if (!rw) return;
    const nextStreak = streak + 1;
    const sealsGained = sealsForWrit(rw) + streakSealBonus(nextStreak);
    setReckoningWrits(prev => prev.filter(x => x.id !== id));
    setMettleXP(prev => Math.min(67000, prev + writXp(rw)));
    setMettleSeals(prev => prev + sealsGained);
    setStreak(nextStreak);
    setXpDrop({ amount: writXp(rw), id: Date.now() });
    setTimeout(() => setXpDrop(null), 1800);
    setHistory(prev => [{ ...rw, result: "reckoning_cleared", xpGained: writXp(rw), sealsGained, baseXp:rw.xp, modifierXpBonus:modifierXpBonus(rw), streakAfter: nextStreak, timestamp: Date.now() }, ...prev]);
  }

  function failReckoningWrit(id) {
    const rw = reckoningWrits.find(x => x.id === id); if (!rw) return;
    setReckoningWrits(prev => prev.filter(x => x.id !== id));
    const newDebt = [...debtWrits, { ...rw }];
    setDebtWrits(newDebt);
    setStreak(0);
    if (newDebt.length >= 3) setMustClearAll(true);
    setCategoryDeferCounts(prev => ({ ...prev, [rw.category]: (prev[rw.category] || 0) + 1 }));
    setHistory(prev => [{ ...rw, result: "reckoning_failed", xpGained: 0, sealsGained: 0, streakAfter: 0, timestamp: Date.now() }, ...prev]);
  }

  function resetRun() {
    if (!confirmReset) { setConfirmReset(true); return; }
    setMettleXP(0); setMettleSeals(0); setStreak(0); setCompletedIds([]); setHistory([]);
    setDebtWrits([]); setMustClearAll(false); setDraftHistory([]); setCurrentDraft([]); setActiveWrit(null);
    setCategoryDeferCounts({}); setReckoningWrits([]); setReckoningTotals({});
    setTrialPhase(null); setPendingTrialData(null); setExpandedHistoryIdx(null);
    setFavoredDrawsRemaining(0);
    setCompletedForks({}); setActiveFork(null); setForkPhase(null);
    setCompletedLandmarks([]); setActiveLandmark(null); setLandmarkPhase(null);
    setAssignedPath(null); setPathRevealed(false);
    setConfirmReset(false);
    try { localStorage.removeItem(SAVE_KEY); } catch {}
  }

  const s = {
    root:      { fontFamily:"'Courier New', monospace",background:"#0c0c0c",color:"#d4d4d4",minHeight:"100vh",padding:"24px",maxWidth:"960px",margin:"0 auto" },
    header:    { borderBottom:"1px solid #2a2a2a",paddingBottom:"20px",marginBottom:"24px" },
    xpBar:     { height:"3px",background:"#222",marginTop:"14px",borderRadius:"2px" },
    xpFill:    pct=>({height:"100%",background:"#fff",borderRadius:"2px",width:`${pct}%`,transition:"width 0.4s"}),
    btn:       (active,bg,fg)=>({ padding:"8px 18px",fontFamily:"inherit",fontWeight:"700",fontSize:"12px",letterSpacing:"1px", background:bg||(active?"#fff":"#111"),color:fg||(active?"#000":"#888"),border:`1px solid ${active?"#fff":"#2a2a2a"}`,cursor:"pointer" }),
    secHead:   { fontSize:"10px",letterSpacing:"3px",color:"#555",marginBottom:"12px" },
    activeCard:{ border:"1px solid #555",padding:"20px",background:"#131313",marginBottom:"16px" },
    debtCard:  { border:"1px solid #3d1515",padding:"12px 16px",background:"#0f0808",marginBottom:"6px",display:"flex",justifyContent:"space-between",alignItems:"center" },
    reckoningCard: { border:"1px solid #6b21a8",padding:"12px 16px",background:"#0f0a14",marginBottom:"6px" },
    draftGrid: n=>({ display:"grid",gridTemplateColumns:`repeat(${Math.min(n, 3)}, 1fr)`,gap:"12px" }),
    draftCard: { border:"1px solid #2a2a2a",padding:"16px",background:"#0f0f0f",cursor:"pointer" },
    tag:       color=>({ display:"inline-block",fontSize:"10px",letterSpacing:"1px",color:color||"#555",marginRight:"8px" }),
    numInput:  { background:"#0c0c0c",border:"1px solid #2a2a2a",color:"#fff",padding:"2px 6px",fontFamily:"inherit",fontSize:"12px",textAlign:"right" },
    footer:    { marginTop:"48px",borderTop:"1px solid #1a1a1a",paddingTop:"12px",display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:"8px",fontSize:"10px",color:"#3a3a3a",letterSpacing:"1px" },
  };

  const statusColor = draftStatus==="blocked"?"#f87171":draftStatus==="cursed"?"#fbbf24":draftStatus==="favored"?"#c4b5fd":draftStatus==="hot_streak"?"#fb923c":"#4ade80";
  const tierColor   = TIER_COLORS[currentTier]||"#fff";
  const writPoolCount = WRIT_POOL.filter(w=>!w.trial).length;
  const tierCounts = TIER_ORDER.map(t=>({
    tier:t, color:TIER_COLORS[t],
    count:WRIT_POOL.filter(w=>w.tier===t&&!w.trial).length,
    done:completedIds.filter(id=>WRIT_POOL.find(w=>w.id===id&&w.tier===t)).length,
  }));

  // Can we draw? Check all blockers
  const hasReckonings = reckoningWrits.length > 0;
  const hasForkPending = !!activeFork;
  const hasLandmarkPending = !!activeLandmark;
  const drawBlocked = mustClearAll || debtWrits.length >= 3 || hasReckonings || gateBlocked || hasForkPending || hasLandmarkPending;
  let blockReason = "";
  if (hasForkPending) blockReason = "FORK WRIT ACTIVE — CHOOSE A PATH";
  else if (hasLandmarkPending) blockReason = "LANDMARK ACTIVE — ACKNOWLEDGE TO CONTINUE";
  else if (hasReckonings) blockReason = `CLEAR ${reckoningWrits.length} RECKONING WRIT${reckoningWrits.length>1?"S":""} TO DRAW`;
  else if (mustClearAll) blockReason = `CLEAR ALL ${debtWrits.length} DEFERRED WRITS TO DRAW`;
  else if (gateBlocked) blockReason = "CLEAR ALL DEBT & RECKONINGS TO ADVANCE PAST TIER GATE";

  return (
    <div style={s.root}>
      <style>{`
        @keyframes xpFloat {
          0%   { opacity:1; transform:translateY(0px) scale(1); }
          20%  { opacity:1; transform:translateY(-12px) scale(1.15); }
          100% { opacity:0; transform:translateY(-60px) scale(0.9); }
        }
        .xp-drop {
          position:fixed; top:40%; left:50%; transform:translateX(-50%);
          font-family:'Courier New',monospace; font-size:28px; font-weight:700;
          color:#fbbf24; text-shadow:0 0 20px #fbbf2488,0 2px 4px #000;
          pointer-events:none; z-index:9999;
          animation:xpFloat 1.8s ease-out forwards;
          letter-spacing:2px; white-space:nowrap;
        }
        @keyframes reckoningPulse {
          0%, 100% { border-color: #6b21a8; }
          50%      { border-color: #a855f7; }
        }
        @keyframes trialGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(212,175,55,0.15); border-color: #d4af37; }
          50%      { box-shadow: 0 0 40px rgba(212,175,55,0.35); border-color: #fbbf24; }
        }
        @keyframes trialRevealIn {
          0%   { opacity:0; transform:scale(0.92); }
          100% { opacity:1; transform:scale(1); }
        }
        @keyframes trialTextIn {
          0%   { opacity:0; transform:translateY(12px); }
          100% { opacity:1; transform:translateY(0); }
        }
        @keyframes modifierFlash {
          0%, 80% { opacity:1; }
          90%     { opacity:0.6; }
          100%    { opacity:1; }
        }
        @keyframes forkPulse {
          0%, 100% { border-color: #dc2626; box-shadow: 0 0 20px rgba(220,38,38,0.12); }
          50%      { border-color: #ef4444; box-shadow: 0 0 40px rgba(239,68,68,0.25); }
        }
        @keyframes landmarkGlow {
          0%, 100% { border-color: #3b82f6; box-shadow: 0 0 20px rgba(59,130,246,0.15); }
          50%      { border-color: #60a5fa; box-shadow: 0 0 40px rgba(96,165,250,0.30); }
        }
        @keyframes pathReveal {
          0%   { opacity:0; transform:translateY(16px) scale(0.95); }
          100% { opacity:1; transform:translateY(0) scale(1); }
        }
        @keyframes trialSigilPulse {
          0%, 100% { transform:scale(1); opacity:0.82; }
          50%      { transform:scale(1.06); opacity:1; }
        }
        @keyframes trialDividerGrow {
          0%   { opacity:0; transform:scaleX(0.3); }
          100% { opacity:1; transform:scaleX(1); }
        }
        .trial-stage-hidden { opacity:0; transform:translateY(10px); }
        .trial-stage-live { animation:trialTextIn 0.55s ease-out both; }
      `}</style>

      {xpDrop && <div key={xpDrop.id} className="xp-drop">+{xpDrop.amount.toLocaleString()} XP</div>}

      {/* HEADER */}
      <div style={s.header}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <div style={{fontSize:"32px",fontWeight:"700",letterSpacing:"10px",color:"#fff",margin:0}}>METTLE</div>
            <div style={{fontSize:"10px",color:"#555",letterSpacing:"4px",marginTop:"4px"}}>WRIT SKILL — PROTOTYPE v1.0</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:"28px",fontWeight:"700",color:"#fff"}}>
              LVL {String(mettleLevel).padStart(2,"0")}
              <span style={{fontSize:"14px",color:"#444",marginLeft:"6px"}}>/99</span>
            </div>
            <div style={{fontSize:"11px",color:"#666",marginTop:"2px"}}>
              {mettleXP.toLocaleString()} XP · {mettleLevel<99?`${xpToNext.toLocaleString()} to next`:"MAX"}
            </div>
            <div style={{fontSize:"11px",color:"#9ca3af",marginTop:"2px"}}>
              {mettleSeals} seals · {streak} streak{nextUnlock ? ` · next unlock ${nextUnlock.level}` : " · all unlocks earned"}
            </div>
            <div style={{fontSize:"11px",marginTop:"2px"}}>
              <span style={{color:tierColor}}>{currentTier}</span>
              <span style={{color:"#333",margin:"0 6px"}}>·</span>
              <span style={{color:statusColor}}>{draftStatus.toUpperCase()}</span>
              {draftStatus === "favored" && (
                <span style={{color:"#c4b5fd",fontSize:"10px",marginLeft:"6px"}}>
                  · {favoredDrawsRemaining} FAVORED DRAWS
                </span>
              )}
              {draftStatus === "hot_streak" && (
                <span style={{color:"#fbbf24",fontSize:"10px",marginLeft:"6px"}}>
                  · 🔥 4 OPTIONS
                </span>
              )}
              {hasReckonings && (
                <span style={{color:"#a855f7",fontSize:"10px",marginLeft:"6px"}}>
                  · {reckoningWrits.length} RECKONING
                </span>
              )}
              {mustClearAll && debtWrits.length>0 && (
                <span style={{color:"#f87171",fontSize:"10px",marginLeft:"6px"}}>
                  — CLEAR ALL {debtWrits.length} TO UNLOCK
                </span>
              )}
            </div>
          </div>
        </div>
        <div style={s.xpBar}><div style={s.xpFill(progressPct)}/></div>
        {statsLoaded && (
          <div style={{display:"flex",gap:"4px",marginTop:"10px"}}>
            {tierCounts.map(t=>(
              <div key={t.tier} style={{flex:1,fontSize:"9px",color:t.color,opacity:currentTier===t.tier?1:0.35}}>
                <div style={{letterSpacing:"2px",marginBottom:"3px"}}>{t.tier.toUpperCase().slice(0,3)}</div>
                <div style={{height:"2px",background:"#222",borderRadius:"1px"}}>
                  <div style={{height:"100%",background:t.color,borderRadius:"1px",width:`${t.count>0?(t.done/t.count)*100:0}%`,transition:"width 0.4s"}}/>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* STAT ENTRY */}
      {!statsLoaded && (
        <div style={{border:"1px solid #2a2a2a",padding:"20px",marginBottom:"20px",background:"#0e0e0e"}}>
          <div style={{display:"flex",gap:"4px",marginBottom:"16px"}}>
            {["manual","wom"].map(m=>(
              <button key={m} style={s.btn(inputMode===m)} onClick={()=>setInputMode(m)}>
                {m==="manual"?"MANUAL ENTRY":"WISE OLD MAN"}
              </button>
            ))}
          </div>
          {inputMode==="wom" && (
            <div>
              <div style={{display:"flex",gap:"8px"}}>
                <input style={{flex:1,background:"#111",border:"1px solid #2a2a2a",color:"#fff",padding:"8px 12px",fontFamily:"inherit",fontSize:"13px",outline:"none"}}
                  type="text" placeholder="Enter RSN..." value={rsn}
                  onChange={e=>setRsn(e.target.value)} onKeyDown={e=>e.key==="Enter"&&loadPlayerStats()}/>
                <button style={s.btn(false,loading?"#1a1a1a":"#fff",loading?"#555":"#000")} onClick={loadPlayerStats} disabled={loading}>
                  {loading?"LOADING...":"LOAD"}
                </button>
              </div>
              {fetchError && <div style={{color:"#f87171",fontSize:"11px",marginTop:"8px"}}>⚠ {fetchError}</div>}
            </div>
          )}
          {inputMode==="manual" && (
            <div>
              <div style={s.secHead}>SKILLS</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(150px, 1fr))",gap:"3px",marginBottom:"20px"}}>
                {SKILLS.map(skill=>(
                  <div key={skill} style={{display:"flex",alignItems:"center",gap:"6px",background:"#111",padding:"5px 8px"}}>
                    <span style={{flex:1,fontSize:"11px",color:"#666",textTransform:"capitalize"}}>{skill}</span>
                    <input type="number" min="1" max="99" value={manualSkills[skill]}
                      onChange={e=>setManualSkills(prev=>({...prev,[skill]:Math.min(99,Math.max(1,parseInt(e.target.value)||1))}))}
                      style={{...s.numInput,width:"40px"}}/>
                  </div>
                ))}
              </div>
              <div style={s.secHead}>BOSS KC</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(210px, 1fr))",gap:"3px",marginBottom:"20px"}}>
                {KEY_BOSSES.map(boss=>(
                  <div key={boss} style={{display:"flex",alignItems:"center",gap:"6px",background:"#111",padding:"5px 8px"}}>
                    <span style={{flex:1,fontSize:"10px",color:"#666"}}>{boss.replace(/_/g," ")}</span>
                    <input type="number" min="0" value={manualKC[boss]}
                      onChange={e=>setManualKC(prev=>({...prev,[boss]:Math.max(0,parseInt(e.target.value)||0)}))}
                      style={{...s.numInput,width:"52px"}}/>
                  </div>
                ))}
              </div>
              <button style={{...s.btn(true),padding:"10px 32px"}} onClick={confirmManualStats}>CONFIRM — START RUN</button>
            </div>
          )}
        </div>
      )}

      {statsLoaded && (
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px",fontSize:"11px"}}>
          <span style={{color:"#4ade80"}}>✓ {rsn||"STATS LOADED"} · AVG {avg.toFixed(1)} · {completedIds.length}/{writPoolCount} WRITS · {mettleSeals} SEALS · {streak} STREAK</span>
          <button style={{...s.btn(false),fontSize:"10px",padding:"4px 10px"}} onClick={()=>setStatsLoaded(false)}>EDIT STATS</button>
        </div>
      )}

      {statsLoaded && (
        <div style={{display:"flex",gap:"4px",marginBottom:"24px"}}>
          {["board","stats","history"].map(v=>(
            <button key={v} style={s.btn(activeView===v)} onClick={()=>setActiveView(v)}>{v.toUpperCase()}</button>
          ))}
          <div style={{flex:1}}/>
          {confirmReset ? (
            <div style={{display:"flex",gap:"4px"}}>
              <button style={{...s.btn(false),color:"#f87171",borderColor:"#3d1515"}} onClick={resetRun}>CONFIRM RESET</button>
              <button style={{...s.btn(false),color:"#555"}} onClick={()=>setConfirmReset(false)}>CANCEL</button>
            </div>
          ) : (
            <button style={{...s.btn(false),color:"#444"}} onClick={resetRun}>RESET RUN</button>
          )}
        </div>
      )}

      {/* ══ BOARD ══ */}
      {statsLoaded && activeView==="board" && (
        <div>
          {/* RECKONING WRITS — top priority, above debt */}
          {reckoningWrits.length > 0 && (
            <div style={{border:"1px solid #6b21a8",padding:"16px",background:"#0a0612",marginBottom:"20px",animation:"reckoningPulse 3s infinite"}}>
              <div style={{...s.secHead,color:"#a855f7"}}>
                ⚡ RECKONING — {reckoningWrits.length} ACTIVE · MUST CLEAR TO DRAW OR ADVANCE
              </div>
              {reckoningWrits.map((rw, i) => (
                <div key={i} style={s.reckoningCard}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"8px"}}>
                    <div>
                      <div style={{color:"#a855f7",fontSize:"14px",fontWeight:"700"}}>⚡ {rw.title}</div>
                      <div style={{fontSize:"10px",color:"#666",marginTop:"2px"}}>
                        <span style={s.tag("#a855f7")}>RECKONING #{rw.reckoningCount}</span>
                        <span style={s.tag(DIFF_COLORS[rw.difficulty])}>{rw.difficulty.toUpperCase()}</span>
                        <span style={s.tag("#555")}>{writXp(rw)} XP</span>
                      </div>
                    </div>
                  </div>
                  <div style={{fontSize:"12px",color:"#999",marginBottom:"4px"}}>{rw.objective}</div>
                  <div style={{fontSize:"11px",color:"#7c3aed",marginBottom:"12px"}}>MODIFIER: {rw.modifier}</div>
                  <div style={{display:"flex",gap:"8px"}}>
                    <button style={s.btn(false,"#14380f","#4ade80")} onClick={()=>clearReckoningWrit(rw.id)}>
                      ✓ COMPLETE (+{writXp(rw)} XP)
                    </button>
                    <button style={s.btn(false,"#1a0a0a","#f87171")} onClick={()=>failReckoningWrit(rw.id)}>
                      ✗ FAIL → DEFER QUEUE
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* CATEGORY WARNINGS (2 defers) */}
          {warningCategories.length > 0 && (
            <div style={{border:"1px solid #44337a",padding:"10px 16px",background:"#0e0a16",marginBottom:"12px",fontSize:"11px",color:"#a78bfa"}}>
              ⚠ RECKONING WARNING — {warningCategories.join(", ")} at 2 defers. One more defer triggers a Reckoning Writ.
            </div>
          )}

          {/* PENDING TRIAL NOTICE */}
          {pendingTrial && !activeWrit && !trialPhase && currentDraft.length === 0 && !activeFork && !activeLandmark && (
            <div style={{border:"1px solid #d4af37",padding:"10px 16px",background:"#141008",marginBottom:"12px",fontSize:"11px",color:"#fbbf24"}}>
              ⚔ TRIAL OF METTLE APPROACHING — Level {pendingTrial.triggerLevel}. The board demands you answer.
            </div>
          )}

          {/* PATH INDICATOR (Zaros tier) */}
          {assignedPath && (
            <div style={{border:"1px solid #6b21a8",padding:"10px 16px",background:"#0f0a14",marginBottom:"12px",fontSize:"11px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{color:"#d8b4fe",letterSpacing:"2px"}}>PATH ASSIGNED: <span style={{color:"#fff",fontWeight:"700"}}>{assignedPath.toUpperCase()}</span></span>
              <span style={{color:"#555"}}>Final Trial pool locked at Level 99</span>
            </div>
          )}

          {/* ═══ FORK PRESENTATION ═══ */}
          {forkPhase === "presenting" && activeFork && (
            <div style={{animation:"trialRevealIn 0.6s ease-out",textAlign:"center",padding:"48px 20px",border:"2px solid #dc2626",background:"radial-gradient(circle at top, rgba(220,38,38,0.12) 0%, rgba(12,12,12,1) 40%)",marginBottom:"20px",animation:"forkPulse 3s infinite"}}>
              <div style={{fontSize:"10px",letterSpacing:"6px",color:"#dc2626",marginBottom:"16px"}}>⚡ FORK WRIT ⚡</div>
              <div style={{fontSize:"26px",fontWeight:"700",color:"#fff",marginBottom:"10px"}}>{activeFork.title}</div>
              <div style={{fontSize:"12px",color:"#666",marginBottom:"32px",maxWidth:"500px",margin:"0 auto 32px",lineHeight:"1.6"}}>
                Two paths diverge. You must choose one. The other vanishes permanently.
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"20px",maxWidth:"640px",margin:"0 auto"}}>
                <div style={{border:"1px solid #444",padding:"24px 16px",background:"#111",cursor:"pointer",transition:"border-color 0.2s"}}
                  onMouseEnter={e=>e.currentTarget.style.borderColor="#dc2626"}
                  onMouseLeave={e=>e.currentTarget.style.borderColor="#444"}
                  onClick={()=>chooseForkOption(activeFork,"a")}>
                  <div style={{fontSize:"10px",letterSpacing:"3px",color:"#dc2626",marginBottom:"8px"}}>OPTION A</div>
                  <div style={{fontSize:"18px",fontWeight:"700",color:"#fff",marginBottom:"8px"}}>{activeFork.optionA.label}</div>
                  <div style={{fontSize:"12px",color:"#888",lineHeight:"1.5"}}>{activeFork.optionA.objective}</div>
                  <div style={{marginTop:"12px",fontSize:"11px",color:"#555"}}>{activeFork.xp} XP</div>
                </div>
                <div style={{border:"1px solid #444",padding:"24px 16px",background:"#111",cursor:"pointer",transition:"border-color 0.2s"}}
                  onMouseEnter={e=>e.currentTarget.style.borderColor="#dc2626"}
                  onMouseLeave={e=>e.currentTarget.style.borderColor="#444"}
                  onClick={()=>chooseForkOption(activeFork,"b")}>
                  <div style={{fontSize:"10px",letterSpacing:"3px",color:"#dc2626",marginBottom:"8px"}}>OPTION B</div>
                  <div style={{fontSize:"18px",fontWeight:"700",color:"#fff",marginBottom:"8px"}}>{activeFork.optionB.label}</div>
                  <div style={{fontSize:"12px",color:"#888",lineHeight:"1.5"}}>{activeFork.optionB.objective}</div>
                  <div style={{marginTop:"12px",fontSize:"11px",color:"#555"}}>{activeFork.xp} XP</div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ LANDMARK REVEAL ═══ */}
          {landmarkPhase === "revealed" && activeLandmark && (
            <div style={{animation:"trialRevealIn 0.6s ease-out",textAlign:"center",padding:"48px 20px",border:"2px solid #3b82f6",background:"radial-gradient(circle at top, rgba(59,130,246,0.12) 0%, rgba(12,12,12,1) 40%)",marginBottom:"20px",animation:"landmarkGlow 3s infinite"}}>
              <div style={{fontSize:"10px",letterSpacing:"6px",color:"#3b82f6",marginBottom:"16px"}}>★ LANDMARK ★</div>
              <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:"80px",height:"80px",border:"1px solid rgba(59,130,246,0.55)",borderRadius:"999px",marginBottom:"16px",boxShadow:"0 0 30px rgba(59,130,246,0.18)"}}>
                <div style={{fontSize:"32px",color:"#93c5fd",lineHeight:1}}>★</div>
              </div>
              <div style={{fontSize:"26px",fontWeight:"700",color:"#fff",marginBottom:"10px"}}>{activeLandmark.title}</div>
              <div style={{fontSize:"14px",color:"#93c5fd",marginBottom:"6px",letterSpacing:"2px"}}>{activeLandmark.category.toUpperCase()}</div>
              <div style={{fontSize:"13px",color:"#999",marginBottom:"32px",maxWidth:"500px",margin:"0 auto 32px",lineHeight:"1.6"}}>
                {activeLandmark.objective}
              </div>
              <button style={{padding:"14px 48px",fontFamily:"inherit",fontWeight:"700",fontSize:"14px",letterSpacing:"4px",background:"#3b82f6",color:"#fff",border:"none",cursor:"pointer"}} onClick={acknowledgeLandmark}>
                ACKNOWLEDGE (+{activeLandmark.xp} XP)
              </button>
            </div>
          )}

          {/* DEBT QUEUE */}
          {debtWrits.length>0 && (
            <div style={{border:"1px solid #3d1515",padding:"16px",background:"#0a0606",marginBottom:"20px"}}>
              <div style={{...s.secHead,color:"#f87171"}}>
                DEFER QUEUE — {debtWrits.length} OUTSTANDING
                {mustClearAll && " · BLOCKED — CLEAR ALL TO DRAW AGAIN"}
              </div>
              {debtWrits.map((c,i)=>(
                <div key={i} style={s.debtCard}>
                  <div>
                    <div style={{color:"#f87171",fontSize:"13px",fontWeight:"700"}}>⚠ DEFERRED — {c.title}</div>
                    <div style={{color:"#666",fontSize:"11px",marginTop:"2px"}}>{c.objective}</div>
                    {c.modifier && <div style={{color:"#fb923c",fontSize:"10px",marginTop:"2px"}}>MODIFIER: {c.modifier}</div>}
                    {c.reckoning && <div style={{color:"#7c3aed",fontSize:"10px",marginTop:"2px"}}>ORIGINATED FROM RECKONING</div>}
                  </div>
                  <button style={s.btn(false,"#14380f","#4ade80")} onClick={()=>clearDebtWrit(c.id)}>
                    CLEAR (+{writXp(c)} XP)
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ═══ TRIAL REVEAL SEQUENCE ═══ */}
          {trialPhase === "approaching" && pendingTrialData && (
            <div style={{animation:"trialRevealIn 0.6s ease-out",textAlign:"center",padding:"60px 20px",border:"1px solid #d4af37",background:"linear-gradient(180deg, #141008 0%, #0c0c0c 100%)",marginBottom:"20px",animation:"trialGlow 2.5s infinite"}}>
              <div style={{fontSize:"10px",letterSpacing:"6px",color:"#d4af37",marginBottom:"24px"}}>⚔ TRIAL OF METTLE ⚔</div>
              <div style={{fontSize:"14px",letterSpacing:"4px",color:"#fbbf24",marginBottom:"12px"}}>LEVEL {pendingTrialData.triggerLevel}</div>
              <div style={{fontSize:"11px",color:"#666",marginBottom:"32px",maxWidth:"400px",margin:"0 auto 32px",lineHeight:"1.6"}}>
                The board has watched your progress. A Trial has been summoned. It cannot be drafted around. It cannot be ignored. It must be faced.
              </div>
              <button style={{padding:"14px 48px",fontFamily:"inherit",fontWeight:"700",fontSize:"14px",letterSpacing:"4px",background:"transparent",color:"#d4af37",border:"1px solid #d4af37",cursor:"pointer"}} onClick={revealTrial}>
                REVEAL TRIAL
              </button>
            </div>
          )}

          {trialPhase === "revealed" && pendingTrialData && (
            <div style={{animation:"trialRevealIn 0.5s ease-out",position:"relative",overflow:"hidden",border:"2px solid #d4af37",padding:"36px 24px",background:"radial-gradient(circle at top, rgba(212,175,55,0.14) 0%, rgba(26,19,8,1) 28%, rgba(12,12,12,1) 100%)",marginBottom:"20px",boxShadow:"0 0 60px rgba(212,175,55,0.12) inset, 0 0 30px rgba(0,0,0,0.35)",minHeight:"360px"}}>
              <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0) 28%, rgba(0,0,0,0.18) 100%)",pointerEvents:"none"}} />
              <div style={{position:"relative",zIndex:1,textAlign:"center",maxWidth:"720px",margin:"0 auto"}}>
                <div className={trialCeremonyStep >= 1 ? "trial-stage-live" : "trial-stage-hidden"} style={{fontSize:"10px",letterSpacing:"6px",color:"#d4af37",marginBottom:"18px"}}>
                  ⚔ TRIAL OF METTLE ⚔
                </div>

                <div className={trialCeremonyStep >= 1 ? "trial-stage-live" : "trial-stage-hidden"} style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:"92px",height:"92px",border:"1px solid rgba(212,175,55,0.55)",borderRadius:"999px",marginBottom:"18px",boxShadow:"0 0 30px rgba(212,175,55,0.18)",animation:"trialSigilPulse 2.4s ease-in-out infinite"}}>
                  <div style={{fontSize:"34px",color:"#f6d77b",lineHeight:1}}>✦</div>
                </div>

                <div className={trialCeremonyStep >= 2 ? "trial-stage-live" : "trial-stage-hidden"} style={{fontSize:"12px",letterSpacing:"4px",color:"#fbbf24",marginBottom:"10px",textTransform:"uppercase"}}>
                  {trialCeremonyLabel(pendingTrialData)}
                </div>

                <div className={trialCeremonyStep >= 2 ? "trial-stage-live" : "trial-stage-hidden"} style={{display:"flex",justifyContent:"center",gap:"8px",flexWrap:"wrap",marginBottom:"18px"}}>
                  <span style={s.tag(DIFF_COLORS[pendingTrialData.difficulty])}>{pendingTrialData.difficulty.toUpperCase()}</span>
                  <span style={s.tag(TIER_COLORS[pendingTrialData.tier]||"#555")}>{pendingTrialData.tier.toUpperCase()}</span>
                  <span style={s.tag(CAT_COLORS[pendingTrialData.category]||"#777")}>{pendingTrialData.category.toUpperCase()}</span>
                  <span style={s.tag("#d4af37")}>{writXp(pendingTrialData)} XP</span>
                </div>

                <div className={trialCeremonyStep >= 3 ? "trial-stage-live" : "trial-stage-hidden"} style={{fontSize:"30px",fontWeight:"700",color:"#fff",marginBottom:"12px",lineHeight:"1.2",textWrap:"balance"}}>
                  {pendingTrialData.title}
                </div>

                <div className={trialCeremonyStep >= 3 ? "trial-stage-live" : "trial-stage-hidden"} style={{fontSize:"12px",letterSpacing:"2px",color:"#8c7a44",marginBottom:"16px",textTransform:"uppercase"}}>
                  {trialFlavorLine(pendingTrialData)}
                </div>

                <div className={trialCeremonyStep >= 4 ? "trial-stage-live" : "trial-stage-hidden"} style={{fontSize:"15px",color:"#d1d5db",margin:"0 auto 14px",maxWidth:"620px",lineHeight:"1.75"}}>
                  {pendingTrialData.objective}
                </div>

                {pendingTrialData.trialModifier && (
                  <div className={trialCeremonyStep >= 5 ? "trial-stage-live" : "trial-stage-hidden"} style={{margin:"18px auto 0",maxWidth:"500px",padding:"12px 16px",border:"1px solid #4a2d0c",background:"linear-gradient(180deg, rgba(65,38,9,0.55) 0%, rgba(24,16,8,0.88) 100%)",boxShadow:"0 0 18px rgba(251,146,60,0.08)",animation: trialCeremonyStep >= 5 ? "modifierFlash 1.8s ease-out 1" : undefined}}>
                    <div style={{fontSize:"10px",letterSpacing:"4px",color:"#fb923c",marginBottom:"6px"}}>RESTRICTION IMPOSED</div>
                    <div style={{fontSize:"13px",color:"#fdba74"}}>{pendingTrialData.trialModifier}</div>
                  </div>
                )}

                <div className={trialCeremonyStep >= 3 ? "trial-stage-live" : "trial-stage-hidden"} style={{width:"140px",height:"1px",margin:"22px auto 0",background:"linear-gradient(90deg, rgba(212,175,55,0) 0%, rgba(212,175,55,0.9) 50%, rgba(212,175,55,0) 100%)",animation:"trialDividerGrow 0.7s ease-out both"}} />

                <div className={trialCeremonyStep >= 5 ? "trial-stage-live" : "trial-stage-hidden"} style={{textAlign:"center",marginTop:"26px"}}>
                  <button style={{padding:"14px 48px",fontFamily:"inherit",fontWeight:"700",fontSize:"14px",letterSpacing:"4px",background:"#d4af37",color:"#000",border:"none",cursor: trialCeremonyStep >= 5 ? "pointer" : "default",opacity: trialCeremonyStep >= 5 ? 1 : 0.6}} onClick={acceptTrial} disabled={trialCeremonyStep < 5}>
                    ACCEPT TRIAL
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ═══ ACTIVE WRIT ═══ */}
          {activeWrit && (
            activeWrit.trial ? (
              <div style={{animation:"trialRevealIn 0.45s ease-out",position:"relative",overflow:"hidden",border:"2px solid #d4af37",padding:"34px 24px",background:"radial-gradient(circle at top, rgba(120,92,21,0.18) 0%, rgba(20,18,13,1) 18%, rgba(10,10,10,1) 100%)",marginBottom:"16px",boxShadow:"0 0 40px rgba(212,175,55,0.08) inset, 0 0 30px rgba(0,0,0,0.35)",minHeight:"380px"}}>
                <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg, rgba(255,255,255,0.015) 0%, rgba(0,0,0,0) 26%, rgba(0,0,0,0.24) 100%)",pointerEvents:"none"}} />
                <div style={{position:"relative",textAlign:"center"}}>
                  <div style={{fontSize:"10px",letterSpacing:"6px",color:"#7a6a34",marginBottom:"10px"}}>TRIAL IN PROGRESS</div>
                  <div style={{fontSize:"11px",letterSpacing:"3px",color:"#9ca3af",marginBottom:"18px",textTransform:"uppercase"}}>The reveal has passed. The board now expects execution.</div>
                  <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:"84px",height:"84px",border:"1px solid rgba(212,175,55,0.42)",borderRadius:"999px",marginBottom:"16px",boxShadow:"0 0 22px rgba(212,175,55,0.10)",background:"radial-gradient(circle, rgba(212,175,55,0.08) 0%, rgba(212,175,55,0.02) 60%, rgba(0,0,0,0) 100%)"}}>
                    <div style={{fontSize:"30px",color:"#fbbf24",lineHeight:1}}>✦</div>
                  </div>
                  <div style={{display:"flex",justifyContent:"center",gap:"8px",flexWrap:"wrap",marginBottom:"18px"}}>
                    <span style={s.tag(CAT_COLORS[activeWrit.category]||"#555")}>{activeWrit.category.toUpperCase()}</span>
                    <span style={s.tag(DIFF_COLORS[activeWrit.difficulty])}>{activeWrit.difficulty.toUpperCase()}</span>
                    <span style={s.tag(TIER_COLORS[activeWrit.tier]||"#555")}>{activeWrit.tier.toUpperCase()}</span>
                    <span style={s.tag("#d4af37")}>ACTIVE TRIAL</span>
                    <span style={s.tag("#e5e7eb")}>{writXp(activeWrit)} XP</span>
                    {modifierXpBonus(activeWrit) > 0 && <span style={s.tag("#fb923c")}>+{modifierXpBonus(activeWrit)} MOD BONUS</span>}
                  </div>
                  <div style={{fontSize:"34px",fontWeight:"700",color:"#fff",marginBottom:"12px",lineHeight:"1.15",textWrap:"balance"}}>{activeWrit.title}</div>
                  <div style={{fontSize:"12px",letterSpacing:"2px",color:"#8c7a44",marginBottom:"18px",textTransform:"uppercase"}}>{activeTrialPrompt(activeWrit)}</div>
                  <div style={{margin:"0 auto 18px",maxWidth:"680px",border:"1px solid rgba(212,175,55,0.18)",background:"linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.00) 100%)",padding:"18px 18px 16px"}}>
                    <div style={{fontSize:"10px",letterSpacing:"4px",color:"#a3a3a3",marginBottom:"10px",textTransform:"uppercase"}}>Objective</div>
                    <div style={{fontSize:"16px",color:"#e5e7eb",lineHeight:"1.75"}}>{activeWrit.objective}</div>
                  </div>
                  {(activeWrit.modifier || activeWrit.trialModifier) && (
                    <div style={{margin:"18px auto 0",maxWidth:"520px",padding:"12px 16px",border:"1px solid #4a2d0c",background:"linear-gradient(180deg, rgba(65,38,9,0.45) 0%, rgba(24,16,8,0.78) 100%)",boxShadow:"0 0 14px rgba(251,146,60,0.06)"}}>
                      <div style={{fontSize:"10px",letterSpacing:"4px",color:"#8b5a22",marginBottom:"6px",textTransform:"uppercase"}}>Restriction active</div>
                      <div style={{fontSize:"13px",color:"#fdba74"}}>{activeWrit.modifier || activeWrit.trialModifier}</div>
                    </div>
                  )}
                  {activeWrit.modifier && (
                    <div style={{display:"flex",justifyContent:"center",gap:"8px",marginTop:"14px",flexWrap:"wrap"}}>
                      <button style={s.btn(false,"#111827", mettleSeals >= REMOVE_MODIFIER_COST ? "#93c5fd" : "#4b5563")} onClick={removeActiveModifier} disabled={mettleSeals < REMOVE_MODIFIER_COST}>
                        REMOVE MODIFIER ({REMOVE_MODIFIER_COST} SEALS)
                      </button>
                    </div>
                  )}
                  <div style={{width:"180px",height:"1px",margin:"24px auto 0",background:"linear-gradient(90deg, rgba(212,175,55,0) 0%, rgba(212,175,55,0.9) 50%, rgba(212,175,55,0) 100%)"}} />
                  <div style={{display:"flex",justifyContent:"center",gap:"12px",flexWrap:"wrap",marginTop:"28px"}}>
                    <button style={{...s.btn(false,"#14380f","#4ade80"),padding:"14px 36px",fontSize:"14px",letterSpacing:"3px"}} onClick={()=>resolveWrit("complete")}>
                      ✓ CLEAR TRIAL (+{writXp(activeWrit)} XP)
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{...s.activeCard, borderColor: activeWrit.reckoning ? "#6b21a8" : "#555"}}>
                <div style={s.secHead}>ACTIVE WRIT</div>
                <div style={{fontSize:"11px",marginBottom:"8px"}}>
                  <span style={s.tag(CAT_COLORS[activeWrit.category]||"#555")}>{activeWrit.category.toUpperCase()}</span>
                  <span style={s.tag(DIFF_COLORS[activeWrit.difficulty])}>{activeWrit.difficulty.toUpperCase()}</span>
                  <span style={s.tag(TIER_COLORS[activeWrit.tier]||"#555")}>{activeWrit.tier.toUpperCase()}</span>
                  <span style={s.tag("#555")}>{writXp(activeWrit)} XP</span>
                  {modifierXpBonus(activeWrit) > 0 && <span style={s.tag("#fb923c")}>+{modifierXpBonus(activeWrit)} MOD BONUS</span>}
                </div>
                <div style={{fontSize:"22px",fontWeight:"700",color:"#fff",marginBottom:"8px"}}>{activeWrit.title}</div>
                <div style={{fontSize:"13px",color:"#999",marginBottom: (activeWrit.modifier || activeWrit.trialModifier) ? "8px" : "20px"}}>{activeWrit.objective}</div>
                {activeWrit.modifier && (
                  <div style={{display:"flex",gap:"8px",marginBottom:"12px",flexWrap:"wrap"}}>
                    <button style={s.btn(false,"#111827", mettleSeals >= REMOVE_MODIFIER_COST ? "#93c5fd" : "#4b5563")} onClick={removeActiveModifier} disabled={mettleSeals < REMOVE_MODIFIER_COST}>
                      REMOVE MODIFIER ({REMOVE_MODIFIER_COST} SEALS)
                    </button>
                  </div>
                )}
                {(activeWrit.modifier || activeWrit.trialModifier) && (
                  <div style={{fontSize:"12px",color:"#fb923c",padding:"8px 12px",background:"#1a1008",border:"1px solid #3d2a08",marginBottom:"20px",animation:"modifierFlash 3s infinite"}}>
                    ⚡ MODIFIER: {activeWrit.modifier || activeWrit.trialModifier}
                  </div>
                )}
                <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
                  <button style={s.btn(false,"#14380f","#4ade80")} onClick={()=>resolveWrit("complete")}>
                    ✓ COMPLETE (+{writXp(activeWrit)} XP)
                  </button>
                  <button style={s.btn(false,"#1a1a0a","#fbbf24")} onClick={()=>resolveWrit("defer")}
                    disabled={debtWrits.length>=3}>
                    ⏸ DEFER ({debtWrits.length}/3{debtWrits.length>=3?" — FULL":""})
                    {!activeWrit.trial && categoryDeferCounts[activeWrit.category] >= 2 && " ⚠ RECKONING"}
                  </button>
                </div>
              </div>
            )
          )}

          {/* ═══ DRAW / DRAFT ═══ */}
          {!activeWrit && !trialPhase && !activeFork && !activeLandmark && (
            <div>
              {currentDraft.length===0 ? (
                <div style={{textAlign:"center",padding:"48px 0"}}>
                  {drawBlocked ? (
                    <div>
                      <div style={{fontSize:"10px",color:"#f87171",letterSpacing:"3px",marginBottom:"16px"}}>
                        BLOCKED — {blockReason}
                      </div>
                      <div style={{fontSize:"12px",color:"#555"}}>
                        Complete your outstanding obligations above to unlock drawing
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{fontSize:"10px",color:pendingTrial?"#d4af37":draftStatus==="cursed"?"#fbbf24":draftStatus==="favored"?"#c4b5fd":draftStatus==="hot_streak"?"#fb923c":"#444",letterSpacing:"3px",marginBottom:"20px"}}>
                        {pendingTrial ? "⚔ TRIAL OF METTLE AWAITS — YOU CANNOT DRAFT AROUND IT"
                          : draftStatus==="favored" ? `FAVORED · ${draftSizeFromStatus(draftStatus)} OPTIONS · ${favoredDrawsRemaining} DRAWS REMAINING`
                          : draftStatus==="hot_streak" ? `🔥 HOT STREAK (${streak}) · ${draftSizeFromStatus(draftStatus)} OPTIONS`
                          : `${draftStatus.toUpperCase()} · ${draftSizeFromStatus(draftStatus)} OPTIONS · UNCHOSEN WRITS GONE PERMANENTLY`}
                      </div>
                      <button style={{...s.btn(true),padding:"14px 48px",fontSize:"14px",letterSpacing:"4px",
                        ...(pendingTrial ? {background:"#d4af37",color:"#000",borderColor:"#d4af37"} : {})
                      }} onClick={drawWrits}>
                        {pendingTrial ? "⚔ FACE THE TRIAL" : "DRAW WRITS"}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div style={{...s.secHead,marginBottom:"12px"}}>CHOOSE ONE — OTHERS DISAPPEAR PERMANENTLY</div>
                  <div style={{display:"flex",gap:"8px",marginBottom:"16px",flexWrap:"wrap"}}>
                    <button style={s.btn(false,"#111827", mettleSeals >= REROLL_COST ? "#93c5fd" : "#4b5563")} onClick={rerollCurrentDraft} disabled={mettleSeals < REROLL_COST}>
                      REROLL DRAFT ({REROLL_COST} SEALS)
                    </button>
                    <button style={s.btn(false,"#1f2937", mettleSeals >= EXTRA_CHOICE_COST && currentDraft.length < 5 ? "#c4b5fd" : "#4b5563")} onClick={buyExtraDraftChoice} disabled={mettleSeals < EXTRA_CHOICE_COST || currentDraft.length >= 5}>
                      +1 CHOICE ({EXTRA_CHOICE_COST} SEALS)
                    </button>
                  </div>
                  <div style={s.draftGrid(currentDraft.length)}>
                    {currentDraft.map((w,i)=>(
                      <div key={i} style={{...s.draftCard, borderColor: w.modifier ? "#3d2a08" : "#2a2a2a"}}
                        onMouseEnter={e=>e.currentTarget.style.borderColor=w.modifier?"#d4af37":"#666"}
                        onMouseLeave={e=>e.currentTarget.style.borderColor=w.modifier?"#3d2a08":"#2a2a2a"}
                        onClick={()=>chooseWrit(w)}>
                        <div style={{fontSize:"10px",marginBottom:"8px"}}>
                          <span style={s.tag(CAT_COLORS[w.category]||"#555")}>{w.category.toUpperCase()}</span>
                          <span style={s.tag(TIER_COLORS[w.tier]||"#555")}>{w.tier.toUpperCase()}</span>
                          {w.modifier && <span style={s.tag("#fb923c")}>⚡ MODIFIED</span>}
                        </div>
                        <div style={{fontSize:"16px",fontWeight:"700",color:"#fff",marginBottom:"8px"}}>{w.title}</div>
                        <div style={{fontSize:"12px",color:"#888",marginBottom:w.modifier?"6px":"14px",lineHeight:"1.5"}}>{w.objective}</div>
                        {w.modifier && (
                          <div style={{fontSize:"11px",color:"#fb923c",marginBottom:"10px",padding:"4px 8px",background:"#1a1008",border:"1px solid #3d2a08"}}>
                            ⚡ {w.modifier}
                          </div>
                        )}
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:"11px"}}>
                          <span style={{color:DIFF_COLORS[w.difficulty]}}>{w.difficulty}</span>
                          <span style={{color:"#555"}}>{writXp(w)} XP</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══ STATS ══ */}
      {statsLoaded && activeView==="stats" && (
        <div>
          <div style={{...s.secHead,marginBottom:"12px"}}>ACCOUNT AVERAGE: {avg.toFixed(1)}</div>
          <div style={{border:"1px solid #1f2937",background:"#0d1117",padding:"12px 14px",marginBottom:"20px"}}>
            <div style={{fontSize:"11px",color:"#93c5fd",letterSpacing:"2px",marginBottom:"8px"}}>METTLE SYSTEMS</div>
            <div style={{fontSize:"12px",color:"#9ca3af",marginBottom:"8px"}}>Seals let you remove modifiers, reroll drafts, or buy an extra choice.</div>
            <div style={{fontSize:"12px",color:"#d1d5db",marginBottom:"8px"}}>Current: {mettleSeals} seals · streak {streak}{favoredDrawsRemaining > 0 ? ` · ${favoredDrawsRemaining} favored draws` : ""}</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>
              {METTLE_UNLOCKS.map(u => (
                <span key={u.level} style={s.tag(mettleLevel >= u.level ? "#4ade80" : "#555")}>
                  LVL {u.level} {u.unlock.toUpperCase()}
                </span>
              ))}
            </div>
          </div>

          {/* FORK DECISIONS */}
          {Object.keys(completedForks).length > 0 && (
            <div style={{border:"1px solid #3d1515",background:"#0d0808",padding:"12px 14px",marginBottom:"20px"}}>
              <div style={{fontSize:"11px",color:"#dc2626",letterSpacing:"2px",marginBottom:"8px"}}>FORK DECISIONS</div>
              {Object.entries(completedForks).map(([id, fork]) => {
                const def = FORK_WRITS.find(f => f.id === id);
                return (
                  <div key={id} style={{display:"flex",justifyContent:"space-between",padding:"5px 8px",background:"#111",fontSize:"11px",marginBottom:"3px"}}>
                    <span style={{color:"#888"}}>{def?.title || id}</span>
                    <span><span style={{color:"#4ade80"}}>{fork.chosen}</span> <span style={{color:"#444"}}>/ rejected</span> <span style={{color:"#f87171",textDecoration:"line-through"}}>{fork.rejected}</span></span>
                  </div>
                );
              })}
            </div>
          )}

          {/* LANDMARK TRACKER */}
          {completedLandmarks.length > 0 && (
            <div style={{border:"1px solid #1e3a5f",background:"#0d1117",padding:"12px 14px",marginBottom:"20px"}}>
              <div style={{fontSize:"11px",color:"#3b82f6",letterSpacing:"2px",marginBottom:"8px"}}>LANDMARKS ACHIEVED</div>
              {completedLandmarks.map(id => {
                const def = LANDMARK_WRITS.find(l => l.id === id);
                return (
                  <div key={id} style={{padding:"5px 8px",background:"#111",fontSize:"11px",marginBottom:"3px",color:"#93c5fd"}}>
                    ★ {def?.title || id}
                  </div>
                );
              })}
            </div>
          )}

          {/* PATH ASSIGNMENT */}
          {assignedPath && (
            <div style={{border:"1px solid #6b21a8",background:"#0f0a14",padding:"12px 14px",marginBottom:"20px"}}>
              <div style={{fontSize:"11px",color:"#d8b4fe",letterSpacing:"2px",marginBottom:"8px"}}>FINAL TRIAL PATH</div>
              <div style={{fontSize:"14px",color:"#fff",fontWeight:"700",marginBottom:"4px"}}>The {assignedPath}</div>
              <div style={{fontSize:"11px",color:"#777"}}>
                {assignedPath === "Warrior" && "PvM contracts dominant across the run. Your finale pool draws from elite combat challenges."}
                {assignedPath === "Scholar" && "Quest and Skill Gap contracts dominant. Your finale pool draws from mastery and knowledge."}
                {assignedPath === "Survivor" && "Endurance and Exploration contracts dominant. Your finale pool draws from sustained pressure."}
                {assignedPath === "Balanced" && "No dominant category — even spread. Your finale draws from all paths."}
              </div>
            </div>
          )}

          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(160px, 1fr))",gap:"3px",marginBottom:"24px"}}>
            {[...SKILLS].sort((a,b)=>skillLevels[a]-skillLevels[b]).map(skill=>{
              const level=skillLevels[skill],gap=avg-level;
              const color=gap>15?"#f87171":gap>5?"#fbbf24":"#4ade80";
              return (
                <div key={skill} style={{display:"flex",justifyContent:"space-between",padding:"5px 8px",background:"#111",fontSize:"12px"}}>
                  <span style={{color:"#666",textTransform:"capitalize"}}>{skill}</span>
                  <span style={{color}}>{level}{gap>0?<span style={{fontSize:"10px",color:"#444"}}> ({gap.toFixed(0)}↓)</span>:null}</span>
                </div>
              );
            })}
          </div>

          {/* RECKONING TRACKER */}
          {Object.keys(categoryDeferCounts).length > 0 && (
            <div style={{marginBottom:"24px"}}>
              <div style={s.secHead}>RECKONING TRACKER</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))",gap:"3px"}}>
                {RECKONING_CATEGORIES.map(cat => {
                  const count = categoryDeferCounts[cat] || 0;
                  const total = reckoningTotals[cat] || 0;
                  if (count === 0 && total === 0) return null;
                  const color = count >= 3 ? "#a855f7" : count >= 2 ? "#fbbf24" : "#555";
                  return (
                    <div key={cat} style={{display:"flex",justifyContent:"space-between",padding:"5px 8px",background:"#111",fontSize:"11px"}}>
                      <span style={{color:"#666"}}>{cat}</span>
                      <span style={{color}}>
                        {count}/3 defers
                        {total > 0 && <span style={{color:"#7c3aed",marginLeft:"6px"}}>({total} reckoned)</span>}
                      </span>
                    </div>
                  );
                }).filter(Boolean)}
              </div>
            </div>
          )}

          <div style={s.secHead}>BOSS KC — {KEY_BOSSES.length} BOSSES</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(210px, 1fr))",gap:"3px"}}>
            {KEY_BOSSES.map(boss=>(
              <div key={boss} style={{display:"flex",justifyContent:"space-between",padding:"5px 8px",background:"#111",fontSize:"12px"}}>
                <span style={{color:"#666",fontSize:"10px"}}>{boss.replace(/_/g," ")}</span>
                <span style={{color:(bossKC[boss]??0)===0?"#f87171":"#4ade80"}}>{bossKC[boss]??0}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ HISTORY ══ */}
      {statsLoaded && activeView==="history" && (
        <div>
          <div style={s.secHead}>{history.length} WRITS RESOLVED</div>
          {history.length===0 && <div style={{color:"#444",fontSize:"13px"}}>No writs resolved yet.</div>}
          {history.map((c,i)=>{
            const rc = c.result==="complete"||c.result==="debt_cleared"||c.result==="reckoning_cleared"||c.result==="landmark"?"#4ade80"
              : c.result==="defer"||c.result==="reckoning_failed"?"#fbbf24":"#555";
            const isExpanded = expandedHistoryIdx === i;
            const ts = c.timestamp ? new Date(c.timestamp) : null;
            return (
              <div key={i} style={{marginBottom:"4px",cursor:"pointer"}} onClick={()=>setExpandedHistoryIdx(isExpanded?null:i)}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 12px",background:"#111",borderLeft:`3px solid ${rc}`,borderBottom:isExpanded?"none":"1px solid #1a1a1a"}}>
                  <div>
                    <div style={{fontSize:"13px",color:"#ccc"}}>
                      {c.reckoning && <span style={{color:"#a855f7",marginRight:"6px"}}>⚡</span>}
                      {c.trial && <span style={{color:"#d4af37",marginRight:"6px"}}>⚔</span>}
                      {c.fork && <span style={{color:"#dc2626",marginRight:"6px"}}>⚡</span>}
                      {c.category==="Landmark" && <span style={{color:"#3b82f6",marginRight:"6px"}}>★</span>}
                      {c.title}
                    </div>
                    <div style={{fontSize:"11px",color:"#555",marginTop:"2px"}}>{c.category} · {c.tier}</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
                    <div style={{textAlign:"right",fontSize:"11px"}}>
                      <div style={{color:rc}}>{c.result.replace(/_/g," ").toUpperCase()}</div>
                      {c.xpGained>0&&<div style={{color:"#555"}}>+{c.xpGained} XP</div>}
                      {c.sealsGained>0&&<div style={{color:"#7dd3fc"}}>+{c.sealsGained} seals</div>}
                    </div>
                    <div style={{color:"#333",fontSize:"10px"}}>{isExpanded?"▼":"▶"}</div>
                  </div>
                </div>
                {isExpanded && (
                  <div style={{padding:"12px 16px",background:"#0e0e0e",borderLeft:`3px solid ${rc}`,borderBottom:"1px solid #1a1a1a"}}>
                    <div style={{fontSize:"12px",color:"#999",marginBottom:"10px",lineHeight:"1.6"}}>{c.objective}</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:"6px",marginBottom:"10px"}}>
                      <span style={s.tag(CAT_COLORS[c.category]||"#555")}>{c.category?.toUpperCase()}</span>
                      <span style={s.tag(DIFF_COLORS[c.difficulty])}>{c.difficulty?.toUpperCase()}</span>
                      <span style={s.tag(TIER_COLORS[c.tier]||"#555")}>{c.tier?.toUpperCase()}</span>
                      {c.trial && <span style={s.tag("#d4af37")}>TRIAL</span>}
                      {c.fork && <span style={s.tag("#dc2626")}>FORK</span>}
                      {c.reckoning && <span style={s.tag("#a855f7")}>RECKONING #{c.reckoningCount}</span>}
                      {(c.landmark || c.category==="Landmark") && <span style={s.tag("#3b82f6")}>LANDMARK</span>}
                    </div>
                    {(c.modifier || c.trialModifier) && (
                      <div style={{fontSize:"11px",color:"#fb923c",marginBottom:"8px"}}>
                        ⚡ MODIFIER: {c.modifier || c.trialModifier}
                      </div>
                    )}
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:"10px",color:"#444"}}>
                      <span>XP: {c.xp} base{c.xpGained > 0 ? ` · +${c.xpGained} earned` : " · 0 earned (deferred)"}{c.sealsGained ? ` · +${c.sealsGained} seals` : ""}{typeof c.streakAfter === "number" ? ` · streak ${c.streakAfter}` : ""}</span>
                      {ts && <span>{ts.toLocaleDateString()} {ts.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {statsLoaded && (
        <div style={s.footer}>
          <span>WRITS: {completedIds.length}/{writPoolCount}</span>
          <span>DEFER: {debtWrits.length}{mustClearAll?" (BLOCKED)":""}</span>
          <span>RECKONING: {reckoningWrits.length}</span>
          <span>SEALS: {mettleSeals}</span>
          <span>STREAK: {streak}</span>
          <span>FORKS: {Object.keys(completedForks).length}/{FORK_WRITS.length}</span>
          <span>LANDMARKS: {completedLandmarks.length}/{LANDMARK_WRITS.length}</span>
          <span>XP: {mettleXP.toLocaleString()} / 67,000</span>
          {assignedPath && <span>PATH: {assignedPath.toUpperCase()}</span>}
        </div>
      )}
    </div>
  );
}
