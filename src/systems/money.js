const MONEY_PATTERN = /^\d+$/;

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
    const text = value.trim();
    if (!MONEY_PATTERN.test(text)) {
      throw new Error(`${label}은 0 이상의 정수여야 합니다.`);
    }
    return BigInt(text);
  }

  throw new Error(`${label}은 0 이상의 정수여야 합니다.`);
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
