import { MessageFlags, Client, Events, GatewayIntentBits, Partials } from 'discord.js';
import { handleCasinoCommand } from './commands/casino.js';
import {
  handleChoseongCommand,
  handleChoseongMessage
} from './commands/choseong.js';
import { handleChoiceCommand } from './commands/choice.js';
import { handleCompatibilityCommand } from './commands/compatibility.js';
import {
  formatLotteryDraw,
  handleCommunityAutocomplete,
  handleCommunityCommand
} from './commands/community.js';
import {
  handleAccountLinkComponent,
  handleEconomyCommand,
  replyWithAccountLinkSelectionIfNeeded
} from './commands/economy.js';
import { handleFishingCommand } from './commands/fishing.js';
import { handleFortuneCommand } from './commands/fortune.js';
import {
  formatMealMessage,
  handleMealCommand
} from './commands/meals.js';
import { handleHelpCommand } from './commands/help.js';
import {
  handleLiarGameCommand,
  handleLiarGameMessage
} from './commands/liar-game.js';
import {
  handleModerationCommand,
  inspectMessageForModeration
} from './commands/moderation.js';
import { handleNumberBaseballCommand } from './commands/number-baseball.js';
import { handlePollCommand, PollManager } from './commands/poll.js';
import { handleRpgCommand } from './commands/rpg.js';
import {
  formatSeasonAwardLine,
  handleSeasonCommand
} from './commands/seasons.js';
import { handleStartCommand } from './commands/start.js';
import { handleSwordCommand } from './commands/sword.js';
import {
  handleTamagotchiAutocomplete,
  handleTamagotchiCommand
} from './commands/tamagotchi.js';
import {
  handleStockAutocomplete,
  handleStockCommand
} from './commands/stocks.js';
import {
  guardInteractionResponse,
  isUnknownInteractionError,
  isUserFacingInteractionError,
  logUnexpectedInteractionError,
  safeAutocompleteRespond,
  safeReplyToInteraction
} from './commands/interactions.js';
import { handleTimetableCommand } from './commands/timetable.js';
import { handleTodayCommand } from './commands/today.js';
import { handleUnoCommand } from './commands/uno.js';
import {
  handleWordChainCommand,
  handleWordChainMessage
} from './commands/wordchain.js';
import { handleWordleCommand } from './commands/wordle.js';
import { ModerationService } from './systems/moderation.js';
import { NumberBaseballService } from './systems/number-baseball.js';
import { createSqliteStore } from './storage/sqlite-store.js';
import { isAccountSelectionRequiredError } from './systems/accounts.js';
import {
  CommunityService,
  scheduleLotteryDrawAnnouncements
} from './systems/community.js';
import { EconomyService } from './systems/economy.js';
import { FishingService } from './systems/fishing.js';
import { FortuneService } from './systems/fortune.js';
import {
  MealService,
  scheduleDailyMealAnnouncements
} from './systems/meals.js';
import {
  StockService,
  scheduleStockAlertAnnouncements
} from './systems/stocks.js';
import { SeasonService, SEASON_POINT_SOURCES } from './systems/seasons.js';
import { TamagotchiService } from './systems/tamagotchi.js';
import { TimetableService } from './systems/timetable.js';
import { UnoGameManager } from './systems/uno.js';
import { WordleService } from './systems/wordle.js';

export function createBot({
  databasePath = 'data/profiles.sqlite',
  legacyJsonPath = 'data/profiles.json',
  neisApiKey = null,
  logger = console
}) {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMessageReactions
    ],
    partials: [
      Partials.Message,
      Partials.Channel,
      Partials.Reaction,
      Partials.User
    ]
  });

  const store = createSqliteStore(databasePath, {
    migrateFromJsonPath: legacyJsonPath
  });
  const community = new CommunityService(store);
  const economy = new EconomyService(store);
  const fishing = new FishingService(store, { economy });
  const fortune = new FortuneService();
  const meals = new MealService({ store, apiKey: neisApiKey });
  const stocks = new StockService(store);
  const seasons = new SeasonService(store);
  const tamagotchi = new TamagotchiService(store);
  const timetable = new TimetableService();
  const moderation = new ModerationService(store);
  const wordle = new WordleService(store);
  const numberBaseball = new NumberBaseballService(store);
  const polls = new PollManager({ logger });
  const uno = new UnoGameManager();
  let stopMealAnnouncementScheduler = () => {};
  let stopStockAlertScheduler = () => {};
  let stopLotteryDrawScheduler = () => {};

  client.once(Events.ClientReady, (readyClient) => {
    logger.log(`Logged in as ${readyClient.user.tag}`);

    stopMealAnnouncementScheduler = scheduleDailyMealAnnouncements({
      logger,
      async sendAnnouncement() {
        await sendDailyMealAnnouncements(readyClient, meals, logger);
      }
    });

    stopStockAlertScheduler = scheduleStockAlertAnnouncements({
      logger,
      async sendAnnouncements() {
        await sendStockAlertAnnouncements(readyClient, stocks, logger);
      }
    });

    stopLotteryDrawScheduler = scheduleLotteryDrawAnnouncements({
      logger,
      async sendAnnouncements() {
        await sendLotteryDrawAnnouncements(readyClient, community, logger);
      }
    });
  });

  client.on(Events.Error, (error) => {
    logger.error('Discord client error:', error);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isAutocomplete?.()) {
      try {
        const handled = await handleTamagotchiAutocomplete(interaction)
          || await handleCommunityAutocomplete(interaction, community)
          || await handleStockAutocomplete(interaction, stocks);
        if (!handled) await safeAutocompleteRespond(interaction, []);
      } catch (error) {
        if (!isUnknownInteractionError(error)) {
          logger.error('Failed to handle autocomplete interaction:', error);
          await safeAutocompleteRespond(interaction, []).catch((fallbackError) => {
            if (!isUnknownInteractionError(fallbackError)) {
              logger.error('Failed to send empty autocomplete fallback:', fallbackError);
            }
          });
        }
      }
      return;
    }

    if (!isSupportedCommandInteraction(interaction)) return;

    let responseGuard = { stop() {} };
    try {
      const checkedAccountSelectionBeforeDefer = interaction.isChatInputCommand?.();
      const preDeferAccountSelection = await replyWithAccountLinkSelectionIfNeeded(interaction, economy);
      if (preDeferAccountSelection) return;

      responseGuard = guardInteractionResponse(interaction, { logger });
      if (shouldDeferBeforeCommandHandling(interaction)) {
        const deferred = await responseGuard.deferNow();
        if (!deferred) return;
      }

      const handledAccountLinkComponent = await handleAccountLinkComponent(interaction, economy);
      if (handledAccountLinkComponent) return;

      if (!checkedAccountSelectionBeforeDefer) {
        const needsAccountSelection = await replyWithAccountLinkSelectionIfNeeded(interaction, economy);
        if (needsAccountSelection) return;
      }

      const handledCasino = await handleCasinoCommand(interaction, economy, logger);
      if (handledCasino) {
        if (interaction.isChatInputCommand()
          && !['카지노정보'].includes(interaction.commandName)) {
          await community.recordActivity({
            guildId: interaction.guildId,
            userId: interaction.user.id,
            username: interaction.user.username,
            activity: 'casino'
          }).catch((error) => logger.error('Failed to record casino activity:', error));
        }
        await recordCommandActivity(interaction, economy, community, logger);
        await sendAutomaticAchievementNotice(interaction, community, logger, seasons);
        return;
      }

      const handled = await handleCommunityCommand(interaction, community, logger, { seasons, logger })
        || await handleChoiceCommand(interaction)
        || await handleCompatibilityCommand(interaction)
        || await handleHelpCommand(interaction)
        || await handlePollCommand(interaction, polls, logger)
        || await handleUnoCommand(interaction, uno, logger)
        || await handleModerationCommand(interaction, moderation, logger)
        || await handleWordChainCommand(interaction, economy, logger)
        || await handleChoseongCommand(interaction, economy, logger)
        || await handleLiarGameCommand(interaction, economy, logger)
        || await handleWordleCommand(interaction, wordle, economy)
        || await handleNumberBaseballCommand(interaction, numberBaseball, economy)
        || await handleFortuneCommand(interaction, fortune, economy)
        || await handleStartCommand(interaction, { economy, community, fishing, stocks, seasons, logger })
        || await handleTodayCommand(interaction, { economy, community, seasons, logger })
        || await handleMealCommand(interaction, meals)
        || await handleTimetableCommand(interaction, timetable)
        || await handleSeasonCommand(interaction, seasons, logger)
        || await handleStockCommand(interaction, stocks, { seasons, logger })
        || await handleTamagotchiCommand(interaction, tamagotchi, logger)
        || await handleFishingCommand(interaction, fishing, { seasons, logger })
        || await handleSwordCommand(interaction, economy, logger, { seasons })
        || await handleRpgCommand(interaction, economy, { seasons })
        || await handleEconomyCommand(interaction, economy, { stocks });

      if (!handled) {
        await safeReplyToInteraction(interaction, '알 수 없는 명령어입니다.', {
          flags: MessageFlags.Ephemeral
        });
      } else {
        await recordCommandActivity(interaction, economy, community, logger);
        await sendAutomaticAchievementNotice(interaction, community, logger, seasons);
      }
    } catch (error) {
      if (isUnknownInteractionError(error)) {
        logger.warn?.('Interaction expired before command response could be sent.');
        return;
      }

      logUnexpectedInteractionError(logger, error, 'Command handling failed');

      const content = isAccountSelectionRequiredError(error)
        ? '계정이 여러 서버에 있습니다. `/계정연동`으로 사용할 계정 1개를 먼저 선택해주세요.'
        : isUserFacingInteractionError(error)
        ? `처리 실패: ${error.message}`
        : '명령어 처리 중 오류가 발생했습니다.';
      try {
        const sent = await safeReplyToInteraction(interaction, content, {
          flags: MessageFlags.Ephemeral
        });
        if (!sent) {
          logger.warn?.('Interaction expired before error response could be sent.');
        }
      } catch (replyError) {
        logger.error('Failed to send command error response:', replyError);
      }
    } finally {
      responseGuard.stop();
    }
  });

  client.on(Events.MessageCreate, async (message) => {
    if (!message.inGuild() || message.author.bot) return;

    try {
      const moderationResult = await inspectMessageForModeration(message, moderation, logger);
      if (moderationResult.blocked) return;

      const accountSummary = await economy.getAccountLinkSummary({
        guildId: message.guild.id,
        userId: message.author.id,
        username: message.author.username
      });
      if (accountSummary.required) return;

      const handledWordChain = await handleWordChainMessage(message, economy, logger);
      const handledLiarGame = handledWordChain
        ? false
        : await handleLiarGameMessage(message, economy, logger);
      const handledChoseong = handledWordChain || handledLiarGame
        ? false
        : await handleChoseongMessage(message, economy, logger);
      await rewardChatActivity(message, economy, community, logger);
      if (handledWordChain || handledLiarGame || handledChoseong) return;
    } catch (error) {
      logger.error('Failed to reward message activity:', error);
    }
  });

  client.on(Events.MessageReactionAdd, async (reaction, user) => {
    try {
      await polls.handleReactionAdd(reaction, user);
    } catch (error) {
      logger.error('Failed to handle poll reaction add:', error);
    }
  });

  client.on(Events.MessageReactionRemove, async (reaction, user) => {
    try {
      await polls.handleReactionRemove(reaction, user);
    } catch (error) {
      logger.error('Failed to handle poll reaction remove:', error);
    }
  });

  return {
    client,
    economy,
    fishing,
    fortune,
    meals,
    stocks,
    seasons,
    tamagotchi,
    timetable,
    moderation,
    wordle,
    numberBaseball,
    polls,
    uno,
    stopMealAnnouncements() {
      stopMealAnnouncementScheduler();
    },
    stopStockAlerts() {
      stopStockAlertScheduler();
    },
    stopLotteryDraws() {
      stopLotteryDrawScheduler();
    },
    async start(token) {
      await client.login(token);
    }
  };
}

export function isSupportedCommandInteraction(interaction) {
  return Boolean(
    interaction?.isChatInputCommand?.()
    || interaction?.isButton?.()
    || interaction?.isModalSubmit?.()
    || interaction?.isStringSelectMenu?.()
  );
}

export function shouldDeferBeforeCommandHandling(interaction) {
  if (interaction?.isChatInputCommand?.() || interaction?.isModalSubmit?.()) {
    if (interaction?.isChatInputCommand?.() && interaction.commandName === '계정연동') {
      return false;
    }
    return true;
  }

  if (interaction?.isButton?.() || interaction?.isStringSelectMenu?.()) {
    return !shouldKeepInitialComponentResponseOpen(interaction);
  }

  return false;
}

function shouldKeepInitialComponentResponseOpen(interaction) {
  const customId = interaction?.customId ?? '';

  return customId.startsWith('liar_guess:');
}

async function recordCommandActivity(interaction, economy, community, logger) {
  if (!interaction.isChatInputCommand?.() || !interaction.inGuild?.()) return null;
  if (interaction.commandName === '계정연동') return null;

  try {
    const result = await economy.rewardCommand({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      username: interaction.user.username,
      commandName: interaction.commandName
    });

    await community.recordActivity({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      username: interaction.user.username,
      activity: 'command',
      commandName: interaction.commandName,
      xpGained: result.totalXpGained
    });

    if (result.leveledUp && typeof interaction.followUp === 'function') {
      await interaction.followUp({
        content: `🎉 명령어 활동으로 레벨업! Lv.${result.profile.level} 달성, 보너스 ${result.levelReward.toLocaleString()}골드 지급!`,
        flags: MessageFlags.Ephemeral
      }).catch((error) => logger.debug?.('Failed to send command level-up notice:', error));
    }

    return result;
  } catch (error) {
    logger.error('Failed to reward command activity:', error);
    return null;
  }
}

export async function sendAutomaticAchievementNotice(interaction, community, logger = console, seasons = null) {
  if (!isAutomaticAchievementEligibleInteraction(interaction)) return false;
  if (typeof community?.grantCompletedAchievements !== 'function') return false;

  let result = null;
  try {
    result = await community.grantCompletedAchievements({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      username: interaction.user.username,
      limit: 3
    });
  } catch (error) {
    logger.debug?.('Failed to grant automatic achievement rewards:', error);
    return false;
  }

  if (!result?.totalClaimed || !Array.isArray(result.displayed) || result.displayed.length <= 0) {
    return false;
  }

  let seasonAward = null;
  if (typeof seasons?.awardPoints === 'function') {
    try {
      seasonAward = await seasons.awardPoints({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        username: interaction.user.username,
        source: SEASON_POINT_SOURCES.ACHIEVEMENT_EARN,
        points: Math.min(30, result.totalClaimed * 10)
      });
    } catch (error) {
      logger.debug?.('Failed to award achievement season points:', error);
    }
  }

  const achievementText = result.displayed
    .map((achievement) => `**${achievement.title}**`)
    .join(', ');
  const hiddenCount = Math.max(0, result.hiddenCount ?? result.totalClaimed - result.displayed.length);
  const moreText = hiddenCount > 0 ? ` 외 ${hiddenCount.toLocaleString()}개` : '';
  const rewards = [];
  if (result.totalCoins > 0) rewards.push(`${result.totalCoins.toLocaleString()}골드`);
  if (result.totalXp > 0) rewards.push(`${result.totalXp.toLocaleString()} XP`);
  const rewardText = rewards.length > 0 ? rewards.join(', ') : '보상 없음';

  return safeReplyToInteraction(interaction, [
    `🏆 업적 자동 수령: ${achievementText}${moreText}`,
    `보상: ${rewardText}`,
    formatSeasonAwardLine(seasonAward)
  ].filter(Boolean).join('\n'), {
    flags: MessageFlags.Ephemeral
  });
}

function isAutomaticAchievementEligibleInteraction(interaction) {
  if (!interaction.inGuild?.()) return false;

  if (interaction.isChatInputCommand?.()) {
    return interaction.commandName !== '업적';
  }

  if (!interaction.isButton?.()) return false;

  const customId = interaction.customId ?? '';
  return isEligibleMutatingButton(customId, interaction.user?.id);
}

function isEligibleMutatingButton(customId, userId) {
  const parts = customId.split(':');

  if (parts[0] === 'fishing_quick') {
    return parts[1] === 'fish' && (!parts[2] || parts[2] === userId);
  }

  if (parts[0] === 'today_checkin' || parts[0] === 'today_missions') {
    return !parts[1] || parts[1] === userId;
  }

  if (parts[0] === 'rpg_quick') {
    return parts[1] === userId && ['battle', 'explore', 'dungeon', 'raid', 'guild_raid', 'rest'].includes(parts[2]);
  }

  if (['rpg_daily', 'rpg_quest', 'rpg_skill'].includes(parts[0])) {
    return parts[1] === userId;
  }

  if (parts[0] === 'sword_quick') {
    return ['enhance', 'advanced'].includes(parts[1]) && parts[2] === userId;
  }

  if (parts[0] === 'sword_sell_confirm') {
    return parts[1] === userId;
  }

  if (parts[0] === 'casino_quick') {
    return ['slots', 'odd_even', 'dice'].includes(parts[1]) && (!parts[4] || parts[4] === userId);
  }

  return false;
}

async function rewardChatActivity(message, economy, community, logger) {
  const result = await economy.rewardMessage({
    guildId: message.guild.id,
    userId: message.author.id,
    username: message.author.username
  });
  const eventBonus = result.awarded
    ? await community.awardChatEventBonus({
        guildId: message.guild.id,
        userId: message.author.id,
        username: message.author.username,
        baseXp: result.totalXpGained
      })
    : null;

  if (result.awarded) {
    await community.recordActivity({
      guildId: message.guild.id,
      userId: message.author.id,
      username: message.author.username,
      activity: 'chat',
      xpGained: result.totalXpGained + (eventBonus?.bonusXp ?? 0)
    });
  }

  if (result.leveledUp) {
    await message.channel.send(
      `🎉 ${message.author}님 레벨업! Lv.${result.profile.level} 달성, 보너스 ${result.levelReward.toLocaleString()}골드 지급!`
    );
  }
  if (eventBonus?.leveledUp) {
    await message.channel.send(
      `📣 서버 이벤트 보너스로 ${message.author}님 레벨업! Lv.${eventBonus.profile.level} 달성, 보너스 ${eventBonus.levelReward.toLocaleString()}골드 지급!`
    );
  }

  return {
    result,
    eventBonus
  };
}

async function sendStockAlertAnnouncements(client, stocks, logger) {
  const guilds = [...(client.guilds?.cache?.values?.() ?? [])];
  const guildIds = guilds.map((guild) => guild.id);
  let batchedAlerts = null;
  const deliveredAlerts = [];

  if (typeof stocks.getPendingTriggeredPriceAlertsByGuild === 'function') {
    try {
      batchedAlerts = await stocks.getPendingTriggeredPriceAlertsByGuild({ guildIds });
    } catch (error) {
      logger.error('Failed to collect batched stock alerts:', error);
      batchedAlerts = null;
    }
  }

  for (const guild of guilds) {
    let alerts = [];
    try {
      alerts = batchedAlerts
        ? batchedAlerts[guild.id] ?? []
        : await stocks.getPendingTriggeredPriceAlerts({
            guildId: guild.id
          });
    } catch (error) {
      logger.error(`Failed to collect stock alerts for guild ${guild.id}:`, error);
      continue;
    }

    for (const alert of alerts) {
      try {
        const channel = await client.channels.fetch(alert.channelId);

        if (!channel || typeof channel.send !== 'function') {
          throw new Error(`채널을 찾을 수 없습니다: ${alert.channelId}`);
        }

        await channel.send(formatStockAlertAnnouncement(alert));
        deliveredAlerts.push({
          guildId: guild.id,
          userId: alert.userId,
          alertId: alert.id
        });
      } catch (error) {
        logger.error(`Failed to send stock alert ${alert.id} in guild ${guild.id}:`, error);
      }
    }
  }

  await markDeliveredStockAlerts(stocks, deliveredAlerts, logger);
}

async function markDeliveredStockAlerts(stocks, deliveredAlerts, logger) {
  if (deliveredAlerts.length === 0) return;

  if (typeof stocks.markPriceAlertsNotifiedBatch === 'function') {
    try {
      await stocks.markPriceAlertsNotifiedBatch({ alerts: deliveredAlerts });
      return;
    } catch (error) {
      logger.error('Failed to batch mark stock alerts as notified:', error);
    }
  }

  for (const alert of deliveredAlerts) {
    try {
      await stocks.markPriceAlertNotified(alert);
    } catch (error) {
      logger.error(`Failed to mark stock alert ${alert.alertId} as notified:`, error);
    }
  }
}

function formatStockAlertAnnouncement(alert) {
  const conditionLabel = alert.condition === 'above' ? '이상' : '이하';
  return [
    '🔔 **주식 가격 알림 도착**',
    `<@${alert.userId}>님, **${alert.stock.name}**이(가) 목표가에 도달했습니다.`,
    `현재가: **${alert.triggeredPrice.toLocaleString()}골드** / 목표: ${alert.targetPrice.toLocaleString()}골드 ${conditionLabel}`,
    '`/주식 알림`에서 최근 트리거 기록을 확인할 수 있습니다.'
  ].join('\n');
}

async function sendLotteryDrawAnnouncements(client, community, logger) {
  const results = await community.drawDueLotteries();

  for (const result of results) {
    try {
      const channel = await resolveLotteryAnnouncementChannel(client, result);

      if (!channel || typeof channel.send !== 'function') {
        throw new Error(`복권 자동 추첨 알림 채널을 찾을 수 없습니다: ${result.guildId}`);
      }

      await channel.send(formatLotteryDraw(result));
    } catch (error) {
      logger.error(`Failed to send lottery draw announcement for guild ${result.guildId}:`, error);
    }
  }
}

async function resolveLotteryAnnouncementChannel(client, result) {
  if (result.channelId) {
    const configuredChannel = await client.channels.fetch(result.channelId).catch(() => null);
    if (configuredChannel && typeof configuredChannel.send === 'function') {
      return configuredChannel;
    }
  }

  const guild = client.guilds?.cache?.get?.(result.guildId) ?? null;
  if (guild?.systemChannel && typeof guild.systemChannel.send === 'function') {
    return guild.systemChannel;
  }

  if (guild?.systemChannelId) {
    const systemChannel = await client.channels.fetch(guild.systemChannelId).catch(() => null);
    if (systemChannel && typeof systemChannel.send === 'function') {
      return systemChannel;
    }
  }

  return [...(guild?.channels?.cache?.values?.() ?? [])]
    .find((channel) => typeof channel.send === 'function') ?? null;
}

async function sendDailyMealAnnouncements(client, meals, logger) {
  const targets = await meals.listAutoAnnouncementTargets();

  if (targets.length === 0) {
    return;
  }

  const message = formatMealMessage(await meals.getTodayMeals());

  for (const target of targets) {
    try {
      const channel = await client.channels.fetch(target.channelId);

      if (!channel || typeof channel.send !== 'function') {
        throw new Error(`채널을 찾을 수 없습니다: ${target.channelId}`);
      }

      await channel.send(message);
    } catch (error) {
      logger.error(`Failed to send daily meal announcement for guild ${target.guildId}:`, error);
    }
  }
}
