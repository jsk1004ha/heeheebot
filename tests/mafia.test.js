import assert from 'node:assert/strict';
import test from 'node:test';
import { MessageFlags } from 'discord.js';
import {
  getMafiaCommandPayloads,
  handleMafiaCommand,
  resetMafiaGamesForTest
} from '../src/commands/mafia.js';
import {
  MAFIA_MAX_PLAYERS,
  MAFIA_MIN_PLAYERS,
  MafiaGame,
  getMafiaRoleDistribution
} from '../src/systems/mafia.js';

const PLAYERS_7 = Object.freeze(Array.from({ length: 7 }, (_, index) => Object.freeze({
  userId: `user-${index + 1}`,
  username: `유저${index + 1}`
})));

test('마피아게임 명령 payload는 시작과 상태 하위 명령을 등록한다', () => {
  const [payload] = getMafiaCommandPayloads();

  assert.equal(payload.name, '마피아게임');
  assert.ok(payload.options.some((option) => option.name === '시작'));
  assert.ok(payload.options.some((option) => option.name === '상태'));
});

test('마피아게임 역할 분포는 4~16명 밸런스 표를 따른다', () => {
  assert.deepEqual(getMafiaRoleDistribution(4), { mafia: 1, police: 1, doctor: 1, citizen: 1 });
  assert.deepEqual(getMafiaRoleDistribution(6), { mafia: 1, police: 1, doctor: 1, citizen: 3 });
  assert.deepEqual(getMafiaRoleDistribution(7), { mafia: 2, police: 1, doctor: 2, citizen: 2 });
  assert.deepEqual(getMafiaRoleDistribution(10), { mafia: 2, police: 2, doctor: 2, citizen: 4 });
  assert.deepEqual(getMafiaRoleDistribution(16), { mafia: 3, police: 2, doctor: 3, citizen: 8 });
  assert.throws(() => getMafiaRoleDistribution(3), /4~16명/);
  assert.throws(() => getMafiaRoleDistribution(17), /4~16명/);
});

test('마피아게임 시스템은 역할 배정, 직업 회의실 대상, 밤 행동을 처리한다', () => {
  const game = new MafiaGame({
    players: PLAYERS_7,
    roleAssignments: {
      'user-1': 'mafia',
      'user-2': 'mafia',
      'user-3': 'police',
      'user-4': 'doctor',
      'user-5': 'doctor',
      'user-6': 'citizen',
      'user-7': 'citizen'
    }
  });

  assert.deepEqual(game.roleCounts, { mafia: 2, police: 1, doctor: 2, citizen: 2 });
  assert.deepEqual(game.getRoleGroups().map((group) => group.role), ['mafia', 'doctor']);
  assert.deepEqual(game.getNightActionTargets('user-1').map((player) => player.userId), ['user-3', 'user-4', 'user-5', 'user-6', 'user-7']);
  assert.deepEqual(game.getNightActionTargets('user-4').map((player) => player.userId), PLAYERS_7.map((player) => player.userId));

  assert.equal(game.submitNightAction({ actorId: 'user-1', targetId: 'user-6' }).accepted, true);
  assert.equal(game.submitNightAction({ actorId: 'user-2', targetId: 'user-7' }).accepted, true);
  const police = game.submitNightAction({ actorId: 'user-3', targetId: 'user-1' });
  assert.equal(police.investigation.isMafia, true);
  assert.equal(game.submitNightAction({ actorId: 'user-4', targetId: 'user-6' }).accepted, true);
  assert.equal(game.submitNightAction({ actorId: 'user-5', targetId: 'user-3' }).complete, true);

  const night = game.resolveNight();
  assert.deepEqual(night.killed.map((player) => player.userId), ['user-7']);
  assert.deepEqual(night.blocked.map((player) => player.userId), ['user-6']);
  assert.equal(game.getPlayer('user-7').alive, false);
  assert.equal(game.getPlayer('user-6').alive, true);
});

test('마피아게임 투표는 생존자 과반만 처형하고 동률/과반 실패는 넘긴다', () => {
  const game = new MafiaGame({
    players: PLAYERS_7.slice(0, 5),
    roleAssignments: {
      'user-1': 'mafia',
      'user-2': 'police',
      'user-3': 'doctor',
      'user-4': 'citizen',
      'user-5': 'citizen'
    }
  });

  game.castVote({ voterId: 'user-2', targetId: 'user-1' });
  game.castVote({ voterId: 'user-3', targetId: 'user-1' });
  assert.equal(game.resolveVote().reason, 'no_majority');
  assert.equal(game.getPlayer('user-1').alive, true);

  game.castVote({ voterId: 'user-2', targetId: 'user-1' });
  game.castVote({ voterId: 'user-3', targetId: 'user-1' });
  game.castVote({ voterId: 'user-4', targetId: 'user-1' });
  const executed = game.resolveVote();
  assert.equal(executed.executed.userId, 'user-1');
  assert.equal(executed.win.winner, 'citizens');

  const tie = new MafiaGame({
    players: PLAYERS_7.slice(0, 6),
    roleAssignments: {
      'user-1': 'mafia',
      'user-2': 'police',
      'user-3': 'doctor',
      'user-4': 'citizen',
      'user-5': 'citizen',
      'user-6': 'citizen'
    }
  });
  tie.castVote({ voterId: 'user-2', targetId: 'user-1' });
  tie.castVote({ voterId: 'user-3', targetId: 'user-1' });
  tie.castVote({ voterId: 'user-4', targetId: 'user-1' });
  tie.castVote({ voterId: 'user-1', targetId: 'user-2' });
  tie.castVote({ voterId: 'user-5', targetId: 'user-2' });
  tie.castVote({ voterId: 'user-6', targetId: 'user-2' });
  const tieResult = tie.resolveVote();
  assert.equal(tieResult.noExecution, true);
  assert.equal(tieResult.executed, null);
});

test('마피아게임 로비는 4~16명 제한과 직업별 비공개 회의실을 적용한다', async () => {
  resetMafiaGamesForTest();

  const channel = createChannel();
  const replies = [];
  const updates = [];
  const users = Array.from({ length: 7 }, (_, index) => createUser(`user-${index + 1}`, `유저${index + 1}`));
  const base = {
    guildId: 'guild-1',
    channelId: 'channel-1',
    channel,
    user: users[0]
  };

  await handleMafiaCommand(createSlashInteraction({ ...base, replies }), null, console, {
    collectionMs: 60_000,
    introMs: 60_000,
    nightMs: 60_000,
    discussionMs: 60_000,
    votingMs: 60_000,
    randomInt: () => 0
  });

  const lobbyButtons = replies[0].components[0].toJSON().components;
  const joinId = lobbyButtons.find((component) => component.label === '참가').custom_id;
  const startId = lobbyButtons.find((component) => component.label === '방장 시작').custom_id;

  for (const user of users.slice(1)) {
    await handleMafiaCommand(createButtonInteraction({ ...base, user, customId: joinId, updates, replies }), null, console);
  }

  await handleMafiaCommand(createButtonInteraction({ ...base, customId: startId, updates, replies }), null, console);

  assert.equal(channel.createdThreads.length, 3);
  const gameThread = channel.createdThreads.find((thread) => thread.name.startsWith('마피아게임-'));
  const roleThreads = channel.createdThreads.filter((thread) => !thread.name.startsWith('마피아게임-'));
  assert.ok(gameThread);
  assert.deepEqual(gameThread.addedMembers.sort(), users.map((user) => user.id).sort());
  assert.deepEqual(roleThreads.map((thread) => thread.name.split(' ')[0]).sort(), ['마피아', '의사']);

  const startPayload = gameThread.sent.find((payload) => typeof payload === 'object' && payload.content?.includes('마피아게임 시작'));
  const introPayload = gameThread.sent.find((payload) => typeof payload === 'object' && payload.content?.includes('1일차 아침이 밝았습니다'));
  assert.ok(startPayload);
  assert.ok(introPayload);
  assert.match(startPayload.content, /마피아 2 \/ 경찰 1 \/ 의사 2 \/ 시민 2/);
  assert.match(startPayload.content, /사망자는 진행 스레드에서 제거/);
  assert.match(startPayload.content, /조용한 마을/);
  assert.match(introPayload.content, /자기소개 시간/);
  assert.equal(gameThread.sent.some((payload) => typeof payload === 'object' && payload.content?.includes('밤이 되었습니다')), false);
  assert.doesNotMatch(startPayload.content, /user-1.*마피아/);

  const threadBase = { ...base, channelId: gameThread.id, channel: gameThread };
  const roleButtonId = startPayload.components[0].toJSON().components[0].custom_id;
  await handleMafiaCommand(createButtonInteraction({
    ...threadBase,
    customId: roleButtonId,
    replies
  }), null, console);
  assert.equal(replies.at(-1).flags, MessageFlags.Ephemeral);
  assert.match(replies.at(-1).content, /역할: \*\*/);

  const introSkipId = introPayload.components[0].toJSON().components.find((component) => component.label === '방장 스킵').custom_id;
  await handleMafiaCommand(createButtonInteraction({ ...threadBase, customId: introSkipId, replies }), null, console);
  const nightPayload = gameThread.sent.find((payload) => typeof payload === 'object' && payload.content?.includes('밤이 되었습니다'));
  assert.ok(nightPayload);
  assert.match(nightPayload.content, /마을의 불이 꺼졌습니다/);

  const nightButtonId = nightPayload.components[0].toJSON().components.find((component) => component.label === '내 밤 행동').custom_id;
  const actor = await findNightActor({ base: threadBase, users, nightButtonId, replies });
  assert.ok(actor.reply.components.length >= 1);
  assert.equal(actor.reply.flags, MessageFlags.Ephemeral);

  const gameId = startId.split(':')[1];
  await handleMafiaCommand(createButtonInteraction({ ...threadBase, user: users[0], customId: `mafia_action:${gameId}:user-5`, replies }), null, console);
  await handleMafiaCommand(createButtonInteraction({ ...threadBase, user: users[6], customId: `mafia_action:${gameId}:user-6`, replies }), null, console);
  await handleMafiaCommand(createButtonInteraction({ ...threadBase, user: users[1], customId: `mafia_action:${gameId}:user-1`, replies }), null, console);
  await handleMafiaCommand(createButtonInteraction({ ...threadBase, user: users[2], customId: `mafia_action:${gameId}:user-3`, replies }), null, console);
  await handleMafiaCommand(createButtonInteraction({ ...threadBase, user: users[3], customId: `mafia_action:${gameId}:user-4`, replies }), null, console);

  assert.deepEqual(gameThread.removedMembers.sort(), ['user-5', 'user-6']);
  assert.ok(gameThread.sent.some((payload) => typeof payload === 'string' && payload.includes('아침이 밝았습니다')));

  resetMafiaGamesForTest();
});

async function findNightActor({ base, users, nightButtonId, replies }) {
  for (const user of users) {
    const before = replies.length;
    await handleMafiaCommand(createButtonInteraction({ ...base, user, customId: nightButtonId, replies }), null, console);
    const reply = replies.at(-1);
    if (replies.length > before && Array.isArray(reply.components) && reply.components.length > 0) {
      return { user, reply };
    }
  }
  return { user: null, reply: null };
}

function createSlashInteraction({ guildId, channelId, channel, user, replies, subcommand = '시작' }) {
  return {
    commandName: '마피아게임',
    guildId,
    channelId,
    channel,
    user,
    isChatInputCommand: () => true,
    isButton: () => false,
    inGuild: () => true,
    options: {
      getSubcommand: () => subcommand
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
    inGuild: () => true,
    async update(payload) {
      updates.push(payload);
      return payload;
    },
    async reply(payload) {
      replies.push(payload);
      return payload;
    }
  };
}

function createChannel() {
  const channel = {
    id: 'channel-1',
    sent: [],
    createdThreads: [],
    threads: {
      async create(input) {
        const thread = createThread(input.name);
        channel.createdThreads.push(thread);
        return thread;
      }
    },
    async send(payload) {
      this.sent.push(payload);
      return createSentMessage(payload);
    }
  };
  return channel;
}

function createThread(name) {
  const thread = {
    id: `thread-${name}`,
    name,
    addedMembers: [],
    removedMembers: [],
    sent: [],
    archived: false,
    members: {
      async add(userId) {
        thread.addedMembers.push(userId);
      },
      async remove(userId) {
        thread.removedMembers.push(userId);
      }
    },
    async send(payload) {
      this.sent.push(payload);
    },
    async setArchived(value) {
      this.archived = value;
    }
  };
  return thread;
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
