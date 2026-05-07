import { getRpgItemConfig } from '../../systems/rpg.js';

export function formatRpgProgress(current, required) {
  const safeCurrent = Math.max(0, Number(current) || 0);
  const safeRequired = Math.max(1, Number(required) || 1);
  const cappedCurrent = Math.min(safeCurrent, safeRequired);
  const percent = Math.round((cappedCurrent / safeRequired) * 100);
  const filled = Math.round((percent / 100) * 8);
  const bar = '▰'.repeat(filled) + '▱'.repeat(8 - filled);

  return `${bar} **${safeCurrent.toLocaleString()}/${safeRequired.toLocaleString()}** (${percent}%)`;
}

export function formatRpgRewardSummary(rewards = {}) {
  const parts = [];
  if (rewards.xp) parts.push(`+${rewards.xp.toLocaleString()} XP`);
  if (rewards.coins) parts.push(`+${rewards.coins.toLocaleString()}골드`);
  const itemText = formatRewardItems(rewards.items);
  if (itemText) parts.push(itemText);
  return parts.join(', ') || '없음';
}

export function formatGachaRarity(rarity) {
  return {
    ssr: 'SSR 전설',
    sr: 'SR 희귀',
    r: 'R 일반'
  }[rarity] ?? String(rarity).toUpperCase();
}

export function formatDailyMissionSummary(dailyMissions = []) {
  const claimable = dailyMissions.filter((mission) => mission.canClaim);
  const claimed = dailyMissions.filter((mission) => mission.claimed).length;

  if (claimable.length > 0) {
    return `🎁 보상 가능 **${claimable.length}개** (${claimable.map((mission) => mission.label).join(', ')})`;
  }

  return `완료 **${claimed}/${dailyMissions.length}개**`;
}

export function formatRewardItems(items = {}) {
  return Object.entries(items)
    .map(([itemId, count]) => `${getRpgItemConfig(itemId).label} × ${count}`)
    .join(', ');
}

export function getRpgGold(profile) {
  return profile.balance ?? profile.currencyBalances?.main ?? profile.currencyBalances?.rpg ?? 0;
}

export function formatRpgGoldReward(granted, requested = granted) {
  const safeGranted = Math.max(0, Number(granted) || 0);
  const safeRequested = Math.max(safeGranted, Number(requested ?? safeGranted) || 0);
  const grantedText = `${safeGranted.toLocaleString()}골드`;

  if (safeRequested <= safeGranted) {
    return grantedText;
  }

  return `${grantedText} (일일 상한 적용, 원래 ${safeRequested.toLocaleString()}골드)`;
}

export function formatRpgDailyGoldLimit(dailyGold) {
  if (!dailyGold) {
    return '정보 없음';
  }

  const cap = Math.max(0, Number(dailyGold.cap) || 0);
  const earned = Math.max(0, Number(dailyGold.earned) || 0);
  const remaining = Math.max(0, Number(dailyGold.remaining) || 0);
  const state = remaining > 0 ? `남은 ${remaining.toLocaleString()}골드` : '상한 도달';

  return `**${earned.toLocaleString()} / ${cap.toLocaleString()}골드** (${state})`;
}
