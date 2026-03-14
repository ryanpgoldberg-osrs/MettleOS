# Mettle Account Sync Plan

## Goal

Make the Mettle RuneLite plugin the default import path for the whole account snapshot:

- player identity
- skills
- boss killcounts
- quests
- achievement diaries

Wise Old Man remains a fallback, not the primary source of truth.

## Repo Layout

- `app/`
  - Next.js web app
- `components/`
  - web app systems and local sync parsing
- `runelite-plugin/`
  - Mettle RuneLite plugin project
- `sync-contract/`
  - canonical JSON schema and example payloads
- `docs/`
  - rollout notes and implementation plans

## Contract

Canonical payload:

- `format`
- `version`
- `source`
- `syncedAt`
- `player`
- `skills`
- `bosses`
- `quests`
- `achievementDiaries`

Files:

- `sync-contract/mettle-account-sync-v1.schema.json`
- `sync-contract/mettle-account-sync-v1.example.json`

## Web App Status

The app can now:

- import a full account sync JSON file from the entry screen
- import a full account sync JSON file into an existing run
- persist synced quest and diary state in local save data
- validate payloads through `/api/account-sync`

The app still does not have server-side user accounts or linked sync sessions, so direct plugin upload is not the live path yet.

## Plugin Status

The plugin scaffold now has:

- real quest completion collection through RuneLite quest state APIs
- real achievement diary tier completion collection through diary varbits
- account sync export assembly for player, skills, quests, and diaries
- full boss registry output
- manual export through a plugin sidebar panel
- a clear seam for boss KC to come from official HiScores instead of plugin capture

## Plugin Rollout

1. Build local export first.
2. Make export the default user flow.
3. Add direct upload only after the web app has a server-side sync target.
4. Promote quest and diary state into rule-backed task generation.

## Why Include Achievement Diaries Now

Mettle does not yet generate diary-based tasks, but diary sync belongs in v1 because:

- RuneLite can surface the data in the same plugin session.
- it avoids a future breaking change to the sync contract
- diaries are a natural source for unlock, breadth, and regional progression tasks
