# METTLE — The OSRS Contract Skill

> *Your account has been avoiding things. Mettle finds them, names them, and makes you face them.*

Mettle is a custom skill layered on top of Old School RuneScape. It is both a YouTube/streaming format and a playable web tool that generates account-specific tasks from your real account state.

The app now uses **task** terminology consistently for the challenge unit, while **ledger** remains the name for the broader progression surface.

---

## What Mettle Is Now

Mettle is no longer just a Wise Old Man prototype with manual entry. The current app combines:

- a local-save ledger with drafting, debt, reckoning, Trials, Forks, Landmarks, and Final Trial paths
- full account sync import for skills, quests, and diaries
- save import/export for whole-run portability
- a companion RuneLite plugin project for long-term sync
- an optional built-in merchant utility for GE flipping

The core loop is still the same: import your account, draw tasks based on what your account has neglected, clear them, and progress toward level 99.

---

## Current Product Flow

1. Fresh visit: choose Wise Old Man, manual entry, or Mettle account sync import.
2. Returning visit: a saved run in `localStorage` opens straight into the ledger.
3. Existing run: import a new sync file, import/export a save, or continue your run.
4. Optional: open the built-in merchant desk without leaving the app.

Current run save key:

- `mettle_run_v8`

Current merchant watchlist key:

- `mettle_merchant_watchlist_v1`

---

## Account Model And Sync

The live account model currently tracks:

- `24` skills
- `69` bosses
- quest completion state
- quest points and Quest Cape detection
- achievement diary sync state

### Intake Paths

| Path | Purpose | Status |
|---|---|---|
| Wise Old Man | skills + boss KC import | Live |
| Manual entry | direct skills + boss KC input | Live |
| `mettle-account-sync` | skills + quests + diaries + metadata | Live |
| `mettle-quest-sync` | quest-only bridge import | Live |
| `mettle-save` | whole-run export/import | Live |

### Current Sync Architecture

- `app/api/account-sync/route.ts` validates full account sync payloads.
- `app/api/quest-sync/route.ts` validates quest sync payloads.
- Imported quest and diary state is saved into the local Mettle run.
- Boss KC is still enriched through Wise Old Man when possible after account-sync import.
- Direct plugin-to-web upload is **not** live yet because the app still uses local browser saves instead of linked server-side accounts.

---

## Task System

### Live Pool

| Tier | Levels | Non-Trial Tasks | Theme |
|---|---:|---:|---|
| Guthix | 1–20 | 66 | Foundation, first weaknesses, first boss pressure |
| Saradomin | 21–40 | 73 | Discipline, structure, first serious escalation |
| Bandos | 41–60 | 75 | Combat force, raid pressure, broader bossing |
| Zamorak | 61–80 | 69 | Chaos, modifiers, debt punishment, fork pressure |
| Zaros | 81–99 | 70 | Mastery, pathing, finale shaping |

Current total pool:

- `353` non-trial tasks
- `10` Trials
- `363` total task-pool definitions
- `126` repeatable tasks

### Task Categories

| Category | Count |
|---|---:|
| Trial | 10 |
| PvM Intro | 54 |
| PvM Endurance | 30 |
| Quest | 93 |
| Exploration | 88 |
| Skill Gap | 47 |
| Endurance | 36 |
| Economic | 5 |

### XP Curve

| Level | XP |
|---|---:|
| 1 | 0 |
| 20 | 2,500 |
| 40 | 9,000 |
| 60 | 22,000 |
| 80 | 45,000 |
| 99 | 85,000 |

Tier gates:

- `20`
- `40`
- `60`
- `80`

### Draft States

| State | Draft Size |
|---|---:|
| Normal | 3 |
| Cursed | 2 |
| Favored | 4 |
| Hot Streak | 4 |
| Final Trial | 5 |

Important live rules:

- Unchosen tasks leave the current draw but can return later.
- Most completed non-repeatable tasks leave the pool permanently.
- Quest-aware drafting now suppresses tasks already satisfied by synced quest or boss progress.
- Favored state is granted for `5` draws after clearing a Trial.

### Debt, Reckoning, And Seals

- Deferring a task adds it to the debt queue.
- Debt cap is `3`.
- Any debt forces the run into a cursed 2-option draft state.
- Reckoning warning starts at `2` defers in a category.
- Reckoning triggers at `3` defers in a category.
- Debt and reckoning recovery only grants half XP, no seals, and no streak growth.

Current seal uses:

- reroll draft: `2` seals
- remove active modifier: `3` seals
- clear deferred task instantly: `4` seals
- buy an extra draft choice: `5` seals

### Trials, Forks, And Landmarks

Trials are milestone tasks that auto-trigger at:

- `10`
- `20`
- `30`
- `40`
- `50`
- `60`
- `70`
- `80`
- `90`
- `99` Final Trial

Current landmarks:

- First Level 99
- Quest Cape
- Total Level 1900
- First Raid Completion

Current forks:

| Fork | Option A | Option B | Tier |
|---|---|---|---|
| The Ancient Path | Desert Treasure II | Dragon Slayer II | Zamorak |
| The Elven Choice | Song of the Elves | Sins of the Father | Zamorak |
| The Endgame | Tombs of Amascut (Full) | Theatre of Blood (Full) | Zaros |
| The Final Reckoning | The Inferno | The Nightmare | Zaros |

Quest Cape is no longer just a manual fallback. If synced quest data says the cape is earned, Mettle can now detect it directly. Forks also react to synced progress and can auto-resolve when both branches are already complete.

---

## Merchant Utility

Mettle now includes an optional built-in **merchant desk** for GE flipping.

Current behavior:

- It opens from the main navigation row inside the app.
- It is lazy-mounted and only polls while open and the page is visible.
- It keeps its own watchlist in `localStorage` and does **not** write into the main Mettle run save.
- It uses `app/api/prices/route.ts`, which fetches OSRS Wiki mapping, latest price, and 1-hour volume data.
- The price route keeps a short in-memory cache and sends cache headers, but it is still per-instance rather than one shared global cache.
- The client only receives trimmed merchant candidates instead of the full market payload.

Related files:

- `app/api/prices/route.ts`
- `components/merchant/MerchantBoard.jsx`
- `components/merchant/MerchantToggle.jsx`
- `components/merchant/README.md`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend + Hosting | Next.js on Vercel |
| App Framework | React 19 + App Router |
| Language | TypeScript entry files plus JSX components |
| Styling | Mostly inline styles |
| Analytics | Vercel Analytics + Speed Insights |
| Public account data | Wise Old Man API |
| Private progression sync | Mettle sync contracts |
| Price data | OSRS Wiki price API |
| Plugin project | Gradle-based RuneLite plugin |

Current notes:

- Supabase is **not** part of the live implementation.
- The app still uses local browser saves rather than server-side user accounts.
- Tailwind is installed but the main product UI is still styled primarily with inline styles.

---

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Useful commands:

```bash
npm run lint
npm run build
```

The current app does not require project-level environment variables for the local flow shown in this repo.

---

## Project Structure

```text
app/
  api/player/[rsn]/route.ts    Wise Old Man refresh + normalized player payload
  api/account-sync/route.ts    Full account sync validation
  api/quest-sync/route.ts      Quest sync validation
  api/prices/route.ts          Merchant price aggregation + caching
  layout.tsx                   App shell + analytics
  page.tsx                     Entry gating + main app mount

components/
  EntryScreen.jsx              Intake flow
  MettlePrototype.jsx          Main ledger experience
  merchant/                    Built-in merchant desk
  data/taskPool.js             Task pool definitions
  systems/                     Drafting and progression logic
  utils/                       Sync parsing, persistence, modifiers, helpers

runelite-plugin/
  README.md                    Plugin build/run notes
  src/main/java/...            Mettle sync plugin source

sync-contract/
  mettle-account-sync-v1.*     Canonical account sync schema + example
```

---

## Project Status

| Item | Status |
|---|---|
| Ledger UI | Live |
| Wise Old Man intake | Live |
| Manual stat fallback | Live |
| Account sync import | Live |
| Quest sync import | Live |
| Save import/export | Live |
| Debt / cursed / reckoning loop | Live |
| Trials | Live |
| Forks | Live |
| Landmarks | Live |
| Final Trial paths | Live |
| Quest-aware drafting | Live |
| Merchant desk | Live |
| RuneLite plugin project | In active development |
| Direct plugin upload | Not live yet |
| Server-side accounts / cloud saves | Not live yet |

---

*METTLE — living document, updated for the current repo state as of March 15, 2026.*
