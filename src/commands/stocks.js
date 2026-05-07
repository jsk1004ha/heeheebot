import { SlashCommandBuilder } from 'discord.js';

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
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('전체시세')
        .setDescription('36개 가상주식 전체 시세를 봅니다.')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('매수')
        .setDescription('보유금으로 가상주식을 매수합니다.')
        .addStringOption((option) =>
          option
            .setName('종목')
            .setDescription('매수할 종목명 또는 id. 예: 희진전자')
            .setMaxLength(50)
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
        .setDescription('현금+주식 평가액 기준 가상주식 랭킹을 봅니다.')
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
            .setDescription('포지션에 넣을 보유금')
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
  }
}

function formatMarketSummary(market) {
  const body = market.stocks.map(formatMarketLine).join('\n');
  return [
    `📈 **디코밈 가상주식 시세 TOP ${market.stocks.length}** — tick #${market.tickIndex}`,
    body,
    '',
    '`/주식 전체시세`로 36개 전체를 볼 수 있고, `/주식 시세 종목:원숭이닉스`처럼 개별 조회도 됩니다.'
  ].join('\n');
}

function formatFullMarket(market) {
  const body = market.stocks.map(formatMarketLine).join('\n');
  return `📊 **디코밈 가상주식 전체 시세 36종목** — tick #${market.tickIndex}\n${body}`;
}

function formatQuote(quote) {
  return [
    `📌 **${quote.name}** (${quote.sector} / ${formatRisk(quote.risk)})`,
    `현재가: **${quote.price.toLocaleString()}원** (${formatSignedPercent(quote.changePercent)})`,
    `이전가: ${quote.previousPrice.toLocaleString()}원`,
    `뉴스: ${quote.news}`
  ].join('\n');
}

function formatBuyResult(user, result) {
  return [
    `🛒 **가상주식 매수 완료** — ${user}`,
    `종목: **${result.stock.name}** × ${result.quantity.toLocaleString()}주`,
    `단가: ${result.price.toLocaleString()}원 / 매수금액: ${result.subtotal.toLocaleString()}원 / 수수료: ${result.fee.toLocaleString()}원`,
    `잔액: **${result.profile.balance.toLocaleString()}원** / 보유: ${result.holding.quantity.toLocaleString()}주 / 평단: ${result.holding.averageCost.toLocaleString()}원`
  ].join('\n');
}

function formatSellResult(user, result) {
  return [
    `💸 **가상주식 매도 완료** — ${user}`,
    `종목: **${result.stock.name}** × ${result.quantity.toLocaleString()}주`,
    `단가: ${result.price.toLocaleString()}원 / 매도금액: ${result.subtotal.toLocaleString()}원 / 수수료: ${result.fee.toLocaleString()}원`,
    `실현손익: **${formatSignedMoney(result.realizedProfit)}** / 잔액: **${result.profile.balance.toLocaleString()}원** / 남은 보유: ${result.holding.quantity.toLocaleString()}주`
  ].join('\n');
}

function formatPortfolio(user, portfolio) {
  const positions = portfolio.positions.length > 0
    ? portfolio.positions
      .slice(0, 10)
      .map((position) => `- ${position.stock.name} ${position.quantity.toLocaleString()}주 / 평가 ${position.marketValue.toLocaleString()}원 / 손익 ${formatSignedMoney(position.unrealizedProfit)}`)
      .join('\n')
    : '보유 주식이 없습니다.';

  return [
    `💼 **${user.username}님의 가상주식 보유 현황**`,
    `현금: **${portfolio.cash.toLocaleString()}원**`,
    `주식 평가액: **${portfolio.stockValue.toLocaleString()}원**`,
    `레버리지 평가금: **${portfolio.leveragedEquity.toLocaleString()}원**`,
    `총자산: **${portfolio.totalAssets.toLocaleString()}원**`,
    `평가손익: **${formatSignedMoney(portfolio.unrealizedProfit)}** / 레버리지 손익: **${formatSignedMoney(portfolio.leveragedUnrealizedProfit)}**`,
    `실현손익: **${formatSignedMoney(portfolio.realizedProfit)}** / 레버리지 실현손익: **${formatSignedMoney(portfolio.realizedLeveragedProfit)}**`,
    positions
  ].join('\n');
}

function formatLeaderboard(rows) {
  if (rows.length === 0) return '아직 가상주식 랭킹 데이터가 없습니다.';

  const body = rows
    .map((row, index) => `${index + 1}. **${row.username}** — 총자산 ${row.totalAssets.toLocaleString()}원 / 현금 ${row.cash.toLocaleString()}원 / 주식 ${row.stockValue.toLocaleString()}원 / 레버리지 ${row.leveragedEquity.toLocaleString()}원`)
    .join('\n');
  return `🏆 **가상주식 총자산 랭킹**\n${body}`;
}

function formatOpenLeverageResult(user, result) {
  const position = result.position;
  const sideLabel = formatLeverageSide(position.side);
  return [
    `⚡ **레버리지 ${sideLabel} 진입 완료** — ${user}`,
    `포지션: \`${position.id}\` / 종목: **${position.stock.name}** / 배율: **${position.leverage}배**`,
    `진입가: ${position.entryPrice.toLocaleString()}원 / 증거금: ${position.margin.toLocaleString()}원 / 수수료: ${result.fee.toLocaleString()}원`,
    `잔액: **${result.profile.balance.toLocaleString()}원**`,
    '손실이 증거금 100%에 도달하면 자동 청산됩니다.'
  ].join('\n');
}

function formatCloseLeverageResult(user, result) {
  const position = result.position;
  if (result.liquidated) {
    return [
      `💥 **레버리지 포지션 자동 청산** — ${user}`,
      `포지션: \`${position.id}\` / 종목: **${position.stock.name}** / ${formatLeverageSide(position.side)} ${position.leverage}배`,
      `손익: **${formatSignedMoney(result.realizedProfit)}** / 지급액: 0원`,
      `잔액: **${result.profile.balance.toLocaleString()}원**`
    ].join('\n');
  }

  return [
    `✅ **레버리지 포지션 청산 완료** — ${user}`,
    `포지션: \`${position.id}\` / 종목: **${position.stock.name}** / ${formatLeverageSide(position.side)} ${position.leverage}배`,
    `진입가: ${position.entryPrice.toLocaleString()}원 → 청산가: ${position.currentPrice.toLocaleString()}원`,
    `손익: **${formatSignedMoney(result.realizedProfit)}** / 지급액: **${result.payout.toLocaleString()}원**`,
    `잔액: **${result.profile.balance.toLocaleString()}원**`
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
        `  진입 ${position.entryPrice.toLocaleString()}원 → 현재 ${position.currentPrice.toLocaleString()}원 / 증거금 ${position.margin.toLocaleString()}원 / 평가 ${position.equity.toLocaleString()}원 / 손익 ${formatSignedMoney(position.unrealizedProfit)}`
      ].join('\n'))
      .join('\n')
    : '열려 있는 레버리지 포지션이 없습니다.';

  return [
    `⚡ **${user.username}님의 레버리지 보유 현황**`,
    `현금: **${portfolio.cash.toLocaleString()}원**`,
    `증거금 합계: **${portfolio.marginTotal.toLocaleString()}원** / 평가금: **${portfolio.equityTotal.toLocaleString()}원**`,
    `미실현손익: **${formatSignedMoney(portfolio.unrealizedProfit)}** / 누적실현손익: **${formatSignedMoney(portfolio.realizedLeveragedProfit)}**`,
    positions + liquidatedText
  ].join('\n');
}

function formatMarketLine(stock) {
  return `- **${stock.name}** \`${stock.symbol}\` ${stock.price.toLocaleString()}원 (${formatSignedPercent(stock.changePercent)})`;
}

function formatSignedPercent(percent) {
  const sign = percent > 0 ? '+' : '';
  return `${sign}${percent.toLocaleString()}%`;
}

function formatSignedMoney(amount) {
  const sign = amount > 0 ? '+' : '';
  return `${sign}${amount.toLocaleString()}원`;
}

function formatLeverageSide(side) {
  return side === 'short' ? '숏' : '롱';
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
