# Starting Guide + Season Pass + Automatic Achievements Design

## Purpose

HeeHeeBot already has many game systems, but new users still need a clear first path and existing users need a long-term loop that ties those systems together. This feature adds a `/시작하기` onboarding guide, strengthens the existing `/시즌` pass loop, and changes achievements from manual reward claiming to automatic reward delivery when conditions are met.

## Goals

- Give new users a short, guided path through the core bot features.
- Make `/오늘할일` the daily hub for onboarding, season progress, and claimable actions.
- Expand seasons beyond RPG and sword so fishing, stocks, community, and achievements contribute.
- Make achievements feel automatic: when a condition becomes true, the bot grants the achievement reward and title without requiring `/업적` claim.
- Avoid major gold inflation by keeping automatic achievement reward caps and existing balance tests.

## Non-Goals

- Do not redesign every command UI in this pass.
- Do not add real-money semantics, external stock APIs, or paid battle-pass mechanics.
- Do not make season rewards large gold faucets.
- Do not remove `/업적`; it remains the codex/history view.

## User-Facing Design

### `/시작하기`

`/시작하기` shows a beginner progression card with seven clear steps:

1. Claim attendance.
2. Check profile.
3. Start RPG.
4. Catch one fish.
5. Claim sword gift.
6. Check stock quotes.
7. Open season info.

Each step shows one of three states: locked/not started, ready, or complete. The response should include short action buttons where safe and useful, such as refresh, today checklist, help, and season info. Buttons that would trigger existing command-only flows can instead point users to the slash command text.

### `/오늘할일`

`/오늘할일` remains the daily hub and gains a compact onboarding line:

- If onboarding is incomplete, show the next `/시작하기` step.
- If onboarding is complete, show season progress and today’s highest-value loop first.
- Keep the existing daily rewards, RPG routine, sword routine, season block, school/life block, and economy check.

### `/시즌`

The existing season command remains the public surface:

- `/시즌 정보`: overview, daily cap, next reward, and top recommended content.
- `/시즌 과제`: daily/weekly tasks from RPG, sword, fishing, stocks, community, and achievements.
- `/시즌 과제보상`: claim season task points.
- `/시즌 보상`: claim pass rewards.
- `/시즌 랭킹`: server leaderboard.

Season rewards should prioritize badges, titles, and cosmetic/record rewards over gold.

### `/업적`

`/업적` becomes a history/codex command rather than a manual reward claim button:

- It lists completed, in-progress, and hidden achievements.
- It marks automatically granted achievements as claimed.
- It can still show “recently earned” information, but should not be required to receive rewards.

## Automatic Achievement Delivery

Achievement rewards are granted automatically through a shared service method, not by each command duplicating reward logic.

Proposed behavior:

- After relevant user actions, the bot evaluates all achievements for that user.
- Any completed and unclaimed achievement is marked claimed immediately.
- Gold, XP, and title rewards are applied atomically in the same store update.
- A short ephemeral or follow-up notice tells the user what was earned.
- Hidden achievements remain masked until completed, then reveal in the notice and codex.

Suggested method:

- `CommunityService.grantCompletedAchievements({ guildId, userId, username, now, limit })`

This replaces the current “claimable notice only” post-command behavior. Existing `claimAchievements` can remain for compatibility, but if all rewards are already granted it should return zero newly claimed items and show the codex state.

Safety rules:

- Auto-grant must be idempotent.
- Auto-grant must not double-pay on repeated buttons, retries, or command follow-ups.
- Auto-grant should run after command activity is recorded so command-count achievements can trigger.
- Auto-grant notices should be ephemeral for slash commands when possible.
- For plain message-triggered games, notices should be rate-limited or skipped unless the command already replies publicly.

## Season Expansion

Add season point sources for:

- Fishing catch or codex progress.
- Stock trade or market participation.
- Community daily mission completion.
- Automatic achievement earn.
- Existing RPG battle/daily and sword enhance/battle sources remain.

Add season challenges:

- Daily: win/complete one RPG action.
- Daily: perform sword enhancement or battle.
- Daily: catch fish or improve fishing collection.
- Daily: perform one stock market action.
- Daily: earn or auto-claim one achievement when available.
- Weekly: earn points from at least three different content categories.
- Weekly: complete a set number of today checklist items.

Season points should keep the existing daily cap. Achievement-triggered season points should be modest so old users with many immediate auto-achievements do not instantly inflate the season.

## Data Model

Use existing persisted profile and guild state patterns.

Beginner guide state can be derived where possible:

- Attendance from profile daily fields.
- Profile checked can be stored as a small community stat if needed.
- RPG started from `profile.rpg.startedAt`.
- Fishing catch from fishing stats.
- Sword gift from sword status.
- Stock quote checked can be stored as a stock/community stat.
- Season info checked can be stored in season profile metadata.

Season should continue storing under guild season state. Add new source counters only through existing daily/weekly bucket patterns.

Achievement auto-grant should continue using `community.claimedAchievements` as the idempotency key.

## Error Handling

- If optional systems are unavailable, `/시작하기` and `/오늘할일` should show a readable unavailable line instead of failing the whole command.
- If auto-achievement delivery fails after the primary command succeeds, log it and do not fail the user’s main command.
- If auto-grant notices cannot be sent because the Discord interaction expired, ignore the notice and keep the reward committed.
- If an achievement reward references an unknown title, skip the title but still mark the achievement and pay numeric rewards.

## Testing Plan

Add focused tests for:

- `/시작하기` payload and beginner step formatting.
- Derived beginner progress for a fresh user and a partially progressed user.
- `/오늘할일` includes the next onboarding step.
- Season point sources include fishing, stocks, community, and achievements.
- Season challenges can progress from the new source categories.
- Automatic achievements pay rewards once and never double-pay on repeated calls.
- `/업적` no longer needs manual claim to deliver rewards.
- Hidden achievement auto-reveal on completion.
- Full command registration includes `/시작하기`.

Run:

- `npm test -- tests/community.test.js tests/seasons.test.js tests/today.test.js`
- `npm test`
- `git diff --check`

## Rollout Order

1. Add automatic achievement grant service and tests.
2. Replace post-command claimable notice with automatic grant notice.
3. Add season sources and challenge tests.
4. Add `/시작하기` system/command and route it through bot registration.
5. Update `/오늘할일` and `/도움말` to link the new beginner flow.
6. Run full verification and commit.

## Implementation Decision

Automatic achievement rewards should pay immediately when the condition is first observed. This is more game-like than manual claiming, but it means older users may receive a burst of old rewards on first command after deployment. To control that, notices should show only a few earned achievements at once while the store still marks and pays all newly completed achievements atomically.
