import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  StringSelectMenuBuilder
} from 'discord.js';
import {
  LIARS_BAR_MAX_PLAYERS,
  LIARS_BAR_MIN_PLAYERS,
  LIARS_BAR_REVOLVER_CHAMBERS,
  LiarsBarGameManager,
  formatLiarsBarCard,
  formatLiarsBarCardType
} from '../systems/liars-bar.js';

const DEFAULT_LIARS_BAR_MANAGER = new LiarsBarGameManager();
const LIARS_BAR_COLORS = Object.freeze({
  lobby: 0xf59e0b,
  playing: 0xec4899,
  truthful: 0x22c55e,
  danger: 0xef4444,
  complete: 0x8b5cf6,
  hand: 0x38bdf8
});

export const liarsBarCommands = [
  new SlashCommandBuilder()
    .setName('라이어바')
    .setDescription('Liar\'s Bar의 카드 의심/리볼버 생존 미니게임을 진행합니다.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('시작')
        .setDescription('라이어바 방을 만들고 2~4명 참가자를 모집합니다.')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('상태')
        .setDescription('현재 채널의 라이어바 방/게임 상태를 확인합니다.')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('손패')
        .setDescription('내 라이어바 손패를 비공개로 확인합니다.')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('내기')
        .setDescription('내 차례에 1~3장을 뒤집어 내고 테이블 카드라고 주장합니다.')
        .addIntegerOption((option) =>
          option
            .setName('카드1')
            .setDescription('`/라이어바 손패`에 표시된 카드 번호')
            .setMinValue(1)
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName('카드2')
            .setDescription('함께 낼 두 번째 카드 번호')
            .setMinValue(1)
        )
        .addIntegerOption((option) =>
          option
            .setName('카드3')
            .setDescription('함께 낼 세 번째 카드 번호')
            .setMinValue(1)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('라이어')
        .setDescription('내 차례에 직전 플레이를 거짓말로 의심하고 카드를 공개합니다.')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('종료')
        .setDescription('방장이 현재 채널의 라이어바 방/게임을 종료합니다.')
    )
];

export function getLiarsBarCommandPayloads() {
  return liarsBarCommands.map((command) => command.toJSON());
}

export async function handleLiarsBarCommand(interaction, manager = DEFAULT_LIARS_BAR_MANAGER, logger = console) {
  if (interaction.isStringSelectMenu?.() && interaction.customId?.startsWith('liarsbar_play_select:')) {
    return handleLiarsBarPlaySelect(interaction, manager, logger);
  }

  if (interaction.isButton?.() && interaction.customId?.startsWith('liarsbar_')) {
    return handleLiarsBarButton(interaction, manager, logger);
  }

  if (!interaction.isChatInputCommand?.() || interaction.commandName !== '라이어바') {
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
      const state = manager.createLobby({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        host: interaction.user
      });
      await interaction.reply(createLiarsBarLobbyPayload(state));
      return true;
    }

    if (subcommand === '상태') {
      const state = manager.getGame({
        guildId: interaction.guildId,
        channelId: interaction.channelId
      });
      await interaction.reply(state
        ? createLiarsBarStatusPayload(state)
        : createLiarsBarEmptyPayload());
      return true;
    }

    if (subcommand === '손패') {
      const result = manager.getPlayerHand({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        userId: interaction.user.id
      });
      await interaction.reply({
        ...createLiarsBarHandPayload(result, interaction.user.id),
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    if (subcommand === '내기') {
      const result = manager.playCards({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        userId: interaction.user.id,
        cardNumbers: [
          interaction.options.getInteger('카드1', true),
          interaction.options.getInteger('카드2'),
          interaction.options.getInteger('카드3')
        ]
      });
      await replyWithLiarsBarActionResult(interaction, result);
      return true;
    }

    if (subcommand === '라이어') {
      const result = manager.callLiar({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        userId: interaction.user.id
      });
      await replyWithLiarsBarActionResult(interaction, result);
      return true;
    }

    if (subcommand === '종료') {
      const state = manager.endGame({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        userId: interaction.user.id
      });
      await interaction.reply(createLiarsBarStatusPayload(state, {
        prefix: '⏹️ 라이어바 방을 종료했습니다.'
      }));
      return true;
    }
  } catch (error) {
    logger.debug?.('Liars Bar command rejected:', error);
    await interaction.reply({
      content: `라이어바 처리 실패: ${error.message}`,
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] }
    });
    return true;
  }

  return false;
}

async function handleLiarsBarButton(interaction, manager) {
  const [action, gameId] = interaction.customId.split(':');
  const state = manager.getGame({
    guildId: interaction.guildId,
    channelId: interaction.channelId
  });

  if (!state || state.id !== gameId) {
    await interaction.reply({
      content: '이미 종료되었거나 다른 채널의 라이어바 방입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (action === 'liarsbar_hand') {
    try {
      const result = manager.getPlayerHand({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        userId: interaction.user.id
      });
      await interaction.reply({
        ...createLiarsBarHandPayload(result, interaction.user.id),
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      await interaction.reply({
        content: `손패 확인 실패: ${error.message}`,
        flags: MessageFlags.Ephemeral
      });
    }
    return true;
  }

  if (action === 'liarsbar_call') {
    let result;
    try {
      result = manager.callLiar({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        userId: interaction.user.id
      });
    } catch (error) {
      await interaction.reply({
        content: `LIAR 선언 실패: ${error.message}`,
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] }
      });
      return true;
    }

    if (!result.ok) {
      await interaction.reply({
        content: `❌ ${result.reason}`,
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] }
      });
      return true;
    }

    await interaction.update(createLiarsBarActionPayload(result));
    return true;
  }

  if (state.status !== 'lobby') {
    await interaction.reply({
      content: '이미 시작된 라이어바 게임입니다. 공개 메시지의 **내 손패** 또는 **LIAR 선언** 버튼을 사용하세요.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (interaction.user.bot) {
    await interaction.reply({
      content: '봇 계정은 라이어바에 참가할 수 없습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (action === 'liarsbar_join') {
    let joined;
    try {
      joined = manager.joinLobby({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        user: interaction.user
      });
    } catch (error) {
      await interaction.reply({
        content: `라이어바 참가 실패: ${error.message}`,
        flags: MessageFlags.Ephemeral
      });
      return true;
    }
    await interaction.update(createLiarsBarLobbyPayload(joined));
    return true;
  }

  if (action === 'liarsbar_start') {
    if (interaction.user.id !== state.hostUserId) {
      await interaction.reply({
        content: '방장만 라이어바 게임을 시작할 수 있습니다.',
        flags: MessageFlags.Ephemeral
      });
      return true;
    }

    let started;
    try {
      started = manager.startGame({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        userId: interaction.user.id
      });
    } catch (error) {
      await interaction.reply({
        content: `라이어바 시작 실패: ${error.message}`,
        flags: MessageFlags.Ephemeral
      });
      return true;
    }

    await interaction.update(createLiarsBarLobbyPayload(state, {
      suffix: '▶️ 방장이 모집을 종료하고 라이어바를 시작했습니다.',
      components: []
    }));

    const payload = createLiarsBarStartPayload(started);
    if (typeof interaction.channel?.send === 'function') {
      await interaction.channel.send(payload);
    } else if (typeof interaction.followUp === 'function') {
      await interaction.followUp(payload);
    }
    return true;
  }

  if (action === 'liarsbar_cancel') {
    if (interaction.user.id !== state.hostUserId) {
      await interaction.reply({
        content: '방장만 라이어바 방을 취소할 수 있습니다.',
        flags: MessageFlags.Ephemeral
      });
      return true;
    }

    try {
      manager.endGame({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        userId: interaction.user.id
      });
    } catch (error) {
      await interaction.reply({
        content: `라이어바 취소 실패: ${error.message}`,
        flags: MessageFlags.Ephemeral
      });
      return true;
    }
    await interaction.update({
      content: '⏹️ 방장이 라이어바 모집을 취소했습니다.',
      components: []
    });
    return true;
  }

  return false;
}

async function handleLiarsBarPlaySelect(interaction, manager) {
  const [, gameId, ownerId, roundValue] = interaction.customId.split(':');
  const state = manager.getGame({
    guildId: interaction.guildId,
    channelId: interaction.channelId
  });

  if (!state || state.id !== gameId) {
    await interaction.reply({
      content: '이미 종료되었거나 다른 채널의 라이어바 손패 메뉴입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (ownerId !== interaction.user.id) {
    await interaction.reply({
      content: '이 손패 선택 메뉴는 본인만 사용할 수 있습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (state.status !== 'playing') {
    await interaction.reply({
      content: '진행 중인 라이어바 게임이 아닙니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (String(state.round) !== String(roundValue)) {
    await interaction.reply({
      content: '라운드가 바뀌어 손패 메뉴가 만료되었습니다. **내 손패**를 다시 눌러주세요.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  const cardNumbers = (interaction.values ?? []).map((value) => Number(value));
  const result = manager.playCards({
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    userId: interaction.user.id,
    cardNumbers
  });

  if (!result.ok) {
    await interaction.reply({
      content: `❌ ${result.reason}`,
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] }
    });
    return true;
  }

  const publicPayload = createLiarsBarActionPayload(result);
  if (typeof interaction.channel?.send === 'function') {
    await interaction.channel.send(publicPayload);
    await interaction.update(createLiarsBarSelectionAckPayload(result));
  } else {
    await interaction.reply(publicPayload);
  }
  return true;
}

async function replyWithLiarsBarActionResult(interaction, result) {
  if (!result.ok) {
    await interaction.reply({
      content: `❌ ${result.reason}`,
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] }
    });
    return;
  }

  await interaction.reply(createLiarsBarActionPayload(result));
}

export function formatLiarsBarLobbyMessage(state) {
  const participants = state.players
    .map((player, index) => `${formatPlayerSeat(index, state.players.length)} <@${player.userId}>`)
    .join('\n');
  const fill = Math.max(0, LIARS_BAR_MAX_PLAYERS - state.players.length);

  return [
    '╭─ 🃏 **LIAR\'S BAR ROOM**',
    `│ 인원  **${state.players.length}/${LIARS_BAR_MAX_PLAYERS}명** ${createPlayerCapacityBar(state.players.length, LIARS_BAR_MAX_PLAYERS)}`,
    `╰─ 최소 ${LIARS_BAR_MIN_PLAYERS}명 · 카드 5장 · 조커는 모든 주장에 안전`,
    '',
    '👥 **참가자**',
    participants,
    fill > 0 ? `빈 자리 ${fill}개` : '방이 가득 찼습니다.',
    '',
    '🎮 시작 후 `/라이어바 손패`로 카드를 보고 `/라이어바 내기 카드1:<번호>` 또는 `/라이어바 라이어`를 사용하세요.'
  ].join('\n');
}

export function formatLiarsBarStartMessage(state) {
  return [
    '🃏 **LIAR\'S BAR START!**',
    formatLiarsBarStatus(state),
    '',
    '🔒 아래 **내 손패** 버튼을 누르면 본인에게만 보이는 손패가 표시됩니다.'
  ].join('\n');
}

export function formatLiarsBarStatus(state) {
  if (state.status === 'lobby') return formatLiarsBarLobbyMessage(state);

  const playerLines = state.players.map((player, index) => {
    const marker = state.currentPlayer?.userId === player.userId ? '➡️' : player.eliminated ? '☠️' : '▫️';
    const hand = player.eliminated ? '탈락' : `손패 **${player.handCount}장**`;
    const pressure = player.eliminated
      ? '💥'
      : `${'●'.repeat(Math.min(player.shotsFired, LIARS_BAR_REVOLVER_CHAMBERS))}${'○'.repeat(Math.max(0, LIARS_BAR_REVOLVER_CHAMBERS - player.shotsFired))}`;
    return `${marker} ${formatPlayerSeat(index, state.players.length)} <@${player.userId}>  ${hand} · 벌칙 ${player.shotsFired}/${LIARS_BAR_REVOLVER_CHAMBERS} ${pressure}`;
  }).join('\n');

  const lastClaim = state.previousPlay
    ? `직전 주장: <@${state.previousPlay.player.userId}>님이 **${state.previousPlay.count}장**을 ${formatLiarsBarCardType(state.previousPlay.claimedType)}라고 냄`
    : '직전 주장: 없음';
  const lastReveal = state.lastReveal
    ? `최근 공개: ${state.lastReveal.cards.map(formatLiarsBarCard).join(' ')} → ${state.lastReveal.hasLiarCard ? '거짓 적발' : '진실'}`
    : null;
  const winner = state.winner ? `🏆 승자: <@${state.winner.userId}>` : null;

  return [
    '╭─ 🃏 **LIAR\'S BAR TABLE**',
    state.status === 'complete'
      ? '│ 상태  종료'
      : `│ 라운드 **${state.round}** · 테이블 카드 ${formatLiarsBarCardType(state.tableType)}`,
    state.status === 'complete'
      ? '╰─ 게임 종료'
      : `╰─ Turn <@${state.currentPlayer?.userId}>`,
    lastClaim,
    lastReveal,
    winner,
    '',
    '👥 **플레이어**',
    playerLines
  ].filter(Boolean).join('\n');
}

export function formatLiarsBarHand({ game, hand }) {
  const cardLines = hand.length > 0
    ? formatLiarsBarCardGrid(hand)
    : '손패가 비어 있습니다. 차례가 오면 `/라이어바 라이어`만 가능합니다.';
  return [
    `🃏 **내 라이어바 손패**  ·  ${hand.length}장`,
    `테이블 카드: ${formatLiarsBarCardType(game.tableType)}  ·  조커는 어떤 주장에도 안전`,
    `차례: ${game.currentPlayer ? `<@${game.currentPlayer.userId}>` : '없음'}`,
    game.previousPlay ? `직전 주장: <@${game.previousPlay.player.userId}>님이 **${game.previousPlay.count}장** 제출` : '직전 주장 없음',
    '',
    '🎴 **카드 선택 번호**',
    cardLines,
    '',
    'Tip: 아래 선택 메뉴로 1~3장을 바로 내거나, 의심하려면 공개 테이블의 **LIAR 선언** 버튼을 누르세요.'
  ].filter(Boolean).join('\n');
}

export function formatLiarsBarActionResult(result) {
  return [
    ...result.events.map((event) => `• ${event}`),
    '',
    formatLiarsBarStatus(result.game)
  ].join('\n');
}

function createLiarsBarLobbyPayload(state, {
  suffix = null,
  components = [createLiarsBarLobbyActionRow(state)]
} = {}) {
  return {
    content: [formatLiarsBarLobbyMessage(state), suffix].filter(Boolean).join('\n\n'),
    embeds: [createLiarsBarLobbyEmbed(state)],
    components,
    allowedMentions: { parse: [] }
  };
}

function createLiarsBarStartPayload(state) {
  return {
    content: formatLiarsBarStartMessage(state),
    embeds: [createLiarsBarStatusEmbed(state, {
      title: '🃏 LIAR\'S BAR START!',
      footer: '내 손패 버튼은 본인에게만 보입니다.'
    })],
    components: createLiarsBarComponents(state),
    allowedMentions: { parse: [] }
  };
}

function createLiarsBarStatusPayload(state, { prefix = null } = {}) {
  if (state.status === 'lobby') {
    const payload = createLiarsBarLobbyPayload(state);
    return {
      ...payload,
      content: [prefix, payload.content].filter(Boolean).join('\n')
    };
  }

  return {
    content: [prefix, formatLiarsBarStatus(state)].filter(Boolean).join('\n'),
    embeds: [createLiarsBarStatusEmbed(state)],
    components: createLiarsBarComponents(state),
    allowedMentions: { parse: [] }
  };
}

function createLiarsBarHandPayload(result, userId) {
  return {
    content: formatLiarsBarHand(result),
    embeds: [createLiarsBarHandEmbed(result)],
    components: createLiarsBarHandComponents(result, userId),
    allowedMentions: { parse: [] }
  };
}

function createLiarsBarActionPayload(result) {
  return {
    content: formatLiarsBarActionResult(result),
    embeds: [
      createLiarsBarActionEmbed(result),
      createLiarsBarStatusEmbed(result.game)
    ],
    components: createLiarsBarComponents(result.game),
    allowedMentions: { parse: [] }
  };
}

function createLiarsBarSelectionAckPayload(result) {
  return {
    content: [
      '✅ 선택한 카드를 제출했습니다.',
      '공개 테이블 메시지에서 현재 진행 상황을 확인하세요.'
    ].join('\n'),
    embeds: [
      new EmbedBuilder()
        .setTitle('✅ 라이어바 카드 제출 완료')
        .setDescription(result.events.join('\n'))
        .setColor(LIARS_BAR_COLORS.truthful)
        .setFooter({ text: '손패가 바뀌었으면 내 손패 버튼을 다시 눌러주세요.' })
    ],
    components: [],
    allowedMentions: { parse: [] }
  };
}

function createLiarsBarEmptyPayload() {
  return {
    content: '이 채널에는 라이어바 방이 없습니다. `/라이어바 시작`으로 방을 만들 수 있습니다.',
    embeds: [
      new EmbedBuilder()
        .setTitle('🃏 라이어바 방 없음')
        .setDescription('`/라이어바 시작`으로 2~4인 Liar\'s Bar 방을 만들 수 있습니다.')
        .setColor(LIARS_BAR_COLORS.lobby)
    ],
    components: [],
    allowedMentions: { parse: [] }
  };
}

function createLiarsBarLobbyEmbed(state) {
  return new EmbedBuilder()
    .setTitle('🃏 LIAR\'S BAR ROOM')
    .setDescription('참가자를 모은 뒤 방장이 시작합니다. 시작 후 손패는 비공개 버튼/명령으로만 확인합니다.')
    .setColor(LIARS_BAR_COLORS.lobby)
    .addFields(
      {
        name: '인원',
        value: `**${state.players.length}/${LIARS_BAR_MAX_PLAYERS}명** ${createPlayerCapacityBar(state.players.length, LIARS_BAR_MAX_PLAYERS)}\n최소 ${LIARS_BAR_MIN_PLAYERS}명부터 시작 가능`,
        inline: true
      },
      {
        name: '룰',
        value: '5장 손패 · 1~3장 제출 · 조커는 항상 안전 · 벌칙은 6칸 리볼버',
        inline: true
      },
      {
        name: '참가자',
        value: formatLiarsBarParticipants(state),
        inline: false
      },
      {
        name: '명령어',
        value: '`/라이어바 손패` · `/라이어바 내기 카드1:<번호>` · `/라이어바 라이어`',
        inline: false
      }
    );
}

function createLiarsBarStatusEmbed(state, {
  title = '🃏 LIAR\'S BAR TABLE',
  footer = '조커는 어떤 테이블 카드 주장에도 안전합니다.'
} = {}) {
  const color = state.status === 'complete'
    ? LIARS_BAR_COLORS.complete
    : LIARS_BAR_COLORS.playing;
  const currentTurn = state.currentPlayer
    ? `<@${state.currentPlayer.userId}>`
    : '없음';
  const tableSummary = state.status === 'complete'
    ? '게임 종료'
    : `라운드 **${state.round}** · 테이블 카드 ${formatLiarsBarCardType(state.tableType)} · 차례 ${currentTurn}`;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setDescription(tableSummary)
    .addFields(
      {
        name: '직전 주장',
        value: formatLiarsBarPreviousClaim(state),
        inline: false
      },
      {
        name: '플레이어',
        value: formatLiarsBarPlayerBoard(state),
        inline: false
      },
      {
        name: '다음 행동',
        value: state.status === 'playing'
          ? '현재 차례는 카드를 내거나, 직전 주장이 있으면 **LIAR 선언** 버튼으로 의심할 수 있습니다.'
          : state.winner ? `승자: <@${state.winner.userId}>` : '게임이 종료되었습니다.',
        inline: false
      }
    )
    .setFooter({ text: footer });

  if (state.lastReveal) {
    embed.addFields({
      name: '최근 공개',
      value: `${state.lastReveal.cards.map(formatLiarsBarCard).join(' ')}\n${state.lastReveal.hasLiarCard ? '거짓 적발' : '진실'} · 벌칙: <@${state.lastReveal.penaltyPlayer.userId}>`,
      inline: false
    });
  }

  return embed;
}

function createLiarsBarHandEmbed({ game, hand }) {
  return new EmbedBuilder()
    .setTitle(`🔒 내 라이어바 손패 · ${hand.length}장`)
    .setColor(LIARS_BAR_COLORS.hand)
    .setDescription(`테이블 카드: ${formatLiarsBarCardType(game.tableType)}\n차례: ${game.currentPlayer ? `<@${game.currentPlayer.userId}>` : '없음'}`)
    .addFields(
      {
        name: '카드 선택 번호',
        value: hand.length > 0
          ? formatLiarsBarCardGrid(hand)
          : '손패가 비어 있습니다. 차례가 오면 `/라이어바 라이어`만 가능합니다.',
        inline: false
      },
      {
        name: '빠른 입력',
        value: '카드 제출: 아래 선택 메뉴 또는 `/라이어바 내기 카드1:<번호>`\n의심: 공개 테이블의 **LIAR 선언** 버튼 또는 `/라이어바 라이어`',
        inline: false
      }
    )
    .setFooter({ text: '이 손패 메시지는 본인에게만 보입니다.' });
}

function createLiarsBarActionEmbed(result) {
  const isDanger = result.code === 'liar_caught' || result.roulette?.eliminated;
  const title = result.roulette
    ? result.roulette.eliminated ? '💥 라이어바 판정 · 탈락' : '🔫 라이어바 판정 · 생존'
    : '🃏 라이어바 행동';

  return new EmbedBuilder()
    .setTitle(title)
    .setColor(isDanger ? LIARS_BAR_COLORS.danger : LIARS_BAR_COLORS.truthful)
    .setDescription(result.events.join('\n'))
    .addFields(
      {
        name: '현재 차례',
        value: result.game.currentPlayer ? `<@${result.game.currentPlayer.userId}>` : '없음',
        inline: true
      },
      {
        name: '테이블 카드',
        value: result.game.tableType ? formatLiarsBarCardType(result.game.tableType) : '없음',
        inline: true
      }
    );
}

function createLiarsBarLobbyActionRow(state) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`liarsbar_join:${state.id}`)
      .setLabel('참가')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🙋')
      .setDisabled(state.players.length >= LIARS_BAR_MAX_PLAYERS),
    new ButtonBuilder()
      .setCustomId(`liarsbar_start:${state.id}`)
      .setLabel('방장 시작')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('▶️')
      .setDisabled(state.players.length < LIARS_BAR_MIN_PLAYERS),
    new ButtonBuilder()
      .setCustomId(`liarsbar_cancel:${state.id}`)
      .setLabel('취소')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('⏹️')
  );
}

function createLiarsBarComponents(state) {
  if (state.status === 'lobby') return [createLiarsBarLobbyActionRow(state)];
  if (state.status !== 'playing') return [];
  return [createLiarsBarGameActionRow(state)];
}

function createLiarsBarGameActionRow(state) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`liarsbar_hand:${state.id}`)
      .setLabel('내 손패')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🔒'),
    new ButtonBuilder()
      .setCustomId(`liarsbar_call:${state.id}`)
      .setLabel('LIAR 선언')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🕵️')
      .setDisabled(!state.previousPlay)
  );
}

function createLiarsBarHandComponents({ game, hand }, userId) {
  if (game.status !== 'playing'
    || game.currentPlayer?.userId !== userId
    || hand.length <= 0) {
    return [];
  }

  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`liarsbar_play_select:${game.id}:${userId}:${game.round}`)
        .setPlaceholder('낼 카드 1~3장을 선택하면 바로 제출됩니다')
        .setMinValues(1)
        .setMaxValues(Math.min(3, hand.length))
        .addOptions(hand.map((card, index) => ({
          label: `${String(index + 1).padStart(2, '0')}번 ${formatLiarsBarCardOptionLabel(card)}`,
          description: '선택하면 이 카드를 뒤집어 제출합니다.',
          value: String(index + 1)
        })))
    )
  ];
}

function formatLiarsBarCardGrid(cards) {
  const slots = cards.map((card, index) => `${formatCardIndex(index)} ${formatLiarsBarCard(card)}`);
  const rows = [];
  for (let index = 0; index < slots.length; index += 3) {
    rows.push(slots.slice(index, index + 3).join('   '));
  }
  return rows.join('\n');
}

function formatLiarsBarCardOptionLabel(card) {
  return formatLiarsBarCard(card)
    .replaceAll('**', '')
    .replaceAll('`', '');
}

function formatLiarsBarParticipants(state) {
  return state.players
    .map((player, index) => `${formatPlayerSeat(index, state.players.length)} <@${player.userId}>`)
    .join('\n') || '아직 참가자가 없습니다.';
}

function formatLiarsBarPreviousClaim(state) {
  if (!state.previousPlay) return '없음';
  return `<@${state.previousPlay.player.userId}>님이 **${state.previousPlay.count}장**을 ${formatLiarsBarCardType(state.previousPlay.claimedType)}라고 냈습니다.`;
}

function formatLiarsBarPlayerBoard(state) {
  return state.players.map((player, index) => {
    const marker = state.currentPlayer?.userId === player.userId ? '➡️' : player.eliminated ? '☠️' : '▫️';
    const hand = player.eliminated ? '탈락' : `${player.handCount}장`;
    return `${marker} ${formatPlayerSeat(index, state.players.length)} <@${player.userId}> · 손패 ${hand} · 벌칙 ${player.shotsFired}/${LIARS_BAR_REVOLVER_CHAMBERS}`;
  }).join('\n');
}

function formatCardIndex(index) {
  return `\`${String(index + 1).padStart(2, '0')}\``;
}

function createPlayerCapacityBar(count, max) {
  const filled = Math.max(0, Math.min(max, count));
  return `${'●'.repeat(filled)}${'○'.repeat(Math.max(0, max - filled))}`;
}

function formatPlayerSeat(index, total) {
  return `P${String(index + 1).padStart(2, '0')}/${total}`;
}
