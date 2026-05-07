import { SlashCommandBuilder } from 'discord.js';
import { WEEK_DAYS } from '../systems/timetable.js';

const WEEKDAY_CHOICES = Object.freeze([
  { name: '전체', value: 'all' },
  ...WEEK_DAYS.map((day) => ({ name: day, value: day }))
]);

export const timetableCommands = [
  new SlashCommandBuilder()
    .setName('시간표')
    .setDescription('인천과학고등학교 시간표를 학년/반별로 알려줍니다.')
    .addIntegerOption((option) =>
      option
        .setName('학년')
        .setDescription('조회할 학년')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(3)
    )
    .addIntegerOption((option) =>
      option
        .setName('반')
        .setDescription('조회할 반')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(30)
    )
    .addStringOption((option) =>
      option
        .setName('요일')
        .setDescription('조회할 요일')
        .addChoices(...WEEKDAY_CHOICES)
    )
];

export function getTimetableCommandPayloads() {
  return timetableCommands.map((command) => command.toJSON());
}

export async function handleTimetableCommand(interaction, timetable) {
  if (!interaction.isChatInputCommand() || interaction.commandName !== '시간표') {
    return false;
  }

  try {
    const grade = interaction.options.getInteger('학년', true);
    const classNumber = interaction.options.getInteger('반', true);
    const weekday = interaction.options.getString('요일') ?? 'all';

    await deferIfSupported(interaction);

    const result = await timetable.getTimetable({ grade, classNumber });

    await respondToTimetableInteraction(interaction, formatTimetableMessage(result, { weekday }));
  } catch (error) {
    await respondToTimetableInteraction(interaction, {
      content: `시간표 정보를 불러오지 못했습니다: ${error.message}`,
      ephemeral: true
    });
  }

  return true;
}

export function formatTimetableMessage(result, { weekday = 'all' } = {}) {
  const normalizedWeekday = normalizeWeekday(weekday);
  const days = normalizedWeekday === 'all' ? WEEK_DAYS : [normalizedWeekday];
  const metadata = [
    result.weekStartDate ? `시작일: ${result.weekStartDate}` : null,
    result.updatedAt ? `갱신: ${result.updatedAt}` : null
  ].filter(Boolean).join(' / ');
  const header = [
    `🗓️ **${result.school.name} ${result.className} 시간표**`,
    metadata || null
  ].filter(Boolean).join('\n');
  const sections = days.map((day) => formatDaySection(day, result.timetable?.[day] ?? []));
  const changed = sections.some((section) => section.includes('🔁'));
  const footer = changed ? '\n\n🔁 표시: 컴시간 기준으로 변경된 수업입니다.' : '';

  return `${header}\n\n${sections.join('\n\n')}${footer}`;
}

function formatDaySection(day, periods) {
  if (periods.length === 0) {
    return `**${day}**\n등록된 시간표가 없습니다.`;
  }

  const lines = periods.map((entry) => {
    const subject = entry.empty
      ? '-'
      : [entry.subject, entry.teacher ? `(${entry.teacher})` : null].filter(Boolean).join(' ');
    const marker = entry.changed ? ' 🔁' : '';
    return `${entry.label}: ${subject}${marker}`;
  });

  return [`**${day}**`, ...lines].join('\n');
}

function normalizeWeekday(weekday) {
  const normalized = String(weekday ?? 'all');
  return normalized === 'all' || WEEK_DAYS.includes(normalized) ? normalized : 'all';
}

async function deferIfSupported(interaction) {
  if (
    typeof interaction.deferReply === 'function'
    && !interaction.deferred
    && !interaction.replied
  ) {
    await interaction.deferReply();
  }
}

async function respondToTimetableInteraction(interaction, payload) {
  if (interaction.deferred || interaction.replied) {
    if (typeof interaction.editReply === 'function') {
      await interaction.editReply(toEditablePayload(payload));
      return;
    }

    if (typeof interaction.followUp === 'function') {
      await interaction.followUp(payload);
      return;
    }
  }

  await interaction.reply(payload);
}

function toEditablePayload(payload) {
  if (typeof payload === 'string') {
    return payload;
  }

  const { ephemeral: _ephemeral, ...editablePayload } = payload;
  return editablePayload;
}
