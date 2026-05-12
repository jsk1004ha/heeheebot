#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getMiningOreAssets,
  getMiningPickaxeAssets
} from '../src/systems/mining-assets.js';

const ROOT_DIR = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUT_ROOT = path.join(ROOT_DIR, 'assets', 'mining');
const INCOMING_ROOT = path.join(OUT_ROOT, '_incoming', 'generate2dsprite');
const DEFAULT_SKILL_SCRIPT = path.join(
  os.homedir(),
  '.codex',
  'skills',
  'generate2dsprite',
  'scripts',
  'generate2dsprite.py'
);
const DEFAULT_PYTHON = path.join(ROOT_DIR, '.omx', 'generate2dsprite-venv', 'bin', 'python');

const argv = process.argv.slice(2);

function readOption(name) {
  const index = argv.indexOf(`--${name}`);
  if (index === -1) return null;
  return argv[index + 1] ?? null;
}

function hasFlag(name) {
  return argv.includes(`--${name}`);
}

function usage() {
  return [
    'Usage:',
    '  node tools/process-mining-generated-assets.js --ore-a <png> --ore-b <png> --pickaxe-a <png> --pickaxe-b <png> --pickaxe-c <png> --pickaxe-d <png>',
    '  node tools/process-mining-generated-assets.js --latest-dir <dir-containing-generated-pngs>',
    '',
    'This script only postprocesses image_gen raw sprite atlases with $generate2dsprite.',
    'It deletes and rebuilds assets/mining so old generated mining assets cannot be reused.'
  ].join('\n');
}

function resolveAtlasPaths() {
  const explicit = {
    'ore-a': readOption('ore-a'),
    'ore-b': readOption('ore-b'),
    'pickaxe-a': readOption('pickaxe-a'),
    'pickaxe-b': readOption('pickaxe-b'),
    'pickaxe-c': readOption('pickaxe-c'),
    'pickaxe-d': readOption('pickaxe-d')
  };
  if (Object.values(explicit).every(Boolean)) return explicit;

  const latestDir = readOption('latest-dir');
  if (!latestDir) {
    throw new Error(`${usage()}\n\nMissing atlas paths.`);
  }

  const files = readdirSync(latestDir)
    .filter((file) => file.toLocaleLowerCase('en-US').endsWith('.png'))
    .map((file) => path.join(latestDir, file))
    .filter((file) => statSync(file).isFile())
    .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs)
    .slice(0, 6)
    .reverse();

  if (files.length !== 6) {
    throw new Error(`Expected 6 latest PNG atlases in ${latestDir}, found ${files.length}.`);
  }

  return {
    'ore-a': files[0],
    'ore-b': files[1],
    'pickaxe-a': files[2],
    'pickaxe-b': files[3],
    'pickaxe-c': files[4],
    'pickaxe-d': files[5]
  };
}

function assertFile(file, label) {
  if (!file || !existsSync(file)) {
    throw new Error(`${label} does not exist: ${file}`);
  }
}

function getPython() {
  const configured = readOption('python') || process.env.PYTHON;
  if (configured) return configured;
  return existsSync(DEFAULT_PYTHON) ? DEFAULT_PYTHON : 'python3';
}

function getSkillScript() {
  return readOption('skill-script') || process.env.GENERATE2DSPRITE_SCRIPT || DEFAULT_SKILL_SCRIPT;
}

function ensureCleanOutput() {
  rmSync(OUT_ROOT, { recursive: true, force: true });
  mkdirSync(INCOMING_ROOT, { recursive: true });
}

function atlasPrompt({ type, start, end }) {
  if (type === 'ore') {
    return [
      'Use $generate2dsprite for a clean HD 5x5 sprite atlas of 25 collectible mine ore and gemstone item icons.',
      `Atlas covers ore entries ${start} through ${end} from the mining catalog, in row-major order.`,
      'Every icon must be centered in its own invisible cell with full object inside the safe area.',
      'Use premium mobile RPG item-icon polish, readable mineral silhouettes, distinct material/color per ore, no UI frame.',
      'No text, no labels, no watermark. Solid #FF00FF background for chroma-key cleanup.'
    ].join(' ');
  }

  return [
    'Use $generate2dsprite for a clean HD sprite atlas of collectible pickaxe item icons.',
    `Atlas covers enhancement levels +${start} through +${end}, in row-major order, with steadily richer materials and glow as the level rises.`,
    'Every pickaxe must be centered diagonally in its own invisible cell with full item inside the safe area.',
    'Use premium mobile RPG item-icon polish, no UI frame, no text, no labels, no watermark.',
    'Solid #FF00FF background for chroma-key cleanup.'
  ].join(' ');
}

function runProcessor({ python, script, rawPath, runDir, rows, cols, slug, promptPath }) {
  execFileSync(python, [
    script,
    'process',
    '--input', rawPath,
    '--target', 'asset',
    '--mode', 'sheet',
    '--rows', String(rows),
    '--cols', String(cols),
    '--label-prefix', slug,
    '--cell-size', '128',
    '--fit-scale', '0.88',
    '--trim-border', '2',
    '--edge-clean-depth', '2',
    '--component-mode', 'largest',
    '--component-padding', '8',
    '--min-component-area', '20',
    '--duration', '160',
    '--prompt-file', promptPath,
    '--output-dir', runDir
  ], {
    cwd: ROOT_DIR,
    stdio: 'inherit'
  });
}

function copyAsset({ asset, sourceFrame, rawPath, runDir, atlas, cellIndex }) {
  assertFile(sourceFrame, `processed frame for ${asset.id}`);
  const outputDir = path.join(ROOT_DIR, asset.outputDir);
  mkdirSync(outputDir, { recursive: true });
  copyFileSync(sourceFrame, path.join(outputDir, 'icon.png'));
  writeFileSync(path.join(outputDir, 'prompt-used.txt'), `${asset.prompt}\n`, 'utf8');
  writeFileSync(path.join(outputDir, 'asset-meta.json'), `${JSON.stringify({
    id: asset.id,
    kind: asset.kind,
    skill: asset.skill,
    label: asset.label,
    oreId: asset.oreId ?? null,
    level: asset.level ?? null,
    rarity: asset.rarity ?? null,
    tier: asset.tier ?? null,
    source: {
      rawAtlas: path.relative(ROOT_DIR, path.join(runDir, 'image-gen-raw.png')),
      originalRawImageName: path.basename(rawPath),
      processedAtlas: path.relative(ROOT_DIR, runDir),
      sheetTransparent: path.relative(ROOT_DIR, path.join(runDir, 'sheet-transparent.png')),
      processor: '$generate2dsprite/scripts/generate2dsprite.py process',
      rows: atlas.rows,
      cols: atlas.cols,
      cellIndex,
      row: Math.floor(cellIndex / atlas.cols),
      col: cellIndex % atlas.cols
    },
    generatedAt: new Date().toISOString()
  }, null, 2)}\n`, 'utf8');
}

function copyManifestSnapshot() {
  const ores = getMiningOreAssets();
  const pickaxes = getMiningPickaxeAssets();
  writeFileSync(path.join(OUT_ROOT, 'asset-manifest.json'), `${JSON.stringify({
    skill: '$generate2dsprite',
    note: 'Mining assets are regenerated from built-in image_gen raw atlases and postprocessed by generate2dsprite.py.',
    counts: {
      ores: ores.length,
      pickaxes: pickaxes.length,
      total: ores.length + pickaxes.length
    },
    ores: ores.map((asset) => ({ id: asset.id, oreId: asset.oreId, label: asset.oreLabel, rarity: asset.rarity, imagePath: asset.imagePath })),
    pickaxes: pickaxes.map((asset) => ({ id: asset.id, level: asset.level, tier: asset.tier, imagePath: asset.imagePath }))
  }, null, 2)}\n`, 'utf8');
}

function countIcons(dir) {
  let count = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) count += countIcons(full);
    if (entry.isFile() && entry.name === 'icon.png') count += 1;
  }
  return count;
}

function main() {
  if (hasFlag('help')) {
    console.log(usage());
    return;
  }

  const atlasPaths = resolveAtlasPaths();
  Object.entries(atlasPaths).forEach(([label, file]) => assertFile(file, label));
  const python = getPython();
  const script = getSkillScript();
  assertFile(script, 'generate2dsprite processor');

  const oreAssets = getMiningOreAssets();
  const pickaxeAssets = getMiningPickaxeAssets();
  const atlases = [
    { key: 'ore-a', slug: 'ore-atlas-001-025', type: 'ore', start: 1, end: 25, rows: 5, cols: 5, assets: oreAssets.slice(0, 25) },
    { key: 'ore-b', slug: 'ore-atlas-026-050', type: 'ore', start: 26, end: 50, rows: 5, cols: 5, assets: oreAssets.slice(25, 50) },
    // The first raw pickaxe sheet was generated as a wide 6x5 atlas; only the first 25 row-major cells are delivered.
    { key: 'pickaxe-a', slug: 'pickaxe-atlas-001-025', type: 'pickaxe', start: 1, end: 25, rows: 5, cols: 6, assets: pickaxeAssets.slice(0, 25) },
    { key: 'pickaxe-b', slug: 'pickaxe-atlas-026-050', type: 'pickaxe', start: 26, end: 50, rows: 5, cols: 5, assets: pickaxeAssets.slice(25, 50) },
    { key: 'pickaxe-c', slug: 'pickaxe-atlas-051-075', type: 'pickaxe', start: 51, end: 75, rows: 5, cols: 5, assets: pickaxeAssets.slice(50, 75) },
    { key: 'pickaxe-d', slug: 'pickaxe-atlas-076-100', type: 'pickaxe', start: 76, end: 100, rows: 5, cols: 5, assets: pickaxeAssets.slice(75, 100) }
  ];

  ensureCleanOutput();

  for (const atlas of atlases) {
    const rawPath = path.resolve(atlasPaths[atlas.key]);
    const runDir = path.join(INCOMING_ROOT, atlas.slug);
    mkdirSync(runDir, { recursive: true });
    const promptPath = path.join(runDir, 'prompt-used.txt');
    writeFileSync(promptPath, `${atlasPrompt(atlas)}\n`, 'utf8');
    copyFileSync(rawPath, path.join(runDir, 'image-gen-raw.png'));
    runProcessor({ python, script, rawPath, runDir, rows: atlas.rows, cols: atlas.cols, slug: atlas.slug, promptPath });

    const metaPath = path.join(runDir, 'pipeline-meta.json');
    const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
    writeFileSync(path.join(runDir, 'atlas-source.json'), `${JSON.stringify({
      skill: '$generate2dsprite',
      originalRawImageName: path.basename(rawPath),
      copiedRawImage: path.relative(ROOT_DIR, path.join(runDir, 'image-gen-raw.png')),
      rows: atlas.rows,
      cols: atlas.cols,
      deliveredAssets: atlas.assets.length,
      edgeTouchFrames: meta.edge_touch_frames ?? []
    }, null, 2)}\n`, 'utf8');

    atlas.assets.forEach((asset, index) => {
      const frameName = `${atlas.slug}-${index + 1}.png`;
      copyAsset({
        asset,
        sourceFrame: path.join(runDir, frameName),
        rawPath,
        runDir,
        atlas,
        cellIndex: index
      });
    });
  }

  copyManifestSnapshot();
  const iconCount = countIcons(OUT_ROOT);
  const expected = oreAssets.length + pickaxeAssets.length;
  if (iconCount !== expected) {
    throw new Error(`Expected ${expected} mining icon.png files, found ${iconCount}.`);
  }
  console.log(JSON.stringify({ outRoot: path.relative(ROOT_DIR, OUT_ROOT), iconCount, expected }, null, 2));
}

main();
