import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { MessageFlags } from 'discord.js';
import {
  getLiarGameCommandPayloads,
  handleLiarGameCommand,
  handleLiarGameMessage,
  resetLiarGameSessionsForTest
} from '../src/commands/liar-game.js';
import {
  LIAR_GAME_MAX_PLAYERS,
  LIAR_GAME_MIN_PLAYERS,
  LIAR_GAME_MODES,
  LiarGame
} from '../src/systems/liar-game.js';

const TEST_WORD_BANK = Object.freeze({
  categories: Object.freeze([
    Object.freeze({
      id: 'food',
      name: '음식',
      words: Object.freeze(['김치찌개', '된장찌개', '라면', '떡볶이'])
    }),
    Object.freeze({
      id: 'movie_drama',
      name: '영화/드라마',
      words: Object.freeze(['오징어 게임', '기생충', '겨울왕국', '어벤져스'])
    })
  ])
});

const TEST_PLAYERS = Object.freeze([
  Object.freeze({ userId: 'user-1', username: '첫째' }),
  Object.freeze({ userId: 'user-2', username: '둘째' }),
  Object.freeze({ userId: 'user-3', username: '셋째' }),
  Object.freeze({ userId: 'user-4', username: '넷째' })
]);

test('라이어게임 명령 payload는 시작 옵션과 10개 이상 카테고리를 등록한다', async () => {
  const [payload] = getLiarGameCommandPayloads();
  const wordBank = JSON.parse(await readFile(new URL('../data/liar-game-words.json', import.meta.url), 'utf8'));
  const categoryCount = wordBank.categories.length;
  const wordCount = wordBank.categories.reduce((sum, category) => sum + category.words.length, 0);
  const movieCategory = wordBank.categories.find((category) => category.id === 'movie_drama');

  assert.equal(payload.name, '라이어게임');
  assert.equal(payload.options[0].name, '시작');
  assert.deepEqual(payload.options[0].options.find((option) => option.name === '모드').choices.map((choice) => choice.value), [
    LIAR_GAME_MODES.normal.value,
    LIAR_GAME_MODES.hard.value
  ]);
  assert.deepEqual(payload.options[0].options.find((option) => option.name === '설명턴수').choices.map((choice) => choice.value), [1, 2]);
  assert.equal(categoryCount, 10);
  assert.equal(wordCount >= 1500, true);
  assert.equal(wordBank.categories.every((category) => category.words.length >= 150), true);
  assert.ok(movieCategory.words.includes('오징어 게임'));
  assert.ok(movieCategory.words.includes('기생충'));
  assert.ok(movieCategory.words.includes('어벤져스'));
});

test('라이어게임 시스템은 일반/어려움 모드 제시어와 2턴 설명 순서를 만든다', () => {
  const normal = new LiarGame({
    players: TEST_PLAYERS,
    wordBank: TEST_WORD_BANK,
    mode: 'normal',
    categoryId: 'food',
    turnCount: 2,
    randomInt: () => 0
  });

  assert.equal(normal.category.name, '음식');
  assert.equal(normal.targetWord, '김치찌개');
  assert.equal(normal.liarUserId, 'user-1');
  assert.equal(normal.getAssignment('user-1').word, null);
  assert.equal(normal.getAssignment('user-2').word, '김치찌개');
  assert.deepEqual(normal.turnOrder.map((player) => player.userId), ['user-2', 'user-3', 'user-4', 'user-1']);
  assert.equal(normal.currentTurn.player.userId, 'user-2');
  assert.equal(normal.turns.length, TEST_PLAYERS.length * 2);

  const hard = new LiarGame({
    players: TEST_PLAYERS,
    wordBank: TEST_WORD_BANK,
    mode: 'hard',
    categoryId: 'food',
    randomInt: () => 0
  });

  assert.equal(hard.getAssignment('user-1').isLiar, true);
  assert.equal(hard.getAssignment('user-1').word, '된장찌개');
  assert.equal(hard.getAssignment('user-2').word, '김치찌개');
  assert.throws(() => new LiarGame({
    players: TEST_PLAYERS.slice(0, LIAR_GAME_MIN_PLAYERS - 1),
    wordBank: TEST_WORD_BANK
  }), /4~10명/);
  assert.throws(() => new LiarGame({
    players: Array.from({ length: LIAR_GAME_MAX_PLAYERS + 1 }, (_, index) => ({
      userId: `user-${index}`,
      username: `유저${index}`
    })),
    wordBank: TEST_WORD_BANK
  }), /4~10명/);
});

test('라이어게임 시스템은 자기투표를 막고 최다 득표/동률을 판정한다', () => {
  const game = new LiarGame({
    players: TEST_PLAYERS,
    wordBank: TEST_WORD_BANK,
    mode: 'normal',
    categoryId: 'food',
    randomInt: () => 0
  });

  assert.equal(game.castVote({ voterId: 'user-1', targetId: 'user-1' }).accepted, false);
  assert.equal(game.castVote({ voterId: 'user-2', targetId: 'user-1' }).accepted, true);
  assert.equal(game.castVote({ voterId: 'user-3', targetId: 'user-1' }).accepted, true);
  assert.equal(game.castVote({ voterId: 'user-4', targetId: 'user-2' }).accepted, true);

  const result = game.resolveVote();
  assert.equal(result.accused.userId, 'user-1');
  assert.equal(result.accusedIsLiar, true);

  game.clearVotes();
  game.castVote({ voterId: 'user-1', targetId: 'user-2' });
  game.castVote({ voterId: 'user-2', targetId: 'user-1' });
  assert.equal(game.resolveVote().tie, true);
  assert.equal(game.isVotingComplete(), false);
  game.castVote({ voterId: 'user-3', targetId: 'user-1' });
  game.castVote({ voterId: 'user-4', targetId: 'user-1' });
  assert.equal(game.isVotingComplete(), true);
});

test('라이어게임 로비는 최소 4명부터 시작하고 제시어는 에페메럴 버튼으로만 보여준다', async () => {
  resetLiarGameSessionsForTest();

  const channel = createChannel();
  const host = createUser('host-1', '방장');
  const replies = [];
  const updates = [];
  const base = {
    guildId: 'guild-1',
    channelId: 'channel-1',
    channel,
    user: host
  };

  await handleLiarGameCommand(createSlashInteraction({
    ...base,
    replies,
    options: {
      모드: 'normal',
      설명턴수: 1,
      카테고리: 'food'
    }
  }), null, console, {
    wordBank: TEST_WORD_BANK,
    collectionMs: 60_000,
    descriptionMs: 60_000,
    votingMs: 60_000,
    guessMs: 60_000,
    randomInt: () => 0
  });

  const lobbyButtons = replies[0].components[0].toJSON().components;
  const joinButton = lobbyButtons.find((component) => component.label === '참가');
  const startButton = lobbyButtons.find((component) => component.label === '방장 시작');

  await handleLiarGameCommand(createButtonInteraction({
    ...base,
    customId: startButton.custom_id,
    updates,
    replies
  }), null, console);

  assert.match(channel.sent.at(-1), /최소 4명/);
  resetLiarGameSessionsForTest();

  replies.length = 0;
  updates.length = 0;
  channel.sent.length = 0;

  await handleLiarGameCommand(createSlashInteraction({
    ...base,
    replies,
    options: {
      모드: 'normal',
      설명턴수: 1,
      카테고리: 'food'
    }
  }), null, console, {
    wordBank: TEST_WORD_BANK,
    collectionMs: 60_000,
    descriptionMs: 60_000,
    votingMs: 60_000,
    guessMs: 60_000,
    randomInt: () => 0
  });

  const secondLobbyButtons = replies[0].components[0].toJSON().components;
  const secondJoinButton = secondLobbyButtons.find((component) => component.label === '참가');
  const secondStartButton = secondLobbyButtons.find((component) => component.label === '방장 시작');

  for (const user of [createUser('user-2', '둘째'), createUser('user-3', '셋째'), createUser('user-4', '넷째')]) {
    await handleLiarGameCommand(createButtonInteraction({
      ...base,
      user,
      customId: secondJoinButton.custom_id,
      updates,
      replies
    }), null, console);
  }

  await handleLiarGameCommand(createButtonInteraction({
    ...base,
    customId: secondStartButton.custom_id,
    updates,
    replies
  }), null, console);

  const startPayload = channel.sent.find((payload) => typeof payload === 'object' && payload.content?.includes('라이어게임 시작'));
  assert.ok(startPayload);
  assert.match(startPayload.content, /공개 주제: \*\*음식\*\*/);
  assert.doesNotMatch(startPayload.content, /김치찌개/);

  const secretButton = startPayload.components[0].toJSON().components[0];
  await handleLiarGameCommand(createButtonInteraction({
    ...base,
    customId: secretButton.custom_id,
    replies
  }), null, console);

  assert.equal(replies.at(-1).flags, MessageFlags.Ephemeral);
  assert.match(replies.at(-1).content, /당신은 \*\*라이어\*\*/);
  assert.doesNotMatch(replies.at(-1).content, /제시어: \*\*김치찌개\*\*/);

  resetLiarGameSessionsForTest();
});

test('라이어게임 어려움 모드 비공개 정보는 시민/라이어 역할을 노출하지 않는다', async () => {
  resetLiarGameSessionsForTest();

  const channel = createChannel();
  const replies = [];
  const updates = [];
  const base = {
    guildId: 'guild-1',
    channelId: 'channel-1',
    channel,
    user: createUser('host-1', '방장')
  };

  await handleLiarGameCommand(createSlashInteraction({
    ...base,
    replies,
    options: {
      모드: 'hard',
      설명턴수: 1,
      카테고리: 'food'
    }
  }), null, console, {
    wordBank: TEST_WORD_BANK,
    collectionMs: 60_000,
    descriptionMs: 60_000,
    votingMs: 60_000,
    guessMs: 60_000,
    randomInt: () => 0
  });

  const lobbyButtons = replies[0].components[0].toJSON().components;
  const joinButton = lobbyButtons.find((component) => component.label === '참가');
  const startButton = lobbyButtons.find((component) => component.label === '방장 시작');

  for (const user of [createUser('user-2', '둘째'), createUser('user-3', '셋째'), createUser('user-4', '넷째')]) {
    await handleLiarGameCommand(createButtonInteraction({
      ...base,
      user,
      customId: joinButton.custom_id,
      updates,
      replies
    }), null, console);
  }

  await handleLiarGameCommand(createButtonInteraction({
    ...base,
    customId: startButton.custom_id,
    updates,
    replies
  }), null, console);

  const startPayload = channel.sent.find((payload) => typeof payload === 'object' && payload.content?.includes('라이어게임 시작'));
  const secretButton = startPayload.components[0].toJSON().components[0];

  await handleLiarGameCommand(createButtonInteraction({
    ...base,
    user: createUser('user-2', '둘째'),
    customId: secretButton.custom_id,
    replies
  }), null, console);

  const citizenSecret = replies.at(-1);
  assert.equal(citizenSecret.flags, MessageFlags.Ephemeral);
  assert.match(citizenSecret.content, /어려움 모드에서는 역할을 공개하지 않습니다/);
  assert.match(citizenSecret.content, /당신의 제시어: \*\*김치찌개\*\*/);
  assert.doesNotMatch(citizenSecret.content, /당신은 \*\*시민\*\*/);
  assert.doesNotMatch(citizenSecret.content, /당신은 \*\*라이어\*\*/);

  await handleLiarGameCommand(createButtonInteraction({
    ...base,
    customId: secretButton.custom_id,
    replies
  }), null, console);

  const liarSecret = replies.at(-1);
  assert.match(liarSecret.content, /당신의 제시어: \*\*된장찌개\*\*/);
  assert.doesNotMatch(liarSecret.content, /당신은 \*\*시민\*\*/);
  assert.doesNotMatch(liarSecret.content, /당신은 \*\*라이어\*\*/);

  resetLiarGameSessionsForTest();
});

test('라이어게임 설명 메시지는 차례인 참가자만 처리한다', async () => {
  resetLiarGameSessionsForTest();

  const channel = createChannel();
  const replies = [];
  const updates = [];
  const base = {
    guildId: 'guild-1',
    channelId: 'channel-1',
    channel,
    user: createUser('host-1', '방장')
  };

  await handleLiarGameCommand(createSlashInteraction({
    ...base,
    replies,
    options: { 모드: 'normal', 설명턴수: 1, 카테고리: 'food' }
  }), null, console, {
    wordBank: TEST_WORD_BANK,
    collectionMs: 60_000,
    descriptionMs: 60_000,
    votingMs: 60_000,
    guessMs: 60_000,
    randomInt: (max) => max - 1
  });

  const buttons = replies[0].components[0].toJSON().components;
  const joinId = buttons.find((component) => component.label === '참가').custom_id;
  const startId = buttons.find((component) => component.label === '방장 시작').custom_id;

  for (const user of [createUser('user-2', '둘째'), createUser('user-3', '셋째'), createUser('user-4', '넷째')]) {
    await handleLiarGameCommand(createButtonInteraction({ ...base, user, customId: joinId, updates, replies }), null, console);
  }
  await handleLiarGameCommand(createButtonInteraction({ ...base, customId: startId, updates, replies }), null, console);

  assert.equal(await handleLiarGameMessage(createMessage({ ...base, user: createUser('user-2', '둘째'), content: '빨갛고 맵습니다.' }), null, console), false);
  assert.equal(await handleLiarGameMessage(createMessage({ ...base, content: '자주 먹는 음식입니다.' }), null, console), true);
  assert.ok(channel.sent.some((payload) => String(payload).includes('차례입니다')));

  resetLiarGameSessionsForTest();
});

test('라이어게임 투표는 참가자 전원이 투표하면 즉시 종료된다', async () => {
  resetLiarGameSessionsForTest();

  const channel = createChannel();
  const replies = [];
  const updates = [];
  const base = {
    guildId: 'guild-1',
    channelId: 'channel-1',
    channel,
    user: createUser('host-1', '방장')
  };

  await handleLiarGameCommand(createSlashInteraction({
    ...base,
    replies,
    options: { 모드: 'normal', 설명턴수: 1, 카테고리: 'food' }
  }), null, console, {
    wordBank: TEST_WORD_BANK,
    collectionMs: 60_000,
    descriptionMs: 60_000,
    votingMs: 60_000,
    guessMs: 60_000,
    randomInt: () => 0
  });

  const buttons = replies[0].components[0].toJSON().components;
  const joinId = buttons.find((component) => component.label === '참가').custom_id;
  const startId = buttons.find((component) => component.label === '방장 시작').custom_id;

  for (const user of [createUser('user-2', '둘째'), createUser('user-3', '셋째'), createUser('user-4', '넷째')]) {
    await handleLiarGameCommand(createButtonInteraction({ ...base, user, customId: joinId, updates, replies }), null, console);
  }
  await handleLiarGameCommand(createButtonInteraction({ ...base, customId: startId, updates, replies }), null, console);

  const startPayload = channel.sent.find((payload) => typeof payload === 'object' && payload.content?.includes('라이어게임 시작'));
  const gameId = startPayload.components[0].toJSON().components[0].custom_id.split(':')[1];

  for (const [user, content] of [
    [createUser('user-2', '둘째'), '빨갛고 맵습니다.'],
    [createUser('user-3', '셋째'), '국물 요리입니다.'],
    [createUser('user-4', '넷째'), '밥이랑 먹습니다.'],
    [createUser('host-1', '방장'), '뜨겁습니다.']
  ]) {
    assert.equal(await handleLiarGameMessage(createMessage({ ...base, user, content }), null, console), true);
  }

  const voteForLiarId = `liar_vote:${gameId}:host-1`;
  const hostVoteId = `liar_vote:${gameId}:user-2`;

  for (const user of [createUser('user-2', '둘째'), createUser('user-3', '셋째'), createUser('user-4', '넷째')]) {
    await handleLiarGameCommand(createButtonInteraction({ ...base, user, customId: voteForLiarId, updates, replies }), null, console);
  }
  assert.equal(channel.sent.some((payload) => typeof payload === 'object' && payload.content?.includes('라이어로 지목')), false);

  await handleLiarGameCommand(createButtonInteraction({ ...base, customId: hostVoteId, updates, replies }), null, console);

  assert.ok(updates.at(-1).embeds[0].data.description.includes('전원이 투표했습니다'));
  assert.ok(channel.sent.some((payload) => typeof payload === 'object' && payload.content?.includes('라이어로 지목되었습니다')));

  resetLiarGameSessionsForTest();
});

function createSlashInteraction({ guildId, channelId, channel, user, replies, options }) {
  return {
    commandName: '라이어게임',
    guildId,
    channelId,
    channel,
    user,
    isChatInputCommand: () => true,
    isButton: () => false,
    isModalSubmit: () => false,
    inGuild: () => true,
    options: {
      getSubcommand: () => '시작',
      getString(name) {
        return options[name] ?? null;
      },
      getInteger(name) {
        return options[name] ?? null;
      }
    },
    async reply(payload) {
      replies.push(payload);
      return payload;
    }
  };
}

function createButtonInteraction({ guildId, channelId, channel, user, customId, updates = [], replies = [], message = null }) {
  return {
    customId,
    guildId,
    channelId,
    channel,
    user,
    message,
    isChatInputCommand: () => false,
    isButton: () => true,
    isModalSubmit: () => false,
    inGuild: () => true,
    async update(payload) {
      updates.push(payload);
      return payload;
    },
    async reply(payload) {
      replies.push(payload);
      return payload;
    },
    async showModal(modal) {
      this.modal = modal;
    }
  };
}

function createMessage({ guildId, channelId, channel, user, content }) {
  return {
    guild: { id: guildId },
    channelId,
    channel,
    author: user,
    content,
    inGuild: () => true,
    async reply(payload) {
      channel.sent.push(payload);
    },
    async react(emoji) {
      channel.reactions.push(emoji);
    }
  };
}

function createChannel() {
  return {
    id: 'channel-1',
    sent: [],
    reactions: [],
    async send(payload) {
      this.sent.push(payload);
      return createSentMessage(payload);
    }
  };
}

function createSentMessage(payload) {
  return {
    id: `message-${Math.random().toString(36).slice(2)}`,
    payload,
    edits: [],
    async edit(nextPayload) {
      this.edits.push(nextPayload);
      return this;
    }
  };
}

function createUser(id, username) {
  return { id, username, bot: false };
}
