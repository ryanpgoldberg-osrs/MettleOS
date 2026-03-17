# Mettle Accusation System Spec

## Purpose

The Accusation System is the narrative layer that sits above normal task drafting.

Tasks answer:

- what the account must do next

Accusations answer:

- what the account is being judged for

This system exists to make the core Mettle premise explicit:

> Your account has been avoiding things. Mettle finds them, names them, and makes you face them.

The goal is not to add another constant interruption. The goal is to create rare, memorable judgments that interpret the account's behavior and turn that behavior into a story beat.

## Core Rule

An accusation may only surface when the board is calm.

This is the defining constraint for the feature. Accusations should feel deliberate, not stacked on top of other pressure systems.

## What "Board Is Calm" Means

The board is calm only when all of the following are true:

- no `activeTask`
- no Trial reveal or active Trial flow
- no active Fork
- no active Landmark
- no active Reckoning task
- no debt lock state
- no tier-gate cleanup block
- no unresolved accusation already active
- no mandatory decision overlay already on screen

In current app terms, an accusation should never appear while any of these are live:

- `activeTask`
- `trialPhase`
- `pendingTrialTask`
- `activeFork`
- `activeLandmark`
- `reckoningTasks.length > 0`
- `mustClearAll`
- `deferredTasks.length >= 3`
- tier gate is blocking progress

Recommended implementation rule:

```ts
const boardIsCalm =
  !activeTask &&
  !trialPhase &&
  !pendingTrialTask &&
  !activeFork &&
  !activeLandmark &&
  reckoningTasks.length === 0 &&
  !mustClearAll &&
  deferredTasks.length < 3 &&
  !gateBlocked &&
  !activeAccusation;
```

## Design Goals

- Strengthen Mettle's identity as a judging system, not just a task generator.
- Create narrative continuity across episodes and sessions.
- Surface account patterns in a way viewers can immediately understand and discuss.
- Avoid overwhelming the player with too many simultaneous "big moments."
- Reuse existing pressure systems where possible instead of inventing parallel punishment layers.

## Non-Goals

- Do not create a second debt system.
- Do not create a second reckoning queue.
- Do not fire accusations as often as normal tasks.
- Do not block the player with multiple unresolved accusations.
- Do not replace Trials, Forks, Landmarks, or Reckonings.

## System Role In The Stack

The Accusation layer sits above:

- task drafting
- defer queue
- reckoning
- trials
- forks
- landmarks
- tier gates

Those systems determine mechanical pressure.

Accusations interpret that pressure and turn it into a narrative judgment about the account.

Simple framing:

- Tasks = what the account must do
- Accusations = what the account is being judged for

## Frequency And Cadence

Accusations should be rare.

Recommended cadence rules:

- at most 1 active accusation at a time
- at most 1 accusation in a short run window
- never immediately after another major board event
- only trigger when a calm window opens

Hard limiter recommendation:

- require a minimum number of completed tasks between accusations
- do not rely on "rare" as tone guidance alone
- prefer in-run spacing over real-time cooldowns

Recommended MVP limiter:

- minimum `5` completed tasks since the last accusation was resolved or refused

Why this is preferred:

- it matches Mettle's run-based structure
- it is easy for players to understand
- it prevents accusations from feeling like notifications
- it avoids arbitrary real-world timers

Recommended trigger windows:

- after resolving a task and returning to a calm board
- on entering a new tier, if the board is calm
- after a clear repeated-avoidance threshold is reached

Recommended product rule:

Big moments should alternate, not pile up.

Good rhythm:

1. Draft
2. Task
3. Calm board
4. Accusation appears
5. Player responds
6. Back to normal flow

Bad rhythm:

1. Task
2. Trial reveal
3. Fork
4. Accusation
5. Reckoning warning
6. Landmark

## Trigger Philosophy

An accusation should only appear when the system has meaningful evidence.

Every accusation should be backed by an observable account pattern, not generic flavor text.

Good evidence sources:

- repeated defers in one category
- high combat stats with zero KC for major bosses
- abandoned quest chains
- long-ignored low skills relative to account average
- wilderness avoidance
- repeated failed attempts or deaths once those are tracked
- broad endgame readiness with obvious untouched content

Weak triggers to avoid:

- random selection with no account evidence
- accusations that merely restate a normal task
- accusations based on one isolated event
- accusations that can fire too early on naturally incomplete accounts

Hard trigger rule:

- even when evidence exists, the system must still respect the accusation spacing limiter before surfacing a new accusation

## Trigger Families

The system should support a small number of accusation families with clear evidence rules.

### 1. Avoidance Accusations

Used when the account is obviously steering around content it should be ready for.

Examples:

- high combat, never fought Zulrah
- Bandos tier reached, never entered God Wars
- endgame stats, zero wilderness boss interaction

### 2. Neglect Accusations

Used when one area has been left behind compared to the rest of the account.

Examples:

- total level is high, but one major skill remains far behind
- quest progression stalled despite broad account readiness

### 3. Cowardice Accusations

Used when the account repeatedly declines pressure.

Examples:

- repeated PvM defers
- refusing dangerous content categories
- abandoning difficult chains multiple times

### 4. Fraud Accusations

Used when the account's identity claim is contradicted by the ledger.

Examples:

- "claims mastery of combat" with zero signature-boss progress
- "claims exploration" without touching key regions or dungeons

This family should be used sparingly because it has the strongest voice.

## Tone By Severity

Severity must change tone, not just numbers.

If every accusation sounds like a final condemnation, the system flattens and loses impact.

Recommended tone ladder:

### Severity 1: Observational

Use when the system notices a meaningful gap or omission but the pattern is not yet deeply entrenched.

Voice:

- calm
- clinical
- lightly judgmental

Example shape:

- "This account has reached Bandos tier and still has not entered God Wars."

### Severity 2: Pattern Recognition

Use when the system sees repeated avoidance or a sustained trend.

Voice:

- firmer
- more interpretive
- clearly naming behavior, not just facts

Example shape:

- "This account has repeatedly deferred PvM pressure. The ledger reads a pattern of avoidance."

### Severity 3: Contradiction / Callout

Use when the account's behavior sharply contradicts its progression, identity, or prior warning history.

Voice:

- sharp
- decisive
- reserved for unmistakable contradictions

Example shape:

- "This account claims mastery of combat, yet still has not answered Zulrah. The ledger calls this cowardice."

Severity rule:

- do not use severity 3 language unless the evidence is strong enough to justify a true callout

## Accusation Structure

Each accusation should contain:

- `id`
- `family`
- `severity`
- `title`
- `chargeText`
- `evidence`
- `triggerSource`
- `issuedAt`
- `status`
- `responseOptions`
- `judgmentTemplate`
- `defenseTemplate`
- `penaltyProfile`

Suggested object shape:

```ts
type AccusationStatus =
  | "revealed"
  | "accepted"
  | "defended"
  | "refused"
  | "resolved"
  | "failed";

type Accusation = {
  id: string;
  family: "avoidance" | "neglect" | "cowardice" | "fraud";
  severity: 1 | 2 | 3;
  title: string;
  chargeText: string;
  evidence: string[];
  triggerSource: string;
  issuedAt: number;
  status: AccusationStatus;
  responseOptions: ["accept", "defend", "refuse"];
  judgmentTemplate: string | null;
  defenseTemplate: string | null;
  penaltyProfile: "light" | "medium" | "heavy";
};
```

## Writing Rules

The voice should sound formal, cold, and specific.

Accusations should:

- name the contradiction
- cite the evidence
- avoid sounding random
- stay short enough to read instantly on stream

Template pattern:

```text
ACCUSATION

This account claims mastery of combat,
yet has never faced Zulrah.

The ledger calls this cowardice.
```

Writing rules:

- use account facts, not vague insults
- keep to 2 to 4 lines
- end with a verdict line when appropriate
- avoid edgy writing for its own sake
- do not insult the player personally; judge the account

## Player Responses

Each accusation produces exactly 3 responses.

### 1. Accept The Charge

The player accepts the accusation.

Result:

- accusation becomes active
- system generates a Judgment Task tied to the charge
- completing the task seals the accusation permanently in history

Examples:

- accusation: avoiding Zulrah
- judgment: kill Zulrah once
- accusation: avoiding wilderness
- judgment: defeat one wilderness boss without teleport escape

Design rules:

- this should be the most direct path
- the task should clearly answer the charge
- reward should feel strong but not mandatory enough to dwarf normal tasks

### 2. Defend The Account

The player disputes the accusation.

Result:

- system generates a Defense Trial
- if successful, the accusation is dismissed
- if failed, the accusation escalates into a harsher consequence

Design rules:

- the defense should prove the accusation wrong indirectly
- it should be harder than acceptance, but broader
- it should feel like an argument backed by evidence

Example:

- accusation: "you avoid bosses"
- defense: kill 3 different bosses in one session

### 3. Refuse Judgment

The player declines to answer.

Result:

- accusation is marked unanswered or refused
- system applies a penalty using existing pressure structures
- the accusation remains in run history as unresolved or unanswered

Design rules:

- refusal should have consequences
- refusal should not create a giant new subsystem
- refusal should feed debt, modifiers, or accusation severity rather than creating parallel currencies

## Response Outcome Rules

### Accept Outcome

If the Judgment Task is completed:

- accusation status becomes `resolved`
- board records the accusation as sealed
- player gets accusation completion reward

If the Judgment Task is failed or deferred:

- accusation remains unresolved
- system may escalate severity later
- failure should not duplicate Reckoning unless explicitly connected

### Defend Outcome

If the Defense Trial is completed:

- accusation status becomes `resolved`
- board records the accusation as dismissed

If the Defense Trial is failed:

- accusation becomes confirmed
- convert into a Reckoning-style consequence or stronger Judgment Task

Recommended rule:

Defense failure should convert into a forced Judgment Task or a Reckoning-backed writ, not both.

### Refuse Outcome

If the accusation is refused:

- mark it `unanswered`
- reduce draft flexibility for a limited period or
- increase modifier pressure temporarily or
- increase the severity of the next accusation trigger

Recommended rule:

Refusal should lean on existing pressure systems instead of adding a new permanent resource.

Refusal tuning rule:

- the penalty must feel real
- the penalty must remain temporary
- refusal should be a viable but costly option, not a fake choice

## Best Integration Choice

The safest implementation path is:

- Accept -> generate a Judgment Task
- Defend -> generate a Defense Trial
- Refuse -> apply an existing-system penalty

This keeps the feature readable and prevents system bloat.

## Relationship To Existing Systems

### Trials

Trials are milestone pressure moments tied to Mettle level.

Accusations are not milestone level-ups. They are behavioral judgments.

Rule:

- accusations never interrupt or overlap Trials

### Forks

Forks are path commitments.

Accusations should never compete with a live Fork decision.

Rule:

- a Fork always takes precedence over an accusation

### Landmarks

Landmarks acknowledge achievements.

Accusations judge avoidance.

These are opposite emotional beats and should not appear together.

Rule:

- landmarks always resolve first

### Debt And Reckoning

Debt and Reckoning already handle mechanical punishment for defers.

Accusations should not replace them.

Best use:

- use debt and reckoning data as evidence for accusations
- use refusal or defense failure to feed into existing pressure

Rule:

- accusations interpret debt patterns; they do not duplicate debt logic

### Tier Gates

Tier gates are already cleanup checkpoints.

Accusations should not appear while the player is trying to clear gate pressure.

Rule:

- tier gate cleanup always wins over accusation presentation

## Calm-Board Trigger Windows

To avoid overload, accusation checks should happen only at specific safe moments.

Recommended windows:

### Window A: Post-Resolution Calm

After a task is resolved and the board returns to neutral.

This is the strongest default window.

### Window B: Tier Entry Calm

When entering a new tier, but only if no Trials, Forks, Landmarks, Reckonings, or debt blocks are active.

This works because a tier shift already reframes the run.

### Window C: Pattern Threshold Calm

When a repeated avoidance threshold is met, but presentation is delayed until the board is calm.

This is important:

- triggers may be detected during active play
- accusations should still wait for calm presentation

## Trigger Queue Rule

Pattern detection and board presentation should be separate.

Recommended behavior:

1. System detects an accusation-worthy pattern.
2. System stores a pending accusation candidate.
3. Candidate waits until `boardIsCalm === true`.
4. Only then does the accusation surface.

This prevents the feature from colliding with stronger live events.

## Content Rules For Judgment Tasks

Judgment Tasks should:

- answer the accusation directly
- be legible in one sentence
- use modifiers sparingly
- feel weighty, not gimmicky

Good examples:

- kill Zulrah once
- enter God Wars and defeat any general
- complete the abandoned quest chain's next required quest
- complete one wilderness boss kill without escape tools

Bad examples:

- unrelated grind tasks
- overlong endurance marathons
- joke punishments that weaken the tone

## Content Rules For Defense Trials

Defense Trials should:

- test the same domain broadly
- provide a fair counterargument
- be harder than accepting the charge
- stay achievable in one focused session when possible

Good examples:

- kill 3 different bosses in one session
- complete 2 quest milestones without a defer
- raise the lowest skill by 3 levels before next draft

Bad examples:

- a task that is effectively identical to the accusation target
- punishing requirements so large that refusing is always optimal

## Severity Model

Severity should shape tone and consequences, not create lots of extra math.

Suggested severity sources:

- strength of evidence
- how long the pattern has persisted
- whether the player has ignored similar accusations before
- current tier of the account

Suggested severity effects:

- stronger language
- tougher Judgment Task or Defense Trial
- slightly stronger refusal penalty

Keep severity simple:

- `1`: notable pattern
- `2`: repeated avoidance
- `3`: blatant contradiction or repeated refusal

Severity usage rule:

- severity should escalate slowly
- the majority of accusations in a healthy run should live at severity 1 or 2
- severity 3 should feel rare and earned

## Rewards And Penalties

Rewards should be meaningful but controlled.

Recommended rewards:

- bonus Mettle XP over a normal task
- cosmetic board record or seal stamp in history
- optional seal bonus for sealed accusations

Recommended penalties:

- temporary draft reduction
- temporary modifier pressure increase
- accusation severity escalation
- conversion into a Reckoning-adjacent consequence

Avoid:

- permanent stat-like debuffs
- too many bespoke currencies
- punishments that permanently clutter the board

Recommended refusal penalties for MVP:

- reduce draft size by 1 for the next `2` draws
- force the next accusation-generated Judgment Task to include a modifier
- raise the severity floor of the next accusation by 1, capped at 3

Recommended refusal limit:

- only 1 temporary refusal penalty should be active at a time

## Persistence And Run History

Accusations should be first-class saved state.

Recommended saved fields:

- `activeAccusation`
- `pendingAccusationCandidate`
- `accusationHistory`
- `accusationSpacingMin`
- `accusationRefusalCount`
- `completedTasksSinceLastAccusation`
- `lastAccusationAtTaskCount`
- `accusationMemory`

Suggested save shape:

```ts
{
  activeAccusation: Accusation | null,
  pendingAccusationCandidate: Accusation | null,
  accusationHistory: Array<AccusationHistoryEntry>,
  accusationSpacingMin: number,
  accusationRefusalCount: number,
  completedTasksSinceLastAccusation: number,
  lastAccusationAtTaskCount: number,
  accusationMemory: Record<string, AccusationMemoryEntry>
}
```

History entries should record:

- accusation text
- evidence
- response chosen
- generated task or trial
- final outcome
- timestamp

## Accusation Memory

History records what happened.

Memory lets the ledger speak differently because of what happened before.

This distinction matters. Without memory, accusations risk feeling like isolated events. With memory, they become recurring threads in the run.

Recommended memory behavior:

- store whether a similar accusation has surfaced before
- store whether the player accepted, defended, or refused it
- store whether the player actually resolved the underlying issue
- allow future accusation text to reference prior warning history

Example evolution:

First accusation:

- "This account has never faced Zulrah."

Later accusation:

- "This account was warned about Zulrah. It still has not acted."

Memory should influence:

- accusation wording
- severity selection
- whether a trigger is considered a first warning or a repeated callout

Recommended memory keying:

- by accusation family plus target content
- example: `avoidance:zulrah`

Suggested shape:

```ts
type AccusationMemoryEntry = {
  key: string;
  timesIssued: number;
  timesAccepted: number;
  timesDefended: number;
  timesRefused: number;
  timesResolved: number;
  lastIssuedAt: number;
  lastOutcome: "accepted" | "defended" | "refused" | "resolved" | "failed" | null;
};
```

Memory rule:

- future accusations may reference prior warnings, but only when the language stays concise and evidence-backed

## UI Behavior

Accusations should feel ceremonial, but not as large as Trials.

Recommended presentation:

- full-width board card
- strong label such as `ACCUSATION`
- short body text
- visible evidence line or tags
- exactly 3 response buttons

Buttons:

- `Accept Judgment`
- `Defend The Account`
- `Refuse Judgment`

UI rules:

- one accusation card at a time
- no simultaneous draft choices underneath it
- once answered, it transitions into its resulting task or trial

## Episode And Viewer Value

This system is especially strong for video and streaming because it creates:

- recurring narrative threads
- natural mid-episode pivots
- comment-section debates
- memorable callouts tied to account identity

Examples:

- "Ryan still owes Jad."
- "The ledger still has not forgiven wilderness avoidance."
- "This account claims mastery, but the board disagrees."

## Recommended MVP

To keep scope under control, the first version should be narrow.

### MVP Rules

- only 1 active accusation at a time
- only trigger on calm board
- minimum `5` completed tasks between accusations
- only support 3 to 5 accusation templates
- only use a small number of evidence rules
- only allow Accept, Defend, Refuse
- refusal feeds existing pressure instead of creating a new subsystem
- severity 3 language stays rare
- simple accusation memory is allowed for repeated callouts

### MVP Trigger Families

- high combat + zero KC on selected bosses
- repeated PvM defers
- abandoned major quest chain
- strong account tier with untouched major area

### MVP Output Types

- Judgment Task
- Defense Trial
- Refusal penalty

This is enough to prove whether the feature adds story value without overcomplicating the run.

## Recommended Phase 2

After MVP is stable, phase 2 can add:

- stronger accusation history display
- repeated-accusation escalation
- accusation-specific seals or board stamps
- richer evidence from plugin sync such as failures, attempts, or death patterns

These should come later only if the basic cadence feels good.

## Final Product Rule

The feature lives or dies on this sentence:

Accusations only appear when the board is calm.

If that rule holds, accusations become one of Mettle's strongest narrative tools.

If that rule is broken, accusations will compete with Trials, Reckonings, Forks, and Landmarks and the board will feel overloaded.
