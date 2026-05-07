# Stock Alert Push Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make existing `/주식 알림설정` alerts send an actual Discord channel push when the market reaches the target price.

**Architecture:** Store the registration channel on each price alert, expose service methods for pending triggered alerts and notification marking, then run a lightweight bot scheduler that sends alerts and marks them after successful delivery. Existing `/주식 알림` continues to show active/triggered history.

**Tech Stack:** Node.js ESM, existing StockService + SQLite store, Discord.js client/channel send APIs, Node test runner.

---

### Task 1: Lock service behavior with tests

**Files:**
- Modify: `tests/stocks.test.js`

- [x] Add a test for triggered alert push targets including `channelId`, `userId`, stock snapshot, and triggered price.
- [x] Add a test that `markPriceAlertNotified()` removes the alert from future pending-push queries.
- [x] Add a scheduler test with fake timers proving repeated interval scheduling and stop cleanup.
- [x] Add command-handler coverage that `/주식 알림설정` passes the current interaction channel to the service.

### Task 2: Extend stock alert state and service APIs

**Files:**
- Modify: `src/systems/stocks.js`

- [x] Store `channelId` and `notifiedAt` on price alerts while preserving legacy alert normalization.
- [x] Add `getPendingTriggeredPriceAlerts()` to sync market state, collect triggered/unnotified alerts, and return cloned stock snapshots.
- [x] Add `markPriceAlertNotified()` for successful delivery acknowledgement.
- [x] Add `scheduleStockAlertAnnouncements()` with configurable timer hooks for tests.

### Task 3: Wire Discord delivery

**Files:**
- Modify: `src/commands/stocks.js`
- Modify: `src/bot.js`
- Modify: `README.md`

- [x] Pass `interaction.channelId` when creating a price alert and explain that the alert will push to that channel.
- [x] Start the stock alert scheduler after `ClientReady`.
- [x] For every guild, collect pending alerts, send a mention message to the stored channel, and mark notified only after successful send.
- [x] Document automatic stock alert push behavior.

### Task 4: Verify and ship

**Files:**
- All touched files

- [x] Run syntax checks, `git diff --check`, and full `npm test`.
- [ ] Commit with Lore trailers and push to `origin/main`.
