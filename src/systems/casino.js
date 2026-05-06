const CARD_RANKS = Object.freeze(['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']);
const SLOT_SYMBOLS = Object.freeze(['🍒', '🍋', '🍇', '🔔', '⭐', '💎', '7️⃣']);

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

export function playBlackjackRound({ bet, randomInt = defaultRandomInt } = {}) {
  const playerHand = [drawCard(randomInt), drawCard(randomInt)];
  const dealerHand = [drawCard(randomInt), drawCard(randomInt)];

  while (handValue(playerHand).value < 17) {
    playerHand.push(drawCard(randomInt));
  }

  while (handValue(dealerHand).value < 17) {
    dealerHand.push(drawCard(randomInt));
  }

  const result = decideBlackjackWinner(playerHand, dealerHand);
  const multiplier = getBlackjackMultiplier(result, playerHand);
  const payout = result === 'push' ? bet : Math.floor(bet * multiplier);

  return {
    game: '블랙잭',
    playerHand,
    dealerHand,
    playerValue: handValue(playerHand).value,
    dealerValue: handValue(dealerHand).value,
    result,
    win: result === 'player',
    multiplier,
    payout
  };
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

function getSlotMultiplier(reels, maxCount) {
  if (maxCount === 3 && reels[0] === '7️⃣') return 20;
  if (maxCount === 3) return 10;
  if (maxCount === 2) return 3;
  return 0;
}

function defaultRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
