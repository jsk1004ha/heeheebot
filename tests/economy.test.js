import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createSqliteStore } from '../src/storage/sqlite-store.js';
import { EconomyService } from '../src/systems/economy.js';

test('새 프로필은 레벨 1과 잔액 0으로 시작한다', async () => {
  const fixture = await createFixture();

  try {
    const profile = await fixture.economy.getProfile('guild-1', 'user-1', '테스터');

    assert.equal(profile.level, 1);
    assert.equal(profile.xp, 0);
    assert.equal(profile.totalXp, 0);
    assert.equal(profile.balance, 0);
    assert.equal(profile.username, '테스터');
  } finally {
    await fixture.cleanup();
  }
});

test('메시지 보상은 쿨다운을 지키고 경험치와 돈을 지급한다', async () => {
  const fixture = await createFixture({
    randomInt: (min, max) => (max === 15 ? 10 : 3)
  });

  try {
    const first = await fixture.economy.rewardMessage({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '테스터',
      now: 100_000
    });
    const second = await fixture.economy.rewardMessage({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '테스터',
      now: 100_500
    });

    assert.equal(first.awarded, true);
    assert.equal(first.xpGained, 10);
    assert.equal(first.moneyGained, 3);
    assert.equal(first.profile.xp, 10);
    assert.equal(first.profile.balance, 3);

    assert.equal(second.awarded, false);
    assert.equal(second.profile.xp, 10);
    assert.equal(second.profile.balance, 3);
  } finally {
    await fixture.cleanup();
  }
});

test('충분한 경험치를 받으면 레벨업 보상을 지급한다', async () => {
  const fixture = await createFixture({
    messageCooldownMs: 0,
    messageXpMin: 120,
    messageXpMax: 120,
    messageMoneyMin: 5,
    messageMoneyMax: 5,
    randomInt: (min) => min
  });

  try {
    const result = await fixture.economy.rewardMessage({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '테스터',
      now: 100_000
    });

    assert.equal(result.leveledUp, true);
    assert.equal(result.levelsGained, 1);
    assert.equal(result.profile.level, 2);
    assert.equal(result.profile.xp, 20);
    assert.equal(result.levelReward, 200);
    assert.equal(result.profile.balance, 205);
  } finally {
    await fixture.cleanup();
  }
});

test('출석 보상은 하루 한 번만 받을 수 있다', async () => {
  const fixture = await createFixture();

  try {
    const first = await fixture.economy.claimDaily({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '테스터',
      now: 1_000
    });
    const second = await fixture.economy.claimDaily({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '테스터',
      now: 2_000
    });

    assert.equal(first.claimed, true);
    assert.equal(first.reward, 500);
    assert.equal(first.profile.balance, 500);

    assert.equal(second.claimed, false);
    assert.equal(second.profile.balance, 500);
  } finally {
    await fixture.cleanup();
  }
});

test('송금은 잔액을 이동하고 랭킹은 레벨/누적 경험치 순으로 정렬한다', async () => {
  const fixture = await createFixture({
    dailyReward: 1_000
  });

  try {
    await fixture.economy.claimDaily({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '보내는사람',
      now: 100_000
    });

    const transfer = await fixture.economy.transfer({
      guildId: 'guild-1',
      fromUserId: 'user-1',
      fromUsername: '보내는사람',
      toUserId: 'user-2',
      toUsername: '받는사람',
      amount: 300
    });

    const leaderboard = await fixture.economy.getLeaderboard('guild-1');

    assert.equal(transfer.from.balance, 700);
    assert.equal(transfer.to.balance, 300);
    assert.equal(leaderboard.length, 2);
    assert.equal(leaderboard[0].userId, 'user-1');
  } finally {
    await fixture.cleanup();
  }
});

async function createFixture(options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'heeheebot-'));
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
