import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { MessageFlags } from 'discord.js';
import {
  getWordleCommandPayloads,
  handleWordleCommand
} from '../src/commands/wordle.js';
import { createSqliteStore } from '../src/storage/sqlite-store.js';
import { EconomyService } from '../src/systems/economy.js';
import {
  WordleService,
  getWordleDayInfo,
  scoreWordleGuess
} from '../src/systems/wordle.js';

const TEST_WORDS = [
  { word: 'crane', meaning: '두루미; 기중기' },
  { word: 'slate', meaning: '석판' }
];

const KST_MIDNIGHT = Date.UTC(2026, 4, 10, 15, 0, 0);

const WORDLE_OPTIONS = Object.freeze({
  words: TEST_WORDS,
  acceptedGuesses: ['adieu', 'slate', 'crown', 'apple', 'allee'],
  selectWordIndex: () => 0
});

test('워들 날짜는 한국시간 자정 기준으로 바뀌고 자정 후 경과 시간을 계산한다', () => {
  const info = getWordleDayInfo(KST_MIDNIGHT + 10 * 60 * 1000);

  assert.equal(info.dateKey, '2026-05-11');
  assert.equal(info.dayStartMs, KST_MIDNIGHT);
  assert.equal(info.elapsedMs, 10 * 60 * 1000);
  assert.equal(info.nextResetAt, KST_MIDNIGHT + 24 * 60 * 60 * 1000);
});

test('워들 채점은 중복 글자를 정답의 남은 개수만큼만 노란색 처리한다', () => {
  assert.deepEqual(scoreWordleGuess('allee', 'apple'), [
    'correct',
    'present',
    'absent',
    'absent',
    'correct'
  ]);
});

test('워들 서비스는 같은 날짜에 같은 단어를 공유하고 성공 목록에는 정답을 저장하지 않는다', async () => {
  const fixture = await createFixture();

  try {
    const dailyA = fixture.wordle.getDailyPuzzle({ now: KST_MIDNIGHT + 1_000 });
    const dailyB = fixture.wordle.getDailyPuzzle({ now: KST_MIDNIGHT + 2_000 });

    assert.equal(dailyA.word, 'crane');
    assert.equal(dailyB.word, 'crane');

    const first = await fixture.wordle.submitGuess({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '테스터',
      guess: 'slate',
      now: KST_MIDNIGHT + 60_000
    });
    const success = await fixture.wordle.submitGuess({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '테스터',
      guess: 'crane',
      now: KST_MIDNIGHT + 120_000
    });
    const repeated = await fixture.wordle.submitGuess({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '테스터',
      guess: 'crane',
      now: KST_MIDNIGHT + 180_000
    });
    const ranking = await fixture.wordle.listTodayRankings({
      guildId: 'guild-1',
      now: KST_MIDNIGHT + 180_000
    });

    assert.equal(first.accepted, true);
    assert.equal(first.solved, false);
    assert.equal(success.newlySolved, true);
    assert.equal(success.session.status, 'solved');
    assert.equal(success.session.guesses.length, 2);
    assert.equal(success.rank.rank, 1);
    assert.equal(success.session.elapsedMs, 120_000);
    assert.equal(repeated.blocked, 'solved');
    assert.equal(repeated.newlySolved, undefined);

    assert.equal(ranking.entries.length, 1);
    assert.equal(ranking.entries[0].username, '테스터');
    assert.equal(ranking.entries[0].attempts, 2);
    assert.equal(ranking.entries[0].elapsedMs, 120_000);
    assert.equal(Object.hasOwn(ranking.entries[0], 'word'), false);
    assert.equal(Object.hasOwn(ranking.entries[0], 'meaning'), false);
  } finally {
    await fixture.cleanup();
  }
});

test('워들은 실패 후 같은 날 추가 시도를 막고 실패 응답에는 정답 공개가 필요 없는 상태를 남긴다', async () => {
  const fixture = await createFixture({
    maxAttempts: 2,
    acceptedGuesses: ['slate', 'adieu']
  });

  try {
    await fixture.wordle.submitGuess({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '테스터',
      guess: 'slate',
      now: KST_MIDNIGHT + 1_000
    });
    const failed = await fixture.wordle.submitGuess({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '테스터',
      guess: 'adieu',
      now: KST_MIDNIGHT + 2_000
    });
    const blocked = await fixture.wordle.submitGuess({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '테스터',
      guess: 'crane',
      now: KST_MIDNIGHT + 3_000
    });

    assert.equal(failed.failed, true);
    assert.equal(failed.session.status, 'failed');
    assert.equal(blocked.blocked, 'failed');
    assert.equal(blocked.session.guesses.length, 2);
  } finally {
    await fixture.cleanup();
  }
});

test('워들 성공 보상은 골드와 경험치를 함께 지급한다', async () => {
  const fixture = await createFixture({
    economyOptions: {
      wordleWinXp: 50,
      wordleWinMoney: 300
    }
  });

  try {
    const reward = await fixture.economy.awardWordleSuccess({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '테스터'
    });

    assert.equal(reward.source, '워들 성공');
    assert.equal(reward.xpGained, 50);
    assert.equal(reward.moneyGained, 300);
    assert.equal(reward.profile.totalXp, 50);
    assert.equal(reward.profile.balance, 300);
  } finally {
    await fixture.cleanup();
  }
});

test('/워들 명령은 도전, 상태, 랭킹 서브커맨드를 등록한다', () => {
  const [payload] = getWordleCommandPayloads();

  assert.equal(payload.name, '워들');
  assert.match(payload.description, /5글자 영어 단어/);
  assert.deepEqual(payload.options.map((option) => option.name), ['도전', '상태', '랭킹']);
  assert.ok(payload.options[0].options.some((option) => option.name === '단어'));
});

test('/워들 도전 성공 응답은 본인에게만 보이고 정답과 뜻, 보상을 알려준다', async () => {
  const fixture = await createFixture({
    economyOptions: {
      wordleWinXp: 50,
      wordleWinMoney: 300
    }
  });

  try {
    const interaction = createInteraction('도전', {
      stringOptions: { 단어: 'crane' }
    });

    const handled = await handleWordleCommand(interaction, fixture.wordle, fixture.economy);

    assert.equal(handled, true);
    assert.equal(interaction.replies.length, 1);
    assert.equal(interaction.replies[0].flags, MessageFlags.Ephemeral);
    assert.match(interaction.replies[0].content, /CRANE/);
    assert.match(interaction.replies[0].content, /두루미; 기중기/);
    assert.match(interaction.replies[0].content, /\+50 XP/);
    assert.match(interaction.replies[0].content, /300골드/);
  } finally {
    await fixture.cleanup();
  }
});

test('/워들 랭킹은 성공 목록만 보여주고 정답과 뜻은 숨긴다', async () => {
  const fixture = await createFixture();
  const now = fixture.wordle.now();

  try {
    await fixture.wordle.submitGuess({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '테스터',
      guess: 'crane',
      now
    });
    const interaction = createInteraction('랭킹');

    await handleWordleCommand(interaction, fixture.wordle, fixture.economy);

    const reply = interaction.replies[0];
    assert.equal(reply.flags, MessageFlags.Ephemeral);
    assert.match(reply.content, /오늘의 워들 성공 목록/);
    assert.match(reply.content, /테스터/);
    assert.match(reply.content, /1회/);
    assert.doesNotMatch(reply.content, /CRANE/);
    assert.doesNotMatch(reply.content, /두루미/);
  } finally {
    await fixture.cleanup();
  }
});

test('/워들 도전의 잘못된 단어 응답은 정답을 누설하지 않고 시도를 차감하지 않는다', async () => {
  const fixture = await createFixture();

  try {
    const interaction = createInteraction('도전', {
      stringOptions: { 단어: 'zzzzz' }
    });

    await handleWordleCommand(interaction, fixture.wordle, fixture.economy);

    const reply = interaction.replies[0];
    assert.equal(reply.flags, MessageFlags.Ephemeral);
    assert.match(reply.content, /단어 목록에 없는 추측/);
    assert.match(reply.content, /시도 횟수는 차감되지 않았습니다/);
    assert.doesNotMatch(reply.content, /CRANE/);
    assert.doesNotMatch(reply.content, /두루미/);
  } finally {
    await fixture.cleanup();
  }
});

async function createFixture({ economyOptions = {}, ...wordleOptions } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'heeheebot-wordle-'));
  const store = createSqliteStore(join(directory, 'profiles.sqlite'));
  const wordle = new WordleService(store, {
    now: () => KST_MIDNIGHT + 120_000,
    ...WORDLE_OPTIONS,
    ...wordleOptions
  });
  const economy = new EconomyService(store, economyOptions);

  return {
    store,
    wordle,
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
    commandName: '워들',
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
