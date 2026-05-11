import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import {
  LIAR_GAME_MAX_PLAYERS,
  LIAR_GAME_MIN_PLAYERS,
  LIAR_GAME_MODES,
  LiarGame,
  getLiarGameCategoryChoices,
  getLiarGameMode,
  loadLiarGameWordBank
} from '../systems/liar-game.js';

export const LIAR_GAME_COLLECTION_MS = 60_000;
export const LIAR_GAME_DESCRIPTION_MS = 60_000;
export const LIAR_GAME_VOTING_MS = 60_000;
export const LIAR_GAME_GUESS_MS = 30_000;

const LIAR_GAME_COLOR = 0xec4899;
const LIAR_GAME_BAR_LENGTH = 12;

const activeLiarGamesByChannel = new Map();
const activeLiarGamesById = new Map();

export const liarGameCommands = [
  new SlashCommandBuilder()
    .setName('라이어게임')
    .setDescription('주제만 공개하고 라이어를 찾아내는 파티 게임입니다.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('시작')
        .setDescription('1분 동안 참가자를 모집한 뒤 라이어게임을 시작합니다.')
        .addStringOption((option) =>
          option
            .setName('모드')
            .setDescription('라이어게임 모드')
            .addChoices(
              { name: '일반', value: LIAR_GAME_MODES.normal.value },
              { name: '어려움', value: LIAR_GAME_MODES.hard.value }
            )
        )
        .addIntegerOption((option) =>
          option
            .setName('설명턴수')
            .setDescription('모든 플레이어가 설명하는 라운드 수')
            .addChoices(
              { name: '1턴', value: 1 },
              { name: '2턴', value: 2 }
            )
        )
        .addStringOption((option) =>
          option
            .setName('카테고리')
            .setDescription('비워두면 랜덤 주제가 선택됩니다.')
            .addChoices(...getLiarGameCategoryChoices())
        )
    )
];

export function getLiarGameCommandPayloads() {
  return liarGameCommands.map((command) => command.toJSON());
}

export async function handleLiarGameCommand(interaction, economy = null, logger = console, options = {}) {
  if (interaction.isButton?.() && interaction.customId?.startsWith('liar_')) {
    return handleLiarGameButton(interaction, economy, logger, options);
  }

  if (interaction.isModalSubmit?.() && interaction.customId?.startsWith('liar_final_guess:')) {
    return handleLiarGameFinalGuess(interaction, economy, logger);
  }

  if (!interaction.isChatInputCommand?.() || interaction.commandName !== '라이어게임') {
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
    await createLiarGameLobby(interaction, economy, logger, options);
    return true;
  }

  return false;
}

export async function handleLiarGameMessage(message, economy = null, logger = console) {
  if (!message.inGuild?.() || message.author.bot) return false;

  const state = activeLiarGamesByChannel.get(createChannelKey(message.guild.id, message.channel.id));
  if (!state || state.status !== 'describing') return false;

  const currentTurn = state.game.currentTurn;
  if (!currentTurn || currentTurn.player.userId !== message.author.id) return false;

  const result = state.game.submitDescription({
    userId: message.author.id,
    text: message.content
  });

  if (!result.accepted) {
    await message.reply(result.reason);
    return true;
  }

  clearTurnTimer(state);

  try {
    await message.react('✅');
  } catch (error) {
    logger.debug?.('Failed to react to liar-game description:', error);
  }

  await continueLiarDescriptionPhase(state, economy, logger);
  return true;
}

export function resetLiarGameSessionsForTest() {
  for (const state of activeLiarGamesByChannel.values()) {
    clearAllTimers(state);
  }
  activeLiarGamesByChannel.clear();
  activeLiarGamesById.clear();
}

async function createLiarGameLobby(interaction, economy, logger, options) {
  const key = createChannelKey(interaction.guildId, interaction.channelId);

  if (activeLiarGamesByChannel.has(key)) {
    await interaction.reply({
      content: '이 채널에서 이미 라이어게임 모집 또는 게임이 진행 중입니다.',
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
    status: 'collecting',
    hostUserId: interaction.user.id,
    mode: getLiarGameMode(interaction.options.getString?.('모드') ?? options.mode),
    turnCount: interaction.options.getInteger?.('설명턴수') ?? options.turnCount ?? 1,
    categoryId: interaction.options.getString?.('카테고리') ?? options.categoryId ?? null,
    participants: new Map(),
    wordBank: options.wordBank ?? loadLiarGameWordBank(),
    collectionMs: options.collectionMs ?? LIAR_GAME_COLLECTION_MS,
    descriptionMs: options.descriptionMs ?? LIAR_GAME_DESCRIPTION_MS,
    votingMs: options.votingMs ?? LIAR_GAME_VOTING_MS,
    guessMs: options.guessMs ?? LIAR_GAME_GUESS_MS,
    randomInt: options.randomInt,
    collectionTimer: null,
    turnTimer: null,
    voteTimer: null,
    guessTimer: null,
    voteMessage: null,
    guessMessage: null,
    voteAllowedTargetIds: null,
    runoffUsed: false,
    game: null
  };

  state.participants.set(interaction.user.id, createHumanParticipant(interaction.user));
  activeLiarGamesByChannel.set(key, state);
  activeLiarGamesById.set(state.id, state);

  state.collectionTimer = setManagedTimeout(
    () => beginLiarGame(state, economy, logger).catch((error) => logger.error(error)),
    state.collectionMs
  );

  await interaction.reply({
    content: formatLobbyMessage(state),
    components: [createLobbyActionRow(state)]
  });
}

async function handleLiarGameButton(interaction, economy, logger, options) {
  const [action, gameId, targetId] = interaction.customId.split(':');
  const state = activeLiarGamesById.get(gameId);

  if (!state || state.guildId !== interaction.guildId || state.channelId !== interaction.channelId) {
    await interaction.reply({
      content: '이미 종료되었거나 다른 채널의 라이어게임입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (action === 'liar_secret') {
    await replyWithPrivateAssignment(interaction, state);
    return true;
  }

  if (action === 'liar_vote') {
    await handleVoteButton(interaction, state, targetId, economy, logger);
    return true;
  }

  if (action === 'liar_guess') {
    await handleGuessButton(interaction, state);
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

  if (action === 'liar_join') {
    if (state.participants.size >= LIAR_GAME_MAX_PLAYERS && !state.participants.has(interaction.user.id)) {
      await interaction.reply({
        content: `라이어게임은 최대 ${LIAR_GAME_MAX_PLAYERS}명까지 참가할 수 있습니다.`,
        flags: MessageFlags.Ephemeral
      });
      return true;
    }

    state.participants.set(interaction.user.id, createHumanParticipant(interaction.user));
    await interaction.update({
      content: formatLobbyMessage(state),
      components: [createLobbyActionRow(state)]
    });
    return true;
  }

  if (action === 'liar_leave') {
    if (interaction.user.id === state.hostUserId) {
      await interaction.reply({
        content: '방장은 모집 중 나갈 수 없습니다. 게임이 끝난 뒤 다시 시작해주세요.',
        flags: MessageFlags.Ephemeral
      });
      return true;
    }

    state.participants.delete(interaction.user.id);
    await interaction.update({
      content: formatLobbyMessage(state),
      components: [createLobbyActionRow(state)]
    });
    return true;
  }

  if (action === 'liar_start') {
    if (interaction.user.id !== state.hostUserId) {
      await interaction.reply({
        content: '방장만 모집 시간을 건너뛰고 바로 시작할 수 있습니다.',
        flags: MessageFlags.Ephemeral
      });
      return true;
    }

    await interaction.update({
      content: `${formatLobbyMessage(state)}\n\n▶️ 방장이 모집을 종료하고 게임을 바로 시작했습니다.`,
      components: []
    });
    await beginLiarGame(state, economy, logger, options);
    return true;
  }

  return false;
}

async function beginLiarGame(state, economy, logger) {
  if (state.status !== 'collecting') return;

  clearCollectionTimer(state);

  const players = [...state.participants.values()];
  if (players.length < LIAR_GAME_MIN_PLAYERS) {
    state.status = 'ended';
    clearAllTimers(state);
    activeLiarGamesByChannel.delete(state.key);
    activeLiarGamesById.delete(state.id);
    await state.channel.send(`⏹️ 라이어게임 시작 취소: 참가자가 최소 ${LIAR_GAME_MIN_PLAYERS}명 필요합니다.`);
    return;
  }

  try {
    state.game = new LiarGame({
      players,
      wordBank: state.wordBank,
      mode: state.mode.value,
      categoryId: state.categoryId,
      turnCount: state.turnCount,
      randomInt: state.randomInt
    });
  } catch (error) {
    state.status = 'ended';
    clearAllTimers(state);
    activeLiarGamesByChannel.delete(state.key);
    activeLiarGamesById.delete(state.id);
    await state.channel.send(`⏹️ 라이어게임 시작 취소: ${error.message}`);
    return;
  }

  state.status = 'describing';
  await state.channel.send({
    content: formatStartMessage(state),
    components: [createSecretActionRow(state)]
  });
  await continueLiarDescriptionPhase(state, economy, logger);
}

async function continueLiarDescriptionPhase(state, economy, logger) {
  if (state.status !== 'describing') return;

  if (state.game.isDescriptionComplete) {
    await startLiarVoting(state, economy, logger);
    return;
  }

  const turn = state.game.currentTurn;
  clearTurnTimer(state);
  state.turnTimer = setManagedTimeout(
    () => skipTimedOutDescription(state, economy, logger).catch((error) => logger.error(error)),
    state.descriptionMs
  );

  await state.channel.send([
    `➡️ **${turn.round}/${state.game.turnCount}턴** ${formatPlayerMention(turn.player)} 차례입니다.`,
    `제시어를 직접 말하지 말고 ${formatSeconds(state.descriptionMs)} 안에 설명을 입력하세요.`
  ].join('\n'));
}

async function skipTimedOutDescription(state, economy, logger) {
  if (state.status !== 'describing') return;

  const skipped = state.game.skipCurrentDescription('시간 초과');
  if (skipped?.entry) {
    await state.channel.send(`⏰ ${formatPlayerMention(skipped.entry.player)}님이 설명 시간을 넘겨 이번 턴을 건너뜁니다.`);
  }

  await continueLiarDescriptionPhase(state, economy, logger);
}

async function startLiarVoting(state, economy, logger, { allowedTargetIds = null, runoff = false } = {}) {
  if (!['describing', 'voting'].includes(state.status)) return;

  state.status = 'voting';
  state.voteAllowedTargetIds = allowedTargetIds;
  state.game.clearVotes();
  clearVoteTimer(state);

  const payload = createVoteMessagePayload(state, {
    title: runoff ? '📊 라이어게임 결선 투표' : '📊 라이어게임 투표',
    description: runoff
      ? `동률 후보만 다시 투표합니다. ${formatSeconds(state.votingMs)} 안에 라이어로 의심되는 사람을 선택하세요.`
      : `설명이 모두 끝났습니다. ${formatSeconds(state.votingMs)} 안에 라이어로 의심되는 사람을 선택하세요.`
  });

  state.voteMessage = await state.channel.send(payload);
  state.voteTimer = setManagedTimeout(
    () => resolveLiarVoting(state, economy, logger).catch((error) => logger.error(error)),
    state.votingMs
  );
}

async function handleVoteButton(interaction, state, targetId, economy, logger) {
  if (state.status !== 'voting') {
    await interaction.reply({
      content: '현재 투표 시간이 아닙니다.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (state.voteMessage?.id && interaction.message?.id && interaction.message.id !== state.voteMessage.id) {
    await interaction.reply({
      content: '이전 투표 메시지입니다. 최신 투표 메시지에서 선택해주세요.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  const result = state.game.castVote({
    voterId: interaction.user.id,
    targetId,
    allowedTargetIds: state.voteAllowedTargetIds
  });

  if (!result.accepted) {
    await interaction.reply({
      content: result.reason,
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  const votingComplete = state.game.isVotingComplete(state.voteAllowedTargetIds);
  const payload = createVoteMessagePayload(state, {
    title: state.runoffUsed ? '📊 라이어게임 결선 투표' : '📊 라이어게임 투표',
    description: votingComplete
      ? `${formatPlayerMention(result.voter)}님까지 전원이 투표했습니다. 즉시 개표합니다.`
      : `${formatPlayerMention(result.voter)}님이 투표했습니다. 투표는 마감 전까지 변경할 수 있습니다.`
  });

  await interaction.update(payload);

  if (votingComplete) {
    await resolveLiarVoting(state, economy, logger);
  }
}

async function resolveLiarVoting(state, economy, logger) {
  if (state.status !== 'voting') return;

  clearVoteTimer(state);
  await disableVoteMessage(state);

  const result = state.game.resolveVote(state.voteAllowedTargetIds);

  if (result.noVotes) {
    await finishLiarGame(state, economy, {
      winner: 'liar',
      reason: '투표가 없어 라이어가 의심을 피했습니다.'
    });
    return;
  }

  if (result.tie) {
    if (!state.runoffUsed && result.tiedUserIds.length > 1) {
      state.runoffUsed = true;
      await state.channel.send(`⚖️ 최다 득표 동률입니다. 동률 후보 ${result.tiedUserIds.map((id) => `<@${id}>`).join(', ')}만 결선 투표합니다.`);
      await startLiarVoting(state, economy, logger, {
        allowedTargetIds: result.tiedUserIds,
        runoff: true
      });
      return;
    }

    await finishLiarGame(state, economy, {
      winner: 'liar',
      reason: '결선 투표도 동률로 끝나 라이어가 살아남았습니다.'
    });
    return;
  }

  if (!result.accusedIsLiar) {
    await finishLiarGame(state, economy, {
      winner: 'liar',
      reason: `${formatPlayerMention(result.accused)}님이 최다 득표를 받았지만 라이어가 아니었습니다.`
    });
    return;
  }

  await startFinalGuessPhase(state, economy, result.accused);
}

async function startFinalGuessPhase(state, economy, accused) {
  state.status = 'guessing';
  clearGuessTimer(state);

  state.guessMessage = await state.channel.send({
    content: [
      `🕵️ ${formatPlayerMention(accused)}님이 라이어로 지목되었습니다!`,
      `${formatSeconds(state.guessMs)} 동안 변론한 뒤 **최종 제시어 추측** 버튼으로 정답을 맞히면 라이어 승리입니다.`
    ].join('\n'),
    components: [createGuessActionRow(state)]
  });

  state.guessTimer = setManagedTimeout(
    () => finishLiarGame(state, economy, {
      winner: 'citizens',
      reason: '라이어가 제한시간 안에 제시어를 맞히지 못했습니다.'
    }).catch((error) => console.error(error)),
    state.guessMs
  );
}

async function handleGuessButton(interaction, state) {
  if (state.status !== 'guessing') {
    await interaction.reply({
      content: '현재 최종 추측 시간이 아닙니다.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (interaction.user.id !== state.game.liarUserId) {
    await interaction.reply({
      content: '최종 제시어 추측은 라이어만 제출할 수 있습니다.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  await interaction.showModal(createFinalGuessModal(state));
}

async function handleLiarGameFinalGuess(interaction, economy) {
  const [, gameId] = interaction.customId.split(':');
  const state = activeLiarGamesById.get(gameId);

  if (!state || state.guildId !== interaction.guildId || state.channelId !== interaction.channelId) {
    await interaction.reply({
      content: '이미 종료되었거나 다른 채널의 라이어게임입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (state.status !== 'guessing' || interaction.user.id !== state.game.liarUserId) {
    await interaction.reply({
      content: '현재 최종 추측을 제출할 수 없습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  const guess = interaction.fields.getTextInputValue('guess');
  const result = state.game.submitFinalGuess(guess);
  clearGuessTimer(state);

  await interaction.reply({
    content: result.correct
      ? `✅ 최종 추측 **${result.guess}** 정답! 라이어가 승리했습니다.`
      : `❌ 최종 추측 **${result.guess}** 오답입니다. 시민들이 승리했습니다.`,
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] }
  });

  await finishLiarGame(state, economy, {
    winner: result.correct ? 'liar' : 'citizens',
    reason: result.correct
      ? '라이어가 최종 제시어를 정확히 맞혔습니다.'
      : '라이어가 최종 제시어를 맞히지 못했습니다.'
  });
  return true;
}

async function replyWithPrivateAssignment(interaction, state) {
  const assignment = state.game?.getAssignment(interaction.user.id);

  if (!assignment) {
    await interaction.reply({
      content: '이 라이어게임의 참가자만 제시어를 확인할 수 있습니다.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  const lines = [
    `🎭 **라이어게임 비공개 정보**`,
    `주제: **${assignment.category.name}**`,
    `모드: **${assignment.mode.label}**`
  ];

  if (assignment.mode.value === LIAR_GAME_MODES.hard.value) {
    lines.push('', '어려움 모드에서는 역할을 공개하지 않습니다.');
    lines.push(`당신의 제시어: **${assignment.word}**`);
  } else if (assignment.isLiar) {
    lines.push('', '당신은 **라이어**입니다. 제시어를 모르는 척이 아니라, 정말 모릅니다. 다른 사람의 설명을 듣고 유추하세요.');
  } else {
    lines.push('', '당신은 **시민**입니다.');
    lines.push(`제시어: **${assignment.word}**`);
  }

  await interaction.reply({
    content: lines.join('\n'),
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] }
  });
}

async function finishLiarGame(state, economy, { winner, reason }) {
  if (state.status === 'ended') return;

  state.status = 'ended';
  clearAllTimers(state);
  activeLiarGamesByChannel.delete(state.key);
  activeLiarGamesById.delete(state.id);

  const rewards = await awardLiarGameRewards(state, economy, winner);

  await disableVoteMessage(state).catch(() => null);
  await disableGuessMessage(state).catch(() => null);
  await state.channel.send(formatFinishMessage(state, { winner, reason, rewards }));
}

function formatLobbyMessage(state) {
  const participants = [...state.participants.values()]
    .map((participant, index) => `${index + 1}. ${formatPlayerMention(participant)}`)
    .join('\n') || '- 아직 없음';

  return [
    '🎭 **라이어게임 참가자 모집**',
    `모드: **${state.mode.label}** — ${state.mode.description}`,
    `설명 턴: **${state.turnCount === 2 ? 2 : 1}턴**`,
    `카테고리: **${formatCategoryChoice(state)}**`,
    `모집 시간: **${formatSeconds(state.collectionMs)}**`,
    `인원: **${LIAR_GAME_MIN_PLAYERS}~${LIAR_GAME_MAX_PLAYERS}명**`,
    '방장 시작: 모집 시간이 끝나기 전에도 **방장 시작** 버튼으로 바로 시작 가능',
    '진행: 게임 시작 시 무작위 설명 순서를 공개하고, 제시어는 각자 **내 제시어 보기** 버튼으로만 확인합니다.',
    '',
    `참가자 (${state.participants.size}명):`,
    participants
  ].join('\n');
}

function formatStartMessage(state) {
  const order = state.game.turnOrder
    .map((player, index) => `${index + 1}. ${formatPlayerMention(player)}`)
    .join('\n');

  return [
    '🎭 **라이어게임 시작!**',
    `공개 주제: **${state.game.category.name}**`,
    `모드: **${state.game.mode.label}** — ${state.game.mode.description}`,
    `설명 턴: **${state.game.turnCount}턴**`,
    '',
    '아래 **내 제시어 보기** 버튼을 눌러 본인에게만 보이는 제시어를 확인하세요.',
    '라이어가 알아채지 못하게 너무 직접적인 설명은 피하고, 너무 모호하면 의심받을 수 있습니다.',
    '',
    '설명 순서(랜덤):',
    order
  ].join('\n');
}

function formatFinishMessage(state, { winner, reason, rewards = null }) {
  const game = state.game;
  const descriptionLines = game.descriptions.length > 0
    ? game.descriptions.map((entry) => `- ${entry.round}턴 ${formatPlayerMention(entry.player)}: ${entry.skipped ? '시간 초과' : entry.text}`).join('\n')
    : '- 기록 없음';

  return [
    '🏁 **라이어게임 종료**',
    winner === 'liar' ? '🎭 **라이어 승리!**' : '🧑‍🤝‍🧑 **시민 승리!**',
    reason,
    '',
    `라이어: ${formatPlayerMention(game.liar)}`,
    `주제: **${game.category.name}**`,
    `정답 제시어: **${game.targetWord}**`,
    game.liarWord ? `라이어 제시어: **${game.liarWord}**` : null,
    game.finalGuess ? `라이어 최종 추측: **${game.finalGuess.guess || '미입력'}**` : null,
    '',
    '보상:',
    formatLiarGameRewards(rewards),
    '',
    '설명 기록:',
    descriptionLines
  ].filter(Boolean).join('\n');
}

async function awardLiarGameRewards(state, economy, winner) {
  if (typeof economy?.awardLiarGameResults !== 'function') return null;

  try {
    return await economy.awardLiarGameResults({
      guildId: state.guildId,
      participants: state.game.players,
      liarUserId: state.game.liarUserId,
      winner
    });
  } catch (error) {
    return {
      error,
      participants: []
    };
  }
}

function formatLiarGameRewards(rewards) {
  if (rewards?.error) {
    return `- 보상 지급 중 오류가 발생했습니다: ${rewards.error.message}`;
  }

  if (!rewards?.participants?.length) {
    return '- 보상 지급 없음';
  }

  return rewards.participants.map((result) => {
    const role = result.role === 'liar' ? '라이어' : '시민';
    const money = result.moneyGained > 0 ? ` / +${result.moneyGained.toLocaleString()}골드` : '';
    const levelReward = result.levelReward > 0 ? ` / 레벨업 보너스 +${result.levelReward.toLocaleString()}골드` : '';
    const level = result.leveledUp ? ` / Lv.${result.profile.level} 달성` : '';
    return `- <@${result.userId}> (${role}): +${result.xpGained.toLocaleString()} XP${money}${levelReward}${level}`;
  }).join('\n');
}

function createLobbyActionRow(state) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`liar_join:${state.id}`)
      .setLabel('참가')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`liar_start:${state.id}`)
      .setLabel('방장 시작')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`liar_leave:${state.id}`)
      .setLabel('나가기')
      .setStyle(ButtonStyle.Secondary)
  );
}

function createSecretActionRow(state) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`liar_secret:${state.id}`)
      .setLabel('내 제시어 보기')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🔒')
  );
}

function createVoteMessagePayload(state, { title, description }) {
  const counts = state.game.getVoteCounts(state.voteAllowedTargetIds);
  const totalVotes = counts.reduce((sum, entry) => sum + entry.count, 0);
  const embed = new EmbedBuilder()
    .setColor(LIAR_GAME_COLOR)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: `투표자 ${state.game.votes.size.toLocaleString()}명 · 총 ${totalVotes.toLocaleString()}표` });

  for (const entry of counts) {
    const percent = totalVotes > 0 ? (entry.count / totalVotes) * 100 : 0;
    embed.addFields({
      name: `${formatPlayerName(entry.player)}`,
      value: [
        `득표 **${entry.count.toLocaleString()}표** · **${formatPercent(percent)}**`,
        createVoteBar(percent)
      ].join('\n'),
      inline: false
    });
  }

  return {
    embeds: [embed],
    components: createVoteRows(state, false)
  };
}

function createVoteRows(state, disabled = false) {
  const allowed = state.voteAllowedTargetIds ? new Set(state.voteAllowedTargetIds) : null;
  const players = state.game.players.filter((player) => !allowed || allowed.has(player.userId));
  const rows = [];

  for (let index = 0; index < players.length; index += 5) {
    rows.push(new ActionRowBuilder().addComponents(
      ...players.slice(index, index + 5).map((player) =>
        new ButtonBuilder()
          .setCustomId(`liar_vote:${state.id}:${player.userId}`)
          .setLabel(formatPlayerName(player).slice(0, 80))
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled)
      )
    ));
  }

  return rows;
}

function createGuessActionRow(state, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`liar_guess:${state.id}`)
      .setLabel('최종 제시어 추측')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled)
  );
}

function createFinalGuessModal(state) {
  const input = new TextInputBuilder()
    .setCustomId('guess')
    .setLabel('정답 제시어를 입력하세요')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(80)
    .setPlaceholder('예: 김치찌개');

  return new ModalBuilder()
    .setCustomId(`liar_final_guess:${state.id}`)
    .setTitle('라이어 최종 추측')
    .addComponents(new ActionRowBuilder().addComponents(input));
}

async function disableVoteMessage(state) {
  if (typeof state.voteMessage?.edit !== 'function' || !state.game) return;

  const counts = state.game.getVoteCounts(state.voteAllowedTargetIds);
  const totalVotes = counts.reduce((sum, entry) => sum + entry.count, 0);
  const embed = new EmbedBuilder()
    .setColor(0x64748b)
    .setTitle('📊 라이어게임 투표 종료')
    .setDescription('투표가 마감되었습니다.')
    .setFooter({ text: `투표자 ${state.game.votes.size.toLocaleString()}명 · 총 ${totalVotes.toLocaleString()}표` });

  for (const entry of counts) {
    const percent = totalVotes > 0 ? (entry.count / totalVotes) * 100 : 0;
    embed.addFields({
      name: formatPlayerName(entry.player),
      value: [`득표 **${entry.count.toLocaleString()}표** · **${formatPercent(percent)}**`, createVoteBar(percent)].join('\n'),
      inline: false
    });
  }

  await state.voteMessage.edit({
    embeds: [embed],
    components: createVoteRows(state, true)
  });
}

async function disableGuessMessage(state) {
  if (typeof state.guessMessage?.edit !== 'function') return;

  await state.guessMessage.edit({
    content: '🕵️ 최종 추측 단계가 종료되었습니다.',
    components: [createGuessActionRow(state, true)]
  });
}

function formatCategoryChoice(state) {
  if (!state.categoryId) return '랜덤';
  const category = state.wordBank.categories.find((candidate) => candidate.id === state.categoryId);
  return category?.name ?? '랜덤';
}

function formatPlayerMention(player) {
  return `<@${player.userId}>`;
}

function formatPlayerName(player) {
  return player.username || player.userId;
}

function createHumanParticipant(user) {
  return {
    userId: user.id,
    username: user.username,
    bot: false
  };
}

function createVoteBar(percent) {
  const filledLength = Math.round((Math.max(0, Math.min(100, percent)) / 100) * LIAR_GAME_BAR_LENGTH);
  return `${'▰'.repeat(filledLength)}${'▱'.repeat(LIAR_GAME_BAR_LENGTH - filledLength)}`;
}

function formatPercent(percent) {
  if (!Number.isFinite(percent) || percent <= 0) return '0%';
  return Number.isInteger(percent) ? `${percent.toFixed(0)}%` : `${percent.toFixed(1)}%`;
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

function clearTurnTimer(state) {
  clearTimeout(state.turnTimer);
  state.turnTimer = null;
}

function clearVoteTimer(state) {
  clearTimeout(state.voteTimer);
  state.voteTimer = null;
}

function clearGuessTimer(state) {
  clearTimeout(state.guessTimer);
  state.guessTimer = null;
}

function clearAllTimers(state) {
  clearCollectionTimer(state);
  clearTurnTimer(state);
  clearVoteTimer(state);
  clearGuessTimer(state);
}
