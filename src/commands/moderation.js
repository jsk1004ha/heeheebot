import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder
} from 'discord.js';
import {
  formatAction,
  formatDurationMs,
  parseDuration
} from '../systems/moderation.js';

export const moderationCommands = [
  new SlashCommandBuilder()
    .setName('청소')
    .setDescription('최근 메시지를 삭제합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((option) =>
      option
        .setName('개수')
        .setDescription('삭제할 메시지 수')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('경고')
    .setDescription('유저에게 경고를 부여합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) =>
      option
        .setName('유저')
        .setDescription('경고할 유저')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('사유')
        .setDescription('경고 사유')
        .setMaxLength(500)
    ),
  new SlashCommandBuilder()
    .setName('경고확인')
    .setDescription('유저의 경고 내역을 확인합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) =>
      option
        .setName('유저')
        .setDescription('확인할 유저')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('경고삭제')
    .setDescription('유저의 경고를 모두 삭제합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) =>
      option
        .setName('유저')
        .setDescription('경고를 삭제할 유저')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('뮤트')
    .setDescription('유저를 지정 시간 동안 타임아웃합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) =>
      option
        .setName('유저')
        .setDescription('뮤트할 유저')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('시간')
        .setDescription('예: 10분, 1시간, 2일')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('사유')
        .setDescription('뮤트 사유')
        .setMaxLength(500)
    ),
  new SlashCommandBuilder()
    .setName('언뮤트')
    .setDescription('유저의 타임아웃을 해제합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) =>
      option
        .setName('유저')
        .setDescription('언뮤트할 유저')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('슬로우모드풀기')
    .setDescription('자동 도배로 적용된 유저 슬로우모드를 해제합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) =>
      option
        .setName('유저')
        .setDescription('슬로우모드를 해제할 유저')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('킥')
    .setDescription('유저를 서버에서 추방합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((option) =>
      option
        .setName('유저')
        .setDescription('킥할 유저')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('사유')
        .setDescription('킥 사유')
        .setMaxLength(500)
    ),
  new SlashCommandBuilder()
    .setName('밴')
    .setDescription('유저를 서버에서 차단합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((option) =>
      option
        .setName('유저')
        .setDescription('밴할 유저')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('사유')
        .setDescription('밴 사유')
        .setMaxLength(500)
    ),
  new SlashCommandBuilder()
    .setName('언밴')
    .setDescription('유저 ID로 밴을 해제합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption((option) =>
      option
        .setName('유저id')
        .setDescription('언밴할 유저 ID')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('관리설정')
    .setDescription('관리 로그, 금칙어, 경고 누적 처벌을 설정합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('로그채널')
        .setDescription('관리 로그를 보낼 채널을 설정합니다.')
        .addChannelOption((option) =>
          option
            .setName('채널')
            .setDescription('로그 채널')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('금칙어추가')
        .setDescription('금칙어를 추가합니다.')
        .addStringOption((option) =>
          option
            .setName('단어')
            .setDescription('추가할 금칙어')
            .setMaxLength(100)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('경고누적처벌')
        .setDescription('경고가 누적되면 자동 처벌하도록 설정합니다.')
        .addIntegerOption((option) =>
          option
            .setName('횟수')
            .setDescription('처벌 기준 경고 횟수')
            .setMinValue(1)
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('처벌')
            .setDescription('뮤트, 킥, 밴 중 선택')
            .setRequired(true)
            .addChoices(
              { name: '뮤트', value: 'mute' },
              { name: '킥', value: 'kick' },
              { name: '밴', value: 'ban' }
            )
        )
        .addStringOption((option) =>
          option
            .setName('시간')
            .setDescription('뮤트일 때만 필요합니다. 예: 10분, 1시간')
        )
    )
];

export function getModerationCommandPayloads() {
  return moderationCommands.map((command) => command.toJSON());
}

export async function handleModerationCommand(interaction, moderation, logger = console) {
  if (!interaction.isChatInputCommand()) return false;

  if (!isModerationCommand(interaction.commandName)) return false;

  if (!interaction.inGuild()) {
    await interaction.reply({
      content: '서버에서만 사용할 수 있는 명령어입니다.',
      ephemeral: true
    });
    return true;
  }

  try {
    await routeModerationCommand(interaction, moderation, logger);
  } catch (error) {
    logger.error(error);
    await safeReply(interaction, `처리 실패: ${error.message}`, true);
  }

  return true;
}

export async function inspectMessageForModeration(message, moderation, logger = console) {
  if (!message.inGuild() || message.author.bot) return { blocked: false };

  const spamResult = await moderation.recordMessageAndDetectSpam({
    guildId: message.guild.id,
    userId: message.author.id,
    username: message.author.username,
    content: message.content
  });

  if (spamResult.detected) {
    if (message.deletable) {
      await message.delete().catch((error) => logger.error('Failed to delete spam message:', error));
    }

    const punishmentResult = await applyPunishment(
      message.guild,
      message.author.id,
      spamResult.punishment,
      spamResult.reason,
      logger
    );
    await sendModerationLog(
      message.guild,
      moderation,
      `🚨 자동 도배 대응: ${message.author} / 조치: ${punishmentResult} / 적발 ${spamResult.offenseCount}회 / 사유: ${spamResult.reason}`
    );

    return {
      blocked: true,
      spam: true,
      reason: spamResult.reason
    };
  }

  const bannedWord = await moderation.findBannedWord(message.guild.id, message.content);
  if (!bannedWord) return { blocked: false };

  const reason = `금칙어 사용: ${bannedWord}`;
  const result = await moderation.addWarning({
    guildId: message.guild.id,
    userId: message.author.id,
    username: message.author.username,
    moderatorId: message.client.user.id,
    reason
  });

  if (message.deletable) {
    await message.delete().catch((error) => logger.error('Failed to delete banned word message:', error));
  }

  if (result.punishment) {
    await applyPunishment(message.guild, message.author.id, result.punishment, reason, logger);
  }

  await sendModerationLog(
    message.guild,
    moderation,
    `🚫 금칙어 감지: ${message.author} / 단어: **${bannedWord}** / 경고 ${result.count}회`
  );

  return {
    blocked: true,
    bannedWord,
    warningCount: result.count
  };
}

async function routeModerationCommand(interaction, moderation, logger) {
  const commandName = interaction.commandName;

  if (commandName === '청소') {
    const count = interaction.options.getInteger('개수', true);
    const deleted = await interaction.channel.bulkDelete(count, true);
    await safeReply(interaction, `🧹 메시지 ${deleted.size}개를 삭제했습니다.`, true);
    await sendModerationLog(interaction.guild, moderation, `🧹 ${interaction.user}님이 <#${interaction.channelId}>에서 메시지 ${deleted.size}개를 삭제했습니다.`);
    return;
  }

  if (commandName === '경고') {
    const target = interaction.options.getUser('유저', true);
    const reason = interaction.options.getString('사유') ?? '사유 없음';
    assertNotBotTarget(target);

    const result = await moderation.addWarning({
      guildId: interaction.guildId,
      userId: target.id,
      username: target.username,
      moderatorId: interaction.user.id,
      reason
    });

    let punishmentText = '';
    if (result.punishment) {
      const punishmentResult = await applyPunishment(interaction.guild, target.id, result.punishment, reason, logger);
      punishmentText = `\n자동 처벌: ${punishmentResult}`;
    }

    await interaction.reply(`⚠️ ${target}님에게 경고를 부여했습니다. 현재 경고: ${result.count}회${punishmentText}`);
    await sendModerationLog(interaction.guild, moderation, `⚠️ 경고: ${target} / 관리자: ${interaction.user} / 사유: ${reason} / 누적 ${result.count}회${punishmentText}`);
    return;
  }

  if (commandName === '경고확인') {
    const target = interaction.options.getUser('유저', true);
    const warnings = await moderation.getWarnings(interaction.guildId, target.id);

    if (warnings.length === 0) {
      await safeReply(interaction, `${target}님의 경고 내역이 없습니다.`, true);
      return;
    }

    const body = warnings
      .slice(-10)
      .map((warning, index) => `${index + 1}. ${warning.reason} — <@${warning.moderatorId}>`)
      .join('\n');

    await safeReply(interaction, `⚠️ ${target}님의 경고 ${warnings.length}회\n${body}`, true);
    return;
  }

  if (commandName === '경고삭제') {
    const target = interaction.options.getUser('유저', true);
    const result = await moderation.clearWarnings(interaction.guildId, target.id);
    await interaction.reply(`✅ ${target}님의 경고 ${result.removed}개를 삭제했습니다.`);
    await sendModerationLog(interaction.guild, moderation, `✅ 경고삭제: ${target} / 관리자: ${interaction.user} / 삭제 ${result.removed}개`);
    return;
  }

  if (commandName === '뮤트') {
    const target = interaction.options.getUser('유저', true);
    const durationMs = parseDuration(interaction.options.getString('시간', true));
    const reason = interaction.options.getString('사유') ?? '사유 없음';
    assertNotBotTarget(target);

    await timeoutMember(interaction.guild, target.id, durationMs, reason);
    await interaction.reply(`🔇 ${target}님을 ${formatDurationMs(durationMs)} 동안 뮤트했습니다.`);
    await sendModerationLog(interaction.guild, moderation, `🔇 뮤트: ${target} / 관리자: ${interaction.user} / 시간: ${formatDurationMs(durationMs)} / 사유: ${reason}`);
    return;
  }

  if (commandName === '언뮤트') {
    const target = interaction.options.getUser('유저', true);
    await timeoutMember(interaction.guild, target.id, null, '언뮤트');
    await interaction.reply(`🔈 ${target}님의 뮤트를 해제했습니다.`);
    await sendModerationLog(interaction.guild, moderation, `🔈 언뮤트: ${target} / 관리자: ${interaction.user}`);
    return;
  }

  if (commandName === '슬로우모드풀기') {
    const target = interaction.options.getUser('유저', true);
    await timeoutMember(interaction.guild, target.id, null, '유저 슬로우모드 해제');
    await interaction.reply(`✅ ${target}님의 유저 슬로우모드를 해제했습니다.`);
    await sendModerationLog(interaction.guild, moderation, `✅ 유저 슬로우모드 해제: ${target} / 관리자: ${interaction.user}`);
    return;
  }

  if (commandName === '킥') {
    const target = interaction.options.getUser('유저', true);
    const reason = interaction.options.getString('사유') ?? '사유 없음';
    assertNotBotTarget(target);

    const member = await interaction.guild.members.fetch(target.id);
    await member.kick(reason);
    await interaction.reply(`👢 ${target}님을 킥했습니다.`);
    await sendModerationLog(interaction.guild, moderation, `👢 킥: ${target} / 관리자: ${interaction.user} / 사유: ${reason}`);
    return;
  }

  if (commandName === '밴') {
    const target = interaction.options.getUser('유저', true);
    const reason = interaction.options.getString('사유') ?? '사유 없음';
    assertNotBotTarget(target);

    await interaction.guild.members.ban(target.id, { reason });
    await interaction.reply(`🔨 ${target}님을 밴했습니다.`);
    await sendModerationLog(interaction.guild, moderation, `🔨 밴: ${target} / 관리자: ${interaction.user} / 사유: ${reason}`);
    return;
  }

  if (commandName === '언밴') {
    const userId = interaction.options.getString('유저id', true);
    await interaction.guild.members.unban(userId);
    await interaction.reply(`✅ ${formatUserIdMention(userId)} 유저의 밴을 해제했습니다.`);
    await sendModerationLog(interaction.guild, moderation, `✅ 언밴: ${formatUserIdMention(userId)} / 관리자: ${interaction.user}`);
    return;
  }

  if (commandName === '관리설정') {
    await handleModerationSettings(interaction, moderation);
  }
}

async function handleModerationSettings(interaction, moderation) {
  const subcommand = interaction.options.getSubcommand(true);

  if (subcommand === '로그채널') {
    const channel = interaction.options.getChannel('채널', true);
    await moderation.setLogChannel(interaction.guildId, channel.id);
    await interaction.reply(`✅ 관리 로그 채널을 ${channel}로 설정했습니다.`);
    await sendModerationLog(interaction.guild, moderation, `✅ 관리 로그 채널 설정: ${channel} / 관리자: ${interaction.user}`);
    return;
  }

  if (subcommand === '금칙어추가') {
    const word = interaction.options.getString('단어', true);
    const settings = await moderation.addBannedWord(interaction.guildId, word);
    await interaction.reply(`✅ 금칙어를 추가했습니다. 현재 ${settings.bannedWords.length}개`);
    await sendModerationLog(interaction.guild, moderation, `🚫 금칙어 추가: **${word}** / 관리자: ${interaction.user}`);
    return;
  }

  if (subcommand === '경고누적처벌') {
    const threshold = interaction.options.getInteger('횟수', true);
    const action = interaction.options.getString('처벌', true);
    const durationInput = interaction.options.getString('시간');
    const durationMs = action === 'mute'
      ? parseDuration(durationInput ?? '')
      : null;

    await moderation.setWarningPunishment(interaction.guildId, threshold, action, durationMs);

    const durationText = durationMs ? ` ${formatDurationMs(durationMs)}` : '';
    await interaction.reply(`✅ 경고 ${threshold}회마다 ${formatAction(action)}${durationText} 처벌하도록 설정했습니다.`);
    await sendModerationLog(interaction.guild, moderation, `✅ 경고 누적 처벌 설정: ${threshold}회 → ${formatAction(action)}${durationText} / 관리자: ${interaction.user}`);
  }
}

async function applyPunishment(guild, userId, punishment, reason, logger) {
  try {
    if (punishment.action === 'slowmode') {
      if (!Number.isSafeInteger(punishment.durationMs) || punishment.durationMs < 1) {
        throw new Error('유저 슬로우모드 시간이 올바르지 않습니다.');
      }

      await timeoutMember(guild, userId, punishment.durationMs, reason);
      return `${formatDurationMs(punishment.durationMs)} 유저 슬로우모드`;
    }

    if (punishment.action === 'mute') {
      await timeoutMember(guild, userId, punishment.durationMs, reason);
      return `${formatDurationMs(punishment.durationMs)} 뮤트`;
    }

    if (punishment.action === 'kick') {
      const member = await guild.members.fetch(userId);
      await member.kick(reason);
      return '킥';
    }

    if (punishment.action === 'ban') {
      await guild.members.ban(userId, { reason });
      return '밴';
    }
  } catch (error) {
    logger.error('Failed to apply moderation punishment:', error);
    return `처벌 실패(${error.message})`;
  }

  return '처벌 없음';
}

async function timeoutMember(guild, userId, durationMs, reason) {
  const member = await guild.members.fetch(userId);
  await member.timeout(durationMs, reason);
}

async function sendModerationLog(guild, moderation, content) {
  const settings = await moderation.getSettings(guild.id);
  if (!settings.logChannelId) return;

  const channel = guild.channels.cache.get(settings.logChannelId)
    ?? await guild.channels.fetch(settings.logChannelId).catch(() => null);

  if (channel?.isTextBased()) {
    await channel.send(content).catch(() => {});
  }
}

async function safeReply(interaction, content, ephemeral = false) {
  const payload = { content, ephemeral };

  if (interaction.deferred || interaction.replied) {
    await interaction.followUp(payload);
  } else {
    await interaction.reply(payload);
  }
}

function assertNotBotTarget(user) {
  if (user.bot) {
    throw new Error('봇은 관리 명령어 대상으로 지정할 수 없습니다.');
  }
}

function formatUserIdMention(userId) {
  return `<@${String(userId).trim()}>`;
}

function isModerationCommand(commandName) {
  return moderationCommands.some((command) => command.name === commandName);
}
