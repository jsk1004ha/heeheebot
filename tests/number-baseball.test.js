import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { MessageFlags } from 'discord.js';
import {
  getNumberBaseballCommandPayloads,
  handleNumberBaseballCommand
} from '../src/commands/number-baseball.js';
import { createSqliteStore } from '../src/storage/sqlite-store.js';
import { EconomyService } from '../src/systems/economy.js';
import {
  NumberBaseballService,
  scoreNumberBaseballGuess
} from '../src/systems/number-baseball.js';

test('숫자야구 채점은 스트라이크와 볼을 구분한다', () => {
  assert.deepEqual(scoreNumberBaseballGuess('1243', '1234'), {
    strikes: 2,
    balls: 2,
    outs: 0
  });
  assert.deepEqual(scoreNumberBaseballGuess('5678', '1234'), {
    strikes: 0,
    balls: 0,
    outs: 1
  });
});

test('숫자야구는 잘못된 첫 입력으로 새 판을 만들거나 시도를 차감하지 않는다', async () => {
  const fixture = await createFixture();

  try {
    const invalid = await fixture.numberBaseball.submitGuess({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '테스터',
      guess: '1123',
      now: 1_000
    });
    const status = await fixture.numberBaseball.getPlayerStatus({
      guildId: 'guild-1',
      userId: 'user-1'
    });

    assert.equal(invalid.invalid, 'duplicate_digits');
    assert.equal(invalid.session, null);
    assert.equal(status.session, null);
    assert.equal(status.lastSession, null);
  } finally {
    await fixture.cleanup();
  }
});

test('숫자야구는 진행 중인 판의 랜덤 숫자를 유지하고 성공 후 다음 도전에서 새 판을 시작한다', async () => {
  const fixture = await createFixture({ secrets: ['1234', '5678'] });

  try {
    const first = await fixture.numberBaseball.submitGuess({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '테스터',
      guess: '0123',
      now: 1_000
    });
    const status = await fixture.numberBaseball.getPlayerStatus({
      guildId: 'guild-1',
      userId: 'user-1'
    });
    const solved = await fixture.numberBaseball.submitGuess({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '테스터',
      guess: '1234',
      now: 2_000
    });
    const restarted = await fixture.numberBaseball.submitGuess({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '테스터',
      guess: '5678',
      now: 3_000
    });

    assert.equal(first.startedNewGame, true);
    assert.equal(first.session.answer, '1234');
    assert.equal(first.session.status, 'playing');
    assert.equal(first.attempt.strikes, 0);
    assert.equal(first.attempt.balls, 3);
    assert.equal(status.session.answer, '1234');
    assert.equal(status.session.guesses.length, 1);
    assert.equal(solved.newlySolved, true);
    assert.equal(solved.session.status, 'solved');
    assert.equal(solved.session.answer, '1234');
    assert.equal(restarted.startedNewGame, true);
    assert.equal(restarted.newlySolved, true);
    assert.equal(restarted.session.answer, '5678');
    assert.notEqual(restarted.session.id, solved.session.id);
  } finally {
    await fixture.cleanup();
  }
});

test('숫자야구는 실패 후 같은 날 제한 없이 다음 랜덤 판을 바로 시작한다', async () => {
  const fixture = await createFixture({ maxAttempts: 1, secrets: ['1234', '5678'] });

  try {
    const failed = await fixture.numberBaseball.submitGuess({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '테스터',
      guess: '0123',
      now: 1_000
    });
    const next = await fixture.numberBaseball.submitGuess({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '테스터',
      guess: '5678',
      now: 2_000
    });

    assert.equal(failed.failed, true);
    assert.equal(failed.session.status, 'failed');
    assert.equal(failed.session.answer, '1234');
    assert.equal(next.startedNewGame, true);
    assert.equal(next.newlySolved, true);
    assert.equal(next.session.answer, '5678');
  } finally {
    await fixture.cleanup();
  }
});

test('숫자야구 성공 보상은 경험치와 골드를 함께 지급한다', async () => {
  const fixture = await createFixture({
    economyOptions: {
      numberBaseballWinXp: 50,
      numberBaseballWinMoney: 300
    }
  });

  try {
    const reward = await fixture.economy.awardNumberBaseballSuccess({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '테스터'
    });

    assert.equal(reward.source, '숫자야구 성공');
    assert.equal(reward.xpGained, 50);
    assert.equal(reward.moneyGained, 300);
    assert.equal(reward.profile.totalXp, 50);
    assert.equal(reward.profile.balance, 300);
  } finally {
    await fixture.cleanup();
  }
});

test('숫자야구 실패 완주 보상은 경험치만 지급한다', async () => {
  const fixture = await createFixture({
    economyOptions: {
      numberBaseballFailXp: 25
    }
  });

  try {
    const reward = await fixture.economy.awardNumberBaseballFailure({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '테스터'
    });

    assert.equal(reward.source, '숫자야구 실패 완주');
    assert.equal(reward.xpGained, 25);
    assert.equal(reward.moneyGained, 0);
    assert.equal(reward.profile.totalXp, 25);
    assert.equal(reward.profile.balance, 0);
  } finally {
    await fixture.cleanup();
  }
});

test('/숫자야구 명령은 도전과 상태 서브커맨드를 등록하고 일일 제한을 설명하지 않는다', () => {
  const [payload] = getNumberBaseballCommandPayloads();

  assert.equal(payload.name, '숫자야구');
  assert.match(payload.description, /랜덤 4자리 숫자/);
  assert.doesNotMatch(payload.description, /하루/);
  assert.deepEqual(payload.options.map((option) => option.name), ['도전', '상태']);
  assert.ok(payload.options[0].options.some((option) => option.name === '숫자'));
});

test('/숫자야구 도전 성공 응답은 본인에게만 보이고 경험치와 골드를 알려준다', async () => {
  const fixture = await createFixture({
    secrets: ['1234'],
    economyOptions: {
      numberBaseballWinXp: 50,
      numberBaseballWinMoney: 300
    }
  });

  try {
    const interaction = createInteraction('도전', {
      stringOptions: { 숫자: '1234' }
    });

    const handled = await handleNumberBaseballCommand(interaction, fixture.numberBaseball, fixture.economy);

    assert.equal(handled, true);
    assert.equal(interaction.replies.length, 1);
    assert.equal(interaction.replies[0].flags, MessageFlags.Ephemeral);
    assert.match(interaction.replies[0].content, /새 랜덤 숫자/);
    assert.match(interaction.replies[0].content, /정답입니다/);
    assert.match(interaction.replies[0].content, /1234/);
    assert.match(interaction.replies[0].content, /\+50 XP/);
    assert.match(interaction.replies[0].content, /300골드/);
  } finally {
    await fixture.cleanup();
  }
});

test('/숫자야구 도전 실패 응답은 경험치만 지급하고 다음 판 가능성을 안내한다', async () => {
  const fixture = await createFixture({
    maxAttempts: 1,
    secrets: ['1234'],
    economyOptions: {
      numberBaseballFailXp: 20
    }
  });

  try {
    const interaction = createInteraction('도전', {
      stringOptions: { 숫자: '5678' }
    });

    const handled = await handleNumberBaseballCommand(interaction, fixture.numberBaseball, fixture.economy);

    assert.equal(handled, true);
    assert.equal(interaction.replies[0].flags, MessageFlags.Ephemeral);
    assert.match(interaction.replies[0].content, /마지막 시도까지 종료/);
    assert.match(interaction.replies[0].content, /정답: \*\*1234\*\*/);
    assert.match(interaction.replies[0].content, /\+20 XP/);
    assert.match(interaction.replies[0].content, /골드는 정답 성공 시에만 지급/);
    assert.match(interaction.replies[0].content, /새 랜덤 숫자로 다시 시작/);
    assert.doesNotMatch(interaction.replies[0].content, /300골드/);
  } finally {
    await fixture.cleanup();
  }
});

async function createFixture({ economyOptions = {}, secrets = ['1234'], ...numberBaseballOptions } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'heeheebot-number-baseball-'));
  const store = createSqliteStore(join(directory, 'profiles.sqlite'));
  let secretIndex = 0;
  const numberBaseball = new NumberBaseballService(store, {
    randomSecret: numberBaseballOptions.randomSecret ?? (() => secrets[Math.min(secretIndex++, secrets.length - 1)]),
    ...numberBaseballOptions
  });
  const economy = new EconomyService(store, economyOptions);

  return {
    store,
    numberBaseball,
    economy,
    async cleanup() {
      store.close();
      await rm(directory, {
        recursive: true,
        force: true
      });
    }
  };
}

function createInteraction(subcommand, { stringOptions = {} } = {}) {
  return {
    commandName: '숫자야구',
    guildId: 'guild-1',
    user: { id: 'user-1', username: '테스터' },
    replies: [],
    isChatInputCommand: () => true,
    inGuild: () => true,
    options: {
      getSubcommand: () => subcommand,
      getString: (name, required = false) => {
        const value = stringOptions[name] ?? null;
        if (required && value === null) throw new Error(`missing string option: ${name}`);
        return value;
      }
    },
    async reply(payload) {
      this.replies.push(payload);
    }
  };
}
