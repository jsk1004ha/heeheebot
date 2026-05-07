import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  getStockCommandPayloads,
  handleStockAutocomplete,
  handleStockCommand
} from '../src/commands/stocks.js';
import { createSqliteStore } from '../src/storage/sqlite-store.js';
import {
  StockService,
  getStockCatalog,
  normalizeStockId
} from '../src/systems/stocks.js';

test('주식 명령 payload는 현물, 지정가, 알림, 신규상장, 레버리지 subcommand를 등록한다', () => {
  const [payload] = getStockCommandPayloads();
  const subcommandNames = payload.options.map((option) => option.name);
  const buyCommand = payload.options.find((option) => option.name === '매수');
  const stockOption = buyCommand.options.find((option) => option.name === '종목');
  const sellCommand = payload.options.find((option) => option.name === '매도');
  const sellStockOption = sellCommand.options.find((option) => option.name === '종목');
  const leverageCommand = payload.options.find((option) => option.name === '레버리지진입');
  const leverageStockOption = leverageCommand.options.find((option) => option.name === '종목');
  const sideOption = leverageCommand.options.find((option) => option.name === '방향');
  const leverageOption = leverageCommand.options.find((option) => option.name === '배율');

  assert.equal(payload.name, '주식');
  assert.deepEqual(subcommandNames, [
    '시세',
    '전체시세',
    '신규상장',
    '매수',
    '매도',
    '지정가매수',
    '지정가매도',
    '주문',
    '주문취소',
    '알림설정',
    '알림',
    '알림삭제',
    '거래내역',
    '뉴스',
    '차트',
    '보유',
    '랭킹',
    '레버리지진입',
    '레버리지청산',
    '레버리지보유'
  ]);
  assert.equal(stockOption.required, true);
  assert.equal(stockOption.choices, undefined, '48개 종목은 디스코드 choice 25개 제한 때문에 autocomplete로 고른다');
  assert.equal(stockOption.autocomplete, true);
  assert.equal(sellStockOption.autocomplete, true);
  assert.equal(leverageStockOption.autocomplete, true);
  assert.deepEqual(sideOption.choices.map((choice) => choice.value), ['long', 'short']);
  assert.equal(leverageOption.min_value, 1);
  assert.equal(leverageOption.max_value, 100);
});

test('주식 종목 autocomplete는 매수 후보를 검색하고 매도는 보유 종목을 우선 제안한다', async () => {
  await withFixture(async ({ stocks, store }) => {
    const buyInteraction = createStockAutocompleteInteraction('매수', '원숭이');

    const handledBuy = await handleStockAutocomplete(buyInteraction, stocks);

    assert.equal(handledBuy, true);
    assert.ok(buyInteraction.choices.length <= 25);
    assert.ok(buyInteraction.choices.some((choice) => choice.name.includes('원숭이닉스') && choice.value === 'monkeynix'));

    await seedBalance(store, 'guild-1', 'user-1', '희희', 100_000);
    await stocks.buyStock({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      stockId: '희진전자',
      quantity: 3,
      now: 0
    });

    const sellInteraction = createStockAutocompleteInteraction('매도', '');

    const handledSell = await handleStockAutocomplete(sellInteraction, stocks);

    assert.equal(handledSell, true);
    assert.deepEqual(sellInteraction.choices, [
      {
        name: '희진전자 · HEEL · 보유 3주',
        value: 'heejin_electronics'
      }
    ]);
  });
});

test('주식 autocomplete는 서버 밖에서는 빈 후보만 반환한다', async () => {
  await withFixture(async ({ stocks }) => {
    const interaction = createStockAutocompleteInteraction('매수', '희진', {
      guildId: null,
      inGuild: false
    });

    const handled = await handleStockAutocomplete(interaction, stocks);

    assert.equal(handled, true);
    assert.deepEqual(interaction.choices, []);
  });
});

test('주식 카탈로그는 기존 36개와 신규상장 후보 12개, 원숭이 계열을 포함한다', () => {
  const catalog = getStockCatalog();
  const names = catalog.map((stock) => stock.name);
  const symbols = catalog.map((stock) => stock.symbol);

  assert.equal(catalog.length, 48);
  assert.equal(new Set(symbols).size, catalog.length, '종목 심볼은 자유 입력 lookup에서 충돌하면 안 된다');
  assert.ok(names.includes('희진전자'));
  assert.ok(names.includes('희진AI'));
  assert.ok(names.includes('원숭이닉스'));
  assert.ok(names.includes('원숭이전자'));
  assert.ok(names.includes('원숭이바이오'));
  assert.ok(names.includes('원숭이항공'));
  assert.ok(names.includes('도훈리츠'));
  assert.equal(catalog.find((stock) => stock.name === '희진AI').listedFromTick, 2);
  assert.equal(normalizeStockId('원숭이닉스'), 'monkeynix');
  assert.equal(normalizeStockId('monkeynix'), 'monkeynix');
});

test('신규상장 후보는 예정 tick 전에는 매매되지 않고 상장 tick에 시장에 등장한다', async () => {
  await withFixture(async ({ stocks, store }) => {
    await seedBalance(store, 'guild-1', 'user-1', '희희', 100_000);
    const before = await stocks.getMarket({ guildId: 'guild-1', now: 0 });
    const listings = await stocks.getListings({ guildId: 'guild-1', now: 0 });

    assert.equal(before.stocks.some((stock) => stock.name === '희진AI'), false);
    assert.ok(listings.upcoming.some((stock) => stock.name === '희진AI' && stock.listedFromTick === 2));
    await assert.rejects(
      () => stocks.buyStock({
        guildId: 'guild-1',
        userId: 'user-1',
        username: '희희',
        stockId: '희진AI',
        quantity: 1,
        now: 0
      }),
      /아직 상장되지 않았습니다/
    );

    const after = await stocks.getMarket({ guildId: 'guild-1', now: 6 * 60 * 1000 });
    const ipo = after.stocks.find((stock) => stock.name === '희진AI');

    assert.equal(ipo.price, 1_240);
    assert.equal(ipo.status, 'listed');
    assert.equal(ipo.eventType, 'ipo');
    assert.match(ipo.news, /신규상장/);
  }, { randomInt: deterministicRandomInt([0, 99]), autoIpoChanceBps: 0 });
});

test('신규 종목은 운영자가 추가하지 않아도 시장 tick에서 자동 생성되어 상장된다', async () => {
  await withFixture(async ({ stocks, store }) => {
    await stocks.getMarket({ guildId: 'guild-1', now: 0 });
    const before = await stocks.getListings({ guildId: 'guild-1', now: 0 });

    assert.equal(before.recent.some((stock) => stock.dynamic), false);

    const after = await stocks.getMarket({ guildId: 'guild-1', now: 15 * 60 * 1000 });
    const listings = await stocks.getListings({ guildId: 'guild-1', now: 15 * 60 * 1000 });
    const autoIpo = listings.recent.find((stock) => stock.dynamic);

    assert.ok(autoIpo);
    assert.match(autoIpo.id, /^auto_ipo_/);
    assert.match(autoIpo.news, /자동 신규상장/);
    assert.equal(after.stocks.some((stock) => stock.id === autoIpo.id), true);

    await seedBalance(store, 'guild-1', 'user-1', '희희', 100_000);
    const buy = await stocks.buyStock({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      stockId: autoIpo.name,
      quantity: 1,
      now: 15 * 60 * 1000
    });

    assert.equal(buy.stock.id, autoIpo.id);
    assert.equal(buy.holding.quantity, 1);
  }, {
    randomInt: automaticIpoRandomInt,
    ipoRandomInt: automaticIpoRandomInt,
    autoIpoChanceBps: 10_000
  });
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

test('시장은 급등 이벤트와 상장폐지 이벤트를 quote 상태에 남긴다', async () => {
  await withFixture(async ({ stocks }) => {
    await stocks.getMarket({ guildId: 'guild-1', now: 0 });
    const market = await stocks.getMarket({ guildId: 'guild-1', now: 3 * 60 * 1000 });
    const surge = market.stocks.find((stock) => stock.id === 'heejin_electronics');

    assert.equal(surge.price, 954);
    assert.equal(surge.eventType, 'surge');
    assert.match(surge.news, /급등 이벤트/);
  }, {
    randomInt: (min, max) => (min === 1 && max === 100 ? 1 : max)
  });

  await withFixture(async ({ stocks }) => {
    await stocks.getMarket({ guildId: 'guild-1', now: 0 });
    const market = await stocks.getMarket({ guildId: 'guild-1', now: 3 * 60 * 1000 });
    const delisted = market.stocks.find((stock) => stock.id === 'monkeynix');

    assert.equal(delisted.status, 'delisted');
    assert.equal(delisted.price, 0);
    assert.equal(delisted.eventType, 'delisted');
    assert.match(delisted.news, /상장폐지/);
  }, { randomInt: (min) => min });
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

test('지정가 매수 주문은 골드를 예약하고 목표가에 닿으면 체결과 차액 환불을 처리한다', async () => {
  await withFixture(async ({ stocks, store }) => {
    await seedBalance(store, 'guild-1', 'user-1', '희희', 10_000);

    const order = await stocks.placeLimitOrder({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      stockId: '희진전자',
      side: 'buy',
      quantity: 10,
      limitPrice: 795,
      now: 0
    });
    const beforePortfolio = await stocks.getPortfolio({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      now: 0
    });

    assert.equal(order.status, 'open');
    assert.equal(order.reservedCash, 8_030);
    assert.equal(beforePortfolio.cash, 1_970);

    await stocks.getMarket({ guildId: 'guild-1', now: 3 * 60 * 1000 });
    const orders = await stocks.getLimitOrders({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      now: 3 * 60 * 1000
    });
    const portfolio = await stocks.getPortfolio({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      now: 3 * 60 * 1000
    });

    assert.equal(orders.open.length, 0);
    assert.equal(orders.recent[0].status, 'filled');
    assert.equal(orders.recent[0].fillPrice, 792);
    assert.equal(portfolio.cash, 2_000);
    assert.equal(portfolio.positions[0].quantity, 10);
    assert.equal(portfolio.positions[0].averageCost, 792);
  }, { randomInt: deterministicRandomInt([-100, 99]) });
});

test('기존 지정가 매수 예약금은 95% 골드로 정산되고 주문은 취소된다', async () => {
  await withFixture(async ({ stocks, store }) => {
    await seedLegacyStockState(store, {
      balance: 100,
      stockCash: 1_000,
      limitOrders: {
        legacy_buy: {
          id: 'legacy_buy',
          userId: 'user-1',
          username: '희희',
          stockId: 'heejin_electronics',
          side: 'buy',
          quantity: 2,
          limitPrice: 1_000,
          status: 'open',
          createdAt: 1,
          reservedCash: 2_000
        }
      }
    });

    const orders = await stocks.getLimitOrders({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      now: 0
    });
    const portfolio = await stocks.getPortfolio({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      now: 0
    });
    const secondPortfolio = await stocks.getPortfolio({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      now: 0
    });

    assert.equal(orders.open.length, 0);
    assert.equal(orders.recent[0].status, 'cancelled');
    assert.equal(orders.recent[0].reservedCash, 0);
    assert.equal(orders.recent[0].cancelReason, '통합 골드 정산');
    assert.equal(portfolio.cash, 2_950);
    assert.equal(secondPortfolio.cash, 2_950);
  });
});

test('지정가 매도 주문은 주식을 예약하고 취소하면 보유량을 돌려준다', async () => {
  await withFixture(async ({ stocks, store }) => {
    await seedBalance(store, 'guild-1', 'user-1', '희희', 100_000);
    await stocks.buyStock({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      stockId: '희진전자',
      quantity: 10,
      now: 0
    });

    const order = await stocks.placeLimitOrder({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      stockId: '희진전자',
      side: 'sell',
      quantity: 4,
      limitPrice: 850,
      now: 0
    });
    const reserved = await stocks.getPortfolio({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      now: 0
    });

    assert.equal(reserved.positions[0].quantity, 6);

    const canceled = await stocks.cancelLimitOrder({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      orderId: order.id,
      now: 0
    });
    const restored = await stocks.getPortfolio({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      now: 0
    });

    assert.equal(canceled.status, 'cancelled');
    assert.equal(restored.positions[0].quantity, 10);
  });
});

test('가격 알림은 목표가를 넘으면 트리거 상태로 바뀐다', async () => {
  await withFixture(async ({ stocks }) => {
    const alert = await stocks.setPriceAlert({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      stockId: '희진전자',
      condition: 'above',
      targetPrice: 805,
      now: 0
    });

    assert.equal(alert.status, 'active');

    await stocks.getMarket({ guildId: 'guild-1', now: 3 * 60 * 1000 });
    const alerts = await stocks.getPriceAlerts({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      now: 3 * 60 * 1000
    });

    assert.equal(alerts.active.length, 0);
    assert.equal(alerts.triggered[0].id, alert.id);
    assert.equal(alerts.triggered[0].triggeredPrice, 808);
    assert.equal(alerts.triggered[0].status, 'triggered');
  }, { randomInt: deterministicRandomInt([100, 99]) });
});

test('거래내역은 현물, 지정가 체결, 레버리지 진입과 청산을 최근순으로 기록한다', async () => {
  await withFixture(async ({ stocks, store }) => {
    await seedBalance(store, 'guild-1', 'user-1', '희희', 100_000);
    await stocks.buyStock({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      stockId: '희진전자',
      quantity: 2,
      now: 0
    });
    await stocks.sellStock({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      stockId: '희진전자',
      quantity: 1,
      now: 1
    });
    await stocks.placeLimitOrder({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      stockId: '희진전자',
      side: 'buy',
      quantity: 1,
      limitPrice: 900,
      now: 2
    });
    await stocks.getMarket({ guildId: 'guild-1', now: 3 * 60 * 1000 });
    const opened = await stocks.openLeveragedPosition({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      stockId: '희진전자',
      side: 'long',
      leverage: 2,
      margin: 1_000,
      now: 3 * 60 * 1000
    });
    await stocks.closeLeveragedPosition({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      positionId: opened.position.id,
      now: 3 * 60 * 1000 + 1
    });

    const history = await stocks.getTradeHistory({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      limit: 10,
      now: 3 * 60 * 1000 + 1
    });

    assert.deepEqual(history.entries.slice(0, 5).map((entry) => entry.type), [
      'leverage_close',
      'leverage_open',
      'limit_buy_fill',
      'sell',
      'buy'
    ]);
    assert.equal(history.entries[2].stock.name, '희진전자');
    assert.equal(history.entries[2].quantity, 1);
    assert.equal(history.entries[2].price, 800);
  }, { randomInt: deterministicRandomInt([0, 99]) });
});

test('뉴스 공시는 시장 이벤트를 모으고 차트는 최근 tick 가격 기록을 반환한다', async () => {
  await withFixture(async ({ stocks }) => {
    await stocks.getMarket({ guildId: 'guild-1', now: 0 });
    await stocks.getMarket({ guildId: 'guild-1', now: 3 * 60 * 1000 });

    const news = await stocks.getNews({ guildId: 'guild-1', limit: 5, now: 3 * 60 * 1000 });
    const chart = await stocks.getChart({
      guildId: 'guild-1',
      stockId: '희진전자',
      points: 5,
      now: 3 * 60 * 1000
    });

    assert.ok(news.entries.some((entry) => entry.stock.name === '희진전자' && entry.type === 'surge'));
    assert.match(news.entries[0].message, /공시|뉴스|상장폐지|신규상장/);
    assert.equal(chart.stock.name, '희진전자');
    assert.ok(chart.history.length >= 2);
    assert.equal(chart.history.at(-1).price, 954);
  }, {
    randomInt: (min, max) => {
      if (min === 1 && max === 100) return 1;
      if (min < 0 && max > 0) return max;
      return min;
    }
  });
});

test('보유와 랭킹은 골드와 평가액을 합산한 총자산을 보여준다', async () => {
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
    assert.match(marketInteraction.replies[0], new RegExp(`${getStockCatalog().length}개 전체`));
  });
});

test('주식 확장 명령은 신규상장, 지정가 주문, 알림 응답을 출력한다', async () => {
  const ipoInteraction = createStockInteraction('신규상장');
  const limitBuyInteraction = createStockInteraction('지정가매수', {
    strings: { 종목: '희진전자' },
    integers: { 수량: 2, 가격: 700 }
  });
  const ordersInteraction = createStockInteraction('주문');
  const alertInteraction = createStockInteraction('알림설정', {
    strings: { 종목: '희진전자', 조건: 'above' },
    integers: { 가격: 900 }
  });
  const alertsInteraction = createStockInteraction('알림');
  const historyInteraction = createStockInteraction('거래내역');
  const newsInteraction = createStockInteraction('뉴스');
  const chartInteraction = createStockInteraction('차트', {
    strings: { 종목: '희진전자' }
  });
  const fakeStocks = {
    async getListings() {
      return {
        recent: [createQuoteForTest('희진AI', 'HEAI', 0, { eventType: 'ipo', listedFromTick: 2 })],
        upcoming: [createQuoteForTest('원숭이항공', 'MOAI', 0, { listedFromTick: 5 })]
      };
    },
    async placeLimitOrder() {
      return {
        id: 'ord-1',
        side: 'buy',
        stock: createQuoteForTest('희진전자', 'HEEL'),
        quantity: 2,
        limitPrice: 700,
        reservedCash: 1_414,
        status: 'open'
      };
    },
    async getLimitOrders() {
      return {
        open: [
          {
            id: 'ord-1',
            side: 'buy',
            stock: createQuoteForTest('희진전자', 'HEEL'),
            quantity: 2,
            limitPrice: 700,
            status: 'open'
          }
        ],
        recent: []
      };
    },
    async setPriceAlert() {
      return {
        id: 'al-1',
        condition: 'above',
        stock: createQuoteForTest('희진전자', 'HEEL'),
        targetPrice: 900,
        status: 'active'
      };
    },
    async getPriceAlerts() {
      return {
        active: [
          {
            id: 'al-1',
            condition: 'above',
            stock: createQuoteForTest('희진전자', 'HEEL'),
            targetPrice: 900,
            status: 'active'
          }
        ],
        triggered: []
      };
    },
    async getTradeHistory() {
      return {
        entries: [
          {
            id: 'tr-1',
            type: 'buy',
            stock: createQuoteForTest('희진전자', 'HEEL'),
            quantity: 2,
            price: 800,
            fee: 16,
            total: 1_616,
            realizedProfit: 0,
            at: 1
          }
        ]
      };
    },
    async getNews() {
      return {
        entries: [
          {
            id: 'news-1',
            type: 'surge',
            stock: createQuoteForTest('희진전자', 'HEEL', 19.25),
            title: '급등 공시',
            message: '급등 공시: 희진전자 로켓 장착',
            tickIndex: 7,
            at: 1
          }
        ]
      };
    },
    async getChart() {
      return {
        stock: createQuoteForTest('희진전자', 'HEEL'),
        history: [
          { tickIndex: 0, price: 800, at: 0 },
          { tickIndex: 1, price: 820, at: 1 },
          { tickIndex: 2, price: 780, at: 2 }
        ]
      };
    }
  };

  await handleStockCommand(ipoInteraction, fakeStocks);
  await handleStockCommand(limitBuyInteraction, fakeStocks);
  await handleStockCommand(ordersInteraction, fakeStocks);
  await handleStockCommand(alertInteraction, fakeStocks);
  await handleStockCommand(alertsInteraction, fakeStocks);
  await handleStockCommand(historyInteraction, fakeStocks);
  await handleStockCommand(newsInteraction, fakeStocks);
  await handleStockCommand(chartInteraction, fakeStocks);

  assert.match(ipoInteraction.replies[0], /신규상장/);
  assert.match(ipoInteraction.replies[0], /희진AI/);
  assert.match(limitBuyInteraction.replies[0], /지정가 매수 주문 등록/);
  assert.match(limitBuyInteraction.replies[0], /ord-1/);
  assert.match(ordersInteraction.replies[0], /미체결 주문/);
  assert.match(alertInteraction.replies[0], /가격 알림 등록/);
  assert.match(alertsInteraction.replies[0], /활성 알림/);
  assert.match(historyInteraction.replies[0], /거래내역/);
  assert.match(newsInteraction.replies[0], /뉴스\/공시/);
  assert.match(chartInteraction.replies[0], /가격 차트/);
});

test('전체시세 응답은 실제 결과 길이와 상승/하락 색상 표시를 보여준다', async () => {
  const fullMarketInteraction = createStockInteraction('전체시세');
  const fakeStocks = {
    async getMarket() {
      return {
        tickIndex: 7,
        stocks: [
          createQuoteForTest('희진전자', 'HEEL', 7.5),
          createQuoteForTest('원숭이닉스', 'MO', -2.4),
          createQuoteForTest('도훈건설', 'DOCO', 0)
        ]
      };
    }
  };

  await handleStockCommand(fullMarketInteraction, fakeStocks);

  assert.match(fullMarketInteraction.replies[0], /전체 시세 3종목/);
  assert.match(fullMarketInteraction.replies[0], /🔴 ▲ \*\*희진전자\*\* `HEEL` 1,000골드 \(\+7.5%\)/);
  assert.match(fullMarketInteraction.replies[0], /🔵 ▼ \*\*원숭이닉스\*\* `MO` 1,000골드 \(-2.4%\)/);
  assert.match(fullMarketInteraction.replies[0], /⚪ — \*\*도훈건설\*\* `DOCO` 1,000골드 \(0%\)/);
});

test('개별 시세 응답도 상승/하락 색상 표시를 보여준다', async () => {
  const quoteInteraction = createStockInteraction('시세', {
    strings: {
      종목: 'heejin_electronics'
    }
  });
  const fakeStocks = {
    async getQuote() {
      return createQuoteForTest('희진전자', 'HEEL', 7.5);
    }
  };

  await handleStockCommand(quoteInteraction, fakeStocks);

  assert.match(quoteInteraction.replies[0], /변동: 🔴 ▲ \*\*\+7.5%\*\*/);
});

test('알 수 없는 주식 subcommand는 응답 없이 timeout 되지 않는다', async () => {
  await withFixture(async ({ stocks }) => {
    const interaction = createStockInteraction('없는명령');

    await handleStockCommand(interaction, stocks);

    assert.match(interaction.replies[0], /알 수 없는 주식 명령/);
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

    assert.match(portfolioInteraction.replies[0], /레버리지 평가금: \*\*10,000골드\*\*/);
    assert.match(portfolioInteraction.replies[0], /총자산: \*\*99,800골드\*\*/);

    const leaderboardInteraction = createStockInteraction('랭킹', {
      user: { id: 'user-1', username: '희희' }
    });
    await handleStockCommand(leaderboardInteraction, stocks);

    assert.match(leaderboardInteraction.replies[0], /레버리지 10,000골드/);
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

test('기존 레버리지 증거금은 95% 골드 가치로 보정된다', async () => {
  await withFixture(async ({ stocks, store }) => {
    await seedLegacyStockState(store, {
      balance: 100,
      leveragedPositions: {
        legacy_position: {
          id: 'legacy_position',
          stockId: 'heejin_electronics',
          side: 'long',
          leverage: 10,
          margin: 1_000,
          entryPrice: 800,
          openedAt: 1
        }
      }
    });

    const portfolio = await stocks.getLeveragePortfolio({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      now: 0
    });
    const closed = await stocks.closeLeveragedPosition({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      positionId: 'legacy_position',
      now: 0
    });

    assert.equal(portfolio.marginTotal, 950);
    assert.equal(portfolio.equityTotal, 950);
    assert.equal(portfolio.cash, 100);
    assert.equal(closed.position.margin, 950);
    assert.equal(closed.payout, 950);
    assert.equal(closed.profile.balance, 1_050);
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
      wallets: {
        casinoChips: 0,
        rpgGold: 0,
        swordCoins: 0,
        stockCash: 0
      },
      currencyMigration: { unifiedGoldVersion: 1, unifiedGoldAt: 1 },
      lastMessageRewardAt: 0,
      lastDailyAt: 0,
      lastDailyDay: null,
      dailyStreak: 0,
      lastFirstMessageBonusDay: null,
      createdAt: 1
    };
  });
}

async function seedLegacyStockState(store, {
  guildId = 'guild-1',
  userId = 'user-1',
  username = '희희',
  balance = 0,
  stockCash = 0,
  limitOrders = {},
  leveragedPositions = {}
} = {}) {
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
      wallets: {
        casinoChips: 0,
        rpgGold: 0,
        swordCoins: 0,
        stockCash
      },
      lastMessageRewardAt: 0,
      lastDailyAt: 0,
      lastDailyDay: null,
      dailyStreak: 0,
      lastFirstMessageBonusDay: null,
      createdAt: 1
    };
    guild.stocks ??= {};
    guild.stocks.users ??= {};
    guild.stocks.users[userId] = {
      userId,
      username,
      holdings: {},
      limitOrders,
      priceAlerts: {},
      leveragedPositions,
      tradeHistory: [],
      realizedProfit: 0,
      realizedLeveragedProfit: 0,
      tradeCount: 0,
      leveragedTradeCount: 0,
      nextOrderSeq: 0,
      nextAlertSeq: 0,
      nextPositionSeq: 0,
      nextTradeSeq: 0,
      lastTradeAt: 0
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

function automaticIpoRandomInt(min, max) {
  if (min === 1 && max === 10_000) return 1;
  if (min === 1 && max === 100) return 99;
  if (min < 0 && max > 0) return 0;
  return min;
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

function createQuoteForTest(name, symbol, changePercent = 0, overrides = {}) {
  return {
    id: symbol.toLocaleLowerCase('ko-KR'),
    name,
    symbol,
    sector: '테스트',
    risk: 'stable',
    price: 1_000,
    previousPrice: 1_000,
    changeBps: Math.round(changePercent * 100),
    changePercent,
    news: '테스트 뉴스',
    updatedAt: 0,
    aliases: [],
    status: 'listed',
    eventType: null,
    listedFromTick: 0,
    ...overrides
  };
}

function createStockAutocompleteInteraction(subcommand, focusedValue, options = {}) {
  const {
    guildId = 'guild-1',
    user = { id: 'user-1', username: '희희' },
    inGuild = true
  } = options;
  const choices = [];

  return {
    commandName: '주식',
    guildId,
    user,
    choices,
    isAutocomplete: () => true,
    inGuild: () => inGuild,
    options: {
      getSubcommand: () => subcommand,
      getFocused: () => ({ name: '종목', value: focusedValue })
    },
    async respond(nextChoices) {
      choices.push(...nextChoices);
    }
  };
}
