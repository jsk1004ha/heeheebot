# Season Challenges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the integrated season system with repeatable daily/weekly challenges that turn existing RPG and sword activity into visible objectives and one-time bonus season points.

**Architecture:** Keep challenge progress inside `SeasonService` so RPG/sword handlers only award normal source points. The `/시즌` command reads and claims challenge rewards through service methods, while `/오늘할일`, `/도움말`, and README surface the new loop.

**Tech Stack:** Node.js ESM, Discord slash command builders, existing SQLite-backed store, Node test runner.

---

### Task 1: Lock challenge behavior with tests

**Files:**
- Modify: `tests/seasons.test.js`
- Modify: `tests/today.test.js`

- [x] Add failing tests that expect `/시즌` to expose `과제` and `과제보상` subcommands.
- [x] Add failing tests for daily/weekly challenge progress, claimable states, duplicate-claim prevention, and bonus points bypassing repetitive activity caps.
- [x] Add `/오늘할일` coverage that displays claimable season challenges.

### Task 2: Implement service-level challenge state

**Files:**
- Modify: `src/systems/seasons.js`

- [x] Add `SEASON_CHALLENGES` definitions for daily RPG battle, daily sword enhance, daily sword battle, weekly total activity, weekly RPG, and weekly sword activity.
- [x] Add weekly buckets alongside existing daily buckets.
- [x] Add `getChallenges()` and `claimChallengeRewards()` with per-period claim keys.
- [x] Keep normal activity point awards under the daily cap while allowing once-only challenge bonuses to pay out after the cap.

### Task 3: Wire player-facing command/UI surfaces

**Files:**
- Modify: `src/commands/seasons.js`
- Modify: `src/commands/today.js`
- Modify: `src/commands/help.js`
- Modify: `README.md`

- [x] Add `/시즌 과제` board output with daily/weekly rows, progress, and claimable count.
- [x] Add `/시즌 과제보상` claim output with claimed challenge names and bonus point summary.
- [x] Show season challenge summary in `/오늘할일`.
- [x] Document new commands in help and README.

### Task 4: Verify and ship

**Files:**
- All touched files

- [x] Run syntax checks, `git diff --check`, and full `npm test`.
- [ ] Commit with Lore trailers and push to `origin/main`.
