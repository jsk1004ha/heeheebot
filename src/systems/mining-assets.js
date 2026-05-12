import {
  getMaxPickaxeLevel,
  getMiningRarityLabel,
  getOreCatalog
} from './mining.js';

const MINING_ORE_ASSETS = Object.freeze(
  getOreCatalog({ includeHidden: true }).map((ore) => spriteAsset({
    id: ore.assetId,
    oreId: ore.id,
    label: `${ore.label} 아이콘`,
    oreLabel: ore.label,
    rarity: ore.rarity,
    rarityLabel: getOreRarityAssetLabel(ore),
    category: ore.hidden ? 'hidden' : ore.rarity,
    sheet: 'single',
    outputDir: `assets/mining/ores/${ore.hidden ? 'hidden' : ore.rarity}/${ore.id}`,
    imagePath: ore.imagePath,
    prompt: buildOrePrompt(ore)
  }))
);

const MINING_PICKAXE_ASSETS = Object.freeze(
  Array.from({ length: getMaxPickaxeLevel() }, (_, index) => {
    const level = index + 1;
    const tier = getPickaxeTier(level);
    return pickaxeAsset({
      id: `pickaxe_${String(level).padStart(3, '0')}`,
      label: `+${level} ${tier.label} 곡괭이`,
      level,
      tier: tier.id,
      outputDir: `assets/mining/pickaxes/level-${String(level).padStart(3, '0')}`,
      imagePath: `assets/mining/pickaxes/level-${String(level).padStart(3, '0')}/icon.png`,
      prompt: buildPickaxePrompt(level, tier)
    });
  })
);

export function getMiningOreAssetById(id) {
  return MINING_ORE_ASSETS.find((asset) => asset.id === id || asset.oreId === id) ?? null;
}

export function getMiningOreAssets() {
  return [...MINING_ORE_ASSETS];
}

export function getMiningPickaxeAssets() {
  return [...MINING_PICKAXE_ASSETS];
}

export function getMiningPickaxeAssetForLevel(level) {
  const safeLevel = Math.max(1, Math.min(getMaxPickaxeLevel(), Number(level) || 1));
  return MINING_PICKAXE_ASSETS.find((asset) => asset.level === safeLevel) ?? MINING_PICKAXE_ASSETS[0];
}

export function getMiningAssetBatch({ rarity = 'all', category = 'all', limit = 8, offset = 0 } = {}) {
  const normalizedRarity = normalizeAssetFilter(rarity);
  const normalizedCategory = normalizeAssetFilter(category);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 8));
  const safeOffset = Math.max(0, Number(offset) || 0);

  return MINING_ORE_ASSETS
    .filter((asset) => normalizedRarity === 'all' || asset.rarity === normalizedRarity)
    .filter((asset) => normalizedCategory === 'all' || asset.category === normalizedCategory)
    .slice(safeOffset, safeOffset + safeLimit);
}

export function getMiningAssetCount({ includeHidden = true } = {}) {
  return MINING_ORE_ASSETS.filter((asset) => includeHidden || asset.category !== 'hidden').length;
}

export function getMiningAssetRarityCounts() {
  return MINING_ORE_ASSETS.reduce((counts, asset) => {
    counts[asset.rarity] = (counts[asset.rarity] ?? 0) + 1;
    return counts;
  }, {});
}

export function formatMiningAssetLine(asset) {
  return `- \`${asset.id}\` — ${asset.oreLabel} (${asset.skill} / ${asset.sheet} / ${asset.rarityLabel}) → \`${asset.outputDir}\``;
}

function spriteAsset(asset) {
  return Object.freeze({ kind: 'sprite', skill: '$generate2dsprite', ...asset });
}

function pickaxeAsset(asset) {
  return Object.freeze({ kind: 'pickaxe', skill: '$generate2dsprite', sheet: 'single', ...asset });
}

function buildOrePrompt(ore) {
  const hiddenText = ore.hidden ? 'secret hidden rarity, mysterious aura, do not add text or labels, ' : '';
  return [
    'Use $generate2dsprite to create a clean HD transparent 2D game ore or gemstone item icon, single asset,',
    `${hiddenText}${ore.label}, ${getMiningRarityLabel(ore.rarity)} rarity, ${ore.vein} vein,`,
    'readable chunky mineral silhouette, centered in canvas, full object inside safe area,',
    'premium mobile RPG item-icon polish, no UI frame, no text, no watermark,',
    'solid #FF00FF background for chroma key cleanup.'
  ].join(' ');
}

function buildPickaxePrompt(level, tier) {
  return [
    'Use $generate2dsprite to create a clean HD transparent 2D game pickaxe item icon, single asset,',
    `+${level} enhancement, ${tier.material} pickaxe, ${tier.accent} accents, centered diagonal tool, full item inside safe area,`,
    'premium mobile RPG item-icon polish, no UI frame, no text, no watermark,',
    'solid #FF00FF background for chroma key cleanup.'
  ].join(' ');
}

function getOreRarityAssetLabel(ore) {
  return ore.hidden ? '히든' : getMiningRarityLabel(ore.rarity);
}

function getPickaxeTier(level) {
  if (level >= 100) return Object.freeze({ id: 'mythic', label: '신화의 심층', material: 'mythic prismatic star-metal', accent: 'rainbow aurora' });
  if (level >= 90) return Object.freeze({ id: 'void', label: '공허', material: 'void black crystal', accent: 'violet void glow' });
  if (level >= 80) return Object.freeze({ id: 'celestial', label: '천상', material: 'celestial diamond steel', accent: 'gold and white light' });
  if (level >= 70) return Object.freeze({ id: 'dragon', label: '용혈', material: 'dragon bloodstone alloy', accent: 'red ember glow' });
  if (level >= 60) return Object.freeze({ id: 'mithril', label: '미스릴', material: 'polished mithril', accent: 'blue runes' });
  if (level >= 50) return Object.freeze({ id: 'platinum', label: '백금', material: 'platinum steel', accent: 'silver shine' });
  if (level >= 40) return Object.freeze({ id: 'gold', label: '황금', material: 'gold reinforced steel', accent: 'warm gold' });
  if (level >= 30) return Object.freeze({ id: 'crystal', label: '수정', material: 'steel and quartz crystal', accent: 'cyan facets' });
  if (level >= 20) return Object.freeze({ id: 'steel', label: '강철', material: 'dark steel', accent: 'blue grip' });
  if (level >= 10) return Object.freeze({ id: 'iron', label: '철제', material: 'iron', accent: 'leather wrap' });
  return Object.freeze({ id: 'copper', label: '초보 구리', material: 'copper and wood', accent: 'simple leather' });
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
