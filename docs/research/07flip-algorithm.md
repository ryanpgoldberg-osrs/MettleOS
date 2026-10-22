# 07Flip research and Merchant filters

Reviewed October 21, 2026. This describes public claims and inspected client code, not an independent validation of performance.

## What is public

- The [About page](https://07flip.com/about) publishes four confidence inputs: hourly volume 40%, price volatility 30%, spread quality 20%, freshness 10%. It identifies OSRS Wiki real-time prices and mapping, plus Weird Gloop daily volume as data sources. It claims tuning against actual outcomes but does not supply an evaluation dataset or performance statistics on that page.
- The [flip-finder explanation](https://07flip.com/osrs-flip-finder) says both live sides must have traded in the last 30 minutes. It describes post-tax margin, ROI and buy-limit-based potential profit/hour. Its prose uses different broad score cutoffs (70 and 65); neither is evidence of a calibrated fill probability.
- The [plugin guide](https://07flip.com/runelite) distinguishes reported live prices from Premium recommended prices. It describes the round-trip ETA as approximate, and cycle/potential profit as per-item profit multiplied by the four-hour buy limit. That is different from our quantity-constrained 30-minute batch estimate. It documents capital, volume, price, profit, F2P and tax filters plus category presets. Tax-free is a property of the tax calculation, including rounding/exemptions; it is not a low-risk label.
- The [Plan page](https://07flip.com/plan) describes allocation using bankroll, GE slots, trading style, a fill window, hourly volume and buy limits. It states that recommended prices target recent-hour trading and short-term flips, rather than overnight holds. It does not disclose exact participation assumptions, slippage assumptions, optimization objective or historical validation.

## Source-code boundary

RuneLite's [Plugin Hub descriptor](https://github.com/runelite/plugin-hub/blob/master/plugins/07flip) identifies `UserD40/Runelite07Flip` as the plugin repository. The inspected [API client at commit 8443f15](https://github.com/UserD40/Runelite07Flip/blob/8443f15f0ef9e75d76d5092102176559a5b05498/src/main/java/com/o7flip/O7FlipApiClient.java) builds `/v2/flips` requests with presets, sort, profit, price and cash-stack parameters and parses returned flip rows. It reads item score/confidence/tier fields from API responses and posts inputs to an optimization endpoint. These methods establish that results are supplied by the service; they do not reveal the server's scoring implementation.

The public percentages alone are insufficient to reproduce the model: normalization curves, lookback windows, penalties, missing-data rules and recommended-price generation remain unspecified in these sources. We should not label our score “07Flip Score,” interpret it as a success probability, or copy the marketing claim that an observed margin is money a future trade will definitely make.

## Applied to Merchant

Added client-side filters before sorting and result truncation. They narrow candidates without changing the engine, sizing or signal:

- Category: all signals, Ready only, low price instability (<0.18 snapshot-vs-hourly metric), or bulk (100+ modeled items).
- Batch capital bands use `capitalRequired` for the whole existing batch, not unit price and not a bankroll that resizes quantity. Bands are lower-inclusive and upper-exclusive.
- Minimum slower-side hourly flow, buy price, and modeled after-tax batch profit.
- Both-side freshness limits, Members/all vs F2P-only, tax-free only, fresh hourly flow only, and positive modeled quantity.
- Removable chips, match count, clear controls, a Cleaner spreads preset, and Show more for filtered results.

Defaults: 100+ gp buy price, 100+ slower-side flow/hour, both quote sides within 30 minutes, positive modeled quantity (which requires fresh flow; five-minute estimates are allowed). Cleaner spreads additionally requires Ready, 500+ slower-side flow/hour, and both quote sides within 10 minutes. These are transparent screening choices, not empirically proven optimal thresholds. A minimum 100 gp price can exclude valid cheap bulk trades; clear that chip to include them.

No momentum, oversold, historical-volatility, or volume-spike preset was added: the current server response does not contain enough historical data to support those labels. Filtering is a discovery improvement, not validation that fills or profits will occur.
