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
    label: '검사 대기 모션',
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
    label: '성기사 대기 모션',
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
    label: '여성 검사 대기 모션',
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
    label: '여성 성기사 대기 모션',
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
    label: '대마도사 전직 이미지',
    category: 'hero',
    sheet: 'single',
    outputDir: 'assets/rpg/heroes/advanced/archmage/idle',
    prompt: 'Use $generate2dsprite to create a clean HD 2D RPG male archmage advanced class hero, single full-body sprite centered, ornate blue-violet robe, jeweled staff kept close, compact arcane halo, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'hero_female_archmage_idle',
    label: '여성 대마도사 전직 이미지',
    category: 'hero',
    sheet: 'single',
    outputDir: 'assets/rpg/heroes/advanced/female/archmage/idle',
    prompt: 'Use $generate2dsprite to create a clean HD 2D RPG female archmage advanced class hero, single full-body sprite centered, elegant blue-violet robe, jeweled staff kept close, compact arcane glow, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'hero_sniper_idle',
    label: '명사수 전직 이미지',
    category: 'hero',
    sheet: 'single',
    outputDir: 'assets/rpg/heroes/advanced/sniper/idle',
    prompt: 'Use $generate2dsprite to create a clean HD 2D RPG male sniper advanced class hero, single full-body sprite centered, green-brown cloak, eagle-feather hood, longbow/crossbow kept inside silhouette, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'hero_female_sniper_idle',
    label: '여성 명사수 전직 이미지',
    category: 'hero',
    sheet: 'single',
    outputDir: 'assets/rpg/heroes/advanced/female/sniper/idle',
    prompt: 'Use $generate2dsprite to create a clean HD 2D RPG female sniper advanced class hero, single full-body sprite centered, green-brown cloak, feather hood, precise longbow/crossbow kept inside silhouette, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'hero_crusader_idle',
    label: '성전사 전직 이미지',
    category: 'hero',
    sheet: 'single',
    outputDir: 'assets/rpg/heroes/advanced/crusader/idle',
    prompt: 'Use $generate2dsprite to create a clean HD 2D RPG male crusader advanced class hero, single full-body sprite centered, white-gold heavy armor, holy tower shield and sword kept close, compact sacred glow, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'hero_female_crusader_idle',
    label: '여성 성전사 전직 이미지',
    category: 'hero',
    sheet: 'single',
    outputDir: 'assets/rpg/heroes/advanced/female/crusader/idle',
    prompt: 'Use $generate2dsprite to create a clean HD 2D RPG female crusader advanced class hero, single full-body sprite centered, white-gold heavy armor, holy shield and sword kept close, compact sacred glow, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'hero_shadow_idle',
    label: '그림자 살수 전직 이미지',
    category: 'hero',
    sheet: 'single',
    outputDir: 'assets/rpg/heroes/advanced/shadow/idle',
    prompt: 'Use $generate2dsprite to create a clean HD 2D RPG male shadow assassin advanced class hero, single full-body sprite centered, black-purple assassin coat, twin daggers held close, compact smoky shadow aura, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'hero_female_shadow_idle',
    label: '여성 그림자 살수 전직 이미지',
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
    label: '새끼 용 대기 모션',
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
    label: '고대 용 대기 모션',
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
    label: '늪지 히드라 대기 모션',
    category: 'monster',
    sheet: '3x3',
    outputDir: 'assets/rpg/bosses/crystal-hydra/idle',
    prompt: 'Use $generate2dsprite to create a clean HD swamp hydra raid boss idle animation, 3x3 grid, three compact poisonous serpent heads, mossy green scales, full body centered, same scale, solid #FF00FF background, no text.'
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
    label: '마왕의 사도 대기 모션',
    category: 'monster',
    sheet: '3x3',
    outputDir: 'assets/rpg/bosses/void-knights/idle',
    prompt: 'Use $generate2dsprite to create a clean HD demon king apostles raid boss idle animation, 3x3 grid, one merged silhouette of two dark armored knights back-to-back, dark curse glow, centered, same scale, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'boss_sky_golem_idle',
    label: '왕국 수호 골렘 대기 모션',
    category: 'monster',
    sheet: '3x3',
    outputDir: 'assets/rpg/bosses/sky-golem/idle',
    prompt: 'Use $generate2dsprite to create a clean HD royal guardian golem raid boss idle animation, 3x3 grid, gold-white stone golem with royal crest armor, centered, same scale, solid #FF00FF background, no text.'
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
    label: '왕도 남쪽 초원 전투 배경',
    category: 'map',
    outputDir: 'assets/rpg/maps/forest-glade',
    prompt: 'Use $generate2dmap to create a baked_scene_mode clean HD hand-painted 2D RPG battle background: kingdom south meadow and forest edge, readable grass clearing, trees around the edges, open center for hero and monster sprites, no characters, no UI, no text.'
  }),
  mapAsset({
    id: 'map_crystal_cave',
    label: '버려진 은광 전투 배경',
    category: 'map',
    outputDir: 'assets/rpg/maps/crystal-cave',
    prompt: 'Use $generate2dmap to create a baked_scene_mode clean HD hand-painted 2D RPG battle background: abandoned silver mine, ore veins and timber supports at sides, open flat center floor for battle sprites, no characters, no UI, no text.'
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
    label: '고블린 숲 입구 전투 배경',
    category: 'map',
    outputDir: 'assets/rpg/maps/wildflower-plains',
    prompt: 'Use $generate2dmap to create a baked_scene_mode clean HD hand-painted 2D RPG battle background: goblin forest entrance, green meadow with crude goblin markers at edges, open grass center, no characters, no UI, no text.'
  }),
  mapAsset({
    id: 'map_moonlit_hill',
    label: '안개 늪지 언덕 전투 배경',
    category: 'map',
    outputDir: 'assets/rpg/maps/moonlit-hill',
    prompt: 'Use $generate2dmap to create a baked_scene_mode clean HD hand-painted 2D RPG battle background: mist marsh hill, blue night sky, low fog, open stone path center, no characters, no UI, no text.'
  }),
  mapAsset({
    id: 'map_mushroom_grove',
    label: '저주받은 수도원 정원 전투 배경',
    category: 'map',
    outputDir: 'assets/rpg/maps/mushroom-grove',
    prompt: 'Use $generate2dmap to create a baked_scene_mode clean HD hand-painted 2D RPG battle background: cursed monastery garden, dead trees and broken chapel stones at edges, open forest floor center, no characters, no UI, no text.'
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
    label: '붉은 협곡 전투 배경',
    category: 'map',
    outputDir: 'assets/rpg/maps/red-desert',
    prompt: 'Use $generate2dmap to create a baked_scene_mode clean HD hand-painted 2D RPG battle background: red canyon battlefield, warm dust storm, cracked dry arena center, no characters, no UI, no text.'
  }),
  mapAsset({
    id: 'map_thunder_plateau',
    label: '마탑 지하서고 전투 배경',
    category: 'map',
    outputDir: 'assets/rpg/maps/thunder-plateau',
    prompt: 'Use $generate2dmap to create a baked_scene_mode clean HD hand-painted 2D RPG battle background: wizard tower underground archive, shelves and rune stones at edges, open stone platform center, no characters, no UI, no text.'
  }),
  mapAsset({
    id: 'map_crystal_lake',
    label: '성지 아르덴 전투 배경',
    category: 'map',
    outputDir: 'assets/rpg/maps/crystal-lake',
    prompt: 'Use $generate2dmap to create a baked_scene_mode clean HD hand-painted 2D RPG battle background: sacred sanctuary Arden, white stone pool, chapel garden arena center, no characters, no UI, no text.'
  }),
  mapAsset({
    id: 'map_phantom_forest',
    label: '왕국 대장간 거리 전투 배경',
    category: 'map',
    outputDir: 'assets/rpg/maps/phantom-forest',
    prompt: 'Use $generate2dmap to create a baked_scene_mode clean HD hand-painted 2D RPG battle background: medieval blacksmith district, forges and anvils at sides, open cobblestone center, no characters, no UI, no text.'
  }),
  mapAsset({
    id: 'map_abyss_mine',
    label: '왕국 비밀 광산 전투 배경',
    category: 'map',
    outputDir: 'assets/rpg/maps/abyss-mine',
    prompt: 'Use $generate2dmap to create a baked_scene_mode clean HD hand-painted 2D RPG battle background: royal secret mine, hidden ore, mine rails at edges, open cavern floor center, no characters, no UI, no text.'
  }),
  mapAsset({
    id: 'map_starfall_crater',
    label: '길드 훈련장 전투 배경',
    category: 'map',
    outputDir: 'assets/rpg/maps/starfall-crater',
    prompt: 'Use $generate2dmap to create a baked_scene_mode clean HD hand-painted 2D RPG battle background: guild training ground, wooden dummies, banners, open packed-earth arena center, no characters, no UI, no text.'
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
    label: '마왕성 내부 전투 배경',
    category: 'map',
    outputDir: 'assets/rpg/maps/void-gate',
    prompt: 'Use $generate2dmap to create a baked_scene_mode clean HD hand-painted 2D RPG battle background: demon king castle interior, black stone gate far back, cursed braziers, open dark arena center, no characters, no UI, no text.'
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
    label: '늪지 히드라 둥지 전투 배경',
    category: 'map',
    outputDir: 'assets/rpg/maps/crystal-nest',
    prompt: 'Use $generate2dmap to create a baked_scene_mode clean HD hand-painted 2D RPG raid background: swamp hydra nest, tangled roots and poisoned pools framing sides, shallow muddy floor, open center arena, no characters, no UI, no text.'
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
    label: '마왕성 외곽 요새 전투 배경',
    category: 'map',
    outputDir: 'assets/rpg/maps/void-bastion',
    prompt: 'Use $generate2dmap to create a baked_scene_mode clean HD hand-painted 2D RPG raid background: demon king outer fortress, black stone walls, cursed torches at edges, open center arena with violet glow, no characters, no UI, no text.'
  }),
  mapAsset({
    id: 'map_sky_foundry',
    label: '왕국 대장간 전투 배경',
    category: 'map',
    outputDir: 'assets/rpg/maps/sky-foundry',
    prompt: 'Use $generate2dmap to create a baked_scene_mode clean HD hand-painted 2D RPG raid background: royal blacksmith forge, bellows and anvils, open metal platform center, no characters, no UI, no text.'
  }),
  mapAsset({
    id: 'map_eclipse_throne',
    label: '일식 왕좌 전투 배경',
    category: 'map',
    outputDir: 'assets/rpg/maps/eclipse-throne',
    prompt: 'Use $generate2dmap to create a baked_scene_mode clean HD hand-painted 2D RPG final raid background: eclipse throne at the heart of the demon king castle, black-red cursed torchlight, ruined royal platform center, no characters, no UI, no text.'
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
    prompt: 'Use $generate2dsprite to create a clean HD transparent RPG enhancement stone icon, single asset, glowing blue-purple rune shard with gold flecks, centered, solid #FF00FF background, no text.'
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
    label: '용비늘 대검 아이콘',
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
    prompt: 'Use $generate2dsprite to create a clean HD transparent RPG archmage staff icon, single asset, centered wooden staff with floating blue gem, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_guardian_plate_icon',
    label: '수호자의 판금갑옷 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/guardian-plate',
    prompt: 'Use $generate2dsprite to create a clean HD transparent RPG guardian plate armor icon, single asset, centered silver-blue chest armor, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_card_deck_icon',
    label: '타짜 카드덱 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/card-deck',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy card deck icon, single asset, centered parchment cards with red wax seal, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_lucky_dice_icon',
    label: '행운의 주사위 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/lucky-dice',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy bone dice icon, single asset, centered two ivory dice with gold pips, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_blacksmith_hammer_icon',
    label: '대장장이 망치 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/blacksmith-hammer',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy blacksmith hammer icon, single asset, centered iron hammer with leather grip, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_rune_stone_icon',
    label: '룬석 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/rune-stone',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy rune stone icon, single asset, centered carved gray stone with gold rune lines, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_iron_ore_icon',
    label: '철광석 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/iron-ore',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy iron ore icon, single asset, centered dark ore cluster with silver flecks, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_dragon_scale_icon',
    label: '용비늘 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/dragon-scale',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy dragon scale icon, single asset, centered red-black scale with gold edge, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_holy_relic_icon',
    label: '성유물 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/holy-relic',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy holy relic icon, single asset, centered small golden reliquary with white cloth, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_crossbow_icon',
    label: '석궁 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/crossbow',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy crossbow icon, single asset, centered compact wooden crossbow with steel limbs, solid #FF00FF background, no text.'
  }),

  spriteAsset({
    id: 'item_slime_charm_icon',
    label: '슬라임 부적 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/slime-charm',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 슬라임 부적 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_wolfhide_vest_icon',
    label: '늑대가죽 조끼 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/wolfhide-vest',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 늑대가죽 조끼 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_goblin_spear_icon',
    label: '고블린 창 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/goblin-spear',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 고블린 창 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_spider_silk_cloak_icon',
    label: '거미줄 망토 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/spider-silk-cloak',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 거미줄 망토 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_miner_pickaxe_icon',
    label: '광부의 곡괭이 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/miner-pickaxe',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 광부의 곡괭이 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_batwing_earring_icon',
    label: '박쥐날개 귀걸이 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/batwing-earring',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 박쥐날개 귀걸이 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_marshbone_talisman_icon',
    label: '늪뼈 부적 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/marshbone-talisman',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 늪뼈 부적 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_bandit_cutlass_icon',
    label: '도적단 곡도 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/bandit-cutlass',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 도적단 곡도 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_monastery_censer_icon',
    label: '수도원 향로 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/monastery-censer',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 수도원 향로 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_orc_war_axe_icon',
    label: '오크 전투도끼 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/orc-war-axe',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 오크 전투도끼 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_frost_guard_armor_icon',
    label: '서리수호 갑옷 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/frost-guard-armor',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 서리수호 갑옷 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_elf_rune_ring_icon',
    label: '엘프 룬 반지 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/elf-rune-ring',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 엘프 룬 반지 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_wyvern_scale_mail_icon',
    label: '와이번 비늘갑옷 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/wyvern-scale-mail',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 와이번 비늘갑옷 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_demon_knight_blade_icon',
    label: '마왕군 흑검 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/demon-knight-blade',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 마왕군 흑검 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_arden_prayer_beads_icon',
    label: '아르덴 묵주 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/arden-prayer-beads',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 아르덴 묵주 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_black_dragon_scaleplate_icon',
    label: '검은 용비늘 갑옷 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/black-dragon-scaleplate',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 검은 용비늘 갑옷 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_iron_longsword_icon',
    label: '철 장검 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/iron-longsword',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 철 장검 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_oak_shortbow_icon',
    label: '참나무 단궁 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/oak-shortbow',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 참나무 단궁 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_iron_dagger_icon',
    label: '철 단검 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/iron-dagger',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 철 단검 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_iron_spear_icon',
    label: '철창 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/iron-spear',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 철창 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_reinforced_leather_armor_icon',
    label: '보강 가죽갑옷 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/reinforced-leather-armor',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 보강 가죽갑옷 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_silver_ring_icon',
    label: '은 반지 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/silver-ring',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 은 반지 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_hunter_bow_icon',
    label: '사냥꾼의 활 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/hunter-bow',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 사냥꾼의 활 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_apprentice_staff_icon',
    label: '수습 마법사의 지팡이 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/apprentice-staff',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 수습 마법사의 지팡이 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_holy_mace_icon',
    label: '신성한 철퇴 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/holy-mace',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 신성한 철퇴 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_rogue_dagger_icon',
    label: '도적의 단검 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/rogue-dagger',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 도적의 단검 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_healer_charm_icon',
    label: '치유사의 부적 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/healer-charm',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 치유사의 부적 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_silver_longsword_icon',
    label: '은빛 장검 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/silver-longsword',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 은빛 장검 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_steel_halberd_icon',
    label: '강철 할버드 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/steel-halberd',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 강철 할버드 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_steel_crossbow_icon',
    label: '강철 석궁 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/steel-crossbow',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 강철 석궁 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_battle_axe_icon',
    label: '전투도끼 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/battle-axe',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 전투도끼 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_priest_codex_icon',
    label: '사제의 성서 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/priest-codex',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 사제의 성서 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_assassin_twinblades_icon',
    label: '암살자의 쌍검 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/assassin-twinblades',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 암살자의 쌍검 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_poison_dagger_icon',
    label: '맹독 단검 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/poison-dagger',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 맹독 단검 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_rune_armor_icon',
    label: '룬 갑옷 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/rune-armor',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 룬 갑옷 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_shadow_hood_icon',
    label: '그림자 두건 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/shadow-hood',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 그림자 두건 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_fire_rune_blade_icon',
    label: '화염 룬검 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/fire-rune-blade',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 화염 룬검 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_ice_guard_plate_icon',
    label: '냉기 수호갑옷 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/ice-guard-plate',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 냉기 수호갑옷 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_lightning_wand_icon',
    label: '번개 완드 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/lightning-wand',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 번개 완드 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_storm_staff_icon',
    label: '폭풍 지팡이 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/storm-staff',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 폭풍 지팡이 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_blessed_plate_icon',
    label: '축복받은 판금갑옷 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/blessed-plate',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 축복받은 판금갑옷 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_sacred_silver_staff_icon',
    label: '성은 지팡이 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/sacred-silver-staff',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 성은 지팡이 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_ancient_elf_bow_icon',
    label: '고대 엘프 장궁 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/ancient-elf-bow',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 고대 엘프 장궁 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_demonbone_axe_icon',
    label: '악마뼈 도끼 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/demonbone-axe',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 악마뼈 도끼 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_dragon_scale_shield_icon',
    label: '용비늘 방패 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/dragon-scale-shield',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 용비늘 방패 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_dragon_scale_greatsword_icon',
    label: '용비늘 대검 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/dragon-scale-greatsword',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 용비늘 대검 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_black_dragon_spear_icon',
    label: '검은 용창 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/black-dragon-spear',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 검은 용창 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_lich_grimoire_icon',
    label: '리치의 마도서 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/lich-grimoire',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 리치의 마도서 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_sanctuary_armor_icon',
    label: '성역의 갑옷 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/sanctuary-armor',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 성역의 갑옷 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_shadow_cloak_icon',
    label: '그림자 망토 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/shadow-cloak',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 그림자 망토 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_nidhogg_plate_icon',
    label: '니드호그 갑옷 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/nidhogg-plate',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 니드호그 갑옷 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_kings_crown_icon',
    label: '왕국의 왕관 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/kings-crown',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 왕국의 왕관 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_hidden_moonfang_blade_icon',
    label: '월아의 비밀검 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/hidden-moonfang-blade',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 월아의 비밀검 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_hidden_arden_halo_icon',
    label: '아르덴 성광륜 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/hidden-arden-halo',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 아르덴 성광륜 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_hidden_dragonheart_hammer_icon',
    label: '용의심장 대장장이 망치 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/hidden-dragonheart-hammer',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 용의심장 대장장이 망치 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'item_hidden_forest_king_bow_icon',
    label: '숲왕의 장궁 아이콘',
    category: 'item',
    sheet: 'single',
    outputDir: 'assets/rpg/items/hidden-forest-king-bow',
    prompt: 'Use $generate2dsprite to create a clean HD transparent medieval fantasy 숲왕의 장궁 icon, single asset, centered readable RPG equipment icon, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'hero_tazza_idle',
    label: '타짜 대기 모션',
    category: 'hero',
    sheet: '2x2',
    outputDir: 'assets/rpg/heroes/tazza/idle',
    prompt: 'Use $generate2dsprite to create a clean HD medieval fantasy tazza card-and-dice trickster hero idle animation, 2x2 grid, full-body sprite centered in each cell, deck pouch, bone dice, cloak, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'hero_female_tazza_idle',
    label: '여성 타짜 대기 모션',
    category: 'hero',
    sheet: '2x2',
    outputDir: 'assets/rpg/heroes/female/tazza/idle',
    prompt: 'Use $generate2dsprite to create a clean HD medieval fantasy female tazza card-and-dice trickster hero idle animation, 2x2 grid, full-body sprite centered in each cell, deck pouch, bone dice, cloak, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'hero_blacksmith_idle',
    label: '대장장이 대기 모션',
    category: 'hero',
    sheet: '2x2',
    outputDir: 'assets/rpg/heroes/blacksmith/idle',
    prompt: 'Use $generate2dsprite to create a clean HD medieval fantasy combat blacksmith hero idle animation, 2x2 grid, full-body sprite centered in each cell, hammer and leather apron armor, solid #FF00FF background, no text.'
  }),
  spriteAsset({
    id: 'hero_female_blacksmith_idle',
    label: '여성 대장장이 대기 모션',
    category: 'hero',
    sheet: '2x2',
    outputDir: 'assets/rpg/heroes/female/blacksmith/idle',
    prompt: 'Use $generate2dsprite to create a clean HD medieval fantasy female combat blacksmith hero idle animation, 2x2 grid, full-body sprite centered in each cell, hammer and leather apron armor, solid #FF00FF background, no text.'
  }),
  mapAsset({ id: 'map_royal_south_plains', label: '왕도 남쪽 초원 배경', category: 'map', outputDir: 'assets/rpg/maps/royal-south-plains', prompt: 'Medieval kingdom south plains hunting ground, 16:9 game background, no text.' }),
  mapAsset({ id: 'map_goblin_forest', label: '고블린 숲 배경', category: 'map', outputDir: 'assets/rpg/maps/goblin-forest', prompt: 'Medieval goblin forest hunting ground, 16:9 game background, no text.' }),
  mapAsset({ id: 'map_abandoned_silver_mine', label: '버려진 은광 배경', category: 'map', outputDir: 'assets/rpg/maps/abandoned-silver-mine', prompt: 'Abandoned silver mine dungeon, 16:9 game background, no text.' }),
  mapAsset({ id: 'map_mist_marsh', label: '안개 늪지 배경', category: 'map', outputDir: 'assets/rpg/maps/mist-marsh', prompt: 'Poison mist marsh medieval fantasy, 16:9 game background, no text.' }),
  mapAsset({ id: 'map_bandit_fortress', label: '도적단 요새 배경', category: 'map', outputDir: 'assets/rpg/maps/bandit-fortress', prompt: 'Bandit fortress medieval fantasy, 16:9 game background, no text.' }),
  mapAsset({ id: 'map_cursed_monastery', label: '저주받은 수도원 배경', category: 'map', outputDir: 'assets/rpg/maps/cursed-monastery', prompt: 'Cursed monastery undead dungeon, 16:9 game background, no text.' }),
  mapAsset({ id: 'map_red_canyon', label: '붉은 협곡 배경', category: 'map', outputDir: 'assets/rpg/maps/red-canyon', prompt: 'Red canyon orc and wyvern battlefield, 16:9 game background, no text.' }),
  mapAsset({ id: 'map_frozen_mountains', label: '얼어붙은 산맥 배경', category: 'map', outputDir: 'assets/rpg/maps/frozen-mountains', prompt: 'Frozen mountains medieval fantasy, 16:9 game background, no text.' }),
  mapAsset({ id: 'map_ancient_elf_ruins', label: '고대 엘프 유적 배경', category: 'map', outputDir: 'assets/rpg/maps/ancient-elf-ruins', prompt: 'Ancient elf ruins with runes, 16:9 game background, no text.' }),
  mapAsset({ id: 'map_black_dragon_lair', label: '검은 용의 둥지 배경', category: 'map', outputDir: 'assets/rpg/maps/black-dragon-lair', prompt: 'Black dragon lair with lava and treasure, 16:9 game background, no text.' }),
  mapAsset({ id: 'map_wizard_tower_archive', label: '마탑 지하서고 배경', category: 'map', outputDir: 'assets/rpg/maps/wizard-tower-archive', prompt: 'Wizard tower underground archive, 16:9 game background, no text.' }),
  mapAsset({ id: 'map_demon_king_outer_wall', label: '마왕성 외곽 배경', category: 'map', outputDir: 'assets/rpg/maps/demon-king-outer-wall', prompt: 'Demon king castle outer wall battlefield, 16:9 game background, no text.' }),
  mapAsset({ id: 'map_sacred_arden', label: '성지 아르덴 배경', category: 'map', outputDir: 'assets/rpg/maps/sacred-arden', prompt: 'Sacred sanctuary Arden holy site, 16:9 game background, no text.' }),
  mapAsset({ id: 'map_royal_capital_wall', label: '왕국 수도 성벽 배경', category: 'map', outputDir: 'assets/rpg/maps/royal-capital-wall', prompt: 'Royal capital defensive wall, 16:9 game background, no text.' }),
  mapAsset({ id: 'map_blacksmith_district', label: '왕국 대장간 거리 배경', category: 'map', outputDir: 'assets/rpg/maps/blacksmith-district', prompt: 'Medieval blacksmith district, 16:9 game background, no text.' }),
  mapAsset({ id: 'map_royal_secret_mine', label: '왕국 비밀 광산 배경', category: 'map', outputDir: 'assets/rpg/maps/royal-secret-mine', prompt: 'Royal secret mine with hidden weapon ore, 16:9 game background, no text.' }),
  mapAsset({ id: 'map_guild_training_ground', label: '길드 훈련장 배경', category: 'map', outputDir: 'assets/rpg/maps/guild-training-ground', prompt: 'Guild training ground with dummies and banners, 16:9 game background, no text.' }),
  mapAsset({ id: 'map_demon_king_castle', label: '마왕성 내부 배경', category: 'map', outputDir: 'assets/rpg/maps/demon-king-castle', prompt: 'Demon king castle interior final dungeon, 16:9 game background, no text.' })
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
