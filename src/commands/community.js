import { SlashCommandBuilder } from 'discord.js';
import {
  getCommunityTitles,
  getEventTypes,
  getLotteryTicketCost,
  getShopItems
} from '../systems/community.js';
import { formatDuration } from './economy.js';

const communityCommandNames = new Set([
  '업적',
  '칭호',
  '미션',
  '복권',
  '상점',
  '서버이벤트'
]);

export const communityCommands = [
  new SlashCommandBuilder()
    .setName('업적')
    .setDescription('업적 진행도와 보상을 확인하고 완료 업적을 수령합니다.'),
  new SlashCommandBuilder()
    .setName('칭호')
    .setDescription('보유 칭호를 확인하거나 장착합니다.')
    .addStringOption((option) =>
      option
        .setName('선택')
        .setDescription('장착할 칭호')
        .addChoices(
          { name: '칭호 해제', value: 'none' },
          ...getCommunityTitles().map((title) => ({ name: title.label, value: title.id }))
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
            .setMaxValue(50)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('추첨')
        .setDescription('현재 판매된 복권 중 당첨자를 추첨합니다.')
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
    )
];

export function getCommunityCommandPayloads() {
  return communityCommands.map((command) => command.toJSON());
}

export async function handleCommunityCommand(interaction, community, logger = console) {
  if (!interaction.isChatInputCommand()) return false;
  if (!communityCommandNames.has(interaction.commandName)) return false;

  if (!interaction.inGuild()) {
    await interaction.reply({
      content: '서버에서만 사용할 수 있는 명령어입니다.',
      ephemeral: true
    });
    return true;
  }

  try {
    await routeCommunityCommand(interaction, community);
  } catch (error) {
    logger.error?.(error);
    await interaction.reply({
      content: `처리 실패: ${error.message}`,
      ephemeral: true
    });
  }

  return true;
}

async function routeCommunityCommand(interaction, community) {
  const guildId = interaction.guildId;
  const user = interaction.user;
  const base = {
    guildId,
    userId: user.id,
    username: user.username
  };

  if (interaction.commandName === '업적') {
    const result = await community.claimAchievements(base);
    await interaction.reply(formatAchievements(result));
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

    const overview = await community.getOverview(base);
    await interaction.reply(formatTitles(overview.titles));
    return;
  }

  if (interaction.commandName === '미션') {
    const type = interaction.options.getString('종류') ?? 'daily';
    const result = await community.claimMissions({
      ...base,
      type
    });
    await interaction.reply(formatMissions(result));
    return;
  }

  if (interaction.commandName === '복권') {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === '현황') {
      const overview = await community.getOverview(base);
      await interaction.reply(formatLotteryStatus(overview.lottery));
      return;
    }

    if (subcommand === '구매') {
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
}

function formatAchievements(result) {
  const claimText = result.claimed.length > 0
    ? `\n\n🎁 이번에 수령: ${result.claimed.map((item) => `**${item.title}**`).join(', ')} / +${result.totalCoins.toLocaleString()}원, +${result.totalXp.toLocaleString()} XP`
    : '\n\n받을 수 있는 새 업적 보상은 없습니다.';
  const body = result.achievements
    .map((achievement) => {
      const mark = achievement.claimed ? '✅' : achievement.completed ? '🎁' : '⬜';
      const titleReward = achievement.reward.title ? `, 칭호 ${achievement.reward.title.label}` : '';
      return `${mark} **${achievement.title}** — ${achievement.description} (${achievement.progress}) / 보상 ${achievement.reward.coins.toLocaleString()}원, ${achievement.reward.xp.toLocaleString()} XP${titleReward}`;
    })
    .join('\n');

  return `🏆 **업적**\n${body}${claimText}\n현재 메인 코인: ${result.profile.balance.toLocaleString()}원`;
}

function formatTitles(titles) {
  const owned = titles.filter((title) => title.owned);
  if (owned.length === 0) {
    return '🏷️ **칭호**\n아직 보유한 칭호가 없습니다. `/업적`, `/상점 구매`로 칭호를 얻어보세요.';
  }

  const body = owned
    .map((title) => `${title.equipped ? '✅' : '▫️'} ${title.label} — ${title.description}`)
    .join('\n');
  return `🏷️ **보유 칭호**\n${body}\n\n장착하려면 \`/칭호 선택\`을 사용하세요.`;
}

function formatTitleEquip(result) {
  const titleText = result.equippedTitle
    ? `${result.equippedTitle.label} 칭호를 장착했습니다.`
    : '칭호를 해제했습니다.';
  return `🏷️ ${titleText}`;
}

function formatMissions(result) {
  const missionList = result.type === 'daily' ? result.missions.daily : result.missions.weekly;
  const title = result.type === 'daily' ? '일일 미션' : '주간 미션';
  const body = missionList
    .map((mission) => {
      const mark = mission.claimed ? '✅' : mission.completed ? '🎁' : '⬜';
      return `${mark} **${mission.title}** — ${mission.description} (${mission.progress}) / 보상 ${mission.reward.coins.toLocaleString()}원, ${mission.reward.xp.toLocaleString()} XP`;
    })
    .join('\n');
  const claimedText = result.claimed.length > 0
    ? `\n\n🎁 수령: ${result.claimed.length}개 / +${result.totalCoins.toLocaleString()}원, +${result.totalXp.toLocaleString()} XP${result.eventBonus ? ' (이벤트 보너스 적용)' : ''}`
    : '\n\n새로 수령할 완료 미션이 없습니다.';

  return `📋 **${title}**\n${body}${claimedText}\n현재 메인 코인: ${result.profile.balance.toLocaleString()}원`;
}

function formatLotteryStatus(lottery) {
  const participants = lottery.participants.length > 0
    ? lottery.participants.map((ticket) => `- ${ticket.username}: ${ticket.count.toLocaleString()}장`).join('\n')
    : '아직 구매된 복권이 없습니다.';
  const lastWinner = lottery.lastWinner
    ? `\n최근 당첨: ${lottery.lastWinner.username} / ${lottery.lastWinner.payout.toLocaleString()}원`
    : '';

  return `🎟️ **서버 복권**\n장당 가격: ${getLotteryTicketCost().toLocaleString()}원\n현재 잭팟: **${lottery.jackpot.toLocaleString()}원**\n판매된 복권: ${lottery.totalTickets.toLocaleString()}장\n${participants}${lastWinner}`;
}

function formatLotteryBuy(result) {
  return [
    '🎟️ **복권 구매 완료**',
    `${result.quantity.toLocaleString()}장 구매 / 지출 ${result.totalCost.toLocaleString()}원`,
    `잭팟 누적 +${result.jackpotAdded.toLocaleString()}원${result.eventBonus ? ' (이벤트 보너스)' : ''}`,
    `현재 잭팟: ${result.lottery.jackpot.toLocaleString()}원 / 내 메인 코인: ${result.profile.balance.toLocaleString()}원`
  ].join('\n');
}

function formatLotteryDraw(result) {
  return `🎊 **복권 추첨 완료**\n당첨자: **${result.winner.username}**\n당첨금: **${result.payout.toLocaleString()}원**\n다음 기본 잭팟: ${result.lottery.jackpot.toLocaleString()}원`;
}

function formatShop(items, balance) {
  const body = items
    .map((item) => `${item.owned ? '✅' : '🛒'} **${item.label}** (${item.id}) — ${item.price.toLocaleString()}원 / ${item.description}`)
    .join('\n');
  return `🛍️ **상점**\n내 메인 코인: ${balance.toLocaleString()}원\n${body}`;
}

function formatShopBuy(result) {
  return `🛍️ **구매 완료**\n${result.item.label} 구매 완료. 남은 메인 코인: ${result.profile.balance.toLocaleString()}원`;
}

function formatEventStatus(event) {
  if (!event) return '📣 현재 진행 중인 서버 이벤트가 없습니다.';
  return `📣 **진행 중인 서버 이벤트**\n${event.label}\n${event.description}\n주최: ${event.hostUsername}\n남은 시간: ${formatDuration(event.endsAt - Date.now())}`;
}

function formatEventStart(event) {
  return `📣 **서버 이벤트 시작**\n${event.label}\n${event.description}\n주최: ${event.hostUsername}\n지속 시간: ${formatDuration(event.endsAt - event.startedAt)}`;
}
