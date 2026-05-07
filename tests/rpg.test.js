import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createSqliteStore } from '../src/storage/sqlite-store.js';
import { getRpgCommandPayloads, handleRpgCommand } from '../src/commands/rpg.js';
import { EconomyService } from '../src/systems/economy.js';
import {
  getRpgAreaConfig,
  getRpgAreaOptions,
  getRpgAdventureGuide,
  getAvailableRpgSkillIds,
  getRpgHeroAssetId,
  getRpgRaidConfig,
  getRpgRaidOptions,
  getRpgSkillConfig,
  getUnlockedRpgAreaIds,
  normalizeRpgArea,
  normalizeRpgDifficulty,
  normalizeRpgGender,
  resolveRpgBattle,
  resolveRpgRaidBattle,
  resolveRpgBossTurn,
  resolveRpgPvpTurn
} from '../src/systems/rpg.js';

test('RPG 명령 payload는 전투와 상태 subcommand를 등록한다', () => {
  const [command] = getRpgCommandPayloads();

  assert.equal(command.name, 'rpg');
  assert.deepEqual(command.options.map((option) => option.name), [
    '시작',
    '메뉴',
    '튜토리얼',
    '전투',
    '대결',
    '탐험',
    '던전',
    '보스',
    '상태',
    '상점',
    '인벤토리',
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
  const tutorialCommand = command.options.find((option) => option.name === '튜토리얼');
  assert.equal(tutorialCommand.options[0].name, '보상');
  assert.equal(tutorialCommand.options[0].required, false);
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
  assert.ok(guildRaidCommand.options[0].choices.length >= 12);
  assert.ok(guildRaidCommand.options[0].choices.some((choice) => choice.name.includes('종말의 용')));
  const shopCommand = command.options.find((option) => option.name === '상점');
  assert.equal(shopCommand.options[0].choices.some((choice) => choice.name === '강화석'), false);
});

test('RPG 사냥터는 초중후반 구간에 넉넉하게 배치된다', () => {
  const options = getRpgAreaOptions();
  const labels = options.map((option) => option.name);

  assert.ok(options.length >= 18);
  assert.ok(options.length <= 25);
  assert.ok(labels.some((name) => name.includes('들꽃 평원')));
  assert.ok(labels.some((name) => name.includes('붉은 사막')));
  assert.ok(labels.some((name) => name.includes('공허 관문')));

  assert.equal(normalizeRpgArea('들꽃평원'), 'wildflower_plains');
  assert.equal(normalizeRpgArea('사막'), 'red_desert');
  assert.equal(normalizeRpgArea('공허'), 'void_gate');

  assert.equal(getRpgAreaConfig('wildflower_plains').unlockLevel, 1);
  assert.equal(getRpgAreaConfig('red_desert').unlockLevel, 5);
  assert.equal(getRpgAreaConfig('void_gate').unlockLevel, 16);
  assert.deepEqual(getUnlockedRpgAreaIds(16).slice(-1), ['void_gate']);
});

test('RPG 레이드는 12단계 이상으로 확장되고 고단계 전용 에셋을 연결한다', () => {
  const raids = getRpgRaidOptions();
  const finalRaid = getRpgRaidConfig('종말의 용');
  const battle = resolveRpgRaidBattle({
    playerLevel: finalRaid.unlockLevel,
    raidId: 'apocalypse_dragon',
    characterClass: 'paladin',
    skillId: 'holy_smite',
    randomInt: (_min, max) => max
  });

  assert.ok(raids.length >= 12);
  assert.deepEqual(raids.slice(0, 3).map((raid) => raid.value), [
    'slime_horde',
    'goblin_warband',
    'crystal_hydra'
  ]);
  assert.equal(raids.at(-1).value, 'apocalypse_dragon');
  assert.equal(finalRaid.unlockLevel >= 30, true);
  assert.equal(battle.raidLabel, '종말의 용');
  assert.equal(battle.monster, '종말의 용');
  assert.equal(battle.assets.monster, 'boss_apocalypse_dragon_idle');
  assert.equal(battle.assets.background, 'map_eclipse_throne');
  assert.equal(battle.rewards.xp, finalRaid.xpReward);
});

test('RPG 전직 영웅 에셋은 성별과 기본직업이 맞을 때만 적용된다', () => {
  assert.equal(
    getRpgHeroAssetId({
      characterClass: 'warrior',
      characterGender: 'female',
      advancedClass: 'berserker'
    }),
    'hero_female_berserker_idle'
  );
  assert.equal(
    getRpgHeroAssetId({
      characterClass: 'mage',
      characterGender: 'female',
      advancedClass: 'berserker'
    }),
    'hero_female_mage_idle'
  );
  assert.equal(
    getRpgHeroAssetId({
      characterClass: 'warrior',
      characterGender: 'male',
      advancedClass: '깨진전직'
    }),
    'hero_warrior_idle'
  );
});

test('RPG 전직별 고유 스킬은 해당 전직에게만 열린다', () => {
  assert.equal(getRpgSkillConfig('berserker_rage').label, '광전사의 피의 광폭화');
  assert.deepEqual(
    getAvailableRpgSkillIds('warrior').includes('berserker_rage'),
    false
  );
  assert.deepEqual(
    getAvailableRpgSkillIds('warrior', 'berserker').includes('berserker_rage'),
    true
  );
  assert.deepEqual(
    getAvailableRpgSkillIds('warrior', 'archmage').includes('berserker_rage'),
    false
  );
  assert.deepEqual(
    getAvailableRpgSkillIds('mage', 'archmage').includes('archmage_arcana'),
    true
  );
  assert.deepEqual(
    getAvailableRpgSkillIds('priest', 'saint').includes('saint_blessing'),
    true
  );
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
    const advancedStatus = await fixture.economy.getRpgStatus({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      now: 1_500
    });
    const advancedSkillBattle = await fixture.economy.playRpgBattle({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      difficulty: 'easy',
      area: 'forest',
      skill: 'berserker_rage',
      now: 1_800
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
      gearId: dungeon.gearDrop.id
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
    assert.equal(advanced.heroAssetId, 'hero_female_berserker_idle');
    assert.equal(advancedStatus.heroAssetId, 'hero_female_berserker_idle');
    assert.ok(advancedStatus.availableSkillIds.includes('berserker_rage'));
    assert.equal(advancedSkillBattle.battle.skillLabel, '광전사의 피의 광폭화');
    assert.equal(explored.profile.rpg.explores, 1);
    assert.equal(dungeon.depth, 1);
    assert.ok(dungeon.gearDrop);
    assert.equal(dungeon.profile.rpg.dungeonClears.forest, 1);
    assert.equal(equippedGear.profile.rpg.equippedGear[dungeon.gearDrop.slot], dungeon.gearDrop.id);
    assert.equal(story.profile.rpg.storyChapters.forest_oath, 5_000);
    assert.equal(codex.profile.rpg.codexClaims[battle.battle.monster], 6_000);
    assert.equal(battle.battle.assets.hero, 'hero_female_berserker_idle');
    assert.equal(raid.battle.difficulty, 'raid');
    assert.equal(raid.battle.assets.hero, 'hero_female_berserker_idle');
    assert.equal(raid.profile.rpg.raidClears.slime_horde, 1);
  } finally {
    await fixture.cleanup();
  }
});

test('RPG 튜토리얼은 신규 유저를 첫 전투와 보상 수령까지 안내한다', async () => {
  const fixture = await createFixture({
    rpgBattleCooldownMs: 0,
    rpgRestCooldownMs: 0,
    randomInt: (_min, max) => max
  });

  try {
    const beforeStart = createRpgInteraction('튜토리얼');
    await handleRpgCommand(beforeStart, fixture.economy);

    assertRpgEmbedCard(beforeStart.replies[0], /RPG 초보자 여정/);
    assert.match(getReplyText(beforeStart.replies[0]), /캐릭터 만들기/);
    assert.ok(getSelectValues(beforeStart.replies[0], 'rpg_select:user-1:start').includes('warrior|female'));

    const startSelect = createRpgSelectInteraction('rpg_select:user-1:start', ['warrior|female']);
    await handleRpgCommand(startSelect, fixture.economy);

    assertRpgEmbedCard(startSelect.updates[0], /모험가 등록 완료/);
    assert.ok(getComponentCustomIds(startSelect.updates[0]).includes('rpg_quick:user-1:tutorial'));
    assert.ok(getComponentCustomIds(startSelect.updates[0]).includes('rpg_quick:user-1:battle'));

    const afterStart = createRpgInteraction('튜토리얼');
    await handleRpgCommand(afterStart, fixture.economy);

    assert.match(getReplyText(afterStart.replies[0]), /다음 목표[\s\S]*첫 전투/);
    assert.ok(getSelectValues(afterStart.replies[0], 'rpg_select:user-1:tutorial').includes('create_character'));

    const claimStart = createRpgSelectInteraction('rpg_select:user-1:tutorial', ['create_character']);
    await handleRpgCommand(claimStart, fixture.economy);

    assertRpgEmbedCard(claimStart.updates[0], /튜토리얼 보상/);
    assert.match(getReplyText(claimStart.updates[0]), /캐릭터 만들기/);

    const battleButton = createRpgButtonInteraction('rpg_quick:user-1:battle');
    await handleRpgCommand(battleButton, fixture.economy);

    assertRpgEmbedCard(battleButton.updates[0], /RPG 전투 결과/);

    const afterBattle = createRpgInteraction('튜토리얼');
    await handleRpgCommand(afterBattle, fixture.economy);

    assert.ok(getSelectValues(afterBattle.replies[0], 'rpg_select:user-1:tutorial').includes('first_battle'));

    const claimBattle = createRpgSelectInteraction('rpg_select:user-1:tutorial', ['first_battle']);
    await handleRpgCommand(claimBattle, fixture.economy);

    assertRpgEmbedCard(claimBattle.updates[0], /튜토리얼 보상/);
    assert.match(getReplyText(claimBattle.updates[0]), /첫 전투/);

    const profile = await fixture.economy.getProfile('guild-1', 'user-1', '용사');
    assert.equal(profile.rpg.tutorial.claimedSteps.create_character > 0, true);
    assert.equal(profile.rpg.tutorial.claimedSteps.first_battle > 0, true);
    assert.equal(profile.rpg.inventory.potion >= 3, true);
    assert.equal(profile.totalXp > 0, true);
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
  const fireball = resolveRpgBattle({
    playerLevel: 1,
    characterClass: 'mage',
    skillId: 'fireball',
    randomInt: (min) => min
  });
  assert.equal(fireball.statusEffect.label, '화상');
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
      const challenger = data.guilds['guild-1'].users['user-1'];
      const opponent = data.guilds['guild-1'].users['user-2'];
      challenger.rpg.hp = 40;
      challenger.rpg.mp = 10;
      challenger.rpg.inventory.potion = 1;
      opponent.rpg.hp = 8;
      opponent.rpg.mp = 9;
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
    const finishingSession = {
      ...started.session,
      fighters: {
        ...started.session.fighters,
        opponent: {
          ...started.session.fighters.opponent,
          hp: 8
        }
      }
    };
    const finished = await fixture.economy.playRpgPvpTurn({
      guildId: 'guild-1',
      session: finishingSession,
      actorUserId: 'user-1',
      skillId: 'power_strike',
      now: 11_000
    });

    assert.equal(started.started, true);
    assert.equal(started.session.turnSide, 'challenger');
    assert.equal(started.session.fighters.challenger.hp, started.session.fighters.challenger.maxHp);
    assert.equal(started.session.fighters.challenger.mp, started.session.fighters.challenger.maxMp);
    assert.equal(started.session.fighters.opponent.hp, started.session.fighters.opponent.maxHp);
    assert.equal(started.session.fighters.opponent.mp, started.session.fighters.opponent.maxMp);
    assert.equal(started.challenger.rpg.hp, 40);
    assert.equal(started.challenger.rpg.mp, 10);
    assert.equal(started.opponent.rpg.hp, 8);
    assert.equal(started.opponent.rpg.mp, 9);
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
    assert.equal(finished.challenger.rpg.hp, 40);
    assert.equal(finished.challenger.rpg.mp, 10);
    assert.equal(finished.challenger.rpg.inventory.potion, 1);
    assert.equal(finished.challenger.rpg.battles, 1);
    assert.equal(finished.challenger.rpg.wins, 1);
    assert.equal(finished.challenger.rpg.pvpBattles, 1);
    assert.equal(finished.challenger.rpg.pvpWins, 1);
    assert.equal(finished.opponent.rpg.battles, 1);
    assert.equal(finished.opponent.rpg.losses, 1);
    assert.equal(finished.opponent.rpg.pvpBattles, 1);
    assert.equal(finished.opponent.rpg.pvpLosses, 1);
    assert.equal(finished.opponent.rpg.hp, 8);
    assert.equal(finished.opponent.rpg.mp, 9);
  } finally {
    await fixture.cleanup();
  }
});

test('RPG PvP 신청과 턴 진행도 embed 카드로 표시된다', async () => {
  const fixture = await createFixture({
    randomInt: () => 20,
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

    const target = {
      id: 'user-2',
      username: '마법사',
      bot: false,
      toString() {
        return '<@user-2>';
      }
    };
    const challenge = createRpgInteraction('대결', {
      userOptions: { 상대: target }
    });
    await handleRpgCommand(challenge, fixture.economy);
    assertRpgEmbedCard(challenge.replies[0], /RPG PvP 대결 신청/);

    const acceptId = getComponentCustomIds(challenge.replies[0])
      .find((customId) => customId.startsWith('rpg_pvp_accept:'));
    const accept = createRpgButtonInteraction(acceptId, {
      user: { id: 'user-2', username: '마법사', bot: false }
    });
    await handleRpgCommand(accept, fixture.economy);
    assertRpgEmbedCard(accept.updates[0], /RPG 턴제 PvP/);

    const powerStrikeId = getComponentCustomIds(accept.updates[0])
      .find((customId) => customId.endsWith(':power_strike'));
    const attack = createRpgButtonInteraction(powerStrikeId);
    await handleRpgCommand(attack, fixture.economy);
    assertRpgEmbedCard(attack.updates[0], /RPG 턴제 PvP/);
    assert.match(getReplyText(attack.updates[0]), /최근 행동/);
  } finally {
    await fixture.cleanup();
  }
});

test('RPG PvP 턴 보드는 상태를 크게 보여주고 중간 포션 사용을 지원한다', async () => {
  const fixture = await createFixture({
    randomInt: () => 1,
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
    await fixture.economy.chooseRpgClass({
      guildId: 'guild-1',
      userId: 'user-2',
      username: '마법사',
      characterClass: 'mage',
      characterGender: 'male',
      now: 1_000
    });
    await fixture.store.update((data) => {
      const challenger = data.guilds['guild-1'].users['user-1'];
      challenger.rpg.hp = 40;
      challenger.rpg.inventory.potion = 1;
    });

    const target = {
      id: 'user-2',
      username: '마법사',
      bot: false,
      toString() {
        return '<@user-2>';
      }
    };
    const challenge = createRpgInteraction('대결', {
      userOptions: { 상대: target }
    });
    await handleRpgCommand(challenge, fixture.economy);
    const acceptId = getComponentCustomIds(challenge.replies[0])
      .find((customId) => customId.startsWith('rpg_pvp_accept:'));
    const accept = createRpgButtonInteraction(acceptId, {
      user: { id: 'user-2', username: '마법사', bot: false }
    });
    await handleRpgCommand(accept, fixture.economy);

    const boardText = getReplyText(accept.updates[0]);
    assert.match(boardText, /전장 상태/);
    assert.match(boardText, /내 상태|신청자/);
    assert.match(boardText, /HP .*▰/);
    assert.match(boardText, /HP .*110\/110/);
    assert.match(boardText, /MP .*▰/);
    assert.match(boardText, /포션 \*\*1개\*\*/);

    const firstAttackId = getComponentCustomIds(accept.updates[0])
      .find((customId) => customId.endsWith(':basic'));
    const firstAttack = createRpgButtonInteraction(firstAttackId);
    await handleRpgCommand(firstAttack, fixture.economy);

    const counterAttackId = getComponentCustomIds(firstAttack.updates[0])
      .find((customId) => customId.endsWith(':basic'));
    const counterAttack = createRpgButtonInteraction(counterAttackId, {
      user: { id: 'user-2', username: '마법사', bot: false }
    });
    await handleRpgCommand(counterAttack, fixture.economy);

    const potionId = getComponentCustomIds(counterAttack.updates[0])
      .find((customId) => customId.endsWith(':potion'));
    assert.ok(potionId);

    const potion = createRpgButtonInteraction(potionId);
    await handleRpgCommand(potion, fixture.economy);

    const potionText = getReplyText(potion.updates[0]);
    assert.match(potionText, /회복 포션/);
    assert.match(potionText, /HP \+\d+/);
    assert.match(potionText, /포션 \*\*0개\*\*/);
    assert.match(potionText, /현재 차례.*마법사/);

    const statusAfterPvpPotion = await fixture.economy.getRpgStatus({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사'
    });
    assert.equal(statusAfterPvpPotion.profile.rpg.hp, 40);
    assert.equal(statusAfterPvpPotion.profile.rpg.inventory.potion, 1);
  } finally {
    await fixture.cleanup();
  }
});

test('RPG 보스전 카드는 내 상태와 보스 상태, 포션 잔량을 눈에 띄게 보여준다', async () => {
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
      const profile = data.guilds['guild-1'].users['user-1'];
      profile.rpg.hp = 55;
      profile.rpg.inventory.potion = 1;
    });

    const boss = createRpgInteraction('보스', {
      stringOptions: { 보스: 'slime_king' }
    });
    await handleRpgCommand(boss, fixture.economy);

    const bossText = getReplyText(boss.replies[0]);
    assertRpgEmbedCard(boss.replies[0], /수동 보스전 시작/);
    assert.match(bossText, /내 상태/);
    assert.match(bossText, /보스 상태/);
    assert.match(bossText, /HP .*▰/);
    assert.match(bossText, /포션 \*\*1개\*\*/);
    assert.ok(getComponentCustomIds(boss.replies[0]).some((customId) => customId.endsWith(':potion')));
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
    assert.equal(purchase.profile.currencyBalances.rpg, 500);
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

test('RPG 장비강화는 전리품 스탯과 골드를 갱신하고 명령 버튼 표면에 연결된다', async () => {
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

test('RPG 전리품 분해와 강화석 보조 강화는 장비 성장 루프를 만든다', async () => {
  const fixture = await createFixture({
    randomInt: (min) => min
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
      id: 'gear_dust',
      baseItemId: 'iron_sword',
      slot: 'weapon',
      rarity: 'rare',
      rarityLabel: '희귀',
      label: '희귀 철검',
      stats: { attack: 5 },
      power: 2,
      enhanceLevel: 2,
      assetId: 'item_iron_sword_icon',
      acquiredAt: 1_000
    });
    await seedRpgGear(fixture.store, 'guild-1', 'user-1', {
      id: 'gear_enhance',
      baseItemId: 'iron_sword',
      slot: 'weapon',
      rarity: 'common',
      rarityLabel: '일반',
      label: '일반 철검',
      stats: { attack: 4 },
      power: 1,
      enhanceLevel: 0,
      assetId: 'item_iron_sword_icon',
      acquiredAt: 2_000
    });

    const disassembled = await fixture.economy.disassembleRpgGear({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      gearId: 'gear_dust',
      now: 3_000
    });
    const enhanced = await fixture.economy.enhanceRpgGear({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      gearId: 'gear_enhance',
      now: 4_000
    });
    const gearView = createRpgButtonInteraction('rpg_quick:user-1:gear');
    await handleRpgCommand(gearView, fixture.economy);

    assert.equal(disassembled.rewards.enhancementStones, 3);
    assert.equal(disassembled.rewards.coins, 200);
    assert.equal(disassembled.profile.rpg.gearInventory.gear_dust, undefined);
    assert.equal(disassembled.profile.rpg.inventory.enhancement_stone, 3);
    assert.equal(enhanced.materialUsed, true);
    assert.equal(enhanced.baseCost, 120);
    assert.equal(enhanced.cost, 96);
    assert.equal(enhanced.successRate, 98);
    assert.equal(enhanced.profile.rpg.inventory.enhancement_stone, 2);
    assert.equal(enhanced.profile.currencyBalances.rpg, 1_104);
    assert.ok(getComponentCustomIds(gearView.updates[0]).includes('rpg_select:user-1:gear_disassemble'));
    assert.ok(getSelectValues(gearView.updates[0], 'rpg_select:user-1:gear_disassemble').includes('gear_enhance'));
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
    assert.equal(battle.profile.rpg.ultimateCharge, 35);

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
    assert.equal(ultimate.ultimateCharge.after, 70);
    assert.equal(ultimate.profile.rpg.ultimateCharge, 70);
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
    assert.equal(gacha.profile.currencyBalances.rpg, 700);
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

test('RPG 탐험은 반복 쿨다운으로 무제한 골드 파밍을 막는다', async () => {
  const fixture = await createFixture({
    randomInt: (_min, max) => max,
    rpgExploreCooldownMs: 60_000
  });

  try {
    const first = await fixture.economy.exploreRpg({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      now: 10_000
    });
    const blocked = await fixture.economy.exploreRpg({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      now: 20_000
    }).catch((error) => error);
    const afterCooldown = await fixture.economy.exploreRpg({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      now: 70_000
    });

    assert.equal(first.profile.rpg.lastExploreAt, 10_000);
    assert.match(blocked.message, /탐험.*남은 시간/);
    assert.equal(afterCooldown.profile.rpg.explores, 2);
  } finally {
    await fixture.cleanup();
  }
});

test('RPG 반복 골드와 RPG 레벨 보상은 일일 상한을 넘지 않는다', async () => {
  const fixture = await createFixture({
    randomInt: (_min, max) => max,
    rpgExploreCooldownMs: 0,
    rpgDailyGoldCap: 100
  });

  try {
    const first = await fixture.economy.exploreRpg({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      now: 10_000
    });
    const second = await fixture.economy.exploreRpg({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      now: 20_000
    });

    assert.equal(first.requestedCoinReward, 160);
    assert.equal(first.coinReward, 100);
    assert.equal(first.rpgGoldLimit.capped, true);
    assert.equal(first.profile.balance, 100);
    assert.equal(first.profile.rpg.daily.goldEarned, 100);

    assert.equal(second.coinReward, 0);
    assert.equal(second.levelRewardRequested, 200);
    assert.equal(second.levelReward, 0);
    assert.equal(second.levelRewardCapped, true);
    assert.equal(second.profile.balance, 100);
    assert.equal(second.profile.rpg.daily.goldEarned, 100);
  } finally {
    await fixture.cleanup();
  }
});

test('RPG 보스 쿨다운은 일반 전투를 막지 않는다', async () => {
  const fixture = await createFixture({
    randomInt: (min) => min,
    rpgBattleCooldownMs: 0,
    rpgBossCooldownMs: 60_000
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
    const battle = await fixture.economy.playRpgBattle({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      difficulty: 'easy',
      now: 20_000
    });

    assert.equal(boss.profile.rpg.lastBossAt, 10_000);
    assert.equal(battle.battled, true);
    assert.equal(battle.profile.rpg.battles, 2);
  } finally {
    await fixture.cleanup();
  }
});

test('RPG 상태는 행동별 쿨다운과 일일 반복 골드 상한을 한 번에 보여준다', async () => {
  const fixture = await createFixture({
    rpgBattleCooldownMs: 60_000,
    rpgExploreCooldownMs: 120_000,
    rpgDungeonCooldownMs: 0,
    rpgDailyGoldCap: 300
  });

  try {
    await fixture.economy.chooseRpgClass({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      characterClass: 'warrior'
    });
    await fixture.store.update((data) => {
      const profile = data.guilds['guild-1'].users['user-1'];
      profile.rpg.lastBattleAt = 10_000;
      profile.rpg.lastExploreAt = 15_000;
      profile.rpg.daily = {
        day: 0,
        battles: 0,
        wins: 0,
        explores: 0,
        dungeons: 0,
        bosses: 0,
        raids: 0,
        pvpWins: 0,
        goldEarned: 240,
        claimedMissions: {}
      };
    });

    const status = await fixture.economy.getRpgStatus({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      now: 20_000
    });

    assert.equal(status.dailyGold.cap, 300);
    assert.equal(status.dailyGold.earned, 240);
    assert.equal(status.dailyGold.remaining, 60);
    assert.equal(status.actionAvailability.battle.available, false);
    assert.equal(status.actionAvailability.battle.cooldownRemainingMs, 50_000);
    assert.equal(status.actionAvailability.explore.available, false);
    assert.equal(status.actionAvailability.explore.cooldownRemainingMs, 115_000);
    assert.equal(status.actionAvailability.dungeon.available, true);
    assert.equal(status.actionAvailability.boss.available, false);
    assert.equal(status.actionAvailability.boss.levelBlocked, true);
    assert.match(status.actionAvailability.boss.reason, /Lv\.2/);
    assert.equal(status.actionAvailability.raid.available, false);
    assert.equal(status.actionAvailability.guildRaid.available, false);
    assert.equal(status.actionAvailability.raid.levelBlocked, true);
    assert.match(status.actionAvailability.guildRaid.reason, /Lv\.2/);
    assert.equal(status.adventureGuide.actionAvailability.explore.available, false);
    assert.equal(status.adventureGuide.dailyGold.remaining, 60);
    assert.equal(status.adventureGuide.recommendedAction.type, 'dungeon');
  } finally {
    await fixture.cleanup();
  }
});

test('RPG 전투 결과 추천과 버튼 row는 행동 가용성 및 디스코드 제한을 따른다', async () => {
  const fixture = await createFixture({
    randomInt: (min) => min,
    rpgBattleCooldownMs: 60_000,
    rpgExploreCooldownMs: 120_000,
    rpgDungeonCooldownMs: 0
  });

  try {
    await fixture.economy.chooseRpgClass({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      characterClass: 'warrior'
    });
    await fixture.store.update((data) => {
      data.guilds['guild-1'].users['user-1'].rpg.lastExploreAt = Date.now();
    });

    const battle = createRpgInteraction('전투', {
      stringOptions: { 난이도: 'hard' }
    });
    await handleRpgCommand(battle, fixture.economy);
    const replyText = getReplyText(battle.replies[0]);

    assert.match(replyText, /다음 추천:.*던전/);
    assertComponentRowsWithinDiscordLimit(battle.replies[0]);
  } finally {
    await fixture.cleanup();
  }
});

test('RPG 전투 승리는 시즌 포인트를 지급하고 결과 카드에 표시한다', async () => {
  const fixture = await createFixture({
    randomInt: (min) => min,
    rpgBattleCooldownMs: 0
  });
  const awards = [];
  const seasons = {
    async awardPoints(payload) {
      awards.push(payload);
      return {
        awarded: true,
        capped: false,
        points: 25,
        requestedPoints: payload.points,
        totalPoints: 25,
        sourceLabel: 'RPG 전투 승리',
        newlyClaimableRewards: []
      };
    }
  };

  try {
    await fixture.economy.chooseRpgClass({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      characterClass: 'warrior'
    });

    const battle = createRpgInteraction('전투', {
      stringOptions: { 난이도: 'easy' }
    });
    await handleRpgCommand(battle, fixture.economy, { seasons });

    assert.equal(awards.length, 1);
    assert.equal(awards[0].source, 'rpg_battle_win');
    assert.equal(awards[0].points, 25);
    assert.match(getReplyText(battle.replies[0]), /시즌: RPG 전투 승리 \+25점/);
  } finally {
    await fixture.cleanup();
  }
});

test('RPG 수동 보스 쿨다운은 다른 보스만 막고 일반 전투는 막지 않는다', async () => {
  const fixture = await createFixture({
    randomInt: (_min, max) => max,
    rpgBattleCooldownMs: 0,
    rpgBossCooldownMs: 60_000
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
    const encounter = await fixture.economy.startRpgBossEncounter({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      bossId: 'slime_king',
      now: 10_000
    });
    const blockedBoss = await fixture.economy.startRpgBossEncounter({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      bossId: 'slime_king',
      now: 20_000
    }).catch((error) => error);
    const battle = await fixture.economy.playRpgBattle({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      difficulty: 'easy',
      now: 20_000
    });
    const finished = await fixture.economy.playRpgBossTurn({
      guildId: 'guild-1',
      session: {
        ...encounter.session,
        boss: {
          ...encounter.session.boss,
          hp: 1
        }
      },
      userId: 'user-1',
      action: 'basic',
      now: 70_000
    });
    const blockedAfterFinish = await fixture.economy.startRpgBossEncounter({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      bossId: 'slime_king',
      now: 80_000
    }).catch((error) => error);

    assert.equal(encounter.session.type, 'boss_turn');
    assert.match(blockedBoss.message, /보스전.*남은 시간/);
    assert.equal(battle.battled, true);
    assert.equal(finished.completed, true);
    assert.equal(finished.profile.rpg.lastBossAt, 70_000);
    assert.match(blockedAfterFinish.message, /보스전.*남은 시간/);
  } finally {
    await fixture.cleanup();
  }
});

test('RPG 길드레이드 모집은 레이드 쿨다운을 사전에 안내한다', async () => {
  const fixture = await createFixture({
    rpgRaidCooldownMs: 60_000
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
    await fixture.store.update((data) => {
      data.guilds['guild-1'].users['user-1'].rpg.lastRaidAt = Date.now();
    });

    const interaction = createRpgInteraction('길드레이드', {
      stringOptions: { 레이드: 'slime_horde' }
    });
    await handleRpgCommand(interaction, fixture.economy);

    assert.match(getReplyText(interaction.replies[0]), /모집 실패/);
    assert.match(getReplyText(interaction.replies[0]), /아직 할 수 없습니다/);
    assert.deepEqual(getComponentCustomIds(interaction.replies[0]), []);
  } finally {
    await fixture.cleanup();
  }
});

test('RPG 명령 응답은 반복 골드 상한 적용을 사용자에게 보여준다', async () => {
  const fixture = await createFixture({
    randomInt: (_min, max) => max,
    rpgExploreCooldownMs: 0,
    rpgDailyGoldCap: 100
  });

  try {
    const interaction = createRpgInteraction('탐험');

    await handleRpgCommand(interaction, fixture.economy);

    assert.match(getReplyText(interaction.replies[0]), /일일 상한 적용/);
  } finally {
    await fixture.cleanup();
  }
});

test('RPG 던전과 휴식도 반복 쿨다운을 적용한다', async () => {
  const fixture = await createFixture({
    randomInt: (_min, max) => max,
    rpgDungeonCooldownMs: 60_000,
    rpgRestCooldownMs: 60_000
  });

  try {
    const dungeon = await fixture.economy.runRpgDungeon({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      depth: 1,
      now: 10_000
    });
    const blockedDungeon = await fixture.economy.runRpgDungeon({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      depth: 1,
      now: 20_000
    }).catch((error) => error);
    const rest = await fixture.economy.restRpg({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      now: 30_000
    });
    const blockedRest = await fixture.economy.restRpg({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      now: 40_000
    }).catch((error) => error);

    assert.equal(dungeon.profile.rpg.lastDungeonAt, 10_000);
    assert.match(blockedDungeon.message, /던전.*남은 시간/);
    assert.equal(rest.profile.rpg.lastRestAt, 30_000);
    assert.match(blockedRest.message, /휴식.*남은 시간/);
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
    const menuIds = getComponentCustomIds(menuInteraction.replies[0]);
    assert.equal(menuIds.length <= 10, true);
    assert.ok(menuIds.includes('rpg_quick:user-1:battle'));
    assert.ok(menuIds.includes('rpg_quick:user-1:combat'));
    assert.ok(menuIds.includes('rpg_quick:user-1:adventure'));
    assert.ok(menuIds.includes('rpg_quick:user-1:growth'));
    assert.ok(menuIds.includes('rpg_quick:user-1:manage'));
    assert.ok(menuIds.includes('rpg_quick:user-1:today'));
    assert.ok(!menuIds.includes('rpg_quick:user-1:shop'));
    assert.deepEqual(getComponentLabels(menuInteraction.replies[0]).slice(-5), [
      '⚔️ 전투',
      '🌍 모험',
      '📈 성장',
      '🎒 관리',
      '✅ 오늘 할 일'
    ]);

    const combatMenu = createRpgButtonInteraction('rpg_quick:user-1:combat');
    await handleRpgCommand(combatMenu, fixture.economy);
    assert.match(combatMenu.updates[0].embeds[0].data.title, /RPG 전투 메뉴/);
    assert.ok(getComponentCustomIds(combatMenu.updates[0]).includes('rpg_quick:user-1:dungeon'));

    const growthMenu = createRpgButtonInteraction('rpg_quick:user-1:growth');
    await handleRpgCommand(growthMenu, fixture.economy);
    assert.match(growthMenu.updates[0].embeds[0].data.title, /RPG 성장 메뉴/);
    assert.ok(getComponentCustomIds(growthMenu.updates[0]).includes('rpg_quick:user-1:skill_tree'));

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
    assert.equal(advanced.heroAssetId, 'hero_berserker_idle');

    const encounter = await fixture.economy.startRpgBossEncounter({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      bossId: 'slime_king',
      now: 20_000
    });
    assert.equal(encounter.session.player.advancedClass, 'berserker');
    assert.equal(encounter.session.assets.hero, 'hero_berserker_idle');
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
    for (const payload of [menuInteraction.replies[0]]) {
      assertComponentRowsWithinDiscordLimit(payload);
    }
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
    await fixture.economy.awardActivityXp({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      xp: 400
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
    const storyButton = createRpgButtonInteraction('rpg_quick:user-1:story');
    await handleRpgCommand(storyButton, fixture.economy);
    const codexButton = createRpgButtonInteraction('rpg_quick:user-1:codex');
    await handleRpgCommand(codexButton, fixture.economy);
    const battleButton = createRpgButtonInteraction('rpg_quick:user-1:battle');
    await handleRpgCommand(battleButton, fixture.economy);

    assert.match(statusButton.updates[0].embeds[0].data.title, /RPG 상태/);
    for (const payload of [
      statusButton.updates[0],
      inventoryButton.updates[0],
      enhanceButton.updates[0],
      battleButton.updates[0]
    ]) {
      assertComponentRowsWithinDiscordLimit(payload);
    }
    assert.match(inventoryButton.updates[0].embeds[0].data.title, /RPG 인벤토리/);
    assert.match(enhanceButton.updates[0].embeds[0].data.title, /RPG 장비 강화/);
    assert.match(storyButton.updates[0].embeds[0].data.title, /RPG 스토리/);
    assert.match(codexButton.updates[0].embeds[0].data.title, /몬스터 도감/);
    assert.ok(getComponentCustomIds(enhanceButton.updates[0]).includes('rpg_select:user-1:gear_enhance'));
    assert.ok(getSelectValues(enhanceButton.updates[0], 'rpg_select:user-1:gear_enhance').includes('gear_button'));
    assert.match(battleButton.updates[0].embeds[0].data.title, /RPG 전투/);
    assert.match(getReplyText(battleButton.updates[0]), /전투 판정/);
    assert.match(getReplyText(battleButton.updates[0]), /다음 추천/);
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

test('RPG 목록형 화면은 버튼 더미 대신 선택 메뉴와 압축 내비게이션을 쓴다', async () => {
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
    await fixture.economy.awardActivityXp({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      xp: 100
    });
    await seedRpgGold(fixture.store, 'guild-1', 'user-1', 1_000);
    await fixture.economy.buyRpgItem({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      itemId: 'potion',
      quantity: 1
    });
    await seedRpgGear(fixture.store, 'guild-1', 'user-1', {
      id: 'gear_menu',
      baseItemId: 'iron_sword',
      slot: 'weapon',
      rarity: 'rare',
      rarityLabel: '희귀',
      label: '희귀 철검',
      stats: { attack: 8 },
      power: 2,
      enhanceLevel: 0,
      assetId: 'item_iron_sword_icon',
      acquiredAt: 1_000
    });

    const screens = [
      [createRpgInteraction('상점'), 'rpg_select:user-1:shop'],
      [createRpgInteraction('인벤토리'), 'rpg_select:user-1:use_item'],
      [createRpgInteraction('전리품'), 'rpg_select:user-1:gear_equip'],
      [createRpgInteraction('장비강화'), 'rpg_select:user-1:gear_enhance'],
      [createRpgInteraction('스킬트리'), null],
      [createRpgInteraction('전직'), null],
      [createRpgInteraction('퀘스트'), null],
      [createRpgInteraction('스토리'), 'rpg_select:user-1:story'],
      [createRpgInteraction('지역'), 'rpg_select:user-1:area']
    ];

    for (const [interaction, expectedSelectId] of screens) {
      await handleRpgCommand(interaction, fixture.economy);
      const payload = interaction.replies[0];
      assertComponentRowsWithinDiscordLimit(payload);
      assertSelectOptionsWithinDiscordLimit(payload);
      assert.ok(
        countButtonComponents(payload) <= 5,
        `${interaction.options.getSubcommand()} exposed ${countButtonComponents(payload)} button components`
      );
      if (expectedSelectId) {
        assert.ok(
          getComponentCustomIds(payload).includes(expectedSelectId),
          `${interaction.options.getSubcommand()} missing ${expectedSelectId}; saw ${getComponentCustomIds(payload).join(', ')}`
        );
      }
      assert.equal(getComponentCustomIds(payload).some((id) => /^rpg_(?:shop_buy|gear_enhance|gear_disassemble|gear_equip|skill|story):/.test(id)), false);
    }

    const wrongUser = createRpgSelectInteraction('rpg_select:user-1:shop', ['potion'], {
      user: {
        id: 'user-2',
        username: '도전자',
        bot: false
      }
    });
    await handleRpgCommand(wrongUser, fixture.economy);

    assert.equal(wrongUser.replies[0].ephemeral, true);
    assert.match(wrongUser.replies[0].content, /명령어를 실행한 유저만/);
  } finally {
    await fixture.cleanup();
  }
});

test('RPG 진행 화면은 내부 id 대신 한글 라벨과 다음 조작을 보여준다', async () => {
  const fixture = await createFixture({
    randomInt: (min) => min,
    rpgBattleCooldownMs: 0
  });

  try {
    await fixture.economy.chooseRpgClass({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      characterClass: 'mage',
      now: 1_000
    });
    await fixture.economy.awardActivityXp({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      xp: 400
    });
    await seedRpgGold(fixture.store, 'guild-1', 'user-1', 1_000);

    const menu = createRpgInteraction('메뉴');
    const skillTree = createRpgInteraction('스킬트리');
    const quests = createRpgInteraction('퀘스트');
    const shop = createRpgInteraction('상점');
    const story = createRpgInteraction('스토리');
    const areas = createRpgInteraction('지역');

    await handleRpgCommand(menu, fixture.economy);
    await handleRpgCommand(skillTree, fixture.economy);
    await handleRpgCommand(quests, fixture.economy);
    await handleRpgCommand(shop, fixture.economy);
    await handleRpgCommand(story, fixture.economy);
    await handleRpgCommand(areas, fixture.economy);

    const menuText = getReplyText(menu.replies[0]);
    assert.match(menuText, /다음 행동/);
    assert.match(menuText, /스마트 추천/);
    assert.match(menuText, /전투/);
    assert.match(menuText, /모험/);
    assert.match(menuText, /성장/);
    assert.match(menuText, /관리/);
    assert.match(menuText, /오늘 할 일/);
    assert.match(menuText, /버튼 배치/);
    assert.ok(getComponentCustomIds(skillTree.replies[0]).includes('rpg_quick:user-1:menu'));
    assert.ok(getComponentCustomIds(quests.replies[0]).includes('rpg_quick:user-1:battle'));
    assert.ok(getComponentCustomIds(story.replies[0]).includes('rpg_select:user-1:story'));
    assert.ok(getSelectValues(story.replies[0], 'rpg_select:user-1:story').includes('forest_oath'));
    const areaText = getReplyText(areas.replies[0]);
    assert.match(areaText, /RPG 월드맵 · 사냥터 선택/);
    assert.match(areaText, /추천 사냥터/);
    assert.match(areaText, /Lv\.1 입문/);
    assert.match(areaText, /선택 가이드/);
    assert.ok(getComponentCustomIds(areas.replies[0]).includes('rpg_quick:user-1:menu'));

    const combinedProgressText = [
      getReplyText(skillTree.replies[0]),
      getReplyText(quests.replies[0]),
      getReplyText(shop.replies[0]),
      getReplyText(story.replies[0]),
      getReplyText(areas.replies[0])
    ].join('\n');

    assert.doesNotMatch(combinedProgressText, /\b(?:weapon_training|mana_flow|class_mastery|first_blood|slime_slayer|cave_scout|boss_challenger|iron_sword|leather_armor|mana_potion|forest_oath|cave_signal|ruins_key)\b/);
    assert.match(combinedProgressText, /무기 숙련/);
    assert.match(combinedProgressText, /마나 순환/);
    assert.match(combinedProgressText, /첫 승리/);
    assert.match(combinedProgressText, /철검/);
    assert.match(combinedProgressText, /숲의 맹세/);
    assert.match(combinedProgressText, /선택 메뉴로 바로/);
    assert.match(combinedProgressText, /진행도/);

    const skillButton = createRpgButtonInteraction('rpg_skill:user-1:mana_flow');
    const storyButton = createRpgButtonInteraction('rpg_story:user-1:forest_oath');
    await handleRpgCommand(skillButton, fixture.economy);
    await handleRpgCommand(storyButton, fixture.economy);

    assert.match(getReplyText(skillButton.updates[0]), /마나 순환/);
    assert.doesNotMatch(getReplyText(skillButton.updates[0]), /mana_flow/);
    assert.match(getReplyText(storyButton.updates[0]), /스토리 완료/);
    assert.match(getReplyText(storyButton.updates[0]), /숲의 맹세/);
    assert.doesNotMatch(getReplyText(storyButton.updates[0]), /forest_oath/);
  } finally {
    await fixture.cleanup();
  }
});

test('RPG 주요 조작 화면은 일반 텍스트가 아니라 embed 카드로 응답한다', async () => {
  const fixture = await createFixture({
    randomInt: (min) => min,
    rpgBattleCooldownMs: 0
  });

  try {
    await fixture.economy.chooseRpgClass({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      characterClass: 'mage',
      now: 1_000
    });
    await fixture.economy.awardActivityXp({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      xp: 400
    });
    await seedRpgGold(fixture.store, 'guild-1', 'user-1', 10_000);
    await fixture.economy.buyRpgItem({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      itemId: 'iron_sword',
      quantity: 1
    });
    await seedRpgGear(fixture.store, 'guild-1', 'user-1', {
      id: 'gear_card',
      baseItemId: 'iron_sword',
      slot: 'weapon',
      rarity: 'rare',
      rarityLabel: '희귀',
      label: '희귀 철검',
      stats: { attack: 5 },
      power: 2,
      enhanceLevel: 0,
      assetId: 'item_iron_sword_icon',
      acquiredAt: 1_000
    });
    await fixture.economy.playRpgBattle({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      difficulty: 'easy'
    });

    const commandCases = [
      [createRpgInteraction('시작'), /캐릭터 생성/],
      [createRpgInteraction('장비'), /RPG 장비 장착/],
      [createRpgInteraction('전리품'), /RPG 전리품 장비/],
      [createRpgInteraction('장비강화'), /RPG 장비 강화/],
      [createRpgInteraction('퀘스트'), /RPG 퀘스트/],
      [createRpgInteraction('일일'), /오늘의 RPG 의뢰판/],
      [createRpgInteraction('휴식'), /휴식 완료/],
      [createRpgInteraction('스킬트리'), /RPG 스킬/],
      [createRpgInteraction('전직'), /RPG 전직 트리/],
      [createRpgInteraction('스토리'), /RPG 스토리/],
      [createRpgInteraction('도감'), /몬스터 도감/],
      [createRpgInteraction('지역'), /RPG 월드맵/],
      [createRpgInteraction('장비', { stringOptions: { 아이템: 'iron_sword' } }), /장비 장착/],
      [createRpgInteraction('전리품', { stringOptions: { 장비: 'gear_card' } }), /전리품 장착/],
      [createRpgInteraction('퀘스트', { stringOptions: { 퀘스트: 'first_blood' } }), /퀘스트 보상 수령/],
      [createRpgInteraction('일일', { stringOptions: { 임무: 'victory_contract' } }), /일일 의뢰 보상 수령/],
      [createRpgInteraction('스킬트리', { stringOptions: { 스킬: 'mana_flow' } }), /스킬트리 학습/],
      [createRpgInteraction('스토리', { stringOptions: { 챕터: 'forest_oath' } }), /스토리 완료/]
    ];

    for (const [interaction, titlePattern] of commandCases) {
      await handleRpgCommand(interaction, fixture.economy);
      assertRpgEmbedCard(interaction.replies[0], titlePattern);
    }

    const battleCard = createRpgInteraction('전투', {
      stringOptions: { 난이도: '쉬움' }
    });
    await handleRpgCommand(battleCard, fixture.economy);
    assertRpgEmbedCard(battleCard.replies[0], /RPG 전투/);
    assertRpgEmbedFilesAreReferenced(battleCard.replies[0]);

    const gearButton = createRpgButtonInteraction('rpg_gear_equip:user-1:gear_card');
    await handleRpgCommand(gearButton, fixture.economy);
    assertRpgEmbedCard(gearButton.updates[0], /전리품 장착/);
    assertRpgEmbedFilesAreReferenced(gearButton.updates[0]);
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
    assert.ok(getComponentCustomIds(menu.replies[0]).includes('rpg_quick:user-1:manage'));
    const manage = createRpgButtonInteraction('rpg_quick:user-1:manage');
    await handleRpgCommand(manage, fixture.economy);
    assert.match(manage.updates[0].embeds[0].data.title, /RPG 관리 메뉴/);
    assert.ok(getComponentCustomIds(manage.updates[0]).includes('rpg_quick:user-1:shop'));

    const shop = createRpgButtonInteraction('rpg_quick:user-1:shop');
    await handleRpgCommand(shop, fixture.economy);
    assert.match(shop.updates[0].embeds[0].data.title, /RPG 상점/);
    assert.ok(getComponentCustomIds(shop.updates[0]).includes('rpg_select:user-1:shop'));
    assert.ok(getSelectValues(shop.updates[0], 'rpg_select:user-1:shop').includes('potion'));
    assert.ok(getSelectValues(shop.updates[0], 'rpg_select:user-1:shop').includes('iron_sword'));

    const potionPurchase = createRpgSelectInteraction('rpg_select:user-1:shop', ['potion']);
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
    assert.equal(afterPotion.profile.balance, 880);

    const swordPurchase = createRpgButtonInteraction('rpg_shop_buy:user-1:iron_sword:1');
    await handleRpgCommand(swordPurchase, fixture.economy);
    assert.ok(getComponentCustomIds(swordPurchase.updates[0]).includes('rpg_item_equip:user-1:iron_sword'));

    const inventory = createRpgButtonInteraction('rpg_quick:user-1:inventory');
    await handleRpgCommand(inventory, fixture.economy);
    assert.ok(getComponentCustomIds(inventory.updates[0]).includes('rpg_select:user-1:use_item'));
    assert.ok(getSelectValues(inventory.updates[0], 'rpg_select:user-1:use_item').includes('potion'));
    assert.ok(getComponentCustomIds(inventory.updates[0]).includes('rpg_select:user-1:sell_item'));
    assert.ok(getSelectValues(inventory.updates[0], 'rpg_select:user-1:sell_item').includes('potion'));

    const sellPotion = createRpgSelectInteraction('rpg_select:user-1:sell_item', ['potion']);
    await handleRpgCommand(sellPotion, fixture.economy);
    assert.match(sellPotion.updates[0].embeds[0].data.title, /아이템 판매/);
    const afterSell = await fixture.economy.getRpgStatus({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사'
    });
    assert.equal(afterSell.profile.rpg.inventory.potion, initialPotionCount);
    assert.equal(afterSell.profile.balance, 440);
  } finally {
    await fixture.cleanup();
  }
});

test('RPG 길드레이드는 서버 파티원을 모아 보상과 지원 보상을 정산한다', async () => {
  const fixture = await createFixture({
    randomInt: (min) => min,
    rpgBattleCooldownMs: 0,
    rpgRaidCooldownMs: 0
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
    await fixture.economy.awardActivityXp({
      guildId: 'guild-1',
      userId: 'user-2',
      username: '마법사',
      xp: 200
    });
    await fixture.economy.awardActivityXp({
      guildId: 'guild-1',
      userId: 'user-3',
      username: '궁수',
      xp: 200
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
      stringOptions: { 레이드: 'slime_horde' }
    });
    await handleRpgCommand(interaction, fixture.economy);
    const lobbyText = getReplyText(interaction.replies[0]);
    const lobbyIds = getComponentCustomIds(interaction.replies[0]);
    const joinId = lobbyIds.find((customId) => customId.startsWith('rpg_raid_lobby:join:'));
    const startId = lobbyIds.find((customId) => customId.startsWith('rpg_raid_lobby:start:'));
    const join = createRpgButtonInteraction(joinId, {
      user: {
        id: 'user-2',
        username: '마법사',
        bot: false
      }
    });
    await handleRpgCommand(join, fixture.economy);
    const start = createRpgButtonInteraction(startId);
    await handleRpgCommand(start, fixture.economy);

    assert.equal(result.battle.type, 'guild_raid');
    assert.equal(result.battle.partySize, 3);
    assert.equal(result.battle.win, true);
    assert.equal(result.supportRewards.length, 2);
    assert.equal(result.profile.currencyBalances.rpg, 1_600);
    assert.equal(supportProfile.currencyBalances.rpg, 475);
    assert.equal(supportProfile.rpg.lastRaidAt, 10_000);
    assert.match(interaction.replies[0].embeds[0].data.title, /길드 레이드 모집/);
    assert.match(lobbyText, /참가/);
    assert.match(getReplyText(join.updates[0]), /2\/4/);
    assert.match(start.updates[0].embeds[0].data.title, /길드 레이드 결과/);
    assert.match(getReplyText(start.updates[0]), /마법사/);
  } finally {
    await fixture.cleanup();
  }
});

test('RPG 길드레이드는 지원 파티원의 레이드 쿨다운을 서비스와 로비에서 차단한다', async () => {
  const fixture = await createFixture({
    randomInt: (min) => min,
    rpgBattleCooldownMs: 0,
    rpgRaidCooldownMs: 60_000
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
    await fixture.economy.awardActivityXp({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      xp: 400
    });
    await fixture.economy.awardActivityXp({
      guildId: 'guild-1',
      userId: 'user-2',
      username: '마법사',
      xp: 400
    });
    await fixture.store.update((data) => {
      data.guilds['guild-1'].users['user-2'].rpg.lastRaidAt = 19_500;
    });
    const supportBefore = await fixture.economy.getProfile('guild-1', 'user-2', '마법사');

    const result = await fixture.economy.playRpgGuildRaid({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      raidId: 'slime_horde',
      partyMemberIds: ['user-1', 'user-2'],
      now: 20_000
    });
    const blockedSupport = await fixture.economy.getProfile('guild-1', 'user-2', '마법사');

    assert.equal(result.battle.partySize, 1);
    assert.equal(result.supportRewards.length, 0);
    assert.equal(blockedSupport.rpg.lastRaidAt, 19_500);
    assert.equal(blockedSupport.currencyBalances.rpg, supportBefore.currencyBalances.rpg);

    await fixture.store.update((data) => {
      data.guilds['guild-1'].users['user-1'].rpg.lastRaidAt = 0;
      data.guilds['guild-1'].users['user-2'].rpg.lastRaidAt = Date.now();
    });
    const interaction = createRpgInteraction('길드레이드', {
      stringOptions: { 레이드: 'slime_horde' }
    });
    await handleRpgCommand(interaction, fixture.economy);
    const lobbyIds = getComponentCustomIds(interaction.replies[0]);
    const joinId = lobbyIds.find((customId) => customId.startsWith('rpg_raid_lobby:join:'));
    const join = createRpgButtonInteraction(joinId, {
      user: {
        id: 'user-2',
        username: '마법사',
        bot: false
      }
    });
    await handleRpgCommand(join, fixture.economy);

    assert.match(getReplyText(interaction.replies[0]), /길드 레이드 모집/);
    assert.match(getReplyText(join.replies[0]), /참가는 아직 할 수 없습니다/);
  } finally {
    await fixture.cleanup();
  }
});

test('RPG 길드레이드는 실패해도 참가한 지원 파티원의 쿨다운을 소모한다', async () => {
  const fixture = await createFixture({
    randomInt: (min, max) => (min === 1 && max === 20 ? min : max),
    rpgBattleCooldownMs: 0,
    rpgRaidCooldownMs: 60_000
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
    await fixture.economy.awardActivityXp({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      xp: 200
    });
    await fixture.economy.awardActivityXp({
      guildId: 'guild-1',
      userId: 'user-2',
      username: '마법사',
      xp: 200
    });
    const supportBefore = await fixture.economy.getProfile('guild-1', 'user-2', '마법사');

    const result = await fixture.economy.playRpgGuildRaid({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      raidId: 'slime_horde',
      partyMemberIds: ['user-1', 'user-2'],
      now: 30_000
    });
    const supportAfter = await fixture.economy.getProfile('guild-1', 'user-2', '마법사');

    assert.equal(result.battle.partySize, 2);
    assert.equal(result.battle.win, false);
    assert.equal(result.supportRewards.length, 0);
    assert.equal(result.profile.rpg.lastRaidAt, 30_000);
    assert.equal(supportAfter.rpg.lastRaidAt, 30_000);
    assert.equal(supportAfter.currencyBalances.rpg, supportBefore.currencyBalances.rpg);
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
    bossId: 'slime_king',
    turnNumber: 2,
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
  assert.match(attack.bossPattern.telegraph, /뛰어/);
  assert.equal(guard.action, 'guard');
  assert.equal(guard.playerDamage, 0);
  assert.equal(guard.patternCountered, true);
  assert.equal(guard.bossDamageReduction > 0, true);
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
    assert.deepEqual(status.profile.rpg.unlockedAreas, ['forest', 'wildflower_plains', 'cave', 'moonlit_hill']);
    assert.deepEqual(status.profile.rpg.discoveredMonsters, {});
    assert.equal(status.profile.rpg.battles, 0);
    assert.equal(status.profile.rpg.wins, 0);
    assert.equal(status.profile.rpg.losses, 0);
    assert.equal(status.profile.rpg.lastBattleAt, 0);
    assert.equal(status.cooldownRemainingMs, 0);
    assert.equal(status.actionAvailability.battle.available, true);
    assert.equal(status.actionAvailability.rest.available, true);
    assert.equal(status.dailyGold.remaining, status.dailyGold.cap);
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
  integerOptions = {},
  userOptions = {}
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
      getUser(name) {
        return userOptions[name] ?? null;
      }
    },
    async reply(payload) {
      replies.push(payload);
    }
  };
}

function createRpgButtonInteraction(customId, {
  user = {
    id: 'user-1',
    username: '용사',
    bot: false
  }
} = {}) {
  const replies = [];
  const updates = [];

  return {
    guildId: 'guild-1',
    channelId: 'channel-1',
    customId,
    user,
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

function createRpgSelectInteraction(customId, values, {
  user = {
    id: 'user-1',
    username: '용사',
    bot: false
  }
} = {}) {
  const replies = [];
  const updates = [];

  return {
    guildId: 'guild-1',
    channelId: 'channel-1',
    customId,
    values,
    user,
    replies,
    updates,
    isButton() {
      return false;
    },
    isStringSelectMenu() {
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

function getReplyText(payload) {
  if (typeof payload === 'string') return payload;

  const embedTexts = (payload.embeds ?? [])
    .map((embed) => [embed.data.title, embed.data.description].filter(Boolean).join('\n'))
    .filter(Boolean);

  return [payload.content, ...embedTexts]
    .filter(Boolean)
    .join('\n');
}

function assertRpgEmbedCard(payload, titlePattern) {
  assert.notEqual(typeof payload, 'string');
  assert.equal(payload.content ?? null, null);
  assert.ok(payload.embeds?.length > 0);
  assert.match(payload.embeds[0].data.title, titlePattern);
  assert.ok(payload.embeds[0].data.description?.length > 0);
  assert.match(payload.embeds[0].data.footer?.text ?? '', /RPG/);
}

function assertRpgEmbedFilesAreReferenced(payload) {
  const files = payload.files ?? [];
  const embed = payload.embeds?.[0]?.data ?? {};
  const referencedUrls = new Set([
    embed.image?.url,
    embed.thumbnail?.url
  ].filter(Boolean));

  assert.ok(files.length <= 2);
  for (const file of files) {
    assert.ok(referencedUrls.has(`attachment://${file.name}`));
  }
}

function getComponentCustomIds(payload) {
  return (payload.components ?? [])
    .flatMap((row) => row.components ?? [])
    .map((component) => component.data.custom_id)
    .filter(Boolean);
}

function getComponentLabels(payload) {
  return (payload.components ?? [])
    .flatMap((row) => row.components ?? [])
    .map((component) => component.data.label)
    .filter(Boolean);
}

function getSelectValues(payload, customId) {
  return (payload.components ?? [])
    .flatMap((row) => row.components ?? [])
    .filter((component) => component.data?.custom_id === customId)
    .flatMap((component) => component.options ?? component.data?.options ?? [])
    .map((option) => option.data?.value ?? option.value)
    .filter(Boolean);
}

function countButtonComponents(payload) {
  return (payload.components ?? [])
    .flatMap((row) => row.components ?? [])
    .filter((component) => component.data?.type === 2)
    .length;
}

function assertComponentRowsWithinDiscordLimit(payload) {
  for (const row of payload.components ?? []) {
    assert.ok((row.components ?? []).length <= 5);
  }
}

function assertSelectOptionsWithinDiscordLimit(payload) {
  for (const component of (payload.components ?? []).flatMap((row) => row.components ?? [])) {
    const options = component.options ?? component.data?.options ?? [];
    assert.ok(options.length <= 25);
  }
}

async function seedRpgGold(store, guildId, userId, amount) {
  await store.update((data) => {
    const profile = data.guilds[guildId].users[userId];
    profile.balance = amount;
    profile.wallets = {
      casinoChips: 0,
      rpgGold: 0,
      swordCoins: 0,
      stockCash: 0
    };
    profile.currencyMigration = { unifiedGoldVersion: 1, unifiedGoldAt: 1 };
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
