"use client";

const DISPLAY_FONT = "'RuneScape UF', 'Silkscreen', 'Arial Black', 'Trebuchet MS', 'Arial Narrow', Arial, sans-serif";

export default function MerchantToggle({ isActive = false, onClick, buttonStyle = null }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Open the built-in flipping utility"
      style={{
        ...(buttonStyle || {
          padding: "9px 18px",
          fontFamily: "inherit",
          fontWeight: "700",
          fontSize: "11px",
          letterSpacing: "2px",
          textTransform: "uppercase",
          background: isActive ? "#161616" : "#0f0f0f",
          color: isActive ? "#f3e3a3" : "#9a9a9a",
          border: `1px solid ${isActive ? "#8f7530" : "#272727"}`,
          cursor: "pointer",
          boxShadow: isActive ? "inset 0 1px 0 rgba(255,255,255,0.05), 0 0 18px rgba(212,175,55,0.05)" : "none",
        }),
        fontFamily: buttonStyle?.fontFamily || DISPLAY_FONT,
        whiteSpace: "nowrap",
      }}
    >
      Merchant
    </button>
  );
}
