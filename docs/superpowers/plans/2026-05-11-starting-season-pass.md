# Starting Guide + Season Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/시작하기`, expand the season pass across more content, connect onboarding to `/오늘할일`, and make achievement rewards automatic.

**Architecture:** Keep the existing command/service style. Achievement auto-grant lives in `CommunityService`, season source expansion stays in `SeasonService`, and `/시작하기` is a small command module that derives progress from existing service data instead of creating a new store namespace.

**Tech Stack:** Node.js ESM, `discord.js` slash commands/buttons, `node:test`, existing SQLite JSON store.

---

## File Structure

- Create `src/commands/start.js`: `/시작하기` payload, handler, formatting, and owner-only refresh/today/season/help hint buttons.
- Modify `src/command-registration.js`: include `getStartCommandPayloads`.
- Modify `src/bot.js`: route `handleStartCommand`, replace claimable achievement notice with auto-grant notice, and pass existing services to start command.
- Modify `src/commands/community.js`: keep `/업적` as codex/history while preserving compatibility for manual claim calls.
- Modify `src/systems/community.js`: add `grantCompletedAchievements` and share reward application with `claimAchievements`.
- Modify `src/systems/seasons.js`: add fishing, stocks, community mission, achievement, and today checklist sources/challenges.
- Modify `src/commands/today.js`: show next onboarding step and award today checklist season points when relevant.
- Modify `src/commands/help.js`: place `/시작하기` in the home/help surfaces.
- Modify tests: `tests/community.test.js`, `tests/bot-routing.test.js`, `tests/seasons.test.js`, `tests/today.test.js`, `tests/help.test.js`, `tests/command-registration.test.js`.

---

### Task 1: Automatic Achievement Delivery

**Files:**
- Modify: `src/systems/community.js`
- Modify: `src/bot.js`
- Modify: `src/commands/community.js`
- Test: `tests/community.test.js`
- Test: `tests/bot-routing.test.js`

- [ ] **Step 1: Write failing tests for automatic achievement grants**

Add to `tests/community.test.js`:

```js
test('자동 업적 수령은 완료 업적 보상을 한 번만 지급한다', async () => {
  const fixture = await createFixture();

  try {
    await seedProfile(fixture.store, {
      community: { stats: { commandsUsed: 50 } }
    });

    const first = await fixture.community.grantCompletedAchievements({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '자동러'
    });
    const second = await fixture.community.grantCompletedAchievements({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '자동러'
    });

    assert.equal(first.claimed.some((achievement) => achievement.id === 'commands_50'), true);
    assert.equal(first.totalCoins, 1_000);
    assert.equal(first.totalXp, 120);
    assert.equal(first.profile.community.ownedTitles.includes('commander'), true);
    assert.equal(second.claimed.length, 0);
    assert.equal(second.totalCoins, 0);
    assert.equal(second.totalXp, 0);
    assert.equal(second.profile.balance, first.profile.balance);
  } finally {
    await fixture.cleanup();
  }
});
```

Add to `tests/bot-routing.test.js`:

```js
test('명령 처리 후 새 업적은 자동 지급 안내로 표시한다', async () => {
  const interaction = createCommandInteraction('낚시');
  const community = {
    async grantCompletedAchievements(input) {
      assert.equal(input.guildId, 'guild-1');
      assert.equal(input.userId, 'user-1');
      return {
        totalClaimed: 2,
        totalCoins: 300,
        totalXp: 110,
        claimed: [
          { title: '물비린내 입문' },
          { title: '대장장이의 악몽' }
        ]
      };
    }
  };

  const sent = await sendAutomaticAchievementNotice(interaction, community, { debug() {}, error() {} });

  assert.equal(sent, true);
  assert.equal(interaction.followUps.length, 1);
  assert.equal(interaction.followUps[0].flags, MessageFlags.Ephemeral);
  assert.match(interaction.followUps[0].content, /자동 수령/);
  assert.match(interaction.followUps[0].content, /물비린내 입문/);
  assert.match(interaction.followUps[0].content, /300골드/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- tests/community.test.js tests/bot-routing.test.js
```

Expected: FAIL because `grantCompletedAchievements` and `sendAutomaticAchievementNotice` are not defined.

- [ ] **Step 3: Implement shared auto-grant logic**

In `src/systems/community.js`, add a method next to `claimAchievements`:

```js
  async grantCompletedAchievements({ guildId, userId, username, now = Date.now(), limit = 5 }) {
    const safeLimit = Math.max(1, Math.min(10, normalizeStoredNonNegativeInteger(limit, 5)));

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, now);
      const guild = data.guilds?.[guildId] ?? {};
      const community = normalizeCommunityProfile(profile, now);
      const achievementSources = getAchievementSources(guild, userId, profile);
      const statuses = achievements.getAchievementStatuses(profile, community, achievementSources);
      const result = applyCompletedAchievementRewards({
        profile,
        community,
        statuses,
        now
      });

      return {
        ...result,
        totalClaimed: result.claimed.length,
        displayed: result.claimed.slice(0, safeLimit),
        hiddenCount: Math.max(0, result.claimed.length - safeLimit),
        profile: cloneCommunityProfile(profile, now),
        achievements: achievements.getAchievementStatuses(profile, community, achievementSources),
        titles: achievements.getTitleStatuses(community)
      };
    });
  }
```

Add helper below `getLotteryDrawScheduleText` or near `addXp` helpers:

```js
function applyCompletedAchievementRewards({ profile, community, statuses }) {
  const claimed = [];
  let totalCoins = 0;
  let totalXp = 0;

  for (const status of statuses) {
    if (!status.completed || status.claimed) continue;
    community.claimedAchievements[status.id] = true;
    totalCoins += status.reward.coins;
    totalXp += status.reward.xp;
    if (status.reward.titleId) addOwnedTitle(community, status.reward.titleId);
    claimed.push(status);
  }

  if (totalCoins > 0) profile.balance += totalCoins;
  const levelResult = addXp(profile, totalXp);

  return {
    claimed,
    totalCoins,
    totalXp,
    ...levelResult
  };
}
```

Refactor `claimAchievements` to call the same helper inside its store update:

```js
      const rewardResult = applyCompletedAchievementRewards({
        profile,
        community,
        statuses
      });

      return {
        ...rewardResult,
        profile: cloneCommunityProfile(profile, now),
        achievements: achievements.getAchievementStatuses(profile, community, achievementSources),
        titles: achievements.getTitleStatuses(community)
      };
```

- [ ] **Step 4: Replace bot notice with automatic grant notice**

In `src/bot.js`, rename the exported notice function:

```js
export async function sendAutomaticAchievementNotice(interaction, community, logger = console) {
  if (!interaction.isChatInputCommand?.() || !interaction.inGuild?.()) return false;
  if (interaction.commandName === '업적') return false;
  if (typeof community?.grantCompletedAchievements !== 'function') return false;

  let result = null;
  try {
    result = await community.grantCompletedAchievements({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      username: interaction.user.username,
      limit: 3
    });
  } catch (error) {
    logger.debug?.('Failed to grant automatic achievements:', error);
    return false;
  }

  if (!result?.totalClaimed || !Array.isArray(result.displayed) || result.displayed.length <= 0) {
    return false;
  }

  const achievementText = result.displayed
    .map((achievement) => `**${achievement.title}**`)
    .join(', ');
  const moreText = result.hiddenCount > 0 ? ` 외 ${result.hiddenCount.toLocaleString()}개` : '';

  return safeReplyToInteraction(interaction, [
    `🏆 업적 자동 수령: ${achievementText}${moreText}`,
    `보상: +${result.totalCoins.toLocaleString()}골드, +${result.totalXp.toLocaleString()} XP`
  ].join('\n'), {
    flags: MessageFlags.Ephemeral
  });
}
```

Replace both current calls to `sendClaimableAchievementNotice(...)` with `sendAutomaticAchievementNotice(...)`. Update `tests/bot-routing.test.js` imports from `sendClaimableAchievementNotice` to `sendAutomaticAchievementNotice`.

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm test -- tests/community.test.js tests/bot-routing.test.js
```

Expected: PASS for all tests in both files.

- [ ] **Step 6: Commit**

```bash
git add src/systems/community.js src/bot.js src/commands/community.js tests/community.test.js tests/bot-routing.test.js
git commit -m "Deliver achievement rewards automatically"
```

---

### Task 2: Season Sources and Challenges

**Files:**
- Modify: `src/systems/seasons.js`
- Modify: `src/commands/seasons.js`
- Test: `tests/seasons.test.js`

- [ ] **Step 1: Write failing season source tests**

Add to `tests/seasons.test.js`:

```js
test('시즌 과제는 낚시, 주식, 커뮤니티, 업적 출처를 진행도에 반영한다', async () => {
  const fixture = await createFixture();
  const now = Date.UTC(2026, 4, 11, 12);

  try {
    await fixture.seasons.awardPoints({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '시즌러',
      source: SEASON_POINT_SOURCES.FISHING_CATCH,
      points: 20,
      now
    });
    await fixture.seasons.awardPoints({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '시즌러',
      source: SEASON_POINT_SOURCES.STOCK_TRADE,
      points: 15,
      now
    });
    await fixture.seasons.awardPoints({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '시즌러',
      source: SEASON_POINT_SOURCES.ACHIEVEMENT_EARN,
      points: 10,
      now
    });

    const board = await fixture.seasons.getChallenges({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '시즌러',
      now
    });

    assert.equal(board.daily.find((challenge) => challenge.id === 'daily_fishing_catch').claimable, true);
    assert.equal(board.daily.find((challenge) => challenge.id === 'daily_stock_trade').claimable, true);
    assert.equal(board.daily.find((challenge) => challenge.id === 'daily_achievement_earn').claimable, true);
    assert.equal(board.weekly.find((challenge) => challenge.id === 'weekly_three_categories').progress, 3);
  } finally {
    await fixture.cleanup();
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/seasons.test.js
```

Expected: FAIL because new `SEASON_POINT_SOURCES` keys are absent.

- [ ] **Step 3: Add season sources and labels**

In `src/systems/seasons.js`, extend `SEASON_POINT_SOURCES`:

```js
  FISHING_CATCH: 'fishing_catch',
  STOCK_TRADE: 'stock_trade',
  COMMUNITY_MISSION_CLAIM: 'community_mission_claim',
  ACHIEVEMENT_EARN: 'achievement_earn',
  TODAY_CHECKLIST: 'today_checklist',
```

Extend `SEASON_SOURCE_LABELS`:

```js
  [SEASON_POINT_SOURCES.FISHING_CATCH]: '낚시 성공',
  [SEASON_POINT_SOURCES.STOCK_TRADE]: '주식 거래',
  [SEASON_POINT_SOURCES.COMMUNITY_MISSION_CLAIM]: '커뮤니티 미션',
  [SEASON_POINT_SOURCES.ACHIEVEMENT_EARN]: '업적 달성',
  [SEASON_POINT_SOURCES.TODAY_CHECKLIST]: '오늘 할 일',
```

- [ ] **Step 4: Add daily and weekly challenge definitions**

Insert into `SEASON_CHALLENGES`:

```js
  seasonChallenge({
    id: 'daily_fishing_catch',
    period: 'daily',
    label: '오늘의 첫 낚시',
    description: '낚시로 시즌 포인트 20점 획득',
    requiredPoints: 20,
    rewardPoints: 20,
    sources: [SEASON_POINT_SOURCES.FISHING_CATCH]
  }),
  seasonChallenge({
    id: 'daily_stock_trade',
    period: 'daily',
    label: '시장 출석',
    description: '주식 거래로 시즌 포인트 15점 획득',
    requiredPoints: 15,
    rewardPoints: 20,
    sources: [SEASON_POINT_SOURCES.STOCK_TRADE]
  }),
  seasonChallenge({
    id: 'daily_achievement_earn',
    period: 'daily',
    label: '업적 하나 더',
    description: '자동 업적 수령으로 시즌 포인트 10점 획득',
    requiredPoints: 10,
    rewardPoints: 15,
    sources: [SEASON_POINT_SOURCES.ACHIEVEMENT_EARN]
  }),
  seasonChallenge({
    id: 'weekly_three_categories',
    period: 'weekly',
    label: '주간 만능 플레이어',
    description: '이번 주 서로 다른 콘텐츠 3종에서 시즌 포인트 획득',
    requiredPoints: 3,
    rewardPoints: 120,
    progressMode: 'distinct_sources',
    sources: [
      SEASON_POINT_SOURCES.RPG_BATTLE_WIN,
      SEASON_POINT_SOURCES.SWORD_ENHANCE,
      SEASON_POINT_SOURCES.SWORD_BATTLE_PLAY,
      SEASON_POINT_SOURCES.FISHING_CATCH,
      SEASON_POINT_SOURCES.STOCK_TRADE,
      SEASON_POINT_SOURCES.COMMUNITY_MISSION_CLAIM,
      SEASON_POINT_SOURCES.ACHIEVEMENT_EARN,
      SEASON_POINT_SOURCES.TODAY_CHECKLIST
    ]
  }),
```

Update `seasonChallenge`:

```js
function seasonChallenge({
  id,
  period,
  label,
  description,
  requiredPoints,
  rewardPoints,
  sources = [],
  progressMode = 'points'
}) {
  return Object.freeze({
    id,
    period,
    label,
    description,
    requiredPoints,
    rewardPoints,
    progressMode,
    sources: Object.freeze([...sources])
  });
}
```

Update `getChallengeProgress`:

```js
  if (challenge.progressMode === 'distinct_sources') {
    return challenge.sources
      .filter((source) => normalizeStoredPoints(sources[source]) > 0)
      .length;
  }
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm test -- tests/seasons.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/systems/seasons.js src/commands/seasons.js tests/seasons.test.js
git commit -m "Expand season pass activity sources"
```

---

### Task 3: `/시작하기` Beginner Guide

**Files:**
- Create: `src/commands/start.js`
- Modify: `src/command-registration.js`
- Modify: `src/bot.js`
- Test: `tests/start.test.js`
- Test: `tests/command-registration.test.js`

- [ ] **Step 1: Write failing `/시작하기` tests**

Create `tests/start.test.js`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getStartCommandPayloads,
  handleStartCommand
} from '../src/commands/start.js';

test('시작하기 명령 payload는 초보 가이드를 등록한다', () => {
  const [payload] = getStartCommandPayloads();

  assert.equal(payload.name, '시작하기');
  assert.match(payload.description, /처음|가이드|시작/);
});

test('시작하기는 신입 유저의 다음 단계를 보여준다', async () => {
  const interaction = createStartInteraction();
  const handled = await handleStartCommand(interaction, createServices({
    profile: {
      lastDailyDay: null,
      dailyStreak: 0,
      community: { stats: {} }
    },
    rpgStatus: {
      profile: {
        rpg: { startedAt: 0 }
      }
    },
    fishingStatus: { stats: { totalCatches: 0 } },
    swordStatus: { giftAvailable: true },
    stockOverview: { viewedQuotes: 0 },
    seasonOverview: { profile: { totalPoints: 0 } }
  }));

  assert.equal(handled, true);
  assert.equal(interaction.replies.length, 1);
  assert.match(interaction.replies[0].content, /시작하기/);
  assert.match(interaction.replies[0].content, /출석 받기/);
  assert.match(interaction.replies[0].content, /RPG 시작/);
  assert.match(interaction.replies[0].content, /다음 추천/);
  const labels = interaction.replies[0].components
    .flatMap((row) => row.components.map((button) => button.data.label));
  assert.deepEqual(labels, ['새로고침', '오늘할일', '시즌', '도움말']);
});

function createStartInteraction(customId = null) {
  return {
    commandName: '시작하기',
    customId,
    guildId: 'guild-1',
    user: { id: 'user-1', username: '초보' },
    replies: [],
    updates: [],
    isChatInputCommand: () => customId === null,
    isButton: () => customId !== null,
    inGuild: () => true,
    async reply(payload) {
      this.replies.push(payload);
    },
    async update(payload) {
      this.updates.push(payload);
    }
  };
}

function createServices({ profile, rpgStatus, fishingStatus, swordStatus, stockOverview, seasonOverview }) {
  return {
    economy: {
      async getRpgStatus() {
        return rpgStatus;
      },
      async getSwordStatus() {
        return swordStatus;
      }
    },
    community: {
      async getOverview() {
        return { profile };
      }
    },
    fishing: {
      async getProfile() {
        return fishingStatus;
      }
    },
    stocks: {
      async getPortfolio() {
        return stockOverview;
      }
    },
    seasons: {
      async getOverview() {
        return seasonOverview;
      }
    }
  };
}
```

In `tests/command-registration.test.js`, add:

```js
  assert.ok(result.commands.some((command) => command.name === '시작하기'));
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- tests/start.test.js tests/command-registration.test.js
```

Expected: FAIL because `src/commands/start.js` and registration are absent.

- [ ] **Step 3: Create `src/commands/start.js`**

Implement:

```js
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  SlashCommandBuilder
} from 'discord.js';

const START_BUTTON_PREFIX = 'start_';

export const startCommands = [
  new SlashCommandBuilder()
    .setName('시작하기')
    .setDescription('처음 하는 유저를 위한 희희봇 핵심 루트 가이드를 봅니다.')
];

export function getStartCommandPayloads() {
  return startCommands.map((command) => command.toJSON());
}

export async function handleStartCommand(interaction, services = {}) {
  if (interaction.isButton?.() && interaction.customId?.startsWith(START_BUTTON_PREFIX)) {
    return handleStartButton(interaction, services);
  }

  if (!interaction.isChatInputCommand?.() || interaction.commandName !== '시작하기') {
    return false;
  }

  if (!interaction.inGuild()) {
    await interaction.reply({
      content: '서버에서만 사용할 수 있는 명령어입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  await interaction.reply(await createStartPayload(interaction, services));
  return true;
}

async function handleStartButton(interaction, services) {
  const [, action, ownerId] = interaction.customId.split(':');
  if (ownerId && interaction.user.id !== ownerId) {
    await interaction.reply({
      content: '이 시작하기 버튼은 명령어를 실행한 유저만 누를 수 있습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (action === 'refresh') {
    await interaction.update(await createStartPayload(interaction, services));
    return true;
  }

  const hint = {
    today: '오늘 루트는 `/오늘할일`에서 한 번에 확인하세요.',
    season: '시즌 진행도와 보상은 `/시즌 정보`와 `/시즌 과제`에서 확인하세요.',
    help: '전체 명령어는 `/도움말`에서 분류별로 볼 수 있습니다.'
  }[action];

  if (hint) {
    await interaction.reply({
      content: hint,
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  await interaction.reply({
    content: '알 수 없는 시작하기 버튼입니다.',
    flags: MessageFlags.Ephemeral
  });
  return true;
}

async function createStartPayload(interaction, services) {
  const context = await buildStartContext(interaction, services);
  return {
    content: formatStartGuide(context),
    components: createStartRows(interaction.user.id)
  };
}

async function buildStartContext(interaction, services) {
  const base = {
    guildId: interaction.guildId,
    userId: interaction.user.id,
    username: interaction.user.username
  };
  const [community, rpgStatus, swordStatus, fishingStatus, stockOverview, seasonOverview] = await Promise.all([
    services.community?.getOverview?.(base).catch(() => null),
    services.economy?.getRpgStatus?.(base).catch(() => null),
    services.economy?.getSwordStatus?.(base).catch(() => null),
    services.fishing?.getProfile?.(base.guildId, base.userId, base.username).catch(() => null),
    services.stocks?.getPortfolio?.(base).catch(() => null),
    services.seasons?.getOverview?.(base).catch(() => null)
  ]);

  return {
    user: interaction.user,
    community,
    rpgStatus,
    swordStatus,
    fishingStatus,
    stockOverview,
    seasonOverview
  };
}

function formatStartGuide(context) {
  const steps = buildStartSteps(context);
  const completed = steps.filter((step) => step.complete).length;
  const next = steps.find((step) => !step.complete) ?? steps.at(-1);
  const rows = steps.map((step, index) => {
    const marker = step.complete ? '✅' : step === next ? '🎯' : '⬜';
    return `${marker} ${index + 1}. **${step.label}** — ${step.hint}`;
  });

  return [
    `🚀 **희희봇 시작하기** — ${context.user.username}`,
    `진행도 ${completed}/${steps.length}`,
    ...rows,
    '',
    `다음 추천: ${next.command}`
  ].join('\n');
}

function buildStartSteps(context) {
  const profile = context.community?.profile ?? {};
  const rpg = context.rpgStatus?.profile?.rpg ?? profile.rpg ?? {};
  const totalCatches = context.fishingStatus?.stats?.totalCatches ?? 0;
  const stockTradeCount = context.stockOverview?.tradeCount ?? 0;
  const stockPositions = context.stockOverview?.positions?.length ?? 0;
  return [
    { label: '출석 받기', command: '`/출석`', hint: '하루 첫 보상 받기', complete: profile.lastDailyDay !== null && profile.lastDailyDay !== undefined },
    { label: '프로필 확인', command: '`/프로필`', hint: '내 레벨과 골드 확인', complete: profile.community?.stats?.commandsUsed > 0 },
    { label: 'RPG 시작', command: '`/rpg 시작`', hint: '캐릭터 생성', complete: Number(rpg.startedAt) > 0 },
    { label: '낚시 1회', command: '`/낚시`', hint: '첫 물고기 잡기', complete: totalCatches > 0 },
    { label: '검 선물받기', command: '`/선물받기`', hint: '제련석 받기', complete: context.swordStatus?.giftAvailable === false },
    { label: '주식 거래 입문', command: '`/주식 매수` 또는 `/주식 시세`', hint: '시장 구경하기', complete: stockTradeCount > 0 || stockPositions > 0 },
    { label: '시즌 정보 확인', command: '`/시즌 정보`', hint: '장기 목표 확인', complete: (context.seasonOverview?.profile?.totalPoints ?? 0) > 0 }
  ];
}

function createStartRows(userId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`start:refresh:${userId}`)
        .setLabel('새로고침')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`start:today:${userId}`)
        .setLabel('오늘할일')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`start:season:${userId}`)
        .setLabel('시즌')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`start:help:${userId}`)
        .setLabel('도움말')
        .setStyle(ButtonStyle.Secondary)
    )
  ];
}
```

- [ ] **Step 4: Register and route command**

In `src/command-registration.js`:

```js
import { getStartCommandPayloads } from './commands/start.js';
```

Add `...getStartCommandPayloads(),` near `getTodayCommandPayloads()`.

In `src/bot.js`:

```js
import { handleStartCommand } from './commands/start.js';
```

Add to the command chain before `handleTodayCommand`:

```js
        || await handleStartCommand(interaction, { economy, community, fishing, stocks, seasons })
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm test -- tests/start.test.js tests/command-registration.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/commands/start.js src/command-registration.js src/bot.js tests/start.test.js tests/command-registration.test.js
git commit -m "Add beginner starting guide command"
```

---

### Task 4: Connect `/오늘할일`, Help, and Season Awards

**Files:**
- Modify: `src/commands/today.js`
- Modify: `src/commands/help.js`
- Modify: `tests/today.test.js`
- Modify: `tests/help.test.js`

- [ ] **Step 1: Write failing tests for `/오늘할일` onboarding line and help link**

In `tests/today.test.js`, add to the existing checklist test assertions:

```js
  assert.match(interaction.replies[0].content, /시작하기/);
  assert.match(interaction.replies[0].content, /다음 단계/);
```

In `tests/help.test.js`, add to the home category test or create a new test:

```js
test('도움말 홈은 시작하기를 첫 진입 명령으로 안내한다', async () => {
  const interaction = createHelpInteraction();

  await handleHelpCommand(interaction);

  const text = [
    interaction.replies[0].embeds[0].data.description,
    ...interaction.replies[0].embeds[0].data.fields.map((field) => field.value)
  ].join('\n');
  assert.match(text, /\/시작하기/);
  assert.match(text, /\/오늘할일/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- tests/today.test.js tests/help.test.js
```

Expected: FAIL because `/시작하기` is not shown in those surfaces.

- [ ] **Step 3: Update `/오늘할일` formatter**

In `src/commands/today.js`, add a compact line before `🎁 **일일 보상**`:

```js
    '🚀 **시작하기**',
    formatOnboardingHint({ profile, rpgStatus, swordStatus, seasonOverview }),
    '',
```

Add helper near other formatter helpers:

```js
function formatOnboardingHint({ profile, rpgStatus, swordStatus, seasonOverview }) {
  const rpg = rpgStatus?.profile?.rpg ?? profile.rpg ?? {};
  const steps = [
    { label: '출석 받기', command: '`/출석`', complete: profile.lastDailyDay !== null && profile.lastDailyDay !== undefined },
    { label: 'RPG 시작', command: '`/rpg 시작`', complete: Number(rpg.startedAt) > 0 },
    { label: '검 선물받기', command: '`/선물받기`', complete: swordStatus?.giftAvailable === false },
    { label: '시즌 정보 확인', command: '`/시즌 정보`', complete: (seasonOverview?.profile?.totalPoints ?? 0) > 0 }
  ];
  const next = steps.find((step) => !step.complete);

  if (!next) return '✅ 기본 루트 완료 · `/시즌 과제`로 장기 목표를 이어가세요.';
  return `🎯 다음 단계: **${next.label}** ${next.command} · 전체 루트는 \`/시작하기\``;
}
```

- [ ] **Step 4: Update help home**

In `src/commands/help.js`, change `HELP_CATEGORIES.home.fields` first field to include `/시작하기`:

```js
      { name: '처음 시작', value: '`/시작하기` `/오늘할일` `/도움말 분류:시즌`' },
      { name: '성장/프로필', value: '`/프로필` `/출석` `/랭킹` `/재화정보`' },
```

Keep the other home fields unchanged.

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm test -- tests/today.test.js tests/help.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/commands/today.js src/commands/help.js tests/today.test.js tests/help.test.js
git commit -m "Connect onboarding to daily and help surfaces"
```

---

### Task 5: Award New Season Sources from Existing Actions

**Files:**
- Modify: `src/bot.js`
- Modify: `src/commands/community.js`
- Modify: `src/commands/fishing.js`
- Modify: `src/commands/stocks.js`
- Test: `tests/community.test.js`
- Test: `tests/bot-routing.test.js`
- Test: `tests/fishing.test.js`
- Test: `tests/stocks.test.js`

- [ ] **Step 1: Write focused season-award tests**

Add this import to `tests/bot-routing.test.js`, `tests/community.test.js`, `tests/fishing.test.js`, and `tests/stocks.test.js`:

```js
import { SEASON_POINT_SOURCES } from '../src/systems/seasons.js';
```

In `tests/bot-routing.test.js`, update the automatic-achievement notice test from Task 1:

```js
test('명령 처리 후 새 업적은 자동 지급하고 시즌 업적 출처도 적립한다', async () => {
  const interaction = createCommandInteraction('낚시');
  const community = {
    async grantCompletedAchievements(input) {
      assert.equal(input.guildId, 'guild-1');
      assert.equal(input.userId, 'user-1');
      return {
        totalClaimed: 2,
        totalCoins: 300,
        totalXp: 110,
        displayed: [
          { title: '물비린내 입문' },
          { title: '대장장이의 악몽' }
        ],
        hiddenCount: 0
      };
    }
  };
  const seasons = createSeasonSpy();

  const sent = await sendAutomaticAchievementNotice(interaction, community, { debug() {}, error() {} }, seasons);

  assert.equal(sent, true);
  assert.equal(seasons.awards.length, 1);
  assert.equal(seasons.awards[0].source, SEASON_POINT_SOURCES.ACHIEVEMENT_EARN);
  assert.equal(seasons.awards[0].points, 20);
});

function createSeasonSpy() {
  return {
    awards: [],
    async awardPoints(input) {
      this.awards.push(input);
      return {
        awarded: true,
        points: input.points,
        requestedPoints: input.points,
        totalPoints: input.points,
        sourceLabel: '테스트 시즌',
        newlyClaimableRewards: []
      };
    }
  };
}
```

In `tests/community.test.js`, add a focused handler test below the existing community command handler test:

```js
test('미션 수령은 커뮤니티 미션 시즌 출처를 적립한다', async () => {
  const fixture = await createFixture();

  try {
    await seedProfile(fixture.store, {
      balance: 5_000,
      dailyStreak: 3,
      lastDailyDay: 10,
      lastFortuneXpDay: 10,
      community: {
        daily: { day: 10, lotteryTickets: 1 },
        stats: { lotteryTickets: 5 }
      }
    });
    const interaction = createInteraction('미션', {
      strings: { '종류': 'daily' }
    });
    const seasons = createSeasonSpy();

    const handled = await handleCommunityCommand(interaction, fixture.community, quietLogger, { seasons });

    assert.equal(handled, true);
    assert.equal(seasons.awards.length, 1);
    assert.equal(seasons.awards[0].source, SEASON_POINT_SOURCES.COMMUNITY_MISSION_CLAIM);
    assert.equal(seasons.awards[0].points, 40);
    assert.match(interaction.replied.content, /시즌: 테스트 시즌/);
  } finally {
    await fixture.cleanup();
  }
});
```

In `tests/fishing.test.js`, add:

```js
test('낚시 성공은 시즌 낚시 출처를 적립한다', async () => {
  const fixture = await createFixture({ randomInt: sequenceRandom(1, 0, 20) });

  try {
    const interaction = createInteraction('낚시');
    const seasons = createSeasonSpy();

    const handled = await handleFishingCommand(interaction, fixture.fishing, { seasons });

    assert.equal(handled, true);
    assert.equal(seasons.awards.length, 1);
    assert.equal(seasons.awards[0].source, SEASON_POINT_SOURCES.FISHING_CATCH);
    assert.equal(seasons.awards[0].points, 20);
    assert.match(interaction.replies[0], /시즌: 테스트 시즌/);
  } finally {
    await fixture.cleanup();
  }
});
```

In `tests/stocks.test.js`, add:

```js
test('주식 매수와 매도는 시즌 주식 출처를 적립한다', async () => {
  await withFixture(async ({ stocks, store }) => {
    await seedBalance(store, 'guild-1', 'user-1', '희희', 100_000);
    const seasons = createSeasonSpy();
    const buyInteraction = createStockInteraction('매수', {
      strings: { '종목': '희진전자' },
      integers: { '수량': 1 }
    });
    const sellInteraction = createStockInteraction('매도', {
      strings: { '종목': '희진전자' },
      integers: { '수량': 1 }
    });

    const buyHandled = await handleStockCommand(buyInteraction, stocks, { seasons });
    const sellHandled = await handleStockCommand(sellInteraction, stocks, { seasons });

    assert.equal(buyHandled, true);
    assert.equal(sellHandled, true);
    assert.equal(seasons.awards.length, 2);
    assert.deepEqual(seasons.awards.map((award) => award.source), [
      SEASON_POINT_SOURCES.STOCK_TRADE,
      SEASON_POINT_SOURCES.STOCK_TRADE
    ]);
    assert.deepEqual(seasons.awards.map((award) => award.points), [15, 15]);
    assert.match(buyInteraction.replies[0], /시즌: 테스트 시즌/);
    assert.match(sellInteraction.replies[0], /시즌: 테스트 시즌/);
  });
});
```

Add this helper near each test file's helper section if the file does not already contain it:

```js
function createSeasonSpy() {
  return {
    awards: [],
    async awardPoints(input) {
      this.awards.push(input);
      return {
        awarded: true,
        points: input.points,
        requestedPoints: input.points,
        totalPoints: input.points,
        sourceLabel: '테스트 시즌',
        newlyClaimableRewards: []
      };
    }
  };
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- tests/community.test.js tests/bot-routing.test.js tests/fishing.test.js tests/stocks.test.js
```

Expected: FAIL because handler signatures do not accept `services`, new season sources are not imported, and award calls are not wired.

- [ ] **Step 3: Award achievement season points from `sendAutomaticAchievementNotice`**

In `src/bot.js`, add:

```js
import { SEASON_POINT_SOURCES } from './systems/seasons.js';
```

Change the function signature:

```js
export async function sendAutomaticAchievementNotice(interaction, community, logger = console, seasons = null) {
```

Inside the function, after confirming `result.totalClaimed > 0`, call:

```js
  if (seasons?.awardPoints) {
    await seasons.awardPoints({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      username: interaction.user.username,
      source: SEASON_POINT_SOURCES.ACHIEVEMENT_EARN,
      points: Math.min(30, result.totalClaimed * 10)
    }).catch((error) => logger.debug?.('Failed to award achievement season points:', error));
  }
```

Replace every post-command call with:

```js
await sendAutomaticAchievementNotice(interaction, community, logger, seasons);
```

- [ ] **Step 4: Award community mission season points**

In `src/commands/community.js`, add imports:

```js
import { formatSeasonAwardLine } from './seasons.js';
import { SEASON_POINT_SOURCES } from '../systems/seasons.js';
```

Change the handler and router signatures:

```js
export async function handleCommunityCommand(interaction, community, logger = console, services = {}) {
```

```js
await routeCommunityCommand(interaction, community, services);
```

```js
async function routeCommunityCommand(interaction, community, services = {}) {
```

In the `interaction.commandName === '미션'` branch:

```js
    const seasonAward = await awardCommunityMissionSeasonPoints(services, interaction, result);
    await interaction.reply(formatMissions(result, seasonAward));
    return;
```

Add helper:

```js
async function awardCommunityMissionSeasonPoints(services, interaction, result) {
  if (!services?.seasons?.awardPoints || result.claimed.length <= 0) return null;
  return services.seasons.awardPoints({
    guildId: interaction.guildId,
    userId: interaction.user.id,
    username: interaction.user.username,
    source: SEASON_POINT_SOURCES.COMMUNITY_MISSION_CLAIM,
    points: Math.min(40, result.claimed.length * 15)
  });
}
```

Change `formatMissions`:

```js
function formatMissions(result, seasonAward = null) {
  const missionList = result.type === 'daily' ? result.missions.daily : result.missions.weekly;
  const title = result.type === 'daily' ? '일일 미션' : '주간 미션';
  const body = missionList
    .map((mission) => {
      const mark = mission.claimed ? '✅' : mission.completed ? '🎁' : '⬜';
      return `${mark} **${mission.title}** — ${mission.description} (${mission.progress}) / 보상 ${mission.reward.coins.toLocaleString()}골드, ${mission.reward.xp.toLocaleString()} XP`;
    })
    .join('\n');
  const claimedText = result.claimed.length > 0
    ? `\n\n🎁 수령: ${result.claimed.length}개 / +${result.totalCoins.toLocaleString()}골드, +${result.totalXp.toLocaleString()} XP${result.eventBonus ? ' (이벤트 보너스 적용)' : ''}`
    : '\n\n새로 수령할 완료 미션이 없습니다.';
  const seasonText = formatSeasonAwardLine(seasonAward);

  return [
    `📋 **${title}**`,
    body,
    claimedText.trimStart(),
    `현재 골드: ${result.profile.balance.toLocaleString()}골드`,
    seasonText
  ].filter(Boolean).join('\n');
}
```

In `src/bot.js`, call:

```js
await handleCommunityCommand(interaction, community, logger, { seasons })
```

- [ ] **Step 5: Award fishing season points**

In `src/commands/fishing.js`, add:

```js
import { formatSeasonAwardLine } from './seasons.js';
import { SEASON_POINT_SOURCES } from '../systems/seasons.js';
```

Change signatures:

```js
export async function handleFishingCommand(interaction, fishing, services = {}) {
```

```js
return handleFishingButton(interaction, fishing, services);
```

```js
async function handleFishingButton(interaction, fishing, services = {}) {
```

```js
async function routeFishingCommand(interaction, fishing, services = {}) {
```

In the button `action === 'fish'` branch:

```js
      const seasonAward = await awardFishingSeasonPoints(services, interaction);
      await replyWithFishCard(
        interaction,
        withSeasonAward(formatCatchResult(interaction.user, result), seasonAward),
        result.fish,
        interaction.user.id
      );
      return true;
```

In the slash `/낚시` branch:

```js
    const seasonAward = await awardFishingSeasonPoints(services, interaction);
    await replyWithFishCard(interaction, withSeasonAward(formatCatchResult(user, result), seasonAward), result.fish, user.id);
    return;
```

Add helpers near the formatter helpers:

```js
async function awardFishingSeasonPoints(services, interaction) {
  if (!services?.seasons?.awardPoints) return null;
  return services.seasons.awardPoints({
    guildId: interaction.guildId,
    userId: interaction.user.id,
    username: interaction.user.username,
    source: SEASON_POINT_SOURCES.FISHING_CATCH,
    points: 20
  });
}

function withSeasonAward(content, award) {
  const line = formatSeasonAwardLine(award);
  return line ? `${content}\n${line}` : content;
}
```

In `src/bot.js`, call:

```js
await handleFishingCommand(interaction, fishing, { seasons })
```

- [ ] **Step 6: Award stock season points**

In `src/commands/stocks.js`, add:

```js
import { formatSeasonAwardLine } from './seasons.js';
import { SEASON_POINT_SOURCES } from '../systems/seasons.js';
```

Change signatures:

```js
export async function handleStockCommand(interaction, stocks, services = {}) {
```

```js
return handleStockQuickButton(interaction, stocks, services);
```

```js
await routeStockCommand(interaction, stocks, services);
```

```js
async function routeStockCommand(interaction, stocks, services = {}) {
```

In the `subcommand === '매수'` branch:

```js
    const seasonAward = await awardStockTradeSeasonPoints(services, interaction);
    await replyStockContent(interaction, withSeasonAward(formatBuyResult(user, result), seasonAward), {
      components: createStockQuickRows(user.id)
    });
    return;
```

In the `subcommand === '매도'` branch:

```js
    const seasonAward = await awardStockTradeSeasonPoints(services, interaction);
    await replyStockContent(interaction, withSeasonAward(formatSellResult(user, result), seasonAward), {
      components: createStockQuickRows(user.id)
    });
    return;
```

Add helpers near stock formatter helpers:

```js
async function awardStockTradeSeasonPoints(services, interaction) {
  if (!services?.seasons?.awardPoints) return null;
  return services.seasons.awardPoints({
    guildId: interaction.guildId,
    userId: interaction.user.id,
    username: interaction.user.username,
    source: SEASON_POINT_SOURCES.STOCK_TRADE,
    points: 15
  });
}

function withSeasonAward(content, award) {
  const line = formatSeasonAwardLine(award);
  return line ? `${content}\n${line}` : content;
}
```

In `src/bot.js`, call:

```js
await handleStockCommand(interaction, stocks, { seasons })
```

- [ ] **Step 7: Run focused tests**

Run:

```bash
npm test -- tests/community.test.js tests/bot-routing.test.js tests/fishing.test.js tests/stocks.test.js
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/bot.js src/commands/community.js src/commands/fishing.js src/commands/stocks.js tests/community.test.js tests/bot-routing.test.js tests/fishing.test.js tests/stocks.test.js
git commit -m "Award season progress across core game loops"
```

---

### Task 6: Final Verification and Push

**Files:**
- Verify all modified files.

- [ ] **Step 1: Run full syntax and test verification**

Run:

```bash
node --check src/commands/start.js
npm test
git diff --check
```

Expected: `npm test` reports all tests pass, and `git diff --check` exits with no output.

- [ ] **Step 2: Inspect git status**

Run:

```bash
git status --short --branch
```

Expected: branch is ahead of `origin/main` by the implementation commits and has no unstaged changes.

- [ ] **Step 3: Rebase if remote moved**

Run:

```bash
git fetch origin
git rebase origin/main
npm test
git diff --check
```

Expected: rebase succeeds or reports branch already up to date; tests still pass.

- [ ] **Step 4: Push**

Run:

```bash
git push origin main
git status --short --branch
```

Expected: push succeeds and status shows `main...origin/main`.
