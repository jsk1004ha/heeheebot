import { readFileSync } from 'node:fs';

export const DEFAULT_WORDCHAIN_WORDS_PATH = new URL('../../data/wordchain-ko.txt', import.meta.url);
export const BOT_WORDCHAIN_PLAYER_ID = '__heeheebot_wordchain_ai__';
export const BOT_WORDCHAIN_PLAYER_NAME = '희희봇';

const DEFAULT_RULES = Object.freeze({
  exactLength: null,
  forbidOneShot: false
});

export class KoreanWordDictionary {
  constructor(words) {
    const normalizedWords = [...new Set(words.map(normalizeKoreanWord).filter(Boolean))].sort();

    if (normalizedWords.length === 0) {
      throw new Error('끝말잇기 단어 목록이 비어 있습니다.');
    }

    this.words = normalizedWords;
    this.wordSet = new Set(normalizedWords);
    this.wordsByStart = new Map();

    for (const word of normalizedWords) {
      const start = getFirstSyllable(word);
      const bucket = this.wordsByStart.get(start) ?? [];
      bucket.push(word);
      this.wordsByStart.set(start, bucket);
    }
  }

  static fromFile(path = DEFAULT_WORDCHAIN_WORDS_PATH) {
    const source = readFileSync(path, 'utf8');
    return new KoreanWordDictionary(source.split(/\r?\n/));
  }

  has(word) {
    return this.wordSet.has(normalizeKoreanWord(word));
  }

  validateWord({
    word,
    requiredStart = null,
    usedWords = new Set(),
    exactLength = null,
    forbidOneShot = false
  }) {
    const normalizedWord = normalizeKoreanWord(word);

    if (!normalizedWord) {
      return {
        valid: false,
        code: 'invalid_format',
        reason: '한글/숫자 2글자 이상 단어만 입력할 수 있습니다.'
      };
    }

    if (exactLength && getWordLength(normalizedWord) !== exactLength) {
      return {
        valid: false,
        code: 'invalid_length',
        reason: `이 모드에서는 정확히 ${exactLength}글자 단어만 사용할 수 있습니다.`
      };
    }

    if (requiredStart && getFirstSyllable(normalizedWord) !== requiredStart) {
      return {
        valid: false,
        code: 'wrong_start',
        reason: `**${requiredStart}**(으)로 시작해야 합니다.`
      };
    }

    if (usedWords.has(normalizedWord)) {
      return {
        valid: false,
        code: 'already_used',
        reason: '이미 사용된 단어입니다.'
      };
    }

    if (!this.wordSet.has(normalizedWord)) {
      return {
        valid: false,
        code: 'unknown_word',
        reason: '단어 DB에 없는 단어입니다.'
      };
    }

    if (forbidOneShot && !this.hasAvailableContinuation({
      word: normalizedWord,
      usedWords
    })) {
      return {
        valid: false,
        code: 'one_shot',
        reason: '매너 모드에서는 다음 사람이 이을 수 없는 한방단어를 사용할 수 없습니다.'
      };
    }

    return {
      valid: true,
      word: normalizedWord
    };
  }

  chooseWord({
    requiredStart = null,
    usedWords = new Set(),
    exactLength = null,
    forbidOneShot = false,
    randomInt = defaultRandomInt
  } = {}) {
    const candidates = requiredStart
      ? this.wordsByStart.get(requiredStart) ?? []
      : this.words;
    const unusedCandidates = candidates.filter((word) => {
      if (usedWords.has(word)) return false;
      if (exactLength && getWordLength(word) !== exactLength) return false;
      if (forbidOneShot && !this.hasAvailableContinuation({ word, usedWords })) return false;
      return true;
    });

    if (unusedCandidates.length === 0) return null;
    return unusedCandidates[randomInt(0, unusedCandidates.length - 1)];
  }

  hasAvailableContinuation({ word, usedWords = new Set() }) {
    const normalizedWord = normalizeKoreanWord(word);
    if (!this.wordSet.has(normalizedWord)) return false;

    const nextStart = getLastSyllable(normalizedWord);
    const candidates = this.wordsByStart.get(nextStart) ?? [];

    return candidates.some((candidate) => candidate !== normalizedWord && !usedWords.has(candidate));
  }
}

export class WordChainGame {
  constructor({
    players,
    dictionary,
    rules = {},
    botPlayerId = BOT_WORDCHAIN_PLAYER_ID,
    randomInt = defaultRandomInt
  }) {
    if (!dictionary) {
      throw new Error('끝말잇기 단어 사전이 필요합니다.');
    }

    const normalizedPlayers = normalizePlayers(players);

    if (normalizedPlayers.length < 2) {
      throw new Error('끝말잇기는 희희봇을 포함해 2명 이상이어야 합니다.');
    }

    this.players = normalizedPlayers;
    this.dictionary = dictionary;
    this.rules = {
      ...DEFAULT_RULES,
      ...rules
    };
    this.botPlayerId = botPlayerId;
    this.randomInt = randomInt;
    this.activePlayerIds = new Set(normalizedPlayers.map((player) => player.userId));
    this.usedWords = new Set();
    this.eliminated = [];
    this.acceptedWords = [];
    this.currentTurnIndex = 0;
    this.lastWord = null;
    this.requiredStart = null;
    this.completed = false;
    this.winner = null;
  }

  get currentPlayer() {
    if (this.completed) return null;
    return this.players[this.currentTurnIndex] ?? null;
  }

  get activePlayers() {
    return this.players.filter((player) => this.activePlayerIds.has(player.userId));
  }

  get isComplete() {
    return this.completed;
  }

  isBotPlayer(player = this.currentPlayer) {
    return player?.userId === this.botPlayerId || player?.bot === true;
  }

  submitWord({ userId, word }) {
    const player = this.currentPlayer;

    if (!player) {
      return {
        accepted: false,
        code: 'game_complete',
        reason: '이미 끝난 게임입니다.'
      };
    }

    if (player.userId !== userId) {
      return {
        accepted: false,
        code: 'not_your_turn',
        reason: `지금은 ${player.username}님의 차례입니다.`
      };
    }

    const validation = this.dictionary.validateWord({
      word,
      requiredStart: this.requiredStart,
      usedWords: this.usedWords,
      ...this.rules
    });

    if (!validation.valid) {
      return {
        accepted: false,
        ...validation,
        currentPlayer: player
      };
    }

    return this.acceptWord(validation.word);
  }

  playBotTurn() {
    const player = this.currentPlayer;

    if (!this.isBotPlayer(player)) {
      return {
        played: false,
        code: 'not_bot_turn',
        reason: '현재 차례는 봇이 아닙니다.'
      };
    }

    const word = this.dictionary.chooseWord({
      requiredStart: this.requiredStart,
      usedWords: this.usedWords,
      ...this.rules,
      randomInt: this.randomInt
    });

    if (!word) {
      const elimination = this.eliminateCurrentPlayer('ai_no_word');
      return {
        played: false,
        eliminated: elimination.eliminated,
        completed: elimination.completed,
        winner: elimination.winner,
        reason: this.requiredStart
          ? `**${this.requiredStart}**(으)로 시작하는 단어를 찾지 못했습니다.`
          : '사용할 단어를 찾지 못했습니다.'
      };
    }

    return {
      played: true,
      ...this.acceptWord(word)
    };
  }

  acceptWord(word) {
    const player = this.currentPlayer;
    const normalizedWord = normalizeKoreanWord(word);

    this.usedWords.add(normalizedWord);
    this.acceptedWords.push({
      player,
      word: normalizedWord
    });
    this.lastWord = normalizedWord;
    this.requiredStart = getLastSyllable(normalizedWord);
    this.advanceTurn();

    return {
      accepted: true,
      player,
      word: normalizedWord,
      nextRequiredStart: this.requiredStart,
      nextPlayer: this.currentPlayer,
      completed: this.completed,
      winner: this.winner
    };
  }

  eliminateCurrentPlayer(reason = 'timeout') {
    const player = this.currentPlayer;

    if (!player) {
      return {
        eliminated: null,
        completed: true,
        winner: this.winner
      };
    }

    this.activePlayerIds.delete(player.userId);
    const elimination = {
      player,
      reason,
      order: this.eliminated.length + 1
    };
    this.eliminated.push(elimination);

    if (this.activePlayerIds.size <= 1) {
      this.completed = true;
      this.winner = this.activePlayers[0] ?? null;
      return {
        eliminated: elimination,
        completed: true,
        winner: this.winner
      };
    }

    this.advanceTurn();

    return {
      eliminated: elimination,
      completed: false,
      winner: null,
      nextPlayer: this.currentPlayer
    };
  }

  getHumanFinishOrder() {
    const eliminatedHumans = this.eliminated
      .map((entry) => entry.player)
      .filter((player) => !this.isBotPlayer(player));
    const remainingHumans = this.activePlayers.filter((player) => !this.isBotPlayer(player));

    return [...eliminatedHumans, ...remainingHumans].map(({ userId, username }) => ({
      userId,
      username
    }));
  }

  advanceTurn() {
    if (this.activePlayerIds.size <= 1) {
      this.completed = true;
      this.winner = this.activePlayers[0] ?? null;
      return this.currentPlayer;
    }

    for (let offset = 1; offset <= this.players.length; offset += 1) {
      const nextIndex = (this.currentTurnIndex + offset) % this.players.length;
      const nextPlayer = this.players[nextIndex];

      if (this.activePlayerIds.has(nextPlayer.userId)) {
        this.currentTurnIndex = nextIndex;
        return nextPlayer;
      }
    }

    this.completed = true;
    this.winner = null;
    return null;
  }
}

export function createWordChainPlayers(humans, {
  botPlayerId = BOT_WORDCHAIN_PLAYER_ID,
  botUsername = BOT_WORDCHAIN_PLAYER_NAME
} = {}) {
  const uniqueHumans = normalizePlayers(humans.filter((player) => !player.bot));

  return [
    ...uniqueHumans,
    {
      userId: botPlayerId,
      username: botUsername,
      bot: true
    }
  ];
}

export function normalizeKoreanWord(input) {
  const normalized = String(input ?? '')
    .normalize('NFC')
    .trim()
    .replace(/^[^가-힣ㄱ-ㅎㅏ-ㅣ0-9]+|[^가-힣ㄱ-ㅎㅏ-ㅣ0-9]+$/gu, '');

  if (!/^[가-힣ㄱ-ㅎㅏ-ㅣ0-9]{2,50}$/u.test(normalized)) return '';
  return normalized;
}

export function getFirstSyllable(word) {
  return [...word][0] ?? '';
}

export function getLastSyllable(word) {
  const syllables = [...word];
  return syllables[syllables.length - 1] ?? '';
}

export function getWordLength(word) {
  return [...word].length;
}

function normalizePlayers(players) {
  if (!Array.isArray(players)) {
    throw new Error('끝말잇기 참가자 목록이 필요합니다.');
  }

  const uniquePlayers = new Map();

  for (const player of players) {
    if (!player?.userId) {
      throw new Error('끝말잇기 참가자 userId가 필요합니다.');
    }

    if (!uniquePlayers.has(player.userId)) {
      uniquePlayers.set(player.userId, {
        userId: player.userId,
        username: player.username || 'Unknown',
        bot: player.bot === true
      });
    }
  }

  return [...uniquePlayers.values()];
}

function defaultRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
