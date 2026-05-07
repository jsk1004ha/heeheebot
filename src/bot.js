import { Client, Events, GatewayIntentBits } from 'discord.js';
import { handleCasinoCommand } from './commands/casino.js';
import { handleCommunityCommand } from './commands/community.js';
import { handleEconomyCommand } from './commands/economy.js';
import { handleFishingCommand } from './commands/fishing.js';
import { handleFortuneCommand } from './commands/fortune.js';
import {
  formatMealMessage,
  handleMealCommand
} from './commands/meals.js';
import {
  handleModerationCommand,
  inspectMessageForModeration
} from './commands/moderation.js';
import { handleRpgCommand } from './commands/rpg.js';
import { handleSwordCommand } from './commands/sword.js';
import {
  handleStockAutocomplete,
  handleStockCommand
} from './commands/stocks.js';
import { handleTimetableCommand } from './commands/timetable.js';
import {
  handleWordChainCommand,
  handleWordChainMessage
} from './commands/wordchain.js';
import { ModerationService } from './systems/moderation.js';
import { createSqliteStore } from './storage/sqlite-store.js';
import { CommunityService } from './systems/community.js';
import { EconomyService } from './systems/economy.js';
import { FishingService } from './systems/fishing.js';
import { FortuneService } from './systems/fortune.js';
import {
  MealService,
  scheduleDailyMealAnnouncements
} from './systems/meals.js';
import { StockService } from './systems/stocks.js';
import { TimetableService } from './systems/timetable.js';

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
      GatewayIntentBits.MessageContent
    ]
  });

  const store = createSqliteStore(databasePath, {
    migrateFromJsonPath: legacyJsonPath
  });
  const community = new CommunityService(store);
  const economy = new EconomyService(store);
  const fishing = new FishingService(store);
  const fortune = new FortuneService();
  const meals = new MealService({ store, apiKey: neisApiKey });
  const stocks = new StockService(store);
  const timetable = new TimetableService();
  const moderation = new ModerationService(store);
  let stopMealAnnouncementScheduler = () => {};

  client.once(Events.ClientReady, (readyClient) => {
    logger.log(`Logged in as ${readyClient.user.tag}`);

    stopMealAnnouncementScheduler = scheduleDailyMealAnnouncements({
      logger,
      async sendAnnouncement() {
        await sendDailyMealAnnouncements(readyClient, meals, logger);
      }
    });
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isAutocomplete?.()) {
      try {
        const handled = await handleStockAutocomplete(interaction, stocks);
        if (!handled) await interaction.respond([]);
      } catch (error) {
        logger.error('Failed to handle autocomplete interaction:', error);
        await interaction.respond([]).catch(() => {});
      }
      return;
    }

    if (!interaction.isChatInputCommand() && !interaction.isButton()) return;

    try {
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
        return;
      }

      const handled = await handleCommunityCommand(interaction, community, logger)
        || await handleModerationCommand(interaction, moderation, logger)
        || await handleWordChainCommand(interaction, economy, logger)
        || await handleFortuneCommand(interaction, fortune, economy)
        || await handleMealCommand(interaction, meals)
        || await handleTimetableCommand(interaction, timetable)
        || await handleStockCommand(interaction, stocks)
        || await handleFishingCommand(interaction, fishing)
        || await handleSwordCommand(interaction, economy, logger)
        || await handleRpgCommand(interaction, economy)
        || await handleEconomyCommand(interaction, economy);

      if (!handled) {
        await interaction.reply({
          content: '알 수 없는 명령어입니다.',
          ephemeral: true
        });
      }
    } catch (error) {
      logger.error(error);

      const payload = {
        content: '명령어 처리 중 오류가 발생했습니다.',
        ephemeral: true
      };

      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(payload);
      } else {
        await interaction.reply(payload);
      }
    }
  });

  client.on(Events.MessageCreate, async (message) => {
    if (!message.inGuild() || message.author.bot) return;

    try {
      const moderationResult = await inspectMessageForModeration(message, moderation, logger);
      if (moderationResult.blocked) return;

      const handledWordChain = await handleWordChainMessage(message, economy, logger);
      if (handledWordChain) return;

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

      if (result.leveledUp) {
        await message.channel.send(
          `🎉 ${message.author}님 레벨업! Lv.${result.profile.level} 달성, 보너스 ${result.levelReward.toLocaleString()}원 지급!`
        );
      }
      if (eventBonus?.leveledUp) {
        await message.channel.send(
          `📣 서버 이벤트 보너스로 ${message.author}님 레벨업! Lv.${eventBonus.profile.level} 달성, 보너스 ${eventBonus.levelReward.toLocaleString()}원 지급!`
        );
      }
    } catch (error) {
      logger.error('Failed to reward message activity:', error);
    }
  });

  return {
    client,
    economy,
    fishing,
    fortune,
    meals,
    stocks,
    timetable,
    moderation,
    stopMealAnnouncements() {
      stopMealAnnouncementScheduler();
    },
    async start(token) {
      await client.login(token);
    }
  };
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
