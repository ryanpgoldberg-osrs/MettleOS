export const SAVE_KEY = "mettle_run_v8";
export const SAVE_VERSION = 2;

function migrateLegacySave(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  if ("saveVersion" in parsed) {
    return {
      ...parsed,
      saveVersion: typeof parsed.saveVersion === "number" ? parsed.saveVersion : SAVE_VERSION,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
    };
  }
  return {
    ...parsed,
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
    };
  }

  return migrated;
}

export function loadSave() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return migrateSave(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeSave(data) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        ...data,
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
