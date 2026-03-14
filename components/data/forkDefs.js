import { isQuestObjectiveAlreadyComplete } from "../utils/questProgress.js";

export const FORK_TASKS = [
  { id:"fork_ancient_path", title:"The Ancient Path", tier:"Zamorak", triggerLevel:65, difficulty:"Elite", xp:900, category:"Fork",
    optionA: { label:"Desert Treasure II", objective:"Complete Desert Treasure II", questCompleteAnyOf:["desert_treasure_ii"] },
    optionB: { label:"Dragon Slayer II", objective:"Complete Dragon Slayer II", questCompleteAnyOf:["dragon_slayer_ii"] },
  },
  { id:"fork_elven_choice", title:"The Elven Choice", tier:"Zamorak", triggerLevel:75, difficulty:"Elite", xp:900, category:"Fork",
    optionA: { label:"Song of the Elves", objective:"Complete Song of the Elves", questCompleteAnyOf:["song_of_the_elves"] },
    optionB: { label:"Sins of the Father", objective:"Complete Sins of the Father", questCompleteAnyOf:["sins_of_the_father"] },
  },
  { id:"fork_endgame", title:"The Endgame", tier:"Zaros", triggerLevel:85, difficulty:"Elite", xp:1200, category:"Fork",
    optionA: { label:"Tombs of Amascut (Full)", objective:"Complete Tombs of Amascut in full", bossCompleteAnyOf:["tombs_of_amascut", "tombs_of_amascut_expert"] },
    optionB: { label:"Theatre of Blood (Full)", objective:"Complete Theatre of Blood in full", bossCompleteAnyOf:["theatre_of_blood", "theatre_of_blood_hard_mode"] },
  },
  { id:"fork_final_reckoning", title:"The Final Reckoning", tier:"Zaros", triggerLevel:92, difficulty:"Elite", xp:1500, category:"Fork",
    optionA: { label:"The Inferno", objective:"Attempt and complete the Inferno", bossCompleteAnyOf:["tzkal_zuk"] },
    optionB: { label:"The Nightmare", objective:"Kill the Nightmare", bossCompleteAnyOf:["nightmare", "phosanis_nightmare"] },
  },
];

export function getPendingFork(mettleLevel, completedForks, completedIds, questState = null, bossKC = {}) {
  for (const fork of FORK_TASKS) {
    if (mettleLevel >= fork.triggerLevel && !completedForks[fork.id]) {
      const optionA = {
        ...fork.optionA,
        alreadyCompleted: isQuestObjectiveAlreadyComplete(fork.optionA, questState, bossKC),
      };
      const optionB = {
        ...fork.optionB,
        alreadyCompleted: isQuestObjectiveAlreadyComplete(fork.optionB, questState, bossKC),
      };
      const availableOptions = [];
      if (!optionA.alreadyCompleted) availableOptions.push("a");
      if (!optionB.alreadyCompleted) availableOptions.push("b");

      return {
        ...fork,
        optionA,
        optionB,
        availableOptions,
        autoResolved: availableOptions.length === 0,
      };
    }
  }
  return null;
}

// ─────────────────────────────────────────────
// LANDMARK TASKS — auto-trigger on condition
// ─────────────────────────────────────────────
