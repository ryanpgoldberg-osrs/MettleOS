export const FINAL_TRIAL_POOLS = {
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
    { id:"ft_sv8", title:"Flawless Ten",        objective:"Complete 10 tasks in a row without failure or debt", xp:1500 },
  ],
  Balanced: [
    { id:"ft_b1", title:"Warrior's Remnant",    objective:"Highest-weight uncompleted PvM task on the account", xp:1800 },
    { id:"ft_b2", title:"Scholar's Remnant",    objective:"Highest-weight uncompleted Quest/Skill task on the account", xp:1800 },
    { id:"ft_b3", title:"Survivor's Remnant",   objective:"Highest-weight uncompleted Endurance task on the account", xp:1800 },
    { id:"ft_b4", title:"The Wildcard I",       objective:"Highest remaining skill gap — algorithmically identified", xp:1600 },
    { id:"ft_b5", title:"The Wildcard II",      objective:"Hardest untouched boss on the account — algorithmically identified", xp:2000 },
    { id:"ft_b6", title:"The Long Debt",        objective:"Clear any remaining debt tasks from the entire run", xp:1500 },
    { id:"ft_b7", title:"The Open Road",        objective:"Complete any 3 tasks from any tier pool", xp:1500 },
    { id:"ft_b8", title:"The Reckoning",        objective:"Complete any 1 task from each of the other three pools", xp:1800 },
  ],
};

export function generateFinalTrialDraft(path) {
  const pool = [...(FINAL_TRIAL_POOLS[path] || FINAL_TRIAL_POOLS.Balanced)];
  const selected = [];
  for (let i = 0; i < 5 && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    selected.push({ ...pool[idx], category:"Final Trial", tier:"Zaros", difficulty:"Elite", trial:true, finalTrial:true });
    pool.splice(idx, 1);
  }
  return selected;
}

export function computePath(history) {
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
