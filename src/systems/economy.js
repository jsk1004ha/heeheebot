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
      const profile = getOrCreateProfile(data, guildId, userId, username);
      return cloneProfile(profile);
    });
  }

  async rewardMessage({ guildId, userId, username, now = Date.now() }) {
    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username);
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
      const profile = getOrCreateProfile(data, guildId, userId, username);
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

  async awardWordChainResults({ guildId, participants, winnerUserId = null }) {
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
        const profile = getOrCreateProfile(data, guildId, participant.userId, participant.username);
        const levelResult = addXp(profile, xpGained, this);
        const moneyGained = participant.userId === winnerUserId
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

      return {
        source: '끝말잇기 결과',
        winner,
        winnerUserId: winner?.userId ?? null,
        winnerMoney: winner?.moneyGained ?? 0,
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
      const profile = getOrCreateProfile(data, guildId, userId, username);
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

  async awardActivityXp({ guildId, userId, username, xp, source = '활동' }) {
    const normalizedXp = normalizeNonNegativeInteger(xp, '경험치');

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username);
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
      const from = getOrCreateProfile(data, guildId, fromUserId, fromUsername);
      const to = getOrCreateProfile(data, guildId, toUserId, toUsername);

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
      const profile = getOrCreateProfile(data, guildId, userId, username);

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

  async settlePlayerPot({ guildId, challenger, opponent, bet, winnerUserId }) {
    const normalizedBet = normalizePositiveInteger(bet, '베팅액');

    if (challenger.userId === opponent.userId) {
      throw new Error('자기 자신과는 대결할 수 없습니다.');
    }

    return this.store.update((data) => {
      const challengerProfile = getOrCreateProfile(data, guildId, challenger.userId, challenger.username);
      const opponentProfile = getOrCreateProfile(data, guildId, opponent.userId, opponent.username);

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
    const data = await this.store.load();
    const guild = data.guilds?.[guildId];

    if (!guild) return [];

    return Object.values(guild.users)
      .map(cloneProfile)
      .sort((a, b) => {
        if (b.level !== a.level) return b.level - a.level;
        if (b.totalXp !== a.totalXp) return b.totalXp - a.totalXp;
        return b.balance - a.balance;
      })
      .slice(0, limit);
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

function getOrCreateProfile(data, guildId, userId, username) {
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
    createdAt: Date.now()
  };

  guild.users[userId].lastDailyDay ??= guild.users[userId].lastDailyAt > 0
    ? getDayIndex(guild.users[userId].lastDailyAt)
    : null;
  guild.users[userId].dailyStreak ??= 0;
  guild.users[userId].lastFirstMessageBonusDay ??= null;
  guild.users[userId].lastFortuneXpDay ??= null;
  guild.users[userId].username = username || guild.users[userId].username;
  return guild.users[userId];
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
    createdAt: profile.createdAt
  };
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

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
