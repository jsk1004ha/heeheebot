import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { createBot } from './bot.js';
import { registerApplicationCommands } from './command-registration.js';
import { loadConfig, requireBotConfig } from './config.js';
import { ensureMusicRuntime } from './systems/music-setup.js';

export async function startBot(config, {
  createBotImpl = createBot,
  registerCommands = registerApplicationCommands,
  setupMusicRuntime = ensureMusicRuntime,
  logger = console,
  loginTimeoutMs = 45_000
} = {}) {
  requireBotConfig(config);

  if (config.registerCommandsOnStartup !== false) {
    await registerCommands(config);
  }

  const musicRuntime = await setupMusicRuntime(config.music);
  logger.log?.('음악 런타임 준비 완료. Discord 봇 로그인을 시작합니다.');

  const bot = createBotImpl({
    databasePath: config.databasePath,
    legacyJsonPath: config.legacyJsonPath,
    neisApiKey: config.neisApiKey,
    musicConfig: musicRuntime.musicConfig,
    logger
  });
  bot.stopMusicRuntime = musicRuntime.cleanup;

  try {
    await withTimeout(bot.start(config.token), loginTimeoutMs, 'Discord 로그인 시간이 초과되었습니다. DISCORD_TOKEN, 네트워크, 봇 권한을 확인해주세요.');
    logger.log?.('Discord 로그인 요청 완료. Ready 이벤트를 기다립니다.');
  } catch (error) {
    musicRuntime.cleanup();
    throw error;
  }
  return bot;
}

function withTimeout(promise, timeoutMs, message) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;

  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    timer.unref?.();
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function isMainModule() {
  return Boolean(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href);
}

if (isMainModule()) {
  await startBot(loadConfig());
}
