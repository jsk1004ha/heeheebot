import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createSqliteStore } from '../src/storage/sqlite-store.js';
import { getRpgCommandPayloads, handleRpgCommand } from '../src/commands/rpg.js';
import { createRpgVisualPayload } from '../src/commands/rpg/visual.js';
import { playOddEven } from '../src/systems/casino.js';
import { EconomyService } from '../src/systems/economy.js';
import { getRpgDungeonRunTheme } from '../src/systems/rpg-dungeon-run.js';
import { getRpgAssetAttachment } from '../src/systems/rpg-assets.js';
import {
  getRpgAdvancedClassOptions,
  getRpgAdvancedClassConfig,
  getRpgAreaConfig,
  getRpgAreaOptions,
  getRpgBossOptions,
  getRpgCraftingRecipeConfig,
  getRpgCraftingRecipeOptions,
  getRpgDailyMissionConfig,
  getRpgDailyMissionOptions,
  getRpgDungeonConfig,
  getRpgDungeonOptions,
  getRpgFirstJobOptions,
  getRpgItemConfig,
  getRpgQuestConfig,
  getRpgQuestOptions,
  getRpgStartClassOptions,
  getRpgStoryChapterConfig,
  getRpgStoryChapterOptions,
  getUnlockedRpgAreaIds,
  normalizeRpgDailyMissionId,
  normalizeRpgArea,
  normalizeRpgQuestId,
  normalizeRpgStoryChapterId,
  resolveRpgExploration,
  rollRpgGearDrop
} from '../src/systems/rpg.js';

test('RPG 명령 payload는 희희봇 RPG 흐름과 간결한 명령만 등록한다', () => {
  const [command] = getRpgCommandPayloads();
  const subcommands = command.options.map((option) => option.name);

  assert.equal(command.name, 'rpg');
  assert.equal(subcommands.length, 24);
  assert.deepEqual(subcommands, [
    '시작',
    '메뉴',
    '튜토리얼',
    '사냥',
    '직업변경',
    '탐사',
    '던전',
    '보스',
    '프로필',
    '상점',
    '인벤토리',
    '장비',
    '강화',
    '일일',
    '휴식',
    '듀얼직업',
    '전직',
    '스토리',
    '도감',
    '제작',
    '거래소',
    '레이드',
    '길드레이드',
    '지역'
  ]);
  assert.equal(subcommands.includes('가챠'), false);
  assert.equal(subcommands.includes('전투'), false);
  assert.equal(subcommands.includes('상태'), false);
  assert.equal(subcommands.includes('대결'), false);
  assert.equal(subcommands.includes('퀘스트'), false);
  assert.equal(subcommands.includes('스킬트리'), false);
  assert.equal(subcommands.includes('전리품'), false);

  const storyOptions = command.options
    .find((option) => option.name === '스토리')
    .options
    ?.map((option) => option.name) ?? [];
  const codexOptions = command.options
    .find((option) => option.name === '도감')
    .options
    ?.map((option) => option.name) ?? [];
  assert.deepEqual(storyOptions, ['챕터']);
  assert.deepEqual(codexOptions, ['몬스터']);
  const inventoryOptions = command.options
    .find((option) => option.name === '인벤토리')
    .options
    ?.map((option) => option.name) ?? [];
  assert.deepEqual(inventoryOptions, ['보기', '장비']);

  const startChoices = command.options
    .find((option) => option.name === '시작')
    .options[0]
    .choices
    ?.map((choice) => choice.name) ?? [];
  assert.deepEqual(startChoices, []);
  assert.ok(Buffer.byteLength(JSON.stringify(command)) < 8_000, '/rpg command must stay below Discord 8000-byte limit');

  assert.deepEqual(
    getRpgStartClassOptions().map((option) => option.name),
    ['모험가']
  );
  assert.deepEqual(
    getRpgFirstJobOptions().map((option) => option.name),
    ['검사', '마법사', '궁수', '성기사', '성직자', '도적', '타짜', '대장장이']
  );

  for (const option of command.options) {
    assert.ok((option.choices?.length ?? 0) <= 25, `${option.name} choices exceed Discord limit`);
    for (const child of option.options ?? []) {
      assert.ok((child.choices?.length ?? 0) <= 25, `${option.name}/${child.name} choices exceed Discord limit`);
    }
  }
});

test('RPG 콘텐츠는 보스·던전·전직 트리·재료·제작 레시피를 확장한다', () => {
  const bosses = getRpgBossOptions().map((option) => option.name);
  const dungeons = getRpgDungeonOptions().map((option) => option.name);
  const recipes = getRpgCraftingRecipeOptions().map((option) => option.name);
  const weaponRecipes = getRpgCraftingRecipeOptions('weapon').map((option) => option.name);

  assert.ok(bosses.length >= 10);
  assert.ok(bosses.some((name) => name.includes('오크 전쟁군주')));
  assert.ok(bosses.some((name) => name.includes('마왕 발타르')));
  assert.ok(dungeons.length >= 18);
  assert.ok(dungeons.some((name) => name.includes('고블린 동굴')));
  assert.ok(dungeons.some((name) => name.includes('마왕성 외곽')));
  assert.ok(dungeons.some((name) => name.includes('마탑 금서고')));
  assert.ok(dungeons.some((name) => name.includes('히든 달샘 유적')));
  assert.equal(getRpgDungeonConfig('달샘 유적').hidden, true);
  assert.equal(getRpgDungeonConfig('용심장 화로').unlockRequirement.area, 'ancient_dragon_altar');
  assert.ok(recipes.some((name) => name.includes('철 장검')));
  assert.ok(weaponRecipes.some((name) => name.includes('강철 할버드')));
  assert.ok(weaponRecipes.some((name) => name.includes('검은 용창')));
  assert.equal(getRpgItemConfig('용비늘').label, '용비늘');
  assert.equal(getRpgItemConfig('용의심장').label, '용의심장');
  assert.equal(getRpgItemConfig('철괴').type, 'material');
  assert.equal(getRpgItemConfig('고블린 창').dropOnly, true);
  assert.equal(getRpgItemConfig('고블린 창').assetId, 'item_goblin_spear_icon');
  assert.equal(getRpgItemConfig('검은 용비늘 갑옷').dropOnly, true);
  assert.equal(getRpgItemConfig('검은 용비늘 갑옷').assetId, 'item_black_dragon_scaleplate_icon');
  assert.equal(getRpgItemConfig('니드호그 갑옷').craftedOnly, true);
  assert.equal(getRpgItemConfig('니드호그 갑옷').assetId, 'item_nidhogg_plate_icon');
  assert.equal(getRpgItemConfig('용의심장 대장장이 망치').assetId, 'item_hidden_dragonheart_hammer_icon');
  assert.equal(getRpgCraftingRecipeConfig('용비늘 방패').category, 'armor');
  assert.equal(getRpgCraftingRecipeConfig('왕국의 왕관').masteryType, 'accessory');
  const firstPlainsDrop = rollRpgGearDrop({
    source: 'dungeon',
    area: 'wildflower_plains',
    randomInt: ((rolls) => (min, max) => Math.max(min, Math.min(max, rolls.shift() ?? min)))([100, 100, 0, 0])
  });
  const firstDragonDrop = rollRpgGearDrop({
    source: 'dungeon',
    area: 'dragon_nest',
    randomInt: ((rolls) => (min, max) => Math.max(min, Math.min(max, rolls.shift() ?? min)))([100, 100, 0, 0])
  });
  assert.equal(firstPlainsDrop.baseItemId, 'goblin_spear');
  assert.equal(firstDragonDrop.baseItemId, 'black_dragon_scaleplate');
  const hiddenDungeonDrop = rollRpgGearDrop({
    source: 'hiddenDungeon',
    area: 'moonlit_feywood',
    pool: ['hidden_forest_king_bow'],
    randomInt: ((rolls) => (min, max) => Math.max(min, Math.min(max, rolls.shift() ?? min)))([100, 100, 0, 0])
  });
  assert.equal(hiddenDungeonDrop.baseItemId, 'hidden_forest_king_bow');
  assert.equal(hiddenDungeonDrop.hidden, true);
  const hiddenExplore = resolveRpgExploration({
    playerLevel: 60,
    area: '달빛 요정숲',
    randomInt: ((rolls) => (min, max) => Math.max(min, Math.min(max, rolls.shift() ?? max)))([100, 70, 160])
  });
  assert.equal(hiddenExplore.event, 'secret_passage');
  assert.equal(getRpgAdvancedClassConfig('창기사').unlockLevel, 25);
  assert.equal(getRpgAdvancedClassConfig('용화로 장인').classQuest.requirement.type, 'craftedItems');
  assert.equal(getRpgAdvancedClassConfig('카드술사').unlockLevel, 25);
  assert.equal(getRpgAdvancedClassConfig('주사위꾼').unlockLevel, 25);
  assert.equal(getRpgAdvancedClassConfig('운명의 딜러').label, '운명의 딜러');
  assert.equal(getRpgAdvancedClassConfig('광기의 도박사').unlockLevel, 45);
  assert.equal(getRpgAdvancedClassConfig('검성').classQuest.requirement.type, 'areaProgress');
  assert.equal(getRpgAdvancedClassConfig('무기 장인').classQuest.requirement.type, 'craftedItems');
  assert.equal(getRpgAdvancedClassOptions().some((option) => /카드술사|주사위꾼|운명의 딜러|광기의 도박사/.test(option.name)), true);
  assert.ok(getRpgQuestOptions().some((option) => option.name === '달샘의 비밀'));
  assert.ok(getRpgDailyMissionOptions().some((option) => option.name === '레이드 보급 임무'));
  assert.ok(getRpgStoryChapterOptions().some((option) => option.name === '마왕 발타르의 그림자'));
  assert.equal(getRpgQuestConfig('고룡 제단의 시련').requirement.area, 'ancient_dragon_altar');
  assert.equal(getRpgDailyMissionConfig('길드 공납 정산').requirement.type, 'goldEarned');
  assert.equal(getRpgStoryChapterConfig('고룡 제단의 봉인').requirement.area, 'ancient_dragon_altar');
  assert.equal(normalizeRpgQuestId('두 번째 길의 맹세'), 'dual_path_oath');
  assert.equal(normalizeRpgDailyMissionId('현상수배 보스'), 'boss_bounty');
  assert.equal(normalizeRpgStoryChapterId('마왕 발타르의 그림자'), 'valtar_shadow');
});

test('RPG 캐릭터 진행도는 같은 유저면 다른 서버에서도 이어진다', async () => {
  const fixture = await createFixture();

  try {
    await fixture.economy.chooseRpgClass({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      characterClass: 'novice',
      characterGender: 'female',
      now: 1_000
    });

    const status = await fixture.economy.getRpgStatus({
      guildId: 'guild-2',
      userId: 'user-1',
      username: '용사',
      now: 2_000
    });
    const data = await fixture.store.load();

    assert.equal(status.profile.rpg.startedAt, 1_000);
    assert.equal(status.profile.rpg.characterClass, 'novice');
    assert.equal(status.profile.rpg.characterGender, 'female');
    assert.equal(data.guilds['guild-1'].users?.['user-1'], undefined);
    assert.equal(data.accounts.users['user-1'].rpg.startedAt, 1_000);
  } finally {
    await fixture.cleanup();
  }
});

test('RPG 일일 의뢰와 메인 퀘스트는 별도 진행도와 보상을 가진다', async () => {
  const fixture = await createFixture();

  try {
    await fixture.economy.chooseRpgClass({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      characterClass: 'novice',
      characterGender: 'male',
      now: 1_000
    });

    await mutateProfile(fixture.store, (profile) => {
      profile.rpg.level = 15;
      profile.rpg.totalXp = 4_000;
      profile.rpg.monsterKills = { 슬라임: 3 };
      profile.rpg.areaProgress = {
        moonlit_feywood: 35,
        ancient_dragon_altar: 40
      };
      profile.rpg.daily = {
        day: 0,
        battles: 4,
        wins: 2,
        explores: 2,
        dungeons: 2,
        bosses: 1,
        raids: 1,
        goldEarned: 600,
        claimedMissions: {}
      };
    });

    const quest = await fixture.economy.claimRpgQuest({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      questId: '두 번째 길의 맹세',
      now: 1_000
    });
    assert.equal(quest.questId, 'dual_path_oath');
    assert.ok(quest.profile.rpg.claimedQuests.dual_path_oath);
    assert.equal(quest.profile.rpg.inventory.mana_potion, 2);
    assert.equal(quest.profile.level, 1);

    const daily = await fixture.economy.claimRpgDailyMission({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      missionId: '길드 공납 정산',
      now: 1_000
    });
    assert.equal(daily.missionId, 'guild_tithe');
    assert.ok(daily.profile.rpg.daily.claimedMissions.guild_tithe);
    assert.equal(daily.profile.rpg.inventory.silver_ore, 2);
    assert.equal(daily.profile.level, 1);

    const story = await fixture.economy.progressRpgStory({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      chapterId: '두 직업의 서약',
      now: 1_000
    });
    assert.equal(story.chapterId, 'dual_oath');
    assert.ok(story.profile.rpg.storyChapters.dual_oath);
    assert.equal(story.profile.rpg.inventory.mana_potion, 4);
    assert.equal(story.profile.level, 1);
  } finally {
    await fixture.cleanup();
  }
});

test('RPG 카드는 긴 본문을 안전 길이로 줄이고 버튼 행을 3개 이하로 유지한다', async () => {
  const content = [
    '🧙 **희희봇 RPG 긴 화면**',
    ...Array.from({ length: 80 }, (_, index) => `- 긴 설명 ${index + 1}: 버튼으로 이어갈 수 있는 내용을 반복합니다.`)
  ].join('\n');
  const payload = createRpgVisualPayload(content);

  assert.ok(payload.embeds[0].data.description.length <= 1200);
  assert.doesNotMatch(payload.embeds[0].data.description, /생략/);

  const fixture = await createFixture();
  try {
    await fixture.economy.chooseRpgClass({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      characterClass: 'novice',
      characterGender: 'male',
      now: 1_000
    });
    const interaction = createChatInputInteraction('메뉴');
    const handled = await handleRpgCommand(interaction, fixture.economy);

    assert.equal(handled, true);
    assert.equal(interaction.replies.length, 1);
    assert.match(interaction.replies[0].embeds[0].data.title, /RPG 허브/);
    assert.match(getReplyDescription(interaction.replies[0]), /HP .*MP .*XP|추천|상태판|아래 버튼/);
    for (const row of interaction.replies[0].components ?? []) {
      assert.ok((row.components?.length ?? 0) <= 3, 'RPG button rows should stay compact');
    }
  } finally {
    await fixture.cleanup();
  }
});

test('RPG 카드는 지역 배경 에셋을 히어로보다 메인 이미지로 우선 표시한다', () => {
  const payload = createRpgVisualPayload(
    '🧭 **RPG 튜토리얼**\n왕도 남쪽 초원에서 첫 사냥을 준비합니다.',
    ['hero_adventurer_idle', 'map_runtime_area_forest']
  );
  const mapAttachment = getRpgAssetAttachment('map_runtime_area_forest');
  const heroAttachment = getRpgAssetAttachment('hero_adventurer_idle');

  assert.equal(payload.embeds[0].data.image.url, `attachment://${mapAttachment.name}`);
  assert.equal(payload.embeds[0].data.thumbnail.url, `attachment://${heroAttachment.name}`);
  assert.deepEqual(payload.files.map((file) => file.name), [mapAttachment.name, heroAttachment.name]);
});

test('RPG 일반 사냥은 버튼으로 조작하는 수동 전투를 시작한다', async () => {
  const fixture = await createFixture({ randomInt: (min) => min });

  try {
    await fixture.economy.chooseRpgClass({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      characterClass: 'novice',
      characterGender: 'male',
      now: 1_000
    });
    await mutateProfile(fixture.store, (profile) => {
      profile.rpg.level = 10;
      profile.rpg.hp = 120;
      profile.rpg.mp = 80;
    });

    const interaction = createChatInputInteraction('사냥');
    const handled = await handleRpgCommand(interaction, fixture.economy);
    const description = getReplyDescription(interaction.replies[0]);
    const customIds = getComponentCustomIds(interaction.replies[0].components);

    assert.equal(handled, true);
    assert.match(interaction.replies[0].embeds[0].data.title, /수동 사냥 시작/);
    assert.match(description, /직접 공격\/스킬\/방어\/포션/);
    assert.match(description, /몬스터 상태/);
    assert.doesNotMatch(description, /전투 판정:|📊 전적:/);
    assert.ok(description.length < 900, 'hunt start should prioritize a compact summary');
    assert.ok(customIds.some((id) => id.startsWith('rpg_hunt_action:') && id.endsWith(':basic')));
  } finally {
    await fixture.cleanup();
  }
});

test('RPG 수동 사냥 버튼은 턴을 진행하고 종료 보상을 정산한다', async () => {
  const fixture = await createFixture({ randomInt: (min) => min });

  try {
    await fixture.economy.chooseRpgClass({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      characterClass: 'novice',
      characterGender: 'male',
      now: 1_000
    });
    await mutateProfile(fixture.store, (profile) => {
      profile.rpg.level = 80;
      profile.rpg.hp = 500;
      profile.rpg.mp = 200;
    });

    const start = createChatInputInteraction('사냥');
    await handleRpgCommand(start, fixture.economy);

    let currentReply = start.replies[0];
    let actionId = getComponentCustomIds(currentReply.components)
      .find((id) => id.startsWith('rpg_hunt_action:') && id.endsWith(':basic'));
    let finishedReply = null;

    for (let turn = 0; turn < 5 && actionId; turn += 1) {
      const button = createButtonInteraction(actionId);
      const handled = await handleRpgCommand(button, fixture.economy);
      currentReply = button.edits[0] ?? button.updates[0] ?? button.replies[0];

      assert.equal(handled, true);
      assert.ok(currentReply, 'hunt button should update the message');

      const title = currentReply.embeds?.[0]?.data?.title ?? '';
      if (/수동 사냥 종료/.test(title)) {
        finishedReply = currentReply;
        break;
      }

      actionId = getComponentCustomIds(currentReply.components)
        .find((id) => id.startsWith('rpg_hunt_action:') && id.endsWith(':basic'));
    }

    assert.ok(finishedReply, 'manual hunt should finish through button turns');
    assert.match(getReplyDescription(finishedReply), /보상: \+/);

    const stored = await fixture.economy.getProfile('guild-1', 'user-1', '용사');
    assert.equal(stored.rpg.battles, 1);
    assert.equal(stored.rpg.wins, 1);
    assert.equal(stored.rpg.daily.battles, 1);
    assert.equal(stored.rpg.daily.wins, 1);
  } finally {
    await fixture.cleanup();
  }
});

test('RPG 탐사 전투 이벤트는 실제 조우 전투 기록과 보상을 사용한다', async () => {
  const fixture = await createFixture({ randomInt: (min) => min });

  try {
    await fixture.economy.chooseRpgClass({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '탐험가',
      characterClass: 'novice',
      characterGender: 'female',
      now: 1_000
    });
    await mutateProfile(fixture.store, (profile) => {
      profile.rpg.level = 80;
      profile.rpg.hp = 500;
      profile.rpg.mp = 200;
    });

    const result = await fixture.economy.exploreRpg({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '탐험가',
      area: 'forest',
      now: 2_000
    });

    assert.equal(result.exploration.event, 'battle');
    assert.ok(result.battle, 'battle exploration should include an actual combat result');
    assert.equal(result.battle.win, true);
    assert.equal(result.xpGained, result.battle.rewards.xp);
    assert.equal(result.requestedCoinReward, result.battle.rewards.coins);
    assert.equal(result.profile.rpg.explores, 1);
    assert.equal(result.profile.rpg.battles, 1);
    assert.equal(result.profile.rpg.wins, 1);
    assert.equal(result.profile.rpg.daily.explores, 1);
    assert.equal(result.profile.rpg.daily.battles, 1);
    assert.equal(result.profile.rpg.daily.wins, 1);
  } finally {
    await fixture.cleanup();
  }
});

test('제작은 재료와 골드를 소모해 품질 장비를 만들고 숙련도를 올린다', async () => {
  const fixture = await createFixture({ randomInt: (min) => min });

  try {
    await fixture.economy.chooseRpgClass({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '장인',
      characterClass: 'novice',
      characterGender: 'male',
      now: 1_000
    });
    await mutateProfile(fixture.store, (profile) => {
      profile.balance = 10_000;
      profile.rpg.level = 10;
      profile.rpg.inventory = {
        iron_ingot: 5,
        tough_leather: 2,
        lesser_magic_stone: 1
      };
      profile.rpg.craftingMastery = {
        weapon: { level: 2, xp: 0 }
      };
    });

    const result = await fixture.economy.craftRpgRecipe({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '장인',
      recipeId: '철 장검'
    });

    const [gear] = result.createdGear;
    assert.equal(result.successCount, 1);
    assert.equal(result.failureCount, 0);
    assert.equal(result.profile.balance, 9_880);
    assert.equal(result.profile.rpg.inventory.iron_ingot, undefined);
    assert.equal(result.profile.rpg.craftedItems, 1);
    assert.equal(result.mastery.type, 'weapon');
    assert.equal(gear.crafted, true);
    assert.equal(gear.baseItemId, 'iron_longsword');
    assert.match(gear.label, /철 장검/);
  } finally {
    await fixture.cleanup();
  }
});

test('히든 제작 장비와 거래소 판매/구매는 RPG 장비와 골드만 처리한다', async () => {
  const fixture = await createFixture({ randomInt: (min) => min });

  try {
    await fixture.economy.chooseRpgClass({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '대장장이',
      characterClass: 'novice',
      characterGender: 'male',
      now: 1_000
    });
    await fixture.economy.getProfile('guild-1', 'buyer-1', '구매자');
    await mutateProfile(fixture.store, (profile) => {
      profile.balance = 30_000;
      profile.rpg.level = 65;
      profile.rpg.characterClass = 'blacksmith';
      profile.rpg.primaryClass = 'blacksmith';
      profile.rpg.unlockedClasses = ['novice', 'blacksmith'];
      profile.rpg.craftingMastery = {
        engineering: { level: 8, xp: 0 }
      };
      profile.rpg.inventory = {
        dragon_scale: 12,
        dragon_claw: 4,
        dragon_heart: 1,
        mythic_metal: 1,
        artisan_hammer: 1
      };
    });
    await fixture.store.update((data) => {
      data.accounts.users['buyer-1'].balance = 20_000;
    });

    const crafted = await fixture.economy.craftRpgRecipe({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '대장장이',
      recipeId: '용의심장 대장장이 망치'
    });
    const gearId = Object.keys(crafted.profile.rpg.gearInventory)[0];
    const gear = crafted.profile.rpg.gearInventory[gearId];

    assert.equal(crafted.successCount, 1);
    assert.equal(gear.hidden, true);
    assert.equal(gear.baseItemId, 'hidden_dragonheart_hammer');

    const gearInventoryInteraction = createChatInputInteraction('인벤토리', {
      보기: 'gear'
    });
    await handleRpgCommand(gearInventoryInteraction, fixture.economy);
    assert.match(gearInventoryInteraction.replies[0].embeds[0].data.title, /RPG 인벤토리 장비/);
    assert.match(getReplyDescription(gearInventoryInteraction.replies[0]), /용의심장 대장장이 망치/);
    assert.doesNotMatch(getReplyDescription(gearInventoryInteraction.replies[0]), /전리품/);

    const listed = await fixture.economy.createRpgMarketListing({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '대장장이',
      item: gearId,
      price: 5_000
    });
    assert.equal(listed.marketListings.length, 1);
    assert.equal(Object.keys(listed.profile.rpg.gearInventory).length, 0);

    const searchInteraction = createChatInputInteraction('거래소', {
      작업: 'search',
      품목: '용의심장'
    });
    await handleRpgCommand(searchInteraction, fixture.economy);
    assert.match(getReplyDescription(searchInteraction.replies[0]), /용의심장 대장장이 망치/);
    assert.doesNotMatch(getReplyDescription(searchInteraction.replies[0]), /rpg_market_/);
    assert.ok(
      getComponentCustomIds(searchInteraction.replies[0].components).includes('rpg_select:user-1:market_cancel'),
      'seller should get a cancel select menu'
    );

    const buyerView = createChatInputInteraction('거래소', {}, {
      user: { id: 'buyer-1', username: '구매자' }
    });
    await handleRpgCommand(buyerView, fixture.economy);
    assert.match(getReplyDescription(buyerView.replies[0]), /1\..*용의심장 대장장이 망치/);
    assert.doesNotMatch(getReplyDescription(buyerView.replies[0]), /rpg_market_/);
    assert.ok(
      getComponentCustomIds(buyerView.replies[0].components).includes('rpg_select:buyer-1:market_buy'),
      'buyer should get a purchase select menu'
    );

    await assert.rejects(
      () => fixture.economy.buyRpgMarketListing({
        guildId: 'guild-1',
        userId: 'user-1',
        username: '대장장이',
        listingId: listed.listing.id
      }),
      /자신이 등록한 매물/
    );

    const buyInteraction = createStringSelectInteraction('market_buy', listed.listing.id, {
      user: { id: 'buyer-1', username: '구매자' }
    });
    await handleRpgCommand(buyInteraction, fixture.economy);
    assert.match(buyInteraction.updates[0].embeds[0].data.title, /거래소 구매 완료/);
    assert.match(getReplyDescription(buyInteraction.updates[0]), /현재 골드: \*\*15,000골드\*\*/);

    const buyer = await fixture.economy.getProfile('guild-1', 'buyer-1', '구매자');
    const seller = await fixture.economy.getProfile('guild-1', 'user-1', '대장장이');
    const marketAfterPurchase = await fixture.economy.getRpgMarketplace({ guildId: 'guild-1' });
    assert.equal(buyer.balance, 15_000);
    assert.equal(seller.balance, 30_800);
    assert.equal(Object.keys(buyer.rpg.gearInventory).length, 1);
    assert.equal(marketAfterPurchase.marketListings.length, 0);
  } finally {
    await fixture.cleanup();
  }
});

test('/rpg 인벤토리는 장비 관리 진입점을 한 화면으로 압축한다', async () => {
  const fixture = await createFixture();

  try {
    await fixture.economy.chooseRpgClass({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      characterClass: 'novice',
      characterGender: 'male',
      now: 1_000
    });
    await mutateProfile(fixture.store, (profile) => {
      profile.rpg.inventory = {
        potion: 2,
        iron_sword: 1,
        enhancement_stone: 3
      };
      profile.rpg.gearInventory = {
        gear_alpha: {
          id: 'gear_alpha',
          baseItemId: 'iron_longsword',
          label: '철 장검',
          rarity: 'common',
          rarityLabel: '일반',
          slot: 'weapon',
          stats: { attack: 5 },
          power: 3,
          enhanceLevel: 0,
          assetId: 'item_iron_longsword_icon',
          acquiredAt: 1_100
        }
      };
      profile.rpg.equippedGear.weapon = 'gear_alpha';
    });

    const interaction = createChatInputInteraction('인벤토리');
    await handleRpgCommand(interaction, fixture.economy);

    const description = getReplyDescription(interaction.replies[0]);
    assert.match(description, /착용 중인 장비/);
    assert.match(description, /보유 장비/);
    assert.doesNotMatch(description, /인벤토리 장비|전리품|rpg_/);
    assert.ok(interaction.replies[0].components.length <= 3, 'inventory hub should stay compact');

    const customIds = getComponentCustomIds(interaction.replies[0].components);
    assert.ok(customIds.includes('rpg_select:user-1:gear_equip'), 'default inventory should allow direct gear equip');
    assert.ok(customIds.includes('rpg_quick:user-1:gear'), 'inventory should link to gear list');
    assert.ok(customIds.includes('rpg_quick:user-1:enhance'), 'inventory should link to enhancement view');
    assert.ok(customIds.includes('rpg_quick:user-1:disassemble'), 'inventory should link to disassembly view');
  } finally {
    await fixture.cleanup();
  }
});

test('히든 던전 탐사는 레벨과 탐사 진행도를 요구하고 전용 장비를 준다', async () => {
  const fixture = await createFixture({
    rpgDungeonCooldownMs: 0,
    randomInt: (_min, max) => max
  });

  try {
    await fixture.economy.chooseRpgClass({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '탐험가',
      characterClass: 'novice',
      characterGender: 'male',
      now: 1_000
    });
    await mutateProfile(fixture.store, (profile) => {
      profile.rpg.level = 55;
      profile.rpg.hp = 500;
      profile.rpg.mp = 500;
      profile.rpg.areaProgress = { moonlit_feywood: 34 };
    });

    await assert.rejects(
      () => fixture.economy.runRpgDungeon({
        guildId: 'guild-1',
        userId: 'user-1',
        username: '탐험가',
        dungeonId: '달샘 유적',
        depth: 1,
        now: 2_000
      }),
      /히든 달샘 유적 던전 조건이 부족합니다.*34\/35/
    );

    await mutateProfile(fixture.store, (profile) => {
      profile.rpg.areaProgress = { moonlit_feywood: 35 };
    });
    const started = await fixture.economy.runRpgDungeon({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '탐험가',
      dungeonId: '달샘 유적',
      depth: 1,
      now: 3_000
    });

    assert.equal(started.type, 'dungeon_run');
    assert.equal(started.run.maxFloors, 3);
    assert.equal(started.dungeonConfig.hidden, true);
    assert.equal(started.area, 'moonlit_feywood');
    assert.equal(started.profile.rpg.dungeonClears.moonlit_feywood, undefined);

    const result = await clearDungeonRun(fixture.economy, started, {
      guildId: 'guild-1',
      userId: 'user-1',
      username: '탐험가',
      now: 4_000
    });

    assert.equal(result.type, 'dungeon_result');
    assert.equal(result.outcome, 'cleared');
    assert.equal(result.dungeonConfig.hidden, true);
    assert.equal(result.area, 'moonlit_feywood');
    assert.equal(result.profile.rpg.dungeonClears.moonlit_feywood, 1);
    assert.equal(result.gearDrop.baseItemId, 'hidden_forest_king_bow');
    assert.equal(result.gearDrop.hidden, true);
    assert.ok(result.materialDrops.some((drop) => drop.itemId === 'shadow_crystal'));
  } finally {
    await fixture.cleanup();
  }
});

test('RPG 던전은 진행형 로그라이트 런으로 시작·선택·유물·정산을 처리한다', async () => {
  const fixture = await createFixture({ rpgDungeonCooldownMs: 0, randomInt: (min) => min });

  try {
    await fixture.economy.chooseRpgClass({ guildId: 'guild-1', userId: 'user-1', username: '탐험가', characterClass: 'novice', characterGender: 'male', now: 1_000 });
    await mutateProfile(fixture.store, (profile) => {
      profile.rpg.level = 20;
      profile.rpg.hp = 400;
      profile.rpg.mp = 120;
    });

    const started = await fixture.economy.runRpgDungeon({ guildId: 'guild-1', userId: 'user-1', username: '탐험가', depth: 5, now: 2_000 });
    assert.equal(started.type, 'dungeon_run');
    assert.equal(started.run.state, 'active');
    assert.ok(started.run.maxFloors >= 3 && started.run.maxFloors <= 5);
    assert.ok(started.run.currentChoices.some((choice) => choice.risk === 'high'));
    assert.equal(started.profile.rpg.daily.dungeons, 0);

    const highRisk = started.run.currentChoices.find((choice) => choice.risk === 'high');
    const room = await fixture.economy.chooseRpgDungeonRoom({ guildId: 'guild-1', userId: 'user-1', username: '탐험가', runId: started.run.id, revision: started.run.revision, choiceId: highRisk.id, now: 3_000 });
    assert.equal(room.type, 'dungeon_run');
    assert.equal(room.run.state, 'active');
    assert.equal(room.run.floor, 2);
    assert.equal(room.run.highRiskTaken, true);

    await assert.rejects(
      () => fixture.economy.chooseRpgDungeonRoom({ guildId: 'guild-1', userId: 'user-1', username: '탐험가', runId: started.run.id, revision: started.run.revision, choiceId: highRisk.id, now: 3_100 }),
      /이미 지난 던전 선택/
    );

    const secondChoice = room.run.currentChoices.find((choice) => choice.risk !== 'high') ?? room.run.currentChoices[0];
    const secondRoom = await fixture.economy.chooseRpgDungeonRoom({ guildId: 'guild-1', userId: 'user-1', username: '탐험가', runId: room.run.id, revision: room.run.revision, choiceId: secondChoice.id, now: 4_000 });
    assert.equal(secondRoom.run.state, 'awaiting_relic');
    assert.ok(secondRoom.run.pendingRelicChoices.length >= 2);
    assert.ok(secondRoom.run.pendingRelicChoices.every((relic) => relic.upside && relic.downside));

    const relic = secondRoom.run.pendingRelicChoices[0];
    const afterRelic = await fixture.economy.chooseRpgDungeonRelic({ guildId: 'guild-1', userId: 'user-1', username: '탐험가', runId: secondRoom.run.id, revision: secondRoom.run.revision, relicId: relic.id, now: 5_000 });
    assert.equal(afterRelic.type, 'dungeon_run');
    assert.equal(afterRelic.run.state, 'active');
    assert.equal(afterRelic.run.relics[0].id, relic.id);

    afterRelic.profile.rpg.dungeonRun.relics[0].label = 'mutated';
    const stored = await fixture.economy.getProfile('guild-1', 'user-1', '탐험가');
    assert.notEqual(stored.rpg.dungeonRun.relics[0].label, 'mutated');

    const result = await clearDungeonRun(fixture.economy, afterRelic, { guildId: 'guild-1', userId: 'user-1', username: '탐험가', now: 6_000 });
    assert.equal(result.type, 'dungeon_result');
    assert.equal(result.outcome, 'cleared');
    assert.equal(result.profile.rpg.dungeonRun, null);
    assert.equal(result.profile.rpg.daily.dungeons, 1);
    assert.equal(result.profile.rpg.dungeonClears.forest, 1);
    assert.equal(getRpgDungeonRunTheme('volcano'), 'desert');
    assert.equal(getRpgDungeonRunTheme('abyss_mine'), 'cave');
    assert.equal(getRpgDungeonRunTheme('void_gate'), 'void');
  } finally {
    await fixture.cleanup();
  }
});

test('/rpg 던전 UI는 짧은 진행 카드와 던전 버튼을 반환한다', async () => {
  const fixture = await createFixture({ rpgDungeonCooldownMs: 0, randomInt: (min) => min });

  try {
    await fixture.economy.chooseRpgClass({ guildId: 'guild-1', userId: 'user-1', username: '용사', characterClass: 'novice', characterGender: 'male', now: 1_000 });
    await mutateProfile(fixture.store, (profile) => {
      profile.rpg.level = 10;
      profile.rpg.hp = 300;
      profile.rpg.mp = 100;
    });
    const interaction = createChatInputInteraction('던전', {}, { integers: { 깊이: 3 } });
    const handled = await handleRpgCommand(interaction, fixture.economy);
    assert.equal(handled, true);
    const description = getReplyDescription(interaction.replies[0]);
    assert.match(description, /던전 진행/);
    assert.match(description, /다음 방/);
    assert.match(description, /보상 미리보기/);
    assert.doesNotMatch(description, /성공 확률|계산식|몇줄 생략/);
    assert.ok(description.length < 1_200);
    const customIds = getComponentCustomIds(interaction.replies[0].components);
    assert.ok(customIds.some((id) => id.startsWith('rpg_dungeon:user-1:room:')));
    assert.ok(customIds.some((id) => id.startsWith('rpg_dungeon:user-1:resume:')), 'dungeon card should expose a state refresh button');
  } finally {
    await fixture.cleanup();
  }
});

test('RPG 장비 추천은 슬롯별 더 강한 장비를 자동 장착하고 비교를 남긴다', async () => {
  const fixture = await createFixture();

  try {
    await fixture.economy.chooseRpgClass({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      characterClass: 'novice',
      characterGender: 'male',
      now: 1_000
    });
    await mutateProfile(fixture.store, (profile) => {
      profile.rpg.gearInventory = {
        weak_weapon: {
          id: 'weak_weapon',
          label: '낡은 철검',
          rarity: 'common',
          rarityLabel: '일반',
          slot: 'weapon',
          stats: { attack: 2 },
          power: 1,
          enhanceLevel: 0,
          assetId: 'item_iron_sword_icon',
          acquiredAt: 1_100
        },
        strong_weapon: {
          id: 'strong_weapon',
          label: '기사 장검',
          rarity: 'rare',
          rarityLabel: '희귀',
          slot: 'weapon',
          stats: { attack: 8, maxHp: 12 },
          power: 5,
          enhanceLevel: 0,
          assetId: 'item_iron_longsword_icon',
          acquiredAt: 1_200
        },
        sturdy_armor: {
          id: 'sturdy_armor',
          label: '튼튼한 갑옷',
          rarity: 'rare',
          rarityLabel: '희귀',
          slot: 'armor',
          stats: { defense: 6, maxHp: 30 },
          power: 4,
          enhanceLevel: 0,
          assetId: 'item_leather_armor_icon',
          acquiredAt: 1_300
        }
      };
      profile.rpg.equippedGear.weapon = 'weak_weapon';
    });

    const recommended = await fixture.economy.equipRecommendedRpgGear({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사'
    });

    assert.equal(recommended.equipped.length, 2);
    assert.equal(recommended.profile.rpg.equippedGear.weapon, 'strong_weapon');
    assert.equal(recommended.profile.rpg.equippedGear.armor, 'sturdy_armor');
    assert.ok(recommended.equipped[0].comparison.scoreDelta > 0);

    const inventory = createChatInputInteraction('인벤토리');
    await handleRpgCommand(inventory, fixture.economy);
    assert.match(getReplyDescription(inventory.replies[0]), /추천/);
    assert.ok(getComponentCustomIds(inventory.replies[0].components).includes('rpg_gear_recommend:user-1:balanced'));
  } finally {
    await fixture.cleanup();
  }
});

test('RPG 세계관은 중세 판타지 사냥터로 교체되고 레벨 해금은 RPG 레벨 기준이다', () => {
  const labels = getRpgAreaOptions().map((option) => option.name);

  assert.ok(labels.some((name) => name.includes('왕도 남쪽 초원')));
  assert.ok(labels.some((name) => name.includes('고블린 숲')));
  assert.ok(labels.some((name) => name.includes('용의 둥지')));
  assert.ok(labels.some((name) => name.includes('마왕성')));
  assert.ok(labels.some((name) => name.includes('달빛 요정숲')));
  assert.ok(labels.some((name) => name.includes('고룡의 제단')));
  assert.equal(labels.some((name) => /균열|코어|데이터 돔|공허|수정|별무리|천공/.test(name)), false);

  assert.equal(normalizeRpgArea('고블린숲'), 'wildflower_plains');
  assert.equal(normalizeRpgArea('용의둥지'), 'volcano');
  assert.equal(normalizeRpgArea('검은용둥지'), 'dragon_nest');
  assert.equal(normalizeRpgArea('달샘 숲'), 'moonlit_feywood');
  assert.equal(normalizeRpgArea('고룡 제단'), 'ancient_dragon_altar');
  assert.equal(normalizeRpgArea('마왕성'), 'void_gate');
  assert.equal(getRpgAreaConfig('forest').label, '왕도 남쪽 초원');
  assert.deepEqual(getUnlockedRpgAreaIds(1), ['forest', 'starfall_crater']);
  assert.ok(getUnlockedRpgAreaIds(80).includes('void_gate'));
  assert.ok(getUnlockedRpgAreaIds(80).includes('ancient_dragon_altar'));
});

test('일반 봇 레벨과 RPG 레벨은 분리되고 1차/듀얼 직업은 RPG 레벨로 해금된다', async () => {
  const fixture = await createFixture();

  try {
    const created = await fixture.economy.chooseRpgClass({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      characterClass: 'novice',
      characterGender: 'female',
      now: 1_000
    });
    assert.equal(created.characterClass, 'novice');
    assert.equal(created.profile.level, 1);
    assert.equal(created.profile.rpg.level, 1);

    await assert.rejects(
      () => fixture.economy.chooseRpgFirstJob({
        guildId: 'guild-1',
        userId: 'user-1',
        username: '용사',
        characterClass: '검사'
      }),
      /RPG Lv\.10/
    );

    await mutateProfile(fixture.store, (profile) => {
      profile.level = 12;
      profile.xp = 34;
      profile.totalXp = 9_999;
      profile.rpg.level = 10;
      profile.rpg.totalXp = 1_500;
    });

    const firstJob = await fixture.economy.chooseRpgFirstJob({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      characterClass: '검사'
    });
    assert.equal(firstJob.characterClass, 'warrior');
    assert.equal(firstJob.profile.level, 12);
    assert.equal(firstJob.profile.rpg.level, 10);

    await assert.rejects(
      () => fixture.economy.chooseRpgDualClass({
        guildId: 'guild-1',
        userId: 'user-1',
        username: '용사',
        characterClass: '타짜'
      }),
      /RPG Lv\.15/
    );

    await mutateProfile(fixture.store, (profile) => {
      profile.rpg.level = 15;
      profile.rpg.totalXp = 4_000;
    });

    const dualJob = await fixture.economy.chooseRpgDualClass({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      characterClass: '타짜'
    });
    assert.equal(dualJob.characterClass, 'tazza');

    const switched = await fixture.economy.switchRpgClass({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      characterClass: '타짜'
    });
    assert.equal(switched.profile.rpg.characterClass, 'tazza');
    assert.equal(switched.profile.rpg.activeSlot, 'secondary');
    assert.equal(switched.profile.level, 12);
  } finally {
    await fixture.cleanup();
  }
});

test('기존 RPG 데이터 초기화는 RPG 상태만 리셋하고 골드와 일반 레벨은 보존한다', async () => {
  const fixture = await createFixture();

  try {
    await fixture.store.update((data) => {
      data.guilds['guild-1'] = {
        users: {
          'user-1': {
            userId: 'user-1',
            username: '기존유저',
            level: 9,
            xp: 12,
            totalXp: 3_000,
            balance: 77_777,
            rpg: {
              schemaVersion: 'legacy-rpg-v9',
              level: 80,
              totalXp: 999_999,
              characterClass: 'warrior',
              currentArea: 'void_gate',
              equipment: { weapon: 'legacy_blaster' },
              wins: 999
            }
          }
        }
      };
    });

    const profile = await fixture.economy.getProfile('guild-1', 'user-1', '기존유저');

    assert.equal(profile.balance, 77_777);
    assert.equal(profile.level, 9);
    assert.equal(profile.xp, 12);
    assert.equal(profile.rpg.schemaVersion, 'heehee-rpg-v1');
    assert.equal(profile.rpg.level, 1);
    assert.equal(profile.rpg.totalXp, 0);
    assert.equal(profile.rpg.characterClass, 'novice');
    assert.equal(profile.rpg.currentArea, 'forest');
    assert.equal(profile.rpg.wins, 0);
    assert.notEqual(profile.rpg.equipment.weapon, 'legacy_blaster');
  } finally {
    await fixture.cleanup();
  }
});

test('RPG 전투 경험치는 일반 봇 레벨이 아니라 RPG 레벨/경험치만 올린다', async () => {
  const fixture = await createFixture({ randomInt: () => 150 });

  try {
    const before = await fixture.economy.getProfile('guild-1', 'user-1', '테스터');
    const result = await fixture.economy.awardRpgBattleWin({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '테스터'
    });

    assert.equal(before.level, 1);
    assert.equal(before.totalXp, 0);
    assert.equal(result.xpGained, 150);
    assert.equal(result.profile.level, 1);
    assert.equal(result.profile.totalXp, 0);
    assert.equal(result.profile.rpg.totalXp, 150);
    assert.equal(result.profile.rpg.level >= 1, true);
  } finally {
    await fixture.cleanup();
  }
});

test('2차와 3차 전직은 레벨, 숙련도, 미션 조건을 모두 요구한다', async () => {
  const fixture = await createFixture();

  try {
    await fixture.economy.chooseRpgClass({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '전직러',
      characterClass: 'novice',
      characterGender: 'male',
      now: 1_000
    });
    await mutateProfile(fixture.store, (profile) => {
      profile.rpg.level = 25;
      profile.rpg.characterClass = 'warrior';
      profile.rpg.primaryClass = 'warrior';
      profile.rpg.unlockedClasses = ['novice', 'warrior'];
      profile.rpg.classMastery = { warrior: { level: 3, progress: 0 } };
      profile.rpg.wins = 4;
    });

    assert.equal(getRpgAdvancedClassConfig('berserker').unlockLevel, 25);
    await assert.rejects(
      () => fixture.economy.advanceRpgClass({
        guildId: 'guild-1',
        userId: 'user-1',
        username: '전직러',
        advancedClass: '광전사'
      }),
      /전직 퀘스트 '피의 결의'.*4\/5/
    );

    await mutateProfile(fixture.store, (profile) => {
      profile.rpg.wins = 5;
    });
    const secondJob = await fixture.economy.advanceRpgClass({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '전직러',
      advancedClass: '광전사'
    });
    assert.equal(secondJob.advancedClass, 'berserker');

    await mutateProfile(fixture.store, (profile) => {
      profile.rpg.level = 45;
      profile.rpg.advancedClass = null;
      profile.rpg.classMastery = { warrior: { level: 7, progress: 0 } };
      profile.rpg.raidClears = {};
    });
    assert.equal(getRpgAdvancedClassConfig('blood_warlord').unlockLevel, 45);
    await assert.rejects(
      () => fixture.economy.advanceRpgClass({
        guildId: 'guild-1',
        userId: 'user-1',
        username: '전직러',
        advancedClass: '피의 전쟁군주'
      }),
      /먼저 같은 계열 2차 전직/
    );

    await mutateProfile(fixture.store, (profile) => {
      profile.rpg.advancedClass = 'berserker';
    });
    await assert.rejects(
      () => fixture.economy.advanceRpgClass({
        guildId: 'guild-1',
        userId: 'user-1',
        username: '전직러',
        advancedClass: '피의 전쟁군주'
      }),
      /전직 퀘스트 '오크 전쟁군주 격파'.*0\/1/
    );

    await mutateProfile(fixture.store, (profile) => {
      profile.rpg.raidClears = { orc_warlord: 1 };
    });
    const thirdJob = await fixture.economy.advanceRpgClass({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '전직러',
      advancedClass: '피의 전쟁군주'
    });
    assert.equal(thirdJob.advancedClass, 'blood_warlord');
  } finally {
    await fixture.cleanup();
  }
});

test('/rpg 전직은 1차 직업명과 2차/3차 전직명을 모두 처리한다', async () => {
  const fixture = await createFixture();

  try {
    await fixture.economy.chooseRpgClass({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      characterClass: 'novice',
      characterGender: 'male',
      now: 1_000
    });
    await mutateProfile(fixture.store, (profile) => {
      profile.rpg.level = 10;
    });

    const firstJobInteraction = createChatInputInteraction('전직', { 전직: '검사' });
    await handleRpgCommand(firstJobInteraction, fixture.economy);
    assert.equal(firstJobInteraction.replies.length, 1);
    assert.match(getReplyDescription(firstJobInteraction.replies[0]), /직업: \*\*검사\*\*/);

    await mutateProfile(fixture.store, (profile) => {
      profile.rpg.level = 25;
      profile.rpg.classMastery = { warrior: { level: 3, progress: 0 } };
      profile.rpg.wins = 5;
    });

    const secondJobInteraction = createChatInputInteraction('전직', { 전직: '광전사' });
    await handleRpgCommand(secondJobInteraction, fixture.economy);
    assert.equal(secondJobInteraction.replies.length, 1);
    assert.match(getReplyDescription(secondJobInteraction.replies[0]), /전직: \*\*광전사\*\*/);
  } finally {
    await fixture.cleanup();
  }
});

test('타짜는 카지노 확률을 바꾸지 않고 정산 금액만 증감한다', async () => {
  const fixture = await createFixture();

  try {
    const oddEven = playOddEven({ choice: 'even', bet: 100, randomInt: () => 2 });
    assert.equal(oddEven.win, true);
    assert.equal(oddEven.payout, 190);

    await fixture.economy.getProfile('guild-1', 'user-1', '타짜');
    await mutateProfile(fixture.store, (profile) => {
      profile.balance = 1_000;
    });
    const normalWin = await fixture.economy.settleWager({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '타짜',
      bet: 100,
      payout: oddEven.payout
    });
    assert.equal(normalWin.bet, 100);
    assert.equal(normalWin.payout, 190);
    assert.equal(normalWin.profit, 90);
    assert.equal(normalWin.rpgCasinoModifier, null);
    assert.equal(normalWin.profile.balance, 1_090);

    await mutateProfile(fixture.store, (profile) => {
      profile.balance = 1_000;
      profile.rpg.characterClass = 'tazza';
      profile.rpg.primaryClass = 'tazza';
      profile.rpg.activeSlot = 'primary';
      profile.rpg.unlockedClasses = ['novice', 'tazza'];
    });
    const tazzaWin = await fixture.economy.settleWager({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '타짜',
      bet: 100,
      payout: oddEven.payout
    });
    assert.equal(tazzaWin.basePayout, 190);
    assert.equal(tazzaWin.bet, 100);
    assert.equal(tazzaWin.payout, 206);
    assert.equal(tazzaWin.profit, 106);
    assert.equal(tazzaWin.rpgCasinoModifier.source, 'active_tazza');
    assert.equal(tazzaWin.profile.balance, 1_106);

    await mutateProfile(fixture.store, (profile) => {
      profile.balance = 1_000;
      profile.rpg.characterClass = 'tazza';
      profile.rpg.primaryClass = 'tazza';
    });
    const tazzaLoss = await fixture.economy.settleWager({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '타짜',
      bet: 100,
      payout: 0
    });
    assert.equal(tazzaLoss.baseBet, 100);
    assert.equal(tazzaLoss.bet, 115);
    assert.equal(tazzaLoss.payout, 0);
    assert.equal(tazzaLoss.profile.balance, 885);

    await mutateProfile(fixture.store, (profile) => {
      profile.balance = 1_000;
      profile.rpg.characterClass = 'tazza';
      profile.rpg.primaryClass = 'tazza';
    });
    await fixture.economy.reserveWager({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '타짜',
      bet: 100
    });
    const reservedWin = await fixture.economy.resolveReservedWager({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '타짜',
      bet: 100,
      payout: oddEven.payout
    });
    assert.equal(reservedWin.basePayout, 190);
    assert.equal(reservedWin.payout, 206);
    assert.equal(reservedWin.profile.balance, 1_106);
  } finally {
    await fixture.cleanup();
  }
});


async function clearDungeonRun(economy, currentResult, { guildId, userId, username, now = Date.now() }) {
  let current = currentResult;
  for (let step = 0; step < 20; step += 1) {
    if (current.type === 'dungeon_result') return current;
    if (current.run.state === 'awaiting_relic') {
      current = await economy.chooseRpgDungeonRelic({ guildId, userId, username, runId: current.run.id, revision: current.run.revision, relicId: current.run.pendingRelicChoices[0].id, now: now + step });
      continue;
    }
    const choice = current.run.currentChoices.find((candidate) => candidate.type === 'boss')
      ?? current.run.currentChoices.find((candidate) => candidate.risk !== 'high')
      ?? current.run.currentChoices[0];
    current = await economy.chooseRpgDungeonRoom({ guildId, userId, username, runId: current.run.id, revision: current.run.revision, choiceId: choice.id, now: now + step });
  }
  throw new Error('던전 클리어 루프가 끝나지 않았습니다.');
}

async function createFixture(options = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'heehee-rpg-test-'));
  const store = createSqliteStore(join(dir, 'state.sqlite'));
  const economy = new EconomyService(store, {
    rpgBattleCooldownMs: 0,
    rpgBattleWinXpMin: 150,
    rpgBattleWinXpMax: 150,
    ...options
  });

  return {
    dir,
    store,
    economy,
    async cleanup() {
      store.close();
      await rm(dir, { recursive: true, force: true });
    }
  };
}

async function mutateProfile(store, mutator) {
  await store.update((data) => {
    const profile = data.accounts.users['user-1'];
    mutator(profile);
  });
}

function createChatInputInteraction(subcommand, strings = {}, options = {}) {
  const replies = [];
  const user = options.user ?? { id: 'user-1', username: '용사' };
  const integers = options.integers ?? {};
  return {
    commandName: 'rpg',
    guildId: options.guildId ?? 'guild-1',
    user,
    replies,
    isButton: () => false,
    isStringSelectMenu: () => false,
    isChatInputCommand: () => true,
    inGuild: () => true,
    options: {
      getSubcommand: () => subcommand,
      getString: (name) => strings[name] ?? null,
      getInteger: (name) => integers[name] ?? null,
      getUser: () => null
    },
    async reply(payload) {
      replies.push(payload);
    }
  };
}

function createStringSelectInteraction(action, selected, options = {}) {
  const replies = [];
  const updates = [];
  const user = options.user ?? { id: 'user-1', username: '용사' };
  return {
    commandName: 'rpg',
    guildId: options.guildId ?? 'guild-1',
    user,
    customId: `rpg_select:${user.id}:${action}`,
    values: [selected],
    replies,
    updates,
    isButton: () => false,
    isStringSelectMenu: () => true,
    isChatInputCommand: () => false,
    inGuild: () => true,
    async reply(payload) {
      replies.push(payload);
    },
    async update(payload) {
      updates.push(payload);
    }
  };
}

function createButtonInteraction(customId, options = {}) {
  const replies = [];
  const updates = [];
  const edits = [];
  const followUps = [];
  const user = options.user ?? { id: 'user-1', username: '용사' };
  return {
    commandName: 'rpg',
    guildId: options.guildId ?? 'guild-1',
    user,
    customId,
    replies,
    updates,
    edits,
    followUps,
    deferred: false,
    replied: false,
    isButton: () => true,
    isStringSelectMenu: () => false,
    isChatInputCommand: () => false,
    inGuild: () => true,
    async deferUpdate() {
      this.deferred = true;
    },
    async reply(payload) {
      this.replied = true;
      replies.push(payload);
    },
    async update(payload) {
      this.replied = true;
      updates.push(payload);
    },
    async editReply(payload) {
      this.replied = true;
      edits.push(payload);
    },
    async followUp(payload) {
      followUps.push(payload);
    }
  };
}

function getReplyDescription(reply) {
  return reply?.embeds?.[0]?.data?.description ?? reply?.content ?? '';
}

function getComponentCustomIds(components = []) {
  return components
    .flatMap((row) => row.components ?? [])
    .map((component) => component.data?.custom_id ?? component.data?.customId ?? component.customId)
    .filter(Boolean);
}
