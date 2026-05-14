import {
  CURRENCY_MAIN,
  creditCurrency,
  debitCurrency,
  getStockBankruptcySummary,
  migrateLegacyWalletsToGold,
  normalizeWallets
} from './currencies.js';
import { getOrCreateLinkedAccountProfile } from './accounts.js';
import {
  normalizeStoredMoney,
  toCompatibleMoneyValue
} from './money.js';
import * as achievements from './achievements.js';
import { SEASON_REWARDS } from './seasons.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const KOREA_TIME_OFFSET_MS = 9 * 60 * 60 * 1000;
const FORTUNE_DAY_OFFSET_MS = 9 * 60 * 60 * 1000;
const ACTIVITY_DAY_OFFSET_MS = 9 * 60 * 60 * 1000;
const ACTIVITY_SUMMARY_DAYS = 7;
const ACTIVITY_RETENTION_DAYS = 35;
const LOTTERY_TICKET_COST = 500;
const LOTTERY_FIRST_PRIZE_TICKET_MULTIPLIER = 400_000;
const DEFAULT_LOTTERY_JACKPOT = LOTTERY_TICKET_COST * LOTTERY_FIRST_PRIZE_TICKET_MULTIPLIER;
const LOTTERY_BASE_JACKPOT_BPS = 9_000;
const LOTTERY_EVENT_JACKPOT_BPS = 10_000;
const LOTTERY_NUMBER_MIN = 1;
const LOTTERY_NUMBER_MAX = 45;
const LOTTERY_PICK_COUNT = 6;
const LOTTERY_MAX_PURCHASE_QUANTITY = 1_000;
const LOTTERY_MAX_ROUND_TICKETS_PER_USER = 1_000;
const LOTTERY_MAX_ROUND_TICKETS = 10_000;
const LOTTERY_PURCHASE_PREVIEW_ENTRY_COUNT = 5;
const LOTTERY_DRAW_DAYS = Object.freeze([3, 6]); // Wednesday and Saturday in Korea Standard Time.
const LOTTERY_DRAW_HOUR = 21;
const LOTTERY_DRAW_MINUTE = 0;
const LOTTERY_AUTO_DRAW_CHECK_INTERVAL_MS = 60_000;
const MISSION_EVENT_REWARD_BPS = 15_000;
const LOTTERY_PRIZE_TIERS = Object.freeze([
  Object.freeze({ id: 'first', label: '1등', matchCount: 6, requiresBonus: false, jackpotBps: 10_000, fixedPrize: null, description: '6개 번호 일치' }),
  Object.freeze({ id: 'second', label: '2등', matchCount: 5, requiresBonus: true, jackpotBps: null, fixedPrize: LOTTERY_TICKET_COST * 40_000, description: '5개 번호 + 보너스 일치' }),
  Object.freeze({ id: 'third', label: '3등', matchCount: 5, requiresBonus: false, jackpotBps: null, fixedPrize: LOTTERY_TICKET_COST * 2_000, description: '5개 번호 일치' }),
  Object.freeze({ id: 'fourth', label: '4등', matchCount: 4, requiresBonus: false, jackpotBps: null, fixedPrize: LOTTERY_TICKET_COST * 100, description: '4개 번호 일치' }),
  Object.freeze({ id: 'fifth', label: '5등', matchCount: 3, requiresBonus: false, jackpotBps: null, fixedPrize: LOTTERY_TICKET_COST * 10, description: '3개 번호 일치' })
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

const SHOP_ITEM_BY_ID = new Map(SHOP_ITEMS.map((item) => [item.id, item]));
const EVENT_TYPE_BY_ID = new Map(EVENT_TYPES.map((item) => [item.id, item]));
const COMMUNITY_COSMETIC_BADGES = Object.freeze([
  ...SHOP_ITEMS
    .filter((item) => item.type === 'badge')
    .map((item) => Object.freeze({
      id: item.id,
      label: item.label,
      source: '상점',
      kind: 'shop_badge'
    })),
  ...SEASON_REWARDS
    .filter((reward) => ['badge', 'profile_badge'].includes(reward.kind))
    .map((reward) => Object.freeze({
      id: reward.badgeId ?? reward.id,
      label: `${reward.icon ?? ''} ${reward.label}`.trim(),
      source: '시즌 1',
      kind: reward.kind,
      rewardId: reward.id
    }))
]);
const COMMUNITY_COSMETIC_BADGE_BY_ID = new Map(COMMUNITY_COSMETIC_BADGES.map((badge) => [badge.id, badge]));

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
    '골드 5,000 보유',
    ({ profile }) => profile.balance >= 5_000,
    ({ profile }) => `${Math.min(profile.balance, 5_000).toLocaleString()} / 5,000골드`,
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
      const guildCommunity = getOrCreateGuildCommunity(data, guildId, now);
      const guild = data.guilds?.[guildId] ?? {};
      const community = normalizeCommunityProfile(profile, now);
      const achievementSources = getAchievementSources(data, guild, userId, profile);

      return {
        profile: cloneCommunityProfile(profile, now),
        community: cloneCommunityState(community),
        achievements: achievements.getAchievementStatuses(profile, community, achievementSources),
        titles: achievements.getTitleStatuses(community),
        shopItems: getShopStatuses(community),
        missions: getMissionStatuses(profile, community, now),
        lottery: getLotteryStatus(guildCommunity.lottery),
        event: cloneActiveEvent(getActiveEvent(guildCommunity, now))
      };
    });
  }

  async getWeeklyActivitySummary({ guildId, userId, username, now = Date.now() }) {
    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, now);
      const community = normalizeCommunityProfile(profile, now);
      const today = getDayIndex(now, ACTIVITY_DAY_OFFSET_MS);
      const dayKeys = Array.from(
        { length: ACTIVITY_SUMMARY_DAYS },
        (_, index) => today - (ACTIVITY_SUMMARY_DAYS - 1 - index)
      );
      const days = dayKeys.map((day) => cloneActivityDay(community.activity.days[String(day)], day));
      const totals = days.reduce((summary, day) => {
        summary.messages += day.messages;
        summary.commands += day.commands;
        summary.xp += day.xp;
        summary.chatXp += day.chatXp;
        summary.commandXp += day.commandXp;
        if (day.messages + day.commands > 0) summary.activeDays += 1;

        for (const [commandName, count] of Object.entries(day.commandCounts)) {
          summary.commandCounts[commandName] = (summary.commandCounts[commandName] ?? 0) + count;
        }

        return summary;
      }, {
        messages: 0,
        commands: 0,
        xp: 0,
        chatXp: 0,
        commandXp: 0,
        activeDays: 0,
        commandCounts: {}
      });
      const topCommands = Object.entries(totals.commandCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
        .slice(0, 5);

      return {
        profile: cloneCommunityProfile(profile, now),
        range: {
          days: ACTIVITY_SUMMARY_DAYS,
          startDay: dayKeys[0],
          endDay: dayKeys.at(-1),
          startDate: formatActivityDay(dayKeys[0]),
          endDate: formatActivityDay(dayKeys.at(-1))
        },
        totals,
        topCommands,
        days
      };
    });
  }

  async claimAchievements({ guildId, userId, username, now = Date.now() }) {
    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, now);
      const guild = data.guilds?.[guildId] ?? {};
      const community = normalizeCommunityProfile(profile, now);
      const achievementSources = getAchievementSources(data, guild, userId, profile);
      const statuses = achievements.getAchievementStatuses(profile, community, achievementSources);
      const rewardResult = applyCompletedAchievementRewards({
        profile,
        community,
        statuses,
        getStatusesAfterReward: () => achievements.getAchievementStatuses(profile, community, achievementSources)
      });

      return {
        ...rewardResult,
        totalClaimed: rewardResult.claimed.length,
        profile: cloneCommunityProfile(profile, now),
        achievements: achievements.getAchievementStatuses(profile, community, achievementSources),
        titles: achievements.getTitleStatuses(community)
      };
    });
  }

  async grantCompletedAchievements({ guildId, userId, username, now = Date.now(), limit = 5 }) {
    const safeLimit = Math.max(1, Math.min(10, normalizeStoredNonNegativeInteger(limit, 5)));

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, now);
      const guild = data.guilds?.[guildId] ?? {};
      const community = normalizeCommunityProfile(profile, now);
      const achievementSources = getAchievementSources(data, guild, userId, profile);
      const statuses = achievements.getAchievementStatuses(profile, community, achievementSources);
      const rewardResult = applyCompletedAchievementRewards({
        profile,
        community,
        statuses,
        getStatusesAfterReward: () => achievements.getAchievementStatuses(profile, community, achievementSources)
      });
      const displayed = rewardResult.claimed.slice(0, safeLimit);

      return {
        ...rewardResult,
        totalClaimed: rewardResult.claimed.length,
        displayed,
        hiddenCount: Math.max(0, rewardResult.claimed.length - displayed.length),
        profile: cloneCommunityProfile(profile, now),
        achievements: achievements.getAchievementStatuses(profile, community, achievementSources),
        titles: achievements.getTitleStatuses(community)
      };
    });
  }

  async getClaimableAchievements({ guildId, userId, username, now = Date.now(), limit = 5 }) {
    const safeLimit = Math.max(1, Math.min(10, normalizeStoredNonNegativeInteger(limit, 5)));

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, now);
      const guild = data.guilds?.[guildId] ?? {};
      const community = normalizeCommunityProfile(profile, now);
      const achievementSources = getAchievementSources(data, guild, userId, profile);
      const claimable = achievements
        .getAchievementStatuses(profile, community, achievementSources)
        .filter((status) => status.completed && !status.claimed);

      return {
        achievements: claimable.slice(0, safeLimit),
        total: claimable.length,
        profile: cloneCommunityProfile(profile, now)
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
        equippedTitle: community.equippedTitle ? achievements.getCommunityTitle(community.equippedTitle) : null,
        titles: achievements.getTitleStatuses(community),
        profile: cloneCommunityProfile(profile, now)
      };
    });
  }

  async claimMissions({ guildId, userId, username, type = 'daily', now = Date.now() }) {
    const missionType = normalizeMissionType(type);

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, now);
      const guildCommunity = getOrCreateGuildCommunity(data, guildId, now);
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
      if (totalCoins > 0) creditCurrency(profile, CURRENCY_MAIN, totalCoins);
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
    const normalizedQuantity = normalizeLotteryPurchaseQuantity(quantity);

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, now);
      const guildCommunity = getOrCreateGuildCommunity(data, guildId, now);
      const community = normalizeCommunityProfile(profile, now);
      const lottery = normalizeLottery(guildCommunity.lottery, now);
      const activeEvent = getActiveEvent(guildCommunity, now);
      const totalCost = calculateLotteryPurchaseCost(normalizedQuantity);
      const entries = [];
      const currentUserTickets = lottery.tickets[userId]?.count ?? 0;
      const remainingUserTickets = LOTTERY_MAX_ROUND_TICKETS_PER_USER - currentUserTickets;
      const remainingRoundTickets = LOTTERY_MAX_ROUND_TICKETS - lottery.totalTickets;

      if (normalizedQuantity > remainingUserTickets) {
        throw new Error(`이번 회차에는 1인당 최대 ${LOTTERY_MAX_ROUND_TICKETS_PER_USER.toLocaleString()}장까지만 구매할 수 있습니다. 남은 구매 가능 장수: ${Math.max(0, remainingUserTickets).toLocaleString()}장`);
      }

      if (normalizedQuantity > remainingRoundTickets) {
        throw new Error(`이번 회차 전체 복권은 최대 ${LOTTERY_MAX_ROUND_TICKETS.toLocaleString()}장까지만 판매됩니다. 남은 판매 장수: ${Math.max(0, remainingRoundTickets).toLocaleString()}장`);
      }

      debitBalance(profile, totalCost);
      const jackpotBps = activeEvent?.type === 'lottery_bonus'
        ? LOTTERY_EVENT_JACKPOT_BPS
        : LOTTERY_BASE_JACKPOT_BPS;
      const jackpotAdded = applyBps(totalCost, jackpotBps);
      lottery.jackpot += jackpotAdded;
      lottery.tickets[userId] ??= {
        userId,
        username: profile.username,
        count: 0,
        entries: [],
        legacyCount: 0
      };
      lottery.tickets[userId].username = profile.username;
      lottery.tickets[userId].entries ??= [];
      lottery.tickets[userId].batches ??= [];
      lottery.tickets[userId].legacyCount = normalizeStoredNonNegativeInteger(lottery.tickets[userId].legacyCount);
      const previewEntryCount = Math.min(normalizedQuantity, LOTTERY_PURCHASE_PREVIEW_ENTRY_COUNT);
      const hiddenEntryCount = normalizedQuantity - previewEntryCount;
      for (let index = 0; index < previewEntryCount; index += 1) {
        const entry = createLotteryEntry(lottery, this.randomInt, now);
        lottery.tickets[userId].entries.push(entry);
        entries.push({ ...entry, numbers: [...entry.numbers] });
      }
      if (hiddenEntryCount > 0) {
        lottery.tickets[userId].batches.push(createLotteryBatch({
          lottery,
          count: hiddenEntryCount,
          purchasedAt: now,
          userId,
          randomInt: this.randomInt
        }));
      }
      lottery.tickets[userId].count = getLotteryTicketCount(lottery.tickets[userId]);
      lottery.totalTickets += normalizedQuantity;
      community.stats.lotteryTickets += normalizedQuantity;
      community.daily.lotteryTickets += normalizedQuantity;

      return {
        quantity: normalizedQuantity,
        totalCost,
        jackpotAdded,
        eventBonus: jackpotBps > LOTTERY_BASE_JACKPOT_BPS,
        entries,
        hiddenCount: hiddenEntryCount,
        profile: cloneCommunityProfile(profile, now),
        lottery: getLotteryStatus(lottery)
      };
    });
  }

  async drawLottery({ guildId, now = Date.now(), automatic = false } = {}) {
    return this.store.update((data) => {
      const guildCommunity = getOrCreateGuildCommunity(data, guildId, now);
      const lottery = normalizeLottery(guildCommunity.lottery, now);

      if (lottery.totalTickets <= 0) {
        throw new Error('추첨할 복권이 없습니다. 먼저 `/복권 구매`로 복권을 구매하세요.');
      }

      return drawLotteryRound({
        data,
        guildId,
        lottery,
        randomInt: this.randomInt,
        now,
        automatic
      });
    });
  }

  async configureLotteryAutoDraw({
    guildId,
    enabled = true,
    channelId = null,
    now = Date.now()
  }) {
    return this.store.update((data) => {
      const guildCommunity = getOrCreateGuildCommunity(data, guildId, now);
      const lottery = normalizeLottery(guildCommunity.lottery, now);
      lottery.settings.autoDrawEnabled = Boolean(enabled);
      lottery.settings.autoDrawChannelId = lottery.settings.autoDrawEnabled && channelId
        ? String(channelId)
        : null;
      if (!Number.isSafeInteger(lottery.nextDrawAt) || lottery.nextDrawAt <= now) {
        lottery.nextDrawAt = getNextLotteryDrawAt(now);
      }

      return {
        lottery: getLotteryStatus(lottery)
      };
    });
  }

  async drawDueLotteries({ now = Date.now() } = {}) {
    return this.store.update((data) => {
      const guildIds = Object.keys(data.guilds ?? {});
      const results = [];

      for (const guildId of guildIds) {
        const guildCommunity = getOrCreateGuildCommunity(data, guildId, now);
        const lottery = normalizeLottery(guildCommunity.lottery, now);
        if (!lottery.settings.autoDrawEnabled || lottery.nextDrawAt > now) continue;

        if (lottery.totalTickets <= 0) {
          lottery.nextDrawAt = getNextLotteryDrawAt(now);
          continue;
        }

        results.push(drawLotteryRound({
          data,
          guildId,
          lottery,
          randomInt: this.randomInt,
          now,
          automatic: true
        }));
      }

      return results;
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
        titles: achievements.getTitleStatuses(community)
      };
    });
  }

  async startEvent({ guildId, userId, username, type, durationMinutes = 10, now = Date.now() }) {
    const eventTypeConfig = EVENT_TYPE_BY_ID.get(String(type));
    if (!eventTypeConfig) throw new Error('알 수 없는 서버 이벤트입니다.');
    const normalizedDuration = normalizeBoundedInteger(durationMinutes, '이벤트 시간', 1, 60);

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, now);
      const guildCommunity = getOrCreateGuildCommunity(data, guildId, now);
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
      const guildCommunity = getOrCreateGuildCommunity(data, guildId, now);
      return {
        event: cloneActiveEvent(getActiveEvent(guildCommunity, now))
      };
    });
  }

  async awardChatEventBonus({ guildId, userId, username, baseXp, now = Date.now() }) {
    const normalizedBaseXp = normalizeNonNegativeInteger(baseXp, '기본 XP');
    if (normalizedBaseXp <= 0) return null;

    return this.store.update((data) => {
      const guildCommunity = getOrCreateGuildCommunity(data, guildId, now);
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

  async recordActivity({
    guildId,
    userId,
    username,
    activity,
    amount = 1,
    xpGained = 0,
    commandName = null,
    now = Date.now()
  }) {
    const normalizedAmount = normalizeBoundedInteger(amount, '기록 수량', 1, 1_000);
    const normalizedXp = normalizeNonNegativeInteger(xpGained, '활동 XP');

    return this.store.update((data) => {
      const profile = getOrCreateProfile(data, guildId, userId, username, now);
      const community = normalizeCommunityProfile(profile, now);
      const activityDay = getOrCreateActivityDay(community, now);

      if (activity === 'casino') community.stats.casinoPlays += normalizedAmount;
      if (activity === 'wordchain_win') community.stats.wordChainWins += normalizedAmount;
      if (activity === 'transfer') community.stats.transfers += normalizedAmount;
      if (activity === 'chat') {
        community.stats.chatMessages += normalizedAmount;
        activityDay.messages += normalizedAmount;
        activityDay.xp += normalizedXp;
        activityDay.chatXp += normalizedXp;
      }
      if (activity === 'command') {
        const safeCommandName = normalizeCommandName(commandName);
        community.stats.commandsUsed += normalizedAmount;
        activityDay.commands += normalizedAmount;
        activityDay.xp += normalizedXp;
        activityDay.commandXp += normalizedXp;
        activityDay.commandCounts[safeCommandName] = (activityDay.commandCounts[safeCommandName] ?? 0) + normalizedAmount;
      }
      community.activity.lastActiveAt = now;

      return {
        activity,
        amount: normalizedAmount,
        xpGained: normalizedXp,
        community: cloneCommunityState(community)
      };
    });
  }
}

export function getCommunityTitle(titleId) {
  return achievements.getCommunityTitle(titleId);
}

export function getAchievementCategories() {
  return achievements.getAchievementCategories();
}

export function getCommunityTitles() {
  return achievements.getCommunityTitles();
}

export function getShopItems() {
  return SHOP_ITEMS.map((item) => ({ ...item }));
}

export function getCommunityCosmeticBadge(badgeId) {
  const badge = COMMUNITY_COSMETIC_BADGE_BY_ID.get(String(badgeId));
  return badge ? { ...badge } : null;
}

export function getCommunityCosmeticBadges() {
  return COMMUNITY_COSMETIC_BADGES.map((badge) => ({ ...badge }));
}

export function isCommunityCosmeticBadgeId(badgeId) {
  return COMMUNITY_COSMETIC_BADGE_BY_ID.has(String(badgeId));
}

export function getEventTypes() {
  return EVENT_TYPES.map((item) => ({ ...item }));
}

export function getLotteryTicketCost() {
  return LOTTERY_TICKET_COST;
}

export function getLotteryMaxPurchaseQuantity() {
  return LOTTERY_MAX_PURCHASE_QUANTITY;
}

export function getLotteryMaxRoundTickets() {
  return LOTTERY_MAX_ROUND_TICKETS;
}

export function getLotteryMaxRoundTicketsPerUser() {
  return LOTTERY_MAX_ROUND_TICKETS_PER_USER;
}

export function getLotteryPrizeTiers() {
  return LOTTERY_PRIZE_TIERS.map((tier) => ({ ...tier }));
}

export function getNextLotteryDrawAt(now = Date.now()) {
  const timestamp = now instanceof Date ? now.getTime() : Number(now);
  const koreaDate = new Date(timestamp + KOREA_TIME_OFFSET_MS);
  const year = koreaDate.getUTCFullYear();
  const month = koreaDate.getUTCMonth();
  const date = koreaDate.getUTCDate();
  const day = koreaDate.getUTCDay();
  const drawTimestamps = LOTTERY_DRAW_DAYS.map((drawDay) => {
    const daysUntilDraw = (drawDay - day + 7) % 7;
    const drawKoreaTimestamp = Date.UTC(
      year,
      month,
      date + daysUntilDraw,
      LOTTERY_DRAW_HOUR,
      LOTTERY_DRAW_MINUTE,
      0,
      0
    );
    const drawTimestamp = drawKoreaTimestamp - KOREA_TIME_OFFSET_MS;

    return drawTimestamp <= timestamp
      ? drawTimestamp + WEEK_MS
      : drawTimestamp;
  });

  return Math.min(...drawTimestamps);
}

export function getLotteryDrawScheduleText() {
  return '매주 수요일·토요일 21:00 KST';
}

export function formatLotteryDrawTime(timestamp) {
  const koreaDate = new Date(Number(timestamp) + KOREA_TIME_OFFSET_MS);
  const year = koreaDate.getUTCFullYear();
  const month = String(koreaDate.getUTCMonth() + 1).padStart(2, '0');
  const date = String(koreaDate.getUTCDate()).padStart(2, '0');
  const hours = String(koreaDate.getUTCHours()).padStart(2, '0');
  const minutes = String(koreaDate.getUTCMinutes()).padStart(2, '0');

  return `${year}-${month}-${date} ${hours}:${minutes} KST`;
}

export function scheduleLotteryDrawAnnouncements({
  sendAnnouncements,
  intervalMs = LOTTERY_AUTO_DRAW_CHECK_INTERVAL_MS,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
  logger = console
}) {
  let timer = null;
  let stopped = false;
  const safeIntervalMs = Math.max(10_000, Number(intervalMs) || LOTTERY_AUTO_DRAW_CHECK_INTERVAL_MS);

  const scheduleNext = () => {
    timer = setTimeoutFn(async () => {
      if (stopped) return;

      try {
        await sendAnnouncements();
      } catch (error) {
        logger.error('Failed to send lottery draw announcements:', error);
      }

      if (!stopped) {
        scheduleNext();
      }
    }, safeIntervalMs);

    if (timer && typeof timer.unref === 'function') {
      timer.unref();
    }
  };

  scheduleNext();

  return () => {
    stopped = true;
    if (timer) {
      clearTimeoutFn(timer);
    }
  };
}

function drawLotteryRound({
  data,
  guildId,
  lottery,
  randomInt,
  now,
  automatic
}) {
  const entries = collectLotteryEntries(lottery, randomInt, now);
  if (entries.length <= 0) {
    throw new Error('추첨할 복권이 없습니다. 먼저 `/복권 구매`로 복권을 구매하세요.');
  }

  const { numbers: winningNumbers, bonusNumber } = drawLotteryNumbers(randomInt);
  const tierEntries = Object.fromEntries(LOTTERY_PRIZE_TIERS.map((tier) => [tier.id, []]));

  for (const entry of entries) {
    const result = evaluateLotteryEntry(entry, winningNumbers, bonusNumber);
    if (result.tier) {
      tierEntries[result.tier.id].push({
        ...entry,
        matchedNumbers: result.matchedNumbers,
        matchedBonus: result.matchedBonus
      });
    }
  }

  const jackpotBefore = lottery.jackpot;
  const payoutLedger = new Map();
  const tierSummaries = [];
  let totalPaid = 0;
  let jackpotPoolPaid = 0;

  for (const tier of LOTTERY_PRIZE_TIERS) {
    const winners = tierEntries[tier.id];
    const isJackpotTier = tier.jackpotBps !== null;
    const prizePool = tier.fixedPrize
      ? tier.fixedPrize * winners.length
      : isJackpotTier
      ? applyBps(jackpotBefore, tier.jackpotBps)
      : 0;
    const prizePerTicket = winners.length > 0
      ? tier.fixedPrize ?? Math.floor(prizePool / winners.length)
      : 0;
    let tierPayout = 0;

    for (const winner of winners) {
      if (prizePerTicket <= 0) continue;
      payLotteryWinner(data, guildId, winner, tier, prizePerTicket, payoutLedger, now);
      tierPayout += prizePerTicket;
      totalPaid += prizePerTicket;
    }

    if (isJackpotTier) {
      jackpotPoolPaid += tierPayout;
    }

    tierSummaries.push({
      id: tier.id,
      label: tier.label,
      description: tier.description,
      winnerCount: winners.length,
      prizePerTicket,
      totalPayout: tierPayout
    });
  }

  const rollover = Math.max(0, jackpotBefore - jackpotPoolPaid);
  const topWinners = [...payoutLedger.values()]
    .map((winner) => ({
      ...winner,
      payout: winner.totalPayout,
      tiers: { ...winner.tiers }
    }))
    .sort((a, b) => b.totalPayout - a.totalPayout || a.username.localeCompare(b.username));
  const headlineWinner = topWinners[0] ?? null;
  const headlineProfile = headlineWinner
    ? getOrCreateProfile(data, guildId, headlineWinner.userId, headlineWinner.username, now)
    : null;

  lottery.lastWinner = headlineWinner
    ? {
        userId: headlineWinner.userId,
        username: headlineWinner.username,
        payout: headlineWinner.totalPayout,
        drawnAt: now
      }
    : null;
  lottery.lastDrawAt = now;
  lottery.lastDraw = {
    drawnAt: now,
    automatic: Boolean(automatic),
    winningNumbers,
    bonusNumber,
    jackpotBefore,
    totalTickets: entries.length,
    totalPaid,
    rollover,
    tierSummaries,
    topWinners: topWinners.slice(0, 5),
    luckyWinner: null
  };
  lottery.jackpot = Math.max(DEFAULT_LOTTERY_JACKPOT, rollover);
  lottery.nextDrawAt = getNextLotteryDrawAt(now);
  lottery.tickets = {};
  lottery.totalTickets = 0;
  lottery.nextTicketSeq = 0;

  return {
    guildId,
    automatic: Boolean(automatic),
    channelId: lottery.settings.autoDrawChannelId,
    winner: headlineProfile ? cloneCommunityProfile(headlineProfile, now) : null,
    headlineWinner,
    payout: headlineWinner?.totalPayout ?? 0,
    totalPaid,
    rollover,
    winningNumbers: [...winningNumbers],
    bonusNumber,
    jackpotBefore,
    totalTickets: entries.length,
    tierSummaries: tierSummaries.map((summary) => ({ ...summary })),
    topWinners,
    luckyWinner: null,
    lottery: getLotteryStatus(lottery)
  };
}

function collectLotteryEntries(lottery, randomInt, now) {
  const entries = [];

  for (const ticket of Object.values(lottery.tickets)) {
    ticket.entries ??= [];
    ticket.batches ??= [];
    const legacyCount = normalizeStoredNonNegativeInteger(ticket.legacyCount);
    for (let index = 0; index < legacyCount; index += 1) {
      const entry = createLotteryEntry(lottery, randomInt, now);
      entries.push({
        id: entry.id,
        userId: ticket.userId,
        username: ticket.username,
        numbers: [...entry.numbers],
        purchasedAt: entry.purchasedAt
      });
    }
    ticket.legacyCount = 0;

    for (const entry of ticket.entries) {
      entries.push({
        id: entry.id,
        userId: ticket.userId,
        username: ticket.username,
        numbers: [...entry.numbers],
        purchasedAt: entry.purchasedAt
      });
    }

    for (const batch of ticket.batches) {
      for (let index = 0; index < batch.count; index += 1) {
        const entry = createLotteryBatchEntry(batch, index);
        entries.push({
          id: entry.id,
          userId: ticket.userId,
          username: ticket.username,
          numbers: [...entry.numbers],
          purchasedAt: entry.purchasedAt
        });
      }
    }

    ticket.count = getLotteryTicketCount(ticket);
  }

  lottery.totalTickets = entries.length;
  return entries;
}

function createLotteryEntry(lottery, randomInt, purchasedAt) {
  lottery.nextTicketSeq = normalizeStoredNonNegativeInteger(lottery.nextTicketSeq) + 1;
  return {
    id: `L${String(lottery.nextTicketSeq).padStart(6, '0')}`,
    numbers: drawLotteryPick(randomInt),
    purchasedAt
  };
}

function createLotteryBatch({ lottery, count, purchasedAt, userId, randomInt }) {
  const normalizedCount = normalizeLotteryBatchCount(count);
  const startSeq = normalizeStoredNonNegativeInteger(lottery.nextTicketSeq) + 1;
  lottery.nextTicketSeq = startSeq + normalizedCount - 1;

  return {
    startSeq,
    count: normalizedCount,
    purchasedAt,
    seed: createLotteryBatchSeed({ userId, purchasedAt, startSeq, count: normalizedCount, randomInt })
  };
}

function createLotteryBatchSeed({ userId, purchasedAt, startSeq, count, randomInt }) {
  const nonce = normalizeStoredNonNegativeInteger(randomInt(0, 2 ** 32 - 1));
  return `${userId}:${purchasedAt}:${startSeq}:${count}:${nonce}`;
}

function createLotteryBatchEntry(batch, index) {
  const sequence = batch.startSeq + index;
  return {
    id: `L${String(sequence).padStart(6, '0')}`,
    numbers: drawDeterministicLotteryPick(`${batch.seed}:${index}`),
    purchasedAt: batch.purchasedAt
  };
}

function drawLotteryNumbers(randomInt) {
  const pool = createLotteryNumberPool();
  const numbers = drawLotteryPickFromPool(pool, randomInt, LOTTERY_PICK_COUNT);
  const bonusNumber = drawLotteryPickFromPool(pool, randomInt, 1)[0];

  return {
    numbers,
    bonusNumber
  };
}

function drawLotteryPick(randomInt) {
  return drawLotteryPickFromPool(createLotteryNumberPool(), randomInt, LOTTERY_PICK_COUNT);
}

function drawDeterministicLotteryPick(seed) {
  const random = createDeterministicRandom(seed);
  const pool = createLotteryNumberPool();
  const picks = [];

  while (picks.length < LOTTERY_PICK_COUNT) {
    const index = Math.floor(random() * pool.length);
    picks.push(pool.splice(index, 1)[0]);
  }

  return picks.sort((a, b) => a - b);
}

function drawLotteryPickFromPool(pool, randomInt, count) {
  const picks = [];
  while (picks.length < count) {
    const rolledIndex = normalizeBoundedInteger(randomInt(1, pool.length), '복권 번호 위치', 1, pool.length);
    const index = rolledIndex - 1;
    picks.push(pool.splice(index, 1)[0]);
  }

  return picks.sort((a, b) => a - b);
}

function createLotteryNumberPool() {
  return Array.from(
    { length: LOTTERY_NUMBER_MAX - LOTTERY_NUMBER_MIN + 1 },
    (_, index) => LOTTERY_NUMBER_MIN + index
  );
}

function createDeterministicRandom(seed) {
  let state = hashStringToUint32(seed);

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function hashStringToUint32(value) {
  let hash = 0x811c9dc5;
  for (const char of String(value)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

function evaluateLotteryEntry(entry, winningNumbers, bonusNumber) {
  const winningSet = new Set(winningNumbers);
  const matchedNumbers = entry.numbers.filter((number) => winningSet.has(number));
  const matchedBonus = entry.numbers.includes(bonusNumber);
  const tier = LOTTERY_PRIZE_TIERS.find((candidate) => {
    if (candidate.matchCount !== matchedNumbers.length) return false;
    return candidate.requiresBonus ? matchedBonus : true;
  }) ?? null;

  return {
    tier,
    matchedNumbers,
    matchedBonus
  };
}

function payLotteryWinner(data, guildId, entry, tier, amount, payoutLedger, now) {
  const winnerProfile = getOrCreateProfile(data, guildId, entry.userId, entry.username, now);
  creditCurrency(winnerProfile, CURRENCY_MAIN, amount);

  const summary = payoutLedger.get(entry.userId) ?? {
    userId: winnerProfile.userId,
    username: winnerProfile.username,
    totalPayout: 0,
    winningTickets: 0,
    tiers: {}
  };
  summary.username = winnerProfile.username;
  summary.totalPayout += amount;
  summary.winningTickets += 1;
  summary.tiers[tier.label] = (summary.tiers[tier.label] ?? 0) + 1;
  payoutLedger.set(entry.userId, summary);
}

function shopItem(id, label, price, type, description, titleId = null) {
  return Object.freeze({ id, label, price, type, description, titleId });
}

function eventType(id, label, description) {
  return Object.freeze({ id, label, description });
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

function getOrCreateGuildCommunity(data, guildId, now = Date.now()) {
  data.guilds ??= {};
  data.guilds[guildId] ??= {};
  const guild = data.guilds[guildId];
  guild.community ??= {};
  guild.community.lottery = normalizeLottery(guild.community.lottery, now);
  guild.community.event ??= null;
  return guild.community;
}

function getOrCreateProfile(data, guildId, userId, username, now) {
  const profile = getOrCreateLinkedAccountProfile(data, {
    guildId,
    userId,
    username,
    now,
    createDefaultProfile: createDefaultCommunityAccountProfile
  });
  profile.userId = String(userId ?? '').trim();
  profile.username = username || profile.username || 'Unknown';
  profile.level = normalizeStoredPositiveInteger(profile.level, 1);
  profile.xp = normalizeStoredNonNegativeInteger(profile.xp);
  profile.totalXp = normalizeStoredNonNegativeInteger(profile.totalXp);
  profile.balance = normalizeCommunityGold(profile.balance);
  migrateLegacyWalletsToGold(profile, { now });
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

function getAchievementSources(data, guild, userId, profile) {
  const normalizedUserId = String(userId ?? profile?.userId ?? '').trim();

  return {
    rpg: profile?.rpg ?? null,
    sword: profile?.sword ?? null,
    fishing: data?.fishing?.users?.[normalizedUserId] ?? profile?.fishing ?? guild?.fishing?.users?.[normalizedUserId] ?? null,
    mining: data?.mining?.users?.[normalizedUserId] ?? profile?.mining ?? guild?.mining?.users?.[normalizedUserId] ?? null,
    stocks: data?.stocks?.users?.[normalizedUserId] ?? guild?.stocks?.users?.[normalizedUserId] ?? null,
    tamagotchi: guild?.tamagotchi?.users?.[normalizedUserId] ?? null
  };
}

function createDefaultCommunityAccountProfile(userId, username, now = Date.now()) {
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
    shopPurchases: normalizeStoredNonNegativeInteger(community.stats?.shopPurchases),
    chatMessages: normalizeStoredNonNegativeInteger(community.stats?.chatMessages),
    commandsUsed: normalizeStoredNonNegativeInteger(community.stats?.commandsUsed)
  };
  community.claimedAchievements = normalizeBooleanMap(community.claimedAchievements);
  community.ownedTitles = normalizeStringArray(community.ownedTitles).filter((titleId) => achievements.isCommunityTitleId(titleId));
  community.equippedTitle = community.ownedTitles.includes(community.equippedTitle)
    ? community.equippedTitle
    : null;
  community.cosmetics = {
    badges: normalizeStringArray(community.cosmetics?.badges).filter((itemId) => isCommunityCosmeticBadgeId(itemId))
  };
  community.missions ??= {};
  community.missions.daily = normalizeMissionPeriodState(community.missions.daily, getDayIndex(now));
  community.missions.weekly = normalizeMissionPeriodState(community.missions.weekly, getWeekIndex(now));
  community.daily = normalizeDailyCommunityStats(community.daily, now);
  community.activity = normalizeActivityLog(community.activity, now);
  return community;
}

function normalizeActivityLog(activity, now) {
  const safeActivity = activity && typeof activity === 'object' ? activity : {};
  const today = getDayIndex(now, ACTIVITY_DAY_OFFSET_MS);
  const oldestDay = today - ACTIVITY_RETENTION_DAYS + 1;
  const days = {};

  for (const [dayKey, rawDay] of Object.entries(safeActivity.days ?? {})) {
    const day = Number(dayKey);
    if (!Number.isSafeInteger(day) || day < oldestDay) continue;
    days[String(day)] = normalizeActivityDay(rawDay, day);
  }

  return {
    days,
    lastActiveAt: normalizeStoredNonNegativeInteger(safeActivity.lastActiveAt)
  };
}

function normalizeActivityDay(rawDay, day) {
  const safeDay = rawDay && typeof rawDay === 'object' ? rawDay : {};
  return {
    day,
    messages: normalizeStoredNonNegativeInteger(safeDay.messages),
    commands: normalizeStoredNonNegativeInteger(safeDay.commands),
    xp: normalizeStoredNonNegativeInteger(safeDay.xp),
    chatXp: normalizeStoredNonNegativeInteger(safeDay.chatXp),
    commandXp: normalizeStoredNonNegativeInteger(safeDay.commandXp),
    commandCounts: normalizeCountsMap(safeDay.commandCounts)
  };
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

function normalizeLottery(lottery, now = Date.now()) {
  const safeLottery = lottery && typeof lottery === 'object' ? lottery : {};
  const tickets = {};
  let totalTickets = 0;

  for (const [userId, ticket] of Object.entries(safeLottery.tickets ?? {})) {
    const entries = normalizeLotteryEntries(ticket?.entries);
    const batches = normalizeLotteryBatches(ticket?.batches);
    const batchCount = batches.reduce((sum, batch) => sum + batch.count, 0);
    const storedCount = normalizeStoredNonNegativeInteger(ticket?.count);
    const storedLegacyCount = normalizeStoredNonNegativeInteger(ticket?.legacyCount);
    const legacyCount = Math.max(storedLegacyCount, storedCount - entries.length - batchCount);
    const totalCount = entries.length + batchCount + legacyCount;
    if (totalCount <= 0) continue;
    tickets[userId] = {
      userId,
      username: ticket?.username || 'Unknown',
      count: totalCount,
      entries,
      batches,
      legacyCount
    };
    totalTickets += totalCount;
  }

  safeLottery.jackpot = Math.max(DEFAULT_LOTTERY_JACKPOT, normalizeStoredNonNegativeInteger(safeLottery.jackpot, DEFAULT_LOTTERY_JACKPOT));
  safeLottery.tickets = tickets;
  safeLottery.totalTickets = totalTickets;
  safeLottery.nextTicketSeq = normalizeStoredNonNegativeInteger(safeLottery.nextTicketSeq);
  safeLottery.lastDrawAt = normalizeStoredNonNegativeInteger(safeLottery.lastDrawAt);
  safeLottery.nextDrawAt = normalizeLotteryNextDrawAt(safeLottery.nextDrawAt, now);
  safeLottery.settings = normalizeLotterySettings(safeLottery.settings);
  safeLottery.lastWinner = safeLottery.lastWinner && typeof safeLottery.lastWinner === 'object'
    ? {
        userId: String(safeLottery.lastWinner.userId ?? ''),
        username: safeLottery.lastWinner.username || 'Unknown',
        payout: normalizeStoredNonNegativeInteger(safeLottery.lastWinner.payout),
        drawnAt: normalizeStoredNonNegativeInteger(safeLottery.lastWinner.drawnAt)
      }
    : null;
  safeLottery.lastDraw = normalizeLotteryLastDraw(safeLottery.lastDraw);
  return safeLottery;
}

function normalizeLotteryNextDrawAt(nextDrawAt, now) {
  const storedNextDrawAt = normalizeStoredNonNegativeInteger(nextDrawAt);
  const currentScheduleNextDrawAt = getNextLotteryDrawAt(now);

  if (storedNextDrawAt <= 0) return currentScheduleNextDrawAt;
  if (storedNextDrawAt <= now) return storedNextDrawAt;
  if (!isLotteryScheduledDrawAt(storedNextDrawAt)) return currentScheduleNextDrawAt;

  return Math.min(storedNextDrawAt, currentScheduleNextDrawAt);
}

function isLotteryScheduledDrawAt(timestamp) {
  const koreaDate = new Date(Number(timestamp) + KOREA_TIME_OFFSET_MS);

  return LOTTERY_DRAW_DAYS.includes(koreaDate.getUTCDay())
    && koreaDate.getUTCHours() === LOTTERY_DRAW_HOUR
    && koreaDate.getUTCMinutes() === LOTTERY_DRAW_MINUTE
    && koreaDate.getUTCSeconds() === 0
    && koreaDate.getUTCMilliseconds() === 0;
}

function normalizeLotteryEntries(entries) {
  if (!Array.isArray(entries)) return [];

  return entries
    .map((entry, index) => {
      const safeEntry = entry && typeof entry === 'object' ? entry : {};
      const numbers = normalizeLotteryNumbers(safeEntry.numbers);
      if (!numbers) return null;

      return {
        id: String(safeEntry.id || `legacy-${index + 1}`),
        numbers,
        purchasedAt: normalizeStoredNonNegativeInteger(safeEntry.purchasedAt)
      };
    })
    .filter(Boolean);
}

function normalizeLotteryBatches(batches) {
  if (!Array.isArray(batches)) return [];

  return batches
    .map((batch) => {
      const safeBatch = batch && typeof batch === 'object' ? batch : {};
      const startSeq = normalizeStoredPositiveInteger(safeBatch.startSeq, 0);
      const count = normalizeLotteryBatchCount(safeBatch.count);
      const seed = String(safeBatch.seed ?? '');

      if (startSeq <= 0 || count <= 0 || !seed) return null;

      return {
        startSeq,
        count,
        seed,
        purchasedAt: normalizeStoredNonNegativeInteger(safeBatch.purchasedAt)
      };
    })
    .filter(Boolean);
}

function normalizeLotteryBatchCount(value) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < 1 || normalized > LOTTERY_MAX_PURCHASE_QUANTITY) {
    return 0;
  }
  return normalized;
}

function getLotteryTicketCount(ticket) {
  const entryCount = Array.isArray(ticket.entries) ? ticket.entries.length : 0;
  const batchCount = Array.isArray(ticket.batches)
    ? ticket.batches.reduce((sum, batch) => sum + normalizeLotteryBatchCount(batch.count), 0)
    : 0;
  return entryCount + batchCount + normalizeStoredNonNegativeInteger(ticket.legacyCount);
}

function normalizeLotteryNumbers(numbers) {
  if (!Array.isArray(numbers)) return null;
  const normalized = numbers.map((number) => Number(number));
  const unique = [...new Set(normalized)];

  if (unique.length !== LOTTERY_PICK_COUNT) return null;
  if (!unique.every((number) => Number.isSafeInteger(number)
    && number >= LOTTERY_NUMBER_MIN
    && number <= LOTTERY_NUMBER_MAX)) {
    return null;
  }

  return unique.sort((a, b) => a - b);
}

function normalizeLotterySettings(settings) {
  const safeSettings = settings && typeof settings === 'object' ? settings : {};
  return {
    autoDrawEnabled: safeSettings.autoDrawEnabled !== false,
    autoDrawChannelId: safeSettings.autoDrawChannelId ? String(safeSettings.autoDrawChannelId) : null
  };
}

function normalizeLotteryLastDraw(lastDraw) {
  if (!lastDraw || typeof lastDraw !== 'object') return null;

  return {
    drawnAt: normalizeStoredNonNegativeInteger(lastDraw.drawnAt),
    automatic: Boolean(lastDraw.automatic),
    winningNumbers: normalizeLotteryNumbers(lastDraw.winningNumbers) ?? [],
    bonusNumber: normalizeStoredNonNegativeInteger(lastDraw.bonusNumber),
    jackpotBefore: normalizeStoredNonNegativeInteger(lastDraw.jackpotBefore),
    totalTickets: normalizeStoredNonNegativeInteger(lastDraw.totalTickets),
    totalPaid: normalizeStoredNonNegativeInteger(lastDraw.totalPaid),
    rollover: normalizeStoredNonNegativeInteger(lastDraw.rollover),
    tierSummaries: Array.isArray(lastDraw.tierSummaries)
      ? lastDraw.tierSummaries.map(normalizeLotteryTierSummary)
      : [],
    topWinners: Array.isArray(lastDraw.topWinners)
      ? lastDraw.topWinners.map(normalizeLotteryWinnerSummary)
      : [],
    luckyWinner: lastDraw.luckyWinner ? normalizeLotteryWinnerSummary(lastDraw.luckyWinner) : null
  };
}

function normalizeLotteryTierSummary(summary) {
  const safeSummary = summary && typeof summary === 'object' ? summary : {};
  return {
    id: String(safeSummary.id ?? ''),
    label: String(safeSummary.label ?? ''),
    description: String(safeSummary.description ?? ''),
    winnerCount: normalizeStoredNonNegativeInteger(safeSummary.winnerCount),
    prizePerTicket: normalizeStoredNonNegativeInteger(safeSummary.prizePerTicket),
    totalPayout: normalizeStoredNonNegativeInteger(safeSummary.totalPayout)
  };
}

function normalizeLotteryWinnerSummary(winner) {
  const safeWinner = winner && typeof winner === 'object' ? winner : {};
  return {
    userId: String(safeWinner.userId ?? ''),
    username: safeWinner.username || 'Unknown',
    payout: normalizeStoredNonNegativeInteger(safeWinner.payout ?? safeWinner.totalPayout),
    totalPayout: normalizeStoredNonNegativeInteger(safeWinner.totalPayout ?? safeWinner.payout),
    winningTickets: normalizeStoredNonNegativeInteger(safeWinner.winningTickets),
    tiers: safeWinner.tiers && typeof safeWinner.tiers === 'object'
      ? Object.fromEntries(Object.entries(safeWinner.tiers).map(([tier, count]) => [
          String(tier),
          normalizeStoredNonNegativeInteger(count)
        ]))
      : {}
  };
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
    nextDrawAt: lottery.nextDrawAt,
    autoDrawEnabled: lottery.settings.autoDrawEnabled,
    autoDrawChannelId: lottery.settings.autoDrawChannelId,
    participants: Object.values(lottery.tickets).map((ticket) => ({
      userId: ticket.userId,
      username: ticket.username,
      count: ticket.count,
      entries: getLotteryTicketPreviewEntries(ticket, LOTTERY_PURCHASE_PREVIEW_ENTRY_COUNT)
    })),
    lastWinner: lottery.lastWinner ? { ...lottery.lastWinner } : null,
    lastDraw: lottery.lastDraw ? cloneLotteryLastDraw(lottery.lastDraw) : null
  };
}

function getLotteryTicketPreviewEntries(ticket, limit) {
  const entries = [];
  const normalizedLimit = normalizeStoredPositiveInteger(limit, LOTTERY_PURCHASE_PREVIEW_ENTRY_COUNT);

  for (const entry of ticket.entries ?? []) {
    entries.push({
      ...entry,
      numbers: [...entry.numbers]
    });
    if (entries.length >= normalizedLimit) return entries;
  }

  for (const batch of ticket.batches ?? []) {
    for (let index = 0; index < batch.count; index += 1) {
      const entry = createLotteryBatchEntry(batch, index);
      entries.push({
        ...entry,
        numbers: [...entry.numbers]
      });
      if (entries.length >= normalizedLimit) return entries;
    }
  }

  return entries;
}

function cloneLotteryLastDraw(lastDraw) {
  return {
    ...lastDraw,
    winningNumbers: [...lastDraw.winningNumbers],
    tierSummaries: lastDraw.tierSummaries.map((summary) => ({ ...summary })),
    topWinners: lastDraw.topWinners.map((winner) => ({
      ...winner,
      tiers: { ...winner.tiers }
    })),
    luckyWinner: lastDraw.luckyWinner
      ? { ...lastDraw.luckyWinner, tiers: { ...lastDraw.luckyWinner.tiers } }
      : null
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
    bankruptcy: getStockBankruptcySummary(profile),
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
    daily: { ...community.daily },
    activity: {
      lastActiveAt: community.activity.lastActiveAt,
      days: Object.fromEntries(
        Object.entries(community.activity.days).map(([day, value]) => [day, cloneActivityDay(value, Number(day))])
      )
    }
  };
}

function getOrCreateActivityDay(community, now) {
  const day = getDayIndex(now, ACTIVITY_DAY_OFFSET_MS);
  community.activity = normalizeActivityLog(community.activity, now);
  community.activity.days[String(day)] ??= normalizeActivityDay(null, day);
  return community.activity.days[String(day)];
}

function cloneActivityDay(day, fallbackDay) {
  const normalized = normalizeActivityDay(day, fallbackDay);
  return {
    ...normalized,
    date: formatActivityDay(normalized.day),
    commandCounts: { ...normalized.commandCounts }
  };
}

function normalizeCountsMap(map) {
  const safeMap = map && typeof map === 'object' ? map : {};
  const result = {};

  for (const [key, value] of Object.entries(safeMap)) {
    const count = normalizeStoredNonNegativeInteger(value);
    if (count > 0) result[String(key)] = count;
  }

  return result;
}

function applyCompletedAchievementRewards({ profile, community, statuses, getStatusesAfterReward = null }) {
  const claimed = [];
  let totalCoins = 0;
  let totalXp = 0;
  let levelResult = {
    leveledUp: false,
    levelsGained: 0,
    levelReward: 0
  };

  let pendingStatuses = statuses;
  while (true) {
    const newlyClaimed = pendingStatuses.filter((status) => status.completed && !status.claimed);
    if (newlyClaimed.length <= 0) break;

    let batchCoins = 0;
    let batchXp = 0;
    for (const status of newlyClaimed) {
      community.claimedAchievements[status.id] = true;
      batchCoins += status.reward.coins;
      batchXp += status.reward.xp;
      if (status.reward.titleId) addOwnedTitle(community, status.reward.titleId);
      claimed.push(status);
    }

    if (batchCoins > 0) creditCurrency(profile, CURRENCY_MAIN, batchCoins);
    const batchLevelResult = addXp(profile, batchXp);

    totalCoins += batchCoins;
    totalXp += batchXp;
    levelResult = {
      leveledUp: levelResult.leveledUp || batchLevelResult.leveledUp,
      levelsGained: levelResult.levelsGained + batchLevelResult.levelsGained,
      levelReward: levelResult.levelReward + batchLevelResult.levelReward
    };

    if (typeof getStatusesAfterReward !== 'function') break;
    pendingStatuses = getStatusesAfterReward();
  }

  return {
    claimed,
    totalCoins,
    totalXp,
    ...levelResult
  };
}

function normalizeCommandName(commandName) {
  const normalized = String(commandName || '명령어').trim().replace(/^\//, '');
  return normalized || '명령어';
}

function formatActivityDay(day) {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

function addOwnedTitle(community, titleId) {
  achievements.addOwnedTitle(community, titleId);
}

function normalizeTitleId(titleId) {
  const normalized = String(titleId || 'none');
  if (normalized === 'none') return normalized;
  if (!achievements.isCommunityTitleId(normalized)) throw new Error('알 수 없는 칭호입니다.');
  return normalized;
}

function normalizeMissionType(type) {
  const normalized = String(type || 'daily');
  if (normalized === 'daily' || normalized === 'weekly') return normalized;
  throw new Error('미션 종류는 일일 또는 주간이어야 합니다.');
}

function normalizeLotteryPurchaseQuantity(value) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < 1) {
    throw new Error('복권 장수는 1장 이상의 정수여야 합니다.');
  }
  if (normalized > LOTTERY_MAX_PURCHASE_QUANTITY) {
    throw new Error(`복권은 한 번에 최대 ${LOTTERY_MAX_PURCHASE_QUANTITY.toLocaleString()}장까지만 구매할 수 있습니다.`);
  }
  return normalized;
}

function calculateLotteryPurchaseCost(quantity) {
  const totalCost = quantity * LOTTERY_TICKET_COST;
  return normalizeBoundedInteger(totalCost, '복권 구매 금액', 1, Number.MAX_SAFE_INTEGER);
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
  debitCurrency(profile, CURRENCY_MAIN, normalizedAmount, `골드가 부족합니다. 필요 금액: ${normalizedAmount.toLocaleString()}골드`);
}

function normalizeCommunityGold(value) {
  return toCompatibleMoneyValue(normalizeStoredMoney(value));
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
    creditCurrency(profile, CURRENCY_MAIN, reward);
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
