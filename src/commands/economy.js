import {
  ActionRowBuilder,
  MessageFlags,
  EmbedBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder
} from 'discord.js';
import {
  ACCOUNT_LINK_SELECT_CUSTOM_ID_PREFIX,
  isAccountSelectionRequiredError
} from '../systems/accounts.js';
import { getCommunityTitle } from '../systems/achievements.js';
import { getCommunityCosmeticBadge } from '../systems/community.js';
import { formatCurrencyAmount } from '../systems/currencies.js';
import {
  getCurrentProfileLevelBadge,
  getDisplayProfileLevelBadge,
  getNextProfileLevelBadge,
  getProfileBadgeAttachment,
  getProfileLevelBadges,
  getProfileLevelTier,
  normalizeProfileLevel
} from '../systems/profile-assets.js';
import {
  getRpgAdvancedClassConfig,
  getRpgAreaConfig,
  getRpgClassConfig,
  getRpgDerivedStats,
  getRpgGenderConfig
} from '../systems/rpg.js';
import { getSwordAssetLabel } from '../systems/sword-assets.js';
import {
  createAllowedMentionsForUsers,
  formatUserMention
} from './ui.js';
import { safeReplyToInteraction } from './interactions.js';

const DEFAULT_SOCIAL_LOAN_TERM_HOURS = 24;
const DEFAULT_SOCIAL_LOAN_REPAYMENT_MODE = 'installment';
const DEFAULT_SOCIAL_LOAN_INTEREST_PERCENT = 5;
const DEFAULT_SOCIAL_LOAN_INTEREST_PERIOD_HOURS = 3;
const DEFAULT_SOCIAL_LOAN_INTEREST_TYPE = 'compound';
const SOCIAL_LOAN_INTEREST_PERCENT_CHOICES = Object.freeze([3, 5, 10, 15, 20]);
const SOCIAL_LOAN_TERM_HOUR_CHOICES = Object.freeze([24, 48, 72]);
const SOCIAL_LOAN_INTEREST_PERIOD_HOUR_CHOICES = Object.freeze([1, 2, 3]);
const SOCIAL_LOAN_INTEREST_TYPE_CHOICES = Object.freeze([
  { name: '단리', value: 'simple' },
  { name: '복리', value: 'compound' }
]);

export const economyCommands = [
  new SlashCommandBuilder()
    .setName('프로필')
    .setDescription('내/다른 유저의 레벨, 경험치, 골드, 성장 배지와 통합 성장 요약을 확인합니다.')
    .addUserOption((option) =>
      option
        .setName('대상')
        .setDescription('프로필을 확인할 유저')
    ),
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
    .setName('돈빌리기')
    .setDescription('상대에게 골드 대출을 요청합니다. 승인되면 돈이 이동합니다.')
    .addUserOption((option) =>
      option
        .setName('대상')
        .setDescription('돈을 빌려줄 유저')
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('돈')
        .setDescription('빌릴 골드')
        .setMinValue(1)
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('이자')
        .setDescription('이자율(%). 기본 5%')
        .addChoices(...SOCIAL_LOAN_INTEREST_PERCENT_CHOICES.map((value) => ({
          name: `${value}%`,
          value
        })))
    )
    .addIntegerOption((option) =>
      option
        .setName('기간')
        .setDescription('상환 기간. 기본 24시간')
        .addChoices(...SOCIAL_LOAN_TERM_HOUR_CHOICES.map((value) => ({
          name: `${value}시간`,
          value
        })))
    )
    .addIntegerOption((option) =>
      option
        .setName('이자주기')
        .setDescription('이자가 붙는 주기. 기본 3시간')
        .addChoices(...SOCIAL_LOAN_INTEREST_PERIOD_HOUR_CHOICES.map((value) => ({
          name: `${value}시간`,
          value
        })))
    )
    .addStringOption((option) =>
      option
        .setName('이자방식')
        .setDescription('이자 계산 방식. 기본 복리')
        .addChoices(...SOCIAL_LOAN_INTEREST_TYPE_CHOICES)
    ),
  new SlashCommandBuilder()
    .setName('돈빌려주기')
    .setDescription('나에게 온 대출 요청을 승인하고 골드를 빌려줍니다.')
    .addUserOption((option) =>
      option
        .setName('대상')
        .setDescription('돈을 빌려달라고 요청한 유저')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('돈갚기')
    .setDescription('빌린 골드를 갚습니다. 돈을 비우면 가능한 만큼 갚습니다.')
    .addUserOption((option) =>
      option
        .setName('대상')
        .setDescription('돈을 빌려준 유저')
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('돈')
        .setDescription('갚을 골드. 비우면 가진 만큼 갚습니다.')
        .setMinValue(1)
    ),
  new SlashCommandBuilder()
    .setName('랭킹')
    .setDescription('이 서버의 레벨/경험치 랭킹 또는 음악 인기곡 랭킹을 확인합니다.')
    .addStringOption((option) =>
      option
        .setName('종류')
        .setDescription('확인할 랭킹 종류')
        .addChoices(
          { name: '레벨', value: '레벨' },
          { name: '인기곡', value: '인기곡' }
        )
    )
    .addIntegerOption((option) =>
      option
        .setName('개수')
        .setDescription('표시할 인원 수')
        .setMinValue(1)
        .setMaxValue(20)
    ),
  new SlashCommandBuilder()
    .setName('재화정보')
    .setDescription('통합 골드 사용처와 기존 지갑 정산 기준을 확인합니다.'),
  new SlashCommandBuilder()
    .setName('계정연동')
    .setDescription('여러 서버에 흩어진 희희봇 계정을 하나로 선택하고 나머지는 삭제합니다.')
];

export function getEconomyCommandPayloads() {
  return economyCommands.map((command) => command.toJSON());
}

export async function handleEconomyCommand(interaction, economy, services = {}) {
  if (!interaction.isChatInputCommand()) return false;

  if (!interaction.inGuild()) {
    await interaction.reply({
      content: '서버에서만 사용할 수 있는 명령어입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  const guildId = interaction.guildId;
  const user = interaction.user;
  const loanAction = getLoanAction(interaction);

  if (interaction.commandName === '계정연동') {
    const summary = await economy.getAccountLinkSummary({
      guildId,
      userId: user.id,
      username: user.username
    });

    if (summary.required) {
      await interaction.reply(createAccountLinkSelectionPayload(summary, user.id));
      return true;
    }

    const profile = await economy.getProfile(guildId, user.id, user.username);
    await interaction.reply({
      content: `✅ 계정 연동 완료: 이제 어느 서버에서든 **${profile.username}**님의 통합 계정 1개만 사용합니다.`,
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (interaction.commandName === '프로필') {
    const target = getProfileTargetUser(interaction, user);
    if (target.bot) {
      await safeReplyToInteraction(interaction, {
        content: '봇 프로필은 표시하지 않습니다.',
        flags: MessageFlags.Ephemeral
      });
      return true;
    }

    let profile;
    try {
      profile = await economy.getProfile(guildId, target.id, target.username);
    } catch (error) {
      if (!isAccountSelectionRequiredError(error)) throw error;
      await safeReplyToInteraction(interaction, {
        content: target.id === user.id
          ? '계정이 여러 서버에 있습니다. `/계정연동`으로 사용할 계정 1개를 먼저 선택해주세요.'
          : '대상 유저에게 여러 서버 계정이 있어 프로필을 표시할 수 없습니다. 대상 유저가 `/계정연동`을 먼저 완료해야 합니다.',
        flags: MessageFlags.Ephemeral
      });
      return true;
    }
    const profileContext = await createProfileContext({
      guildId,
      target,
      stocks: services?.stocks
    });
    await safeReplyToInteraction(interaction, createProfileReplyPayload(profile, profileContext));
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
        flags: MessageFlags.Ephemeral
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
        flags: MessageFlags.Ephemeral
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

      await interaction.reply({
        content: `💸 ${formatUserMention(target, target.username)}님에게 ${formatCurrencyAmount(result.amount, 'main')}를 송금했습니다. 내 골드: ${formatCurrencyAmount(result.from.balance, 'main')}`,
        allowedMentions: createAllowedMentionsForUsers([target.id])
      });
    } catch (error) {
      await interaction.reply({
        content: `송금 실패: ${error.message}`,
        flags: MessageFlags.Ephemeral
      });
    }

    return true;
  }

  if (loanAction === 'status') {
    try {
      const target = interaction.options.getUser('대상');
      const status = await economy.getUserLoanStatus({
        guildId,
        userId: user.id,
        username: user.username,
        targetUserId: target?.id,
        targetUsername: target?.username
      });

      await safeReplyToInteraction(interaction, {
        content: formatUserLoanStatus(status, user),
        flags: MessageFlags.Ephemeral
      });
    } catch (error) {
      await safeReplyToInteraction(interaction, {
        content: `대출 현황 조회 실패: ${error.message}`,
        flags: MessageFlags.Ephemeral
      });
    }

    return true;
  }

  if (loanAction === 'request') {
    try {
      const target = getRequiredUserOption(interaction, '대상', '돈을 빌려줄 유저');
      const amount = getRequiredIntegerOption(interaction, '돈', '빌릴 골드');
      const termHours = interaction.options.getInteger('기간') ?? DEFAULT_SOCIAL_LOAN_TERM_HOURS;
      const interestPercent = interaction.options.getInteger('이자') ?? DEFAULT_SOCIAL_LOAN_INTEREST_PERCENT;
      const interestPeriodHours = interaction.options.getInteger('이자주기') ?? DEFAULT_SOCIAL_LOAN_INTEREST_PERIOD_HOURS;
      const repaymentMode = DEFAULT_SOCIAL_LOAN_REPAYMENT_MODE;
      const interestType = interaction.options.getString('이자방식') ?? DEFAULT_SOCIAL_LOAN_INTEREST_TYPE;

      if (target.bot) {
        throw new Error('봇에게는 돈을 빌릴 수 없습니다.');
      }

      const result = await economy.requestUserLoan({
        guildId,
        borrowerUserId: user.id,
        borrowerUsername: user.username,
        lenderUserId: target.id,
        lenderUsername: target.username,
        amount,
        termHours,
        repaymentMode,
        interestPercent,
        interestPeriodHours,
        interestType
      });
      const notificationSent = await sendLoanRequestNotification({
        interaction,
        target,
        requester: user,
        request: result.request
      });

      await safeReplyToInteraction(interaction, {
        content: [
          `📨 ${formatUserMention(target, target.username)}님에게 **${formatCurrencyAmount(result.request.amount, 'main')}** 대출 요청을 보냈습니다.`,
          `조건: **${formatLoanInterestRate(result.request.interestBps)} ${formatLoanInterestType(result.request.interestType)}** / 기간: **${formatDuration(result.request.termMs)}** / 이자 주기: **${formatDuration(result.request.interestPeriodMs)}**`,
          `현재 예상 상환액: **${formatCurrencyAmount(result.request.totalDue, 'main')}**`,
          notificationSent ? '🔔 DM 알림을 보냈습니다.' : '🔔 채널로 알림했습니다.',
          `상대가 \`/돈빌려주기 대상:${user.username}\`을 실행하면 돈이 이동합니다.`
        ].join('\n'),
        allowedMentions: createAllowedMentionsForUsers([target.id])
      });
    } catch (error) {
      await safeReplyToInteraction(interaction, {
        content: `대출 요청 실패: ${error.message}`,
        flags: MessageFlags.Ephemeral
      });
    }

    return true;
  }

  if (loanAction === 'accept-request') {
    try {
      const target = getRequiredUserOption(interaction, '대상', '돈을 빌리려는 유저');

      if (target.bot) {
        throw new Error('봇의 대출 요청은 수락할 수 없습니다.');
      }

      const result = await economy.acceptUserLoanRequest({
        guildId,
        lenderUserId: user.id,
        lenderUsername: user.username,
        borrowerUserId: target.id,
        borrowerUsername: target.username
      });

      await safeReplyToInteraction(interaction, {
        content: [
          `🤝 ${formatUserMention(target, target.username)}님에게 **${formatCurrencyAmount(result.loan.principal, 'main')}**를 빌려줬습니다.`,
          `현재 갚을 금액: **${formatCurrencyAmount(result.loan.totalDue, 'main')}** / 만기: **${formatTimestamp(result.loan.dueAt)}**`,
          `이자: **${formatLoanInterestRate(result.loan.interestBps)} ${formatLoanInterestType(result.loan.interestType)}** / 이자 주기: **${formatDuration(result.loan.interestPeriodMs)}**`,
          `상대가 직접 갚기: \`/돈갚기 대상:${user.username}\``
        ].join('\n'),
        allowedMentions: createAllowedMentionsForUsers([target.id])
      });
    } catch (error) {
      await safeReplyToInteraction(interaction, {
        content: `돈빌려주기 실패: ${error.message}`,
        flags: MessageFlags.Ephemeral
      });
    }

    return true;
  }

  if (loanAction === 'offer') {
    try {
      const target = getRequiredUserOption(interaction, '대상', '돈을 빌리려는 유저');
      const interestPercent = interaction.options.getInteger('이자') ?? DEFAULT_SOCIAL_LOAN_INTEREST_PERCENT;
      const interestPeriodHours = interaction.options.getInteger('이자기간') ?? DEFAULT_SOCIAL_LOAN_INTEREST_PERIOD_HOURS;
      const interestType = interaction.options.getString('이자방식') ?? DEFAULT_SOCIAL_LOAN_INTEREST_TYPE;

      if (target.bot) {
        throw new Error('봇의 대출 요청은 수락할 수 없습니다.');
      }

      const result = await economy.offerUserLoan({
        guildId,
        lenderUserId: user.id,
        lenderUsername: user.username,
        borrowerUserId: target.id,
        borrowerUsername: target.username,
        interestPercent,
        interestPeriodHours,
        interestType
      });

      await safeReplyToInteraction(interaction, {
        content: [
          `✅ ${formatUserMention(target, target.username)}님의 대출 요청에 조건을 제시했습니다.`,
          `원금: **${formatCurrencyAmount(result.offer.amount, 'main')}** → 상환 예정액: **${formatCurrencyAmount(result.offer.totalDue, 'main')}**`,
          `이자: **${interestPercent}% ${formatLoanInterestType(result.offer.interestType)}** / 이자 주기: **${formatDuration(result.offer.interestPeriodMs)}** / 기간: **${formatDuration(result.offer.termMs)}** / 상환: **${formatLoanRepaymentMode(result.offer.repaymentMode)}**`,
          `빌리는 유저가 \`/돈빌리기 대상:${user.username} 행동:결정\`을 실행하면 돈이 이동합니다.`
        ].join('\n'),
        allowedMentions: createAllowedMentionsForUsers([target.id])
      });
    } catch (error) {
      await safeReplyToInteraction(interaction, {
        content: `대출 조건 제시 실패: ${error.message}`,
        flags: MessageFlags.Ephemeral
      });
    }

    return true;
  }

  if (loanAction === 'decide') {
    try {
      const target = getRequiredUserOption(interaction, '대상', '돈을 빌려줄 유저');
      const choice = interaction.options.getString('선택') ?? 'accept';

      const result = await economy.decideUserLoan({
        guildId,
        borrowerUserId: user.id,
        borrowerUsername: user.username,
        lenderUserId: target.id,
        lenderUsername: target.username,
        accept: choice === 'accept'
      });

      await safeReplyToInteraction(interaction, {
        content: result.accepted
          ? [
              `🤝 ${formatUserMention(target, target.username)}님에게서 **${formatCurrencyAmount(result.loan.principal, 'main')}**를 빌렸습니다.`,
              `갚을 금액: **${formatCurrencyAmount(result.loan.totalDue, 'main')}** / 만기: **${formatTimestamp(result.loan.dueAt)}**`,
              `이자: **${formatLoanInterestRate(result.loan.interestBps)} ${formatLoanInterestType(result.loan.interestType)}** / 이자 주기: **${formatDuration(result.loan.interestPeriodMs)}**`,
              `상환 방식: **${formatLoanRepaymentMode(result.loan.repaymentMode)}**${result.loan.repaymentMode === 'lump_sum' ? ' / 만기 후 수익 35% 자동 상환' : ' / 수익 35% 자동 상환'}`,
              `직접 갚기: \`/돈갚기 대상:${target.username}\``
            ].join('\n')
          : `🚫 ${formatUserMention(target, target.username)}님의 대출 조건을 거절했습니다.`,
        allowedMentions: createAllowedMentionsForUsers([target.id])
      });
    } catch (error) {
      await safeReplyToInteraction(interaction, {
        content: `대출 결정 실패: ${error.message}`,
        flags: MessageFlags.Ephemeral
      });
    }

    return true;
  }

  if (loanAction === 'repay') {
    try {
      const target = getRequiredUserOption(interaction, '대상', '돈을 빌려준 유저');
      const amount = interaction.options.getInteger('돈');

      const result = await economy.repayUserLoan({
        guildId,
        borrowerUserId: user.id,
        borrowerUsername: user.username,
        lenderUserId: target.id,
        lenderUsername: target.username,
        amount
      });

      await safeReplyToInteraction(interaction, {
        content: [
          `💳 ${formatUserMention(target, target.username)}님에게 **${formatCurrencyAmount(result.repaid, 'main')}**를 상환했습니다.`,
          `남은 대출금: **${formatCurrencyAmount(result.remaining, 'main')}** / 내 골드: **${formatCurrencyAmount(result.borrower.balance, 'main')}**`
        ].join('\n'),
        allowedMentions: createAllowedMentionsForUsers([target.id])
      });
    } catch (error) {
      await safeReplyToInteraction(interaction, {
        content: `상환 실패: ${error.message}`,
        flags: MessageFlags.Ephemeral
      });
    }

    return true;
  }

  if (interaction.commandName === '랭킹') {
    const rankingType = interaction.options.getString?.('종류') ?? '레벨';
    if (rankingType !== '레벨') return false;

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

export async function handleAccountLinkComponent(interaction, economy) {
  if (!interaction.isStringSelectMenu?.()
    || !interaction.customId?.startsWith(`${ACCOUNT_LINK_SELECT_CUSTOM_ID_PREFIX}:`)) {
    return false;
  }

  const [, ownerId] = interaction.customId.split(':');
  if (ownerId !== interaction.user.id) {
    await interaction.reply({
      content: '이 계정 선택 메뉴는 명령어를 실행한 유저만 사용할 수 있습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  const selectedAccountId = interaction.values?.[0];
  const result = await economy.resolveAccountLink({
    guildId: interaction.guildId,
    userId: interaction.user.id,
    username: interaction.user.username,
    selectedAccountId
  });

  await interaction.update({
    content: [
      '✅ 계정 연동 완료',
      `선택한 계정: **${result.selected.label}**`,
      `삭제한 중복 계정: **${result.deletedAccountCount.toLocaleString()}개**`,
      '이제 희희봇이 있는 모든 서버에서 이 계정 하나만 사용합니다.'
    ].join('\n'),
    components: []
  });
  return true;
}

export async function replyWithAccountLinkSelectionIfNeeded(interaction, economy) {
  if (!interaction.isChatInputCommand?.()
    || !interaction.inGuild?.()
    || interaction.commandName === '계정연동') {
    return false;
  }

  const summary = await economy.getAccountLinkSummary({
    guildId: interaction.guildId,
    userId: interaction.user.id,
    username: interaction.user.username
  });

  if (!summary.required) return false;

  await interaction.reply(createAccountLinkSelectionPayload(summary, interaction.user.id));
  return true;
}

function getLoanAction(interaction) {
  if (interaction.commandName === '돈빌리기수락') return 'offer';
  if (interaction.commandName === '돈빌리기결정') return 'decide';
  if (interaction.commandName === '돈빌려주기') return 'accept-request';
  if (interaction.commandName === '돈갚기') return 'repay';
  if (interaction.commandName !== '돈빌리기') return null;
  return 'request';
}

function getRequiredUserOption(interaction, name, label) {
  const value = interaction.options.getUser(name);
  if (!value) throw new Error(`${label}를 입력해주세요.`);
  return value;
}

function getRequiredIntegerOption(interaction, name, label) {
  const value = interaction.options.getInteger(name);
  if (!Number.isInteger(value)) throw new Error(`${label}을(를) 입력해주세요.`);
  return value;
}

function createAccountLinkSelectionPayload(summary, ownerId) {
  const options = summary.candidates.slice(0, 25).map((candidate) => ({
    label: candidate.label,
    description: candidate.description,
    value: candidate.id
  }));

  const select = new StringSelectMenuBuilder()
    .setCustomId(`${ACCOUNT_LINK_SELECT_CUSTOM_ID_PREFIX}:${ownerId}`)
    .setPlaceholder('계속 사용할 계정 1개를 선택하세요')
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(options);

  return {
    content: [
      '⚠️ 같은 Discord 유저로 생성된 희희봇 계정이 여러 서버에서 발견되었습니다.',
      '계속 사용할 계정 1개를 선택하면 나머지 중복 계정은 삭제되고, 이후 모든 서버에서 선택한 계정만 사용합니다.'
    ].join('\n'),
    components: [new ActionRowBuilder().addComponents(select)],
    flags: MessageFlags.Ephemeral
  };
}

export function createProfileReplyPayload(profile, context = {}) {
  const sections = createProfileCardSections(profile, context);
  const profileText = formatProfile(profile, context);
  const displayBadge = getDisplayProfileLevelBadge(profile.level);
  const attachment = getProfileBadgeAttachment(displayBadge);

  if (!attachment) return profileText;

  const level = normalizeProfileLevel(profile.level);
  const tier = getProfileLevelTier(level);
  const embed = new EmbedBuilder()
    .setTitle(`${profile.username} · Lv.${level} ${tier.title}`)
    .setDescription(`대표 배지: **${displayBadge.badgeText} · ${displayBadge.name}**`)
    .addFields(sections)
    .setImage(`attachment://${attachment.name}`)
    .setColor(tier.color)
    .setFooter({ text: `${tier.aura} · 프로필 성장 배지 이미지` });

  return {
    content: `🪪 **${profile.username}님의 통합 프로필**`,
    embeds: [embed],
    files: [attachment]
  };
}

export function formatProfile(profile, context = {}) {
  return createProfileCardSections(profile, context)
    .map((section) => `${section.name}\n${section.value}`)
    .join('\n\n');
}

function createProfileCardSections(profile, context = {}) {
  const level = normalizeProfileLevel(profile.level);
  const tier = getProfileLevelTier(level);
  const displayBadge = getDisplayProfileLevelBadge(level);
  const migrationText = profile.currencyMigration?.convertedGold > 0
    ? `기존 전용 지갑 정산 **+${formatCurrencyAmount(profile.currencyMigration.convertedGold, 'main')}**`
    : '기존 전용 지갑 **정산 완료**';
  const titleText = getEquippedTitleText(profile);

  return [
    {
      name: '🎮 캐릭터 카드',
      value: [
        `**${profile.username}님의 프로필**${titleText}`,
        `Lv. **${level}** · 등급 **${tier.title}**`,
        `대표 배지 **${displayBadge.badgeText} · ${displayBadge.name}**`,
        `경험치 **${normalizeProfileCount(profile.totalXp).toLocaleString()} XP**`,
        `골드 **${formatCurrencyAmount(profile.balance, 'main')}** · 출석 **${normalizeProfileCount(profile.dailyStreak).toLocaleString()}일**`,
        `다음 배지 ${formatNextBadgeTarget(level)}`
      ].join('\n')
    },
    { name: '⚔️ RPG 캐릭터', value: formatRpgProfileSummary(profile) },
    { name: '🗡️ 검 성장', value: formatSwordProfileSummary(profile) },
    { name: '📈 자산/주식', value: formatStockProfileSummary(context) },
    { name: '🏅 커뮤니티', value: formatCommunityProfileSummary(profile) },
    {
      name: '🎖️ 성장/정산',
      value: [
        `성장 배지: ${formatLevelBadgeGallery(level)}`,
        `꾸미기 배지: ${formatShopBadgeGallery(profile)}`,
        `카드 효과: **${tier.aura}**`,
        `대출: ${formatSocialLoanSummary(profile)}`,
        migrationText
      ].join('\n')
    }
  ];
}

function getProfileTargetUser(interaction, fallbackUser) {
  if (typeof interaction.options?.getUser !== 'function') return fallbackUser;
  return interaction.options.getUser('대상') ?? fallbackUser;
}

async function createProfileContext({ guildId, target, stocks }) {
  if (typeof stocks?.getPortfolio !== 'function') return {};

  try {
    return {
      stockPortfolio: await stocks.getPortfolio({
        guildId,
        userId: target.id,
        username: target.username
      })
    };
  } catch (error) {
    return {
      stockError: error
    };
  }
}

function formatRpgProfileSummary(profile) {
  const rpg = profile.rpg;
  if (!rpg || !rpg.startedAt) {
    return 'RPG: **미시작** (`/rpg 시작`)';
  }

  const classConfig = getRpgClassConfig(rpg.characterClass);
  const genderConfig = getRpgGenderConfig(rpg.characterGender);
  const advancedClassConfig = rpg.advancedClass
    ? getRpgAdvancedClassConfig(rpg.advancedClass)
    : null;
  const areaConfig = getRpgAreaConfig(rpg.currentArea);
  const derivedStats = getRpgDerivedStats({
    level: profile.level,
    characterClass: rpg.characterClass,
    equipment: rpg.equipment,
    advancedClass: rpg.advancedClass,
    learnedSkills: rpg.learnedSkills,
    gearInventory: rpg.gearInventory,
    equippedGear: rpg.equippedGear
  });
  const powerScore = calculateProfileRpgPowerScore(derivedStats);
  const wins = normalizeProfileCount(rpg.wins);
  const losses = normalizeProfileCount(rpg.losses);
  const advancedText = advancedClassConfig
    ? ` → ${advancedClassConfig.label}`
    : '';

  return [
    `RPG: **${genderConfig.label} ${classConfig.label}${advancedText}**`,
    `전투력 **${powerScore.toLocaleString()}**`,
    `HP/MP **${normalizeProfileCount(rpg.hp)}/${derivedStats.maxHp} · ${normalizeProfileCount(rpg.mp)}/${derivedStats.maxMp}**`,
    `지역 **${areaConfig.label}**`,
    `전적 **${wins}승 ${losses}패**`
  ].join(' / ');
}

function formatSwordProfileSummary(profile) {
  const sword = profile.sword ?? {};
  const level = normalizeProfileCount(sword.level);
  const highestLevel = normalizeProfileCount(sword.highestLevel);
  const battleWins = normalizeProfileCount(sword.battleWins);
  const battleLosses = normalizeProfileCount(sword.battleLosses);

  return [
    `검: **${getSwordAssetLabel(level)}**`,
    `최고 **+${highestLevel}강**`,
    `제련석 **${normalizeProfileCount(sword.refineStones).toLocaleString()}개**`,
    `보호권 **${normalizeProfileCount(sword.protectionScrolls).toLocaleString()}개**`,
    `배틀 **${battleWins}승 ${battleLosses}패**`
  ].join(' / ');
}

function formatCommunityProfileSummary(profile) {
  const title = profile.community?.equippedTitle;
  const titleText = title
    ? formatCommunityTitleName(title)
    : '없음';
  const badgeIds = Array.isArray(profile.community?.cosmetics?.badges)
    ? profile.community.cosmetics.badges
    : [];
  const ownedTitles = Array.isArray(profile.community?.ownedTitles)
    ? profile.community.ownedTitles
    : [];
  const missionCount = normalizeProfileCount(profile.community?.stats?.missionsCompleted);

  return [
    `커뮤니티: 칭호 **${titleText}**`,
    `꾸미기 배지 **${badgeIds.length}개**`,
    `보유 칭호 **${ownedTitles.length}개**`,
    `완료 미션 **${missionCount.toLocaleString()}개**`
  ].join(' / ');
}

function formatStockProfileSummary({ stockPortfolio, stockError } = {}) {
  if (stockError) {
    return `주식: **조회 실패** (${stockError.message})`;
  }
  if (!stockPortfolio) {
    return '주식: **연동 없음**';
  }

  return [
    `주식: 총자산 **${normalizeProfileCount(stockPortfolio.totalAssets).toLocaleString()}골드**`,
    `보유 **${Array.isArray(stockPortfolio.positions) ? stockPortfolio.positions.length : 0}종**`,
    `레버리지 **${Array.isArray(stockPortfolio.leveragedPositions) ? stockPortfolio.leveragedPositions.length : 0}개**`,
    `평가손익 **${formatSignedGold(stockPortfolio.unrealizedProfit)}**`,
    `실현손익 **${formatSignedGold(stockPortfolio.realizedProfit)}**`
  ].join(' / ');
}

function calculateProfileRpgPowerScore(stats) {
  return Math.floor(
    stats.attack * 8
    + stats.defense * 6
    + stats.maxHp / 3
    + stats.maxMp / 2
  );
}

function normalizeProfileCount(value) {
  const normalized = Math.floor(Number(value));
  return Number.isSafeInteger(normalized) && normalized > 0 ? normalized : 0;
}

function formatSignedGold(value) {
  const normalized = Math.floor(Number(value)) || 0;
  const sign = normalized > 0 ? '+' : '';
  return `${sign}${normalized.toLocaleString()}골드`;
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

function formatNextBadgeTarget(level) {
  const nextBadge = getNextProfileLevelBadge(level);
  if (!nextBadge) {
    return '**RADIANT · 무지개 신화 배지까지 모두 도달했습니다!**';
  }

  return `**${nextBadge.badgeText} · ${nextBadge.name}**까지 ${nextBadge.minLevel - level}레벨`;
}

function getEquippedTitleText(profile) {
  const title = profile.community?.equippedTitle;
  if (!title) return '';
  return ` · 칭호 **${formatCommunityTitleName(title)}**`;
}

function formatCommunityTitleName(titleId) {
  const title = getCommunityTitle(titleId);
  if (!title) return titleId;
  return title.label.replace(/^[^\p{L}\p{N}]+/u, '').trim() || title.label;
}

function formatShopBadgeGallery(profile) {
  const badgeIds = Array.isArray(profile.community?.cosmetics?.badges)
    ? profile.community.cosmetics.badges
    : [];
  if (badgeIds.length === 0) return '없음';

  return badgeIds
    .map(formatCommunityBadgeName)
    .join(' / ');
}

function formatCommunityBadgeName(badgeId) {
  const badge = getCommunityCosmeticBadge(badgeId);
  const label = badge?.label ?? badgeId;
  return label.replace(/^[^\p{L}\p{N}]+/u, '').trim() || label;
}

function formatSocialLoanSummary(profile) {
  const requests = Array.isArray(profile.socialLoans?.requests)
    ? profile.socialLoans.requests
    : [];
  const loans = Array.isArray(profile.socialLoans?.loans)
    ? profile.socialLoans.loans
    : [];
  const activeDebt = loans.reduce((sum, loan) => {
    const totalDue = Number(loan.totalDue ?? 0);
    const repaid = Number(loan.repaid ?? 0);
    return sum + Math.max(0, totalDue - repaid);
  }, 0);
  const offered = requests.filter((request) => request.status === 'offered').length;

  if (activeDebt <= 0 && requests.length === 0) return '없음';

  return [
    activeDebt > 0 ? `남은 대출금 **${formatCurrencyAmount(activeDebt, 'main')}**` : null,
    requests.length > 0 ? `대기 요청 **${requests.length.toLocaleString()}건**` : null,
    offered > 0 ? `조건 확인 필요 **${offered.toLocaleString()}건**` : null
  ].filter(Boolean).join(' / ');
}

function formatUserLoanStatus(status, user) {
  const targetLabel = status.target
    ? ` / 대상: ${formatLoanPartyName(status.target.username, status.target.userId)}`
    : '';
  const lines = [
    `💳 **돈빌리기 현황 — ${user.username}${targetLabel}**`,
    formatLoanStatusSection('내가 빌린 진행 중 대출', status.borrowedLoans, formatBorrowedLoanStatusLine),
    formatLoanStatusSection('내가 보낸 대출 요청/제안', status.outgoingRequests, formatOutgoingLoanRequestStatusLine),
    formatLoanStatusSection('내가 빌려준 진행 중 대출', status.lentLoans, formatLentLoanStatusLine),
    formatLoanStatusSection('나에게 온 대출 요청/제안', status.incomingRequests, formatIncomingLoanRequestStatusLine)
  ];
  const content = lines.join('\n\n');
  if (content.length <= 1900) return content;
  return `${content.slice(0, 1850)}\n…일부 항목은 길이 제한으로 생략됐습니다.`;
}

function formatLoanStatusSection(title, items = [], formatter) {
  const safeItems = Array.isArray(items) ? items : [];
  if (safeItems.length === 0) return `**${title}**\n없음`;

  const shown = safeItems.slice(0, 5).map((item, index) => `${index + 1}. ${formatter(item)}`);
  const hiddenCount = safeItems.length - shown.length;
  if (hiddenCount > 0) shown.push(`외 ${hiddenCount.toLocaleString()}건`);

  return `**${title}**\n${shown.join('\n')}`;
}

function formatBorrowedLoanStatusLine(loan) {
  return [
    `상대: ${formatLoanPartyName(loan.lenderUsername, loan.lenderUserId)}`,
    `원금 ${formatCurrencyAmount(loan.principal, 'main')}`,
    `남은 금액 ${formatCurrencyAmount(loan.remaining, 'main')} / 총 상환 ${formatCurrencyAmount(loan.totalDue, 'main')}`,
    formatLoanTerms(loan),
    `만기 ${formatTimestamp(loan.dueAt)} (${loan.overdue ? '연체' : '진행중'})`
  ].join(' / ');
}

function formatLentLoanStatusLine(loan) {
  return [
    `빌린 유저: ${formatLoanPartyName(loan.borrowerUsername, loan.borrowerUserId)}`,
    `원금 ${formatCurrencyAmount(loan.principal, 'main')}`,
    `남은 금액 ${formatCurrencyAmount(loan.remaining, 'main')} / 총 상환 ${formatCurrencyAmount(loan.totalDue, 'main')}`,
    formatLoanTerms(loan),
    `만기 ${formatTimestamp(loan.dueAt)} (${loan.overdue ? '연체' : '진행중'})`
  ].join(' / ');
}

function formatOutgoingLoanRequestStatusLine(request) {
  const state = request.status === 'offered' ? '내 결정 필요' : '상대 조건 대기';
  return formatLoanRequestStatusLine({
    request,
    partyLabel: '상대',
    partyUsername: request.lenderUsername,
    partyUserId: request.lenderUserId,
    state
  });
}

function formatIncomingLoanRequestStatusLine(request) {
  const state = request.status === 'offered' ? '상대 결정 대기' : '내 조건 제시 필요';
  return formatLoanRequestStatusLine({
    request,
    partyLabel: '요청 유저',
    partyUsername: request.borrowerUsername,
    partyUserId: request.borrowerUserId,
    state
  });
}

function formatLoanRequestStatusLine({
  request,
  partyLabel,
  partyUsername,
  partyUserId,
  state
}) {
  return [
    `${partyLabel}: ${formatLoanPartyName(partyUsername, partyUserId)}`,
    `상태: ${state}`,
    `요청 ${formatCurrencyAmount(request.amount, 'main')}`,
    request.totalDue > request.amount ? `상환 예정 ${formatCurrencyAmount(request.totalDue, 'main')}` : null,
    `기간 ${formatDuration(request.termMs)}`,
    request.status === 'offered' ? formatLoanTerms(request) : null,
    `상환 ${formatLoanRepaymentMode(request.repaymentMode)}`
  ].filter(Boolean).join(' / ');
}

function formatLoanTerms(value) {
  return [
    `이자 ${formatLoanInterestRate(value.interestBps)} ${formatLoanInterestType(value.interestType)}`,
    `이자 주기 ${formatDuration(value.interestPeriodMs)}`
  ].join(' / ');
}

function formatLoanPartyName(username, userId) {
  return String(username ?? userId ?? '알 수 없는 유저').trim() || '알 수 없는 유저';
}

function formatLoanRepaymentMode(mode) {
  return mode === 'installment'
    ? '매번 조금씩 갚기'
    : '한번에 갚기';
}

function formatLoanInterestType(type) {
  return type === 'compound' ? '복리' : '단리';
}

function formatLoanInterestRate(interestBps) {
  const rate = Number(interestBps ?? 0) / 100;
  return `${Number.isInteger(rate) ? rate.toLocaleString() : rate.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}

async function sendLoanRequestNotification({ interaction, target, requester, request }) {
  if (!target || typeof target.send !== 'function') return false;

  try {
    await target.send({
      content: [
        `📨 **${requester.username}**님이 ${interaction.guild?.name ?? '서버'}에서 돈을 빌려달라고 요청했습니다.`,
        `요청 금액: **${formatCurrencyAmount(request.amount, 'main')}**`,
        `조건: **${formatLoanInterestRate(request.interestBps)} ${formatLoanInterestType(request.interestType)}** / 기간: **${formatDuration(request.termMs)}** / 이자 주기: **${formatDuration(request.interestPeriodMs)}**`,
        `승인하려면 서버에서 \`/돈빌려주기 대상:${requester.username}\`을 실행해 주세요.`
      ].join('\n'),
      allowedMentions: createAllowedMentionsForUsers([requester.id])
    });
    return true;
  } catch {
    return false;
  }
}

function formatTimestamp(ms) {
  const seconds = Math.floor(Number(ms ?? 0) / 1000);
  return seconds > 0 ? `<t:${seconds}:F>` : '알 수 없음';
}

function formatCurrencyInfo() {
  return [
    '💱 **재화정보 / 통합 골드**',
    '모든 재화는 봇 내부 게임머니이며 실제 현금 결제, 실제 현금 환전, 실제 투자와 연결되지 않습니다.',
    '',
    '📌 **현재 기준**',
    '- 단일 화폐: **골드**',
    '- 카지노, RPG, 검강화, 낚시강화, 광산 채굴/강화/판매, 가상주식, 커뮤니티 상점/복권/송금이 모두 같은 골드 잔액을 사용합니다.',
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
