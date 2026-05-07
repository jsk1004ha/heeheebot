import { normalizeWallets } from './currencies.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const FORTUNE_DAY_OFFSET_MS = 9 * 60 * 60 * 1000;
const LOTTERY_TICKET_COST = 500;
const DEFAULT_LOTTERY_JACKPOT = 1_000;
const LOTTERY_BASE_JACKPOT_BPS = 8_000;
const LOTTERY_EVENT_JACKPOT_BPS = 10_000;
const MISSION_EVENT_REWARD_BPS = 15_000;

export const COMMUNITY_TITLES = Object.freeze([
  title('steady', '🌅 성실한 출석러', '출석 업적으로 획득'),
  title('rich', '💰 동네 부자', '보유금 업적으로 획득'),
  title('gambler', '🎲 도박꾼', '카지노 플레이 업적으로 획득'),
  title('lucky', '🍀 행운아', '복권 업적으로 획득'),
  title('missioner', '📋 미션러', '미션 업적으로 획득'),
  title('host', '📣 이벤트 주최자', '서버 이벤트 업적으로 획득'),
  title('vip', '👑 VIP', '상점에서 구매'),
  title('collector', '💎 수집가', '상점에서 구매')
]);

export const SHOP_ITEMS = Object.freeze([
  shopItem('badge_luck', '🍀 행운 배지', 1_500, 'badge', '프로필 꾸미기용 행운 배지'),
  shopItem('badge_gold', '🏅 골드 배지', 3_000, 'badge', '프로필 꾸미기용 골드 배지'),
  shopItem('title_vip', '👑 VIP 칭호', 5_000, 'title', '장착 가능한 VIP 칭호', 'vip'),
  shopItem('title_collector', '💎 수집가 칭호', 7_500, 'title', '장착 가능한 수집가 칭호', 'collector')
]);

export const EVENT_TYPES = Object.freeze([
  eventType('chat_xp', '채팅 XP 2배', '이벤트 동안 일반 채팅 보상 XP를 한 번 더 지급합니다.'),
  eventType('mission_bonus', '미션 보상 증가', '이벤트 동안 미션 수령 보상이 1.5배가 됩니다.'),
  eventType('lottery_bonus', '복권 잭팟 강화', '이벤트 동안 복권 구매액 전부가 잭팟에 누적됩니다.')
]);

const TITLE_BY_ID = new Map(COMMUNITY_TITLES.map((item) => [item.id, item]));
const SHOP_ITEM_BY_ID = new Map(SHOP_ITEMS.map((item) => [item.id, item]));
const EVENT_TYPE_BY_ID = new Map(EVENT_TYPES.map((item) => [item.id, item]));

const ACHIEVEMENTS = Object.freeze([
  achievement(
    'level_2',
    '첫 성장',
    '레벨 2 달성',
    ({ profile }) => profile.level >= 2,
    ({ profile }) => `Lv.${Math.min(profile.level, 2)} / Lv.2`,
    { coins: 300, xp: 0 }
  ),
  achievement(
    'daily_7',
    '일주일 출석',
    '연속 출석 7일 달성',
    ({ profile }) => profile.dailyStreak >= 7,
    ({ profile }) => `${Math.min(profile.dailyStreak, 7)} / 7일`,
    { coins: 1_000, xp: 50, titleId: 'steady' }
  ),
  achievement(
    'balance_10000',
    '돈 냄새',
    '메인 코인 10,000원 보유',
    ({ profile }) => profile.balance >= 10_000,
    ({ profile }) => `${Math.min(profile.balance, 10_000).toLocaleString()} / 10,000원`,
    { coins: 500, xp: 50, titleId: 'rich' }
  ),
  achievement(
    'casino_10',
    '판돈은 작게',
    '카지노 게임 10회 참여',
    ({ community }) => community.stats.casinoPlays >= 10,
    ({ community }) => `${Math.min(community.stats.casinoPlays, 10)} / 10회`,
    { coins: 700, xp: 60, titleId: 'gambler' }
  ),
  achievement(
    'lottery_5',
    '한 장만 더',
    '복권 5장 구매',
    ({ community }) => community.stats.lotteryTickets >= 5,
    ({ community }) => `${Math.min(community.stats.lotteryTickets, 5)} / 5장`,
    { coins: 500, xp: 40, titleId: 'lucky' }
  ),
  achievement(
    'missions_5',
    '체크리스트 중독',
    '미션 보상 5개 수령',
    ({ community }) => community.stats.missionsCompleted >= 5,
    ({ community }) => `${Math.min(community.stats.missionsCompleted, 5)} / 5개`,
    { coins: 1_000, xp: 100, titleId: 'missioner' }
  ),
  achievement(
    'event_host_1',
    '분위기 메이커',
    '서버 이벤트 1회 시작',
    ({ community }) => community.stats.eventsHosted >= 1,
    ({ community }) => `${Math.min(community.stats.eventsHosted, 1)} / 1회`,
    { coins: 300, xp: 30, titleId: 'host' }
  )
]);

const DAILY_MISSIONS = Object.freeze([
  mission(
    'daily_checkin',
    '출석 찍기',
    '오늘 /출석 보상을 받기',
    ({ profile, today }) => profile.lastDailyDay === today,
    ({ profile, today }) => profile.lastDailyDay === today ? '완료' : '미완료',
    { coins: 200, xp: 25 }
  ),
  mission(
    'daily_fortune',
    '운세 확인',
    '오늘 /운세를 확인해 XP 받기',
    ({ profile, fortuneDay }) => profile.lastFortuneXpDay === fortuneDay,
    ({ profile, fortuneDay }) => profile.lastFortuneXpDay === fortuneDay ? '완료' : '미완료',
    { coins: 150, xp: 20 }
  ),
  mission(
    'daily_lottery',
    '복권 한 장',
    '오늘 복권을 1장 이상 구매하기',
    ({ community }) => community.daily.lotteryTickets >= 1,
    ({ community }) => `${Math.min(community.daily.lotteryTickets, 1)} / 1장`,
    { coins: 150, xp: 20 }
  )
]);

const WEEKLY_MISSIONS = Object.freeze([
  mission(
    'weekly_streak_3',
    '출석 흐름 만들기',
    '연속 출석 3일 달성',
    ({ profile }) => profile.dailyStreak >= 3,
    ({ profile }) => `${Math.min(profile.dailyStreak, 3)} / 3일`,
    { coins: 1_000, xp: 100 }
  ),
  mission(
    'weekly_balance_5000',
    '비상금 확보',
    '메인 코인 5,000원 보유',
    ({ profile }) => profile.balance >= 5_000,
    ({ profile }) => `${Math.min(profile.balance, 5_000).toLocaleString()} / 5,000원`,
    { coins: 1_000, xp: 100 }
  ),
  mission(
    'weekly_lottery_5',
    '잭팟 후원자',
    '복권 5장 누적 구매',
    ({ community }) => community.stats.lotteryTickets >= 5,
    ({ community }) => `${Math.min(community.stats.lotteryTickets, 5)} / 5장`,
    { coins: 1_000, xp: 100 }
  )
]);

export class CommunityService {
  constructor(store, options = {}) {
    this.store = store;
    this.randomInt = options.randomInt ?? randomInt;
  }

  async getOverview({ guildId, userId, username, now = Date.now() }) {
    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, now);
      const guildCommunity = getOrCreateGuildCommunity(data, guildId);
      const community = normalizeCommunityProfile(profile, now);

      return {
        profile: cloneCommunityProfile(profile, now),
        community: cloneCommunityState(community),
        achievements: getAchievementStatuses(profile, community),
        titles: getTitleStatuses(community),
        shopItems: getShopStatuses(community),
        missions: getMissionStatuses(profile, community, now),
        lottery: getLotteryStatus(guildCommunity.lottery),
        event: cloneActiveEvent(getActiveEvent(guildCommunity, now))
      };
    });
  }

  async claimAchievements({ guildId, userId, username, now = Date.now() }) {
    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, now);
      const community = normalizeCommunityProfile(profile, now);
      const statuses = getAchievementStatuses(profile, community);
      const claimed = [];
      let totalCoins = 0;
      let totalXp = 0;

      for (const status of statuses) {
        if (!status.completed || status.claimed) continue;
        community.claimedAchievements[status.id] = true;
        totalCoins += status.reward.coins;
        totalXp += status.reward.xp;
        if (status.reward.titleId) addOwnedTitle(community, status.reward.titleId);
        claimed.push(status);
      }

      if (totalCoins > 0) profile.balance += totalCoins;
      const levelResult = addXp(profile, totalXp);

      return {
        claimed,
        totalCoins,
        totalXp,
        ...levelResult,
        profile: cloneCommunityProfile(profile, now),
        achievements: getAchievementStatuses(profile, community),
        titles: getTitleStatuses(community)
      };
    });
  }

  async equipTitle({ guildId, userId, username, titleId, now = Date.now() }) {
    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, now);
      const community = normalizeCommunityProfile(profile, now);
      const normalizedTitleId = normalizeTitleId(titleId);

      if (normalizedTitleId === 'none') {
        community.equippedTitle = null;
      } else {
        if (!community.ownedTitles.includes(normalizedTitleId)) {
          throw new Error('아직 보유하지 않은 칭호입니다. 업적 보상이나 상점 구매로 획득하세요.');
        }
        community.equippedTitle = normalizedTitleId;
      }

      return {
        equippedTitle: community.equippedTitle ? TITLE_BY_ID.get(community.equippedTitle) : null,
        titles: getTitleStatuses(community),
        profile: cloneCommunityProfile(profile, now)
      };
    });
  }

  async claimMissions({ guildId, userId, username, type = 'daily', now = Date.now() }) {
    const missionType = normalizeMissionType(type);

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, now);
      const guildCommunity = getOrCreateGuildCommunity(data, guildId);
      const community = normalizeCommunityProfile(profile, now);
      const activeEvent = getActiveEvent(guildCommunity, now);
      const allStatuses = getMissionStatuses(profile, community, now);
      const statuses = missionType === 'daily' ? allStatuses.daily : allStatuses.weekly;
      const claimed = [];
      let totalCoins = 0;
      let totalXp = 0;
      const rewardBps = activeEvent?.type === 'mission_bonus'
        ? MISSION_EVENT_REWARD_BPS
        : 10_000;

      for (const status of statuses) {
        if (!status.completed || status.claimed) continue;
        getMissionPeriodState(community, missionType, now).claimed[status.id] = true;
        const coins = applyBps(status.reward.coins, rewardBps);
        const xp = applyBps(status.reward.xp, rewardBps);
        totalCoins += coins;
        totalXp += xp;
        claimed.push({ ...status, paidReward: { coins, xp } });
      }

      community.stats.missionsCompleted += claimed.length;
      if (totalCoins > 0) profile.balance += totalCoins;
      const levelResult = addXp(profile, totalXp);

      return {
        type: missionType,
        claimed,
        totalCoins,
        totalXp,
        eventBonus: rewardBps > 10_000,
        ...levelResult,
        profile: cloneCommunityProfile(profile, now),
        missions: getMissionStatuses(profile, community, now)
      };
    });
  }

  async buyLotteryTickets({ guildId, userId, username, quantity = 1, now = Date.now() }) {
    const normalizedQuantity = normalizeBoundedInteger(quantity, '복권 장수', 1, 50);

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, now);
      const guildCommunity = getOrCreateGuildCommunity(data, guildId);
      const community = normalizeCommunityProfile(profile, now);
      const lottery = normalizeLottery(guildCommunity.lottery);
      const activeEvent = getActiveEvent(guildCommunity, now);
      const totalCost = normalizedQuantity * LOTTERY_TICKET_COST;

      debitBalance(profile, totalCost);
      const jackpotBps = activeEvent?.type === 'lottery_bonus'
        ? LOTTERY_EVENT_JACKPOT_BPS
        : LOTTERY_BASE_JACKPOT_BPS;
      const jackpotAdded = applyBps(totalCost, jackpotBps);
      lottery.jackpot += jackpotAdded;
      lottery.tickets[userId] ??= {
        userId,
        username: profile.username,
        count: 0
      };
      lottery.tickets[userId].username = profile.username;
      lottery.tickets[userId].count += normalizedQuantity;
      lottery.totalTickets += normalizedQuantity;
      community.stats.lotteryTickets += normalizedQuantity;
      community.daily.lotteryTickets += normalizedQuantity;

      return {
        quantity: normalizedQuantity,
        totalCost,
        jackpotAdded,
        eventBonus: jackpotBps > LOTTERY_BASE_JACKPOT_BPS,
        profile: cloneCommunityProfile(profile, now),
        lottery: getLotteryStatus(lottery)
      };
    });
  }

  async drawLottery({ guildId, now = Date.now() }) {
    return this.store.update((data) => {
      const guildCommunity = getOrCreateGuildCommunity(data, guildId);
      const lottery = normalizeLottery(guildCommunity.lottery);

      if (lottery.totalTickets <= 0) {
        throw new Error('추첨할 복권이 없습니다. 먼저 `/복권 구매`로 복권을 구매하세요.');
      }

      const winningIndex = this.randomInt(1, lottery.totalTickets);
      let cursor = 0;
      let winnerTicket = null;

      for (const ticket of Object.values(lottery.tickets)) {
        cursor += ticket.count;
        if (winningIndex <= cursor) {
          winnerTicket = ticket;
          break;
        }
      }

      if (!winnerTicket) {
        throw new Error('복권 추첨 중 오류가 발생했습니다.');
      }

      const winnerProfile = getOrCreateProfile(data, guildId, winnerTicket.userId, winnerTicket.username, now);
      const payout = lottery.jackpot;
      winnerProfile.balance += payout;

      lottery.lastWinner = {
        userId: winnerProfile.userId,
        username: winnerProfile.username,
        payout,
        drawnAt: now
      };
      lottery.lastDrawAt = now;
      lottery.jackpot = DEFAULT_LOTTERY_JACKPOT;
      lottery.tickets = {};
      lottery.totalTickets = 0;

      return {
        winner: cloneCommunityProfile(winnerProfile, now),
        payout,
        winningIndex,
        lottery: getLotteryStatus(lottery)
      };
    });
  }

  async buyShopItem({ guildId, userId, username, itemId, now = Date.now() }) {
    const item = SHOP_ITEM_BY_ID.get(String(itemId));
    if (!item) throw new Error('알 수 없는 상점 아이템입니다.');

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, now);
      const community = normalizeCommunityProfile(profile, now);

      if (item.type === 'badge' && community.cosmetics.badges.includes(item.id)) {
        throw new Error('이미 보유한 배지입니다.');
      }
      if (item.type === 'title' && community.ownedTitles.includes(item.titleId)) {
        throw new Error('이미 보유한 칭호입니다.');
      }

      debitBalance(profile, item.price);
      if (item.type === 'badge') community.cosmetics.badges.push(item.id);
      if (item.type === 'title') addOwnedTitle(community, item.titleId);
      community.stats.shopPurchases += 1;

      return {
        item,
        profile: cloneCommunityProfile(profile, now),
        shopItems: getShopStatuses(community),
        titles: getTitleStatuses(community)
      };
    });
  }

  async startEvent({ guildId, userId, username, type, durationMinutes = 10, now = Date.now() }) {
    const eventTypeConfig = EVENT_TYPE_BY_ID.get(String(type));
    if (!eventTypeConfig) throw new Error('알 수 없는 서버 이벤트입니다.');
    const normalizedDuration = normalizeBoundedInteger(durationMinutes, '이벤트 시간', 1, 60);

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, now);
      const guildCommunity = getOrCreateGuildCommunity(data, guildId);
      const activeEvent = getActiveEvent(guildCommunity, now);

      if (activeEvent) {
        throw new Error(`이미 진행 중인 이벤트가 있습니다: ${EVENT_TYPE_BY_ID.get(activeEvent.type)?.label ?? activeEvent.type}`);
      }

      const event = {
        type: eventTypeConfig.id,
        hostUserId: userId,
        hostUsername: profile.username,
        startedAt: now,
        endsAt: now + normalizedDuration * 60_000
      };
      guildCommunity.event = event;
      normalizeCommunityProfile(profile, now).stats.eventsHosted += 1;

      return {
        event: cloneActiveEvent(event),
        profile: cloneCommunityProfile(profile, now)
      };
    });
  }

  async getEventStatus({ guildId, now = Date.now() }) {
    return this.store.update((data) => {
      const guildCommunity = getOrCreateGuildCommunity(data, guildId);
      return {
        event: cloneActiveEvent(getActiveEvent(guildCommunity, now))
      };
    });
  }

  async awardChatEventBonus({ guildId, userId, username, baseXp, now = Date.now() }) {
    const normalizedBaseXp = normalizeNonNegativeInteger(baseXp, '기본 XP');
    if (normalizedBaseXp <= 0) return null;

    return this.store.update((data) => {
      const guildCommunity = getOrCreateGuildCommunity(data, guildId);
      const activeEvent = getActiveEvent(guildCommunity, now);
      if (activeEvent?.type !== 'chat_xp') return null;

      const profile = getOrCreateProfile(data, guildId, userId, username, now);
      const levelResult = addXp(profile, normalizedBaseXp);

      return {
        event: cloneActiveEvent(activeEvent),
        bonusXp: normalizedBaseXp,
        ...levelResult,
        profile: cloneCommunityProfile(profile, now)
      };
    });
  }

  async recordActivity({ guildId, userId, username, activity, amount = 1, now = Date.now() }) {
    const normalizedAmount = normalizeBoundedInteger(amount, '기록 수량', 1, 1_000);

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, now);
      const community = normalizeCommunityProfile(profile, now);

      if (activity === 'casino') community.stats.casinoPlays += normalizedAmount;
      if (activity === 'wordchain_win') community.stats.wordChainWins += normalizedAmount;
      if (activity === 'transfer') community.stats.transfers += normalizedAmount;

      return {
        activity,
        amount: normalizedAmount,
        community: cloneCommunityState(community)
      };
    });
  }
}

export function getCommunityTitle(titleId) {
  return TITLE_BY_ID.get(String(titleId)) ?? null;
}

export function getCommunityTitles() {
  return COMMUNITY_TITLES.map((item) => ({ ...item }));
}

export function getShopItems() {
  return SHOP_ITEMS.map((item) => ({ ...item }));
}

export function getEventTypes() {
  return EVENT_TYPES.map((item) => ({ ...item }));
}

export function getLotteryTicketCost() {
  return LOTTERY_TICKET_COST;
}

function title(id, label, description) {
  return Object.freeze({ id, label, description });
}

function shopItem(id, label, price, type, description, titleId = null) {
  return Object.freeze({ id, label, price, type, description, titleId });
}

function eventType(id, label, description) {
  return Object.freeze({ id, label, description });
}

function achievement(id, titleText, description, isComplete, getProgressText, reward) {
  return Object.freeze({
    id,
    title: titleText,
    description,
    isComplete,
    getProgressText,
    reward: Object.freeze({
      coins: reward.coins ?? 0,
      xp: reward.xp ?? 0,
      titleId: reward.titleId ?? null
    })
  });
}

function mission(id, titleText, description, isComplete, getProgressText, reward) {
  return Object.freeze({
    id,
    title: titleText,
    description,
    isComplete,
    getProgressText,
    reward: Object.freeze({
      coins: reward.coins ?? 0,
      xp: reward.xp ?? 0
    })
  });
}

function getOrCreateGuildCommunity(data, guildId) {
  data.guilds ??= {};
  data.guilds[guildId] ??= {};
  const guild = data.guilds[guildId];
  guild.users ??= {};
  guild.community ??= {};
  guild.community.lottery = normalizeLottery(guild.community.lottery);
  guild.community.event ??= null;
  return guild.community;
}

function getOrCreateProfile(data, guildId, userId, username, now) {
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
    createdAt: now
  };

  const profile = guild.users[userId];
  profile.userId = userId;
  profile.username = username || profile.username || 'Unknown';
  profile.level = normalizeStoredPositiveInteger(profile.level, 1);
  profile.xp = normalizeStoredNonNegativeInteger(profile.xp);
  profile.totalXp = normalizeStoredNonNegativeInteger(profile.totalXp);
  profile.balance = normalizeStoredNonNegativeInteger(profile.balance);
  profile.wallets = normalizeWallets(profile.wallets);
  profile.lastMessageRewardAt = normalizeStoredNonNegativeInteger(profile.lastMessageRewardAt);
  profile.lastDailyAt = normalizeStoredNonNegativeInteger(profile.lastDailyAt);
  profile.lastDailyDay = normalizeStoredNullableInteger(profile.lastDailyDay);
  profile.dailyStreak = normalizeStoredNonNegativeInteger(profile.dailyStreak);
  profile.lastFirstMessageBonusDay = normalizeStoredNullableInteger(profile.lastFirstMessageBonusDay);
  profile.lastFortuneXpDay = normalizeStoredNullableInteger(profile.lastFortuneXpDay);
  profile.createdAt = normalizeStoredNonNegativeInteger(profile.createdAt) || now;
  normalizeCommunityProfile(profile, now);
  return profile;
}

function normalizeCommunityProfile(profile, now = Date.now()) {
  profile.community ??= {};
  const community = profile.community;
  community.stats = {
    casinoPlays: normalizeStoredNonNegativeInteger(community.stats?.casinoPlays),
    wordChainWins: normalizeStoredNonNegativeInteger(community.stats?.wordChainWins),
    transfers: normalizeStoredNonNegativeInteger(community.stats?.transfers),
    lotteryTickets: normalizeStoredNonNegativeInteger(community.stats?.lotteryTickets),
    missionsCompleted: normalizeStoredNonNegativeInteger(community.stats?.missionsCompleted),
    eventsHosted: normalizeStoredNonNegativeInteger(community.stats?.eventsHosted),
    shopPurchases: normalizeStoredNonNegativeInteger(community.stats?.shopPurchases)
  };
  community.claimedAchievements = normalizeBooleanMap(community.claimedAchievements);
  community.ownedTitles = normalizeStringArray(community.ownedTitles).filter((titleId) => TITLE_BY_ID.has(titleId));
  community.equippedTitle = community.ownedTitles.includes(community.equippedTitle)
    ? community.equippedTitle
    : null;
  community.cosmetics = {
    badges: normalizeStringArray(community.cosmetics?.badges).filter((itemId) => SHOP_ITEM_BY_ID.get(itemId)?.type === 'badge')
  };
  community.missions ??= {};
  community.missions.daily = normalizeMissionPeriodState(community.missions.daily, getDayIndex(now));
  community.missions.weekly = normalizeMissionPeriodState(community.missions.weekly, getWeekIndex(now));
  community.daily = normalizeDailyCommunityStats(community.daily, now);
  return community;
}

function normalizeDailyCommunityStats(daily, now) {
  const today = getDayIndex(now);
  const safeDaily = daily && typeof daily === 'object' ? daily : {};
  if (safeDaily.day !== today) {
    return {
      day: today,
      lotteryTickets: 0
    };
  }

  return {
    day: today,
    lotteryTickets: normalizeStoredNonNegativeInteger(safeDaily.lotteryTickets)
  };
}

function normalizeMissionPeriodState(state, period) {
  const safeState = state && typeof state === 'object' ? state : {};
  if (safeState.period !== period) {
    return {
      period,
      claimed: {}
    };
  }

  return {
    period,
    claimed: normalizeBooleanMap(safeState.claimed)
  };
}

function normalizeLottery(lottery) {
  const safeLottery = lottery && typeof lottery === 'object' ? lottery : {};
  const tickets = {};
  let totalTickets = 0;

  for (const [userId, ticket] of Object.entries(safeLottery.tickets ?? {})) {
    const count = normalizeStoredNonNegativeInteger(ticket?.count);
    if (count <= 0) continue;
    tickets[userId] = {
      userId,
      username: ticket?.username || 'Unknown',
      count
    };
    totalTickets += count;
  }

  safeLottery.jackpot = Math.max(DEFAULT_LOTTERY_JACKPOT, normalizeStoredNonNegativeInteger(safeLottery.jackpot, DEFAULT_LOTTERY_JACKPOT));
  safeLottery.tickets = tickets;
  safeLottery.totalTickets = totalTickets;
  safeLottery.lastDrawAt = normalizeStoredNonNegativeInteger(safeLottery.lastDrawAt);
  safeLottery.lastWinner = safeLottery.lastWinner && typeof safeLottery.lastWinner === 'object'
    ? {
        userId: String(safeLottery.lastWinner.userId ?? ''),
        username: safeLottery.lastWinner.username || 'Unknown',
        payout: normalizeStoredNonNegativeInteger(safeLottery.lastWinner.payout),
        drawnAt: normalizeStoredNonNegativeInteger(safeLottery.lastWinner.drawnAt)
      }
    : null;
  return safeLottery;
}

function getAchievementStatuses(profile, community) {
  return ACHIEVEMENTS.map((achievementConfig) => ({
    id: achievementConfig.id,
    title: achievementConfig.title,
    description: achievementConfig.description,
    completed: Boolean(achievementConfig.isComplete({ profile, community })),
    claimed: Boolean(community.claimedAchievements[achievementConfig.id]),
    progress: achievementConfig.getProgressText({ profile, community }),
    reward: {
      ...achievementConfig.reward,
      title: achievementConfig.reward.titleId ? TITLE_BY_ID.get(achievementConfig.reward.titleId) : null
    }
  }));
}

function getMissionStatuses(profile, community, now) {
  const context = {
    profile,
    community,
    today: getDayIndex(now),
    fortuneDay: getDayIndex(now, FORTUNE_DAY_OFFSET_MS),
    week: getWeekIndex(now)
  };
  return {
    daily: DAILY_MISSIONS.map((missionConfig) => getMissionStatus(missionConfig, context, community.missions.daily)),
    weekly: WEEKLY_MISSIONS.map((missionConfig) => getMissionStatus(missionConfig, context, community.missions.weekly))
  };
}

function getMissionStatus(missionConfig, context, periodState) {
  return {
    id: missionConfig.id,
    title: missionConfig.title,
    description: missionConfig.description,
    completed: Boolean(missionConfig.isComplete(context)),
    claimed: Boolean(periodState.claimed[missionConfig.id]),
    progress: missionConfig.getProgressText(context),
    reward: { ...missionConfig.reward }
  };
}

function getMissionPeriodState(community, type, now) {
  if (type === 'daily') {
    community.missions.daily = normalizeMissionPeriodState(community.missions.daily, getDayIndex(now));
    return community.missions.daily;
  }

  community.missions.weekly = normalizeMissionPeriodState(community.missions.weekly, getWeekIndex(now));
  return community.missions.weekly;
}

function getTitleStatuses(community) {
  return COMMUNITY_TITLES.map((titleConfig) => ({
    ...titleConfig,
    owned: community.ownedTitles.includes(titleConfig.id),
    equipped: community.equippedTitle === titleConfig.id
  }));
}

function getShopStatuses(community) {
  return SHOP_ITEMS.map((item) => ({
    ...item,
    owned: item.type === 'badge'
      ? community.cosmetics.badges.includes(item.id)
      : community.ownedTitles.includes(item.titleId)
  }));
}

function getLotteryStatus(lottery) {
  return {
    jackpot: lottery.jackpot,
    totalTickets: lottery.totalTickets,
    participants: Object.values(lottery.tickets).map((ticket) => ({ ...ticket })),
    lastWinner: lottery.lastWinner ? { ...lottery.lastWinner } : null
  };
}

function getActiveEvent(guildCommunity, now) {
  const event = guildCommunity.event;
  if (!event || typeof event !== 'object') return null;
  if (normalizeStoredNonNegativeInteger(event.endsAt) <= now) {
    guildCommunity.event = null;
    return null;
  }
  if (!EVENT_TYPE_BY_ID.has(event.type)) {
    guildCommunity.event = null;
    return null;
  }
  return event;
}

function cloneActiveEvent(event) {
  if (!event) return null;
  const typeConfig = EVENT_TYPE_BY_ID.get(event.type);
  return {
    type: event.type,
    label: typeConfig?.label ?? event.type,
    description: typeConfig?.description ?? '',
    hostUserId: event.hostUserId,
    hostUsername: event.hostUsername,
    startedAt: event.startedAt,
    endsAt: event.endsAt
  };
}

function cloneCommunityProfile(profile, now = Date.now()) {
  const community = normalizeCommunityProfile(profile, now);
  return {
    userId: profile.userId,
    username: profile.username,
    level: profile.level,
    xp: profile.xp,
    totalXp: profile.totalXp,
    balance: profile.balance,
    dailyStreak: profile.dailyStreak,
    lastDailyDay: profile.lastDailyDay,
    lastFortuneXpDay: profile.lastFortuneXpDay,
    community: cloneCommunityState(community)
  };
}

function cloneCommunityState(community) {
  return {
    stats: { ...community.stats },
    claimedAchievements: { ...community.claimedAchievements },
    ownedTitles: [...community.ownedTitles],
    equippedTitle: community.equippedTitle,
    cosmetics: {
      badges: [...community.cosmetics.badges]
    },
    missions: {
      daily: {
        period: community.missions.daily.period,
        claimed: { ...community.missions.daily.claimed }
      },
      weekly: {
        period: community.missions.weekly.period,
        claimed: { ...community.missions.weekly.claimed }
      }
    },
    daily: { ...community.daily }
  };
}

function addOwnedTitle(community, titleId) {
  if (!TITLE_BY_ID.has(titleId)) return;
  if (!community.ownedTitles.includes(titleId)) community.ownedTitles.push(titleId);
}

function normalizeTitleId(titleId) {
  const normalized = String(titleId || 'none');
  if (normalized === 'none') return normalized;
  if (!TITLE_BY_ID.has(normalized)) throw new Error('알 수 없는 칭호입니다.');
  return normalized;
}

function normalizeMissionType(type) {
  const normalized = String(type || 'daily');
  if (normalized === 'daily' || normalized === 'weekly') return normalized;
  throw new Error('미션 종류는 일일 또는 주간이어야 합니다.');
}

function normalizeBoundedInteger(value, label, min, max) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < min || normalized > max) {
    throw new Error(`${label}은 ${min}~${max} 사이의 정수여야 합니다.`);
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

function normalizeStoredPositiveInteger(value, fallback) {
  const normalized = Number(value);
  return Number.isSafeInteger(normalized) && normalized > 0 ? normalized : fallback;
}

function normalizeStoredNonNegativeInteger(value, fallback = 0) {
  const normalized = Number(value);
  return Number.isSafeInteger(normalized) && normalized >= 0 ? normalized : fallback;
}

function normalizeStoredNullableInteger(value) {
  if (value === null || value === undefined) return null;
  const normalized = Number(value);
  return Number.isSafeInteger(normalized) ? normalized : null;
}

function normalizeBooleanMap(map) {
  const safeMap = map && typeof map === 'object' ? map : {};
  return Object.fromEntries(
    Object.entries(safeMap)
      .filter(([, value]) => Boolean(value))
      .map(([key]) => [key, true])
  );
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item)).filter(Boolean))];
}

function debitBalance(profile, amount) {
  const normalizedAmount = normalizeBoundedInteger(amount, '금액', 1, Number.MAX_SAFE_INTEGER);
  if (profile.balance < normalizedAmount) {
    throw new Error(`잔액이 부족합니다. 필요 금액: ${normalizedAmount.toLocaleString()}원`);
  }
  profile.balance -= normalizedAmount;
}

function addXp(profile, xp) {
  const normalizedXp = normalizeStoredNonNegativeInteger(xp);
  const beforeLevel = profile.level;
  let levelReward = 0;

  profile.xp += normalizedXp;
  profile.totalXp += normalizedXp;

  while (profile.xp >= xpForNextLevel(profile.level)) {
    profile.xp -= xpForNextLevel(profile.level);
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

function xpForNextLevel(level) {
  return Math.floor(100 * Math.max(1, level) ** 1.5);
}

function getLevelReward(level) {
  return level * 100;
}

function applyBps(amount, bps) {
  return Math.floor(amount * bps / 10_000);
}

function getDayIndex(now, offsetMs = 0) {
  return Math.floor((now + offsetMs) / DAY_MS);
}

function getWeekIndex(now) {
  return Math.floor(now / WEEK_MS);
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
