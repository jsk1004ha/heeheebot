import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getApplicationCommandPayloads,
  registerApplicationCommands
} from '../src/command-registration.js';
import { loadConfig } from '../src/config.js';
import { startBot } from '../src/index.js';

const COMMANDS_ADDED_IN_44FA961 = Object.freeze([
  '선택',
  '궁합',
  '투표',
  '초성게임',
  '라이어게임',
  '라이어바',
  '마피아게임',
  '우노',
  '워들',
  '숫자야구'
]);

test('애플리케이션 명령 레지스트리는 44fa961 추가 명령을 모두 포함한다', () => {
  const commands = getApplicationCommandPayloads();
  const commandNames = commands.map((command) => command.name);

  assert.ok(commands.length <= 100, 'Discord application command 한도(100개)를 넘으면 등록이 실패합니다.');

  for (const name of COMMANDS_ADDED_IN_44FA961) {
    assert.ok(commandNames.includes(name), `${name} 명령이 등록 payload에 있어야 합니다.`);
  }

  assert.equal(new Set(commandNames).size, commandNames.length, '중복 명령 이름이 없어야 합니다.');
});

test('명령 등록 함수는 공유 레지스트리 payload를 Discord REST에 bulk overwrite 한다', async () => {
  const calls = [];
  const rest = {
    async put(route, payload) {
      calls.push({ route, payload });
      return [];
    }
  };
  const logs = [];

  const result = await registerApplicationCommands({
    token: 'token',
    clientId: 'client-id',
    guildId: 'guild-id',
    rest,
    logger: { log: (message) => logs.push(message) }
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].route, /guild-id/);
  assert.equal(calls[0].payload.body, result.commands);
  assert.ok(result.commands.some((command) => command.name === '워들'));
  assert.ok(result.commands.some((command) => command.name === '숫자야구'));
  assert.ok(result.commands.some((command) => command.name === '투표'));
  assert.ok(result.commands.some((command) => command.name === '시작하기'));
  assert.equal(result.scope, 'guild');
  assert.match(logs[0], /Registered \d+ guild commands/);
});

test('봇 시작 경로는 로그인 전에 slash command를 자동 동기화한다', async () => {
  const events = [];
  const logs = [];
  const logger = { log: (message) => logs.push(String(message)) };
  const config = loadConfig({
    DISCORD_TOKEN: 'token',
    DISCORD_CLIENT_ID: 'client-id',
    DISCORD_GUILD_ID: 'guild-id'
  });

  const bot = await startBot(config, {
    async registerCommands(receivedConfig) {
      events.push(['register', receivedConfig.guildId]);
    },
    async setupMusicRuntime(musicConfig) {
      events.push(['music-setup', musicConfig.autoSetup]);
      return { musicConfig, cleanup() {} };
    },
    createBotImpl(options) {
      events.push(['create', options.databasePath]);
      assert.equal(options.logger, logger);
      return {
        async start(token) {
          events.push(['start', token]);
        }
      };
    },
    logger
  });

  assert.deepEqual(events, [
    ['register', 'guild-id'],
    ['music-setup', true],
    ['create', 'data/profiles.sqlite'],
    ['start', 'token']
  ]);
  assert.ok(logs.some((message) => message.includes('Discord 봇 로그인을 시작')));
  assert.equal(typeof bot.start, 'function');
});

test('REGISTER_COMMANDS_ON_STARTUP=false면 자동 동기화를 건너뛸 수 있다', async () => {
  const events = [];
  const config = loadConfig({
    DISCORD_TOKEN: 'token',
    DISCORD_CLIENT_ID: 'client-id',
    REGISTER_COMMANDS_ON_STARTUP: 'false'
  });

  await startBot(config, {
    async registerCommands() {
      events.push('register');
    },
    async setupMusicRuntime(musicConfig) {
      events.push(`music-setup:${musicConfig.autoSetup}`);
      return { musicConfig, cleanup() {} };
    },
    createBotImpl() {
      events.push('create');
      return {
        async start() {
          events.push('start');
        }
      };
    }
  });

  assert.deepEqual(events, ['music-setup:true', 'create', 'start']);
});
