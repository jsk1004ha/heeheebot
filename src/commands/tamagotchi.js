import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder
} from 'discord.js';
import {
  formatStatBar,
  TAMAGOTCHI_ACTIONS,
  TAMAGOTCHI_FRIEND_ACTIONS,
  TAMAGOTCHI_LEISURES,
  TAMAGOTCHI_ROOM_ITEMS
} from '../systems/tamagotchi.js';
import {
  getTamagotchiDecorationAttachment,
  getTamagotchiDecorations,
  getTamagotchiStageSkinAttachment,
  getTamagotchiSkins
} from '../systems/tamagotchi-assets.js';

const BUTTON_PREFIX = 'heejin_pet';
const STATUS_COLOR = 0xff9fca;
const SICK_COLOR = 0xffc857;
const DEAD_COLOR = 0x4b3038;
const LEISURE_CHOICES = Object.values(TAMAGOTCHI_LEISURES).map((leisure) => ({
  name: leisure.label,
  value: leisure.id
}));
const ROOM_ITEM_CHOICES = TAMAGOTCHI_ROOM_ITEMS.map((item) => ({
  name: `${item.emoji} ${item.label} · ${item.cost}조각`,
  value: item.id
}));
const FRIEND_ACTION_CHOICES = Object.values(TAMAGOTCHI_FRIEND_ACTIONS).map((action) => ({
  name: `${action.emoji} ${action.label}`,
  value: action.id
}));

export const tamagotchiCommands = [
  new SlashCommandBuilder()
    .setName('희진다마고치')
    .setDescription('귀여운 도트 희진 다마고치를 돌보고 버튼 UI를 엽니다.')
    .addStringOption((option) =>
      option
        .setName('행동')
        .setDescription('바로 실행할 케어 행동. 비우면 상태와 버튼을 보여줍니다.')
        .addChoices(
          { name: '상태 보기', value: 'status' },
          { name: '밥주기', value: 'feed' },
          { name: '놀아주기', value: 'play' },
          { name: '씻기기', value: 'clean' },
          { name: '재우기', value: 'nap' },
          { name: '약주기', value: 'medicine' },
          { name: '부활', value: 'revive' }
        )
    ),
  new SlashCommandBuilder()
    .setName('희진스킨')
    .setDescription('희진 다마고치의 도트 스킨을 장착합니다.')
    .addStringOption((option) => {
      option
        .setName('스킨')
        .setDescription('장착할 스킨')
        .setRequired(true)
        .setAutocomplete(true);
      return option;
    }),
  new SlashCommandBuilder()
    .setName('희진꾸미기')
    .setDescription('희진 주변 도구/장식 이미지를 장착합니다.')
    .addStringOption((option) => {
      option
        .setName('장식')
        .setDescription('장착할 꾸미기 아이템')
        .setRequired(true)
        .setAutocomplete(true);
      return option;
    }),
  new SlashCommandBuilder()
    .setName('희진여가')
    .setDescription('희진에게 릴스보기, 희희봇하기, 디맥하기 같은 여가를 시켜줍니다.')
    .addStringOption((option) =>
      option
        .setName('종류')
        .setDescription('시켜줄 여가')
        .setRequired(true)
        .addChoices(...LEISURE_CHOICES)
    )
  ,
  new SlashCommandBuilder()
    .setName('희진방')
    .setDescription('희진 방 인테리어를 보고 추억 조각으로 아이템을 해금/장착합니다.')
    .addStringOption((option) =>
      option
        .setName('행동')
        .setDescription('방에서 할 행동')
        .addChoices(
          { name: '방 보기', value: 'view' },
          { name: '추천 아이템 해금', value: 'unlock_next' },
          { name: '아이템 해금', value: 'unlock' },
          { name: '아이템 장착', value: 'equip' }
        )
    )
    .addStringOption((option) =>
      option
        .setName('아이템')
        .setDescription('해금하거나 장착할 방 아이템')
        .addChoices(...ROOM_ITEM_CHOICES)
    ),
  new SlashCommandBuilder()
    .setName('희진앨범')
    .setDescription('희진 성장 분기, 랜덤 사건, 방 아이템 발견 앨범을 봅니다.'),
  new SlashCommandBuilder()
    .setName('희진일기')
    .setDescription('희진의 최근 케어/사건/방문 기록을 일기 카드로 봅니다.'),
  new SlashCommandBuilder()
    .setName('희진방문')
    .setDescription('다른 유저의 희진 방에 방문해 하루 한 번 상호작용합니다.')
    .addUserOption((option) =>
      option
        .setName('유저')
        .setDescription('방문할 희진의 주인')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('행동')
        .setDescription('방문해서 할 행동')
        .addChoices(...FRIEND_ACTION_CHOICES)
    ),
  new SlashCommandBuilder()
    .setName('희진퀘스트')
    .setDescription('성년기 이후 분기별 희진 퀘스트를 확인하고 보상을 받습니다.')
    .addStringOption((option) =>
      option
        .setName('행동')
        .setDescription('퀘스트 행동')
        .addChoices(
          { name: '퀘스트 보기', value: 'view' },
          { name: '보상 받기', value: 'claim' }
        )
    )
];

export function getTamagotchiCommandPayloads() {
  return tamagotchiCommands.map((command) => command.toJSON());
}

export async function handleTamagotchiAutocomplete(interaction) {
  if (!interaction.isAutocomplete?.()) return false;
  if (!['희진스킨', '희진꾸미기'].includes(interaction.commandName)) return false;

  const focused = interaction.options.getFocused(true);
  const catalog = interaction.commandName === '희진스킨'
    ? getTamagotchiSkins()
    : getTamagotchiDecorations();

  await interaction.respond(filterAutocompleteChoices(catalog, focused.value));
  return true;
}

export async function handleTamagotchiCommand(interaction, tamagotchi, logger = console) {
  if (interaction.isButton?.()) {
    return handleTamagotchiButton(interaction, tamagotchi, logger);
  }

  if (!interaction.isChatInputCommand?.() || !isTamagotchiCommand(interaction.commandName)) {
    return false;
  }

  if (!interaction.inGuild?.()) {
    await interaction.reply({
      content: '희진 다마고치는 서버에서만 사용할 수 있어요.',
      ephemeral: true
    });
    return true;
  }

  try {
    await routeTamagotchiCommand(interaction, tamagotchi);
  } catch (error) {
    logger.error(error);
    await safeReply(interaction, `희진 다마고치 처리 실패: ${error.message}`, true);
  }

  return true;
}

export function createTamagotchiReplyPayload(user, result) {
  const skinAttachment = getTamagotchiStageSkinAttachment(
    result.pet.cosmetic.skinId,
    result.growthStage?.id
  );
  const decorationAttachment = getTamagotchiDecorationAttachment(result.pet.cosmetic.decorationId);
  const files = [skinAttachment, decorationAttachment].filter(Boolean);
  const screen = getTamagotchiScreen(user, result);
  const embed = new EmbedBuilder()
    .setTitle(screen.title)
    .setDescription(screen.description)
    .setColor(resolveStatusColor(result.pet))
    .setFooter({ text: '버튼은 주인만 누를 수 있어요 · 방치/질병을 오래 두면 사망합니다' });

  if (skinAttachment) embed.setImage(`attachment://${skinAttachment.name}`);
  if (decorationAttachment) embed.setThumbnail(`attachment://${decorationAttachment.name}`);

  return {
    content: result.eventMessage ?? undefined,
    embeds: [embed],
    files,
    components: createTamagotchiActionRows(user.id, result)
  };
}

async function routeTamagotchiCommand(interaction, tamagotchi) {
  const action = interaction.options.getString('행동') ?? 'status';
  const context = interactionContext(interaction);

  if (interaction.commandName === '희진다마고치') {
    const result = action === 'status'
      ? await tamagotchi.getStatus(context)
      : await tamagotchi.care({ ...context, action });
    await interaction.reply(createTamagotchiReplyPayload(interaction.user, result));
    return;
  }

  if (interaction.commandName === '희진스킨') {
    const skinId = interaction.options.getString('스킨', true);
    const result = await tamagotchi.equipSkin({ ...context, skinId });
    await interaction.reply(createTamagotchiReplyPayload(interaction.user, result));
    return;
  }

  if (interaction.commandName === '희진꾸미기') {
    const decorationId = interaction.options.getString('장식', true);
    const result = await tamagotchi.equipDecoration({ ...context, decorationId });
    await interaction.reply(createTamagotchiReplyPayload(interaction.user, result));
    return;
  }

  if (interaction.commandName === '희진여가') {
    const leisureId = interaction.options.getString('종류', true);
    const result = await tamagotchi.leisure({ ...context, leisureId });
    await interaction.reply(createTamagotchiReplyPayload(interaction.user, result));
    return;
  }

  if (interaction.commandName === '희진방') {
    const roomAction = interaction.options.getString('행동') ?? 'view';
    const itemId = interaction.options.getString('아이템');
    const result = roomAction === 'unlock_next'
      ? await tamagotchi.unlockNextRoomItem(context)
      : roomAction === 'unlock'
        ? await tamagotchi.unlockRoomItem({ ...context, itemId })
        : roomAction === 'equip'
          ? await tamagotchi.equipRoomItem({ ...context, itemId })
          : await tamagotchi.getRoom(context);
    await interaction.reply(createTamagotchiReplyPayload(interaction.user, result));
    return;
  }

  if (interaction.commandName === '희진앨범') {
    const result = await tamagotchi.getAlbum(context);
    await interaction.reply(createTamagotchiReplyPayload(interaction.user, result));
    return;
  }

  if (interaction.commandName === '희진일기') {
    const result = await tamagotchi.getJournal(context);
    await interaction.reply(createTamagotchiReplyPayload(interaction.user, result));
    return;
  }

  if (interaction.commandName === '희진방문') {
    const target = interaction.options.getUser('유저', true);
    const result = await tamagotchi.visitFriend({
      ...context,
      targetUserId: target.id,
      targetUsername: target.username,
      action: interaction.options.getString('행동') ?? 'pet'
    });
    await interaction.reply(createTamagotchiReplyPayload(target, result));
    return;
  }

  if (interaction.commandName === '희진퀘스트') {
    const questAction = interaction.options.getString('행동') ?? 'view';
    const result = questAction === 'claim'
      ? await tamagotchi.claimAdultQuest(context)
      : await tamagotchi.getAdultQuest(context);
    await interaction.reply(createTamagotchiReplyPayload(interaction.user, result));
  }
}

async function handleTamagotchiButton(interaction, tamagotchi, logger) {
  const parsed = parseTamagotchiCustomId(interaction.customId);
  if (!parsed) return false;

  if (!interaction.inGuild?.()) {
    await interaction.reply({ content: '서버에서만 사용할 수 있는 버튼입니다.', ephemeral: true });
    return true;
  }

  if (parsed.userId !== interaction.user.id) {
    await interaction.reply({
      content: '이 희진 다마고치 버튼은 주인만 누를 수 있어요. `/희진다마고치`로 내 희진을 불러와 주세요.',
      ephemeral: true
    });
    return true;
  }

  try {
    const context = interactionContext(interaction);
    const result = await resolveButtonAction(parsed.action, tamagotchi, context);
    await interaction.update(createTamagotchiReplyPayload(interaction.user, result));
  } catch (error) {
    logger.error(error);
    await safeReply(interaction, `희진 버튼 처리 실패: ${error.message}`, true);
  }

  return true;
}

async function resolveButtonAction(action, tamagotchi, context) {
  if (action === 'refresh') return tamagotchi.getStatus(context);
  if (action === 'skin') return tamagotchi.cycleSkin(context);
  if (action === 'decor') return tamagotchi.cycleDecoration(context);
  if (action === 'room') return tamagotchi.getRoom(context);
  if (action === 'room_unlock') return tamagotchi.unlockNextRoomItem(context);
  if (action === 'album') return tamagotchi.getAlbum(context);
  if (action === 'journal') return tamagotchi.getJournal(context);
  if (action === 'quest') return tamagotchi.getAdultQuest(context);
  if (action === 'quest_claim') return tamagotchi.claimAdultQuest(context);
  if (action.startsWith('leisure_')) {
    return tamagotchi.leisure({ ...context, leisureId: action.slice('leisure_'.length) });
  }
  return tamagotchi.care({ ...context, action });
}

function createTamagotchiActionRows(userId, result) {
  const dead = result.pet.status === 'dead';
  return [
    new ActionRowBuilder().addComponents(
      button('feed', userId, '밥주기', '🍚', ButtonStyle.Success, isActionDisabled(result, 'feed', dead)),
      button('play', userId, '놀아주기', '🧸', ButtonStyle.Primary, isActionDisabled(result, 'play', dead)),
      button('clean', userId, '씻기기', '🫧', ButtonStyle.Primary, isActionDisabled(result, 'clean', dead)),
      button('nap', userId, '재우기', '💤', ButtonStyle.Secondary, isActionDisabled(result, 'nap', dead)),
      button('medicine', userId, '약주기', '💊', ButtonStyle.Secondary, isActionDisabled(result, 'medicine', dead))
    ),
    new ActionRowBuilder().addComponents(
      button('skin', userId, '스킨변경', '🎨', ButtonStyle.Secondary, false),
      button('decor', userId, '꾸미기', '🧸', ButtonStyle.Secondary, false),
      button('refresh', userId, '새로고침', '🔄', ButtonStyle.Secondary, false),
      button('revive', userId, '부활', '✨', ButtonStyle.Danger, !dead)
    ),
    new ActionRowBuilder().addComponents(
      button('leisure_reels', userId, '릴스보기', '📱', ButtonStyle.Primary, isLeisureDisabled(result, 'reels', dead)),
      button('leisure_heeheebot', userId, '희희봇', '🤖', ButtonStyle.Primary, isLeisureDisabled(result, 'heeheebot', dead)),
      button('leisure_djmax', userId, '디맥하기', '🎹', ButtonStyle.Primary, isLeisureDisabled(result, 'djmax', dead)),
      button('leisure_walk', userId, '산책', '🚶', ButtonStyle.Secondary, isLeisureDisabled(result, 'walk', dead))
    ),
    new ActionRowBuilder().addComponents(
      button('leisure_music', userId, '음악듣기', '🎧', ButtonStyle.Secondary, isLeisureDisabled(result, 'music', dead)),
      button('leisure_monkey', userId, '원숭이', '🐒', ButtonStyle.Secondary, isLeisureDisabled(result, 'monkey', dead)),
      button('leisure_tease_monkey', userId, '원숭이괴롭히기', '🙈', ButtonStyle.Secondary, isLeisureDisabled(result, 'tease_monkey', dead))
    ),
    createTamagotchiNavigationRow(userId, result)
  ];
}

function createTamagotchiNavigationRow(userId, result) {
  if (result.view === 'room') {
    return new ActionRowBuilder().addComponents(
      button('room_unlock', userId, '다음해금', '🧩', ButtonStyle.Success, !result.room?.nextUnlock),
      button('room', userId, '희진방', '🏠', ButtonStyle.Primary, false),
      button('album', userId, '앨범', '📚', ButtonStyle.Secondary, false),
      button('journal', userId, '일기', '📖', ButtonStyle.Secondary, false),
      button('refresh', userId, '상태', '🔄', ButtonStyle.Secondary, false)
    );
  }

  if (result.view === 'quest') {
    return new ActionRowBuilder().addComponents(
      button('quest_claim', userId, '퀘보상', '🏆', ButtonStyle.Success, !result.adultQuest?.complete || result.adultQuest?.rewardClaimed),
      button('room', userId, '희진방', '🏠', ButtonStyle.Secondary, false),
      button('album', userId, '앨범', '📚', ButtonStyle.Secondary, false),
      button('journal', userId, '일기', '📖', ButtonStyle.Secondary, false),
      button('refresh', userId, '상태', '🔄', ButtonStyle.Secondary, false)
    );
  }

  return new ActionRowBuilder().addComponents(
    button('room', userId, '희진방', '🏠', ButtonStyle.Primary, false),
    button('album', userId, '앨범', '📚', ButtonStyle.Secondary, false),
    button('journal', userId, '일기', '📖', ButtonStyle.Secondary, false),
    button('quest', userId, '성년퀘', '🏆', ButtonStyle.Secondary, false),
    button('refresh', userId, '새로고침', '🔄', ButtonStyle.Secondary, false)
  );
}

function isActionDisabled(result, action, dead) {
  if (dead) return true;
  return Number(result.cooldowns?.actions?.[action]?.remainingMs ?? 0) > 0;
}

function isLeisureDisabled(result, leisureId, dead) {
  if (dead) return true;
  return Number(result.cooldowns?.leisure?.[leisureId]?.remainingMs ?? 0) > 0;
}

function button(action, userId, label, emoji, style, disabled = false) {
  return new ButtonBuilder()
    .setCustomId(`${BUTTON_PREFIX}:${action}:${userId}`)
    .setLabel(label)
    .setEmoji(emoji)
    .setStyle(style)
    .setDisabled(disabled);
}

function getTamagotchiScreen(user, result) {
  if (result.view === 'room') {
    return {
      title: `🏠 희진 방 — ${user?.username ?? result.pet.username}님의 ${result.pet.name}`,
      description: formatTamagotchiRoom(result)
    };
  }
  if (result.view === 'album') {
    return {
      title: `📚 추억 앨범 — ${result.pet.name}`,
      description: formatTamagotchiAlbum(result)
    };
  }
  if (result.view === 'journal') {
    return {
      title: `📖 희진 일기 — ${result.pet.name}`,
      description: formatTamagotchiJournal(result)
    };
  }
  if (result.view === 'quest') {
    return {
      title: `🏆 성년기 퀘스트 — ${result.pet.name}`,
      description: formatTamagotchiQuest(result)
    };
  }
  return {
    title: `🐣 희진 다마고치 — ${result.pet.name} (${result.growthStage?.label ?? '성장 중'})`,
    description: formatTamagotchiStatus(user, result)
  };
}

function formatTamagotchiStatus(user, result) {
  const { pet, mood, skin, decoration, growthBranch, growthProfile } = result;
  const stats = pet.stats;
  const deathLine = pet.status === 'dead'
    ? `\n💀 사망 이유: **${pet.deathReason ?? '알 수 없음'}**\n✨ **부활** 버튼을 누르면 다시 시작할 수 있어요.`
    : '';
  const illnessLine = pet.conditions?.sick && pet.status !== 'dead'
    ? `\n🤒 병듦: **${pet.conditions.illnessReason ?? '컨디션 악화'}** — **약주기**와 기본 케어가 필요해요.`
    : '';
  const favoriteLeisure = getFavoriteLeisure(pet);

  return [
    `${user}님의 도트 희진입니다.${deathLine}${illnessLine}`,
    '',
    `${mood.emoji} 상태: **${mood.label}** · 성장: **${result.growthStage?.label ?? '알 수 없음'}** · 나이: **${result.ageDays}일**`,
    `🌱 성장 분기: **${growthBranch?.label ?? '분기 전'}** · 만족도 **${growthProfile?.satisfactionScore ?? 0}점** · 특화 **${formatDominantTrait(growthProfile?.dominantTrait)}**`,
    `🎯 추천 행동: ${formatRecommendations(result.recommendations)}`,
    `📋 오늘의 돌봄: **${result.daily.completedCount}/${result.daily.totalCount}** ${formatDailyMissions(result.daily)}`,
    `📚 성장도감: **${result.codex.branchCount}/${result.codex.totalBranches}** · 사건도감 **${result.codex.eventCount}/${result.codex.totalEvents}** · 추억 조각 **${result.codex.memoryShards.toLocaleString()}개**`,
    result.nextGrowth?.complete
      ? '🌿 다음 성장: **성년기 도달**'
      : `🌿 다음 성장: **${result.nextGrowth?.label ?? '알 수 없음'}**까지 약 **${result.nextGrowth?.remainingDays ?? 0}일**`,
    pet.status === 'dead' ? '방치 사망까지: **이미 사망**' : `방치 사망까지: **${result.neglectRemaining}**`,
    '',
    `🍚 배부름 ${formatStatBar(stats.fullness)} **${Math.round(stats.fullness)}**`,
    `😊 행복 ${formatStatBar(stats.happiness)} **${Math.round(stats.happiness)}**`,
    `🫧 청결 ${formatStatBar(stats.cleanliness)} **${Math.round(stats.cleanliness)}**`,
    `💤 에너지 ${formatStatBar(stats.energy)} **${Math.round(stats.energy)}**`,
    `💊 건강 ${formatStatBar(stats.health)} **${Math.round(stats.health)}**`,
    `💖 애정 ${formatStatBar(stats.affection)} **${Math.round(stats.affection)}**`,
    '',
    `🎨 스킨: **${skin?.label ?? pet.cosmetic.skinId}**`,
    `🧸 꾸미기: **${decoration?.label ?? pet.cosmetic.decorationId}**`,
    `🎮 최애 여가: **${favoriteLeisure}**`,
    `총 케어: **${pet.counters.totalCareActions.toLocaleString()}회** / 부활: **${pet.counters.revivals.toLocaleString()}회**`,
    formatRecentEvents(result.recentEvents)
  ].join('\n');
}

function formatTamagotchiRoom(result) {
  const nextUnlock = result.room.nextUnlock
    ? `${result.room.nextUnlock.emoji} **${result.room.nextUnlock.label}** · 추억 조각 ${result.room.nextUnlock.cost}개`
    : '모든 방 아이템 해금 완료';
  const slots = result.room.slots
    .map((slot) => `${slot.item ? slot.item.emoji : '▫️'} ${slot.label}: **${slot.item?.label ?? '비어 있음'}**`)
    .join('\n');

  return [
    `희진 방은 **추억 조각**으로 꾸미는 장기 목표예요. 골드는 쓰지 않습니다.`,
    `해금: **${result.room.unlockedCount}/${result.room.totalItems}** · 안락도 **${result.room.comfortScore}점** · 남은 조각 **${result.codex.memoryShards.toLocaleString()}개**`,
    `다음 추천 해금: ${nextUnlock}`,
    '',
    slots,
    '',
    `최근 추억: ${formatRecentEvents(result.recentEvents)}`
  ].join('\n');
}

function formatTamagotchiAlbum(result) {
  const branchLines = result.album.branches
    .slice(0, 6)
    .map((item) => `${item.discovered ? '✅' : '⬜'} **${item.title}**`)
    .join('\n');
  const eventLines = result.album.events
    .map((item) => `${item.discovered ? '✅' : '⬜'} **${item.title}**`)
    .join('\n');
  const roomLines = result.album.roomItems
    .slice(0, 8)
    .map((item) => `${item.discovered ? '✅' : '⬜'} **${item.title}**`)
    .join('\n');

  return [
    `성장도감 **${result.codex.branchCount}/${result.codex.totalBranches}** · 사건도감 **${result.codex.eventCount}/${result.codex.totalEvents}** · 방 아이템 **${result.codex.roomItemCount}/${result.codex.totalRoomItems}**`,
    '',
    '🌱 **성장 앨범**',
    branchLines,
    '',
    '🎲 **사건 앨범**',
    eventLines,
    '',
    '🏠 **방 앨범**',
    roomLines
  ].join('\n');
}

function formatTamagotchiJournal(result) {
  const entries = result.journal.entries.length > 0
    ? result.journal.entries
        .map((entry) => `- **${entry.title}**: ${entry.message}`)
        .join('\n')
    : '아직 기록된 일기가 없습니다. 밥주기/여가/방문/방꾸미기를 해보세요.';

  return [
    `최근 기록 **${result.journal.entries.length}/${result.journal.totalEntries}**`,
    '',
    entries
  ].join('\n');
}

function formatTamagotchiQuest(result) {
  const quest = result.adultQuest;
  const requirements = quest.requirements
    .map((requirement) => `${requirement.complete ? '✅' : '⬜'} ${requirement.label}: **${Math.min(requirement.current, requirement.required)}/${requirement.required}**`)
    .join('\n');
  const state = !quest.stageReady
    ? '성년기 이후 열림'
    : quest.rewardClaimed
      ? '보상 수령 완료'
      : quest.complete
        ? '보상 수령 가능'
        : '진행 중';

  return [
    `상태: **${state}** · 분기: **${result.growthBranch?.label ?? '분기 전'}**`,
    `퀘스트: **${quest.label}**`,
    quest.description,
    '',
    requirements,
    '',
    `보상: 추억 조각 **${quest.reward.memoryShards}개** + **${quest.reward.roomItemLabel}**`,
    quest.complete && !quest.rewardClaimed ? '`/희진퀘스트 행동:보상 받기` 또는 **퀘보상** 버튼으로 받을 수 있어요.' : ''
  ].filter(Boolean).join('\n');
}

function formatRecommendations(recommendations = []) {
  if (recommendations.length === 0) return '상태 안정 · 원하는 여가를 골라 주세요';
  return recommendations
    .map((item) => {
      const cooldown = item.cooldownRemainingMs > 0 ? ` (${formatShortDuration(item.cooldownRemainingMs)} 대기)` : '';
      return `${item.emoji} **${item.label}**${cooldown}`;
    })
    .join(' / ');
}

function formatDailyMissions(daily) {
  return daily.missions
    .map((mission) => `${mission.completed ? '✅' : '⬜'}${mission.emoji}`)
    .join(' ');
}

function formatRecentEvents(events = []) {
  if (!events.length) return '📝 최근 추억: **아직 없음**';
  return `📝 최근 추억: ${events.map((event) => `**${event.title}**`).join(' · ')}`;
}

function parseTamagotchiCustomId(customId) {
  const [prefix, action, userId] = String(customId ?? '').split(':');
  if (prefix !== BUTTON_PREFIX || !action || !userId) return null;
  const allowedActions = new Set([
    ...Object.keys(TAMAGOTCHI_ACTIONS),
    ...Object.keys(TAMAGOTCHI_LEISURES).map((id) => `leisure_${id}`),
    'refresh',
    'skin',
    'decor',
    'room',
    'room_unlock',
    'album',
    'journal',
    'quest',
    'quest_claim'
  ]);
  if (!allowedActions.has(action)) return null;
  return { action, userId };
}

function resolveStatusColor(pet) {
  if (pet.status === 'dead') return DEAD_COLOR;
  if (pet.conditions?.sick) return SICK_COLOR;
  return STATUS_COLOR;
}

function getFavoriteLeisure(pet) {
  const entries = Object.entries(pet.counters?.leisure ?? {});
  if (entries.length === 0) return '아직 없음';
  const [leisureId, count] = entries.sort((a, b) => b[1] - a[1])[0];
  if (count <= 0) return '아직 없음';
  return `${TAMAGOTCHI_LEISURES[leisureId]?.label ?? leisureId} ${count.toLocaleString()}회`;
}

function formatDominantTrait(trait) {
  const labels = {
    balanced: '균형',
    beloved: '애정',
    gourmet: '먹방',
    entertainer: '놀이',
    heeheebotter: '희희봇',
    rhythm: '디맥',
    tidy: '청결',
    dreamer: '수면',
    healthy: '건강',
    monkey: '원숭이',
    mischievous: '장난',
    fragile: '병약',
    neglected: '방치'
  };
  return labels[trait] ?? '아직 없음';
}

function formatShortDuration(ms) {
  const seconds = Math.max(0, Math.ceil(Number(ms) / 1000));
  const minutes = Math.floor(seconds / 60);
  if (minutes > 0) return `${minutes}분`;
  return `${seconds}초`;
}

function filterAutocompleteChoices(catalog, rawQuery) {
  const query = String(rawQuery ?? '').trim().toLowerCase();
  return catalog
    .filter((item) => {
      if (!query) return true;
      return [
        item.id,
        item.label,
        item.category,
        item.prompt
      ].some((value) => String(value ?? '').toLowerCase().includes(query));
    })
    .slice(0, 25)
    .map((item) => ({
      name: item.category ? `${item.label} · ${item.category}` : item.label,
      value: item.id
    }));
}

function interactionContext(interaction) {
  return {
    guildId: interaction.guildId,
    userId: interaction.user.id,
    username: interaction.user.username
  };
}

function isTamagotchiCommand(commandName) {
  return tamagotchiCommands.some((command) => command.name === commandName);
}

async function safeReply(interaction, content, ephemeral = false) {
  const payload = { content, ephemeral };
  if (interaction.deferred || interaction.replied) {
    await interaction.followUp(payload);
  } else {
    await interaction.reply(payload);
  }
}
