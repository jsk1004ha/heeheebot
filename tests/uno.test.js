import assert from 'node:assert/strict';
import test from 'node:test';
import { MessageFlags } from 'discord.js';
import {
  UnoGameManager,
  buildUnoDeck,
  createUnoGame,
  playUnoCard,
  drawUnoCards,
  normalizeUnoRules
} from '../src/systems/uno.js';
import {
  formatUnoLobbyMessage,
  getUnoCommandPayloads,
  handleUnoCommand
} from '../src/commands/uno.js';

const players = Object.freeze([
  { userId: 'a', username: 'A' },
  { userId: 'b', username: 'B' },
  { userId: 'c', username: 'C' }
]);

test('우노 기본 모드는 스태킹과 Seven-O를 적용한다', () => {
  const rules = normalizeUnoRules({}, 'house');

  assert.equal(rules.stacking, true);
  assert.equal(rules.anythingStacks, false);
  assert.equal(rules.sevenO, true);
  assert.equal(rules.wildDraw4Challenge, true);
});

test('Seven-O 0은 현재 진행 방향으로 모든 손패를 전달한다', () => {
  const game = createTestGame({
    hands: {
      a: [number('red', 0), number('red', 1)],
      b: [number('blue', 2)],
      c: [number('yellow', 3)]
    }
  });

  const result = playUnoCard(game, { userId: 'a', cardIndex: 0 });

  assert.equal(result.ok, true);
  assert.deepEqual(game.hands.a.map(cardKey), ['yellow-3']);
  assert.deepEqual(game.hands.b.map(cardKey), ['red-1']);
  assert.deepEqual(game.hands.c.map(cardKey), ['blue-2']);
  assert.match(result.events.join('\n'), /손패를 넘겼/);
});

test('Seven-O 7은 지정한 대상과 손패를 교환한다', () => {
  const game = createTestGame({
    hands: {
      a: [number('red', 7), number('red', 1)],
      b: [number('blue', 2)],
      c: [number('yellow', 3), number('green', 4)]
    }
  });

  const result = playUnoCard(game, { userId: 'a', cardIndex: 0, targetUserId: 'c' });

  assert.equal(result.ok, true);
  assert.deepEqual(game.hands.a.map(cardKey), ['yellow-3', 'green-4']);
  assert.deepEqual(game.hands.c.map(cardKey), ['red-1']);
  assert.match(result.events.join('\n'), /손패를 교환/);
});

test('스태킹은 색이 달라도 동급/상위 드로우 카드 1장으로 누적한다', () => {
  const game = createTestGame({
    hands: {
      a: [action('red', 'draw2'), number('red', 1)],
      b: [wild('wildDraw4'), number('green', 9)],
      c: [action('blue', 'draw2'), number('yellow', 3)]
    }
  });

  const first = playUnoCard(game, { userId: 'a', cardIndex: 0 });
  assert.equal(first.ok, true);
  assert.equal(game.pendingDraw.amount, 2);
  assert.equal(game.currentPlayer?.userId, undefined);
  assert.equal(game.players[game.turnIndex].userId, 'b');

  const stacked = playUnoCard(game, {
    userId: 'b',
    cardIndex: 0,
    chosenColor: 'blue'
  });
  assert.equal(stacked.ok, true);
  assert.equal(game.pendingDraw.amount, 6);
  assert.equal(game.pendingDraw.targetUserId, 'c');

  const lower = playUnoCard(game, { userId: 'c', cardIndex: 0 });
  assert.equal(lower.ok, false);
  assert.equal(lower.code, 'lower_stack_card');
});

test("No Mercy 모드는 추가 카드와 25장 초과 탈락, 도전 금지를 기본 적용한다", () => {
  const deck = buildUnoDeck('no_mercy');
  const rules = normalizeUnoRules({}, 'no_mercy');

  assert.equal(deck.some((card) => card.type === 'wild'), false);
  assert.equal(deck.some((card) => card.type === 'wildReverseDraw4'), true);
  assert.equal(deck.some((card) => card.type === 'wildDraw6'), true);
  assert.equal(deck.some((card) => card.type === 'wildDraw10'), true);
  assert.equal(deck.some((card) => card.type === 'wildColorRoulette'), true);
  assert.equal(deck.some((card) => card.type === 'skipAll'), true);
  assert.equal(deck.some((card) => card.type === 'discardAll'), true);
  assert.equal(rules.wildDraw4Challenge, false);
  assert.equal(rules.drawToMatch, true);
  assert.equal(rules.forcePlay, true);
  assert.equal(rules.eliminationHandLimit, 25);
});

test('모든 우노 모드는 기본 색 카드와 Wild Draw 4를 포함한다', () => {
  for (const mode of ['classic', 'house', 'no_mercy']) {
    const deck = buildUnoDeck(mode);

    for (const color of ['red', 'yellow', 'green', 'blue']) {
      for (let rank = 0; rank <= 9; rank += 1) {
        assert.ok(
          deck.some((card) => card.type === 'number' && card.color === color && card.rank === rank),
          `${mode} 덱에는 ${color} ${rank} 숫자 카드가 있어야 합니다.`
        );
      }

      for (const type of ['skip', 'reverse', 'draw2']) {
        assert.ok(
          deck.some((card) => card.type === type && card.color === color),
          `${mode} 덱에는 ${color} ${type} 특수 카드가 있어야 합니다.`
        );
      }
    }

    assert.ok(
      deck.some((card) => card.type === 'wildDraw4'),
      `${mode} 덱에는 Wild Draw 4가 있어야 합니다.`
    );
  }
});

test('No Mercy에서 손패가 25장을 넘으면 탈락한다', () => {
  const game = createTestGame({
    mode: 'no_mercy',
    players: players.slice(0, 2),
    hands: {
      a: [wild('wildDraw10'), number('red', 1)],
      b: Array.from({ length: 20 }, (_, index) => number('blue', index % 10))
    },
    drawPile: Array.from({ length: 10 }, (_, index) => number('green', index % 10))
  });

  const attack = playUnoCard(game, { userId: 'a', cardIndex: 0, chosenColor: 'red' });
  assert.equal(attack.ok, true);
  assert.equal(game.pendingDraw.amount, 10);

  const punished = drawUnoCards(game, { userId: 'b' });
  assert.equal(punished.ok, true);
  assert.equal(game.players.find((player) => player.userId === 'b').eliminated, true);
  assert.equal(game.status, 'complete');
  assert.equal(game.winner.userId, 'a');
});

test('우노 명령 payload는 시작/손패/내기와 선택 가능한 모드를 등록한다', () => {
  const [payload] = getUnoCommandPayloads();

  assert.equal(payload.name, '우노');
  assert.ok(payload.options.some((option) => option.name === '시작'));
  assert.ok(payload.options.some((option) => option.name === '손패'));
  assert.ok(payload.options.some((option) => option.name === '내기'));

  const start = payload.options.find((option) => option.name === '시작');
  const mode = start.options.find((option) => option.name === '모드');
  assert.ok(mode.choices.some((choice) => choice.value === 'house'));
  assert.ok(mode.choices.some((choice) => choice.value === 'no_mercy'));
});

test('우노 시작은 버튼형 방을 만들고 기본 규칙을 안내한다', async () => {
  const manager = new UnoGameManager({ now: () => 1_000 });
  const interaction = createCommandInteraction({ subcommand: '시작' });

  const handled = await handleUnoCommand(interaction, manager, quietLogger);

  assert.equal(handled, true);
  assert.equal(interaction.replies.length, 1);
  assert.match(interaction.replies[0].content, /우노 참가자 모집/);
  assert.match(interaction.replies[0].content, /스태킹/);
  assert.match(interaction.replies[0].content, /Seven-O/);
  assert.equal(interaction.replies[0].components.length, 1);

  const state = manager.getGame({ guildId: 'guild-1', channelId: 'channel-1' });
  assert.equal(state.status, 'lobby');
  assert.equal(state.rules.stacking, true);
  assert.equal(state.rules.sevenO, true);
});

test('우노 로비 버튼은 참가자를 추가하고 방장이 게임을 시작한다', async () => {
  const manager = new UnoGameManager({ now: () => 2_000, randomInt: () => 0 });
  await handleUnoCommand(createCommandInteraction({ subcommand: '시작' }), manager, quietLogger);
  const lobby = manager.getGame({ guildId: 'guild-1', channelId: 'channel-1' });

  const join = createButtonInteraction({
    customId: `uno_join:${lobby.id}`,
    user: { id: 'user-2', username: '둘째' }
  });
  await handleUnoCommand(join, manager, quietLogger);

  assert.equal(join.updates.length, 1);
  assert.match(join.updates[0].content, /user-2/);

  const start = createButtonInteraction({
    customId: `uno_start:${lobby.id}`,
    user: { id: 'user-1', username: '방장' }
  });
  await handleUnoCommand(start, manager, quietLogger);

  assert.equal(start.updates.length, 1);
  assert.equal(start.channel.sends.length, 1);
  assert.match(start.channel.sends[0].content, /우노 시작/);
  assert.equal(manager.getGame({ guildId: 'guild-1', channelId: 'channel-1' }).status, 'playing');
});

function createTestGame({
  mode = 'house',
  players: gamePlayers = players,
  hands,
  drawPile = [number('green', 1), number('green', 2), number('green', 3)],
  discardPile = [number('red', 5)],
  activeColor = 'red'
}) {
  return createUnoGame({
    id: 'game-1',
    guildId: 'guild-1',
    channelId: 'channel-1',
    players: gamePlayers,
    mode,
    hands,
    drawPile,
    discardPile,
    activeColor,
    turnIndex: 0,
    randomInt: () => 0,
    now: 1
  });
}

function number(color, rank) {
  return { id: `${color}-${rank}-${Math.random()}`, type: 'number', color, rank };
}

function action(color, type) {
  return { id: `${color}-${type}-${Math.random()}`, type, color };
}

function wild(type) {
  return { id: `${type}-${Math.random()}`, type };
}

function cardKey(card) {
  return card.type === 'number' ? `${card.color}-${card.rank}` : `${card.color ?? 'wild'}-${card.type}`;
}

function createCommandInteraction({
  subcommand,
  commandName = '우노',
  user = { id: 'user-1', username: '방장' },
  stringOptions = {},
  booleanOptions = {},
  integerOptions = {},
  userOptions = {}
}) {
  return {
    commandName,
    guildId: 'guild-1',
    channelId: 'channel-1',
    user,
    replies: [],
    isChatInputCommand: () => true,
    isButton: () => false,
    inGuild: () => true,
    options: {
      getSubcommand: () => subcommand,
      getString: (name) => stringOptions[name] ?? null,
      getBoolean: (name) => booleanOptions[name] ?? null,
      getInteger(name, required = false) {
        const value = integerOptions[name] ?? null;
        if (required && value === null) throw new Error(`${name} required`);
        return value;
      },
      getUser: (name) => userOptions[name] ?? null
    },
    async reply(payload) {
      this.replies.push(payload);
    }
  };
}

function createButtonInteraction({ customId, user }) {
  return {
    customId,
    guildId: 'guild-1',
    channelId: 'channel-1',
    user,
    replies: [],
    updates: [],
    isButton: () => true,
    isChatInputCommand: () => false,
    channel: {
      sends: [],
      async send(payload) {
        this.sends.push(payload);
        return payload;
      }
    },
    async reply(payload) {
      this.replies.push(payload);
    },
    async update(payload) {
      this.updates.push(payload);
    }
  };
}

const quietLogger = Object.freeze({
  debug() {},
  error() {}
});
