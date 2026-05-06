import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  createSwordReplyPayload,
  getSwordCommandPayloads,
  handleSwordCommand
} from '../src/commands/sword.js';
import { createSqliteStore } from '../src/storage/sqlite-store.js';
import { EconomyService } from '../src/systems/economy.js';
import {
  getSwordAssetAttachment,
  getSwordAssetLabel,
  getSwordAssetName
} from '../src/systems/sword-assets.js';
import {
  getAdvancedSwordEnhanceConfig,
  getSwordEnhanceConfig,
  resolveSwordEnhancement
} from '../src/systems/sword.js';

const DAY_MS = 24 * 60 * 60 * 1000;

test('검 명령 payload는 강화, 상급강화, 배틀, 선물받기를 등록한다', () => {
  const payloads = getSwordCommandPayloads();

  assert.deepEqual(payloads.map((command) => command.name), [
    '검강화',
    '검상급강화',
    '검배틀',
    '선물받기'
  ]);
  assert.equal(payloads[2].options[0].name, '상대');
  assert.equal(payloads[2].options[0].required, false);
});

test('검 강화 확률표는 1~100강 확장표와 상급강화 보정을 따른다', () => {
  assert.deepEqual(pickRates(getSwordEnhanceConfig(0)), [100, 0, 0]);
  assert.deepEqual(pickRates(getSwordEnhanceConfig(35)), [80, 10, 10]);
  assert.deepEqual(pickRates(getSwordEnhanceConfig(95)), [8, 81, 11]);
  assert.equal(getSwordEnhanceConfig(100).blocked, true);
  assert.deepEqual(pickRates(getAdvancedSwordEnhanceConfig(90)), [27, 73, 0]);
  assert.equal(getAdvancedSwordEnhanceConfig(91).blocked, true);
});

test('검 강화 결과는 성공, 유지, 파괴와 파괴 보상을 계산한다', () => {
  const success = resolveSwordEnhancement({
    level: 0,
    randomInt: () => 1
  });
  const maintain = resolveSwordEnhancement({
    level: 40,
    randomInt: () => 80
  });
  const destroyed = resolveSwordEnhancement({
    level: 95,
    randomInt: () => 100
  });
  const advanced = resolveSwordEnhancement({
    level: 90,
    mode: 'advanced',
    randomInt: () => 100
  });

  assert.equal(success.outcome, 'success');
  assert.equal(success.afterLevel, 1);
  assert.equal(maintain.outcome, 'maintain');
  assert.equal(maintain.afterLevel, 40);
  assert.equal(destroyed.outcome, 'destroy');
  assert.equal(destroyed.afterLevel, 0);
  assert.equal(destroyed.refineStoneReward, 4);
  assert.equal(advanced.outcome, 'maintain');
  assert.equal(advanced.afterLevel, 90);
  assert.throws(
    () => resolveSwordEnhancement({ level: 91, mode: 'advanced' }),
    /90 이하/
  );
});

test('검 이미지 에셋은 레벨 이름과 256px PNG 첨부를 제공한다', () => {
  const first = getSwordAssetAttachment(1);
  const hundred = getSwordAssetAttachment(100);

  assert.equal(getSwordAssetName(1), '도훈검');
  assert.equal(getSwordAssetName(100), '희희검');
  assert.equal(getSwordAssetLabel(0), '+0 기본 검');
  assert.equal(first.name, 'sword_001.png');
  assert.equal(hundred.name, 'sword_100.png');
  assert.equal(existsSync(first.attachment), true);
  assert.equal(existsSync(hundred.attachment), true);
});

test('검 응답 payload는 현재 검 이미지를 embed attachment로 붙인다', () => {
  const payload = createSwordReplyPayload('강화 결과', 1, '현재 검 — +1 도훈검');

  assert.equal(payload.content, '강화 결과');
  assert.equal(payload.files[0].name, 'sword_001.png');
  assert.equal(payload.embeds[0].data.title, '현재 검 — +1 도훈검');
  assert.equal(payload.embeds[0].data.image.url, 'attachment://sword_001.png');
});

test('검강화 명령 응답은 강화 단계 이미지 파일을 포함한다', async () => {
  const replies = [];
  const interaction = createSwordInteraction({
    commandName: '검강화',
    replies
  });
  const economy = {
    async enhanceSword() {
      return swordEnhancementResult({
        beforeLevel: 0,
        afterLevel: 1
      });
    }
  };

  const handled = await handleSwordCommand(interaction, economy, silentLogger);

  assert.equal(handled, true);
  assert.equal(replies.length, 1);
  assert.match(replies[0].content, /현재 검: \*\*\+1 도훈검\*\*/);
  assert.equal(replies[0].files[0].name, 'sword_001.png');
  assert.equal(replies[0].embeds[0].data.image.url, 'attachment://sword_001.png');
});

test('선물받기는 하루 한 번 제련석을 지급하고 기존 프로필에 검 상태를 채운다', async () => {
  const fixture = await createFixture();

  try {
    await fixture.store.update((data) => {
      data.guilds['guild-1'] = {
        users: {
          'user-1': legacyProfile('user-1', '검사')
        }
      };
    });

    const first = await fixture.economy.claimSwordGift({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '검사',
      now: 1_000
    });
    const duplicate = await fixture.economy.claimSwordGift({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '검사',
      now: 2_000
    });
    const nextDay = await fixture.economy.claimSwordGift({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '검사',
      now: DAY_MS + 1_000
    });

    assert.equal(first.claimed, true);
    assert.equal(first.giftStones, 3);
    assert.equal(first.profile.sword.level, 0);
    assert.equal(first.profile.sword.refineStones, 3);
    assert.equal(duplicate.claimed, false);
    assert.equal(duplicate.profile.sword.refineStones, 3);
    assert.equal(nextDay.claimed, true);
    assert.equal(nextDay.profile.sword.refineStones, 6);
  } finally {
    await fixture.cleanup();
  }
});

test('검 강화 서비스는 돈과 제련석을 원자적으로 갱신한다', async () => {
  const fixture = await createFixture({ randomInt: () => 1 });

  try {
    await seedProfile(fixture.store, {
      userId: 'user-1',
      username: '강화러',
      balance: 1_000,
      sword: { level: 0, refineStones: 1 }
    });

    const normal = await fixture.economy.enhanceSword({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '강화러',
      now: 10_000
    });
    const advanced = await fixture.economy.advancedEnhanceSword({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '강화러',
      now: 20_000
    });

    assert.equal(normal.outcome, 'success');
    assert.equal(normal.profile.sword.level, 1);
    assert.equal(normal.profile.balance, 900);
    assert.equal(normal.profile.sword.normalAttempts, 1);
    assert.equal(advanced.outcome, 'success');
    assert.equal(advanced.profile.sword.level, 2);
    assert.equal(advanced.profile.sword.refineStones, 0);
    assert.equal(advanced.profile.sword.advancedAttempts, 1);
    assert.equal(advanced.profile.sword.highestLevel, 2);
  } finally {
    await fixture.cleanup();
  }
});

test('고강화 검 파괴는 레벨을 0으로 만들고 최고 강화와 제련석 보상을 남긴다', async () => {
  const fixture = await createFixture({ randomInt: () => 100 });

  try {
    await seedProfile(fixture.store, {
      userId: 'user-1',
      username: '파괴러',
      balance: 20_000,
      sword: { level: 95, highestLevel: 95, refineStones: 0 }
    });

    const result = await fixture.economy.enhanceSword({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '파괴러',
      now: 10_000
    });

    assert.equal(result.outcome, 'destroy');
    assert.equal(result.profile.sword.level, 0);
    assert.equal(result.profile.sword.highestLevel, 95);
    assert.equal(result.profile.sword.refineStones, 4);
    assert.equal(result.profile.sword.destructions, 1);
  } finally {
    await fixture.cleanup();
  }
});

test('랜덤 검배틀은 상대 없이 진행되고 승리 보상과 하루 제한, 제련석 일일 상한을 적용한다', async () => {
  const fixture = await createFixture({ randomInt: (min) => min });

  try {
    await seedProfile(fixture.store, {
      userId: 'user-1',
      username: '배틀러',
      balance: 0,
      level: 5,
      sword: { level: 50, highestLevel: 50 }
    });

    let last = null;
    for (let index = 0; index < 10; index += 1) {
      last = await fixture.economy.playSwordRandomBattle({
        guildId: 'guild-1',
        userId: 'user-1',
        username: '배틀러',
        now: 10_000
      });
      assert.equal(last.battled, true);
      assert.equal(last.won, true);
    }
    const blocked = await fixture.economy.playSwordRandomBattle({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '배틀러',
      now: 20_000
    });

    assert.equal(last.profile.sword.battleWins, 10);
    assert.equal(last.profile.sword.battlesToday, 10);
    assert.equal(last.profile.sword.battleStonesToday, 3);
    assert.equal(last.profile.sword.refineStones, 3);
    assert.equal(last.profile.balance > 0, true);
    assert.equal(blocked.battled, false);
  } finally {
    await fixture.cleanup();
  }
});

test('유저 검배틀은 양쪽 일일 횟수를 쓰고 승자만 돈과 경험치를 얻는다', async () => {
  const fixture = await createFixture({ randomInt: (min) => min });

  try {
    await seedProfile(fixture.store, {
      userId: 'challenger',
      username: '도전자',
      balance: 0,
      level: 1,
      sword: { level: 20, highestLevel: 20 }
    });
    await seedProfile(fixture.store, {
      userId: 'opponent',
      username: '상대',
      balance: 100,
      level: 1,
      sword: { level: 0, highestLevel: 0 }
    });

    const result = await fixture.economy.playSwordPvpBattle({
      guildId: 'guild-1',
      challenger: { userId: 'challenger', username: '도전자' },
      opponent: { userId: 'opponent', username: '상대' },
      now: 10_000
    });

    assert.equal(result.winnerUserId, 'challenger');
    assert.equal(result.challenger.balance, result.rewards.money + result.levelReward);
    assert.equal(result.challenger.totalXp, result.rewards.xp);
    assert.equal(result.challenger.sword.battleWins, 1);
    assert.equal(result.challenger.sword.battlesToday, 1);
    assert.equal(result.opponent.balance, 100);
    assert.equal(result.opponent.sword.battleLosses, 1);
    assert.equal(result.opponent.sword.battlesToday, 1);
  } finally {
    await fixture.cleanup();
  }
});

async function createFixture(options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'heeheebot-sword-'));
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

async function seedProfile(store, {
  guildId = 'guild-1',
  userId,
  username,
  level = 1,
  xp = 0,
  totalXp = 0,
  balance = 0,
  sword = {}
}) {
  await store.update((data) => {
    data.guilds[guildId] ??= {};
    data.guilds[guildId].users ??= {};
    data.guilds[guildId].users[userId] = {
      ...legacyProfile(userId, username),
      level,
      xp,
      totalXp,
      balance,
      sword
    };
  });
}

function legacyProfile(userId, username) {
  return {
    userId,
    username,
    level: 1,
    xp: 0,
    totalXp: 0,
    balance: 0,
    lastMessageRewardAt: 0,
    lastDailyAt: 0,
    lastDailyDay: null,
    dailyStreak: 0,
    lastFirstMessageBonusDay: null,
    createdAt: 1
  };
}

function pickRates(config) {
  return [config.successRate, config.maintainRate, config.destroyRate];
}

function createSwordInteraction({ commandName, replies }) {
  return {
    commandName,
    guildId: 'guild-1',
    user: {
      id: 'user-1',
      username: '검사',
      toString() {
        return '<@user-1>';
      }
    },
    isButton() {
      return false;
    },
    isChatInputCommand() {
      return true;
    },
    inGuild() {
      return true;
    },
    async reply(payload) {
      replies.push(payload);
    }
  };
}

function swordEnhancementResult({ beforeLevel, afterLevel }) {
  return {
    min: 0,
    max: 4,
    level: beforeLevel,
    targetLevel: beforeLevel + 1,
    mode: 'normal',
    modeLabel: '일반 강화',
    blocked: false,
    successRate: 100,
    maintainRate: 0,
    destroyRate: 0,
    moneyCost: 100,
    stoneCost: 0,
    beforeLevel,
    afterLevel,
    roll: 1,
    outcome: 'success',
    outcomeLabel: '강화',
    refineStoneReward: 0,
    profile: {
      userId: 'user-1',
      username: '검사',
      balance: 900,
      sword: {
        level: afterLevel,
        highestLevel: afterLevel,
        refineStones: 0
      }
    }
  };
}

const silentLogger = {
  error() {}
};
