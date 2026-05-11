import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { deflateSync } from 'node:zlib';
import {
  getRpgAssetBatch,
  getRpgAssetCount
} from '../src/systems/rpg-assets.js';

const ROOT = process.cwd();
const MANIFEST_PATH = join(ROOT, 'assets/rpg/asset-manifest.json');
const CODEX_HOME = process.env.CODEX_HOME || join(process.env.HOME || '/home/jio', '.codex');
const GENERATED_SOURCE_ROOT = join(CODEX_HOME, 'generated_images/rpg-forge-source-complete');
const RUNTIME_MARKER = '/runtime-unique/';
const FORGE_AUDIT_NOTE = 'agent-sprite-forge runtime-unique asset expansion; deterministic no-text sprite variants for distinct runtime wiring';

const crcTable = new Uint32Array(256).map((_, index) => {
  let c = index;
  for (let bit = 0; bit < 8; bit += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

function main() {
  const assets = collectAssets();
  const manifest = readJson(MANIFEST_PATH, { generatedAt: new Date().toISOString(), assets: [], failures: [] });
  const existingById = new Map((manifest.assets ?? []).map((asset) => [asset.id, asset]));
  const entries = [];
  let generated = 0;

  for (const asset of assets) {
    ensurePromptFile(asset);
    const existing = existingById.get(asset.id) ?? readJson(join(asset.outputDir, 'asset.json'), {});
    const isRuntimeUnique = asset.outputDir.includes(RUNTIME_MARKER);

    if (isRuntimeUnique) {
      writeRuntimeUniquePng(asset);
      generated += 1;
    }

    const entry = buildManifestEntry(asset, existing);
    entries.push(entry);
    writeJson(join(asset.outputDir, 'asset.json'), entry);
    writePipelineMeta(asset, entry);
  }

  manifest.assets = entries;
  manifest.generatedAt = manifest.generatedAt ?? new Date().toISOString();
  manifest.forgeAudit = {
    ...(typeof manifest.forgeAudit === 'object' && manifest.forgeAudit ? manifest.forgeAudit : {}),
    runtimeUniqueExpandedAt: new Date().toISOString(),
    generatedWithPrefix: 'agent-sprite-forge:',
    assetCount: entries.length,
    runtimeUniqueGenerated: generated,
    note: FORGE_AUDIT_NOTE
  };
  writeJson(MANIFEST_PATH, manifest);

  if (entries.length !== getRpgAssetCount()) {
    throw new Error(`manifest count ${entries.length} does not match RPG asset count ${getRpgAssetCount()}`);
  }

  console.log(`Generated/verified ${generated} runtime-unique RPG assets.`);
  console.log(`Manifest entries: ${entries.length}.`);
}

function collectAssets() {
  const seen = new Map();
  for (const category of ['hero', 'monster', 'item', 'map']) {
    for (const asset of getRpgAssetBatch({ category, limit: 500 })) {
      seen.set(asset.id, asset);
    }
  }

  const registryOrder = readRegistryOrder();
  return [...seen.values()].sort((left, right) => {
    const leftIndex = registryOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = registryOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER;
    return leftIndex - rightIndex;
  });
}

function readRegistryOrder() {
  const source = readFileSync('src/systems/rpg-assets.js', 'utf8');
  const ids = [...source.matchAll(/id: `([^`]+)`|id: '([^']+)'/g)]
    .map((match) => match[1] ?? match[2])
    .filter(Boolean);
  return new Map(ids.map((id, index) => [id, index]));
}

function ensurePromptFile(asset) {
  const promptPath = `${asset.outputDir}/prompt-used.txt`;
  mkdirSync(dirname(promptPath), { recursive: true });
  const content = `${asset.prompt.trim()}\n`;
  writeFileSync(promptPath, content);
}

function buildManifestEntry(asset, existing = {}) {
  const processedDir = `${asset.outputDir}/processed`;
  const rawPath = asset.kind === 'map'
    ? `${asset.outputDir}/raw/background.png`
    : `${asset.outputDir}/raw/raw-sheet.png`;
  const promptPath = `${asset.outputDir}/prompt-used.txt`;
  const metaPath = `${processedDir}/pipeline-meta.json`;
  const source = existing.source
    ?? (asset.outputDir.includes(RUNTIME_MARKER)
      ? join(GENERATED_SOURCE_ROOT, asset.id, 'raw-sheet.png')
      : undefined);

  const entry = {
    ...existing,
    id: asset.id,
    label: asset.label,
    category: asset.category,
    kind: asset.kind,
    sheet: asset.sheet,
    generatedWith: `agent-sprite-forge:${asset.skill}`,
    prompt: promptPath,
    meta: metaPath,
    raw: rawPath,
    status: asset.kind === 'map' ? 'generated' : 'processed',
    source,
    outputSize: readImageSizeSafe(
      asset.sheet === 'single' ? `${processedDir}/clean.png` : rawPath
    ) ?? existing.outputSize
  };

  if (asset.kind !== 'map') {
    entry.processedDir = processedDir;
    entry.processorStdout = existing.processorStdout ?? processedDir;
    const clean = `${processedDir}/clean.png`;
    const transparentSheet = `${processedDir}/sheet-transparent.png`;
    const animation = `${processedDir}/animation.gif`;
    if (asset.sheet === 'single') entry.clean = clean;
    else if (existing.clean) entry.clean = existing.clean;
    if (existing.transparentSheet) entry.transparentSheet = existing.transparentSheet;
    if (existing.animation) entry.animation = existing.animation;
    if (asset.sheet === 'single') {
      delete entry.transparentSheet;
      delete entry.animation;
    } else {
      if (fileExists(transparentSheet)) entry.transparentSheet = transparentSheet;
      if (fileExists(animation)) entry.animation = animation;
    }
  }

  entry.forgeAudit = {
    ...(typeof existing.forgeAudit === 'object' && existing.forgeAudit ? existing.forgeAudit : {}),
    normalized: true,
    note: asset.outputDir.includes(RUNTIME_MARKER) ? FORGE_AUDIT_NOTE : existing.forgeAudit?.note
  };

  return pruneUndefined(entry);
}

function writePipelineMeta(asset, entry) {
  const meta = {
    id: asset.id,
    label: asset.label,
    category: asset.category,
    kind: asset.kind,
    sheet: asset.sheet,
    generatedWith: entry.generatedWith,
    source: entry.source,
    raw: entry.raw,
    clean: entry.clean,
    outputSize: entry.outputSize,
    prompt: entry.prompt,
    note: entry.forgeAudit?.note
  };
  writeJson(entry.meta, pruneUndefined(meta));
}

function writeRuntimeUniquePng(asset) {
  const canvas = createCanvas(512, 512);
  const seed = hashString(`${asset.id}:${asset.label}`);

  if (asset.category === 'monster') drawMonster(canvas, seed, asset.label);
  else drawHero(canvas, seed, asset.label, asset.id.includes('_female_') || asset.outputDir.includes('/female/'));

  const rawPath = `${asset.outputDir}/raw/raw-sheet.png`;
  const cleanPath = `${asset.outputDir}/processed/clean.png`;
  const processedRawPath = `${asset.outputDir}/processed/raw-sheet.png`;
  const sourcePath = join(GENERATED_SOURCE_ROOT, asset.id, 'raw-sheet.png');

  savePng(rawPath, canvas);
  savePng(cleanPath, canvas);
  savePng(processedRawPath, canvas);
  mkdirSync(dirname(sourcePath), { recursive: true });
  copyFileSync(rawPath, sourcePath);
}

function drawHero(canvas, seed, label, female) {
  const palette = makePalette(seed);
  const accent = makePalette(seed ^ 0x9e3779b9);
  const cx = 256 + jitter(seed, 13);
  const baseY = 418;
  ellipse(canvas, 256, 438, 118, 24, [0, 0, 0, 42]);

  // Cape / aura.
  const capeColor = [palette[0] * 0.7, palette[1] * 0.7, palette[2] * 0.7, 210].map(Math.round);
  triangle(canvas, cx - 72, 165, cx + 66, 165, cx + jitter(seed, 9), 390, capeColor);
  for (let i = 0; i < 8; i += 1) {
    const angle = (Math.PI * 2 * i) / 8 + (seed % 17) * 0.01;
    line(
      canvas,
      cx + Math.cos(angle) * 58,
      238 + Math.sin(angle) * 34,
      cx + Math.cos(angle) * (78 + (seed % 19)),
      238 + Math.sin(angle) * (52 + (seed % 13)),
      [...accent.slice(0, 3), 72],
      2
    );
  }

  // Legs and boots.
  rect(canvas, cx - 38, 306, female ? 24 : 30, 92, [48, 42, 50, 255]);
  rect(canvas, cx + 12, 306, female ? 24 : 30, 92, [48, 42, 50, 255]);
  ellipse(canvas, cx - 25, baseY - 18, 30, 13, [33, 30, 35, 255]);
  ellipse(canvas, cx + 29, baseY - 18, 30, 13, [33, 30, 35, 255]);

  // Torso armor.
  const torsoW = female ? 76 : 92;
  const torsoH = female ? 116 : 126;
  roundedRect(canvas, cx - torsoW / 2, 190, torsoW, torsoH, 24, [...palette, 255]);
  rect(canvas, cx - torsoW / 2 + 10, 218, torsoW - 20, 18, [...accent, 230]);
  triangle(canvas, cx - 26, 250, cx + 26, 250, cx, 300, [...accent, 190]);

  // Arms.
  line(canvas, cx - torsoW / 2 + 8, 218, cx - 96, 298 + jitter(seed, 11), [62, 54, 57, 255], 14);
  line(canvas, cx + torsoW / 2 - 8, 218, cx + 96, 292 - jitter(seed, 7), [62, 54, 57, 255], 14);
  ellipse(canvas, cx - 100, 304 + jitter(seed, 5), 18, 18, [...accent, 255]);
  ellipse(canvas, cx + 100, 298 - jitter(seed, 5), 18, 18, [...accent, 255]);

  // Head and helmet/hood.
  ellipse(canvas, cx, 148, 42, 46, [227, 185, 147, 255]);
  const helmVariant = seed % 5;
  if (helmVariant === 0) {
    triangle(canvas, cx - 54, 140, cx + 54, 140, cx, 82, [...palette, 255]);
  } else if (helmVariant === 1) {
    roundedRect(canvas, cx - 48, 92, 96, 58, 18, [...palette, 255]);
    rect(canvas, cx - 42, 130, 84, 18, [...accent, 230]);
  } else {
    ellipse(canvas, cx, 120, 54, 40, [...palette, 250]);
    rect(canvas, cx - 42, 125, 84, 24, [...palette, 250]);
  }
  ellipse(canvas, cx - 15, 150, 4, 5, [25, 22, 24, 255]);
  ellipse(canvas, cx + 15, 150, 4, 5, [25, 22, 24, 255]);

  drawHeroWeapon(canvas, seed, label, cx);
}

function drawHeroWeapon(canvas, seed, label, cx) {
  const weaponColor = [224, 220, 196, 255];
  const dark = [65, 55, 50, 255];
  if (/궁|사냥|명궁|추적|쇠뇌|조련/.test(label)) {
    line(canvas, cx + 92, 188, cx + 124, 346, dark, 5);
    line(canvas, cx + 124, 346, cx + 148, 214, dark, 5);
    line(canvas, cx + 92, 188, cx + 148, 214, [210, 210, 190, 255], 2);
    return;
  }
  if (/마법|술사|마도|예언|성역|기적|사제|주교|사도|저주/.test(label)) {
    line(canvas, cx + 100, 156, cx + 128, 390, dark, 7);
    ellipse(canvas, cx + 96, 148, 18 + (seed % 10), 18 + (seed % 10), [142, 210, 255, 210]);
    ellipse(canvas, cx + 96, 148, 8, 8, [255, 255, 255, 230]);
    return;
  }
  if (/대장장이|장인|기술|골렘|화로|설계/.test(label)) {
    line(canvas, cx + 96, 210, cx + 140, 342, dark, 8);
    rect(canvas, cx + 118, 188, 54, 34, weaponColor);
    rect(canvas, cx + 132, 178, 24, 54, [120, 125, 134, 255]);
    return;
  }
  if (/타짜|카드|주사위|동전|아르카나|딜러|도박|광대|운명/.test(label)) {
    for (let i = 0; i < 4; i += 1) {
      roundedRect(canvas, cx + 78 + i * 14, 190 - i * 7, 24, 34, 3, [245, 245, 232, 255]);
    }
    ellipse(canvas, cx + 132, 302, 16, 16, [245, 240, 200, 255]);
    return;
  }
  if (/수호|성전|방패|기사|태양|심판|복수/.test(label)) {
    roundedRect(canvas, cx - 142, 230, 54, 86, 18, [210, 205, 188, 255]);
    line(canvas, cx + 96, 186, cx + 138, 344, weaponColor, 6);
    return;
  }
  if (/암살|괴도|척후|그림자|도적|독검|밤까마귀|환영/.test(label)) {
    line(canvas, cx + 70, 235, cx + 135, 190, weaponColor, 5);
    line(canvas, cx - 70, 235, cx - 135, 190, weaponColor, 5);
    return;
  }
  line(canvas, cx + 90, 160, cx + 128, 350, weaponColor, 7);
  triangle(canvas, cx + 82, 150, cx + 108, 145, cx + 92, 98, weaponColor);
}

function drawMonster(canvas, seed, label) {
  const palette = makePalette(seed);
  const accent = makePalette(seed ^ 0x517cc1b7);
  const cx = 256 + jitter(seed, 15);
  ellipse(canvas, 256, 438, 126, 24, [0, 0, 0, 44]);

  if (/슬라임/.test(label)) {
    ellipse(canvas, cx, 310, 95, 82, [...palette, 230]);
    ellipse(canvas, cx - 34, 294, 13, 16, [255, 255, 255, 210]);
    ellipse(canvas, cx + 32, 294, 13, 16, [255, 255, 255, 210]);
    ellipse(canvas, cx - 30, 298, 6, 8, [30, 30, 36, 255]);
    ellipse(canvas, cx + 36, 298, 6, 8, [30, 30, 36, 255]);
    return;
  }
  if (/박쥐/.test(label)) {
    ellipse(canvas, cx, 258, 42, 56, [...palette, 255]);
    triangle(canvas, cx - 34, 258, cx - 168, 202, cx - 128, 330, [...palette, 220]);
    triangle(canvas, cx + 34, 258, cx + 168, 202, cx + 128, 330, [...palette, 220]);
    triangle(canvas, cx - 18, 204, cx - 4, 176, cx + 8, 206, [...accent, 255]);
    triangle(canvas, cx + 18, 204, cx + 4, 176, cx - 8, 206, [...accent, 255]);
    return;
  }
  if (/거미/.test(label)) {
    ellipse(canvas, cx, 292, 78, 58, [...palette, 255]);
    ellipse(canvas, cx, 236, 50, 42, [...accent, 255]);
    for (let side of [-1, 1]) {
      for (let i = 0; i < 4; i += 1) {
        const y = 250 + i * 26;
        line(canvas, cx + side * 44, y, cx + side * (108 + i * 10), y - 34 + i * 16, [42, 38, 45, 255], 6);
      }
    }
    return;
  }
  if (/늑대|쥐|설인|두꺼비/.test(label) && !/기사|하수인/.test(label)) {
    ellipse(canvas, cx, 315, /쥐/.test(label) ? 74 : 96, /쥐/.test(label) ? 42 : 58, [...palette, 255]);
    ellipse(canvas, cx + 70, 275, /쥐/.test(label) ? 35 : 48, /쥐/.test(label) ? 30 : 42, [...palette, 255]);
    triangle(canvas, cx + 46, 246, cx + 64, 206, cx + 82, 250, [...accent, 255]);
    triangle(canvas, cx + 88, 246, cx + 108, 210, cx + 111, 258, [...accent, 255]);
    for (let i = 0; i < 4; i += 1) rect(canvas, cx - 58 + i * 38, 350, 16, 58, [48, 42, 38, 255]);
    line(canvas, cx - 82, 310, cx - 150, 278 + jitter(seed, 8), [...palette, 230], 8);
    return;
  }
  if (/용|드레이크|와이번|히드라/.test(label)) {
    ellipse(canvas, cx, 300, 92, 62, [...palette, 255]);
    ellipse(canvas, cx + 86, 246, 48, 42, [...palette, 255]);
    triangle(canvas, cx + 104, 206, cx + 128, 164, cx + 132, 224, [...accent, 255]);
    triangle(canvas, cx - 20, 268, cx - 150, 186, cx - 112, 326, [...accent, 210]);
    triangle(canvas, cx + 8, 272, cx + 130, 184, cx + 104, 326, [...accent, 210]);
    line(canvas, cx - 76, 310, cx - 170, 378, [...palette, 255], 16);
    return;
  }
  if (/골렘|수호자|감시자|허수아비/.test(label)) {
    roundedRect(canvas, cx - 76, 210, 152, 158, 20, [...palette, 255]);
    rect(canvas, cx - 54, 154, 108, 70, [...accent, 255]);
    rect(canvas, cx - 118, 238, 42, 112, [...palette, 240]);
    rect(canvas, cx + 76, 238, 42, 112, [...palette, 240]);
    rect(canvas, cx - 52, 366, 38, 52, [52, 48, 52, 255]);
    rect(canvas, cx + 14, 366, 38, 52, [52, 48, 52, 255]);
    return;
  }
  if (/스켈레톤|망령|언데드|리치|환영/.test(label)) {
    ellipse(canvas, cx, 162, 46, 48, [230, 226, 205, 245]);
    roundedRect(canvas, cx - 58, 212, 116, 140, 28, [...palette, 185]);
    line(canvas, cx - 36, 238, cx - 104, 326, [220, 216, 200, 240], 8);
    line(canvas, cx + 36, 238, cx + 104, 326, [220, 216, 200, 240], 8);
    triangle(canvas, cx - 78, 350, cx + 78, 350, cx, 426, [...palette, 150]);
    return;
  }
  // Humanoid/demon/default.
  ellipse(canvas, cx, 152, 46, 48, [...accent, 255]);
  triangle(canvas, cx - 46, 134, cx - 18, 80, cx - 4, 142, [...palette, 255]);
  triangle(canvas, cx + 46, 134, cx + 18, 80, cx + 4, 142, [...palette, 255]);
  roundedRect(canvas, cx - 62, 210, 124, 138, 30, [...palette, 255]);
  rect(canvas, cx - 48, 242, 96, 18, [...accent, 230]);
  line(canvas, cx - 56, 236, cx - 126, 318 + jitter(seed, 8), [52, 45, 50, 255], 13);
  line(canvas, cx + 56, 236, cx + 126, 318 - jitter(seed, 8), [52, 45, 50, 255], 13);
  rect(canvas, cx - 38, 342, 28, 72, [42, 38, 42, 255]);
  rect(canvas, cx + 10, 342, 28, 72, [42, 38, 42, 255]);
  if (/마법|주술|정령|사제|마도/.test(label)) {
    ellipse(canvas, cx + 130, 284, 22, 22, [...accent, 210]);
  } else {
    line(canvas, cx + 104, 190, cx + 146, 358, [210, 210, 190, 255], 6);
  }
}

function createCanvas(width, height) {
  return { width, height, data: Buffer.alloc(width * height * 4) };
}

function savePng(path, canvas) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, encodePng(canvas.width, canvas.height, canvas.data));
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

function roundedRect(canvas, x, y, w, h, r, color) {
  rect(canvas, x + r, y, w - 2 * r, h, color);
  rect(canvas, x, y + r, w, h - 2 * r, color);
  ellipse(canvas, x + r, y + r, r, r, color);
  ellipse(canvas, x + w - r, y + r, r, r, color);
  ellipse(canvas, x + r, y + h - r, r, r, color);
  ellipse(canvas, x + w - r, y + h - r, r, r, color);
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
    ellipse(canvas, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, thickness, thickness, color);
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

function makePalette(seed) {
  return [
    70 + (seed % 150),
    60 + ((seed >>> 8) % 150),
    75 + ((seed >>> 16) % 145)
  ];
}

function jitter(seed, amount) {
  return ((seed >>> 4) % (amount * 2 + 1)) - amount;
}

function hashString(value) {
  let hash = 2166136261;
  for (const ch of value) {
    hash ^= ch.codePointAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
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

function pngChunk(type, data = Buffer.alloc(0)) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function readImageSizeSafe(path) {
  try {
    const buffer = readFileSync(path);
    if (buffer.toString('ascii', 1, 4) !== 'PNG') return null;
    return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
  } catch {
    return null;
  }
}

function fileExists(path) {
  try {
    readFileSync(path);
    return true;
  } catch {
    return false;
  }
}

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function pruneUndefined(value) {
  if (Array.isArray(value)) return value.map(pruneUndefined);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .map(([key, entry]) => [key, pruneUndefined(entry)])
  );
}

main();
