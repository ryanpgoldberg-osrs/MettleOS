# METTLE — The OSRS Contract Skill

> *Your account has been avoiding things. Mettle finds them, names them, and makes you face them.*

Mettle is a custom skill layered on top of Old School RuneScape. It is both a YouTube/streaming format and a playable web tool that generates account-specific tasks from your actual stats and boss history.

The core idea is simple: your account already tells a story about what you delay, ignore, and avoid. Mettle turns that story into a ledger.

---

## What Is Mettle?

You enter your RSN. The app pulls your account through the Wise Old Man API, maps your skills and boss KC into a local account model, and drafts personalized tasks based on account gaps, untouched bosses, progression state, and recent history.

You draft from a small set of tasks and choose one. The unchosen tasks fall out of the current draw and can return later. The chosen task becomes active. Complete it cleanly and you gain full rewards. Defer too many and you build debt. Push that too far and reckoning pressure begins to form around the categories you keep dodging.

Mettle tracks its own progression as **Mettle XP** across five deity tiers toward level 99. Along the way it introduces Trials, Forks, Landmarks, debt pressure, and finally a path-based Final Trial.

The app now calls the main surface the **ledger**, not the board.

---

## Current Product Flow

1. Fresh visit: cold open landing -> RSN input or manual entry -> ledger.
2. Returning visit: saved run detected in `localStorage` -> ledger opens immediately.
3. Reset run: saved state is cleared and the app returns to the entry screen.

Current save key:

- `mettle_run_v8`

---

## The Skill

Mettle is framed as a custom 24th OSRS skill.

The live account model currently tracks:

- `24` skills
- `69` bosses

### Tier Structure

| Tier | Levels | Current Pool | Theme |
|---|---:|---:|---|
| Guthix | 1–20 | 55 tasks | Foundation, first avoidance patterns |
| Saradomin | 21–40 | 58 tasks | Discipline, structure, first larger asks |
| Bandos | 41–60 | 59 tasks | Combat escalation, account force |
| Zamorak | 61–80 | 53 tasks | Chaos, punishment, pressure systems |
| Zaros | 81–99 | 50 tasks | Mastery, pathing, endgame pressure |

Total live pool:

- `265` non-trial tasks
- `10` Trials

### Mettle XP Curve

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

### Unlocks

| Level | Unlock |
|---|---|
| 10 | Trials |
| 20 | Draft (3 options) |
| 40 | Endurance Tasks |
| 60 | Elite modifiers |
| 80 | Mythic pressure |

---

## Draft System

### Draft Sizes

| State | Draft Size |
|---|---:|
| Normal | 3 |
| Cursed | 2 |
| Favored | 4 |
| Hot Streak | 4 |
| Final Trial | 5 |

### Important Rules

- Unchosen tasks are **not** permanently deleted. They only leave the current draw.
- Most completed tasks leave the pool permanently.
- Tasks marked `repeatable` can return later.
- Recent draft history is suppressed to reduce repetition.
- Favored state is currently granted by Trial completion, not by clearing debt.

---

## Debt, Cursed, Reckoning

### Debt

- Deferring a task moves it into the debt queue.
- Debt cap is `3`.
- Hitting the cap forces cleanup before drafting can continue.
- Tier advancement is blocked at gates if debt or reckoning is unresolved.

### Cursed

- Any debt puts the run into a cursed draft state.
- Cursed drafts shrink to `2` options.
- Deferring a task breaks favored state immediately.

### Reckoning

- Reckoning is category-based pressure triggered by repeated defers.
- Warning starts at `2` defers in a category.
- At `3`, a reckoning task can be created for that category.
- Reckoning tasks must be cleared before drawing or advancing.

### Debt / Reckoning Recovery Rewards

Recovery is intentionally weaker than clean completion:

- Clearing a deferred task gives **half XP**
- Completing a reckoning task gives **half XP**
- Neither gives seals
- Neither increases streak

---

## Trials, Forks, Landmarks

### Trials

Trials are milestone tasks that auto-trigger and bypass the normal draft.

Live trial levels:

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

Trials are dynamic where possible. Early and late trials can resolve against account state, boss history, and untouched content rather than always pointing at one fixed challenge.

### Landmarks

Landmarks auto-trigger when their condition is met, except where manual confirmation is required.

Current landmarks:

- First Level 99
- Quest Cape
- Total Level 1900
- First Raid Completion

Quest Cape is currently manual because WOM data does not let the app verify full quest completion directly.

### Forks

Forks are rare, major choices where one branch is accepted and the other is permanently rejected.

Current fork set:

| Fork | Option A | Option B | Tier |
|---|---|---|---|
| The Ancient Path | Desert Treasure II | Dragon Slayer II | Zamorak |
| The Elven Choice | Song of the Elves | Sins of the Father | Zamorak |
| The Endgame | Tombs of Amascut (Full) | Theatre of Blood (Full) | Zaros |
| The Final Reckoning | The Inferno | The Nightmare | Zaros |

### Final Trial Paths

At the top end of the run, Mettle assigns a path from account history:

- Warrior
- Scholar
- Survivor
- Balanced

Each path has its own `8`-task pool, and the Final Trial draws `5` from that pool.

---

## Task Categories

| Category | Description |
|---|---|
| PvM Intro | First boss interactions, low-KC bosses, first real combat asks |
| PvM Endurance | Sustained KC, harder PvM volume, repeated boss pressure |
| Quest | Quest completions and major quest-chain asks |
| Skill Gap | Dynamic skill-gap and account-average pressure |
| Exploration | Unlocks, access, movement, area and system asks |
| Endurance | Time-based, volume-based, or streak-based asks |
| Economic | Profit, production, or trade-centered asks |
| Trial | Milestone tasks that bypass the normal draft |

---

## Generator Logic

### Data Source

RSN input -> local API route -> Wise Old Man refresh + fetch

Current live pull includes:

- all `24` tracked skills
- tracked boss KC
- normalized display name

Manual entry is also supported for skills and boss KC.

### Skill Gap Logic

The app still uses account-average logic, but the task sizing is now more dynamic than the original pitch.

Notable updates:

- fixed `+5` style level-gain tasks were replaced with level-band scaling
- high-level skill tasks can switch from levels to XP chunks
- gap-closing tasks no longer always force a skill all the way to account average

### Weighting

Draft weighting currently considers:

- tier eligibility
- completion status
- recent draft suppression
- account skill gaps
- combat average
- touched boss count
- total boss KC
- boss-specific low-KC bonuses

Bossing is now more account-aware:

- fresh zero-KC accounts are pushed more toward intro bossing
- endurance PvM is suppressed early
- every tracked boss is capable of surfacing over time

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend + Hosting | Next.js on Vercel |
| App Framework | React 19 + App Router |
| Language | TypeScript + JSX components |
| Styling | Mostly inline styles |
| Fonts | Self-hosted display fonts in `public/fonts` |
| Data Source | Wise Old Man API |

Current note:

- Supabase is **not** part of the current implementation.
- Tailwind is installed but the main app is styled primarily with inline styles.

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

### Environment Variables

The current app does not require project-level environment variables for the core local flow shown in the repo.

The Wise Old Man calls are made from the app route at:

- `app/api/player/[rsn]/route.ts`

---

## Project Structure

```text
app/
  api/player/[rsn]/route.ts   Wise Old Man refresh + normalized player payload
  layout.tsx                  App shell
  page.tsx                    Entry gating + main app mount

components/
  EntryScreen.jsx             Cold open + RSN/manual intake
  MettlePrototype.jsx         Main ledger experience
  data/                       Task pool, tiers, forks, landmarks, final trial pools
  systems/                    Drafting and progression logic
  utils/                      Persistence, labels, modifiers, helpers

public/fonts/
  runescape_uf.*
  Silkscreen-Regular.ttf
```

---

## Project Status

| Item | Status |
|---|---|
| Name and framing | ✅ Live |
| Entry screen | ✅ Live |
| Ledger UI | ✅ Live |
| Wise Old Man intake | ✅ Live |
| Manual stat fallback | ✅ Live |
| Debt / cursed / reckoning loop | ✅ Live |
| Trials | ✅ Live |
| Forks | ✅ Live |
| Landmarks | ✅ Live |
| Final Trial paths | ✅ Live |
| Dynamic skill-gap balancing | ✅ Live |
| Mobile pass | ✅ Improved, ongoing |
| README accuracy | ✅ Updated to current behavior |

---

*METTLE — living document, updated for the current app state.*
