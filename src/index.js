import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { createBot } from './bot.js';
import { registerApplicationCommands } from './command-registration.js';
import { loadConfig, requireBotConfig } from './config.js';

export async function startBot(config, {
  createBotImpl = createBot,
  registerCommands = registerApplicationCommands
} = {}) {
  requireBotConfig(config);

  if (config.registerCommandsOnStartup !== false) {
    await registerCommands(config);
  }

  const bot = createBotImpl({
    databasePath: config.databasePath,
    legacyJsonPath: config.legacyJsonPath,
    neisApiKey: config.neisApiKey
  });

  await bot.start(config.token);
  return bot;
}

function isMainModule() {
  return Boolean(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href);
}

if (isMainModule()) {
  await startBot(loadConfig());
}
