import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  getMiningOreAssets,
  getMiningPickaxeAssets
} from '../src/systems/mining-assets.js';

const WIDTH = 128;
const HEIGHT = 128;
const RARITY_COLORS = Object.freeze({
  common: [148, 163, 184],
  uncommon: [34, 197, 94],
  rare: [59, 130, 246],
  epic: [168, 85, 247],
  legendary: [245, 158, 11],
  hidden: [236, 72, 153]
});
const TIER_COLORS = Object.freeze({
  copper: [184, 115, 51],
  iron: [156, 163, 175],
  steel: [71, 85, 105],
  crystal: [34, 211, 238],
  gold: [245, 158, 11],
  platinum: [226, 232, 240],
  mithril: [96, 165, 250],
  dragon: [239, 68, 68],
  celestial: [250, 250, 250],
  void: [88, 28, 135],
  mythic: [244, 114, 182]
});

async function main() {
  await writeReadme();
  for (const asset of getMiningOreAssets()) await writeOreAsset(asset);
  for (const asset of getMiningPickaxeAssets()) await writePickaxeAsset(asset);
  console.log(`Generated ${getMiningOreAssets().length} ore icons and ${getMiningPickaxeAssets().length} pickaxe icons.`);
}

async function writeReadme() {
  await mkdir('assets/mining', { recursive: true });
  await writeFile('assets/mining/README.md', [
    '# Mining Generated Assets',
    '',
    '`agent-sprite-forge`의 `$generate2dsprite` 산출물 계약에 맞춰 광산 광석과 곡괭이 이미지를 둔다.',
    '',
    '```text',
    'assets/mining/ores/<rarity>/<ore-id>/',
    '  icon.png',
    '  asset-meta.json',
    '  prompt-used.txt',
    '',
    'assets/mining/pickaxes/level-001/ ... level-100/',
    '  icon.png',
    '  asset-meta.json',
    '  prompt-used.txt',
    '```',
    '',
    '- 에셋 id와 프롬프트는 `src/systems/mining-assets.js`를 기준으로 관리한다.',
    '- 모든 광석 시스템 id는 `src/systems/mining.js`의 `assetId: ore_<id>`와 연결된다.',
    '- 곡괭이 이미지는 강화 단계별로 `pickaxe_001`부터 `pickaxe_100`까지 100종을 사용한다.',
    '- 일반 게임 응답에는 내부 에셋 id를 노출하지 않고 필요한 이미지만 Discord 첨부로 보낸다.',
    '- 히든 광석도 manifest에는 포함되지만 게임 내 획득 조건은 공개하지 않는다.',
    ''
  ].join('\n'));
}

async function writeOreAsset(asset) {
  const image = createCanvas(WIDTH, HEIGHT);
  const base = RARITY_COLORS[asset.rarity] ?? RARITY_COLORS.common;
  const seed = hashString(asset.id);
  drawSoftShadow(image, 64, 76, 38, 18);
  drawOreBody(image, seed, base);
  drawSparkles(image, seed, base, asset.rarity === 'hidden' ? 9 : 5);
  await writeAssetFiles(asset, encodePng(image.width, image.height, image.pixels), {
    generator: '$generate2dsprite',
    deterministicRenderer: 'tools/generate-mining-assets.js',
    kind: asset.kind,
    id: asset.id,
    oreId: asset.oreId,
    rarity: asset.rarity,
    prompt: asset.prompt
  });
}

async function writePickaxeAsset(asset) {
  const image = createCanvas(WIDTH, HEIGHT);
  const seed = hashString(asset.id);
  const base = TIER_COLORS[asset.tier] ?? TIER_COLORS.copper;
  drawSoftShadow(image, 64, 84, 42, 14);
  drawPickaxe(image, seed, base, asset.level);
  await writeAssetFiles(asset, encodePng(image.width, image.height, image.pixels), {
    generator: '$generate2dsprite',
    deterministicRenderer: 'tools/generate-mining-assets.js',
    kind: asset.kind,
    id: asset.id,
    level: asset.level,
    tier: asset.tier,
    prompt: asset.prompt
  });
}

async function writeAssetFiles(asset, png, meta) {
  await mkdir(dirname(asset.imagePath), { recursive: true });
  await writeFile(asset.imagePath, png);
  await writeFile(`${asset.outputDir}/prompt-used.txt`, `${asset.prompt}\n`);
  await writeFile(`${asset.outputDir}/asset-meta.json`, `${JSON.stringify(meta, null, 2)}\n`);
}

function createCanvas(width, height) {
  return { width, height, pixels: new Uint8Array(width * height * 4) };
}

function drawOreBody(image, seed, base) {
  const points = [];
  const count = 8 + (seed % 4);
  for (let index = 0; index < count; index += 1) {
    const angle = (Math.PI * 2 * index) / count + ((seed % 19) - 9) * 0.006;
    const radius = 34 + ((seed >> (index % 16)) & 15) - 5;
    const x = 64 + Math.cos(angle) * radius * (0.9 + (index % 3) * 0.04);
    const y = 63 + Math.sin(angle) * radius * (0.78 + (index % 2) * 0.06);
    points.push([x, y]);
  }
  fillPolygon(image, points, darken(base, 0.62), 255);

  const inner = points.map(([x, y]) => [64 + (x - 64) * 0.78, 63 + (y - 63) * 0.78]);
  fillPolygon(image, inner, base, 245);

  for (let i = 0; i < 5; i += 1) {
    const color = i % 2 === 0 ? lighten(base, 1.35) : darken(base, 0.72);
    const fx = 36 + ((seed >> (i * 3)) & 31);
    const fy = 34 + ((seed >> (i * 4 + 2)) & 31);
    fillPolygon(image, [[64, 63], [fx, fy], [fx + 16, fy + 8]], color, 115);
  }

  drawLine(image, 40, 42, 82, 34, lighten(base, 1.6), 3, 210);
  drawLine(image, 36, 70, 88, 88, darken(base, 0.5), 4, 120);
}

function drawPickaxe(image, seed, base, level) {
  const handle = [116, 82, 38];
  const grip = [92, 52, 26];
  drawLine(image, 40, 96, 86, 34, darken(handle, 0.75), 13, 255);
  drawLine(image, 42, 94, 84, 36, handle, 8, 255);
  drawLine(image, 47, 87, 55, 76, grip, 5, 255);
  drawLine(image, 61, 69, 69, 58, grip, 5, 255);

  const shine = lighten(base, 1.35 + Math.min(0.35, level / 300));
  drawLine(image, 34, 38, 93, 31, darken(base, 0.55), 16, 255);
  drawLine(image, 34, 38, 93, 31, base, 10, 255);
  drawLine(image, 31, 39, 18, 52, darken(base, 0.6), 11, 255);
  drawLine(image, 93, 31, 105, 43, darken(base, 0.6), 11, 255);
  drawLine(image, 39, 35, 86, 30, shine, 3, 220);

  if (level >= 20) drawCircle(image, 72, 50, 5, shine, 220);
  if (level >= 40) drawLine(image, 29, 27, 99, 19, lighten(base, 1.6), 2, 180);
  if (level >= 60) drawSparkles(image, seed + level, base, 4);
  if (level >= 80) drawCircle(image, 64, 64, 44, lighten(base, 1.2), 22);
  if (level >= 100) drawSparkles(image, seed + level * 7, [255, 255, 255], 8);
}

function drawSoftShadow(image, cx, cy, rx, ry) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const dist = dx * dx + dy * dy;
      if (dist <= 1) blendPixel(image, x, y, 0, 0, 0, Math.floor((1 - dist) * 80));
    }
  }
}

function drawSparkles(image, seed, base, count) {
  for (let i = 0; i < count; i += 1) {
    const x = 18 + ((seed >> (i * 3)) & 91);
    const y = 16 + ((seed >> (i * 5)) & 87);
    const color = lighten(base, 1.75);
    drawLine(image, x - 3, y, x + 3, y, color, 1, 200);
    drawLine(image, x, y - 3, x, y + 3, color, 1, 200);
  }
}

function drawCircle(image, cx, cy, radius, color, alpha = 255) {
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y += 1) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= radius * radius) blendPixel(image, x, y, color[0], color[1], color[2], alpha);
    }
  }
}

function fillPolygon(image, points, color, alpha = 255) {
  const minY = Math.max(0, Math.floor(Math.min(...points.map((p) => p[1]))));
  const maxY = Math.min(image.height - 1, Math.ceil(Math.max(...points.map((p) => p[1]))));
  for (let y = minY; y <= maxY; y += 1) {
    const intersections = [];
    for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
      const [xi, yi] = points[i];
      const [xj, yj] = points[j];
      if ((yi > y) !== (yj > y)) intersections.push(xi + ((y - yi) * (xj - xi)) / (yj - yi));
    }
    intersections.sort((a, b) => a - b);
    for (let i = 0; i < intersections.length; i += 2) {
      const start = Math.max(0, Math.floor(intersections[i]));
      const end = Math.min(image.width - 1, Math.ceil(intersections[i + 1]));
      for (let x = start; x <= end; x += 1) blendPixel(image, x, y, color[0], color[1], color[2], alpha);
    }
  }
}

function drawLine(image, x1, y1, x2, y2, color, thickness = 1, alpha = 255) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  for (let i = 0; i <= steps; i += 1) {
    const t = steps === 0 ? 0 : i / steps;
    const x = x1 + dx * t;
    const y = y1 + dy * t;
    drawCircle(image, x, y, thickness / 2, color, alpha);
  }
}

function blendPixel(image, x, y, r, g, b, a) {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= image.width || py >= image.height || a <= 0) return;
  const index = (py * image.width + px) * 4;
  const srcA = a / 255;
  const dstA = image.pixels[index + 3] / 255;
  const outA = srcA + dstA * (1 - srcA);
  if (outA <= 0) return;
  image.pixels[index] = Math.round((r * srcA + image.pixels[index] * dstA * (1 - srcA)) / outA);
  image.pixels[index + 1] = Math.round((g * srcA + image.pixels[index + 1] * dstA * (1 - srcA)) / outA);
  image.pixels[index + 2] = Math.round((b * srcA + image.pixels[index + 2] * dstA * (1 - srcA)) / outA);
  image.pixels[index + 3] = Math.round(outA * 255);
}

function lighten(color, factor) {
  return color.map((value) => Math.min(255, Math.round(value * factor)));
}

function darken(color, factor) {
  return color.map((value) => Math.max(0, Math.round(value * factor)));
}

function hashString(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

function encodePng(width, height, rgba) {
  const scanlineLength = width * 4 + 1;
  const raw = Buffer.alloc(scanlineLength * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * scanlineLength] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4)
      .copy(raw, y * scanlineLength + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', Buffer.concat([u32(width), u32(height), Buffer.from([8, 6, 0, 0, 0])])),
    pngChunk('IDAT', (awaitImportZlib()).deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

function awaitImportZlib() {
  // Static require is unavailable in ESM; createRequire would be overkill for this tiny script.
  return zlibModule;
}

import zlibModule from 'node:zlib';

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  return Buffer.concat([u32(data.length), typeBuffer, data, u32(crc32(Buffer.concat([typeBuffer, data])))]);
}

function u32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0, 0);
  return buffer;
}

const CRC_TABLE = new Uint32Array(256).map((_, index) => {
  let c = index;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
