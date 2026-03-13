# Mettle RuneLite Plugin

This subproject is the future default intake path for Mettle account sync.

## Scope

The plugin will export a unified Mettle snapshot containing:

- player identity
- skills
- boss killcounts
- quests
- achievement diaries

The canonical payload lives in:

- `../sync-contract/mettle-account-sync-v1.schema.json`
- `../sync-contract/mettle-account-sync-v1.example.json`

## Current State

This is a scaffold for the plugin project:

- basic RuneLite plugin structure
- config surface
- export service
- sidebar panel with manual export button
- real quest completion collection
- real achievement diary tier collection
- boss payload keyed to the full Mettle boss registry
- clear seam for bosses to come from official HiScores instead of plugin capture

The next implementation pass should wire the web side to official HiScores for boss KC and keep the plugin focused on quests and diaries.

## Tooling Note

This subproject now includes a Gradle wrapper. On March 13, 2026, the plugin scaffold was compiled successfully after installing Homebrew `openjdk@17` and `gradle`.

Use:

- `env JAVA_HOME=/opt/homebrew/opt/openjdk@17 GRADLE_USER_HOME=/path/to/local/.gradle-home ./gradlew build`

If `JAVA_HOME` is not set, macOS may fall back to the system Java shim and fail to find the brewed JDK.

## Recommended Flow

1. Build and run the plugin locally.
2. Export `mettle-account-sync` JSON.
3. Import that file into the Mettle web app.
4. Later, upgrade to direct upload once the web app supports linked sync sessions.
