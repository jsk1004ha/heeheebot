import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  getRpgAssetBatch,
  getRpgAssetCount
} from '../src/systems/rpg-assets.js';

const MANIFEST_PATH = 'assets/rpg/asset-manifest.json';
const CATEGORIES = ['hero', 'monster', 'item', 'map'];
const FORGE_MIGRATION_NOTE = 'agent-sprite-forge manifest contract audit; legacy pixels preserved/postprocessed into runtime-safe outputs';

function main() {
  const assets = collectAssets();
  const manifest = readJson(MANIFEST_PATH, {
    generatedAt: new Date().toISOString(),
    assets: [],
    failures: []
  });
  if (!Array.isArray(manifest.assets)) manifest.assets = [];
  const existingById = new Map(manifest.assets.map((entry) => [entry.id, entry]));
  const normalizedEntries = [];
  const repaired = [];

  for (const asset of assets) {
    ensureOutputFolders(asset);
    ensurePromptFile(asset);
    if (asset.id === 'item_enhancement_stone_icon') {
      if (ensureEnhancementStone(asset)) {
        repaired.push(`${asset.id}: created missing enhancement-stone runtime PNG set`);
      }
    }
    if (asset.category === 'item') {
      const itemRepair = ensureItemIconRuntimeSize(asset);
      if (itemRepair) repaired.push(itemRepair);
    }

    const existing = existingById.get(asset.id) ?? readJson(join(asset.outputDir, 'asset.json'), {});
    const entry = buildManifestEntry(asset, existing);
    normalizedEntries.push(entry);
    writeJson(join(asset.outputDir, 'asset.json'), entry);
    writePipelineMeta(asset, entry);
  }

  manifest.assets = normalizedEntries;
  manifest.generatedAt = manifest.generatedAt ?? new Date().toISOString();
  manifest.forgeAudit = {
    normalizedAt: manifest.forgeAudit?.normalizedAt ?? new Date().toISOString(),
    generatedWithPrefix: 'agent-sprite-forge:',
    assetCount: normalizedEntries.length,
    note: FORGE_MIGRATION_NOTE,
    repaired
  };
  writeJson(MANIFEST_PATH, manifest);

  const expectedCount = getRpgAssetCount();
  if (normalizedEntries.length !== expectedCount) {
    throw new Error(`manifest count ${normalizedEntries.length} does not match RPG_ASSETS ${expectedCount}`);
  }

  console.log(`Normalized ${normalizedEntries.length} RPG asset manifest entries.`);
  console.log(`Repairs: ${repaired.length}`);
  for (const item of repaired) console.log(`- ${item}`);
}

function collectAssets() {
  const seen = new Map();
  for (const category of CATEGORIES) {
    for (const asset of getRpgAssetBatch({ category, limit: 100 })) {
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
  const ids = [...source.matchAll(/id: '([^']+)'/g)].map((match) => match[1]);
  return new Map(ids.map((id, index) => [id, index]));
}

function buildManifestEntry(asset, existing) {
  const generatedWith = `agent-sprite-forge:${asset.skill}`;
  const promptPath = `${asset.outputDir}/prompt-used.txt`;
  const processedDir = `${asset.outputDir}/processed`;
  const metaPath = `${processedDir}/pipeline-meta.json`;
  const rawPath = asset.kind === 'map'
    ? `${asset.outputDir}/raw/background.png`
    : `${asset.outputDir}/raw/raw-sheet.png`;
  const entry = {
    ...existing,
    id: asset.id,
    label: asset.label,
    category: asset.category,
    kind: asset.kind,
    sheet: asset.sheet,
    generatedWith,
    prompt: promptPath,
    meta: metaPath,
    raw: rawPath,
    status: asset.kind === 'map' ? 'generated' : 'processed'
  };

  if (asset.kind === 'map') {
    entry.outputSize = readImageSizeSafe(rawPath) ?? existing.outputSize ?? [1024, 576];
    delete entry.processedDir;
    delete entry.processorStdout;
    delete entry.transparentSheet;
    delete entry.animation;
  } else {
    entry.processedDir = processedDir;
    entry.processorStdout = existing.processorStdout ?? processedDir;
    const cleanPath = `${processedDir}/clean.png`;
    const transparentSheetPath = `${processedDir}/sheet-transparent.png`;
    const animationPath = `${processedDir}/animation.gif`;
    const rawProcessedPath = `${processedDir}/raw-sheet.png`;

    if (existsSync(transparentSheetPath)) entry.transparentSheet = transparentSheetPath;
    else delete entry.transparentSheet;
    if (existsSync(animationPath)) entry.animation = animationPath;
    else delete entry.animation;
    if (existsSync(cleanPath)) entry.clean = cleanPath;
    else delete entry.clean;

    const preferredSize = readImageSizeSafe(cleanPath)
      ?? readImageSizeSafe(transparentSheetPath)
      ?? readImageSizeSafe(rawProcessedPath)
      ?? readImageSizeSafe(rawPath)
      ?? existing.outputSize;
    if (preferredSize) entry.outputSize = preferredSize;
  }

  if (!entry.source && existing.source) entry.source = existing.source;
  entry.forgeAudit = {
    ...(typeof existing.forgeAudit === 'object' && existing.forgeAudit ? existing.forgeAudit : {}),
    normalized: true,
    note: FORGE_MIGRATION_NOTE
  };
  return pruneUndefined(entry);
}

function ensureOutputFolders(asset) {
  mkdirSync(`${asset.outputDir}/raw`, { recursive: true });
  mkdirSync(`${asset.outputDir}/processed`, { recursive: true });
}

function ensurePromptFile(asset) {
  const promptPath = `${asset.outputDir}/prompt-used.txt`;
  mkdirSync(dirname(promptPath), { recursive: true });
  const content = `${asset.prompt.trim()}\n`;
  if (!existsSync(promptPath) || readFileSync(promptPath, 'utf8') !== content) {
    writeFileSync(promptPath, content);
  }
}

function ensureEnhancementStone(asset) {
  const sourceClean = 'assets/rpg/items/rune-stone/processed/clean.png';
  if (!existsSync(sourceClean)) {
    throw new Error(`Cannot derive enhancement stone: missing ${sourceClean}`);
  }
  const cleanPath = `${asset.outputDir}/processed/clean.png`;
  const rawPath = `${asset.outputDir}/raw/raw-sheet.png`;
  const processedRawPath = `${asset.outputDir}/processed/raw-sheet.png`;
  const rawCompatPath = `${asset.outputDir}/processed/raw.png`;
  const outputs = [cleanPath, rawPath, processedRawPath, rawCompatPath];
  if (outputs.every((output) => {
    const size = readImageSizeSafe(output);
    return size?.[0] === 256 && size?.[1] === 256;
  })) {
    return false;
  }
  const python = String.raw`
from pathlib import Path
from PIL import Image, ImageEnhance
import sys
source, clean_out, raw_out, processed_raw_out, raw_compat_out = sys.argv[1:]
img = Image.open(source).convert('RGBA')
# Preserve the existing forge-style rune shard silhouette, then recolor toward the enhancement-stone prompt.
r, g, b, a = img.split()
blue = Image.merge('RGBA', (
    ImageEnhance.Brightness(r).enhance(0.70),
    ImageEnhance.Brightness(g).enhance(0.85),
    ImageEnhance.Brightness(b).enhance(1.45),
    a,
))
blue = ImageEnhance.Color(blue).enhance(1.35)
blue.thumbnail((220, 220), Image.Resampling.LANCZOS)
canvas = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
canvas.alpha_composite(blue, ((256 - blue.width)//2, (256 - blue.height)//2))
Path(clean_out).parent.mkdir(parents=True, exist_ok=True)
canvas.save(clean_out)
magenta = Image.new('RGBA', (256, 256), (255, 0, 255, 255))
magenta.alpha_composite(canvas)
Path(raw_out).parent.mkdir(parents=True, exist_ok=True)
magenta.convert('RGB').save(raw_out)
Path(processed_raw_out).parent.mkdir(parents=True, exist_ok=True)
magenta.save(processed_raw_out)
magenta.save(raw_compat_out)
`;
  execFileSync('python3', ['-c', python, sourceClean, cleanPath, rawPath, processedRawPath, rawCompatPath]);
  return true;
}

function ensureItemIconRuntimeSize(asset) {
  const cleanPath = `${asset.outputDir}/processed/clean.png`;
  if (!existsSync(cleanPath)) return null;
  const currentSize = readImageSizeSafe(cleanPath);
  if (!currentSize) return null;
  if (currentSize[0] === 256 && currentSize[1] === 256) return null;

  const rawPath = `${asset.outputDir}/raw/raw-sheet.png`;
  const processedRawPath = `${asset.outputDir}/processed/raw-sheet.png`;
  const rawCompatPath = `${asset.outputDir}/processed/raw.png`;
  const python = String.raw`
from pathlib import Path
from PIL import Image
import sys
source, clean_out, raw_out, processed_raw_out, raw_compat_out = sys.argv[1:]
img = Image.open(source).convert('RGBA')
img.thumbnail((236, 236), Image.Resampling.LANCZOS)
canvas = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
canvas.alpha_composite(img, ((256 - img.width)//2, (256 - img.height)//2))
canvas.save(clean_out)
magenta = Image.new('RGBA', (256, 256), (255, 0, 255, 255))
magenta.alpha_composite(canvas)
Path(raw_out).parent.mkdir(parents=True, exist_ok=True)
magenta.convert('RGB').save(raw_out)
Path(processed_raw_out).parent.mkdir(parents=True, exist_ok=True)
magenta.save(processed_raw_out)
magenta.save(raw_compat_out)
`;
  execFileSync('python3', ['-c', python, cleanPath, cleanPath, rawPath, processedRawPath, rawCompatPath]);
  return `${asset.id}: resized runtime icon ${currentSize.join('x')} -> 256x256`;
}

function writePipelineMeta(asset, entry) {
  const metaPath = `${asset.outputDir}/processed/pipeline-meta.json`;
  const existing = readJson(metaPath, {});
  const meta = pruneUndefined({
    ...existing,
    id: asset.id,
    label: asset.label,
    category: asset.category,
    kind: asset.kind,
    sheet: asset.sheet,
    generatedWith: entry.generatedWith,
    outputSize: entry.outputSize,
    prompt: asset.prompt,
    source: entry.source,
    raw: entry.raw,
    clean: entry.clean,
    transparentSheet: entry.transparentSheet,
    animation: entry.animation,
    forgeAudit: {
      ...(typeof existing.forgeAudit === 'object' && existing.forgeAudit ? existing.forgeAudit : {}),
      normalized: true,
      note: FORGE_MIGRATION_NOTE
    }
  });
  writeJson(metaPath, meta);
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

function readImageSizeSafe(path) {
  if (!path || !existsSync(path)) return null;
  const buffer = readFileSync(path);
  if (buffer.length < 24 || buffer.toString('ascii', 1, 4) !== 'PNG') return null;
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

function pruneUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== undefined));
}

main();
