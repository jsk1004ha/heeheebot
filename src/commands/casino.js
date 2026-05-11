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
  createBlackjackRound,
  createDeadlineRound,
  createPlayerBlackjackRound,
  createPokerRound,
  createScratchTicket,
  createTimingRound,
  DEADLINE_MAX_SAFE_PRESSES,
  DEADLINE_MIN_BET,
  DEADLINE_ROLL_MAX,
  TIMING_PAYOUT_TIERS,
  TIMING_TARGET_MAX_SECONDS,
  TIMING_TARGET_MIN_SECONDS,
  EMOJI_RACE_MULTIPLIER,
  formatEmojiRaceChoice,
  formatEmojiRaceTrack,
  formatCards,
  formatScratchPrizeShort,
  drawPokerRound,
  hitBlackjackRound,
  hitPlayerBlackjackRound,
  getPokerHoldRecommendation,
  getPokerPayoutTable,
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
  playEmojiRace,
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
const pendingBlackjackChallenges = new Map();
const pendingDeadlineGames = new Map();
const pendingTimingGames = new Map();
const pendingAiBlackjackGames = new Map();
const pendingPlayerBlackjackGames = new Map();
const pendingPokerGames = new Map();
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
    .setDescription('움직이는 이모지 트랙에서 1등 동물을 맞히면 2.7배를 받습니다.')
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
    .setDescription('5장 드로우 포커입니다. 보류할 카드를 고르고 한 번 교체합니다.')
    .addIntegerOption((option) =>
      option
        .setName('돈')
        .setDescription('베팅할 골드')
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
        return await handleCasinoQuickButton(interaction, economy, logger);
      }
      if (interaction.customId?.startsWith('deadline_')) {
        return await handleDeadlineButton(interaction, economy, logger, options);
      }
      if (interaction.customId?.startsWith('timing_')) {
        return await handleTimingButton(interaction, economy, logger, options);
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
    pendingPokerGames,
    pendingAiBlackjackGames
  ]) {
    const result = await cleanupExpiredCasinoPendingMap(
      pendingGames,
      economy,
      logger,
      now,
      refundReservedCasinoWager
    );
    removed += result.removed;
    refunded += result.refunded;
  }

  for (const [challengeId, challenge] of pendingBlackjackChallenges.entries()) {
    if (challenge.expiresAt > now) continue;
    pendingBlackjackChallenges.delete(challengeId);
    removed += 1;
  }

  const playerResult = await cleanupExpiredCasinoPendingMap(
    pendingPlayerBlackjackGames,
    economy,
    logger,
    now,
    refundReservedPlayerCasinoPot
  );
  removed += playerResult.removed;
  refunded += playerResult.refunded;

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
    ...[...pendingPokerGames.values()].map((pending) => pending.expiresAt),
    ...[...pendingAiBlackjackGames.values()].map((pending) => pending.expiresAt),
    ...[...pendingBlackjackChallenges.values()].map((pending) => pending.expiresAt),
    ...[...pendingPlayerBlackjackGames.values()].map((pending) => pending.expiresAt)
  ].filter((expiresAt) => Number.isFinite(expiresAt) && expiresAt > 0);

  return expiries.length > 0 ? Math.min(...expiries) : null;
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

async function refundReservedPlayerCasinoPot(economy, logger, pending) {
  if (!pending?.reserved || typeof economy?.resolveReservedPlayerPot !== 'function') return 0;

  try {
    await economy.resolveReservedPlayerPot({
      guildId: pending.guildId,
      challenger: pending.challenger,
      opponent: pending.opponent,
      bet: pending.bet,
      winnerUserId: null
    });
    pending.reserved = false;
    return 2;
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

  const bet = interaction.options.getInteger('돈', true);

  if (interaction.commandName === '홀짝') {
    const choice = normalizeOddEvenChoice(interaction.options.getString('선택', true));
    const game = playOddEven({ choice, bet });
    const settlement = await economy.settleWager({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      username: interaction.user.username,
      bet,
      payout: game.payout
    });

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
    const game = playDice({ choice, bet });
    const settlement = await economy.settleWager({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      username: interaction.user.username,
      bet,
      payout: game.payout
    });

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
    const game = playSlots({ bet });
    const settlement = await economy.settleWager({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      username: interaction.user.username,
      bet,
      payout: game.payout
    });

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
    await runEmojiRaceCommand(interaction, economy, logger, {
      bet,
      choice,
      randomInt: options.randomInt,
      frameDelayMs: options.raceDelayMs,
      sleep: options.sleep
    });
    return;
  }

  if (interaction.commandName === '럭키세븐') {
    const game = playLuckySeven({ bet });
    const settlement = await settleGame(interaction, economy, bet, game.payout);

    await interaction.reply(formatLuckySevenResult(interaction.user, game, settlement));
    return;
  }

  if (interaction.commandName === '하이로우') {
    const game = playHighLow({
      choice: interaction.options.getString('선택', true),
      bet
    });
    const settlement = await settleGame(interaction, economy, bet, game.payout);

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
    await playPoker(interaction, economy, bet, options);
    return;
  }

  if (interaction.commandName === '룰렛') {
    const game = playRoulette({
      choice: interaction.options.getString('선택', true),
      bet
    });
    const settlement = await settleGame(interaction, economy, bet, game.payout);

    await interaction.reply(formatRouletteResult(interaction.user, game, settlement));
    return;
  }

  if (interaction.commandName === '바카라') {
    const game = playBaccarat({
      choice: interaction.options.getString('선택', true),
      bet
    });
    const settlement = await settleGame(interaction, economy, bet, game.payout);

    await interaction.reply(formatBaccaratResult(interaction.user, game, settlement));
    return;
  }

  if (interaction.commandName === '크랩스') {
    const game = playCraps({
      choice: interaction.options.getString('선택', true),
      bet
    });
    const settlement = await settleGame(interaction, economy, bet, game.payout);

    await interaction.reply(formatCrapsResult(interaction.user, game, settlement));
    return;
  }

  if (interaction.commandName === '시크보') {
    const game = playSicBo({
      choice: interaction.options.getString('선택', true),
      bet
    });
    const settlement = await settleGame(interaction, economy, bet, game.payout);

    await interaction.reply(formatSicBoResult(interaction.user, game, settlement));
    return;
  }

  if (interaction.commandName === '키노') {
    const game = playKeno({
      numbers: interaction.options.getString('번호들', true),
      bet
    });
    const settlement = await settleGame(interaction, economy, bet, game.payout);

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
    `- \`/이모지경마\`: 실시간 이모지 트랙에서 1등 동물 적중 시 ${EMOJI_RACE_MULTIPLIER}배`,
    '- `/럭키세븐`: 주사위 2개 합이 7이면 5.5배',
    '- `/하이로우`: 두 번째 카드가 높음/낮음 적중 시 1.9배, 같은 숫자는 환불',
    '- `/블랙잭`: 승리 1.5배, 내추럴 블랙잭 2배, 무승부 환불',
    '- `/포커`: 5장 드로우 포커. 보류할 카드를 고르고 한 번 교체, J 이상 원페어부터 환급',
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

async function runEmojiRaceCommand(interaction, economy, logger, {
  bet,
  choice,
  randomInt,
  frameDelayMs = EMOJI_RACE_FRAME_DELAY_MS,
  sleep: sleepFn = sleep
}) {
  let reserved = false;
  let replied = false;

  try {
    await economy.reserveWager({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      username: interaction.user.username,
      bet
    });
    reserved = true;

    const race = playEmojiRace({
      choice,
      bet,
      ...(randomInt ? { randomInt } : {})
    });

    await interaction.reply(createEmojiRaceProgressPayload(interaction.user, race, race.frames[0]));
    replied = true;

    for (const frame of race.frames.slice(1, -1)) {
      await waitForRaceFrame(frameDelayMs, sleepFn);
      await interaction.editReply(createEmojiRaceProgressPayload(interaction.user, race, frame));
    }

    await waitForRaceFrame(frameDelayMs, sleepFn);
    const settlement = await economy.resolveReservedWager({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      username: interaction.user.username,
      bet,
      payout: race.payout
    });
    reserved = false;

    await interaction.editReply(createEmojiRaceResultPayload(interaction.user, race, settlement));
  } catch (error) {
    if (reserved) {
      await economy.refundReservedWager({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        username: interaction.user.username,
        bet
      }).catch((refundError) => logger.error('Failed to refund emoji race wager:', refundError));
    }

    if (replied && typeof interaction.editReply === 'function') {
      await interaction.editReply(createEmojiRaceFailurePayload(error)).catch((editError) => {
        logger.error('Failed to update emoji race failure message:', editError);
      });
      return;
    }

    throw error;
  }
}

function createEmojiRaceProgressPayload(user, race, frame) {
  const embed = new EmbedBuilder()
    .setTitle(frame.turn === 0 ? '🏁 이모지 경마 출발!' : `🏁 이모지 경마 진행 중 · ${frame.turn}턴`)
    .setDescription([
      `베팅: **${user.username}** → **${formatEmojiRaceChoice(race.choice)}**`,
      `배수: 적중 시 **${EMOJI_RACE_MULTIPLIER}배**`,
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

function createEmojiRaceResultPayload(user, race, settlement) {
  const embed = new EmbedBuilder()
    .setTitle('🏆 이모지 경마 결과')
    .setDescription([
      `베팅: **${user.username}** → **${formatEmojiRaceChoice(race.choice)}**`,
      `승자: **${formatEmojiRaceChoice(race.winnerId)}**`,
      '',
      '```text',
      formatEmojiRaceTrack(race.finalFrame),
      '```',
      race.win ? `배수: **${EMOJI_RACE_MULTIPLIER}배**` : '베팅한 동물이 1등하지 못했습니다.',
      formatSettlement(race.win, settlement)
    ].join('\n'))
    .setColor(race.win ? 0x22c55e : 0xef4444);

  return {
    embeds: [embed],
    components: []
  };
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

    const ticket = createScratchTicket({
      productId: product.id,
      randomInt: options.randomInt
    });
    gameId = createChallengeId();
    pendingScratchTickets.set(gameId, {
      guildId: interaction.guildId,
      userId: interaction.user.id,
      username: interaction.user.username,
      price: product.price,
      ticket,
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
    const settlement = await economy.resolveReservedWager({
      guildId: pending.guildId,
      userId: pending.userId,
      username: pending.username,
      bet: pending.price,
      payout: ticket.payout
    });
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

async function handlePokerButton(interaction, economy, logger) {
  const [action, gameId, rawIndex] = interaction.customId.split(':');
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

    const game = pressDeadlineRound(pending.game, {
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

async function handleCasinoQuickButton(interaction, economy, logger) {
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
      const game = playSlots({ bet });
      const settlement = await settleGame(interaction, economy, bet, game.payout);
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
      const game = playOddEven({ choice: normalizedChoice, bet });
      const settlement = await settleGame(interaction, economy, bet, game.payout);
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
      const game = playDice({ choice: normalizedChoice, bet });
      const settlement = await settleGame(interaction, economy, bet, game.payout);
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

async function settleGame(interaction, economy, bet, payout) {
  return economy.settleWager({
    guildId: interaction.guildId,
    userId: interaction.user.id,
    username: interaction.user.username,
    bet,
    payout
  });
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
