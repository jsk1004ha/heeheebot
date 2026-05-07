import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { getCasinoCommandPayloads } from '../src/commands/casino.js';
import { createSqliteStore } from '../src/storage/sqlite-store.js';
import { EconomyService } from '../src/systems/economy.js';
import {
  createBlackjackRound,
  createPlayerBlackjackRound,
  hitBlackjackRound,
  hitPlayerBlackjackRound,
  parseKenoNumbers,
  playBaccarat,
  playCraps,
  playDice,
  playKeno,
  playOddEven,
  playPlayerBlackjack,
  playRoulette,
  playSicBo,
  standBlackjackRound,
  standPlayerBlackjackRound,
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

  const loweredProbabilitySlot = playSlots({
    bet: 100,
    randomInt: createSequenceRandom([7, 0, 1])
  });

  assert.deepEqual(loweredProbabilitySlot.reels, ['🍀', '🍒', '🍋']);
  assert.equal(loweredProbabilitySlot.payout, 0);
});

test('슬롯 기대 지급률은 100% 미만이다', () => {
  const bet = 100;
  const symbolCount = 10;
  let totalPayout = 0;

  for (let first = 0; first < symbolCount; first += 1) {
    for (let second = 0; second < symbolCount; second += 1) {
      for (let third = 0; third < symbolCount; third += 1) {
        totalPayout += playSlots({
          bet,
          randomInt: createSequenceRandom([first, second, third])
        }).payout;
      }
    }
  }

  const averagePayout = totalPayout / symbolCount ** 3;

  assert.equal(averagePayout, 92);
  assert.ok(averagePayout < bet);
});

test('카지노 명령 payload는 다양한 게임을 등록한다', () => {
  const commandNames = getCasinoCommandPayloads().map((command) => command.name);

  assert.deepEqual(commandNames, [
    '홀짝',
    '주사위',
    '슬롯',
    '블랙잭',
    '룰렛',
    '바카라',
    '크랩스',
    '시크보',
    '키노'
  ]);
});

test('룰렛, 바카라, 크랩스, 시크보, 키노 결과를 계산한다', () => {
  const roulette = playRoulette({
    choice: 'red',
    bet: 100,
    randomInt: () => 3
  });
  const baccarat = playBaccarat({
    choice: 'player',
    bet: 100,
    randomInt: createSequenceRandom([6, 1, 1, 1])
  });
  const craps = playCraps({
    choice: 'pass',
    bet: 100,
    randomInt: createSequenceRandom([3, 5, 4, 5, 3, 5])
  });
  const sicBo = playSicBo({
    choice: 'big',
    bet: 100,
    randomInt: createSequenceRandom([4, 4, 3])
  });
  const keno = playKeno({
    numbers: '1 2 3',
    bet: 100,
    randomInt: (min) => min
  });

  assert.equal(roulette.roll, 3);
  assert.equal(roulette.color, 'red');
  assert.equal(roulette.payout, 200);
  assert.equal(baccarat.result, 'player');
  assert.equal(baccarat.payout, 200);
  assert.equal(craps.point, 8);
  assert.equal(craps.win, true);
  assert.equal(craps.payout, 200);
  assert.equal(sicBo.total, 11);
  assert.equal(sicBo.payout, 200);
  assert.deepEqual(parseKenoNumbers('3, 1, 2'), [1, 2, 3]);
  assert.deepEqual(keno.hits, [1, 2, 3]);
  assert.equal(keno.payout, 4500);
});

test('수동 블랙잭은 히트/스탠드 선택으로 정산된다', () => {
  const bustRound = createBlackjackRound({
    bet: 100,
    randomInt: createSequenceRandom([9, 7, 8, 6])
  });
  const bust = hitBlackjackRound(bustRound, {
    randomInt: () => 12
  });
  const standRound = createBlackjackRound({
    bet: 100,
    randomInt: createSequenceRandom([9, 7, 8, 6])
  });
  const push = standBlackjackRound(standRound, {
    randomInt: () => 1
  });

  assert.equal(bust.status, 'settled');
  assert.equal(bust.playerValue, 28);
  assert.equal(bust.result, 'dealer');
  assert.equal(bust.payout, 0);
  assert.equal(push.status, 'settled');
  assert.equal(push.result, 'push');
  assert.equal(push.payout, 100);
});

test('유저 블랙잭도 각자 히트/스탠드로 진행한다', () => {
  const round = createPlayerBlackjackRound({
    bet: 100,
    randomInt: createSequenceRandom([9, 7, 8, 6])
  });
  const challengerStands = standPlayerBlackjackRound(round, 'challenger');
  const opponentBusts = hitPlayerBlackjackRound(challengerStands, 'opponent', {
    randomInt: () => 12
  });

  assert.equal(round.currentTurn, 'challenger');
  assert.equal(challengerStands.currentTurn, 'opponent');
  assert.equal(opponentBusts.status, 'settled');
  assert.equal(opponentBusts.opponentValue, 26);
  assert.equal(opponentBusts.winner, 'challenger');
});

test('베팅 정산은 잔액 부족을 막고 지급액만큼 잔액을 갱신한다', async () => {
  const fixture = await createFixture({ dailyReward: 1000, dailyXpReward: 0 });

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

test('수동 게임용 예약 베팅은 먼저 차감한 뒤 정산 또는 환불한다', async () => {
  const fixture = await createFixture({ dailyReward: 1000, dailyXpReward: 0 });

  try {
    await fixture.economy.claimDaily({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '도박러',
      now: 1000
    });

    const reserved = await fixture.economy.reserveWager({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '도박러',
      bet: 300
    });
    const resolved = await fixture.economy.resolveReservedWager({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '도박러',
      bet: 300,
      payout: 450
    });
    const secondReserve = await fixture.economy.reserveWager({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '도박러',
      bet: 200
    });
    const refunded = await fixture.economy.refundReservedWager({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '도박러',
      bet: 200
    });

    assert.equal(reserved.profile.balance, 700);
    assert.equal(resolved.profit, 150);
    assert.equal(resolved.profile.balance, 1150);
    assert.equal(secondReserve.profile.balance, 950);
    assert.equal(refunded.profit, 0);
    assert.equal(refunded.profile.balance, 1150);
  } finally {
    await fixture.cleanup();
  }
});

test('유저 블랙잭 팟은 양쪽 잔액을 검사하고 승자가 전부 가져간다', async () => {
  const fixture = await createFixture({ dailyReward: 1000, dailyXpReward: 0 });

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

test('수동 유저 블랙잭 팟은 예약 후 승자 정산과 무승부 환불을 지원한다', async () => {
  const fixture = await createFixture({ dailyReward: 1000, dailyXpReward: 0 });

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

    const reserved = await fixture.economy.reservePlayerPot({
      guildId: 'guild-1',
      challenger: { userId: 'user-1', username: '도전자' },
      opponent: { userId: 'user-2', username: '상대' },
      bet: 300
    });
    const won = await fixture.economy.resolveReservedPlayerPot({
      guildId: 'guild-1',
      challenger: { userId: 'user-1', username: '도전자' },
      opponent: { userId: 'user-2', username: '상대' },
      bet: 300,
      winnerUserId: 'user-1'
    });
    await fixture.economy.reservePlayerPot({
      guildId: 'guild-1',
      challenger: { userId: 'user-1', username: '도전자' },
      opponent: { userId: 'user-2', username: '상대' },
      bet: 100
    });
    const pushed = await fixture.economy.resolveReservedPlayerPot({
      guildId: 'guild-1',
      challenger: { userId: 'user-1', username: '도전자' },
      opponent: { userId: 'user-2', username: '상대' },
      bet: 100,
      winnerUserId: null
    });

    assert.equal(reserved.challenger.balance, 700);
    assert.equal(reserved.opponent.balance, 700);
    assert.equal(won.winner.userId, 'user-1');
    assert.equal(won.challenger.balance, 1300);
    assert.equal(won.opponent.balance, 700);
    assert.equal(pushed.challenger.balance, 1300);
    assert.equal(pushed.opponent.balance, 700);
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
