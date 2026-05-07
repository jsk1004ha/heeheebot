const CARD_RANKS = Object.freeze(['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']);
const SLOT_SYMBOLS = Object.freeze(['🍒', '🍋', '🍇', '🔔', '⭐', '💎', '7️⃣', '🍀', '🍉', '🍊']);
const ROULETTE_RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const KENO_MIN_NUMBER = 1;
const KENO_MAX_NUMBER = 80;
const KENO_DRAW_COUNT = 10;
const KENO_MAX_PICKS = 5;
const KENO_MULTIPLIERS = Object.freeze({
  1: Object.freeze({ 1: 3 }),
  2: Object.freeze({ 2: 12 }),
  3: Object.freeze({ 2: 2, 3: 45 }),
  4: Object.freeze({ 2: 1, 3: 8, 4: 120 }),
  5: Object.freeze({ 3: 4, 4: 20, 5: 400 })
});

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
  const payout = win ? bet * 2 : 0;

  return {
    game: '주사위',
    choice: normalizedChoice,
    roll,
    outcome,
    win,
    multiplier: win ? 2 : 0,
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

function getSlotMultiplier(reels, maxCount) {
  if (maxCount === 3 && reels[0] === '7️⃣') return 20;
  if (maxCount === 3) return 10;
  if (maxCount === 2) return 3;
  return 0;
}

function defaultRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
