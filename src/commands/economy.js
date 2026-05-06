import { SlashCommandBuilder } from 'discord.js';

export const economyCommands = [
  new SlashCommandBuilder()
    .setName('프로필')
    .setDescription('내 레벨, 경험치, 보유금을 확인합니다.'),
  new SlashCommandBuilder()
    .setName('출석')
    .setDescription('하루 한 번 출석 보상금을 받습니다.'),
  new SlashCommandBuilder()
    .setName('송금')
    .setDescription('다른 유저에게 돈을 송금합니다.')
    .addUserOption((option) =>
      option
        .setName('대상')
        .setDescription('돈을 받을 유저')
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('금액')
        .setDescription('송금할 금액')
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
      `✅ 출석 완료! +${result.xpGained.toLocaleString()} XP${bonusText}, +${result.reward.toLocaleString()}원 지급${levelText}${streakText}. 현재 잔액: ${result.profile.balance.toLocaleString()}원`
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
        `💸 ${target}님에게 ${result.amount.toLocaleString()}원을 송금했습니다. 내 잔액: ${result.from.balance.toLocaleString()}원`
      );
    } catch (error) {
      await interaction.reply({
        content: `송금 실패: ${error.message}`,
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
  return [
    `📌 **${profile.username}님의 프로필**`,
    `레벨: **${profile.level}**`,
    `경험치: **${profile.totalXp.toLocaleString()} XP**`,
    `연속 출석: **${profile.dailyStreak.toLocaleString()}일**`,
    `보유금: **${profile.balance.toLocaleString()}원**`
  ].join('\n');
}

function formatLeaderboard(rows) {
  const body = rows
    .map((profile, index) => {
      const rank = index + 1;
      return `${rank}. **${profile.username}** — Lv.${profile.level} / 경험치 ${profile.totalXp.toLocaleString()} XP / ${profile.balance.toLocaleString()}원`;
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
