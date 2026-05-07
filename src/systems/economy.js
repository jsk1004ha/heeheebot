import {
  getAvailableRpgSkillIds,
  getDefaultRpgEquipment,
  getRpgAreaConfig,
  getRpgAdvancedClassConfig,
  getRpgBossConfig,
  getRpgClassAssetId,
  getRpgClassConfig,
  getRpgDerivedStats,
  getRpgGachaBannerConfig,
  getRpgGenderConfig,
  getRpgItemConfig,
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
  getSwordSellValue,
  resolveSwordBattle as resolveSwordBattleResult,
  resolveSwordEnhancement
} from './sword.js';

const DEFAULT_OPTIONS = Object.freeze({
  messageCooldownMs: 60_000,
  messageXpMin: 5,
  messageXpMax: 15,
  firstMessageXpBonus: 50,
  dailyCooldownMs: 24 * 60 * 60 * 1000,
  dailyCoinReward: 500,
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

      profile.balance += this.options.dailyCoinReward;
      profile.lastDailyAt = now;
      profile.lastDailyDay = today;
      profile.dailyStreak = streak;

      const levelResult = addXp(profile, xpGained, this);

      return {
        claimed: true,
        reward: this.options.dailyCoinReward,
        coinReward: this.options.dailyCoinReward,
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

      if (profile.balance < totalPrice) {
        throw new Error('잔액이 부족합니다.');
      }

      profile.balance -= totalPrice;
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

      profile.balance += quest.rewards.coins;
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

  async getRpgStatus({ guildId, userId, username, now = Date.now() }) {
    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      profile.rpg.unlockedAreas = getUnlockedRpgAreaIds(profile.level);
      const derivedStats = getProfileRpgDerivedStats(profile);

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
        availableSkillIds: getAvailableRpgSkillIds(profile.rpg.characterClass),
        currentArea: getRpgAreaConfig(profile.rpg.currentArea),
        unlockedAreas: profile.rpg.unlockedAreas.map((area) => ({
          id: area,
          ...getRpgAreaConfig(area)
        })),
        cooldownRemainingMs: getRpgCooldownRemaining(
          profile,
          now,
          this.options.rpgBattleCooldownMs
        )
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
        profile.balance += battle.rewards.coins;
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
        profile.balance += battle.rewards.coins;
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
      winnerProfile.balance += rewards.coins;
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

      if (profile.balance < totalCost) {
        throw new Error('잔액이 부족합니다.');
      }

      profile.balance -= totalCost;
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
      profile.rpg.hp = Math.max(1, Math.min(derivedStats.maxHp, profile.rpg.hp - exploration.damageTaken + exploration.hpRecovered));
      profile.rpg.mp = Math.max(0, Math.min(derivedStats.maxMp, profile.rpg.mp + exploration.mpRecovered));
      profile.balance += exploration.rewards.coins;
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
      profile.rpg.hp = Math.max(1, Math.min(derivedStats.maxHp, profile.rpg.hp - totalDamage + safeDepth * 3));
      profile.rpg.mp = Math.max(0, Math.min(derivedStats.maxMp, profile.rpg.mp - safeDepth));
      profile.balance += totalCoins;
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

      if (profile.rpg.characterClass !== advancedClassConfig.baseClass) {
        throw new Error(`${advancedClassConfig.label} 전직은 ${getRpgClassConfig(advancedClassConfig.baseClass).label}만 가능합니다.`);
      }
      if (profile.level < advancedClassConfig.unlockLevel) {
        throw new Error(`${advancedClassConfig.label} 전직은 Lv.${advancedClassConfig.unlockLevel}부터 가능합니다.`);
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
      profile.balance += chapter.rewards.coins;
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
      profile.balance += codex.rewards.coins;
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

      if (battle.win) {
        profile.rpg.wins += 1;
        profile.rpg.raidClears[normalizedRaidId] = (profile.rpg.raidClears[normalizedRaidId] ?? 0) + 1;
        profile.rpg.monsterKills[battle.monster] = (profile.rpg.monsterKills[battle.monster] ?? 0) + 1;
        profile.balance += battle.rewards.coins;
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

  async getSwordStatus({ guildId, userId, username, now = Date.now() }) {
    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      resetSwordDailyState(profile.sword, now);
      const today = getDayIndex(now);

      return {
        profile: cloneProfile(profile),
        giftAvailable: profile.sword.lastGiftDay !== today,
        giftRemainingMs: profile.sword.lastGiftDay === today ? getNextDayStartMs(now) - now : 0,
        battleRemaining: Math.max(0, MAX_DAILY_SWORD_BATTLES - profile.sword.battlesToday),
        battleStoneRemaining: Math.max(0, MAX_DAILY_SWORD_BATTLE_STONES - profile.sword.battleStonesToday)
      };
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

  async enhanceSword({ guildId, userId, username, now = Date.now() }) {
    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, this);
      const enhancement = resolveSwordEnhancement({
        level: profile.sword.level,
        mode: 'normal',
        randomInt: this.randomInt
      });

      if (profile.balance < enhancement.moneyCost) {
        throw new Error(`잔액이 부족합니다. 필요 금액: ${enhancement.moneyCost.toLocaleString()}원`);
      }

      profile.balance -= enhancement.moneyCost;
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

      if (profile.balance < enhancement.moneyCost) {
        throw new Error(`잔액이 부족합니다. 필요 금액: ${enhancement.moneyCost.toLocaleString()}원`);
      }

      if (profile.sword.refineStones < enhancement.stoneCost) {
        throw new Error(`제련석이 부족합니다. 필요 제련석: ${enhancement.stoneCost.toLocaleString()}개`);
      }

      profile.balance -= enhancement.moneyCost;
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

      profile.balance += saleValue;
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
        profile.balance += battle.rewards.money;
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
      winnerProfile.balance += battle.rewards.money;
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

      if (profile.balance < normalizedBet) {
        throw new Error('잔액이 부족합니다.');
      }

      profile.balance = profile.balance - normalizedBet + normalizedPayout;

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

      if (profile.balance < normalizedBet) {
        throw new Error('잔액이 부족합니다.');
      }

      profile.balance -= normalizedBet;

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
      profile.balance += normalizedPayout;

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

      if (challengerProfile.balance < normalizedBet) {
        throw new Error(`${challengerProfile.username}님의 잔액이 부족합니다.`);
      }

      if (opponentProfile.balance < normalizedBet) {
        throw new Error(`${opponentProfile.username}님의 잔액이 부족합니다.`);
      }

      challengerProfile.balance -= normalizedBet;
      opponentProfile.balance -= normalizedBet;

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
        challengerProfile.balance += normalizedBet;
        opponentProfile.balance += normalizedBet;

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
      winnerProfile.balance += pot;

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

      if (challengerProfile.balance < normalizedBet) {
        throw new Error(`${challengerProfile.username}님의 잔액이 부족합니다.`);
      }

      if (opponentProfile.balance < normalizedBet) {
        throw new Error(`${opponentProfile.username}님의 잔액이 부족합니다.`);
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

      challengerProfile.balance -= normalizedBet;
      opponentProfile.balance -= normalizedBet;

      const winnerProfile = winnerUserId === challenger.userId
        ? challengerProfile
        : opponentProfile;
      winnerProfile.balance += normalizedBet * 2;

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
    lastMessageRewardAt: profile.lastMessageRewardAt,
    lastDailyAt: profile.lastDailyAt,
    lastDailyDay: profile.lastDailyDay,
    dailyStreak: profile.dailyStreak,
    lastFirstMessageBonusDay: profile.lastFirstMessageBonusDay,
    lastFortuneXpDay: profile.lastFortuneXpDay,
    rpg: cloneRpgStats(profile.rpg),
    sword: cloneSwordStats(profile.sword),
    createdAt: profile.createdAt
  };
}


function cloneSwordStats(sword) {
  return { ...sword };
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
    gacha: { ...rpg.gacha }
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
    lastBattleAt: normalizeStoredNonNegativeInteger(safeStats.lastBattleAt),
    soldCount: normalizeStoredNonNegativeInteger(safeStats.soldCount),
    saleEarnings: normalizeStoredNonNegativeInteger(safeStats.saleEarnings),
    lastSoldAt: normalizeStoredNonNegativeInteger(safeStats.lastSoldAt)
  };
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
    gacha: {
      totalPulls: 0,
      pity: 0
    },
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
    gacha: normalizeGachaStats(safeStats.gacha),
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

    profile.balance += 150;
    pull.duplicateCompensation = 150;
  }
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
