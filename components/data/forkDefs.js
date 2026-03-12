export const FORK_WRITS = [
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

export function getPendingFork(mettleLevel, completedForks, completedIds) {
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
