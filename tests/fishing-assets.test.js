import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';
import { getFishCount } from '../src/systems/fishing.js';
import {
  getFishingAssetBatch,
  getFishingAssetCount,
  getFishingRodAssetForLevel,
  getFishingRodAssets
} from '../src/systems/fishing-assets.js';

test('낚시 이미지 에셋 manifest는 내부 조회용으로 유지한다', () => {
  const firstBatch = getFishingAssetBatch({ limit: 3 });
  const hiddenBatch = getFishingAssetBatch({ rarity: 'hidden', limit: 20 });

  assert.equal(getFishingAssetCount(), getFishCount());
  assert.equal(getFishingAssetCount({ includeHidden: false }), getFishCount({ includeHidden: false }));
  assert.equal(hiddenBatch.length, 10);
  assert.ok(firstBatch.every((asset) => asset.skill === '$generate2dsprite'));
  assert.ok(firstBatch.every((asset) => asset.outputDir.startsWith('assets/fishing/fish/')));
  assert.ok(firstBatch.every((asset) => existsSync(asset.imagePath)));
});

test('낚싯대 이미지 에셋은 강화 단계별 카드 첨부에 사용할 수 있다', () => {
  const rodAssets = getFishingRodAssets();

  assert.equal(rodAssets.length, 20);
  assert.ok(rodAssets.every((asset) => existsSync(asset.imagePath)));

  for (let level = 1; level <= 20; level += 1) {
    assert.equal(getFishingRodAssetForLevel(level).level, level);
  }
});
