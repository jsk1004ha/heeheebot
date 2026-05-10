import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { formatCurrencyAmount } from '../systems/currencies.js';

export const numberBaseballCommands = [
  new SlashCommandBuilder()
    .setName('숫자야구')
    .setDescription('랜덤 4자리 숫자를 스트라이크/볼 힌트로 맞히는 반복 플레이 미니게임입니다.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('도전')
        .setDescription('진행 중인 판에 4자리 숫자를 제출합니다. 판이 없으면 새 랜덤 숫자로 시작합니다.')
        .addStringOption((option) =>
          option
            .setName('숫자')
            .setDescription('서로 다른 4자리 숫자. 예: 0123')
            .setMinLength(4)
            .setMaxLength(12)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('상태')
        .setDescription('현재 진행 중인 숫자야구 판과 남은 시도를 확인합니다.')
    )
];

export function getNumberBaseballCommandPayloads() {
  return numberBaseballCommands.map((command) => command.toJSON());
}

export async function handleNumberBaseballCommand(interaction, numberBaseball, economy) {
  if (!interaction.isChatInputCommand?.() || interaction.commandName !== '숫자야구') {
    return false;
  }

  if (!interaction.inGuild()) {
    await interaction.reply({
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
    const guess = interaction.options.getString('숫자', true);
    const result = await numberBaseball.submitGuess({
      ...basePayload,
      guess
    });
    let reward = null;

    if (result.newlySolved) {
      reward = await economy.awardNumberBaseballSuccess(basePayload);
    } else if (result.newlyFailed) {
      reward = await economy.awardNumberBaseballFailure(basePayload);
    }

    await interaction.reply({
      content: formatNumberBaseballGuessResult(result, reward),
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] }
    });
    return true;
  }

  if (subcommand === '상태') {
    const status = await numberBaseball.getPlayerStatus(basePayload);
    await interaction.reply({
      content: formatNumberBaseballStatus(status),
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] }
    });
    return true;
  }

  return false;
}

export function formatNumberBaseballGuessResult(result, reward = null) {
  if (result.invalid) {
    return [
      formatNumberBaseballHeader(result),
      `❌ ${formatInvalidGuessReason(result.invalid, result.digitCount)}`,
      result.session
        ? `시도 횟수는 차감되지 않았습니다. 남은 시도: **${getRemainingAttempts(result.session, result.maxAttempts)}회**`
        : '시도 횟수는 차감되지 않았고 새 판도 아직 시작하지 않았습니다.',
      '',
      formatNumberBaseballBoard(result.session),
      formatRuleNote(result.digitCount),
      formatPrivacyNote()
    ].join('\n');
  }

  const startText = result.startedNewGame
    ? '🆕 새 랜덤 숫자로 판을 시작했습니다.'
    : '진행 중인 판에 제출했습니다.';

  if (result.solved) {
    const rewardText = reward
      ? `보상: **+${reward.xpGained.toLocaleString()} XP**, **+${formatCurrencyAmount(reward.moneyGained, 'main')}**${reward.leveledUp ? ` / 🎉 Lv.${reward.profile.level} 레벨업!` : ''}`
      : '보상 처리 결과를 확인하지 못했습니다.';

    return [
      formatNumberBaseballHeader(result),
      `${startText} 🎉 정답입니다! **${result.session.guesses.length}/${result.maxAttempts}회** 만에 성공했어요.`,
      formatAnswer(result.session),
      rewardText,
      '다음 `/숫자야구 도전`은 새 랜덤 숫자로 다시 시작됩니다.',
      '',
      formatNumberBaseballBoard(result.session),
      formatPrivacyNote()
    ].join('\n');
  }

  if (result.failed) {
    const rewardText = reward
      ? `완주 보상: **+${reward.xpGained.toLocaleString()} XP**${reward.leveledUp ? ` / 🎉 Lv.${reward.profile.level} 레벨업!` : ''} · 골드는 정답 성공 시에만 지급됩니다.`
      : '완주 보상 처리 결과를 확인하지 못했습니다.';

    return [
      formatNumberBaseballHeader(result),
      `${startText} ⛔ 마지막 시도까지 종료! 이번 제출은 **${formatAttemptScore(result.attempt)}** 입니다.`,
      formatAnswer(result.session),
      rewardText,
      '다음 `/숫자야구 도전`은 새 랜덤 숫자로 다시 시작됩니다.',
      '',
      formatNumberBaseballBoard(result.session),
      formatPrivacyNote()
    ].join('\n');
  }

  const remaining = getRemainingAttempts(result.session, result.maxAttempts);
  return [
    formatNumberBaseballHeader(result),
    `${startText} **${result.attempt.number}** → **${formatAttemptScore(result.attempt)}**`,
    `남은 시도: **${remaining}회**`,
    '',
    formatNumberBaseballBoard(result.session),
    formatRuleNote(result.digitCount),
    formatPrivacyNote()
  ].join('\n');
}

export function formatNumberBaseballStatus({ session, lastSession, digitCount, maxAttempts }) {
  if (session) {
    return [
      formatNumberBaseballHeader({ digitCount, maxAttempts }),
      formatSessionStatus(session, maxAttempts),
      '',
      formatNumberBaseballBoard(session),
      formatRuleNote(digitCount),
      formatPrivacyNote()
    ].join('\n');
  }

  const lastText = lastSession
    ? [
        '',
        `최근 완료 판: **${lastSession.status === 'solved' ? '성공' : '실패'}** · ${lastSession.guesses.length}/${maxAttempts}회 · 정답 **${lastSession.answer}**`
      ].join('\n')
    : '';

  return [
    formatNumberBaseballHeader({ digitCount, maxAttempts }),
    '진행 중인 판이 없습니다.',
    '`/숫자야구 도전 숫자:1234` 를 입력하면 새 랜덤 숫자로 바로 시작합니다.',
    lastText,
    formatRuleNote(digitCount),
    formatPrivacyNote()
  ].filter(Boolean).join('\n');
}

function formatNumberBaseballHeader({ digitCount, maxAttempts }) {
  return `⚾ **숫자야구** — 서로 다른 숫자 ${digitCount}개를 ${maxAttempts}번 안에 맞히세요.`;
}

function formatSessionStatus(session, maxAttempts) {
  if (session.status === 'solved') {
    return [
      `✅ 성공 완료: **${session.guesses.length}/${maxAttempts}회** · 소요 **${formatClockDuration(session.elapsedMs)}**`,
      formatAnswer(session)
    ].join('\n');
  }

  if (session.status === 'failed') {
    return [
      `⛔ 실패 완료: **${session.guesses.length}/${maxAttempts}회**`,
      formatAnswer(session)
    ].join('\n');
  }

  return `진행 중: **${session.guesses.length}/${maxAttempts}회** 사용 · 남은 시도 **${getRemainingAttempts(session, maxAttempts)}회**`;
}

function formatNumberBaseballBoard(session) {
  if (!session || session.guesses.length === 0) {
    return '```\n아직 제출한 숫자가 없습니다.\n```';
  }

  return [
    '```',
    ...session.guesses.map((attempt, index) => `${String(index + 1).padStart(2, '0')}. ${attempt.number} -> ${formatAttemptScore(attempt)}`),
    '```'
  ].join('\n');
}

function formatAttemptScore(attempt) {
  if (attempt.strikes === 0 && attempt.balls === 0) return 'OUT';
  return `${attempt.strikes}S ${attempt.balls}B`;
}

function formatAnswer(session) {
  return `정답: **${session.answer}**`;
}

function formatRuleNote(digitCount) {
  return `룰: 위치와 숫자가 모두 맞으면 S, 숫자만 맞으면 B입니다. 예시는 서로 다른 ${digitCount}자리 숫자 \`0123\`처럼 입력하세요.`;
}

function formatPrivacyNote() {
  return '🔒 결과는 본인에게만 보입니다.';
}

function getRemainingAttempts(session, maxAttempts) {
  return Math.max(0, maxAttempts - (session?.guesses?.length ?? 0));
}

function formatInvalidGuessReason(reason, digitCount) {
  if (reason === 'only_digits') return '숫자만 입력할 수 있습니다.';
  if (reason === 'length') return `서로 다른 숫자 ${digitCount}개를 입력해야 합니다.`;
  if (reason === 'duplicate_digits') return '같은 숫자는 한 번만 사용할 수 있습니다.';
  return '사용할 수 없는 추측입니다.';
}

function formatClockDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}시간 ${minutes}분`;
  if (minutes > 0) return `${minutes}분 ${seconds}초`;
  return `${seconds}초`;
}
