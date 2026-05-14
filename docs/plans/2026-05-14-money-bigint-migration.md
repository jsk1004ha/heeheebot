# Money BigInt Migration Implementation Plan

> **Execution note:** Implement task-by-task with regression tests around each money path.

**Goal:** Remove practical gold upper limits by migrating money values to BigInt-backed decimal strings while keeping non-money game counters as Numbers.

**Architecture:** Add a central money helper and migrate write paths from raw `Number` arithmetic to BigInt money operations. Persist canonical money as strings in JSON profiles; keep SQLite numeric projections only as compatibility hints and use exact BigInt comparison in app-level ranking.

**Tech Stack:** Node.js ESM, native `BigInt`, node:test, SQLite JSON profile storage.

---

### Task 1: Add BigInt money helper and tests

**Files:**
- Create: `src/systems/money.js`
- Create/Modify: `tests/money.test.js`

**Step 1: Write failing tests**

Create tests for:
- `toMoney(100) === 100n`
- `toMoney('900719925474099199999') === 900719925474099199999n`
- invalid/negative stored values normalize or throw according to API variant
- `formatMoney('12345678901234567890')` returns grouped Korean-display-safe decimal string plus `골드` when requested by wrapper
- `multiplyMoneyFloor(100n, 19_000n, 10_000n) === 190n`
- `compareMoney('10000000000000000000', '9') > 0`

**Step 2: Run RED**

Run:
```bash
node --test tests/money.test.js
```
Expected: FAIL because `src/systems/money.js` does not exist.

**Step 3: Implement helper**

Implement:
```js
export function toMoney(value, fallback = 0n) { ... }
export function toMoneyString(value) { return toMoney(value).toString(); }
export function normalizeStoredMoney(value) { ... } // tolerant, never throws
export function assertMoney(value, label = '금액') { ... } // public input, throws negative/invalid
export function addMoney(...values) { ... }
export function subtractMoney(left, right) { ... } // throws if result negative or caller chooses clamp helper
export function multiplyMoneyFloor(amount, numerator, denominator = 1n) { ... }
export function divideMoneyFloor(amount, divisor) { ... }
export function compareMoney(left, right) { ... }
export function minMoney(...values) { ... }
export function maxMoney(...values) { ... }
export function formatMoney(value) { ... }
export function toSafeProjectionNumber(value) { ... } // clamp to Number.MAX_SAFE_INTEGER for legacy SQL projection only
```

**Step 4: Run GREEN**

Run:
```bash
node --test tests/money.test.js
```
Expected: PASS.

---

### Task 2: Convert currency core to money strings

**Files:**
- Modify: `src/systems/currencies.js`
- Modify: `tests/economy.test.js`
- Modify: `tests/casino.test.js` for recently added high-money tests

**Step 1: Write failing tests**

Add/adjust tests so:
- A profile with `balance: '900719925474099199999'` loads with the same string, not `Number.MAX_SAFE_INTEGER`.
- Crediting `2` to that profile yields `'900719925474099200001'`.
- Debiting works with BigInt comparison and leaves a string.
- `formatCurrencyAmount('900719925474099200001', 'main')` displays the full amount.

**Step 2: Run RED**

Run:
```bash
node --test tests/economy.test.js tests/casino.test.js --test-name-pattern 'BigInt|안전 정수|상한'
```
Expected: FAIL because currency core still clamps to safe Number.

**Step 3: Implement currency core**

In `src/systems/currencies.js`:
- Replace `normalizeNonNegativeInteger` money logic with `normalizeStoredMoney`.
- `getCurrencyBalance()` returns canonical money string.
- `setCurrencyBalance()` stores canonical money string.
- `creditCurrencyWithReceipt()`, `debitCurrency()`, stock bankruptcy repayment use BigInt helpers.
- `formatCurrencyAmount()` calls `formatMoney()`.

**Step 4: Preserve compatibility wrappers**

If many callers still expect arithmetic, add temporary explicit helpers:
- `getCurrencyBalanceMoney(profile, currencyId): bigint`
- `getCurrencyBalance(profile, currencyId): string`

Do not silently convert large money back to Number.

**Step 5: Run GREEN**

Run:
```bash
node --test tests/economy.test.js tests/casino.test.js
```
Expected: PASS or failures only from unmigrated raw Number arithmetic, which become the next task inputs.

---

### Task 3: Convert EconomyService gold paths

**Files:**
- Modify: `src/systems/economy.js`
- Modify: `tests/economy.test.js`
- Modify: `tests/rpg.test.js`
- Modify: `tests/sword.test.js`

**Step 1: Write failing tests**

Add focused tests for:
- `/송금` service transfer with huge string balances.
- User loan principal/remaining/repayment with huge string balances.
- Ranking sorts `'10000000000000000000'` above `'9999999999999999999'` exactly.
- RPG/sword cost checks use BigInt and do not coerce to Number.

**Step 2: Run RED**

Run:
```bash
node --test tests/economy.test.js tests/rpg.test.js tests/sword.test.js --test-name-pattern 'BigInt|송금|대출|랭킹|타짜'
```
Expected: FAIL at raw `Math.min`, `+`, `-`, `<`, sort subtraction, or string/number assertions.

**Step 3: Implement EconomyService changes**

Replace money arithmetic/comparisons in these hotspots:
- `transferMoney`
- social loan offer/accept/repay/accrual/auto-repayment helpers
- `settleWager`, `resolveReservedWager`, `creditWagerSettlementPayout`
- player pot settlement helpers
- rank sorting by balance
- RPG/sword gold cost and reward paths touching `profile.balance`

Use `addMoney`, `subtractMoney`, `minMoney`, `compareMoney`, and `multiplyMoneyFloor`.

**Step 4: Update return values intentionally**

Money fields returned from services should be decimal strings. Keep non-money fields as Numbers.

**Step 5: Run GREEN**

Run:
```bash
node --test tests/economy.test.js tests/rpg.test.js tests/sword.test.js
```
Expected: PASS.

---

### Task 4: Convert casino payout math away from safe-number caps

**Files:**
- Modify: `src/systems/casino.js`
- Modify: `src/commands/casino.js`
- Modify: `tests/casino.test.js`

**Step 1: Write failing tests**

Add tests proving:
- `playSlots({ bet: '10000000000000000000' })` can pay 20x exactly.
- Deadline 12 safe presses with a huge bet produces a huge exact payout, not `Number.MAX_SAFE_INTEGER`.
- Formatting/retry buttons do not truncate huge bet text.

**Step 2: Run RED**

Run:
```bash
node --test tests/casino.test.js --test-name-pattern 'BigInt|고액|상한'
```
Expected: FAIL because current casino helper caps at `Number.MAX_SAFE_INTEGER`.

**Step 3: Implement casino money math**

In `src/systems/casino.js`:
- Replace `calculateCasinoPayout` implementation with `multiplyMoneyFloor` returning string or BigInt converted to string.
- Replace `addCasinoMoney` caps with BigInt addition.
- Convert multipliers to exact numerator/denominator constants:
  - 1.9 => 19/10
  - 1.95 => 195/100
  - 2.7 => 27/10
  - 5.5 => 55/10
  - bps already denominator 10_000
- Keep random/probability values as Numbers.

**Step 4: Update command formatting**

In `src/commands/casino.js`:
- Replace direct `.toLocaleString()` on `settlement.bet/payout/profit/profile.balance` with `formatCurrencyAmount` or `formatMoney`.
- Button custom IDs cannot contain arbitrarily large bets indefinitely; for retry buttons, either omit quick retry for very long bet text or store short-lived pending retry state keyed by random id.

**Step 5: Run GREEN**

Run:
```bash
node --test tests/casino.test.js
```
Expected: PASS.

---

### Task 5: Convert stocks and bankruptcy money paths

**Files:**
- Modify: `src/systems/stocks.js`
- Modify: `src/commands/stocks.js`
- Modify: `tests/stocks.test.js`

**Step 1: Write failing tests**

Add tests for:
- Huge gold balance can buy/sell without precision loss.
- Bankruptcy debt greater than `Number.MAX_SAFE_INTEGER` is stored and repaid exactly.
- Leverage profit/debt fields that represent money use strings.

**Step 2: Run RED**

Run:
```bash
node --test tests/stocks.test.js --test-name-pattern 'BigInt|파산|레버리지|매수|매도'
```
Expected: FAIL at safe-number clamps or numeric arithmetic.

**Step 3: Implement stock money migration**

Convert only money values:
- cash costs/proceeds/dividends/fees/margin/debt/profit
- bankruptcy debt/paid

Keep these as Number:
- share quantity
- price tick percent/change bps
- leverage multiplier/days
- market tick indexes

**Step 4: Run GREEN**

Run:
```bash
node --test tests/stocks.test.js
```
Expected: PASS.

---

### Task 6: Convert remaining content reward/cost formatting

**Files:**
- Modify: `src/commands/economy.js`
- Modify: `src/commands/mining.js`
- Modify: `src/commands/mafia.js`
- Modify: `src/commands/liar-game.js`
- Modify other command files found by `rg "toLocaleString\(\).*골드|골드.*toLocaleString" src`
- Modify relevant tests.

**Step 1: Find raw gold formatting**

Run:
```bash
rg -n "toLocaleString\(\).*골드|골드.*toLocaleString|Number\(.*balance|profile\.balance [+-]" src tests
```

**Step 2: Replace money formatting**

Use `formatCurrencyAmount`/`formatMoney` everywhere a value is money. Do not change XP/count formatting.

**Step 3: Run targeted tests**

Run:
```bash
node --test tests/economy-command.test.js tests/community.test.js tests/fishing.test.js tests/mining.test.js tests/wordle.test.js tests/number-baseball.test.js tests/wordchain.test.js tests/mafia.test.js tests/liar-game.test.js
```
Expected: PASS.

---

### Task 7: SQLite storage compatibility

**Files:**
- Modify: `src/storage/sqlite-store.js`
- Modify: `tests/storage.test.js`
- Modify: `tests/economy.test.js`

**Step 1: Write failing tests**

Add tests for:
- `profile_json` preserves huge string balance.
- `bot_account_profiles.balance` projection clamps to `Number.MAX_SAFE_INTEGER` or stores a safe fallback without corrupting JSON.
- `getAccountProfile()` returns canonical string balance.
- Account fast-path update preserves string money.

**Step 2: Run RED**

Run:
```bash
node --test tests/storage.test.js tests/economy.test.js --test-name-pattern 'BigInt|balance projection|fast-path'
```
Expected: FAIL where projection currently normalizes unsafe values to fallback.

**Step 3: Implement storage compatibility**

- Use `toSafeProjectionNumber(profile.balance)` only for `bot_account_profiles.balance`.
- Keep `profile_json` canonical and exact.
- Update rank query paths to use loaded JSON BigInt comparison when exact money order matters.

**Step 4: Run GREEN**

Run:
```bash
node --test tests/storage.test.js tests/economy.test.js
```
Expected: PASS.

---

### Task 8: Remove temporary casino safe cap behavior

**Files:**
- Modify: `src/systems/casino.js`
- Modify: `src/systems/economy.js`
- Modify: `src/systems/currencies.js`
- Modify: `tests/casino.test.js`

**Step 1: Update tests**

Replace the earlier safe cap tests with exact BigInt expectations:
- No `Number.MAX_SAFE_INTEGER` cap.
- High payout is full exact decimal string.
- Profile reload keeps full value.

**Step 2: Remove cap helpers**

Remove or restrict:
- `clampCasinoMoney`
- `clampNonNegativeSafeInteger` for money use
- money-specific `Number.MAX_SAFE_INTEGER` caps

Keep safe integer checks only for non-money counters and Discord option numbers.

**Step 3: Run targeted tests**

Run:
```bash
node --test tests/casino.test.js tests/economy.test.js
```
Expected: PASS.

---

### Task 9: Full verification and cleanup

**Files:**
- All modified files.

**Step 1: Search for remaining risky patterns**

Run:
```bash
rg -n "profile\.balance [+\-*/<>=]|\.balance \+|\+ .*\.balance|Math\.min\([^\n]*(balance|payout|bet|debt|cost)|Number\.MAX_SAFE_INTEGER" src
rg -n "toLocaleString\(\).*골드|골드.*toLocaleString" src
```
Expected: Remaining matches are either non-money or intentionally documented.

**Step 2: Run all tests**

Run:
```bash
npm test
```
Expected: PASS.

**Step 3: Commit**

Use the repo Lore protocol. Suggested intent line:
```text
Allow money systems to exceed JavaScript safe integer limits
```

Include trailers:
```text
Constraint: Money must serialize through JSON and SQLite without BigInt-native storage.
Rejected: Decimal library migration | native BigInt covers integer-only economy without adding dependency.
Confidence: medium
Scope-risk: broad
Directive: New money paths must use src/systems/money.js helpers, not raw Number arithmetic.
Tested: npm test
Not-tested: Live Discord production migration.
```

---

## Stop Conditions

Stop implementation if any of these happen:
- More than three unrelated feature areas require incompatible API changes.
- A command custom ID needs to carry unbounded money text and no state-key alternative is acceptable.
- Exact SQL ranking by huge money is required without loading JSON; that needs a schema design update.

## Rollout Notes

- This is a broad migration. Prefer multiple small commits by task.
- Do not convert XP/levels/counts to BigInt.
- Do not add a decimal library unless native BigInt proves insufficient for integer money.
