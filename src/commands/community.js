import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import {
  formatLotteryDrawTime,
  getAchievementCategories,
  getCommunityTitles,
  getEventTypes,
  getLotteryDrawScheduleText,
  getLotteryMaxTicketsPerPurchase,
  getLotteryTicketCost,
  getShopItems
} from '../systems/community.js';
import { formatDuration } from './economy.js';
import { formatSeasonAwardLine } from './seasons.js';
import { SEASON_POINT_SOURCES } from '../systems/seasons.js';
import {
  logUnexpectedInteractionError,
  safeAutocompleteRespond,
  safeReplyToInteraction
} from './interactions.js';

const communityCommandNames = new Set([
  '업적',
  '칭호',
  '미션',
  '복권',
  '상점',
  '서버이벤트',
  '활동요약'
]);

const ACHIEVEMENT_VIEW_LABELS = Object.freeze({
  summary: '요약',
  claimable: '수령 가능',
  progress: '진행 중',
  completed: '완료',
  all: '전체'
});

const ACHIEVEMENT_TIER_LABELS = Object.freeze({
  bronze: '브론즈',
  silver: '실버',
  gold: '골드',
  legendary: '전설'
});

const TITLE_VIEW_LABELS = Object.freeze({
  owned: '보유',
  all: '전체',
  locked: '미보유'
});

const TITLE_AUTOCOMPLETE_LIMIT = 25;

export const communityCommands = [
  new SlashCommandBuilder()
    .setName('업적')
    .setDescription('업적 진행도와 보상을 확인하고 완료 업적을 수령합니다.')
    .addStringOption((option) =>
      option
        .setName('분류')
        .setDescription('확인할 업적 분류')
        .addChoices(
          { name: '전체', value: 'all' },
          ...getAchievementCategories().map((category) => ({ name: category.label, value: category.id }))
        )
    )
    .addStringOption((option) =>
      option
        .setName('보기')
        .setDescription('표시 방식')
        .addChoices(
          { name: '요약', value: 'summary' },
          { name: '수령 가능', value: 'claimable' },
          { name: '진행 중', value: 'progress' },
          { name: '완료', value: 'completed' },
          { name: '전체', value: 'all' }
        )
    ),
  new SlashCommandBuilder()
    .setName('칭호')
    .setDescription('보유 칭호를 확인하거나 장착합니다.')
    .addStringOption((option) =>
      option
        .setName('선택')
        .setDescription('장착할 보유 칭호를 검색')
        .setAutocomplete(true)
    )
    .addStringOption((option) =>
      option
        .setName('보기')
        .setDescription('칭호 도감 표시 방식')
        .addChoices(
          { name: '보유', value: 'owned' },
          { name: '전체', value: 'all' },
          { name: '미보유', value: 'locked' }
        )
    ),
  new SlashCommandBuilder()
    .setName('미션')
    .setDescription('일일/주간 미션을 확인하고 완료 보상을 수령합니다.')
    .addStringOption((option) =>
      option
        .setName('종류')
        .setDescription('확인할 미션 종류')
        .addChoices(
          { name: '일일', value: 'daily' },
          { name: '주간', value: 'weekly' }
        )
    ),
  new SlashCommandBuilder()
    .setName('복권')
    .setDescription('서버 잭팟 복권을 구매하거나 추첨합니다.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('현황')
        .setDescription('현재 복권 잭팟과 참여 현황을 확인합니다.')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('구매')
        .setDescription('복권을 구매해 서버 잭팟을 키웁니다.')
        .addIntegerOption((option) =>
          option
            .setName('장수')
            .setDescription('구매할 복권 장수')
            .setMinValue(1)
            .setMaxValue(getLotteryMaxTicketsPerPurchase())
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('대량구매')
        .setDescription(`복권을 한 번에 여러 장 구매합니다. 최대 ${getLotteryMaxTicketsPerPurchase()}장.`)
        .addIntegerOption((option) =>
          option
            .setName('장수')
            .setDescription(`구매할 복권 장수(2~${getLotteryMaxTicketsPerPurchase()}장)`)
            .setMinValue(2)
            .setMaxValue(getLotteryMaxTicketsPerPurchase())
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('추첨')
        .setDescription('현재 판매된 복권 중 당첨자를 추첨합니다.')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('자동추첨')
        .setDescription('매주 수요일·토요일 21:00 자동 추첨 알림을 설정합니다.')
        .addBooleanOption((option) =>
          option
            .setName('사용')
            .setDescription('자동 추첨을 사용할지 여부')
            .setRequired(true)
        )
        .addChannelOption((option) =>
          option
            .setName('채널')
            .setDescription('자동 추첨 결과를 보낼 채널(켜기일 때 비우면 현재 채널)')
        )
    ),
  new SlashCommandBuilder()
    .setName('상점')
    .setDescription('칭호와 배지 꾸미기 아이템을 구매합니다.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('목록')
        .setDescription('상점 아이템 목록을 확인합니다.')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('구매')
        .setDescription('상점 아이템을 구매합니다.')
        .addStringOption((option) =>
          option
            .setName('아이템')
            .setDescription('구매할 아이템')
            .setRequired(true)
            .addChoices(...getShopItems().map((item) => ({ name: item.label, value: item.id })))
        )
    ),
  new SlashCommandBuilder()
    .setName('서버이벤트')
    .setDescription('서버 전체 보너스 이벤트를 확인하거나 시작합니다.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('상태')
        .setDescription('현재 진행 중인 서버 이벤트를 확인합니다.')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('시작')
        .setDescription('서버 보너스 이벤트를 시작합니다.')
        .addStringOption((option) =>
          option
            .setName('종류')
            .setDescription('시작할 이벤트 종류')
            .setRequired(true)
            .addChoices(...getEventTypes().map((event) => ({ name: event.label, value: event.id })))
        )
        .addIntegerOption((option) =>
          option
            .setName('기간분')
            .setDescription('이벤트 지속 시간(분)')
            .setMinValue(1)
            .setMaxValue(60)
        )
    ),
  new SlashCommandBuilder()
    .setName('활동요약')
    .setDescription('최근 7일간 채팅/명령어 활동과 획득한 메인 프로필 XP를 요약합니다.')
    .addUserOption((option) =>
      option
        .setName('대상')
        .setDescription('활동 요약을 확인할 유저')
    )
];

export function getCommunityCommandPayloads() {
  return communityCommands.map((command) => command.toJSON());
}

export async function handleCommunityAutocomplete(interaction, community) {
  if (!interaction.isAutocomplete?.() || interaction.commandName !== '칭호') {
    return false;
  }

  if (!interaction.guildId || interaction.inGuild?.() === false) {
    await safeAutocompleteRespond(interaction, []);
    return true;
  }

  const focused = interaction.options.getFocused(true);
  if (focused.name !== '선택') {
    await safeAutocompleteRespond(interaction, []);
    return true;
  }

  const overview = await community.getOverview({
    guildId: interaction.guildId,
    userId: interaction.user.id,
    username: interaction.user.username
  });
  const query = normalizeSearchText(focused.value);
  const ownedTitles = overview.titles.filter((title) => title.owned);
  const matchedTitles = ownedTitles
    .filter((title) => query.length <= 0 || normalizeTitleSearchText(title).includes(query))
    .sort((a, b) => Number(b.equipped) - Number(a.equipped)
      || a.categoryLabel.localeCompare(b.categoryLabel)
      || a.label.localeCompare(b.label));
  const choices = [
    { name: '칭호 해제', value: 'none' },
    ...matchedTitles.map((title) => ({
      name: formatTitleAutocompleteName(title),
      value: title.id
    }))
  ].slice(0, TITLE_AUTOCOMPLETE_LIMIT);

  await safeAutocompleteRespond(interaction, choices);
  return true;
}

export async function handleCommunityCommand(interaction, community, logger = console, services = {}) {
  if (!interaction.isChatInputCommand()) return false;
  if (!communityCommandNames.has(interaction.commandName)) return false;

  if (!interaction.inGuild()) {
    await interaction.reply({
      content: '서버에서만 사용할 수 있는 명령어입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  try {
    await routeCommunityCommand(interaction, community, services);
  } catch (error) {
    logUnexpectedInteractionError(logger, error, 'Community command rejected');
    await safeReplyToInteraction(interaction, `처리 실패: ${error.message}`, {
      flags: MessageFlags.Ephemeral
    });
  }

  return true;
}

async function routeCommunityCommand(interaction, community, services = {}) {
  const guildId = interaction.guildId;
  const user = interaction.user;
  const base = {
    guildId,
    userId: user.id,
    username: user.username
  };

  if (interaction.commandName === '업적') {
    const category = interaction.options.getString('분류') ?? 'all';
    const view = interaction.options.getString('보기') ?? 'summary';
    const result = await community.claimAchievements(base);
    await interaction.reply(formatAchievements(result, { category, view }));
    return;
  }

  if (interaction.commandName === '칭호') {
    const selectedTitleId = interaction.options.getString('선택');
    if (selectedTitleId) {
      const result = await community.equipTitle({
        ...base,
        titleId: selectedTitleId
      });
      await interaction.reply(formatTitleEquip(result));
      return;
    }

    const view = interaction.options.getString('보기') ?? 'owned';
    const overview = await community.getOverview(base);
    await interaction.reply(formatTitles(overview.titles, { view }));
    return;
  }

  if (interaction.commandName === '미션') {
    const type = interaction.options.getString('종류') ?? 'daily';
    const result = await community.claimMissions({
      ...base,
      type
    });
    const seasonAward = await awardCommunityMissionSeasonPoints(services, interaction, result);
    await interaction.reply(withSeasonAward(formatMissions(result), seasonAward));
    return;
  }

  if (interaction.commandName === '복권') {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === '현황') {
      const overview = await community.getOverview(base);
      await interaction.reply(formatLotteryStatus(overview.lottery));
      return;
    }

    if (subcommand === '구매' || subcommand === '대량구매') {
      const result = await community.buyLotteryTickets({
        ...base,
        quantity: interaction.options.getInteger('장수', true)
      });
      await interaction.reply(formatLotteryBuy(result));
      return;
    }

    if (subcommand === '추첨') {
      const result = await community.drawLottery({ guildId });
      await interaction.reply(formatLotteryDraw(result));
      return;
    }

    if (subcommand === '자동추첨') {
      const enabled = interaction.options.getBoolean('사용', true);
      const channel = interaction.options.getChannel('채널') ?? null;
      const result = await community.configureLotteryAutoDraw({
        guildId,
        enabled,
        channelId: enabled ? channel?.id ?? interaction.channelId : null
      });
      await interaction.reply(formatLotteryAutoDraw(result.lottery));
      return;
    }
  }

  if (interaction.commandName === '상점') {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === '목록') {
      const overview = await community.getOverview(base);
      await interaction.reply(formatShop(overview.shopItems, overview.profile.balance));
      return;
    }

    if (subcommand === '구매') {
      const result = await community.buyShopItem({
        ...base,
        itemId: interaction.options.getString('아이템', true)
      });
      await interaction.reply(formatShopBuy(result));
      return;
    }
  }

  if (interaction.commandName === '서버이벤트') {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === '상태') {
      const result = await community.getEventStatus({ guildId });
      await interaction.reply(formatEventStatus(result.event));
      return;
    }

    if (subcommand === '시작') {
      const result = await community.startEvent({
        ...base,
        type: interaction.options.getString('종류', true),
        durationMinutes: interaction.options.getInteger('기간분') ?? 10
      });
      await interaction.reply(formatEventStart(result.event));
      return;
    }
  }

  if (interaction.commandName === '활동요약') {
    const target = interaction.options.getUser?.('대상') ?? user;
    if (target.bot) {
      await interaction.reply({
        content: '봇 활동 요약은 표시하지 않습니다.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await deferInteractionReplyIfSupported(interaction);
    const result = await community.getWeeklyActivitySummary({
      guildId,
      userId: target.id,
      username: target.username
    });
    await sendCommunityReply(interaction, formatWeeklyActivitySummary(result));
    return;
  }
}


async function awardCommunityMissionSeasonPoints(services, interaction, result) {
  if (!Array.isArray(result?.claimed) || result.claimed.length <= 0) return null;
  if (typeof services?.seasons?.awardPoints !== 'function') return null;

  try {
    return await services.seasons.awardPoints({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      username: interaction.user.username,
      source: SEASON_POINT_SOURCES.COMMUNITY_MISSION_CLAIM,
      points: Math.min(40, result.claimed.length * 15)
    });
  } catch (error) {
    services.logger?.debug?.('Failed to award community mission season points:', error);
    return null;
  }
}

function withSeasonAward(content, award) {
  return [content, formatSeasonAwardLine(award)].filter(Boolean).join('\n');
}

async function deferInteractionReplyIfSupported(interaction) {
  if (interaction.deferred || interaction.replied || typeof interaction.deferReply !== 'function') {
    return false;
  }

  await interaction.deferReply();
  return true;
}

async function sendCommunityReply(interaction, payload) {
  if (interaction.deferred) {
    if (typeof interaction.editReply === 'function') {
      await interaction.editReply(payload);
      return;
    }
    if (typeof interaction.followUp === 'function') {
      await interaction.followUp(payload);
      return;
    }
  }

  await interaction.reply(payload);
}

function formatAchievements(result, { category = 'all', view = 'summary' } = {}) {
  const safeView = ACHIEVEMENT_VIEW_LABELS[view] ? view : 'summary';
  const categoryLabel = category === 'all'
    ? '전체'
    : result.achievements.find((achievement) => achievement.category === category)?.categoryLabel ?? '전체';
  const allAchievements = result.achievements.filter((achievement) => (
    category === 'all' || achievement.category === category
  ));
  const claimedNowIds = new Set(result.claimed.map((achievement) => achievement.id));
  const filteredAchievements = safeView === 'claimable' && claimedNowIds.size > 0
    ? allAchievements.filter((achievement) => claimedNowIds.has(achievement.id))
    : filterAchievementsForView(allAchievements, safeView);
  const displayedAchievements = sortAchievementDisplay(filteredAchievements).slice(0, 12);
  const completedCount = result.achievements.filter((achievement) => achievement.claimed || achievement.completed).length;
  const ownedRewardTitles = result.titles.filter((title) => title.owned).length;
  const claimText = result.claimed.length > 0
    ? `🎁 이번에 수령: ${result.claimed.map((item) => `**${item.title}**`).join(', ')} / +${result.totalCoins.toLocaleString()}골드, +${result.totalXp.toLocaleString()} XP`
    : '🎁 받을 수 있는 새 업적 보상은 없습니다.';
  const body = displayedAchievements.length > 0
    ? displayedAchievements.map(formatAchievementLine).join('\n')
    : '표시할 업적이 없습니다.';
  const moreText = filteredAchievements.length > displayedAchievements.length
    ? `외 ${filteredAchievements.length - displayedAchievements.length}개는 \`/업적 보기:전체\` 또는 분류 선택으로 더 좁혀보세요.`
    : null;

  return [
    '🏆 **업적 도감**',
    `완료 ${completedCount}/${result.achievements.length} · 칭호 ${ownedRewardTitles}/${result.titles.length} · 현재 골드 ${result.profile.balance.toLocaleString()}골드`,
    `보기: ${categoryLabel} / ${ACHIEVEMENT_VIEW_LABELS[safeView]}`,
    body,
    moreText,
    claimText
  ].filter(Boolean).join('\n');
}

function filterAchievementsForView(achievements, view) {
  if (view === 'claimable') {
    return achievements.filter((achievement) => achievement.completed && !achievement.claimed);
  }
  if (view === 'progress') {
    return achievements.filter((achievement) => !achievement.completed);
  }
  if (view === 'completed') {
    return achievements.filter((achievement) => achievement.completed || achievement.claimed);
  }
  if (view === 'all') return achievements;

  const claimable = achievements.filter((achievement) => achievement.completed && !achievement.claimed);
  const progress = achievements
    .filter((achievement) => !achievement.completed)
    .sort((a, b) => b.percent - a.percent || a.title.localeCompare(b.title))
    .slice(0, 8);
  const completed = achievements
    .filter((achievement) => achievement.claimed)
    .slice(0, Math.max(0, 12 - claimable.length - progress.length));

  return [...claimable, ...progress, ...completed];
}

function sortAchievementDisplay(achievements) {
  const stateRank = (achievement) => {
    if (achievement.completed && !achievement.claimed) return 0;
    if (!achievement.completed) return 1;
    return 2;
  };

  return [...achievements].sort((a, b) => (
    stateRank(a) - stateRank(b)
      || b.percent - a.percent
      || a.categoryLabel.localeCompare(b.categoryLabel)
      || a.title.localeCompare(b.title)
  ));
}

function formatAchievementLine(achievement) {
  if (achievement.hidden && !achievement.revealed) {
    const tier = ACHIEVEMENT_TIER_LABELS[achievement.tier] ?? achievement.tier;
    return `🔒 [${achievement.categoryLabel}/${tier}] **???** ${achievement.progressBar} ??? — 조건이 숨겨진 업적입니다.`;
  }

  const mark = achievement.claimed ? '✅' : achievement.completed ? '🎁' : '⬜';
  const tier = ACHIEVEMENT_TIER_LABELS[achievement.tier] ?? achievement.tier;
  const titleReward = achievement.reward.title ? `, 칭호 ${achievement.reward.title.label}` : '';

  return `${mark} [${achievement.categoryLabel}/${tier}] **${achievement.title}** ${achievement.progressBar} ${achievement.progress} — 보상 ${achievement.reward.coins.toLocaleString()}골드, ${achievement.reward.xp.toLocaleString()} XP${titleReward}`;
}

function formatTitles(titles, { view = 'owned' } = {}) {
  const safeView = TITLE_VIEW_LABELS[view] ? view : 'owned';
  const owned = titles.filter((title) => title.owned);
  const equipped = titles.find((title) => title.equipped);
  const filteredTitles = filterTitlesForView(titles, safeView);
  const displayedTitles = filteredTitles.slice(0, 15);
  const body = displayedTitles.length > 0
    ? displayedTitles.map(formatTitleLine).join('\n')
    : '표시할 칭호가 없습니다.';
  const moreText = filteredTitles.length > displayedTitles.length
    ? `외 ${filteredTitles.length - displayedTitles.length}개는 \`/칭호 보기:전체\`로 확인할 수 있습니다.`
    : null;

  return [
    '🏷️ **칭호 도감**',
    `보유 ${owned.length}/${titles.length} · 장착 ${equipped ? equipped.label : '없음'} · 보기 ${TITLE_VIEW_LABELS[safeView]}`,
    body,
    moreText,
    '장착은 `/칭호 선택` 입력창에서 보유 칭호를 검색하고, 획득은 `/업적` 또는 `/상점 구매`에서 할 수 있습니다.'
  ].filter(Boolean).join('\n');
}

function filterTitlesForView(titles, view) {
  if (view === 'all') return titles;
  if (view === 'locked') return titles.filter((title) => !title.owned);
  return titles.filter((title) => title.owned);
}

function formatTitleLine(title) {
  if (title.hidden && !title.owned) {
    return `🔒 ${title.rarityIcon}${title.rarityLabel} [${title.categoryLabel}] **???** — 숨겨진 칭호입니다.`;
  }

  const mark = title.equipped ? '✅' : title.owned ? '▫️' : '🔒';
  const lockedHint = title.owned ? '' : ` · 획득: ${title.source}`;

  return `${mark} ${title.rarityIcon}${title.rarityLabel} [${title.categoryLabel}] **${title.label}** — ${title.description}${lockedHint}`;
}

function normalizeSearchText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, '');
}

function normalizeTitleSearchText(title) {
  return normalizeSearchText([
    title.label,
    stripLeadingEmoji(title.label),
    title.rarityLabel,
    title.categoryLabel,
    title.source,
    title.description
  ].join(' '));
}

function formatTitleAutocompleteName(title) {
  const mark = title.equipped ? '✅ ' : '▫️ ';
  const name = stripLeadingEmoji(title.label);
  return `${mark}${title.rarityIcon}${title.rarityLabel} ${name} · ${title.categoryLabel}`.slice(0, 100);
}

function stripLeadingEmoji(value) {
  return String(value ?? '')
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .trim();
}

function formatTitleEquip(result) {
  const titleText = result.equippedTitle
    ? `${result.equippedTitle.rarityIcon}${result.equippedTitle.rarityLabel} ${result.equippedTitle.label} 칭호를 장착했습니다.`
    : '칭호를 해제했습니다.';
  return `🏷️ ${titleText}`;
}

function formatMissions(result) {
  const missionList = result.type === 'daily' ? result.missions.daily : result.missions.weekly;
  const title = result.type === 'daily' ? '일일 미션' : '주간 미션';
  const body = missionList
    .map((mission) => {
      const mark = mission.claimed ? '✅' : mission.completed ? '🎁' : '⬜';
      return `${mark} **${mission.title}** — ${mission.description} (${mission.progress}) / 보상 ${mission.reward.coins.toLocaleString()}골드, ${mission.reward.xp.toLocaleString()} XP`;
    })
    .join('\n');
  const claimedText = result.claimed.length > 0
    ? `\n\n🎁 수령: ${result.claimed.length}개 / +${result.totalCoins.toLocaleString()}골드, +${result.totalXp.toLocaleString()} XP${result.eventBonus ? ' (이벤트 보너스 적용)' : ''}`
    : '\n\n새로 수령할 완료 미션이 없습니다.';

  return `📋 **${title}**\n${body}${claimedText}\n현재 골드: ${result.profile.balance.toLocaleString()}골드`;
}

function formatLotteryStatus(lottery) {
  const participants = lottery.participants.length > 0
    ? lottery.participants.map((ticket) => {
        const preview = formatLotteryEntries(ticket.entries, 2);
        return `- ${ticket.username}: ${ticket.count.toLocaleString()}장${preview ? ` (${preview})` : ''}`;
      }).join('\n')
    : '아직 구매된 복권이 없습니다.';
  const lastWinner = lottery.lastWinner
    ? `최근 당첨: ${lottery.lastWinner.username} / ${lottery.lastWinner.payout.toLocaleString()}골드`
    : null;
  const lastDraw = lottery.lastDraw
    ? `최근 번호: ${formatLotteryNumbers(lottery.lastDraw.winningNumbers)} + 보너스 ${formatLotteryNumber(lottery.lastDraw.bonusNumber)}`
    : null;
  const autoDraw = lottery.autoDrawEnabled
    ? `켜짐${lottery.autoDrawChannelId ? ` (<#${lottery.autoDrawChannelId}>)` : ' (기본 알림 채널)'}`
    : '꺼짐';

  return [
    '🎟️ **서버 복권 6/45**',
    `장당 가격: ${getLotteryTicketCost().toLocaleString()}골드`,
    `현재 잭팟: **${lottery.jackpot.toLocaleString()}골드**`,
    `판매된 복권: ${lottery.totalTickets.toLocaleString()}장`,
    `다음 자동 추첨: ${formatLotteryDrawTime(lottery.nextDrawAt)}`,
    `자동 추첨: ${autoDraw}`,
    '당첨 방식: 1~45 중 6개 번호 + 보너스 번호',
    '무당첨 회차는 잭팟 전액이 다음 추첨으로 이월됩니다.',
    participants,
    lastWinner,
    lastDraw
  ].filter(Boolean).join('\n');
}

function formatLotteryBuy(result) {
  const entries = formatLotteryEntries(result.entries, 5);
  const hiddenCount = Math.max(0, result.entries.length - 5);
  return [
    '🎟️ **복권 구매 완료**',
    `${result.quantity.toLocaleString()}장 구매 / 지출 ${result.totalCost.toLocaleString()}골드`,
    entries ? `내 번호: ${entries}${hiddenCount > 0 ? ` 외 ${hiddenCount.toLocaleString()}장` : ''}` : null,
    `잭팟 누적 +${result.jackpotAdded.toLocaleString()}골드${result.eventBonus ? ' (이벤트 보너스)' : ''}`,
    `현재 잭팟: ${result.lottery.jackpot.toLocaleString()}골드 / 내 골드: ${result.profile.balance.toLocaleString()}골드`,
    `다음 추첨: ${formatLotteryDrawTime(result.lottery.nextDrawAt)}`
  ].filter(Boolean).join('\n');
}

export function formatLotteryDraw(result) {
  const tierLines = result.tierSummaries
    .map((tier) => {
      const prizeText = tier.prizePerTicket > 0
        ? ` / 장당 ${tier.prizePerTicket.toLocaleString()}골드`
        : '';
      return `- ${tier.label}(${tier.description}): ${tier.winnerCount.toLocaleString()}장${prizeText}`;
    })
    .join('\n');
  const topWinner = result.headlineWinner
    ? `대표 당첨: **${result.headlineWinner.username}** / ${result.headlineWinner.totalPayout.toLocaleString()}골드`
    : '대표 당첨: 없음';

  return [
    `🎊 **복권 ${result.automatic ? '자동 ' : ''}추첨 완료**`,
    `당첨 번호: ${formatLotteryNumbers(result.winningNumbers)} + 보너스 ${formatLotteryNumber(result.bonusNumber)}`,
    `판매 ${result.totalTickets.toLocaleString()}장 / 추첨 전 잭팟 ${result.jackpotBefore.toLocaleString()}골드`,
    tierLines,
    topWinner,
    `총 지급: ${result.totalPaid.toLocaleString()}골드 / 이월: ${result.rollover.toLocaleString()}골드`,
    `다음 잭팟: ${result.lottery.jackpot.toLocaleString()}골드`,
    `다음 추첨: ${formatLotteryDrawTime(result.lottery.nextDrawAt)}`
  ].filter(Boolean).join('\n');
}

function formatLotteryAutoDraw(lottery) {
  const status = lottery.autoDrawEnabled
    ? `켜짐${lottery.autoDrawChannelId ? ` (<#${lottery.autoDrawChannelId}>)` : ' (기본 알림 채널)'}`
    : '꺼짐';

  return [
    '⏱️ **복권 자동 추첨 설정 완료**',
    `자동 추첨: ${status}`,
    `추첨 시각: ${getLotteryDrawScheduleText()}`,
    `다음 추첨: ${formatLotteryDrawTime(lottery.nextDrawAt)}`
  ].join('\n');
}

function formatLotteryEntries(entries, limit) {
  if (!Array.isArray(entries) || entries.length <= 0) return '';
  return entries
    .slice(0, limit)
    .map((entry) => `[${formatLotteryNumbers(entry.numbers)}]`)
    .join(', ');
}

function formatLotteryNumbers(numbers) {
  return numbers.map(formatLotteryNumber).join(' ');
}

function formatLotteryNumber(number) {
  return String(number).padStart(2, '0');
}

function formatShop(items, balance) {
  const body = items
    .map((item) => `${item.owned ? '✅' : '🛒'} **${item.label}** (${item.id}) — ${item.price.toLocaleString()}골드 / ${item.description}`)
    .join('\n');
  return `🛍️ **상점**\n내 골드: ${balance.toLocaleString()}골드\n${body}`;
}

function formatShopBuy(result) {
  return `🛍️ **구매 완료**\n${result.item.label} 구매 완료. 남은 골드: ${result.profile.balance.toLocaleString()}골드`;
}

function formatEventStatus(event) {
  if (!event) return '📣 현재 진행 중인 서버 이벤트가 없습니다.';
  return `📣 **진행 중인 서버 이벤트**\n${event.label}\n${event.description}\n주최: ${event.hostUsername}\n남은 시간: ${formatDuration(event.endsAt - Date.now())}`;
}

function formatEventStart(event) {
  return `📣 **서버 이벤트 시작**\n${event.label}\n${event.description}\n주최: ${event.hostUsername}\n지속 시간: ${formatDuration(event.endsAt - event.startedAt)}`;
}

function formatWeeklyActivitySummary(result) {
  const totalActions = result.totals.messages + result.totals.commands;
  const topCommands = result.topCommands.length > 0
    ? result.topCommands.map((command) => `/${command.name} ${command.count.toLocaleString()}회`).join(', ')
    : '없음';
  const dailyLines = result.days
    .map((day) => {
      const active = day.messages + day.commands > 0;
      return `${active ? '•' : '▫️'} ${day.date}: 채팅 ${day.messages.toLocaleString()}회 / 명령 ${day.commands.toLocaleString()}회 / XP ${day.xp.toLocaleString()}`;
    })
    .join('\n');

  return [
    `📊 **최근 7일 활동 요약 — ${result.profile.username}**`,
    `기간: **${result.range.startDate} ~ ${result.range.endDate}** (KST 기준)`,
    '',
    `총 활동: **${totalActions.toLocaleString()}회** / 활동일 **${result.totals.activeDays}/${result.range.days}일**`,
    `채팅: **${result.totals.messages.toLocaleString()}회** (+${result.totals.chatXp.toLocaleString()} XP)`,
    `명령어: **${result.totals.commands.toLocaleString()}회** (+${result.totals.commandXp.toLocaleString()} XP)`,
    `활동 XP 합계: **${result.totals.xp.toLocaleString()} XP**`,
    `자주 쓴 명령어: ${topCommands}`,
    '',
    '🗓️ **일별 내역**',
    dailyLines,
    '',
    '채팅과 명령어를 꾸준히 사용할수록 메인 프로필 XP가 조금씩 누적됩니다.'
  ].join('\n');
}
