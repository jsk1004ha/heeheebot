import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder
} from 'discord.js';
import {
  createBlackjackRound,
  createPlayerBlackjackRound,
  formatCards,
  hitBlackjackRound,
  hitPlayerBlackjackRound,
  normalizeDiceChoice,
  normalizeOddEvenChoice,
  playBaccarat,
  playCraps,
  playDice,
  playHighLow,
  playKeno,
  playLuckySeven,
  playOddEven,
  playRoulette,
  playSicBo,
  standBlackjackRound,
  standPlayerBlackjackRound,
  playSlots
} from '../systems/casino.js';

const CHALLENGE_TTL_MS = 60_000;
const pendingBlackjackChallenges = new Map();
const pendingAiBlackjackGames = new Map();
const pendingPlayerBlackjackGames = new Map();

export const casinoCommands = [
  new SlashCommandBuilder()
    .setName('홀짝')
    .setDescription('홀/짝을 맞히면 약 1.9배를 받습니다.')
    .addIntegerOption((option) =>
      option
        .setName('돈')
        .setDescription('베팅할 돈')
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
        .setDescription('베팅할 돈')
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
        .setDescription('베팅할 돈')
        .setMinValue(1)
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('럭키세븐')
    .setDescription('주사위 2개의 합이 7이면 5.5배를 받습니다.')
    .addIntegerOption((option) =>
      option
        .setName('돈')
        .setDescription('베팅할 돈')
        .setMinValue(1)
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('하이로우')
    .setDescription('두 번째 카드가 첫 카드보다 높을지 낮을지 맞힙니다. 같은 숫자는 환불됩니다.')
    .addIntegerOption((option) =>
      option
        .setName('돈')
        .setDescription('베팅할 돈')
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
	        .setDescription('베팅할 돈')
	        .setMinValue(1)
	        .setRequired(true)
	    )
	    .addUserOption((option) =>
	      option
        .setName('상대')
        .setDescription('비우면 AI와 대결합니다.')
    ),
  new SlashCommandBuilder()
    .setName('룰렛')
    .setDescription('룰렛 휠에서 색상/홀짝/구간/0에 베팅합니다.')
    .addIntegerOption((option) =>
      option
        .setName('돈')
        .setDescription('베팅할 돈')
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
        .setDescription('베팅할 돈')
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
        .setDescription('베팅할 돈')
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
        .setDescription('베팅할 돈')
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
        .setDescription('베팅할 돈')
        .setMinValue(1)
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('번호들')
        .setDescription('예: 3 14 25 또는 3,14,25 (최대 5개)')
        .setMaxLength(30)
        .setRequired(true)
    )
	];

export function getCasinoCommandPayloads() {
  return casinoCommands.map((command) => command.toJSON());
}

export async function handleCasinoCommand(interaction, economy, logger = console) {
  if (interaction.isButton()) {
    return handleBlackjackButton(interaction, economy, logger);
  }

  if (!interaction.isChatInputCommand() || !isCasinoCommand(interaction.commandName)) {
    return false;
  }

  if (!interaction.inGuild()) {
    await interaction.reply({
      content: '서버에서만 사용할 수 있는 명령어입니다.',
      ephemeral: true
    });
    return true;
  }

  try {
    await routeCasinoCommand(interaction, economy);
  } catch (error) {
    logger.error(error);
    await interaction.reply({
      content: `게임 실패: ${error.message}`,
      ephemeral: true
    });
  }

  return true;
}

async function routeCasinoCommand(interaction, economy) {
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

    await interaction.reply(formatOddEvenResult(interaction.user, game, settlement));
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

    await interaction.reply(formatDiceResult(interaction.user, game, settlement));
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

    await interaction.reply(formatSlotResult(interaction.user, game, settlement));
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

  if (challengerProfile.balance < bet) {
    throw new Error(`내 잔액이 부족합니다. 현재 잔액: ${challengerProfile.balance.toLocaleString()}원`);
  }

  if (opponentProfile.balance < bet) {
    throw new Error(`${opponent.username}님의 잔액이 부족합니다. 현재 잔액: ${opponentProfile.balance.toLocaleString()}원`);
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
    content: `🃏 ${opponent}, ${interaction.user}님이 블랙잭 대결을 신청했습니다.\n베팅: **${bet.toLocaleString()}원씩**, 승자 독식: **${(bet * 2).toLocaleString()}원**\n60초 안에 수락해주세요.`,
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

async function handleBlackjackChallengeButton(interaction, economy, logger) {
  const [action, challengeId] = interaction.customId.split(':');
  const challenge = pendingBlackjackChallenges.get(challengeId);

  if (!challenge) {
    await interaction.reply({
      content: '이미 만료되었거나 처리된 대결입니다.',
      ephemeral: true
    });
    return true;
  }

  if (interaction.user.id !== challenge.opponent.userId) {
    await interaction.reply({
      content: '이 대결의 상대만 버튼을 누를 수 있습니다.',
      ephemeral: true
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
      content: `🃏 ${interaction.user}님이 블랙잭 대결을 거절했습니다.`,
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

    await interaction.update({
      content: formatPlayerBlackjackProgress(challenge, game),
      components: [createPlayerBlackjackActionRow(gameId)]
    });
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
      ephemeral: true
    });
    return true;
  }

  if (interaction.user.id !== pending.userId) {
    await interaction.reply({
      content: '이 블랙잭을 시작한 유저만 버튼을 누를 수 있습니다.',
      ephemeral: true
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
      ephemeral: true
    });
    return true;
  }

  const participant = getBlackjackParticipant(pending, interaction.user.id);
  if (!participant) {
    await interaction.reply({
      content: '이 블랙잭 대결의 참여자만 버튼을 누를 수 있습니다.',
      ephemeral: true
    });
    return true;
  }

  if (pending.game.currentTurn !== participant) {
    await interaction.reply({
      content: '아직 내 차례가 아닙니다.',
      ephemeral: true
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
      await interaction.update({
        content: formatPlayerBlackjackProgress(pending, game),
        components: [createPlayerBlackjackActionRow(gameId)]
      });
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

    await interaction.update({
      content: formatPlayerBlackjackResult(pending, game, settlement),
      components: []
    });
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
    `🎲 **홀짝** — ${user}`,
    `선택: ${game.choice === 'odd' ? '홀' : '짝'} / 결과: ${game.roll} (${game.outcome === 'odd' ? '홀' : '짝'})`,
    formatSettlement(game.win, settlement)
  ].join('\n');
}

function formatDiceResult(user, game, settlement) {
  return [
    `🎲 **주사위** — ${user}`,
    `선택: ${game.choice === 'high' ? '높음(4~6)' : '낮음(1~3)'} / 결과: ${game.roll}`,
    formatSettlement(game.win, settlement)
  ].join('\n');
}

function formatSlotResult(user, game, settlement) {
  return [
    `🎰 **슬롯** — ${user}`,
    `${game.reels.join(' | ')}`,
    game.win ? `배수: ${game.multiplier}배` : '꽝',
    formatSettlement(game.win, settlement)
  ].join('\n');
}

function formatLuckySevenResult(user, game, settlement) {
  return [
    `🎲 **럭키세븐** — ${user}`,
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
    `🃏 **하이로우** — ${user}`,
    `선택: ${formatHighLowChoice(game.choice)} / 카드: ${game.firstCard} → ${game.secondCard} (${outcomeText})`,
    game.push ? '같은 숫자라 베팅금이 환불됩니다.' : '',
    formatSettlement(game.win || game.push, settlement)
  ].filter(Boolean).join('\n');
}

function formatRouletteResult(user, game, settlement) {
  return [
    `🎡 **룰렛** — ${user}`,
    `선택: ${formatRouletteChoice(game.choice)} / 결과: ${game.roll} (${formatRouletteColor(game.color)})`,
    formatSettlement(game.win, settlement)
  ].join('\n');
}

function formatBaccaratResult(user, game, settlement) {
  return [
    `🂡 **바카라** — ${user}`,
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
    `🎲 **크랩스** — ${user}`,
    `선택: ${game.choice === 'pass' ? '패스' : '돈패스'}${game.point ? ` / 포인트: ${game.point}` : ''}`,
    `롤: ${rolls}`,
    `결과: **${outcomeText}**`,
    formatSettlement(game.win || game.push, settlement)
  ].join('\n');
}

function formatSicBoResult(user, game, settlement) {
  return [
    `🎲 **시크보** — ${user}`,
    `선택: ${formatSicBoChoice(game.choice)} / 주사위: ${game.dice.join(' + ')} = ${game.total}`,
    game.triple ? '트리플!' : '트리플 아님',
    formatSettlement(game.win, settlement)
  ].join('\n');
}

function formatKenoResult(user, game, settlement) {
  return [
    `🔢 **키노** — ${user}`,
    `내 번호: ${game.picks.join(', ')}`,
    `추첨: ${game.draw.join(', ')}`,
    `적중: ${game.hits.length > 0 ? game.hits.join(', ') : '없음'} (${game.hits.length}개)`,
    game.win ? `배수: ${game.multiplier}배` : '꽝',
    formatSettlement(game.win, settlement)
  ].join('\n');
}

function formatAiBlackjackProgress(user, game) {
  return [
    `🃏 **블랙잭 vs AI** — ${user}`,
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
    `🃏 **블랙잭 vs AI** — ${user}`,
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

function formatPlayerBlackjackResult(challenge, game, settlement) {
  const challengerMention = `<@${challenge.challenger.userId}>`;
  const opponentMention = `<@${challenge.opponent.userId}>`;

  if (!game.winner) {
    return [
      '🃏 **블랙잭 유저 대결 결과**',
      `${challengerMention}: ${formatCards(game.challengerHand)} = ${game.challengerValue}`,
      `${opponentMention}: ${formatCards(game.opponentHand)} = ${game.opponentValue}`,
      '결과: **무승부** — 돈 이동 없음'
    ].join('\n');
  }

  const winnerMention = game.winner === 'challenger' ? challengerMention : opponentMention;
  const winnerBalance = settlement.winner.balance.toLocaleString();

  return [
    '🃏 **블랙잭 유저 대결 결과**',
    `${challengerMention}: ${formatCards(game.challengerHand)} = ${game.challengerValue}`,
    `${opponentMention}: ${formatCards(game.opponentHand)} = ${game.opponentValue}`,
    `승자: ${winnerMention}`,
    `상금: **${settlement.pot.toLocaleString()}원** / 승자 잔액: **${winnerBalance}원**`
  ].join('\n');
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
    ? `+${profit.toLocaleString()}원`
    : `${profit.toLocaleString()}원`;

  return [
    success ? '✅ 성공' : '❌ 실패',
    `베팅: ${settlement.bet.toLocaleString()}원 / 지급: ${settlement.payout.toLocaleString()}원 / 손익: **${profitText}**`,
    `현재 잔액: **${settlement.profile.balance.toLocaleString()}원**`
  ].join('\n');
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
