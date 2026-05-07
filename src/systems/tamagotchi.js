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
const JOURNAL_LIMIT = 30;

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

const ROOM_SLOT_LABELS = Object.freeze({
  basic: '기본',
  background: '배경',
  bed: '침대',
  toy: '장난감',
  snack: '간식',
  light: '조명',
  poster: '포스터',
  trophy: '기념품'
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

export const TAMAGOTCHI_ROOM_ITEMS = Object.freeze([
  roomItem('basic_mat', 'basic', '기본 매트', '▫️', 0, '처음부터 놓여 있는 작은 매트입니다.'),
  roomItem('pink_wallpaper', 'background', '분홍 벽지', '🌸', 1, '방을 포근한 분홍빛으로 바꿉니다.'),
  roomItem('cozy_bed', 'bed', '포근한 침대', '🛏️', 2, '희진이 편하게 쉴 수 있는 침대입니다.'),
  roomItem('toy_box', 'toy', '장난감 상자', '🧸', 2, '놀아주기 좋은 장난감을 모아둡니다.'),
  roomItem('snack_tray', 'snack', '간식 트레이', '🍪', 2, '몰래 간식 사건과 잘 어울리는 간식 접시입니다.'),
  roomItem('moon_lamp', 'light', '달빛 무드등', '🌙', 2, '밤에도 은은하게 빛나는 조명입니다.'),
  roomItem('monkey_poster', 'poster', '원숭이 포스터', '🐒', 3, '원숭이친구 희진을 위한 장난스러운 포스터입니다.'),
  roomItem('trophy_shelf', 'trophy', '성년기 트로피 선반', '🏆', 0, '성년기 퀘스트 보상으로 받는 기념 선반입니다.')
]);

export const TAMAGOTCHI_FRIEND_ACTIONS = Object.freeze({
  pet: friendAction('pet', '쓰다듬기', '🤲', { happiness: 4, affection: 4 }),
  snack: friendAction('snack', '간식 놓기', '🍪', { fullness: 5, affection: 3 }),
  cheer: friendAction('cheer', '응원하기', '📣', { happiness: 3, health: 2, affection: 3 })
});

export const TAMAGOTCHI_ADULT_QUESTS = Object.freeze({
  balanced: adultQuest('balanced', '균형 유지 루틴', '성년기 균형형 희진을 위해 꾸준한 케어 12회를 달성하세요.', [
    questRequirement('totalCareActions', '총 케어', 12)
  ]),
  beloved: adultQuest('beloved', '사랑둥이 팬서비스', '애정 70과 총 케어 10회를 달성하세요.', [
    questRequirement('affection', '애정', 70),
    questRequirement('totalCareActions', '총 케어', 10)
  ]),
  gourmet: adultQuest('gourmet', '먹방 준비 완료', '밥주기 8회로 먹방 희진의 성년기 루틴을 완성하세요.', [
    questRequirement('feeds', '밥주기', 8)
  ]),
  entertainer: adultQuest('entertainer', '예능감 충전', '놀아주기 8회로 예능 희진의 장기를 키우세요.', [
    questRequirement('plays', '놀아주기', 8)
  ]),
  heeheebotter: adultQuest('heeheebotter', '희희봇 숙련자', '희희봇하기 4회로 봇친화 루틴을 완성하세요.', [
    questRequirement('leisure_heeheebot', '희희봇하기', 4)
  ]),
  rhythm: adultQuest('rhythm', '리듬 연습', '디맥하기 4회로 리듬 희진의 무대를 준비하세요.', [
    questRequirement('leisure_djmax', '디맥하기', 4)
  ]),
  tidy: adultQuest('tidy', '반짝 방 만들기', '씻기기 6회로 깔끔한 성년기 방을 완성하세요.', [
    questRequirement('cleans', '씻기기', 6)
  ]),
  dreamer: adultQuest('dreamer', '포근한 낮잠 루틴', '재우기 6회로 꿈꾸는 희진의 리듬을 잡으세요.', [
    questRequirement('naps', '재우기', 6)
  ]),
  healthy: adultQuest('healthy', '튼튼 루틴', '산책 3회와 약주기 2회로 건강 루틴을 완성하세요.', [
    questRequirement('leisure_walk', '산책', 3),
    questRequirement('medicines', '약주기', 2)
  ]),
  monkey: adultQuest('monkey', '원숭이 친구 모임', '원숭이 여가 4회로 원숭이친구 희진의 약속을 채우세요.', [
    questRequirement('leisure_monkey', '원숭이', 4)
  ]),
  mischievous: adultQuest('mischievous', '장난은 적당히', '원숭이 괴롭히기 4회와 건강 50을 맞추세요.', [
    questRequirement('leisure_tease_monkey', '원숭이 괴롭히기', 4),
    questRequirement('health', '건강', 50)
  ]),
  fragile: adultQuest('fragile', '회복 기록', '약주기 3회로 병약 희진의 회복 루틴을 남기세요.', [
    questRequirement('medicines', '약주기', 3)
  ]),
  neglected: adultQuest('neglected', '다시 가까워지기', '오늘의 돌봄 완료 1회와 애정 35를 달성하세요.', [
    questRequirement('dailyCompletions', '오늘의 돌봄 완료', 1),
    questRequirement('affection', '애정', 35)
  ])
});

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
      addJournalEntry(pet, {
        type: 'care',
        title: TAMAGOTCHI_ACTIONS[normalizedAction],
        message: getActionMessage(normalizedAction, pet),
        at: now
      });
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
      addJournalEntry(pet, {
        type: 'leisure',
        title: TAMAGOTCHI_LEISURES[normalizedLeisureId].label,
        message: getLeisureMessage(normalizedLeisureId),
        at: now
      });
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

  async getRoom({ guildId, userId, username, now = Date.now() }) {
    return this.store.update((data) => {
      const pet = getOrCreatePet(data, { guildId, userId, username, now });
      applyDecay(pet, now, this.options);
      return createStatusResult(pet, now, { view: 'room' }, this.options);
    });
  }

  async unlockRoomItem({ guildId, userId, username, itemId, now = Date.now() }) {
    return this.store.update((data) => {
      const pet = getOrCreatePet(data, { guildId, userId, username, now });
      applyDecay(pet, now, this.options);
      const item = getRoomItemById(itemId);
      if (!item) {
        throw new Error('알 수 없는 희진 방 아이템입니다.');
      }
      return unlockRoomItemForPet(pet, item, now, this.options);
    });
  }

  async unlockNextRoomItem({ guildId, userId, username, now = Date.now() }) {
    return this.store.update((data) => {
      const pet = getOrCreatePet(data, { guildId, userId, username, now });
      applyDecay(pet, now, this.options);
      const item = getNextUnlockableRoomItem(pet);
      if (!item) {
        return createStatusResult(pet, now, {
          view: 'room',
          performed: false,
          eventMessage: '🏠 해금할 수 있는 희진 방 아이템을 모두 모았어요.'
        }, this.options);
      }
      return unlockRoomItemForPet(pet, item, now, this.options);
    });
  }

  async equipRoomItem({ guildId, userId, username, itemId, now = Date.now() }) {
    return this.store.update((data) => {
      const pet = getOrCreatePet(data, { guildId, userId, username, now });
      applyDecay(pet, now, this.options);
      const item = getRoomItemById(itemId);
      if (!item) {
        throw new Error('알 수 없는 희진 방 아이템입니다.');
      }
      if (!pet.room.unlockedItemIds.includes(item.id)) {
        return createStatusResult(pet, now, {
          view: 'room',
          performed: false,
          eventMessage: `🔒 **${item.label}**은(는) 아직 해금하지 않았어요.`
        }, this.options);
      }
      equipRoomItemForPet(pet, item);
      pet.lastUpdatedAt = now;
      addEventLog(pet, {
        type: 'room',
        id: `equip_${item.id}`,
        title: item.label,
        message: `희진 방 ${getRoomSlotLabel(item.slot)} 슬롯에 ${item.label}을(를) 놓았어요.`,
        at: now
      });
      addJournalEntry(pet, {
        type: 'room',
        title: item.label,
        message: `방에 ${item.label}을(를) 다시 배치했어요.`,
        at: now
      });
      return createStatusResult(pet, now, {
        view: 'room',
        performed: true,
        eventMessage: `🏠 **${item.label}**을(를) 희진 방에 장착했어요.`
      }, this.options);
    });
  }

  async getAlbum({ guildId, userId, username, now = Date.now() }) {
    return this.store.update((data) => {
      const pet = getOrCreatePet(data, { guildId, userId, username, now });
      applyDecay(pet, now, this.options);
      return createStatusResult(pet, now, { view: 'album' }, this.options);
    });
  }

  async getJournal({ guildId, userId, username, now = Date.now() }) {
    return this.store.update((data) => {
      const pet = getOrCreatePet(data, { guildId, userId, username, now });
      applyDecay(pet, now, this.options);
      return createStatusResult(pet, now, { view: 'journal' }, this.options);
    });
  }

  async getAdultQuest({ guildId, userId, username, now = Date.now() }) {
    return this.store.update((data) => {
      const pet = getOrCreatePet(data, { guildId, userId, username, now });
      applyDecay(pet, now, this.options);
      return createStatusResult(pet, now, { view: 'quest' }, this.options);
    });
  }

  async claimAdultQuest({ guildId, userId, username, now = Date.now() }) {
    return this.store.update((data) => {
      const pet = getOrCreatePet(data, { guildId, userId, username, now });
      applyDecay(pet, now, this.options);
      const status = createStatusResult(pet, now, { view: 'quest' }, this.options);
      const quest = status.adultQuest;

      if (!quest.stageReady) {
        return {
          ...status,
          performed: false,
          eventMessage: '🌱 성년기 퀘스트는 희진이 성년기가 된 뒤 열려요.'
        };
      }
      if (quest.rewardClaimed) {
        return {
          ...status,
          performed: false,
          eventMessage: '🏆 이 성년기 퀘스트 보상은 이미 받았어요.'
        };
      }
      if (!quest.complete) {
        return {
          ...status,
          performed: false,
          eventMessage: '📜 아직 성년기 퀘스트 목표를 다 채우지 못했어요.'
        };
      }

      pet.adultQuests.claimedQuestIds.push(quest.id);
      pet.adultQuests.claimedQuestIds = [...new Set(pet.adultQuests.claimedQuestIds)];
      pet.codex.memoryShards += quest.reward.memoryShards;
      unlockRoomItemWithoutCost(pet, getRoomItemById(quest.reward.roomItemId));
      addEventLog(pet, {
        type: 'quest',
        id: quest.id,
        title: '성년기 퀘스트 완료',
        message: `${quest.label} 보상으로 추억 조각 ${quest.reward.memoryShards}개와 ${quest.reward.roomItemLabel}을(를) 받았어요.`,
        at: now
      });
      addJournalEntry(pet, {
        type: 'quest',
        title: '성년기 퀘스트 완료',
        message: `${quest.label}을(를) 끝내고 ${quest.reward.roomItemLabel}을(를) 방에 놓았어요.`,
        at: now
      });

      return createStatusResult(pet, now, {
        view: 'quest',
        performed: true,
        eventMessage: `🏆 성년기 퀘스트 **${quest.label}** 완료! 추억 조각 **${quest.reward.memoryShards}개**와 **${quest.reward.roomItemLabel}**을(를) 받았어요.`
      }, this.options);
    });
  }

  async visitFriend({
    guildId,
    userId,
    username,
    targetUserId,
    targetUsername,
    action = 'pet',
    now = Date.now()
  }) {
    return this.store.update((data) => {
      const normalizedAction = normalizeFriendAction(action);
      if (!normalizedAction) {
        throw new Error('알 수 없는 희진 방문 행동입니다.');
      }
      if (!targetUserId || targetUserId === userId) {
        throw new Error('다른 유저의 희진에게만 방문할 수 있어요.');
      }

      const visitorPet = getOrCreatePet(data, { guildId, userId, username, now });
      const targetPet = getOrCreatePet(data, {
        guildId,
        userId: targetUserId,
        username: targetUsername,
        now
      });
      applyDecay(visitorPet, now, this.options);
      applyDecay(targetPet, now, this.options);

      const dayIndex = getDayIndex(now);
      if (visitorPet.social.visits[targetUserId] === dayIndex) {
        return createStatusResult(targetPet, now, {
          view: 'room',
          performed: false,
          eventMessage: '👣 이 희진 방은 오늘은 이미 방문했어요. 내일 다시 놀러가 주세요.'
        }, this.options);
      }

      const visitAction = TAMAGOTCHI_FRIEND_ACTIONS[normalizedAction];
      for (const [stat, delta] of Object.entries(visitAction.effects)) {
        targetPet.stats[stat] = clamp(targetPet.stats[stat] + delta, MIN_STAT, MAX_STAT);
      }
      visitorPet.codex.memoryShards += 1;
      visitorPet.social.visits[targetUserId] = dayIndex;
      targetPet.social.visitors[userId] = {
        username,
        action: normalizedAction,
        dayIndex,
        at: now
      };
      targetPet.lastUpdatedAt = now;
      addEventLog(targetPet, {
        type: 'social',
        id: `visit_${userId}_${dayIndex}`,
        title: '친구 방문',
        message: `${username}님이 ${visitAction.label}을(를) 해줬어요.`,
        at: now
      });
      addJournalEntry(targetPet, {
        type: 'social',
        title: '친구 방문',
        message: `${username}님이 방에 와서 ${visitAction.label}을(를) 해줬어요.`,
        at: now
      });
      addJournalEntry(visitorPet, {
        type: 'social',
        title: '친구 방문',
        message: `${targetUsername ?? targetUserId}님의 희진에게 ${visitAction.label}을(를) 해주고 추억 조각 1개를 얻었어요.`,
        at: now
      });

      return createStatusResult(targetPet, now, {
        view: 'room',
        performed: true,
        friendVisit: {
          action: visitAction,
          visitorUserId: userId,
          visitorUsername: username
        },
        eventMessage: `${visitAction.emoji} **${username}**님이 ${targetUsername ?? '친구'}님의 희진 방에 방문해 **${visitAction.label}**을(를) 해줬어요. 방문자는 추억 조각 **1개**를 얻었어요.`
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
    room: {
      unlockedItemIds: ['basic_mat'],
      equipped: {
        basic: 'basic_mat'
      }
    },
    adultQuests: {
      claimedQuestIds: []
    },
    social: {
      visits: {},
      visitors: {}
    },
    memories: {
      eventLog: [],
      journal: []
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
  pet.room = normalizeRoomState(pet.room);
  pet.adultQuests ??= {};
  pet.adultQuests.claimedQuestIds = normalizeIdList(pet.adultQuests.claimedQuestIds, Object.keys(TAMAGOTCHI_ADULT_QUESTS));
  pet.social = normalizeSocialState(pet.social);
  pet.memories ??= {};
  pet.memories.eventLog = Array.isArray(pet.memories.eventLog)
    ? pet.memories.eventLog.slice(-EVENT_LOG_LIMIT)
    : [];
  pet.memories.journal = Array.isArray(pet.memories.journal)
    ? pet.memories.journal.slice(-JOURNAL_LIMIT).map(normalizeJournalEntry)
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
    room: getRoomSummary(pet),
    album: getAlbumSummary(pet),
    journal: getJournalSummary(pet),
    adultQuest: getAdultQuestSummary(pet, now),
    cooldowns: getCooldownSummary(pet, now, options),
    recentEvents: pet.memories.eventLog.slice(-3).reverse(),
    view: 'status',
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
    room: {
      unlockedItemIds: [...pet.room.unlockedItemIds],
      equipped: { ...pet.room.equipped }
    },
    adultQuests: {
      claimedQuestIds: [...pet.adultQuests.claimedQuestIds]
    },
    social: {
      visits: { ...pet.social.visits },
      visitors: Object.fromEntries(
        Object.entries(pet.social.visitors).map(([key, value]) => [key, { ...value }])
      )
    },
    memories: {
      eventLog: pet.memories.eventLog.map((entry) => ({ ...entry })),
      journal: pet.memories.journal.map((entry) => ({ ...entry }))
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
  addJournalEntry(pet, {
    type: 'daily',
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
  addJournalEntry(pet, {
    type: 'random',
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
    unlockedRoomItems: [...pet.room.unlockedItemIds],
    branchCount: pet.codex.discoveredBranches.length,
    totalBranches: Object.keys(TAMAGOTCHI_GROWTH_BRANCHES).length,
    eventCount: pet.codex.discoveredEvents.length,
    totalEvents: TAMAGOTCHI_RANDOM_EVENTS.length,
    roomItemCount: pet.room.unlockedItemIds.length,
    totalRoomItems: TAMAGOTCHI_ROOM_ITEMS.length
  };
}

function getRoomSummary(pet) {
  const unlockedItems = pet.room.unlockedItemIds
    .map(getRoomItemById)
    .filter(Boolean);
  const equipped = Object.fromEntries(
    Object.entries(pet.room.equipped)
      .map(([slot, itemId]) => [slot, getRoomItemById(itemId)])
      .filter(([, item]) => Boolean(item))
  );
  const nextUnlock = getNextUnlockableRoomItem(pet);

  return {
    unlockedItemIds: [...pet.room.unlockedItemIds],
    unlockedItems,
    unlockedCount: unlockedItems.length,
    totalItems: TAMAGOTCHI_ROOM_ITEMS.length,
    equipped,
    slots: Object.keys(ROOM_SLOT_LABELS).map((slot) => ({
      id: slot,
      label: getRoomSlotLabel(slot),
      item: equipped[slot] ?? null
    })),
    nextUnlock,
    comfortScore: calculateRoomComfortScore(unlockedItems, equipped)
  };
}

function getAlbumSummary(pet) {
  return {
    branches: Object.values(TAMAGOTCHI_GROWTH_BRANCHES).map((branch) => {
      const discovered = pet.codex.discoveredBranches.includes(branch.id);
      return {
        id: discovered ? branch.id : null,
        title: discovered ? branch.label : '???',
        description: discovered ? branch.description : '아직 발견하지 못한 성장 분기입니다.',
        discovered
      };
    }),
    events: TAMAGOTCHI_RANDOM_EVENTS.map((event) => {
      const discovered = pet.codex.discoveredEvents.includes(event.id);
      return {
        id: discovered ? event.id : null,
        title: discovered ? event.title : '???',
        message: discovered ? event.message : '아직 발견하지 못한 랜덤 사건입니다.',
        discovered
      };
    }),
    roomItems: TAMAGOTCHI_ROOM_ITEMS.map((item) => {
      const discovered = pet.room.unlockedItemIds.includes(item.id);
      return {
        id: discovered ? item.id : null,
        title: discovered ? item.label : '???',
        description: discovered ? item.description : '아직 해금하지 못한 방 아이템입니다.',
        discovered
      };
    })
  };
}

function getJournalSummary(pet, limit = 7) {
  const entries = pet.memories.journal
    .slice(-limit)
    .reverse()
    .map((entry) => ({ ...entry }));
  return {
    entries,
    totalEntries: pet.memories.journal.length
  };
}

function getAdultQuestSummary(pet, now) {
  updateGrowthBranch(pet, now);
  const growthStage = getTamagotchiGrowthStage(pet, now);
  const branchId = getActiveGrowthBranchId(pet, growthStage.id) ?? 'balanced';
  const quest = TAMAGOTCHI_ADULT_QUESTS[branchId] ?? TAMAGOTCHI_ADULT_QUESTS.balanced;
  const requirements = quest.requirements.map((requirement) => {
    const current = getQuestProgressValue(pet, requirement.metric);
    return {
      ...requirement,
      current,
      complete: current >= requirement.required
    };
  });
  const complete = requirements.every((requirement) => requirement.complete);
  const rewardItem = getRoomItemById('trophy_shelf');

  return {
    id: quest.id,
    branchId,
    label: quest.label,
    description: quest.description,
    stageReady: growthStage.id === 'adult',
    complete,
    rewardClaimed: pet.adultQuests.claimedQuestIds.includes(quest.id),
    requirements,
    reward: {
      memoryShards: 3,
      roomItemId: rewardItem.id,
      roomItemLabel: rewardItem.label
    }
  };
}

function unlockRoomItemForPet(pet, item, now, options) {
  if (pet.room.unlockedItemIds.includes(item.id)) {
    equipRoomItemForPet(pet, item);
    return createStatusResult(pet, now, {
      view: 'room',
      performed: false,
      eventMessage: `🏠 **${item.label}**은(는) 이미 해금되어 있어 방에 다시 배치했어요.`
    }, options);
  }
  if (pet.codex.memoryShards < item.cost) {
    return createStatusResult(pet, now, {
      view: 'room',
      performed: false,
      eventMessage: `🧩 **${item.label}** 해금에는 추억 조각 **${item.cost}개**가 필요해요. 현재 **${pet.codex.memoryShards}개**입니다.`
    }, options);
  }

  pet.codex.memoryShards -= item.cost;
  unlockRoomItemWithoutCost(pet, item);
  pet.lastUpdatedAt = now;
  addEventLog(pet, {
    type: 'room',
    id: item.id,
    title: item.label,
    message: `추억 조각 ${item.cost}개로 ${item.label}을(를) 해금했어요.`,
    at: now
  });
  addJournalEntry(pet, {
    type: 'room',
    title: item.label,
    message: `추억 조각 ${item.cost}개로 ${item.label}을(를) 해금하고 방에 놓았어요.`,
    at: now
  });

  return createStatusResult(pet, now, {
    view: 'room',
    performed: true,
    eventMessage: `🏠 희진 방 아이템 **${item.label}** 해금! 추억 조각 **${item.cost}개**를 사용했어요.`
  }, options);
}

function unlockRoomItemWithoutCost(pet, item) {
  if (!item) return;
  if (!pet.room.unlockedItemIds.includes(item.id)) {
    pet.room.unlockedItemIds.push(item.id);
  }
  equipRoomItemForPet(pet, item);
}

function equipRoomItemForPet(pet, item) {
  pet.room.equipped[item.slot] = item.id;
}

function getNextUnlockableRoomItem(pet) {
  return TAMAGOTCHI_ROOM_ITEMS
    .filter((item) => item.cost > 0 && !pet.room.unlockedItemIds.includes(item.id))
    .sort((a, b) => a.cost - b.cost || a.id.localeCompare(b.id))
    .find((item) => item.cost <= pet.codex.memoryShards)
    ?? TAMAGOTCHI_ROOM_ITEMS.find((item) => item.cost > 0 && !pet.room.unlockedItemIds.includes(item.id))
    ?? null;
}

function getRoomItemById(itemId) {
  const normalized = String(itemId ?? '').trim();
  return TAMAGOTCHI_ROOM_ITEMS.find((item) => item.id === normalized) ?? null;
}

function calculateRoomComfortScore(unlockedItems, equipped) {
  const equippedCount = Object.keys(equipped).length;
  return Math.min(100, unlockedItems.length * 8 + equippedCount * 6);
}

function getQuestProgressValue(pet, metric) {
  if (metric === 'affection') return Math.floor(pet.stats.affection);
  if (metric === 'health') return Math.floor(pet.stats.health);
  if (metric === 'dailyCompletions') return pet.codex.dailyCompletions;
  if (metric.startsWith('leisure_')) {
    return pet.counters.leisure[metric.slice('leisure_'.length)] ?? 0;
  }
  return pet.counters[metric] ?? 0;
}

function addJournalEntry(pet, entry) {
  pet.memories.journal.push(normalizeJournalEntry(entry));
  pet.memories.journal = pet.memories.journal.slice(-JOURNAL_LIMIT);
}

function normalizeJournalEntry(entry) {
  return {
    type: String(entry?.type ?? 'note'),
    title: String(entry?.title ?? '희진 일기'),
    message: String(entry?.message ?? ''),
    at: numberOrDefault(entry?.at, 0)
  };
}

function normalizeRoomState(room) {
  const raw = room && typeof room === 'object' ? room : {};
  const unlocked = normalizeIdList(raw.unlockedItemIds, TAMAGOTCHI_ROOM_ITEMS.map((item) => item.id));
  if (!unlocked.includes('basic_mat')) unlocked.unshift('basic_mat');
  const equipped = {};
  const rawEquipped = raw.equipped && typeof raw.equipped === 'object' ? raw.equipped : {};
  for (const itemId of unlocked) {
    const item = getRoomItemById(itemId);
    if (item && rawEquipped[item.slot] === item.id) {
      equipped[item.slot] = item.id;
    }
  }
  if (!equipped.basic) equipped.basic = 'basic_mat';
  return {
    unlockedItemIds: unlocked,
    equipped
  };
}

function normalizeSocialState(social) {
  const raw = social && typeof social === 'object' ? social : {};
  return {
    visits: normalizeDayIndexMap(raw.visits),
    visitors: normalizeVisitorMap(raw.visitors)
  };
}

function normalizeDayIndexMap(rawMap) {
  const map = rawMap && typeof rawMap === 'object' ? rawMap : {};
  return Object.fromEntries(
    Object.entries(map)
      .map(([key, value]) => [key, Math.max(0, Math.floor(numberOrDefault(value, 0)))])
  );
}

function normalizeVisitorMap(rawMap) {
  const map = rawMap && typeof rawMap === 'object' ? rawMap : {};
  return Object.fromEntries(
    Object.entries(map).map(([userId, value]) => [userId, {
      username: String(value?.username ?? userId),
      action: normalizeFriendAction(value?.action) ?? 'pet',
      dayIndex: Math.max(0, Math.floor(numberOrDefault(value?.dayIndex, 0))),
      at: numberOrDefault(value?.at, 0)
    }])
  );
}

function normalizeFriendAction(action) {
  const normalized = String(action ?? '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(TAMAGOTCHI_FRIEND_ACTIONS, normalized)
    ? normalized
    : null;
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
      addJournalEntry(pet, {
        type: 'growth',
        title: TAMAGOTCHI_GROWTH_BRANCHES[branchId]?.label ?? branchId,
        message: `${stageId === 'adult' ? '성년기' : '청소년기'} 성장 분기가 열렸어요.`,
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

function roomItem(id, slot, label, emoji, cost, description) {
  return Object.freeze({
    id,
    slot,
    label,
    emoji,
    cost,
    description
  });
}

function friendAction(id, label, emoji, effects) {
  return Object.freeze({
    id,
    label,
    emoji,
    effects: Object.freeze(effects)
  });
}

function adultQuest(id, label, description, requirements) {
  return Object.freeze({
    id,
    label,
    description,
    requirements: Object.freeze(requirements)
  });
}

function questRequirement(metric, label, required) {
  return Object.freeze({ metric, label, required });
}

function getRoomSlotLabel(slot) {
  return ROOM_SLOT_LABELS[slot] ?? slot;
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
