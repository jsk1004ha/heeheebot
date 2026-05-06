const DEFAULT_OPTIONS = Object.freeze({
  messageCooldownMs: 60_000,
  messageXpMin: 8,
  messageXpMax: 15,
  messageMoneyMin: 2,
  messageMoneyMax: 5,
  dailyCooldownMs: 24 * 60 * 60 * 1000,
  dailyReward: 500,
  levelBaseXp: 100,
  levelXpStep: 50
});

export class EconomyService {
  constructor(store, options = {}) {
    this.store = store;
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options
    };
    this.randomInt = options.randomInt ?? randomInt;
  }

  xpForNextLevel(level) {
    return this.options.levelBaseXp + Math.max(0, level - 1) * this.options.levelXpStep;
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
      const moneyGained = this.randomInt(this.options.messageMoneyMin, this.options.messageMoneyMax);

      profile.xp += xpGained;
      profile.totalXp += xpGained;
      profile.balance += moneyGained;
      profile.lastMessageRewardAt = now;

      const beforeLevel = profile.level;
      let levelReward = 0;

      while (profile.xp >= this.xpForNextLevel(profile.level)) {
        profile.xp -= this.xpForNextLevel(profile.level);
        profile.level += 1;
        const reward = getLevelReward(profile.level);
        levelReward += reward;
        profile.balance += reward;
      }

      return {
        awarded: true,
        xpGained,
        moneyGained,
        leveledUp: profile.level > beforeLevel,
        levelsGained: profile.level - beforeLevel,
        levelReward,
        profile: cloneProfile(profile)
      };
    });
  }

  async claimDaily({ guildId, userId, username, now = Date.now() }) {
    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username);
      const elapsed = now - profile.lastDailyAt;

      if (profile.lastDailyAt > 0 && elapsed < this.options.dailyCooldownMs) {
        return {
          claimed: false,
          remainingMs: this.options.dailyCooldownMs - elapsed,
          profile: cloneProfile(profile)
        };
      }

      profile.balance += this.options.dailyReward;
      profile.lastDailyAt = now;

      return {
        claimed: true,
        reward: this.options.dailyReward,
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
    createdAt: Date.now()
  };

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
    createdAt: profile.createdAt
  };
}

function getLevelReward(level) {
  return level * 100;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
