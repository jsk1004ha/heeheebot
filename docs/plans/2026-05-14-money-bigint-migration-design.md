# Money BigInt Migration Design

**Decision:** Use a B-lite migration: every value that represents spendable or payable money becomes BigInt-backed and string-serializable; non-money counters stay Number.

## Scope

Convert these to money helpers:
- Profile gold balance.
- Currency credit/debit/transfer/exchange compatibility paths.
- Casino bet, payout, profit, reserved wager settlement, deadline/timing/poker/scratch payout totals.
- User loans: principal, total due, remaining, repayment, interest math.
- Stock cash-facing money: order cost, proceeds, dividends, leverage margin/profit/debt, bankruptcy debt repayment.
- Content costs/rewards that touch gold: RPG, sword, fishing, mining, community lottery/shop, word games.

Keep these as Number:
- Level, XP, counts, cooldown timestamps, probabilities, percentages, enhancement levels, stock share quantities, season points.
- UI pagination counts and Discord option integers where Discord itself requires Number.

## Storage Model

`profile.balance` becomes a canonical decimal string for persisted state, e.g. `"12345678901234567890"`. Small values may be accepted from legacy data as numbers and normalized to strings on write.

SQLite hot projection keeps a safe numeric `balance` column for compatibility and approximate sorting, but the canonical value remains in `profile_json`. A future optional projection column can store `balance_digits`/`balance_text` if exact SQL rank ordering is needed. In app-level ranking, exact BigInt comparison is used after loading profile JSON.

## Money API

Add `src/systems/money.js` with helpers:
- `toMoney(value, fallback = 0n): bigint`
- `toMoneyString(value): string`
- `formatMoney(value): string`
- `addMoney`, `subtractMoney`, `multiplyMoneyFloor`, `divideMoneyFloor`
- `compareMoney`, `minMoney`, `maxMoney`
- `isZeroMoney`, `isPositiveMoney`
- `toSafeNumberForDiscordOption(value)` only at Discord option boundaries.

All arithmetic in money code uses BigInt internally. Multipliers such as 1.9 become basis points or numerator/denominator pairs to avoid floating precision.

## Compatibility

Return objects may keep field names like `balance`, `payout`, `profit`, but their values become decimal strings for money. UI code must format through `formatCurrencyAmount`/`formatMoney`, not `Number(...).toLocaleString()`.

Tests should assert string values for huge money and may use a small helper in tests to compare money strings. Existing small-number behavior remains visually identical in Discord messages.

## Error Handling

Negative money inputs are rejected at public command/service boundaries. Stored invalid money values normalize to `"0"` rather than crashing profile load. Insufficient-funds checks use BigInt comparisons.

## Migration Strategy

Do not perform a one-shot DB migration. Normalize lazily whenever a profile is loaded or written. This keeps old JSON/SQLite data readable and avoids production downtime.
