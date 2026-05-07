const DAY_MS = 24 * 60 * 60 * 1000;
const KOREA_TIME_OFFSET_MS = 9 * 60 * 60 * 1000;

export const DEFAULT_SEASON_ID = 'heehee_season_1';

export const DEFAULT_SEASON = Object.freeze({
  id: DEFAULT_SEASON_ID,
  name: '희희봇 시즌 1: 원숭이 대침공',
  description: 'RPG, 검 강화, 검배틀을 플레이하며 시즌 포인트를 모으는 통합 이벤트입니다.'
});

export const SEASON_POINT_SOURCES = Object.freeze({
  RPG_BATTLE_WIN: 'rpg_battle_win',
  RPG_DAILY_CLAIM: 'rpg_daily_claim',
  SWORD_ENHANCE: 'sword_enhance',
  SWORD_BATTLE_WIN: 'sword_battle_win',
  SWORD_BATTLE_PLAY: 'sword_battle_play'
});

export const SEASON_SOURCE_LABELS = Object.freeze({
  [SEASON_POINT_SOURCES.RPG_BATTLE_WIN]: 'RPG 전투 승리',
  [SEASON_POINT_SOURCES.RPG_DAILY_CLAIM]: 'RPG 일일 의뢰',
  [SEASON_POINT_SOURCES.SWORD_ENHANCE]: '검 강화',
  [SEASON_POINT_SOURCES.SWORD_BATTLE_WIN]: '검배틀 승리',
  [SEASON_POINT_SOURCES.SWORD_BATTLE_PLAY]: '검배틀 참가'
});

export const SEASON_REWARDS = Object.freeze([
  Object.freeze({
    id: 'season_spark',
    label: '시즌 불씨',
    requiredPoints: 50,
    description: '시즌 참가를 증명하는 첫 번째 불씨 배지'
  }),
  Object.freeze({
    id: 'season_blaze',
    label: '시즌 화염',
    requiredPoints: 150,
    description: '꾸준히 전투와 강화를 이어간 유저의 화염 배지'
  }),
  Object.freeze({
    id: 'season_crown',
    label: '시즌 왕관',
    requiredPoints: 500,
    description: '시즌 랭킹 상위권을 노릴 수 있는 왕관 배지'
  })
]);

const DEFAULT_OPTIONS = Object.freeze({
  dailyPointCap: 300,
  maxLedgerEntries: 80
});

export class SeasonService {
  constructor(store, options = {}) {
    this.store = store;
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options
    };
  }

  async getOverview({ guildId, userId, username = 'Unknown', now = Date.now() }) {
    return this.store.update((data) => {
      const seasons = getOrCreateGuildSeasonState(data, guildId);
      const profile = getOrCreateSeasonProfile(seasons, userId, username);

      return {
        season: { ...DEFAULT_SEASON },
        profile: cloneSeasonProfile(profile),
        rewards: buildRewardStatuses(profile),
        daily: buildDailyStatus(profile, now, this.options.dailyPointCap),
        leaderboardPreview: buildLeaderboard(seasons, 5)
      };
    });
  }

  async awardPoints({
    guildId,
    userId,
    username = 'Unknown',
    source,
    points,
    now = Date.now()
  }) {
    const normalizedPoints = normalizePositiveInteger(points);
    const normalizedSource = normalizeSeasonSource(source);

    return this.store.update((data) => {
      const seasons = getOrCreateGuildSeasonState(data, guildId);
      const profile = getOrCreateSeasonProfile(seasons, userId, username);
      const dayKey = getSeasonDayKey(now);
      const daily = getOrCreateDailyBucket(profile, dayKey);
      const remaining = Math.max(0, this.options.dailyPointCap - daily.total);
      const granted = Math.min(normalizedPoints, remaining);

      if (granted <= 0) {
        return {
          awarded: false,
          capped: true,
          points: 0,
          requestedPoints: normalizedPoints,
          totalPoints: profile.totalPoints,
          season: { ...DEFAULT_SEASON },
          source: normalizedSource,
          sourceLabel: SEASON_SOURCE_LABELS[normalizedSource],
          dailyRemaining: 0,
          profile: cloneSeasonProfile(profile)
        };
      }

      profile.username = username;
      profile.totalPoints += granted;
      profile.updatedAt = now;
      daily.total += granted;
      daily.sources[normalizedSource] = (daily.sources[normalizedSource] ?? 0) + granted;
      seasons.ledger.unshift({
        at: now,
        userId,
        username,
        source: normalizedSource,
        points: granted
      });
      seasons.ledger = seasons.ledger.slice(0, this.options.maxLedgerEntries);

      return {
        awarded: true,
        capped: granted < normalizedPoints,
        points: granted,
        requestedPoints: normalizedPoints,
        totalPoints: profile.totalPoints,
        season: { ...DEFAULT_SEASON },
        source: normalizedSource,
        sourceLabel: SEASON_SOURCE_LABELS[normalizedSource],
        dailyRemaining: Math.max(0, this.options.dailyPointCap - daily.total),
        profile: cloneSeasonProfile(profile),
        newlyClaimableRewards: buildRewardStatuses(profile).filter((reward) => reward.claimable)
      };
    });
  }

  async claimRewards({ guildId, userId, username = 'Unknown', now = Date.now() }) {
    return this.store.update((data) => {
      const seasons = getOrCreateGuildSeasonState(data, guildId);
      const profile = getOrCreateSeasonProfile(seasons, userId, username);
      const claimable = buildRewardStatuses(profile)
        .filter((reward) => reward.claimable);

      for (const reward of claimable) {
        profile.claimedRewardIds[reward.id] = now;
      }
      profile.updatedAt = now;

      return {
        season: { ...DEFAULT_SEASON },
        claimed: claimable.map((reward) => ({ ...reward, claimed: true, claimable: false })),
        profile: cloneSeasonProfile(profile),
        rewards: buildRewardStatuses(profile)
      };
    });
  }

  async getLeaderboard({ guildId, limit = 10 }) {
    return this.store.update((data) => {
      const seasons = getOrCreateGuildSeasonState(data, guildId);
      return buildLeaderboard(seasons, limit);
    });
  }
}

function getOrCreateGuildSeasonState(data, guildId) {
  data.guilds ??= {};
  data.guilds[guildId] ??= {};
  const guild = data.guilds[guildId];
  guild.seasons ??= {};
  guild.seasons.activeSeasonId = DEFAULT_SEASON_ID;
  guild.seasons.users ??= {};
  guild.seasons.ledger ??= [];
  return guild.seasons;
}

function getOrCreateSeasonProfile(seasons, userId, username) {
  seasons.users[userId] ??= {
    userId,
    username,
    totalPoints: 0,
    claimedRewardIds: {},
    daily: {},
    updatedAt: 0
  };

  const profile = seasons.users[userId];
  profile.username = username || profile.username || 'Unknown';
  profile.totalPoints = Math.max(0, Math.floor(Number(profile.totalPoints) || 0));
  profile.claimedRewardIds ??= {};
  profile.daily ??= {};
  return profile;
}

function getOrCreateDailyBucket(profile, dayKey) {
  profile.daily[dayKey] ??= {
    total: 0,
    sources: {}
  };
  profile.daily[dayKey].total = Math.max(0, Math.floor(Number(profile.daily[dayKey].total) || 0));
  profile.daily[dayKey].sources ??= {};
  return profile.daily[dayKey];
}

function buildRewardStatuses(profile) {
  return SEASON_REWARDS.map((reward) => {
    const claimedAt = profile.claimedRewardIds?.[reward.id] ?? 0;
    const unlocked = profile.totalPoints >= reward.requiredPoints;
    return {
      ...reward,
      unlocked,
      claimed: claimedAt > 0,
      claimedAt,
      claimable: unlocked && claimedAt <= 0
    };
  });
}

function buildDailyStatus(profile, now, dailyPointCap) {
  const dayKey = getSeasonDayKey(now);
  const daily = profile.daily?.[dayKey] ?? { total: 0, sources: {} };
  return {
    dayKey,
    earned: Math.max(0, Math.floor(Number(daily.total) || 0)),
    cap: dailyPointCap,
    remaining: Math.max(0, dailyPointCap - (Math.max(0, Math.floor(Number(daily.total) || 0)))),
    sources: { ...(daily.sources ?? {}) }
  };
}

function buildLeaderboard(seasons, limit) {
  const safeLimit = Math.min(20, Math.max(1, Math.floor(Number(limit) || 10)));
  return Object.values(seasons.users ?? {})
    .map((profile) => ({
      userId: profile.userId,
      username: profile.username,
      points: Math.max(0, Math.floor(Number(profile.totalPoints) || 0)),
      claimedRewardCount: Object.keys(profile.claimedRewardIds ?? {}).length
    }))
    .filter((profile) => profile.points > 0)
    .sort((a, b) =>
      b.points - a.points
      || a.username.localeCompare(b.username, 'ko-KR')
      || a.userId.localeCompare(b.userId)
    )
    .slice(0, safeLimit)
    .map((profile, index) => ({
      rank: index + 1,
      ...profile
    }));
}

function cloneSeasonProfile(profile) {
  return {
    userId: profile.userId,
    username: profile.username,
    totalPoints: Math.max(0, Math.floor(Number(profile.totalPoints) || 0)),
    claimedRewardIds: { ...(profile.claimedRewardIds ?? {}) },
    daily: structuredClone(profile.daily ?? {}),
    updatedAt: profile.updatedAt ?? 0
  };
}

function normalizePositiveInteger(value) {
  const normalized = Math.floor(Number(value) || 0);
  if (!Number.isSafeInteger(normalized) || normalized <= 0) {
    throw new Error('시즌 포인트는 1 이상의 정수여야 합니다.');
  }
  return normalized;
}

function normalizeSeasonSource(source) {
  const normalized = String(source ?? '').trim();
  if (!Object.values(SEASON_POINT_SOURCES).includes(normalized)) {
    throw new Error('알 수 없는 시즌 포인트 출처입니다.');
  }
  return normalized;
}

function getSeasonDayKey(now) {
  return String(Math.floor((Number(now) + KOREA_TIME_OFFSET_MS) / DAY_MS));
}
