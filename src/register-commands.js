import { REST, Routes } from 'discord.js';
import { getCasinoCommandPayloads } from './commands/casino.js';
import { getEconomyCommandPayloads } from './commands/economy.js';
import { getModerationCommandPayloads } from './commands/moderation.js';
import { loadConfig, requireBotConfig } from './config.js';

const config = loadConfig();
requireBotConfig(config);

const rest = new REST({ version: '10' }).setToken(config.token);
const commands = [
  ...getEconomyCommandPayloads(),
  ...getModerationCommandPayloads(),
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
