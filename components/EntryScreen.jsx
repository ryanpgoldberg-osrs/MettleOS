"use client";

import { useEffect, useState } from "react";
import { DEFAULT_KC, DEFAULT_SKILLS, KEY_BOSSES, SKILLS } from "./data/constants.js";
import { loadSave } from "./utils/persistence.js";

export default function EntryScreen({ onComplete }) {
  const [phase, setPhase] = useState("landing");
  const [inputMode, setInputMode] = useState("wom");
  const [rsn, setRsn] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [manualSkills, setManualSkills] = useState(DEFAULT_SKILLS);
  const [manualKC, setManualKC] = useState(DEFAULT_KC);
  const displayFont = "'RuneScape UF', 'Silkscreen', 'Arial Black', 'Trebuchet MS', 'Arial Narrow', Arial, sans-serif";

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
      onComplete(levels, kc, data?.rsn ?? trimmed);
    } catch {
      setFetchError("Failed to load — check your RSN and try again.");
    } finally {
      setLoading(false);
    }
  }

  function confirmManualStats() {
    onComplete({ ...manualSkills }, { ...manualKC }, rsn.trim());
  }

  const s = {
    root: {
      minHeight: "100vh",
      position: "relative",
      overflow: "hidden",
      background:
        "radial-gradient(circle at top left, rgba(212,175,55,0.12), transparent 34%), radial-gradient(circle at 85% 18%, rgba(120,120,120,0.08), transparent 26%), linear-gradient(180deg, #090909 0%, #0d0d0d 52%, #080808 100%)",
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
    },
    frame: {
      width: "100%",
      border: "1px solid #1b1b1b",
      background: "rgba(10,10,10,0.88)",
      boxShadow: "0 0 0 1px rgba(255,255,255,0.03)",
    },
    landingGrid: {
      display: "grid",
      gridTemplateColumns: "minmax(0, 1.5fr) minmax(320px, 420px)",
    },
    landingMain: {
      padding: "56px 44px 48px",
      borderRight: "1px solid #1b1b1b",
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
      color: "#5a5a5a",
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
      color: "#d4af37",
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
      color: "#6a6a6a",
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
        "linear-gradient(180deg, rgba(212,175,55,0.06) 0%, rgba(15,15,15,0.92) 18%, rgba(8,8,8,1) 100%)",
    },
    asideLabel: {
      fontSize: "10px",
      letterSpacing: "4px",
      color: "#7b6a32",
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
      borderTop: "1px solid #1f1f1f",
    },
    ledgerIndex: {
      fontSize: "10px",
      letterSpacing: "3px",
      color: "#7a7a7a",
      marginBottom: "6px",
    },
    ledgerBody: {
      fontSize: "12px",
      lineHeight: "1.7",
      color: "#8a8a8a",
    },
    ctaBlock: {
      marginTop: "26px",
      borderTop: "1px solid #1f1f1f",
      paddingTop: "20px",
    },
    cta: {
      width: "100%",
      background: "#d4af37",
      color: "#000",
      padding: "16px 22px",
      fontWeight: "700",
      letterSpacing: "5px",
      fontFamily: displayFont,
      border: "1px solid #d4af37",
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
    inputShell: {
      display: "grid",
      gridTemplateColumns: "minmax(260px, 320px) minmax(0, 1fr)",
    },
    inputIntro: {
      padding: "34px 28px",
      borderRight: "1px solid #1b1b1b",
      background: "linear-gradient(180deg, rgba(212,175,55,0.04), rgba(10,10,10,0.8))",
    },
    inputLabel: {
      fontSize: "10px",
      letterSpacing: "4px",
      color: "#7b6a32",
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
      borderTop: "1px solid #1f1f1f",
      paddingTop: "12px",
      marginTop: "12px",
      fontSize: "11px",
      lineHeight: "1.8",
      color: "#666",
    },
    intake: {
      padding: "34px 30px",
      animation: "entryPanelIn 260ms ease-out",
    },
    formLabel: {
      fontSize: "11px",
      letterSpacing: "3px",
      color: "#555",
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
      background: "#111",
      border: "1px solid #333",
      color: "#fff",
      padding: "12px 16px",
      fontFamily: "inherit",
      fontSize: "13px",
      outline: "none",
    },
    confirmBtn: {
      background: loading ? "#222" : "#fff",
      color: loading ? "#666" : "#000",
      border: "1px solid #fff",
      padding: "12px 22px",
      fontFamily: displayFont,
      fontWeight: "700",
      letterSpacing: "1px",
      cursor: loading ? "default" : "pointer",
      opacity: loading ? 0.6 : 1,
      textTransform: "uppercase",
    },
    error: {
      color: "#f87171",
      fontSize: "11px",
      marginTop: "10px",
    },
    helper: {
      marginTop: "16px",
      color: "#555",
      fontSize: "11px",
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
      color: "#777",
      fontSize: "12px",
    },
    secHead: {
      fontSize: "10px",
      letterSpacing: "3px",
      color: "#555",
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
      background: "#111",
      padding: "5px 8px",
    },
    statLabel: {
      flex: 1,
      fontSize: "11px",
      color: "#666",
    },
    bossLabel: {
      flex: 1,
      fontSize: "10px",
      color: "#666",
    },
    numInput: {
      background: "#0c0c0c",
      border: "1px solid #2a2a2a",
      color: "#fff",
      padding: "2px 6px",
      fontFamily: "inherit",
      fontSize: "12px",
      textAlign: "right",
    },
    manualBtn: {
      background: "#fff",
      color: "#000",
      border: "1px solid #fff",
      padding: "10px 32px",
      fontFamily: displayFont,
      fontWeight: "700",
      letterSpacing: "1px",
      cursor: "pointer",
      textTransform: "uppercase",
    },
  };

  return (
    <div style={s.root}>
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
      <div style={s.shell}>
        {phase === "landing" ? (
          <div style={s.frame}>
            <div className="entry-landing-grid" style={s.landingGrid}>
              <div className="entry-landing-main" style={s.landingMain}>
                <div>
                  <div style={s.topRail}>
                    <div style={s.codeBlock}>
                      <div style={s.docket}>METTLE / LEDGER INITIATION</div>
                      <div style={s.docket}>SERIES ENTRY / FIRST CONTACT</div>
                    </div>
                    <div style={s.sigilWrap}>
                      <div style={s.sigil}>✦</div>
                      <div style={s.sigilMeta}>
                        LEDGER STATUS
                        <br />
                        LISTENING
                        <br />
                        UNFORGIVING
                      </div>
                    </div>
                  </div>
                  <div style={s.marker}>Your account has been avoiding things.</div>
                  <h1 style={s.headline}>
                    {"Mettle finds them.\nNames them.\nMakes you face them."}
                  </h1>
                  <div style={s.divider} />
                  <p style={s.body}>
                    A contract ledger generated from your account&apos;s gaps. The things your
                    stats say you should be able to do but haven&apos;t. Each run is yours alone.
                    No two accounts face the same ledger.
                  </p>
                </div>
                <div style={{ ...s.docket, color: "#444" }}>
                  THIS LEDGER DOES NOT MEASURE POTENTIAL. IT MEASURES NEGLECT.
                </div>
              </div>

              <div style={s.aside}>
                <div>
                  <div style={s.asideLabel}>INTAKE SUMMARY</div>
                  <div style={s.asideTitle}>
                    The ledger reads your account, isolates the gaps, and turns them into a run
                    only your profile could receive.
                  </div>
                  <div style={s.ledgerRow}>
                    <div style={s.ledgerIndex}>01 / READ THE ACCOUNT</div>
                    <div style={s.ledgerBody}>
                      Pull combat, skilling, and boss data from Wise Old Man or enter it yourself.
                    </div>
                  </div>
                  <div style={s.ledgerRow}>
                    <div style={s.ledgerIndex}>02 / GENERATE THE LEDGER</div>
                    <div style={s.ledgerBody}>
                      Drafts, trials, reckoning pressure, and landmarks emerge from what your
                      account has and has not done.
                    </div>
                  </div>
                  <div style={s.ledgerRow}>
                    <div style={s.ledgerIndex}>03 / PROVE IT</div>
                    <div style={s.ledgerBody}>
                      The ledger is not shared. No templates. No universal checklist. Just your
                      blind spots turned into obligations.
                    </div>
                  </div>
                </div>

                <div style={s.ctaBlock}>
                  <button style={s.cta} onClick={() => setPhase("input")}>
                    BEGIN THE RECKONING
                  </button>
                  <div style={s.ctaNote}>ENTER YOUR RSN · FREE · NO ACCOUNT REQUIRED</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={s.frame}>
            <div className="entry-input-grid" style={s.inputShell}>
              <div className="entry-intro" style={s.inputIntro}>
                <div style={s.inputLabel}>LEDGER INTAKE</div>
                <div style={s.inputTitle}>Give the ledger a name to work with.</div>
                <div style={s.inputCopy}>
                  Wise Old Man is the default path. It lets the ledger build your first draft from
                  real account data in one step.
                </div>
                <div style={s.inputStat}>SOURCE / Wise Old Man API</div>
                <div style={s.inputStat}>FALLBACK / Manual stat and boss KC entry</div>
                <div style={s.inputStat}>OUTPUT / A ledger tailored to your account&apos;s gaps</div>
              </div>

              <div style={s.intake}>
                {inputMode === "wom" ? (
                  <>
                    <div style={s.formLabel}>ENTER YOUR RUNESCAPE NAME</div>
                    <form onSubmit={loadPlayerStats}>
                      <div style={s.formRow}>
                        <input
                          style={s.textInput}
                          type="text"
                          value={rsn}
                          autoFocus
                          placeholder="Enter RSN..."
                          onChange={(event) => setRsn(event.target.value)}
                        />
                        <button type="submit" style={s.confirmBtn} disabled={loading}>
                          {loading ? "LOADING..." : "CONFIRM"}
                        </button>
                      </div>
                    </form>
                    {fetchError && <div style={s.error}>⚠ {fetchError}</div>}
                    <div style={s.helper}>
                      Stats pulled from Wise Old Man ·{" "}
                      <button
                        type="button"
                        style={s.link}
                        onClick={() => {
                          setFetchError("");
                          setInputMode("manual");
                        }}
                      >
                        enter manually instead
                      </button>
                    </div>
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
                        ← use wise old man instead
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
                    <div style={s.secHead}>BOSS KC</div>
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
                      CONFIRM — START RUN
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
