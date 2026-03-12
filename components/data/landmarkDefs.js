import { SKILLS } from "./constants.js";
import { skillLabel } from "../utils/labels.js";

export const LANDMARK_WRITS = [
  { id:"landmark_first_99", title:"First Level 99", category:"Landmark", tier:"Zaros", difficulty:"Elite", xp:1000,
    conditionFn: (skills, _kc) => SKILLS.some(s => skills[s] >= 99),
    objectiveFn: (skills) => { const maxed = SKILLS.filter(s => skills[s] >= 99); return `You have reached 99 in ${maxed.map(skillLabel).join(", ")}. The ledger acknowledges mastery.`; },
    objective:"Reach level 99 in any skill." },
  { id:"landmark_quest_cape", title:"Quest Cape", category:"Landmark", tier:"Zaros", difficulty:"Elite", xp:1500, landmark:true,
    conditionFn: () => false, // Manual trigger — we can't detect quest completion from WOM API skill data alone
    objective:"Complete all quests. One of the defining moments of any OSRS account." },
  { id:"landmark_total_1900", title:"Total Level 1900", category:"Landmark", tier:"Zaros", difficulty:"Elite", xp:1000,
    conditionFn: (skills) => { const total = Object.values(skills).reduce((a,b) => a+b, 0); return total >= 1900; },
    objectiveFn: (skills) => { const total = Object.values(skills).reduce((a,b) => a+b, 0); return `Total level ${total} — you've reached the 1900 milestone. The ledger marks this moment.`; },
    objective:"Reach 1900 total level." },
  { id:"landmark_first_raid", title:"First Raid Completion", category:"Landmark", tier:"Bandos", difficulty:"Hard", xp:800,
    conditionFn: (_s, kc) => (kc.chambers_of_xeric??0) > 0 || (kc.theatre_of_blood??0) > 0 || (kc.tombs_of_amascut??0) > 0,
    objective:"Complete any raid for the first time. A defining account moment." },
];

export function getPendingLandmark(skillLevels, bossKC, completedLandmarks) {
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
