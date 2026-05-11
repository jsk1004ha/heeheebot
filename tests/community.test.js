import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  getCommunityCommandPayloads,
  handleCommunityAutocomplete,
  handleCommunityCommand
} from '../src/commands/community.js';
import * as achievementSystem from '../src/systems/achievements.js';
import { createSqliteStore } from '../src/storage/sqlite-store.js';
import {
  CommunityService,
  getAchievementCategories,
  getCommunityTitles,
  getLotteryMaxPurchaseQuantity,
  getLotteryMaxRoundTickets,
  getLotteryMaxRoundTicketsPerUser,
  getNextLotteryDrawAt
} from '../src/systems/community.js';
import { SEASON_POINT_SOURCES } from '../src/systems/seasons.js';

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
  const lotteryCommand = commands.find((command) => command.name === '복권');
  const lotteryBuyQuantity = lotteryCommand.options.find((option) => option.name === '구매').options.find((option) => option.name === '장수');
  const lotteryBulkQuantity = lotteryCommand.options.find((option) => option.name === '대량구매').options.find((option) => option.name === '장수');
  assert.equal(lotteryBuyQuantity.max_value, getLotteryMaxPurchaseQuantity());
  assert.equal(lotteryBulkQuantity.max_value, getLotteryMaxPurchaseQuantity());
  assert.ok(commands.find((command) => command.name === '상점').options.some((option) => option.name === '목록'));
  assert.ok(commands.find((command) => command.name === '서버이벤트').options.some((option) => option.name === '시작'));
  assert.ok(commands.find((command) => command.name === '활동요약').options.some((option) => option.name === '대상'));
  assert.ok(commands.find((command) => command.name === '업적').options.some((option) => option.name === '분류'));
  assert.ok(commands.find((command) => command.name === '업적').options.some((option) => option.name === '보기'));
  assert.ok(commands.find((command) => command.name === '칭호').options.some((option) => option.name === '보기'));
  assert.equal(commands.find((command) => command.name === '칭호').options.find((option) => option.name === '선택').autocomplete, true);
  assert.equal(commands.find((command) => command.name === '칭호').options.find((option) => option.name === '선택').choices, undefined);
  assert.ok(getAchievementCategories().some((category) => category.id === 'games' && category.label === '게임'));
  assert.ok(getAchievementCategories().some((category) => category.id === 'rpg' && category.label === 'RPG'));
  assert.ok(getAchievementCategories().some((category) => category.id === 'fishing' && category.label === '낚시'));
  assert.ok(getAchievementCategories().some((category) => category.id === 'sword' && category.label === '검강화'));
  assert.ok(getCommunityTitles().some((title) => title.id === 'tycoon' && title.rarityLabel === '전설'));
  assert.ok(getCommunityTitles().some((title) => title.id === 'pet_guardian' && title.category === 'tamagotchi'));
});

test('칭호 선택 autocomplete는 보유 칭호만 이름으로 보여주고 내부 id를 노출하지 않는다', async () => {
  const fixture = await createFixture();

  try {
    await seedProfile(fixture.store, {
      community: {
        ownedTitles: ['vip', 'angler', 'blade_master'],
        equippedTitle: 'angler'
      }
    });

    const interaction = createAutocompleteInteraction('칭호', '선택', '강');

    const handled = await handleCommunityAutocomplete(interaction, fixture.community);

    assert.equal(handled, true);
    assert.ok(interaction.choices.length <= 25);
    assert.ok(interaction.choices.some((choice) => choice.name.includes('강태공') && choice.value === 'angler'));
    assert.equal(interaction.choices.some((choice) => /angler|blade_master|vip/.test(choice.name)), false);
    assert.equal(interaction.choices.some((choice) => choice.value === 'tycoon'), false);
  } finally {
    await fixture.cleanup();
  }
});

test('업적 보상 총량은 화폐 통합 경제를 흔들지 않게 카테고리별로 제한된다', () => {
  assert.equal(typeof achievementSystem.getAchievementRewardSummary, 'function');

  const summary = achievementSystem.getAchievementRewardSummary();

  assert.ok(summary.count >= 40);
  assert.ok(summary.totalCoins <= 60_000);
  assert.ok(summary.maxCoins <= 6_000);
  assert.equal(summary.hiddenCoins, 0);
  assert.ok(summary.byCategory.rpg.coins <= 2_000);
  assert.ok(summary.byCategory.fishing.coins <= 2_000);
  assert.ok(summary.byCategory.sword.coins <= 2_000);
  assert.ok(summary.byCategory.stocks.coins <= 1_000);
  assert.ok(summary.byCategory.tamagotchi.coins <= 1_500);
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

test('히든 업적과 히든 칭호는 조건 달성 전에는 숨기고 달성 후에는 수령된다', async () => {
  const fixture = await createFixture();

  try {
    await seedProfile(fixture.store, {
      sword: {
        destructions: 2
      }
    });
    await seedHiddenActivityProfiles(fixture.store, {
      hiddenFish: false,
      revivals: 0
    });

    const locked = await fixture.community.getOverview({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '히든러'
    });
    const lockedSword = locked.achievements.find((achievement) => achievement.id === 'hidden_sword_destroy_3');
    const lockedTitle = locked.titles.find((title) => title.id === 'blacksmith_nightmare');

    assert.equal(lockedSword.hidden, true);
    assert.equal(lockedSword.revealed, false);
    assert.equal(lockedSword.title, '???');
    assert.equal(lockedSword.progress, '???');
    assert.equal(lockedSword.percent, 0);
    assert.equal(lockedTitle.hidden, true);
    assert.equal(lockedTitle.owned, false);

    await updateLinkedProfile(fixture.store, {
      sword: {
        destructions: 3
      }
    });
    await seedHiddenActivityProfiles(fixture.store, {
      hiddenFish: true,
      revivals: 1
    });

    const claimed = await fixture.community.claimAchievements({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '히든러'
    });
    const claimedIds = claimed.claimed.map((achievement) => achievement.id);

    assert.ok(claimedIds.includes('hidden_sword_destroy_3'));
    assert.ok(claimedIds.includes('hidden_fishing_shadow'));
    assert.ok(claimedIds.includes('hidden_tamagotchi_revival'));
    assert.equal(claimed.claimed.find((achievement) => achievement.id === 'hidden_sword_destroy_3').revealed, true);
    assert.ok(claimed.titles.find((title) => title.id === 'blacksmith_nightmare').owned);
    assert.ok(claimed.titles.find((title) => title.id === 'abyss_angler').owned);
    assert.ok(claimed.titles.find((title) => title.id === 'reborn_guardian').owned);
  } finally {
    await fixture.cleanup();
  }
});


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
    assert.equal(first.claimed.some((achievement) => achievement.id === 'level_2'), true);
    assert.equal(first.totalCoins, 1_300);
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


test('자동 업적 수령은 보상으로 새로 완료된 업적도 같은 지급에 포함한다', async () => {
  const fixture = await createFixture();

  try {
    await seedProfile(fixture.store, {
      balance: 9_500,
      community: { stats: { commandsUsed: 50 } }
    });

    const first = await fixture.community.grantCompletedAchievements({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '연쇄러'
    });
    const second = await fixture.community.grantCompletedAchievements({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '연쇄러'
    });
    const claimedIds = first.claimed.map((achievement) => achievement.id);

    assert.deepEqual(claimedIds, ['commands_50', 'level_2', 'balance_10000']);
    assert.equal(first.totalClaimed, 3);
    assert.equal(first.totalCoins, 1_800);
    assert.equal(first.totalXp, 170);
    assert.equal(first.levelReward, 200);
    assert.equal(first.profile.balance, 11_500);
    assert.equal(first.profile.community.ownedTitles.includes('commander'), true);
    assert.equal(first.profile.community.ownedTitles.includes('rich'), true);
    assert.equal(second.claimed.length, 0);
    assert.equal(second.totalCoins, 0);
    assert.equal(second.totalXp, 0);
    assert.equal(second.profile.balance, first.profile.balance);
  } finally {
    await fixture.cleanup();
  }
});

test('새로 달성 가능한 업적 조회는 보상 수령 없이 알림 대상만 반환한다', async () => {
  const fixture = await createFixture();

  try {
    await seedProfile(fixture.store, {
      community: {
        stats: {
          commandsUsed: 50
        }
      }
    });

    const notice = await fixture.community.getClaimableAchievements({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '알림러'
    });
    const overview = await fixture.community.getOverview({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '알림러'
    });

    assert.equal(notice.total, 1);
    assert.equal(notice.achievements[0].id, 'commands_50');
    assert.equal(overview.achievements.find((achievement) => achievement.id === 'commands_50').claimed, false);
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
    assert.equal(buy.lottery.jackpot, 200_001_000);
    assert.deepEqual(buy.entries[0].numbers, [1, 2, 3, 4, 5, 6]);
    assert.deepEqual(draw.winningNumbers, [1, 2, 3, 4, 5, 6]);
    assert.equal(draw.bonusNumber, 7);
    assert.equal(draw.tierSummaries.find((tier) => tier.id === 'first').winnerCount, 2);
    assert.equal(draw.tierSummaries.find((tier) => tier.id === 'first').prizePerTicket, 100_000_500);
    assert.equal(draw.winner.userId, 'user-1');
    assert.equal(draw.payout, 200_001_000);
    assert.equal(draw.totalPaid, 200_001_000);
    assert.equal(draw.rollover, 0);
    assert.equal(draw.lottery.jackpot, 200_000_000);
  } finally {
    await fixture.cleanup();
  }
});

test('복권은 보너스 번호로 2등을 판정하고 3등·하위 당첨금을 지급한다', async () => {
  const fixture = await createFixture({
    randomInt: sequenceRandomInt([
      1, 1, 1, 1, 1, 1, 1 // 추첨 번호: 1, 2, 3, 4, 5, 6 + 보너스 7
    ])
  });

  try {
    await seedLotteryRound(fixture.store, {
      jackpot: 200_000_000,
      tickets: {
        'user-1': {
          username: '보너스러',
          entries: [{ id: 'L000001', numbers: [1, 2, 3, 4, 5, 7], purchasedAt: 1_000 }]
        },
        'user-2': {
          username: '삼등러',
          entries: [{ id: 'L000002', numbers: [1, 2, 3, 4, 5, 8], purchasedAt: 1_000 }]
        },
        'user-3': {
          username: '소액러',
          entries: [{ id: 'L000003', numbers: [1, 2, 3, 8, 9, 10], purchasedAt: 1_000 }]
        }
      }
    });

    const draw = await fixture.community.drawLottery({
      guildId: 'guild-1',
      now: 3_000
    });

    const second = draw.tierSummaries.find((tier) => tier.id === 'second');
    const third = draw.tierSummaries.find((tier) => tier.id === 'third');
    const fifth = draw.tierSummaries.find((tier) => tier.id === 'fifth');

    assert.deepEqual(draw.winningNumbers, [1, 2, 3, 4, 5, 6]);
    assert.equal(draw.bonusNumber, 7);
    assert.equal(second.winnerCount, 1);
    assert.equal(second.prizePerTicket, 20_000_000);
    assert.equal(third.winnerCount, 1);
    assert.equal(third.prizePerTicket, 1_000_000);
    assert.equal(fifth.winnerCount, 1);
    assert.equal(fifth.prizePerTicket, 5_000);
    assert.equal(draw.totalPaid, 21_005_000);
    assert.equal(draw.rollover, 200_000_000);
    assert.equal(draw.lottery.jackpot, 200_000_000);
    assert.equal(draw.topWinners[0].username, '보너스러');
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
    assert.equal(draw.lottery.jackpot, 200_000_450);
  } finally {
    await fixture.cleanup();
  }
});

test('복권은 안전 한도 안에서 100장 초과 구매를 허용한다', async () => {
  const fixture = await createFixture({ randomInt: () => 1 });

  try {
    await seedProfile(fixture.store, { balance: 100_000 });

    const buy = await fixture.community.buyLotteryTickets({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '대량러',
      quantity: 150,
      now: 2_000
    });

    assert.equal(buy.quantity, 150);
    assert.equal(buy.entries.length, 5);
    assert.equal(buy.hiddenCount, 145);
    assert.equal(buy.totalCost, 75_000);
    assert.equal(buy.jackpotAdded, 67_500);
    assert.equal(buy.lottery.jackpot, 200_067_500);
    assert.equal(buy.lottery.totalTickets, 150);
    assert.equal(buy.lottery.participants[0].count, 150);
    assert.equal(buy.lottery.participants[0].entries.length, 5);
    assert.equal(buy.profile.balance, 25_000);

    const draw = await fixture.community.drawLottery({
      guildId: 'guild-1',
      now: 3_000
    });
    assert.equal(draw.totalTickets, 150);
    assert.ok(draw.tierSummaries.find((tier) => tier.id === 'first').winnerCount >= 5);
  } finally {
    await fixture.cleanup();
  }
});

test('복권은 과도한 대량 구매를 티켓 생성 전에 거부한다', async () => {
  const fixture = await createFixture({
    randomInt() {
      throw new Error('구매 한도 초과 시 번호를 생성하지 않아야 합니다.');
    }
  });

  try {
    await seedProfile(fixture.store, { balance: 1_000_000_000_000 });

    await assert.rejects(
      () => fixture.community.buyLotteryTickets({
        guildId: 'guild-1',
        userId: 'user-1',
        username: '초대량러',
        quantity: getLotteryMaxPurchaseQuantity() + 1,
        now: 2_000
      }),
      /한 번에 최대/
    );

    const overview = await fixture.community.getOverview({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '초대량러'
    });
    assert.equal(overview.profile.balance, 1_000_000_000_000);
    assert.equal(overview.lottery.totalTickets, 0);
  } finally {
    await fixture.cleanup();
  }
});

test('복권은 회차당 개인 구매 한도를 적용한다', async () => {
  const fixture = await createFixture({ randomInt: () => 1 });

  try {
    await seedProfile(fixture.store, { balance: 1_000_000 });

    const first = await fixture.community.buyLotteryTickets({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '누적러',
      quantity: getLotteryMaxRoundTicketsPerUser() - 100,
      now: 2_000
    });

    await assert.rejects(
      () => fixture.community.buyLotteryTickets({
        guildId: 'guild-1',
        userId: 'user-1',
        username: '누적러',
        quantity: 101,
        now: 2_001
      }),
      /1인당 최대/
    );

    assert.equal(first.lottery.participants[0].count, getLotteryMaxRoundTicketsPerUser() - 100);
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


test('미션 일일 완료 수령은 시즌 포인트를 지급하고 응답에 시즌 라인을 표시한다', async () => {
  const today = Math.floor(Date.now() / DAY_MS);
  const fixture = await createFixture();

  try {
    await seedProfile(fixture.store, {
      lastDailyDay: today,
      lastFortuneXpDay: today,
      community: {
        daily: {
          day: today,
          lotteryTickets: 1
        }
      }
    });
    const seasons = createSeasonSpy();
    const interaction = createInteraction('미션', {
      strings: { '종류': 'daily' }
    });

    const handled = await handleCommunityCommand(interaction, fixture.community, quietLogger, { seasons });

    assert.equal(handled, true);
    assert.deepEqual(seasons.awards.map(({ source, points }) => ({ source, points })), [
      { source: SEASON_POINT_SOURCES.COMMUNITY_MISSION_CLAIM, points: 40 }
    ]);
    assert.match(interaction.replied.content, /시즌: 테스트 시즌/);
  } finally {
    await fixture.cleanup();
  }
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
    const lotteryStatusInteraction = createInteraction('복권', {
      subcommand: '현황'
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
    const lotteryStatusHandled = await handleCommunityCommand(lotteryStatusInteraction, fixture.community, quietLogger);
    const lotteryAutoHandled = await handleCommunityCommand(lotteryAutoInteraction, fixture.community, quietLogger);
    const achievementHandled = await handleCommunityCommand(achievementInteraction, fixture.community, quietLogger);
    const titleHandled = await handleCommunityCommand(titleInteraction, fixture.community, quietLogger);
    const missionHandled = await handleCommunityCommand(missionInteraction, fixture.community, quietLogger);
    const activityHandled = await handleCommunityCommand(activityInteraction, fixture.community, quietLogger);

    assert.equal(lotteryHandled, true);
    assert.match(lotteryInteraction.replied.content, /복권 구매 완료/);
    assert.equal(lotteryBulkHandled, true);
    assert.match(lotteryBulkInteraction.replied.content, /60장 구매/);
    assert.equal(lotteryStatusHandled, true);
    assert.match(lotteryStatusInteraction.replied.content, new RegExp(`1회 최대 ${getLotteryMaxPurchaseQuantity().toLocaleString()}장`));
    assert.match(lotteryStatusInteraction.replied.content, new RegExp(`1인 최대 ${getLotteryMaxRoundTicketsPerUser().toLocaleString()}장`));
    assert.match(lotteryStatusInteraction.replied.content, new RegExp(`전체 최대 ${getLotteryMaxRoundTickets().toLocaleString()}장`));
    assert.match(lotteryStatusInteraction.replied.content, /1등 6개 번호 일치 잭팟 100% 분배/);
    assert.match(lotteryStatusInteraction.replied.content, /2등 5개 번호 \+ 보너스 일치/);
    assert.match(lotteryStatusInteraction.replied.content, /20,000,000골드 고정/);
    assert.match(lotteryStatusInteraction.replied.content, /3등 5개 번호 일치/);
    assert.match(lotteryStatusInteraction.replied.content, /1,000,000골드 고정/);
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

async function seedLotteryRound(store, { jackpot, tickets }) {
  await store.update((data) => {
    data.guilds['guild-1'] = {
      users: Object.fromEntries(
        Object.entries(tickets).map(([userId, ticket]) => [
          userId,
          createStoredProfile(userId, ticket.username)
        ])
      ),
      community: {
        lottery: {
          jackpot,
          tickets: Object.fromEntries(
            Object.entries(tickets).map(([userId, ticket]) => [
              userId,
              {
                userId,
                username: ticket.username,
                count: ticket.entries.length,
                entries: ticket.entries,
                legacyCount: 0
              }
            ])
          ),
          totalTickets: Object.values(tickets).reduce((sum, ticket) => sum + ticket.entries.length, 0),
          nextTicketSeq: Object.values(tickets).reduce((sum, ticket) => sum + ticket.entries.length, 0),
          settings: {
            autoDrawEnabled: true,
            autoDrawChannelId: null
          }
        }
      }
    };
  });
}

function createStoredProfile(userId, username, profile = {}) {
  return {
    userId,
    username,
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
  };
}

async function updateLinkedProfile(store, patch = {}) {
  await store.update((data) => {
    const profile = data.accounts?.users?.['user-1'];
    if (!profile) throw new Error('linked profile missing');
    Object.assign(profile, patch);
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

async function seedHiddenActivityProfiles(store, { hiddenFish = false, revivals = 0 } = {}) {
  await store.update((data) => {
    const guild = data.guilds['guild-1'];
    guild.fishing = {
      users: {
        'user-1': {
          collection: hiddenFish ? { hidden_fish_shadow: 1 } : {}
        }
      }
    };
    guild.tamagotchi = {
      users: {
        'user-1': {
          counters: { revivals }
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

function createAutocompleteInteraction(commandName, focusedName, focusedValue) {
  return {
    commandName,
    guildId: 'guild-1',
    user: {
      id: 'user-1',
      username: '테스터'
    },
    choices: [],
    isAutocomplete() {
      return true;
    },
    inGuild() {
      return true;
    },
    options: {
      getFocused(withName) {
        return withName ? { name: focusedName, value: focusedValue } : focusedValue;
      }
    },
    async respond(choices) {
      this.choices = choices;
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

function createSeasonSpy() {
  const awards = [];
  return {
    awards,
    async awardPoints(input) {
      awards.push(input);
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
