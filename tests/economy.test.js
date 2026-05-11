import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
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

test('환전은 통합 골드 체계에서 잔액을 이동하지 않는 호환 안내만 반환한다', async () => {
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

    const result = await fixture.economy.exchangeWallet({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '환전자',
      fromCurrency: 'casino',
      toCurrency: 'rpg',
      amount: 300
    });

    assert.equal(result.unified, true);
    assert.equal(result.spent, 300);
    assert.equal(result.received, 300);
    assert.equal(result.fee, 0);
    assert.equal(result.cashOutRateBps, 10_000);
    assert.equal(result.cashInRateBps, 10_000);
    assert.equal(result.profile.balance, 1_000);
    assert.deepEqual(result.profile.wallets, {
      casinoChips: 0,
      rpgGold: 0,
      swordCoins: 0,
      stockCash: 0
    });
  } finally {
    await fixture.cleanup();
  }
});

test('기존 전용 지갑은 컨텐츠별 출금 보정률로 골드에 1회 정산된다', async () => {
  const fixture = await createFixture();

  try {
    await fixture.store.update((data) => {
      data.guilds['guild-1'] = {
        users: {
          'user-1': {
            userId: 'user-1',
            username: '밸런서',
            level: 1,
            xp: 0,
            totalXp: 0,
            balance: 1_000,
            wallets: {
              casinoChips: 100,
              rpgGold: 1_000,
              swordCoins: 200,
              stockCash: 100
            }
          }
        }
      };
    });

    const first = await fixture.economy.getProfile('guild-1', 'user-1', '밸런서');
    const second = await fixture.economy.getProfile('guild-1', 'user-1', '밸런서');

    assert.equal(first.balance, 1_585);
    assert.equal(first.currencyMigration.convertedGold, 585);
    assert.deepEqual(first.wallets, {
      casinoChips: 0,
      rpgGold: 0,
      swordCoins: 0,
      stockCash: 0
    });
    assert.equal(second.balance, 1_585);
    assert.equal(second.currencyMigration.convertedGold, 585);
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
    assert.equal(profile.rpg.level, 1);
    assert.equal(profile.rpg.totalXp, 0);
    assert.equal(profile.rpg.currentArea, 'forest');
    assert.deepEqual(profile.rpg.unlockedAreas, ['forest', 'starfall_crater']);
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

test('단일 레거시 계정은 다른 서버에서도 같은 통합 계정으로 자동 연동된다', async () => {
  const fixture = await createFixture();

  try {
    await fixture.store.update((data) => {
      data.guilds['guild-1'] = {
        users: {
          'user-1': {
            userId: 'user-1',
            username: '연동유저',
            level: 4,
            xp: 10,
            totalXp: 674,
            balance: 777
          }
        }
      };
    });

    const profile = await fixture.economy.getProfile('guild-2', 'user-1', '연동유저');
    const leaderboard = await fixture.economy.getLeaderboard('guild-1');
    const data = await fixture.store.load();

    assert.equal(profile.balance, 777);
    assert.equal(profile.level, 4);
    assert.equal(leaderboard[0].userId, 'user-1');
    assert.equal(data.accounts.users['user-1'].balance, 777);
    assert.equal(data.guilds['guild-1'].users?.['user-1'], undefined);
    assert.equal(data.guilds['guild-2'].users?.['user-1'], undefined);
    assert.ok(data.accounts.guilds['guild-1'].users['user-1']);
    assert.ok(data.accounts.guilds['guild-2'].users['user-1']);
  } finally {
    await fixture.cleanup();
  }
});

test('여러 서버에 같은 유저 레거시 계정이 있으면 선택 후 나머지를 삭제한다', async () => {
  const fixture = await createFixture();

  try {
    await fixture.store.update((data) => {
      data.guilds['guild-1'] = {
        users: {
          'user-1': {
            userId: 'user-1',
            username: '첫계정',
            level: 2,
            xp: 0,
            totalXp: 100,
            balance: 100
          }
        }
      };
      data.guilds['guild-2'] = {
        users: {
          'user-1': {
            userId: 'user-1',
            username: '둘째계정',
            level: 5,
            xp: 0,
            totalXp: 1764,
            balance: 900
          }
        }
      };
    });

    const summary = await fixture.economy.getAccountLinkSummary({
      guildId: 'guild-3',
      userId: 'user-1',
      username: '선택자'
    });

    assert.equal(summary.required, true);
    assert.deepEqual(summary.candidates.map((candidate) => candidate.id), ['guild:guild-1', 'guild:guild-2']);
    await assert.rejects(
      () => fixture.economy.getProfile('guild-3', 'user-1', '선택자'),
      /여러 서버/
    );

    const resolved = await fixture.economy.resolveAccountLink({
      guildId: 'guild-3',
      userId: 'user-1',
      username: '선택자',
      selectedAccountId: 'guild:guild-2',
      now: 1234
    });
    const profile = await fixture.economy.getProfile('guild-1', 'user-1', '선택자');
    const data = await fixture.store.load();

    assert.equal(resolved.deletedAccountCount, 1);
    assert.equal(profile.balance, 900);
    assert.equal(profile.level, 5);
    assert.equal(data.accounts.users['user-1'].balance, 900);
    assert.equal(data.guilds['guild-1'].users?.['user-1'], undefined);
    assert.equal(data.guilds['guild-2'].users?.['user-1'], undefined);
    assert.ok(data.accounts.guilds['guild-1'].users['user-1']);
    assert.ok(data.accounts.guilds['guild-2'].users['user-1']);
    assert.ok(data.accounts.guilds['guild-3'].users['user-1']);
  } finally {
    await fixture.cleanup();
  }
});

test('계정연동은 서버별 낚시와 주식 기록도 선택한 서버 기록으로 통합한다', async () => {
  const fixture = await createFixture();

  try {
    await fixture.store.update((data) => {
      data.guilds['guild-1'] = {
        fishing: {
          users: {
            'user-1': {
              userId: 'user-1',
              username: '첫낚시',
              rod: { level: 3 },
              inventory: { carp: 1 },
              collection: { carp: 1 },
              stats: { totalCatches: 3 }
            }
          }
        },
        stocks: {
          users: {
            'user-1': {
              userId: 'user-1',
              username: '첫주식',
              holdings: { monkeynix: { quantity: 2, averageCost: 100 } },
              tradeCount: 2
            }
          }
        }
      };
      data.guilds['guild-2'] = {
        fishing: {
          users: {
            'user-1': {
              userId: 'user-1',
              username: '둘째낚시',
              rod: { level: 9 },
              inventory: { tuna: 4 },
              collection: { tuna: 1 },
              stats: { totalCatches: 9 }
            }
          }
        },
        stocks: {
          users: {
            'user-1': {
              userId: 'user-1',
              username: '둘째주식',
              holdings: { heejin_electronics: { quantity: 7, averageCost: 500 } },
              tradeCount: 7
            }
          }
        }
      };
    });

    const summary = await fixture.economy.getAccountLinkSummary({
      guildId: 'guild-3',
      userId: 'user-1',
      username: '선택자'
    });

    assert.equal(summary.required, true);
    assert.deepEqual(summary.candidates.map((candidate) => candidate.id), ['guild:guild-1', 'guild:guild-2']);

    await fixture.economy.resolveAccountLink({
      guildId: 'guild-3',
      userId: 'user-1',
      username: '선택자',
      selectedAccountId: 'guild:guild-2',
      now: 1234
    });
    const data = await fixture.store.load();

    assert.equal(data.fishing.users['user-1'].rod.level, 9);
    assert.equal(data.fishing.users['user-1'].inventory.tuna, 4);
    assert.equal(data.stocks.users['user-1'].holdings.heejin_electronics.quantity, 7);
    assert.equal(data.stocks.users['user-1'].tradeCount, 7);
    assert.equal(data.guilds['guild-1'].fishing.users['user-1'], undefined);
    assert.equal(data.guilds['guild-2'].fishing.users['user-1'], undefined);
    assert.equal(data.guilds['guild-1'].stocks.users['user-1'], undefined);
    assert.equal(data.guilds['guild-2'].stocks.users['user-1'], undefined);
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
    randomInt: () => 9
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
    assert.equal(first.xpGained, 9);
    assert.equal(first.firstMessageBonusXp, 80);
    assert.equal(first.totalXpGained, 89);
    assert.equal(first.moneyGained, 0);
    assert.equal(first.profile.xp, 89);
    assert.equal(first.profile.balance, 0);

    assert.equal(second.awarded, true);
    assert.equal(second.firstMessageBonusXp, 0);
    assert.equal(second.totalXpGained, 9);
    assert.equal(second.profile.xp, 98);
    assert.equal(second.profile.balance, 0);
  } finally {
    await fixture.cleanup();
  }
});

test('기존 계정의 메시지 보상은 계정 fast-path row로 저장된다', async () => {
  const fixture = await createFixture({
    messageXpMin: 10,
    messageXpMax: 10,
    firstMessageXpBonus: 0,
    randomInt: () => 10
  });
  const originalNow = Date.now;

  try {
    Date.now = () => 1_000;
    await fixture.economy.getProfile('guild-1', 'user-1', '테스터');

    Date.now = () => 2_000;
    const result = await fixture.economy.rewardMessage({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '테스터',
      now: 2_000
    });

    assert.equal(result.awarded, true);
    assert.equal(result.profile.totalXp, 10);

    const inspector = new DatabaseSync(fixture.databasePath);
    try {
      assert.equal(getUpdatedAt(inspector, 'bot_account_profiles', 'user_id = ?', ['user-1']), 2_000);
      assert.equal(getUpdatedAt(inspector, 'bot_root_state', 'id = ?', [1]), 1_000);
      assert.equal(getAccountBalance(inspector, 'user-1'), 0);
    } finally {
      inspector.close();
    }
  } finally {
    Date.now = originalNow;
    await fixture.cleanup();
  }
});

test('명령어 사용도 메인 프로필 XP를 조금 지급한다', async () => {
  const fixture = await createFixture({
    commandXpMin: 4,
    commandXpMax: 4,
    randomInt: (min) => min
  });

  try {
    const result = await fixture.economy.rewardCommand({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '테스터',
      commandName: '프로필',
      now: 100_000
    });

    assert.equal(result.awarded, true);
    assert.equal(result.commandName, '프로필');
    assert.equal(result.xpGained, 4);
    assert.equal(result.totalXpGained, 4);
    assert.equal(result.profile.totalXp, 4);
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

test('출석 보상은 100 XP와 랜덤 100~1000 골드를 하루 한 번만 지급한다', async () => {
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

test('출석 골드 보상은 남은 파산채무를 자동 상환한다', async () => {
  const fixture = await createFixture({
    dailyCoinReward: 1_000,
    dailyXpReward: 0,
    levelBaseXp: 10_000
  });

  try {
    await fixture.store.update((data) => {
      data.guilds['guild-1'] = {
        users: {
          'user-1': {
            userId: 'user-1',
            username: '테스터',
            level: 1,
            xp: 0,
            totalXp: 0,
            balance: 0,
            stockBankruptcy: { debt: 1_000, paid: 0, count: 1, lastAt: 1 }
          }
        }
      };
    });

    const result = await fixture.economy.claimDaily({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '테스터',
      now: 1_000
    });

    assert.equal(result.coinReward, 1_000);
    assert.equal(result.profile.balance, 750);

    await fixture.store.update((data) => {
      const profile = data.accounts?.users?.['user-1'] ?? data.guilds['guild-1'].users['user-1'];
      assert.equal(profile.stockBankruptcy.debt, 750);
      assert.equal(profile.stockBankruptcy.paid, 250);
    });
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
    assert.equal(rpg.profile.totalXp, 80);
    assert.equal(rpg.profile.rpg.totalXp, 150);
  } finally {
    await fixture.cleanup();
  }
});

test('라이어게임 결과 보상은 승리 진영에 따라 시민과 라이어를 다르게 지급한다', async () => {
  const fixture = await createFixture({
    liarGameCitizenWinXp: 90,
    liarGameCitizenWinMoney: 700,
    liarGameLiarWinXp: 220,
    liarGameLiarWinMoney: 2000,
    liarGameCitizenLoseXp: 15,
    liarGameLiarLoseXp: 40,
    levelBaseXp: 1000
  });
  const participants = [
    { userId: 'citizen-1', username: '시민1' },
    { userId: 'citizen-2', username: '시민2' },
    { userId: 'liar-1', username: '라이어' }
  ];

  try {
    const citizenWin = await fixture.economy.awardLiarGameResults({
      guildId: 'guild-1',
      participants,
      liarUserId: 'liar-1',
      winner: 'citizens'
    });

    assert.equal(citizenWin.winner, 'citizens');
    assert.deepEqual(citizenWin.participants.map((result) => result.xpGained), [90, 90, 40]);
    assert.deepEqual(citizenWin.participants.map((result) => result.moneyGained), [700, 700, 0]);

    const liarWin = await fixture.economy.awardLiarGameResults({
      guildId: 'guild-1',
      participants,
      liarUserId: 'liar-1',
      winner: 'liar'
    });

    assert.equal(liarWin.winner, 'liar');
    assert.deepEqual(liarWin.participants.map((result) => result.xpGained), [15, 15, 220]);
    assert.deepEqual(liarWin.participants.map((result) => result.moneyGained), [0, 0, 2000]);
    assert.equal(liarWin.liar.profile.balance, 2000);
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

function getUpdatedAt(database, tableName, whereClause, params) {
  return database
    .prepare(`SELECT updated_at FROM ${tableName} WHERE ${whereClause}`)
    .get(...params)
    .updated_at;
}

function getAccountBalance(database, userId) {
  return database
    .prepare('SELECT balance FROM bot_account_profiles WHERE user_id = ?')
    .get(userId)
    .balance;
}

async function createFixture(options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'heeheebot-'));
  const databasePath = join(directory, 'profiles.sqlite');
  const store = createSqliteStore(databasePath);
  const economy = new EconomyService(store, options);

  return {
    economy,
    store,
    databasePath,
    async cleanup() {
      store.close();
      await rm(directory, {
        recursive: true,
        force: true
      });
    }
  };
}
