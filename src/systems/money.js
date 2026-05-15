const MONEY_PATTERN = /^\d+$/;
const KOREAN_MONEY_UNITS = Object.freeze(new Map([
  ['만', 10_000n],
  ['억', 100_000_000n],
  ['조', 1_000_000_000_000n],
  ['경', 10_000_000_000_000_000n],
  ['해', 10n ** 20n],
  ['자', 10n ** 24n],
  ['양', 10n ** 28n],
  ['구', 10n ** 32n],
  ['간', 10n ** 36n],
  ['정', 10n ** 40n],
  ['재', 10n ** 44n],
  ['극', 10n ** 48n],
  ['항하사', 10n ** 52n],
  ['아승기', 10n ** 56n],
  ['나유타', 10n ** 60n],
  ['불가사의', 10n ** 64n],
  ['무량대수', 10n ** 68n]
]));
const KOREAN_MONEY_UNIT_NAMES = Object.freeze(
  [...KOREAN_MONEY_UNITS.keys()].sort((left, right) => right.length - left.length)
);
const KOREAN_MONEY_UNIT_PATTERN = /(?:무량대수|불가사의|나유타|아승기|항하사|[만억조경해자양구간정재극])/u;

export function toMoney(value, label = '금액') {
  if (typeof value === 'bigint') {
    if (value < 0n) throw new Error(`${label}은 0 이상의 정수여야 합니다.`);
    return value;
  }

  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`${label}은 0 이상의 정수여야 합니다.`);
    }
    return BigInt(value);
  }

  if (typeof value === 'string') {
    return parseMoneyString(value, label);
  }

  throw createMoneyError(label);
}

export function normalizeStoredMoney(value, fallback = 0) {
  try {
    return toMoney(value).toString();
  } catch {
    return fallback;
  }
}

export function toMoneyString(value, label = '금액') {
  return toMoney(value, label).toString();
}

export function addMoney(...values) {
  return values.reduce((sum, value) => sum + toMoney(value), 0n);
}

export function subtractMoney(left, right, label = '금액') {
  const result = toMoney(left, label) - toMoney(right, label);
  if (result < 0n) {
    throw new Error(`${label}은 0 미만이 될 수 없습니다.`);
  }
  return result;
}

export function multiplyMoneyFloor(amount, numerator, denominator = 1n, label = '금액') {
  const safeAmount = toMoney(amount, label);
  const safeNumerator = toPositiveBigInt(numerator, '배율 분자');
  const safeDenominator = toPositiveBigInt(denominator, '배율 분모');
  return (safeAmount * safeNumerator) / safeDenominator;
}

export function divideMoneyFloor(amount, divisor, label = '금액') {
  return toMoney(amount, label) / toPositiveBigInt(divisor, '나눗수');
}

export function compareMoney(left, right) {
  const a = toMoney(left);
  const b = toMoney(right);
  return a > b ? 1 : a < b ? -1 : 0;
}

export function minMoney(...values) {
  if (values.length === 0) return 0n;
  return values.map((value) => toMoney(value)).reduce((min, value) => value < min ? value : min);
}

export function maxMoney(...values) {
  if (values.length === 0) return 0n;
  return values.map((value) => toMoney(value)).reduce((max, value) => value > max ? value : max);
}

export function isZeroMoney(value) {
  return toMoney(value) === 0n;
}

export function isPositiveMoney(value) {
  return toMoney(value) > 0n;
}

export function formatMoney(value, { unit = '' } = {}) {
  const text = toMoney(value).toString();
  const grouped = text.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${grouped}${unit}`;
}

export function toSafeProjectionNumber(value) {
  const money = toMoney(value);
  if (money > BigInt(Number.MAX_SAFE_INTEGER)) return Number.MAX_SAFE_INTEGER;
  return Number(money);
}

export function toCompatibleMoneyValue(value) {
  const money = toMoney(value);
  if (money <= BigInt(Number.MAX_SAFE_INTEGER)) return Number(money);
  return money.toString();
}

function toPositiveBigInt(value, label) {
  const normalized = toMoney(value, label);
  if (normalized <= 0n) throw new Error(`${label}은 1 이상의 정수여야 합니다.`);
  return normalized;
}

function parseMoneyString(value, label) {
  const normalized = value.trim().replace(/[,\s]/gu, '');

  if (MONEY_PATTERN.test(normalized)) {
    return BigInt(normalized);
  }

  if (!KOREAN_MONEY_UNIT_PATTERN.test(normalized)) {
    throw createMoneyError(label);
  }

  let index = 0;
  let total = 0n;

  while (index < normalized.length) {
    const digitMatch = /^\d+/u.exec(normalized.slice(index));
    if (!digitMatch) {
      throw createMoneyError(label);
    }

    const digits = digitMatch[0];
    index += digits.length;
    const unit = matchKoreanMoneyUnitAt(normalized, index);
    const multiplier = unit ? KOREAN_MONEY_UNITS.get(unit) : 1n;
    if (!multiplier) {
      throw createMoneyError(label);
    }

    total += BigInt(digits) * multiplier;
    index += unit?.length ?? 0;
  }

  return total;
}

function matchKoreanMoneyUnitAt(value, index) {
  for (const unit of KOREAN_MONEY_UNIT_NAMES) {
    if (value.startsWith(unit, index)) return unit;
  }
  return '';
}

function createMoneyError(label) {
  return new Error(`${label}은 0 이상의 정수여야 합니다.`);
}
