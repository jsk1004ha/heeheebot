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
    id: 'hero_berserker_idle',
    label: '광전사 전직 이미지',
    category: 'hero',
    sheet: 'single',
    outputDir: 'assets/rpg/heroes/advanced/berserker/idle',
    prompt: 'Use $generate2dsprite to create a clean HD 2D RPG male berserker advanced class hero, single full-body sprite centered, red-black heavy battle armor, huge axe held inside silhouette, compact rage aura, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'hero_female_berserker_idle',
    label: '여성 광전사 전직 이미지',
    category: 'hero',
    sheet: 'single',
    outputDir: 'assets/rpg/heroes/advanced/female/berserker/idle',
    prompt: 'Use $generate2dsprite to create a clean HD 2D RPG female berserker advanced class hero, single full-body sprite centered, red-black battle armor, heavy axe held inside silhouette, compact rage aura, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'hero_archmage_idle',
    label: '대마법사 전직 이미지',
    category: 'hero',
    sheet: 'single',
    outputDir: 'assets/rpg/heroes/advanced/archmage/idle',
    prompt: 'Use $generate2dsprite to create a clean HD 2D RPG male archmage advanced class hero, single full-body sprite centered, ornate blue-violet robe, crystal staff kept close, compact arcane halo, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'hero_female_archmage_idle',
    label: '여성 대마법사 전직 이미지',
    category: 'hero',
    sheet: 'single',
    outputDir: 'assets/rpg/heroes/advanced/female/archmage/idle',
    prompt: 'Use $generate2dsprite to create a clean HD 2D RPG female archmage advanced class hero, single full-body sprite centered, elegant blue-violet robe, crystal staff kept close, compact arcane glow, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'hero_sniper_idle',
    label: '저격수 전직 이미지',
    category: 'hero',
    sheet: 'single',
    outputDir: 'assets/rpg/heroes/advanced/sniper/idle',
    prompt: 'Use $generate2dsprite to create a clean HD 2D RPG male sniper advanced class hero, single full-body sprite centered, green-brown cloak, eagle-feather hood, longbow/crossbow kept inside silhouette, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'hero_female_sniper_idle',
    label: '여성 저격수 전직 이미지',
    category: 'hero',
    sheet: 'single',
    outputDir: 'assets/rpg/heroes/advanced/female/sniper/idle',
    prompt: 'Use $generate2dsprite to create a clean HD 2D RPG female sniper advanced class hero, single full-body sprite centered, green-brown cloak, feather hood, precise longbow/crossbow kept inside silhouette, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'hero_crusader_idle',
    label: '크루세이더 전직 이미지',
    category: 'hero',
    sheet: 'single',
    outputDir: 'assets/rpg/heroes/advanced/crusader/idle',
    prompt: 'Use $generate2dsprite to create a clean HD 2D RPG male crusader advanced class hero, single full-body sprite centered, white-gold heavy armor, holy tower shield and sword kept close, compact sacred glow, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'hero_female_crusader_idle',
    label: '여성 크루세이더 전직 이미지',
    category: 'hero',
    sheet: 'single',
    outputDir: 'assets/rpg/heroes/advanced/female/crusader/idle',
    prompt: 'Use $generate2dsprite to create a clean HD 2D RPG female crusader advanced class hero, single full-body sprite centered, white-gold heavy armor, holy shield and sword kept close, compact sacred glow, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'hero_shadow_idle',
    label: '섀도우 전직 이미지',
    category: 'hero',
    sheet: 'single',
    outputDir: 'assets/rpg/heroes/advanced/shadow/idle',
    prompt: 'Use $generate2dsprite to create a clean HD 2D RPG male shadow assassin advanced class hero, single full-body sprite centered, black-purple assassin coat, twin daggers held close, compact smoky shadow aura, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'hero_female_shadow_idle',
    label: '여성 섀도우 전직 이미지',
    category: 'hero',
    sheet: 'single',
    outputDir: 'assets/rpg/heroes/advanced/female/shadow/idle',
    prompt: 'Use $generate2dsprite to create a clean HD 2D RPG female shadow assassin advanced class hero, single full-body sprite centered, black-purple assassin coat, twin daggers held close, compact smoky shadow aura, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'hero_saint_idle',
    label: '성자 전직 이미지',
    category: 'hero',
    sheet: 'single',
    outputDir: 'assets/rpg/heroes/advanced/saint/idle',
    prompt: 'Use $generate2dsprite to create a clean HD 2D RPG male saint advanced class hero, single full-body sprite centered, luminous white-gold robes, holy staff kept close, soft halo motif contained, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'hero_female_saint_idle',
    label: '여성 성자 전직 이미지',
    category: 'hero',
    sheet: 'single',
    outputDir: 'assets/rpg/heroes/advanced/female/saint/idle',
    prompt: 'Use $generate2dsprite to create a clean HD 2D RPG female saint advanced class hero, single full-body sprite centered, luminous white-gold robes, holy staff kept close, soft halo motif contained, solid #FF00FF background, no text.'
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
  spriteAsset({
    id: 'boss_goblin_warband_idle',
    label: '고블린 전투부대 대기 모션',
    category: 'monster',
    sheet: '3x3',
    outputDir: 'assets/rpg/bosses/goblin-warband/idle',
    prompt: 'Use $generate2dsprite to create a clean HD goblin warband raid boss idle animation, 3x3 grid, armored goblin commander with banner and compact spear, full body centered, same scale, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'boss_crystal_hydra_idle',
    label: '수정 히드라 대기 모션',
    category: 'monster',
    sheet: '3x3',
    outputDir: 'assets/rpg/bosses/crystal-hydra/idle',
    prompt: 'Use $generate2dsprite to create a clean HD crystal hydra raid boss idle animation, 3x3 grid, three compact crystal serpent heads, glowing blue facets, full body centered, same scale, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'boss_marsh_behemoth_idle',
    label: '늪지 베헤모스 대기 모션',
    category: 'monster',
    sheet: '3x3',
    outputDir: 'assets/rpg/bosses/marsh-behemoth/idle',
    prompt: 'Use $generate2dsprite to create a clean HD marsh behemoth raid boss idle animation, 3x3 grid, bulky swamp beast with mossy horns, readable silhouette, full body centered, same scale, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'boss_ruins_sentinel_idle',
    label: '유적 감시자 대기 모션',
    category: 'monster',
    sheet: '3x3',
    outputDir: 'assets/rpg/bosses/ruins-sentinel/idle',
    prompt: 'Use $generate2dsprite to create a clean HD ancient ruins sentinel raid boss idle animation, 3x3 grid, stone guardian construct with glowing runes, full body centered, same scale, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'boss_flame_giant_idle',
    label: '화염 거인 대기 모션',
    category: 'monster',
    sheet: '3x3',
    outputDir: 'assets/rpg/bosses/flame-giant/idle',
    prompt: 'Use $generate2dsprite to create a clean HD flame giant raid boss idle animation, 3x3 grid, lava stone giant with contained flame core, full body centered, same scale, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'boss_frost_lich_idle',
    label: '빙결 리치 대기 모션',
    category: 'monster',
    sheet: '3x3',
    outputDir: 'assets/rpg/bosses/frost-lich/idle',
    prompt: 'Use $generate2dsprite to create a clean HD frost lich raid boss idle animation, 3x3 grid, skeletal ice mage in tattered robes, blue frost aura attached to body only, full body centered, same scale, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'boss_storm_wyvern_idle',
    label: '폭풍 와이번 대기 모션',
    category: 'monster',
    sheet: '3x3',
    outputDir: 'assets/rpg/bosses/storm-wyvern/idle',
    prompt: 'Use $generate2dsprite to create a clean HD storm wyvern raid boss idle animation, 3x3 grid, winged wyvern with compact lightning fins, wings and tail inside each cell, same scale, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'boss_void_knights_idle',
    label: '공허 기사단 대기 모션',
    category: 'monster',
    sheet: '3x3',
    outputDir: 'assets/rpg/bosses/void-knights/idle',
    prompt: 'Use $generate2dsprite to create a clean HD void knights raid boss idle animation, 3x3 grid, one merged silhouette of two dark armored knights back-to-back, purple void glow, centered, same scale, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'boss_sky_golem_idle',
    label: '천공 골렘 대기 모션',
    category: 'monster',
    sheet: '3x3',
    outputDir: 'assets/rpg/bosses/sky-golem/idle',
    prompt: 'Use $generate2dsprite to create a clean HD sky golem raid boss idle animation, 3x3 grid, floating gold-white stone golem with cloud crystals, centered, same scale, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'boss_apocalypse_dragon_idle',
    label: '종말의 용 대기 모션',
    category: 'monster',
    sheet: '3x3',
    outputDir: 'assets/rpg/bosses/apocalypse-dragon/idle',
    prompt: 'Use $generate2dsprite to create a clean HD apocalypse dragon final raid boss idle animation, 3x3 grid, black-red dragon with eclipse halo, full body centered, wings and tail fully inside each cell, same scale, solid #FF00FF background, no text.'
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
  mapAsset({
    id: 'map_shadow_marsh',
    label: '그림자 늪 전투 배경',
    category: 'map',
    outputDir: 'assets/rpg/maps/shadow-marsh',
    prompt: 'Use $generate2dmap to create a baked_scene_mode clean HD hand-painted 2D RPG battle background: eerie shadow marsh, dark water, twisted roots, purple fog, open center island for hero and monster sprites, no characters, no UI, no text.'
  }),
  mapAsset({
    id: 'map_volcanic_rift',
    label: '화산 협곡 전투 배경',
    category: 'map',
    outputDir: 'assets/rpg/maps/volcanic-rift',
    prompt: 'Use $generate2dmap to create a baked_scene_mode clean HD hand-painted 2D RPG battle background: volcanic rift canyon, lava glow, black basalt rocks, open ash platform center, dramatic warm lighting, no characters, no UI, no text.'
  }),
  mapAsset({
    id: 'map_frozen_peak',
    label: '빙결 봉우리 전투 배경',
    category: 'map',
    outputDir: 'assets/rpg/maps/frozen-peak',
    prompt: 'Use $generate2dmap to create a baked_scene_mode clean HD hand-painted 2D RPG battle background: frozen mountain peak, blue ice cliffs, snow particles, open flat icy arena center, crisp cold light, no characters, no UI, no text.'
  }),
  mapAsset({
    id: 'map_sky_citadel',
    label: '하늘 성채 전투 배경',
    category: 'map',
    outputDir: 'assets/rpg/maps/sky-citadel',
    prompt: 'Use $generate2dmap to create a baked_scene_mode clean HD hand-painted 2D RPG battle background: floating sky citadel platform above clouds, golden stone floor, distant towers, open center arena, no characters, no UI, no text.'
  }),
  mapAsset({
    id: 'map_wildflower_plains',
    label: '들꽃 평원 전투 배경',
    category: 'map',
    outputDir: 'assets/rpg/maps/wildflower-plains',
    prompt: 'Use $generate2dmap to create a baked_scene_mode clean HD hand-painted 2D RPG battle background: bright wildflower plains, green meadow, flowers at edges, open grass center, no characters, no UI, no text.'
  }),
  mapAsset({
    id: 'map_moonlit_hill',
    label: '달빛 언덕 전투 배경',
    category: 'map',
    outputDir: 'assets/rpg/maps/moonlit-hill',
    prompt: 'Use $generate2dmap to create a baked_scene_mode clean HD hand-painted 2D RPG battle background: moonlit hill, blue night sky, soft moonlight, open stone path center, no characters, no UI, no text.'
  }),
  mapAsset({
    id: 'map_mushroom_grove',
    label: '버섯 숲 전투 배경',
    category: 'map',
    outputDir: 'assets/rpg/maps/mushroom-grove',
    prompt: 'Use $generate2dmap to create a baked_scene_mode clean HD hand-painted 2D RPG battle background: giant mushroom grove, violet spores, glowing fungi at edges, open forest floor center, no characters, no UI, no text.'
  }),
  mapAsset({
    id: 'map_bandit_outpost',
    label: '도적 전초기지 전투 배경',
    category: 'map',
    outputDir: 'assets/rpg/maps/bandit-outpost',
    prompt: 'Use $generate2dmap to create a baked_scene_mode clean HD hand-painted 2D RPG battle background: rough bandit outpost, wooden barricades at sides, open dirt arena center, no characters, no UI, no text.'
  }),
  mapAsset({
    id: 'map_red_desert',
    label: '붉은 사막 전투 배경',
    category: 'map',
    outputDir: 'assets/rpg/maps/red-desert',
    prompt: 'Use $generate2dmap to create a baked_scene_mode clean HD hand-painted 2D RPG battle background: red desert canyon, warm sandstorm, cracked dry arena center, no characters, no UI, no text.'
  }),
  mapAsset({
    id: 'map_thunder_plateau',
    label: '천둥 고원 전투 배경',
    category: 'map',
    outputDir: 'assets/rpg/maps/thunder-plateau',
    prompt: 'Use $generate2dmap to create a baked_scene_mode clean HD hand-painted 2D RPG battle background: stormy thunder plateau, distant lightning, open stone platform center, no characters, no UI, no text.'
  }),
  mapAsset({
    id: 'map_crystal_lake',
    label: '수정 호수 전투 배경',
    category: 'map',
    outputDir: 'assets/rpg/maps/crystal-lake',
    prompt: 'Use $generate2dmap to create a baked_scene_mode clean HD hand-painted 2D RPG battle background: icy crystal lake, blue crystals, reflective frozen arena center, no characters, no UI, no text.'
  }),
  mapAsset({
    id: 'map_phantom_forest',
    label: '환영 숲 전투 배경',
    category: 'map',
    outputDir: 'assets/rpg/maps/phantom-forest',
    prompt: 'Use $generate2dmap to create a baked_scene_mode clean HD hand-painted 2D RPG battle background: phantom forest, ghostly mist, twisted trees, open haunted path center, no characters, no UI, no text.'
  }),
  mapAsset({
    id: 'map_abyss_mine',
    label: '심연 광산 전투 배경',
    category: 'map',
    outputDir: 'assets/rpg/maps/abyss-mine',
    prompt: 'Use $generate2dmap to create a baked_scene_mode clean HD hand-painted 2D RPG battle background: dark abyss mine, glowing ore, mine rails at edges, open cavern floor center, no characters, no UI, no text.'
  }),
  mapAsset({
    id: 'map_starfall_crater',
    label: '별무리 분화구 전투 배경',
    category: 'map',
    outputDir: 'assets/rpg/maps/starfall-crater',
    prompt: 'Use $generate2dmap to create a baked_scene_mode clean HD hand-painted 2D RPG battle background: starfall crater, meteor fragments, lava cracks, open impact arena center, no characters, no UI, no text.'
  }),
  mapAsset({
    id: 'map_dragon_nest',
    label: '용의 둥지 전투 배경',
    category: 'map',
    outputDir: 'assets/rpg/maps/dragon-nest',
    prompt: 'Use $generate2dmap to create a baked_scene_mode clean HD hand-painted 2D RPG battle background: dragon nest, rocky high mountain nest, eggs and bones at edges, open center arena, no characters, no UI, no text.'
  }),
  mapAsset({
    id: 'map_void_gate',
    label: '공허 관문 전투 배경',
    category: 'map',
    outputDir: 'assets/rpg/maps/void-gate',
    prompt: 'Use $generate2dmap to create a baked_scene_mode clean HD hand-painted 2D RPG battle background: void gate, cosmic purple portal far back, floating stones, open dark arena center, no characters, no UI, no text.'
  }),
  mapAsset({
    id: 'map_goblin_war_camp',
    label: '고블린 전쟁 야영지 전투 배경',
    category: 'map',
    outputDir: 'assets/rpg/maps/goblin-war-camp',
    prompt: 'Use $generate2dmap to create a baked_scene_mode clean HD hand-painted 2D RPG raid background: goblin war camp, torn banners, crude palisades, open dirt arena center, no characters, no UI, no text.'
  }),
  mapAsset({
    id: 'map_crystal_nest',
    label: '수정 둥지 전투 배경',
    category: 'map',
    outputDir: 'assets/rpg/maps/crystal-nest',
    prompt: 'Use $generate2dmap to create a baked_scene_mode clean HD hand-painted 2D RPG raid background: deep crystal hydra nest, jagged blue crystals framing sides, shallow reflective floor, open center arena, no characters, no UI, no text.'
  }),
  mapAsset({
    id: 'map_marsh_depths',
    label: '늪 심연 전투 배경',
    category: 'map',
    outputDir: 'assets/rpg/maps/marsh-depths',
    prompt: 'Use $generate2dmap to create a baked_scene_mode clean HD hand-painted 2D RPG raid background: deep shadow marsh, black water, huge roots and green mist at edges, open muddy island center, no characters, no UI, no text.'
  }),
  mapAsset({
    id: 'map_ruins_obelisk',
    label: '유적 방첨탑 전투 배경',
    category: 'map',
    outputDir: 'assets/rpg/maps/ruins-obelisk',
    prompt: 'Use $generate2dmap to create a baked_scene_mode clean HD hand-painted 2D RPG raid background: ancient obelisk arena, broken rune pillars, sunset gold light, open stone center, no characters, no UI, no text.'
  }),
  mapAsset({
    id: 'map_lava_throne',
    label: '용암 왕좌 전투 배경',
    category: 'map',
    outputDir: 'assets/rpg/maps/lava-throne',
    prompt: 'Use $generate2dmap to create a baked_scene_mode clean HD hand-painted 2D RPG raid background: lava throne chamber, basalt bridge, orange magma glow, open black stone platform center, no characters, no UI, no text.'
  }),
  mapAsset({
    id: 'map_frost_catacomb',
    label: '빙결 지하묘지 전투 배경',
    category: 'map',
    outputDir: 'assets/rpg/maps/frost-catacomb',
    prompt: 'Use $generate2dmap to create a baked_scene_mode clean HD hand-painted 2D RPG raid background: frozen catacomb hall, blue ice coffins and frost runes, open icy arena center, no characters, no UI, no text.'
  }),
  mapAsset({
    id: 'map_storm_spire',
    label: '폭풍 첨탑 전투 배경',
    category: 'map',
    outputDir: 'assets/rpg/maps/storm-spire',
    prompt: 'Use $generate2dmap to create a baked_scene_mode clean HD hand-painted 2D RPG raid background: storm spire above clouds, dark sky, contained lightning arcs at edges, open circular platform center, no characters, no UI, no text.'
  }),
  mapAsset({
    id: 'map_void_bastion',
    label: '공허 요새 전투 배경',
    category: 'map',
    outputDir: 'assets/rpg/maps/void-bastion',
    prompt: 'Use $generate2dmap to create a baked_scene_mode clean HD hand-painted 2D RPG raid background: void bastion, black stone walls, purple portals at edges, open center arena with violet glow, no characters, no UI, no text.'
  }),
  mapAsset({
    id: 'map_sky_foundry',
    label: '천공 주조소 전투 배경',
    category: 'map',
    outputDir: 'assets/rpg/maps/sky-foundry',
    prompt: 'Use $generate2dmap to create a baked_scene_mode clean HD hand-painted 2D RPG raid background: floating sky foundry, gold gears and cloud furnaces, open metal platform center, no characters, no UI, no text.'
  }),
  mapAsset({
    id: 'map_eclipse_throne',
    label: '일식 왕좌 전투 배경',
    category: 'map',
    outputDir: 'assets/rpg/maps/eclipse-throne',
    prompt: 'Use $generate2dmap to create a baked_scene_mode clean HD hand-painted 2D RPG final raid background: eclipse throne at the edge of the sky, black-red celestial light, ruined royal platform center, no characters, no UI, no text.'
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
    id: 'item_enhancement_stone_icon',
    label: '강화석 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/enhancement-stone',
    prompt: 'Use $generate2dsprite to create a clean HD transparent RPG enhancement stone icon, single asset, glowing blue-purple crystal shard with gold flecks, centered, solid #FF00FF background, no text.'
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
    name: `${getPublicAttachmentName(id)}${extname(filePath) || '.png'}`
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

function getPublicAttachmentName(id) {
  const index = RPG_ASSETS.findIndex((asset) => asset.id === id);
  return index >= 0
    ? `rpg-image-${String(index + 1).padStart(2, '0')}`
    : 'rpg-image';
}
