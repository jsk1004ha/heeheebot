import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createSqliteStore } from '../src/storage/sqlite-store.js';
import { getRpgCommandPayloads } from '../src/commands/rpg.js';
import { EconomyService } from '../src/systems/economy.js';
import {
  normalizeRpgDifficulty,
  normalizeRpgGender,
  resolveRpgBattle
} from '../src/systems/rpg.js';

test('RPG 명령 payload는 전투와 상태 subcommand를 등록한다', () => {
  const [command] = getRpgCommandPayloads();

  assert.equal(command.name, 'rpg');
  assert.deepEqual(command.options.map((option) => option.name), [
    '시작',
    '전투',
    '탐험',
    '던전',
    '보스',
    '상태',
    '상점',
    '인벤토리',
    '사용',
    '장비',
    '전리품',
    '퀘스트',
    '휴식',
    '가챠',
    '스킬트리',
    '전직',
    '스토리',
    '도감',
    '레이드',
    '지역',
    '에셋'
  ]);
  assert.deepEqual(
    command.options[1].options[0].choices.map((choice) => choice.name),
    ['쉬움', '보통', '어려움']
  );
  assert.deepEqual(
    command.options[0].options[0].choices.map((choice) => choice.name),
    ['전사', '마법사', '궁수', '팔라딘 (가챠)', '도적 (가챠)', '사제 (가챠)']
  );
  assert.deepEqual(
    command.options[0].options[1].choices.map((choice) => choice.name),
    ['남캐', '여캐']
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
    assert.equal(purchase.profile.balance, 500);
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
    assert.equal(gacha.profile.balance, 700);
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
    assert.equal(claimed.profile.balance, 200);
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
    assert.equal(first.profile.balance, 80);
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

function createSequenceRandom(values) {
  let index = 0;

  return (min, max) => {
    if (index >= values.length) return min;
    const value = values[index];
    index += 1;
    return Math.min(max, Math.max(min, value));
  };
}
