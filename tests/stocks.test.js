import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { getStockCommandPayloads, handleStockCommand } from '../src/commands/stocks.js';
import { createSqliteStore } from '../src/storage/sqlite-store.js';
import {
  StockService,
  getStockCatalog,
  normalizeStockId
} from '../src/systems/stocks.js';

test('주식 명령 payload는 현물과 레버리지 subcommand를 등록한다', () => {
  const [payload] = getStockCommandPayloads();
  const subcommandNames = payload.options.map((option) => option.name);
  const buyCommand = payload.options.find((option) => option.name === '매수');
  const stockOption = buyCommand.options.find((option) => option.name === '종목');
  const leverageCommand = payload.options.find((option) => option.name === '레버리지진입');
  const sideOption = leverageCommand.options.find((option) => option.name === '방향');
  const leverageOption = leverageCommand.options.find((option) => option.name === '배율');

  assert.equal(payload.name, '주식');
  assert.deepEqual(subcommandNames, ['시세', '전체시세', '매수', '매도', '보유', '랭킹', '레버리지진입', '레버리지청산', '레버리지보유']);
  assert.equal(stockOption.required, true);
  assert.equal(stockOption.choices, undefined, '36개 종목은 디스코드 choice 25개 제한 때문에 자유 입력으로 둔다');
  assert.deepEqual(sideOption.choices.map((choice) => choice.value), ['long', 'short']);
  assert.equal(leverageOption.min_value, 1);
  assert.equal(leverageOption.max_value, 100);
});

test('주식 카탈로그는 승인된 밈 종목 36개와 원숭이 계열을 포함한다', () => {
  const catalog = getStockCatalog();
  const names = catalog.map((stock) => stock.name);
  const symbols = catalog.map((stock) => stock.symbol);

  assert.equal(catalog.length, 36);
  assert.equal(new Set(symbols).size, catalog.length, '종목 심볼은 자유 입력 lookup에서 충돌하면 안 된다');
  assert.ok(names.includes('희진전자'));
  assert.ok(names.includes('원숭이닉스'));
  assert.ok(names.includes('원숭이전자'));
  assert.ok(names.includes('원숭이바이오'));
  assert.equal(normalizeStockId('원숭이닉스'), 'monkeynix');
  assert.equal(normalizeStockId('monkeynix'), 'monkeynix');
});

test('시장은 기본 3분 tick 간격이 지나면 결정적 난수로 가격과 뉴스가 갱신된다', async () => {
  await withFixture(async ({ stocks }) => {
    const before = await stocks.getMarket({ guildId: 'guild-1', now: 0 });
    const beforePrice = before.stocks.find((stock) => stock.id === 'heejin_electronics').price;
    const beforeThreeMinutes = await stocks.getMarket({ guildId: 'guild-1', now: 3 * 60 * 1000 - 1 });
    const after = await stocks.getMarket({ guildId: 'guild-1', now: 3 * 60 * 1000 });
    const quote = after.stocks.find((stock) => stock.id === 'heejin_electronics');

    assert.equal(beforePrice, 800);
    assert.equal(beforeThreeMinutes.tickIndex, 0);
    assert.equal(quote.previousPrice, 800);
    assert.equal(quote.price, 860);
    assert.equal(quote.changePercent, 7.5);
    assert.match(quote.news, /밈|뉴스|급등|급락|실적|소문|발표/);
    assert.equal(after.tickIndex, 1);
  }, { randomInt: deterministicRandomInt([750, 99]) });
});

test('매수와 매도는 기존 보유금과 주식 보유량을 원자적으로 갱신한다', async () => {
  await withFixture(async ({ stocks, store }) => {
    await seedBalance(store, 'guild-1', 'user-1', '희희', 100_000);

    const buy = await stocks.buyStock({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      stockId: '희진전자',
      quantity: 10,
      now: 0
    });

    assert.equal(buy.stock.name, '희진전자');
    assert.equal(buy.price, 800);
    assert.equal(buy.subtotal, 8_000);
    assert.equal(buy.fee, 80);
    assert.equal(buy.totalCost, 8_080);
    assert.equal(buy.profile.balance, 91_920);
    assert.equal(buy.holding.quantity, 10);
    assert.equal(buy.holding.averageCost, 800);

    const sell = await stocks.sellStock({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      stockId: '희진전자',
      quantity: 4,
      now: 0
    });

    assert.equal(sell.subtotal, 3_200);
    assert.equal(sell.fee, 32);
    assert.equal(sell.proceeds, 3_168);
    assert.equal(sell.realizedProfit, -32);
    assert.equal(sell.profile.balance, 95_088);
    assert.equal(sell.holding.quantity, 6);
  });
});

test('보유와 랭킹은 현금과 평가액을 합산한 총자산을 보여준다', async () => {
  await withFixture(async ({ stocks, store }) => {
    await seedBalance(store, 'guild-1', 'user-1', '희희', 100_000);
    await seedBalance(store, 'guild-1', 'user-2', '원숭이', 50_000);
    await stocks.buyStock({ guildId: 'guild-1', userId: 'user-1', username: '희희', stockId: '희진전자', quantity: 10, now: 0 });
    await stocks.buyStock({ guildId: 'guild-1', userId: 'user-2', username: '원숭이', stockId: '원숭이닉스', quantity: 20, now: 0 });

    const portfolio = await stocks.getPortfolio({ guildId: 'guild-1', userId: 'user-1', username: '희희', now: 0 });
    const leaderboard = await stocks.getLeaderboard({ guildId: 'guild-1', limit: 5, now: 0 });

    assert.equal(portfolio.positions.length, 1);
    assert.equal(portfolio.positions[0].stock.name, '희진전자');
    assert.equal(portfolio.cash, 91_920);
    assert.equal(portfolio.stockValue, 8_000);
    assert.equal(portfolio.totalAssets, 99_920);
    assert.equal(leaderboard[0].username, '희희');
    assert.equal(leaderboard[0].totalAssets, 99_920);
  });
});

test('시세 응답은 자유 입력에 쓸 수 있는 종목 심볼을 함께 보여준다', async () => {
  await withFixture(async ({ stocks }) => {
    const marketInteraction = createStockInteraction('시세');
    await handleStockCommand(marketInteraction, stocks);

    assert.match(marketInteraction.replies[0], /희진전자.*`HEEL`/);
  });
});

test('보유와 랭킹 응답은 레버리지 평가금을 총자산 구성요소로 표시한다', async () => {
  await withFixture(async ({ stocks, store }) => {
    await seedBalance(store, 'guild-1', 'user-1', '희희', 100_000);
    await stocks.openLeveragedPosition({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      stockId: '희진전자',
      side: 'long',
      leverage: 1,
      margin: 10_000,
      now: 0
    });

    const portfolioInteraction = createStockInteraction('보유', {
      user: { id: 'user-1', username: '희희' }
    });
    await handleStockCommand(portfolioInteraction, stocks);

    assert.match(portfolioInteraction.replies[0], /레버리지 평가금: \*\*10,000원\*\*/);
    assert.match(portfolioInteraction.replies[0], /총자산: \*\*99,800원\*\*/);

    const leaderboardInteraction = createStockInteraction('랭킹', {
      user: { id: 'user-1', username: '희희' }
    });
    await handleStockCommand(leaderboardInteraction, stocks);

    assert.match(leaderboardInteraction.replies[0], /레버리지 10,000원/);
  }, { randomInt: deterministicRandomInt([0, 99]) });
});

test('레버리지 포지션은 롱/숏과 1~100배 배율을 지원하고 증거금 수수료를 차감한다', async () => {
  await withFixture(async ({ stocks, store }) => {
    await seedBalance(store, 'guild-1', 'user-1', '희희', 100_000);

    const long = await stocks.openLeveragedPosition({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      stockId: '원숭이닉스',
      side: 'long',
      leverage: 100,
      margin: 10_000,
      now: 0
    });
    const short = await stocks.openLeveragedPosition({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      stockId: '도훈건설',
      side: 'short',
      leverage: 7,
      margin: 5_000,
      now: 1
    });

    assert.equal(long.position.side, 'long');
    assert.equal(long.position.leverage, 100);
    assert.equal(long.fee, 200);
    assert.equal(long.profile.balance, 89_800);
    assert.equal(short.position.side, 'short');
    assert.equal(short.position.leverage, 7);
    assert.equal(short.fee, 100);
    assert.equal(short.profile.balance, 84_700);

    const leveragePortfolio = await stocks.getLeveragePortfolio({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      now: 1
    });
    assert.equal(leveragePortfolio.positions.length, 2);
    assert.equal(leveragePortfolio.marginTotal, 15_000);
  });
});

test('레버리지 포지션은 가격 변동에 배율 손익을 적용하고 100퍼센트 손실이면 자동 청산한다', async () => {
  await withFixture(async ({ stocks, store }) => {
    await seedBalance(store, 'guild-1', 'user-1', '희희', 100_000);
    const opened = await stocks.openLeveragedPosition({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      stockId: '희진전자',
      side: 'short',
      leverage: 100,
      margin: 10_000,
      now: 0
    });

    assert.equal(opened.position.entryPrice, 800);

    const portfolio = await stocks.getLeveragePortfolio({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      now: 3 * 60 * 1000
    });

    assert.equal(portfolio.positions.length, 0);
    assert.equal(portfolio.liquidated.length, 1);
    assert.equal(portfolio.liquidated[0].positionId, opened.position.id);
    assert.equal(portfolio.realizedLeveragedProfit, -10_000);
    assert.equal(portfolio.cash, 89_800);
  }, { randomInt: deterministicRandomInt([100, 100]) });
});

test('레버리지 청산은 미실현 손익을 보유금으로 정산한다', async () => {
  await withFixture(async ({ stocks, store }) => {
    await seedBalance(store, 'guild-1', 'user-1', '희희', 100_000);
    const opened = await stocks.openLeveragedPosition({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      stockId: '희진전자',
      side: 'long',
      leverage: 100,
      margin: 10_000,
      now: 0
    });
    const closed = await stocks.closeLeveragedPosition({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      positionId: opened.position.id,
      now: 3 * 60 * 1000
    });

    assert.equal(closed.liquidated, false);
    assert.equal(closed.position.currentPrice, 808);
    assert.equal(closed.realizedProfit, 10_000);
    assert.equal(closed.payout, 20_000);
    assert.equal(closed.profile.balance, 109_800);
  }, { randomInt: deterministicRandomInt([100, 100]) });
});

async function withFixture(callback, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'heeheebot-stocks-'));
  const store = createSqliteStore(join(directory, 'profiles.sqlite'));
  const stocks = new StockService(store, options);

  try {
    await callback({ store, stocks });
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
}

async function seedBalance(store, guildId, userId, username, balance) {
  await store.update((data) => {
    data.guilds ??= {};
    data.guilds[guildId] ??= {};
    const guild = data.guilds[guildId];
    guild.users ??= {};
    guild.users[userId] = {
      userId,
      username,
      level: 1,
      xp: 0,
      totalXp: 0,
      balance,
      lastMessageRewardAt: 0,
      lastDailyAt: 0,
      lastDailyDay: null,
      dailyStreak: 0,
      lastFirstMessageBonusDay: null,
      createdAt: 1
    };
  });
}

function deterministicRandomInt(values) {
  let index = 0;
  return (min, max) => {
    const value = values[index % values.length];
    index += 1;
    return Math.min(max, Math.max(min, value));
  };
}

function createStockInteraction(subcommand, options = {}) {
  const {
    guildId = 'guild-1',
    user = { id: 'user-1', username: '희희' },
    strings = {},
    integers = {},
    targetUser = null
  } = options;
  const replies = [];

  return {
    commandName: '주식',
    guildId,
    user,
    replies,
    deferred: false,
    replied: false,
    isChatInputCommand: () => true,
    inGuild: () => true,
    options: {
      getSubcommand: () => subcommand,
      getString: (name) => strings[name] ?? null,
      getInteger: (name) => integers[name] ?? null,
      getUser: () => targetUser
    },
    async reply(payload) {
      this.replied = true;
      replies.push(typeof payload === 'string' ? payload : payload.content);
    },
    async followUp(payload) {
      replies.push(typeof payload === 'string' ? payload : payload.content);
    }
  };
}
