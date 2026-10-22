import { describe, expect, it, vi } from "vitest";
import { DEFAULT_KC, DEFAULT_SKILLS } from "@/components/data/constants.js";
import { TASK_POOL } from "@/components/data/taskPool.js";
import { getPendingLandmark } from "@/components/data/landmarkDefs.js";
import {
  computeDraftWeight,
  draftSizeFromStatus,
  generateDraft,
  getDebtStatus,
  getDraftSelectionKey,
  getPendingTrial,
  levelProgressPct,
  meetsRequirements,
  xpForLevel,
  xpToLevel,
} from "@/components/systems/mettleSystems.js";

describe("mettleSystems", () => {
  it("maps XP and progress through the level curve consistently", () => {
    expect(xpToLevel(0)).toBe(1);
    expect(xpToLevel(2_500)).toBe(20);
    expect(xpForLevel(40)).toBe(9_000);
    expect(levelProgressPct(0)).toBe(0);
    expect(levelProgressPct(85_000)).toBe(100);
  });

  it("computes draft state and sizes from debt and streak rules", () => {
    expect(getDebtStatus([], true, 20, 0)).toBe("blocked");
    expect(getDebtStatus([{ id: "debt_1" }], false, 20, 0)).toBe("cursed");
    expect(getDebtStatus([], false, 2, 3)).toBe("favored");
    expect(getDebtStatus([], false, 15, 0)).toBe("hot_streak");
    expect(draftSizeFromStatus("cursed")).toBe(2);
    expect(draftSizeFromStatus("favored")).toBe(4);
    expect(draftSizeFromStatus("normal")).toBe(3);
  });

  it("returns the next uncompleted trial for the current mettle level", () => {
    expect(getPendingTrial(35, ["trial_10", "trial_20"])?.id).toBe("trial_30");
    expect(getPendingTrial(9, [])).toBeNull();
  });

  it("detects landmark and completion-gated task rules", () => {
    const questCapeLandmark = getPendingLandmark(
      DEFAULT_SKILLS,
      DEFAULT_KC,
      [],
      { questCapeDetected: true }
    );

    expect(questCapeLandmark?.id).toBe("landmark_quest_cape");
    expect(
      meetsRequirements(
        { category: "Quest", questCompleteAnyOf: ["Dragon Slayer I"] },
        DEFAULT_SKILLS,
        DEFAULT_KC,
        { completedQuestIds: ["dragon_slayer_i"] }
      )
    ).toBe(false);
  });

  it("suppresses already-complete quest content when generating drafts", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const draft = generateDraft(
      { ...DEFAULT_SKILLS, attack: 60, strength: 60, defence: 60 },
      DEFAULT_KC,
      [],
      [],
      [],
      40,
      3,
      0,
      0,
      { questCapeDetected: true },
      null
    );

    expect(draft).toHaveLength(3);
    expect(draft.every((task) => task.category !== "Quest")).toBe(true);
  });

  it("boosts personalized quest, diary, and raid tasks when synced state shows the gap", () => {
    const questPoolTask = TASK_POOL.find((task) => task.id === "s_q_10");
    const diaryTask = TASK_POOL.find((task) => task.id === "g_ex_10");
    const raidTask = TASK_POOL.find((task) => task.id === "b_pvm_14");

    expect(questPoolTask).toBeTruthy();
    expect(diaryTask).toBeTruthy();
    expect(raidTask).toBeTruthy();

    const questWeightWithoutSync = computeDraftWeight(
      questPoolTask,
      DEFAULT_SKILLS,
      DEFAULT_KC,
      [],
      [],
      40,
      null,
      null
    );
    const questWeightWithSync = computeDraftWeight(
      questPoolTask,
      DEFAULT_SKILLS,
      DEFAULT_KC,
      [],
      [],
      40,
      {
        completedQuestIds: ["the_fremennik_trials"],
        startedQuestIds: ["the_fremennik_isles"],
      },
      null
    );

    const diaryWeightWithoutSync = computeDraftWeight(
      diaryTask,
      DEFAULT_SKILLS,
      DEFAULT_KC,
      [],
      [],
      20,
      null,
      null
    );
    const diaryWeightWithSync = computeDraftWeight(
      diaryTask,
      DEFAULT_SKILLS,
      DEFAULT_KC,
      [],
      [],
      20,
      null,
      {
        updatedAt: Date.now(),
      }
    );

    const zeroRaidWeight = computeDraftWeight(
      raidTask,
      { ...DEFAULT_SKILLS, attack: 80, strength: 80, defence: 80 },
      DEFAULT_KC,
      [],
      [],
      60,
      null,
      null
    );
    const someRaidWeight = computeDraftWeight(
      raidTask,
      { ...DEFAULT_SKILLS, attack: 80, strength: 80, defence: 80 },
      { ...DEFAULT_KC, chambers_of_xeric: 1 },
      [],
      [],
      60,
      null,
      null
    );

    expect(questWeightWithSync).toBeGreaterThan(questWeightWithoutSync);
    expect(diaryWeightWithSync).toBeGreaterThan(diaryWeightWithoutSync);
    expect(zeroRaidWeight).toBeGreaterThan(someRaidWeight);
  });

  it("caps diary draws at one and suppresses duplicate started-quest prompts in the same draft", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const draft = generateDraft(
      { ...DEFAULT_SKILLS, attack: 90, strength: 90, defence: 90 },
      DEFAULT_KC,
      [],
      [],
      [],
      90,
      6,
      0,
      0,
      {
        startedQuestIds: [
          "desert_treasure_ii",
          "song_of_the_elves",
          "dragon_slayer_ii",
          "the_fremennik_exiles",
        ],
      },
      {
        updatedAt: Date.now(),
      }
    );

    const diaryTasks = draft.filter(
      (task) => task.diaryTierAnyOf || typeof task.diaryTierCountTarget === "number"
    );
    const startedQuestTasks = draft.filter(
      (task) => getDraftSelectionKey(task) === "quest-started"
    );

    expect(diaryTasks.length).toBeLessThanOrEqual(1);
    expect(startedQuestTasks.length).toBeLessThanOrEqual(1);
  });
});
