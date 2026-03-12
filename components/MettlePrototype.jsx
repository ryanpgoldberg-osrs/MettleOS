"use client";
import { useEffect, useState } from "react";
import {
  CAT_COLORS,
  DEFAULT_KC,
  DEFAULT_SKILLS,
  DIFF_COLORS,
  EXTRA_CHOICE_COST,
  KEY_BOSSES,
  MAX_METTLE_XP,
  METTLE_UNLOCKS,
  RECKONING_CATEGORIES,
  REMOVE_MODIFIER_COST,
  REROLL_COST,
  SKILLS,
  TIER_COLORS,
  TIER_ORDER,
  TIER_GATES,
} from "./data/constants.js";
import { FORK_WRITS, getPendingFork } from "./data/forkDefs.js";
import { LANDMARK_WRITS, getPendingLandmark } from "./data/landmarkDefs.js";
import { WRIT_POOL } from "./data/writPool.js";
import {
  computePath,
  draftSizeFromStatus,
  generateDraft,
  generateFinalTrialDraft,
  generateReckoningWrit,
  getDebtStatus,
  getPendingTrial,
  levelProgressPct,
  materializeWrit,
  tierForLevel,
  unlockedFeatures,
  xpForLevel,
  xpToLevel,
} from "./systems/mettleSystems.js";
import { modifierXpBonus, sealsForWrit, streakSealBonus, writXp } from "./utils/modifiers.js";
import { loadSave, SAVE_KEY, writeSave } from "./utils/persistence.js";
import { accountAverage } from "./utils/skillHelpers.js";

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

function makeQueueEntryId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `debt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function toDeferredQueueEntry(writ) {
  return { ...writ, queueEntryId: writ.queueEntryId || makeQueueEntryId() };
}

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────

/**
 * @param {{
 *   initialSkillLevels?: Record<string, number> | null,
 *   initialBossKC?: Record<string, number> | null,
 *   initialRsn?: string,
 *   onResetToEntry?: (() => void) | null,
 * }} [props]
 */
export default function MettlePrototype({
  initialSkillLevels = null,
  initialBossKC = null,
  initialRsn = "",
  onResetToEntry = null,
} = {}) {
  const hasInitialStats = Boolean(initialSkillLevels && initialBossKC);
  const [inputMode,    setInputMode]    = useState("manual");
  const [rsn,          setRsn]          = useState(initialRsn);
  const [loading,      setLoading]      = useState(false);
  const [fetchError,   setFetchError]   = useState("");
  const [statsLoaded,  setStatsLoaded]  = useState(hasInitialStats);
  const [manualSkills, setManualSkills] = useState(initialSkillLevels ?? DEFAULT_SKILLS);
  const [manualKC,     setManualKC]     = useState(initialBossKC ?? DEFAULT_KC);
  const [skillLevels,  setSkillLevels]  = useState(initialSkillLevels ?? DEFAULT_SKILLS);
  const [bossKC,       setBossKC]       = useState(initialBossKC ?? DEFAULT_KC);

  const [mettleXP,       setMettleXP]       = useState(0);
  const [mettleSeals,    setMettleSeals]    = useState(0);
  const [streak,         setStreak]         = useState(0);
  const [completedIds,   setCompletedIds]   = useState([]);
  const [history,        setHistory]        = useState([]);
  const [debtWrits,      setDebtWrits]      = useState([]);
  const [mustClearAll,   setMustClearAll]   = useState(false);
  const [draftHistory,   setDraftHistory]   = useState([]);
  const [currentDraft,   setCurrentDraft]   = useState([]);
  const [draftMode,      setDraftMode]      = useState("normal");
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
    if (hasInitialStats) return;
    const save=loadSave(); if(!save) return;
    if(save.skillLevels)         setSkillLevels(save.skillLevels);
    if(save.skillLevels)         setManualSkills(save.skillLevels);
    if(save.bossKC)              setBossKC(save.bossKC);
    if(save.bossKC)              setManualKC(save.bossKC);
    if(save.mettleXP)            setMettleXP(save.mettleXP);
    if(save.mettleSeals)         setMettleSeals(save.mettleSeals);
    if(save.streak)              setStreak(save.streak);
    if(save.completedIds)        setCompletedIds(save.completedIds);
    if(save.history)             setHistory(save.history);
    if(save.debtWrits)           setDebtWrits(save.debtWrits.map(toDeferredQueueEntry));
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
  }, [hasInitialStats]);

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
      const resolvedRsn = data?.rsn ?? trimmed;
      setRsn(resolvedRsn);
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
          ...materializeWrit(pendingTrial, skillLevels, bossKC),
        };
        setPendingTrialData(resolved);
        setTrialPhase("approaching");
        return;
      }
    }

    const last5=draftHistory.slice(-5);
    const draft=generateDraft(skillLevels,bossKC,completedIds,last5,debtWrits,mettleLevel,null,streak,favoredDrawsRemaining);
    setCurrentDraft(draft);
    setDraftMode("normal");
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
    setDraftMode("normal");
    setDraftHistory(prev => [...prev, draft.map(w => w.id)]);
  }

  function buyExtraDraftChoice() {
    if (currentDraft.length === 0 || currentDraft.length >= 5 || mettleSeals < EXTRA_CHOICE_COST) return;
    const last5 = draftHistory.slice(-5);
    const expanded = generateDraft(skillLevels, bossKC, completedIds, last5, debtWrits, mettleLevel, currentDraft.length + 1);
    setMettleSeals(prev => prev - EXTRA_CHOICE_COST);
    setCurrentDraft(expanded);
    setDraftMode("normal");
    setDraftHistory(prev => [...prev, expanded.map(w => w.id)]);
  }

  function revealTrial() {
    setTrialCeremonyStep(0);
    setTrialPhase("revealed");
  }

  function acceptTrial() {
    if (!pendingTrialData || trialCeremonyStep < 5) return;
    if (pendingTrialData.finalTrial) {
      const resolvedPath = assignedPath || computePath(history);
      const finalDraft = generateFinalTrialDraft(resolvedPath).map(writ => ({
        ...writ,
        sourceTrialId: pendingTrialData.id,
      }));
      setAssignedPath(resolvedPath);
      setPathRevealed(true);
      setCurrentDraft(finalDraft);
      setDraftMode("final_trial");
      setTrialPhase(null);
      setPendingTrialData(null);
      setTrialCeremonyStep(0);
      return;
    }
    setActiveWrit({ ...pendingTrialData, acceptedAt: Date.now() });
    setTrialPhase(null);
    setPendingTrialData(null);
    setTrialCeremonyStep(0);
  }

  function chooseWrit(writ) {
    setCurrentDraft([]);
    setDraftMode("normal");
    setActiveWrit({ ...writ, acceptedAt: writ.acceptedAt || Date.now() });
  }

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
    setMettleXP(prev => Math.min(MAX_METTLE_XP, prev + xpGained));
    setMettleSeals(prev => prev + sealsGained);
    setXpDrop({ amount: xpGained, id: Date.now() });
    setTimeout(() => setXpDrop(null), 1800);
    setHistory(prev => [{ ...lm, result: "landmark", xpGained, sealsGained, timestamp: Date.now() }, ...prev]);
    setActiveLandmark(null);
    setLandmarkPhase(null);
  }

  function triggerQuestCapeLandmark() {
    if (!questCapeLandmark || activeWrit || trialPhase || currentDraft.length > 0 || activeFork || activeLandmark) return;
    setActiveView("board");
    setActiveLandmark(questCapeLandmark);
    setLandmarkPhase("revealed");
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

  function resolveActiveWrit(result) {
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
      if (activeWrit.sourceTrialId && !completedIds.includes(activeWrit.sourceTrialId)) {
        setCompletedIds(prev => [...prev, activeWrit.sourceTrialId]);
      }
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

      const newDebt=[...debtWrits,toDeferredQueueEntry(activeWrit)];
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
    if(xpGained>0) setMettleXP(prev=>Math.min(MAX_METTLE_XP,prev+xpGained));
    if(sealsGained>0) setMettleSeals(prev=>prev+sealsGained);
    setStreak(nextStreak);
    setHistory(prev=>[{...activeWrit,result,xpGained,sealsGained,baseXp:activeWrit.xp,modifierXpBonus:modifierXpBonus(activeWrit),streakAfter:nextStreak,timestamp:Date.now()},...prev]);
    setActiveWrit(null);
  }

  function clearDebtWrit(queueEntryId) {
    const c=debtWrits.find(x=>x.queueEntryId===queueEntryId); if(!c) return;
    const newDebt=debtWrits.filter(x=>x.queueEntryId!==queueEntryId);
    const nextStreak = streak + 1;
    const sealsGained = sealsForWrit(c) + streakSealBonus(nextStreak);
    setDebtWrits(newDebt);
    if (newDebt.length===0) setMustClearAll(false);
    setMettleXP(prev=>Math.min(MAX_METTLE_XP,prev+writXp(c)));
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
    setMettleXP(prev => Math.min(MAX_METTLE_XP, prev + writXp(rw)));
    setMettleSeals(prev => prev + sealsGained);
    setStreak(nextStreak);
    setXpDrop({ amount: writXp(rw), id: Date.now() });
    setTimeout(() => setXpDrop(null), 1800);
    setHistory(prev => [{ ...rw, result: "reckoning_cleared", xpGained: writXp(rw), sealsGained, baseXp:rw.xp, modifierXpBonus:modifierXpBonus(rw), streakAfter: nextStreak, timestamp: Date.now() }, ...prev]);
  }

  function failReckoningWrit(id) {
    const rw = reckoningWrits.find(x => x.id === id); if (!rw) return;
    setReckoningWrits(prev => prev.filter(x => x.id !== id));
    const newDebt = [...debtWrits, toDeferredQueueEntry(rw)];
    setDebtWrits(newDebt);
    setStreak(0);
    if (newDebt.length >= 3) setMustClearAll(true);
    setCategoryDeferCounts(prev => ({ ...prev, [rw.category]: (prev[rw.category] || 0) + 1 }));
    setHistory(prev => [{ ...rw, result: "reckoning_failed", xpGained: 0, sealsGained: 0, streakAfter: 0, timestamp: Date.now() }, ...prev]);
  }

  function resetRun() {
    if (!confirmReset) { setConfirmReset(true); return; }
    setMettleXP(0); setMettleSeals(0); setStreak(0); setCompletedIds([]); setHistory([]);
    setDebtWrits([]); setMustClearAll(false); setDraftHistory([]); setCurrentDraft([]); setDraftMode("normal"); setActiveWrit(null);
    setCategoryDeferCounts({}); setReckoningWrits([]); setReckoningTotals({});
    setTrialPhase(null); setPendingTrialData(null); setExpandedHistoryIdx(null);
    setFavoredDrawsRemaining(0);
    setCompletedForks({}); setActiveFork(null); setForkPhase(null);
    setCompletedLandmarks([]); setActiveLandmark(null); setLandmarkPhase(null);
    setAssignedPath(null); setPathRevealed(false);
    setConfirmReset(false);
    try { localStorage.removeItem(SAVE_KEY); } catch {}
    onResetToEntry?.();
  }

  const displayFont = "'RuneScape UF', 'Palatino Linotype', 'Book Antiqua', Georgia, serif";
  const s = {
    root:      { fontFamily:"'Courier New', monospace",background:"radial-gradient(circle at top left, rgba(212,175,55,0.08), transparent 26%), radial-gradient(circle at 82% 18%, rgba(122,122,122,0.06), transparent 22%), linear-gradient(180deg, #080808 0%, #0c0c0c 46%, #090909 100%)",color:"#d4d4d4",minHeight:"100vh",padding:"30px 24px 48px",maxWidth:"1040px",margin:"0 auto" },
    header:    { border:"1px solid #1a1a1a",padding:"24px 24px 18px",marginBottom:"24px",background:"linear-gradient(180deg, rgba(212,175,55,0.05) 0%, rgba(16,16,16,0.98) 20%, rgba(10,10,10,0.98) 100%)",boxShadow:"0 0 0 1px rgba(255,255,255,0.02), inset 0 1px 0 rgba(255,255,255,0.03)" },
    xpBar:     { height:"4px",background:"#171717",marginTop:"16px" },
    xpFill:    pct=>({height:"100%",background:"linear-gradient(90deg, #b8922c 0%, #f0e0ad 100%)",width:`${pct}%`,transition:"width 0.4s"}),
    btn:       (active,bg,fg)=>({ padding:"8px 18px",fontFamily:"inherit",fontWeight:"700",fontSize:"12px",letterSpacing:"1px", background:bg||(active?"#161616":"#101010"),color:fg||(active?"#f3e3a3":"#888"),border:`1px solid ${active?"#7a6530":"#2a2a2a"}`,cursor:"pointer",boxShadow:active?"inset 0 1px 0 rgba(255,255,255,0.05), 0 0 18px rgba(212,175,55,0.05)":"none" }),
    secHead:   { fontSize:"10px",letterSpacing:"3px",color:"#7b6a32",marginBottom:"12px" },
    activeCard:{ border:"1px solid #3d3421",padding:"20px",background:"linear-gradient(180deg, rgba(212,175,55,0.05) 0%, rgba(18,18,18,0.98) 16%, rgba(11,11,11,0.98) 100%)",marginBottom:"16px",boxShadow:"inset 0 1px 0 rgba(255,255,255,0.03)" },
    debtCard:  { border:"1px solid #3d1515",padding:"12px 16px",background:"linear-gradient(180deg, rgba(111,25,25,0.10) 0%, rgba(15,8,8,0.96) 100%)",marginBottom:"6px",display:"flex",justifyContent:"space-between",alignItems:"center" },
    reckoningCard: { border:"1px solid #6b21a8",padding:"12px 16px",background:"linear-gradient(180deg, rgba(107,33,168,0.12) 0%, rgba(15,10,20,0.96) 100%)",marginBottom:"6px" },
    draftGrid: n=>({ display:"grid",gridTemplateColumns:`repeat(${Math.min(n, 3)}, 1fr)`,gap:"12px" }),
    draftCard: { border:"1px solid #2b2416",padding:"16px",background:"linear-gradient(180deg, rgba(212,175,55,0.04) 0%, rgba(16,16,16,0.96) 18%, rgba(12,12,12,0.98) 100%)",cursor:"pointer",boxShadow:"inset 0 1px 0 rgba(255,255,255,0.03)" },
    tag:       color=>({ display:"inline-block",fontSize:"10px",letterSpacing:"1px",color:color||"#555",marginRight:"8px" }),
    numInput:  { background:"#0c0c0c",border:"1px solid #2a2a2a",color:"#fff",padding:"2px 6px",fontFamily:"inherit",fontSize:"12px",textAlign:"right" },
    footer:    { marginTop:"48px",borderTop:"1px solid #1a1a1a",paddingTop:"12px",display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:"8px",fontSize:"10px",color:"#4a4a4a",letterSpacing:"1px" },
    displayHero:{ fontFamily:displayFont,fontSize:"44px",lineHeight:"0.95",letterSpacing:"1px",textTransform:"uppercase",color:"#f3efe0",textShadow:"0 1px 0 rgba(0,0,0,0.55), 0 0 18px rgba(212,175,55,0.08)" },
    displayValue:{ fontFamily:displayFont,fontSize:"34px",lineHeight:"1",letterSpacing:"1px",color:"#f0e3b3",textShadow:"0 1px 0 rgba(0,0,0,0.5)" },
    displayCardTitle:{ fontFamily:displayFont,fontSize:"24px",lineHeight:"1.08",letterSpacing:"0.6px",textTransform:"uppercase",color:"#f4efe0",textShadow:"0 1px 0 rgba(0,0,0,0.45)" },
    displayBigTitle:{ fontFamily:displayFont,fontSize:"34px",lineHeight:"1.05",letterSpacing:"0.8px",textTransform:"uppercase",color:"#f4efe0",textShadow:"0 1px 0 rgba(0,0,0,0.45), 0 0 20px rgba(212,175,55,0.06)" },
  };

  const statusColor = draftStatus==="blocked"?"#f87171":draftStatus==="cursed"?"#fbbf24":draftStatus==="favored"?"#c4b5fd":draftStatus==="hot_streak"?"#fb923c":"#4ade80";
  const tierColor   = TIER_COLORS[currentTier]||"#fff";
  const writPoolCount = WRIT_POOL.filter(w=>!w.trial).length;
  const questCapeLandmark = LANDMARK_WRITS.find(lm => lm.id === "landmark_quest_cape");
  const canTriggerQuestCape = !!questCapeLandmark && !completedLandmarks.includes(questCapeLandmark.id);
  const showQuestCapePrompt = canTriggerQuestCape && (mettleLevel >= 80 || assignedPath || completedLandmarks.length > 0);
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
            <div style={{...s.displayHero,margin:0}}>METTLE</div>
            <div style={{fontSize:"10px",color:"#7b6a32",letterSpacing:"4px",marginTop:"6px"}}>WRIT SKILL — PROTOTYPE v1.0</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:"10px",color:"#666",letterSpacing:"4px",marginBottom:"6px"}}>CURRENT STANDING</div>
            <div style={s.displayValue}>
              LVL {String(mettleLevel).padStart(2,"0")}
              <span style={{fontSize:"16px",color:"#675a34",marginLeft:"6px",fontFamily:"'Courier New', monospace"}}>/99</span>
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
                      <div style={{...s.displayCardTitle,fontSize:"18px",color:"#d8b4fe"}}>⚡ {rw.title}</div>
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
              <span style={{color:"#555"}}>{pathRevealed ? "Final Trial path revealed" : "Final Trial pool locked at Level 99"}</span>
            </div>
          )}

          {/* ═══ FORK PRESENTATION ═══ */}
          {forkPhase === "presenting" && activeFork && (
            <div style={{animation:"trialRevealIn 0.6s ease-out, forkPulse 3s infinite",textAlign:"center",padding:"48px 20px",border:"2px solid #dc2626",background:"radial-gradient(circle at top, rgba(220,38,38,0.12) 0%, rgba(12,12,12,1) 40%)",marginBottom:"20px"}}>
              <div style={{fontSize:"10px",letterSpacing:"6px",color:"#dc2626",marginBottom:"16px"}}>⚡ FORK WRIT ⚡</div>
              <div style={{...s.displayBigTitle,color:"#fff",marginBottom:"10px"}}>{activeFork.title}</div>
              <div style={{fontSize:"12px",color:"#666",marginBottom:"32px",maxWidth:"500px",margin:"0 auto 32px",lineHeight:"1.6"}}>
                Two paths diverge. You must choose one. The other vanishes permanently.
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"20px",maxWidth:"640px",margin:"0 auto"}}>
                <div style={{border:"1px solid #444",padding:"24px 16px",background:"#111",cursor:"pointer",transition:"border-color 0.2s"}}
                  onMouseEnter={e=>e.currentTarget.style.borderColor="#dc2626"}
                  onMouseLeave={e=>e.currentTarget.style.borderColor="#444"}
                  onClick={()=>chooseForkOption(activeFork,"a")}>
                  <div style={{fontSize:"10px",letterSpacing:"3px",color:"#dc2626",marginBottom:"8px"}}>OPTION A</div>
                  <div style={{...s.displayCardTitle,fontSize:"18px",marginBottom:"8px"}}>{activeFork.optionA.label}</div>
                  <div style={{fontSize:"12px",color:"#888",lineHeight:"1.5"}}>{activeFork.optionA.objective}</div>
                  <div style={{marginTop:"12px",fontSize:"11px",color:"#555"}}>{activeFork.xp} XP</div>
                </div>
                <div style={{border:"1px solid #444",padding:"24px 16px",background:"#111",cursor:"pointer",transition:"border-color 0.2s"}}
                  onMouseEnter={e=>e.currentTarget.style.borderColor="#dc2626"}
                  onMouseLeave={e=>e.currentTarget.style.borderColor="#444"}
                  onClick={()=>chooseForkOption(activeFork,"b")}>
                  <div style={{fontSize:"10px",letterSpacing:"3px",color:"#dc2626",marginBottom:"8px"}}>OPTION B</div>
                  <div style={{...s.displayCardTitle,fontSize:"18px",marginBottom:"8px"}}>{activeFork.optionB.label}</div>
                  <div style={{fontSize:"12px",color:"#888",lineHeight:"1.5"}}>{activeFork.optionB.objective}</div>
                  <div style={{marginTop:"12px",fontSize:"11px",color:"#555"}}>{activeFork.xp} XP</div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ LANDMARK REVEAL ═══ */}
          {landmarkPhase === "revealed" && activeLandmark && (
            <div style={{animation:"trialRevealIn 0.6s ease-out, landmarkGlow 3s infinite",textAlign:"center",padding:"48px 20px",border:"2px solid #3b82f6",background:"radial-gradient(circle at top, rgba(59,130,246,0.12) 0%, rgba(12,12,12,1) 40%)",marginBottom:"20px"}}>
              <div style={{fontSize:"10px",letterSpacing:"6px",color:"#3b82f6",marginBottom:"16px"}}>★ LANDMARK ★</div>
              <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:"80px",height:"80px",border:"1px solid rgba(59,130,246,0.55)",borderRadius:"999px",marginBottom:"16px",boxShadow:"0 0 30px rgba(59,130,246,0.18)"}}>
                <div style={{fontSize:"32px",color:"#93c5fd",lineHeight:1}}>★</div>
              </div>
              <div style={{...s.displayBigTitle,color:"#f4efe0",marginBottom:"10px"}}>{activeLandmark.title}</div>
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
              {debtWrits.map((c)=>(
                <div key={c.queueEntryId || c.id} style={s.debtCard}>
                  <div>
                    <div style={{color:"#f87171",fontSize:"13px",fontWeight:"700"}}>⚠ DEFERRED — {c.title}</div>
                    <div style={{color:"#666",fontSize:"11px",marginTop:"2px"}}>{c.objective}</div>
                    {c.modifier && <div style={{color:"#fb923c",fontSize:"10px",marginTop:"2px"}}>MODIFIER: {c.modifier}</div>}
                    {c.reckoning && <div style={{color:"#7c3aed",fontSize:"10px",marginTop:"2px"}}>ORIGINATED FROM RECKONING</div>}
                  </div>
                  <button style={s.btn(false,"#14380f","#4ade80")} onClick={()=>clearDebtWrit(c.queueEntryId)}>
                    CLEAR (+{writXp(c)} XP)
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ═══ TRIAL REVEAL SEQUENCE ═══ */}
          {trialPhase === "approaching" && pendingTrialData && (
            <div style={{animation:"trialRevealIn 0.6s ease-out, trialGlow 2.5s infinite",textAlign:"center",padding:"60px 20px",border:"1px solid #d4af37",background:"linear-gradient(180deg, #141008 0%, #0c0c0c 100%)",marginBottom:"20px"}}>
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
                  <span style={s.displayBigTitle}>{pendingTrialData.title}</span>
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
                  <div style={{...s.displayBigTitle,marginBottom:"12px",textWrap:"balance"}}>{activeWrit.title}</div>
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
                    <button style={{...s.btn(false,"#14380f","#4ade80"),padding:"14px 36px",fontSize:"14px",letterSpacing:"3px"}} onClick={()=>resolveActiveWrit("complete")}>
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
                <div style={{...s.displayCardTitle,marginBottom:"8px"}}>{activeWrit.title}</div>
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
                  <button style={s.btn(false,"#14380f","#4ade80")} onClick={()=>resolveActiveWrit("complete")}>
                    ✓ COMPLETE (+{writXp(activeWrit)} XP)
                  </button>
                  <button style={s.btn(false,"#1a1a0a","#fbbf24")} onClick={()=>resolveActiveWrit("defer")}
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
                        fontFamily:displayFont,
                        ...(pendingTrial ? {background:"#d4af37",color:"#000",borderColor:"#d4af37"} : {})
                      }} onClick={drawWrits}>
                        {pendingTrial ? "⚔ FACE THE TRIAL" : "DRAW WRITS"}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div style={{...s.secHead,marginBottom:"12px"}}>
                    {draftMode === "final_trial" ? "THE FINAL TRIAL — FIVE WRITS DRAWN, CHOOSE ONE" : "CHOOSE ONE — OTHERS DISAPPEAR PERMANENTLY"}
                  </div>
                  {draftMode === "final_trial" ? (
                    <div style={{fontSize:"11px",color:"#8c7a44",marginBottom:"16px",lineHeight:"1.6"}}>
                      Your path has been revealed. The final pool is fixed at five choices and cannot be rerolled.
                    </div>
                  ) : (
                    <div style={{display:"flex",gap:"8px",marginBottom:"16px",flexWrap:"wrap"}}>
                      <button style={s.btn(false,"#111827", mettleSeals >= REROLL_COST ? "#93c5fd" : "#4b5563")} onClick={rerollCurrentDraft} disabled={mettleSeals < REROLL_COST}>
                        REROLL DRAFT ({REROLL_COST} SEALS)
                      </button>
                      <button style={s.btn(false,"#1f2937", mettleSeals >= EXTRA_CHOICE_COST && currentDraft.length < 5 ? "#c4b5fd" : "#4b5563")} onClick={buyExtraDraftChoice} disabled={mettleSeals < EXTRA_CHOICE_COST || currentDraft.length >= 5}>
                        +1 CHOICE ({EXTRA_CHOICE_COST} SEALS)
                      </button>
                    </div>
                  )}
                  <div style={s.draftGrid(currentDraft.length)}>
                    {currentDraft.map((w,i)=>(
                      <div key={i} style={{...s.draftCard, borderColor: w.modifier ? "#3d2a08" : "#2a2a2a"}}
                        onMouseEnter={e=>e.currentTarget.style.borderColor=w.modifier?"#d4af37":"#666"}
                        onMouseLeave={e=>e.currentTarget.style.borderColor=w.modifier?"#3d2a08":"#2a2a2a"}
                        onClick={()=>chooseWrit(w)}>
                        <div style={{fontSize:"10px",marginBottom:"8px"}}>
                          <span style={s.tag(CAT_COLORS[w.category]||"#555")}>{w.category.toUpperCase()}</span>
                          <span style={s.tag(TIER_COLORS[w.tier]||"#555")}>{w.tier.toUpperCase()}</span>
                          {draftMode === "final_trial" && <span style={s.tag("#d4af37")}>FINAL TRIAL</span>}
                          {w.modifier && <span style={s.tag("#fb923c")}>⚡ MODIFIED</span>}
                        </div>
                        <div style={{...s.displayCardTitle,fontSize:"18px",marginBottom:"8px"}}>{w.title}</div>
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

          {showQuestCapePrompt && !activeWrit && !trialPhase && currentDraft.length === 0 && !activeFork && !activeLandmark && (
            <div style={{border:"1px solid #1e3a5f",background:"#0d1117",padding:"12px 14px",marginBottom:"20px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"12px",flexWrap:"wrap"}}>
                <div>
                  <div style={{fontSize:"11px",color:"#93c5fd",letterSpacing:"2px",marginBottom:"6px"}}>LATE-GAME LANDMARK</div>
                  <div style={{fontSize:"13px",color:"#fff",fontWeight:"700",marginBottom:"4px"}}>Quest Cape</div>
                  <div style={{fontSize:"11px",color:"#64748b",maxWidth:"460px"}}>
                    Wise Old Man can&apos;t confirm full quest completion, so this milestone is marked manually once you&apos;ve actually earned it.
                  </div>
                </div>
                <button style={s.btn(false,"#172554","#93c5fd")} onClick={triggerQuestCapeLandmark}>
                  MARK QUEST CAPE
                </button>
              </div>
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
