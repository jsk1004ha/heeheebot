import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createSqliteStore } from '../src/storage/sqlite-store.js';
import { EconomyService } from '../src/systems/economy.js';
import {
  playDice,
  playOddEven,
  playPlayerBlackjack,
  playSlots
} from '../src/systems/casino.js';

test('홀짝은 99~100에서 하우스 엣지로 실패하고 성공 시 1.9배를 지급한다', () => {
  const win = playOddEven({
    choice: '홀',
    bet: 100,
    randomInt: () => 3
  });
  const house = playOddEven({
    choice: '홀',
    bet: 100,
    randomInt: () => 99
  });

  assert.equal(win.win, true);
  assert.equal(win.payout, 190);
  assert.equal(house.win, false);
  assert.equal(house.payout, 0);
});

test('주사위와 슬롯 결과를 계산한다', () => {
  const dice = playDice({
    choice: '높음',
    bet: 100,
    randomInt: () => 5
  });
  const slot = playSlots({
    bet: 100,
    randomInt: createSequenceRandom([6, 6, 6])
  });

  assert.equal(dice.win, true);
  assert.equal(dice.payout, 200);
  assert.deepEqual(slot.reels, ['7️⃣', '7️⃣', '7️⃣']);
  assert.equal(slot.payout, 2000);
});

test('베팅 정산은 잔액 부족을 막고 지급액만큼 잔액을 갱신한다', async () => {
  const fixture = await createFixture({ dailyReward: 1000 });

  try {
    await fixture.economy.claimDaily({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '도박러',
      now: 1000
    });

    const settlement = await fixture.economy.settleWager({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '도박러',
      bet: 100,
      payout: 190
    });

    assert.equal(settlement.profit, 90);
    assert.equal(settlement.profile.balance, 1090);

    await assert.rejects(
      () => fixture.economy.settleWager({
        guildId: 'guild-1',
        userId: 'user-1',
        username: '도박러',
        bet: 2000,
        payout: 0
      }),
      /잔액이 부족합니다/
    );
  } finally {
    await fixture.cleanup();
  }
});

test('유저 블랙잭 팟은 양쪽 잔액을 검사하고 승자가 전부 가져간다', async () => {
  const fixture = await createFixture({ dailyReward: 1000 });

  try {
    await fixture.economy.claimDaily({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '도전자',
      now: 1000
    });
    await fixture.economy.claimDaily({
      guildId: 'guild-1',
      userId: 'user-2',
      username: '상대',
      now: 1000
    });

    const result = await fixture.economy.settlePlayerPot({
      guildId: 'guild-1',
      challenger: { userId: 'user-1', username: '도전자' },
      opponent: { userId: 'user-2', username: '상대' },
      bet: 300,
      winnerUserId: 'user-2'
    });

    assert.equal(result.pot, 600);
    assert.equal(result.winner.userId, 'user-2');
    assert.equal(result.challenger.balance, 700);
    assert.equal(result.opponent.balance, 1300);
  } finally {
    await fixture.cleanup();
  }
});

test('유저 블랙잭 판정은 무승부도 표현할 수 있다', () => {
  const result = playPlayerBlackjack({
    randomInt: createSequenceRandom([9, 9, 9, 9])
  });

  assert.equal(result.challengerValue, 20);
  assert.equal(result.opponentValue, 20);
  assert.equal(result.winner, null);
});

function createSequenceRandom(values) {
  let index = 0;
  return () => values[index++ % values.length];
}

async function createFixture(options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'heeheebot-casino-'));
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
