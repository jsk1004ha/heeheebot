import assert from 'node:assert/strict';
import test from 'node:test';
import { MessageFlags } from 'discord.js';
import {
  LIARS_BAR_CARD_TYPES,
  LIARS_BAR_MAX_PLAYERS,
  LIARS_BAR_MIN_PLAYERS,
  LiarsBarGameManager,
  buildLiarsBarDeck,
  callLiarsBarLiar,
  cloneLiarsBarPublicState,
  createLiarsBarGame,
  playLiarsBarCards
} from '../src/systems/liars-bar.js';
import {
  formatLiarsBarHand,
  getLiarsBarCommandPayloads,
  handleLiarsBarCommand
} from '../src/commands/liars-bar.js';

const PLAYERS = Object.freeze([
  Object.freeze({ userId: 'user-1', username: '첫째' }),
  Object.freeze({ userId: 'user-2', username: '둘째' }),
  Object.freeze({ userId: 'user-3', username: '셋째' }),
  Object.freeze({ userId: 'user-4', username: '넷째' })
]);

const quietLogger = Object.freeze({
  debug() {},
  error() {},
  log() {},
  warn() {}
});

test('라이어바 덱은 퀸/킹/에이스 6장씩과 조커 2장으로 구성된다', () => {
  const deck = buildLiarsBarDeck();
  const counts = countBy(deck, (card) => card.type);

  assert.equal(deck.length, 20);
  assert.equal(counts[LIARS_BAR_CARD_TYPES.queen.value], 6);
  assert.equal(counts[LIARS_BAR_CARD_TYPES.king.value], 6);
  assert.equal(counts[LIARS_BAR_CARD_TYPES.ace.value], 6);
  assert.equal(counts[LIARS_BAR_CARD_TYPES.joker.value], 2);
});

test('라이어바 게임은 2~4명에게 5장씩 나누고 공개 상태에서 손패와 탄 위치를 숨긴다', () => {
  const game = createLiarsBarGame({
    players: PLAYERS.slice(0, 2),
    randomInt: () => 0,
    now: () => 1_000
  });
  const publicState = cloneLiarsBarPublicState(game);

  assert.equal(game.status, 'playing');
  assert.equal(game.round, 1);
  assert.equal(game.tableType, LIARS_BAR_CARD_TYPES.queen.value);
  assert.equal(game.currentPlayer?.userId, undefined);
  assert.equal(publicState.currentPlayer.userId, 'user-1');
  assert.equal(game.hands['user-1'].length, 5);
  assert.equal(game.hands['user-2'].length, 5);
  assert.equal(publicState.players[0].handCount, 5);
  assert.equal(Object.hasOwn(publicState.players[0], 'bulletPosition'), false);

  assert.throws(() => createLiarsBarGame({
    players: PLAYERS.slice(0, LIARS_BAR_MIN_PLAYERS - 1)
  }), /2~4명/);
  assert.throws(() => createLiarsBarGame({
    players: Array.from({ length: LIARS_BAR_MAX_PLAYERS + 1 }, (_, index) => ({
      userId: `user-${index}`,
      username: `유저${index}`
    }))
  }), /2~4명/);
});

test('라이어바 라이어 선언은 거짓 카드 공개 시 제출자에게 벌칙을 주고 새 라운드를 시작한다', () => {
  const game = createPreparedGame();

  const played = playLiarsBarCards(game, { userId: 'user-1', cardNumbers: [1] });
  assert.equal(played.ok, true);
  assert.equal(game.previousPlay.count, 1);
  assert.equal(game.currentPlayer?.userId, undefined);
  assert.equal(cloneLiarsBarPublicState(game).currentPlayer.userId, 'user-2');

  const challenged = callLiarsBarLiar(game, { userId: 'user-2', randomInt: () => 0 });

  assert.equal(challenged.ok, true);
  assert.equal(challenged.code, 'liar_caught');
  assert.equal(challenged.reveal.hasLiarCard, true);
  assert.equal(challenged.reveal.penaltyPlayer.userId, 'user-1');
  assert.equal(challenged.roulette.eliminated, false);
  assert.equal(game.players.find((player) => player.userId === 'user-1').shotsFired, 1);
  assert.equal(game.round, 2);
  assert.equal(cloneLiarsBarPublicState(game).currentPlayer.userId, 'user-1');
});

test('라이어바는 진실을 의심하면 의심자가 벌칙을 받고 총알 위치에 도달하면 탈락/승리 처리한다', () => {
  const game = createPreparedGame();
  game.hands['user-1'] = [{ id: 'queen-truth', type: LIARS_BAR_CARD_TYPES.queen.value }];
  game.hands['user-2'] = [{ id: 'king-caller', type: LIARS_BAR_CARD_TYPES.king.value }];
  game.players.find((player) => player.userId === 'user-2').bulletPosition = 1;

  assert.equal(playLiarsBarCards(game, { userId: 'user-1', cardNumbers: [1] }).ok, true);
  const challenged = callLiarsBarLiar(game, { userId: 'user-2', randomInt: () => 0 });

  assert.equal(challenged.ok, true);
  assert.equal(challenged.code, 'truthful_accused');
  assert.equal(challenged.reveal.hasLiarCard, false);
  assert.equal(challenged.reveal.penaltyPlayer.userId, 'user-2');
  assert.equal(challenged.roulette.eliminated, true);
  assert.equal(game.status, 'complete');
  assert.equal(game.winner.userId, 'user-1');
});

test('라이어바는 혼자만 손패가 남은 플레이어에게 라이어 선언을 강제한다', () => {
  const game = createPreparedGame();
  game.hands['user-1'] = [];
  game.hands['user-2'] = [{ id: 'king-caller', type: LIARS_BAR_CARD_TYPES.king.value }];
  game.previousPlay = {
    player: { userId: 'user-1', username: '첫째' },
    cards: [{ id: 'queen-played', type: LIARS_BAR_CARD_TYPES.queen.value }],
    claimedType: LIARS_BAR_CARD_TYPES.queen.value,
    count: 1,
    round: game.round
  };
  game.turnIndex = 1;

  const result = playLiarsBarCards(game, { userId: 'user-2', cardNumbers: [1] });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'must_call');
  assert.match(result.reason, /라이어/);
});

test('라이어바 명령 payload는 시작/손패/내기/라이어 서브명령을 등록한다', () => {
  const [payload] = getLiarsBarCommandPayloads();

  assert.equal(payload.name, '라이어바');
  assert.ok(payload.options.some((option) => option.name === '시작'));
  assert.ok(payload.options.some((option) => option.name === '손패'));
  assert.ok(payload.options.some((option) => option.name === '내기'));
  assert.ok(payload.options.some((option) => option.name === '라이어'));

  const play = payload.options.find((option) => option.name === '내기');
  assert.equal(play.options.find((option) => option.name === '카드1').required, true);
  assert.equal(play.options.find((option) => option.name === '카드3').min_value, 1);
});

test('라이어바 로비 버튼은 참가자를 추가하고 방장이 게임을 시작한다', async () => {
  const manager = new LiarsBarGameManager({ now: () => 2_000, randomInt: () => 0 });
  const channel = createChannel();
  const startCommand = createCommandInteraction({ subcommand: '시작', channel });

  assert.equal(await handleLiarsBarCommand(startCommand, manager, quietLogger), true);
  assert.match(startCommand.replies[0].content, /LIAR'S BAR ROOM/);
  assert.match(startCommand.replies[0].embeds[0].data.title, /LIAR'S BAR ROOM/);
  const lobby = manager.getGame({ guildId: 'guild-1', channelId: 'channel-1' });
  const lobbyButtons = startCommand.replies[0].components[0].toJSON().components;
  const joinButton = lobbyButtons.find((component) => component.label === '참가');
  const startButton = lobbyButtons.find((component) => component.label === '방장 시작');
  assert.equal(startButton.disabled, true);

  const join = createButtonInteraction({
    customId: joinButton.custom_id,
    user: { id: 'user-2', username: '둘째' },
    channel
  });
  await handleLiarsBarCommand(join, manager, quietLogger);

  assert.equal(join.updates.length, 1);
  assert.match(join.updates[0].content, /user-2/);
  assert.match(join.updates[0].embeds[0].data.fields.find((field) => field.name === '참가자').value, /user-2/);
  assert.equal(join.updates[0].components[0].toJSON().components.find((component) => component.label === '방장 시작').disabled, false);
  assert.equal(manager.getGame({ guildId: 'guild-1', channelId: 'channel-1' }).players.length, 2);

  const start = createButtonInteraction({
    customId: startButton.custom_id,
    user: { id: 'user-1', username: '방장' },
    channel
  });
  await handleLiarsBarCommand(start, manager, quietLogger);

  assert.equal(start.updates.length, 1);
  assert.equal(channel.sends.length, 1);
  assert.match(channel.sends[0].content, /LIAR'S BAR START/);
  assert.match(channel.sends[0].content, /테이블 카드/);
  assert.match(channel.sends[0].embeds[0].data.title, /LIAR'S BAR START/);
  assert.match(channel.sends[0].embeds[0].data.fields.find((field) => field.name === '플레이어').value, /벌칙 0\/6/);
  const gameButtons = channel.sends[0].components[0].toJSON().components;
  assert.deepEqual(gameButtons.map((component) => component.label), ['내 손패', 'LIAR 선언']);
  assert.equal(gameButtons.find((component) => component.label === 'LIAR 선언').disabled, true);
  assert.equal(manager.getGame({ guildId: 'guild-1', channelId: 'channel-1' }).status, 'playing');
  assert.equal(lobby.status, 'lobby');
});

test('라이어바 손패는 비공개로 표시되고 플레이 액션은 공개 상태를 갱신한다', async () => {
  const manager = new LiarsBarGameManager({ now: () => 3_000, randomInt: () => 0 });
  const channel = createChannel();
  await handleLiarsBarCommand(createCommandInteraction({ subcommand: '시작', channel }), manager, quietLogger);
  const lobby = manager.getGame({ guildId: 'guild-1', channelId: 'channel-1' });
  await handleLiarsBarCommand(createButtonInteraction({
    customId: `liarsbar_join:${lobby.id}`,
    user: { id: 'user-2', username: '둘째' },
    channel
  }), manager, quietLogger);
  await handleLiarsBarCommand(createButtonInteraction({
    customId: `liarsbar_start:${lobby.id}`,
    user: { id: 'user-1', username: '방장' },
    channel
  }), manager, quietLogger);

  const hand = createCommandInteraction({ subcommand: '손패', channel });
  await handleLiarsBarCommand(hand, manager, quietLogger);

  assert.equal(hand.replies[0].flags, MessageFlags.Ephemeral);
  assert.match(hand.replies[0].content, /내 라이어바 손패/);
  assert.match(hand.replies[0].content, /`01`/);
  assert.match(hand.replies[0].embeds[0].data.title, /내 라이어바 손패/);
  assert.match(hand.replies[0].embeds[0].data.fields.find((field) => field.name === '빠른 입력').value, /\/라이어바 라이어/);
  assert.equal(hand.replies[0].components.length, 1);
  const handSelect = hand.replies[0].components[0].toJSON().components[0];
  assert.equal(handSelect.custom_id.startsWith('liarsbar_play_select:'), true);
  assert.equal(handSelect.min_values, 1);
  assert.equal(handSelect.max_values, 3);
  assert.equal(handSelect.options.length, 5);

  const handText = formatLiarsBarHand(manager.getPlayerHand({
    guildId: 'guild-1',
    channelId: 'channel-1',
    userId: 'user-1'
  }));
  assert.match(handText, /카드 선택 번호/);

  const play = createCommandInteraction({
    subcommand: '내기',
    channel,
    integers: { 카드1: 1 }
  });
  await handleLiarsBarCommand(play, manager, quietLogger);

  assert.match(play.replies[0].content, /카드 1장을 뒤집어/);
  assert.match(play.replies[0].content, /직전 주장/);
  assert.equal(play.replies[0].embeds.length, 2);
  assert.match(play.replies[0].embeds[0].data.title, /라이어바 행동/);
  assert.match(play.replies[0].embeds[1].data.title, /LIAR'S BAR TABLE/);
  const actionButtons = play.replies[0].components[0].toJSON().components;
  assert.deepEqual(actionButtons.map((component) => component.label), ['내 손패', 'LIAR 선언']);
  assert.equal(actionButtons.find((component) => component.label === 'LIAR 선언').disabled, false);
});

test('라이어바 공개 LIAR 선언 버튼은 현재 차례 유저가 직전 제출을 의심하게 한다', async () => {
  const randomInt = (max) => max === 6 ? 5 : 0;
  const manager = new LiarsBarGameManager({ now: () => 3_500, randomInt });
  const channel = createChannel();
  await handleLiarsBarCommand(createCommandInteraction({ subcommand: '시작', channel }), manager, quietLogger);
  const lobby = manager.getGame({ guildId: 'guild-1', channelId: 'channel-1' });
  await handleLiarsBarCommand(createButtonInteraction({
    customId: `liarsbar_join:${lobby.id}`,
    user: { id: 'user-2', username: '둘째' },
    channel
  }), manager, quietLogger);
  await handleLiarsBarCommand(createButtonInteraction({
    customId: `liarsbar_start:${lobby.id}`,
    user: { id: 'user-1', username: '방장' },
    channel
  }), manager, quietLogger);

  const play = createCommandInteraction({
    subcommand: '내기',
    channel,
    integers: { 카드1: 1 }
  });
  await handleLiarsBarCommand(play, manager, quietLogger);
  const liarButton = play.replies[0].components[0].toJSON().components
    .find((component) => component.label === 'LIAR 선언');
  const call = createButtonInteraction({
    customId: liarButton.custom_id,
    user: { id: 'user-2', username: '둘째' },
    channel
  });

  await handleLiarsBarCommand(call, manager, quietLogger);

  assert.equal(call.updates.length, 1);
  assert.match(call.updates[0].content, /LIAR 선언|카드를 공개/);
  assert.match(call.updates[0].embeds[0].data.title, /판정/);
  assert.equal(call.updates[0].components[0].toJSON().components.length, 2);
  assert.equal(call.updates[0].components[0].toJSON().components.find((component) => component.label === 'LIAR 선언').disabled, true);
  assert.equal(manager.getGame({ guildId: 'guild-1', channelId: 'channel-1' }).round, 2);
});

test('라이어바 손패 선택 메뉴는 선택한 카드를 공개 테이블에 바로 제출한다', async () => {
  const manager = new LiarsBarGameManager({ now: () => 4_000, randomInt: () => 0 });
  const channel = createChannel();
  await handleLiarsBarCommand(createCommandInteraction({ subcommand: '시작', channel }), manager, quietLogger);
  const lobby = manager.getGame({ guildId: 'guild-1', channelId: 'channel-1' });
  await handleLiarsBarCommand(createButtonInteraction({
    customId: `liarsbar_join:${lobby.id}`,
    user: { id: 'user-2', username: '둘째' },
    channel
  }), manager, quietLogger);
  await handleLiarsBarCommand(createButtonInteraction({
    customId: `liarsbar_start:${lobby.id}`,
    user: { id: 'user-1', username: '방장' },
    channel
  }), manager, quietLogger);

  const hand = createCommandInteraction({ subcommand: '손패', channel });
  await handleLiarsBarCommand(hand, manager, quietLogger);
  const selectMenu = hand.replies[0].components[0].toJSON().components[0];
  const select = createSelectInteraction({
    customId: selectMenu.custom_id,
    values: ['1', '2'],
    channel
  });

  await handleLiarsBarCommand(select, manager, quietLogger);

  assert.equal(select.updates.length, 1);
  assert.match(select.updates[0].content, /제출했습니다/);
  assert.equal(select.updates[0].components.length, 0);
  assert.equal(channel.sends.length, 2);
  assert.match(channel.sends.at(-1).content, /카드 2장을 뒤집어/);
  assert.match(channel.sends.at(-1).embeds[0].data.title, /라이어바 행동/);
  assert.equal(manager.getGame({ guildId: 'guild-1', channelId: 'channel-1' }).currentPlayer.userId, 'user-2');
});

function createPreparedGame() {
  const game = createLiarsBarGame({
    players: PLAYERS.slice(0, 2),
    randomInt: () => 0,
    now: () => 1_000
  });
  game.tableType = LIARS_BAR_CARD_TYPES.queen.value;
  game.turnIndex = 0;
  game.hands = {
    'user-1': [{ id: 'king-lie', type: LIARS_BAR_CARD_TYPES.king.value }],
    'user-2': [{ id: 'queen-caller', type: LIARS_BAR_CARD_TYPES.queen.value }]
  };
  game.players.find((player) => player.userId === 'user-1').bulletPosition = 2;
  game.players.find((player) => player.userId === 'user-2').bulletPosition = 2;
  return game;
}

function countBy(items, mapper) {
  return items.reduce((counts, item) => {
    const key = mapper(item);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function createChannel() {
  return {
    sends: [],
    async send(payload) {
      this.sends.push(payload);
      return payload;
    }
  };
}

function createCommandInteraction({
  subcommand,
  user = { id: 'user-1', username: '방장' },
  channel = createChannel(),
  integers = {}
} = {}) {
  return {
    commandName: '라이어바',
    guildId: 'guild-1',
    channelId: 'channel-1',
    channel,
    user,
    replies: [],
    isChatInputCommand: () => true,
    isButton: () => false,
    inGuild: () => true,
    options: {
      getSubcommand: () => subcommand,
      getInteger: (name, required = false) => {
        if (Object.hasOwn(integers, name)) return integers[name];
        if (required) throw new Error(`${name} required`);
        return null;
      }
    },
    async reply(payload) {
      this.replies.push(payload);
    }
  };
}

function createButtonInteraction({
  customId,
  user = { id: 'user-1', username: '방장' },
  channel = createChannel()
}) {
  return {
    customId,
    guildId: 'guild-1',
    channelId: 'channel-1',
    channel,
    user,
    updates: [],
    replies: [],
    isChatInputCommand: () => false,
    isButton: () => true,
    inGuild: () => true,
    async update(payload) {
      this.updates.push(payload);
    },
    async reply(payload) {
      this.replies.push(payload);
    }
  };
}

function createSelectInteraction({
  customId,
  values,
  user = { id: 'user-1', username: '방장' },
  channel = createChannel()
}) {
  return {
    customId,
    values,
    guildId: 'guild-1',
    channelId: 'channel-1',
    channel,
    user,
    updates: [],
    replies: [],
    isChatInputCommand: () => false,
    isButton: () => false,
    isStringSelectMenu: () => true,
    inGuild: () => true,
    async update(payload) {
      this.updates.push(payload);
    },
    async reply(payload) {
      this.replies.push(payload);
    }
  };
}
