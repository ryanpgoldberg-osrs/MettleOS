"use client";

import { useState, useSyncExternalStore } from "react";
import EntryScreen from "@/components/EntryScreen";
import MettlePrototype from "@/components/MettlePrototype";
import { loadSave } from "@/components/utils/persistence.js";

type EntryData = {
  skillLevels: Record<string, number>;
  bossKC: Record<string, number>;
  rsn: string;
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

  function handleEntryComplete(
    skillLevels: Record<string, number> | null,
    bossKC: Record<string, number> | null,
    rsn: string | null
  ) {
    if (skillLevels && bossKC) {
      setEntryData({ skillLevels, bossKC, rsn: rsn ?? "" });
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
        onResetToEntry={handleResetToEntry}
      />
    );
  }

  return <EntryScreen onComplete={handleEntryComplete} />;
}
