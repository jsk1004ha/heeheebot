import {
  CURRENCY_MAIN,
  debitCurrency,
  migrateLegacyWalletsToGold,
  normalizeWallets
} from './currencies.js';

const TEAM_SIZE = 3;
const MAX_ROD_LEVEL = 20;
const MAX_IDLE_REWARD_MS = 12 * 60 * 60 * 1000;
const IDLE_FISH_INTERVAL_MS = 30 * 60 * 1000;

const RARITIES = Object.freeze({
  common: Object.freeze({ label: '일반', weight: 6500, powerBonus: 0 }),
  uncommon: Object.freeze({ label: '고급', weight: 2300, powerBonus: 2 }),
  rare: Object.freeze({ label: '희귀', weight: 900, powerBonus: 5 }),
  epic: Object.freeze({ label: '영웅', weight: 250, powerBonus: 9 }),
  legendary: Object.freeze({ label: '전설', weight: 50, powerBonus: 15 }),
  hidden: Object.freeze({ label: '히든', weight: 0, powerBonus: 28 })
});

const RARITY_SERIES_STATS = Object.freeze({
  common: Object.freeze({ minSize: 8, maxSize: 55, hp: 30, attack: 6, defense: 4, speed: 5, value: 7 }),
  uncommon: Object.freeze({ minSize: 25, maxSize: 110, hp: 48, attack: 11, defense: 7, speed: 8, value: 22 }),
  rare: Object.freeze({ minSize: 35, maxSize: 170, hp: 62, attack: 16, defense: 11, speed: 10, value: 50 }),
  epic: Object.freeze({ minSize: 50, maxSize: 230, hp: 80, attack: 22, defense: 15, speed: 11, value: 130 }),
  legendary: Object.freeze({ minSize: 80, maxSize: 320, hp: 105, attack: 30, defense: 22, speed: 13, value: 360 }),
  hidden: Object.freeze({ minSize: 12, maxSize: 404, hp: 125, attack: 38, defense: 26, speed: 16, value: 777 })
});

const FISH_BLUEPRINTS = Object.freeze([
  fish('crucian_carp', '붕어', 'common', '민물', 10, 35, 34, 7, 5, 5, 8),
  fish('carp', '잉어', 'common', '민물', 20, 70, 42, 8, 7, 4, 10),
  fish('mackerel', '고등어', 'common', '바다', 25, 45, 36, 9, 4, 8, 11),
  fish('salmon', '연어', 'uncommon', '민물', 45, 95, 52, 11, 7, 8, 22),
  fish('tuna', '참치', 'uncommon', '바다', 70, 180, 60, 13, 8, 10, 28),
  fish('pufferfish', '복어', 'rare', '독', 15, 45, 48, 16, 12, 5, 45),
  fish('electric_eel', '전기장어', 'rare', '전기', 60, 160, 62, 18, 9, 12, 55),
  fish('golden_carp', '황금잉어', 'epic', '빛', 35, 90, 72, 20, 15, 9, 120),
  fish('kraken_spawn', '크라켄 새끼', 'epic', '심해', 80, 220, 84, 23, 14, 7, 160),
  fish('dragonfish', '용왕의 물고기', 'legendary', '용', 100, 300, 110, 32, 22, 14, 400),
  ...createFishSeries('common', '일반', [
    '피라미', '송사리', '미꾸라지', '은어', '돌고기', '꺽지', '납자루', '버들치', '빙어', '정어리',
    '멸치', '꽁치', '전갱이', '망둥어', '쏨뱅이', '도루묵', '양미리', '가자미', '보리멸', '농어치어',
    '숭어', '학꽁치', '황어', '강준치', '누치', '끄리', '참붕어', '갈겨니', '동자개', '메기새끼',
    '청어', '임연수어', '전어', '풀망둑', '열목어', '버들붕어', '긴몰개', '참몰개', '민물검정망둑', '흰줄납줄개'
  ]),
  ...createFishSeries('uncommon', '고급', [
    '쏘가리', '메기', '장어', '광어', '우럭', '도미', '방어', '삼치', '갈치', '문어',
    '오징어', '갑오징어', '쭈꾸미', '꽃게', '대구', '명태', '민어', '참돔', '돌돔', '감성돔',
    '능성어', '벤자리', '자리돔', '쥐치', '말쥐치', '볼락', '참가자미', '홍어', '숭어대장', '큰입배스'
  ]),
  ...createFishSeries('rare', '희귀', [
    '철갑상어', '블루길킹', '비단잉어', '청새치', '황새치', '돛새치', '만새기', '날치왕', '나폴레옹피쉬', '개복치',
    '산갈치', '투구게', '해마', '리본장어', '늑대물고기', '피라냐', '아로와나', '피라루쿠', '가물치왕', '백련어',
    '초대형메기', '무지개송어', '금강모치', '얼음빙어', '산천어'
  ]),
  ...createFishSeries('epic', '영웅', [
    '심해아귀', '거대가오리', '유령상어', '수정해파리', '불꽃쏠배감펭', '천둥곰치', '달빛연어', '별빛참치', '흑진주문어', '백금도미',
    '루비복어', '사파이어장어', '에메랄드가자미', '고대실러캔스', '화산농어', '빙하대구', '폭풍방어', '왕관해마', '거울잉어', '태양고래'
  ]),
  ...createFishSeries('legendary', '전설', [
    '청룡잉어', '백호상어', '주작금붕어', '현무거북어', '별고래', '달의해룡', '태초의실러캔스', '바다의심장', '심연의군주어', '천공만타'
  ]),
  ...createFishSeries('hidden', '히든', [
    '안개고래', '공허잉어', '시공도미', '무명의물고기', '개발자의붕어', '럭키블루핀', '그림자메기', '비밀금붕어', '404피쉬', '새벽의해룡'
  ])
]);

const FISH_SPECIES = Object.freeze(Object.fromEntries(
  FISH_BLUEPRINTS.map((blueprint) => [blueprint.id, Object.freeze({
    label: blueprint.label,
    rarity: blueprint.rarity,
    type: blueprint.type,
    minSize: blueprint.minSize,
    maxSize: blueprint.maxSize,
    hp: blueprint.hp,
    attack: blueprint.attack,
    defense: blueprint.defense,
    speed: blueprint.speed,
    value: blueprint.value,
    hidden: blueprint.rarity === 'hidden',
    assetId: `fish_${blueprint.id}`,
    imagePath: `assets/fishing/fish/${blueprint.rarity === 'hidden' ? 'hidden' : blueprint.rarity}/${blueprint.id}/icon.png`
  })])
));

function fish(id, label, rarity, type, minSize, maxSize, hp, attack, defense, speed, value) {
  return {
    id,
    label,
    rarity,
    type,
    minSize,
    maxSize,
    hp,
    attack,
    defense,
    speed,
    value
  };
}

function createFishSeries(rarity, type, labels) {
  const base = RARITY_SERIES_STATS[rarity];
  return labels.map((label, index) => fish(
    `${rarity}_fish_${index + 1}`,
    label,
    rarity,
    type,
    base.minSize + index,
    base.maxSize + index * 3,
    base.hp + Math.floor(index / 2),
    base.attack + (index % 7),
    base.defense + (index % 5),
    base.speed + (index % 6),
    base.value + index * Math.max(1, RARITIES[rarity].powerBonus)
  ));
}

const BATTLE_DIFFICULTIES = Object.freeze({
  easy: Object.freeze({ label: '쉬움', teamSize: 1, rarities: Object.freeze(['common', 'uncommon']) }),
  normal: Object.freeze({ label: '보통', teamSize: 2, rarities: Object.freeze(['common', 'uncommon', 'rare']) }),
  hard: Object.freeze({ label: '어려움', teamSize: 3, rarities: Object.freeze(['uncommon', 'rare', 'epic']) })
});

export class FishingService {
  constructor(store, options = {}) {
    this.store = store;
    this.randomInt = options.randomInt ?? randomInt;
  }

  async getProfile(guildId, userId, username = 'Unknown') {
    const data = await this.store.load();
    const profile = getOrCreateFishingProfile(data, guildId, userId, username);
    return cloneFishingProfile(profile);
  }

  async catchFish({ guildId, userId, username, now = Date.now() }) {
    return this.store.update((data) => {
      const profile = getOrCreateFishingProfile(data, guildId, userId, username);
      const catchResult = rollCatch(profile, this.randomInt, now);
      applyCatch(profile, catchResult, now);

      return {
        ...catchResult,
        profile: cloneFishingProfile(profile)
      };
    });
  }

  async enhanceRod({ guildId, userId, username, now = Date.now() }) {
    return this.store.update((data) => {
      const profile = getOrCreateFishingProfile(data, guildId, userId, username);
      const goldProfile = getOrCreateGoldProfile(data, guildId, userId, username);
      const beforeLevel = profile.rod.level;

      if (beforeLevel >= MAX_ROD_LEVEL) {
        return {
          capped: true,
          outcome: 'capped',
          beforeLevel,
          afterLevel: beforeLevel,
          cost: 0,
          profile: cloneFishingProfile(profile)
        };
      }

      const cost = getEnhancementCost(beforeLevel);
      const goldBalanceBefore = goldProfile.balance;
      debitCurrency(
        goldProfile,
        CURRENCY_MAIN,
        cost,
        `골드가 부족합니다. 필요: ${cost.toLocaleString()}골드, 보유: ${goldProfile.balance.toLocaleString()}골드`
      );

      profile.rod.totalEnhancementAttempts += 1;
      profile.rod.lastEnhancedAt = now;

      const table = getEnhancementTable(beforeLevel);
      const roll = this.randomInt(1, 10_000);
      const outcome = resolveEnhancementOutcome(roll, table);

      if (outcome === 'success') {
        profile.rod.level = Math.min(MAX_ROD_LEVEL, profile.rod.level + 1);
      } else if (outcome === 'destroy') {
        profile.rod.level = 1;
        profile.rod.destroyedCount += 1;
      }

      return {
        capped: false,
        outcome,
        roll,
        table,
        beforeLevel,
        afterLevel: profile.rod.level,
        cost,
        goldBalanceBefore,
        goldBalanceAfter: goldProfile.balance,
        profile: cloneFishingProfile(profile)
      };
    });
  }

  async toggleIdle({ guildId, userId, username, now = Date.now() }) {
    return this.store.update((data) => {
      const profile = getOrCreateFishingProfile(data, guildId, userId, username);

      if (!profile.idle.startedAt) {
        profile.idle.startedAt = now;
        return {
          action: 'started',
          startedAt: now,
          profile: cloneFishingProfile(profile)
        };
      }

      const startedAt = profile.idle.startedAt;
      const elapsedMs = Math.max(0, now - startedAt);
      const cappedElapsedMs = Math.min(elapsedMs, MAX_IDLE_REWARD_MS);
      const minutes = Math.floor(cappedElapsedMs / 60_000);
      const fishCount = Math.max(1, Math.floor(cappedElapsedMs / IDLE_FISH_INTERVAL_MS));
      const catches = [];

      for (let index = 0; index < fishCount; index += 1) {
        const catchResult = rollCatch(profile, this.randomInt, now);
        applyCatch(profile, catchResult, now);
        catches.push(catchResult);
      }

      profile.idle.startedAt = 0;
      profile.idle.lastClaimedAt = now;
      profile.idle.totalMinutes += minutes;

      return {
        action: 'claimed',
        startedAt,
        elapsedMs,
        cappedElapsedMs,
        minutes,
        fishCount,
        catches,
        profile: cloneFishingProfile(profile)
      };
    });
  }

  async setTeamSlot({ guildId, userId, username, slot, fishId }) {
    const normalizedSlot = normalizeTeamSlot(slot);
    const normalizedFishId = normalizeFishId(fishId);

    return this.store.update((data) => {
      const profile = getOrCreateFishingProfile(data, guildId, userId, username);

      if ((profile.inventory[normalizedFishId] ?? 0) <= 0) {
        throw new Error(`${FISH_SPECIES[normalizedFishId].label}을(를) 보유하고 있지 않습니다.`);
      }

      const duplicate = profile.team.find((entry) => entry.slot !== normalizedSlot && entry.fishId === normalizedFishId);
      if (duplicate) {
        throw new Error('같은 물고기 종은 팀에 중복 편성할 수 없습니다.');
      }

      profile.team = profile.team.filter((entry) => entry.slot !== normalizedSlot);
      profile.team.push({ slot: normalizedSlot, fishId: normalizedFishId });
      profile.team.sort((a, b) => a.slot - b.slot);

      return {
        slot: normalizedSlot,
        fishId: normalizedFishId,
        fish: FISH_SPECIES[normalizedFishId],
        team: formatTeam(profile),
        profile: cloneFishingProfile(profile)
      };
    });
  }

  async battleFishTeam({
    guildId,
    userId,
    username,
    opponentUserId = null,
    opponentUsername = '상대',
    difficulty = 'normal',
    now = Date.now()
  }) {
    const normalizedDifficulty = normalizeBattleDifficulty(difficulty);

    return this.store.update((data) => {
      const profile = getOrCreateFishingProfile(data, guildId, userId, username);
      const playerTeam = hydrateTeam(profile, '내 팀');

      if (playerTeam.length === 0) {
        throw new Error('물고기팀설정으로 최소 1마리를 팀에 넣어야 배틀할 수 있습니다.');
      }

      let opponentProfile = null;
      let opponentTeam;
      let opponentLabel;

      if (opponentUserId) {
        if (opponentUserId === userId) {
          throw new Error('자기 자신과는 물고기배틀을 할 수 없습니다.');
        }
        opponentProfile = getOrCreateFishingProfile(data, guildId, opponentUserId, opponentUsername);
        opponentTeam = hydrateTeam(opponentProfile, `${opponentProfile.username} 팀`);
        if (opponentTeam.length === 0) {
          throw new Error(`${opponentProfile.username}님의 물고기 팀이 비어 있습니다.`);
        }
        opponentLabel = `${opponentProfile.username} 팀`;
      } else {
        opponentProfile = selectRandomFishingOpponentProfile({
          data,
          guildId,
          userId,
          randomInt: this.randomInt
        });
        opponentUserId = opponentProfile.userId;
        opponentUsername = opponentProfile.username;
        opponentTeam = hydrateTeam(opponentProfile, `${opponentProfile.username} 팀`);
        opponentLabel = `${opponentProfile.username} 팀`;
      }

      const battle = resolveFishBattle({
        playerTeam,
        opponentTeam,
        opponentLabel,
        randomInt: this.randomInt
      });

      profile.battle.lastBattleAt = now;
      if (battle.winner === 'player') {
        profile.battle.wins += 1;
      } else if (battle.winner === 'opponent') {
        profile.battle.losses += 1;
      } else {
        profile.battle.draws += 1;
      }

      if (opponentProfile) {
        opponentProfile.battle.lastBattleAt = now;
        if (battle.winner === 'player') opponentProfile.battle.losses += 1;
        else if (battle.winner === 'opponent') opponentProfile.battle.wins += 1;
        else opponentProfile.battle.draws += 1;
      }

      return {
        difficulty: normalizedDifficulty,
        opponentUserId,
        ...battle,
        profile: cloneFishingProfile(profile),
        opponentProfile: opponentProfile ? cloneFishingProfile(opponentProfile) : null
      };
    });
  }
}

export function getFishOptions({ includeHidden = false, limit = 25 } = {}) {
  return Object.entries(FISH_SPECIES)
    .filter(([, fish]) => includeHidden || !fish.hidden)
    .slice(0, limit)
    .map(([value, fish]) => ({
      name: `${fish.label} (${RARITIES[fish.rarity].label})`,
      value
    }));
}

export function getBattleDifficultyOptions() {
  return Object.entries(BATTLE_DIFFICULTIES).map(([value, config]) => ({
    name: config.label,
    value
  }));
}

export function getFishConfig(fishId) {
  return FISH_SPECIES[normalizeFishId(fishId)];
}

export function getFishCatalog({ includeHidden = true } = {}) {
  return Object.entries(FISH_SPECIES)
    .filter(([, fish]) => includeHidden || !fish.hidden)
    .map(([id, fish]) => ({
      id,
      ...fish
    }));
}

export function getRarityLabel(rarity) {
  return RARITIES[rarity]?.label ?? rarity;
}

export function getMaxIdleRewardMs() {
  return MAX_IDLE_REWARD_MS;
}

export function getFishCount({ includeHidden = true } = {}) {
  return Object.values(FISH_SPECIES)
    .filter((fish) => includeHidden || !fish.hidden)
    .length;
}

export function normalizeFishId(fishId) {
  const normalized = String(fishId ?? '').trim().toLocaleLowerCase('ko-KR');
  const matched = Object.entries(FISH_SPECIES).find(([id, fish]) =>
    id === normalized || fish.label.toLocaleLowerCase('ko-KR') === normalized
  );

  if (!matched) throw new Error('알 수 없는 물고기입니다.');
  return matched[0];
}

function getOrCreateFishingProfile(data, guildId, userId, username = 'Unknown') {
  data.guilds ??= {};
  data.guilds[guildId] ??= {};
  const guild = data.guilds[guildId];
  guild.fishing ??= { users: {} };
  guild.fishing.users ??= {};
  guild.fishing.users[userId] ??= createDefaultFishingProfile(userId, username);

  const profile = guild.fishing.users[userId];
  profile.userId = userId;
  profile.username = username || profile.username || 'Unknown';
  profile.rod = normalizeRod(profile.rod);
  profile.inventory = normalizeInventory(profile.inventory);
  profile.bestFish = normalizeBestFish(profile.bestFish);
  profile.collection = normalizeCollection(profile.collection);
  profile.idle = normalizeIdle(profile.idle);
  profile.team = normalizeTeam(profile.team, profile.inventory);
  profile.battle = normalizeBattleStats(profile.battle);
  profile.stats = normalizeStats(profile.stats);
  profile.createdAt = normalizeNonNegativeInteger(profile.createdAt) || Date.now();

  return profile;
}

function getOrCreateGoldProfile(data, guildId, userId, username = 'Unknown') {
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
    createdAt: Date.now()
  };

  const profile = guild.users[userId];
  profile.userId = userId;
  profile.username = username || profile.username || 'Unknown';
  profile.balance = normalizeNonNegativeInteger(profile.balance);
  profile.wallets = normalizeWallets(profile.wallets);
  migrateLegacyWalletsToGold(profile);
  return profile;
}

function createDefaultFishingProfile(userId, username) {
  return {
    userId,
    username,
    rod: {
      level: 1,
      destroyedCount: 0,
      totalEnhancementAttempts: 0,
      lastEnhancedAt: 0
    },
    inventory: {},
    bestFish: {},
    collection: {},
    idle: {
      startedAt: 0,
      lastClaimedAt: 0,
      totalMinutes: 0
    },
    team: [],
    battle: {
      wins: 0,
      losses: 0,
      draws: 0,
      lastBattleAt: 0
    },
    stats: {
      totalCatches: 0
    },
    createdAt: Date.now()
  };
}

function rollCatch(profile, randomIntFn, now) {
  const rarity = rollRarity(profile, randomIntFn);
  const candidates = Object.entries(FISH_SPECIES)
    .filter(([, fish]) => fish.rarity === rarity);
  const [fishId, fish] = candidates[randomIntFn(0, candidates.length - 1)];
  const sizeBonus = Math.floor(profile.rod.level / 4);
  const size = Math.min(fish.maxSize + sizeBonus, randomIntFn(fish.minSize, fish.maxSize) + sizeBonus);

  return {
    fishId,
    fish,
    rarity,
    size,
    caughtAt: now
  };
}

function applyCatch(profile, catchResult, now) {
  const { fishId, size } = catchResult;
  profile.inventory[fishId] = (profile.inventory[fishId] ?? 0) + 1;
  profile.collection[fishId] ??= now;
  profile.stats.totalCatches += 1;

  if (!profile.bestFish[fishId] || profile.bestFish[fishId].size < size) {
    profile.bestFish[fishId] = { size, caughtAt: now };
  }
}

function rollRarity(profile, randomIntFn) {
  const level = clampInteger(profile.rod.level, 1, MAX_ROD_LEVEL);
  const weights = {
    common: Math.max(2500, RARITIES.common.weight - level * 80),
    uncommon: RARITIES.uncommon.weight + level * 35,
    rare: RARITIES.rare.weight + level * 25,
    epic: RARITIES.epic.weight + level * 15,
    legendary: RARITIES.legendary.weight + level * 5,
    hidden: getHiddenFishWeight(profile)
  };
  const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  let roll = randomIntFn(1, total);

  for (const [rarity, weight] of Object.entries(weights)) {
    if (roll <= weight) return rarity;
    roll -= weight;
  }

  return 'common';
}

function getHiddenFishWeight(profile) {
  const level = clampInteger(profile.rod.level, 1, MAX_ROD_LEVEL);
  const catches = normalizeNonNegativeInteger(profile.stats?.totalCatches);

  if (level < 12 || catches < 50) return 0;

  return Math.min(
    20,
    1 + Math.floor((level - 12) / 2) + Math.floor(catches / 250)
  );
}

function getEnhancementCost(level) {
  if (level <= 5) return level * 20;
  if (level <= 10) return level * 40;
  if (level <= 15) return level * 80;
  return level * 160;
}

function getEnhancementTable(level) {
  if (level <= 5) return { success: 8000, maintain: 2000, destroy: 0 };
  if (level <= 10) return { success: 6000, maintain: 3500, destroy: 500 };
  if (level <= 15) return { success: 4000, maintain: 4500, destroy: 1500 };
  return { success: 2500, maintain: 5000, destroy: 2500 };
}

function resolveEnhancementOutcome(roll, table) {
  if (roll <= table.success) return 'success';
  if (roll <= table.success + table.maintain) return 'maintain';
  return 'destroy';
}

function hydrateTeam(profile, label) {
  return profile.team.map((entry) => {
    const fish = FISH_SPECIES[entry.fishId];
    const bestSize = profile.bestFish[entry.fishId]?.size ?? fish.minSize;
    const sizeBonus = Math.floor(bestSize / 15);
    const rarityBonus = RARITIES[fish.rarity].powerBonus;
    const rodBonus = Math.floor(profile.rod.level / 5);

    return {
      label,
      slot: entry.slot,
      fishId: entry.fishId,
      name: fish.label,
      type: fish.type,
      rarity: fish.rarity,
      maxHp: fish.hp + sizeBonus * 2 + rarityBonus,
      hp: fish.hp + sizeBonus * 2 + rarityBonus,
      attack: fish.attack + sizeBonus + rarityBonus + rodBonus,
      defense: fish.defense + Math.floor(sizeBonus / 2),
      speed: fish.speed,
      size: bestSize
    };
  });
}

function resolveFishBattle({ playerTeam, opponentTeam, opponentLabel, randomInt }) {
  const player = playerTeam.map(cloneBattleFish);
  const opponent = opponentTeam.map(cloneBattleFish);
  let playerIndex = 0;
  let opponentIndex = 0;
  const log = [];

  for (let round = 1; round <= 80; round += 1) {
    const playerFish = player[playerIndex];
    const opponentFish = opponent[opponentIndex];
    if (!playerFish || !opponentFish) break;

    const first = playerFish.speed >= opponentFish.speed ? 'player' : 'opponent';
    const order = first === 'player'
      ? [['player', playerFish, opponentFish], ['opponent', opponentFish, playerFish]]
      : [['opponent', opponentFish, playerFish], ['player', playerFish, opponentFish]];

    for (const [side, attacker, defender] of order) {
      if (attacker.hp <= 0 || defender.hp <= 0) continue;
      const damage = Math.max(1, attacker.attack + randomInt(1, 6) - defender.defense);
      defender.hp = Math.max(0, defender.hp - damage);
      if (log.length < 8) {
        log.push(`${round}턴 ${attacker.name}의 공격: ${damage} 피해`);
      }

      if (defender.hp <= 0) {
        if (log.length < 8) log.push(`${defender.name} 전투불능`);
        if (side === 'player') opponentIndex += 1;
        else playerIndex += 1;
      }
    }
  }

  const winner = playerIndex >= player.length && opponentIndex >= opponent.length
    ? 'draw'
    : opponentIndex >= opponent.length
      ? 'player'
      : playerIndex >= player.length
        ? 'opponent'
        : 'draw';

  return {
    winner,
    opponentLabel,
    playerTeam: player,
    opponentTeam: opponent,
    log
  };
}

function cloneBattleFish(fish) {
  return { ...fish };
}

function formatTeam(profile) {
  return profile.team.map((entry) => ({
    slot: entry.slot,
    fishId: entry.fishId,
    fish: FISH_SPECIES[entry.fishId],
    count: profile.inventory[entry.fishId] ?? 0,
    bestSize: profile.bestFish[entry.fishId]?.size ?? null
  }));
}

function normalizeTeamSlot(slot) {
  const normalized = Number(slot);
  if (!Number.isSafeInteger(normalized) || normalized < 1 || normalized > TEAM_SIZE) {
    throw new Error(`팀 슬롯은 1~${TEAM_SIZE} 사이여야 합니다.`);
  }
  return normalized;
}

function normalizeBattleDifficulty(difficulty) {
  const normalized = String(difficulty ?? 'normal').trim().toLocaleLowerCase('ko-KR');
  const aliases = {
    쉬움: 'easy',
    easy: 'easy',
    보통: 'normal',
    normal: 'normal',
    어려움: 'hard',
    hard: 'hard'
  };
  const result = aliases[normalized];
  if (!result) throw new Error('알 수 없는 물고기배틀 난이도입니다.');
  return result;
}

function normalizeRod(rod = {}) {
  return {
    level: clampInteger(rod.level, 1, MAX_ROD_LEVEL),
    destroyedCount: normalizeNonNegativeInteger(rod.destroyedCount),
    totalEnhancementAttempts: normalizeNonNegativeInteger(rod.totalEnhancementAttempts),
    lastEnhancedAt: normalizeNonNegativeInteger(rod.lastEnhancedAt)
  };
}

function normalizeInventory(inventory = {}) {
  const safeInventory = inventory && typeof inventory === 'object' ? inventory : {};
  const entries = [];

  for (const [fishId, count] of Object.entries(safeInventory)) {
    try {
      const normalizedFishId = normalizeFishId(fishId);
      const normalizedCount = normalizeNonNegativeInteger(count);
      if (normalizedCount > 0) entries.push([normalizedFishId, normalizedCount]);
    } catch {
      // Ignore invalid legacy fish ids.
    }
  }

  return Object.fromEntries(entries);
}

function normalizeBestFish(bestFish = {}) {
  const safeBestFish = bestFish && typeof bestFish === 'object' ? bestFish : {};
  const entries = [];

  for (const [fishId, record] of Object.entries(safeBestFish)) {
    try {
      const normalizedFishId = normalizeFishId(fishId);
      const safeRecord = record && typeof record === 'object' ? record : {};
      entries.push([
        normalizedFishId,
        {
          size: normalizeNonNegativeInteger(safeRecord.size),
          caughtAt: normalizeNonNegativeInteger(safeRecord.caughtAt)
        }
      ]);
    } catch {
      // Ignore invalid legacy fish ids.
    }
  }

  return Object.fromEntries(entries);
}

function normalizeCollection(collection = {}) {
  const safeCollection = collection && typeof collection === 'object' ? collection : {};
  const entries = [];

  for (const [fishId, firstCaughtAt] of Object.entries(safeCollection)) {
    try {
      entries.push([normalizeFishId(fishId), normalizeNonNegativeInteger(firstCaughtAt)]);
    } catch {
      // Ignore invalid legacy fish ids.
    }
  }

  return Object.fromEntries(entries);
}

function normalizeIdle(idle = {}) {
  return {
    startedAt: normalizeNonNegativeInteger(idle?.startedAt),
    lastClaimedAt: normalizeNonNegativeInteger(idle?.lastClaimedAt),
    totalMinutes: normalizeNonNegativeInteger(idle?.totalMinutes)
  };
}

function normalizeTeam(team = [], inventory = {}) {
  if (!Array.isArray(team)) return [];
  const normalized = [];
  const usedSlots = new Set();
  const usedFish = new Set();

  for (const entry of team) {
    try {
      const slot = normalizeTeamSlot(entry?.slot);
      const fishId = normalizeFishId(entry?.fishId);
      if (usedSlots.has(slot) || usedFish.has(fishId) || (inventory[fishId] ?? 0) <= 0) continue;
      usedSlots.add(slot);
      usedFish.add(fishId);
      normalized.push({ slot, fishId });
    } catch {
      // Ignore invalid legacy team entries.
    }
  }

  return normalized.sort((a, b) => a.slot - b.slot);
}

function normalizeBattleStats(battle = {}) {
  return {
    wins: normalizeNonNegativeInteger(battle?.wins),
    losses: normalizeNonNegativeInteger(battle?.losses),
    draws: normalizeNonNegativeInteger(battle?.draws),
    lastBattleAt: normalizeNonNegativeInteger(battle?.lastBattleAt)
  };
}

function normalizeStats(stats = {}) {
  return {
    totalCatches: normalizeNonNegativeInteger(stats?.totalCatches)
  };
}

function cloneFishingProfile(profile) {
  return {
    userId: profile.userId,
    username: profile.username,
    rod: { ...profile.rod },
    inventory: { ...profile.inventory },
    bestFish: structuredClone(profile.bestFish),
    collection: { ...profile.collection },
    idle: { ...profile.idle },
    team: profile.team.map((entry) => ({ ...entry })),
    battle: { ...profile.battle },
    stats: { ...profile.stats },
    createdAt: profile.createdAt
  };
}

function selectRandomFishingOpponentProfile({
  data,
  guildId,
  userId,
  randomInt
}) {
  const users = data.guilds?.[guildId]?.fishing?.users ?? {};
  const candidates = Object.entries(users)
    .filter(([candidateUserId]) => candidateUserId !== userId)
    .map(([candidateUserId, candidate]) =>
      getOrCreateFishingProfile(data, guildId, candidateUserId, candidate?.username ?? '상대')
    )
    .filter((candidate) => hydrateTeam(candidate, `${candidate.username} 팀`).length > 0);

  if (candidates.length <= 0) {
    throw new Error('랜덤 물고기배틀을 진행할 기존 유저 팀이 없습니다. 다른 유저가 물고기팀을 설정한 뒤 다시 시도하세요.');
  }

  return candidates[randomInt(0, candidates.length - 1)];
}

function clampInteger(value, min, max) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized)) return min;
  return Math.min(max, Math.max(min, normalized));
}

function normalizeNonNegativeInteger(value) {
  const normalized = Number(value);
  return Number.isSafeInteger(normalized) && normalized >= 0 ? normalized : 0;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
