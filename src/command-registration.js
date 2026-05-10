import { REST, Routes } from 'discord.js';
import { getCasinoCommandPayloads } from './commands/casino.js';
import { getChoseongCommandPayloads } from './commands/choseong.js';
import { getChoiceCommandPayloads } from './commands/choice.js';
import { getCompatibilityCommandPayloads } from './commands/compatibility.js';
import { getCommunityCommandPayloads } from './commands/community.js';
import { getEconomyCommandPayloads } from './commands/economy.js';
import { getFishingCommandPayloads } from './commands/fishing.js';
import { getFortuneCommandPayloads } from './commands/fortune.js';
import { getHelpCommandPayloads } from './commands/help.js';
import { getMealCommandPayloads } from './commands/meals.js';
import { getLiarGameCommandPayloads } from './commands/liar-game.js';
import { getModerationCommandPayloads } from './commands/moderation.js';
import { getNumberBaseballCommandPayloads } from './commands/number-baseball.js';
import { getPollCommandPayloads } from './commands/poll.js';
import { getRpgCommandPayloads } from './commands/rpg.js';
import { getSeasonCommandPayloads } from './commands/seasons.js';
import { getStockCommandPayloads } from './commands/stocks.js';
import { getSwordCommandPayloads } from './commands/sword.js';
import { getTamagotchiCommandPayloads } from './commands/tamagotchi.js';
import { getTimetableCommandPayloads } from './commands/timetable.js';
import { getTodayCommandPayloads } from './commands/today.js';
import { getWordChainCommandPayloads } from './commands/wordchain.js';
import { getWordleCommandPayloads } from './commands/wordle.js';

export function getApplicationCommandPayloads() {
  return [
    ...getEconomyCommandPayloads(),
    ...getCommunityCommandPayloads(),
    ...getHelpCommandPayloads(),
    ...getChoiceCommandPayloads(),
    ...getCompatibilityCommandPayloads(),
    ...getFortuneCommandPayloads(),
    ...getTodayCommandPayloads(),
    ...getPollCommandPayloads(),
    ...getModerationCommandPayloads(),
    ...getWordChainCommandPayloads(),
    ...getChoseongCommandPayloads(),
    ...getLiarGameCommandPayloads(),
    ...getWordleCommandPayloads(),
    ...getNumberBaseballCommandPayloads(),
    ...getMealCommandPayloads(),
    ...getTimetableCommandPayloads(),
    ...getSeasonCommandPayloads(),
    ...getStockCommandPayloads(),
    ...getTamagotchiCommandPayloads(),
    ...getFishingCommandPayloads(),
    ...getSwordCommandPayloads(),
    ...getRpgCommandPayloads(),
    ...getCasinoCommandPayloads()
  ];
}

export async function registerApplicationCommands({
  token,
  clientId,
  guildId,
  rest = null,
  logger = console
}) {
  const commands = getApplicationCommandPayloads();
  const discordRest = rest ?? new REST({ version: '10' }).setToken(token);
  const route = guildId
    ? Routes.applicationGuildCommands(clientId, guildId)
    : Routes.applicationCommands(clientId);

  await discordRest.put(route, { body: commands });

  const scope = guildId ? `guild commands to ${guildId}` : 'global commands';
  logger.log?.(`Registered ${commands.length} ${scope}.`);

  return {
    commands,
    route,
    scope: guildId ? 'guild' : 'global'
  };
}
