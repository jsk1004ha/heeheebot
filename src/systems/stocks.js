const DEFAULT_TICK_MS = 30 * 60 * 1000;
const DEFAULT_FEE_BPS = 100;
const DEFAULT_LEVERAGE_FEE_BPS = 200;
const MAX_CATCH_UP_TICKS = 24;
const MIN_STOCK_PRICE = 10;

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
  stock('dohye_commerce', '도혜커머스', '커머스', 'growth', 680, 1100, 14),
  stock('seojeong_securities', '서정증권', '증권', 'stable', 640, 750, 10),
  stock('seojeong_trading', '서정물산', '물산', 'stable', 390, 800, 11),
  stock('seojeong_cloud', '서정클라우드', '클라우드', 'growth', 930, 1200, 15),
  stock('monkeynix', '원숭이닉스', '반도체', 'meme', 660, 1800, 25, ['원숭이하이닉스']),
  stock('monkey_electronics', '원숭이전자', '전자', 'meme', 590, 1700, 24),
  stock('monkey_bio', '원숭이바이오', '바이오', 'meme', 420, 1900, 26),
  stock('dohun_construction', '도훈건설', '건설', 'meme', 330, 1500, 22),
  stock('dohun_heavy', '도훈중공업', '중공업', 'cyclical', 410, 1050, 14),
  stock('dohun_steel', '도훈철강', '철강', 'meme', 290, 1650, 23)
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

const NEWS_TEMPLATES = Object.freeze({
  stable: Object.freeze([
    '{name} 시장 뉴스: 배당 기대감에 디코 투자자들이 조용히 매수 중',
    '{name} 실적 발표가 무난해서 채팅창이 평화롭습니다',
    '{name} 밈 지수는 낮지만 안정감은 높다는 소문'
  ]),
  growth: Object.freeze([
    '{name} 신사업 발표에 성장주단이 다시 모였습니다',
    '{name} 신제품 티저 공개, 채팅창에 로켓 이모지가 늘었습니다',
    '{name} 클라우드/AI 소문에 밈 투자자들이 술렁입니다'
  ]),
  cyclical: Object.freeze([
    '{name} 수주 소문에 경기민감주단이 바빠졌습니다',
    '{name} 원자재 가격 뉴스로 주가가 흔들립니다',
    '{name} 실적 전망이 갈려서 투자자들이 계산기를 꺼냈습니다'
  ]),
  volatile: Object.freeze([
    '{name} 임상/허가 소문에 급등락 경보가 켜졌습니다',
    '{name} 바이오 밈 뉴스로 채팅창이 과열됐습니다',
    '{name} 연구 발표를 앞두고 기대와 공포가 같이 올라옵니다'
  ]),
  meme: Object.freeze([
    '{name} 밈 게시글 폭주로 원숭이 투자자들이 난입했습니다',
    '{name} 대표가 이상한 발표를 해서 주가가 급등락합니다',
    '{name} 급등 소문에 디코방이 바나나 이모지로 도배됐습니다'
  ])
});

export class StockService {
  constructor(store, options = {}) {
    this.store = store;
    this.randomInt = options.randomInt ?? randomInt;
    this.tickMs = options.tickMs ?? DEFAULT_TICK_MS;
    this.feeBps = options.feeBps ?? DEFAULT_FEE_BPS;
    this.leverageFeeBps = options.leverageFeeBps ?? DEFAULT_LEVERAGE_FEE_BPS;
  }

  async getMarket({ guildId, now = Date.now(), limit = null } = {}) {
    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = getOrCreateMarket(guild, now);
      advanceMarket(market, now, this);
      return cloneMarket(market, limit);
    });
  }

  async getQuote({ guildId, stockId, now = Date.now() }) {
    const normalizedStockId = normalizeStockId(stockId);
    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = getOrCreateMarket(guild, now);
      advanceMarket(market, now, this);
      return cloneQuote(normalizedStockId, market.symbols[normalizedStockId]);
    });
  }

  async buyStock({ guildId, userId, username, stockId, quantity, now = Date.now() }) {
    const normalizedStockId = normalizeStockId(stockId);
    const normalizedQuantity = normalizePositiveInteger(quantity, '수량');

    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = getOrCreateMarket(guild, now);
      advanceMarket(market, now, this);
      const profile = getOrCreateMoneyProfile(guild, userId, username, now);
      const stockUser = getOrCreateStockUser(guild, userId, username);
      const quote = cloneQuote(normalizedStockId, market.symbols[normalizedStockId]);
      const subtotal = quote.price * normalizedQuantity;
      const fee = calculateFee(subtotal, this.feeBps);
      const totalCost = subtotal + fee;

      if (profile.balance < totalCost) {
        throw new Error(`잔액이 부족합니다. 필요 금액: ${totalCost.toLocaleString()}원`);
      }

      const holding = stockUser.holdings[normalizedStockId] ?? createEmptyHolding();
      const beforeQuantity = holding.quantity;
      const afterQuantity = beforeQuantity + normalizedQuantity;
      const beforeCost = holding.averageCost * beforeQuantity;
      const afterCost = beforeCost + subtotal;

      profile.balance -= totalCost;
      stockUser.tradeCount += 1;
      stockUser.lastTradeAt = now;
      stockUser.holdings[normalizedStockId] = {
        quantity: afterQuantity,
        averageCost: Math.round(afterCost / afterQuantity)
      };

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
    const normalizedStockId = normalizeStockId(stockId);
    const normalizedQuantity = normalizePositiveInteger(quantity, '수량');

    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = getOrCreateMarket(guild, now);
      advanceMarket(market, now, this);
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

      profile.balance += proceeds;
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
    const normalizedStockId = normalizeStockId(stockId);
    const normalizedSide = normalizeLeverageSide(side);
    const normalizedLeverage = normalizeLeverage(leverage);
    const normalizedMargin = normalizePositiveInteger(margin, '증거금');

    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = getOrCreateMarket(guild, now);
      advanceMarket(market, now, this);
      const profile = getOrCreateMoneyProfile(guild, userId, username, now);
      const stockUser = getOrCreateStockUser(guild, userId, username);
      const liquidated = liquidateLeveragedPositions(profile, stockUser, market);
      const quote = cloneQuote(normalizedStockId, market.symbols[normalizedStockId]);
      const fee = calculateFee(normalizedMargin, this.leverageFeeBps);
      const totalCost = normalizedMargin + fee;

      if (profile.balance < totalCost) {
        throw new Error(`잔액이 부족합니다. 필요 금액: ${totalCost.toLocaleString()}원`);
      }

      profile.balance -= totalCost;
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
      const market = getOrCreateMarket(guild, now);
      advanceMarket(market, now, this);
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
      profile.balance += payout;
      stockUser.realizedLeveragedProfit += realizedProfit;

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
      const market = getOrCreateMarket(guild, now);
      advanceMarket(market, now, this);
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
        cash: profile.balance,
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
      const market = getOrCreateMarket(guild, now);
      advanceMarket(market, now, this);
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
      const market = getOrCreateMarket(guild, now);
      advanceMarket(market, now, this);
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

export function getStockConfig(stockId) {
  return STOCKS_BY_ID[normalizeStockId(stockId)];
}

function stock(id, name, sector, risk, basePrice, volatilityBps, eventChance, aliases = []) {
  return Object.freeze({
    id,
    name,
    symbol: createSymbol(id),
    sector,
    risk,
    basePrice,
    volatilityBps,
    eventChance,
    aliases: Object.freeze(aliases)
  });
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

  if (!guild.stocks.market) {
    guild.stocks.market = createInitialMarket(now);
  }

  guild.stocks.market.symbols ??= {};
  for (const definition of STOCK_DEFINITIONS) {
    guild.stocks.market.symbols[definition.id] = normalizeSymbolState(
      guild.stocks.market.symbols[definition.id],
      definition,
      now
    );
  }

  guild.stocks.market.lastTickAt = normalizeNonNegativeInteger(guild.stocks.market.lastTickAt);
  guild.stocks.market.tickIndex = normalizeNonNegativeInteger(guild.stocks.market.tickIndex);
  return guild.stocks.market;
}

function createInitialMarket(now) {
  return {
    lastTickAt: normalizeNonNegativeInteger(now),
    tickIndex: 0,
    symbols: Object.fromEntries(
      STOCK_DEFINITIONS.map((definition) => [
        definition.id,
        createInitialSymbolState(definition, now)
      ])
    )
  };
}

function createInitialSymbolState(definition, now) {
  return {
    price: definition.basePrice,
    previousPrice: definition.basePrice,
    changeBps: 0,
    news: `${definition.name} 상장 첫날, 디코 투자자들이 밈 뉴스를 기다리는 중`,
    updatedAt: normalizeNonNegativeInteger(now)
  };
}

function normalizeSymbolState(state, definition, now) {
  const safeState = state && typeof state === 'object' ? state : {};
  const price = Math.max(MIN_STOCK_PRICE, normalizePositiveStoredInteger(safeState.price, definition.basePrice));
  const previousPrice = Math.max(MIN_STOCK_PRICE, normalizePositiveStoredInteger(safeState.previousPrice, price));

  return {
    price,
    previousPrice,
    changeBps: Number.isSafeInteger(Number(safeState.changeBps)) ? Number(safeState.changeBps) : calculateChangeBps(price, previousPrice),
    news: typeof safeState.news === 'string' && safeState.news.trim()
      ? safeState.news
      : `${definition.name} 시장 뉴스: 조용한 장세`,
    updatedAt: normalizeNonNegativeInteger(safeState.updatedAt) || normalizeNonNegativeInteger(now)
  };
}

function advanceMarket(market, now, service) {
  const safeNow = normalizeNonNegativeInteger(now);
  const elapsed = safeNow - market.lastTickAt;
  if (elapsed < service.tickMs) return;

  const ticks = Math.min(MAX_CATCH_UP_TICKS, Math.floor(elapsed / service.tickMs));
  for (let index = 0; index < ticks; index += 1) {
    market.tickIndex += 1;
    market.lastTickAt += service.tickMs;
    for (const definition of STOCK_DEFINITIONS) {
      market.symbols[definition.id] = advanceSymbol(definition, market.symbols[definition.id], market.tickIndex, service.randomInt, market.lastTickAt);
    }
  }
}

function advanceSymbol(definition, state, tickIndex, randomIntFn, updatedAt) {
  const previousPrice = state.price;
  const baseMoveBps = randomIntFn(-definition.volatilityBps, definition.volatilityBps);
  const eventRoll = randomIntFn(1, 100);
  const eventMoveBps = eventRoll <= definition.eventChance
    ? randomIntFn(-Math.floor(definition.volatilityBps * 1.4), Math.floor(definition.volatilityBps * 1.4))
    : 0;
  const totalMoveBps = clampInteger(baseMoveBps + eventMoveBps, -3000, 3000);
  const price = Math.max(MIN_STOCK_PRICE, Math.round(previousPrice * (10_000 + totalMoveBps) / 10_000));

  return {
    price,
    previousPrice,
    changeBps: calculateChangeBps(price, previousPrice),
    news: createNews(definition, totalMoveBps, tickIndex),
    updatedAt
  };
}

function createNews(definition, moveBps, tickIndex) {
  const templates = NEWS_TEMPLATES[definition.risk] ?? NEWS_TEMPLATES.stable;
  const template = templates[tickIndex % templates.length];
  const prefix = moveBps >= 900
    ? '급등 뉴스'
    : moveBps <= -900
      ? '급락 뉴스'
      : '시장 뉴스';

  return `${prefix}: ${template.replaceAll('{name}', definition.name)}`;
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
    leveragedPositions: {},
    realizedProfit: 0,
    realizedLeveragedProfit: 0,
    tradeCount: 0,
    leveragedTradeCount: 0,
    nextPositionSeq: 0,
    lastTradeAt: 0
  };

  const stockUser = guild.stocks.users[userId];
  stockUser.userId = userId;
  stockUser.username = username || stockUser.username || 'Unknown';
  stockUser.holdings = normalizeHoldings(stockUser.holdings);
  stockUser.leveragedPositions = normalizeLeveragedPositions(stockUser.leveragedPositions);
  stockUser.realizedProfit = normalizeInteger(stockUser.realizedProfit);
  stockUser.realizedLeveragedProfit = normalizeInteger(stockUser.realizedLeveragedProfit);
  stockUser.tradeCount = normalizeNonNegativeInteger(stockUser.tradeCount);
  stockUser.leveragedTradeCount = normalizeNonNegativeInteger(stockUser.leveragedTradeCount);
  stockUser.nextPositionSeq = normalizeNonNegativeInteger(stockUser.nextPositionSeq);
  stockUser.lastTradeAt = normalizeNonNegativeInteger(stockUser.lastTradeAt);
  return stockUser;
}

function normalizeHoldings(holdings = {}) {
  const safeHoldings = holdings && typeof holdings === 'object' ? holdings : {};
  const entries = [];

  for (const [stockId, holding] of Object.entries(safeHoldings)) {
    try {
      const normalizedStockId = normalizeStockId(stockId);
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

function normalizeLeveragedPositions(positions = {}) {
  const safePositions = positions && typeof positions === 'object' ? positions : {};
  const entries = [];

  for (const [positionId, position] of Object.entries(safePositions)) {
    try {
      const normalizedPosition = normalizeLeveragedPosition(position, positionId);
      entries.push([normalizedPosition.id, normalizedPosition]);
    } catch {
      // Ignore invalid legacy leveraged positions.
    }
  }

  return Object.fromEntries(entries);
}

function normalizeLeveragedPosition(position = {}, fallbackId) {
  const safePosition = position && typeof position === 'object' ? position : {};
  const id = String(safePosition.id ?? fallbackId ?? '').trim();
  if (!id) throw new Error('레버리지 포지션 id가 없습니다.');

  return {
    id,
    stockId: normalizeStockId(safePosition.stockId),
    side: normalizeLeverageSide(safePosition.side),
    leverage: normalizeLeverage(safePosition.leverage),
    margin: normalizePositiveInteger(safePosition.margin, '증거금'),
    entryPrice: normalizePositiveStoredInteger(safePosition.entryPrice, 1),
    openedAt: normalizeNonNegativeInteger(safePosition.openedAt)
  };
}

function buildPortfolio(profile, stockUser, market) {
  const positions = Object.entries(stockUser.holdings)
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
    cash: profile.balance,
    stockValue,
    leveragedEquity,
    totalAssets: profile.balance + stockValue + leveragedEquity,
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
    : Math.min(STOCK_DEFINITIONS.length, Math.max(1, Number(limit) || 12));
  const stocks = STOCK_DEFINITIONS
    .map((definition) => cloneQuote(definition.id, market.symbols[definition.id]))
    .sort((a, b) => Math.abs(b.changeBps) - Math.abs(a.changeBps));

  return {
    tickIndex: market.tickIndex,
    lastTickAt: market.lastTickAt,
    stocks: safeLimit ? stocks.slice(0, safeLimit) : stocks
  };
}

function cloneQuote(stockId, state) {
  const definition = STOCKS_BY_ID[stockId];
  return {
    ...definition,
    aliases: [...definition.aliases],
    price: state.price,
    previousPrice: state.previousPrice,
    changeBps: state.changeBps,
    changePercent: Math.round((state.changeBps / 100) * 100) / 100,
    news: state.news,
    updatedAt: state.updatedAt
  };
}

function cloneMoneyProfile(profile) {
  return {
    userId: profile.userId,
    username: profile.username,
    balance: profile.balance
  };
}

function cloneStockUser(stockUser) {
  return {
    userId: stockUser.userId,
    username: stockUser.username,
    holdings: Object.fromEntries(Object.entries(stockUser.holdings).map(([stockId, holding]) => [stockId, cloneHolding(holding)])),
    leveragedPositions: structuredClone(stockUser.leveragedPositions),
    realizedProfit: stockUser.realizedProfit,
    realizedLeveragedProfit: stockUser.realizedLeveragedProfit,
    tradeCount: stockUser.tradeCount,
    leveragedTradeCount: stockUser.leveragedTradeCount,
    nextPositionSeq: stockUser.nextPositionSeq,
    lastTradeAt: stockUser.lastTradeAt
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

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
