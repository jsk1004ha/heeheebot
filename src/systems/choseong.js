import { readFileSync } from 'node:fs';

export const DEFAULT_CHOSEONG_WORDS_PATH = new URL('../../data/choseong-ko.txt', import.meta.url);

export const HANGUL_INITIALS = Object.freeze([
  'ㄱ',
  'ㄲ',
  'ㄴ',
  'ㄷ',
  'ㄸ',
  'ㄹ',
  'ㅁ',
  'ㅂ',
  'ㅃ',
  'ㅅ',
  'ㅆ',
  'ㅇ',
  'ㅈ',
  'ㅉ',
  'ㅊ',
  'ㅋ',
  'ㅌ',
  'ㅍ',
  'ㅎ'
]);

const HANGUL_BASE_CODE = 0xac00;
const HANGUL_END_CODE = 0xd7a3;
const HANGUL_VOWEL_COUNT = 21;
const HANGUL_FINAL_COUNT = 28;
const DEFAULT_INITIAL_LENGTH = 2;
const DEFAULT_MIN_CANDIDATES = 1;

export class KoreanInitialDictionary {
  constructor(words) {
    const uniqueWords = new Set();
    for (const word of words) {
      const normalizedWord = normalizeChoseongWord(word);
      if (normalizedWord) uniqueWords.add(normalizedWord);
    }

    const normalizedWords = [...uniqueWords].sort((a, b) => a.localeCompare(b, 'ko'));

    if (normalizedWords.length === 0) {
      throw new Error('초성게임 단어 목록이 비어 있습니다.');
    }

    this.words = normalizedWords;
    this.wordSet = new Set(normalizedWords);
    this.wordsByInitials = new Map();

    for (const word of normalizedWords) {
      const initials = getInitialConsonants(word);
      const bucket = this.wordsByInitials.get(initials) ?? [];
      bucket.push(word);
      this.wordsByInitials.set(initials, bucket);
    }
  }

  static fromFile(path = DEFAULT_CHOSEONG_WORDS_PATH) {
    const source = readFileSync(path, 'utf8');
    return new KoreanInitialDictionary(source.split(/\r?\n/));
  }

  has(word) {
    return this.wordSet.has(normalizeChoseongWord(word));
  }

  validateGuess({ guess, requiredInitials }) {
    const candidate = normalizeHangulGuess(guess);
    const initials = normalizeInitials(requiredInitials);

    if (!initials) {
      return {
        accepted: false,
        code: 'invalid_initials',
        reason: '초성 조건이 올바르지 않습니다.'
      };
    }

    if (!candidate) {
      return {
        accepted: false,
        code: 'invalid_format',
        reason: '한글 2글자 단어만 입력할 수 있습니다.'
      };
    }

    if (getWordLength(candidate) !== 2) {
      return {
        accepted: false,
        code: 'invalid_length',
        reason: '초성게임은 한글 2글자 단어만 입력할 수 있습니다.'
      };
    }

    const word = candidate;
    const guessInitials = getInitialConsonants(word);

    if (!guessInitials.startsWith(initials)) {
      return {
        accepted: false,
        code: 'wrong_initials',
        reason: `**${initials}** 초성으로 시작하는 단어를 입력해야 합니다.`,
        word,
        guessInitials
      };
    }

    if (!this.wordSet.has(word)) {
      return {
        accepted: false,
        code: 'unknown_word',
        reason: '초성게임 단어 DB에 없는 단어입니다.',
        word,
        guessInitials
      };
    }

    return {
      accepted: true,
      word,
      guessInitials,
      requiredInitials: initials
    };
  }

  chooseInitials({
    length = DEFAULT_INITIAL_LENGTH,
    minCandidates = DEFAULT_MIN_CANDIDATES,
    randomInt = defaultRandomInt
  } = {}) {
    const normalizedLength = normalizeInitialLength(length);
    const normalizedMinCandidates = normalizePositiveInteger(minCandidates, DEFAULT_MIN_CANDIDATES);
    const candidates = this.getInitialCandidates({
      length: normalizedLength,
      minCandidates: normalizedMinCandidates
    });

    if (candidates.length === 0) {
      return null;
    }

    const candidate = candidates[randomInt(0, candidates.length - 1)];
    return {
      initials: candidate.initials,
      answerCount: candidate.answerCount,
      length: normalizedLength
    };
  }

  getInitialCandidates({
    length = DEFAULT_INITIAL_LENGTH,
    minCandidates = DEFAULT_MIN_CANDIDATES
  } = {}) {
    const normalizedLength = normalizeInitialLength(length);
    const counts = new Map();

    for (const [initials, words] of this.wordsByInitials) {
      if (initials.length < normalizedLength) continue;

      const prefix = initials.slice(0, normalizedLength);
      counts.set(prefix, (counts.get(prefix) ?? 0) + words.length);
    }

    return [...counts.entries()]
      .filter(([, answerCount]) => answerCount >= minCandidates)
      .map(([initials, answerCount]) => ({ initials, answerCount }))
      .sort((a, b) => a.initials.localeCompare(b.initials, 'ko'));
  }

  findAnswers({ initials, limit = 5 } = {}) {
    const normalizedInitials = normalizeInitials(initials);
    const normalizedLimit = normalizePositiveInteger(limit, 5);

    if (!normalizedInitials) return [];

    const answers = [];
    for (const word of this.words) {
      if (!getInitialConsonants(word).startsWith(normalizedInitials)) continue;
      answers.push(word);
      if (answers.length >= normalizedLimit) break;
    }

    return answers;
  }
}

export class ChoseongGame {
  constructor({
    dictionary,
    initialLength = DEFAULT_INITIAL_LENGTH,
    minCandidates = DEFAULT_MIN_CANDIDATES,
    randomInt = defaultRandomInt
  } = {}) {
    if (!dictionary) {
      throw new Error('초성게임 단어 사전이 필요합니다.');
    }

    const target = dictionary.chooseInitials({
      length: initialLength,
      minCandidates,
      randomInt
    });

    if (!target) {
      throw new Error('조건에 맞는 초성을 만들 수 없습니다.');
    }

    this.dictionary = dictionary;
    this.requiredInitials = target.initials;
    this.answerCount = target.answerCount;
    this.initialLength = target.length;
    this.completed = false;
    this.winner = null;
    this.winningWord = null;
  }

  get isComplete() {
    return this.completed;
  }

  submitGuess({ userId, username = 'Unknown', word }) {
    if (this.completed) {
      return {
        accepted: false,
        code: 'game_complete',
        reason: '이미 끝난 초성게임입니다.'
      };
    }

    const validation = this.dictionary.validateGuess({
      guess: word,
      requiredInitials: this.requiredInitials
    });

    if (!validation.accepted) return validation;

    this.completed = true;
    this.winner = {
      userId,
      username
    };
    this.winningWord = validation.word;

    return {
      ...validation,
      winner: this.winner,
      completed: true
    };
  }

  revealAnswers(limit = 5) {
    return this.dictionary.findAnswers({
      initials: this.requiredInitials,
      limit
    });
  }
}

export function normalizeChoseongWord(input) {
  const normalized = normalizeHangulGuess(input);

  if (getWordLength(normalized) !== 2) return '';
  return normalized;
}

function normalizeHangulGuess(input) {
  const normalized = String(input ?? '')
    .normalize('NFC')
    .trim()
    .replace(/^[^가-힣]+|[^가-힣]+$/gu, '');

  if (!/^[가-힣]+$/u.test(normalized)) return '';
  return normalized;
}

export function getInitialConsonants(word) {
  return [...String(word ?? '').normalize('NFC')]
    .map(getInitialConsonant)
    .join('');
}

export function getInitialConsonant(syllable) {
  const code = syllable.codePointAt(0);

  if (!Number.isInteger(code) || code < HANGUL_BASE_CODE || code > HANGUL_END_CODE) {
    return '';
  }

  const initialIndex = Math.floor((code - HANGUL_BASE_CODE) / (HANGUL_VOWEL_COUNT * HANGUL_FINAL_COUNT));
  return HANGUL_INITIALS[initialIndex] ?? '';
}

export function normalizeInitials(input) {
  const initials = String(input ?? '').normalize('NFC').replace(/\s+/g, '');
  if (!/^[ㄱ-ㅎ]{2,6}$/u.test(initials)) return '';
  return initials;
}

function normalizeInitialLength(length) {
  const normalized = Math.trunc(Number(length));
  if (!Number.isSafeInteger(normalized) || normalized < 2 || normalized > 6) {
    return DEFAULT_INITIAL_LENGTH;
  }

  return normalized;
}

function getWordLength(word) {
  return [...String(word ?? '')].length;
}

function normalizePositiveInteger(value, fallback) {
  const normalized = Math.trunc(Number(value));
  if (!Number.isSafeInteger(normalized) || normalized <= 0) return fallback;
  return normalized;
}

function defaultRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
