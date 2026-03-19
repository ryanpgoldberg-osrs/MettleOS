import { describe, expect, it, vi } from "vitest";
import { DEFAULT_KC, DEFAULT_SKILLS } from "@/components/data/constants.js";
import { getPendingLandmark } from "@/components/data/landmarkDefs.js";
import {
  draftSizeFromStatus,
  generateDraft,
  getDebtStatus,
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
});
