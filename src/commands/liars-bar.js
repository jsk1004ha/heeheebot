import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  SlashCommandBuilder
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
      await interaction.reply({
        content: formatLiarsBarLobbyMessage(state),
        components: [createLiarsBarLobbyActionRow(state)],
        allowedMentions: { parse: [] }
      });
      return true;
    }

    if (subcommand === '상태') {
      const state = manager.getGame({
        guildId: interaction.guildId,
        channelId: interaction.channelId
      });
      await interaction.reply({
        content: state ? formatLiarsBarStatus(state) : '이 채널에는 라이어바 방이 없습니다. `/라이어바 시작`으로 방을 만들 수 있습니다.',
        components: state ? createLiarsBarComponents(state) : [],
        allowedMentions: { parse: [] }
      });
      return true;
    }

    if (subcommand === '손패') {
      const result = manager.getPlayerHand({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        userId: interaction.user.id
      });
      await interaction.reply({
        content: formatLiarsBarHand(result),
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] }
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
      await interaction.reply({
        content: `⏹️ 라이어바 방을 종료했습니다.\n${formatLiarsBarStatus(state)}`,
        allowedMentions: { parse: [] }
      });
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
        content: formatLiarsBarHand(result),
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] }
      });
    } catch (error) {
      await interaction.reply({
        content: `손패 확인 실패: ${error.message}`,
        flags: MessageFlags.Ephemeral
      });
    }
    return true;
  }

  if (state.status !== 'lobby') {
    await interaction.reply({
      content: '이미 시작된 라이어바 게임입니다. 공개 메시지의 **내 손패** 버튼이나 `/라이어바 내기`, `/라이어바 라이어`를 사용하세요.',
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
    await interaction.update({
      content: formatLiarsBarLobbyMessage(joined),
      components: [createLiarsBarLobbyActionRow(joined)],
      allowedMentions: { parse: [] }
    });
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

    await interaction.update({
      content: `${formatLiarsBarLobbyMessage(state)}\n\n▶️ 방장이 모집을 종료하고 라이어바를 시작했습니다.`,
      components: [],
      allowedMentions: { parse: [] }
    });

    const payload = {
      content: formatLiarsBarStartMessage(started),
      components: createLiarsBarComponents(started),
      allowedMentions: { parse: [] }
    };
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

async function replyWithLiarsBarActionResult(interaction, result) {
  const payload = result.ok
    ? formatLiarsBarActionResult(result)
    : `❌ ${result.reason}`;

  await interaction.reply({
    content: payload,
    components: result.ok ? createLiarsBarComponents(result.game) : [],
    flags: result.ok ? undefined : MessageFlags.Ephemeral,
    allowedMentions: { parse: [] }
  });
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
    'Tip: `/라이어바 내기 카드1:<번호> 카드2:<번호> 카드3:<번호>`로 1~3장을 내거나, 의심하려면 `/라이어바 라이어`.'
  ].filter(Boolean).join('\n');
}

export function formatLiarsBarActionResult(result) {
  return [
    ...result.events.map((event) => `• ${event}`),
    '',
    formatLiarsBarStatus(result.game)
  ].join('\n');
}

function createLiarsBarLobbyActionRow(state) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`liarsbar_join:${state.id}`)
      .setLabel('참가')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`liarsbar_start:${state.id}`)
      .setLabel('방장 시작')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`liarsbar_cancel:${state.id}`)
      .setLabel('취소')
      .setStyle(ButtonStyle.Danger)
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
      .setEmoji('🔒')
  );
}

function formatLiarsBarCardGrid(cards) {
  const slots = cards.map((card, index) => `${formatCardIndex(index)} ${formatLiarsBarCard(card)}`);
  const rows = [];
  for (let index = 0; index < slots.length; index += 3) {
    rows.push(slots.slice(index, index + 3).join('   '));
  }
  return rows.join('\n');
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
