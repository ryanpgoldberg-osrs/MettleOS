"use client";

import { useEffect, useRef, useState } from "react";
import { DEFAULT_KC, DEFAULT_SKILLS, KEY_BOSSES, SKILLS } from "./data/constants.js";
import { mergeSkillSources, parseAccountSyncText } from "./utils/accountSync.js";
import { importSaveText, loadSave } from "./utils/persistence.js";
import { fetchPlayerSnapshotByRsn } from "./utils/womImport.js";

export default function EntryScreen({ onComplete, theme = "dark" }) {
  const [phase, setPhase] = useState("landing");
  const [inputMode, setInputMode] = useState("wom");
  const [rsn, setRsn] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [importError, setImportError] = useState("");
  const [syncError, setSyncError] = useState("");
  const [manualSkills, setManualSkills] = useState(DEFAULT_SKILLS);
  const [manualKC, setManualKC] = useState(DEFAULT_KC);
  const importInputRef = useRef(null);
  const accountSyncInputRef = useRef(null);
  const displayFont = "'RuneScape UF', 'Silkscreen', 'Arial Black', 'Trebuchet MS', 'Arial Narrow', Arial, sans-serif";
  const isLightTheme = theme === "light";

  useEffect(() => {
    const save = loadSave();
    if (save) {
      onComplete(null, null, null);
    }
  }, [onComplete]);

  async function loadPlayerStats(event) {
    event?.preventDefault();
    const trimmed = rsn.trim();
    if (!trimmed) return;
    setLoading(true);
    setFetchError("");
    try {
      const res = await fetch(`/api/player/${encodeURIComponent(trimmed)}`);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      const levels = {};
      SKILLS.forEach((skill) => {
        levels[skill] = data?.skills?.[skill] ?? 1;
      });
      const kc = {};
      KEY_BOSSES.forEach((boss) => {
        kc[boss] = data?.bosses?.[boss] ?? 0;
      });
      onComplete(levels, kc, data?.rsn ?? trimmed, undefined, undefined);
    } catch {
      setFetchError("Couldn't load that player. Check the RSN or switch to manual entry.");
    } finally {
      setLoading(false);
    }
  }

  function confirmManualStats() {
    onComplete({ ...manualSkills }, { ...manualKC }, rsn.trim(), undefined, undefined);
  }

  function openImportPicker() {
    setImportError("");
    importInputRef.current?.click();
  }

  function openAccountSyncPicker() {
    setSyncError("");
    accountSyncInputRef.current?.click();
  }

  async function importSaveFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const rawText = await file.text();
      importSaveText(rawText);
      onComplete(null, null, null);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "That save file could not be imported.");
    }
  }

  async function importAccountSyncFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const rawText = await file.text();
      const sync = parseAccountSyncText(rawText);
      let mergedSkills = sync.skills;
      let mergedBosses = sync.bosses;
      let resolvedRsn = sync.player.rsn;

      try {
        const womData = await fetchPlayerSnapshotByRsn(sync.player.rsn);
        mergedSkills = mergeSkillSources(sync.skills, womData?.skills);
        const kc = {};
        KEY_BOSSES.forEach((boss) => {
          kc[boss] = womData?.bosses?.[boss] ?? sync.bosses?.[boss] ?? 0;
        });
        mergedBosses = kc;
        resolvedRsn = womData?.rsn ?? sync.player.rsn;
        setSyncError("");
      } catch {
        setSyncError("Account sync imported, but Wise Old Man boss sync was unavailable.");
      }

      onComplete(mergedSkills, mergedBosses, resolvedRsn, sync.questState, sync.diaryState);
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "That account sync file could not be imported.");
    }
  }

  const s = {
    root: {
      minHeight: "100vh",
      position: "relative",
      overflow: "hidden",
      background:
        isLightTheme
          ? "radial-gradient(circle at top left, rgba(189,145,68,0.18), transparent 34%), radial-gradient(circle at 85% 18%, rgba(89,107,59,0.12), transparent 26%), linear-gradient(180deg, #18120d 0%, #0f0b08 52%, #080706 100%)"
          : "radial-gradient(circle at top left, rgba(212,175,55,0.12), transparent 34%), radial-gradient(circle at 85% 18%, rgba(120,120,120,0.08), transparent 26%), linear-gradient(180deg, #090909 0%, #0d0d0d 52%, #080808 100%)",
      color: "#fff",
      fontFamily: "'Courier New', monospace",
    },
    atmosphere: {
      position: "absolute",
      inset: 0,
      backgroundImage:
        "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
      backgroundSize: "36px 36px",
      maskImage: "linear-gradient(180deg, rgba(0,0,0,0.9), rgba(0,0,0,0.35))",
      pointerEvents: "none",
    },
    veil: {
      position: "absolute",
      inset: 0,
      background: "linear-gradient(90deg, rgba(8,8,8,0.94), rgba(8,8,8,0.7) 48%, rgba(8,8,8,0.9))",
      pointerEvents: "none",
    },
    shell: {
      position: "relative",
      zIndex: 1,
      minHeight: "100vh",
      maxWidth: "1180px",
      margin: "0 auto",
      padding: "32px 20px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    frame: {
      width: "100%",
      border: isLightTheme ? "1px solid #665743" : "1px solid #1b1b1b",
      background: isLightTheme
        ? "linear-gradient(180deg, rgba(114,92,68,0.18) 0%, rgba(42,34,27,0.82) 16%, rgba(15,13,10,0.96) 100%)"
        : "rgba(10,10,10,0.88)",
      boxShadow: isLightTheme
        ? "0 0 0 1px rgba(21,17,12,0.75), inset 1px 1px 0 rgba(234,210,166,0.1), inset -1px -1px 0 rgba(22,17,12,0.72)"
        : "0 0 0 1px rgba(255,255,255,0.03)",
    },
    landingGrid: {
      display: "grid",
      gridTemplateColumns: "minmax(0, 1.5fr) minmax(320px, 420px)",
    },
    landingMain: {
      padding: "56px 44px 48px",
      borderRight: isLightTheme ? "1px solid #574937" : "1px solid #1b1b1b",
      minHeight: "620px",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
    },
    topRail: {
      display: "flex",
      justifyContent: "space-between",
      gap: "20px",
      alignItems: "flex-start",
      marginBottom: "42px",
      flexWrap: "wrap",
    },
    codeBlock: {
      display: "flex",
      flexDirection: "column",
      gap: "10px",
    },
    docket: {
      fontSize: "10px",
      letterSpacing: "4px",
      color: isLightTheme ? "#ba8d43" : "#5a5a5a",
    },
    sigilWrap: {
      display: "flex",
      alignItems: "center",
      gap: "14px",
    },
    sigil: {
      width: "88px",
      height: "88px",
      border: "1px solid #3a3a3a",
      borderRadius: "999px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#d4af37",
      fontSize: "28px",
      animation: "entrySigilPulse 3s ease-in-out infinite",
      flexShrink: 0,
    },
    sigilMeta: {
      fontSize: "10px",
      lineHeight: "1.8",
      letterSpacing: "3px",
      color: "#666",
      textTransform: "uppercase",
    },
    marker: {
      fontSize: "13px",
      letterSpacing: "6px",
      color: isLightTheme ? "#df9c37" : "#d4af37",
      textTransform: "uppercase",
      marginBottom: "24px",
    },
    headline: {
      fontFamily: displayFont,
      fontSize: "clamp(42px, 8vw, 88px)",
      lineHeight: "0.96",
      fontWeight: "700",
      color: "#f4f4f4",
      margin: 0,
      whiteSpace: "pre-line",
      maxWidth: "700px",
      textTransform: "uppercase",
      textShadow: "0 1px 0 rgba(0,0,0,0.55), 0 0 18px rgba(212,175,55,0.08)",
    },
    divider: {
      width: "136px",
      height: "1px",
      background: "#d4af37",
      margin: "28px 0 22px",
    },
    body: {
      maxWidth: "470px",
      margin: 0,
      color: isLightTheme ? "#978d80" : "#6a6a6a",
      fontSize: "13px",
      lineHeight: "1.85",
    },
    aside: {
      padding: "32px 28px",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      minHeight: "620px",
      background:
        isLightTheme
          ? "linear-gradient(180deg, rgba(145,118,79,0.16) 0%, rgba(53,43,33,0.9) 18%, rgba(14,12,10,1) 100%)"
          : "linear-gradient(180deg, rgba(212,175,55,0.06) 0%, rgba(15,15,15,0.92) 18%, rgba(8,8,8,1) 100%)",
    },
    asideLabel: {
      fontSize: "10px",
      letterSpacing: "4px",
      color: isLightTheme ? "#d59a44" : "#7b6a32",
      marginBottom: "18px",
    },
    asideTitle: {
      fontFamily: displayFont,
      fontSize: "18px",
      color: "#f2f2f2",
      lineHeight: "1.35",
      marginBottom: "18px",
      textTransform: "uppercase",
      letterSpacing: "0.5px",
    },
    ledgerRow: {
      padding: "12px 0",
      borderTop: isLightTheme ? "1px solid #382e23" : "1px solid #1f1f1f",
    },
    ledgerIndex: {
      fontSize: "10px",
      letterSpacing: "3px",
      color: isLightTheme ? "#d59a44" : "#7a7a7a",
      marginBottom: "6px",
    },
    ledgerBody: {
      fontSize: "12px",
      lineHeight: "1.7",
      color: isLightTheme ? "#b0a694" : "#8a8a8a",
    },
    ctaBlock: {
      marginTop: "26px",
      borderTop: isLightTheme ? "1px solid #3d3226" : "1px solid #1f1f1f",
      paddingTop: "20px",
    },
    cta: {
      width: "100%",
      background: isLightTheme ? "linear-gradient(180deg, #c68f36 0%, #8e6323 100%)" : "#d4af37",
      color: isLightTheme ? "#20160a" : "#000",
      padding: "16px 22px",
      fontWeight: "700",
      letterSpacing: "5px",
      fontFamily: displayFont,
      border: isLightTheme ? "1px solid #e7bb68" : "1px solid #d4af37",
      boxShadow: isLightTheme ? "inset 1px 1px 0 rgba(255,236,198,0.28), inset -1px -1px 0 rgba(86,55,20,0.5)" : "none",
      cursor: "pointer",
      textAlign: "center",
      textTransform: "uppercase",
    },
    ctaNote: {
      marginTop: "14px",
      fontSize: "10px",
      letterSpacing: "2px",
      color: "#4b4b4b",
      textAlign: "center",
    },
    secondaryCta: {
      width: "100%",
      marginTop: "10px",
      background: isLightTheme ? "linear-gradient(180deg, rgba(98,80,58,0.42) 0%, rgba(49,40,30,0.9) 100%)" : "transparent",
      color: isLightTheme ? "#e0c999" : "#d4af37",
      padding: "14px 22px",
      fontWeight: "700",
      letterSpacing: "4px",
      fontFamily: displayFont,
      border: isLightTheme ? "1px solid #6d5a43" : "1px solid #4b3f18",
      boxShadow: isLightTheme ? "inset 1px 1px 0 rgba(237,214,171,0.1), inset -1px -1px 0 rgba(23,18,13,0.72)" : "none",
      cursor: "pointer",
      textAlign: "center",
      textTransform: "uppercase",
    },
    noteBox: {
      marginTop: "12px",
      fontSize: "11px",
      lineHeight: "1.7",
      color: "#7a7a7a",
    },
    inputShell: {
      display: "grid",
      gridTemplateColumns: "minmax(260px, 320px) minmax(0, 1fr)",
    },
    inputIntro: {
      padding: "34px 28px",
      borderRight: isLightTheme ? "1px solid #564937" : "1px solid #1b1b1b",
      background: isLightTheme ? "linear-gradient(180deg, rgba(141,115,79,0.16), rgba(23,19,15,0.88))" : "linear-gradient(180deg, rgba(212,175,55,0.04), rgba(10,10,10,0.8))",
    },
    inputLabel: {
      fontSize: "10px",
      letterSpacing: "4px",
      color: isLightTheme ? "#d59a44" : "#7b6a32",
      marginBottom: "16px",
    },
    inputTitle: {
      fontFamily: displayFont,
      fontSize: "26px",
      lineHeight: "1.08",
      color: "#fff",
      marginBottom: "14px",
      textTransform: "uppercase",
      letterSpacing: "0.6px",
    },
    inputCopy: {
      fontSize: "12px",
      lineHeight: "1.8",
      color: "#707070",
      marginBottom: "20px",
    },
    inputStat: {
      borderTop: isLightTheme ? "1px solid #382f24" : "1px solid #1f1f1f",
      paddingTop: "12px",
      marginTop: "12px",
      fontSize: "11px",
      lineHeight: "1.8",
      color: isLightTheme ? "#b1a48e" : "#666",
    },
    intake: {
      padding: "34px 30px",
      animation: "entryPanelIn 260ms ease-out",
    },
    formLabel: {
      fontSize: "11px",
      letterSpacing: "3px",
      color: isLightTheme ? "#d59a44" : "#555",
      marginBottom: "14px",
    },
    formRow: {
      display: "flex",
      gap: "8px",
      alignItems: "stretch",
      flexWrap: "wrap",
    },
    textInput: {
      flex: "1 1 300px",
      background: isLightTheme ? "linear-gradient(180deg, rgba(64,52,39,0.58) 0%, rgba(26,21,16,0.94) 100%)" : "#111",
      border: isLightTheme ? "1px solid #6b5a45" : "1px solid #333",
      color: isLightTheme ? "#f6efe0" : "#fff",
      padding: "12px 16px",
      fontFamily: "inherit",
      fontSize: "13px",
      outline: "none",
      boxShadow: isLightTheme ? "inset 1px 1px 0 rgba(235,213,173,0.08), inset -1px -1px 0 rgba(22,17,12,0.7)" : "none",
    },
    confirmBtn: {
      background: isLightTheme
        ? (loading ? "linear-gradient(180deg, #4a3d2f 0%, #30261d 100%)" : "linear-gradient(180deg, #5f513f 0%, #3f3529 100%)")
        : (loading ? "#222" : "#fff"),
      color: isLightTheme ? (loading ? "#8f8779" : "#f6d382") : (loading ? "#666" : "#000"),
      border: isLightTheme ? "1px solid #8a7453" : "1px solid #fff",
      padding: "12px 22px",
      fontFamily: displayFont,
      fontWeight: "700",
      letterSpacing: "1px",
      cursor: loading ? "default" : "pointer",
      opacity: loading ? 0.6 : 1,
      textTransform: "uppercase",
      boxShadow: isLightTheme ? "inset 1px 1px 0 rgba(238,213,171,0.12), inset -1px -1px 0 rgba(21,16,12,0.7)" : "none",
    },
    error: {
      color: "#f87171",
      fontSize: "11px",
      marginTop: "10px",
    },
    helper: {
      marginTop: "16px",
      color: isLightTheme ? "#9b8f7a" : "#555",
      fontSize: "11px",
    },
    syncHelper: {
      marginTop: "12px",
      color: isLightTheme ? "#d8ad55" : "#8d7836",
      fontSize: "11px",
      lineHeight: "1.8",
    },
    link: {
      background: "none",
      border: "none",
      padding: 0,
      color: "inherit",
      fontFamily: "inherit",
      fontSize: "inherit",
      textDecoration: "underline",
      cursor: "pointer",
    },
    manualLink: {
      marginBottom: "18px",
      color: isLightTheme ? "#aa9b84" : "#777",
      fontSize: "12px",
    },
    secHead: {
      fontSize: "10px",
      letterSpacing: "3px",
      color: isLightTheme ? "#d59a44" : "#555",
      marginBottom: "12px",
    },
    gridSkills: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
      gap: "3px",
      marginBottom: "20px",
    },
    gridBosses: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
      gap: "3px",
      marginBottom: "20px",
    },
    statRow: {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      background: isLightTheme ? "linear-gradient(180deg, rgba(95,78,58,0.28) 0%, rgba(35,29,22,0.88) 100%)" : "#111",
      padding: "5px 8px",
      border: isLightTheme ? "1px solid #544633" : "none",
      boxShadow: isLightTheme ? "inset 1px 1px 0 rgba(239,217,178,0.05), inset -1px -1px 0 rgba(22,17,12,0.7)" : "none",
    },
    statLabel: {
      flex: 1,
      fontSize: "11px",
      color: isLightTheme ? "#cbbda2" : "#666",
    },
    bossLabel: {
      flex: 1,
      fontSize: "10px",
      color: isLightTheme ? "#cbbda2" : "#666",
    },
    numInput: {
      background: isLightTheme ? "#17120d" : "#0c0c0c",
      border: isLightTheme ? "1px solid #645541" : "1px solid #2a2a2a",
      color: isLightTheme ? "#6bd872" : "#fff",
      padding: "2px 6px",
      fontFamily: "inherit",
      fontSize: "12px",
      textAlign: "right",
    },
    manualBtn: {
      background: isLightTheme ? "linear-gradient(180deg, #5f513f 0%, #3f3529 100%)" : "#fff",
      color: isLightTheme ? "#f6d382" : "#000",
      border: isLightTheme ? "1px solid #8a7453" : "1px solid #fff",
      padding: "10px 32px",
      fontFamily: displayFont,
      fontWeight: "700",
      letterSpacing: "1px",
      cursor: "pointer",
      textTransform: "uppercase",
      boxShadow: isLightTheme ? "inset 1px 1px 0 rgba(238,213,171,0.12), inset -1px -1px 0 rgba(21,16,12,0.7)" : "none",
    },
  };

  return (
    <div style={s.root}>
      <input
        ref={accountSyncInputRef}
        type="file"
        accept="application/json,.json"
        style={{ display: "none" }}
        onChange={importAccountSyncFile}
      />
      <style>{`
        @keyframes entrySigilPulse {
          0%, 100% { transform: scale(1); opacity: 0.82; }
          50% { transform: scale(1.06); opacity: 1; }
        }

        @keyframes entryPanelIn {
          0% { opacity: 0; transform: translateY(12px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 900px) {
          .entry-landing-grid,
          .entry-input-grid {
            grid-template-columns: 1fr !important;
          }

          .entry-landing-main,
          .entry-intro {
            border-right: none !important;
            border-bottom: 1px solid #1b1b1b !important;
          }
        }
      `}</style>
      <div style={s.atmosphere} />
      <div style={s.veil} />
      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        style={{ display: "none" }}
        onChange={importSaveFile}
      />
      <div style={s.shell}>
        {phase === "landing" ? (
          <div style={s.frame}>
            <div className="entry-landing-grid" style={s.landingGrid}>
              <div className="entry-landing-main" style={s.landingMain}>
                <div>
                  <div style={s.topRail}>
                    <div style={s.codeBlock}>
                      <div style={s.docket}>METTLE / PERSONAL LEDGER</div>
                      <div style={s.docket}>OSRS / TASK ASCENT</div>
                    </div>
                    <div style={s.sigilWrap}>
                      <div style={s.sigil}>✦</div>
                      <div style={s.sigilMeta}>
                        STATUS
                        <br />
                        READY
                        <br />
                        LOCAL ONLY
                      </div>
                    </div>
                  </div>
                  <div style={s.marker}>Built from your account.</div>
                  <h1 style={s.headline}>{"Mettle builds\nyour ledger."}</h1>
                  <div style={s.divider} />
                  <p style={s.body}>
                    Import your stats, generate a task ascent, and work through the gaps your
                    account has left behind. Each ledger is personal to the account you load.
                  </p>
                </div>
                <div style={{ ...s.docket, color: "#444" }}>
                  PRIVATE ASCENT STATE. SAVED IN THIS BROWSER.
                </div>
              </div>

              <div style={s.aside}>
                <div>
                  <div style={s.asideLabel}>HOW IT WORKS</div>
                  <div style={s.asideTitle}>
                    Import your account, generate tasks, and push through the ascent one draft at a
                    time.
                  </div>
                  <div style={s.ledgerRow}>
                    <div style={s.ledgerIndex}>01 / IMPORT STATS</div>
                    <div style={s.ledgerBody}>
                      Import a Mettle sync file for quests and diaries, then let Wise Old Man
                      refresh boss KC automatically from the same RSN.
                    </div>
                  </div>
                  <div style={s.ledgerRow}>
                    <div style={s.ledgerIndex}>02 / GENERATE TASKS</div>
                    <div style={s.ledgerBody}>
                      Mettle turns account gaps into a draft of tasks, trials, and progression
                      pressure.
                    </div>
                  </div>
                  <div style={s.ledgerRow}>
                    <div style={s.ledgerIndex}>03 / TRACK THE ASCENT</div>
                    <div style={s.ledgerBody}>
                      Your ascent saves in this browser. Complete tasks, defer them, and manage the
                      pressure that builds up.
                    </div>
                  </div>
                </div>

                <div style={s.ctaBlock}>
                  <button style={s.cta} onClick={() => setPhase("input")}>
                    GENERATE LEDGER
                  </button>
                  <button type="button" style={s.secondaryCta} onClick={openAccountSyncPicker}>
                    IMPORT ACCOUNT SYNC
                  </button>
                  <button type="button" style={s.secondaryCta} onClick={openImportPicker}>
                    IMPORT SAVE FILE
                  </button>
                  <div style={s.ctaNote}>ENTER YOUR RSN · FREE · NO SIGN-UP</div>
                  {syncError && <div style={s.noteBox}>⚠ {syncError}</div>}
                  {importError && <div style={s.noteBox}>⚠ {importError}</div>}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={s.frame}>
            <div className="entry-input-grid" style={s.inputShell}>
              <div className="entry-intro" style={s.inputIntro}>
                <div style={s.inputLabel}>ASCENT SETUP</div>
                <div style={s.inputTitle}>Start with your RuneScape name.</div>
                <div style={s.inputCopy}>
                  Import a full Mettle sync file from the plugin for skills, quests, and diaries.
                  Mettle will then use the same RSN to refresh boss KC through Wise Old Man
                  automatically.
                </div>
                <div style={s.inputStat}>PRIMARY / Mettle plugin account sync</div>
                <div style={s.inputStat}>BOSS KC / Wise Old Man refresh after sync import</div>
                <div style={s.inputStat}>FALLBACK / Manual stats and boss killcount</div>
                <div style={s.inputStat}>STORAGE / Saved in this browser only</div>
              </div>

              <div style={s.intake}>
                {inputMode === "wom" ? (
                  <>
                    <div style={s.formLabel}>RUNESCAPE NAME (RSN)</div>
                    <form onSubmit={loadPlayerStats}>
                      <div style={s.formRow}>
                        <input
                          style={s.textInput}
                          type="text"
                          value={rsn}
                          autoFocus
                          placeholder="Enter your RSN..."
                          onChange={(event) => setRsn(event.target.value)}
                        />
                        <button type="submit" style={s.confirmBtn} disabled={loading}>
                          {loading ? "IMPORTING..." : "IMPORT"}
                        </button>
                      </div>
                    </form>
                    {fetchError && <div style={s.error}>⚠ {fetchError}</div>}
                    <div style={s.helper}>
                      Imports public stats from Wise Old Man only ·{" "}
                      <button type="button" style={s.link} onClick={openAccountSyncPicker}>
                        import full Mettle account sync
                      </button>{" "}
                      ·{" "}
                      <button
                        type="button"
                        style={s.link}
                        onClick={() => {
                          setFetchError("");
                          setInputMode("manual");
                        }}
                      >
                        enter stats manually
                      </button>
                    </div>
                    {syncError && <div style={s.syncHelper}>⚠ {syncError}</div>}
                  </>
                ) : (
                  <>
                    <div style={s.manualLink}>
                      <button
                        type="button"
                        style={s.link}
                        onClick={() => {
                          setFetchError("");
                          setInputMode("wom");
                        }}
                      >
                        ← import from Wise Old Man instead
                      </button>
                    </div>
                    <div style={s.secHead}>SKILLS</div>
                    <div style={s.gridSkills}>
                      {SKILLS.map((skill) => (
                        <div key={skill} style={s.statRow}>
                          <span style={{ ...s.statLabel, textTransform: "capitalize" }}>{skill}</span>
                          <input
                            type="number"
                            min="1"
                            max="99"
                            value={manualSkills[skill]}
                            onChange={(event) =>
                              setManualSkills((prev) => ({
                                ...prev,
                                [skill]: Math.min(99, Math.max(1, parseInt(event.target.value, 10) || 1)),
                              }))
                            }
                            style={{ ...s.numInput, width: "40px" }}
                          />
                        </div>
                      ))}
                    </div>
                    <div style={s.secHead}>BOSS KILLCOUNT</div>
                    <div style={s.gridBosses}>
                      {KEY_BOSSES.map((boss) => (
                        <div key={boss} style={s.statRow}>
                          <span style={s.bossLabel}>{boss.replace(/_/g, " ")}</span>
                          <input
                            type="number"
                            min="0"
                            value={manualKC[boss]}
                            onChange={(event) =>
                              setManualKC((prev) => ({
                                ...prev,
                                [boss]: Math.max(0, parseInt(event.target.value, 10) || 0),
                              }))
                            }
                            style={{ ...s.numInput, width: "52px" }}
                          />
                        </div>
                      ))}
                    </div>
                    <button type="button" style={s.manualBtn} onClick={confirmManualStats}>
                      START ASCENT
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
