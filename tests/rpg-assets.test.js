import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import {
  formatRpgAssetLine,
  getRpgAssetAttachment,
  getRpgAssetBatch,
  getRpgAssetById,
  getRpgAssetCount,
  getRpgAssetFilePath,
  getRpgGeneratedAssetById
} from '../src/systems/rpg-assets.js';

test('RPG 에셋 manifest는 forge skill과 출력 위치를 제공한다', () => {
  const batch = getRpgAssetBatch({ limit: 3 });
  const slime = getRpgAssetById('monster_slime_idle');
  const femaleWarrior = getRpgAssetById('hero_female_warrior_idle');
  const femaleWarriorAttachment = getRpgAssetAttachment('hero_female_warrior_idle');
  const femaleBerserker = getRpgAssetById('hero_female_berserker_idle');
  const femaleBerserkerAttachment = getRpgAssetAttachment('hero_female_berserker_idle');
  const skyCitadel = getRpgAssetById('map_sky_citadel');
  const skyCitadelAttachment = getRpgAssetAttachment('map_sky_citadel');
  const maps = getRpgAssetBatch({ kind: 'map', limit: 10 });

  assert.ok(getRpgAssetCount() >= 37);
  assert.equal(batch.length, 3);
  assert.ok(slime);
  assert.ok(femaleWarrior);
  assert.ok(femaleBerserker);
  assert.ok(femaleBerserkerAttachment);
  assert.ok(skyCitadel);
  assert.ok(skyCitadelAttachment);
  assert.equal(slime.skill, '$generate2dsprite');
  assert.equal(femaleWarrior.category, 'hero');
  assert.equal(skyCitadel.skill, '$generate2dmap');
  assert.match(femaleWarrior.outputDir, /assets\/rpg\/heroes\/female\/warrior/);
  assert.equal(femaleBerserker.sheet, 'single');
  assert.match(femaleBerserker.outputDir, /assets\/rpg\/heroes\/advanced\/female\/berserker/);
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

test('확장 레이드 보스와 전장은 생성된 이미지 파일에 연결되어 있다', () => {
  const raidBossIds = [
    'boss_goblin_warband_idle',
    'boss_crystal_hydra_idle',
    'boss_marsh_behemoth_idle',
    'boss_ruins_sentinel_idle',
    'boss_flame_giant_idle',
    'boss_frost_lich_idle',
    'boss_storm_wyvern_idle',
    'boss_void_knights_idle',
    'boss_sky_golem_idle',
    'boss_apocalypse_dragon_idle'
  ];
  const raidMapIds = [
    'map_goblin_war_camp',
    'map_crystal_nest',
    'map_marsh_depths',
    'map_ruins_obelisk',
    'map_lava_throne',
    'map_frost_catacomb',
    'map_storm_spire',
    'map_void_bastion',
    'map_sky_foundry',
    'map_eclipse_throne'
  ];

  assert.ok(getRpgAssetCount() >= 57);

  for (const assetId of [...raidBossIds, ...raidMapIds]) {
    const asset = getRpgAssetById(assetId);
    const attachment = getRpgAssetAttachment(assetId);

    assert.ok(asset, `${assetId} asset definition missing`);
    assert.ok(attachment, `${assetId} generated file missing`);
    assert.match(attachment.name, /^rpg-image-\d+\.[a-z0-9]+$/i);
    assert.doesNotMatch(attachment.name, new RegExp(assetId, 'i'));
  }
});

test('추가 사냥터 배경은 agent-sprite-forge 맵 이미지에 연결되어 있다', () => {
  const huntingGroundMapIds = [
    'map_wildflower_plains',
    'map_moonlit_hill',
    'map_mushroom_grove',
    'map_bandit_outpost',
    'map_red_desert',
    'map_thunder_plateau',
    'map_crystal_lake',
    'map_phantom_forest',
    'map_abyss_mine',
    'map_starfall_crater',
    'map_dragon_nest',
    'map_void_gate'
  ];

  for (const assetId of huntingGroundMapIds) {
    const asset = getRpgAssetById(assetId);
    const attachment = getRpgAssetAttachment(assetId);

    assert.ok(asset, `${assetId} asset definition missing`);
    assert.equal(asset.skill, '$generate2dmap');
    assert.ok(attachment, `${assetId} generated file missing`);
    assert.match(attachment.name, /^rpg-image-\d+\.png$/i);
    assert.doesNotMatch(attachment.name, new RegExp(assetId, 'i'));
  }
});



test('모든 RPG 맵 배경은 agent-sprite-forge 단일 16:9 산출물과 메타데이터를 가진다', () => {
  const maps = getRpgAssetBatch({ kind: 'map', limit: 100 });

  assert.equal(maps.length, 29);

  for (const map of maps) {
    const generated = getRpgGeneratedAssetById(map.id);
    const filePath = getRpgAssetFilePath(map.id);
    const assetJsonPath = `${map.outputDir}/asset.json`;

    assert.ok(generated, `${map.id} generated manifest missing`);
    assert.equal(generated.status, 'generated', `${map.id} must not be fallback/crop status`);
    assert.equal(generated.generatedWith, 'agent-sprite-forge:$generate2dmap', `${map.id} forge provenance missing`);
    assert.ok(generated.meta, `${map.id} pipeline metadata path missing`);
    assert.ok(filePath, `${map.id} raw file missing`);
    assert.ok(existsSync(assetJsonPath), `${map.id} per-map asset.json missing`);
    assert.ok(existsSync(generated.meta), `${map.id} pipeline metadata file missing`);
    assert.deepEqual(readPngSize(filePath), [1024, 576], `${map.id} must be normalized to 1024x576`);

    const perMap = JSON.parse(readFileSync(assetJsonPath, 'utf8'));
    assert.equal(perMap.generatedWith, 'agent-sprite-forge:$generate2dmap', `${map.id} per-map forge provenance missing`);
    assert.equal(perMap.status, 'generated', `${map.id} per-map status must be generated`);
    assert.equal(perMap.meta, generated.meta, `${map.id} per-map meta must match manifest`);
  }
});

test('전직 영웅 이미지는 남녀 모두 생성된 파일에 연결되어 있다', () => {
  const advancedHeroIds = [
    'hero_berserker_idle',
    'hero_female_berserker_idle',
    'hero_archmage_idle',
    'hero_female_archmage_idle',
    'hero_sniper_idle',
    'hero_female_sniper_idle',
    'hero_crusader_idle',
    'hero_female_crusader_idle',
    'hero_shadow_idle',
    'hero_female_shadow_idle',
    'hero_saint_idle',
    'hero_female_saint_idle'
  ];

  for (const assetId of advancedHeroIds) {
    const asset = getRpgAssetById(assetId);
    const attachment = getRpgAssetAttachment(assetId);

    assert.ok(asset, `${assetId} asset definition missing`);
    assert.equal(asset.category, 'hero');
    assert.match(asset.outputDir, /assets\/rpg\/heroes\/advanced/);
    assert.ok(attachment, `${assetId} generated file missing`);
    assert.match(attachment.name, /^rpg-image-\d+\.[a-z0-9]+$/i);
    assert.doesNotMatch(attachment.name, new RegExp(assetId, 'i'));
  }
});


function readPngSize(filePath) {
  const buffer = readFileSync(filePath);
  assert.equal(buffer.toString('ascii', 1, 4), 'PNG', `${filePath} is not a PNG`);
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}
