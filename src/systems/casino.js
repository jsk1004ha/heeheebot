const CARD_RANKS = Object.freeze(['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']);
const POKER_SUITS = Object.freeze(['♠', '♥', '♦', '♣']);
const POKER_HAND_SIZE = 5;
const HOLDEM_HOLE_SIZE = 2;
const HOLDEM_COMMUNITY_SIZE = 5;
const HOLDEM_MIN_DECK_SIZE = (HOLDEM_HOLE_SIZE * 2) + HOLDEM_COMMUNITY_SIZE;
const HOLDEM_STREETS = Object.freeze({
  preflop: Object.freeze({ next: 'flop', reveal: 0, label: '프리플랍' }),
  flop: Object.freeze({ next: 'turn', reveal: 3, label: '플랍' }),
  turn: Object.freeze({ next: 'river', reveal: 4, label: '턴' }),
  river: Object.freeze({ next: 'showdown', reveal: 5, label: '리버' }),
  showdown: Object.freeze({ next: null, reveal: 5, label: '쇼다운' })
});
const HOLDEM_PARTICIPANTS = Object.freeze(['challenger', 'opponent']);
const HOLDEM_BUTTON = 'challenger';
const HOLDEM_BIG_BLIND_DIVISOR = 50;
const POKER_PAYOUTS = Object.freeze({
  royal_flush: Object.freeze({ id: 'royal_flush', label: '로열 플러시', multiplier: 250, order: 10 }),
  straight_flush: Object.freeze({ id: 'straight_flush', label: '스트레이트 플러시', multiplier: 50, order: 9 }),
  four_kind: Object.freeze({ id: 'four_kind', label: '포카드', multiplier: 25, order: 8 }),
  full_house: Object.freeze({ id: 'full_house', label: '풀하우스', multiplier: 9, order: 7 }),
  flush: Object.freeze({ id: 'flush', label: '플러시', multiplier: 6, order: 6 }),
  straight: Object.freeze({ id: 'straight', label: '스트레이트', multiplier: 4, order: 5 }),
  three_kind: Object.freeze({ id: 'three_kind', label: '트리플', multiplier: 3, order: 4 }),
  two_pair: Object.freeze({ id: 'two_pair', label: '투페어', multiplier: 2, order: 3 }),
  high_pair: Object.freeze({ id: 'high_pair', label: 'J 이상 원페어', multiplier: 1, order: 2 }),
  low_pair: Object.freeze({ id: 'low_pair', label: '낮은 원페어', multiplier: 0, order: 1 }),
  high_card: Object.freeze({ id: 'high_card', label: '하이카드', multiplier: 0, order: 0 })
});
const SLOT_SYMBOLS = Object.freeze(['🍒', '🍋', '🍇', '🔔', '⭐', '💎', '7️⃣', '🍀', '🍉', '🍊']);
const ROULETTE_RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const KENO_MIN_NUMBER = 1;
const KENO_MAX_NUMBER = 80;
const KENO_DRAW_COUNT = 10;
const KENO_MAX_PICKS = 5;
export const DEADLINE_MAX_SAFE_PRESSES = 12;
export const DEADLINE_MIN_BET = 100;
export const CASINO_MAX_BET = 1_000_000_000_000_000;
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
export const EMOJI_RACE_POOL_PAYOUT_BPS = 9_500;
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

export function createPokerRound({
  bet,
  deck = null,
  randomInt = defaultRandomInt
} = {}) {
  const normalizedBet = normalizePokerBet(bet);
  const pokerDeck = deck
    ? normalizePokerDeck(deck)
    : createShuffledPokerDeck(randomInt);
  if (pokerDeck.length < POKER_HAND_SIZE * 2) {
    throw new Error('포커 덱에는 시작 패와 교체 패를 합쳐 최소 10장이 필요합니다.');
  }

  return buildPokerRound({
    bet: normalizedBet,
    initialHand: pokerDeck.slice(0, POKER_HAND_SIZE),
    hand: pokerDeck.slice(0, POKER_HAND_SIZE),
    deck: pokerDeck.slice(POKER_HAND_SIZE),
    held: Array.from({ length: POKER_HAND_SIZE }, () => false),
    status: 'holding',
    drawCount: 0,
    replacedCount: 0,
    payout: 0
  });
}

export function togglePokerHold(round, index) {
  const current = buildPokerRound(round);
  assertPokerHoldingRound(current);
  const normalizedIndex = normalizePokerCardIndex(index);
  const held = [...current.held];
  held[normalizedIndex] = !held[normalizedIndex];

  return buildPokerRound({
    ...current,
    held
  });
}

export function applyPokerRecommendedHold(round) {
  const current = buildPokerRound(round);
  assertPokerHoldingRound(current);
  const recommendation = getPokerHoldRecommendation(current.hand);

  return buildPokerRound({
    ...current,
    held: recommendation.held
  });
}

export function clearPokerHold(round) {
  const current = buildPokerRound(round);
  assertPokerHoldingRound(current);

  return buildPokerRound({
    ...current,
    held: Array.from({ length: POKER_HAND_SIZE }, () => false)
  });
}

export function drawPokerRound(round) {
  const current = buildPokerRound(round);
  assertPokerHoldingRound(current);

  const deck = [...current.deck];
  const hand = current.hand.map((card, index) => {
    if (current.held[index]) return card;
    const replacement = deck.shift();
    if (!replacement) {
      throw new Error('포커 교체 카드가 부족합니다.');
    }
    return replacement;
  });
  const replacedCount = current.held.filter((held) => !held).length;
  const handRank = evaluatePokerHand(hand);

  return buildPokerRound({
    ...current,
    hand,
    deck,
    status: 'settled',
    drawCount: current.drawCount + 1,
    replacedCount,
    handRank,
    payout: Math.floor(current.bet * handRank.multiplier)
  });
}

export function createPlayerPokerRound({
  bet,
  deck = null,
  randomInt = defaultRandomInt
} = {}) {
  const normalizedBet = normalizePokerBet(bet);
  const pokerDeck = deck
    ? normalizePokerDeck(deck)
    : createShuffledPokerDeck(randomInt);
  if (pokerDeck.length < POKER_HAND_SIZE * 4) {
    throw new Error('유저 포커 덱에는 양쪽 시작 패와 교체 패를 합쳐 최소 20장이 필요합니다.');
  }

  return buildPlayerPokerRound({
    bet: normalizedBet,
    challenger: {
      initialHand: pokerDeck.slice(0, POKER_HAND_SIZE),
      hand: pokerDeck.slice(0, POKER_HAND_SIZE),
      held: Array.from({ length: POKER_HAND_SIZE }, () => false),
      status: 'holding',
      drawCount: 0,
      replacedCount: 0
    },
    opponent: {
      initialHand: pokerDeck.slice(POKER_HAND_SIZE, POKER_HAND_SIZE * 2),
      hand: pokerDeck.slice(POKER_HAND_SIZE, POKER_HAND_SIZE * 2),
      held: Array.from({ length: POKER_HAND_SIZE }, () => false),
      status: 'holding',
      drawCount: 0,
      replacedCount: 0
    },
    deck: pokerDeck.slice(POKER_HAND_SIZE * 2),
    currentTurn: 'challenger',
    status: 'holding',
    winner: null
  });
}

export function togglePlayerPokerHold(round, participant, index) {
  const current = buildPlayerPokerRound(round);
  const key = assertPlayerPokerTurn(current, participant);
  const normalizedIndex = normalizePokerCardIndex(index);
  const held = [...current[key].held];
  held[normalizedIndex] = !held[normalizedIndex];

  return buildPlayerPokerRound({
    ...current,
    [key]: {
      ...current[key],
      held
    }
  });
}

export function applyPlayerPokerRecommendedHold(round, participant) {
  const current = buildPlayerPokerRound(round);
  const key = assertPlayerPokerTurn(current, participant);
  const recommendation = getPokerHoldRecommendation(current[key].hand);

  return buildPlayerPokerRound({
    ...current,
    [key]: {
      ...current[key],
      held: recommendation.held
    }
  });
}

export function clearPlayerPokerHold(round, participant) {
  const current = buildPlayerPokerRound(round);
  const key = assertPlayerPokerTurn(current, participant);

  return buildPlayerPokerRound({
    ...current,
    [key]: {
      ...current[key],
      held: Array.from({ length: POKER_HAND_SIZE }, () => false)
    }
  });
}

export function drawPlayerPokerRound(round, participant) {
  const current = buildPlayerPokerRound(round);
  const key = assertPlayerPokerTurn(current, participant);
  const player = current[key];
  const deck = [...current.deck];
  const hand = player.hand.map((card, index) => {
    if (player.held[index]) return card;
    const replacement = deck.shift();
    if (!replacement) {
      throw new Error('유저 포커 교체 카드가 부족합니다.');
    }
    return replacement;
  });
  const replacedCount = player.held.filter((held) => !held).length;
  const nextRound = buildPlayerPokerRound({
    ...current,
    deck,
    [key]: {
      ...player,
      hand,
      status: 'drawn',
      drawCount: player.drawCount + 1,
      replacedCount,
      handRank: evaluatePokerHand(hand)
    }
  });

  const otherKey = key === 'challenger' ? 'opponent' : 'challenger';
  if (nextRound[otherKey].status === 'drawn') {
    return settlePlayerPokerRound(nextRound);
  }

  return buildPlayerPokerRound({
    ...nextRound,
    currentTurn: otherKey
  });
}

export function createPlayerHoldemRound({
  bet,
  players = null,
  stacks = null,
  deck = null,
  randomInt = defaultRandomInt
} = {}) {
  const normalizedBet = normalizePokerBet(bet);
  const playerSpecs = normalizeHoldemPlayerSpecs(players);
  const playerCount = playerSpecs.length;
  const { smallBlind, bigBlind } = calculateHoldemBlinds(normalizedBet);
  const pokerDeck = deck
    ? normalizePokerDeck(deck)
    : createShuffledPokerDeck(randomInt);
  const requiredDeckSize = (HOLDEM_HOLE_SIZE * playerCount) + HOLDEM_COMMUNITY_SIZE;
  if (pokerDeck.length < requiredDeckSize) {
    throw new Error(`텍사스 홀덤 덱에는 참가자 홀카드와 커뮤니티 카드를 합쳐 최소 ${requiredDeckSize}장이 필요합니다.`);
  }
  const buttonIndex = 0;
  const smallBlindIndex = playerCount === 2 ? buttonIndex : 1;
  const bigBlindIndex = playerCount === 2 ? 1 : 2;
  const holdemPlayers = playerSpecs.map((player, index) => createHoldemParticipant({
    key: player.key,
    holeCards: pokerDeck.slice(index * HOLDEM_HOLE_SIZE, (index + 1) * HOLDEM_HOLE_SIZE),
    stack: getHoldemInitialStack(stacks, player.key, index, normalizedBet)
  }));
  holdemPlayers[smallBlindIndex] = commitHoldemChips(holdemPlayers[smallBlindIndex], smallBlind);
  holdemPlayers[bigBlindIndex] = commitHoldemChips(holdemPlayers[bigBlindIndex], bigBlind);

  return buildPlayerHoldemRound({
    bet: normalizedBet,
    button: holdemPlayers[buttonIndex].key,
    smallBlindParticipant: holdemPlayers[smallBlindIndex].key,
    bigBlindParticipant: holdemPlayers[bigBlindIndex].key,
    smallBlind,
    bigBlind,
    players: holdemPlayers,
    communityCards: pokerDeck.slice(HOLDEM_HOLE_SIZE * playerCount, requiredDeckSize),
    deck: pokerDeck.slice(requiredDeckSize),
    street: 'preflop',
    revealedCommunityCount: 0,
    currentTurn: getHoldemFirstActorForStreetFromPlayers(holdemPlayers, 'preflop', buttonIndex, bigBlindIndex),
    currentBet: bigBlind,
    minRaise: bigBlind,
    pot: holdemPlayers.reduce((total, player) => total + player.totalCommitted, 0),
    status: 'betting',
    winner: null,
    winners: [],
    pots: [],
    settlementReason: null
  });
}

export function actPlayerHoldemRound(round, participant, action) {
  const current = buildPlayerHoldemRound(round);
  const key = assertPlayerHoldemTurn(current, participant);
  const normalizedAction = normalizeHoldemAction(action);

  if (normalizedAction.type === 'fold') {
    return resolveHoldemAfterAction(updateHoldemPlayer(current, key, {
      ...current[key],
      folded: true,
      acted: true
    }));
  }

  if (normalizedAction.type === 'check') {
    return resolveHoldemAfterAction(applyHoldemCheck(current, key));
  }

  if (normalizedAction.type === 'call') {
    return resolveHoldemAfterAction(applyHoldemCall(current, key));
  }

  return resolveHoldemAfterAction(applyHoldemBetOrRaise(current, key, normalizedAction));
}

export function comparePokerHands(firstHand, secondHand) {
  const first = Array.isArray(firstHand)
    ? firstHand.length === POKER_HAND_SIZE
      ? evaluatePokerHand(firstHand)
      : evaluateBestPokerHand(firstHand)
    : normalizePokerHandRank(firstHand);
  const second = Array.isArray(secondHand)
    ? secondHand.length === POKER_HAND_SIZE
      ? evaluatePokerHand(secondHand)
      : evaluateBestPokerHand(secondHand)
    : normalizePokerHandRank(secondHand);

  if (first.order !== second.order) return first.order - second.order;

  const firstTieBreakers = getPokerHandTieBreakers(first);
  const secondTieBreakers = getPokerHandTieBreakers(second);
  const length = Math.max(firstTieBreakers.length, secondTieBreakers.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (firstTieBreakers[index] ?? 0) - (secondTieBreakers[index] ?? 0);
    if (difference !== 0) return difference;
  }

  return 0;
}

export function evaluateBestPokerHand(cards) {
  const normalized = normalizePokerCards(cards, POKER_HAND_SIZE, 7, '포커 비교 카드');
  let best = null;

  for (const hand of getPokerCombinations(normalized, POKER_HAND_SIZE)) {
    const rank = evaluatePokerHand(hand);
    if (!best || comparePokerHands(rank, best) > 0) {
      best = rank;
    }
  }

  return normalizeCommunityPokerHandRank(best);
}

export function getPokerHoldRecommendation(hand) {
  const cards = normalizePokerHand(Array.isArray(hand) ? hand : hand?.hand);
  const handRank = evaluatePokerHand(cards);
  const parsedCards = cards.map((card, index) => ({ ...parsePokerCard(card), card, index }));
  const held = Array.from({ length: POKER_HAND_SIZE }, () => false);
  const reason = applyPokerHoldRecommendation({ cards: parsedCards, handRank, held });

  return {
    held,
    reason,
    heldIndexes: held
      .map((value, index) => value ? index : null)
      .filter((index) => index !== null),
    heldCards: cards.filter((_, index) => held[index])
  };
}

export function evaluatePokerHand(hand) {
  const cards = normalizePokerHand(hand);
  const ranks = cards.map((card) => pokerRankValue(parsePokerCard(card).rank));
  const suits = cards.map((card) => parsePokerCard(card).suit);
  const rankCounts = new Map();
  for (const rank of ranks) {
    rankCounts.set(rank, (rankCounts.get(rank) ?? 0) + 1);
  }

  const counts = [...rankCounts.entries()]
    .map(([rank, count]) => ({ rank, count }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);
  const flush = suits.every((suit) => suit === suits[0]);
  const straightHigh = getPokerStraightHigh(ranks);
  const straight = straightHigh !== null;
  const rankId = getPokerHandRankId({ counts, flush, straight, straightHigh });
  const payout = POKER_PAYOUTS[rankId];

  return {
    ...payout,
    cards,
    highRank: straightHigh ?? Math.max(...ranks),
    counts: counts.map((entry) => ({ ...entry }))
  };
}

export function getPokerPayoutTable() {
  return [
    POKER_PAYOUTS.royal_flush,
    POKER_PAYOUTS.straight_flush,
    POKER_PAYOUTS.four_kind,
    POKER_PAYOUTS.full_house,
    POKER_PAYOUTS.flush,
    POKER_PAYOUTS.straight,
    POKER_PAYOUTS.three_kind,
    POKER_PAYOUTS.two_pair,
    POKER_PAYOUTS.high_pair
  ].map((entry) => ({ ...entry }));
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
  const race = runEmojiRace({ randomInt, trackLength });

  return createEmojiRaceResult({
    choice: normalizedChoice,
    bet,
    frames: race.frames,
    winner: race.winner
  });
}

export function playEmojiRacePool({
  bets,
  randomInt = defaultRandomInt,
  trackLength = EMOJI_RACE_TRACK_LENGTH,
  payoutBps = EMOJI_RACE_POOL_PAYOUT_BPS
} = {}) {
  const normalizedBets = normalizeEmojiRacePoolBets(bets);
  const race = runEmojiRace({ randomInt, trackLength });
  const market = getEmojiRacePoolMarket(normalizedBets, { payoutBps });
  const payouts = calculateEmojiRacePoolPayouts(normalizedBets, race.winner.id, market);

  return {
    game: '이모지경마',
    bets: normalizedBets.map((betEntry) => ({
      ...betEntry,
      payout: payouts.byKey[betEntry.key] ?? 0,
      profit: (payouts.byKey[betEntry.key] ?? 0) - betEntry.bet,
      win: betEntry.choice === race.winner.id
    })),
    racers: EMOJI_RACE_RACERS,
    frames: race.frames,
    finalFrame: race.frames.at(-1),
    winner: race.winner,
    winnerId: race.winner.id,
    market,
    payoutPool: market.payoutPool,
    houseFee: market.houseFee,
    winnerStake: payouts.winnerStake,
    winnerCount: payouts.winnerCount,
    payouts: payouts.byKey
  };
}

export function getEmojiRacePoolMarket(bets, {
  payoutBps = EMOJI_RACE_POOL_PAYOUT_BPS
} = {}) {
  const normalizedBets = normalizeEmojiRacePoolBets(bets);
  const normalizedPayoutBps = normalizeBasisPoints(payoutBps, '이모지 경마 배당률');
  const totalPool = normalizedBets.reduce((total, betEntry) => total + betEntry.bet, 0);
  const payoutPool = Math.floor(totalPool * normalizedPayoutBps / 10_000);
  const stakeByChoice = Object.fromEntries(EMOJI_RACE_RACERS.map((racer) => [racer.id, 0]));
  const countByChoice = Object.fromEntries(EMOJI_RACE_RACERS.map((racer) => [racer.id, 0]));

  for (const betEntry of normalizedBets) {
    stakeByChoice[betEntry.choice] += betEntry.bet;
    countByChoice[betEntry.choice] += 1;
  }

  const oddsByChoice = Object.fromEntries(EMOJI_RACE_RACERS.map((racer) => [
    racer.id,
    stakeByChoice[racer.id] > 0
      ? payoutPool / stakeByChoice[racer.id]
      : null
  ]));

  return {
    totalPool,
    payoutPool,
    houseFee: totalPool - payoutPool,
    payoutBps: normalizedPayoutBps,
    stakeByChoice,
    countByChoice,
    oddsByChoice
  };
}

function runEmojiRace({
  randomInt = defaultRandomInt,
  trackLength = EMOJI_RACE_TRACK_LENGTH
} = {}) {
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

      return { frames, winner };
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

  return { frames, winner };
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

function buildPokerRound(round) {
  const bet = normalizePokerBet(round.bet);
  const hand = normalizePokerHand(round.hand);
  const initialHand = round.initialHand
    ? normalizePokerHand(round.initialHand)
    : [...hand];
  const deck = normalizePokerDeck(round.deck ?? []);
  const held = normalizePokerHeld(round.held);
  const handRank = round.handRank
    ? normalizePokerHandRank(round.handRank)
    : evaluatePokerHand(hand);
  const payout = normalizeNonNegativeSafeInteger(round.payout ?? 0, '포커 지급액');
  const status = round.status ?? 'holding';

  if (!['holding', 'settled'].includes(status)) {
    throw new Error('포커 상태가 올바르지 않습니다.');
  }

  return {
    game: '포커',
    ...round,
    bet,
    initialHand,
    hand,
    deck,
    held,
    handRank,
    status,
    drawCount: normalizeNonNegativeSafeInteger(round.drawCount ?? 0, '포커 교체 횟수'),
    replacedCount: normalizeNonNegativeSafeInteger(round.replacedCount ?? 0, '포커 교체 카드 수'),
    win: payout > 0,
    multiplier: handRank.multiplier,
    payout
  };
}

function buildPlayerPokerRound(round) {
  const bet = normalizePokerBet(round.bet);
  const status = round.status ?? 'holding';
  const hasCurrentTurn = Object.hasOwn(round, 'currentTurn');
  const currentTurn = hasCurrentTurn
    ? round.currentTurn
    : status === 'settled'
      ? null
      : 'challenger';
  const winner = round.winner ?? null;

  if (!['holding', 'settled'].includes(status)) {
    throw new Error('유저 포커 상태가 올바르지 않습니다.');
  }

  if (status === 'holding' && !['challenger', 'opponent'].includes(currentTurn)) {
    throw new Error('유저 포커 차례가 올바르지 않습니다.');
  }

  if (status === 'settled' && currentTurn !== null) {
    throw new Error('종료된 유저 포커에는 현재 차례가 없어야 합니다.');
  }

  if (![null, 'challenger', 'opponent'].includes(winner)) {
    throw new Error('유저 포커 승자가 올바르지 않습니다.');
  }

  return {
    game: '유저 포커',
    ...round,
    bet,
    challenger: buildPlayerPokerParticipant(round.challenger),
    opponent: buildPlayerPokerParticipant(round.opponent),
    deck: normalizePokerDeck(round.deck ?? []),
    currentTurn,
    status,
    winner
  };
}

function buildPlayerPokerParticipant(participant) {
  const hand = normalizePokerHand(participant?.hand);
  const initialHand = participant?.initialHand
    ? normalizePokerHand(participant.initialHand)
    : [...hand];
  const held = normalizePokerHeld(participant?.held);
  const status = participant?.status ?? 'holding';
  const handRank = participant?.handRank
    ? normalizePokerHandRank(participant.handRank)
    : evaluatePokerHand(hand);

  if (!['holding', 'drawn'].includes(status)) {
    throw new Error('유저 포커 참가자 상태가 올바르지 않습니다.');
  }

  return {
    ...participant,
    initialHand,
    hand,
    held,
    status,
    handRank,
    drawCount: normalizeNonNegativeSafeInteger(participant?.drawCount ?? 0, '유저 포커 교체 횟수'),
    replacedCount: normalizeNonNegativeSafeInteger(participant?.replacedCount ?? 0, '유저 포커 교체 카드 수')
  };
}

function buildPlayerHoldemRound(round) {
  const bet = normalizePokerBet(round.bet);
  const status = round.status ?? 'betting';
  const street = normalizeHoldemStreet(round.street ?? 'preflop');
  const { smallBlind: defaultSmallBlind, bigBlind: defaultBigBlind } = calculateHoldemBlinds(bet);
  const smallBlind = normalizeNonNegativeSafeInteger(round.smallBlind ?? defaultSmallBlind, '텍사스 홀덤 스몰 블라인드');
  const bigBlind = normalizeNonNegativeSafeInteger(round.bigBlind ?? defaultBigBlind, '텍사스 홀덤 빅 블라인드');
  const rawPlayers = Array.isArray(round.players)
    ? round.players
    : [
      { key: 'challenger', ...round.challenger },
      { key: 'opponent', ...round.opponent }
    ];
  const players = rawPlayers.map((player, index) => buildHoldemParticipant(
    { ...player, key: player?.key ?? (index === 0 ? 'challenger' : `player${index}`) },
    round.communityCards,
    status
  ));
  const playerKeys = players.map((player) => player.key);
  const button = normalizeHoldemParticipantKey(round.button ?? players[0]?.key ?? HOLDEM_BUTTON, playerKeys);
  const smallBlindParticipant = normalizeHoldemParticipantKey(
    round.smallBlindParticipant ?? (players.length === 2 ? button : players[1]?.key),
    playerKeys
  );
  const bigBlindParticipant = normalizeHoldemParticipantKey(
    round.bigBlindParticipant ?? (players.length === 2 ? players[1]?.key : players[2]?.key),
    playerKeys
  );
  const hasCurrentTurn = Object.hasOwn(round, 'currentTurn');
  const currentTurn = hasCurrentTurn
    ? round.currentTurn
    : status === 'settled'
      ? null
      : 'challenger';
  const winner = round.winner ?? null;
  const winners = normalizeHoldemWinners(round.winners ?? (winner ? [winner] : []), playerKeys);
  const settlementReason = round.settlementReason ?? null;
  const revealedCommunityCount = normalizeHoldemRevealCount(round.revealedCommunityCount ?? HOLDEM_STREETS[street].reveal);
  const pot = normalizeNonNegativeSafeInteger(
    round.pot ?? players.reduce((total, player) => total + player.totalCommitted, 0),
    '텍사스 홀덤 팟'
  );
  const currentBet = normalizeNonNegativeSafeInteger(round.currentBet ?? 0, '텍사스 홀덤 현재 베팅');
  const minRaise = normalizeNonNegativeSafeInteger(round.minRaise ?? bigBlind, '텍사스 홀덤 최소 레이즈');
  const pots = Array.isArray(round.pots) ? round.pots.map((sidePot) => ({
    amount: normalizeNonNegativeSafeInteger(sidePot.amount ?? 0, '텍사스 홀덤 사이드팟'),
    eligible: Array.isArray(sidePot.eligible)
      ? sidePot.eligible.map((key) => normalizeHoldemParticipantKey(key, playerKeys))
      : [],
    winners: Array.isArray(sidePot.winners)
      ? sidePot.winners.map((key) => normalizeHoldemParticipantKey(key, playerKeys))
      : []
  })) : [];

  if (!['betting', 'settled'].includes(status)) {
    throw new Error('텍사스 홀덤 상태가 올바르지 않습니다.');
  }

  if (status === 'betting' && !playerKeys.includes(currentTurn)) {
    throw new Error('텍사스 홀덤 차례가 올바르지 않습니다.');
  }

  if (status === 'settled' && currentTurn !== null) {
    throw new Error('종료된 텍사스 홀덤에는 현재 차례가 없어야 합니다.');
  }

  if (winner !== null && !playerKeys.includes(winner)) {
    throw new Error('텍사스 홀덤 승자가 올바르지 않습니다.');
  }
  const aliases = Object.fromEntries(players.map((player) => [player.key, player]));

  return {
    game: '텍사스 홀덤',
    ...round,
    bet,
    button,
    smallBlindParticipant,
    bigBlindParticipant,
    smallBlind,
    bigBlind,
    players,
    ...aliases,
    communityCards: normalizePokerCards(round.communityCards, HOLDEM_COMMUNITY_SIZE, HOLDEM_COMMUNITY_SIZE, '텍사스 홀덤 커뮤니티 카드'),
    deck: normalizePokerDeck(round.deck ?? []),
    street,
    streetLabel: HOLDEM_STREETS[street].label,
    revealedCommunityCount,
    currentTurn,
    currentBet,
    minRaise,
    pot,
    status,
    winner,
    winners,
    pots,
    settlementReason
  };
}

function createHoldemParticipant({ key, holeCards, stack = 0 }) {
  return {
    key,
    holeCards,
    stack,
    streetCommitted: 0,
    totalCommitted: 0,
    acted: false,
    folded: false,
    allIn: false,
    handRank: null
  };
}

function buildHoldemParticipant(participant, communityCards, roundStatus) {
  const key = String(participant?.key ?? '').trim();
  if (!key) {
    throw new Error('텍사스 홀덤 참가자 키가 올바르지 않습니다.');
  }
  const holeCards = normalizePokerCards(participant?.holeCards, HOLDEM_HOLE_SIZE, HOLDEM_HOLE_SIZE, '텍사스 홀덤 홀카드');
  const stack = normalizeNonNegativeSafeInteger(participant?.stack ?? 0, '텍사스 홀덤 스택');
  const streetCommitted = normalizeNonNegativeSafeInteger(participant?.streetCommitted ?? 0, '텍사스 홀덤 현재 스트리트 베팅');
  const totalCommitted = normalizeNonNegativeSafeInteger(participant?.totalCommitted ?? streetCommitted, '텍사스 홀덤 누적 베팅');
  const shouldRank = roundStatus === 'settled' && Array.isArray(communityCards) && communityCards.length >= HOLDEM_COMMUNITY_SIZE;
  const handRank = participant?.handRank
    ? normalizeCommunityPokerHandRank(participant.handRank)
    : shouldRank
      ? evaluateBestPokerHand([...holeCards, ...communityCards])
      : null;

  return {
    ...participant,
    key,
    holeCards,
    stack,
    streetCommitted,
    totalCommitted,
    acted: Boolean(participant?.acted),
    folded: Boolean(participant?.folded),
    allIn: Boolean(participant?.allIn) || stack === 0,
    handRank
  };
}

function assertPokerHoldingRound(round) {
  if (!round || round.status !== 'holding') {
    throw new Error('이미 정산된 포커입니다.');
  }
}

function assertPlayerPokerTurn(round, participant) {
  if (round.status !== 'holding') {
    throw new Error('이미 종료된 유저 포커입니다.');
  }

  const key = normalizePlayerCasinoParticipant(participant);
  if (round.currentTurn !== key) {
    throw new Error('지금은 상대 차례입니다.');
  }

  if (round[key].status !== 'holding') {
    throw new Error('이미 교체를 마친 유저 포커 참가자입니다.');
  }

  return key;
}

function settlePlayerPokerRound(round) {
  const current = buildPlayerPokerRound(round);
  const comparison = comparePokerHands(current.challenger.hand, current.opponent.hand);
  const winner = comparison > 0
    ? 'challenger'
    : comparison < 0
      ? 'opponent'
      : null;

  return buildPlayerPokerRound({
    ...current,
    currentTurn: null,
    status: 'settled',
    winner
  });
}

function normalizePlayerCasinoParticipant(participant) {
  if (participant === 'challenger' || participant === 'opponent') return participant;
  throw new Error('유저 포커 참가자는 challenger 또는 opponent여야 합니다.');
}

function normalizeHoldemPlayerSpecs(players) {
  const rawPlayers = players ?? ['challenger', 'opponent'];
  if (!Array.isArray(rawPlayers) || rawPlayers.length < 2 || rawPlayers.length > 6) {
    throw new Error('텍사스 홀덤 참가자는 2~6명이어야 합니다.');
  }

  const normalized = rawPlayers.map((player, index) => {
    const key = typeof player === 'string'
      ? player
      : player?.key ?? player?.id ?? (index === 0 ? 'challenger' : `player${index}`);
    const normalizedKey = String(key ?? '').trim();
    if (!normalizedKey) {
      throw new Error('텍사스 홀덤 참가자 키가 올바르지 않습니다.');
    }
    return {
      ...(typeof player === 'object' && player !== null ? player : {}),
      key: normalizedKey
    };
  });
  const keys = normalized.map((player) => player.key);
  if (new Set(keys).size !== keys.length) {
    throw new Error('텍사스 홀덤 참가자는 중복될 수 없습니다.');
  }
  return normalized;
}

function getHoldemInitialStack(stacks, key, index, fallback) {
  if (stacks === null || stacks === undefined) return fallback;
  if (Array.isArray(stacks)) {
    return normalizePokerBet(stacks[index] ?? fallback);
  }
  if (typeof stacks === 'object') {
    return normalizePokerBet(stacks[key] ?? fallback);
  }
  return normalizePokerBet(stacks);
}

function normalizeHoldemParticipantKey(participant, playerKeys) {
  const key = String(participant ?? '').trim();
  if (playerKeys.includes(key)) return key;
  throw new Error('텍사스 홀덤 참가자가 올바르지 않습니다.');
}

function normalizeHoldemWinners(winners, playerKeys) {
  if (!Array.isArray(winners)) return [];
  return winners.map((key) => normalizeHoldemParticipantKey(key, playerKeys));
}

function getHoldemPlayerKeys(round) {
  return round.players.map((player) => player.key);
}

function getHoldemPlayerIndex(round, participant) {
  const key = normalizeHoldemParticipantKey(participant, getHoldemPlayerKeys(round));
  return round.players.findIndex((player) => player.key === key);
}

function getHoldemPlayer(round, participant) {
  return round.players[getHoldemPlayerIndex(round, participant)];
}

function updateHoldemPlayer(round, participant, player) {
  const key = normalizeHoldemParticipantKey(participant, getHoldemPlayerKeys(round));
  return buildPlayerHoldemRound({
    ...round,
    players: round.players.map((current) => current.key === key ? player : current)
  });
}

function updateHoldemPlayers(round, updates) {
  return buildPlayerHoldemRound({
    ...round,
    players: round.players.map((player) => updates[player.key] ?? player)
  });
}

function assertPlayerHoldemTurn(round, participant) {
  if (round.status !== 'betting') {
    throw new Error('이미 종료된 텍사스 홀덤입니다.');
  }

  const key = normalizeHoldemParticipantKey(participant, getHoldemPlayerKeys(round));
  if (round.currentTurn !== key) {
    throw new Error('지금은 상대 차례입니다.');
  }

  if (round[key].folded) {
    throw new Error('이미 폴드한 참가자입니다.');
  }

  return key;
}

function normalizeHoldemAction(action) {
  if (action && typeof action === 'object') {
    return normalizeHoldemActionObject(action);
  }

  const normalized = String(action ?? '').trim().toLocaleLowerCase('ko-KR');
  if (['check', '체크'].includes(normalized)) return { type: 'check' };
  if (['call', 'continue', '콜', '진행'].includes(normalized)) return { type: 'call' };
  if (['fold', '폴드', '다이'].includes(normalized)) return { type: 'fold' };
  if (['half_pot', 'half-pot', 'halfpot', '하프팟', '1/2팟'].includes(normalized)) {
    return { type: 'raise', sizing: 'half_pot' };
  }
  if (['pot', '팟', '팟베팅', 'pot_bet'].includes(normalized)) {
    return { type: 'raise', sizing: 'pot' };
  }
  if (['all_in', 'all-in', 'allin', '올인'].includes(normalized)) {
    return { type: 'raise', sizing: 'all_in' };
  }
  throw new Error('텍사스 홀덤 행동은 체크, 콜, 레이즈, 올인 또는 폴드여야 합니다.');
}

function normalizeHoldemActionObject(action) {
  const type = String(action.type ?? action.action ?? '').trim().toLocaleLowerCase('ko-KR');
  if (['check', '체크'].includes(type)) return { type: 'check' };
  if (['call', '콜'].includes(type)) return { type: 'call' };
  if (['fold', '폴드'].includes(type)) return { type: 'fold' };
  if (['raise', 'bet', '레이즈', '베팅'].includes(type)) {
    const sizing = String(action.sizing ?? action.size ?? 'pot').trim().toLocaleLowerCase('ko-KR');
    if (['half_pot', 'half-pot', 'halfpot', '하프팟', '1/2팟'].includes(sizing)) {
      return { type: 'raise', sizing: 'half_pot' };
    }
    if (['pot', '팟', '팟베팅'].includes(sizing)) {
      return { type: 'raise', sizing: 'pot' };
    }
    if (['all_in', 'all-in', 'allin', '올인'].includes(sizing)) {
      return { type: 'raise', sizing: 'all_in' };
    }
    if (action.amount !== undefined) {
      return {
        type: 'raise',
        sizing: 'amount',
        amount: normalizeNonNegativeSafeInteger(action.amount, '텍사스 홀덤 레이즈 금액')
      };
    }
  }
  throw new Error('텍사스 홀덤 행동은 체크, 콜, 레이즈, 올인 또는 폴드여야 합니다.');
}

function normalizeHoldemStreet(street) {
  const normalized = String(street ?? '').trim();
  if (Object.hasOwn(HOLDEM_STREETS, normalized)) return normalized;
  throw new Error('텍사스 홀덤 거리 상태가 올바르지 않습니다.');
}

function normalizeHoldemRevealCount(count) {
  const normalized = Number(count);
  if (!Number.isSafeInteger(normalized) || normalized < 0 || normalized > HOLDEM_COMMUNITY_SIZE) {
    throw new Error('텍사스 홀덤 공개 카드 수가 올바르지 않습니다.');
  }
  return normalized;
}

function calculateHoldemBlinds(stackSize) {
  const normalizedStack = normalizePokerBet(stackSize);
  const bigBlind = Math.min(
    normalizedStack,
    Math.max(2, Math.floor(normalizedStack / HOLDEM_BIG_BLIND_DIVISOR))
  );
  const smallBlind = Math.min(
    bigBlind,
    Math.max(1, Math.floor(bigBlind / 2))
  );

  return {
    smallBlind,
    bigBlind
  };
}

function getHoldemCallAmount(round, participant) {
  const player = getHoldemPlayer(round, participant);
  return Math.max(0, round.currentBet - player.streetCommitted);
}

function commitHoldemChips(participant, amount) {
  const chips = Math.min(
    normalizeNonNegativeSafeInteger(amount, '텍사스 홀덤 투입 칩'),
    participant.stack
  );

  return {
    ...participant,
    stack: participant.stack - chips,
    streetCommitted: participant.streetCommitted + chips,
    totalCommitted: participant.totalCommitted + chips,
    allIn: participant.stack - chips === 0
  };
}

function applyHoldemCheck(round, participant) {
  const callAmount = getHoldemCallAmount(round, participant);
  if (callAmount > 0) {
    throw new Error(`체크할 수 없습니다. ${callAmount.toLocaleString()}골드를 콜해야 합니다.`);
  }

  const player = getHoldemPlayer(round, participant);
  return updateHoldemPlayer(round, participant, {
    ...player,
    acted: true
  });
}

function applyHoldemCall(round, participant) {
  const callAmount = getHoldemCallAmount(round, participant);
  const player = getHoldemPlayer(round, participant);
  const committed = commitHoldemChips(player, callAmount);

  return updateHoldemPlayer({
    ...round,
    pot: round.pot + Math.min(callAmount, player.stack)
  }, participant, {
    ...committed,
    acted: true
  });
}

function applyHoldemBetOrRaise(round, participant, action) {
  const player = getHoldemPlayer(round, participant);
  if (player.stack <= 0) {
    throw new Error('남은 스택이 없어 베팅할 수 없습니다.');
  }

  const targetTotal = getHoldemRaiseTarget(round, participant, action);
  const maxTotal = player.streetCommitted + player.stack;
  if (targetTotal <= round.currentBet && targetTotal < maxTotal) {
    throw new Error('현재 베팅보다 높게 레이즈해야 합니다.');
  }

  const raiseSize = Math.max(0, targetTotal - round.currentBet);
  const minBetOrRaise = round.currentBet === 0 ? round.bigBlind : round.minRaise;
  const isAllIn = targetTotal >= maxTotal;
  if (raiseSize < minBetOrRaise && !isAllIn) {
    throw new Error(`최소 ${minBetOrRaise.toLocaleString()}골드 이상 베팅/레이즈해야 합니다.`);
  }

  const committedAmount = targetTotal - player.streetCommitted;
  const committed = commitHoldemChips(player, committedAmount);
  const reopensAction = raiseSize >= minBetOrRaise;
  const updates = Object.fromEntries(round.players.map((current) => [
    current.key,
    current.key === player.key
      ? {
        ...committed,
        acted: true
      }
      : {
        ...current,
        acted: reopensAction && !current.folded && !current.allIn ? false : current.acted
      }
  ]));

  return updateHoldemPlayers({
    ...round,
    pot: round.pot + Math.min(committedAmount, player.stack),
    currentBet: Math.max(round.currentBet, committed.streetCommitted),
    minRaise: reopensAction ? Math.max(raiseSize, round.bigBlind) : round.minRaise
  }, updates);
}

function getHoldemRaiseTarget(round, participant, action) {
  const player = getHoldemPlayer(round, participant);
  const maxTotal = player.streetCommitted + player.stack;
  if (action.sizing === 'all_in') return maxTotal;
  if (action.sizing === 'amount') return Math.min(maxTotal, action.amount);

  const callAmount = getHoldemCallAmount(round, participant);
  const potAfterCall = round.pot + Math.min(callAmount, player.stack);
  const rawRaise = action.sizing === 'half_pot'
    ? Math.floor(potAfterCall / 2)
    : potAfterCall;
  const raiseOrBet = Math.max(round.currentBet === 0 ? round.bigBlind : round.minRaise, rawRaise);
  const targetTotal = round.currentBet === 0
    ? raiseOrBet
    : round.currentBet + raiseOrBet;

  return Math.min(maxTotal, targetTotal);
}

function resolveHoldemAfterAction(round) {
  const current = buildPlayerHoldemRound(round);
  const active = current.players.filter((player) => !player.folded).map((player) => player.key);

  if (active.length === 1) {
    return settlePlayerHoldemRound(current, active[0], 'fold');
  }

  if (isHoldemAllInShowdown(current)) {
    return settlePlayerHoldemRound({
      ...current,
      revealedCommunityCount: HOLDEM_COMMUNITY_SIZE,
      street: 'showdown'
    }, null, 'showdown');
  }

  if (isHoldemBettingRoundClosed(current)) {
    return advancePlayerHoldemStreet(current);
  }

  return buildPlayerHoldemRound({
    ...current,
    currentTurn: getNextHoldemActor(current)
  });
}

function isHoldemAllInShowdown(round) {
  const active = round.players.filter((player) => !player.folded);
  return active.length > 1
    && active.some((player) => player.allIn)
    && active.filter((player) => !player.allIn).length <= 1
    && active.every((player) => player.allIn || (player.acted && player.streetCommitted === round.currentBet));
}

function isHoldemBettingRoundClosed(round) {
  const active = round.players.filter((player) => !player.folded);
  return active.length > 1 && active.every((player) => (
    player.allIn
      || (player.acted && player.streetCommitted === round.currentBet)
  ));
}

function getNextHoldemActor(round) {
  const currentIndex = getHoldemPlayerIndex(round, round.currentTurn);
  for (let offset = 1; offset <= round.players.length; offset += 1) {
    const player = round.players[(currentIndex + offset) % round.players.length];
    if (!player.folded && !player.allIn) return player.key;
  }
  return null;
}

function getHoldemFirstActorForStreet(street, round) {
  const buttonIndex = getHoldemPlayerIndex(round, round.button);
  const bigBlindIndex = getHoldemPlayerIndex(round, round.bigBlindParticipant);
  return getHoldemFirstActorForStreetFromPlayers(round.players, street, buttonIndex, bigBlindIndex);
}

function getHoldemFirstActorForStreetFromPlayers(players, street, buttonIndex, bigBlindIndex) {
  const startIndex = street === 'preflop'
    ? (bigBlindIndex + 1) % players.length
    : (buttonIndex + 1) % players.length;
  for (let offset = 0; offset < players.length; offset += 1) {
    const player = players[(startIndex + offset) % players.length];
    if (!player.folded && !player.allIn) return player.key;
  }
  return null;
}

function advancePlayerHoldemStreet(round) {
  const current = buildPlayerHoldemRound(round);
  const street = HOLDEM_STREETS[current.street];

  if (street.next === 'showdown') {
    return settlePlayerHoldemRound({
      ...current,
      revealedCommunityCount: HOLDEM_COMMUNITY_SIZE,
      street: 'showdown'
    }, null, 'showdown');
  }

  return buildPlayerHoldemRound({
    ...current,
    street: street.next,
    revealedCommunityCount: HOLDEM_STREETS[street.next].reveal,
    currentTurn: getHoldemFirstActorForStreet(street.next, current),
    currentBet: 0,
    minRaise: current.bigBlind,
    players: current.players.map((player) => ({
      ...player,
      streetCommitted: 0,
      acted: false
    }))
  });
}

function settlePlayerHoldemRound(round, forcedWinner = null, settlementReason = 'showdown') {
  const current = buildPlayerHoldemRound(round);
  const rankedPlayers = current.players.map((player) => ({
    ...player,
    acted: true,
    handRank: evaluateBestPokerHand([...player.holeCards, ...current.communityCards])
  }));
  const settlement = forcedWinner
    ? settleHoldemForcedWinner(current, rankedPlayers, forcedWinner)
    : settleHoldemShowdown(current, rankedPlayers);
  const updatedPlayers = rankedPlayers.map((player) => ({
    ...player,
    stack: player.stack + (settlement.payouts[player.key] ?? 0)
  }));
  const winners = Object.keys(settlement.payouts)
    .filter((key) => settlement.payouts[key] > 0);
  const winner = winners.length === 1 ? winners[0] : null;

  return buildPlayerHoldemRound({
    ...current,
    players: updatedPlayers,
    currentTurn: null,
    currentBet: 0,
    revealedCommunityCount: HOLDEM_COMMUNITY_SIZE,
    street: settlementReason === 'fold' ? current.street : 'showdown',
    status: 'settled',
    winner,
    winners,
    pots: settlement.pots,
    settlementReason
  });
}

function settleHoldemForcedWinner(round, rankedPlayers, forcedWinner) {
  const winner = normalizeHoldemParticipantKey(forcedWinner, rankedPlayers.map((player) => player.key));
  return {
    payouts: {
      [winner]: round.pot
    },
    pots: [{
      amount: round.pot,
      eligible: rankedPlayers.filter((player) => player.totalCommitted > 0).map((player) => player.key),
      winners: [winner]
    }]
  };
}

function settleHoldemShowdown(round, rankedPlayers) {
  const pots = buildHoldemSidePots(rankedPlayers);
  const payouts = Object.fromEntries(rankedPlayers.map((player) => [player.key, 0]));
  const settledPots = pots.map((pot) => {
    const eligiblePlayers = rankedPlayers.filter((player) => (
      pot.eligible.includes(player.key) && !player.folded
    ));
    const winners = getBestHoldemPlayers(eligiblePlayers);
    const share = Math.floor(pot.amount / winners.length);
    let remainder = pot.amount % winners.length;
    for (const winner of winners) {
      payouts[winner.key] += share + (remainder > 0 ? 1 : 0);
      remainder -= remainder > 0 ? 1 : 0;
    }
    return {
      ...pot,
      winners: winners.map((winner) => winner.key)
    };
  });

  return {
    payouts,
    pots: settledPots
  };
}

function buildHoldemSidePots(players) {
  const levels = [...new Set(players
    .map((player) => player.totalCommitted)
    .filter((amount) => amount > 0))]
    .sort((a, b) => a - b);
  const pots = [];
  let previous = 0;

  for (const level of levels) {
    const contributors = players.filter((player) => player.totalCommitted >= level);
    const amount = (level - previous) * contributors.length;
    if (amount > 0) {
      pots.push({
        amount,
        eligible: contributors.map((player) => player.key),
        winners: []
      });
    }
    previous = level;
  }

  return pots;
}

function getBestHoldemPlayers(players) {
  let winners = [];
  for (const player of players) {
    if (winners.length === 0) {
      winners = [player];
      continue;
    }
    const comparison = comparePokerHands(player.handRank, winners[0].handRank);
    if (comparison > 0) {
      winners = [player];
    } else if (comparison === 0) {
      winners.push(player);
    }
  }
  return winners;
}

function createShuffledPokerDeck(randomInt) {
  const deck = [];
  for (const suit of POKER_SUITS) {
    for (const rank of CARD_RANKS) {
      deck.push(`${rank}${suit}`);
    }
  }

  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index);
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }

  return deck;
}

function normalizePokerBet(bet) {
  const normalized = Number(bet);

  if (!Number.isSafeInteger(normalized) || normalized <= 0) {
    throw new Error('포커 베팅액은 1 이상의 정수여야 합니다.');
  }
  if (normalized > CASINO_MAX_BET) {
    throw new Error(`포커 베팅액은 최대 ${CASINO_MAX_BET.toLocaleString()}골드까지 가능합니다.`);
  }

  return normalized;
}

function normalizePokerHand(hand) {
  if (!Array.isArray(hand) || hand.length !== POKER_HAND_SIZE) {
    throw new Error(`포커 패는 ${POKER_HAND_SIZE}장이어야 합니다.`);
  }

  return normalizePokerCards(hand, POKER_HAND_SIZE, POKER_HAND_SIZE, '포커 패');
}

function normalizePokerCards(cards, minLength, maxLength, label = '포커 카드') {
  if (!Array.isArray(cards) || cards.length < minLength || cards.length > maxLength) {
    throw new Error(`${label}는 ${minLength}${minLength === maxLength ? '' : `~${maxLength}`}장이어야 합니다.`);
  }

  const normalized = cards.map(normalizePokerCard);
  if (new Set(normalized).size !== normalized.length) {
    throw new Error(`${label}에는 중복 카드가 있을 수 없습니다.`);
  }

  return normalized;
}

function normalizePokerDeck(deck) {
  if (!Array.isArray(deck)) {
    throw new Error('포커 덱은 카드 배열이어야 합니다.');
  }

  const normalized = deck.map(normalizePokerCard);
  if (new Set(normalized).size !== normalized.length) {
    throw new Error('포커 덱에는 중복 카드가 있을 수 없습니다.');
  }

  return normalized;
}

function normalizePokerHeld(held) {
  if (held === undefined) {
    return Array.from({ length: POKER_HAND_SIZE }, () => false);
  }

  if (!Array.isArray(held) || held.length !== POKER_HAND_SIZE) {
    throw new Error(`포커 보류 상태는 ${POKER_HAND_SIZE}개여야 합니다.`);
  }

  return held.map(Boolean);
}

function applyPokerHoldRecommendation({ cards, handRank, held }) {
  const rankGroups = groupPokerCards(cards, (card) => pokerRankValue(card.rank));

  if (['straight', 'flush', 'full_house', 'four_kind', 'straight_flush', 'royal_flush'].includes(handRank.id)) {
    held.fill(true);
    return `${handRank.label} 완성`;
  }

  const tripleGroup = rankGroups.find((group) => group.length === 3);
  if (tripleGroup) {
    holdPokerCards(held, tripleGroup);
    return '트리플 보존';
  }

  const pairGroups = rankGroups.filter((group) => group.length === 2);
  if (pairGroups.length >= 2) {
    holdPokerCards(held, pairGroups.flat());
    return '투페어 보존';
  }

  const pairGroup = pairGroups[0];
  if (pairGroup) {
    holdPokerCards(held, pairGroup);
    return '원페어 보존';
  }

  const suitGroups = groupPokerCards(cards, (card) => card.suit);
  const fourFlush = suitGroups.find((group) => group.length === 4);
  if (fourFlush) {
    holdPokerCards(held, fourFlush);
    return '플러시 4장 대기';
  }

  const straightDraw = findPokerStraightDraw(cards);
  if (straightDraw) {
    holdPokerCards(held, straightDraw);
    return '스트레이트 4장 대기';
  }

  const highCards = cards.filter((card) => pokerRankValue(card.rank) >= 11);
  if (highCards.length > 0) {
    holdPokerCards(held, highCards);
    return 'J 이상 높은 카드 보존';
  }

  const highest = cards.reduce((best, card) =>
    pokerRankValue(card.rank) > pokerRankValue(best.rank) ? card : best
  );
  holdPokerCards(held, [highest]);
  return '최고 카드 1장 보존';
}

function groupPokerCards(cards, keyResolver) {
  const groups = new Map();
  for (const card of cards) {
    const key = keyResolver(card);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(card);
  }

  return [...groups.values()].sort((a, b) => b.length - a.length);
}

function holdPokerCards(held, cards) {
  for (const card of cards) {
    held[card.index] = true;
  }
}

function findPokerStraightDraw(cards) {
  const rankMap = new Map();
  for (const card of cards) {
    const rank = pokerRankValue(card.rank);
    if (!rankMap.has(rank)) rankMap.set(rank, []);
    rankMap.get(rank).push(card);
    if (rank === 14) {
      if (!rankMap.has(1)) rankMap.set(1, []);
      rankMap.get(1).push(card);
    }
  }

  const windows = [];
  for (let start = 1; start <= 10; start += 1) {
    const ranks = Array.from({ length: 5 }, (_, index) => start + index);
    const presentRanks = ranks.filter((rank) => rankMap.has(rank));
    if (presentRanks.length === 4) {
      windows.push({
        missingInside: ranks[0] !== presentRanks[0] && ranks.at(-1) !== presentRanks.at(-1),
        high: ranks.at(-1),
        cards: presentRanks.map((rank) => rankMap.get(rank)[0])
      });
    }
  }

  if (windows.length === 0) return null;
  windows.sort((a, b) => Number(a.missingInside) - Number(b.missingInside) || b.high - a.high);
  return windows[0].cards;
}

function normalizePokerCardIndex(index) {
  const normalized = Number(index);

  if (!Number.isSafeInteger(normalized) || normalized < 0 || normalized >= POKER_HAND_SIZE) {
    throw new Error(`포커 카드 번호는 1~${POKER_HAND_SIZE} 사이여야 합니다.`);
  }

  return normalized;
}

function normalizePokerCard(card) {
  const parsed = parsePokerCard(card);
  return `${parsed.rank}${parsed.suit}`;
}

function parsePokerCard(card) {
  const text = String(card ?? '').trim().toUpperCase();
  const suit = POKER_SUITS.find((candidate) => text.endsWith(candidate));
  if (!suit) {
    throw new Error('포커 카드는 예: A♠, 10♥ 형식이어야 합니다.');
  }

  const rank = text.slice(0, -suit.length);
  if (!CARD_RANKS.includes(rank)) {
    throw new Error('포커 카드 숫자는 A, 2~10, J, Q, K 중 하나여야 합니다.');
  }

  return { rank, suit };
}

function normalizePokerHandRank(handRank) {
  const rankId = handRank?.id;
  const payout = POKER_PAYOUTS[rankId] ?? POKER_PAYOUTS.high_card;
  return {
    ...payout,
    cards: Array.isArray(handRank?.cards) ? handRank.cards.map(normalizePokerCard) : [],
    highRank: Number(handRank?.highRank ?? 0),
    counts: Array.isArray(handRank?.counts)
      ? handRank.counts.map((entry) => ({
        rank: Number(entry.rank) || 0,
        count: Number(entry.count) || 0
      }))
      : []
  };
}

function normalizeCommunityPokerHandRank(handRank) {
  const normalized = normalizePokerHandRank(handRank);
  if (normalized.id === 'high_pair' || normalized.id === 'low_pair') {
    return {
      ...normalized,
      label: '원페어'
    };
  }
  return normalized;
}

function getPokerHandTieBreakers(handRank) {
  const rank = normalizePokerHandRank(handRank);
  const counts = rank.counts
    .map((entry) => ({ rank: Number(entry.rank) || 0, count: Number(entry.count) || 0 }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);
  const ranksDescending = rank.cards
    .map((card) => pokerRankValue(parsePokerCard(card).rank))
    .sort((a, b) => b - a);

  if (rank.id === 'royal_flush') return [14];
  if (rank.id === 'straight_flush' || rank.id === 'straight') return [rank.highRank];
  if (rank.id === 'four_kind') {
    const quad = counts.find((entry) => entry.count === 4)?.rank ?? 0;
    const kicker = counts.find((entry) => entry.count === 1)?.rank ?? 0;
    return [quad, kicker];
  }
  if (rank.id === 'full_house') {
    const triple = counts.find((entry) => entry.count === 3)?.rank ?? 0;
    const pair = counts.find((entry) => entry.count === 2)?.rank ?? 0;
    return [triple, pair];
  }
  if (rank.id === 'flush' || rank.id === 'high_card') return ranksDescending;
  if (rank.id === 'three_kind') {
    const triple = counts.find((entry) => entry.count === 3)?.rank ?? 0;
    const kickers = counts
      .filter((entry) => entry.count === 1)
      .map((entry) => entry.rank)
      .sort((a, b) => b - a);
    return [triple, ...kickers];
  }
  if (rank.id === 'two_pair') {
    const pairs = counts
      .filter((entry) => entry.count === 2)
      .map((entry) => entry.rank)
      .sort((a, b) => b - a);
    const kicker = counts.find((entry) => entry.count === 1)?.rank ?? 0;
    return [...pairs, kicker];
  }
  if (rank.id === 'high_pair' || rank.id === 'low_pair') {
    const pair = counts.find((entry) => entry.count === 2)?.rank ?? 0;
    const kickers = counts
      .filter((entry) => entry.count === 1)
      .map((entry) => entry.rank)
      .sort((a, b) => b - a);
    return [pair, ...kickers];
  }

  return [rank.highRank, ...ranksDescending];
}

function getPokerCombinations(cards, size) {
  const results = [];
  const current = [];

  function visit(start) {
    if (current.length === size) {
      results.push([...current]);
      return;
    }

    const needed = size - current.length;
    for (let index = start; index <= cards.length - needed; index += 1) {
      current.push(cards[index]);
      visit(index + 1);
      current.pop();
    }
  }

  visit(0);
  return results;
}

function getPokerHandRankId({ counts, flush, straight, straightHigh }) {
  const countPattern = counts.map((entry) => entry.count).join(',');

  if (flush && straight && straightHigh === 14) return 'royal_flush';
  if (flush && straight) return 'straight_flush';
  if (countPattern === '4,1') return 'four_kind';
  if (countPattern === '3,2') return 'full_house';
  if (flush) return 'flush';
  if (straight) return 'straight';
  if (countPattern === '3,1,1') return 'three_kind';
  if (countPattern === '2,2,1') return 'two_pair';
  if (countPattern === '2,1,1,1') {
    const pairRank = counts.find((entry) => entry.count === 2)?.rank ?? 0;
    return pairRank >= 11 || pairRank === 14 ? 'high_pair' : 'low_pair';
  }
  return 'high_card';
}

function getPokerStraightHigh(ranks) {
  const unique = [...new Set(ranks)].sort((a, b) => a - b);
  if (unique.length !== POKER_HAND_SIZE) return null;

  if (unique.join(',') === '2,3,4,5,14') return 5;
  for (let index = 1; index < unique.length; index += 1) {
    if (unique[index] !== unique[index - 1] + 1) return null;
  }

  return unique.at(-1);
}

function pokerRankValue(rank) {
  if (rank === 'A') return 14;
  if (rank === 'K') return 13;
  if (rank === 'Q') return 12;
  if (rank === 'J') return 11;
  return Number(rank);
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
  if (normalized > CASINO_MAX_BET) {
    throw new Error(`타이밍 베팅액은 최대 ${CASINO_MAX_BET.toLocaleString()}골드까지 가능합니다.`);
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
  if (normalized > CASINO_MAX_BET) {
    throw new Error(`데드라인 베팅액은 최대 ${CASINO_MAX_BET.toLocaleString()}골드까지 가능합니다.`);
  }

  return normalized;
}

function normalizeCasinoBetAmount(value, label) {
  const normalized = normalizePositiveSafeInteger(value, label);
  if (normalized > CASINO_MAX_BET) {
    throw new Error(`${label}은 최대 ${CASINO_MAX_BET.toLocaleString()}골드까지 가능합니다.`);
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

function normalizePositiveSafeInteger(value, label) {
  const normalized = Number(value);

  if (!Number.isSafeInteger(normalized) || normalized < 1) {
    throw new Error(`${label}은 1 이상의 정수여야 합니다.`);
  }

  return normalized;
}

function normalizeBasisPoints(value, label) {
  const normalized = Number(value);

  if (!Number.isSafeInteger(normalized) || normalized < 0 || normalized > 10_000) {
    throw new Error(`${label}은 0~10000 사이의 정수여야 합니다.`);
  }

  return normalized;
}

function normalizeEmojiRaceTrackLength(trackLength) {
  if (!Number.isSafeInteger(trackLength) || trackLength < 3 || trackLength > 20) {
    throw new Error('이모지 경마 트랙 길이는 3~20 사이의 정수여야 합니다.');
  }

  return trackLength;
}

function normalizeEmojiRacePoolBets(bets) {
  if (!Array.isArray(bets) || bets.length < 1) {
    throw new Error('이모지 경마 배당 베팅은 1명 이상이어야 합니다.');
  }

  const normalized = bets.map((betEntry, index) => {
    const userId = String(betEntry?.userId ?? betEntry?.key ?? `bettor-${index + 1}`).trim();
    const key = String(betEntry?.key ?? userId).trim();
    const username = String(betEntry?.username ?? userId).trim();
    const choice = normalizeEmojiRaceChoice(betEntry?.choice);
    const bet = normalizeCasinoBetAmount(betEntry?.bet, `${username} 베팅액`);

    if (!key || !userId || !username) {
      throw new Error('이모지 경마 베팅 참가자 정보가 올바르지 않습니다.');
    }

    return {
      key,
      userId,
      username,
      choice,
      bet
    };
  });

  const keys = new Set(normalized.map((betEntry) => betEntry.key));
  const userIds = new Set(normalized.map((betEntry) => betEntry.userId));

  if (keys.size !== normalized.length || userIds.size !== normalized.length) {
    throw new Error('이모지 경마 배당 베팅 참가자는 중복될 수 없습니다.');
  }

  return normalized;
}

function calculateEmojiRacePoolPayouts(bets, winnerId, market) {
  const winners = bets.filter((betEntry) => betEntry.choice === winnerId);
  const byKey = Object.fromEntries(bets.map((betEntry) => [betEntry.key, 0]));
  const winnerStake = winners.reduce((total, betEntry) => total + betEntry.bet, 0);

  if (winners.length === 0 || winnerStake <= 0 || market.payoutPool <= 0) {
    return {
      byKey,
      winnerStake,
      winnerCount: winners.length
    };
  }

  const allocations = winners.map((betEntry, index) => {
    const weighted = betEntry.bet * market.payoutPool;
    return {
      key: betEntry.key,
      index,
      basePayout: Math.floor(weighted / winnerStake),
      remainder: weighted % winnerStake
    };
  });
  let allocated = 0;

  for (const allocation of allocations) {
    byKey[allocation.key] = allocation.basePayout;
    allocated += allocation.basePayout;
  }

  let remainderPool = market.payoutPool - allocated;
  const remainderOrder = [...allocations].sort((a, b) =>
    b.remainder - a.remainder || a.index - b.index
  );

  for (const allocation of remainderOrder) {
    if (remainderPool <= 0) break;
    byKey[allocation.key] += 1;
    remainderPool -= 1;
  }

  return {
    byKey,
    winnerStake,
    winnerCount: winners.length
  };
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
