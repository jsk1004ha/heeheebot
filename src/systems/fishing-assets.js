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

const FISHING_ROD_ASSETS = Object.freeze([
  rodAsset({
    id: 'rod_01',
    label: '+1 초보 대나무 낚싯대',
    level: 1,
    outputDir: 'assets/fishing/rods/level-01',
    imagePath: 'assets/fishing/rods/level-01/icon.png',
    prompt: buildRodPrompt('+1 simple bamboo beginner rod')
  }),
  rodAsset({
    id: 'rod_02',
    label: '+2 감은 대나무 낚싯대',
    level: 2,
    outputDir: 'assets/fishing/rods/level-02',
    imagePath: 'assets/fishing/rods/level-02/icon.png',
    prompt: buildRodPrompt('+2 bamboo rod with improved grip wrapping')
  }),
  rodAsset({
    id: 'rod_03',
    label: '+3 칠한 대나무 낚싯대',
    level: 3,
    outputDir: 'assets/fishing/rods/level-03',
    imagePath: 'assets/fishing/rods/level-03/icon.png',
    prompt: buildRodPrompt('+3 lacquered bamboo rod with small hook')
  }),
  rodAsset({
    id: 'rod_04',
    label: '+4 튼튼한 갈대 낚싯대',
    level: 4,
    outputDir: 'assets/fishing/rods/level-04',
    imagePath: 'assets/fishing/rods/level-04/icon.png',
    prompt: buildRodPrompt('+4 sturdy cane rod')
  }),
  rodAsset({
    id: 'rod_05',
    label: '+5 초급 청동 릴 낚싯대',
    level: 5,
    outputDir: 'assets/fishing/rods/level-05',
    imagePath: 'assets/fishing/rods/level-05/icon.png',
    prompt: buildRodPrompt('+5 wooden rod with small bronze reel')
  }),
  rodAsset({
    id: 'rod_06',
    label: '+6 광택 목재 청동 낚싯대',
    level: 6,
    outputDir: 'assets/fishing/rods/level-06',
    imagePath: 'assets/fishing/rods/level-06/icon.png',
    prompt: buildRodPrompt('+6 polished wood rod with bronze fittings')
  }),
  rodAsset({
    id: 'rod_07',
    label: '+7 대형 청동 릴 낚싯대',
    level: 7,
    outputDir: 'assets/fishing/rods/level-07',
    imagePath: 'assets/fishing/rods/level-07/icon.png',
    prompt: buildRodPrompt('+7 dark wood rod with larger bronze reel')
  }),
  rodAsset({
    id: 'rod_08',
    label: '+8 황동 가이드 낚싯대',
    level: 8,
    outputDir: 'assets/fishing/rods/level-08',
    imagePath: 'assets/fishing/rods/level-08/icon.png',
    prompt: buildRodPrompt('+8 hardwood rod with brass line guides')
  }),
  rodAsset({
    id: 'rod_09',
    label: '+9 검은 강철 낚싯대',
    level: 9,
    outputDir: 'assets/fishing/rods/level-09',
    imagePath: 'assets/fishing/rods/level-09/icon.png',
    prompt: buildRodPrompt('+9 black steel rod with silver reel')
  }),
  rodAsset({
    id: 'rod_10',
    label: '+10 푸른 줄 강철 낚싯대',
    level: 10,
    outputDir: 'assets/fishing/rods/level-10',
    imagePath: 'assets/fishing/rods/level-10/icon.png',
    prompt: buildRodPrompt('+10 reinforced steel rod with blue fishing line')
  }),
  rodAsset({
    id: 'rod_11',
    label: '+11 분절 흑연 낚싯대',
    level: 11,
    outputDir: 'assets/fishing/rods/level-11',
    imagePath: 'assets/fishing/rods/level-11/icon.png',
    prompt: buildRodPrompt('+11 segmented graphite rod')
  }),
  rodAsset({
    id: 'rod_12',
    label: '+12 중량 카본 낚싯대',
    level: 12,
    outputDir: 'assets/fishing/rods/level-12',
    imagePath: 'assets/fishing/rods/level-12/icon.png',
    prompt: buildRodPrompt('+12 heavy carbon rod with bright reel')
  }),
  rodAsset({
    id: 'rod_13',
    label: '+13 붉은 손잡이 황금 낚싯대',
    level: 13,
    outputDir: 'assets/fishing/rods/level-13',
    imagePath: 'assets/fishing/rods/level-13/icon.png',
    prompt: buildRodPrompt('+13 ornate gold rod with red grip')
  }),
  rodAsset({
    id: 'rod_14',
    label: '+14 루비 릴 황금 낚싯대',
    level: 14,
    outputDir: 'assets/fishing/rods/level-14',
    imagePath: 'assets/fishing/rods/level-14/icon.png',
    prompt: buildRodPrompt('+14 gold rod with ruby reel')
  }),
  rodAsset({
    id: 'rod_15',
    label: '+15 용 문양 황금 낚싯대',
    level: 15,
    outputDir: 'assets/fishing/rods/level-15',
    imagePath: 'assets/fishing/rods/level-15/icon.png',
    prompt: buildRodPrompt('+15 gilded dragon motif rod')
  }),
  rodAsset({
    id: 'rod_16',
    label: '+16 왕실 보석 낚싯대',
    level: 16,
    outputDir: 'assets/fishing/rods/level-16',
    imagePath: 'assets/fishing/rods/level-16/icon.png',
    prompt: buildRodPrompt('+16 royal gold rod with red jewel glow')
  }),
  rodAsset({
    id: 'rod_17',
    label: '+17 심해 진주 낚싯대',
    level: 17,
    outputDir: 'assets/fishing/rods/level-17',
    imagePath: 'assets/fishing/rods/level-17/icon.png',
    prompt: buildRodPrompt('+17 dark oceanic rod with pearl details')
  }),
  rodAsset({
    id: 'rod_18',
    label: '+18 청록빛 심해 낚싯대',
    level: 18,
    outputDir: 'assets/fishing/rods/level-18',
    imagePath: 'assets/fishing/rods/level-18/icon.png',
    prompt: buildRodPrompt('+18 deep-sea rod with cyan glow')
  }),
  rodAsset({
    id: 'rod_19',
    label: '+19 심연 마법 낚싯대',
    level: 19,
    outputDir: 'assets/fishing/rods/level-19',
    imagePath: 'assets/fishing/rods/level-19/icon.png',
    prompt: buildRodPrompt('+19 abyssal navy rod with magical rings')
  }),
  rodAsset({
    id: 'rod_20',
    label: '+20 전설의 바다 낚싯대',
    level: 20,
    outputDir: 'assets/fishing/rods/level-20',
    imagePath: 'assets/fishing/rods/level-20/icon.png',
    prompt: buildRodPrompt('+20 mythical legendary ocean rod with pearl and cyan aura')
  })
]);

export function getFishingAssetById(id) {
  return FISHING_ASSETS.find((asset) => asset.id === id || asset.fishId === id) ?? null;
}

export function getFishingRodAssets() {
  return [...FISHING_ROD_ASSETS];
}

export function getFishingRodAssetForLevel(level) {
  const safeLevel = Math.max(1, Math.min(20, Number(level) || 1));
  return FISHING_ROD_ASSETS.find((asset) => asset.level === safeLevel) ?? FISHING_ROD_ASSETS[0];
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

function rodAsset(asset) {
  return Object.freeze({
    kind: 'rod',
    skill: '$generate2dsprite',
    sheet: 'single',
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

function buildRodPrompt(description) {
  return [
    'Use $generate2dsprite to create a clean HD transparent 2D game fishing rod item icon, single asset,',
    `${description}, centered diagonal rod, full item inside safe area,`,
    'premium mobile RPG item-icon polish, no UI frame, no text, no watermark,',
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
