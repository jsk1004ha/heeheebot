export const CURRENCY_MAIN = 'main';
export const CURRENCY_CASINO = 'casino';
export const CURRENCY_RPG = 'rpg';
export const CURRENCY_SWORD = 'sword';
export const CURRENCY_STOCK = 'stock';

export const UNIFIED_GOLD_MIGRATION_VERSION = 1;

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

export function getCurrencyChoices() {
  return [{ name: '골드 · 단일 통합 화폐', value: CURRENCY_MAIN }];
}

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

  profile.balance = normalizeNonNegativeInteger(profile.balance) + convertedGold;
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
  const normalizedAmount = normalizeNonNegativeInteger(amount);
  if (currencyId === CURRENCY_MAIN) return normalizedAmount;

  const legacy = LEGACY_WALLET_CONFIGS[currencyId];
  if (!legacy) {
    throw new Error('알 수 없는 기존 재화입니다.');
  }

  return Math.floor(normalizedAmount * legacy.goldValueBps / 10_000);
}

export function getCurrencyBalance(profile, currencyId) {
  normalizeCurrencyId(currencyId);
  return normalizeNonNegativeInteger(profile.balance);
}

export function setCurrencyBalance(profile, currencyId, amount) {
  normalizeCurrencyId(currencyId);
  const normalizedAmount = normalizeNonNegativeInteger(amount);
  profile.balance = normalizedAmount;
  profile.wallets = normalizeWallets(profile.wallets);
  return profile.balance;
}

export function creditCurrency(profile, currencyId, amount) {
  normalizeCurrencyId(currencyId);
  const normalizedAmount = normalizeNonNegativeInteger(amount);
  const current = getCurrencyBalance(profile, CURRENCY_MAIN);
  return setCurrencyBalance(profile, CURRENCY_MAIN, current + normalizedAmount);
}

export function debitCurrency(profile, currencyId, amount, errorMessage = null) {
  normalizeCurrencyId(currencyId);
  const normalizedAmount = normalizePositiveInteger(amount, '금액');
  const current = getCurrencyBalance(profile, CURRENCY_MAIN);
  if (current < normalizedAmount) {
    throw new Error(errorMessage ?? `골드가 부족합니다. 필요 금액: ${formatCurrencyAmount(normalizedAmount, CURRENCY_MAIN)}`);
  }

  return setCurrencyBalance(profile, CURRENCY_MAIN, current - normalizedAmount);
}

export function exchangeCurrency(profile, { fromCurrency, toCurrency, amount }) {
  const normalizedAmount = normalizePositiveInteger(amount, '환전 금액');
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
  return `${normalizeNonNegativeInteger(amount).toLocaleString()}골드`;
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
