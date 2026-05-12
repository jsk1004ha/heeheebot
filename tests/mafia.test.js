import assert from 'node:assert/strict';
import test from 'node:test';
import { MessageFlags } from 'discord.js';
import {
  MAFIA_ROLES,
  MafiaGame,
  getMafiaRoleComposition
} from '../src/systems/mafia.js';
import {
  getMafiaCommandPayloads,
  handleMafiaCommand,
  resetMafiaGamesForTest
} from '../src/commands/mafia.js';

const PLAYERS = Object.freeze([
  Object.freeze({ userId: 'host-1', username: '방장' }),
  Object.freeze({ userId: 'user-2', username: '둘째' }),
  Object.freeze({ userId: 'user-3', username: '셋째' }),
  Object.freeze({ userId: 'user-4', username: '넷째' })
]);

const ROLE_ASSIGNMENTS = Object.freeze({
  'host-1': MAFIA_ROLES.mafia,
  'user-2': MAFIA_ROLES.police,
  'user-3': MAFIA_ROLES.doctor,
  'user-4': MAFIA_ROLES.citizen
});

test('마피아 역할 구성은 인원에 맞춰 마피아/경찰/의사/시민을 배정한다', () => {
  assert.deepEqual(getMafiaRoleComposition(4), {
    mafia: 1,
    police: 1,
    doctor: 1,
    citizen: 1
  });
  assert.deepEqual(getMafiaRoleComposition(8), {
    mafia: 2,
    police: 1,
    doctor: 1,
    citizen: 4
  });
  assert.deepEqual(getMafiaRoleComposition(12), {
    mafia: 3,
    police: 1,
    doctor: 1,
    citizen: 7
  });
});

test('밤 행동은 마피아 습격, 경찰 조사, 의사 치료를 정산한다', () => {
  const game = createGame({ revealGhostRoles: true });

  const mafia = game.castNightAction({ userId: 'host-1', targetId: 'user-4' });
  assert.equal(mafia.type, 'mafia');
  assert.equal(mafia.complete, false);

  const police = game.castNightAction({ userId: 'user-2', targetId: 'host-1' });
  assert.equal(police.type, 'police');
  assert.equal(police.targetIsMafia, true);

  const doctor = game.castNightAction({ userId: 'user-3', targetId: 'user-4' });
  assert.equal(doctor.type, 'doctor');
  assert.equal(doctor.complete, true);

  const result = game.resolveNight();
  assert.equal(result.reason, 'protected');
  assert.equal(result.death, null);
  assert.equal(game.phase, 'day_discussion');
  assert.equal(game.alivePlayers.length, 4);
});

test('유령 직업 공개 옵션은 사망자의 역할 노출 여부를 제어한다', () => {
  const hidden = createGame({ revealGhostRoles: false });
  hidden.castNightAction({ userId: 'host-1', targetId: 'user-4' });
  hidden.castNightAction({ userId: 'user-2', targetId: 'host-1' });
  hidden.castNightAction({ userId: 'user-3', targetId: 'user-3' });
  const hiddenResult = hidden.resolveNight();
  assert.equal(hiddenResult.death.role, null);
  assert.equal(hiddenResult.death.roleLabel, null);

  const revealed = createGame({ revealGhostRoles: true });
  revealed.castNightAction({ userId: 'host-1', targetId: 'user-4' });
  revealed.castNightAction({ userId: 'user-2', targetId: 'host-1' });
  revealed.castNightAction({ userId: 'user-3', targetId: 'user-3' });
  const revealedResult = revealed.resolveNight();
  assert.equal(revealedResult.death.role, MAFIA_ROLES.citizen);
  assert.equal(revealedResult.death.roleLabel, '시민');
});

test('혼합 투표는 공개 자유투표 후보를 찬반투표로 확정하고 마피아 처형 시 시민팀 승리한다', () => {
  const game = createGame();
  advanceToProtectedDay(game);

  game.beginNominationVote();
  game.castNominationVote({ voterId: 'host-1', targetId: 'user-2' });
  game.castNominationVote({ voterId: 'user-2', targetId: 'host-1' });
  game.castNominationVote({ voterId: 'user-3', targetId: 'host-1' });
  game.castNominationVote({ voterId: 'user-4', targetId: 'host-1' });

  const nomination = game.resolveNominationVote();
  assert.equal(nomination.candidate.userId, 'host-1');
  assert.equal(nomination.tally.find((entry) => entry.player.userId === 'host-1').count, 3);
  assert.deepEqual(
    nomination.tally.find((entry) => entry.player.userId === 'host-1').voters.map((voter) => voter.userId),
    ['user-2', 'user-3', 'user-4']
  );
  assert.equal(game.phase, 'approval');

  game.castApprovalVote({ voterId: 'host-1', approve: false });
  game.castApprovalVote({ voterId: 'user-2', approve: true });
  game.castApprovalVote({ voterId: 'user-3', approve: true });
  game.castApprovalVote({ voterId: 'user-4', approve: true });
  const approval = game.resolveApprovalVote();

  assert.equal(approval.executed, true);
  assert.equal(approval.death.player.userId, 'host-1');
  assert.equal(game.phase, 'ended');
  assert.equal(game.winner, 'citizens');
});

test('자유투표 동률 또는 찬반 부결은 추가 자유투표 없이 밤으로 넘어간다', () => {
  const tieGame = createGame();
  advanceToProtectedDay(tieGame);
  tieGame.beginNominationVote();
  tieGame.castNominationVote({ voterId: 'host-1', targetId: 'user-2' });
  tieGame.castNominationVote({ voterId: 'user-2', targetId: 'host-1' });
  tieGame.castNominationVote({ voterId: 'user-3', targetId: 'host-1' });
  tieGame.castNominationVote({ voterId: 'user-4', targetId: 'user-2' });

  const tie = tieGame.resolveNominationVote();
  assert.equal(tie.tie, true);
  assert.equal(tie.candidate, null);
  assert.equal(tieGame.phase, 'night');
  assert.equal(tieGame.nightNumber, 2);

  const rejectGame = createGame();
  advanceToProtectedDay(rejectGame);
  rejectGame.beginNominationVote();
  rejectGame.castNominationVote({ voterId: 'host-1', targetId: 'user-2' });
  rejectGame.castNominationVote({ voterId: 'user-2', targetId: 'host-1' });
  rejectGame.castNominationVote({ voterId: 'user-3', targetId: 'host-1' });
  rejectGame.castNominationVote({ voterId: 'user-4', targetId: 'host-1' });
  rejectGame.resolveNominationVote();
  rejectGame.castApprovalVote({ voterId: 'host-1', approve: false });
  rejectGame.castApprovalVote({ voterId: 'user-2', approve: false });
  rejectGame.castApprovalVote({ voterId: 'user-3', approve: true });
  rejectGame.castApprovalVote({ voterId: 'user-4', approve: true });

  const rejected = rejectGame.resolveApprovalVote();
  assert.equal(rejected.executed, false);
  assert.equal(rejectGame.phase, 'night');
  assert.equal(rejectGame.nightNumber, 2);
});

test('마피아 명령 payload는 시작/상태/종료와 유령 직업 공개 옵션을 등록한다', () => {
  const [payload] = getMafiaCommandPayloads();

  assert.equal(payload.name, '마피아');
  assert.ok(payload.options.some((option) => option.name === '시작'));
  assert.ok(payload.options.some((option) => option.name === '상태'));
  assert.ok(payload.options.some((option) => option.name === '종료'));

  const start = payload.options.find((option) => option.name === '시작');
  assert.ok(start.options.some((option) => option.name === '유령직업공개'));
  assert.ok(start.options.some((option) => option.name === '토론시간'));
  assert.ok(start.options.some((option) => option.name === '투표시간'));
});

test('마피아 명령은 라이어게임식 로비 매칭 후 역할 확인과 공개 혼합 투표를 진행한다', async () => {
  resetMafiaGamesForTest();

  const channel = createChannel();
  const replies = [];
  const updates = [];
  const base = {
    guildId: 'guild-1',
    channelId: 'channel-1',
    channel,
    user: createUser('host-1', '방장')
  };

  await handleMafiaCommand(createSlashInteraction({
    ...base,
    replies,
    options: {
      유령직업공개: true,
      토론시간: 60,
      투표시간: 60
    }
  }), console, {
    collectionMs: 60_000,
    nightActionMs: 60_000,
    roleAssignments: ROLE_ASSIGNMENTS
  });

  assert.match(replies[0].content, /마피아 게임 참가자 모집/);
  assert.match(replies[0].content, /공개 혼합 투표/);
  const lobbyButtons = replies[0].components[0].toJSON().components;
  const joinId = lobbyButtons.find((component) => component.label === '참가').custom_id;
  const startId = lobbyButtons.find((component) => component.label === '방장 시작').custom_id;
  const gameId = startId.split(':')[1];

  for (const user of [createUser('user-2', '둘째'), createUser('user-3', '셋째'), createUser('user-4', '넷째')]) {
    await handleMafiaCommand(createButtonInteraction({ ...base, user, customId: joinId, updates, replies }), console);
  }

  await handleMafiaCommand(createButtonInteraction({ ...base, customId: startId, updates, replies }), console);

  const startPayload = channel.sent.find((payload) => typeof payload === 'object' && payload.content?.includes('마피아 게임 시작'));
  assert.ok(startPayload);
  assert.doesNotMatch(startPayload.content, /host-1.*마피아/);

  const secretId = startPayload.components[0].toJSON().components[0].custom_id;
  await handleMafiaCommand(createButtonInteraction({ ...base, customId: secretId, replies }), console);
  assert.equal(replies.at(-1).flags, MessageFlags.Ephemeral);
  assert.match(replies.at(-1).content, /당신의 역할: 🔪 \*\*마피아\*\*/);

  await handleMafiaCommand(createButtonInteraction({ ...base, customId: `mafia_night:${gameId}:user-4`, replies }), console);
  await handleMafiaCommand(createButtonInteraction({ ...base, user: createUser('user-2', '둘째'), customId: `mafia_night:${gameId}:host-1`, replies }), console);
  await handleMafiaCommand(createButtonInteraction({ ...base, user: createUser('user-3', '셋째'), customId: `mafia_night:${gameId}:user-4`, replies }), console);

  assert.ok(channel.sent.some((payload) => typeof payload === 'object' && payload.content?.includes('밤 결과')));
  assert.ok(channel.sent.some((payload) => typeof payload === 'object' && payload.content?.includes('낮 토론')));

  await handleMafiaCommand(createButtonInteraction({ ...base, customId: `mafia_discuss_done:${gameId}`, updates, replies }), console);
  assert.ok(channel.sent.some((payload) => typeof payload === 'object' && payload.embeds?.[0]?.data?.title?.includes('공개 자유투표')));

  await handleMafiaCommand(createButtonInteraction({ ...base, customId: `mafia_nominate:${gameId}:user-2`, updates, replies }), console);
  for (const user of [createUser('user-2', '둘째'), createUser('user-3', '셋째'), createUser('user-4', '넷째')]) {
    await handleMafiaCommand(createButtonInteraction({ ...base, user, customId: `mafia_nominate:${gameId}:host-1`, updates, replies }), console);
  }

  assert.ok(channel.sent.some((payload) => typeof payload === 'object' && payload.content?.includes('공개 자유투표 결과')));
  assert.ok(channel.sent.some((payload) => typeof payload === 'object' && payload.embeds?.[0]?.data?.title?.includes('공개 찬반투표')));

  await handleMafiaCommand(createButtonInteraction({ ...base, customId: `mafia_approve:${gameId}:no`, updates, replies }), console);
  for (const user of [createUser('user-2', '둘째'), createUser('user-3', '셋째'), createUser('user-4', '넷째')]) {
    await handleMafiaCommand(createButtonInteraction({ ...base, user, customId: `mafia_approve:${gameId}:yes`, updates, replies }), console);
  }

  assert.ok(channel.sent.some((payload) => typeof payload === 'object' && payload.content?.includes('공개 찬반투표 결과')));
  assert.ok(channel.sent.some((payload) => typeof payload === 'object' && payload.content?.includes('시민팀 승리')));

  resetMafiaGamesForTest();
});

function createGame({ revealGhostRoles = false } = {}) {
  return new MafiaGame({
    id: 'mafia-test',
    guildId: 'guild-1',
    channelId: 'channel-1',
    players: PLAYERS,
    revealGhostRoles,
    roleAssignments: ROLE_ASSIGNMENTS,
    now: () => 1_000
  });
}

function advanceToProtectedDay(game) {
  game.castNightAction({ userId: 'host-1', targetId: 'user-4' });
  game.castNightAction({ userId: 'user-2', targetId: 'host-1' });
  game.castNightAction({ userId: 'user-3', targetId: 'user-4' });
  game.resolveNight();
}

function createSlashInteraction({ guildId, channelId, channel, user, replies, options }) {
  return {
    commandName: '마피아',
    guildId,
    channelId,
    channel,
    user,
    isChatInputCommand: () => true,
    isButton: () => false,
    inGuild: () => true,
    options: {
      getSubcommand: () => '시작',
      getBoolean(name) {
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
  return {
    id: 'channel-1',
    sent: [],
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
