import {
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder
} from 'discord.js';
import {
  cashOutDeadlineRound,
  applyPokerRecommendedHold,
  clearPokerHold,
  actPlayerHoldemRound,
  createBlackjackRound,
  createDeadlineRound,
  createPlayerBlackjackRound,
  createPlayerHoldemRound,
  createPokerRound,
  createScratchTicket,
  createTimingRound,
  DEADLINE_MAX_SAFE_PRESSES,
  DEADLINE_MIN_BET,
  DEADLINE_ROLL_MAX,
  TIMING_PAYOUT_TIERS,
  TIMING_TARGET_MAX_SECONDS,
  TIMING_TARGET_MIN_SECONDS,
  EMOJI_RACE_RACERS,
  formatEmojiRaceChoice,
  formatEmojiRaceTrack,
  formatCards,
  formatScratchPrizeShort,
  drawPokerRound,
  hitBlackjackRound,
  hitPlayerBlackjackRound,
  getPokerHoldRecommendation,
  getPokerPayoutTable,
  getEmojiRacePoolMarket,
  getScratchTicketProduct,
  getScratchTicketProductStats,
  normalizeEmojiRaceChoice,
  normalizeDiceChoice,
  normalizeOddEvenChoice,
  normalizeScratchTicketProductId,
  playBaccarat,
  playCraps,
  pressDeadlineRound,
  playDice,
  playEmojiRacePool,
  playHighLow,
  playKeno,
  playLuckySeven,
  playOddEven,
  playRoulette,
  playSicBo,
  standBlackjackRound,
  resolveTimingRound,
  revealAllScratchTicketSpots,
  revealScratchTicketSpot,
  SCRATCH_TICKET_PRODUCTS,
  SCRATCH_TICKET_SPOT_COUNT,
  standPlayerBlackjackRound,
  togglePokerHold,
  playSlots
} from '../systems/casino.js';
import {
  createAllowedMentionsForUsers,
  formatUserMention
} from './ui.js';
import {
  logUnexpectedInteractionError,
  safeDeferUpdate,
  safeReplyToInteraction,
  sendInteractionUpdate
} from './interactions.js';

const CHALLENGE_TTL_MS = 60_000;
const SCRATCH_TICKET_TTL_MS = 5 * 60_000;
const CASINO_PENDING_CLEANUP_MIN_DELAY_MS = 1_000;
const EMOJI_RACE_FRAME_DELAY_MS = 500;
const EMOJI_RACE_LOBBY_MAX_PLAYERS = 12;
const EMOJI_RACE_LOBBY_MIN_PLAYERS = 2;
const POKER_LOBBY_MAX_PLAYERS = 6;
const DEFAULT_CASINO_LUCK_MULTIPLIER = 5;
const MAX_CASINO_LUCK_MULTIPLIER = 50;
const pendingBlackjackChallenges = new Map();
const pendingDeadlineGames = new Map();
const pendingTimingGames = new Map();
const pendingAiBlackjackGames = new Map();
const pendingEmojiRaceLobbies = new Map();
const pendingPlayerBlackjackGames = new Map();
const pendingPokerGames = new Map();
const pendingPokerLobbies = new Map();
const pendingPlayerPokerGames = new Map();
const pendingScratchTickets = new Map();
let pendingCasinoCleanupTimer = null;

export const casinoCommands = [
  new SlashCommandBuilder()
    .setName('카지노정보')
    .setDescription('도박 게임별 배수와 환급 규칙을 확인합니다.'),
  new SlashCommandBuilder()
    .setName('홀짝')
    .setDescription('홀/짝을 맞히면 약 1.9배를 받습니다.')
    .addIntegerOption((option) =>
      option
        .setName('돈')
        .setDescription('베팅할 골드')
        .setMinValue(1)
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('선택')
        .setDescription('홀 또는 짝')
        .setRequired(true)
        .addChoices(
          { name: '홀', value: 'odd' },
          { name: '짝', value: 'even' }
        )
    ),
  new SlashCommandBuilder()
    .setName('주사위')
    .setDescription('주사위가 높음(4~6)/낮음(1~3)인지 맞히면 약 1.9배를 받습니다.')
    .addIntegerOption((option) =>
      option
        .setName('돈')
        .setDescription('베팅할 골드')
        .setMinValue(1)
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('선택')
        .setDescription('높음 또는 낮음')
        .setRequired(true)
        .addChoices(
          { name: '높음(4~6)', value: 'high' },
          { name: '낮음(1~3)', value: 'low' }
        )
    ),
  new SlashCommandBuilder()
    .setName('슬롯')
    .setDescription('슬롯을 돌립니다. 낮은 확률로 3~20배를 받습니다.')
    .addIntegerOption((option) =>
      option
        .setName('돈')
        .setDescription('베팅할 골드')
        .setMinValue(1)
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('데드라인')
    .setDescription('누를수록 보상과 꽝 확률이 함께 커지는 버튼 게임입니다.')
    .addIntegerOption((option) =>
      option
        .setName('돈')
        .setDescription(`베팅할 골드 (최소 ${DEADLINE_MIN_BET.toLocaleString()}골드)`)
        .setMinValue(DEADLINE_MIN_BET)
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('타이밍')
    .setDescription('랜덤 목표 초에 최대한 정확히 버튼을 눌러 골드 배율을 노립니다.')
    .addIntegerOption((option) =>
      option
        .setName('돈')
        .setDescription('베팅할 골드')
        .setMinValue(1)
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('이모지경마')
    .setDescription('여러 유저가 같은 판에 베팅하고 1등 동물 적중자끼리 배당풀을 나눕니다.')
    .addIntegerOption((option) =>
      option
        .setName('돈')
        .setDescription('베팅할 골드')
        .setMinValue(1)
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('선택')
        .setDescription('우승할 동물')
        .setRequired(true)
        .addChoices(
          { name: '1번 말 🐎', value: 'horse' },
          { name: '2번 강아지 🐕', value: 'dog' },
          { name: '3번 거북이 🐢', value: 'turtle' }
        )
    ),
  new SlashCommandBuilder()
    .setName('럭키세븐')
    .setDescription('주사위 2개의 합이 7이면 5.5배를 받습니다.')
    .addIntegerOption((option) =>
      option
        .setName('돈')
        .setDescription('베팅할 골드')
        .setMinValue(1)
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('하이로우')
    .setDescription('두 번째 카드가 첫 카드보다 높을지 낮을지 맞힙니다. 같은 숫자는 환불됩니다.')
    .addIntegerOption((option) =>
      option
        .setName('돈')
        .setDescription('베팅할 골드')
        .setMinValue(1)
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('선택')
        .setDescription('높음 또는 낮음')
        .setRequired(true)
        .addChoices(
          { name: '높음', value: 'high' },
          { name: '낮음', value: 'low' }
        )
    ),
  new SlashCommandBuilder()
    .setName('블랙잭')
    .setDescription('AI 또는 다른 유저와 수동 블랙잭을 합니다.')
    .addIntegerOption((option) =>
      option
        .setName('돈')
	        .setDescription('베팅할 골드')
	        .setMinValue(1)
	        .setRequired(true)
	    )
	    .addUserOption((option) =>
	      option
        .setName('상대')
        .setDescription('비우면 AI와 대결합니다.')
    ),
  new SlashCommandBuilder()
    .setName('포커')
    .setDescription('참가 버튼으로 들어오는 텍사스 홀덤 포커방을 만듭니다.')
    .addIntegerOption((option) =>
      option
        .setName('시작칩')
        .setDescription('포커방 시작 스택으로 사용할 칩. 시작하면 같은 수의 골드가 칩으로 바뀝니다.')
        .setMinValue(1)
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('룰렛')
    .setDescription('룰렛 휠에서 색상/홀짝/구간/0에 베팅합니다.')
    .addIntegerOption((option) =>
      option
        .setName('돈')
        .setDescription('베팅할 골드')
        .setMinValue(1)
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('선택')
        .setDescription('베팅 선택')
        .setRequired(true)
        .addChoices(
          { name: '빨강', value: 'red' },
          { name: '검정', value: 'black' },
          { name: '홀', value: 'odd' },
          { name: '짝', value: 'even' },
          { name: '낮음(1~18)', value: 'low' },
          { name: '높음(19~36)', value: 'high' },
          { name: '0', value: 'zero' }
        )
    ),
  new SlashCommandBuilder()
    .setName('바카라')
    .setDescription('플레이어/뱅커/타이에 베팅합니다.')
    .addIntegerOption((option) =>
      option
        .setName('돈')
        .setDescription('베팅할 골드')
        .setMinValue(1)
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('선택')
        .setDescription('베팅 선택')
        .setRequired(true)
        .addChoices(
          { name: '플레이어', value: 'player' },
          { name: '뱅커', value: 'banker' },
          { name: '타이', value: 'tie' }
        )
    ),
  new SlashCommandBuilder()
    .setName('크랩스')
    .setDescription('패스/돈패스 라인에 베팅합니다.')
    .addIntegerOption((option) =>
      option
        .setName('돈')
        .setDescription('베팅할 골드')
        .setMinValue(1)
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('선택')
        .setDescription('패스 또는 돈패스')
        .setRequired(true)
        .addChoices(
          { name: '패스', value: 'pass' },
          { name: '돈패스', value: 'dont_pass' }
        )
    ),
  new SlashCommandBuilder()
    .setName('시크보')
    .setDescription('세 주사위 합계의 작음/큼/트리플에 베팅합니다.')
    .addIntegerOption((option) =>
      option
        .setName('돈')
        .setDescription('베팅할 골드')
        .setMinValue(1)
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('선택')
        .setDescription('베팅 선택')
        .setRequired(true)
        .addChoices(
          { name: '작음(4~10)', value: 'small' },
          { name: '큼(11~17)', value: 'big' },
          { name: '트리플', value: 'triple' }
        )
    ),
  new SlashCommandBuilder()
    .setName('키노')
    .setDescription('1~80 중 번호 1~5개를 고르고 10개 추첨 결과를 맞힙니다.')
    .addIntegerOption((option) =>
      option
        .setName('돈')
        .setDescription('베팅할 골드')
        .setMinValue(1)
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('번호들')
        .setDescription('예: 3 14 25 또는 3,14,25 (최대 5개)')
        .setMaxLength(30)
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('스크래치복권')
    .setDescription('고정가 복권을 구매하고 버튼으로 9칸을 하나씩 긁어 당첨을 확인합니다.')
    .addStringOption((option) =>
      option
        .setName('종류')
        .setDescription('구매할 스크래치 복권 종류')
        .setRequired(true)
        .addChoices(
          ...SCRATCH_TICKET_PRODUCTS.map((product) => ({
            name: `${product.name} · ${product.price.toLocaleString()}골드 · 최고 ${formatScratchPrizeShort(product.topPrize)}골드`,
            value: product.id
          }))
        )
    )
	];

export function getCasinoCommandPayloads() {
  return casinoCommands.map((command) => command.toJSON());
}

export async function handleCasinoCommand(interaction, economy, logger = console, options = {}) {
  if (!isCasinoInteraction(interaction)) {
    return false;
  }

  await cleanupExpiredCasinoGames(economy, logger).catch((error) =>
    logger.error?.('Failed to cleanup expired casino games:', error)
  );

  try {
    if (interaction.isButton()) {
      if (interaction.customId?.startsWith('casino_quick:')) {
        return await handleCasinoQuickButton(interaction, economy, logger, options);
      }
      if (interaction.customId?.startsWith('deadline_')) {
        return await handleDeadlineButton(interaction, economy, logger, options);
      }
      if (interaction.customId?.startsWith('timing_')) {
        return await handleTimingButton(interaction, economy, logger, options);
      }
      if (interaction.customId?.startsWith('race_')) {
        return await handleEmojiRaceButton(interaction, economy, logger, options);
      }
      if (interaction.customId?.startsWith('poker_')) {
        return await handlePokerButton(interaction, economy, logger);
      }
      if (interaction.customId?.startsWith('scratch_')) {
        return await handleScratchTicketButton(interaction, economy, logger);
      }
      return await handleBlackjackButton(interaction, economy, logger);
    }

    if (!interaction.isChatInputCommand() || !isCasinoCommand(interaction.commandName)) {
      return false;
    }

    if (!interaction.inGuild()) {
      await interaction.reply({
        content: '서버에서만 사용할 수 있는 명령어입니다.',
        flags: MessageFlags.Ephemeral
      });
      return true;
    }

    try {
      await routeCasinoCommand(interaction, economy, logger, options);
    } catch (error) {
      logUnexpectedInteractionError(logger, error, 'Casino command rejected');
      await safeReplyToInteraction(interaction, {
        content: `게임 실패: ${error.message}`,
        flags: MessageFlags.Ephemeral
      });
    }

    return true;
  } finally {
    scheduleCasinoPendingCleanup(economy, logger);
  }
}

function isCasinoInteraction(interaction) {
  if (interaction.isButton()) return isCasinoButtonId(interaction.customId);
  return interaction.isChatInputCommand() && isCasinoCommand(interaction.commandName);
}

function isCasinoButtonId(customId) {
  return [
    'blackjack_',
    'casino_quick:',
    'deadline_',
    'race_',
    'poker_',
    'scratch_',
    'timing_'
  ].some((prefix) => customId?.startsWith(prefix));
}

export async function cleanupExpiredCasinoGames(economy, logger = console, now = Date.now()) {
  let removed = 0;
  let refunded = 0;

  for (const pendingGames of [
    pendingScratchTickets,
    pendingTimingGames,
    pendingDeadlineGames,
    pendingEmojiRaceLobbies,
    pendingPokerGames,
    pendingAiBlackjackGames
  ]) {
    const result = await cleanupExpiredCasinoPendingMap(
      pendingGames,
      economy,
      logger,
      now,
      pendingGames === pendingEmojiRaceLobbies
        ? refundReservedEmojiRaceLobby
        : refundReservedCasinoWager
    );
    removed += result.removed;
    refunded += result.refunded;
  }

  for (const [challengeId, challenge] of pendingBlackjackChallenges.entries()) {
    if (challenge.expiresAt > now) continue;
    pendingBlackjackChallenges.delete(challengeId);
    removed += 1;
  }

  for (const [lobbyId, lobby] of pendingPokerLobbies.entries()) {
    if (lobby.expiresAt > now) continue;
    pendingPokerLobbies.delete(lobbyId);
    removed += 1;
  }

  for (const pendingPlayerGames of [
    pendingPlayerBlackjackGames,
    pendingPlayerPokerGames
  ]) {
    const playerResult = await cleanupExpiredCasinoPendingMap(
      pendingPlayerGames,
      economy,
      logger,
      now,
      refundReservedPlayerCasinoPot
    );
    removed += playerResult.removed;
    refunded += playerResult.refunded;
  }

  if (removed > 0) {
    logger.debug?.(`Cleaned up ${removed} expired casino game(s); refunded ${refunded} reserved wager(s).`);
  }

  scheduleCasinoPendingCleanup(economy, logger, now);
  return { removed, refunded };
}

async function cleanupExpiredCasinoPendingMap(pendingGames, economy, logger, now, refundReserved) {
  let removed = 0;
  let refunded = 0;

  for (const [gameId, pending] of pendingGames.entries()) {
    if (pending.expiresAt > now) continue;

    const refundCount = await refundReserved(economy, logger, pending);
    if (pending?.reserved) continue;

    pendingGames.delete(gameId);
    removed += 1;
    refunded += refundCount;
  }

  return { removed, refunded };
}

function scheduleCasinoPendingCleanup(economy, logger = console, now = Date.now()) {
  if (pendingCasinoCleanupTimer) {
    clearTimeout(pendingCasinoCleanupTimer);
    pendingCasinoCleanupTimer = null;
  }

  const nextExpiresAt = getNextPendingCasinoExpiry();
  if (!nextExpiresAt) return;

  const delayMs = Math.max(CASINO_PENDING_CLEANUP_MIN_DELAY_MS, nextExpiresAt - now + 10);
  pendingCasinoCleanupTimer = setTimeout(async () => {
    pendingCasinoCleanupTimer = null;
    await cleanupExpiredCasinoGames(economy, logger).catch((error) =>
      logger.error?.('Failed to cleanup expired casino games:', error)
    );
  }, delayMs);
  pendingCasinoCleanupTimer.unref?.();
}

function getNextPendingCasinoExpiry() {
  const expiries = [
    ...[...pendingScratchTickets.values()].map((pending) => pending.expiresAt),
    ...[...pendingTimingGames.values()].map((pending) => pending.expiresAt),
    ...[...pendingDeadlineGames.values()].map((pending) => pending.expiresAt),
    ...[...pendingEmojiRaceLobbies.values()].map((pending) => pending.expiresAt),
    ...[...pendingPokerGames.values()].map((pending) => pending.expiresAt),
    ...[...pendingAiBlackjackGames.values()].map((pending) => pending.expiresAt),
    ...[...pendingBlackjackChallenges.values()].map((pending) => pending.expiresAt),
    ...[...pendingPokerLobbies.values()].map((pending) => pending.expiresAt),
    ...[...pendingPlayerBlackjackGames.values()].map((pending) => pending.expiresAt),
    ...[...pendingPlayerPokerGames.values()].map((pending) => pending.expiresAt)
  ].filter((expiresAt) => Number.isFinite(expiresAt) && expiresAt > 0);

  return expiries.length > 0 ? Math.min(...expiries) : null;
}

function getCasinoBetOption(interaction) {
  if (interaction.commandName !== '포커') {
    return interaction.options.getInteger('돈', true);
  }

  const chips = interaction.options.getInteger('시작칩');

  if (chips === null || chips === undefined) {
    throw new Error('포커 시작칩을 입력해주세요.');
  }

  return chips;
}

async function refundReservedCasinoWager(economy, logger, pending) {
  if (!pending?.reserved || typeof economy?.refundReservedWager !== 'function') return 0;

  try {
    await economy.refundReservedWager({
      guildId: pending.guildId,
      userId: pending.userId,
      username: pending.username,
      bet: pending.bet ?? pending.price
    });
    pending.reserved = false;
    return 1;
  } catch (error) {
    logger.error?.('Failed to refund expired casino wager:', error);
    return 0;
  }
}

async function refundReservedEmojiRaceLobby(economy, logger, pending) {
  if (!pending?.reserved || typeof economy?.refundReservedWager !== 'function') return 0;

  let refunded = 0;

  for (const betEntry of pending.bets ?? []) {
    if (!betEntry.reserved) continue;

    try {
      await economy.refundReservedWager({
        guildId: pending.guildId,
        userId: betEntry.userId,
        username: betEntry.username,
        bet: betEntry.bet
      });
      betEntry.reserved = false;
      refunded += 1;
    } catch (error) {
      logger.error?.('Failed to refund expired emoji race wager:', error);
    }
  }

  pending.reserved = (pending.bets ?? []).some((betEntry) => betEntry.reserved);
  return refunded;
}

async function refundReservedPlayerCasinoPot(economy, logger, pending) {
  if (!pending?.reserved) return 0;

  try {
    if (pending.players?.length > 2) {
      await refundReservedPlayerPokerTable(economy, pending);
    } else if (typeof economy?.resolveReservedPlayerPot === 'function') {
      await economy.resolveReservedPlayerPot({
        guildId: pending.guildId,
        challenger: pending.challenger,
        opponent: pending.opponent,
        bet: pending.bet,
        winnerUserId: null
      });
    } else {
      return 0;
    }
    pending.reserved = false;
    return pending.players?.length ?? 2;
  } catch (error) {
    logger.error?.('Failed to refund expired player casino pot:', error);
    return 0;
  }
}

async function routeCasinoCommand(interaction, economy, logger = console, options = {}) {
  if (interaction.commandName === '카지노정보') {
    await interaction.reply(createCasinoInfoPayload());
    return;
  }

  if (interaction.commandName === '스크래치복권') {
    const productId = normalizeScratchTicketProductId(interaction.options.getString('종류', true));
    await playScratchTicket(interaction, economy, productId, options);
    return;
  }

  const bet = getCasinoBetOption(interaction);

  if (interaction.commandName === '홀짝') {
    const choice = normalizeOddEvenChoice(interaction.options.getString('선택', true));
    const game = playCasinoLuckGame(interaction, options, () => playOddEven({
      choice,
      bet,
      randomInt: options.randomInt
    }));
    const settlement = await settleGame(interaction, economy, bet, game.payout, game);

    await interaction.reply(createCasinoGamePayload({
      content: formatOddEvenResult(interaction.user, game, settlement),
      userId: interaction.user.id,
      game: 'odd_even',
      bet,
      choice
    }));
    return;
  }

  if (interaction.commandName === '주사위') {
    const choice = normalizeDiceChoice(interaction.options.getString('선택', true));
    const game = playCasinoLuckGame(interaction, options, () => playDice({
      choice,
      bet,
      randomInt: options.randomInt
    }));
    const settlement = await settleGame(interaction, economy, bet, game.payout, game);

    await interaction.reply(createCasinoGamePayload({
      content: formatDiceResult(interaction.user, game, settlement),
      userId: interaction.user.id,
      game: 'dice',
      bet,
      choice
    }));
    return;
  }

  if (interaction.commandName === '슬롯') {
    const game = playCasinoLuckGame(interaction, options, () => playSlots({
      bet,
      randomInt: options.randomInt
    }));
    const settlement = await settleGame(interaction, economy, bet, game.payout, game);

    await interaction.reply(createCasinoGamePayload({
      content: formatSlotResult(interaction.user, game, settlement),
      userId: interaction.user.id,
      game: 'slots',
      bet
    }));
    return;
  }

  if (interaction.commandName === '데드라인') {
    await playDeadline(interaction, economy, bet);
    return;
  }

  if (interaction.commandName === '타이밍') {
    await playTiming(interaction, economy, bet, options);
    return;
  }

  if (interaction.commandName === '이모지경마') {
    const choice = normalizeEmojiRaceChoice(interaction.options.getString('선택', true));
    await createEmojiRaceLobby(interaction, economy, logger, {
      bet,
      choice,
      randomInt: options.randomInt,
      frameDelayMs: options.raceDelayMs,
      sleep: options.sleep,
      casinoLuckOptions: options
    });
    return;
  }

  if (interaction.commandName === '럭키세븐') {
    const game = playCasinoLuckGame(interaction, options, () => playLuckySeven({
      bet,
      randomInt: options.randomInt
    }));
    const settlement = await settleGame(interaction, economy, bet, game.payout, game);

    await interaction.reply(formatLuckySevenResult(interaction.user, game, settlement));
    return;
  }

  if (interaction.commandName === '하이로우') {
    const game = playCasinoLuckGame(interaction, options, () => playHighLow({
      choice: interaction.options.getString('선택', true),
      bet,
      randomInt: options.randomInt
    }));
    const settlement = await settleGame(interaction, economy, bet, game.payout, game);

    await interaction.reply(formatHighLowResult(interaction.user, game, settlement));
    return;
  }

  if (interaction.commandName === '블랙잭') {
    const opponent = interaction.options.getUser('상대');

    if (!opponent) {
      await playAiBlackjack(interaction, economy, bet);
      return;
    }

    await createPlayerBlackjackChallenge(interaction, economy, bet, opponent);
    return;
  }

  if (interaction.commandName === '포커') {
    await createPlayerPokerLobby(interaction, economy, bet, options);
    return;
  }

  if (interaction.commandName === '룰렛') {
    const game = playCasinoLuckGame(interaction, options, () => playRoulette({
      choice: interaction.options.getString('선택', true),
      bet,
      randomInt: options.randomInt
    }));
    const settlement = await settleGame(interaction, economy, bet, game.payout, game);

    await interaction.reply(formatRouletteResult(interaction.user, game, settlement));
    return;
  }

  if (interaction.commandName === '바카라') {
    const game = playCasinoLuckGame(interaction, options, () => playBaccarat({
      choice: interaction.options.getString('선택', true),
      bet,
      randomInt: options.randomInt
    }));
    const settlement = await settleGame(interaction, economy, bet, game.payout, game);

    await interaction.reply(formatBaccaratResult(interaction.user, game, settlement));
    return;
  }

  if (interaction.commandName === '크랩스') {
    const game = playCasinoLuckGame(interaction, options, () => playCraps({
      choice: interaction.options.getString('선택', true),
      bet,
      randomInt: options.randomInt
    }));
    const settlement = await settleGame(interaction, economy, bet, game.payout, game);

    await interaction.reply(formatCrapsResult(interaction.user, game, settlement));
    return;
  }

  if (interaction.commandName === '시크보') {
    const game = playCasinoLuckGame(interaction, options, () => playSicBo({
      choice: interaction.options.getString('선택', true),
      bet,
      randomInt: options.randomInt
    }));
    const settlement = await settleGame(interaction, economy, bet, game.payout, game);

    await interaction.reply(formatSicBoResult(interaction.user, game, settlement));
    return;
  }

  if (interaction.commandName === '키노') {
    const game = playCasinoLuckGame(interaction, options, () => playKeno({
      numbers: interaction.options.getString('번호들', true),
      bet,
      randomInt: options.randomInt
    }));
    const settlement = await settleGame(interaction, economy, bet, game.payout, game);

    await interaction.reply(formatKenoResult(interaction.user, game, settlement));
    return;
  }
}

function formatCasinoInfo() {
  return [
    '🎰 **카지노 게임 정보**',
    '모든 게임은 봇 내부 골드만 사용하며 실제 현금 결제/현금 환전 기능은 없습니다.',
    '골드는 모든 컨텐츠가 공유하는 단일 잔액입니다.',
    '',
    '- `/홀짝`: 홀/짝 적중 시 1.9배, 99~100은 하우스 승리',
    '- `/주사위`: 높음(4~6) 또는 낮음(1~3) 적중 시 1.9배',
    '- `/슬롯`: 페어 3배, 트리플 10배, 7️⃣ 트리플 20배',
    `- \`/데드라인\`: 최소 ${DEADLINE_MIN_BET.toLocaleString()}골드, 버튼을 누를수록 누적 보상과 꽝 확률이 함께 상승, 멈추면 수령`,
    `- \`/타이밍\`: ${TIMING_TARGET_MIN_SECONDS}~${TIMING_TARGET_MAX_SECONDS}초 랜덤 목표에 가깝게 누를수록 최대 ${formatMultiplier(TIMING_PAYOUT_TIERS[0].multiplier)}배`,
    '- `/이모지경마`: 여러 명이 같은 판에 베팅, 총 베팅금에서 운영 수수료를 뺀 배당풀을 1등 동물 적중자끼리 지분 비례 분배',
    '- `/럭키세븐`: 주사위 2개 합이 7이면 5.5배',
    '- `/하이로우`: 두 번째 카드가 높음/낮음 적중 시 1.9배, 같은 숫자는 환불',
    '- `/블랙잭`: 승리 1.5배, 내추럴 블랙잭 2배, 무승부 환불',
    '- `/포커`: `시작칩`을 시작 스택으로 쓰는 텍사스 홀덤 포커방 생성, 원하는 유저가 참가하고 방장이 시작',
    '- `/룰렛`: 색상/홀짝/구간 2배, 0은 36배',
    '- `/바카라`: 플레이어 2배, 뱅커 1.95배, 타이 9배',
    '- `/크랩스`: 패스/돈패스 라인 승리 2배, 일부 무효는 환불',
    '- `/시크보`: 작음/큼 2배, 트리플 31배',
    '- `/키노`: 번호 1~5개 선택, 10개 추첨과 비교. 1개 이상 맞히면 선택 개수별 배수표로 환급 또는 당첨',
    `- \`/스크래치복권\`: 고정가 ${formatScratchTicketProductSummary()} 중 하나를 구매하고 버튼으로 9칸을 하나씩 공개, 같은 금액 3개면 해당 금액 지급`
  ].join('\n');
}

function createCasinoInfoPayload() {
  return {
    content: formatCasinoInfo(),
    components: []
  };
}

function createCasinoGamePayload({ content, userId, game, bet, choice = '-' }) {
  return {
    content,
    components: createCasinoReplayRows({ userId, game, bet, choice })
  };
}

function createCasinoReplayRows({ userId, game, bet, choice = '-' }) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(createCasinoQuickCustomId({ action: game, bet, choice, userId }))
        .setLabel(`다시 ${getCasinoQuickGameLabel(game)}`)
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(createCasinoQuickCustomId({ action: 'info', bet: 0, userId }))
        .setLabel('카지노정보')
        .setStyle(ButtonStyle.Secondary)
    )
  ];
}

function createCasinoQuickCustomId({ action, bet, choice = '-', userId }) {
  return `casino_quick:${action}:${bet}:${choice}:${userId}`;
}

function getCasinoQuickGameLabel(game) {
  if (game === 'slots') return '슬롯';
  if (game === 'odd_even') return '홀짝';
  if (game === 'dice') return '주사위';
  return '게임';
}

async function createEmojiRaceLobby(interaction, economy, logger, {
  bet,
  choice,
  randomInt,
  frameDelayMs = EMOJI_RACE_FRAME_DELAY_MS,
  sleep: sleepFn = sleep,
  casinoLuckOptions = {}
}) {
  let reserved = false;
  let lobbyId = null;

  try {
    await economy.reserveWager({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      username: interaction.user.username,
      bet
    });
    reserved = true;

    lobbyId = createChallengeId();
    const lobby = {
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      host: {
        userId: interaction.user.id,
        username: interaction.user.username
      },
      bets: [
        createEmojiRaceLobbyBet(interaction.user, choice, bet)
      ],
      unitBet: bet,
      maxPlayers: EMOJI_RACE_LOBBY_MAX_PLAYERS,
      randomInt: randomInt ?? null,
      frameDelayMs,
      sleep: sleepFn,
      reserved: true,
      mutating: false,
      processing: false,
      expiresAt: Date.now() + CHALLENGE_TTL_MS
    };

    pendingEmojiRaceLobbies.set(lobbyId, lobby);
    reserved = false;

    await interaction.reply(createEmojiRaceLobbyPayload(lobbyId, lobby));
  } catch (error) {
    if (lobbyId) pendingEmojiRaceLobbies.delete(lobbyId);
    if (reserved) {
      await economy.refundReservedWager({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        username: interaction.user.username,
        bet
      }).catch((refundError) => logger.error('Failed to refund emoji race wager:', refundError));
    }

    throw error;
  }
}

async function handleEmojiRaceButton(interaction, economy, logger, options = {}) {
  const [action, lobbyId, rawChoice] = interaction.customId.split(':');
  const lobby = pendingEmojiRaceLobbies.get(lobbyId);

  if (!lobby) {
    await safeReplyToInteraction(interaction, {
      content: '이미 만료되었거나 처리된 이모지 경마판입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (Date.now() > lobby.expiresAt) {
    pendingEmojiRaceLobbies.delete(lobbyId);
    await refundReservedEmojiRaceLobby(economy, logger, lobby);
    await interaction.update({
      content: '⏰ 이모지 경마판이 만료되었습니다. 예약된 베팅금은 환불되었습니다.',
      embeds: [],
      components: []
    });
    return true;
  }

  if (lobby.processing) {
    await safeReplyToInteraction(interaction, {
      content: '경마판을 처리 중입니다. 잠시만 기다려주세요.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (lobby.mutating) {
    await safeReplyToInteraction(interaction, {
      content: '이전 경마판 입력을 처리 중입니다. 잠시 후 다시 눌러주세요.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (['race_bet', 'race_leave', 'race_cancel'].includes(action)) {
    lobby.mutating = true;
    try {
      if (action === 'race_bet') {
        return await handleEmojiRaceBetButton(interaction, economy, logger, lobbyId, lobby, rawChoice);
      }

      if (action === 'race_leave') {
        return await handleEmojiRaceLeaveButton(interaction, economy, logger, lobbyId, lobby);
      }

      return await handleEmojiRaceCancelButton(interaction, economy, logger, lobbyId, lobby);
    } finally {
      if (pendingEmojiRaceLobbies.get(lobbyId) === lobby) {
        lobby.mutating = false;
      }
    }
  }

  if (action === 'race_start') {
    return handleEmojiRaceStartButton(interaction, economy, logger, lobbyId, lobby, options);
  }

  await safeReplyToInteraction(interaction, {
    content: '알 수 없는 이모지 경마 버튼입니다.',
    flags: MessageFlags.Ephemeral
  });
  return true;
}

async function handleEmojiRaceBetButton(interaction, economy, logger, lobbyId, lobby, rawChoice) {
  let choice;

  try {
    choice = normalizeEmojiRaceChoice(rawChoice);
  } catch (error) {
    await safeReplyToInteraction(interaction, {
      content: error.message,
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (interaction.user.bot) {
    await safeReplyToInteraction(interaction, {
      content: '봇 유저는 이모지 경마에 베팅할 수 없습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  const existingBet = lobby.bets.find((betEntry) => betEntry.userId === interaction.user.id);
  if (existingBet) {
    existingBet.choice = choice;
    lobby.expiresAt = Date.now() + CHALLENGE_TTL_MS;
    await interaction.update(createEmojiRaceLobbyPayload(lobbyId, lobby));
    return true;
  }

  if (lobby.bets.length >= lobby.maxPlayers) {
    await safeReplyToInteraction(interaction, {
      content: '이미 이모지 경마판 인원이 가득 찼습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  try {
    await economy.reserveWager({
      guildId: lobby.guildId,
      userId: interaction.user.id,
      username: interaction.user.username,
      bet: lobby.unitBet
    });
  } catch (error) {
    await safeReplyToInteraction(interaction, {
      content: `베팅 예약 실패: ${error.message}`,
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  lobby.bets.push(createEmojiRaceLobbyBet(interaction.user, choice, lobby.unitBet));
  lobby.reserved = true;
  lobby.expiresAt = Date.now() + CHALLENGE_TTL_MS;
  await interaction.update(createEmojiRaceLobbyPayload(lobbyId, lobby));
  return true;
}

async function handleEmojiRaceLeaveButton(interaction, economy, logger, lobbyId, lobby) {
  const betIndex = lobby.bets.findIndex((betEntry) => betEntry.userId === interaction.user.id);

  if (betIndex === -1) {
    await safeReplyToInteraction(interaction, {
      content: '이 이모지 경마판에 베팅 중이 아닙니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  const betEntry = lobby.bets[betIndex];
  if (betEntry.userId === lobby.host.userId) {
    await safeReplyToInteraction(interaction, {
      content: '방장은 나가기 대신 취소 버튼으로 경마판을 닫을 수 있습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  try {
    await economy.refundReservedWager({
      guildId: lobby.guildId,
      userId: betEntry.userId,
      username: betEntry.username,
      bet: betEntry.bet
    });
    betEntry.reserved = false;
  } catch (error) {
    logger.error?.('Failed to refund emoji race leave wager:', error);
    await safeReplyToInteraction(interaction, {
      content: `나가기 실패: ${error.message}`,
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  lobby.bets.splice(betIndex, 1);
  lobby.reserved = lobby.bets.some((entry) => entry.reserved);
  lobby.expiresAt = Date.now() + CHALLENGE_TTL_MS;
  await interaction.update(createEmojiRaceLobbyPayload(lobbyId, lobby));
  return true;
}

async function handleEmojiRaceCancelButton(interaction, economy, logger, lobbyId, lobby) {
  if (interaction.user.id !== lobby.host.userId) {
    await safeReplyToInteraction(interaction, {
      content: '이모지 경마판은 방장만 취소할 수 있습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  pendingEmojiRaceLobbies.delete(lobbyId);
  const refunded = await refundReservedEmojiRaceLobby(economy, logger, lobby);
  await interaction.update({
    content: `🏁 ${formatEmojiRaceParticipantMention(lobby.host)}님이 이모지 경마판을 취소했습니다. ${refunded}명의 베팅금을 환불했습니다.`,
    allowedMentions: { parse: [] },
    embeds: [],
    components: []
  });
  return true;
}

async function handleEmojiRaceStartButton(interaction, economy, logger, lobbyId, lobby, options = {}) {
  if (interaction.user.id !== lobby.host.userId) {
    await safeReplyToInteraction(interaction, {
      content: '이모지 경마판은 방장만 시작할 수 있습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (lobby.bets.length < EMOJI_RACE_LOBBY_MIN_PLAYERS) {
    await safeReplyToInteraction(interaction, {
      content: `이모지 경마 배당판은 최소 ${EMOJI_RACE_LOBBY_MIN_PLAYERS}명이 베팅해야 시작할 수 있습니다.`,
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  const acknowledged = await safeDeferUpdate(interaction);
  if (!acknowledged) {
    logger.warn?.('Emoji race interaction expired before it could be acknowledged.');
    return true;
  }

  if (pendingEmojiRaceLobbies.get(lobbyId) !== lobby) {
    await safeReplyToInteraction(interaction, {
      content: '이미 만료되었거나 처리된 이모지 경마판입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  lobby.processing = true;
  lobby.expiresAt = Date.now() + CHALLENGE_TTL_MS * 5;

  try {
    const race = playEmojiRacePool({
      bets: lobby.bets,
      randomInt: options.randomInt ?? lobby.randomInt ?? undefined
    });

    await sendInteractionUpdate(interaction, createEmojiRaceProgressPayload(lobby, race, race.frames[0]));

    for (const frame of race.frames.slice(1, -1)) {
      await waitForRaceFrame(options.raceDelayMs ?? lobby.frameDelayMs, lobby.sleep ?? sleep);
      await sendInteractionUpdate(interaction, createEmojiRaceProgressPayload(lobby, race, frame));
    }

    await waitForRaceFrame(options.raceDelayMs ?? lobby.frameDelayMs, lobby.sleep ?? sleep);
    const settlements = await resolveEmojiRacePoolSettlements(economy, lobby, race);
    pendingEmojiRaceLobbies.delete(lobbyId);

    await sendInteractionUpdate(interaction, createEmojiRaceResultPayload(lobby, race, settlements));
  } catch (error) {
    pendingEmojiRaceLobbies.delete(lobbyId);
    await refundReservedEmojiRaceLobby(economy, logger, lobby);
    logger.error?.('Emoji race failed:', error);
    const updated = await sendInteractionUpdate(interaction, createEmojiRaceFailurePayload(error));
    if (!updated) {
      logger.warn?.('Emoji race failure could not be sent because the interaction expired.');
    }
  } finally {
    if (pendingEmojiRaceLobbies.get(lobbyId) === lobby) {
      lobby.processing = false;
    }
  }

  return true;
}

function createEmojiRaceLobbyBet(user, choice, bet) {
  return {
    key: String(user.id),
    userId: String(user.id),
    username: String(user.username ?? user.id),
    choice: normalizeEmojiRaceChoice(choice),
    bet,
    reserved: true
  };
}

function createEmojiRaceLobbyPayload(lobbyId, lobby) {
  const embed = new EmbedBuilder()
    .setTitle('🏁 이모지 경마 배당판')
    .setDescription(formatEmojiRaceLobby(lobby))
    .setColor(0xf59e0b)
    .setFooter({ text: '베팅 버튼으로 참가/선택 변경, 방장이 시작하면 골드가 배당풀로 정산됩니다.' });

  return {
    embeds: [embed],
    allowedMentions: { parse: [] },
    components: createEmojiRaceLobbyRows(lobbyId, lobby)
  };
}

function createEmojiRaceLobbyRows(lobbyId, lobby) {
  const market = getEmojiRacePoolMarket(lobby.bets);
  const choiceRow = new ActionRowBuilder().addComponents(
    ...EMOJI_RACE_RACERS.map((racer) =>
      new ButtonBuilder()
        .setCustomId(`race_bet:${lobbyId}:${racer.id}`)
        .setLabel(`${racer.emoji} ${racer.name} ${market.countByChoice[racer.id]}명`)
        .setStyle(market.countByChoice[racer.id] > 0 ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setDisabled(lobby.processing)
    )
  );
  const controlRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`race_leave:${lobbyId}`)
      .setLabel('나가기')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(lobby.processing),
    new ButtonBuilder()
      .setCustomId(`race_start:${lobbyId}`)
      .setLabel('경주 시작')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(lobby.processing || lobby.bets.length < EMOJI_RACE_LOBBY_MIN_PLAYERS),
    new ButtonBuilder()
      .setCustomId(`race_cancel:${lobbyId}`)
      .setLabel('취소')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(lobby.processing)
  );

  return [choiceRow, controlRow];
}

function formatEmojiRaceLobby(lobby) {
  const market = getEmojiRacePoolMarket(lobby.bets);
  const betLines = lobby.bets.map((betEntry) =>
    `- ${formatEmojiRaceParticipantMention(betEntry)}: **${formatEmojiRaceChoice(betEntry.choice)}** · ${betEntry.bet.toLocaleString()}골드`
  );
  const oddsLines = EMOJI_RACE_RACERS.map((racer) => {
    const stake = market.stakeByChoice[racer.id];
    const count = market.countByChoice[racer.id];
    return `- ${racer.emoji} ${racer.name}: ${count}명 · ${stake.toLocaleString()}골드 · 현재 배당 ${formatEmojiRaceOdds(market.oddsByChoice[racer.id])}`;
  });

  return [
    `방장: ${formatEmojiRaceParticipantMention(lobby.host)}`,
    `참가: **${lobby.bets.length}/${lobby.maxPlayers}명** · 단위 베팅: **${lobby.unitBet.toLocaleString()}골드**`,
    `총 베팅: **${market.totalPool.toLocaleString()}골드** · 승자 배당풀: **${market.payoutPool.toLocaleString()}골드** · 운영 수수료: **${market.houseFee.toLocaleString()}골드**`,
    '',
    '**현재 배당률**',
    ...oddsLines,
    '',
    '**베팅 현황**',
    ...betLines,
    '',
    `${EMOJI_RACE_LOBBY_MIN_PLAYERS}명 이상 베팅하면 방장이 **경주 시작**을 누를 수 있습니다. 같은 유저가 동물 버튼을 다시 누르면 선택만 변경됩니다.`
  ].join('\n');
}

function createEmojiRaceProgressPayload(lobby, race, frame) {
  const embed = new EmbedBuilder()
    .setTitle(frame.turn === 0 ? '🏁 이모지 경마 출발!' : `🏁 이모지 경마 진행 중 · ${frame.turn}턴`)
    .setDescription([
      `참가: **${lobby.bets.length}명** · 총 베팅: **${race.market.totalPool.toLocaleString()}골드** · 배당풀: **${race.payoutPool.toLocaleString()}골드**`,
      `현재 선두가 확정되면 **${formatEmojiRaceChoice(race.winnerId)}** 적중자끼리 배당풀을 나눕니다.`,
      '',
      '```text',
      formatEmojiRaceTrack(frame),
      '```'
    ].join('\n'))
    .setColor(0xf59e0b)
    .setFooter({ text: '0.5초마다 트랙이 갱신됩니다.' });

  return {
    embeds: [embed],
    components: []
  };
}

async function resolveEmojiRacePoolSettlements(economy, lobby, race) {
  const settlements = [];

  for (const betEntry of race.bets) {
    const settlement = await economy.resolveReservedWager({
      guildId: lobby.guildId,
      userId: betEntry.userId,
      username: betEntry.username,
      bet: betEntry.bet,
      payout: betEntry.payout
    });
    const lobbyBet = lobby.bets.find((candidate) => candidate.key === betEntry.key);
    if (lobbyBet) lobbyBet.reserved = false;
    settlements.push({
      ...betEntry,
      settlement
    });
  }

  lobby.reserved = lobby.bets.some((betEntry) => betEntry.reserved);
  return settlements;
}

function createEmojiRaceResultPayload(lobby, race, settlements) {
  const settlementByKey = new Map(settlements.map((settlement) => [settlement.key, settlement]));
  const winnerBets = race.bets.filter((betEntry) => betEntry.win);
  const resultLines = race.bets.map((betEntry) => {
    const settlement = settlementByKey.get(betEntry.key);
    const payout = settlement?.settlement?.payout ?? betEntry.payout;
    const profit = settlement?.settlement?.profit ?? (payout - betEntry.bet);
    const profitText = profit >= 0
      ? `+${profit.toLocaleString()}골드`
      : `${profit.toLocaleString()}골드`;
    return `- ${formatEmojiRaceParticipantMention(betEntry)} (${formatEmojiRaceChoice(betEntry.choice)}): ${betEntry.win ? '✅ 적중' : '❌ 실패'} · 지급 ${payout.toLocaleString()}골드 · 손익 **${profitText}**`;
  });
  const embed = new EmbedBuilder()
    .setTitle('🏆 이모지 경마 결과')
    .setDescription([
      `승자: **${formatEmojiRaceChoice(race.winnerId)}**`,
      `총 베팅: **${race.market.totalPool.toLocaleString()}골드** · 배당풀: **${race.payoutPool.toLocaleString()}골드** · 운영 수수료: **${race.houseFee.toLocaleString()}골드**`,
      winnerBets.length > 0
        ? `적중: **${winnerBets.length}명** · 적중 지분: **${race.winnerStake.toLocaleString()}골드**`
        : '적중자가 없어 배당풀은 지급되지 않았습니다.',
      '',
      '```text',
      formatEmojiRaceTrack(race.finalFrame),
      '```',
      '',
      '**정산**',
      ...resultLines
    ].join('\n'))
    .setColor(winnerBets.length > 0 ? 0x22c55e : 0xef4444);

  return {
    embeds: [embed],
    allowedMentions: createAllowedMentionsForUsers(lobby.bets.map((betEntry) => betEntry.userId)),
    components: []
  };
}

function formatEmojiRaceParticipantMention(participant) {
  return formatUserMention(
    { id: participant.userId, username: participant.username },
    participant.username
  );
}

function formatEmojiRaceOdds(odds) {
  if (!Number.isFinite(odds) || odds <= 0) return '무베팅';
  if (Number.isInteger(odds)) return `${odds.toFixed(0)}배`;
  return `${odds.toFixed(2).replace(/0+$/u, '').replace(/\.$/u, '')}배`;
}

function createEmojiRaceFailurePayload(error) {
  const embed = new EmbedBuilder()
    .setTitle('⚠️ 이모지 경마 중단')
    .setDescription([
      `경마 처리 중 문제가 발생했습니다: ${error.message}`,
      '예약된 베팅금은 가능한 경우 자동 환불했습니다.'
    ].join('\n'))
    .setColor(0xef4444);

  return {
    embeds: [embed],
    components: []
  };
}


async function playScratchTicket(interaction, economy, productId, options = {}) {
  const product = getScratchTicketProduct(productId);
  let reserved = false;
  let gameId = null;

  try {
    await economy.reserveWager({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      username: interaction.user.username,
      bet: product.price
    });
    reserved = true;

    const ticket = playCasinoLuckGame(interaction, options, () => createScratchTicket({
      productId: product.id,
      randomInt: options.randomInt
    }), { isWin: (createdTicket) => Boolean(createdTicket.winningAmount) });
    gameId = createChallengeId();
    pendingScratchTickets.set(gameId, {
      guildId: interaction.guildId,
      userId: interaction.user.id,
      username: interaction.user.username,
      price: product.price,
      ticket,
      luckModifier: ticket.casinoLuckModifier,
      reserved: true,
      expiresAt: Date.now() + SCRATCH_TICKET_TTL_MS
    });

    await interaction.reply(createScratchTicketProgressPayload(interaction.user, ticket, gameId));
  } catch (error) {
    if (gameId) pendingScratchTickets.delete(gameId);
    if (reserved) {
      await economy.refundReservedWager({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        username: interaction.user.username,
        bet: product.price
      });
    }
    throw error;
  }
}

async function handleScratchTicketButton(interaction, economy, logger) {
  const [action, gameId, rawIndex] = interaction.customId.split(':');
  const pending = pendingScratchTickets.get(gameId);

  if (!pending) {
    await safeReplyToInteraction(interaction, {
      content: '이미 만료되었거나 처리된 스크래치 복권입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (interaction.user.id !== pending.userId) {
    await safeReplyToInteraction(interaction, {
      content: '이 스크래치 복권은 구매한 유저만 긁을 수 있습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (action !== 'scratch_reveal') {
    await safeReplyToInteraction(interaction, {
      content: '알 수 없는 스크래치 복권 버튼입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  const spotIndex = parseScratchTicketButtonIndex(rawIndex);
  if (spotIndex === null) {
    await safeReplyToInteraction(interaction, {
      content: `스크래치 복권 칸 번호는 1~${SCRATCH_TICKET_SPOT_COUNT} 사이여야 합니다.`,
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  const alreadyExpired = Date.now() > pending.expiresAt;
  if (!alreadyExpired && pending.ticket.revealed[spotIndex]) {
    await safeReplyToInteraction(interaction, {
      content: '이미 긁은 복권 칸입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  const acknowledged = await safeDeferUpdate(interaction);
  if (!acknowledged) {
    logger.warn?.('Scratch ticket interaction expired before it could be acknowledged.');
    return true;
  }

  const expired = Date.now() > pending.expiresAt;
  if (!expired && pending.ticket.revealed[spotIndex]) {
    await safeReplyToInteraction(interaction, {
      content: '이미 긁은 복권 칸입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  try {
    const ticket = expired
      ? revealAllScratchTicketSpots(pending.ticket)
      : revealScratchTicketSpot(pending.ticket, spotIndex);
    pending.ticket = ticket;

    if (ticket.status !== 'settled') {
      pending.expiresAt = Date.now() + SCRATCH_TICKET_TTL_MS;
      const updated = await sendInteractionUpdate(
        interaction,
        createScratchTicketProgressPayload(interaction.user, ticket, gameId)
      );
      if (!updated) {
        logger.warn?.('Scratch ticket progress could not be sent because the interaction expired.');
      }
      return true;
    }

    pendingScratchTickets.delete(gameId);
    const settlement = addCasinoLuckToSettlement(await economy.resolveReservedWager({
      guildId: pending.guildId,
      userId: pending.userId,
      username: pending.username,
      bet: pending.price,
      payout: ticket.payout
    }), pending.luckModifier);
    pending.reserved = false;

    const updated = await sendInteractionUpdate(
      interaction,
      createScratchTicketResultPayload(interaction.user, ticket, settlement, { expired })
    );
    if (!updated) {
      logger.warn?.('Scratch ticket result could not be sent because the interaction expired.');
    }
  } catch (error) {
    pendingScratchTickets.delete(gameId);
    if (pending.reserved) {
      await economy.refundReservedWager({
        guildId: pending.guildId,
        userId: pending.userId,
        username: pending.username,
        bet: pending.price
      }).catch((refundError) => logger.error('Failed to refund scratch ticket wager:', refundError));
    }
    logger.error(error);
    const updated = await sendInteractionUpdate(interaction, {
      content: `스크래치 복권 실패: ${error.message}`,
      components: []
    });
    if (!updated) {
      logger.warn?.('Scratch ticket failure could not be sent because the interaction expired.');
    }
  }

  return true;
}


async function playTiming(interaction, economy, bet, options = {}) {
  let reserved = false;
  let gameId = null;

  try {
    await economy.reserveWager({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      username: interaction.user.username,
      bet
    });
    reserved = true;

    const game = createTimingRound({
      bet,
      randomInt: options.randomInt,
      nowMs: getNowMsProvider(options)
    });
    gameId = createChallengeId();
    pendingTimingGames.set(gameId, {
      guildId: interaction.guildId,
      userId: interaction.user.id,
      username: interaction.user.username,
      bet,
      game,
      reserved: true,
      expiresAt: Date.now() + game.targetMs + CHALLENGE_TTL_MS
    });

    await interaction.reply(createTimingProgressPayload(interaction.user, game, gameId));
  } catch (error) {
    if (gameId) pendingTimingGames.delete(gameId);
    if (reserved) {
      await economy.refundReservedWager({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        username: interaction.user.username,
        bet
      });
    }
    throw error;
  }
}

async function handleTimingButton(interaction, economy, logger, options = {}) {
  const [action, gameId] = interaction.customId.split(':');
  const pending = pendingTimingGames.get(gameId);

  if (!pending) {
    await interaction.reply({
      content: '이미 만료되었거나 처리된 타이밍 게임입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (interaction.user.id !== pending.userId) {
    await interaction.reply({
      content: '이 타이밍 버튼은 게임을 시작한 유저만 누를 수 있습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (action !== 'timing_press') {
    await interaction.reply({
      content: '알 수 없는 타이밍 버튼입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  try {
    const game = resolveTimingRound(pending.game, {
      nowMs: getNowMsProvider(options)
    });
    pendingTimingGames.delete(gameId);
    const settlement = await economy.resolveReservedWager({
      guildId: pending.guildId,
      userId: pending.userId,
      username: pending.username,
      bet: pending.bet,
      payout: game.payout
    });
    pending.reserved = false;

    await interaction.update({
      content: formatTimingResult(interaction.user, game, settlement),
      allowedMentions: createAllowedMentionsForUsers([pending.userId]),
      components: []
    });
  } catch (error) {
    pendingTimingGames.delete(gameId);
    if (pending.reserved) {
      await economy.refundReservedWager({
        guildId: pending.guildId,
        userId: pending.userId,
        username: pending.username,
        bet: pending.bet
      }).catch((refundError) => logger.error('Failed to refund timing wager:', refundError));
    }
    logger.error(error);
    await interaction.update({
      content: `타이밍 게임 실패: ${error.message}`,
      components: []
    });
  }

  return true;
}

async function playPoker(interaction, economy, bet, options = {}) {
  let reserved = false;
  let gameId = null;

  try {
    await economy.reserveWager({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      username: interaction.user.username,
      bet
    });
    reserved = true;

    const game = createPokerRound({
      bet,
      deck: options.pokerDeck,
      randomInt: options.randomInt
    });
    gameId = createChallengeId();
    pendingPokerGames.set(gameId, {
      guildId: interaction.guildId,
      userId: interaction.user.id,
      username: interaction.user.username,
      bet,
      game,
      reserved: true,
      expiresAt: Date.now() + CHALLENGE_TTL_MS
    });

    await interaction.reply(createPokerProgressPayload(interaction.user, game, gameId));
  } catch (error) {
    if (gameId) pendingPokerGames.delete(gameId);
    if (reserved) {
      await economy.refundReservedWager({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        username: interaction.user.username,
        bet
      });
    }
    throw error;
  }
}

async function createPlayerPokerLobby(interaction, economy, bet, options = {}) {
  const hostProfile = await economy.getProfile(interaction.guildId, interaction.user.id, interaction.user.username);
  if (getCasinoChips(hostProfile) < bet) {
    throw new Error(`내 골드이 부족합니다. 현재 골드: ${getCasinoChips(hostProfile).toLocaleString()}골드`);
  }

  const host = {
    key: 'challenger',
    userId: interaction.user.id,
    username: interaction.user.username
  };
  const lobbyId = createChallengeId();
  const lobby = {
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    host,
    challenger: host,
    players: [host],
    maxPlayers: POKER_LOBBY_MAX_PLAYERS,
    bet,
    deck: options.playerPokerDeck ?? options.pokerDeck ?? null,
    expiresAt: Date.now() + CHALLENGE_TTL_MS
  };

  pendingPokerLobbies.set(lobbyId, lobby);

  await interaction.reply({
    content: formatPlayerPokerLobby(lobby),
    allowedMentions: { parse: [] },
    components: [createPlayerPokerLobbyRow(lobbyId, lobby)]
  });
}

function createPlayerPokerLobbyRow(lobbyId, lobby) {
  const isFull = lobby.players.length >= lobby.maxPlayers;
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`poker_join:${lobbyId}`)
      .setLabel('참가')
      .setStyle(ButtonStyle.Success)
      .setDisabled(isFull),
    new ButtonBuilder()
      .setCustomId(`poker_leave:${lobbyId}`)
      .setLabel('나가기')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`poker_start:${lobbyId}`)
      .setLabel('시작')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(lobby.players.length < 2),
    new ButtonBuilder()
      .setCustomId(`poker_cancel:${lobbyId}`)
      .setLabel('취소')
      .setStyle(ButtonStyle.Danger)
  );
}

function formatPlayerPokerLobby(lobby) {
  return [
    '🃏 **텍사스 홀덤 포커방**',
    `방장: ${formatPlayerPokerParticipantMention(lobby.host)}`,
    `인원: **${lobby.players.length}명** / 최대 **${lobby.maxPlayers}명**`,
    `참가자: ${lobby.players.map(formatPlayerPokerParticipantMention).join(', ')}`,
    `시작칩: **${lobby.bet.toLocaleString()}칩 = ${lobby.bet.toLocaleString()}골드**`,
    '시작 전에는 골드가 빠지지 않습니다. 시작하면 골드가 칩으로 바뀝니다.',
    '방식: **텍사스 홀덤** — 블라인드, 콜, 레이즈, 올인, 폴드로 칩 팟을 만들고 최종 남은 칩만 골드로 돌아옵니다.',
    '원하는 사람은 **참가**를 누르고, 방장은 2명 이상 모이면 **시작**을 누르세요.',
    '60초 동안 입력이 없으면 방이 만료됩니다.'
  ].join('\n');
}

function createPokerLobbyUpdatePayload(lobbyId, lobby) {
  return {
    content: formatPlayerPokerLobby(lobby),
    allowedMentions: { parse: [] },
    components: [createPlayerPokerLobbyRow(lobbyId, lobby)]
  };
}

function createPokerLobbyPlayerKey(index) {
  if (index === 0) return 'challenger';
  if (index === 1) return 'opponent';
  return `player${index}`;
}

function normalizePokerLobbyPlayersForGame(players) {
  return players.map((player, index) => ({
    ...player,
    key: createPokerLobbyPlayerKey(index)
  }));
}

function createPokerLobbyParticipant(user, index) {
  return {
    key: createPokerLobbyPlayerKey(index),
    userId: user.id,
    username: user.username
  };
}

async function reservePlayerPokerTable(economy, challenge) {
  if (challenge.players.length === 2 && typeof economy.reservePlayerPot === 'function') {
    return economy.reservePlayerPot({
      guildId: challenge.guildId,
      challenger: challenge.challenger,
      opponent: challenge.opponent,
      bet: challenge.bet
    });
  }

  if (typeof economy.reservePlayerTablePot !== 'function') {
    throw new Error('3인 이상 포커 예약 정산 기능을 사용할 수 없습니다.');
  }

  return economy.reservePlayerTablePot({
    guildId: challenge.guildId,
    players: challenge.players,
    bet: challenge.bet
  });
}

async function refundReservedPlayerPokerTable(economy, pending) {
  if (pending.players?.length > 2) {
    if (typeof economy.resolveReservedPlayerTableStacks !== 'function') {
      throw new Error('3인 이상 포커 환불 기능을 사용할 수 없습니다.');
    }
    return economy.resolveReservedPlayerTableStacks({
      guildId: pending.guildId,
      players: pending.players,
      bet: pending.bet,
      pot: 0,
      winnerUserIds: [],
      payouts: Object.fromEntries(pending.players.map((player) => [player.key, pending.bet]))
    });
  }

  return economy.resolveReservedPlayerPot({
    guildId: pending.guildId,
    challenger: pending.challenger,
    opponent: pending.opponent,
    bet: pending.bet,
    winnerUserId: null
  });
}

async function handlePokerButton(interaction, economy, logger) {
  const [action, gameId, rawIndex] = interaction.customId.split(':');

  if (['poker_join', 'poker_leave', 'poker_start', 'poker_cancel'].includes(action)) {
    return handlePokerLobbyButton(interaction, economy, logger);
  }

  if ([
    'poker_pvp_peek',
    'poker_pvp_check',
    'poker_pvp_call',
    'poker_pvp_half_pot',
    'poker_pvp_pot',
    'poker_pvp_all_in',
    'poker_pvp_fold'
  ].includes(action)) {
    return handlePlayerPokerButton(interaction, economy, logger);
  }

  const pending = pendingPokerGames.get(gameId);

  if (!pending) {
    await safeReplyToInteraction(interaction, {
      content: '이미 만료되었거나 처리된 포커입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (interaction.user.id !== pending.userId) {
    await safeReplyToInteraction(interaction, {
      content: '이 포커는 시작한 유저만 조작할 수 있습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (!['poker_hold', 'poker_recommend', 'poker_clear', 'poker_draw'].includes(action)) {
    await safeReplyToInteraction(interaction, {
      content: '알 수 없는 포커 버튼입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  const acknowledged = await safeDeferUpdate(interaction);
  if (!acknowledged) {
    logger.warn?.('Poker interaction expired before it could be acknowledged.');
    return true;
  }

  if (pendingPokerGames.get(gameId) !== pending) {
    await safeReplyToInteraction(interaction, {
      content: '이미 만료되었거나 처리된 포커입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (pending.processing) {
    await safeReplyToInteraction(interaction, {
      content: '이전 포커 입력을 처리 중입니다. 잠시 후 다시 눌러주세요.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  pending.processing = true;

  try {
    if (Date.now() > pending.expiresAt) {
      pendingPokerGames.delete(gameId);
      await economy.refundReservedWager({
        guildId: pending.guildId,
        userId: pending.userId,
        username: pending.username,
        bet: pending.bet
      });
      pending.reserved = false;
      const updated = await sendInteractionUpdate(interaction, {
        content: '⏰ 포커가 만료되었습니다. 베팅금은 환불되었습니다.',
        components: []
      });
      if (!updated) {
        logger.warn?.('Poker expired message could not be sent because the interaction expired.');
      }
      return true;
    }

    if (action === 'poker_hold') {
      pending.game = togglePokerHold(pending.game, Number(rawIndex));
      pending.expiresAt = Date.now() + CHALLENGE_TTL_MS;
      const updated = await sendInteractionUpdate(
        interaction,
        createPokerProgressPayload(interaction.user, pending.game, gameId)
      );
      if (!updated) {
        logger.warn?.('Poker progress could not be sent because the interaction expired.');
      }
      return true;
    }

    if (action === 'poker_recommend') {
      pending.game = applyPokerRecommendedHold(pending.game);
      pending.expiresAt = Date.now() + CHALLENGE_TTL_MS;
      const updated = await sendInteractionUpdate(
        interaction,
        createPokerProgressPayload(interaction.user, pending.game, gameId)
      );
      if (!updated) {
        logger.warn?.('Poker recommendation could not be sent because the interaction expired.');
      }
      return true;
    }

    if (action === 'poker_clear') {
      pending.game = clearPokerHold(pending.game);
      pending.expiresAt = Date.now() + CHALLENGE_TTL_MS;
      const updated = await sendInteractionUpdate(
        interaction,
        createPokerProgressPayload(interaction.user, pending.game, gameId)
      );
      if (!updated) {
        logger.warn?.('Poker clear-hold update could not be sent because the interaction expired.');
      }
      return true;
    }

    const game = drawPokerRound(pending.game);
    pendingPokerGames.delete(gameId);
    const settlement = await economy.resolveReservedWager({
      guildId: pending.guildId,
      userId: pending.userId,
      username: pending.username,
      bet: pending.bet,
      payout: game.payout
    });
    pending.reserved = false;
    const updated = await sendInteractionUpdate(interaction, {
      content: formatPokerResult(interaction.user, game, settlement),
      allowedMentions: createAllowedMentionsForUsers([pending.userId]),
      components: []
    });
    if (!updated) {
      logger.warn?.('Poker result could not be sent because the interaction expired.');
    }
  } catch (error) {
    pendingPokerGames.delete(gameId);
    if (pending.reserved) {
      await economy.refundReservedWager({
        guildId: pending.guildId,
        userId: pending.userId,
        username: pending.username,
        bet: pending.bet
      }).catch((refundError) => logger.error('Failed to refund poker wager:', refundError));
    }
    logger.error(error);
    const updated = await sendInteractionUpdate(interaction, {
      content: `포커 실패: ${error.message}`,
      components: []
    });
    if (!updated) {
      logger.warn?.('Poker failure could not be sent because the interaction expired.');
    }
  } finally {
    if (pendingPokerGames.get(gameId) === pending) {
      pending.processing = false;
    }
  }

  return true;
}

async function handlePokerLobbyButton(interaction, economy, logger) {
  const [action, lobbyId] = interaction.customId.split(':');
  const lobby = pendingPokerLobbies.get(lobbyId);

  if (!lobby) {
    await safeReplyToInteraction(interaction, {
      content: '이미 만료되었거나 처리된 포커방입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (Date.now() > lobby.expiresAt) {
    pendingPokerLobbies.delete(lobbyId);
    await interaction.update({
      content: '⏰ 포커방이 만료되었습니다.',
      components: []
    });
    return true;
  }

  if (action === 'poker_join') {
    if (interaction.user.bot) {
      await safeReplyToInteraction(interaction, {
        content: '봇 유저는 포커방에 참가할 수 없습니다.',
        flags: MessageFlags.Ephemeral
      });
      return true;
    }

    if (lobby.players.some((player) => player.userId === interaction.user.id)) {
      await safeReplyToInteraction(interaction, {
        content: '이미 이 포커방에 참가했습니다.',
        flags: MessageFlags.Ephemeral
      });
      return true;
    }

    if (lobby.players.length >= lobby.maxPlayers) {
      await safeReplyToInteraction(interaction, {
        content: '이미 포커방 인원이 가득 찼습니다.',
        flags: MessageFlags.Ephemeral
      });
      return true;
    }

    const profile = await economy.getProfile(interaction.guildId, interaction.user.id, interaction.user.username);
    if (getCasinoChips(profile) < lobby.bet) {
      await safeReplyToInteraction(interaction, {
        content: `골드이 부족합니다. 현재 골드: ${getCasinoChips(profile).toLocaleString()}골드`,
        flags: MessageFlags.Ephemeral
      });
      return true;
    }

    lobby.players.push(createPokerLobbyParticipant(interaction.user, lobby.players.length));
    lobby.expiresAt = Date.now() + CHALLENGE_TTL_MS;
    await interaction.update(createPokerLobbyUpdatePayload(lobbyId, lobby));
    return true;
  }

  if (action === 'poker_leave') {
    const playerIndex = lobby.players.findIndex((player) => player.userId === interaction.user.id);
    if (playerIndex === -1) {
      await safeReplyToInteraction(interaction, {
        content: '이 포커방에 참가 중이 아닙니다.',
        flags: MessageFlags.Ephemeral
      });
      return true;
    }

    if (lobby.players[playerIndex].userId === lobby.host.userId) {
      await safeReplyToInteraction(interaction, {
        content: '방장은 나가기 대신 취소 버튼으로 방을 닫을 수 있습니다.',
        flags: MessageFlags.Ephemeral
      });
      return true;
    }

    lobby.players.splice(playerIndex, 1);
    lobby.expiresAt = Date.now() + CHALLENGE_TTL_MS;
    await interaction.update(createPokerLobbyUpdatePayload(lobbyId, lobby));
    return true;
  }

  if (action === 'poker_cancel') {
    if (interaction.user.id !== lobby.host.userId) {
      await safeReplyToInteraction(interaction, {
        content: '포커방은 방장만 취소할 수 있습니다.',
        flags: MessageFlags.Ephemeral
      });
      return true;
    }

    pendingPokerLobbies.delete(lobbyId);
    await interaction.update({
      content: `🃏 ${formatPlayerPokerParticipantMention(lobby.host)}님이 포커방을 취소했습니다.`,
      allowedMentions: { parse: [] },
      components: []
    });
    return true;
  }

  if (action !== 'poker_start') {
    await safeReplyToInteraction(interaction, {
      content: '알 수 없는 포커방 버튼입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (interaction.user.id !== lobby.host.userId) {
    await safeReplyToInteraction(interaction, {
      content: '포커방은 방장만 시작할 수 있습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (lobby.players.length < 2) {
    await safeReplyToInteraction(interaction, {
      content: '텍사스 홀덤은 최소 2명이 필요합니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (lobby.processing) {
    await safeReplyToInteraction(interaction, {
      content: '포커방을 시작하는 중입니다. 잠시 후 다시 확인해주세요.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  lobby.processing = true;
  let reserved = false;
  let reservedTable = null;

  try {
    const tablePlayers = normalizePokerLobbyPlayersForGame(lobby.players);
    const table = {
      ...lobby,
      players: tablePlayers,
      host: tablePlayers[0],
      challenger: tablePlayers[0],
      opponent: tablePlayers[1]
    };
    reservedTable = table;
    const gameId = createChallengeId();
    await reservePlayerPokerTable(economy, table);
    reserved = true;

    const game = createPlayerHoldemRound({
      bet: table.bet,
      players: table.players.map((player) => player.key),
      deck: table.deck
    });

    pendingPokerLobbies.delete(lobbyId);
    pendingPlayerPokerGames.set(gameId, {
      ...table,
      game,
      reserved: true,
      processing: false,
      expiresAt: Date.now() + CHALLENGE_TTL_MS
    });

    await interaction.update(createPlayerPokerProgressPayload(
      table,
      game,
      createPlayerPokerRows(gameId, game)
    ));
  } catch (error) {
    pendingPokerLobbies.delete(lobbyId);
    if (reserved) {
      await refundReservedPlayerPokerTable(economy, reservedTable ?? lobby)
        .catch((refundError) => logger.error('Failed to refund poker pot:', refundError));
    }
    logger.error(error);
    await interaction.update({
      content: `포커방 시작 실패: ${error.message}`,
      components: []
    });
  } finally {
    lobby.processing = false;
  }

  return true;
}

async function handlePlayerPokerButton(interaction, economy, logger) {
  const [action, gameId] = interaction.customId.split(':');
  const pending = pendingPlayerPokerGames.get(gameId);

  if (!pending) {
    await safeReplyToInteraction(interaction, {
      content: '이미 만료되었거나 처리된 포커 대결입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  const participant = getPlayerPokerParticipant(pending, interaction.user.id);
  if (!participant) {
    await safeReplyToInteraction(interaction, {
      content: '이 포커 대결의 참여자만 버튼을 누를 수 있습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (action === 'poker_pvp_peek') {
    await safeReplyToInteraction(interaction, {
      content: formatPlayerPokerPrivateHand(pending, participant),
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] }
    });
    return true;
  }

  if (![
    'poker_pvp_check',
    'poker_pvp_call',
    'poker_pvp_half_pot',
    'poker_pvp_pot',
    'poker_pvp_all_in',
    'poker_pvp_fold'
  ].includes(action)) {
    await safeReplyToInteraction(interaction, {
      content: '알 수 없는 포커 대결 버튼입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (pending.game.currentTurn !== participant) {
    await safeReplyToInteraction(interaction, {
      content: '아직 내 차례가 아닙니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  const acknowledged = await safeDeferUpdate(interaction);
  if (!acknowledged) {
    logger.warn?.('Player poker interaction expired before it could be acknowledged.');
    return true;
  }

  if (pendingPlayerPokerGames.get(gameId) !== pending) {
    await safeReplyToInteraction(interaction, {
      content: '이미 만료되었거나 처리된 포커 대결입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (pending.processing) {
    await safeReplyToInteraction(interaction, {
      content: '이전 포커 입력을 처리 중입니다. 잠시 후 다시 눌러주세요.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  pending.processing = true;

  try {
    if (Date.now() > pending.expiresAt) {
      pendingPlayerPokerGames.delete(gameId);
      await refundReservedPlayerPokerTable(economy, pending);
      pending.reserved = false;
      const updated = await sendInteractionUpdate(interaction, {
        content: '⏰ 포커 대결이 만료되었습니다. 양쪽 베팅금은 환불되었습니다.',
        components: []
      });
      if (!updated) {
        logger.warn?.('Player poker expired message could not be sent because the interaction expired.');
      }
      return true;
    }

    const game = actPlayerHoldemRound(
      pending.game,
      participant,
      getPlayerPokerAction(action)
    );
    pending.game = game;

    if (game.status !== 'settled') {
      pending.expiresAt = Date.now() + CHALLENGE_TTL_MS;
      const updated = await sendInteractionUpdate(
        interaction,
        createPlayerPokerProgressPayload(
          pending,
          game,
          createPlayerPokerRows(gameId, game)
        )
      );
      if (!updated) {
        logger.warn?.('Player poker progress update could not be sent because the interaction expired.');
      }
      return true;
    }

    pendingPlayerPokerGames.delete(gameId);
    const settlement = await resolveReservedPlayerPokerStack(economy, pending, game);
    pending.reserved = false;

    const updated = await sendInteractionUpdate(
      interaction,
      createPlayerPokerResultPayload(pending, game, settlement)
    );
    if (!updated) {
      logger.warn?.('Player poker result could not be sent because the interaction expired.');
    }
  } catch (error) {
    pendingPlayerPokerGames.delete(gameId);
    if (pending.reserved) {
      await refundReservedPlayerPokerTable(economy, pending)
        .catch((refundError) => logger.error('Failed to refund poker pot:', refundError));
    }
    logger.error(error);
    const updated = await sendInteractionUpdate(interaction, {
      content: `포커 대결 실패: ${error.message}`,
      components: []
    });
    if (!updated) {
      logger.warn?.('Player poker failure could not be sent because the interaction expired.');
    }
  } finally {
    if (pendingPlayerPokerGames.get(gameId) === pending) {
      pending.processing = false;
    }
  }

  return true;
}

function getPlayerPokerAction(action) {
  if (action === 'poker_pvp_fold') return 'fold';
  if (action === 'poker_pvp_check') return 'check';
  if (action === 'poker_pvp_call') return 'call';
  if (action === 'poker_pvp_half_pot') return 'half_pot';
  if (action === 'poker_pvp_pot') return 'pot';
  if (action === 'poker_pvp_all_in') return 'all_in';
  throw new Error('알 수 없는 포커 대결 버튼입니다.');
}

async function resolveReservedPlayerPokerStack(economy, pending, game) {
  if (pending.players?.length > 2) {
    if (typeof economy.resolveReservedPlayerTableStacks !== 'function') {
      throw new Error('3인 이상 포커 스택 정산 기능을 사용할 수 없습니다.');
    }
    return economy.resolveReservedPlayerTableStacks({
      guildId: pending.guildId,
      players: pending.players,
      bet: pending.bet,
      pot: game.pot,
      winnerUserIds: game.winners.map((winnerKey) => getPlayerPokerParticipantInfo(pending, winnerKey)?.userId).filter(Boolean),
      payouts: Object.fromEntries(game.players.map((player) => [player.key, player.stack]))
    });
  }

  const winnerUserId = game.winner === 'challenger'
    ? pending.challenger.userId
    : game.winner === 'opponent'
      ? pending.opponent.userId
      : null;
  const payload = {
    guildId: pending.guildId,
    challenger: pending.challenger,
    opponent: pending.opponent,
    bet: pending.bet,
    pot: game.pot,
    winnerUserId,
    challengerPayout: game.challenger.stack,
    opponentPayout: game.opponent.stack
  };

  if (typeof economy.resolveReservedPlayerStackPot === 'function') {
    return economy.resolveReservedPlayerStackPot(payload);
  }

  if (typeof economy.resolveReservedPlayerPot !== 'function') {
    throw new Error('포커 스택 정산 기능을 사용할 수 없습니다.');
  }

  if (payload.challengerPayout === pending.bet && payload.opponentPayout === pending.bet) {
    return economy.resolveReservedPlayerPot({
      guildId: pending.guildId,
      challenger: pending.challenger,
      opponent: pending.opponent,
      bet: pending.bet,
      winnerUserId: null
    });
  }

  if (payload.winnerUserId && (
    (payload.winnerUserId === pending.challenger.userId && payload.challengerPayout === pending.bet * 2 && payload.opponentPayout === 0)
      || (payload.winnerUserId === pending.opponent.userId && payload.opponentPayout === pending.bet * 2 && payload.challengerPayout === 0)
  )) {
    return economy.resolveReservedPlayerPot({
      guildId: pending.guildId,
      challenger: pending.challenger,
      opponent: pending.opponent,
      bet: pending.bet,
      winnerUserId: payload.winnerUserId
    });
  }

  throw new Error('현재 경제 서비스가 부분 팟 정산을 지원하지 않습니다.');
}

async function playDeadline(interaction, economy, bet) {
  let reserved = false;
  let gameId = null;

  try {
    const game = createDeadlineRound({ bet });

    await economy.reserveWager({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      username: interaction.user.username,
      bet
    });
    reserved = true;

    gameId = createChallengeId();
    pendingDeadlineGames.set(gameId, {
      guildId: interaction.guildId,
      userId: interaction.user.id,
      username: interaction.user.username,
      bet,
      game,
      reserved: true,
      expiresAt: Date.now() + CHALLENGE_TTL_MS
    });

    await interaction.reply(createDeadlineProgressPayload(interaction.user, game, gameId));
  } catch (error) {
    if (gameId) pendingDeadlineGames.delete(gameId);
    if (reserved) {
      await economy.refundReservedWager({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        username: interaction.user.username,
        bet
      });
    }
    throw error;
  }
}

async function handleDeadlineButton(interaction, economy, logger, options = {}) {
  const [action, gameId] = interaction.customId.split(':');
  const pending = pendingDeadlineGames.get(gameId);

  if (!pending) {
    await safeReplyToInteraction(interaction, {
      content: '이미 만료되었거나 처리된 데드라인입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (interaction.user.id !== pending.userId) {
    await safeReplyToInteraction(interaction, {
      content: '이 데드라인 버튼은 게임을 시작한 유저만 누를 수 있습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (!['deadline_press', 'deadline_cashout'].includes(action)) {
    await safeReplyToInteraction(interaction, {
      content: '알 수 없는 데드라인 버튼입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  const acknowledged = await safeDeferUpdate(interaction);
  if (!acknowledged) {
    logger.warn?.('Deadline interaction expired before it could be acknowledged.');
    return true;
  }

  if (pendingDeadlineGames.get(gameId) !== pending) {
    await safeReplyToInteraction(interaction, {
      content: '이미 만료되었거나 처리된 데드라인입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (pending.processing) {
    await safeReplyToInteraction(interaction, {
      content: '이전 데드라인 입력을 처리 중입니다. 잠시 후 다시 눌러주세요.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  pending.processing = true;

  try {
    if (Date.now() > pending.expiresAt) {
      const game = cashOutDeadlineRound(pending.game);
      pendingDeadlineGames.delete(gameId);
      const settlement = await economy.resolveReservedWager({
        guildId: pending.guildId,
        userId: pending.userId,
        username: pending.username,
        bet: pending.bet,
        payout: game.payout
      });
      pending.reserved = false;
      const updated = await sendInteractionUpdate(interaction, {
        content: formatDeadlineExpiredResult(interaction.user, game, settlement),
        allowedMentions: createAllowedMentionsForUsers([pending.userId]),
        components: []
      });
      if (!updated) {
        logger.warn?.('Deadline expired result could not be sent because the interaction expired.');
      }
      return true;
    }

    if (action === 'deadline_cashout') {
      const game = cashOutDeadlineRound(pending.game);
      pendingDeadlineGames.delete(gameId);
      const settlement = await economy.resolveReservedWager({
        guildId: pending.guildId,
        userId: pending.userId,
        username: pending.username,
        bet: pending.bet,
        payout: game.payout
      });
      pending.reserved = false;
      const updated = await sendInteractionUpdate(interaction, {
        content: formatDeadlineResult(interaction.user, game, settlement),
        allowedMentions: createAllowedMentionsForUsers([pending.userId]),
        components: []
      });
      if (!updated) {
        logger.warn?.('Deadline cashout result could not be sent because the interaction expired.');
      }
      return true;
    }

    const game = pressDeadlineRoundWithCasinoLuck(interaction, pending.game, {
      randomInt: options.randomInt
    });
    pending.game = game;

    if (game.status === 'pressing') {
      pending.expiresAt = Date.now() + CHALLENGE_TTL_MS;
      const updated = await sendInteractionUpdate(
        interaction,
        createDeadlineProgressPayload(interaction.user, game, gameId)
      );
      if (!updated) {
        logger.warn?.('Deadline progress could not be sent because the interaction expired.');
      }
      return true;
    }

    pendingDeadlineGames.delete(gameId);
    const settlement = await economy.resolveReservedWager({
      guildId: pending.guildId,
      userId: pending.userId,
      username: pending.username,
      bet: pending.bet,
      payout: game.payout
    });
    pending.reserved = false;
    const updated = await sendInteractionUpdate(interaction, {
      content: formatDeadlineResult(interaction.user, game, settlement),
      allowedMentions: createAllowedMentionsForUsers([pending.userId]),
      components: []
    });
    if (!updated) {
      logger.warn?.('Deadline result could not be sent because the interaction expired.');
    }
  } catch (error) {
    pendingDeadlineGames.delete(gameId);
    if (pending.reserved) {
      await economy.refundReservedWager({
        guildId: pending.guildId,
        userId: pending.userId,
        username: pending.username,
        bet: pending.bet
      }).catch((refundError) => logger.error('Failed to refund deadline wager:', refundError));
    }
    logger.error(error);
    const updated = await sendInteractionUpdate(interaction, {
      content: `데드라인 실패: ${error.message}`,
      components: []
    });
    if (!updated) {
      logger.warn?.('Deadline failure could not be sent because the interaction expired.');
    }
  } finally {
    if (pendingDeadlineGames.get(gameId) === pending) {
      pending.processing = false;
    }
  }

  return true;
}

async function playAiBlackjack(interaction, economy, bet) {
  let reserved = false;
  let gameId = null;

  try {
    await economy.reserveWager({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      username: interaction.user.username,
      bet
    });
    reserved = true;

    const game = createBlackjackRound({ bet });

    if (game.status === 'settled') {
      const settlement = await economy.resolveReservedWager({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        username: interaction.user.username,
        bet,
        payout: game.payout
      });
      reserved = false;
      await interaction.reply(formatAiBlackjackResult(interaction.user, game, settlement));
      return;
    }

    gameId = createChallengeId();
    pendingAiBlackjackGames.set(gameId, {
      guildId: interaction.guildId,
      userId: interaction.user.id,
      username: interaction.user.username,
      bet,
      game,
      reserved: true,
      expiresAt: Date.now() + CHALLENGE_TTL_MS
    });

    await interaction.reply({
      content: formatAiBlackjackProgress(interaction.user, game),
      components: [createBlackjackActionRow(gameId)]
    });
  } catch (error) {
    if (gameId) pendingAiBlackjackGames.delete(gameId);
    if (reserved) {
      await economy.refundReservedWager({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        username: interaction.user.username,
        bet
      });
    }
    throw error;
  }
}

async function createPlayerBlackjackChallenge(interaction, economy, bet, opponent) {
  if (opponent.bot) {
    throw new Error('봇 유저와는 대결할 수 없습니다. 상대를 비우면 AI와 대결합니다.');
  }

  if (opponent.id === interaction.user.id) {
    throw new Error('자기 자신과는 대결할 수 없습니다.');
  }

  const challengerProfile = await economy.getProfile(interaction.guildId, interaction.user.id, interaction.user.username);
  const opponentProfile = await economy.getProfile(interaction.guildId, opponent.id, opponent.username);

  if (getCasinoChips(challengerProfile) < bet) {
    throw new Error(`내 골드이 부족합니다. 현재 골드: ${getCasinoChips(challengerProfile).toLocaleString()}골드`);
  }

  if (getCasinoChips(opponentProfile) < bet) {
    throw new Error(`${opponent.username}님의 골드이 부족합니다. 현재 골드: ${getCasinoChips(opponentProfile).toLocaleString()}골드`);
  }

  const challengeId = createChallengeId();
  pendingBlackjackChallenges.set(challengeId, {
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    challenger: {
      userId: interaction.user.id,
      username: interaction.user.username
    },
    opponent: {
      userId: opponent.id,
      username: opponent.username
    },
    bet,
    expiresAt: Date.now() + CHALLENGE_TTL_MS
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`blackjack_accept:${challengeId}`)
      .setLabel('수락')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`blackjack_decline:${challengeId}`)
      .setLabel('거절')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.reply({
    content: `🃏 ${formatUserMention(opponent, opponent.username)}, ${formatUserMention(interaction.user, interaction.user.username)}님이 블랙잭 대결을 신청했습니다.\n베팅: **${bet.toLocaleString()}골드씩**, 승자 독식: **${(bet * 2).toLocaleString()}골드**\n60초 안에 수락해주세요.`,
    allowedMentions: createAllowedMentionsForUsers([interaction.user.id, opponent.id]),
    components: [row]
  });
}

async function handleBlackjackButton(interaction, economy, logger) {
  if (!interaction.customId.startsWith('blackjack_')) return false;

  const [action] = interaction.customId.split(':');

  if (action === 'blackjack_hit' || action === 'blackjack_stand') {
    return handleAiBlackjackButton(interaction, economy, logger);
  }

  if (action === 'blackjack_pvp_hit' || action === 'blackjack_pvp_stand') {
    return handlePlayerBlackjackButton(interaction, economy, logger);
  }

  return handleBlackjackChallengeButton(interaction, economy, logger);
}

async function handleCasinoQuickButton(interaction, economy, logger, options = {}) {
  const [, action, rawBet, choice = '-', ownerId] = interaction.customId.split(':');

  if (ownerId && interaction.user.id !== ownerId) {
    await interaction.reply({
      content: '이 카지노 버튼은 명령어를 실행한 유저만 사용할 수 있습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (action === 'info') {
    await interaction.update(createCasinoInfoPayload());
    return true;
  }

  if (!interaction.inGuild()) {
    await interaction.reply({
      content: '서버에서만 사용할 수 있는 명령어입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  const bet = Number.parseInt(rawBet, 10);
  if (!Number.isSafeInteger(bet) || bet <= 0) {
    await interaction.reply({
      content: '버튼 베팅금이 올바르지 않습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  try {
    if (action === 'slots') {
      const game = playCasinoLuckGame(interaction, options, () => playSlots({
        bet,
        randomInt: options.randomInt
      }));
      const settlement = await settleGame(interaction, economy, bet, game.payout, game);
      await interaction.reply(createCasinoGamePayload({
        content: formatSlotResult(interaction.user, game, settlement),
        userId: interaction.user.id,
        game: action,
        bet
      }));
      return true;
    }

    if (action === 'odd_even') {
      const normalizedChoice = normalizeOddEvenChoice(choice);
      const game = playCasinoLuckGame(interaction, options, () => playOddEven({
        choice: normalizedChoice,
        bet,
        randomInt: options.randomInt
      }));
      const settlement = await settleGame(interaction, economy, bet, game.payout, game);
      await interaction.reply(createCasinoGamePayload({
        content: formatOddEvenResult(interaction.user, game, settlement),
        userId: interaction.user.id,
        game: action,
        bet,
        choice: normalizedChoice
      }));
      return true;
    }

    if (action === 'dice') {
      const normalizedChoice = normalizeDiceChoice(choice);
      const game = playCasinoLuckGame(interaction, options, () => playDice({
        choice: normalizedChoice,
        bet,
        randomInt: options.randomInt
      }));
      const settlement = await settleGame(interaction, economy, bet, game.payout, game);
      await interaction.reply(createCasinoGamePayload({
        content: formatDiceResult(interaction.user, game, settlement),
        userId: interaction.user.id,
        game: action,
        bet,
        choice: normalizedChoice
      }));
      return true;
    }

    await interaction.reply({
      content: '알 수 없는 카지노 빠른 버튼입니다.',
      flags: MessageFlags.Ephemeral
    });
  } catch (error) {
    logUnexpectedInteractionError(logger, error, 'Casino quick button rejected');
    await safeReplyToInteraction(interaction, {
      content: `게임 실패: ${error.message}`,
      flags: MessageFlags.Ephemeral
    });
  }

  return true;
}

async function handleBlackjackChallengeButton(interaction, economy, logger) {
  const [action, challengeId] = interaction.customId.split(':');
  const challenge = pendingBlackjackChallenges.get(challengeId);

  if (!challenge) {
    await interaction.reply({
      content: '이미 만료되었거나 처리된 대결입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (interaction.user.id !== challenge.opponent.userId) {
    await interaction.reply({
      content: '이 대결의 상대만 버튼을 누를 수 있습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (Date.now() > challenge.expiresAt) {
    pendingBlackjackChallenges.delete(challengeId);
    await interaction.update({
      content: '⏰ 블랙잭 대결 신청이 만료되었습니다.',
      components: []
    });
    return true;
  }

  pendingBlackjackChallenges.delete(challengeId);

  if (action === 'blackjack_decline') {
    await interaction.update({
      content: `🃏 ${formatUserMention(interaction.user, interaction.user.username)}님이 블랙잭 대결을 거절했습니다.`,
      allowedMentions: createAllowedMentionsForUsers([
        challenge.challenger.userId,
        challenge.opponent.userId
      ]),
      components: []
    });
    return true;
  }

  let reserved = false;

  try {
    const gameId = createChallengeId();
    await economy.reservePlayerPot({
      guildId: challenge.guildId,
      challenger: challenge.challenger,
      opponent: challenge.opponent,
      bet: challenge.bet
    });
    reserved = true;
    const game = createPlayerBlackjackRound({ bet: challenge.bet });
    pendingPlayerBlackjackGames.set(gameId, {
      ...challenge,
      game,
      reserved: true,
      expiresAt: Date.now() + CHALLENGE_TTL_MS
    });

    await interaction.update(createPlayerBlackjackProgressPayload(challenge, game, [
      createPlayerBlackjackActionRow(gameId)
    ]));
  } catch (error) {
    if (reserved) {
      await economy.resolveReservedPlayerPot({
        guildId: challenge.guildId,
        challenger: challenge.challenger,
        opponent: challenge.opponent,
        bet: challenge.bet,
        winnerUserId: null
      }).catch((refundError) => logger.error('Failed to refund blackjack pot:', refundError));
    }
    logger.error(error);
    await interaction.update({
      content: `블랙잭 대결 실패: ${error.message}`,
      components: []
    });
  }

  return true;
}

async function handleAiBlackjackButton(interaction, economy, logger) {
  const [action, gameId] = interaction.customId.split(':');
  const pending = pendingAiBlackjackGames.get(gameId);

  if (!pending) {
    await interaction.reply({
      content: '이미 만료되었거나 처리된 블랙잭입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (interaction.user.id !== pending.userId) {
    await interaction.reply({
      content: '이 블랙잭을 시작한 유저만 버튼을 누를 수 있습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (Date.now() > pending.expiresAt) {
    pendingAiBlackjackGames.delete(gameId);
    await economy.refundReservedWager({
      guildId: pending.guildId,
      userId: pending.userId,
      username: pending.username,
      bet: pending.bet
    });
    await interaction.update({
      content: '⏰ 블랙잭이 만료되었습니다. 베팅금은 환불되었습니다.',
      components: []
    });
    return true;
  }

  try {
    const game = action === 'blackjack_hit'
      ? hitBlackjackRound(pending.game)
      : standBlackjackRound(pending.game);
    pending.game = game;

    if (game.status !== 'settled') {
      pending.expiresAt = Date.now() + CHALLENGE_TTL_MS;
      await interaction.update({
        content: formatAiBlackjackProgress(interaction.user, game),
        components: [createBlackjackActionRow(gameId)]
      });
      return true;
    }

    pendingAiBlackjackGames.delete(gameId);
    const settlement = await economy.resolveReservedWager({
      guildId: pending.guildId,
      userId: pending.userId,
      username: pending.username,
      bet: pending.bet,
      payout: game.payout
    });

    await interaction.update({
      content: formatAiBlackjackResult(interaction.user, game, settlement),
      components: []
    });
  } catch (error) {
    pendingAiBlackjackGames.delete(gameId);
    if (pending.reserved) {
      await economy.refundReservedWager({
        guildId: pending.guildId,
        userId: pending.userId,
        username: pending.username,
        bet: pending.bet
      }).catch((refundError) => logger.error('Failed to refund blackjack wager:', refundError));
    }
    logger.error(error);
    await interaction.update({
      content: `블랙잭 실패: ${error.message}`,
      components: []
    });
  }

  return true;
}

async function handlePlayerBlackjackButton(interaction, economy, logger) {
  const [action, gameId] = interaction.customId.split(':');
  const pending = pendingPlayerBlackjackGames.get(gameId);

  if (!pending) {
    await interaction.reply({
      content: '이미 만료되었거나 처리된 블랙잭 대결입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  const participant = getBlackjackParticipant(pending, interaction.user.id);
  if (!participant) {
    await interaction.reply({
      content: '이 블랙잭 대결의 참여자만 버튼을 누를 수 있습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (pending.game.currentTurn !== participant) {
    await interaction.reply({
      content: '아직 내 차례가 아닙니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (Date.now() > pending.expiresAt) {
    pendingPlayerBlackjackGames.delete(gameId);
    await economy.resolveReservedPlayerPot({
      guildId: pending.guildId,
      challenger: pending.challenger,
      opponent: pending.opponent,
      bet: pending.bet,
      winnerUserId: null
    });
    await interaction.update({
      content: '⏰ 블랙잭 대결이 만료되었습니다. 양쪽 베팅금은 환불되었습니다.',
      components: []
    });
    return true;
  }

  try {
    const game = action === 'blackjack_pvp_hit'
      ? hitPlayerBlackjackRound(pending.game, participant)
      : standPlayerBlackjackRound(pending.game, participant);
    pending.game = game;

    if (game.status !== 'settled') {
      pending.expiresAt = Date.now() + CHALLENGE_TTL_MS;
      await interaction.update(createPlayerBlackjackProgressPayload(pending, game, [
        createPlayerBlackjackActionRow(gameId)
      ]));
      return true;
    }

    pendingPlayerBlackjackGames.delete(gameId);
    const winnerUserId = game.winner === 'challenger'
      ? pending.challenger.userId
      : game.winner === 'opponent'
        ? pending.opponent.userId
        : null;
    const settlement = await economy.resolveReservedPlayerPot({
      guildId: pending.guildId,
      challenger: pending.challenger,
      opponent: pending.opponent,
      bet: pending.bet,
      winnerUserId
    });

    await interaction.update(createPlayerBlackjackResultPayload(pending, game, settlement));
  } catch (error) {
    pendingPlayerBlackjackGames.delete(gameId);
    if (pending.reserved) {
      await economy.resolveReservedPlayerPot({
        guildId: pending.guildId,
        challenger: pending.challenger,
        opponent: pending.opponent,
        bet: pending.bet,
        winnerUserId: null
      }).catch((refundError) => logger.error('Failed to refund blackjack pot:', refundError));
    }
    logger.error(error);
    await interaction.update({
      content: `블랙잭 대결 실패: ${error.message}`,
      components: []
    });
  }

  return true;
}

function formatOddEvenResult(user, game, settlement) {
  return [
    `🎲 **홀짝** — ${formatUserMention(user, user.username)}`,
    `선택: ${game.choice === 'odd' ? '홀' : '짝'} / 결과: ${game.roll} (${game.outcome === 'odd' ? '홀' : '짝'})`,
    formatSettlement(game.win, settlement)
  ].join('\n');
}

function formatDiceResult(user, game, settlement) {
  return [
    `🎲 **주사위** — ${formatUserMention(user, user.username)}`,
    `선택: ${game.choice === 'high' ? '높음(4~6)' : '낮음(1~3)'} / 결과: ${game.roll}`,
    formatSettlement(game.win, settlement)
  ].join('\n');
}

function formatSlotResult(user, game, settlement) {
  return [
    `🎰 **슬롯** — ${formatUserMention(user, user.username)}`,
    `${game.reels.join(' | ')}`,
    game.win ? `배수: ${game.multiplier}배` : '꽝',
    formatSettlement(game.win, settlement)
  ].join('\n');
}

function formatLuckySevenResult(user, game, settlement) {
  return [
    `🎲 **럭키세븐** — ${formatUserMention(user, user.username)}`,
    `주사위: ${game.dice.join(' + ')} = ${game.total}`,
    game.win ? `합계 7 적중! 배수: ${game.multiplier}배` : '합계 7 실패',
    formatSettlement(game.win, settlement)
  ].join('\n');
}

function formatHighLowResult(user, game, settlement) {
  const outcomeText = {
    high: '높음',
    low: '낮음',
    tie: '같음'
  }[game.outcome];

  return [
    `🃏 **하이로우** — ${formatUserMention(user, user.username)}`,
    `선택: ${formatHighLowChoice(game.choice)} / 카드: ${game.firstCard} → ${game.secondCard} (${outcomeText})`,
    game.push ? '같은 숫자라 베팅금이 환불됩니다.' : '',
    formatSettlement(game.win || game.push, settlement)
  ].filter(Boolean).join('\n');
}

function formatRouletteResult(user, game, settlement) {
  return [
    `🎡 **룰렛** — ${formatUserMention(user, user.username)}`,
    `선택: ${formatRouletteChoice(game.choice)} / 결과: ${game.roll} (${formatRouletteColor(game.color)})`,
    formatSettlement(game.win, settlement)
  ].join('\n');
}

function formatBaccaratResult(user, game, settlement) {
  return [
    `🂡 **바카라** — ${formatUserMention(user, user.username)}`,
    `선택: ${formatBaccaratChoice(game.choice)} / 결과: ${formatBaccaratChoice(game.result)}`,
    `플레이어: ${formatCards(game.playerHand)} = ${game.playerValue}`,
    `뱅커: ${formatCards(game.bankerHand)} = ${game.bankerValue}`,
    formatSettlement(game.win, settlement)
  ].join('\n');
}

function formatCrapsResult(user, game, settlement) {
  const rolls = game.rolls
    .map((roll) => `${roll.dice.join('+')}=${roll.total}`)
    .join(' → ');
  const outcomeText = game.push
    ? '무효'
    : game.win
      ? '승리'
      : '패배';

  return [
    `🎲 **크랩스** — ${formatUserMention(user, user.username)}`,
    `선택: ${game.choice === 'pass' ? '패스' : '돈패스'}${game.point ? ` / 포인트: ${game.point}` : ''}`,
    `롤: ${rolls}`,
    `결과: **${outcomeText}**`,
    formatSettlement(game.win || game.push, settlement)
  ].join('\n');
}

function formatSicBoResult(user, game, settlement) {
  return [
    `🎲 **시크보** — ${formatUserMention(user, user.username)}`,
    `선택: ${formatSicBoChoice(game.choice)} / 주사위: ${game.dice.join(' + ')} = ${game.total}`,
    game.triple ? '트리플!' : '트리플 아님',
    formatSettlement(game.win, settlement)
  ].join('\n');
}

function formatKenoResult(user, game, settlement) {
  return [
    `🔢 **키노** — ${formatUserMention(user, user.username)}`,
    `내 번호: ${game.picks.join(', ')}`,
    `추첨: ${game.draw.join(', ')}`,
    `적중: ${game.hits.length > 0 ? game.hits.join(', ') : '없음'} (${game.hits.length}개)`,
    game.win ? `배수: ${game.multiplier}배` : '꽝',
    formatSettlement(game.win, settlement)
  ].join('\n');
}

function createPokerProgressPayload(user, game, gameId) {
  return {
    content: formatPokerProgress(user, game),
    allowedMentions: createAllowedMentionsForUsers([user.id]),
    components: createPokerRows(gameId, game)
  };
}

function formatPokerProgress(user, game) {
  const recommendation = getPokerHoldRecommendation(game.hand);
  const recommendationText = recommendation.heldCards.length > 0
    ? `${recommendation.heldCards.join(' ')} (${recommendation.reason})`
    : recommendation.reason;

  return [
    `🃏 **드로우 포커** — ${formatUserMention(user, user.username)}`,
    `베팅금: **${game.bet.toLocaleString()}골드**`,
    `현재 패: ${formatPokerHand(game.hand, game.held)}`,
    `현재 판정: **${game.handRank.label}**${game.handRank.multiplier > 0 ? ` · ${formatMultiplier(game.handRank.multiplier)}배` : ''}`,
    `보류: **${game.held.filter(Boolean).length}/5장**`,
    `추천 HOLD: **${recommendationText}**`,
    `배율표: ${formatPokerPayoutTable()}`,
    '카드를 직접 누르거나 **추천 HOLD**를 적용한 뒤, **교체/승부**로 한 번 교체하고 정산합니다.'
  ].join('\n');
}

function formatPokerResult(user, game, settlement) {
  const outcomeLabel = game.payout > game.bet
    ? '당첨'
    : game.payout === game.bet
      ? '환급'
      : '꽝';
  const multiplierText = game.handRank.multiplier > 0
    ? `${formatMultiplier(game.handRank.multiplier)}배`
    : '배율 없음';

  return [
    `🃏 **포커 결과 — ${outcomeLabel}** — ${formatUserMention(user, user.username)}`,
    `처음 패: ${formatPokerHand(game.initialHand)}`,
    `최종 패: ${formatPokerHand(game.hand, game.held)}`,
    `교체: **${game.replacedCount}장**`,
    `판정: **${game.handRank.label}** · ${multiplierText}`,
    formatSettlement(game.payout > 0, settlement)
  ].join('\n');
}

function createPlayerPokerProgressPayload(challenge, game, components = []) {
  const currentPlayer = getPlayerPokerParticipantInfo(challenge, game.currentTurn);
  return {
    content: formatPlayerPokerProgress(challenge, game),
    allowedMentions: createAllowedMentionsForUsers([currentPlayer?.userId]),
    components
  };
}

function formatPlayerPokerProgress(challenge, game) {
  const currentMention = formatPlayerPokerParticipantMention(getPlayerPokerParticipantInfo(challenge, game.currentTurn));
  const callAmount = getPlayerPokerCallAmount(game, game.currentTurn);

  return [
    '🃏 **텍사스 홀덤 진행 중**',
    `인원: **${game.players.length}명** / 시작칩: **${game.bet.toLocaleString()}칩** / 블라인드: **${game.smallBlind.toLocaleString()}/${game.bigBlind.toLocaleString()}칩** / 단계: **${game.streetLabel}**`,
    `팟: **${game.pot.toLocaleString()}칩** / 현재 베팅: **${game.currentBet.toLocaleString()}칩** / 콜 필요: **${callAmount.toLocaleString()}칩** / 최소 레이즈: **${game.minRaise.toLocaleString()}칩**`,
    `커뮤니티: ${formatHoldemCommunityCards(game)}`,
    ...game.players.map((player) => `${formatPlayerPokerParticipantMention(getPlayerPokerParticipantInfo(challenge, player.key))}: ${formatHoldemPublicParticipant(player)}`),
    `현재 차례: ${currentMention}`,
    '각자 **내 패 보기**로 홀카드를 비공개 확인하고, 차례에는 체크/콜, 하프팟, 팟, 올인, 폴드를 선택합니다.'
  ].join('\n');
}

function formatHoldemPublicParticipant(participant) {
  if (participant.folded) return '폴드';
  const state = participant.allIn
    ? '올인'
    : participant.acted
      ? '행동 완료'
      : '대기 중';
  return [
    `스택 **${participant.stack.toLocaleString()}칩**`,
    `이번 베팅 **${participant.streetCommitted.toLocaleString()}칩**`,
    state
  ].join(' · ');
}

function formatPlayerPokerPrivateHand(challenge, participant) {
  const player = getPlayerPokerParticipantInfo(challenge, participant);
  const gamePlayer = challenge.game[participant];
  const callAmount = getPlayerPokerCallAmount(challenge.game, participant);

  return [
    `🃏 **내 텍사스 홀덤 패 — ${player?.username ?? '참가자'}**`,
    `홀카드: **${formatPokerHand(gamePlayer.holeCards)}**`,
    `커뮤니티: ${formatHoldemCommunityCards(challenge.game)}`,
    `내 스택: **${gamePlayer.stack.toLocaleString()}칩** / 콜 필요: **${callAmount.toLocaleString()}칩**`,
    '이 메시지는 본인에게만 보입니다.'
  ].join('\n');
}

function createPlayerPokerResultPayload(challenge, game, settlement) {
  const winnerUserIds = game.winners
    .map((winnerKey) => getPlayerPokerParticipantInfo(challenge, winnerKey)?.userId)
    .filter(Boolean);

  return {
    content: formatPlayerPokerResult(challenge, game, settlement),
    allowedMentions: createAllowedMentionsForUsers([
      ...winnerUserIds,
      ...challenge.players.map((player) => player.userId)
    ]),
    components: []
  };
}

function formatPlayerPokerResult(challenge, game, settlement) {
  const reason = game.settlementReason === 'fold' ? '폴드' : '쇼다운';
  const playerLines = game.players.map((player) => (
    `${formatPlayerPokerParticipantMention(getPlayerPokerParticipantInfo(challenge, player.key))}: ${formatPokerHand(player.holeCards)} · **${player.handRank.label}**`
  ));
  const stackLine = game.players
    .map((player) => `${formatPlayerPokerParticipantMention(getPlayerPokerParticipantInfo(challenge, player.key))} **${player.stack.toLocaleString()}골드**`)
    .join(' / ');

  if (game.winners.length === 0) {
    return [
      `🃏 **텍사스 홀덤 결과 — ${reason}**`,
      `커뮤니티: ${formatPokerHand(game.communityCards)}`,
      ...playerLines,
      `획득 팟: **${game.pot.toLocaleString()}칩**`,
      `최종 반환: ${stackLine}`,
      '결과: **무승부** — 팟을 나눠 가졌습니다.'
    ].join('\n');
  }

  const winnerMention = game.winners
    .map((winnerKey) => formatPlayerPokerParticipantMention(getPlayerPokerParticipantInfo(challenge, winnerKey)))
    .join(', ');
  const winnerBalance = settlement.winner ? getCasinoChips(settlement.winner).toLocaleString() : null;

  return [
    `🃏 **텍사스 홀덤 결과 — ${reason}**`,
    `커뮤니티: ${formatPokerHand(game.communityCards)}`,
    ...playerLines,
    `승자: ${winnerMention}`,
    `획득 팟: **${game.pot.toLocaleString()}칩**`,
    `최종 반환: ${stackLine}`,
    winnerBalance ? `승자 골드: **${winnerBalance}골드**` : null
  ].filter((line) => line !== null).join('\n');
}

function formatHoldemCommunityCards(game) {
  return game.communityCards
    .map((card, index) => index < game.revealedCommunityCount ? card : '🂠')
    .join(' ');
}

function getPlayerPokerCallAmount(game, participant) {
  if (!participant) return 0;
  return Math.max(0, game.currentBet - game[participant].streetCommitted);
}

function formatPokerHand(cards, held = []) {
  return cards
    .map((card, index) => held[index] ? `**[${card}]**` : card)
    .join(' ');
}

function formatPokerPayoutTable() {
  return getPokerPayoutTable()
    .map((entry) => `${entry.label} ${formatMultiplier(entry.multiplier)}배`)
    .join(' / ');
}

function createScratchTicketProgressPayload(user, ticket, gameId) {
  return {
    content: formatScratchTicketProgress(user, ticket),
    allowedMentions: createAllowedMentionsForUsers([user.id]),
    components: createScratchTicketRows(gameId, ticket)
  };
}

function createScratchTicketResultPayload(user, ticket, settlement, { expired = false } = {}) {
  return {
    content: formatScratchTicketResult(user, ticket, settlement, { expired }),
    allowedMentions: createAllowedMentionsForUsers([user.id]),
    components: []
  };
}

function formatScratchTicketProgress(user, ticket) {
  return [
    `🎫 **스크래치 복권** — ${formatUserMention(user, user.username)}`,
    `상품: **${ticket.productName}** / 구매가: **${ticket.price.toLocaleString()}골드** / 최고 당첨: **${ticket.topPrize.toLocaleString()}골드**`,
    `당첨 조건: **같은 금액 3개**가 나오면 해당 금액을 지급합니다.`,
    `확률 설계: ${formatScratchTicketStats(ticket.productId)}`,
    `긁은 칸: **${ticket.revealCount}/${SCRATCH_TICKET_SPOT_COUNT}**`,
    ticket.lastRevealedIndex !== null
      ? `방금 공개: **${ticket.lastRevealedIndex + 1}번** → **${ticket.spots[ticket.lastRevealedIndex].label}골드**`
      : null,
    '',
    '```text',
    formatScratchTicketBoard(ticket),
    '```',
    '버튼을 하나씩 눌러 모든 칸을 긁으면 자동 정산됩니다. 5분 동안 입력이 없으면 다음 입력 때 남은 칸이 자동 공개됩니다.'
  ].filter((line) => line !== null).join('\n');
}

function formatScratchTicketResult(user, ticket, settlement, { expired = false } = {}) {
  return [
    ticket.win
      ? `🎉 **스크래치 복권 당첨** — ${formatUserMention(user, user.username)}`
      : `🎫 **스크래치 복권 결과** — ${formatUserMention(user, user.username)}`,
    `상품: **${ticket.productName}** / 구매가: **${ticket.price.toLocaleString()}골드**`,
    expired ? '⏰ 시간이 지나 남은 칸을 자동 공개하고 정산했습니다.' : null,
    '',
    '```text',
    formatScratchTicketBoard(ticket, { revealAll: true }),
    '```',
    ticket.win
      ? `판정: 같은 금액 3개 → **${ticket.winningAmount.toLocaleString()}골드 당첨!**`
      : '판정: 같은 금액 3개가 없어 꽝입니다.',
    formatSettlement(ticket.win, settlement)
  ].filter((line) => line !== null).join('\n');
}

function formatScratchTicketBoard(ticket, { revealAll = false } = {}) {
  const cells = ticket.spots.map((spot, index) => (
    revealAll || ticket.revealed[index]
      ? spot.label.padStart(5, ' ')
      : `${index + 1}번`.padStart(5, ' ')
  ));
  const rows = [];

  for (let index = 0; index < cells.length; index += 3) {
    rows.push(cells.slice(index, index + 3).join(' | '));
  }

  return rows.join('\n');
}

function createScratchTicketRows(gameId, ticket) {
  const rows = [];

  for (let rowIndex = 0; rowIndex < SCRATCH_TICKET_SPOT_COUNT; rowIndex += 3) {
    const row = new ActionRowBuilder();

    for (let offset = 0; offset < 3; offset += 1) {
      const index = rowIndex + offset;
      const revealed = ticket.revealed[index];
      const amount = ticket.spots[index].amount;
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`scratch_reveal:${gameId}:${index}`)
          .setLabel(revealed ? `${formatScratchPrizeShort(amount)}골드` : `${index + 1}번 긁기`)
          .setStyle(getScratchTicketButtonStyle(ticket, index))
          .setDisabled(revealed || ticket.status !== 'scratching')
      );
    }

    rows.push(row);
  }

  return rows;
}

function getScratchTicketButtonStyle(ticket, index) {
  if (!ticket.revealed[index]) return ButtonStyle.Primary;
  if (getRevealedScratchTicketAmountCount(ticket, ticket.spots[index].amount) >= 3) {
    return ButtonStyle.Success;
  }
  return ButtonStyle.Secondary;
}

function createPokerRows(gameId, game) {
  const cardRow = new ActionRowBuilder();
  for (let index = 0; index < game.hand.length; index += 1) {
    cardRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`poker_hold:${gameId}:${index}`)
        .setLabel(game.held[index] ? `HOLD ${game.hand[index]}` : game.hand[index])
        .setStyle(game.held[index] ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setDisabled(game.status !== 'holding')
    );
  }

  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`poker_recommend:${gameId}`)
      .setLabel('추천 HOLD')
      .setStyle(ButtonStyle.Success)
      .setDisabled(game.status !== 'holding'),
    new ButtonBuilder()
      .setCustomId(`poker_clear:${gameId}`)
      .setLabel('보류 초기화')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(game.status !== 'holding' || !game.held.some(Boolean)),
    new ButtonBuilder()
      .setCustomId(`poker_draw:${gameId}`)
      .setLabel(game.held.every(Boolean) ? '그대로 승부' : '교체/승부')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(game.status !== 'holding')
  );

  return [cardRow, actionRow];
}

function createPlayerPokerRows(gameId, game) {
  const current = game.currentTurn ? game[game.currentTurn] : null;
  const callAmount = game.currentTurn ? getPlayerPokerCallAmount(game, game.currentTurn) : 0;
  const canAct = game.status === 'betting' && current && !current.folded && !current.allIn;

  const mainRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`poker_pvp_peek:${gameId}`)
      .setLabel('내 패 보기')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`${callAmount > 0 ? 'poker_pvp_call' : 'poker_pvp_check'}:${gameId}`)
      .setLabel(callAmount > 0 ? `콜 ${formatShortChip(callAmount)}` : '체크')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!canAct),
    new ButtonBuilder()
      .setCustomId(`poker_pvp_fold:${gameId}`)
      .setLabel('폴드')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!canAct)
  );

  const betRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`poker_pvp_half_pot:${gameId}`)
      .setLabel('1/2팟')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!canAct || current.stack <= 0),
    new ButtonBuilder()
      .setCustomId(`poker_pvp_pot:${gameId}`)
      .setLabel('팟')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!canAct || current.stack <= 0),
    new ButtonBuilder()
      .setCustomId(`poker_pvp_all_in:${gameId}`)
      .setLabel(`올인 ${formatShortChip(current?.stack ?? 0)}`)
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!canAct || current.stack <= 0)
  );

  return [mainRow, betRow];
}

function formatShortChip(amount) {
  return `${Number(amount || 0).toLocaleString()}칩`;
}

function getRevealedScratchTicketAmountCount(ticket, amount) {
  return ticket.spots.reduce((count, spot, index) => (
    ticket.revealed[index] && spot.amount === amount
      ? count + 1
      : count
  ), 0);
}

function parseScratchTicketButtonIndex(rawIndex) {
  const index = Number(rawIndex);

  if (!Number.isSafeInteger(index) || index < 0 || index >= SCRATCH_TICKET_SPOT_COUNT) {
    return null;
  }

  return index;
}

function formatScratchTicketProductSummary() {
  return SCRATCH_TICKET_PRODUCTS
    .map((product) => `${product.name} ${product.price.toLocaleString()}골드/최고 ${formatScratchPrizeShort(product.topPrize)}`)
    .join(', ');
}

function formatScratchTicketStats(productId) {
  const stats = getScratchTicketProductStats(productId);

  return `당첨률 약 ${(stats.winChance * 100).toFixed(2)}%, 기대 지급 ${Math.round(stats.expectedPayout).toLocaleString()}골드`;
}



function createTimingProgressPayload(user, game, gameId) {
  return {
    content: formatTimingProgress(user, game),
    allowedMentions: createAllowedMentionsForUsers([user.id]),
    components: [createTimingActionRow(gameId)]
  };
}

function formatTimingProgress(user, game) {
  return [
    `🎯 **타이밍 게임** — ${formatUserMention(user, user.username)}`,
    `목표: **${formatSeconds4(game.targetSeconds)}** 뒤에 버튼을 누르세요.`,
    `베팅금: **${game.bet.toLocaleString()}골드**`,
    `배율표: ${formatTimingPayoutTable()}`,
    '누른 순간의 기록은 소수점 4자리까지 공개됩니다.'
  ].join('\n');
}

function formatTimingResult(user, game, settlement) {
  return [
    `🎯 **타이밍 결과** — ${formatUserMention(user, user.username)}`,
    `목표: **${formatSeconds4(game.targetSeconds)}**`,
    `기록: **${formatSeconds4(game.elapsedSeconds)}**`,
    `오차: **${formatSeconds4(game.differenceSeconds)}**`,
    game.win
      ? `판정: **${game.tier.label}** · 배율 **${formatMultiplier(game.multiplier)}배**`
      : `판정: **실패** · ${formatSeconds4(0.5)}보다 멀어 배율이 없습니다.`,
    formatSettlement(game.win, settlement)
  ].join('\n');
}

function formatTimingPayoutTable() {
  return TIMING_PAYOUT_TIERS
    .map((tier) => `${tier.label} ${formatMultiplier(tier.multiplier)}배`)
    .join(' / ');
}

function createDeadlineProgressPayload(user, game, gameId) {
  return {
    content: formatDeadlineProgress(user, game),
    allowedMentions: createAllowedMentionsForUsers([user.id]),
    components: [createDeadlineActionRow(gameId, game)]
  };
}

function formatDeadlineProgress(user, game) {
  return [
    `⏳ **데드라인 버튼** — ${formatUserMention(user, user.username)}`,
    `안전 누름: **${game.presses}/${DEADLINE_MAX_SAFE_PRESSES}회**`,
    `베팅금: **${game.bet.toLocaleString()}골드** / 누적 보상: **${game.reward.toLocaleString()}골드** / 지금 수령: **${(game.bet + game.reward).toLocaleString()}골드**`,
    game.lastReward > 0 ? `방금 안전했습니다: **+${game.lastReward.toLocaleString()}골드**` : null,
    `다음 안전 보상: **+${game.nextReward.toLocaleString()}골드** / 다음 꽝 확률: **${formatBasisPoints(game.bustChanceBps)}**`,
    '누르면 보상이 커지지만, 꽝이면 이번 판 누적 보상을 모두 잃습니다. 멈추면 베팅금+누적 보상을 수령합니다.'
  ].filter(Boolean).join('\n');
}

function formatDeadlineResult(user, game, settlement) {
  if (game.status === 'busted') {
    return [
      `💥 **데드라인 폭발** — ${formatUserMention(user, user.username)}`,
      `안전 누름: **${game.presses}/${DEADLINE_MAX_SAFE_PRESSES}회**`,
      `판정: ${game.lastRoll.toLocaleString()} / ${DEADLINE_ROLL_MAX.toLocaleString()} (꽝 확률 ${formatBasisPoints(game.bustChanceBps)})`,
      `잃은 누적 보상: **${game.lostReward.toLocaleString()}골드**`,
      formatSettlement(false, settlement)
    ].join('\n');
  }

  return [
    `${game.autoCashedOut ? '🏁 **데드라인 한계 도달 자동 수령**' : '🛑 **데드라인 수령**'} — ${formatUserMention(user, user.username)}`,
    `안전 누름: **${game.presses}/${DEADLINE_MAX_SAFE_PRESSES}회**`,
    `누적 보상: **${game.reward.toLocaleString()}골드**`,
    formatSettlement(true, settlement)
  ].join('\n');
}

function formatDeadlineExpiredResult(user, game, settlement) {
  return [
    `⏰ **데드라인 시간 만료** — ${formatUserMention(user, user.username)}`,
    game.reward > 0
      ? `60초 동안 추가 입력이 없어 누적 보상 **${game.reward.toLocaleString()}골드**를 자동 수령했습니다.`
      : '60초 동안 버튼을 누르지 않아 베팅금만 환불되었습니다.',
    formatSettlement(true, settlement)
  ].join('\n');
}

function formatAiBlackjackProgress(user, game) {
  return [
    `🃏 **블랙잭 vs AI** — ${formatUserMention(user, user.username)}`,
    `내 패: ${formatCards(game.playerHand)} = ${game.playerValue}`,
    `AI 공개 패: ${game.dealerHand[0]} ?`,
    '버튼으로 히트 또는 스탠드를 선택하세요. 60초 동안 입력이 없으면 만료됩니다.'
  ].join('\n');
}

function formatAiBlackjackResult(user, game, settlement) {
  const resultText = {
    player: '승리',
    dealer: '패배',
    push: '무승부'
  }[game.result];

  return [
    `🃏 **블랙잭 vs AI** — ${formatUserMention(user, user.username)}`,
    `내 패: ${formatCards(game.playerHand)} = ${game.playerValue}`,
    `AI 패: ${formatCards(game.dealerHand)} = ${game.dealerValue}`,
    `결과: **${resultText}**${game.multiplier > 0 ? ` (${game.multiplier}배)` : ''}`,
    formatSettlement(game.result !== 'dealer', settlement)
  ].join('\n');
}

function formatPlayerBlackjackProgress(challenge, game) {
  const challengerMention = `<@${challenge.challenger.userId}>`;
  const opponentMention = `<@${challenge.opponent.userId}>`;
  const currentMention = game.currentTurn === 'challenger' ? challengerMention : opponentMention;

  return [
    '🃏 **블랙잭 유저 대결 진행 중**',
    `${challengerMention}: ${formatCards(game.challengerHand)} = ${game.challengerValue}${game.challengerStood ? ' (스탠드)' : ''}`,
    `${opponentMention}: ${formatCards(game.opponentHand)} = ${game.opponentValue}${game.opponentStood ? ' (스탠드)' : ''}`,
    `현재 차례: ${currentMention}`,
    '버튼으로 히트 또는 스탠드를 선택하세요. 60초 동안 입력이 없으면 만료됩니다.'
  ].join('\n');
}

function createPlayerBlackjackProgressPayload(challenge, game, components = []) {
  return {
    content: formatPlayerBlackjackProgress(challenge, game),
    allowedMentions: createAllowedMentionsForUsers([
      game.currentTurn === 'challenger'
        ? challenge.challenger.userId
        : challenge.opponent.userId
    ]),
    components
  };
}

function formatPlayerBlackjackResult(challenge, game, settlement) {
  const challengerMention = `<@${challenge.challenger.userId}>`;
  const opponentMention = `<@${challenge.opponent.userId}>`;

  if (!game.winner) {
    return [
      '🃏 **블랙잭 유저 대결 결과**',
      `${challengerMention}: ${formatCards(game.challengerHand)} = ${game.challengerValue}`,
      `${opponentMention}: ${formatCards(game.opponentHand)} = ${game.opponentValue}`,
      '결과: **무승부** — 골드 이동 없음'
    ].join('\n');
  }

  const winnerMention = game.winner === 'challenger' ? challengerMention : opponentMention;
  const winnerBalance = getCasinoChips(settlement.winner).toLocaleString();

  return [
    '🃏 **블랙잭 유저 대결 결과**',
    `${challengerMention}: ${formatCards(game.challengerHand)} = ${game.challengerValue}`,
    `${opponentMention}: ${formatCards(game.opponentHand)} = ${game.opponentValue}`,
    `승자: ${winnerMention}`,
    `상금: **${settlement.pot.toLocaleString()}골드** / 승자 골드: **${winnerBalance}골드**`
  ].join('\n');
}

function createPlayerBlackjackResultPayload(challenge, game, settlement) {
  const winnerUserId = game.winner === 'challenger'
    ? challenge.challenger.userId
    : game.winner === 'opponent'
      ? challenge.opponent.userId
      : null;

  return {
    content: formatPlayerBlackjackResult(challenge, game, settlement),
    allowedMentions: createAllowedMentionsForUsers([
      winnerUserId,
      challenge.challenger.userId,
      challenge.opponent.userId
    ]),
    components: []
  };
}

function pressDeadlineRoundWithCasinoLuck(actor, round, options = {}) {
  const modifier = resolveCasinoLuckModifier(actor);
  if (!modifier) {
    return pressDeadlineRound(round, {
      randomInt: options.randomInt
    });
  }

  let selectedGame = null;
  for (let attempt = 1; attempt <= modifier.multiplier; attempt += 1) {
    const game = pressDeadlineRound(round, {
      randomInt: options.randomInt
    });
    selectedGame = game;
    if (!game.busted) return game;
  }

  return selectedGame;
}

function playCasinoLuckGame(actor, options = {}, playGame, {
  isWin = isCasinoLuckWin
} = {}) {
  const modifier = resolveCasinoLuckModifier(actor);
  if (!modifier) return playGame();

  let selectedGame = null;
  for (let attempt = 1; attempt <= modifier.multiplier; attempt += 1) {
    const game = playGame();
    selectedGame = game;
    if (isWin(game)) {
      return addCasinoLuckToGame(game, {
        ...modifier,
        attempt
      });
    }
  }

  return addCasinoLuckToGame(selectedGame, {
    ...modifier,
    attempt: modifier.multiplier
  });
}

function resolveCasinoLuckModifier(actor) {
  const luckyUserIds = normalizeCasinoLuckIdTokenList(process.env.CASINO_LUCKY_USER_ID_TOKENS);
  const userId = getCasinoLuckUserId(actor);
  const matchesId = userId && luckyUserIds.includes(userId);

  if (!matchesId) return null;

  const multiplier = normalizeCasinoLuckMultiplier(process.env.CASINO_LUCK_MULTIPLIER);
  if (multiplier <= 1) return null;

  return Object.freeze({
    label: `${multiplier}배`,
    multiplier,
    matchedBy: 'user_id'
  });
}

function normalizeCasinoLuckMultiplier(value) {
  if (value === undefined || value === null || value === '') return DEFAULT_CASINO_LUCK_MULTIPLIER;
  const multiplier = Math.floor(Number(value));
  if (!Number.isSafeInteger(multiplier) || multiplier <= 1) return 1;
  return Math.min(multiplier, MAX_CASINO_LUCK_MULTIPLIER);
}

function getCasinoLuckUserId(actor) {
  return String(
    actor?.user?.id
    ?? actor?.member?.user?.id
    ?? actor?.member?.id
    ?? actor?.id
    ?? ''
  ).trim();
}

function normalizeCasinoLuckIdTokenList(value) {
  const values = Array.isArray(value)
    ? value
    : String(value ?? '').split(',');
  return [...new Set(values.map(decodeDoubleBase64CasinoLuckId).filter(Boolean))];
}

function decodeDoubleBase64CasinoLuckId(value) {
  try {
    const once = Buffer.from(String(value ?? '').trim(), 'base64').toString('utf8');
    return normalizeCasinoLuckId(Buffer.from(once, 'base64').toString('utf8'));
  } catch {
    return '';
  }
}

function normalizeCasinoLuckId(value) {
  return String(value ?? '').trim();
}

function isCasinoLuckWin(game) {
  return game?.win === true || Number(game?.payout ?? 0) > Number(game?.bet ?? 0);
}

function addCasinoLuckToGame(game, modifier) {
  if (!game || !modifier) return game;
  return {
    ...game,
    casinoLuckModifier: Object.freeze({
      label: modifier.label,
      multiplier: modifier.multiplier,
      attempt: modifier.attempt,
      matchedBy: modifier.matchedBy
    })
  };
}

function addCasinoLuckToSettlement(settlement, modifier) {
  if (!modifier) return settlement;
  return {
    ...settlement,
    casinoLuckModifier: modifier
  };
}

async function settleGame(interaction, economy, bet, payout, game = null) {
  const settlement = await economy.settleWager({
    guildId: interaction.guildId,
    userId: interaction.user.id,
    username: interaction.user.username,
    bet,
    payout
  });
  return addCasinoLuckToSettlement(settlement, game?.casinoLuckModifier);
}

function formatSettlement(success, settlement) {
  const profit = settlement.profit;
  const profitText = profit >= 0
    ? `+${profit.toLocaleString()}골드`
    : `${profit.toLocaleString()}골드`;
  const modifier = settlement.rpgCasinoModifier
    ? `\n타짜 정산 효과: **${settlement.rpgCasinoModifier.label}** (확률 변화 없음, 정산 금액만 적용)`
    : '';

  return [
    success ? '✅ 성공' : '❌ 실패',
    `베팅: ${settlement.bet.toLocaleString()}골드 / 지급: ${settlement.payout.toLocaleString()}골드 / 손익: **${profitText}**`,
    `현재 골드: **${getCasinoChips(settlement.profile).toLocaleString()}골드**${modifier}`
  ].join('\n');
}

function getCasinoChips(profile) {
  return profile.balance ?? profile.currencyBalances?.main ?? profile.currencyBalances?.casino ?? 0;
}



function createTimingActionRow(gameId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`timing_press:${gameId}`)
      .setLabel('지금 누르기')
      .setStyle(ButtonStyle.Primary)
  );
}

function formatSeconds4(seconds) {
  return `${Number(seconds).toFixed(4)}초`;
}

function formatMultiplier(multiplier) {
  return Number.isInteger(multiplier)
    ? multiplier.toFixed(0)
    : multiplier.toFixed(1);
}

function getNowMsProvider(options = {}) {
  if (typeof options.nowMs === 'function') return options.nowMs;
  if (options.nowMs !== undefined) return () => Number(options.nowMs);

  return () => globalThis.performance?.now?.() ?? Date.now();
}

function createDeadlineActionRow(gameId, game) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`deadline_press:${gameId}`)
      .setLabel('데드라인 누르기')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`deadline_cashout:${gameId}`)
      .setLabel('멈추고 수령')
      .setStyle(ButtonStyle.Success)
      .setDisabled(game.reward <= 0)
  );
}

function formatBasisPoints(basisPoints) {
  const percent = basisPoints / 100;
  return `${Number.isInteger(percent) ? percent.toFixed(0) : percent.toFixed(1)}%`;
}

function createBlackjackActionRow(gameId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`blackjack_hit:${gameId}`)
      .setLabel('히트')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`blackjack_stand:${gameId}`)
      .setLabel('스탠드')
      .setStyle(ButtonStyle.Success)
  );
}

function createPlayerBlackjackActionRow(gameId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`blackjack_pvp_hit:${gameId}`)
      .setLabel('히트')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`blackjack_pvp_stand:${gameId}`)
      .setLabel('스탠드')
      .setStyle(ButtonStyle.Success)
  );
}

function getBlackjackParticipant(game, userId) {
  if (game.challenger.userId === userId) return 'challenger';
  if (game.opponent.userId === userId) return 'opponent';
  return null;
}

function getPlayerPokerParticipant(game, userId) {
  const player = game.players?.find((participant) => participant.userId === userId);
  if (player) return player.key;
  return getBlackjackParticipant(game, userId);
}

function getPlayerPokerParticipantInfo(game, participantKey) {
  if (!participantKey) return null;
  return game.players?.find((participant) => participant.key === participantKey) ?? null;
}

function formatPlayerPokerParticipantMention(player) {
  if (!player) return '알 수 없음';
  return `<@${player.userId}>`;
}

function formatRouletteChoice(choice) {
  return {
    red: '빨강',
    black: '검정',
    odd: '홀',
    even: '짝',
    low: '낮음(1~18)',
    high: '높음(19~36)',
    zero: '0'
  }[choice];
}

function formatRouletteColor(color) {
  return {
    red: '빨강',
    black: '검정',
    green: '초록'
  }[color];
}

function formatBaccaratChoice(choice) {
  return {
    player: '플레이어',
    banker: '뱅커',
    tie: '타이'
  }[choice];
}

function formatSicBoChoice(choice) {
  return {
    small: '작음',
    big: '큼',
    triple: '트리플'
  }[choice];
}

function formatHighLowChoice(choice) {
  return {
    high: '높음',
    low: '낮음'
  }[choice];
}

function isCasinoCommand(commandName) {
  return casinoCommands.some((command) => command.name === commandName);
}

function createChallengeId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

async function waitForRaceFrame(delayMs, sleepFn) {
  if (delayMs <= 0) return;
  await sleepFn(delayMs);
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
