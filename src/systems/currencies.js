export const CURRENCY_MAIN = 'main';
export const CURRENCY_CASINO = 'casino';
export const CURRENCY_RPG = 'rpg';
export const CURRENCY_SWORD = 'sword';
export const CURRENCY_STOCK = 'stock';

export const WALLET_CURRENCY_IDS = Object.freeze([
  CURRENCY_CASINO,
  CURRENCY_RPG,
  CURRENCY_SWORD,
  CURRENCY_STOCK
]);

export const CURRENCY_CONFIGS = Object.freeze({
  [CURRENCY_MAIN]: Object.freeze({
    id: CURRENCY_MAIN,
    key: 'balance',
    label: '메인 코인',
    shortLabel: '메인',
    unit: '원',
    mainToCurrencyBps: 10_000,
    cashOutBps: 10_000
  }),
  [CURRENCY_CASINO]: Object.freeze({
    id: CURRENCY_CASINO,
    key: 'casinoChips',
    label: '카지노칩',
    shortLabel: '카지노',
    unit: '칩',
    mainToCurrencyBps: 10_000,
    cashOutBps: 9_000
  }),
  [CURRENCY_RPG]: Object.freeze({
    id: CURRENCY_RPG,
    key: 'rpgGold',
    label: 'RPG 골드',
    shortLabel: 'RPG',
    unit: '골드',
    mainToCurrencyBps: 20_000,
    cashOutBps: 3_000
  }),
  [CURRENCY_SWORD]: Object.freeze({
    id: CURRENCY_SWORD,
    key: 'swordCoins',
    label: '강화 코인',
    shortLabel: '검강화',
    unit: '코인',
    mainToCurrencyBps: 10_000,
    cashOutBps: 5_000
  }),
  [CURRENCY_STOCK]: Object.freeze({
    id: CURRENCY_STOCK,
    key: 'stockCash',
    label: '현금',
    shortLabel: '주식',
    unit: '원',
    mainToCurrencyBps: 10_000,
    cashOutBps: 9_500
  })
});

const CURRENCY_ALIASES = Object.freeze(new Map([
  ['main', CURRENCY_MAIN],
  ['balance', CURRENCY_MAIN],
  ['coin', CURRENCY_MAIN],
  ['coins', CURRENCY_MAIN],
  ['money', CURRENCY_MAIN],
  ['메인', CURRENCY_MAIN],
  ['메인코인', CURRENCY_MAIN],
  ['공용', CURRENCY_MAIN],
  ['원', CURRENCY_MAIN],

  ['casino', CURRENCY_CASINO],
  ['chip', CURRENCY_CASINO],
  ['chips', CURRENCY_CASINO],
  ['casinochips', CURRENCY_CASINO],
  ['카지노', CURRENCY_CASINO],
  ['카지노칩', CURRENCY_CASINO],
  ['칩', CURRENCY_CASINO],

  ['rpg', CURRENCY_RPG],
  ['gold', CURRENCY_RPG],
  ['rpggold', CURRENCY_RPG],
  ['알피지', CURRENCY_RPG],
  ['골드', CURRENCY_RPG],
  ['rpg골드', CURRENCY_RPG],

  ['sword', CURRENCY_SWORD],
  ['swordcoin', CURRENCY_SWORD],
  ['swordcoins', CURRENCY_SWORD],
  ['검', CURRENCY_SWORD],
  ['검강화', CURRENCY_SWORD],
  ['강화', CURRENCY_SWORD],
  ['강화코인', CURRENCY_SWORD],

  ['stock', CURRENCY_STOCK],
  ['stocks', CURRENCY_STOCK],
  ['investment', CURRENCY_STOCK],
  ['cash', CURRENCY_STOCK],
  ['stockcash', CURRENCY_STOCK],
  ['주식', CURRENCY_STOCK],
  ['투자', CURRENCY_STOCK],
  ['예수금', CURRENCY_STOCK],
  ['투자예수금', CURRENCY_STOCK],
  ['현금', CURRENCY_STOCK],
  ['주식현금', CURRENCY_STOCK]
]));

export function getCurrencyChoices() {
  return Object.values(CURRENCY_CONFIGS).map((currency) => ({
    name: `${currency.shortLabel} · ${currency.label}`,
    value: currency.id
  }));
}

export function normalizeCurrencyId(currencyId) {
  const key = normalizeCurrencyKey(currencyId);
  const matched = CURRENCY_ALIASES.get(key) ?? CURRENCY_CONFIGS[key]?.id;
  if (!matched) {
    throw new Error('알 수 없는 재화입니다. 메인, 카지노, RPG, 검강화, 주식 중 하나를 선택하세요.');
  }
  return matched;
}

export function getCurrencyConfig(currencyId) {
  return CURRENCY_CONFIGS[normalizeCurrencyId(currencyId)];
}

export function createDefaultWallets() {
  return Object.fromEntries(WALLET_CURRENCY_IDS.map((currencyId) => [
    CURRENCY_CONFIGS[currencyId].key,
    0
  ]));
}

export function normalizeWallets(wallets = {}) {
  const safeWallets = wallets && typeof wallets === 'object' ? wallets : {};
  return Object.fromEntries(WALLET_CURRENCY_IDS.map((currencyId) => {
    const key = CURRENCY_CONFIGS[currencyId].key;
    return [key, normalizeNonNegativeInteger(safeWallets[key])];
  }));
}

export function cloneWallets(wallets = {}) {
  return { ...normalizeWallets(wallets) };
}

export function ensureProfileWallets(profile) {
  profile.wallets = normalizeWallets(profile.wallets);
  return profile.wallets;
}

export function getCurrencyBalance(profile, currencyId) {
  const normalizedCurrencyId = normalizeCurrencyId(currencyId);
  if (normalizedCurrencyId === CURRENCY_MAIN) {
    return normalizeNonNegativeInteger(profile.balance);
  }

  const wallets = ensureProfileWallets(profile);
  return wallets[CURRENCY_CONFIGS[normalizedCurrencyId].key];
}

export function setCurrencyBalance(profile, currencyId, amount) {
  const normalizedAmount = normalizeNonNegativeInteger(amount);
  const normalizedCurrencyId = normalizeCurrencyId(currencyId);
  if (normalizedCurrencyId === CURRENCY_MAIN) {
    profile.balance = normalizedAmount;
    return profile.balance;
  }

  const wallets = ensureProfileWallets(profile);
  wallets[CURRENCY_CONFIGS[normalizedCurrencyId].key] = normalizedAmount;
  return normalizedAmount;
}

export function creditCurrency(profile, currencyId, amount) {
  const normalizedAmount = normalizeNonNegativeInteger(amount);
  const current = getCurrencyBalance(profile, currencyId);
  return setCurrencyBalance(profile, currencyId, current + normalizedAmount);
}

export function debitCurrency(profile, currencyId, amount, errorMessage = null) {
  const normalizedAmount = normalizePositiveInteger(amount, '금액');
  const current = getCurrencyBalance(profile, currencyId);
  if (current < normalizedAmount) {
    const currency = getCurrencyConfig(currencyId);
    throw new Error(errorMessage ?? `${currency.label}이(가) 부족합니다. 필요 금액: ${formatCurrencyAmount(normalizedAmount, currency.id)}`);
  }

  return setCurrencyBalance(profile, currencyId, current - normalizedAmount);
}

export function exchangeCurrency(profile, { fromCurrency, toCurrency, amount }) {
  const from = getCurrencyConfig(fromCurrency);
  const to = getCurrencyConfig(toCurrency);
  const normalizedAmount = normalizePositiveInteger(amount, '환전 금액');

  if (from.id === to.id) {
    throw new Error('같은 재화끼리는 환전할 수 없습니다.');
  }

  debitCurrency(profile, from.id, normalizedAmount);
  const mainValue = from.id === CURRENCY_MAIN
    ? normalizedAmount
    : Math.floor(normalizedAmount * from.cashOutBps / 10_000);
  const received = to.id === CURRENCY_MAIN
    ? mainValue
    : Math.floor(mainValue * to.mainToCurrencyBps / 10_000);

  if (received <= 0) {
    creditCurrency(profile, from.id, normalizedAmount);
    throw new Error('환전 후 받을 재화가 0입니다. 금액을 더 크게 입력하세요.');
  }

  creditCurrency(profile, to.id, received);

  return {
    from,
    to,
    spent: normalizedAmount,
    received,
    fee: normalizedAmount - mainValue,
    cashOutRateBps: from.id === CURRENCY_MAIN ? 10_000 : from.cashOutBps,
    cashInRateBps: to.id === CURRENCY_MAIN ? 10_000 : to.mainToCurrencyBps,
    mainValue,
    balances: getCurrencyBalances(profile)
  };
}

export function getCurrencyBalances(profile) {
  ensureProfileWallets(profile);
  return {
    [CURRENCY_MAIN]: getCurrencyBalance(profile, CURRENCY_MAIN),
    [CURRENCY_CASINO]: getCurrencyBalance(profile, CURRENCY_CASINO),
    [CURRENCY_RPG]: getCurrencyBalance(profile, CURRENCY_RPG),
    [CURRENCY_SWORD]: getCurrencyBalance(profile, CURRENCY_SWORD),
    [CURRENCY_STOCK]: getCurrencyBalance(profile, CURRENCY_STOCK)
  };
}

export function formatCurrencyAmount(amount, currencyId) {
  const currency = getCurrencyConfig(currencyId);
  return `${normalizeNonNegativeInteger(amount).toLocaleString()}${currency.unit}`;
}

function normalizeCurrencyKey(value) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('ko-KR')
    .replace(/[\s_\-·()]/g, '');
}

function normalizeNonNegativeInteger(value) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.max(0, Math.floor(number))
    : 0;
}

function normalizePositiveInteger(value, label) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) {
    throw new Error(`${label}은(는) 1 이상의 정수여야 합니다.`);
  }
  return number;
}
