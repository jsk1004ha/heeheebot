import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  getWordChainCommandPayloads,
  getWordChainTurnTimeoutMs
} from '../src/commands/wordchain.js';
import { createSqliteStore } from '../src/storage/sqlite-store.js';
import { EconomyService } from '../src/systems/economy.js';
import {
  BOT_WORDCHAIN_PLAYER_ID,
  KoreanWordDictionary,
  WordChainGame,
  createWordChainPlayers
} from '../src/systems/wordchain.js';

test('끝말잇기 단어 사전은 시작 글자, 중복, DB 등록 여부와 모드 룰을 검사한다', () => {
  const dictionary = new KoreanWordDictionary([
    '가나',
    '가나다',
    '나무',
    '나비',
    '누리',
    '무지',
    '비누',
    '자르반4세'
  ]);
  const usedWords = new Set(['가나']);

  assert.deepEqual(dictionary.validateWord({
    word: '나비',
    requiredStart: '나',
    usedWords
  }), {
    valid: true,
    word: '나비'
  });
  assert.equal(dictionary.validateWord({
    word: '비누',
    requiredStart: '나',
    usedWords
  }).code, 'wrong_start');
  assert.equal(dictionary.validateWord({
    word: '가나',
    requiredStart: '가',
    usedWords
  }).code, 'already_used');
  assert.equal(dictionary.validateWord({
    word: '나방',
    requiredStart: '나',
    usedWords
  }).code, 'unknown_word');
  assert.equal(dictionary.validateWord({
    word: '자르반4세',
    requiredStart: '자',
    usedWords
  }).valid, true);
  assert.equal(dictionary.validateWord({
    word: '나무',
    requiredStart: '나',
    usedWords,
    forbidOneShot: true
  }).valid, true);
  assert.equal(dictionary.validateWord({
    word: '누리',
    requiredStart: '누',
    usedWords,
    forbidOneShot: true
  }).code, 'one_shot');
  assert.equal(dictionary.validateWord({
    word: '가나다',
    exactLength: 3
  }).valid, true);
  assert.equal(dictionary.validateWord({
    word: '가나',
    exactLength: 3
  }).code, 'invalid_length');
});

test('희희봇 AI는 자기 차례에 DB 단어를 고르고 단어가 없으면 탈락한다', () => {
  const dictionary = new KoreanWordDictionary(['가나', '나비', '비누']);
  const game = new WordChainGame({
    players: createWordChainPlayers([
      { userId: 'user-1', username: '플레이어' }
    ]),
    dictionary,
    randomInt: () => 0
  });

  const first = game.submitWord({
    userId: 'user-1',
    word: '가나'
  });
  assert.equal(first.accepted, true);
  assert.equal(game.currentPlayer.userId, BOT_WORDCHAIN_PLAYER_ID);

  const bot = game.playBotTurn();
  assert.equal(bot.played, true);
  assert.equal(bot.word, '나비');
  assert.equal(game.requiredStart, '비');

  const second = game.submitWord({
    userId: 'user-1',
    word: '비누'
  });
  assert.equal(second.accepted, true);

  const botFail = game.playBotTurn();
  assert.equal(botFail.played, false);
  assert.equal(botFail.completed, true);
  assert.equal(botFail.winner.userId, 'user-1');
});

test('답을 못한 현재 플레이어는 탈락하고 다음 생존자에게 턴이 넘어간다', () => {
  const dictionary = new KoreanWordDictionary(['가나', '나비']);
  const game = new WordChainGame({
    players: createWordChainPlayers([
      { userId: 'user-1', username: '첫째' },
      { userId: 'user-2', username: '둘째' }
    ]),
    dictionary
  });

  const timeout = game.eliminateCurrentPlayer('timeout');

  assert.equal(timeout.completed, false);
  assert.equal(timeout.eliminated.player.userId, 'user-1');
  assert.equal(game.currentPlayer.userId, 'user-2');

  game.eliminateCurrentPlayer('timeout');

  assert.equal(game.isComplete, true);
  assert.equal(game.winner.userId, BOT_WORDCHAIN_PLAYER_ID);
  assert.deepEqual(game.getHumanFinishOrder(), [
    { userId: 'user-1', username: '첫째' },
    { userId: 'user-2', username: '둘째' }
  ]);
});

test('매너 모드는 한방단어를 거절하고 AI도 한방단어를 피한다', () => {
  const dictionary = new KoreanWordDictionary(['가나', '나무', '나비', '무지']);
  const rejected = new WordChainGame({
    players: createWordChainPlayers([
      { userId: 'user-1', username: '플레이어' }
    ]),
    dictionary,
    rules: {
      forbidOneShot: true
    },
    randomInt: () => 0
  }).submitWord({
    userId: 'user-1',
    word: '나비'
  });

  assert.equal(rejected.accepted, false);
  assert.equal(rejected.code, 'one_shot');

  const game = new WordChainGame({
    players: createWordChainPlayers([
      { userId: 'user-1', username: '플레이어' }
    ]),
    dictionary,
    rules: {
      forbidOneShot: true
    },
    randomInt: () => 0
  });

  assert.equal(game.submitWord({
    userId: 'user-1',
    word: '가나'
  }).accepted, true);

  const bot = game.playBotTurn();

  assert.equal(bot.played, true);
  assert.equal(bot.word, '나무');
});

test('쿵쿵따 모드는 정확히 3글자 단어만 허용한다', () => {
  const dictionary = new KoreanWordDictionary(['가나', '가나다', '다라마']);
  const game = new WordChainGame({
    players: createWordChainPlayers([
      { userId: 'user-1', username: '플레이어' }
    ]),
    dictionary,
    rules: {
      exactLength: 3
    },
    randomInt: () => 0
  });

  const rejected = game.submitWord({
    userId: 'user-1',
    word: '가나'
  });

  assert.equal(rejected.accepted, false);
  assert.equal(rejected.code, 'invalid_length');

  const accepted = game.submitWord({
    userId: 'user-1',
    word: '가나다'
  });

  assert.equal(accepted.accepted, true);
  assert.equal(game.playBotTurn().word, '다라마');
});

test('끝말잇기 턴 제한시간은 성공 단어가 쌓일수록 줄고 최소값 아래로 내려가지 않는다', () => {
  const state = {
    turnTimeoutMs: 30_000,
    turnTimeoutDecreaseMs: 1_000,
    minTurnTimeoutMs: 5_000,
    game: {
      acceptedWords: []
    }
  };

  assert.equal(getWordChainTurnTimeoutMs(state), 30_000);

  state.game.acceptedWords = Array.from({ length: 7 }, (_, index) => ({ word: `단어${index}` }));
  assert.equal(getWordChainTurnTimeoutMs(state), 23_000);

  state.game.acceptedWords = Array.from({ length: 99 }, (_, index) => ({ word: `단어${index}` }));
  assert.equal(getWordChainTurnTimeoutMs(state), 5_000);
});

test('끝말잇기 결과 보상은 빨리 탈락할수록 적고 최종 유저 승자에게 돈을 지급한다', async () => {
  const fixture = await createFixture({
    wordChainParticipationXpMin: 10,
    wordChainWinXp: 70,
    wordChainWinnerMoney: 500,
    levelBaseXp: 1000
  });

  try {
    const result = await fixture.economy.awardWordChainResults({
      guildId: 'guild-1',
      participants: [
        { userId: 'user-1', username: '초반탈락' },
        { userId: 'user-2', username: '중반탈락' },
        { userId: 'user-3', username: '승자' }
      ],
      winnerUserId: 'user-3'
    });

    assert.deepEqual(result.participants.map((participant) => participant.xpGained), [10, 40, 70]);
    assert.deepEqual(result.participants.map((participant) => participant.moneyGained), [0, 0, 500]);
    assert.equal(result.winner.userId, 'user-3');
    assert.equal(result.winner.profile.balance, 500);
  } finally {
    await fixture.cleanup();
  }
});

test('희희봇이 최종 승자이면 유저는 생존 순위 XP만 받고 돈은 지급되지 않는다', async () => {
  const fixture = await createFixture({
    wordChainParticipationXpMin: 10,
    wordChainWinXp: 70,
    wordChainWinnerMoney: 500,
    levelBaseXp: 1000
  });

  try {
    const result = await fixture.economy.awardWordChainResults({
      guildId: 'guild-1',
      participants: [
        { userId: 'user-1', username: '탈락자' }
      ],
      winnerUserId: null
    });

    assert.equal(result.winner, null);
    assert.equal(result.participants[0].xpGained, 10);
    assert.equal(result.participants[0].moneyGained, 0);
    assert.equal(result.participants[0].profile.balance, 0);
  } finally {
    await fixture.cleanup();
  }
});

test('/끝말잇기 시작 명령과 AutoKkutu 단어 DB 파일을 제공한다', async () => {
  const [payload] = getWordChainCommandPayloads();
  const words = await readFile(new URL('../data/wordchain-ko.txt', import.meta.url), 'utf8');
  const source = await readFile(new URL('../data/wordchain-ko.SOURCE.md', import.meta.url), 'utf8');

  assert.equal(payload.name, '끝말잇기');
  assert.equal(payload.options[0].name, '시작');
  assert.deepEqual(
    payload.options[0].options.find((option) => option.name === '모드').choices.map((choice) => choice.value),
    ['classic', 'manner', 'kungkungtta']
  );
  assert.ok(words.split(/\r?\n/).filter(Boolean).length >= 357_000);
  assert.match(words, /자르반4세/);
  assert.match(source, /KkutuDbDump\/kor_list\.txt/);
});

async function createFixture(options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'heeheebot-wordchain-'));
  const store = createSqliteStore(join(directory, 'profiles.sqlite'));
  const economy = new EconomyService(store, options);

  return {
    economy,
    store,
    async cleanup() {
      store.close();
      await rm(directory, {
        recursive: true,
        force: true
      });
    }
  };
}
