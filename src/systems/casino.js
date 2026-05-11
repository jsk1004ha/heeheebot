const CARD_RANKS = Object.freeze(['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']);
const SLOT_SYMBOLS = Object.freeze(['🍒', '🍋', '🍇', '🔔', '⭐', '💎', '7️⃣', '🍀', '🍉', '🍊']);
const ROULETTE_RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const KENO_MIN_NUMBER = 1;
const KENO_MAX_NUMBER = 80;
const KENO_DRAW_COUNT = 10;
const KENO_MAX_PICKS = 5;
export const DEADLINE_MAX_SAFE_PRESSES = 12;
export const DEADLINE_MIN_BET = 100;
export const DEADLINE_ROLL_MAX = 10_000;
const DEADLINE_BASE_BUST_CHANCE_BPS = 1_000;
const DEADLINE_BUST_CHANCE_STEP_BPS = 750;
const DEADLINE_MAX_BUST_CHANCE_BPS = 8_500;
const DEADLINE_BASE_REWARD_BPS = 500;
const DEADLINE_REWARD_STEP_BPS = 800;
export const TIMING_TARGET_MIN_SECONDS = 5;
export const TIMING_TARGET_MAX_SECONDS = 20;
export const TIMING_PAYOUT_TIERS = Object.freeze([
  Object.freeze({ maxDifferenceMs: 20, multiplier: 5, label: '0.02초 이하' }),
  Object.freeze({ maxDifferenceMs: 50, multiplier: 3, label: '0.05초 이하' }),
  Object.freeze({ maxDifferenceMs: 100, multiplier: 2, label: '0.1초 이하' }),
  Object.freeze({ maxDifferenceMs: 200, multiplier: 1.8, label: '0.2초 이하' }),
  Object.freeze({ maxDifferenceMs: 500, multiplier: 1.3, label: '0.5초 이하' })
]);
const KENO_MULTIPLIERS = Object.freeze({
  1: Object.freeze({ 1: 7 }),
  2: Object.freeze({ 1: 1, 2: 45 }),
  3: Object.freeze({ 1: 1, 2: 8, 3: 170 }),
  4: Object.freeze({ 1: 1, 2: 3, 3: 40, 4: 1000 }),
  5: Object.freeze({ 1: 1, 2: 2, 3: 14, 4: 120, 5: 3000 })
});
export const EMOJI_RACE_TRACK_LENGTH = 9;
export const EMOJI_RACE_MULTIPLIER = 2.7;
export const EMOJI_RACE_RACERS = Object.freeze([
  Object.freeze({ id: 'horse', number: 1, name: '말', emoji: '🐎' }),
  Object.freeze({ id: 'dog', number: 2, name: '강아지', emoji: '🐕' }),
  Object.freeze({ id: 'turtle', number: 3, name: '거북이', emoji: '🐢' })
]);
export const SCRATCH_TICKET_SPOT_COUNT = 9;
export const SCRATCH_TICKET_ROLL_MAX = 1_000_000;
export const SCRATCH_TICKET_DEFAULT_PRODUCT_ID = 'mini';
export const SCRATCH_TICKET_PRODUCTS = Object.freeze([
  scratchTicketProduct({
    id: 'mega',
    name: '황금 5억',
    price: 10_000,
    topPrize: 500_000_000,
    prizeTiers: [
      scratchTicketTier(500_000_000, 1),
      scratchTicketTier(100_000_000, 5),
      scratchTicketTier(20_000_000, 25),
      scratchTicketTier(5_000_000, 120),
      scratchTicketTier(1_000_000, 700),
      scratchTicketTier(100_000, 5_000),
      scratchTicketTier(50_000, 20_000),
      scratchTicketTier(20_000, 75_000),
      scratchTicketTier(10_000, 150_000),
      scratchTicketTier(5_000, 120_000),
      scratchTicketTier(3_000, 150_000),
      scratchTicketTier(1_000, 100_000)
    ]
  }),
  scratchTicketProduct({
    id: 'royal',
    name: '행운 1억',
    price: 3_000,
    topPrize: 100_000_000,
    prizeTiers: [
      scratchTicketTier(100_000_000, 1),
      scratchTicketTier(20_000_000, 5),
      scratchTicketTier(5_000_000, 25),
      scratchTicketTier(1_000_000, 150),
      scratchTicketTier(200_000, 1_000),
      scratchTicketTier(50_000, 8_000),
      scratchTicketTier(10_000, 50_000),
      scratchTicketTier(5_000, 120_000),
      scratchTicketTier(3_000, 150_000),
      scratchTicketTier(2_000, 70_000),
      scratchTicketTier(1_000, 100_000),
      scratchTicketTier(500, 100_000)
    ]
  }),
  scratchTicketProduct({
    id: 'mini',
    name: '미니 2000만',
    price: 1_000,
    topPrize: 20_000_000,
    prizeTiers: [
      scratchTicketTier(20_000_000, 1),
      scratchTicketTier(5_000_000, 4),
      scratchTicketTier(1_000_000, 20),
      scratchTicketTier(200_000, 150),
      scratchTicketTier(50_000, 1_500),
      scratchTicketTier(10_000, 15_000),
      scratchTicketTier(5_000, 60_000),
      scratchTicketTier(1_000, 180_000),
      scratchTicketTier(500, 120_000),
      scratchTicketTier(300, 100_000),
      scratchTicketTier(100, 100_000)
    ]
  })
]);
const SCRATCH_TICKET_PRODUCT_BY_ID = new Map(
  SCRATCH_TICKET_PRODUCTS.map((product) => [product.id, product])
);

export function playOddEven({ choice, bet, randomInt = defaultRandomInt }) {
  const normalizedChoice = normalizeOddEvenChoice(choice);
  const roll = randomInt(1, 100);
  const parity = roll % 2 === 0 ? 'even' : 'odd';
  const win = roll <= 98 && normalizedChoice === parity;
  const payout = win ? Math.floor(bet * 1.9) : 0;

  return {
    game: '홀짝',
    choice: normalizedChoice,
    roll,
    outcome: parity,
    win,
    multiplier: win ? 1.9 : 0,
    payout
  };
}

export function playDice({ choice, bet, randomInt = defaultRandomInt }) {
  const normalizedChoice = normalizeDiceChoice(choice);
  const roll = randomInt(1, 6);
  const outcome = roll >= 4 ? 'high' : 'low';
  const win = normalizedChoice === outcome;
  const payout = win ? Math.floor(bet * 1.9) : 0;

  return {
    game: '주사위',
    choice: normalizedChoice,
    roll,
    outcome,
    win,
    multiplier: win ? 1.9 : 0,
    payout
  };
}

export function playSlots({ bet, randomInt = defaultRandomInt }) {
  const reels = [
    SLOT_SYMBOLS[randomInt(0, SLOT_SYMBOLS.length - 1)],
    SLOT_SYMBOLS[randomInt(0, SLOT_SYMBOLS.length - 1)],
    SLOT_SYMBOLS[randomInt(0, SLOT_SYMBOLS.length - 1)]
  ];

  const counts = new Map();
  for (const symbol of reels) {
    counts.set(symbol, (counts.get(symbol) ?? 0) + 1);
  }

  const maxCount = Math.max(...counts.values());
  const multiplier = getSlotMultiplier(reels, maxCount);

  return {
    game: '슬롯',
    reels,
    win: multiplier > 0,
    multiplier,
    payout: bet * multiplier
  };
}

export function playLuckySeven({ bet, randomInt = defaultRandomInt }) {
  const dice = [
    randomInt(1, 6),
    randomInt(1, 6)
  ];
  const total = dice[0] + dice[1];
  const win = total === 7;
  const multiplier = win ? 5.5 : 0;

  return {
    game: '럭키세븐',
    dice,
    total,
    win,
    multiplier,
    payout: win ? Math.floor(bet * multiplier) : 0
  };
}

export function playHighLow({ choice, bet, randomInt = defaultRandomInt }) {
  const normalizedChoice = normalizeHighLowChoice(choice);
  const firstCard = drawCard(randomInt);
  const secondCard = drawCard(randomInt);
  const firstValue = getCardRankValue(firstCard);
  const secondValue = getCardRankValue(secondCard);
  const outcome = secondValue > firstValue
    ? 'high'
    : secondValue < firstValue
      ? 'low'
      : 'tie';
  const push = outcome === 'tie';
  const win = normalizedChoice === outcome;
  const multiplier = win ? 1.9 : push ? 1 : 0;

  return {
    game: '하이로우',
    choice: normalizedChoice,
    firstCard,
    secondCard,
    firstValue,
    secondValue,
    outcome,
    win,
    push,
    multiplier,
    payout: Math.floor(bet * multiplier)
  };
}

export function playRoulette({ choice, bet, randomInt = defaultRandomInt }) {
  const normalizedChoice = normalizeRouletteChoice(choice);
  const roll = randomInt(0, 36);
  const color = getRouletteColor(roll);
  const win = isRouletteWin(normalizedChoice, roll, color);
  const multiplier = normalizedChoice === 'zero' ? 36 : 2;

  return {
    game: '룰렛',
    choice: normalizedChoice,
    roll,
    color,
    win,
    multiplier: win ? multiplier : 0,
    payout: win ? bet * multiplier : 0
  };
}

export function playBaccarat({ choice, bet, randomInt = defaultRandomInt }) {
  const normalizedChoice = normalizeBaccaratChoice(choice);
  const playerHand = [drawCard(randomInt), drawCard(randomInt)];
  const bankerHand = [drawCard(randomInt), drawCard(randomInt)];
  const playerInitial = baccaratHandValue(playerHand);
  const bankerInitial = baccaratHandValue(bankerHand);
  let playerThird = null;

  if (playerInitial < 8 && bankerInitial < 8) {
    if (playerInitial <= 5) {
      playerThird = drawCard(randomInt);
      playerHand.push(playerThird);
    }

    if (shouldBankerDraw(bankerInitial, playerThird)) {
      bankerHand.push(drawCard(randomInt));
    }
  }

  const playerValue = baccaratHandValue(playerHand);
  const bankerValue = baccaratHandValue(bankerHand);
  const result = playerValue > bankerValue
    ? 'player'
    : bankerValue > playerValue
      ? 'banker'
      : 'tie';
  const win = normalizedChoice === result;
  const payout = win ? getBaccaratPayout(normalizedChoice, bet) : 0;

  return {
    game: '바카라',
    choice: normalizedChoice,
    playerHand,
    bankerHand,
    playerValue,
    bankerValue,
    result,
    win,
    payout
  };
}

export function playCraps({ choice, bet, randomInt = defaultRandomInt }) {
  const normalizedChoice = normalizeCrapsChoice(choice);
  const rolls = [];
  const comeOut = rollDicePair(randomInt);
  rolls.push(comeOut);

  if ([7, 11].includes(comeOut.total)) {
    return formatCrapsResult(normalizedChoice, bet, rolls, normalizedChoice === 'pass' ? 'win' : 'lose');
  }

  if ([2, 3].includes(comeOut.total)) {
    return formatCrapsResult(normalizedChoice, bet, rolls, normalizedChoice === 'pass' ? 'lose' : 'win');
  }

  if (comeOut.total === 12) {
    return formatCrapsResult(normalizedChoice, bet, rolls, normalizedChoice === 'pass' ? 'lose' : 'push');
  }

  const point = comeOut.total;
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const roll = rollDicePair(randomInt);
    rolls.push(roll);

    if (roll.total === point) {
      return formatCrapsResult(normalizedChoice, bet, rolls, normalizedChoice === 'pass' ? 'win' : 'lose', point);
    }

    if (roll.total === 7) {
      return formatCrapsResult(normalizedChoice, bet, rolls, normalizedChoice === 'pass' ? 'lose' : 'win', point);
    }
  }

  throw new Error('크랩스 결과를 확정하지 못했습니다. 다시 시도해주세요.');
}

export function playSicBo({ choice, bet, randomInt = defaultRandomInt }) {
  const normalizedChoice = normalizeSicBoChoice(choice);
  const dice = [
    randomInt(1, 6),
    randomInt(1, 6),
    randomInt(1, 6)
  ];
  const total = dice.reduce((sum, value) => sum + value, 0);
  const triple = dice.every((value) => value === dice[0]);
  const win = normalizedChoice === 'triple'
    ? triple
    : !triple && (
      normalizedChoice === 'small'
        ? total >= 4 && total <= 10
        : total >= 11 && total <= 17
    );
  const multiplier = normalizedChoice === 'triple' ? 31 : 2;

  return {
    game: '시크보',
    choice: normalizedChoice,
    dice,
    total,
    triple,
    win,
    multiplier: win ? multiplier : 0,
    payout: win ? bet * multiplier : 0
  };
}

export function playKeno({ numbers, bet, randomInt = defaultRandomInt }) {
  const picks = parseKenoNumbers(numbers);
  const draw = drawKenoNumbers(randomInt);
  const drawSet = new Set(draw);
  const hits = picks.filter((number) => drawSet.has(number));
  const multiplier = KENO_MULTIPLIERS[picks.length][hits.length] ?? 0;

  return {
    game: '키노',
    picks,
    draw,
    hits,
    win: multiplier > 0,
    multiplier,
    payout: bet * multiplier
  };
}

export function createScratchTicket({
  productId = SCRATCH_TICKET_DEFAULT_PRODUCT_ID,
  randomInt = defaultRandomInt
} = {}) {
  const product = getScratchTicketProduct(productId);
  const winningTier = drawScratchTicketPrizeTier(product, randomInt);
  const spots = winningTier
    ? createWinningScratchTicketSpots(product, winningTier, randomInt)
    : createLosingScratchTicketSpots(product, randomInt);

  return buildScratchTicket({
    productId: product.id,
    spots,
    revealed: Array.from({ length: SCRATCH_TICKET_SPOT_COUNT }, () => false),
    status: 'scratching',
    lastRevealedIndex: null
  });
}

export function revealScratchTicketSpot(ticket, index) {
  const current = buildScratchTicket(ticket);
  assertScratchTicketInProgress(current);
  const normalizedIndex = normalizeScratchTicketSpotIndex(index);

  if (current.revealed[normalizedIndex]) {
    throw new Error('이미 긁은 복권 칸입니다.');
  }

  const revealed = [...current.revealed];
  revealed[normalizedIndex] = true;
  const revealCount = revealed.filter(Boolean).length;

  return buildScratchTicket({
    ...current,
    revealed,
    status: revealCount >= SCRATCH_TICKET_SPOT_COUNT ? 'settled' : 'scratching',
    lastRevealedIndex: normalizedIndex
  });
}

export function revealAllScratchTicketSpots(ticket) {
  const current = buildScratchTicket(ticket);

  if (current.status === 'settled') return current;

  return buildScratchTicket({
    ...current,
    revealed: Array.from({ length: SCRATCH_TICKET_SPOT_COUNT }, () => true),
    status: 'settled',
    lastRevealedIndex: null
  });
}

export function getScratchTicketProduct(productId = SCRATCH_TICKET_DEFAULT_PRODUCT_ID) {
  const normalizedId = normalizeScratchTicketProductId(productId);
  return SCRATCH_TICKET_PRODUCT_BY_ID.get(normalizedId);
}

export function normalizeScratchTicketProductId(productId = SCRATCH_TICKET_DEFAULT_PRODUCT_ID) {
  const normalized = String(productId ?? SCRATCH_TICKET_DEFAULT_PRODUCT_ID)
    .trim()
    .toLocaleLowerCase('ko-KR')
    .replace(/\s+/g, '');

  if (['mega', '황금5억', '5억', '오억', 'gold', 'jackpot'].includes(normalized)) return 'mega';
  if (['royal', '행운1억', '1억', '일억', 'lucky'].includes(normalized)) return 'royal';
  if (['mini', '미니2000만', '2000만', '2천만', '이천만'].includes(normalized)) return 'mini';

  throw new Error('스크래치 복권 종류는 미니 2000만, 행운 1억, 황금 5억 중 하나여야 합니다.');
}

export function getScratchTicketProductStats(productId = SCRATCH_TICKET_DEFAULT_PRODUCT_ID) {
  const product = getScratchTicketProduct(productId);
  const totalWinningTickets = product.prizeTiers.reduce((sum, tier) => sum + tier.chance, 0);
  const expectedPayout = product.prizeTiers.reduce(
    (sum, tier) => sum + tier.amount * tier.chance,
    0
  ) / SCRATCH_TICKET_ROLL_MAX;

  return {
    productId: product.id,
    price: product.price,
    topPrize: product.topPrize,
    totalWinningTickets,
    winChance: totalWinningTickets / SCRATCH_TICKET_ROLL_MAX,
    winChanceBasisPoints: Math.round(totalWinningTickets * 10_000 / SCRATCH_TICKET_ROLL_MAX),
    expectedPayout,
    rtp: expectedPayout / product.price
  };
}

export function formatScratchPrizeShort(amount) {
  const normalizedAmount = normalizeNonNegativeSafeInteger(amount, '당첨금');

  if (normalizedAmount >= 100_000_000 && normalizedAmount % 100_000_000 === 0) {
    return `${normalizedAmount / 100_000_000}억`;
  }

  if (normalizedAmount >= 10_000 && normalizedAmount % 10_000 === 0) {
    return `${normalizedAmount / 10_000}만`;
  }

  return normalizedAmount.toLocaleString();
}


export function createDeadlineRound({ bet } = {}) {
  const normalizedBet = normalizeDeadlineBet(bet);

  return buildDeadlineRound({
    bet: normalizedBet,
    presses: 0,
    reward: 0,
    status: 'pressing',
    lastRoll: null,
    lastReward: 0,
    lostReward: 0,
    busted: false,
    payout: 0,
    autoCashedOut: false
  });
}

export function pressDeadlineRound(round, { randomInt = defaultRandomInt } = {}) {
  assertDeadlinePressingRound(round);

  const bustChanceBps = getDeadlineBustChanceBps(round.presses);
  const roll = randomInt(1, DEADLINE_ROLL_MAX);

  if (roll <= bustChanceBps) {
    return buildDeadlineRound({
      ...round,
      status: 'busted',
      lastRoll: roll,
      lastReward: 0,
      lostReward: round.reward,
      busted: true,
      payout: 0
    });
  }

  const lastReward = getDeadlineNextReward(round.bet, round.presses);
  const presses = round.presses + 1;
  const reward = round.reward + lastReward;
  const autoCashedOut = presses >= DEADLINE_MAX_SAFE_PRESSES;
  const status = autoCashedOut ? 'cashed_out' : 'pressing';

  return buildDeadlineRound({
    ...round,
    presses,
    reward,
    status,
    lastRoll: roll,
    lastReward,
    lostReward: 0,
    busted: false,
    payout: status === 'cashed_out' ? round.bet + reward : 0,
    autoCashedOut
  });
}

export function cashOutDeadlineRound(round) {
  assertDeadlinePressingRound(round);

  return buildDeadlineRound({
    ...round,
    status: 'cashed_out',
    payout: round.bet + round.reward,
    autoCashedOut: false
  });
}

export function getDeadlineBustChanceBps(presses) {
  const normalizedPresses = normalizeNonNegativeSafeInteger(presses, '누른 횟수');

  return Math.min(
    DEADLINE_MAX_BUST_CHANCE_BPS,
    DEADLINE_BASE_BUST_CHANCE_BPS + normalizedPresses * DEADLINE_BUST_CHANCE_STEP_BPS
  );
}

export function getDeadlineNextReward(bet, presses) {
  const normalizedBet = normalizeDeadlineBet(bet);
  const normalizedPresses = normalizeNonNegativeSafeInteger(presses, '누른 횟수');
  const rewardBps = DEADLINE_BASE_REWARD_BPS + normalizedPresses * DEADLINE_REWARD_STEP_BPS;

  return Math.max(1, Math.floor(normalizedBet * rewardBps / 10_000));
}


export function createTimingRound({
  bet,
  randomInt = defaultRandomInt,
  nowMs = defaultNowMs
} = {}) {
  const normalizedBet = normalizeTimingBet(bet);
  const targetSeconds = randomInt(TIMING_TARGET_MIN_SECONDS, TIMING_TARGET_MAX_SECONDS);

  if (!Number.isSafeInteger(targetSeconds)
    || targetSeconds < TIMING_TARGET_MIN_SECONDS
    || targetSeconds > TIMING_TARGET_MAX_SECONDS) {
    throw new Error(`타이밍 목표 초는 ${TIMING_TARGET_MIN_SECONDS}~${TIMING_TARGET_MAX_SECONDS}초 사이여야 합니다.`);
  }

  return buildTimingRound({
    bet: normalizedBet,
    targetSeconds,
    targetMs: targetSeconds * 1000,
    startedAtMs: normalizeTimestampMs(nowMs(), '시작 시각'),
    status: 'waiting',
    pressedAtMs: null,
    elapsedMs: null,
    elapsedSeconds: null,
    differenceMs: null,
    differenceSeconds: null,
    tier: null,
    win: false,
    multiplier: 0,
    payout: 0
  });
}

export function resolveTimingRound(round, { nowMs = defaultNowMs } = {}) {
  assertTimingWaitingRound(round);

  const pressedAtMs = normalizeTimestampMs(nowMs(), '버튼 입력 시각');
  const elapsedMs = Math.max(0, pressedAtMs - round.startedAtMs);
  const differenceMs = Math.abs(elapsedMs - round.targetMs);
  const tier = getTimingPayoutTier(differenceMs);
  const multiplier = tier?.multiplier ?? 0;
  const payout = multiplier > 0 ? Math.floor(round.bet * multiplier) : 0;

  return buildTimingRound({
    ...round,
    status: 'settled',
    pressedAtMs,
    elapsedMs,
    elapsedSeconds: elapsedMs / 1000,
    differenceMs,
    differenceSeconds: differenceMs / 1000,
    tier,
    win: payout > 0,
    multiplier,
    payout
  });
}

export function getTimingPayoutTier(differenceMs) {
  const normalizedDifferenceMs = normalizeNonNegativeFiniteNumber(differenceMs, '오차');

  return TIMING_PAYOUT_TIERS.find((tier) => normalizedDifferenceMs <= tier.maxDifferenceMs) ?? null;
}

export function playEmojiRace({
  choice,
  bet,
  randomInt = defaultRandomInt,
  trackLength = EMOJI_RACE_TRACK_LENGTH
} = {}) {
  const normalizedChoice = normalizeEmojiRaceChoice(choice);
  const finishLine = normalizeEmojiRaceTrackLength(trackLength);
  const positions = Object.fromEntries(EMOJI_RACE_RACERS.map((racer) => [racer.id, 0]));
  const frames = [
    createEmojiRaceFrame({
      turn: 0,
      positions,
      trackLength: finishLine
    })
  ];

  for (let turn = 1; turn <= finishLine + 1; turn += 1) {
    const rawPositions = {};

    for (const racer of EMOJI_RACE_RACERS) {
      rawPositions[racer.id] = positions[racer.id] + randomInt(1, 3);
      positions[racer.id] = Math.min(finishLine, rawPositions[racer.id]);
    }

    const finishers = EMOJI_RACE_RACERS.filter((racer) => rawPositions[racer.id] >= finishLine);

    if (finishers.length > 0) {
      const winner = pickEmojiRaceWinner(finishers, rawPositions, randomInt);
      frames.push(createEmojiRaceFrame({
        turn,
        positions,
        trackLength: finishLine,
        winnerId: winner.id,
        finished: true
      }));

      return createEmojiRaceResult({
        choice: normalizedChoice,
        bet,
        frames,
        winner
      });
    }

    frames.push(createEmojiRaceFrame({
      turn,
      positions,
      trackLength: finishLine
    }));
  }

  const winner = pickEmojiRaceWinner(EMOJI_RACE_RACERS, positions, randomInt);
  frames.push(createEmojiRaceFrame({
    turn: frames.length,
    positions,
    trackLength: finishLine,
    winnerId: winner.id,
    finished: true
  }));

  return createEmojiRaceResult({
    choice: normalizedChoice,
    bet,
    frames,
    winner
  });
}

export function playBlackjackRound({ bet, randomInt = defaultRandomInt } = {}) {
  let round = createBlackjackRound({ bet, randomInt });

  while (round.status === 'player_turn' && handValue(round.playerHand).value < 17) {
    round = hitBlackjackRound(round, { randomInt });
  }

  if (round.status === 'player_turn') {
    round = standBlackjackRound(round, { randomInt });
  }

  return {
    game: '블랙잭',
    ...round,
    playerValue: handValue(round.playerHand).value,
    dealerValue: handValue(round.dealerHand).value
  };
}

export function createBlackjackRound({ bet, randomInt = defaultRandomInt } = {}) {
  const round = annotateBlackjackRound({
    bet,
    playerHand: [drawCard(randomInt), drawCard(randomInt)],
    dealerHand: [drawCard(randomInt), drawCard(randomInt)],
    status: 'player_turn'
  });

  if (isNaturalBlackjack(round.playerHand) || isNaturalBlackjack(round.dealerHand)) {
    return settleBlackjackRound(round);
  }

  return round;
}

export function hitBlackjackRound(round, { randomInt = defaultRandomInt } = {}) {
  assertBlackjackTurn(round);

  const nextRound = annotateBlackjackRound({
    ...round,
    playerHand: [...round.playerHand, drawCard(randomInt)]
  });

  return nextRound.playerValue > 21
    ? settleBlackjackRound(nextRound)
    : nextRound;
}

export function standBlackjackRound(round, { randomInt = defaultRandomInt } = {}) {
  assertBlackjackTurn(round);

  const dealerHand = [...round.dealerHand];
  while (handValue(dealerHand).value < 17) {
    dealerHand.push(drawCard(randomInt));
  }

  return settleBlackjackRound({
    ...round,
    dealerHand
  });
}

export function createPlayerBlackjackRound({ bet, randomInt = defaultRandomInt } = {}) {
  return annotatePlayerBlackjackRound({
    bet,
    challengerHand: [drawCard(randomInt), drawCard(randomInt)],
    opponentHand: [drawCard(randomInt), drawCard(randomInt)],
    currentTurn: 'challenger',
    challengerStood: false,
    opponentStood: false,
    status: 'player_turn',
    winner: null
  });
}

export function hitPlayerBlackjackRound(round, participant, { randomInt = defaultRandomInt } = {}) {
  assertPlayerBlackjackTurn(round, participant);

  const handKey = `${participant}Hand`;
  const nextRound = annotatePlayerBlackjackRound({
    ...round,
    [handKey]: [...round[handKey], drawCard(randomInt)]
  });

  return getPlayerBlackjackValue(nextRound, participant) > 21
    ? settlePlayerBlackjackRound(nextRound, participant === 'challenger' ? 'opponent' : 'challenger')
    : nextRound;
}

export function standPlayerBlackjackRound(round, participant) {
  assertPlayerBlackjackTurn(round, participant);

  const stoodKey = `${participant}Stood`;
  const nextRound = annotatePlayerBlackjackRound({
    ...round,
    [stoodKey]: true
  });

  if (nextRound.challengerStood && nextRound.opponentStood) {
    return settlePlayerBlackjackRound(nextRound);
  }

  return annotatePlayerBlackjackRound({
    ...nextRound,
    currentTurn: participant === 'challenger' ? 'opponent' : 'challenger'
  });
}

export function playPlayerBlackjack({ randomInt = defaultRandomInt } = {}) {
  const challengerHand = [drawCard(randomInt), drawCard(randomInt)];
  const opponentHand = [drawCard(randomInt), drawCard(randomInt)];

  while (handValue(challengerHand).value < 17) {
    challengerHand.push(drawCard(randomInt));
  }

  while (handValue(opponentHand).value < 17) {
    opponentHand.push(drawCard(randomInt));
  }

  const result = decideBlackjackWinner(challengerHand, opponentHand);
  const winner = {
    player: 'challenger',
    dealer: 'opponent',
    push: null
  }[result];

  return {
    game: '블랙잭 대결',
    challengerHand,
    opponentHand,
    challengerValue: handValue(challengerHand).value,
    opponentValue: handValue(opponentHand).value,
    winner
  };
}

export function formatCards(cards) {
  return cards.join(' ');
}

export function getBlackjackHandValue(cards) {
  return handValue(cards).value;
}

export function normalizeOddEvenChoice(choice) {
  const normalized = String(choice).trim().toLocaleLowerCase('ko-KR');

  if (['홀', '홀수', 'odd'].includes(normalized)) return 'odd';
  if (['짝', '짝수', 'even'].includes(normalized)) return 'even';

  throw new Error('홀 또는 짝 중 하나를 선택해주세요.');
}

export function normalizeDiceChoice(choice) {
  const normalized = String(choice).trim().toLocaleLowerCase('ko-KR');

  if (['높음', '하이', 'high', '4-6'].includes(normalized)) return 'high';
  if (['낮음', '로우', 'low', '1-3'].includes(normalized)) return 'low';

  throw new Error('높음(4~6) 또는 낮음(1~3) 중 하나를 선택해주세요.');
}

export function normalizeHighLowChoice(choice) {
  const normalized = String(choice).trim().toLocaleLowerCase('ko-KR');

  if (['높음', '하이', 'high', 'h', 'up'].includes(normalized)) return 'high';
  if (['낮음', '로우', 'low', 'l', 'down'].includes(normalized)) return 'low';

  throw new Error('하이로우 선택은 높음 또는 낮음 중 하나여야 합니다.');
}

export function normalizeRouletteChoice(choice) {
  const normalized = String(choice).trim().toLocaleLowerCase('ko-KR');

  if (['빨강', '레드', 'red'].includes(normalized)) return 'red';
  if (['검정', '블랙', 'black'].includes(normalized)) return 'black';
  if (['홀', '홀수', 'odd'].includes(normalized)) return 'odd';
  if (['짝', '짝수', 'even'].includes(normalized)) return 'even';
  if (['낮음', '로우', 'low', '1-18'].includes(normalized)) return 'low';
  if (['높음', '하이', 'high', '19-36'].includes(normalized)) return 'high';
  if (['0', '제로', 'zero'].includes(normalized)) return 'zero';

  throw new Error('룰렛 선택은 빨강, 검정, 홀, 짝, 낮음, 높음, 0 중 하나여야 합니다.');
}

export function normalizeBaccaratChoice(choice) {
  const normalized = String(choice).trim().toLocaleLowerCase('ko-KR');

  if (['플레이어', 'player', 'p'].includes(normalized)) return 'player';
  if (['뱅커', 'banker', 'b'].includes(normalized)) return 'banker';
  if (['타이', '무승부', 'tie', 't'].includes(normalized)) return 'tie';

  throw new Error('바카라 선택은 플레이어, 뱅커, 타이 중 하나여야 합니다.');
}

export function normalizeCrapsChoice(choice) {
  const normalized = String(choice).trim().toLocaleLowerCase('ko-KR').replace(/\s+/g, '');

  if (['패스', 'pass', 'passline'].includes(normalized)) return 'pass';
  if (['돈패스', 'dontpass', "don'tpass", 'dont'].includes(normalized)) return 'dont_pass';

  throw new Error('크랩스 선택은 패스 또는 돈패스 중 하나여야 합니다.');
}

export function normalizeSicBoChoice(choice) {
  const normalized = String(choice).trim().toLocaleLowerCase('ko-KR');

  if (['작음', '소', 'small'].includes(normalized)) return 'small';
  if (['큼', '대', 'big'].includes(normalized)) return 'big';
  if (['트리플', 'triples', 'triple', '세쌍'].includes(normalized)) return 'triple';

  throw new Error('시크보 선택은 작음, 큼, 트리플 중 하나여야 합니다.');
}

export function normalizeEmojiRaceChoice(choice) {
  const normalized = String(choice).trim().toLocaleLowerCase('ko-KR').replace(/\s+/g, '');

  if (['1', '1번', '말', '경주마', 'horse', 'h', '🐎'].includes(normalized)) return 'horse';
  if (['2', '2번', '강아지', '개', '멍멍이', 'dog', 'd', '🐕'].includes(normalized)) return 'dog';
  if (['3', '3번', '거북이', '거북', 'turtle', 't', '🐢'].includes(normalized)) return 'turtle';

  throw new Error('이모지 경마 선택은 말, 강아지, 거북이 중 하나여야 합니다.');
}

export function formatEmojiRaceChoice(choice) {
  const racer = getEmojiRaceRacer(choice);
  return `${racer.emoji} ${racer.name}`;
}

export function formatEmojiRaceTrack(frameOrRace) {
  const frame = frameOrRace?.finalFrame ?? frameOrRace;
  const trackLength = frame?.trackLength ?? EMOJI_RACE_TRACK_LENGTH;
  const positions = frame?.positions ?? {};

  return EMOJI_RACE_RACERS
    .map((racer) => formatEmojiRaceLane(racer, positions[racer.id] ?? 0, trackLength))
    .join('\n');
}

export function parseKenoNumbers(numbers) {
  const tokens = String(numbers)
    .split(/[,\s]+/u)
    .map((value) => value.trim())
    .filter(Boolean);
  const picks = tokens.map(Number);
  const unique = [...new Set(picks)];

  if (unique.length < 1 || unique.length > KENO_MAX_PICKS) {
    throw new Error(`키노 번호는 1~${KENO_MAX_PICKS}개까지 고를 수 있습니다.`);
  }

  if (!unique.every((value) => Number.isSafeInteger(value) && value >= KENO_MIN_NUMBER && value <= KENO_MAX_NUMBER)) {
    throw new Error(`키노 번호는 ${KENO_MIN_NUMBER}~${KENO_MAX_NUMBER} 사이의 정수여야 합니다.`);
  }

  if (unique.length !== picks.length) {
    throw new Error('키노 번호는 중복 없이 입력해주세요.');
  }

  return unique.sort((a, b) => a - b);
}

function decideBlackjackWinner(playerHand, dealerHand) {
  const player = handValue(playerHand).value;
  const dealer = handValue(dealerHand).value;

  if (player > 21 && dealer > 21) return 'push';
  if (player > 21) return 'dealer';
  if (dealer > 21) return 'player';
  if (player > dealer) return 'player';
  if (dealer > player) return 'dealer';
  return 'push';
}

function annotateBlackjackRound(round) {
  return {
    ...round,
    playerValue: handValue(round.playerHand).value,
    dealerValue: handValue(round.dealerHand).value
  };
}

function assertBlackjackTurn(round) {
  if (round.status !== 'player_turn') {
    throw new Error('이미 종료된 블랙잭입니다.');
  }
}

function settleBlackjackRound(round) {
  const result = decideBlackjackWinner(round.playerHand, round.dealerHand);
  const multiplier = getBlackjackMultiplier(result, round.playerHand);
  const payout = result === 'push' ? round.bet : Math.floor(round.bet * multiplier);

  return annotateBlackjackRound({
    ...round,
    status: 'settled',
    result,
    win: result === 'player',
    multiplier,
    payout
  });
}

function annotatePlayerBlackjackRound(round) {
  return {
    ...round,
    challengerValue: handValue(round.challengerHand).value,
    opponentValue: handValue(round.opponentHand).value
  };
}

function assertPlayerBlackjackTurn(round, participant) {
  if (round.status !== 'player_turn') {
    throw new Error('이미 종료된 블랙잭 대결입니다.');
  }

  if (round.currentTurn !== participant) {
    throw new Error('지금은 상대 차례입니다.');
  }
}

function settlePlayerBlackjackRound(round, forcedWinner = null) {
  let winner = forcedWinner;

  if (!winner) {
    const result = decideBlackjackWinner(round.challengerHand, round.opponentHand);
    winner = {
      player: 'challenger',
      dealer: 'opponent',
      push: null
    }[result];
  }

  return annotatePlayerBlackjackRound({
    ...round,
    status: 'settled',
    winner
  });
}

function getPlayerBlackjackValue(round, participant) {
  return participant === 'challenger'
    ? round.challengerValue
    : round.opponentValue;
}

function getBlackjackMultiplier(result, playerHand) {
  if (result === 'push') return 1;
  if (result !== 'player') return 0;
  return isNaturalBlackjack(playerHand) ? 2 : 1.5;
}

function isNaturalBlackjack(hand) {
  return hand.length === 2 && handValue(hand).value === 21;
}

function handValue(hand) {
  let value = 0;
  let aces = 0;

  for (const card of hand) {
    if (card === 'A') {
      aces += 1;
      value += 11;
    } else if (['J', 'Q', 'K'].includes(card)) {
      value += 10;
    } else {
      value += Number(card);
    }
  }

  while (value > 21 && aces > 0) {
    value -= 10;
    aces -= 1;
  }

  return { value };
}

function getCardRankValue(card) {
  return CARD_RANKS.indexOf(card) + 1;
}

function drawCard(randomInt) {
  return CARD_RANKS[randomInt(0, CARD_RANKS.length - 1)];
}

function getRouletteColor(roll) {
  if (roll === 0) return 'green';
  return ROULETTE_RED_NUMBERS.has(roll) ? 'red' : 'black';
}

function isRouletteWin(choice, roll, color) {
  if (choice === 'zero') return roll === 0;
  if (choice === 'red' || choice === 'black') return color === choice;
  if (roll === 0) return false;
  if (choice === 'odd') return roll % 2 === 1;
  if (choice === 'even') return roll % 2 === 0;
  if (choice === 'low') return roll >= 1 && roll <= 18;
  if (choice === 'high') return roll >= 19 && roll <= 36;
  return false;
}

function baccaratCardValue(card) {
  if (card === 'A') return 1;
  if (['10', 'J', 'Q', 'K'].includes(card)) return 0;
  return Number(card);
}

function baccaratHandValue(hand) {
  return hand.reduce((sum, card) => sum + baccaratCardValue(card), 0) % 10;
}

function shouldBankerDraw(bankerValue, playerThird) {
  if (!playerThird) return bankerValue <= 5;

  const thirdValue = baccaratCardValue(playerThird);
  if (bankerValue <= 2) return true;
  if (bankerValue === 3) return thirdValue !== 8;
  if (bankerValue === 4) return thirdValue >= 2 && thirdValue <= 7;
  if (bankerValue === 5) return thirdValue >= 4 && thirdValue <= 7;
  if (bankerValue === 6) return thirdValue === 6 || thirdValue === 7;
  return false;
}

function getBaccaratPayout(choice, bet) {
  if (choice === 'player') return bet * 2;
  if (choice === 'banker') return Math.floor(bet * 1.95);
  return bet * 9;
}

function rollDicePair(randomInt) {
  const dice = [randomInt(1, 6), randomInt(1, 6)];
  return {
    dice,
    total: dice[0] + dice[1]
  };
}

function formatCrapsResult(choice, bet, rolls, outcome, point = null) {
  return {
    game: '크랩스',
    choice,
    rolls,
    point,
    outcome,
    win: outcome === 'win',
    push: outcome === 'push',
    payout: outcome === 'win'
      ? bet * 2
      : outcome === 'push'
        ? bet
        : 0
  };
}

function drawKenoNumbers(randomInt) {
  const pool = Array.from(
    { length: KENO_MAX_NUMBER - KENO_MIN_NUMBER + 1 },
    (_, index) => index + KENO_MIN_NUMBER
  );
  const draw = [];

  while (draw.length < KENO_DRAW_COUNT) {
    const index = randomInt(0, pool.length - 1);
    draw.push(pool.splice(index, 1)[0]);
  }

  return draw.sort((a, b) => a - b);
}

function scratchTicketTier(amount, chance) {
  const normalizedAmount = normalizeNonNegativeSafeInteger(amount, '당첨금');
  const normalizedChance = normalizeNonNegativeSafeInteger(chance, '당첨 확률');

  if (normalizedAmount <= 0 || normalizedChance <= 0) {
    throw new Error('스크래치 복권 당첨금과 당첨 확률은 1 이상의 정수여야 합니다.');
  }

  return Object.freeze({
    amount: normalizedAmount,
    label: formatScratchPrizeShort(normalizedAmount),
    chance: normalizedChance
  });
}

function scratchTicketProduct(product) {
  const price = normalizeNonNegativeSafeInteger(product.price, '구매가');
  const topPrize = normalizeNonNegativeSafeInteger(product.topPrize, '최고 당첨금');
  const prizeTiers = product.prizeTiers ?? [];
  const totalChance = prizeTiers.reduce((sum, tier) => sum + tier.chance, 0);

  if (!product.id || !product.name) {
    throw new Error('스크래치 복권 상품에는 id와 이름이 필요합니다.');
  }

  if (price <= 0 || topPrize <= 0) {
    throw new Error('스크래치 복권 구매가와 최고 당첨금은 1 이상이어야 합니다.');
  }

  if (prizeTiers.length < 3) {
    throw new Error('스크래치 복권은 최소 3개 이상의 당첨금 등급이 필요합니다.');
  }

  if (totalChance >= SCRATCH_TICKET_ROLL_MAX) {
    throw new Error('스크래치 복권 당첨 확률 합계는 전체 확률보다 낮아야 합니다.');
  }

  if (prizeTiers[0].amount !== topPrize) {
    throw new Error('스크래치 복권 첫 당첨금 등급은 최고 당첨금과 같아야 합니다.');
  }

  return Object.freeze({
    id: product.id,
    name: product.name,
    price,
    topPrize,
    prizeTiers: Object.freeze(prizeTiers)
  });
}

function drawScratchTicketPrizeTier(product, randomInt) {
  const roll = randomInt(1, SCRATCH_TICKET_ROLL_MAX);
  let threshold = 0;

  if (!Number.isSafeInteger(roll) || roll < 1 || roll > SCRATCH_TICKET_ROLL_MAX) {
    throw new Error(`스크래치 복권 추첨값은 1~${SCRATCH_TICKET_ROLL_MAX} 사이여야 합니다.`);
  }

  for (const tier of product.prizeTiers) {
    threshold += tier.chance;
    if (roll <= threshold) return tier;
  }

  return null;
}

function createWinningScratchTicketSpots(product, winningTier, randomInt) {
  const values = [
    winningTier.amount,
    winningTier.amount,
    winningTier.amount
  ];
  const counts = new Map([[winningTier.amount, 3]]);

  while (values.length < SCRATCH_TICKET_SPOT_COUNT) {
    const candidate = pickScratchTicketDecoyAmount(product, counts, randomInt, winningTier.amount);
    values.push(candidate);
    counts.set(candidate, (counts.get(candidate) ?? 0) + 1);
  }

  return shuffleScratchTicketAmounts(values, randomInt);
}

function createLosingScratchTicketSpots(product, randomInt) {
  const values = [];
  const counts = new Map();

  while (values.length < SCRATCH_TICKET_SPOT_COUNT) {
    const candidate = pickScratchTicketDecoyAmount(product, counts, randomInt);
    values.push(candidate);
    counts.set(candidate, (counts.get(candidate) ?? 0) + 1);
  }

  return shuffleScratchTicketAmounts(values, randomInt);
}

function pickScratchTicketDecoyAmount(product, counts, randomInt, excludedAmount = null) {
  const candidates = product.prizeTiers
    .map((tier) => tier.amount)
    .filter((amount) => amount !== excludedAmount && (counts.get(amount) ?? 0) < 2);

  if (candidates.length === 0) {
    throw new Error('스크래치 복권 칸을 구성할 당첨금 후보가 부족합니다.');
  }

  return candidates[randomInt(0, candidates.length - 1)];
}

function shuffleScratchTicketAmounts(values, randomInt) {
  const shuffled = [...values];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled.map((amount) => Object.freeze({
    amount,
    label: formatScratchPrizeShort(amount)
  }));
}

function buildScratchTicket(ticket) {
  const product = getScratchTicketProduct(ticket.productId);
  const spots = normalizeScratchTicketSpots(ticket.spots);
  const revealed = normalizeScratchTicketRevealed(ticket.revealed);
  const revealCount = revealed.filter(Boolean).length;
  const status = ticket.status ?? (revealCount >= SCRATCH_TICKET_SPOT_COUNT ? 'settled' : 'scratching');
  const winningAmount = findScratchTicketWinningAmount(spots);
  const payout = status === 'settled' ? (winningAmount ?? 0) : 0;

  if (!['scratching', 'settled'].includes(status)) {
    throw new Error('스크래치 복권 상태가 올바르지 않습니다.');
  }

  return {
    game: '스크래치복권',
    productId: product.id,
    productName: product.name,
    price: product.price,
    topPrize: product.topPrize,
    spots,
    revealed,
    revealCount,
    status,
    winningAmount,
    win: payout > 0,
    payout,
    lastRevealedIndex: ticket.lastRevealedIndex ?? null
  };
}

function normalizeScratchTicketSpots(spots) {
  if (!Array.isArray(spots) || spots.length !== SCRATCH_TICKET_SPOT_COUNT) {
    throw new Error(`스크래치 복권은 ${SCRATCH_TICKET_SPOT_COUNT}칸이어야 합니다.`);
  }

  return spots.map((spot) => {
    const amount = normalizeNonNegativeSafeInteger(
      typeof spot === 'object' && spot !== null ? spot.amount : spot,
      '복권 칸 당첨금'
    );

    if (amount <= 0) {
      throw new Error('복권 칸 당첨금은 1 이상이어야 합니다.');
    }

    return Object.freeze({
      amount,
      label: formatScratchPrizeShort(amount)
    });
  });
}

function normalizeScratchTicketRevealed(revealed) {
  if (revealed === undefined) {
    return Array.from({ length: SCRATCH_TICKET_SPOT_COUNT }, () => false);
  }

  if (!Array.isArray(revealed) || revealed.length !== SCRATCH_TICKET_SPOT_COUNT) {
    throw new Error(`스크래치 복권 공개 상태는 ${SCRATCH_TICKET_SPOT_COUNT}칸이어야 합니다.`);
  }

  return revealed.map(Boolean);
}

function normalizeScratchTicketSpotIndex(index) {
  const normalized = Number(index);

  if (!Number.isSafeInteger(normalized) || normalized < 0 || normalized >= SCRATCH_TICKET_SPOT_COUNT) {
    throw new Error(`스크래치 복권 칸 번호는 1~${SCRATCH_TICKET_SPOT_COUNT} 사이여야 합니다.`);
  }

  return normalized;
}

function assertScratchTicketInProgress(ticket) {
  if (!ticket || ticket.status !== 'scratching') {
    throw new Error('이미 정산된 스크래치 복권입니다.');
  }
}

function findScratchTicketWinningAmount(spots) {
  const counts = new Map();

  for (const spot of spots) {
    const count = (counts.get(spot.amount) ?? 0) + 1;
    counts.set(spot.amount, count);

    if (count >= 3) return spot.amount;
  }

  return null;
}



function buildTimingRound(round) {
  const bet = normalizeTimingBet(round.bet);
  const targetSeconds = Number(round.targetSeconds);
  const targetMs = Number(round.targetMs ?? targetSeconds * 1000);

  if (!Number.isSafeInteger(targetSeconds)
    || targetSeconds < TIMING_TARGET_MIN_SECONDS
    || targetSeconds > TIMING_TARGET_MAX_SECONDS) {
    throw new Error(`타이밍 목표 초는 ${TIMING_TARGET_MIN_SECONDS}~${TIMING_TARGET_MAX_SECONDS}초 사이여야 합니다.`);
  }

  if (!Number.isFinite(targetMs) || targetMs <= 0) {
    throw new Error('타이밍 목표 시간은 0보다 커야 합니다.');
  }

  const payout = normalizeNonNegativeSafeInteger(round.payout ?? 0, '지급액');

  return {
    game: '타이밍',
    ...round,
    bet,
    targetSeconds,
    targetMs,
    startedAtMs: normalizeTimestampMs(round.startedAtMs, '시작 시각'),
    status: round.status ?? 'waiting',
    pressedAtMs: round.pressedAtMs ?? null,
    elapsedMs: round.elapsedMs ?? null,
    elapsedSeconds: round.elapsedSeconds ?? null,
    differenceMs: round.differenceMs ?? null,
    differenceSeconds: round.differenceSeconds ?? null,
    tier: round.tier ?? null,
    win: payout > 0,
    multiplier: Number(round.multiplier ?? 0),
    payout
  };
}

function assertTimingWaitingRound(round) {
  if (!round || round.status !== 'waiting') {
    throw new Error('이미 종료된 타이밍 게임입니다.');
  }
}

function normalizeTimingBet(bet) {
  const normalized = Number(bet);

  if (!Number.isSafeInteger(normalized) || normalized <= 0) {
    throw new Error('타이밍 베팅액은 1 이상의 정수여야 합니다.');
  }

  return normalized;
}

function normalizeTimestampMs(value, label) {
  const normalized = Number(value);

  if (!Number.isFinite(normalized) || normalized < 0) {
    throw new Error(`${label}은 0 이상의 숫자여야 합니다.`);
  }

  return normalized;
}

function normalizeNonNegativeFiniteNumber(value, label) {
  const normalized = Number(value);

  if (!Number.isFinite(normalized) || normalized < 0) {
    throw new Error(`${label}는 0 이상의 숫자여야 합니다.`);
  }

  return normalized;
}

function buildDeadlineRound(round) {
  const status = round.status ?? 'pressing';
  const presses = normalizeNonNegativeSafeInteger(round.presses ?? 0, '누른 횟수');
  const bet = normalizeDeadlineBet(round.bet);
  const reward = normalizeNonNegativeSafeInteger(round.reward ?? 0, '누적 보상');

  return {
    game: '데드라인',
    ...round,
    bet,
    presses,
    reward,
    status,
    nextReward: status === 'pressing' ? getDeadlineNextReward(bet, presses) : 0,
    bustChanceBps: status === 'pressing' ? getDeadlineBustChanceBps(presses) : (round.bustChanceBps ?? getDeadlineBustChanceBps(presses)),
    payout: normalizeNonNegativeSafeInteger(round.payout ?? 0, '지급액'),
    lastReward: normalizeNonNegativeSafeInteger(round.lastReward ?? 0, '마지막 보상'),
    lostReward: normalizeNonNegativeSafeInteger(round.lostReward ?? 0, '잃은 보상'),
    lastRoll: round.lastRoll ?? null,
    busted: round.busted === true,
    autoCashedOut: round.autoCashedOut === true
  };
}

function assertDeadlinePressingRound(round) {
  if (!round || round.status !== 'pressing') {
    throw new Error('이미 종료된 데드라인입니다.');
  }
}

function normalizeDeadlineBet(bet) {
  const normalized = Number(bet);

  if (!Number.isSafeInteger(normalized) || normalized < DEADLINE_MIN_BET) {
    throw new Error(`데드라인 베팅액은 ${DEADLINE_MIN_BET.toLocaleString()} 이상의 정수여야 합니다.`);
  }

  return normalized;
}

function normalizeNonNegativeSafeInteger(value, label) {
  const normalized = Number(value);

  if (!Number.isSafeInteger(normalized) || normalized < 0) {
    throw new Error(`${label}은 0 이상의 정수여야 합니다.`);
  }

  return normalized;
}

function normalizeEmojiRaceTrackLength(trackLength) {
  if (!Number.isSafeInteger(trackLength) || trackLength < 3 || trackLength > 20) {
    throw new Error('이모지 경마 트랙 길이는 3~20 사이의 정수여야 합니다.');
  }

  return trackLength;
}

function createEmojiRaceFrame({
  turn,
  positions,
  trackLength,
  winnerId = null,
  finished = false
}) {
  return {
    turn,
    positions: Object.fromEntries(
      EMOJI_RACE_RACERS.map((racer) => [
        racer.id,
        Math.max(0, Math.min(trackLength, positions[racer.id] ?? 0))
      ])
    ),
    trackLength,
    winnerId,
    finished
  };
}

function createEmojiRaceResult({
  choice,
  bet,
  frames,
  winner
}) {
  const win = choice === winner.id;

  return {
    game: '이모지경마',
    choice,
    bet,
    racers: EMOJI_RACE_RACERS,
    frames,
    finalFrame: frames.at(-1),
    winner,
    winnerId: winner.id,
    win,
    multiplier: win ? EMOJI_RACE_MULTIPLIER : 0,
    payout: win ? Math.floor(bet * EMOJI_RACE_MULTIPLIER) : 0
  };
}

function pickEmojiRaceWinner(candidates, positions, randomInt) {
  const bestPosition = Math.max(...candidates.map((racer) => positions[racer.id] ?? 0));
  const leaders = candidates.filter((racer) => (positions[racer.id] ?? 0) === bestPosition);

  if (leaders.length === 1) return leaders[0];

  return leaders[randomInt(0, leaders.length - 1)];
}

function getEmojiRaceRacer(choice) {
  const racerId = normalizeEmojiRaceChoice(choice);
  return EMOJI_RACE_RACERS.find((racer) => racer.id === racerId);
}

function formatEmojiRaceLane(racer, progress, trackLength) {
  const position = Math.max(0, Math.min(trackLength, progress));
  const cells = Array.from(
    { length: trackLength + 1 },
    (_, index) => (index === position ? racer.emoji : '.')
  );

  return `${racer.number}번 ${racer.name}: ${cells.join(' ')} 🏁`;
}

function getSlotMultiplier(reels, maxCount) {
  if (maxCount === 3 && reels[0] === '7️⃣') return 20;
  if (maxCount === 3) return 10;
  if (maxCount === 2) return 3;
  return 0;
}

function defaultNowMs() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function defaultRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
