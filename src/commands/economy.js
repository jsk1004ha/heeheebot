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

function formatCurrencyInfo() {
  return [
    '💱 **재화정보 / 통합 골드**',
    '모든 재화는 봇 내부 게임머니이며 실제 현금 결제, 실제 현금 환전, 실제 투자와 연결되지 않습니다.',
    '',
    '📌 **현재 기준**',
    '- 단일 화폐: **골드**',
    '- 카지노, RPG, 검강화, 낚시강화, 가상주식, 커뮤니티 상점/복권/송금이 모두 같은 골드 잔액을 사용합니다.',
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
