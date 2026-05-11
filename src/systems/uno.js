export const UNO_COLORS = Object.freeze(['red', 'yellow', 'green', 'blue']);
export const UNO_DIRECTIONS = Object.freeze({ clockwise: 1, counterClockwise: -1 });

export const UNO_MODES = Object.freeze({
  classic: Object.freeze({
    value: 'classic',
    label: '클래식',
    description: '공식에 가까운 기본 덱과 기본 규칙',
    rules: Object.freeze({
      stacking: false,
      anythingStacks: false,
      sevenO: false,
      wildDraw4Challenge: true,
      drawToMatch: false,
      forcePlay: false,
      noMercy: false,
      eliminationHandLimit: null
    })
  }),
  house: Object.freeze({
    value: 'house',
    label: '기본',
    description: '스태킹과 세븐-O가 기본 적용되는 하우스 룰',
    rules: Object.freeze({
      stacking: true,
      anythingStacks: false,
      sevenO: true,
      wildDraw4Challenge: true,
      drawToMatch: false,
      forcePlay: false,
      noMercy: false,
      eliminationHandLimit: null
    })
  }),
  noMercy: Object.freeze({
    value: 'no_mercy',
    label: "UNO Show'em No Mercy",
    description: '스태킹·드로우 투 매치·강제 플레이·세븐-O·25장 탈락을 적용하는 무자비 모드',
    rules: Object.freeze({
      stacking: true,
      anythingStacks: false,
      sevenO: true,
      wildDraw4Challenge: false,
      drawToMatch: true,
      forcePlay: true,
      noMercy: true,
      eliminationHandLimit: 25
    })
  })
});

const DEFAULT_HAND_SIZE = 7;
const DEFAULT_MAX_PLAYERS = 10;
const MIN_PLAYERS = 2;
const DRAW_CARD_ORDER = Object.freeze({
  draw2: 2,
  wildDraw4: 4,
  wildReverseDraw4: 4,
  wildDraw6: 6,
  wildDraw10: 10
});
const DRAW_CARD_STACK_RANK = Object.freeze({
  draw2: 2,
  wildDraw4: 4,
  wildReverseDraw4: 4,
  wildDraw6: 6,
  wildDraw10: 10
});
const WILD_TYPES = new Set([
  'wild',
  'wildDraw4',
  'wildReverseDraw4',
  'wildDraw6',
  'wildDraw10',
  'wildColorRoulette'
]);
const ACTION_LABELS = Object.freeze({
  skip: '스킵',
  reverse: '리버스',
  draw2: '+2',
  wild: '와일드',
  wildDraw4: '와일드 +4',
  wildReverseDraw4: '와일드 리버스 +4',
  wildDraw6: '와일드 +6',
  wildDraw10: '와일드 +10',
  wildColorRoulette: '와일드 컬러 룰렛',
  skipAll: '모두 스킵',
  discardAll: '모두 버리기'
});
const COLOR_LABELS = Object.freeze({
  red: '빨강',
  yellow: '노랑',
  green: '초록',
  blue: '파랑'
});
const COLOR_EMOJIS = Object.freeze({
  red: '🟥',
  yellow: '🟨',
  green: '🟩',
  blue: '🟦'
});

let nextUnoGameSequence = 1;

export class UnoGameManager {
  constructor({ randomInt = defaultRandomInt, now = () => Date.now() } = {}) {
    this.randomInt = randomInt;
    this.now = now;
    this.gamesByChannel = new Map();
  }

  createLobby({ guildId, channelId, host, mode = 'house', rules = {} }) {
    const key = createChannelKey(guildId, channelId);
    const existing = this.gamesByChannel.get(key);
    if (existing && existing.status !== 'complete') {
      throw new Error('이 채널에서 이미 우노 모집 또는 게임이 진행 중입니다.');
    }

    const normalizedMode = normalizeUnoMode(mode);
    const lobby = {
      id: createUnoGameId(this.now()),
      guildId: normalizeId(guildId, 'guildId'),
      channelId: normalizeId(channelId, 'channelId'),
      status: 'lobby',
      mode: normalizedMode,
      rules: normalizeUnoRules(rules, normalizedMode),
      players: [normalizeUnoPlayer(host)],
      hostUserId: normalizeUnoPlayer(host).userId,
      createdAt: this.now()
    };

    this.gamesByChannel.set(key, lobby);
    return cloneUnoPublicState(lobby);
  }

  joinLobby({ guildId, channelId, user }) {
    const game = this.#requireGame(guildId, channelId);
    if (game.status !== 'lobby') {
      throw new Error('이미 시작한 우노 게임에는 참가할 수 없습니다.');
    }

    const player = normalizeUnoPlayer(user);
    if (game.players.some((entry) => entry.userId === player.userId)) {
      throw new Error('이미 우노 모집에 참가했습니다.');
    }
    if (game.players.length >= DEFAULT_MAX_PLAYERS) {
      throw new Error(`우노는 최대 ${DEFAULT_MAX_PLAYERS}명까지 참가할 수 있습니다.`);
    }

    game.players.push(player);
    return cloneUnoPublicState(game);
  }

  startGame({ guildId, channelId, userId }) {
    const game = this.#requireGame(guildId, channelId);
    if (game.status !== 'lobby') {
      throw new Error('이미 시작했거나 종료된 우노 게임입니다.');
    }
    if (game.hostUserId !== String(userId)) {
      throw new Error('방장만 우노 게임을 시작할 수 있습니다.');
    }
    if (game.players.length < MIN_PLAYERS) {
      throw new Error(`우노는 ${MIN_PLAYERS}명 이상이어야 시작할 수 있습니다.`);
    }

    const playing = createUnoGame({
      id: game.id,
      guildId: game.guildId,
      channelId: game.channelId,
      players: game.players,
      mode: game.mode,
      rules: game.rules,
      randomInt: this.randomInt,
      now: this.now()
    });
    playing.hostUserId = game.hostUserId;
    playing.createdAt = game.createdAt;
    this.gamesByChannel.set(createChannelKey(guildId, channelId), playing);
    return cloneUnoPublicState(playing);
  }

  getGame({ guildId, channelId }) {
    const game = this.gamesByChannel.get(createChannelKey(guildId, channelId));
    return game ? cloneUnoPublicState(game) : null;
  }

  getPlayerHand({ guildId, channelId, userId }) {
    const game = this.#requireGame(guildId, channelId);
    if (game.status !== 'playing') {
      throw new Error('진행 중인 우노 게임이 없습니다.');
    }
    assertKnownPlayer(game, userId);
    return {
      game: cloneUnoPublicState(game),
      hand: cloneCards(game.hands[String(userId)] ?? [])
    };
  }

  playCard({ guildId, channelId, userId, cardNumber, chosenColor = null, targetUserId = null }) {
    const game = this.#requireGame(guildId, channelId);
    const result = playUnoCard(game, {
      userId,
      cardIndex: normalizeCardNumber(cardNumber) - 1,
      chosenColor,
      targetUserId
    });
    return {
      ...result,
      game: cloneUnoPublicState(game)
    };
  }

  draw({ guildId, channelId, userId }) {
    const game = this.#requireGame(guildId, channelId);
    const result = drawUnoCards(game, { userId });
    return {
      ...result,
      game: cloneUnoPublicState(game)
    };
  }

  challengeWildDraw4({ guildId, channelId, userId }) {
    const game = this.#requireGame(guildId, channelId);
    const result = challengeUnoWildDraw4(game, { userId });
    return {
      ...result,
      game: cloneUnoPublicState(game)
    };
  }

  endGame({ guildId, channelId, userId }) {
    const game = this.#requireGame(guildId, channelId);
    if (game.hostUserId !== String(userId)) {
      throw new Error('방장만 우노 게임을 종료할 수 있습니다.');
    }
    game.status = 'complete';
    game.winner = null;
    game.completedReason = 'cancelled';
    this.gamesByChannel.delete(createChannelKey(guildId, channelId));
    return cloneUnoPublicState(game);
  }

  reset() {
    this.gamesByChannel.clear();
  }

  #requireGame(guildId, channelId) {
    const game = this.gamesByChannel.get(createChannelKey(guildId, channelId));
    if (!game) throw new Error('이 채널에는 우노 게임이 없습니다.');
    return game;
  }
}

export function createUnoGame({
  id = createUnoGameId(Date.now()),
  guildId = 'guild',
  channelId = 'channel',
  players,
  mode = 'house',
  rules = {},
  hands = null,
  drawPile = null,
  discardPile = null,
  activeColor = null,
  direction = UNO_DIRECTIONS.clockwise,
  turnIndex = 0,
  randomInt = defaultRandomInt,
  now = Date.now()
}) {
  const normalizedPlayers = normalizeUnoPlayers(players);
  if (normalizedPlayers.length < MIN_PLAYERS) {
    throw new Error(`우노는 ${MIN_PLAYERS}명 이상이어야 합니다.`);
  }

  const normalizedMode = normalizeUnoMode(mode);
  const normalizedRules = normalizeUnoRules(rules, normalizedMode);
  let normalizedHands = hands ? normalizeHands(hands, normalizedPlayers) : null;
  let normalizedDrawPile = drawPile ? cloneCards(drawPile) : null;
  let normalizedDiscardPile = discardPile ? cloneCards(discardPile) : null;

  if (!normalizedHands || !normalizedDrawPile || !normalizedDiscardPile) {
    const deck = shuffleCards(buildUnoDeck(normalizedMode), randomInt);
    normalizedHands = {};
    for (const player of normalizedPlayers) {
      normalizedHands[player.userId] = deck.splice(0, DEFAULT_HAND_SIZE);
    }
    normalizedDiscardPile = [drawStartingDiscard(deck)];
    normalizedDrawPile = deck;
  }

  const topCard = normalizedDiscardPile.at(-1);
  if (!topCard) throw new Error('우노 시작 카드가 필요합니다.');

  const game = {
    id,
    guildId: normalizeId(guildId, 'guildId'),
    channelId: normalizeId(channelId, 'channelId'),
    status: 'playing',
    mode: normalizedMode,
    rules: normalizedRules,
    players: normalizedPlayers,
    hands: normalizedHands,
    drawPile: normalizedDrawPile,
    discardPile: normalizedDiscardPile,
    activeColor: normalizeUnoColor(activeColor ?? topCard.color ?? 'red'),
    direction: direction === UNO_DIRECTIONS.counterClockwise
      ? UNO_DIRECTIONS.counterClockwise
      : UNO_DIRECTIONS.clockwise,
    turnIndex: clampTurnIndex(turnIndex, normalizedPlayers),
    pendingDraw: null,
    pendingChallenge: null,
    winner: null,
    completedReason: null,
    log: [],
    createdAt: now,
    updatedAt: now
  };

  checkNoMercyEliminations(game);
  return game;
}

export function playUnoCard(game, {
  userId,
  cardIndex,
  chosenColor = null,
  targetUserId = null,
  force = false
}) {
  assertPlayingGame(game);
  const normalizedUserId = String(userId);
  const currentPlayer = getCurrentPlayer(game);
  if (!currentPlayer || currentPlayer.userId !== normalizedUserId) {
    return rejectUnoAction('not_turn', '지금은 내 차례가 아닙니다.');
  }

  const hand = game.hands[normalizedUserId] ?? [];
  const index = normalizeCardIndex(cardIndex, hand.length);
  if (index < 0) {
    return rejectUnoAction('invalid_card', '낼 카드 번호가 올바르지 않습니다.');
  }

  const card = hand[index];
  const previousActiveColor = game.activeColor;
  const topCard = getTopDiscard(game);
  const playable = canPlayUnoCard(game, card, { userId: normalizedUserId });
  if (!playable.ok && !force) {
    return rejectUnoAction(playable.code, playable.reason);
  }

  const wildChosenColor = requiresChosenColor(card)
    ? normalizeOptionalUnoColor(chosenColor)
    : null;
  if (requiresChosenColor(card) && !wildChosenColor) {
    return rejectUnoAction('missing_color', '와일드 계열 카드는 바꿀 색을 함께 지정해야 합니다.');
  }

  const sevenTargetUserId = resolveSevenOTarget(game, {
    card,
    userId: normalizedUserId,
    targetUserId
  });
  if (sevenTargetUserId instanceof Error) {
    return rejectUnoAction('missing_target', sevenTargetUserId.message);
  }

  const hadPlayableColorBeforeWildDraw4 = card.type === 'wildDraw4'
    ? hasPlayableColorCard(hand.filter((_, handIndex) => handIndex !== index), previousActiveColor)
    : false;
  const existingPendingDraw = game.pendingDraw ? { ...game.pendingDraw } : null;
  const events = [];

  hand.splice(index, 1);
  game.discardPile.push(card);
  game.activeColor = card.color ?? wildChosenColor ?? game.activeColor;
  game.pendingChallenge = null;
  events.push(`${currentPlayer.username}님이 ${formatUnoCard(card)} 카드를 냈습니다.`);

  if (card.type === 'discardAll') {
    const discarded = discardAllColorCards(game, normalizedUserId, game.activeColor);
    if (discarded.length > 0) {
      events.push(`${formatUnoColor(game.activeColor)} 모두 버리기로 ${discarded.length}장을 추가로 버렸습니다.`);
    }
  }

  if (game.rules.sevenO && card.type === 'number' && card.rank === 0) {
    rotateHands(game, game.direction);
    events.push('세븐-O 0 효과: 모든 사람이 진행 방향으로 손패를 넘겼습니다.');
  }

  if (game.rules.sevenO && card.type === 'number' && card.rank === 7) {
    swapHands(game, normalizedUserId, sevenTargetUserId);
    const target = getPlayer(game, sevenTargetUserId);
    events.push(`세븐-O 7 효과: ${currentPlayer.username}님과 ${target.username}님의 손패를 교환했습니다.`);
  }

  if (card.type === 'reverse' || card.type === 'wildReverseDraw4') {
    game.direction *= -1;
    events.push(`진행 방향이 ${formatUnoDirection(game.direction)}(으)로 바뀌었습니다.`);
  }

  const completion = checkUnoCompletion(game, events);
  if (completion.completed) {
    game.updatedAt = Date.now();
    return acceptUnoAction(events, game);
  }

  const drawValue = getDrawCardValue(card);
  if (drawValue > 0) {
    applyDrawCardEffect(game, {
      card,
      amount: drawValue,
      stackRank: getDrawCardStackRank(card),
      existingPendingDraw,
      sourceUserId: normalizedUserId,
      previousActiveColor,
      hadPlayableColorBeforeWildDraw4,
      events
    });
    game.updatedAt = Date.now();
    return acceptUnoAction(events, game);
  }

  if (card.type === 'wildColorRoulette') {
    applyWildColorRoulette(game, normalizedUserId, events);
    game.updatedAt = Date.now();
    return acceptUnoAction(events, game);
  }

  if (card.type === 'skip') {
    const skipped = advanceTurnBySkipping(game, normalizedUserId, 1);
    if (skipped) events.push(`${skipped.username}님을 건너뜁니다.`);
  } else if (card.type === 'skipAll') {
    events.push('모두 스킵 효과: 낸 사람이 한 번 더 진행합니다.');
    game.turnIndex = getPlayerIndex(game, normalizedUserId);
  } else if (card.type === 'reverse' && getActivePlayers(game).length === 2) {
    const skipped = advanceTurnBySkipping(game, normalizedUserId, 1);
    if (skipped) events.push('2인 리버스는 스킵처럼 처리되어 한 번 더 진행합니다.');
  } else {
    advanceTurn(game, 1);
  }

  checkUnoCompletion(game, events);
  game.updatedAt = Date.now();
  return acceptUnoAction(events, game);
}

export function drawUnoCards(game, { userId }) {
  assertPlayingGame(game);
  const normalizedUserId = String(userId);
  const currentPlayer = getCurrentPlayer(game);
  if (!currentPlayer || currentPlayer.userId !== normalizedUserId) {
    return rejectUnoAction('not_turn', '지금은 내 차례가 아닙니다.');
  }

  const events = [];
  if (game.pendingDraw) {
    const amount = game.pendingDraw.amount;
    const drawn = drawCardsIntoHand(game, normalizedUserId, amount);
    events.push(`${currentPlayer.username}님이 누적 드로우 ${amount}장을 받았습니다.`);
    if (drawn.length < amount) {
      events.push(`더미가 부족해 ${drawn.length}장만 뽑았습니다.`);
    }
    game.pendingDraw = null;
    game.pendingChallenge = null;
    checkNoMercyEliminations(game, events);
    if (!checkUnoCompletion(game, events).completed) advanceTurn(game, 1);
    game.updatedAt = Date.now();
    return acceptUnoAction(events, game, { drawn });
  }

  if (game.rules.drawToMatch) {
    const drawn = drawUntilMatch(game, normalizedUserId);
    events.push(`${currentPlayer.username}님이 낼 수 있는 카드가 나올 때까지 ${drawn.length}장을 뽑았습니다.`);
    checkNoMercyEliminations(game, events);
    if (game.status === 'complete') {
      game.updatedAt = Date.now();
      return acceptUnoAction(events, game, { drawn });
    }

    const playableIndex = findFirstPlayableCardIndex(game, normalizedUserId);
    if (game.rules.forcePlay && playableIndex >= 0) {
      const forcedCard = game.hands[normalizedUserId][playableIndex];
      const forced = playUnoCard(game, {
        userId: normalizedUserId,
        cardIndex: playableIndex,
        chosenColor: chooseBestColor(game.hands[normalizedUserId]),
        targetUserId: chooseDefaultTarget(game, normalizedUserId),
        force: true
      });
      return acceptUnoAction([
        ...events,
        `강제 플레이: ${formatUnoCard(forcedCard)} 카드를 즉시 냅니다.`,
        ...forced.events
      ], game, { drawn, forced: true });
    }

    if (!checkUnoCompletion(game, events).completed) advanceTurn(game, 1);
    game.updatedAt = Date.now();
    return acceptUnoAction(events, game, { drawn });
  }

  const drawn = drawCardsIntoHand(game, normalizedUserId, 1);
  events.push(`${currentPlayer.username}님이 카드 ${drawn.length}장을 뽑고 차례를 넘겼습니다.`);
  checkNoMercyEliminations(game, events);
  if (!checkUnoCompletion(game, events).completed) advanceTurn(game, 1);
  game.updatedAt = Date.now();
  return acceptUnoAction(events, game, { drawn });
}

export function challengeUnoWildDraw4(game, { userId }) {
  assertPlayingGame(game);
  const normalizedUserId = String(userId);
  const challenge = game.pendingChallenge;
  if (!challenge || challenge.challengerUserId !== normalizedUserId) {
    return rejectUnoAction('no_challenge', '지금 도전할 수 있는 와일드 드로우 4가 없습니다.');
  }

  const challenger = getPlayer(game, challenge.challengerUserId);
  const challenged = getPlayer(game, challenge.sourceUserId);
  const events = [`${challenger.username}님이 와일드 드로우 4에 도전했습니다.`];

  if (challenge.hadPlayableColor) {
    drawCardsIntoHand(game, challenged.userId, 4);
    events.push(`도전 성공! ${challenged.username}님이 이전 색 ${formatUnoColor(challenge.previousActiveColor)} 카드를 낼 수 있었으므로 4장을 받습니다.`);
    game.pendingDraw = null;
    game.pendingChallenge = null;
    game.turnIndex = getPlayerIndex(game, challenger.userId);
  } else {
    const penalty = (game.pendingDraw?.amount ?? 4) + 2;
    drawCardsIntoHand(game, challenger.userId, penalty);
    events.push(`도전 실패! ${challenger.username}님이 벌칙 ${penalty}장을 받습니다.`);
    game.pendingDraw = null;
    game.pendingChallenge = null;
    checkNoMercyEliminations(game, events);
    if (!checkUnoCompletion(game, events).completed) advanceTurn(game, 1);
  }

  checkNoMercyEliminations(game, events);
  checkUnoCompletion(game, events);
  game.updatedAt = Date.now();
  return acceptUnoAction(events, game);
}

export function canPlayUnoCard(game, card, { userId = null } = {}) {
  if (!card) return { ok: false, code: 'invalid_card', reason: '카드를 찾을 수 없습니다.' };

  if (game.pendingDraw) {
    if (!game.rules.stacking && !game.rules.anythingStacks) {
      return {
        ok: false,
        code: 'pending_draw',
        reason: '드로우 공격을 먼저 받아야 합니다.'
      };
    }

    const drawValue = getDrawCardValue(card);
    if (drawValue <= 0) {
      return {
        ok: false,
        code: 'pending_draw_stack_only',
        reason: `누적 드로우 ${game.pendingDraw.amount}장을 받거나 동급/상위 드로우 카드로 중첩해야 합니다.`
      };
    }

    if (!game.rules.anythingStacks && getDrawCardStackRank(card) < game.pendingDraw.lastStackRank) {
      return {
        ok: false,
        code: 'lower_stack_card',
        reason: '현재 누적보다 낮은 드로우 카드는 중첩할 수 없습니다.'
      };
    }

    return { ok: true };
  }

  const topCard = getTopDiscard(game);
  if (WILD_TYPES.has(card.type)) return { ok: true };
  if (card.color && card.color === game.activeColor) return { ok: true };
  if (card.type === 'number' && topCard.type === 'number' && card.rank === topCard.rank) return { ok: true };
  if (card.type !== 'number' && card.type === topCard.type) return { ok: true };

  return {
    ok: false,
    code: 'not_playable',
    reason: `${formatUnoCard(card)} 카드는 현재 색/숫자/기호와 맞지 않습니다.`
  };
}

export function buildUnoDeck(mode = 'house') {
  const normalizedMode = normalizeUnoMode(mode);
  const cards = [];
  let sequence = 1;
  const pushCard = (card, count = 1) => {
    for (let copy = 0; copy < count; copy += 1) {
      cards.push({
        id: `uno-${normalizedMode}-${sequence++}`,
        ...card
      });
    }
  };

  for (const color of UNO_COLORS) {
    pushCard({ type: 'number', color, rank: 0 });
    for (let rank = 1; rank <= 9; rank += 1) {
      pushCard({ type: 'number', color, rank }, 2);
    }
    pushCard({ type: 'skip', color }, 2);
    pushCard({ type: 'reverse', color }, 2);
    pushCard({ type: 'draw2', color }, 2);

    if (normalizedMode === 'no_mercy') {
      pushCard({ type: 'skipAll', color }, 2);
      pushCard({ type: 'discardAll', color }, 2);
    }
  }

  if (normalizedMode !== 'no_mercy') {
    pushCard({ type: 'wild' }, 4);
  }

  pushCard({ type: 'wildDraw4' }, 4);

  if (normalizedMode === 'no_mercy') {
    pushCard({ type: 'wildReverseDraw4' }, 4);
    pushCard({ type: 'wildDraw6' }, 4);
    pushCard({ type: 'wildDraw10' }, 4);
    pushCard({ type: 'wildColorRoulette' }, 4);
  }

  return cards;
}

export function normalizeUnoRules(overrides = {}, mode = 'house') {
  const normalizedMode = normalizeUnoMode(mode);
  const preset = Object.values(UNO_MODES).find((entry) => entry.value === normalizedMode) ?? UNO_MODES.house;
  const rules = {
    ...preset.rules,
    ...overrides
  };

  rules.stacking = Boolean(rules.stacking);
  rules.anythingStacks = Boolean(rules.anythingStacks);
  if (rules.anythingStacks) rules.stacking = false;
  rules.sevenO = Boolean(rules.sevenO);
  rules.wildDraw4Challenge = Boolean(rules.wildDraw4Challenge);
  rules.drawToMatch = Boolean(rules.drawToMatch);
  rules.forcePlay = Boolean(rules.forcePlay);
  rules.noMercy = Boolean(rules.noMercy || normalizedMode === 'no_mercy');
  rules.eliminationHandLimit = Number.isSafeInteger(rules.eliminationHandLimit) && rules.eliminationHandLimit > 0
    ? rules.eliminationHandLimit
    : null;

  return rules;
}

export function normalizeUnoMode(mode) {
  const value = String(mode ?? 'house').trim();
  if (value === 'noMercy') return 'no_mercy';
  if (Object.values(UNO_MODES).some((entry) => entry.value === value)) return value;
  return 'house';
}

export function formatUnoCard(card) {
  if (!card) return '알 수 없는 카드';
  if (card.type === 'number') {
    return `${COLOR_EMOJIS[card.color] ?? ''}${formatUnoColor(card.color)} ${card.rank}`;
  }
  if (card.color) {
    return `${COLOR_EMOJIS[card.color] ?? ''}${formatUnoColor(card.color)} ${ACTION_LABELS[card.type] ?? card.type}`;
  }
  return `🌈 ${ACTION_LABELS[card.type] ?? card.type}`;
}

export function formatUnoColor(color) {
  return COLOR_LABELS[color] ?? String(color ?? '없음');
}

export function formatUnoDirection(direction) {
  return direction === UNO_DIRECTIONS.counterClockwise ? '반시계' : '시계';
}

export function cloneUnoPublicState(game) {
  const players = game.players.map((player) => ({
    ...player,
    cardCount: Array.isArray(game.hands?.[player.userId]) ? game.hands[player.userId].length : 0
  }));

  return {
    id: game.id,
    guildId: game.guildId,
    channelId: game.channelId,
    status: game.status,
    mode: game.mode,
    rules: { ...game.rules },
    players,
    hostUserId: game.hostUserId ?? game.players[0]?.userId ?? null,
    activeColor: game.activeColor,
    direction: game.direction,
    turnIndex: game.turnIndex,
    currentPlayer: game.status === 'playing' ? clonePlayer(getCurrentPlayer(game)) : null,
    topCard: cloneCard(getTopDiscard(game)),
    pendingDraw: game.pendingDraw ? { ...game.pendingDraw } : null,
    pendingChallenge: game.pendingChallenge ? { ...game.pendingChallenge } : null,
    winner: clonePlayer(game.winner),
    completedReason: game.completedReason ?? null,
    log: [...(game.log ?? [])]
  };
}

function applyDrawCardEffect(game, {
  card,
  amount,
  stackRank,
  existingPendingDraw,
  sourceUserId,
  previousActiveColor,
  hadPlayableColorBeforeWildDraw4,
  events
}) {
  const targetIndex = findNextActiveIndex(game, getPlayerIndex(game, sourceUserId), 1);
  const target = game.players[targetIndex];
  const totalAmount = (existingPendingDraw?.amount ?? 0) + amount;

  if (game.rules.stacking || game.rules.anythingStacks) {
    game.pendingDraw = {
      amount: totalAmount,
      lastValue: amount,
      lastStackRank: stackRank,
      sourceUserId,
      targetUserId: target.userId,
      topDrawCardType: card.type
    };
    game.turnIndex = targetIndex;
    events.push(`${target.username}님은 ${totalAmount}장을 받거나 동급/상위 드로우 카드 1장으로 중첩할 수 있습니다.`);

    if (card.type === 'wildDraw4' && game.rules.wildDraw4Challenge) {
      game.pendingChallenge = {
        challengerUserId: target.userId,
        sourceUserId,
        previousActiveColor,
        hadPlayableColor: hadPlayableColorBeforeWildDraw4
      };
      events.push(`${target.username}님은 와일드 드로우 4 도전을 선택할 수 있습니다.`);
    }
    return;
  }

  const drawn = drawCardsIntoHand(game, target.userId, amount);
  events.push(`${target.username}님이 ${drawn.length}장을 받고 차례를 잃었습니다.`);
  checkNoMercyEliminations(game, events);
  if (!checkUnoCompletion(game, events).completed) {
    game.turnIndex = findNextActiveIndex(game, targetIndex, 1);
  }
}

function applyWildColorRoulette(game, sourceUserId, events) {
  const targetIndex = findNextActiveIndex(game, getPlayerIndex(game, sourceUserId), 1);
  const target = game.players[targetIndex];
  const drawn = [];

  while (game.drawPile.length > 0 || game.discardPile.length > 1) {
    const [card] = drawCardsIntoHand(game, target.userId, 1);
    if (!card) break;
    drawn.push(card);
    if (card.color === game.activeColor) break;
  }

  events.push(`${target.username}님이 ${formatUnoColor(game.activeColor)} 카드가 나올 때까지 ${drawn.length}장을 뽑고 차례를 잃었습니다.`);
  checkNoMercyEliminations(game, events);
  if (!checkUnoCompletion(game, events).completed) {
    game.turnIndex = findNextActiveIndex(game, targetIndex, 1);
  }
}

function rotateHands(game, direction) {
  const activePlayers = getActivePlayers(game);
  if (activePlayers.length <= 1) return;
  const snapshot = new Map(activePlayers.map((player) => [player.userId, game.hands[player.userId] ?? []]));

  for (let index = 0; index < activePlayers.length; index += 1) {
    const from = activePlayers[index];
    const to = activePlayers[(index + direction + activePlayers.length) % activePlayers.length];
    game.hands[to.userId] = snapshot.get(from.userId) ?? [];
  }
}

function swapHands(game, userId, targetUserId) {
  const first = String(userId);
  const second = String(targetUserId);
  const firstHand = game.hands[first] ?? [];
  game.hands[first] = game.hands[second] ?? [];
  game.hands[second] = firstHand;
}

function discardAllColorCards(game, userId, color) {
  const hand = game.hands[userId] ?? [];
  const discarded = [];
  for (let index = hand.length - 1; index >= 0; index -= 1) {
    if (hand[index].color === color) {
      const [card] = hand.splice(index, 1);
      discarded.unshift(card);
    }
  }
  game.discardPile.push(...discarded);
  return discarded;
}

function advanceTurnBySkipping(game, sourceUserId, skipCount) {
  const sourceIndex = getPlayerIndex(game, sourceUserId);
  const skippedIndex = findNextActiveIndex(game, sourceIndex, 1);
  const skipped = game.players[skippedIndex];
  game.turnIndex = findNextActiveIndex(game, skippedIndex, skipCount);
  return skipped;
}

function advanceTurn(game, steps = 1) {
  game.turnIndex = findNextActiveIndex(game, game.turnIndex, steps);
}

function findNextActiveIndex(game, fromIndex, steps = 1) {
  const activeCount = getActivePlayers(game).length;
  if (activeCount <= 0) return 0;

  let index = fromIndex;
  let moved = 0;
  while (moved < steps) {
    index = (index + game.direction + game.players.length) % game.players.length;
    if (!game.players[index].eliminated) moved += 1;
  }
  return index;
}

function checkUnoCompletion(game, events = []) {
  checkNoMercyEliminations(game, events);
  const activePlayers = getActivePlayers(game);
  if (activePlayers.length <= 1) {
    game.status = 'complete';
    game.winner = activePlayers[0] ?? null;
    game.completedReason = activePlayers.length === 1 ? 'last_player' : 'no_players';
    if (game.winner) events.push(`${game.winner.username}님이 마지막 생존자로 승리했습니다!`);
    return { completed: true };
  }

  const emptyHandWinner = activePlayers.find((player) => (game.hands[player.userId] ?? []).length === 0);
  if (emptyHandWinner) {
    game.status = 'complete';
    game.winner = emptyHandWinner;
    game.completedReason = 'empty_hand';
    events.push(`${emptyHandWinner.username}님이 모든 카드를 내고 승리했습니다!`);
    return { completed: true };
  }

  return { completed: false };
}

function checkNoMercyEliminations(game, events = []) {
  const limit = game.rules.eliminationHandLimit;
  if (!limit) return;

  for (const player of game.players) {
    if (player.eliminated) continue;
    const count = game.hands[player.userId]?.length ?? 0;
    if (count > limit) {
      player.eliminated = true;
      events.push(`${player.username}님은 손패가 ${limit}장을 넘어 탈락했습니다.`);
      if (game.pendingDraw?.targetUserId === player.userId) game.pendingDraw = null;
      if (game.pendingChallenge?.challengerUserId === player.userId) game.pendingChallenge = null;
    }
  }

  if (game.players[game.turnIndex]?.eliminated) {
    const active = getActivePlayers(game);
    game.turnIndex = active.length > 0 ? getPlayerIndex(game, active[0].userId) : 0;
  }
}

function drawUntilMatch(game, userId) {
  const drawn = [];
  let guard = 0;
  while (guard < 200) {
    guard += 1;
    const playableIndex = findFirstPlayableCardIndex(game, userId);
    if (playableIndex >= 0 && drawn.length > 0) break;
    const [card] = drawCardsIntoHand(game, userId, 1);
    if (!card) break;
    drawn.push(card);
    if (canPlayUnoCard(game, card, { userId }).ok) break;
  }
  return drawn;
}

function findFirstPlayableCardIndex(game, userId) {
  const hand = game.hands[userId] ?? [];
  return hand.findIndex((card) => canPlayUnoCard(game, card, { userId }).ok);
}

function drawCardsIntoHand(game, userId, amount) {
  const hand = game.hands[userId] ?? [];
  game.hands[userId] = hand;
  const drawn = [];

  for (let count = 0; count < amount; count += 1) {
    ensureDrawPile(game);
    const card = game.drawPile.shift();
    if (!card) break;
    hand.push(card);
    drawn.push(card);
  }

  return drawn;
}

function ensureDrawPile(game) {
  if (game.drawPile.length > 0 || game.discardPile.length <= 1) return;
  const top = game.discardPile.pop();
  game.drawPile = game.discardPile.splice(0);
  game.discardPile = [top];
}

function drawStartingDiscard(deck) {
  const index = deck.findIndex((card) => card.color && getDrawCardValue(card) === 0);
  if (index >= 0) {
    const [card] = deck.splice(index, 1);
    return card;
  }
  return deck.shift();
}

function resolveSevenOTarget(game, { card, userId, targetUserId }) {
  if (!game.rules.sevenO || card.type !== 'number' || card.rank !== 7) return null;
  const activePlayers = getActivePlayers(game).filter((player) => player.userId !== userId);
  if (activePlayers.length === 0) return null;
  if (activePlayers.length === 1) return activePlayers[0].userId;
  if (!targetUserId) return new Error('7 카드는 손패를 바꿀 대상을 지정해야 합니다.');
  const target = activePlayers.find((player) => player.userId === String(targetUserId));
  if (!target) return new Error('손패를 바꿀 대상은 현재 우노 참가자여야 합니다.');
  return target.userId;
}

function chooseBestColor(hand) {
  const counts = Object.fromEntries(UNO_COLORS.map((color) => [color, 0]));
  for (const card of hand) {
    if (card.color && counts[card.color] !== undefined) counts[card.color] += 1;
  }
  return UNO_COLORS.reduce((best, color) => counts[color] > counts[best] ? color : best, 'red');
}

function chooseDefaultTarget(game, userId) {
  return getActivePlayers(game).find((player) => player.userId !== String(userId))?.userId ?? null;
}

function hasPlayableColorCard(hand, color) {
  return hand.some((card) => card.color === color);
}

function requiresChosenColor(card) {
  return WILD_TYPES.has(card.type);
}

function getDrawCardValue(card) {
  return DRAW_CARD_ORDER[card?.type] ?? 0;
}

function getDrawCardStackRank(card) {
  return DRAW_CARD_STACK_RANK[card?.type] ?? 0;
}

function getTopDiscard(game) {
  return game.discardPile?.at(-1) ?? null;
}

function getCurrentPlayer(game) {
  if (!game || game.status !== 'playing') return null;
  return game.players[game.turnIndex] ?? null;
}

function getPlayer(game, userId) {
  const player = game.players.find((entry) => entry.userId === String(userId));
  if (!player) throw new Error('우노 참가자가 아닙니다.');
  return player;
}

function assertKnownPlayer(game, userId) {
  getPlayer(game, userId);
}

function getPlayerIndex(game, userId) {
  const index = game.players.findIndex((entry) => entry.userId === String(userId));
  if (index < 0) throw new Error('우노 참가자가 아닙니다.');
  return index;
}

function getActivePlayers(game) {
  return game.players.filter((player) => !player.eliminated);
}

function normalizeUnoPlayers(players) {
  if (!Array.isArray(players)) throw new Error('우노 참가자 목록이 필요합니다.');
  const seen = new Set();
  const normalized = [];
  for (const player of players) {
    const entry = normalizeUnoPlayer(player);
    if (seen.has(entry.userId)) continue;
    seen.add(entry.userId);
    normalized.push(entry);
  }
  return normalized;
}

function normalizeUnoPlayer(player) {
  if (!player?.userId && !player?.id) throw new Error('우노 참가자 ID가 필요합니다.');
  const userId = String(player.userId ?? player.id);
  return {
    userId,
    username: String(player.username ?? player.displayName ?? `User ${userId}`),
    eliminated: Boolean(player.eliminated)
  };
}

function normalizeHands(hands, players) {
  const normalized = {};
  for (const player of players) {
    normalized[player.userId] = cloneCards(hands[player.userId] ?? hands[player.id] ?? []);
  }
  return normalized;
}

function normalizeCardNumber(cardNumber) {
  const number = Number(cardNumber);
  if (!Number.isSafeInteger(number)) return -1;
  return number;
}

function normalizeCardIndex(cardIndex, handLength) {
  const index = Number(cardIndex);
  if (!Number.isSafeInteger(index) || index < 0 || index >= handLength) return -1;
  return index;
}

function clampTurnIndex(turnIndex, players) {
  const index = Number(turnIndex);
  if (!Number.isSafeInteger(index) || index < 0) return 0;
  return Math.min(index, Math.max(0, players.length - 1));
}

function normalizeId(value, label) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(`${label} 값이 필요합니다.`);
  return normalized;
}

function normalizeUnoColor(color) {
  const normalized = normalizeOptionalUnoColor(color);
  if (!normalized) throw new Error('우노 색상이 올바르지 않습니다.');
  return normalized;
}

function normalizeOptionalUnoColor(color) {
  const normalized = String(color ?? '').trim();
  return UNO_COLORS.includes(normalized) ? normalized : null;
}

function createChannelKey(guildId, channelId) {
  return `${normalizeId(guildId, 'guildId')}:${normalizeId(channelId, 'channelId')}`;
}

function createUnoGameId(now) {
  return `uno-${now}-${nextUnoGameSequence++}`;
}

function shuffleCards(cards, randomInt) {
  const shuffled = cloneCards(cards);
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function defaultRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function assertPlayingGame(game) {
  if (!game || game.status !== 'playing') {
    throw new Error('진행 중인 우노 게임이 없습니다.');
  }
}

function acceptUnoAction(events, game, extra = {}) {
  game.log.push(...events);
  if (game.log.length > 20) game.log.splice(0, game.log.length - 20);
  return {
    ok: true,
    events,
    ...extra
  };
}

function rejectUnoAction(code, reason) {
  return {
    ok: false,
    code,
    reason,
    events: []
  };
}

function cloneCards(cards) {
  return cards.map(cloneCard);
}

function cloneCard(card) {
  return card ? { ...card } : null;
}

function clonePlayer(player) {
  return player ? { ...player } : null;
}
