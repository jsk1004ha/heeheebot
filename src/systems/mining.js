import {
  CURRENCY_MAIN,
  creditCurrencyWithReceipt,
  debitCurrency,
  migrateLegacyWalletsToGold,
  normalizeWallets
} from './currencies.js';
import {
  getOrCreateLinkedAccountProfile,
  getOrCreateLinkedFeatureUserProfile
} from './accounts.js';

const MAX_PICKAXE_LEVEL = 100;
const ACTIVE_MINE_COOLDOWN_MS = 3_000;
const ACTIVE_CHAIN_WINDOW_MS = 2 * 60 * 1000;
const MAX_IDLE_REWARD_MS = 12 * 60 * 60 * 1000;
const IDLE_ORE_INTERVAL_MS = 10 * 60 * 1000;
const MINING_DISCOVERY_XP_SOURCE = '광산 도감 발견';
const DEFAULT_MARKET_TICK_MS = 3 * 60 * 1000;
const MAX_MARKET_CATCH_UP_TICKS = 24;
const ORE_PRICE_HISTORY_LIMIT = 48;
const MIN_ORE_PRICE = 1;
const ORE_PRICE_BANDS = Object.freeze({
  common: Object.freeze({ min: 1, max: 50 }),
  uncommon: Object.freeze({ min: 70, max: 250 }),
  rare: Object.freeze({ min: 350, max: 1_500 }),
  epic: Object.freeze({ min: 2_000, max: 12_000 }),
  legendary: Object.freeze({ min: 40_000, max: 300_000 }),
  hidden: Object.freeze({ min: 500_000, max: 5_000_000 })
});

const RARITIES = Object.freeze({
  common: Object.freeze({ label: '일반', weight: 6500, powerBonus: 0, volatilityBps: 350, eventChance: 7 }),
  uncommon: Object.freeze({ label: '고급', weight: 2300, powerBonus: 2, volatilityBps: 550, eventChance: 9 }),
  rare: Object.freeze({ label: '희귀', weight: 900, powerBonus: 5, volatilityBps: 850, eventChance: 12 }),
  epic: Object.freeze({ label: '영웅', weight: 220, powerBonus: 9, volatilityBps: 1200, eventChance: 15 }),
  legendary: Object.freeze({ label: '전설', weight: 45, powerBonus: 15, volatilityBps: 1600, eventChance: 18 }),
  hidden: Object.freeze({ label: '히든', weight: 0, powerBonus: 28, volatilityBps: 2200, eventChance: 24 })
});

const ORE_BLUEPRINTS = Object.freeze([
  ore('stone_fragment', '암석 조각', 'common', '암석', 18, 58, 10),
  ore('copper_ore', '구리광석', 'common', '금속', 22, 66, 24),
  ore('tin_ore', '주석광석', 'common', '금속', 20, 62, 20),
  ore('iron_ore', '철광석', 'common', '금속', 25, 70, 34),
  ore('coal_chunk', '석탄 덩어리', 'common', '연료', 15, 55, 16),
  ore('limestone', '석회석', 'common', '암석', 18, 60, 14),
  ore('claystone', '점토석', 'common', '점토', 15, 52, 10),
  ore('salt_crystal', '소금 결정', 'common', '결정', 22, 64, 28),
  ore('lead_ore', '납광석', 'common', '금속', 20, 63, 22),
  ore('zinc_ore', '아연광석', 'common', '금속', 23, 68, 26),
  ore('silica_ore', '규석', 'common', '결정', 24, 69, 30),
  ore('mica_sheet', '운모 조각', 'common', '결정', 25, 72, 36),
  ore('ochre_stone', '황토석', 'common', '토양', 15, 54, 18),
  ore('manganese_ore', '망간광석', 'common', '금속', 24, 71, 40),
  ore('basalt_core', '현무암 심', 'common', '암석', 18, 59, 20),

  ore('silver_ore', '은광석', 'uncommon', '귀금속', 30, 78, 90),
  ore('black_iron', '흑철광석', 'uncommon', '금속', 32, 80, 110),
  ore('cobalt_ore', '코발트광석', 'uncommon', '금속', 35, 82, 135),
  ore('dolomite', '백운석', 'uncommon', '암석', 28, 76, 80),
  ore('quartz_crystal', '석영 결정', 'uncommon', '결정', 34, 84, 115),
  ore('fluorite', '형석', 'uncommon', '결정', 36, 86, 145),
  ore('sulfur_crystal', '유황 결정', 'uncommon', '결정', 25, 75, 75),
  ore('magnetite', '자철석', 'uncommon', '금속', 33, 82, 120),
  ore('obsidian_shard', '흑요석 파편', 'uncommon', '유리질', 38, 88, 170),
  ore('moonstone_raw', '월장석 원석', 'uncommon', '보석', 36, 90, 210),

  ore('gold_ore', '금광석', 'rare', '귀금속', 42, 92, 420),
  ore('platinum_ore', '백금광석', 'rare', '귀금속', 44, 94, 620),
  ore('ruby_raw', '루비 원석', 'rare', '보석', 48, 96, 900),
  ore('sapphire_raw', '사파이어 원석', 'rare', '보석', 48, 96, 850),
  ore('emerald_raw', '에메랄드 원석', 'rare', '보석', 47, 95, 800),
  ore('amethyst_geode', '자수정 정동', 'rare', '보석', 43, 93, 520),
  ore('titanium_ore', '티타늄광석', 'rare', '금속', 45, 96, 700),
  ore('meteor_iron', '운석철', 'rare', '우주금속', 50, 98, 1_200),

  ore('mithril_ore', '미스릴광석', 'epic', '환상금속', 56, 100, 3_200),
  ore('orichalcum_ore', '오리하르콘', 'epic', '환상금속', 58, 100, 4_500),
  ore('starlight_crystal', '별빛 수정', 'epic', '결정', 60, 100, 6_000),
  ore('dragon_bloodstone', '용혈석', 'epic', '보석', 62, 100, 8_000),
  ore('sunstone_core', '태양석 핵', 'epic', '보석', 60, 100, 6_800),
  ore('moonpearl_vein', '달빛진주광', 'epic', '진주광', 59, 100, 5_500),
  ore('resonance_crystal', '공명 수정', 'epic', '결정', 61, 100, 7_500),

  ore('adamantite_ore', '아다만타이트', 'legendary', '신화금속', 68, 100, 100_000),
  ore('celestial_diamond', '천상 다이아몬드', 'legendary', '보석', 72, 100, 180_000),
  ore('void_opal', '공허 오팔', 'legendary', '보석', 70, 100, 160_000),
  ore('phoenix_emberstone', '불사조 잿불석', 'legendary', '불꽃광', 69, 100, 140_000),
  ore('worldroot_fossil', '세계수 화석광', 'legendary', '고대광', 70, 100, 220_000),

  ore('hidden_developer_gem', '개발자의 보석', 'hidden', '비밀', 80, 100, 1_000_000),
  ore('hidden_404_crystal', '404 수정', 'hidden', '오류', 80, 100, 1_500_000),
  ore('hidden_time_ore', '시공 광석', 'hidden', '시간', 82, 100, 2_500_000),
  ore('hidden_shadow_mithril', '그림자 미스릴', 'hidden', '그림자', 82, 100, 3_500_000),
  ore('hidden_dawn_core', '새벽의 핵석', 'hidden', '새벽', 85, 100, 5_000_000)
]);

const ORE_SPECIES = Object.freeze(Object.fromEntries(
  ORE_BLUEPRINTS.map((blueprint) => [blueprint.id, Object.freeze({
    label: blueprint.label,
    rarity: blueprint.rarity,
    vein: blueprint.vein,
    minQuality: blueprint.minQuality,
    maxQuality: blueprint.maxQuality,
    value: blueprint.value,
    priceMin: getOrePriceBand(blueprint.rarity).min,
    priceMax: getOrePriceBand(blueprint.rarity).max,
    hidden: blueprint.rarity === 'hidden',
    assetId: `ore_${blueprint.id}`,
    imagePath: `assets/mining/ores/${blueprint.rarity === 'hidden' ? 'hidden' : blueprint.rarity}/${blueprint.id}/icon.png`
  })])
));

function ore(id, label, rarity, vein, minQuality, maxQuality, value) {
  return { id, label, rarity, vein, minQuality, maxQuality, value };
}

export class MiningService {
  constructor(store, options = {}) {
    this.store = store;
    this.randomInt = options.randomInt ?? randomInt;
    this.economy = options.economy ?? null;
    this.marketTickMs = options.marketTickMs ?? DEFAULT_MARKET_TICK_MS;
    this.mineCooldownMs = options.mineCooldownMs ?? ACTIVE_MINE_COOLDOWN_MS;
  }

  async getProfile(guildId, userId, username = 'Unknown') {
    return this.store.update((data) => {
      const profile = getOrCreateMiningProfile(data, guildId, userId, username);
      return cloneMiningProfile(profile);
    });
  }

  async mineOre({ guildId, userId, username, now = Date.now(), ignoreCooldown = false } = {}) {
    const result = await this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = syncMiningMarket(guild, now, this);
      const profile = getOrCreateMiningProfile(data, guildId, userId, username);
      const cooldown = getMineCooldown(profile, now, this.mineCooldownMs);

      if (!ignoreCooldown && cooldown.remainingMs > 0) {
        return {
          cooldown: true,
          ...cooldown,
          profile: cloneMiningProfile(profile)
        };
      }

      updateMiningFocus(profile, now);
      const mineResult = rollMine(profile, this.randomInt, now);
      const quantity = rollMineQuantity(profile, this.randomInt);
      const mineUpdate = applyMine(profile, mineResult, quantity, now);
      const discoveryXpGained = mineUpdate.newDiscovery
        ? getOreDiscoveryXp(mineResult.ore)
        : 0;
      const quote = cloneOreQuote(mineResult.oreId, market.ores[mineResult.oreId]);

      return {
        cooldown: false,
        ...mineResult,
        ...mineUpdate,
        quantity,
        quote,
        estimatedValue: quote.price * quantity,
        focusBonusBps: getFocusBonusBps(profile),
        discoveryXpGained,
        profile: cloneMiningProfile(profile)
      };
    });

    if (result.cooldown) return result;
    return this.applyDiscoveryXpReward({ guildId, userId, username, now, result });
  }

  async enhancePickaxe({ guildId, userId, username, now = Date.now() }) {
    return this.store.update((data) => {
      const profile = getOrCreateMiningProfile(data, guildId, userId, username);
      const goldProfile = getOrCreateGoldProfile(data, guildId, userId, username);
      const beforeLevel = profile.pickaxe.level;

      if (beforeLevel >= MAX_PICKAXE_LEVEL) {
        return {
          capped: true,
          outcome: 'capped',
          beforeLevel,
          afterLevel: beforeLevel,
          cost: 0,
          profile: cloneMiningProfile(profile)
        };
      }

      const cost = getEnhancementCost(beforeLevel);
      const goldBalanceBefore = goldProfile.balance;
      debitCurrency(
        goldProfile,
        CURRENCY_MAIN,
        cost,
        `골드가 부족합니다. 필요: ${cost.toLocaleString()}골드, 보유: ${goldProfile.balance.toLocaleString()}골드`
      );

      profile.pickaxe.totalEnhancementAttempts += 1;
      profile.pickaxe.lastEnhancedAt = now;
      profile.pickaxe.highestLevel = Math.max(profile.pickaxe.highestLevel, profile.pickaxe.level);

      const table = getEnhancementTable(beforeLevel);
      const roll = this.randomInt(1, 10_000);
      const outcome = resolveEnhancementOutcome(roll, table);

      if (outcome === 'success') {
        profile.pickaxe.level = Math.min(MAX_PICKAXE_LEVEL, profile.pickaxe.level + 1);
        profile.pickaxe.highestLevel = Math.max(profile.pickaxe.highestLevel, profile.pickaxe.level);
      } else if (outcome === 'destroy') {
        profile.pickaxe.level = 1;
        profile.pickaxe.destroyedCount += 1;
      }

      return {
        capped: false,
        outcome,
        roll,
        table,
        beforeLevel,
        afterLevel: profile.pickaxe.level,
        cost,
        goldBalanceBefore,
        goldBalanceAfter: goldProfile.balance,
        profile: cloneMiningProfile(profile)
      };
    });
  }

  async toggleIdle({ guildId, userId, username, now = Date.now() }) {
    const result = await this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = syncMiningMarket(guild, now, this);
      const profile = getOrCreateMiningProfile(data, guildId, userId, username);

      if (!profile.idle.startedAt) {
        profile.idle.startedAt = now;
        return {
          action: 'started',
          startedAt: now,
          profile: cloneMiningProfile(profile)
        };
      }

      const startedAt = profile.idle.startedAt;
      const elapsedMs = Math.max(0, now - startedAt);
      const cappedElapsedMs = Math.min(elapsedMs, MAX_IDLE_REWARD_MS);
      const minutes = Math.floor(cappedElapsedMs / 60_000);
      const oreCount = Math.max(1, Math.floor(cappedElapsedMs / IDLE_ORE_INTERVAL_MS));
      const ores = [];
      const discoveries = [];
      let discoveryXpGained = 0;

      for (let index = 0; index < oreCount; index += 1) {
        const mineResult = rollMine(profile, this.randomInt, now);
        const quantity = 1;
        const mineUpdate = applyMine(profile, mineResult, quantity, now);
        const catchDiscoveryXp = mineUpdate.newDiscovery
          ? getOreDiscoveryXp(mineResult.ore)
          : 0;
        const quote = cloneOreQuote(mineResult.oreId, market.ores[mineResult.oreId]);
        const mineEntry = {
          ...mineResult,
          ...mineUpdate,
          quantity,
          quote,
          estimatedValue: quote.price * quantity,
          discoveryXpGained: catchDiscoveryXp
        };

        if (mineUpdate.newDiscovery) {
          discoveries.push(mineEntry);
          discoveryXpGained += catchDiscoveryXp;
        }

        ores.push(mineEntry);
      }

      profile.idle.startedAt = 0;
      profile.idle.lastClaimedAt = now;
      profile.idle.totalMinutes += minutes;

      return {
        action: 'claimed',
        startedAt,
        elapsedMs,
        cappedElapsedMs,
        minutes,
        oreCount,
        ores,
        discoveries,
        discoveryXpGained,
        profile: cloneMiningProfile(profile)
      };
    });

    return this.applyDiscoveryXpReward({ guildId, userId, username, now, result });
  }

  async applyDiscoveryXpReward({ guildId, userId, username, now, result }) {
    const xpGained = normalizeNonNegativeInteger(result.discoveryXpGained);
    if (xpGained <= 0 || typeof this.economy?.grantXp !== 'function') return result;

    try {
      const discoveryXpReward = await this.economy.grantXp({
        guildId,
        userId,
        username,
        xp: xpGained,
        source: MINING_DISCOVERY_XP_SOURCE,
        now
      });
      return { ...result, discoveryXpReward };
    } catch (error) {
      return { ...result, discoveryXpRewardError: error.message };
    }
  }

  async getMarket({ guildId, now = Date.now(), limit = null, includeHidden = false } = {}) {
    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = syncMiningMarket(guild, now, this);
      return cloneMiningMarket(market, { limit, includeHidden });
    });
  }

  async getSellPreview({ guildId, userId, username, now = Date.now(), limit = 10 } = {}) {
    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = syncMiningMarket(guild, now, this);
      const profile = getOrCreateMiningProfile(data, guildId, userId, username);
      const allEntries = getSellableEntries(profile, market);
      const entries = allEntries
        .sort((left, right) => right.totalValue - left.totalValue)
        .slice(0, Math.max(1, Math.min(25, Number(limit) || 10)));

      return {
        entries,
        totalQuantity: allEntries.reduce((sum, entry) => sum + entry.quantity, 0),
        totalValue: allEntries.reduce((sum, entry) => sum + entry.totalValue, 0),
        profile: cloneMiningProfile(profile)
      };
    });
  }

  async sellOre({ guildId, userId, username, oreId, quantity = 'all', now = Date.now() } = {}) {
    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = syncMiningMarket(guild, now, this);
      const profile = getOrCreateMiningProfile(data, guildId, userId, username);
      const goldProfile = getOrCreateGoldProfile(data, guildId, userId, username);
      const normalizedOreId = normalizeOreId(oreId);
      const available = profile.inventory[normalizedOreId] ?? 0;
      const sellQuantity = normalizeSellQuantity(quantity, available);
      if (sellQuantity <= 0) throw new Error(`${ORE_SPECIES[normalizedOreId].label}을(를) 보유하고 있지 않습니다.`);

      const quote = cloneOreQuote(normalizedOreId, market.ores[normalizedOreId]);
      const gross = quote.price * sellQuantity;
      profile.inventory[normalizedOreId] = available - sellQuantity;
      if (profile.inventory[normalizedOreId] <= 0) delete profile.inventory[normalizedOreId];
      recordSaleStats(profile, sellQuantity, gross);
      const receipt = creditCurrencyWithReceipt(goldProfile, CURRENCY_MAIN, gross);

      return {
        soldEntries: [{ oreId: normalizedOreId, ore: ORE_SPECIES[normalizedOreId], quantity: sellQuantity, quote, totalValue: gross }],
        totalQuantity: sellQuantity,
        gross,
        receipt,
        profile: cloneMiningProfile(profile)
      };
    });
  }

  async sellAllOres({ guildId, userId, username, now = Date.now() } = {}) {
    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = syncMiningMarket(guild, now, this);
      const profile = getOrCreateMiningProfile(data, guildId, userId, username);
      const goldProfile = getOrCreateGoldProfile(data, guildId, userId, username);
      const soldEntries = getSellableEntries(profile, market).filter((entry) => entry.quantity > 0);

      if (soldEntries.length <= 0) throw new Error('판매할 광석이 없습니다. 먼저 `/광산`으로 채굴해 주세요.');

      const totalQuantity = soldEntries.reduce((sum, entry) => sum + entry.quantity, 0);
      const gross = soldEntries.reduce((sum, entry) => sum + entry.totalValue, 0);
      for (const entry of soldEntries) delete profile.inventory[entry.oreId];
      recordSaleStats(profile, totalQuantity, gross);
      const receipt = creditCurrencyWithReceipt(goldProfile, CURRENCY_MAIN, gross);

      return { soldEntries, totalQuantity, gross, receipt, profile: cloneMiningProfile(profile) };
    });
  }
}

export function getOreOptions({ includeHidden = false, limit = 25 } = {}) {
  return Object.entries(ORE_SPECIES)
    .filter(([, item]) => includeHidden || !item.hidden)
    .slice(0, limit)
    .map(([value, item]) => ({ name: `${item.label} (${RARITIES[item.rarity].label})`, value }));
}

export function getOreConfig(oreId) {
  return ORE_SPECIES[normalizeOreId(oreId)];
}

export function getOreCatalog({ includeHidden = true } = {}) {
  return Object.entries(ORE_SPECIES)
    .filter(([, item]) => includeHidden || !item.hidden)
    .map(([id, item]) => ({ id, ...item }));
}

export function getMiningRarityLabel(rarity) {
  return RARITIES[rarity]?.label ?? rarity;
}

export function getOreDiscoveryXp(oreOrId) {
  const item = typeof oreOrId === 'string' ? getOreConfig(oreOrId) : oreOrId;
  return normalizeNonNegativeInteger(item?.value);
}

export function getMaxMiningIdleRewardMs() {
  return MAX_IDLE_REWARD_MS;
}

export function getMiningIdleOreIntervalMs() {
  return IDLE_ORE_INTERVAL_MS;
}

export function getActiveMineCooldownMs() {
  return ACTIVE_MINE_COOLDOWN_MS;
}

export function getMaxPickaxeLevel() {
  return MAX_PICKAXE_LEVEL;
}

export function getOreCount({ includeHidden = true } = {}) {
  return Object.values(ORE_SPECIES).filter((item) => includeHidden || !item.hidden).length;
}

export function normalizeOreId(oreId) {
  const normalized = String(oreId ?? '').trim().toLocaleLowerCase('ko-KR');
  const matched = Object.entries(ORE_SPECIES).find(([id, item]) =>
    id === normalized || item.label.toLocaleLowerCase('ko-KR') === normalized
  );
  if (!matched) throw new Error('알 수 없는 광석입니다.');
  return matched[0];
}

function getOrCreateMiningProfile(data, guildId, userId, username = 'Unknown') {
  const profile = getOrCreateLinkedFeatureUserProfile(data, {
    featureKey: 'mining',
    guildId,
    userId,
    username,
    now: Date.now(),
    createDefaultProfile: createDefaultMiningProfile
  });
  profile.userId = userId;
  profile.username = username || profile.username || 'Unknown';
  profile.pickaxe = normalizePickaxe(profile.pickaxe);
  profile.inventory = normalizeInventory(profile.inventory);
  profile.bestOre = normalizeBestOre(profile.bestOre);
  profile.collection = normalizeCollection(profile.collection);
  profile.idle = normalizeIdle(profile.idle);
  profile.focus = normalizeFocus(profile.focus);
  profile.stats = normalizeStats(profile.stats);
  profile.createdAt = normalizeNonNegativeInteger(profile.createdAt) || Date.now();
  mirrorMiningProfileToGuild(data, guildId, userId, profile);
  return profile;
}

function mirrorMiningProfileToGuild(data, guildId, userId, profile) {
  const guild = getOrCreateGuild(data, guildId);
  guild.mining ??= { users: {} };
  guild.mining.users ??= {};
  guild.mining.linkedUsers ??= {};
  guild.mining.users[userId] = profile;
  guild.mining.linkedUsers[userId] = true;
}

function getOrCreateGuild(data, guildId) {
  data.guilds ??= {};
  data.guilds[guildId] ??= {};
  return data.guilds[guildId];
}

function getOrCreateGoldProfile(data, guildId, userId, username = 'Unknown') {
  const now = Date.now();
  const profile = getOrCreateLinkedAccountProfile(data, { guildId, userId, username, now, createDefaultProfile: createDefaultGoldProfile });
  profile.userId = String(userId ?? '').trim();
  profile.username = username || profile.username || 'Unknown';
  profile.balance = normalizeNonNegativeInteger(profile.balance);
  profile.wallets = normalizeWallets(profile.wallets);
  migrateLegacyWalletsToGold(profile, { now });
  return profile;
}

function createDefaultGoldProfile(userId, username, now = Date.now()) {
  return { userId, username, level: 1, xp: 0, totalXp: 0, balance: 0, wallets: normalizeWallets(), createdAt: now };
}

function createDefaultMiningProfile(userId, username, now = Date.now()) {
  return {
    userId,
    username,
    pickaxe: { level: 1, highestLevel: 1, destroyedCount: 0, totalEnhancementAttempts: 0, lastEnhancedAt: 0 },
    inventory: {},
    bestOre: {},
    collection: {},
    idle: { startedAt: 0, lastClaimedAt: 0, totalMinutes: 0 },
    focus: { streak: 0, bestStreak: 0, lastMinedAt: 0 },
    stats: { totalMines: 0, totalOrePieces: 0, totalSold: 0, totalSalesValue: 0 },
    createdAt: now
  };
}

function getMineCooldown(profile, now, cooldownMs) {
  const lastMinedAt = normalizeNonNegativeInteger(profile.focus?.lastMinedAt);
  if (lastMinedAt <= 0) return { remainingMs: 0, nextMineAt: now };
  const nextMineAt = lastMinedAt + cooldownMs;
  const remainingMs = Math.max(0, nextMineAt - now);
  return { remainingMs, nextMineAt };
}

function updateMiningFocus(profile, now) {
  const lastMinedAt = normalizeNonNegativeInteger(profile.focus.lastMinedAt);
  const keepsChain = lastMinedAt > 0 && now - lastMinedAt <= ACTIVE_CHAIN_WINDOW_MS;
  profile.focus.streak = keepsChain ? profile.focus.streak + 1 : 1;
  profile.focus.bestStreak = Math.max(profile.focus.bestStreak, profile.focus.streak);
  profile.focus.lastMinedAt = now;
}

function getFocusBonusBps(profile) {
  const streak = normalizeNonNegativeInteger(profile.focus?.streak);
  return Math.min(5000, Math.floor(streak / 10) * 500);
}

function rollMine(profile, randomIntFn, now) {
  const rarity = rollRarity(profile, randomIntFn);
  const candidates = Object.entries(ORE_SPECIES).filter(([, item]) => item.rarity === rarity);
  const [oreId, item] = candidates[randomIntFn(0, candidates.length - 1)];
  const qualityBonus = Math.floor(profile.pickaxe.level / 10) + Math.floor(getFocusBonusBps(profile) / 1000);
  const quality = Math.min(item.maxQuality, randomIntFn(item.minQuality, item.maxQuality) + qualityBonus);
  return { oreId, ore: item, rarity, quality, minedAt: now };
}

function rollMineQuantity(profile, randomIntFn) {
  const streak = normalizeNonNegativeInteger(profile.focus?.streak);
  const base = 1 + Math.floor(streak / 30) + Math.floor(profile.pickaxe.level / 60);
  const bonusChanceBps = Math.min(3500, Math.floor(streak / 5) * 250 + profile.pickaxe.level * 15);
  const bonus = randomIntFn(1, 10_000) <= bonusChanceBps ? 1 : 0;
  return Math.min(5, base + bonus);
}

function applyMine(profile, mineResult, quantity, now) {
  const { oreId, quality } = mineResult;
  const newDiscovery = !isOreRegisteredInCollection(profile, oreId);
  profile.inventory[oreId] = (profile.inventory[oreId] ?? 0) + quantity;
  if (newDiscovery) profile.collection[oreId] = now;
  profile.stats.totalMines += 1;
  profile.stats.totalOrePieces += quantity;
  if (!profile.bestOre[oreId] || profile.bestOre[oreId].quality < quality) {
    profile.bestOre[oreId] = { quality, minedAt: now };
  }
  return { newDiscovery };
}

function isOreRegisteredInCollection(profile, oreId) {
  return normalizeNonNegativeInteger(profile.collection?.[oreId]) > 0;
}

function rollRarity(profile, randomIntFn) {
  const level = clampInteger(profile.pickaxe.level, 1, MAX_PICKAXE_LEVEL);
  const focusStep = Math.floor(getFocusBonusBps(profile) / 500);
  const weights = {
    common: Math.max(1400, RARITIES.common.weight - level * 45 - focusStep * 80),
    uncommon: RARITIES.uncommon.weight + level * 20 + focusStep * 35,
    rare: RARITIES.rare.weight + level * 17 + focusStep * 25,
    epic: RARITIES.epic.weight + level * 10 + focusStep * 12,
    legendary: RARITIES.legendary.weight + level * 5 + focusStep * 7,
    hidden: getHiddenOreWeight(profile)
  };
  const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  let roll = randomIntFn(1, total);
  for (const [rarity, weight] of Object.entries(weights)) {
    if (roll <= weight) return rarity;
    roll -= weight;
  }
  return 'common';
}

function getHiddenOreWeight(profile) {
  const level = clampInteger(profile.pickaxe.level, 1, MAX_PICKAXE_LEVEL);
  const mines = normalizeNonNegativeInteger(profile.stats?.totalMines);
  const streak = normalizeNonNegativeInteger(profile.focus?.streak);
  if (level < 80 || mines < 500 || streak < 50) return 0;
  return Math.min(6, 1 + Math.floor((level - 80) / 12) + Math.floor(mines / 2500) + Math.floor(streak / 150));
}

function getEnhancementCost(level) {
  if (level <= 10) return level * 40;
  if (level <= 25) return level * 100;
  if (level <= 50) return level * 220;
  if (level <= 75) return level * 430;
  return level * 800;
}

function getEnhancementTable(level) {
  if (level <= 10) return { success: 8500, maintain: 1500, destroy: 0 };
  if (level <= 30) return { success: 7000, maintain: 2500, destroy: 500 };
  if (level <= 60) return { success: 5000, maintain: 4000, destroy: 1000 };
  if (level <= 85) return { success: 3500, maintain: 4500, destroy: 2000 };
  return { success: 2200, maintain: 5000, destroy: 2800 };
}

function resolveEnhancementOutcome(roll, table) {
  if (roll <= table.success) return 'success';
  if (roll <= table.success + table.maintain) return 'maintain';
  return 'destroy';
}

function getOrCreateMiningMarket(guild, now) {
  guild.mining ??= { users: {} };
  guild.mining.market ??= createInitialMiningMarket(now);
  const market = guild.mining.market;
  market.lastTickAt = normalizeNonNegativeInteger(market.lastTickAt) || normalizeNonNegativeInteger(now);
  market.tickIndex = normalizeNonNegativeInteger(market.tickIndex);
  market.ores ??= {};
  for (const [oreId, item] of Object.entries(ORE_SPECIES)) {
    market.ores[oreId] = normalizeOreMarketState(market.ores[oreId], item, now);
  }
  return market;
}

function createInitialMiningMarket(now) {
  return {
    lastTickAt: normalizeNonNegativeInteger(now),
    tickIndex: 0,
    ores: Object.fromEntries(Object.entries(ORE_SPECIES).map(([oreId, item]) => [oreId, createInitialOreMarketState(item, now)]))
  };
}

function createInitialOreMarketState(item, now) {
  const safeNow = normalizeNonNegativeInteger(now);
  const price = clampOrePrice(item, item.value);
  return { price, previousPrice: price, changeBps: 0, eventType: 'listed', updatedAt: safeNow, history: [{ tickIndex: 0, price, at: safeNow }] };
}

function syncMiningMarket(guild, now, service) {
  const market = getOrCreateMiningMarket(guild, now);
  advanceMiningMarket(market, now, service);
  return market;
}

function advanceMiningMarket(market, now, service) {
  const safeNow = normalizeNonNegativeInteger(now);
  const elapsed = safeNow - market.lastTickAt;
  if (elapsed < service.marketTickMs) return;
  const ticks = Math.min(MAX_MARKET_CATCH_UP_TICKS, Math.floor(elapsed / service.marketTickMs));
  for (let index = 0; index < ticks; index += 1) {
    market.tickIndex += 1;
    market.lastTickAt += service.marketTickMs;
    for (const [oreId, item] of Object.entries(ORE_SPECIES)) {
      market.ores[oreId] = advanceOrePrice(item, market.ores[oreId], market.tickIndex, market.lastTickAt, service.randomInt);
    }
  }
}

function advanceOrePrice(item, state, tickIndex, updatedAt, randomIntFn) {
  const rarityConfig = RARITIES[item.rarity];
  const previousPrice = clampOrePrice(item, normalizeNonNegativeInteger(state?.price) || item.value);
  const baseMoveBps = randomIntFn(-rarityConfig.volatilityBps, rarityConfig.volatilityBps);
  const eventRoll = randomIntFn(1, 100);
  const eventMoveBps = eventRoll <= rarityConfig.eventChance
    ? randomIntFn(-Math.floor(rarityConfig.volatilityBps * 1.6), Math.floor(rarityConfig.volatilityBps * 1.6))
    : 0;
  const totalMoveBps = clampInteger(baseMoveBps + eventMoveBps, -3500, 3500);
  const price = clampOrePrice(item, Math.round(previousPrice * (10_000 + totalMoveBps) / 10_000));
  return {
    price,
    previousPrice,
    changeBps: calculateChangeBps(price, previousPrice),
    eventType: getMarketEventType(totalMoveBps),
    updatedAt,
    history: appendPriceHistory(state?.history, { tickIndex, price, at: updatedAt })
  };
}

function getMarketEventType(moveBps) {
  if (moveBps >= 1200) return 'surge';
  if (moveBps <= -1200) return 'crash';
  if (moveBps > 0) return 'up';
  if (moveBps < 0) return 'down';
  return 'flat';
}

function calculateChangeBps(price, previousPrice) {
  const previous = normalizeNonNegativeInteger(previousPrice);
  if (previous <= 0) return 0;
  return Math.round(((normalizeNonNegativeInteger(price) - previous) / previous) * 10_000);
}

function getOrePriceBand(rarity) {
  return ORE_PRICE_BANDS[rarity] ?? Object.freeze({ min: MIN_ORE_PRICE, max: Number.MAX_SAFE_INTEGER });
}

function clampOrePrice(itemOrRarity, value) {
  const rarity = typeof itemOrRarity === 'string' ? itemOrRarity : itemOrRarity?.rarity;
  const band = getOrePriceBand(rarity);
  return clampInteger(normalizeNonNegativeInteger(value), band.min, band.max);
}

function normalizeOreMarketState(state, item, now) {
  const safe = state && typeof state === 'object' ? state : {};
  const price = clampOrePrice(item, normalizeNonNegativeInteger(safe.price) || item.value);
  const previousPrice = clampOrePrice(item, normalizeNonNegativeInteger(safe.previousPrice) || price);
  const updatedAt = normalizeNonNegativeInteger(safe.updatedAt) || normalizeNonNegativeInteger(now);
  return {
    price,
    previousPrice,
    changeBps: Number.isSafeInteger(Number(safe.changeBps)) ? Number(safe.changeBps) : calculateChangeBps(price, previousPrice),
    eventType: typeof safe.eventType === 'string' ? safe.eventType : 'flat',
    updatedAt,
    history: normalizePriceHistory(safe.history, { price, updatedAt }, 0, now)
  };
}

function cloneMiningMarket(market, { limit = null, includeHidden = false } = {}) {
  const quotes = Object.entries(market.ores ?? {})
    .map(([oreId, state]) => cloneOreQuote(oreId, state))
    .filter((quote) => includeHidden || !quote.hidden)
    .sort((left, right) => Math.abs(right.changeBps) - Math.abs(left.changeBps));
  const safeLimit = limit === null || limit === undefined ? null : Math.max(1, Number(limit) || 1);
  return { tickIndex: market.tickIndex, lastTickAt: market.lastTickAt, ores: safeLimit ? quotes.slice(0, safeLimit) : quotes };
}

function cloneOreQuote(oreId, state) {
  const item = ORE_SPECIES[oreId];
  if (!item || !state) throw new Error('광석 시세를 찾을 수 없습니다.');
  return {
    id: oreId,
    ...item,
    price: state.price,
    previousPrice: state.previousPrice,
    changeBps: state.changeBps,
    changePercent: Math.round((state.changeBps / 100) * 100) / 100,
    eventType: state.eventType,
    updatedAt: state.updatedAt,
    history: normalizePriceHistory(state.history)
  };
}

function getSellableEntries(profile, market) {
  return Object.entries(profile.inventory ?? {})
    .map(([oreId, quantity]) => {
      const item = ORE_SPECIES[oreId];
      if (!item) return null;
      const normalizedQuantity = normalizeNonNegativeInteger(quantity);
      const quote = cloneOreQuote(oreId, market.ores[oreId]);
      return { oreId, ore: item, quantity: normalizedQuantity, quote, totalValue: quote.price * normalizedQuantity };
    })
    .filter((entry) => entry && entry.quantity > 0);
}

function recordSaleStats(profile, quantity, gross) {
  profile.stats.totalSold += normalizeNonNegativeInteger(quantity);
  profile.stats.totalSalesValue += normalizeNonNegativeInteger(gross);
}

function normalizeSellQuantity(quantity, available) {
  const normalizedAvailable = normalizeNonNegativeInteger(available);
  if (String(quantity ?? 'all').trim().toLocaleLowerCase('ko-KR') === 'all') return normalizedAvailable;
  const normalized = Number(quantity);
  if (!Number.isSafeInteger(normalized) || normalized <= 0) throw new Error('판매 수량은 1 이상의 정수여야 합니다.');
  if (normalized > normalizedAvailable) throw new Error(`보유 수량이 부족합니다. 보유: ${normalizedAvailable.toLocaleString()}개`);
  return normalized;
}

function appendPriceHistory(history = [], point) {
  const normalizedPoint = normalizePriceHistoryPoint(point);
  const points = normalizePriceHistory(history);
  if (!normalizedPoint) return points;
  return dedupePriceHistory([...points, normalizedPoint]).slice(-ORE_PRICE_HISTORY_LIMIT);
}

function normalizePriceHistory(history = [], fallbackState = null, fallbackTickIndex = 0, fallbackAt = 0) {
  const source = Array.isArray(history) ? history : [];
  const points = source.map(normalizePriceHistoryPoint).filter(Boolean).sort(comparePriceHistoryPoints);
  if (points.length === 0 && fallbackState) {
    const fallbackPoint = normalizePriceHistoryPoint({ tickIndex: fallbackTickIndex, price: fallbackState.price, at: fallbackState.updatedAt ?? fallbackAt });
    if (fallbackPoint) points.push(fallbackPoint);
  }
  return dedupePriceHistory(points).slice(-ORE_PRICE_HISTORY_LIMIT);
}

function normalizePriceHistoryPoint(point = {}) {
  const safePoint = point && typeof point === 'object' ? point : {};
  const price = normalizeNonNegativeInteger(safePoint.price);
  if (price <= 0 && safePoint.price !== 0) return null;
  return { tickIndex: normalizeNonNegativeInteger(safePoint.tickIndex), price, at: normalizeNonNegativeInteger(safePoint.at) };
}

function dedupePriceHistory(points) {
  const byTick = new Map();
  for (const point of points.sort(comparePriceHistoryPoints)) byTick.set(point.tickIndex, point);
  return [...byTick.values()].sort(comparePriceHistoryPoints);
}

function comparePriceHistoryPoints(a, b) {
  if (a.tickIndex !== b.tickIndex) return a.tickIndex - b.tickIndex;
  return a.at - b.at;
}

function normalizePickaxe(pickaxe = {}) {
  const level = clampInteger(pickaxe.level, 1, MAX_PICKAXE_LEVEL);
  return {
    level,
    highestLevel: Math.max(level, clampInteger(pickaxe.highestLevel, 1, MAX_PICKAXE_LEVEL)),
    destroyedCount: normalizeNonNegativeInteger(pickaxe.destroyedCount),
    totalEnhancementAttempts: normalizeNonNegativeInteger(pickaxe.totalEnhancementAttempts),
    lastEnhancedAt: normalizeNonNegativeInteger(pickaxe.lastEnhancedAt)
  };
}

function normalizeInventory(inventory = {}) {
  const safeInventory = inventory && typeof inventory === 'object' ? inventory : {};
  const entries = [];
  for (const [oreId, count] of Object.entries(safeInventory)) {
    try {
      const normalizedOreId = normalizeOreId(oreId);
      const normalizedCount = normalizeNonNegativeInteger(count);
      if (normalizedCount > 0) entries.push([normalizedOreId, normalizedCount]);
    } catch {
      // Ignore invalid legacy ore ids.
    }
  }
  return Object.fromEntries(entries);
}

function normalizeBestOre(bestOre = {}) {
  const safeBestOre = bestOre && typeof bestOre === 'object' ? bestOre : {};
  const entries = [];
  for (const [oreId, record] of Object.entries(safeBestOre)) {
    try {
      const normalizedOreId = normalizeOreId(oreId);
      const safeRecord = record && typeof record === 'object' ? record : {};
      entries.push([normalizedOreId, { quality: normalizeNonNegativeInteger(safeRecord.quality), minedAt: normalizeNonNegativeInteger(safeRecord.minedAt ?? safeRecord.caughtAt) }]);
    } catch {
      // Ignore invalid legacy ore ids.
    }
  }
  return Object.fromEntries(entries);
}

function normalizeCollection(collection = {}) {
  const safeCollection = collection && typeof collection === 'object' ? collection : {};
  const entries = [];
  for (const [oreId, firstMinedAt] of Object.entries(safeCollection)) {
    try {
      entries.push([normalizeOreId(oreId), normalizeNonNegativeInteger(firstMinedAt)]);
    } catch {
      // Ignore invalid legacy ore ids.
    }
  }
  return Object.fromEntries(entries);
}

function normalizeIdle(idle = {}) {
  return { startedAt: normalizeNonNegativeInteger(idle?.startedAt), lastClaimedAt: normalizeNonNegativeInteger(idle?.lastClaimedAt), totalMinutes: normalizeNonNegativeInteger(idle?.totalMinutes) };
}

function normalizeFocus(focus = {}) {
  return { streak: normalizeNonNegativeInteger(focus?.streak), bestStreak: normalizeNonNegativeInteger(focus?.bestStreak), lastMinedAt: normalizeNonNegativeInteger(focus?.lastMinedAt) };
}

function normalizeStats(stats = {}) {
  return {
    totalMines: normalizeNonNegativeInteger(stats?.totalMines ?? stats?.totalCatches),
    totalOrePieces: normalizeNonNegativeInteger(stats?.totalOrePieces),
    totalSold: normalizeNonNegativeInteger(stats?.totalSold),
    totalSalesValue: normalizeNonNegativeInteger(stats?.totalSalesValue)
  };
}

function cloneMiningProfile(profile) {
  return {
    userId: profile.userId,
    username: profile.username,
    pickaxe: { ...profile.pickaxe },
    inventory: { ...profile.inventory },
    bestOre: structuredClone(profile.bestOre),
    collection: { ...profile.collection },
    idle: { ...profile.idle },
    focus: { ...profile.focus },
    stats: { ...profile.stats },
    createdAt: profile.createdAt
  };
}

function clampInteger(value, min, max) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized)) return min;
  return Math.min(max, Math.max(min, normalized));
}

function normalizeNonNegativeInteger(value) {
  const normalized = Number(value);
  return Number.isSafeInteger(normalized) && normalized >= 0 ? normalized : 0;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
