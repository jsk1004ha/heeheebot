import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder
} from 'discord.js';
import {
  MAFIA_MAX_PLAYERS,
  MAFIA_MIN_PLAYERS,
  MafiaGame,
  getMafiaRoleDistribution,
  getMafiaRoleLabel
} from '../systems/mafia.js';

export const MAFIA_COLLECTION_MS = 60_000;
export const MAFIA_NIGHT_MS = 45_000;
export const MAFIA_DISCUSSION_MS = 120_000;
export const MAFIA_VOTING_MS = 60_000;

const MAFIA_COLOR = 0x7f1d1d;
const CITIZEN_COLOR = 0x2563eb;
const activeMafiaGamesByChannel = new Map();
const activeMafiaGamesById = new Map();

export const mafiaCommands = [
  new SlashCommandBuilder()
    .setName('마피아게임')
    .setDescription('밤/낮/투표로 진행하는 마피아 추리 게임입니다.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('시작')
        .setDescription('참가자를 모집한 뒤 마피아게임을 시작합니다.')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('상태')
        .setDescription('현재 채널의 마피아게임 상태를 확인합니다.')
    )
];

export function getMafiaCommandPayloads() {
  return mafiaCommands.map((command) => command.toJSON());
}

export function resetMafiaGamesForTest() {
  for (const state of activeMafiaGamesByChannel.values()) {
    clearAllTimers(state);
  }
  activeMafiaGamesByChannel.clear();
  activeMafiaGamesById.clear();
}

export async function handleMafiaCommand(interaction, economy = null, logger = console, options = {}) {
  if (interaction.isButton?.() && interaction.customId?.startsWith('mafia_')) {
    return handleMafiaButton(interaction, economy, logger, options);
  }

  if (!interaction.isChatInputCommand?.() || interaction.commandName !== '마피아게임') {
    return false;
  }

  if (!interaction.inGuild?.()) {
    await interaction.reply({
      content: '서버에서만 사용할 수 있는 명령어입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  const subcommand = interaction.options.getSubcommand();
  if (subcommand === '시작') {
    await createMafiaLobby(interaction, economy, logger, options);
    return true;
  }

  if (subcommand === '상태') {
    await replyWithMafiaStatus(interaction);
    return true;
  }

  return false;
}

async function createMafiaLobby(interaction, economy, logger, options) {
  const key = createChannelKey(interaction.guildId, interaction.channelId);
  if (activeMafiaGamesByChannel.has(key)) {
    await interaction.reply({
      content: '이 채널에서 이미 마피아게임이 모집 또는 진행 중입니다.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  const state = {
    id: createGameId(),
    key,
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    channel: interaction.channel,
    hostUserId: interaction.user.id,
    status: 'collecting',
    participants: new Map(),
    game: null,
    gameChannel: null,
    gameThread: null,
    gameThreadResult: null,
    threadKey: null,
    roleRooms: new Map(),
    roleRoomResults: [],
    collectionMs: options.collectionMs ?? MAFIA_COLLECTION_MS,
    nightMs: options.nightMs ?? MAFIA_NIGHT_MS,
    discussionMs: options.discussionMs ?? MAFIA_DISCUSSION_MS,
    votingMs: options.votingMs ?? MAFIA_VOTING_MS,
    randomInt: options.randomInt,
    collectionTimer: null,
    nightTimer: null,
    discussionTimer: null,
    voteTimer: null,
    voteMessage: null,
    lastNightResult: null,
    lastVoteResult: null
  };

  state.participants.set(interaction.user.id, createHumanParticipant(interaction.user));
  activeMafiaGamesByChannel.set(key, state);
  activeMafiaGamesById.set(state.id, state);
  state.collectionTimer = setManagedTimeout(
    () => beginMafiaGame(state, economy, logger).catch((error) => logger.error(error)),
    state.collectionMs
  );

  await interaction.reply({
    content: formatLobbyMessage(state),
    components: [createLobbyActionRow(state)]
  });
}

async function replyWithMafiaStatus(interaction) {
  const key = createChannelKey(interaction.guildId, interaction.channelId);
  const state = activeMafiaGamesByChannel.get(key);
  if (!state) {
    await interaction.reply({
      content: '이 채널에서 진행 중인 마피아게임이 없습니다.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  await interaction.reply({
    content: formatStatusMessage(state),
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] }
  });
}

async function handleMafiaButton(interaction, economy, logger, options) {
  const [action, gameId, targetId] = interaction.customId.split(':');
  const state = activeMafiaGamesById.get(gameId);

  if (!state || state.guildId !== interaction.guildId || !isMafiaInteractionChannel(state, interaction.channelId)) {
    await interaction.reply({
      content: '이미 종료되었거나 다른 채널의 마피아게임입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (action === 'mafia_role') {
    await replyWithPrivateRole(interaction, state);
    return true;
  }

  if (action === 'mafia_night') {
    await replyWithNightActionPanel(interaction, state);
    return true;
  }

  if (action === 'mafia_action') {
    await handleNightAction(interaction, state, targetId, economy, logger);
    return true;
  }

  if (action === 'mafia_vote') {
    await handleVoteButton(interaction, state, targetId, economy, logger);
    return true;
  }

  if (action === 'mafia_skip') {
    await handleHostSkip(interaction, state, economy, logger);
    return true;
  }

  if (state.status !== 'collecting') {
    await interaction.reply({
      content: '이미 게임이 시작되어 참가자 목록을 바꿀 수 없습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (action === 'mafia_join') {
    if (interaction.user.bot) {
      await interaction.reply({ content: '봇 계정은 참가할 수 없습니다.', flags: MessageFlags.Ephemeral });
      return true;
    }
    if (state.participants.size >= MAFIA_MAX_PLAYERS && !state.participants.has(interaction.user.id)) {
      await interaction.reply({
        content: `마피아게임은 최대 ${MAFIA_MAX_PLAYERS}명까지 참가할 수 있습니다.`,
        flags: MessageFlags.Ephemeral
      });
      return true;
    }

    state.participants.set(interaction.user.id, createHumanParticipant(interaction.user));
    await interaction.update({ content: formatLobbyMessage(state), components: [createLobbyActionRow(state)] });
    return true;
  }

  if (action === 'mafia_leave') {
    if (interaction.user.id === state.hostUserId) {
      await interaction.reply({ content: '방장은 모집 중 나갈 수 없습니다.', flags: MessageFlags.Ephemeral });
      return true;
    }

    state.participants.delete(interaction.user.id);
    await interaction.update({ content: formatLobbyMessage(state), components: [createLobbyActionRow(state)] });
    return true;
  }

  if (action === 'mafia_start') {
    if (interaction.user.id !== state.hostUserId) {
      await interaction.reply({ content: '방장만 바로 시작할 수 있습니다.', flags: MessageFlags.Ephemeral });
      return true;
    }

    await interaction.update({
      content: `${formatLobbyMessage(state)}\n\n▶️ 방장이 모집을 종료했습니다.`,
      components: []
    });
    await beginMafiaGame(state, economy, logger, options);
    return true;
  }

  return false;
}

async function beginMafiaGame(state, economy, logger) {
  if (state.status !== 'collecting') return;
  clearCollectionTimer(state);

  const players = [...state.participants.values()];
  if (players.length < MAFIA_MIN_PLAYERS) {
    await finishCancelledGame(state, `참가자가 최소 ${MAFIA_MIN_PLAYERS}명 필요합니다.`);
    return;
  }

  try {
    state.game = new MafiaGame({ players, randomInt: state.randomInt });
  } catch (error) {
    await finishCancelledGame(state, error.message);
    return;
  }

  state.status = 'starting';
  state.gameThreadResult = await createGamePrivateThread(state, logger);
  state.roleRoomResults = await createSameRolePrivateRooms(state, logger);

  if (state.gameThreadResult.ok && state.gameThread?.id) {
    await state.channel.send({
      content: `🧵 마피아게임 진행 스레드: <#${state.gameThread.id}>\n생존자만 스레드에 남고, 사망자는 자동으로 퇴장됩니다.`,
      allowedMentions: { parse: [] }
    }).catch(() => null);
  }

  await sendGameMessage(state, {
    content: formatStartMessage(state),
    components: [createRoleActionRow(state)]
  });

  await startNightPhase(state, economy, logger);
}

async function finishCancelledGame(state, reason) {
  state.status = 'ended';
  clearAllTimers(state);
  activeMafiaGamesByChannel.delete(state.key);
  if (state.threadKey) activeMafiaGamesByChannel.delete(state.threadKey);
  activeMafiaGamesById.delete(state.id);
  await state.channel.send(`⏹️ 마피아게임 시작 취소: ${reason}`);
}

async function createGamePrivateThread(state, logger) {
  if (typeof state.channel?.threads?.create !== 'function') {
    state.gameChannel = state.channel;
    return { ok: false, error: new Error('비공개 진행 스레드 생성 권한 또는 기능이 없습니다.') };
  }

  try {
    const thread = await state.channel.threads.create({
      name: `마피아게임-${state.id}`.slice(0, 90),
      type: ChannelType.PrivateThread,
      invitable: false,
      reason: '마피아게임 생존자 전용 진행 스레드'
    });

    state.gameThread = thread;
    state.gameChannel = thread;
    state.threadKey = createChannelKey(state.guildId, thread.id);
    activeMafiaGamesByChannel.set(state.threadKey, state);

    for (const player of state.game.players) {
      if (typeof thread.members?.add === 'function') {
        await thread.members.add(player.userId).catch((error) => logger.debug?.('Failed to add mafia player to game thread:', error));
      }
    }

    return { ok: true, threadId: thread.id ?? null, thread };
  } catch (error) {
    logger.debug?.('Failed to create mafia game thread:', error);
    state.gameChannel = state.channel;
    return { ok: false, error };
  }
}

async function createSameRolePrivateRooms(state, logger) {
  const groups = state.game.getRoleGroups({ minSize: 2, aliveOnly: true });
  const results = [];

  for (const group of groups) {
    try {
      const thread = await createPrivateRoleRoom(state, group);
      state.roleRooms.set(group.role, thread);
      results.push({ role: group.role, ok: true, threadId: thread.id ?? null, thread });
    } catch (error) {
      logger.debug?.('Failed to create mafia role room:', error);
      results.push({ role: group.role, ok: false, error });
    }
  }

  return results;
}

async function createPrivateRoleRoom(state, group) {
  if (typeof state.channel?.threads?.create !== 'function') {
    throw new Error('비공개 스레드 생성 권한 또는 기능이 없습니다.');
  }

  const thread = await state.channel.threads.create({
    name: `${group.label} 회의실-${state.id}`.slice(0, 90),
    type: ChannelType.PrivateThread,
    invitable: false,
    reason: '마피아게임 직업별 비공개 회의실'
  });

  for (const player of group.players) {
    if (typeof thread.members?.add === 'function') {
      await thread.members.add(player.userId).catch(() => null);
    }
  }

  if (typeof thread.send === 'function') {
    await thread.send([
      `🔒 **${group.label} 회의실**`,
      `멤버: ${group.players.map(formatPlayerMention).join(', ')}`,
      '게임 중 같은 직업끼리만 대화하세요.'
    ].join('\n')).catch(() => null);
  }

  return thread;
}

async function startNightPhase(state, economy, logger) {
  if (state.status === 'ended') return;
  state.status = 'night';
  state.lastNightResult = null;
  state.game.clearNightActions();
  clearNightTimer(state);

  state.nightTimer = setManagedTimeout(
    () => resolveNightPhase(state, economy, logger, { reason: 'time' }).catch((error) => logger.error(error)),
    state.nightMs
  );

  await sendGameMessage(state, {
    content: formatNightMessage(state),
    components: [createNightActionRow(state)]
  });
}

async function replyWithPrivateRole(interaction, state) {
  const assignment = state.game?.getAssignment(interaction.user.id);
  if (!assignment) {
    await interaction.reply({ content: '참가자만 역할을 확인할 수 있습니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  const lines = [
    '🔒 **마피아게임 비공개 정보**',
    `역할: **${assignment.roleLabel}**`,
    `팀: **${assignment.teamLabel}**`
  ];

  if (assignment.role !== 'citizen' && assignment.sameRolePlayers.length >= 2) {
    const room = state.roleRooms.get(assignment.role);
    lines.push(`같은 직업: ${assignment.sameRolePlayers.map(formatPlayerMention).join(', ')}`);
    if (room?.id) {
      lines.push(`회의실: <#${room.id}>`);
    } else {
      lines.push('회의실: 생성 실패. 같은 직업 목록만 확인하세요.');
    }
  }

  if (assignment.role === 'mafia') lines.push('밤마다 처형 대상을 1명 고릅니다.');
  if (assignment.role === 'police') lines.push('밤마다 1명을 조사합니다.');
  if (assignment.role === 'doctor') lines.push('밤마다 1명을 보호합니다. 자기 보호 가능.');
  if (assignment.role === 'citizen') lines.push('토론과 투표로 마피아를 찾아내세요.');

  await interaction.reply({
    content: lines.join('\n'),
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] }
  });
}

async function replyWithNightActionPanel(interaction, state) {
  if (state.status !== 'night') {
    await interaction.reply({ content: '현재 밤 행동 시간이 아닙니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  const actor = state.game.getPlayer(interaction.user.id);
  if (!actor) {
    await interaction.reply({ content: '참가자만 밤 행동을 할 수 있습니다.', flags: MessageFlags.Ephemeral });
    return;
  }
  if (!actor.alive) {
    await interaction.reply({ content: '사망자는 밤 행동을 할 수 없습니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  const targets = state.game.getNightActionTargets(actor.userId);
  if (targets.length <= 0) {
    await interaction.reply({ content: '이 역할은 지금 제출할 밤 행동이 없습니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.reply({
    content: formatNightActionPrompt(actor),
    components: createNightTargetRows(state, actor, targets),
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] }
  });
}

async function handleNightAction(interaction, state, targetId, economy, logger) {
  if (state.status !== 'night') {
    await interaction.reply({ content: '현재 밤 행동 시간이 아닙니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  const result = state.game.submitNightAction({ actorId: interaction.user.id, targetId });
  if (!result.accepted) {
    await interaction.reply({ content: result.reason, flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.reply({
    content: formatNightActionResult(result),
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] }
  });

  if (result.complete) {
    await resolveNightPhase(state, economy, logger, { reason: 'complete' });
  }
}

async function resolveNightPhase(state, economy, logger, { reason = 'time' } = {}) {
  if (state.status !== 'night') return;
  clearNightTimer(state);
  state.status = 'resolving_night';
  const result = state.game.resolveNight();
  state.lastNightResult = result;

  await sendGameMessage(state, formatNightResultMessage(result, reason));
  await removeDeadPlayersFromPrivateRooms(state, result.killed, logger);

  if (result.win) {
    await finishMafiaGame(state, economy, result.win);
    return;
  }

  await startDiscussionPhase(state, economy, logger);
}

async function startDiscussionPhase(state, economy, logger) {
  if (state.status === 'ended') return;
  state.status = 'discussion';
  clearDiscussionTimer(state);
  state.discussionTimer = setManagedTimeout(
    () => startVotingPhase(state, economy, logger).catch((error) => logger.error(error)),
    state.discussionMs
  );

  await sendGameMessage(state, {
    content: formatDiscussionMessage(state),
    components: [createSkipActionRow(state)]
  });
}

async function startVotingPhase(state, economy, logger) {
  if (!['discussion', 'voting'].includes(state.status)) return;
  state.status = 'voting';
  clearDiscussionTimer(state);
  clearVoteTimer(state);
  state.game.clearVotes();

  state.voteMessage = await sendGameMessage(state, createVoteMessagePayload(state, '처형할 사람에게 투표하세요.'));
  state.voteTimer = setManagedTimeout(
    () => resolveVotingPhase(state, economy, logger, { reason: 'time' }).catch((error) => logger.error(error)),
    state.votingMs
  );
}

async function handleVoteButton(interaction, state, targetId, economy, logger) {
  if (state.status !== 'voting') {
    await interaction.reply({ content: '현재 투표 시간이 아닙니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  const result = state.game.castVote({ voterId: interaction.user.id, targetId });
  if (!result.accepted) {
    await interaction.reply({ content: result.reason, flags: MessageFlags.Ephemeral });
    return;
  }

  const payload = createVoteMessagePayload(state, `${formatPlayerMention(result.voter)}님 투표 완료.`);
  await interaction.update(payload);

  if (result.complete) {
    await resolveVotingPhase(state, economy, logger, { reason: 'complete' });
  }
}

async function resolveVotingPhase(state, economy, logger, { reason = 'time' } = {}) {
  if (state.status !== 'voting') return;
  clearVoteTimer(state);
  state.status = 'resolving_vote';
  await disableVoteMessage(state).catch(() => null);

  const result = state.game.resolveVote();
  state.lastVoteResult = result;

  await sendGameMessage(state, formatVoteResultMessage(result, reason));
  if (result.executed) {
    await removeDeadPlayersFromPrivateRooms(state, [result.executed], logger);
  }
  if (result.win) {
    await finishMafiaGame(state, economy, result.win);
    return;
  }

  state.game.advanceRound();
  await startNightPhase(state, economy, logger);
}

async function handleHostSkip(interaction, state, economy, logger) {
  if (interaction.user.id !== state.hostUserId) {
    await interaction.reply({ content: '방장만 단계를 넘길 수 있습니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (state.status === 'night') {
    await interaction.reply({ content: '⏭️ 밤을 마감합니다.', flags: MessageFlags.Ephemeral });
    await resolveNightPhase(state, economy, logger, { reason: 'host' });
    return;
  }

  if (state.status === 'discussion') {
    await interaction.reply({ content: '⏭️ 토론을 마감하고 투표를 시작합니다.', flags: MessageFlags.Ephemeral });
    await startVotingPhase(state, economy, logger);
    return;
  }

  if (state.status === 'voting') {
    await interaction.reply({ content: '⏭️ 투표를 마감합니다.', flags: MessageFlags.Ephemeral });
    await resolveVotingPhase(state, economy, logger, { reason: 'host' });
    return;
  }

  await interaction.reply({ content: '지금은 넘길 수 있는 단계가 아닙니다.', flags: MessageFlags.Ephemeral });
}

async function finishMafiaGame(state, economy, win) {
  if (state.status === 'ended') return;
  state.status = 'ended';
  clearAllTimers(state);
  activeMafiaGamesByChannel.delete(state.key);
  if (state.threadKey) activeMafiaGamesByChannel.delete(state.threadKey);
  activeMafiaGamesById.delete(state.id);

  const rewards = await awardMafiaRewards(state, economy, win.winner);
  const finishMessage = formatFinishMessage(state, win, rewards);
  await sendGameMessage(state, finishMessage);
  if (state.gameThread && state.gameChannel !== state.channel) {
    await state.channel.send({
      content: finishMessage,
      allowedMentions: { parse: [] }
    }).catch(() => null);
  }
  await cleanupRoleRooms(state);
  await cleanupGameThread(state);
}

async function awardMafiaRewards(state, economy, winner) {
  if (typeof economy?.awardMafiaGameResults !== 'function') return null;

  try {
    return await economy.awardMafiaGameResults({
      guildId: state.guildId,
      participants: state.game.players,
      winner
    });
  } catch (error) {
    return { error, participants: [] };
  }
}

async function removeDeadPlayersFromPrivateRooms(state, players, logger) {
  for (const player of players) {
    const room = state.roleRooms.get(player.role);
    if (typeof room?.members?.remove === 'function') {
      await room.members.remove(player.userId).catch((error) => logger.debug?.('Failed to remove dead mafia player from room:', error));
    }
    if (typeof state.gameThread?.members?.remove === 'function') {
      await state.gameThread.members.remove(player.userId).catch((error) => logger.debug?.('Failed to remove dead mafia player from game thread:', error));
    }
  }
}

async function sendGameMessage(state, payload) {
  const channel = state.gameChannel ?? state.gameThread ?? state.channel;
  return channel.send(payload);
}

async function cleanupRoleRooms(state) {
  for (const room of state.roleRooms.values()) {
    if (typeof room?.setArchived === 'function') {
      await room.setArchived(true, '마피아게임 종료').catch(() => null);
    } else if (typeof room?.delete === 'function') {
      await room.delete('마피아게임 종료').catch(() => null);
    }
  }
  state.roleRooms.clear();
}

async function cleanupGameThread(state) {
  if (typeof state.gameThread?.setArchived === 'function') {
    await state.gameThread.setArchived(true, '마피아게임 종료').catch(() => null);
  }
  state.gameThread = null;
  state.gameChannel = state.channel;
}

function formatLobbyMessage(state) {
  const distribution = safeDistributionText(state.participants.size);
  const participants = [...state.participants.values()]
    .map((participant, index) => `${index + 1}. ${formatPlayerMention(participant)}`)
    .join('\n') || '- 아직 없음';

  return [
    '🕵️ **마피아게임 모집**',
    `인원: **${state.participants.size}/${MAFIA_MAX_PLAYERS}명** · 최소 ${MAFIA_MIN_PLAYERS}명`,
    `역할: ${distribution}`,
    `모집: ${formatSeconds(state.collectionMs)}`,
    '시작 후 생존자 전용 스레드에서 진행됩니다.',
    '',
    participants
  ].join('\n');
}

function formatStartMessage(state) {
  const counts = state.game.roleCounts;
  const roomLine = state.roleRoomResults.length > 0
    ? `회의실: ${state.roleRoomResults.map((result) => `${getMafiaRoleLabel(result.role)} ${result.ok ? '생성' : '실패'}`).join(' · ')}`
    : '회의실: 같은 직업 2명 이상 없음';
  const threadLine = state.gameThreadResult?.ok && state.gameThread?.id
    ? `진행: <#${state.gameThread.id}> · 사망자는 진행 스레드에서 제거`
    : '진행: 스레드 생성 실패 · 사망자 채팅 제한 불가';

  return [
    '🕵️ **마피아게임 시작**',
    `역할: 마피아 ${counts.mafia} / 경찰 ${counts.police} / 의사 ${counts.doctor} / 시민 ${counts.citizen}`,
    threadLine,
    roomLine,
    '아래 버튼으로 본인 역할만 확인하세요.'
  ].join('\n');
}

function formatNightMessage(state) {
  return [
    `🌙 **${state.game.round}일차 밤**`,
    `행동 시간: ${formatSeconds(state.nightMs)}`,
    '마피아/경찰/의사는 **내 밤 행동** 버튼으로 제출.'
  ].join('\n');
}

function formatNightActionPrompt(actor) {
  if (actor.role === 'mafia') return '🔪 처형 대상을 고르세요.';
  if (actor.role === 'police') return '🔎 조사할 대상을 고르세요.';
  if (actor.role === 'doctor') return '💊 보호할 대상을 고르세요.';
  return '밤 행동이 없습니다.';
}

function formatNightActionResult(result) {
  if (result.action === 'investigate') {
    return `🔎 ${formatPlayerMention(result.target)} 조사 결과: **${result.investigation.isMafia ? '마피아' : '마피아 아님'}**`;
  }
  if (result.action === 'protect') {
    return `💊 ${formatPlayerMention(result.target)} 보호 접수.`;
  }
  return `🔪 ${formatPlayerMention(result.target)} 처형 시도 접수.`;
}

function formatNightResultMessage(result, reason) {
  const killed = result.killed.length > 0
    ? result.killed.map((player) => `${formatPlayerMention(player)}(${getMafiaRoleLabel(player.role)})`).join(', ')
    : '없음';
  const blocked = result.blocked.length > 0
    ? `\n보호 성공: ${result.blocked.map(formatPlayerMention).join(', ')}`
    : '';
  const suffix = reason === 'time' ? '시간 종료' : reason === 'host' ? '방장 마감' : '전원 제출';

  return `🌅 **밤 결과** (${suffix})\n사망: ${killed}${blocked}`;
}

function formatDiscussionMessage(state) {
  return [
    `☀️ **${state.game.round}일차 낮 토론**`,
    `토론 시간: ${formatSeconds(state.discussionMs)}`,
    `생존: ${state.game.livingPlayers.map(formatPlayerMention).join(', ')}`
  ].join('\n');
}

function createVoteMessagePayload(state, description, disabled = false) {
  const embed = new EmbedBuilder()
    .setColor(CITIZEN_COLOR)
    .setTitle(`🗳️ ${state.game.round}일차 투표`)
    .setDescription(description)
    .setFooter({ text: `과반 ${Math.floor(state.game.livingPlayers.length / 2) + 1}표 필요` });

  for (const entry of state.game.getVoteCounts()) {
    embed.addFields({
      name: formatPlayerName(entry.player),
      value: `${entry.count.toLocaleString()}표`,
      inline: true
    });
  }

  return {
    embeds: [embed],
    components: createVoteRows(state, disabled)
  };
}

function formatVoteResultMessage(result, reason) {
  const suffix = reason === 'time' ? '시간 종료' : reason === 'host' ? '방장 마감' : '전원 투표';
  if (result.executed) {
    return `⚖️ **투표 결과** (${suffix})\n처형: ${formatPlayerMention(result.executed)} (${getMafiaRoleLabel(result.executed.role)})`;
  }

  const reasonText = result.reason === 'tie' ? '동률' : '과반 실패';
  return `⚖️ **투표 결과** (${suffix})\n처형 없음: ${reasonText}`;
}

function formatFinishMessage(state, win, rewards) {
  const winnerText = win.winner === 'mafia' ? '마피아 승리' : '시민 팀 승리';
  const alive = state.game.livingPlayers.map((player) => `${formatPlayerMention(player)}(${getMafiaRoleLabel(player.role)})`).join(', ') || '없음';

  return [
    '🏁 **마피아게임 종료**',
    `승리: **${winnerText}**`,
    win.reason,
    `생존: ${alive}`,
    '',
    '보상:',
    formatMafiaRewards(rewards)
  ].join('\n');
}

function formatMafiaRewards(rewards) {
  if (rewards?.error) return `- 보상 오류: ${rewards.error.message}`;
  if (!rewards?.participants?.length) return '- 보상 지급 없음';

  return rewards.participants.map((result) => {
    const money = result.moneyGained > 0 ? ` / +${result.moneyGained.toLocaleString()}골드` : '';
    const level = result.leveledUp ? ` / Lv.${result.profile.level}` : '';
    return `- <@${result.userId}> (${getMafiaRoleLabel(result.role)}): +${result.xpGained.toLocaleString()} XP${money}${level}`;
  }).join('\n');
}

function formatStatusMessage(state) {
  const statusLabel = {
    collecting: '모집',
    starting: '시작 준비',
    night: '밤',
    discussion: '낮 토론',
    voting: '투표',
    ended: '종료'
  }[state.status] ?? state.status;

  if (!state.game) {
    return `🕵️ 마피아게임 상태: **${statusLabel}**\n참가자 ${state.participants.size}명`;
  }

  return [
    `🕵️ 마피아게임 상태: **${statusLabel}**`,
    state.gameThread?.id ? `진행 스레드: <#${state.gameThread.id}>` : null,
    `${state.game.round}일차 · 생존 ${state.game.livingPlayers.length}명`,
    state.game.livingPlayers.map(formatPlayerMention).join(', ')
  ].filter(Boolean).join('\n');
}

function safeDistributionText(count) {
  try {
    const distribution = getMafiaRoleDistribution(Math.max(count, MAFIA_MIN_PLAYERS));
    return `마피아 ${distribution.mafia} / 경찰 ${distribution.police} / 의사 ${distribution.doctor}`;
  } catch {
    return '자동';
  }
}

function createLobbyActionRow(state) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`mafia_join:${state.id}`).setLabel('참가').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`mafia_start:${state.id}`).setLabel('방장 시작').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`mafia_leave:${state.id}`).setLabel('나가기').setStyle(ButtonStyle.Secondary)
  );
}

function createRoleActionRow(state) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`mafia_role:${state.id}`).setLabel('내 역할 보기').setStyle(ButtonStyle.Primary).setEmoji('🔒')
  );
}

function createNightActionRow(state) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`mafia_night:${state.id}`).setLabel('내 밤 행동').setStyle(ButtonStyle.Danger).setEmoji('🌙'),
    new ButtonBuilder().setCustomId(`mafia_role:${state.id}`).setLabel('내 역할').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`mafia_skip:${state.id}`).setLabel('방장 스킵').setStyle(ButtonStyle.Primary)
  );
}

function createSkipActionRow(state) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`mafia_skip:${state.id}`).setLabel('방장 스킵').setStyle(ButtonStyle.Primary)
  );
}

function createNightTargetRows(state, actor, targets) {
  const rows = [];
  const style = actor.role === 'mafia'
    ? ButtonStyle.Danger
    : actor.role === 'doctor'
      ? ButtonStyle.Success
      : ButtonStyle.Primary;

  for (let index = 0; index < targets.length; index += 5) {
    rows.push(new ActionRowBuilder().addComponents(
      ...targets.slice(index, index + 5).map((target) =>
        new ButtonBuilder()
          .setCustomId(`mafia_action:${state.id}:${target.userId}`)
          .setLabel(formatPlayerName(target).slice(0, 80))
          .setStyle(style)
      )
    ));
  }

  return rows;
}

function createVoteRows(state, disabled = false) {
  const rows = [];
  const living = state.game.livingPlayers;
  for (let index = 0; index < living.length; index += 5) {
    rows.push(new ActionRowBuilder().addComponents(
      ...living.slice(index, index + 5).map((player) =>
        new ButtonBuilder()
          .setCustomId(`mafia_vote:${state.id}:${player.userId}`)
          .setLabel(formatPlayerName(player).slice(0, 80))
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled)
      )
    ));
  }

  if (!disabled && rows.length < 5) rows.push(createSkipActionRow(state));
  return rows.slice(0, 5);
}

async function disableVoteMessage(state) {
  if (typeof state.voteMessage?.edit !== 'function') return;
  await state.voteMessage.edit(createVoteMessagePayload(state, '투표가 마감되었습니다.', true));
}

function createHumanParticipant(user) {
  return { userId: user.id, username: user.username, bot: false };
}

function formatPlayerMention(player) {
  return `<@${player.userId}>`;
}

function formatPlayerName(player) {
  return player.username || player.userId;
}

function createChannelKey(guildId, channelId) {
  return `${guildId}:${channelId}`;
}

function isMafiaInteractionChannel(state, channelId) {
  const normalizedChannelId = String(channelId ?? '');
  return normalizedChannelId === state.channelId || normalizedChannelId === state.gameThread?.id;
}

function createGameId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatSeconds(ms) {
  return `${Math.ceil(ms / 1000)}초`;
}

function setManagedTimeout(callback, ms) {
  const timer = setTimeout(callback, ms);
  timer.unref?.();
  return timer;
}

function clearCollectionTimer(state) {
  clearTimeout(state.collectionTimer);
  state.collectionTimer = null;
}

function clearNightTimer(state) {
  clearTimeout(state.nightTimer);
  state.nightTimer = null;
}

function clearDiscussionTimer(state) {
  clearTimeout(state.discussionTimer);
  state.discussionTimer = null;
}

function clearVoteTimer(state) {
  clearTimeout(state.voteTimer);
  state.voteTimer = null;
}

function clearAllTimers(state) {
  clearCollectionTimer(state);
  clearNightTimer(state);
  clearDiscussionTimer(state);
  clearVoteTimer(state);
}
