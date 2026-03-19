import { describe, expect, it } from "vitest";
import {
  QUEST_SYNC_FORMAT,
  normalizeQuestState,
  parseQuestSyncPayload,
  parseQuestSyncText,
} from "@/components/utils/questSync.js";

describe("questSync", () => {
  it("normalizes nested quest sync payloads and removes completed quests from the started list", () => {
    const result = parseQuestSyncPayload({
      format: QUEST_SYNC_FORMAT,
      version: 1,
      source: "mettle-runelite-plugin",
      syncedAt: "2026-03-13T18:30:00.000Z",
      payload: {
        player: {
          rsn: "Quest Hero",
          accountType: "STANDARD",
        },
        quests: {
          completedQuestIds: ["Cook's Assistant", "Cook's Assistant"],
          startedQuestIds: ["Cook's Assistant", "Desert Treasure II"],
          questPoints: 210,
          questCapeDetected: false,
        },
      },
    });

    expect(result.completedQuestIds).toEqual(["cooks_assistant"]);
    expect(result.startedQuestIds).toEqual(["desert_treasure_ii"]);
    expect(result.syncedQuestPoints).toBe(210);
    expect(result.syncSourceRsn).toBe("Quest Hero");
    expect(result.syncAccountType).toBe("STANDARD");
    expect(result.updatedAt).toBe(Date.parse("2026-03-13T18:30:00.000Z"));
  });

  it("normalizes raw quest state objects consistently", () => {
    const result = normalizeQuestState({
      completed: ["Dragon Slayer I"],
      started: ["Dragon Slayer I", "Recipe for Disaster"],
      manualQuestPoints: 250,
      questCapeDetected: true,
      updatedAt: "2026-03-13T18:30:00.000Z",
    });

    expect(result.completedQuestIds).toEqual(["dragon_slayer_i"]);
    expect(result.startedQuestIds).toEqual(["recipe_for_disaster"]);
    expect(result.manualQuestPoints).toBe(250);
    expect(result.questCapeDetected).toBe(true);
    expect(result.updatedAt).toBe(Date.parse("2026-03-13T18:30:00.000Z"));
  });

  it("rejects missing quest data and invalid JSON text", () => {
    expect(() => parseQuestSyncPayload({ format: QUEST_SYNC_FORMAT })).toThrow(
      "Quest sync payload is missing quest data."
    );
    expect(() => parseQuestSyncText("{bad-json}")).toThrow(
      "Quest sync file is not valid JSON."
    );
  });
});
