import {
  getDefaultTamagotchiDecorationId,
  getDefaultTamagotchiSkinId,
  getNextTamagotchiDecorationId,
  getNextTamagotchiSkinId,
  getTamagotchiDecorationById,
  getTamagotchiGrowthStageById,
  getTamagotchiGrowthStages,
  getTamagotchiSkinById,
  normalizeTamagotchiDecorationId,
  normalizeTamagotchiSkinId
} from './tamagotchi-assets.js';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const KOREA_TIME_OFFSET_MS = 9 * HOUR_MS;
const MAX_STAT = 100;
const MIN_STAT = 0;
const TAMAGOTCHI_SCHEMA_VERSION = 1;
const EVENT_LOG_LIMIT = 10;

const DEFAULT_OPTIONS = Object.freeze({
  neglectDeathMs: 48 * HOUR_MS,
  fullnessDecayPerHour: 7,
  happinessDecayPerHour: 5,
  cleanlinessDecayPerHour: 4,
  energyDecayPerHour: 3,
  healthDecayPerLowNeedPerHour: 7,
  sicknessHealthDecayPerHour: 9,
  illnessDeathMs: 24 * HOUR_MS,
  actionCooldownMs: 60 * 1000,
  leisureCooldownMs: 3 * 60 * 1000,
  randomEventEveryActions: 7,
  dailyRewardMemoryShards: 2
});

const DEFAULT_STATS = Object.freeze({
  fullness: 72,
  happiness: 76,
  cleanliness: 78,
  energy: 70,
  health: 88,
  affection: 5
});

export const TAMAGOTCHI_ACTIONS = Object.freeze({
  feed: '밥주기',
  play: '놀아주기',
  clean: '씻기기',
  nap: '재우기',
  medicine: '약주기',
  revive: '부활'
});

export const TAMAGOTCHI_LEISURES = Object.freeze({
  reels: leisure('reels', '릴스보기', '📱', {
    happiness: 24,
    affection: 5,
    energy: -8,
    cleanliness: -3,
    fullness: -3
  }),
  heeheebot: leisure('heeheebot', '희희봇하기', '🤖', {
    happiness: 28,
    affection: 7,
    energy: -6,
    cleanliness: -2,
    fullness: -4
  }),
  djmax: leisure('djmax', '디맥하기', '🎹', {
    happiness: 32,
    affection: 8,
    energy: -14,
    cleanliness: -4,
    fullness: -6
  }),
  walk: leisure('walk', '산책하기', '🚶', {
    happiness: 20,
    affection: 6,
    health: 5,
    energy: -10,
    cleanliness: -6,
    fullness: -5
  }),
  music: leisure('music', '음악듣기', '🎧', {
    happiness: 18,
    affection: 5,
    energy: 3,
    fullness: -2
  }),
  monkey: leisure('monkey', '원숭이', '🐒', {
    happiness: 30,
    affection: 9,
    energy: -8,
    cleanliness: -4,
    fullness: -4
  }),
  tease_monkey: leisure('tease_monkey', '원숭이 괴롭히기', '🙈', {
    happiness: 38,
    affection: -7,
    health: -8,
    energy: -12,
    cleanliness: -8,
    fullness: -5
  })
});

export const TAMAGOTCHI_GROWTH_BRANCHES = Object.freeze({
  balanced: branch('balanced', '균형형 희진', '전체 만족도가 고르게 높은 안정 성장 분기'),
  beloved: branch('beloved', '사랑둥이 희진', '애정과 꾸준한 케어가 높은 애교 성장 분기'),
  gourmet: branch('gourmet', '먹방 희진', '밥주기와 배부름이 발달한 든든 성장 분기'),
  entertainer: branch('entertainer', '예능 희진', '놀아주기와 행복이 발달한 활발 성장 분기'),
  heeheebotter: branch('heeheebotter', '희희봇 장인 희진', '희희봇하기를 많이 한 봇친화 성장 분기'),
  rhythm: branch('rhythm', '디맥 희진', '디맥하기와 리듬 여가가 발달한 리듬 성장 분기'),
  tidy: branch('tidy', '반짝 희진', '씻기기와 청결이 발달한 깔끔 성장 분기'),
  dreamer: branch('dreamer', '꿈꾸는 희진', '재우기와 에너지가 발달한 포근 성장 분기'),
  healthy: branch('healthy', '튼튼 희진', '건강 관리와 산책이 발달한 건강 성장 분기'),
  monkey: branch('monkey', '원숭이친구 희진', '원숭이 여가로 기분이 좋아진 장난 성장 분기'),
  mischievous: branch('mischievous', '말썽 희진', '원숭이 괴롭히기 등 장난 여가가 강한 위험 성장 분기'),
  fragile: branch('fragile', '병약 희진', '만족도가 낮거나 병치레가 많은 허약 성장 분기'),
  neglected: branch('neglected', '쓸쓸한 희진', '만족도와 케어 품질이 크게 낮은 방치 성장 분기')
});

export const TAMAGOTCHI_DAILY_MISSIONS = Object.freeze([
  dailyMission('feed', '아침밥 챙기기', '🍚', 'feed'),
  dailyMission('play', '기분 풀어주기', '🧸', 'play'),
  dailyMission('clean', '보송하게 씻기기', '🫧', 'clean'),
  dailyMission('leisure', '여가 한 번 보내기', '🎮', 'leisure')
]);

const TAMAGOTCHI_RANDOM_EVENTS = Object.freeze([
  randomEvent('secret_snack', '몰래 간식', '🍪 희진이 몰래 간식을 찾아냈어요. 배부름이 조금 올랐습니다.', {
    fullness: 7,
    happiness: 2
  }),
  randomEvent('monkey_visit', '원숭이 방문', '🐒 원숭이가 놀러 와서 희진이 한참 웃었어요.', {
    happiness: 8,
    cleanliness: -3
  }),
  randomEvent('sparkle_room', '반짝이는 방', '✨ 방 안에 반짝이는 기운이 돌아 청결과 애정이 올랐어요.', {
    cleanliness: 5,
    affection: 3
  }),
  randomEvent('sleepy_yawn', '꾸벅꾸벅', '💤 희진이 꾸벅꾸벅 졸다가 잠깐 기운을 회복했어요.', {
    energy: 6,
    fullness: -2
  }),
  randomEvent('tiny_melody', '작은 멜로디', '🎧 어디선가 들린 멜로디에 희진이 기분 좋아졌어요.', {
    happiness: 5,
    affection: 2
  })
]);

export class TamagotchiService {
  constructor(store, options = {}) {
    this.store = store;
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options
    };
  }

  async getStatus({ guildId, userId, username, now = Date.now() }) {
    return this.store.update((data) => {
      const pet = getOrCreatePet(data, { guildId, userId, username, now });
      applyDecay(pet, now, this.options);
      return createStatusResult(pet, now, {}, this.options);
    });
  }

  async care({ guildId, userId, username, action, now = Date.now() }) {
    return this.store.update((data) => {
      const pet = getOrCreatePet(data, { guildId, userId, username, now });
      applyDecay(pet, now, this.options);
      const normalizedAction = normalizeAction(action);

      if (!normalizedAction) {
        throw new Error('알 수 없는 희진 케어 행동입니다.');
      }

      if (pet.status === 'dead' && normalizedAction !== 'revive') {
        return createStatusResult(pet, now, {
          action: normalizedAction,
          performed: false,
          eventMessage: '💀 희진이 쓰러져 있어요. 먼저 **부활**을 눌러 주세요.'
        }, this.options);
      }

      if (pet.status !== 'dead' && normalizedAction === 'revive') {
        return createStatusResult(pet, now, {
          action: normalizedAction,
          performed: false,
          eventMessage: '✨ 희진은 아직 살아있어요. 아프다면 **약주기**로 치료해 주세요.'
        }, this.options);
      }

      const cooldown = getActionCooldown(pet, normalizedAction, now, this.options);
      if (cooldown.remainingMs > 0) {
        return createStatusResult(pet, now, {
          action: normalizedAction,
          performed: false,
          cooldown,
          eventMessage: `⏳ **${TAMAGOTCHI_ACTIONS[normalizedAction]}**은(는) ${formatDuration(cooldown.remainingMs)} 뒤에 다시 할 수 있어요.`
        }, this.options);
      }

      performCareAction(pet, normalizedAction, now);
      recordActionCooldown(pet, normalizedAction, now);
      const dailyReward = normalizedAction === 'revive'
        ? null
        : recordDailyProgress(pet, { action: normalizedAction }, now, this.options);
      const randomEvent = normalizedAction === 'revive'
        ? null
        : maybeTriggerRandomEvent(pet, {
          guildId,
          userId,
          now,
          action: normalizedAction,
          options: this.options
        });
      return createStatusResult(pet, now, {
        action: normalizedAction,
        performed: true,
        dailyReward,
        randomEvent,
        eventMessage: combineEventMessages(
          getActionMessage(normalizedAction, pet),
          randomEvent?.message,
          dailyReward?.message
        )
      }, this.options);
    });
  }

  async leisure({ guildId, userId, username, leisureId, now = Date.now() }) {
    return this.store.update((data) => {
      const pet = getOrCreatePet(data, { guildId, userId, username, now });
      applyDecay(pet, now, this.options);
      const normalizedLeisureId = normalizeLeisureId(leisureId);

      if (!normalizedLeisureId) {
        throw new Error('알 수 없는 희진 여가입니다.');
      }

      if (pet.status === 'dead') {
        return createStatusResult(pet, now, {
          action: `leisure_${normalizedLeisureId}`,
          leisure: TAMAGOTCHI_LEISURES[normalizedLeisureId],
          performed: false,
          eventMessage: '💀 희진이 쓰러져 있어요. 먼저 **부활**을 눌러 주세요.'
        }, this.options);
      }

      const cooldown = getLeisureCooldown(pet, normalizedLeisureId, now, this.options);
      if (cooldown.remainingMs > 0) {
        return createStatusResult(pet, now, {
          action: `leisure_${normalizedLeisureId}`,
          leisure: TAMAGOTCHI_LEISURES[normalizedLeisureId],
          performed: false,
          cooldown,
          eventMessage: `⏳ **${TAMAGOTCHI_LEISURES[normalizedLeisureId].label}**은(는) ${formatDuration(cooldown.remainingMs)} 뒤에 다시 할 수 있어요.`
        }, this.options);
      }

      performLeisureAction(pet, normalizedLeisureId, now);
      recordLeisureCooldown(pet, normalizedLeisureId, now);
      const dailyReward = recordDailyProgress(pet, {
        action: 'leisure',
        leisureId: normalizedLeisureId
      }, now, this.options);
      const randomEvent = maybeTriggerRandomEvent(pet, {
        guildId,
        userId,
        now,
        action: `leisure_${normalizedLeisureId}`,
        options: this.options
      });
      return createStatusResult(pet, now, {
        action: `leisure_${normalizedLeisureId}`,
        leisure: TAMAGOTCHI_LEISURES[normalizedLeisureId],
        performed: true,
        dailyReward,
        randomEvent,
        eventMessage: combineEventMessages(
          getLeisureMessage(normalizedLeisureId),
          randomEvent?.message,
          dailyReward?.message
        )
      }, this.options);
    });
  }

  async equipSkin({ guildId, userId, username, skinId, now = Date.now() }) {
    return this.store.update((data) => {
      const pet = getOrCreatePet(data, { guildId, userId, username, now });
      applyDecay(pet, now, this.options);
      const normalizedSkinId = normalizeTamagotchiSkinId(skinId);
      pet.cosmetic.skinId = normalizedSkinId;
      pet.lastUpdatedAt = now;
      return createStatusResult(pet, now, {
        action: 'skin',
        performed: true,
        eventMessage: `🎨 희진 스킨을 **${getTamagotchiSkinById(normalizedSkinId)?.label ?? normalizedSkinId}**(으)로 바꿨어요.`
      }, this.options);
    });
  }

  async equipDecoration({ guildId, userId, username, decorationId, now = Date.now() }) {
    return this.store.update((data) => {
      const pet = getOrCreatePet(data, { guildId, userId, username, now });
      applyDecay(pet, now, this.options);
      const normalizedDecorationId = normalizeTamagotchiDecorationId(decorationId);
      pet.cosmetic.decorationId = normalizedDecorationId;
      pet.lastUpdatedAt = now;
      return createStatusResult(pet, now, {
        action: 'decoration',
        performed: true,
        eventMessage: `🧸 주변 꾸미기를 **${getTamagotchiDecorationById(normalizedDecorationId)?.label ?? normalizedDecorationId}**(으)로 바꿨어요.`
      }, this.options);
    });
  }

  async cycleSkin({ guildId, userId, username, now = Date.now() }) {
    return this.store.update((data) => {
      const pet = getOrCreatePet(data, { guildId, userId, username, now });
      applyDecay(pet, now, this.options);
      pet.cosmetic.skinId = getNextTamagotchiSkinId(pet.cosmetic.skinId);
      pet.lastUpdatedAt = now;
      return createStatusResult(pet, now, {
        action: 'skin',
        performed: true,
        eventMessage: `🎨 다음 스킨: **${getTamagotchiSkinById(pet.cosmetic.skinId)?.label ?? pet.cosmetic.skinId}**`
      }, this.options);
    });
  }

  async cycleDecoration({ guildId, userId, username, now = Date.now() }) {
    return this.store.update((data) => {
      const pet = getOrCreatePet(data, { guildId, userId, username, now });
      applyDecay(pet, now, this.options);
      pet.cosmetic.decorationId = getNextTamagotchiDecorationId(pet.cosmetic.decorationId);
      pet.lastUpdatedAt = now;
      return createStatusResult(pet, now, {
        action: 'decoration',
        performed: true,
        eventMessage: `🧸 다음 꾸미기: **${getTamagotchiDecorationById(pet.cosmetic.decorationId)?.label ?? pet.cosmetic.decorationId}**`
      }, this.options);
    });
  }
}

export function getTamagotchiMood(pet) {
  if (pet.status === 'dead') return { id: 'dead', label: '사망', emoji: '💀' };
  if (pet.conditions?.sick || pet.stats.health <= 25) return { id: 'sick', label: '아픔', emoji: '🤒' };
  if (pet.stats.fullness <= 25) return { id: 'hungry', label: '배고픔', emoji: '🍚' };
  if (pet.stats.happiness <= 25) return { id: 'sad', label: '심심함', emoji: '🧸' };
  if (pet.stats.cleanliness <= 25) return { id: 'dirty', label: '씻고 싶음', emoji: '🫧' };
  if (pet.stats.energy <= 25) return { id: 'sleepy', label: '졸림', emoji: '💤' };
  if (pet.stats.affection >= 80) return { id: 'loved', label: '애정 만땅', emoji: '💖' };
  return { id: 'happy', label: '기분 좋음', emoji: '😊' };
}

export function formatStatBar(value, size = 10) {
  const filled = Math.round(clamp(value, MIN_STAT, MAX_STAT) / MAX_STAT * size);
  return '▰'.repeat(filled) + '▱'.repeat(size - filled);
}

export function formatRemainingNeglectTime(pet, now = Date.now(), neglectDeathMs = DEFAULT_OPTIONS.neglectDeathMs) {
  if (pet.status === 'dead') return '이미 사망';
  const remainingMs = Math.max(0, neglectDeathMs - (now - pet.lastCareAt));
  const hours = Math.floor(remainingMs / HOUR_MS);
  const minutes = Math.floor((remainingMs % HOUR_MS) / 60000);
  return hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`;
}

export function getTamagotchiGrowthStage(pet, now = Date.now()) {
  const catalog = getTamagotchiGrowthStages();
  const ageDays = Math.max(0, Math.floor((now - pet.createdAt) / DAY_MS));

  return [...catalog]
    .sort((a, b) => Number(a.minAgeDays ?? 0) - Number(b.minAgeDays ?? 0))
    .reduce((selected, stage) =>
      ageDays >= Number(stage.minAgeDays ?? 0) ? stage : selected,
    catalog[0]);
}

function getOrCreatePet(data, { guildId, userId, username, now }) {
  data.guilds ??= {};
  data.guilds[guildId] ??= {};
  const guild = data.guilds[guildId];
  guild.tamagotchi ??= { users: {} };
  guild.tamagotchi.users ??= {};

  if (!guild.tamagotchi.users[userId]) {
    guild.tamagotchi.users[userId] = createDefaultPet({ userId, username, now });
  }

  const pet = guild.tamagotchi.users[userId];
  normalizePet(pet, { userId, username, now });
  return pet;
}

function createDefaultPet({ userId, username, now }) {
  return {
    userId,
    schemaVersion: TAMAGOTCHI_SCHEMA_VERSION,
    username,
    name: '희진',
    status: 'alive',
    deathReason: null,
    createdAt: now,
    lastUpdatedAt: now,
    lastCareAt: now,
    stats: { ...DEFAULT_STATS },
    cosmetic: {
      skinId: getDefaultTamagotchiSkinId(),
      decorationId: getDefaultTamagotchiDecorationId()
    },
    conditions: {
      sick: false,
      illnessStartedAt: null,
      illnessReason: null
    },
    growth: {
      teenBranchId: null,
      adultBranchId: null,
      satisfactionScore: 0,
      dominantTrait: null,
      branchHistory: []
    },
    daily: createDailyState(now),
    cooldowns: {
      actions: {},
      leisure: {}
    },
    codex: {
      memoryShards: 0,
      dailyCompletions: 0,
      discoveredBranches: [],
      discoveredEvents: []
    },
    memories: {
      eventLog: []
    },
    counters: {
      feeds: 0,
      plays: 0,
      cleans: 0,
      naps: 0,
      medicines: 0,
      revivals: 0,
      leisure: {},
      totalCareActions: 0
    }
  };
}

function normalizePet(pet, { userId, username, now }) {
  pet.schemaVersion = Math.max(1, Math.floor(numberOrDefault(pet.schemaVersion, 1)));
  pet.userId = pet.userId ?? userId;
  pet.username = username ?? pet.username ?? 'Unknown';
  pet.name = pet.name ?? '희진';
  pet.status = ['alive', 'dead'].includes(pet.status) ? pet.status : 'alive';
  pet.deathReason ??= null;
  pet.createdAt = numberOrDefault(pet.createdAt, now);
  pet.lastUpdatedAt = numberOrDefault(pet.lastUpdatedAt, now);
  pet.lastCareAt = numberOrDefault(pet.lastCareAt, pet.lastUpdatedAt);
  pet.stats ??= {};
  for (const [key, value] of Object.entries(DEFAULT_STATS)) {
    pet.stats[key] = clamp(numberOrDefault(pet.stats[key], value), MIN_STAT, MAX_STAT);
  }
  pet.cosmetic ??= {};
  pet.cosmetic.skinId = normalizeTamagotchiSkinId(pet.cosmetic.skinId);
  pet.cosmetic.decorationId = normalizeTamagotchiDecorationId(pet.cosmetic.decorationId);
  pet.conditions ??= {};
  pet.conditions.sick = Boolean(pet.conditions.sick);
  pet.conditions.illnessStartedAt = pet.conditions.illnessStartedAt == null
    ? null
    : numberOrDefault(pet.conditions.illnessStartedAt, now);
  pet.conditions.illnessReason = pet.conditions.illnessReason ?? null;
  migratePet(pet, now);
  pet.growth ??= {};
  pet.growth.teenBranchId = normalizeGrowthBranchId(pet.growth.teenBranchId);
  pet.growth.adultBranchId = normalizeGrowthBranchId(pet.growth.adultBranchId);
  pet.growth.satisfactionScore = clamp(numberOrDefault(pet.growth.satisfactionScore, 0), MIN_STAT, MAX_STAT);
  pet.growth.dominantTrait = typeof pet.growth.dominantTrait === 'string' ? pet.growth.dominantTrait : null;
  pet.growth.branchHistory = Array.isArray(pet.growth.branchHistory) ? pet.growth.branchHistory : [];
  pet.daily = normalizeDailyState(pet.daily, now);
  pet.cooldowns ??= {};
  pet.cooldowns.actions = normalizeTimestampMap(pet.cooldowns.actions, Object.keys(TAMAGOTCHI_ACTIONS));
  pet.cooldowns.leisure = normalizeTimestampMap(pet.cooldowns.leisure, Object.keys(TAMAGOTCHI_LEISURES));
  pet.codex ??= {};
  pet.codex.memoryShards = Math.max(0, Math.floor(numberOrDefault(pet.codex.memoryShards, 0)));
  pet.codex.dailyCompletions = Math.max(0, Math.floor(numberOrDefault(pet.codex.dailyCompletions, 0)));
  pet.codex.discoveredBranches = normalizeIdList(pet.codex.discoveredBranches, Object.keys(TAMAGOTCHI_GROWTH_BRANCHES));
  pet.codex.discoveredEvents = normalizeIdList(pet.codex.discoveredEvents, TAMAGOTCHI_RANDOM_EVENTS.map((event) => event.id));
  pet.memories ??= {};
  pet.memories.eventLog = Array.isArray(pet.memories.eventLog)
    ? pet.memories.eventLog.slice(-EVENT_LOG_LIMIT)
    : [];
  pet.counters ??= {};
  for (const key of ['feeds', 'plays', 'cleans', 'naps', 'medicines', 'revivals', 'totalCareActions']) {
    pet.counters[key] = Math.max(0, Math.floor(numberOrDefault(pet.counters[key], 0)));
  }
  pet.counters.leisure ??= {};
  for (const leisureId of Object.keys(TAMAGOTCHI_LEISURES)) {
    pet.counters.leisure[leisureId] = Math.max(0, Math.floor(numberOrDefault(pet.counters.leisure[leisureId], 0)));
  }
}

function migratePet(pet, now) {
  if (!pet.conditions.sick) {
    pet.conditions.illnessStartedAt = null;
    pet.conditions.illnessReason = null;
  } else if (pet.conditions.illnessStartedAt === null) {
    pet.conditions.illnessStartedAt = now;
    pet.conditions.illnessReason ??= '이전 상태에서 병 정보가 복구되었어요.';
  }

  pet.schemaVersion = TAMAGOTCHI_SCHEMA_VERSION;
}

function applyDecay(pet, now, options) {
  const elapsedMs = Math.max(0, now - pet.lastUpdatedAt);
  if (elapsedMs <= 0) return;

  if (pet.status === 'dead') {
    pet.lastUpdatedAt = now;
    return;
  }

  const elapsedHours = elapsedMs / HOUR_MS;
  pet.stats.fullness = clamp(pet.stats.fullness - options.fullnessDecayPerHour * elapsedHours, MIN_STAT, MAX_STAT);
  pet.stats.happiness = clamp(pet.stats.happiness - options.happinessDecayPerHour * elapsedHours, MIN_STAT, MAX_STAT);
  pet.stats.cleanliness = clamp(pet.stats.cleanliness - options.cleanlinessDecayPerHour * elapsedHours, MIN_STAT, MAX_STAT);
  pet.stats.energy = clamp(pet.stats.energy - options.energyDecayPerHour * elapsedHours, MIN_STAT, MAX_STAT);

  const lowNeedCount = ['fullness', 'happiness', 'cleanliness', 'energy']
    .filter((stat) => pet.stats[stat] <= 20)
    .length;
  if (lowNeedCount > 0) {
    pet.stats.health = clamp(
      pet.stats.health - lowNeedCount * options.healthDecayPerLowNeedPerHour * elapsedHours,
      MIN_STAT,
      MAX_STAT
    );
  }

  updateIllness(pet, lowNeedCount, now, elapsedHours, options);

  const neglectedTooLong = now - pet.lastCareAt >= options.neglectDeathMs;
  if (neglectedTooLong || pet.stats.health <= 0) {
    pet.status = 'dead';
    pet.deathReason = getDeathReason(pet, neglectedTooLong);
    pet.diedAt = now;
  }

  pet.lastUpdatedAt = now;
}

function updateIllness(pet, lowNeedCount, now, elapsedHours, options) {
  if (!pet.conditions.sick) {
    const illnessReason = getIllnessReason(pet, lowNeedCount);
    if (illnessReason) {
      pet.conditions.sick = true;
      pet.conditions.illnessStartedAt = now;
      pet.conditions.illnessReason = illnessReason;
    }
    return;
  }

  pet.stats.health = clamp(
    pet.stats.health - options.sicknessHealthDecayPerHour * elapsedHours,
    MIN_STAT,
    MAX_STAT
  );

  if (now - pet.conditions.illnessStartedAt >= options.illnessDeathMs) {
    pet.stats.health = 0;
  }
}

function getIllnessReason(pet, lowNeedCount) {
  if (lowNeedCount >= 2) return '여러 욕구가 너무 낮아 병이 들었어요.';
  if (pet.stats.cleanliness <= 10) return '너무 오래 씻지 못해서 병이 들었어요.';
  if (pet.stats.fullness <= 10) return '너무 오래 굶어서 병이 들었어요.';
  if (pet.stats.energy <= 10) return '너무 지쳐서 병이 들었어요.';
  if (pet.stats.health <= 45) return '건강이 낮아져 병이 들었어요.';
  return null;
}

function getDeathReason(pet, neglectedTooLong) {
  if (neglectedTooLong) return '관심을 너무 오래 받지 못했어요.';
  if (pet.conditions?.sick) {
    return pet.conditions.illnessReason
      ? `병을 치료하지 못했어요: ${pet.conditions.illnessReason}`
      : '병을 치료하지 못했어요.';
  }
  return '건강이 0이 되었어요.';
}

function performCareAction(pet, action, now) {
  if (action === 'revive') {
    if (pet.status === 'dead') {
      pet.status = 'alive';
      pet.deathReason = null;
      pet.diedAt = null;
      pet.conditions.sick = false;
      pet.conditions.illnessStartedAt = null;
      pet.conditions.illnessReason = null;
      pet.stats = {
        fullness: 65,
        happiness: 68,
        cleanliness: 72,
        energy: 70,
        health: 80,
        affection: clamp(pet.stats.affection + 8, MIN_STAT, MAX_STAT)
      };
      pet.counters.revivals += 1;
    } else {
      pet.stats.health = clamp(pet.stats.health + 8, MIN_STAT, MAX_STAT);
      if (pet.stats.health >= 55) {
        cureIllness(pet);
      }
    }
  } else if (action === 'feed') {
    if (pet.stats.fullness >= 95) {
      pet.stats.health = clamp(pet.stats.health - 8, MIN_STAT, MAX_STAT);
      pet.stats.happiness = clamp(pet.stats.happiness - 4, MIN_STAT, MAX_STAT);
    }
    pet.stats.fullness = clamp(pet.stats.fullness + 34, MIN_STAT, MAX_STAT);
    pet.stats.health = clamp(pet.stats.health + 5, MIN_STAT, MAX_STAT);
    pet.stats.affection = clamp(pet.stats.affection + 5, MIN_STAT, MAX_STAT);
    pet.counters.feeds += 1;
  } else if (action === 'play') {
    pet.stats.happiness = clamp(pet.stats.happiness + 34, MIN_STAT, MAX_STAT);
    pet.stats.fullness = clamp(pet.stats.fullness - 8, MIN_STAT, MAX_STAT);
    pet.stats.cleanliness = clamp(pet.stats.cleanliness - 6, MIN_STAT, MAX_STAT);
    pet.stats.affection = clamp(pet.stats.affection + 9, MIN_STAT, MAX_STAT);
    pet.counters.plays += 1;
  } else if (action === 'clean') {
    pet.stats.cleanliness = clamp(pet.stats.cleanliness + 40, MIN_STAT, MAX_STAT);
    pet.stats.health = clamp(pet.stats.health + 4, MIN_STAT, MAX_STAT);
    pet.stats.affection = clamp(pet.stats.affection + 4, MIN_STAT, MAX_STAT);
    pet.counters.cleans += 1;
  } else if (action === 'nap') {
    pet.stats.energy = clamp(pet.stats.energy + 38, MIN_STAT, MAX_STAT);
    pet.stats.fullness = clamp(pet.stats.fullness - 5, MIN_STAT, MAX_STAT);
    pet.stats.health = clamp(pet.stats.health + 3, MIN_STAT, MAX_STAT);
    pet.counters.naps += 1;
  } else if (action === 'medicine') {
    pet.stats.health = clamp(pet.stats.health + 30, MIN_STAT, MAX_STAT);
    pet.stats.happiness = clamp(pet.stats.happiness - 4, MIN_STAT, MAX_STAT);
    cureIllness(pet);
    pet.counters.medicines += 1;
  }

  pet.lastCareAt = now;
  pet.lastUpdatedAt = now;
  pet.counters.totalCareActions += 1;
}

function performLeisureAction(pet, leisureId, now) {
  const leisureConfig = TAMAGOTCHI_LEISURES[leisureId];
  for (const [stat, delta] of Object.entries(leisureConfig.effects)) {
    pet.stats[stat] = clamp(pet.stats[stat] + delta, MIN_STAT, MAX_STAT);
  }
  pet.counters.leisure[leisureId] = (pet.counters.leisure[leisureId] ?? 0) + 1;
  pet.counters.plays += 1;
  pet.counters.totalCareActions += 1;
  pet.lastCareAt = now;
  pet.lastUpdatedAt = now;
}

function cureIllness(pet) {
  pet.conditions.sick = false;
  pet.conditions.illnessStartedAt = null;
  pet.conditions.illnessReason = null;
}

function createStatusResult(pet, now, event = {}, options = DEFAULT_OPTIONS) {
  updateGrowthBranch(pet, now);
  const skin = getTamagotchiSkinById(pet.cosmetic.skinId);
  const decoration = getTamagotchiDecorationById(pet.cosmetic.decorationId);
  const growthStage = getTamagotchiGrowthStage(pet, now);
  const activeBranchId = getActiveGrowthBranchId(pet, growthStage.id);
  return {
    pet: clonePet(pet),
    mood: getTamagotchiMood(pet),
    skin,
    decoration,
    growthStage: getTamagotchiGrowthStageById(growthStage.id) ?? growthStage,
    growthBranch: activeBranchId ? TAMAGOTCHI_GROWTH_BRANCHES[activeBranchId] : null,
    growthProfile: calculateGrowthProfile(pet),
    ageDays: Math.max(0, Math.floor((now - pet.createdAt) / DAY_MS)),
    neglectRemaining: formatRemainingNeglectTime(pet, now),
    nextGrowth: getNextGrowthInfo(pet, now),
    recommendations: getTamagotchiRecommendations(pet, now, options),
    daily: getDailyMissionSummary(pet.daily),
    codex: getCodexSummary(pet),
    cooldowns: getCooldownSummary(pet, now, options),
    recentEvents: pet.memories.eventLog.slice(-3).reverse(),
    ...event
  };
}

function clonePet(pet) {
  return {
    ...pet,
    stats: { ...pet.stats },
    cosmetic: { ...pet.cosmetic },
    conditions: { ...pet.conditions },
    growth: {
      ...pet.growth,
      branchHistory: [...pet.growth.branchHistory]
    },
    daily: {
      ...pet.daily,
      completedMissionIds: [...pet.daily.completedMissionIds],
      progress: { ...pet.daily.progress }
    },
    cooldowns: {
      actions: { ...pet.cooldowns.actions },
      leisure: { ...pet.cooldowns.leisure }
    },
    codex: {
      ...pet.codex,
      discoveredBranches: [...pet.codex.discoveredBranches],
      discoveredEvents: [...pet.codex.discoveredEvents]
    },
    memories: {
      eventLog: pet.memories.eventLog.map((entry) => ({ ...entry }))
    },
    counters: {
      ...pet.counters,
      leisure: { ...pet.counters.leisure }
    }
  };
}

function getActionCooldown(pet, action, now, options) {
  const cooldownMs = action === 'revive' ? 0 : Math.max(0, numberOrDefault(options.actionCooldownMs, DEFAULT_OPTIONS.actionCooldownMs));
  const lastAt = numberOrDefault(pet.cooldowns?.actions?.[action], null);
  const remainingMs = cooldownMs > 0 && lastAt !== null
    ? Math.max(0, cooldownMs - (now - lastAt))
    : 0;
  return {
    kind: 'action',
    id: action,
    label: TAMAGOTCHI_ACTIONS[action] ?? action,
    lastAt,
    cooldownMs,
    remainingMs,
    ready: remainingMs <= 0
  };
}

function getLeisureCooldown(pet, leisureId, now, options) {
  const cooldownMs = Math.max(0, numberOrDefault(options.leisureCooldownMs, DEFAULT_OPTIONS.leisureCooldownMs));
  const lastAt = numberOrDefault(pet.cooldowns?.leisure?.[leisureId], null);
  const remainingMs = cooldownMs > 0 && lastAt !== null
    ? Math.max(0, cooldownMs - (now - lastAt))
    : 0;
  return {
    kind: 'leisure',
    id: leisureId,
    label: TAMAGOTCHI_LEISURES[leisureId]?.label ?? leisureId,
    lastAt,
    cooldownMs,
    remainingMs,
    ready: remainingMs <= 0
  };
}

function recordActionCooldown(pet, action, now) {
  pet.cooldowns.actions[action] = now;
}

function recordLeisureCooldown(pet, leisureId, now) {
  pet.cooldowns.leisure[leisureId] = now;
}

function getCooldownSummary(pet, now, options) {
  return {
    actions: Object.fromEntries(
      Object.keys(TAMAGOTCHI_ACTIONS).map((action) => [action, getActionCooldown(pet, action, now, options)])
    ),
    leisure: Object.fromEntries(
      Object.keys(TAMAGOTCHI_LEISURES).map((leisureId) => [leisureId, getLeisureCooldown(pet, leisureId, now, options)])
    )
  };
}

function createDailyState(now) {
  const dayIndex = getDayIndex(now);
  return {
    dayIndex,
    dateKey: formatDateKey(dayIndex),
    progress: Object.fromEntries(TAMAGOTCHI_DAILY_MISSIONS.map((mission) => [mission.id, 0])),
    completedMissionIds: [],
    rewardClaimed: false
  };
}

function normalizeDailyState(daily, now) {
  const currentDayIndex = getDayIndex(now);
  if (!daily || Math.floor(numberOrDefault(daily.dayIndex, -1)) !== currentDayIndex) {
    return createDailyState(now);
  }

  const normalized = {
    dayIndex: currentDayIndex,
    dateKey: formatDateKey(currentDayIndex),
    progress: {},
    completedMissionIds: Array.isArray(daily.completedMissionIds) ? daily.completedMissionIds : [],
    rewardClaimed: Boolean(daily.rewardClaimed)
  };
  const completed = new Set();
  for (const mission of TAMAGOTCHI_DAILY_MISSIONS) {
    const progress = Math.max(0, Math.floor(numberOrDefault(daily.progress?.[mission.id], 0)));
    normalized.progress[mission.id] = Math.min(progress, mission.count);
    if (
      normalized.completedMissionIds.includes(mission.id)
      || normalized.progress[mission.id] >= mission.count
    ) {
      completed.add(mission.id);
    }
  }
  normalized.completedMissionIds = [...completed];
  return normalized;
}

function recordDailyProgress(pet, event, now, options) {
  pet.daily = normalizeDailyState(pet.daily, now);
  const newlyCompleted = [];

  for (const mission of TAMAGOTCHI_DAILY_MISSIONS) {
    if (!matchesDailyMission(mission, event)) continue;
    const before = pet.daily.progress[mission.id] ?? 0;
    pet.daily.progress[mission.id] = Math.min(mission.count, before + 1);
    if (before < mission.count && pet.daily.progress[mission.id] >= mission.count) {
      pet.daily.completedMissionIds.push(mission.id);
      newlyCompleted.push(mission);
    }
  }

  pet.daily.completedMissionIds = [...new Set(pet.daily.completedMissionIds)];
  const allComplete = TAMAGOTCHI_DAILY_MISSIONS.every((mission) =>
    pet.daily.completedMissionIds.includes(mission.id)
  );

  if (!allComplete || pet.daily.rewardClaimed) {
    return newlyCompleted.length > 0
      ? {
        missions: newlyCompleted,
        rewarded: false,
        message: `📋 오늘의 돌봄 완료: ${newlyCompleted.map((mission) => `**${mission.label}**`).join(', ')}`
      }
      : null;
  }

  const memoryShards = Math.max(0, Math.floor(numberOrDefault(
    options.dailyRewardMemoryShards,
    DEFAULT_OPTIONS.dailyRewardMemoryShards
  )));
  pet.daily.rewardClaimed = true;
  pet.codex.memoryShards += memoryShards;
  pet.codex.dailyCompletions += 1;
  pet.stats.affection = clamp(pet.stats.affection + 6, MIN_STAT, MAX_STAT);
  pet.stats.health = clamp(pet.stats.health + 4, MIN_STAT, MAX_STAT);
  addEventLog(pet, {
    type: 'daily',
    id: `daily_${pet.daily.dateKey}`,
    title: '오늘의 돌봄 완료',
    message: `오늘의 돌봄을 전부 끝내 추억 조각 ${memoryShards}개를 얻었어요.`,
    at: now
  });

  return {
    missions: newlyCompleted,
    rewarded: true,
    memoryShards,
    message: `🎁 오늘의 돌봄 완료! 추억 조각 **${memoryShards}개**와 애정/건강 보너스를 받았어요.`
  };
}

function matchesDailyMission(mission, event) {
  if (mission.type === 'leisure') return event.action === 'leisure';
  return mission.action === event.action;
}

function getDailyMissionSummary(daily) {
  const completed = new Set(daily.completedMissionIds);
  const missions = TAMAGOTCHI_DAILY_MISSIONS.map((mission) => {
    const progress = Math.min(mission.count, Math.max(0, daily.progress[mission.id] ?? 0));
    return {
      ...mission,
      progress,
      completed: completed.has(mission.id) || progress >= mission.count
    };
  });
  return {
    dayIndex: daily.dayIndex,
    dateKey: daily.dateKey,
    rewardClaimed: daily.rewardClaimed,
    complete: missions.every((mission) => mission.completed),
    completedCount: missions.filter((mission) => mission.completed).length,
    totalCount: missions.length,
    missions
  };
}

function maybeTriggerRandomEvent(pet, { guildId, userId, now, action, options }) {
  const everyActions = Math.max(0, Math.floor(numberOrDefault(
    options.randomEventEveryActions,
    DEFAULT_OPTIONS.randomEventEveryActions
  )));
  if (everyActions <= 0 || pet.counters.totalCareActions <= 0) return null;
  if (pet.counters.totalCareActions % everyActions !== 0) return null;

  const eventIndex = stableIndex(`${guildId}:${userId}:${now}:${action}:${pet.counters.totalCareActions}`, TAMAGOTCHI_RANDOM_EVENTS.length);
  const event = TAMAGOTCHI_RANDOM_EVENTS[eventIndex];
  for (const [stat, delta] of Object.entries(event.effects)) {
    pet.stats[stat] = clamp(pet.stats[stat] + delta, MIN_STAT, MAX_STAT);
  }
  if (!pet.codex.discoveredEvents.includes(event.id)) {
    pet.codex.discoveredEvents.push(event.id);
  }
  pet.codex.memoryShards += 1;
  addEventLog(pet, {
    type: 'random',
    id: event.id,
    title: event.title,
    message: event.message,
    at: now
  });

  return {
    id: event.id,
    title: event.title,
    message: `🎲 랜덤 사건: **${event.title}** — ${event.message} 추억 조각 **1개**를 얻었어요.`,
    effects: { ...event.effects },
    memoryShards: 1
  };
}

function addEventLog(pet, entry) {
  pet.memories.eventLog.push({
    type: entry.type,
    id: entry.id,
    title: entry.title,
    message: entry.message,
    at: entry.at
  });
  pet.memories.eventLog = pet.memories.eventLog.slice(-EVENT_LOG_LIMIT);
}

function getCodexSummary(pet) {
  return {
    memoryShards: pet.codex.memoryShards,
    dailyCompletions: pet.codex.dailyCompletions,
    discoveredBranches: [...pet.codex.discoveredBranches],
    discoveredEvents: [...pet.codex.discoveredEvents],
    branchCount: pet.codex.discoveredBranches.length,
    totalBranches: Object.keys(TAMAGOTCHI_GROWTH_BRANCHES).length,
    eventCount: pet.codex.discoveredEvents.length,
    totalEvents: TAMAGOTCHI_RANDOM_EVENTS.length
  };
}

function getNextGrowthInfo(pet, now) {
  const ageDays = Math.max(0, Math.floor((now - pet.createdAt) / DAY_MS));
  const stages = [...getTamagotchiGrowthStages()]
    .sort((a, b) => Number(a.minAgeDays ?? 0) - Number(b.minAgeDays ?? 0));
  const nextStage = stages.find((stage) => Number(stage.minAgeDays ?? 0) > ageDays);
  if (!nextStage) {
    return {
      complete: true,
      label: '성년기 도달',
      remainingDays: 0
    };
  }
  return {
    complete: false,
    stageId: nextStage.id,
    label: nextStage.label,
    remainingDays: Math.max(0, Number(nextStage.minAgeDays ?? 0) - ageDays)
  };
}

function getTamagotchiRecommendations(pet, now, options) {
  if (pet.status === 'dead') {
    return [recommendation('revive', '부활', '희진이 쓰러져 있어 먼저 깨워야 합니다.', '✨', 0)];
  }

  const candidates = [];
  if (pet.conditions.sick || pet.stats.health <= 35) {
    candidates.push(recommendation('medicine', '약주기', '건강이 낮거나 병이 있어 치료가 우선입니다.', '💊', getActionCooldown(pet, 'medicine', now, options).remainingMs));
  }
  if (pet.stats.fullness <= 45) {
    candidates.push(recommendation('feed', '밥주기', '배부름이 낮아 방치하면 건강이 떨어집니다.', '🍚', getActionCooldown(pet, 'feed', now, options).remainingMs));
  }
  if (pet.stats.cleanliness <= 45) {
    candidates.push(recommendation('clean', '씻기기', '청결이 낮으면 병 위험이 커집니다.', '🫧', getActionCooldown(pet, 'clean', now, options).remainingMs));
  }
  if (pet.stats.energy <= 45) {
    candidates.push(recommendation('nap', '재우기', '에너지가 낮아 휴식이 필요합니다.', '💤', getActionCooldown(pet, 'nap', now, options).remainingMs));
  }
  if (pet.stats.happiness <= 45) {
    candidates.push(recommendation('play', '놀아주기', '행복이 낮아 심심해하고 있어요.', '🧸', getActionCooldown(pet, 'play', now, options).remainingMs));
  }

  const nextDailyMission = getDailyMissionSummary(pet.daily).missions.find((mission) => !mission.completed);
  if (nextDailyMission) {
    candidates.push(recommendation(
      nextDailyMission.type === 'leisure' ? 'leisure' : nextDailyMission.action,
      nextDailyMission.label,
      '오늘의 돌봄 미션을 채우면 추억 조각을 얻습니다.',
      nextDailyMission.emoji,
      0
    ));
  }

  if (candidates.length === 0) {
    candidates.push(recommendation('leisure', '여가 보내기', '상태가 안정적이라 성장 분기용 특화 여가를 고르기 좋습니다.', '🎮', 0));
  }

  return dedupeRecommendations(candidates).slice(0, 3);
}

function recommendation(action, label, reason, emoji, cooldownRemainingMs = 0) {
  return {
    action,
    label,
    reason,
    emoji,
    cooldownRemainingMs,
    ready: cooldownRemainingMs <= 0
  };
}

function dedupeRecommendations(candidates) {
  const seen = new Set();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.action)) return false;
    seen.add(candidate.action);
    return true;
  });
}

function updateGrowthBranch(pet, now) {
  const growthStage = getTamagotchiGrowthStage(pet, now);
  const profile = calculateGrowthProfile(pet);
  pet.growth.satisfactionScore = profile.satisfactionScore;
  pet.growth.dominantTrait = profile.dominantTrait;

  if (growthStage.id === 'teen' || growthStage.id === 'adult') {
    assignGrowthBranch(pet, 'teenBranchId', 'teen', profile, now);
  }

  if (growthStage.id === 'adult') {
    assignGrowthBranch(pet, 'adultBranchId', 'adult', profile, now);
  }

  for (const branchId of [pet.growth.teenBranchId, pet.growth.adultBranchId]) {
    if (branchId) discoverGrowthBranch(pet, branchId);
  }
}

function assignGrowthBranch(pet, property, stageId, profile, now) {
  if (pet.growth[property]) return;
  const branchId = selectGrowthBranch(profile);
  pet.growth[property] = branchId;
  const newlyDiscovered = discoverGrowthBranch(pet, branchId);
  pet.growth.branchHistory.push({
    stageId,
    branchId,
    satisfactionScore: profile.satisfactionScore,
    dominantTrait: profile.dominantTrait,
    at: now
  });
  if (newlyDiscovered) {
    addEventLog(pet, {
      type: 'growth',
      id: branchId,
      title: TAMAGOTCHI_GROWTH_BRANCHES[branchId]?.label ?? branchId,
      message: `${stageId === 'adult' ? '성년기' : '청소년기'} 성장 분기 도감에 기록됐어요.`,
      at: now
    });
  }
}

function discoverGrowthBranch(pet, branchId) {
  const normalized = normalizeGrowthBranchId(branchId);
  if (!normalized || pet.codex.discoveredBranches.includes(normalized)) return false;
  pet.codex.discoveredBranches.push(normalized);
  return true;
}

function calculateGrowthProfile(pet) {
  const stats = pet.stats;
  const needAverage = average([
    stats.fullness,
    stats.happiness,
    stats.cleanliness,
    stats.energy,
    stats.health
  ]);
  const careQuality = clamp(
    45
      + pet.counters.totalCareActions * 3
      + stats.affection * 0.25
      - pet.counters.revivals * 10
      - (pet.conditions.sick ? 18 : 0),
    MIN_STAT,
    MAX_STAT
  );
  const satisfactionScore = Math.round(clamp(
    needAverage * 0.68 + stats.affection * 0.18 + careQuality * 0.14,
    MIN_STAT,
    MAX_STAT
  ));
  const leisureCounts = pet.counters.leisure ?? {};
  const traitScores = {
    beloved: stats.affection * 1.2 + pet.counters.totalCareActions * 2,
    gourmet: stats.fullness + pet.counters.feeds * 9,
    entertainer: stats.happiness + pet.counters.plays * 4 + (leisureCounts.reels ?? 0) * 10,
    heeheebotter: stats.happiness + (leisureCounts.heeheebot ?? 0) * 14,
    rhythm: stats.happiness + stats.energy * 0.35 + (leisureCounts.djmax ?? 0) * 15,
    tidy: stats.cleanliness + pet.counters.cleans * 10,
    dreamer: stats.energy + pet.counters.naps * 10 + (leisureCounts.music ?? 0) * 9,
    healthy: stats.health + pet.counters.medicines * 9 + (leisureCounts.walk ?? 0) * 12,
    monkey: stats.happiness + (leisureCounts.monkey ?? 0) * 16,
    mischievous: stats.happiness + (leisureCounts.tease_monkey ?? 0) * 18 - stats.affection * 0.15,
    fragile: (100 - stats.health) + (pet.conditions.sick ? 45 : 0) + pet.counters.revivals * 12,
    neglected: (100 - needAverage) + (pet.conditions.sick ? 25 : 0)
  };
  const [dominantTrait, dominantScore] = Object.entries(traitScores)
    .sort((a, b) => b[1] - a[1])[0];

  return {
    satisfactionScore,
    careQuality: Math.round(careQuality),
    needAverage: Math.round(needAverage),
    dominantTrait,
    dominantScore: Math.round(dominantScore),
    traitScores
  };
}

function selectGrowthBranch(profile) {
  if (profile.satisfactionScore < 30) return 'neglected';
  if (profile.satisfactionScore < 45) return 'fragile';
  if (profile.dominantScore < 95 && profile.satisfactionScore >= 70) return 'balanced';
  if (profile.dominantTrait === 'fragile' && profile.satisfactionScore >= 62) return 'healthy';
  if (profile.dominantTrait === 'neglected' && profile.satisfactionScore >= 62) return 'balanced';
  return normalizeGrowthBranchId(profile.dominantTrait) ?? 'balanced';
}

function getActiveGrowthBranchId(pet, stageId) {
  if (stageId === 'adult') return pet.growth.adultBranchId ?? pet.growth.teenBranchId;
  if (stageId === 'teen') return pet.growth.teenBranchId;
  return null;
}

function normalizeGrowthBranchId(branchId) {
  const normalized = String(branchId ?? '').trim();
  return Object.prototype.hasOwnProperty.call(TAMAGOTCHI_GROWTH_BRANCHES, normalized)
    ? normalized
    : null;
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizeAction(action) {
  const normalized = String(action ?? '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(TAMAGOTCHI_ACTIONS, normalized) ? normalized : null;
}

function normalizeLeisureId(leisureId) {
  const normalized = String(leisureId ?? '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(TAMAGOTCHI_LEISURES, normalized) ? normalized : null;
}

function normalizeTimestampMap(rawMap, allowedKeys) {
  const map = rawMap && typeof rawMap === 'object' ? rawMap : {};
  return Object.fromEntries(
    allowedKeys
      .map((key) => [key, numberOrDefault(map[key], null)])
      .filter(([, value]) => value !== null)
  );
}

function normalizeIdList(rawList, allowedIds) {
  const allowed = new Set(allowedIds);
  return [...new Set(Array.isArray(rawList) ? rawList : [])]
    .map((id) => String(id ?? '').trim())
    .filter((id) => allowed.has(id));
}

function leisure(id, label, emoji, effects) {
  return Object.freeze({
    id,
    label,
    emoji,
    effects: Object.freeze(effects)
  });
}

function branch(id, label, description) {
  return Object.freeze({ id, label, description });
}

function dailyMission(id, label, emoji, action) {
  return Object.freeze({
    id,
    label,
    emoji,
    action,
    type: action === 'leisure' ? 'leisure' : 'action',
    count: 1
  });
}

function randomEvent(id, title, message, effects) {
  return Object.freeze({
    id,
    title,
    message,
    effects: Object.freeze(effects)
  });
}

function getActionMessage(action, pet) {
  const messages = {
    feed: '🍚 희진이 맛있게 먹었어요. 볼이 더 동그래졌습니다!',
    play: '🧸 희진이 신나게 놀았어요. 애정도가 올랐습니다!',
    clean: '🫧 희진이 보송보송해졌어요. 반짝반짝!',
    nap: '💤 희진이 낮잠을 자고 기운을 회복했어요.',
    medicine: '💊 희진이 약을 먹었어요. 건강이 회복됐습니다.',
    revive: pet.counters.revivals > 0
      ? '✨ 희진이 다시 깨어났어요. 이번엔 자주 돌봐 주세요!'
      : '✨ 희진이 기운을 차렸어요.'
  };
  return messages[action] ?? '희진을 돌봤어요.';
}

function getLeisureMessage(leisureId) {
  const leisureConfig = TAMAGOTCHI_LEISURES[leisureId];
  const messages = {
    reels: '📱 희진이 릴스를 보며 깔깔 웃었어요. 너무 오래 보면 피곤해져요!',
    heeheebot: '🤖 희진이 희희봇을 하며 신나게 놀았어요. 희희!',
    djmax: '🎹 희진이 디맥을 하며 리듬감을 충전했어요. 손가락은 조금 피곤합니다!',
    walk: '🚶 희진이 산책을 다녀왔어요. 건강해졌지만 조금 더러워졌어요.',
    music: '🎧 희진이 음악을 들으며 편안해졌어요.',
    monkey: '🐒 희진이 원숭이를 보고 기분이 엄청 좋아졌어요. 희희!',
    tease_monkey: '🙈 희진이 원숭이 괴롭히기에 너무 몰입했어요. 행복은 올랐지만 양심과 컨디션이 조금 흔들립니다!'
  };
  return messages[leisureId] ?? `${leisureConfig?.emoji ?? '🎈'} 희진이 여가 시간을 보냈어요.`;
}

function combineEventMessages(...messages) {
  return messages.filter(Boolean).join('\n');
}

function getDayIndex(now, timezoneOffsetMs = KOREA_TIME_OFFSET_MS) {
  return Math.floor((now + timezoneOffsetMs) / DAY_MS);
}

function formatDateKey(dayIndex) {
  return new Date(dayIndex * DAY_MS).toISOString().slice(0, 10);
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}시간 ${remainingMinutes}분` : `${hours}시간`;
  }
  if (minutes > 0) return `${minutes}분 ${seconds}초`;
  return `${seconds}초`;
}

function stableIndex(seed, max) {
  if (max <= 0) return 0;
  let hash = 2166136261;
  for (const char of String(seed)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % max;
}

function numberOrDefault(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
