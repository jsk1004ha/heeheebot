export function loadConfig(env = process.env) {
  return {
    token: env.DISCORD_TOKEN,
    clientId: env.DISCORD_CLIENT_ID,
    guildId: env.DISCORD_GUILD_ID,
    databasePath: env.BOT_SQLITE_PATH ?? 'data/profiles.sqlite',
    legacyJsonPath: env.BOT_JSON_MIGRATION_PATH ?? env.BOT_DATA_PATH ?? 'data/profiles.json'
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
