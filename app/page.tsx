"use client";

import { useState, useSyncExternalStore } from "react";
import EntryScreen from "@/components/EntryScreen";
import MettlePrototype from "@/components/MettlePrototype";
import type { createEmptyDiaryState } from "@/components/utils/accountSync.js";
import type { createEmptyQuestState } from "@/components/utils/questSync.js";
import { loadSave } from "@/components/utils/persistence.js";

type EntryData = {
  skillLevels: Record<string, number>;
  bossKC: Record<string, number>;
  rsn: string;
  questState?: ReturnType<typeof createEmptyQuestState>;
  diaryState?: ReturnType<typeof createEmptyDiaryState>;
};

function subscribe() {
  return () => {};
}

export default function Home() {
  const [entryData, setEntryData] = useState<EntryData | null>(null);
  const [skipToBoard, setSkipToBoard] = useState(false);
  const [forceEntry, setForceEntry] = useState(false);
  const isClient = useSyncExternalStore(subscribe, () => true, () => false);
  const hasSave = useSyncExternalStore(subscribe, () => Boolean(loadSave()), () => false);
  const theme = "light" as const;

  function handleEntryComplete(
    skillLevels: Record<string, number> | null,
    bossKC: Record<string, number> | null,
    rsn: string | null,
    questState: EntryData["questState"] = undefined,
    diaryState: EntryData["diaryState"] = undefined
  ) {
    if (skillLevels && bossKC) {
      setEntryData({ skillLevels, bossKC, rsn: rsn ?? "", questState, diaryState });
      setForceEntry(false);
      return;
    }
    setForceEntry(false);
    setSkipToBoard(true);
  }

  function handleResetToEntry() {
    setEntryData(null);
    setSkipToBoard(false);
    setForceEntry(true);
  }

  if (!isClient) {
    return <div style={{ minHeight: "100vh", background: "#0a0a0a" }} />;
  }

  if (!forceEntry && (hasSave || skipToBoard || entryData)) {
    return (
      <MettlePrototype
        initialSkillLevels={entryData?.skillLevels ?? null}
        initialBossKC={entryData?.bossKC ?? null}
        initialRsn={entryData?.rsn ?? ""}
        initialQuestState={entryData?.questState ?? null}
        initialDiaryState={entryData?.diaryState ?? null}
        onResetToEntry={handleResetToEntry}
        theme={theme}
      />
    );
  }

  return <EntryScreen onComplete={handleEntryComplete} theme={theme} />;
}
