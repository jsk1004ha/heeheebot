import { existsSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const GENERATED_MANIFEST_PATH = join(process.cwd(), 'assets/rpg/asset-manifest.json');
let generatedManifestCache = null;

const RPG_ASSETS = Object.freeze([
  spriteAsset({
    id: 'hero_adventurer_idle',
    label: '초보 모험가 대기 모션',
    category: 'hero',
    sheet: '2x2',
    outputDir: 'assets/rpg/heroes/adventurer/idle',
    prompt: 'Use $generate2dsprite to create a clean HD 2D RPG novice adventurer idle animation, 2x2 grid, full body centered in each cell, same scale, stable feet anchor, leather tunic, small satchel, short sword, friendly fantasy RPG style, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'hero_warrior_idle',
    label: '전사 대기 모션',
    category: 'hero',
    sheet: '2x2',
    outputDir: 'assets/rpg/heroes/warrior/idle',
    prompt: 'Use $generate2dsprite to create a clean HD 2D RPG warrior idle animation, 2x2 grid, full body centered, same scale, stable feet anchor, steel armor, round shield, short sword held close to body, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'hero_mage_idle',
    label: '마법사 대기 모션',
    category: 'hero',
    sheet: '2x2',
    outputDir: 'assets/rpg/heroes/mage/idle',
    prompt: 'Use $generate2dsprite to create a clean HD 2D RPG mage idle animation, 2x2 grid, full body centered, same scale, stable feet anchor, blue robe, wooden staff kept inside the cell, subtle magical glow attached to hands only, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'hero_ranger_idle',
    label: '궁수 대기 모션',
    category: 'hero',
    sheet: '2x2',
    outputDir: 'assets/rpg/heroes/ranger/idle',
    prompt: 'Use $generate2dsprite to create a clean HD 2D RPG ranger idle animation, 2x2 grid, full body centered, same scale, stable feet anchor, green cloak, compact bow held close to body, no flying arrows, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'hero_paladin_idle',
    label: '팔라딘 대기 모션',
    category: 'hero',
    sheet: '2x2',
    outputDir: 'assets/rpg/heroes/paladin/idle',
    prompt: 'Use $generate2dsprite to create a clean HD 2D RPG paladin idle animation, 2x2 grid, full body centered, same scale, stable feet anchor, white-gold armor, compact holy shield and sword held close, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'hero_rogue_idle',
    label: '도적 대기 모션',
    category: 'hero',
    sheet: '2x2',
    outputDir: 'assets/rpg/heroes/rogue/idle',
    prompt: 'Use $generate2dsprite to create a clean HD 2D RPG rogue idle animation, 2x2 grid, full body centered, same scale, stable feet anchor, dark hood, twin daggers kept close to body, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'hero_priest_idle',
    label: '사제 대기 모션',
    category: 'hero',
    sheet: '2x2',
    outputDir: 'assets/rpg/heroes/priest/idle',
    prompt: 'Use $generate2dsprite to create a clean HD 2D RPG priest idle animation, 2x2 grid, full body centered, same scale, stable feet anchor, white robe, small staff, gentle holy glow attached to hands only, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'hero_female_adventurer_idle',
    label: '여성 초보 모험가 대기 모션',
    category: 'hero',
    sheet: '2x2',
    outputDir: 'assets/rpg/heroes/female/adventurer/idle',
    prompt: 'Use $generate2dsprite to create a clean HD 2D RPG female novice adventurer idle animation, 2x2 grid, full body centered in each cell, same scale, stable feet anchor, leather tunic, small satchel, short sword kept close, friendly fantasy RPG style, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'hero_female_warrior_idle',
    label: '여성 전사 대기 모션',
    category: 'hero',
    sheet: '2x2',
    outputDir: 'assets/rpg/heroes/female/warrior/idle',
    prompt: 'Use $generate2dsprite to create a clean HD 2D RPG female warrior idle animation, 2x2 grid, full body centered, same scale, stable feet anchor, steel armor, round shield, short sword held close to body, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'hero_female_mage_idle',
    label: '여성 마법사 대기 모션',
    category: 'hero',
    sheet: '2x2',
    outputDir: 'assets/rpg/heroes/female/mage/idle',
    prompt: 'Use $generate2dsprite to create a clean HD 2D RPG female mage idle animation, 2x2 grid, full body centered, same scale, stable feet anchor, blue robe, wooden staff kept inside the cell, subtle magical glow attached to hands only, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'hero_female_ranger_idle',
    label: '여성 궁수 대기 모션',
    category: 'hero',
    sheet: '2x2',
    outputDir: 'assets/rpg/heroes/female/ranger/idle',
    prompt: 'Use $generate2dsprite to create a clean HD 2D RPG female ranger idle animation, 2x2 grid, full body centered, same scale, stable feet anchor, green cloak, compact bow held close to body, no flying arrows, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'hero_female_paladin_idle',
    label: '여성 팔라딘 대기 모션',
    category: 'hero',
    sheet: '2x2',
    outputDir: 'assets/rpg/heroes/female/paladin/idle',
    prompt: 'Use $generate2dsprite to create a clean HD 2D RPG female paladin idle animation, 2x2 grid, full body centered, same scale, stable feet anchor, white-gold armor, compact holy shield and sword held close, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'hero_female_rogue_idle',
    label: '여성 도적 대기 모션',
    category: 'hero',
    sheet: '2x2',
    outputDir: 'assets/rpg/heroes/female/rogue/idle',
    prompt: 'Use $generate2dsprite to create a clean HD 2D RPG female rogue idle animation, 2x2 grid, full body centered, same scale, stable feet anchor, dark hood, twin daggers kept close to body, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'hero_female_priest_idle',
    label: '여성 사제 대기 모션',
    category: 'hero',
    sheet: '2x2',
    outputDir: 'assets/rpg/heroes/female/priest/idle',
    prompt: 'Use $generate2dsprite to create a clean HD 2D RPG female priest idle animation, 2x2 grid, full body centered, same scale, stable feet anchor, white robe, small staff, gentle holy glow attached to hands only, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'monster_slime_idle',
    label: '슬라임 대기 모션',
    category: 'monster',
    sheet: '2x2',
    outputDir: 'assets/rpg/monsters/slime/idle',
    prompt: 'Use $generate2dsprite to create a clean HD cute blue slime idle bounce animation, 2x2 grid, centered blob body, same scale, readable fantasy RPG enemy, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'monster_goblin_idle',
    label: '고블린 대기 모션',
    category: 'monster',
    sheet: '2x2',
    outputDir: 'assets/rpg/monsters/goblin/idle',
    prompt: 'Use $generate2dsprite to create a clean HD small goblin idle animation, 2x2 grid, full body centered, same scale, crude dagger kept close, mischievous forest enemy, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'monster_forest_wolf_idle',
    label: '숲 늑대 대기 모션',
    category: 'monster',
    sheet: '2x2',
    outputDir: 'assets/rpg/monsters/forest-wolf/idle',
    prompt: 'Use $generate2dsprite to create a clean HD forest wolf idle animation, 2x2 grid, side-view full body centered, same scale, sharp readable silhouette, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'monster_orc_warrior_idle',
    label: '오크 전사 대기 모션',
    category: 'monster',
    sheet: '2x2',
    outputDir: 'assets/rpg/monsters/orc-warrior/idle',
    prompt: 'Use $generate2dsprite to create a clean HD orc warrior idle animation, 2x2 grid, full body centered, same scale, heavy club kept inside cell, fantasy RPG enemy, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'monster_skeleton_soldier_idle',
    label: '해골 병사 대기 모션',
    category: 'monster',
    sheet: '2x2',
    outputDir: 'assets/rpg/monsters/skeleton-soldier/idle',
    prompt: 'Use $generate2dsprite to create a clean HD skeleton soldier idle animation, 2x2 grid, full body centered, same scale, rusty sword and small shield kept inside cell, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'monster_cave_bat_idle',
    label: '동굴 박쥐 대기 모션',
    category: 'monster',
    sheet: '2x2',
    outputDir: 'assets/rpg/monsters/cave-bat/idle',
    prompt: 'Use $generate2dsprite to create a clean HD cave bat hover animation, 2x2 grid, centered body and wings fully inside each cell, same scale, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'monster_troll_idle',
    label: '트롤 대기 모션',
    category: 'monster',
    sheet: '3x3',
    outputDir: 'assets/rpg/monsters/troll/idle',
    prompt: 'Use $generate2dsprite to create a clean HD large troll idle animation, 3x3 grid, full body centered in each cell, same scale, heavy stone club kept inside cells, stable feet anchor, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'monster_dark_knight_idle',
    label: '암흑 기사 대기 모션',
    category: 'monster',
    sheet: '3x3',
    outputDir: 'assets/rpg/monsters/dark-knight/idle',
    prompt: 'Use $generate2dsprite to create a clean HD dark knight idle animation, 3x3 grid, full body centered, same scale, black armor, red cape, sword held close, no detached slash effects, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'monster_mini_dragon_idle',
    label: '미니 드래곤 대기 모션',
    category: 'monster',
    sheet: '3x3',
    outputDir: 'assets/rpg/monsters/mini-dragon/idle',
    prompt: 'Use $generate2dsprite to create a clean HD small dragon idle animation, 3x3 grid, full body centered, same scale, wings and tail fully inside cells, fantasy RPG boss minion, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'boss_slime_king_idle',
    label: '슬라임 킹 대기 모션',
    category: 'monster',
    sheet: '3x3',
    outputDir: 'assets/rpg/bosses/slime-king/idle',
    prompt: 'Use $generate2dsprite to create a clean HD giant slime king boss idle animation, 3x3 grid, centered large blue slime wearing a small crown, same scale, readable RPG boss silhouette, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'boss_ancient_dragon_idle',
    label: '고대 드래곤 대기 모션',
    category: 'monster',
    sheet: '3x3',
    outputDir: 'assets/rpg/bosses/ancient-dragon/idle',
    prompt: 'Use $generate2dsprite to create a clean HD ancient dragon boss idle animation, 3x3 grid, full body centered, same scale, wings and tail fully inside each cell, imposing fantasy RPG boss, solid #FF00FF background, no text.'
  }),
  mapAsset({
    id: 'map_forest_glade',
    label: '초록 숲 전투 배경',
    category: 'map',
    outputDir: 'assets/rpg/maps/forest-glade',
    prompt: 'Use $generate2dmap to create a baked_scene_mode clean HD hand-painted 2D RPG battle background: peaceful green forest glade, readable grass clearing, trees around the edges, open center for hero and monster sprites, no characters, no UI, no text.'
  }),
  mapAsset({
    id: 'map_crystal_cave',
    label: '수정 동굴 전투 배경',
    category: 'map',
    outputDir: 'assets/rpg/maps/crystal-cave',
    prompt: 'Use $generate2dmap to create a baked_scene_mode clean HD hand-painted 2D RPG battle background: blue crystal cave, glowing crystals on sides, open flat center floor for battle sprites, no characters, no UI, no text.'
  }),
  mapAsset({
    id: 'map_ancient_ruins',
    label: '고대 유적 전투 배경',
    category: 'map',
    outputDir: 'assets/rpg/maps/ancient-ruins',
    prompt: 'Use $generate2dmap to create a baked_scene_mode clean HD hand-painted 2D RPG battle background: ancient stone ruins at sunset, broken pillars around the edges, open center arena for battle sprites, no characters, no UI, no text.'
  }),
  spriteAsset({
    id: 'item_potion_icon',
    label: '회복 포션 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/potion',
    prompt: 'Use $generate2dsprite to create a clean HD transparent RPG potion icon, single asset, red liquid glass bottle, centered, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_mana_potion_icon',
    label: '마나 포션 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/mana-potion',
    prompt: 'Use $generate2dsprite to create a clean HD transparent RPG mana potion icon, single asset, blue liquid glass bottle, centered, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_treasure_chest_icon',
    label: '보물상자 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/treasure-chest',
    prompt: 'Use $generate2dsprite to create a clean HD transparent RPG treasure chest icon, single asset, centered, wooden chest with gold trim, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_iron_sword_icon',
    label: '철검 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/iron-sword',
    prompt: 'Use $generate2dsprite to create a clean HD transparent RPG iron sword icon, single asset, centered diagonal steel short sword, readable game item icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_leather_armor_icon',
    label: '가죽 갑옷 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/leather-armor',
    prompt: 'Use $generate2dsprite to create a clean HD transparent RPG leather armor chestpiece icon, single asset, centered, warm brown leather with simple straps, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_mystic_ring_icon',
    label: '신비한 반지 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/mystic-ring',
    prompt: 'Use $generate2dsprite to create a clean HD transparent RPG mystic ring icon, single asset, centered gold ring with small blue gem glow, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_dragon_blade_icon',
    label: '드래곤 블레이드 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/dragon-blade',
    prompt: 'Use $generate2dsprite to create a clean HD transparent RPG dragon blade icon, single asset, centered ornate red-black sword with subtle flame motif, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_archmage_staff_icon',
    label: '대마도사의 지팡이 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/archmage-staff',
    prompt: 'Use $generate2dsprite to create a clean HD transparent RPG archmage staff icon, single asset, centered wooden staff with floating blue crystal, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_guardian_plate_icon',
    label: '수호자의 판금갑옷 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/guardian-plate',
    prompt: 'Use $generate2dsprite to create a clean HD transparent RPG guardian plate armor icon, single asset, centered silver-blue chest armor, solid #FF00FF background, no text.'
  })
]);

export function getRpgAssetById(id) {
  return RPG_ASSETS.find((asset) => asset.id === id) ?? null;
}

export function getRpgAssetBatch({ kind = 'all', category = 'all', limit = 8 } = {}) {
  const normalizedKind = normalizeFilter(kind);
  const normalizedCategory = normalizeFilter(category);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 8));

  return RPG_ASSETS
    .filter((asset) => normalizedKind === 'all' || asset.kind === normalizedKind)
    .filter((asset) => normalizedCategory === 'all' || asset.category === normalizedCategory)
    .slice(0, safeLimit);
}

export function getRpgAssetCount() {
  return RPG_ASSETS.length;
}

export function getRpgGeneratedAssetById(id) {
  const manifest = readGeneratedManifest();
  return manifest?.assets?.find((asset) => asset.id === id) ?? null;
}

export function getRpgAssetFilePath(id, preferred = 'auto') {
  const generated = getRpgGeneratedAssetById(id);
  if (!generated) return null;

  const candidates = getAssetPathCandidates(generated, preferred);
  for (const candidate of candidates) {
    if (!candidate) continue;
    const absolutePath = join(process.cwd(), candidate);
    if (existsSync(absolutePath)) {
      return absolutePath;
    }
  }

  return null;
}

export function getRpgAssetAttachment(id, preferred = 'auto') {
  const filePath = getRpgAssetFilePath(id, preferred);
  if (!filePath) return null;

  return {
    attachment: filePath,
    name: `${sanitizeAttachmentName(id)}${extname(filePath) || '.png'}`
  };
}

export function formatRpgAssetLine(asset) {
  const sheetText = asset.sheet ? ` / ${asset.sheet}` : '';
  return `- \`${asset.id}\` — ${asset.label} (${asset.skill}${sheetText})`;
}

function spriteAsset(asset) {
  return Object.freeze({
    kind: 'sprite',
    skill: '$generate2dsprite',
    ...asset
  });
}

function mapAsset(asset) {
  return Object.freeze({
    kind: 'map',
    skill: '$generate2dmap',
    ...asset
  });
}

function normalizeFilter(value) {
  const normalized = String(value || 'all').trim().toLocaleLowerCase('ko-KR');

  if (['전체', 'all'].includes(normalized)) return 'all';
  if (['스프라이트', 'sprite', 'sprites'].includes(normalized)) return 'sprite';
  if (['맵', '지도', 'map', 'maps'].includes(normalized)) return 'map';
  if (['영웅', 'hero'].includes(normalized)) return 'hero';
  if (['몬스터', 'monster'].includes(normalized)) return 'monster';
  if (['아이템', 'item'].includes(normalized)) return 'item';

  return normalized;
}

function readGeneratedManifest() {
  if (generatedManifestCache !== null) return generatedManifestCache;

  if (!existsSync(GENERATED_MANIFEST_PATH)) {
    generatedManifestCache = null;
    return generatedManifestCache;
  }

  try {
    generatedManifestCache = JSON.parse(readFileSync(GENERATED_MANIFEST_PATH, 'utf8'));
  } catch {
    generatedManifestCache = null;
  }

  return generatedManifestCache;
}

function getAssetPathCandidates(asset, preferred) {
  if (preferred === 'raw') return [asset.raw];
  if (preferred === 'animation') return [asset.animation, asset.transparentSheet, asset.raw];
  if (preferred === 'sheet') return [asset.transparentSheet, asset.animation, asset.raw];

  if (asset.kind === 'map') return [asset.raw];
  if (asset.sheet === 'single') return [
    asset.processedDir ? `${asset.processedDir}/clean.png` : null,
    asset.raw
  ];

  return [asset.animation, asset.transparentSheet, asset.raw];
}

function sanitizeAttachmentName(id) {
  return String(id || 'rpg-asset').replace(/[^a-zA-Z0-9_-]/g, '_');
}
