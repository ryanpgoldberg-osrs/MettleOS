"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import {
  CLEAR_DEFERRED_COST,
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
import { FORK_TASKS, getPendingFork } from "./data/forkDefs.js";
import { LANDMARK_TASKS, getPendingLandmark } from "./data/landmarkDefs.js";
import { TASK_POOL } from "./data/taskPool.js";
import {
  computePath,
  draftSizeFromStatus,
  generateDraft,
  generateFinalTrialDraft,
  generateReckoningTask,
  getDebtStatus,
  getPendingTrial,
  levelProgressPct,
  materializeTask,
  tierForLevel,
  unlockedFeatures,
  xpForLevel,
  xpToLevel,
} from "./systems/mettleSystems.js";
import {
  createEmptyDiaryState,
  parseAccountSyncText,
  summarizeDiaryState,
} from "./utils/accountSync.js";
import { modifierXpBonus, sealsForTask, streakSealBonus, taskXp } from "./utils/modifiers.js";
import { clearSave, exportSaveData, importSaveText, loadSave, writeSave } from "./utils/persistence.js";
import { createEmptyQuestState, parseQuestSyncText, summarizeQuestState } from "./utils/questSync.js";
import { accountAverage } from "./utils/skillHelpers.js";
import { fetchPlayerSnapshotByRsn } from "./utils/womImport.js";
import MerchantToggle from "./merchant/MerchantToggle.jsx";

const MerchantBoard = dynamic(() => import("./merchant/MerchantBoard.jsx"), {
  ssr: false,
});

function trialFlavorLine(trial) {
  if (!trial) return "The ledger has picked the next pressure point.";
  if (trial.tier === "Zaros") return "Your path narrows. Only proof remains.";
  if (trial.category === "Trial") return "The ledger found a weakness your account now has to answer.";
  return "This trial is now the priority.";
}

function trialCeremonyLabel(trial) {
  if (!trial) return "A task is ready";
  if (trial.tier === "Guthix") return "A task is ready";
  if (trial.tier === "Saradomin") return "A sealed directive emerges";
  if (trial.tier === "Bandos") return "A harder task is ready";
  if (trial.tier === "Zamorak") return "A blood-marked decree descends";
  if (trial.tier === "Zaros") return "The final reckoning stirs";
  return "A task is ready";
}

function activeTrialPrompt(trial) {
  if (!trial) return "Proof is demanded.";
  if (trial.acceptedAt) {
    if (trial.trialModifier) return "The terms are fixed. Enter prepared and clear the trial.";
    if (trial.tier === "Zaros") return "The trial stands open. Only execution remains.";
    if (trial.tier === "Zamorak") return "No more ceremony. The ledger expects action.";
    return "The task is now active. Finish it to move on.";
  }
  if (trial.trialModifier) return "Restriction imposed. Completion now carries weight.";
  if (trial.tier === "Zaros") return "No lesser answer will satisfy this trial.";
  if (trial.tier === "Zamorak") return "This task does not ask politely.";
  return "The moment has arrived. Only completion settles the draw.";
}

function recoveryXpForTask(task) {
  return Math.max(1, Math.round(taskXp(task) / 2));
}

function makeQueueEntryId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `debt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function toDeferredQueueEntry(task) {
  return { ...task, queueEntryId: task.queueEntryId || makeQueueEntryId() };
}

function hasOwn(save, key) {
  return Object.prototype.hasOwnProperty.call(save, key);
}

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────

/**
 * @param {{
 *   initialSkillLevels?: Record<string, number> | null,
 *   initialBossKC?: Record<string, number> | null,
 *   initialRsn?: string,
 *   initialQuestState?: Record<string, unknown> | null,
 *   initialDiaryState?: Record<string, unknown> | null,
 *   onResetToEntry?: (() => void) | null,
 * }} [props]
 */
export default function MettlePrototype({
  initialSkillLevels = null,
  initialBossKC = null,
  initialRsn = "",
  initialQuestState = null,
  initialDiaryState = null,
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
  const [deferredTasks,      setDeferredTasks]      = useState([]);
  const [mustClearAll,   setMustClearAll]   = useState(false);
  const [draftHistory,   setDraftHistory]   = useState([]);
  const [currentDraft,   setCurrentDraft]   = useState([]);
  const [draftMode,      setDraftMode]      = useState("normal");
  const [activeTask,     setActiveTask]     = useState(null);
  const [activeView,     setActiveView]     = useState("board");
  const [xpDrop,         setXpDrop]         = useState(null);
  const [merchantOpen, setMerchantOpen]     = useState(false);
  const [merchantReady, setMerchantReady]   = useState(false);

  // ── TRIAL REVEAL STATE
  const [trialPhase,     setTrialPhase]     = useState(null); // null | "approaching" | "revealed"
  const [pendingTrialTask, setPendingTrialTask] = useState(null);
  const [trialCeremonyStep, setTrialCeremonyStep] = useState(0);

  // ── HISTORY EXPAND
  const [expandedHistoryIdx, setExpandedHistoryIdx] = useState(null);

  // ── RESET CONFIRM
  const [confirmReset, setConfirmReset] = useState(false);
  const [saveFileMessage, setSaveFileMessage] = useState("");
  const importInputRef = useRef(null);
  const questSyncInputRef = useRef(null);

  // ── RECKONING STATE
  const [categoryDeferCounts, setCategoryDeferCounts] = useState({}); // { "PvM Intro": 2, "Quest": 1 }
  const [reckoningTasks,      setReckoningTasks]      = useState([]); // active reckoning tasks (max 2)
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
  const [questState, setQuestState]                 = useState(initialQuestState ?? createEmptyQuestState());
  const [diaryState, setDiaryState]                 = useState(initialDiaryState ?? createEmptyDiaryState());

  // ── LOAD
  useEffect(() => {
    if (hasInitialStats) return;
    const save=loadSave(); if(!save) return;
    if(hasOwn(save, "skillLevels"))         setSkillLevels(save.skillLevels);
    if(hasOwn(save, "skillLevels"))         setManualSkills(save.skillLevels);
    if(hasOwn(save, "bossKC"))              setBossKC(save.bossKC);
    if(hasOwn(save, "bossKC"))              setManualKC(save.bossKC);
    if(hasOwn(save, "mettleXP"))            setMettleXP(save.mettleXP);
    if(hasOwn(save, "mettleSeals"))         setMettleSeals(save.mettleSeals);
    if(hasOwn(save, "streak"))              setStreak(save.streak);
    if(hasOwn(save, "completedIds"))        setCompletedIds(save.completedIds);
    if(hasOwn(save, "history"))             setHistory(save.history);
    if(hasOwn(save, "deferredTasks"))           setDeferredTasks(save.deferredTasks.map(toDeferredQueueEntry));
    if(hasOwn(save, "mustClearAll"))        setMustClearAll(save.mustClearAll);
    if(hasOwn(save, "draftHistory"))        setDraftHistory(save.draftHistory);
    if(hasOwn(save, "currentDraft"))        setCurrentDraft(save.currentDraft);
    if(hasOwn(save, "draftMode"))           setDraftMode(save.draftMode);
    if(hasOwn(save, "activeTask"))          setActiveTask(save.activeTask);
    if(hasOwn(save, "activeView"))          setActiveView(save.activeView);
    if(hasOwn(save, "statsLoaded"))         setStatsLoaded(save.statsLoaded);
    if(hasOwn(save, "rsn"))                 setRsn(save.rsn);
    if(hasOwn(save, "trialPhase"))          setTrialPhase(save.trialPhase);
    if(hasOwn(save, "pendingTrialTask"))    setPendingTrialTask(save.pendingTrialTask);
    if(hasOwn(save, "categoryDeferCounts")) setCategoryDeferCounts(save.categoryDeferCounts);
    if(hasOwn(save, "reckoningTasks"))      setReckoningTasks(save.reckoningTasks);
    if(hasOwn(save, "reckoningTotals"))     setReckoningTotals(save.reckoningTotals);
    if(hasOwn(save, "favoredDrawsRemaining")) setFavoredDrawsRemaining(save.favoredDrawsRemaining);
    if(hasOwn(save, "completedForks"))      setCompletedForks(save.completedForks);
    if(hasOwn(save, "activeFork"))          setActiveFork(save.activeFork);
    if(hasOwn(save, "forkPhase"))           setForkPhase(save.forkPhase);
    if(hasOwn(save, "completedLandmarks"))  setCompletedLandmarks(save.completedLandmarks);
    if(hasOwn(save, "activeLandmark"))      setActiveLandmark(save.activeLandmark);
    if(hasOwn(save, "landmarkPhase"))       setLandmarkPhase(save.landmarkPhase);
    if(hasOwn(save, "assignedPath"))        setAssignedPath(save.assignedPath);
    if(hasOwn(save, "pathRevealed"))        setPathRevealed(save.pathRevealed);
    if(hasOwn(save, "questState"))          setQuestState(save.questState);
    if(hasOwn(save, "diaryState"))          setDiaryState(save.diaryState);
  }, [hasInitialStats]);

  // ── SAVE
  useEffect(() => {
    if(!statsLoaded) return;
    writeSave({
      skillLevels,bossKC,mettleXP,mettleSeals,streak,completedIds,history,deferredTasks,mustClearAll,draftHistory,currentDraft,draftMode,activeTask,activeView,statsLoaded,rsn,trialPhase,pendingTrialTask,categoryDeferCounts,reckoningTasks,reckoningTotals,favoredDrawsRemaining,completedForks,activeFork,forkPhase,completedLandmarks,activeLandmark,landmarkPhase,assignedPath,pathRevealed,questState,diaryState,
    });
  }, [skillLevels,bossKC,mettleXP,mettleSeals,streak,completedIds,history,deferredTasks,mustClearAll,draftHistory,currentDraft,draftMode,activeTask,activeView,statsLoaded,rsn,trialPhase,pendingTrialTask,categoryDeferCounts,reckoningTasks,reckoningTotals,favoredDrawsRemaining,completedForks,activeFork,forkPhase,completedLandmarks,activeLandmark,landmarkPhase,assignedPath,pathRevealed,questState,diaryState]);

  const mettleLevel = xpToLevel(mettleXP);
  const currentTier = tierForLevel(mettleLevel);
  const progressPct = levelProgressPct(mettleXP);
  const xpToNext    = xpForLevel(mettleLevel+1)-mettleXP;
  const draftStatus = getDebtStatus(deferredTasks, mustClearAll, streak, favoredDrawsRemaining);
  const avg         = accountAverage(skillLevels);
  const unlocked    = unlockedFeatures(mettleLevel);
  const nextUnlock  = METTLE_UNLOCKS.find(x => mettleLevel < x.level);

  // ── TIER GATE CHECK: are we at a gate level with uncleared debt/reckoning?
  const atTierGate = TIER_GATES.includes(mettleLevel) || TIER_GATES.some(g => mettleLevel > g && mettleLevel <= g + 1);
  const gateBlocked = atTierGate && (deferredTasks.length > 0 || reckoningTasks.length > 0);

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
  }, [trialPhase, pendingTrialTask]);

  useEffect(() => {
    if (!saveFileMessage) return;
    const timeout = setTimeout(() => setSaveFileMessage(""), 3000);
    return () => clearTimeout(timeout);
  }, [saveFileMessage]);

  function openQuestSyncPicker() {
    setSaveFileMessage("");
    questSyncInputRef.current?.click();
  }

  async function importQuestSyncFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const rawText = await file.text();
      const sync = parseAccountSyncText(rawText, { expectedRsn: rsn });
      let mergedBosses = sync.bosses;
      let resolvedRsn = sync.player.rsn;

      try {
        const womData = await fetchPlayerSnapshotByRsn(sync.player.rsn);
        const kc = {};
        KEY_BOSSES.forEach((boss) => {
          kc[boss] = womData?.bosses?.[boss] ?? sync.bosses?.[boss] ?? 0;
        });
        mergedBosses = kc;
        resolvedRsn = womData?.rsn ?? sync.player.rsn;
      } catch {
        setSaveFileMessage("Account sync imported. Wise Old Man boss sync was unavailable.");
      }

      setSkillLevels(sync.skills);
      setManualSkills(sync.skills);
      setBossKC(mergedBosses);
      setManualKC(mergedBosses);
      setQuestState(sync.questState);
      setDiaryState(sync.diaryState);
      setRsn(resolvedRsn);
      setSaveFileMessage(prev => prev || "Account sync imported.");
    } catch {
      try {
        const rawText = await file.text();
        const nextQuestState = parseQuestSyncText(rawText, { expectedRsn: rsn });
        setQuestState(nextQuestState);
        setSaveFileMessage("Quest-only sync imported.");
      } catch (error) {
        setSaveFileMessage(error instanceof Error ? error.message : "Account sync could not be imported.");
      }
    }
  }

  function confirmManualStats() { setSkillLevels({...manualSkills}); setBossKC({...manualKC}); setStatsLoaded(true); setFetchError(""); }

  function exportSaveFile() {
    const snapshot = loadSave();
    if (!snapshot) {
      setSaveFileMessage("No save is available to export yet.");
      return;
    }
    const slug = (rsn || "mettle-run")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const stamp = new Date().toISOString().slice(0, 10);
    const exportPayload = exportSaveData(snapshot);
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${slug || "mettle-run"}-${stamp}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setSaveFileMessage("Save file exported.");
  }

  function openImportPicker() {
    setSaveFileMessage("");
    importInputRef.current?.click();
  }

  async function importSaveFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!window.confirm("Importing a save file will replace the current local run on this browser. Continue?")) {
      return;
    }
    try {
      const rawText = await file.text();
      importSaveText(rawText);
      window.location.reload();
    } catch (error) {
      setSaveFileMessage(error instanceof Error ? error.message : "That save file could not be imported.");
    }
  }

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
    } catch { setFetchError("Couldn't load that player. Check the RSN or switch to manual entry."); }
    finally { setLoading(false); }
  }

  function drawTasks() {
    if (activeTask) return;
    if (mustClearAll || deferredTasks.length >= 3) return;
    if (reckoningTasks.length > 0) return;
    if (activeFork || activeLandmark) return;

    // Landmark check — auto-trigger if conditions met
    const pendingLandmark = getPendingLandmark(skillLevels, bossKC, completedLandmarks, questState);
    if (pendingLandmark) {
      setActiveLandmark(pendingLandmark);
      setLandmarkPhase("revealed");
      return;
    }

    // Fork check — auto-trigger if conditions met
    const pendingFork = getPendingFork(mettleLevel, completedForks, completedIds, questState, bossKC);
    if (pendingFork) {
      if (pendingFork.autoResolved) {
        setCompletedForks(prev => ({
          ...prev,
          [pendingFork.id]: {
            chosen: pendingFork.optionA.label,
            rejected: pendingFork.optionB.label,
            option: "auto_complete",
            autoResolvedReason: "Both fork paths were already complete from synced progress.",
          },
        }));
      } else {
      setActiveFork(pendingFork);
      setForkPhase("presenting");
      return;
      }
    }

    // Trial reveal sequence
    if (pendingTrial) {
      if (!trialPhase) {
        const resolved = {
          ...pendingTrial,
          ...materializeTask(pendingTrial, skillLevels, bossKC, questState, diaryState),
        };
        setPendingTrialTask(resolved);
        setTrialPhase("approaching");
        return;
      }
    }

    const last5=draftHistory.slice(-5);
    const draft=generateDraft(skillLevels,bossKC,completedIds,last5,deferredTasks,mettleLevel,null,streak,favoredDrawsRemaining,questState,diaryState);
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
    const draft = generateDraft(skillLevels, bossKC, completedIds, last5, deferredTasks, mettleLevel, currentDraft.length, streak, favoredDrawsRemaining, questState, diaryState);
    setMettleSeals(prev => prev - REROLL_COST);
    setCurrentDraft(draft);
    setDraftMode("normal");
    setDraftHistory(prev => [...prev, draft.map(w => w.id)]);
  }

  function buyExtraDraftChoice() {
    if (currentDraft.length === 0 || currentDraft.length >= 4 || mettleSeals < EXTRA_CHOICE_COST) return;
    const last5 = draftHistory.slice(-5);
    const expanded = generateDraft(skillLevels, bossKC, completedIds, last5, deferredTasks, mettleLevel, currentDraft.length + 1, streak, favoredDrawsRemaining, questState, diaryState);
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
    if (!pendingTrialTask || trialCeremonyStep < 5) return;
    if (pendingTrialTask.finalTrial) {
      const resolvedPath = assignedPath || computePath(history);
      const finalDraft = generateFinalTrialDraft(resolvedPath).map(task => ({
        ...task,
        sourceTrialId: pendingTrialTask.id,
      }));
      setAssignedPath(resolvedPath);
      setPathRevealed(true);
      setCurrentDraft(finalDraft);
      setDraftMode("final_trial");
      setTrialPhase(null);
      setPendingTrialTask(null);
      setTrialCeremonyStep(0);
      return;
    }
    setActiveTask({ ...pendingTrialTask, acceptedAt: Date.now() });
    setTrialPhase(null);
    setPendingTrialTask(null);
    setTrialCeremonyStep(0);
  }

  function chooseTask(task) {
    setCurrentDraft([]);
    setDraftMode("normal");
    setActiveTask({ ...task, acceptedAt: task.acceptedAt || Date.now() });
  }

  // ── FORK HANDLERS
  function chooseForkOption(fork, option) {
    // option is "a" or "b"
    const chosen = option === "a" ? fork.optionA : fork.optionB;
    const rejected = option === "a" ? fork.optionB : fork.optionA;
    if (chosen.alreadyCompleted) return;
    setCompletedForks(prev => ({ ...prev, [fork.id]: { chosen: chosen.label, rejected: rejected.label, option } }));
    // Create an active task from the chosen fork option
    setActiveTask({
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
    if (!questCapeLandmark || activeTask || trialPhase || currentDraft.length > 0 || activeFork || activeLandmark) return;
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
    if (!activeTask?.modifier || mettleSeals < REMOVE_MODIFIER_COST) return;
    setMettleSeals(prev => prev - REMOVE_MODIFIER_COST);
    setActiveTask(prev => {
      if (!prev) return prev;
      const cleanedObjective = prev.objective.replace(/\s+— MODIFIER: .*$/, "");
      return { ...prev, modifier: null, objective: cleanedObjective, modifierRemoved: true };
    });
  }

  function resolveActiveTask(result) {
    if (!activeTask) return;
    if (activeTask.trial && result === "defer") return;
    let xpGained=0;
    let sealsGained=0;
    let nextStreak = streak;
    if (result==="complete") {
      xpGained=taskXp(activeTask);
      sealsGained=sealsForTask(activeTask);
      nextStreak = streak + 1;
      sealsGained += streakSealBonus(nextStreak);
      if(!completedIds.includes(activeTask.id)) setCompletedIds(prev=>[...prev,activeTask.id]);
      if (activeTask.sourceTrialId && !completedIds.includes(activeTask.sourceTrialId)) {
        setCompletedIds(prev => [...prev, activeTask.sourceTrialId]);
      }
      setXpDrop({amount:taskXp(activeTask),id:Date.now()});
      setTimeout(()=>setXpDrop(null),1800);
      // Grant Favored state for 5 draws after completing a Trial
      if (activeTask.trial) {
        setFavoredDrawsRemaining(prev => prev + 5);
      }
    } else if (result==="defer") {
      nextStreak = 0;
      setFavoredDrawsRemaining(0);
      const cat = activeTask.category;
      const newDeferCounts = { ...categoryDeferCounts, [cat]: (categoryDeferCounts[cat] || 0) + 1 };
      setCategoryDeferCounts(newDeferCounts);

      const newDebt=[...deferredTasks,toDeferredQueueEntry(activeTask)];
      setDeferredTasks(newDebt);
      if (newDebt.length>=3) setMustClearAll(true);

      // Check if this category hit reckoning threshold (3 defers)
      if (newDeferCounts[cat] >= 3 && reckoningTasks.length < 2) {
        const totalForCat = (reckoningTotals[cat] || 0) + 1;
        setReckoningTotals(prev => ({ ...prev, [cat]: totalForCat }));
        const rw = generateReckoningTask(cat, totalForCat, mettleLevel, skillLevels, bossKC, questState, diaryState);
        if (rw) {
          setReckoningTasks(prev => [...prev, rw]);
        }
        // Reset the category defer count
        setCategoryDeferCounts(prev => ({ ...prev, [cat]: 0 }));
      }
    }
    if(xpGained>0) setMettleXP(prev=>Math.min(MAX_METTLE_XP,prev+xpGained));
    if(sealsGained>0) setMettleSeals(prev=>prev+sealsGained);
    setStreak(nextStreak);
    setHistory(prev=>[{...activeTask,result,xpGained,sealsGained,baseXp:activeTask.xp,modifierXpBonus:modifierXpBonus(activeTask),streakAfter:nextStreak,timestamp:Date.now()},...prev]);
    setActiveTask(null);
  }

  function clearDeferredTask(queueEntryId) {
    const c=deferredTasks.find(x=>x.queueEntryId===queueEntryId); if(!c) return;
    const newDebt=deferredTasks.filter(x=>x.queueEntryId!==queueEntryId);
    const xpGained = recoveryXpForTask(c);
    const nextStreak = streak;
    const sealsGained = 0;
    setDeferredTasks(newDebt);
    if (newDebt.length===0) setMustClearAll(false);
    setMettleXP(prev=>Math.min(MAX_METTLE_XP,prev+xpGained));
    setStreak(nextStreak);
    if(!completedIds.includes(c.id)) setCompletedIds(prev=>[...prev,c.id]);
    setXpDrop({amount:xpGained,id:Date.now()});
    setTimeout(()=>setXpDrop(null),1800);
    setHistory(prev=>[{...c,result:"debt_cleared",xpGained,sealsGained,baseXp:c.xp,modifierXpBonus:modifierXpBonus(c),streakAfter:nextStreak,timestamp:Date.now()},...prev]);
  }

  function clearDeferredTaskWithSeals(queueEntryId) {
    const c = deferredTasks.find(x => x.queueEntryId === queueEntryId); if (!c || mettleSeals < CLEAR_DEFERRED_COST) return;
    const newDebt = deferredTasks.filter(x => x.queueEntryId !== queueEntryId);
    const nextStreak = streak;
    setDeferredTasks(newDebt);
    if (newDebt.length === 0) setMustClearAll(false);
    setMettleSeals(prev => prev - CLEAR_DEFERRED_COST);
    setStreak(nextStreak);
    if (!completedIds.includes(c.id)) setCompletedIds(prev => [...prev, c.id]);
    setHistory(prev => [{
      ...c,
      result: "debt_cleared_with_seals",
      xpGained: 0,
      sealsGained: 0,
      sealsSpent: CLEAR_DEFERRED_COST,
      baseXp: c.xp,
      modifierXpBonus: modifierXpBonus(c),
      streakAfter: nextStreak,
      timestamp: Date.now()
    }, ...prev]);
  }

  function clearReckoningTask(id) {
    const rw = reckoningTasks.find(x => x.id === id); if (!rw) return;
    const xpGained = recoveryXpForTask(rw);
    const nextStreak = streak;
    const sealsGained = 0;
    setReckoningTasks(prev => prev.filter(x => x.id !== id));
    setMettleXP(prev => Math.min(MAX_METTLE_XP, prev + xpGained));
    setStreak(nextStreak);
    setXpDrop({ amount: xpGained, id: Date.now() });
    setTimeout(() => setXpDrop(null), 1800);
    setHistory(prev => [{ ...rw, result: "reckoning_cleared", xpGained, sealsGained, baseXp:rw.xp, modifierXpBonus:modifierXpBonus(rw), streakAfter: nextStreak, timestamp: Date.now() }, ...prev]);
  }

  function failReckoningTask(id) {
    const rw = reckoningTasks.find(x => x.id === id); if (!rw) return;
    setReckoningTasks(prev => prev.filter(x => x.id !== id));
    setFavoredDrawsRemaining(0);
    const newDebt = [...deferredTasks, toDeferredQueueEntry(rw)];
    setDeferredTasks(newDebt);
    setStreak(0);
    if (newDebt.length >= 3) setMustClearAll(true);
    setCategoryDeferCounts(prev => ({ ...prev, [rw.category]: (prev[rw.category] || 0) + 1 }));
    setHistory(prev => [{ ...rw, result: "reckoning_failed", xpGained: 0, sealsGained: 0, streakAfter: 0, timestamp: Date.now() }, ...prev]);
  }

  function resetRun() {
    if (!confirmReset) { setConfirmReset(true); return; }
    setMettleXP(0); setMettleSeals(0); setStreak(0); setCompletedIds([]); setHistory([]);
    setDeferredTasks([]); setMustClearAll(false); setDraftHistory([]); setCurrentDraft([]); setDraftMode("normal"); setActiveTask(null);
    setCategoryDeferCounts({}); setReckoningTasks([]); setReckoningTotals({});
    setTrialPhase(null); setPendingTrialTask(null); setExpandedHistoryIdx(null);
    setFavoredDrawsRemaining(0);
    setCompletedForks({}); setActiveFork(null); setForkPhase(null);
    setCompletedLandmarks([]); setActiveLandmark(null); setLandmarkPhase(null);
    setAssignedPath(null); setPathRevealed(false);
    setQuestState(createEmptyQuestState());
    setDiaryState(createEmptyDiaryState());
    setMerchantOpen(false);
    setMerchantReady(false);
    setConfirmReset(false);
    clearSave();
    onResetToEntry?.();
  }

  function openMerchantBoard() {
    setMerchantReady(true);
    setMerchantOpen(true);
  }

  const displayFont = "'RuneScape UF', 'Silkscreen', 'Arial Black', 'Trebuchet MS', 'Arial Narrow', Arial, sans-serif";
  const s = {
    root:      { fontFamily:"'Courier New', monospace",background:"radial-gradient(circle at 12% 0%, rgba(212,175,55,0.08), transparent 20%), radial-gradient(circle at 88% 14%, rgba(96,165,250,0.05), transparent 20%), linear-gradient(180deg, #060606 0%, #0b0b0b 44%, #090909 100%)",color:"#d4d4d4",minHeight:"100vh",padding:"20px 14px 64px" },
    shell:     { maxWidth:"1120px",margin:"0 auto",position:"relative" },
    header:    { border:"1px solid #1f1e1a",padding:"16px 18px",marginBottom:"16px",background:"linear-gradient(180deg, rgba(212,175,55,0.05) 0%, rgba(18,18,16,0.98) 16%, rgba(10,10,10,0.98) 100%)",boxShadow:"0 0 0 1px rgba(255,255,255,0.02), inset 0 1px 0 rgba(255,255,255,0.04)",position:"relative",overflow:"hidden" },
    xpBar:     { height:"4px",background:"#171717",marginTop:"16px" },
    xpFill:    pct=>({height:"100%",background:"linear-gradient(90deg, #b8922c 0%, #f0e0ad 100%)",width:`${pct}%`,transition:"width 0.4s"}),
    btn:       (active,bg,fg)=>({ padding:"9px 18px",fontFamily:"inherit",fontWeight:"700",fontSize:"11px",letterSpacing:"2px",textTransform:"uppercase",background:bg||(active?"#161616":"#0f0f0f"),color:fg||(active?"#f3e3a3":"#9a9a9a"),border:`1px solid ${active?"#8f7530":"#272727"}`,cursor:"pointer",boxShadow:active?"inset 0 1px 0 rgba(255,255,255,0.05), 0 0 18px rgba(212,175,55,0.05)":"none" }),
    secHead:   { fontSize:"10px",letterSpacing:"3px",color:"#8d7836",marginBottom:"12px" },
    activeCard:{ border:"1px solid #2c271d",padding:"24px",background:"linear-gradient(180deg, rgba(212,175,55,0.05) 0%, rgba(18,18,18,0.98) 16%, rgba(11,11,11,0.98) 100%)",marginBottom:"16px",boxShadow:"inset 0 1px 0 rgba(255,255,255,0.03)" },
    debtCard:  { border:"1px solid #3d1515",padding:"14px 16px",background:"linear-gradient(180deg, rgba(111,25,25,0.12) 0%, rgba(15,8,8,0.96) 100%)",marginBottom:"8px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:"14px" },
    reckoningCard: { border:"1px solid #6b21a8",padding:"14px 16px",background:"linear-gradient(180deg, rgba(107,33,168,0.14) 0%, rgba(15,10,20,0.96) 100%)",marginBottom:"8px" },
    draftGrid: n=>({ display:"grid",gridTemplateColumns:`repeat(auto-fit, minmax(${n > 1 ? 220 : 260}px, 1fr))`,gap:"16px" }),
    draftCard: { border:"1px solid #272117",padding:"18px",background:"linear-gradient(180deg, rgba(212,175,55,0.05) 0%, rgba(16,16,16,0.97) 22%, rgba(12,12,12,0.99) 100%)",cursor:"pointer",boxShadow:"inset 0 1px 0 rgba(255,255,255,0.03)",minHeight:"290px",display:"flex",flexDirection:"column",justifyContent:"space-between",position:"relative" },
    tag:       color=>({ display:"inline-block",fontSize:"10px",letterSpacing:"2px",color:color||"#555",marginRight:"8px",textTransform:"uppercase" }),
    numInput:  { background:"#0c0c0c",border:"1px solid #2a2a2a",color:"#fff",padding:"2px 6px",fontFamily:"inherit",fontSize:"12px",textAlign:"right" },
    footer:    { marginTop:"36px",borderTop:"1px solid #171717",paddingTop:"14px",display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:"12px",fontSize:"10px",color:"#565656",letterSpacing:"2px",textTransform:"uppercase" },
    displayHero:{ fontFamily:displayFont,fontSize:"36px",lineHeight:"0.95",letterSpacing:"1px",textTransform:"uppercase",color:"#f3efe0",textShadow:"0 1px 0 rgba(0,0,0,0.55), 0 0 18px rgba(212,175,55,0.08)" },
    displayValue:{ fontFamily:displayFont,fontSize:"34px",lineHeight:"1",letterSpacing:"1px",color:"#f0e3b3",textShadow:"0 1px 0 rgba(0,0,0,0.5)" },
    displayCardTitle:{ fontFamily:displayFont,fontSize:"22px",lineHeight:"1.08",letterSpacing:"0.6px",textTransform:"uppercase",color:"#f4efe0",textShadow:"0 1px 0 rgba(0,0,0,0.45)" },
    displayBigTitle:{ fontFamily:displayFont,fontSize:"34px",lineHeight:"1.05",letterSpacing:"0.8px",textTransform:"uppercase",color:"#f4efe0",textShadow:"0 1px 0 rgba(0,0,0,0.45), 0 0 20px rgba(212,175,55,0.06)" },
    heroKicker:{ fontSize:"10px",color:"#8d7836",letterSpacing:"4px",marginBottom:"8px",textTransform:"uppercase" },
    heroBody:  { fontSize:"12px",color:"#7e7e78",lineHeight:"1.75",maxWidth:"520px",marginTop:"12px" },
    railPanel: { border:"1px solid #25231b",background:"linear-gradient(180deg, rgba(212,175,55,0.03) 0%, rgba(13,13,13,0.98) 28%, rgba(9,9,9,0.98) 100%)",padding:"14px 16px",display:"flex",flexDirection:"column",justifyContent:"space-between",minHeight:"100%" },
    railValue:{ fontFamily:displayFont,fontSize:"20px",lineHeight:"1",letterSpacing:"0.8px",textTransform:"uppercase",color:"#f3efe0" },
    railCopy:  { fontSize:"12px",color:"#808080",lineHeight:"1.75" },
    railRow:   { display:"flex",justifyContent:"space-between",alignItems:"baseline",padding:"8px 0",borderTop:"1px solid #181818",fontSize:"11px",letterSpacing:"2px",textTransform:"uppercase" },
    infoStrip: { border:"1px solid #1d1d1a",padding:"12px 14px",marginBottom:"16px",background:"linear-gradient(180deg, rgba(255,255,255,0.015) 0%, rgba(10,10,10,0.98) 100%)",display:"flex",justifyContent:"space-between",alignItems:"center",gap:"14px",flexWrap:"wrap" },
    infoPrimary:{ color:"#4ade80",fontSize:"11px",letterSpacing:"2px",textTransform:"uppercase" },
    infoMetaWrap:{ display:"flex",alignItems:"center",gap:"10px",flexWrap:"wrap",marginLeft:"auto" },
    infoMeta:  { fontSize:"10px",letterSpacing:"2px",textTransform:"uppercase",color:"#a7a7a0",padding:"6px 8px",border:"1px solid #1c1c18",background:"rgba(255,255,255,0.015)" },
    navShell:  { border:"1px solid #181818",padding:"10px 12px",marginBottom:"16px",background:"rgba(7,7,7,0.86)",display:"flex",alignItems:"center",gap:"10px",flexWrap:"wrap" },
    sectionFrame:{ border:"1px solid #191919",padding:"18px",background:"linear-gradient(180deg, rgba(255,255,255,0.015) 0%, rgba(10,10,10,0.98) 100%)",marginBottom:"16px" },
    sectionLead:{ fontSize:"12px",color:"#8b8b84",lineHeight:"1.8",maxWidth:"640px" },
    drawShell: { border:"1px solid #1f1d17",padding:"46px 28px",background:"linear-gradient(180deg, rgba(212,175,55,0.05) 0%, rgba(11,11,11,0.98) 22%, rgba(8,8,8,0.99) 100%)",minHeight:"420px",display:"flex",alignItems:"center",justifyContent:"center",width:"100%" },
    objectiveBox:{ margin:"0 auto 18px",maxWidth:"680px",border:"1px solid rgba(212,175,55,0.14)",background:"linear-gradient(180deg, rgba(255,255,255,0.018) 0%, rgba(255,255,255,0.00) 100%)",padding:"18px 18px 16px" },
    dataPanel: { border:"1px solid #1a1a1a",background:"linear-gradient(180deg, rgba(255,255,255,0.015) 0%, rgba(10,10,10,0.98) 100%)",padding:"14px 16px",marginBottom:"16px" },
    statTile:  { display:"flex",justifyContent:"space-between",padding:"7px 10px",background:"#101010",fontSize:"12px",border:"1px solid #151515" },
    historyRow:{ padding:"12px 14px",background:"linear-gradient(180deg, rgba(255,255,255,0.015) 0%, rgba(10,10,10,0.98) 100%)",borderBottom:"1px solid #171717" },
  };

  const statusColor = draftStatus==="blocked"?"#f87171":draftStatus==="cursed"?"#fbbf24":draftStatus==="favored"?"#c4b5fd":draftStatus==="hot_streak"?"#fb923c":"#4ade80";
  const taskPoolCount = TASK_POOL.filter(w=>!w.trial).length;
  const questCapeLandmark = LANDMARK_TASKS.find(lm => lm.id === "landmark_quest_cape");
  const canTriggerQuestCape = !!questCapeLandmark && !completedLandmarks.includes(questCapeLandmark.id);
  const questSummary = summarizeQuestState(questState);
  const diarySummary = summarizeDiaryState(diaryState);
  const showQuestCapePrompt = canTriggerQuestCape && !questSummary.questCapeDetected && (mettleLevel >= 80 || assignedPath || completedLandmarks.length > 0);
  const viewLabels = { board: "LEDGER", stats: "STATS", history: "HISTORY" };
  const tierCounts = TIER_ORDER.map(t=>({
    tier:t, color:TIER_COLORS[t],
    count:TASK_POOL.filter(w=>w.tier===t&&!w.trial).length,
    done:completedIds.filter(id=>TASK_POOL.find(w=>w.id===id&&w.tier===t)).length,
  }));

  // Can we draw? Check all blockers
  const hasReckonings = reckoningTasks.length > 0;
  const hasForkPending = !!activeFork;
  const hasLandmarkPending = !!activeLandmark;
  const drawBlocked = mustClearAll || deferredTasks.length >= 3 || hasReckonings || gateBlocked || hasForkPending || hasLandmarkPending;
  let blockReason = "";
  if (hasForkPending) blockReason = "FORK TASK ACTIVE — CHOOSE A PATH";
  else if (hasLandmarkPending) blockReason = "LANDMARK ACTIVE — ACKNOWLEDGE TO CONTINUE";
  else if (hasReckonings) blockReason = `CLEAR ${reckoningTasks.length} RECKONING TASK${reckoningTasks.length>1?"S":""} TO DRAW`;
  else if (mustClearAll) blockReason = `CLEAR ALL ${deferredTasks.length} DEFERRED TASKS TO DRAW`;
  else if (gateBlocked) blockReason = "CLEAR ALL DEBT & RECKONINGS TO ADVANCE PAST TIER GATE";

  return (
    <div style={s.root}>
      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        style={{ display: "none" }}
        onChange={importSaveFile}
      />
      <input
        ref={questSyncInputRef}
        type="file"
        accept="application/json,.json"
        style={{ display: "none" }}
        onChange={importQuestSyncFile}
      />
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
        .mettle-header-grid {
          display:grid;
          grid-template-columns:minmax(0, 1.3fr) minmax(260px, 0.85fr);
          gap:16px;
          align-items:stretch;
        }
        .mettle-summary-grid {
          display:grid;
          grid-template-columns:repeat(3, minmax(0, 1fr));
          gap:10px;
          margin-top:auto;
        }
        .mettle-summary-cell {
          border:1px solid #1b1b18;
          background:rgba(255,255,255,0.015);
          padding:9px 11px;
        }
        .mettle-summary-cell strong {
          display:block;
          margin-top:5px;
          color:#f4efe0;
          font-size:12px;
          letter-spacing:1px;
        }
        .mettle-wordmark {
          margin:0;
        }
        .mettle-tier-strip {
          display:flex;
          gap:4px;
          margin-top:10px;
        }
        .mettle-info-strip {
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:14px;
          flex-wrap:wrap;
        }
        .mettle-info-primary {
          min-width:0;
        }
        .mettle-info-actions {
          display:flex;
          align-items:center;
          gap:10px;
          flex-wrap:wrap;
          margin-left:auto;
        }
        .mettle-nav {
          display:flex;
          align-items:center;
          gap:10px;
          flex-wrap:wrap;
        }
        .mettle-nav-spacer {
          flex:1;
        }
        .mettle-draft-actions {
          display:flex;
          gap:8px;
          margin-bottom:16px;
          flex-wrap:wrap;
        }
        @media (max-width: 900px) {
          .mettle-header-grid {
            grid-template-columns:1fr;
          }
          .mettle-summary-grid {
            grid-template-columns:repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 640px) {
          .mettle-wordmark {
            font-size:30px !important;
          }
          .mettle-summary-grid {
            grid-template-columns:1fr;
          }
          .mettle-summary-cell strong {
            font-size:11px;
            line-height:1.5;
          }
          .mettle-tier-strip {
            gap:8px;
          }
          .mettle-info-strip {
            align-items:flex-start;
          }
          .mettle-info-primary {
            width:100%;
            line-height:1.7;
          }
          .mettle-info-actions {
            width:100%;
            margin-left:0;
            justify-content:flex-start;
          }
          .mettle-nav {
            display:grid;
            grid-template-columns:repeat(2, minmax(0, 1fr));
            gap:8px;
          }
          .mettle-nav .mettle-nav-spacer {
            display:none;
          }
          .mettle-nav button {
            width:100%;
          }
          .mettle-draft-actions {
            display:grid;
            grid-template-columns:1fr;
          }
          .mettle-draft-actions button {
            width:100%;
          }
          .mettle-mobile-stack {
            flex-direction:column !important;
            align-items:flex-start !important;
            grid-template-columns:1fr !important;
          }
          .mettle-mobile-stack > * {
            width:100%;
          }
          .mettle-mobile-center {
            padding:36px 20px !important;
            min-height:auto !important;
          }
          .mettle-mobile-center-title {
            font-size:24px !important;
          }
          .mettle-mobile-card-title {
            font-size:16px !important;
          }
          .mettle-mobile-row {
            flex-direction:column;
            align-items:flex-start !important;
            gap:4px;
          }
        }
        .trial-stage-hidden { opacity:0; transform:translateY(10px); }
        .trial-stage-live { animation:trialTextIn 0.55s ease-out both; }
      `}</style>

      {xpDrop && <div key={xpDrop.id} className="xp-drop">+{xpDrop.amount.toLocaleString()} XP</div>}
      <div style={s.shell}>
      {/* HEADER */}
      <div style={s.header}>
        <div className="mettle-header-grid">
          <div style={{display:"flex",flexDirection:"column",minHeight:"100%"}}>
            <div style={s.heroKicker}>Mettle / Personal Ledger</div>
            <div className="mettle-wordmark" style={{...s.displayHero,margin:"0 0 12px"}}>METTLE</div>
            <div className="mettle-summary-grid">
              <div className="mettle-summary-cell">
                <div style={{fontSize:"10px",letterSpacing:"3px",color:"#666",textTransform:"uppercase"}}>Standing</div>
                <strong>
                  <span style={{display:"block"}}>Level {String(mettleLevel).padStart(2,"0")}</span>
                  <span style={{display:"block"}}>{mettleXP.toLocaleString()} XP</span>
                </strong>
              </div>
              <div className="mettle-summary-cell">
                <div style={{fontSize:"10px",letterSpacing:"3px",color:"#666",textTransform:"uppercase"}}>Pressure</div>
                <strong>
                  <span style={{display:"block"}}>{deferredTasks.length} deferred</span>
                  <span style={{display:"block"}}>{reckoningTasks.length} reckoning</span>
                </strong>
              </div>
              <div className="mettle-summary-cell">
                <div style={{fontSize:"10px",letterSpacing:"3px",color:"#666",textTransform:"uppercase"}}>Control</div>
                <strong>
                  <span style={{display:"block"}}>{mettleSeals} seals</span>
                  <span style={{display:"block"}}>{streak} streak</span>
                </strong>
              </div>
            </div>
          </div>
          <div style={s.railPanel}>
            <div>
              <div style={{fontSize:"10px",letterSpacing:"4px",color:"#666",marginBottom:"8px",textTransform:"uppercase"}}>Run State</div>
              <div style={s.railValue}>{currentTier} Tier</div>
              <div style={{fontSize:"12px",color:statusColor,letterSpacing:"3px",marginTop:"8px",textTransform:"uppercase"}}>{draftStatus.replace("_"," ")}</div>
            </div>
            <div>
              <div className="mettle-mobile-row" style={s.railRow}>
                <span style={{color:"#686868"}}>Next Unlock</span>
                <span style={{color:"#d8d0b6"}}>{nextUnlock ? `LVL ${nextUnlock.level} · ${xpToNext.toLocaleString()} XP` : "MAX"}</span>
              </div>
              <div className="mettle-mobile-row" style={s.railRow}>
                <span style={{color:"#686868"}}>Cleared</span>
                <span style={{color:"#d8d0b6"}}>{completedIds.length} tasks</span>
              </div>
              <div className="mettle-mobile-row" style={s.railRow}>
                <span style={{color:"#686868"}}>Ledger</span>
                <span style={{color:"#d8d0b6"}}>{drawBlocked ? "Blocked" : "Open"}</span>
              </div>
            </div>
          </div>
        </div>
        <div style={s.xpBar}><div style={s.xpFill(progressPct)}/></div>
        {statsLoaded && (
          <div className="mettle-tier-strip" style={{display:"flex",gap:"4px",marginTop:"10px"}}>
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
                {m==="manual"?"ENTER MANUALLY":"IMPORT FROM WISE OLD MAN"}
              </button>
            ))}
          </div>
          {inputMode==="wom" && (
            <div>
              <div style={{fontSize:"11px",color:"#666",marginBottom:"10px",lineHeight:"1.6"}}>
                Enter your RuneScape name to import public stats from Wise Old Man.
              </div>
              <div style={{display:"flex",gap:"8px"}}>
                <input style={{flex:1,background:"#111",border:"1px solid #2a2a2a",color:"#fff",padding:"8px 12px",fontFamily:"inherit",fontSize:"13px",outline:"none"}}
                  type="text" placeholder="Enter RSN..." value={rsn}
                  onChange={e=>setRsn(e.target.value)} onKeyDown={e=>e.key==="Enter"&&loadPlayerStats()}/>
                <button style={s.btn(false,loading?"#1a1a1a":"#fff",loading?"#555":"#000")} onClick={loadPlayerStats} disabled={loading}>
                  {loading?"IMPORTING...":"IMPORT"}
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
              <div style={s.secHead}>BOSS KILLCOUNT</div>
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
              <button style={{...s.btn(true),padding:"10px 32px"}} onClick={confirmManualStats}>START RUN</button>
            </div>
          )}
        </div>
      )}

      {statsLoaded && (
        <div style={s.infoStrip}>
          <div className="mettle-info-strip" style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"14px",flexWrap:"wrap",width:"100%"}}>
          <span className="mettle-info-primary" style={s.infoPrimary}>✓ {rsn||"Manual stats"} · AVG LVL {Math.round(avg)} · {mettleSeals} SEALS · {streak} STREAK</span>
          <div className="mettle-info-actions" style={s.infoMetaWrap}>
            <button style={{...s.btn(false),fontSize:"10px",padding:"4px 10px"}} onClick={exportSaveFile}>EXPORT SAVE</button>
            <button style={{...s.btn(false),fontSize:"10px",padding:"4px 10px"}} onClick={openImportPicker}>IMPORT SAVE</button>
            <button style={{...s.btn(false),fontSize:"10px",padding:"4px 10px"}} onClick={()=>{ setMerchantOpen(false); setStatsLoaded(false); }}>EDIT STATS</button>
          </div>
          </div>
          {saveFileMessage && (
            <div style={{fontSize:"10px",letterSpacing:"2px",textTransform:"uppercase",color:saveFileMessage.includes("could not") || saveFileMessage.includes("No save") ? "#f87171" : "#93c5fd",marginTop:"8px"}}>
              {saveFileMessage}
            </div>
          )}
        </div>
      )}

      {statsLoaded && (
        <div className="mettle-nav" style={s.navShell}>
          {["board","stats","history"].map(v=>(
            <button key={v} style={s.btn(activeView===v)} onClick={()=>setActiveView(v)}>{viewLabels[v]}</button>
          ))}
          <MerchantToggle isActive={merchantOpen} onClick={openMerchantBoard} buttonStyle={s.btn(merchantOpen)} />
          <div className="mettle-nav-spacer" style={{flex:1}}/>
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

      {/* ══ LEDGER ══ */}
      {statsLoaded && activeView==="board" && (
        <div>
          {/* RECKONING TASKS — top priority, above debt */}
          {reckoningTasks.length > 0 && (
            <div style={{...s.sectionFrame,borderColor:"#6b21a8",background:"#0a0612",animation:"reckoningPulse 3s infinite"}}>
              <div style={{...s.secHead,color:"#a855f7"}}>
                ⚡ RECKONING — {reckoningTasks.length} ACTIVE · MUST CLEAR TO DRAW OR ADVANCE
              </div>
          {reckoningTasks.map((rw, i) => (
                <div key={i} style={s.reckoningCard}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"8px"}}>
                    <div>
                      <div style={{...s.displayCardTitle,fontSize:"18px",color:"#d8b4fe"}}>⚡ {rw.title}</div>
                      <div style={{fontSize:"10px",color:"#666",marginTop:"2px"}}>
                        <span style={s.tag("#a855f7")}>RECKONING #{rw.reckoningCount}</span>
                        <span style={s.tag(DIFF_COLORS[rw.difficulty])}>{rw.difficulty.toUpperCase()}</span>
                        <span style={s.tag("#555")}>{recoveryXpForTask(rw)} XP</span>
                      </div>
                    </div>
                  </div>
                  <div style={{fontSize:"12px",color:"#999",marginBottom:"4px"}}>{rw.objective}</div>
                  <div style={{fontSize:"11px",color:"#7c3aed",marginBottom:"12px"}}>MODIFIER: {rw.modifier}</div>
                  <div style={{display:"flex",gap:"8px"}}>
                    <button style={s.btn(false,"#14380f","#4ade80")} onClick={()=>clearReckoningTask(rw.id)}>
                      ✓ COMPLETE (+{recoveryXpForTask(rw)} XP)
                    </button>
                    <button style={s.btn(false,"#1a0a0a","#f87171")} onClick={()=>failReckoningTask(rw.id)}>
                      ✗ FAIL → DEFERRED TASKS
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* CATEGORY WARNINGS (2 defers) */}
          {warningCategories.length > 0 && (
            <div style={{...s.sectionFrame,borderColor:"#44337a",background:"#0e0a16",fontSize:"11px",color:"#a78bfa",padding:"12px 16px"}}>
              ⚠ RECKONING WARNING — {warningCategories.join(", ")} at 2 defers. One more defer triggers a Reckoning Task.
            </div>
          )}

          {/* PENDING TRIAL NOTICE */}
          {pendingTrial && !activeTask && !trialPhase && currentDraft.length === 0 && !activeFork && !activeLandmark && (
            <div style={{...s.sectionFrame,borderColor:"#d4af37",background:"#141008",fontSize:"11px",color:"#fbbf24",padding:"12px 16px"}}>
              ⚔ TRIAL OF METTLE APPROACHING — Level {pendingTrial.triggerLevel}. The ledger demands you answer.
            </div>
          )}

          {/* PATH INDICATOR (Zaros tier) */}
          {assignedPath && (
            <div style={{...s.sectionFrame,borderColor:"#6b21a8",background:"#0f0a14",fontSize:"11px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:"14px",flexWrap:"wrap",padding:"12px 16px"}}>
              <span style={{color:"#d8b4fe",letterSpacing:"2px"}}>PATH ASSIGNED: <span style={{color:"#fff",fontWeight:"700"}}>{assignedPath.toUpperCase()}</span></span>
              <span style={{color:"#555"}}>{pathRevealed ? "Final Trial path revealed" : "Final Trial pool locked at Level 99"}</span>
            </div>
          )}

          {/* ═══ FORK PRESENTATION ═══ */}
          {forkPhase === "presenting" && activeFork && (
            <div style={{animation:"trialRevealIn 0.6s ease-out, forkPulse 3s infinite",textAlign:"center",padding:"48px 20px",border:"2px solid #dc2626",background:"radial-gradient(circle at top, rgba(220,38,38,0.12) 0%, rgba(12,12,12,1) 40%)",marginBottom:"16px"}}>
              <div style={{fontSize:"10px",letterSpacing:"6px",color:"#dc2626",marginBottom:"16px"}}>⚡ FORK TASK ⚡</div>
              <div style={{...s.displayBigTitle,color:"#fff",marginBottom:"10px"}}>{activeFork.title}</div>
              <div style={{fontSize:"12px",color:"#666",marginBottom:"32px",maxWidth:"500px",margin:"0 auto 32px",lineHeight:"1.6"}}>
                {activeFork.availableOptions?.length === 1
                  ? "One path is already complete on this account. The remaining path is the only live branch."
                  : "Two paths diverge. You must choose one. The other vanishes permanently."}
              </div>
              <div className="mettle-mobile-stack" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"20px",maxWidth:"640px",margin:"0 auto"}}>
                <div style={{border:`1px solid ${activeFork.optionA.alreadyCompleted ? "#1f4d36" : "#444"}`,padding:"24px 16px",background:"#111",cursor:activeFork.optionA.alreadyCompleted ? "default" : "pointer",opacity:activeFork.optionA.alreadyCompleted ? 0.72 : 1,transition:"border-color 0.2s"}}
                  onMouseEnter={e=>{ if (!activeFork.optionA.alreadyCompleted) e.currentTarget.style.borderColor="#dc2626"; }}
                  onMouseLeave={e=>{ e.currentTarget.style.borderColor=activeFork.optionA.alreadyCompleted ? "#1f4d36" : "#444"; }}
                  onClick={()=>chooseForkOption(activeFork,"a")}>
                  <div style={{fontSize:"10px",letterSpacing:"3px",color:"#dc2626",marginBottom:"8px"}}>OPTION A</div>
                  <div style={{...s.displayCardTitle,fontSize:"18px",marginBottom:"8px"}}>{activeFork.optionA.label}</div>
                  <div style={{fontSize:"12px",color:"#888",lineHeight:"1.5"}}>{activeFork.optionA.objective}</div>
                  {activeFork.optionA.alreadyCompleted && (
                    <div style={{marginTop:"10px",fontSize:"11px",color:"#4ade80"}}>Already complete from synced progress</div>
                  )}
                  <div style={{marginTop:"12px",fontSize:"11px",color:"#555"}}>{activeFork.xp} XP</div>
                </div>
                <div style={{border:`1px solid ${activeFork.optionB.alreadyCompleted ? "#1f4d36" : "#444"}`,padding:"24px 16px",background:"#111",cursor:activeFork.optionB.alreadyCompleted ? "default" : "pointer",opacity:activeFork.optionB.alreadyCompleted ? 0.72 : 1,transition:"border-color 0.2s"}}
                  onMouseEnter={e=>{ if (!activeFork.optionB.alreadyCompleted) e.currentTarget.style.borderColor="#dc2626"; }}
                  onMouseLeave={e=>{ e.currentTarget.style.borderColor=activeFork.optionB.alreadyCompleted ? "#1f4d36" : "#444"; }}
                  onClick={()=>chooseForkOption(activeFork,"b")}>
                  <div style={{fontSize:"10px",letterSpacing:"3px",color:"#dc2626",marginBottom:"8px"}}>OPTION B</div>
                  <div style={{...s.displayCardTitle,fontSize:"18px",marginBottom:"8px"}}>{activeFork.optionB.label}</div>
                  <div style={{fontSize:"12px",color:"#888",lineHeight:"1.5"}}>{activeFork.optionB.objective}</div>
                  {activeFork.optionB.alreadyCompleted && (
                    <div style={{marginTop:"10px",fontSize:"11px",color:"#4ade80"}}>Already complete from synced progress</div>
                  )}
                  <div style={{marginTop:"12px",fontSize:"11px",color:"#555"}}>{activeFork.xp} XP</div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ LANDMARK REVEAL ═══ */}
          {landmarkPhase === "revealed" && activeLandmark && (
            <div style={{animation:"trialRevealIn 0.6s ease-out, landmarkGlow 3s infinite",textAlign:"center",padding:"48px 20px",border:"2px solid #3b82f6",background:"radial-gradient(circle at top, rgba(59,130,246,0.12) 0%, rgba(12,12,12,1) 40%)",marginBottom:"16px"}}>
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
          {deferredTasks.length>0 && (
            <div style={{...s.sectionFrame,borderColor:"#3d1515",background:"#0a0606"}}>
              <div style={{...s.secHead,color:"#f87171"}}>
                DEFERRED TASKS — {deferredTasks.length} OUTSTANDING
                {mustClearAll && " · BLOCKED — CLEAR ALL TO DRAW AGAIN"}
              </div>
              {deferredTasks.map((c)=>(
                <div key={c.queueEntryId || c.id} style={s.debtCard}>
                  <div>
                    <div style={{color:"#f87171",fontSize:"13px",fontWeight:"700"}}>⚠ DEFERRED — {c.title}</div>
                    <div style={{color:"#666",fontSize:"11px",marginTop:"2px"}}>{c.objective}</div>
                    {c.modifier && <div style={{color:"#fb923c",fontSize:"10px",marginTop:"2px"}}>MODIFIER: {c.modifier}</div>}
                    {c.reckoning && <div style={{color:"#7c3aed",fontSize:"10px",marginTop:"2px"}}>ORIGINATED FROM RECKONING</div>}
                  </div>
                  <div style={{display:"flex",gap:"8px",flexWrap:"wrap",justifyContent:"flex-end"}}>
                    <button style={s.btn(false,"#14380f","#4ade80")} onClick={()=>clearDeferredTask(c.queueEntryId)}>
                      CLEAR (+{recoveryXpForTask(c)} XP)
                    </button>
                    <button
                      style={s.btn(false,"#111827", mettleSeals >= CLEAR_DEFERRED_COST ? "#93c5fd" : "#4b5563")}
                      onClick={()=>clearDeferredTaskWithSeals(c.queueEntryId)}
                      disabled={mettleSeals < CLEAR_DEFERRED_COST}
                    >
                      SEAL CLEAR ({CLEAR_DEFERRED_COST} SEALS)
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ═══ TRIAL REVEAL SEQUENCE ═══ */}
          {trialPhase === "approaching" && pendingTrialTask && (
            <div style={{animation:"trialRevealIn 0.6s ease-out, trialGlow 2.5s infinite",textAlign:"center",padding:"60px 20px",border:"1px solid #d4af37",background:"linear-gradient(180deg, #141008 0%, #0c0c0c 100%)",marginBottom:"16px"}}>
              <div style={{fontSize:"10px",letterSpacing:"6px",color:"#d4af37",marginBottom:"24px"}}>⚔ TRIAL OF METTLE ⚔</div>
              <div style={{fontSize:"14px",letterSpacing:"4px",color:"#fbbf24",marginBottom:"12px"}}>LEVEL {pendingTrialTask.triggerLevel}</div>
              <div style={{fontSize:"11px",color:"#666",marginBottom:"32px",maxWidth:"400px",margin:"0 auto 32px",lineHeight:"1.6"}}>
                The ledger has watched your progress. A trial is ready. It cannot be skipped. It must be cleared before the run moves on.
              </div>
              <button style={{padding:"14px 48px",fontFamily:"inherit",fontWeight:"700",fontSize:"14px",letterSpacing:"4px",background:"transparent",color:"#d4af37",border:"1px solid #d4af37",cursor:"pointer"}} onClick={revealTrial}>
                REVEAL TRIAL
              </button>
            </div>
          )}

          {trialPhase === "revealed" && pendingTrialTask && (
            <div style={{animation:"trialRevealIn 0.5s ease-out",position:"relative",overflow:"hidden",border:"2px solid #d4af37",padding:"36px 24px",background:"radial-gradient(circle at top, rgba(212,175,55,0.14) 0%, rgba(26,19,8,1) 28%, rgba(12,12,12,1) 100%)",marginBottom:"16px",boxShadow:"0 0 60px rgba(212,175,55,0.12) inset, 0 0 30px rgba(0,0,0,0.35)",minHeight:"360px"}}>
              <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0) 28%, rgba(0,0,0,0.18) 100%)",pointerEvents:"none"}} />
              <div style={{position:"relative",zIndex:1,textAlign:"center",maxWidth:"720px",margin:"0 auto"}}>
                <div className={trialCeremonyStep >= 1 ? "trial-stage-live" : "trial-stage-hidden"} style={{fontSize:"10px",letterSpacing:"6px",color:"#d4af37",marginBottom:"18px"}}>
                  ⚔ TRIAL OF METTLE ⚔
                </div>

                <div className={trialCeremonyStep >= 1 ? "trial-stage-live" : "trial-stage-hidden"} style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:"92px",height:"92px",border:"1px solid rgba(212,175,55,0.55)",borderRadius:"999px",marginBottom:"18px",boxShadow:"0 0 30px rgba(212,175,55,0.18)",animation:"trialSigilPulse 2.4s ease-in-out infinite"}}>
                  <div style={{fontSize:"34px",color:"#f6d77b",lineHeight:1}}>✦</div>
                </div>

                <div className={trialCeremonyStep >= 2 ? "trial-stage-live" : "trial-stage-hidden"} style={{fontSize:"12px",letterSpacing:"4px",color:"#fbbf24",marginBottom:"10px",textTransform:"uppercase"}}>
                  {trialCeremonyLabel(pendingTrialTask)}
                </div>

                <div className={trialCeremonyStep >= 2 ? "trial-stage-live" : "trial-stage-hidden"} style={{display:"flex",justifyContent:"center",gap:"8px",flexWrap:"wrap",marginBottom:"18px"}}>
                  <span style={s.tag(DIFF_COLORS[pendingTrialTask.difficulty])}>{pendingTrialTask.difficulty.toUpperCase()}</span>
                  <span style={s.tag(TIER_COLORS[pendingTrialTask.tier]||"#555")}>{pendingTrialTask.tier.toUpperCase()}</span>
                  <span style={s.tag(CAT_COLORS[pendingTrialTask.category]||"#777")}>{pendingTrialTask.category.toUpperCase()}</span>
                  <span style={s.tag("#d4af37")}>{taskXp(pendingTrialTask)} XP</span>
                </div>

                <div className={trialCeremonyStep >= 3 ? "trial-stage-live" : "trial-stage-hidden"} style={{fontSize:"30px",fontWeight:"700",color:"#fff",marginBottom:"12px",lineHeight:"1.2",textWrap:"balance"}}>
                  <span style={s.displayBigTitle}>{pendingTrialTask.title}</span>
                </div>

                <div className={trialCeremonyStep >= 3 ? "trial-stage-live" : "trial-stage-hidden"} style={{fontSize:"12px",letterSpacing:"2px",color:"#8c7a44",marginBottom:"16px",textTransform:"uppercase"}}>
                  {trialFlavorLine(pendingTrialTask)}
                </div>

                <div className={trialCeremonyStep >= 4 ? "trial-stage-live" : "trial-stage-hidden"} style={{fontSize:"15px",color:"#d1d5db",margin:"0 auto 14px",maxWidth:"620px",lineHeight:"1.75"}}>
                  {pendingTrialTask.objective}
                </div>

                {pendingTrialTask.trialModifier && (
                  <div className={trialCeremonyStep >= 5 ? "trial-stage-live" : "trial-stage-hidden"} style={{margin:"18px auto 0",maxWidth:"500px",padding:"12px 16px",border:"1px solid #4a2d0c",background:"linear-gradient(180deg, rgba(65,38,9,0.55) 0%, rgba(24,16,8,0.88) 100%)",boxShadow:"0 0 18px rgba(251,146,60,0.08)",animation: trialCeremonyStep >= 5 ? "modifierFlash 1.8s ease-out 1" : undefined}}>
                    <div style={{fontSize:"10px",letterSpacing:"4px",color:"#fb923c",marginBottom:"6px"}}>RESTRICTION IMPOSED</div>
                    <div style={{fontSize:"13px",color:"#fdba74"}}>{pendingTrialTask.trialModifier}</div>
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

          {/* ═══ ACTIVE TASK ═══ */}
          {activeTask && (
            activeTask.trial ? (
              <div style={{animation:"trialRevealIn 0.45s ease-out",position:"relative",overflow:"hidden",border:"2px solid #d4af37",padding:"34px 24px",background:"radial-gradient(circle at top, rgba(120,92,21,0.18) 0%, rgba(20,18,13,1) 18%, rgba(10,10,10,1) 100%)",marginBottom:"16px",boxShadow:"0 0 40px rgba(212,175,55,0.08) inset, 0 0 30px rgba(0,0,0,0.35)",minHeight:"380px"}}>
                <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg, rgba(255,255,255,0.015) 0%, rgba(0,0,0,0) 26%, rgba(0,0,0,0.24) 100%)",pointerEvents:"none"}} />
                <div style={{position:"relative",textAlign:"center"}}>
                  <div style={{fontSize:"10px",letterSpacing:"6px",color:"#7a6a34",marginBottom:"10px"}}>TRIAL IN PROGRESS</div>
                  <div style={{fontSize:"11px",letterSpacing:"3px",color:"#9ca3af",marginBottom:"18px",textTransform:"uppercase"}}>The reveal has passed. The ledger now expects execution.</div>
                  <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:"84px",height:"84px",border:"1px solid rgba(212,175,55,0.42)",borderRadius:"999px",marginBottom:"16px",boxShadow:"0 0 22px rgba(212,175,55,0.10)",background:"radial-gradient(circle, rgba(212,175,55,0.08) 0%, rgba(212,175,55,0.02) 60%, rgba(0,0,0,0) 100%)"}}>
                    <div style={{fontSize:"30px",color:"#fbbf24",lineHeight:1}}>✦</div>
                  </div>
                  <div style={{display:"flex",justifyContent:"center",gap:"8px",flexWrap:"wrap",marginBottom:"18px"}}>
                    <span style={s.tag(CAT_COLORS[activeTask.category]||"#555")}>{activeTask.category.toUpperCase()}</span>
                    <span style={s.tag(DIFF_COLORS[activeTask.difficulty])}>{activeTask.difficulty.toUpperCase()}</span>
                    <span style={s.tag(TIER_COLORS[activeTask.tier]||"#555")}>{activeTask.tier.toUpperCase()}</span>
                    <span style={s.tag("#d4af37")}>ACTIVE TRIAL</span>
                    <span style={s.tag("#e5e7eb")}>{taskXp(activeTask)} XP</span>
                    {modifierXpBonus(activeTask) > 0 && <span style={s.tag("#fb923c")}>+{modifierXpBonus(activeTask)} MOD BONUS</span>}
                  </div>
                  <div style={{...s.displayBigTitle,marginBottom:"12px",textWrap:"balance"}}>{activeTask.title}</div>
                  <div style={{fontSize:"12px",letterSpacing:"2px",color:"#8c7a44",marginBottom:"18px",textTransform:"uppercase"}}>{activeTrialPrompt(activeTask)}</div>
                  <div style={{margin:"0 auto 18px",maxWidth:"680px",border:"1px solid rgba(212,175,55,0.18)",background:"linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.00) 100%)",padding:"18px 18px 16px"}}>
                    <div style={{fontSize:"10px",letterSpacing:"4px",color:"#a3a3a3",marginBottom:"10px",textTransform:"uppercase"}}>Objective</div>
                    <div style={{fontSize:"16px",color:"#e5e7eb",lineHeight:"1.75"}}>{activeTask.objective}</div>
                  </div>
                  {(activeTask.modifier || activeTask.trialModifier) && (
                    <div style={{margin:"18px auto 0",maxWidth:"520px",padding:"12px 16px",border:"1px solid #4a2d0c",background:"linear-gradient(180deg, rgba(65,38,9,0.45) 0%, rgba(24,16,8,0.78) 100%)",boxShadow:"0 0 14px rgba(251,146,60,0.06)"}}>
                      <div style={{fontSize:"10px",letterSpacing:"4px",color:"#8b5a22",marginBottom:"6px",textTransform:"uppercase"}}>Restriction active</div>
                      <div style={{fontSize:"13px",color:"#fdba74"}}>{activeTask.modifier || activeTask.trialModifier}</div>
                    </div>
                  )}
                  {activeTask.modifier && (
                    <div style={{display:"flex",justifyContent:"center",gap:"8px",marginTop:"14px",flexWrap:"wrap"}}>
                      <button style={s.btn(false,"#111827", mettleSeals >= REMOVE_MODIFIER_COST ? "#93c5fd" : "#4b5563")} onClick={removeActiveModifier} disabled={mettleSeals < REMOVE_MODIFIER_COST}>
                        REMOVE MODIFIER ({REMOVE_MODIFIER_COST} SEALS)
                      </button>
                    </div>
                  )}
                  <div style={{width:"180px",height:"1px",margin:"24px auto 0",background:"linear-gradient(90deg, rgba(212,175,55,0) 0%, rgba(212,175,55,0.9) 50%, rgba(212,175,55,0) 100%)"}} />
                  <div style={{display:"flex",justifyContent:"center",gap:"12px",flexWrap:"wrap",marginTop:"28px"}}>
                    <button style={{...s.btn(false,"#14380f","#4ade80"),padding:"14px 36px",fontSize:"14px",letterSpacing:"3px"}} onClick={()=>resolveActiveTask("complete")}>
                      ✓ CLEAR TRIAL (+{taskXp(activeTask)} XP)
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{...s.activeCard, borderColor: activeTask.reckoning ? "#6b21a8" : "#555"}}>
                <div style={s.secHead}>ACTIVE TASK</div>
                <div style={{fontSize:"11px",marginBottom:"8px"}}>
                  <span style={s.tag(CAT_COLORS[activeTask.category]||"#555")}>{activeTask.category.toUpperCase()}</span>
                  <span style={s.tag(DIFF_COLORS[activeTask.difficulty])}>{activeTask.difficulty.toUpperCase()}</span>
                  <span style={s.tag(TIER_COLORS[activeTask.tier]||"#555")}>{activeTask.tier.toUpperCase()}</span>
                  <span style={s.tag("#555")}>{taskXp(activeTask)} XP</span>
                  {modifierXpBonus(activeTask) > 0 && <span style={s.tag("#fb923c")}>+{modifierXpBonus(activeTask)} MOD BONUS</span>}
                </div>
                <div style={{...s.displayCardTitle,marginBottom:"14px"}}>{activeTask.title}</div>
                <div style={{...s.objectiveBox,margin:"0 0 16px",maxWidth:"760px",padding:"16px 18px 14px"}}>
                  <div style={{fontSize:"10px",letterSpacing:"4px",color:"#7a7a72",marginBottom:"10px",textTransform:"uppercase"}}>Assigned Objective</div>
                  <div style={{fontSize:"14px",color:"#d4d4d4",lineHeight:"1.75"}}>{activeTask.objective}</div>
                </div>
                {activeTask.modifier && (
                  <div style={{display:"flex",gap:"8px",marginBottom:"12px",flexWrap:"wrap"}}>
                    <button style={s.btn(false,"#111827", mettleSeals >= REMOVE_MODIFIER_COST ? "#93c5fd" : "#4b5563")} onClick={removeActiveModifier} disabled={mettleSeals < REMOVE_MODIFIER_COST}>
                      REMOVE MODIFIER ({REMOVE_MODIFIER_COST} SEALS)
                    </button>
                  </div>
                )}
                {(activeTask.modifier || activeTask.trialModifier) && (
                  <div style={{display:"inline-flex",alignItems:"center",gap:"8px",fontSize:"11px",color:"#fb923c",padding:"7px 10px",background:"#1a1008",border:"1px solid #3d2a08",marginBottom:"18px",animation:"modifierFlash 3s infinite"}}>
                    <span style={{letterSpacing:"2px",textTransform:"uppercase",color:"#c27a1d"}}>Modifier</span>
                    <span>{activeTask.modifier || activeTask.trialModifier}</span>
                  </div>
                )}
                <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
                  <button style={s.btn(false,"#14380f","#4ade80")} onClick={()=>resolveActiveTask("complete")}>
                    ✓ COMPLETE (+{taskXp(activeTask)} XP)
                  </button>
                  <button style={s.btn(false,"#1a1a0a","#fbbf24")} onClick={()=>resolveActiveTask("defer")}
                    disabled={deferredTasks.length>=3}>
                    ⏸ DEFER ({deferredTasks.length}/3{deferredTasks.length>=3?" — FULL":""})
                    {!activeTask.trial && categoryDeferCounts[activeTask.category] >= 2 && " ⚠ RECKONING"}
                  </button>
                </div>
              </div>
            )
          )}

          {/* ═══ DRAW / DRAFT ═══ */}
          {!activeTask && !trialPhase && !activeFork && !activeLandmark && (
            <div>
              {currentDraft.length===0 ? (
                <div className="mettle-mobile-center" style={s.drawShell}>
                  {drawBlocked ? (
                    <div style={{textAlign:"center",maxWidth:"560px"}}>
                      <div style={{fontSize:"10px",color:"#f87171",letterSpacing:"3px",marginBottom:"16px"}}>
                        BLOCKED — {blockReason}
                      </div>
                      <div style={{fontSize:"12px",color:"#6c6c6c",lineHeight:"1.8"}}>
                        Clear the outstanding tasks above to unlock drawing
                      </div>
                    </div>
                  ) : (
                    <div style={{textAlign:"center",maxWidth:"620px"}}>
                      <div style={{fontSize:"10px",color:pendingTrial?"#d4af37":draftStatus==="cursed"?"#fbbf24":draftStatus==="favored"?"#c4b5fd":draftStatus==="hot_streak"?"#fb923c":"#444",letterSpacing:"3px",marginBottom:"20px"}}>
                        {pendingTrial ? "⚔ TRIAL OF METTLE AWAITS — YOU CANNOT DRAFT AROUND IT"
                          : draftStatus==="favored" ? `FAVORED · ${draftSizeFromStatus(draftStatus)} OPTIONS · ${favoredDrawsRemaining} DRAWS REMAINING`
                          : draftStatus==="hot_streak" ? `🔥 HOT STREAK (${streak}) · ${draftSizeFromStatus(draftStatus)} OPTIONS`
                          : `${draftStatus.toUpperCase()} · ${draftSizeFromStatus(draftStatus)} OPTIONS · UNCHOSEN TASKS RETURN LATER`}
                      </div>
                      <div className="mettle-mobile-center-title" style={{...s.displayCardTitle,fontSize:"30px",marginBottom:"12px"}}>{pendingTrial ? "Trial Ready" : "Draw Tasks"}</div>
                      <div style={{...s.sectionLead,margin:"0 auto 24px"}}>
                        {pendingTrial
                          ? "A trial has taken priority over normal drafts. Clear it before drawing new tasks."
                          : "Each draft is a fresh read of your account. Choose one task and the others return to the pool."}
                      </div>
                      <button style={{...s.btn(true),padding:"14px 48px",fontSize:"14px",letterSpacing:"4px",
                        fontFamily:displayFont,
                        ...(pendingTrial ? {background:"#d4af37",color:"#000",borderColor:"#d4af37"} : {})
                      }} onClick={drawTasks}>
                        {pendingTrial ? "⚔ START TRIAL" : "DRAW TASKS"}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{...s.sectionFrame,padding:"18px"}}>
                  <div style={{...s.secHead,marginBottom:"12px"}}>
                    {draftMode === "final_trial" ? "THE FINAL TRIAL — FIVE TASKS DRAWN, CHOOSE ONE" : "CHOOSE ONE — THE REST RETURN TO THE POOL"}
                  </div>
                  {draftMode === "final_trial" ? (
                    <div style={{fontSize:"11px",color:"#8c7a44",marginBottom:"16px",lineHeight:"1.6"}}>
                      Your path has been revealed. The final pool is fixed at five choices and cannot be rerolled.
                    </div>
                  ) : (
                    <div className="mettle-draft-actions" style={{display:"flex",gap:"8px",marginBottom:"16px",flexWrap:"wrap"}}>
                      <button style={s.btn(false,"#111827", mettleSeals >= REROLL_COST ? "#93c5fd" : "#4b5563")} onClick={rerollCurrentDraft} disabled={mettleSeals < REROLL_COST}>
                        REROLL DRAFT ({REROLL_COST} SEALS)
                      </button>
                      <button style={s.btn(false,"#1f2937", mettleSeals >= EXTRA_CHOICE_COST && currentDraft.length < 4 ? "#c4b5fd" : "#4b5563")} onClick={buyExtraDraftChoice} disabled={mettleSeals < EXTRA_CHOICE_COST || currentDraft.length >= 4}>
                        +1 CHOICE ({EXTRA_CHOICE_COST} SEALS)
                      </button>
                    </div>
                  )}
                  <div style={s.draftGrid(currentDraft.length)}>
                    {currentDraft.map((w,i)=>(
                      <div key={i} style={{...s.draftCard, borderColor: w.modifier ? "#3d2a08" : "#2a2a2a"}}
                        onMouseEnter={e=>e.currentTarget.style.borderColor=w.modifier?"#d4af37":"#666"}
                        onMouseLeave={e=>e.currentTarget.style.borderColor=w.modifier?"#3d2a08":"#2a2a2a"}
                        onClick={()=>chooseTask(w)}>
                        <div style={{fontSize:"10px",marginBottom:"12px"}}>
                          <span style={s.tag(CAT_COLORS[w.category]||"#555")}>{w.category.toUpperCase()}</span>
                          <span style={s.tag(TIER_COLORS[w.tier]||"#555")}>{w.tier.toUpperCase()}</span>
                          {draftMode === "final_trial" && <span style={s.tag("#d4af37")}>FINAL TRIAL</span>}
                          {w.modifier && <span style={s.tag("#fb923c")}>⚡ MODIFIED</span>}
                        </div>
                        <div>
                          <div className="mettle-mobile-card-title" style={{...s.displayCardTitle,fontSize:"18px",marginBottom:"10px"}}>{w.title}</div>
                          <div style={{fontSize:"12px",color:"#8b8b8b",marginBottom:w.modifier?"8px":"16px",lineHeight:"1.7"}}>{w.objective}</div>
                          {w.modifier && (
                            <div style={{fontSize:"11px",color:"#fb923c",marginBottom:"12px",padding:"7px 9px",background:"#1a1008",border:"1px solid #3d2a08"}}>
                              ⚡ {w.modifier}
                            </div>
                          )}
                        </div>
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:"11px",paddingTop:"12px",borderTop:"1px solid #171717"}}>
                          <span style={{color:DIFF_COLORS[w.difficulty],letterSpacing:"1px",textTransform:"uppercase"}}>{w.difficulty}</span>
                          <span style={{color:"#6d6d6d"}}>{taskXp(w)} XP</span>
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
          <div style={{...s.sectionFrame,padding:"18px 18px 16px"}}>
            <div style={s.secHead}>ACCOUNT SUMMARY</div>
            <div style={{...s.displayCardTitle,fontSize:"26px",marginBottom:"8px"}}>Average {avg.toFixed(1)}</div>
            <div style={s.sectionLead}>The stats page reads like an audit sheet: systems, path, pressure, then the raw skill and boss ledgers underneath.</div>
          </div>
          <div style={{...s.dataPanel,borderColor:"#1f2937",background:"#0d1117"}}>
            <div style={{fontSize:"11px",color:"#93c5fd",letterSpacing:"2px",marginBottom:"8px"}}>METTLE SYSTEMS</div>
            <div style={{fontSize:"12px",color:"#9ca3af",marginBottom:"8px"}}>Seals let you remove modifiers, reroll drafts, buy an extra choice, or clear a deferred task instantly.</div>
            <div style={{fontSize:"12px",color:"#d1d5db",marginBottom:"8px"}}>Current: {mettleSeals} seals · streak {streak}{favoredDrawsRemaining > 0 ? ` · ${favoredDrawsRemaining} favored draws` : ""}</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>
              {METTLE_UNLOCKS.map(u => (
                <span key={u.level} style={s.tag(mettleLevel >= u.level ? "#4ade80" : "#555")}>
                  LVL {u.level} {u.unlock.toUpperCase()}
                </span>
              ))}
            </div>
          </div>

          <div style={{...s.dataPanel,borderColor:"#3b2f10",background:"#0f0d08"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"12px",flexWrap:"wrap"}}>
              <div>
                <div style={{fontSize:"11px",color:"#d4af37",letterSpacing:"2px",marginBottom:"8px"}}>ACCOUNT SYNC</div>
                <div style={{fontSize:"12px",color:"#d1d5db",marginBottom:"6px"}}>
                  {questSummary.hasSyncData || diarySummary.hasSyncData
                    ? `${questSummary.completedCount} quests complete · ${questSummary.startedCount} quest starts${questSummary.questPoints !== null ? ` · ${questSummary.questPoints} quest points` : ""}${diarySummary.hasSyncData ? ` · ${diarySummary.completedTaskCount} diary tasks` : ""}`
                    : "No account sync imported yet."}
                </div>
                <div style={{fontSize:"11px",color:"#78716c",maxWidth:"560px",lineHeight:"1.7"}}>
                  {questSummary.hasSyncData || diarySummary.hasSyncData
                    ? `Source: ${questSummary.sourceLabel}${questState.syncSourceRsn ? ` · ${questState.syncSourceRsn}` : ""} · ${questSummary.lastUpdatedLabel}${questSummary.questCapeDetected ? " · Quest Cape detected" : ""}${diarySummary.hasSyncData ? ` · ${diarySummary.completedTierCount} diary tiers complete` : ""}`
                    : "Import a Mettle account sync file to load plugin data, then refresh boss KC automatically through Wise Old Man using the same RSN."}
                </div>
              </div>
              <button style={s.btn(false,"#2b2110","#f0e0ad")} onClick={openQuestSyncPicker}>
                IMPORT ACCOUNT SYNC
              </button>
            </div>
          </div>

          {/* FORK DECISIONS */}
          {Object.keys(completedForks).length > 0 && (
            <div style={{...s.dataPanel,borderColor:"#3d1515",background:"#0d0808"}}>
              <div style={{fontSize:"11px",color:"#dc2626",letterSpacing:"2px",marginBottom:"8px"}}>FORK DECISIONS</div>
              {Object.entries(completedForks).map(([id, fork]) => {
                const def = FORK_TASKS.find(f => f.id === id);
                return (
                  <div key={id} style={{display:"flex",justifyContent:"space-between",padding:"5px 8px",background:"#111",fontSize:"11px",marginBottom:"3px"}}>
                    <span style={{color:"#888"}}>{def?.title || id}</span>
                    <span>
                      {fork.autoResolvedReason
                        ? <span style={{color:"#4ade80"}}>{fork.autoResolvedReason}</span>
                        : <><span style={{color:"#4ade80"}}>{fork.chosen}</span> <span style={{color:"#444"}}>/ rejected</span> <span style={{color:"#f87171",textDecoration:"line-through"}}>{fork.rejected}</span></>}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* LANDMARK TRACKER */}
          {completedLandmarks.length > 0 && (
            <div style={{...s.dataPanel,borderColor:"#1e3a5f",background:"#0d1117"}}>
              <div style={{fontSize:"11px",color:"#3b82f6",letterSpacing:"2px",marginBottom:"8px"}}>LANDMARKS ACHIEVED</div>
              {completedLandmarks.map(id => {
                const def = LANDMARK_TASKS.find(l => l.id === id);
                return (
                  <div key={id} style={{padding:"5px 8px",background:"#111",fontSize:"11px",marginBottom:"3px",color:"#93c5fd"}}>
                    ★ {def?.title || id}
                  </div>
                );
              })}
            </div>
          )}

          {showQuestCapePrompt && !activeTask && !trialPhase && currentDraft.length === 0 && !activeFork && !activeLandmark && (
            <div style={{...s.dataPanel,borderColor:"#1e3a5f",background:"#0d1117"}}>
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
            <div style={{...s.dataPanel,borderColor:"#6b21a8",background:"#0f0a14"}}>
              <div style={{fontSize:"11px",color:"#d8b4fe",letterSpacing:"2px",marginBottom:"8px"}}>FINAL TRIAL PATH</div>
              <div style={{fontSize:"14px",color:"#fff",fontWeight:"700",marginBottom:"4px"}}>The {assignedPath}</div>
              <div style={{fontSize:"11px",color:"#777"}}>
                {assignedPath === "Warrior" && "PvM tasks dominated the run. Your finale pool draws from elite combat challenges."}
                {assignedPath === "Scholar" && "Quest and Skill Gap tasks dominated the run. Your finale pool draws from mastery and knowledge."}
                {assignedPath === "Survivor" && "Endurance and Exploration tasks dominated the run. Your finale pool draws from sustained pressure."}
                {assignedPath === "Balanced" && "No dominant category — even spread. Your finale draws from all paths."}
              </div>
            </div>
          )}

          <div style={{...s.sectionFrame,padding:"16px"}}>
          <div style={s.secHead}>SKILL LEDGER</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(160px, 1fr))",gap:"6px",marginBottom:"8px"}}>
            {[...SKILLS].sort((a,b)=>skillLevels[a]-skillLevels[b]).map(skill=>{
              const level=skillLevels[skill],gap=avg-level;
              const color=gap>15?"#f87171":gap>5?"#fbbf24":"#4ade80";
              return (
                <div key={skill} style={s.statTile}>
                  <span style={{color:"#666",textTransform:"capitalize"}}>{skill}</span>
                  <span style={{color}}>{level}{gap>0?<span style={{fontSize:"10px",color:"#444"}}> ({gap.toFixed(0)}↓)</span>:null}</span>
                </div>
              );
            })}
          </div>
          </div>

          {/* RECKONING TRACKER */}
          {Object.keys(categoryDeferCounts).length > 0 && (
            <div style={{marginBottom:"16px"}}>
              <div style={{...s.sectionFrame,padding:"16px"}}>
              <div style={s.secHead}>RECKONING TRACKER</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))",gap:"6px"}}>
                {RECKONING_CATEGORIES.map(cat => {
                  const count = categoryDeferCounts[cat] || 0;
                  const total = reckoningTotals[cat] || 0;
                  if (count === 0 && total === 0) return null;
                  const color = count >= 3 ? "#a855f7" : count >= 2 ? "#fbbf24" : "#555";
                  return (
                    <div key={cat} style={{display:"flex",justifyContent:"space-between",padding:"7px 10px",background:"#101010",fontSize:"11px",border:"1px solid #151515"}}>
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
            </div>
          )}

          <div style={{...s.sectionFrame,padding:"16px"}}>
          <div style={s.secHead}>BOSS LEDGER — {KEY_BOSSES.length} BOSSES</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(210px, 1fr))",gap:"6px"}}>
            {KEY_BOSSES.map(boss=>(
              <div key={boss} style={{display:"flex",justifyContent:"space-between",padding:"7px 10px",background:"#101010",fontSize:"12px",border:"1px solid #151515"}}>
                <span style={{color:"#666",fontSize:"10px"}}>{boss.replace(/_/g," ")}</span>
                <span style={{color:(bossKC[boss]??0)===0?"#f87171":"#4ade80"}}>{bossKC[boss]??0}</span>
              </div>
            ))}
          </div>
          </div>
        </div>
      )}

      {/* ══ HISTORY ══ */}
      {statsLoaded && activeView==="history" && (
        <div>
          <div style={{...s.sectionFrame,padding:"18px 18px 12px"}}>
            <div style={s.secHead}>ARCHIVE</div>
            <div style={{...s.displayCardTitle,fontSize:"24px",marginBottom:"8px"}}>{history.length} Tasks Resolved</div>
            {history.length===0 && <div style={{color:"#666",fontSize:"13px"}}>No tasks resolved yet.</div>}
          </div>
          {history.map((c,i)=>{
            const rc = c.result==="complete"||c.result==="debt_cleared"||c.result==="debt_cleared_with_seals"||c.result==="reckoning_cleared"||c.result==="landmark"?"#4ade80"
              : c.result==="defer"||c.result==="reckoning_failed"?"#fbbf24":"#555";
            const isExpanded = expandedHistoryIdx === i;
            const ts = c.timestamp ? new Date(c.timestamp) : null;
            return (
              <div key={i} style={{marginBottom:"4px",cursor:"pointer"}} onClick={()=>setExpandedHistoryIdx(isExpanded?null:i)}>
                <div style={{...s.historyRow,display:"flex",justifyContent:"space-between",alignItems:"center",borderLeft:`3px solid ${rc}`,borderBottom:isExpanded?"none":"1px solid #1a1a1a"}}>
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
                      {c.sealsSpent>0&&<div style={{color:"#93c5fd"}}>-{c.sealsSpent} seals</div>}
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
                      <span>XP: {c.xp} base{c.xpGained > 0 ? ` · +${c.xpGained} earned` : c.result === "defer" ? " · 0 earned (deferred)" : " · 0 earned"}{c.sealsGained ? ` · +${c.sealsGained} seals` : ""}{c.sealsSpent ? ` · -${c.sealsSpent} seals spent` : ""}{typeof c.streakAfter === "number" ? ` · streak ${c.streakAfter}` : ""}</span>
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
          <span>TASKS: {completedIds.length}/{taskPoolCount}</span>
          <span>FORKS: {Object.keys(completedForks).length}/{FORK_TASKS.length}</span>
          <span>LANDMARKS: {completedLandmarks.length}/{LANDMARK_TASKS.length}</span>
          <span>XP: {mettleXP.toLocaleString()} / {MAX_METTLE_XP.toLocaleString()}</span>
        </div>
      )}
      {statsLoaded && merchantReady ? (
        <MerchantBoard isOpen={merchantOpen} onClose={() => setMerchantOpen(false)} />
      ) : null}
      </div>
    </div>
  );
}
