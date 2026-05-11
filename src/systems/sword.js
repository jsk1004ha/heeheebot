export const MAX_SWORD_LEVEL = 100;
export const MAX_ADVANCED_SWORD_LEVEL = 90;
export const DAILY_SWORD_GIFT_STONES = 3;
export const MAX_DAILY_SWORD_BATTLES = 10;
export const MAX_DAILY_SWORD_BATTLE_STONES = 3;
export const SWORD_DESTRUCTION_SUCCESS_BONUS_MIN_BASIS_POINTS = 100;
export const SWORD_DESTRUCTION_SUCCESS_BONUS_MAX_BASIS_POINTS = 500;
export const SWORD_DESTRUCTION_SUCCESS_BONUS_DURATION_MS = 2 * 60 * 1000;
const MAX_ADVANCED_LEVEL_GAIN = 5;

const NORMAL_ENHANCE_BANDS = Object.freeze([
  band(0, 4, 95, 5, 0, 100),
  band(5, 9, 93, 7, 0, 150),
  band(10, 14, 90, 10, 0, 220),
  band(15, 19, 88, 10, 2, 320),
  band(20, 24, 84, 11, 5, 460),
  band(25, 29, 78, 12, 10, 650),
  band(30, 34, 75, 15, 10, 900),
  band(35, 39, 70, 20, 10, 1_200),
  band(40, 44, 62, 28, 10, 1_600),
  band(45, 49, 55, 35, 10, 2_100),
  band(50, 54, 45, 45, 10, 2_700),
  band(55, 59, 38, 52, 10, 3_400),
  band(60, 64, 34, 56, 10, 4_200),
  band(65, 69, 30, 60, 10, 5_100),
  band(70, 74, 25, 65, 10, 6_200),
  band(75, 79, 20, 70, 10, 7_400),
  band(80, 84, 16, 74, 10, 8_700),
  band(85, 89, 12, 78, 10, 10_100),
  band(90, 94, 8, 82, 10, 11_600),
  band(95, 99, 5, 84, 11, 13_200)
]);

const ADVANCED_STONE_COSTS = Object.freeze([
  { min: 0, max: 29, stoneCost: 1 },
  { min: 30, max: 49, stoneCost: 2 },
  { min: 50, max: 69, stoneCost: 3 },
  { min: 70, max: 89, stoneCost: 5 },
  { min: 90, max: 90, stoneCost: 8 }
]);

export function getSwordEnhanceConfig(level) {
  const normalizedLevel = normalizeSwordLevel(level);

  if (normalizedLevel >= MAX_SWORD_LEVEL) {
    return blockedConfig(normalizedLevel, '일반 강화');
  }

  const config = NORMAL_ENHANCE_BANDS.find((entry) =>
    normalizedLevel >= entry.min && normalizedLevel <= entry.max
  );

  return {
    ...config,
    level: normalizedLevel,
    targetLevel: normalizedLevel + 1,
    mode: 'normal',
    modeLabel: '일반 강화',
    blocked: false,
    stoneCost: 0
  };
}

export function getAdvancedSwordEnhanceConfig(level) {
  const normalizedLevel = normalizeSwordLevel(level);

  if (normalizedLevel > MAX_ADVANCED_SWORD_LEVEL || normalizedLevel >= MAX_SWORD_LEVEL) {
    return blockedConfig(normalizedLevel, '상급 강화');
  }

  const normalConfig = getSwordEnhanceConfig(normalizedLevel);
  const boostedSuccessRate = Math.min(95, normalConfig.successRate + 15);
  const successRate = Math.max(normalConfig.successRate, boostedSuccessRate);
  const stoneCost = ADVANCED_STONE_COSTS.find((entry) =>
    normalizedLevel >= entry.min && normalizedLevel <= entry.max
  )?.stoneCost ?? 8;

  return {
    min: normalConfig.min,
    max: normalConfig.max,
    level: normalizedLevel,
    targetLevel: normalizedLevel + 1,
    maxTargetLevel: Math.min(MAX_SWORD_LEVEL, normalizedLevel + MAX_ADVANCED_LEVEL_GAIN),
    maxLevelGain: MAX_ADVANCED_LEVEL_GAIN,
    mode: 'advanced',
    modeLabel: '상급 강화',
    blocked: false,
    successRate,
    maintainRate: 100 - successRate,
    destroyRate: 0,
    moneyCost: Math.ceil(normalConfig.moneyCost * 1.25),
    stoneCost
  };
}

export function resolveSwordEnhancement({
  level,
  mode = 'normal',
  randomInt = defaultRandomInt,
  successBonusRate = 0
} = {}) {
  const baseConfig = mode === 'advanced'
    ? getAdvancedSwordEnhanceConfig(level)
    : getSwordEnhanceConfig(level);
  const config = applySwordSuccessBonus(baseConfig, successBonusRate);

  if (config.blocked) {
    throw new Error(config.reason);
  }

  const beforeLevel = config.level;
  const roll = randomInt(1, 100);
  let outcome = 'maintain';
  let afterLevel = beforeLevel;
  let levelGain = 0;
  let refineStoneReward = 0;

  if (roll <= config.successRate) {
    outcome = 'success';
    const requestedLevelGain = config.mode === 'advanced'
      ? rollAdvancedLevelGain(randomInt)
      : 1;
    afterLevel = Math.min(MAX_SWORD_LEVEL, beforeLevel + requestedLevelGain);
    levelGain = Math.max(0, afterLevel - beforeLevel);
  } else if (roll > config.successRate + config.maintainRate && config.destroyRate > 0) {
    outcome = 'destroy';
    afterLevel = 0;
    refineStoneReward = getSwordDestructionCompensation(beforeLevel);
  }

  return {
    ...config,
    beforeLevel,
    afterLevel,
    levelGain,
    roll,
    outcome,
    outcomeLabel: getSwordOutcomeLabel(outcome),
    refineStoneReward
  };
}

export function applySwordSuccessBonus(config, bonusRate = 0) {
  if (!config || config.blocked) return config;

  const baseSuccessRate = normalizeRate(config.successRate);
  const baseMaintainRate = normalizeRate(config.maintainRate);
  const baseDestroyRate = normalizeRate(config.destroyRate);
  const requestedBonusRate = Math.max(0, Number(bonusRate) || 0);
  const maxBonusRate = Math.min(99 - baseSuccessRate, baseMaintainRate + baseDestroyRate);
  const successBonusRate = Math.max(0, Math.min(requestedBonusRate, maxBonusRate));
  const maintainReduction = Math.min(baseMaintainRate, successBonusRate);
  const destroyReduction = Math.max(0, successBonusRate - maintainReduction);

  return {
    ...config,
    baseSuccessRate,
    baseMaintainRate,
    baseDestroyRate,
    successBonusRate,
    successRate: baseSuccessRate + successBonusRate,
    maintainRate: baseMaintainRate - maintainReduction,
    destroyRate: baseDestroyRate - destroyReduction
  };
}

function rollAdvancedLevelGain(randomInt) {
  const bonusRoll = randomInt(1, 100);
  if (bonusRoll <= 2) return 5;
  if (bonusRoll <= 6) return 4;
  if (bonusRoll <= 14) return 3;
  if (bonusRoll <= 30) return 2;
  return 1;
}

export function resolveSwordBattle({ challengerProfile, opponentProfile, randomInt = defaultRandomInt } = {}) {
  const challengerRoll = randomInt(1, 20);
  const opponentRoll = randomInt(1, 20);
  const challengerSwordLevel = normalizeSwordLevel(challengerProfile?.sword?.level ?? 0);
  const opponentSwordLevel = normalizeSwordLevel(opponentProfile?.sword?.level ?? 0);
  const challengerLevel = Math.max(1, Number(challengerProfile?.level) || 1);
  const opponentLevel = Math.max(1, Number(opponentProfile?.level) || 1);
  const challengerPower = getSwordBattlePower({
    profileLevel: challengerLevel,
    swordLevel: challengerSwordLevel,
    roll: challengerRoll
  });
  const opponentPower = getSwordBattlePower({
    profileLevel: opponentLevel,
    swordLevel: opponentSwordLevel,
    roll: opponentRoll
  });
  const winnerSide = decideSwordBattleWinner({
    challengerPower,
    opponentPower,
    challengerSwordLevel,
    opponentSwordLevel,
    randomInt
  });
  const winnerProfile = winnerSide === 'challenger' ? challengerProfile : opponentProfile;
  const loserProfile = winnerSide === 'challenger' ? opponentProfile : challengerProfile;
  const rewards = getSwordBattleRewards({
    winnerSwordLevel: winnerProfile?.sword?.level ?? 0,
    loserSwordLevel: loserProfile?.sword?.level ?? 0
  });

  return {
    challenger: {
      userId: challengerProfile?.userId,
      username: challengerProfile?.username ?? '도전자',
      level: challengerLevel,
      swordLevel: challengerSwordLevel,
      roll: challengerRoll,
      power: challengerPower
    },
    opponent: {
      userId: opponentProfile?.userId,
      username: opponentProfile?.username ?? '상대',
      level: opponentLevel,
      swordLevel: opponentSwordLevel,
      roll: opponentRoll,
      power: opponentPower,
      npc: Boolean(opponentProfile?.npc)
    },
    winnerSide,
    loserSide: winnerSide === 'challenger' ? 'opponent' : 'challenger',
    rewards
  };
}

export function getSwordBattleRewards({ winnerSwordLevel = 0, loserSwordLevel = 0 } = {}) {
  const normalizedWinnerLevel = normalizeSwordLevel(winnerSwordLevel);
  const normalizedLoserLevel = normalizeSwordLevel(loserSwordLevel);

  return {
    xp: 50 + normalizedWinnerLevel * 5,
    money: 200 + normalizedWinnerLevel * 30 + normalizedLoserLevel * 10,
    refineStones: 1
  };
}

export function getSwordOutcomeLabel(outcome) {
  return {
    success: '강화',
    maintain: '유지',
    destroy: '파괴',
    protect: '보호'
  }[outcome] ?? outcome;
}

export function normalizeSwordLevel(level) {
  return clampInteger(level, 0, MAX_SWORD_LEVEL);
}

export function getSwordDestructionCompensation(level) {
  const normalizedLevel = normalizeSwordLevel(level);
  return normalizedLevel >= 20 ? Math.max(1, Math.floor(normalizedLevel / 20)) : 0;
}

export function getSwordSellValue(level) {
  const normalizedLevel = normalizeSwordLevel(level);
  if (normalizedLevel <= 0) return 0;

  let investedMoney = 0;
  for (let currentLevel = 0; currentLevel < normalizedLevel; currentLevel += 1) {
    const config = getSwordEnhanceConfig(currentLevel);
    if (!config.blocked) {
      investedMoney += config.moneyCost;
    }
  }

  return Math.max(1, Math.floor(investedMoney * 0.6));
}

function band(min, max, successRate, maintainRate, destroyRate, moneyCost) {
  return Object.freeze({
    min,
    max,
    successRate,
    maintainRate,
    destroyRate,
    moneyCost
  });
}

function blockedConfig(level, modeLabel) {
  return {
    level,
    targetLevel: level,
    modeLabel,
    blocked: true,
    successRate: 0,
    maintainRate: 0,
    destroyRate: 0,
    moneyCost: 0,
    stoneCost: 0,
    reason: level >= MAX_SWORD_LEVEL
      ? '검은 이미 최대 강화(+100)입니다.'
      : '상급 강화는 +90 이하에서만 시도할 수 있습니다.'
  };
}

function getSwordBattlePower({ profileLevel, swordLevel, roll }) {
  return profileLevel * 2 + swordLevel * 3 + roll;
}

function decideSwordBattleWinner({
  challengerPower,
  opponentPower,
  challengerSwordLevel,
  opponentSwordLevel,
  randomInt
}) {
  if (challengerPower > opponentPower) return 'challenger';
  if (opponentPower > challengerPower) return 'opponent';
  if (challengerSwordLevel > opponentSwordLevel) return 'challenger';
  if (opponentSwordLevel > challengerSwordLevel) return 'opponent';
  return randomInt(0, 1) === 0 ? 'challenger' : 'opponent';
}

function clampInteger(value, min, max) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized)) return min;
  return Math.min(max, Math.max(min, normalized));
}

function normalizeRate(value) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) return 0;
  return Math.max(0, normalized);
}

function defaultRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
