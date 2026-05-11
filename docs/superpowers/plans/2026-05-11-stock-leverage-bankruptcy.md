# Stock Leverage Bankruptcy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add bankruptcy debt to leveraged stock liquidations without introducing negative gold balances.

**Architecture:** Store bankruptcy debt on the shared money profile so all common `creditCurrency()` income can repay it. Stock leverage creates and gates debt; currency helpers normalize and auto-repay 25% of credited gold. Command formatting exposes the remaining debt and repayment receipt where stock users need it.

**Tech Stack:** Node.js ESM, `node --test`, existing `StockService`, `currencies.js` helpers, Discord command formatter tests.

---

### Task 1: Currency-level debt helpers and failing tests

**Files:**
- Modify: `tests/stocks.test.js`
- Modify: `src/systems/currencies.js`

- [x] Add tests proving 100x liquidation creates 35% bankruptcy debt, blocks new leverage, and future credited income repays 25%.
- [x] Run `node --test tests/stocks.test.js` and verify the new tests fail before implementation.
- [x] Implement normalized profile debt helpers and credit repayment receipts.
- [x] Re-run `node --test tests/stocks.test.js` and verify relevant tests pass or advance to stock implementation failures.

### Task 2: Stock leverage integration

**Files:**
- Modify: `src/systems/stocks.js`
- Modify: `tests/stocks.test.js`

- [x] Add/adjust tests for liquidation penalty bands and existing leverage gate.
- [x] Make liquidation add bankruptcy debt using leverage bands: 5%, 10%, 20%, 35%.
- [x] Block new leverage while debt remains.
- [x] Include bankruptcy summary in portfolio/leverage portfolio/clone profile results.
- [x] Run `node --test tests/stocks.test.js`.

### Task 3: User-facing formatting

**Files:**
- Modify: `src/commands/stocks.js`
- Modify: `tests/stocks.test.js`

- [x] Add command output assertions for 파산채무 and auto repayment lines.
- [x] Show debt on stock portfolio/leverage portfolio, liquidation, close, and sell results when present.
- [x] Run `node --test tests/stocks.test.js`.

### Task 4: Economy-wide credit routing for direct balance increments

**Files:**
- Modify: `src/systems/economy.js`
- Modify: `src/systems/community.js`
- Test: `tests/economy.test.js` or `tests/community.test.js` only if existing assertions need coverage.

- [x] Replace direct reward `profile.balance += ...` paths with `creditCurrency(profile, CURRENCY_MAIN, ...)` or equivalent existing currency IDs so bankruptcy repayment is not bypassed.
- [x] Preserve transfer semantics while allowing recipient income to repay debt.
- [x] Run targeted economy/community tests if touched behavior is covered.

### Task 5: Verification and commit

**Files:**
- All modified implementation/test files.

- [x] Run `node --test tests/stocks.test.js`.
- [x] Run `node --test tests/economy.test.js tests/community.test.js` if economy/community were touched.
- [x] Run full `npm test` if targeted tests pass and runtime is reasonable.
- [x] Commit only bankruptcy implementation files and this plan, avoiding unrelated dirty RPG/asset/fortune work.
