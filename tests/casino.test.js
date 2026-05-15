import { ButtonStyle, MessageFlags } from 'discord.js';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  cleanupExpiredCasinoGames,
  getCasinoCommandPayloads,
  handleCasinoCommand
} from '../src/commands/casino.js';
import { createSqliteStore } from '../src/storage/sqlite-store.js';
import { EconomyService } from '../src/systems/economy.js';
import {
  cashOutDeadlineRound,
  applyPokerRecommendedHold,
  clearPokerHold,
  createBlackjackRound,
  createDeadlineRound,
  actPlayerHoldemRound,
  createPlayerHoldemRound,
  createPlayerBlackjackRound,
  createPokerRound,
  createScratchTicket,
  createTimingRound,
  DEADLINE_MAX_SAFE_PRESSES,
  DEADLINE_MIN_BET,
  DEADLINE_ROLL_MAX,
  formatEmojiRaceTrack,
  formatScratchPrizeShort,
  getScratchTicketProductStats,
  drawPokerRound,
  evaluatePokerHand,
  evaluateBestPokerHand,
  comparePokerHands,
  getPokerHoldRecommendation,
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
  playEmojiRacePool,
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

const FORMER_CASINO_MAX_BET = 1_000_000_000_000_000;
const CONFIGURED_CASINO_LUCK_USER_ID = '123456789012345678';
const CONFIGURED_CASINO_LUCK_USER_ID_TOKEN = encodeDoubleBase64TestToken(CONFIGURED_CASINO_LUCK_USER_ID);

function encodeDoubleBase64TestToken(value) {
  const once = Buffer.from(String(value ?? '').trim(), 'utf8').toString('base64');
  return Buffer.from(once, 'utf8').toString('base64');
}

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
  const payloads = getCasinoCommandPayloads();
  const commandNames = payloads.map((command) => command.name);

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
    '포커',
    '룰렛',
    '바카라',
    '크랩스',
    '시크보',
    '키노',
    '스크래치복권'
  ]);

  const deadlineCommand = payloads.find((command) => command.name === '데드라인');
  const deadlineBetOption = deadlineCommand.options.find((option) => option.name === '돈');
  const timingCommand = payloads.find((command) => command.name === '타이밍');
  const timingDifficultyOption = timingCommand.options.find((option) => option.name === '난이도');
  const pokerCommand = payloads.find((command) => command.name === '포커');
  const pokerOpponentOption = pokerCommand.options.find((option) => option.name === '상대');
  const pokerPlayersOption = pokerCommand.options.find((option) => option.name === '인원');
  const betOptions = payloads
    .flatMap((command) => command.options ?? [])
    .filter((option) => option.name === '돈' || option.name === '시작칩');

  assert.equal(deadlineBetOption.type, 3);
  assert.match(deadlineBetOption.description, new RegExp(DEADLINE_MIN_BET.toLocaleString()));
  assert.ok(betOptions.length > 0);
  assert.ok(betOptions.every((option) => option.max_value === undefined));
  assert.ok(betOptions.every((option) => option.type === 3));
  assert.equal(timingDifficultyOption.required, false);
  assert.deepEqual(timingDifficultyOption.choices.map((choice) => choice.value), ['normal', 'hard', 'very_hard']);
  assert.equal(pokerOpponentOption, undefined);
  assert.equal(pokerPlayersOption, undefined);
  assert.deepEqual(pokerCommand.options.map((option) => option.name), ['시작칩']);
  assert.match(pokerCommand.options[0].description, /시작 스택/);
});

test('카지노정보 명령은 베팅금 없이 게임 배수와 환급 규칙만 안내한다', async () => {
  const interaction = createChatInputInteraction('카지노정보');
  const handled = await handleCasinoCommand(interaction, null, quietLogger);

  assert.equal(handled, true);
  assert.match(interaction.replied.content, /카지노 게임 정보/);
  assert.match(interaction.replied.content, /주사위.*1\.9배/);
  assert.match(interaction.replied.content, /데드라인.*꽝 확률/);
  assert.match(interaction.replied.content, /타이밍.*5.*20/);
  assert.match(interaction.replied.content, /이모지경마.*배당풀/);
  assert.match(interaction.replied.content, /포커.*텍사스 홀덤/);
  assert.match(interaction.replied.content, /키노.*번호 1~5개/);
  assert.match(interaction.replied.content, /스크래치복권.*같은 금액 3개/);
  assert.doesNotMatch(interaction.replied.content, /최대 베팅|최대 .*골드까지/);
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

test('카지노 베팅 명령은 한국식 큰 단위 문자열을 정산 금액으로 받는다', async () => {
  const settled = [];
  const fakeEconomy = {
    async settleWager(payload) {
      settled.push(payload);
      return {
        bet: payload.bet,
        payout: 0,
        profit: -payload.bet,
        profile: { balance: 0 }
      };
    }
  };
  const interaction = createChatInputInteraction('홀짝', {
    strings: { 돈: '1억', 선택: 'odd' }
  });

  assert.equal(await handleCasinoCommand(interaction, fakeEconomy, quietLogger, {
    randomInt: createSequenceRandom([100])
  }), true);

  assert.equal(settled[0].bet, 100_000_000);
  assert.match(interaction.replied.content, /100,000,000골드/);
});

test('카지노 행운 보정은 env ID 토큰에게만 내부 확률 기회를 추가하고 공개 문구로 노출하지 않는다', async () => {
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
  const originalLuckyUserIdTokens = process.env.CASINO_LUCKY_USER_ID_TOKENS;
  const originalLuckMultiplier = process.env.CASINO_LUCK_MULTIPLIER;

  try {
    process.env.CASINO_LUCKY_USER_ID_TOKENS = CONFIGURED_CASINO_LUCK_USER_ID_TOKEN;
    process.env.CASINO_LUCK_MULTIPLIER = '5';

    const idLuckyInteraction = createChatInputInteraction('홀짝', {
      integers: { 돈: 100 },
      strings: { 선택: 'odd' },
      userId: CONFIGURED_CASINO_LUCK_USER_ID,
      username: '아이디매칭'
    });

    assert.equal(await handleCasinoCommand(idLuckyInteraction, fakeEconomy, quietLogger, {
      randomInt: createSequenceRandom([2, 3])
    }), true);

    assert.equal(settled[0].payout, 190);
    assert.doesNotMatch(idLuckyInteraction.replied.content, /행운 보정|5배|번째 결과/);

    const nicknameOnlyInteraction = createChatInputInteraction('홀짝', {
      integers: { 돈: 100 },
      strings: { 선택: 'odd' },
      userId: 'not-lucky-user',
      username: 'env_lucky_user',
      memberDisplayName: '아이디매칭'
    });

    assert.equal(await handleCasinoCommand(nicknameOnlyInteraction, fakeEconomy, quietLogger, {
      randomInt: createSequenceRandom([2, 3])
    }), true);

    assert.equal(settled[1].payout, 0);
    assert.doesNotMatch(nicknameOnlyInteraction.replied.content, /행운 보정/);

    process.env.CASINO_LUCKY_USER_ID_TOKENS = '';
    const rawIdOnlyInteraction = createChatInputInteraction('홀짝', {
      integers: { 돈: 100 },
      strings: { 선택: 'odd' },
      userId: CONFIGURED_CASINO_LUCK_USER_ID,
      username: '다른유저'
    });

    assert.equal(await handleCasinoCommand(rawIdOnlyInteraction, fakeEconomy, quietLogger, {
      randomInt: createSequenceRandom([2, 3])
    }), true);

    assert.equal(settled[2].payout, 0);
    assert.doesNotMatch(rawIdOnlyInteraction.replied.content, /행운 보정|5배|번째 결과/);
  } finally {
    if (originalLuckyUserIdTokens === undefined) {
      delete process.env.CASINO_LUCKY_USER_ID_TOKENS;
    } else {
      process.env.CASINO_LUCKY_USER_ID_TOKENS = originalLuckyUserIdTokens;
    }
    if (originalLuckMultiplier === undefined) {
      delete process.env.CASINO_LUCK_MULTIPLIER;
    } else {
      process.env.CASINO_LUCK_MULTIPLIER = originalLuckMultiplier;
    }
  }
});

test('카지노 핸들러는 다른 기능 버튼을 건드리지 않는다', async () => {
  const interaction = createCasinoButtonInteraction({
    customId: 'fishing_cast:user-1'
  });
  const handled = await handleCasinoCommand(interaction, null, quietLogger);

  assert.equal(handled, false);
  assert.equal(interaction.replied, undefined);
});


test('데드라인은 안전 누름마다 골드 보상과 꽝 확률이 커지고 수령할 수 있다', () => {
  const round = createDeadlineRound({ bet: 100 });
  const firstSafe = pressDeadlineRound(round, {
    randomInt: () => 1051
  });
  const secondSafe = pressDeadlineRound(firstSafe, {
    randomInt: () => 1826
  });
  const cashedOut = cashOutDeadlineRound(secondSafe);
  const busted = pressDeadlineRound(secondSafe, {
    randomInt: () => 1
  });

  assert.equal(round.reward, 0);
  assert.equal(round.nextReward, 5);
  assert.equal(getDeadlineNextReward(100, 1), 13);
  assert.equal(getDeadlineBustChanceBps(0), 1050);
  assert.equal(getDeadlineBustChanceBps(1), 1825);
  assert.equal(firstSafe.status, 'pressing');
  assert.equal(firstSafe.reward, 5);
  assert.equal(firstSafe.nextReward, 13);
  assert.equal(firstSafe.bustChanceBps, 1825);
  assert.equal(secondSafe.reward, 18);
  assert.equal(cashedOut.status, 'cashed_out');
  assert.equal(cashedOut.payout, 118);
  assert.equal(busted.status, 'busted');
  assert.equal(busted.lostReward, 18);
  assert.equal(busted.payout, 0);
});

test('데드라인은 최소 베팅과 낮아진 보상률로 소액 양수 기댓값을 막는다', () => {
  assert.throws(
    () => createDeadlineRound({ bet: DEADLINE_MIN_BET - 1 }),
    /100 이상의 정수/
  );

  const firstReward = getDeadlineNextReward(DEADLINE_MIN_BET, 0);
  const firstSurvivalRate = 1 - getDeadlineBustChanceBps(0) / 10_000;
  const firstPressRtpBps = Math.round(
    firstSurvivalRate * (DEADLINE_MIN_BET + firstReward) / DEADLINE_MIN_BET * 10_000
  );

  assert.equal(firstReward, 5);
  assert.equal(firstPressRtpBps, 9_398);
});

test('데드라인 명령은 골드를 예약하고 버튼 안전 누름 후 수령 정산한다', async () => {
  const calls = [];
  let activeDeadlineButton = null;
  const fakeEconomy = {
    async reserveWager(payload) {
      calls.push(['reserve', payload]);
      return {
        bet: payload.bet,
        profile: { balance: 900 }
      };
    },
    async resolveReservedWager(payload) {
      assert.equal(activeDeadlineButton?.deferred, true);
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
    randomInt: () => 1051
  }), true);
  assert.equal(calls.length, 1);
  assert.equal(press.deferUpdateCalls, 1);
  assert.equal(press.updateCalls, 0);
  assert.match(press.updated.content, /방금 안전했습니다: \*\*\+5골드\*\*/);
  assert.equal(press.updated.components[0].components[1].data.disabled, false);

  const cashOutButtonId = press.updated.components[0].components[1].data.custom_id;
  const cashOut = createCasinoButtonInteraction({ customId: cashOutButtonId });
  activeDeadlineButton = cashOut;
  assert.equal(await handleCasinoCommand(cashOut, fakeEconomy, quietLogger), true);
  activeDeadlineButton = null;
  assert.deepEqual(calls.map(([type]) => type), ['reserve', 'resolve']);
  assert.equal(calls[1][1].payout, 105);
  assert.equal(cashOut.deferUpdateCalls, 1);
  assert.equal(cashOut.updateCalls, 0);
  assert.match(cashOut.updated.content, /데드라인 수령/);
  assert.match(cashOut.updated.content, /지급: 105골드/);
});

test('데드라인 버튼은 최초 update 토큰 대신 deferUpdate 후 editReply로 갱신한다', async () => {
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
  const press = createCasinoButtonInteraction({ customId: pressButtonId });
  press.update = async function failIfDirectUpdateIsUsed() {
    this.updateCalls += 1;
    throw createUnknownInteractionError();
  };

  assert.equal(await handleCasinoCommand(press, fakeEconomy, quietLogger, {
    randomInt: () => 1051
  }), true);

  assert.deepEqual(calls.map(([type]) => type), ['reserve']);
  assert.equal(press.deferUpdateCalls, 1);
  assert.equal(press.updateCalls, 0);
  assert.equal(press.editReplyCalls, 1);
  assert.match(press.updated.content, /방금 안전했습니다/);
});

test('데드라인 버튼은 같은 라운드 동시 입력을 한 번만 처리한다', async () => {
  const calls = [];
  let randomCalls = 0;
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
  await handleCasinoCommand(interaction, fakeEconomy, quietLogger);

  const pressButtonId = interaction.replied.components[0].components[0].data.custom_id;
  let releaseDefers;
  const deferGate = new Promise((resolve) => {
    releaseDefers = resolve;
  });
  const firstPress = createCasinoButtonInteraction({ customId: pressButtonId });
  const secondPress = createCasinoButtonInteraction({ customId: pressButtonId });
  for (const press of [firstPress, secondPress]) {
    press.deferUpdate = async function deferUntilReleased() {
      this.deferred = true;
      this.deferUpdateCalls += 1;
      await deferGate;
    };
  }

  const firstPromise = handleCasinoCommand(firstPress, fakeEconomy, quietLogger, {
    randomInt: () => {
      randomCalls += 1;
      return 1051;
    }
  });
  const secondPromise = handleCasinoCommand(secondPress, fakeEconomy, quietLogger, {
    randomInt: () => {
      randomCalls += 1;
      return 1051;
    }
  });
  releaseDefers();
  await Promise.all([firstPromise, secondPromise]);

  const presses = [firstPress, secondPress];
  const progressPress = presses.find((press) => /방금 안전했습니다/.test(press.updated?.content ?? ''));
  const processingPress = presses.find((press) =>
    press.followUps.some((payload) => /처리 중/.test(payload.content ?? ''))
  );

  assert.ok(progressPress);
  assert.ok(processingPress);
  assert.deepEqual(presses.map((press) => press.deferUpdateCalls), [1, 1]);
  assert.equal(randomCalls, 1);
  assert.deepEqual(calls.map(([type]) => type), ['reserve']);
});

test('데드라인 누르기는 env ID 토큰 유저에게만 내부 꽝 회피 기회를 주고 공개 문구로 노출하지 않는다', async () => {
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
  const originalLuckyUserIdTokens = process.env.CASINO_LUCKY_USER_ID_TOKENS;
  const originalLuckMultiplier = process.env.CASINO_LUCK_MULTIPLIER;

  try {
    process.env.CASINO_LUCKY_USER_ID_TOKENS = encodeDoubleBase64TestToken('user-1');
    process.env.CASINO_LUCK_MULTIPLIER = '5';

    const interaction = createChatInputInteraction('데드라인', {
      integers: { 돈: 100 }
    });
    assert.equal(await handleCasinoCommand(interaction, fakeEconomy, quietLogger), true);
    const pressButtonId = interaction.replied.components[0].components[0].data.custom_id;

    const press = createCasinoButtonInteraction({ customId: pressButtonId });
    let randomCalls = 0;
    assert.equal(await handleCasinoCommand(press, fakeEconomy, quietLogger, {
      randomInt: () => {
        randomCalls += 1;
        return randomCalls === 1 ? 1 : 1051;
      }
    }), true);

    assert.equal(randomCalls, 2);
    assert.deepEqual(calls.map(([type]) => type), ['reserve']);
    assert.match(press.updated.content, /방금 안전했습니다/);
    assert.doesNotMatch(press.updated.content, /행운 보정|5배|번째 결과/);

    process.env.CASINO_LUCKY_USER_ID_TOKENS = '';
    const normalInteraction = createChatInputInteraction('데드라인', {
      integers: { 돈: 100 },
      userId: 'normal-user'
    });
    assert.equal(await handleCasinoCommand(normalInteraction, fakeEconomy, quietLogger), true);
    const normalPressButtonId = normalInteraction.replied.components[0].components[0].data.custom_id;
    const normalPress = createCasinoButtonInteraction({ customId: normalPressButtonId, userId: 'normal-user' });
    let normalRandomCalls = 0;
    assert.equal(await handleCasinoCommand(normalPress, fakeEconomy, quietLogger, {
      randomInt: () => {
        normalRandomCalls += 1;
        return normalRandomCalls === 1 ? 1 : 1051;
      }
    }), true);

    assert.equal(normalRandomCalls, 1);
    assert.equal(calls.at(-1)[0], 'resolve');
    assert.equal(calls.at(-1)[1].payout, 0);
    assert.match(normalPress.updated.content, /데드라인 폭발/);
  } finally {
    if (originalLuckyUserIdTokens === undefined) {
      delete process.env.CASINO_LUCKY_USER_ID_TOKENS;
    } else {
      process.env.CASINO_LUCKY_USER_ID_TOKENS = originalLuckyUserIdTokens;
    }
    if (originalLuckMultiplier === undefined) {
      delete process.env.CASINO_LUCK_MULTIPLIER;
    } else {
      process.env.CASINO_LUCK_MULTIPLIER = originalLuckMultiplier;
    }
  }
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

test('만료된 수동 카지노 게임은 예약금을 환불하고 대기 상태를 지운다', async () => {
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

  await cleanupExpiredCasinoGames(fakeEconomy, quietLogger, Number.MAX_SAFE_INTEGER);
  calls.length = 0;

  const interaction = createChatInputInteraction('데드라인', {
    integers: { 돈: 100 }
  });

  assert.equal(await handleCasinoCommand(interaction, fakeEconomy, quietLogger), true);
  const pressButtonId = interaction.replied.components[0].components[0].data.custom_id;
  const cleanup = await cleanupExpiredCasinoGames(fakeEconomy, quietLogger, Date.now() + 120_000);

  assert.equal(cleanup.removed, 1);
  assert.equal(cleanup.refunded, 1);
  assert.deepEqual(calls.map(([type]) => type), ['reserve', 'refund']);
  assert.equal(calls[1][1].bet, 100);

  const latePress = createCasinoButtonInteraction({ customId: pressButtonId });
  assert.equal(await handleCasinoCommand(latePress, fakeEconomy, quietLogger), true);
  assert.match(latePress.replied.content, /이미 만료/);
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

test('타이밍 명령은 시작 버튼을 누른 순간부터 기록을 재고 4자리 초로 정산한다', async () => {
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
  assert.match(interaction.replied.content, /타이밍 준비/);
  assert.match(interaction.replied.content, /시작하기/);
  assert.match(interaction.replied.content, /난이도: \*\*쉬움\*\*/);
  assert.doesNotMatch(interaction.replied.content, /목표: \*\*10\.0000초\*\*/);
  assert.match(interaction.replied.content, /0\.5초 이하 1\.3배/);

  const startButtonId = interaction.replied.components[0].components[0].data.custom_id;
  assert.match(startButtonId, /^timing_start:/);

  const otherUserStart = createCasinoButtonInteraction({
    customId: startButtonId,
    userId: 'user-2'
  });
  assert.equal(await handleCasinoCommand(otherUserStart, fakeEconomy, quietLogger), true);
  assert.equal(otherUserStart.replied.flags, MessageFlags.Ephemeral);
  assert.match(otherUserStart.replied.content, /시작한 유저만/);
  assert.equal(calls.length, 1);

  const start = createCasinoButtonInteraction({ customId: startButtonId });
  assert.equal(await handleCasinoCommand(start, fakeEconomy, quietLogger, {
    randomInt: () => 10,
    nowMs: () => 1000
  }), true);
  assert.match(start.updated.content, /타이밍 게임/);
  assert.match(start.updated.content, /목표: \*\*10\.0000초\*\*/);
  const pressButtonId = start.updated.components[0].components[0].data.custom_id;
  assert.match(pressButtonId, /^timing_press:/);
  assert.equal(calls.length, 1);

  const press = createCasinoButtonInteraction({ customId: pressButtonId });
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

test('타이밍 어려움 난이도는 목표 시간을 숫자 대신 문제로 보여준다', async () => {
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
    integers: { 돈: 100 },
    strings: { 난이도: 'hard' }
  });

  assert.equal(await handleCasinoCommand(interaction, fakeEconomy, quietLogger, {
    randomInt: () => 10,
    nowMs: () => 1000
  }), true);
  assert.match(interaction.replied.content, /난이도: \*\*어려움\*\*/);
  assert.match(interaction.replied.content, /0\.02초 이하 7\.5배/);

  const startButtonId = interaction.replied.components[0].components[0].data.custom_id;
  const start = createCasinoButtonInteraction({ customId: startButtonId });
  assert.equal(await handleCasinoCommand(start, fakeEconomy, quietLogger, {
    randomInt: createSequenceRandom([10, 0]),
    nowMs: () => 1000
  }), true);

  assert.match(start.updated.content, /목표 문제:/);
  assert.match(start.updated.content, /√196초 - 4초/);
  assert.match(start.updated.content, /0\.02초 이하 7\.5배/);
  assert.doesNotMatch(start.updated.content, /목표: \*\*10\.0000초\*\*/);

  const pressButtonId = start.updated.components[0].components[0].data.custom_id;
  const press = createCasinoButtonInteraction({ customId: pressButtonId });
  assert.equal(await handleCasinoCommand(press, fakeEconomy, quietLogger, {
    nowMs: () => 10999.9
  }), true);

  assert.match(press.updated.content, /목표: \*\*10\.0000초\*\*/);
  assert.match(press.updated.content, /문제:/);
  assert.equal(calls[1][1].payout, 750);
  assert.match(press.updated.content, /배율 \*\*7\.5배\*\*/);
  assert.match(press.updated.content, /지급: 750골드/);
});

test('타이밍 매우어려움 난이도는 고급 수학 문제로 목표 시간을 숨긴다', async () => {
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
    integers: { 돈: 100 },
    strings: { 난이도: 'very_hard' }
  });

  assert.equal(await handleCasinoCommand(interaction, fakeEconomy, quietLogger, {
    randomInt: () => 16,
    nowMs: () => 1000
  }), true);
  assert.match(interaction.replied.content, /난이도: \*\*매우어려움\*\*/);
  assert.match(interaction.replied.content, /0\.02초 이하 12\.5배/);

  const startButtonId = interaction.replied.components[0].components[0].data.custom_id;
  const start = createCasinoButtonInteraction({ customId: startButtonId });
  assert.equal(await handleCasinoCommand(start, fakeEconomy, quietLogger, {
    randomInt: createSequenceRandom([16, 4]),
    nowMs: () => 1000
  }), true);

  assert.match(start.updated.content, /목표 문제:/);
  assert.match(start.updated.content, /5번째 카탈란 수 - 4번째 카탈란 수/);
  assert.match(start.updated.content, /0\.02초 이하 12\.5배/);
  assert.doesNotMatch(start.updated.content, /제\d|완전수/);
  assert.doesNotMatch(start.updated.content, /목표: \*\*16\.0000초\*\*/);

  const pressButtonId = start.updated.components[0].components[0].data.custom_id;
  const press = createCasinoButtonInteraction({ customId: pressButtonId });
  assert.equal(await handleCasinoCommand(press, fakeEconomy, quietLogger, {
    nowMs: () => 16999.9
  }), true);

  assert.deepEqual(calls.map(([type]) => type), ['reserve', 'resolve']);
  assert.equal(calls[1][1].payout, 1250);
  assert.match(press.updated.content, /목표: \*\*16\.0000초\*\*/);
  assert.match(press.updated.content, /카탈란/);
  assert.match(press.updated.content, /배율 \*\*12\.5배\*\*/);
  assert.match(press.updated.content, /지급: 1,250골드/);
});

test('타이밍 매우어려움 이차방정식 문제는 선도계수를 1로 두지 않는다', async () => {
  const fakeEconomy = {
    async reserveWager(payload) {
      return { bet: payload.bet, profile: { balance: 900 } };
    },
    async resolveReservedWager(payload) {
      return {
        bet: payload.bet,
        payout: payload.payout,
        profit: payload.payout - payload.bet,
        profile: { balance: 900 + payload.payout }
      };
    },
    async refundReservedWager(payload) {
      return { bet: payload.bet, payout: payload.bet, profit: 0, profile: { balance: 1000 } };
    }
  };
  const interaction = createChatInputInteraction('타이밍', {
    integers: { 돈: 100 },
    strings: { 난이도: 'very_hard' }
  });

  assert.equal(await handleCasinoCommand(interaction, fakeEconomy, quietLogger, {
    randomInt: () => 7,
    nowMs: () => 1000
  }), true);

  const startButtonId = interaction.replied.components[0].components[0].data.custom_id;
  const start = createCasinoButtonInteraction({ customId: startButtonId });
  assert.equal(await handleCasinoCommand(start, fakeEconomy, quietLogger, {
    randomInt: createSequenceRandom([7, 0]),
    nowMs: () => 1000
  }), true);

  assert.match(start.updated.content, /이차방정식 2x²/);
  assert.match(start.updated.content, /두 양근의 차/);
  assert.doesNotMatch(start.updated.content, /이차방정식 x²/);
  assert.doesNotMatch(start.updated.content, /목표: \*\*7\.0000초\*\*/);

  const pressButtonId = start.updated.components[0].components[0].data.custom_id;
  const press = createCasinoButtonInteraction({ customId: pressButtonId });
  assert.equal(await handleCasinoCommand(press, fakeEconomy, quietLogger, {
    nowMs: () => 7999.9
  }), true);
  assert.match(press.updated.content, /목표: \*\*7\.0000초\*\*/);
});

test('타이밍 매우어려움은 확률과 통계형 문장 문제도 낸다', async () => {
  const fakeEconomy = {
    async reserveWager(payload) {
      return { bet: payload.bet, profile: { balance: 900 } };
    },
    async resolveReservedWager(payload) {
      return {
        bet: payload.bet,
        payout: payload.payout,
        profit: payload.payout - payload.bet,
        profile: { balance: 900 + payload.payout }
      };
    },
    async refundReservedWager(payload) {
      return { bet: payload.bet, payout: payload.bet, profit: 0, profile: { balance: 1000 } };
    }
  };
  const interaction = createChatInputInteraction('타이밍', {
    integers: { 돈: 100 },
    strings: { 난이도: 'very_hard' }
  });

  assert.equal(await handleCasinoCommand(interaction, fakeEconomy, quietLogger, {
    randomInt: () => 10,
    nowMs: () => 1000
  }), true);

  const startButtonId = interaction.replied.components[0].components[0].data.custom_id;
  const start = createCasinoButtonInteraction({ customId: startButtonId });
  assert.equal(await handleCasinoCommand(start, fakeEconomy, quietLogger, {
    randomInt: createSequenceRandom([10, 5]),
    nowMs: () => 1000
  }), true);

  assert.match(start.updated.content, /공정한 동전을 5번 던질 때 앞면이 홀수 번 나오는 경우의 수 - 6초/);
  assert.doesNotMatch(start.updated.content, /목표: \*\*10\.0000초\*\*/);
});

test('타이밍 매우어려움은 쉬운 1차방정식 대신 수능형 함수 문제도 낸다', async () => {
  const fakeEconomy = {
    async reserveWager(payload) {
      return { bet: payload.bet, profile: { balance: 900 } };
    },
    async resolveReservedWager(payload) {
      return {
        bet: payload.bet,
        payout: payload.payout,
        profit: payload.payout - payload.bet,
        profile: { balance: 900 + payload.payout }
      };
    },
    async refundReservedWager(payload) {
      return { bet: payload.bet, payout: payload.bet, profit: 0, profile: { balance: 1000 } };
    }
  };
  const interaction = createChatInputInteraction('타이밍', {
    integers: { 돈: 100 },
    strings: { 난이도: 'very_hard' }
  });

  assert.equal(await handleCasinoCommand(interaction, fakeEconomy, quietLogger), true);
  const startButtonId = interaction.replied.components[0].components[0].data.custom_id;
  const start = createCasinoButtonInteraction({ customId: startButtonId });
  assert.equal(await handleCasinoCommand(start, fakeEconomy, quietLogger, {
    randomInt: createSequenceRandom([12, 11]),
    nowMs: () => 1000
  }), true);

  assert.match(start.updated.content, /함수 f\(x\)=x³-3x²\+15x에서 x=1일 때 접선의 기울기초/);
  assert.doesNotMatch(start.updated.content, /3n \+ 7|직사각형의 둘레/);
  assert.doesNotMatch(start.updated.content, /목표: \*\*12\.0000초\*\*/);
});

test('타이밍 매우어려움은 같은 목표 초에도 여러 문제를 낸다', async () => {
  const fakeEconomy = {
    async reserveWager(payload) {
      return { bet: payload.bet, profile: { balance: 900 } };
    },
    async resolveReservedWager(payload) {
      return {
        bet: payload.bet,
        payout: payload.payout,
        profit: payload.payout - payload.bet,
        profile: { balance: 900 + payload.payout }
      };
    },
    async refundReservedWager(payload) {
      return { bet: payload.bet, payout: payload.bet, profit: 0, profile: { balance: 1000 } };
    }
  };
  const firstInteraction = createChatInputInteraction('타이밍', {
    integers: { 돈: 100 },
    strings: { 난이도: 'very_hard' }
  });
  const secondInteraction = createChatInputInteraction('타이밍', {
    integers: { 돈: 100 },
    strings: { 난이도: 'very_hard' }
  });

  assert.equal(await handleCasinoCommand(firstInteraction, fakeEconomy, quietLogger), true);
  const firstStartButtonId = firstInteraction.replied.components[0].components[0].data.custom_id;
  const firstStart = createCasinoButtonInteraction({ customId: firstStartButtonId });
  assert.equal(await handleCasinoCommand(firstStart, fakeEconomy, quietLogger, {
    randomInt: createSequenceRandom([10, 0]),
    nowMs: () => 1000
  }), true);

  assert.equal(await handleCasinoCommand(secondInteraction, fakeEconomy, quietLogger), true);
  const secondStartButtonId = secondInteraction.replied.components[0].components[0].data.custom_id;
  const secondStart = createCasinoButtonInteraction({ customId: secondStartButtonId });
  assert.equal(await handleCasinoCommand(secondStart, fakeEconomy, quietLogger, {
    randomInt: createSequenceRandom([10, 5]),
    nowMs: () => 1000
  }), true);

  assert.match(firstStart.updated.content, /목표 문제:/);
  assert.match(secondStart.updated.content, /목표 문제:/);
  assert.notEqual(firstStart.updated.content, secondStart.updated.content);
  assert.doesNotMatch(firstStart.updated.content, /목표: \*\*10\.0000초\*\*/);
  assert.doesNotMatch(secondStart.updated.content, /목표: \*\*10\.0000초\*\*/);
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

test('이모지 경마 배당판은 총 베팅금의 95%를 적중 지분에 배당한다', () => {
  const race = playEmojiRacePool({
    bets: [
      { key: 'user-1', userId: 'user-1', username: '도박러', choice: 'dog', bet: 100 },
      { key: 'user-2', userId: 'user-2', username: '구경꾼', choice: 'horse', bet: 100 },
      { key: 'user-3', userId: 'user-3', username: '관중', choice: 'turtle', bet: 100 }
    ],
    randomInt: createSequenceRandom([
      1, 3, 1,
      1, 3, 1,
      1, 3, 1
    ])
  });

  assert.equal(race.winnerId, 'dog');
  assert.equal(race.market.totalPool, 300);
  assert.equal(race.payoutPool, 285);
  assert.equal(race.houseFee, 15);
  assert.equal(race.market.oddsByChoice.dog, 2.85);
  assert.deepEqual(race.bets.map((betEntry) => betEntry.payout), [285, 0, 0]);
});

test('이모지경마 명령은 다인 배당판을 만들고 시작 시 배당 방식으로 정산한다', async () => {
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

  assert.deepEqual(calls.map(([type]) => type), ['reserve']);
  assert.equal(calls[0][1].bet, 100);
  assert.match(interaction.replied.embeds[0].data.title, /이모지 경마 배당판/);
  assert.match(interaction.replied.embeds[0].data.description, /참가: \*\*1\/12명\*\*/);

  const turtleButtonId = interaction.replied.components[0].components
    .find((component) => component.data.custom_id.includes(':turtle'))
    .data.custom_id;
  const join = createCasinoButtonInteraction({
    customId: turtleButtonId,
    userId: 'user-2'
  });

  assert.equal(await handleCasinoCommand(join, fakeEconomy, quietLogger), true);
  assert.deepEqual(calls.map(([type]) => type), ['reserve', 'reserve']);
  assert.equal(calls[1][1].userId, 'user-2');
  assert.match(join.updated.embeds[0].data.description, /참가: \*\*2\/12명\*\*/);
  assert.match(join.updated.embeds[0].data.description, /🐢 거북이: 1명/);

  const startButtonId = join.updated.components[1].components
    .find((component) => component.data.custom_id.startsWith('race_start:'))
    .data.custom_id;
  const start = createCasinoButtonInteraction({ customId: startButtonId });

  assert.equal(await handleCasinoCommand(start, fakeEconomy, quietLogger), true);

  assert.deepEqual(calls.map(([type]) => type), ['reserve', 'reserve', 'resolve', 'resolve']);
  assert.equal(calls[2][1].userId, 'user-1');
  assert.equal(calls[2][1].payout, 190);
  assert.equal(calls[3][1].userId, 'user-2');
  assert.equal(calls[3][1].payout, 0);
  assert.equal(start.deferred, true);
  const finalEdit = start.updated;
  assert.match(finalEdit.embeds[0].data.title, /이모지 경마 결과/);
  assert.match(finalEdit.embeds[0].data.description, /승자: \*\*🐕 강아지\*\*/);
  assert.match(finalEdit.embeds[0].data.description, /배당풀: \*\*190골드\*\*/);
  assert.match(finalEdit.embeds[0].data.description, /<@user-1>.*✅ 적중.*지급 190골드/);
  assert.match(finalEdit.embeds[0].data.description, /<@user-2>.*❌ 실패.*지급 0골드/);
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

test('유저 포커는 원하는 유저가 방에 참가하고 방장이 시작하면 텍사스 홀덤을 진행한다', async () => {
  const calls = [];
  const fakeEconomy = {
    async getProfile(_guildId, userId, username) {
      return {
        userId,
        username,
        balance: 1_000
      };
    },
    async reservePlayerPot(payload) {
      calls.push(['reservePot', payload]);
      return {
        challenger: { ...payload.challenger, balance: 900 },
        opponent: { ...payload.opponent, balance: 900 },
        pot: payload.bet * 2
      };
    },
    async resolveReservedPlayerStackPot(payload) {
      calls.push(['resolveStackPot', payload]);
      return {
        challenger: { ...payload.challenger, balance: 900 + payload.challengerPayout },
        opponent: { ...payload.opponent, balance: 900 + payload.opponentPayout },
        winner: payload.winnerUserId
          ? {
            userId: payload.winnerUserId,
            username: payload.winnerUserId === 'user-1' ? payload.challenger.username : payload.opponent.username,
            balance: payload.winnerUserId === 'user-1'
              ? 900 + payload.challengerPayout
              : 900 + payload.opponentPayout
          }
          : null,
        pot: payload.pot
      };
    }
  };
  const pokerDeck = [
    'A♠', 'A♥',
    'K♠', 'Q♠',
    'J♠', '10♠', '9♠',
    '2♦',
    '3♣'
  ];
  const room = createChatInputInteraction('포커', {
    integers: { 시작칩: 100 }
  });

  assert.equal(await handleCasinoCommand(room, fakeEconomy, quietLogger, { playerPokerDeck: pokerDeck }), true);
  assert.match(room.replied.content, /텍사스 홀덤 포커방/);
  assert.match(room.replied.content, /인원: \*\*1명\*\* \/ 최대 \*\*6명\*\*/);
  assert.match(room.replied.content, /참가자: <@user-1>/);
  assert.doesNotMatch(room.replied.content, /<@user-2>/);
  assert.deepEqual(room.replied.allowedMentions, { parse: [] });

  const joinId = room.replied.components[0].components[0].data.custom_id;
  const join = createCasinoButtonInteraction({
    customId: joinId,
    userId: 'user-2'
  });
  assert.equal(await handleCasinoCommand(join, fakeEconomy, quietLogger, { playerPokerDeck: pokerDeck }), true);
  assert.match(join.updated.content, /인원: \*\*2명\*\* \/ 최대 \*\*6명\*\*/);
  assert.match(join.updated.content, /참가자: <@user-1>, <@user-2>/);
  assert.equal(calls.length, 0);

  const startId = join.updated.components[0].components[2].data.custom_id;
  const start = createCasinoButtonInteraction({
    customId: startId,
    userId: 'user-1'
  });
  assert.equal(await handleCasinoCommand(start, fakeEconomy, quietLogger, { playerPokerDeck: pokerDeck }), true);
  assert.match(start.updated.content, /텍사스 홀덤 진행 중/);
  assert.match(start.updated.content, /시작칩: \*\*100칩\*\*/);
  assert.match(start.updated.content, /블라인드: \*\*1\/2칩\*\*/);
  assert.match(start.updated.content, /팟: \*\*3칩\*\*/);
  assert.match(start.updated.content, /콜 필요: \*\*1칩\*\*/);
  assert.match(start.updated.content, /커뮤니티: 🂠 🂠 🂠 🂠 🂠/);
  assert.doesNotMatch(start.updated.content, /A♠/);
  assert.doesNotMatch(start.updated.content, /K♠/);
  assert.equal(start.updated.components[0].components[1].data.label, '콜 1칩');
  assert.equal(start.updated.components[1].components[2].data.label, '올인 99칩');
  assert.match(start.updated.content, /현재 차례: <@user-1>/);
  assert.deepEqual(start.updated.allowedMentions, {
    parse: [],
    users: ['user-1']
  });

  const peekId = start.updated.components[0].components[0].data.custom_id;
  const challengerPeek = createCasinoButtonInteraction({
    customId: peekId,
    userId: 'user-1'
  });
  assert.equal(await handleCasinoCommand(challengerPeek, fakeEconomy, quietLogger), true);
  assert.equal(challengerPeek.replied.flags, MessageFlags.Ephemeral);
  assert.match(challengerPeek.replied.content, /A♠ A♥/);
  assert.match(challengerPeek.replied.content, /내 스택: \*\*99칩\*\* \/ 콜 필요: \*\*1칩\*\*/);
  assert.doesNotMatch(challengerPeek.replied.content, /K♠ Q♠/);

  let message = start;
  const users = ['user-1', 'user-2', 'user-2', 'user-1', 'user-2', 'user-1', 'user-2', 'user-1'];
  for (const userId of users) {
    const checkId = message.updated.components[0].components[1].data.custom_id;
    const check = createCasinoButtonInteraction({
      customId: checkId,
      userId
    });
    assert.equal(await handleCasinoCommand(check, fakeEconomy, quietLogger), true);
    message = check;
  }

  assert.deepEqual(calls.map(([type]) => type), ['reservePot', 'resolveStackPot']);
  assert.equal(calls[1][1].winnerUserId, 'user-2');
  assert.equal(calls[1][1].challengerPayout, 98);
  assert.equal(calls[1][1].opponentPayout, 102);
  assert.equal(calls[1][1].pot, 4);
  assert.match(message.updated.content, /텍사스 홀덤 결과/);
  assert.match(message.updated.content, /커뮤니티: J♠ 10♠ 9♠ 2♦ 3♣/);
  assert.match(message.updated.content, /승자: <@user-2>/);
  assert.match(message.updated.content, /스트레이트 플러시/);
  assert.match(message.updated.content, /획득 팟: \*\*4칩\*\*/);
  assert.deepEqual(message.updated.allowedMentions, {
    parse: [],
    users: ['user-2', 'user-1']
  });
});

test('유저 포커는 폴드하면 즉시 상대가 팟을 가져간다', async () => {
  const calls = [];
  const fakeEconomy = {
    async getProfile(_guildId, userId, username) {
      return {
        userId,
        username,
        balance: 1_000
      };
    },
    async reservePlayerPot(payload) {
      calls.push(['reservePot', payload]);
      return {
        challenger: { ...payload.challenger, balance: 900 },
        opponent: { ...payload.opponent, balance: 900 },
        pot: payload.bet * 2
      };
    },
    async resolveReservedPlayerStackPot(payload) {
      calls.push(['resolveStackPot', payload]);
      return {
        challenger: { ...payload.challenger, balance: 900 + payload.challengerPayout },
        opponent: { ...payload.opponent, balance: 900 + payload.opponentPayout },
        winner: payload.winnerUserId
          ? {
            userId: payload.winnerUserId,
            username: payload.winnerUserId === 'user-1' ? payload.challenger.username : payload.opponent.username,
            balance: payload.winnerUserId === 'user-1'
              ? 900 + payload.challengerPayout
              : 900 + payload.opponentPayout
          }
          : null,
        pot: payload.pot
      };
    }
  };
  const room = createChatInputInteraction('포커', {
    integers: { 시작칩: 100 }
  });

  assert.equal(await handleCasinoCommand(room, fakeEconomy, quietLogger), true);
  const joinId = room.replied.components[0].components[0].data.custom_id;
  const join = createCasinoButtonInteraction({
    customId: joinId,
    userId: 'user-2'
  });
  assert.equal(await handleCasinoCommand(join, fakeEconomy, quietLogger), true);
  const startId = join.updated.components[0].components[2].data.custom_id;
  const start = createCasinoButtonInteraction({
    customId: startId,
    userId: 'user-1'
  });
  assert.equal(await handleCasinoCommand(start, fakeEconomy, quietLogger), true);

  const foldId = start.updated.components[0].components[2].data.custom_id;
  const fold = createCasinoButtonInteraction({
    customId: foldId,
    userId: 'user-1'
  });
  assert.equal(await handleCasinoCommand(fold, fakeEconomy, quietLogger), true);

  assert.deepEqual(calls.map(([type]) => type), ['reservePot', 'resolveStackPot']);
  assert.equal(calls[1][1].winnerUserId, 'user-2');
  assert.equal(calls[1][1].challengerPayout, 99);
  assert.equal(calls[1][1].opponentPayout, 101);
  assert.equal(calls[1][1].pot, 3);
  assert.match(fold.updated.content, /폴드/);
  assert.match(fold.updated.content, /획득 팟: \*\*3칩\*\*/);
  assert.match(fold.updated.content, /승자: <@user-2>/);
  assert.deepEqual(fold.updated.allowedMentions, {
    parse: [],
    users: ['user-2', 'user-1']
  });
});

test('유저 포커방은 3명 이상도 참가 버튼으로 들어와 방장이 시작한다', async () => {
  const calls = [];
  const fakeEconomy = {
    async getProfile(_guildId, userId, username) {
      return {
        userId,
        username,
        balance: 1_000
      };
    },
    async reservePlayerTablePot(payload) {
      calls.push(['reserveTablePot', payload]);
      return {
        players: payload.players.map((player) => ({ ...player, balance: 900 })),
        pot: payload.bet * payload.players.length
      };
    },
    async resolveReservedPlayerTableStacks(payload) {
      calls.push(['resolveTableStacks', payload]);
      return {
        players: payload.players.map((player) => ({
          ...player,
          balance: 900 + (payload.payouts[player.key] ?? 0)
        })),
        winner: null,
        pot: payload.pot
      };
    }
  };
  const room = createChatInputInteraction('포커', {
    integers: { 시작칩: 100 }
  });

  assert.equal(await handleCasinoCommand(room, fakeEconomy, quietLogger), true);
  assert.match(room.replied.content, /텍사스 홀덤 포커방/);
  assert.match(room.replied.content, /인원: \*\*1명\*\* \/ 최대 \*\*6명\*\*/);
  assert.match(room.replied.content, /참가자: <@user-1>/);
  assert.doesNotMatch(room.replied.content, /<@user-2>/);
  assert.deepEqual(room.replied.allowedMentions, { parse: [] });

  const joinId = room.replied.components[0].components[0].data.custom_id;
  const firstJoin = createCasinoButtonInteraction({
    customId: joinId,
    userId: 'user-2'
  });
  assert.equal(await handleCasinoCommand(firstJoin, fakeEconomy, quietLogger), true);
  assert.match(firstJoin.updated.content, /인원: \*\*2명\*\* \/ 최대 \*\*6명\*\*/);
  assert.match(firstJoin.updated.content, /참가자: <@user-1>, <@user-2>/);
  assert.equal(calls.length, 0);

  const secondJoin = createCasinoButtonInteraction({
    customId: joinId,
    userId: 'user-3'
  });
  assert.equal(await handleCasinoCommand(secondJoin, fakeEconomy, quietLogger), true);
  assert.match(secondJoin.updated.content, /인원: \*\*3명\*\* \/ 최대 \*\*6명\*\*/);
  assert.match(secondJoin.updated.content, /참가자: <@user-1>, <@user-2>, <@user-3>/);
  assert.equal(calls.length, 0);

  const startId = secondJoin.updated.components[0].components[2].data.custom_id;
  const start = createCasinoButtonInteraction({
    customId: startId,
    userId: 'user-1'
  });
  assert.equal(await handleCasinoCommand(start, fakeEconomy, quietLogger), true);
  assert.deepEqual(calls.map(([type]) => type), ['reserveTablePot']);
  assert.equal(calls[0][1].players.length, 3);
  assert.deepEqual(calls[0][1].players.map((player) => player.key), ['challenger', 'opponent', 'player2']);
  assert.match(start.updated.content, /텍사스 홀덤 진행 중/);
  assert.match(start.updated.content, /<@user-3>/);
  assert.match(start.updated.content, /현재 차례: <@user-1>/);
  assert.deepEqual(start.updated.allowedMentions, {
    parse: [],
    users: ['user-1']
  });
});

test('포커 명령은 시작칩만 받아 오픈 홀덤방을 만들고 시작 전에는 베팅을 예약하지 않는다', async () => {
  const calls = [];
  const fakeEconomy = {
    async getProfile(_guildId, userId, username) {
      return {
        userId,
        username,
        balance: 1_000
      };
    },
    async reserveWager() {
      throw new Error('오픈 홀덤방 생성은 5장 드로우 예약금을 잡지 않아야 합니다.');
    }
  };
  const interaction = createChatInputInteraction('포커', {
    integers: { 시작칩: 100 }
  });

  assert.equal(await handleCasinoCommand(interaction, fakeEconomy, quietLogger), true);
  assert.deepEqual(calls, []);
  assert.match(interaction.replied.content, /텍사스 홀덤 포커방/);
  assert.match(interaction.replied.content, /시작칩: \*\*100칩 = 100골드\*\*/);
  assert.match(interaction.replied.content, /시작하면 골드가 칩으로 바뀝니다/);
  assert.match(interaction.replied.content, /인원: \*\*1명\*\* \/ 최대 \*\*6명\*\*/);
  assert.match(interaction.replied.content, /방장은 2명 이상 모이면 \*\*시작\*\*/);
  assert.deepEqual(interaction.replied.components[0].components.map((component) => component.data.label), [
    '참가',
    '나가기',
    '시작',
    '취소'
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
  assert.equal(keno.payout, 17000);
});

test('포커는 5장 족보와 1회 교체 보상을 계산한다', () => {
  const royal = evaluatePokerHand(['A♠', 'K♠', 'Q♠', 'J♠', '10♠']);
  const wheelStraight = evaluatePokerHand(['A♣', '2♦', '3♠', '4♥', '5♣']);
  const highPair = evaluatePokerHand(['J♣', 'J♦', '2♠', '7♥', '9♣']);
  const lowPair = evaluatePokerHand(['10♣', '10♦', '2♠', '7♥', '9♣']);
  let round = createPokerRound({
    bet: 100,
    deck: ['A♠', 'A♥', '3♣', '4♦', '5♠', 'K♣', 'K♦', 'A♦', '2♣', '9♥']
  });
  const pairRecommendation = getPokerHoldRecommendation(round.hand);
  const flushRecommendation = getPokerHoldRecommendation(['A♠', 'K♠', '9♠', '2♠', '7♦']);

  round = applyPokerRecommendedHold(round);
  const drawn = drawPokerRound(round);
  const cleared = clearPokerHold(round);

  assert.equal(royal.id, 'royal_flush');
  assert.equal(royal.multiplier, 250);
  assert.equal(wheelStraight.id, 'straight');
  assert.equal(highPair.id, 'high_pair');
  assert.equal(highPair.multiplier, 1);
  assert.equal(lowPair.id, 'low_pair');
  assert.equal(lowPair.multiplier, 0);
  assert.deepEqual(pairRecommendation.heldIndexes, [0, 1]);
  assert.deepEqual(flushRecommendation.heldIndexes, [0, 1, 2, 3]);
  assert.deepEqual(drawn.hand, ['A♠', 'A♥', 'K♣', 'K♦', 'A♦']);
  assert.equal(drawn.handRank.id, 'full_house');
  assert.equal(drawn.payout, 900);
  assert.deepEqual(cleared.held, [false, false, false, false, false]);
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
  let activeScratchButton = null;
  const fakeEconomy = {
    async reserveWager(payload) {
      calls.push(['reserve', payload]);
      return { bet: payload.bet, profile: { balance: 9_000 } };
    },
    async resolveReservedWager(payload) {
      assert.equal(activeScratchButton?.deferred, true);
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
  assert.equal(firstPress.deferUpdateCalls, 1);
  assert.equal(firstPress.updateCalls, 0);
  assert.match(firstPress.updated.content, /방금 공개: \*\*1번\*\*/);
  assert.equal(firstPress.updated.components[0].components[0].data.disabled, true);
  assert.equal(firstPress.updated.components[0].components[0].data.style, ButtonStyle.Secondary);

  const duplicatePress = createCasinoButtonInteraction({ customId: firstButtonId });
  assert.equal(await handleCasinoCommand(duplicatePress, fakeEconomy, quietLogger), true);
  assert.equal(duplicatePress.replied.flags, MessageFlags.Ephemeral);
  assert.match(duplicatePress.replied.content, /이미 긁은/);
  assert.deepEqual(calls.map(([type]) => type), ['reserve']);

  const [, gameId] = firstButtonId.split(':');
  const secondPress = createCasinoButtonInteraction({
    customId: `scratch_reveal:${gameId}:1`
  });
  assert.equal(await handleCasinoCommand(secondPress, fakeEconomy, quietLogger), true);
  assert.equal(secondPress.deferUpdateCalls, 1);
  assert.equal(secondPress.updateCalls, 0);
  assert.match(secondPress.updated.content, /방금 공개: \*\*2번\*\*/);
  assert.equal(secondPress.updated.components[0].components[0].data.style, ButtonStyle.Secondary);
  assert.equal(secondPress.updated.components[0].components[1].data.style, ButtonStyle.Secondary);

  let finalPress = secondPress;
  for (let index = 2; index < SCRATCH_TICKET_SPOT_COUNT; index += 1) {
    finalPress = createCasinoButtonInteraction({
      customId: `scratch_reveal:${gameId}:${index}`
    });
    activeScratchButton = finalPress;
    assert.equal(await handleCasinoCommand(finalPress, fakeEconomy, quietLogger), true);
    activeScratchButton = null;
  }

  assert.deepEqual(calls.map(([type]) => type), ['reserve', 'resolve']);
  assert.equal(calls[1][1].payout, 20_000_000);
  assert.equal(finalPress.deferUpdateCalls, 1);
  assert.equal(finalPress.updateCalls, 0);
  assert.match(finalPress.updated.content, /스크래치 복권 당첨/);
  assert.match(finalPress.updated.content, /지급: 20,000,000골드/);
  assert.deepEqual(finalPress.updated.components, []);
});

test('스크래치복권 버튼은 같은 칸을 동시에 눌러도 중복 처리로 예약금을 환불하지 않는다', async () => {
  const calls = [];
  const fakeEconomy = {
    async reserveWager(payload) {
      calls.push(['reserve', payload]);
      return { bet: payload.bet, profile: { balance: 9_000 } };
    },
    async resolveReservedWager(payload) {
      calls.push(['resolve', payload]);
      return { bet: payload.bet, payout: payload.payout, profit: 0, profile: { balance: 9_000 } };
    },
    async refundReservedWager(payload) {
      calls.push(['refund', payload]);
      return { bet: payload.bet, payout: payload.bet, profit: 0, profile: { balance: 10_000 } };
    }
  };
  const interaction = createChatInputInteraction('스크래치복권', {
    strings: { 종류: 'mini' }
  });
  await handleCasinoCommand(interaction, fakeEconomy, quietLogger, {
    randomInt: (min) => min
  });

  const firstButtonId = interaction.replied.components[0].components[0].data.custom_id;
  let releaseDefers;
  const deferGate = new Promise((resolve) => {
    releaseDefers = resolve;
  });
  const firstPress = createCasinoButtonInteraction({ customId: firstButtonId });
  const secondPress = createCasinoButtonInteraction({ customId: firstButtonId });
  for (const press of [firstPress, secondPress]) {
    press.deferUpdate = async function deferUntilReleased() {
      this.deferred = true;
      this.deferUpdateCalls += 1;
      await deferGate;
    };
  }

  const firstPromise = handleCasinoCommand(firstPress, fakeEconomy, quietLogger);
  const secondPromise = handleCasinoCommand(secondPress, fakeEconomy, quietLogger);
  releaseDefers();
  await Promise.all([firstPromise, secondPromise]);

  const presses = [firstPress, secondPress];
  const progressPress = presses.find((press) => /방금 공개/.test(press.updated?.content ?? ''));
  const duplicatePress = presses.find((press) =>
    press.followUps.some((payload) => /이미 긁은/.test(payload.content ?? ''))
  );

  assert.ok(progressPress);
  assert.ok(duplicatePress);
  assert.deepEqual(presses.map((press) => press.deferUpdateCalls), [1, 1]);
  assert.deepEqual(presses.map((press) => press.updateCalls), [0, 0]);
  assert.deepEqual(calls.map(([type]) => type), ['reserve']);
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

test('텍사스 홀덤은 비공개 패와 커뮤니티 카드 중 최고 5장으로 승자를 비교한다', () => {
  const round = createPlayerHoldemRound({
    bet: 100,
    deck: [
      'A♠', 'A♥',
      'K♠', 'Q♠',
      'J♠', '10♠', '9♠',
      '2♦',
      '3♣'
    ]
  });
  const actions = [
    ['challenger', 'call'],
    ['opponent', 'check'],
    ['opponent', 'check'],
    ['challenger', 'check'],
    ['opponent', 'check'],
    ['challenger', 'check'],
    ['opponent', 'check'],
    ['challenger', 'check']
  ];
  const settled = actions.reduce(
    (nextRound, [participant, action]) => actPlayerHoldemRound(nextRound, participant, action),
    round
  );

  assert.equal(round.currentTurn, 'challenger');
  assert.equal(round.revealedCommunityCount, 0);
  assert.equal(round.smallBlind, 1);
  assert.equal(round.bigBlind, 2);
  assert.equal(round.pot, 3);
  assert.equal(round.currentBet, 2);
  assert.equal(round.challenger.stack, 99);
  assert.equal(round.opponent.stack, 98);
  assert.equal(settled.status, 'settled');
  assert.equal(settled.challenger.handRank.label, '원페어');
  assert.equal(settled.opponent.handRank.label, '스트레이트 플러시');
  assert.equal(settled.winner, 'opponent');
  assert.equal(settled.pot, 4);
  assert.equal(settled.challenger.stack, 98);
  assert.equal(settled.opponent.stack, 102);
  assert.equal(evaluateBestPokerHand([
    ...settled.opponent.holeCards,
    ...settled.communityCards
  ]).label, '스트레이트 플러시');
  assert.ok(comparePokerHands(
    [...settled.opponent.holeCards, ...settled.communityCards],
    [...settled.challenger.holeCards, ...settled.communityCards]
  ) > 0);
});

test('텍사스 홀덤은 블라인드 뒤 콜/체크로 플랍을 열고 실제 팟과 스택을 갱신한다', () => {
  const round = createPlayerHoldemRound({ bet: 100 });

  assert.equal(round.street, 'preflop');
  assert.equal(round.button, 'challenger');
  assert.equal(round.smallBlind, 1);
  assert.equal(round.bigBlind, 2);
  assert.equal(round.pot, 3);
  assert.equal(round.currentBet, 2);
  assert.equal(round.minRaise, 2);
  assert.equal(round.challenger.streetCommitted, 1);
  assert.equal(round.opponent.streetCommitted, 2);
  assert.equal(round.challenger.stack, 99);
  assert.equal(round.opponent.stack, 98);
  assert.equal(round.currentTurn, 'challenger');

  const called = actPlayerHoldemRound(round, 'challenger', 'call');
  assert.equal(called.pot, 4);
  assert.equal(called.challenger.stack, 98);
  assert.equal(called.challenger.streetCommitted, 2);
  assert.equal(called.currentTurn, 'opponent');

  const flop = actPlayerHoldemRound(called, 'opponent', 'check');
  assert.equal(flop.street, 'flop');
  assert.equal(flop.revealedCommunityCount, 3);
  assert.equal(flop.pot, 4);
  assert.equal(flop.currentBet, 0);
  assert.equal(flop.challenger.streetCommitted, 0);
  assert.equal(flop.opponent.streetCommitted, 0);
  assert.equal(flop.currentTurn, 'opponent');
});

test('텍사스 홀덤은 3인 이상에서 버튼 뒤 스몰/빅 블라인드와 턴 순서를 적용한다', () => {
  const round = createPlayerHoldemRound({
    bet: 100,
    players: ['challenger', 'opponent', 'player2']
  });

  assert.equal(round.players.length, 3);
  assert.equal(round.button, 'challenger');
  assert.equal(round.smallBlindParticipant, 'opponent');
  assert.equal(round.bigBlindParticipant, 'player2');
  assert.equal(round.currentTurn, 'challenger');
  assert.equal(round.pot, 3);
  assert.equal(round.challenger.stack, 100);
  assert.equal(round.opponent.stack, 99);
  assert.equal(round.player2.stack, 98);

  const challengerCalls = actPlayerHoldemRound(round, 'challenger', 'call');
  assert.equal(challengerCalls.currentTurn, 'opponent');
  assert.equal(challengerCalls.pot, 5);

  const smallBlindCalls = actPlayerHoldemRound(challengerCalls, 'opponent', 'call');
  assert.equal(smallBlindCalls.currentTurn, 'player2');
  assert.equal(smallBlindCalls.pot, 6);

  const flop = actPlayerHoldemRound(smallBlindCalls, 'player2', 'check');
  assert.equal(flop.street, 'flop');
  assert.equal(flop.revealedCommunityCount, 3);
  assert.equal(flop.currentTurn, 'opponent');
  assert.equal(flop.currentBet, 0);
});

test('텍사스 홀덤은 팟 베팅과 콜로 다음 스트리트에 넘어간다', () => {
  const preflopCalled = actPlayerHoldemRound(createPlayerHoldemRound({ bet: 100 }), 'challenger', 'call');
  const flop = actPlayerHoldemRound(preflopCalled, 'opponent', 'check');
  const bet = actPlayerHoldemRound(flop, 'opponent', 'pot');

  assert.equal(bet.street, 'flop');
  assert.equal(bet.pot, 8);
  assert.equal(bet.currentBet, 4);
  assert.equal(bet.minRaise, 4);
  assert.equal(bet.opponent.stack, 94);
  assert.equal(bet.opponent.streetCommitted, 4);
  assert.equal(bet.currentTurn, 'challenger');

  const turn = actPlayerHoldemRound(bet, 'challenger', 'call');
  assert.equal(turn.street, 'turn');
  assert.equal(turn.revealedCommunityCount, 4);
  assert.equal(turn.pot, 12);
  assert.equal(turn.currentBet, 0);
  assert.equal(turn.challenger.stack, 94);
  assert.equal(turn.currentTurn, 'opponent');
});

test('텍사스 홀덤은 올인 콜이면 남은 커뮤니티를 열고 쇼다운한다', () => {
  const round = createPlayerHoldemRound({
    bet: 100,
    deck: [
      'A♠', 'A♥',
      'K♠', 'Q♠',
      'J♠', '10♠', '9♠',
      '2♦',
      '3♣'
    ]
  });
  const shoved = actPlayerHoldemRound(round, 'challenger', 'all_in');
  assert.equal(shoved.currentBet, 100);
  assert.equal(shoved.pot, 102);
  assert.equal(shoved.challenger.stack, 0);
  assert.equal(shoved.currentTurn, 'opponent');

  const settled = actPlayerHoldemRound(shoved, 'opponent', 'call');
  assert.equal(settled.status, 'settled');
  assert.equal(settled.settlementReason, 'showdown');
  assert.equal(settled.revealedCommunityCount, 5);
  assert.equal(settled.pot, 200);
  assert.equal(settled.winner, 'opponent');
  assert.equal(settled.challenger.stack, 0);
  assert.equal(settled.opponent.stack, 200);
});

test('텍사스 홀덤은 3인 올인 쇼다운에서 메인팟과 사이드팟을 나눠 정산한다', () => {
  const round = createPlayerHoldemRound({
    bet: 100,
    players: ['challenger', 'opponent', 'player2'],
    stacks: {
      challenger: 50,
      opponent: 100,
      player2: 100
    },
    deck: [
      'A♠', 'A♥',
      'K♣', 'K♦',
      'Q♣', 'Q♦',
      '2♠', '3♥', '4♦', '5♣', '9♠'
    ]
  });

  const challengerAllIn = actPlayerHoldemRound(round, 'challenger', 'all_in');
  const opponentCalls = actPlayerHoldemRound(challengerAllIn, 'opponent', 'call');
  const flop = actPlayerHoldemRound(opponentCalls, 'player2', 'call');
  const opponentAllIn = actPlayerHoldemRound(flop, 'opponent', 'all_in');
  const settled = actPlayerHoldemRound(opponentAllIn, 'player2', 'call');

  assert.equal(settled.status, 'settled');
  assert.equal(settled.pot, 250);
  assert.equal(settled.challenger.stack, 150);
  assert.equal(settled.opponent.stack, 100);
  assert.equal(settled.player2.stack, 0);
  assert.deepEqual(settled.pots.map((pot) => pot.amount), [150, 100]);
  assert.deepEqual(settled.pots.map((pot) => pot.winners), [['challenger'], ['opponent']]);
  assert.deepEqual(settled.winners, ['challenger', 'opponent']);
});

test('텍사스 홀덤은 폴드하면 쇼다운 없이 현재 팟만 상대가 가져간다', () => {
  const round = createPlayerHoldemRound({ bet: 100 });
  const folded = actPlayerHoldemRound(round, 'challenger', 'fold');

  assert.equal(folded.status, 'settled');
  assert.equal(folded.winner, 'opponent');
  assert.equal(folded.settlementReason, 'fold');
  assert.equal(folded.pot, 3);
  assert.equal(folded.challenger.stack, 99);
  assert.equal(folded.opponent.stack, 101);
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

test('카지노 베팅은 예전 1000조 상한을 넘어도 정산과 예약을 허용한다', async () => {
  const fixture = await createFixture();
  const oversizedBet = FORMER_CASINO_MAX_BET + 1;

  try {
    await fixture.store.save({
      guilds: {
        'guild-1': {
          users: {
            'user-1': {
              userId: 'user-1',
              username: '도박러',
              level: 1,
              xp: 0,
              totalXp: 0,
              balance: oversizedBet * 2
            },
            'user-2': {
              userId: 'user-2',
              username: '상대',
              level: 1,
              xp: 0,
              totalXp: 0,
              balance: oversizedBet * 2
            }
          }
        }
      }
    });

    const settlement = await fixture.economy.settleWager({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '도박러',
      bet: oversizedBet,
      payout: 0
    });
    const reservation = await fixture.economy.reservePlayerPot({
      guildId: 'guild-1',
      challenger: { userId: 'user-1', username: '도박러' },
      opponent: { userId: 'user-2', username: '상대' },
      bet: oversizedBet
    });

    const profile = await fixture.economy.getProfile('guild-1', 'user-1', '도박러');
    assert.equal(settlement.bet, oversizedBet);
    assert.equal(settlement.profile.balance, oversizedBet);
    assert.equal(reservation.pot, oversizedBet * 2);
    assert.equal(profile.balance, 0);
  } finally {
    await fixture.cleanup();
  }
});

test('베팅 정산은 안전 정수 한도를 넘어도 잔액을 0으로 초기화하지 않는다', async () => {
  const fixture = await createFixture();

  try {
    await fixture.economy.getProfile('guild-1', 'user-1', '거액도박러');
    await fixture.store.update((data) => {
      data.accounts.users['user-1'].balance = '900719925474099199999';
    });

    const settlement = await fixture.economy.settleWager({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '거액도박러',
      bet: 100,
      payout: 190
    });
    const profile = await fixture.economy.getProfile('guild-1', 'user-1', '거액도박러');

    assert.equal(settlement.profile.balance, '900719925474099200089');
    assert.equal(profile.balance, '900719925474099200089');
  } finally {
    await fixture.cleanup();
  }
});

test('베팅 정산은 계산된 지급액이 안전 정수 한도를 넘어도 정확한 금액으로 정산한다', async () => {
  const fixture = await createFixture();

  try {
    await fixture.economy.getProfile('guild-1', 'user-1', '거액도박러');
    await fixture.store.update((data) => {
      data.accounts.users['user-1'].balance = '900719925474099199999';
    });

    const settlement = await fixture.economy.settleWager({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '거액도박러',
      bet: 100,
      payout: '900719925474099300001'
    });

    assert.equal(settlement.payout, '900719925474099300001');
    assert.equal(settlement.profit, '900719925474099299901');
    assert.equal(settlement.profile.balance, '1801439850948198499900');
  } finally {
    await fixture.cleanup();
  }
});

test('데드라인은 예전 1000조 상한을 넘겨도 누적 보상과 정산액을 유지한다', () => {
  let round = createDeadlineRound({ bet: FORMER_CASINO_MAX_BET + 1 });

  for (let index = 0; index < DEADLINE_MAX_SAFE_PRESSES; index += 1) {
    round = pressDeadlineRound(round, { randomInt: () => DEADLINE_ROLL_MAX });
  }

  assert.equal(round.status, 'cashed_out');
  assert.ok(Number.isSafeInteger(round.reward));
  assert.ok(Number.isSafeInteger(round.payout));
  assert.ok(round.payout >= FORMER_CASINO_MAX_BET);
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

test('수동 유저 포커 스택 정산은 예약 시작칩 안에서 부분 팟 반환을 지원한다', async () => {
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
      bet: 100
    });
    const settled = await fixture.economy.resolveReservedPlayerStackPot({
      guildId: 'guild-1',
      challenger: { userId: 'user-1', username: '도전자' },
      opponent: { userId: 'user-2', username: '상대' },
      bet: 100,
      pot: 3,
      winnerUserId: 'user-2',
      challengerPayout: 99,
      opponentPayout: 101
    });

    assert.equal(reserved.challenger.balance, 900);
    assert.equal(reserved.opponent.balance, 900);
    assert.equal(settled.pot, 3);
    assert.equal(settled.winner.userId, 'user-2');
    assert.equal(settled.challenger.balance, 999);
    assert.equal(settled.opponent.balance, 1001);
  } finally {
    await fixture.cleanup();
  }
});

const TEST_SOCIAL_LOAN_TERM_MS = 24 * 60 * 60 * 1000;

function createLoanCasinoProfile({
  userId,
  username,
  balance,
  stockDebt = 0,
  loans = null
}) {
  return {
    userId,
    username,
    level: 1,
    xp: 0,
    totalXp: 0,
    balance,
    stockBankruptcy: {
      debt: stockDebt,
      paid: 0,
      count: stockDebt > 0 ? 1 : 0,
      lastAt: stockDebt > 0 ? 1 : 0
    },
    socialLoans: {
      requests: [],
      loans: loans ?? [{
        id: 'loan-1',
        lenderUserId: 'lender',
        lenderUsername: '빌려준사람',
        principal: 1_000,
        totalDue: 1_000,
        repaid: 0,
        interestBps: 0,
        interestPeriodMs: TEST_SOCIAL_LOAN_TERM_MS,
        interestType: 'simple',
        termMs: TEST_SOCIAL_LOAN_TERM_MS,
        dueAt: TEST_SOCIAL_LOAN_TERM_MS,
        acceptedAt: 1,
        repaymentMode: 'installment',
        interestAccruedPeriods: 0,
        lastRepaymentAt: 0
      }]
    }
  };
}

test('카지노 스택 반환은 순손실이면 대출과 파산채무 자동상환을 발생시키지 않는다', async () => {
  const fixture = await createFixture();

  try {
    await fixture.store.update((data) => {
      data.guilds['guild-1'] = {
        users: {
          borrower: createLoanCasinoProfile({
            userId: 'borrower',
            username: '빌린도박러',
            balance: 1_000,
            stockDebt: 1_000
          }),
          opponent: createLoanCasinoProfile({
            userId: 'opponent',
            username: '상대',
            balance: 1_000
          }),
          lender: createLoanCasinoProfile({
            userId: 'lender',
            username: '빌려준사람',
            balance: 5_000,
            loans: []
          })
        }
      };
    });

    await fixture.economy.reservePlayerPot({
      guildId: 'guild-1',
      challenger: { userId: 'borrower', username: '빌린도박러' },
      opponent: { userId: 'opponent', username: '상대' },
      bet: 100
    });
    const settled = await fixture.economy.resolveReservedPlayerStackPot({
      guildId: 'guild-1',
      challenger: { userId: 'borrower', username: '빌린도박러' },
      opponent: { userId: 'opponent', username: '상대' },
      bet: 100,
      pot: 3,
      winnerUserId: 'opponent',
      challengerPayout: 99,
      opponentPayout: 101
    });
    const borrower = await fixture.economy.getProfile('guild-1', 'borrower', '빌린도박러');
    const lender = await fixture.economy.getProfile('guild-1', 'lender', '빌려준사람');

    assert.equal(settled.challenger.balance, 999);
    assert.equal(borrower.bankruptcy.debt, 1_000);
    assert.equal(borrower.socialLoans.loans[0].repaid, 0);
    assert.equal(lender.balance, 5_000);
  } finally {
    await fixture.cleanup();
  }
});

test('카지노 승리 자동상환은 총 지급액이 아니라 순수익에만 적용된다', async () => {
  const fixture = await createFixture();

  try {
    await fixture.store.update((data) => {
      data.guilds['guild-1'] = {
        users: {
          borrower: createLoanCasinoProfile({
            userId: 'borrower',
            username: '빌린도박러',
            balance: 1_000,
            stockDebt: 1_000
          }),
          opponent: createLoanCasinoProfile({
            userId: 'opponent',
            username: '상대',
            balance: 1_000,
            loans: []
          }),
          lender: createLoanCasinoProfile({
            userId: 'lender',
            username: '빌려준사람',
            balance: 5_000,
            loans: []
          })
        }
      };
    });

    await fixture.economy.reservePlayerPot({
      guildId: 'guild-1',
      challenger: { userId: 'borrower', username: '빌린도박러' },
      opponent: { userId: 'opponent', username: '상대' },
      bet: 100
    });
    const won = await fixture.economy.resolveReservedPlayerPot({
      guildId: 'guild-1',
      challenger: { userId: 'borrower', username: '빌린도박러' },
      opponent: { userId: 'opponent', username: '상대' },
      bet: 100,
      winnerUserId: 'borrower'
    });
    const borrower = await fixture.economy.getProfile('guild-1', 'borrower', '빌린도박러');
    const lender = await fixture.economy.getProfile('guild-1', 'lender', '빌려준사람');

    assert.equal(won.challenger.balance, 1_040);
    assert.equal(borrower.bankruptcy.debt, 975);
    assert.equal(borrower.socialLoans.loans[0].repaid, 35);
    assert.equal(lender.balance, 5_035);
  } finally {
    await fixture.cleanup();
  }
});

test('수동 유저 포커 테이블 정산은 3명 이상 예약과 스택 반환을 지원한다', async () => {
  const fixture = await createFixture({ dailyReward: 1000, dailyXpReward: 0 });

  try {
    for (const [userId, username] of [
      ['user-1', '도전자'],
      ['user-2', '상대1'],
      ['user-3', '상대2']
    ]) {
      await fixture.economy.claimDaily({
        guildId: 'guild-1',
        userId,
        username,
        now: 1000
      });
      await fixture.economy.exchangeWallet({
        guildId: 'guild-1',
        userId,
        username,
        fromCurrency: 'main',
        toCurrency: 'casino',
        amount: 1000
      });
    }

    const players = [
      { key: 'challenger', userId: 'user-1', username: '도전자' },
      { key: 'opponent', userId: 'user-2', username: '상대1' },
      { key: 'player2', userId: 'user-3', username: '상대2' }
    ];
    const reserved = await fixture.economy.reservePlayerTablePot({
      guildId: 'guild-1',
      players,
      bet: 100
    });
    const settled = await fixture.economy.resolveReservedPlayerTableStacks({
      guildId: 'guild-1',
      players,
      bet: 100,
      pot: 250,
      winnerUserIds: ['user-1', 'user-2'],
      payouts: {
        challenger: 150,
        opponent: 100,
        player2: 50
      }
    });

    assert.deepEqual(reserved.players.map((player) => player.balance), [900, 900, 900]);
    assert.equal(settled.pot, 250);
    assert.deepEqual(settled.winners.map((winner) => winner.userId), ['user-1', 'user-2']);
    assert.deepEqual(settled.players.map((player) => player.balance), [1050, 1000, 950]);
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
  const {
    integers = {},
    strings = {},
    targetUser = null,
    targetUsers = null,
    userId = 'user-1',
    username = '도박러',
    globalName = null,
    displayName = null,
    memberDisplayName = null,
    memberNickname = null
  } = options;

  return {
    commandName,
    guildId: 'guild-1',
    user: {
      id: userId,
      username,
      globalName,
      displayName,
      toString: () => `<@${userId}>`
    },
    member: memberDisplayName || memberNickname
      ? {
          displayName: memberDisplayName,
          nickname: memberNickname,
          user: {
            id: userId,
            username,
            globalName,
            displayName
          }
        }
      : null,
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
      getUser(name) {
        if (targetUsers) return targetUsers[name] ?? null;
        return name === '상대' ? targetUser : null;
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
    deferred: false,
    deferUpdateCalls: 0,
    editReplyCalls: 0,
    followUps: [],
    updateCalls: 0,
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
    async deferUpdate() {
      this.deferred = true;
      this.deferUpdateCalls += 1;
    },
    async editReply(payload) {
      this.editReplyCalls += 1;
      this.updated = typeof payload === 'string'
        ? { content: payload }
        : payload;
    },
    async followUp(payload) {
      this.followUps.push(typeof payload === 'string'
        ? { content: payload }
        : payload);
    },
    async update(payload) {
      this.updateCalls += 1;
      this.updated = payload;
    }
  };
}

function createUnknownInteractionError() {
  const error = new Error('Unknown interaction');
  error.code = 10062;
  error.rawError = { code: 10062 };
  return error;
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
