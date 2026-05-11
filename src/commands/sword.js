import {
  MessageFlags,
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
  getBlacksmithAssetAttachment,
  getRandomBlacksmithTributeAssetAttachment
} from '../systems/sword-blacksmith.js';
import { SEASON_POINT_SOURCES } from '../systems/seasons.js';
import { formatDuration } from './economy.js';
import {
  logUnexpectedInteractionError,
  safeReplyToInteraction
} from './interactions.js';
import { formatSeasonAwardLine } from './seasons.js';
import {
  createAllowedMentionsForUsers,
  formatUserMention
} from './ui.js';

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
    .setName('검도감')
    .setDescription('최고 강화 기준으로 해금된 검 이미지와 다음 잠금을 확인합니다.'),
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
    .setDescription('검으로 기존 유저 랜덤 상대 또는 지정 유저와 배틀합니다. 하루 10회 제한입니다.')
    .addUserOption((option) =>
      option
        .setName('상대')
        .setDescription('비우면 기존 유저 중 랜덤으로 검배틀을 진행합니다.')
    ),
  new SlashCommandBuilder()
    .setName('선물받기')
    .setDescription('하루 한 번 검 상급강화에 필요한 제련석을 받습니다.'),
  new SlashCommandBuilder()
    .setName('묵념')
    .setDescription('터져버린 검과 제련석을 위해 잠시 묵념합니다.')
];

export function getSwordCommandPayloads() {
  return swordCommands.map((command) => command.toJSON());
}

export async function handleSwordCommand(interaction, economy, logger = console, services = {}) {
  if (interaction.isButton()) {
    return handleSwordButton(interaction, economy, logger, services);
  }

  if (!interaction.isChatInputCommand() || !isSwordCommand(interaction.commandName)) {
    return false;
  }

  if (!interaction.inGuild()) {
    await interaction.reply({
      content: '서버에서만 사용할 수 있는 명령어입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  try {
    await routeSwordCommand(interaction, economy, services);
  } catch (error) {
    logUnexpectedInteractionError(logger, error, 'Sword command rejected');
    await safeReply(interaction, `검 시스템 처리 실패: ${error.message}`, true);
  }

  return true;
}

async function routeSwordCommand(interaction, economy, services = {}) {
  const guildId = interaction.guildId;
  const user = interaction.user;

  if (interaction.commandName === '묵념') {
    await interaction.reply(formatSwordSilentTribute(user));
    return;
  }

  if (interaction.commandName === '검강화') {
    const result = await economy.enhanceSword({
      guildId,
      userId: user.id,
      username: user.username
    });
    const seasonAward = await awardSwordEnhanceSeasonPoints(services, { guildId, user, result });
    await interaction.reply(withSeasonAwardPayload(createSwordEnhancementReplyPayload(user, result), seasonAward));
    return;
  }

  if (interaction.commandName === '검상급강화') {
    const result = await economy.advancedEnhanceSword({
      guildId,
      userId: user.id,
      username: user.username
    });
    const seasonAward = await awardSwordEnhanceSeasonPoints(services, { guildId, user, result });
    await interaction.reply(withSeasonAwardPayload(createSwordEnhancementReplyPayload(user, result), seasonAward));
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

  if (interaction.commandName === '검도감') {
    const result = await economy.getSwordStatus({
      guildId,
      userId: user.id,
      username: user.username
    });
    const highestLevel = Math.max(0, Number(result.profile.sword.highestLevel) || 0);
    await interaction.reply(createSwordReplyPayload(
      formatSwordCodex(user, result),
      highestLevel,
      `검도감 — ${getSwordAssetLabel(highestLevel)}`
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
        flags: MessageFlags.Ephemeral
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
        flags: MessageFlags.Ephemeral
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
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const seasonAward = await awardSwordBattleSeasonPoints(services, {
        guildId,
        user,
        result
      });
      await interaction.reply(createSwordReplyPayload(
        formatRandomSwordBattle(user, result),
        result.profile.sword.level,
        `내 검 — ${getSwordAssetLabel(result.profile.sword.level)}`,
        {
          contentSuffix: formatSeasonAwardLine(seasonAward),
          mentionUserIds: [user.id, result.opponent.userId].filter(Boolean)
        }
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
    const seasonAward = await awardSwordPvpSeasonPoints(services, {
      guildId,
      challenge,
      result
    });
    await interaction.reply(createSwordReplyPayload(
      formatPvpSwordBattle(challenge, result),
      getPvpWinnerSwordLevel(result),
      `승자 검 — ${getSwordAssetLabel(getPvpWinnerSwordLevel(result))}`,
      {
        contentSuffix: formatSeasonAwardLine(seasonAward),
        mentionUserIds: [challenge.challenger.userId, challenge.opponent.userId]
      }
    ));
  }
}

async function handleSwordButton(interaction, economy, logger = console, services = {}) {
  if (interaction.customId?.startsWith('sword_quick:')) {
    return handleSwordQuickButton(interaction, economy, logger, services);
  }
  if (!interaction.customId?.startsWith('sword_sell_')) return false;

  const [action, userId] = interaction.customId.split(':');
  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: '이 검 판매 확인 버튼은 명령어를 실행한 유저만 누를 수 있습니다.',
      flags: MessageFlags.Ephemeral
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
      flags: MessageFlags.Ephemeral
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
    logUnexpectedInteractionError(logger, error, 'Sword sale button rejected');
    await interaction.update({
      content: `검판매 실패: ${error.message}`,
      components: []
    });
  }

  return true;
}

async function handleSwordQuickButton(interaction, economy, logger = console, services = {}) {
  const [, action, userId] = interaction.customId.split(':');

  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: '이 검 버튼은 명령어를 실행한 유저만 누를 수 있습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  try {
    if (action === 'enhance') {
      const result = await economy.enhanceSword({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        username: interaction.user.username
      });
      const seasonAward = await awardSwordEnhanceSeasonPoints(services, {
        guildId: interaction.guildId,
        user: interaction.user,
        result
      });
      await interaction.reply(withSeasonAwardPayload(createSwordEnhancementReplyPayload(interaction.user, result), seasonAward));
      return true;
    }

    if (action === 'advanced') {
      const result = await economy.advancedEnhanceSword({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        username: interaction.user.username
      });
      const seasonAward = await awardSwordEnhanceSeasonPoints(services, {
        guildId: interaction.guildId,
        user: interaction.user,
        result
      });
      await interaction.reply(withSeasonAwardPayload(createSwordEnhancementReplyPayload(interaction.user, result), seasonAward));
      return true;
    }

    if (action === 'sell') {
      const result = await economy.getSwordStatus({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        username: interaction.user.username
      });

      if (result.saleValue <= 0) {
        await interaction.reply({
          content: '판매할 검이 없습니다. +1 이상 강화된 검만 판매할 수 있습니다.',
          flags: MessageFlags.Ephemeral
        });
        return true;
      }

      await interaction.update(createSwordReplyPayload(
        formatSwordSalePreview(interaction.user, result),
        result.profile.sword.level,
        `판매 예정 검 — ${getSwordAssetLabel(result.profile.sword.level)}`,
        { components: [createSwordSellConfirmRow(interaction.user.id)] }
      ));
      return true;
    }

    await interaction.reply({
      content: '알 수 없는 검 버튼입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  } catch (error) {
    logUnexpectedInteractionError(logger, error, 'Sword quick button rejected');
    await safeReplyToInteraction(interaction, {
      content: `검 시스템 처리 실패: ${error.message}`,
      flags: MessageFlags.Ephemeral
    });
    return true;
  }
}

function createSwordEnhancementReplyPayload(user, result) {
  return createSwordReplyPayload(
    formatSwordEnhancement(user, result),
    getSwordEnhancementImageLevel(result),
    getSwordEnhancementImageTitle(result),
    {
      includeBlacksmith: true,
      blacksmithOutcome: result.outcome,
      mentionUserIds: [user.id],
      components: [createSwordQuickActionRow(user.id)]
    }
  );
}

async function awardSwordEnhanceSeasonPoints(services, { guildId, user, result }) {
  if (!services?.seasons?.awardPoints || result?.blocked) {
    return null;
  }

  return services.seasons.awardPoints({
    guildId,
    userId: user.id,
    username: user.username,
    source: SEASON_POINT_SOURCES.SWORD_ENHANCE,
    points: 5
  });
}

async function awardSwordBattleSeasonPoints(services, { guildId, user, result }) {
  if (!services?.seasons?.awardPoints || !result?.battled) {
    return null;
  }

  return services.seasons.awardPoints({
    guildId,
    userId: user.id,
    username: user.username,
    source: result.won
      ? SEASON_POINT_SOURCES.SWORD_BATTLE_WIN
      : SEASON_POINT_SOURCES.SWORD_BATTLE_PLAY,
    points: result.won ? 20 : 8
  });
}

async function awardSwordPvpSeasonPoints(services, { guildId, challenge, result }) {
  if (!services?.seasons?.awardPoints || !result?.battled) {
    return null;
  }

  const challengerWon = result.winnerUserId === challenge.challenger.userId;
  const winner = challengerWon ? result.challenger : result.opponent;

  return services.seasons.awardPoints({
    guildId,
    userId: winner.userId,
    username: winner.username,
    source: SEASON_POINT_SOURCES.SWORD_BATTLE_WIN,
    points: 20
  });
}

function withSeasonAwardPayload(payload, award) {
  const line = formatSeasonAwardLine(award);
  if (!line) return payload;

  return {
    ...payload,
    content: `${payload.content ?? ''}\n${line}`.trim()
  };
}

function formatSwordEnhancement(user, result) {
  const lines = [
    `${formatUserMention(user, user.username)} ${formatSwordEnhancementTitle(result)}`,
    '',
    `💬 ${formatBlacksmithEnhancementLine(result).replace(/^🔨 \*\*대장장이\*\*/, '대장장이')}`,
    '',
    `💸사용 골드: -${result.moneyCost.toLocaleString()}G`,
    `💰보유 골드: ${getSwordCoins(result.profile).toLocaleString()}G`
  ];

  if (result.stoneCost > 0) {
    lines.push(
      `🪨사용 제련석: -${result.stoneCost.toLocaleString()}개`,
      `🧱보유 제련석: ${result.profile.sword.refineStones.toLocaleString()}개`
    );
  }

  lines.push(...formatSwordEnhancementOutcomeLines(result));
  lines.push(...formatSwordEnhancementBonusLines(result));

  return lines.join('\n');
}

function formatSwordEnhancementTitle(result) {
  if (result.mode === 'advanced' && result.outcome === 'success') {
    return `〖🌠 상급강화 ${formatActualEnhancementRange(result)}〗`;
  }

  if (result.outcome === 'success') {
    return `〖🔥강화 성공🔥 ${formatActualEnhancementRange(result)}〗`;
  }

  if (result.outcome === 'maintain') return '〖💦강화 유지💦〗';
  if (result.outcome === 'destroy') return '〖💥강화 파괴💥〗';
  if (result.outcome === 'protect') return '〖🛡️보호권 발동🛡️〗';
  return `〖${result.outcomeLabel ?? '강화 결과'}〗`;
}

function formatSwordEnhancementOutcomeLines(result) {
  if (result.outcome === 'success') {
    const gainText = result.levelGain > 1 ? ` · 대성공 +${result.levelGain}` : '';
    return [
      `⚔️ 획득 검: [${formatSwordLevel(result.profile.sword.level)}]${gainText}`,
      `📈 적용 확률: 성공 ${formatRate(result.successRate)}% / 유지 ${formatRate(result.maintainRate)}% / 파괴 ${formatRate(result.destroyRate)}%`
    ];
  }

  if (result.outcome === 'maintain') {
    return [
      `『[${formatSwordLevel(result.beforeLevel)}]』의 레벨이 유지되었습니다.`,
      `📈 적용 확률: 성공 ${formatRate(result.successRate)}% / 유지 ${formatRate(result.maintainRate)}% / 파괴 ${formatRate(result.destroyRate)}%`
    ];
  }

  if (result.outcome === 'destroy') {
    const rewardLines = [];
    if (result.refineStoneReward > 0) {
      const beforeStones = Math.max(0, result.profile.sword.refineStones - result.refineStoneReward);
      rewardLines.push(
        `🧱 제련석 ${result.refineStoneReward.toLocaleString()}개 획득! (${beforeStones.toLocaleString()}개 → ${result.profile.sword.refineStones.toLocaleString()}개)`
      );
    }

    return [
      `💔 [${formatSwordLevel(result.beforeLevel)}]이 산산조각나 +0으로 돌아갔습니다.`,
      ...rewardLines,
      `📈 적용 확률: 성공 ${formatRate(result.successRate)}% / 유지 ${formatRate(result.maintainRate)}% / 파괴 ${formatRate(result.destroyRate)}%`
    ];
  }

  if (result.outcome === 'protect') {
    return [
      `🛡️ 보호권이 발동해 [${formatSwordLevel(result.beforeLevel)}]을 지켰습니다.`,
      `🧾 보유 보호권: ${(result.profile.sword.protectionScrolls ?? 0).toLocaleString()}개`,
      `📈 적용 확률: 성공 ${formatRate(result.successRate)}% / 유지 ${formatRate(result.maintainRate)}% / 파괴 ${formatRate(result.destroyRate)}%`
    ];
  }

  return [`📈 적용 확률: 성공 ${formatRate(result.successRate)}% / 유지 ${formatRate(result.maintainRate)}% / 파괴 ${formatRate(result.destroyRate)}%`];
}

function formatSwordEnhancementBonusLines(result) {
  const lines = [];

  if (result.successBonusRate > 0) {
    const remainingText = result.successBonus?.remainingMs > 0
      ? ` (${formatDuration(result.successBonus.remainingMs)} 남음)`
      : '';
    lines.push(`🔥추가 확률 +${formatRate(result.successBonusRate, 2)}%p${remainingText}`);
  }

  if (result.triggeredSuccessBonus?.rate > 0) {
    lines.push(`🔥서버 추가 확률 +${formatRate(result.triggeredSuccessBonus.rate, 2)}%p 발동! ${formatDuration(result.triggeredSuccessBonus.durationMs)} 동안 다른 유저에게 적용됩니다.`);
  }

  return lines;
}

function formatSwordSilentTribute(user) {
  const attachment = getRandomBlacksmithTributeAssetAttachment();
  const payload = {
    content: `🕯️ ${formatUserMention(user, user.username)}님이 조용히 묵념합니다.`
  };

  if (!attachment) return payload;

  const embed = new EmbedBuilder()
    .setTitle('대장장이의 묵념 타임')
    .setImage(`attachment://${attachment.name}`)
    .setColor(0x2f3136);

  return {
    ...payload,
    embeds: [embed],
    files: [attachment]
  };
}

function formatSwordGift(user, result) {
  return [
    `🎁 **제련석 선물 수령** — ${formatUserMention(user, user.username)}`,
    `획득: **제련석 +${result.giftStones.toLocaleString()}개**`,
    `현재: 제련석 **${result.profile.sword.refineStones.toLocaleString()}개** · 검 **${formatSwordLevel(result.profile.sword.level)}**`
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
    `📌 **검정보** — ${formatUserMention(user, user.username)}`,
    `현재 검: **${formatSwordLevel(profile.sword.level)}** / 최고 **+${profile.sword.highestLevel}** / 골드 **${getSwordCoins(profile).toLocaleString()}골드**`,
    `제련석: **${profile.sword.refineStones.toLocaleString()}개** / 보호권: **${(profile.sword.protectionScrolls ?? 0).toLocaleString()}개** / 선물: **${giftText}**`,
    normalText,
    advancedText,
    `판매 예상가: **${result.saleValue.toLocaleString()}골드** / 전적 **${profile.sword.battleWins}승 ${profile.sword.battleLosses}패** / 파괴 **${profile.sword.destructions.toLocaleString()}회**`,
    `오늘 검배틀: **${result.battleRemaining}회 남음** / 제련석 보상: **${result.battleStoneRemaining}개 남음**`
  ].join('\n');
}

function formatSwordCodex(user, result) {
  const { profile } = result;
  const currentLevel = Math.max(0, Number(profile.sword.level) || 0);
  const highestLevel = Math.max(0, Number(profile.sword.highestLevel) || 0);
  const nextLockedLevel = highestLevel >= 100 ? null : highestLevel + 1;
  const recentLevels = Array.from(
    { length: Math.min(5, highestLevel + 1) },
    (_, index) => Math.max(0, highestLevel - index)
  ).reverse();
  const recentText = recentLevels
    .map((level) => `+${level} ${getSwordAssetName(level)}`)
    .join(' / ');
  const nextText = nextLockedLevel === null
    ? '모든 검을 해금했습니다.'
    : `다음 잠금: **+${nextLockedLevel} ${getSwordAssetName(nextLockedLevel)}**`;

  return [
    `📚 **검도감** — ${formatUserMention(user, user.username)}`,
    `해금: **${highestLevel}/100** / 현재 검: **${formatSwordLevel(currentLevel)}**`,
    `최고 해금: **${formatSwordLevel(highestLevel)}** / ${nextText}`,
    `최근 해금: ${recentText || '+0 기본 검'}`
  ].join('\n');
}

function formatSwordProtectionPurchase(user, result) {
  return [
    `🛡️ **검 보호권 구매** — ${formatUserMention(user, user.username)}`,
    `획득: **보호권 +${result.quantity.toLocaleString()}개**`,
    `비용: ${result.unitCost.toLocaleString()}골드 × ${result.quantity.toLocaleString()} = **${result.totalCost.toLocaleString()}골드**`,
    `골드: **${getSwordCoins(result.profile).toLocaleString()}골드** / 보유 보호권: **${result.profile.sword.protectionScrolls.toLocaleString()}개**`
  ].join('\n');
}

function formatSwordAchievements(user, result) {
  const lines = result.achievements.map((achievement) => {
    const state = achievement.claimed
      ? '수령 완료'
      : achievement.complete
        ? '수령 가능'
        : '진행 중';
    return `- **${achievement.title}** [${state}] ${achievement.progressText} / 보상: ${achievement.rewardText}`;
  });

  return [
    `🏅 **검 업적** — ${formatUserMention(user, user.username)}`,
    ...lines
  ].join('\n');
}

function formatSwordAchievementClaim(user, result) {
  return [
    `🏅 **업적 보상 수령** — ${formatUserMention(user, user.username)}`,
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
    `${label}: **${formatEnhancementTargetRange(config)}**`,
    `비용 ${config.moneyCost.toLocaleString()}골드${stoneText}`,
    `성공 ${formatRate(config.successRate)}% / 유지 ${formatRate(config.maintainRate)}% / 파괴 ${formatRate(config.destroyRate)}%${config.successBonusRate > 0 ? ` / 추가 +${formatRate(config.successBonusRate, 2)}%p` : ''}`
  ].join(' — ');
}

function formatEnhancementTargetRange(config) {
  const targetLevel = Math.max(0, Number(config.targetLevel) || Number(config.level) + 1 || 1);
  const maxTargetLevel = Math.max(targetLevel, Number(config.maxTargetLevel) || targetLevel);
  if (maxTargetLevel > targetLevel) {
    return `+${config.level} → +${targetLevel}~+${maxTargetLevel}`;
  }
  return `+${config.level} → +${targetLevel}`;
}

function formatActualEnhancementRange(result) {
  return `+${Math.max(0, Number(result.beforeLevel) || 0)} → +${Math.max(0, Number(result.afterLevel) || 0)}`;
}

function formatRate(value, digits = 0) {
  const normalized = Number(value);
  const safeValue = Number.isFinite(normalized) ? normalized : 0;
  return digits > 0
    ? safeValue.toFixed(digits)
    : safeValue.toLocaleString();
}

function formatSwordSalePreview(user, result) {
  const level = result.profile.sword.level;

  return [
    `💰 **검판매 확인** — ${formatUserMention(user, user.username)}`,
    `판매할 검: **${formatSwordLevel(level)}**`,
    `판매 예상가: **${result.saleValue.toLocaleString()}골드**`,
    `판매 후 **+0 기본 검** · 최고 기록/제련석/전적 유지`,
    `확정하려면 아래 **판매 확정** 버튼`
  ].join('\n');
}

function formatSwordSale(user, result) {
  return [
    `💰 **검판매** — ${formatUserMention(user, user.username)}`,
    `판매한 검: **${formatSwordLevel(result.beforeLevel)}**`,
    `판매 금액: **${result.saleValue.toLocaleString()}골드**`,
    `현재 검: **${formatSwordLevel(result.profile.sword.level)}** / 골드 **${getSwordCoins(result.profile).toLocaleString()}골드** / 최고 **+${result.profile.sword.highestLevel}**`
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
    ? ` · 🎉 Lv.${result.profile.level} 보너스 +${result.levelReward.toLocaleString()}골드`
    : '';
  const opponentMention = result.opponent.userId
    ? formatUserMention(result.opponent.userId, result.opponent.username)
    : result.opponent.username;

  return [
    `⚔️ **랜덤 검배틀** — ${formatUserMention(user, user.username)}`,
    `상대 유저: ${opponentMention} (+${result.opponent.sword.level}검 / Lv.${result.opponent.level})`,
    `전투력: 나 ${result.battle.challenger.power} / 상대 ${result.battle.opponent.power} · 주사위 ${result.battle.challenger.roll}/${result.battle.opponent.roll}`,
    `결과: **${result.won ? '승리' : '패배'}** · ${rewardText}`,
    `남은 검배틀 **${result.remainingBattles}회** · 전적 **${result.profile.sword.battleWins}승 ${result.profile.sword.battleLosses}패** · 골드 **${getSwordCoins(result.profile).toLocaleString()}골드**${levelText}`
  ].join('\n');
}

function formatPvpSwordBattle(challenge, result) {
  const winnerMention = result.winnerUserId === challenge.challenger.userId
    ? challenge.challenger.mention
    : challenge.opponent.mention;
  const challengerWon = result.winnerUserId === challenge.challenger.userId;
  const winnerProfile = challengerWon ? result.challenger : result.opponent;
  const levelText = result.leveledUp
    ? ` · 🎉 승자 Lv.${winnerProfile.level} 보너스 +${result.levelReward.toLocaleString()}골드`
    : '';

  return [
    `⚔️ **검배틀 결과**`,
    `${challenge.challenger.mention} ${result.battle.challenger.power} vs ${challenge.opponent.mention} ${result.battle.opponent.power} · 주사위 ${result.battle.challenger.roll}/${result.battle.opponent.roll}`,
    `승자: **${winnerMention}**`,
    `승리 보상: +${result.rewards.xp.toLocaleString()} XP, +${result.rewards.money.toLocaleString()}골드, 제련석 +${result.rewards.refineStones.toLocaleString()}개`,
    `패자 골드 차감 없음 · 남은 검배틀 신청자 ${result.remainingBattles.challenger}회 / 상대 ${result.remainingBattles.opponent}회${levelText}`
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
      mention: formatUserMention(interaction.user, interaction.user.username)
    },
    opponent: {
      userId: target.id,
      username: target.username,
      mention: formatUserMention(target, target.username)
    }
  };
}

export function createSwordReplyPayload(content, swordLevel, title = null, options = {}) {
  const attachment = getSwordAssetAttachment(swordLevel);
  const payloadContent = options.contentSuffix
    ? `${content}\n${options.contentSuffix}`
    : content;
  const allowedMentions = options.mentionUserIds
    ? { allowedMentions: createAllowedMentionsForUsers(options.mentionUserIds) }
    : {};

  if (!attachment) return { content: payloadContent, ...allowedMentions };

  const files = [attachment];
  const embed = new EmbedBuilder()
    .setTitle(title ?? getSwordAssetLabel(swordLevel))
    .setImage(`attachment://${attachment.name}`)
    .setColor(getSwordEmbedColor(swordLevel));

  if (options.includeBlacksmith) {
    const blacksmithAttachment = getBlacksmithAssetAttachment(options.blacksmithOutcome);
    if (blacksmithAttachment) {
      embed.setThumbnail(`attachment://${blacksmithAttachment.name}`);
      files.push(blacksmithAttachment);
    }
  }

  return {
    content: payloadContent,
    embeds: [embed],
    files,
    ...allowedMentions,
    ...(options.components ? { components: options.components } : {})
  };
}

function createSwordQuickActionRow(userId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`sword_quick:enhance:${userId}`)
      .setLabel('검강화')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`sword_quick:advanced:${userId}`)
      .setLabel('상급강화')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`sword_quick:sell:${userId}`)
      .setLabel('검판매')
      .setStyle(ButtonStyle.Secondary)
  );
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
  await safeReplyToInteraction(interaction, content, { ephemeral });
}

function isSwordCommand(commandName) {
  return swordCommands.some((command) => command.name === commandName);
}
