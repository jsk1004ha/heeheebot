import { getOrCreateLinkedAccountProfile } from './accounts.js';
import { addOwnedTitle, isCommunityTitleId } from './achievements.js';
import { normalizeWallets } from './currencies.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const KOREA_TIME_OFFSET_MS = 9 * 60 * 60 * 1000;

export const DEFAULT_SEASON_ID = 'heehee_season_1';

export const DEFAULT_SEASON = Object.freeze({
  id: DEFAULT_SEASON_ID,
  name: '희희봇 시즌 1: 원숭이 대침공',
  description: 'RPG, 검 강화, 검배틀을 플레이하며 시즌 포인트를 모으는 통합 이벤트입니다.'
});

export const SEASON_POINT_SOURCES = Object.freeze({
  RPG_BATTLE_WIN: 'rpg_battle_win',
  RPG_DUNGEON_CLEAR: 'rpg_dungeon_clear',
  RPG_DAILY_CLAIM: 'rpg_daily_claim',
  SWORD_ENHANCE: 'sword_enhance',
  SWORD_BATTLE_WIN: 'sword_battle_win',
  SWORD_BATTLE_PLAY: 'sword_battle_play',
  FISHING_CATCH: 'fishing_catch',
  STOCK_TRADE: 'stock_trade',
  COMMUNITY_MISSION_CLAIM: 'community_mission_claim',
  ACHIEVEMENT_EARN: 'achievement_earn',
  TODAY_CHECKLIST: 'today_checklist',
  SEASON_CHALLENGE_CLAIM: 'season_challenge_claim'
});

export const SEASON_SOURCE_LABELS = Object.freeze({
  [SEASON_POINT_SOURCES.RPG_BATTLE_WIN]: 'RPG 전투 승리',
  [SEASON_POINT_SOURCES.RPG_DUNGEON_CLEAR]: 'RPG 던전 클리어',
  [SEASON_POINT_SOURCES.RPG_DAILY_CLAIM]: 'RPG 일일 의뢰',
  [SEASON_POINT_SOURCES.SWORD_ENHANCE]: '검 강화',
  [SEASON_POINT_SOURCES.SWORD_BATTLE_WIN]: '검배틀 승리',
  [SEASON_POINT_SOURCES.SWORD_BATTLE_PLAY]: '검배틀 참가',
  [SEASON_POINT_SOURCES.FISHING_CATCH]: '낚시 성공',
  [SEASON_POINT_SOURCES.STOCK_TRADE]: '주식 거래',
  [SEASON_POINT_SOURCES.COMMUNITY_MISSION_CLAIM]: '커뮤니티 미션',
  [SEASON_POINT_SOURCES.ACHIEVEMENT_EARN]: '업적 달성',
  [SEASON_POINT_SOURCES.TODAY_CHECKLIST]: '오늘 할 일',
  [SEASON_POINT_SOURCES.SEASON_CHALLENGE_CLAIM]: '시즌 과제 보상'
});

export const SEASON_CHALLENGES = Object.freeze([
  seasonChallenge({
    id: 'daily_rpg_battle',
    period: 'daily',
    label: '오늘의 첫 전투',
    description: 'RPG 전투 승리로 시즌 포인트 25점 획득',
    requiredPoints: 25,
    rewardPoints: 30,
    sources: [SEASON_POINT_SOURCES.RPG_BATTLE_WIN]
  }),
  seasonChallenge({
    id: 'daily_rpg_dungeon',
    period: 'daily',
    label: '오늘의 던전 공략',
    description: 'RPG 던전 클리어로 시즌 포인트 30점 획득',
    requiredPoints: 30,
    rewardPoints: 25,
    sources: [SEASON_POINT_SOURCES.RPG_DUNGEON_CLEAR]
  }),
  seasonChallenge({
    id: 'daily_sword_enhance',
    period: 'daily',
    label: '대장장이 출근도장',
    description: '검 강화로 시즌 포인트 15점 획득',
    requiredPoints: 15,
    rewardPoints: 20,
    sources: [SEASON_POINT_SOURCES.SWORD_ENHANCE]
  }),
  seasonChallenge({
    id: 'daily_sword_battle',
    period: 'daily',
    label: '검투장 입장',
    description: '검배틀 참가 또는 승리로 시즌 포인트 8점 획득',
    requiredPoints: 8,
    rewardPoints: 20,
    sources: [SEASON_POINT_SOURCES.SWORD_BATTLE_PLAY, SEASON_POINT_SOURCES.SWORD_BATTLE_WIN]
  }),
  seasonChallenge({
    id: 'daily_fishing_catch',
    period: 'daily',
    label: '오늘의 첫 낚시',
    description: '낚시로 시즌 포인트 20점 획득',
    requiredPoints: 20,
    rewardPoints: 20,
    sources: [SEASON_POINT_SOURCES.FISHING_CATCH]
  }),
  seasonChallenge({
    id: 'daily_stock_trade',
    period: 'daily',
    label: '시장 출석',
    description: '주식 거래로 시즌 포인트 15점 획득',
    requiredPoints: 15,
    rewardPoints: 20,
    sources: [SEASON_POINT_SOURCES.STOCK_TRADE]
  }),
  seasonChallenge({
    id: 'daily_achievement_earn',
    period: 'daily',
    label: '업적 하나 더',
    description: '자동 업적 수령으로 시즌 포인트 10점 획득',
    requiredPoints: 10,
    rewardPoints: 15,
    sources: [SEASON_POINT_SOURCES.ACHIEVEMENT_EARN]
  }),
  seasonChallenge({
    id: 'weekly_any_activity',
    period: 'weekly',
    label: '주간 시즌 러너',
    description: '이번 주 시즌 활동 포인트 300점 획득',
    requiredPoints: 300,
    rewardPoints: 100
  }),
  seasonChallenge({
    id: 'weekly_rpg_battle',
    period: 'weekly',
    label: '주간 던전 정복자',
    description: '이번 주 RPG 전투/던전 포인트 125점 획득',
    requiredPoints: 125,
    rewardPoints: 80,
    sources: [SEASON_POINT_SOURCES.RPG_BATTLE_WIN, SEASON_POINT_SOURCES.RPG_DUNGEON_CLEAR]
  }),
  seasonChallenge({
    id: 'weekly_sword_master',
    period: 'weekly',
    label: '주간 검의 주인',
    description: '이번 주 검 강화/검배틀 포인트 100점 획득',
    requiredPoints: 100,
    rewardPoints: 80,
    sources: [
      SEASON_POINT_SOURCES.SWORD_ENHANCE,
      SEASON_POINT_SOURCES.SWORD_BATTLE_PLAY,
      SEASON_POINT_SOURCES.SWORD_BATTLE_WIN
    ]
  }),
  seasonChallenge({
    id: 'weekly_three_categories',
    period: 'weekly',
    label: '주간 만능 플레이어',
    description: '이번 주 서로 다른 콘텐츠 3종에서 시즌 포인트 획득',
    requiredPoints: 3,
    rewardPoints: 120,
    progressMode: 'distinct_sources',
    sources: [
      SEASON_POINT_SOURCES.RPG_BATTLE_WIN,
      SEASON_POINT_SOURCES.RPG_DUNGEON_CLEAR,
      SEASON_POINT_SOURCES.SWORD_ENHANCE,
      SEASON_POINT_SOURCES.SWORD_BATTLE_PLAY,
      SEASON_POINT_SOURCES.SWORD_BATTLE_WIN,
      SEASON_POINT_SOURCES.FISHING_CATCH,
      SEASON_POINT_SOURCES.STOCK_TRADE,
      SEASON_POINT_SOURCES.COMMUNITY_MISSION_CLAIM,
      SEASON_POINT_SOURCES.ACHIEVEMENT_EARN,
      SEASON_POINT_SOURCES.TODAY_CHECKLIST
    ]
  })
]);

export const SEASON_REWARDS = Object.freeze([
  Object.freeze({
    id: 'season_spark',
    label: '시즌 불씨',
    kind: 'badge',
    icon: '🔥',
    badgeId: 'season_spark',
    requiredPoints: 50,
    description: '시즌 참가를 증명하는 첫 번째 불씨 배지'
  }),
  Object.freeze({
    id: 'season_blaze',
    label: '시즌 화염',
    kind: 'badge',
    icon: '🏵️',
    badgeId: 'season_blaze',
    requiredPoints: 150,
    description: '꾸준히 전투와 강화를 이어간 유저의 화염 배지'
  }),
  Object.freeze({
    id: 'season_crown',
    label: '시즌 왕관',
    kind: 'profile_badge',
    icon: '👑',
    badgeId: 'season_crown',
    requiredPoints: 500,
    description: '시즌 랭킹 상위권을 노릴 수 있는 왕관 배지'
  }),
  Object.freeze({
    id: 'season_dungeon_title',
    label: '던전 개척자',
    kind: 'title',
    icon: '🏰',
    titleId: 'season_dungeon_title',
    requiredPoints: 800,
    description: '던전과 전투 시즌 루프를 꾸준히 돌파한 유저의 시즌 칭호'
  }),
  Object.freeze({
    id: 'season_monkey_hunter_badge',
    label: '원숭이 사냥꾼',
    kind: 'badge',
    icon: '🐒',
    badgeId: 'season_monkey_hunter_badge',
    requiredPoints: 1_000,
    description: '원숭이 대침공 시즌 한정 수집 배지'
  }),
  Object.freeze({
    id: 'season_hero_profile',
    label: '시즌 영웅 프로필 배지',
    kind: 'profile_badge',
    icon: '🌟',
    badgeId: 'season_hero_profile',
    requiredPoints: 1_200,
    description: '프로필에서 시즌 성취를 보여줄 수 있는 최상위 프로필 배지'
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
      return grantSeasonPoints({
        seasons,
        profile,
        userId,
        username,
        source: normalizedSource,
        points: normalizedPoints,
        now,
        dailyPointCap: this.options.dailyPointCap,
        maxLedgerEntries: this.options.maxLedgerEntries
      });
    });
  }

  async getChallenges({ guildId, userId, username = 'Unknown', now = Date.now() }) {
    return this.store.update((data) => {
      const seasons = getOrCreateGuildSeasonState(data, guildId);
      const profile = getOrCreateSeasonProfile(seasons, userId, username);
      return buildChallengeBoard(profile, now);
    });
  }

  async claimChallengeRewards({
    guildId,
    userId,
    username = 'Unknown',
    period = 'all',
    now = Date.now()
  }) {
    const normalizedPeriod = normalizeChallengeClaimPeriod(period);

    return this.store.update((data) => {
      const seasons = getOrCreateGuildSeasonState(data, guildId);
      const profile = getOrCreateSeasonProfile(seasons, userId, username);
      const board = buildChallengeBoard(profile, now);
      const candidates = normalizedPeriod === 'all'
        ? [...board.daily, ...board.weekly]
        : board[normalizedPeriod];
      const claimable = candidates.filter((challenge) => challenge.claimable);
      const totalRewardPoints = claimable.reduce((sum, challenge) => sum + challenge.rewardPoints, 0);

      if (claimable.length <= 0) {
        return {
          season: { ...DEFAULT_SEASON },
          claimed: [],
          totalRewardPoints: 0,
          award: null,
          profile: cloneSeasonProfile(profile),
          challenges: buildChallengeBoard(profile, now)
        };
      }

      profile.claimedChallengeKeys ??= {};
      for (const challenge of claimable) {
        profile.claimedChallengeKeys[challenge.claimKey] = now;
      }

      const award = grantSeasonPoints({
        seasons,
        profile,
        userId,
        username,
        source: SEASON_POINT_SOURCES.SEASON_CHALLENGE_CLAIM,
        points: totalRewardPoints,
        now,
        dailyPointCap: this.options.dailyPointCap,
        maxLedgerEntries: this.options.maxLedgerEntries,
        applyDailyCap: false
      });

      return {
        season: { ...DEFAULT_SEASON },
        claimed: claimable.map((challenge) => ({
          ...challenge,
          claimed: true,
          claimable: false,
          claimedAt: now
        })),
        totalRewardPoints,
        award,
        profile: cloneSeasonProfile(profile),
        challenges: buildChallengeBoard(profile, now)
      };
    });
  }

  async claimRewards({ guildId, userId, username = 'Unknown', now = Date.now() }) {
    return this.store.update((data) => {
      const seasons = getOrCreateGuildSeasonState(data, guildId);
      const profile = getOrCreateSeasonProfile(seasons, userId, username);
      const claimable = buildRewardStatuses(profile)
        .filter((reward) => reward.claimable);
      const appliedRewards = [];

      for (const reward of claimable) {
        profile.claimedRewardIds[reward.id] = now;
        const applied = applySeasonRewardToLinkedProfile(data, {
          guildId,
          userId,
          username,
          reward,
          now
        });
        if (applied) appliedRewards.push(applied);
      }
      profile.updatedAt = now;

      return {
        season: { ...DEFAULT_SEASON },
        claimed: claimable.map((reward) => ({ ...reward, claimed: true, claimable: false })),
        appliedRewards,
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
    claimedChallengeKeys: {},
    daily: {},
    weekly: {},
    updatedAt: 0
  };

  const profile = seasons.users[userId];
  profile.username = username || profile.username || 'Unknown';
  profile.totalPoints = Math.max(0, Math.floor(Number(profile.totalPoints) || 0));
  profile.claimedRewardIds ??= {};
  profile.claimedChallengeKeys ??= {};
  profile.daily ??= {};
  profile.weekly ??= {};
  return profile;
}

function applySeasonRewardToLinkedProfile(data, { guildId, userId, username, reward, now }) {
  if (!reward || !['badge', 'profile_badge', 'title'].includes(reward.kind)) {
    return null;
  }

  const profile = getOrCreateLinkedAccountProfile(data, {
    guildId,
    userId,
    username,
    now,
    createDefaultProfile: createDefaultSeasonRewardProfile
  });
  const community = getOrCreateRewardCommunity(profile);

  if (reward.kind === 'title') {
    const titleId = reward.titleId ?? reward.id;
    if (!isCommunityTitleId(titleId)) return null;

    const alreadyOwned = community.ownedTitles.includes(titleId);
    addOwnedTitle(community, titleId);
    if (!community.equippedTitle) {
      community.equippedTitle = titleId;
    }

    return {
      rewardId: reward.id,
      kind: reward.kind,
      titleId,
      label: reward.label,
      newlyApplied: !alreadyOwned
    };
  }

  const badgeId = reward.badgeId ?? reward.id;
  const alreadyOwned = community.cosmetics.badges.includes(badgeId);
  if (!alreadyOwned) {
    community.cosmetics.badges.push(badgeId);
  }

  return {
    rewardId: reward.id,
    kind: reward.kind,
    badgeId,
    label: reward.label,
    newlyApplied: !alreadyOwned
  };
}

function createDefaultSeasonRewardProfile(userId, username, now = Date.now()) {
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
    createdAt: now
  };
}

function getOrCreateRewardCommunity(profile) {
  profile.community ??= {};
  const community = profile.community;
  community.ownedTitles = normalizeUniqueStringArray(community.ownedTitles)
    .filter((titleId) => isCommunityTitleId(titleId));
  community.equippedTitle = community.ownedTitles.includes(community.equippedTitle)
    ? community.equippedTitle
    : null;
  community.cosmetics = {
    badges: normalizeUniqueStringArray(community.cosmetics?.badges)
  };
  return community;
}

function normalizeUniqueStringArray(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item ?? '').trim()).filter(Boolean))];
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

function getOrCreateWeeklyBucket(profile, weekKey) {
  profile.weekly ??= {};
  profile.weekly[weekKey] ??= {
    total: 0,
    sources: {}
  };
  profile.weekly[weekKey].total = Math.max(0, Math.floor(Number(profile.weekly[weekKey].total) || 0));
  profile.weekly[weekKey].sources ??= {};
  return profile.weekly[weekKey];
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
    claimedChallengeKeys: { ...(profile.claimedChallengeKeys ?? {}) },
    daily: structuredClone(profile.daily ?? {}),
    weekly: structuredClone(profile.weekly ?? {}),
    updatedAt: profile.updatedAt ?? 0
  };
}

function grantSeasonPoints({
  seasons,
  profile,
  userId,
  username,
  source,
  points,
  now,
  dailyPointCap,
  maxLedgerEntries,
  applyDailyCap = true
}) {
  const dayKey = getSeasonDayKey(now);
  const weekKey = getSeasonWeekKey(now);
  const daily = getOrCreateDailyBucket(profile, dayKey);
  const weekly = getOrCreateWeeklyBucket(profile, weekKey);
  const remaining = Math.max(0, dailyPointCap - daily.total);
  const granted = applyDailyCap ? Math.min(points, remaining) : points;

  if (granted <= 0) {
    return {
      awarded: false,
      capped: true,
      points: 0,
      requestedPoints: points,
      totalPoints: profile.totalPoints,
      season: { ...DEFAULT_SEASON },
      source,
      sourceLabel: SEASON_SOURCE_LABELS[source],
      dailyRemaining: 0,
      profile: cloneSeasonProfile(profile)
    };
  }

  profile.username = username;
  profile.totalPoints += granted;
  profile.updatedAt = now;
  daily.total += granted;
  daily.sources[source] = (daily.sources[source] ?? 0) + granted;
  weekly.total += granted;
  weekly.sources[source] = (weekly.sources[source] ?? 0) + granted;
  seasons.ledger.unshift({
    at: now,
    userId,
    username,
    source,
    points: granted
  });
  seasons.ledger = seasons.ledger.slice(0, maxLedgerEntries);

  return {
    awarded: true,
    capped: granted < points,
    points: granted,
    requestedPoints: points,
    totalPoints: profile.totalPoints,
    season: { ...DEFAULT_SEASON },
    source,
    sourceLabel: SEASON_SOURCE_LABELS[source],
    dailyRemaining: Math.max(0, dailyPointCap - daily.total),
    profile: cloneSeasonProfile(profile),
    newlyClaimableRewards: buildRewardStatuses(profile).filter((reward) => reward.claimable)
  };
}

function buildChallengeBoard(profile, now) {
  const dailyKey = getSeasonDayKey(now);
  const weeklyKey = getSeasonWeekKey(now);
  const dailyBucket = profile.daily?.[dailyKey] ?? { total: 0, sources: {} };
  const weeklyBucket = profile.weekly?.[weeklyKey] ?? { total: 0, sources: {} };
  const statuses = SEASON_CHALLENGES.map((challenge) => {
    const periodKey = challenge.period === 'daily' ? dailyKey : weeklyKey;
    const bucket = challenge.period === 'daily' ? dailyBucket : weeklyBucket;
    return buildChallengeStatus(challenge, bucket, profile, periodKey);
  });

  return {
    season: { ...DEFAULT_SEASON },
    profile: cloneSeasonProfile(profile),
    dailyKey,
    weeklyKey,
    daily: statuses.filter((challenge) => challenge.period === 'daily'),
    weekly: statuses.filter((challenge) => challenge.period === 'weekly')
  };
}

function buildChallengeStatus(challenge, bucket, profile, periodKey) {
  const progress = getChallengeProgress(challenge, bucket);
  const claimKey = `${challenge.period}:${periodKey}:${challenge.id}`;
  const claimedAt = profile.claimedChallengeKeys?.[claimKey] ?? 0;
  const completed = progress >= challenge.requiredPoints;

  return {
    ...challenge,
    progress,
    completed,
    claimed: claimedAt > 0,
    claimedAt,
    claimKey,
    claimable: completed && claimedAt <= 0
  };
}

function getChallengeProgress(challenge, bucket) {
  const sources = bucket.sources ?? {};
  if (challenge.progressMode === 'distinct_sources') {
    return challenge.sources
      .filter((source) => normalizeStoredPoints(sources[source]) > 0)
      .length;
  }

  if (challenge.sources.length > 0) {
    return challenge.sources.reduce((sum, source) => sum + normalizeStoredPoints(sources[source]), 0);
  }

  return Object.entries(sources)
    .filter(([source]) => source !== SEASON_POINT_SOURCES.SEASON_CHALLENGE_CLAIM)
    .reduce((sum, [, points]) => sum + normalizeStoredPoints(points), 0);
}

function normalizeStoredPoints(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
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

function getSeasonWeekKey(now) {
  return String(Math.floor((Number(now) + KOREA_TIME_OFFSET_MS) / WEEK_MS));
}

function normalizeChallengeClaimPeriod(period) {
  const normalized = String(period ?? 'all').trim();
  if (['all', 'daily', 'weekly'].includes(normalized)) {
    return normalized;
  }
  throw new Error('알 수 없는 시즌 과제 보상 범위입니다.');
}

function seasonChallenge({
  id,
  period,
  label,
  description,
  requiredPoints,
  rewardPoints,
  sources = [],
  progressMode = 'points'
}) {
  return Object.freeze({
    id,
    period,
    label,
    description,
    requiredPoints,
    rewardPoints,
    progressMode,
    sources: Object.freeze([...sources])
  });
}
