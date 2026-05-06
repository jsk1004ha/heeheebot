import { createBot } from './bot.js';
import { loadConfig, requireBotConfig } from './config.js';

const config = loadConfig();
requireBotConfig(config);

const bot = createBot({
  databasePath: config.databasePath,
  legacyJsonPath: config.legacyJsonPath
});

await bot.start(config.token);
