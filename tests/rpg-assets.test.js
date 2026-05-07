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
  const femaleWarriorAttachment = getRpgAssetAttachment('hero_female_warrior_idle');
  const skyCitadel = getRpgAssetById('map_sky_citadel');
  const skyCitadelAttachment = getRpgAssetAttachment('map_sky_citadel');
  const maps = getRpgAssetBatch({ kind: 'map', limit: 10 });

  assert.ok(getRpgAssetCount() >= 37);
  assert.equal(batch.length, 3);
  assert.ok(slime);
  assert.ok(femaleWarrior);
  assert.ok(skyCitadel);
  assert.ok(skyCitadelAttachment);
  assert.equal(slime.skill, '$generate2dsprite');
  assert.equal(femaleWarrior.category, 'hero');
  assert.equal(skyCitadel.skill, '$generate2dmap');
  assert.match(femaleWarrior.outputDir, /assets\/rpg\/heroes\/female\/warrior/);
  assert.ok(femaleWarriorAttachment);
  assert.match(femaleWarriorAttachment.name, /^rpg-image-\d+\.[a-z0-9]+$/i);
  assert.doesNotMatch(femaleWarriorAttachment.name, /hero_female_warrior_idle|warrior|female/i);
  assert.match(skyCitadelAttachment.name, /^rpg-image-\d+\.png$/i);
  assert.doesNotMatch(skyCitadelAttachment.name, /map_sky_citadel|sky|citadel/i);
  assert.match(slime.prompt, /#FF00FF/);
  assert.match(slime.outputDir, /assets\/rpg\/monsters\/slime/);
  assert.ok(maps.length >= 7);
  assert.ok(maps.every((asset) => asset.skill === '$generate2dmap'));
  assert.match(formatRpgAssetLine(slime), /monster_slime_idle/);
});
