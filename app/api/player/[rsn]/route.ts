import { NextRequest, NextResponse } from "next/server";

const SKILLS = [
  "attack","strength","defence","ranged","magic","prayer",
  "runecrafting","construction","hitpoints","agility","herblore",
  "thieving","crafting","fletching","slayer","hunter","mining",
  "smithing","fishing","cooking","firemaking","woodcutting","farming","sailing"
];

const BOSSES = [
  "abyssal_sire", "alchemical_hydra", "amoxliatl", "araxxor", "artio",
  "barrows_chests", "brutus", "bryophyta", "callisto", "calvarion",
  "cerberus", "chambers_of_xeric", "chambers_of_xeric_challenge_mode",
  "chaos_elemental", "chaos_fanatic", "commander_zilyana", "corporeal_beast",
  "crazy_archaeologist", "dagannoth_prime", "dagannoth_rex", "dagannoth_supreme",
  "deranged_archaeologist", "doom_of_mokhaiotl", "duke_sucellus", "general_graardor",
  "giant_mole", "grotesque_guardians", "hespori", "kalphite_queen",
  "king_black_dragon", "kraken", "kreearra", "kril_tsutsaroth", "lunar_chests",
  "mimic", "nex", "nightmare", "phosanis_nightmare", "obor", "phantom_muspah",
  "sarachnis", "scorpia", "scurrius", "shellbane_gryphon", "skotizo", "sol_heredit",
  "spindel", "tempoross", "the_corrupted_gauntlet", "the_gauntlet", "the_hueycoatl",
  "the_leviathan", "the_royal_titans", "the_whisperer", "theatre_of_blood",
  "theatre_of_blood_hard_mode", "thermonuclear_smoke_devil", "tombs_of_amascut",
  "tombs_of_amascut_expert", "tzkal_zuk", "tztok_jad", "vardorvis", "venenatis",
  "vetion", "vorkath", "wintertodt", "yama", "zalcano", "zulrah"
];

const HEADERS = {
  "Content-Type": "application/json",
  "User-Agent": "MettleOS/1.0",
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ rsn: string }> }
) {
  const { rsn } = await params;

  try {

    // Step 1 — trigger WOM update
    await fetch(
      `https://api.wiseoldman.net/v2/players/${encodeURIComponent(rsn)}`,
      {
        method: "POST",
        headers: HEADERS
      }
    );

    // Allow WOM time to process the update
    await delay(1200);

    // Step 2 — fetch fresh player data
    const res = await fetch(
      `https://api.wiseoldman.net/v2/players/${encodeURIComponent(rsn)}`,
      {
        headers: HEADERS,
        cache: "no-store"
      }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: `Wise Old Man API returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();

    // DEBUG — raw attack skill snapshot
    console.log(
      "WOM ATTACK:",
      JSON.stringify(data?.latestSnapshot?.data?.skills?.attack)
    );

    const snapshot = data?.latestSnapshot?.data;

    // Handle accounts that WOM hasn't tracked yet
    if (!snapshot) {
      return NextResponse.json(
        { error: "Player snapshot not available yet. Try again in a few seconds." },
        { status: 404 }
      );
    }

    // --- Parse Skills ---
    const skills: Record<string, number> = {};

    for (const skill of SKILLS) {
      const skillData = snapshot.skills?.[skill];
      skills[skill] = typeof skillData?.level === "number" ? skillData.level : 1;
    }

    // --- Parse Boss KC ---
    const bosses: Record<string, number> = {};

    for (const boss of BOSSES) {
      const bossData = snapshot.bosses?.[boss];
      bosses[boss] = typeof bossData?.kills === "number" ? bossData.kills : 0;
    }

    return NextResponse.json({
      rsn: data.displayName ?? rsn,
      skills,
      bosses
    });

  } catch (err) {

    console.error("WOM fetch error:", err);

    return NextResponse.json(
      { error: "Failed to fetch player data from Wise Old Man" },
      { status: 500 }
    );
  }
}