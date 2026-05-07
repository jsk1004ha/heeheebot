import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(CURRENT_DIR, '..', '..');
const PROFILE_BADGE_ROOT = join(REPO_ROOT, 'assets', 'profile', 'badges');

export const PROFILE_LEVEL_TIERS = Object.freeze([
  levelTier(1, '뉴비', '새싹처럼 막 시작한 성장 카드', 0x57c785, '╭', '╮', '╰', '╯'),
  levelTier(6, '견습', '첫 번째 별자리를 그리는 성장 카드', 0x5aa7ff, '╭', '╮', '╰', '╯'),
  levelTier(11, '모험가', '청동빛 테두리가 도는 성장 카드', 0xb7793d, '╔', '╗', '╚', '╝'),
  levelTier(31, '정예', '금속 광택이 강해진 성장 카드', 0xd1a441, '╔', '╗', '╚', '╝'),
  levelTier(51, '기사', '날개 장식이 붙은 성장 카드', 0x8fd3ff, '┏', '┓', '┗', '┛'),
  levelTier(71, '성운', '깊은 밤빛 장식이 감도는 성장 카드', 0x7c6cff, '▛', '▜', '▙', '▟'),
  levelTier(91, '전설', '보석 광채가 터지는 성장 카드', 0x70e0ff, '▛', '▜', '▙', '▟'),
  levelTier(141, '초월', '태양빛 문양이 겹쳐진 성장 카드', 0xffb84d, '▛', '▜', '▙', '▟'),
  levelTier(191, '신화', '최종 신화 장식이 완성된 성장 카드', 0xff5fbf, '▛', '▜', '▙', '▟')
]);

export const PROFILE_LEVEL_BADGES = Object.freeze([
  levelBadge(1, 5, '새싹 뉴비 배지', 'SPROUT', 'newbie_sprout'),
  levelBadge(6, 10, '첫 별 견습 배지', 'RISING', 'apprentice_star'),
  ...Array.from({ length: 19 }, (_, index) => {
    const minLevel = 11 + index * 10;
    const maxLevel = 20 + index * 10;
    return levelBadge(minLevel, maxLevel, getIntervalBadgeName(maxLevel), getIntervalBadgeText(maxLevel), `level_${String(minLevel).padStart(3, '0')}_${String(maxLevel).padStart(3, '0')}`);
  })
]);

function levelTier(minLevel, title, aura, color, topLeft, topRight, bottomLeft, bottomRight) {
  return Object.freeze({
    minLevel,
    title,
    aura,
    color,
    topLeft,
    topRight,
    bottomLeft,
    bottomRight
  });
}

function levelBadge(minLevel, maxLevel, name, badgeText, assetId) {
  return Object.freeze({
    level: maxLevel,
    minLevel,
    maxLevel,
    rangeLabel: `${minLevel}~${maxLevel}`,
    name,
    badgeText,
    assetId,
    fileName: `profile_badge_${String(minLevel).padStart(3, '0')}_${String(maxLevel).padStart(3, '0')}.png`
  });
}


function getIntervalBadgeText(maxLevel) {
  const texts = {
    20: 'EMBER',
    30: 'FROST',
    40: 'BLOOM',
    50: 'PLATINUM',
    60: 'AZURE',
    70: 'AURORA',
    80: 'NEBULA',
    90: 'COMET',
    100: 'LEGEND',
    110: 'NOVA',
    120: 'SKYWARD',
    130: 'VALOR',
    140: 'GUARDIAN',
    150: 'SOLAR',
    160: 'ABYSS',
    170: 'CHRONO',
    180: 'COSMIC',
    190: 'MYTHIC',
    200: 'RADIANT'
  };

  return texts[maxLevel] ?? 'RANK';
}

function getIntervalBadgeName(maxLevel) {
  const names = {
    20: '불씨 모험가 배지',
    30: '서리 도전자 배지',
    40: '꽃빛 정예 배지',
    50: '백금 수호자 배지',
    60: '푸른 기사 배지',
    70: '오로라 순례자 배지',
    80: '성운 항해자 배지',
    90: '혜성 추적자 배지',
    100: '전설 문장 배지',
    110: '초신성 개척자 배지',
    120: '천공 기사 배지',
    130: '용맹 사령관 배지',
    140: '수호성 군주 배지',
    150: '태양 왕관 배지',
    160: '심연 보석 배지',
    170: '시간 문장 배지',
    180: '우주 항해자 배지',
    190: '신화 전야 배지',
    200: '무지개 신화 배지'
  };

  return names[maxLevel] ?? `${maxLevel}레벨 성장 배지`;
}

export function getProfileLevelTier(level) {
  const normalizedLevel = normalizeProfileLevel(level);
  return PROFILE_LEVEL_TIERS.findLast((tier) => normalizedLevel >= tier.minLevel);
}

export function getProfileLevelBadges(level) {
  const normalizedLevel = normalizeProfileLevel(level);
  return PROFILE_LEVEL_BADGES.filter((badge) => normalizedLevel >= badge.minLevel);
}

export function getNextProfileLevelBadge(level) {
  const normalizedLevel = normalizeProfileLevel(level);
  return PROFILE_LEVEL_BADGES.find((badge) => normalizedLevel < badge.minLevel) ?? null;
}

export function getCurrentProfileLevelBadge(level) {
  const normalizedLevel = normalizeProfileLevel(level);
  return PROFILE_LEVEL_BADGES.find((badge) => (
    normalizedLevel >= badge.minLevel && normalizedLevel <= badge.maxLevel
  )) ?? PROFILE_LEVEL_BADGES.at(-1);
}

export function getDisplayProfileLevelBadge(level) {
  return getCurrentProfileLevelBadge(level);
}

export function getProfileBadgeFilePath(level) {
  const badge = typeof level === 'object'
    ? level
    : getDisplayProfileLevelBadge(level);
  if (!badge) return null;

  const filePath = join(PROFILE_BADGE_ROOT, badge.fileName);
  return existsSync(filePath) ? filePath : null;
}

export function getProfileBadgeAttachment(level) {
  const badge = typeof level === 'object' ? level : getDisplayProfileLevelBadge(level);
  if (!badge) return null;

  const filePath = getProfileBadgeFilePath(badge);
  if (!filePath) return null;

  return {
    attachment: filePath,
    name: badge.fileName
  };
}

export function normalizeProfileLevel(level) {
  const normalized = Math.floor(Number(level));
  return Number.isSafeInteger(normalized) && normalized >= 1 ? normalized : 1;
}
