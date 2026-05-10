import 'dotenv/config';
import { registerApplicationCommands } from './command-registration.js';
import { loadConfig, requireBotConfig } from './config.js';

const config = loadConfig();
requireBotConfig(config);

await registerApplicationCommands(config);
