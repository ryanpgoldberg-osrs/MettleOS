import { SKILLS } from "./constants.js";
import { hasQuestCape } from "../utils/questProgress.js";
import { skillLabel } from "../utils/labels.js";

export const LANDMARK_TASKS = [
  { id:"landmark_first_99", title:"First Level 99", category:"Landmark", tier:"Zaros", difficulty:"Elite", xp:1000,
    conditionFn: (skills) => SKILLS.some(s => skills[s] >= 99),
    objectiveFn: (skills) => { const maxed = SKILLS.filter(s => skills[s] >= 99); return `You have reached 99 in ${maxed.map(skillLabel).join(", ")}. The ledger acknowledges mastery.`; },
    objective:"Reach level 99 in any skill." },
  { id:"landmark_quest_cape", title:"Quest Cape", category:"Landmark", tier:"Zaros", difficulty:"Elite", xp:1500, landmark:true,
    conditionFn: (...args) => hasQuestCape(args[2]),
    objective:"Complete all quests. One of the defining moments of any OSRS account." },
  { id:"landmark_total_1900", title:"Total Level 1900", category:"Landmark", tier:"Zaros", difficulty:"Elite", xp:1000,
    conditionFn: (skills) => { const total = Object.values(skills).reduce((a,b) => a+b, 0); return total >= 1900; },
    objectiveFn: (skills) => { const total = Object.values(skills).reduce((a,b) => a+b, 0); return `Total level ${total} — you've reached the 1900 milestone. The ledger marks this moment.`; },
    objective:"Reach 1900 total level." },
  { id:"landmark_first_raid", title:"First Raid Completion", category:"Landmark", tier:"Bandos", difficulty:"Hard", xp:800,
    conditionFn: (_s, kc) => (kc.chambers_of_xeric??0) > 0 || (kc.theatre_of_blood??0) > 0 || (kc.tombs_of_amascut??0) > 0,
    objective:"Complete any raid for the first time. A defining account moment." },
];

export function getPendingLandmark(skillLevels, bossKC, completedLandmarks, questState = null) {
  for (const lm of LANDMARK_TASKS) {
    if (completedLandmarks.includes(lm.id)) continue;
    if (lm.conditionFn && lm.conditionFn(skillLevels, bossKC, questState)) {
      return {
        ...lm,
        objective: lm.objectiveFn ? lm.objectiveFn(skillLevels, bossKC) : lm.objective,
      };
    }
  }
  return null;
}
