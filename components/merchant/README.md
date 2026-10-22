# Merchant Utility

The merchant utility is an optional, built-in GE flipping panel that lives inside Mettle. It is intentionally isolated from the core task ledger so the run logic stays clean.

## File map

```text
app/api/prices/route.ts
components/merchant/MerchantBoard.jsx
components/merchant/MerchantToggle.jsx
```

## How it fits the current app

- The trigger lives in Mettle's main `LEDGER / STATS / HISTORY` navigation row, not in an older footer layout.
- The board opens as a slide-up panel over the current ledger, stats, or history view.
- The panel is lazy-mounted from `MettlePrototype.jsx` and only starts polling while it is open and the page is visible.
- The watchlist is stored under its own key: `mettle_merchant_watchlist_v1`.
- The main Mettle run save remains `mettle_run_v8` and is not modified by this utility.
- The board supports click-to-copy on item names and exact buy prices while still displaying shortened values in the card UI.

## Price route behavior

- `app/api/prices/route.ts` fetches OSRS Wiki mapping, latest, and 1-hour volume data.
- The route keeps a per-instance in-memory cache for 60 seconds and sends cache headers for CDN reuse.
- This reduces upstream calls a lot, but it is not a single global cache across every Vercel instance.
- The response is already trimmed to profitable merchant items, so the client does not need to rebuild the whole market list every render.
- The client refresh cadence is 120 seconds while the panel is open and visible.
- The scorer now rejects thin or stale items, caps extreme ROI influence, and adds a `Flip / Caution / Wait` signal plus confidence value for each card.

## Notes

- The route uses the project GitHub URL in the `User-Agent` string so it is not shipping with a fake placeholder contact.
- If you want a different surfacing later, the cleanest swap is changing only the trigger placement in `MettlePrototype.jsx`.

## MettleApps algorithm sync

`marketEngine.ts` ports the Merchant engine's default 30-minute, medium-risk strategy, including its confidence and score weights. The web panel currently keeps that strategy fixed; native profile controls are not ported.

- Latest low/high trades remain paired; hourly averages only measure price instability.
- Tax is 2%, rounded down, capped at 5M per item, with the source engine's confirmed Mind rune and energy-potion exemptions.
- Flow uses the slower side. Quantity assumes 5% participation and divides the plan between buying and selling, capped by the buy limit. The engine also accepts a bankroll for sizing.
- Server timestamps govern flow freshness. Delayed/missing hourly flow falls back to five-minute flow scaled to an hourly estimate; expired flow pauses sizing but retains fresh quotes with Wait.
- Readiness uses modeled batch profit, quote freshness, instability, flow, and assessed risk. Profit sorting ranks that displayed batch estimate before truncation and preserves global order.
- Confidence and profit are heuristic snapshot estimates conditional on both legs filling, not measured probabilities or guaranteed execution.

Regression coverage: `tests/merchantEngine.test.ts` and `tests/merchantPricesRoute.test.ts`.
