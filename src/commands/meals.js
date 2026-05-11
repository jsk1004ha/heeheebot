import {
  MessageFlags,
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder
} from 'discord.js';
import { formatDisplayDate } from '../systems/meals.js';

const MEAL_FILTERS = Object.freeze({
  all: '전체',
  1: '조식',
  2: '중식',
  3: '석식'
});

const MEAL_STYLES = Object.freeze({
  1: Object.freeze({ emoji: '🌅', vibe: '아침 부스터' }),
  2: Object.freeze({ emoji: '☀️', vibe: '점심 메인딜' }),
  3: Object.freeze({ emoji: '🌙', vibe: '저녁 회복팩' })
});

export const mealCommands = [
  new SlashCommandBuilder()
    .setName('급식')
    .setDescription('인천과학고등학교 오늘 급식을 알려줍니다.')
    .addStringOption((option) =>
      option
        .setName('식사')
        .setDescription('확인할 식사')
        .addChoices(
          { name: '전체', value: 'all' },
          { name: '조식', value: '1' },
          { name: '중식', value: '2' },
          { name: '석식', value: '3' }
        )
    ),
  new SlashCommandBuilder()
    .setName('자동급식')
    .setDescription('매일 00:00 급식 자동 알림 채널을 설정합니다.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('설정')
        .setDescription('급식 자동 알림을 보낼 채널을 설정합니다.')
        .addChannelOption((option) =>
          option
            .setName('채널')
            .setDescription('급식 자동 알림 채널')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('해제')
        .setDescription('급식 자동 알림을 해제합니다.')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('상태')
        .setDescription('급식 자동 알림 설정 상태를 확인합니다.')
    )
];

export function getMealCommandPayloads() {
  return mealCommands.map((command) => command.toJSON());
}

export async function handleMealCommand(interaction, meals) {
  if (!interaction.isChatInputCommand() || !['급식', '자동급식'].includes(interaction.commandName)) {
    return false;
  }

  if (interaction.commandName === '자동급식') {
    await handleAutoMealCommand(interaction, meals);
    return true;
  }

  try {
    const dailyMeals = await meals.getTodayMeals();
    const mealFilter = interaction.options.getString('식사') ?? 'all';
    await interaction.reply(formatMealMessage(dailyMeals, { mealFilter }));
  } catch (error) {
    await interaction.reply({
      content: `급식 정보를 불러오지 못했습니다: ${error.message}`,
      flags: MessageFlags.Ephemeral
    });
  }

  return true;
}

async function handleAutoMealCommand(interaction, meals) {
  if (!interaction.inGuild()) {
    await interaction.reply({
      content: '서버에서만 사용할 수 있는 명령어입니다.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === '설정') {
    if (!canManageGuild(interaction)) {
      await replyWithAutoMealPermissionError(interaction);
      return;
    }

    const channel = interaction.options.getChannel('채널', true);
    const settings = await meals.setAutoAnnouncementChannel(interaction.guildId, channel.id);
    await interaction.reply(
      `✅ 급식 자동 알림을 <#${settings.autoAnnouncementChannelId}> 채널로 설정했습니다. 매일 한국시간 00:00에 전송됩니다.`
    );
    return;
  }

  if (subcommand === '해제') {
    if (!canManageGuild(interaction)) {
      await replyWithAutoMealPermissionError(interaction);
      return;
    }

    await meals.disableAutoAnnouncement(interaction.guildId);
    await interaction.reply('✅ 급식 자동 알림을 해제했습니다.');
    return;
  }

  if (subcommand === '상태') {
    const settings = await meals.getAutoAnnouncementSettings(interaction.guildId);
    const content = settings.autoAnnouncementChannelId
      ? `🍱 급식 자동 알림: <#${settings.autoAnnouncementChannelId}> / 매일 한국시간 00:00`
      : '🍱 급식 자동 알림이 설정되어 있지 않습니다.';
    await interaction.reply({
      content,
      flags: MessageFlags.Ephemeral
    });
  }
}

function canManageGuild(interaction) {
  return Boolean(interaction.memberPermissions?.has?.(PermissionFlagsBits.ManageGuild));
}

async function replyWithAutoMealPermissionError(interaction) {
  await interaction.reply({
    content: '서버 관리 권한이 있어야 급식 자동 알림을 변경할 수 있습니다.',
    flags: MessageFlags.Ephemeral
  });
}

export function formatMealMessage(dailyMeals, { mealFilter = 'all' } = {}) {
  const normalizedMealFilter = normalizeMealFilter(mealFilter);
  const filterLabel = MEAL_FILTERS[normalizedMealFilter];
  const title = normalizedMealFilter === 'all' ? '급식' : `${filterLabel} 급식`;
  const header = [
    `🍱 **${dailyMeals.school.name} ${title}**`,
    `📅 \`${formatDisplayDate(dailyMeals.date)}\` · ${normalizedMealFilter === 'all' ? '오늘의 전체 식단' : `${filterLabel}만 보기`}`
  ].join('\n');
  const meals = normalizedMealFilter === 'all'
    ? dailyMeals.meals
    : dailyMeals.meals.filter((meal) => meal.mealCode === normalizedMealFilter);

  if (meals.length === 0) {
    return [
      header,
      `\n╭─ 🍽️ **${filterLabel === '전체' ? '급식' : filterLabel} 정보 없음**`,
      '│ 아직 NEIS에 등록된 급식 정보가 없습니다.',
      '╰─ 나중에 다시 확인해줘.'
    ].join('\n');
  }

  const sections = meals.map(formatMealSection);

  return [
    header,
    ...sections,
    '🍚 오늘도 맛있게 먹고 살아남자.',
    '🧾 괄호 안 숫자는 NEIS 알레르기 유발 식재료 번호입니다.'
  ].join('\n\n');
}

function formatMealSection(meal) {
  const style = MEAL_STYLES[meal.mealCode] ?? { emoji: '🍽️', vibe: '식사' };
  const calories = meal.calories ? ` · \`${meal.calories}\`` : '';
  const dishes = meal.dishes.length > 0
    ? meal.dishes.map((dish) => `│ • ${dish}`).join('\n')
    : '│ • 등록된 메뉴 없음';

  return [
    `╭─ ${style.emoji} **${meal.mealName}**${calories}`,
    `│ ${style.vibe}`,
    dishes,
    '╰────────────'
  ].join('\n');
}

function normalizeMealFilter(mealFilter) {
  const normalized = String(mealFilter ?? 'all');
  return Object.hasOwn(MEAL_FILTERS, normalized) ? normalized : 'all';
}
