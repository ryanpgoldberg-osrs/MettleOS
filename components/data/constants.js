export const SKILLS = [
  "attack","strength","defence","ranged","magic","prayer",
  "runecrafting","construction","hitpoints","agility","herblore",
  "thieving","crafting","fletching","slayer","hunter","mining",
  "smithing","fishing","cooking","firemaking","woodcutting","farming","sailing"
];

export const KEY_BOSSES = [
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

export const GUTHIX_BOSSES = ["obor","bryophyta","giant_mole","sarachnis","barrows_chests","chaos_fanatic","crazy_archaeologist","scorpia"];
export const SKILLING = ["runecrafting","construction","agility","herblore","thieving","crafting","fletching","hunter","mining","smithing","fishing","cooking","firemaking","woodcutting","farming","sailing"];
export const PRODUCTION = ["herblore","crafting","fletching","smithing","cooking","firemaking"];

export const BOSS_BANDS = [
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

export const XP_BREAKPOINTS = [
  { xp:0,     level:1  },
  { xp:2500,  level:20 },
  { xp:9000,  level:40 },
  { xp:22000, level:60 },
  { xp:45000, level:80 },
  { xp:85000, level:99 },
];

export const MAX_METTLE_XP = XP_BREAKPOINTS[XP_BREAKPOINTS.length - 1].xp;

export const COMBAT_MODIFIERS = ["No food","No overhead prayers","Gear cap (max Rune)","Inventory limit (16 slots)","Time limit (15 min)","No potions","No special attacks","Protection prayers disabled","No safespots","Weapon locked after entering fight","Must equip one cosmetic item","Max 1 teleport item"];
export const SKILLING_MODIFIERS = ["No teleporting","No banking","Ironman-style gathering","Limited inventory (16 slots)","Tool downgrade (steel tier)","No stamina potions","Must process gathered resources","Randomized resource order"];
export const ACCOUNT_MODIFIERS = ["Must complete in one session","Must stream the attempt","Viewer-chosen gear","Hardcore attempt (fail = reset)","Complete within 2 hours","Random equipment slot locked"];

export const REMOVE_MODIFIER_COST = 3;
export const REROLL_COST = 2;
export const EXTRA_CHOICE_COST = 5;

export const METTLE_UNLOCKS = [
  { level: 10, unlock: "Trials" },
  { level: 20, unlock: "Draft (3 options)" },
  { level: 40, unlock: "Endurance Writs" },
  { level: 60, unlock: "Elite modifiers" },
  { level: 80, unlock: "Mythic pressure" },
];

export const TIER_SEAL_REWARDS = { Guthix: 1, Saradomin: 2, Bandos: 3, Zamorak: 4, Zaros: 5 };

export const TIER_ORDER = ["Guthix","Saradomin","Bandos","Zamorak","Zaros"];
export const TIER_GATES = [20, 40, 60, 80];
export const RECKONING_CATEGORIES = ["PvM Intro","PvM Endurance","Quest","Skill Gap","Endurance","Exploration","Economic"];

export const DIFF_COLORS = { Easy:"#4ade80",Medium:"#fbbf24",Hard:"#fb923c",Elite:"#f87171" };
export const TIER_COLORS = { Guthix:"#6ee7b7",Saradomin:"#93c5fd",Bandos:"#fb923c",Zamorak:"#f87171",Zaros:"#d8b4fe" };
export const CAT_COLORS  = {
  "PvM Intro":"#93c5fd","PvM Endurance":"#818cf8","Quest":"#d8b4fe",
  "Skill Gap":"#6ee7b7","Endurance":"#fcd34d","Exploration":"#7dd3fc","Economic":"#a3e635",
  "Fork":"#dc2626","Landmark":"#3b82f6","Final Trial":"#d8b4fe",
};

export const DEFAULT_SKILLS = Object.fromEntries(SKILLS.map(s=>[s,1]));
export const DEFAULT_KC     = Object.fromEntries(KEY_BOSSES.map(b=>[b,0]));
