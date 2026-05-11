import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import {
  ChoseongGame,
  KoreanInitialDictionary,
  getInitialConsonants
} from '../systems/choseong.js';

export const CHOSEONG_ROUND_TIMEOUT_MS = 30_000;
export const CHOSEONG_WIN_XP = 50;
export const CHOSEONG_INITIAL_LENGTH = 2;
export const CHOSEONG_MIN_TIMEOUT_SECONDS = 10;
export const CHOSEONG_MAX_TIMEOUT_SECONDS = 120;

const activeGamesByChannel = new Map();
let defaultDictionary = null;

export const choseongCommands = [
  new SlashCommandBuilder()
    .setName('초성게임')
    .setDescription('랜덤 2글자 초성을 보고 가장 먼저 맞는 한국어 단어를 입력합니다.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('시작')
        .setDescription('채팅창에서 가장 빨리 맞히는 초성게임 한 라운드를 시작합니다.')
        .addIntegerOption((option) =>
          option
            .setName('제한시간')
            .setDescription('정답을 받을 시간(초)입니다. 기본값은 30초입니다.')
            .setMinValue(CHOSEONG_MIN_TIMEOUT_SECONDS)
            .setMaxValue(CHOSEONG_MAX_TIMEOUT_SECONDS)
        )
    )
];

export function getChoseongCommandPayloads() {
  return choseongCommands.map((command) => command.toJSON());
}

export async function handleChoseongCommand(interaction, economy, logger = console, options = {}) {
  if (!interaction.isChatInputCommand?.() || interaction.commandName !== '초성게임') {
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

  if (subcommand === '시작') {
    await createChoseongRound(interaction, economy, logger, options);
    return true;
  }

  return false;
}

export async function handleChoseongMessage(message, economy, logger = console) {
  if (!message.inGuild?.() || message.author.bot) return false;

  const state = activeGamesByChannel.get(createChannelKey(message.guild.id, message.channel.id));
  if (!state || state.status !== 'playing') return false;

  const result = state.game.submitGuess({
    userId: message.author.id,
    username: message.author.username,
    word: message.content
  });

  if (!result.accepted) {
    if (result.code === 'invalid_format') return false;

    await replyToRejectedGuess(message, state, result, logger);
    return true;
  }

  await finishChoseongRoundWithWinner({
    state,
    message,
    result,
    economy,
    logger
  });
  return true;
}

export function resetChoseongGamesForTest() {
  for (const state of activeGamesByChannel.values()) {
    clearRoundTimer(state);
  }

  activeGamesByChannel.clear();
  defaultDictionary = null;
}

async function createChoseongRound(interaction, economy, logger, options) {
  const key = createChannelKey(interaction.guildId, interaction.channelId);

  if (activeGamesByChannel.has(key)) {
    await interaction.reply({
      content: '이 채널에서 이미 초성게임이 진행 중입니다.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  const timeoutSeconds = normalizeTimeoutSeconds(
    options.timeoutSeconds ?? interaction.options.getInteger?.('제한시간') ?? CHOSEONG_ROUND_TIMEOUT_MS / 1000
  );

  await deferChoseongStartReply(interaction);

  const state = {
    key,
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    channel: interaction.channel,
    status: 'playing',
    game: new ChoseongGame({
      dictionary: options.dictionary ?? getDefaultDictionary(),
      initialLength: CHOSEONG_INITIAL_LENGTH,
      minCandidates: options.minCandidates ?? 1,
      randomInt: options.randomInt
    }),
    timeoutMs: timeoutSeconds * 1000,
    winXp: normalizeWinXp(options.winXp ?? CHOSEONG_WIN_XP),
    timer: null
  };

  activeGamesByChannel.set(key, state);
  state.timer = setManagedTimeout(
    () => finishChoseongRoundByTimeout(state, logger).catch((error) => logger.error(error)),
    state.timeoutMs
  );

  try {
    await sendChoseongStartReply(interaction, {
      content: formatChoseongStartMessage(state),
      allowedMentions: { parse: [] }
    });
  } catch (error) {
    clearRoundTimer(state);
    activeGamesByChannel.delete(key);
    throw error;
  }
}

async function deferChoseongStartReply(interaction) {
  if (interaction.deferred || interaction.replied || typeof interaction.deferReply !== 'function') {
    return false;
  }

  await interaction.deferReply();
  return true;
}

async function sendChoseongStartReply(interaction, payload) {
  if (interaction.deferred && !interaction.replied && typeof interaction.editReply === 'function') {
    await interaction.editReply(payload);
    return;
  }

  await interaction.reply(payload);
}

async function finishChoseongRoundWithWinner({
  state,
  message,
  result,
  economy,
  logger
}) {
  if (state.status !== 'playing') return;

  state.status = 'ended';
  clearRoundTimer(state);
  activeGamesByChannel.delete(state.key);

  try {
    await message.react('✅');
  } catch (error) {
    logger.debug?.('Failed to react to choseong answer:', error);
  }

  let reward = null;

  try {
    reward = await economy?.awardActivityXp?.({
      guildId: state.guildId,
      userId: message.author.id,
      username: message.author.username,
      xp: state.winXp,
      source: '초성게임 승리'
    });
  } catch (error) {
    logger.error('Failed to award choseong win:', error);
  }

  await message.channel.send({
    content: formatChoseongWinMessage(state, result, reward),
    allowedMentions: { users: [message.author.id] }
  });
}

async function finishChoseongRoundByTimeout(state, logger) {
  if (state.status !== 'playing') return;

  state.status = 'ended';
  clearRoundTimer(state);
  activeGamesByChannel.delete(state.key);

  await state.channel.send({
    content: formatChoseongTimeoutMessage(state),
    allowedMentions: { parse: [] }
  }).catch((error) => logger.error('Failed to send choseong timeout:', error));
}

async function replyToRejectedGuess(message, state, result, logger) {
  try {
    await message.react('❌');
  } catch (error) {
    logger.debug?.('Failed to react to rejected choseong guess:', error);
  }

  const content = [
    `❌ ${result.reason}`,
    `제시 초성: **${state.game.requiredInitials}** · 제한시간 안에 다시 입력하세요.`
  ].join('\n');

  await message.reply({
    content,
    allowedMentions: { parse: [] }
  });
}

function formatChoseongStartMessage(state) {
  return [
    '🔠 **초성게임 시작!**',
    `제시 초성: **${state.game.requiredInitials}**`,
    `제한시간: **${formatSeconds(state.timeoutMs)}**`,
    '',
    '룰: 이 2글자 초성과 일치하는 한글 2글자 단어를 채팅창에 가장 먼저 입력하세요.',
    '예: `ㄱㄴ` → `강남`, `가난`처럼 초성이 정확히 일치하면 인정됩니다.',
    '단어 DB: AutoKkutu + Wiktionary/NIKL 기반 2글자 단어 77,000개 이상'
  ].join('\n');
}

function formatChoseongWinMessage(state, result, reward) {
  const guessInitials = getInitialConsonants(result.word);
  return [
    `🎉 <@${result.winner.userId}>님 정답!`,
    `초성 **${state.game.requiredInitials}** → **${result.word}** (${guessInitials})`,
    formatReward(reward, state.winXp)
  ].join('\n');
}

function formatChoseongTimeoutMessage(state) {
  const answers = state.game.revealAnswers(5);
  const answerText = answers.length > 0
    ? answers.map((answer) => `\`${answer}\``).join(', ')
    : '표시할 예시 단어가 없습니다.';

  return [
    '⏰ **초성게임 종료!** 제한시간 안에 정답자가 없었습니다.',
    `제시 초성: **${state.game.requiredInitials}**`,
    `정답 예시: ${answerText}`
  ].join('\n');
}

function formatReward(reward, fallbackXp) {
  if (!reward) {
    return `보상: **+${fallbackXp.toLocaleString()} XP** 지급을 시도했지만 결과를 확인하지 못했습니다.`;
  }

  const level = reward.leveledUp
    ? ` / 🎉 Lv.${reward.profile.level} 레벨업, 보너스 ${reward.levelReward.toLocaleString()}골드`
    : '';

  return `보상: **+${reward.xpGained.toLocaleString()} XP**${level}`;
}

function getDefaultDictionary() {
  defaultDictionary ??= KoreanInitialDictionary.fromFile();
  return defaultDictionary;
}

function createChannelKey(guildId, channelId) {
  return `${guildId}:${channelId}`;
}

function normalizeTimeoutSeconds(value) {
  const normalized = Math.trunc(Number(value));

  if (!Number.isSafeInteger(normalized)) {
    return CHOSEONG_ROUND_TIMEOUT_MS / 1000;
  }

  return Math.min(CHOSEONG_MAX_TIMEOUT_SECONDS, Math.max(CHOSEONG_MIN_TIMEOUT_SECONDS, normalized));
}

function normalizeWinXp(value) {
  const normalized = Math.trunc(Number(value));
  if (!Number.isSafeInteger(normalized) || normalized < 0) return CHOSEONG_WIN_XP;
  return normalized;
}

function formatSeconds(ms) {
  return `${Math.ceil(ms / 1000)}초`;
}

function setManagedTimeout(callback, ms) {
  const timer = setTimeout(callback, ms);
  timer.unref?.();
  return timer;
}

function clearRoundTimer(state) {
  clearTimeout(state.timer);
  state.timer = null;
}
