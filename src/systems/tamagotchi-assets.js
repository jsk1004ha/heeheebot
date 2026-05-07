import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(CURRENT_DIR, '..', '..');
const MANIFEST_PATH = join(REPO_ROOT, 'assets', 'tamagotchi', 'manifest.json');
const DEFAULT_SKIN_ID = 'classic';
const DEFAULT_DECORATION_ID = 'rice_bowl';
const REQUIRED_STAGE_IDS = Object.freeze(['egg', 'infant', 'child', 'teen', 'adult']);

let manifestCache = null;

export function getTamagotchiManifest() {
  if (manifestCache) return manifestCache;

  if (!existsSync(MANIFEST_PATH)) {
    throw new Error(`희진 다마고치 에셋 manifest를 찾을 수 없습니다: ${MANIFEST_PATH}`);
  }

  try {
    const parsed = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
    manifestCache = validateTamagotchiManifest(parsed);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`희진 다마고치 에셋 manifest JSON을 읽을 수 없습니다: ${error.message}`);
    }
    throw error;
  }

  return manifestCache;
}

export function validateTamagotchiManifest(manifest) {
  const normalized = {
    ...manifest,
    stages: Array.isArray(manifest?.stages) ? manifest.stages : [],
    skins: Array.isArray(manifest?.skins) ? manifest.skins : [],
    decorations: Array.isArray(manifest?.decorations) ? manifest.decorations : [],
    previews: manifest?.previews ?? {},
    reference: manifest?.reference ?? {}
  };

  if (normalized.stages.length === 0) {
    throw new Error('희진 다마고치 에셋 manifest에 성장 단계가 없습니다.');
  }
  if (normalized.skins.length === 0) {
    throw new Error('희진 다마고치 에셋 manifest에 스킨이 없습니다.');
  }
  if (normalized.decorations.length === 0) {
    throw new Error('희진 다마고치 에셋 manifest에 꾸미기/도구가 없습니다.');
  }
  if (!normalized.reference?.imagePath) {
    throw new Error('희진 다마고치 에셋 manifest에 원본 도트 레퍼런스가 없습니다.');
  }

  validateGrowthStages(normalized.stages);
  validateImagePath(normalized.sourceImage, '원본 이미지');
  validateImagePath(normalized.reference.imagePath, '원본 도트 레퍼런스 이미지');
  validateImagePath(normalized.previews.growthStages, '성장 단계 미리보기 이미지');
  validateImagePath(normalized.previews.skins, '스킨 미리보기 이미지');
  validateImagePath(normalized.previews.decorations, '꾸미기/도구 미리보기 이미지');
  validateSkins(normalized.skins, normalized.stages);
  validateDecorations(normalized.decorations);

  return normalized;
}

export function getTamagotchiSkins() {
  return [...getTamagotchiManifest().skins];
}

export function getTamagotchiDecorations() {
  return [...getTamagotchiManifest().decorations];
}

export function getTamagotchiGrowthStages() {
  return [...getTamagotchiManifest().stages];
}

export function getTamagotchiGrowthStageById(id) {
  const normalizedId = normalizeId(id);
  return getTamagotchiGrowthStages().find((stage) => stage.id === normalizedId) ?? null;
}

export function getDefaultTamagotchiSkinId() {
  return hasSkin(DEFAULT_SKIN_ID) ? DEFAULT_SKIN_ID : getTamagotchiSkins()[0]?.id ?? DEFAULT_SKIN_ID;
}

export function getDefaultTamagotchiDecorationId() {
  return hasDecoration(DEFAULT_DECORATION_ID)
    ? DEFAULT_DECORATION_ID
    : getTamagotchiDecorations()[0]?.id ?? DEFAULT_DECORATION_ID;
}

export function getTamagotchiSkinById(id) {
  const normalizedId = normalizeId(id);
  return getTamagotchiSkins().find((skin) => skin.id === normalizedId) ?? null;
}

export function getTamagotchiDecorationById(id) {
  const normalizedId = normalizeId(id);
  return getTamagotchiDecorations().find((decoration) => decoration.id === normalizedId) ?? null;
}

export function normalizeTamagotchiSkinId(id) {
  const normalizedId = normalizeId(id);
  return getTamagotchiSkinById(normalizedId)?.id ?? getDefaultTamagotchiSkinId();
}

export function normalizeTamagotchiDecorationId(id) {
  const normalizedId = normalizeId(id);
  return getTamagotchiDecorationById(normalizedId)?.id ?? getDefaultTamagotchiDecorationId();
}

export function getNextTamagotchiSkinId(currentId) {
  return getNextCatalogId(getTamagotchiSkins(), currentId, getDefaultTamagotchiSkinId());
}

export function getNextTamagotchiDecorationId(currentId) {
  return getNextCatalogId(getTamagotchiDecorations(), currentId, getDefaultTamagotchiDecorationId());
}

export function getTamagotchiStageSkinAttachment(skinId, stageId) {
  const skin = getTamagotchiSkinById(skinId);
  const normalizedStageId = normalizeId(stageId);
  const stageAsset = skin?.stages?.find((stage) => stage.id === normalizedStageId);
  if (!skin) return null;
  if (!stageAsset) {
    throw new Error(`희진 스킨 ${skin.id}의 ${normalizedStageId} 단계 이미지가 없습니다.`);
  }
  return getAssetAttachment(stageAsset);
}

export function getTamagotchiDecorationAttachment(id) {
  return getAssetAttachment(getTamagotchiDecorationById(id));
}

export function getTamagotchiAssetSummary() {
  const manifest = getTamagotchiManifest();
  return {
    stageCount: manifest.stages.length,
    skinCount: manifest.skins.length,
    decorationCount: manifest.decorations.length,
    sourceImage: manifest.sourceImage,
    referencePath: manifest.reference?.imagePath ?? null,
    growthStagePreviewPath: manifest.previews?.growthStages ?? null,
    skinPreviewPath: manifest.previews?.skins ?? null,
    decorationPreviewPath: manifest.previews?.decorations ?? null
  };
}

export function getTamagotchiPreviewAttachments() {
  const summary = getTamagotchiAssetSummary();
  return [
    previewAttachment('growthStages', summary.growthStagePreviewPath),
    previewAttachment('skins', summary.skinPreviewPath),
    previewAttachment('decorations', summary.decorationPreviewPath),
    previewAttachment('reference', summary.referencePath)
  ].filter(Boolean);
}

function getNextCatalogId(catalog, currentId, fallbackId) {
  if (catalog.length === 0) return fallbackId;
  const currentIndex = catalog.findIndex((item) => item.id === currentId);
  const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % catalog.length;
  return catalog[nextIndex].id;
}

function previewAttachment(id, imagePath) {
  if (!imagePath) return null;
  const attachment = getAssetAttachment({ imagePath });
  return attachment ? { id, ...attachment } : null;
}

function getAssetAttachment(asset) {
  if (!asset?.imagePath) return null;
  const filePath = join(REPO_ROOT, asset.imagePath);
  if (!existsSync(filePath)) {
    throw new Error(`희진 다마고치 이미지 파일을 찾을 수 없습니다: ${asset.imagePath}`);
  }
  return {
    attachment: filePath,
    name: basename(filePath)
  };
}

function validateGrowthStages(stages) {
  const ids = new Set();

  for (const stage of stages) {
    const id = requireText(stage?.id, '성장 단계 id');
    requireText(stage?.label, `성장 단계 ${id} label`);
    if (!Number.isFinite(Number(stage?.minAgeDays))) {
      throw new Error(`희진 다마고치 에셋 manifest의 ${id} 성장 단계 minAgeDays가 올바르지 않습니다.`);
    }
    if (ids.has(id)) {
      throw new Error(`희진 다마고치 에셋 manifest에 중복 성장 단계 id가 있습니다: ${id}`);
    }
    ids.add(id);
  }

  for (const requiredStageId of REQUIRED_STAGE_IDS) {
    if (!ids.has(requiredStageId)) {
      throw new Error(`희진 다마고치 에셋 manifest에 필수 성장 단계 ${requiredStageId}가 없습니다.`);
    }
  }
}

function validateSkins(skins, stages) {
  const stageIds = new Set(stages.map((stage) => stage.id));
  const skinIds = new Set();

  for (const skin of skins) {
    const skinId = requireText(skin?.id, '스킨 id');
    requireText(skin?.label, `스킨 ${skinId} label`);
    validateImagePath(skin?.imagePath, `스킨 ${skinId} 대표 이미지`);
    if (skinIds.has(skinId)) {
      throw new Error(`희진 다마고치 에셋 manifest에 중복 스킨 id가 있습니다: ${skinId}`);
    }
    skinIds.add(skinId);

    if (!Array.isArray(skin?.stages) || skin.stages.length === 0) {
      throw new Error(`희진 스킨 ${skinId}에 단계별 이미지가 없습니다.`);
    }

    const skinStageIds = new Set();
    for (const stageAsset of skin.stages) {
      const stageId = requireText(stageAsset?.id, `스킨 ${skinId} 단계 id`);
      if (!stageIds.has(stageId)) {
        throw new Error(`희진 스킨 ${skinId}에 알 수 없는 성장 단계가 있습니다: ${stageId}`);
      }
      if (skinStageIds.has(stageId)) {
        throw new Error(`희진 스킨 ${skinId}에 중복 성장 단계 이미지가 있습니다: ${stageId}`);
      }
      skinStageIds.add(stageId);
      validateImagePath(stageAsset?.imagePath, `스킨 ${skinId} ${stageId} 단계 이미지`);
    }

    for (const requiredStageId of REQUIRED_STAGE_IDS) {
      if (!skinStageIds.has(requiredStageId)) {
        throw new Error(`희진 스킨 ${skinId}에 ${requiredStageId} 단계 이미지가 없습니다.`);
      }
    }
  }
}

function validateDecorations(decorations) {
  const decorationIds = new Set();

  for (const decoration of decorations) {
    const decorationId = requireText(decoration?.id, '꾸미기/도구 id');
    requireText(decoration?.label, `꾸미기/도구 ${decorationId} label`);
    requireText(decoration?.category, `꾸미기/도구 ${decorationId} category`);
    validateImagePath(decoration?.imagePath, `꾸미기/도구 ${decorationId} 이미지`);
    if (decorationIds.has(decorationId)) {
      throw new Error(`희진 다마고치 에셋 manifest에 중복 꾸미기/도구 id가 있습니다: ${decorationId}`);
    }
    decorationIds.add(decorationId);
  }
}

function requireText(value, label) {
  const text = String(value ?? '').trim();
  if (!text) {
    throw new Error(`희진 다마고치 에셋 manifest의 ${label} 값이 없습니다.`);
  }
  return text;
}

function validateImagePath(imagePath, label) {
  const normalizedPath = requireText(imagePath, label);
  const filePath = join(REPO_ROOT, normalizedPath);
  if (!existsSync(filePath)) {
    throw new Error(`희진 다마고치 에셋 manifest의 ${label} 파일을 찾을 수 없습니다: ${normalizedPath}`);
  }
}

function hasSkin(id) {
  return Boolean(getTamagotchiSkins().find((skin) => skin.id === id));
}

function hasDecoration(id) {
  return Boolean(getTamagotchiDecorations().find((decoration) => decoration.id === id));
}

function normalizeId(id) {
  return String(id ?? '').trim().toLowerCase();
}
