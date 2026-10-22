import { describe, expect, it } from "vitest";
import { DEFAULT_KC, DEFAULT_SKILLS } from "@/components/data/constants.js";
import {
  buildAccusationCandidate,
  buildForcedJudgmentTask,
  canEvaluateAccusationWindow,
  createAccusationOpportunityCounts,
  getAccusationRefusalPenalty,
  isAccusationBoardCalm,
  recordAccusationOpportunityChoice,
} from "@/components/systems/accusationSystem.js";

describe("accusationSystem", () => {
  it("normalizes and records opportunity counts across pvm, skill, quest, and diary draws", () => {
    const counts = recordAccusationOpportunityChoice(
      createAccusationOpportunityCounts(),
      [
        { category: "PvM Intro" },
        { category: "Skill Gap" },
        { category: "Quest" },
        { category: "Exploration", diaryTierAnyOf: ["ardougne_easy"] },
      ],
      { category: "Exploration" }
    );

    expect(counts).toEqual({
      pvmIgnored: 1,
      skillGapIgnored: 1,
      questIgnored: 1,
      diaryIgnored: 1,
    });
  });

  it("uses calm-board and spacing gates before evaluating accusations", () => {
    expect(
      isAccusationBoardCalm({
        activeTask: null,
        trialPhase: null,
        pendingTrialTask: null,
        pendingTrial: null,
        activeFork: null,
        activeLandmark: null,
        currentDraftLength: 0,
        reckoningTaskCount: 0,
        mustClearAll: false,
        deferredTaskCount: 0,
        gateBlocked: false,
      })
    ).toBe(true);

    expect(
      isAccusationBoardCalm({
        activeTask: null,
        trialPhase: null,
        pendingTrialTask: null,
        pendingTrial: null,
        activeFork: null,
        activeLandmark: null,
        currentDraftLength: 0,
        reckoningTaskCount: 0,
        mustClearAll: false,
        deferredTaskCount: 3,
        gateBlocked: false,
      })
    ).toBe(false);

    expect(
      canEvaluateAccusationWindow({
        statsLoaded: true,
        activeAccusation: null,
        pendingAccusationCandidate: null,
        completedTasksSinceLastAccusation: 5,
        accusationSpacingMin: 5,
      })
    ).toBe(true);

    expect(
      canEvaluateAccusationWindow({
        statsLoaded: true,
        activeAccusation: null,
        pendingAccusationCandidate: null,
        completedTasksSinceLastAccusation: 4,
        accusationSpacingMin: 5,
      })
    ).toBe(false);
  });

  it("builds quest stagnation and diary neglect accusations from ignored synced progress", () => {
    const questCandidate = buildAccusationCandidate({
      mettleLevel: 45,
      skillLevels: DEFAULT_SKILLS,
      bossKC: DEFAULT_KC,
      deferredTasks: [],
      categoryDeferCounts: {},
      reckoningTotals: {},
      accusationMemory: {},
      completedTaskCount: 12,
      historyCount: 12,
      opportunityCounts: {
        ...createAccusationOpportunityCounts(),
        questIgnored: 3,
      },
      questState: {
        startedQuestIds: ["desert_treasure_ii", "dragon_slayer_ii", "song_of_the_elves"],
      },
      diaryState: null,
    });

    const diaryCandidate = buildAccusationCandidate({
      mettleLevel: 45,
      skillLevels: DEFAULT_SKILLS,
      bossKC: DEFAULT_KC,
      deferredTasks: [],
      categoryDeferCounts: {},
      reckoningTotals: {},
      accusationMemory: {},
      completedTaskCount: 12,
      historyCount: 12,
      opportunityCounts: {
        ...createAccusationOpportunityCounts(),
        diaryIgnored: 3,
      },
      questState: null,
      diaryState: {
        updatedAt: Date.now(),
        completedTierIds: [],
      },
    });

    expect(questCandidate?.key).toBe("stagnation:quest_backlog");
    expect(diaryCandidate?.key).toBe("neglect:diaries");
  });

  it("builds wilderness and raid avoidance accusations at the intended thresholds", () => {
    const wildernessCandidate = buildAccusationCandidate({
      mettleLevel: 45,
      skillLevels: { ...DEFAULT_SKILLS, attack: 80, strength: 80, defence: 80 },
      bossKC: DEFAULT_KC,
      deferredTasks: [],
      categoryDeferCounts: {},
      reckoningTotals: {},
      accusationMemory: {},
      completedTaskCount: 12,
      historyCount: 12,
      opportunityCounts: {
        ...createAccusationOpportunityCounts(),
        pvmIgnored: 3,
      },
      questState: null,
      diaryState: null,
    });

    const raidCandidate = buildAccusationCandidate({
      mettleLevel: 65,
      skillLevels: { ...DEFAULT_SKILLS, attack: 82, strength: 82, defence: 82 },
      bossKC: DEFAULT_KC,
      deferredTasks: [],
      categoryDeferCounts: {},
      reckoningTotals: {},
      accusationMemory: {},
      completedTaskCount: 12,
      historyCount: 12,
      opportunityCounts: {
        ...createAccusationOpportunityCounts(),
        pvmIgnored: 3,
      },
      questState: null,
      diaryState: null,
    });

    expect(wildernessCandidate?.key).toBe("avoidance:wilderness");
    expect(raidCandidate?.key).toBe("avoidance:raids");
  });

  it("prioritizes pvm pressure over softer narrative accusations when both are available", () => {
    const candidate = buildAccusationCandidate({
      mettleLevel: 65,
      skillLevels: { ...DEFAULT_SKILLS, attack: 85, strength: 85, defence: 85 },
      bossKC: DEFAULT_KC,
      deferredTasks: [
        { category: "PvM Intro" },
        { category: "PvM Endurance" },
      ],
      categoryDeferCounts: {
        "PvM Intro": 2,
      },
      reckoningTotals: {
        "PvM Endurance": 1,
      },
      accusationMemory: {},
      completedTaskCount: 15,
      historyCount: 15,
      opportunityCounts: {
        ...createAccusationOpportunityCounts(),
        pvmIgnored: 3,
        questIgnored: 3,
      },
      questState: {
        startedQuestIds: ["desert_treasure_ii", "dragon_slayer_ii", "song_of_the_elves"],
      },
      diaryState: null,
    });

    expect(candidate?.key).toBe("cowardice:pvm_pressure");
  });

  it("returns refusal penalties and forced judgment tasks in the expected consequence shape", () => {
    const penalty = getAccusationRefusalPenalty();
    const forcedJudgment = buildForcedJudgmentTask(
      {
        id: "acc_1",
        key: "avoidance:raids",
        title: "The Great Chambers Closed",
        judgmentTask: {
          id: "judgment_avoidance_raids",
          title: "Judgment: Claim A Raid",
          category: "PvM Intro",
          difficulty: "Hard",
          tier: "Bandos",
          xp: 975,
          objective: "Complete any raid once",
        },
      },
      12345
    );

    expect(penalty).toEqual({
      drawPenalty: 2,
      forcedModifierReady: true,
    });
    expect(forcedJudgment).toMatchObject({
      acceptedAt: 12345,
      accusationTask: true,
      accusationResponseType: "judgment",
      accusationSourceId: "acc_1",
      accusationKey: "avoidance:raids",
      accusationTitle: "The Great Chambers Closed",
    });
    expect(forcedJudgment?.modifier).toBeTruthy();
    expect(forcedJudgment?.objective).toContain("MODIFIER:");
  });
});
