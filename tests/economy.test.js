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
    assert.deepEqual(profile.wallets, {
      casinoChips: 0,
      rpgGold: 0,
      swordCoins: 0,
      stockCash: 0
    });
    assert.equal(profile.dailyStreak, 0);
    assert.equal(profile.username, '테스터');
  } finally {
    await fixture.cleanup();
  }
});

test('환전은 메인 코인과 컨텐츠별 지갑을 분리하고 출금 손실을 적용한다', async () => {
  const fixture = await createFixture();

  try {
    await fixture.store.update((data) => {
      data.guilds['guild-1'] = {
        users: {
          'user-1': {
            userId: 'user-1',
            username: '환전자',
            level: 1,
            xp: 0,
            totalXp: 0,
            balance: 1_000
          }
        }
      };
    });

    const deposit = await fixture.economy.exchangeWallet({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '환전자',
      fromCurrency: 'main',
      toCurrency: 'casino',
      amount: 300
    });
    const cashOut = await fixture.economy.exchangeWallet({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '환전자',
      fromCurrency: 'casino',
      toCurrency: 'rpg',
      amount: 100
    });

    assert.equal(deposit.spent, 300);
    assert.equal(deposit.received, 300);
    assert.equal(deposit.profile.balance, 700);
    assert.equal(deposit.profile.wallets.casinoChips, 300);
    assert.equal(cashOut.received, 90);
    assert.equal(cashOut.fee, 10);
    assert.equal(cashOut.profile.balance, 700);
    assert.equal(cashOut.profile.wallets.casinoChips, 200);
    assert.equal(cashOut.profile.wallets.rpgGold, 90);
  } finally {
    await fixture.cleanup();
  }
});

test('기존/마이그레이션 프로필의 누락된 레벨 필드를 안전하게 보정한다', async () => {
  const fixture = await createFixture({
    messageCooldownMs: 0,
    firstMessageXpBonus: 0,
    randomInt: () => 10
  });

  try {
    await fixture.store.update((data) => {
      data.guilds['guild-1'] = {
        users: {
          'user-1': {
            userId: 'user-1',
            username: '기존유저',
            level: 3
          }
        }
      };
    });

    const profile = await fixture.economy.getProfile('guild-1', 'user-1', '기존유저');
    const reward = await fixture.economy.rewardMessage({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '기존유저',
      now: 100_000
    });

    assert.equal(profile.level, 3);
    assert.equal(profile.xp, 0);
    assert.equal(profile.totalXp, 382);
    assert.equal(profile.balance, 0);
    assert.equal(profile.lastMessageRewardAt, 0);
    assert.equal(profile.dailyStreak, 0);
    assert.equal(profile.rpg.characterClass, 'novice');
    assert.equal(profile.rpg.characterGender, 'male');
    assert.equal(profile.rpg.currentArea, 'forest');
    assert.deepEqual(profile.rpg.unlockedAreas, ['forest', 'cave', 'marsh']);
    assert.deepEqual(profile.rpg.discoveredMonsters, {});
    assert.equal(profile.rpg.battles, 0);
    assert.equal(profile.rpg.wins, 0);
    assert.equal(profile.rpg.losses, 0);
    assert.equal(profile.rpg.lastBattleAt, 0);
    assert.equal(reward.profile.level, 3);
    assert.equal(reward.profile.xp, 10);
    assert.equal(reward.profile.totalXp, 392);
  } finally {
    await fixture.cleanup();
  }
});

test('랭킹도 기존 프로필의 누락/초과 경험치를 보정해서 표시한다', async () => {
  const fixture = await createFixture();

  try {
    await fixture.store.update((data) => {
      data.guilds['guild-1'] = {
        users: {
          'user-1': {
            userId: 'user-1',
            username: '레거시고렙',
            level: 3
          },
          'user-2': {
            userId: 'user-2',
            username: '초과경험치',
            level: 1,
            xp: 150,
            totalXp: 0,
            balance: '25'
          }
        }
      };
    });

    const leaderboard = await fixture.economy.getLeaderboard('guild-1');
    const overflowProfile = leaderboard.find((profile) => profile.userId === 'user-2');

    assert.equal(leaderboard.length, 2);
    assert.equal(leaderboard[0].userId, 'user-1');
    assert.equal(leaderboard[0].totalXp, 382);
    assert.ok(overflowProfile);
    assert.equal(overflowProfile.level, 2);
    assert.equal(overflowProfile.xp, 50);
    assert.equal(overflowProfile.totalXp, 150);
    assert.equal(overflowProfile.balance, 25);
  } finally {
    await fixture.cleanup();
  }
});

test('레벨 필요 경험치는 100 × 레벨^1.5 공식을 따른다', async () => {
  const fixture = await createFixture();

  try {
    assert.equal(fixture.economy.xpForNextLevel(1), 100);
    assert.equal(fixture.economy.xpForNextLevel(2), 282);
    assert.equal(fixture.economy.xpForNextLevel(10), 3162);
  } finally {
    await fixture.cleanup();
  }
});

test('메시지 보상은 일반 채팅 XP와 하루 첫 채팅 보너스를 지급한다', async () => {
  const fixture = await createFixture({
    randomInt: () => 10
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
    assert.equal(first.firstMessageBonusXp, 50);
    assert.equal(first.totalXpGained, 60);
    assert.equal(first.moneyGained, 0);
    assert.equal(first.profile.xp, 60);
    assert.equal(first.profile.balance, 0);

    assert.equal(second.awarded, false);
    assert.equal(second.profile.xp, 60);
    assert.equal(second.profile.balance, 0);
  } finally {
    await fixture.cleanup();
  }
});

test('충분한 경험치를 받으면 레벨업 보상을 지급한다', async () => {
  const fixture = await createFixture({
    messageCooldownMs: 0,
    messageXpMin: 120,
    messageXpMax: 120,
    firstMessageXpBonus: 0,
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
    assert.equal(result.profile.balance, 200);
  } finally {
    await fixture.cleanup();
  }
});

test('출석 보상은 100 XP와 랜덤 100~1000 코인을 하루 한 번만 지급한다', async () => {
  const fixture = await createFixture({
    randomInt: (min, max) => {
      assert.equal(min, 100);
      assert.equal(max, 1000);
      return 777;
    }
  });

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
    assert.equal(first.reward, 777);
    assert.equal(first.coinReward, 777);
    assert.equal(first.xpGained, 100);
    assert.equal(first.streak, 1);
    assert.equal(first.profile.level, 2);
    assert.equal(first.profile.xp, 0);
    assert.equal(first.profile.balance, 977);

    assert.equal(second.claimed, false);
    assert.equal(second.profile.balance, 977);
  } finally {
    await fixture.cleanup();
  }
});

test('연속 출석 3일과 5일에는 추가 경험치를 지급한다', async () => {
  const fixture = await createFixture({
    dailyStreakXpBonuses: {
      3: 50,
      5: 100
    }
  });

  try {
    const day = 24 * 60 * 60 * 1000;
    const first = await fixture.economy.claimDaily({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '테스터',
      now: day
    });
    const second = await fixture.economy.claimDaily({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '테스터',
      now: day * 2
    });
    const third = await fixture.economy.claimDaily({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '테스터',
      now: day * 3
    });
    const fourth = await fixture.economy.claimDaily({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '테스터',
      now: day * 4
    });
    const fifth = await fixture.economy.claimDaily({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '테스터',
      now: day * 5
    });

    assert.equal(first.streak, 1);
    assert.equal(second.streak, 2);
    assert.equal(third.streak, 3);
    assert.equal(third.streakBonusXp, 50);
    assert.deepEqual(third.streakBonuses, [{ days: 3, xp: 50 }]);
    assert.equal(fourth.streakBonusXp, 0);
    assert.equal(fifth.streak, 5);
    assert.equal(fifth.streakBonusXp, 100);
    assert.deepEqual(fifth.streakBonuses, [{ days: 5, xp: 100 }]);
  } finally {
    await fixture.cleanup();
  }
});

test('끝말잇기와 RPG 승리 경험치를 지급한다', async () => {
  const fixture = await createFixture({
    randomInt: () => 150
  });

  try {
    const wordChain = await fixture.economy.awardWordChainWin({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '테스터'
    });
    const rpg = await fixture.economy.awardRpgBattleWin({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '테스터'
    });

    assert.equal(wordChain.xpGained, 80);
    assert.equal(rpg.xpGained, 150);
    assert.equal(rpg.profile.totalXp, 230);
  } finally {
    await fixture.cleanup();
  }
});

test('운세 확인 경험치는 한국시간 기준 하루 한 번만 지급한다', async () => {
  const fixture = await createFixture({
    fortuneXpReward: 12
  });

  try {
    const first = await fixture.economy.claimFortuneXp({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '테스터',
      now: 1_000
    });
    const repeated = await fixture.economy.claimFortuneXp({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '테스터',
      now: 2_000
    });
    const nextKoreaDay = await fixture.economy.claimFortuneXp({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '테스터',
      now: 15 * 60 * 60 * 1000 + 1
    });

    assert.equal(first.claimed, true);
    assert.equal(first.xpGained, 12);
    assert.equal(first.profile.totalXp, 12);

    assert.equal(repeated.claimed, false);
    assert.equal(repeated.xpGained, 0);
    assert.equal(repeated.profile.totalXp, 12);

    assert.equal(nextKoreaDay.claimed, true);
    assert.equal(nextKoreaDay.profile.totalXp, 24);
  } finally {
    await fixture.cleanup();
  }
});

test('송금은 잔액을 이동하고 랭킹은 레벨/경험치 순으로 정렬한다', async () => {
  const fixture = await createFixture({
    dailyCoinReward: 1_000,
    dailyXpReward: 0
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
