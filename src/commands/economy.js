import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import {
  formatCurrencyAmount,
  getCurrencyChoices
} from '../systems/currencies.js';
import {
  getCurrentProfileLevelBadge,
  getDisplayProfileLevelBadge,
  getNextProfileLevelBadge,
  getProfileBadgeAttachment,
  getProfileLevelBadges,
  getProfileLevelTier,
  normalizeProfileLevel
} from '../systems/profile-assets.js';

export const economyCommands = [
  new SlashCommandBuilder()
    .setName('프로필')
    .setDescription('내 레벨, 경험치, 골드, 성장 배지를 확인합니다.'),
  new SlashCommandBuilder()
    .setName('출석')
    .setDescription('하루 한 번 출석 골드 보상을 받습니다.'),
  new SlashCommandBuilder()
    .setName('송금')
    .setDescription('다른 유저에게 골드를 송금합니다.')
    .addUserOption((option) =>
      option
        .setName('대상')
        .setDescription('골드를 받을 유저')
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('금액')
        .setDescription('송금할 골드 금액')
        .setMinValue(1)
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('환전')
    .setDescription('이전 전용 재화는 골드로 통합되어 환전 없이 같은 잔액을 사용합니다.')
    .addStringOption((option) =>
      option
        .setName('보낼재화')
        .setDescription('이전 재화명 또는 골드')
        .setRequired(true)
        .addChoices(...getCurrencyChoices())
    )
    .addStringOption((option) =>
      option
        .setName('받을재화')
        .setDescription('이전 재화명 또는 골드')
        .setRequired(true)
        .addChoices(...getCurrencyChoices())
    )
    .addIntegerOption((option) =>
      option
        .setName('금액')
        .setDescription('확인할 골드 금액')
        .setMinValue(1)
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('랭킹')
    .setDescription('이 서버의 레벨/경험치 랭킹을 확인합니다.')
    .addIntegerOption((option) =>
      option
        .setName('개수')
        .setDescription('표시할 인원 수')
        .setMinValue(1)
        .setMaxValue(20)
    ),
  new SlashCommandBuilder()
    .setName('재화정보')
    .setDescription('통합 골드 사용처와 기존 지갑 정산 기준을 확인합니다.')
];

export function getEconomyCommandPayloads() {
  return economyCommands.map((command) => command.toJSON());
}

export async function handleEconomyCommand(interaction, economy) {
  if (!interaction.isChatInputCommand()) return false;

  if (!interaction.inGuild()) {
    await interaction.reply({
      content: '서버에서만 사용할 수 있는 명령어입니다.',
      ephemeral: true
    });
    return true;
  }

  const guildId = interaction.guildId;
  const user = interaction.user;

  if (interaction.commandName === '프로필') {
    const profile = await economy.getProfile(guildId, user.id, user.username);
    await interaction.reply(createProfileReplyPayload(profile));
    return true;
  }

  if (interaction.commandName === '출석') {
    const result = await economy.claimDaily({
      guildId,
      userId: user.id,
      username: user.username
    });

    if (!result.claimed) {
      await interaction.reply({
        content: `이미 출석 보상을 받았습니다. 남은 시간: ${formatDuration(result.remainingMs)}`,
        ephemeral: true
      });
      return true;
    }

    const streakText = result.streak > 1
      ? ` / 연속 ${result.streak}일`
      : '';
    const bonusText = result.streakBonusXp > 0
      ? ` / 연속 보너스 +${result.streakBonusXp.toLocaleString()} XP`
      : '';
    const levelText = result.leveledUp
      ? ` / 레벨업 Lv.${result.profile.level} 보너스 +${formatCurrencyAmount(result.levelReward, 'main')}`
      : '';

    await interaction.reply(
      `✅ 출석 완료! +${result.xpGained.toLocaleString()} XP${bonusText}, +${formatCurrencyAmount(result.reward, 'main')} 지급${levelText}${streakText}. 골드: ${formatCurrencyAmount(result.profile.balance, 'main')}`
    );
    return true;
  }

  if (interaction.commandName === '송금') {
    const target = interaction.options.getUser('대상', true);
    const amount = interaction.options.getInteger('금액', true);

    if (target.bot) {
      await interaction.reply({
        content: '봇에게는 송금할 수 없습니다.',
        ephemeral: true
      });
      return true;
    }

    try {
      const result = await economy.transfer({
        guildId,
        fromUserId: user.id,
        fromUsername: user.username,
        toUserId: target.id,
        toUsername: target.username,
        amount
      });

      await interaction.reply(
        `💸 ${target}님에게 ${formatCurrencyAmount(result.amount, 'main')}를 송금했습니다. 내 골드: ${formatCurrencyAmount(result.from.balance, 'main')}`
      );
    } catch (error) {
      await interaction.reply({
        content: `송금 실패: ${error.message}`,
        ephemeral: true
      });
    }

    return true;
  }

  if (interaction.commandName === '환전') {
    try {
      const result = await economy.exchangeWallet({
        guildId,
        userId: user.id,
        username: user.username,
        fromCurrency: interaction.options.getString('보낼재화', true),
        toCurrency: interaction.options.getString('받을재화', true),
        amount: interaction.options.getInteger('금액', true)
      });

      await interaction.reply(formatExchangeResult(result));
    } catch (error) {
      await interaction.reply({
        content: `환전 확인 실패: ${error.message}`,
        ephemeral: true
      });
    }

    return true;
  }

  if (interaction.commandName === '랭킹') {
    const limit = interaction.options.getInteger('개수') ?? 10;
    const rows = await economy.getLeaderboard(guildId, limit);

    if (rows.length === 0) {
      await interaction.reply('아직 랭킹 데이터가 없습니다.');
      return true;
    }

    await interaction.reply(formatLeaderboard(rows));
    return true;
  }

  if (interaction.commandName === '재화정보') {
    await interaction.reply(formatCurrencyInfo());
    return true;
  }

  return false;
}

const PROFILE_SHOP_BADGE_LABELS = Object.freeze({
  badge_luck: '행운 배지',
  badge_gold: '골드 배지'
});

const PROFILE_TITLE_LABELS = Object.freeze({
  steady: '성실한 출석러',
  rich: '동네 부자',
  gambler: '도박꾼',
  lucky: '행운아',
  missioner: '미션러',
  host: '이벤트 주최자',
  vip: 'VIP',
  collector: '수집가'
});

export function createProfileReplyPayload(profile) {
  const content = formatProfile(profile);
  const displayBadge = getDisplayProfileLevelBadge(profile.level);
  const attachment = getProfileBadgeAttachment(displayBadge);

  if (!attachment) return content;

  const tier = getProfileLevelTier(profile.level);
  const embed = new EmbedBuilder()
    .setTitle(`${displayBadge.badgeText} · ${displayBadge.name}`)
    .setDescription('현재 성장 구간 대표 배지')
    .setImage(`attachment://${attachment.name}`)
    .setColor(tier.color)
    .setFooter({ text: '프로필 성장 배지 이미지' });

  return {
    content,
    embeds: [embed],
    files: [attachment]
  };
}

export function formatProfile(profile) {
  const level = normalizeProfileLevel(profile.level);
  const tier = getProfileLevelTier(level);
  const migrationText = profile.currencyMigration?.convertedGold > 0
    ? `기존 전용 지갑 정산: **+${formatCurrencyAmount(profile.currencyMigration.convertedGold, 'main')}**`
    : '기존 전용 지갑: **정산 완료**';
  const titleText = getEquippedTitleText(profile);
  const topBorder = `${tier.topLeft}${'─'.repeat(10)} ${tier.title} 성장 카드 ${'─'.repeat(10)}${tier.topRight}`;
  const bottomBorder = `${tier.bottomLeft}${'─'.repeat(8)} ${formatNextBadgeHint(level)} ${'─'.repeat(8)}${tier.bottomRight}`;

  return [
    topBorder,
    `**${profile.username}님의 프로필**${titleText}`,
    `단계: **${tier.title}**`,
    `카드 효과: **${tier.aura}**`,
    `레벨: **${level}**`,
    `경험치: **${profile.totalXp.toLocaleString()} XP**`,
    `성장 배지: ${formatLevelBadgeGallery(level)}`,
    `대표 배지 이미지: ${formatDisplayBadgeText(level)}`,
    `다음 배지: ${formatNextBadgeTarget(level)}`,
    `연속 출석: **${profile.dailyStreak.toLocaleString()}일**`,
    `골드: **${formatCurrencyAmount(profile.balance, 'main')}**`,
    `꾸미기 배지: ${formatShopBadgeGallery(profile)}`,
    migrationText,
    bottomBorder
  ].join('\n');
}

function formatLevelBadgeGallery(level) {
  const badges = getProfileLevelBadges(level);
  const currentBadge = getCurrentProfileLevelBadge(level);
  const previousCount = Math.max(0, badges.length - 1);
  const previousText = previousCount > 0
    ? ` / 이전 배지 ${previousCount}개`
    : '';

  return `현재 **${currentBadge.badgeText} · ${currentBadge.name}**${previousText}`;
}

function formatDisplayBadgeText(level) {
  const badge = getDisplayProfileLevelBadge(level);
  return `**${badge.badgeText} · ${badge.name}**`;
}

function formatNextBadgeTarget(level) {
  const nextBadge = getNextProfileLevelBadge(level);
  if (!nextBadge) {
    return '**RADIANT · 무지개 신화 배지까지 모두 도달했습니다!**';
  }

  return `**${nextBadge.badgeText} · ${nextBadge.name}**까지 ${nextBadge.minLevel - level}레벨`;
}

function formatNextBadgeHint(level) {
  const nextBadge = getNextProfileLevelBadge(level);
  if (!nextBadge) return '모든 성장 배지 해금';
  return `다음 배지 ${nextBadge.badgeText}`;
}

function getEquippedTitleText(profile) {
  const title = profile.community?.equippedTitle;
  if (!title) return '';
  return ` · 칭호 **${PROFILE_TITLE_LABELS[title] ?? title}**`;
}

function formatShopBadgeGallery(profile) {
  const badgeIds = Array.isArray(profile.community?.cosmetics?.badges)
    ? profile.community.cosmetics.badges
    : [];
  if (badgeIds.length === 0) return '없음';

  return badgeIds
    .map((badgeId) => PROFILE_SHOP_BADGE_LABELS[badgeId] ?? badgeId)
    .join(' / ');
}

function formatExchangeResult(result) {
  return [
    '🔁 **환전 불필요**',
    result.message ?? '모든 재화가 골드 하나로 통합되어 있습니다.',
    `확인 금액: **${formatCurrencyAmount(result.spent, 'main')}**`,
    `현재 골드: **${formatCurrencyAmount(result.profile.balance, 'main')}**`
  ].join('\n');
}

function formatCurrencyInfo() {
  return [
    '💱 **재화정보 / 통합 골드**',
    '모든 재화는 봇 내부 게임머니이며 실제 현금 결제, 실제 현금 환전, 실제 투자와 연결되지 않습니다.',
    '',
    '📌 **현재 기준**',
    '- 단일 화폐: **골드**',
    '- 카지노, RPG, 검강화, 가상주식, 커뮤니티 상점/복권/송금이 모두 같은 골드 잔액을 사용합니다.',
    '- `/환전`은 호환용 안내 명령이며 더 이상 잔액을 이동하지 않습니다.',
    '',
    '🧮 **기존 지갑 정산 기준**',
    '- 카지노칩: 기존 잔액의 90%를 골드로 반영',
    '- RPG 골드: 기존 잔액의 30%를 골드로 반영',
    '- 강화 코인: 기존 잔액의 50%를 골드로 반영',
    '- 주식 현금: 기존 잔액의 95%를 골드로 반영',
    '',
    '이전 전용 재화는 각 컨텐츠의 획득 속도와 외부 이동 보정률을 기준으로 골드에 합산되어 인플레이션을 줄입니다.'
  ].join('\n');
}

function formatLeaderboard(rows) {
  const body = rows
    .map((profile, index) => {
      const rank = index + 1;
      return `${rank}. **${profile.username}** — Lv.${profile.level} / 경험치 ${profile.totalXp.toLocaleString()} XP / 골드 ${formatCurrencyAmount(profile.balance, 'main')}`;
    })
    .join('\n');

  return `🏆 **서버 레벨 랭킹**\n${body}`;
}

export function formatDuration(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}시간 ${minutes}분`;
  if (minutes > 0) return `${minutes}분 ${seconds}초`;
  return `${seconds}초`;
}
