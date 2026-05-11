import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname } from 'node:path';
import test from 'node:test';
import {
  getRpgAreaConfig,
  getRpgAreaOptions,
  getRpgAdvancedClassConfig,
  getRpgAdvancedClassOptions,
  getRpgBossConfig,
  getRpgBossOptions,
  getRpgDungeonConfig,
  getRpgDungeonOptions,
  getRpgMonsterAssetId,
  getRpgRaidConfig,
  getRpgRaidOptions
} from '../src/systems/rpg.js';
import {
  formatRpgAssetLine,
  getRpgAssetAttachment,
  getRpgAssetBatch,
  getRpgAssetById,
  getRpgAssetCount,
  getRpgAssetFilePath,
  getRpgGeneratedAssetById
} from '../src/systems/rpg-assets.js';

test('RPG 중세 판타지 에셋은 표준 assets/rpg 구조와 manifest에 연결되어 있다', () => {
  const ids = [
    'hero_tazza_idle',
    'hero_female_tazza_idle',
    'hero_blacksmith_idle',
    'hero_female_blacksmith_idle',
    'item_card_deck_icon',
    'item_lucky_dice_icon',
    'item_blacksmith_hammer_icon',
    'item_goblin_spear_icon',
    'item_black_dragon_scaleplate_icon',
    'item_black_dragon_spear_icon',
    'item_hidden_dragonheart_hammer_icon',
    'item_nidhogg_plate_icon',
    'item_kings_crown_icon',
    'map_forest_glade',
    'map_wildflower_plains',
    'map_crystal_cave',
    'map_dragon_nest',
    'map_thunder_plateau',
    'map_void_gate'
  ];

  assert.equal(existsSync('assets/rpg/heehee-rpg'), false);
  assert.ok(getRpgAssetCount() >= ids.length);

  for (const assetId of ids) {
    const asset = getRpgAssetById(assetId);
    const generated = getRpgGeneratedAssetById(assetId);
    const filePath = getRpgAssetFilePath(assetId);
    const attachment = getRpgAssetAttachment(assetId);

    assert.ok(asset, `${assetId} asset definition missing`);
    assert.match(asset.outputDir, /^assets\/rpg\/(heroes|maps|items)\//, `${assetId} should use standard RPG asset folders`);
    assert.doesNotMatch(asset.outputDir, /heehee-rpg/);
    assert.doesNotMatch(asset.prompt ?? '', new RegExp('guild' + 'quest', 'i'));
    assert.ok(generated, `${assetId} generated manifest missing`);
    assert.equal(generated.status, asset.category === 'map' ? 'generated' : 'processed');
    assert.doesNotMatch(generated.raw, /heehee-rpg/);
    assert.ok(filePath, `${assetId} file path missing`);
    assert.ok(existsSync(filePath), `${assetId} raw image missing`);
    assert.ok(attachment, `${assetId} attachment missing`);
    assert.match(attachment.name, /^rpg-image-\d+\.[a-z0-9]+$/i);

    const [width, height] = readPngSize(filePath);
    if (asset.category === 'map') {
      assert.deepEqual([width, height], [1024, 576], `${assetId} map size`);
      assert.equal(asset.skill, '$generate2dmap');
    } else if (asset.category === 'item') {
      assert.deepEqual([width, height], [256, 256], `${assetId} item size`);
      assert.equal(asset.skill, '$generate2dsprite');
    } else {
      assert.deepEqual([width, height], [512, 512], `${assetId} hero sheet size`);
      assert.equal(asset.category, 'hero');
    }
  }
});

test('기존 공용 RPG 에셋과 신규 중세 RPG 에셋을 함께 batch 조회할 수 있다', () => {
  const heroes = getRpgAssetBatch({ category: 'hero', limit: 500 });
  const maps = getRpgAssetBatch({ category: 'map', limit: 500 });
  const items = getRpgAssetBatch({ category: 'item', limit: 500 });
  const tazza = getRpgAssetById('hero_tazza_idle');

  assert.ok(heroes.some((asset) => asset.id === 'hero_tazza_idle'));
  assert.ok(heroes.some((asset) => asset.id === 'hero_warrior_idle'));
  assert.ok(maps.some((asset) => asset.id === 'map_forest_glade'));
  assert.ok(maps.some((asset) => asset.id === 'map_wildflower_plains'));
  assert.ok(items.some((asset) => asset.id === 'item_card_deck_icon'));
  assert.ok(items.some((asset) => asset.id === 'item_goblin_spear_icon'));
  assert.ok(items.some((asset) => asset.id === 'item_nidhogg_plate_icon'));
  assert.ok(items.some((asset) => asset.id === 'item_hidden_dragonheart_hammer_icon'));
  assert.match(formatRpgAssetLine(tazza), /hero_tazza_idle/);
});

test('RPG 에셋 manifest는 전체 정의를 agent-sprite-forge 산출물 계약으로 고정한다', () => {
  const assets = getAllRpgAssets();
  const manifest = JSON.parse(readFileSync('assets/rpg/asset-manifest.json', 'utf8'));
  const manifestIds = manifest.assets.map((asset) => asset.id);

  assert.equal(assets.length, getRpgAssetCount());
  assert.equal(manifestIds.length, assets.length);
  assert.equal(new Set(manifestIds).size, manifestIds.length, 'manifest id duplicates');

  for (const asset of assets) {
    const generated = getRpgGeneratedAssetById(asset.id);
    const expectedGenerator = `agent-sprite-forge:${asset.skill}`;
    const filePath = getRpgAssetFilePath(asset.id);

    assert.ok(generated, `${asset.id} generated manifest missing`);
    assert.equal(generated.generatedWith, expectedGenerator, `${asset.id} generatedWith`);
    assert.equal(generated.label, asset.label, `${asset.id} label drift`);
    assert.equal(generated.category, asset.category, `${asset.id} category drift`);
    assert.equal(generated.kind, asset.kind, `${asset.id} kind drift`);
    assert.equal(generated.sheet, asset.sheet, `${asset.id} sheet drift`);
    assert.match(generated.source ?? '', /\/\.codex\/generated_images\//, `${asset.id} source provenance`);
    assert.match(generated.prompt, new RegExp(`^${escapeRegExp(asset.outputDir)}/prompt-used\\.txt$`));
    assert.ok(filePath, `${asset.id} runtime file path missing`);
    assert.ok(existsSync(filePath), `${asset.id} runtime file missing`);

    if (asset.category === 'map') {
      assert.deepEqual(readPngSize(filePath), [1024, 576], `${asset.id} map size`);
      continue;
    }

    if (asset.category === 'item') {
      assert.equal(extname(filePath), '.png', `${asset.id} item runtime extension`);
      assert.deepEqual(readPngSize(filePath), [256, 256], `${asset.id} item runtime size`);
    }
  }
});

test('RPG 런타임 배경은 저해상도 감사용 맵이 아니라 forge 전투 배경을 사용한다', () => {
  const runtimeBackgrounds = [
    ...getRpgAreaOptions().map(({ value }) => [`area:${value}`, getRpgAreaConfig(value).backgroundAssetId]),
    ...getRpgBossOptions().map(({ value }) => [`boss:${value}`, getRpgBossConfig(value).backgroundAssetId]),
    ...getRpgRaidOptions().map(({ value }) => [`raid:${value}`, getRpgRaidConfig(value).backgroundAssetId]),
    ...getRpgDungeonOptions()
      .map(({ value }) => [`dungeon:${value}`, getRpgDungeonConfig(value).backgroundAssetId])
      .filter(([, assetId]) => Boolean(assetId))
  ];

  assert.equal(getRpgAreaConfig('forest').backgroundAssetId, 'map_forest_glade');

  for (const [scope, assetId] of runtimeBackgrounds) {
    const asset = getRpgAssetById(assetId);
    const generated = getRpgGeneratedAssetById(assetId);
    const filePath = getRpgAssetFilePath(assetId);

    assert.ok(asset, `${scope} background asset missing: ${assetId}`);
    assert.equal(asset.category, 'map', `${scope} background should be a map`);
    assert.ok(generated, `${scope} generated manifest missing: ${assetId}`);
    assert.equal(generated.generatedWith, 'agent-sprite-forge:$generate2dmap', `${scope} should use forge map output`);
    assert.ok(filePath, `${scope} runtime file missing: ${assetId}`);
    assert.ok(statSync(filePath).size > 100_000, `${scope} uses low-detail placeholder background: ${assetId}`);
  }
});

test('RPG 전직 이미지는 전직명과 성별마다 고유 런타임 에셋을 사용한다', () => {
  const seen = new Map();

  for (const { value } of getRpgAdvancedClassOptions()) {
    const config = getRpgAdvancedClassConfig(value);
    for (const gender of ['male', 'female']) {
      const assetId = config.assetIds?.[gender] ?? config.assetId;
      const scope = `${value}:${gender}`;
      const asset = getRpgAssetById(assetId);
      const generated = getRpgGeneratedAssetById(assetId);
      const filePath = getRpgAssetFilePath(assetId);

      assert.ok(asset, `${scope} advanced class asset missing: ${assetId}`);
      assert.equal(asset.category, 'hero', `${scope} should use a hero asset`);
      assert.ok(generated, `${scope} generated manifest missing: ${assetId}`);
      assert.ok(filePath, `${scope} runtime file missing: ${assetId}`);
      assert.deepEqual(readPngSize(filePath), [512, 512], `${scope} hero asset size`);
      assert.equal(seen.has(assetId), false, `${scope} reuses ${assetId} already used by ${seen.get(assetId)}`);
      seen.set(assetId, scope);
    }
  }
});

test('RPG 몬스터 이미지는 서로 다른 몬스터명마다 고유 런타임 에셋을 사용한다', () => {
  const monsterNames = new Set();

  for (const { value } of getRpgAreaOptions()) {
    const monsters = getRpgAreaConfig(value).monsters;
    for (const names of Object.values(monsters)) {
      for (const name of names) monsterNames.add(name);
    }
  }
  for (const { value } of getRpgBossOptions()) monsterNames.add(getRpgBossConfig(value).monster);
  for (const { value } of getRpgRaidOptions()) monsterNames.add(getRpgRaidConfig(value).monster);

  const seen = new Map();
  for (const monsterName of monsterNames) {
    const assetId = getRpgMonsterAssetId(monsterName);
    const asset = getRpgAssetById(assetId);
    const generated = getRpgGeneratedAssetById(assetId);
    const filePath = getRpgAssetFilePath(assetId);

    assert.ok(asset, `${monsterName} monster asset missing: ${assetId}`);
    assert.equal(asset.category, 'monster', `${monsterName} should use a monster asset`);
    assert.ok(generated, `${monsterName} generated manifest missing: ${assetId}`);
    assert.ok(filePath, `${monsterName} runtime file missing: ${assetId}`);
    assert.deepEqual(readPngSize(filePath), [512, 512], `${monsterName} monster asset size`);
    assert.equal(seen.has(assetId), false, `${monsterName} reuses ${assetId} already used by ${seen.get(assetId)}`);
    seen.set(assetId, monsterName);
  }
});

function readPngSize(filePath) {
  const buffer = readFileSync(filePath);
  assert.equal(buffer.toString('ascii', 1, 4), 'PNG', `${filePath} is not a PNG`);
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

function getAllRpgAssets() {
  const byId = new Map();
  for (const category of ['hero', 'monster', 'item', 'map']) {
    for (const asset of getRpgAssetBatch({ category, limit: 500 })) {
      byId.set(asset.id, asset);
    }
  }
  return [...byId.values()];
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
