"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

const DISPLAY_FONT = "'RuneScape UF', 'Silkscreen', 'Arial Black', 'Trebuchet MS', 'Arial Narrow', Arial, sans-serif";
const WATCHLIST_KEY = "mettle_merchant_watchlist_v1";
const REFRESH_INTERVAL_SECONDS = 120;
const ICON_BASE = "https://raw.githubusercontent.com/runelite/static.runelite.net/gh-pages/cache/item/icon";

const SORT_LABELS = {
  score: "Score",
  profit: "Profit",
  roi: "ROI",
  volume: "Volume",
};

const COLORS = {
  bg: "#070707",
  panel: "#0c0c0c",
  card: "#101010",
  cardHover: "#151515",
  border: "#191919",
  borderWarm: "#2f2613",
  borderLit: "#8f7530",
  gold: "#d4af37",
  goldSoft: "#f0e0ad",
  green: "#4ade80",
  blue: "#93c5fd",
  red: "#f87171",
  text: "#d2d2cf",
  textDim: "#7d7d76",
  textMuted: "#55554f",
};

function fmtGp(value) {
  if (!Number.isFinite(value)) return "--";
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  }
  return Math.round(value).toLocaleString();
}

function fmtExactGp(value) {
  if (!Number.isFinite(value)) return "--";
  return Math.round(value).toLocaleString();
}

function fmtPercent(value) {
  if (!Number.isFinite(value)) return "--";
  return `${value.toFixed(1)}%`;
}

function formatTimeLabel(timestamp) {
  if (!timestamp) return "Waiting for data";
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAgeLabel(minutes) {
  if (!Number.isFinite(minutes)) return "--";
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1).replace(/\.0$/, "")}h`;
  return `${(hours / 24).toFixed(1).replace(/\.0$/, "")}d`;
}

function signalColors(signal) {
  if (signal === "Flip") {
    return { border: "#1f4d36", text: COLORS.green, bg: "rgba(20, 56, 15, 0.22)" };
  }
  if (signal === "Caution") {
    return { border: "#4a3711", text: COLORS.goldSoft, bg: "rgba(76, 55, 17, 0.18)" };
  }
  return { border: "#3a1d1d", text: COLORS.red, bg: "rgba(122, 29, 29, 0.14)" };
}

function loadWatchlist() {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value) => Number.isInteger(value));
  } catch {
    return [];
  }
}

function saveWatchlist(nextWatchlist) {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(nextWatchlist));
  } catch {}
}

function sortItems(sortBy, left, right) {
  if (sortBy === "profit") return right.profit - left.profit;
  if (sortBy === "roi") return right.roi - left.roi;
  if (sortBy === "volume") return right.volume - left.volume;
  return right.score - left.score;
}

function StatPill({ label, value, accent = COLORS.text }) {
  return (
    <div
      style={{
        border: `1px solid ${COLORS.border}`,
        background: "linear-gradient(180deg, rgba(255,255,255,0.015) 0%, rgba(10,10,10,0.96) 100%)",
        padding: "10px 12px",
        minWidth: "150px",
      }}
    >
      <div
        style={{
          fontSize: "10px",
          letterSpacing: "2px",
          color: COLORS.textMuted,
          textTransform: "uppercase",
          marginBottom: "6px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: DISPLAY_FONT,
          fontSize: "18px",
          letterSpacing: "0.5px",
          color: accent,
          textTransform: "uppercase",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Section({ label, detail, children }) {
  return (
    <section style={{ marginBottom: "24px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: "10px",
          flexWrap: "wrap",
          marginBottom: "10px",
        }}
      >
        <div
          style={{
            fontSize: "10px",
            letterSpacing: "3px",
            color: COLORS.gold,
            textTransform: "uppercase",
          }}
        >
          {label}
        </div>
        {detail ? (
          <div style={{ fontSize: "11px", color: COLORS.textMuted }}>{detail}</div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export default function MerchantBoard({ isOpen, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [watchlist, setWatchlist] = useState([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [sortBy, setSortBy] = useState("score");
  const [expandedId, setExpandedId] = useState(null);
  const [cachedAt, setCachedAt] = useState(0);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL_SECONDS);
  const [isVisible, setIsVisible] = useState(true);
  const [copyMessage, setCopyMessage] = useState("");

  const intervalRef = useRef(null);
  const hasItemsRef = useRef(false);
  const copyTimerRef = useRef(null);
  const deferredSearch = useDeferredValue(search);
  const watchSet = useMemo(() => new Set(watchlist), [watchlist]);
  const hasItems = items.length > 0;

  useEffect(() => {
    hasItemsRef.current = hasItems;
  }, [hasItems]);

  useEffect(() => {
    setWatchlist(loadWatchlist());
  }, []);

  useEffect(() => {
    saveWatchlist(watchlist);
  }, [watchlist]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const syncVisibility = () => {
      setIsVisible(document.visibilityState === "visible");
    };

    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);

    return () => {
      document.removeEventListener("visibilitychange", syncVisibility);
    };
  }, []);

  const loadBoard = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) {
        setError("");
      }

      setLoading(!hasItemsRef.current && !silent);
      setRefreshing(silent || hasItemsRef.current);

      try {
        const res = await fetch("/api/prices", { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`Merchant price route returned ${res.status}`);
        }

        const payload = await res.json();
        if (!Array.isArray(payload.items)) {
          throw new Error("Merchant price payload was not an item list.");
        }

        setItems(payload.items);
        setCachedAt(typeof payload.cachedAt === "number" ? payload.cachedAt : Date.now());
        setError("");
      } catch (loadError) {
        console.error("[merchant-board]", loadError);
        setError(
          hasItemsRef.current
            ? "Could not refresh prices. Showing the last cached board."
            : "Could not load Grand Exchange prices right now."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!isOpen || !isVisible) return undefined;

    loadBoard({ silent: hasItemsRef.current });
    setCountdown(REFRESH_INTERVAL_SECONDS);

    intervalRef.current = window.setInterval(() => {
      setCountdown((current) => {
        if (current <= 1) {
          loadBoard({ silent: true });
          return REFRESH_INTERVAL_SECONDS;
        }
        return current - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isOpen, isVisible, loadBoard]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  const normalizedSearch = deferredSearch.trim().toLowerCase();

  const filteredItems = useMemo(() => {
    let nextItems = items;

    if (normalizedSearch) {
      nextItems = nextItems.filter((item) =>
        item.name.toLowerCase().includes(normalizedSearch)
      );
    }

    if (activeTab === "watchlist") {
      nextItems = nextItems.filter((item) => watchSet.has(item.id));
    }

    return [...nextItems].sort((left, right) => sortItems(sortBy, left, right));
  }, [activeTab, items, normalizedSearch, sortBy, watchSet]);

  const readyNow = useMemo(
    () => filteredItems.filter((item) => item.signal === "Flip").slice(0, 8),
    [filteredItems]
  );
  const worthChecking = useMemo(
    () => filteredItems.filter((item) => item.signal === "Caution").slice(0, 8),
    [filteredItems]
  );
  const longShots = useMemo(
    () =>
      filteredItems
        .filter((item) => item.signal === "Wait" && item.confidence >= 40 && item.profit >= 300)
        .slice(0, 8),
    [filteredItems]
  );
  const surfacedItems = useMemo(() => filteredItems.slice(0, 36), [filteredItems]);

  const topScore = items[0];
  const readyCount = useMemo(
    () => items.filter((item) => item.signal === "Flip").length,
    [items]
  );
  const averageConfidence = useMemo(() => {
    if (!items.length) return 0;
    const sample = items.slice(0, 25);
    return Math.round(sample.reduce((total, item) => total + item.confidence, 0) / Math.max(sample.length, 1));
  }, [items]);

  function toggleWatch(itemId) {
    setWatchlist((current) =>
      current.includes(itemId)
        ? current.filter((trackedId) => trackedId !== itemId)
        : [...current, itemId]
    );
  }

  async function copyText(text, label) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const fallback = document.createElement("textarea");
        fallback.value = text;
        fallback.setAttribute("readonly", "");
        fallback.style.position = "absolute";
        fallback.style.left = "-9999px";
        document.body.appendChild(fallback);
        fallback.select();
        document.execCommand("copy");
        document.body.removeChild(fallback);
      }

      setCopyMessage(label);
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => {
        setCopyMessage("");
      }, 1800);
    } catch (copyError) {
      console.error("[merchant-board] copy failed", copyError);
    }
  }

  function renderCard(item) {
    const isExpanded = expandedId === item.id;
    const isTracked = watchSet.has(item.id);
    const signalStyle = signalColors(item.signal);

    return (
      <article
        key={item.id}
        style={{
          border: `1px solid ${isExpanded ? COLORS.borderLit : COLORS.borderWarm}`,
          background: isExpanded
            ? "linear-gradient(180deg, rgba(212,175,55,0.06) 0%, rgba(16,16,16,0.98) 28%, rgba(10,10,10,0.98) 100%)"
            : "linear-gradient(180deg, rgba(255,255,255,0.015) 0%, rgba(10,10,10,0.98) 100%)",
          padding: "14px",
          boxShadow: isExpanded ? "0 0 28px rgba(212,175,55,0.08)" : "none",
          transition: "border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "12px",
            alignItems: "flex-start",
            marginBottom: "12px",
          }}
        >
          <div style={{ display: "flex", gap: "10px", minWidth: 0 }}>
            <img
              src={`${ICON_BASE}/${item.id}.png`}
              alt={`${item.name} icon`}
              width="28"
              height="28"
              style={{
                width: "28px",
                height: "28px",
                imageRendering: "pixelated",
                flexShrink: 0,
              }}
              onError={(event) => {
                event.currentTarget.style.visibility = "hidden";
              }}
            />
            <div style={{ minWidth: 0 }}>
              <button
                type="button"
                onClick={() => copyText(item.name, `Copied item name: ${item.name}`)}
                title="Copy item name"
                style={{
                  fontFamily: DISPLAY_FONT,
                  fontSize: "17px",
                  lineHeight: "1.1",
                  color: COLORS.goldSoft,
                  textTransform: "uppercase",
                  textWrap: "balance",
                  marginBottom: "4px",
                  background: "none",
                  border: "none",
                  padding: 0,
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                {item.name}
              </button>
              <div style={{ fontSize: "11px", color: COLORS.textMuted }}>
                {item.members ? "Members item" : "Free-to-play item"} · Click name to copy
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => toggleWatch(item.id)}
              style={{
                border: `1px solid ${isTracked ? COLORS.borderLit : COLORS.border}`,
                background: isTracked ? "#1b160b" : "#0f0f0f",
                color: isTracked ? COLORS.goldSoft : COLORS.textDim,
                padding: "5px 8px",
                fontSize: "10px",
                fontFamily: "inherit",
                letterSpacing: "1.5px",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              {isTracked ? "Tracking" : "Track"}
            </button>
            <button
              type="button"
              onClick={() => setExpandedId((current) => (current === item.id ? null : item.id))}
              style={{
                border: `1px solid ${COLORS.border}`,
                background: "transparent",
                color: COLORS.textDim,
                padding: "5px 8px",
                fontSize: "10px",
                fontFamily: "inherit",
                letterSpacing: "1.5px",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              {isExpanded ? "Less" : "More"}
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "12px" }}>
          <span
            style={{
              border: `1px solid ${signalStyle.border}`,
              background: signalStyle.bg,
              color: signalStyle.text,
              padding: "4px 7px",
              fontSize: "10px",
              letterSpacing: "1.5px",
              textTransform: "uppercase",
            }}
          >
            {item.signal}
          </span>
          <span
            style={{
              border: `1px solid ${COLORS.border}`,
              color: COLORS.blue,
              padding: "4px 7px",
              fontSize: "10px",
              letterSpacing: "1.5px",
              textTransform: "uppercase",
            }}
          >
            {item.confidence} confidence
          </span>
          <span
            style={{
              border: `1px solid ${COLORS.border}`,
              color: COLORS.textDim,
              padding: "4px 7px",
              fontSize: "10px",
              letterSpacing: "1.5px",
              textTransform: "uppercase",
            }}
          >
            Last trade {formatAgeLabel(item.lastTradeAgeMinutes)} ago
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: "8px 12px",
            fontSize: "12px",
            marginBottom: isExpanded ? "12px" : 0,
          }}
        >
          <div>
            <div style={{ color: COLORS.textMuted, marginBottom: "3px" }}>Buy</div>
            <button
              type="button"
              onClick={() => copyText(fmtExactGp(item.buy), `Copied buy price: ${fmtExactGp(item.buy)}`)}
              title="Copy exact buy price"
              style={{
                color: COLORS.text,
                background: "none",
                border: "none",
                padding: 0,
                font: "inherit",
                cursor: "pointer",
              }}
            >
              {fmtGp(item.buy)}
            </button>
          </div>
          <div>
            <div style={{ color: COLORS.textMuted, marginBottom: "3px" }}>Sell</div>
            <button
              type="button"
              onClick={() => copyText(fmtExactGp(item.sell), `Copied sell price: ${fmtExactGp(item.sell)}`)}
              title="Copy exact sell price"
              style={{
                color: COLORS.text,
                background: "none",
                border: "none",
                padding: 0,
                font: "inherit",
                cursor: "pointer",
              }}
            >
              {fmtGp(item.sell)}
            </button>
          </div>
          <div>
            <div style={{ color: COLORS.textMuted, marginBottom: "3px" }}>Profit</div>
            <div style={{ color: COLORS.green }}>+{fmtGp(item.profit)}</div>
          </div>
          <div>
            <div style={{ color: COLORS.textMuted, marginBottom: "3px" }}>ROI</div>
            <div style={{ color: item.roi >= 15 ? COLORS.goldSoft : COLORS.text }}>
              {fmtPercent(item.roi)}
            </div>
          </div>
        </div>

        {isExpanded ? (
          <div
            style={{
              borderTop: `1px solid ${COLORS.border}`,
              paddingTop: "12px",
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "10px 12px",
              fontSize: "12px",
            }}
          >
            <div>
              <div style={{ color: COLORS.textMuted, marginBottom: "3px" }}>Tax</div>
              <div style={{ color: COLORS.red }}>{fmtGp(item.tax)}</div>
            </div>
            <div>
              <div style={{ color: COLORS.textMuted, marginBottom: "3px" }}>Volume / hr</div>
              <div style={{ color: COLORS.text }}>{fmtGp(item.volume)}</div>
            </div>
            <div>
              <div style={{ color: COLORS.textMuted, marginBottom: "3px" }}>Stale side</div>
              <div style={{ color: COLORS.text }}>{formatAgeLabel(item.staleSideAgeMinutes)}</div>
            </div>
            <div>
              <div style={{ color: COLORS.textMuted, marginBottom: "3px" }}>Buy limit</div>
              <div style={{ color: COLORS.text }}>{item.limit > 0 ? fmtGp(item.limit) : "--"}</div>
            </div>
            <div>
              <div style={{ color: COLORS.textMuted, marginBottom: "3px" }}>Limit profit</div>
              <div style={{ color: COLORS.blue }}>
                {item.limitProfit > 0 ? fmtGp(item.limitProfit) : "--"}
              </div>
            </div>
          </div>
        ) : null}
      </article>
    );
  }

  const styles = {
    overlay: {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.68)",
      backdropFilter: "blur(4px)",
      opacity: isOpen ? 1 : 0,
      pointerEvents: isOpen ? "auto" : "none",
      transition: "opacity 0.25s ease",
      zIndex: 9998,
    },
    panel: {
      position: "fixed",
      left: "50%",
      bottom: "12px",
      width: "min(1120px, calc(100vw - 24px))",
      maxHeight: "calc(100vh - 24px)",
      transform: isOpen ? "translate(-50%, 0)" : "translate(-50%, 105%)",
      transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
      border: `1px solid ${COLORS.borderWarm}`,
      background:
        "radial-gradient(circle at top, rgba(212,175,55,0.08) 0%, rgba(12,12,12,0.98) 28%, rgba(7,7,7,0.99) 100%)",
      boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      zIndex: 9999,
      color: COLORS.text,
      fontFamily: "'Courier New', monospace",
    },
    toolbarButton: (active) => ({
      padding: "6px 10px",
      border: `1px solid ${active ? COLORS.borderLit : COLORS.border}`,
      background: active ? "#1b160b" : "transparent",
      color: active ? COLORS.goldSoft : COLORS.textDim,
      fontFamily: "inherit",
      fontSize: "10px",
      letterSpacing: "1.5px",
      textTransform: "uppercase",
      cursor: "pointer",
    }),
  };

  return (
    <>
      <div style={styles.overlay} onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Merchant utility" style={styles.panel}>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "10px 0 6px",
            cursor: "pointer",
          }}
          onClick={onClose}
        >
          <div
            style={{
              width: "46px",
              height: "4px",
              borderRadius: "999px",
              background: COLORS.textMuted,
            }}
          />
        </div>

        <div
          style={{
            padding: "0 20px 18px",
            borderBottom: `1px solid ${COLORS.border}`,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "16px",
              alignItems: "flex-start",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "10px",
                  letterSpacing: "4px",
                  color: COLORS.gold,
                  textTransform: "uppercase",
                  marginBottom: "8px",
                }}
              >
                Merchant Utility
              </div>
              <div
                style={{
                  fontFamily: DISPLAY_FONT,
                  fontSize: "28px",
                  lineHeight: 1,
                  letterSpacing: "0.8px",
                  color: COLORS.goldSoft,
                  textTransform: "uppercase",
                  marginBottom: "10px",
                }}
              >
                Grand Exchange Desk
              </div>
              <div style={{ maxWidth: "640px", fontSize: "12px", color: COLORS.textDim, lineHeight: 1.7 }}>
                Built into Mettle as an optional utility. It keeps its own watchlist, fetches only while this panel is open and visible,
                never touches your run save, and now filters out stale or thin spreads before ranking by confidence, margin, ROI, and liquidity.
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => loadBoard()}
                style={styles.toolbarButton(false)}
                disabled={refreshing}
              >
                {refreshing ? "Refreshing" : "Refresh"}
              </button>
              <button type="button" onClick={onClose} style={styles.toolbarButton(false)}>
                Close
              </button>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
              marginTop: "18px",
            }}
          >
            <StatPill label="Profitable items" value={items.length.toLocaleString()} accent={COLORS.goldSoft} />
            <StatPill label="Ready now" value={readyCount.toLocaleString()} accent={COLORS.green} />
            <StatPill
              label="Lead pick profit"
              value={topScore ? `+${fmtGp(topScore.profit)}` : "--"}
              accent={COLORS.green}
            />
            <StatPill label="Avg confidence top 25" value={averageConfidence ? `${averageConfidence}%` : "--"} accent={COLORS.blue} />
          </div>
        </div>

        <div
          style={{
            padding: "14px 20px",
            borderBottom: `1px solid ${COLORS.border}`,
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search profitable items..."
            style={{
              flex: "1 1 220px",
              minWidth: "180px",
              background: COLORS.panel,
              border: `1px solid ${COLORS.border}`,
              color: COLORS.text,
              padding: "8px 12px",
              fontFamily: "inherit",
              fontSize: "13px",
              outline: "none",
            }}
          />

          <button
            type="button"
            onClick={() => setActiveTab("all")}
            style={styles.toolbarButton(activeTab === "all")}
          >
            All items
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("watchlist")}
            style={styles.toolbarButton(activeTab === "watchlist")}
          >
            Watchlist ({watchlist.length})
          </button>

          <div
            style={{
              display: "flex",
              gap: "6px",
              flexWrap: "wrap",
              marginLeft: "auto",
            }}
          >
            {Object.keys(SORT_LABELS).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setSortBy(key)}
                style={styles.toolbarButton(sortBy === key)}
              >
                {SORT_LABELS[key]}
              </button>
            ))}
          </div>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "18px 20px 12px",
            background: "linear-gradient(180deg, rgba(255,255,255,0.01) 0%, rgba(7,7,7,0.99) 100%)",
          }}
        >
          {loading && !hasItems ? (
            <div
              style={{
                border: `1px solid ${COLORS.border}`,
                padding: "32px 18px",
                textAlign: "center",
                color: COLORS.textDim,
                fontSize: "13px",
              }}
            >
              Loading the merchant desk...
            </div>
          ) : null}

          {error ? (
            <div
              style={{
                border: `1px solid ${COLORS.border}`,
                background: "rgba(127, 29, 29, 0.15)",
                color: COLORS.red,
                padding: "12px 14px",
                fontSize: "12px",
                marginBottom: "16px",
              }}
            >
              {error}
            </div>
          ) : null}

          {!loading && hasItems && activeTab === "all" && !normalizedSearch ? (
            <>
              {readyNow.length ? (
                <Section label="Ready now" detail="High-confidence picks with decent freshness and volume">
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                      gap: "10px",
                    }}
                  >
                    {readyNow.map(renderCard)}
                  </div>
                </Section>
              ) : null}

              {worthChecking.length ? (
                <Section label="Worth checking" detail="Reasonable candidates, but worth a manual glance before trusting the spread">
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                      gap: "10px",
                    }}
                  >
                    {worthChecking.map(renderCard)}
                  </div>
                </Section>
              ) : null}

              {longShots.length ? (
                <Section label="Long shots" detail="Fresh enough to keep on the board, but not strong enough for an automatic green light">
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                      gap: "10px",
                    }}
                  >
                    {longShots.map(renderCard)}
                  </div>
                </Section>
              ) : null}

              {!readyNow.length && !worthChecking.length && !longShots.length ? (
                <div
                  style={{
                    border: `1px solid ${COLORS.border}`,
                    padding: "24px 16px",
                    color: COLORS.textDim,
                    fontSize: "13px",
                  }}
                >
                  Nothing cleared the current freshness and liquidity guardrails. Try search or check back on the next refresh.
                </div>
              ) : null}
            </>
          ) : null}

          {!loading && hasItems && (activeTab === "watchlist" || normalizedSearch) ? (
            <Section
              label={activeTab === "watchlist" ? "Tracked items" : "Search results"}
              detail={
                activeTab === "watchlist"
                  ? "Your watchlist is stored separately from the run save."
                  : `${filteredItems.length.toLocaleString()} matches`
              }
            >
              {surfacedItems.length > 0 ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                    gap: "10px",
                  }}
                >
                  {surfacedItems.map(renderCard)}
                </div>
              ) : (
                <div
                  style={{
                    border: `1px solid ${COLORS.border}`,
                    padding: "24px 16px",
                    color: COLORS.textDim,
                    fontSize: "13px",
                  }}
                >
                  {activeTab === "watchlist"
                    ? "No tracked items yet. Use Track on any card to pin it here."
                    : "No profitable items match that search right now."}
                </div>
              )}
            </Section>
          ) : null}

          {!loading && !hasItems ? (
            <div
              style={{
                border: `1px solid ${COLORS.border}`,
                padding: "24px 16px",
                color: COLORS.textDim,
                fontSize: "13px",
              }}
            >
              No profitable items were returned from the current cache.
            </div>
          ) : null}
        </div>

        <div
          style={{
            borderTop: `1px solid ${COLORS.border}`,
            padding: "10px 20px 12px",
            display: "flex",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
            fontSize: "10px",
            letterSpacing: "2px",
            textTransform: "uppercase",
            color: COLORS.textMuted,
          }}
        >
          <span>Last update {formatTimeLabel(cachedAt)}</span>
          <span>Refresh cycle {countdown}s while open</span>
        </div>
        {copyMessage ? (
          <div
            aria-live="polite"
            style={{
              position: "absolute",
              right: "20px",
              bottom: "58px",
              maxWidth: "min(420px, calc(100% - 40px))",
              border: `1px solid ${COLORS.borderLit}`,
              background: "rgba(12, 12, 12, 0.96)",
              color: COLORS.green,
              padding: "10px 12px",
              fontSize: "11px",
              lineHeight: 1.5,
              boxShadow: "0 10px 30px rgba(0,0,0,0.28)",
              pointerEvents: "none",
              zIndex: 2,
            }}
          >
            {copyMessage}
          </div>
        ) : null}
      </div>
    </>
  );
}
