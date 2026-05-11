import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  SlashCommandBuilder
} from 'discord.js';
import {
  UNO_COLORS,
  UNO_MODES,
  UnoGameManager,
  formatUnoCard,
  formatUnoColor,
  formatUnoDirection,
  normalizeUnoRules
} from '../systems/uno.js';

export const UNO_MAX_PLAYERS = 10;

const DEFAULT_UNO_MANAGER = new UnoGameManager();
const UNO_COLOR_CHOICES = Object.freeze([
  { name: '빨강', value: 'red' },
  { name: '노랑', value: 'yellow' },
  { name: '초록', value: 'green' },
  { name: '파랑', value: 'blue' }
]);
const UNO_MODE_CHOICES = Object.freeze([
  { name: '기본(스태킹 + 세븐-O)', value: UNO_MODES.house.value },
  { name: '클래식', value: UNO_MODES.classic.value },
  { name: "UNO Show'em No Mercy", value: UNO_MODES.noMercy.value }
]);
const UNO_STACKING_CHOICES = Object.freeze([
  { name: '스태킹(동급/상위 드로우만)', value: 'stacking' },
  { name: 'Anything stacks(아무 드로우 중첩)', value: 'anything' },
  { name: '중첩 끔', value: 'off' }
]);

export const unoCommands = [
  new SlashCommandBuilder()
    .setName('우노')
    .setDescription('버튼으로 방을 만들고 하우스 룰/No Mercy 모드까지 선택해 우노를 진행합니다.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('시작')
        .setDescription('우노 방을 만들고 참가자를 모집합니다. 기본은 스태킹 + 세븐-O입니다.')
        .addStringOption((option) =>
          option
            .setName('모드')
            .setDescription('플레이할 우노 모드')
            .addChoices(...UNO_MODE_CHOICES)
        )
        .addStringOption((option) =>
          option
            .setName('중첩')
            .setDescription('드로우 카드 중첩 규칙. 기본 모드는 스태킹입니다.')
            .addChoices(...UNO_STACKING_CHOICES)
        )
        .addBooleanOption((option) =>
          option
            .setName('세븐오')
            .setDescription('0 손패 회전, 7 손패 교환 룰 적용 여부')
        )
        .addBooleanOption((option) =>
          option
            .setName('드로우4도전')
            .setDescription('와일드 드로우 4 도전 허용 여부. 끄면 No bluffing입니다.')
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('상태')
        .setDescription('현재 채널의 우노 방/게임 상태를 확인합니다.')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('손패')
        .setDescription('내 우노 손패를 비공개로 확인합니다.')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('내기')
        .setDescription('내 차례에 손패 번호의 카드를 냅니다.')
        .addIntegerOption((option) =>
          option
            .setName('번호')
            .setDescription('`/우노 손패`에 표시된 1부터 시작하는 카드 번호')
            .setMinValue(1)
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('색')
            .setDescription('와일드 계열 카드를 낼 때 바꿀 색')
            .addChoices(...UNO_COLOR_CHOICES)
        )
        .addUserOption((option) =>
          option
            .setName('대상')
            .setDescription('세븐-O 7 카드로 손패를 바꿀 대상')
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('뽑기')
        .setDescription('카드를 뽑습니다. 누적 드로우가 있으면 벌칙 카드를 받습니다.')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('도전')
        .setDescription('허용된 방에서 와일드 드로우 4에 도전합니다.')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('종료')
        .setDescription('방장이 현재 채널의 우노 방/게임을 종료합니다.')
    )
];

export function getUnoCommandPayloads() {
  return unoCommands.map((command) => command.toJSON());
}

export async function handleUnoCommand(interaction, manager = DEFAULT_UNO_MANAGER, logger = console) {
  if (interaction.isButton?.() && interaction.customId?.startsWith('uno_')) {
    return handleUnoButton(interaction, manager, logger);
  }

  if (!interaction.isChatInputCommand?.() || interaction.commandName !== '우노') {
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
      const mode = interaction.options.getString('모드') ?? UNO_MODES.house.value;
      const state = manager.createLobby({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        host: interaction.user,
        mode,
        rules: parseUnoRuleOptions(interaction, mode)
      });

      await interaction.reply({
        content: formatUnoLobbyMessage(state),
        components: [createUnoLobbyActionRow(state)],
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
        content: state ? formatUnoStatus(state) : '이 채널에는 우노 방이 없습니다. `/우노 시작`으로 방을 만들 수 있습니다.',
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
        content: formatUnoHand(result),
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] }
      });
      return true;
    }

    if (subcommand === '내기') {
      const result = manager.playCard({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        userId: interaction.user.id,
        cardNumber: interaction.options.getInteger('번호', true),
        chosenColor: interaction.options.getString('색'),
        targetUserId: interaction.options.getUser('대상')?.id ?? null
      });
      await replyWithUnoActionResult(interaction, result);
      return true;
    }

    if (subcommand === '뽑기') {
      const result = manager.draw({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        userId: interaction.user.id
      });
      await replyWithUnoActionResult(interaction, result);
      return true;
    }

    if (subcommand === '도전') {
      const result = manager.challengeWildDraw4({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        userId: interaction.user.id
      });
      await replyWithUnoActionResult(interaction, result);
      return true;
    }

    if (subcommand === '종료') {
      const state = manager.endGame({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        userId: interaction.user.id
      });
      await interaction.reply({
        content: `⏹️ 우노 방을 종료했습니다.\n${formatUnoStatus(state)}`,
        allowedMentions: { parse: [] }
      });
      return true;
    }
  } catch (error) {
    logger.debug?.('UNO command rejected:', error);
    await interaction.reply({
      content: `우노 처리 실패: ${error.message}`,
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] }
    });
    return true;
  }

  return false;
}

export function parseUnoRuleOptions(interaction, mode = UNO_MODES.house.value) {
  const stackingChoice = interaction.options.getString?.('중첩') ?? null;
  const sevenO = interaction.options.getBoolean?.('세븐오') ?? null;
  const wildDraw4Challenge = interaction.options.getBoolean?.('드로우4도전') ?? null;
  const overrides = {};

  if (stackingChoice === 'stacking') {
    overrides.stacking = true;
    overrides.anythingStacks = false;
  } else if (stackingChoice === 'anything') {
    overrides.stacking = false;
    overrides.anythingStacks = true;
  } else if (stackingChoice === 'off') {
    overrides.stacking = false;
    overrides.anythingStacks = false;
  }

  if (sevenO !== null) overrides.sevenO = sevenO;
  if (wildDraw4Challenge !== null) overrides.wildDraw4Challenge = wildDraw4Challenge;

  return normalizeUnoRules(overrides, mode);
}

async function handleUnoButton(interaction, manager) {
  const [action, gameId] = interaction.customId.split(':');
  const state = manager.getGame({
    guildId: interaction.guildId,
    channelId: interaction.channelId
  });

  if (!state || state.id !== gameId) {
    await interaction.reply({
      content: '이미 종료되었거나 다른 채널의 우노 방입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (state.status !== 'lobby') {
    await interaction.reply({
      content: '이미 시작된 우노 게임입니다. `/우노 손패`, `/우노 내기`, `/우노 뽑기`를 사용하세요.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (interaction.user.bot) {
    await interaction.reply({
      content: '봇 계정은 우노에 참가할 수 없습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (action === 'uno_join') {
    let joined;
    try {
      joined = manager.joinLobby({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        user: interaction.user
      });
    } catch (error) {
      await interaction.reply({
        content: `우노 참가 실패: ${error.message}`,
        flags: MessageFlags.Ephemeral
      });
      return true;
    }
    await interaction.update({
      content: formatUnoLobbyMessage(joined),
      components: [createUnoLobbyActionRow(joined)],
      allowedMentions: { parse: [] }
    });
    return true;
  }

  if (action === 'uno_leave') {
    await interaction.reply({
      content: '우노 모집 나가기는 아직 지원하지 않습니다. 방장이 `/우노 종료` 후 다시 만들 수 있습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (action === 'uno_start') {
    if (interaction.user.id !== state.hostUserId) {
      await interaction.reply({
        content: '방장만 우노 게임을 시작할 수 있습니다.',
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
        content: `우노 시작 실패: ${error.message}`,
        flags: MessageFlags.Ephemeral
      });
      return true;
    }
    await interaction.update({
      content: `${formatUnoLobbyMessage(state)}\n\n▶️ 방장이 모집을 종료하고 우노를 시작했습니다.`,
      components: [],
      allowedMentions: { parse: [] }
    });

    if (typeof interaction.channel?.send === 'function') {
      await interaction.channel.send({
        content: formatUnoStartMessage(started),
        allowedMentions: { parse: [] }
      });
    } else if (typeof interaction.followUp === 'function') {
      await interaction.followUp({
        content: formatUnoStartMessage(started),
        allowedMentions: { parse: [] }
      });
    }
    return true;
  }

  if (action === 'uno_cancel') {
    if (interaction.user.id !== state.hostUserId) {
      await interaction.reply({
        content: '방장만 우노 방을 취소할 수 있습니다.',
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
        content: `우노 취소 실패: ${error.message}`,
        flags: MessageFlags.Ephemeral
      });
      return true;
    }
    await interaction.update({
      content: '⏹️ 방장이 우노 모집을 취소했습니다.',
      components: []
    });
    return true;
  }

  return false;
}

async function replyWithUnoActionResult(interaction, result) {
  const payload = result.ok
    ? formatUnoActionResult(result)
    : `❌ ${result.reason}`;

  await interaction.reply({
    content: payload,
    flags: result.ok ? undefined : MessageFlags.Ephemeral,
    allowedMentions: { parse: [] }
  });
}

export function formatUnoLobbyMessage(state) {
  const participants = state.players
    .map((player, index) => `${index + 1}. <@${player.userId}>`)
    .join('\n');
  return [
    '🃏 **우노 참가자 모집**',
    `모드: **${formatUnoMode(state.mode)}**`,
    `규칙: ${formatUnoRules(state.rules)}`,
    `인원: **${state.players.length}/${UNO_MAX_PLAYERS}명** · 최소 2명`,
    '진행: 참가 버튼으로 들어온 뒤 방장이 **시작** 버튼을 누르면 게임이 시작됩니다.',
    '플레이: 시작 후 `/우노 손패`로 번호를 보고 `/우노 내기 번호:<번호>` 또는 `/우노 뽑기`를 사용하세요.',
    '',
    `참가자:\n${participants}`
  ].join('\n');
}

export function formatUnoStartMessage(state) {
  return [
    '🃏 **우노 시작!**',
    formatUnoStatus(state),
    '',
    '각자 `/우노 손패`로 손패를 비공개 확인하세요.',
    `${formatCurrentTurnLine(state)}`
  ].join('\n');
}

export function formatUnoStatus(state) {
  if (state.status === 'lobby') return formatUnoLobbyMessage(state);

  const playerLines = state.players
    .map((player, index) => {
      const marker = state.currentPlayer?.userId === player.userId ? '➡️ ' : '';
      const eliminated = player.eliminated ? ' 탈락' : '';
      return `${marker}${index + 1}. <@${player.userId}> — ${player.cardCount}장${eliminated}`;
    })
    .join('\n');
  const pendingDraw = state.pendingDraw
    ? `\n누적 드로우: **${state.pendingDraw.amount}장** (동급/상위 드로우로 중첩 가능)`
    : '';
  const challenge = state.pendingChallenge
    ? '\n와일드 드로우 4 도전 가능: `/우노 도전`'
    : '';
  const winner = state.winner
    ? `\n🏆 승자: <@${state.winner.userId}>`
    : '';

  return [
    `모드: **${formatUnoMode(state.mode)}** · 규칙: ${formatUnoRules(state.rules)}`,
    `상태: **${formatUnoState(state.status)}** · 방향: **${formatUnoDirection(state.direction)}**`,
    `현재 색: **${formatUnoColor(state.activeColor)}** · 맨 위 카드: **${formatUnoCard(state.topCard)}**`,
    formatCurrentTurnLine(state),
    pendingDraw,
    challenge,
    winner,
    '',
    playerLines
  ].filter((line) => line !== '').join('\n');
}

export function formatUnoHand({ game, hand }) {
  const cardLines = hand.length > 0
    ? hand.map((card, index) => `${index + 1}. ${formatUnoCard(card)}`).join('\n')
    : '손패가 비어 있습니다.';
  return [
    '🃏 **내 우노 손패**',
    formatCurrentTurnLine(game),
    `현재 색: **${formatUnoColor(game.activeColor)}** · 맨 위 카드: **${formatUnoCard(game.topCard)}**`,
    game.pendingDraw ? `누적 드로우: **${game.pendingDraw.amount}장**` : null,
    '```text',
    cardLines,
    '```',
    '와일드 카드는 `/우노 내기 번호:<번호> 색:<색>`처럼 색을 함께 선택하세요.',
    '세븐-O 7 카드는 참가자가 3명 이상이면 `/우노 내기 번호:<번호> 대상:@유저`처럼 교환 대상을 지정하세요.'
  ].filter(Boolean).join('\n');
}

export function formatUnoActionResult(result) {
  return [
    ...result.events.map((event) => `• ${event}`),
    '',
    formatUnoStatus(result.game)
  ].join('\n');
}

function createUnoLobbyActionRow(state) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`uno_join:${state.id}`)
      .setLabel('참가')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`uno_start:${state.id}`)
      .setLabel('방장 시작')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`uno_cancel:${state.id}`)
      .setLabel('취소')
      .setStyle(ButtonStyle.Danger)
  );
}

function formatCurrentTurnLine(state) {
  if (state.status !== 'playing') return '현재 차례: 아직 시작 전';
  if (!state.currentPlayer) return '현재 차례: 없음';
  return `현재 차례: <@${state.currentPlayer.userId}>`;
}

function formatUnoMode(mode) {
  return Object.values(UNO_MODES).find((entry) => entry.value === mode)?.label ?? mode;
}

function formatUnoRules(rules) {
  const parts = [];
  if (rules.stacking) parts.push('스태킹');
  if (rules.anythingStacks) parts.push('Anything stacks');
  if (rules.sevenO) parts.push('Seven-O');
  parts.push(rules.wildDraw4Challenge ? '드로우4 도전 허용' : 'No bluffing');
  if (rules.drawToMatch) parts.push('Draw-to-match');
  if (rules.forcePlay) parts.push('Force Play');
  if (rules.eliminationHandLimit) parts.push(`${rules.eliminationHandLimit}장 초과 탈락`);
  return parts.join(' · ');
}

function formatUnoState(status) {
  if (status === 'playing') return '진행 중';
  if (status === 'complete') return '종료';
  if (status === 'lobby') return '모집 중';
  return status;
}

export function getDefaultUnoManager() {
  return DEFAULT_UNO_MANAGER;
}
