# Mettle RuneLite Plugin

This project exports a `mettle-account-sync` snapshot from RuneLite for use in Mettle.

## What It Syncs

The plugin is the primary source for:

- player identity
- skills
- quests
- achievement diaries

Boss killcounts are not captured directly by the plugin. The Mettle web app enriches boss KC after import by looking up the same RSN through Wise Old Man.

## Contract

The plugin emits the `mettle-account-sync` v1 payload. A local copy of the contract lives in:

- `docs/mettle-account-sync-v1.schema.json`
- `docs/mettle-account-sync-v1.example.json`

## Current State

The project already includes:

- RuneLite plugin entrypoint and config
- manual export UI in the sidebar
- quest completion collection
- achievement diary tier collection
- stable snapshot assembly for Mettle import

## Build

Use the Gradle wrapper:

```bash
env JAVA_HOME=/opt/homebrew/opt/openjdk@17 GRADLE_USER_HOME=/path/to/local/.gradle-home ./gradlew build
```

If `JAVA_HOME` is not set, macOS may fall back to the system Java shim instead of the brewed JDK.

## Local Flow

1. Build and run the plugin locally.
2. Export `mettle-account-sync` JSON from the plugin panel.
3. Import that file into the Mettle web app.
4. Let the web app enrich boss KC automatically through Wise Old Man.

## Publishing Notes

This repo is intended to become the standalone source for a RuneLite Plugin Hub submission. Before submitting, make sure these are set:

- `support` in `runelite-plugin.properties`
- repository metadata and license
- release-ready README screenshots or usage notes if desired
