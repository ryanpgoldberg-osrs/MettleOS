import { describe, expect, it, vi } from "vitest";
import { DEFAULT_KC, DEFAULT_SKILLS } from "@/components/data/constants.js";
import {
  SAVE_KEY,
  SAVE_VERSION,
  importSaveText,
  loadSave,
  parseImportedSave,
} from "@/components/utils/persistence.js";

describe("persistence", () => {
  it("migrates wrapped legacy saves into the current shape", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_710_000_000_000);

    const migrated = parseImportedSave(
      JSON.stringify({
        format: "mettle-save",
        run: {
          rsn: "Legacy Hero",
          skillLevels: { ...DEFAULT_SKILLS, attack: 55 },
          bossKC: { ...DEFAULT_KC, vorkath: 3 },
          taskHistory: [{ id: "done_1" }],
          completedTaskIds: ["done_1"],
          taskDraftHistory: [["draft_1"]],
          debtWrits: [{ id: "debt_1" }],
          reckoningWrits: [{ id: "reckoning_1" }],
          activeWrit: { id: "active_1" },
          pendingTrialData: { id: "trial_10" },
          questLedger: {
            completedQuestIds: ["Cook's Assistant"],
          },
          achievementDiaryState: {
            completedTierIds: ["Ardougne Easy"],
          },
        },
      })
    );

    expect(migrated.saveVersion).toBe(SAVE_VERSION);
    expect(migrated.updatedAt).toBe(1_710_000_000_000);
    expect(migrated.history).toEqual([{ id: "done_1" }]);
    expect(migrated.completedIds).toEqual(["done_1"]);
    expect(migrated.draftHistory).toEqual([["draft_1"]]);
    expect(migrated.deferredTasks).toEqual([{ id: "debt_1" }]);
    expect(migrated.reckoningTasks).toEqual([{ id: "reckoning_1" }]);
    expect(migrated.activeTask).toEqual({ id: "active_1" });
    expect(migrated.pendingTrialTask).toEqual({ id: "trial_10" });
    expect(migrated.questState.completedQuestIds).toEqual(["cooks_assistant"]);
    expect(migrated.diaryState.completedTierIds).toEqual(["ardougne_easy"]);
    expect(migrated.activeAccusation).toBeNull();
    expect(migrated.accusationHistory).toEqual([]);
  });

  it("imports saves into localStorage and loads them back in the stored shape", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_710_000_000_123);

    importSaveText(
      JSON.stringify({
        skillLevels: { ...DEFAULT_SKILLS, strength: 70 },
        bossKC: { ...DEFAULT_KC, zulrah: 5 },
        history: [{ id: "task_1" }],
        completedIds: ["task_1"],
        draftHistory: [["task_2", "task_3"]],
        deferredTasks: [],
        reckoningTasks: [],
        activeTask: null,
        pendingTrialTask: null,
        saveVersion: SAVE_VERSION,
      })
    );

    const raw = window.localStorage.getItem(SAVE_KEY);
    const stored = raw ? JSON.parse(raw) : null;
    const loaded = loadSave();

    expect(stored?.saveVersion).toBe(SAVE_VERSION);
    expect(stored?.taskHistory).toEqual([{ id: "task_1" }]);
    expect(stored?.completedTaskIds).toEqual(["task_1"]);
    expect(stored?.updatedAt).toBe(1_710_000_000_123);
    expect(loaded?.history).toEqual([{ id: "task_1" }]);
    expect(loaded?.completedIds).toEqual(["task_1"]);
    expect(loaded?.skillLevels.strength).toBe(70);
    expect(loaded?.bossKC.zulrah).toBe(5);
  });

  it("rejects imports that are not recognizable Mettle saves", () => {
    expect(() => parseImportedSave(JSON.stringify({ foo: "bar" }))).toThrow(
      "That file does not look like a Mettle save."
    );
  });
});
