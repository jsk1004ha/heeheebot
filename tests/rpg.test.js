import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createSqliteStore } from '../src/storage/sqlite-store.js';
import { getRpgCommandPayloads, handleRpgCommand } from '../src/commands/rpg.js';
import { EconomyService } from '../src/systems/economy.js';
import {
  getRpgAdventureGuide,
  normalizeRpgDifficulty,
  normalizeRpgGender,
  resolveRpgBattle,
  resolveRpgBossTurn,
  resolveRpgPvpTurn
} from '../src/systems/rpg.js';

test('RPG 명령 payload는 전투와 상태 subcommand를 등록한다', () => {
  const [command] = getRpgCommandPayloads();

  assert.equal(command.name, 'rpg');
  assert.deepEqual(command.options.map((option) => option.name), [
    '시작',
    '메뉴',
    '전투',
    '대결',
    '탐험',
    '던전',
    '보스',
    '상태',
    '상점',
    '인벤토리',
    '사용',
    '장비',
    '전리품',
    '장비강화',
    '퀘스트',
    '일일',
    '휴식',
    '가챠',
    '스킬트리',
    '전직',
    '스토리',
    '도감',
    '레이드',
    '길드레이드',
    '지역'
  ]);
  const battleCommand = command.options.find((option) => option.name === '전투');
  assert.deepEqual(
    battleCommand.options[0].choices.map((choice) => choice.name),
    ['쉬움', '보통', '어려움']
  );
  const pvpCommand = command.options.find((option) => option.name === '대결');
  assert.deepEqual(pvpCommand.options.map((option) => option.name), ['상대']);
  assert.equal(pvpCommand.options[0].required, true);
  assert.equal(command.options[0].options[0].required, false);
  assert.deepEqual(
    command.options[0].options[0].choices.map((choice) => choice.name),
    ['전사', '마법사', '궁수', '팔라딘 (가챠)', '도적 (가챠)', '사제 (가챠)']
  );
  assert.deepEqual(
    command.options[0].options[1].choices.map((choice) => choice.name),
    ['남캐', '여캐']
  );
  const equipmentCommand = command.options.find((option) => option.name === '장비');
  assert.equal(equipmentCommand.options[0].required, false);
  const gearCommand = command.options.find((option) => option.name === '전리품');
  assert.equal(gearCommand.options[0].name, '장비');
  const advanceCommand = command.options.find((option) => option.name === '전직');
  assert.equal(advanceCommand.options[0].required, false);
  const areaCommand = command.options.find((option) => option.name === '지역');
  assert.deepEqual(areaCommand.options.map((option) => option.name), ['지역']);
  assert.ok(areaCommand.options[0].choices.some((choice) => choice.name.includes('하늘 성채')));
  const dailyCommand = command.options.find((option) => option.name === '일일');
  assert.equal(dailyCommand.options[0].required, false);
  assert.ok(dailyCommand.options[0].choices.some((choice) => choice.name === '승리 계약'));
  const enhanceCommand = command.options.find((option) => option.name === '장비강화');
  assert.equal(enhanceCommand.options[0].name, '장비');
  assert.equal(enhanceCommand.options[0].required, false);
  const guildRaidCommand = command.options.find((option) => option.name === '길드레이드');
  assert.equal(guildRaidCommand.options[0].name, '레이드');
  assert.equal(guildRaidCommand.options[0].required, true);
});

test('RPG 탐험, 던전, 전리품, 스킬트리, 전직, 스토리, 도감, 레이드는 진행도를 확장한다', async () => {
  const fixture = await createFixture({
    randomInt: (_min, max) => max,
    rpgBattleCooldownMs: 0
  });

  try {
    await fixture.economy.chooseRpgClass({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      characterClass: 'warrior',
      characterGender: 'female',
      now: 1_000
    });
    await fixture.economy.awardActivityXp({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      xp: 400
    });
    await fixture.store.update((data) => {
      data.guilds['guild-1'].users['user-1'].rpg.wins = 1;
    });
    const learned = await fixture.economy.learnRpgSkill({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      skillId: 'weapon_training'
    });
    const advanced = await fixture.economy.advanceRpgClass({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      advancedClass: 'berserker'
    });
    const explored = await fixture.economy.exploreRpg({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      area: 'forest',
      now: 2_000
    });
    const dungeon = await fixture.economy.runRpgDungeon({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      area: 'forest',
      depth: 1,
      now: 3_000
    });
    const equippedGear = await fixture.economy.equipRpgGear({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      gearId: '1'
    });
    const battle = await fixture.economy.playRpgBattle({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      difficulty: 'easy',
      area: 'forest',
      now: 4_000
    });
    const story = await fixture.economy.progressRpgStory({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      chapterId: 'forest_oath',
      now: 5_000
    });
    const codex = await fixture.economy.claimRpgCodex({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      monsterName: battle.battle.monster,
      now: 6_000
    });
    const raid = await fixture.economy.playRpgRaid({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      raidId: 'slime_horde',
      now: 7_000
    });

    assert.equal(learned.profile.rpg.learnedSkills.includes('weapon_training'), true);
    assert.equal(advanced.profile.rpg.advancedClass, 'berserker');
    assert.equal(explored.profile.rpg.explores, 1);
    assert.equal(dungeon.depth, 1);
    assert.ok(dungeon.gearDrop);
    assert.equal(dungeon.profile.rpg.dungeonClears.forest, 1);
    assert.equal(equippedGear.profile.rpg.equippedGear[dungeon.gearDrop.slot], dungeon.gearDrop.id);
    assert.equal(story.profile.rpg.storyChapters.forest_oath, 5_000);
    assert.equal(codex.profile.rpg.codexClaims[battle.battle.monster], 6_000);
    assert.equal(raid.battle.difficulty, 'raid');
    assert.equal(raid.profile.rpg.raidClears.slime_horde, 1);
  } finally {
    await fixture.cleanup();
  }
});

test('RPG 전투 판정은 난이도와 결정적 난수를 따른다', () => {
  const win = resolveRpgBattle({
    playerLevel: 1,
    difficulty: '쉬움',
    randomInt: (min) => min
  });
  const loss = resolveRpgBattle({
    playerLevel: 1,
    difficulty: 'hard',
    randomInt: (_min, max) => max
  });

  assert.equal(normalizeRpgDifficulty('보통'), 'normal');
  assert.equal(normalizeRpgGender('여캐'), 'female');
  assert.equal(win.win, true);
  assert.equal(win.difficulty, 'easy');
  assert.equal(win.monster, '슬라임');
  assert.equal(win.rewards.xp, 35);
  assert.equal(win.rewards.coins, 80);
  assert.equal(win.areaLabel, '초록 숲');
  assert.equal(win.characterGender, 'male');
  assert.equal(win.assets.hero, 'hero_adventurer_idle');
  assert.equal(win.assets.monster, 'monster_slime_idle');
  assert.equal(loss.win, false);
  assert.equal(loss.difficulty, 'hard');
  assert.equal(loss.rewards.xp, 0);
  assert.equal(loss.rewards.coins, 0);

  const femaleMage = resolveRpgBattle({
    playerLevel: 1,
    characterClass: 'mage',
    characterGender: '여캐',
    randomInt: (min) => min
  });

  assert.equal(femaleMage.characterGenderLabel, '여캐');
  assert.equal(femaleMage.assets.hero, 'hero_female_mage_idle');
});

test('RPG PvP 턴 판정은 선택한 스킬로 피해와 MP 소모를 계산한다', () => {
  const turn = resolveRpgPvpTurn({
    attacker: {
      level: 1,
      characterClass: 'warrior',
      characterGender: 'female',
      guardBonus: 0,
      stats: {
        attack: 4,
        defense: 0
      }
    },
    defender: {
      level: 1,
      characterClass: 'mage',
      characterGender: 'male',
      guardBonus: 0,
      stats: {
        attack: 3,
        defense: 0
      }
    },
    skillId: 'power_strike',
    randomInt: () => 20
  });

  assert.equal(turn.skillId, 'power_strike');
  assert.equal(turn.skillLabel, '파워 스트라이크');
  assert.equal(turn.skillMpCost, 8);
  assert.equal(turn.roll, 20);
  assert.equal(turn.attackPower, 28);
  assert.equal(turn.damage, 9);
  assert.equal(turn.attacker.assets.hero, 'hero_female_warrior_idle');
  assert.equal(turn.defender.assets.hero, 'hero_mage_idle');
});

test('RPG 직업과 지역은 전투력, 보상, 해금 조건에 반영된다', async () => {
  const fixture = await createFixture({
    randomInt: (min) => min,
    rpgBattleCooldownMs: 0
  });

  try {
    const selected = await fixture.economy.chooseRpgClass({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      characterClass: 'warrior',
      characterGender: 'female',
      now: 1_000
    });
    const blocked = await fixture.economy.playRpgBattle({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      area: 'cave',
      now: 2_000
    }).catch((error) => error);
    await fixture.economy.awardActivityXp({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      xp: 100
    });
    const cave = await fixture.economy.playRpgBattle({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      difficulty: 'easy',
      area: 'cave',
      now: 3_000
    });
    const defaultAreaBattle = await fixture.economy.playRpgBattle({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      difficulty: 'easy',
      now: 4_000
    });

    assert.equal(selected.profile.rpg.characterClass, 'warrior');
    assert.equal(selected.profile.rpg.characterGender, 'female');
    assert.equal(selected.heroAssetId, 'hero_female_warrior_idle');
    assert.equal(selected.profile.rpg.startedAt, 1_000);
    assert.match(blocked.message, /Lv\.2부터/);
    assert.equal(cave.battle.characterClassLabel, '전사');
    assert.equal(cave.battle.characterGenderLabel, '여캐');
    assert.equal(cave.battle.areaLabel, '수정 동굴');
    assert.equal(cave.battle.assets.hero, 'hero_female_warrior_idle');
    assert.equal(cave.battle.playerPower, 9);
    assert.equal(cave.xpGained, 38);
    assert.equal(cave.coinReward, 92);
    assert.equal(cave.profile.rpg.currentArea, 'cave');
    assert.equal(cave.profile.rpg.discoveredMonsters['슬라임'], 1);
    assert.equal(defaultAreaBattle.battle.areaLabel, '수정 동굴');
    assert.equal(defaultAreaBattle.profile.rpg.currentArea, 'cave');
  } finally {
    await fixture.cleanup();
  }
});

test('RPG PvP는 수락 후 버튼 턴을 진행하고 종료 시 전적과 보상을 정산한다', async () => {
  const fixture = await createFixture({
    randomInt: () => 20,
    rpgBattleCooldownMs: 60_000
  });

  try {
    await fixture.economy.chooseRpgClass({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      characterClass: 'warrior',
      characterGender: 'female',
      now: 1_000
    });
    await fixture.economy.chooseRpgClass({
      guildId: 'guild-1',
      userId: 'user-2',
      username: '마법사',
      characterClass: 'mage',
      characterGender: 'male',
      now: 1_000
    });
    await fixture.store.update((data) => {
      data.guilds['guild-1'].users['user-2'].rpg.hp = 8;
    });

    const started = await fixture.economy.startRpgPvpDuel({
      guildId: 'guild-1',
      challenger: {
        userId: 'user-1',
        username: '용사'
      },
      opponent: {
        userId: 'user-2',
        username: '마법사'
      },
      now: 10_000
    });
    const finished = await fixture.economy.playRpgPvpTurn({
      guildId: 'guild-1',
      session: started.session,
      actorUserId: 'user-1',
      skillId: 'power_strike',
      now: 11_000
    });

    assert.equal(started.started, true);
    assert.equal(started.session.turnSide, 'challenger');
    assert.deepEqual(started.session.fighters.challenger.availableSkillIds, ['basic', 'power_strike', 'blade_storm']);
    assert.equal(started.challenger.rpg.lastBattleAt, 10_000);
    assert.equal(started.opponent.rpg.lastBattleAt, 10_000);

    assert.equal(finished.completed, true);
    assert.equal(finished.winnerUserId, 'user-1');
    assert.equal(finished.loserUserId, 'user-2');
    assert.equal(finished.turn.damage, 9);
    assert.equal(finished.rewards.xp, 80);
    assert.equal(finished.rewards.coins, 150);
    assert.equal(finished.challenger.totalXp, 80);
    assert.equal(finished.challenger.currencyBalances.rpg, 150);
    assert.equal(finished.challenger.rpg.mp, 27);
    assert.equal(finished.challenger.rpg.battles, 1);
    assert.equal(finished.challenger.rpg.wins, 1);
    assert.equal(finished.challenger.rpg.pvpBattles, 1);
    assert.equal(finished.challenger.rpg.pvpWins, 1);
    assert.equal(finished.opponent.rpg.battles, 1);
    assert.equal(finished.opponent.rpg.losses, 1);
    assert.equal(finished.opponent.rpg.pvpBattles, 1);
    assert.equal(finished.opponent.rpg.pvpLosses, 1);
    assert.equal(finished.opponent.rpg.hp, 1);
  } finally {
    await fixture.cleanup();
  }
});

test('RPG 상점, 장비, 포션은 전투 스탯과 HP에 반영된다', async () => {
  const fixture = await createFixture({
    dailyCoinReward: 1_000,
    dailyXpReward: 0,
    randomInt: (min) => min,
    rpgBattleCooldownMs: 0
  });

  try {
    await fixture.economy.chooseRpgClass({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      characterClass: 'warrior'
    });
    await fixture.economy.claimDaily({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      now: 10_000
    });
    await fixture.economy.exchangeWallet({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      fromCurrency: 'main',
      toCurrency: 'rpg',
      amount: 1_000
    });
    const purchase = await fixture.economy.buyRpgItem({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      itemId: 'iron_sword',
      quantity: 1
    });
    const equipped = await fixture.economy.equipRpgItem({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      itemId: 'iron_sword'
    });
    const battle = await fixture.economy.playRpgBattle({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      difficulty: 'easy',
      now: 20_000
    });
    const healed = await fixture.economy.useRpgItem({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      itemId: 'potion'
    });

    assert.equal(purchase.totalPrice, 500);
    assert.equal(purchase.profile.currencyBalances.rpg, 1_500);
    assert.equal(equipped.profile.rpg.equipment.weapon, 'iron_sword');
    assert.equal(equipped.derivedStats.attack, 8);
    assert.equal(battle.battle.playerPower, 11);
    assert.equal(battle.battle.attackBonus, 4);
    assert.equal(battle.battle.damageTaken, 1);
    assert.equal(battle.profile.rpg.hp, 109);
    assert.equal(healed.healed, 1);
    assert.equal(healed.profile.rpg.hp, 110);
    assert.equal(healed.profile.rpg.inventory.potion, 1);
  } finally {
    await fixture.cleanup();
  }
});

test('RPG 장비강화는 전리품 스탯과 RPG 골드를 갱신하고 명령 버튼 표면에 연결된다', async () => {
  const fixture = await createFixture({
    randomInt: (min) => min,
    rpgBattleCooldownMs: 0
  });

  try {
    await fixture.economy.chooseRpgClass({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      characterClass: 'warrior'
    });
    await seedRpgGold(fixture.store, 'guild-1', 'user-1', 1_000);
    await seedRpgGear(fixture.store, 'guild-1', 'user-1', {
      id: 'gear_test',
      baseItemId: 'iron_sword',
      slot: 'weapon',
      rarity: 'common',
      rarityLabel: '일반',
      label: '일반 철검',
      stats: { attack: 4 },
      power: 1,
      enhanceLevel: 0,
      assetId: 'item_iron_sword_icon',
      acquiredAt: 1_000
    });

    const enhanced = await fixture.economy.enhanceRpgGear({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      gearId: 'gear_test',
      now: 2_000
    });
    await seedRpgGold(fixture.store, 'guild-1', 'user-1', 1_000);
    const interaction = createRpgInteraction('장비강화', {
      stringOptions: { 장비: 'gear_test' }
    });
    await handleRpgCommand(interaction, fixture.economy);

    assert.equal(enhanced.success, true);
    assert.equal(enhanced.cost, 120);
    assert.equal(enhanced.gear.enhanceLevel, 1);
    assert.equal(enhanced.gear.stats.attack, 6);
    assert.equal(enhanced.profile.currencyBalances.rpg, 880);
    assert.match(interaction.replies[0].embeds[0].data.title, /장비 강화/);
  } finally {
    await fixture.cleanup();
  }
});

test('RPG 스킬은 MP를 소모하고 전투력에 반영된다', async () => {
  const fixture = await createFixture({
    randomInt: (min) => min,
    rpgBattleCooldownMs: 0
  });

  try {
    await fixture.economy.chooseRpgClass({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      characterClass: 'warrior'
    });
    const battle = await fixture.economy.playRpgBattle({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      difficulty: 'easy',
      skill: 'power_strike',
      now: 10_000
    });

    assert.equal(battle.battle.skillId, 'power_strike');
    assert.equal(battle.battle.skillMpCost, 8);
    assert.equal(battle.battle.attackBonus, 4);
    assert.equal(battle.battle.playerPower, 11);
    assert.equal(battle.profile.rpg.mp, 27);

    const ultimate = await fixture.economy.playRpgBattle({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      difficulty: 'easy',
      skill: 'blade_storm',
      now: 20_000
    });

    assert.equal(ultimate.battle.skillId, 'blade_storm');
    assert.equal(ultimate.battle.skillMpCost, 24);
    assert.equal(ultimate.battle.ultimate, true);
    assert.equal(ultimate.battle.attackBonus, 12);
    assert.equal(ultimate.profile.rpg.mp, 3);
  } finally {
    await fixture.cleanup();
  }
});

test('RPG 가챠는 고급 직업을 해금하고 해당 직업 선택을 허용한다', async () => {
  const fixture = await createFixture({
    dailyCoinReward: 1_000,
    dailyXpReward: 0,
    randomInt: (min) => min
  });

  try {
    const locked = await fixture.economy.chooseRpgClass({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      characterClass: 'paladin'
    }).catch((error) => error);
    await fixture.economy.claimDaily({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      now: 10_000
    });
    await fixture.economy.exchangeWallet({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      fromCurrency: 'main',
      toCurrency: 'rpg',
      amount: 1_000
    });
    const gacha = await fixture.economy.pullRpgGacha({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      bannerId: 'standard',
      count: 1
    });
    const selected = await fixture.economy.chooseRpgClass({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      characterClass: 'paladin'
    });

    assert.match(locked.message, /해금되지/);
    assert.equal(gacha.totalCost, 300);
    assert.equal(gacha.pulls[0].rarity, 'ssr');
    assert.equal(gacha.pulls[0].reward.type, 'class');
    assert.equal(gacha.pulls[0].reward.classId, 'paladin');
    assert.equal(gacha.profile.currencyBalances.rpg, 1_700);
    assert.equal(gacha.profile.rpg.unlockedClasses.includes('paladin'), true);
    assert.equal(selected.profile.rpg.characterClass, 'paladin');
  } finally {
    await fixture.cleanup();
  }
});

test('RPG 보스전과 휴식은 보스 처치 기록과 HP/MP 회복을 처리한다', async () => {
  const fixture = await createFixture({
    randomInt: createSequenceRandom([12, 14, 1]),
    rpgBattleCooldownMs: 0
  });

  try {
    await fixture.economy.chooseRpgClass({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      characterClass: 'warrior'
    });
    await fixture.economy.awardActivityXp({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      xp: 100
    });
    const boss = await fixture.economy.playRpgBossBattle({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      bossId: 'slime_king',
      now: 10_000
    });
    const rest = await fixture.economy.restRpg({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사'
    });

    assert.equal(boss.battle.win, true);
    assert.equal(boss.battle.bossId, 'slime_king');
    assert.equal(boss.xpGained, 220);
    assert.equal(boss.coinReward, 650);
    assert.equal(boss.profile.rpg.bossKills.slime_king, 1);
    assert.equal(boss.profile.rpg.hp < rest.profile.rpg.hp, true);
    assert.equal(rest.profile.rpg.hp, rest.derivedStats.maxHp);
    assert.equal(rest.profile.rpg.mp, rest.derivedStats.maxMp);
  } finally {
    await fixture.cleanup();
  }
});

test('RPG 퀘스트는 전투 진행도를 검사하고 보상을 지급한다', async () => {
  const fixture = await createFixture({
    randomInt: (min) => min,
    rpgBattleCooldownMs: 0
  });

  try {
    await fixture.economy.playRpgBattle({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      difficulty: 'easy',
      now: 10_000
    });
    const claimed = await fixture.economy.claimRpgQuest({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      questId: 'first_blood',
      now: 20_000
    });
    const duplicate = await fixture.economy.claimRpgQuest({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      questId: 'first_blood',
      now: 30_000
    }).catch((error) => error);

    assert.equal(claimed.rewards.xp, 40);
    assert.equal(claimed.rewards.coins, 120);
    assert.equal(claimed.profile.totalXp, 75);
    assert.equal(claimed.profile.currencyBalances.rpg, 200);
    assert.equal(claimed.profile.rpg.inventory.potion, 1);
    assert.equal(claimed.profile.rpg.claimedQuests.first_blood, 20_000);
    assert.match(duplicate.message, /이미 보상/);
  } finally {
    await fixture.cleanup();
  }
});

test('RPG 전투는 전적, 보상, 쿨다운을 한 번에 정산한다', async () => {
  const fixture = await createFixture({
    randomInt: (min) => min,
    rpgBattleCooldownMs: 60_000
  });

  try {
    const first = await fixture.economy.playRpgBattle({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      difficulty: 'easy',
      now: 100_000
    });
    const blocked = await fixture.economy.playRpgBattle({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      difficulty: 'easy',
      now: 101_000
    });
    const second = await fixture.economy.playRpgBattle({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      difficulty: 'hard',
      now: 200_000
    });

    assert.equal(first.battled, true);
    assert.equal(first.battle.win, true);
    assert.equal(first.xpGained, 35);
    assert.equal(first.coinReward, 80);
    assert.equal(first.profile.currencyBalances.rpg, 80);
    assert.equal(first.profile.rpg.battles, 1);
    assert.equal(first.profile.rpg.wins, 1);
    assert.equal(first.profile.rpg.losses, 0);
    assert.equal(first.profile.rpg.lastBattleAt, 100_000);
    assert.equal(first.profile.rpg.currentArea, 'forest');
    assert.equal(first.profile.rpg.discoveredMonsters['슬라임'], 1);

    assert.equal(blocked.battled, false);
    assert.equal(blocked.remainingMs, 59_000);
    assert.deepEqual(blocked.profile.rpg, first.profile.rpg);

    assert.equal(second.battled, true);
    assert.equal(second.battle.win, false);
    assert.equal(second.xpGained, 0);
    assert.equal(second.coinReward, 0);
    assert.equal(second.profile.rpg.battles, 2);
    assert.equal(second.profile.rpg.wins, 1);
    assert.equal(second.profile.rpg.losses, 1);
    assert.equal(second.profile.rpg.lastBattleAt, 200_000);
    assert.equal(second.profile.rpg.discoveredMonsters['슬라임'], 1);
    assert.equal(second.profile.rpg.discoveredMonsters['트롤'], 1);
  } finally {
    await fixture.cleanup();
  }
});

test('RPG 메뉴와 일일 의뢰는 다음 행동과 하루 진행 루프를 제공한다', async () => {
  const fixture = await createFixture({
    randomInt: (min) => min,
    rpgBattleCooldownMs: 0
  });

  try {
    const dayOne = 86_400_000;
    await fixture.economy.chooseRpgClass({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      characterClass: 'warrior',
      now: dayOne
    });
    const initialStatus = await fixture.economy.getRpgStatus({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      now: dayOne
    });

    assert.equal(initialStatus.adventureGuide.levelProgress.current, 0);
    assert.equal(initialStatus.adventureGuide.levelProgress.required, 100);
    assert.equal(initialStatus.adventureGuide.recommendedAction.type, 'battle');
    assert.equal(initialStatus.dailyMissions.length, 4);
    assert.deepEqual(initialStatus.profile.rpg.daily.claimedMissions, {});

    const battle = await fixture.economy.playRpgBattle({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      difficulty: 'easy',
      now: dayOne + 1_000
    });
    const afterBattleStatus = await fixture.economy.getRpgStatus({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      now: dayOne + 2_000
    });
    const victoryMission = afterBattleStatus.dailyMissions.find((mission) => mission.id === 'victory_contract');
    const trainingMission = afterBattleStatus.dailyMissions.find((mission) => mission.id === 'field_training');

    assert.equal(battle.profile.rpg.daily.battles, 1);
    assert.equal(battle.profile.rpg.daily.wins, 1);
    assert.equal(victoryMission.canClaim, true);
    assert.equal(trainingMission.current, 1);
    assert.equal(trainingMission.required, 2);
    assert.equal(afterBattleStatus.adventureGuide.recommendedAction.type, 'daily_claim');

    const claimed = await fixture.economy.claimRpgDailyMission({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      missionId: 'victory_contract',
      now: dayOne + 3_000
    });
    const duplicate = await fixture.economy.claimRpgDailyMission({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      missionId: 'victory_contract',
      now: dayOne + 4_000
    }).catch((error) => error);
    const nextDayStatus = await fixture.economy.getRpgStatus({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      now: dayOne * 2
    });
    const pureGuide = getRpgAdventureGuide(nextDayStatus.profile, {
      now: dayOne * 2,
      cooldownRemainingMs: 0,
      xpForNextLevel: fixture.economy.xpForNextLevel.bind(fixture.economy)
    });

    assert.equal(claimed.rewards.xp, 100);
    assert.equal(claimed.rewards.coins, 260);
    assert.equal(claimed.profile.rpg.daily.claimedMissions.victory_contract, dayOne + 3_000);
    assert.match(duplicate.message, /이미 완료/);
    assert.equal(nextDayStatus.profile.rpg.daily.battles, 0);
    assert.deepEqual(nextDayStatus.profile.rpg.daily.claimedMissions, {});
    assert.equal(nextDayStatus.dailyMissions.find((mission) => mission.id === 'victory_contract').canClaim, false);
    assert.equal(pureGuide.recommendedAction.type, 'quest_claim');
  } finally {
    await fixture.cleanup();
  }
});

test('RPG 허브 버튼, 지역 진행도, 직업 숙련, 수동 보스전이 게임 루프를 만든다', async () => {
  const fixture = await createFixture({
    randomInt: (_min, max) => max,
    rpgBattleCooldownMs: 0
  });

  try {
    await fixture.economy.chooseRpgClass({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      characterClass: 'warrior',
      now: 10_000
    });
    const menuInteraction = createRpgInteraction('메뉴');
    await handleRpgCommand(menuInteraction, fixture.economy);

    assert.match(menuInteraction.replies[0].embeds[0].data.title, /RPG 메인 허브/);
    assert.deepEqual(
      menuInteraction.replies[0].components
        .flatMap((row) => row.components)
        .map((button) => button.data.custom_id),
      [
        'rpg_quick:user-1:battle',
        'rpg_quick:user-1:explore',
        'rpg_quick:user-1:dungeon',
        'rpg_quick:user-1:raid',
        'rpg_quick:user-1:guild_raid',
        'rpg_quick:user-1:daily',
        'rpg_quick:user-1:quest',
        'rpg_quick:user-1:status',
        'rpg_quick:user-1:inventory',
        'rpg_quick:user-1:rest',
        'rpg_quick:user-1:equipment',
        'rpg_quick:user-1:gear',
        'rpg_quick:user-1:enhance',
        'rpg_quick:user-1:skill_tree',
        'rpg_quick:user-1:class_path',
        'rpg_quick:user-1:shop',
        'rpg_quick:user-1:area'
      ]
    );

    const battle = await fixture.economy.playRpgBattle({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      difficulty: 'easy',
      now: 11_000
    });
    const progressedStatus = await fixture.economy.getRpgStatus({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      now: 12_000
    });
    const forestProgress = progressedStatus.areaProgress.find((area) => area.id === 'forest');
    const berserkerPath = progressedStatus.classPaths.find((entry) => entry.id === 'berserker');

    assert.equal(battle.profile.rpg.classMastery.warrior.level >= 1, true);
    assert.equal(forestProgress.progress > 0, true);
    assert.equal(progressedStatus.classMastery.classId, 'warrior');
    assert.equal(berserkerPath.questReady, true);

    await fixture.economy.awardActivityXp({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      xp: 400
    });
    const advanced = await fixture.economy.advanceRpgClass({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      advancedClass: 'berserker'
    });

    assert.equal(advanced.profile.rpg.advancedClass, 'berserker');

    const encounter = await fixture.economy.startRpgBossEncounter({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      bossId: 'slime_king',
      now: 20_000
    });
    const firstTurn = await fixture.economy.playRpgBossTurn({
      guildId: 'guild-1',
      session: encounter.session,
      userId: 'user-1',
      action: 'guard',
      now: 21_000
    });
    const finishingSession = {
      ...firstTurn.session,
      boss: {
        ...firstTurn.session.boss,
        hp: 1
      }
    };
    const finished = await fixture.economy.playRpgBossTurn({
      guildId: 'guild-1',
      session: finishingSession,
      userId: 'user-1',
      action: 'power_strike',
      now: 22_000
    });

    assert.equal(encounter.session.type, 'boss_turn');
    assert.equal(firstTurn.completed, false);
    assert.equal(firstTurn.turn.action, 'guard');
    assert.equal(firstTurn.turn.bossDamage < encounter.session.boss.power, true);
    assert.equal(finished.completed, true);
    assert.equal(finished.battle.win, true);
    assert.equal(finished.profile.rpg.bossKills.slime_king, 1);
    assert.equal(finished.profile.rpg.areaProgress.forest >= forestProgress.progress, true);
  } finally {
    await fixture.cleanup();
  }
});

test('RPG 빠른 버튼은 주요 화면과 다음 행동을 명령어 없이 이어준다', async () => {
  const fixture = await createFixture({
    randomInt: (min) => min,
    rpgBattleCooldownMs: 0
  });

  try {
    await fixture.economy.chooseRpgClass({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      characterClass: 'warrior',
      now: 1_000
    });
    await seedRpgGold(fixture.store, 'guild-1', 'user-1', 1_000);
    await seedRpgGear(fixture.store, 'guild-1', 'user-1', {
      id: 'gear_button',
      baseItemId: 'iron_sword',
      slot: 'weapon',
      rarity: 'common',
      rarityLabel: '일반',
      label: '일반 철검',
      stats: { attack: 4 },
      power: 1,
      enhanceLevel: 0,
      assetId: 'item_iron_sword_icon',
      acquiredAt: 1_000
    });

    const statusButton = createRpgButtonInteraction('rpg_quick:user-1:status');
    await handleRpgCommand(statusButton, fixture.economy);
    const inventoryButton = createRpgButtonInteraction('rpg_quick:user-1:inventory');
    await handleRpgCommand(inventoryButton, fixture.economy);
    const enhanceButton = createRpgButtonInteraction('rpg_quick:user-1:enhance');
    await handleRpgCommand(enhanceButton, fixture.economy);
    const battleButton = createRpgButtonInteraction('rpg_quick:user-1:battle');
    await handleRpgCommand(battleButton, fixture.economy);

    assert.match(statusButton.updates[0].embeds[0].data.title, /RPG 상태/);
    assert.match(inventoryButton.updates[0].embeds[0].data.title, /RPG 인벤토리/);
    assert.match(enhanceButton.updates[0].embeds[0].data.title, /RPG 장비 강화/);
    assert.ok(
      enhanceButton.updates[0].components
        .flatMap((row) => row.components)
        .some((button) => button.data.custom_id === 'rpg_gear_enhance:user-1:gear_button')
    );
    assert.match(battleButton.updates[0].embeds[0].data.title, /RPG 전투/);
    assert.ok(
      battleButton.updates[0].components
        .flatMap((row) => row.components)
        .map((button) => button.data.custom_id)
        .includes('rpg_quick:user-1:menu')
    );
  } finally {
    await fixture.cleanup();
  }
});

test('RPG 상점은 메뉴 버튼과 구매 버튼으로 장비를 사고 포션은 보관한다', async () => {
  const fixture = await createFixture({
    randomInt: (min) => min,
    rpgBattleCooldownMs: 0
  });

  try {
    await fixture.economy.chooseRpgClass({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      characterClass: 'warrior',
      now: 1_000
    });
    await seedRpgGold(fixture.store, 'guild-1', 'user-1', 1_000);
    const beforeShop = await fixture.economy.getRpgStatus({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사'
    });
    const initialPotionCount = beforeShop.profile.rpg.inventory.potion ?? 0;

    const menu = createRpgInteraction('메뉴');
    await handleRpgCommand(menu, fixture.economy);
    assert.ok(getComponentCustomIds(menu.replies[0]).includes('rpg_quick:user-1:shop'));

    const shop = createRpgButtonInteraction('rpg_quick:user-1:shop');
    await handleRpgCommand(shop, fixture.economy);
    assert.match(shop.updates[0].embeds[0].data.title, /RPG 상점/);
    assert.ok(getComponentCustomIds(shop.updates[0]).includes('rpg_shop_buy:user-1:potion:1'));
    assert.ok(getComponentCustomIds(shop.updates[0]).includes('rpg_shop_buy:user-1:iron_sword:1'));

    const potionPurchase = createRpgButtonInteraction('rpg_shop_buy:user-1:potion:1');
    await handleRpgCommand(potionPurchase, fixture.economy);
    assert.match(potionPurchase.updates[0].embeds[0].data.title, /구매 완료/);
    assert.ok(getComponentCustomIds(potionPurchase.updates[0]).includes('rpg_quick:user-1:inventory'));
    assert.equal(getComponentCustomIds(potionPurchase.updates[0]).includes('rpg_item_use:user-1:potion'), false);

    const afterPotion = await fixture.economy.getRpgStatus({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사'
    });
    assert.equal(afterPotion.profile.rpg.inventory.potion, initialPotionCount + 1);
    assert.equal(afterPotion.profile.wallets.rpgGold, 880);

    const swordPurchase = createRpgButtonInteraction('rpg_shop_buy:user-1:iron_sword:1');
    await handleRpgCommand(swordPurchase, fixture.economy);
    assert.ok(getComponentCustomIds(swordPurchase.updates[0]).includes('rpg_item_equip:user-1:iron_sword'));
  } finally {
    await fixture.cleanup();
  }
});

test('RPG 길드레이드는 서버 파티원을 모아 보상과 지원 보상을 정산한다', async () => {
  const fixture = await createFixture({
    randomInt: (min) => min,
    rpgBattleCooldownMs: 0
  });

  try {
    await fixture.economy.chooseRpgClass({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      characterClass: 'warrior',
      now: 1_000
    });
    await fixture.economy.chooseRpgClass({
      guildId: 'guild-1',
      userId: 'user-2',
      username: '마법사',
      characterClass: 'mage',
      now: 1_000
    });
    await fixture.economy.chooseRpgClass({
      guildId: 'guild-1',
      userId: 'user-3',
      username: '궁수',
      characterClass: 'ranger',
      now: 1_000
    });
    await fixture.economy.awardActivityXp({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      xp: 400
    });

    const result = await fixture.economy.playRpgGuildRaid({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      raidId: 'slime_horde',
      skill: 'blade_storm',
      now: 10_000
    });
    const supportProfile = await fixture.economy.getProfile('guild-1', 'user-2', '마법사');
    const interaction = createRpgInteraction('길드레이드', {
      stringOptions: { 레이드: 'slime_horde', 스킬: 'blade_storm' }
    });
    await handleRpgCommand(interaction, fixture.economy);

    assert.equal(result.battle.type, 'guild_raid');
    assert.equal(result.battle.partySize, 3);
    assert.equal(result.battle.win, true);
    assert.equal(result.supportRewards.length, 2);
    assert.equal(result.profile.currencyBalances.rpg, 1_100);
    assert.equal(supportProfile.currencyBalances.rpg, 275);
    assert.match(interaction.replies[0].embeds[0].data.title, /길드 레이드/);
  } finally {
    await fixture.cleanup();
  }
});

test('RPG 보스 턴 판정은 공격, 방어, 포션 행동을 구분한다', () => {
  const attack = resolveRpgBossTurn({
    player: {
      hp: 70,
      maxHp: 100,
      mp: 30,
      maxMp: 40,
      level: 3,
      characterClass: 'warrior',
      characterGender: 'female',
      stats: { attack: 10, defense: 2 },
      inventory: { potion: 1 },
      availableSkillIds: ['basic', 'power_strike', 'blade_storm']
    },
    boss: {
      hp: 30,
      maxHp: 30,
      power: 12
    },
    action: 'power_strike',
    bossId: 'slime_king',
    turnNumber: 2,
    randomInt: () => 20
  });
  const guard = resolveRpgBossTurn({
    player: {
      hp: 70,
      maxHp: 100,
      mp: 30,
      maxMp: 40,
      level: 3,
      characterClass: 'warrior',
      characterGender: 'female',
      stats: { attack: 10, defense: 2 },
      inventory: { potion: 1 },
      availableSkillIds: ['basic', 'power_strike']
    },
    boss: {
      hp: 30,
      maxHp: 30,
      power: 12
    },
    action: 'guard',
    randomInt: () => 20
  });
  const potion = resolveRpgBossTurn({
    player: {
      hp: 50,
      maxHp: 100,
      mp: 30,
      maxMp: 40,
      level: 3,
      characterClass: 'warrior',
      characterGender: 'female',
      stats: { attack: 10, defense: 2 },
      inventory: { potion: 1 },
      availableSkillIds: ['basic', 'power_strike']
    },
    boss: {
      hp: 30,
      maxHp: 30,
      power: 12
    },
    action: 'potion',
    randomInt: () => 20
  });

  assert.equal(attack.skillId, 'power_strike');
  assert.equal(attack.mpCost, 8);
  assert.equal(attack.bossHpAfter < 30, true);
  assert.equal(attack.bossPattern.id, 'royal_slam');
  assert.equal(attack.bossPattern.damageMultiplier > 1, true);
  assert.equal(guard.action, 'guard');
  assert.equal(guard.playerDamage, 0);
  assert.equal(guard.bossDamage < attack.bossDamage, true);
  assert.equal(potion.action, 'potion');
  assert.equal(potion.healed, 40);
  assert.equal(potion.consumedItemId, 'potion');

  const ultimate = resolveRpgBossTurn({
    player: {
      hp: 70,
      maxHp: 100,
      mp: 40,
      maxMp: 40,
      level: 3,
      characterClass: 'warrior',
      characterGender: 'female',
      stats: { attack: 10, defense: 2 },
      inventory: { potion: 1 },
      availableSkillIds: ['basic', 'power_strike', 'blade_storm']
    },
    boss: {
      hp: 30,
      maxHp: 30,
      power: 12
    },
    action: 'blade_storm',
    bossId: 'slime_king',
    turnNumber: 3,
    randomInt: () => 20
  });

  assert.equal(ultimate.skillId, 'blade_storm');
  assert.equal(ultimate.ultimate, true);
  assert.equal(ultimate.playerDamage > attack.playerDamage, true);
});

test('기존 프로필에 RPG 상태가 없어도 기본값을 채운다', async () => {
  const fixture = await createFixture();

  try {
    await fixture.store.update((data) => {
      data.guilds['guild-1'] = {
        users: {
          'user-1': {
            userId: 'user-1',
            username: '기존유저',
            level: 2,
            xp: 0,
            totalXp: 100,
            balance: 50,
            lastMessageRewardAt: 0,
            lastDailyAt: 0,
            lastDailyDay: null,
            dailyStreak: 0,
            lastFirstMessageBonusDay: null,
            createdAt: 1
          }
        }
      };
    });

    const status = await fixture.economy.getRpgStatus({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '기존유저'
    });

    assert.equal(status.profile.rpg.characterClass, 'novice');
    assert.equal(status.profile.rpg.characterGender, 'male');
    assert.equal(status.heroAssetId, 'hero_adventurer_idle');
    assert.equal(status.profile.rpg.currentArea, 'forest');
    assert.deepEqual(status.profile.rpg.unlockedAreas, ['forest', 'cave']);
    assert.deepEqual(status.profile.rpg.discoveredMonsters, {});
    assert.equal(status.profile.rpg.battles, 0);
    assert.equal(status.profile.rpg.wins, 0);
    assert.equal(status.profile.rpg.losses, 0);
    assert.equal(status.profile.rpg.lastBattleAt, 0);
    assert.equal(status.cooldownRemainingMs, 0);
  } finally {
    await fixture.cleanup();
  }
});

async function createFixture(options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'heeheebot-rpg-'));
  const store = createSqliteStore(join(directory, 'profiles.sqlite'));
  const economy = new EconomyService(store, options);

  return {
    economy,
    store,
    async cleanup() {
      store.close();
      await rm(directory, {
        recursive: true,
        force: true
      });
    }
  };
}

function createRpgInteraction(subcommand, {
  stringOptions = {},
  integerOptions = {}
} = {}) {
  const replies = [];

  return {
    guildId: 'guild-1',
    channelId: 'channel-1',
    commandName: 'rpg',
    user: {
      id: 'user-1',
      username: '용사',
      bot: false
    },
    replies,
    isButton() {
      return false;
    },
    isChatInputCommand() {
      return true;
    },
    inGuild() {
      return true;
    },
    options: {
      getSubcommand() {
        return subcommand;
      },
      getString(name) {
        return stringOptions[name] ?? null;
      },
      getInteger(name) {
        return integerOptions[name] ?? null;
      },
      getUser() {
        return null;
      }
    },
    async reply(payload) {
      replies.push(payload);
    }
  };
}

function createRpgButtonInteraction(customId) {
  const replies = [];
  const updates = [];

  return {
    guildId: 'guild-1',
    channelId: 'channel-1',
    customId,
    user: {
      id: 'user-1',
      username: '용사',
      bot: false
    },
    replies,
    updates,
    isButton() {
      return true;
    },
    isChatInputCommand() {
      return false;
    },
    inGuild() {
      return true;
    },
    async reply(payload) {
      replies.push(payload);
    },
    async update(payload) {
      updates.push(payload);
    }
  };
}

function getComponentCustomIds(payload) {
  return (payload.components ?? [])
    .flatMap((row) => row.components ?? [])
    .map((component) => component.data.custom_id)
    .filter(Boolean);
}

async function seedRpgGold(store, guildId, userId, amount) {
  await store.update((data) => {
    const profile = data.guilds[guildId].users[userId];
    profile.wallets ??= {};
    profile.wallets.rpgGold = amount;
  });
}

async function seedRpgGear(store, guildId, userId, gear) {
  await store.update((data) => {
    const profile = data.guilds[guildId].users[userId];
    profile.rpg.gearInventory[gear.id] = gear;
  });
}

function createSequenceRandom(values) {
  let index = 0;

  return (min, max) => {
    if (index >= values.length) return min;
    const value = values[index];
    index += 1;
    return Math.min(max, Math.max(min, value));
  };
}
