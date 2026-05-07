import { SlashCommandBuilder } from 'discord.js';
import { getStockCatalog } from '../systems/stocks.js';

const STOCK_AUTOCOMPLETE_LIMIT = 25;

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
            .setMaxValue(10_000)
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
            .setMaxValue(10_000)
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
            .setMaxValue(10_000)
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
            .setMaxValue(10_000)
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
        .setDescription('1~100배 롱/숏 가상 레버리지 포지션을 엽니다.')
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
            .setDescription('레버리지 배율 1~100배')
            .setMinValue(1)
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
        .setDescription('레버리지 포지션 id를 지정해 청산합니다.')
        .addStringOption((option) =>
          option
            .setName('포지션')
            .setDescription('레버리지보유에서 보이는 포지션 id')
            .setMaxLength(50)
            .setRequired(true)
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
];

export function getStockCommandPayloads() {
  return stockCommands.map((command) => command.toJSON());
}

export async function handleStockAutocomplete(interaction, stocks) {
  if (!interaction.isAutocomplete?.() || interaction.commandName !== '주식') {
    return false;
  }

  if (!interaction.guildId || interaction.inGuild?.() === false) {
    await interaction.respond([]);
    return true;
  }

  const focused = interaction.options.getFocused(true);
  if (focused.name !== '종목') {
    await interaction.respond([]);
    return true;
  }

  const subcommand = interaction.options.getSubcommand(false);
  const query = String(focused.value ?? '');
  const choices = ['매도', '지정가매도'].includes(subcommand)
    ? await getSellStockAutocompleteChoices(interaction, stocks, query)
    : await getTradableStockAutocompleteChoices(interaction, stocks, query);

  await interaction.respond(choices.slice(0, STOCK_AUTOCOMPLETE_LIMIT));
  return true;
}

export async function handleStockCommand(interaction, stocks) {
  if (!interaction.isChatInputCommand() || interaction.commandName !== '주식') {
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
    await routeStockCommand(interaction, stocks);
  } catch (error) {
    await safeReply(interaction, `주식 처리 실패: ${error.message}`, true);
  }

  return true;
}

async function routeStockCommand(interaction, stocks) {
  const subcommand = interaction.options.getSubcommand(true);
  const guildId = interaction.guildId;
  const user = interaction.user;

  if (subcommand === '시세') {
    const stockId = interaction.options.getString('종목');
    if (stockId) {
      const quote = await stocks.getQuote({ guildId, stockId });
      await interaction.reply(formatQuote(quote));
      return;
    }

    const market = await stocks.getMarket({ guildId, limit: 12 });
    await interaction.reply(formatMarketSummary(market));
    return;
  }

  if (subcommand === '전체시세') {
    const market = await stocks.getMarket({ guildId });
    await interaction.reply(formatFullMarket(market));
    return;
  }

  if (subcommand === '신규상장') {
    const listings = await stocks.getListings({ guildId });
    await interaction.reply(formatListings(listings));
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
    await interaction.reply(formatBuyResult(user, result));
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
    await interaction.reply(formatSellResult(user, result));
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
    await interaction.reply(formatLimitOrderPlaced(user, result));
    return;
  }

  if (subcommand === '주문') {
    const orders = await stocks.getLimitOrders({
      guildId,
      userId: user.id,
      username: user.username
    });
    await interaction.reply(formatLimitOrders(user, orders));
    return;
  }

  if (subcommand === '주문취소') {
    const result = await stocks.cancelLimitOrder({
      guildId,
      userId: user.id,
      username: user.username,
      orderId: interaction.options.getString('주문', true)
    });
    await interaction.reply(formatLimitOrderCancelled(user, result));
    return;
  }

  if (subcommand === '알림설정') {
    const alert = await stocks.setPriceAlert({
      guildId,
      userId: user.id,
      username: user.username,
      stockId: interaction.options.getString('종목', true),
      condition: interaction.options.getString('조건', true),
      targetPrice: interaction.options.getInteger('가격', true)
    });
    await interaction.reply(formatAlertCreated(user, alert));
    return;
  }

  if (subcommand === '알림') {
    const alerts = await stocks.getPriceAlerts({
      guildId,
      userId: user.id,
      username: user.username
    });
    await interaction.reply(formatAlerts(user, alerts));
    return;
  }

  if (subcommand === '알림삭제') {
    const alert = await stocks.deletePriceAlert({
      guildId,
      userId: user.id,
      username: user.username,
      alertId: interaction.options.getString('알림', true)
    });
    await interaction.reply(formatAlertDeleted(user, alert));
    return;
  }

  if (subcommand === '거래내역') {
    const history = await stocks.getTradeHistory({
      guildId,
      userId: user.id,
      username: user.username,
      limit: interaction.options.getInteger('개수') ?? 10
    });
    await interaction.reply(formatTradeHistory(user, history));
    return;
  }

  if (subcommand === '뉴스') {
    const news = await stocks.getNews({
      guildId,
      limit: interaction.options.getInteger('개수') ?? 10
    });
    await interaction.reply(formatStockNews(news));
    return;
  }

  if (subcommand === '차트') {
    const chart = await stocks.getChart({
      guildId,
      stockId: interaction.options.getString('종목', true),
      points: interaction.options.getInteger('개수') ?? 8
    });
    await interaction.reply(formatStockChart(chart));
    return;
  }

  if (subcommand === '보유') {
    const target = interaction.options.getUser('유저') ?? user;
    const portfolio = await stocks.getPortfolio({
      guildId,
      userId: target.id,
      username: target.username
    });
    await interaction.reply(formatPortfolio(target, portfolio));
    return;
  }

  if (subcommand === '랭킹') {
    const leaderboard = await stocks.getLeaderboard({
      guildId,
      limit: interaction.options.getInteger('개수') ?? 10
    });
    await interaction.reply(formatLeaderboard(leaderboard));
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
      margin: interaction.options.getInteger('증거금', true)
    });
    await interaction.reply(formatOpenLeverageResult(user, result));
    return;
  }

  if (subcommand === '레버리지청산') {
    const result = await stocks.closeLeveragedPosition({
      guildId,
      userId: user.id,
      username: user.username,
      positionId: interaction.options.getString('포지션', true)
    });
    await interaction.reply(formatCloseLeverageResult(user, result));
    return;
  }

  if (subcommand === '레버리지보유') {
    const target = interaction.options.getUser('유저') ?? user;
    const portfolio = await stocks.getLeveragePortfolio({
      guildId,
      userId: target.id,
      username: target.username
    });
    await interaction.reply(formatLeveragePortfolio(target, portfolio));
    return;
  }

  await interaction.reply('알 수 없는 주식 명령입니다. `/주식 시세` 또는 `/주식 전체시세`로 다시 시도해주세요.');
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

async function getTradableStockAutocompleteChoices(interaction, stocks, query) {
  if (!interaction.guildId || !stocks?.getMarket) return getCatalogAutocompleteChoices(query);

  try {
    const market = await stocks.getMarket({ guildId: interaction.guildId });
    return market.stocks
      .filter((stock) => stock.status !== 'delisted')
      .filter((stock) => matchesStockQuery(stock, query))
      .map((stock) => ({
        name: `${stock.name} · ${stock.symbol} · ${stock.sector} · ${formatRisk(stock.risk)}${stock.dynamic ? ' · 자동상장' : ''}`,
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
      name: `${stock.name} · ${stock.symbol} · ${stock.sector} · ${formatRisk(stock.risk)}`,
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
    `📈 **디코밈 가상주식 시세 TOP ${market.stocks.length}** — tick #${market.tickIndex}`,
    body,
    '',
    `\`/주식 전체시세\`로 ${totalStockCount}개 전체를 볼 수 있고, \`/주식 시세 종목:원숭이닉스\`처럼 개별 조회도 됩니다.`
  ].join('\n');
}

function formatFullMarket(market) {
  const body = market.stocks.map(formatMarketLine).join('\n');
  return `📊 **디코밈 가상주식 전체 시세 ${market.stocks.length}종목** — tick #${market.tickIndex}\n${body}`;
}

function formatListings(listings) {
  const recent = listings.recent.length > 0
    ? listings.recent
      .map((stock) => `- 🆕 **${stock.name}** \`${stock.symbol}\` ${stock.price.toLocaleString()}골드 / tick #${stock.listedAtTick ?? stock.listedFromTick ?? 0}`)
      .join('\n')
    : '최근 신규상장 종목이 없습니다.';
  const upcoming = listings.upcoming.length > 0
    ? listings.upcoming
      .map((stock) => `- 예정 tick #${stock.listedFromTick}: **${stock.name}** \`${stock.symbol}\` (${stock.sector})`)
      .join('\n')
    : '상장 예정 종목이 없습니다.';

  return [
    `🆕 **신규상장 보드** — 현재 tick #${listings.tickIndex}`,
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
    `📌 **${quote.name}** (${quote.sector} / ${formatRisk(quote.risk)})`,
    `상태: **${statusText}**`,
    `현재가: **${quote.price.toLocaleString()}골드** / 변동: ${formatTrendMarker(quote.changePercent)} **${formatSignedPercent(quote.changePercent)}**`,
    `이전가: ${quote.previousPrice.toLocaleString()}골드`,
    `뉴스: ${quote.news}`
  ].join('\n');
}

function formatBuyResult(user, result) {
  return [
    `🛒 **가상주식 매수 완료** — ${user}`,
    `종목: **${result.stock.name}** × ${result.quantity.toLocaleString()}주`,
    `단가: ${result.price.toLocaleString()}골드 / 매수금액: ${result.subtotal.toLocaleString()}골드 / 수수료: ${result.fee.toLocaleString()}골드`,
    `골드: **${result.profile.balance.toLocaleString()}골드** / 보유: ${result.holding.quantity.toLocaleString()}주 / 평단: ${result.holding.averageCost.toLocaleString()}골드`
  ].join('\n');
}

function formatSellResult(user, result) {
  return [
    `💸 **가상주식 매도 완료** — ${user}`,
    `종목: **${result.stock.name}** × ${result.quantity.toLocaleString()}주`,
    `단가: ${result.price.toLocaleString()}골드 / 매도금액: ${result.subtotal.toLocaleString()}골드 / 수수료: ${result.fee.toLocaleString()}골드`,
    `실현손익: **${formatSignedMoney(result.realizedProfit)}** / 골드: **${result.profile.balance.toLocaleString()}골드** / 남은 보유: ${result.holding.quantity.toLocaleString()}주`
  ].join('\n');
}

function formatLimitOrderPlaced(user, result) {
  const sideLabel = formatOrderSide(result.side);
  const reserveText = result.side === 'buy'
    ? `예약금: **${result.reservedCash.toLocaleString()}골드**`
    : `예약 수량: **${result.reservedQuantity.toLocaleString()}주**`;

  return [
    `🧾 **지정가 ${sideLabel} 주문 등록** — ${user}`,
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
    `🧾 **지정가 주문 취소** — ${user}`,
    `주문: \`${order.id}\` / 종목: **${order.stock.name}** / ${formatOrderSide(order.side)} ${order.quantity.toLocaleString()}주`,
    '예약 골드/주식은 지갑과 보유량으로 되돌렸습니다.'
  ].join('\n');
}

function formatAlertCreated(user, alert) {
  return [
    `🔔 **가격 알림 등록** — ${user}`,
    `알림: \`${alert.id}\` / 종목: **${alert.stock.name}**`,
    `조건: 현재가가 **${alert.targetPrice.toLocaleString()}골드** ${formatAlertCondition(alert.condition)}이면 트리거`,
    '`/주식 알림`으로 활성/트리거 알림을 확인할 수 있습니다.'
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
    `🔕 **가격 알림 삭제** — ${user}`,
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

function formatStockNews(news) {
  const body = news.entries.length > 0
    ? news.entries.map((entry) => `- tick #${entry.tickIndex} **${entry.stock.name}** ${formatNewsType(entry.type)}: ${entry.message}`)
      .join('\n')
    : '최근 시장 뉴스/공시가 없습니다.';

  return [
    `🗞️ **주식 뉴스/공시** — tick #${news.tickIndex}`,
    body
  ].join('\n');
}

function formatStockChart(chart) {
  const body = chart.history.length > 0
    ? chart.history
      .map((point) => `- tick #${point.tickIndex}: ${point.price.toLocaleString()}골드`)
      .join('\n')
    : '표시할 가격 기록이 없습니다.';

  return [
    `📉 **${chart.stock.name} 가격 차트**`,
    body
  ].join('\n');
}

function formatPortfolio(user, portfolio) {
  const positions = portfolio.positions.length > 0
    ? portfolio.positions
      .slice(0, 10)
      .map((position) => `- ${position.stock.name} ${position.quantity.toLocaleString()}주 / 평가 ${position.marketValue.toLocaleString()}골드 / 손익 ${formatSignedMoney(position.unrealizedProfit)}`)
      .join('\n')
    : '보유 주식이 없습니다.';

  return [
    `💼 **${user.username}님의 가상주식 보유 현황**`,
    `골드: **${portfolio.cash.toLocaleString()}골드**`,
    `주식 평가액: **${portfolio.stockValue.toLocaleString()}골드**`,
    `레버리지 평가금: **${portfolio.leveragedEquity.toLocaleString()}골드**`,
    `총자산: **${portfolio.totalAssets.toLocaleString()}골드**`,
    `평가손익: **${formatSignedMoney(portfolio.unrealizedProfit)}** / 레버리지 손익: **${formatSignedMoney(portfolio.leveragedUnrealizedProfit)}**`,
    `실현손익: **${formatSignedMoney(portfolio.realizedProfit)}** / 레버리지 실현손익: **${formatSignedMoney(portfolio.realizedLeveragedProfit)}**`,
    positions
  ].join('\n');
}

function formatLeaderboard(rows) {
  if (rows.length === 0) return '아직 가상주식 랭킹 데이터가 없습니다.';

  const body = rows
    .map((row, index) => `${index + 1}. **${row.username}** — 총자산 ${row.totalAssets.toLocaleString()}골드 / 골드 ${row.cash.toLocaleString()}골드 / 주식 ${row.stockValue.toLocaleString()}골드 / 레버리지 ${row.leveragedEquity.toLocaleString()}골드`)
    .join('\n');
  return `🏆 **가상주식 총자산 랭킹**\n${body}`;
}

function formatOpenLeverageResult(user, result) {
  const position = result.position;
  const sideLabel = formatLeverageSide(position.side);
  return [
    `⚡ **레버리지 ${sideLabel} 진입 완료** — ${user}`,
    `포지션: \`${position.id}\` / 종목: **${position.stock.name}** / 배율: **${position.leverage}배**`,
    `진입가: ${position.entryPrice.toLocaleString()}골드 / 증거금: ${position.margin.toLocaleString()}골드 / 수수료: ${result.fee.toLocaleString()}골드`,
    `골드: **${result.profile.balance.toLocaleString()}골드**`,
    '손실이 증거금 100%에 도달하면 자동 청산됩니다.'
  ].join('\n');
}

function formatCloseLeverageResult(user, result) {
  const position = result.position;
  if (result.liquidated) {
    return [
      `💥 **레버리지 포지션 자동 청산** — ${user}`,
      `포지션: \`${position.id}\` / 종목: **${position.stock.name}** / ${formatLeverageSide(position.side)} ${position.leverage}배`,
      `손익: **${formatSignedMoney(result.realizedProfit)}** / 지급액: 0골드`,
      `골드: **${result.profile.balance.toLocaleString()}골드**`
    ].join('\n');
  }

  return [
    `✅ **레버리지 포지션 청산 완료** — ${user}`,
    `포지션: \`${position.id}\` / 종목: **${position.stock.name}** / ${formatLeverageSide(position.side)} ${position.leverage}배`,
    `진입가: ${position.entryPrice.toLocaleString()}골드 → 청산가: ${position.currentPrice.toLocaleString()}골드`,
    `손익: **${formatSignedMoney(result.realizedProfit)}** / 지급액: **${result.payout.toLocaleString()}골드**`,
    `골드: **${result.profile.balance.toLocaleString()}골드**`
  ].join('\n');
}

function formatLeveragePortfolio(user, portfolio) {
  const liquidatedText = portfolio.liquidated.length > 0
    ? `\n💥 이번 조회에서 자동 청산: ${portfolio.liquidated.map((entry) => `\`${entry.positionId}\``).join(', ')}`
    : '';
  const positions = portfolio.positions.length > 0
    ? portfolio.positions
      .slice(0, 10)
      .map((position) => [
        `- \`${position.id}\` **${position.stock.name}** ${formatLeverageSide(position.side)} ${position.leverage}배`,
        `  진입 ${position.entryPrice.toLocaleString()}골드 → 현재 ${position.currentPrice.toLocaleString()}골드 / 증거금 ${position.margin.toLocaleString()}골드 / 평가 ${position.equity.toLocaleString()}골드 / 손익 ${formatSignedMoney(position.unrealizedProfit)}`
      ].join('\n'))
      .join('\n')
    : '열려 있는 레버리지 포지션이 없습니다.';

  return [
    `⚡ **${user.username}님의 레버리지 보유 현황**`,
    `골드: **${portfolio.cash.toLocaleString()}골드**`,
    `증거금 합계: **${portfolio.marginTotal.toLocaleString()}골드** / 평가금: **${portfolio.equityTotal.toLocaleString()}골드**`,
    `미실현손익: **${formatSignedMoney(portfolio.unrealizedProfit)}** / 누적실현손익: **${formatSignedMoney(portfolio.realizedLeveragedProfit)}**`,
    positions + liquidatedText
  ].join('\n');
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
    leverage_open: '레버리지 진입',
    leverage_close: '레버리지 청산',
    leverage_liquidation: '레버리지 자동청산'
  }[type] ?? type;
}

function formatNewsType(type) {
  return {
    ipo: '신규상장',
    surge: '급등',
    crash: '급락',
    delisted: '상장폐지'
  }[type] ?? '뉴스';
}

function formatStockStatus(stock) {
  if (stock.status === 'delisted') return '상장폐지';
  if (stock.eventType === 'ipo') return '신규상장';
  if (stock.eventType === 'surge') return '급등 이벤트';
  if (stock.eventType === 'crash') return '급락 이벤트';
  return '정상 거래';
}

function formatRisk(risk) {
  return {
    stable: '안정주',
    growth: '성장주',
    cyclical: '경기민감주',
    volatile: '급등락주',
    meme: '밈주식'
  }[risk] ?? risk;
}

async function safeReply(interaction, content, ephemeral = false) {
  const payload = { content, ephemeral };
  if (interaction.deferred || interaction.replied) {
    await interaction.followUp(payload);
  } else {
    await interaction.reply(payload);
  }
}
