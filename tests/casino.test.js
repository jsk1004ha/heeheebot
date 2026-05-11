import { MessageFlags } from 'discord.js';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  getCasinoCommandPayloads,
  handleCasinoCommand
} from '../src/commands/casino.js';
import { createSqliteStore } from '../src/storage/sqlite-store.js';
import { EconomyService } from '../src/systems/economy.js';
import {
  cashOutDeadlineRound,
  createBlackjackRound,
  createDeadlineRound,
  createPlayerBlackjackRound,
  createScratchTicket,
  createTimingRound,
  formatEmojiRaceTrack,
  formatScratchPrizeShort,
  getScratchTicketProductStats,
  hitBlackjackRound,
  hitPlayerBlackjackRound,
  getDeadlineBustChanceBps,
  getDeadlineNextReward,
  resolveTimingRound,
  normalizeEmojiRaceChoice,
  parseKenoNumbers,
  playBaccarat,
  playCraps,
  pressDeadlineRound,
  playDice,
  playEmojiRace,
  playHighLow,
  playKeno,
  playLuckySeven,
  playOddEven,
  playPlayerBlackjack,
  playRoulette,
  playSicBo,
  revealScratchTicketSpot,
  SCRATCH_TICKET_PRODUCTS,
  SCRATCH_TICKET_SPOT_COUNT,
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
  assert.equal(dice.payout, 190);
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
    '카지노정보',
    '홀짝',
    '주사위',
    '슬롯',
    '데드라인',
    '타이밍',
    '이모지경마',
    '럭키세븐',
    '하이로우',
    '블랙잭',
    '룰렛',
    '바카라',
    '크랩스',
    '시크보',
    '키노',
    '스크래치복권'
  ]);
});

test('카지노정보 명령은 베팅금 없이 게임 배수와 환급 규칙만 안내한다', async () => {
  const interaction = createChatInputInteraction('카지노정보');
  const handled = await handleCasinoCommand(interaction, null, quietLogger);

  assert.equal(handled, true);
  assert.match(interaction.replied.content, /카지노 게임 정보/);
  assert.match(interaction.replied.content, /주사위.*1\.9배/);
  assert.match(interaction.replied.content, /데드라인.*꽝 확률/);
  assert.match(interaction.replied.content, /타이밍.*5.*20/);
  assert.match(interaction.replied.content, /이모지경마.*2\.7배/);
  assert.match(interaction.replied.content, /키노.*번호 1~5개/);
  assert.match(interaction.replied.content, /스크래치복권.*같은 금액 3개/);
  assert.doesNotMatch(interaction.replied.content, /기대|지급률|RTP|%/);
  assert.match(interaction.replied.content, /실제 현금/);
  assert.match(interaction.replied.content, /골드/);
  assert.equal(interaction.replied.components?.length ?? 0, 0);
});

test('단순 도박 결과만 같은 베팅 재시도 버튼을 제공하고 카지노정보에는 기본 베팅 버튼을 붙이지 않는다', async () => {
  const settled = [];
  const fakeEconomy = {
    async settleWager(payload) {
      settled.push(payload);
      return {
        bet: payload.bet,
        payout: payload.payout,
        profit: payload.payout - payload.bet,
        profile: { balance: 10_000 + payload.payout - payload.bet }
      };
    }
  };
  const slotInteraction = createChatInputInteraction('슬롯', {
    integers: { 돈: 250 }
  });

  assert.equal(await handleCasinoCommand(slotInteraction, fakeEconomy, quietLogger), true);

  assert.equal(settled[0].bet, 250);
  assert.match(slotInteraction.replied.content, /슬롯/);
  const resultButtons = slotInteraction.replied.components[0].components;
  assert.deepEqual(
    resultButtons.map((component) => component.data.label),
    ['다시 슬롯', '카지노정보']
  );
  assert.match(resultButtons[0].data.custom_id, /casino_quick:slots:250:-:user-1/);

  const replayButton = createCasinoButtonInteraction({
    customId: resultButtons[0].data.custom_id,
    userId: 'user-1'
  });
  assert.equal(await handleCasinoCommand(replayButton, fakeEconomy, quietLogger), true);
  assert.equal(settled[1].bet, 250);
  assert.equal(settled[1].userId, 'user-1');
  assert.equal(replayButton.updated, undefined);
  assert.match(replayButton.replied.content, /슬롯/);

  const otherUserButton = createCasinoButtonInteraction({
    customId: resultButtons[0].data.custom_id,
    userId: 'user-2'
  });
  assert.equal(await handleCasinoCommand(otherUserButton, fakeEconomy, quietLogger), true);
  assert.equal(otherUserButton.replied.flags, MessageFlags.Ephemeral);
  assert.match(otherUserButton.replied.content, /명령어를 실행한 유저만/);
});


test('데드라인은 안전 누름마다 골드 보상과 꽝 확률이 커지고 수령할 수 있다', () => {
  const round = createDeadlineRound({ bet: 100 });
  const firstSafe = pressDeadlineRound(round, {
    randomInt: () => 1001
  });
  const secondSafe = pressDeadlineRound(firstSafe, {
    randomInt: () => 1751
  });
  const cashedOut = cashOutDeadlineRound(secondSafe);
  const busted = pressDeadlineRound(secondSafe, {
    randomInt: () => 1
  });

  assert.equal(round.reward, 0);
  assert.equal(round.nextReward, 100);
  assert.equal(getDeadlineNextReward(100, 1), 150);
  assert.equal(getDeadlineBustChanceBps(0), 1000);
  assert.equal(getDeadlineBustChanceBps(1), 1750);
  assert.equal(firstSafe.status, 'pressing');
  assert.equal(firstSafe.reward, 100);
  assert.equal(firstSafe.nextReward, 150);
  assert.equal(firstSafe.bustChanceBps, 1750);
  assert.equal(secondSafe.reward, 250);
  assert.equal(cashedOut.status, 'cashed_out');
  assert.equal(cashedOut.payout, 350);
  assert.equal(busted.status, 'busted');
  assert.equal(busted.lostReward, 250);
  assert.equal(busted.payout, 0);
});

test('데드라인 명령은 골드를 예약하고 버튼 안전 누름 후 수령 정산한다', async () => {
  const calls = [];
  const fakeEconomy = {
    async reserveWager(payload) {
      calls.push(['reserve', payload]);
      return {
        bet: payload.bet,
        profile: { balance: 900 }
      };
    },
    async resolveReservedWager(payload) {
      calls.push(['resolve', payload]);
      return {
        bet: payload.bet,
        payout: payload.payout,
        profit: payload.payout - payload.bet,
        profile: { balance: 900 + payload.payout }
      };
    },
    async refundReservedWager(payload) {
      calls.push(['refund', payload]);
      return {
        bet: payload.bet,
        payout: payload.bet,
        profit: 0,
        profile: { balance: 1000 }
      };
    }
  };
  const interaction = createChatInputInteraction('데드라인', {
    integers: { 돈: 100 }
  });

  assert.equal(await handleCasinoCommand(interaction, fakeEconomy, quietLogger), true);
  assert.deepEqual(calls.map(([type]) => type), ['reserve']);
  assert.match(interaction.replied.content, /데드라인 버튼/);
  assert.match(interaction.replied.content, /100골드/);

  const pressButtonId = interaction.replied.components[0].components[0].data.custom_id;
  const press = createCasinoButtonInteraction({ customId: pressButtonId });
  assert.equal(await handleCasinoCommand(press, fakeEconomy, quietLogger, {
    randomInt: () => 1001
  }), true);
  assert.equal(calls.length, 1);
  assert.match(press.updated.content, /방금 안전했습니다: \*\*\+100골드\*\*/);
  assert.equal(press.updated.components[0].components[1].data.disabled, false);

  const cashOutButtonId = press.updated.components[0].components[1].data.custom_id;
  const cashOut = createCasinoButtonInteraction({ customId: cashOutButtonId });
  assert.equal(await handleCasinoCommand(cashOut, fakeEconomy, quietLogger), true);
  assert.deepEqual(calls.map(([type]) => type), ['reserve', 'resolve']);
  assert.equal(calls[1][1].payout, 200);
  assert.match(cashOut.updated.content, /데드라인 수령/);
  assert.match(cashOut.updated.content, /지급: 200골드/);
});

test('데드라인 버튼은 시작한 유저만 누를 수 있고 꽝이면 예약 베팅만 잃는다', async () => {
  const calls = [];
  const fakeEconomy = {
    async reserveWager(payload) {
      calls.push(['reserve', payload]);
      return { bet: payload.bet, profile: { balance: 900 } };
    },
    async resolveReservedWager(payload) {
      calls.push(['resolve', payload]);
      return {
        bet: payload.bet,
        payout: payload.payout,
        profit: payload.payout - payload.bet,
        profile: { balance: 900 + payload.payout }
      };
    },
    async refundReservedWager(payload) {
      calls.push(['refund', payload]);
      return { bet: payload.bet, payout: payload.bet, profit: 0, profile: { balance: 1000 } };
    }
  };
  const interaction = createChatInputInteraction('데드라인', {
    integers: { 돈: 100 }
  });

  assert.equal(await handleCasinoCommand(interaction, fakeEconomy, quietLogger), true);
  const pressButtonId = interaction.replied.components[0].components[0].data.custom_id;

  const otherUserPress = createCasinoButtonInteraction({
    customId: pressButtonId,
    userId: 'user-2'
  });
  assert.equal(await handleCasinoCommand(otherUserPress, fakeEconomy, quietLogger), true);
  assert.equal(otherUserPress.replied.flags, MessageFlags.Ephemeral);
  assert.match(otherUserPress.replied.content, /시작한 유저만/);

  const bust = createCasinoButtonInteraction({ customId: pressButtonId });
  assert.equal(await handleCasinoCommand(bust, fakeEconomy, quietLogger, {
    randomInt: () => 1
  }), true);
  assert.deepEqual(calls.map(([type]) => type), ['reserve', 'resolve']);
  assert.equal(calls[1][1].payout, 0);
  assert.match(bust.updated.content, /데드라인 폭발/);
  assert.match(bust.updated.content, /지급: 0골드/);
});


test('타이밍은 목표 초와 실제 기록의 오차로 배율을 결정한다', () => {
  const round = createTimingRound({
    bet: 100,
    randomInt: () => 10,
    nowMs: () => 1000
  });
  const nearPerfect = resolveTimingRound(round, {
    nowMs: () => 10999.9
  });
  const halfSecond = resolveTimingRound(createTimingRound({
    bet: 100,
    randomInt: () => 10,
    nowMs: () => 1000
  }), {
    nowMs: () => 11500
  });
  const miss = resolveTimingRound(createTimingRound({
    bet: 100,
    randomInt: () => 10,
    nowMs: () => 1000
  }), {
    nowMs: () => 11600
  });

  assert.equal(round.targetSeconds, 10);
  assert.equal(nearPerfect.status, 'settled');
  assert.equal(nearPerfect.elapsedSeconds.toFixed(4), '9.9999');
  assert.equal(nearPerfect.differenceSeconds.toFixed(4), '0.0001');
  assert.equal(nearPerfect.multiplier, 5);
  assert.equal(nearPerfect.payout, 500);
  assert.equal(halfSecond.multiplier, 1.3);
  assert.equal(halfSecond.payout, 130);
  assert.equal(miss.multiplier, 0);
  assert.equal(miss.payout, 0);
});

test('타이밍 명령은 골드를 예약하고 버튼 입력 기록을 4자리 초로 정산한다', async () => {
  const calls = [];
  const fakeEconomy = {
    async reserveWager(payload) {
      calls.push(['reserve', payload]);
      return { bet: payload.bet, profile: { balance: 900 } };
    },
    async resolveReservedWager(payload) {
      calls.push(['resolve', payload]);
      return {
        bet: payload.bet,
        payout: payload.payout,
        profit: payload.payout - payload.bet,
        profile: { balance: 900 + payload.payout }
      };
    },
    async refundReservedWager(payload) {
      calls.push(['refund', payload]);
      return { bet: payload.bet, payout: payload.bet, profit: 0, profile: { balance: 1000 } };
    }
  };
  const interaction = createChatInputInteraction('타이밍', {
    integers: { 돈: 100 }
  });

  assert.equal(await handleCasinoCommand(interaction, fakeEconomy, quietLogger, {
    randomInt: () => 10,
    nowMs: () => 1000
  }), true);
  assert.deepEqual(calls.map(([type]) => type), ['reserve']);
  assert.match(interaction.replied.content, /타이밍 게임/);
  assert.match(interaction.replied.content, /목표: \*\*10\.0000초\*\*/);
  assert.match(interaction.replied.content, /0\.5초 이하 1\.3배/);

  const buttonId = interaction.replied.components[0].components[0].data.custom_id;
  const otherUserPress = createCasinoButtonInteraction({
    customId: buttonId,
    userId: 'user-2'
  });
  assert.equal(await handleCasinoCommand(otherUserPress, fakeEconomy, quietLogger), true);
  assert.equal(otherUserPress.replied.flags, MessageFlags.Ephemeral);
  assert.match(otherUserPress.replied.content, /시작한 유저만/);
  assert.equal(calls.length, 1);

  const press = createCasinoButtonInteraction({ customId: buttonId });
  assert.equal(await handleCasinoCommand(press, fakeEconomy, quietLogger, {
    nowMs: () => 10999.9
  }), true);
  assert.deepEqual(calls.map(([type]) => type), ['reserve', 'resolve']);
  assert.equal(calls[1][1].payout, 500);
  assert.match(press.updated.content, /기록: \*\*9\.9999초\*\*/);
  assert.match(press.updated.content, /오차: \*\*0\.0001초\*\*/);
  assert.match(press.updated.content, /배율 \*\*5배\*\*/);
  assert.match(press.updated.content, /지급: 500골드/);
});

test('이모지 경마는 트랙 프레임으로 동물을 전진시키고 적중 시 2.7배를 지급한다', () => {
  const race = playEmojiRace({
    choice: '강아지',
    bet: 100,
    randomInt: createSequenceRandom([
      1, 3, 1,
      1, 3, 1,
      1, 3, 1
    ])
  });

  assert.equal(normalizeEmojiRaceChoice('2번'), 'dog');
  assert.equal(race.winnerId, 'dog');
  assert.equal(race.win, true);
  assert.equal(race.payout, 270);
  assert.match(formatEmojiRaceTrack(race.frames[0]), /1번 말: 🐎 \. \. \. \. \. \. \. \. \. 🏁/);
  assert.match(formatEmojiRaceTrack(race.finalFrame), /2번 강아지: \. \. \. \. \. \. \. \. \. 🐕 🏁/);
});

test('이모지경마 명령은 임베드 트랙을 수정하며 예약 베팅을 정산한다', async () => {
  const calls = [];
  const fakeEconomy = {
    async reserveWager(payload) {
      calls.push(['reserve', payload]);
      return {
        bet: payload.bet,
        profile: { balance: 9_900 }
      };
    },
    async resolveReservedWager(payload) {
      calls.push(['resolve', payload]);
      return {
        bet: payload.bet,
        payout: payload.payout,
        profit: payload.payout - payload.bet,
        profile: { balance: 10_000 + payload.payout - payload.bet }
      };
    },
    async refundReservedWager(payload) {
      calls.push(['refund', payload]);
      return {
        bet: payload.bet,
        payout: payload.bet,
        profit: 0,
        profile: { balance: 10_000 }
      };
    }
  };
  const interaction = createChatInputInteraction('이모지경마', {
    integers: { 돈: 100 },
    strings: { 선택: 'dog' }
  });

  assert.equal(await handleCasinoCommand(interaction, fakeEconomy, quietLogger, {
    raceDelayMs: 0,
    randomInt: createSequenceRandom([
      1, 3, 1,
      1, 3, 1,
      1, 3, 1
    ])
  }), true);

  assert.deepEqual(calls.map(([type]) => type), ['reserve', 'resolve']);
  assert.equal(calls[0][1].bet, 100);
  assert.equal(calls[1][1].payout, 270);
  assert.match(interaction.replied.embeds[0].data.title, /이모지 경마 출발/);
  assert.ok(interaction.edits.length >= 1);
  const finalEdit = interaction.edits.at(-1);
  assert.match(finalEdit.embeds[0].data.title, /이모지 경마 결과/);
  assert.match(finalEdit.embeds[0].data.description, /승자: \*\*🐕 강아지\*\*/);
  assert.match(finalEdit.embeds[0].data.description, /✅ 성공/);
});

test('유저 블랙잭 신청과 진행 안내는 상대와 현재 차례를 실제 멘션으로 제한한다', async () => {
  const fakeEconomy = {
    async getProfile(_guildId, userId, username) {
      return {
        userId,
        username,
        balance: 1_000
      };
    },
    async reservePlayerPot() {},
    async resolveReservedPlayerPot() {
      throw new Error('정산은 이 테스트에서 호출되지 않아야 합니다.');
    }
  };
  const opponent = {
    id: 'user-2',
    username: '상대',
    bot: false
  };
  const challenge = createChatInputInteraction('블랙잭', {
    integers: { 돈: 100 },
    targetUser: opponent
  });

  assert.equal(await handleCasinoCommand(challenge, fakeEconomy, quietLogger), true);
  assert.match(challenge.replied.content, /<@user-1>/);
  assert.match(challenge.replied.content, /<@user-2>/);
  assert.deepEqual(challenge.replied.allowedMentions, {
    parse: [],
    users: ['user-1', 'user-2']
  });

  const acceptId = challenge.replied.components[0].components[0].data.custom_id;
  const accept = createCasinoButtonInteraction({
    customId: acceptId,
    userId: 'user-2'
  });
  assert.equal(await handleCasinoCommand(accept, fakeEconomy, quietLogger), true);
  assert.match(accept.updated.content, /현재 차례: <@user-1>/);
  assert.deepEqual(accept.updated.allowedMentions, {
    parse: [],
    users: ['user-1']
  });
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
  assert.equal(keno.payout, 17000);
});

test('키노 배수표는 적은 적중도 일부 환급하고 선택 개수별 기대수익률을 완화한다', () => {
  const oneHitFivePick = playKeno({
    numbers: '1 2 3 4 5',
    bet: 100,
    randomInt: createSequenceRandom([0, 9, 18, 27, 36, 45, 54, 63, 70, 70])
  });

  assert.deepEqual(oneHitFivePick.hits, [1]);
  assert.equal(oneHitFivePick.multiplier, 1);
  assert.equal(oneHitFivePick.payout, 100);
});

test('스크래치 복권 상품은 고액 당첨금을 낮은 확률로 배치하고 기대 지급을 구매가보다 낮춘다', () => {
  const topPrizes = Object.fromEntries(
    SCRATCH_TICKET_PRODUCTS.map((product) => [product.id, product.topPrize])
  );
  const prizeAmounts = Object.fromEntries(
    SCRATCH_TICKET_PRODUCTS.map((product) => [
      product.id,
      product.prizeTiers.map((tier) => tier.amount)
    ])
  );

  assert.equal(topPrizes.mega, 500_000_000);
  assert.equal(topPrizes.royal, 100_000_000);
  assert.equal(topPrizes.mini, 20_000_000);
  assert.deepEqual(prizeAmounts.mega.slice(-3), [5_000, 3_000, 1_000]);
  assert.deepEqual(prizeAmounts.royal.slice(-3), [2_000, 1_000, 500]);
  assert.deepEqual(prizeAmounts.mini.slice(-3), [500, 300, 100]);
  assert.equal(formatScratchPrizeShort(500_000_000), '5억');
  assert.equal(formatScratchPrizeShort(20_000_000), '2000만');
  assert.equal(formatScratchPrizeShort(500), '500');

  for (const product of SCRATCH_TICKET_PRODUCTS) {
    const stats = getScratchTicketProductStats(product.id);

    assert.ok(stats.expectedPayout < product.price, `${product.id} 기대 지급이 구매가보다 낮아야 합니다.`);
    assert.ok(stats.winChance > 0, `${product.id} 당첨 확률이 있어야 합니다.`);
    assert.ok(stats.winChance < 0.7, `${product.id} 당첨 확률이 과도하게 높지 않아야 합니다.`);
  }
});

test('스크래치 복권은 9칸을 하나씩 공개하고 같은 금액 3개면 해당 금액을 지급한다', () => {
  const ticket = createScratchTicket({
    productId: 'mini',
    randomInt: (min) => min
  });
  const topPrizeCount = ticket.spots.filter((spot) => spot.amount === 20_000_000).length;

  assert.equal(ticket.status, 'scratching');
  assert.equal(ticket.revealCount, 0);
  assert.equal(ticket.payout, 0);
  assert.equal(topPrizeCount, 3);

  let current = ticket;
  for (let index = 0; index < SCRATCH_TICKET_SPOT_COUNT; index += 1) {
    current = revealScratchTicketSpot(current, index);
  }

  assert.equal(current.status, 'settled');
  assert.equal(current.win, true);
  assert.equal(current.winningAmount, 20_000_000);
  assert.equal(current.payout, 20_000_000);
  assert.throws(() => revealScratchTicketSpot(current, 0), /이미 정산/);

  let losing = createScratchTicket({
    productId: 'mini',
    randomInt: (_min, max) => max
  });

  for (let index = 0; index < SCRATCH_TICKET_SPOT_COUNT; index += 1) {
    losing = revealScratchTicketSpot(losing, index);
  }

  assert.equal(losing.win, false);
  assert.equal(losing.payout, 0);
});

test('스크래치복권 명령은 구매가를 예약하고 버튼을 누를 때마다 한 칸씩 공개한 뒤 정산한다', async () => {
  const calls = [];
  const fakeEconomy = {
    async reserveWager(payload) {
      calls.push(['reserve', payload]);
      return { bet: payload.bet, profile: { balance: 9_000 } };
    },
    async resolveReservedWager(payload) {
      calls.push(['resolve', payload]);
      return {
        bet: payload.bet,
        payout: payload.payout,
        profit: payload.payout - payload.bet,
        profile: { balance: 9_000 + payload.payout }
      };
    },
    async refundReservedWager(payload) {
      calls.push(['refund', payload]);
      return { bet: payload.bet, payout: payload.bet, profit: 0, profile: { balance: 10_000 } };
    }
  };
  const interaction = createChatInputInteraction('스크래치복권', {
    strings: { 종류: 'mini' }
  });

  assert.equal(await handleCasinoCommand(interaction, fakeEconomy, quietLogger, {
    randomInt: (min) => min
  }), true);
  assert.deepEqual(calls.map(([type]) => type), ['reserve']);
  assert.equal(calls[0][1].bet, 1_000);
  assert.match(interaction.replied.content, /스크래치 복권/);
  assert.match(interaction.replied.content, /미니 2000만/);
  assert.match(interaction.replied.content, /당첨률 약/);
  assert.equal(interaction.replied.components.length, 3);
  assert.equal(interaction.replied.components.flatMap((row) => row.components).length, 9);

  const firstButtonId = interaction.replied.components[0].components[0].data.custom_id;
  const otherUserPress = createCasinoButtonInteraction({
    customId: firstButtonId,
    userId: 'user-2'
  });
  assert.equal(await handleCasinoCommand(otherUserPress, fakeEconomy, quietLogger), true);
  assert.equal(otherUserPress.replied.flags, MessageFlags.Ephemeral);
  assert.match(otherUserPress.replied.content, /구매한 유저만/);
  assert.equal(calls.length, 1);

  const firstPress = createCasinoButtonInteraction({ customId: firstButtonId });
  assert.equal(await handleCasinoCommand(firstPress, fakeEconomy, quietLogger), true);
  assert.equal(calls.length, 1);
  assert.match(firstPress.updated.content, /방금 공개: \*\*1번\*\*/);
  assert.equal(firstPress.updated.components[0].components[0].data.disabled, true);

  const duplicatePress = createCasinoButtonInteraction({ customId: firstButtonId });
  assert.equal(await handleCasinoCommand(duplicatePress, fakeEconomy, quietLogger), true);
  assert.equal(duplicatePress.replied.flags, MessageFlags.Ephemeral);
  assert.match(duplicatePress.replied.content, /이미 긁은/);
  assert.deepEqual(calls.map(([type]) => type), ['reserve']);

  const [, gameId] = firstButtonId.split(':');
  let finalPress = firstPress;
  for (let index = 1; index < SCRATCH_TICKET_SPOT_COUNT; index += 1) {
    finalPress = createCasinoButtonInteraction({
      customId: `scratch_reveal:${gameId}:${index}`
    });
    assert.equal(await handleCasinoCommand(finalPress, fakeEconomy, quietLogger), true);
  }

  assert.deepEqual(calls.map(([type]) => type), ['reserve', 'resolve']);
  assert.equal(calls[1][1].payout, 20_000_000);
  assert.match(finalPress.updated.content, /스크래치 복권 당첨/);
  assert.match(finalPress.updated.content, /지급: 20,000,000골드/);
  assert.deepEqual(finalPress.updated.components, []);
});

test('럭키세븐과 하이로우는 하우스 엣지와 무승부 환급을 반영한다', () => {
  const luckySeven = playLuckySeven({
    bet: 100,
    randomInt: createSequenceRandom([3, 4])
  });
  const highLowWin = playHighLow({
    choice: '높음',
    bet: 100,
    randomInt: createSequenceRandom([4, 9])
  });
  const highLowPush = playHighLow({
    choice: '낮음',
    bet: 100,
    randomInt: createSequenceRandom([7, 7])
  });

  assert.deepEqual(luckySeven.dice, [3, 4]);
  assert.equal(luckySeven.total, 7);
  assert.equal(luckySeven.multiplier, 5.5);
  assert.equal(luckySeven.payout, 550);
  assert.equal(highLowWin.outcome, 'high');
  assert.equal(highLowWin.payout, 190);
  assert.equal(highLowPush.push, true);
  assert.equal(highLowPush.payout, 100);
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
    await fixture.economy.exchangeWallet({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '도박러',
      fromCurrency: 'main',
      toCurrency: 'casino',
      amount: 1000
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
      /골드가 부족합니다/
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
    await fixture.economy.exchangeWallet({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '도박러',
      fromCurrency: 'main',
      toCurrency: 'casino',
      amount: 1000
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
    await fixture.economy.exchangeWallet({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '도전자',
      fromCurrency: 'main',
      toCurrency: 'casino',
      amount: 1000
    });
    await fixture.economy.claimDaily({
      guildId: 'guild-1',
      userId: 'user-2',
      username: '상대',
      now: 1000
    });
    await fixture.economy.exchangeWallet({
      guildId: 'guild-1',
      userId: 'user-2',
      username: '상대',
      fromCurrency: 'main',
      toCurrency: 'casino',
      amount: 1000
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
    await fixture.economy.exchangeWallet({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '도전자',
      fromCurrency: 'main',
      toCurrency: 'casino',
      amount: 1000
    });
    await fixture.economy.claimDaily({
      guildId: 'guild-1',
      userId: 'user-2',
      username: '상대',
      now: 1000
    });
    await fixture.economy.exchangeWallet({
      guildId: 'guild-1',
      userId: 'user-2',
      username: '상대',
      fromCurrency: 'main',
      toCurrency: 'casino',
      amount: 1000
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

function createChatInputInteraction(commandName, options = {}) {
  const { integers = {}, strings = {}, targetUser = null } = options;

  return {
    commandName,
    guildId: 'guild-1',
    user: {
      id: 'user-1',
      username: '도박러',
      toString: () => '<@user-1>'
    },
    options: {
      getInteger(name) {
        if (commandName === '카지노정보') {
          throw new Error('카지노정보는 돈 옵션을 읽지 않아야 합니다.');
        }
        return integers[name] ?? null;
      },
      getString(name) {
        if (commandName === '카지노정보') {
          throw new Error('카지노정보는 선택 옵션을 읽지 않아야 합니다.');
        }
        return strings[name] ?? null;
      },
      getUser() {
        return targetUser;
      }
    },
    isButton: () => false,
    isChatInputCommand: () => true,
    inGuild: () => true,
    edits: [],
    async reply(payload) {
      this.replied = typeof payload === 'string'
        ? { content: payload }
        : payload;
    },
    async editReply(payload) {
      this.edits.push(typeof payload === 'string'
        ? { content: payload }
        : payload);
    }
  };
}

function createCasinoButtonInteraction({ customId, userId = 'user-1' }) {
  return {
    customId,
    guildId: 'guild-1',
    user: {
      id: userId,
      username: userId === 'user-1' ? '도박러' : '구경꾼',
      toString: () => `<@${userId}>`
    },
    isButton: () => true,
    isChatInputCommand: () => false,
    inGuild: () => true,
    async reply(payload) {
      this.replied = typeof payload === 'string'
        ? { content: payload }
        : payload;
    },
    async update(payload) {
      this.updated = payload;
    }
  };
}

const quietLogger = {
  error() {}
};

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
