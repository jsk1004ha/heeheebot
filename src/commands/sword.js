import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder
} from 'discord.js';
import {
  getSwordAssetAttachment,
  getSwordAssetLabel,
  getSwordAssetName
} from '../systems/sword-assets.js';
import { formatDuration } from './economy.js';

const CHALLENGE_TTL_MS = 60_000;
const pendingSwordBattleChallenges = new Map();

export const swordCommands = [
  new SlashCommandBuilder()
    .setName('검강화')
    .setDescription('돈을 사용해 내 검을 강화합니다. 최대 +100강까지 가능합니다.'),
  new SlashCommandBuilder()
    .setName('검상급강화')
    .setDescription('제련석을 사용해 파괴 없이 검을 강화합니다. +90 이하에서만 가능합니다.'),
  new SlashCommandBuilder()
    .setName('검배틀')
    .setDescription('검으로 랜덤 상대 또는 다른 유저와 배틀합니다. 하루 10회 제한입니다.')
    .addUserOption((option) =>
      option
        .setName('상대')
        .setDescription('비우면 랜덤 검배틀을 진행합니다.')
    ),
  new SlashCommandBuilder()
    .setName('선물받기')
    .setDescription('하루 한 번 검 상급강화에 필요한 제련석을 받습니다.')
];

export function getSwordCommandPayloads() {
  return swordCommands.map((command) => command.toJSON());
}

export async function handleSwordCommand(interaction, economy, logger = console) {
  if (interaction.isButton()) {
    return handleSwordBattleButton(interaction, economy, logger);
  }

  if (!interaction.isChatInputCommand() || !isSwordCommand(interaction.commandName)) {
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
    await routeSwordCommand(interaction, economy);
  } catch (error) {
    logger.error(error);
    await safeReply(interaction, `검 시스템 처리 실패: ${error.message}`, true);
  }

  return true;
}

async function routeSwordCommand(interaction, economy) {
  const guildId = interaction.guildId;
  const user = interaction.user;

  if (interaction.commandName === '검강화') {
    const result = await economy.enhanceSword({
      guildId,
      userId: user.id,
      username: user.username
    });
    await interaction.reply(createSwordReplyPayload(
      formatSwordEnhancement(user, result),
      getSwordEnhancementImageLevel(result),
      getSwordEnhancementImageTitle(result)
    ));
    return;
  }

  if (interaction.commandName === '검상급강화') {
    const result = await economy.advancedEnhanceSword({
      guildId,
      userId: user.id,
      username: user.username
    });
    await interaction.reply(createSwordReplyPayload(
      formatSwordEnhancement(user, result),
      getSwordEnhancementImageLevel(result),
      getSwordEnhancementImageTitle(result)
    ));
    return;
  }

  if (interaction.commandName === '선물받기') {
    const result = await economy.claimSwordGift({
      guildId,
      userId: user.id,
      username: user.username
    });

    if (!result.claimed) {
      await interaction.reply({
        content: `🎁 오늘의 제련석 선물은 이미 받았습니다. 남은 시간: ${formatDuration(result.remainingMs)}`,
        ephemeral: true
      });
      return;
    }

    await interaction.reply(createSwordReplyPayload(
      formatSwordGift(user, result),
      result.profile.sword.level,
      `현재 검 — ${getSwordAssetLabel(result.profile.sword.level)}`
    ));
    return;
  }

  if (interaction.commandName === '검배틀') {
    const target = interaction.options.getUser('상대');

    if (!target) {
      const result = await economy.playSwordRandomBattle({
        guildId,
        userId: user.id,
        username: user.username
      });

      if (!result.battled) {
        await interaction.reply({
          content: '오늘의 검배틀 10회를 모두 사용했습니다. 내일 다시 도전하세요.',
          ephemeral: true
        });
        return;
      }

      await interaction.reply(createSwordReplyPayload(
        formatRandomSwordBattle(user, result),
        result.profile.sword.level,
        `내 검 — ${getSwordAssetLabel(result.profile.sword.level)}`
      ));
      return;
    }

    assertValidSwordBattleTarget(user, target);
    await createSwordBattleChallenge(interaction, target);
  }
}

async function createSwordBattleChallenge(interaction, target) {
  const challengeId = createChallengeId();
  const challenge = {
    id: challengeId,
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    challenger: {
      userId: interaction.user.id,
      username: interaction.user.username,
      mention: `${interaction.user}`
    },
    opponent: {
      userId: target.id,
      username: target.username,
      mention: `${target}`
    },
    createdAt: Date.now()
  };

  pendingSwordBattleChallenges.set(challengeId, challenge);

  await interaction.reply({
    content: [
      `⚔️ ${target}, ${interaction.user}님이 검배틀을 신청했습니다!`,
      `60초 안에 수락하면 하루 검배틀 횟수 1회를 사용하고 즉시 전투합니다.`,
      `패배해도 돈은 잃지 않습니다.`
    ].join('\n'),
    components: [createSwordBattleChallengeRow(challengeId)]
  });
}

async function handleSwordBattleButton(interaction, economy, logger) {
  if (!interaction.customId.startsWith('sword_battle_')) return false;

  const [action, challengeId] = interaction.customId.split(':');
  const challenge = pendingSwordBattleChallenges.get(challengeId);

  if (!challenge || Date.now() - challenge.createdAt > CHALLENGE_TTL_MS) {
    pendingSwordBattleChallenges.delete(challengeId);
    await interaction.reply({
      content: '이미 만료되었거나 처리된 검배틀입니다.',
      ephemeral: true
    });
    return true;
  }

  if (interaction.user.id !== challenge.opponent.userId) {
    await interaction.reply({
      content: '검배틀을 신청받은 유저만 누를 수 있습니다.',
      ephemeral: true
    });
    return true;
  }

  if (action === 'sword_battle_decline') {
    pendingSwordBattleChallenges.delete(challengeId);
    await interaction.update({
      content: `🛡️ ${challenge.opponent.mention}님이 검배틀을 거절했습니다.`,
      components: []
    });
    return true;
  }

  if (action !== 'sword_battle_accept') {
    await interaction.reply({
      content: '알 수 없는 검배틀 버튼입니다.',
      ephemeral: true
    });
    return true;
  }

  try {
    const result = await economy.playSwordPvpBattle({
      guildId: challenge.guildId,
      challenger: challenge.challenger,
      opponent: challenge.opponent
    });
    pendingSwordBattleChallenges.delete(challengeId);
    await interaction.update({
      ...createSwordReplyPayload(
        formatPvpSwordBattle(challenge, result),
        getPvpWinnerSwordLevel(result),
        `승자 검 — ${getSwordAssetLabel(getPvpWinnerSwordLevel(result))}`
      ),
      components: []
    });
  } catch (error) {
    logger.error(error);
    pendingSwordBattleChallenges.delete(challengeId);
    await interaction.update({
      content: `검배틀 실패: ${error.message}`,
      components: []
    });
  }

  return true;
}

function formatSwordEnhancement(user, result) {
  const outcomeText = {
    success: '✅ 강화 성공',
    maintain: '➖ 유지',
    destroy: '💥 파괴'
  }[result.outcome] ?? result.outcomeLabel;
  const stoneCostText = result.stoneCost > 0
    ? ` / 제련석 -${result.stoneCost.toLocaleString()}개`
    : '';
  const rewardText = result.refineStoneReward > 0
    ? `\n파괴 보상: 제련석 +${result.refineStoneReward.toLocaleString()}개`
    : '';

  return [
    `🗡️ **${result.modeLabel} 결과** — ${user}`,
    `시도: **+${result.beforeLevel} → +${result.beforeLevel + 1}**`,
    `결과: **${outcomeText}** / 현재 검: **${formatSwordLevel(result.profile.sword.level)}**`,
    `확률: 성공 ${result.successRate}% / 유지 ${result.maintainRate}% / 파괴 ${result.destroyRate}% (주사위 ${result.roll})`,
    `사용: ${result.moneyCost.toLocaleString()}원${stoneCostText}`,
    `잔액: **${result.profile.balance.toLocaleString()}원** / 제련석: **${result.profile.sword.refineStones.toLocaleString()}개**`,
    `최고 강화: **+${result.profile.sword.highestLevel}**${rewardText}`
  ].join('\n');
}

function formatSwordGift(user, result) {
  return [
    `🎁 **제련석 선물 수령** — ${user}`,
    `획득: **제련석 +${result.giftStones.toLocaleString()}개**`,
    `현재 제련석: **${result.profile.sword.refineStones.toLocaleString()}개**`,
    `현재 검: **${formatSwordLevel(result.profile.sword.level)}**`,
    `상급강화는 \`/검상급강화\`로 시도할 수 있습니다.`
  ].join('\n');
}

function formatRandomSwordBattle(user, result) {
  const rewardText = result.won
    ? `보상: +${result.rewards.xp.toLocaleString()} XP, +${result.rewards.money.toLocaleString()}원, 제련석 +${result.rewards.refineStones.toLocaleString()}개`
    : '보상: 없음 / 패배해도 돈은 잃지 않습니다.';
  const levelText = result.leveledUp
    ? `\n🎉 레벨업! Lv.${result.profile.level} / 레벨 보너스 +${result.levelReward.toLocaleString()}원`
    : '';

  return [
    `⚔️ **랜덤 검배틀** — ${user}`,
    `상대: **${result.opponent.username}** (+${result.opponent.sword.level}검 / Lv.${result.opponent.level})`,
    `내 전투력: ${result.battle.challenger.power} (${formatSwordLevel(result.battle.challenger.swordLevel)}, Lv.${result.battle.challenger.level}, 주사위 ${result.battle.challenger.roll})`,
    `상대 전투력: ${result.battle.opponent.power} (${formatSwordLevel(result.battle.opponent.swordLevel)}, Lv.${result.battle.opponent.level}, 주사위 ${result.battle.opponent.roll})`,
    `결과: **${result.won ? '승리' : '패배'}**`,
    rewardText,
    `오늘 남은 검배틀: **${result.remainingBattles}회**`,
    `전적: **${result.profile.sword.battleWins}승 ${result.profile.sword.battleLosses}패** / 잔액: **${result.profile.balance.toLocaleString()}원**${levelText}`
  ].join('\n');
}

function formatPvpSwordBattle(challenge, result) {
  const winnerMention = result.winnerUserId === challenge.challenger.userId
    ? challenge.challenger.mention
    : challenge.opponent.mention;
  const challengerWon = result.winnerUserId === challenge.challenger.userId;
  const winnerProfile = challengerWon ? result.challenger : result.opponent;
  const levelText = result.leveledUp
    ? `\n🎉 승자 레벨업! Lv.${winnerProfile.level} / 레벨 보너스 +${result.levelReward.toLocaleString()}원`
    : '';

  return [
    `⚔️ **검배틀 결과**`,
    `${challenge.challenger.mention}: 전투력 ${result.battle.challenger.power} (${formatSwordLevel(result.battle.challenger.swordLevel)}, 주사위 ${result.battle.challenger.roll})`,
    `${challenge.opponent.mention}: 전투력 ${result.battle.opponent.power} (${formatSwordLevel(result.battle.opponent.swordLevel)}, 주사위 ${result.battle.opponent.roll})`,
    `승자: **${winnerMention}**`,
    `승리 보상: +${result.rewards.xp.toLocaleString()} XP, +${result.rewards.money.toLocaleString()}원, 제련석 +${result.rewards.refineStones.toLocaleString()}개`,
    `패자는 돈을 잃지 않습니다.`,
    `남은 검배틀: 신청자 ${result.remainingBattles.challenger}회 / 상대 ${result.remainingBattles.opponent}회${levelText}`
  ].join('\n');
}

function createSwordBattleChallengeRow(challengeId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`sword_battle_accept:${challengeId}`)
      .setLabel('검배틀 수락')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`sword_battle_decline:${challengeId}`)
      .setLabel('거절')
      .setStyle(ButtonStyle.Secondary)
  );
}

function assertValidSwordBattleTarget(user, target) {
  if (target.bot) {
    throw new Error('봇과는 검배틀을 할 수 없습니다.');
  }

  if (target.id === user.id) {
    throw new Error('자기 자신과는 검배틀을 할 수 없습니다.');
  }
}

export function createSwordReplyPayload(content, swordLevel, title = null) {
  const attachment = getSwordAssetAttachment(swordLevel);
  if (!attachment) return { content };

  const embed = new EmbedBuilder()
    .setTitle(title ?? getSwordAssetLabel(swordLevel))
    .setImage(`attachment://${attachment.name}`)
    .setColor(getSwordEmbedColor(swordLevel))
    .setFooter({ text: '검 강화 이미지' });

  return {
    content,
    embeds: [embed],
    files: [attachment]
  };
}

function getSwordEnhancementImageLevel(result) {
  if (result.profile.sword.level > 0) return result.profile.sword.level;
  if (result.outcome === 'destroy' && result.beforeLevel > 0) return result.beforeLevel;
  return result.profile.sword.level;
}

function getSwordEnhancementImageTitle(result) {
  const imageLevel = getSwordEnhancementImageLevel(result);
  if (result.outcome === 'destroy' && result.profile.sword.level === 0 && imageLevel > 0) {
    return `파괴된 검 — ${getSwordAssetLabel(imageLevel)}`;
  }

  return `현재 검 — ${getSwordAssetLabel(imageLevel)}`;
}

function getPvpWinnerSwordLevel(result) {
  return result.winnerUserId === result.challenger.userId
    ? result.challenger.sword.level
    : result.opponent.sword.level;
}

function getSwordEmbedColor(level) {
  const normalizedLevel = Math.max(0, Number(level) || 0);
  if (normalizedLevel >= 100) return 0xff77dd;
  if (normalizedLevel >= 90) return 0xffd700;
  if (normalizedLevel >= 70) return 0xa855f7;
  if (normalizedLevel >= 50) return 0x38bdf8;
  if (normalizedLevel >= 30) return 0x22c55e;
  return 0x9ca3af;
}

function formatSwordLevel(level) {
  const normalizedLevel = Math.max(0, Number(level) || 0);
  if (normalizedLevel <= 0) return '+0 기본 검';

  return `+${normalizedLevel} ${getSwordAssetName(normalizedLevel)}`;
}

async function safeReply(interaction, content, ephemeral = false) {
  const payload = { content, ephemeral };

  if (interaction.deferred || interaction.replied) {
    await interaction.followUp(payload);
  } else {
    await interaction.reply(payload);
  }
}

function isSwordCommand(commandName) {
  return swordCommands.some((command) => command.name === commandName);
}

function createChallengeId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
