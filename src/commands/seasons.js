import { SlashCommandBuilder } from 'discord.js';

export const seasonCommands = [
  new SlashCommandBuilder()
    .setName('시즌')
    .setDescription('희희봇 통합 시즌 포인트와 보상을 확인합니다.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('정보')
        .setDescription('내 시즌 포인트, 일일 상한, 보상 현황을 확인합니다.')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('랭킹')
        .setDescription('서버 시즌 포인트 랭킹을 확인합니다.')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('보상')
        .setDescription('달성한 시즌 보상을 한 번에 수령합니다.')
    )
];

export function getSeasonCommandPayloads() {
  return seasonCommands.map((command) => command.toJSON());
}

export async function handleSeasonCommand(interaction, seasons, logger = console) {
  if (!interaction.isChatInputCommand?.() || interaction.commandName !== '시즌') {
    return false;
  }

  if (!interaction.inGuild()) {
    await interaction.reply({
      content: '서버에서만 사용할 수 있는 명령어입니다.',
      ephemeral: true
    });
    return true;
  }

  try {
    const subcommand = interaction.options.getSubcommand(true);
    const context = {
      guildId: interaction.guildId,
      userId: interaction.user.id,
      username: interaction.user.username
    };

    if (subcommand === '정보') {
      await interaction.reply(formatSeasonOverview(await seasons.getOverview(context)));
      return true;
    }

    if (subcommand === '랭킹') {
      await interaction.reply(formatSeasonLeaderboard(await seasons.getLeaderboard({
        guildId: interaction.guildId,
        limit: 10
      })));
      return true;
    }

    if (subcommand === '보상') {
      await interaction.reply(formatSeasonRewardClaim(await seasons.claimRewards(context)));
      return true;
    }

    await interaction.reply({
      content: '알 수 없는 시즌 명령입니다.',
      ephemeral: true
    });
    return true;
  } catch (error) {
    logger.error(error);
    await interaction.reply({
      content: `시즌 처리 실패: ${error.message}`,
      ephemeral: true
    });
    return true;
  }
}

export function formatSeasonAwardLine(award) {
  if (!award) return null;
  if (!award.awarded) {
    return '🏆 시즌: 오늘 받을 수 있는 시즌 포인트 상한에 도달했습니다.';
  }

  const capText = award.capped ? ` (일일 상한 적용, 요청 ${award.requestedPoints.toLocaleString()}점)` : '';
  const rewardText = award.newlyClaimableRewards?.length > 0
    ? ` · 새 보상 ${award.newlyClaimableRewards.map((reward) => reward.label).join(', ')}`
    : '';
  return `🏆 시즌: ${award.sourceLabel} +${award.points.toLocaleString()}점${capText} · 누적 ${award.totalPoints.toLocaleString()}점${rewardText}`;
}

function formatSeasonOverview(overview) {
  const rewardRows = overview.rewards
    .map((reward) => {
      const marker = reward.claimed ? '✅' : reward.claimable ? '🎁' : reward.unlocked ? '⬜' : '🔒';
      return `- ${marker} **${reward.label}** — ${reward.requiredPoints.toLocaleString()}점 / ${reward.description}`;
    })
    .join('\n');
  const leaderboard = overview.leaderboardPreview.length > 0
    ? overview.leaderboardPreview.map((row) => `${row.rank}. ${row.username} ${row.points.toLocaleString()}점`).join('\n')
    : '아직 시즌 포인트를 모은 유저가 없습니다.';

  return [
    `🏆 **${overview.season.name}**`,
    overview.season.description,
    '',
    `내 점수: **${overview.profile.totalPoints.toLocaleString()}점**`,
    `오늘 획득: **${overview.daily.earned.toLocaleString()} / ${overview.daily.cap.toLocaleString()}점** · 남은 ${overview.daily.remaining.toLocaleString()}점`,
    '',
    '🎁 **시즌 보상**',
    rewardRows,
    '',
    '🏅 **상위 랭킹 미리보기**',
    leaderboard,
    '',
    '`/시즌 보상`으로 달성한 보상을 받을 수 있습니다.'
  ].join('\n');
}

function formatSeasonLeaderboard(rows) {
  const body = rows.length > 0
    ? rows.map((row) => `${row.rank}. **${row.username}** — ${row.points.toLocaleString()}점 · 보상 ${row.claimedRewardCount}개`).join('\n')
    : '아직 시즌 랭킹 데이터가 없습니다. RPG 전투나 검배틀로 포인트를 모아보세요.';

  return `🏆 **희희봇 시즌 랭킹**\n${body}`;
}

function formatSeasonRewardClaim(result) {
  if (result.claimed.length <= 0) {
    return [
      `🎁 **시즌 보상**`,
      '지금 수령 가능한 시즌 보상이 없습니다.',
      `현재 점수: **${result.profile.totalPoints.toLocaleString()}점**`,
      'RPG 전투, 검강화, 검배틀로 시즌 포인트를 더 모아보세요.'
    ].join('\n');
  }

  return [
    `🎁 **시즌 보상 수령**`,
    `수령 보상: ${result.claimed.map((reward) => `**${reward.label}**`).join(', ')}`,
    `현재 점수: **${result.profile.totalPoints.toLocaleString()}점**`,
    '보상은 시즌 기록에 영구 저장됩니다.'
  ].join('\n');
}
