import {
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder
} from 'discord.js';
import { formatDuration } from './economy.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const FORTUNE_DAY_OFFSET_MS = 9 * 60 * 60 * 1000;
const TODAY_BUTTON_PREFIX = 'today_';

export const todayCommands = [
  new SlashCommandBuilder()
    .setName('오늘할일')
    .setDescription('오늘 받을 보상과 할 일 체크리스트를 한 번에 확인합니다.')
];

export function getTodayCommandPayloads() {
  return todayCommands.map((command) => command.toJSON());
}

export async function handleTodayCommand(interaction, services = {}) {
  if (interaction.isButton?.()) {
    return handleTodayButton(interaction, services);
  }

  if (!interaction.isChatInputCommand() || interaction.commandName !== '오늘할일') {
    return false;
  }

  if (!interaction.inGuild()) {
    await interaction.reply({
      content: '서버에서만 사용할 수 있는 명령어입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  await interaction.reply(await createTodayPayload(interaction, services));
  return true;
}

async function handleTodayButton(interaction, services) {
  if (!interaction.customId?.startsWith(TODAY_BUTTON_PREFIX)) return false;

  const [action, ownerUserId] = interaction.customId.split(':');
  if (interaction.user.id !== ownerUserId) {
    await interaction.reply({
      content: '이 오늘 할 일 버튼은 명령어를 실행한 유저만 누를 수 있습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (!interaction.inGuild()) {
    await interaction.reply({
      content: '서버에서만 사용할 수 있는 버튼입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (action === 'today_refresh') {
    await interaction.update(await createTodayPayload(interaction, services));
    return true;
  }

  if (action === 'today_checkin') {
    const result = await services.economy.claimDaily(createBaseContext(interaction));
    await interaction.update(await createTodayPayload(interaction, services, {
      notice: formatDailyClaimNotice(result)
    }));
    return true;
  }

  if (action === 'today_missions') {
    const result = await services.community.claimMissions({
      ...createBaseContext(interaction),
      type: 'daily'
    });
    await interaction.update(await createTodayPayload(interaction, services, {
      notice: formatCommunityMissionClaimNotice(result)
    }));
    return true;
  }

  await interaction.reply({
    content: '알 수 없는 오늘 할 일 버튼입니다.',
    flags: MessageFlags.Ephemeral
  });
  return true;
}

async function createTodayPayload(interaction, services, { notice = null } = {}) {
  const context = await buildTodayContext(interaction, services, { notice });

  return {
    content: formatTodayChecklist(context),
    components: createTodayRows(context)
  };
}

async function buildTodayContext(interaction, services, { notice = null } = {}) {
  const base = createBaseContext(interaction);
  const now = Date.now();
  const rpgStatus = await services.economy.getRpgStatus({
    ...base,
    now
  });
  const communityOverview = services.community?.getOverview
    ? await services.community.getOverview({
        ...base,
        now
      })
    : null;
  const swordStatus = services.economy.getSwordStatus
    ? await services.economy.getSwordStatus({
        ...base,
        now
      })
    : null;
  const seasonOverview = services.seasons?.getOverview
    ? await services.seasons.getOverview({
        ...base,
        now
      })
    : null;
  const seasonChallenges = services.seasons?.getChallenges
    ? await services.seasons.getChallenges({
        ...base,
        now
      })
    : null;

  return {
    now,
    notice,
    user: interaction.user,
    profile: rpgStatus.profile,
    communityOverview,
    rpgStatus,
    swordStatus,
    seasonOverview,
    seasonChallenges
  };
}

function createBaseContext(interaction) {
  return {
    guildId: interaction.guildId,
    userId: interaction.user.id,
    username: interaction.user.username
  };
}

export function formatTodayChecklist(context) {
  const {
    user,
    profile,
    communityOverview,
    rpgStatus,
    swordStatus,
    seasonOverview,
    seasonChallenges,
    notice,
    now
  } = context;
  const today = getDayIndex(now);
  const fortuneDay = getDayIndex(now, FORTUNE_DAY_OFFSET_MS);
  const dailyClaimed = profile.lastDailyDay === today;
  const fortuneClaimed = profile.lastFortuneXpDay === fortuneDay;
  const communityDaily = communityOverview?.missions?.daily ?? [];
  const communityWeekly = communityOverview?.missions?.weekly ?? [];
  const communityClaimable = getClaimableCommunityMissions(communityDaily);
  const rpgClaimable = getClaimableRpgMissions(rpgStatus.dailyMissions);
  const recommended = getRecommendedActions({
    dailyClaimed,
    fortuneClaimed,
    communityClaimable,
    rpgClaimable,
    rpgStatus,
    swordStatus
  });
  const seasonClaimableRewards = seasonOverview?.rewards?.filter((reward) => reward.claimable) ?? [];
  const seasonClaimableChallenges = getClaimableSeasonChallenges(seasonChallenges);

  return [
    `🗓️ **오늘 할 일** — ${user.username}`,
    notice ? `> ${notice}` : null,
    '',
    '🎁 **일일 보상**',
    `${dailyClaimed ? '✅' : '🎁'} **출석 보상** — ${dailyClaimed ? `수령 완료 · 연속 ${profile.dailyStreak.toLocaleString()}일` : '수령 가능'} (\`/출석\`)`,
    `${fortuneClaimed ? '✅' : '⬜'} **운세 XP** — ${fortuneClaimed ? '오늘 XP 수령 완료' : '오늘 운세 보고 XP 받기'} (\`/운세\`)`,
    `${communityClaimable.length > 0 ? '🎁' : getCompletedCount(communityDaily) === communityDaily.length && communityDaily.length > 0 ? '✅' : '⬜'} **커뮤니티 일일 미션** — ${formatCommunityMissionSummary(communityDaily)} (\`/미션 종류:일일\`)`,
    communityWeekly.length > 0
      ? `📆 **주간 미션** — ${formatCommunityMissionSummary(communityWeekly)} (\`/미션 종류:주간\`)`
      : null,
    '',
    '🎮 **RPG 루틴**',
    `${rpgClaimable.length > 0 ? '🎁' : getClaimedCount(rpgStatus.dailyMissions) === rpgStatus.dailyMissions.length && rpgStatus.dailyMissions.length > 0 ? '✅' : '⬜'} **RPG 일일 의뢰** — ${formatRpgDailySummary(rpgStatus.dailyMissions)} (\`/rpg 일일\`)`,
    `${rpgStatus.cooldownRemainingMs > 0 ? '⏳' : '⚔️'} **RPG 전투/탐험** — ${formatRpgActionHint(rpgStatus)}`,
    '',
    '🗡️ **검 강화 루틴**',
    swordStatus
      ? `${swordStatus.giftAvailable ? '🎁' : '✅'} **검 선물** — ${swordStatus.giftAvailable ? '제련석 수령 가능' : `수령 완료 · 다음 ${formatDuration(swordStatus.giftRemainingMs)}`} (\`/선물받기\`)`
      : '- 검 정보를 불러오지 못했습니다.',
    swordStatus
      ? `⚔️ **검배틀** — 오늘 남은 횟수 **${swordStatus.battleRemaining.toLocaleString()}회** / 제련석 보상 한도 **${swordStatus.battleStoneRemaining.toLocaleString()}개** (\`/검배틀\`)`
      : null,
    '',
    '🏆 **시즌 이벤트**',
    seasonOverview
      ? `🏆 **시즌 포인트** — 누적 **${seasonOverview.profile.totalPoints.toLocaleString()}점** / 오늘 **${seasonOverview.daily.earned.toLocaleString()}점** 획득 (\`/시즌 정보\`)`
      : '- 시즌 정보를 불러오지 못했습니다.',
    seasonOverview
      ? `${seasonClaimableRewards.length > 0 ? '🎁' : '⬜'} **시즌 보상** — ${formatSeasonRewardSummary(seasonOverview.rewards)} (\`/시즌 보상\`)`
      : null,
    seasonChallenges
      ? `${seasonClaimableChallenges.length > 0 ? '🎁' : '⬜'} **시즌 과제** — ${formatSeasonChallengeSummary(seasonChallenges)} (\`/시즌 과제\`)`
      : null,
    '',
    '🏫 **학교/생활**',
    '- 🍚 `/급식` — 오늘 인천과학고 급식 확인',
    '- 🗓️ `/시간표 학년:1 반:1` — 오늘/이번 주 컴시간 확인',
    '',
    '💸 **경제 체크**',
    '- 💱 `/재화정보` — 통합 골드 사용처와 기존 지갑 정산 기준 확인',
    '- 📈 `/주식 시세` · `/카지노정보` — 현금/카지노칩 쓰기 전 체크',
    '',
    `추천 순서: ${recommended.join(' → ')}`
  ].filter((line) => line !== null).join('\n');
}

function createTodayRows(context) {
  const { user, profile, now, communityOverview, rpgStatus } = context;
  const dailyClaimed = profile.lastDailyDay === getDayIndex(now);
  const communityClaimable = getClaimableCommunityMissions(communityOverview?.missions?.daily ?? []);
  const rows = [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`today_checkin:${user.id}`)
        .setLabel(dailyClaimed ? '출석 완료' : '출석 받기')
        .setStyle(dailyClaimed ? ButtonStyle.Secondary : ButtonStyle.Success)
        .setDisabled(dailyClaimed),
      new ButtonBuilder()
        .setCustomId(`today_missions:${user.id}`)
        .setLabel(communityClaimable.length > 0 ? `미션 보상 ${communityClaimable.length}개` : '미션 보상 없음')
        .setStyle(communityClaimable.length > 0 ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setDisabled(communityClaimable.length === 0),
      new ButtonBuilder()
        .setCustomId(`today_refresh:${user.id}`)
        .setLabel('새로고침')
        .setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`rpg_quick:${user.id}:daily`)
        .setLabel(getClaimableRpgMissions(rpgStatus.dailyMissions).length > 0 ? 'RPG 일일 보상' : 'RPG 일일판')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`rpg_quick:${user.id}:menu`)
        .setLabel('RPG 메뉴')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`rpg_quick:${user.id}:battle`)
        .setLabel('RPG 전투')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(rpgStatus.cooldownRemainingMs > 0),
      new ButtonBuilder()
        .setCustomId(`rpg_quick:${user.id}:rest`)
        .setLabel('RPG 휴식')
        .setStyle(ButtonStyle.Secondary)
    )
  ];

  return rows.slice(0, 5);
}

function formatDailyClaimNotice(result) {
  if (!result.claimed) {
    return `이미 출석 보상을 받았습니다. 남은 시간: ${formatDuration(result.remainingMs)}`;
  }

  const streakText = result.streak > 1
    ? ` · 연속 ${result.streak.toLocaleString()}일`
    : '';
  return `✅ 출석 완료: +${result.xpGained.toLocaleString()} XP, +${result.reward.toLocaleString()}원${streakText}`;
}

function formatCommunityMissionClaimNotice(result) {
  const claimed = result.claimed ?? [];
  if (claimed.length === 0) {
    return '수령 가능한 커뮤니티 일일 미션 보상이 없습니다.';
  }

  return `📋 커뮤니티 일일 미션 보상 수령: ${claimed.map((mission) => mission.title).join(', ')} · +${result.totalXp.toLocaleString()} XP, +${result.totalCoins.toLocaleString()}원`;
}

function formatCommunityMissionSummary(missions = []) {
  if (missions.length === 0) return '데이터 없음';
  const claimable = getClaimableCommunityMissions(missions);
  if (claimable.length > 0) {
    return `보상 가능 **${claimable.length.toLocaleString()}개** (${claimable.map((mission) => mission.title).join(', ')})`;
  }

  return `진행 **${getCompletedCount(missions)}/${missions.length}개** · 수령 **${getClaimedCount(missions)}/${missions.length}개**`;
}

function formatRpgDailySummary(missions = []) {
  if (missions.length === 0) return '데이터 없음';
  const claimable = getClaimableRpgMissions(missions);
  if (claimable.length > 0) {
    return `보상 가능 **${claimable.length.toLocaleString()}개** (${claimable.map((mission) => mission.label).join(', ')})`;
  }

  return `진행 **${missions.filter((mission) => mission.complete).length}/${missions.length}개** · 수령 **${getClaimedCount(missions)}/${missions.length}개**`;
}

function formatRpgActionHint(rpgStatus) {
  if (rpgStatus.cooldownRemainingMs > 0) {
    return `전투 대기 ${formatDuration(rpgStatus.cooldownRemainingMs)} · 그동안 \`/rpg 탐사\`, \`/rpg 장비\``;
  }

  return `${rpgStatus.currentArea?.label ?? '현재 지역'}에서 전투 가능 (\`/rpg 사냥\` 또는 \`/rpg 탐사\`)`;
}

function getRecommendedActions({
  dailyClaimed,
  fortuneClaimed,
  communityClaimable,
  rpgClaimable,
  rpgStatus,
  swordStatus
}) {
  const actions = [];
  if (!dailyClaimed) actions.push('`/출석`');
  if (!fortuneClaimed) actions.push('`/운세`');
  if (communityClaimable.length > 0) actions.push('`/미션 종류:일일`');
  if (rpgClaimable.length > 0) actions.push('`/rpg 일일`');
  if (swordStatus?.giftAvailable) actions.push('`/선물받기`');
  if (rpgStatus.cooldownRemainingMs <= 0) actions.push('`/rpg 사냥`');

  return actions.length > 0 ? actions.slice(0, 4) : ['할 일 거의 끝남', '`/급식`', '`/시간표`'];
}

function formatSeasonRewardSummary(rewards = []) {
  const claimable = rewards.filter((reward) => reward.claimable);
  if (claimable.length > 0) {
    return `수령 가능 **${claimable.length.toLocaleString()}개** (${claimable.map((reward) => reward.label).join(', ')})`;
  }

  const claimed = rewards.filter((reward) => reward.claimed).length;
  return `수령 **${claimed}/${rewards.length}개**`;
}

function getClaimableSeasonChallenges(challenges) {
  return [...(challenges?.daily ?? []), ...(challenges?.weekly ?? [])]
    .filter((challenge) => challenge.claimable);
}

function formatSeasonChallengeSummary(challenges) {
  const daily = challenges.daily ?? [];
  const weekly = challenges.weekly ?? [];
  const claimable = getClaimableSeasonChallenges(challenges);

  return [
    `오늘 ${getCompletedCount(daily)}/${daily.length}개`,
    `주간 ${getCompletedCount(weekly)}/${weekly.length}개`,
    claimable.length > 0 ? `보상 가능 **${claimable.length.toLocaleString()}개**` : '보상 가능 없음'
  ].join(' · ');
}

function getClaimableCommunityMissions(missions = []) {
  return missions.filter((mission) => mission.completed && !mission.claimed);
}

function getClaimableRpgMissions(missions = []) {
  return missions.filter((mission) => mission.canClaim);
}

function getCompletedCount(missions = []) {
  return missions.filter((mission) => mission.completed || mission.complete).length;
}

function getClaimedCount(missions = []) {
  return missions.filter((mission) => mission.claimed).length;
}

function getDayIndex(now, offsetMs = 0) {
  return Math.floor((now + offsetMs) / DAY_MS);
}
