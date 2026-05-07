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
import {
  formatBlacksmithEnhancementLine,
  getBlacksmithAssetAttachment
} from '../systems/sword-blacksmith.js';
import { formatDuration } from './economy.js';

export const swordCommands = [
  new SlashCommandBuilder()
    .setName('검강화')
    .setDescription('골드를 사용해 내 검을 강화합니다. 최대 +100강까지 가능합니다.'),
  new SlashCommandBuilder()
    .setName('검상급강화')
    .setDescription('제련석을 사용해 파괴 없이 검을 강화합니다. +90 이하에서만 가능합니다.'),
  new SlashCommandBuilder()
    .setName('검정보')
    .setDescription('현재 검, 다음 강화 확률/비용, 판매가와 전적을 확인합니다.'),
  new SlashCommandBuilder()
    .setName('검보호권')
    .setDescription('골드으로 파괴 방지 보호권을 구매합니다.')
    .addIntegerOption((option) =>
      option
        .setName('수량')
        .setDescription('구매할 보호권 수량(기본 1개, 최대 10개)')
        .setMinValue(1)
        .setMaxValue(10)
    ),
  new SlashCommandBuilder()
    .setName('검업적')
    .setDescription('검 업적 현황을 보거나 완료 업적 보상을 받습니다.')
    .addStringOption((option) =>
      option
        .setName('업적')
        .setDescription('보상을 받을 업적. 비우면 전체 현황 표시')
        .addChoices(
          { name: '+50 달성', value: 'sword_level_50' },
          { name: '+80 고지', value: 'sword_level_80' },
          { name: '+100 전설', value: 'sword_level_100' },
          { name: '터져도 다시', value: 'sword_destroy_5' },
          { name: '검 장사꾼', value: 'sword_sales_10000' }
        )
    ),
  new SlashCommandBuilder()
    .setName('검판매')
    .setDescription('현재 강화된 검을 판매하고 골드를 받습니다. 판매 후 검은 +0으로 돌아갑니다.'),
  new SlashCommandBuilder()
    .setName('검랭킹')
    .setDescription('서버의 검 최고강화, 판매금, 파괴횟수 랭킹을 확인합니다.')
    .addStringOption((option) =>
      option
        .setName('종류')
        .setDescription('확인할 검 랭킹 종류')
        .addChoices(
          { name: '최고강화', value: 'highestLevel' },
          { name: '판매금', value: 'saleEarnings' },
          { name: '파괴횟수', value: 'destructions' }
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
    return handleSwordButton(interaction, economy, logger);
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
      getSwordEnhancementImageTitle(result),
      {
        includeBlacksmith: true,
        blacksmithOutcome: result.outcome
      }
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
      getSwordEnhancementImageTitle(result),
      {
        includeBlacksmith: true,
        blacksmithOutcome: result.outcome
      }
    ));
    return;
  }

  if (interaction.commandName === '검정보') {
    const result = await economy.getSwordStatus({
      guildId,
      userId: user.id,
      username: user.username
    });
    await interaction.reply(createSwordReplyPayload(
      formatSwordInfo(user, result),
      result.profile.sword.level,
      `내 검 정보 — ${getSwordAssetLabel(result.profile.sword.level)}`
    ));
    return;
  }

  if (interaction.commandName === '검보호권') {
    const result = await economy.buySwordProtectionScrolls({
      guildId,
      userId: user.id,
      username: user.username,
      quantity: interaction.options.getInteger('수량') ?? 1
    });
    await interaction.reply(createSwordReplyPayload(
      formatSwordProtectionPurchase(user, result),
      result.profile.sword.level,
      `현재 검 — ${getSwordAssetLabel(result.profile.sword.level)}`
    ));
    return;
  }

  if (interaction.commandName === '검업적') {
    const achievementId = interaction.options.getString('업적');
    if (achievementId) {
      const result = await economy.claimSwordAchievement({
        guildId,
        userId: user.id,
        username: user.username,
        achievementId
      });
      await interaction.reply(formatSwordAchievementClaim(user, result));
      return;
    }

    const result = await economy.getSwordAchievements({
      guildId,
      userId: user.id,
      username: user.username
    });
    await interaction.reply(formatSwordAchievements(user, result));
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

  if (interaction.commandName === '검판매') {
    const result = await economy.getSwordStatus({
      guildId,
      userId: user.id,
      username: user.username
    });

    if (result.saleValue <= 0) {
      await interaction.reply({
        content: '판매할 검이 없습니다. +1 이상 강화된 검만 판매할 수 있습니다.',
        ephemeral: true
      });
      return;
    }

    await interaction.reply(createSwordReplyPayload(
      formatSwordSalePreview(user, result),
      result.profile.sword.level,
      `판매 예정 검 — ${getSwordAssetLabel(result.profile.sword.level)}`,
      { components: [createSwordSellConfirmRow(user.id)] }
    ));
    return;
  }

  if (interaction.commandName === '검랭킹') {
    const category = interaction.options.getString('종류') ?? 'highestLevel';
    const limit = interaction.options.getInteger('개수') ?? 10;
    const rows = await economy.getSwordLeaderboard(guildId, category, limit);

    if (rows.length === 0) {
      await interaction.reply('아직 검 랭킹 데이터가 없습니다.');
      return;
    }

    await interaction.reply(formatSwordLeaderboard(rows, category));
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
    const challenge = createSwordBattleContext(interaction, target);
    const result = await economy.playSwordPvpBattle({
      guildId: challenge.guildId,
      challenger: challenge.challenger,
      opponent: challenge.opponent
    });
    await interaction.reply(createSwordReplyPayload(
      formatPvpSwordBattle(challenge, result),
      getPvpWinnerSwordLevel(result),
      `승자 검 — ${getSwordAssetLabel(getPvpWinnerSwordLevel(result))}`
    ));
  }
}

async function handleSwordButton(interaction, economy, logger = console) {
  if (!interaction.customId?.startsWith('sword_sell_')) return false;

  const [action, userId] = interaction.customId.split(':');

  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: '이 검 판매 확인 버튼은 명령어를 실행한 유저만 누를 수 있습니다.',
      ephemeral: true
    });
    return true;
  }

  if (action === 'sword_sell_cancel') {
    await interaction.update({
      content: '🛡️ 검 판매를 취소했습니다. 검은 그대로 유지됩니다.',
      components: []
    });
    return true;
  }

  if (action !== 'sword_sell_confirm') {
    await interaction.reply({
      content: '알 수 없는 검 판매 버튼입니다.',
      ephemeral: true
    });
    return true;
  }

  try {
    const result = await economy.sellSword({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      username: interaction.user.username
    });
    await interaction.update(createSwordReplyPayload(
      formatSwordSale(interaction.user, result),
      result.beforeLevel,
      `판매한 검 — ${getSwordAssetLabel(result.beforeLevel)}`,
      { components: [] }
    ));
  } catch (error) {
    logger.error(error);
    await interaction.update({
      content: `검판매 실패: ${error.message}`,
      components: []
    });
  }

  return true;
}

function formatSwordEnhancement(user, result) {
  const outcomeText = {
    success: '✅ 강화 성공',
    maintain: '➖ 유지',
    destroy: '💥 파괴',
    protect: '🛡️ 보호권 발동'
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
    `사용: ${result.moneyCost.toLocaleString()}골드${stoneCostText}`,
    `골드: **${getSwordCoins(result.profile).toLocaleString()}골드** / 제련석: **${result.profile.sword.refineStones.toLocaleString()}개** / 보호권: **${(result.profile.sword.protectionScrolls ?? 0).toLocaleString()}개**`,
    formatBlacksmithEnhancementLine(result),
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

function formatSwordInfo(user, result) {
  const { profile } = result;
  const normalText = formatEnhancePreview(result.normalEnhance, '다음 일반 강화');
  const advancedText = formatEnhancePreview(result.advancedEnhance, '다음 상급 강화');
  const giftText = result.giftAvailable
    ? '수령 가능'
    : `대기 중 (${formatDuration(result.giftRemainingMs)})`;

  return [
    `📌 **검정보** — ${user}`,
    `현재 검: **${formatSwordLevel(profile.sword.level)}**`,
    `최고 강화: **+${profile.sword.highestLevel}** / 골드: **${getSwordCoins(profile).toLocaleString()}골드**`,
    `제련석: **${profile.sword.refineStones.toLocaleString()}개** / 보호권: **${(profile.sword.protectionScrolls ?? 0).toLocaleString()}개** / 선물: **${giftText}**`,
    normalText,
    advancedText,
    `판매 예상가: **${result.saleValue.toLocaleString()}골드**`,
    `전적: **${profile.sword.battleWins}승 ${profile.sword.battleLosses}패** / 파괴: **${profile.sword.destructions.toLocaleString()}회**`,
    `오늘 검배틀: **${result.battleRemaining}회 남음** / 제련석 보상: **${result.battleStoneRemaining}개 남음**`
  ].join('\n');
}

function formatSwordProtectionPurchase(user, result) {
  return [
    `🛡️ **검 보호권 구매** — ${user}`,
    `획득: **보호권 +${result.quantity.toLocaleString()}개**`,
    `비용: ${result.unitCost.toLocaleString()}골드 × ${result.quantity.toLocaleString()} = **${result.totalCost.toLocaleString()}골드**`,
    `골드: **${getSwordCoins(result.profile).toLocaleString()}골드** / 보유 보호권: **${result.profile.sword.protectionScrolls.toLocaleString()}개**`,
    '일반 강화에서 검이 파괴될 때 보호권 1개를 소모해 현재 강화 수치를 지킵니다.'
  ].join('\n');
}

function formatSwordAchievements(user, result) {
  const lines = result.achievements.map((achievement) => {
    const state = achievement.claimed
      ? '수령 완료'
      : achievement.complete
        ? '수령 가능'
        : '진행 중';
    return `- **${achievement.title}** [${state}] ${achievement.progressText} — ${achievement.description} / 보상: ${achievement.rewardText}`;
  });

  return [
    `🏅 **검 업적** — ${user}`,
    ...lines,
    '',
    '완료한 업적은 `/검업적 업적:<이름>`으로 보상을 받을 수 있습니다.'
  ].join('\n');
}

function formatSwordAchievementClaim(user, result) {
  return [
    `🏅 **업적 보상 수령** — ${user}`,
    `업적: **${result.achievement.title}**`,
    `보상: **${result.achievement.rewardText}**`,
    `골드: **${getSwordCoins(result.profile).toLocaleString()}골드** / 제련석: **${result.profile.sword.refineStones.toLocaleString()}개** / 보호권: **${result.profile.sword.protectionScrolls.toLocaleString()}개**`
  ].join('\n');
}

function formatEnhancePreview(config, label) {
  if (!config || config.blocked) {
    return `${label}: **불가** (${config?.reason ?? '조건을 만족하지 않습니다.'})`;
  }

  const stoneText = config.stoneCost > 0
    ? ` / 제련석 ${config.stoneCost.toLocaleString()}개`
    : '';

  return [
    `${label}: **+${config.level} → +${config.targetLevel}**`,
    `비용 ${config.moneyCost.toLocaleString()}골드${stoneText}`,
    `성공 ${config.successRate}% / 유지 ${config.maintainRate}% / 파괴 ${config.destroyRate}%`
  ].join(' — ');
}

function formatSwordSalePreview(user, result) {
  const level = result.profile.sword.level;

  return [
    `💰 **검판매 확인** — ${user}`,
    `판매할 검: **${formatSwordLevel(level)}**`,
    `판매 예상가: **${result.saleValue.toLocaleString()}골드**`,
    `판매 후 현재 검은 **+0 기본 검**으로 돌아갑니다.`,
    `최고 강화 기록, 제련석, 배틀 전적은 유지됩니다.`,
    `정말 판매하려면 아래 **판매 확정** 버튼을 누르세요.`
  ].join('\n');
}

function formatSwordSale(user, result) {
  return [
    `💰 **검판매** — ${user}`,
    `판매한 검: **${formatSwordLevel(result.beforeLevel)}**`,
    `판매 금액: **${result.saleValue.toLocaleString()}골드**`,
    `현재 검: **${formatSwordLevel(result.profile.sword.level)}**`,
    `골드: **${getSwordCoins(result.profile).toLocaleString()}골드**`,
    `최고 강화 기록: **+${result.profile.sword.highestLevel}**`
  ].join('\n');
}

function formatSwordLeaderboard(rows, category) {
  const meta = getSwordLeaderboardMeta(category);
  const body = rows
    .map((profile, index) => {
      const rank = index + 1;
      return `${rank}. **${profile.username}** — ${meta.format(profile.metric)} / 최고 +${profile.sword.highestLevel}`;
    })
    .join('\n');

  return `🏆 **검 ${meta.label} 랭킹**\n${body}`;
}

function getSwordLeaderboardMeta(category) {
  return {
    highestLevel: {
      label: '최고강화',
      format: (value) => `+${value}`
    },
    saleEarnings: {
      label: '판매금',
      format: (value) => `${value.toLocaleString()}골드`
    },
    destructions: {
      label: '파괴횟수',
      format: (value) => `${value.toLocaleString()}회`
    }
  }[category] ?? {
    label: '최고강화',
    format: (value) => `+${value}`
  };
}

function formatRandomSwordBattle(user, result) {
  const rewardText = result.won
    ? `보상: +${result.rewards.xp.toLocaleString()} XP, +${result.rewards.money.toLocaleString()}골드, 제련석 +${result.rewards.refineStones.toLocaleString()}개`
    : '보상: 없음 / 패배해도 골드는 잃지 않습니다.';
  const levelText = result.leveledUp
    ? `\n🎉 레벨업! Lv.${result.profile.level} / 레벨 보너스 +${result.levelReward.toLocaleString()}골드`
    : '';

  return [
    `⚔️ **랜덤 검배틀** — ${user}`,
    `상대: **${result.opponent.username}** (+${result.opponent.sword.level}검 / Lv.${result.opponent.level})`,
    `내 전투력: ${result.battle.challenger.power} (${formatSwordLevel(result.battle.challenger.swordLevel)}, Lv.${result.battle.challenger.level}, 주사위 ${result.battle.challenger.roll})`,
    `상대 전투력: ${result.battle.opponent.power} (${formatSwordLevel(result.battle.opponent.swordLevel)}, Lv.${result.battle.opponent.level}, 주사위 ${result.battle.opponent.roll})`,
    `결과: **${result.won ? '승리' : '패배'}**`,
    rewardText,
    `오늘 남은 검배틀: **${result.remainingBattles}회**`,
    `전적: **${result.profile.sword.battleWins}승 ${result.profile.sword.battleLosses}패** / 골드: **${getSwordCoins(result.profile).toLocaleString()}골드**${levelText}`
  ].join('\n');
}

function formatPvpSwordBattle(challenge, result) {
  const winnerMention = result.winnerUserId === challenge.challenger.userId
    ? challenge.challenger.mention
    : challenge.opponent.mention;
  const challengerWon = result.winnerUserId === challenge.challenger.userId;
  const winnerProfile = challengerWon ? result.challenger : result.opponent;
  const levelText = result.leveledUp
    ? `\n🎉 승자 레벨업! Lv.${winnerProfile.level} / 레벨 보너스 +${result.levelReward.toLocaleString()}골드`
    : '';

  return [
    `⚔️ **검배틀 결과**`,
    `${challenge.challenger.mention}: 전투력 ${result.battle.challenger.power} (${formatSwordLevel(result.battle.challenger.swordLevel)}, 주사위 ${result.battle.challenger.roll})`,
    `${challenge.opponent.mention}: 전투력 ${result.battle.opponent.power} (${formatSwordLevel(result.battle.opponent.swordLevel)}, 주사위 ${result.battle.opponent.roll})`,
    `승자: **${winnerMention}**`,
    `승리 보상: +${result.rewards.xp.toLocaleString()} XP, +${result.rewards.money.toLocaleString()}골드, 제련석 +${result.rewards.refineStones.toLocaleString()}개`,
    `패자는 골드를 잃지 않습니다.`,
    `남은 검배틀: 신청자 ${result.remainingBattles.challenger}회 / 상대 ${result.remainingBattles.opponent}회${levelText}`
  ].join('\n');
}

function assertValidSwordBattleTarget(user, target) {
  if (target.bot) {
    throw new Error('봇과는 검배틀을 할 수 없습니다.');
  }

  if (target.id === user.id) {
    throw new Error('자기 자신과는 검배틀을 할 수 없습니다.');
  }
}

function createSwordBattleContext(interaction, target) {
  return {
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
    }
  };
}

export function createSwordReplyPayload(content, swordLevel, title = null, options = {}) {
  const attachment = getSwordAssetAttachment(swordLevel);
  if (!attachment) return { content };

  const files = [attachment];
  const embed = new EmbedBuilder()
    .setTitle(title ?? getSwordAssetLabel(swordLevel))
    .setImage(`attachment://${attachment.name}`)
    .setColor(getSwordEmbedColor(swordLevel))
    .setFooter({ text: '검 강화 이미지' });

  if (options.includeBlacksmith) {
    const blacksmithAttachment = getBlacksmithAssetAttachment(options.blacksmithOutcome);
    if (blacksmithAttachment) {
      embed.setThumbnail(`attachment://${blacksmithAttachment.name}`);
      files.push(blacksmithAttachment);
    }
  }

  return {
    content,
    embeds: [embed],
    files,
    ...(options.components ? { components: options.components } : {})
  };
}

function createSwordSellConfirmRow(userId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`sword_sell_confirm:${userId}`)
      .setLabel('판매 확정')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`sword_sell_cancel:${userId}`)
      .setLabel('취소')
      .setStyle(ButtonStyle.Secondary)
  );
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

function getSwordCoins(profile) {
  return profile.balance ?? profile.currencyBalances?.main ?? profile.currencyBalances?.sword ?? 0;
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
