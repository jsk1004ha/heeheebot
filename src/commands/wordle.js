import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { safeReplyToInteraction } from './interactions.js';
import { formatCurrencyAmount } from '../systems/currencies.js';

const FEEDBACK_EMOJI = Object.freeze({
  correct: '🟩',
  present: '🟨',
  absent: '⬛'
});

export const wordleCommands = [
  new SlashCommandBuilder()
    .setName('워들')
    .setDescription('하루 한 번, 모두가 같은 5글자 영어 단어를 맞히는 비공개 퍼즐입니다.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('도전')
        .setDescription('오늘의 워들에 5글자 영어 단어를 제출합니다. 결과는 본인에게만 보입니다.')
        .addStringOption((option) =>
          option
            .setName('단어')
            .setDescription('제출할 5글자 영어 단어')
            .setMinLength(5)
            .setMaxLength(5)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('상태')
        .setDescription('오늘 내 워들 진행 상태와 남은 시간을 비공개로 확인합니다.')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('랭킹')
        .setDescription('오늘 서버 워들 성공 목록을 확인합니다. 정답은 표시하지 않습니다.')
    )
];

export function getWordleCommandPayloads() {
  return wordleCommands.map((command) => command.toJSON());
}

export async function handleWordleCommand(interaction, wordle, economy) {
  if (!interaction.isChatInputCommand?.() || interaction.commandName !== '워들') {
    return false;
  }

  if (!interaction.inGuild()) {
    await replyPrivately(interaction, {
      content: '서버에서만 사용할 수 있는 명령어입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  const subcommand = interaction.options.getSubcommand();
  const basePayload = {
    guildId: interaction.guildId,
    userId: interaction.user.id,
    username: interaction.user.username
  };

  if (subcommand === '도전') {
    await deferPrivateReplyIfSupported(interaction);
    const guess = interaction.options.getString('단어', true);
    const result = await wordle.submitGuess({
      ...basePayload,
      guess
    });
    let reward = null;

    if (result.newlySolved) {
      reward = await economy.awardWordleSuccess(basePayload);
    }

    await replyPrivately(interaction, {
      content: formatWordleGuessResult(result, reward),
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] }
    });
    return true;
  }

  if (subcommand === '상태') {
    await deferPrivateReplyIfSupported(interaction);
    const status = await wordle.getPlayerStatus(basePayload);
    await replyPrivately(interaction, {
      content: formatWordleStatus(status),
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] }
    });
    return true;
  }

  if (subcommand === '랭킹') {
    await deferPrivateReplyIfSupported(interaction);
    const ranking = await wordle.listTodayRankings({
      guildId: interaction.guildId
    });
    await replyPrivately(interaction, {
      content: formatWordleRanking(ranking),
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] }
    });
    return true;
  }

  return false;
}

export function formatWordleGuessResult(result, reward = null) {
  if (result.blocked === 'solved') {
    return [
      formatWordleHeader(result.daily),
      '✅ 오늘 워들은 이미 성공했습니다. 보상은 하루에 한 번만 받을 수 있어요.',
      formatPrivateAnswer(result.daily),
      result.rank ? `현재 서버 성공 목록: **${result.rank.rank}위 / ${result.rank.total}명**` : '이 서버 성공 목록에는 아직 기록되지 않았습니다.',
      '',
      formatWordleBoard(result.session),
      formatPrivacyNote()
    ].join('\n');
  }

  if (result.blocked === 'failed') {
    return [
      formatWordleHeader(result.daily),
      '⛔ 오늘 사용할 수 있는 6번의 시도를 모두 사용했습니다.',
      '스포일러 방지를 위해 실패 시 정답은 표시하지 않습니다. 다음 퍼즐까지 기다려주세요.',
      `다음 워들까지: **${formatDuration(result.daily.remainingMs)}**`,
      '',
      formatWordleBoard(result.session),
      formatPrivacyNote()
    ].join('\n');
  }

  if (result.invalid) {
    return [
      formatWordleHeader(result.daily),
      `❌ ${formatInvalidGuessReason(result.invalid)}`,
      `시도 횟수는 차감되지 않았습니다. 남은 시도: **${getRemainingAttempts(result.session, result.maxAttempts)}회**`,
      '',
      formatWordleBoard(result.session),
      formatLegend(),
      formatPrivacyNote()
    ].join('\n');
  }

  if (result.solved) {
    const rewardText = reward
      ? `보상: **+${reward.xpGained.toLocaleString()} XP**, **+${formatCurrencyAmount(reward.moneyGained, 'main')}**${reward.leveledUp ? ` / 🎉 Lv.${reward.profile.level} 레벨업!` : ''}`
      : '보상 처리 결과를 확인하지 못했습니다.';

    return [
      formatWordleHeader(result.daily),
      `🎉 정답입니다! **${result.session.guesses.length}/${result.maxAttempts}회** 만에 성공했어요.`,
      formatPrivateAnswer(result.daily),
      rewardText,
      result.rank ? `오늘 서버 성공 목록: **${result.rank.rank}위 / ${result.rank.total}명** · 자정 후 **${formatClockDuration(result.session.elapsedMs)}**` : `자정 후 **${formatClockDuration(result.session.elapsedMs)}**`,
      '',
      formatWordleBoard(result.session),
      formatPrivacyNote()
    ].join('\n');
  }

  const remaining = getRemainingAttempts(result.session, result.maxAttempts);
  return [
    formatWordleHeader(result.daily),
    `🧩 제출 완료: **${result.attempt.word.toUpperCase()}**`,
    result.failed
      ? '⛔ 아쉽게도 오늘 시도를 모두 사용했습니다. 스포일러 방지를 위해 정답은 표시하지 않습니다.'
      : `남은 시도: **${remaining}회**`,
    '',
    formatWordleBoard(result.session),
    formatLegend(),
    formatPrivacyNote()
  ].join('\n');
}

export function formatWordleStatus({ daily, session, maxAttempts }) {
  const statusText = session
    ? formatSessionStatus(session, daily, maxAttempts)
    : [
        '아직 오늘 워들을 시작하지 않았습니다.',
        '`/워들 도전 단어:<5글자 영어단어>` 로 첫 추측을 제출하세요.'
      ].join('\n');

  return [
    formatWordleHeader(daily),
    statusText,
    '',
    formatWordleBoard(session),
    formatLegend(),
    formatPrivacyNote()
  ].join('\n');
}

export function formatWordleRanking({ daily, entries, total, limit }) {
  const lines = [
    `🏆 **오늘의 워들 성공 목록** (${daily.dateKey} KST)`,
    '정답 단어와 뜻은 표시하지 않습니다.',
    `자정 후 경과: **${formatClockDuration(daily.elapsedMs)}**`
  ];

  if (entries.length === 0) {
    lines.push('', '아직 오늘 성공자가 없습니다.');
    lines.push(formatPrivacyNote());
    return lines.join('\n');
  }

  lines.push('');
  for (const entry of entries) {
    lines.push(`${entry.rank}. **${sanitizeDisplayName(entry.username)}** — ${entry.attempts}회 · ${formatClockDuration(entry.elapsedMs)}`);
  }

  if (total > entries.length) {
    lines.push(`…외 ${total - entries.length}명 (상위 ${limit}명 표시)`);
  }

  lines.push('', formatPrivacyNote());
  return lines.join('\n');
}

function formatWordleHeader(daily) {
  return [
    `🟩 **오늘의 워들** (${daily.dateKey} KST)`,
    `5글자 영어 단어를 ${daily.maxAttempts}번 안에 맞히세요. 새 퍼즐까지 **${formatDuration(daily.remainingMs)}**`
  ].join('\n');
}

function formatPrivateAnswer(daily) {
  return `정답: **${daily.entry.word.toUpperCase()}** — ${daily.entry.meaning}`;
}

function formatSessionStatus(session, daily, maxAttempts) {
  if (session.status === 'solved') {
    return [
      `✅ 성공 완료: **${session.guesses.length}/${maxAttempts}회** · 자정 후 **${formatClockDuration(session.elapsedMs)}**`,
      formatPrivateAnswer(daily)
    ].join('\n');
  }

  if (session.status === 'failed') {
    return [
      `⛔ 실패 완료: **${session.guesses.length}/${maxAttempts}회**`,
      '스포일러 방지를 위해 실패 상태에서는 정답을 표시하지 않습니다.'
    ].join('\n');
  }

  return `진행 중: **${session.guesses.length}/${maxAttempts}회** 사용 · 남은 시도 **${getRemainingAttempts(session, maxAttempts)}회**`;
}

function formatWordleBoard(session) {
  if (!session || session.guesses.length === 0) {
    return '```\n아직 제출한 단어가 없습니다.\n```';
  }

  return [
    '```',
    ...session.guesses.map((attempt, index) => `${String(index + 1).padStart(2, '0')}. ${attempt.word.toUpperCase()} ${formatFeedback(attempt.feedback)}`),
    '```'
  ].join('\n');
}

function formatFeedback(feedback) {
  return feedback.map((mark) => FEEDBACK_EMOJI[mark] ?? FEEDBACK_EMOJI.absent).join('');
}

function formatLegend() {
  return '범례: 🟩 자리까지 맞음 · 🟨 단어 안에 있지만 위치가 다름 · ⬛ 없음';
}

function formatPrivacyNote() {
  return '🔒 워들 결과/정답은 항상 본인에게만 보이는 비공개 응답으로 전송됩니다.';
}

function formatInvalidGuessReason(reason) {
  return {
    length: '워들은 정확히 5글자 영어 단어만 제출할 수 있습니다.',
    only_letters: '영어 알파벳 a-z만 사용할 수 있습니다.',
    not_in_dictionary: '단어 목록에 없는 추측입니다. 다른 5글자 영어 단어를 입력해주세요.'
  }[reason] ?? '제출할 수 없는 단어입니다.';
}

function getRemainingAttempts(session, maxAttempts) {
  return Math.max(0, maxAttempts - (session?.guesses.length ?? 0));
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}시간 ${minutes}분`;
  if (minutes > 0) return `${minutes}분 ${seconds}초`;
  return `${seconds}초`;
}

function formatClockDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

function sanitizeDisplayName(name) {
  return String(name || 'Unknown')
    .replaceAll('`', 'ˋ')
    .replaceAll('*', '∗')
    .replaceAll('_', '＿')
    .replaceAll('~', '～')
    .replaceAll('|', '｜')
    .slice(0, 32);
}

async function replyPrivately(interaction, payload) {
  if (interaction.deferred && !interaction.replied && typeof interaction.editReply === 'function') {
    await interaction.editReply(toDeferredEditPayload(payload));
    return;
  }

  await safeReplyToInteraction(interaction, payload, { flags: MessageFlags.Ephemeral });
}

async function deferPrivateReplyIfSupported(interaction) {
  if (interaction.deferred || interaction.replied || typeof interaction.deferReply !== 'function') return;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
}

function toDeferredEditPayload(payload) {
  const {
    ephemeral,
    flags,
    fetchReply,
    withResponse,
    ...rest
  } = payload ?? {};
  return rest;
}
