import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAX_SWORD_LEVEL, normalizeSwordLevel } from './sword.js';

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(CURRENT_DIR, '..', '..');
const SWORD_ASSET_ROOT = join(REPO_ROOT, 'assets', 'sword', 'level-atlas');
const SWORD_NAME_PATH = join(SWORD_ASSET_ROOT, 'names.json');
const SWORD_IMAGE_ROOT = join(SWORD_ASSET_ROOT, 'extracted');

let swordNamesCache = null;

export function getSwordAssetName(level) {
  const normalizedLevel = normalizeSwordLevel(level);
  if (normalizedLevel <= 0) return '기본 검';

  const names = readSwordNames();
  return names[String(normalizedLevel)] ?? `${normalizedLevel}강 검`;
}

export function getSwordAssetLabel(level) {
  const normalizedLevel = normalizeSwordLevel(level);
  if (normalizedLevel <= 0) return '+0 기본 검';

  return `+${normalizedLevel} ${getSwordAssetName(normalizedLevel)}`;
}

export function getSwordAssetFilePath(level) {
  const normalizedLevel = normalizeSwordLevel(level);
  if (normalizedLevel <= 0 || normalizedLevel > MAX_SWORD_LEVEL) return null;

  const batch = Math.floor((normalizedLevel - 1) / 25) + 1;
  const filePath = join(
    SWORD_IMAGE_ROOT,
    `batch-${String(batch).padStart(2, '0')}`,
    `sword_${String(normalizedLevel).padStart(3, '0')}.png`
  );

  return existsSync(filePath) ? filePath : null;
}

export function getSwordAssetAttachment(level) {
  const filePath = getSwordAssetFilePath(level);
  if (!filePath) return null;

  const normalizedLevel = normalizeSwordLevel(level);
  return {
    attachment: filePath,
    name: `sword_${String(normalizedLevel).padStart(3, '0')}.png`
  };
}

function readSwordNames() {
  if (swordNamesCache !== null) return swordNamesCache;

  if (!existsSync(SWORD_NAME_PATH)) {
    swordNamesCache = {};
    return swordNamesCache;
  }

  try {
    swordNamesCache = JSON.parse(readFileSync(SWORD_NAME_PATH, 'utf8'));
  } catch {
    swordNamesCache = {};
  }

  return swordNamesCache;
}
