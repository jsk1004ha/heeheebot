import { SlashCommandBuilder } from 'discord.js';
import {
  formatCurrencyAmount,
  getCurrencyChoices
} from '../systems/currencies.js';

export const economyCommands = [
  new SlashCommandBuilder()
    .setName('프로필')
    .setDescription('내 레벨, 경험치, 메인 코인과 전용 지갑을 확인합니다.'),
  new SlashCommandBuilder()
    .setName('출석')
    .setDescription('하루 한 번 출석 메인 코인 보상을 받습니다.'),
  new SlashCommandBuilder()
    .setName('송금')
    .setDescription('다른 유저에게 메인 코인을 송금합니다.')
    .addUserOption((option) =>
      option
        .setName('대상')
        .setDescription('메인 코인을 받을 유저')
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('금액')
        .setDescription('송금할 메인 코인 금액')
        .setMinValue(1)
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('환전')
    .setDescription('메인 코인과 컨텐츠별 전용 재화를 환전합니다.')
    .addStringOption((option) =>
      option
        .setName('보낼재화')
        .setDescription('차감할 재화')
        .setRequired(true)
        .addChoices(...getCurrencyChoices())
    )
    .addStringOption((option) =>
      option
        .setName('받을재화')
        .setDescription('받을 재화')
        .setRequired(true)
        .addChoices(...getCurrencyChoices())
    )
    .addIntegerOption((option) =>
      option
        .setName('금액')
        .setDescription('보낼 재화 기준 환전 금액')
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
    )
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
    await interaction.reply(formatProfile(profile));
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
      ? ` / 레벨업 Lv.${result.profile.level} 보너스 +${result.levelReward.toLocaleString()}원`
      : '';

    await interaction.reply(
      `✅ 출석 완료! +${result.xpGained.toLocaleString()} XP${bonusText}, +${result.reward.toLocaleString()}원 지급${levelText}${streakText}. 메인 코인: ${result.profile.balance.toLocaleString()}원`
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
        `💸 ${target}님에게 ${result.amount.toLocaleString()}원을 송금했습니다. 내 메인 코인: ${result.from.balance.toLocaleString()}원`
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
        content: `환전 실패: ${error.message}`,
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

  return false;
}

function formatProfile(profile) {
  const wallets = profile.wallets ?? {};
  return [
    `📌 **${profile.username}님의 프로필**`,
    `레벨: **${profile.level}**`,
    `경험치: **${profile.totalXp.toLocaleString()} XP**`,
    `연속 출석: **${profile.dailyStreak.toLocaleString()}일**`,
    `메인 코인: **${profile.balance.toLocaleString()}원**`,
    `전용 지갑: 카지노칩 **${(wallets.casinoChips ?? 0).toLocaleString()}칩** / RPG 골드 **${(wallets.rpgGold ?? 0).toLocaleString()}골드** / 강화 코인 **${(wallets.swordCoins ?? 0).toLocaleString()}코인** / 현금 **${(wallets.stockCash ?? 0).toLocaleString()}원**`
  ].join('\n');
}

function formatExchangeResult(result) {
  const feeText = result.fee > 0
    ? ` / 환전 손실: **${result.fee.toLocaleString()}원 상당**`
    : '';

  return [
    '🔁 **환전 완료**',
    `${result.from.label} ${formatCurrencyAmount(result.spent, result.from.id)} → ${result.to.label} ${formatCurrencyAmount(result.received, result.to.id)}${feeText}`,
    `현재 지갑: 메인 **${result.profile.balance.toLocaleString()}원** / 카지노 **${result.profile.wallets.casinoChips.toLocaleString()}칩** / RPG **${result.profile.wallets.rpgGold.toLocaleString()}골드** / 검강화 **${result.profile.wallets.swordCoins.toLocaleString()}코인** / 주식 현금 **${result.profile.wallets.stockCash.toLocaleString()}원**`
  ].join('\n');
}

function formatLeaderboard(rows) {
  const body = rows
    .map((profile, index) => {
      const rank = index + 1;
      return `${rank}. **${profile.username}** — Lv.${profile.level} / 경험치 ${profile.totalXp.toLocaleString()} XP / 메인 ${profile.balance.toLocaleString()}원`;
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
