import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  SlashCommandBuilder
} from 'discord.js';

const START_BUTTON_PREFIX = 'start:';

export const startCommands = [
  new SlashCommandBuilder()
    .setName('시작하기')
    .setDescription('처음 하는 유저를 위한 희희봇 핵심 루트 가이드를 봅니다.')
];

export function getStartCommandPayloads() {
  return startCommands.map((command) => command.toJSON());
}

export async function handleStartCommand(interaction, services = {}) {
  if (interaction.isButton?.()) {
    return handleStartButton(interaction, services);
  }

  if (!interaction.isChatInputCommand?.() || interaction.commandName !== '시작하기') {
    return false;
  }

  if (!interaction.inGuild?.()) {
    await interaction.reply({
      content: '서버에서만 사용할 수 있는 명령어입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  await interaction.reply(await createStartPayload(interaction, services));
  return true;
}

async function handleStartButton(interaction, services) {
  if (!interaction.customId?.startsWith(START_BUTTON_PREFIX)) return false;

  const [, action, ownerUserId] = interaction.customId.split(':');
  if (interaction.user.id !== ownerUserId) {
    await interaction.reply({
      content: '이 시작하기 버튼은 명령어를 실행한 유저만 누를 수 있습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (!interaction.inGuild?.()) {
    await interaction.reply({
      content: '서버에서만 사용할 수 있는 명령어입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (action === 'refresh') {
    await interaction.update(await createStartPayload(interaction, services));
    return true;
  }

  const hints = {
    today: '오늘 루트는 `/오늘할일`에서 한 번에 확인하세요.',
    season: '시즌 진행도와 보상은 `/시즌 정보`와 `/시즌 과제`에서 확인하세요.',
    help: '전체 명령어는 `/도움말`에서 분류별로 볼 수 있습니다.'
  };

  await interaction.reply({
    content: hints[action] ?? '알 수 없는 시작하기 버튼입니다.',
    flags: MessageFlags.Ephemeral
  });
  return true;
}

async function createStartPayload(interaction, services) {
  const context = await buildStartContext(interaction, services);

  return {
    content: formatStartGuide(context),
    components: createStartRows(context)
  };
}

async function buildStartContext(interaction, services) {
  const base = createBaseContext(interaction);
  const [communityOverview, rpgStatus, swordStatus, fishingStatus, stockOverview, seasonOverview] = await Promise.all([
    services.community?.getOverview ? services.community.getOverview(base).catch(() => null) : null,
    services.economy?.getRpgStatus ? services.economy.getRpgStatus(base).catch(() => null) : null,
    services.economy?.getSwordStatus ? services.economy.getSwordStatus(base).catch(() => null) : null,
    services.fishing?.getProfile ? services.fishing.getProfile(base.guildId, base.userId, base.username).catch(() => null) : null,
    services.stocks?.getPortfolio ? services.stocks.getPortfolio(base).catch(() => null) : null,
    services.seasons?.getOverview ? services.seasons.getOverview(base).catch(() => null) : null
  ]);

  const profile = rpgStatus?.profile ?? communityOverview?.profile ?? {};
  const communityProfile = profile.community ?? communityOverview?.profile?.community ?? communityOverview?.community ?? null;
  const rpg = rpgStatus?.profile?.rpg ?? rpgStatus?.rpg ?? rpgStatus ?? {};

  return {
    ...base,
    profile: {
      ...profile,
      community: communityProfile
    },
    rpg,
    swordStatus,
    fishingStatus,
    stockOverview,
    seasonOverview
  };
}

function createBaseContext(interaction) {
  return {
    guildId: interaction.guildId,
    userId: interaction.user.id,
    username: interaction.user.username
  };
}

function formatStartGuide(context) {
  const steps = buildStartSteps(context);
  const completed = steps.filter((step) => step.complete).length;
  const firstIncompleteIndex = steps.findIndex((step) => !step.complete);
  const next = firstIncompleteIndex >= 0 ? steps[firstIncompleteIndex] : { command: '`/오늘할일`' };

  return [
    `🚀 **희희봇 시작하기** — ${context.username}`,
    `진행도 ${completed}/7`,
    '',
    ...steps.map((step, index) => `${getStepIcon(step, index, firstIncompleteIndex)} ${index + 1}. ${step.label} ${step.command}`),
    '',
    `다음 추천: ${next.command}`
  ].join('\n');
}

function buildStartSteps({ profile, rpg, swordStatus, fishingStatus, stockOverview, seasonOverview }) {
  return [
    {
      label: '출석 받기',
      command: '`/출석`',
      complete: profile.lastDailyDay !== null && profile.lastDailyDay !== undefined
    },
    {
      label: '프로필 확인',
      command: '`/프로필`',
      complete: (profile.community?.stats?.commandsUsed ?? 0) > 0
    },
    {
      label: 'RPG 시작',
      command: '`/rpg 시작`',
      complete: (rpg.startedAt ?? 0) > 0
    },
    {
      label: '낚시 1회',
      command: '`/낚시`',
      complete: (fishingStatus?.stats?.totalCatches ?? 0) > 0
    },
    {
      label: '검 선물받기',
      command: '`/선물받기`',
      complete: swordStatus?.giftAvailable === false
    },
    {
      label: '주식 거래 입문',
      command: '`/주식 매수` 또는 `/주식 시세`',
      complete: (stockOverview?.tradeCount ?? 0) > 0 || (stockOverview?.positions?.length ?? 0) > 0
    },
    {
      label: '시즌 정보 확인',
      command: '`/시즌 정보`',
      complete: (seasonOverview?.profile?.totalPoints ?? 0) > 0
    }
  ];
}

function getStepIcon(step, index, firstIncompleteIndex) {
  if (step.complete) return '✅';
  if (index === firstIncompleteIndex) return '🎯';
  return '⬜';
}

function createStartRows(context) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`start:refresh:${context.userId}`)
        .setLabel('새로고침')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`start:today:${context.userId}`)
        .setLabel('오늘할일')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`start:season:${context.userId}`)
        .setLabel('시즌')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`start:help:${context.userId}`)
        .setLabel('도움말')
        .setStyle(ButtonStyle.Secondary)
    )
  ];
}
