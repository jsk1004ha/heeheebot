import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { getCasinoCommandPayloads } from './commands/casino.js';
import { getCommunityCommandPayloads } from './commands/community.js';
import { getEconomyCommandPayloads } from './commands/economy.js';
import { getFishingCommandPayloads } from './commands/fishing.js';
import { getFortuneCommandPayloads } from './commands/fortune.js';
import { getMealCommandPayloads } from './commands/meals.js';
import { getModerationCommandPayloads } from './commands/moderation.js';
import { getRpgCommandPayloads } from './commands/rpg.js';
import { getStockCommandPayloads } from './commands/stocks.js';
import { getSwordCommandPayloads } from './commands/sword.js';
import { getTamagotchiCommandPayloads } from './commands/tamagotchi.js';
import { getTimetableCommandPayloads } from './commands/timetable.js';
import { getTodayCommandPayloads } from './commands/today.js';
import { getWordChainCommandPayloads } from './commands/wordchain.js';
import { loadConfig, requireBotConfig } from './config.js';

const config = loadConfig();
requireBotConfig(config);

const rest = new REST({ version: '10' }).setToken(config.token);
const commands = [
  ...getEconomyCommandPayloads(),
  ...getCommunityCommandPayloads(),
  ...getFortuneCommandPayloads(),
  ...getTodayCommandPayloads(),
  ...getModerationCommandPayloads(),
  ...getWordChainCommandPayloads(),
  ...getMealCommandPayloads(),
  ...getTimetableCommandPayloads(),
  ...getStockCommandPayloads(),
  ...getTamagotchiCommandPayloads(),
  ...getFishingCommandPayloads(),
  ...getSwordCommandPayloads(),
  ...getRpgCommandPayloads(),
  ...getCasinoCommandPayloads()
];

if (config.guildId) {
  await rest.put(
    Routes.applicationGuildCommands(config.clientId, config.guildId),
    { body: commands }
  );
  console.log(`Registered ${commands.length} guild commands to ${config.guildId}.`);
} else {
  await rest.put(
    Routes.applicationCommands(config.clientId),
    { body: commands }
  );
  console.log(`Registered ${commands.length} global commands.`);
}
