import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder
} from 'discord.js';
import {
  BOT_WORDCHAIN_PLAYER_ID,
  BOT_WORDCHAIN_PLAYER_NAME,
  KoreanWordDictionary,
  WordChainGame,
  createWordChainPlayers
} from '../systems/wordchain.js';

export const WORDCHAIN_COLLECTION_MS = 60_000;
export const WORDCHAIN_TURN_TIMEOUT_MS = 30_000;
export const WORDCHAIN_TURN_TIMEOUT_DECREASE_MS = 1_000;
export const WORDCHAIN_MIN_TURN_TIMEOUT_MS = 5_000;
export const WORDCHAIN_BOT_THINK_MS = 1_000;
export const WORDCHAIN_MODES = Object.freeze({
  classic: Object.freeze({
    value: 'classic',
    label: '일반',
    description: '기본 끝말잇기',
    rules: Object.freeze({})
  }),
  manner: Object.freeze({
    value: 'manner',
    label: '매너',
    description: '한방단어 사용 금지',
    rules: Object.freeze({
      forbidOneShot: true
    })
  }),
  kungkungtta: Object.freeze({
    value: 'kungkungtta',
    label: '쿵쿵따',
    description: '3글자 단어만 사용 가능',
    rules: Object.freeze({
      exactLength: 3
    })
  })
});

const activeGamesByChannel = new Map();
const activeGamesById = new Map();
let defaultDictionary = null;

export const wordChainCommands = [
  new SlashCommandBuilder()
    .setName('끝말잇기')
    .setDescription('희희봇 AI와 함께 끝말잇기를 합니다.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('시작')
        .setDescription('1분 동안 참가자를 모집한 뒤 희희봇 포함 순서대로 진행합니다.')
        .addStringOption((option) =>
          option
            .setName('모드')
            .setDescription('끝말잇기 모드')
            .addChoices(
              { name: '일반', value: 'classic' },
              { name: '매너(한방단어 금지)', value: 'manner' },
              { name: '쿵쿵따(3글자만)', value: 'kungkungtta' }
            )
        )
    )
];

export function getWordChainCommandPayloads() {
  return wordChainCommands.map((command) => command.toJSON());
}

export async function handleWordChainCommand(interaction, economy, logger = console, options = {}) {
  if (interaction.isButton()) {
    return handleWordChainButton(interaction, economy, logger, options);
  }

  if (!interaction.isChatInputCommand() || interaction.commandName !== '끝말잇기') {
    return false;
  }

  if (!interaction.inGuild()) {
    await interaction.reply({
      content: '서버에서만 사용할 수 있는 명령어입니다.',
      ephemeral: true
    });
    return true;
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === '시작') {
    await createWordChainLobby(interaction, economy, logger, options);
    return true;
  }

  return false;
}

export async function handleWordChainMessage(message, economy, logger = console) {
  if (!message.inGuild?.() || message.author.bot) return false;

  const state = activeGamesByChannel.get(createChannelKey(message.guild.id, message.channel.id));
  if (!state || state.status !== 'playing') return false;

  const game = state.game;
  const currentPlayer = game.currentPlayer;

  if (!currentPlayer || currentPlayer.userId !== message.author.id) {
    return false;
  }

  const result = game.submitWord({
    userId: message.author.id,
    word: message.content
  });

  if (!result.accepted) {
    await message.reply(`❌ ${result.reason}\n${formatTurnHint(state)}`);
    return true;
  }

  clearTurnTimer(state);

  try {
    await message.react('✅');
  } catch (error) {
    logger.debug?.('Failed to react to word-chain answer:', error);
  }

  await message.channel.send(formatAcceptedWord(result));
  await continueWordChainGame(state, economy, logger);
  return true;
}

export function resetWordChainGamesForTest() {
  for (const state of activeGamesByChannel.values()) {
    clearAllTimers(state);
  }

  activeGamesByChannel.clear();
  activeGamesById.clear();
  defaultDictionary = null;
}

async function createWordChainLobby(interaction, economy, logger, options) {
  const key = createChannelKey(interaction.guildId, interaction.channelId);

  if (activeGamesByChannel.has(key)) {
    await interaction.reply({
      content: '이 채널에서 이미 끝말잇기 모집 또는 게임이 진행 중입니다.',
      ephemeral: true
    });
    return;
  }

  const state = {
    id: createGameId(),
    key,
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    channel: interaction.channel,
    status: 'collecting',
    hostUserId: interaction.user.id,
    mode: getWordChainMode(interaction.options.getString?.('모드') ?? options.mode),
    participants: new Map(),
    dictionary: options.dictionary ?? getDefaultDictionary(),
    collectionMs: options.collectionMs ?? WORDCHAIN_COLLECTION_MS,
    turnTimeoutMs: options.turnTimeoutMs ?? WORDCHAIN_TURN_TIMEOUT_MS,
    turnTimeoutDecreaseMs: options.turnTimeoutDecreaseMs ?? WORDCHAIN_TURN_TIMEOUT_DECREASE_MS,
    minTurnTimeoutMs: options.minTurnTimeoutMs ?? WORDCHAIN_MIN_TURN_TIMEOUT_MS,
    botThinkMs: options.botThinkMs ?? WORDCHAIN_BOT_THINK_MS,
    randomInt: options.randomInt,
    botPlayerId: options.botPlayerId ?? BOT_WORDCHAIN_PLAYER_ID,
    botUsername: options.botUsername ?? BOT_WORDCHAIN_PLAYER_NAME,
    collectionTimer: null,
    turnTimer: null,
    botTimer: null,
    turnToken: null,
    turnSequence: 0,
    game: null
  };

  state.participants.set(interaction.user.id, createHumanParticipant(interaction.user));
  activeGamesByChannel.set(key, state);
  activeGamesById.set(state.id, state);

  state.collectionTimer = setManagedTimeout(
    () => beginWordChainGame(state, economy, logger).catch((error) => logger.error(error)),
    state.collectionMs
  );

  await interaction.reply({
    content: formatLobbyMessage(state),
    components: [createLobbyActionRow(state)]
  });
}

async function handleWordChainButton(interaction, economy, logger, options) {
  if (!interaction.customId.startsWith('wordchain_')) return false;

  const [action, gameId] = interaction.customId.split(':');
  const state = activeGamesById.get(gameId);

  if (!state || state.guildId !== interaction.guildId || state.channelId !== interaction.channelId) {
    await interaction.reply({
      content: '이미 종료되었거나 다른 채널의 끝말잇기 모집입니다.',
      ephemeral: true
    });
    return true;
  }

  if (state.status !== 'collecting') {
    await interaction.reply({
      content: '이미 게임이 시작되어 참가자 목록을 바꿀 수 없습니다.',
      ephemeral: true
    });
    return true;
  }

  if (interaction.user.bot) {
    await interaction.reply({
      content: '봇 계정은 참가할 수 없습니다. 희희봇은 자동으로 참가합니다.',
      ephemeral: true
    });
    return true;
  }

  if (action === 'wordchain_join') {
    state.participants.set(interaction.user.id, createHumanParticipant(interaction.user));
    await interaction.update({
      content: formatLobbyMessage(state),
      components: [createLobbyActionRow(state)]
    });
    return true;
  }

  if (action === 'wordchain_leave') {
    if (interaction.user.id === state.hostUserId) {
      await interaction.reply({
        content: '방장은 모집 중 나갈 수 없습니다. 게임이 끝난 뒤 다시 시작해주세요.',
        ephemeral: true
      });
      return true;
    }

    state.participants.delete(interaction.user.id);
    await interaction.update({
      content: formatLobbyMessage(state),
      components: [createLobbyActionRow(state)]
    });
    return true;
  }

  return false;
}

async function beginWordChainGame(state, economy, logger) {
  if (state.status !== 'collecting') return;

  clearCollectionTimer(state);
  state.status = 'playing';

  const humanPlayers = [...state.participants.values()];
  const players = createWordChainPlayers(humanPlayers, {
    botPlayerId: state.botPlayerId,
    botUsername: state.botUsername
  });

  state.game = new WordChainGame({
    players,
    dictionary: state.dictionary,
    rules: state.mode.rules,
    botPlayerId: state.botPlayerId,
    randomInt: state.randomInt
  });

  await state.channel.send(formatStartMessage(state));
  await continueWordChainGame(state, economy, logger);
}

async function continueWordChainGame(state, economy, logger) {
  if (state.status !== 'playing') return;

  const game = state.game;

  if (game.isComplete) {
    await finishWordChainGame(state, economy, logger);
    return;
  }

  const currentPlayer = game.currentPlayer;

  if (game.isBotPlayer(currentPlayer)) {
    clearTurnTimer(state);
    state.botTimer = setManagedTimeout(
      () => playBotTurn(state, economy, logger).catch((error) => logger.error(error)),
      state.botThinkMs
    );
    return;
  }

  await announceHumanTurn(state, economy, logger);
}

async function playBotTurn(state, economy, logger) {
  if (state.status !== 'playing') return;

  const result = state.game.playBotTurn();

  if (result.played) {
    await state.channel.send(`🤖 ${state.botUsername}: **${result.word}**\n다음 글자: **${result.nextRequiredStart}**`);
  } else {
    await state.channel.send(`🤖 ${state.botUsername} 탈락! ${result.reason}`);
  }

  await continueWordChainGame(state, economy, logger);
}

async function announceHumanTurn(state, economy, logger) {
  const currentPlayer = state.game.currentPlayer;
  const timeoutMs = getWordChainTurnTimeoutMs(state);
  const token = `${currentPlayer.userId}:${state.turnSequence += 1}`;
  state.turnToken = token;
  clearTimeout(state.turnTimer);
  state.turnTimer = setManagedTimeout(
    () => eliminateTimedOutPlayer(state, economy, logger, token, timeoutMs).catch((error) => logger.error(error)),
    timeoutMs
  );

  await state.channel.send(`➡️ ${formatPlayerMention(currentPlayer)} 차례입니다. ${formatTurnHint(state)}`);
}

async function eliminateTimedOutPlayer(state, economy, logger, token, timeoutMs) {
  if (state.status !== 'playing' || state.turnToken !== token) return;

  const result = state.game.eliminateCurrentPlayer('timeout');
  const eliminated = result.eliminated?.player;

  if (eliminated) {
    await state.channel.send(`⏰ ${formatPlayerMention(eliminated)}님이 ${formatSeconds(timeoutMs)} 안에 답하지 못해 탈락했습니다.`);
  }

  await continueWordChainGame(state, economy, logger);
}

async function finishWordChainGame(state, economy, logger) {
  if (state.status === 'ended') return;

  state.status = 'ended';
  clearAllTimers(state);
  activeGamesByChannel.delete(state.key);
  activeGamesById.delete(state.id);

  const winner = state.game.winner;
  const humanWinnerUserId = winner && !state.game.isBotPlayer(winner)
    ? winner.userId
    : null;

  try {
    const rewards = await economy.awardWordChainResults({
      guildId: state.guildId,
      participants: state.game.getHumanFinishOrder(),
      winnerUserId: humanWinnerUserId
    });

    await state.channel.send(formatFinishMessage(state, rewards));
  } catch (error) {
    logger.error(error);
    await state.channel.send(`끝말잇기 보상 지급 중 오류가 발생했습니다: ${error.message}`);
  }
}

function formatLobbyMessage(state) {
  const participants = [...state.participants.values()]
    .map((participant, index) => `${index + 1}. ${formatPlayerMention(participant)}`)
    .join('\n');

  return [
    '🔤 **끝말잇기 참가자 모집**',
    `모드: **${state.mode.label}** — ${state.mode.description}`,
    `모집 시간: **${formatSeconds(state.collectionMs)}**`,
    `진행: 참가자 + **${state.botUsername} AI**가 순서대로 진행`,
    `규칙: 자기 차례에 ${formatSeconds(state.turnTimeoutMs)} 안에 DB에 있는 한국어 단어를 입력하세요. 성공 단어마다 제한시간이 ${formatSeconds(state.turnTimeoutDecreaseMs)}씩 줄고 최소 ${formatSeconds(state.minTurnTimeoutMs)}까지 내려갑니다. 답을 못하면 탈락합니다.`,
    '',
    `참가자 (${state.participants.size}명):`,
    participants
  ].join('\n');
}

function formatStartMessage(state) {
  const order = state.game.players
    .map((player, index) => `${index + 1}. ${state.game.isBotPlayer(player) ? `🤖 ${player.username}` : formatPlayerMention(player)}`)
    .join('\n');

  return [
    '🔤 **끝말잇기 시작!**',
    `모드: **${state.mode.label}** — ${state.mode.description}`,
    '단어 DB: AutoKkutu KkutuDbDump 한국어 단어 357,644개',
    '',
    '순서:',
    order
  ].join('\n');
}

function formatAcceptedWord(result) {
  return `✅ ${formatPlayerMention(result.player)}: **${result.word}**\n다음 글자: **${result.nextRequiredStart}**`;
}

function formatTurnHint(state) {
  const requirements = [];

  if (state.mode.rules.forbidOneShot) {
    requirements.push('한방단어가 아닌');
  }

  if (state.mode.rules.exactLength) {
    requirements.push(`${state.mode.rules.exactLength}글자`);
  }

  requirements.push(
    state.game.requiredStart
      ? `**${state.game.requiredStart}**(으)로 시작하는 단어`
      : '아무 한국어 단어'
  );

  return `${requirements.join(' ')}를 ${formatSeconds(getWordChainTurnTimeoutMs(state))} 안에 입력하세요.`;
}

export function getWordChainTurnTimeoutMs(state) {
  const acceptedWordCount = state.game?.acceptedWords.length ?? 0;
  const decreased = state.turnTimeoutMs - acceptedWordCount * state.turnTimeoutDecreaseMs;

  return Math.max(state.minTurnTimeoutMs, decreased);
}

function getWordChainMode(value = 'classic') {
  return WORDCHAIN_MODES[value] ?? WORDCHAIN_MODES.classic;
}

function formatFinishMessage(state, rewards) {
  const winner = state.game.winner;
  const winnerText = winner
    ? state.game.isBotPlayer(winner)
      ? `🤖 **${winner.username}** 승리!`
      : `🏆 ${formatPlayerMention(winner)}님 승리! +${rewards.winnerMoney.toLocaleString()}원`
    : '승자 없이 종료되었습니다.';
  const rewardLines = rewards.participants.length > 0
    ? rewards.participants
        .map((result) => {
          const money = result.moneyGained > 0 ? ` / +${result.moneyGained.toLocaleString()}원` : '';
          const level = result.leveledUp ? ` / Lv.${result.profile.level} 달성` : '';
          return `- <@${result.userId}>: +${result.xpGained.toLocaleString()} XP${money}${level}`;
        })
        .join('\n')
    : '- 보상 대상 유저 없음';

  return [
    '🏁 **끝말잇기 종료**',
    winnerText,
    '',
    '보상:',
    rewardLines
  ].join('\n');
}

function createLobbyActionRow(state) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`wordchain_join:${state.id}`)
      .setLabel('참가')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`wordchain_leave:${state.id}`)
      .setLabel('나가기')
      .setStyle(ButtonStyle.Secondary)
  );
}

function createHumanParticipant(user) {
  return {
    userId: user.id,
    username: user.username,
    bot: false
  };
}

function getDefaultDictionary() {
  defaultDictionary ??= KoreanWordDictionary.fromFile();
  return defaultDictionary;
}

function createChannelKey(guildId, channelId) {
  return `${guildId}:${channelId}`;
}

function createGameId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatPlayerMention(player) {
  return player.bot ? `🤖 ${player.username}` : `<@${player.userId}>`;
}

function formatSeconds(ms) {
  return `${Math.ceil(ms / 1000)}초`;
}

function setManagedTimeout(callback, ms) {
  const timer = setTimeout(callback, ms);
  timer.unref?.();
  return timer;
}

function clearCollectionTimer(state) {
  clearTimeout(state.collectionTimer);
  state.collectionTimer = null;
}

function clearTurnTimer(state) {
  clearTimeout(state.turnTimer);
  state.turnTimer = null;
  state.turnToken = null;
}

function clearAllTimers(state) {
  clearCollectionTimer(state);
  clearTurnTimer(state);
  clearTimeout(state.botTimer);
  state.botTimer = null;
}
