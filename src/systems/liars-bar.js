export const LIARS_BAR_MIN_PLAYERS = 2;
export const LIARS_BAR_MAX_PLAYERS = 4;
export const LIARS_BAR_HAND_SIZE = 5;
export const LIARS_BAR_MAX_PLAY_CARDS = 3;
export const LIARS_BAR_REVOLVER_CHAMBERS = 6;

export const LIARS_BAR_CARD_TYPES = Object.freeze({
  queen: Object.freeze({ value: 'queen', label: '퀸', shortLabel: 'Q', emoji: '👑' }),
  king: Object.freeze({ value: 'king', label: '킹', shortLabel: 'K', emoji: '🤴' }),
  ace: Object.freeze({ value: 'ace', label: '에이스', shortLabel: 'A', emoji: '🂡' }),
  joker: Object.freeze({ value: 'joker', label: '조커', shortLabel: 'JOKER', emoji: '🃏' })
});

export const LIARS_BAR_TABLE_TYPES = Object.freeze([
  LIARS_BAR_CARD_TYPES.queen.value,
  LIARS_BAR_CARD_TYPES.king.value,
  LIARS_BAR_CARD_TYPES.ace.value
]);

let nextLiarsBarGameSequence = 1;

export class LiarsBarGameManager {
  constructor({ randomInt = defaultRandomInt, now = () => Date.now() } = {}) {
    this.randomInt = randomInt;
    this.now = now;
    this.gamesByChannel = new Map();
  }

  createLobby({ guildId, channelId, host }) {
    const key = createChannelKey(guildId, channelId);
    const existing = this.gamesByChannel.get(key);
    if (existing && existing.status !== 'complete') {
      throw new Error('이 채널에서 이미 라이어바 모집 또는 게임이 진행 중입니다.');
    }

    const hostPlayer = normalizeLiarsBarPlayer(host);
    const lobby = {
      id: createLiarsBarGameId(this.now()),
      guildId: normalizeId(guildId, 'guildId'),
      channelId: normalizeId(channelId, 'channelId'),
      status: 'lobby',
      hostUserId: hostPlayer.userId,
      players: [hostPlayer],
      createdAt: this.now(),
      round: 0,
      tableType: null,
      turnIndex: 0,
      hands: {},
      previousPlay: null,
      lastReveal: null,
      winner: null,
      completedReason: null
    };

    this.gamesByChannel.set(key, lobby);
    return cloneLiarsBarPublicState(lobby);
  }

  joinLobby({ guildId, channelId, user }) {
    const game = this.#requireGame(guildId, channelId);
    if (game.status !== 'lobby') {
      throw new Error('이미 시작한 라이어바 게임에는 참가할 수 없습니다.');
    }

    const player = normalizeLiarsBarPlayer(user);
    if (game.players.some((entry) => entry.userId === player.userId)) {
      throw new Error('이미 라이어바 모집에 참가했습니다.');
    }
    if (game.players.length >= LIARS_BAR_MAX_PLAYERS) {
      throw new Error(`라이어바는 최대 ${LIARS_BAR_MAX_PLAYERS}명까지 참가할 수 있습니다.`);
    }

    game.players.push(player);
    return cloneLiarsBarPublicState(game);
  }

  startGame({ guildId, channelId, userId }) {
    const game = this.#requireGame(guildId, channelId);
    if (game.status !== 'lobby') {
      throw new Error('이미 시작했거나 종료된 라이어바 게임입니다.');
    }
    if (game.hostUserId !== String(userId)) {
      throw new Error('방장만 라이어바 게임을 시작할 수 있습니다.');
    }
    if (game.players.length < LIARS_BAR_MIN_PLAYERS) {
      throw new Error(`라이어바는 ${LIARS_BAR_MIN_PLAYERS}명 이상이어야 시작할 수 있습니다.`);
    }

    startLiarsBarGame(game, { randomInt: this.randomInt });
    return cloneLiarsBarPublicState(game);
  }

  getGame({ guildId, channelId }) {
    const game = this.gamesByChannel.get(createChannelKey(guildId, channelId));
    return game ? cloneLiarsBarPublicState(game) : null;
  }

  getPlayerHand({ guildId, channelId, userId }) {
    const game = this.#requireGame(guildId, channelId);
    if (game.status !== 'playing') {
      throw new Error('진행 중인 라이어바 게임이 없습니다.');
    }
    assertKnownActivePlayer(game, userId);

    return {
      game: cloneLiarsBarPublicState(game),
      hand: cloneLiarsBarCards(game.hands[String(userId)] ?? [])
    };
  }

  playCards({ guildId, channelId, userId, cardNumbers }) {
    const game = this.#requireGame(guildId, channelId);
    const result = playLiarsBarCards(game, {
      userId,
      cardNumbers,
      randomInt: this.randomInt
    });
    return {
      ...result,
      game: cloneLiarsBarPublicState(game)
    };
  }

  callLiar({ guildId, channelId, userId }) {
    const game = this.#requireGame(guildId, channelId);
    const result = callLiarsBarLiar(game, {
      userId,
      randomInt: this.randomInt
    });
    return {
      ...result,
      game: cloneLiarsBarPublicState(game)
    };
  }

  endGame({ guildId, channelId, userId }) {
    const game = this.#requireGame(guildId, channelId);
    if (game.hostUserId !== String(userId)) {
      throw new Error('방장만 라이어바 게임을 종료할 수 있습니다.');
    }

    game.status = 'complete';
    game.winner = null;
    game.completedReason = 'cancelled';
    this.gamesByChannel.delete(createChannelKey(guildId, channelId));
    return cloneLiarsBarPublicState(game);
  }

  reset() {
    this.gamesByChannel.clear();
  }

  #requireGame(guildId, channelId) {
    const game = this.gamesByChannel.get(createChannelKey(guildId, channelId));
    if (!game) throw new Error('이 채널에는 라이어바 게임이 없습니다.');
    return game;
  }
}

export function createLiarsBarGame({
  id = createLiarsBarGameId(Date.now()),
  guildId = 'guild',
  channelId = 'channel',
  players,
  hostUserId = null,
  randomInt = defaultRandomInt,
  now = () => Date.now()
}) {
  const normalizedPlayers = normalizeLiarsBarPlayers(players);
  validateLiarsBarPlayerCount(normalizedPlayers.length);

  const game = {
    id,
    guildId: normalizeId(guildId, 'guildId'),
    channelId: normalizeId(channelId, 'channelId'),
    status: 'playing',
    hostUserId: hostUserId ? String(hostUserId) : normalizedPlayers[0].userId,
    players: normalizedPlayers.map((player) => ({
      ...player,
      eliminated: false,
      shotsFired: 0,
      bulletPosition: randomInt(LIARS_BAR_REVOLVER_CHAMBERS) + 1
    })),
    createdAt: now(),
    round: 0,
    tableType: null,
    turnIndex: 0,
    hands: {},
    previousPlay: null,
    lastReveal: null,
    winner: null,
    completedReason: null
  };

  beginLiarsBarRound(game, { randomInt });
  return game;
}

export function startLiarsBarGame(game, { randomInt = defaultRandomInt } = {}) {
  validateLiarsBarPlayerCount(game.players.length);
  game.status = 'playing';
  game.players = game.players.map((player) => ({
    ...player,
    eliminated: false,
    shotsFired: 0,
    bulletPosition: randomInt(LIARS_BAR_REVOLVER_CHAMBERS) + 1
  }));
  game.round = 0;
  game.winner = null;
  game.completedReason = null;
  beginLiarsBarRound(game, { randomInt });
  return game;
}

export function playLiarsBarCards(game, {
  userId,
  cardNumbers,
  randomInt = defaultRandomInt
}) {
  if (game.status !== 'playing') {
    return rejectedLiarsBarAction('not_playing', '진행 중인 라이어바 게임이 아닙니다.');
  }

  const player = assertKnownActivePlayer(game, userId);
  const currentPlayer = getCurrentLiarsBarPlayer(game);
  if (!currentPlayer || currentPlayer.userId !== player.userId) {
    return rejectedLiarsBarAction('not_turn', `현재 차례는 ${currentPlayer ? currentPlayer.username : '없음'}님입니다.`);
  }

  if (mustCurrentPlayerCallLiar(game)) {
    return rejectedLiarsBarAction('must_call', '혼자만 손패가 남았습니다. 카드를 낼 수 없고 `/라이어바 라이어`로 이전 플레이를 의심해야 합니다.');
  }

  let normalizedNumbers;
  try {
    normalizedNumbers = normalizeCardNumbers(cardNumbers);
  } catch (error) {
    return rejectedLiarsBarAction('invalid_card_numbers', error.message);
  }
  if (normalizedNumbers.length < 1 || normalizedNumbers.length > LIARS_BAR_MAX_PLAY_CARDS) {
    return rejectedLiarsBarAction('invalid_count', `한 턴에는 1~${LIARS_BAR_MAX_PLAY_CARDS}장만 낼 수 있습니다.`);
  }

  const hand = game.hands[player.userId] ?? [];
  const invalidNumber = normalizedNumbers.find((number) => number < 1 || number > hand.length);
  if (invalidNumber) {
    return rejectedLiarsBarAction('invalid_card', `카드 번호 ${invalidNumber}번은 현재 손패에 없습니다.`);
  }

  const selectedCards = normalizedNumbers.map((number) => hand[number - 1]);
  for (const number of [...normalizedNumbers].sort((a, b) => b - a)) {
    hand.splice(number - 1, 1);
  }

  game.previousPlay = {
    player: cloneLiarsBarPlayer(player),
    cards: cloneLiarsBarCards(selectedCards),
    claimedType: game.tableType,
    count: selectedCards.length,
    round: game.round
  };
  const submittedPlay = cloneLiarsBarPlay(game.previousPlay);
  game.lastReveal = null;

  const events = [
    `${player.username}님이 카드 ${selectedCards.length}장을 뒤집어 내고 모두 ${formatLiarsBarCardType(game.tableType)}라고 주장했습니다.`
  ];

  if (getPlayersWithCards(game).length === 0) {
    const automaticCaller = getNextActivePlayerAfter(game, player.userId);
    if (automaticCaller) {
      const challenge = resolveLiarsBarChallenge(game, {
        callerId: automaticCaller.userId,
        randomInt,
        automatic: true
      });
      return {
        ok: true,
        code: 'auto_challenge',
        events: [
          ...events,
          '모든 손패가 비어 마지막 플레이가 자동으로 의심 처리됩니다.',
          ...challenge.events
        ],
        play: submittedPlay,
        reveal: challenge.reveal,
        roulette: challenge.roulette
      };
    }
  }

  advanceLiarsBarTurn(game, player.userId);
  return {
    ok: true,
    code: 'played',
    events,
    play: submittedPlay,
    reveal: null,
    roulette: null
  };
}

export function callLiarsBarLiar(game, {
  userId,
  randomInt = defaultRandomInt
}) {
  if (game.status !== 'playing') {
    return rejectedLiarsBarAction('not_playing', '진행 중인 라이어바 게임이 아닙니다.');
  }

  const caller = assertKnownActivePlayer(game, userId);
  const currentPlayer = getCurrentLiarsBarPlayer(game);
  if (!currentPlayer || currentPlayer.userId !== caller.userId) {
    return rejectedLiarsBarAction('not_turn', `현재 차례는 ${currentPlayer ? currentPlayer.username : '없음'}님입니다.`);
  }
  if (!game.previousPlay) {
    return rejectedLiarsBarAction('no_previous_play', '첫 턴에는 의심할 이전 플레이가 없습니다.');
  }

  return resolveLiarsBarChallenge(game, {
    callerId: caller.userId,
    randomInt,
    automatic: false
  });
}

export function buildLiarsBarDeck() {
  const cards = [];
  for (const type of LIARS_BAR_TABLE_TYPES) {
    for (let copy = 1; copy <= 6; copy += 1) {
      cards.push({ id: `${type}-${copy}`, type });
    }
  }
  for (let copy = 1; copy <= 2; copy += 1) {
    cards.push({ id: `joker-${copy}`, type: LIARS_BAR_CARD_TYPES.joker.value });
  }
  return cards;
}

export function isLiarsBarInnocentCard(card, tableType) {
  return card?.type === tableType || card?.type === LIARS_BAR_CARD_TYPES.joker.value;
}

export function formatLiarsBarCardType(type) {
  const definition = LIARS_BAR_CARD_TYPES[type];
  if (!definition) return String(type ?? '알 수 없음');
  return `${definition.emoji} ${definition.label}`;
}

export function formatLiarsBarCard(card) {
  const definition = LIARS_BAR_CARD_TYPES[card?.type];
  if (!definition) return '`?` 알 수 없음';
  return `${definition.emoji} **${definition.shortLabel}**`;
}

export function cloneLiarsBarPublicState(game) {
  const currentPlayer = getCurrentLiarsBarPlayer(game);
  return {
    id: game.id,
    guildId: game.guildId,
    channelId: game.channelId,
    status: game.status,
    hostUserId: game.hostUserId,
    createdAt: game.createdAt,
    round: game.round,
    tableType: game.tableType,
    currentPlayer: currentPlayer ? cloneLiarsBarPlayer(currentPlayer) : null,
    players: game.players.map((player) => ({
      userId: player.userId,
      username: player.username,
      eliminated: Boolean(player.eliminated),
      shotsFired: player.shotsFired ?? 0,
      handCount: game.hands[player.userId]?.length ?? 0
    })),
    previousPlay: cloneLiarsBarPlay(game.previousPlay),
    lastReveal: cloneLiarsBarReveal(game.lastReveal),
    winner: game.winner ? cloneLiarsBarPlayer(game.winner) : null,
    completedReason: game.completedReason ?? null
  };
}

function beginLiarsBarRound(game, {
  randomInt = defaultRandomInt,
  firstPlayerUserId = null
} = {}) {
  const activePlayers = getActiveLiarsBarPlayers(game);
  if (activePlayers.length <= 1) {
    completeLiarsBarGame(game);
    return game;
  }

  game.round += 1;
  game.tableType = LIARS_BAR_TABLE_TYPES[randomInt(LIARS_BAR_TABLE_TYPES.length)];
  game.hands = {};
  game.previousPlay = null;
  game.lastReveal = null;

  const deck = shuffleLiarsBarCards(buildLiarsBarDeck(), randomInt);
  let deckIndex = 0;
  for (const player of activePlayers) {
    game.hands[player.userId] = deck.slice(deckIndex, deckIndex + LIARS_BAR_HAND_SIZE);
    deckIndex += LIARS_BAR_HAND_SIZE;
  }

  const firstPlayer = findFirstActivePlayer(game, firstPlayerUserId)
    ?? activePlayers[randomInt(activePlayers.length)];
  game.turnIndex = game.players.findIndex((player) => player.userId === firstPlayer.userId);
  return game;
}

function resolveLiarsBarChallenge(game, {
  callerId,
  randomInt = defaultRandomInt,
  automatic = false
}) {
  const previousPlay = game.previousPlay;
  if (!previousPlay) {
    return rejectedLiarsBarAction('no_previous_play', '의심할 이전 플레이가 없습니다.');
  }

  const caller = assertKnownActivePlayer(game, callerId);
  const accused = assertKnownPlayer(game, previousPlay.player.userId);
  const revealedCards = cloneLiarsBarCards(previousPlay.cards);
  const hasLiarCard = revealedCards.some((card) => !isLiarsBarInnocentCard(card, game.tableType));
  const penaltyPlayer = hasLiarCard ? accused : caller;
  const roulette = fireLiarsBarRevolver(game, penaltyPlayer.userId);
  const reveal = {
    caller: cloneLiarsBarPlayer(caller),
    accused: cloneLiarsBarPlayer(accused),
    automatic,
    cards: revealedCards,
    tableType: game.tableType,
    hasLiarCard,
    penaltyPlayer: cloneLiarsBarPlayer(penaltyPlayer),
    roulette: { ...roulette }
  };

  game.lastReveal = reveal;
  game.previousPlay = null;

  const events = [
    `${automatic ? '자동 의심' : `${caller.username}님의 LIAR 선언`}! ${accused.username}님의 카드 ${revealedCards.length}장을 공개합니다: ${revealedCards.map(formatLiarsBarCard).join(' ')}`,
    hasLiarCard
      ? `거짓 카드가 섞여 있었습니다. ${accused.username}님이 리볼버 벌칙을 받습니다.`
      : `전부 ${formatLiarsBarCardType(game.tableType)} 또는 조커였습니다. ${caller.username}님이 리볼버 벌칙을 받습니다.`,
    roulette.eliminated
      ? `💥 ${penaltyPlayer.username}님 탈락! (${roulette.shotsFired}/${LIARS_BAR_REVOLVER_CHAMBERS})`
      : `딸깍... ${penaltyPlayer.username}님 생존 (${roulette.shotsFired}/${LIARS_BAR_REVOLVER_CHAMBERS})`
  ];

  if (getActiveLiarsBarPlayers(game).length <= 1) {
    completeLiarsBarGame(game);
    events.push(`🏆 ${game.winner.username}님이 마지막 생존자로 승리했습니다!`);
  } else {
    const nextFirstPlayer = chooseNextRoundFirstPlayer(game, penaltyPlayer.userId);
    beginLiarsBarRound(game, {
      randomInt,
      firstPlayerUserId: nextFirstPlayer?.userId ?? null
    });
    events.push(`새 라운드 ${game.round} 시작! 첫 차례는 ${getCurrentLiarsBarPlayer(game).username}님입니다.`);
  }

  return {
    ok: true,
    code: hasLiarCard ? 'liar_caught' : 'truthful_accused',
    events,
    reveal,
    roulette
  };
}

function fireLiarsBarRevolver(game, userId) {
  const player = assertKnownPlayer(game, userId);
  player.shotsFired = (player.shotsFired ?? 0) + 1;
  const eliminated = player.shotsFired >= player.bulletPosition;
  if (eliminated) {
    player.eliminated = true;
    game.hands[player.userId] = [];
  }

  return {
    player: cloneLiarsBarPlayer(player),
    shotsFired: player.shotsFired,
    chambers: LIARS_BAR_REVOLVER_CHAMBERS,
    eliminated
  };
}

function completeLiarsBarGame(game) {
  const [winner] = getActiveLiarsBarPlayers(game);
  game.status = 'complete';
  game.winner = winner ? cloneLiarsBarPlayer(winner) : null;
  game.currentPlayer = null;
  game.completedReason = winner ? 'winner' : 'draw';
  return game;
}

function advanceLiarsBarTurn(game, fromUserId) {
  const playersWithCards = getPlayersWithCards(game);
  if (playersWithCards.length === 0) return null;
  if (playersWithCards.length === 1 && game.previousPlay) {
    const [onlyPlayer] = playersWithCards;
    game.turnIndex = game.players.findIndex((player) => player.userId === onlyPlayer.userId);
    return onlyPlayer;
  }

  const nextPlayer = getNextPlayerMatching(game, fromUserId, (player) => (
    !player.eliminated && (game.hands[player.userId]?.length ?? 0) > 0
  ));
  if (nextPlayer) {
    game.turnIndex = game.players.findIndex((player) => player.userId === nextPlayer.userId);
  }
  return nextPlayer;
}

function mustCurrentPlayerCallLiar(game) {
  return Boolean(game.previousPlay && getPlayersWithCards(game).length === 1);
}

function chooseNextRoundFirstPlayer(game, penaltyUserId) {
  const penaltyPlayer = game.players.find((player) => player.userId === String(penaltyUserId));
  if (penaltyPlayer && !penaltyPlayer.eliminated) return penaltyPlayer;
  return getNextActivePlayerAfter(game, penaltyUserId);
}

function findFirstActivePlayer(game, userId) {
  if (!userId) return null;
  return getActiveLiarsBarPlayers(game).find((player) => player.userId === String(userId)) ?? null;
}

function getCurrentLiarsBarPlayer(game) {
  if (game.status !== 'playing') return null;
  return game.players[game.turnIndex] && !game.players[game.turnIndex].eliminated
    ? game.players[game.turnIndex]
    : null;
}

function getActiveLiarsBarPlayers(game) {
  return game.players.filter((player) => !player.eliminated);
}

function getPlayersWithCards(game) {
  return getActiveLiarsBarPlayers(game).filter((player) => (game.hands[player.userId]?.length ?? 0) > 0);
}

function getNextActivePlayerAfter(game, userId) {
  return getNextPlayerMatching(game, userId, (player) => !player.eliminated);
}

function getNextPlayerMatching(game, fromUserId, predicate) {
  const startIndex = Math.max(0, game.players.findIndex((player) => player.userId === String(fromUserId)));
  for (let offset = 1; offset <= game.players.length; offset += 1) {
    const candidate = game.players[(startIndex + offset) % game.players.length];
    if (predicate(candidate)) return candidate;
  }
  return null;
}

function assertKnownActivePlayer(game, userId) {
  const player = assertKnownPlayer(game, userId);
  if (player.eliminated) throw new Error('탈락한 플레이어는 행동할 수 없습니다.');
  return player;
}

function assertKnownPlayer(game, userId) {
  const player = game.players.find((entry) => entry.userId === String(userId));
  if (!player) throw new Error('참가자만 라이어바 행동을 할 수 있습니다.');
  return player;
}

function normalizeLiarsBarPlayers(players) {
  if (!Array.isArray(players)) throw new Error('플레이어 목록이 필요합니다.');
  const normalized = players.map(normalizeLiarsBarPlayer);
  const seen = new Set();
  for (const player of normalized) {
    if (seen.has(player.userId)) throw new Error('중복 플레이어는 참가할 수 없습니다.');
    seen.add(player.userId);
  }
  return normalized;
}

function normalizeLiarsBarPlayer(user) {
  if (!user?.id && !user?.userId) throw new Error('플레이어 id가 필요합니다.');
  const userId = String(user.id ?? user.userId);
  const username = String(user.username ?? user.displayName ?? user.globalName ?? userId).trim() || userId;
  return { userId, username };
}

function validateLiarsBarPlayerCount(count) {
  if (count < LIARS_BAR_MIN_PLAYERS || count > LIARS_BAR_MAX_PLAYERS) {
    throw new Error(`라이어바는 ${LIARS_BAR_MIN_PLAYERS}~${LIARS_BAR_MAX_PLAYERS}명으로 플레이할 수 있습니다.`);
  }
}

function normalizeCardNumbers(cardNumbers) {
  const values = (Array.isArray(cardNumbers) ? cardNumbers : [cardNumbers])
    .filter((value) => value !== null && value !== undefined)
    .map((value) => Number(value));

  if (values.some((value) => !Number.isInteger(value))) {
    throw new Error('카드 번호는 정수여야 합니다.');
  }

  const unique = [...new Set(values)];
  if (unique.length !== values.length) {
    throw new Error('같은 카드 번호를 두 번 낼 수 없습니다.');
  }
  return unique;
}

function shuffleLiarsBarCards(cards, randomInt = defaultRandomInt) {
  const shuffled = cloneLiarsBarCards(cards);
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function cloneLiarsBarCards(cards) {
  return (cards ?? []).map((card) => ({ ...card }));
}

function cloneLiarsBarPlay(play) {
  if (!play) return null;
  return {
    player: cloneLiarsBarPlayer(play.player),
    count: play.count,
    claimedType: play.claimedType,
    round: play.round
  };
}

function cloneLiarsBarReveal(reveal) {
  if (!reveal) return null;
  return {
    caller: cloneLiarsBarPlayer(reveal.caller),
    accused: cloneLiarsBarPlayer(reveal.accused),
    automatic: Boolean(reveal.automatic),
    cards: cloneLiarsBarCards(reveal.cards),
    tableType: reveal.tableType,
    hasLiarCard: Boolean(reveal.hasLiarCard),
    penaltyPlayer: cloneLiarsBarPlayer(reveal.penaltyPlayer),
    roulette: reveal.roulette ? { ...reveal.roulette } : null
  };
}

function cloneLiarsBarPlayer(player) {
  if (!player) return null;
  return {
    userId: player.userId,
    username: player.username,
    eliminated: Boolean(player.eliminated),
    shotsFired: player.shotsFired ?? 0
  };
}

function rejectedLiarsBarAction(code, reason) {
  return {
    ok: false,
    code,
    reason,
    events: [],
    reveal: null,
    roulette: null
  };
}

function createLiarsBarGameId(now) {
  const sequence = nextLiarsBarGameSequence;
  nextLiarsBarGameSequence += 1;
  return `lb-${Number(now).toString(36)}-${sequence.toString(36)}`;
}

function createChannelKey(guildId, channelId) {
  return `${normalizeId(guildId, 'guildId')}:${normalizeId(channelId, 'channelId')}`;
}

function normalizeId(value, name) {
  if (value === null || value === undefined || value === '') {
    throw new Error(`${name}가 필요합니다.`);
  }
  return String(value);
}

function defaultRandomInt(maxExclusive) {
  return Math.floor(Math.random() * maxExclusive);
}
