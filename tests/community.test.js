import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  getCommunityCommandPayloads,
  handleCommunityCommand
} from '../src/commands/community.js';
import { createSqliteStore } from '../src/storage/sqlite-store.js';
import {
  CommunityService,
  getAchievementCategories,
  getCommunityTitles,
  getNextLotteryDrawAt
} from '../src/systems/community.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const quietLogger = { error() {} };

test('커뮤니티 명령 payload는 업적, 칭호, 미션, 복권, 상점, 서버이벤트를 등록한다', () => {
  const commands = getCommunityCommandPayloads();

  assert.deepEqual(commands.map((command) => command.name), [
    '업적',
    '칭호',
    '미션',
    '복권',
    '상점',
    '서버이벤트',
    '활동요약'
  ]);
  assert.ok(commands.find((command) => command.name === '복권').options.some((option) => option.name === '구매'));
  assert.ok(commands.find((command) => command.name === '복권').options.some((option) => option.name === '대량구매'));
  assert.ok(commands.find((command) => command.name === '복권').options.some((option) => option.name === '자동추첨'));
  assert.ok(commands.find((command) => command.name === '상점').options.some((option) => option.name === '목록'));
  assert.ok(commands.find((command) => command.name === '서버이벤트').options.some((option) => option.name === '시작'));
  assert.ok(commands.find((command) => command.name === '활동요약').options.some((option) => option.name === '대상'));
  assert.ok(commands.find((command) => command.name === '업적').options.some((option) => option.name === '분류'));
  assert.ok(commands.find((command) => command.name === '업적').options.some((option) => option.name === '보기'));
  assert.ok(commands.find((command) => command.name === '칭호').options.some((option) => option.name === '보기'));
  assert.ok(commands.find((command) => command.name === '칭호').options.find((option) => option.name === '선택').choices.length <= 25);
  assert.ok(getAchievementCategories().some((category) => category.id === 'games' && category.label === '게임'));
  assert.ok(getAchievementCategories().some((category) => category.id === 'rpg' && category.label === 'RPG'));
  assert.ok(getAchievementCategories().some((category) => category.id === 'fishing' && category.label === '낚시'));
  assert.ok(getAchievementCategories().some((category) => category.id === 'sword' && category.label === '검강화'));
  assert.ok(getCommunityTitles().some((title) => title.id === 'tycoon' && title.rarityLabel === '전설'));
  assert.ok(getCommunityTitles().some((title) => title.id === 'pet_guardian' && title.category === 'tamagotchi'));
});

test('업적은 기존 프로필과 커뮤니티 통계를 기준으로 보상과 칭호를 수령한다', async () => {
  const fixture = await createFixture();

  try {
    await seedProfile(fixture.store, {
      level: 2,
      balance: 10_000,
      dailyStreak: 7,
      community: {
        stats: {
          casinoPlays: 10,
          lotteryTickets: 5,
          missionsCompleted: 5,
          eventsHosted: 1
        }
      }
    });

    const result = await fixture.community.claimAchievements({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '업적러'
    });
    const equip = await fixture.community.equipTitle({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '업적러',
      titleId: 'gambler'
    });

    assert.equal(result.claimed.length, 7);
    assert.ok(result.totalCoins > 0);
    assert.ok(result.titles.find((title) => title.id === 'gambler').owned);
    assert.equal(equip.equippedTitle.id, 'gambler');
    assert.ok(result.achievements.length >= 20);
    assert.equal(result.achievements.find((achievement) => achievement.id === 'chat_100').category, 'activity');
    assert.match(result.achievements.find((achievement) => achievement.id === 'chat_100').progressBar, /^[█░]{8}$/);
    assert.ok(result.achievements.find((achievement) => achievement.id === 'balance_100000').percent >= 10);
  } finally {
    await fixture.cleanup();
  }
});

test('전역 업적은 RPG, 낚시, 검강화, 주식, 다마고치 기록을 한 도감에서 수령한다', async () => {
  const fixture = await createFixture();

  try {
    await seedProfile(fixture.store, {
      rpg: {
        startedAt: 1,
        level: 10,
        bossKills: { goblin_king: 1 },
        dungeonClears: { forest: 5 },
        craftedItems: 5
      },
      sword: {
        highestLevel: 10,
        destructions: 1,
        battleWins: 10
      }
    });
    await seedGlobalActivityProfiles(fixture.store);

    const result = await fixture.community.claimAchievements({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '전역러'
    });
    const claimedIds = result.claimed.map((achievement) => achievement.id);

    assert.ok(claimedIds.includes('rpg_started'));
    assert.ok(claimedIds.includes('rpg_dungeon_5'));
    assert.ok(claimedIds.includes('fishing_catch_10'));
    assert.ok(claimedIds.includes('sword_level_10'));
    assert.ok(claimedIds.includes('stock_trade_10'));
    assert.ok(claimedIds.includes('tamagotchi_care_30'));
    assert.ok(result.titles.find((title) => title.id === 'rpg_adventurer').owned);
    assert.ok(result.titles.find((title) => title.id === 'dungeon_breaker').owned);
    assert.ok(result.titles.find((title) => title.id === 'angler').owned);
    assert.ok(result.titles.find((title) => title.id === 'blade_master').owned);
    assert.ok(result.titles.find((title) => title.id === 'market_maker').owned);
    assert.ok(result.titles.find((title) => title.id === 'pet_guardian').owned);

    const overview = await fixture.community.getOverview({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '전역러'
    });
    assert.equal(overview.achievements.find((achievement) => achievement.id === 'fishing_collection_20').percent, 100);
    assert.equal(overview.achievements.find((achievement) => achievement.id === 'stock_profit_10000').category, 'stocks');
  } finally {
    await fixture.cleanup();
  }
});

test('미션은 일일/주간 완료 조건을 판정하고 완료 보상을 중복 없이 지급한다', async () => {
  const now = DAY_MS * 10;
  const fixture = await createFixture();

  try {
    await seedProfile(fixture.store, {
      balance: 5_000,
      dailyStreak: 3,
      lastDailyDay: 10,
      lastFortuneXpDay: 10,
      community: {
        daily: {
          day: 10,
          lotteryTickets: 1
        },
        stats: {
          lotteryTickets: 5
        }
      }
    });

    const daily = await fixture.community.claimMissions({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '미션러',
      type: 'daily',
      now
    });
    const dailyAgain = await fixture.community.claimMissions({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '미션러',
      type: 'daily',
      now
    });
    const weekly = await fixture.community.claimMissions({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '미션러',
      type: 'weekly',
      now
    });

    assert.equal(daily.claimed.length, 3);
    assert.equal(daily.totalCoins, 500);
    assert.equal(dailyAgain.claimed.length, 0);
    assert.equal(weekly.claimed.length, 3);
    assert.equal(weekly.totalCoins, 3_000);
  } finally {
    await fixture.cleanup();
  }
});

test('복권은 번호를 발급하고 등수별 당첨금과 이월 잭팟을 처리한다', async () => {
  const fixture = await createFixture({ randomInt: () => 1 });

  try {
    await seedProfile(fixture.store, { balance: 5_000 });
    await fixture.community.startEvent({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '복권러',
      type: 'lottery_bonus',
      durationMinutes: 10,
      now: 1_000
    });

    const buy = await fixture.community.buyLotteryTickets({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '복권러',
      quantity: 2,
      now: 2_000
    });
    const draw = await fixture.community.drawLottery({
      guildId: 'guild-1',
      now: 3_000
    });

    assert.equal(buy.totalCost, 1_000);
    assert.equal(buy.jackpotAdded, 1_000);
    assert.equal(buy.lottery.jackpot, 2_000);
    assert.deepEqual(buy.entries[0].numbers, [1, 2, 3, 4, 5, 6]);
    assert.deepEqual(draw.winningNumbers, [1, 2, 3, 4, 5, 6]);
    assert.equal(draw.bonusNumber, 7);
    assert.equal(draw.tierSummaries.find((tier) => tier.id === 'first').winnerCount, 2);
    assert.equal(draw.tierSummaries.find((tier) => tier.id === 'first').prizePerTicket, 700);
    assert.equal(draw.winner.userId, 'user-1');
    assert.equal(draw.payout, 1_400);
    assert.equal(draw.totalPaid, 1_400);
    assert.equal(draw.lottery.jackpot, 1_000);
  } finally {
    await fixture.cleanup();
  }
});

test('복권은 당첨자가 없으면 당첨금을 지급하지 않고 잭팟 전액을 이월한다', async () => {
  const fixture = await createFixture({
    randomInt: sequenceRandomInt([
      1, 1, 1, 1, 1, 1, // 구매 번호: 1, 2, 3, 4, 5, 6
      7, 7, 7, 7, 7, 7, 7 // 추첨 번호: 7, 8, 9, 10, 11, 12 + 보너스 13
    ])
  });

  try {
    await seedProfile(fixture.store, { balance: 5_000 });

    const buy = await fixture.community.buyLotteryTickets({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '이월러',
      quantity: 1,
      now: 2_000
    });
    const draw = await fixture.community.drawLottery({
      guildId: 'guild-1',
      now: 3_000
    });

    assert.deepEqual(buy.entries[0].numbers, [1, 2, 3, 4, 5, 6]);
    assert.deepEqual(draw.winningNumbers, [7, 8, 9, 10, 11, 12]);
    assert.equal(draw.totalPaid, 0);
    assert.equal(draw.payout, 0);
    assert.equal(draw.winner, null);
    assert.equal(draw.topWinners.length, 0);
    assert.equal(draw.rollover, draw.jackpotBefore);
    assert.equal(draw.lottery.jackpot, 2_400);
  } finally {
    await fixture.cleanup();
  }
});

test('복권 자동 추첨은 예정 시간이 지나면 판매된 회차를 자동으로 추첨한다', async () => {
  const fixture = await createFixture({ randomInt: () => 1 });
  const buyAt = Date.parse('2026-05-09T11:59:00Z'); // 2026-05-09 20:59 KST
  const drawAt = getNextLotteryDrawAt(buyAt);

  try {
    await seedProfile(fixture.store, { balance: 5_000 });
    await fixture.community.configureLotteryAutoDraw({
      guildId: 'guild-1',
      enabled: true,
      channelId: 'channel-1',
      now: buyAt
    });
    await fixture.community.buyLotteryTickets({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '자동러',
      quantity: 1,
      now: buyAt
    });

    const before = await fixture.community.drawDueLotteries({
      now: drawAt - 1
    });
    const due = await fixture.community.drawDueLotteries({
      now: drawAt
    });
    const after = await fixture.community.getOverview({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '자동러',
      now: drawAt
    });

    assert.deepEqual(before, []);
    assert.equal(due.length, 1);
    assert.equal(due[0].automatic, true);
    assert.equal(due[0].channelId, 'channel-1');
    assert.equal(due[0].lottery.totalTickets, 0);
    assert.equal(due[0].lottery.nextDrawAt, Date.parse('2026-05-13T12:00:00Z'));
    assert.equal(after.lottery.lastDraw.automatic, true);
  } finally {
    await fixture.cleanup();
  }
});

test('복권 다음 추첨은 수요일과 토요일 21시 중 가장 가까운 시각이다', () => {
  assert.equal(
    getNextLotteryDrawAt(Date.parse('2026-05-10T00:00:00Z')),
    Date.parse('2026-05-13T12:00:00Z')
  );
  assert.equal(
    getNextLotteryDrawAt(Date.parse('2026-05-13T12:00:00Z')),
    Date.parse('2026-05-16T12:00:00Z')
  );
  assert.equal(
    getNextLotteryDrawAt(Date.parse('2026-05-16T12:00:00Z')),
    Date.parse('2026-05-20T12:00:00Z')
  );
});

test('상점은 배지와 칭호를 구매하고 서버 이벤트는 채팅 XP 보너스를 지급한다', async () => {
  const fixture = await createFixture();

  try {
    await seedProfile(fixture.store, { balance: 10_000 });

    const buyBadge = await fixture.community.buyShopItem({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '상점러',
      itemId: 'badge_luck'
    });
    const buyTitle = await fixture.community.buyShopItem({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '상점러',
      itemId: 'title_vip'
    });
    const equip = await fixture.community.equipTitle({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '상점러',
      titleId: 'vip'
    });
    await fixture.community.startEvent({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '상점러',
      type: 'chat_xp',
      durationMinutes: 10,
      now: 10_000
    });
    const bonus = await fixture.community.awardChatEventBonus({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '상점러',
      baseXp: 50,
      now: 11_000
    });

    assert.ok(buyBadge.profile.community.cosmetics.badges.includes('badge_luck'));
    assert.ok(buyTitle.profile.community.ownedTitles.includes('vip'));
    assert.equal(equip.equippedTitle.id, 'vip');
    assert.equal(bonus.bonusXp, 50);
    assert.equal(bonus.profile.totalXp, 50);
  } finally {
    await fixture.cleanup();
  }
});

test('활동 기록은 최근 7일 채팅/명령어 XP 요약을 만든다', async () => {
  const now = DAY_MS * 20;
  const fixture = await createFixture();

  try {
    await fixture.community.recordActivity({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '활동러',
      activity: 'chat',
      amount: 2,
      xpGained: 30,
      now
    });
    await fixture.community.recordActivity({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '활동러',
      activity: 'command',
      commandName: '프로필',
      xpGained: 5,
      now
    });
    await fixture.community.recordActivity({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '활동러',
      activity: 'command',
      commandName: '/프로필',
      xpGained: 6,
      now: now - DAY_MS
    });
    await fixture.community.recordActivity({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '활동러',
      activity: 'command',
      commandName: '출석',
      xpGained: 7,
      now: now - DAY_MS
    });
    await fixture.community.recordActivity({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '활동러',
      activity: 'chat',
      xpGained: 99,
      now: now - 8 * DAY_MS
    });

    const summary = await fixture.community.getWeeklyActivitySummary({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '활동러',
      now
    });

    assert.equal(summary.range.days, 7);
    assert.equal(summary.days.length, 7);
    assert.equal(summary.totals.messages, 2);
    assert.equal(summary.totals.commands, 3);
    assert.equal(summary.totals.chatXp, 30);
    assert.equal(summary.totals.commandXp, 18);
    assert.equal(summary.totals.xp, 48);
    assert.equal(summary.totals.activeDays, 2);
    assert.deepEqual(summary.topCommands[0], { name: '프로필', count: 2 });
  } finally {
    await fixture.cleanup();
  }
});

test('활동요약 명령은 오래 걸릴 수 있는 조회 전에 먼저 defer하고 결과를 editReply한다', async () => {
  const events = [];
  const interaction = createInteraction('활동요약');
  interaction.deferReply = async function deferReply() {
    events.push('defer');
    this.deferred = true;
  };
  interaction.editReply = async function editReply(payload) {
    events.push('edit');
    this.edited = typeof payload === 'string' ? { content: payload } : payload;
    this.replied = this.edited;
  };
  const community = {
    async getWeeklyActivitySummary(input) {
      events.push(`summary:${input.userId}`);
      return createActivitySummary({ username: input.username });
    }
  };

  const handled = await handleCommunityCommand(interaction, community, quietLogger);

  assert.equal(handled, true);
  assert.deepEqual(events, ['defer', 'summary:user-1', 'edit']);
  assert.match(interaction.edited.content, /최근 7일 활동 요약/);
});

test('커뮤니티 명령 핸들러는 복권 구매와 미션 응답을 반환한다', async () => {
  const fixture = await createFixture();

  try {
    await seedProfile(fixture.store, { balance: 100_000 });
    const lotteryInteraction = createInteraction('복권', {
      subcommand: '구매',
      integers: { '장수': 1 }
    });
    const lotteryBulkInteraction = createInteraction('복권', {
      subcommand: '대량구매',
      integers: { '장수': 60 }
    });
    const lotteryAutoInteraction = createInteraction('복권', {
      subcommand: '자동추첨',
      booleans: { '사용': true },
      channel: { id: 'channel-9' }
    });
    const achievementInteraction = createInteraction('업적', {
      strings: { '분류': 'activity', '보기': 'all' }
    });
    const titleInteraction = createInteraction('칭호', {
      strings: { '보기': 'all' }
    });
    const missionInteraction = createInteraction('미션', {
      strings: { '종류': 'daily' }
    });
    await fixture.community.recordActivity({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '테스터',
      activity: 'chat',
      xpGained: 12
    });
    const activityInteraction = createInteraction('활동요약');

    const lotteryHandled = await handleCommunityCommand(lotteryInteraction, fixture.community, quietLogger);
    const lotteryBulkHandled = await handleCommunityCommand(lotteryBulkInteraction, fixture.community, quietLogger);
    const lotteryAutoHandled = await handleCommunityCommand(lotteryAutoInteraction, fixture.community, quietLogger);
    const achievementHandled = await handleCommunityCommand(achievementInteraction, fixture.community, quietLogger);
    const titleHandled = await handleCommunityCommand(titleInteraction, fixture.community, quietLogger);
    const missionHandled = await handleCommunityCommand(missionInteraction, fixture.community, quietLogger);
    const activityHandled = await handleCommunityCommand(activityInteraction, fixture.community, quietLogger);

    assert.equal(lotteryHandled, true);
    assert.match(lotteryInteraction.replied.content, /복권 구매 완료/);
    assert.equal(lotteryBulkHandled, true);
    assert.match(lotteryBulkInteraction.replied.content, /60장 구매/);
    assert.equal(lotteryAutoHandled, true);
    assert.match(lotteryAutoInteraction.replied.content, /자동 추첨 설정 완료/);
    assert.match(lotteryAutoInteraction.replied.content, /수요일·토요일 21:00 KST/);
    assert.match(lotteryAutoInteraction.replied.content, /<#channel-9>/);
    assert.equal(achievementHandled, true);
    assert.match(achievementInteraction.replied.content, /업적 도감/);
    assert.match(achievementInteraction.replied.content, /보기: 활동 \/ 전체/);
    assert.equal(titleHandled, true);
    assert.match(titleInteraction.replied.content, /칭호 도감/);
    assert.match(titleInteraction.replied.content, /보유 \d+\/\d+/);
    assert.equal(missionHandled, true);
    assert.match(missionInteraction.replied.content, /일일 미션/);
    assert.equal(activityHandled, true);
    assert.match(activityInteraction.replied.content, /최근 7일 활동 요약/);
    assert.match(activityInteraction.replied.content, /활동 XP 합계: \*\*12 XP\*\*/);
  } finally {
    await fixture.cleanup();
  }
});

async function seedProfile(store, profile = {}) {
  await store.update((data) => {
    data.guilds['guild-1'] = {
      users: {
        'user-1': {
          userId: 'user-1',
          username: '테스터',
          level: 1,
          xp: 0,
          totalXp: 0,
          balance: 0,
          lastMessageRewardAt: 0,
          lastDailyAt: 0,
          lastDailyDay: null,
          dailyStreak: 0,
          lastFirstMessageBonusDay: null,
          lastFortuneXpDay: null,
          createdAt: 1,
          ...profile
        }
      }
    };
  });
}

async function seedGlobalActivityProfiles(store) {
  await store.update((data) => {
    const guild = data.guilds['guild-1'];
    guild.fishing = {
      users: {
        'user-1': {
          rod: { level: 10 },
          stats: { totalCatches: 10 },
          collection: Object.fromEntries(Array.from({ length: 20 }, (_, index) => [`fish-${index + 1}`, 1])),
          battle: { wins: 5 }
        }
      }
    };
    guild.stocks = {
      users: {
        'user-1': {
          tradeCount: 10,
          realizedProfit: 10_000,
          leveragedTradeCount: 5
        }
      }
    };
    guild.tamagotchi = {
      users: {
        'user-1': {
          counters: { totalCareActions: 30 },
          codex: { dailyCompletions: 7 },
          room: { unlockedItemIds: ['basic_mat', 'lamp', 'poster'] },
          growth: { adultBranchId: 'balanced' }
        }
      }
    };
  });
}

function createInteraction(commandName, options = {}) {
  return {
    commandName,
    guildId: 'guild-1',
    channelId: options.channelId ?? 'channel-1',
    user: {
      id: 'user-1',
      username: '테스터',
      toString: () => '<@user-1>'
    },
    options: {
      getSubcommand() {
        return options.subcommand;
      },
      getInteger(name, required = false) {
        if (name in (options.integers ?? {})) return options.integers[name];
        if (required) throw new Error(`${name} integer option missing`);
        return null;
      },
      getString(name, required = false) {
        if (name in (options.strings ?? {})) return options.strings[name];
        if (required) throw new Error(`${name} string option missing`);
        return null;
      },
      getBoolean(name, required = false) {
        if (name in (options.booleans ?? {})) return options.booleans[name];
        if (required) throw new Error(`${name} boolean option missing`);
        return null;
      },
      getChannel(name) {
        return name === '채널' ? options.channel ?? null : null;
      },
      getUser(name) {
        return name === '대상' ? options.targetUser ?? null : null;
      }
    },
    isChatInputCommand: () => true,
    inGuild: () => true,
    async reply(payload) {
      this.replied = typeof payload === 'string' ? { content: payload } : payload;
    }
  };
}

function createActivitySummary({ username = '테스터' } = {}) {
  return {
    profile: { username },
    range: {
      days: 7,
      startDate: '1970-01-01',
      endDate: '1970-01-07'
    },
    totals: {
      messages: 0,
      commands: 0,
      xp: 0,
      chatXp: 0,
      commandXp: 0,
      activeDays: 0
    },
    topCommands: [],
    days: Array.from({ length: 7 }, (_, index) => ({
      date: `1970-01-0${index + 1}`,
      messages: 0,
      commands: 0,
      xp: 0
    }))
  };
}

function sequenceRandomInt(values) {
  let index = 0;
  return (min, max) => {
    const value = values[index] ?? values.at(-1) ?? min;
    index += 1;
    return Math.min(max, Math.max(min, value));
  };
}

async function createFixture(options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'heeheebot-community-'));
  const store = createSqliteStore(join(directory, 'profiles.sqlite'));
  const community = new CommunityService(store, options);

  return {
    store,
    community,
    async cleanup() {
      store.close();
      await rm(directory, { recursive: true, force: true });
    }
  };
}
