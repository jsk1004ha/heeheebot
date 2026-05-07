import { SlashCommandBuilder } from 'discord.js';

export const fortuneCommands = [
  new SlashCommandBuilder()
    .setName('운세')
    .setDescription('오늘, 어제, 내일의 운세를 확인합니다. 같은 유저의 같은 날짜 운세는 항상 같습니다.')
    .addStringOption((option) =>
      option
        .setName('날짜')
        .setDescription('확인할 운세')
        .addChoices(
          { name: '오늘운세', value: 'today' },
          { name: '어제운세', value: 'yesterday' },
          { name: '내일운세', value: 'tomorrow' }
        )
    )
    .addUserOption((option) =>
      option
        .setName('대상')
        .setDescription('운세를 확인할 유저. 비우면 내 운세를 봅니다.')
    )
];

export function getFortuneCommandPayloads() {
  return fortuneCommands.map((command) => command.toJSON());
}

export async function handleFortuneCommand(interaction, fortune, economy) {
  if (!interaction.isChatInputCommand() || interaction.commandName !== '운세') {
    return false;
  }

  if (!interaction.inGuild()) {
    await interaction.reply({
      content: '서버에서만 사용할 수 있는 명령어입니다.',
      ephemeral: true
    });
    return true;
  }

  const target = interaction.options.getUser('대상') ?? interaction.user;
  const date = interaction.options.getString('날짜') ?? 'today';
  const dailyFortune = fortune.getDailyFortune({
    guildId: interaction.guildId,
    userId: target.id,
    username: target.username,
    date
  });
  const xpResult = await economy.claimFortuneXp({
    guildId: interaction.guildId,
    userId: interaction.user.id,
    username: interaction.user.username
  });

  await interaction.reply(formatFortuneResult({
    fortune: dailyFortune,
    target,
    viewer: interaction.user,
    xpResult
  }));
  return true;
}

export function formatFortuneResult({ fortune, target, viewer, xpResult }) {
  const targetText = formatUser(target, fortune.username);
  const lines = [
    `🔮 **${targetText}님의 ${fortune.label}** (${fortune.dateKey})`,
    `운세: **${fortune.kind}**`,
    '',
    fortune.text
  ];

  if (xpResult?.claimed) {
    const levelUpText = xpResult.leveledUp
      ? ` / 🎉 Lv.${xpResult.profile.level} 레벨업! 보너스 ${xpResult.levelReward.toLocaleString()}골드`
      : '';

    lines.push(
      '',
      `✨ ${formatUser(viewer)}님 운세 확인 보너스 +${xpResult.xpGained.toLocaleString()} XP${levelUpText}`
    );
  } else if (xpResult) {
    lines.push(
      '',
      '✨ 오늘 운세 확인 XP는 이미 받았습니다. 운세 결과는 그대로 다시 볼 수 있어요.'
    );
  }

  return lines.join('\n');
}

function formatUser(user, fallbackUsername = 'Unknown') {
  if (user && typeof user.toString === 'function' && user.toString !== Object.prototype.toString) {
    return String(user);
  }

  return fallbackUsername;
}
