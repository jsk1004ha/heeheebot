import {
  getAvailableRpgSkillIds,
  getDefaultRpgEquipment,
  getRpgAdventureGuide,
  getRpgAreaConfig,
  getRpgAreaProgressStatuses,
  getRpgAdvancedClassConfig,
  getRpgAdvancedClassStatuses,
  getRpgBossConfig,
  getRpgClassConfig,
  getRpgClassMasteryStatus,
  getRpgCraftingMasteryStatus,
  getRpgCraftingMasteryStatuses,
  getRpgCraftingRecipeConfig,
  getRpgCraftingRecipeStatus,
  getRpgCraftingRecipeStatuses,
  getRpgCraftingQualityConfig,
  createCraftedRpgGearBlueprint,
  getRpgDailyMissionConfig,
  getRpgDailyMissionStatuses,
  getRpgDerivedStats,
  getRpgDungeonConfig,
  getRpgDungeonUnlockStatus,
  getRpgGachaBannerConfig,
  getRpgGenderConfig,
  getRpgHeroAssetId,
  getRpgFirstJobClassIds,
  getRpgItemConfig,
  getRpgMonsterAssetId,
  getRpgMonsterCodexStatuses,
  getRpgQuestConfig,
  getRpgQuestStatuses,
  getRpgRaidConfig,
  getRpgSkillPointSummary,
  getRpgSkillConfig,
  getRpgSkillTreeConfig,
  getRpgSkillTreeStatuses,
  getRpgStoryChapterConfig,
  getRpgStoryChapterStatuses,
  getRpgTutorialStepConfig,
  getRpgTutorialStatuses,
  getRpgTutorialSummary,
  getStarterRpgClassIds,
  getUnlockedRpgAreaIds,
  normalizeNullableRpgAdvancedClass,
  normalizeRpgAdvancedClass,
  normalizeRpgArea,
  normalizeRpgBossId,
  normalizeRpgClass,
  normalizeRpgCraftingMasteryType,
  normalizeRpgCraftingRecipeId,
  normalizeRpgDailyMissionId,
  normalizeRpgDifficulty,
  normalizeRpgDungeonId,
  normalizeRpgEquipment,
  normalizeRpgGender,
  normalizeRpgGachaBannerId,
  normalizeRpgItemId,
  normalizeRpgMonsterName,
  normalizeRpgQuestId,
  normalizeRpgRaidId,
  normalizeRpgSkillId,
  normalizeRpgSkillTreeNodeId,
  normalizeRpgStoryChapterId,
  normalizeRpgTutorialStepId,
  resolveRpgExploration,
  resolveRpgBattle,
  resolveRpgBossBattle,
  resolveRpgBossTurn,
  resolveRpgGuildRaidBattle,
  resolveRpgRaidBattle,
  rollRpgGearDrop,
  rollRpgDrop,
  rollRpgMaterialDrops,
  rollRpgGachaPull
} from './rpg.js';
import {
  applyRpgDungeonRelicChoice,
  createRpgDungeonRun,
  normalizeRpgDungeonRun,
  resolveRpgDungeonRoom
} from './rpg-dungeon-run.js';

import {
  DAILY_SWORD_GIFT_STONES,
  MAX_DAILY_SWORD_BATTLES,
  MAX_DAILY_SWORD_BATTLE_STONES,
  MAX_SWORD_LEVEL,
  SWORD_DESTRUCTION_SUCCESS_BONUS_DURATION_MS,
  SWORD_DESTRUCTION_SUCCESS_BONUS_MAX_BASIS_POINTS,
  SWORD_DESTRUCTION_SUCCESS_BONUS_MIN_BASIS_POINTS,
  applySwordSuccessBonus,
  getAdvancedSwordEnhanceConfig,
  getSwordEnhanceConfig,
  getSwordSellValue,
  resolveSwordBattle as resolveSwordBattleResult,
  resolveSwordEnhancement
} from './sword.js';
import {
  CURRENCY_MAIN,
  CURRENCY_CASINO,
  CURRENCY_RPG,
  CURRENCY_SWORD,
  cloneWallets,
  creditCurrency,
  debitCurrency,
  exchangeCurrency,
  getCurrencyBalance,
  getCurrencyBalances,
  getStockBankruptcySummary,
  migrateLegacyWalletsToGold,
  normalizeWallets
} from './currencies.js';
import {
  getAccountLinkSummary,
  getAccountUserIdsForGuild,
  getLinkedAccountUsername,
  getOrCreateLinkedAccountProfile,
  isAccountSelectionRequiredError,
  resolveLinkedAccountSelection
} from './accounts.js';

const RPG_SCHEMA_VERSION = 'heehee-rpg-v1';

const DEFAULT_OPTIONS = Object.freeze({
  messageCooldownMs: 0,
  messageXpMin: 8,
  messageXpMax: 18,
  firstMessageXpBonus: 80,
  commandXpMin: 3,
  commandXpMax: 8,
  dailyCooldownMs: 24 * 60 * 60 * 1000,
  dailyCoinRewardMin: 100,
  dailyCoinRewardMax: 1000,
  dailyXpReward: 100,
  dailyStreakXpBonuses: Object.freeze({
    3: 50,
    5: 100,
    7: 200,
    14: 500,
    30: 1500
  }),
  wordChainParticipationXpMin: 20,
  wordChainWinXp: 80,
  wordChainWinnerMoney: 1000,
  liarGameCitizenWinXp: 80,
  liarGameCitizenWinMoney: 500,
  liarGameLiarWinXp: 180,
  liarGameLiarWinMoney: 1500,
  liarGameCitizenLoseXp: 20,
  liarGameLiarLoseXp: 50,
  wordleWinXp: 120,
  wordleWinMoney: 600,
  numberBaseballWinXp: 120,
  numberBaseballWinMoney: 600,
  numberBaseballFailXp: 40,
  rpgBattleWinXpMin: 50,
  rpgBattleWinXpMax: 200,
  rpgBattleCooldownMs: 60_000,
  rpgExploreCooldownMs: 5 * 60_000,
  rpgDungeonCooldownMs: 30 * 60_000,
  rpgBossCooldownMs: 30 * 60_000,
  rpgRaidCooldownMs: 6 * 60 * 60_000,
  rpgRestCooldownMs: 10 * 60_000,
  rpgDailyGoldCap: 3_000,
  fortuneXpReward: 10,
  fortuneXpDayOffsetMs: 9 * 60 * 60 * 1000,
  levelBaseXp: 100,
  levelXpExponent: 1.5
});

const DAY_MS = 24 * 60 * 60 * 1000;
const SWORD_PROTECTION_SCROLL_COST = 15_000;

const SWORD_ACHIEVEMENTS = Object.freeze([
  swordAchievement(
    'sword_level_50',
    '+50 달성',
    '검 최고 강화 +50 달성',
    (sword) => sword.highestLevel >= 50,
    (sword) => `+${Math.min(sword.highestLevel, 50)} / +50`,
    { swordCoins: 5_000, protectionScrolls: 2 }
  ),
  swordAchievement(
    'sword_level_80',
    '+80 고지',
    '검 최고 강화 +80 달성',
    (sword) => sword.highestLevel >= 80,
    (sword) => `+${Math.min(sword.highestLevel, 80)} / +80`,
    { swordCoins: 20_000, refineStones: 5 }
  ),
  swordAchievement(
    'sword_level_100',
    '+100 전설',
    '검 최고 강화 +100 달성',
    (sword) => sword.highestLevel >= 100,
    (sword) => `+${Math.min(sword.highestLevel, 100)} / +100`,
    { swordCoins: 100_000, protectionScrolls: 10, refineStones: 20 }
  ),
  swordAchievement(
    'sword_destroy_5',
    '터져도 다시',
    '검 파괴 5회',
    (sword) => sword.destructions >= 5,
    (sword) => `${Math.min(sword.destructions, 5)} / 5`,
    { protectionScrolls: 3 }
  ),
  swordAchievement(
    'sword_sales_10000',
    '검 장사꾼',
    '검 판매 누적 10,000골드',
    (sword) => sword.saleEarnings >= 10_000,
    (sword) => `${Math.min(sword.saleEarnings, 10_000).toLocaleString()} / 10,000골드`,
    { swordCoins: 10_000 }
  )
]);

function swordAchievement(id, title, description, isComplete, getProgressText, rewards) {
  return Object.freeze({
    id,
    title,
    description,
    isComplete,
    getProgressText,
    rewards: Object.freeze({
      swordCoins: rewards.swordCoins ?? 0,
      refineStones: rewards.refineStones ?? 0,
      protectionScrolls: rewards.protectionScrolls ?? 0
    })
  });
}

export class EconomyService {
  constructor(store, options = {}) {
    const compatibleOptions = { ...options };
    if (compatibleOptions.dailyCoinReward === undefined && options.dailyReward !== undefined) {
      compatibleOptions.dailyCoinReward = options.dailyReward;
    }

    this.store = store;
    this.options = {
      ...DEFAULT_OPTIONS,
      ...compatibleOptions
    };
    this.randomInt = options.randomInt ?? randomInt;
  }

  xpForNextLevel(level) {
    return Math.floor(this.options.levelBaseXp * Math.max(1, level) ** this.options.levelXpExponent);
  }

  async updateExistingLinkedProfile({ guildId, userId, username = 'Unknown', now = Date.now() }, mutator) {
    if (typeof this.store.getAccountProfile !== 'function' || typeof this.store.updateAccountProfile !== 'function') {
      return { hit: false, value: null };
    }

    const normalizedUserId = String(userId ?? '').trim();
    if (!normalizedUserId) return { hit: false, value: null };

    const existing = await this.store.getAccountProfile(normalizedUserId);
    if (!existing) return { hit: false, value: null };

    const value = await this.store.updateAccountProfile({
      guildId,
      userId: normalizedUserId,
      username,
      now
    }, (profile) => {
      normalizeEconomyProfile(profile, normalizedUserId, username, this, now);
      return mutator(profile);
    });

    return value === null
      ? { hit: false, value: null }
      : { hit: true, value };
  }

  async getProfile(guildId, userId, username = 'Unknown') {
    const fast = await this.updateExistingLinkedProfile({
      guildId,
      userId,
      username
    }, (profile) => cloneProfile(profile));
    if (fast.hit) return fast.value;

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      return cloneProfile(profile);
    });
  }

  async getAccountLinkSummary({ guildId, userId, username = 'Unknown' }) {
    const data = await this.store.load();
    return getAccountLinkSummary(data, { guildId, userId, username });
  }

  async resolveAccountLink({ guildId, userId, username = 'Unknown', selectedAccountId, now = Date.now() }) {
    return this.store.update((data) => {
      const result = resolveLinkedAccountSelection(data, {
        guildId,
        userId,
        username,
        selectedAccountId,
        now
      });
      const profile = getOrCreateProfile(data, guildId, userId, username, this, now);

      return {
        ...result,
        profile: cloneProfile(profile)
      };
    });
  }

  async exchangeWallet({ guildId, userId, username, fromCurrency, toCurrency, amount }) {
    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      const exchange = exchangeCurrency(profile, {
        fromCurrency,
        toCurrency,
        amount
      });

      return {
        ...exchange,
        profile: cloneProfile(profile)
      };
    });
  }

  async rewardMessage({ guildId, userId, username, now = Date.now() }) {
    const fast = await this.updateExistingLinkedProfile({
      guildId,
      userId,
      username,
      now
    }, (profile) => rewardMessageProfile(profile, this, now));
    if (fast.hit) return fast.value;

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      const elapsed = now - profile.lastMessageRewardAt;

      if (profile.lastMessageRewardAt > 0 && elapsed < this.options.messageCooldownMs) {
        return {
          awarded: false,
          remainingMs: this.options.messageCooldownMs - elapsed,
          profile: cloneProfile(profile)
        };
      }

      const xpGained = this.randomInt(this.options.messageXpMin, this.options.messageXpMax);
      const today = getDayIndex(now);
      const firstMessageBonusXp = profile.lastFirstMessageBonusDay === today
        ? 0
        : this.options.firstMessageXpBonus;
      const totalXpGained = xpGained + firstMessageBonusXp;
      const levelResult = addXp(profile, totalXpGained, this);

      profile.lastMessageRewardAt = now;
      if (firstMessageBonusXp > 0) {
        profile.lastFirstMessageBonusDay = today;
      }

      return {
        awarded: true,
        xpGained,
        firstMessageBonusXp,
        totalXpGained,
        moneyGained: 0,
        ...levelResult,
        profile: cloneProfile(profile)
      };
    });
  }

  async rewardCommand({ guildId, userId, username, commandName = '명령어', now = Date.now() }) {
    const fast = await this.updateExistingLinkedProfile({
      guildId,
      userId,
      username,
      now
    }, (profile) => rewardCommandProfile(profile, this, commandName));
    if (fast.hit) return fast.value;

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      const xpGained = this.randomInt(this.options.commandXpMin, this.options.commandXpMax);
      const levelResult = addXp(profile, xpGained, this);

      return {
        awarded: true,
        source: `/${String(commandName || '명령어')}`,
        commandName: String(commandName || '명령어'),
        xpGained,
        totalXpGained: xpGained,
        moneyGained: 0,
        ...levelResult,
        profile: cloneProfile(profile)
      };
    });
  }

  async grantXp({ guildId, userId, username, xp, source = '경험치', now = Date.now() }) {
    const fast = await this.updateExistingLinkedProfile({
      guildId,
      userId,
      username,
      now
    }, (profile) => grantXpProfile(profile, this, { xp, source }));
    if (fast.hit) return fast.value;

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this, now);
      const xpGained = normalizeStoredNonNegativeInteger(xp);
      const levelResult = addXp(profile, xpGained, this);

      return {
        awarded: xpGained > 0,
        source: String(source || '경험치'),
        xpGained,
        totalXpGained: xpGained,
        moneyGained: 0,
        ...levelResult,
        profile: cloneProfile(profile)
      };
    });
  }

  async claimDaily({ guildId, userId, username, now = Date.now() }) {
    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      const today = getDayIndex(now);

      if (profile.lastDailyDay === today) {
        return {
          claimed: false,
          remainingMs: getNextDayStartMs(now) - now,
          profile: cloneProfile(profile)
        };
      }

      const streak = profile.lastDailyDay === today - 1
        ? profile.dailyStreak + 1
        : 1;
      const streakBonuses = getStreakBonuses(streak, this.options.dailyStreakXpBonuses);
      const streakBonusXp = streakBonuses.reduce((sum, bonus) => sum + bonus.xp, 0);
      const xpGained = this.options.dailyXpReward + streakBonusXp;
      const coinReward = getDailyCoinReward(this);

      creditCurrency(profile, CURRENCY_MAIN, coinReward);
      profile.lastDailyAt = now;
      profile.lastDailyDay = today;
      profile.dailyStreak = streak;

      const levelResult = addXp(profile, xpGained, this);

      return {
        claimed: true,
        reward: coinReward,
        coinReward,
        xpGained,
        baseXp: this.options.dailyXpReward,
        streak,
        streakBonusXp,
        streakBonuses,
        ...levelResult,
        profile: cloneProfile(profile)
      };
    });
  }

  async awardWordChainWin({ guildId, userId, username }) {
    return this.awardActivityXp({
      guildId,
      userId,
      username,
      xp: this.options.wordChainWinXp,
      source: '끝말잇기 승리'
    });
  }

  async awardWordChainResults({ guildId, participants, winnerUserId = null, prizeUserId = winnerUserId }) {
    const normalizedParticipants = normalizeWordChainParticipants(participants);

    return this.store.update((data) => {
      const totalHumans = normalizedParticipants.length;
      const lastHumanIndex = Math.max(0, totalHumans - 1);
      const xpRange = this.options.wordChainWinXp - this.options.wordChainParticipationXpMin;
      const results = normalizedParticipants.map((participant, index) => {
        const xpGained = totalHumans <= 1
          ? (participant.userId === winnerUserId
              ? this.options.wordChainWinXp
              : this.options.wordChainParticipationXpMin)
          : Math.round(this.options.wordChainParticipationXpMin + (xpRange * index) / lastHumanIndex);
        const profile = getOrCreateProfile(data, guildId, participant.userId, participant.username, this);
        const levelResult = addXp(profile, xpGained, this);
        const moneyGained = participant.userId === prizeUserId
          ? this.options.wordChainWinnerMoney
          : 0;

        if (moneyGained > 0) {
          creditCurrency(profile, CURRENCY_MAIN, moneyGained);
        }

        return {
          userId: participant.userId,
          username: participant.username,
          xpGained,
          moneyGained,
          ...levelResult,
          profile: cloneProfile(profile)
        };
      });
      const winner = results.find((result) => result.userId === winnerUserId) ?? null;
      const prizeRecipient = results.find((result) => result.userId === prizeUserId) ?? null;

      return {
        source: '끝말잇기 결과',
        winner,
        winnerUserId: winner?.userId ?? null,
        prizeRecipient,
        prizeUserId: prizeRecipient?.userId ?? null,
        prizeMoney: prizeRecipient?.moneyGained ?? 0,
        winnerMoney: prizeRecipient?.moneyGained ?? 0,
        participants: results
      };
    });
  }

  async awardLiarGameResults({ guildId, participants, liarUserId, winner }) {
    const normalizedParticipants = normalizeLiarGameParticipants(participants);
    const winnerType = winner === 'liar' ? 'liar' : 'citizens';

    return this.store.update((data) => {
      const results = normalizedParticipants.map((participant) => {
        const isLiar = participant.userId === liarUserId;
        const xpGained = getLiarGameXp(this.options, winnerType, isLiar);
        const moneyGained = getLiarGameMoney(this.options, winnerType, isLiar);
        const profile = getOrCreateProfile(data, guildId, participant.userId, participant.username, this);
        const levelResult = addXp(profile, xpGained, this);

        if (moneyGained > 0) {
          creditCurrency(profile, CURRENCY_MAIN, moneyGained);
        }

        return {
          userId: participant.userId,
          username: participant.username,
          role: isLiar ? 'liar' : 'citizen',
          xpGained,
          moneyGained,
          ...levelResult,
          profile: cloneProfile(profile)
        };
      });

      return {
        source: '라이어게임 결과',
        winner: winnerType,
        liarUserId,
        participants: results,
        liar: results.find((result) => result.userId === liarUserId) ?? null,
        citizens: results.filter((result) => result.userId !== liarUserId)
      };
    });
  }

  async awardRpgBattleWin({ guildId, userId, username }) {
    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      const xpGained = this.randomInt(this.options.rpgBattleWinXpMin, this.options.rpgBattleWinXpMax);
      const levelResult = addRepeatableRpgXp(profile, xpGained, this);

      return {
        xpGained,
        ...levelResult,
        profile: cloneProfile(profile)
      };
    });
  }

  async claimFortuneXp({ guildId, userId, username, now = Date.now() }) {
    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      const today = getDayIndex(now, this.options.fortuneXpDayOffsetMs);

      if (profile.lastFortuneXpDay === today) {
        return {
          claimed: false,
          remainingMs: getNextDayStartMs(now, this.options.fortuneXpDayOffsetMs) - now,
          xpGained: 0,
          profile: cloneProfile(profile)
        };
      }

      profile.lastFortuneXpDay = today;
      const levelResult = addXp(profile, this.options.fortuneXpReward, this);

      return {
        claimed: true,
        xpGained: this.options.fortuneXpReward,
        ...levelResult,
        profile: cloneProfile(profile)
      };
    });
  }

  async awardWordleSuccess({ guildId, userId, username }) {
    const xpGained = normalizeNonNegativeInteger(this.options.wordleWinXp, '워들 경험치');
    const moneyGained = normalizeNonNegativeInteger(this.options.wordleWinMoney, '워들 골드');

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      creditCurrency(profile, CURRENCY_MAIN, moneyGained);
      const levelResult = addXp(profile, xpGained, this);

      return {
        source: '워들 성공',
        xpGained,
        moneyGained,
        ...levelResult,
        profile: cloneProfile(profile)
      };
    });
  }

  async awardNumberBaseballSuccess({ guildId, userId, username }) {
    const xpGained = normalizeNonNegativeInteger(this.options.numberBaseballWinXp, '숫자야구 성공 경험치');
    const moneyGained = normalizeNonNegativeInteger(this.options.numberBaseballWinMoney, '숫자야구 성공 골드');

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      creditCurrency(profile, CURRENCY_MAIN, moneyGained);
      const levelResult = addXp(profile, xpGained, this);

      return {
        source: '숫자야구 성공',
        xpGained,
        moneyGained,
        ...levelResult,
        profile: cloneProfile(profile)
      };
    });
  }

  async awardNumberBaseballFailure({ guildId, userId, username }) {
    const xpGained = normalizeNonNegativeInteger(this.options.numberBaseballFailXp, '숫자야구 완주 경험치');

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      const levelResult = addXp(profile, xpGained, this);

      return {
        source: '숫자야구 실패 완주',
        xpGained,
        moneyGained: 0,
        ...levelResult,
        profile: cloneProfile(profile)
      };
    });
  }

  async chooseRpgClass({
    guildId,
    userId,
    username,
    characterClass = 'novice',
    characterGender = 'male',
    now = Date.now()
  }) {
    const normalizedClass = normalizeRpgClass(characterClass);
    const normalizedGender = normalizeRpgGender(characterGender);
    const genderConfig = getRpgGenderConfig(normalizedGender);
    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      const firstStart = !profile.rpg.startedAt;
      if (firstStart && normalizedClass !== 'novice') {
        throw new Error('희희봇 RPG는 모두 모험가로 시작합니다. Lv.10에 `/rpg 전직`으로 1차 직업을 선택하세요.');
      }
      profile.rpg.characterClass = profile.rpg.primaryClass ?? 'novice';
      profile.rpg.characterGender = normalizedGender;
      profile.rpg.startedAt ||= now;
      const derivedStats = getProfileRpgDerivedStats(profile);
      profile.rpg.hp = firstStart
        ? derivedStats.maxHp
        : Math.min(profile.rpg.hp, derivedStats.maxHp);
      profile.rpg.mp = firstStart
        ? derivedStats.maxMp
        : Math.min(profile.rpg.mp, derivedStats.maxMp);
      if (firstStart) {
        addInventoryItem(profile.rpg.inventory, 'potion', 2);
      }
      profile.rpg.unlockedAreas = getUnlockedRpgAreaIds(getProfileRpgLevel(profile));
      const activeClassConfig = getRpgClassConfig(profile.rpg.characterClass);

      return {
        characterClass: profile.rpg.characterClass,
        characterGender: normalizedGender,
        classConfig: activeClassConfig,
        genderConfig,
        heroAssetId: getRpgHeroAssetId({
          characterClass: profile.rpg.characterClass,
          characterGender: profile.rpg.characterGender,
          advancedClass: profile.rpg.advancedClass
        }),
        derivedStats,
        currentArea: getRpgAreaConfig(profile.rpg.currentArea),
        profile: cloneProfile(profile)
      };
    });
  }

  async chooseRpgFirstJob({ guildId, userId, username, characterClass, now = Date.now() }) {
    const normalizedClass = normalizeRpgClass(characterClass);
    const classConfig = getRpgClassConfig(normalizedClass);

    if (!getRpgFirstJobClassIds().includes(normalizedClass)) {
      throw new Error('1차 직업은 검사, 마법사, 궁수, 성기사, 성직자, 도적, 타짜, 대장장이 중 하나여야 합니다.');
    }

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      const rpgLevel = getProfileRpgLevel(profile);

      if (profile.rpg.startedAt <= 0) {
        throw new Error('먼저 `/rpg 시작`으로 모험가 등록을 해야 합니다.');
      }
      if (rpgLevel < 10) {
        throw new Error(`1차 전직은 RPG Lv.10부터 가능합니다. 현재 RPG Lv.${rpgLevel}`);
      }
      if (profile.rpg.primaryClass && profile.rpg.primaryClass !== normalizedClass) {
        throw new Error('이미 1차 직업을 선택했습니다. 다른 직업은 `/rpg 듀얼직업` 또는 `/rpg 직업변경`을 사용하세요.');
      }

      profile.rpg.primaryClass = normalizedClass;
      profile.rpg.activeSlot = 'primary';
      profile.rpg.characterClass = normalizedClass;
      profile.rpg.advancedClass = null;
      if (!profile.rpg.unlockedClasses.includes(normalizedClass)) {
        profile.rpg.unlockedClasses.push(normalizedClass);
      }
      profile.rpg.startedAt ||= now;
      grantRpgClassMastery(profile, 1);
      const derivedStats = getProfileRpgDerivedStats(profile);
      profile.rpg.hp = Math.min(derivedStats.maxHp, Math.max(1, profile.rpg.hp));
      profile.rpg.mp = Math.min(derivedStats.maxMp, Math.max(0, profile.rpg.mp));

      return {
        characterClass: normalizedClass,
        classConfig,
        jobSlot: 'primary',
        heroAssetId: getProfileRpgHeroAssetId(profile),
        derivedStats,
        profile: cloneProfile(profile)
      };
    });
  }

  async chooseRpgDualClass({ guildId, userId, username, characterClass }) {
    const normalizedClass = normalizeRpgClass(characterClass);
    const classConfig = getRpgClassConfig(normalizedClass);

    if (!getRpgFirstJobClassIds().includes(normalizedClass)) {
      throw new Error('듀얼 직업은 1차 직업 중에서 선택해야 합니다.');
    }

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      const rpgLevel = getProfileRpgLevel(profile);

      if (!profile.rpg.primaryClass) {
        throw new Error('먼저 Lv.10 1차 전직을 완료해야 듀얼 직업을 선택할 수 있습니다.');
      }
      if (rpgLevel < 15) {
        throw new Error(`듀얼 직업은 RPG Lv.15부터 가능합니다. 현재 RPG Lv.${rpgLevel}`);
      }
      if (normalizedClass === profile.rpg.primaryClass) {
        throw new Error('듀얼 직업은 현재 1차 직업과 다른 직업을 선택해야 합니다.');
      }

      profile.rpg.secondaryClass = normalizedClass;
      if (!profile.rpg.unlockedClasses.includes(normalizedClass)) {
        profile.rpg.unlockedClasses.push(normalizedClass);
      }
      const derivedStats = getProfileRpgDerivedStats(profile);
      profile.rpg.hp = Math.min(derivedStats.maxHp, Math.max(1, profile.rpg.hp));
      profile.rpg.mp = Math.min(derivedStats.maxMp, Math.max(0, profile.rpg.mp));

      return {
        characterClass: normalizedClass,
        classConfig,
        jobSlot: 'secondary',
        heroAssetId: getProfileRpgHeroAssetId(profile),
        derivedStats,
        profile: cloneProfile(profile)
      };
    });
  }

  async switchRpgClass({ guildId, userId, username, characterClass }) {
    const normalizedClass = normalizeRpgClass(characterClass);

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      const slot = profile.rpg.primaryClass === normalizedClass
        ? 'primary'
        : profile.rpg.secondaryClass === normalizedClass
          ? 'secondary'
          : null;

      if (!slot) {
        throw new Error('선택한 직업은 현재 보유한 주/보조 직업이 아닙니다.');
      }

      profile.rpg.activeSlot = slot;
      profile.rpg.characterClass = normalizedClass;
      if (profile.rpg.advancedClass) {
        const advancedClass = getRpgAdvancedClassConfig(profile.rpg.advancedClass);
        if (advancedClass?.baseClass !== normalizedClass) {
          profile.rpg.advancedClass = null;
        }
      }
      grantRpgClassMastery(profile, 1);
      const derivedStats = getProfileRpgDerivedStats(profile);
      profile.rpg.hp = Math.min(profile.rpg.hp, derivedStats.maxHp);
      profile.rpg.mp = Math.min(profile.rpg.mp, derivedStats.maxMp);

      return {
        characterClass: normalizedClass,
        classConfig: getRpgClassConfig(normalizedClass),
        jobSlot: slot,
        heroAssetId: getProfileRpgHeroAssetId(profile),
        derivedStats,
        profile: cloneProfile(profile)
      };
    });
  }

  async buyRpgItem({ guildId, userId, username, itemId, quantity = 1 }) {
    const normalizedItemId = normalizeRpgItemId(itemId);
    const item = getRpgItemConfig(normalizedItemId);
    const normalizedQuantity = normalizePositiveInteger(quantity, '구매 수량');
    const totalPrice = item.price * normalizedQuantity;

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);

      debitCurrency(profile, CURRENCY_RPG, totalPrice, '골드가 부족합니다.');
      addInventoryItem(profile.rpg.inventory, normalizedItemId, normalizedQuantity);
      profile.rpg.shopPurchases += normalizedQuantity;

      return {
        itemId: normalizedItemId,
        item,
        quantity: normalizedQuantity,
        totalPrice,
        profile: cloneProfile(profile)
      };
    });
  }

  async useRpgItem({ guildId, userId, username, itemId }) {
    const normalizedItemId = normalizeRpgItemId(itemId);
    const item = getRpgItemConfig(normalizedItemId);

    if (item.type !== 'consumable') {
      throw new Error('사용할 수 있는 소비 아이템이 아닙니다.');
    }

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);

      if ((profile.rpg.inventory[normalizedItemId] ?? 0) <= 0) {
        throw new Error(`${item.label}을(를) 보유하고 있지 않습니다.`);
      }

      const derivedStats = getProfileRpgDerivedStats(profile);

      const canHealHp = (item.heal ?? 0) > 0 && profile.rpg.hp < derivedStats.maxHp;
      const canHealMp = (item.mpHeal ?? 0) > 0 && profile.rpg.mp < derivedStats.maxMp;
      if (!canHealHp && !canHealMp) {
        throw new Error('이미 HP/MP가 가득 찼습니다.');
      }

      removeInventoryItem(profile.rpg.inventory, normalizedItemId, 1);
      const beforeHp = profile.rpg.hp;
      const beforeMp = profile.rpg.mp;
      profile.rpg.hp = Math.min(derivedStats.maxHp, profile.rpg.hp + item.heal);
      profile.rpg.mp = Math.min(derivedStats.maxMp, profile.rpg.mp + (item.mpHeal ?? 0));
      profile.rpg.usedItems += 1;

      return {
        itemId: normalizedItemId,
        item,
        beforeHp,
        beforeMp,
        healed: profile.rpg.hp - beforeHp,
        mpHealed: profile.rpg.mp - beforeMp,
        maxHp: derivedStats.maxHp,
        maxMp: derivedStats.maxMp,
        profile: cloneProfile(profile)
      };
    });
  }

  async equipRpgItem({ guildId, userId, username, itemId }) {
    const normalizedItemId = normalizeRpgItemId(itemId);
    const item = getRpgItemConfig(normalizedItemId);

    if (item.type !== 'equipment') {
      throw new Error('장착할 수 있는 장비 아이템이 아닙니다.');
    }

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);

      if ((profile.rpg.inventory[normalizedItemId] ?? 0) <= 0) {
        throw new Error(`${item.label}을(를) 보유하고 있지 않습니다.`);
      }

      profile.rpg.equipment[item.slot] = normalizedItemId;
      const derivedStats = getProfileRpgDerivedStats(profile);
      profile.rpg.hp = Math.min(profile.rpg.hp, derivedStats.maxHp);
      profile.rpg.mp = Math.min(profile.rpg.mp, derivedStats.maxMp);

      return {
        itemId: normalizedItemId,
        item,
        slot: item.slot,
        derivedStats,
        profile: cloneProfile(profile)
      };
    });
  }

  async sellRpgItem({ guildId, userId, username, itemId, quantity = 1 }) {
    const normalizedItemId = normalizeRpgItemId(itemId);
    const item = getRpgItemConfig(normalizedItemId);
    const normalizedQuantity = normalizePositiveInteger(quantity, '판매 수량');
    const unitPrice = getRpgItemSellValue(item);
    const totalPrice = unitPrice * normalizedQuantity;

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      const beforeCount = profile.rpg.inventory[normalizedItemId] ?? 0;

      if (beforeCount < normalizedQuantity) {
        throw new Error(`${item.label} 보유 수량이 부족합니다.`);
      }

      removeInventoryItem(profile.rpg.inventory, normalizedItemId, normalizedQuantity);
      if (item.type === 'equipment' && (profile.rpg.inventory[normalizedItemId] ?? 0) <= 0) {
        for (const [slot, equippedItemId] of Object.entries(profile.rpg.equipment)) {
          if (equippedItemId === normalizedItemId) {
            profile.rpg.equipment[slot] = null;
          }
        }
      }

      creditCurrency(profile, CURRENCY_RPG, totalPrice);
      profile.rpg.soldItems += normalizedQuantity;
      const derivedStats = getProfileRpgDerivedStats(profile);
      profile.rpg.hp = Math.min(profile.rpg.hp, derivedStats.maxHp);
      profile.rpg.mp = Math.min(profile.rpg.mp, derivedStats.maxMp);

      return {
        itemId: normalizedItemId,
        item,
        quantity: normalizedQuantity,
        unitPrice,
        totalPrice,
        derivedStats,
        profile: cloneProfile(profile)
      };
    });
  }

  async claimRpgQuest({ guildId, userId, username, questId, now = Date.now() }) {
    const normalizedQuestId = normalizeRpgQuestId(questId);
    const quest = getRpgQuestConfig(normalizedQuestId);

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      const questStatus = getRpgQuestStatuses(profile)
        .find((status) => status.id === normalizedQuestId);

      if (!questStatus.complete) {
        throw new Error(`${quest.label} 퀘스트 조건을 아직 달성하지 못했습니다.`);
      }

      if (questStatus.claimed) {
        throw new Error('이미 보상을 받은 퀘스트입니다.');
      }

      creditCurrency(profile, CURRENCY_RPG, quest.rewards.coins);
      for (const [rewardItemId, count] of Object.entries(quest.rewards.items)) {
        addInventoryItem(profile.rpg.inventory, rewardItemId, count);
      }
      const levelResult = addRepeatableRpgXp(profile, quest.rewards.xp, this, now);
      profile.rpg.claimedQuests[normalizedQuestId] = now;

      return {
        questId: normalizedQuestId,
        quest,
        rewards: quest.rewards,
        ...levelResult,
        profile: cloneProfile(profile)
      };
    });
  }

  async claimRpgDailyMission({ guildId, userId, username, missionId, now = Date.now() }) {
    const normalizedMissionId = normalizeRpgDailyMissionId(missionId);
    const mission = getRpgDailyMissionConfig(normalizedMissionId);

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      resetRpgDailyStats(profile.rpg, now);
      const missionStatus = getRpgDailyMissionStatuses(profile, now)
        .find((status) => status.id === normalizedMissionId);

      if (!missionStatus.complete) {
        throw new Error(`${mission.label} 일일 의뢰 조건을 아직 달성하지 못했습니다.`);
      }

      if (missionStatus.claimed) {
        throw new Error('이미 완료 보상을 받은 일일 의뢰입니다.');
      }

      creditCurrency(profile, CURRENCY_RPG, mission.rewards.coins);
      for (const [rewardItemId, count] of Object.entries(mission.rewards.items)) {
        addInventoryItem(profile.rpg.inventory, rewardItemId, count);
      }
      profile.rpg.daily.claimedMissions[normalizedMissionId] = now;
      const levelResult = addRepeatableRpgXp(profile, mission.rewards.xp, this, now);

      return {
        missionId: normalizedMissionId,
        mission,
        status: missionStatus,
        rewards: mission.rewards,
        ...levelResult,
        profile: cloneProfile(profile)
      };
    });
  }

  async claimRpgTutorialStep({ guildId, userId, username, stepId, now = Date.now() }) {
    const normalizedStepId = normalizeRpgTutorialStepId(stepId);
    const step = getRpgTutorialStepConfig(normalizedStepId);

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      const stepStatus = getRpgTutorialStatuses(profile)
        .find((status) => status.id === normalizedStepId);

      if (!stepStatus.complete) {
        throw new Error(`${step.label} 튜토리얼 조건을 아직 달성하지 못했습니다.`);
      }

      if (stepStatus.claimed) {
        throw new Error('이미 받은 튜토리얼 보상입니다.');
      }

      creditCurrency(profile, CURRENCY_RPG, step.rewards.coins);
      for (const [rewardItemId, count] of Object.entries(step.rewards.items)) {
        addInventoryItem(profile.rpg.inventory, rewardItemId, count);
      }
      profile.rpg.tutorial.claimedSteps[normalizedStepId] = now;
      const levelResult = addRepeatableRpgXp(profile, step.rewards.xp, this, now);

      return {
        stepId: normalizedStepId,
        step,
        status: stepStatus,
        rewards: step.rewards,
        tutorial: getRpgTutorialSummary(profile),
        ...levelResult,
        profile: cloneProfile(profile)
      };
    });
  }

  async getRpgStatus({ guildId, userId, username, now = Date.now() }) {
    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      resetRpgDailyStats(profile.rpg, now);
      profile.rpg.unlockedAreas = getUnlockedRpgAreaIds(getProfileRpgLevel(profile));
      const derivedStats = getProfileRpgDerivedStats(profile);
      const actionContext = getRpgActionContext(profile, this, now);

      return {
        profile: cloneProfile(profile),
        classConfig: getRpgClassConfig(profile.rpg.characterClass),
        genderConfig: getRpgGenderConfig(profile.rpg.characterGender),
        advancedClassConfig: profile.rpg.advancedClass
          ? getRpgAdvancedClassConfig(profile.rpg.advancedClass)
          : null,
        heroAssetId: getRpgHeroAssetId({
          characterClass: profile.rpg.characterClass,
          characterGender: profile.rpg.characterGender,
          advancedClass: profile.rpg.advancedClass
        }),
        derivedStats,
        quests: getRpgQuestStatuses(profile),
        skillTree: getRpgSkillTreeStatuses(profile),
        skillPoints: getRpgSkillPointSummary(profile),
        storyChapters: getRpgStoryChapterStatuses(profile),
        codex: getRpgMonsterCodexStatuses(profile),
        tutorial: getRpgTutorialSummary(profile),
        areaProgress: getRpgAreaProgressStatuses(profile),
        classMastery: getRpgClassMasteryStatus(profile),
        classPaths: getRpgAdvancedClassStatuses(profile),
        craftingMastery: getRpgCraftingMasteryStatuses(profile),
        craftingRecipes: getRpgCraftingRecipeStatuses(profile),
        craftingBlessing: profile.rpg.craftingBlessing,
        marketListings: getRpgMarketListingsSnapshot(data, guildId),
        dailyMissions: getRpgDailyMissionStatuses(profile, now),
        adventureGuide: actionContext.adventureGuide,
        availableSkillIds: getAvailableRpgSkillIds(profile.rpg.characterClass, profile.rpg.advancedClass),
        currentArea: getRpgAreaConfig(profile.rpg.currentArea),
        unlockedAreas: profile.rpg.unlockedAreas.map((area) => ({
          id: area,
          ...getRpgAreaConfig(area)
        })),
        ...actionContext
      };
    });
  }

  async enterRpgArea({ guildId, userId, username, area }) {
    const normalizedArea = normalizeRpgArea(area);
    const areaConfig = getRpgAreaConfig(normalizedArea);

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      profile.rpg.unlockedAreas = getUnlockedRpgAreaIds(getProfileRpgLevel(profile));
      assertRpgAreaUnlocked(profile, normalizedArea);
      profile.rpg.currentArea = normalizedArea;

      return {
        area: normalizedArea,
        areaConfig,
        profile: cloneProfile(profile),
        classConfig: getRpgClassConfig(profile.rpg.characterClass),
        genderConfig: getRpgGenderConfig(profile.rpg.characterGender),
        heroAssetId: getRpgHeroAssetId({
          characterClass: profile.rpg.characterClass,
          characterGender: profile.rpg.characterGender,
          advancedClass: profile.rpg.advancedClass
        }),
        derivedStats: getProfileRpgDerivedStats(profile),
        unlockedAreas: profile.rpg.unlockedAreas.map((areaId) => ({
          id: areaId,
          ...getRpgAreaConfig(areaId)
        }))
      };
    });
  }

  async playRpgBattle({
    guildId,
    userId,
    username,
    difficulty = 'normal',
    area = null,
    skill = 'basic',
    now = Date.now()
  }) {
    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      const normalizedArea = normalizeRpgArea(area || profile.rpg.currentArea);
      const unlockedAreas = getUnlockedRpgAreaIds(getProfileRpgLevel(profile));
      const areaConfig = getRpgAreaConfig(normalizedArea);

      if (!unlockedAreas.includes(normalizedArea)) {
        throw new Error(`${areaConfig.label} 지역은 Lv.${areaConfig.unlockLevel}부터 입장할 수 있습니다.`);
      }

      const cooldownRemainingMs = getRpgCooldownRemaining(
        profile,
        now,
        this.options.rpgBattleCooldownMs
      );

      if (cooldownRemainingMs > 0) {
        return {
          battled: false,
          remainingMs: cooldownRemainingMs,
          cooldownRemainingMs,
          difficulty: normalizeRpgDifficulty(difficulty),
          skill: normalizeRpgSkillId(skill),
          profile: cloneProfile(profile)
        };
      }

      if (profile.rpg.hp <= 1) {
        throw new Error('HP가 부족합니다. `/rpg 휴식` 또는 회복 포션을 사용하세요.');
      }

      const skillConfig = prepareRpgSkill(profile, skill);
      const battle = resolveRpgBattle({
        playerLevel: getProfileRpgLevel(profile),
        difficulty,
        area: normalizedArea,
        characterClass: profile.rpg.characterClass,
        characterGender: profile.rpg.characterGender,
        advancedClass: profile.rpg.advancedClass,
        skillId: skillConfig.id,
        statBonuses: getRpgCombatBonuses(profile),
        randomInt: this.randomInt
      });
      const stats = profile.rpg;
      let rewardSettlement = createEmptyRepeatableRpgRewardSettlement();

      stats.battles += 1;
      stats.lastBattleAt = now;
      stats.currentArea = normalizedArea;
      stats.mp = Math.max(0, stats.mp - skillConfig.mpCost);
      stats.discoveredMonsters[battle.monster] = (stats.discoveredMonsters[battle.monster] ?? 0) + 1;
      stats.hp = Math.max(1, stats.hp - battle.damageTaken);
      incrementRpgDailyStats(profile.rpg, now, {
        battles: 1,
        wins: battle.win ? 1 : 0
      });
      increaseRpgAreaProgress(profile.rpg, normalizedArea, battle.win ? 8 : 3);
      grantRpgClassMastery(profile, battle.win ? 12 : 5);
      const drop = rollRpgDrop({ battle, randomInt: this.randomInt });
      const materialDrops = rollRpgMaterialDrops({
        source: 'battle',
        area: battle.area,
        difficulty: battle.difficulty,
        win: battle.win,
        randomInt: this.randomInt
      });
      let gearDrop = rollRpgGearDrop({
        source: battle.difficulty === 'boss' ? 'boss' : 'battle',
        area: battle.area,
        difficulty: battle.difficulty,
        randomInt: this.randomInt
      });

      if (battle.win) {
        stats.wins += 1;
        stats.monsterKills[battle.monster] = (stats.monsterKills[battle.monster] ?? 0) + 1;
        stats.areaWins[normalizedArea] = (stats.areaWins[normalizedArea] ?? 0) + 1;
        if (drop) {
          addInventoryItem(profile.rpg.inventory, drop.itemId, drop.quantity);
        }
        grantRpgInventoryItems(profile.rpg.inventory, materialDrops);
        if (gearDrop) {
          gearDrop = addRpgGear(profile, gearDrop, now);
        }
        rewardSettlement = settleRepeatableRpgRewards(profile, battle.rewards, this, now);
      } else {
        stats.losses += 1;
      }
      const ultimateCharge = settleRpgUltimateCharge(profile, {
        usedUltimate: battle.ultimate,
        chargeGain: battle.win ? 35 : 20
      });

      return {
        battled: true,
        battle,
        assets: battle.assets,
        drop,
        materialDrops: labelRpgItemQuantities(materialDrops),
        gearDrop,
        xpGained: battle.rewards.xp,
        coinReward: rewardSettlement.coinReward,
        requestedCoinReward: battle.rewards.coins,
        rpgGoldLimit: rewardSettlement.rpgGoldLimit,
        ultimateCharge,
        ...rewardSettlement.levelResult,
        ...getRpgActionContext(profile, this, now),
        profile: cloneProfile(profile)
      };
    });
  }

  async startRpgHuntEncounter({
    guildId,
    userId,
    username,
    difficulty = 'normal',
    area = null,
    now = Date.now()
  }) {
    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      const normalizedArea = normalizeRpgArea(area || profile.rpg.currentArea);
      const normalizedDifficulty = normalizeRpgDifficulty(difficulty);
      const areaConfig = getRpgAreaConfig(normalizedArea);
      const unlockedAreas = getUnlockedRpgAreaIds(getProfileRpgLevel(profile));

      if (!unlockedAreas.includes(normalizedArea)) {
        throw new Error(`${areaConfig.label} 지역은 Lv.${areaConfig.unlockLevel}부터 입장할 수 있습니다.`);
      }

      const cooldownRemainingMs = getRpgCooldownRemaining(
        profile,
        now,
        this.options.rpgBattleCooldownMs
      );

      if (cooldownRemainingMs > 0) {
        return {
          started: false,
          battled: false,
          remainingMs: cooldownRemainingMs,
          cooldownRemainingMs,
          difficulty: normalizedDifficulty,
          profile: cloneProfile(profile)
        };
      }

      if (profile.rpg.hp <= 1) {
        throw new Error('HP가 부족합니다. `/rpg 휴식` 또는 회복 포션을 사용하세요.');
      }

      const derivedStats = getProfileRpgDerivedStats(profile);
      const battle = resolveRpgBattle({
        playerLevel: getProfileRpgLevel(profile),
        difficulty: normalizedDifficulty,
        area: normalizedArea,
        characterClass: profile.rpg.characterClass,
        characterGender: profile.rpg.characterGender,
        advancedClass: profile.rpg.advancedClass,
        skillId: 'basic',
        statBonuses: getRpgCombatBonuses(profile),
        randomInt: this.randomInt
      });
      const enemyMaxHp = Math.max(
        16,
        battle.mitigatedMonsterPower * 2 + this.randomInt(0, Math.max(2, getProfileRpgLevel(profile)))
      );

      profile.rpg.lastBattleAt = now;
      profile.rpg.currentArea = normalizedArea;

      return {
        started: true,
        battled: true,
        type: 'hunt_turn',
        session: {
          id: createRpgHuntSessionId(now),
          guildId,
          userId,
          username: profile.username,
          type: 'hunt_turn',
          area: normalizedArea,
          areaLabel: areaConfig.label,
          difficulty: normalizedDifficulty,
          difficultyLabel: battle.difficultyLabel,
          monster: battle.monster,
          createdAt: now,
          updatedAt: now,
          turn: 1,
          completed: false,
          fled: false,
          damageTakenTotal: 0,
          player: {
            userId,
            username: profile.username,
            level: getProfileRpgLevel(profile),
            characterClass: profile.rpg.characterClass,
            characterGender: profile.rpg.characterGender,
            stats: derivedStats,
            hp: profile.rpg.hp,
            maxHp: derivedStats.maxHp,
            mp: profile.rpg.mp,
            maxMp: derivedStats.maxMp,
            inventory: {
              potion: profile.rpg.inventory.potion ?? 0,
              mana_potion: profile.rpg.inventory.mana_potion ?? 0
            },
            availableSkillIds: getAvailableRpgSkillIds(profile.rpg.characterClass, profile.rpg.advancedClass),
            advancedClass: profile.rpg.advancedClass,
            assets: {
              hero: getProfileRpgHeroAssetId(profile)
            }
          },
          boss: {
            hp: enemyMaxHp,
            maxHp: enemyMaxHp,
            power: battle.mitigatedMonsterPower,
            assetId: battle.assets.monster
          },
          battle,
          assets: {
            hero: battle.assets.hero,
            monster: battle.assets.monster,
            background: battle.assets.background
          }
        },
        battle,
        profile: cloneProfile(profile)
      };
    });
  }

  async playRpgHuntTurn({
    guildId,
    session,
    userId,
    action = 'basic',
    now = Date.now()
  }) {
    const nextSession = cloneRpgHuntSession(session);

    if (nextSession.guildId !== guildId) {
      throw new Error('다른 서버의 RPG 사냥입니다.');
    }

    if (nextSession.userId !== userId) {
      throw new Error('이 사냥은 시작한 유저만 조작할 수 있습니다.');
    }

    if (nextSession.completed) {
      throw new Error('이미 종료된 RPG 사냥입니다.');
    }

    if (action === 'flee') {
      nextSession.completed = true;
      nextSession.fled = true;
      nextSession.updatedAt = now;
      return this.store.update((data) => {
        const profile = getOrCreateProfile(data, guildId, userId, nextSession.username, this);
        profile.rpg.currentArea = nextSession.area;
        profile.rpg.hp = Math.max(1, Math.min(getProfileRpgDerivedStats(profile).maxHp, nextSession.player.hp));
        profile.rpg.mp = Math.max(0, Math.min(getProfileRpgDerivedStats(profile).maxMp, nextSession.player.mp));
        return {
          completed: true,
          type: 'hunt_turn',
          fled: true,
          battled: false,
          session: nextSession,
          battle: createRpgHuntBattleResult(nextSession, { win: false, fled: true }),
          profile: cloneProfile(profile)
        };
      });
    }

    const turn = resolveRpgBossTurn({
      player: nextSession.player,
      boss: nextSession.boss,
      action,
      bossId: 'slime_king',
      turnNumber: nextSession.turn,
      randomInt: this.randomInt
    });

    nextSession.player.hp = turn.playerHpAfter;
    nextSession.player.mp = turn.playerMpAfter;
    nextSession.player.inventory = turn.inventory;
    nextSession.boss.hp = turn.bossHpAfter;
    nextSession.damageTakenTotal = normalizeStoredNonNegativeInteger(nextSession.damageTakenTotal) + turn.bossDamage;
    nextSession.lastTurn = turn;
    nextSession.updatedAt = now;

    if (!turn.win && !turn.playerDefeated) {
      nextSession.turn += 1;
      return {
        completed: false,
        type: 'hunt_turn',
        session: nextSession,
        turn
      };
    }

    nextSession.completed = true;
    const win = turn.win;

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, nextSession.username, this);
      let rewardSettlement = createEmptyRepeatableRpgRewardSettlement();
      let gearDrop = null;
      const battle = createRpgHuntBattleResult(nextSession, {
        win,
        turn,
        rewards: win ? nextSession.battle.rewards : { xp: 0, coins: 0 }
      });

      profile.rpg.battles += 1;
      profile.rpg.lastBattleAt = now;
      profile.rpg.currentArea = nextSession.area;
      profile.rpg.hp = Math.max(1, Math.min(getProfileRpgDerivedStats(profile).maxHp, nextSession.player.hp));
      profile.rpg.mp = Math.max(0, Math.min(getProfileRpgDerivedStats(profile).maxMp, nextSession.player.mp));
      setInventoryItemCount(profile.rpg.inventory, 'potion', nextSession.player.inventory.potion ?? 0);
      profile.rpg.discoveredMonsters[battle.monster] = (profile.rpg.discoveredMonsters[battle.monster] ?? 0) + 1;
      incrementRpgDailyStats(profile.rpg, now, {
        battles: 1,
        wins: win ? 1 : 0
      });
      increaseRpgAreaProgress(profile.rpg, nextSession.area, win ? 8 : 3);
      grantRpgClassMastery(profile, win ? 12 : 5);

      const drop = rollRpgDrop({ battle, randomInt: this.randomInt });
      const materialDrops = rollRpgMaterialDrops({
        source: 'battle',
        area: battle.area,
        difficulty: battle.difficulty,
        win,
        randomInt: this.randomInt
      });

      if (win) {
        profile.rpg.wins += 1;
        profile.rpg.monsterKills[battle.monster] = (profile.rpg.monsterKills[battle.monster] ?? 0) + 1;
        profile.rpg.areaWins[nextSession.area] = (profile.rpg.areaWins[nextSession.area] ?? 0) + 1;
        if (drop) {
          addInventoryItem(profile.rpg.inventory, drop.itemId, drop.quantity);
        }
        grantRpgInventoryItems(profile.rpg.inventory, materialDrops);
        gearDrop = rollRpgGearDrop({
          source: battle.difficulty === 'boss' ? 'boss' : 'battle',
          area: battle.area,
          difficulty: battle.difficulty,
          randomInt: this.randomInt
        });
        if (gearDrop) gearDrop = addRpgGear(profile, gearDrop, now);
        rewardSettlement = settleRepeatableRpgRewards(profile, battle.rewards, this, now);
      } else {
        profile.rpg.losses += 1;
      }

      const ultimateCharge = settleRpgUltimateCharge(profile, {
        usedUltimate: turn.ultimate,
        chargeGain: win ? 35 : 20
      });

      return {
        completed: true,
        type: 'hunt_turn',
        battled: true,
        session: nextSession,
        turn,
        battle,
        assets: battle.assets,
        drop: win ? drop : null,
        materialDrops: win ? labelRpgItemQuantities(materialDrops) : [],
        gearDrop,
        xpGained: battle.rewards.xp,
        coinReward: rewardSettlement.coinReward,
        requestedCoinReward: battle.rewards.coins,
        rpgGoldLimit: rewardSettlement.rpgGoldLimit,
        ultimateCharge,
        ...rewardSettlement.levelResult,
        ...getRpgActionContext(profile, this, now),
        profile: cloneProfile(profile)
      };
    });
  }

  async playRpgBossBattle({
    guildId,
    userId,
    username,
    bossId = 'slime_king',
    skill = 'basic',
    now = Date.now()
  }) {
    const normalizedBossId = normalizeRpgBossId(bossId);
    const boss = getRpgBossConfig(normalizedBossId);

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);

      if (getProfileRpgLevel(profile) < boss.unlockLevel) {
        throw new Error(`${boss.label} 보스는 Lv.${boss.unlockLevel}부터 도전할 수 있습니다.`);
      }

      if (!getUnlockedRpgAreaIds(getProfileRpgLevel(profile)).includes(boss.area)) {
        throw new Error(`${boss.label} 보스 지역이 아직 해금되지 않았습니다.`);
      }

      const cooldownRemainingMs = getRpgCooldownRemaining(
        profile,
        now,
        this.options.rpgBattleCooldownMs
      );

      if (cooldownRemainingMs > 0) {
        return {
          battled: false,
          remainingMs: cooldownRemainingMs,
          cooldownRemainingMs,
          bossId: normalizedBossId,
          skill: normalizeRpgSkillId(skill),
          profile: cloneProfile(profile)
        };
      }

      assertRpgActionCooldown(profile, 'lastBossAt', now, this.options.rpgBossCooldownMs, '보스전');

      if (profile.rpg.hp <= 1) {
        throw new Error('HP가 부족합니다. `/rpg 휴식` 또는 회복 포션을 사용하세요.');
      }

      const skillConfig = prepareRpgSkill(profile, skill);
      const battle = resolveRpgBossBattle({
        playerLevel: getProfileRpgLevel(profile),
        bossId: normalizedBossId,
        characterClass: profile.rpg.characterClass,
        characterGender: profile.rpg.characterGender,
        advancedClass: profile.rpg.advancedClass,
        skillId: skillConfig.id,
        statBonuses: getRpgCombatBonuses(profile),
        randomInt: this.randomInt
      });
      const stats = profile.rpg;
      let rewardSettlement = createEmptyRepeatableRpgRewardSettlement();

      stats.battles += 1;
      stats.lastBattleAt = now;
      stats.lastBossAt = now;
      stats.currentArea = battle.area;
      stats.mp = Math.max(0, stats.mp - skillConfig.mpCost);
      stats.discoveredMonsters[battle.monster] = (stats.discoveredMonsters[battle.monster] ?? 0) + 1;
      stats.hp = Math.max(1, stats.hp - battle.damageTaken);
      incrementRpgDailyStats(profile.rpg, now, {
        battles: 1,
        wins: battle.win ? 1 : 0,
        bosses: battle.win ? 1 : 0
      });
      increaseRpgAreaProgress(profile.rpg, battle.area, battle.win ? 20 : 8);
      grantRpgClassMastery(profile, battle.win ? 25 : 10);
      const drop = rollRpgDrop({ battle, randomInt: this.randomInt });
      const materialDrops = rollRpgMaterialDrops({
        source: 'boss',
        area: battle.area,
        difficulty: battle.difficulty,
        win: battle.win,
        randomInt: this.randomInt
      });
      let gearDrop = rollRpgGearDrop({
        source: 'boss',
        area: battle.area,
        difficulty: battle.difficulty,
        randomInt: this.randomInt
      });

      if (battle.win) {
        stats.wins += 1;
        stats.bossKills[normalizedBossId] = (stats.bossKills[normalizedBossId] ?? 0) + 1;
        if (drop) {
          addInventoryItem(profile.rpg.inventory, drop.itemId, drop.quantity);
        }
        grantRpgInventoryItems(profile.rpg.inventory, materialDrops);
        if (gearDrop) {
          gearDrop = addRpgGear(profile, gearDrop, now);
        }
        rewardSettlement = settleRepeatableRpgRewards(profile, battle.rewards, this, now);
      } else {
        stats.losses += 1;
      }
      const ultimateCharge = settleRpgUltimateCharge(profile, {
        usedUltimate: battle.ultimate,
        chargeGain: battle.win ? 45 : 25
      });

      return {
        battled: true,
        battle,
        assets: battle.assets,
        drop,
        materialDrops: labelRpgItemQuantities(materialDrops),
        gearDrop,
        xpGained: battle.rewards.xp,
        coinReward: rewardSettlement.coinReward,
        requestedCoinReward: battle.rewards.coins,
        rpgGoldLimit: rewardSettlement.rpgGoldLimit,
        ultimateCharge,
        ...rewardSettlement.levelResult,
        ...getRpgActionContext(profile, this, now),
        profile: cloneProfile(profile)
      };
    });
  }

  async startRpgBossEncounter({
    guildId,
    userId,
    username,
    bossId = 'slime_king',
    now = Date.now()
  }) {
    const normalizedBossId = normalizeRpgBossId(bossId);
    const boss = getRpgBossConfig(normalizedBossId);

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);

      if (getProfileRpgLevel(profile) < boss.unlockLevel) {
        throw new Error(`${boss.label} 보스는 Lv.${boss.unlockLevel}부터 도전할 수 있습니다.`);
      }

      if (!getUnlockedRpgAreaIds(getProfileRpgLevel(profile)).includes(boss.area)) {
        throw new Error(`${boss.label} 보스 지역이 아직 해금되지 않았습니다.`);
      }

      const cooldownRemainingMs = getRpgCooldownRemaining(
        profile,
        now,
        this.options.rpgBattleCooldownMs
      );

      if (cooldownRemainingMs > 0) {
        return {
          started: false,
          battled: false,
          remainingMs: cooldownRemainingMs,
          cooldownRemainingMs,
          bossId: normalizedBossId,
          profile: cloneProfile(profile)
        };
      }

      assertRpgActionCooldown(profile, 'lastBossAt', now, this.options.rpgBossCooldownMs, '보스전');

      if (profile.rpg.hp <= 1) {
        throw new Error('HP가 부족합니다. `/rpg 휴식` 또는 회복 포션을 사용하세요.');
      }

      const derivedStats = getProfileRpgDerivedStats(profile);
      const bossPower = this.randomInt(boss.powerMin, boss.powerMax);
      const bossMaxHp = Math.max(20, bossPower * 2);
      profile.rpg.lastBattleAt = now;
      profile.rpg.lastBossAt = now;
      profile.rpg.currentArea = boss.area;

      return {
        started: true,
        battled: true,
        type: 'boss_turn',
        session: {
          id: createRpgBossSessionId(now),
          guildId,
          userId,
          username: profile.username,
          type: 'boss_turn',
          bossId: normalizedBossId,
          bossLabel: boss.label,
          area: boss.area,
          areaLabel: getRpgAreaConfig(boss.area).label,
          monster: boss.monster,
          createdAt: now,
          updatedAt: now,
          turn: 1,
          completed: false,
          player: {
            userId,
            username: profile.username,
            level: getProfileRpgLevel(profile),
            characterClass: profile.rpg.characterClass,
            characterGender: profile.rpg.characterGender,
            stats: derivedStats,
            hp: profile.rpg.hp,
            maxHp: derivedStats.maxHp,
            mp: profile.rpg.mp,
            maxMp: derivedStats.maxMp,
            inventory: {
              potion: profile.rpg.inventory.potion ?? 0,
              mana_potion: profile.rpg.inventory.mana_potion ?? 0
            },
            availableSkillIds: getAvailableRpgSkillIds(profile.rpg.characterClass, profile.rpg.advancedClass),
            advancedClass: profile.rpg.advancedClass,
            assets: {
              hero: getProfileRpgHeroAssetId(profile)
            }
          },
          boss: {
            hp: bossMaxHp,
            maxHp: bossMaxHp,
            power: bossPower,
            assetId: getRpgMonsterAssetId(boss.monster)
          },
          assets: {
            hero: getProfileRpgHeroAssetId(profile),
            monster: getRpgMonsterAssetId(boss.monster),
            background: boss.backgroundAssetId
          }
        },
        profile: cloneProfile(profile)
      };
    });
  }

  async playRpgBossTurn({
    guildId,
    session,
    userId,
    action = 'basic',
    now = Date.now()
  }) {
    const nextSession = cloneRpgBossSession(session);

    if (nextSession.guildId !== guildId) {
      throw new Error('다른 서버의 RPG 보스전입니다.');
    }

    if (nextSession.userId !== userId) {
      throw new Error('이 보스전은 시작한 유저만 조작할 수 있습니다.');
    }

    if (nextSession.completed) {
      throw new Error('이미 종료된 RPG 보스전입니다.');
    }

    const turn = resolveRpgBossTurn({
      player: nextSession.player,
      boss: nextSession.boss,
      action,
      bossId: nextSession.bossId,
      turnNumber: nextSession.turn,
      randomInt: this.randomInt
    });

    nextSession.player.hp = turn.playerHpAfter;
    nextSession.player.mp = turn.playerMpAfter;
    nextSession.player.inventory = turn.inventory;
    nextSession.boss.hp = turn.bossHpAfter;
    nextSession.lastTurn = turn;
    nextSession.updatedAt = now;

    if (!turn.win && !turn.playerDefeated) {
      nextSession.turn += 1;
      return {
        completed: false,
        type: 'boss_turn',
        session: nextSession,
        turn
      };
    }

    nextSession.completed = true;
    const boss = getRpgBossConfig(nextSession.bossId);
    const win = turn.win;

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, nextSession.username, this);
      let rewardSettlement = createEmptyRepeatableRpgRewardSettlement();
      let gearDrop = null;
      const battle = {
        bossId: nextSession.bossId,
        bossLabel: boss.label,
        difficulty: 'boss_turn',
        difficultyLabel: '수동 보스',
        area: boss.area,
        areaLabel: getRpgAreaConfig(boss.area).label,
        monster: boss.monster,
        playerLevel: nextSession.player.level,
        playerPower: nextSession.player.stats.attack,
        monsterPower: nextSession.boss.power,
        mitigatedMonsterPower: nextSession.boss.power,
        damageTaken: turn.bossDamage,
        win,
        rewards: {
          xp: win ? boss.xpReward : 0,
          coins: win ? boss.coinReward : 0
        },
        assets: {
          hero: nextSession.assets.hero,
          monster: nextSession.assets.monster,
          background: nextSession.assets.background
        }
      };

      profile.rpg.battles += 1;
      profile.rpg.lastBattleAt = now;
      profile.rpg.lastBossAt = now;
      profile.rpg.currentArea = boss.area;
      profile.rpg.hp = Math.max(1, Math.min(getProfileRpgDerivedStats(profile).maxHp, nextSession.player.hp));
      profile.rpg.mp = Math.max(0, Math.min(getProfileRpgDerivedStats(profile).maxMp, nextSession.player.mp));
      setInventoryItemCount(profile.rpg.inventory, 'potion', nextSession.player.inventory.potion ?? 0);
      profile.rpg.discoveredMonsters[boss.monster] = (profile.rpg.discoveredMonsters[boss.monster] ?? 0) + 1;
      incrementRpgDailyStats(profile.rpg, now, {
        battles: 1,
        wins: win ? 1 : 0,
        bosses: win ? 1 : 0
      });
      increaseRpgAreaProgress(profile.rpg, boss.area, win ? 20 : 8);
      grantRpgClassMastery(profile, win ? 25 : 10);

      if (win) {
        profile.rpg.wins += 1;
        profile.rpg.bossKills[nextSession.bossId] = (profile.rpg.bossKills[nextSession.bossId] ?? 0) + 1;
        gearDrop = addRpgGear(profile, rollRpgGearDrop({
          source: 'boss',
          area: boss.area,
          difficulty: 'boss',
          randomInt: this.randomInt
        }), now);
        rewardSettlement = settleRepeatableRpgRewards(profile, battle.rewards, this, now);
      } else {
        profile.rpg.losses += 1;
      }
      const ultimateCharge = settleRpgUltimateCharge(profile, {
        usedUltimate: turn.ultimate,
        chargeGain: win ? 45 : 25
      });

      return {
        completed: true,
        type: 'boss_turn',
        session: nextSession,
        turn,
        battle,
        assets: battle.assets,
        gearDrop,
        xpGained: battle.rewards.xp,
        coinReward: rewardSettlement.coinReward,
        requestedCoinReward: battle.rewards.coins,
        rpgGoldLimit: rewardSettlement.rpgGoldLimit,
        ultimateCharge,
        ...rewardSettlement.levelResult,
        ...getRpgActionContext(profile, this, now),
        profile: cloneProfile(profile)
      };
    });
  }

  async restRpg({ guildId, userId, username, now = Date.now() }) {
    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      assertRpgActionCooldown(profile, 'lastRestAt', now, this.options.rpgRestCooldownMs, '휴식');
      const derivedStats = getProfileRpgDerivedStats(profile);
      const beforeHp = profile.rpg.hp;
      const beforeMp = profile.rpg.mp;

      profile.rpg.hp = derivedStats.maxHp;
      profile.rpg.mp = derivedStats.maxMp;
      profile.rpg.lastRestAt = now;

      return {
        beforeHp,
        beforeMp,
        healed: profile.rpg.hp - beforeHp,
        mpRestored: profile.rpg.mp - beforeMp,
        derivedStats,
        ...getRpgActionContext(profile, this, now),
        profile: cloneProfile(profile)
      };
    });
  }

  async pullRpgGacha({ guildId, userId, username, bannerId = 'standard', count = 1 }) {
    const normalizedBannerId = normalizeRpgGachaBannerId(bannerId);
    const banner = getRpgGachaBannerConfig(normalizedBannerId);
    const normalizedCount = Math.min(10, normalizePositiveInteger(count, '가챠 횟수'));
    const totalCost = banner.cost * normalizedCount;

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);

      debitCurrency(profile, CURRENCY_RPG, totalCost, '골드가 부족합니다.');
      const pulls = [];

      for (let index = 0; index < normalizedCount; index += 1) {
        const pull = rollRpgGachaPull({
          bannerId: normalizedBannerId,
          randomInt: this.randomInt
        });
        applyGachaReward(profile, pull);
        pulls.push(pull);
      }

      profile.rpg.gacha.totalPulls += normalizedCount;
      profile.rpg.gacha.pity += normalizedCount;
      if (pulls.some((pull) => pull.rarity === 'ssr')) {
        profile.rpg.gacha.pity = 0;
      }

      return {
        bannerId: normalizedBannerId,
        banner,
        count: normalizedCount,
        totalCost,
        pulls,
        profile: cloneProfile(profile)
      };
    });
  }

  async exploreRpg({ guildId, userId, username, area = null, now = Date.now() }) {
    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      const normalizedArea = normalizeRpgArea(area || profile.rpg.currentArea);
      assertRpgAreaUnlocked(profile, normalizedArea);
      assertRpgActionCooldown(profile, 'lastExploreAt', now, this.options.rpgExploreCooldownMs, '탐험');
      if (profile.rpg.hp <= 1) {
        throw new Error('HP가 부족합니다. `/rpg 휴식` 또는 회복 포션을 사용하세요.');
      }
      const derivedStats = getProfileRpgDerivedStats(profile);
      const exploration = resolveRpgExploration({
        playerLevel: getProfileRpgLevel(profile),
        area: normalizedArea,
        randomInt: this.randomInt
      });
      const beforeHp = profile.rpg.hp;
      const beforeMp = profile.rpg.mp;
      const battle = exploration.event === 'battle'
        ? resolveRpgBattle({
          playerLevel: getProfileRpgLevel(profile),
          difficulty: 'normal',
          area: normalizedArea,
          characterClass: profile.rpg.characterClass,
          characterGender: profile.rpg.characterGender,
          advancedClass: profile.rpg.advancedClass,
          skillId: 'basic',
          statBonuses: getRpgCombatBonuses(profile),
          randomInt: this.randomInt
        })
        : null;
      let gearDrop = null;
      let rewardSettlement = createEmptyRepeatableRpgRewardSettlement();
      const materialDrops = rollRpgMaterialDrops({
        source: battle ? 'battle' : 'explore',
        area: normalizedArea,
        difficulty: 'normal',
        win: battle ? battle.win : true,
        randomInt: this.randomInt
      });
      const rewardSource = battle
        ? battle.win ? battle.rewards : { xp: 0, coins: 0 }
        : exploration.rewards;

      profile.rpg.explores += 1;
      profile.rpg.lastExploreAt = now;
      profile.rpg.currentArea = normalizedArea;
      incrementRpgDailyStats(profile.rpg, now, {
        explores: 1,
        battles: battle ? 1 : 0,
        wins: battle?.win ? 1 : 0
      });
      if (battle) {
        profile.rpg.battles += 1;
        profile.rpg.discoveredMonsters[battle.monster] = (profile.rpg.discoveredMonsters[battle.monster] ?? 0) + 1;
        if (battle.win) {
          profile.rpg.wins += 1;
          profile.rpg.monsterKills[battle.monster] = (profile.rpg.monsterKills[battle.monster] ?? 0) + 1;
          profile.rpg.areaWins[normalizedArea] = (profile.rpg.areaWins[normalizedArea] ?? 0) + 1;
        } else {
          profile.rpg.losses += 1;
        }
      }
      increaseRpgAreaProgress(profile.rpg, normalizedArea, battle ? battle.win ? 8 : 3 : exploration.event === 'trap' ? 4 : 10);
      grantRpgClassMastery(profile, battle ? battle.win ? 10 : 4 : 4);
      profile.rpg.hp = Math.max(1, Math.min(
        derivedStats.maxHp,
        profile.rpg.hp - exploration.damageTaken - (battle?.damageTaken ?? 0) + exploration.hpRecovered
      ));
      profile.rpg.mp = Math.max(0, Math.min(derivedStats.maxMp, profile.rpg.mp + exploration.mpRecovered));
      if (!battle || battle.win) {
        grantRpgInventoryItems(profile.rpg.inventory, materialDrops);
      }
      rewardSettlement = settleRepeatableRpgRewards(profile, rewardSource, this, now);
      if (exploration.event === 'treasure') {
        gearDrop = addRpgGear(profile, rollRpgGearDrop({
          source: 'dungeon',
          area: normalizedArea,
          difficulty: 'normal',
          randomInt: this.randomInt
        }) ?? {
          baseItemId: normalizedArea === 'cave' ? 'archmage_staff' : 'iron_sword',
          slot: 'weapon',
          rarity: 'common',
          rarityLabel: '일반',
          label: '일반 장비',
          stats: { attack: 2 },
          power: 1,
          assetId: 'item_iron_sword_icon'
        }, now);
      } else if (battle?.win) {
        const blueprint = rollRpgGearDrop({
          source: 'battle',
          area: normalizedArea,
          difficulty: battle.difficulty,
          randomInt: this.randomInt
        });
        if (blueprint) gearDrop = addRpgGear(profile, blueprint, now);
      }

      return {
        exploration,
        battle,
        beforeHp,
        beforeMp,
        gearDrop,
        materialDrops: (!battle || battle.win) ? labelRpgItemQuantities(materialDrops) : [],
        xpGained: rewardSource.xp,
        coinReward: rewardSettlement.coinReward,
        requestedCoinReward: rewardSource.coins,
        rpgGoldLimit: rewardSettlement.rpgGoldLimit,
        ...rewardSettlement.levelResult,
        ...getRpgActionContext(profile, this, now),
        profile: cloneProfile(profile)
      };
    });
  }

  async runRpgDungeon({ guildId, userId, username, dungeonId = null, area = null, depth = null, now = Date.now() }) {
    return this.startOrResumeRpgDungeonRun({ guildId, userId, username, dungeonId, area, depth, now });
  }

  async startOrResumeRpgDungeonRun({
    guildId,
    userId,
    username,
    dungeonId = null,
    area = null,
    depth = null,
    now = Date.now()
  }) {
    const normalizedDungeonId = dungeonId ? normalizeRpgDungeonId(dungeonId) : null;
    const dungeonConfig = normalizedDungeonId ? getRpgDungeonConfig(normalizedDungeonId) : null;
    const requestedDepth = depth ?? dungeonConfig?.rooms ?? 3;
    const safeDepth = Math.min(
      dungeonConfig?.rooms ?? 5,
      5,
      normalizePositiveInteger(requestedDepth, '던전 깊이')
    );

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this, now);
      const normalizedArea = normalizeRpgArea(dungeonConfig?.area || area || profile.rpg.currentArea);
      assertRpgAreaUnlocked(profile, normalizedArea);
      if (dungeonConfig) assertRpgDungeonUnlocked(profile, normalizedDungeonId);

      if (profile.rpg.dungeonRun) {
        const run = normalizeRpgDungeonRun(profile.rpg.dungeonRun, now);
        if (run) {
          profile.rpg.dungeonRun = run;
          return createRpgDungeonRunResponse({
            profile,
            run,
            dungeonConfig: run.dungeonId ? getRpgDungeonConfig(run.dungeonId) : null,
            action: 'resumed',
            economy: this,
            now
          });
        }
        profile.rpg.dungeonRun = null;
      }

      assertRpgActionCooldown(profile, 'lastDungeonAt', now, this.options.rpgDungeonCooldownMs, '던전');
      if (profile.rpg.hp <= 1) throw new Error('HP가 부족합니다. `/rpg 휴식` 또는 회복 포션을 사용하세요.');

      const derivedStats = getProfileRpgDerivedStats(profile);
      const run = createRpgDungeonRun({
        dungeonId: normalizedDungeonId,
        dungeonConfig,
        area: normalizedArea,
        depth: safeDepth,
        playerLevel: getProfileRpgLevel(profile),
        derivedStats,
        hp: profile.rpg.hp,
        mp: profile.rpg.mp,
        now,
        randomInt: this.randomInt
      });

      profile.rpg.dungeonRuns += 1;
      profile.rpg.lastDungeonAt = now;
      profile.rpg.currentArea = normalizedArea;
      profile.rpg.dungeonRun = run;
      return createRpgDungeonRunResponse({ profile, run, dungeonConfig, action: 'started', economy: this, now });
    });
  }

  async chooseRpgDungeonRoom({ guildId, userId, username, runId = null, revision = null, choiceId, now = Date.now() }) {
    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this, now);
      const run = assertActiveRpgDungeonRun(profile, { runId, revision, expectedState: 'active', now });
      const dungeonConfig = run.dungeonId ? getRpgDungeonConfig(run.dungeonId) : null;
      const resolution = resolveRpgDungeonRoom({
        run,
        choiceId,
        playerLevel: getProfileRpgLevel(profile),
        derivedStats: getProfileRpgDerivedStats(profile),
        randomInt: this.randomInt,
        now
      });

      if (['cleared', 'failed'].includes(resolution.run.state)) {
        return settleRpgDungeonRun({
          profile,
          run: resolution.run,
          dungeonConfig,
          outcome: resolution.run.state,
          roomResult: resolution.roomResult,
          economy: this,
          now
        });
      }

      profile.rpg.dungeonRun = resolution.run;
      return createRpgDungeonRunResponse({
        profile,
        run: resolution.run,
        dungeonConfig,
        action: 'room_resolved',
        roomResult: resolution.roomResult,
        economy: this,
        now
      });
    });
  }

  async chooseRpgDungeonRelic({ guildId, userId, username, runId = null, revision = null, relicId, now = Date.now() }) {
    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this, now);
      const run = assertActiveRpgDungeonRun(profile, { runId, revision, expectedState: 'awaiting_relic', now });
      const dungeonConfig = run.dungeonId ? getRpgDungeonConfig(run.dungeonId) : null;
      const result = applyRpgDungeonRelicChoice({
        run,
        relicId,
        playerLevel: getProfileRpgLevel(profile),
        randomInt: this.randomInt,
        now
      });

      profile.rpg.dungeonRun = result.run;
      return createRpgDungeonRunResponse({
        profile,
        run: result.run,
        dungeonConfig,
        action: 'relic_chosen',
        relic: result.relic,
        economy: this,
        now
      });
    });
  }

  async abandonRpgDungeonRun({ guildId, userId, username, runId = null, revision = null, now = Date.now() }) {
    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this, now);
      const run = assertActiveRpgDungeonRun(profile, { runId, revision, now });
      const dungeonConfig = run.dungeonId ? getRpgDungeonConfig(run.dungeonId) : null;
      return settleRpgDungeonRun({
        profile,
        run: { ...run, state: 'abandoned', updatedAt: now, currentChoices: [], pendingRelicChoices: [] },
        dungeonConfig,
        outcome: 'abandoned',
        economy: this,
        now
      });
    });
  }

  async craftRpgRecipe({ guildId, userId, username, recipeId, quantity = 1, now = Date.now() }) {
    const normalizedRecipeId = normalizeRpgCraftingRecipeId(recipeId);
    const recipe = getRpgCraftingRecipeConfig(normalizedRecipeId);
    const safeQuantity = recipe.resultType === 'gear'
      ? 1
      : Math.min(10, normalizePositiveInteger(quantity, '제작 수량'));

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      const initialStatus = getRpgCraftingRecipeStatus(profile, normalizedRecipeId, recipe);
      if (!initialStatus.levelReady) {
        throw new Error(`${recipe.label} 제작은 RPG Lv.${recipe.requiredLevel}부터 가능합니다.`);
      }
      if (!initialStatus.masteryReady) {
        throw new Error(`${initialStatus.mastery.label} Lv.${recipe.requiredMasteryLevel} 이상이 필요합니다.`);
      }
      if (!initialStatus.classReady) {
        throw new Error(`${recipe.label} 제작은 대장장이 계열만 가능합니다.`);
      }

      const results = [];
      const createdGear = [];
      const blessingBefore = profile.rpg.craftingBlessing;

      for (let index = 0; index < safeQuantity; index += 1) {
        assertRpgCraftingMaterials(profile, recipe);
        debitCurrency(profile, CURRENCY_RPG, recipe.gold, `골드가 부족합니다. 제작 비용: ${recipe.gold.toLocaleString()}골드`);

        const masteryBefore = getRpgCraftingMasteryStatus(profile, recipe.masteryType);
        const successRate = getRpgCraftingSuccessRate(profile, recipe, masteryBefore);
        const roll = this.randomInt(1, 100);
        const success = roll <= successRate;
        const consumedMaterials = consumeRpgCraftingMaterials(profile, recipe, { success });
        const qualityId = success ? rollRpgCraftingQuality(profile, recipe, masteryBefore, this.randomInt) : null;
        let rewardItem = null;
        let gear = null;

        if (success) {
          if (recipe.resultType === 'gear') {
            gear = addRpgGear(profile, createCraftedRpgGearBlueprint({
              recipeId: normalizedRecipeId,
              qualityId,
              craftedBy: profile.username,
              now,
              randomInt: this.randomInt
            }), now);
            createdGear.push(cloneRpgGear(gear));
          } else {
            const resultQuantity = Math.max(1, recipe.resultQuantity ?? 1);
            addInventoryItem(profile.rpg.inventory, recipe.resultItemId, resultQuantity);
            rewardItem = {
              itemId: recipe.resultItemId,
              label: getRpgItemConfig(recipe.resultItemId).label,
              quantity: resultQuantity
            };
          }
          profile.rpg.craftedItems += 1;
          profile.rpg.craftingBlessing = Math.max(0, profile.rpg.craftingBlessing - 25);
        } else {
          profile.rpg.craftingBlessing = Math.min(100, profile.rpg.craftingBlessing + 12);
        }

        const masteryAfter = grantRpgCraftingMastery(profile, recipe.masteryType, success ? recipe.xp : Math.max(1, Math.floor(recipe.xp * 0.35)));
        const result = {
          recipeId: normalizedRecipeId,
          label: recipe.label,
          success,
          roll,
          successRate,
          qualityId,
          quality: qualityId ? getRpgCraftingQualityConfig(qualityId) : null,
          consumedMaterials: labelRpgItemQuantities(consumedMaterials),
          rewardItem,
          gear: gear ? cloneRpgGear(gear) : null,
          mastery: masteryAfter
        };
        results.push(result);
        pushRpgCraftingLog(profile.rpg, {
          recipeId: normalizedRecipeId,
          resultItemId: recipe.resultItemId,
          success,
          quality: qualityId,
          createdAt: now
        });
      }

      return {
        recipeId: normalizedRecipeId,
        recipe,
        quantity: safeQuantity,
        results,
        createdGear,
        successCount: results.filter((result) => result.success).length,
        failureCount: results.filter((result) => !result.success).length,
        blessingBefore,
        blessingAfter: profile.rpg.craftingBlessing,
        mastery: getRpgCraftingMasteryStatus(profile, recipe.masteryType),
        profile: cloneProfile(profile)
      };
    });
  }

  async createRpgMarketListing({ guildId, userId, username, item, price, quantity = 1, now = Date.now() }) {
    const normalizedPrice = normalizePositiveInteger(price, '판매 가격');
    const normalizedQuantity = Math.min(99, normalizePositiveInteger(quantity, '판매 수량'));

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      const guild = getOrCreateGuildData(data, guildId);
      guild.rpgMarketListings ??= {};
      const listingId = createRpgMarketListingId(now, guild.rpgMarketListings);
      let listing;

      try {
        const gear = resolveOwnedRpgGear(profile, item);
        if (Object.values(profile.rpg.equippedGear).includes(gear.id)) {
          throw new Error('장착 중인 장비는 먼저 장착 해제하거나 다른 장비로 교체하세요.');
        }
        delete profile.rpg.gearInventory[gear.id];
        listing = {
          id: listingId,
          kind: 'gear',
          sellerId: userId,
          sellerUsername: profile.username,
          price: normalizedPrice,
          quantity: 1,
          gear: cloneRpgGear(gear),
          label: gear.label,
          assetId: gear.assetId,
          createdAt: now
        };
      } catch (gearError) {
        if (String(gearError?.message ?? '').startsWith('장착 중인 장비')) {
          throw gearError;
        }
        const itemId = normalizeRpgItemId(item);
        const itemConfig = getRpgItemConfig(itemId);
        if ((profile.rpg.inventory[itemId] ?? 0) < normalizedQuantity) {
          throw new Error(`${itemConfig.label} 보유 수량이 부족합니다.`);
        }
        removeInventoryItem(profile.rpg.inventory, itemId, normalizedQuantity);
        listing = {
          id: listingId,
          kind: 'item',
          sellerId: userId,
          sellerUsername: profile.username,
          price: normalizedPrice,
          quantity: normalizedQuantity,
          itemId,
          label: itemConfig.label,
          assetId: itemConfig.assetId,
          createdAt: now
        };
      }

      guild.rpgMarketListings[listingId] = listing;
      return {
        listing: cloneRpgMarketListing(listing),
        marketListings: getRpgMarketListingsSnapshot(data, guildId),
        profile: cloneProfile(profile)
      };
    });
  }

  async buyRpgMarketListing({ guildId, userId, username, listingId, now = Date.now() }) {
    return this.store.update((data) => {
      const guild = getOrCreateGuildData(data, guildId);
      guild.rpgMarketListings ??= {};
      const listing = guild.rpgMarketListings[String(listingId || '').trim()];
      if (!listing) {
        throw new Error('거래소 매물을 찾을 수 없습니다.');
      }
      if (listing.sellerId === userId) {
        throw new Error('자신이 등록한 매물은 구매할 수 없습니다.');
      }

      const buyer = getOrCreateProfile(data, guildId, userId, username, this);
      const seller = getOrCreateProfile(data, guildId, listing.sellerId, listing.sellerUsername, this);
      debitCurrency(buyer, CURRENCY_RPG, listing.price, `골드가 부족합니다. 구매 가격: ${listing.price.toLocaleString()}골드`);
      creditCurrency(seller, CURRENCY_RPG, listing.price);

      let acquiredGear = null;
      if (listing.kind === 'gear') {
        const gearBlueprint = cloneRpgGear(listing.gear);
        delete gearBlueprint.id;
        acquiredGear = addRpgGear(buyer, gearBlueprint, now);
      } else {
        addInventoryItem(buyer.rpg.inventory, listing.itemId, listing.quantity);
      }

      delete guild.rpgMarketListings[listing.id];
      return {
        listing: cloneRpgMarketListing(listing),
        acquiredGear: acquiredGear ? cloneRpgGear(acquiredGear) : null,
        buyer: cloneProfile(buyer),
        seller: cloneProfile(seller),
        marketListings: getRpgMarketListingsSnapshot(data, guildId)
      };
    });
  }

  async cancelRpgMarketListing({ guildId, userId, username, listingId, now = Date.now() }) {
    return this.store.update((data) => {
      const guild = getOrCreateGuildData(data, guildId);
      guild.rpgMarketListings ??= {};
      const listing = guild.rpgMarketListings[String(listingId || '').trim()];
      if (!listing) {
        throw new Error('거래소 매물을 찾을 수 없습니다.');
      }
      if (listing.sellerId !== userId) {
        throw new Error('본인이 등록한 매물만 취소할 수 있습니다.');
      }

      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      if (listing.kind === 'gear') {
        const gearBlueprint = cloneRpgGear(listing.gear);
        delete gearBlueprint.id;
        addRpgGear(profile, gearBlueprint, now);
      } else {
        addInventoryItem(profile.rpg.inventory, listing.itemId, listing.quantity);
      }

      delete guild.rpgMarketListings[listing.id];
      return {
        listing: cloneRpgMarketListing(listing),
        marketListings: getRpgMarketListingsSnapshot(data, guildId),
        profile: cloneProfile(profile)
      };
    });
  }

  async getRpgMarketplace({ guildId }) {
    return this.store.update((data) => ({
      marketListings: getRpgMarketListingsSnapshot(data, guildId)
    }));
  }

  async equipRpgGear({ guildId, userId, username, gearId }) {
    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      const gear = resolveOwnedRpgGear(profile, gearId);
      const previousGearId = profile.rpg.equippedGear[gear.slot] ?? null;
      const previousGear = previousGearId ? profile.rpg.gearInventory[previousGearId] ?? null : null;
      const comparison = compareRpgGears(previousGear, gear);

      profile.rpg.equippedGear[gear.slot] = gear.id;
      const derivedStats = getProfileRpgDerivedStats(profile);
      profile.rpg.hp = Math.min(profile.rpg.hp, derivedStats.maxHp);
      profile.rpg.mp = Math.min(profile.rpg.mp, derivedStats.maxMp);

      return {
        gear,
        previousGear: previousGear ? cloneRpgGear(previousGear) : null,
        slot: gear.slot,
        comparison,
        derivedStats,
        profile: cloneProfile(profile)
      };
    });
  }

  async equipRecommendedRpgGear({ guildId, userId, username }) {
    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      const equipped = [];
      const skipped = [];

      for (const slot of Object.keys(getDefaultRpgEquipment())) {
        const recommendation = findRecommendedRpgGearForSlot(profile, slot);
        if (!recommendation?.gear) {
          skipped.push({ slot, reason: 'candidate_missing' });
          continue;
        }

        const { gear, previousGear, comparison } = recommendation;
        if (gear.id === previousGear?.id || comparison.scoreDelta <= 0) {
          skipped.push({ slot, reason: 'already_best', gear: cloneRpgGear(gear), comparison });
          continue;
        }

        profile.rpg.equippedGear[slot] = gear.id;
        equipped.push({
          slot,
          gear: cloneRpgGear(gear),
          previousGear: previousGear ? cloneRpgGear(previousGear) : null,
          comparison
        });
      }

      const derivedStats = getProfileRpgDerivedStats(profile);
      profile.rpg.hp = Math.min(profile.rpg.hp, derivedStats.maxHp);
      profile.rpg.mp = Math.min(profile.rpg.mp, derivedStats.maxMp);

      return {
        equipped,
        skipped,
        derivedStats,
        profile: cloneProfile(profile)
      };
    });
  }

  async enhanceRpgGear({ guildId, userId, username, gearId, now = Date.now() }) {
    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      const gear = resolveOwnedRpgGear(profile, gearId);
      const beforeGear = cloneRpgGear(gear);
      const baseCost = getRpgGearEnhanceCost(gear);
      const materialItemId = 'enhancement_stone';
      const materialUsed = (profile.rpg.inventory[materialItemId] ?? 0) > 0;
      const cost = materialUsed ? Math.max(1, Math.floor(baseCost * 0.8)) : baseCost;
      const successRate = Math.min(98, getRpgGearEnhanceSuccessRate(gear) + (materialUsed ? 8 : 0));
      const roll = this.randomInt(1, 100);
      const success = roll <= successRate;

      debitCurrency(
        profile,
        CURRENCY_RPG,
        cost,
        `골드가 부족합니다. 장비 강화 비용: ${cost.toLocaleString()}골드`
      );
      if (materialUsed) {
        removeInventoryItem(profile.rpg.inventory, materialItemId, 1);
      }

      if (success) {
        applyRpgGearEnhancement(gear, now);
      } else {
        gear.lastEnhancedAt = now;
      }

      const derivedStats = getProfileRpgDerivedStats(profile);
      profile.rpg.hp = Math.min(profile.rpg.hp, derivedStats.maxHp);
      profile.rpg.mp = Math.min(profile.rpg.mp, derivedStats.maxMp);

      return {
        success,
        roll,
        successRate,
        baseCost,
        cost,
        materialUsed,
        materialItemId: materialUsed ? materialItemId : null,
        beforeGear,
        gear: cloneRpgGear(gear),
        slot: gear.slot,
        derivedStats,
        profile: cloneProfile(profile)
      };
    });
  }

  async disassembleRpgGear({ guildId, userId, username, gearId, now = Date.now() }) {
    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      const gear = resolveOwnedRpgGear(profile, gearId);

      if (Object.values(profile.rpg.equippedGear).includes(gear.id)) {
        throw new Error('장착 중인 장비는 먼저 다른 장비로 교체한 뒤 분해하세요.');
      }

      const rewards = getRpgGearDisassembleRewards(gear);
      delete profile.rpg.gearInventory[gear.id];
      addInventoryItem(profile.rpg.inventory, 'enhancement_stone', rewards.enhancementStones);
      creditCurrency(profile, CURRENCY_RPG, rewards.coins);
      profile.rpg.disassembledGear += 1;
      profile.rpg.lastDisassembledGearAt = now;

      return {
        gear: cloneRpgGear(gear),
        rewards,
        profile: cloneProfile(profile)
      };
    });
  }

  async learnRpgSkill({ guildId, userId, username, skillId }) {
    const normalizedSkillId = normalizeRpgSkillTreeNodeId(skillId);
    const skill = getRpgSkillTreeConfig(normalizedSkillId);

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      const points = getRpgSkillPointSummary(profile);

      if (profile.rpg.learnedSkills.includes(normalizedSkillId)) {
        throw new Error('이미 배운 스킬트리입니다.');
      }
      if (!skill.classes.includes(profile.rpg.characterClass)) {
        throw new Error(`${getRpgClassConfig(profile.rpg.characterClass).label} 직업은 ${skill.label}을 배울 수 없습니다.`);
      }
      if (points.available < skill.cost) {
        throw new Error(`스킬 포인트가 부족합니다. 필요 ${skill.cost}점, 보유 ${points.available}점`);
      }

      profile.rpg.learnedSkills.push(normalizedSkillId);
      const derivedStats = getProfileRpgDerivedStats(profile);
      profile.rpg.hp = Math.min(profile.rpg.hp, derivedStats.maxHp);
      profile.rpg.mp = Math.min(profile.rpg.mp, derivedStats.maxMp);

      return {
        skillId: normalizedSkillId,
        skill,
        skillPoints: getRpgSkillPointSummary(profile),
        derivedStats,
        profile: cloneProfile(profile)
      };
    });
  }

  async advanceRpgClass({ guildId, userId, username, advancedClass }) {
    const normalizedAdvancedClass = normalizeRpgAdvancedClass(advancedClass);
    const advancedClassConfig = getRpgAdvancedClassConfig(normalizedAdvancedClass);

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      const classPath = getRpgAdvancedClassStatuses(profile)
        .find((entry) => entry.id === normalizedAdvancedClass);

      if (profile.rpg.characterClass !== advancedClassConfig.baseClass) {
        throw new Error(`${advancedClassConfig.label} 전직은 ${getRpgClassConfig(advancedClassConfig.baseClass).label}만 가능합니다.`);
      }
      if (advancedClassConfig.unlockLevel >= 45) {
        const currentAdvancedClass = profile.rpg.advancedClass
          ? getRpgAdvancedClassConfig(profile.rpg.advancedClass)
          : null;
        const hasSecondJob = currentAdvancedClass
          && currentAdvancedClass.baseClass === advancedClassConfig.baseClass
          && currentAdvancedClass.unlockLevel < 45;
        if (!hasSecondJob) {
          throw new Error(`${advancedClassConfig.label} 3차 전직은 먼저 같은 계열 2차 전직을 완료해야 합니다.`);
        }
      }
      if (getProfileRpgLevel(profile) < advancedClassConfig.unlockLevel) {
        throw new Error(`${advancedClassConfig.label} 전직은 Lv.${advancedClassConfig.unlockLevel}부터 가능합니다.`);
      }
      if (!classPath?.masteryReady) {
        throw new Error(`${advancedClassConfig.label} 전직은 ${getRpgClassConfig(advancedClassConfig.baseClass).label} 숙련 Lv.${advancedClassConfig.masteryLevel}부터 가능합니다.`);
      }
      if (!classPath?.questReady) {
        throw new Error(`${advancedClassConfig.label} 전직 퀘스트 '${advancedClassConfig.classQuest.label}'을 완료해야 합니다. 진행도 ${classPath.questCurrent}/${classPath.questRequired}`);
      }

      profile.rpg.advancedClass = normalizedAdvancedClass;
      const derivedStats = getProfileRpgDerivedStats(profile);
      profile.rpg.hp = Math.min(derivedStats.maxHp, profile.rpg.hp + 20);
      profile.rpg.mp = Math.min(derivedStats.maxMp, profile.rpg.mp + 10);

      return {
        advancedClass: normalizedAdvancedClass,
        advancedClassConfig,
        heroAssetId: getProfileRpgHeroAssetId(profile),
        derivedStats,
        profile: cloneProfile(profile)
      };
    });
  }

  async progressRpgStory({ guildId, userId, username, chapterId, now = Date.now() }) {
    const normalizedChapterId = normalizeRpgStoryChapterId(chapterId);
    const chapter = getRpgStoryChapterConfig(normalizedChapterId);

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      const status = getRpgStoryChapterStatuses(profile).find((entry) => entry.id === normalizedChapterId);

      if (!status.complete) {
        throw new Error(`${chapter.label} 진행 조건을 아직 달성하지 못했습니다.`);
      }
      if (status.completed) {
        throw new Error('이미 완료한 스토리 챕터입니다.');
      }

      profile.rpg.storyChapters[normalizedChapterId] = now;
      creditCurrency(profile, CURRENCY_RPG, chapter.rewards.coins);
      for (const [itemId, count] of Object.entries(chapter.rewards.items)) {
        addInventoryItem(profile.rpg.inventory, itemId, count);
      }
      const levelResult = addRepeatableRpgXp(profile, chapter.rewards.xp, this, now);

      return {
        chapterId: normalizedChapterId,
        chapter,
        rewards: chapter.rewards,
        ...levelResult,
        profile: cloneProfile(profile)
      };
    });
  }

  async claimRpgCodex({ guildId, userId, username, monsterName, now = Date.now() }) {
    const normalizedMonster = normalizeRpgMonsterName(monsterName);

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      const codex = getRpgMonsterCodexStatuses(profile).find((entry) => entry.monster === normalizedMonster);

      if (!codex?.canClaim) {
        throw new Error('아직 보상을 받을 수 없는 도감 항목입니다.');
      }

      profile.rpg.codexClaims[normalizedMonster] = now;
      creditCurrency(profile, CURRENCY_RPG, codex.rewards.coins);
      const levelResult = addRepeatableRpgXp(profile, codex.rewards.xp, this, now);

      return {
        codex,
        rewards: codex.rewards,
        ...levelResult,
        profile: cloneProfile(profile)
      };
    });
  }

  async playRpgRaid({ guildId, userId, username, raidId = 'slime_horde', skill = 'basic', now = Date.now() }) {
    const normalizedRaidId = normalizeRpgRaidId(raidId);
    const raid = getRpgRaidConfig(normalizedRaidId);

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      if (getProfileRpgLevel(profile) < raid.unlockLevel) {
        throw new Error(`${raid.label} 레이드는 Lv.${raid.unlockLevel}부터 도전할 수 있습니다.`);
      }
      assertRpgAreaUnlocked(profile, raid.area);
      assertRpgActionCooldown(profile, 'lastRaidAt', now, this.options.rpgRaidCooldownMs, '레이드');
      if (profile.rpg.hp <= 1) {
        throw new Error('HP가 부족합니다. `/rpg 휴식` 또는 회복 포션을 사용하세요.');
      }

      const skillConfig = prepareRpgSkill(profile, skill);
      const battle = resolveRpgRaidBattle({
        playerLevel: getProfileRpgLevel(profile),
        raidId: normalizedRaidId,
        characterClass: profile.rpg.characterClass,
        characterGender: profile.rpg.characterGender,
        advancedClass: profile.rpg.advancedClass,
        skillId: skillConfig.id,
        statBonuses: getRpgCombatBonuses(profile),
        randomInt: this.randomInt
      });
      let gearDrop = null;
      let rewardSettlement = createEmptyRepeatableRpgRewardSettlement();
      const materialDrops = rollRpgMaterialDrops({
        source: 'raid',
        area: battle.area,
        difficulty: 'hard',
        win: battle.win,
        randomInt: this.randomInt
      });

      profile.rpg.battles += 1;
      profile.rpg.lastBattleAt = now;
      profile.rpg.lastRaidAt = now;
      profile.rpg.mp = Math.max(0, profile.rpg.mp - skillConfig.mpCost);
      profile.rpg.hp = Math.max(1, profile.rpg.hp - battle.damageTaken);
      profile.rpg.discoveredMonsters[battle.monster] = (profile.rpg.discoveredMonsters[battle.monster] ?? 0) + 1;
      incrementRpgDailyStats(profile.rpg, now, {
        battles: 1,
        wins: battle.win ? 1 : 0,
        raids: battle.win ? 1 : 0
      });
      increaseRpgAreaProgress(profile.rpg, battle.area, battle.win ? 30 : 12);
      grantRpgClassMastery(profile, battle.win ? 35 : 12);

      if (battle.win) {
        profile.rpg.wins += 1;
        profile.rpg.raidClears[normalizedRaidId] = (profile.rpg.raidClears[normalizedRaidId] ?? 0) + 1;
        profile.rpg.monsterKills[battle.monster] = (profile.rpg.monsterKills[battle.monster] ?? 0) + 1;
        grantRpgInventoryItems(profile.rpg.inventory, materialDrops);
        gearDrop = addRpgGear(profile, rollRpgGearDrop({
          source: 'raid',
          area: battle.area,
          difficulty: 'hard',
          randomInt: this.randomInt
        }), now);
        rewardSettlement = settleRepeatableRpgRewards(profile, battle.rewards, this, now);
      } else {
        profile.rpg.losses += 1;
      }
      const ultimateCharge = settleRpgUltimateCharge(profile, {
        usedUltimate: battle.ultimate,
        chargeGain: battle.win ? 50 : 25
      });

      return {
        battled: true,
        battle,
        assets: battle.assets,
        gearDrop,
        materialDrops: labelRpgItemQuantities(materialDrops),
        xpGained: battle.rewards.xp,
        coinReward: rewardSettlement.coinReward,
        requestedCoinReward: battle.rewards.coins,
        rpgGoldLimit: rewardSettlement.rpgGoldLimit,
        ultimateCharge,
        ...rewardSettlement.levelResult,
        ...getRpgActionContext(profile, this, now),
        profile: cloneProfile(profile)
      };
    });
  }

  async playRpgGuildRaid({
    guildId,
    userId,
    username,
    raidId = 'slime_horde',
    skill = 'basic',
    partyMemberIds = null,
    now = Date.now()
  }) {
    const normalizedRaidId = normalizeRpgRaidId(raidId);
    const raid = getRpgRaidConfig(normalizedRaidId);

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      const guild = data.guilds[guildId];
      assertRpgGuildRaidParticipantAvailable(profile, raid, this, now, '길드 레이드 지휘');

      const skillConfig = prepareRpgSkill(profile, skill);
      const partyProfiles = Array.isArray(partyMemberIds) && partyMemberIds.length > 0
        ? getRpgGuildRaidPartyProfilesByIds(data, guildId, guild, profile, partyMemberIds, this, raid, now)
        : getRpgGuildRaidPartyProfiles(data, guildId, guild, profile, this, raid, now);
      const battle = resolveRpgGuildRaidBattle({
        playerLevel: getProfileRpgLevel(profile),
        raidId: normalizedRaidId,
        characterClass: profile.rpg.characterClass,
        characterGender: profile.rpg.characterGender,
        advancedClass: profile.rpg.advancedClass,
        skillId: skillConfig.id,
        statBonuses: getRpgCombatBonuses(profile),
        partyMembers: partyProfiles.map((partyProfile) => createRpgGuildRaidMember(partyProfile)),
        randomInt: this.randomInt
      });
      let gearDrop = null;
      let rewardSettlement = createEmptyRepeatableRpgRewardSettlement();
      const supportRewards = [];
      const materialDrops = rollRpgMaterialDrops({
        source: 'raid',
        area: battle.area,
        difficulty: 'hard',
        win: battle.win,
        randomInt: this.randomInt
      });

      profile.rpg.battles += 1;
      profile.rpg.lastBattleAt = now;
      profile.rpg.lastRaidAt = now;
      profile.rpg.mp = Math.max(0, profile.rpg.mp - skillConfig.mpCost);
      profile.rpg.hp = Math.max(1, profile.rpg.hp - battle.damageTaken);
      profile.rpg.discoveredMonsters[battle.monster] = (profile.rpg.discoveredMonsters[battle.monster] ?? 0) + 1;
      incrementRpgDailyStats(profile.rpg, now, {
        battles: 1,
        wins: battle.win ? 1 : 0,
        raids: battle.win ? 1 : 0
      });
      increaseRpgAreaProgress(profile.rpg, battle.area, battle.win ? 34 : 12);
      grantRpgClassMastery(profile, battle.win ? 40 : 14);
      for (const supportProfile of partyProfiles.slice(1)) {
        supportProfile.rpg.lastRaidAt = now;
      }

      if (battle.win) {
        profile.rpg.wins += 1;
        profile.rpg.raidClears[normalizedRaidId] = (profile.rpg.raidClears[normalizedRaidId] ?? 0) + 1;
        profile.rpg.monsterKills[battle.monster] = (profile.rpg.monsterKills[battle.monster] ?? 0) + 1;
        grantRpgInventoryItems(profile.rpg.inventory, materialDrops);
        gearDrop = addRpgGear(profile, rollRpgGearDrop({
          source: 'raid',
          area: battle.area,
          difficulty: 'hard',
          randomInt: this.randomInt
        }), now);
        rewardSettlement = settleRepeatableRpgRewards(profile, battle.rewards, this, now);

        for (const supportProfile of partyProfiles.slice(1)) {
          const supportRewardSettlement = settleRepeatableRpgRewards(
            supportProfile,
            battle.supportRewards,
            this,
            now
          );
          supportProfile.rpg.discoveredMonsters[battle.monster] = (supportProfile.rpg.discoveredMonsters[battle.monster] ?? 0) + 1;
          supportProfile.rpg.raidClears[normalizedRaidId] = (supportProfile.rpg.raidClears[normalizedRaidId] ?? 0) + 1;
          grantRpgClassMastery(supportProfile, 15);
          supportRewards.push({
            userId: supportProfile.userId,
            username: supportProfile.username,
            xpGained: battle.supportRewards.xp,
            coinReward: supportRewardSettlement.coinReward,
            requestedCoinReward: battle.supportRewards.coins,
            rpgGoldLimit: supportRewardSettlement.rpgGoldLimit,
            ...supportRewardSettlement.levelResult,
            profile: cloneProfile(supportProfile)
          });
        }
      } else {
        profile.rpg.losses += 1;
      }
      const ultimateCharge = settleRpgUltimateCharge(profile, {
        usedUltimate: battle.ultimate,
        chargeGain: battle.win ? 55 : 25
      });

      return {
        battled: true,
        battle,
        assets: battle.assets,
        gearDrop,
        materialDrops: labelRpgItemQuantities(materialDrops),
        supportRewards,
        xpGained: battle.rewards.xp,
        coinReward: rewardSettlement.coinReward,
        requestedCoinReward: battle.rewards.coins,
        rpgGoldLimit: rewardSettlement.rpgGoldLimit,
        ultimateCharge,
        ...rewardSettlement.levelResult,
        ...getRpgActionContext(profile, this, now),
        profile: cloneProfile(profile)
      };
    });
  }

  async getSwordStatus({ guildId, userId, username, now = Date.now() }) {
    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      const guild = getOrCreateGuildData(data, guildId);
      const successBonus = getActiveSwordSuccessBonus(guild, userId, now);
      resetSwordDailyState(profile.sword, now);
      const today = getDayIndex(now);

      return {
        profile: cloneProfile(profile),
        saleValue: getSwordSellValue(profile.sword.level),
        normalEnhance: applySwordSuccessBonus(getSwordEnhanceConfig(profile.sword.level), successBonus?.rate ?? 0),
        advancedEnhance: applySwordSuccessBonus(getAdvancedSwordEnhanceConfig(profile.sword.level), successBonus?.rate ?? 0),
        successBonus,
        giftAvailable: profile.sword.lastGiftDay !== today,
        giftRemainingMs: profile.sword.lastGiftDay === today ? getNextDayStartMs(now) - now : 0,
        battleRemaining: Math.max(0, MAX_DAILY_SWORD_BATTLES - profile.sword.battlesToday),
        battleStoneRemaining: Math.max(0, MAX_DAILY_SWORD_BATTLE_STONES - profile.sword.battleStonesToday)
      };
    });
  }

  async getSwordLeaderboard(guildId, category = 'highestLevel', limit = 10) {
    const normalizedCategory = normalizeSwordLeaderboardCategory(category);
    const safeLimit = Math.min(20, Math.max(1, Number(limit) || 10));

    return this.store.update((data) => {
      const userIds = getAccountUserIdsForGuild(data, guildId);
      if (userIds.length === 0) return [];

      return userIds
        .map((userId) => {
          const normalizedProfile = getOptionalProfileForGuild(data, guildId, userId, this);
          if (!normalizedProfile) return null;
          return {
            ...normalizedProfile,
            metric: normalizedProfile.sword[normalizedCategory] ?? 0
          };
        })
        .filter(Boolean)
        .filter((profile) => profile.metric > 0)
        .sort((a, b) => {
          if (b.metric !== a.metric) return b.metric - a.metric;
          if (b.sword.highestLevel !== a.sword.highestLevel) {
            return b.sword.highestLevel - a.sword.highestLevel;
          }
          if (b.level !== a.level) return b.level - a.level;
          return b.balance - a.balance;
        })
        .slice(0, safeLimit);
    });
  }

  async claimSwordGift({ guildId, userId, username, now = Date.now() }) {
    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      const today = getDayIndex(now);

      if (profile.sword.lastGiftDay === today) {
        return {
          claimed: false,
          remainingMs: getNextDayStartMs(now) - now,
          giftStones: 0,
          profile: cloneProfile(profile)
        };
      }

      profile.sword.refineStones += DAILY_SWORD_GIFT_STONES;
      profile.sword.lastGiftDay = today;

      return {
        claimed: true,
        giftStones: DAILY_SWORD_GIFT_STONES,
        profile: cloneProfile(profile)
      };
    });
  }

  async buySwordProtectionScrolls({ guildId, userId, username, quantity = 1, now = Date.now() }) {
    const normalizedQuantity = Math.min(10, normalizePositiveInteger(quantity, '보호권 수량'));
    const totalCost = SWORD_PROTECTION_SCROLL_COST * normalizedQuantity;

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      debitCurrency(
        profile,
        CURRENCY_SWORD,
        totalCost,
        `골드가 부족합니다. 필요 금액: ${totalCost.toLocaleString()}코인`
      );
      profile.sword.protectionScrolls += normalizedQuantity;

      return {
        quantity: normalizedQuantity,
        unitCost: SWORD_PROTECTION_SCROLL_COST,
        totalCost,
        profile: cloneProfile(profile),
        now
      };
    });
  }

  async getSwordAchievements({ guildId, userId, username, now = Date.now() }) {
    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      return buildSwordAchievementSummary(profile, now);
    });
  }

  async claimSwordAchievement({ guildId, userId, username, achievementId, now = Date.now() }) {
    const normalizedAchievementId = String(achievementId ?? '').trim();
    const achievement = SWORD_ACHIEVEMENTS.find((entry) => entry.id === normalizedAchievementId);
    if (!achievement) throw new Error('알 수 없는 검 업적입니다.');

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      const status = buildSwordAchievementStatus(profile, achievement);

      if (!status.complete) {
        throw new Error(`${achievement.title} 업적 조건을 아직 달성하지 못했습니다.`);
      }

      if (status.claimed) {
        throw new Error('이미 보상을 받은 검 업적입니다.');
      }

      applySwordAchievementRewards(profile, achievement.rewards);
      profile.sword.claimedAchievements[achievement.id] = now;

      return {
        achievement: buildSwordAchievementStatus(profile, achievement),
        rewards: achievement.rewards,
        profile: cloneProfile(profile)
      };
    });
  }

  async enhanceSword({ guildId, userId, username, now = Date.now() }) {
    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      const guild = getOrCreateGuildData(data, guildId);
      const successBonus = getActiveSwordSuccessBonus(guild, userId, now);
      let enhancement = resolveSwordEnhancement({
        level: profile.sword.level,
        mode: 'normal',
        randomInt: this.randomInt,
        successBonusRate: successBonus?.rate ?? 0
      });

      debitCurrency(
        profile,
        CURRENCY_SWORD,
        enhancement.moneyCost,
        `골드가 부족합니다. 필요 금액: ${enhancement.moneyCost.toLocaleString()}코인`
      );
      if (enhancement.outcome === 'destroy' && profile.sword.protectionScrolls > 0) {
        profile.sword.protectionScrolls -= 1;
        enhancement = {
          ...enhancement,
          afterLevel: enhancement.beforeLevel,
          levelGain: 0,
          outcome: 'protect',
          outcomeLabel: '보호',
          originalOutcome: 'destroy',
          protected: true,
          refineStoneReward: 0
        };
      }
      applySwordEnhancement(profile, enhancement, now, 'normal');
      const triggeredSuccessBonus = enhancement.outcome === 'destroy'
        ? activateSwordSuccessBonus(guild, profile, now, this.randomInt)
        : null;

      return {
        ...enhancement,
        successBonus,
        triggeredSuccessBonus,
        profile: cloneProfile(profile)
      };
    });
  }

  async advancedEnhanceSword({ guildId, userId, username, now = Date.now() }) {
    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      const guild = getOrCreateGuildData(data, guildId);
      const successBonus = getActiveSwordSuccessBonus(guild, userId, now);
      const enhancement = resolveSwordEnhancement({
        level: profile.sword.level,
        mode: 'advanced',
        randomInt: this.randomInt,
        successBonusRate: successBonus?.rate ?? 0
      });

      if (getCurrencyBalance(profile, CURRENCY_SWORD) < enhancement.moneyCost) {
        throw new Error(`골드가 부족합니다. 필요 금액: ${enhancement.moneyCost.toLocaleString()}골드`);
      }

      if (profile.sword.refineStones < enhancement.stoneCost) {
        throw new Error(`제련석이 부족합니다. 필요 제련석: ${enhancement.stoneCost.toLocaleString()}개`);
      }

      debitCurrency(profile, CURRENCY_SWORD, enhancement.moneyCost);
      profile.sword.refineStones -= enhancement.stoneCost;
      applySwordEnhancement(profile, enhancement, now, 'advanced');

      return {
        ...enhancement,
        successBonus,
        triggeredSuccessBonus: null,
        profile: cloneProfile(profile)
      };
    });
  }

  async sellSword({ guildId, userId, username, now = Date.now() }) {
    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      const beforeLevel = profile.sword.level;
      const saleValue = getSwordSellValue(beforeLevel);

      if (saleValue <= 0) {
        throw new Error('판매할 검이 없습니다. +1 이상 강화된 검만 판매할 수 있습니다.');
      }

      creditCurrency(profile, CURRENCY_SWORD, saleValue);
      profile.sword.level = 0;
      profile.sword.soldCount += 1;
      profile.sword.saleEarnings += saleValue;
      profile.sword.lastSoldAt = now;

      return {
        beforeLevel,
        saleValue,
        profile: cloneProfile(profile)
      };
    });
  }

  async playSwordRandomBattle({ guildId, userId, username, now = Date.now() }) {
    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      resetSwordDailyState(profile.sword, now);

      if (profile.sword.battlesToday >= MAX_DAILY_SWORD_BATTLES) {
        return {
          battled: false,
          reason: 'daily_limit',
          remainingBattles: 0,
          profile: cloneProfile(profile)
        };
      }

      const opponent = selectRandomSwordOpponentProfile({
        data,
        guildId,
        challengerUserId: userId,
        randomInt: this.randomInt,
        economy: this
      });
      const battle = resolveSwordBattleResult({
        challengerProfile: profile,
        opponentProfile: opponent,
        randomInt: this.randomInt
      });
      const levelResult = {
        leveledUp: false,
        levelsGained: 0,
        levelReward: 0
      };
      const rewards = {
        xp: 0,
        money: 0,
        refineStones: 0
      };

      profile.sword.battlesToday += 1;
      profile.sword.lastBattleAt = now;

      if (battle.winnerSide === 'challenger') {
        profile.sword.battleWins += 1;
        creditCurrency(profile, CURRENCY_SWORD, battle.rewards.money);
        Object.assign(levelResult, addXp(profile, battle.rewards.xp, this));
        rewards.xp = battle.rewards.xp;
        rewards.money = battle.rewards.money;
        rewards.refineStones = grantSwordBattleStones(profile.sword, now, battle.rewards.refineStones);
      } else {
        profile.sword.battleLosses += 1;
      }

      return {
        battled: true,
        type: 'random',
        won: battle.winnerSide === 'challenger',
        battle,
        opponent,
        rewards,
        remainingBattles: Math.max(0, MAX_DAILY_SWORD_BATTLES - profile.sword.battlesToday),
        ...levelResult,
        profile: cloneProfile(profile)
      };
    });
  }

  async playSwordPvpBattle({ guildId, challenger, opponent, now = Date.now() }) {
    if (challenger.userId === opponent.userId) {
      throw new Error('자기 자신과는 검배틀을 할 수 없습니다.');
    }

    return this.store.update((data) => {
      const challengerProfile = getOrCreateProfile(data, guildId, challenger.userId, challenger.username, this);
      const opponentProfile = getOrCreateProfile(data, guildId, opponent.userId, opponent.username, this);
      resetSwordDailyState(challengerProfile.sword, now);
      resetSwordDailyState(opponentProfile.sword, now);
      assertSwordBattleAvailable(challengerProfile);
      assertSwordBattleAvailable(opponentProfile);

      const battle = resolveSwordBattleResult({
        challengerProfile,
        opponentProfile,
        randomInt: this.randomInt
      });
      const winnerProfile = battle.winnerSide === 'challenger'
        ? challengerProfile
        : opponentProfile;
      const loserProfile = battle.winnerSide === 'challenger'
        ? opponentProfile
        : challengerProfile;
      const levelResult = {
        leveledUp: false,
        levelsGained: 0,
        levelReward: 0
      };

      challengerProfile.sword.battlesToday += 1;
      opponentProfile.sword.battlesToday += 1;
      challengerProfile.sword.lastBattleAt = now;
      opponentProfile.sword.lastBattleAt = now;
      winnerProfile.sword.battleWins += 1;
      loserProfile.sword.battleLosses += 1;
      creditCurrency(winnerProfile, CURRENCY_SWORD, battle.rewards.money);
      Object.assign(levelResult, addXp(winnerProfile, battle.rewards.xp, this));
      const refineStones = grantSwordBattleStones(winnerProfile.sword, now, battle.rewards.refineStones);

      return {
        battled: true,
        type: 'pvp',
        battle,
        winnerUserId: winnerProfile.userId,
        loserUserId: loserProfile.userId,
        rewards: {
          xp: battle.rewards.xp,
          money: battle.rewards.money,
          refineStones
        },
        remainingBattles: {
          challenger: Math.max(0, MAX_DAILY_SWORD_BATTLES - challengerProfile.sword.battlesToday),
          opponent: Math.max(0, MAX_DAILY_SWORD_BATTLES - opponentProfile.sword.battlesToday)
        },
        ...levelResult,
        challenger: cloneProfile(challengerProfile),
        opponent: cloneProfile(opponentProfile)
      };
    });
  }

  async awardActivityXp({ guildId, userId, username, xp, source = '활동' }) {
    const normalizedXp = normalizeNonNegativeInteger(xp, '경험치');

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      const levelResult = addXp(profile, normalizedXp, this);

      return {
        source,
        xpGained: normalizedXp,
        ...levelResult,
        profile: cloneProfile(profile)
      };
    });
  }

  async transfer({ guildId, fromUserId, fromUsername, toUserId, toUsername, amount }) {
    const normalizedAmount = Number(amount);

    if (!Number.isSafeInteger(normalizedAmount) || normalizedAmount <= 0) {
      throw new Error('송금액은 1 이상의 정수여야 합니다.');
    }

    if (fromUserId === toUserId) {
      throw new Error('자기 자신에게는 송금할 수 없습니다.');
    }

    return this.store.update((data) => {
      const from = getOrCreateProfile(data, guildId, fromUserId, fromUsername, this);
      const to = getOrCreateProfile(data, guildId, toUserId, toUsername, this);

      if (from.balance < normalizedAmount) {
        throw new Error('잔액이 부족합니다.');
      }

      from.balance -= normalizedAmount;
      creditCurrency(to, CURRENCY_MAIN, normalizedAmount);

      return {
        amount: normalizedAmount,
        from: cloneProfile(from),
        to: cloneProfile(to)
      };
    });
  }

  async settleWager({ guildId, userId, username, bet, payout }) {
    const normalizedBet = normalizePositiveInteger(bet, '베팅액');
    const normalizedPayout = normalizeNonNegativeInteger(payout, '지급액');

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      const modifier = getRpgCasinoSettlementModifier(profile);
      const adjusted = applyRpgCasinoSettlementModifier({
        bet: normalizedBet,
        payout: normalizedPayout,
        modifier
      });

      debitCurrency(profile, CURRENCY_CASINO, adjusted.bet, '골드가 부족합니다.');
      creditCurrency(profile, CURRENCY_CASINO, adjusted.payout);

      return {
        bet: adjusted.bet,
        payout: adjusted.payout,
        profit: adjusted.payout - adjusted.bet,
        baseBet: normalizedBet,
        basePayout: normalizedPayout,
        baseProfit: normalizedPayout - normalizedBet,
        rpgCasinoModifier: modifier.applied ? modifier : null,
        profile: cloneProfile(profile)
      };
    });
  }

  async reserveWager({ guildId, userId, username, bet }) {
    const normalizedBet = normalizePositiveInteger(bet, '베팅액');

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);

      debitCurrency(profile, CURRENCY_CASINO, normalizedBet, '골드가 부족합니다.');

      return {
        bet: normalizedBet,
        profile: cloneProfile(profile)
      };
    });
  }

  async resolveReservedWager({ guildId, userId, username, bet, payout }) {
    const normalizedBet = normalizePositiveInteger(bet, '베팅액');
    const normalizedPayout = normalizeNonNegativeInteger(payout, '지급액');

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      const modifier = getRpgCasinoSettlementModifier(profile);
      const adjusted = applyRpgCasinoSettlementModifier({
        bet: normalizedBet,
        payout: normalizedPayout,
        modifier
      });
      const extraReservedLoss = Math.max(0, adjusted.bet - normalizedBet);

      if (extraReservedLoss > 0) {
        debitCurrency(profile, CURRENCY_CASINO, extraReservedLoss, '골드가 부족합니다.');
      }
      creditCurrency(profile, CURRENCY_CASINO, adjusted.payout);

      return {
        bet: adjusted.bet,
        payout: adjusted.payout,
        profit: adjusted.payout - adjusted.bet,
        baseBet: normalizedBet,
        basePayout: normalizedPayout,
        baseProfit: normalizedPayout - normalizedBet,
        rpgCasinoModifier: modifier.applied ? modifier : null,
        profile: cloneProfile(profile)
      };
    });
  }

  async refundReservedWager({ guildId, userId, username, bet }) {
    return this.resolveReservedWager({
      guildId,
      userId,
      username,
      bet,
      payout: bet
    });
  }

  async reservePlayerPot({ guildId, challenger, opponent, bet }) {
    const normalizedBet = normalizePositiveInteger(bet, '베팅액');

    if (challenger.userId === opponent.userId) {
      throw new Error('자기 자신과는 대결할 수 없습니다.');
    }

    return this.store.update((data) => {
      const challengerProfile = getOrCreateProfile(data, guildId, challenger.userId, challenger.username, this);
      const opponentProfile = getOrCreateProfile(data, guildId, opponent.userId, opponent.username, this);

      if (getCurrencyBalance(challengerProfile, CURRENCY_CASINO) < normalizedBet) {
        throw new Error(`${challengerProfile.username}님의 골드가 부족합니다.`);
      }

      if (getCurrencyBalance(opponentProfile, CURRENCY_CASINO) < normalizedBet) {
        throw new Error(`${opponentProfile.username}님의 골드가 부족합니다.`);
      }

      debitCurrency(challengerProfile, CURRENCY_CASINO, normalizedBet);
      debitCurrency(opponentProfile, CURRENCY_CASINO, normalizedBet);

      return {
        bet: normalizedBet,
        pot: normalizedBet * 2,
        challenger: cloneProfile(challengerProfile),
        opponent: cloneProfile(opponentProfile)
      };
    });
  }

  async resolveReservedPlayerPot({ guildId, challenger, opponent, bet, winnerUserId }) {
    const normalizedBet = normalizePositiveInteger(bet, '베팅액');

    return this.store.update((data) => {
      const challengerProfile = getOrCreateProfile(data, guildId, challenger.userId, challenger.username, this);
      const opponentProfile = getOrCreateProfile(data, guildId, opponent.userId, opponent.username, this);
      const pot = normalizedBet * 2;

      if (!winnerUserId) {
        creditCurrency(challengerProfile, CURRENCY_CASINO, normalizedBet);
        creditCurrency(opponentProfile, CURRENCY_CASINO, normalizedBet);

        return {
          bet: normalizedBet,
          pot,
          winner: null,
          challenger: cloneProfile(challengerProfile),
          opponent: cloneProfile(opponentProfile)
        };
      }

      if (![challenger.userId, opponent.userId].includes(winnerUserId)) {
        throw new Error('승자는 대결 참여자 중 한 명이어야 합니다.');
      }

      const winnerProfile = winnerUserId === challenger.userId
        ? challengerProfile
        : opponentProfile;
      creditCurrency(winnerProfile, CURRENCY_CASINO, pot);

      return {
        bet: normalizedBet,
        pot,
        winner: cloneProfile(winnerProfile),
        challenger: cloneProfile(challengerProfile),
        opponent: cloneProfile(opponentProfile)
      };
    });
  }

  async settlePlayerPot({ guildId, challenger, opponent, bet, winnerUserId }) {
    const normalizedBet = normalizePositiveInteger(bet, '베팅액');

    if (challenger.userId === opponent.userId) {
      throw new Error('자기 자신과는 대결할 수 없습니다.');
    }

    return this.store.update((data) => {
      const challengerProfile = getOrCreateProfile(data, guildId, challenger.userId, challenger.username, this);
      const opponentProfile = getOrCreateProfile(data, guildId, opponent.userId, opponent.username, this);

      if (getCurrencyBalance(challengerProfile, CURRENCY_CASINO) < normalizedBet) {
        throw new Error(`${challengerProfile.username}님의 골드가 부족합니다.`);
      }

      if (getCurrencyBalance(opponentProfile, CURRENCY_CASINO) < normalizedBet) {
        throw new Error(`${opponentProfile.username}님의 골드가 부족합니다.`);
      }

      if (!winnerUserId) {
        return {
          bet: normalizedBet,
          pot: normalizedBet * 2,
          winner: null,
          challenger: cloneProfile(challengerProfile),
          opponent: cloneProfile(opponentProfile)
        };
      }

      if (![challenger.userId, opponent.userId].includes(winnerUserId)) {
        throw new Error('승자는 대결 참여자 중 한 명이어야 합니다.');
      }

      debitCurrency(challengerProfile, CURRENCY_CASINO, normalizedBet);
      debitCurrency(opponentProfile, CURRENCY_CASINO, normalizedBet);

      const winnerProfile = winnerUserId === challenger.userId
        ? challengerProfile
        : opponentProfile;
      creditCurrency(winnerProfile, CURRENCY_CASINO, normalizedBet * 2);

      return {
        bet: normalizedBet,
        pot: normalizedBet * 2,
        winner: cloneProfile(winnerProfile),
        challenger: cloneProfile(challengerProfile),
        opponent: cloneProfile(opponentProfile)
      };
    });
  }

  async getLeaderboard(guildId, limit = 10) {
    return this.store.update((data) => {
      const userIds = getAccountUserIdsForGuild(data, guildId);
      if (userIds.length === 0) return [];

      return userIds
        .map((userId) => getOptionalProfileForGuild(data, guildId, userId, this))
        .filter(Boolean)
        .sort((a, b) => {
          if (b.level !== a.level) return b.level - a.level;
          if (b.totalXp !== a.totalXp) return b.totalXp - a.totalXp;
          return b.balance - a.balance;
        })
        .slice(0, limit);
    });
  }
}

function normalizePositiveInteger(value, label) {
  const normalized = Number(value);

  if (!Number.isSafeInteger(normalized) || normalized <= 0) {
    throw new Error(`${label}은 1 이상의 정수여야 합니다.`);
  }

  return normalized;
}

function normalizeNonNegativeInteger(value, label) {
  const normalized = Number(value);

  if (!Number.isSafeInteger(normalized) || normalized < 0) {
    throw new Error(`${label}은 0 이상의 정수여야 합니다.`);
  }

  return normalized;
}

function normalizeSwordLeaderboardCategory(category) {
  const normalized = String(category || 'highestLevel');
  if (['highestLevel', 'saleEarnings', 'destructions'].includes(normalized)) {
    return normalized;
  }

  return 'highestLevel';
}

function normalizeWordChainParticipants(participants) {
  if (!Array.isArray(participants)) {
    throw new Error('끝말잇기 참가자 목록이 필요합니다.');
  }

  const uniqueParticipants = new Map();

  for (const participant of participants) {
    if (!participant?.userId) {
      throw new Error('끝말잇기 참가자 userId가 필요합니다.');
    }

    if (!uniqueParticipants.has(participant.userId)) {
      uniqueParticipants.set(participant.userId, {
        userId: participant.userId,
        username: participant.username || 'Unknown'
      });
    }
  }

  return [...uniqueParticipants.values()];
}

function normalizeLiarGameParticipants(participants) {
  if (!Array.isArray(participants)) {
    throw new Error('라이어게임 참가자 목록이 필요합니다.');
  }

  const uniqueParticipants = new Map();

  for (const participant of participants) {
    if (!participant?.userId) {
      throw new Error('라이어게임 참가자 userId가 필요합니다.');
    }

    if (!uniqueParticipants.has(participant.userId)) {
      uniqueParticipants.set(participant.userId, {
        userId: participant.userId,
        username: participant.username || 'Unknown'
      });
    }
  }

  return [...uniqueParticipants.values()];
}

function getLiarGameXp(options, winner, isLiar) {
  if (winner === 'liar') {
    return isLiar ? options.liarGameLiarWinXp : options.liarGameCitizenLoseXp;
  }

  return isLiar ? options.liarGameLiarLoseXp : options.liarGameCitizenWinXp;
}

function getLiarGameMoney(options, winner, isLiar) {
  if (winner === 'liar') {
    return isLiar ? options.liarGameLiarWinMoney : 0;
  }

  return isLiar ? 0 : options.liarGameCitizenWinMoney;
}

function rewardMessageProfile(profile, economy, now) {
  const elapsed = now - profile.lastMessageRewardAt;

  if (profile.lastMessageRewardAt > 0 && elapsed < economy.options.messageCooldownMs) {
    return {
      awarded: false,
      remainingMs: economy.options.messageCooldownMs - elapsed,
      profile: cloneProfile(profile)
    };
  }

  const xpGained = economy.randomInt(economy.options.messageXpMin, economy.options.messageXpMax);
  const today = getDayIndex(now);
  const firstMessageBonusXp = profile.lastFirstMessageBonusDay === today
    ? 0
    : economy.options.firstMessageXpBonus;
  const totalXpGained = xpGained + firstMessageBonusXp;
  const levelResult = addXp(profile, totalXpGained, economy);

  profile.lastMessageRewardAt = now;
  if (firstMessageBonusXp > 0) {
    profile.lastFirstMessageBonusDay = today;
  }

  return {
    awarded: true,
    xpGained,
    firstMessageBonusXp,
    totalXpGained,
    moneyGained: 0,
    ...levelResult,
    profile: cloneProfile(profile)
  };
}

function rewardCommandProfile(profile, economy, commandName = '명령어') {
  const xpGained = economy.randomInt(economy.options.commandXpMin, economy.options.commandXpMax);
  const levelResult = addXp(profile, xpGained, economy);

  return {
    awarded: true,
    source: `/${String(commandName || '명령어')}`,
    commandName: String(commandName || '명령어'),
    xpGained,
    totalXpGained: xpGained,
    moneyGained: 0,
    ...levelResult,
    profile: cloneProfile(profile)
  };
}

function grantXpProfile(profile, economy, { xp, source = '경험치' }) {
  const xpGained = normalizeStoredNonNegativeInteger(xp);
  const levelResult = addXp(profile, xpGained, economy);

  return {
    awarded: xpGained > 0,
    source: String(source || '경험치'),
    xpGained,
    totalXpGained: xpGained,
    moneyGained: 0,
    ...levelResult,
    profile: cloneProfile(profile)
  };
}

function getOrCreateProfile(data, guildId, userId, username, economy, now = Date.now()) {
  const profile = getOrCreateLinkedAccountProfile(data, {
    guildId,
    userId,
    username,
    now,
    createDefaultProfile: createDefaultEconomyProfile
  });
  return normalizeEconomyProfile(profile, userId, username, economy, now);
}

function normalizeEconomyProfile(profile, userId, username, economy, now = Date.now()) {
  profile.userId = String(userId ?? '').trim();
  profile.username = username || profile.username || 'Unknown';
  profile.level = normalizeStoredPositiveInteger(profile.level, 1);
  profile.xp = normalizeStoredNonNegativeInteger(profile.xp);
  profile.totalXp = normalizeStoredNonNegativeInteger(profile.totalXp);
  profile.balance = normalizeStoredNonNegativeInteger(profile.balance);
  migrateLegacyWalletsToGold(profile);
  profile.wallets = normalizeWallets(profile.wallets);
  profile.lastMessageRewardAt = normalizeStoredNonNegativeInteger(profile.lastMessageRewardAt);
  profile.lastDailyAt = normalizeStoredNonNegativeInteger(profile.lastDailyAt);
  profile.lastDailyDay = profile.lastDailyDay ?? (profile.lastDailyAt > 0
    ? getDayIndex(profile.lastDailyAt)
    : null);
  profile.lastDailyDay = normalizeStoredNullableInteger(profile.lastDailyDay);
  profile.dailyStreak = normalizeStoredNonNegativeInteger(profile.dailyStreak);
  profile.lastFirstMessageBonusDay = normalizeStoredNullableInteger(profile.lastFirstMessageBonusDay);
  profile.lastFortuneXpDay = normalizeStoredNullableInteger(profile.lastFortuneXpDay);
  profile.rpg = normalizeRpgStats(profile.rpg, profile.level, now);
  profile.sword = normalizeSwordStats(profile.sword);
  profile.createdAt = normalizeStoredNonNegativeInteger(profile.createdAt) || now;
  reconcileProfileProgress(profile, economy);

  return profile;
}

function createDefaultEconomyProfile(userId, username, now = Date.now()) {
  return {
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
    lastFortuneXpDay: null,
    rpg: createDefaultRpgStats(),
    sword: createDefaultSwordStats(),
    createdAt: now
  };
}

function getOptionalProfileForGuild(data, guildId, userId, economy) {
  try {
    return cloneProfile(getOrCreateProfile(
      data,
      guildId,
      userId,
      getLinkedAccountUsername(data, userId),
      economy
    ));
  } catch (error) {
    if (isAccountSelectionRequiredError(error)) return null;
    throw error;
  }
}

function getOptionalMutableProfileForGuild(data, guildId, userId, economy) {
  try {
    return getOrCreateProfile(
      data,
      guildId,
      userId,
      getLinkedAccountUsername(data, userId),
      economy
    );
  } catch (error) {
    if (isAccountSelectionRequiredError(error)) return null;
    throw error;
  }
}

function cloneProfile(profile) {
  return {
    userId: profile.userId,
    username: profile.username,
    level: profile.level,
    xp: profile.xp,
    totalXp: profile.totalXp,
    balance: profile.balance,
    bankruptcy: getStockBankruptcySummary(profile),
    wallets: cloneWallets(profile.wallets),
    currencyBalances: getCurrencyBalances(profile),
    currencyMigration: structuredClone(profile.currencyMigration ?? null),
    lastMessageRewardAt: profile.lastMessageRewardAt,
    lastDailyAt: profile.lastDailyAt,
    lastDailyDay: profile.lastDailyDay,
    dailyStreak: profile.dailyStreak,
    lastFirstMessageBonusDay: profile.lastFirstMessageBonusDay,
    lastFortuneXpDay: profile.lastFortuneXpDay,
    community: cloneProfileCommunity(profile.community),
    rpg: cloneRpgStats(profile.rpg),
    sword: cloneSwordStats(profile.sword),
    createdAt: profile.createdAt
  };
}

function cloneProfileCommunity(community) {
  if (!community || typeof community !== 'object') return null;

  return {
    stats: community.stats && typeof community.stats === 'object'
      ? { ...community.stats }
      : null,
    ownedTitles: Array.isArray(community.ownedTitles)
      ? [...community.ownedTitles]
      : [],
    equippedTitle: community.equippedTitle ?? null,
    cosmetics: {
      badges: Array.isArray(community.cosmetics?.badges)
        ? [...community.cosmetics.badges]
        : []
    }
  };
}


function cloneSwordStats(sword) {
  return {
    ...sword,
    claimedAchievements: { ...(sword.claimedAchievements ?? {}) }
  };
}

function cloneRpgStats(rpg) {
  return {
    ...rpg,
    unlockedAreas: [...rpg.unlockedAreas],
    unlockedClasses: [...rpg.unlockedClasses],
    inventory: { ...rpg.inventory },
    equipment: { ...rpg.equipment },
    gearInventory: cloneGearInventory(rpg.gearInventory),
    equippedGear: { ...rpg.equippedGear },
    learnedSkills: [...rpg.learnedSkills],
    discoveredMonsters: { ...rpg.discoveredMonsters },
    monsterKills: { ...rpg.monsterKills },
    areaWins: { ...rpg.areaWins },
    bossKills: { ...rpg.bossKills },
    claimedQuests: { ...rpg.claimedQuests },
    storyChapters: { ...rpg.storyChapters },
    codexClaims: { ...rpg.codexClaims },
    tutorial: {
      ...rpg.tutorial,
      claimedSteps: { ...(rpg.tutorial?.claimedSteps ?? {}) }
    },
    dungeonClears: { ...rpg.dungeonClears },
    raidClears: { ...rpg.raidClears },
    areaProgress: { ...rpg.areaProgress },
    classMastery: cloneClassMastery(rpg.classMastery),
    craftingMastery: cloneClassMastery(rpg.craftingMastery),
    craftingLog: Array.isArray(rpg.craftingLog) ? rpg.craftingLog.map((entry) => ({ ...entry })) : [],
    dungeonRun: cloneRpgDungeonRun(rpg.dungeonRun),
    gacha: { ...rpg.gacha },
    daily: {
      ...rpg.daily,
      claimedMissions: { ...(rpg.daily?.claimedMissions ?? {}) }
    }
  };
}

function cloneGearInventory(gearInventory = {}) {
  return Object.fromEntries(
    Object.entries(gearInventory).map(([gearId, gear]) => [gearId, {
      ...gear,
      stats: { ...gear.stats }
    }])
  );
}

function cloneClassMastery(classMastery = {}) {
  return Object.fromEntries(
    Object.entries(classMastery).map(([classId, mastery]) => [classId, { ...mastery }])
  );
}

function cloneRpgDungeonRun(run) {
  if (!run || typeof run !== 'object') return null;
  return {
    ...run,
    relics: Array.isArray(run.relics) ? run.relics.map((relic) => ({ ...relic, modifiers: { ...(relic.modifiers ?? {}) } })) : [],
    modifiers: { ...(run.modifiers ?? {}) },
    currentChoices: Array.isArray(run.currentChoices) ? run.currentChoices.map((choice) => ({ ...choice })) : [],
    pendingRelicChoices: Array.isArray(run.pendingRelicChoices) ? run.pendingRelicChoices.map((relic) => ({ ...relic, modifiers: { ...(relic.modifiers ?? {}) } })) : [],
    rewardPool: { ...(run.rewardPool ?? {}), items: { ...(run.rewardPool?.items ?? {}) } },
    log: Array.isArray(run.log) ? [...run.log] : [],
    lastRoomResult: run.lastRoomResult ? { ...run.lastRoomResult, rewards: { ...(run.lastRoomResult.rewards ?? {}) } } : null
  };
}

function addXp(profile, xp, economy, options = {}) {
  const beforeLevel = profile.level;
  let levelReward = 0;
  let levelRewardRequested = 0;
  let levelRewardCapped = false;
  const grantLevelReward = typeof options.grantLevelReward === 'function'
    ? options.grantLevelReward
    : null;

  profile.xp += xp;
  profile.totalXp += xp;

  while (profile.xp >= economy.xpForNextLevel(profile.level)) {
    profile.xp -= economy.xpForNextLevel(profile.level);
    profile.level += 1;
    const reward = getLevelReward(profile.level);
    levelRewardRequested += reward;

    if (grantLevelReward) {
      const grant = grantLevelReward(reward);
      const grantedReward = normalizeStoredNonNegativeInteger(grant?.granted);
      levelReward += grantedReward;
      levelRewardCapped = levelRewardCapped || grantedReward < reward;
    } else {
      levelReward += reward;
      creditCurrency(profile, CURRENCY_MAIN, reward);
    }
  }

  if (profile.rpg) {
    profile.rpg = normalizeRpgStats(profile.rpg, profile.level);
  }

  return {
    leveledUp: profile.level > beforeLevel,
    levelsGained: profile.level - beforeLevel,
    levelReward,
    levelRewardRequested,
    levelRewardCapped
  };
}

function getStreakBonuses(streak, configuredBonuses) {
  return Object.entries(configuredBonuses)
    .map(([days, xp]) => ({ days: Number(days), xp }))
    .filter((bonus) => streak > 0 && streak % bonus.days === 0)
    .sort((a, b) => a.days - b.days);
}

function getDailyCoinReward(service) {
  if (service.options.dailyCoinReward !== undefined && service.options.dailyCoinReward !== null) {
    return Math.max(0, Math.floor(Number(service.options.dailyCoinReward)));
  }

  const min = normalizeRewardBound(service.options.dailyCoinRewardMin, 1);
  const max = Math.max(min, normalizeRewardBound(service.options.dailyCoinRewardMax, 1000));
  return service.randomInt(min, max);
}

function normalizeRewardBound(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.max(1, Math.floor(number))
    : fallback;
}

function getDayIndex(now, dayOffsetMs = 0) {
  return Math.floor((now + dayOffsetMs) / DAY_MS);
}

function getNextDayStartMs(now, dayOffsetMs = 0) {
  return (getDayIndex(now, dayOffsetMs) + 1) * DAY_MS - dayOffsetMs;
}

function getLevelReward(level) {
  return level * 100;
}


function createDefaultSwordStats() {
  return {
    level: 0,
    highestLevel: 0,
    refineStones: 0,
    normalAttempts: 0,
    advancedAttempts: 0,
    successes: 0,
    maintains: 0,
    destructions: 0,
    battleWins: 0,
    battleLosses: 0,
    battleDay: null,
    battlesToday: 0,
    battleStoneDay: null,
    battleStonesToday: 0,
    lastGiftDay: null,
    lastEnhancedAt: 0,
    protectionScrolls: 0,
    protectedDestructions: 0,
    claimedAchievements: {},
    lastBattleAt: 0,
    soldCount: 0,
    saleEarnings: 0,
    lastSoldAt: 0
  };
}

function normalizeSwordStats(stats = {}) {
  const safeStats = stats && typeof stats === 'object' ? stats : {};
  const level = clampStoredInteger(safeStats.level, 0, MAX_SWORD_LEVEL);
  const highestLevel = Math.max(level, clampStoredInteger(safeStats.highestLevel, 0, MAX_SWORD_LEVEL));

  return {
    ...createDefaultSwordStats(),
    ...safeStats,
    level,
    highestLevel,
    refineStones: normalizeStoredNonNegativeInteger(safeStats.refineStones),
    normalAttempts: normalizeStoredNonNegativeInteger(safeStats.normalAttempts),
    advancedAttempts: normalizeStoredNonNegativeInteger(safeStats.advancedAttempts),
    successes: normalizeStoredNonNegativeInteger(safeStats.successes),
    maintains: normalizeStoredNonNegativeInteger(safeStats.maintains),
    destructions: normalizeStoredNonNegativeInteger(safeStats.destructions),
    battleWins: normalizeStoredNonNegativeInteger(safeStats.battleWins),
    battleLosses: normalizeStoredNonNegativeInteger(safeStats.battleLosses),
    battleDay: normalizeStoredNullableInteger(safeStats.battleDay),
    battlesToday: normalizeStoredNonNegativeInteger(safeStats.battlesToday),
    battleStoneDay: normalizeStoredNullableInteger(safeStats.battleStoneDay),
    battleStonesToday: normalizeStoredNonNegativeInteger(safeStats.battleStonesToday),
    lastGiftDay: normalizeStoredNullableInteger(safeStats.lastGiftDay),
    lastEnhancedAt: normalizeStoredNonNegativeInteger(safeStats.lastEnhancedAt),
    protectionScrolls: normalizeStoredNonNegativeInteger(safeStats.protectionScrolls),
    protectedDestructions: normalizeStoredNonNegativeInteger(safeStats.protectedDestructions),
    claimedAchievements: normalizeSwordClaimedAchievements(safeStats.claimedAchievements),
    lastBattleAt: normalizeStoredNonNegativeInteger(safeStats.lastBattleAt),
    soldCount: normalizeStoredNonNegativeInteger(safeStats.soldCount),
    saleEarnings: normalizeStoredNonNegativeInteger(safeStats.saleEarnings),
    lastSoldAt: normalizeStoredNonNegativeInteger(safeStats.lastSoldAt)
  };
}

function normalizeSwordClaimedAchievements(claimedAchievements = {}) {
  const safeClaimed = claimedAchievements && typeof claimedAchievements === 'object'
    ? claimedAchievements
    : {};

  return Object.fromEntries(
    Object.entries(safeClaimed)
      .filter(([achievementId]) => SWORD_ACHIEVEMENTS.some((achievement) => achievement.id === achievementId))
      .map(([achievementId, claimedAt]) => [achievementId, normalizeStoredNonNegativeInteger(claimedAt)])
  );
}

function buildSwordAchievementSummary(profile, now = Date.now()) {
  return {
    now,
    achievements: SWORD_ACHIEVEMENTS.map((achievement) =>
      buildSwordAchievementStatus(profile, achievement)
    )
  };
}

function buildSwordAchievementStatus(profile, achievement) {
  const sword = profile.sword;
  const complete = Boolean(achievement.isComplete(sword));
  const claimedAt = sword.claimedAchievements[achievement.id] ?? 0;

  return {
    id: achievement.id,
    title: achievement.title,
    description: achievement.description,
    complete,
    claimed: claimedAt > 0,
    claimedAt,
    progressText: achievement.getProgressText(sword),
    rewards: achievement.rewards,
    rewardText: formatSwordAchievementRewardText(achievement.rewards)
  };
}

function applySwordAchievementRewards(profile, rewards) {
  if (rewards.swordCoins > 0) {
    creditCurrency(profile, CURRENCY_SWORD, rewards.swordCoins);
  }
  profile.sword.refineStones += rewards.refineStones;
  profile.sword.protectionScrolls += rewards.protectionScrolls;
}

function formatSwordAchievementRewardText(rewards) {
  const parts = [];
  if (rewards.swordCoins > 0) parts.push(`${rewards.swordCoins.toLocaleString()}골드`);
  if (rewards.refineStones > 0) parts.push(`제련석 ${rewards.refineStones.toLocaleString()}개`);
  if (rewards.protectionScrolls > 0) parts.push(`보호권 ${rewards.protectionScrolls.toLocaleString()}개`);
  return parts.join(', ') || '보상 없음';
}

function applySwordEnhancement(profile, enhancement, now, mode) {
  profile.sword.level = enhancement.afterLevel;
  profile.sword.highestLevel = Math.max(profile.sword.highestLevel, enhancement.afterLevel);
  profile.sword.lastEnhancedAt = now;

  if (mode === 'advanced') {
    profile.sword.advancedAttempts += 1;
  } else {
    profile.sword.normalAttempts += 1;
  }

  if (enhancement.outcome === 'success') {
    profile.sword.successes += 1;
    return;
  }

  if (enhancement.outcome === 'destroy') {
    profile.sword.destructions += 1;
    profile.sword.refineStones += enhancement.refineStoneReward;
    return;
  }

  if (enhancement.outcome === 'protect') {
    profile.sword.protectedDestructions += 1;
    return;
  }

  profile.sword.maintains += 1;
}

function resetSwordDailyState(sword, now) {
  const today = getDayIndex(now);

  if (sword.battleDay !== today) {
    sword.battleDay = today;
    sword.battlesToday = 0;
  }

  if (sword.battleStoneDay !== today) {
    sword.battleStoneDay = today;
    sword.battleStonesToday = 0;
  }
}

function assertSwordBattleAvailable(profile) {
  if (profile.sword.battlesToday >= MAX_DAILY_SWORD_BATTLES) {
    throw new Error(`${profile.username}님은 오늘 검배틀 ${MAX_DAILY_SWORD_BATTLES}회를 모두 사용했습니다.`);
  }
}

function grantSwordBattleStones(sword, now, amount) {
  resetSwordDailyState(sword, now);
  const remaining = Math.max(0, MAX_DAILY_SWORD_BATTLE_STONES - sword.battleStonesToday);
  const granted = Math.min(remaining, Math.max(0, Number(amount) || 0));

  if (granted > 0) {
    sword.refineStones += granted;
    sword.battleStonesToday += granted;
  }

  return granted;
}

function clampStoredInteger(value, min, max) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized)) return min;
  return Math.min(max, Math.max(min, normalized));
}

function createDefaultRpgStats() {
  return {
    schemaVersion: RPG_SCHEMA_VERSION,
    level: 1,
    xp: 0,
    totalXp: 0,
    characterClass: 'novice',
    primaryClass: null,
    secondaryClass: null,
    activeSlot: 'primary',
    characterGender: 'male',
    adventurerTrait: null,
    startedAt: 0,
    hp: 110,
    mp: 35,
    ultimateCharge: 0,
    unlockedClasses: getStarterRpgClassIds(),
    inventory: {},
    equipment: getDefaultRpgEquipment(),
    gearInventory: {},
    equippedGear: getDefaultRpgEquipment(),
    learnedSkills: [],
    advancedClass: null,
    currentArea: 'forest',
    unlockedAreas: ['forest', 'starfall_crater'],
    discoveredMonsters: {},
    monsterKills: {},
    areaWins: {},
    bossKills: {},
    claimedQuests: {},
    storyChapters: {},
    codexClaims: {},
    tutorial: createDefaultRpgTutorialStats(),
    dungeonClears: {},
    raidClears: {},
    areaProgress: {},
    classMastery: {},
    craftingMastery: {},
    craftingBlessing: 0,
    craftedItems: 0,
    craftingLog: [],
    dungeonRun: null,
    gacha: {
      totalPulls: 0,
      pity: 0
    },
    daily: createDefaultRpgDailyStats(),
    explores: 0,
    usedItems: 0,
    shopPurchases: 0,
    dungeonRuns: 0,
    battles: 0,
    wins: 0,
    losses: 0,
    soldItems: 0,
    disassembledGear: 0,
    lastBattleAt: 0,
    lastExploreAt: 0,
    lastDungeonAt: 0,
    lastBossAt: 0,
    lastRaidAt: 0,
    lastRestAt: 0,
    lastDisassembledGearAt: 0
  };
}

function createDefaultRpgDailyStats(day = null) {
  return {
    day,
    battles: 0,
    wins: 0,
    explores: 0,
    dungeons: 0,
    bosses: 0,
    raids: 0,
    goldEarned: 0,
    claimedMissions: {}
  };
}

function createDefaultRpgTutorialStats() {
  return {
    claimedSteps: {}
  };
}

function normalizeRpgStats(stats = {}, _legacyGlobalLevel = 1, now = Date.now()) {
  const safeStats = stats && typeof stats === 'object' ? stats : {};
  const legacyNeedsReset = safeStats.schemaVersion !== RPG_SCHEMA_VERSION;
  const source = legacyNeedsReset ? {} : omitDeprecatedRpgStats(safeStats);
  const rpgLevel = normalizeStoredPositiveInteger(source.level, 1);
  const unlockedAreas = getUnlockedRpgAreaIds(rpgLevel);
  const characterClass = normalizeStoredRpgClass(source.characterClass);
  const primaryClass = normalizeStoredNullableRpgClass(source.primaryClass);
  const secondaryClass = normalizeStoredNullableRpgClass(source.secondaryClass);
  const characterGender = normalizeStoredRpgGender(source.characterGender);
  const advancedClass = normalizeStoredRpgAdvancedClass(source.advancedClass, characterClass);
  const currentArea = normalizeStoredRpgArea(source.currentArea, unlockedAreas);
  const equipment = normalizeRpgEquipment(source.equipment);
  const gearInventory = normalizeGearInventory(source.gearInventory);
  const equippedGear = normalizeEquippedGear(source.equippedGear, gearInventory);
  const learnedSkills = normalizeLearnedRpgSkills(source.learnedSkills);
  const daily = normalizeRpgDailyStats(source.daily);
  const tutorial = normalizeRpgTutorialStats(source.tutorial);
  const areaProgress = normalizeAreaProgress(source.areaProgress);
  const classMastery = normalizeClassMastery(source.classMastery, characterClass);
  const craftingMastery = normalizeCraftingMastery(source.craftingMastery);
  const derivedStats = getRpgDerivedStats({
    level: rpgLevel,
    characterClass,
    equipment,
    advancedClass,
    learnedSkills,
    gearInventory,
    equippedGear
  });
  const hp = source.hp === undefined || source.hp === null
    ? derivedStats.maxHp
    : Math.min(derivedStats.maxHp, Math.max(0, normalizeStoredNonNegativeInteger(source.hp)));
  const mp = source.mp === undefined || source.mp === null
    ? derivedStats.maxMp
    : Math.min(derivedStats.maxMp, Math.max(0, normalizeStoredNonNegativeInteger(source.mp)));
  const unlockedClasses = normalizeUnlockedClasses(source.unlockedClasses);
  for (const classId of [characterClass, primaryClass, secondaryClass].filter(Boolean)) {
    if (!unlockedClasses.includes(classId)) unlockedClasses.push(classId);
  }

  return {
    ...createDefaultRpgStats(),
    ...source,
    schemaVersion: RPG_SCHEMA_VERSION,
    level: rpgLevel,
    xp: normalizeStoredNonNegativeInteger(source.xp),
    totalXp: normalizeStoredNonNegativeInteger(source.totalXp),
    characterClass,
    primaryClass,
    secondaryClass,
    activeSlot: source.activeSlot === 'secondary' && secondaryClass ? 'secondary' : 'primary',
    adventurerTrait: normalizeStoredAdventurerTrait(source.adventurerTrait),
    characterGender,
    advancedClass,
    startedAt: normalizeStoredNonNegativeInteger(source.startedAt),
    hp,
    mp,
    ultimateCharge: Math.min(100, normalizeStoredNonNegativeInteger(source.ultimateCharge)),
    unlockedClasses,
    inventory: normalizeInventory(source.inventory),
    equipment,
    gearInventory,
    equippedGear,
    learnedSkills,
    currentArea,
    unlockedAreas,
    discoveredMonsters: normalizeCounterMap(source.discoveredMonsters),
    monsterKills: normalizeCounterMap(source.monsterKills),
    areaWins: normalizeCounterMap(source.areaWins),
    bossKills: normalizeCounterMap(source.bossKills),
    claimedQuests: normalizeClaimedQuests(source.claimedQuests),
    storyChapters: normalizeTimestampMap(source.storyChapters),
    codexClaims: normalizeTimestampMap(source.codexClaims),
    tutorial,
    dungeonClears: normalizeCounterMap(source.dungeonClears),
    raidClears: normalizeCounterMap(source.raidClears),
    areaProgress,
    classMastery,
    craftingMastery,
    craftingBlessing: Math.min(100, normalizeStoredNonNegativeInteger(source.craftingBlessing)),
    craftedItems: normalizeStoredNonNegativeInteger(source.craftedItems),
    craftingLog: normalizeCraftingLog(source.craftingLog),
    dungeonRun: normalizeRpgDungeonRun(source.dungeonRun, now),
    gacha: normalizeGachaStats(source.gacha),
    daily,
    explores: normalizeStoredNonNegativeInteger(source.explores),
    usedItems: normalizeStoredNonNegativeInteger(source.usedItems),
    shopPurchases: normalizeStoredNonNegativeInteger(source.shopPurchases),
    dungeonRuns: normalizeStoredNonNegativeInteger(source.dungeonRuns),
    battles: normalizeStoredNonNegativeInteger(source.battles),
    wins: normalizeStoredNonNegativeInteger(source.wins),
    losses: normalizeStoredNonNegativeInteger(source.losses),
    soldItems: normalizeStoredNonNegativeInteger(source.soldItems),
    disassembledGear: normalizeStoredNonNegativeInteger(source.disassembledGear),
    lastBattleAt: normalizeStoredNonNegativeInteger(source.lastBattleAt),
    lastExploreAt: normalizeStoredNonNegativeInteger(source.lastExploreAt),
    lastDungeonAt: normalizeStoredNonNegativeInteger(source.lastDungeonAt),
    lastBossAt: normalizeStoredNonNegativeInteger(source.lastBossAt),
    lastRaidAt: normalizeStoredNonNegativeInteger(source.lastRaidAt),
    lastRestAt: normalizeStoredNonNegativeInteger(source.lastRestAt),
    lastDisassembledGearAt: normalizeStoredNonNegativeInteger(source.lastDisassembledGearAt)
  };
}

function normalizeStoredRpgClass(value) {
  try {
    return normalizeRpgClass(value);
  } catch {
    return 'novice';
  }
}

function normalizeStoredNullableRpgClass(value) {
  if (!value) return null;
  try {
    const normalized = normalizeRpgClass(value);
    return getRpgFirstJobClassIds().includes(normalized) ? normalized : null;
  } catch {
    return null;
  }
}

function normalizeStoredAdventurerTrait(value) {
  const normalized = String(value ?? '').trim().toLocaleLowerCase('ko-KR');
  if (['attack', 'offense', '공격', '공격형'].includes(normalized)) return 'attack';
  if (['defense', '방어', '방어형'].includes(normalized)) return 'defense';
  if (['agility', '민첩', '민첩형'].includes(normalized)) return 'agility';
  if (['support', '지원', '지원형'].includes(normalized)) return 'support';
  return null;
}

function normalizeStoredRpgGender(value) {
  try {
    return normalizeRpgGender(value);
  } catch {
    return 'male';
  }
}

function normalizeStoredRpgAdvancedClass(value, characterClass) {
  try {
    const normalized = normalizeNullableRpgAdvancedClass(value);
    if (!normalized) return null;
    return getRpgAdvancedClassConfig(normalized)?.baseClass === characterClass ? normalized : null;
  } catch {
    return null;
  }
}

function normalizeStoredRpgArea(value, unlockedAreas) {
  try {
    const normalized = normalizeRpgArea(value);
    return unlockedAreas.includes(normalized) ? normalized : 'forest';
  } catch {
    return 'forest';
  }
}

function normalizeInventory(inventory = {}) {
  const safeInventory = inventory && typeof inventory === 'object'
    ? inventory
    : {};
  const normalizedEntries = [];

  for (const [itemId, count] of Object.entries(safeInventory)) {
    try {
      const normalizedItemId = normalizeRpgItemId(itemId);
      const normalizedCount = normalizeStoredNonNegativeInteger(count);
      if (normalizedCount > 0) {
        normalizedEntries.push([normalizedItemId, normalizedCount]);
      }
    } catch {
      // Invalid legacy items are ignored.
    }
  }

  return Object.fromEntries(normalizedEntries);
}

function normalizeGearInventory(gearInventory = {}) {
  const safeGearInventory = gearInventory && typeof gearInventory === 'object'
    ? gearInventory
    : {};

  return Object.fromEntries(
    Object.entries(safeGearInventory)
      .filter(([gearId, gear]) => gearId && gear && typeof gear === 'object' && gear.slot)
      .map(([gearId, gear]) => [gearId, {
        ...gear,
        id: gear.id || gearId,
        stats: normalizeGearStats(gear.stats),
        enhanceLevel: normalizeStoredNonNegativeInteger(gear.enhanceLevel),
        power: Math.max(1, normalizeStoredNonNegativeInteger(gear.power) || 1),
        acquiredAt: normalizeStoredNonNegativeInteger(gear.acquiredAt)
      }])
  );
}

function normalizeEquippedGear(equippedGear = {}, gearInventory = {}) {
  const safeEquippedGear = equippedGear && typeof equippedGear === 'object' ? equippedGear : {};
  const normalized = { ...getDefaultRpgEquipment() };

  for (const slot of Object.keys(normalized)) {
    const gearId = safeEquippedGear[slot];
    if (gearId && gearInventory[gearId]?.slot === slot) {
      normalized[slot] = gearId;
    }
  }

  return normalized;
}

function normalizeLearnedRpgSkills(learnedSkills = []) {
  const source = Array.isArray(learnedSkills) ? learnedSkills : [];
  const normalized = new Set();

  for (const skillId of source) {
    try {
      normalized.add(normalizeRpgSkillTreeNodeId(skillId));
    } catch {
      // Invalid legacy skill tree nodes are ignored.
    }
  }

  return [...normalized];
}

function normalizeUnlockedClasses(unlockedClasses = getStarterRpgClassIds()) {
  const source = Array.isArray(unlockedClasses) ? unlockedClasses : getStarterRpgClassIds();
  const normalized = new Set(getStarterRpgClassIds());

  for (const classId of source) {
    try {
      normalized.add(normalizeRpgClass(classId));
    } catch {
      // Invalid legacy classes are ignored.
    }
  }

  return [...normalized];
}

function normalizeCounterMap(counterMap = {}) {
  const safeMap = counterMap && typeof counterMap === 'object'
    ? counterMap
    : {};

  return Object.fromEntries(
    Object.entries(safeMap)
      .map(([key, count]) => [key, normalizeStoredNonNegativeInteger(count)])
      .filter(([, count]) => count > 0)
  );
}

function normalizeAreaProgress(areaProgress = {}) {
  const safeProgress = areaProgress && typeof areaProgress === 'object'
    ? areaProgress
    : {};
  const normalizedEntries = [];

  for (const [areaId, progress] of Object.entries(safeProgress)) {
    try {
      const normalizedArea = normalizeRpgArea(areaId);
      const normalizedProgress = Math.min(100, normalizeStoredNonNegativeInteger(progress));
      if (normalizedProgress > 0) {
        normalizedEntries.push([normalizedArea, normalizedProgress]);
      }
    } catch {
      // Invalid legacy areas are ignored.
    }
  }

  return Object.fromEntries(normalizedEntries);
}

function normalizeClassMastery(classMastery = {}, currentClass = 'novice') {
  const safeMastery = classMastery && typeof classMastery === 'object'
    ? classMastery
    : {};
  const normalized = {};

  for (const [classId, mastery] of Object.entries(safeMastery)) {
    try {
      const normalizedClass = normalizeRpgClass(classId);
      normalized[normalizedClass] = normalizeClassMasteryEntry(mastery);
    } catch {
      // Invalid legacy classes are ignored.
    }
  }

  normalized[currentClass] ??= createDefaultClassMasteryEntry();
  return normalized;
}

function createDefaultClassMasteryEntry() {
  return {
    level: 1,
    progress: 0
  };
}

function normalizeClassMasteryEntry(mastery = {}) {
  const safeMastery = mastery && typeof mastery === 'object' ? mastery : {};

  return {
    level: Math.max(1, normalizeStoredPositiveInteger(safeMastery.level, 1)),
    progress: normalizeStoredNonNegativeInteger(safeMastery.progress)
  };
}

function normalizeCraftingMastery(craftingMastery = {}) {
  const safeMastery = craftingMastery && typeof craftingMastery === 'object'
    ? craftingMastery
    : {};
  const normalized = {};

  for (const [type, mastery] of Object.entries(safeMastery)) {
    try {
      const normalizedType = normalizeRpgCraftingMasteryType(type);
      normalized[normalizedType] = normalizeCraftingMasteryEntry(mastery);
    } catch {
      // Invalid legacy crafting mastery rows are ignored.
    }
  }

  return normalized;
}

function normalizeCraftingMasteryEntry(mastery = {}) {
  const safeMastery = mastery && typeof mastery === 'object' ? mastery : {};

  return {
    level: Math.max(1, normalizeStoredPositiveInteger(safeMastery.level, 1)),
    xp: normalizeStoredNonNegativeInteger(safeMastery.xp)
  };
}

function normalizeCraftingLog(craftingLog = []) {
  const source = Array.isArray(craftingLog) ? craftingLog : [];
  return source.slice(-10).map((entry) => ({
    recipeId: String(entry?.recipeId ?? ''),
    resultItemId: String(entry?.resultItemId ?? ''),
    success: Boolean(entry?.success),
    quality: entry?.quality ? String(entry.quality) : null,
    createdAt: normalizeStoredNonNegativeInteger(entry?.createdAt)
  })).filter((entry) => entry.recipeId && entry.resultItemId);
}

function normalizeTimestampMap(timestampMap = {}) {
  const safeMap = timestampMap && typeof timestampMap === 'object'
    ? timestampMap
    : {};

  return Object.fromEntries(
    Object.entries(safeMap)
      .map(([key, timestamp]) => [key, normalizeStoredNonNegativeInteger(timestamp)])
      .filter(([, timestamp]) => timestamp > 0)
  );
}

function normalizeGearStats(stats = {}) {
  const safeStats = stats && typeof stats === 'object' ? stats : {};

  return {
    attack: normalizeStoredNonNegativeInteger(safeStats.attack),
    defense: normalizeStoredNonNegativeInteger(safeStats.defense),
    maxHp: normalizeStoredNonNegativeInteger(safeStats.maxHp),
    maxMp: normalizeStoredNonNegativeInteger(safeStats.maxMp)
  };
}

function normalizeClaimedQuests(claimedQuests = {}) {
  const safeQuests = claimedQuests && typeof claimedQuests === 'object'
    ? claimedQuests
    : {};
  const normalizedEntries = [];

  for (const [questId, claimedAt] of Object.entries(safeQuests)) {
    try {
      normalizedEntries.push([
        normalizeRpgQuestId(questId),
        normalizeStoredNonNegativeInteger(claimedAt) || Date.now()
      ]);
    } catch {
      // Invalid legacy quests are ignored.
    }
  }

  return Object.fromEntries(normalizedEntries);
}

function normalizeGachaStats(gacha = {}) {
  const safeGacha = gacha && typeof gacha === 'object' ? gacha : {};

  return {
    totalPulls: normalizeStoredNonNegativeInteger(safeGacha.totalPulls),
    pity: normalizeStoredNonNegativeInteger(safeGacha.pity)
  };
}

function omitDeprecatedRpgStats(stats = {}) {
  const {
    pvpBattles: _pvpBattles,
    pvpWins: _pvpWins,
    pvpLosses: _pvpLosses,
    ...activeStats
  } = stats;
  return activeStats;
}

function normalizeRpgDailyStats(daily = {}) {
  const safeDaily = daily && typeof daily === 'object' ? daily : {};

  return {
    ...createDefaultRpgDailyStats(),
    day: normalizeStoredNullableInteger(safeDaily.day),
    battles: normalizeStoredNonNegativeInteger(safeDaily.battles),
    wins: normalizeStoredNonNegativeInteger(safeDaily.wins),
    explores: normalizeStoredNonNegativeInteger(safeDaily.explores),
    dungeons: normalizeStoredNonNegativeInteger(safeDaily.dungeons),
    bosses: normalizeStoredNonNegativeInteger(safeDaily.bosses),
    raids: normalizeStoredNonNegativeInteger(safeDaily.raids),
    goldEarned: normalizeStoredNonNegativeInteger(safeDaily.goldEarned),
    claimedMissions: normalizeDailyMissionClaims(safeDaily.claimedMissions)
  };
}

function normalizeRpgTutorialStats(tutorial = {}) {
  const safeTutorial = tutorial && typeof tutorial === 'object' ? tutorial : {};

  return {
    ...createDefaultRpgTutorialStats(),
    claimedSteps: normalizeRpgTutorialClaims(safeTutorial.claimedSteps)
  };
}

function normalizeRpgTutorialClaims(claimedSteps = {}) {
  const safeClaims = claimedSteps && typeof claimedSteps === 'object'
    ? claimedSteps
    : {};
  const normalizedEntries = [];

  for (const [stepId, claimedAt] of Object.entries(safeClaims)) {
    try {
      normalizedEntries.push([
        normalizeRpgTutorialStepId(stepId),
        normalizeStoredNonNegativeInteger(claimedAt) || Date.now()
      ]);
    } catch {
      // Invalid legacy tutorial claims are ignored.
    }
  }

  return Object.fromEntries(normalizedEntries);
}

function normalizeDailyMissionClaims(claimedMissions = {}) {
  const safeClaims = claimedMissions && typeof claimedMissions === 'object'
    ? claimedMissions
    : {};
  const normalizedEntries = [];

  for (const [missionId, claimedAt] of Object.entries(safeClaims)) {
    try {
      normalizedEntries.push([
        normalizeRpgDailyMissionId(missionId),
        normalizeStoredNonNegativeInteger(claimedAt) || Date.now()
      ]);
    } catch {
      // Invalid legacy daily mission claims are ignored.
    }
  }

  return Object.fromEntries(normalizedEntries);
}

function resetRpgDailyStats(rpg, now = Date.now()) {
  const today = getDayIndex(now);

  if (rpg.daily?.day !== today) {
    rpg.daily = createDefaultRpgDailyStats(today);
  }

  return rpg.daily;
}

function incrementRpgDailyStats(rpg, now, increments = {}) {
  const daily = resetRpgDailyStats(rpg, now);

  for (const [key, value] of Object.entries(increments)) {
    daily[key] = normalizeStoredNonNegativeInteger(daily[key]) + normalizeStoredNonNegativeInteger(value);
  }

  return daily;
}

function getRpgDailyGoldCap(economy) {
  const configuredCap = Number(economy.options.rpgDailyGoldCap);
  if (!Number.isSafeInteger(configuredCap) || configuredCap < 0) {
    return 0;
  }

  return configuredCap;
}

function getRpgDailyGoldStatus(profile, economy, now = Date.now()) {
  const daily = resetRpgDailyStats(profile.rpg, now);
  const cap = getRpgDailyGoldCap(economy);
  const earned = normalizeStoredNonNegativeInteger(daily.goldEarned);
  const remaining = Math.max(0, cap - earned);

  return {
    cap,
    earned,
    remaining,
    capped: remaining <= 0
  };
}

function grantRepeatableRpgGold(profile, amount, economy, now = Date.now()) {
  const requested = normalizeStoredNonNegativeInteger(amount);
  const daily = resetRpgDailyStats(profile.rpg, now);
  const cap = getRpgDailyGoldCap(economy);
  const earnedBefore = normalizeStoredNonNegativeInteger(daily.goldEarned);
  const remainingBefore = Math.max(0, cap - earnedBefore);
  const granted = Math.min(requested, remainingBefore);

  if (granted > 0) {
    creditCurrency(profile, CURRENCY_RPG, granted);
  }

  daily.goldEarned = earnedBefore + granted;

  return {
    requested,
    granted,
    capped: granted < requested,
    cap,
    earnedBefore,
    earnedToday: daily.goldEarned,
    remainingBefore,
    remainingAfter: Math.max(0, cap - daily.goldEarned)
  };
}

function createEmptyRpgGoldGrant() {
  return {
    requested: 0,
    granted: 0,
    capped: false,
    cap: 0,
    earnedBefore: 0,
    earnedToday: 0,
    remainingBefore: 0,
    remainingAfter: 0
  };
}

function createEmptyRpgLevelResult() {
  return {
    leveledUp: false,
    levelsGained: 0,
    levelReward: 0,
    levelRewardRequested: 0,
    levelRewardCapped: false
  };
}

function createEmptyRepeatableRpgRewardSettlement() {
  const coinGrant = createEmptyRpgGoldGrant();

  return {
    xpGained: 0,
    coinReward: 0,
    requestedCoinReward: 0,
    rpgGoldLimit: coinGrant,
    levelResult: createEmptyRpgLevelResult()
  };
}

function settleRepeatableRpgRewards(profile, rewards = {}, economy, now = Date.now()) {
  const xp = normalizeStoredNonNegativeInteger(rewards.xp);
  const coins = normalizeStoredNonNegativeInteger(rewards.coins);
  const coinGrant = grantRepeatableRpgGold(profile, coins, economy, now);
  const levelResult = xp > 0
    ? addRepeatableRpgXp(profile, xp, economy, now)
    : createEmptyRpgLevelResult();

  return {
    xpGained: xp,
    coinReward: coinGrant.granted,
    requestedCoinReward: coins,
    rpgGoldLimit: coinGrant,
    levelResult
  };
}

function addRepeatableRpgXp(profile, xp, economy, now = Date.now()) {
  const gained = normalizeStoredNonNegativeInteger(xp);
  const beforeLevel = getProfileRpgLevel(profile);
  profile.rpg.xp = normalizeStoredNonNegativeInteger(profile.rpg.xp) + gained;
  profile.rpg.totalXp = normalizeStoredNonNegativeInteger(profile.rpg.totalXp) + gained;
  let levelReward = 0;
  let levelRewardRequested = 0;
  let levelRewardCapped = false;

  while (profile.rpg.xp >= getRpgXpForNextLevel(profile.rpg.level, economy)) {
    profile.rpg.xp -= getRpgXpForNextLevel(profile.rpg.level, economy);
    profile.rpg.level += 1;
    const reward = getLevelReward(profile.rpg.level);
    levelRewardRequested += reward;
    const grant = grantRepeatableRpgGold(profile, reward, economy, now);
    levelReward += grant.granted;
    levelRewardCapped ||= grant.capped;
  }

  profile.rpg.unlockedAreas = getUnlockedRpgAreaIds(profile.rpg.level);
  const derivedStats = getProfileRpgDerivedStats(profile);
  profile.rpg.hp = Math.min(derivedStats.maxHp, Math.max(1, profile.rpg.hp));
  profile.rpg.mp = Math.min(derivedStats.maxMp, Math.max(0, profile.rpg.mp));

  return {
    leveledUp: profile.rpg.level > beforeLevel,
    levelsGained: profile.rpg.level - beforeLevel,
    level: profile.rpg.level,
    rpgLevel: profile.rpg.level,
    rpgXp: profile.rpg.xp,
    rpgTotalXp: profile.rpg.totalXp,
    levelReward,
    levelRewardRequested,
    levelRewardCapped
  };
}

function getRpgCasinoSettlementModifier(profile) {
  const rpg = profile.rpg ?? {};
  const activeTazza = rpg.characterClass === 'tazza';
  const passiveTazza = !activeTazza && (rpg.primaryClass === 'tazza' || rpg.secondaryClass === 'tazza');

  if (activeTazza) {
    const config = getRpgClassConfig('tazza');
    return {
      applied: true,
      source: 'active_tazza',
      label: '타짜 활성 직업',
      winMultiplier: config.casinoWinMultiplier ?? 1,
      lossMultiplier: config.casinoLossMultiplier ?? 1
    };
  }

  if (passiveTazza) {
    const config = getRpgClassConfig('tazza');
    return {
      applied: true,
      source: 'passive_tazza',
      label: '타짜 비활성 패시브',
      winMultiplier: config.inactiveCasinoWinMultiplier ?? 1,
      lossMultiplier: config.inactiveCasinoLossMultiplier ?? 1
    };
  }

  return {
    applied: false,
    source: null,
    label: null,
    winMultiplier: 1,
    lossMultiplier: 1
  };
}

function applyRpgCasinoSettlementModifier({ bet, payout, modifier }) {
  const normalizedBet = normalizePositiveInteger(bet, '베팅액');
  const normalizedPayout = normalizeNonNegativeInteger(payout, '지급액');
  const safeModifier = modifier?.applied ? modifier : null;
  if (!safeModifier) {
    return { bet: normalizedBet, payout: normalizedPayout };
  }

  const baseProfit = normalizedPayout - normalizedBet;
  if (baseProfit > 0) {
    return {
      bet: normalizedBet,
      payout: normalizedBet + Math.floor(baseProfit * Math.max(1, safeModifier.winMultiplier))
    };
  }
  if (baseProfit < 0) {
    const loss = normalizedBet - normalizedPayout;
    return {
      bet: normalizedPayout + Math.ceil(loss * Math.max(1, safeModifier.lossMultiplier)),
      payout: normalizedPayout
    };
  }

  return { bet: normalizedBet, payout: normalizedPayout };
}

function normalizeStoredNonNegativeInteger(value) {
  const normalized = Number(value);
  return Number.isSafeInteger(normalized) && normalized >= 0 ? normalized : 0;
}

function normalizeStoredPositiveInteger(value, fallback) {
  const normalized = Number(value);
  return Number.isSafeInteger(normalized) && normalized >= 1 ? normalized : fallback;
}

function normalizeStoredNullableInteger(value) {
  if (value === null || value === undefined) return null;
  const normalized = Number(value);
  return Number.isSafeInteger(normalized) ? normalized : null;
}

function reconcileProfileProgress(profile, economy) {
  while (profile.xp >= economy.xpForNextLevel(profile.level)) {
    profile.xp -= economy.xpForNextLevel(profile.level);
    profile.level += 1;
  }

  const minimumTotalXp = getMinimumTotalXpForLevel(profile.level, economy);
  const expectedTotalXpFloor = minimumTotalXp + profile.xp;
  if (profile.totalXp < expectedTotalXpFloor) {
    profile.totalXp = expectedTotalXpFloor;
  }
}

function getMinimumTotalXpForLevel(level, economy) {
  let total = 0;

  for (let currentLevel = 1; currentLevel < level; currentLevel += 1) {
    total += economy.xpForNextLevel(currentLevel);
  }

  return total;
}

function getProfileRpgLevel(profile) {
  return normalizeStoredPositiveInteger(profile.rpg?.level, 1);
}

function getRpgXpForNextLevel(level, economy) {
  return economy.xpForNextLevel(Math.max(1, Number(level) || 1));
}

function getRpgCooldownRemaining(profile, now, cooldownMs) {
  return getRpgActionCooldownRemaining(profile.rpg.lastBattleAt, now, cooldownMs);
}

function getRpgActionContext(profile, economy, now = Date.now()) {
  const cooldownRemainingMs = getRpgCooldownRemaining(
    profile,
    now,
    economy.options.rpgBattleCooldownMs
  );
  const actionAvailability = getRpgActionAvailability(profile, economy, now);
  const dailyGold = getRpgDailyGoldStatus(profile, economy, now);
  const adventureGuide = getRpgAdventureGuide(profile, {
    now,
    cooldownRemainingMs,
    actionAvailability,
    dailyGold,
    xpForNextLevel: economy.xpForNextLevel.bind(economy)
  });

  return {
    cooldownRemainingMs,
    actionAvailability,
    dailyGold,
    adventureGuide
  };
}

function selectRandomSwordOpponentProfile({
  data,
  guildId,
  challengerUserId,
  randomInt,
  economy
}) {
  const candidates = getAccountUserIdsForGuild(data, guildId)
    .filter((candidateUserId) => candidateUserId !== challengerUserId);

  if (candidates.length <= 0) {
    throw new Error('랜덤 검배틀을 진행할 기존 유저가 없습니다. 다른 유저가 먼저 봇 활동을 한 뒤 다시 시도하세요.');
  }

  const profiles = candidates
    .map((opponentUserId) => getOptionalMutableProfileForGuild(data, guildId, opponentUserId, economy))
    .filter(Boolean);

  if (profiles.length <= 0) {
    throw new Error('랜덤 검배틀을 진행할 기존 유저가 없습니다. 다른 유저가 먼저 봇 활동을 한 뒤 다시 시도하세요.');
  }

  const profile = profiles[randomInt(0, profiles.length - 1)];
  return {
    ...profile,
    npc: false
  };
}

function getRpgActionAvailability(profile, economy, now = Date.now()) {
  const firstBoss = getRpgBossConfig('slime_king');
  const firstRaid = getRpgRaidConfig('slime_horde');
  const bossUnlock = getRpgActionUnlockState(profile, firstBoss);
  const raidUnlock = getRpgActionUnlockState(profile, firstRaid);
  const battleRemainingMs = getRpgActionCooldownRemaining(
    profile.rpg.lastBattleAt,
    now,
    economy.options.rpgBattleCooldownMs
  );
  const bossRemainingMs = getRpgActionCooldownRemaining(
    profile.rpg.lastBossAt,
    now,
    economy.options.rpgBossCooldownMs
  );
  const raidRemainingMs = getRpgActionCooldownRemaining(
    profile.rpg.lastRaidAt,
    now,
    economy.options.rpgRaidCooldownMs
  );
  const hpBlocked = profile.rpg.hp <= 1;

  return {
    battle: createRpgActionAvailabilityEntry({
      id: 'battle',
      label: '사냥',
      command: '/rpg 사냥',
      cooldownRemainingMs: battleRemainingMs,
      hpBlocked
    }),
    explore: createRpgActionAvailabilityEntry({
      id: 'explore',
      label: '탐사',
      command: '/rpg 탐사',
      cooldownRemainingMs: getRpgActionCooldownRemaining(
        profile.rpg.lastExploreAt,
        now,
        economy.options.rpgExploreCooldownMs
      ),
      hpBlocked
    }),
    dungeon: createRpgActionAvailabilityEntry({
      id: 'dungeon',
      label: '던전',
      command: '/rpg 던전',
      cooldownRemainingMs: getRpgActionCooldownRemaining(
        profile.rpg.lastDungeonAt,
        now,
        economy.options.rpgDungeonCooldownMs
      ),
      hpBlocked
    }),
    boss: createRpgActionAvailabilityEntry({
      id: 'boss',
      label: '보스전',
      command: '/rpg 보스',
      cooldownRemainingMs: Math.max(battleRemainingMs, bossRemainingMs),
      hpBlocked,
      ...bossUnlock,
      blockers: [
        ...bossUnlock.blockers,
        ...(battleRemainingMs > 0 ? [{ type: 'battle', label: '전투 대기', remainingMs: battleRemainingMs }] : []),
        ...(bossRemainingMs > 0 ? [{ type: 'boss', label: '보스전 대기', remainingMs: bossRemainingMs }] : [])
      ]
    }),
    raid: createRpgActionAvailabilityEntry({
      id: 'raid',
      label: '레이드',
      command: '/rpg 레이드',
      cooldownRemainingMs: raidRemainingMs,
      hpBlocked,
      ...raidUnlock,
      blockers: raidUnlock.blockers
    }),
    guildRaid: createRpgActionAvailabilityEntry({
      id: 'guildRaid',
      label: '길드레이드',
      command: '/rpg 길드레이드',
      cooldownRemainingMs: raidRemainingMs,
      hpBlocked,
      ...raidUnlock,
      blockers: raidUnlock.blockers
    }),
    rest: createRpgActionAvailabilityEntry({
      id: 'rest',
      label: '휴식',
      command: '/rpg 휴식',
      cooldownRemainingMs: getRpgActionCooldownRemaining(
        profile.rpg.lastRestAt,
        now,
        economy.options.rpgRestCooldownMs
      ),
      hpBlocked: false
    })
  };
}

function createRpgActionAvailabilityEntry({
  id,
  label,
  command,
  cooldownRemainingMs,
  hpBlocked = false,
  levelBlocked = false,
  areaBlocked = false,
  unlockLevel = null,
  area = null,
  areaLabel = null,
  blockers = []
}) {
  const remainingMs = normalizeStoredNonNegativeInteger(cooldownRemainingMs);
  const available = remainingMs <= 0 && !hpBlocked && !levelBlocked && !areaBlocked;
  const reason = hpBlocked
    ? 'HP가 낮아서 먼저 휴식이나 포션이 필요합니다.'
    : levelBlocked
      ? `Lv.${unlockLevel}부터 가능`
      : areaBlocked
        ? `${areaLabel ?? '해당'} 지역 해금 필요`
        : remainingMs > 0
          ? `${formatDurationMs(remainingMs)} 후 가능`
          : '지금 가능';

  return {
    id,
    label,
    command,
    available,
    cooldownRemainingMs: remainingMs,
    remainingMs,
    hpBlocked,
    levelBlocked,
    areaBlocked,
    unlockLevel,
    area,
    areaLabel,
    reason,
    blockers
  };
}

function getRpgActionUnlockState(profile, config) {
  const unlockedAreas = getUnlockedRpgAreaIds(getProfileRpgLevel(profile));
  const areaConfig = getRpgAreaConfig(config.area);
  const levelBlocked = getProfileRpgLevel(profile) < config.unlockLevel;
  const areaBlocked = !unlockedAreas.includes(config.area);
  const blockers = [];

  if (levelBlocked) {
    blockers.push({
      type: 'level',
      label: `Lv.${config.unlockLevel} 필요`,
      currentLevel: getProfileRpgLevel(profile),
      requiredLevel: config.unlockLevel
    });
  }

  if (areaBlocked) {
    blockers.push({
      type: 'area',
      label: `${areaConfig.label} 지역 해금 필요`,
      area: config.area,
      areaLabel: areaConfig.label
    });
  }

  return {
    levelBlocked,
    areaBlocked,
    unlockLevel: config.unlockLevel,
    area: config.area,
    areaLabel: areaConfig.label,
    blockers
  };
}

function getRpgActionCooldownRemaining(lastActionAt, now, cooldownMs) {
  const safeCooldownMs = normalizeStoredNonNegativeInteger(cooldownMs);
  if (safeCooldownMs <= 0 || !lastActionAt) return 0;

  const elapsed = now - normalizeStoredNonNegativeInteger(lastActionAt);
  return elapsed >= safeCooldownMs ? 0 : safeCooldownMs - elapsed;
}

function assertRpgActionCooldown(profile, actionKey, now, cooldownMs, label) {
  const remainingMs = getRpgActionCooldownRemaining(profile.rpg[actionKey], now, cooldownMs);
  if (remainingMs > 0) {
    throw new Error(`${label}은(는) 아직 다시 할 수 없습니다. 남은 시간: ${formatDurationMs(remainingMs)}`);
  }
}

function formatDurationMs(durationMs) {
  const totalSeconds = Math.max(1, Math.ceil(normalizeStoredNonNegativeInteger(durationMs) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [];

  if (hours > 0) parts.push(`${hours}시간`);
  if (minutes > 0) parts.push(`${minutes}분`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}초`);

  return parts.join(' ');
}

function createRpgBossSessionId(now = Date.now()) {
  return `boss_${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function createRpgHuntSessionId(now = Date.now()) {
  return `hunt_${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function cloneRpgBossSession(session = {}) {
  if (!session || typeof session !== 'object') {
    throw new Error('RPG 보스전 세션이 없습니다.');
  }

  return {
    ...session,
    player: {
      ...(session.player ?? {}),
      stats: { ...(session.player?.stats ?? {}) },
      inventory: { ...(session.player?.inventory ?? {}) },
      availableSkillIds: [...(session.player?.availableSkillIds ?? ['basic'])],
      assets: { ...(session.player?.assets ?? {}) }
    },
    boss: { ...(session.boss ?? {}) },
    assets: { ...(session.assets ?? {}) },
    lastTurn: session.lastTurn ? { ...session.lastTurn } : null
  };
}

function cloneRpgHuntSession(session = {}) {
  const cloned = cloneRpgBossSession(session);
  return {
    ...cloned,
    battle: {
      ...(session.battle ?? {}),
      rewards: { ...(session.battle?.rewards ?? {}) },
      assets: { ...(session.battle?.assets ?? {}) }
    },
    damageTakenTotal: normalizeStoredNonNegativeInteger(session.damageTakenTotal)
  };
}

function createRpgHuntBattleResult(session, { win = false, fled = false, turn = null, rewards = null } = {}) {
  const battle = session.battle ?? {};
  const finalRewards = rewards ?? (win ? battle.rewards : { xp: 0, coins: 0 });
  return {
    ...battle,
    difficulty: session.difficulty ?? battle.difficulty,
    difficultyLabel: session.difficultyLabel ?? battle.difficultyLabel,
    area: session.area ?? battle.area,
    areaLabel: session.areaLabel ?? battle.areaLabel,
    monster: session.monster ?? battle.monster,
    playerLevel: session.player?.level ?? battle.playerLevel,
    playerPower: turn?.attackPower || session.player?.stats?.attack || battle.playerPower,
    monsterPower: session.boss?.power ?? battle.monsterPower,
    mitigatedMonsterPower: session.boss?.power ?? battle.mitigatedMonsterPower,
    damageTaken: normalizeStoredNonNegativeInteger(session.damageTakenTotal),
    win,
    fled,
    skillId: turn?.skillId ?? battle.skillId,
    skillLabel: turn?.skillLabel ?? battle.skillLabel ?? '기본 공격',
    skillMpCost: turn?.mpCost ?? battle.skillMpCost ?? 0,
    ultimate: Boolean(turn?.ultimate),
    statusEffect: turn?.statusEffect ?? null,
    rewards: {
      xp: normalizeStoredNonNegativeInteger(finalRewards?.xp),
      coins: normalizeStoredNonNegativeInteger(finalRewards?.coins)
    },
    assets: {
      ...(battle.assets ?? {}),
      hero: session.assets?.hero ?? battle.assets?.hero,
      monster: session.assets?.monster ?? battle.assets?.monster,
      background: session.assets?.background ?? battle.assets?.background
    }
  };
}

function settleRpgUltimateCharge(profile, { usedUltimate = false, chargeGain = 0 } = {}) {
  const before = Math.min(100, normalizeStoredNonNegativeInteger(profile.rpg.ultimateCharge));
  const spent = usedUltimate && before >= 100;
  const afterSpend = spent ? 0 : before;
  const gained = normalizeStoredNonNegativeInteger(chargeGain);
  const after = Math.min(100, afterSpend + gained);

  profile.rpg.ultimateCharge = after;
  return {
    before,
    after,
    gained: after - afterSpend,
    spent,
    max: 100,
    ready: after >= 100
  };
}

function assertRpgAreaUnlocked(profile, area) {
  const normalizedArea = normalizeRpgArea(area);
  const unlockedAreas = getUnlockedRpgAreaIds(getProfileRpgLevel(profile));
  const areaConfig = getRpgAreaConfig(normalizedArea);

  if (!unlockedAreas.includes(normalizedArea)) {
    throw new Error(`${areaConfig.label} 지역은 Lv.${areaConfig.unlockLevel}부터 입장할 수 있습니다.`);
  }
}

function assertRpgDungeonUnlocked(profile, dungeonId) {
  const status = getRpgDungeonUnlockStatus(profile, dungeonId);

  if (!status.levelReady) {
    throw new Error(`${status.label} 던전은 RPG Lv.${status.unlockLevel}부터 입장할 수 있습니다.`);
  }

  if (!status.areaReady) {
    const areaLabel = getRpgAreaConfig(status.area).label;
    throw new Error(`${status.label} 던전은 ${areaLabel} 지역 해금 후 입장할 수 있습니다.`);
  }

  if (!status.requirementReady) {
    throw new Error(`${status.hidden ? '히든 ' : ''}${status.label} 던전 조건이 부족합니다. 진행도 ${status.requirementCurrent}/${status.requirementRequired}`);
  }
}

function assertActiveRpgDungeonRun(profile, { runId = null, revision = null, expectedState = null, now = Date.now() } = {}) {
  const run = normalizeRpgDungeonRun(profile.rpg.dungeonRun, now);
  if (!run) {
    profile.rpg.dungeonRun = null;
    throw new Error('진행 중인 던전이 없습니다. `/rpg 던전`으로 새로 시작하세요.');
  }
  if (runId && run.id !== runId) {
    throw new Error('이미 지난 던전 버튼입니다. `/rpg 던전`으로 현재 방을 다시 열어주세요.');
  }
  if (revision !== null && revision !== undefined && Number(revision) !== run.revision) {
    throw new Error('이미 지난 던전 선택입니다. `/rpg 던전`으로 현재 방을 다시 열어주세요.');
  }
  if (expectedState && run.state !== expectedState) {
    throw new Error(run.state === 'awaiting_relic' ? '먼저 던전 유물을 선택하세요.' : '현재는 방 선택 단계가 아닙니다.');
  }
  profile.rpg.dungeonRun = run;
  return run;
}

function createRpgDungeonRunResponse({
  profile,
  run,
  dungeonConfig = null,
  action = 'resumed',
  roomResult = null,
  relic = null,
  economy,
  now = Date.now()
}) {
  return {
    type: 'dungeon_run',
    action,
    area: run.area,
    areaConfig: getRpgAreaConfig(run.area),
    dungeonId: run.dungeonId,
    dungeonConfig,
    run: cloneRpgDungeonRun(run),
    roomResult,
    relic,
    derivedStats: getProfileRpgDerivedStats(profile),
    ...getRpgActionContext(profile, economy, now),
    profile: cloneProfile(profile)
  };
}

function settleRpgDungeonRun({ profile, run, dungeonConfig = null, outcome, roomResult = null, economy, now = Date.now() }) {
  const area = run.area;
  const floorCount = Math.max(1, Math.min(run.maxFloors ?? 3, run.floor ?? 1));
  const cleared = outcome === 'cleared';
  const failed = outcome === 'failed';
  const rewardScale = getRpgDungeonRewardScale({ cleared, failed, run, dungeonConfig });
  const requestedXp = Math.floor((run.rewardPool?.xp ?? 0) * rewardScale);
  const requestedCoins = Math.floor((run.rewardPool?.coins ?? 0) * rewardScale);
  const materialDrops = {};
  let gearDrop = null;

  profile.rpg.hp = Math.max(1, Math.min(run.maxHp ?? profile.rpg.hp, run.hp || 1));
  profile.rpg.mp = Math.max(0, Math.min(run.maxMp ?? profile.rpg.mp, run.mp ?? 0));
  profile.rpg.currentArea = area;
  profile.rpg.dungeonRun = null;

  if (cleared) {
    incrementRpgDailyStats(profile.rpg, now, { dungeons: 1 });
    increaseRpgAreaProgress(profile.rpg, area, floorCount * 12);
    grantRpgClassMastery(profile, floorCount * 8);
    profile.rpg.dungeonClears[area] = (profile.rpg.dungeonClears[area] ?? 0) + 1;

    mergeRpgItemQuantities(materialDrops, rollRpgMaterialDrops({
      source: 'dungeon',
      area,
      difficulty: floorCount >= 4 || run.highRiskTaken ? 'hard' : 'normal',
      randomInt: economy.randomInt
    }));
    mergeRpgItemQuantities(materialDrops, rollRpgConfiguredDungeonMaterialDrops({
      dungeonConfig,
      randomInt: economy.randomInt
    }));
    grantRpgInventoryItems(profile.rpg.inventory, materialDrops);

    const blueprint = rollRpgGearDrop({
      source: dungeonConfig?.hidden ? 'hiddenDungeon' : 'dungeon',
      area,
      difficulty: floorCount >= 4 || run.highRiskTaken ? 'hard' : 'normal',
      pool: dungeonConfig?.drops,
      randomInt: economy.randomInt
    });
    if (blueprint) gearDrop = addRpgGear(profile, blueprint, now);
  } else {
    increaseRpgAreaProgress(profile.rpg, area, Math.max(1, floorCount * 3));
    grantRpgClassMastery(profile, Math.max(1, floorCount * 2));
  }

  const rewardSettlement = settleRepeatableRpgRewards(profile, { xp: requestedXp, coins: requestedCoins }, economy, now);
  return {
    type: 'dungeon_result',
    outcome,
    area,
    areaConfig: getRpgAreaConfig(area),
    dungeonId: run.dungeonId,
    dungeonConfig,
    run: cloneRpgDungeonRun(run),
    roomResult,
    depth: run.maxFloors ?? floorCount,
    totalXp: requestedXp,
    totalCoins: rewardSettlement.coinReward,
    requestedTotalCoins: requestedCoins,
    rpgGoldLimit: rewardSettlement.rpgGoldLimit,
    totalDamage: Math.max(0, (run.maxHp ?? 0) - (run.hp ?? 0)),
    gearDrop,
    materialDrops: labelRpgItemQuantities(materialDrops),
    ...rewardSettlement.levelResult,
    ...getRpgActionContext(profile, economy, now),
    profile: cloneProfile(profile)
  };
}

function getRpgDungeonRewardScale({ cleared, failed, run, dungeonConfig }) {
  if (cleared) return dungeonConfig?.rewardMultiplier ?? (dungeonConfig?.hidden ? 1.2 : 1);
  if (failed) return run.highRiskTaken ? 0.2 : 0.35;
  return 0.25;
}

function rollRpgConfiguredDungeonMaterialDrops({ dungeonConfig = null, randomInt: rollInt = randomInt } = {}) {
  if (!dungeonConfig?.drops?.length) return {};

  const materialIds = dungeonConfig.drops
    .map((itemId) => {
      try {
        return normalizeRpgItemId(itemId);
      } catch {
        return null;
      }
    })
    .filter((itemId) => itemId && getRpgItemConfig(itemId).type !== 'equipment');
  if (materialIds.length === 0) return {};

  const attempts = dungeonConfig.hidden ? 2 : 1;
  const drops = {};
  for (let index = 0; index < attempts; index += 1) {
    const itemId = materialIds[rollInt(0, materialIds.length - 1)];
    drops[itemId] = (drops[itemId] ?? 0) + (dungeonConfig.hidden ? rollInt(1, 2) : 1);
  }
  return drops;
}

function getOrCreateGuildData(data, guildId) {
  data.guilds ??= {};
  data.guilds[guildId] ??= {};
  return data.guilds[guildId];
}

function getActiveSwordSuccessBonus(guild, userId, now = Date.now()) {
  const bonus = normalizeSwordSuccessBonus(guild?.swordSuccessBonus);
  if (!bonus || bonus.expiresAt <= now) {
    if (guild?.swordSuccessBonus) delete guild.swordSuccessBonus;
    return null;
  }

  if (bonus.sourceUserId === String(userId ?? '').trim()) {
    return null;
  }

  return {
    ...bonus,
    remainingMs: Math.max(0, bonus.expiresAt - now)
  };
}

function activateSwordSuccessBonus(guild, profile, now = Date.now(), rollInt = randomInt) {
  const rate = rollInt(
    SWORD_DESTRUCTION_SUCCESS_BONUS_MIN_BASIS_POINTS,
    SWORD_DESTRUCTION_SUCCESS_BONUS_MAX_BASIS_POINTS
  ) / 100;
  const bonus = {
    rate,
    durationMs: SWORD_DESTRUCTION_SUCCESS_BONUS_DURATION_MS,
    triggeredAt: now,
    expiresAt: now + SWORD_DESTRUCTION_SUCCESS_BONUS_DURATION_MS,
    sourceUserId: String(profile?.userId ?? '').trim(),
    sourceUsername: profile?.username || 'Unknown'
  };

  guild.swordSuccessBonus = bonus;

  return {
    ...bonus,
    remainingMs: SWORD_DESTRUCTION_SUCCESS_BONUS_DURATION_MS
  };
}

function normalizeSwordSuccessBonus(rawBonus) {
  if (!rawBonus || typeof rawBonus !== 'object') return null;

  const rate = Number(rawBonus.rate);
  const triggeredAt = normalizeStoredNonNegativeInteger(rawBonus.triggeredAt);
  const expiresAt = normalizeStoredNonNegativeInteger(rawBonus.expiresAt);
  const sourceUserId = String(rawBonus.sourceUserId ?? '').trim();

  if (!Number.isFinite(rate) || rate <= 0 || expiresAt <= 0 || !sourceUserId) return null;

  return {
    rate,
    durationMs: normalizeStoredNonNegativeInteger(rawBonus.durationMs),
    triggeredAt,
    expiresAt,
    sourceUserId,
    sourceUsername: rawBonus.sourceUsername || 'Unknown'
  };
}

function getRpgCraftingSuccessRate(profile, recipe, masteryStatus = getRpgCraftingMasteryStatus(profile, recipe.masteryType)) {
  const masteryBonus = Math.max(0, masteryStatus.level - 1) * 2;
  const blacksmithBonus = hasRpgBlacksmithAccess(profile) ? 5 : 0;
  const blessingBonus = Math.floor((profile.rpg?.craftingBlessing ?? 0) * 0.35);
  const hiddenPenalty = recipe.hidden ? -5 : 0;
  return Math.min(100, Math.max(5, recipe.baseSuccessRate + masteryBonus + blacksmithBonus + blessingBonus + hiddenPenalty));
}

function rollRpgCraftingQuality(profile, recipe, masteryStatus, randomInt) {
  const blacksmithBonus = hasRpgBlacksmithAccess(profile) ? 8 : 0;
  const rarityBonus = ['epic', 'legendary', 'mythic'].includes(recipe.rarity) ? 2 : 0;
  const score = randomInt(1, 100) + Math.max(0, masteryStatus.level - 1) * 2 + blacksmithBonus + rarityBonus;
  if (score >= 105) return 'masterpiece';
  if (score >= 95) return 'masterwork';
  if (score >= 80) return 'fine';
  if (score >= 50) return 'normal';
  return 'crude';
}

function hasRpgBlacksmithAccess(profile) {
  const rpg = profile.rpg ?? {};
  return ['characterClass', 'primaryClass', 'secondaryClass']
    .some((key) => rpg[key] === 'blacksmith')
    || Array.isArray(rpg.unlockedClasses) && rpg.unlockedClasses.includes('blacksmith');
}

function assertRpgCraftingMaterials(profile, recipe) {
  const missing = Object.entries(recipe.materials ?? {})
    .map(([itemId, required]) => {
      const normalizedItemId = normalizeRpgItemId(itemId);
      return {
        itemId: normalizedItemId,
        label: getRpgItemConfig(normalizedItemId).label,
        required,
        owned: profile.rpg.inventory[normalizedItemId] ?? 0
      };
    })
    .filter((row) => row.owned < row.required);

  if (missing.length > 0) {
    throw new Error(`재료가 부족합니다: ${missing.map((row) => `${row.label} ${row.owned}/${row.required}`).join(', ')}`);
  }
}

function consumeRpgCraftingMaterials(profile, recipe, { success = true } = {}) {
  const consumed = {};
  const coreMaterials = new Set(recipe.coreMaterials ?? []);

  for (const [itemId, required] of Object.entries(recipe.materials ?? {})) {
    const normalizedItemId = normalizeRpgItemId(itemId);
    const consumeCount = success
      ? required
      : coreMaterials.has(normalizedItemId)
        ? 0
        : Math.max(1, Math.ceil(required / 2));
    if (consumeCount > 0) {
      removeInventoryItem(profile.rpg.inventory, normalizedItemId, consumeCount);
      consumed[normalizedItemId] = consumeCount;
    }
  }

  return consumed;
}

function grantRpgCraftingMastery(profile, masteryType, xp) {
  const normalizedType = normalizeRpgCraftingMasteryType(masteryType);
  profile.rpg.craftingMastery[normalizedType] ??= { level: 1, xp: 0 };
  const mastery = profile.rpg.craftingMastery[normalizedType];
  mastery.xp += normalizeStoredNonNegativeInteger(xp);
  let required = getRpgCraftingMasteryStatus(profile, normalizedType).required;
  while (mastery.xp >= required) {
    mastery.xp -= required;
    mastery.level += 1;
    required = getRpgCraftingMasteryStatus(profile, normalizedType).required;
  }
  return getRpgCraftingMasteryStatus(profile, normalizedType);
}

function pushRpgCraftingLog(rpg, entry) {
  rpg.craftingLog = Array.isArray(rpg.craftingLog) ? rpg.craftingLog : [];
  rpg.craftingLog.push(entry);
  if (rpg.craftingLog.length > 10) {
    rpg.craftingLog = rpg.craftingLog.slice(-10);
  }
}

function createRpgMarketListingId(now, listings = {}) {
  let index = Object.keys(listings).length + 1;
  let listingId = `rpg_market_${now}_${index}`;
  while (listings[listingId]) {
    index += 1;
    listingId = `rpg_market_${now}_${index}`;
  }
  return listingId;
}

function cloneRpgMarketListing(listing) {
  return {
    ...listing,
    gear: listing?.gear ? cloneRpgGear(listing.gear) : null
  };
}

function getRpgMarketListingsSnapshot(data, guildId) {
  const listings = data.guilds?.[guildId]?.rpgMarketListings ?? {};
  return Object.values(listings)
    .map((listing) => cloneRpgMarketListing(listing))
    .sort((a, b) => a.price - b.price || a.createdAt - b.createdAt || String(a.id).localeCompare(String(b.id)));
}

function addInventoryItem(inventory, itemId, count) {
  const normalizedItemId = normalizeRpgItemId(itemId);
  const normalizedCount = normalizePositiveInteger(count, '아이템 수량');
  inventory[normalizedItemId] = (inventory[normalizedItemId] ?? 0) + normalizedCount;
}

function grantRpgInventoryItems(inventory, items = {}) {
  for (const [itemId, count] of Object.entries(items ?? {})) {
    if (normalizeStoredNonNegativeInteger(count) > 0) {
      addInventoryItem(inventory, itemId, count);
    }
  }
}

function mergeRpgItemQuantities(target, source = {}) {
  for (const [itemId, count] of Object.entries(source ?? {})) {
    const normalizedItemId = normalizeRpgItemId(itemId);
    const normalizedCount = normalizeStoredNonNegativeInteger(count);
    if (normalizedCount > 0) {
      target[normalizedItemId] = (target[normalizedItemId] ?? 0) + normalizedCount;
    }
  }
  return target;
}

function labelRpgItemQuantities(items = {}) {
  return Object.entries(items ?? {})
    .map(([itemId, quantity]) => {
      const normalizedItemId = normalizeRpgItemId(itemId);
      return {
        itemId: normalizedItemId,
        label: getRpgItemConfig(normalizedItemId).label,
        quantity: normalizeStoredNonNegativeInteger(quantity)
      };
    })
    .filter((entry) => entry.quantity > 0);
}

function setInventoryItemCount(inventory, itemId, count) {
  const normalizedItemId = normalizeRpgItemId(itemId);
  const normalizedCount = normalizeStoredNonNegativeInteger(count);

  if (normalizedCount > 0) {
    inventory[normalizedItemId] = normalizedCount;
  } else {
    delete inventory[normalizedItemId];
  }
}

function removeInventoryItem(inventory, itemId, count) {
  const normalizedItemId = normalizeRpgItemId(itemId);
  const normalizedCount = normalizePositiveInteger(count, '아이템 수량');

  if ((inventory[normalizedItemId] ?? 0) < normalizedCount) {
    throw new Error('아이템 수량이 부족합니다.');
  }

  inventory[normalizedItemId] -= normalizedCount;
  if (inventory[normalizedItemId] <= 0) {
    delete inventory[normalizedItemId];
  }
}

function increaseRpgAreaProgress(rpg, area, amount) {
  const normalizedArea = normalizeRpgArea(area);
  const before = normalizeStoredNonNegativeInteger(rpg.areaProgress?.[normalizedArea]);
  rpg.areaProgress ??= {};
  rpg.areaProgress[normalizedArea] = Math.min(100, before + normalizeStoredNonNegativeInteger(amount));

  return rpg.areaProgress[normalizedArea];
}

function grantRpgClassMastery(profile, amount) {
  const classId = normalizeRpgClass(profile.rpg.characterClass);
  profile.rpg.classMastery ??= {};
  const mastery = normalizeClassMasteryEntry(profile.rpg.classMastery[classId]);
  mastery.progress += normalizeStoredNonNegativeInteger(amount);

  while (mastery.progress >= getClassMasteryRequired(mastery.level)) {
    mastery.progress -= getClassMasteryRequired(mastery.level);
    mastery.level += 1;
  }

  profile.rpg.classMastery[classId] = mastery;
  return mastery;
}

function getClassMasteryRequired(level) {
  return 50 * Math.max(1, Number(level) || 1);
}

function addRpgGear(profile, blueprint, now = Date.now()) {
  if (!blueprint) return null;
  const sequence = Object.keys(profile.rpg.gearInventory).length + 1;
  const id = `gear_${now}_${sequence}`;
  const gear = {
    id,
    ...blueprint,
    acquiredAt: now
  };
  profile.rpg.gearInventory[id] = gear;
  return gear;
}

function cloneRpgGear(gear) {
  return {
    ...gear,
    stats: { ...(gear.stats ?? {}) }
  };
}

function getRpgGearEnhanceCost(gear) {
  const enhanceLevel = normalizeStoredNonNegativeInteger(gear.enhanceLevel);
  const power = Math.max(1, normalizeStoredNonNegativeInteger(gear.power) || 1);

  return 120 * (enhanceLevel + 1) * power;
}

function getRpgItemSellValue(item = {}) {
  if (item.price > 0) {
    return Math.max(1, Math.floor(item.price * 0.5));
  }

  if (item.type === 'material') {
    return 40;
  }

  const statValue = Object.values(item.stats ?? {})
    .reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
  return Math.max(25, 120 + statValue * 35);
}

function getRpgGearDisassembleRewards(gear = {}) {
  const rarityBonus = {
    common: 1,
    rare: 2,
    epic: 3,
    legendary: 4,
    mythic: 5
  }[gear.rarity] ?? 1;
  const enhanceLevel = normalizeStoredNonNegativeInteger(gear.enhanceLevel);
  const power = Math.max(1, normalizeStoredNonNegativeInteger(gear.power) || 1);

  return {
    enhancementStones: Math.max(1, rarityBonus + Math.floor(enhanceLevel / 2)),
    coins: Math.max(40, power * 60 + enhanceLevel * 40)
  };
}

function getRpgGearEnhanceSuccessRate(gear) {
  const enhanceLevel = normalizeStoredNonNegativeInteger(gear.enhanceLevel);
  const power = Math.max(1, normalizeStoredNonNegativeInteger(gear.power) || 1);

  return Math.max(35, 92 - enhanceLevel * 7 - power * 2);
}

function applyRpgGearEnhancement(gear, now = Date.now()) {
  const nextLevel = normalizeStoredNonNegativeInteger(gear.enhanceLevel) + 1;
  const statKey = getRpgGearEnhanceStatKey(gear);
  const statGain = 1 + Math.ceil(nextLevel / 2);

  gear.stats = normalizeGearStats(gear.stats);
  gear.stats[statKey] = (gear.stats[statKey] ?? 0) + statGain;
  gear.enhanceLevel = nextLevel;
  gear.power = Math.max(1, normalizeStoredNonNegativeInteger(gear.power) || 1) + 1;
  gear.lastEnhancedAt = now;

  return gear;
}

function getRpgGearEnhanceStatKey(gear) {
  if (gear.slot === 'armor') return 'defense';
  if (gear.slot === 'accessory') {
    return (gear.stats?.maxHp ?? 0) >= (gear.stats?.maxMp ?? 0)
      ? 'maxHp'
      : 'maxMp';
  }

  return 'attack';
}

function getRpgGuildRaidPartyProfiles(data, guildId, guild, leaderProfile, economy, raid, now) {
  const profiles = getAccountUserIdsForGuild(data, guildId)
    .map((memberId) => getOptionalMutableProfileForGuild(data, guildId, memberId, economy))
    .filter(Boolean)
    .filter((profile) => canJoinRpgGuildRaid(profile, raid, economy, now))
    .sort((a, b) => {
      if (a.userId === leaderProfile.userId) return -1;
      if (b.userId === leaderProfile.userId) return 1;
      if (b.level !== a.level) return b.level - a.level;
      return a.username.localeCompare(b.username, 'ko-KR');
    })
    .slice(0, 4);

  if (!profiles.some((profile) => profile.userId === leaderProfile.userId)) {
    profiles.unshift(leaderProfile);
  }

  return profiles
    .filter((profile, index, source) => source.findIndex((entry) => entry.userId === profile.userId) === index)
    .slice(0, 4);
}

function getRpgGuildRaidPartyProfilesByIds(data, guildId, guild, leaderProfile, memberIds = [], economy, raid, now) {
  const orderedIds = [
    leaderProfile.userId,
    ...memberIds
  ]
    .map((memberId) => String(memberId || '').trim())
    .filter(Boolean);
  const uniqueIds = [...new Set(orderedIds)].slice(0, 4);
  const profiles = uniqueIds
    .map((memberId) => getOptionalMutableProfileForGuild(data, guildId, memberId, economy))
    .filter(Boolean)
    .filter((profile) => canJoinRpgGuildRaid(profile, raid, economy, now));

  if (!profiles.some((profile) => profile.userId === leaderProfile.userId)) {
    profiles.unshift(leaderProfile);
  }

  return profiles
    .filter((profile, index, source) => source.findIndex((entry) => entry.userId === profile.userId) === index)
    .slice(0, 4);
}

function assertRpgGuildRaidParticipantAvailable(profile, raid, economy, now, label = '길드 레이드 참가') {
  if (profile.rpg.startedAt <= 0) {
    throw new Error('먼저 `/rpg 시작`으로 캐릭터를 만들어야 합니다.');
  }
  if (getProfileRpgLevel(profile) < raid.unlockLevel) {
    throw new Error(`${raid.label} ${label}는 Lv.${raid.unlockLevel}부터 가능합니다.`);
  }
  assertRpgAreaUnlocked(profile, raid.area);
  assertRpgActionCooldown(profile, 'lastRaidAt', now, economy.options.rpgRaidCooldownMs, label);
  if (profile.rpg.hp <= 1) {
    throw new Error('HP가 부족합니다. `/rpg 휴식` 또는 회복 포션을 사용하세요.');
  }
}

function canJoinRpgGuildRaid(profile, raid, economy, now) {
  try {
    assertRpgGuildRaidParticipantAvailable(profile, raid, economy, now);
    return true;
  } catch {
    return false;
  }
}

function createRpgGuildRaidMember(profile) {
  return {
    userId: profile.userId,
    username: profile.username,
    level: getProfileRpgLevel(profile),
    characterClass: profile.rpg.characterClass,
    characterGender: profile.rpg.characterGender,
    advancedClass: profile.rpg.advancedClass,
    stats: getProfileRpgDerivedStats(profile)
  };
}

function resolveOwnedRpgGear(profile, selector) {
  const rawSelector = String(selector || '').trim();

  if (!rawSelector) {
    throw new Error('장착할 장비 번호나 이름을 입력하세요. `/rpg 인벤토리 보기:장비`에서 선택 목록을 볼 수 있습니다.');
  }

  if (profile.rpg.gearInventory[rawSelector]) {
    return profile.rpg.gearInventory[rawSelector];
  }

  const sortedGears = getSortedRpgGearList(profile);
  const indexMatch = rawSelector.match(/^#?(\d+)$/);
  if (indexMatch) {
    const index = Number(indexMatch[1]) - 1;
    if (sortedGears[index]) {
      return sortedGears[index];
    }
  }

  const normalizedSelector = rawSelector.toLocaleLowerCase('ko-KR');
  const matchedGear = sortedGears.find((gear) =>
    [
      gear.label,
      gear.rarityLabel,
      gear.rarity,
      formatEquipmentSlotForSearch(gear.slot),
      Object.entries(gear.stats ?? {})
        .map(([stat, value]) => `${stat} ${value}`)
        .join(' ')
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('ko-KR')
      .includes(normalizedSelector)
  );

  if (matchedGear) {
    return matchedGear;
  }

  throw new Error('보유한 인벤토리 장비를 찾을 수 없습니다. `/rpg 인벤토리 보기:장비`에서 번호 버튼을 확인하세요.');
}

function findRecommendedRpgGearForSlot(profile, slot) {
  const candidates = Object.values(profile.rpg.gearInventory ?? {})
    .filter((gear) => gear?.slot === slot)
    .sort((a, b) =>
      getRpgGearRecommendationScore(b) - getRpgGearRecommendationScore(a)
      || String(a.label ?? '').localeCompare(String(b.label ?? ''), 'ko-KR')
      || String(a.id ?? '').localeCompare(String(b.id ?? ''))
    );
  const gear = candidates[0] ?? null;
  if (!gear) return null;
  const previousGearId = profile.rpg.equippedGear?.[slot] ?? null;
  const previousGear = previousGearId ? profile.rpg.gearInventory[previousGearId] ?? null : null;
  return {
    gear,
    previousGear,
    comparison: compareRpgGears(previousGear, gear)
  };
}

function compareRpgGears(previousGear, nextGear) {
  const beforeStats = normalizeGearStats(previousGear?.stats);
  const afterStats = normalizeGearStats(nextGear?.stats);
  return {
    scoreBefore: getRpgGearRecommendationScore(previousGear),
    scoreAfter: getRpgGearRecommendationScore(nextGear),
    scoreDelta: getRpgGearRecommendationScore(nextGear) - getRpgGearRecommendationScore(previousGear),
    statDelta: {
      attack: afterStats.attack - beforeStats.attack,
      defense: afterStats.defense - beforeStats.defense,
      maxHp: afterStats.maxHp - beforeStats.maxHp,
      maxMp: afterStats.maxMp - beforeStats.maxMp
    }
  };
}

function getRpgGearRecommendationScore(gear) {
  if (!gear) return 0;
  const stats = normalizeGearStats(gear.stats);
  const power = Math.max(1, normalizeStoredNonNegativeInteger(gear.power) || 1);
  const enhanceLevel = normalizeStoredNonNegativeInteger(gear.enhanceLevel);
  return (
    power * 10
    + enhanceLevel * 4
    + stats.attack * 4
    + stats.defense * 3
    + Math.floor(stats.maxHp / 8)
    + Math.floor(stats.maxMp / 6)
  );
}

function getSortedRpgGearList(profile) {
  return Object.values(profile.rpg.gearInventory)
    .sort((a, b) =>
      (b.power ?? 0) - (a.power ?? 0)
      || String(a.label ?? '').localeCompare(String(b.label ?? ''), 'ko-KR')
    );
}

function formatEquipmentSlotForSearch(slot) {
  return {
    weapon: '무기',
    armor: '방어구',
    accessory: '장신구'
  }[slot] ?? slot;
}

function getProfileRpgDerivedStats(profile, overrides = {}) {
  return getRpgDerivedStats({
    level: overrides.level ?? getProfileRpgLevel(profile),
    characterClass: overrides.characterClass ?? profile.rpg.characterClass,
    equipment: overrides.equipment ?? profile.rpg.equipment,
    advancedClass: overrides.advancedClass ?? profile.rpg.advancedClass,
    learnedSkills: overrides.learnedSkills ?? profile.rpg.learnedSkills,
    gearInventory: overrides.gearInventory ?? profile.rpg.gearInventory,
    equippedGear: overrides.equippedGear ?? profile.rpg.equippedGear
  });
}

function getProfileRpgHeroAssetId(profile) {
  return getRpgHeroAssetId({
    characterClass: profile.rpg.characterClass,
    characterGender: profile.rpg.characterGender,
    advancedClass: profile.rpg.advancedClass
  });
}

function getRpgCombatBonuses(profile) {
  const baseStats = getProfileRpgDerivedStats(profile, {
    equipment: getDefaultRpgEquipment(),
    advancedClass: null,
    learnedSkills: [],
    gearInventory: {},
    equippedGear: getDefaultRpgEquipment()
  });
  const derivedStats = getProfileRpgDerivedStats(profile);

  return {
    attack: derivedStats.attack - baseStats.attack,
    defense: derivedStats.defense - baseStats.defense
  };
}

function prepareRpgSkill(profile, skillId) {
  const normalizedSkillId = normalizeRpgSkillId(skillId);
  const skill = getRpgSkillConfig(normalizedSkillId);
  const availableSkillIds = getAvailableRpgSkillIds(profile.rpg.characterClass, profile.rpg.advancedClass);

  if (!availableSkillIds.includes(normalizedSkillId)) {
    throw new Error(`${getRpgClassConfig(profile.rpg.characterClass).label} 직업은 ${skill.label} 스킬을 사용할 수 없습니다.`);
  }

  if (profile.rpg.mp < skill.mpCost) {
    throw new Error(`MP가 부족합니다. 필요 MP: ${skill.mpCost}, 현재 MP: ${profile.rpg.mp}`);
  }

  return {
    id: normalizedSkillId,
    ...skill
  };
}

function applyGachaReward(profile, pull) {
  const reward = pull.reward;

  if (reward.type === 'item') {
    addInventoryItem(profile.rpg.inventory, reward.itemId, reward.quantity ?? 1);
    return;
  }

  if (reward.type === 'class') {
    const normalizedClass = normalizeRpgClass(reward.classId);
    if (!profile.rpg.unlockedClasses.includes(normalizedClass)) {
      profile.rpg.unlockedClasses.push(normalizedClass);
      pull.newUnlock = true;
      return;
    }

    creditCurrency(profile, CURRENCY_RPG, 150);
    pull.duplicateCompensation = 150;
  }
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
