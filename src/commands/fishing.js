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
import { SEASON_POINT_SOURCES } from '../systems/seasons.js';
import {
  createAllowedMentionsForUsers,
  formatUserMention,
  truncateEmbedDescription
} from './ui.js';
import { formatSeasonAwardLine } from './seasons.js';

const FISHING_CODEX_PAGE_SIZE = 12;
const FISHING_CODEX_PAGE_BUTTON_PREFIX = 'fishing_codex_page';
const FISHING_CODEX_RARITIES = Object.freeze(['common', 'uncommon', 'rare', 'epic', 'legendary', 'hidden']);

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

export async function handleFishingCommand(interaction, fishing, services = {}) {
  if (interaction.isButton?.()) {
    return handleFishingButton(interaction, fishing, services);
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
    await routeFishingCommand(interaction, fishing, services);
  } catch (error) {
    await interaction.reply({
      content: `낚시 처리 실패: ${error.message}`,
      flags: MessageFlags.Ephemeral
    });
  }

  return true;
}

async function handleFishingButton(interaction, fishing, services = {}) {
  if (interaction.customId?.startsWith(`${FISHING_CODEX_PAGE_BUTTON_PREFIX}:`)) {
    return handleFishingCodexPageButton(interaction, fishing);
  }

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
      const seasonAward = await awardFishingCatchSeasonPoints(services, interaction);
      await replyWithFishCard(interaction, withSeasonAward(formatCatchResult(interaction.user, result), seasonAward), result.fish, interaction.user.id);
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
      await interaction.reply(createFishingCodexPayload(interaction.user, profile, 'all', interaction.user.id, 0));
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

async function handleFishingCodexPageButton(interaction, fishing) {
  const [, rarity, pageText, ownerId] = interaction.customId.split(':');
  if (ownerId && interaction.user.id !== ownerId) {
    await interaction.reply({
      content: '이 낚시 도감 버튼은 명령어를 실행한 유저만 사용할 수 있습니다.',
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
    const profile = await fishing.getProfile(interaction.guildId, interaction.user.id, interaction.user.username);
    await interaction.update(createFishingCodexPayload(
      interaction.user,
      profile,
      rarity,
      interaction.user.id,
      Number.parseInt(pageText, 10)
    ));
    return true;
  } catch (error) {
    await interaction.reply({
      content: `낚시 도감 처리 실패: ${error.message}`,
      flags: MessageFlags.Ephemeral
    });
    return true;
  }
}

async function routeFishingCommand(interaction, fishing, services = {}) {
  const guildId = interaction.guildId;
  const user = interaction.user;

  if (interaction.commandName === '낚시') {
    const result = await fishing.catchFish({
      guildId,
      userId: user.id,
      username: user.username
    });
    const seasonAward = await awardFishingCatchSeasonPoints(services, interaction);
    await replyWithFishCard(interaction, withSeasonAward(formatCatchResult(user, result), seasonAward), result.fish, user.id);
    return;
  }

  if (interaction.commandName === '낚시도감') {
    const profile = await fishing.getProfile(guildId, user.id, user.username);
    const rarity = interaction.options.getString('희귀도') ?? 'all';
    await interaction.reply(createFishingCodexPayload(user, profile, rarity, user.id, 0));
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


async function awardFishingCatchSeasonPoints(services, interaction) {
  if (typeof services?.seasons?.awardPoints !== 'function') return null;

  try {
    return await services.seasons.awardPoints({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      username: interaction.user.username,
      source: SEASON_POINT_SOURCES.FISHING_CATCH,
      points: 20
    });
  } catch (error) {
    services.logger?.debug?.('Failed to award fishing season points:', error);
    return null;
  }
}

function withSeasonAward(content, award) {
  return [content, formatSeasonAwardLine(award)].filter(Boolean).join('\n');
}

function formatCatchResult(user, result) {
  const count = result.profile.inventory[result.fishId] ?? 0;
  const discoveryLine = formatDiscoveryBonus(result);

  return [
    `🎣 **낚시 성공** — ${formatUserMention(user, user.username)}`,
    `획득: **${result.fish.label}** (${getRarityLabel(result.rarity)} / ${result.fish.type})`,
    `크기: **${result.size.toLocaleString()}cm**`,
    discoveryLine,
    `보유 ${result.fish.label}: **${count.toLocaleString()}마리**`,
    `낚싯대: **${formatRodName(result.profile.rod.level)}**`
  ].filter(Boolean).join('\n');
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
  const discoveryLine = formatIdleDiscoveryBonus(result);

  return [
    `🌊 **잠수 보상 정산** — ${formatUserMention(user, user.username)}`,
    `잠수 시간: **${formatMinutes(result.minutes)}** / 획득 물고기: **${result.fishCount.toLocaleString()}마리**`,
    discoveryLine,
    `획득 목록: ${catchSummary}`
  ].filter(Boolean).join('\n');
}

function formatDiscoveryBonus(result) {
  if (!result?.newDiscovery) return null;
  if (result.discoveryXpRewardError) {
    return `🆕 **새 물고기 발견!** 도감에 등록했습니다. XP 지급 실패: ${result.discoveryXpRewardError}`;
  }

  const reward = result.discoveryXpReward;
  const xpGained = reward?.xpGained ?? result.discoveryXpGained ?? 0;
  const levelText = reward?.leveledUp
    ? ` / 🎉 Lv.${reward.profile.level} 레벨업! 보너스 ${reward.levelReward.toLocaleString()}골드`
    : '';

  return `🆕 **새 물고기 발견!** 도감에 등록하고 보너스 **+${xpGained.toLocaleString()} XP**를 획득했습니다${levelText}.`;
}

function formatIdleDiscoveryBonus(result) {
  const discoveries = Array.isArray(result?.discoveries) ? result.discoveries : [];
  if (discoveries.length <= 0) return null;

  const labels = discoveries
    .map((discovery) => discovery.fish.label)
    .join(', ');
  const base = formatDiscoveryBonus({
    newDiscovery: true,
    discoveryXpGained: result.discoveryXpGained,
    discoveryXpReward: result.discoveryXpReward,
    discoveryXpRewardError: result.discoveryXpRewardError
  });

  return `${base}\n새 발견: ${labels}`;
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

function createFishingCodexView(user, profile, rarityFilter = 'all', page = 0) {
  const normalizedFilter = normalizeFishingCodexRarity(rarityFilter);
  const entries = getFishCatalog({ includeHidden: true })
    .map((fish, index) => createFishingCodexEntry(fish, profile, index))
    .filter(isVisibleFishingCodexEntry);
  const visibleEntries = normalizedFilter === 'all'
    ? entries
    : entries.filter((entry) => entry.fish.rarity === normalizedFilter);
  const caughtTotal = entries.filter((entry) => entry.caught).length;
  const progressPercent = entries.length > 0
    ? Math.floor(caughtTotal / entries.length * 1000) / 10
    : 0;
  const rarityProgress = FISHING_CODEX_RARITIES
    .map((rarity) => {
      const rarityEntries = entries.filter((entry) => entry.fish.rarity === rarity);
      if (rarityEntries.length === 0) return null;
      const rarityCaught = rarityEntries.filter((entry) => entry.caught).length;
      return `${getRarityLabel(rarity)} ${rarityCaught}/${rarityEntries.length}`;
    })
    .filter(Boolean)
    .join(' · ');
  const pageEntries = sortFishingCodexEntries(visibleEntries);
  const pageCount = getFishingCodexPageCount(pageEntries.length);
  const currentPage = clampFishingCodexPage(page, pageCount);
  const start = currentPage * FISHING_CODEX_PAGE_SIZE;
  const rows = pageEntries
    .slice(start, start + FISHING_CODEX_PAGE_SIZE)
    .map(formatFishingCodexEntry);
  const viewLabel = normalizedFilter === 'all' ? '전체' : getRarityLabel(normalizedFilter);
  const emptyText = normalizedFilter === 'hidden'
    ? '- 발견한 히든 물고기가 없습니다. 히든 물고기는 잡기 전까지 도감에 표시되지 않습니다.'
    : '- 이 보기에는 표시할 물고기가 없습니다.';

  return {
    normalizedFilter,
    currentPage,
    pageCount,
    content: [
      `📘 **낚시 도감** — ${formatUserMention(user, user.username)}`,
      `진행도: **${caughtTotal}/${entries.length}종 (${progressPercent}%)** / 총 낚시 **${profile.stats.totalCatches.toLocaleString()}회**`,
      `그래프: \`${formatFishingProgressBar(caughtTotal, entries.length)}\``,
      `희귀도별: ${rarityProgress || '표시할 항목 없음'}`,
      `현재 보기: **${viewLabel}** · 페이지 **${currentPage + 1}/${pageCount}**`,
      '',
      `도감 목록:\n${rows.length > 0 ? rows.join('\n') : emptyText}`,
      '',
      '팁: `/낚시도감 희귀도:전설`처럼 희귀도별로 좁혀보고, 버튼으로 페이지를 넘길 수 있습니다.'
    ].join('\n')
  };
}

function createFishingCodexEntry(fish, profile, catalogIndex = 0) {
  const count = profile.inventory[fish.id] ?? 0;
  const firstCaughtAt = profile.collection[fish.id] ?? profile.bestFish[fish.id]?.caughtAt ?? 0;
  const bestSize = profile.bestFish[fish.id]?.size ?? null;

  return {
    fish,
    catalogIndex,
    count,
    firstCaughtAt,
    bestSize,
    caught: count > 0 || firstCaughtAt > 0
  };
}

function isVisibleFishingCodexEntry(entry) {
  return !entry.fish.hidden || entry.caught;
}

function sortFishingCodexEntries(entries) {
  return [...entries].sort((left, right) => {
    if (left.caught !== right.caught) return left.caught ? -1 : 1;
    return left.catalogIndex - right.catalogIndex;
  });
}

function formatFishingCodexEntry(entry) {
  return entry.caught
    ? formatCaughtCodexEntry(entry)
    : formatMissingCodexEntry(entry);
}

function formatCaughtCodexEntry(entry) {
  const bestText = entry.bestSize ? `${entry.bestSize.toLocaleString()}cm` : '???';
  return `* ${entry.fish.label} ${getRarityLabel(entry.fish.rarity)} 최고 ${bestText}`;
}

function formatMissingCodexEntry(entry) {
  return `* ??? ${getRarityLabel(entry.fish.rarity)} ???`;
}

function normalizeFishingCodexRarity(rarity) {
  const normalized = String(rarity ?? 'all').trim().toLocaleLowerCase('ko-KR');
  return FISHING_CODEX_RARITIES.includes(normalized)
    ? normalized
    : 'all';
}

function formatFishingProgressBar(caught, total, width = 16) {
  if (total <= 0) return '░'.repeat(width);
  const rawFilled = Math.round(caught / total * width);
  const filled = Math.min(width, Math.max(caught > 0 ? 1 : 0, rawFilled));
  return `${'█'.repeat(filled)}${'░'.repeat(width - filled)}`;
}

function getFishingCodexPageCount(entryCount) {
  return Math.max(1, Math.ceil(entryCount / FISHING_CODEX_PAGE_SIZE));
}

function clampFishingCodexPage(page, pageCount) {
  const normalizedPage = Math.floor(Number(page) || 0);
  return Math.min(Math.max(0, normalizedPage), Math.max(1, pageCount) - 1);
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

function createFishingCodexPayload(user, profile, rarity = 'all', userId = null, page = 0) {
  const view = createFishingCodexView(user, profile, rarity, page);
  return createFishingCardPayload(view.content, {
    color: 0x0ea5e9,
    components: createFishingCodexRows({
      userId,
      rarity: view.normalizedFilter,
      page: view.currentPage,
      pageCount: view.pageCount
    })
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

function createFishingCodexRows({ userId, rarity, page, pageCount }) {
  const rows = createFishingQuickRows(userId);
  if (!userId || pageCount <= 1) return rows;

  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(createFishingCodexPageCustomId(rarity, Math.max(0, page - 1), userId))
      .setLabel('이전')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 0),
    new ButtonBuilder()
      .setCustomId(createFishingCodexPageCustomId(rarity, Math.min(pageCount - 1, page + 1), userId))
      .setLabel('다음')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page >= pageCount - 1)
  ));

  return rows;
}

function createFishingCodexPageCustomId(rarity, page, userId) {
  return `${FISHING_CODEX_PAGE_BUTTON_PREFIX}:${rarity}:${page}:${userId}`;
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
