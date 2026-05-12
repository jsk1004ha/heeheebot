import {
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  SlashCommandBuilder
} from 'discord.js';
import { getStockCatalog } from '../systems/stocks.js';
import { SEASON_POINT_SOURCES } from '../systems/seasons.js';
import {
  safeAutocompleteRespond,
  toInteractionPayload
} from './interactions.js';
import { createPagedButtonRow, formatUserMention } from './ui.js';
import { formatSeasonAwardLine } from './seasons.js';

const STOCK_AUTOCOMPLETE_LIMIT = 25;
const DISCORD_CONTENT_MAX_LENGTH = 2000;
const STOCK_PAGE_CONTENT_MAX_LENGTH = 1900;
const STOCK_PAGINATION_TTL_MS = 10 * 60 * 1000;
const STOCK_PAGE_BUTTON_PREFIX = 'stock_page';
const STOCK_LEVERAGE_BUTTON_PREFIX = 'stock_leverage';
const stockPaginationSessions = new Map();
const FULL_MARKET_PAGE_SIZE = 10;
const STOCK_NAME_COLLATOR = new Intl.Collator('ko-KR', {
  numeric: true,
  sensitivity: 'base'
});

export const stockCommands = [
  new SlashCommandBuilder()
    .setName('주식')
    .setDescription('디코밈 가상주식 시장에서 시세를 보고 매매합니다.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('시세')
        .setDescription('급등락 상위 가상주식 또는 특정 종목 시세를 봅니다.')
        .addStringOption((option) =>
          option
            .setName('종목')
            .setDescription('확인할 종목명 또는 id. 예: 원숭이닉스')
            .setMaxLength(50)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('전체시세')
        .setDescription('전체 가상주식 시세를 봅니다.')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('신규상장')
        .setDescription('최근 상장된 종목과 상장 예정 종목을 봅니다.')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('매수')
        .setDescription('골드으로 가상주식을 매수합니다.')
        .addStringOption((option) =>
          option
            .setName('종목')
            .setDescription('매수할 종목명 또는 id. 예: 희진전자')
            .setMaxLength(50)
            .setAutocomplete(true)
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName('수량')
            .setDescription('매수 수량')
            .setMinValue(1)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('매도')
        .setDescription('보유한 가상주식을 매도합니다.')
        .addStringOption((option) =>
          option
            .setName('종목')
            .setDescription('매도할 종목명 또는 id. 예: 원숭이닉스')
            .setMaxLength(50)
            .setAutocomplete(true)
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName('수량')
            .setDescription('매도 수량')
            .setMinValue(1)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('지정가매수')
        .setDescription('목표 가격 이하가 되면 자동 매수되는 주문을 예약합니다.')
        .addStringOption((option) =>
          option
            .setName('종목')
            .setDescription('지정가 매수할 종목명 또는 id')
            .setMaxLength(50)
            .setAutocomplete(true)
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName('수량')
            .setDescription('예약 매수 수량')
            .setMinValue(1)
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName('가격')
            .setDescription('이 가격 이하가 되면 매수')
            .setMinValue(1)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('지정가매도')
        .setDescription('목표 가격 이상이 되면 자동 매도되는 주문을 예약합니다.')
        .addStringOption((option) =>
          option
            .setName('종목')
            .setDescription('지정가 매도할 종목명 또는 id')
            .setMaxLength(50)
            .setAutocomplete(true)
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName('수량')
            .setDescription('예약 매도 수량')
            .setMinValue(1)
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName('가격')
            .setDescription('이 가격 이상이 되면 매도')
            .setMinValue(1)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('주문')
        .setDescription('내 지정가 미체결 주문과 최근 체결/취소 주문을 봅니다.')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('주문취소')
        .setDescription('미체결 지정가 주문을 취소합니다.')
        .addStringOption((option) =>
          option
            .setName('주문')
            .setDescription('/주식 주문에서 보이는 주문 id')
            .setMaxLength(50)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('알림설정')
        .setDescription('가격이 목표가 이상/이하가 되면 조회 시 알림 상태로 표시합니다.')
        .addStringOption((option) =>
          option
            .setName('종목')
            .setDescription('알림을 걸 종목명 또는 id')
            .setMaxLength(50)
            .setAutocomplete(true)
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('조건')
            .setDescription('목표가 이상 또는 이하')
            .setRequired(true)
            .addChoices(
              { name: '이상', value: 'above' },
              { name: '이하', value: 'below' }
            )
        )
        .addIntegerOption((option) =>
          option
            .setName('가격')
            .setDescription('알림 목표 가격')
            .setMinValue(1)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('알림')
        .setDescription('내 활성 가격 알림과 최근 트리거 알림을 봅니다.')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('알림삭제')
        .setDescription('가격 알림을 삭제합니다.')
        .addStringOption((option) =>
          option
            .setName('알림')
            .setDescription('/주식 알림에서 보이는 알림 id')
            .setMaxLength(50)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('거래내역')
        .setDescription('내 최근 현물, 지정가, 레버리지 거래내역을 봅니다.')
        .addIntegerOption((option) =>
          option
            .setName('개수')
            .setDescription('표시할 거래 개수')
            .setMinValue(1)
            .setMaxValue(20)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('배당금')
        .setDescription('보유 주식에서 쌓인 배당금을 수령하고 최근 배당 내역을 봅니다.')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('뉴스')
        .setDescription('최근 시장 뉴스와 공시를 봅니다.')
        .addIntegerOption((option) =>
          option
            .setName('개수')
            .setDescription('표시할 뉴스 개수')
            .setMinValue(1)
            .setMaxValue(20)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('차트')
        .setDescription('종목의 최근 tick 가격 차트를 봅니다.')
        .addStringOption((option) =>
          option
            .setName('종목')
            .setDescription('차트를 볼 종목명 또는 id')
            .setMaxLength(50)
            .setAutocomplete(true)
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName('개수')
            .setDescription('표시할 가격 포인트 수')
            .setMinValue(2)
            .setMaxValue(20)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('보유')
        .setDescription('내 가상주식 보유 현황을 봅니다.')
        .addUserOption((option) =>
          option
            .setName('유저')
            .setDescription('확인할 유저. 비우면 본인')
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('랭킹')
        .setDescription('골드+주식 평가액 기준 가상주식 랭킹을 봅니다.')
        .addIntegerOption((option) =>
          option
            .setName('개수')
            .setDescription('표시할 인원 수')
            .setMinValue(1)
            .setMaxValue(20)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('레버리지진입')
        .setDescription('기간 만기 가격으로 자동 정산되는 롱/숏 레버리지 포지션을 엽니다.')
        .addStringOption((option) =>
          option
            .setName('종목')
            .setDescription('진입할 종목명 또는 id. 예: 원숭이닉스')
            .setMaxLength(50)
            .setAutocomplete(true)
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('방향')
            .setDescription('상승 베팅은 롱, 하락 베팅은 숏')
            .setRequired(true)
            .addChoices(
              { name: '롱', value: 'long' },
              { name: '숏', value: 'short' }
            )
        )
        .addIntegerOption((option) =>
          option
            .setName('배율')
            .setDescription('레버리지 배율. 10~29턴은 1~10배, 30턴 이상은 1~100배')
            .setMinValue(1)
            .setMaxValue(100)
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName('기간')
            .setDescription('자동 정산까지 기다릴 시장 턴 수 (10~100턴)')
            .setMinValue(10)
            .setMaxValue(100)
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName('증거금')
            .setDescription('포지션에 넣을 골드')
            .setMinValue(1)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('레버리지청산')
        .setDescription('레버리지 거래를 닫습니다. 하나만 있으면 대상 없이 바로 닫습니다.')
        .addStringOption((option) =>
          option
            .setName('대상')
            .setDescription('선택 사항: 번호, 종목명, 자동완성 중 하나. 비우면 자동 선택/버튼 선택')
            .setMaxLength(50)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('레버리지보유')
        .setDescription('롱/숏 레버리지 포지션과 자동 청산 내역을 확인합니다.')
        .addUserOption((option) =>
          option
            .setName('유저')
            .setDescription('확인할 유저. 비우면 본인')
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('채무상환')
        .setDescription('내 골드로 레버리지 파산채무를 직접 상환합니다.')
        .addIntegerOption((option) =>
          option
            .setName('금액')
            .setDescription('상환할 골드. 비우면 가능한 만큼 전액 상환')
            .setMinValue(1)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('관리자상장')
        .setDescription('관리자 권한으로 전 서버 공통 주식 종목을 상장합니다.')
        .addStringOption((option) =>
          option
            .setName('이름')
            .setDescription('상장할 종목 이름')
            .setMaxLength(30)
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('심볼')
            .setDescription('영문/숫자 심볼 2~6자')
            .setMaxLength(6)
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName('기준가')
            .setDescription('상장 기준가')
            .setMinValue(1)
            .setMaxValue(1_000_000)
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('업종')
            .setDescription('표시할 업종')
            .setMaxLength(20)
        )
        .addStringOption((option) =>
          option
            .setName('위험도')
            .setDescription('가격 변동 성향')
            .addChoices(
              { name: '안정', value: 'stable' },
              { name: '성장', value: 'growth' },
              { name: '순환', value: 'cyclical' },
              { name: '변동', value: 'volatile' },
              { name: '밈', value: 'meme' }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('관리자상장폐지')
        .setDescription('관리자 권한으로 전 서버 공통 주식 종목을 상장폐지합니다.')
        .addStringOption((option) =>
          option
            .setName('종목')
            .setDescription('상장폐지할 종목명 또는 id')
            .setMaxLength(50)
            .setAutocomplete(true)
            .setRequired(true)
        )
    )
];

export function getStockCommandPayloads() {
  return stockCommands.map((command) => command.toJSON());
}

export async function handleStockAutocomplete(interaction, stocks) {
  if (!interaction.isAutocomplete?.() || interaction.commandName !== '주식') {
    return false;
  }

  if (!interaction.guildId || interaction.inGuild?.() === false) {
    await safeAutocompleteRespond(interaction, []);
    return true;
  }

  const focused = interaction.options.getFocused(true);
  const subcommand = interaction.options.getSubcommand(false);
  if (['대상', '포지션'].includes(focused.name) && subcommand === '레버리지청산') {
    const choices = await getLeveragedPositionAutocompleteChoices(interaction, stocks, String(focused.value ?? ''));
    await safeAutocompleteRespond(interaction, choices.slice(0, STOCK_AUTOCOMPLETE_LIMIT));
    return true;
  }

  if (focused.name !== '종목') {
    await safeAutocompleteRespond(interaction, []);
    return true;
  }

  const query = String(focused.value ?? '');
  const choices = ['매도', '지정가매도'].includes(subcommand)
    ? await getSellStockAutocompleteChoices(interaction, stocks, query)
    : await getTradableStockAutocompleteChoices(interaction, stocks, query);

  await safeAutocompleteRespond(interaction, choices.slice(0, STOCK_AUTOCOMPLETE_LIMIT));
  return true;
}

export async function handleStockCommand(interaction, stocks, services = {}) {
  if (interaction.isButton?.()) {
    try {
      if (interaction.customId?.startsWith('stock_quick:')) {
        return handleStockQuickButton(interaction, stocks);
      }
      if (interaction.customId?.startsWith('stock_market_page:')) {
        return handleStockMarketPageButton(interaction, stocks);
      }
      if (interaction.customId?.startsWith(`${STOCK_LEVERAGE_BUTTON_PREFIX}:`)) {
        return handleStockLeverageButton(interaction, stocks);
      }
      return handleStockPaginationButton(interaction);
    } catch (error) {
      await safeReply(interaction, `주식 처리 실패: ${error.message}`, true);
      return true;
    }
  }

  if (!interaction.isChatInputCommand() || interaction.commandName !== '주식') {
    return false;
  }

  if (!interaction.inGuild()) {
    await replyStockContent(interaction, '서버에서만 사용할 수 있는 명령어입니다.', true);
    return true;
  }

  try {
    await routeStockCommand(interaction, stocks, services);
  } catch (error) {
    await safeReply(interaction, `주식 처리 실패: ${error.message}`, true);
  }

  return true;
}


async function awardStockTradeSeasonPoints(services, interaction) {
  if (typeof services?.seasons?.awardPoints !== 'function') return null;

  try {
    return await services.seasons.awardPoints({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      username: interaction.user.username,
      source: SEASON_POINT_SOURCES.STOCK_TRADE,
      points: 15
    });
  } catch (error) {
    services.logger?.debug?.('Failed to award stock trade season points:', error);
    return null;
  }
}

function withSeasonAward(content, award) {
  return [content, formatSeasonAwardLine(award)].filter(Boolean).join('\n');
}

async function routeStockCommand(interaction, stocks, services = {}) {
  const subcommand = interaction.options.getSubcommand(true);
  const guildId = interaction.guildId;
  const user = interaction.user;

  if (subcommand === '시세') {
    const stockId = interaction.options.getString('종목');
    if (stockId) {
      const quote = await stocks.getQuote({ guildId, stockId });
      await replyStockContent(interaction, formatQuote(quote), {
        components: createStockQuickRows(user.id)
      });
      return;
    }

    const market = await stocks.getMarket({ guildId, limit: 12 });
    await replyStockContent(interaction, formatMarketSummary(market), {
      components: createStockQuickRows(user.id)
    });
    return;
  }

  if (subcommand === '전체시세') {
    const market = await stocks.getMarket({ guildId });
    await replyStockContent(interaction, formatFullMarket(market), {
      components: createFullMarketPageRows(user.id, market)
    });
    return;
  }

  if (subcommand === '신규상장') {
    const listings = await stocks.getListings({ guildId });
    await replyStockContent(interaction, formatListings(listings));
    return;
  }

  if (subcommand === '매수') {
    const result = await stocks.buyStock({
      guildId,
      userId: user.id,
      username: user.username,
      stockId: interaction.options.getString('종목', true),
      quantity: interaction.options.getInteger('수량', true)
    });
    const seasonAward = await awardStockTradeSeasonPoints(services, interaction);
    await replyStockContent(interaction, withSeasonAward(formatBuyResult(user, result), seasonAward), {
      components: createStockQuickRows(user.id)
    });
    return;
  }

  if (subcommand === '매도') {
    const result = await stocks.sellStock({
      guildId,
      userId: user.id,
      username: user.username,
      stockId: interaction.options.getString('종목', true),
      quantity: interaction.options.getInteger('수량', true)
    });
    const seasonAward = await awardStockTradeSeasonPoints(services, interaction);
    await replyStockContent(interaction, withSeasonAward(formatSellResult(user, result), seasonAward), {
      components: createStockQuickRows(user.id)
    });
    return;
  }

  if (subcommand === '지정가매수' || subcommand === '지정가매도') {
    const result = await stocks.placeLimitOrder({
      guildId,
      userId: user.id,
      username: user.username,
      stockId: interaction.options.getString('종목', true),
      side: subcommand === '지정가매수' ? 'buy' : 'sell',
      quantity: interaction.options.getInteger('수량', true),
      limitPrice: interaction.options.getInteger('가격', true)
    });
    await replyStockContent(interaction, formatLimitOrderPlaced(user, result));
    return;
  }

  if (subcommand === '주문') {
    const orders = await stocks.getLimitOrders({
      guildId,
      userId: user.id,
      username: user.username
    });
    await replyStockContent(interaction, formatLimitOrders(user, orders));
    return;
  }

  if (subcommand === '주문취소') {
    const result = await stocks.cancelLimitOrder({
      guildId,
      userId: user.id,
      username: user.username,
      orderId: interaction.options.getString('주문', true)
    });
    await replyStockContent(interaction, formatLimitOrderCancelled(user, result));
    return;
  }

  if (subcommand === '알림설정') {
    const alert = await stocks.setPriceAlert({
      guildId,
      userId: user.id,
      username: user.username,
      stockId: interaction.options.getString('종목', true),
      condition: interaction.options.getString('조건', true),
      targetPrice: interaction.options.getInteger('가격', true),
      channelId: interaction.channelId
    });
    await replyStockContent(interaction, formatAlertCreated(user, alert));
    return;
  }

  if (subcommand === '알림') {
    const alerts = await stocks.getPriceAlerts({
      guildId,
      userId: user.id,
      username: user.username
    });
    await replyStockContent(interaction, formatAlerts(user, alerts));
    return;
  }

  if (subcommand === '알림삭제') {
    const alert = await stocks.deletePriceAlert({
      guildId,
      userId: user.id,
      username: user.username,
      alertId: interaction.options.getString('알림', true)
    });
    await replyStockContent(interaction, formatAlertDeleted(user, alert));
    return;
  }

  if (subcommand === '거래내역') {
    const history = await stocks.getTradeHistory({
      guildId,
      userId: user.id,
      username: user.username,
      limit: interaction.options.getInteger('개수') ?? 10
    });
    await replyStockContent(interaction, formatTradeHistory(user, history));
    return;
  }

  if (subcommand === '배당금') {
    const dividends = await stocks.claimDividends({
      guildId,
      userId: user.id,
      username: user.username
    });
    await replyStockContent(interaction, formatDividendSummary(user, dividends), {
      components: createStockQuickRows(user.id)
    });
    return;
  }

  if (subcommand === '뉴스') {
    const news = await stocks.getNews({
      guildId,
      limit: interaction.options.getInteger('개수') ?? 10
    });
    await replyStockContent(interaction, formatStockNews(news));
    return;
  }

  if (subcommand === '차트') {
    const chart = await stocks.getChart({
      guildId,
      stockId: interaction.options.getString('종목', true),
      points: interaction.options.getInteger('개수') ?? 8
    });
    await replyStockContent(interaction, formatStockChart(chart));
    return;
  }

  if (subcommand === '보유') {
    const target = interaction.options.getUser('유저') ?? user;
    const portfolio = await stocks.getPortfolio({
      guildId,
      userId: target.id,
      username: target.username
    });
    await replyStockContent(interaction, formatPortfolio(target, portfolio), {
      components: target.id === user.id ? createStockQuickRows(user.id) : []
    });
    return;
  }

  if (subcommand === '랭킹') {
    const leaderboard = await stocks.getLeaderboard({
      guildId,
      limit: interaction.options.getInteger('개수') ?? 10
    });
    await replyStockContent(interaction, formatLeaderboard(leaderboard));
    return;
  }

  if (subcommand === '레버리지진입') {
    const result = await stocks.openLeveragedPosition({
      guildId,
      userId: user.id,
      username: user.username,
      stockId: interaction.options.getString('종목', true),
      side: interaction.options.getString('방향', true),
      leverage: interaction.options.getInteger('배율', true),
      durationTurns: interaction.options.getInteger('기간', true),
      margin: interaction.options.getInteger('증거금', true)
    });
    await replyStockContent(interaction, formatOpenLeverageResult(user, result), {
      components: createLeveragePositionRows(user.id, [result.position], {
        includeNavigation: true
      })
    });
    return;
  }

  if (subcommand === '레버리지청산') {
    const closeTarget = await resolveLeverageCloseTarget(stocks, {
      guildId,
      user,
      rawTarget: getLeverageCloseInput(interaction)
    });

    if (closeTarget.selection) {
      await replyStockContent(interaction, formatLeverageCloseSelection(user, closeTarget.selection), {
        components: createLeveragePositionRows(user.id, closeTarget.selection.positions, {
          includeNavigation: true
        })
      });
      return;
    }

    const result = await stocks.closeLeveragedPosition({
      guildId,
      userId: user.id,
      username: user.username,
      positionId: closeTarget.positionId
    });
    const portfolio = await stocks.getLeveragePortfolio({ guildId, userId: user.id, username: user.username });
    await replyStockContent(interaction, formatCloseLeverageWithPortfolio(user, result, portfolio), {
      components: createLeveragePortfolioRows(user.id, portfolio)
    });
    return;
  }

  if (subcommand === '레버리지보유') {
    const target = interaction.options.getUser('유저') ?? user;
    const portfolio = await stocks.getLeveragePortfolio({
      guildId,
      userId: target.id,
      username: target.username
    });
    await replyStockContent(interaction, formatLeveragePortfolio(target, portfolio), {
      components: target.id === user.id ? createLeveragePortfolioRows(user.id, portfolio) : []
    });
    return;
  }

  if (subcommand === '채무상환') {
    const result = await stocks.repayBankruptcyDebt({
      guildId,
      userId: user.id,
      username: user.username,
      amount: interaction.options.getInteger('금액')
    });
    await replyStockContent(interaction, formatDebtRepaymentResult(user, result), {
      components: createStockQuickRows(user.id)
    });
    return;
  }

  if (subcommand === '관리자상장') {
    assertStockAdmin(interaction);
    const stock = await stocks.listAdminStock({
      guildId,
      name: interaction.options.getString('이름', true),
      symbol: interaction.options.getString('심볼', true),
      sector: interaction.options.getString('업종') ?? '관리자',
      risk: interaction.options.getString('위험도') ?? 'stable',
      basePrice: interaction.options.getInteger('기준가', true)
    });
    await replyStockContent(interaction, formatAdminListedStock(stock));
    return;
  }

  if (subcommand === '관리자상장폐지') {
    assertStockAdmin(interaction);
    const stock = await stocks.delistAdminStock({
      guildId,
      stockId: interaction.options.getString('종목', true)
    });
    await replyStockContent(interaction, formatAdminDelistedStock(stock));
    return;
  }

  await replyStockContent(interaction, '알 수 없는 주식 명령입니다. `/주식 시세` 또는 `/주식 전체시세`로 다시 시도해주세요.');
}

function assertStockAdmin(interaction) {
  const permissions = interaction.memberPermissions;
  const hasPermission = permissions?.has?.(PermissionFlagsBits.ManageGuild)
    || permissions?.has?.(PermissionFlagsBits.Administrator)
    || permissions?.has?.('ManageGuild')
    || permissions?.has?.('Administrator');

  if (!hasPermission) {
    throw new Error('이 주식 설정은 서버 관리자만 사용할 수 있습니다.');
  }
}

function getLeverageCloseInput(interaction) {
  return interaction.options.getString('대상') ?? interaction.options.getString('포지션') ?? '';
}

async function resolveLeverageCloseTarget(stocks, { guildId, user, rawTarget }) {
  const portfolio = await stocks.getLeveragePortfolio({
    guildId,
    userId: user.id,
    username: user.username
  });
  const positions = portfolio.positions;
  const target = String(rawTarget ?? '').trim();

  if (!target) {
    if (positions.length === 1) {
      return { positionId: positions[0].id };
    }
    return {
      selection: {
        portfolio,
        positions,
        reason: positions.length === 0 ? 'empty' : 'choose'
      }
    };
  }

  const exactMatch = positions.find((position) => position.id === target);
  if (exactMatch) return { positionId: exactMatch.id };

  if (/^\d+$/.test(target)) {
    const numberIndex = Number.parseInt(target, 10) - 1;
    if (numberIndex >= 0 && numberIndex < positions.length) {
      return { positionId: positions[numberIndex].id };
    }
  }

  const normalizedTarget = normalizeAutocompleteQuery(target);
  const matches = positions.filter((position, index) =>
    matchesLeverageCloseTarget(position, index, normalizedTarget)
  );

  if (matches.length === 1) {
    return { positionId: matches[0].id };
  }

  return {
    selection: {
      portfolio,
      positions: matches.length > 0 ? matches : positions,
      reason: matches.length > 1 ? 'ambiguous' : 'not_found',
      rawTarget: target
    }
  };
}

function matchesLeverageCloseTarget(position, index, normalizedTarget) {
  if (!normalizedTarget) return true;
  return [
    String(index + 1),
    `${index + 1}번`,
    position.id,
    position.stockId,
    position.stock?.id,
    position.stock?.name,
    position.stock?.symbol,
    formatLeverageSide(position.side),
    position.side,
    `${position.leverage}배`
  ].some((value) => normalizeAutocompleteQuery(value).includes(normalizedTarget));
}

async function handleStockQuickButton(interaction, stocks) {
  const [, action, ownerId] = interaction.customId.split(':');

  if (ownerId && interaction.user.id !== ownerId) {
    await interaction.reply({
      content: '이 주식 시세 버튼은 명령어를 실행한 유저만 사용할 수 있습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (!interaction.inGuild()) {
    await interaction.reply({
      content: '서버에서만 사용할 수 있는 명령어입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  const guildId = interaction.guildId;
  const user = interaction.user;
  let content = '';
  let components = createStockQuickRows(user.id);

  if (action === 'gainers') {
    const market = await stocks.getMarket({ guildId });
    content = formatTopMovers(market, {
      title: '📈 **상승 TOP**',
      direction: 'desc'
    });
  } else if (action === 'losers') {
    const market = await stocks.getMarket({ guildId });
    content = formatTopMovers(market, {
      title: '📉 **하락 TOP**',
      direction: 'asc'
    });
  } else if (action === 'listings') {
    content = formatListings(await stocks.getListings({ guildId }));
  } else if (action === 'portfolio') {
    content = formatPortfolio(user, await stocks.getPortfolio({
      guildId,
      userId: user.id,
      username: user.username
    }));
  } else if (action === 'leverage') {
    const portfolio = await stocks.getLeveragePortfolio({
      guildId,
      userId: user.id,
      username: user.username
    });
    content = formatLeveragePortfolio(user, portfolio);
    components = createLeveragePortfolioRows(user.id, portfolio);
  } else {
    await interaction.reply({
      content: '알 수 없는 주식 빠른 버튼입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  await interaction.update({
    content,
    components
  });
  return true;
}

async function handleStockLeverageButton(interaction, stocks) {
  const parsed = parseStockLeverageCustomId(interaction.customId);
  if (!parsed) return false;

  if (parsed.ownerId && interaction.user.id !== parsed.ownerId) {
    await interaction.reply({
      content: '이 레버리지 닫기 버튼은 거래 주인만 사용할 수 있습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (!interaction.inGuild()) {
    await interaction.reply({
      content: '서버에서만 사용할 수 있는 명령어입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (parsed.action !== 'close' || !parsed.positionId) {
    await interaction.reply({
      content: '알 수 없는 레버리지 버튼입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  const result = await stocks.closeLeveragedPosition({
    guildId: interaction.guildId,
    userId: interaction.user.id,
    username: interaction.user.username,
    positionId: parsed.positionId
  });
  const portfolio = await stocks.getLeveragePortfolio({
    guildId: interaction.guildId,
    userId: interaction.user.id,
    username: interaction.user.username
  });

  await interaction.update({
    content: formatCloseLeverageWithPortfolio(interaction.user, result, portfolio),
    components: createLeveragePortfolioRows(interaction.user.id, portfolio)
  });
  return true;
}

async function handleStockMarketPageButton(interaction, stocks) {
  const [, rawPage, ownerId] = interaction.customId.split(':');

  if (ownerId && interaction.user.id !== ownerId) {
    await interaction.reply({
      content: '이 주식 전체시세 페이지는 명령어를 실행한 유저만 넘길 수 있습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (!interaction.inGuild()) {
    await interaction.reply({
      content: '서버에서만 사용할 수 있는 명령어입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  const requestedPage = Number.parseInt(rawPage, 10);
  const market = await stocks.getMarket({ guildId: interaction.guildId });
  const totalPages = getFullMarketPageCount(market.stocks.length);
  const page = clampFullMarketPage(Number.isFinite(requestedPage) ? requestedPage : 0, totalPages);

  await interaction.update({
    content: formatFullMarket(market, { page }),
    components: createFullMarketPageRows(interaction.user.id, market, page)
  });
  return true;
}

function createStockQuickRows(userId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`stock_quick:gainers:${userId}`)
        .setLabel('상승 TOP')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`stock_quick:losers:${userId}`)
        .setLabel('하락 TOP')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`stock_quick:listings:${userId}`)
        .setLabel('신규상장')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`stock_quick:portfolio:${userId}`)
        .setLabel('내 보유')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`stock_quick:leverage:${userId}`)
        .setLabel('레버리지')
        .setStyle(ButtonStyle.Secondary)
    )
  ];
}

function createLeveragePortfolioRows(userId, portfolio) {
  return createLeveragePositionRows(userId, portfolio.positions, {
    includeNavigation: true
  });
}

function createLeveragePositionRows(userId, positions, { includeNavigation = false } = {}) {
  const rows = [];
  const closeButtons = positions
    .slice(0, 10)
    .map((position, index) => new ButtonBuilder()
      .setCustomId(createStockLeverageCustomId('close', userId, position.id))
      .setLabel(`${index + 1}번 닫기`)
      .setStyle(ButtonStyle.Danger));

  for (let index = 0; index < closeButtons.length; index += 5) {
    rows.push(new ActionRowBuilder().addComponents(...closeButtons.slice(index, index + 5)));
  }

  if (includeNavigation && rows.length < 5) {
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`stock_quick:leverage:${userId}`)
        .setLabel('레버리지 보유')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`stock_quick:portfolio:${userId}`)
        .setLabel('전체 보유')
        .setStyle(ButtonStyle.Secondary)
    ));
  }

  return rows;
}

function createFullMarketPageRows(userId, market, page = 0) {
  const totalPages = getFullMarketPageCount(market.stocks.length);
  if (totalPages <= 1) return [];
  const currentPage = clampFullMarketPage(page, totalPages);

  return [
    createPagedButtonRow({
      previousCustomId: `stock_market_page:${Math.max(0, currentPage - 1)}:${userId}`,
      nextCustomId: `stock_market_page:${Math.min(totalPages - 1, currentPage + 1)}:${userId}`,
      previousLabel: '이전 10개',
      nextLabel: '다음 10개',
      pageIndex: currentPage,
      pageCount: totalPages
    })
  ];
}

function formatTopMovers(market, { title, direction }) {
  const stocks = [...market.stocks]
    .sort((a, b) => direction === 'asc'
      ? a.changePercent - b.changePercent
      : b.changePercent - a.changePercent)
    .slice(0, 5);
  const body = stocks.length > 0
    ? stocks.map(formatMarketLine).join('\n')
    : '표시할 종목이 없습니다.';

  return [
    `${title}`,
    body,
    '',
    '`/주식 시세` 기본 화면으로 돌아가려면 명령어를 다시 실행하면 됩니다.'
  ].join('\n');
}

async function getSellStockAutocompleteChoices(interaction, stocks, query) {
  if (!interaction.guildId || !interaction.user?.id) return [];

  const portfolio = await stocks.getPortfolio({
    guildId: interaction.guildId,
    userId: interaction.user.id,
    username: interaction.user.username
  });

  return portfolio.positions
    .filter((position) => matchesStockQuery(position.stock, query))
    .map((position) => ({
      name: `${position.stock.name} · ${position.stock.symbol} · 보유 ${position.quantity.toLocaleString()}주`,
      value: position.stockId
    }));
}

async function getLeveragedPositionAutocompleteChoices(interaction, stocks, query) {
  if (!interaction.guildId || !interaction.user?.id || !stocks?.getLeveragePortfolio) return [];

  const normalizedQuery = normalizeAutocompleteQuery(query);
  const portfolio = await stocks.getLeveragePortfolio({
    guildId: interaction.guildId,
    userId: interaction.user.id,
    username: interaction.user.username
  });

  return portfolio.positions
    .map((position, index) => ({
      name: formatLeveragePositionChoice(position, index),
      value: position.id
    }))
    .filter((choice) => {
      if (!normalizedQuery) return true;
      return normalizeAutocompleteQuery(`${choice.name} ${choice.value}`).includes(normalizedQuery);
    });
}

function formatLeveragePositionChoice(position, index) {
  return [
    `${index + 1}. ${position.stock.name}`,
    `${formatLeverageSide(position.side)} ${position.leverage}배`,
    formatLeverageTerm(position),
    `평가 ${position.equity.toLocaleString()}G`,
    `손익 ${formatSignedMoney(position.unrealizedProfit)}`
  ].filter(Boolean).join(' · ').slice(0, 100);
}

async function getTradableStockAutocompleteChoices(interaction, stocks, query) {
  if (!interaction.guildId || !stocks?.getMarket) return getCatalogAutocompleteChoices(query);

  try {
    const market = await stocks.getMarket({ guildId: interaction.guildId });
    return market.stocks
      .filter((stock) => stock.status !== 'delisted')
      .filter((stock) => matchesStockQuery(stock, query))
      .map((stock) => ({
        name: `${stock.name} · ${stock.symbol} · ${stock.sector}${stock.dynamic ? ' · 자동상장' : ''}`,
        value: stock.id
      }));
  } catch {
    return getCatalogAutocompleteChoices(query);
  }
}

function getCatalogAutocompleteChoices(query) {
  return getStockCatalog()
    .filter((stock) => matchesStockQuery(stock, query))
    .map((stock) => ({
      name: `${stock.name} · ${stock.symbol} · ${stock.sector}`,
      value: stock.id
    }));
}

function matchesStockQuery(stock, query) {
  const normalizedQuery = normalizeAutocompleteQuery(query);
  if (!normalizedQuery) return true;

  return [
    stock.id,
    stock.name,
    stock.symbol,
    stock.sector,
    ...(stock.aliases ?? [])
  ].some((value) => normalizeAutocompleteQuery(value).includes(normalizedQuery));
}

function normalizeAutocompleteQuery(value) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('ko-KR')
    .replace(/[\s_\-()·]/g, '');
}

function formatMarketSummary(market) {
  const body = market.stocks.map(formatMarketLine).join('\n');
  const totalStockCount = getStockCatalog().length;
  return [
    `📈 **디코밈 가상주식 시세 TOP ${market.stocks.length}**`,
    body,
    '',
    `\`/주식 전체시세\`로 ${totalStockCount}개 전체를 볼 수 있고, \`/주식 시세 종목:원숭이닉스\`처럼 개별 조회도 됩니다.`
  ].join('\n');
}

function formatFullMarket(market, { page = 0, pageSize = FULL_MARKET_PAGE_SIZE } = {}) {
  const totalPages = getFullMarketPageCount(market.stocks.length, pageSize);
  const currentPage = clampFullMarketPage(page, totalPages);
  const start = currentPage * pageSize;
  const visibleStocks = [...market.stocks]
    .sort(compareStocksByKoreanName)
    .slice(start, start + pageSize);
  const body = visibleStocks.length > 0
    ? visibleStocks.map(formatMarketLine).join('\n')
    : '표시할 종목이 없습니다.';
  const pageText = totalPages > 1
    ? ` · ${currentPage + 1}/${totalPages}페이지 · 페이지당 ${pageSize}개`
    : '';

  return `📊 **디코밈 가상주식 전체 시세 ${market.stocks.length}종목**${pageText}\n${body}`;
}

function compareStocksByKoreanName(a, b) {
  return STOCK_NAME_COLLATOR.compare(a.name, b.name)
    || STOCK_NAME_COLLATOR.compare(a.symbol, b.symbol)
    || STOCK_NAME_COLLATOR.compare(a.id, b.id);
}

function getFullMarketPageCount(totalCount, pageSize = FULL_MARKET_PAGE_SIZE) {
  return Math.max(1, Math.ceil(totalCount / pageSize));
}

function clampFullMarketPage(page, totalPages) {
  return Math.min(Math.max(0, page), Math.max(1, totalPages) - 1);
}

function formatListings(listings) {
  const recent = listings.recent.length > 0
    ? listings.recent
      .map((stock) => `- 🆕 **${stock.name}** \`${stock.symbol}\` ${stock.price.toLocaleString()}골드 / 최근 상장`)
      .join('\n')
    : '최근 신규상장 종목이 없습니다.';
  const upcoming = listings.upcoming.length > 0
    ? listings.upcoming
      .map((stock) => `- 상장 예정: **${stock.name}** \`${stock.symbol}\` (${stock.sector})`)
      .join('\n')
    : '상장 예정 종목이 없습니다.';

  return [
    `🆕 **신규상장 보드**`,
    '**최근 상장**',
    recent,
    '',
    '**상장 예정**',
    upcoming
  ].join('\n');
}

function formatQuote(quote) {
  const statusText = formatStockStatus(quote);
  return [
    `📌 **${quote.name}** (${quote.sector})`,
    `상태: **${statusText}**`,
    `현재가: **${quote.price.toLocaleString()}골드** / 변동: ${formatTrendMarker(quote.changePercent)} **${formatSignedPercent(quote.changePercent)}**`,
    `배당률: **${formatDividendPercent(quote.dividendBps)}**${quote.dividendUpdatedAtTick ? ` / 최근 조정: ${quote.dividendUpdatedAtTick}턴` : ''}`,
    `이전가: ${quote.previousPrice.toLocaleString()}골드`,
    quote.news
  ].join('\n');
}

function formatBuyResult(user, result) {
  return [
    `🛒 **가상주식 매수 완료** — ${formatUserMention(user, user.username)}`,
    `종목: **${result.stock.name}** × ${result.quantity.toLocaleString()}주`,
    `단가: ${result.price.toLocaleString()}골드 / 매수금액: ${result.subtotal.toLocaleString()}골드 / 수수료: ${result.fee.toLocaleString()}골드`,
    `골드: **${result.profile.balance.toLocaleString()}골드** / 보유: ${result.holding.quantity.toLocaleString()}주 / 평단: ${result.holding.averageCost.toLocaleString()}골드`
  ].join('\n');
}

function formatSellResult(user, result) {
  return [
    `💸 **가상주식 매도 완료** — ${formatUserMention(user, user.username)}`,
    `종목: **${result.stock.name}** × ${result.quantity.toLocaleString()}주`,
    `단가: ${result.price.toLocaleString()}골드 / 매도금액: ${result.subtotal.toLocaleString()}골드 / 수수료: ${result.fee.toLocaleString()}골드`,
    formatRepaymentLine(result),
    `실현손익: **${formatSignedMoney(result.realizedProfit)}** / 골드: **${result.profile.balance.toLocaleString()}골드** / 남은 보유: ${result.holding.quantity.toLocaleString()}주`
  ].filter(Boolean).join('\n');
}

function formatLimitOrderPlaced(user, result) {
  const sideLabel = formatOrderSide(result.side);
  const reserveText = result.side === 'buy'
    ? `예약금: **${result.reservedCash.toLocaleString()}골드**`
    : `예약 수량: **${result.reservedQuantity.toLocaleString()}주**`;

  return [
    `🧾 **지정가 ${sideLabel} 주문 등록** — ${formatUserMention(user, user.username)}`,
    `주문: \`${result.id}\` / 종목: **${result.stock.name}** × ${result.quantity.toLocaleString()}주`,
    `조건: ${result.side === 'buy' ? '현재가가' : '현재가가'} **${result.limitPrice.toLocaleString()}골드** ${result.side === 'buy' ? '이하' : '이상'}이면 체결`,
    reserveText,
    '`/주식 주문`에서 미체결 주문을 확인하고 `/주식 주문취소`로 취소할 수 있습니다.'
  ].join('\n');
}

function formatLimitOrders(user, orders) {
  const open = orders.open.length > 0
    ? orders.open.map(formatOrderLine).join('\n')
    : '미체결 주문이 없습니다.';
  const recent = orders.recent.length > 0
    ? orders.recent.map(formatOrderLine).join('\n')
    : '최근 체결/취소 주문이 없습니다.';

  return [
    `🧾 **${user.username}님의 지정가 주문**`,
    '**미체결 주문**',
    open,
    '',
    '**최근 주문**',
    recent
  ].join('\n');
}

function formatLimitOrderCancelled(user, order) {
  return [
    `🧾 **지정가 주문 취소** — ${formatUserMention(user, user.username)}`,
    `주문: \`${order.id}\` / 종목: **${order.stock.name}** / ${formatOrderSide(order.side)} ${order.quantity.toLocaleString()}주`,
    '예약 골드/주식은 지갑과 보유량으로 되돌렸습니다.'
  ].join('\n');
}

function formatAlertCreated(user, alert) {
  return [
    `🔔 **가격 알림 등록** — ${formatUserMention(user, user.username)}`,
    `알림: \`${alert.id}\` / 종목: **${alert.stock.name}**`,
    `조건: 현재가가 **${alert.targetPrice.toLocaleString()}골드** ${formatAlertCondition(alert.condition)}이면 트리거`,
    '목표가에 닿으면 이 채널에 자동 푸시되고, `/주식 알림`으로 활성/트리거 알림을 확인할 수 있습니다.'
  ].join('\n');
}

function formatAlerts(user, alerts) {
  const active = alerts.active.length > 0
    ? alerts.active.map(formatAlertLine).join('\n')
    : '활성 알림이 없습니다.';
  const triggered = alerts.triggered.length > 0
    ? alerts.triggered.map(formatAlertLine).join('\n')
    : '최근 트리거 알림이 없습니다.';

  return [
    `🔔 **${user.username}님의 가격 알림**`,
    '**활성 알림**',
    active,
    '',
    '**최근 트리거**',
    triggered
  ].join('\n');
}

function formatAlertDeleted(user, alert) {
  return [
    `🔕 **가격 알림 삭제** — ${formatUserMention(user, user.username)}`,
    `알림: \`${alert.id}\` / 종목: **${alert.stock.name}**`
  ].join('\n');
}

function formatTradeHistory(user, history) {
  const body = history.entries.length > 0
    ? history.entries.map(formatTradeHistoryLine).join('\n')
    : '최근 거래내역이 없습니다.';

  return [
    `🧾 **${user.username}님의 주식 거래내역**`,
    body
  ].join('\n');
}

function formatDividendSummary(user, dividends) {
  const claimedAmount = normalizeDisplayAmount(dividends.claimedAmount);
  const pendingAmount = normalizeDisplayAmount(dividends.pendingAmount);
  const totalDividends = normalizeDisplayAmount(dividends.totalDividends);
  const claimedDividends = normalizeDisplayAmount(dividends.claimedDividends);
  const cash = normalizeDisplayAmount(dividends.cash);
  const intervalTicks = normalizeDisplayAmount(dividends.intervalTicks);
  const nextDividendTick = normalizeDisplayAmount(dividends.nextDividendTick);
  const claimText = claimedAmount > 0
    ? `이번 수령: **${claimedAmount.toLocaleString()}골드**`
    : '이번에 수령할 배당금이 없습니다.';
  const recent = Array.isArray(dividends.recent) && dividends.recent.length > 0
    ? dividends.recent.map(formatDividendHistoryLine).join('\n')
    : '최근 배당 내역이 없습니다.';

  return [
    `💰 **${user.username}님의 주식 배당금**`,
    claimText,
    `미수 배당금: **${pendingAmount.toLocaleString()}골드** / 누적 배당금: **${totalDividends.toLocaleString()}골드** / 수령 누계: **${claimedDividends.toLocaleString()}골드**`,
    `골드: **${cash.toLocaleString()}골드**`,
    `배당 주기: **${intervalTicks.toLocaleString()}시장 턴마다** / 다음 배당 예정: **${nextDividendTick.toLocaleString()}턴**`,
    '**최근 배당 내역**',
    recent
  ].join('\n');
}

function formatStockNews(news) {
  const body = news.entries.length > 0
    ? news.entries.map(formatStockNewsLine)
      .join('\n')
    : '최근 시장 뉴스/공시가 없다.';

  return [
    `🗞️ **주식 뉴스/공시**`,
    body
  ].join('\n');
}

function formatStockNewsLine(entry) {
  return `- **${entry.stock.name}** ${stripStockNewsPrefix(entry.message, entry.stock.name)}`;
}

function stripStockNewsPrefix(message, stockName = '') {
  let text = String(message ?? '').trim();
  if (!text) return '내용이 확인되지 않았다.';

  let previous;
  do {
    previous = text;
    text = text.replace(/^(시장 공시|신규상장 공시|시장 뉴스)\s*[:：]\s*/u, '').trim();
    text = stripLeadingStockName(text, stockName);
  } while (text !== previous);

  return text || '내용이 확인되지 않았다.';
}

function stripLeadingStockName(message, stockName) {
  const safeStockName = String(stockName ?? '').trim();
  if (!safeStockName) return message;

  return message
    .replace(new RegExp(`^${escapeRegExp(safeStockName)}(?:\\s+|\\s*[,，:：\\-—]\\s*)`, 'u'), '')
    .trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatStockChart(chart) {
  const body = chart.history.length > 0
    ? chart.history
      .map((point, index) => `- 기록 ${index + 1}: ${point.price.toLocaleString()}골드`)
      .join('\n')
    : '표시할 가격 기록이 없습니다.';

  return [
    `📉 **${chart.stock.name} 가격 차트**`,
    body
  ].join('\n');
}

function formatPortfolio(user, portfolio) {
  const pendingDividends = normalizeDisplayAmount(portfolio.pendingDividends);
  const totalDividends = normalizeDisplayAmount(portfolio.totalDividends);
  const positions = portfolio.positions.length > 0
    ? portfolio.positions
      .slice(0, 10)
      .map((position) => `- ${position.stock.name} ${position.quantity.toLocaleString()}주 / 평가 ${position.marketValue.toLocaleString()}골드 / 손익 ${formatSignedMoney(position.unrealizedProfit)} / 배당률 ${formatDividendPercent(position.stock.dividendBps)}`)
      .join('\n')
    : '보유 주식이 없습니다.';

  return [
    `💼 **${user.username}님의 가상주식 보유 현황**`,
    `골드: **${portfolio.cash.toLocaleString()}골드**`,
    formatBankruptcyLine(portfolio.bankruptcy),
    `주식 평가액: **${portfolio.stockValue.toLocaleString()}골드**`,
    `레버리지 평가금: **${portfolio.leveragedEquity.toLocaleString()}골드** / 부채 노출: **${(portfolio.leveragedDebt ?? 0).toLocaleString()}골드**`,
    `미수 배당금: **${pendingDividends.toLocaleString()}골드** / 누적 배당금: **${totalDividends.toLocaleString()}골드**`,
    `총자산: **${portfolio.totalAssets.toLocaleString()}골드**`,
    `평가손익: **${formatSignedMoney(portfolio.unrealizedProfit)}** / 레버리지 손익: **${formatSignedMoney(portfolio.leveragedUnrealizedProfit)}**`,
    `실현손익: **${formatSignedMoney(portfolio.realizedProfit)}** / 레버리지 실현손익: **${formatSignedMoney(portfolio.realizedLeveragedProfit)}**`,
    positions
  ].filter(Boolean).join('\n');
}

function formatLeaderboard(rows) {
  if (rows.length === 0) return '아직 가상주식 랭킹 데이터가 없습니다.';

  const body = rows
    .map((row, index) => `${index + 1}. **${row.username}** — 총자산 ${row.totalAssets.toLocaleString()}골드 / 골드 ${row.cash.toLocaleString()}골드 / 주식 ${row.stockValue.toLocaleString()}골드 / 레버리지 ${row.leveragedEquity.toLocaleString()}골드 / 미수배당 ${normalizeDisplayAmount(row.pendingDividends).toLocaleString()}골드`)
    .join('\n');
  return `🏆 **가상주식 총자산 랭킹**\n${body}`;
}

function formatOpenLeverageResult(user, result) {
  const position = result.position;
  const sideLabel = formatLeverageSide(position.side);
  return [
    `⚡ **레버리지 ${sideLabel} 진입 완료** — ${formatUserMention(user, user.username)}`,
    `종목: **${position.stock.name}** / 배율: **${position.leverage}배** / 기간: **${formatLeverageTerm(position)}**`,
    `진입가: ${position.entryPrice.toLocaleString()}골드 / 증거금: ${position.margin.toLocaleString()}골드 / 부채: ${position.debt.toLocaleString()}골드 / 명목가: ${position.notional.toLocaleString()}골드 / 수수료: ${result.fee.toLocaleString()}골드`,
    `골드: **${result.profile.balance.toLocaleString()}골드**`,
    '기간 중 변동은 정산하지 않고 만기 턴 가격으로 자동 정산됩니다. 버튼을 누르면 기존처럼 즉시 중도 청산할 수 있습니다.'
  ].join('\n');
}

function formatLeverageCloseSelection(user, selection) {
  if (selection.reason === 'empty') {
    return [
      `⚡ **${user.username}님의 레버리지 닫기**`,
      '닫을 레버리지 거래가 없습니다.',
      '`/주식 레버리지진입`으로 먼저 거래를 열 수 있습니다.'
    ].join('\n');
  }

  const lead = selection.rawTarget
    ? `입력한 **${selection.rawTarget}**만으로는 닫을 거래를 하나로 고르기 어렵습니다.`
    : '닫을 거래를 골라주세요.';
  const body = selection.positions.length > 0
    ? selection.positions
      .slice(0, 10)
      .map((position, index) => `${index + 1}. **${position.stock.name}** ${formatLeverageSide(position.side)} ${position.leverage}배${formatLeverageTermSuffix(position)} / 평가 ${position.equity.toLocaleString()}골드 / 손익 ${formatSignedMoney(position.unrealizedProfit)}`)
      .join('\n')
    : '일치하는 거래가 없습니다. 아래 레버리지 보유 버튼으로 전체를 다시 확인하세요.';

  return [
    `⚡ **${user.username}님의 레버리지 닫기**`,
    lead,
    body,
    '버튼을 누르거나 `/주식 레버리지청산 대상:1`처럼 번호만 입력해도 됩니다.'
  ].join('\n');
}

function formatCloseLeverageResult(user, result) {
  const position = result.position;
  const title = formatLeverageCloseTitle(result);
  const costs = formatLeverageSettlementCosts(result);
  if (result.liquidated) {
    return [
      `💥 **${title}** — ${formatUserMention(user, user.username)}`,
      `종목: **${position.stock.name}** / ${formatLeverageSide(position.side)} ${position.leverage}배${formatLeverageTermSuffix(position)}`,
      costs,
      `손익: **${formatSignedMoney(result.realizedProfit)}** / 지급액: 0골드`,
      result.bankruptcyDebtAdded > 0
        ? `파산채무 추가: **${result.bankruptcyDebtAdded.toLocaleString()}골드** / 남은 채무: **${result.bankruptcy.debt.toLocaleString()}골드**`
        : null,
      `골드: **${result.profile.balance.toLocaleString()}골드**`
    ].filter(Boolean).join('\n');
  }

  return [
    `✅ **${title}** — ${formatUserMention(user, user.username)}`,
    `종목: **${position.stock.name}** / ${formatLeverageSide(position.side)} ${position.leverage}배${formatLeverageTermSuffix(position)}`,
    `진입가: ${position.entryPrice.toLocaleString()}골드 → 청산가: ${position.currentPrice.toLocaleString()}골드`,
    costs,
    `손익: **${formatSignedMoney(result.realizedProfit)}** / 지급액: **${result.payout.toLocaleString()}골드**`,
    formatRepaymentLine(result),
    `골드: **${result.profile.balance.toLocaleString()}골드**`
  ].filter(Boolean).join('\n');
}

function formatCloseLeverageWithPortfolio(user, result, portfolio) {
  const closeText = formatCloseLeverageResult(user, result);
  const portfolioText = formatLeveragePortfolio(user, portfolio);
  const fullText = `${closeText}\n\n${portfolioText}`;
  if (fullText.length <= DISCORD_CONTENT_MAX_LENGTH) return fullText;

  return [
    closeText,
    '',
    '⚡ **남은 레버리지 보유 현황**',
    `평가금: **${portfolio.equityTotal.toLocaleString()}골드** / 부채 노출: **${portfolio.debtTotal.toLocaleString()}골드**`,
    `미실현손익: **${formatSignedMoney(portfolio.unrealizedProfit)}**`,
    portfolio.positions.length > 0
      ? '남은 거래는 아래 `레버리지 보유` 버튼으로 다시 확인하세요.'
      : '열려 있는 레버리지 거래가 없습니다.'
  ].join('\n');
}

function formatLeveragePortfolio(user, portfolio) {
  const settled = Array.isArray(portfolio.settled) ? portfolio.settled : portfolio.liquidated;
  const settledText = settled.length > 0
    ? `\n✅ 이번 조회에서 자동 정산: ${settled.map((entry) => `**${entry.stock.name}** ${formatLeverageSide(entry.side)} ${entry.leverage}배 ${formatSignedMoney(entry.realizedProfit)}`).join(', ')}`
    : '';
  const positions = portfolio.positions.length > 0
    ? portfolio.positions
      .slice(0, 10)
      .map((position, index) => [
        `${index + 1}. **${position.stock.name}** ${formatLeverageSide(position.side)} ${position.leverage}배${formatLeverageTermSuffix(position)}`,
        `  진입 ${position.entryPrice.toLocaleString()}골드 → 현재 ${position.currentPrice.toLocaleString()}골드 / 증거금 ${position.margin.toLocaleString()}골드 / 부채 ${position.debt.toLocaleString()}골드 / 평가 ${position.equity.toLocaleString()}골드 / 손익 ${formatSignedMoney(position.unrealizedProfit)}`
      ].join('\n'))
      .join('\n')
    : '열려 있는 레버리지 거래가 없습니다.';

  return [
    `⚡ **${user.username}님의 레버리지 보유 현황**`,
    `골드: **${portfolio.cash.toLocaleString()}골드**`,
    formatBankruptcyLine(portfolio.bankruptcy),
    `증거금 합계: **${portfolio.marginTotal.toLocaleString()}골드** / 부채 노출: **${portfolio.debtTotal.toLocaleString()}골드** / 명목가: **${portfolio.notionalTotal.toLocaleString()}골드** / 평가금: **${portfolio.equityTotal.toLocaleString()}골드**`,
    `미실현손익: **${formatSignedMoney(portfolio.unrealizedProfit)}** / 누적실현손익: **${formatSignedMoney(portfolio.realizedLeveragedProfit)}**`,
    positions + settledText
  ].filter(Boolean).join('\n');
}

function formatDebtRepaymentResult(user, result) {
  if (result.debtBefore <= 0) {
    return [
      `✅ **파산채무 상환 상태** — ${formatUserMention(user, user.username)}`,
      '상환할 파산채무가 없습니다.',
      `골드: **${result.profile.balance.toLocaleString()}골드** / 레버리지 진입 가능`
    ].join('\n');
  }

  if (result.repaid <= 0) {
    return [
      `⚠️ **파산채무 상환 실패** — ${formatUserMention(user, user.username)}`,
      `남은 채무: **${result.bankruptcy.debt.toLocaleString()}골드**`,
      '상환에 사용할 골드가 부족합니다. 골드 수익을 받으면 25%가 자동 상환됩니다.'
    ].join('\n');
  }

  return [
    `✅ **파산채무 상환 완료** — ${formatUserMention(user, user.username)}`,
    `상환: **${result.repaid.toLocaleString()}골드** / 남은 채무: **${result.bankruptcy.debt.toLocaleString()}골드**`,
    `골드: **${result.profile.balance.toLocaleString()}골드**`,
    result.bankruptcy.debt > 0
      ? '남은 채무가 있어 새 레버리지 진입은 아직 막혀 있습니다.'
      : '채무를 모두 갚았습니다. 레버리지 진입 가능!'
  ].join('\n');
}

function formatAdminListedStock(stock) {
  return [
    '✅ **관리자 주식 상장 완료**',
    `종목: **${stock.name}** \`${stock.symbol}\` (${stock.sector})`,
    `기준가: **${stock.price.toLocaleString()}골드** / 위험도: **${formatRisk(stock.risk)}**`,
    '이 종목은 전 서버 공통 주식 시장에 바로 반영됩니다.'
  ].join('\n');
}

function formatAdminDelistedStock(stock) {
  return [
    '🛑 **관리자 주식 상장폐지 완료**',
    `종목: **${stock.name}** \`${stock.symbol}\``,
    '전 서버 공통 시장에서 거래가 중지되고 보유/주문/알림/레버리지 상태가 정리됩니다.'
  ].join('\n');
}

function formatRisk(risk) {
  return {
    stable: '안정',
    growth: '성장',
    cyclical: '순환',
    volatile: '변동',
    meme: '밈'
  }[risk] ?? risk;
}

function formatBankruptcyLine(bankruptcy) {
  if (!bankruptcy || bankruptcy.debt <= 0) return null;
  return `파산채무: **${bankruptcy.debt.toLocaleString()}골드** / 골드 수익 25% 자동 상환 / 새 레버리지 진입 불가`;
}

function formatRepaymentLine(result) {
  if (!result?.repayment || result.repayment <= 0) return null;
  const debt = result.bankruptcy?.debt ?? result.profile?.bankruptcy?.debt ?? 0;
  const net = result.netPayout ?? result.netProceeds ?? 0;
  return `파산채무 자동 상환: **${result.repayment.toLocaleString()}골드** / 실수령: **${net.toLocaleString()}골드** / 남은 채무: **${debt.toLocaleString()}골드**`;
}

function formatMarketLine(stock) {
  const status = stock.status === 'delisted'
    ? ' ⛔상폐'
    : stock.eventType === 'ipo'
      ? ' 🆕신규'
      : stock.eventType === 'surge'
        ? ' 🚀급등'
        : stock.eventType === 'crash'
          ? ' ⚠️급락'
          : '';
  return `- ${formatTrendMarker(stock.changePercent)} **${stock.name}** \`${stock.symbol}\` ${stock.price.toLocaleString()}골드 (${formatSignedPercent(stock.changePercent)})${status}`;
}

function formatOrderLine(order) {
  let status = '미체결';
  if (order.status === 'filled') {
    status = `체결 ${(order.fillPrice ?? 0).toLocaleString()}골드`;
  } else if (order.status === 'cancelled') {
    status = `취소${order.cancelReason ? `(${order.cancelReason})` : ''}`;
  } else if (order.status !== 'open') {
    status = order.status;
  }
  return `- \`${order.id}\` **${order.stock.name}** ${formatOrderSide(order.side)} ${order.quantity.toLocaleString()}주 @ ${order.limitPrice.toLocaleString()}골드 — ${status}`;
}

function formatAlertLine(alert) {
  const status = alert.status === 'triggered'
    ? `트리거 ${alert.triggeredPrice.toLocaleString()}골드`
    : '대기 중';
  return `- \`${alert.id}\` **${alert.stock.name}** ${alert.targetPrice.toLocaleString()}골드 ${formatAlertCondition(alert.condition)} — ${status}`;
}

function formatTradeHistoryLine(entry) {
  const quantity = entry.quantity ? ` ${entry.quantity.toLocaleString()}주` : '';
  const price = entry.price ? ` @ ${entry.price.toLocaleString()}골드` : '';
  const total = entry.total ? ` / 총액 ${entry.total.toLocaleString()}골드` : '';
  const profit = entry.realizedProfit ? ` / 손익 ${formatSignedMoney(entry.realizedProfit)}` : '';
  return `- ${formatTradeType(entry.type)} **${entry.stock.name}**${quantity}${price}${total}${profit}`;
}

function formatDividendHistoryLine(entry) {
  const positions = Array.isArray(entry.positions) ? entry.positions : [];
  const mainPositions = positions
    .slice(0, 3)
    .map((position) => `**${position.stock?.name ?? position.stockId ?? '알 수 없음'}** ${normalizeDisplayAmount(position.quantity).toLocaleString()}주 ${normalizeDisplayAmount(position.amount).toLocaleString()}골드(${formatDividendPercent(position.dividendBps)})`)
    .join(', ');
  const extraCount = Math.max(0, positions.length - 3);
  const extraText = extraCount > 0 ? ` 외 ${extraCount.toLocaleString()}종` : '';
  const detail = mainPositions ? ` — ${mainPositions}${extraText}` : '';
  return `- ${normalizeDisplayAmount(entry.amount).toLocaleString()}골드${detail}`;
}

function normalizeDisplayAmount(value) {
  const normalized = Number(value);
  return Number.isSafeInteger(normalized) && normalized >= 0 ? normalized : 0;
}

function formatDividendPercent(dividendBps) {
  return `${Math.round((normalizeDisplayAmount(dividendBps) / 100) * 100) / 100}%`;
}

function formatSignedPercent(percent) {
  const sign = percent > 0 ? '+' : '';
  return `${sign}${percent.toLocaleString()}%`;
}

function formatTrendMarker(percent) {
  if (percent > 0) return '🔴 ▲';
  if (percent < 0) return '🔵 ▼';
  return '⚪ —';
}

function formatSignedMoney(amount) {
  const sign = amount > 0 ? '+' : '';
  return `${sign}${amount.toLocaleString()}골드`;
}

function formatLeverageSide(side) {
  return side === 'short' ? '숏' : '롱';
}

function formatLeverageTerm(position) {
  if (!Number.isSafeInteger(position?.durationTurns) || !Number.isSafeInteger(position?.expiresAtTick)) {
    return null;
  }
  const remaining = Number.isSafeInteger(position.remainingTurns)
    ? `남은 ${position.remainingTurns}턴`
    : `만기 ${position.expiresAtTick}턴`;
  return `${position.durationTurns}턴/${remaining}`;
}

function formatLeverageTermSuffix(position) {
  const term = formatLeverageTerm(position);
  return term ? ` / ${term}` : '';
}

function formatLeverageCloseTitle(result) {
  if (result.earlyClosed) return '레버리지 중도 청산 완료';
  if (result.expired) return '레버리지 만기 정산 완료';
  if (result.autoSettled) return '레버리지 자동 청산';
  return '레버리지 청산 완료';
}

function formatLeverageSettlementCosts(result) {
  const closingFee = Number.isSafeInteger(result?.closingFee) ? result.closingFee : 0;
  const penalty = Number.isSafeInteger(result?.penalty) ? result.penalty : 0;
  if (closingFee <= 0 && penalty <= 0) return '';
  return `중도청산 수수료: **${closingFee.toLocaleString()}골드** / 위약금: **${penalty.toLocaleString()}골드**`;
}

function formatOrderSide(side) {
  return side === 'sell' ? '매도' : '매수';
}

function formatAlertCondition(condition) {
  return condition === 'below' ? '이하' : '이상';
}

function formatTradeType(type) {
  return {
    buy: '현물 매수',
    sell: '현물 매도',
    limit_buy_fill: '지정가 매수 체결',
    limit_sell_fill: '지정가 매도 체결',
    delisting_cleanup: '상장폐지 정리',
    leverage_open: '레버리지 진입',
    leverage_close: '레버리지 청산',
    leverage_settlement: '레버리지 만기정산',
    leverage_liquidation: '레버리지 자동청산'
  }[type] ?? type;
}

function formatStockStatus(stock) {
  if (stock.status === 'delisted') return '상장폐지';
  if (stock.eventType === 'ipo') return '신규상장';
  if (stock.eventType === 'surge') return '급등 이벤트';
  if (stock.eventType === 'crash') return '급락 이벤트';
  return '정상 거래';
}

async function safeReply(interaction, content, ephemeral = false) {
  await replyStockContent(interaction, content, { ephemeral });
}

async function replyStockContent(interaction, content, options = {}) {
  const payloadOptions = typeof options === 'boolean' ? { ephemeral: options } : options;
  const { ephemeral = false, components = [] } = payloadOptions;
  const contentText = String(content ?? '');
  if (contentText.length <= DISCORD_CONTENT_MAX_LENGTH) {
    await sendStockPayload(interaction, { content: contentText, ephemeral, components });
    return;
  }

  cleanupExpiredStockPaginationSessions();

  const pages = splitDiscordContent(contentText, STOCK_PAGE_CONTENT_MAX_LENGTH);
  const sessionId = createStockPaginationSessionId();
  const ownerId = interaction.user?.id ?? 'unknown';
  stockPaginationSessions.set(sessionId, {
    ownerId,
    pages,
    expiresAt: Date.now() + STOCK_PAGINATION_TTL_MS
  });

  await sendStockPayload(interaction, createStockPagePayload({
    sessionId,
    ownerId,
    pages,
    pageIndex: 0,
    ephemeral
  }));
}

async function sendStockPayload(interaction, payload) {
  const responsePayload = toInteractionPayload(payload);
  if (interaction.deferred || interaction.replied) {
    await interaction.followUp(responsePayload);
  } else {
    await interaction.reply(responsePayload);
  }
}

async function handleStockPaginationButton(interaction) {
  const parsed = parseStockPageCustomId(interaction.customId);
  if (!parsed) return false;

  cleanupExpiredStockPaginationSessions();

  const { sessionId, ownerId, pageIndex } = parsed;
  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content: '이 주식 페이지 버튼은 명령어를 실행한 유저만 누를 수 있습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  const session = stockPaginationSessions.get(sessionId);
  if (!session) {
    await interaction.reply({
      content: '주식 페이지가 만료되었습니다. `/주식 전체시세`를 다시 실행해주세요.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  const nextPageIndex = Math.max(0, Math.min(pageIndex, session.pages.length - 1));
  session.expiresAt = Date.now() + STOCK_PAGINATION_TTL_MS;
  await interaction.update(createStockPagePayload({
    sessionId,
    ownerId,
    pages: session.pages,
    pageIndex: nextPageIndex
  }));
  return true;
}

function createStockLeverageCustomId(action, ownerId, positionId) {
  return `${STOCK_LEVERAGE_BUTTON_PREFIX}:${action}:${ownerId}:${positionId}`;
}

function parseStockLeverageCustomId(customId) {
  const parts = String(customId ?? '').split(':');
  if (parts[0] !== STOCK_LEVERAGE_BUTTON_PREFIX || parts.length < 3) return null;
  return {
    action: parts[1],
    ownerId: parts[2],
    positionId: parts.slice(3).join(':')
  };
}

function createStockPagePayload({
  sessionId,
  ownerId,
  pages,
  pageIndex,
  ephemeral = false
}) {
  const payload = {
    content: formatStockPageContent(pages[pageIndex], pageIndex, pages.length),
    components: createStockPaginationRows({ sessionId, ownerId, pageIndex, pageCount: pages.length })
  };
  return toInteractionPayload(payload, { ephemeral });
}

function formatStockPageContent(page, pageIndex, pageCount) {
  const footer = `\n\n_페이지 ${pageIndex + 1}/${pageCount} · 버튼으로 넘겨보세요._`;
  const maxPageLength = DISCORD_CONTENT_MAX_LENGTH - footer.length;
  return `${page.slice(0, maxPageLength)}${footer}`;
}

function createStockPaginationRows({ sessionId, ownerId, pageIndex, pageCount }) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(createStockPageCustomId(sessionId, ownerId, Math.max(0, pageIndex - 1), 'prev'))
        .setLabel('이전')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(pageIndex <= 0),
      new ButtonBuilder()
        .setCustomId(createStockPageCustomId(sessionId, ownerId, Math.min(pageCount - 1, pageIndex + 1), 'next'))
        .setLabel('다음')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(pageIndex >= pageCount - 1)
    )
  ];
}

function createStockPageCustomId(sessionId, ownerId, pageIndex, action) {
  return `${STOCK_PAGE_BUTTON_PREFIX}:${sessionId}:${ownerId}:${pageIndex}:${action}`;
}

function parseStockPageCustomId(customId) {
  const parts = String(customId ?? '').split(':');
  if (parts[0] !== STOCK_PAGE_BUTTON_PREFIX || parts.length !== 5) return null;

  const pageIndex = Number.parseInt(parts[3], 10);
  if (!Number.isInteger(pageIndex) || pageIndex < 0) return null;

  return {
    sessionId: parts[1],
    ownerId: parts[2],
    pageIndex,
    action: parts[4]
  };
}

function createStockPaginationSessionId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function cleanupExpiredStockPaginationSessions(now = Date.now()) {
  for (const [sessionId, session] of stockPaginationSessions.entries()) {
    if (session.expiresAt <= now) {
      stockPaginationSessions.delete(sessionId);
    }
  }
}

function splitDiscordContent(content, maxLength = DISCORD_CONTENT_MAX_LENGTH) {
  const normalizedContent = String(content ?? '');
  if (normalizedContent.length <= maxLength) {
    return [normalizedContent];
  }

  const chunks = [];
  let current = '';

  for (const line of normalizedContent.split('\n')) {
    if (line.length > maxLength) {
      if (current) {
        chunks.push(current);
        current = '';
      }

      for (let index = 0; index < line.length; index += maxLength) {
        chunks.push(line.slice(index, index + maxLength));
      }
      continue;
    }

    const next = current ? `${current}\n${line}` : line;
    if (next.length <= maxLength) {
      current = next;
      continue;
    }

    if (current) {
      chunks.push(current);
    }
    current = line;
  }

  if (current || chunks.length === 0) {
    chunks.push(current);
  }

  return chunks;
}
