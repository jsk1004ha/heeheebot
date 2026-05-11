import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  getChoseongCommandPayloads,
  handleChoseongCommand,
  handleChoseongMessage,
  resetChoseongGamesForTest
} from '../src/commands/choseong.js';
import {
  ChoseongGame,
  KoreanInitialDictionary,
  getInitialConsonants
} from '../src/systems/choseong.js';

test('초성 사전은 한글 단어의 초성 prefix와 DB 등록 여부를 검사한다', () => {
  const dictionary = new KoreanInitialDictionary([
    '강남',
    '가난',
    '고기',
    '학교'
  ]);

  assert.equal(getInitialConsonants('강남스타일'), 'ㄱㄴㅅㅌㅇ');
  assert.deepEqual(dictionary.getInitialCandidates({
    length: 2,
    minCandidates: 2
  }), [{
    initials: 'ㄱㄴ',
    answerCount: 2
  }]);

  assert.deepEqual(dictionary.chooseInitials({
    length: 2,
    minCandidates: 2,
    randomInt: () => 0
  }), {
    initials: 'ㄱㄴ',
    answerCount: 2,
    length: 2
  });

  assert.equal(dictionary.validateGuess({
    guess: '강남',
    requiredInitials: 'ㄱㄴ'
  }).accepted, true);
  assert.equal(dictionary.validateGuess({
    guess: '기념일',
    requiredInitials: 'ㄱㄴ'
  }).code, 'invalid_length');
  assert.equal(dictionary.validateGuess({
    guess: '고기',
    requiredInitials: 'ㄱㄴ'
  }).code, 'wrong_initials');
  assert.equal(dictionary.validateGuess({
    guess: '공원',
    requiredInitials: 'ㄱㅇ'
  }).code, 'unknown_word');
});

test('초성게임은 첫 정답 유저를 승자로 확정한다', () => {
  const game = new ChoseongGame({
    dictionary: new KoreanInitialDictionary(['가난', '강남', '고기']),
    minCandidates: 2,
    randomInt: () => 0
  });

  assert.equal(game.requiredInitials, 'ㄱㄴ');

  const wrong = game.submitGuess({
    userId: 'user-1',
    username: '오답',
    word: '고기'
  });
  assert.equal(wrong.accepted, false);
  assert.equal(game.isComplete, false);

  const accepted = game.submitGuess({
    userId: 'user-2',
    username: '정답',
    word: '강남'
  });
  assert.equal(accepted.accepted, true);
  assert.equal(game.isComplete, true);
  assert.equal(game.winner.userId, 'user-2');
  assert.equal(game.submitGuess({
    userId: 'user-3',
    username: '늦음',
    word: '가난'
  }).code, 'game_complete');
});

test('/초성게임 시작 명령은 라운드를 열고 채팅 정답에 XP를 지급한다', async () => {
  resetChoseongGamesForTest();

  const dictionary = new KoreanInitialDictionary(['가난', '강남', '고기']);
  const interactionReplies = [];
  const channelMessages = [];
  const reactions = [];
  let awardArgs = null;
  const channel = {
    id: 'channel-1',
    async send(payload) {
      channelMessages.push(typeof payload === 'string' ? payload : payload.content);
    }
  };
  const economy = {
    async awardActivityXp(args) {
      awardArgs = args;
      return {
        source: args.source,
        xpGained: args.xp,
        leveledUp: false,
        levelReward: 0,
        profile: {
          level: 1
        }
      };
    }
  };

  await handleChoseongCommand({
    guildId: 'guild-1',
    channelId: 'channel-1',
    channel,
    user: {
      id: 'host-1',
      username: '방장'
    },
    isChatInputCommand: () => true,
    commandName: '초성게임',
    inGuild: () => true,
    options: {
      getSubcommand: () => '시작',
      getInteger: (name) => name === '제한시간' ? 60 : 3
    },
    async reply(payload) {
      interactionReplies.push(payload);
    }
  }, economy, console, {
    dictionary,
    minCandidates: 2,
    randomInt: () => 0
  });

  assert.match(interactionReplies[0].content, /제시 초성: \*\*ㄱㄴ\*\*/);

  const handled = await handleChoseongMessage({
    guild: { id: 'guild-1' },
    channel,
    author: {
      id: 'user-1',
      username: '승자',
      bot: false
    },
    content: '강남',
    inGuild: () => true,
    async react(emoji) {
      reactions.push(emoji);
    },
    async reply() {
      throw new Error('정답에는 오답 reply를 보내지 않아야 합니다.');
    }
  }, economy, console);

  assert.equal(handled, true);
  assert.deepEqual(reactions, ['✅']);
  assert.equal(awardArgs.source, '초성게임 승리');
  assert.equal(awardArgs.xp, 50);
  assert.match(channelMessages[0], /<@user-1>님 정답/);
  assert.match(channelMessages[0], /강남/);

  assert.equal(await handleChoseongMessage({
    guild: { id: 'guild-1' },
    channel,
    author: {
      id: 'user-2',
      username: '늦음',
      bot: false
    },
    content: '가난',
    inGuild: () => true
  }, economy, console), false);

  resetChoseongGamesForTest();
});

test('/초성게임 시작 명령은 사전 준비 전에 먼저 deferReply로 응답 창을 확보한다', async () => {
  resetChoseongGamesForTest();

  const calls = [];
  const interaction = {
    guildId: 'guild-1',
    channelId: 'channel-1',
    channel: {
      async send() {}
    },
    user: {
      id: 'host-1',
      username: '방장'
    },
    deferred: false,
    replied: false,
    isChatInputCommand: () => true,
    commandName: '초성게임',
    inGuild: () => true,
    options: {
      getSubcommand: () => '시작',
      getInteger: () => 30
    },
    async deferReply() {
      calls.push('defer');
      this.deferred = true;
    },
    async editReply(payload) {
      calls.push('edit');
      this.editedPayload = payload;
      this.replied = true;
    },
    async reply() {
      throw new Error('defer 후에는 reply 대신 editReply를 사용해야 합니다.');
    }
  };
  const dictionary = {
    chooseInitials() {
      assert.deepEqual(calls, ['defer']);
      return {
        initials: 'ㄱㄴ',
        answerCount: 2,
        length: 2
      };
    },
    findAnswers() {
      return [];
    }
  };

  await handleChoseongCommand(interaction, null, console, {
    dictionary,
    randomInt: () => 0
  });

  assert.deepEqual(calls, ['defer', 'edit']);
  assert.match(interaction.editedPayload.content, /초성게임 시작/);

  resetChoseongGamesForTest();
});

test('/초성게임 시작 명령은 초성 2글자로 고정하고 확장 단어 DB 파일을 제공한다', async () => {
  const [payload] = getChoseongCommandPayloads();
  const words = await readFile(new URL('../data/choseong-ko.txt', import.meta.url), 'utf8');
  const source = await readFile(new URL('../data/choseong-ko.SOURCE.md', import.meta.url), 'utf8');

  assert.equal(payload.name, '초성게임');
  assert.equal(payload.options[0].name, '시작');
  assert.equal(payload.options[0].options.some((option) => option.name === '글자수'), false);
  assert.ok(payload.options[0].options.find((option) => option.name === '제한시간'));
  assert.ok(words.split(/\r?\n/).filter(Boolean).length >= 77_000);
  assert.equal(words.split(/\r?\n/).filter(Boolean).every((word) => /^[가-힣]{2}$/u.test(word)), true);
  assert.match(words, /^학교$/m);
  assert.match(words, /^사과$/m);
  assert.match(source, /AutoKkutu/);
  assert.match(source, /Basic Korean Vocabulary List/);
});
