# METTLE — The OSRS Contract Skill

> *Your account has been avoiding things. Mettle finds them, names them, and makes you face them publicly.*

Mettle is a custom skill layered on top of Old School RuneScape. It is both a **YouTube/streaming series** and a **playable web tool** for other players. A personalized contract board generates challenges weighted against your specific account gaps — the things your stats say you should be able to do, but haven't.

---

## What Is Mettle?

You enter your RSN. The tool pulls your stats via the [Wise Old Man API](https://docs.wiseoldman.net/api). It calculates your account's gaps — skills neglected, bosses untouched, quests avoided — and generates a **Contract Board** of personalized challenges.

You draft from three contracts. You choose one. The others are gone permanently. You complete it, fail it, or partially complete it. Fail too many and you go into **Debt**. Accumulate enough and you become **Cursed** — your drafts get worse. Clear your debt and earn **Favor** — your drafts improve.

The skill tracks your progress as **Mettle XP**, structured through five deity-named tiers toward level 99. The series finale is determined by a Final Trial that chooses your path.

---

## The Skill

Mettle is framed as a custom 24th skill. Every OSRS player immediately understands the stakes.

### Tier Structure

| Tier | Levels | Contracts | Theme |
|---|---|---|---|
| Guthix | 1–20 | ~35 | Foundation — awakening the account |
| Saradomin | 21–40 | ~40 | Discipline — first real trials |
| Bandos | 41–60 | ~40 | Strength — combat escalation |
| Zamorak | 61–80 | ~45 | Chaos — difficult modifiers |
| Zaros | 81–99 | ~30 | Mastery — elite content, series finale |

**Total pool: 190 contracts. ~67,000 XP to reach level 99.**  
A given run will see 80–120 contracts. Two players with different accounts will have meaningfully different series.

### XP Structure

| Difficulty | XP Reward | Seal Color |
|---|---|---|
| Easy | 50–100 XP | Bronze |
| Medium | 150–300 XP | Silver |
| Hard | 400–700 XP | Gold |
| Elite | 1,000+ XP | Black |

### Completion States

| Result | XP | Debt |
|---|---|---|
| Full completion | 100% | None |
| Partial completion | 50% | None |
| Failure | 0% | Contract enters Debt Queue |

---

## Contract System

### Draft System
- **Normal:** 3 options (default)
- **Cursed:** 2 options — active when debt cap (3) is reached
- **Favored:** 5 options — earned through streaks, Trial completions, or debt clearance

### Debt System
- Debt cap: **3 contracts**
- At cap: player becomes **Cursed**, Favored state blocked
- Debt must be cleared before advancing to each tier milestone (levels 20 / 40 / 60 / 80)

### Trials
Milestone contracts at every 10–20 levels. Auto-triggered. Cannot be drafted around. Non-skippable. These are the episode tentpoles.

| Level | Trial |
|---|---|
| 10 | Obor or Bryophyta — first real boss |
| 20 | Barrows completion |
| 30 | First Fire Cape attempt |
| 40 | First Zulrah kill |
| 50 | Dragon Slayer II |
| 60 | First raid — Chambers of Xeric |
| 70 | Vorkath with modifier |
| 80 | Endgame boss (account-dependent) |
| 90 | Elite challenge (account-dependent) |
| 99 | The Final Trial |

### Landmark Contracts
Auto-trigger on condition. Cannot be drafted around. Distinct visual treatment on the board.

| Landmark | Trigger |
|---|---|
| First 99 | Reach level 99 in any skill |
| Quest Cape | Complete all quests |
| Total Level 1900 | Reach 1900 total level |
| First Raid Completion | Complete any raid |

### Fork Contracts
Two significant objectives — choose one, the other is permanently gone. Reserved for major quests. ~4 across the entire series. Audience debate moments.

| Fork | Option A | Option B | Tier |
|---|---|---|---|
| The Ancient Path | Desert Treasure II | Dragon Slayer II | Zamorak |
| The Elven Choice | Song of the Elves | Sins of the Father | Zamorak |
| The Endgame | Tombs of Amascut | Theatre of Blood | Zaros |
| The Final Reckoning | Inferno attempt | The Nightmare | Zaros |

---

## Contract Generator Logic

### Data Source
RSN input → [Wise Old Man API](https://docs.wiseoldman.net/api) fetch  
Pulls: all 23 skill levels, boss KC, total level, combat level, quest points (manual fallback).

### Gap Score Formula
```
Skill Gap = (Account Average − Skill Level)
Weight    = Gap ÷ Account Average
```
Scales correctly across different account sizes. A 70 Runecrafting on a 2200 total account is a bigger gap than on a 1400 total.

### Category Weight Multipliers

| Category | Base Weight | Trigger Multiplier |
|---|---|---|
| PvM Intro | 1 | ×3 if combat >85 and boss KC = 0 |
| Quest | 1 | ×2 if QP <250 and total level >1500 |
| Skilling | 1 | ×2 if skill gap >15 |
| Endurance | 1 | ×1.5 if streak ≥ 3 |
| Modifier-heavy | 1 | ×1.5 if Favored status active |

### Boss KC Weighting

| Boss KC | Multiplier |
|---|---|
| 0 KC | ×3 |
| 1–5 KC | ×2 |
| 6–20 KC | ×1 |
| 20+ KC | ×0.5 |

### Anti-Repetition Rules
- Contracts seen in the last 5 drafts: suppressed entirely
- Contracts completed in the last 10: weight ×0.3

### Draft Generation Pipeline
1. **Filter** — tier ≤ player tier, requirements met, not completed
2. **Suppress** — remove recent draft history
3. **Weight** — apply category weight × boss KC weight per contract
4. **Select** — weighted random draw for draft size (2, 3, or 5)

---

## Contract Categories

| Category | Description |
|---|---|
| PvM Intro | First boss interactions, low KC targets, combat milestone unlocks |
| PvM Endurance | Multi-KC requirements, sustained combat challenges |
| Quest | Quest completions, QP milestones, story-driven objectives |
| Skill Gap | Algorithmically targeted — closes distance between account average and low skills |
| Exploration / Systems | Unlocking areas, guilds, spellbooks, travel methods |
| Endurance | Time-based or volume-based grinding challenges |
| Economic | Gold earned through skilling, flipping, or trading |
| Trials | Milestone contracts every 10–20 levels. Non-skippable. Series tentpoles. |
| Fork | Choose between two objectives. Rare. Audience engagement moments. |

---

## The Mettle Crest

The skill icon is a crest that builds visually over the series. At level 1 it is broken and rough. At level 99 it is fully realized. The crest is both the skill icon and the series-long visual payoff.

| Level | Crest State |
|---|---|
| 1 | Broken shield outline — partial, rough |
| 20 | First crest quadrant forged |
| 40 | Second quadrant added |
| 60 | Ornament and engraving appear |
| 80 | Crest nearly complete |
| 99 | Finished crest — series finale visual |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend + Hosting | Next.js on Vercel |
| Backend / Database | Supabase (PostgreSQL, auto-generated API) |
| Styling | Tailwind CSS |
| Data Source | Wise Old Man API |

---

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

```env
NEXT_PUBLIC_WOM_API_BASE=https://api.wiseoldman.net/v2
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## Project Status

| Item | Status |
|---|---|
| Series name | ✅ METTLE |
| Core mechanic | ✅ Contract Board with weighted gap scoring |
| Skill framing | ✅ Custom XP skill — levels, tiers, crest progression |
| Tier structure | ✅ Deity ranks (Guthix → Zaros) |
| Draft system | ✅ 3 options default, 2–5 with modifiers |
| Debt system | ✅ Cap 3, blocks tier milestone at 20/40/60/80 |
| XP states | ✅ 100% / 50% / 0% + debt |
| Trials | ✅ Auto-trigger, bypass draft, named milestones |
| Landmark Contracts | ✅ Quest Cape, First 99, Total 1900, First Raid |
| Fork Contracts | ✅ 4 defined — major quests only |
| Final Trial system | ✅ 4 Paths, 8-contract pools, 5-contract draft at 99 |
| Wilderness rule | ✅ Optional Guthix/Saradomin, mandatory Bandos+ |
| Difficulty seals | ✅ Bronze / Silver / Gold / Black |
| Generator logic | ✅ Gap score, category weights, anti-repetition |
| Guthix contracts | ✅ 35 contracts |
| Saradomin contracts | ✅ 40 contracts |
| Bandos contracts | ✅ 40 contracts |
| Zamorak contracts | ✅ 45 contracts |
| Zaros contracts | ✅ 30 contracts |
| Skill icon (final) | 🔲 Refine placeholder, resolve flame/Firemaking overlap |
| Channel branding | 🔲 Name, logo, color language, typography |
| First video format | 🔲 TBD |
| Figma UI design | 🔲 Board, draft screen, profile card, crest states |
| Web tool MVP build | 🔲 Next.js / Vercel / Supabase |

---

## Build Phases

**Phase 1 — MVP**  
RSN input, contract draft, Mettle level tracker, debt queue. Functional is enough to film.

**Phase 2 — Series**  
Run the series. Update contract list based on what creates good content. Refine weights.

**Phase 3 — Public Launch**  
Launch polished public tool alongside the series reaching Saradomin tier. Add shareable profiles, full board visualization, Path reveal animation.

---

*METTLE — Ryan Goldberg — March 2026 — Living Document*
