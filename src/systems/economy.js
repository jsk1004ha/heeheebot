import {
  getAvailableRpgSkillIds,
  getDefaultRpgEquipment,
  getRpgAdventureGuide,
  getRpgAreaConfig,
  getRpgAreaProgressStatuses,
  getRpgAdvancedClassConfig,
  getRpgAdvancedClassStatuses,
  getRpgBossConfig,
  getRpgClassAssetId,
  getRpgClassConfig,
  getRpgClassMasteryStatus,
  getRpgDailyMissionConfig,
  getRpgDailyMissionStatuses,
  getRpgDerivedStats,
  getRpgGachaBannerConfig,
  getRpgGenderConfig,
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
  getStarterRpgClassIds,
  getUnlockedRpgAreaIds,
  normalizeNullableRpgAdvancedClass,
  normalizeRpgAdvancedClass,
  normalizeRpgArea,
  normalizeRpgBossId,
  normalizeRpgClass,
  normalizeRpgDailyMissionId,
  normalizeRpgDifficulty,
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
  resolveRpgExploration,
  resolveRpgBattle,
  resolveRpgBossBattle,
  resolveRpgBossTurn,
  resolveRpgGuildRaidBattle,
  resolveRpgPvpTurn,
  resolveRpgRaidBattle,
  rollRpgGearDrop,
  rollRpgDrop,
  rollRpgGachaPull
} from './rpg.js';

import {
  DAILY_SWORD_GIFT_STONES,
  MAX_DAILY_SWORD_BATTLES,
  MAX_DAILY_SWORD_BATTLE_STONES,
  MAX_SWORD_LEVEL,
  createRandomSwordOpponent,
  getAdvancedSwordEnhanceConfig,
  getSwordEnhanceConfig,
  getSwordSellValue,
  resolveSwordBattle as resolveSwordBattleResult,
  resolveSwordEnhancement
} from './sword.js';
import {
  CURRENCY_CASINO,
  CURRENCY_RPG,
  CURRENCY_SWORD,
  cloneWallets,
  creditCurrency,
  debitCurrency,
  exchangeCurrency,
  getCurrencyBalance,
  getCurrencyBalances,
  migrateLegacyWalletsToGold,
  normalizeWallets
} from './currencies.js';

const DEFAULT_OPTIONS = Object.freeze({
  messageCooldownMs: 60_000,
  messageXpMin: 5,
  messageXpMax: 15,
  firstMessageXpBonus: 50,
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
  rpgBattleWinXpMin: 50,
  rpgBattleWinXpMax: 200,
  rpgBattleCooldownMs: 60_000,
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

  async getProfile(guildId, userId, username = 'Unknown') {
    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      return cloneProfile(profile);
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

      profile.balance += coinReward;
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
          profile.balance += moneyGained;
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

  async awardRpgBattleWin({ guildId, userId, username }) {
    return this.awardActivityXp({
      guildId,
      userId,
      username,
      xp: this.randomInt(this.options.rpgBattleWinXpMin, this.options.rpgBattleWinXpMax),
      source: 'RPG 전투 승리'
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

  async chooseRpgClass({
    guildId,
    userId,
    username,
    characterClass = 'warrior',
    characterGender = 'male',
    now = Date.now()
  }) {
    const normalizedClass = normalizeRpgClass(characterClass);
    const normalizedGender = normalizeRpgGender(characterGender);
    const classConfig = getRpgClassConfig(normalizedClass);
    const genderConfig = getRpgGenderConfig(normalizedGender);
    const heroAssetId = getRpgClassAssetId(normalizedClass, normalizedGender);

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      const firstStart = !profile.rpg.startedAt;
      if (!profile.rpg.unlockedClasses.includes(normalizedClass)) {
        throw new Error(`${classConfig.label} 직업은 아직 해금되지 않았습니다. 가챠로 해금할 수 있습니다.`);
      }
      profile.rpg.characterClass = normalizedClass;
      profile.rpg.characterGender = normalizedGender;
      if (profile.rpg.advancedClass) {
        const advancedClass = getRpgAdvancedClassConfig(profile.rpg.advancedClass);
        if (advancedClass?.baseClass !== normalizedClass) {
          profile.rpg.advancedClass = null;
        }
      }
      profile.rpg.startedAt ||= now;
      const derivedStats = getProfileRpgDerivedStats(profile, { characterClass: normalizedClass });
      profile.rpg.hp = firstStart
        ? derivedStats.maxHp
        : Math.min(profile.rpg.hp, derivedStats.maxHp);
      profile.rpg.mp = firstStart
        ? derivedStats.maxMp
        : Math.min(profile.rpg.mp, derivedStats.maxMp);
      if (firstStart) {
        addInventoryItem(profile.rpg.inventory, 'potion', 2);
      }
      profile.rpg.unlockedAreas = getUnlockedRpgAreaIds(profile.level);

      return {
        characterClass: normalizedClass,
        characterGender: normalizedGender,
        classConfig,
        genderConfig,
        heroAssetId,
        derivedStats,
        currentArea: getRpgAreaConfig(profile.rpg.currentArea),
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
      const levelResult = addXp(profile, quest.rewards.xp, this);
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
      const levelResult = addXp(profile, mission.rewards.xp, this);

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

  async getRpgStatus({ guildId, userId, username, now = Date.now() }) {
    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      resetRpgDailyStats(profile.rpg, now);
      profile.rpg.unlockedAreas = getUnlockedRpgAreaIds(profile.level);
      const derivedStats = getProfileRpgDerivedStats(profile);
      const cooldownRemainingMs = getRpgCooldownRemaining(
        profile,
        now,
        this.options.rpgBattleCooldownMs
      );

      return {
        profile: cloneProfile(profile),
        classConfig: getRpgClassConfig(profile.rpg.characterClass),
        genderConfig: getRpgGenderConfig(profile.rpg.characterGender),
        advancedClassConfig: profile.rpg.advancedClass
          ? getRpgAdvancedClassConfig(profile.rpg.advancedClass)
          : null,
        heroAssetId: getRpgClassAssetId(profile.rpg.characterClass, profile.rpg.characterGender),
        derivedStats,
        quests: getRpgQuestStatuses(profile),
        skillTree: getRpgSkillTreeStatuses(profile),
        skillPoints: getRpgSkillPointSummary(profile),
        storyChapters: getRpgStoryChapterStatuses(profile),
        codex: getRpgMonsterCodexStatuses(profile),
        areaProgress: getRpgAreaProgressStatuses(profile),
        classMastery: getRpgClassMasteryStatus(profile),
        classPaths: getRpgAdvancedClassStatuses(profile),
        dailyMissions: getRpgDailyMissionStatuses(profile, now),
        adventureGuide: getRpgAdventureGuide(profile, {
          now,
          cooldownRemainingMs,
          xpForNextLevel: this.xpForNextLevel.bind(this)
        }),
        availableSkillIds: getAvailableRpgSkillIds(profile.rpg.characterClass),
        currentArea: getRpgAreaConfig(profile.rpg.currentArea),
        unlockedAreas: profile.rpg.unlockedAreas.map((area) => ({
          id: area,
          ...getRpgAreaConfig(area)
        })),
        cooldownRemainingMs
      };
    });
  }

  async enterRpgArea({ guildId, userId, username, area }) {
    const normalizedArea = normalizeRpgArea(area);
    const areaConfig = getRpgAreaConfig(normalizedArea);

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      profile.rpg.unlockedAreas = getUnlockedRpgAreaIds(profile.level);
      assertRpgAreaUnlocked(profile, normalizedArea);
      profile.rpg.currentArea = normalizedArea;

      return {
        area: normalizedArea,
        areaConfig,
        profile: cloneProfile(profile),
        classConfig: getRpgClassConfig(profile.rpg.characterClass),
        genderConfig: getRpgGenderConfig(profile.rpg.characterGender),
        heroAssetId: getRpgClassAssetId(profile.rpg.characterClass, profile.rpg.characterGender),
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
      const unlockedAreas = getUnlockedRpgAreaIds(profile.level);
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
        playerLevel: profile.level,
        difficulty,
        area: normalizedArea,
        characterClass: profile.rpg.characterClass,
        characterGender: profile.rpg.characterGender,
        skillId: skillConfig.id,
        statBonuses: getRpgCombatBonuses(profile),
        randomInt: this.randomInt
      });
      const stats = profile.rpg;
      let levelResult = {
        leveledUp: false,
        levelsGained: 0,
        levelReward: 0
      };

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
        creditCurrency(profile, CURRENCY_RPG, battle.rewards.coins);
        if (drop) {
          addInventoryItem(profile.rpg.inventory, drop.itemId, drop.quantity);
        }
        if (gearDrop) {
          gearDrop = addRpgGear(profile, gearDrop, now);
        }
        levelResult = addXp(profile, battle.rewards.xp, this);
      } else {
        stats.losses += 1;
      }

      return {
        battled: true,
        battle,
        assets: battle.assets,
        drop,
        gearDrop,
        xpGained: battle.rewards.xp,
        coinReward: battle.rewards.coins,
        ...levelResult,
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

      if (profile.level < boss.unlockLevel) {
        throw new Error(`${boss.label} 보스는 Lv.${boss.unlockLevel}부터 도전할 수 있습니다.`);
      }

      if (!getUnlockedRpgAreaIds(profile.level).includes(boss.area)) {
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

      if (profile.rpg.hp <= 1) {
        throw new Error('HP가 부족합니다. `/rpg 휴식` 또는 회복 포션을 사용하세요.');
      }

      const skillConfig = prepareRpgSkill(profile, skill);
      const battle = resolveRpgBossBattle({
        playerLevel: profile.level,
        bossId: normalizedBossId,
        characterClass: profile.rpg.characterClass,
        characterGender: profile.rpg.characterGender,
        skillId: skillConfig.id,
        statBonuses: getRpgCombatBonuses(profile),
        randomInt: this.randomInt
      });
      const stats = profile.rpg;
      let levelResult = {
        leveledUp: false,
        levelsGained: 0,
        levelReward: 0
      };

      stats.battles += 1;
      stats.lastBattleAt = now;
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
      let gearDrop = rollRpgGearDrop({
        source: 'boss',
        area: battle.area,
        difficulty: battle.difficulty,
        randomInt: this.randomInt
      });

      if (battle.win) {
        stats.wins += 1;
        stats.bossKills[normalizedBossId] = (stats.bossKills[normalizedBossId] ?? 0) + 1;
        creditCurrency(profile, CURRENCY_RPG, battle.rewards.coins);
        if (drop) {
          addInventoryItem(profile.rpg.inventory, drop.itemId, drop.quantity);
        }
        if (gearDrop) {
          gearDrop = addRpgGear(profile, gearDrop, now);
        }
        levelResult = addXp(profile, battle.rewards.xp, this);
      } else {
        stats.losses += 1;
      }

      return {
        battled: true,
        battle,
        assets: battle.assets,
        drop,
        gearDrop,
        xpGained: battle.rewards.xp,
        coinReward: battle.rewards.coins,
        ...levelResult,
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

      if (profile.level < boss.unlockLevel) {
        throw new Error(`${boss.label} 보스는 Lv.${boss.unlockLevel}부터 도전할 수 있습니다.`);
      }

      if (!getUnlockedRpgAreaIds(profile.level).includes(boss.area)) {
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

      if (profile.rpg.hp <= 1) {
        throw new Error('HP가 부족합니다. `/rpg 휴식` 또는 회복 포션을 사용하세요.');
      }

      const derivedStats = getProfileRpgDerivedStats(profile);
      const bossPower = this.randomInt(boss.powerMin, boss.powerMax);
      const bossMaxHp = Math.max(20, bossPower * 2);
      profile.rpg.lastBattleAt = now;
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
            level: profile.level,
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
            availableSkillIds: getAvailableRpgSkillIds(profile.rpg.characterClass),
            assets: {
              hero: getRpgClassAssetId(profile.rpg.characterClass, profile.rpg.characterGender)
            }
          },
          boss: {
            hp: bossMaxHp,
            maxHp: bossMaxHp,
            power: bossPower,
            assetId: getRpgMonsterAssetId(boss.monster)
          },
          assets: {
            hero: getRpgClassAssetId(profile.rpg.characterClass, profile.rpg.characterGender),
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
      let levelResult = {
        leveledUp: false,
        levelsGained: 0,
        levelReward: 0
      };
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
        creditCurrency(profile, CURRENCY_RPG, boss.coinReward);
        gearDrop = addRpgGear(profile, rollRpgGearDrop({
          source: 'boss',
          area: boss.area,
          difficulty: 'boss',
          randomInt: this.randomInt
        }), now);
        levelResult = addXp(profile, boss.xpReward, this);
      } else {
        profile.rpg.losses += 1;
      }

      return {
        completed: true,
        type: 'boss_turn',
        session: nextSession,
        turn,
        battle,
        assets: battle.assets,
        gearDrop,
        xpGained: battle.rewards.xp,
        coinReward: battle.rewards.coins,
        ...levelResult,
        profile: cloneProfile(profile)
      };
    });
  }

  async startRpgPvpDuel({
    guildId,
    challenger,
    opponent,
    now = Date.now()
  }) {
    if (!challenger?.userId || !opponent?.userId) {
      throw new Error('RPG 대결 참여자 정보가 필요합니다.');
    }

    if (challenger.userId === opponent.userId) {
      throw new Error('자기 자신과는 RPG 대결을 할 수 없습니다.');
    }

    return this.store.update((data) => {
      const challengerProfile = getOrCreateProfile(data, guildId, challenger.userId, challenger.username, this);
      const opponentProfile = getOrCreateProfile(data, guildId, opponent.userId, opponent.username, this);
      const challengerCooldownMs = getRpgCooldownRemaining(
        challengerProfile,
        now,
        this.options.rpgBattleCooldownMs
      );

      if (challengerCooldownMs > 0) {
        return createBlockedRpgPvpResult({
          blockedSide: 'challenger',
          blockedProfile: challengerProfile,
          remainingMs: challengerCooldownMs,
          challengerProfile,
          opponentProfile
        });
      }

      const opponentCooldownMs = getRpgCooldownRemaining(
        opponentProfile,
        now,
        this.options.rpgBattleCooldownMs
      );

      if (opponentCooldownMs > 0) {
        return createBlockedRpgPvpResult({
          blockedSide: 'opponent',
          blockedProfile: opponentProfile,
          remainingMs: opponentCooldownMs,
          challengerProfile,
          opponentProfile
        });
      }

      if (challengerProfile.rpg.hp <= 1) {
        throw new Error(`${challengerProfile.username}님은 HP가 부족합니다. \`/rpg 휴식\` 또는 회복 포션을 사용하세요.`);
      }

      if (opponentProfile.rpg.hp <= 1) {
        throw new Error(`${opponentProfile.username}님은 HP가 부족합니다. \`/rpg 휴식\` 또는 회복 포션을 사용하세요.`);
      }

      challengerProfile.rpg.lastBattleAt = now;
      opponentProfile.rpg.lastBattleAt = now;

      return {
        started: true,
        type: 'pvp_turn',
        session: createRpgPvpDuelSession({
          guildId,
          challenger,
          opponent,
          challengerProfile,
          opponentProfile,
          now
        }),
        challenger: cloneProfile(challengerProfile),
        opponent: cloneProfile(opponentProfile)
      };
    });
  }

  async playRpgPvpTurn({
    guildId,
    session,
    actorUserId,
    skillId = 'basic',
    now = Date.now()
  }) {
    const nextSession = cloneRpgPvpSession(session);

    if (nextSession.guildId !== guildId) {
      throw new Error('다른 서버의 RPG 대결입니다.');
    }

    if (nextSession.completed) {
      throw new Error('이미 종료된 RPG 대결입니다.');
    }

    const attackerSide = nextSession.turnSide;
    const defenderSide = attackerSide === 'challenger' ? 'opponent' : 'challenger';
    const attacker = nextSession.fighters[attackerSide];
    const defender = nextSession.fighters[defenderSide];

    if (attacker.userId !== actorUserId) {
      throw new Error(`${attacker.username}님의 차례입니다.`);
    }

    const skillConfig = prepareRpgPvpSessionSkill(attacker, skillId);
    const turn = resolveRpgPvpTurn({
      attacker,
      defender,
      skillId: skillConfig.id,
      randomInt: this.randomInt
    });

    attacker.mp = Math.max(0, attacker.mp - skillConfig.mpCost);
    defender.hp = Math.max(0, defender.hp - turn.damage);
    defender.guardBonus = 0;
    attacker.guardBonus = turn.guardBonus;
    nextSession.lastTurn = {
      ...turn,
      attackerSide,
      defenderSide
    };
    nextSession.updatedAt = now;

    if (defender.hp > 0) {
      nextSession.turn += 1;
      nextSession.turnSide = defenderSide;

      return {
        completed: false,
        type: 'pvp_turn',
        session: nextSession,
        turn: nextSession.lastTurn
      };
    }

    nextSession.completed = true;
    nextSession.winnerSide = attackerSide;
    nextSession.loserSide = defenderSide;
    const rewards = getRpgPvpDuelRewards(attacker.level);

    return this.store.update((data) => {
      const challengerProfile = getOrCreateProfile(
        data,
        guildId,
        nextSession.fighters.challenger.userId,
        nextSession.fighters.challenger.username,
        this
      );
      const opponentProfile = getOrCreateProfile(
        data,
        guildId,
        nextSession.fighters.opponent.userId,
        nextSession.fighters.opponent.username,
        this
      );
      const winnerProfile = attackerSide === 'challenger'
        ? challengerProfile
        : opponentProfile;
      const loserProfile = attackerSide === 'challenger'
        ? opponentProfile
        : challengerProfile;
      let levelResult = {
        leveledUp: false,
        levelsGained: 0,
        levelReward: 0
      };

      applyRpgPvpFighterState(challengerProfile, nextSession.fighters.challenger);
      applyRpgPvpFighterState(opponentProfile, nextSession.fighters.opponent);
      challengerProfile.rpg.battles += 1;
      opponentProfile.rpg.battles += 1;
      challengerProfile.rpg.pvpBattles += 1;
      opponentProfile.rpg.pvpBattles += 1;
      winnerProfile.rpg.wins += 1;
      winnerProfile.rpg.pvpWins += 1;
      loserProfile.rpg.losses += 1;
      loserProfile.rpg.pvpLosses += 1;
      incrementRpgDailyStats(challengerProfile.rpg, now, {
        battles: 1,
        wins: winnerProfile === challengerProfile ? 1 : 0,
        pvpWins: winnerProfile === challengerProfile ? 1 : 0
      });
      grantRpgClassMastery(challengerProfile, winnerProfile === challengerProfile ? 15 : 6);
      incrementRpgDailyStats(opponentProfile.rpg, now, {
        battles: 1,
        wins: winnerProfile === opponentProfile ? 1 : 0,
        pvpWins: winnerProfile === opponentProfile ? 1 : 0
      });
      grantRpgClassMastery(opponentProfile, winnerProfile === opponentProfile ? 15 : 6);
      creditCurrency(winnerProfile, CURRENCY_RPG, rewards.coins);
      levelResult = addXp(winnerProfile, rewards.xp, this);

      return {
        completed: true,
        type: 'pvp_turn',
        session: nextSession,
        turn: nextSession.lastTurn,
        winnerUserId: winnerProfile.userId,
        loserUserId: loserProfile.userId,
        rewards,
        xpGained: rewards.xp,
        coinReward: rewards.coins,
        ...levelResult,
        challenger: cloneProfile(challengerProfile),
        opponent: cloneProfile(opponentProfile)
      };
    });
  }

  async restRpg({ guildId, userId, username }) {
    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      const derivedStats = getProfileRpgDerivedStats(profile);
      const beforeHp = profile.rpg.hp;
      const beforeMp = profile.rpg.mp;

      profile.rpg.hp = derivedStats.maxHp;
      profile.rpg.mp = derivedStats.maxMp;

      return {
        beforeHp,
        beforeMp,
        healed: profile.rpg.hp - beforeHp,
        mpRestored: profile.rpg.mp - beforeMp,
        derivedStats,
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
      const derivedStats = getProfileRpgDerivedStats(profile);
      const exploration = resolveRpgExploration({
        playerLevel: profile.level,
        area: normalizedArea,
        randomInt: this.randomInt
      });
      const beforeHp = profile.rpg.hp;
      const beforeMp = profile.rpg.mp;
      let gearDrop = null;
      let levelResult = {
        leveledUp: false,
        levelsGained: 0,
        levelReward: 0
      };

      profile.rpg.explores += 1;
      profile.rpg.currentArea = normalizedArea;
      incrementRpgDailyStats(profile.rpg, now, {
        explores: 1
      });
      increaseRpgAreaProgress(profile.rpg, normalizedArea, exploration.event === 'trap' ? 4 : 10);
      grantRpgClassMastery(profile, 4);
      profile.rpg.hp = Math.max(1, Math.min(derivedStats.maxHp, profile.rpg.hp - exploration.damageTaken + exploration.hpRecovered));
      profile.rpg.mp = Math.max(0, Math.min(derivedStats.maxMp, profile.rpg.mp + exploration.mpRecovered));
      creditCurrency(profile, CURRENCY_RPG, exploration.rewards.coins);
      if (exploration.rewards.xp > 0) {
        levelResult = addXp(profile, exploration.rewards.xp, this);
      }
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
          label: '일반 전리품',
          stats: { attack: 2 },
          power: 1,
          assetId: 'item_iron_sword_icon'
        }, now);
      }

      return {
        exploration,
        beforeHp,
        beforeMp,
        gearDrop,
        xpGained: exploration.rewards.xp,
        coinReward: exploration.rewards.coins,
        ...levelResult,
        profile: cloneProfile(profile)
      };
    });
  }

  async runRpgDungeon({ guildId, userId, username, area = null, depth = 3, now = Date.now() }) {
    const safeDepth = Math.min(5, normalizePositiveInteger(depth, '던전 깊이'));

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      const normalizedArea = normalizeRpgArea(area || profile.rpg.currentArea);
      assertRpgAreaUnlocked(profile, normalizedArea);
      const derivedStats = getProfileRpgDerivedStats(profile);
      const floors = [];
      let totalXp = 0;
      let totalCoins = 0;
      let totalDamage = 0;
      let gearDrop = null;

      for (let floor = 1; floor <= safeDepth; floor += 1) {
        const event = resolveRpgExploration({
          playerLevel: profile.level + floor - 1,
          area: normalizedArea,
          randomInt: this.randomInt
        });
        totalXp += event.rewards.xp;
        totalCoins += event.rewards.coins;
        totalDamage += event.damageTaken;
        floors.push({ floor, ...event });
      }

      profile.rpg.dungeonRuns += 1;
      profile.rpg.currentArea = normalizedArea;
      incrementRpgDailyStats(profile.rpg, now, {
        dungeons: 1
      });
      increaseRpgAreaProgress(profile.rpg, normalizedArea, safeDepth * 12);
      grantRpgClassMastery(profile, safeDepth * 8);
      profile.rpg.hp = Math.max(1, Math.min(derivedStats.maxHp, profile.rpg.hp - totalDamage + safeDepth * 3));
      profile.rpg.mp = Math.max(0, Math.min(derivedStats.maxMp, profile.rpg.mp - safeDepth));
      creditCurrency(profile, CURRENCY_RPG, totalCoins);
      profile.rpg.dungeonClears[normalizedArea] = (profile.rpg.dungeonClears[normalizedArea] ?? 0) + 1;
      const levelResult = addXp(profile, totalXp, this);
      const blueprint = rollRpgGearDrop({
        source: 'dungeon',
        area: normalizedArea,
        difficulty: safeDepth >= 4 ? 'hard' : 'normal',
        randomInt: this.randomInt
      });
      if (blueprint) {
        gearDrop = addRpgGear(profile, blueprint, now);
      }

      return {
        area: normalizedArea,
        areaConfig: getRpgAreaConfig(normalizedArea),
        depth: safeDepth,
        floors,
        totalXp,
        totalCoins,
        totalDamage,
        gearDrop,
        ...levelResult,
        profile: cloneProfile(profile)
      };
    });
  }

  async equipRpgGear({ guildId, userId, username, gearId }) {
    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      const gear = resolveOwnedRpgGear(profile, gearId);

      profile.rpg.equippedGear[gear.slot] = gear.id;
      const derivedStats = getProfileRpgDerivedStats(profile);
      profile.rpg.hp = Math.min(profile.rpg.hp, derivedStats.maxHp);
      profile.rpg.mp = Math.min(profile.rpg.mp, derivedStats.maxMp);

      return {
        gear,
        slot: gear.slot,
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
      const cost = getRpgGearEnhanceCost(gear);
      const successRate = getRpgGearEnhanceSuccessRate(gear);
      const roll = this.randomInt(1, 100);
      const success = roll <= successRate;

      debitCurrency(
        profile,
        CURRENCY_RPG,
        cost,
        `골드가 부족합니다. 장비 강화 비용: ${cost.toLocaleString()}골드`
      );

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
        cost,
        beforeGear,
        gear: cloneRpgGear(gear),
        slot: gear.slot,
        derivedStats,
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
      if (profile.level < advancedClassConfig.unlockLevel) {
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
        heroAssetId: getRpgClassAssetId(profile.rpg.characterClass, profile.rpg.characterGender),
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
      const levelResult = addXp(profile, chapter.rewards.xp, this);

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
      const levelResult = addXp(profile, codex.rewards.xp, this);

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
      if (profile.level < raid.unlockLevel) {
        throw new Error(`${raid.label} 레이드는 Lv.${raid.unlockLevel}부터 도전할 수 있습니다.`);
      }
      assertRpgAreaUnlocked(profile, raid.area);
      if (profile.rpg.hp <= 1) {
        throw new Error('HP가 부족합니다. `/rpg 휴식` 또는 회복 포션을 사용하세요.');
      }

      const skillConfig = prepareRpgSkill(profile, skill);
      const battle = resolveRpgRaidBattle({
        playerLevel: profile.level,
        raidId: normalizedRaidId,
        characterClass: profile.rpg.characterClass,
        characterGender: profile.rpg.characterGender,
        skillId: skillConfig.id,
        statBonuses: getRpgCombatBonuses(profile),
        randomInt: this.randomInt
      });
      let gearDrop = null;
      let levelResult = {
        leveledUp: false,
        levelsGained: 0,
        levelReward: 0
      };

      profile.rpg.battles += 1;
      profile.rpg.lastBattleAt = now;
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
        creditCurrency(profile, CURRENCY_RPG, battle.rewards.coins);
        gearDrop = addRpgGear(profile, rollRpgGearDrop({
          source: 'raid',
          area: battle.area,
          difficulty: 'hard',
          randomInt: this.randomInt
        }), now);
        levelResult = addXp(profile, battle.rewards.xp, this);
      } else {
        profile.rpg.losses += 1;
      }

      return {
        battled: true,
        battle,
        assets: battle.assets,
        gearDrop,
        xpGained: battle.rewards.xp,
        coinReward: battle.rewards.coins,
        ...levelResult,
        profile: cloneProfile(profile)
      };
    });
  }

  async playRpgGuildRaid({ guildId, userId, username, raidId = 'slime_horde', skill = 'basic', now = Date.now() }) {
    const normalizedRaidId = normalizeRpgRaidId(raidId);
    const raid = getRpgRaidConfig(normalizedRaidId);

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      const guild = data.guilds[guildId];
      if (profile.level < raid.unlockLevel) {
        throw new Error(`${raid.label} 길드 레이드는 Lv.${raid.unlockLevel}부터 지휘할 수 있습니다.`);
      }
      assertRpgAreaUnlocked(profile, raid.area);
      if (profile.rpg.hp <= 1) {
        throw new Error('HP가 부족합니다. `/rpg 휴식` 또는 회복 포션을 사용하세요.');
      }

      const skillConfig = prepareRpgSkill(profile, skill);
      const partyProfiles = getRpgGuildRaidPartyProfiles(data, guildId, guild, profile, this);
      const battle = resolveRpgGuildRaidBattle({
        playerLevel: profile.level,
        raidId: normalizedRaidId,
        characterClass: profile.rpg.characterClass,
        characterGender: profile.rpg.characterGender,
        skillId: skillConfig.id,
        statBonuses: getRpgCombatBonuses(profile),
        partyMembers: partyProfiles.map((partyProfile) => createRpgGuildRaidMember(partyProfile)),
        randomInt: this.randomInt
      });
      let gearDrop = null;
      let levelResult = {
        leveledUp: false,
        levelsGained: 0,
        levelReward: 0
      };
      const supportRewards = [];

      profile.rpg.battles += 1;
      profile.rpg.lastBattleAt = now;
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

      if (battle.win) {
        profile.rpg.wins += 1;
        profile.rpg.raidClears[normalizedRaidId] = (profile.rpg.raidClears[normalizedRaidId] ?? 0) + 1;
        profile.rpg.monsterKills[battle.monster] = (profile.rpg.monsterKills[battle.monster] ?? 0) + 1;
        creditCurrency(profile, CURRENCY_RPG, battle.rewards.coins);
        gearDrop = addRpgGear(profile, rollRpgGearDrop({
          source: 'raid',
          area: battle.area,
          difficulty: 'hard',
          randomInt: this.randomInt
        }), now);
        levelResult = addXp(profile, battle.rewards.xp, this);

        for (const supportProfile of partyProfiles.slice(1)) {
          creditCurrency(supportProfile, CURRENCY_RPG, battle.supportRewards.coins);
          const supportLevelResult = addXp(supportProfile, battle.supportRewards.xp, this);
          supportProfile.rpg.discoveredMonsters[battle.monster] = (supportProfile.rpg.discoveredMonsters[battle.monster] ?? 0) + 1;
          supportProfile.rpg.raidClears[normalizedRaidId] = (supportProfile.rpg.raidClears[normalizedRaidId] ?? 0) + 1;
          grantRpgClassMastery(supportProfile, 15);
          supportRewards.push({
            userId: supportProfile.userId,
            username: supportProfile.username,
            xpGained: battle.supportRewards.xp,
            coinReward: battle.supportRewards.coins,
            ...supportLevelResult,
            profile: cloneProfile(supportProfile)
          });
        }
      } else {
        profile.rpg.losses += 1;
      }

      return {
        battled: true,
        battle,
        assets: battle.assets,
        gearDrop,
        supportRewards,
        xpGained: battle.rewards.xp,
        coinReward: battle.rewards.coins,
        ...levelResult,
        profile: cloneProfile(profile)
      };
    });
  }

  async getSwordStatus({ guildId, userId, username, now = Date.now() }) {
    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      resetSwordDailyState(profile.sword, now);
      const today = getDayIndex(now);

      return {
        profile: cloneProfile(profile),
        saleValue: getSwordSellValue(profile.sword.level),
        normalEnhance: getSwordEnhanceConfig(profile.sword.level),
        advancedEnhance: getAdvancedSwordEnhanceConfig(profile.sword.level),
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
      const guild = data.guilds?.[guildId];
      if (!guild) return [];

      return Object.entries(guild.users ?? {})
        .map(([userId, profile]) => {
          const normalizedProfile = cloneProfile(getOrCreateProfile(data, guildId, userId, profile?.username, this));
          return {
            ...normalizedProfile,
            metric: normalizedProfile.sword[normalizedCategory] ?? 0
          };
        })
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
      let enhancement = resolveSwordEnhancement({
        level: profile.sword.level,
        mode: 'normal',
        randomInt: this.randomInt
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
          outcome: 'protect',
          outcomeLabel: '보호',
          originalOutcome: 'destroy',
          protected: true,
          refineStoneReward: 0
        };
      }
      applySwordEnhancement(profile, enhancement, now, 'normal');

      return {
        ...enhancement,
        profile: cloneProfile(profile)
      };
    });
  }

  async advancedEnhanceSword({ guildId, userId, username, now = Date.now() }) {
    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      const enhancement = resolveSwordEnhancement({
        level: profile.sword.level,
        mode: 'advanced',
        randomInt: this.randomInt
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

      const opponent = createRandomSwordOpponent({
        profile,
        randomInt: this.randomInt
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
      to.balance += normalizedAmount;

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

      debitCurrency(profile, CURRENCY_CASINO, normalizedBet, '골드가 부족합니다.');
      creditCurrency(profile, CURRENCY_CASINO, normalizedPayout);

      return {
        bet: normalizedBet,
        payout: normalizedPayout,
        profit: normalizedPayout - normalizedBet,
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
      creditCurrency(profile, CURRENCY_CASINO, normalizedPayout);

      return {
        bet: normalizedBet,
        payout: normalizedPayout,
        profit: normalizedPayout - normalizedBet,
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
      const guild = data.guilds?.[guildId];

      if (!guild) return [];

      return Object.entries(guild.users ?? {})
        .map(([userId, profile]) =>
          cloneProfile(getOrCreateProfile(data, guildId, userId, profile?.username, this))
        )
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

function getOrCreateProfile(data, guildId, userId, username, economy) {
  data.guilds ??= {};
  data.guilds[guildId] ??= {};

  const guild = data.guilds[guildId];
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
    lastFortuneXpDay: null,
    rpg: createDefaultRpgStats(),
    sword: createDefaultSwordStats(),
    createdAt: Date.now()
  };

  const profile = guild.users[userId];
  profile.userId = userId;
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
  profile.rpg = normalizeRpgStats(profile.rpg, profile.level);
  profile.sword = normalizeSwordStats(profile.sword);
  profile.createdAt = normalizeStoredNonNegativeInteger(profile.createdAt) || Date.now();
  reconcileProfileProgress(profile, economy);

  return profile;
}

function cloneProfile(profile) {
  return {
    userId: profile.userId,
    username: profile.username,
    level: profile.level,
    xp: profile.xp,
    totalXp: profile.totalXp,
    balance: profile.balance,
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
    dungeonClears: { ...rpg.dungeonClears },
    raidClears: { ...rpg.raidClears },
    areaProgress: { ...rpg.areaProgress },
    classMastery: cloneClassMastery(rpg.classMastery),
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

function addXp(profile, xp, economy) {
  const beforeLevel = profile.level;
  let levelReward = 0;

  profile.xp += xp;
  profile.totalXp += xp;

  while (profile.xp >= economy.xpForNextLevel(profile.level)) {
    profile.xp -= economy.xpForNextLevel(profile.level);
    profile.level += 1;
    const reward = getLevelReward(profile.level);
    levelReward += reward;
    profile.balance += reward;
  }

  if (profile.rpg) {
    profile.rpg = normalizeRpgStats(profile.rpg, profile.level);
  }

  return {
    leveledUp: profile.level > beforeLevel,
    levelsGained: profile.level - beforeLevel,
    levelReward
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
    characterClass: 'novice',
    characterGender: 'male',
    startedAt: 0,
    hp: 110,
    mp: 35,
    unlockedClasses: getStarterRpgClassIds(),
    inventory: {},
    equipment: getDefaultRpgEquipment(),
    gearInventory: {},
    equippedGear: getDefaultRpgEquipment(),
    learnedSkills: [],
    advancedClass: null,
    currentArea: 'forest',
    unlockedAreas: ['forest'],
    discoveredMonsters: {},
    monsterKills: {},
    areaWins: {},
    bossKills: {},
    claimedQuests: {},
    storyChapters: {},
    codexClaims: {},
    dungeonClears: {},
    raidClears: {},
    areaProgress: {},
    classMastery: {},
    gacha: {
      totalPulls: 0,
      pity: 0
    },
    daily: createDefaultRpgDailyStats(),
    explores: 0,
    dungeonRuns: 0,
    battles: 0,
    wins: 0,
    losses: 0,
    pvpBattles: 0,
    pvpWins: 0,
    pvpLosses: 0,
    lastBattleAt: 0
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
    pvpWins: 0,
    claimedMissions: {}
  };
}

function normalizeRpgStats(stats = {}, level = 1) {
  const safeStats = stats && typeof stats === 'object' ? stats : {};
  const unlockedAreas = getUnlockedRpgAreaIds(level);
  const characterClass = normalizeStoredRpgClass(safeStats.characterClass);
  const characterGender = normalizeStoredRpgGender(safeStats.characterGender);
  const advancedClass = normalizeStoredRpgAdvancedClass(safeStats.advancedClass, characterClass);
  const currentArea = normalizeStoredRpgArea(safeStats.currentArea, unlockedAreas);
  const equipment = normalizeRpgEquipment(safeStats.equipment);
  const gearInventory = normalizeGearInventory(safeStats.gearInventory);
  const equippedGear = normalizeEquippedGear(safeStats.equippedGear, gearInventory);
  const learnedSkills = normalizeLearnedRpgSkills(safeStats.learnedSkills);
  const daily = normalizeRpgDailyStats(safeStats.daily);
  const areaProgress = normalizeAreaProgress(safeStats.areaProgress);
  const classMastery = normalizeClassMastery(safeStats.classMastery, characterClass);
  const derivedStats = getRpgDerivedStats({
    level,
    characterClass,
    equipment,
    advancedClass,
    learnedSkills,
    gearInventory,
    equippedGear
  });
  const hp = safeStats.hp === undefined || safeStats.hp === null
    ? derivedStats.maxHp
    : Math.min(derivedStats.maxHp, Math.max(0, normalizeStoredNonNegativeInteger(safeStats.hp)));
  const mp = safeStats.mp === undefined || safeStats.mp === null
    ? derivedStats.maxMp
    : Math.min(derivedStats.maxMp, Math.max(0, normalizeStoredNonNegativeInteger(safeStats.mp)));
  const unlockedClasses = normalizeUnlockedClasses(safeStats.unlockedClasses);
  if (!unlockedClasses.includes(characterClass)) {
    unlockedClasses.push(characterClass);
  }

  return {
    ...createDefaultRpgStats(),
    ...safeStats,
    characterClass,
    characterGender,
    advancedClass,
    startedAt: normalizeStoredNonNegativeInteger(safeStats.startedAt),
    hp,
    mp,
    unlockedClasses,
    inventory: normalizeInventory(safeStats.inventory),
    equipment,
    gearInventory,
    equippedGear,
    learnedSkills,
    currentArea,
    unlockedAreas,
    discoveredMonsters: normalizeCounterMap(safeStats.discoveredMonsters),
    monsterKills: normalizeCounterMap(safeStats.monsterKills),
    areaWins: normalizeCounterMap(safeStats.areaWins),
    bossKills: normalizeCounterMap(safeStats.bossKills),
    claimedQuests: normalizeClaimedQuests(safeStats.claimedQuests),
    storyChapters: normalizeTimestampMap(safeStats.storyChapters),
    codexClaims: normalizeTimestampMap(safeStats.codexClaims),
    dungeonClears: normalizeCounterMap(safeStats.dungeonClears),
    raidClears: normalizeCounterMap(safeStats.raidClears),
    areaProgress,
    classMastery,
    gacha: normalizeGachaStats(safeStats.gacha),
    daily,
    explores: normalizeStoredNonNegativeInteger(safeStats.explores),
    dungeonRuns: normalizeStoredNonNegativeInteger(safeStats.dungeonRuns),
    battles: normalizeStoredNonNegativeInteger(safeStats.battles),
    wins: normalizeStoredNonNegativeInteger(safeStats.wins),
    losses: normalizeStoredNonNegativeInteger(safeStats.losses),
    pvpBattles: normalizeStoredNonNegativeInteger(safeStats.pvpBattles),
    pvpWins: normalizeStoredNonNegativeInteger(safeStats.pvpWins),
    pvpLosses: normalizeStoredNonNegativeInteger(safeStats.pvpLosses),
    lastBattleAt: normalizeStoredNonNegativeInteger(safeStats.lastBattleAt)
  };
}

function normalizeStoredRpgClass(value) {
  try {
    return normalizeRpgClass(value);
  } catch {
    return 'novice';
  }
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
    pvpWins: normalizeStoredNonNegativeInteger(safeDaily.pvpWins),
    claimedMissions: normalizeDailyMissionClaims(safeDaily.claimedMissions)
  };
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

function getRpgCooldownRemaining(profile, now, cooldownMs) {
  if (!profile.rpg.lastBattleAt) return 0;

  const elapsed = now - profile.rpg.lastBattleAt;
  return elapsed >= cooldownMs ? 0 : cooldownMs - elapsed;
}

function createRpgBossSessionId(now = Date.now()) {
  return `boss_${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
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

function createRpgPvpDuelSession({
  guildId,
  challenger,
  opponent,
  challengerProfile,
  opponentProfile,
  now
}) {
  return {
    id: createRpgPvpSessionId(now),
    guildId,
    type: 'pvp_turn',
    createdAt: now,
    updatedAt: now,
    turn: 1,
    turnSide: 'challenger',
    completed: false,
    winnerSide: null,
    loserSide: null,
    lastTurn: null,
    assets: {
      background: 'map_ancient_ruins'
    },
    fighters: {
      challenger: createRpgPvpSessionFighter(challengerProfile, challenger),
      opponent: createRpgPvpSessionFighter(opponentProfile, opponent)
    }
  };
}

function createRpgPvpSessionId(now = Date.now()) {
  return `${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function createRpgPvpSessionFighter(profile, participant = {}) {
  const derivedStats = getProfileRpgDerivedStats(profile);
  const classConfig = getRpgClassConfig(profile.rpg.characterClass);
  const genderConfig = getRpgGenderConfig(profile.rpg.characterGender);

  return {
    userId: profile.userId,
    username: profile.username,
    mention: participant.mention ?? `<@${profile.userId}>`,
    level: profile.level,
    characterClass: profile.rpg.characterClass,
    characterClassLabel: classConfig.label,
    characterGender: profile.rpg.characterGender,
    characterGenderLabel: genderConfig.label,
    stats: derivedStats,
    hp: profile.rpg.hp,
    maxHp: derivedStats.maxHp,
    mp: profile.rpg.mp,
    maxMp: derivedStats.maxMp,
    guardBonus: 0,
    availableSkillIds: getAvailableRpgSkillIds(profile.rpg.characterClass),
    assets: {
      hero: getRpgClassAssetId(profile.rpg.characterClass, profile.rpg.characterGender)
    }
  };
}

function cloneRpgPvpSession(session = {}) {
  if (!session || typeof session !== 'object') {
    throw new Error('RPG 대결 세션이 없습니다.');
  }

  const fighters = session.fighters && typeof session.fighters === 'object'
    ? session.fighters
    : {};

  return {
    ...session,
    assets: { ...(session.assets ?? {}) },
    lastTurn: session.lastTurn ? cloneRpgPvpTurn(session.lastTurn) : null,
    fighters: {
      challenger: cloneRpgPvpFighter(fighters.challenger),
      opponent: cloneRpgPvpFighter(fighters.opponent)
    }
  };
}

function cloneRpgPvpFighter(fighter = {}) {
  return {
    ...fighter,
    stats: { ...(fighter.stats ?? {}) },
    availableSkillIds: [...(fighter.availableSkillIds ?? ['basic'])],
    assets: { ...(fighter.assets ?? {}) }
  };
}

function cloneRpgPvpTurn(turn) {
  return {
    ...turn,
    attacker: turn.attacker ? {
      ...turn.attacker,
      stats: { ...(turn.attacker.stats ?? {}) },
      assets: { ...(turn.attacker.assets ?? {}) }
    } : null,
    defender: turn.defender ? {
      ...turn.defender,
      stats: { ...(turn.defender.stats ?? {}) },
      assets: { ...(turn.defender.assets ?? {}) }
    } : null
  };
}

function prepareRpgPvpSessionSkill(fighter, skillId) {
  const normalizedSkillId = normalizeRpgSkillId(skillId);
  const skill = getRpgSkillConfig(normalizedSkillId);

  if (!fighter.availableSkillIds.includes(normalizedSkillId)) {
    throw new Error(`${fighter.characterClassLabel} 직업은 ${skill.label} 스킬을 사용할 수 없습니다.`);
  }

  if (fighter.mp < skill.mpCost) {
    throw new Error(`MP가 부족합니다. 필요 MP: ${skill.mpCost}, 현재 MP: ${fighter.mp}`);
  }

  return {
    id: normalizedSkillId,
    ...skill
  };
}

function getRpgPvpDuelRewards(winnerLevel) {
  const safeLevel = Math.max(1, Number(winnerLevel) || 1);

  return {
    xp: 60 + safeLevel * 20,
    coins: 120 + safeLevel * 30
  };
}

function applyRpgPvpFighterState(profile, fighter) {
  const derivedStats = getProfileRpgDerivedStats(profile);
  profile.rpg.hp = Math.max(1, Math.min(derivedStats.maxHp, normalizeStoredNonNegativeInteger(fighter.hp)));
  profile.rpg.mp = Math.max(0, Math.min(derivedStats.maxMp, normalizeStoredNonNegativeInteger(fighter.mp)));
}

function createBlockedRpgPvpResult({
  blockedSide,
  blockedProfile,
  remainingMs,
  challengerProfile,
  opponentProfile
}) {
  return {
    started: false,
    battled: false,
    type: 'pvp',
    blockedSide,
    blockedUserId: blockedProfile.userId,
    blockedUsername: blockedProfile.username,
    remainingMs,
    cooldownRemainingMs: remainingMs,
    challenger: cloneProfile(challengerProfile),
    opponent: cloneProfile(opponentProfile)
  };
}

function assertRpgAreaUnlocked(profile, area) {
  const normalizedArea = normalizeRpgArea(area);
  const unlockedAreas = getUnlockedRpgAreaIds(profile.level);
  const areaConfig = getRpgAreaConfig(normalizedArea);

  if (!unlockedAreas.includes(normalizedArea)) {
    throw new Error(`${areaConfig.label} 지역은 Lv.${areaConfig.unlockLevel}부터 입장할 수 있습니다.`);
  }
}

function addInventoryItem(inventory, itemId, count) {
  const normalizedItemId = normalizeRpgItemId(itemId);
  const normalizedCount = normalizePositiveInteger(count, '아이템 수량');
  inventory[normalizedItemId] = (inventory[normalizedItemId] ?? 0) + normalizedCount;
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

function getRpgGuildRaidPartyProfiles(data, guildId, guild, leaderProfile, economy) {
  const profiles = Object.entries(guild.users ?? {})
    .map(([memberId, memberProfile]) => getOrCreateProfile(
      data,
      guildId,
      memberId,
      memberProfile?.username,
      economy
    ))
    .filter((profile) => profile.rpg.startedAt > 0)
    .filter((profile) => profile.rpg.hp > 1)
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

function createRpgGuildRaidMember(profile) {
  return {
    userId: profile.userId,
    username: profile.username,
    level: profile.level,
    characterClass: profile.rpg.characterClass,
    characterGender: profile.rpg.characterGender,
    stats: getProfileRpgDerivedStats(profile)
  };
}

function resolveOwnedRpgGear(profile, selector) {
  const rawSelector = String(selector || '').trim();

  if (!rawSelector) {
    throw new Error('장착할 전리품 번호나 이름을 입력하세요. `/rpg 전리품`에서 버튼 목록을 볼 수 있습니다.');
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

  throw new Error('보유한 전리품 장비를 찾을 수 없습니다. `/rpg 전리품`에서 번호 버튼을 확인하세요.');
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
    level: profile.level,
    characterClass: overrides.characterClass ?? profile.rpg.characterClass,
    equipment: overrides.equipment ?? profile.rpg.equipment,
    advancedClass: overrides.advancedClass ?? profile.rpg.advancedClass,
    learnedSkills: overrides.learnedSkills ?? profile.rpg.learnedSkills,
    gearInventory: overrides.gearInventory ?? profile.rpg.gearInventory,
    equippedGear: overrides.equippedGear ?? profile.rpg.equippedGear
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
  const availableSkillIds = getAvailableRpgSkillIds(profile.rpg.characterClass);

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
