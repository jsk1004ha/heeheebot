import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { getRpgAssetById } from '../src/systems/rpg-assets.js';

const ROOT = process.cwd();
const MANIFEST_PATH = join(ROOT, 'assets/rpg/asset-manifest.json');
const CODEX_HOME = process.env.CODEX_HOME || join(process.env.HOME || '/home/jio', '.codex');
const GENERATED_SOURCE_ROOT = join(CODEX_HOME, 'generated_images/rpg-forge-source-complete');
const MAGENTA = [255, 0, 255, 255];

const HERO_IDS = [
  'hero_tazza_idle',
  'hero_female_tazza_idle',
  'hero_blacksmith_idle',
  'hero_female_blacksmith_idle'
];

const MAP_IDS = [
  'map_royal_south_plains',
  'map_goblin_forest',
  'map_abandoned_silver_mine',
  'map_mist_marsh',
  'map_bandit_fortress',
  'map_cursed_monastery',
  'map_red_canyon',
  'map_frozen_mountains',
  'map_ancient_elf_ruins',
  'map_black_dragon_lair',
  'map_wizard_tower_archive',
  'map_demon_king_outer_wall',
  'map_sacred_arden',
  'map_royal_capital_wall',
  'map_blacksmith_district',
  'map_royal_secret_mine',
  'map_guild_training_ground',
  'map_demon_king_castle'
];

const ITEM_IDS = [
  'item_enhancement_stone_icon',
  'item_card_deck_icon',
  'item_lucky_dice_icon',
  'item_blacksmith_hammer_icon',
  'item_rune_stone_icon',
  'item_iron_ore_icon',
  'item_dragon_scale_icon',
  'item_holy_relic_icon',
  'item_crossbow_icon',
  'item_slime_charm_icon',
  'item_wolfhide_vest_icon',
  'item_goblin_spear_icon',
  'item_spider_silk_cloak_icon',
  'item_miner_pickaxe_icon',
  'item_batwing_earring_icon',
  'item_marshbone_talisman_icon',
  'item_bandit_cutlass_icon',
  'item_monastery_censer_icon',
  'item_orc_war_axe_icon',
  'item_frost_guard_armor_icon',
  'item_elf_rune_ring_icon',
  'item_wyvern_scale_mail_icon',
  'item_demon_knight_blade_icon',
  'item_arden_prayer_beads_icon',
  'item_black_dragon_scaleplate_icon',
  'item_iron_longsword_icon',
  'item_oak_shortbow_icon',
  'item_iron_dagger_icon',
  'item_iron_spear_icon',
  'item_reinforced_leather_armor_icon',
  'item_silver_ring_icon',
  'item_hunter_bow_icon',
  'item_apprentice_staff_icon',
  'item_holy_mace_icon',
  'item_rogue_dagger_icon',
  'item_healer_charm_icon',
  'item_silver_longsword_icon',
  'item_steel_halberd_icon',
  'item_steel_crossbow_icon',
  'item_battle_axe_icon',
  'item_priest_codex_icon',
  'item_assassin_twinblades_icon',
  'item_poison_dagger_icon',
  'item_rune_armor_icon',
  'item_shadow_hood_icon',
  'item_fire_rune_blade_icon',
  'item_ice_guard_plate_icon',
  'item_lightning_wand_icon',
  'item_storm_staff_icon',
  'item_blessed_plate_icon',
  'item_sacred_silver_staff_icon',
  'item_ancient_elf_bow_icon',
  'item_demonbone_axe_icon',
  'item_dragon_scale_shield_icon',
  'item_dragon_scale_greatsword_icon',
  'item_black_dragon_spear_icon',
  'item_lich_grimoire_icon',
  'item_sanctuary_armor_icon',
  'item_shadow_cloak_icon',
  'item_nidhogg_plate_icon',
  'item_kings_crown_icon',
  'item_hidden_moonfang_blade_icon',
  'item_hidden_arden_halo_icon',
  'item_hidden_dragonheart_hammer_icon',
  'item_hidden_forest_king_bow_icon'
];

const NEW_ASSET_IDS = [...HERO_IDS, ...MAP_IDS, ...ITEM_IDS];

const crcTable = new Uint32Array(256).map((_, index) => {
  let c = index;
  for (let bit = 0; bit < 8; bit += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data = Buffer.alloc(0)) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(width, height, rgba) {
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    rows[rowStart] = 0;
    rgba.copy(rows, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(rows)),
    pngChunk('IEND')
  ]);
}

function createCanvas(width, height, fill = [0, 0, 0, 0]) {
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    data[i * 4] = fill[0];
    data[i * 4 + 1] = fill[1];
    data[i * 4 + 2] = fill[2];
    data[i * 4 + 3] = fill[3];
  }
  return { width, height, data };
}

function savePng(path, canvas) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, encodePng(canvas.width, canvas.height, canvas.data));
}

function getGeneratedWith(asset) {
  return `agent-sprite-forge:${asset.skill}`;
}

function getSourcePath(asset) {
  const filename = asset.kind === 'map' ? 'background.png' : 'raw-sheet.png';
  return join(GENERATED_SOURCE_ROOT, asset.id, filename);
}

function copyGeneratedSource(asset, generatedPath) {
  const sourcePath = getSourcePath(asset);
  mkdirSync(dirname(sourcePath), { recursive: true });
  copyFileSync(generatedPath, sourcePath);
  return sourcePath;
}

function setPixel(canvas, x, y, color) {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) return;
  const offset = (py * canvas.width + px) * 4;
  canvas.data[offset] = color[0];
  canvas.data[offset + 1] = color[1];
  canvas.data[offset + 2] = color[2];
  canvas.data[offset + 3] = color[3] ?? 255;
}

function rect(canvas, x, y, w, h, color) {
  for (let yy = Math.max(0, Math.floor(y)); yy < Math.min(canvas.height, Math.ceil(y + h)); yy += 1) {
    for (let xx = Math.max(0, Math.floor(x)); xx < Math.min(canvas.width, Math.ceil(x + w)); xx += 1) {
      setPixel(canvas, xx, yy, color);
    }
  }
}

function ellipse(canvas, cx, cy, rx, ry, color) {
  const minX = Math.floor(cx - rx);
  const maxX = Math.ceil(cx + rx);
  const minY = Math.floor(cy - ry);
  const maxY = Math.ceil(cy + ry);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) setPixel(canvas, x, y, color);
    }
  }
}

function line(canvas, x0, y0, x1, y1, color, thickness = 1) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    ellipse(canvas, x, y, thickness, thickness, color);
  }
}

function triangle(canvas, ax, ay, bx, by, cx, cy, color) {
  const minX = Math.floor(Math.min(ax, bx, cx));
  const maxX = Math.ceil(Math.max(ax, bx, cx));
  const minY = Math.floor(Math.min(ay, by, cy));
  const maxY = Math.ceil(Math.max(ay, by, cy));
  const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  if (area === 0) return;
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const w0 = ((bx - ax) * (y - ay) - (by - ay) * (x - ax)) / area;
      const w1 = ((cx - bx) * (y - by) - (cy - by) * (x - bx)) / area;
      const w2 = ((ax - cx) * (y - cy) - (ay - cy) * (x - cx)) / area;
      if ((w0 >= 0 && w1 >= 0 && w2 >= 0) || (w0 <= 0 && w1 <= 0 && w2 <= 0)) {
        setPixel(canvas, x, y, color);
      }
    }
  }
}

function gradient(canvas, top, bottom) {
  for (let y = 0; y < canvas.height; y += 1) {
    const t = y / Math.max(1, canvas.height - 1);
    const color = top.map((v, i) => Math.round(v + (bottom[i] - v) * t));
    rect(canvas, 0, y, canvas.width, 1, color);
  }
}

function drawTree(canvas, x, y, scale = 1, trunk = [92, 57, 32, 255], leaves = [36, 102, 57, 255]) {
  rect(canvas, x - 5 * scale, y, 10 * scale, 40 * scale, trunk);
  ellipse(canvas, x, y - 8 * scale, 30 * scale, 24 * scale, leaves);
  ellipse(canvas, x - 18 * scale, y + 4 * scale, 20 * scale, 18 * scale, leaves);
  ellipse(canvas, x + 18 * scale, y + 4 * scale, 20 * scale, 18 * scale, leaves);
}

function drawCastle(canvas, x, y, scale = 1, wall = [142, 142, 128, 255], roof = [96, 38, 38, 255]) {
  rect(canvas, x, y, 160 * scale, 85 * scale, wall);
  rect(canvas, x - 18 * scale, y - 28 * scale, 36 * scale, 113 * scale, wall);
  rect(canvas, x + 142 * scale, y - 28 * scale, 36 * scale, 113 * scale, wall);
  triangle(canvas, x - 24 * scale, y - 28 * scale, x, y - 64 * scale, x + 24 * scale, y - 28 * scale, roof);
  triangle(canvas, x + 136 * scale, y - 28 * scale, x + 160 * scale, y - 64 * scale, x + 184 * scale, y - 28 * scale, roof);
  rect(canvas, x + 70 * scale, y + 40 * scale, 28 * scale, 45 * scale, [69, 49, 38, 255]);
}

function drawMountain(canvas, x, y, w, h, color, snow = null) {
  triangle(canvas, x, y, x + w / 2, y - h, x + w, y, color);
  if (snow) triangle(canvas, x + w * 0.35, y - h * 0.62, x + w / 2, y - h, x + w * 0.65, y - h * 0.62, snow);
}

function drawMapScene(id) {
  const c = createCanvas(1024, 576, [0, 0, 0, 255]);
  gradient(c, [116, 170, 210, 255], [80, 104, 92, 255]);
  rect(c, 0, 365, 1024, 211, [85, 124, 64, 255]);
  ellipse(c, 512, 552, 500, 150, [67, 91, 54, 255]);

  if (id.includes('mine')) {
    gradient(c, [36, 34, 39, 255], [66, 55, 47, 255]);
    rect(c, 0, 390, 1024, 186, [54, 47, 43, 255]);
    ellipse(c, 512, 275, 300, 170, [42, 36, 34, 255]);
    for (let i = 0; i < 6; i += 1) {
      const x = 170 + i * 130;
      line(c, x, 170, x - 45, 420, [93, 66, 42, 255], 6);
      line(c, x + 35, 170, x + 70, 420, [93, 66, 42, 255], 6);
      ellipse(c, x + 10, 315, 10, 7, [173, 155, 118, 255]);
    }
    line(c, 300, 520, 760, 520, [33, 31, 29, 255], 3);
    line(c, 330, 545, 790, 545, [33, 31, 29, 255], 3);
  } else if (id.includes('forest')) {
    gradient(c, [70, 116, 83, 255], [29, 66, 44, 255]);
    rect(c, 0, 360, 1024, 216, [44, 96, 49, 255]);
    for (let i = 0; i < 12; i += 1) drawTree(c, 40 + i * 86, 260 + (i % 3) * 18, 1.3, undefined, [24, 88, 43, 255]);
    rect(c, 445, 405, 135, 60, [88, 62, 36, 255]);
    triangle(c, 430, 405, 512, 340, 595, 405, [60, 48, 36, 255]);
  } else if (id.includes('marsh')) {
    gradient(c, [83, 104, 102, 255], [47, 69, 54, 255]);
    rect(c, 0, 355, 1024, 221, [43, 78, 59, 255]);
    for (let i = 0; i < 5; i += 1) ellipse(c, 160 + i * 170, 455 + (i % 2) * 35, 115, 28, [34, 93, 84, 255]);
    for (let i = 0; i < 7; i += 1) drawTree(c, 80 + i * 145, 305, 0.9, [74, 52, 31, 255], [55, 85, 54, 255]);
  } else if (id.includes('fortress') || id.includes('outer-wall') || id.includes('castle')) {
    gradient(c, [72, 69, 78, 255], [34, 29, 33, 255]);
    rect(c, 0, 380, 1024, 196, [53, 45, 45, 255]);
    drawCastle(c, 320, 245, 1.45, [69, 66, 70, 255], [50, 21, 28, 255]);
    for (let i = 0; i < 5; i += 1) ellipse(c, 180 + i * 170, 455, 8, 28, [212, 112, 50, 255]);
    if (id.includes('demon')) rect(c, 0, 0, 1024, 576, [60, 0, 0, 45]);
  } else if (id.includes('monastery') || id.includes('sacred')) {
    gradient(c, [150, 166, 186, 255], [95, 112, 95, 255]);
    rect(c, 0, 370, 1024, 206, [94, 112, 76, 255]);
    drawCastle(c, 360, 240, 1.2, id.includes('sacred') ? [220, 213, 184, 255] : [111, 107, 99, 255], [101, 80, 66, 255]);
    ellipse(c, 512, 448, 160, 42, id.includes('sacred') ? [143, 190, 184, 255] : [67, 76, 63, 255]);
  } else if (id.includes('canyon')) {
    gradient(c, [190, 136, 92, 255], [124, 72, 50, 255]);
    rect(c, 0, 355, 1024, 221, [141, 77, 49, 255]);
    drawMountain(c, -90, 400, 420, 260, [116, 61, 43, 255]);
    drawMountain(c, 680, 405, 430, 260, [102, 55, 44, 255]);
  } else if (id.includes('frozen')) {
    gradient(c, [172, 206, 230, 255], [118, 148, 176, 255]);
    rect(c, 0, 370, 1024, 206, [198, 214, 223, 255]);
    drawMountain(c, -20, 410, 420, 280, [112, 143, 173, 255], [238, 248, 255, 255]);
    drawMountain(c, 300, 425, 480, 330, [96, 129, 166, 255], [238, 248, 255, 255]);
    drawMountain(c, 700, 405, 360, 250, [123, 153, 184, 255], [238, 248, 255, 255]);
  } else if (id.includes('ruins')) {
    gradient(c, [158, 183, 158, 255], [92, 105, 79, 255]);
    rect(c, 0, 375, 1024, 201, [91, 108, 75, 255]);
    for (let i = 0; i < 7; i += 1) {
      rect(c, 170 + i * 110, 275 + (i % 2) * 25, 26, 155, [126, 124, 105, 255]);
      rect(c, 155 + i * 110, 265 + (i % 2) * 25, 56, 18, [140, 136, 113, 255]);
    }
  } else if (id.includes('dragon')) {
    gradient(c, [94, 70, 62, 255], [47, 34, 34, 255]);
    rect(c, 0, 370, 1024, 206, [60, 44, 40, 255]);
    drawMountain(c, 80, 420, 440, 270, [75, 53, 48, 255]);
    drawMountain(c, 545, 425, 390, 245, [65, 47, 45, 255]);
    ellipse(c, 520, 480, 150, 35, [174, 73, 33, 255]);
    for (let i = 0; i < 7; i += 1) ellipse(c, 380 + i * 45, 420 - (i % 2) * 12, 18, 28, [163, 135, 82, 255]);
  } else if (id.includes('archive')) {
    gradient(c, [82, 65, 92, 255], [46, 35, 54, 255]);
    rect(c, 0, 360, 1024, 216, [63, 48, 58, 255]);
    for (let i = 0; i < 6; i += 1) {
      rect(c, 60 + i * 165, 170, 90, 230, [80, 54, 38, 255]);
      for (let j = 0; j < 5; j += 1) rect(c, 70 + i * 165, 190 + j * 38, 70, 8, [153, 115, 65, 255]);
    }
    ellipse(c, 512, 420, 135, 36, [88, 65, 104, 255]);
  } else if (id.includes('capital-wall')) {
    gradient(c, [133, 179, 211, 255], [105, 128, 115, 255]);
    rect(c, 0, 372, 1024, 204, [84, 118, 71, 255]);
    drawCastle(c, 260, 255, 1.8, [151, 151, 138, 255], [113, 52, 42, 255]);
  } else if (id.includes('blacksmith')) {
    gradient(c, [120, 101, 86, 255], [72, 55, 45, 255]);
    rect(c, 0, 380, 1024, 196, [92, 70, 55, 255]);
    for (let i = 0; i < 4; i += 1) {
      rect(c, 130 + i * 210, 260, 135, 120, [105, 70, 43, 255]);
      triangle(c, 110 + i * 210, 260, 198 + i * 210, 205, 285 + i * 210, 260, [70, 45, 34, 255]);
      ellipse(c, 195 + i * 210, 350, 14, 32, [229, 102, 37, 255]);
    }
  } else if (id.includes('training')) {
    gradient(c, [145, 188, 211, 255], [105, 126, 82, 255]);
    rect(c, 0, 370, 1024, 206, [105, 132, 78, 255]);
    for (let i = 0; i < 7; i += 1) {
      rect(c, 140 + i * 120, 335, 12, 88, [98, 63, 35, 255]);
      ellipse(c, 146 + i * 120, 320, 26, 18, [151, 92, 48, 255]);
      line(c, 120 + i * 120, 370, 172 + i * 120, 370, [98, 63, 35, 255], 5);
    }
    rect(c, 330, 240, 360, 50, [121, 46, 42, 255]);
  } else {
    drawCastle(c, 420, 270, 0.9);
    for (let i = 0; i < 8; i += 1) drawTree(c, 60 + i * 125, 310 + (i % 2) * 12, 1);
  }

  return c;
}

function drawCharacter(canvas, cellX, cellY, role, female, frame) {
  const x = cellX + 128 + (frame % 2 === 0 ? -2 : 2);
  const y = cellY + 74 + (frame > 1 ? 2 : 0);
  const skin = female ? [231, 177, 132, 255] : [210, 151, 109, 255];
  const hair = role === 'blacksmith' ? [67, 45, 32, 255] : [43, 39, 55, 255];
  const cloak = role === 'tazza' ? [91, 56, 125, 255] : [88, 74, 60, 255];
  const trim = role === 'tazza' ? [221, 184, 96, 255] : [186, 117, 64, 255];
  const metal = [150, 155, 158, 255];
  const boot = [55, 42, 34, 255];

  ellipse(canvas, x, y + 156, 54, 10, [0, 0, 0, 60]);
  rect(canvas, x - 28, y + 50, 56, 72, cloak);
  rect(canvas, x - 30, y + 118, 22, 45, boot);
  rect(canvas, x + 8, y + 118, 22, 45, boot);
  ellipse(canvas, x, y + 30, 27, 30, skin);
  ellipse(canvas, x, y + 10, 30, 18, hair);
  rect(canvas, x - 22, y + 70, 44, 46, role === 'blacksmith' ? [100, 68, 45, 255] : [67, 44, 92, 255]);
  rect(canvas, x - 33, y + 77, 66, 12, trim);
  line(canvas, x - 28, y + 72, x - 56, y + 111, skin, 6);
  line(canvas, x + 28, y + 72, x + 58, y + 106, skin, 6);

  if (role === 'tazza') {
    rect(canvas, x - 66, y + 100, 26, 34, [236, 224, 184, 255]);
    rect(canvas, x - 62, y + 104, 18, 26, [119, 34, 45, 255]);
    ellipse(canvas, x + 67, y + 108, 11, 11, [236, 229, 203, 255]);
    setPixel(canvas, x + 63, y + 105, [40, 30, 30, 255]);
    setPixel(canvas, x + 70, y + 111, [40, 30, 30, 255]);
  } else {
    line(canvas, x + 55, y + 55, x + 83, y + 135, metal, 8);
    rect(canvas, x + 66, y + 125, 42, 22, metal);
    rect(canvas, x + 73, y + 129, 22, 14, [97, 65, 41, 255]);
    rect(canvas, x - 20, y + 84, 40, 40, [69, 63, 57, 255]);
  }
}

function drawHeroSheet(id) {
  const role = id.includes('blacksmith') ? 'blacksmith' : 'tazza';
  const female = id.includes('female');
  const transparent = createCanvas(512, 512, [0, 0, 0, 0]);
  const raw = createCanvas(512, 512, MAGENTA);
  for (let frame = 0; frame < 4; frame += 1) {
    const cellX = (frame % 2) * 256;
    const cellY = Math.floor(frame / 2) * 256;
    drawCharacter(transparent, cellX, cellY, role, female, frame);
    drawCharacter(raw, cellX, cellY, role, female, frame);
  }
  return { raw, transparent };
}

function itemPalette(id) {
  if (id.includes('black_dragon') || id.includes('demon') || id.includes('shadow') || id.includes('lich')) {
    return { metal: [64, 62, 73, 255], trim: [136, 52, 65, 255], glow: [158, 64, 178, 255], wood: [74, 45, 34, 255], cloth: [42, 38, 52, 255] };
  }
  if (id.includes('holy') || id.includes('blessed') || id.includes('sacred') || id.includes('arden') || id.includes('sanctuary') || id.includes('kings')) {
    return { metal: [222, 205, 151, 255], trim: [246, 236, 188, 255], glow: [255, 244, 190, 255], wood: [128, 84, 48, 255], cloth: [238, 232, 206, 255] };
  }
  if (id.includes('frost') || id.includes('ice') || id.includes('nidhogg')) {
    return { metal: [150, 182, 198, 255], trim: [222, 244, 255, 255], glow: [99, 190, 232, 255], wood: [82, 64, 58, 255], cloth: [80, 112, 142, 255] };
  }
  if (id.includes('fire') || id.includes('dragon') || id.includes('wyvern')) {
    return { metal: [126, 45, 38, 255], trim: [227, 148, 55, 255], glow: [255, 101, 43, 255], wood: [90, 52, 34, 255], cloth: [104, 34, 30, 255] };
  }
  if (id.includes('elf') || id.includes('forest') || id.includes('oak') || id.includes('hunter') || id.includes('wolf')) {
    return { metal: [108, 134, 84, 255], trim: [202, 178, 91, 255], glow: [92, 190, 103, 255], wood: [104, 70, 38, 255], cloth: [47, 88, 52, 255] };
  }
  if (id.includes('poison') || id.includes('slime') || id.includes('marsh') || id.includes('goblin') || id.includes('spider')) {
    return { metal: [89, 120, 75, 255], trim: [146, 198, 88, 255], glow: [91, 223, 101, 255], wood: [76, 55, 34, 255], cloth: [65, 92, 63, 255] };
  }
  if (id.includes('silver') || id.includes('steel') || id.includes('iron')) {
    return { metal: [166, 170, 166, 255], trim: [222, 224, 214, 255], glow: [164, 201, 229, 255], wood: [105, 66, 38, 255], cloth: [107, 91, 72, 255] };
  }
  return { metal: [139, 141, 139, 255], trim: [218, 161, 63, 255], glow: [111, 150, 214, 255], wood: [104, 63, 35, 255], cloth: [91, 70, 54, 255] };
}

function drawGem(canvas, x, y, color) {
  triangle(canvas, x, y - 18, x - 18, y + 2, x + 18, y + 2, color);
  triangle(canvas, x - 18, y + 2, x, y + 24, x + 18, y + 2, color);
  line(canvas, x - 10, y, x + 10, y, [255, 255, 255, 180], 2);
}

function drawBookIcon(canvas, palette) {
  rect(canvas, 78, 62, 98, 120, palette.cloth);
  rect(canvas, 88, 72, 82, 100, [225, 214, 180, 255]);
  line(canvas, 128, 66, 128, 178, [83, 58, 52, 255], 3);
  rect(canvas, 82, 62, 24, 120, palette.metal);
  drawGem(canvas, 142, 111, palette.glow);
}

function drawArmorIcon(canvas, palette) {
  triangle(canvas, 84, 86, 128, 54, 172, 86, palette.metal);
  rect(canvas, 91, 82, 74, 86, palette.metal);
  triangle(canvas, 91, 168, 128, 196, 165, 168, palette.metal);
  rect(canvas, 72, 98, 22, 52, palette.trim);
  rect(canvas, 162, 98, 22, 52, palette.trim);
  line(canvas, 128, 82, 128, 176, [60, 60, 64, 255], 3);
  line(canvas, 100, 116, 156, 116, palette.trim, 3);
  ellipse(canvas, 128, 102, 9, 9, palette.glow);
}

function drawShieldIcon(canvas, palette) {
  triangle(canvas, 76, 72, 180, 72, 128, 196, palette.metal);
  triangle(canvas, 96, 88, 160, 88, 128, 172, palette.cloth);
  line(canvas, 128, 78, 128, 184, palette.trim, 4);
  ellipse(canvas, 128, 126, 14, 14, palette.glow);
}

function drawJewelryIcon(canvas, palette, id) {
  if (id.includes('crown')) {
    rect(canvas, 72, 132, 112, 34, palette.trim);
    triangle(canvas, 76, 132, 92, 82, 108, 132, palette.trim);
    triangle(canvas, 112, 132, 128, 70, 144, 132, palette.trim);
    triangle(canvas, 148, 132, 164, 82, 180, 132, palette.trim);
    for (const [x, y] of [[92, 112], [128, 100], [164, 112]]) drawGem(canvas, x, y, palette.glow);
  } else if (id.includes('halo')) {
    ellipse(canvas, 128, 108, 62, 28, palette.trim);
    line(canvas, 84, 108, 172, 108, palette.glow, 4);
    drawGem(canvas, 128, 142, palette.glow);
  } else if (id.includes('beads')) {
    for (let i = 0; i < 14; i += 1) {
      const angle = (Math.PI * 2 * i) / 14;
      ellipse(canvas, 128 + Math.cos(angle) * 46, 122 + Math.sin(angle) * 38, 8, 8, palette.trim);
    }
    line(canvas, 128, 160, 128, 196, palette.trim, 4);
    line(canvas, 114, 182, 142, 182, palette.trim, 4);
  } else if (id.includes('earring')) {
    ellipse(canvas, 128, 94, 24, 24, palette.trim);
    line(canvas, 128, 114, 128, 158, palette.trim, 5);
    triangle(canvas, 105, 166, 128, 132, 151, 166, palette.cloth);
    drawGem(canvas, 128, 166, palette.glow);
  } else if (id.includes('ring')) {
    ellipse(canvas, 128, 130, 50, 50, palette.trim);
    ellipse(canvas, 128, 130, 30, 30, [0, 0, 0, 0]);
    drawGem(canvas, 128, 74, palette.glow);
  } else {
    ellipse(canvas, 128, 86, 28, 22, palette.trim);
    line(canvas, 128, 108, 128, 174, palette.trim, 4);
    triangle(canvas, 98, 176, 128, 126, 158, 176, palette.cloth);
    drawGem(canvas, 128, 160, palette.glow);
  }
}

function drawCloakIcon(canvas, palette, hood = false) {
  if (hood) ellipse(canvas, 128, 82, 42, 36, palette.cloth);
  triangle(canvas, 78, 182, 128, 60, 178, 182, palette.cloth);
  triangle(canvas, 98, 176, 128, 84, 158, 176, [39, 35, 47, 255]);
  line(canvas, 92, 126, 164, 126, palette.trim, 3);
  drawGem(canvas, 128, 126, palette.glow);
}

function drawBowIcon(canvas, palette, crossbow = false) {
  if (crossbow) {
    line(canvas, 65, 160, 180, 88, palette.wood, 8);
    line(canvas, 88, 104, 180, 104, palette.wood, 8);
    line(canvas, 90, 102, 64, 138, palette.metal, 5);
    line(canvas, 180, 104, 202, 139, palette.metal, 5);
    line(canvas, 69, 139, 199, 139, [64, 51, 42, 255], 3);
  } else {
    line(canvas, 82, 60, 72, 188, palette.wood, 6);
    line(canvas, 82, 60, 172, 128, [230, 226, 194, 255], 2);
    line(canvas, 72, 188, 172, 128, [230, 226, 194, 255], 2);
    line(canvas, 100, 128, 190, 128, palette.trim, 4);
    triangle(canvas, 190, 128, 164, 116, 164, 140, palette.metal);
  }
}

function drawPolearmIcon(canvas, palette, halberd = false) {
  line(canvas, 72, 188, 168, 56, palette.wood, 7);
  triangle(canvas, 162, 52, 194, 70, 166, 94, palette.metal);
  line(canvas, 156, 70, 188, 112, palette.trim, 4);
  if (halberd) triangle(canvas, 142, 82, 178, 110, 133, 128, palette.metal);
}

function drawAxeIcon(canvas, palette, pickaxe = false) {
  line(canvas, 78, 184, 158, 62, palette.wood, 8);
  if (pickaxe) {
    line(canvas, 104, 88, 196, 78, palette.metal, 7);
    triangle(canvas, 94, 90, 126, 70, 130, 96, palette.metal);
    triangle(canvas, 196, 78, 166, 62, 166, 92, palette.metal);
  } else {
    ellipse(canvas, 168, 82, 42, 28, palette.metal);
    triangle(canvas, 150, 58, 205, 82, 150, 106, palette.metal);
    line(canvas, 128, 88, 178, 112, palette.trim, 3);
  }
}

function drawBladeIcon(canvas, palette, dagger = false, twin = false) {
  const drawOne = (offset) => {
    line(canvas, 72 + offset, 180, 158 + offset, 76, palette.trim, dagger ? 4 : 6);
    triangle(canvas, 154 + offset, 72, 188 + offset, 42, 174 + offset, 90, palette.metal);
    rect(canvas, 58 + offset, 174, 36, 8, palette.wood);
    ellipse(canvas, 68 + offset, 190, 8, 8, palette.glow);
  };
  if (twin) {
    drawOne(-18);
    drawOne(22);
  } else {
    drawOne(dagger ? 16 : 0);
  }
}

function drawHammerIcon(canvas, palette, mace = false) {
  line(canvas, 82, 178, 160, 84, palette.wood, 8);
  if (mace) {
    ellipse(canvas, 170, 72, 32, 32, palette.metal);
    for (const [x, y] of [[143, 72], [170, 45], [197, 72], [170, 99]]) line(canvas, 170, 72, x, y, palette.trim, 4);
  } else {
    rect(canvas, 134, 55, 78, 34, palette.metal);
    rect(canvas, 150, 47, 28, 50, palette.trim);
  }
}

function drawStaffIcon(canvas, palette, wand = false, censer = false) {
  if (censer) {
    line(canvas, 98, 56, 156, 108, palette.trim, 3);
    line(canvas, 156, 108, 138, 158, palette.trim, 3);
    ellipse(canvas, 138, 162, 32, 24, palette.metal);
    rect(canvas, 112, 154, 52, 18, palette.trim);
    ellipse(canvas, 138, 130, 28, 38, [210, 210, 196, 90]);
  } else {
    line(canvas, wand ? 108 : 82, 190, wand ? 148 : 164, 60, palette.wood, wand ? 5 : 7);
    ellipse(canvas, wand ? 150 : 166, wand ? 58 : 58, wand ? 18 : 28, wand ? 18 : 28, palette.glow);
    line(canvas, wand ? 138 : 146, 76, wand ? 162 : 186, 76, palette.trim, 3);
  }
}

function drawRuneIcon(canvas, palette) {
  ellipse(canvas, 128, 118, 58, 74, [93, 90, 84, 255]);
  line(canvas, 126, 72, 126, 157, palette.trim, 4);
  line(canvas, 126, 108, 156, 84, palette.trim, 4);
  line(canvas, 126, 116, 96, 146, palette.trim, 4);
}

function drawEnhancementStoneIcon(canvas) {
  triangle(canvas, 95, 178, 128, 48, 162, 178, [72, 64, 168, 255]);
  triangle(canvas, 106, 170, 128, 70, 150, 170, [100, 79, 205, 255]);
  line(canvas, 128, 84, 128, 151, [229, 191, 81, 255], 4);
  line(canvas, 128, 116, 152, 96, [229, 191, 81, 255], 4);
  line(canvas, 128, 126, 104, 150, [229, 191, 81, 255], 4);
  for (const [x, y] of [[103, 92], [156, 132], [116, 172], [145, 70]]) {
    ellipse(canvas, x, y, 3, 3, [252, 224, 132, 255]);
  }
}

function drawItemIcon(id) {
  const raw = createCanvas(256, 256, MAGENTA);
  const clean = createCanvas(256, 256, [0, 0, 0, 0]);
  const palette = itemPalette(id);
  for (const c of [raw, clean]) {
    ellipse(c, 128, 142, 86, 24, [0, 0, 0, 55]);
    if (id.includes('card')) {
      rect(c, 82, 62, 70, 105, [237, 225, 190, 255]);
      rect(c, 104, 52, 70, 105, [248, 239, 211, 255]);
      ellipse(c, 139, 103, 18, 18, [146, 40, 48, 255]);
    } else if (id.includes('dice')) {
      rect(c, 68, 92, 66, 66, [238, 229, 203, 255]);
      rect(c, 130, 78, 66, 66, [226, 214, 185, 255]);
      for (const [x, y] of [[88, 112], [112, 136], [150, 98], [176, 124]]) ellipse(c, x, y, 5, 5, [54, 42, 35, 255]);
    } else if (id.includes('armor') || id.includes('plate') || id.includes('mail') || id.includes('vest')) {
      drawArmorIcon(c, palette);
    } else if (id.includes('shield')) {
      drawShieldIcon(c, palette);
    } else if (id.includes('crown') || id.includes('halo') || id.includes('ring') || id.includes('earring') || id.includes('beads') || id.includes('charm') || id.includes('talisman')) {
      drawJewelryIcon(c, palette, id);
    } else if (id.includes('cloak') || id.includes('hood')) {
      drawCloakIcon(c, palette, id.includes('hood'));
    } else if (id.includes('grimoire') || id.includes('codex')) {
      drawBookIcon(c, palette);
    } else if (id.includes('bow') || id.includes('crossbow')) {
      drawBowIcon(c, palette, id.includes('crossbow'));
    } else if (id.includes('spear') || id.includes('halberd')) {
      drawPolearmIcon(c, palette, id.includes('halberd'));
    } else if (id.includes('axe') || id.includes('pickaxe')) {
      drawAxeIcon(c, palette, id.includes('pickaxe'));
    } else if (id.includes('dagger') || id.includes('cutlass') || id.includes('twinblade')) {
      drawBladeIcon(c, palette, true, id.includes('twinblade'));
    } else if (id.includes('sword') || id.includes('blade') || id.includes('longsword') || id.includes('greatsword')) {
      drawBladeIcon(c, palette, false, false);
    } else if (id.includes('staff') || id.includes('wand') || id.includes('censer')) {
      drawStaffIcon(c, palette, id.includes('wand'), id.includes('censer'));
    } else if (id.includes('mace') || id.includes('hammer')) {
      drawHammerIcon(c, palette, id.includes('mace'));
    } else if (id.includes('enhancement')) {
      drawEnhancementStoneIcon(c);
    } else if (id.includes('rune')) {
      drawRuneIcon(c, palette);
    } else if (id.includes('ore')) {
      triangle(c, 68, 156, 108, 68, 146, 165, [74, 72, 74, 255]);
      triangle(c, 120, 165, 168, 82, 202, 162, [91, 86, 84, 255]);
      ellipse(c, 139, 120, 10, 7, [181, 179, 159, 255]);
    } else if (id.includes('scale')) {
      for (let i = 0; i < 5; i += 1) ellipse(c, 78 + i * 25, 122 + (i % 2) * 12, 30, 46, [130, 38, 36, 255]);
      line(c, 80, 123, 178, 123, palette.trim, 3);
    } else if (id.includes('relic')) {
      ellipse(c, 128, 118, 48, 62, [204, 157, 58, 255]);
      rect(c, 102, 100, 52, 62, [224, 190, 95, 255]);
      line(c, 128, 65, 128, 96, [244, 236, 207, 255], 5);
      line(c, 112, 80, 144, 80, [244, 236, 207, 255], 5);
    } else {
      drawBowIcon(c, palette, true);
    }
  }
  return { raw, clean };
}

function writeSpriteAsset(asset) {
  const out = join(ROOT, asset.outputDir);
  mkdirSync(join(out, 'raw'), { recursive: true });
  mkdirSync(join(out, 'processed'), { recursive: true });
  writeFileSync(join(out, 'prompt-used.txt'), `${asset.prompt}\n`);

  if (asset.sheet === '2x2') {
    const { raw, transparent } = drawHeroSheet(asset.id);
    savePng(join(out, 'raw/raw-sheet.png'), raw);
    savePng(join(out, 'processed/raw-sheet.png'), raw);
    savePng(join(out, 'processed/sheet-transparent.png'), transparent);
  } else {
    const { raw, clean } = drawItemIcon(asset.id);
    savePng(join(out, 'raw/raw-sheet.png'), raw);
    savePng(join(out, 'processed/raw-sheet.png'), raw);
    savePng(join(out, 'processed/clean.png'), clean);
  }

  const rawPath = join(out, 'raw/raw-sheet.png');
  const source = copyGeneratedSource(asset, rawPath);
  const meta = {
    id: asset.id,
    label: asset.label,
    category: asset.category,
    kind: 'sprite',
    sheet: asset.sheet,
    generatedWith: getGeneratedWith(asset),
    source,
    outputSize: asset.sheet === '2x2' ? [512, 512] : [256, 256]
  };
  writeFileSync(join(out, 'processed/pipeline-meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
  writeFileSync(join(out, 'asset.json'), `${JSON.stringify({ ...meta, prompt: asset.prompt }, null, 2)}\n`);
}

function writeMapAsset(asset) {
  const out = join(ROOT, asset.outputDir);
  mkdirSync(join(out, 'raw'), { recursive: true });
  mkdirSync(join(out, 'processed'), { recursive: true });
  writeFileSync(join(out, 'prompt-used.txt'), `${asset.prompt}\n`);
  const scene = drawMapScene(asset.id);
  const rawPath = join(out, 'raw/background.png');
  savePng(rawPath, scene);
  const source = copyGeneratedSource(asset, rawPath);
  const meta = {
    id: asset.id,
    label: asset.label,
    category: asset.category,
    kind: 'map',
    generatedWith: getGeneratedWith(asset),
    source,
    outputSize: [1024, 576]
  };
  writeFileSync(join(out, 'processed/pipeline-meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
  writeFileSync(join(out, 'asset.json'), `${JSON.stringify({ ...meta, prompt: asset.prompt }, null, 2)}\n`);
}

function updateManifest() {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  delete manifest.heeheeRpgGeneratedAt;
  manifest.medievalRpgGeneratedAt = new Date().toISOString();
  const byId = new Map(manifest.assets.map((entry) => [entry.id, entry]));

  for (const entry of manifest.assets) {
    const asset = getRpgAssetById(entry.id);
    if (!asset) continue;
    entry.label = asset.label;
    entry.category = asset.category;
    entry.kind = asset.kind;
    if (asset.sheet) entry.sheet = asset.sheet;
    if (entry.prompt) entry.prompt = `${asset.outputDir}/prompt-used.txt`;
  }

  for (const id of NEW_ASSET_IDS) {
    const asset = getRpgAssetById(id);
    if (!asset) throw new Error(`Unknown RPG asset id: ${id}`);
    const base = {
      id: asset.id,
      label: asset.label,
      category: asset.category,
      kind: asset.kind,
      generatedWith: getGeneratedWith(asset),
      source: getSourcePath(asset),
      prompt: `${asset.outputDir}/prompt-used.txt`,
      meta: `${asset.outputDir}/processed/pipeline-meta.json`
    };

    const entry = asset.kind === 'map'
      ? {
          ...base,
          raw: `${asset.outputDir}/raw/background.png`,
          status: 'generated',
          outputSize: [1024, 576]
        }
      : {
          ...base,
          sheet: asset.sheet,
          raw: `${asset.outputDir}/raw/raw-sheet.png`,
          processedDir: `${asset.outputDir}/processed`,
          status: 'processed',
          processorStdout: `${asset.outputDir}/processed`,
          ...(asset.sheet === '2x2'
            ? { transparentSheet: `${asset.outputDir}/processed/sheet-transparent.png` }
            : {})
        };
    byId.set(id, { ...(byId.get(id) ?? {}), ...entry });
  }

  manifest.assets = manifest.assets
    .filter((entry) => !String(entry.raw ?? '').includes('assets/rpg/heehee-rpg/'))
    .map((entry) => byId.get(entry.id) ?? entry);

  for (const id of NEW_ASSET_IDS) {
    if (!manifest.assets.some((entry) => entry.id === id)) {
      manifest.assets.push(byId.get(id));
    }
  }

  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
}

rmSync(join(ROOT, 'assets/rpg/heehee-rpg'), { recursive: true, force: true });

for (const id of HERO_IDS) writeSpriteAsset(getRpgAssetById(id));
for (const id of ITEM_IDS) writeSpriteAsset(getRpgAssetById(id));
for (const id of MAP_IDS) writeMapAsset(getRpgAssetById(id));

updateManifest();

console.log(`Generated ${NEW_ASSET_IDS.length} medieval RPG assets and updated manifest.`);
