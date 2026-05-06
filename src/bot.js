import { Client, Events, GatewayIntentBits } from 'discord.js';
import { handleCasinoCommand } from './commands/casino.js';
import { handleEconomyCommand } from './commands/economy.js';
import {
  handleModerationCommand,
  inspectMessageForModeration
} from './commands/moderation.js';
import { ModerationService } from './systems/moderation.js';
import { createSqliteStore } from './storage/sqlite-store.js';
import { EconomyService } from './systems/economy.js';

export function createBot({
  databasePath = 'data/profiles.sqlite',
  legacyJsonPath = 'data/profiles.json',
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
  const economy = new EconomyService(store);
  const moderation = new ModerationService(store);

  client.once(Events.ClientReady, (readyClient) => {
    logger.log(`Logged in as ${readyClient.user.tag}`);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand() && !interaction.isButton()) return;

    try {
      const handled = await handleCasinoCommand(interaction, economy, logger)
        || await handleModerationCommand(interaction, moderation, logger)
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

      const result = await economy.rewardMessage({
        guildId: message.guild.id,
        userId: message.author.id,
        username: message.author.username
      });

      if (result.leveledUp) {
        await message.channel.send(
          `🎉 ${message.author}님 레벨업! Lv.${result.profile.level} 달성, 보너스 ${result.levelReward.toLocaleString()}원 지급!`
        );
      }
    } catch (error) {
      logger.error('Failed to reward message activity:', error);
    }
  });

  return {
    client,
    economy,
    moderation,
    async start(token) {
      await client.login(token);
    }
  };
}
