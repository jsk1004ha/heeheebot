import { existsSync } from 'node:fs';
import { basename } from 'node:path';
import {
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder
} from 'discord.js';
import {
  getFishingRodAssetForLevel
} from '../systems/fishing-assets.js';
import {
  getFishCatalog,
  getFishConfig,
  getRarityLabel
} from '../systems/fishing.js';
import {
  createAllowedMentionsForUsers,
  formatUserMention,
  truncateEmbedDescription
} from './ui.js';

export const fishingCommands = [
  new SlashCommandBuilder()
    .setName('낚시')
    .setDescription('낚싯대로 물고기를 잡아 수집합니다.'),
  new SlashCommandBuilder()
    .setName('낚시도감')
    .setDescription('잡은 물고기와 미발견 물고기, 희귀도별 수집률을 봅니다.')
    .addStringOption((option) =>
      option
        .setName('희귀도')
        .setDescription('보고 싶은 희귀도')
        .addChoices(
          { name: '전체', value: 'all' },
          { name: '일반', value: 'common' },
          { name: '고급', value: 'uncommon' },
          { name: '희귀', value: 'rare' },
          { name: '영웅', value: 'epic' },
          { name: '전설', value: 'legendary' },
          { name: '히든', value: 'hidden' }
        )
    ),
  new SlashCommandBuilder()
    .setName('낚시강화')
    .setDescription('골드를 사용해 낚싯대를 1~20강까지 강화합니다.'),
  new SlashCommandBuilder()
    .setName('잠수')
    .setDescription('잠수를 시작하거나 종료해서 방치 보상을 받습니다.'),
  new SlashCommandBuilder()
    .setName('물고기팀설정')
    .setDescription('물고기배틀에 사용할 팀 슬롯을 설정합니다.')
    .addIntegerOption((option) =>
      option
        .setName('슬롯')
        .setDescription('팀 슬롯 번호')
        .setMinValue(1)
        .setMaxValue(3)
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('물고기')
        .setDescription('팀에 넣을 보유 물고기 이름 또는 id')
        .setMaxLength(50)
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('물고기배틀')
    .setDescription('설정한 물고기 팀으로 랜덤 기존 유저 또는 지정 유저와 배틀합니다.')
    .addUserOption((option) =>
      option
        .setName('상대')
        .setDescription('비우면 물고기 팀을 가진 기존 유저 중 랜덤으로 매칭합니다.')
    )
];

export function getFishingCommandPayloads() {
  return fishingCommands.map((command) => command.toJSON());
}

export async function handleFishingCommand(interaction, fishing) {
  if (interaction.isButton?.()) {
    return handleFishingButton(interaction, fishing);
  }

  if (!interaction.isChatInputCommand() || !isFishingCommand(interaction.commandName)) {
    return false;
  }

  if (!interaction.inGuild()) {
    await interaction.reply({
      content: '서버에서만 사용할 수 있는 명령어입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  try {
    await routeFishingCommand(interaction, fishing);
  } catch (error) {
    await interaction.reply({
      content: `낚시 처리 실패: ${error.message}`,
      flags: MessageFlags.Ephemeral
    });
  }

  return true;
}

async function handleFishingButton(interaction, fishing) {
  if (!interaction.customId?.startsWith('fishing_quick:')) return false;

  const [, action, ownerId] = interaction.customId.split(':');
  if (ownerId && interaction.user.id !== ownerId) {
    await interaction.reply({
      content: '이 낚시 버튼은 명령어를 실행한 유저만 사용할 수 있습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (!interaction.inGuild()) {
    await interaction.reply({
      content: '서버에서만 사용할 수 있는 명령어입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  try {
    if (action === 'fish') {
      const result = await fishing.catchFish({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        username: interaction.user.username
      });
      await replyWithFishCard(interaction, formatCatchResult(interaction.user, result), result.fish, interaction.user.id);
      return true;
    }

    if (action === 'enhance') {
      const result = await fishing.enhanceRod({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        username: interaction.user.username
      });
      await replyWithRodCard(interaction, formatEnhancementResult(interaction.user, result), result.afterLevel, interaction.user.id);
      return true;
    }

    if (action === 'codex') {
      const profile = await fishing.getProfile(interaction.guildId, interaction.user.id, interaction.user.username);
      await interaction.reply(createFishingCodexPayload(interaction.user, profile, 'all', interaction.user.id));
      return true;
    }

    await interaction.reply({
      content: '알 수 없는 낚시 버튼입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  } catch (error) {
    await interaction.reply({
      content: `낚시 처리 실패: ${error.message}`,
      flags: MessageFlags.Ephemeral
    });
    return true;
  }
}

async function routeFishingCommand(interaction, fishing) {
  const guildId = interaction.guildId;
  const user = interaction.user;

  if (interaction.commandName === '낚시') {
    const result = await fishing.catchFish({
      guildId,
      userId: user.id,
      username: user.username
    });
    await replyWithFishCard(interaction, formatCatchResult(user, result), result.fish, user.id);
    return;
  }

  if (interaction.commandName === '낚시도감') {
    const profile = await fishing.getProfile(guildId, user.id, user.username);
    const rarity = interaction.options.getString('희귀도') ?? 'all';
    await interaction.reply(createFishingCodexPayload(user, profile, rarity, user.id));
    return;
  }

  if (interaction.commandName === '낚시강화') {
    const result = await fishing.enhanceRod({
      guildId,
      userId: user.id,
      username: user.username
    });
    await replyWithRodCard(interaction, formatEnhancementResult(user, result), result.afterLevel, user.id);
    return;
  }

  if (interaction.commandName === '잠수') {
    const result = await fishing.toggleIdle({
      guildId,
      userId: user.id,
      username: user.username
    });
    await interaction.reply(formatIdleResult(user, result));
    return;
  }

  if (interaction.commandName === '물고기팀설정') {
    const result = await fishing.setTeamSlot({
      guildId,
      userId: user.id,
      username: user.username,
      slot: interaction.options.getInteger('슬롯', true),
      fishId: interaction.options.getString('물고기', true)
    });
    await replyWithFishCard(interaction, formatTeamResult(user, result), result.fish);
    return;
  }

  if (interaction.commandName === '물고기배틀') {
    const opponent = interaction.options.getUser('상대');
    if (opponent?.bot) {
      throw new Error('봇 유저와는 물고기배틀을 할 수 없습니다.');
    }

    const result = await fishing.battleFishTeam({
      guildId,
      userId: user.id,
      username: user.username,
      opponentUserId: opponent?.id ?? null,
      opponentUsername: opponent?.username ?? '상대',
      difficulty: interaction.options.getString('난이도') ?? 'normal'
    });
    await interaction.reply(formatBattleResult(user, opponent, result));
    return;
  }
}

function formatCatchResult(user, result) {
  const count = result.profile.inventory[result.fishId] ?? 0;

  return [
    `🎣 **낚시 성공** — ${formatUserMention(user, user.username)}`,
    `획득: **${result.fish.label}** (${getRarityLabel(result.rarity)} / ${result.fish.type})`,
    `크기: **${result.size.toLocaleString()}cm**`,
    `보유 ${result.fish.label}: **${count.toLocaleString()}마리**`,
    `낚싯대: **${formatRodName(result.profile.rod.level)}**`
  ].join('\n');
}

function formatEnhancementResult(user, result) {
  if (result.capped) {
    return `🎣 **낚싯대 강화** — ${formatUserMention(user, user.username)}\n이미 최고 강화 단계입니다. 현재 낚싯대: **${formatRodName(result.afterLevel)}**`;
  }

  const outcomeText = {
    success: '✅ 성공',
    maintain: '➖ 유지',
    destroy: '💥 파괴'
  }[result.outcome];
  const beforeRodName = formatRodName(result.beforeLevel);
  const afterRodName = formatRodName(result.afterLevel);
  const levelText = result.outcome === 'destroy'
    ? `${beforeRodName} → ${afterRodName}로 리셋`
    : `${beforeRodName} → ${afterRodName}`;

  return [
    `🎣 **낚싯대 강화** — ${formatUserMention(user, user.username)}`,
    `결과: **${outcomeText}** (${levelText})`,
    `현재 낚싯대: **${afterRodName}**`,
    `사용 골드: **${formatGold(result.cost)}** / 남은 골드: **${formatGold(result.goldBalanceAfter)}**`,
    `누적 시도: **${result.profile.rod.totalEnhancementAttempts.toLocaleString()}회** / 파괴: **${result.profile.rod.destroyedCount.toLocaleString()}회**`
  ].join('\n');
}

function formatIdleResult(user, result) {
  if (result.action === 'started') {
    return [
      `🌊 **잠수 시작** — ${formatUserMention(user, user.username)}`,
      '다시 `/잠수`를 입력하면 방치 보상을 정산합니다.',
      '보상은 최대 12시간까지만 누적됩니다.'
    ].join('\n');
  }

  const catchSummary = summarizeCatches(result.catches);

  return [
    `🌊 **잠수 보상 정산** — ${formatUserMention(user, user.username)}`,
    `잠수 시간: **${formatMinutes(result.minutes)}** / 획득 물고기: **${result.fishCount.toLocaleString()}마리**`,
    `획득 목록: ${catchSummary}`
  ].join('\n');
}

function formatTeamResult(user, result) {
  const rows = result.team.map((entry) =>
    `${entry.slot}. **${entry.fish.label}** (${getRarityLabel(entry.fish.rarity)}${entry.bestSize ? ` / 최고 ${entry.bestSize}cm` : ''})`
  );

  return [
    `🐟 **물고기 팀 설정** — ${formatUserMention(user, user.username)}`,
    `${result.slot}번 슬롯에 **${result.fish.label}**을(를) 배치했습니다.`,
    `현재 팀:\n${rows.join('\n')}`
  ].join('\n');
}

function formatFishingCodex(user, profile, rarityFilter = 'all') {
  const normalizedFilter = normalizeFishingCodexRarity(rarityFilter);
  const catalog = getFishCatalog({ includeHidden: true });
  const entries = catalog.map((fish) => createFishingCodexEntry(fish, profile));
  const visibleEntries = normalizedFilter === 'all'
    ? entries
    : entries.filter((entry) => entry.fish.rarity === normalizedFilter);
  const caughtTotal = entries.filter((entry) => entry.caught).length;
  const progressPercent = catalog.length > 0
    ? Math.floor(caughtTotal / catalog.length * 1000) / 10
    : 0;
  const rarityProgress = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'hidden']
    .map((rarity) => {
      const rarityEntries = entries.filter((entry) => entry.fish.rarity === rarity);
      const rarityCaught = rarityEntries.filter((entry) => entry.caught).length;
      return `${getRarityLabel(rarity)} ${rarityCaught}/${rarityEntries.length}`;
    })
    .join(' · ');
  const caughtRows = visibleEntries
    .filter((entry) => entry.caught)
    .slice(0, 10)
    .map(formatCaughtCodexEntry);
  const missingRows = visibleEntries
    .filter((entry) => !entry.caught)
    .slice(0, Math.max(4, 12 - caughtRows.length))
    .map(formatMissingCodexEntry);
  const viewLabel = normalizedFilter === 'all' ? '전체' : getRarityLabel(normalizedFilter);

  return [
    `📘 **낚시 도감** — ${formatUserMention(user, user.username)}`,
    `진행도: **${caughtTotal}/${catalog.length}종 (${progressPercent}%)** / 총 낚시 **${profile.stats.totalCatches.toLocaleString()}회**`,
    `희귀도별: ${rarityProgress}`,
    `현재 보기: **${viewLabel}**`,
    '',
    `발견한 물고기:\n${caughtRows.length > 0 ? caughtRows.join('\n') : '- 아직 발견한 물고기가 없습니다.'}`,
    '',
    `미발견 물고기:\n${missingRows.length > 0 ? missingRows.join('\n') : '- 이 보기에서는 전부 발견했습니다.'}`,
    '',
    '팁: `/낚시도감 희귀도:전설`처럼 희귀도별로 좁혀볼 수 있습니다.'
  ].join('\n');
}

function createFishingCodexEntry(fish, profile) {
  const count = profile.inventory[fish.id] ?? 0;
  const firstCaughtAt = profile.collection[fish.id] ?? profile.bestFish[fish.id]?.caughtAt ?? 0;
  const bestSize = profile.bestFish[fish.id]?.size ?? null;

  return {
    fish,
    count,
    firstCaughtAt,
    bestSize,
    caught: count > 0 || firstCaughtAt > 0
  };
}

function formatCaughtCodexEntry(entry) {
  const bestText = entry.bestSize ? ` · 최고 ${entry.bestSize.toLocaleString()}cm` : '';
  return `✅ **${entry.fish.label}** (${getRarityLabel(entry.fish.rarity)} / ${entry.fish.type}) ×${entry.count.toLocaleString()}${bestText}`;
}

function formatMissingCodexEntry(entry) {
  const label = entry.fish.hidden ? '???' : entry.fish.label;
  return `⬜ **${label}** (${getRarityLabel(entry.fish.rarity)} / ${entry.fish.type})`;
}

function normalizeFishingCodexRarity(rarity) {
  const normalized = String(rarity ?? 'all').trim().toLocaleLowerCase('ko-KR');
  return ['common', 'uncommon', 'rare', 'epic', 'legendary', 'hidden'].includes(normalized)
    ? normalized
    : 'all';
}

function formatBattleResult(user, opponent, result) {
  const playerMention = formatUserMention(user);
  const opponentMention = opponent
    ? formatUserMention(opponent)
    : result.opponentUserId
      ? `<@${result.opponentUserId}>`
      : result.opponentLabel;
  const winnerText = result.winner === 'player'
    ? `${playerMention} 승리`
    : result.winner === 'opponent'
      ? `${opponentMention} 승리`
      : '무승부';
  const playerRows = summarizeBattleTeam(result.playerTeam);
  const opponentRows = summarizeBattleTeam(result.opponentTeam);
  const mentionedUsers = [user.id, opponent?.id ?? result.opponentUserId]
    .filter(Boolean)
    .map(String);

  return {
    content: [
      `⚔️ **물고기배틀** — ${playerMention}`,
      `상대: **${opponentMention}**`,
      `결과: **${winnerText}**`,
      `내 팀: ${playerRows}`,
      `상대 팀: ${opponentRows}`,
      `전투 로그:\n${result.log.join('\n') || '- 기록 없음'}`,
      `전적: **${result.profile.battle.wins}승 ${result.profile.battle.losses}패 ${result.profile.battle.draws}무**`
    ].join('\n'),
    allowedMentions: createAllowedMentionsForUsers(mentionedUsers)
  };
}

function summarizeCatches(catches) {
  const counts = new Map();
  for (const catchResult of catches) {
    counts.set(catchResult.fishId, (counts.get(catchResult.fishId) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([fishId, count]) => `${getFishConfig(fishId).label} × ${count}`)
    .join(', ');
}

function summarizeBattleTeam(team) {
  return team
    .map((fish) => `${fish.name} ${Math.max(0, fish.hp)}/${fish.maxHp}HP`)
    .join(', ');
}

function formatMinutes(minutes) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours > 0) return `${hours}시간 ${rest}분`;
  return `${rest}분`;
}

function formatRodName(level) {
  return getFishingRodAssetForLevel(level)?.label ?? `+${Number(level) || 1}강 낚싯대`;
}

function formatGold(amount) {
  return `${Number(amount ?? 0).toLocaleString()}골드`;
}

function isFishingCommand(commandName) {
  return fishingCommands.some((command) => command.name === commandName);
}

async function replyWithFishCard(interaction, content, fish, userId = null) {
  await interaction.reply(createFishCardPayload(content, fish, userId));
}

async function updateWithFishCard(interaction, content, fish, userId = null) {
  await interaction.update(createFishCardPayload(content, fish, userId));
}

function createFishCardPayload(content, fish, userId = null) {
  const imagePath = fish?.imagePath;
  return createFishingCardPayload(content, {
    imagePath: imagePath && existsSync(imagePath) ? imagePath : null,
    color: getFishingEmbedColor(fish?.rarity),
    components: createFishingQuickRows(userId)
  });
}

async function replyWithRodCard(interaction, content, rodLevel, userId = null) {
  await interaction.reply(createRodCardPayload(content, rodLevel, userId));
}

async function updateWithRodCard(interaction, content, rodLevel, userId = null) {
  await interaction.update(createRodCardPayload(content, rodLevel, userId));
}

function createRodCardPayload(content, rodLevel, userId = null) {
  const rodAsset = getFishingRodAssetForLevel(rodLevel);
  return createFishingCardPayload(content, {
    imagePath: rodAsset?.imagePath && existsSync(rodAsset.imagePath) ? rodAsset.imagePath : null,
    color: getRodEmbedColor(rodLevel),
    components: createFishingQuickRows(userId)
  });
}

function createFishingCodexPayload(user, profile, rarity = 'all', userId = null) {
  return createFishingCardPayload(formatFishingCodex(user, profile, rarity), {
    color: 0x0ea5e9,
    components: createFishingQuickRows(userId)
  });
}

function createFishingCardPayload(content, { imagePath = null, color = 0x38bdf8, components = [] } = {}) {
  const [rawTitle, ...bodyLines] = String(content).split('\n');
  const title = rawTitle.replace(/\*\*/g, '').slice(0, 256);
  const description = truncateEmbedDescription(bodyLines.join('\n').trim() || rawTitle);
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description);

  const payload = { embeds: [embed] };
  if (components.length > 0) payload.components = components;
  if (imagePath) {
    embed.setImage(`attachment://${basename(imagePath)}`);
    payload.files = [imagePath];
  }

  return payload;
}

function createFishingQuickRows(userId) {
  if (!userId) return [];
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`fishing_quick:fish:${userId}`)
        .setLabel('낚시')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`fishing_quick:enhance:${userId}`)
        .setLabel('낚싯대 강화')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`fishing_quick:codex:${userId}`)
        .setLabel('도감')
        .setStyle(ButtonStyle.Success)
    )
  ];
}

function getFishingEmbedColor(rarity) {
  return {
    common: 0x94a3b8,
    uncommon: 0x22c55e,
    rare: 0x3b82f6,
    epic: 0xa855f7,
    legendary: 0xf59e0b,
    hidden: 0xec4899
  }[rarity] ?? 0x38bdf8;
}

function getRodEmbedColor(level) {
  if (level >= 20) return 0xfacc15;
  if (level >= 15) return 0xa855f7;
  if (level >= 10) return 0x3b82f6;
  if (level >= 5) return 0x22c55e;
  return 0x94a3b8;
}
