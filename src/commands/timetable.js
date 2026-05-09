import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { WEEK_DAYS } from '../systems/timetable.js';

const KOREA_TIME_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

const TIMETABLE_SCOPES = Object.freeze({
  today: '오늘',
  tomorrow: '내일',
  weekday: '특정 요일',
  'this-week': '이번주 전체',
  'next-week': '다음주'
});

const SCOPE_CHOICES = Object.freeze(Object.entries(TIMETABLE_SCOPES).map(([value, name]) => ({
  name,
  value
})));

const WEEKDAY_CHOICES = Object.freeze([
  { name: '전체', value: 'all' },
  ...WEEK_DAYS.map((day) => ({ name: day, value: day }))
]);

const DAY_STYLES = Object.freeze({
  월: Object.freeze({ emoji: '📘', label: '월요일' }),
  화: Object.freeze({ emoji: '📗', label: '화요일' }),
  수: Object.freeze({ emoji: '📙', label: '수요일' }),
  목: Object.freeze({ emoji: '📕', label: '목요일' }),
  금: Object.freeze({ emoji: '💜', label: '금요일' })
});

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
        .setName('조회')
        .setDescription('오늘/내일/특정 요일/이번주/다음주 중 선택')
        .addChoices(...SCOPE_CHOICES)
    )
    .addStringOption((option) =>
      option
        .setName('요일')
        .setDescription('특정 요일이나 다음주에서 볼 요일')
        .addChoices(...WEEKDAY_CHOICES)
    )
];

export function getTimetableCommandPayloads() {
  return timetableCommands.map((command) => command.toJSON());
}

export async function handleTimetableCommand(interaction, timetable, { now = () => Date.now() } = {}) {
  if (!interaction.isChatInputCommand() || interaction.commandName !== '시간표') {
    return false;
  }

  try {
    const grade = interaction.options.getInteger('학년', true);
    const classNumber = interaction.options.getInteger('반', true);
    const scope = interaction.options.getString('조회') ?? null;
    const weekday = interaction.options.getString('요일') ?? 'all';
    const view = resolveTimetableView({
      scope,
      weekday,
      now: now()
    });

    await deferIfSupported(interaction);

    const result = await timetable.getTimetable({
      grade,
      classNumber,
      weekOffset: view.weekOffset
    });

    await respondToTimetableInteraction(interaction, formatTimetableMessage(result, view));
  } catch (error) {
    await respondToTimetableInteraction(interaction, {
      content: `시간표 정보를 불러오지 못했습니다: ${error.message}`,
      flags: MessageFlags.Ephemeral
    });
  }

  return true;
}

export function formatTimetableMessage(result, {
  days = WEEK_DAYS,
  title = '이번주 전체'
} = {}) {
  const normalizedDays = normalizeDays(days);
  const metadata = [
    result.weekStartDate ? `시작일 \`${result.weekStartDate}\`` : null,
    result.updatedAt ? `갱신 \`${result.updatedAt}\`` : null
  ].filter(Boolean).join(' · ');
  const header = [
    `🗓️ **${result.school.name} ${result.className} ${title} 시간표**`,
    metadata ? `📌 ${metadata}` : null
  ].filter(Boolean).join('\n');
  const sections = normalizedDays.map((day) => formatDaySection(day, result.timetable?.[day] ?? []));
  const changed = sections.some((section) => section.includes('🔁'));
  const footer = changed ? '\n\n🔁 표시: 컴시간 기준으로 변경된 수업입니다.' : '';

  return `${header}\n\n${sections.join('\n\n')}${footer}`;
}

export function resolveTimetableView({
  scope = null,
  weekday = 'all',
  now = Date.now()
} = {}) {
  const normalizedWeekday = normalizeWeekday(weekday);
  const normalizedScope = normalizeScope(scope, normalizedWeekday);

  if (normalizedScope === 'today') {
    return resolveRelativeSchoolDay({
      dayOffset: 0,
      label: '오늘',
      now
    });
  }

  if (normalizedScope === 'tomorrow') {
    return resolveRelativeSchoolDay({
      dayOffset: 1,
      label: '내일',
      now
    });
  }

  if (normalizedScope === 'weekday') {
    if (normalizedWeekday === 'all') {
      throw new Error('특정 요일 조회는 요일 옵션을 월~금 중 하나로 선택해야 합니다.');
    }

    return {
      weekOffset: 0,
      days: [normalizedWeekday],
      title: `${normalizedWeekday}요일`
    };
  }

  if (normalizedScope === 'next-week') {
    return {
      weekOffset: 1,
      days: normalizedWeekday === 'all' ? WEEK_DAYS : [normalizedWeekday],
      title: normalizedWeekday === 'all' ? '다음주' : `다음주 ${normalizedWeekday}요일`
    };
  }

  return {
    weekOffset: 0,
    days: normalizedWeekday === 'all' ? WEEK_DAYS : [normalizedWeekday],
    title: normalizedWeekday === 'all' ? '이번주 전체' : `${normalizedWeekday}요일`
  };
}

function formatDaySection(day, periods) {
  const style = DAY_STYLES[day] ?? { emoji: '📒', label: `${day}요일` };

  if (periods.length === 0) {
    return [
      `╭─ ${style.emoji} **${style.label}**`,
      '│ 등록된 시간표가 없습니다.',
      '╰────────────'
    ].join('\n');
  }

  const lines = periods.map((entry) => {
    const subject = entry.empty
      ? '자습/공강'
      : [entry.subject, entry.teacher ? `· ${entry.teacher}` : null].filter(Boolean).join(' ');
    const marker = entry.changed ? ' 🔁' : '';
    return `│ \`${entry.label}\` ${subject}${marker}`;
  });

  return [
    `╭─ ${style.emoji} **${style.label}**`,
    ...lines,
    '╰────────────'
  ].join('\n');
}

function normalizeWeekday(weekday) {
  const normalized = String(weekday ?? 'all');
  return normalized === 'all' || WEEK_DAYS.includes(normalized) ? normalized : 'all';
}

function normalizeDays(days) {
  const normalizedDays = Array.isArray(days) ? days : [days];
  const validDays = normalizedDays.filter((day) => WEEK_DAYS.includes(day));
  return validDays.length > 0 ? validDays : WEEK_DAYS;
}

function normalizeScope(scope, weekday) {
  if (Object.hasOwn(TIMETABLE_SCOPES, scope)) {
    return scope;
  }

  return weekday === 'all' ? 'today' : 'weekday';
}

function resolveRelativeSchoolDay({ dayOffset, label, now }) {
  const nowTimestamp = getTimestamp(now);
  const targetTimestamp = nowTimestamp + dayOffset * DAY_MS;
  const targetWeekdayIndex = getKoreaWeekdayIndex(targetTimestamp);

  if (targetWeekdayIndex === 0 || targetWeekdayIndex === 6) {
    throw new Error(`${label}은 주말이라 표시할 평일 시간표가 없습니다.`);
  }

  const weekOffset = Math.max(0, Math.round(
    (getKoreaWeekStartTimestamp(targetTimestamp) - getKoreaWeekStartTimestamp(nowTimestamp)) / WEEK_MS
  ));
  const day = WEEK_DAYS[targetWeekdayIndex - 1];

  return {
    weekOffset,
    days: [day],
    title: `${label}(${day})`
  };
}

function getTimestamp(value) {
  return value instanceof Date ? value.getTime() : Number(value);
}

function getKoreaWeekdayIndex(timestamp) {
  return new Date(timestamp + KOREA_TIME_OFFSET_MS).getUTCDay();
}

function getKoreaWeekStartTimestamp(timestamp) {
  const koreaTimestamp = timestamp + KOREA_TIME_OFFSET_MS;
  const koreaDayStart = Math.floor(koreaTimestamp / DAY_MS) * DAY_MS;
  const weekdayIndex = new Date(koreaDayStart).getUTCDay();
  const daysFromMonday = weekdayIndex === 0 ? 6 : weekdayIndex - 1;
  return koreaDayStart - daysFromMonday * DAY_MS - KOREA_TIME_OFFSET_MS;
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

  const { ephemeral: _ephemeral, flags: _flags, ...editablePayload } = payload;
  return editablePayload;
}
