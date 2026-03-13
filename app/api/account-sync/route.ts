import { NextRequest, NextResponse } from "next/server";
import {
  ACCOUNT_SYNC_FORMAT,
  ACCOUNT_SYNC_VERSION,
  parseAccountSyncPayload,
  summarizeDiaryState,
} from "@/components/utils/accountSync.js";
import { summarizeQuestState } from "@/components/utils/questSync.js";

export async function GET() {
  return NextResponse.json({
    ok: true,
    format: ACCOUNT_SYNC_FORMAT,
    version: ACCOUNT_SYNC_VERSION,
    description: "Mettle full account sync ingestion contract for the RuneLite plugin.",
    note: "This endpoint validates and normalizes payloads. It does not persist them yet because the app still uses local browser saves.",
    requiredFields: {
      player: {
        rsn: "string",
      },
      skills: "Record<string, number>",
      bosses: "Record<string, number>",
    },
    optionalFields: {
      player: {
        accountType: "STANDARD | IRONMAN | HARDCORE_IRONMAN | ULTIMATE_IRONMAN | GROUP_IRONMAN",
      },
      quests: {
        completedQuestIds: "string[]",
        startedQuestIds: "string[]",
        questPoints: "number",
        questCapeDetected: "boolean",
      },
      achievementDiaries: {
        completedTaskIds: "string[]",
        completedTierIds: "string[]",
        totalCompletedTasks: "number",
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
    const sync = parseAccountSyncPayload(body, { expectedRsn });

    return NextResponse.json({
      ok: true,
      persisted: false,
      note: "Account sync payload validated. Storage/linking comes next once Mettle has account-linked sync sessions.",
      sync,
      questSummary: summarizeQuestState(sync.questState),
      diarySummary: summarizeDiaryState(sync.diaryState),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Account sync payload could not be processed.",
      },
      { status: 400 }
    );
  }
}
