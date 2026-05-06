import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatRpgAssetLine,
  getRpgAssetAttachment,
  getRpgAssetBatch,
  getRpgAssetById,
  getRpgAssetCount
} from '../src/systems/rpg-assets.js';

test('RPG 에셋 manifest는 forge skill과 출력 위치를 제공한다', () => {
  const batch = getRpgAssetBatch({ limit: 3 });
  const slime = getRpgAssetById('monster_slime_idle');
  const femaleWarrior = getRpgAssetById('hero_female_warrior_idle');
  const maps = getRpgAssetBatch({ kind: 'map', limit: 10 });

  assert.ok(getRpgAssetCount() >= 37);
  assert.equal(batch.length, 3);
  assert.ok(slime);
  assert.ok(femaleWarrior);
  assert.equal(slime.skill, '$generate2dsprite');
  assert.equal(femaleWarrior.category, 'hero');
  assert.match(femaleWarrior.outputDir, /assets\/rpg\/heroes\/female\/warrior/);
  assert.ok(getRpgAssetAttachment('hero_female_warrior_idle'));
  assert.match(slime.prompt, /#FF00FF/);
  assert.match(slime.outputDir, /assets\/rpg\/monsters\/slime/);
  assert.ok(maps.every((asset) => asset.skill === '$generate2dmap'));
  assert.match(formatRpgAssetLine(slime), /monster_slime_idle/);
});
