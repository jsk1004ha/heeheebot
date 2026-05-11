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
  assert.equal(subcommands.length, 25);
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
    '전리품',
    '강화',
    '퀘스트',
    '일일',
    '휴식',
    '듀얼직업',
    '스킬트리',
    '전직',
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
  assert.equal(subcommands.includes('스토리'), false);
  assert.equal(subcommands.includes('도감'), false);

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

    await assert.rejects(
      () => fixture.economy.buyRpgMarketListing({
        guildId: 'guild-1',
        userId: 'user-1',
        username: '대장장이',
        listingId: listed.listing.id
      }),
      /자신이 등록한 매물/
    );

    const purchased = await fixture.economy.buyRpgMarketListing({
      guildId: 'guild-1',
      userId: 'buyer-1',
      username: '구매자',
      listingId: listed.listing.id
    });
    assert.equal(purchased.buyer.balance, 15_000);
    assert.equal(purchased.seller.balance, 30_800);
    assert.equal(Object.keys(purchased.buyer.rpg.gearInventory).length, 1);
    assert.equal(purchased.marketListings.length, 0);
  } finally {
    await fixture.cleanup();
  }
});

test('히든 던전 탐사는 레벨과 탐사 진행도를 요구하고 전용 전리품을 준다', async () => {
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
    const result = await fixture.economy.runRpgDungeon({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '탐험가',
      dungeonId: '달샘 유적',
      depth: 1,
      now: 3_000
    });

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

function createChatInputInteraction(subcommand, strings = {}) {
  const replies = [];
  return {
    commandName: 'rpg',
    guildId: 'guild-1',
    user: { id: 'user-1', username: '용사' },
    replies,
    isButton: () => false,
    isStringSelectMenu: () => false,
    isChatInputCommand: () => true,
    inGuild: () => true,
    options: {
      getSubcommand: () => subcommand,
      getString: (name) => strings[name] ?? null,
      getInteger: () => null,
      getUser: () => null
    },
    async reply(payload) {
      replies.push(payload);
    }
  };
}

function getReplyDescription(reply) {
  return reply?.embeds?.[0]?.data?.description ?? reply?.content ?? '';
}
