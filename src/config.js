export function loadConfig(env = process.env) {
  return {
    token: env.DISCORD_TOKEN,
    clientId: env.DISCORD_CLIENT_ID,
    guildId: env.DISCORD_GUILD_ID,
    neisApiKey: env.NEIS_API_KEY,
    registerCommandsOnStartup: parseBooleanEnv(env.REGISTER_COMMANDS_ON_STARTUP, true),
    databasePath: env.BOT_SQLITE_PATH ?? 'data/profiles.sqlite',
    legacyJsonPath: env.BOT_JSON_MIGRATION_PATH ?? env.BOT_DATA_PATH ?? 'data/profiles.json',
    music: {
      autoSetup: parseBooleanEnv(env.MUSIC_AUTO_SETUP, true),
      runtimeDir: env.MUSIC_RUNTIME_DIR ?? 'data/music-runtime',
      lavalink: {
        host: emptyToNull(env.LAVALINK_HOST),
        port: parseIntegerEnv(env.LAVALINK_PORT, 2333),
        password: env.LAVALINK_PASSWORD ?? 'youshallnotpass',
        secure: parseBooleanEnv(env.LAVALINK_SECURE, false),
        sessionId: emptyToNull(env.LAVALINK_SESSION_ID),
        clientName: env.LAVALINK_CLIENT_NAME ?? 'heeheebot/0.10',
        autoStart: parseBooleanEnv(env.LAVALINK_AUTO_START, true),
        jarPath: emptyToNull(env.LAVALINK_JAR_PATH),
        jarUrl: env.LAVALINK_JAR_URL,
        javaCommand: emptyToNull(env.LAVALINK_JAVA_COMMAND),
        configPath: emptyToNull(env.LAVALINK_CONFIG_PATH),
        youtubePluginVersion: emptyToNull(env.LAVALINK_YOUTUBE_PLUGIN_VERSION),
        readyTimeoutMs: parseIntegerEnv(env.LAVALINK_READY_TIMEOUT_MS, 180000)
      },
      ytdlp: {
        enabled: parseBooleanEnv(env.YTDLP_ENABLED, true),
        autoDownload: parseBooleanEnv(env.YTDLP_AUTO_DOWNLOAD, true),
        path: env.YTDLP_PATH ?? 'yt-dlp',
        timeoutMs: parseIntegerEnv(env.YTDLP_TIMEOUT_MS, 12000),
        assetUrl: env.YTDLP_ASSET_URL
      },
      defaultSearchPrefix: env.MUSIC_SEARCH_PREFIX ?? 'ytsearch',
      pinPanel: parseBooleanEnv(env.MUSIC_PIN_PANEL, false),
      panelRefreshIntervalMs: parseIntegerEnv(env.MUSIC_PANEL_REFRESH_INTERVAL_MS, 15000)
    }
  };
}

export function requireBotConfig(config) {
  const missing = [];

  if (!config.token) missing.push('DISCORD_TOKEN');
  if (!config.clientId) missing.push('DISCORD_CLIENT_ID');

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

function parseBooleanEnv(value, defaultValue) {
  if (value === undefined || value === null || value === '') return defaultValue;
  return !['0', 'false', 'no', 'off'].includes(String(value).trim().toLowerCase());
}

function parseIntegerEnv(value, defaultValue) {
  if (value === undefined || value === null || value === '') return defaultValue;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : defaultValue;
}

function emptyToNull(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
}
