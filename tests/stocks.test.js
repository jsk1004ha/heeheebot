import { MessageFlags } from 'discord.js';
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
import { CURRENCY_MAIN, creditCurrency } from '../src/systems/currencies.js';
import {
  StockService,
  getStockCatalog,
  normalizeStockId,
  scheduleStockAlertAnnouncements
} from '../src/systems/stocks.js';
import { SEASON_POINT_SOURCES } from '../src/systems/seasons.js';

const STOCK_TICK_MS_FOR_TEST = 3 * 60 * 1000;
const MAX_CATCH_UP_MS_FOR_TEST = 24 * STOCK_TICK_MS_FOR_TEST;
const DEFAULT_LEVERAGE_EXPIRY_MS_FOR_TEST = 30 * STOCK_TICK_MS_FOR_TEST;

test('주식 명령 payload는 현물, 지정가, 알림, 배당금, 신규상장, 레버리지 subcommand를 등록한다', () => {
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
  const leverageDurationOption = leverageCommand.options.find((option) => option.name === '기간');
  const leverageCloseCommand = payload.options.find((option) => option.name === '레버리지청산');
  const leverageCloseOption = leverageCloseCommand.options.find((option) => option.name === '대상');
  const debtRepayCommand = payload.options.find((option) => option.name === '채무상환');
  const debtRepayAmountOption = debtRepayCommand.options.find((option) => option.name === '금액');

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
    '배당금',
    '뉴스',
    '차트',
    '보유',
    '랭킹',
    '레버리지진입',
    '레버리지청산',
    '레버리지보유',
    '채무상환',
    '관리자상장',
    '관리자상장폐지'
  ]);
  assert.equal(stockOption.required, true);
  assert.equal(stockOption.choices, undefined, '48개 종목은 디스코드 choice 25개 제한 때문에 autocomplete로 고른다');
  assert.equal(stockOption.autocomplete, true);
  assert.equal(sellStockOption.autocomplete, true);
  assert.equal(leverageStockOption.autocomplete, true);
  assert.deepEqual(sideOption.choices.map((choice) => choice.value), ['long', 'short']);
  assert.equal(leverageOption.min_value, 1);
  assert.equal(leverageOption.max_value, 100);
  assert.equal(leverageDurationOption.min_value, 10);
  assert.equal(leverageDurationOption.max_value, 100);
  assert.equal(leverageDurationOption.required, true);
  assert.equal(leverageCloseOption.autocomplete, true);
  assert.notEqual(leverageCloseOption.required, true);
  assert.equal(debtRepayAmountOption.min_value, 1);
  assert.notEqual(debtRepayAmountOption.required, true);
});

test('주식 종목 autocomplete는 매수 후보를 검색하고 매도는 보유 종목을 우선 제안한다', async () => {
  await withFixture(async ({ stocks, store }) => {
    const buyInteraction = createStockAutocompleteInteraction('매수', '원숭이');

    const handledBuy = await handleStockAutocomplete(buyInteraction, stocks);

    assert.equal(handledBuy, true);
    assert.ok(buyInteraction.choices.length <= 25);
    assert.ok(buyInteraction.choices.some((choice) => choice.name.includes('원숭이닉스') && choice.value === 'monkeynix'));
    assert.equal(
      buyInteraction.choices.some((choice) => /안정주|성장주|경기민감주|급등락주|밈주식/.test(choice.name)),
      false
    );

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

test('주식 보유와 시장은 같은 유저면 다른 서버에서도 이어진다', async () => {
  await withFixture(async ({ stocks, store }) => {
    await seedBalance(store, 'guild-1', 'user-1', '희희', 100_000);
    await stocks.buyStock({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      stockId: '희진전자',
      quantity: 3,
      now: 0
    });

    const quoteInFirstGuild = await stocks.getQuote({
      guildId: 'guild-1',
      stockId: '희진전자',
      now: 0
    });
    const quoteInSecondGuild = await stocks.getQuote({
      guildId: 'guild-2',
      stockId: '희진전자',
      now: 0
    });
    const portfolio = await stocks.getPortfolio({
      guildId: 'guild-2',
      userId: 'user-1',
      username: '희희',
      now: 0
    });
    const data = await store.load();
    const position = portfolio.positions.find((entry) => entry.stockId === 'heejin_electronics');

    assert.equal(position?.quantity, 3);
    assert.equal(quoteInSecondGuild.price, quoteInFirstGuild.price);
    assert.equal(data.guilds['guild-1'].stocks, undefined);
    assert.equal(data.stocks.users['user-1'].holdings.heejin_electronics.quantity, 3);
  });
});

test('주식 autocomplete는 만료된 상호작용이면 조용히 종료한다', async () => {
  await withFixture(async ({ stocks }) => {
    const interaction = createStockAutocompleteInteraction('매수', '희진', {
      respondError: Object.assign(new Error('Unknown interaction'), { code: 10062 })
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

test('종목별 배당률은 서로 다르고 가격보다 낮은 빈도로 조정된다', async () => {
  await withFixture(async ({ stocks }) => {
    const initialMarket = await stocks.getMarket({ guildId: 'guild-1', now: 0 });
    const initialDividendRates = new Set(initialMarket.stocks.map((stock) => stock.dividendBps));
    const initialQuote = await stocks.getQuote({ guildId: 'guild-1', stockId: '희진전자', now: 0 });
    const afterOneTick = await stocks.getQuote({ guildId: 'guild-1', stockId: '희진전자', now: 1 });
    const afterTwoTicks = await stocks.getQuote({ guildId: 'guild-1', stockId: '희진전자', now: 2 });
    const afterReviewTick = await stocks.getQuote({ guildId: 'guild-1', stockId: '희진전자', now: 3 });

    assert.ok(initialDividendRates.size >= 4, '종목별 초기 배당률이 충분히 달라야 한다');
    assert.equal(initialQuote.dividendBps, 24);
    assert.equal(initialMarket.stocks.find((stock) => stock.id === 'jaesung_electronics').dividendBps, 17);
    assert.notEqual(afterOneTick.price, initialQuote.price);
    assert.equal(afterOneTick.dividendBps, initialQuote.dividendBps);
    assert.notEqual(afterTwoTicks.price, afterOneTick.price);
    assert.equal(afterTwoTicks.dividendBps, initialQuote.dividendBps);
    assert.notEqual(afterReviewTick.price, afterTwoTicks.price);
    assert.notEqual(afterReviewTick.dividendBps, initialQuote.dividendBps);
    assert.equal(afterReviewTick.dividendUpdatedAtTick, 3);
  }, {
    tickMs: 1,
    randomInt: (min, max) => (min < 0 && max > 0 ? 100 : max),
    autoIpoChanceBps: 0,
    dividendReviewIntervalTicks: 3,
    dividendChangeChanceBps: 10_000
  });
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
    assert.equal(autoIpo.symbol, 'HJAI1');
    assert.match(autoIpo.symbol, /^[A-Z0-9]{2,6}$/);
    assert.doesNotMatch(autoIpo.symbol, /[ㄱ-ㅎㅏ-ㅣ가-힣]/);
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

test('자동 신규상장 테마는 같은 업종의 다른 이름까지 64종 풀을 가진다', async () => {
  await withFixture(async ({ stocks }) => {
    await stocks.getMarket({ guildId: 'guild-1', now: 0 });

    for (let tick = 5; tick <= 320; tick += 5) {
      await stocks.getMarket({ guildId: 'guild-1', now: tick * 3 * 60 * 1000 });
    }

    const market = await stocks.getMarket({ guildId: 'guild-1', now: 320 * 3 * 60 * 1000 });
    const dynamicStocks = market.stocks.filter((stock) => stock.dynamic);
    const names = dynamicStocks.map((stock) => stock.name);
    const sectors = new Set(dynamicStocks.map((stock) => stock.sector));

    assert.equal(dynamicStocks.length, 64);
    assert.equal(new Set(names).size, 64);
    assert.ok(names.includes('희진AI랩스'));
    assert.ok(names.includes('희진밈팩토리'));
    assert.ok(names.includes('희진AI스튜디오'));
    assert.ok(names.includes('희진밈스튜디오'));
    assert.ok(sectors.has('반도체'));
    assert.ok(sectors.has('밈'));
  }, {
    randomInt: automaticIpoRandomInt,
    ipoRandomInt: sequentialAutoIpoThemeRandomInt(),
    autoIpoChanceBps: 10_000,
    maxDynamicStocks: 64
  });
});

test('자동 신규상장 이름은 같은 접두어와 테마에서도 4가지 변형을 순환한다', async () => {
  await withFixture(async ({ stocks }) => {
    await stocks.getMarket({ guildId: 'guild-1', now: 0 });

    for (let tick = 5; tick <= 20; tick += 5) {
      await stocks.getMarket({ guildId: 'guild-1', now: tick * 3 * 60 * 1000 });
    }

    const market = await stocks.getMarket({ guildId: 'guild-1', now: 20 * 3 * 60 * 1000 });
    const names = market.stocks
      .filter((stock) => stock.dynamic)
      .map((stock) => stock.name);

    assert.equal(new Set(names).size, 4);
    assert.deepEqual(new Set(names), new Set([
      '희진AI랩스',
      '희진네오AI랩스',
      '희진루나AI랩스',
      '희진픽셀AI랩스'
    ]));
  }, {
    randomInt: automaticIpoRandomInt,
    ipoRandomInt: rotatingAutoIpoNameRandomInt(),
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
    assert.match(quote.news, /시황/);
    assert.doesNotMatch(quote.news, /급등 뉴스|급락 뉴스|급등 이벤트|급락 이벤트/);
    assert.equal(after.tickIndex, 1);
  }, { randomInt: deterministicRandomInt([750, 99]) });
});

test('시장은 급등 이벤트를 quote 상태에 남기고 상장폐지 종목은 DB에서 삭제한다', async () => {
  await withFixture(async ({ stocks }) => {
    await stocks.getMarket({ guildId: 'guild-1', now: 0 });
    const market = await stocks.getMarket({ guildId: 'guild-1', now: 3 * 60 * 1000 });
    const surge = market.stocks.find((stock) => stock.id === 'heejin_electronics');

    assert.equal(surge.price, 954);
    assert.equal(surge.eventType, 'surge');
    assert.match(surge.news, /시황/);
    assert.doesNotMatch(surge.news, /급등 뉴스|급락 뉴스|급등 이벤트|급락 이벤트/);
  }, {
    randomInt: (min, max) => (min === 1 && max === 100 ? 1 : max)
  });

  await withFixture(async ({ stocks, store }) => {
    await stocks.getMarket({ guildId: 'guild-1', now: 0 });
    const market = await stocks.getMarket({ guildId: 'guild-1', now: 3 * 60 * 1000 });
    const data = await store.load();

    assert.equal(market.stocks.some((stock) => stock.id === 'monkeynix'), false);
    assert.equal(market.stocks.some((stock) => stock.status === 'delisted'), false);
    assert.equal(data.stocks.market.symbols.monkeynix, undefined);
    assert.match(data.stocks.delistedStocks.monkeynix.news, /상장폐지/);
    await assert.rejects(
      () => stocks.getQuote({ guildId: 'guild-1', stockId: '원숭이닉스', now: 3 * 60 * 1000 }),
      /상장폐지되어 DB에서 삭제/
    );
  }, { randomInt: (min) => min });
});

test('상장폐지 종목은 보유, 주문, 알림, 레버리지에서 자동 정리된다', async () => {
  await withFixture(async ({ stocks, store }) => {
    await seedBalance(store, 'guild-1', 'user-1', '희희', 200_000);
    await stocks.buyStock({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      stockId: '원숭이닉스',
      quantity: 10,
      now: 0
    });
    const order = await stocks.placeLimitOrder({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      stockId: '원숭이닉스',
      side: 'sell',
      quantity: 4,
      limitPrice: 1_000,
      now: 0
    });
    const alert = await stocks.setPriceAlert({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      stockId: '원숭이닉스',
      condition: 'above',
      targetPrice: 2_000,
      channelId: 'channel-1',
      now: 0
    });
    const leveraged = await stocks.openLeveragedPosition({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      stockId: '원숭이닉스',
      side: 'long',
      leverage: 2,
      durationTurns: 30,
      margin: 10_000,
      now: 0
    });

    await stocks.getMarket({ guildId: 'guild-1', now: 3 * 60 * 1000 });
    const dataAfterMarketCleanup = await store.load();

    assert.equal(dataAfterMarketCleanup.stocks.market.symbols.monkeynix, undefined);
    assert.equal(dataAfterMarketCleanup.stocks.users['user-1'].holdings.monkeynix, undefined);
    assert.equal(
      dataAfterMarketCleanup.stocks.users['user-1'].leveragedPositions[leveraged.position.id],
      undefined
    );

    const portfolio = await stocks.getPortfolio({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      now: 3 * 60 * 1000
    });
    const orders = await stocks.getLimitOrders({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      now: 3 * 60 * 1000
    });
    const alerts = await stocks.getPriceAlerts({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      now: 3 * 60 * 1000
    });
    const leveragePortfolio = await stocks.getLeveragePortfolio({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      now: 3 * 60 * 1000
    });
    const history = await stocks.getTradeHistory({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      limit: 10,
      now: 3 * 60 * 1000
    });
    const data = await store.load();
    const cleanupTrade = history.entries.find((entry) => entry.type === 'delisting_cleanup');
    const leverageSettlement = history.entries.find((entry) => entry.positionId === leveraged.position.id);

    assert.equal(portfolio.positions.length, 0);
    assert.equal(portfolio.stockValue, 0);
    assert.equal(portfolio.realizedProfit, -6_600);
    assert.equal(orders.open.length, 0);
    assert.equal(orders.recent.find((item) => item.id === order.id).cancelReason, '상장폐지');
    assert.equal(alerts.active.some((item) => item.id === alert.id), false);
    assert.equal(alerts.triggered.some((item) => item.id === alert.id), false);
    assert.equal(leveragePortfolio.positions.some((position) => position.positionId === leveraged.position.id), false);
    assert.ok(cleanupTrade);
    assert.equal(cleanupTrade.quantity, 10);
    assert.equal(cleanupTrade.price, 0);
    assert.equal(cleanupTrade.realizedProfit, -6_600);
    assert.equal(leverageSettlement.type, 'leverage_liquidation');
    assert.equal(data.stocks.market.symbols.monkeynix, undefined);
    assert.equal(data.stocks.users['user-1'].holdings.monkeynix, undefined);
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

test('주식 계좌와 시장은 사용자 기준으로 모든 서버에서 공유된다', async () => {
  await withFixture(async ({ stocks, store }) => {
    await seedBalance(store, 'guild-1', 'user-1', '희희', 100_000);

    const buy = await stocks.buyStock({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      stockId: '희진전자',
      quantity: 3,
      now: 1
    });
    const portfolio = await stocks.getPortfolio({
      guildId: 'guild-2',
      userId: 'user-1',
      username: '희희',
      now: 1
    });
    const data = await store.load();

    assert.equal(buy.stock.id, 'heejin_electronics');
    assert.equal(portfolio.positions.find((position) => position.stockId === 'heejin_electronics').quantity, 3);
    assert.equal(data.stocks.users['user-1'].holdings.heejin_electronics.quantity, 3);
  });
});

test('배당금은 시장 주기마다 보유 현물 주식 기준으로 적립되고 수령된다', async () => {
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

    const before = await stocks.getDividendSummary({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      now: 3 * 60 * 1000
    });
    const accruedPortfolio = await stocks.getPortfolio({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      now: 6 * 60 * 1000
    });
    const claimed = await stocks.claimDividends({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      now: 6 * 60 * 1000
    });
    const after = await stocks.claimDividends({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      now: 6 * 60 * 1000
    });

    assert.equal(before.pendingAmount, 0);
    assert.equal(accruedPortfolio.pendingDividends, 19);
    assert.equal(accruedPortfolio.totalAssets, 99_939);
    assert.equal(claimed.claimedAmount, 19);
    assert.equal(claimed.pendingAmount, 0);
    assert.equal(claimed.cash, 91_939);
    assert.equal(claimed.totalDividends, 19);
    assert.equal(claimed.claimedDividends, 19);
    assert.equal(claimed.recent[0].positions[0].stock.name, '희진전자');
    assert.equal(claimed.recent[0].positions[0].dividendBps, 24);
    assert.equal(claimed.recent[0].positions[0].amount, 19);
    assert.equal(after.claimedAmount, 0);
    assert.equal(after.totalDividends, 19);
  }, { randomInt: deterministicRandomInt([0, 99]), dividendIntervalTicks: 2 });
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

test('트리거된 가격 알림은 푸시 대상으로 조회되고 발송 표시 후 중복 조회되지 않는다', async () => {
  await withFixture(async ({ stocks }) => {
    const alert = await stocks.setPriceAlert({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      stockId: '희진전자',
      condition: 'above',
      targetPrice: 805,
      channelId: 'channel-1',
      now: 0
    });

    await stocks.getMarket({ guildId: 'guild-1', now: 3 * 60 * 1000 });

    const pending = await stocks.getPendingTriggeredPriceAlerts({
      guildId: 'guild-1',
      now: 3 * 60 * 1000
    });
    await stocks.markPriceAlertNotified({
      guildId: 'guild-1',
      userId: 'user-1',
      alertId: alert.id,
      now: 3 * 60 * 1000 + 1
    });
    const afterNotified = await stocks.getPendingTriggeredPriceAlerts({
      guildId: 'guild-1',
      now: 3 * 60 * 1000 + 1
    });

    assert.equal(pending.length, 1);
    assert.equal(pending[0].id, alert.id);
    assert.equal(pending[0].channelId, 'channel-1');
    assert.equal(pending[0].userId, 'user-1');
    assert.equal(pending[0].stock.name, '희진전자');
    assert.equal(pending[0].triggeredPrice, 808);
    assert.deepEqual(afterNotified, []);
  }, { randomInt: deterministicRandomInt([100, 99]) });
});

test('트리거된 가격 알림 배치 조회는 전역 주식 유저를 한 번만 훑고 서버별로 나눈다', async () => {
  await withFixture(async ({ stocks }) => {
    const firstAlert = await stocks.setPriceAlert({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      stockId: '희진전자',
      condition: 'above',
      targetPrice: 805,
      channelId: 'channel-1',
      now: 0
    });
    const secondAlert = await stocks.setPriceAlert({
      guildId: 'guild-2',
      userId: 'user-2',
      username: '투자자',
      stockId: '희진전자',
      condition: 'above',
      targetPrice: 805,
      channelId: 'channel-2',
      now: 0
    });

    const pendingByGuild = await stocks.getPendingTriggeredPriceAlertsByGuild({
      guildIds: ['guild-1', 'guild-2', 'guild-3'],
      now: 3 * 60 * 1000
    });

    assert.deepEqual(Object.keys(pendingByGuild), ['guild-1', 'guild-2', 'guild-3']);
    assert.deepEqual(pendingByGuild['guild-1'].map((alert) => alert.id), [firstAlert.id]);
    assert.deepEqual(pendingByGuild['guild-2'].map((alert) => alert.id), [secondAlert.id]);
    assert.deepEqual(pendingByGuild['guild-3'], []);
    assert.equal(pendingByGuild['guild-1'][0].channelId, 'channel-1');
    assert.equal(pendingByGuild['guild-2'][0].channelId, 'channel-2');
  }, { randomInt: deterministicRandomInt([100, 99]) });
});

test('주식 가격 알림 스케줄러는 고정 간격으로 푸시 작업을 반복 예약한다', async () => {
  const scheduled = [];
  const cleared = [];
  let sent = 0;

  const stop = scheduleStockAlertAnnouncements({
    intervalMs: 45_000,
    setTimeoutFn: (callback, delayMs) => {
      const timer = { callback, delayMs };
      scheduled.push(timer);
      return timer;
    },
    clearTimeoutFn: (timer) => {
      cleared.push(timer);
    },
    async sendAnnouncements() {
      sent += 1;
    }
  });

  assert.equal(scheduled[0].delayMs, 45_000);

  await scheduled[0].callback();

  assert.equal(sent, 1);
  assert.equal(scheduled.length, 2);

  stop();

  assert.deepEqual(cleared, [scheduled[1]]);
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

test('뉴스 공시는 사전 원인으로 기록되고 다음 tick 가격에 반영된다', async () => {
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
    const heejinNews = news.entries.find((entry) => entry.stock.name === '희진전자');

    assert.ok(heejinNews);
    assert.equal(heejinNews.type, 'positive');
    assert.equal(heejinNews.publishedTickIndex, 0);
    assert.equal(heejinNews.effectiveTickIndex, 1);
    assert.equal(heejinNews.impactBps, 1_120);
    assert.doesNotMatch(heejinNews.message, /시장 공시|tick|반영|급등|급락|상장폐지|호재|악재|리스크|예상 영향|\+\d|-\d/);
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

test('상장폐지 위험 뉴스도 방향을 숨긴 사전 공시로 표현한다', async () => {
  await withFixture(async ({ stocks }) => {
    await stocks.getMarket({ guildId: 'guild-1', now: 0 });
    const market = await stocks.getMarket({ guildId: 'guild-1', now: 3 * 60 * 1000 });
    const news = await stocks.getNews({ guildId: 'guild-1', limit: 10, now: 3 * 60 * 1000 });
    const riskNews = news.entries.find((entry) => entry.stock.name === '희진바이오');
    const delisted = market.stocks.find((stock) => stock.id === 'heejin_bio');

    assert.equal(delisted, undefined);
    assert.ok(riskNews);
    assert.equal(riskNews.stock.status, 'delisted');
    assert.equal(riskNews.type, 'risk');
    assert.doesNotMatch(riskNews.message, /시장 공시|tick|반영|급등|급락|상장폐지|호재|악재|리스크|우려|위험|예상 영향|\+\d|-\d/);
  }, { randomInt: (min) => min });
});

test('뉴스 신호는 그대로 확정되지 않고 축소, 무시, 반전될 수 있다', async () => {
  await withFixture(async ({ stocks }) => {
    await stocks.getMarket({ guildId: 'guild-1', now: 0 });
    const market = await stocks.getMarket({ guildId: 'guild-1', now: 3 * 60 * 1000 });
    const news = await stocks.getNews({ guildId: 'guild-1', limit: 10, now: 3 * 60 * 1000 });
    const quote = market.stocks.find((stock) => stock.id === 'heejin_electronics');
    const entry = news.entries.find((item) => item.stock.id === 'heejin_electronics');

    assert.equal(entry.type, 'positive');
    assert.equal(entry.impactBps, 1_120);
    assert.equal('headlineImpactBps' in entry, false);
    assert.equal('actualImpactBps' in entry, false);
    assert.equal('outcome' in entry, false);
    assert.equal(quote.price, 827);
  }, { randomInt: scriptedRandomInt([0, 1, 1_120, 65]) });

  await withFixture(async ({ stocks }) => {
    await stocks.getMarket({ guildId: 'guild-1', now: 0 });
    const market = await stocks.getMarket({ guildId: 'guild-1', now: 3 * 60 * 1000 });
    const news = await stocks.getNews({ guildId: 'guild-1', limit: 10, now: 3 * 60 * 1000 });
    const quote = market.stocks.find((stock) => stock.id === 'heejin_electronics');
    const entry = news.entries.find((item) => item.stock.id === 'heejin_electronics');

    assert.equal(entry.type, 'positive');
    assert.equal(entry.impactBps, 1_120);
    assert.equal('actualImpactBps' in entry, false);
    assert.equal('outcome' in entry, false);
    assert.equal(quote.price, 800);
    assert.equal(quote.changeBps, 0);
  }, { randomInt: scriptedRandomInt([0, 1, 1_120, 75]) });

  await withFixture(async ({ stocks }) => {
    await stocks.getMarket({ guildId: 'guild-1', now: 0 });
    const market = await stocks.getMarket({ guildId: 'guild-1', now: 3 * 60 * 1000 });
    const news = await stocks.getNews({ guildId: 'guild-1', limit: 20, now: 3 * 60 * 1000 });
    const quote = market.stocks.find((stock) => stock.id === 'heejin_bio');
    const entry = news.entries.find((item) => item.stock.id === 'heejin_bio');

    assert.equal(entry.type, 'positive');
    assert.equal(entry.impactBps, 1_819);
    assert.equal('actualImpactBps' in entry, false);
    assert.equal('outcome' in entry, false);
    assert.equal(quote.eventType, 'crash');
    assert.equal(quote.price, 425);
  }, { randomInt: scriptedRandomInt([0, 100, 0, 1, 1_820, 85]) });
});

test('시장 뉴스 공시는 같은 종목도 5배 확장된 문구 조합으로 순환한다', async () => {
  await withFixture(async ({ stocks }) => {
    await stocks.getMarket({ guildId: 'guild-1', now: 0 });
    const messages = new Set();

    for (let tick = 1; tick <= 40; tick += 1) {
      const now = tick * 3 * 60 * 1000;
      await stocks.getMarket({ guildId: 'guild-1', now });
      const news = await stocks.getNews({ guildId: 'guild-1', limit: 20, now });
      const entry = news.entries.find((item) => item.stock.name === '희진전자');

      assert.ok(entry);
      assert.equal(entry.type, 'positive');
      assert.doesNotMatch(entry.message, /시장 공시|tick|반영|급등|급락|상장폐지|호재|악재|리스크|예상 영향|\+\d|-\d/);
      messages.add(entry.message);
    }

    assert.equal(messages.size > 32, true);
  }, {
    randomInt: singleStockPositiveNewsRandomInt()
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
    assert.equal(marketInteraction.rawReplies[0].components.length, 1);
    assert.deepEqual(
      marketInteraction.rawReplies[0].components[0].components.map((component) => component.data.label),
      ['상승 TOP', '하락 TOP', '신규상장', '내 보유', '레버리지']
    );
  });
});

test('주식 시세 빠른 버튼은 소유자만 TOP/신규상장/보유 화면을 갱신한다', async () => {
  const updates = [];
  const replies = [];
  const fakeStocks = {
    async getMarket() {
      return {
        tickIndex: 3,
        stocks: [
          createQuoteForTest('희진전자', 'HEEL', 7.5),
          createQuoteForTest('원숭이닉스', 'MO', -3.1),
          createQuoteForTest('도훈건설', 'DOCO', 1.2)
        ]
      };
    },
    async getListings() {
      return {
        tickIndex: 3,
        recent: [createQuoteForTest('희진AI', 'HEAI', 0, { eventType: 'ipo', listedFromTick: 2 })],
        upcoming: []
      };
    },
    async getPortfolio() {
      return {
        cash: 1_000,
        stockValue: 2_000,
        leveragedEquity: 0,
        totalAssets: 3_000,
        unrealizedProfit: 100,
        leveragedUnrealizedProfit: 0,
        realizedProfit: 0,
        realizedLeveragedProfit: 0,
        positions: [
          {
            stock: createQuoteForTest('희진전자', 'HEEL'),
            quantity: 2,
            marketValue: 2_000,
            unrealizedProfit: 100
          }
        ]
      };
    }
  };

  const ownerButton = createStockButtonInteraction({
    customId: 'stock_quick:gainers:user-1',
    userId: 'user-1',
    updates,
    replies
  });
  const otherButton = createStockButtonInteraction({
    customId: 'stock_quick:portfolio:user-1',
    userId: 'user-2',
    updates,
    replies
  });

  assert.equal(await handleStockCommand(ownerButton, fakeStocks), true);
  assert.equal(await handleStockCommand(otherButton, fakeStocks), true);

  assert.match(updates[0].content, /상승 TOP/);
  assert.match(updates[0].content, /희진전자/);
  assert.doesNotMatch(updates[0].content, /안정주|성장주|경기민감주|급등락주|밈주식/);
  assert.equal(updates[0].components[0].components.length, 5);
  assert.equal(replies[0].flags, MessageFlags.Ephemeral);
  assert.match(replies[0].content, /명령어를 실행한 유저만/);
});

test('주식 매수와 매도 결과에도 다음 확인 버튼을 붙인다', async () => {
  const fakeStocks = {
    async buyStock() {
      return createStockTradeResultForTest({ remainingQuantity: 3 });
    },
    async sellStock() {
      return createStockTradeResultForTest({ remainingQuantity: 1, realizedProfit: 120 });
    }
  };
  const buyInteraction = createStockInteraction('매수', {
    strings: { 종목: '희진전자' },
    integers: { 수량: 3 }
  });
  const sellInteraction = createStockInteraction('매도', {
    strings: { 종목: '희진전자' },
    integers: { 수량: 2 }
  });

  const seasons = createSeasonSpy();

  assert.equal(await handleStockCommand(buyInteraction, fakeStocks, { seasons }), true);
  assert.equal(await handleStockCommand(sellInteraction, fakeStocks, { seasons }), true);

  assert.match(buyInteraction.replies[0], /매수 완료/);
  assert.match(sellInteraction.replies[0], /매도 완료/);
  assert.deepEqual(seasons.awards.map(({ source, points }) => ({ source, points })), [
    { source: SEASON_POINT_SOURCES.STOCK_TRADE, points: 15 },
    { source: SEASON_POINT_SOURCES.STOCK_TRADE, points: 15 }
  ]);
  assert.match(buyInteraction.replies[0], /시즌: 테스트 시즌/);
  assert.match(sellInteraction.replies[0], /시즌: 테스트 시즌/);
  for (const interaction of [buyInteraction, sellInteraction]) {
    assert.deepEqual(
      interaction.rawReplies[0].components[0].components.map((component) => component.data.label),
      ['상승 TOP', '하락 TOP', '신규상장', '내 보유', '레버리지']
    );
  }
});


test('주식 시즌 포인트 지급 실패는 기록하고 기본 거래 응답은 유지한다', async () => {
  const fakeStocks = {
    async buyStock() {
      return createStockTradeResultForTest({ remainingQuantity: 3 });
    }
  };
  const interaction = createStockInteraction('매수', {
    strings: { 종목: '희진전자' },
    integers: { 수량: 3 }
  });
  const logs = [];
  const logger = { debug: (...args) => logs.push(args) };

  assert.equal(await handleStockCommand(interaction, fakeStocks, { seasons: createRejectingSeasonSpy(), logger }), true);

  assert.match(interaction.replies[0], /매수 완료/);
  assert.doesNotMatch(interaction.replies[0], /시즌:/);
  assert.equal(logs.length, 1);
  assert.match(logs[0][0], /Failed to award stock trade season points/);
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
  const dividendInteraction = createStockInteraction('배당금');
  const newsInteraction = createStockInteraction('뉴스');
  const chartInteraction = createStockInteraction('차트', {
    strings: { 종목: '희진전자' }
  });
  let alertPayload = null;
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
    async setPriceAlert(payload) {
      alertPayload = payload;
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
    async claimDividends() {
      return {
        cash: 12_345,
        claimedAmount: 120,
        pendingAmount: 0,
        totalDividends: 320,
        claimedDividends: 320,
        currentTick: 12,
        intervalTicks: 10,
        nextDividendTick: 20,
        recent: [
          {
            id: 'div-1',
            amount: 120,
            tickIndex: 10,
            at: 1,
            positions: [
              {
                stockId: 'heejin_electronics',
                stock: createQuoteForTest('희진전자', 'HEEL'),
                quantity: 10,
                price: 800,
                dividendBps: 25,
                amount: 120
              }
            ]
          }
        ]
      };
    },
    async getNews() {
      return {
        entries: [
          {
            id: 'news-1',
            type: 'positive',
            stock: createQuoteForTest('희진전자', 'HEEL', 19.25),
            title: '시장 공시',
            message: '시장 공시: 희진전자 희진전자 신제품 공개 일정이 예고됐습니다',
            tickIndex: 8,
            publishedTickIndex: 7,
            effectiveTickIndex: 8,
            impactBps: 1_120,
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
  await handleStockCommand(dividendInteraction, fakeStocks);
  await handleStockCommand(newsInteraction, fakeStocks);
  await handleStockCommand(chartInteraction, fakeStocks);

  assert.match(ipoInteraction.replies[0], /신규상장/);
  assert.match(ipoInteraction.replies[0], /희진AI/);
  assert.match(limitBuyInteraction.replies[0], /지정가 매수 주문 등록/);
  assert.match(limitBuyInteraction.replies[0], /ord-1/);
  assert.match(ordersInteraction.replies[0], /미체결 주문/);
  assert.match(alertInteraction.replies[0], /가격 알림 등록/);
  assert.equal(alertPayload.channelId, 'channel-1');
  assert.match(alertsInteraction.replies[0], /활성 알림/);
  assert.match(historyInteraction.replies[0], /거래내역/);
  assert.match(dividendInteraction.replies[0], /주식 배당금/);
  assert.match(dividendInteraction.replies[0], /이번 수령: \*\*120골드\*\*/);
  assert.match(dividendInteraction.replies[0], /희진전자/);
  assert.match(newsInteraction.replies[0], /뉴스\/공시/);
  assert.match(newsInteraction.replies[0], /신제품 공개 일정이 예고됐습니다/);
  assert.doesNotMatch(newsInteraction.replies[0], /\*\*희진전자\*\* 희진전자/);
  assert.doesNotMatch(newsInteraction.replies[0], /시장 공시|시장공시|tick #|반영 #|급등|급락|호재|악재|리스크|예상 영향|\+\d|-\d/);
  assert.doesNotMatch(newsInteraction.replies[0], /정확|오보|반전|축소|무시|과장|소문/);
  assert.match(chartInteraction.replies[0], /가격 차트/);
  assert.doesNotMatch(chartInteraction.replies[0], /tick #/);
});

test('관리자만 전 서버 공통 주식 종목을 상장하고 폐지할 수 있다', async () => {
  await withFixture(async ({ stocks }) => {
    const memberPermissions = {
      has: () => true
    };
    const listInteraction = createStockInteraction('관리자상장', {
      strings: {
        이름: '관리자전자',
        심볼: 'ADMN',
        업종: '관리'
      },
      integers: { 기준가: 1_234 },
      memberPermissions
    });

    await handleStockCommand(listInteraction, stocks);
    const quoteFromOtherGuild = await stocks.getQuote({
      guildId: 'guild-2',
      stockId: 'ADMN'
    });

    assert.match(listInteraction.replies[0], /관리자 주식 상장 완료/);
    assert.equal(quoteFromOtherGuild.name, '관리자전자');
    assert.equal(quoteFromOtherGuild.price, 1_234);

    const blockedInteraction = createStockInteraction('관리자상장', {
      strings: {
        이름: '권한없음',
        심볼: 'NOPE'
      },
      integers: { 기준가: 100 }
    });
    await handleStockCommand(blockedInteraction, stocks);
    assert.match(blockedInteraction.replies[0], /서버 관리자/);

    const delistInteraction = createStockInteraction('관리자상장폐지', {
      strings: { 종목: 'ADMN' },
      memberPermissions
    });
    await handleStockCommand(delistInteraction, stocks);
    await assert.rejects(
      () => stocks.getQuote({ guildId: 'guild-2', stockId: 'ADMN' }),
      /상장폐지/
    );
    assert.match(delistInteraction.replies[0], /상장폐지 완료/);
  });
});

test('전체시세 응답은 실제 결과 길이와 상승/하락 색상 표시를 보여준다', async () => {
  const fullMarketInteraction = createStockInteraction('전체시세');
  const updates = [];
  const replies = [];
  const marketStocks = [
    createQuoteForTest('희진전자', 'HEEL', 7.5),
    createQuoteForTest('원숭이닉스', 'MO', -2.4),
    createQuoteForTest('도훈건설', 'DOCO', 0),
    ...Array.from({ length: 9 }, (_, index) =>
      createQuoteForTest(`테스트주${index + 4}`, `T${index + 4}`, index % 2 === 0 ? 1 : -1)
    )
  ];
  const fakeStocks = {
    async getMarket() {
      return {
        tickIndex: 7,
        stocks: marketStocks
      };
    }
  };

  await handleStockCommand(fullMarketInteraction, fakeStocks);

  assert.match(fullMarketInteraction.replies[0], /전체 시세 12종목/);
  assert.match(fullMarketInteraction.replies[0], /1\/2페이지 · 페이지당 10개/);
  assert.doesNotMatch(fullMarketInteraction.replies[0], /tick #/);
  assert.match(fullMarketInteraction.replies[0], /🔵 ▼ \*\*원숭이닉스\*\* `MO` 1,000골드 \(-2.4%\)/);
  assert.match(fullMarketInteraction.replies[0], /⚪ — \*\*도훈건설\*\* `DOCO` 1,000골드 \(0%\)/);
  assert.match(fullMarketInteraction.replies[0], /🔴 ▲ \*\*테스트주4\*\* `T4` 1,000골드 \(\+1%\)/);
  assert.match(fullMarketInteraction.replies[0], /테스트주10/);
  assert.match(fullMarketInteraction.replies[0], /테스트주11/);
  assert.doesNotMatch(fullMarketInteraction.replies[0], /테스트주12/);
  assert.doesNotMatch(fullMarketInteraction.replies[0], /희진전자/);
  assert.deepEqual(
    fullMarketInteraction.rawReplies[0].components[0].components.map((component) => component.data.label),
    ['이전 10개', '다음 10개']
  );
  assert.equal(fullMarketInteraction.rawReplies[0].components[0].components[0].data.disabled, true);
  assert.equal(fullMarketInteraction.rawReplies[0].components[0].components[1].data.disabled, false);

  const nextPageButton = createStockButtonInteraction({
    customId: 'stock_market_page:1:user-1',
    userId: 'user-1',
    updates,
    replies
  });
  const otherUserButton = createStockButtonInteraction({
    customId: 'stock_market_page:1:user-1',
    userId: 'user-2',
    updates,
    replies
  });

  assert.equal(await handleStockCommand(nextPageButton, fakeStocks), true);
  assert.equal(await handleStockCommand(otherUserButton, fakeStocks), true);

  assert.match(updates[0].content, /2\/2페이지 · 페이지당 10개/);
  assert.match(updates[0].content, /테스트주12/);
  assert.match(updates[0].content, /🔴 ▲ \*\*희진전자\*\* `HEEL` 1,000골드 \(\+7.5%\)/);
  assert.doesNotMatch(updates[0].content, /도훈건설/);
  assert.equal(updates[0].components[0].components[0].data.disabled, false);
  assert.equal(updates[0].components[0].components[1].data.disabled, true);
  assert.equal(replies[0].flags, MessageFlags.Ephemeral);
  assert.match(replies[0].content, /명령어를 실행한 유저만/);
});

test('전체시세 응답은 상장폐지 종목을 앞에 몰지 않고 가나다순으로 보여준다', async () => {
  const fullMarketInteraction = createStockInteraction('전체시세');
  const marketStocks = [
    createQuoteForTest('희진바이오', 'HBIO', -100, { status: 'delisted', eventType: 'delisted' }),
    createQuoteForTest('가람에너지', 'GARA', 1),
    createQuoteForTest('나래화학', 'NARE', -1),
    createQuoteForTest('다온모빌리티', 'DAON', 0)
  ];
  const fakeStocks = {
    async getMarket() {
      return {
        tickIndex: 7,
        stocks: marketStocks
      };
    }
  };

  await handleStockCommand(fullMarketInteraction, fakeStocks);

  const stockNames = fullMarketInteraction.replies[0]
    .split('\n')
    .filter((line) => line.startsWith('- '))
    .map((line) => line.match(/\*\*(?<name>.+?)\*\*/u)?.groups?.name);

  assert.deepEqual(stockNames, ['가람에너지', '나래화학', '다온모빌리티', '희진바이오']);
  assert.match(fullMarketInteraction.replies[0].split('\n').at(-1), /희진바이오.*⛔상폐/);
});

test('전체시세 응답은 긴 종목명이 많아도 10개 단위 버튼 페이지로 Discord 제한을 지킨다', async () => {
  const fullMarketInteraction = createStockInteraction('전체시세');
  const updates = [];
  const replies = [];
  const fakeStocks = {
    async getMarket() {
      return {
        tickIndex: 7,
        stocks: Array.from({ length: 80 }, (_, index) =>
          createQuoteForTest(`긴이름테스트상장종목${String(index).padStart(2, '0')}${'가'.repeat(20)}`, `T${index}`)
        )
      };
    }
  };

  await handleStockCommand(fullMarketInteraction, fakeStocks);

  assert.equal(fullMarketInteraction.replies.length, 1);
  assert.ok(fullMarketInteraction.replies.every((reply) => reply.length <= 2000));
  assert.match(fullMarketInteraction.replies[0], /전체 시세 80종목/);
  assert.match(fullMarketInteraction.replies[0], /1\/8페이지 · 페이지당 10개/);

  const nextButtonId = getCustomIds(fullMarketInteraction.replyPayloads[0])
    .find((customId) => customId.startsWith('stock_market_page:1:'));
  assert.ok(nextButtonId);

  const buttonInteraction = createStockButtonInteraction({ customId: nextButtonId, updates, replies });
  await handleStockCommand(buttonInteraction, fakeStocks);

  assert.equal(updates.length, 1);
  assert.ok(updates[0].content.length <= 2000);
  assert.match(updates[0].content, /2\/8페이지 · 페이지당 10개/);
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
  assert.doesNotMatch(quoteInteraction.replies[0], /안정주|성장주|경기민감주|급등락주|밈주식/);
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
    const now = Date.now();
    await seedBalance(store, 'guild-1', 'user-1', '희희', 100_000);
    await stocks.openLeveragedPosition({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      stockId: '희진전자',
      side: 'long',
      leverage: 1,
      margin: 10_000,
      now
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

test('레버리지 포지션은 기간별 배율 제한을 적용하고 증거금 수수료를 차감한다', async () => {
  await withFixture(async ({ stocks, store }) => {
    await seedBalance(store, 'guild-1', 'user-1', '희희', 100_000);

    const long = await stocks.openLeveragedPosition({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      stockId: '원숭이닉스',
      side: 'long',
      leverage: 100,
      durationTurns: 30,
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
      durationTurns: 10,
      margin: 5_000,
      now: 1
    });

    assert.equal(long.position.side, 'long');
    assert.equal(long.position.leverage, 100);
    assert.equal(long.position.durationTurns, 30);
    assert.equal(long.position.remainingTurns, 30);
    assert.equal(long.position.notional, 1_000_000);
    assert.equal(long.position.debt, 990_000);
    assert.equal(long.fee, 200);
    assert.equal(long.profile.balance, 89_800);
    assert.equal(short.position.side, 'short');
    assert.equal(short.position.leverage, 7);
    assert.equal(short.position.durationTurns, 10);
    assert.equal(short.position.notional, 35_000);
    assert.equal(short.position.debt, 30_000);
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
    assert.equal(leveragePortfolio.notionalTotal, 1_035_000);
    assert.equal(leveragePortfolio.debtTotal, 1_020_000);

    await assert.rejects(
      stocks.openLeveragedPosition({
        guildId: 'guild-1',
        userId: 'user-1',
        username: '희희',
        stockId: '재성전자',
        side: 'long',
        leverage: 11,
        durationTurns: 10,
        margin: 1_000,
        now: 2
      }),
      /10턴에서는 1~10배|30턴 이상/
    );
  });
});

test('레버리지 보유 화면은 id 복사 없이 버튼 닫기와 자동완성을 지원한다', async () => {
  await withFixture(async ({ stocks, store }) => {
    const now = Date.now();
    await seedBalance(store, 'guild-1', 'user-1', '희희', 100_000);
    const opened = await stocks.openLeveragedPosition({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      stockId: '희진전자',
      side: 'long',
      leverage: 100,
      margin: 10_000,
      now
    });

    const autocomplete = createStockAutocompleteInteraction('레버리지청산', '희진', {
      focusedName: '대상'
    });
    await handleStockAutocomplete(autocomplete, stocks);

    assert.equal(autocomplete.choices.length, 1);
    assert.match(autocomplete.choices[0].name, /희진전자/);
    assert.match(autocomplete.choices[0].name, /롱 100배/);
    assert.equal(autocomplete.choices[0].value, opened.position.id);

    const portfolioInteraction = createStockInteraction('레버리지보유');
    await handleStockCommand(portfolioInteraction, stocks);

    assert.match(portfolioInteraction.replies[0], /1\. \*\*희진전자\*\* 롱 100배/);
    assert.doesNotMatch(portfolioInteraction.replies[0], new RegExp(`\\\`${opened.position.id}\\\``));

    const customIds = getCustomIds(portfolioInteraction.rawReplies[0]);
    const closeButtonId = customIds.find((customId) => customId.startsWith('stock_leverage:close:user-1:'));
    assert.ok(closeButtonId);
    assert.ok(customIds.some((customId) => customId === 'stock_quick:leverage:user-1'));

    const updates = [];
    const closeButton = createStockButtonInteraction({ customId: closeButtonId, updates });
    await handleStockCommand(closeButton, stocks);

    assert.equal(updates.length, 1);
    assert.match(updates[0].content, /청산 완료/);
    assert.match(updates[0].content, /열려 있는 레버리지 거래가 없습니다/);

    const after = await stocks.getLeveragePortfolio({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      now
    });
    assert.equal(after.positions.length, 0);
    assert.equal(after.cash, 99_100);
  });
});

test('레버리지청산은 대상 생략과 번호 입력으로 쉽게 닫을 수 있다', async () => {
  await withFixture(async ({ stocks, store }) => {
    const now = Date.now();
    await seedBalance(store, 'guild-1', 'user-1', '희희', 100_000);
    await stocks.openLeveragedPosition({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      stockId: '희진전자',
      side: 'long',
      leverage: 3,
      margin: 10_000,
      now
    });

    const closeOnlyOne = createStockInteraction('레버리지청산');
    await handleStockCommand(closeOnlyOne, stocks);

    assert.match(closeOnlyOne.replies[0], /레버리지 중도 청산 완료/);
    assert.match(closeOnlyOne.replies[0], /위약금/);
    assert.match(closeOnlyOne.replies[0], /열려 있는 레버리지 거래가 없습니다/);
  });

  await withFixture(async ({ stocks, store }) => {
    const now = Date.now();
    await seedBalance(store, 'guild-1', 'user-1', '희희', 100_000);
    await stocks.openLeveragedPosition({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      stockId: '희진전자',
      side: 'long',
      leverage: 2,
      margin: 10_000,
      now
    });
    await stocks.openLeveragedPosition({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      stockId: '원숭이닉스',
      side: 'short',
      leverage: 2,
      margin: 10_000,
      now: now + 1
    });

    const chooseInteraction = createStockInteraction('레버리지청산');
    await handleStockCommand(chooseInteraction, stocks);

    assert.match(chooseInteraction.replies[0], /닫을 거래를 골라주세요/);
    assert.ok(getCustomIds(chooseInteraction.rawReplies[0]).some((customId) => customId.startsWith('stock_leverage:close:user-1:')));

    const closeByNumber = createStockInteraction('레버리지청산', {
      strings: { 대상: '1' }
    });
    await handleStockCommand(closeByNumber, stocks);

    assert.match(closeByNumber.replies[0], /레버리지 중도 청산 완료/);
    const after = await stocks.getLeveragePortfolio({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      now
    });
    assert.equal(after.positions.length, 1);
  });
});

test('레버리지는 같은 종목 롱/숏 양방향 포지션을 동시에 열 수 없다', async () => {
  await withFixture(async ({ stocks, store }) => {
    await seedBalance(store, 'guild-1', 'user-1', '희희', 100_000);

    await stocks.openLeveragedPosition({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      stockId: '원숭이닉스',
      side: 'long',
      leverage: 100,
      margin: 10_000,
      now: 0
    });

    await assert.rejects(
      stocks.openLeveragedPosition({
        guildId: 'guild-1',
        userId: 'user-1',
        username: '희희',
        stockId: '원숭이닉스',
        side: 'short',
        leverage: 100,
        margin: 10_000,
        now: 1
      }),
      /반대 방향|양방향|청산/
    );

    const profile = await stocks.getPortfolio({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      now: 1
    });
    assert.equal(profile.cash, 89_800);
    assert.equal(profile.leveragedEquity, 10_000);
    assert.equal(profile.leveragedDebt, 990_000);
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
    assert.equal(portfolio.notionalTotal, 9_500);
    assert.equal(portfolio.debtTotal, 8_550);
    assert.equal(portfolio.equityTotal, 950);
    assert.equal(portfolio.cash, 100);
    assert.equal(closed.position.margin, 950);
    assert.equal(closed.position.debt, 8_550);
    assert.equal(closed.payout, 950);
    assert.equal(closed.profile.balance, 1_050);
  });
});

test('레버리지 포지션은 만기 전 변동을 무시하고 기간 끝 가격으로 자동 정산한다', async () => {
  await withFixture(async ({ stocks, store }) => {
    await seedBalance(store, 'guild-1', 'user-1', '희희', 100_000);
    const opened = await stocks.openLeveragedPosition({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      stockId: '희진전자',
      side: 'short',
      leverage: 10,
      durationTurns: 10,
      margin: 10_000,
      now: 0
    });

    assert.equal(opened.position.entryPrice, 800);

    const beforeExpiry = await stocks.getLeveragePortfolio({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      now: 9 * 3 * 60 * 1000
    });

    assert.equal(beforeExpiry.positions.length, 1);
    assert.equal(beforeExpiry.positions[0].equity, 10_000);
    assert.equal(beforeExpiry.positions[0].unrealizedProfit, 0);
    assert.equal(beforeExpiry.positions[0].remainingTurns, 1);

    await stocks.getMarket({
      guildId: 'guild-1',
      now: 10 * 3 * 60 * 1000
    });

    const portfolio = await stocks.getLeveragePortfolio({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      now: 10 * 3 * 60 * 1000
    });

    assert.equal(portfolio.positions.length, 0);
    assert.equal(portfolio.realizedLeveragedProfit, -10_000);
    assert.equal(portfolio.cash, 89_800);

    assert.equal(portfolio.bankruptcy.debt, 500);

    const history = await stocks.getTradeHistory({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      now: 10 * 3 * 60 * 1000
    });
    assert.equal(history.entries[0].type, 'leverage_settlement');
    assert.equal(history.entries[0].positionId, opened.position.id);
    assert.equal(history.entries[0].bankruptcyDebtAdded, 500);
  }, { randomInt: deterministicRandomInt([100, 100]) });
});

test('파산채무가 남으면 새 레버리지 진입을 막고 이후 골드 수익에서 자동 상환한다', async () => {
  await withFixture(async ({ stocks, store }) => {
    await seedBalance(store, 'guild-1', 'user-1', '희희', 100_000);
    await stocks.openLeveragedPosition({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      stockId: '희진전자',
      side: 'short',
      leverage: 100,
      durationTurns: 30,
      margin: 10_000,
      now: 0
    });

    const liquidated = await settleDefaultLeverageExpiry(stocks);

    assert.equal(liquidated.bankruptcy.debt, 3_500);
    assert.equal(liquidated.bankruptcy.count, 1);

    await assert.rejects(
      stocks.openLeveragedPosition({
        guildId: 'guild-1',
        userId: 'user-1',
        username: '희희',
        stockId: '도훈건설',
        side: 'long',
        leverage: 2,
        margin: 1_000,
        now: DEFAULT_LEVERAGE_EXPIRY_MS_FOR_TEST
      }),
      /파산채무|상환/
    );

    await store.update((data) => {
      const profile = data.accounts?.users?.['user-1'] ?? data.guilds['guild-1'].users['user-1'];
      const before = profile.balance;
      const after = creditCurrency(profile, CURRENCY_MAIN, 1_000);
      assert.equal(after, before + 750);
    });

    const repaid = await stocks.getPortfolio({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      now: DEFAULT_LEVERAGE_EXPIRY_MS_FOR_TEST
    });

    assert.equal(repaid.bankruptcy.debt, 3_250);
    assert.equal(repaid.bankruptcy.paid, 250);
    assert.equal(repaid.cash, 90_550);
  }, { randomInt: deterministicRandomInt([100, 100]) });
});

test('파산채무는 보유 골드로 직접 상환할 수 있고 전액 상환 후 레버리지 진입이 풀린다', async () => {
  await withFixture(async ({ stocks, store }) => {
    await seedBalance(store, 'guild-1', 'user-1', '희희', 100_000);
    await stocks.openLeveragedPosition({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      stockId: '희진전자',
      side: 'short',
      leverage: 100,
      durationTurns: 30,
      margin: 10_000,
      now: 0
    });
    await settleDefaultLeverageExpiry(stocks);

    const repaid = await stocks.repayBankruptcyDebt({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      amount: 10_000,
      now: DEFAULT_LEVERAGE_EXPIRY_MS_FOR_TEST
    });

    assert.equal(repaid.requested, 10_000);
    assert.equal(repaid.repaid, 3_500);
    assert.equal(repaid.bankruptcy.debt, 0);
    assert.equal(repaid.profile.balance, 86_300);

    const reopened = await stocks.openLeveragedPosition({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      stockId: '도훈건설',
      side: 'long',
      leverage: 2,
      margin: 1_000,
      now: DEFAULT_LEVERAGE_EXPIRY_MS_FOR_TEST
    });

    assert.equal(reopened.position.leverage, 2);
  }, { randomInt: deterministicRandomInt([100, 100]) });
});

test('레버리지 명령 화면은 파산채무와 진입 제한을 안내한다', async () => {
  await withFixture(async ({ stocks, store }) => {
    await seedBalance(store, 'guild-1', 'user-1', '희희', 100_000);
    await stocks.openLeveragedPosition({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      stockId: '희진전자',
      side: 'short',
      leverage: 100,
      durationTurns: 30,
      margin: 10_000,
      now: 0
    });
    await settleDefaultLeverageExpiry(stocks);

    const portfolioInteraction = createStockInteraction('레버리지보유');
    await handleStockCommand(portfolioInteraction, stocks);

    assert.match(portfolioInteraction.replies[0], /파산채무: \*\*3,500골드\*\*/);
    assert.match(portfolioInteraction.replies[0], /새 레버리지 진입 불가/);

    const openInteraction = createStockInteraction('레버리지진입', {
      strings: { 종목: '도훈건설', 방향: '롱' },
      integers: { 배율: 2, 증거금: 1_000 }
    });
    await handleStockCommand(openInteraction, stocks);

    assert.match(openInteraction.replies[0], /파산채무 3,500골드/);
    assert.match(openInteraction.replies[0], /자동 상환/);
  }, { randomInt: deterministicRandomInt([100, 100]) });
});

test('채무상환 명령은 내 골드로 파산채무를 갚고 결과를 안내한다', async () => {
  await withFixture(async ({ stocks, store }) => {
    await seedBalance(store, 'guild-1', 'user-1', '희희', 100_000);
    await stocks.openLeveragedPosition({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      stockId: '희진전자',
      side: 'short',
      leverage: 100,
      durationTurns: 30,
      margin: 10_000,
      now: 0
    });
    await settleDefaultLeverageExpiry(stocks);

    const repayInteraction = createStockInteraction('채무상환', {
      integers: { 금액: 10_000 }
    });
    await handleStockCommand(repayInteraction, stocks);

    assert.match(repayInteraction.replies[0], /파산채무 상환 완료/);
    assert.match(repayInteraction.replies[0], /상환: \*\*3,500골드\*\*/);
    assert.match(repayInteraction.replies[0], /남은 채무: \*\*0골드\*\*/);
    assert.match(repayInteraction.replies[0], /레버리지 진입 가능/);

  }, { randomInt: deterministicRandomInt([100, 100]) });
});

test('레버리지 중도 청산은 현재 손익에서 추가 수수료와 위약금을 차감한다', async () => {
  await withFixture(async ({ stocks, store }) => {
    await seedBalance(store, 'guild-1', 'user-1', '희희', 100_000);
    const opened = await stocks.openLeveragedPosition({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      stockId: '희진전자',
      side: 'long',
      leverage: 100,
      durationTurns: 30,
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
    assert.equal(closed.earlyClosed, true);
    assert.equal(closed.position.currentPrice, 808);
    assert.equal(closed.grossPayout, 20_000);
    assert.equal(closed.closingFee, 200);
    assert.equal(closed.penalty, 9_500);
    assert.equal(closed.realizedProfit, 300);
    assert.equal(closed.payout, 10_300);
    assert.equal(closed.profile.balance, 100_100);
  }, { randomInt: deterministicRandomInt([100, 100]) });
});

test('레버리지 만기 자동정산은 수수료와 위약금 없이 끝 가격 손익을 지급한다', async () => {
  await withFixture(async ({ stocks, store }) => {
    await seedBalance(store, 'guild-1', 'user-1', '희희', 100_000);
    const opened = await stocks.openLeveragedPosition({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      stockId: '희진전자',
      side: 'long',
      leverage: 10,
      durationTurns: 10,
      margin: 10_000,
      now: 0
    });

    await stocks.getMarket({
      guildId: 'guild-1',
      now: 10 * 3 * 60 * 1000
    });

    const portfolio = await stocks.getLeveragePortfolio({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      now: 10 * 3 * 60 * 1000
    });
    const history = await stocks.getTradeHistory({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '희희',
      now: 10 * 3 * 60 * 1000
    });

    assert.equal(portfolio.positions.length, 0);
    assert.equal(history.entries[0].type, 'leverage_settlement');
    assert.equal(history.entries[0].positionId, opened.position.id);
    assert.equal(history.entries[0].fee, 0);
    assert.equal(history.entries[0].penalty, 0);
    assert.equal(history.entries[0].realizedProfit, 10_380);
    assert.equal(portfolio.realizedLeveragedProfit, 10_380);
    assert.equal(portfolio.cash, 110_180);
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

async function settleDefaultLeverageExpiry(stocks, {
  guildId = 'guild-1',
  userId = 'user-1',
  username = '희희'
} = {}) {
  await stocks.getMarket({ guildId, now: MAX_CATCH_UP_MS_FOR_TEST });
  return stocks.getLeveragePortfolio({
    guildId,
    userId,
    username,
    now: DEFAULT_LEVERAGE_EXPIRY_MS_FOR_TEST
  });
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

function rotatingAutoIpoNameRandomInt() {
  let variantIndex = 0;
  return (min, max) => {
    if (min === 1 && max === 10_000) return 1;
    if (min === 1 && max === 100) return 99;
    if (min === 0 && max === 3) {
      const value = variantIndex % 4;
      variantIndex += 1;
      return value;
    }
    return min;
  };
}

function sequentialAutoIpoThemeRandomInt() {
  let themeIndex = 0;
  return (min, max) => {
    if (min === 1 && max === 10_000) return 1;
    if (min === 1 && max === 100) return 99;
    if (min === 0 && max === 63) {
      const value = themeIndex % 64;
      themeIndex += 1;
      return value;
    }
    return min;
  };
}

function scriptedRandomInt(values, fallback = 100) {
  let index = 0;
  return (min, max) => {
    const value = index < values.length ? values[index] : fallback;
    index += 1;
    return Math.min(max, Math.max(min, value));
  };
}

function singleStockPositiveNewsRandomInt() {
  let tick = 1;
  let eventRollIndex = 0;
  let awaitingHeadlineImpact = false;
  let awaitingOutcome = false;

  return (min, max) => {
    if (awaitingOutcome && min === 1 && max === 100) {
      awaitingOutcome = false;
      return 1;
    }

    if (awaitingHeadlineImpact && min < 0 && max > 0) {
      awaitingHeadlineImpact = false;
      awaitingOutcome = true;
      return max;
    }

    if (min === 1 && max === 100) {
      const shouldPublishNews = eventRollIndex === 0;
      eventRollIndex += 1;
      if (eventRollIndex >= getActiveStockCountForTick(tick)) {
        eventRollIndex = 0;
        tick += 1;
      }
      if (shouldPublishNews) {
        awaitingHeadlineImpact = true;
        return 1;
      }
      return 100;
    }

    if (min < 0 && max > 0) return 0;
    return min;
  };
}

function getActiveStockCountForTick(tick) {
  if (tick <= 2) return 36;
  if (tick <= 13) return tick + 34;
  return 48;
}

function createStockInteraction(subcommand, options = {}) {
  const {
    guildId = 'guild-1',
    channelId = 'channel-1',
    user = { id: 'user-1', username: '희희' },
    strings = {},
    integers = {},
    targetUser = null,
    memberPermissions = null
  } = options;
  const replies = [];
  const rawReplies = [];

  return {
    commandName: '주식',
    guildId,
    channelId,
    user,
    replies,
    rawReplies,
    replyPayloads: rawReplies,
    deferred: false,
    replied: false,
    isChatInputCommand: () => true,
    isButton: () => false,
    inGuild: () => true,
    memberPermissions,
    options: {
      getSubcommand: () => subcommand,
      getString: (name) => strings[name] ?? null,
      getInteger: (name) => integers[name] ?? null,
      getUser: () => targetUser
    },
    async reply(payload) {
      this.replied = true;
      const content = getReplyContent(payload);
      assert.ok(content.length <= 2000, `Discord content limit exceeded: ${content.length}`);
      rawReplies.push(payload);
      replies.push(content);
    },
    async followUp(payload) {
      const content = getReplyContent(payload);
      assert.ok(content.length <= 2000, `Discord content limit exceeded: ${content.length}`);
      rawReplies.push(payload);
      replies.push(content);
    }
  };
}

function getReplyContent(payload) {
  return typeof payload === 'string' ? payload : payload.content;
}

function createStockButtonInteraction(input, options = {}) {
  const config = typeof input === 'string' ? { ...options, customId: input } : input;
  const {
    customId,
    guildId = 'guild-1',
    userId = 'user-1',
    user = { id: userId, username: '희희' },
    updates = [],
    replies = []
  } = config;

  return {
    customId,
    guildId,
    user,
    replies,
    updates,
    deferred: false,
    replied: false,
    isChatInputCommand: () => false,
    isButton: () => true,
    inGuild: () => true,
    async update(payload) {
      assert.ok(payload.content.length <= 2000, `Discord content limit exceeded: ${payload.content.length}`);
      updates.push(payload);
    },
    async reply(payload) {
      const content = getReplyContent(payload);
      assert.ok(content.length <= 2000, `Discord content limit exceeded: ${content.length}`);
      replies.push(payload);
    }
  };
}

function getCustomIds(payload) {
  return (payload.components ?? [])
    .flatMap((row) => row.components ?? [])
    .map((component) => component.data?.custom_id ?? component.custom_id)
    .filter(Boolean);
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

function createStockTradeResultForTest({ remainingQuantity = 1, realizedProfit = 0 } = {}) {
  return {
    stock: createQuoteForTest('희진전자', 'HEEL'),
    quantity: 2,
    price: 800,
    subtotal: 1_600,
    fee: 16,
    realizedProfit,
    profile: { balance: 98_384 },
    holding: {
      quantity: remainingQuantity,
      averageCost: 800
    }
  };
}

function createStockAutocompleteInteraction(subcommand, focusedValue, options = {}) {
  const {
    guildId = 'guild-1',
    user = { id: 'user-1', username: '희희' },
    inGuild = true,
    focusedName = '종목',
    respondError = null
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
      getFocused: () => ({ name: focusedName, value: focusedValue })
    },
    async respond(nextChoices) {
      if (respondError) throw respondError;
      choices.push(...nextChoices);
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

function createRejectingSeasonSpy() {
  return {
    async awardPoints() {
      throw new Error('season ledger unavailable');
    }
  };
}
