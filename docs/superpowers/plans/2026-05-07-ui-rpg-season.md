# UI, RPG Split, and Season System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reusable Discord UI primitives, reduce RPG command-file responsibilities through extracted modules, and ship a cross-feature season/event system connected to user-visible commands and multiple gameplay loops.

**Architecture:** Keep public command behavior stable. Add small shared UI helpers under `src/commands/ui.js`, extract RPG presentation helpers into focused modules under `src/commands/rpg/`, and add a `SeasonService` under `src/systems/seasons.js` with command routing in `src/commands/seasons.js`. Wire season points from RPG and sword loops first because they already produce repeatable game outcomes and have tests.

**Tech Stack:** Node.js ESM, discord.js builders, existing JSON/SQLite store abstraction, node:test.

---

### Task 1: Shared UI primitives

**Files:**
- Create: `src/commands/ui.js`
- Modify: `src/commands/stocks.js`
- Modify: `src/commands/rpg.js`
- Test: `tests/stocks.test.js`, `tests/rpg.test.js`

- [ ] Write failing tests proving stock pagination owner/labels and RPG embed card behavior still work.
- [ ] Implement `createPagedButtonRow`, `createOwnerLockedNotice`, `chunkContentPages`, and lightweight card helpers in `src/commands/ui.js`.
- [ ] Replace stock ad-hoc pagination row/content code with shared helpers without changing custom IDs.
- [ ] Replace repeated RPG embed row/card helper usage where safe without changing output.
- [ ] Run `node --test tests/stocks.test.js tests/rpg.test.js`.

### Task 2: RPG command decomposition

**Files:**
- Create: `src/commands/rpg/formatters.js`
- Create: `src/commands/rpg/components.js`
- Create: `src/commands/rpg/router-utils.js`
- Modify: `src/commands/rpg.js`
- Test: `tests/rpg.test.js`

- [ ] Write/keep regression tests for RPG cards, buttons, menus, PvP, boss, and main command payload.
- [ ] Move pure formatting helpers from `src/commands/rpg.js` into `formatters.js`.
- [ ] Move button/select row helpers into `components.js`.
- [ ] Move command-name/custom-id parsing helpers into `router-utils.js`.
- [ ] Keep exported command payload and `handleRpgCommand` behavior stable.
- [ ] Run `node --test tests/rpg.test.js`.

### Task 3: Season service and commands

**Files:**
- Create: `src/systems/seasons.js`
- Create: `src/commands/seasons.js`
- Modify: `src/index.js` or command registration surface
- Modify: `src/commands/help.js`
- Modify: `src/commands/today.js`
- Test: `tests/seasons.test.js`, `tests/help.test.js`, `tests/today.test.js`

- [ ] Write failing tests for `/시즌 정보`, `/시즌 랭킹`, `/시즌 보상`, season profile persistence, point grants, reward claiming, and command registration.
- [ ] Implement default active season with deterministic ID, point ledger, per-user totals, and reward tiers.
- [ ] Add season command payloads and handlers.
- [ ] Register season commands and include them in help/today surfaces.
- [ ] Run targeted season/help/today tests.

### Task 4: Cross-feature season integration

**Files:**
- Modify: `src/commands/rpg.js`
- Modify: `src/commands/sword.js`
- Modify: `src/systems/seasons.js`
- Test: `tests/rpg.test.js`, `tests/sword.test.js`, `tests/seasons.test.js`

- [ ] Write failing tests proving RPG victory and sword battle/enhancement grant season points.
- [ ] Add optional `season` service dependency to RPG and sword command handlers.
- [ ] Grant capped season points for RPG wins/dailies and sword battle/enhancement outcomes.
- [ ] Include short season point summaries in affected command responses.
- [ ] Run targeted tests.

### Task 5: Docs and full validation

**Files:**
- Modify: `README.md`
- Test: full suite

- [ ] Document shared UI/decomposition only at user-visible level and add season command docs.
- [ ] Run `node --check` on changed command/system files.
- [ ] Run `npm test` and `git diff --check`.
- [ ] Record autoresearch verdict pass only after full tests pass and rubric is met.
