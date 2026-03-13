# Mettle Quest Sync Plan

## Why a Mettle Plugin

Wise Old Man gives Mettle the right public account surface for skills and boss KC, but it does not expose per-quest completion. That makes quest writs, quest-point deltas, forks, and Quest Cape verification impossible to back with real account state.

The safest path is a Mettle-owned RuneLite plugin that reads quest state locally and exports or uploads it using a Mettle contract we control.

## Current Decision

- Do not depend on OSRS Wiki WikiSync as a production dependency.
- Do not depend on third-party profile sites as a source of truth.
- Use a Mettle-owned quest sync format and ingestion path.

## Repo Groundwork Added Here

- `questState` is now part of the saved Mettle run.
- The browser app can import a quest sync JSON payload into local save state.
- `/api/quest-sync` validates and normalizes plugin payloads for development.

This is intentionally a bridge step. The app still uses local browser saves, so the API route does not persist sync data yet.

## Proposed Plugin Payload

```json
{
  "format": "mettle-quest-sync",
  "version": 1,
  "source": "mettle-runelite-plugin",
  "syncedAt": "2026-03-13T18:30:00.000Z",
  "player": {
    "rsn": "Example Player",
    "accountType": "STANDARD"
  },
  "quests": {
    "completedQuestIds": ["cook_s_assistant", "dragon_slayer_i"],
    "startedQuestIds": ["desert_treasure_ii"],
    "questPoints": 205,
    "questCapeDetected": false
  }
}
```

## Recommended Rollout

1. Build the RuneLite plugin to export the payload above.
2. Use JSON import in the app while Mettle remains local-save only.
3. Add sync sessions or authenticated accounts on the web app.
4. Upgrade the plugin from file export to direct upload.
5. Make quest writs rule-backed using synced quest state.

## Direct Sync Requirement

Direct plugin-to-web sync needs one more system the current prototype does not have:

- a server-side store for quest snapshots
- a way to link a browser session or user account to a plugin upload

Until that exists, JSON import is the safest low-friction bridge.
