import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { createBot } from './bot.js';
import { registerApplicationCommands } from './command-registration.js';
import { loadConfig, requireBotConfig } from './config.js';
import { ensureMusicRuntime } from './systems/music-setup.js';

export async function startBot(config, {
  createBotImpl = createBot,
  registerCommands = registerApplicationCommands,
  setupMusicRuntime = ensureMusicRuntime
} = {}) {
  requireBotConfig(config);

  if (config.registerCommandsOnStartup !== false) {
    await registerCommands(config);
  }

  const musicRuntime = await setupMusicRuntime(config.music);

  const bot = createBotImpl({
    databasePath: config.databasePath,
    legacyJsonPath: config.legacyJsonPath,
    neisApiKey: config.neisApiKey,
    musicConfig: musicRuntime.musicConfig
  });
  bot.stopMusicRuntime = musicRuntime.cleanup;

  try {
    await bot.start(config.token);
  } catch (error) {
    musicRuntime.cleanup();
    throw error;
  }
  return bot;
}

function isMainModule() {
  return Boolean(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href);
}

if (isMainModule()) {
  await startBot(loadConfig());
}
