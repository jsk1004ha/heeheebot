import {
  addMoney,
  compareMoney,
  formatMoney,
  isPositiveMoney,
  minMoney,
  multiplyMoneyFloor,
  normalizeStoredMoney,
  subtractMoney,
  toCompatibleMoneyValue,
  toMoney,
  toMoneyString
} from './money.js';

export const CURRENCY_MAIN = 'main';
export const CURRENCY_CASINO = 'casino';
export const CURRENCY_RPG = 'rpg';
export const CURRENCY_SWORD = 'sword';
export const CURRENCY_STOCK = 'stock';

export const UNIFIED_GOLD_MIGRATION_VERSION = 1;
export const STOCK_BANKRUPTCY_REPAYMENT_BPS = 2_500;

export const WALLET_CURRENCY_IDS = Object.freeze([
  CURRENCY_CASINO,
  CURRENCY_RPG,
  CURRENCY_SWORD,
  CURRENCY_STOCK
]);

const UNIFIED_GOLD_CONFIG = Object.freeze({
  id: CURRENCY_MAIN,
  key: 'balance',
  label: '골드',
  shortLabel: '골드',
  unit: '골드',
  mainToCurrencyBps: 10_000,
  cashOutBps: 10_000
});

const LEGACY_WALLET_CONFIGS = Object.freeze({
  [CURRENCY_CASINO]: Object.freeze({ key: 'casinoChips', label: '카지노칩', unit: '칩', goldValueBps: 9_000 }),
  [CURRENCY_RPG]: Object.freeze({ key: 'rpgGold', label: 'RPG 골드', unit: '골드', goldValueBps: 3_000 }),
  [CURRENCY_SWORD]: Object.freeze({ key: 'swordCoins', label: '강화 코인', unit: '코인', goldValueBps: 5_000 }),
  [CURRENCY_STOCK]: Object.freeze({ key: 'stockCash', label: '주식 현금', unit: '원', goldValueBps: 9_500 })
});

export const CURRENCY_CONFIGS = Object.freeze({
  [CURRENCY_MAIN]: UNIFIED_GOLD_CONFIG,
  [CURRENCY_CASINO]: createUnifiedLegacyConfig(CURRENCY_CASINO),
  [CURRENCY_RPG]: createUnifiedLegacyConfig(CURRENCY_RPG),
  [CURRENCY_SWORD]: createUnifiedLegacyConfig(CURRENCY_SWORD),
  [CURRENCY_STOCK]: createUnifiedLegacyConfig(CURRENCY_STOCK)
});

const CURRENCY_ALIASES = Object.freeze(new Map([
  ['main', CURRENCY_MAIN],
  ['balance', CURRENCY_MAIN],
  ['coin', CURRENCY_MAIN],
  ['coins', CURRENCY_MAIN],
  ['money', CURRENCY_MAIN],
  ['gold', CURRENCY_MAIN],
  ['메인', CURRENCY_MAIN],
  ['메인코인', CURRENCY_MAIN],
  ['공용', CURRENCY_MAIN],
  ['원', CURRENCY_MAIN],
  ['골드', CURRENCY_MAIN],

  ['casino', CURRENCY_MAIN],
  ['chip', CURRENCY_MAIN],
  ['chips', CURRENCY_MAIN],
  ['casinochips', CURRENCY_MAIN],
  ['카지노', CURRENCY_MAIN],
  ['카지노칩', CURRENCY_MAIN],
  ['칩', CURRENCY_MAIN],

  ['rpg', CURRENCY_MAIN],
  ['rpggold', CURRENCY_MAIN],
  ['알피지', CURRENCY_MAIN],
  ['rpg골드', CURRENCY_MAIN],

  ['sword', CURRENCY_MAIN],
  ['swordcoin', CURRENCY_MAIN],
  ['swordcoins', CURRENCY_MAIN],
  ['검', CURRENCY_MAIN],
  ['검강화', CURRENCY_MAIN],
  ['강화', CURRENCY_MAIN],
  ['강화코인', CURRENCY_MAIN],

  ['stock', CURRENCY_MAIN],
  ['stocks', CURRENCY_MAIN],
  ['investment', CURRENCY_MAIN],
  ['cash', CURRENCY_MAIN],
  ['stockcash', CURRENCY_MAIN],
  ['주식', CURRENCY_MAIN],
  ['투자', CURRENCY_MAIN],
  ['예수금', CURRENCY_MAIN],
  ['투자예수금', CURRENCY_MAIN],
  ['현금', CURRENCY_MAIN],
  ['주식현금', CURRENCY_MAIN]
]));

export function normalizeCurrencyId(currencyId) {
  const key = normalizeCurrencyKey(currencyId);
  const matched = CURRENCY_ALIASES.get(key) ?? CURRENCY_CONFIGS[key]?.id;
  if (!matched) {
    throw new Error('알 수 없는 재화입니다. 현재 모든 재화는 골드 하나로 통합되어 있습니다.');
  }
  return CURRENCY_MAIN;
}

export function getCurrencyConfig(currencyId) {
  normalizeCurrencyId(currencyId);
  return UNIFIED_GOLD_CONFIG;
}

export function createDefaultWallets() {
  return Object.fromEntries(WALLET_CURRENCY_IDS.map((currencyId) => [
    LEGACY_WALLET_CONFIGS[currencyId].key,
    0
  ]));
}

export function normalizeWallets(wallets = {}) {
  const safeWallets = wallets && typeof wallets === 'object' ? wallets : {};
  return Object.fromEntries(WALLET_CURRENCY_IDS.map((currencyId) => {
    const key = LEGACY_WALLET_CONFIGS[currencyId].key;
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

export function migrateLegacyWalletsToGold(profile, { now = Date.now() } = {}) {
  profile.currencyMigration = normalizeCurrencyMigration(profile.currencyMigration);
  if (profile.currencyMigration.unifiedGoldVersion >= UNIFIED_GOLD_MIGRATION_VERSION) {
    profile.wallets = normalizeWallets(profile.wallets);
    return { migrated: false, convertedGold: 0, convertedWallets: createDefaultWallets() };
  }

  const convertedWallets = normalizeWallets(profile.wallets);
  let convertedGold = 0;
  const conversionBreakdown = {};

  for (const currencyId of WALLET_CURRENCY_IDS) {
    const legacy = LEGACY_WALLET_CONFIGS[currencyId];
    const amount = convertedWallets[legacy.key];
    const gold = Math.floor(amount * legacy.goldValueBps / 10_000);
    convertedGold += gold;
    conversionBreakdown[legacy.key] = {
      amount,
      gold,
      goldValueBps: legacy.goldValueBps
    };
  }

  profile.balance = toCompatibleMoneyValue(addMoney(normalizeStoredMoney(profile.balance), convertedGold));
  profile.wallets = createDefaultWallets();
  profile.currencyMigration = {
    ...profile.currencyMigration,
    unifiedGoldVersion: UNIFIED_GOLD_MIGRATION_VERSION,
    unifiedGoldAt: profile.currencyMigration.unifiedGoldAt ?? now,
    convertedGold,
    convertedWallets,
    conversionBreakdown
  };

  return { migrated: true, convertedGold, convertedWallets };
}

export function convertLegacyCurrencyAmountToGold(currencyId, amount) {
  const normalizedAmount = normalizeMoneyValue(amount);
  if (currencyId === CURRENCY_MAIN) return normalizedAmount;

  const legacy = LEGACY_WALLET_CONFIGS[currencyId];
  if (!legacy) {
    throw new Error('알 수 없는 기존 재화입니다.');
  }

  return toCompatibleMoneyValue(multiplyMoneyFloor(normalizedAmount, BigInt(legacy.goldValueBps), 10_000n));
}

export function getCurrencyBalance(profile, currencyId) {
  normalizeCurrencyId(currencyId);
  return normalizeMoneyValue(profile.balance);
}

export function getCurrencyBalanceMoney(profile, currencyId) {
  normalizeCurrencyId(currencyId);
  return toMoney(normalizeStoredMoney(profile.balance));
}

export function setCurrencyBalance(profile, currencyId, amount) {
  normalizeCurrencyId(currencyId);
  const normalizedAmount = normalizeMoneyValue(amount);
  profile.balance = normalizedAmount;
  profile.wallets = normalizeWallets(profile.wallets);
  return profile.balance;
}

export function creditCurrency(profile, currencyId, amount) {
  return creditCurrencyWithReceipt(profile, currencyId, amount).balance;
}

export function creditCurrencyWithReceipt(profile, currencyId, amount) {
  normalizeCurrencyId(currencyId);
  const normalizedAmount = normalizeMoneyValue(amount);
  const repayment = applyStockBankruptcyRepayment(profile, normalizedAmount);
  const current = getCurrencyBalanceMoney(profile, CURRENCY_MAIN);
  const balance = setCurrencyBalance(profile, CURRENCY_MAIN, current + toMoney(repayment.net));
  return {
    gross: normalizedAmount,
    net: repayment.net,
    repayment: repayment.repayment,
    balance,
    bankruptcy: getStockBankruptcySummary(profile)
  };
}

export function debitCurrency(profile, currencyId, amount, errorMessage = null) {
  normalizeCurrencyId(currencyId);
  const normalizedAmount = normalizePositiveMoney(amount, '금액');
  const current = getCurrencyBalanceMoney(profile, CURRENCY_MAIN);
  if (current < normalizedAmount) {
    throw new Error(errorMessage ?? `골드가 부족합니다. 필요 금액: ${formatCurrencyAmount(normalizedAmount, CURRENCY_MAIN)}`);
  }

  return setCurrencyBalance(profile, CURRENCY_MAIN, current - normalizedAmount);
}

export function exchangeCurrency(profile, { fromCurrency, toCurrency, amount }) {
  const normalizedAmount = normalizeMoneyValue(normalizePositiveMoney(amount, '환전 금액'));
  const from = getCurrencyConfig(fromCurrency);
  const to = getCurrencyConfig(toCurrency);

  return {
    from,
    to,
    spent: normalizedAmount,
    received: normalizedAmount,
    fee: 0,
    cashOutRateBps: 10_000,
    cashInRateBps: 10_000,
    mainValue: normalizedAmount,
    unified: true,
    message: '모든 재화가 골드로 통합되어 환전 없이 같은 잔액을 사용합니다.',
    balances: getCurrencyBalances(profile)
  };
}

export function getCurrencyBalances(profile) {
  const gold = getCurrencyBalance(profile, CURRENCY_MAIN);
  ensureProfileWallets(profile);
  return {
    [CURRENCY_MAIN]: gold,
    [CURRENCY_CASINO]: gold,
    [CURRENCY_RPG]: gold,
    [CURRENCY_SWORD]: gold,
    [CURRENCY_STOCK]: gold
  };
}

export function formatCurrencyAmount(amount, currencyId) {
  normalizeCurrencyId(currencyId);
  return `${formatMoney(amount)}골드`;
}

export function getStockBankruptcySummary(profile) {
  const state = ensureStockBankruptcyState(profile);
  return {
    debt: state.debt,
    paid: state.paid,
    count: state.count,
    lastAt: state.lastAt,
    repaymentBps: STOCK_BANKRUPTCY_REPAYMENT_BPS,
    blocked: isPositiveMoney(state.debt)
  };
}

export function addStockBankruptcyDebt(profile, amount, now = Date.now()) {
  const debtAdded = normalizeMoneyValue(amount);
  const state = ensureStockBankruptcyState(profile);
  if (!isPositiveMoney(debtAdded)) return getStockBankruptcySummary(profile);

  state.debt = toCompatibleMoneyValue(addMoney(state.debt, debtAdded));
  state.count += 1;
  state.lastAt = normalizeNonNegativeInteger(now);
  return getStockBankruptcySummary(profile);
}

export function hasStockBankruptcyDebt(profile) {
  return isPositiveMoney(getStockBankruptcySummary(profile).debt);
}

export function repayStockBankruptcyDebt(profile, amount = null) {
  const state = ensureStockBankruptcyState(profile);
  const debtBefore = state.debt;
  const balanceBefore = getCurrencyBalance(profile, CURRENCY_MAIN);
  const requested = amount === null || amount === undefined
    ? debtBefore
    : normalizeMoneyValue(normalizePositiveMoney(amount, '상환 금액'));
  const repaid = toCompatibleMoneyValue(minMoney(debtBefore, balanceBefore, requested));

  if (isPositiveMoney(repaid)) {
    state.debt = toCompatibleMoneyValue(subtractMoney(state.debt, repaid));
    state.paid = toCompatibleMoneyValue(addMoney(state.paid, repaid));
    setCurrencyBalance(profile, CURRENCY_MAIN, subtractMoney(balanceBefore, repaid));
  }

  return {
    requested,
    repaid,
    balanceBefore,
    balance: getCurrencyBalance(profile, CURRENCY_MAIN),
    bankruptcy: getStockBankruptcySummary(profile)
  };
}

function createUnifiedLegacyConfig(currencyId) {
  const legacy = LEGACY_WALLET_CONFIGS[currencyId];
  return Object.freeze({
    ...UNIFIED_GOLD_CONFIG,
    legacyId: currencyId,
    legacyKey: legacy.key,
    legacyLabel: legacy.label,
    legacyUnit: legacy.unit,
    legacyGoldValueBps: legacy.goldValueBps
  });
}

function normalizeCurrencyKey(value) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('ko-KR')
    .replace(/[\s_\-·()]/g, '');
}

function normalizeCurrencyMigration(value = {}) {
  const migration = value && typeof value === 'object' ? value : {};
  return {
    ...migration,
    unifiedGoldVersion: normalizeNonNegativeInteger(migration.unifiedGoldVersion),
    unifiedGoldAt: migration.unifiedGoldAt ?? null
  };
}

function applyStockBankruptcyRepayment(profile, grossIncome) {
  const gross = normalizeMoneyValue(grossIncome);
  if (!isPositiveMoney(gross)) return { gross, repayment: 0, net: 0 };

  const state = ensureStockBankruptcyState(profile);
  if (!isPositiveMoney(state.debt)) return { gross, repayment: 0, net: gross };

  const repayment = toCompatibleMoneyValue(minMoney(
    state.debt,
    gross,
    multiplyMoneyFloor(gross, BigInt(STOCK_BANKRUPTCY_REPAYMENT_BPS), 10_000n)
  ));
  if (!isPositiveMoney(repayment)) return { gross, repayment: 0, net: gross };

  state.debt = toCompatibleMoneyValue(subtractMoney(state.debt, repayment));
  state.paid = toCompatibleMoneyValue(addMoney(state.paid, repayment));
  return { gross, repayment, net: toCompatibleMoneyValue(subtractMoney(gross, repayment)) };
}

function ensureStockBankruptcyState(profile) {
  profile.stockBankruptcy = normalizeStockBankruptcyState(profile.stockBankruptcy);
  return profile.stockBankruptcy;
}

function normalizeStockBankruptcyState(value = {}) {
  const state = value && typeof value === 'object' ? value : {};
  return {
    debt: normalizeMoneyValue(state.debt ?? state.bankruptcyDebt),
    paid: normalizeMoneyValue(state.paid ?? state.bankruptcyDebtPaid),
    count: normalizeNonNegativeInteger(state.count ?? state.bankruptcyCount),
    lastAt: normalizeNonNegativeInteger(state.lastAt ?? state.lastBankruptcyAt)
  };
}

function normalizeMoneyValue(value) {
  return toCompatibleMoneyValue(normalizeStoredMoney(value));
}

function normalizePositiveMoney(value, label) {
  const money = toMoney(value, label);
  if (compareMoney(money, 0) <= 0) {
    throw new Error(`${label}은(는) 1 이상의 정수여야 합니다.`);
  }
  return money;
}

function normalizeNonNegativeInteger(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(number)));
}

function normalizePositiveInteger(value, label) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) {
    throw new Error(`${label}은(는) 1 이상의 정수여야 합니다.`);
  }
  return number;
}
