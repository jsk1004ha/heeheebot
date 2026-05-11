import { normalizeRpgArea } from './rpg.js';

export const RPG_DUNGEON_RUN_EXPIRY_MS = 24 * 60 * 60 * 1000;

const THEME_FAMILIES = Object.freeze({
  forest: Object.freeze({
    label: '숲',
    roomNouns: Object.freeze(['뿌리 회랑', '포자 정원', '고목 제단', '달빛 샛길']),
    combat: '숲그늘 파수꾼',
    elite: '가시왕의 근위병',
    treasure: '이끼 덮인 보물',
    trap: '움켜쥐는 뿌리',
    rest: '달샘 쉼터',
    boss: '숲심장 수호자'
  }),
  cave: Object.freeze({
    label: '동굴',
    roomNouns: Object.freeze(['수정 광맥', '메아리 굴', '폐광 승강장', '흑요석 문']),
    combat: '광맥 야수',
    elite: '철갑 광부망령',
    treasure: '수정 보관함',
    trap: '낙석 장치',
    rest: '지하 온천',
    boss: '은광의 거석'
  }),
  desert: Object.freeze({
    label: '사막',
    roomNouns: Object.freeze(['열사의 복도', '신기루 방', '모래 제단', '불씨 보관소']),
    combat: '모래 추적자',
    elite: '태양의 처형자',
    treasure: '녹아내린 금고',
    trap: '열풍 함정',
    rest: '그늘 오아시스',
    boss: '사막심장 이프리트'
  }),
  ruins: Object.freeze({
    label: '유적',
    roomNouns: Object.freeze(['봉인 회랑', '왕가 묘실', '룬 기둥방', '망자의 문']),
    combat: '봉인된 기사',
    elite: '왕묘 집행자',
    treasure: '고대 석관',
    trap: '저주 룬',
    rest: '정화 성소',
    boss: '유적의 망령왕'
  }),
  marsh: Object.freeze({
    label: '늪',
    roomNouns: Object.freeze(['독안개 길', '진흙 성소', '수몰 기둥', '버섯 원환']),
    combat: '늪지 포식자',
    elite: '독안개 사제',
    treasure: '가라앉은 궤짝',
    trap: '독포자 함정',
    rest: '정화 연못',
    boss: '늪뼈 군주'
  }),
  frost: Object.freeze({
    label: '빙결',
    roomNouns: Object.freeze(['얼음 성벽', '서리 회랑', '동결 제단', '눈보라 문']),
    combat: '서리 파수병',
    elite: '빙관 기사',
    treasure: '얼어붙은 금고',
    trap: '빙결 룬',
    rest: '온기 화로',
    boss: '빙성의 감시자'
  }),
  void: Object.freeze({
    label: '심연',
    roomNouns: Object.freeze(['공허 관문', '악마의 복도', '밤의 제단', '균열 심장부']),
    combat: '공허 하수인',
    elite: '마왕성 집행관',
    treasure: '금단의 보물고',
    trap: '심연의 낙인',
    rest: '깨진 성역',
    boss: '심연 문지기'
  })
});

const AREA_THEME = Object.freeze({
  forest: 'forest',
  wildflower_plains: 'forest',
  moonlit_hill: 'forest',
  mushroom_grove: 'marsh',
  moonlit_feywood: 'forest',
  cave: 'cave',
  dwarven_ironhold: 'cave',
  crystal_lake: 'cave',
  abyss_mine: 'cave',
  marsh: 'marsh',
  ruins: 'ruins',
  bandit_outpost: 'ruins',
  sunken_catacombs: 'ruins',
  phantom_forest: 'ruins',
  starfall_crater: 'ruins',
  red_desert: 'desert',
  volcano: 'desert',
  dragon_nest: 'desert',
  ancient_dragon_altar: 'desert',
  thunder_plateau: 'desert',
  sky: 'frost',
  frost: 'frost',
  void_gate: 'void'
});

export const RPG_DUNGEON_RELICS = Object.freeze({
  thorn_crown: Object.freeze({
    label: '가시 왕관',
    theme: 'forest',
    upside: '공격 +18%',
    downside: '회복 -25%',
    modifiers: Object.freeze({ attackMultiplier: 0.18, healingMultiplier: -0.25 })
  }),
  greedy_pouch: Object.freeze({
    label: '탐욕의 주머니',
    theme: 'ruins',
    upside: '보상 +25%',
    downside: '함정 피해 +30%',
    modifiers: Object.freeze({ rewardMultiplier: 0.25, trapDamageMultiplier: 0.3 })
  }),
  cracked_crystal_heart: Object.freeze({
    label: '깨진 수정심장',
    theme: 'cave',
    upside: '전투 피해 +22%',
    downside: '최대 HP -12%',
    modifiers: Object.freeze({ attackMultiplier: 0.22, maxHpMultiplier: -0.12 })
  }),
  ember_brand: Object.freeze({
    label: '사막의 불씨',
    theme: 'desert',
    upside: '고위험 보상 +35%',
    downside: '방마다 추가 피해',
    modifiers: Object.freeze({ highRiskRewardMultiplier: 0.35, roomDamageBonus: 4 })
  }),
  sealed_key: Object.freeze({
    label: '봉인 해제 열쇠',
    theme: 'ruins',
    upside: '유물 선택지 +1',
    downside: '저주방 출현 증가',
    modifiers: Object.freeze({ relicChoiceBonus: 1, cursedChoiceBonus: 1 })
  }),
  frostglass_guard: Object.freeze({
    label: '서리유리 방패',
    theme: 'frost',
    upside: '받는 피해 -16%',
    downside: '코인 보상 -10%',
    modifiers: Object.freeze({ damageMultiplier: -0.16, rewardMultiplier: -0.1 })
  }),
  blood_oath: Object.freeze({
    label: '피의 맹약',
    theme: 'void',
    upside: '정예/보스 보상 +40%',
    downside: '일반 회복 불안정',
    modifiers: Object.freeze({ highRiskRewardMultiplier: 0.4, healingMultiplier: -0.2 })
  }),
  marshbone_totem: Object.freeze({
    label: '늪뼈 토템',
    theme: 'marsh',
    upside: '함정 보상 +30%',
    downside: '함정 피해 +20%',
    modifiers: Object.freeze({ trapRewardMultiplier: 0.3, trapDamageMultiplier: 0.2 })
  })
});

export function getRpgDungeonRunTheme(area = 'forest') {
  return AREA_THEME[normalizeRpgArea(area)] ?? 'forest';
}

export function getRpgDungeonThemeConfig(theme = 'forest') {
  return THEME_FAMILIES[theme] ?? THEME_FAMILIES.forest;
}

export function createRpgDungeonRun({
  dungeonId = null,
  dungeonConfig = null,
  area = 'forest',
  depth = 3,
  playerLevel = 1,
  derivedStats = {},
  hp = null,
  mp = null,
  now = Date.now(),
  randomInt = defaultRandomInt
} = {}) {
  const normalizedArea = normalizeRpgArea(dungeonConfig?.area || area);
  const theme = getRpgDungeonRunTheme(normalizedArea);
  const maxFloors = clampInt(depth ?? dungeonConfig?.rooms ?? 3, 3, 5, 3);
  const maxHp = Math.max(1, clampInt(derivedStats.maxHp, 1, 999_999, 110));
  const maxMp = Math.max(0, clampInt(derivedStats.maxMp, 0, 999_999, 35));
  const startedAt = clampInt(now, 1, Number.MAX_SAFE_INTEGER, Date.now());
  const expiresAt = Math.min(
    Number.MAX_SAFE_INTEGER,
    Math.max(startedAt, Date.now()) + RPG_DUNGEON_RUN_EXPIRY_MS
  );

  const run = {
    id: `dr_${startedAt.toString(36)}_${randomInt(100, 999).toString(36)}`,
    dungeonId,
    area: normalizedArea,
    theme,
    state: 'active',
    floor: 1,
    maxFloors,
    hp: Math.min(maxHp, Math.max(1, clampInt(hp ?? maxHp, 1, maxHp, maxHp))),
    mp: Math.min(maxMp, Math.max(0, clampInt(mp ?? maxMp, 0, maxMp, maxMp))),
    maxHp,
    maxMp,
    relics: [],
    modifiers: defaultModifiers(),
    currentChoices: [],
    pendingRelicChoices: [],
    rewardPool: { xp: 0, coins: 0, items: {}, gearChanceBonus: 0 },
    log: [`${getRpgDungeonThemeConfig(theme).label} 테마 던전 진입`],
    lastRoomResult: null,
    highRiskTaken: false,
    startedAt,
    updatedAt: startedAt,
    expiresAt,
    revision: 1
  };

  run.currentChoices = generateRpgDungeonRoomChoices({ run, playerLevel, randomInt });
  return run;
}

export function normalizeRpgDungeonRun(run, now = Date.now()) {
  if (!run || typeof run !== 'object' || !['active', 'awaiting_relic'].includes(run.state)) {
    return null;
  }

  const expiresAt = clampInt(run.expiresAt, 0, Number.MAX_SAFE_INTEGER, 0);
  if (expiresAt > 0 && now !== Number.MAX_SAFE_INTEGER && expiresAt <= now) return null;

  let area;
  try {
    area = normalizeRpgArea(run.area);
  } catch {
    return null;
  }

  const theme = THEME_FAMILIES[run.theme] ? run.theme : getRpgDungeonRunTheme(area);
  const maxFloors = clampInt(run.maxFloors, 3, 5, 3);
  const maxHp = clampInt(run.maxHp, 1, 999_999, 1);
  const maxMp = clampInt(run.maxMp, 0, 999_999, 0);

  return {
    id: token(run.id) || `dr_${Math.max(1, clampInt(run.startedAt, 1, Number.MAX_SAFE_INTEGER, now)).toString(36)}`,
    dungeonId: typeof run.dungeonId === 'string' && run.dungeonId ? run.dungeonId : null,
    area,
    theme,
    state: run.state,
    floor: clampInt(run.floor, 1, maxFloors, 1),
    maxFloors,
    hp: clampInt(run.hp, 0, maxHp, maxHp),
    mp: clampInt(run.mp, 0, maxMp, maxMp),
    maxHp,
    maxMp,
    relics: normalizeRelics(run.relics),
    modifiers: normalizeModifiers(run.modifiers),
    currentChoices: normalizeChoices(run.currentChoices),
    pendingRelicChoices: normalizeRelics(run.pendingRelicChoices),
    rewardPool: normalizeRewardPool(run.rewardPool),
    log: normalizeLog(run.log),
    lastRoomResult: normalizeRoomResult(run.lastRoomResult),
    highRiskTaken: Boolean(run.highRiskTaken),
    startedAt: clampInt(run.startedAt, 0, Number.MAX_SAFE_INTEGER, now),
    updatedAt: clampInt(run.updatedAt, 0, Number.MAX_SAFE_INTEGER, now),
    expiresAt,
    revision: clampInt(run.revision, 1, Number.MAX_SAFE_INTEGER, 1)
  };
}

export function generateRpgDungeonRoomChoices({ run, playerLevel = 1, randomInt = defaultRandomInt } = {}) {
  const safeRun = normalizeRpgDungeonRun({ ...run, state: run?.state ?? 'active' }, Number.MAX_SAFE_INTEGER) ?? run;
  const theme = getRpgDungeonThemeConfig(safeRun?.theme);
  const floor = clampInt(safeRun?.floor, 1, 5, 1);
  const maxFloors = clampInt(safeRun?.maxFloors, 3, 5, 3);
  const revision = clampInt(safeRun?.revision, 1, 9999, 1);
  const suffix = `${floor}_${revision}`;
  void playerLevel;

  if (floor >= maxFloors) {
    return [
      room(`b_${suffix}`, 'boss', theme.boss, '최종방 클리어에 도전', 'normal'),
      room(`x_${suffix}`, 'cursed_boss', `☠️ 금지된 ${theme.boss}`, '큰 보상, 큰 피해', 'high')
    ];
  }

  const noun = theme.roomNouns[randomInt(0, theme.roomNouns.length - 1)];
  const highType = (safeRun?.modifiers?.cursedChoiceBonus ?? 0) > 0 || randomInt(1, 2) === 2
    ? 'cursed'
    : 'elite';
  const optional = randomInt(1, 2) === 1 ? 'trap' : 'treasure';

  return [
    room(`c_${suffix}`, 'combat', `${noun} · ${theme.combat}`, '안정적인 전투', 'normal'),
    room(
      `t_${suffix}`,
      optional,
      optional === 'trap' ? theme.trap : theme.treasure,
      optional === 'trap' ? '피해 위험, 추가 보상' : '보상 위주 선택',
      'normal'
    ),
    room(
      `h_${suffix}`,
      highType,
      highType === 'cursed' ? `☠️ ${theme.trap}` : `🔥 ${theme.elite}`,
      '고위험 · 보상 증가',
      'high'
    ),
    room(`r_${suffix}`, 'rest', theme.rest, 'HP/MP 회복', 'safe')
  ];
}

export function resolveRpgDungeonRoom({
  run,
  choiceId,
  playerLevel = 1,
  derivedStats = {},
  randomInt = defaultRandomInt,
  now = Date.now()
} = {}) {
  const current = normalizeRpgDungeonRun(run, Number.MAX_SAFE_INTEGER);
  if (!current || current.state !== 'active') throw new Error('진행 중인 던전 방 선택이 없습니다.');

  const choice = current.currentChoices.find((candidate) => candidate.id === choiceId);
  if (!choice) throw new Error('이미 지나간 던전 선택지입니다. `/rpg 던전`으로 현재 방을 다시 열어주세요.');

  const next = cloneRun(current);
  const theme = getRpgDungeonThemeConfig(next.theme);
  const level = Math.max(1, Number(playerLevel) || 1);
  const attack = Math.max(1, Number(derivedStats.attack) || level + 5);
  const defense = Math.max(0, Number(derivedStats.defense) || 0);
  const high = choice.risk === 'high';
  const final = ['boss', 'cursed_boss'].includes(choice.type);
  const riskReward = high ? 1.45 + (next.modifiers.highRiskRewardMultiplier ?? 0) : 1;
  const rewardMult = Math.max(0.25, 1 + (next.modifiers.rewardMultiplier ?? 0));
  const damageMult = Math.max(0.25, 1 + (next.modifiers.damageMultiplier ?? 0));
  const trapMult = Math.max(0.25, 1 + (next.modifiers.trapDamageMultiplier ?? 0));
  const attackMult = Math.max(0.25, 1 + (next.modifiers.attackMultiplier ?? 0));
  const reward = { xp: 0, coins: 0 };

  let damage = Math.max(0, next.modifiers.roomDamageBonus ?? 0);
  let hpRecovered = 0;
  let mpRecovered = 0;
  let description = '';

  if (choice.type === 'rest') {
    hpRecovered = Math.max(
      5,
      Math.floor(next.maxHp * 0.22 * Math.max(0.25, 1 + (next.modifiers.healingMultiplier ?? 0)))
    );
    mpRecovered = Math.max(3, Math.floor(next.maxMp * 0.2));
    description = `${theme.rest}에서 숨을 고르고 다음 방을 준비했습니다.`;
  } else if (choice.type === 'treasure') {
    reward.xp = Math.floor((28 + level * 2 + next.floor * 16) * rewardMult);
    reward.coins = Math.floor((60 + level * 4 + next.floor * 25) * rewardMult);
    description = `${theme.treasure}에서 쓸 만한 전리품을 챙겼습니다.`;
  } else if (choice.type === 'trap') {
    damage += Math.max(
      1,
      Math.floor((randomInt(10, 20) + next.floor * 4 - defense * 0.25) * damageMult * trapMult)
    );
    const trapReward = Math.max(1, 1 + (next.modifiers.trapRewardMultiplier ?? 0));
    reward.xp = Math.floor((35 + next.floor * 12) * trapReward * rewardMult);
    reward.coins = Math.floor((45 + next.floor * 18) * trapReward * rewardMult);
    description = `${theme.trap}을 버티고 숨겨진 보상을 회수했습니다.`;
  } else {
    const enemyPower = randomInt(8, 16) + next.floor * 6 + Math.floor(level * (final ? 0.8 : 0.35));
    const pressure = Math.max(0, enemyPower - attack * attackMult * 0.35);
    const baseDamage = Math.max(1, Math.floor((pressure + randomInt(4, 12) - defense * 0.15) * damageMult));
    damage += Math.floor(baseDamage * (high ? 1.35 : 1) * (final ? 1.25 : 1));

    const baseXp = (final ? 150 : choice.type === 'elite' ? 95 : choice.type === 'cursed' ? 110 : 60)
      + level * 3
      + next.floor * 24;
    const baseCoins = (final ? 220 : choice.type === 'elite' ? 145 : choice.type === 'cursed' ? 170 : 85)
      + level * 5
      + next.floor * 35;
    reward.xp = Math.floor(baseXp * rewardMult * riskReward);
    reward.coins = Math.floor(baseCoins * rewardMult * riskReward);
    description = high
      ? `${choice.label.replace(/^☠️ |^🔥 /, '')}을 돌파했지만 대가도 컸습니다.`
      : `${choice.label} 전투를 정리했습니다.`;
  }

  next.highRiskTaken ||= high;
  next.hp = Math.max(0, Math.min(next.maxHp, next.hp - damage + hpRecovered));
  next.mp = Math.max(0, Math.min(next.maxMp, next.mp - (choice.type === 'rest' ? 0 : 2) + mpRecovered));
  next.rewardPool.xp += Math.max(0, reward.xp);
  next.rewardPool.coins += Math.max(0, reward.coins);
  next.log = [formatRoomLog(next, choice, damage, reward), ...next.log].slice(0, 3);
  next.lastRoomResult = {
    choiceId: choice.id,
    type: choice.type,
    label: choice.label,
    risk: choice.risk,
    description,
    damageTaken: damage,
    hpRecovered,
    mpRecovered,
    rewards: reward
  };
  next.updatedAt = now;
  next.revision += 1;

  if (next.hp <= 0) {
    next.state = 'failed';
    next.currentChoices = [];
    next.pendingRelicChoices = [];
    return { run: next, choice, roomResult: next.lastRoomResult };
  }

  if (final) {
    next.state = 'cleared';
    next.currentChoices = [];
    next.pendingRelicChoices = [];
    return { run: next, choice, roomResult: next.lastRoomResult };
  }

  next.state = 'awaiting_relic';
  next.currentChoices = [];
  next.pendingRelicChoices = generateRpgDungeonRelicChoices({ run: next, randomInt });
  return { run: next, choice, roomResult: next.lastRoomResult };
}

export function generateRpgDungeonRelicChoices({ run, randomInt = defaultRandomInt } = {}) {
  const current = normalizeRpgDungeonRun(run, Number.MAX_SAFE_INTEGER) ?? run;
  const theme = current?.theme ?? 'forest';
  const owned = new Set((current?.relics ?? []).map((relic) => relic.id));
  const sorted = Object.entries(RPG_DUNGEON_RELICS)
    .filter(([id]) => !owned.has(id))
    .sort(([, a], [, b]) => (
      (a.theme === theme ? 0 : 1) - (b.theme === theme ? 0 : 1)
        || a.label.localeCompare(b.label, 'ko-KR')
    ));
  const count = Math.min(4, Math.max(2, 3 + clampInt(current?.modifiers?.relicChoiceBonus, 0, 1, 0)));
  const offset = sorted.length > 0 ? randomInt(0, sorted.length - 1) : 0;

  return [...sorted.slice(offset), ...sorted.slice(0, offset)]
    .slice(0, count)
    .map(([id, relic]) => ({
      id,
      label: relic.label,
      theme: relic.theme,
      upside: relic.upside,
      downside: relic.downside,
      modifiers: normalizeModifiers(relic.modifiers)
    }));
}

export function applyRpgDungeonRelicChoice({
  run,
  relicId,
  playerLevel = 1,
  randomInt = defaultRandomInt,
  now = Date.now()
} = {}) {
  const current = normalizeRpgDungeonRun(run, Number.MAX_SAFE_INTEGER);
  if (!current || current.state !== 'awaiting_relic') throw new Error('선택할 던전 유물이 없습니다.');

  const relic = current.pendingRelicChoices.find((candidate) => candidate.id === relicId);
  if (!relic) throw new Error('이미 지나간 유물 선택지입니다. `/rpg 던전`으로 현재 선택을 다시 열어주세요.');

  const next = cloneRun(current);
  next.relics = [...next.relics, relic].slice(0, 8);
  next.modifiers = mergeModifiers(next.modifiers, relic.modifiers);
  next.maxHp = Math.max(1, Math.floor(next.maxHp * Math.max(0.5, 1 + (relic.modifiers?.maxHpMultiplier ?? 0))));
  next.hp = Math.min(next.hp, next.maxHp);
  next.floor = Math.min(next.maxFloors, next.floor + 1);
  next.state = 'active';
  next.pendingRelicChoices = [];
  next.currentChoices = generateRpgDungeonRoomChoices({ run: next, playerLevel, randomInt });
  next.log = [`유물 ${relic.label} 획득`, ...next.log].slice(0, 3);
  next.updatedAt = now;
  next.revision += 1;

  return { run: next, relic };
}

function room(id, type, label, description, risk = 'normal') {
  return { id, type, label, description, risk, highRisk: risk === 'high' };
}

function formatRoomLog(run, choice, damage, reward) {
  const rewardText = reward.xp || reward.coins
    ? ` · 보상 +${reward.xp}XP/+${reward.coins}G`
    : '';
  return `${run.floor}방 ${choice.label}: ${damage ? `피해 ${damage}` : '피해 없음'}${rewardText}`;
}

function defaultRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function defaultModifiers() {
  return {
    attackMultiplier: 0,
    damageMultiplier: 0,
    healingMultiplier: 0,
    rewardMultiplier: 0,
    highRiskRewardMultiplier: 0,
    trapRewardMultiplier: 0,
    trapDamageMultiplier: 0,
    maxHpMultiplier: 0,
    roomDamageBonus: 0,
    relicChoiceBonus: 0,
    cursedChoiceBonus: 0
  };
}

function clampInt(value, min, max, fallback = min) {
  const n = Number(value);
  return Number.isSafeInteger(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function token(value) {
  const t = String(value ?? '').trim();
  return /^[a-zA-Z0-9_-]{1,48}$/.test(t) ? t : null;
}

function normalizeModifiers(modifiers = {}) {
  const defaults = defaultModifiers();
  const source = modifiers && typeof modifiers === 'object' ? modifiers : {};
  return Object.fromEntries(Object.keys(defaults).map((key) => [key, num(source[key], defaults[key])]));
}

function mergeModifiers(current = {}, addition = {}) {
  const next = normalizeModifiers(current);
  const source = addition && typeof addition === 'object' ? addition : {};
  for (const key of Object.keys(next)) next[key] += num(source[key], 0);
  return next;
}

function normalizeRewardPool(pool = {}) {
  const source = pool && typeof pool === 'object' ? pool : {};
  return {
    xp: clampInt(source.xp, 0, Number.MAX_SAFE_INTEGER, 0),
    coins: clampInt(source.coins, 0, Number.MAX_SAFE_INTEGER, 0),
    items: source.items && typeof source.items === 'object' ? { ...source.items } : {},
    gearChanceBonus: num(source.gearChanceBonus, 0)
  };
}

function normalizeChoices(choices = []) {
  if (!Array.isArray(choices)) return [];

  return choices
    .map((choice) => {
      if (!choice || typeof choice !== 'object' || !token(choice.id)) return null;
      return {
        id: choice.id,
        type: String(choice.type ?? 'combat'),
        label: String(choice.label ?? '던전 방').slice(0, 80),
        description: String(choice.description ?? '').slice(0, 120),
        risk: normalizeRisk(choice.risk),
        highRisk: Boolean(choice.highRisk || choice.risk === 'high')
      };
    })
    .filter(Boolean)
    .slice(0, 4);
}

function normalizeRelics(relics = []) {
  if (!Array.isArray(relics)) return [];

  return relics
    .map((relic) => {
      if (!relic || typeof relic !== 'object' || !token(relic.id)) return null;
      return {
        id: relic.id,
        label: String(relic.label ?? relic.id).slice(0, 80),
        theme: THEME_FAMILIES[relic.theme] ? relic.theme : 'forest',
        upside: String(relic.upside ?? '').slice(0, 120),
        downside: String(relic.downside ?? '').slice(0, 120),
        modifiers: normalizeModifiers(relic.modifiers)
      };
    })
    .filter(Boolean)
    .slice(0, 8);
}

function normalizeRisk(risk) {
  if (risk === 'high') return 'high';
  if (risk === 'safe') return 'safe';
  return 'normal';
}

function normalizeLog(log = []) {
  if (!Array.isArray(log)) return [];
  return log.map((entry) => String(entry ?? '').slice(0, 140)).filter(Boolean).slice(0, 3);
}

function normalizeRoomResult(result) {
  if (!result || typeof result !== 'object') return null;

  return {
    choiceId: token(result.choiceId),
    type: String(result.type ?? 'room'),
    label: String(result.label ?? '던전 방').slice(0, 80),
    risk: normalizeRisk(result.risk),
    description: String(result.description ?? '').slice(0, 160),
    damageTaken: clampInt(result.damageTaken, 0, 999_999, 0),
    hpRecovered: clampInt(result.hpRecovered, 0, 999_999, 0),
    mpRecovered: clampInt(result.mpRecovered, 0, 999_999, 0),
    rewards: {
      xp: clampInt(result.rewards?.xp, 0, Number.MAX_SAFE_INTEGER, 0),
      coins: clampInt(result.rewards?.coins, 0, Number.MAX_SAFE_INTEGER, 0)
    }
  };
}

function cloneRun(run) {
  return {
    ...run,
    relics: normalizeRelics(run.relics),
    modifiers: normalizeModifiers(run.modifiers),
    currentChoices: normalizeChoices(run.currentChoices),
    pendingRelicChoices: normalizeRelics(run.pendingRelicChoices),
    rewardPool: normalizeRewardPool(run.rewardPool),
    log: normalizeLog(run.log),
    lastRoomResult: normalizeRoomResult(run.lastRoomResult)
  };
}
