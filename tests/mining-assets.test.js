import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';
import {
  getMaxPickaxeLevel,
  getOreCount
} from '../src/systems/mining.js';
import {
  formatMiningAssetLine,
  getMiningAssetBatch,
  getMiningAssetCount,
  getMiningAssetRarityCounts,
  getMiningPickaxeAssetForLevel,
  getMiningPickaxeAssets
} from '../src/systems/mining-assets.js';

test('광산 이미지 에셋 manifest는 50종 광석과 100강 곡괭이를 $generate2dsprite 결과로 연결한다', () => {
  const firstBatch = getMiningAssetBatch({ limit: 5 });
  const hiddenBatch = getMiningAssetBatch({ rarity: 'hidden', limit: 10 });
  const counts = getMiningAssetRarityCounts();
  const pickaxes = getMiningPickaxeAssets();

  assert.equal(getMiningAssetCount(), getOreCount());
  assert.equal(getMiningAssetCount({ includeHidden: false }), getOreCount({ includeHidden: false }));
  assert.deepEqual(counts, {
    common: 15,
    uncommon: 10,
    rare: 8,
    epic: 7,
    legendary: 5,
    hidden: 5
  });
  assert.equal(hiddenBatch.length, 5);
  assert.ok(firstBatch.every((asset) => asset.skill === '$generate2dsprite'));
  assert.ok(firstBatch.every((asset) => asset.outputDir.startsWith('assets/mining/ores/')));
  assert.ok(firstBatch.every((asset) => existsSync(asset.imagePath)));
  assert.match(firstBatch[0].prompt, /#FF00FF/);
  assert.match(formatMiningAssetLine(firstBatch[0]), /ore_/);

  assert.equal(pickaxes.length, getMaxPickaxeLevel());
  assert.ok(pickaxes.every((asset) => asset.skill === '$generate2dsprite'));
  assert.ok(pickaxes.every((asset) => existsSync(asset.imagePath)));
  assert.equal(getMiningPickaxeAssetForLevel(1).id, 'pickaxe_001');
  assert.equal(getMiningPickaxeAssetForLevel(100).id, 'pickaxe_100');
  assert.equal(getMiningPickaxeAssetForLevel(999).level, 100);
  assert.match(getMiningPickaxeAssetForLevel(100).imagePath, /level-100\/icon\.png$/);
});

test('새 광산 에셋은 원본 atlas와 후처리 산출물을 보존한다', () => {
  assert.ok(existsSync('assets/mining/asset-manifest.json'));
  assert.ok(existsSync('assets/mining/_incoming/generate2dsprite/ore-atlas-001-025/raw-sheet.png'));
  assert.ok(existsSync('assets/mining/_incoming/generate2dsprite/ore-atlas-026-050/sheet-transparent.png'));
  assert.ok(existsSync('assets/mining/_incoming/generate2dsprite/pickaxe-atlas-076-100/pipeline-meta.json'));
});
