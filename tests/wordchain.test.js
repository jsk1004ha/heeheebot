import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  getWordChainCommandPayloads,
  getWordChainTurnTimeoutMs,
  handleWordChainCommand,
  resetWordChainGamesForTest
} from '../src/commands/wordchain.js';
import { createSqliteStore } from '../src/storage/sqlite-store.js';
import { EconomyService } from '../src/systems/economy.js';
import {
  BOT_WORDCHAIN_PLAYER_ID,
  KoreanWordDictionary,
  WordChainGame,
  createWordChainPlayers,
  getAllowedStartSyllables
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

test('두음법칙으로 이어지는 첫 글자를 허용하되 오답에는 예시 단어를 제공하지 않는다', () => {
  const dictionary = new KoreanWordDictionary([
    '기력',
    '역사',
    '라면',
    '나비',
    '녀석',
    '여우',
    '사과'
  ]);
  const game = new WordChainGame({
    players: createWordChainPlayers([
      { userId: 'user-1', username: '첫째' },
      { userId: 'user-2', username: '둘째' }
    ], {
      includeBot: false
    }),
    dictionary,
    randomInt: () => 0
  });

  assert.deepEqual(getAllowedStartSyllables('력'), ['력', '역']);
  assert.deepEqual(getAllowedStartSyllables('라'), ['라', '나']);
  assert.deepEqual(getAllowedStartSyllables('녀'), ['녀', '여']);
  assert.equal(dictionary.chooseWord({ requiredStart: '력', randomInt: () => 0 }), '역사');
  assert.equal(dictionary.validateWord({ word: '나비', requiredStart: '라' }).valid, true);

  assert.equal(game.submitWord({
    userId: 'user-1',
    word: '기력'
  }).accepted, true);

  const rejected = game.submitWord({
    userId: 'user-2',
    word: '사과'
  });

  assert.equal(rejected.accepted, false);
  assert.equal(rejected.code, 'wrong_start');
  assert.equal(rejected.reason, '**력/역**(으)로 시작해야 합니다.');
  assert.equal(rejected.exampleWord, undefined);

  const accepted = game.submitWord({
    userId: 'user-2',
    word: '역사'
  });

  assert.equal(accepted.accepted, true);
});

test('희희봇은 게임 시작 전에 이어갈 수 있는 시작 단어를 제공한다', () => {
  const dictionary = new KoreanWordDictionary(['가나', '나비', '비누']);
  const game = new WordChainGame({
    players: createWordChainPlayers([
      { userId: 'user-1', username: '플레이어' }
    ]),
    dictionary,
    randomInt: () => 0
  });

  const starter = game.provideStarterWord();

  assert.equal(starter.provided, true);
  assert.equal(starter.word, '가나');
  assert.equal(starter.nextRequiredStart, '나');
  assert.equal(game.currentPlayer.userId, 'user-1');
  assert.deepEqual(game.acceptedWords, [{
    player: {
      userId: BOT_WORDCHAIN_PLAYER_ID,
      username: '희희봇',
      bot: true
    },
    word: '가나',
    starter: true
  }]);
});

test('희희봇 미참가 끝말잇기는 유저만 순서에 넣고 2명 이상부터 시작할 수 있다', () => {
  const dictionary = new KoreanWordDictionary(['가나', '나비', '비누']);
  const players = createWordChainPlayers([
    { userId: 'user-1', username: '첫째' },
    { userId: 'user-2', username: '둘째' }
  ], {
    includeBot: false
  });
  const game = new WordChainGame({
    players,
    dictionary
  });

  assert.deepEqual(game.players.map((player) => player.userId), ['user-1', 'user-2']);
  assert.equal(game.players.some((player) => player.userId === BOT_WORDCHAIN_PLAYER_ID), false);

  assert.throws(() => new WordChainGame({
    players: createWordChainPlayers([
      { userId: 'user-1', username: '혼자' }
    ], {
      includeBot: false
    }),
    dictionary
  }), /2명 이상/);
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

test('방장은 모집 60초를 기다리지 않고 버튼으로 바로 시작할 수 있다', async () => {
  resetWordChainGamesForTest();

  const dictionary = new KoreanWordDictionary(['가나', '나비', '비누']);
  const replies = [];
  const updates = [];
  const sent = [];
  const channel = {
    async send(content) {
      sent.push(content);
    }
  };
  const common = {
    guildId: 'guild-1',
    channelId: 'channel-1',
    channel,
    user: {
      id: 'host-1',
      username: '방장',
      bot: false
    }
  };

  await handleWordChainCommand({
    ...common,
    isButton: () => false,
    isChatInputCommand: () => true,
    commandName: '끝말잇기',
    inGuild: () => true,
    options: {
      getSubcommand: () => '시작',
      getString: () => null,
      getBoolean: () => true
    },
    async reply(payload) {
      replies.push(payload);
    }
  }, null, console, {
    dictionary,
    collectionMs: 60_000,
    botThinkMs: 60_000,
    randomInt: () => 0
  });

  const lobbyComponents = replies[0].components[0].toJSON().components;
  const startButton = lobbyComponents.find((component) => component.label === '방장 시작');

  assert.ok(startButton);

  await handleWordChainCommand({
    ...common,
    isButton: () => true,
    customId: startButton.custom_id,
    async update(payload) {
      updates.push(payload);
    },
    async reply(payload) {
      replies.push(payload);
    }
  }, null, console, {});

  assert.match(updates[0].content, /바로 시작/);
  assert.deepEqual(updates[0].components, []);
  assert.match(sent[0], /희희봇 시작 단어: \*\*가나\*\*/);
  assert.match(sent[0], /첫 글자: \*\*나\*\*/);
  assert.match(sent[1], /<@host-1> 차례/);

  resetWordChainGamesForTest();
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

test('희희봇이 최종 승자이면 마지막으로 탈락한 유저에게 상금을 지급한다', async () => {
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
        { userId: 'user-2', username: '준우승자' }
      ],
      winnerUserId: null,
      prizeUserId: 'user-2'
    });

    assert.equal(result.winner, null);
    assert.equal(result.prizeRecipient.userId, 'user-2');
    assert.equal(result.participants[0].moneyGained, 0);
    assert.equal(result.participants[1].xpGained, 70);
    assert.equal(result.participants[1].moneyGained, 500);
    assert.equal(result.participants[1].profile.balance, 500);
  } finally {
    await fixture.cleanup();
  }
});

test('끝말잇기 XP로 레벨업하면 레벨업 보너스 돈을 함께 지급한다', async () => {
  const fixture = await createFixture({
    wordChainParticipationXpMin: 70,
    wordChainWinXp: 70,
    wordChainWinnerMoney: 0,
    levelBaseXp: 20
  });

  try {
    const result = await fixture.economy.awardWordChainResults({
      guildId: 'guild-1',
      participants: [
        { userId: 'user-1', username: '레벨업' }
      ],
      winnerUserId: null,
      prizeUserId: null
    });

    assert.equal(result.participants[0].leveledUp, true);
    assert.equal(result.participants[0].levelReward, 200);
    assert.equal(result.participants[0].moneyGained, 0);
    assert.equal(result.participants[0].profile.balance, 200);
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
  assert.ok(payload.options[0].options.find((option) => option.name === '희희봇참가'));
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
