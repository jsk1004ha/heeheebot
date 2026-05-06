import {
  getFishCatalog,
  getRarityLabel
} from './fishing.js';

const FISHING_ASSETS = Object.freeze(
  getFishCatalog({ includeHidden: true }).map((fish) => spriteAsset({
    id: fish.assetId,
    fishId: fish.id,
    label: `${fish.label} 아이콘`,
    fishLabel: fish.label,
    rarity: fish.rarity,
    rarityLabel: getFishRarityAssetLabel(fish),
    category: fish.hidden ? 'hidden' : fish.rarity,
    sheet: 'single',
    outputDir: `assets/fishing/fish/${fish.hidden ? 'hidden' : fish.rarity}/${fish.id}`,
    imagePath: fish.imagePath,
    prompt: buildFishPrompt(fish)
  }))
);

export function getFishingAssetById(id) {
  return FISHING_ASSETS.find((asset) => asset.id === id || asset.fishId === id) ?? null;
}

export function getFishingAssetBatch({ rarity = 'all', category = 'all', limit = 8, offset = 0 } = {}) {
  const normalizedRarity = normalizeAssetFilter(rarity);
  const normalizedCategory = normalizeAssetFilter(category);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 8));
  const safeOffset = Math.max(0, Number(offset) || 0);

  return FISHING_ASSETS
    .filter((asset) => normalizedRarity === 'all' || asset.rarity === normalizedRarity)
    .filter((asset) => normalizedCategory === 'all' || asset.category === normalizedCategory)
    .slice(safeOffset, safeOffset + safeLimit);
}

export function getFishingAssetCount({ includeHidden = true } = {}) {
  return FISHING_ASSETS
    .filter((asset) => includeHidden || asset.category !== 'hidden')
    .length;
}

export function getFishingAssetRarityCounts() {
  return FISHING_ASSETS.reduce((counts, asset) => {
    counts[asset.rarity] = (counts[asset.rarity] ?? 0) + 1;
    return counts;
  }, {});
}

export function formatFishingAssetLine(asset) {
  return `- \`${asset.id}\` — ${asset.fishLabel} (${asset.skill} / ${asset.sheet} / ${asset.rarityLabel}) → \`${asset.outputDir}\``;
}

function spriteAsset(asset) {
  return Object.freeze({
    kind: 'sprite',
    skill: '$generate2dsprite',
    ...asset
  });
}

function buildFishPrompt(fish) {
  const hiddenText = fish.hidden
    ? 'secret hidden rarity, mysterious aura, do not add text or labels, '
    : '';

  return [
    'Use $generate2dsprite to create a clean HD transparent 2D game fish icon, single asset,',
    `${hiddenText}${fish.label}, ${getRarityLabel(fish.rarity)} rarity, ${fish.type} type,`,
    'side-view readable silhouette, centered in canvas, full body inside safe area,',
    'slight premium mobile RPG item-icon polish, no UI frame, no text, no watermark,',
    'solid #FF00FF background for chroma key cleanup.'
  ].join(' ');
}

function getFishRarityAssetLabel(fish) {
  return fish.hidden ? '히든' : getRarityLabel(fish.rarity);
}

function normalizeAssetFilter(value) {
  const normalized = String(value || 'all').trim().toLocaleLowerCase('ko-KR');

  if (['전체', 'all'].includes(normalized)) return 'all';
  if (['일반', 'common'].includes(normalized)) return 'common';
  if (['고급', 'uncommon'].includes(normalized)) return 'uncommon';
  if (['희귀', 'rare'].includes(normalized)) return 'rare';
  if (['영웅', 'epic'].includes(normalized)) return 'epic';
  if (['전설', 'legendary'].includes(normalized)) return 'legendary';
  if (['히든', 'hidden', 'secret'].includes(normalized)) return 'hidden';

  return normalized;
}
