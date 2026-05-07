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
import { CommunityService } from '../src/systems/community.js';

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
    '서버이벤트'
  ]);
  assert.ok(commands.find((command) => command.name === '복권').options.some((option) => option.name === '구매'));
  assert.ok(commands.find((command) => command.name === '상점').options.some((option) => option.name === '목록'));
  assert.ok(commands.find((command) => command.name === '서버이벤트').options.some((option) => option.name === '시작'));
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

test('복권은 구매액을 잭팟에 누적하고 추첨으로 당첨자에게 지급한다', async () => {
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
    assert.equal(draw.winner.userId, 'user-1');
    assert.equal(draw.payout, 2_000);
    assert.equal(draw.lottery.jackpot, 1_000);
  } finally {
    await fixture.cleanup();
  }
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

test('커뮤니티 명령 핸들러는 복권 구매와 미션 응답을 반환한다', async () => {
  const fixture = await createFixture();

  try {
    await seedProfile(fixture.store, { balance: 5_000 });
    const lotteryInteraction = createInteraction('복권', {
      subcommand: '구매',
      integers: { '장수': 1 }
    });
    const missionInteraction = createInteraction('미션', {
      strings: { '종류': 'daily' }
    });

    const lotteryHandled = await handleCommunityCommand(lotteryInteraction, fixture.community, quietLogger);
    const missionHandled = await handleCommunityCommand(missionInteraction, fixture.community, quietLogger);

    assert.equal(lotteryHandled, true);
    assert.match(lotteryInteraction.replied.content, /복권 구매 완료/);
    assert.equal(missionHandled, true);
    assert.match(missionInteraction.replied.content, /일일 미션/);
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

function createInteraction(commandName, options = {}) {
  return {
    commandName,
    guildId: 'guild-1',
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
      }
    },
    isChatInputCommand: () => true,
    inGuild: () => true,
    async reply(payload) {
      this.replied = typeof payload === 'string' ? { content: payload } : payload;
    }
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
