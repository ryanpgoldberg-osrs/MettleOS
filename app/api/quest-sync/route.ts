import { NextRequest, NextResponse } from "next/server";
import {
  QUEST_SYNC_FORMAT,
  QUEST_SYNC_VERSION,
  parseQuestSyncPayload,
  summarizeQuestState,
} from "@/components/utils/questSync.js";

export async function GET() {
  return NextResponse.json({
    ok: true,
    format: QUEST_SYNC_FORMAT,
    version: QUEST_SYNC_VERSION,
    description: "Mettle quest sync ingestion contract for the future RuneLite plugin.",
    note: "This endpoint validates and normalizes payloads. It does not persist them yet because the app still uses local browser saves.",
    requiredFields: {
      player: {
        rsn: "string",
      },
      quests: {
        completedQuestIds: "string[]",
      },
    },
    optionalFields: {
      player: {
        accountType: "STANDARD | IRONMAN | HARDCORE_IRONMAN | ULTIMATE_IRONMAN | GROUP_IRONMAN",
      },
      quests: {
        startedQuestIds: "string[]",
        questPoints: "number",
        questCapeDetected: "boolean",
      },
      source: "string",
      syncedAt: "ISO timestamp",
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const expectedRsn = req.nextUrl.searchParams.get("rsn") ?? "";
    const questState = parseQuestSyncPayload(body, { expectedRsn });
    const summary = summarizeQuestState(questState);

    return NextResponse.json({
      ok: true,
      persisted: false,
      note: "Quest sync payload validated. Storage/linking comes next once Mettle has account-linked sync sessions.",
      questState,
      summary,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Quest sync payload could not be processed.",
      },
      { status: 400 }
    );
  }
}
