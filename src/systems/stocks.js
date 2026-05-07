import {
  CURRENCY_STOCK,
  cloneWallets,
  convertLegacyCurrencyAmountToGold,
  creditCurrency,
  debitCurrency,
  getCurrencyBalance,
  migrateLegacyWalletsToGold,
  normalizeWallets
} from './currencies.js';

const DEFAULT_TICK_MS = 3 * 60 * 1000;
const DEFAULT_FEE_BPS = 100;
const DEFAULT_LEVERAGE_FEE_BPS = 200;
const MAX_CATCH_UP_TICKS = 24;
const MIN_STOCK_PRICE = 10;
const RECENT_ORDER_LIMIT = 10;
const RECENT_ALERT_LIMIT = 10;
const RECENT_TRADE_LIMIT = 20;
const RECENT_NEWS_LIMIT = 20;
const PRICE_HISTORY_LIMIT = 48;
const AUTO_IPO_CHECK_TICKS = 5;
const UNIFIED_GOLD_STOCK_MIGRATION_VERSION = 1;
const DEFAULT_AUTO_IPO_CHANCE_BPS = 1_500;
const DEFAULT_MAX_DYNAMIC_STOCKS = 50;

const STOCK_DEFINITIONS = Object.freeze([
  stock('heejin_electronics', '희진전자', '전자', 'stable', 800, 800, 12),
  stock('heejin_bio', '희진바이오', '바이오', 'volatile', 520, 1300, 18),
  stock('heejin_mobility', '희진모빌리티', '모빌리티', 'growth', 610, 1000, 14),
  stock('jaesung_electronics', '재성전자', '전자', 'stable', 760, 850, 12),
  stock('jaesung_heavy', '재성중공업', '중공업', 'cyclical', 430, 950, 13),
  stock('jaesung_energy', '재성에너지', '에너지', 'cyclical', 690, 1100, 15),
  stock('junseo_kakao', '준서카카오', '플랫폼', 'meme', 1_050, 1500, 20),
  stock('junseo_construction', '준서건설', '건설', 'cyclical', 370, 900, 12),
  stock('junseo_games', '준서게임즈', '게임', 'growth', 580, 1400, 18),
  stock('jio_motors', '지오모터스', '자동차', 'growth', 720, 1200, 16),
  stock('jio_software', '지오소프트', 'IT', 'growth', 980, 1150, 14),
  stock('jio_pay', '지오페이', '핀테크', 'growth', 640, 1250, 16),
  stock('hyeongyeom_heavy', '현겸중공업', '중공업', 'cyclical', 460, 950, 12),
  stock('hyeongyeom_pharma', '현겸제약', '제약', 'volatile', 540, 1300, 17),
  stock('hyeongyeom_oilbank', '현겸오일뱅크', '에너지', 'cyclical', 830, 1000, 13),
  stock('jimin_pharma', '지민제약', '제약', 'volatile', 490, 1250, 17),
  stock('jimin_biologics', '지민바이오로직스', '바이오', 'volatile', 1_120, 1500, 20),
  stock('jimin_chemical', '지민화학', '화학', 'cyclical', 400, 900, 12),
  stock('yongha_energy', '용하에너지', '에너지', 'cyclical', 740, 1050, 14),
  stock('yongha_shipping', '용하해운', '해운', 'cyclical', 360, 1100, 15),
  stock('yongha_semiconductor', '용하반도체', '반도체', 'growth', 890, 1250, 17),
  stock('mingeon_financial', '민건금융지주', '금융', 'stable', 700, 700, 10),
  stock('mingeon_securities', '민건증권', '증권', 'meme', 530, 1350, 19),
  stock('mingeon_capital', '민건캐피탈', '금융', 'stable', 450, 850, 11),
  stock('dohye_games', '도혜게임즈', '게임', 'meme', 620, 1600, 22),
  stock('dohye_entertainment', '도혜엔터', '엔터', 'meme', 550, 1450, 20),
  stock('dohye_commerce', '도혜커머스', '커머스', 'growth', 680, 1100, 14, [], 'DHCO'),
  stock('seojeong_securities', '서정증권', '증권', 'stable', 640, 750, 10),
  stock('seojeong_trading', '서정물산', '물산', 'stable', 390, 800, 11),
  stock('seojeong_cloud', '서정클라우드', '클라우드', 'growth', 930, 1200, 15),
  stock('monkeynix', '원숭이닉스', '반도체', 'meme', 660, 1800, 25, ['원숭이하이닉스']),
  stock('monkey_electronics', '원숭이전자', '전자', 'meme', 590, 1700, 24),
  stock('monkey_bio', '원숭이바이오', '바이오', 'meme', 420, 1900, 26),
  stock('dohun_construction', '도훈건설', '건설', 'meme', 330, 1500, 22),
  stock('dohun_heavy', '도훈중공업', '중공업', 'cyclical', 410, 1050, 14),
  stock('dohun_steel', '도훈철강', '철강', 'meme', 290, 1650, 23),
  stock('heejin_ai', '희진AI', 'AI', 'growth', 1_240, 1450, 18, ['희진인공지능'], 'HEAI', { listedFromTick: 2 }),
  stock('jaesung_robotics', '재성로보틱스', '로봇', 'growth', 880, 1350, 17, [], 'JARO', { listedFromTick: 3 }),
  stock('junseo_streaming', '준서스트리밍', '플랫폼', 'meme', 760, 1650, 22, [], 'JUST', { listedFromTick: 4 }),
  stock('jio_quant', '지오퀀트', '핀테크', 'volatile', 1_180, 1500, 19, [], 'JIQU', { listedFromTick: 5 }),
  stock('hyeongyeom_defense', '현겸방산', '방산', 'cyclical', 930, 1000, 13, [], 'HYDE', { listedFromTick: 6 }),
  stock('jimin_foods', '지민푸드', '식품', 'stable', 540, 750, 10, [], 'JIFO', { listedFromTick: 7 }),
  stock('yongha_entertainment', '용하엔터', '엔터', 'meme', 690, 1550, 21, [], 'YHEN', { listedFromTick: 8 }),
  stock('mingeon_motors', '민건모터스', '자동차', 'growth', 810, 1200, 16, [], 'MIMO', { listedFromTick: 9 }),
  stock('dohye_cosmetics', '도혜화장품', '화장품', 'growth', 620, 1100, 14, [], 'DHBE', { listedFromTick: 10 }),
  stock('seojeong_medical', '서정메디컬', '의료기기', 'volatile', 730, 1450, 18, [], 'SEME', { listedFromTick: 11 }),
  stock('monkey_airlines', '원숭이항공', '항공', 'meme', 450, 1750, 25, ['원숭이항공사'], 'MOAI', { listedFromTick: 12 }),
  stock('dohun_reits', '도훈리츠', '부동산', 'stable', 510, 800, 11, [], 'DORE', { listedFromTick: 13 })
]);

const STOCKS_BY_ID = Object.freeze(Object.fromEntries(
  STOCK_DEFINITIONS.map((definition) => [definition.id, definition])
));

const STOCK_LOOKUP = Object.freeze(new Map(
  STOCK_DEFINITIONS.flatMap((definition) => [
    [normalizeLookupKey(definition.id), definition.id],
    [normalizeLookupKey(definition.name), definition.id],
    [normalizeLookupKey(definition.symbol), definition.id],
    ...definition.aliases.map((alias) => [normalizeLookupKey(alias), definition.id])
  ])
));

const PRE_MARKET_NEWS_TEMPLATES = Object.freeze({
  positive: Object.freeze({
    stable: Object.freeze([
      '{name} 배당 정책 검토 자료가 게시됐습니다',
      '{name} 실적 설명회 일정이 공개됐습니다',
      '{name} 장기 공급 계약 진행 상황 안내가 올라왔습니다'
    ]),
    growth: Object.freeze([
      '{name} 신제품 공개 일정이 예고됐습니다',
      '{name} 신규 서비스 사전 안내가 게시됐습니다',
      '{name} AI 협업 관련 질의응답 일정이 잡혔습니다'
    ]),
    cyclical: Object.freeze([
      '{name} 신규 수주 협상 진행 상황이 공지됐습니다',
      '{name} 원가 구조 점검 자료가 공시됐습니다',
      '{name} 대형 프로젝트 관련 일정 안내가 나왔습니다'
    ]),
    volatile: Object.freeze([
      '{name} 임상 데이터 공개 일정이 잡혔습니다',
      '{name} 연구 성과 발표 예고가 게시됐습니다',
      '{name} 기술 이전 논의 관련 자료가 게시됐습니다'
    ]),
    meme: Object.freeze([
      '{name} 커뮤니티 협업 이벤트 예고가 퍼졌습니다',
      '{name} 신규 굿즈 공개 일정이 알려졌습니다',
      '{name} 유명 스트리머 협업 관련 안내가 나왔습니다'
    ])
  }),
  negative: Object.freeze({
    stable: Object.freeze([
      '{name} 비용 구조 점검 자료가 게시됐습니다',
      '{name} 배당 정책 재검토 가능성이 공시됐습니다',
      '{name} 주요 고객사 발주 일정 조율 안내가 나왔습니다'
    ]),
    growth: Object.freeze([
      '{name} 신사업 출시 일정 지연 가능성이 제기됐습니다',
      '{name} 개발비 집행 계획 변경 공시가 게시됐습니다',
      '{name} 경쟁 환경 관련 설명자료가 공개됐습니다'
    ]),
    cyclical: Object.freeze([
      '{name} 원자재 조달 비용 점검 자료가 나왔습니다',
      '{name} 수주 일정 조정 가능성이 전해졌습니다',
      '{name} 경기 민감도 검토 보고서가 나왔습니다'
    ]),
    volatile: Object.freeze([
      '{name} 허가 심사 보완 요청 가능성이 제기됐습니다',
      '{name} 연구비 조달 계획 보완 공시가 게시됐습니다',
      '{name} 핵심 데이터 공개 지연 가능성이 나왔습니다'
    ]),
    meme: Object.freeze([
      '{name} 커뮤니티 운영 관련 추가 공지가 예고됐습니다',
      '{name} 운영진 해명 공지 예고가 나왔습니다',
      '{name} 밈 캠페인 일정 연기 가능성이 제기됐습니다'
    ])
  }),
  risk: Object.freeze({
    volatile: Object.freeze([
      '{name} 거래소 확인 자료 제출 일정이 공지됐습니다',
      '{name} 핵심 파이프라인 추가 설명자료가 게시됐습니다',
      '{name} 자금 조달 계획 보완 자료가 접수됐습니다'
    ]),
    meme: Object.freeze([
      '{name} 거래소 확인 자료 제출 일정이 공지됐습니다',
      '{name} 운영 관련 소명 자료 접수 가능성이 나왔습니다',
      '{name} 커뮤니티 집계 방식 추가 설명 공지가 게시됐습니다'
    ])
  })
});

const AUTO_IPO_PREFIXES = Object.freeze([
  '희진',
  '재성',
  '준서',
  '지오',
  '현겸',
  '지민',
  '용하',
  '민건',
  '도혜',
  '서정',
  '원숭이',
  '도훈'
]);

const AUTO_IPO_THEMES = Object.freeze([
  Object.freeze({ suffix: 'AI랩스', sector: 'AI', risk: 'growth', basePriceMin: 650, basePriceMax: 1_600, volatilityBps: 1450, eventChance: 18 }),
  Object.freeze({ suffix: '로켓모빌리티', sector: '모빌리티', risk: 'meme', basePriceMin: 420, basePriceMax: 1_250, volatilityBps: 1700, eventChance: 24 }),
  Object.freeze({ suffix: '바이오텍', sector: '바이오', risk: 'volatile', basePriceMin: 380, basePriceMax: 1_450, volatilityBps: 1800, eventChance: 25 }),
  Object.freeze({ suffix: '클라우드', sector: '클라우드', risk: 'growth', basePriceMin: 700, basePriceMax: 1_500, volatilityBps: 1250, eventChance: 16 }),
  Object.freeze({ suffix: '푸드', sector: '식품', risk: 'stable', basePriceMin: 320, basePriceMax: 800, volatilityBps: 750, eventChance: 10 }),
  Object.freeze({ suffix: '엔터', sector: '엔터', risk: 'meme', basePriceMin: 450, basePriceMax: 1_200, volatilityBps: 1600, eventChance: 22 }),
  Object.freeze({ suffix: '리츠', sector: '부동산', risk: 'stable', basePriceMin: 350, basePriceMax: 900, volatilityBps: 800, eventChance: 11 }),
  Object.freeze({ suffix: '퀀트', sector: '핀테크', risk: 'volatile', basePriceMin: 500, basePriceMax: 1_700, volatilityBps: 1500, eventChance: 20 })
]);

const AUTO_IPO_PREFIX_SYMBOLS = Object.freeze({
  희진: 'HJ',
  재성: 'JS',
  준서: 'JN',
  지오: 'JI',
  현겸: 'HY',
  지민: 'JM',
  용하: 'YH',
  민건: 'MG',
  도혜: 'DH',
  서정: 'SJ',
  원숭이: 'MO',
  도훈: 'DO'
});

const AUTO_IPO_SECTOR_SYMBOLS = Object.freeze({
  AI: 'AI',
  IT: 'IT',
  모빌리티: 'MB',
  바이오: 'BI',
  클라우드: 'CL',
  식품: 'FD',
  엔터: 'EN',
  부동산: 'RE',
  핀테크: 'FT',
  전자: 'EL',
  중공업: 'HI',
  에너지: 'EG',
  플랫폼: 'PF',
  건설: 'CN',
  게임: 'GM',
  자동차: 'AU',
  제약: 'PH',
  화학: 'CH',
  해운: 'SH',
  반도체: 'SC',
  금융: 'FN',
  증권: 'SE',
  커머스: 'CM',
  물산: 'TR',
  로봇: 'RB',
  방산: 'DF',
  화장품: 'BE',
  의료기기: 'MD',
  항공: 'AR',
  철강: 'ST',
  밈: 'MM'
});

export class StockService {
  constructor(store, options = {}) {
    const hasCustomRandomInt = options.randomInt !== undefined;
    this.store = store;
    this.randomInt = options.randomInt ?? randomInt;
    this.ipoRandomInt = options.ipoRandomInt ?? (hasCustomRandomInt ? null : randomInt);
    this.tickMs = options.tickMs ?? DEFAULT_TICK_MS;
    this.feeBps = options.feeBps ?? DEFAULT_FEE_BPS;
    this.leverageFeeBps = options.leverageFeeBps ?? DEFAULT_LEVERAGE_FEE_BPS;
    this.autoIpoChanceBps = options.autoIpoChanceBps ?? (hasCustomRandomInt ? 0 : DEFAULT_AUTO_IPO_CHANCE_BPS);
    this.maxDynamicStocks = options.maxDynamicStocks ?? DEFAULT_MAX_DYNAMIC_STOCKS;
  }

  async getMarket({ guildId, now = Date.now(), limit = null } = {}) {
    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = syncMarket(guild, now, this);
      return cloneMarket(market, limit);
    });
  }

  async getQuote({ guildId, stockId, now = Date.now() }) {
    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = syncMarket(guild, now, this);
      const normalizedStockId = normalizeStockIdForGuild(stockId, guild);
      return cloneQuote(normalizedStockId, market.symbols[normalizedStockId]);
    });
  }

  async getListings({ guildId, now = Date.now() }) {
    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = syncMarket(guild, now, this);
      return buildListingSummary(market);
    });
  }

  async buyStock({ guildId, userId, username, stockId, quantity, now = Date.now() }) {
    const normalizedQuantity = normalizePositiveInteger(quantity, '수량');

    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = syncMarket(guild, now, this);
      const normalizedStockId = normalizeStockIdForGuild(stockId, guild);
      const profile = getOrCreateMoneyProfile(guild, userId, username, now);
      const stockUser = getOrCreateStockUser(guild, userId, username);
      const quote = getTradableQuote(normalizedStockId, market);
      const subtotal = quote.price * normalizedQuantity;
      const fee = calculateFee(subtotal, this.feeBps);
      const totalCost = subtotal + fee;

      if (getCurrencyBalance(profile, CURRENCY_STOCK) < totalCost) {
        throw new Error(`골드가 부족합니다. 필요 금액: ${totalCost.toLocaleString()}골드`);
      }

      const holding = stockUser.holdings[normalizedStockId] ?? createEmptyHolding();
      const beforeQuantity = holding.quantity;
      const afterQuantity = beforeQuantity + normalizedQuantity;
      const beforeCost = holding.averageCost * beforeQuantity;
      const afterCost = beforeCost + subtotal;

      debitCurrency(profile, CURRENCY_STOCK, totalCost);
      stockUser.tradeCount += 1;
      stockUser.lastTradeAt = now;
      stockUser.holdings[normalizedStockId] = {
        quantity: afterQuantity,
        averageCost: Math.round(afterCost / afterQuantity)
      };
      recordTrade(stockUser, {
        type: 'buy',
        stockId: normalizedStockId,
        stock: quote,
        quantity: normalizedQuantity,
        price: quote.price,
        fee,
        total: totalCost,
        realizedProfit: 0,
        at: now
      });

      return {
        type: 'buy',
        stock: quote,
        stockId: normalizedStockId,
        quantity: normalizedQuantity,
        price: quote.price,
        subtotal,
        fee,
        totalCost,
        profile: cloneMoneyProfile(profile),
        holding: cloneHolding(stockUser.holdings[normalizedStockId])
      };
    });
  }

  async sellStock({ guildId, userId, username, stockId, quantity, now = Date.now() }) {
    const normalizedQuantity = normalizePositiveInteger(quantity, '수량');

    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = syncMarket(guild, now, this);
      const normalizedStockId = normalizeStockIdForGuild(stockId, guild);
      const profile = getOrCreateMoneyProfile(guild, userId, username, now);
      const stockUser = getOrCreateStockUser(guild, userId, username);
      const holding = stockUser.holdings[normalizedStockId];

      if (!holding || holding.quantity < normalizedQuantity) {
        throw new Error('보유 주식 수량이 부족합니다.');
      }

      const quote = cloneQuote(normalizedStockId, market.symbols[normalizedStockId]);
      const subtotal = quote.price * normalizedQuantity;
      const fee = calculateFee(subtotal, this.feeBps);
      const proceeds = subtotal - fee;
      const realizedProfit = proceeds - holding.averageCost * normalizedQuantity;
      const remainingQuantity = holding.quantity - normalizedQuantity;

      creditCurrency(profile, CURRENCY_STOCK, proceeds);
      stockUser.realizedProfit += realizedProfit;
      stockUser.tradeCount += 1;
      stockUser.lastTradeAt = now;

      if (remainingQuantity <= 0) {
        delete stockUser.holdings[normalizedStockId];
      } else {
        stockUser.holdings[normalizedStockId] = {
          quantity: remainingQuantity,
          averageCost: holding.averageCost
        };
      }
      recordTrade(stockUser, {
        type: 'sell',
        stockId: normalizedStockId,
        stock: quote,
        quantity: normalizedQuantity,
        price: quote.price,
        fee,
        total: proceeds,
        realizedProfit,
        at: now
      });

      return {
        type: 'sell',
        stock: quote,
        stockId: normalizedStockId,
        quantity: normalizedQuantity,
        price: quote.price,
        subtotal,
        fee,
        proceeds,
        realizedProfit,
        profile: cloneMoneyProfile(profile),
        holding: cloneHolding(stockUser.holdings[normalizedStockId] ?? createEmptyHolding()),
        stockUser: cloneStockUser(stockUser)
      };
    });
  }

  async placeLimitOrder({
    guildId,
    userId,
    username,
    stockId,
    side = 'buy',
    quantity,
    limitPrice,
    now = Date.now()
  }) {
    const normalizedSide = normalizeLimitOrderSide(side);
    const normalizedQuantity = normalizePositiveInteger(quantity, '수량');
    const normalizedLimitPrice = normalizePositiveInteger(limitPrice, '지정가');

    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = syncMarket(guild, now, this);
      const normalizedStockId = normalizeStockIdForGuild(stockId, guild);
      const profile = getOrCreateMoneyProfile(guild, userId, username, now);
      const stockUser = getOrCreateStockUser(guild, userId, username);
      const quote = getTradableQuote(normalizedStockId, market);
      const order = {
        id: createStockOrderId(now, stockUser.nextOrderSeq + 1),
        userId,
        username: username || stockUser.username,
        stockId: normalizedStockId,
        side: normalizedSide,
        quantity: normalizedQuantity,
        limitPrice: normalizedLimitPrice,
        status: 'open',
        createdAt: normalizeNonNegativeInteger(now),
        filledAt: 0,
        cancelledAt: 0,
        fillPrice: 0,
        fee: 0,
        reservedCash: 0,
        reservedQuantity: 0,
        averageCost: 0,
        realizedProfit: 0,
        cancelReason: null
      };

      if (normalizedSide === 'buy') {
        const subtotal = normalizedLimitPrice * normalizedQuantity;
        const fee = calculateFee(subtotal, this.feeBps);
        const reservedCash = subtotal + fee;
        if (getCurrencyBalance(profile, CURRENCY_STOCK) < reservedCash) {
          throw new Error(`골드가 부족합니다. 필요 예약금: ${reservedCash.toLocaleString()}골드`);
        }
        debitCurrency(profile, CURRENCY_STOCK, reservedCash);
        order.reservedCash = reservedCash;
      } else {
        const holding = stockUser.holdings[normalizedStockId];
        if (!holding || holding.quantity < normalizedQuantity) {
          throw new Error('보유 주식 수량이 부족합니다.');
        }
        order.reservedQuantity = normalizedQuantity;
        order.averageCost = holding.averageCost;
        removeHolding(stockUser, normalizedStockId, normalizedQuantity);
      }

      stockUser.nextOrderSeq += 1;
      stockUser.limitOrders[order.id] = order;

      return cloneLimitOrder(order, market, quote);
    });
  }

  async getLimitOrders({ guildId, userId, username, now = Date.now() }) {
    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = syncMarket(guild, now, this);
      getOrCreateMoneyProfile(guild, userId, username, now);
      const stockUser = getOrCreateStockUser(guild, userId, username);
      return buildLimitOrderSummary(stockUser, market);
    });
  }

  async cancelLimitOrder({ guildId, userId, username, orderId, now = Date.now() }) {
    const normalizedOrderId = String(orderId ?? '').trim();
    if (!normalizedOrderId) throw new Error('주문 id를 입력하세요.');

    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = syncMarket(guild, now, this);
      const profile = getOrCreateMoneyProfile(guild, userId, username, now);
      const stockUser = getOrCreateStockUser(guild, userId, username);
      const order = stockUser.limitOrders[normalizedOrderId];

      if (!order) throw new Error('해당 지정가 주문을 찾을 수 없습니다.');
      if (order.status !== 'open') throw new Error('이미 체결되었거나 취소된 주문입니다.');

      cancelOpenLimitOrder(profile, stockUser, order, now, '사용자 취소');
      return cloneLimitOrder(order, market);
    });
  }

  async setPriceAlert({
    guildId,
    userId,
    username,
    stockId,
    condition = 'above',
    targetPrice,
    now = Date.now()
  }) {
    const normalizedCondition = normalizeAlertCondition(condition);
    const normalizedTargetPrice = normalizePositiveInteger(targetPrice, '알림 가격');

    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = syncMarket(guild, now, this);
      const normalizedStockId = normalizeStockIdForGuild(stockId, guild);
      getOrCreateMoneyProfile(guild, userId, username, now);
      const stockUser = getOrCreateStockUser(guild, userId, username);
      const quote = getTradableQuote(normalizedStockId, market);
      const alert = {
        id: createStockAlertId(now, stockUser.nextAlertSeq + 1),
        userId,
        username: username || stockUser.username,
        stockId: normalizedStockId,
        condition: normalizedCondition,
        targetPrice: normalizedTargetPrice,
        status: 'active',
        createdAt: normalizeNonNegativeInteger(now),
        triggeredAt: 0,
        triggeredPrice: 0,
        deletedAt: 0
      };

      stockUser.nextAlertSeq += 1;
      stockUser.priceAlerts[alert.id] = alert;
      return clonePriceAlert(alert, market, quote);
    });
  }

  async getPriceAlerts({ guildId, userId, username, now = Date.now() }) {
    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = syncMarket(guild, now, this);
      getOrCreateMoneyProfile(guild, userId, username, now);
      const stockUser = getOrCreateStockUser(guild, userId, username);
      return buildPriceAlertSummary(stockUser, market);
    });
  }

  async deletePriceAlert({ guildId, userId, username, alertId, now = Date.now() }) {
    const normalizedAlertId = String(alertId ?? '').trim();
    if (!normalizedAlertId) throw new Error('알림 id를 입력하세요.');

    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = syncMarket(guild, now, this);
      getOrCreateMoneyProfile(guild, userId, username, now);
      const stockUser = getOrCreateStockUser(guild, userId, username);
      const alert = stockUser.priceAlerts[normalizedAlertId];

      if (!alert) throw new Error('해당 가격 알림을 찾을 수 없습니다.');
      alert.status = 'deleted';
      alert.deletedAt = normalizeNonNegativeInteger(now);
      return clonePriceAlert(alert, market);
    });
  }

  async getTradeHistory({ guildId, userId, username, limit = RECENT_TRADE_LIMIT, now = Date.now() }) {
    const safeLimit = Math.min(RECENT_TRADE_LIMIT, Math.max(1, Number(limit) || RECENT_TRADE_LIMIT));

    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = syncMarket(guild, now, this);
      getOrCreateMoneyProfile(guild, userId, username, now);
      const stockUser = getOrCreateStockUser(guild, userId, username);

      return {
        userId: stockUser.userId,
        username: stockUser.username,
        entries: stockUser.tradeHistory
          .map((entry) => cloneTradeHistoryEntry(entry, market))
          .sort(compareTimelineEntries)
          .slice(0, safeLimit)
      };
    });
  }

  async getNews({ guildId, limit = RECENT_NEWS_LIMIT, now = Date.now() }) {
    const safeLimit = Math.min(RECENT_NEWS_LIMIT, Math.max(1, Number(limit) || RECENT_NEWS_LIMIT));

    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = syncMarket(guild, now, this);

      return {
        tickIndex: market.tickIndex,
        entries: normalizeMarketNews(guild.stocks.marketNews, guild)
          .map((entry) => cloneMarketNewsEntry(entry, market))
          .sort(compareMarketNewsEntries)
          .slice(0, safeLimit)
      };
    });
  }

  async getChart({ guildId, stockId, points = 12, now = Date.now() }) {
    const safePoints = Math.min(PRICE_HISTORY_LIMIT, Math.max(2, Number(points) || 12));

    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = syncMarket(guild, now, this);
      const normalizedStockId = normalizeStockIdForGuild(stockId, guild);
      const stock = cloneQuote(normalizedStockId, market.symbols[normalizedStockId]);
      const history = normalizePriceHistory(market.symbols[normalizedStockId]?.history, market.symbols[normalizedStockId], market.tickIndex, market.lastTickAt)
        .slice(-safePoints);

      return {
        stock,
        history
      };
    });
  }

  async openLeveragedPosition({
    guildId,
    userId,
    username,
    stockId,
    side = 'long',
    leverage,
    margin,
    now = Date.now()
  }) {
    const normalizedSide = normalizeLeverageSide(side);
    const normalizedLeverage = normalizeLeverage(leverage);
    const normalizedMargin = normalizePositiveInteger(margin, '증거금');

    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = syncMarket(guild, now, this);
      const normalizedStockId = normalizeStockIdForGuild(stockId, guild);
      const profile = getOrCreateMoneyProfile(guild, userId, username, now);
      const stockUser = getOrCreateStockUser(guild, userId, username);
      const liquidated = liquidateLeveragedPositions(profile, stockUser, market);
      const quote = getTradableQuote(normalizedStockId, market);
      const fee = calculateFee(normalizedMargin, this.leverageFeeBps);
      const totalCost = normalizedMargin + fee;

      if (getCurrencyBalance(profile, CURRENCY_STOCK) < totalCost) {
        throw new Error(`골드가 부족합니다. 필요 금액: ${totalCost.toLocaleString()}골드`);
      }

      debitCurrency(profile, CURRENCY_STOCK, totalCost);
      stockUser.nextPositionSeq += 1;
      stockUser.leveragedTradeCount += 1;
      stockUser.lastTradeAt = now;

      const position = {
        id: createLeveragedPositionId(now, stockUser.nextPositionSeq),
        stockId: normalizedStockId,
        side: normalizedSide,
        leverage: normalizedLeverage,
        margin: normalizedMargin,
        entryPrice: quote.price,
        openedAt: now
      };
      stockUser.leveragedPositions[position.id] = position;
      recordTrade(stockUser, {
        type: 'leverage_open',
        stockId: normalizedStockId,
        stock: quote,
        quantity: 0,
        price: quote.price,
        fee,
        total: totalCost,
        realizedProfit: 0,
        at: now,
        positionId: position.id,
        side: normalizedSide,
        leverage: normalizedLeverage,
        margin: normalizedMargin
      });

      return {
        type: 'open_leverage',
        stock: quote,
        stockId: normalizedStockId,
        side: normalizedSide,
        leverage: normalizedLeverage,
        margin: normalizedMargin,
        fee,
        totalCost,
        liquidated,
        position: evaluateLeveragedPosition(position, quote),
        profile: cloneMoneyProfile(profile)
      };
    });
  }

  async closeLeveragedPosition({ guildId, userId, username, positionId, now = Date.now() }) {
    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = syncMarket(guild, now, this);
      const profile = getOrCreateMoneyProfile(guild, userId, username, now);
      const stockUser = getOrCreateStockUser(guild, userId, username);
      const position = stockUser.leveragedPositions[positionId];

      if (!position) {
        throw new Error('해당 레버리지 포지션을 찾을 수 없습니다.');
      }

      const quote = cloneQuote(position.stockId, market.symbols[position.stockId]);
      const evaluated = evaluateLeveragedPosition(position, quote);
      delete stockUser.leveragedPositions[position.id];
      stockUser.leveragedTradeCount += 1;
      stockUser.lastTradeAt = now;

      if (evaluated.liquidated) {
        const realizedProfit = -position.margin;
        stockUser.realizedLeveragedProfit += realizedProfit;
        recordTrade(stockUser, {
          type: 'leverage_close',
          stockId: position.stockId,
          stock: quote,
          quantity: 0,
          price: quote.price,
          fee: 0,
          total: 0,
          realizedProfit,
          at: now,
          positionId: position.id,
          side: position.side,
          leverage: position.leverage,
          margin: position.margin
        });
        return {
          type: 'close_leverage',
          liquidated: true,
          position: evaluated,
          payout: 0,
          realizedProfit,
          profile: cloneMoneyProfile(profile),
          stockUser: cloneStockUser(stockUser)
        };
      }

      const payout = evaluated.equity;
      const realizedProfit = payout - position.margin;
      creditCurrency(profile, CURRENCY_STOCK, payout);
      stockUser.realizedLeveragedProfit += realizedProfit;
      recordTrade(stockUser, {
        type: 'leverage_close',
        stockId: position.stockId,
        stock: quote,
        quantity: 0,
        price: quote.price,
        fee: 0,
        total: payout,
        realizedProfit,
        at: now,
        positionId: position.id,
        side: position.side,
        leverage: position.leverage,
        margin: position.margin
      });

      return {
        type: 'close_leverage',
        liquidated: false,
        position: evaluated,
        payout,
        realizedProfit,
        profile: cloneMoneyProfile(profile),
        stockUser: cloneStockUser(stockUser)
      };
    });
  }

  async getLeveragePortfolio({ guildId, userId, username, now = Date.now() }) {
    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = syncMarket(guild, now, this);
      const profile = getOrCreateMoneyProfile(guild, userId, username, now);
      const stockUser = getOrCreateStockUser(guild, userId, username);
      const liquidated = liquidateLeveragedPositions(profile, stockUser, market);
      const positions = getEvaluatedLeveragedPositions(stockUser, market);
      const marginTotal = positions.reduce((sum, position) => sum + position.margin, 0);
      const equityTotal = positions.reduce((sum, position) => sum + position.equity, 0);
      const unrealizedProfit = positions.reduce((sum, position) => sum + position.unrealizedProfit, 0);

      return {
        userId: profile.userId,
        username: profile.username,
        cash: getCurrencyBalance(profile, CURRENCY_STOCK),
        positions,
        liquidated,
        marginTotal,
        equityTotal,
        unrealizedProfit,
        realizedLeveragedProfit: stockUser.realizedLeveragedProfit,
        leveragedTradeCount: stockUser.leveragedTradeCount
      };
    });
  }

  async getPortfolio({ guildId, userId, username, now = Date.now() }) {
    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = syncMarket(guild, now, this);
      const profile = getOrCreateMoneyProfile(guild, userId, username, now);
      const stockUser = getOrCreateStockUser(guild, userId, username);
      liquidateLeveragedPositions(profile, stockUser, market);
      return buildPortfolio(profile, stockUser, market);
    });
  }

  async getLeaderboard({ guildId, limit = 10, now = Date.now() }) {
    const safeLimit = Math.min(20, Math.max(1, Number(limit) || 10));

    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = syncMarket(guild, now, this);
      const userIds = new Set([
        ...Object.keys(guild.users ?? {}),
        ...Object.keys(guild.stocks?.users ?? {})
      ]);

      return [...userIds]
        .map((userId) => {
          const profile = getOrCreateMoneyProfile(
            guild,
            userId,
            guild.users?.[userId]?.username ?? guild.stocks?.users?.[userId]?.username ?? 'Unknown',
            now
          );
          const stockUser = getOrCreateStockUser(guild, userId, profile.username);
          liquidateLeveragedPositions(profile, stockUser, market);
          return buildPortfolio(profile, stockUser, market);
        })
        .filter((portfolio) => portfolio.cash > 0 || portfolio.positions.length > 0)
        .sort((a, b) => {
          if (b.totalAssets !== a.totalAssets) return b.totalAssets - a.totalAssets;
          if (b.stockValue !== a.stockValue) return b.stockValue - a.stockValue;
          return a.username.localeCompare(b.username, 'ko-KR');
        })
        .slice(0, safeLimit);
    });
  }
}

export function getStockCatalog() {
  return STOCK_DEFINITIONS.map((definition) => ({ ...definition, aliases: [...definition.aliases] }));
}

export function normalizeStockId(stockId) {
  const normalized = normalizeLookupKey(stockId);
  const matched = STOCK_LOOKUP.get(normalized);
  if (!matched) throw new Error('알 수 없는 가상주식 종목입니다. `/주식 전체시세`에서 종목명을 확인하세요.');
  return matched;
}

function normalizeStockIdForGuild(stockId, guild) {
  const normalized = normalizeLookupKey(stockId);
  const staticMatched = STOCK_LOOKUP.get(normalized);
  if (staticMatched) return staticMatched;

  for (const definition of getDynamicStockDefinitions(guild)) {
    const keys = [
      definition.id,
      definition.name,
      definition.symbol,
      ...(definition.aliases ?? [])
    ].map(normalizeLookupKey);
    if (keys.includes(normalized)) return definition.id;
  }

  throw new Error('알 수 없는 가상주식 종목입니다. `/주식 전체시세`에서 종목명을 확인하세요.');
}

export function getStockConfig(stockId) {
  return STOCKS_BY_ID[normalizeStockId(stockId)];
}

function stock(id, name, sector, risk, basePrice, volatilityBps, eventChance, aliases = [], symbol = null, options = {}) {
  const safeOptions = options && typeof options === 'object' ? options : {};
  return Object.freeze({
    id,
    name,
    symbol: symbol ?? createSymbol(id),
    sector,
    risk,
    basePrice,
    volatilityBps,
    eventChance,
    listedFromTick: normalizeNonNegativeInteger(safeOptions.listedFromTick),
    dynamic: Boolean(safeOptions.dynamic),
    aliases: Object.freeze(aliases)
  });
}

function normalizeDynamicStockDefinitions(definitions = {}) {
  const safeDefinitions = definitions && typeof definitions === 'object' ? definitions : {};
  const entries = [];

  for (const [stockId, definition] of Object.entries(safeDefinitions)) {
    try {
      const normalized = normalizeDynamicStockDefinition(definition, stockId);
      entries.push([normalized.id, normalized]);
    } catch {
      // Ignore invalid generated IPO definitions.
    }
  }

  return Object.fromEntries(entries);
}

function normalizeDynamicStockDefinition(definition = {}, fallbackId = null) {
  const safeDefinition = definition && typeof definition === 'object' ? definition : {};
  const id = String(safeDefinition.id ?? fallbackId ?? '').trim();
  const name = String(safeDefinition.name ?? '').trim();
  const rawSymbol = String(safeDefinition.symbol ?? '').trim();
  const sector = String(safeDefinition.sector ?? '밈').trim() || '밈';
  const risk = normalizeStockRisk(safeDefinition.risk);

  if (!id || !name) throw new Error('동적 상장 종목 정의가 불완전합니다.');

  return {
    id,
    name,
    symbol: normalizeDynamicStockSymbol(rawSymbol, { id, name, sector }),
    sector,
    risk,
    basePrice: normalizePositiveStoredInteger(safeDefinition.basePrice, 500),
    volatilityBps: normalizePositiveStoredInteger(safeDefinition.volatilityBps, 1_200),
    eventChance: clampInteger(normalizePositiveStoredInteger(safeDefinition.eventChance, 15), 1, 50),
    listedFromTick: normalizeNonNegativeInteger(safeDefinition.listedFromTick),
    dynamic: true,
    aliases: Array.isArray(safeDefinition.aliases)
      ? safeDefinition.aliases.map((alias) => String(alias).trim()).filter(Boolean)
      : []
  };
}

function getDynamicStockDefinitions(guild) {
  return Object.values(guild?.stocks?.dynamicDefinitions ?? {});
}

function getOrCreateGuild(data, guildId) {
  if (!guildId) throw new Error('서버에서만 사용할 수 있는 기능입니다.');
  data.guilds ??= {};
  data.guilds[guildId] ??= {};
  data.guilds[guildId].users ??= {};
  return data.guilds[guildId];
}

function getOrCreateMarket(guild, now) {
  guild.stocks ??= {};
  guild.stocks.users ??= {};
  guild.stocks.dynamicDefinitions = normalizeDynamicStockDefinitions(guild.stocks.dynamicDefinitions);
  guild.stocks.nextDynamicStockSeq = normalizeNonNegativeInteger(guild.stocks.nextDynamicStockSeq);
  guild.stocks.marketNews = normalizeMarketNews(guild.stocks.marketNews, guild);

  if (!guild.stocks.market) {
    guild.stocks.market = createInitialMarket(now);
  }

  guild.stocks.market.symbols ??= {};
  guild.stocks.market.lastTickAt = normalizeNonNegativeInteger(guild.stocks.market.lastTickAt);
  guild.stocks.market.tickIndex = normalizeNonNegativeInteger(guild.stocks.market.tickIndex);
  for (const definition of STOCK_DEFINITIONS) {
    const existingState = guild.stocks.market.symbols[definition.id];
    if (!existingState && definition.listedFromTick > guild.stocks.market.tickIndex) continue;
    guild.stocks.market.symbols[definition.id] = normalizeSymbolState(existingState, definition, now);
  }
  for (const definition of getDynamicStockDefinitions(guild)) {
    guild.stocks.market.symbols[definition.id] = normalizeSymbolState(
      guild.stocks.market.symbols[definition.id],
      definition,
      now
    );
  }
  return guild.stocks.market;
}

function createInitialMarket(now) {
  return {
    lastTickAt: normalizeNonNegativeInteger(now),
    tickIndex: 0,
    symbols: Object.fromEntries(
      STOCK_DEFINITIONS
        .filter((definition) => definition.listedFromTick <= 0)
        .map((definition) => [
          definition.id,
          createInitialSymbolState(definition, now)
        ])
    )
  };
}

function createInitialSymbolState(definition, now, eventType = null, listedAtTick = definition.listedFromTick) {
  const safeNow = normalizeNonNegativeInteger(now);
  return {
    price: definition.basePrice,
    previousPrice: definition.basePrice,
    changeBps: 0,
    news: definition.dynamic && eventType === 'ipo'
      ? `자동 신규상장: ${definition.name}이(가) 시장에 갑자기 등장했습니다`
      : eventType === 'ipo'
      ? `신규상장: ${definition.name} 상장 첫날, 디코 투자자들이 호가창을 새로고침합니다`
      : `${definition.name} 상장 첫날, 디코 투자자들이 밈 뉴스를 기다리는 중`,
    status: 'listed',
    eventType,
    listedAtTick,
    definition: definition.dynamic ? cloneStoredStockDefinition(definition) : null,
    updatedAt: safeNow,
    history: [
      {
        tickIndex: normalizeNonNegativeInteger(listedAtTick),
        price: definition.basePrice,
        at: safeNow
      }
    ]
  };
}

function normalizeSymbolState(state, definition, now) {
  const safeState = state && typeof state === 'object' ? state : {};
  const status = safeState.status === 'delisted' ? 'delisted' : 'listed';
  const price = status === 'delisted'
    ? 0
    : Math.max(MIN_STOCK_PRICE, normalizePositiveStoredInteger(safeState.price, definition.basePrice));
  const previousPrice = Math.max(MIN_STOCK_PRICE, normalizePositiveStoredInteger(safeState.previousPrice, price));

  return {
    price,
    previousPrice,
    changeBps: Number.isSafeInteger(Number(safeState.changeBps)) ? Number(safeState.changeBps) : calculateChangeBps(price, previousPrice),
    news: typeof safeState.news === 'string' && safeState.news.trim()
      ? safeState.news
      : `${definition.name} 시장 뉴스: 조용한 장세`,
    status,
    eventType: typeof safeState.eventType === 'string' ? safeState.eventType : null,
    listedAtTick: normalizeNonNegativeInteger(safeState.listedAtTick ?? definition.listedFromTick),
    delistedAtTick: normalizeNonNegativeInteger(safeState.delistedAtTick),
    definition: definition.dynamic ? cloneStoredStockDefinition(definition) : null,
    updatedAt: normalizeNonNegativeInteger(safeState.updatedAt) || normalizeNonNegativeInteger(now),
    history: normalizePriceHistory(safeState.history, {
      price,
      updatedAt: normalizeNonNegativeInteger(safeState.updatedAt) || normalizeNonNegativeInteger(now)
    }, normalizeNonNegativeInteger(safeState.listedAtTick ?? definition.listedFromTick), now)
  };
}

function syncMarket(guild, now, service) {
  const market = getOrCreateMarket(guild, now);
  advanceMarket(guild, market, now, service);
  return market;
}

function advanceMarket(guild, market, now, service) {
  const safeNow = normalizeNonNegativeInteger(now);
  const elapsed = safeNow - market.lastTickAt;
  if (elapsed < service.tickMs) return;

  const ticks = Math.min(MAX_CATCH_UP_TICKS, Math.floor(elapsed / service.tickMs));
  for (let index = 0; index < ticks; index += 1) {
    market.tickIndex += 1;
    market.lastTickAt += service.tickMs;
    for (const definition of getActiveStockDefinitions(guild, market)) {
      const state = market.symbols[definition.id];
      if (!state || state.status === 'delisted') continue;
      const advanced = advanceSymbol(definition, state, market.tickIndex, service.randomInt, market.lastTickAt);
      const nextState = advanced.state;
      market.symbols[definition.id] = nextState;
      if (advanced.marketNews) {
        recordMarketNews(guild, definition, advanced.marketNews, market.tickIndex, market.lastTickAt);
      }
    }
    listScheduledStocks(guild, market);
    maybeAutoListStock(guild, market, service);
    processMarketSideEffects(guild, market, service);
  }
}

function advanceSymbol(definition, state, tickIndex, randomIntFn, updatedAt) {
  if (state.status === 'delisted') return { state, marketNews: null };

  const previousPrice = state.price;
  const baseMoveBps = randomIntFn(-definition.volatilityBps, definition.volatilityBps);
  const eventRoll = randomIntFn(1, 100);
  const eventMoveBps = eventRoll <= definition.eventChance
    ? randomIntFn(-Math.floor(definition.volatilityBps * 1.4), Math.floor(definition.volatilityBps * 1.4))
    : 0;
  const totalMoveBps = clampInteger(baseMoveBps + eventMoveBps, -3000, 3000);
  const eventType = getMarketEventType(definition, totalMoveBps);
  const marketNews = createPreMarketNews(definition, eventMoveBps, tickIndex);

  if (eventType === 'delisted') {
    return {
      state: {
        price: 0,
        previousPrice,
        changeBps: -10_000,
        news: `시황: ${definition.name} 상장폐지 처리로 거래가 정지되고 보유 평가는 0골드가 됐습니다`,
        status: 'delisted',
        eventType,
        listedAtTick: normalizeNonNegativeInteger(state.listedAtTick ?? definition.listedFromTick),
        delistedAtTick: tickIndex,
        definition: definition.dynamic ? cloneStoredStockDefinition(definition) : null,
        updatedAt,
        history: appendPriceHistory(state.history, {
          tickIndex,
          price: 0,
          at: updatedAt
        })
      },
      marketNews
    };
  }

  const price = Math.max(MIN_STOCK_PRICE, Math.round(previousPrice * (10_000 + totalMoveBps) / 10_000));

  return {
    state: {
      price,
      previousPrice,
      changeBps: calculateChangeBps(price, previousPrice),
      news: createMarketSummary(definition, totalMoveBps, tickIndex, eventType),
      status: 'listed',
      eventType,
      listedAtTick: normalizeNonNegativeInteger(state.listedAtTick ?? definition.listedFromTick),
      delistedAtTick: 0,
      definition: definition.dynamic ? cloneStoredStockDefinition(definition) : null,
      updatedAt,
      history: appendPriceHistory(state.history, {
        tickIndex,
        price,
        at: updatedAt
      })
    },
    marketNews
  };
}

function listScheduledStocks(guild, market) {
  for (const definition of STOCK_DEFINITIONS) {
    if (market.symbols[definition.id]) continue;
    if (definition.listedFromTick > market.tickIndex) continue;
    market.symbols[definition.id] = createInitialSymbolState(
      definition,
      market.lastTickAt,
      definition.listedFromTick > 0 ? 'ipo' : null,
      market.tickIndex
    );
    if (definition.listedFromTick > 0) {
      recordMarketNews(guild, definition, createIpoMarketNews(definition, market.symbols[definition.id]), market.tickIndex, market.lastTickAt, market.tickIndex);
    }
  }
}

function maybeAutoListStock(guild, market, service) {
  if (!service.ipoRandomInt) return;
  if (market.tickIndex < AUTO_IPO_CHECK_TICKS || market.tickIndex % AUTO_IPO_CHECK_TICKS !== 0) return;
  if (getDynamicStockDefinitions(guild).length >= service.maxDynamicStocks) return;

  const chance = clampInteger(Number(service.autoIpoChanceBps) || 0, 0, 10_000);
  if (chance <= 0) return;

  const shouldGuaranteeFirstAutoIpo = getDynamicStockDefinitions(guild).length === 0;
  if (!shouldGuaranteeFirstAutoIpo) {
    const roll = service.ipoRandomInt(1, 10_000);
    if (roll > chance) return;
  }

  const definition = createAutomaticIpoDefinition(guild, market, service.ipoRandomInt);
  guild.stocks.dynamicDefinitions[definition.id] = definition;
  market.symbols[definition.id] = createInitialSymbolState(definition, market.lastTickAt, 'ipo', market.tickIndex);
  recordMarketNews(guild, definition, createIpoMarketNews(definition, market.symbols[definition.id]), market.tickIndex, market.lastTickAt, market.tickIndex);
}

function createAutomaticIpoDefinition(guild, market, randomIntFn) {
  const nextSequence = normalizeNonNegativeInteger(guild.stocks.nextDynamicStockSeq) + 1;
  guild.stocks.nextDynamicStockSeq = nextSequence;

  const prefix = AUTO_IPO_PREFIXES[randomIntFn(0, AUTO_IPO_PREFIXES.length - 1)];
  const theme = AUTO_IPO_THEMES[randomIntFn(0, AUTO_IPO_THEMES.length - 1)];
  const baseName = `${prefix}${theme.suffix}`;
  const existingNames = new Set([
    ...STOCK_DEFINITIONS.map((definition) => definition.name),
    ...getDynamicStockDefinitions(guild).map((definition) => definition.name)
  ]);
  const name = existingNames.has(baseName) ? `${baseName}${nextSequence}호` : baseName;
  const id = `auto_ipo_${market.tickIndex}_${nextSequence}`;
  const symbol = createAutomaticIpoSymbol(prefix, theme, nextSequence);

  return stock(
    id,
    name,
    theme.sector,
    theme.risk,
    randomIntFn(theme.basePriceMin, theme.basePriceMax),
    theme.volatilityBps,
    theme.eventChance,
    [`${prefix}${theme.sector}`, `${name}상장`],
    symbol,
    {
      listedFromTick: market.tickIndex,
      dynamic: true
    }
  );
}

function createAutomaticIpoSymbol(prefix, theme, sequence) {
  const prefixPart = AUTO_IPO_PREFIX_SYMBOLS[prefix] ?? createAsciiSymbolPart(prefix, 'IP', 2);
  const sectorPart = AUTO_IPO_SECTOR_SYMBOLS[theme.sector] ?? createAsciiSymbolPart(theme.sector, 'ST', 2);
  return `${prefixPart}${sectorPart}${formatSequenceSymbolPart(sequence)}`.slice(0, 6);
}

function normalizeDynamicStockSymbol(rawSymbol, definition) {
  const asciiSymbol = normalizeAsciiStockSymbol(rawSymbol);
  if (asciiSymbol && asciiSymbol === rawSymbol.toUpperCase()) return asciiSymbol;
  return createDynamicStockSymbol(definition);
}

function createDynamicStockSymbol({ id, name, sector }) {
  const prefix = AUTO_IPO_PREFIXES.find((candidate) => name.startsWith(candidate));
  const prefixPart = prefix
    ? AUTO_IPO_PREFIX_SYMBOLS[prefix]
    : createAsciiSymbolPart(name, 'IP', 2);
  const sectorPart = AUTO_IPO_SECTOR_SYMBOLS[sector] ?? createAsciiSymbolPart(sector, 'ST', 2);
  return `${prefixPart}${sectorPart}${formatSequenceSymbolPart(extractDynamicStockSequence(id, name))}`.slice(0, 6);
}

function normalizeAsciiStockSymbol(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);
}

function createAsciiSymbolPart(value, fallback, length) {
  const ascii = normalizeAsciiStockSymbol(value).replace(/^[0-9]+/, '');
  if (ascii.length >= length) return ascii.slice(0, length);
  return `${fallback}${createStableSymbolHash(value)}`.slice(0, length);
}

function createStableSymbolHash(value) {
  const source = String(value ?? '');
  let hash = 0;
  for (const char of source) {
    hash = (hash * 31 + char.codePointAt(0)) >>> 0;
  }
  return hash.toString(36).toUpperCase();
}

function extractDynamicStockSequence(id, name) {
  const idMatch = String(id ?? '').match(/_(\d+)$/);
  if (idMatch) return Number(idMatch[1]);
  const nameMatch = String(name ?? '').match(/(\d+)호?$/);
  if (nameMatch) return Number(nameMatch[1]);
  return 0;
}

function formatSequenceSymbolPart(sequence) {
  const safeSequence = normalizeNonNegativeInteger(sequence);
  return safeSequence > 0 ? safeSequence.toString(36).toUpperCase() : '';
}

function getActiveStockDefinitions(guild, market) {
  return [
    ...STOCK_DEFINITIONS.filter((definition) => market.symbols[definition.id]),
    ...getDynamicStockDefinitions(guild).filter((definition) => market.symbols[definition.id])
  ];
}

function cloneStoredStockDefinition(definition) {
  return {
    id: definition.id,
    name: definition.name,
    symbol: definition.symbol,
    sector: definition.sector,
    risk: definition.risk,
    basePrice: definition.basePrice,
    volatilityBps: definition.volatilityBps,
    eventChance: definition.eventChance,
    listedFromTick: definition.listedFromTick,
    dynamic: Boolean(definition.dynamic),
    aliases: [...(definition.aliases ?? [])]
  };
}

function getMarketEventType(definition, moveBps) {
  if (moveBps <= -2800 && ['meme', 'volatile'].includes(definition.risk)) return 'delisted';
  if (moveBps >= 1500) return 'surge';
  if (moveBps <= -1500) return 'crash';
  return null;
}

function createPreMarketNews(definition, impactBps, tickIndex) {
  if (impactBps === 0) return null;

  const riskThreshold = -Math.floor(definition.volatilityBps * 1.2);
  const type = impactBps <= riskThreshold && ['meme', 'volatile'].includes(definition.risk)
    ? 'risk'
    : impactBps > 0
      ? 'positive'
      : 'negative';
  const message = createPreMarketNewsMessage(definition, type, tickIndex);

  return {
    type,
    title: formatMarketNewsTitle(type),
    message,
    impactBps
  };
}

function createPreMarketNewsMessage(definition, type, tickIndex) {
  const typedTemplates = PRE_MARKET_NEWS_TEMPLATES[type] ?? PRE_MARKET_NEWS_TEMPLATES.negative;
  const templates = typedTemplates[definition.risk] ?? typedTemplates.stable ?? typedTemplates.meme ?? typedTemplates.volatile;
  const template = templates[tickIndex % templates.length];
  return template.replaceAll('{name}', definition.name);
}

function createIpoMarketNews(definition, state) {
  return {
    type: 'ipo',
    title: formatMarketNewsTitle('ipo'),
    message: state.news,
    impactBps: 0
  };
}

function createMarketSummary(definition, moveBps, tickIndex, eventType = null) {
  if (eventType === 'surge') {
    return `시황: ${definition.name}에 강한 매수세가 몰렸습니다`;
  }
  if (eventType === 'crash') {
    return `시황: ${definition.name} 매도 물량이 늘며 약세로 마감했습니다`;
  }
  if (moveBps >= 900) {
    return `시황: ${definition.name} 투자심리가 개선됐습니다`;
  }
  if (moveBps <= -900) {
    return `시황: ${definition.name} 경계 매물이 늘었습니다`;
  }

  const quietSummaries = [
    `시황: ${definition.name} 보합권에서 조용히 거래됐습니다`,
    `시황: ${definition.name} 투자자들이 다음 공시를 기다리고 있습니다`,
    `시황: ${definition.name} 거래 흐름이 안정적으로 유지됐습니다`
  ];
  return quietSummaries[tickIndex % quietSummaries.length];
}

function getOrCreateMoneyProfile(guild, userId, username, now) {
  guild.users ??= {};
  guild.users[userId] ??= {
    userId,
    username,
    level: 1,
    xp: 0,
    totalXp: 0,
    balance: 0,
    wallets: normalizeWallets(),
    lastMessageRewardAt: 0,
    lastDailyAt: 0,
    lastDailyDay: null,
    dailyStreak: 0,
    lastFirstMessageBonusDay: null,
    createdAt: now
  };

  const profile = guild.users[userId];
  profile.userId = userId;
  profile.username = username || profile.username || 'Unknown';
  profile.balance = normalizeNonNegativeInteger(profile.balance);
  migrateLegacyWalletsToGold(profile, { now });
  profile.wallets = normalizeWallets(profile.wallets);
  profile.level = normalizePositiveStoredInteger(profile.level, 1);
  profile.xp = normalizeNonNegativeInteger(profile.xp);
  profile.totalXp = normalizeNonNegativeInteger(profile.totalXp);
  profile.createdAt = normalizeNonNegativeInteger(profile.createdAt) || now;
  return profile;
}

function getOrCreateStockUser(guild, userId, username) {
  guild.stocks ??= { users: {} };
  guild.stocks.users ??= {};
  guild.stocks.users[userId] ??= {
    userId,
    username,
    holdings: {},
    limitOrders: {},
    priceAlerts: {},
    leveragedPositions: {},
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

  const stockUser = guild.stocks.users[userId];
  stockUser.userId = userId;
  stockUser.username = username || stockUser.username || 'Unknown';
  stockUser.holdings = normalizeHoldings(stockUser.holdings, guild);
  stockUser.limitOrders = normalizeLimitOrders(stockUser.limitOrders, guild);
  stockUser.priceAlerts = normalizePriceAlerts(stockUser.priceAlerts, guild);
  stockUser.leveragedPositions = normalizeLeveragedPositions(stockUser.leveragedPositions, guild);
  stockUser.tradeHistory = normalizeTradeHistory(stockUser.tradeHistory, guild);
  stockUser.realizedProfit = normalizeInteger(stockUser.realizedProfit);
  stockUser.realizedLeveragedProfit = normalizeInteger(stockUser.realizedLeveragedProfit);
  stockUser.tradeCount = normalizeNonNegativeInteger(stockUser.tradeCount);
  stockUser.leveragedTradeCount = normalizeNonNegativeInteger(stockUser.leveragedTradeCount);
  stockUser.nextOrderSeq = normalizeNonNegativeInteger(stockUser.nextOrderSeq);
  stockUser.nextAlertSeq = normalizeNonNegativeInteger(stockUser.nextAlertSeq);
  stockUser.nextPositionSeq = normalizeNonNegativeInteger(stockUser.nextPositionSeq);
  stockUser.nextTradeSeq = Math.max(
    normalizeNonNegativeInteger(stockUser.nextTradeSeq),
    stockUser.tradeHistory.reduce((max, entry) => Math.max(max, normalizeNonNegativeInteger(entry.sequence)), 0)
  );
  stockUser.lastTradeAt = normalizeNonNegativeInteger(stockUser.lastTradeAt);
  migrateLegacyStockLiabilitiesToGold(guild.users?.[userId], stockUser);
  return stockUser;
}

function migrateLegacyStockLiabilitiesToGold(profile, stockUser, now = Date.now()) {
  stockUser.currencyMigration = normalizeStockCurrencyMigration(stockUser.currencyMigration);
  if (stockUser.currencyMigration.unifiedGoldVersion >= UNIFIED_GOLD_STOCK_MIGRATION_VERSION) {
    return stockUser.currencyMigration;
  }
  if (!profile) return stockUser.currencyMigration;

  let convertedReservedCash = 0;
  let cancelledBuyOrders = 0;

  for (const order of Object.values(stockUser.limitOrders)) {
    if (order.status !== 'open' || order.side !== 'buy' || order.reservedCash <= 0) continue;

    const convertedGold = convertLegacyCurrencyAmountToGold(CURRENCY_STOCK, order.reservedCash);
    if (profile && convertedGold > 0) {
      creditCurrency(profile, CURRENCY_STOCK, convertedGold);
    }
    convertedReservedCash += convertedGold;
    cancelledBuyOrders += 1;
    order.reservedCash = 0;
    order.status = 'cancelled';
    order.cancelledAt = normalizeNonNegativeInteger(now);
    order.cancelReason = '통합 골드 정산';
  }

  let convertedLeveragedMargin = 0;
  let convertedLeveragedPositions = 0;

  for (const [positionId, position] of Object.entries(stockUser.leveragedPositions)) {
    const convertedMargin = convertLegacyCurrencyAmountToGold(CURRENCY_STOCK, position.margin);
    convertedLeveragedPositions += 1;
    convertedLeveragedMargin += convertedMargin;

    if (convertedMargin <= 0) {
      delete stockUser.leveragedPositions[positionId];
    } else {
      position.margin = convertedMargin;
    }
  }

  stockUser.currencyMigration = {
    ...stockUser.currencyMigration,
    unifiedGoldVersion: UNIFIED_GOLD_STOCK_MIGRATION_VERSION,
    unifiedGoldAt: stockUser.currencyMigration.unifiedGoldAt ?? now,
    convertedReservedCash,
    cancelledBuyOrders,
    convertedLeveragedMargin,
    convertedLeveragedPositions
  };

  return stockUser.currencyMigration;
}

function normalizeStockCurrencyMigration(value = {}) {
  const migration = value && typeof value === 'object' ? value : {};
  return {
    ...migration,
    unifiedGoldVersion: normalizeNonNegativeInteger(migration.unifiedGoldVersion),
    unifiedGoldAt: migration.unifiedGoldAt ?? null
  };
}

function normalizeHoldings(holdings = {}, guild = null) {
  const safeHoldings = holdings && typeof holdings === 'object' ? holdings : {};
  const entries = [];

  for (const [stockId, holding] of Object.entries(safeHoldings)) {
    try {
      const normalizedStockId = guild ? normalizeStockIdForGuild(stockId, guild) : normalizeStockId(stockId);
      const normalizedHolding = normalizeHolding(holding);
      if (normalizedHolding.quantity > 0) entries.push([normalizedStockId, normalizedHolding]);
    } catch {
      // Ignore invalid legacy stock ids.
    }
  }

  return Object.fromEntries(entries);
}

function normalizeHolding(holding = {}) {
  const safeHolding = holding && typeof holding === 'object' ? holding : {};
  return {
    quantity: normalizeNonNegativeInteger(safeHolding.quantity),
    averageCost: normalizeNonNegativeInteger(safeHolding.averageCost)
  };
}

function normalizeLimitOrders(orders = {}, guild = null) {
  const safeOrders = orders && typeof orders === 'object' ? orders : {};
  const entries = [];

  for (const [orderId, order] of Object.entries(safeOrders)) {
    try {
      const normalizedOrder = normalizeLimitOrder(order, orderId, guild);
      entries.push([normalizedOrder.id, normalizedOrder]);
    } catch {
      // Ignore invalid legacy orders.
    }
  }

  return Object.fromEntries(entries);
}

function normalizeLimitOrder(order = {}, fallbackId = null, guild = null) {
  const safeOrder = order && typeof order === 'object' ? order : {};
  const id = String(safeOrder.id ?? fallbackId ?? '').trim();
  if (!id) throw new Error('지정가 주문 id가 없습니다.');

  return {
    id,
    userId: String(safeOrder.userId ?? '').trim(),
    username: String(safeOrder.username ?? 'Unknown').trim() || 'Unknown',
    stockId: guild ? normalizeStockIdForGuild(safeOrder.stockId, guild) : normalizeStockId(safeOrder.stockId),
    side: normalizeLimitOrderSide(safeOrder.side),
    quantity: normalizePositiveStoredInteger(safeOrder.quantity, 1),
    limitPrice: normalizePositiveStoredInteger(safeOrder.limitPrice, 1),
    status: normalizeOrderStatus(safeOrder.status),
    createdAt: normalizeNonNegativeInteger(safeOrder.createdAt),
    filledAt: normalizeNonNegativeInteger(safeOrder.filledAt),
    cancelledAt: normalizeNonNegativeInteger(safeOrder.cancelledAt),
    fillPrice: normalizeNonNegativeInteger(safeOrder.fillPrice),
    fee: normalizeNonNegativeInteger(safeOrder.fee),
    reservedCash: normalizeNonNegativeInteger(safeOrder.reservedCash),
    reservedQuantity: normalizeNonNegativeInteger(safeOrder.reservedQuantity),
    averageCost: normalizeNonNegativeInteger(safeOrder.averageCost),
    realizedProfit: normalizeInteger(safeOrder.realizedProfit),
    cancelReason: typeof safeOrder.cancelReason === 'string' ? safeOrder.cancelReason : null
  };
}

function normalizePriceAlerts(alerts = {}, guild = null) {
  const safeAlerts = alerts && typeof alerts === 'object' ? alerts : {};
  const entries = [];

  for (const [alertId, alert] of Object.entries(safeAlerts)) {
    try {
      const normalizedAlert = normalizePriceAlert(alert, alertId, guild);
      entries.push([normalizedAlert.id, normalizedAlert]);
    } catch {
      // Ignore invalid legacy alerts.
    }
  }

  return Object.fromEntries(entries);
}

function normalizePriceAlert(alert = {}, fallbackId = null, guild = null) {
  const safeAlert = alert && typeof alert === 'object' ? alert : {};
  const id = String(safeAlert.id ?? fallbackId ?? '').trim();
  if (!id) throw new Error('가격 알림 id가 없습니다.');

  return {
    id,
    userId: String(safeAlert.userId ?? '').trim(),
    username: String(safeAlert.username ?? 'Unknown').trim() || 'Unknown',
    stockId: guild ? normalizeStockIdForGuild(safeAlert.stockId, guild) : normalizeStockId(safeAlert.stockId),
    condition: normalizeAlertCondition(safeAlert.condition),
    targetPrice: normalizePositiveStoredInteger(safeAlert.targetPrice, 1),
    status: normalizeAlertStatus(safeAlert.status),
    createdAt: normalizeNonNegativeInteger(safeAlert.createdAt),
    triggeredAt: normalizeNonNegativeInteger(safeAlert.triggeredAt),
    triggeredPrice: normalizeNonNegativeInteger(safeAlert.triggeredPrice),
    deletedAt: normalizeNonNegativeInteger(safeAlert.deletedAt)
  };
}

function normalizeLeveragedPositions(positions = {}, guild = null) {
  const safePositions = positions && typeof positions === 'object' ? positions : {};
  const entries = [];

  for (const [positionId, position] of Object.entries(safePositions)) {
    try {
      const normalizedPosition = normalizeLeveragedPosition(position, positionId, guild);
      entries.push([normalizedPosition.id, normalizedPosition]);
    } catch {
      // Ignore invalid legacy leveraged positions.
    }
  }

  return Object.fromEntries(entries);
}

function normalizeLeveragedPosition(position = {}, fallbackId, guild = null) {
  const safePosition = position && typeof position === 'object' ? position : {};
  const id = String(safePosition.id ?? fallbackId ?? '').trim();
  if (!id) throw new Error('레버리지 포지션 id가 없습니다.');

  return {
    id,
    stockId: guild ? normalizeStockIdForGuild(safePosition.stockId, guild) : normalizeStockId(safePosition.stockId),
    side: normalizeLeverageSide(safePosition.side),
    leverage: normalizeLeverage(safePosition.leverage),
    margin: normalizePositiveInteger(safePosition.margin, '증거금'),
    entryPrice: normalizePositiveStoredInteger(safePosition.entryPrice, 1),
    openedAt: normalizeNonNegativeInteger(safePosition.openedAt)
  };
}

function normalizeTradeHistory(history = [], guild = null) {
  const source = Array.isArray(history) ? history : [];
  return source
    .map((entry, index) => {
      try {
        return normalizeTradeHistoryEntry(entry, `tr_legacy_${index + 1}`, guild);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort(compareTimelineEntries)
    .slice(0, RECENT_TRADE_LIMIT);
}

function normalizeTradeHistoryEntry(entry = {}, fallbackId = null, guild = null) {
  const safeEntry = entry && typeof entry === 'object' ? entry : {};
  const id = String(safeEntry.id ?? fallbackId ?? '').trim();
  if (!id) throw new Error('거래내역 id가 없습니다.');

  return {
    id,
    sequence: normalizeNonNegativeInteger(safeEntry.sequence),
    type: normalizeTradeType(safeEntry.type),
    stockId: normalizeStoredStockId(safeEntry.stockId, guild),
    quantity: normalizeNonNegativeInteger(safeEntry.quantity),
    price: normalizeNonNegativeInteger(safeEntry.price),
    fee: normalizeNonNegativeInteger(safeEntry.fee),
    total: normalizeNonNegativeInteger(safeEntry.total),
    realizedProfit: normalizeInteger(safeEntry.realizedProfit),
    at: normalizeNonNegativeInteger(safeEntry.at),
    positionId: typeof safeEntry.positionId === 'string' ? safeEntry.positionId : null,
    side: typeof safeEntry.side === 'string' ? safeEntry.side : null,
    leverage: normalizeNonNegativeInteger(safeEntry.leverage),
    margin: normalizeNonNegativeInteger(safeEntry.margin)
  };
}

function normalizeTradeType(type) {
  const normalized = String(type ?? '').trim();
  return [
    'buy',
    'sell',
    'limit_buy_fill',
    'limit_sell_fill',
    'leverage_open',
    'leverage_close',
    'leverage_liquidation'
  ].includes(normalized)
    ? normalized
    : 'buy';
}

function normalizeMarketNews(news = [], guild = null) {
  const source = Array.isArray(news) ? news : [];
  return source
    .map((entry, index) => {
      try {
        return normalizeMarketNewsEntry(entry, `news_legacy_${index + 1}`, guild);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort(compareMarketNewsEntries)
    .slice(0, RECENT_NEWS_LIMIT);
}

function normalizeMarketNewsEntry(entry = {}, fallbackId = null, guild = null) {
  const safeEntry = entry && typeof entry === 'object' ? entry : {};
  const id = String(safeEntry.id ?? fallbackId ?? '').trim();
  if (!id) throw new Error('뉴스 id가 없습니다.');

  return {
    id,
    sequence: normalizeNonNegativeInteger(safeEntry.sequence),
    type: normalizeMarketNewsType(safeEntry.type),
    stockId: normalizeStoredStockId(safeEntry.stockId, guild),
    title: String(safeEntry.title ?? '').trim() || '시장 뉴스',
    message: stripMarketNewsTitlePrefix(safeEntry.message) || '시장 뉴스가 없습니다.',
    tickIndex: normalizeNonNegativeInteger(safeEntry.tickIndex),
    publishedTickIndex: normalizeNonNegativeInteger(safeEntry.publishedTickIndex ?? safeEntry.tickIndex),
    effectiveTickIndex: normalizeNonNegativeInteger(safeEntry.effectiveTickIndex ?? safeEntry.tickIndex),
    impactBps: normalizeInteger(safeEntry.impactBps),
    at: normalizeNonNegativeInteger(safeEntry.at)
  };
}

function normalizeMarketNewsType(type) {
  const normalized = String(type ?? '').trim();
  return ['ipo', 'positive', 'negative', 'risk', 'news'].includes(normalized) ? normalized : 'news';
}

function normalizePriceHistory(history = [], fallbackState = null, fallbackTickIndex = 0, fallbackAt = 0) {
  const source = Array.isArray(history) ? history : [];
  const points = source
    .map(normalizePriceHistoryPoint)
    .filter(Boolean)
    .sort(comparePriceHistoryPoints);

  if (points.length === 0 && fallbackState) {
    const fallbackPoint = normalizePriceHistoryPoint({
      tickIndex: fallbackTickIndex,
      price: fallbackState.price,
      at: fallbackState.updatedAt ?? fallbackAt
    });
    if (fallbackPoint) points.push(fallbackPoint);
  }

  return dedupePriceHistory(points).slice(-PRICE_HISTORY_LIMIT);
}

function appendPriceHistory(history = [], point) {
  const normalizedPoint = normalizePriceHistoryPoint(point);
  const points = normalizePriceHistory(history);
  if (!normalizedPoint) return points;
  return dedupePriceHistory([...points, normalizedPoint]).slice(-PRICE_HISTORY_LIMIT);
}

function normalizePriceHistoryPoint(point = {}) {
  const safePoint = point && typeof point === 'object' ? point : {};
  const price = normalizeNonNegativeInteger(safePoint.price);
  if (price <= 0 && safePoint.price !== 0) return null;
  return {
    tickIndex: normalizeNonNegativeInteger(safePoint.tickIndex),
    price,
    at: normalizeNonNegativeInteger(safePoint.at)
  };
}

function dedupePriceHistory(points) {
  const byTick = new Map();
  for (const point of points.sort(comparePriceHistoryPoints)) {
    byTick.set(point.tickIndex, point);
  }
  return [...byTick.values()].sort(comparePriceHistoryPoints);
}

function comparePriceHistoryPoints(a, b) {
  if (a.tickIndex !== b.tickIndex) return a.tickIndex - b.tickIndex;
  return a.at - b.at;
}

function normalizeStoredStockId(stockId, guild = null) {
  const rawStockId = String(stockId ?? '').trim();
  if (!rawStockId) throw new Error('주식 종목 id가 없습니다.');
  if (guild) return normalizeStockIdForGuild(rawStockId, guild);
  const staticMatched = STOCK_LOOKUP.get(normalizeLookupKey(rawStockId));
  return staticMatched ?? rawStockId;
}

function compareTimelineEntries(a, b) {
  if (b.at !== a.at) return b.at - a.at;
  if ((b.tickIndex ?? 0) !== (a.tickIndex ?? 0)) return (b.tickIndex ?? 0) - (a.tickIndex ?? 0);
  return (b.sequence ?? 0) - (a.sequence ?? 0);
}

function compareMarketNewsEntries(a, b) {
  if ((b.at ?? 0) !== (a.at ?? 0)) return (b.at ?? 0) - (a.at ?? 0);
  if ((b.tickIndex ?? 0) !== (a.tickIndex ?? 0)) return (b.tickIndex ?? 0) - (a.tickIndex ?? 0);
  return (a.sequence ?? 0) - (b.sequence ?? 0);
}

function recordTrade(stockUser, entry) {
  stockUser.tradeHistory = normalizeTradeHistory(stockUser.tradeHistory);
  const maxSequence = stockUser.tradeHistory.reduce((max, item) => Math.max(max, item.sequence), 0);
  const sequence = Math.max(normalizeNonNegativeInteger(stockUser.nextTradeSeq), maxSequence) + 1;
  stockUser.nextTradeSeq = sequence;
  const at = normalizeNonNegativeInteger(entry.at);
  const normalized = normalizeTradeHistoryEntry({
    id: createStockTradeId(at, sequence),
    sequence,
    ...entry,
    at
  });
  stockUser.tradeHistory = [normalized, ...stockUser.tradeHistory]
    .sort(compareTimelineEntries)
    .slice(0, RECENT_TRADE_LIMIT);
}

function recordMarketNews(guild, definition, news, effectiveTickIndex, at, publishedTickIndex = Math.max(0, effectiveTickIndex - 1)) {
  if (!news) return;
  const type = normalizeMarketNewsType(news.type);
  guild.stocks.marketNews = normalizeMarketNews(guild.stocks.marketNews, guild);
  const sequence = guild.stocks.marketNews.reduce((max, item) => Math.max(max, item.sequence), 0) + 1;
  const normalized = normalizeMarketNewsEntry({
    id: createMarketNewsId(effectiveTickIndex, definition.id),
    sequence,
    type,
    stockId: definition.id,
    title: news.title ?? formatMarketNewsTitle(type),
    message: stripMarketNewsTitlePrefix(news.message),
    tickIndex: effectiveTickIndex,
    publishedTickIndex,
    effectiveTickIndex,
    impactBps: news.impactBps,
    at
  }, null, guild);
  guild.stocks.marketNews = [
    normalized,
    ...guild.stocks.marketNews.filter((entry) => entry.id !== normalized.id)
  ]
    .sort(compareMarketNewsEntries)
    .slice(0, RECENT_NEWS_LIMIT);
}

function cloneTradeHistoryEntry(entry, market) {
  const stock = safeCloneQuote(entry.stockId, market) ?? stockSnapshot(entry.stockId);
  return {
    ...entry,
    stock
  };
}

function cloneMarketNewsEntry(entry, market) {
  const stock = safeCloneQuote(entry.stockId, market) ?? stockSnapshot(entry.stockId);
  return {
    ...entry,
    stock
  };
}

function formatMarketNewsTitle(type) {
  return {
    ipo: '신규상장 공시',
    positive: '시장 공시',
    negative: '시장 공시',
    risk: '시장 공시'
  }[type] ?? '시장 뉴스';
}

function stripMarketNewsTitlePrefix(message) {
  let text = String(message ?? '').trim();
  if (!text) return '';

  let previous;
  do {
    previous = text;
    text = text.replace(/^(시장 공시|신규상장 공시|시장 뉴스)\s*[:：]\s*/u, '').trim();
  } while (text !== previous);

  return text;
}

function buildPortfolio(profile, stockUser, market) {
  const positions = Object.entries(stockUser.holdings)
    .filter(([stockId]) => market.symbols[stockId])
    .map(([stockId, holding]) => {
      const quote = cloneQuote(stockId, market.symbols[stockId]);
      const marketValue = quote.price * holding.quantity;
      const costBasis = holding.averageCost * holding.quantity;
      return {
        stock: quote,
        stockId,
        quantity: holding.quantity,
        averageCost: holding.averageCost,
        marketValue,
        costBasis,
        unrealizedProfit: marketValue - costBasis
      };
    })
    .filter((position) => position.quantity > 0)
    .sort((a, b) => b.marketValue - a.marketValue);
  const stockValue = positions.reduce((sum, position) => sum + position.marketValue, 0);
  const costBasis = positions.reduce((sum, position) => sum + position.costBasis, 0);
  const leveragedPositions = getEvaluatedLeveragedPositions(stockUser, market);
  const leveragedEquity = leveragedPositions.reduce((sum, position) => sum + position.equity, 0);
  const leveragedUnrealizedProfit = leveragedPositions.reduce((sum, position) => sum + position.unrealizedProfit, 0);

  return {
    userId: profile.userId,
    username: profile.username,
    cash: getCurrencyBalance(profile, CURRENCY_STOCK),
    stockValue,
    leveragedEquity,
    totalAssets: getCurrencyBalance(profile, CURRENCY_STOCK) + stockValue + leveragedEquity,
    costBasis,
    unrealizedProfit: stockValue - costBasis,
    leveragedUnrealizedProfit,
    realizedProfit: stockUser.realizedProfit,
    realizedLeveragedProfit: stockUser.realizedLeveragedProfit,
    tradeCount: stockUser.tradeCount,
    positions,
    leveragedPositions
  };
}

function cloneMarket(market, limit = null) {
  const safeLimit = limit === null || limit === undefined
    ? null
    : Math.min(Object.keys(market.symbols).length, Math.max(1, Number(limit) || 12));
  const stocks = Object.keys(market.symbols)
    .map((stockId) => cloneQuote(stockId, market.symbols[stockId]))
    .sort((a, b) => Math.abs(b.changeBps) - Math.abs(a.changeBps));

  return {
    tickIndex: market.tickIndex,
    lastTickAt: market.lastTickAt,
    stocks: safeLimit ? stocks.slice(0, safeLimit) : stocks
  };
}

function cloneQuote(stockId, state) {
  const definition = STOCKS_BY_ID[stockId] ?? (state?.definition ? normalizeDynamicStockDefinition(state.definition, stockId) : null);
  if (!definition || !state) {
    const name = definition?.name ?? stockId;
    throw new Error(`${name}은(는) 아직 상장되지 않았습니다.`);
  }
  return {
    ...definition,
    aliases: [...definition.aliases],
    price: state.price,
    previousPrice: state.previousPrice,
    changeBps: state.changeBps,
    changePercent: Math.round((state.changeBps / 100) * 100) / 100,
    news: state.news,
    status: state.status,
    eventType: state.eventType,
    listedAtTick: state.listedAtTick,
    delistedAtTick: state.delistedAtTick,
    updatedAt: state.updatedAt
  };
}

function cloneMoneyProfile(profile) {
  return {
    userId: profile.userId,
    username: profile.username,
    balance: getCurrencyBalance(profile, CURRENCY_STOCK),
    wallets: cloneWallets(profile.wallets)
  };
}

function cloneStockUser(stockUser) {
  return {
    userId: stockUser.userId,
    username: stockUser.username,
    holdings: Object.fromEntries(Object.entries(stockUser.holdings).map(([stockId, holding]) => [stockId, cloneHolding(holding)])),
    limitOrders: structuredClone(stockUser.limitOrders),
    priceAlerts: structuredClone(stockUser.priceAlerts),
    leveragedPositions: structuredClone(stockUser.leveragedPositions),
    tradeHistory: structuredClone(stockUser.tradeHistory),
    realizedProfit: stockUser.realizedProfit,
    realizedLeveragedProfit: stockUser.realizedLeveragedProfit,
    tradeCount: stockUser.tradeCount,
    leveragedTradeCount: stockUser.leveragedTradeCount,
    nextOrderSeq: stockUser.nextOrderSeq,
    nextAlertSeq: stockUser.nextAlertSeq,
    nextPositionSeq: stockUser.nextPositionSeq,
    nextTradeSeq: stockUser.nextTradeSeq,
    lastTradeAt: stockUser.lastTradeAt,
    currencyMigration: structuredClone(stockUser.currencyMigration ?? null)
  };
}

function buildListingSummary(market) {
  const recent = Object.entries(market.symbols)
    .map(([stockId, state]) => cloneQuote(stockId, state))
    .filter((stock) => stock.eventType === 'ipo' && stock.status === 'listed')
    .sort((a, b) => b.listedAtTick - a.listedAtTick)
    .slice(0, 10);
  const upcoming = STOCK_DEFINITIONS
    .filter((definition) => !market.symbols[definition.id])
    .sort((a, b) => a.listedFromTick - b.listedFromTick)
    .slice(0, 10)
    .map((definition) => ({
      ...definition,
      aliases: [...definition.aliases],
      status: 'upcoming'
    }));

  return {
    tickIndex: market.tickIndex,
    recent,
    upcoming
  };
}

function buildLimitOrderSummary(stockUser, market) {
  const orders = Object.values(stockUser.limitOrders)
    .map((order) => cloneLimitOrder(order, market))
    .sort((a, b) => b.createdAt - a.createdAt);

  return {
    open: orders.filter((order) => order.status === 'open'),
    recent: orders
      .filter((order) => order.status !== 'open')
      .slice(0, RECENT_ORDER_LIMIT)
  };
}

function buildPriceAlertSummary(stockUser, market) {
  const alerts = Object.values(stockUser.priceAlerts)
    .filter((alert) => alert.status !== 'deleted')
    .map((alert) => clonePriceAlert(alert, market))
    .sort((a, b) => b.createdAt - a.createdAt);

  return {
    active: alerts.filter((alert) => alert.status === 'active'),
    triggered: alerts
      .filter((alert) => alert.status === 'triggered')
      .slice(0, RECENT_ALERT_LIMIT)
  };
}

function getTradableQuote(stockId, market) {
  const quote = cloneQuote(stockId, market.symbols[stockId]);
  if (quote.status === 'delisted') {
    throw new Error(`${quote.name}은(는) 상장폐지되어 신규 매수할 수 없습니다.`);
  }
  return quote;
}

function processMarketSideEffects(guild, market, service) {
  const users = guild.stocks?.users ?? {};
  for (const [userId, rawStockUser] of Object.entries(users)) {
    const username = rawStockUser?.username ?? guild.users?.[userId]?.username ?? 'Unknown';
    const profile = getOrCreateMoneyProfile(guild, userId, username, market.lastTickAt);
    const stockUser = getOrCreateStockUser(guild, userId, username);
    processLimitOrders(profile, stockUser, market, service);
    triggerPriceAlerts(stockUser, market);
  }
}

function processLimitOrders(profile, stockUser, market, service) {
  for (const order of Object.values(stockUser.limitOrders)) {
    if (order.status !== 'open') continue;
    const quote = safeCloneQuote(order.stockId, market);
    if (!quote) continue;

    if (quote.status === 'delisted') {
      cancelOpenLimitOrder(profile, stockUser, order, market.lastTickAt, '상장폐지');
      continue;
    }

    const shouldFill = order.side === 'buy'
      ? quote.price <= order.limitPrice
      : quote.price >= order.limitPrice;

    if (!shouldFill) continue;
    fillLimitOrder(profile, stockUser, order, quote, service, market.lastTickAt);
  }
}

function fillLimitOrder(profile, stockUser, order, quote, service, now) {
  const subtotal = quote.price * order.quantity;
  const fee = calculateFee(subtotal, service.feeBps);

  order.status = 'filled';
  order.filledAt = normalizeNonNegativeInteger(now);
  order.fillPrice = quote.price;
  order.fee = fee;

  if (order.side === 'buy') {
    const totalCost = subtotal + fee;
    const refund = Math.max(0, order.reservedCash - totalCost);
    if (refund > 0) creditCurrency(profile, CURRENCY_STOCK, refund);
    addHolding(stockUser, order.stockId, order.quantity, quote.price);
    order.reservedCash = 0;
    recordTrade(stockUser, {
      type: 'limit_buy_fill',
      stockId: order.stockId,
      stock: quote,
      quantity: order.quantity,
      price: quote.price,
      fee,
      total: totalCost,
      realizedProfit: 0,
      at: now
    });
  } else {
    const proceeds = subtotal - fee;
    const realizedProfit = proceeds - order.averageCost * order.quantity;
    creditCurrency(profile, CURRENCY_STOCK, proceeds);
    stockUser.realizedProfit += realizedProfit;
    order.realizedProfit = realizedProfit;
    order.reservedQuantity = 0;
    recordTrade(stockUser, {
      type: 'limit_sell_fill',
      stockId: order.stockId,
      stock: quote,
      quantity: order.quantity,
      price: quote.price,
      fee,
      total: proceeds,
      realizedProfit,
      at: now
    });
  }

  stockUser.tradeCount += 1;
  stockUser.lastTradeAt = normalizeNonNegativeInteger(now);
}

function cancelOpenLimitOrder(profile, stockUser, order, now, reason = '취소') {
  if (order.side === 'buy' && order.reservedCash > 0) {
    creditCurrency(profile, CURRENCY_STOCK, order.reservedCash);
    order.reservedCash = 0;
  }

  if (order.side === 'sell' && order.reservedQuantity > 0) {
    addHolding(stockUser, order.stockId, order.reservedQuantity, order.averageCost);
    order.reservedQuantity = 0;
  }

  order.status = 'cancelled';
  order.cancelledAt = normalizeNonNegativeInteger(now);
  order.cancelReason = reason;
}

function triggerPriceAlerts(stockUser, market) {
  for (const alert of Object.values(stockUser.priceAlerts)) {
    if (alert.status !== 'active') continue;
    const quote = safeCloneQuote(alert.stockId, market);
    if (!quote) continue;
    const triggered = alert.condition === 'above'
      ? quote.price >= alert.targetPrice
      : quote.price <= alert.targetPrice;
    if (!triggered) continue;

    alert.status = 'triggered';
    alert.triggeredAt = market.lastTickAt;
    alert.triggeredPrice = quote.price;
  }
}

function safeCloneQuote(stockId, market) {
  try {
    return cloneQuote(stockId, market.symbols[stockId]);
  } catch {
    return null;
  }
}

function cloneLimitOrder(order, market, fallbackQuote = null) {
  const quote = fallbackQuote ?? safeCloneQuote(order.stockId, market);
  const stock = quote ?? stockSnapshot(order.stockId);
  return {
    ...order,
    stock
  };
}

function clonePriceAlert(alert, market, fallbackQuote = null) {
  const quote = fallbackQuote ?? safeCloneQuote(alert.stockId, market);
  const stock = quote ?? stockSnapshot(alert.stockId);
  return {
    ...alert,
    stock
  };
}

function stockSnapshot(stockId) {
  const definition = STOCKS_BY_ID[stockId];
  if (!definition) return { id: stockId, name: stockId, symbol: stockId, sector: '알 수 없음', risk: 'stable', aliases: [] };
  return {
    ...definition,
    aliases: [...definition.aliases],
    status: 'upcoming'
  };
}

function addHolding(stockUser, stockId, quantity, price) {
  const holding = stockUser.holdings[stockId] ?? createEmptyHolding();
  const beforeQuantity = holding.quantity;
  const afterQuantity = beforeQuantity + quantity;
  const beforeCost = holding.averageCost * beforeQuantity;
  const afterCost = beforeCost + price * quantity;
  stockUser.holdings[stockId] = {
    quantity: afterQuantity,
    averageCost: Math.round(afterCost / afterQuantity)
  };
}

function removeHolding(stockUser, stockId, quantity) {
  const holding = stockUser.holdings[stockId];
  if (!holding || holding.quantity < quantity) {
    throw new Error('보유 주식 수량이 부족합니다.');
  }
  const remainingQuantity = holding.quantity - quantity;
  if (remainingQuantity <= 0) {
    delete stockUser.holdings[stockId];
    return;
  }
  stockUser.holdings[stockId] = {
    quantity: remainingQuantity,
    averageCost: holding.averageCost
  };
}

function getEvaluatedLeveragedPositions(stockUser, market) {
  return Object.values(stockUser.leveragedPositions)
    .map((position) => evaluateLeveragedPosition(
      position,
      cloneQuote(position.stockId, market.symbols[position.stockId])
    ))
    .filter((position) => !position.liquidated)
    .sort((a, b) => b.equity - a.equity);
}

function liquidateLeveragedPositions(profile, stockUser, market) {
  const liquidated = [];

  for (const position of Object.values(stockUser.leveragedPositions)) {
    const quote = cloneQuote(position.stockId, market.symbols[position.stockId]);
    const evaluated = evaluateLeveragedPosition(position, quote);
    if (!evaluated.liquidated) continue;

    delete stockUser.leveragedPositions[position.id];
    stockUser.realizedLeveragedProfit -= position.margin;
    stockUser.leveragedTradeCount += 1;
    stockUser.lastTradeAt = market.lastTickAt;
    recordTrade(stockUser, {
      type: 'leverage_liquidation',
      stockId: position.stockId,
      stock: quote,
      quantity: 0,
      price: quote.price,
      fee: 0,
      total: 0,
      realizedProfit: -position.margin,
      at: market.lastTickAt,
      positionId: position.id,
      side: position.side,
      leverage: position.leverage,
      margin: position.margin
    });
    liquidated.push({
      positionId: position.id,
      stock: quote,
      ...evaluated,
      realizedProfit: -position.margin,
      profile: cloneMoneyProfile(profile)
    });
  }

  return liquidated;
}

function evaluateLeveragedPosition(position, quote) {
  const priceChangeBps = calculateChangeBps(quote.price, position.entryPrice);
  const directionalChangeBps = position.side === 'short' ? -priceChangeBps : priceChangeBps;
  const leveragedChangeBps = directionalChangeBps * position.leverage;
  const rawProfit = Math.trunc(position.margin * leveragedChangeBps / 10_000);
  const unrealizedProfit = Math.max(-position.margin, rawProfit);
  const equity = Math.max(0, position.margin + unrealizedProfit);
  const liquidated = equity <= 0;

  return {
    ...position,
    stock: quote,
    currentPrice: quote.price,
    priceChangeBps,
    leveragedChangeBps,
    returnPercent: Math.round((leveragedChangeBps / 100) * 100) / 100,
    unrealizedProfit,
    equity,
    liquidated
  };
}

function createEmptyHolding() {
  return { quantity: 0, averageCost: 0 };
}

function cloneHolding(holding) {
  return {
    quantity: holding.quantity,
    averageCost: holding.averageCost
  };
}

function calculateFee(amount, feeBps) {
  if (amount <= 0 || feeBps <= 0) return 0;
  return Math.ceil(amount * feeBps / 10_000);
}

function calculateChangeBps(price, previousPrice) {
  if (previousPrice <= 0) return 0;
  return Math.round((price - previousPrice) * 10_000 / previousPrice);
}

function normalizePositiveInteger(value, label) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized <= 0) {
    throw new Error(`${label}은 1 이상의 정수여야 합니다.`);
  }
  return normalized;
}

function normalizeLeverage(value) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < 1 || normalized > 100) {
    throw new Error('레버리지 배율은 1~100 사이의 정수여야 합니다.');
  }
  return normalized;
}

function normalizeLeverageSide(side) {
  const normalized = String(side ?? 'long').trim().toLocaleLowerCase('ko-KR');
  if (['long', '롱', '매수', '상승'].includes(normalized)) return 'long';
  if (['short', '숏', '공매도', '하락'].includes(normalized)) return 'short';
  throw new Error('레버리지 방향은 롱 또는 숏이어야 합니다.');
}

function normalizeStockRisk(risk) {
  const normalized = String(risk ?? 'meme').trim().toLocaleLowerCase('ko-KR');
  if (['stable', 'growth', 'cyclical', 'volatile', 'meme'].includes(normalized)) return normalized;
  return 'meme';
}

function normalizeLimitOrderSide(side) {
  const normalized = String(side ?? 'buy').trim().toLocaleLowerCase('ko-KR');
  if (['buy', 'bid', '매수', '지정가매수'].includes(normalized)) return 'buy';
  if (['sell', 'ask', '매도', '지정가매도'].includes(normalized)) return 'sell';
  throw new Error('지정가 주문 방향은 매수 또는 매도여야 합니다.');
}

function normalizeOrderStatus(status) {
  const normalized = String(status ?? 'open').trim().toLocaleLowerCase('ko-KR');
  if (['open', 'filled', 'cancelled'].includes(normalized)) return normalized;
  return 'open';
}

function normalizeAlertCondition(condition) {
  const normalized = String(condition ?? 'above').trim().toLocaleLowerCase('ko-KR');
  if (['above', 'gte', 'up', '이상', '돌파', '상승'].includes(normalized)) return 'above';
  if (['below', 'lte', 'down', '이하', '하락'].includes(normalized)) return 'below';
  throw new Error('알림 조건은 이상 또는 이하로 선택하세요.');
}

function normalizeAlertStatus(status) {
  const normalized = String(status ?? 'active').trim().toLocaleLowerCase('ko-KR');
  if (['active', 'triggered', 'deleted'].includes(normalized)) return normalized;
  return 'active';
}

function normalizePositiveStoredInteger(value, fallback) {
  const normalized = Number(value);
  return Number.isSafeInteger(normalized) && normalized > 0 ? normalized : fallback;
}

function normalizeNonNegativeInteger(value) {
  const normalized = Number(value);
  return Number.isSafeInteger(normalized) && normalized >= 0 ? normalized : 0;
}

function normalizeInteger(value) {
  const normalized = Number(value);
  return Number.isSafeInteger(normalized) ? normalized : 0;
}

function clampInteger(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeLookupKey(value) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('ko-KR')
    .replace(/[\s_\-()]/g, '');
}

function createSymbol(id) {
  return id
    .split('_')
    .map((part) => part.slice(0, 2).toUpperCase())
    .join('')
    .slice(0, 6);
}

function createLeveragedPositionId(now, sequence) {
  return `${normalizeNonNegativeInteger(now).toString(36)}-${sequence.toString(36)}`;
}

function createStockOrderId(now, sequence) {
  return `ord-${normalizeNonNegativeInteger(now).toString(36)}-${sequence.toString(36)}`;
}

function createStockAlertId(now, sequence) {
  return `al-${normalizeNonNegativeInteger(now).toString(36)}-${sequence.toString(36)}`;
}

function createStockTradeId(now, sequence) {
  return `tr-${normalizeNonNegativeInteger(now).toString(36)}-${sequence.toString(36)}`;
}

function createMarketNewsId(tickIndex, stockId) {
  return `news-${normalizeNonNegativeInteger(tickIndex).toString(36)}-${normalizeLookupKey(stockId)}`;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
