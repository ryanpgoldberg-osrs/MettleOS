import { describe, expect, it } from "vitest";
import { KEY_BOSSES, SKILLS } from "@/components/data/constants.js";
import {
  ACCOUNT_SYNC_FORMAT,
  mergeSkillSources,
  parseAccountSyncPayload,
  parseAccountSyncText,
} from "@/components/utils/accountSync.js";

describe("accountSync", () => {
  it("normalizes plugin payloads into the app sync shape", () => {
    const syncedAt = "2026-03-13T18:30:00.000Z";

    const result = parseAccountSyncPayload({
      format: ACCOUNT_SYNC_FORMAT,
      version: 1,
      source: "plugin-export",
      syncedAt,
      player: {
        rsn: " Test RSN ",
        accountType: "IRONMAN",
      },
      skills: {
        attack: 50,
        strength: 60,
      },
      bosses: {
        vorkath: 8,
      },
      quests: {
        completedQuestIds: ["Cook's Assistant", "Cook's Assistant"],
        startedQuestIds: ["Cook's Assistant", "Desert Treasure II"],
        questPoints: 205,
        questCapeDetected: true,
      },
      achievementDiaries: {
        completedTaskIds: [{ id: "Ardougne Easy 01" }, { name: "Ardougne Easy 01" }],
        completedTierIds: ["Ardougne Easy"],
        totalCompletedTasks: 21,
      },
    });

    expect(result.player).toEqual({
      rsn: "Test RSN",
      accountType: "IRONMAN",
    });
    expect(result.source).toBe("plugin-export");
    expect(result.syncedAt).toBe(Date.parse(syncedAt));
    expect(result.skills.attack).toBe(50);
    expect(result.skills.strength).toBe(60);
    expect(result.skills.sailing).toBe(1);
    expect(Object.keys(result.skills)).toHaveLength(SKILLS.length);
    expect(result.bosses.vorkath).toBe(8);
    expect(result.bosses.zulrah).toBe(0);
    expect(Object.keys(result.bosses)).toHaveLength(KEY_BOSSES.length);
    expect(result.questState.completedQuestIds).toEqual(["cooks_assistant"]);
    expect(result.questState.startedQuestIds).toEqual(["desert_treasure_ii"]);
    expect(result.questState.syncedQuestPoints).toBe(205);
    expect(result.questState.questCapeDetected).toBe(true);
    expect(result.diaryState.completedTaskIds).toEqual(["ardougne_easy_01"]);
    expect(result.diaryState.completedTierIds).toEqual(["ardougne_easy"]);
    expect(result.diaryState.totalCompletedTasks).toBe(21);
  });

  it("merges skill sources by taking the highest level per skill", () => {
    const merged = mergeSkillSources(
      { attack: 40, strength: 55, sailing: 1 },
      { attack: 62, magic: 77 },
      { strength: 60, fishing: 42 }
    );

    expect(merged.attack).toBe(62);
    expect(merged.strength).toBe(60);
    expect(merged.magic).toBe(77);
    expect(merged.fishing).toBe(42);
    expect(merged.sailing).toBe(1);
    expect(merged.defence).toBe(1);
  });

  it("rejects mismatched RSNs and invalid JSON text", () => {
    expect(() =>
      parseAccountSyncPayload(
        {
          format: ACCOUNT_SYNC_FORMAT,
          player: { rsn: "Different Name" },
          skills: {},
          bosses: {},
        },
        { expectedRsn: "Expected Name" }
      )
    ).toThrow("Account sync RSN mismatch. Expected Expected Name, received Different Name.");

    expect(() => parseAccountSyncText("{not-json}")).toThrow(
      "Account sync file is not valid JSON."
    );
  });
});
