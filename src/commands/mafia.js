import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder
} from 'discord.js';
import {
  MAFIA_MAX_PLAYERS,
  MAFIA_MIN_PLAYERS,
  MAFIA_ROLES,
  MafiaGame,
  formatMafiaRoleEmoji,
  formatMafiaRoleLabel
} from '../systems/mafia.js';

export const MAFIA_COLLECTION_MS = 60_000;
export const MAFIA_NIGHT_ACTION_MS = 60_000;
export const MAFIA_DAY_DISCUSSION_MS = 90_000;
export const MAFIA_VOTING_MS = 45_000;

const MAFIA_COLOR = 0x991b1b;
const CITIZEN_COLOR = 0x2563eb;
const NEUTRAL_COLOR = 0x64748b;
const activeMafiaGamesByChannel = new Map();
const activeMafiaGamesById = new Map();

export const mafiaCommands = [
  new SlashCommandBuilder()
    .setName('마피아')
    .setDescription('로비 매칭, 밤 능력, 공개 혼합 투표로 마피아 게임을 진행합니다.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('시작')
        .setDescription('1분 동안 참가자를 모집한 뒤 마피아 게임을 시작합니다.')
        .addBooleanOption((option) =>
          option
            .setName('유령직업공개')
            .setDescription('사망자의 직업을 공개할지 선택합니다. 기본값은 비공개입니다.')
        )
        .addIntegerOption((option) =>
          option
            .setName('토론시간')
            .setDescription('낮 토론 시간(초). 기본 90초')
            .setMinValue(15)
            .setMaxValue(300)
        )
        .addIntegerOption((option) =>
          option
            .setName('투표시간')
            .setDescription('자유투표/찬반투표 제한 시간(초). 기본 45초')
            .setMinValue(15)
            .setMaxValue(180)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('상태')
        .setDescription('현재 채널의 마피아 모집/게임 상태를 확인합니다.')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('종료')
        .setDescription('방장이 현재 채널의 마피아 게임을 종료합니다.')
    )
];

export function getMafiaCommandPayloads() {
  return mafiaCommands.map((command) => command.toJSON());
}

export async function handleMafiaCommand(interaction, logger = console, options = {}) {
  if (interaction.isButton?.() && interaction.customId?.startsWith('mafia_')) {
    return handleMafiaButton(interaction, logger, options);
  }

  if (!interaction.isChatInputCommand?.() || interaction.commandName !== '마피아') {
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

  try {
    if (subcommand === '시작') {
      await createMafiaLobby(interaction, logger, options);
      return true;
    }

    if (subcommand === '상태') {
      await replyWithMafiaStatus(interaction);
      return true;
    }

    if (subcommand === '종료') {
      await endMafiaSessionFromCommand(interaction);
      return true;
    }
  } catch (error) {
    logger.debug?.('Mafia command rejected:', error);
    await interaction.reply({
      content: `마피아 처리 실패: ${error.message}`,
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] }
    });
    return true;
  }

  return false;
}

export function resetMafiaGamesForTest() {
  for (const state of activeMafiaGamesByChannel.values()) {
    clearAllTimers(state);
  }
  activeMafiaGamesByChannel.clear();
  activeMafiaGamesById.clear();
}

async function createMafiaLobby(interaction, logger, options) {
  const key = createChannelKey(interaction.guildId, interaction.channelId);

  if (activeMafiaGamesByChannel.has(key)) {
    await interaction.reply({
      content: '이 채널에서 이미 마피아 모집 또는 게임이 진행 중입니다.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  const votingMs = secondsOptionToMs(interaction.options.getInteger?.('투표시간'), MAFIA_VOTING_MS);
  const state = {
    id: createGameId(),
    key,
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    channel: interaction.channel,
    status: 'collecting',
    hostUserId: interaction.user.id,
    revealGhostRoles: interaction.options.getBoolean?.('유령직업공개') ?? options.revealGhostRoles ?? false,
    participants: new Map(),
    collectionMs: options.collectionMs ?? MAFIA_COLLECTION_MS,
    nightActionMs: options.nightActionMs ?? votingMs,
    discussionMs: secondsOptionToMs(interaction.options.getInteger?.('토론시간'), options.discussionMs ?? MAFIA_DAY_DISCUSSION_MS),
    votingMs,
    randomInt: options.randomInt,
    roleAssignments: options.roleAssignments ?? null,
    collectionTimer: null,
    nightTimer: null,
    discussionTimer: null,
    nominationTimer: null,
    approvalTimer: null,
    nightMessage: null,
    discussionMessage: null,
    nominationMessage: null,
    approvalMessage: null,
    resolvingNight: false,
    resolvingNomination: false,
    resolvingApproval: false,
    game: null
  };

  state.participants.set(interaction.user.id, createHumanParticipant(interaction.user));
  activeMafiaGamesByChannel.set(key, state);
  activeMafiaGamesById.set(state.id, state);

  state.collectionTimer = setManagedTimeout(
    () => beginMafiaGame(state, logger).catch((error) => logger.error(error)),
    state.collectionMs
  );

  await interaction.reply({
    content: formatMafiaLobbyMessage(state),
    components: [createLobbyActionRow(state)],
    allowedMentions: { parse: [] }
  });
}

async function handleMafiaButton(interaction, logger, options) {
  const [action, gameId, value] = interaction.customId.split(':');
  const state = activeMafiaGamesById.get(gameId);

  if (!state || state.guildId !== interaction.guildId || state.channelId !== interaction.channelId) {
    await interaction.reply({
      content: '이미 종료되었거나 다른 채널의 마피아 게임입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (action === 'mafia_secret') {
    await replyWithPrivateRole(interaction, state);
    return true;
  }

  if (action === 'mafia_night') {
    await handleNightActionButton(interaction, state, value, logger);
    return true;
  }

  if (action === 'mafia_discuss_done') {
    await handleDiscussionDoneButton(interaction, state, logger);
    return true;
  }

  if (action === 'mafia_nominate') {
    await handleNominationButton(interaction, state, value, logger);
    return true;
  }

  if (action === 'mafia_approve') {
    await handleApprovalButton(interaction, state, value, logger);
    return true;
  }

  if (state.status !== 'collecting') {
    await interaction.reply({
      content: '이미 게임이 시작되어 참가자 목록을 바꿀 수 없습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (interaction.user.bot) {
    await interaction.reply({
      content: '봇 계정은 참가할 수 없습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (action === 'mafia_join') {
    if (state.participants.size >= MAFIA_MAX_PLAYERS && !state.participants.has(interaction.user.id)) {
      await interaction.reply({
        content: `마피아 게임은 최대 ${MAFIA_MAX_PLAYERS}명까지 참가할 수 있습니다.`,
        flags: MessageFlags.Ephemeral
      });
      return true;
    }

    state.participants.set(interaction.user.id, createHumanParticipant(interaction.user));
    await interaction.update({
      content: formatMafiaLobbyMessage(state),
      components: [createLobbyActionRow(state)],
      allowedMentions: { parse: [] }
    });
    return true;
  }

  if (action === 'mafia_leave') {
    if (interaction.user.id === state.hostUserId) {
      await interaction.reply({
        content: '방장은 모집 중 나갈 수 없습니다. 게임을 종료한 뒤 다시 시작해주세요.',
        flags: MessageFlags.Ephemeral
      });
      return true;
    }

    state.participants.delete(interaction.user.id);
    await interaction.update({
      content: formatMafiaLobbyMessage(state),
      components: [createLobbyActionRow(state)],
      allowedMentions: { parse: [] }
    });
    return true;
  }

  if (action === 'mafia_start') {
    if (interaction.user.id !== state.hostUserId) {
      await interaction.reply({
        content: '방장만 모집 시간을 건너뛰고 바로 시작할 수 있습니다.',
        flags: MessageFlags.Ephemeral
      });
      return true;
    }

    await interaction.update({
      content: `${formatMafiaLobbyMessage(state)}\n\n▶️ 방장이 모집을 종료하고 게임을 바로 시작했습니다.`,
      components: [],
      allowedMentions: { parse: [] }
    });
    await beginMafiaGame(state, logger, options);
    return true;
  }

  return false;
}

async function beginMafiaGame(state, logger) {
  if (state.status !== 'collecting') return;

  clearCollectionTimer(state);

  const players = [...state.participants.values()];
  if (players.length < MAFIA_MIN_PLAYERS) {
    state.status = 'ended';
    clearAllTimers(state);
    activeMafiaGamesByChannel.delete(state.key);
    activeMafiaGamesById.delete(state.id);
    await state.channel.send(`⏹️ 마피아 게임 시작 취소: 참가자가 최소 ${MAFIA_MIN_PLAYERS}명 필요합니다.`);
    return;
  }

  try {
    state.game = new MafiaGame({
      id: state.id,
      guildId: state.guildId,
      channelId: state.channelId,
      players,
      revealGhostRoles: state.revealGhostRoles,
      roleAssignments: state.roleAssignments,
      randomInt: state.randomInt
    });
  } catch (error) {
    state.status = 'ended';
    clearAllTimers(state);
    activeMafiaGamesByChannel.delete(state.key);
    activeMafiaGamesById.delete(state.id);
    await state.channel.send(`⏹️ 마피아 게임 시작 취소: ${error.message}`);
    return;
  }

  state.status = 'playing';
  await state.channel.send({
    content: formatMafiaStartMessage(state),
    components: [createSecretActionRow(state)],
    allowedMentions: { parse: [] }
  });
  await startNightPhase(state, logger);
}

async function handleNightActionButton(interaction, state, targetId, logger) {
  if (state.status !== 'playing' || state.game?.phase !== 'night') {
    await interaction.reply({
      content: '현재 밤 행동 시간이 아닙니다.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  try {
    const result = state.game.castNightAction({
      userId: interaction.user.id,
      targetId
    });

    await interaction.reply({
      content: formatNightActionReply(result),
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] }
    });

    if (result.complete) {
      await resolveNightAndStartDay(state, logger);
    }
  } catch (error) {
    await interaction.reply({
      content: error.message,
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] }
    });
  }
}

async function handleDiscussionDoneButton(interaction, state, logger) {
  if (state.status !== 'playing' || state.game?.phase !== 'day_discussion') {
    await interaction.reply({
      content: '현재 낮 토론 시간이 아닙니다.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (interaction.user.id !== state.hostUserId) {
    await interaction.reply({
      content: '방장만 토론을 마감하고 자유투표를 시작할 수 있습니다.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  clearDiscussionTimer(state);
  await interaction.update({
    content: `${formatDayDiscussionMessage(state)}\n\n▶️ 방장이 토론을 마감하고 자유투표를 시작했습니다.`,
    components: [],
    allowedMentions: { parse: [] }
  });
  await startNominationVote(state, logger);
}

async function handleNominationButton(interaction, state, targetId, logger) {
  if (state.status !== 'playing' || state.game?.phase !== 'nomination') {
    await interaction.reply({
      content: '현재 자유투표 시간이 아닙니다.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (state.nominationMessage?.id && interaction.message?.id && interaction.message.id !== state.nominationMessage.id) {
    await interaction.reply({
      content: '이전 자유투표 메시지입니다. 최신 투표 메시지에서 선택해주세요.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  try {
    const result = state.game.castNominationVote({
      voterId: interaction.user.id,
      targetId
    });

    await interaction.update(createNominationVotePayload(state, {
      description: result.complete
        ? `${formatPlayerMention(result.voter)}님까지 전원이 공개 자유투표를 마쳤습니다. 즉시 개표합니다.`
        : `${formatPlayerMention(result.voter)} → ${formatPlayerMention(result.target)} 공개 투표. 마감 전까지 변경할 수 있습니다.`
    }));

    if (result.complete) {
      await resolveNominationVote(state, logger);
    }
  } catch (error) {
    await interaction.reply({
      content: error.message,
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] }
    });
  }
}

async function handleApprovalButton(interaction, state, value, logger) {
  if (state.status !== 'playing' || state.game?.phase !== 'approval') {
    await interaction.reply({
      content: '현재 찬반투표 시간이 아닙니다.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (state.approvalMessage?.id && interaction.message?.id && interaction.message.id !== state.approvalMessage.id) {
    await interaction.reply({
      content: '이전 찬반투표 메시지입니다. 최신 투표 메시지에서 선택해주세요.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  try {
    const result = state.game.castApprovalVote({
      voterId: interaction.user.id,
      approve: value === 'yes'
    });

    await interaction.update(createApprovalVotePayload(state, {
      description: result.complete
        ? `${formatPlayerMention(result.voter)}님까지 전원이 공개 찬반투표를 마쳤습니다. 즉시 개표합니다.`
        : `${formatPlayerMention(result.voter)}님이 **${result.approve ? '찬성' : '반대'}**에 공개 투표했습니다. 마감 전까지 변경할 수 있습니다.`
    }));

    if (result.complete) {
      await resolveApprovalVote(state, logger);
    }
  } catch (error) {
    await interaction.reply({
      content: error.message,
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] }
    });
  }
}

async function startNightPhase(state, logger) {
  if (state.status !== 'playing' || state.game?.phase !== 'night') return;

  clearNightTimer(state);
  state.nightMessage = await state.channel.send(createNightActionPayload(state));
  state.nightTimer = setManagedTimeout(
    () => resolveNightAndStartDay(state, logger).catch((error) => logger.error(error)),
    state.nightActionMs
  );
}

async function resolveNightAndStartDay(state, logger) {
  if (state.resolvingNight || state.status !== 'playing' || state.game?.phase !== 'night') return;
  state.resolvingNight = true;

  try {
    clearNightTimer(state);
    await disableNightMessage(state).catch((error) => logger.debug?.('Failed to disable mafia night message:', error));
    const result = state.game.resolveNight();
    await state.channel.send({
      content: formatNightResultMessage(state, result),
      allowedMentions: { parse: [] }
    });

    if (state.game.phase === 'ended') {
      await finishMafiaGame(state);
      return;
    }

    await startDayDiscussion(state, logger);
  } finally {
    state.resolvingNight = false;
  }
}

async function startDayDiscussion(state, logger) {
  if (state.status !== 'playing' || state.game?.phase !== 'day_discussion') return;

  clearDiscussionTimer(state);
  state.discussionMessage = await state.channel.send({
    content: formatDayDiscussionMessage(state),
    components: [createDiscussionActionRow(state)],
    allowedMentions: { parse: [] }
  });
  state.discussionTimer = setManagedTimeout(
    () => startNominationVote(state, logger).catch((error) => logger.error(error)),
    state.discussionMs
  );
}

async function startNominationVote(state, logger) {
  if (state.status !== 'playing' || state.game?.phase !== 'day_discussion') return;

  clearDiscussionTimer(state);
  await disableDiscussionMessage(state).catch((error) => logger.debug?.('Failed to disable mafia discussion message:', error));
  state.game.beginNominationVote();
  state.nominationMessage = await state.channel.send(createNominationVotePayload(state, {
    description: `처형 후보를 먼저 정하는 **공개 자유투표**입니다. ${formatSeconds(state.votingMs)} 안에 의심되는 생존자를 선택하세요.`
  }));
  state.nominationTimer = setManagedTimeout(
    () => resolveNominationVote(state, logger).catch((error) => logger.error(error)),
    state.votingMs
  );
}

async function resolveNominationVote(state, logger) {
  if (state.resolvingNomination || state.status !== 'playing' || state.game?.phase !== 'nomination') return;
  state.resolvingNomination = true;

  try {
    clearNominationTimer(state);
    await disableNominationMessage(state).catch((error) => logger.debug?.('Failed to disable mafia nomination message:', error));
    const result = state.game.resolveNominationVote();
    await state.channel.send({
      content: formatNominationResultMessage(result),
      allowedMentions: { parse: [] }
    });

    if (state.game.phase === 'approval') {
      await startApprovalVote(state, logger);
      return;
    }

    if (state.game.phase === 'ended') {
      await finishMafiaGame(state);
      return;
    }

    await startNightPhase(state, logger);
  } finally {
    state.resolvingNomination = false;
  }
}

async function startApprovalVote(state, logger) {
  if (state.status !== 'playing' || state.game?.phase !== 'approval') return;

  clearApprovalTimer(state);
  state.approvalMessage = await state.channel.send(createApprovalVotePayload(state, {
    description: `자유투표 후보를 실제로 처형할지 정하는 **공개 찬반투표**입니다. ${formatSeconds(state.votingMs)} 안에 찬성/반대를 선택하세요.`
  }));
  state.approvalTimer = setManagedTimeout(
    () => resolveApprovalVote(state, logger).catch((error) => logger.error(error)),
    state.votingMs
  );
}

async function resolveApprovalVote(state, logger) {
  if (state.resolvingApproval || state.status !== 'playing' || state.game?.phase !== 'approval') return;
  state.resolvingApproval = true;

  try {
    clearApprovalTimer(state);
    await disableApprovalMessage(state).catch((error) => logger.debug?.('Failed to disable mafia approval message:', error));
    const result = state.game.resolveApprovalVote();
    await state.channel.send({
      content: formatApprovalResultMessage(result),
      allowedMentions: { parse: [] }
    });

    if (state.game.phase === 'ended') {
      await finishMafiaGame(state);
      return;
    }

    await startNightPhase(state, logger);
  } finally {
    state.resolvingApproval = false;
  }
}

async function replyWithPrivateRole(interaction, state) {
  const assignment = state.game?.getAssignment(interaction.user.id);

  if (!assignment) {
    await interaction.reply({
      content: '이 마피아 게임의 참가자만 역할을 확인할 수 있습니다.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  await interaction.reply({
    content: formatPrivateRoleMessage(assignment),
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] }
  });
}

async function replyWithMafiaStatus(interaction) {
  const state = activeMafiaGamesByChannel.get(createChannelKey(interaction.guildId, interaction.channelId));
  await interaction.reply({
    content: state ? formatMafiaStatus(state) : '이 채널에는 마피아 모집 또는 게임이 없습니다. `/마피아 시작`으로 방을 만들 수 있습니다.',
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] }
  });
}

async function endMafiaSessionFromCommand(interaction) {
  const state = activeMafiaGamesByChannel.get(createChannelKey(interaction.guildId, interaction.channelId));

  if (!state) {
    await interaction.reply({
      content: '이 채널에는 종료할 마피아 게임이 없습니다.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (state.hostUserId !== interaction.user.id) {
    await interaction.reply({
      content: '방장만 마피아 게임을 종료할 수 있습니다.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  state.game?.end('cancelled');
  clearAllTimers(state);
  activeMafiaGamesByChannel.delete(state.key);
  activeMafiaGamesById.delete(state.id);
  state.status = 'ended';

  await interaction.reply({
    content: '⏹️ 마피아 게임을 종료했습니다.',
    allowedMentions: { parse: [] }
  });
}

async function finishMafiaGame(state) {
  state.status = 'ended';
  clearAllTimers(state);
  activeMafiaGamesByChannel.delete(state.key);
  activeMafiaGamesById.delete(state.id);

  await state.channel.send({
    content: formatFinishMessage(state),
    allowedMentions: { parse: [] }
  });
}

function formatMafiaLobbyMessage(state) {
  const participants = [...state.participants.values()]
    .map((participant, index) => `${index + 1}. ${formatPlayerMention(participant)}`)
    .join('\n') || '- 아직 없음';

  return [
    '🔪 **마피아 게임 참가자 모집**',
    `인원: **${MAFIA_MIN_PLAYERS}~${MAFIA_MAX_PLAYERS}명**`,
    `모집 시간: **${formatSeconds(state.collectionMs)}**`,
    `사망자 직업 공개: **${state.revealGhostRoles ? '공개' : '비공개'}**`,
    `투표: **공개 혼합 투표** — 자유투표로 후보를 뽑고, 찬반투표로 처형 여부를 확정합니다.`,
    '동률/부결 처리: 자유투표 동률 또는 찬반 부결이면 그날 처형 없이 밤으로 넘어갑니다.',
    '방장 시작: 모집 시간이 끝나기 전에도 **방장 시작** 버튼으로 바로 시작 가능',
    '',
    `참가자 (${state.participants.size}명):`,
    participants
  ].join('\n');
}

function formatMafiaStartMessage(state) {
  const counts = state.game.roleCounts;
  const players = state.game.players
    .map((player, index) => `${index + 1}. ${formatPlayerMention(player)}`)
    .join('\n');

  return [
    '🔪 **마피아 게임 시작!**',
    `역할 구성: 마피아 ${counts.mafia}명 / 경찰 ${counts.police}명 / 의사 ${counts.doctor}명 / 시민 ${counts.citizen}명`,
    `사망자 직업 공개: **${state.revealGhostRoles ? '공개' : '비공개'}**`,
    '',
    '아래 **내 역할 보기** 버튼을 눌러 본인에게만 보이는 역할을 확인하세요.',
    '게임은 밤부터 시작합니다. 마피아는 시민팀을 제거하고, 시민팀은 낮 재판으로 모든 마피아를 찾아내야 합니다.',
    '',
    '참가자:',
    players
  ].join('\n');
}

function formatPrivateRoleMessage(assignment) {
  const lines = [
    '🔒 **마피아 게임 비공개 정보**',
    `당신의 역할: ${assignment.roleEmoji} **${assignment.roleLabel}**`
  ];

  if (assignment.role === MAFIA_ROLES.mafia) {
    lines.push('승리 조건: 마피아 수가 시민팀 수 이상이 되면 승리합니다.');
    lines.push(`마피아 팀: ${assignment.mafiaTeammates.map(formatPlayerMention).join(', ')}`);
    lines.push('밤마다 제거할 시민팀 대상을 선택하세요. 마피아끼리 표가 갈리면 마지막 제출된 동률 표가 우선됩니다.');
  } else if (assignment.role === MAFIA_ROLES.police) {
    lines.push('승리 조건: 모든 마피아를 처형하면 시민팀 승리입니다.');
    lines.push('밤마다 한 명을 조사해 마피아 여부를 본인에게만 확인합니다.');
  } else if (assignment.role === MAFIA_ROLES.doctor) {
    lines.push('승리 조건: 모든 마피아를 처형하면 시민팀 승리입니다.');
    lines.push('밤마다 한 명을 치료해 마피아의 습격에서 보호합니다. 자기 자신도 선택할 수 있습니다.');
  } else {
    lines.push('승리 조건: 모든 마피아를 처형하면 시민팀 승리입니다.');
    lines.push('낮 토론과 공개 투표로 세력 구도를 읽고 마피아를 찾아내세요.');
  }

  return lines.join('\n');
}

function formatMafiaStatus(state) {
  if (state.status === 'collecting') return formatMafiaLobbyMessage(state);

  const game = state.game;
  const alive = game.alivePlayers.map(formatPlayerMention).join(', ') || '없음';
  const dead = game.deadPlayers.map((player) => {
    const role = state.revealGhostRoles ? ` (${formatMafiaRoleLabel(player.role)})` : '';
    return `${formatPlayerMention(player)}${role}`;
  }).join(', ') || '없음';

  return [
    '🔪 **마피아 게임 상태**',
    `단계: **${formatPhase(game.phase)}**`,
    `밤/낮: ${game.nightNumber}번째 밤 · ${game.dayNumber}번째 낮`,
    `사망자 직업 공개: **${state.revealGhostRoles ? '공개' : '비공개'}**`,
    `생존자 (${game.alivePlayers.length}명): ${alive}`,
    `사망자 (${game.deadPlayers.length}명): ${dead}`
  ].join('\n');
}

function createNightActionPayload(state, disabled = false) {
  return {
    content: [
      `🌙 **${state.game.nightNumber}번째 밤**`,
      `마피아/경찰/의사는 ${formatSeconds(state.nightActionMs)} 안에 대상 버튼을 선택하세요. 시민은 행동 없이 대기합니다.`,
      '역할에 맞지 않는 대상 선택은 본인에게만 거절됩니다.'
    ].join('\n'),
    components: createTargetRows({
      state,
      prefix: 'mafia_night',
      players: state.game.alivePlayers,
      disabled
    }),
    allowedMentions: { parse: [] }
  };
}

function formatNightActionReply(result) {
  if (result.type === 'mafia') {
    return `🔪 마피아 습격 대상을 ${formatPlayerMention(result.target)}님으로 선택했습니다.`;
  }

  if (result.type === 'police') {
    return `🔎 조사 결과: ${formatPlayerMention(result.target)}님은 **${result.targetIsMafia ? '마피아' : '마피아가 아닙니다'}**.`;
  }

  if (result.type === 'doctor') {
    return `💊 치료 대상을 ${formatPlayerMention(result.target)}님으로 선택했습니다.`;
  }

  return '밤 행동을 접수했습니다.';
}

function formatNightResultMessage(state, result) {
  const lines = [
    `☀️ **${result.nightNumber}번째 밤 결과**`
  ];

  if (result.reason === 'protected') {
    lines.push('밤사이 누군가 습격당했지만 의사의 치료로 살아났습니다.');
  } else if (result.death) {
    lines.push(`${formatDeathLine(result.death)} 밤에 사망했습니다.`);
  } else {
    lines.push('밤사이 아무도 사망하지 않았습니다.');
  }

  lines.push(`현재 생존자: ${state.game.alivePlayers.map(formatPlayerMention).join(', ') || '없음'}`);
  return lines.join('\n');
}

function formatDayDiscussionMessage(state) {
  return [
    `☀️ **${state.game.dayNumber}번째 낮 토론**`,
    `${formatSeconds(state.discussionMs)} 동안 토론하세요. 토론이 끝나면 방장이 바로 자유투표를 시작할 수 있습니다.`,
    '낮 재판은 **공개 자유투표 → 공개 찬반투표** 순서로 진행됩니다.'
  ].join('\n');
}

function createNominationVotePayload(state, { description }, disabled = false) {
  const tally = state.game.getNominationTally();
  const embed = new EmbedBuilder()
    .setColor(MAFIA_COLOR)
    .setTitle(`🗳️ ${state.game.dayNumber}번째 낮 — 1차 공개 자유투표`)
    .setDescription(description)
    .setFooter({ text: `투표자 ${state.game.nominationVotes.size.toLocaleString()}명 / 생존자 ${state.game.alivePlayers.length.toLocaleString()}명` });

  for (const entry of tally) {
    embed.addFields({
      name: formatPlayerName(entry.player),
      value: [
        `득표 **${entry.count.toLocaleString()}표**`,
        `투표자: ${formatVoterList(entry.voters)}`
      ].join('\n'),
      inline: false
    });
  }

  return {
    embeds: [embed],
    components: createTargetRows({
      state,
      prefix: 'mafia_nominate',
      players: state.game.alivePlayers,
      disabled
    }),
    allowedMentions: { parse: [] }
  };
}

function formatNominationResultMessage(result) {
  const lines = [
    '📊 **공개 자유투표 결과**',
    formatTargetTallyLines(result.tally)
  ];

  if (result.noVotes) {
    lines.push('투표가 없어 처형 후보를 정하지 못했습니다. 오늘 재판은 종료되고 밤으로 넘어갑니다.');
  } else if (result.tie) {
    lines.push(`최다 득표 동률(${result.tiedUserIds.map((id) => `<@${id}>`).join(', ')})로 처형 후보를 정하지 못했습니다. 오늘 재판은 종료되고 밤으로 넘어갑니다.`);
  } else {
    lines.push(`처형 후보: ${formatPlayerMention(result.candidate)}. 이제 이 후보를 처형할지 공개 찬반투표로 결정합니다.`);
  }

  return lines.join('\n');
}

function createApprovalVotePayload(state, { description }, disabled = false) {
  const tally = state.game.getApprovalTally();
  const embed = new EmbedBuilder()
    .setColor(NEUTRAL_COLOR)
    .setTitle(`⚖️ ${state.game.dayNumber}번째 낮 — 2차 공개 찬반투표`)
    .setDescription([`후보: ${formatPlayerMention(tally.candidate)}`, description].join('\n'))
    .addFields(
      {
        name: `찬성 ${tally.yesCount.toLocaleString()}표`,
        value: formatVoterList(tally.yes),
        inline: false
      },
      {
        name: `반대 ${tally.noCount.toLocaleString()}표`,
        value: formatVoterList(tally.no),
        inline: false
      }
    )
    .setFooter({ text: `투표자 ${tally.totalVotes.toLocaleString()}명 / 생존자 ${state.game.alivePlayers.length.toLocaleString()}명` });

  return {
    embeds: [embed],
    components: [createApprovalActionRow(state, disabled)],
    allowedMentions: { parse: [] }
  };
}

function formatApprovalResultMessage(result) {
  const lines = [
    '📊 **공개 찬반투표 결과**',
    `후보: ${formatPlayerMention(result.candidate)}`,
    `찬성 ${result.tally.yesCount}표: ${formatVoterList(result.tally.yes)}`,
    `반대 ${result.tally.noCount}표: ${formatVoterList(result.tally.no)}`
  ];

  if (result.executed) {
    lines.push(`${formatDeathLine(result.death)} 공개 재판으로 처형되었습니다.`);
  } else {
    lines.push('찬성이 반대보다 많지 않아 처형이 부결되었습니다. 오늘 재판은 종료되고 밤으로 넘어갑니다.');
  }

  return lines.join('\n');
}

function formatFinishMessage(state) {
  const game = state.game;
  const winnerLine = game.winner === 'mafia'
    ? '🔪 **마피아 승리!** 마피아 수가 시민팀 수 이상이 되었습니다.'
    : '🧑‍🤝‍🧑 **시민팀 승리!** 모든 마피아를 제거했습니다.';
  const roleLines = game.players
    .map((player) => `- ${formatPlayerMention(player)}: ${formatMafiaRoleEmoji(player.role)} ${formatMafiaRoleLabel(player.role)}${player.alive ? ' (생존)' : ' (사망)'}`)
    .join('\n');

  return [
    '🏁 **마피아 게임 종료**',
    winnerLine,
    '',
    '최종 역할 공개:',
    roleLines
  ].join('\n');
}

function formatDeathLine(death) {
  const role = death.roleLabel ? ` (${death.roleLabel})` : '';
  return `${formatPlayerMention(death.player)}${role}님이`;
}

function createLobbyActionRow(state) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`mafia_join:${state.id}`)
      .setLabel('참가')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`mafia_start:${state.id}`)
      .setLabel('방장 시작')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`mafia_leave:${state.id}`)
      .setLabel('나가기')
      .setStyle(ButtonStyle.Secondary)
  );
}

function createSecretActionRow(state) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`mafia_secret:${state.id}`)
      .setLabel('내 역할 보기')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🔒')
  );
}

function createDiscussionActionRow(state) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`mafia_discuss_done:${state.id}`)
      .setLabel('방장: 자유투표 시작')
      .setStyle(ButtonStyle.Primary)
  );
}

function createApprovalActionRow(state, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`mafia_approve:${state.id}:yes`)
      .setLabel('처형 찬성')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`mafia_approve:${state.id}:no`)
      .setLabel('처형 반대')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled)
  );
}

function createTargetRows({ state, prefix, players, disabled = false }) {
  const rows = [];
  for (let index = 0; index < players.length; index += 5) {
    rows.push(new ActionRowBuilder().addComponents(
      ...players.slice(index, index + 5).map((player) =>
        new ButtonBuilder()
          .setCustomId(`${prefix}:${state.id}:${player.userId}`)
          .setLabel(formatPlayerName(player).slice(0, 80))
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled)
      )
    ));
  }
  return rows;
}

async function disableNightMessage(state) {
  if (typeof state.nightMessage?.edit !== 'function') return;
  await state.nightMessage.edit(createNightActionPayload(state, true));
}

async function disableDiscussionMessage(state) {
  if (typeof state.discussionMessage?.edit !== 'function') return;
  await state.discussionMessage.edit({
    content: `${formatDayDiscussionMessage(state)}\n\n⏱️ 토론 시간이 종료되어 자유투표를 시작합니다.`,
    components: [],
    allowedMentions: { parse: [] }
  });
}

async function disableNominationMessage(state) {
  if (typeof state.nominationMessage?.edit !== 'function') return;
  await state.nominationMessage.edit(createNominationVotePayload(state, {
    description: '자유투표가 마감되었습니다.'
  }, true));
}

async function disableApprovalMessage(state) {
  if (typeof state.approvalMessage?.edit !== 'function') return;
  await state.approvalMessage.edit(createApprovalVotePayload(state, {
    description: '찬반투표가 마감되었습니다.'
  }, true));
}

function formatTargetTallyLines(tally) {
  return tally.map((entry) => (
    `- ${formatPlayerMention(entry.player)}: ${entry.count}표 (${formatVoterList(entry.voters)})`
  )).join('\n');
}

function formatVoterList(voters) {
  return voters.length > 0 ? voters.map(formatPlayerMention).join(', ') : '없음';
}

function formatPhase(phase) {
  return {
    collecting: '모집',
    night: '밤 행동',
    day_discussion: '낮 토론',
    nomination: '공개 자유투표',
    approval: '공개 찬반투표',
    ended: '종료'
  }[phase] ?? phase;
}

function formatPlayerMention(playerOrId) {
  const userId = typeof playerOrId === 'string' ? playerOrId : playerOrId?.userId;
  return `<@${userId}>`;
}

function formatPlayerName(player) {
  return player?.username || player?.userId || '알 수 없음';
}

function createHumanParticipant(user) {
  return {
    userId: user.id,
    username: user.username,
    bot: false
  };
}

function secondsOptionToMs(seconds, fallbackMs) {
  return Number.isInteger(seconds) && seconds > 0 ? seconds * 1000 : fallbackMs;
}

function createChannelKey(guildId, channelId) {
  return `${guildId}:${channelId}`;
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

function clearNominationTimer(state) {
  clearTimeout(state.nominationTimer);
  state.nominationTimer = null;
}

function clearApprovalTimer(state) {
  clearTimeout(state.approvalTimer);
  state.approvalTimer = null;
}

function clearAllTimers(state) {
  clearCollectionTimer(state);
  clearNightTimer(state);
  clearDiscussionTimer(state);
  clearNominationTimer(state);
  clearApprovalTimer(state);
}
