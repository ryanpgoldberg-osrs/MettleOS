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

## Result filters

`merchantFilters.ts` defines screening rules shared by the board and regression tests. The filter panel supports signal/instability/bulk category, whole-batch capital bands, slower-side hourly flow, minimum buy price, minimum modeled after-tax batch profit, both-side quote age, F2P, tax-free, fresh hourly flow, and positive modeled quantity. Members includes F2P items. Filter chips can be removed individually; Clear filters restores all API-eligible candidates. Filters apply to search and watchlists too and do not change signals or scores. Filtered lists support Show more; counts and summary statistics reflect the filtered list.

Defaults favor fresh, sized trades: 100+ gp price, 100+ hourly flow, both quotes within 30 minutes, at least one modeled item and current flow (five-minute estimates allowed). Cleaner spreads tightens to Ready, 500+ flow/hour both quotes within 10 minutes and non-estimated hourly flow. Capital bands filter the complete batch's cost; they do not resize the batch to a budget. Settings are scoped to the mounted panel and do not change the ascent save.

See [07Flip research](../../docs/research/07flip-algorithm.md) for source findings and the limits of the comparison.

## Execution details, bankroll, history and actual fills

The sizing model now uses each side separately. Low-side (instant-sell) flow supports passive buys; high-side (instant-buy) flow supports passive sells. For participation P=0.05, buy flow Vb, sell flow Vs, quantity Q and timeframe T:

- Minutes per item = 60/(Vb×P) + 60/(Vs×P).
- Q = floor(min(buy limit, bankroll/buy price when set, T/minutes-per-item)).
- Buy minutes = Q×60/(Vb×P); sell minutes = Q×60/(Vs×P).
- Cycle minutes = max(5, ceil(buy minutes + sell minutes)). No-sized-batch legs are unavailable.

Equal-side flow reproduces the original two-leg formula. Unequal flow no longer charges both legs the slower side's duration. Volumes, timing and participation remain assumptions, not measured execution probabilities. The Available bankroll input accepts exact whole gp; blank removes the cap and zero pauses sizing. Every dependent field (score, confidence, signal, risk, profit, capital and duration) is rebuilt before filtering/sorting. Each candidate uses that budget independently; the board does not allocate a bankroll across several candidates or subtract logged pending buys.

Expanded cards request `/api/prices/history?itemId=...` on demand. The route uses canonical item metadata for tax exemptions and caches per-item hourly series for five minutes with a bounded 200-item cache and coalesced concurrent requests. It examines the last 24 completed UTC hour buckets, retains only buckets with both valid prices and positive volume on both sides, and reports after-tax profitable percentage, crossed percentage, median margin and observed coverage. Fewer than 12 observed hours is explicitly sparse; missing/stale history is not a persistence conclusion. Hourly averages are not simultaneous executable quotes. History is inspection context and does not change the live ranking.

Start flip log snapshots the current model before fills. The separate `mettle_merchant_fills_v1` local-storage journal accepts timestamped buy/sell fills, supports partial fills, matches FIFO cost, taxes every sold item, and compares actual quantity, leg duration and realized net profit with the frozen model. The same-sold-quantity comparison separates changes in unit margin from incomplete sizing. Unsold inventory remains unrealized. Close unfilled, abandoned and partial attempts as well as successful trades. Completed duration ends at the last sell, not the later manual close click; overlapping legs do not get a misleading sequential sell duration. No results automatically recalibrate participation or establish a success rate.

The journal validates saved records by replaying fills, refuses oversells and invalid/future/out-of-order fills, writes storage before showing success, preserves unreadable storage, detects conflicting edits in another tab, and supports JSON export. It is a manual browser-only journal, not RuneLite auto-import or cloud sync. Limits: 500 records / 200 fills per record. Test coverage spans engine resizing, historical sampling/API failures, FIFO accounting and storage validation.
