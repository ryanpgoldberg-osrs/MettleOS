import { createEmptyDiaryState, normalizeDiaryState } from "./accountSync.js";
import { createEmptyQuestState, normalizeQuestState } from "./questSync.js";

export const SAVE_KEY = "mettle_run_v8";
export const SAVE_VERSION = 4;
export const EXPORT_FORMAT_VERSION = 1;

function toInternalSaveShape(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  return {
    ...parsed,
    history: parsed.history ?? parsed.taskHistory ?? [],
    completedIds: parsed.completedIds ?? parsed.completedTaskIds ?? [],
    draftHistory: parsed.draftHistory ?? parsed.taskDraftHistory ?? [],
    debtWrits: parsed.debtWrits ?? parsed.deferredTasks ?? [],
    reckoningWrits: parsed.reckoningWrits ?? parsed.reckoningTasks ?? [],
    activeWrit: parsed.activeWrit ?? parsed.activeTask ?? null,
    pendingTrialData: parsed.pendingTrialData ?? parsed.pendingTrialTask ?? null,
    questState: normalizeQuestState(parsed.questState ?? parsed.questLedger ?? createEmptyQuestState()),
    diaryState: normalizeDiaryState(parsed.diaryState ?? parsed.achievementDiaryState ?? createEmptyDiaryState()),
  };
}

function toStoredSaveShape(parsed) {
  const internal = toInternalSaveShape(parsed);
  if (!internal) return null;

  const {
    history,
    completedIds,
    draftHistory,
    debtWrits,
    reckoningWrits,
    activeWrit,
    pendingTrialData,
    ...rest
  } = internal;

  return {
    ...rest,
    taskHistory: history ?? [],
    completedTaskIds: completedIds ?? [],
    taskDraftHistory: draftHistory ?? [],
    deferredTasks: debtWrits ?? [],
    reckoningTasks: reckoningWrits ?? [],
    activeTask: activeWrit ?? null,
    pendingTrialTask: pendingTrialData ?? null,
  };
}

function migrateLegacySave(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const normalized = toInternalSaveShape(parsed);
  if ("saveVersion" in normalized) {
    return {
      ...normalized,
      saveVersion: typeof normalized.saveVersion === "number" ? normalized.saveVersion : SAVE_VERSION,
      updatedAt: typeof normalized.updatedAt === "number" ? normalized.updatedAt : Date.now(),
    };
  }
  return {
    ...normalized,
    saveVersion: 1,
    updatedAt: Date.now(),
  };
}

function migrateSave(parsed) {
  const migrated = migrateLegacySave(parsed);
  if (!migrated) return null;

  if (migrated.saveVersion < 2) {
    return {
      ...migrated,
      saveVersion: SAVE_VERSION,
      updatedAt: migrated.updatedAt || Date.now(),
      currentDraft: Array.isArray(migrated.currentDraft) ? migrated.currentDraft : [],
      draftMode: typeof migrated.draftMode === "string" ? migrated.draftMode : "normal",
      activeWrit: migrated.activeWrit ?? null,
      activeView: typeof migrated.activeView === "string" ? migrated.activeView : "board",
      trialPhase: typeof migrated.trialPhase === "string" ? migrated.trialPhase : null,
      pendingTrialData: migrated.pendingTrialData ?? null,
      activeFork: migrated.activeFork ?? null,
      forkPhase: typeof migrated.forkPhase === "string" ? migrated.forkPhase : null,
      activeLandmark: migrated.activeLandmark ?? null,
      landmarkPhase: typeof migrated.landmarkPhase === "string" ? migrated.landmarkPhase : null,
      questState: normalizeQuestState(migrated.questState),
      diaryState: normalizeDiaryState(migrated.diaryState),
    };
  }

  if (migrated.saveVersion < 3) {
    return {
      ...migrated,
      saveVersion: SAVE_VERSION,
      updatedAt: migrated.updatedAt || Date.now(),
      questState: normalizeQuestState(migrated.questState),
      diaryState: normalizeDiaryState(migrated.diaryState),
    };
  }

  if (migrated.saveVersion < 4) {
    return {
      ...migrated,
      saveVersion: SAVE_VERSION,
      updatedAt: migrated.updatedAt || Date.now(),
      questState: normalizeQuestState(migrated.questState),
      diaryState: normalizeDiaryState(migrated.diaryState),
    };
  }

  return {
    ...migrated,
    questState: normalizeQuestState(migrated.questState),
    diaryState: normalizeDiaryState(migrated.diaryState),
  };
}

function isLikelyMettleSave(parsed) {
  const normalized = toInternalSaveShape(parsed);
  return Boolean(
    normalized &&
      "skillLevels" in normalized &&
      "bossKC" in normalized
  );
}

function isWrappedExport(parsed) {
  return Boolean(
    parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      parsed.format === "mettle-save" &&
      ((parsed.save && typeof parsed.save === "object") || (parsed.run && typeof parsed.run === "object"))
  );
}

function unwrapImportedSave(parsed) {
  if (isWrappedExport(parsed)) {
    return parsed.save ?? parsed.run;
  }
  return parsed;
}

export function loadSave() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return migrateSave(toInternalSaveShape(JSON.parse(raw)));
  } catch {
    return null;
  }
}

export function writeSave(data) {
  if (typeof window === "undefined") return;
  try {
    const stored = toStoredSaveShape(data);
    if (!stored) return;
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        ...stored,
        saveVersion: SAVE_VERSION,
        updatedAt: Date.now(),
      })
    );
  } catch {}
}

export function clearSave() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {}
}

export function parseImportedSave(rawText) {
  const parsed = toInternalSaveShape(unwrapImportedSave(JSON.parse(rawText)));
  if (!isLikelyMettleSave(parsed)) {
    throw new Error("That file does not look like a Mettle save.");
  }
  const migrated = migrateSave(parsed);
  if (!migrated) {
    throw new Error("That save file could not be read.");
  }
  return migrated;
}

export function importSaveText(rawText) {
  if (typeof window === "undefined") {
    throw new Error("Save import is only available in the browser.");
  }
  const migrated = parseImportedSave(rawText);
  writeSave(migrated);
  return migrated;
}

export function exportSaveData(save) {
  if (!isLikelyMettleSave(save)) {
    throw new Error("No valid Mettle save is available to export.");
  }

  const storedSave = toStoredSaveShape(save);
  if (!storedSave) {
    throw new Error("No valid Mettle save is available to export.");
  }

  const {
    saveVersion,
    updatedAt,
    rsn,
    skillLevels,
    bossKC,
    statsLoaded,
    mettleXP,
    mettleSeals,
    streak,
    assignedPath,
    pathRevealed,
    completedTaskIds,
    completedForks,
    completedLandmarks,
    taskHistory,
    deferredTasks,
    mustClearAll,
    taskDraftHistory,
    currentDraft,
    draftMode,
    activeTask,
    activeView,
    trialPhase,
    pendingTrialTask,
    categoryDeferCounts,
    reckoningTasks,
    reckoningTotals,
    favoredDrawsRemaining,
    activeFork,
    forkPhase,
    activeLandmark,
    landmarkPhase,
    questState,
    diaryState,
  } = storedSave;

  return {
    format: "mettle-save",
    exportVersion: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    app: {
      saveKey: SAVE_KEY,
      saveVersion: typeof saveVersion === "number" ? saveVersion : SAVE_VERSION,
      updatedAt: typeof updatedAt === "number" ? new Date(updatedAt).toISOString() : null,
    },
    account: {
      rsn: rsn || "",
      statsLoaded: Boolean(statsLoaded),
      skillLevels: skillLevels || {},
      bossKC: bossKC || {},
    },
    progression: {
      mettleXP: mettleXP || 0,
      mettleSeals: mettleSeals || 0,
      streak: streak || 0,
      assignedPath: assignedPath || null,
      pathRevealed: Boolean(pathRevealed),
      favoredDrawsRemaining: favoredDrawsRemaining || 0,
    },
    state: {
      activeView: activeView || "board",
      draftMode: draftMode || "normal",
      mustClearAll: Boolean(mustClearAll),
      trialPhase: trialPhase || null,
      forkPhase: forkPhase || null,
      landmarkPhase: landmarkPhase || null,
    },
    content: {
      completedTaskIds: completedTaskIds || [],
      completedForks: completedForks || {},
      completedLandmarks: completedLandmarks || [],
      taskHistory: taskHistory || [],
      deferredTasks: deferredTasks || [],
      reckoningTasks: reckoningTasks || [],
      reckoningTotals: reckoningTotals || {},
      categoryDeferCounts: categoryDeferCounts || {},
      taskDraftHistory: taskDraftHistory || [],
      currentDraft: currentDraft || [],
      activeTask: activeTask || null,
      pendingTrialTask: pendingTrialTask || null,
      activeFork: activeFork || null,
      activeLandmark: activeLandmark || null,
      questState: questState || createEmptyQuestState(),
      diaryState: diaryState || createEmptyDiaryState(),
    },
    save: storedSave,
  };
}
