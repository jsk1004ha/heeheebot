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
import { getMiningPickaxeAssetForLevel } from '../systems/mining-assets.js';
import {
  getMiningRarityLabel,
  getOreCatalog,
  getOreConfig
} from '../systems/mining.js';
import { SEASON_POINT_SOURCES } from '../systems/seasons.js';
import { formatSeasonAwardLine } from './seasons.js';
import {
  formatUserMention,
  splitMentionSafeEmbedContent
} from './ui.js';

const MINING_CODEX_PAGE_SIZE = 12;
const MINING_CODEX_PAGE_BUTTON_PREFIX = 'mining_codex_page';
const MINING_QUICK_PREFIX = 'mining_quick';
const MINING_SELL_PREFIX = 'mining_sell';
const MINING_CODEX_RARITIES = Object.freeze(['common', 'uncommon', 'rare', 'epic', 'legendary', 'hidden']);
const LEGACY_MINING_COMMAND_ACTIONS = Object.freeze({
  광산: 'mine',
  광산도감: 'codex',
  곡괭이강화: 'enhance',
  채굴잠수: 'idle',
  광석판매: 'sell',
  광석시세: 'market'
});

export const miningCommands = [
  new SlashCommandBuilder()
    .setName('광산')
    .setDescription('채굴, 도감, 곡괭이 강화, 잠수, 판매, 시세를 한 명령어에서 이용합니다.')
    .addStringOption((option) =>
      option
        .setName('행동')
        .setDescription('실행할 광산 행동. 비우면 채굴합니다.')
        .addChoices(
          { name: '채굴', value: 'mine' },
          { name: '도감', value: 'codex' },
          { name: '곡괭이 강화', value: 'enhance' },
          { name: '채굴 잠수', value: 'idle' },
          { name: '광석 판매', value: 'sell' },
          { name: '광석 시세', value: 'market' }
        )
    )
    .addStringOption((option) =>
      option
        .setName('희귀도')
        .setDescription('도감에서 보고 싶은 희귀도')
        .addChoices(
          { name: '전체', value: 'all' },
          { name: '일반', value: 'common' },
          { name: '고급', value: 'uncommon' },
          { name: '희귀', value: 'rare' },
          { name: '영웅', value: 'epic' },
          { name: '전설', value: 'legendary' },
          { name: '히든', value: 'hidden' }
        )
    )
    .addStringOption((option) =>
      option
        .setName('광석')
        .setDescription('판매할 광석 이름 또는 id. 비우면 판매 UI를 엽니다.')
        .setMaxLength(50)
    )
    .addIntegerOption((option) =>
      option
        .setName('수량')
        .setDescription('판매 수량. 비우면 해당 광석 전량 판매')
        .setMinValue(1)
    )
];

export function getMiningCommandPayloads() {
  return miningCommands.map((command) => command.toJSON());
}

export async function handleMiningCommand(interaction, mining, services = {}) {
  if (interaction.isButton?.()) return handleMiningButton(interaction, mining, services);

  if (!interaction.isChatInputCommand?.() || !isMiningCommand(interaction.commandName)) return false;

  if (!interaction.inGuild?.()) {
    await interaction.reply({ content: '서버에서만 사용할 수 있는 명령어입니다.', flags: MessageFlags.Ephemeral });
    return true;
  }

  try {
    await routeMiningCommand(interaction, mining, services);
  } catch (error) {
    await interaction.reply({ content: `광산 처리 실패: ${error.message}`, flags: MessageFlags.Ephemeral });
  }
  return true;
}

async function handleMiningButton(interaction, mining, services = {}) {
  if (interaction.customId?.startsWith(`${MINING_CODEX_PAGE_BUTTON_PREFIX}:`)) {
    return handleMiningCodexPageButton(interaction, mining);
  }

  if (interaction.customId?.startsWith(`${MINING_SELL_PREFIX}:`)) {
    return handleMiningSellButton(interaction, mining);
  }

  if (!interaction.customId?.startsWith(`${MINING_QUICK_PREFIX}:`)) return false;

  const [, action, ownerId] = interaction.customId.split(':');
  if (ownerId && interaction.user.id !== ownerId) {
    await interaction.reply({ content: '이 광산 버튼은 명령어를 실행한 유저만 사용할 수 있습니다.', flags: MessageFlags.Ephemeral });
    return true;
  }

  if (!interaction.inGuild?.()) {
    await interaction.reply({ content: '서버에서만 사용할 수 있는 명령어입니다.', flags: MessageFlags.Ephemeral });
    return true;
  }

  try {
    if (action === 'mine') {
      const result = await mining.mineOre(createServiceInput(interaction));
      const seasonAward = result.cooldown ? null : await awardMiningSeasonPoints(services, interaction);
      await interaction.reply(createMineCardPayload(withSeasonAward(formatMineResult(interaction.user, result), seasonAward), result.ore, interaction.user.id));
      return true;
    }

    if (action === 'sell') {
      const preview = await mining.getSellPreview(createServiceInput(interaction));
      await interaction.reply(createMiningSellPayload(interaction.user, preview, interaction.user.id));
      return true;
    }

    if (action === 'enhance') {
      const result = await mining.enhancePickaxe(createServiceInput(interaction));
      await interaction.reply(createPickaxeCardPayload(formatPickaxeEnhancementResult(interaction.user, result), result.afterLevel, interaction.user.id));
      return true;
    }

    if (action === 'codex') {
      const profile = await mining.getProfile(interaction.guildId, interaction.user.id, interaction.user.username);
      await interaction.reply(createMiningCodexPayload(interaction.user, profile, 'all', interaction.user.id, 0));
      return true;
    }

    if (action === 'market') {
      const market = await mining.getMarket({ guildId: interaction.guildId, limit: 12 });
      await interaction.reply(createMiningMarketPayload(interaction.user, market, interaction.user.id));
      return true;
    }

    await interaction.reply({ content: '알 수 없는 광산 버튼입니다.', flags: MessageFlags.Ephemeral });
    return true;
  } catch (error) {
    await interaction.reply({ content: `광산 처리 실패: ${error.message}`, flags: MessageFlags.Ephemeral });
    return true;
  }
}

async function handleMiningSellButton(interaction, mining) {
  const [, action, ownerId, oreId] = interaction.customId.split(':');
  if (ownerId && interaction.user.id !== ownerId) {
    await interaction.reply({ content: '이 광석 판매 버튼은 명령어를 실행한 유저만 사용할 수 있습니다.', flags: MessageFlags.Ephemeral });
    return true;
  }

  if (!interaction.inGuild?.()) {
    await interaction.reply({ content: '서버에서만 사용할 수 있는 명령어입니다.', flags: MessageFlags.Ephemeral });
    return true;
  }

  try {
    const input = createServiceInput(interaction);
    const result = action === 'all'
      ? await mining.sellAllOres(input)
      : await mining.sellOre({ ...input, oreId, quantity: 'all' });
    await interaction.reply(createMiningCardPayload(formatSellResult(interaction.user, result), {
      color: 0xf59e0b,
      components: createMiningQuickRows(interaction.user.id)
    }));
    return true;
  } catch (error) {
    await interaction.reply({ content: `광석 판매 실패: ${error.message}`, flags: MessageFlags.Ephemeral });
    return true;
  }
}

async function handleMiningCodexPageButton(interaction, mining) {
  const [, rarity, pageText, ownerId] = interaction.customId.split(':');
  if (ownerId && interaction.user.id !== ownerId) {
    await interaction.reply({ content: '이 광산 도감 버튼은 명령어를 실행한 유저만 사용할 수 있습니다.', flags: MessageFlags.Ephemeral });
    return true;
  }

  if (!interaction.inGuild?.()) {
    await interaction.reply({ content: '서버에서만 사용할 수 있는 명령어입니다.', flags: MessageFlags.Ephemeral });
    return true;
  }

  try {
    const profile = await mining.getProfile(interaction.guildId, interaction.user.id, interaction.user.username);
    await interaction.update(createMiningCodexPayload(interaction.user, profile, rarity, interaction.user.id, Number.parseInt(pageText, 10)));
    return true;
  } catch (error) {
    await interaction.reply({ content: `광산 도감 처리 실패: ${error.message}`, flags: MessageFlags.Ephemeral });
    return true;
  }
}

async function routeMiningCommand(interaction, mining, services = {}) {
  const user = interaction.user;
  const action = getMiningAction(interaction);

  if (action === 'mine') {
    const result = await mining.mineOre(createServiceInput(interaction));
    const seasonAward = result.cooldown ? null : await awardMiningSeasonPoints(services, interaction);
    await interaction.reply(createMineCardPayload(withSeasonAward(formatMineResult(user, result), seasonAward), result.ore, user.id));
    return;
  }

  if (action === 'codex') {
    const profile = await mining.getProfile(interaction.guildId, user.id, user.username);
    const rarity = interaction.options.getString('희귀도') ?? 'all';
    await interaction.reply(createMiningCodexPayload(user, profile, rarity, user.id, 0));
    return;
  }

  if (action === 'enhance') {
    const result = await mining.enhancePickaxe(createServiceInput(interaction));
    await interaction.reply(createPickaxeCardPayload(formatPickaxeEnhancementResult(user, result), result.afterLevel, user.id));
    return;
  }

  if (action === 'idle') {
    const result = await mining.toggleIdle(createServiceInput(interaction));
    await interaction.reply(createMiningCardPayload(formatIdleMiningResult(user, result), {
      color: 0x64748b,
      components: createMiningQuickRows(user.id)
    }));
    return;
  }

  if (action === 'sell') {
    const oreId = interaction.options.getString('광석');
    const quantity = interaction.options.getInteger('수량') ?? 'all';
    if (oreId) {
      const result = await mining.sellOre({ ...createServiceInput(interaction), oreId, quantity });
      await interaction.reply(createMiningCardPayload(formatSellResult(user, result), {
        color: 0xf59e0b,
        components: createMiningQuickRows(user.id)
      }));
      return;
    }

    const preview = await mining.getSellPreview(createServiceInput(interaction));
    await interaction.reply(createMiningSellPayload(user, preview, user.id));
    return;
  }

  if (action === 'market') {
    const market = await mining.getMarket({ guildId: interaction.guildId, limit: 12 });
    await interaction.reply(createMiningMarketPayload(user, market, user.id));
  }
}

async function awardMiningSeasonPoints(services, interaction) {
  if (typeof services?.seasons?.awardPoints !== 'function') return null;

  try {
    return await services.seasons.awardPoints({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      username: interaction.user.username,
      source: SEASON_POINT_SOURCES.MINING_MINE,
      points: 10
    });
  } catch (error) {
    services.logger?.debug?.('Failed to award mining season points:', error);
    return null;
  }
}

function createServiceInput(interaction) {
  return {
    guildId: interaction.guildId,
    userId: interaction.user.id,
    username: interaction.user.username
  };
}

function withSeasonAward(content, award) {
  return [content, formatSeasonAwardLine(award)].filter(Boolean).join('\n');
}

function formatMineResult(user, result) {
  if (result.cooldown) {
    return [
      `⛏️ **광산 채굴 대기** — ${formatUserMention(user, user.username)}`,
      `다음 채굴까지 **${formatDuration(result.remainingMs)}** 남았습니다.`,
      '팁: 버튼을 눌러 초단위로 계속 캐면 연속 채굴 보너스가 올라갑니다.'
    ].join('\n');
  }

  const count = result.profile.inventory[result.oreId] ?? 0;
  return [
    `⛏️ **광산 채굴 성공** — ${formatUserMention(user, user.username)}`,
    `획득: **${result.ore.label} × ${result.quantity.toLocaleString()}** (${getMiningRarityLabel(result.rarity)} / ${result.ore.vein})`,
    `품질: **${result.quality.toLocaleString()}** / 현재 시세: **${formatGold(result.quote.price)}** / 예상가 **${formatGold(result.estimatedValue)}**`,
    formatDiscoveryBonus(result),
    `연속 채굴: **${result.profile.focus.streak.toLocaleString()}회** / 보너스 **+${Math.round((result.focusBonusBps ?? 0) / 100)}%**`,
    `보유 ${result.ore.label}: **${count.toLocaleString()}개**`,
    `곡괭이: **${formatPickaxeName(result.profile.pickaxe.level)}**`
  ].filter(Boolean).join('\n');
}

function formatDiscoveryBonus(result) {
  if (!result?.newDiscovery) return null;
  if (result.discoveryXpRewardError) return `🆕 **새 광석 발견!** 도감에 등록했습니다. XP 지급 실패: ${result.discoveryXpRewardError}`;
  const reward = result.discoveryXpReward;
  const xpGained = reward?.xpGained ?? result.discoveryXpGained ?? 0;
  const levelText = reward?.leveledUp
    ? ` / 🎉 Lv.${reward.profile.level} 레벨업! 보너스 ${reward.levelReward.toLocaleString()}골드`
    : '';
  return `🆕 **새 광석 발견!** 도감에 등록하고 보너스 **+${xpGained.toLocaleString()} XP**를 획득했습니다${levelText}.`;
}

function formatPickaxeEnhancementResult(user, result) {
  if (result.capped) {
    return `⛏️ **곡괭이 강화** — ${formatUserMention(user, user.username)}\n이미 최고 강화 단계입니다. 현재 곡괭이: **${formatPickaxeName(result.afterLevel)}**`;
  }

  const outcomeText = { success: '✅ 성공', maintain: '➖ 유지', destroy: '💥 파괴' }[result.outcome];
  const beforeName = formatPickaxeName(result.beforeLevel);
  const afterName = formatPickaxeName(result.afterLevel);
  const levelText = result.outcome === 'destroy' ? `${beforeName} → ${afterName}로 리셋` : `${beforeName} → ${afterName}`;
  return [
    `⛏️ **곡괭이 강화** — ${formatUserMention(user, user.username)}`,
    `결과: **${outcomeText}** (${levelText})`,
    `현재 곡괭이: **${afterName}**`,
    `사용 골드: **${formatGold(result.cost)}** / 남은 골드: **${formatGold(result.goldBalanceAfter)}**`,
    `누적 시도: **${result.profile.pickaxe.totalEnhancementAttempts.toLocaleString()}회** / 파괴: **${result.profile.pickaxe.destroyedCount.toLocaleString()}회**`
  ].join('\n');
}

function formatIdleMiningResult(user, result) {
  if (result.action === 'started') {
    return [
      `🪨 **채굴 잠수 시작** — ${formatUserMention(user, user.username)}`,
      '다시 `/광산 행동:채굴 잠수`를 입력하면 방치 광석 보상을 정산합니다.',
      '보상은 최대 12시간까지만 누적되며, 적극 채굴보다 낮은 속도로 쌓입니다.'
    ].join('\n');
  }

  const summary = summarizeMinedOres(result.ores);
  const discoveryLine = formatIdleDiscoveryBonus(result);
  return [
    `🪨 **채굴 잠수 보상 정산** — ${formatUserMention(user, user.username)}`,
    `잠수 시간: **${formatMinutes(result.minutes)}** / 획득 광석: **${result.oreCount.toLocaleString()}회**`,
    discoveryLine,
    `획득 목록: ${summary}`
  ].filter(Boolean).join('\n');
}

function formatIdleDiscoveryBonus(result) {
  const discoveries = Array.isArray(result?.discoveries) ? result.discoveries : [];
  if (discoveries.length <= 0) return null;
  const labels = discoveries.map((discovery) => discovery.ore.label).join(', ');
  const base = formatDiscoveryBonus({
    newDiscovery: true,
    discoveryXpGained: result.discoveryXpGained,
    discoveryXpReward: result.discoveryXpReward,
    discoveryXpRewardError: result.discoveryXpRewardError
  });
  return `${base}\n새 발견: ${labels}`;
}

function formatSellPreview(user, preview) {
  const rows = preview.entries.slice(0, 10).map((entry) =>
    `* ${entry.ore.label} × ${entry.quantity.toLocaleString()} · ${formatGold(entry.quote.price)} → **${formatGold(entry.totalValue)}**`
  );
  return [
    `💰 **광석 판매소** — ${formatUserMention(user, user.username)}`,
    `판매 가능: **${preview.totalQuantity.toLocaleString()}개** / 예상 총액 **${formatGold(preview.totalValue)}**`,
    '판매 수익은 기존 주식 파산 부채가 있으면 자동으로 일부 상환됩니다.',
    '',
    rows.length > 0 ? rows.join('\n') : '판매할 광석이 없습니다.'
  ].join('\n');
}

function formatSellResult(user, result) {
  const rows = result.soldEntries.slice(0, 8).map((entry) => `${entry.ore.label} × ${entry.quantity.toLocaleString()} = ${formatGold(entry.totalValue)}`);
  const repayment = result.receipt?.repayment ?? 0;
  const net = result.receipt?.net ?? result.gross;
  return [
    `💰 **광석 판매 완료** — ${formatUserMention(user, user.username)}`,
    `판매: **${result.totalQuantity.toLocaleString()}개** / 총액 **${formatGold(result.gross)}**`,
    `실수령: **${formatGold(net)}**${repayment > 0 ? ` / 부채 자동상환 **${formatGold(repayment)}**` : ''}`,
    `잔액: **${formatGold(result.receipt?.balance ?? 0)}** / 남은 부채: **${formatGold(result.receipt?.bankruptcy?.debt ?? 0)}**`,
    rows.join('\n')
  ].filter(Boolean).join('\n');
}

function createMiningCodexView(user, profile, rarityFilter = 'all', page = 0) {
  const normalizedFilter = normalizeMiningCodexRarity(rarityFilter);
  const entries = getOreCatalog({ includeHidden: true })
    .map((ore, index) => createMiningCodexEntry(ore, profile, index))
    .filter(isVisibleMiningCodexEntry);
  const visibleEntries = normalizedFilter === 'all' ? entries : entries.filter((entry) => entry.ore.rarity === normalizedFilter);
  const discoveredTotal = entries.filter((entry) => entry.discovered).length;
  const progressPercent = entries.length > 0 ? Math.floor(discoveredTotal / entries.length * 1000) / 10 : 0;
  const rarityProgress = MINING_CODEX_RARITIES.map((rarity) => {
    const rarityEntries = entries.filter((entry) => entry.ore.rarity === rarity);
    if (rarityEntries.length === 0) return null;
    const rarityDiscovered = rarityEntries.filter((entry) => entry.discovered).length;
    return `${getMiningRarityLabel(rarity)} ${rarityDiscovered}/${rarityEntries.length}`;
  }).filter(Boolean).join(' · ');
  const pageEntries = sortMiningCodexEntries(visibleEntries);
  const pageCount = getMiningCodexPageCount(pageEntries.length);
  const currentPage = clampMiningCodexPage(page, pageCount);
  const start = currentPage * MINING_CODEX_PAGE_SIZE;
  const rows = pageEntries.slice(start, start + MINING_CODEX_PAGE_SIZE).map(formatMiningCodexEntry);
  const viewLabel = normalizedFilter === 'all' ? '전체' : getMiningRarityLabel(normalizedFilter);
  const emptyText = normalizedFilter === 'hidden'
    ? '- 발견한 히든 광석이 없습니다. 히든 광석은 캐기 전까지 도감에 표시되지 않습니다.'
    : '- 이 보기에는 표시할 광석이 없습니다.';

  return {
    normalizedFilter,
    currentPage,
    pageCount,
    content: [
      `📘 **광산 도감** — ${formatUserMention(user, user.username)}`,
      `진행도: **${discoveredTotal}/${entries.length}종 (${progressPercent}%)** / 총 채굴 **${profile.stats.totalMines.toLocaleString()}회**`,
      `그래프: \`${formatMiningProgressBar(discoveredTotal, entries.length)}\``,
      `희귀도별: ${rarityProgress || '표시할 항목 없음'}`,
      `현재 보기: **${viewLabel}** · 페이지 **${currentPage + 1}/${pageCount}**`,
      '',
      `도감 목록:\n${rows.length > 0 ? rows.join('\n') : emptyText}`,
      '',
      '팁: `/광산 행동:도감 희귀도:전설`처럼 희귀도별로 좁혀보고, 버튼으로 페이지를 넘길 수 있습니다.'
    ].join('\n')
  };
}

function createMiningCodexEntry(ore, profile, catalogIndex = 0) {
  const count = profile.inventory[ore.id] ?? 0;
  const firstMinedAt = profile.collection[ore.id] ?? profile.bestOre[ore.id]?.minedAt ?? 0;
  const bestQuality = profile.bestOre[ore.id]?.quality ?? null;
  return { ore, catalogIndex, count, firstMinedAt, bestQuality, discovered: count > 0 || firstMinedAt > 0 };
}

function isVisibleMiningCodexEntry(entry) {
  return !entry.ore.hidden || entry.discovered;
}

function sortMiningCodexEntries(entries) {
  return [...entries].sort((left, right) => {
    if (left.discovered !== right.discovered) return left.discovered ? -1 : 1;
    return left.catalogIndex - right.catalogIndex;
  });
}

function formatMiningCodexEntry(entry) {
  if (!entry.discovered) return `* ??? ${getMiningRarityLabel(entry.ore.rarity)} ???`;
  const bestText = entry.bestQuality ? `${entry.bestQuality.toLocaleString()}` : '???';
  return `* ${entry.ore.label} ${getMiningRarityLabel(entry.ore.rarity)} 최고품질 ${bestText}`;
}

function normalizeMiningCodexRarity(rarity) {
  const normalized = String(rarity ?? 'all').trim().toLocaleLowerCase('ko-KR');
  return MINING_CODEX_RARITIES.includes(normalized) ? normalized : 'all';
}

function formatMiningProgressBar(discovered, total, width = 16) {
  if (total <= 0) return '░'.repeat(width);
  const rawFilled = Math.round(discovered / total * width);
  const filled = Math.min(width, Math.max(discovered > 0 ? 1 : 0, rawFilled));
  return `${'█'.repeat(filled)}${'░'.repeat(width - filled)}`;
}

function getMiningCodexPageCount(entryCount) {
  return Math.max(1, Math.ceil(entryCount / MINING_CODEX_PAGE_SIZE));
}

function clampMiningCodexPage(page, pageCount) {
  const normalizedPage = Math.floor(Number(page) || 0);
  return Math.min(Math.max(0, normalizedPage), Math.max(1, pageCount) - 1);
}

function createMineCardPayload(content, ore, userId = null) {
  const imagePath = ore?.imagePath;
  return createMiningCardPayload(content, {
    imagePath: imagePath && existsSync(imagePath) ? imagePath : null,
    color: getMiningEmbedColor(ore?.rarity),
    components: createMiningQuickRows(userId)
  });
}

function createPickaxeCardPayload(content, pickaxeLevel, userId = null) {
  const pickaxeAsset = getMiningPickaxeAssetForLevel(pickaxeLevel);
  return createMiningCardPayload(content, {
    imagePath: pickaxeAsset?.imagePath && existsSync(pickaxeAsset.imagePath) ? pickaxeAsset.imagePath : null,
    color: getPickaxeEmbedColor(pickaxeLevel),
    components: createMiningQuickRows(userId)
  });
}

function createMiningCodexPayload(user, profile, rarity = 'all', userId = null, page = 0) {
  const view = createMiningCodexView(user, profile, rarity, page);
  return createMiningCardPayload(view.content, {
    color: 0x78716c,
    components: createMiningCodexRows({ userId, rarity: view.normalizedFilter, page: view.currentPage, pageCount: view.pageCount })
  });
}

function createMiningSellPayload(user, preview, userId = null) {
  return createMiningCardPayload(formatSellPreview(user, preview), {
    color: 0xf59e0b,
    components: createMiningSellRows(userId, preview)
  });
}

function createMiningMarketPayload(user, market, userId = null) {
  const rows = market.ores.map((quote) => {
    const icon = quote.changeBps > 0 ? '▲' : quote.changeBps < 0 ? '▼' : '·';
    return `* ${icon} **${quote.label}** ${formatGold(quote.price)} (${quote.changePercent > 0 ? '+' : ''}${quote.changePercent}%)`;
  });
  return createMiningCardPayload([
    `📈 **광석 시세** — ${formatUserMention(user, user.username)}`,
    `시장 tick: **${market.tickIndex.toLocaleString()}** / 시세는 주식처럼 주기적으로 변동됩니다.`,
    rows.join('\n')
  ].join('\n'), {
    color: 0x38bdf8,
    components: createMiningQuickRows(userId)
  });
}

function createMiningCardPayload(content, { imagePath = null, color = 0x78716c, components = [] } = {}) {
  const { title, description } = splitMentionSafeEmbedContent(content);
  const embed = new EmbedBuilder().setColor(color).setTitle(title).setDescription(description);
  const payload = { embeds: [embed] };
  if (components.length > 0) payload.components = components;
  if (imagePath) {
    embed.setImage(`attachment://${basename(imagePath)}`);
    payload.files = [imagePath];
  }
  return payload;
}

function createMiningQuickRows(userId) {
  if (!userId) return [];
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${MINING_QUICK_PREFIX}:mine:${userId}`).setLabel('채굴').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`${MINING_QUICK_PREFIX}:sell:${userId}`).setLabel('판매').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`${MINING_QUICK_PREFIX}:enhance:${userId}`).setLabel('곡괭이 강화').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`${MINING_QUICK_PREFIX}:codex:${userId}`).setLabel('도감').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`${MINING_QUICK_PREFIX}:market:${userId}`).setLabel('시세').setStyle(ButtonStyle.Secondary)
  )];
}

function createMiningSellRows(userId, preview) {
  const rows = createMiningQuickRows(userId);
  if (!userId || preview.totalQuantity <= 0) return rows;

  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${MINING_SELL_PREFIX}:all:${userId}`).setLabel('전부 판매').setStyle(ButtonStyle.Danger),
    ...preview.entries.slice(0, 4).map((entry) => new ButtonBuilder()
      .setCustomId(`${MINING_SELL_PREFIX}:ore:${userId}:${entry.oreId}`)
      .setLabel(`${entry.ore.label} 판매`.slice(0, 80))
      .setStyle(ButtonStyle.Primary))
  ));

  return rows;
}

function createMiningCodexRows({ userId, rarity, page, pageCount }) {
  const rows = createMiningQuickRows(userId);
  if (!userId || pageCount <= 1) return rows;
  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(createMiningCodexPageCustomId(rarity, Math.max(0, page - 1), userId)).setLabel('이전').setStyle(ButtonStyle.Secondary).setDisabled(page <= 0),
    new ButtonBuilder().setCustomId(createMiningCodexPageCustomId(rarity, Math.min(pageCount - 1, page + 1), userId)).setLabel('다음').setStyle(ButtonStyle.Primary).setDisabled(page >= pageCount - 1)
  ));
  return rows;
}

function createMiningCodexPageCustomId(rarity, page, userId) {
  return `${MINING_CODEX_PAGE_BUTTON_PREFIX}:${rarity}:${page}:${userId}`;
}

function summarizeMinedOres(ores) {
  const counts = new Map();
  for (const entry of ores) counts.set(entry.oreId, (counts.get(entry.oreId) ?? 0) + (entry.quantity ?? 1));
  return [...counts.entries()].map(([oreId, count]) => `${getOreConfig(oreId).label} × ${count}`).join(', ');
}

function formatPickaxeName(level) {
  return getMiningPickaxeAssetForLevel(level)?.label ?? `+${Number(level) || 1}강 곡괭이`;
}

function formatMinutes(minutes) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours > 0) return `${hours}시간 ${rest}분`;
  return `${rest}분`;
}

function formatDuration(ms) {
  const seconds = Math.ceil(Math.max(0, ms) / 1000);
  if (seconds < 60) return `${seconds}초`;
  return `${Math.floor(seconds / 60)}분 ${seconds % 60}초`;
}

function formatGold(amount) {
  return `${Number(amount ?? 0).toLocaleString()}골드`;
}

function getMiningEmbedColor(rarity) {
  return { common: 0x94a3b8, uncommon: 0x22c55e, rare: 0x3b82f6, epic: 0xa855f7, legendary: 0xf59e0b, hidden: 0xec4899 }[rarity] ?? 0x78716c;
}

function getPickaxeEmbedColor(level) {
  if (level >= 100) return 0xfacc15;
  if (level >= 80) return 0xec4899;
  if (level >= 60) return 0xa855f7;
  if (level >= 40) return 0x3b82f6;
  if (level >= 20) return 0x22c55e;
  return 0x94a3b8;
}

function getMiningAction(interaction) {
  if (interaction.commandName === '광산') {
    return interaction.options.getString?.('행동') ?? 'mine';
  }
  return LEGACY_MINING_COMMAND_ACTIONS[interaction.commandName] ?? null;
}

function isMiningCommand(commandName) {
  return commandName in LEGACY_MINING_COMMAND_ACTIONS;
}
