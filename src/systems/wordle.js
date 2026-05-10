import { readFileSync } from 'node:fs';

const DAY_MS = 24 * 60 * 60 * 1000;
export const WORDLE_DAY_OFFSET_MS = 9 * 60 * 60 * 1000;
export const WORDLE_MAX_ATTEMPTS = 6;

export const WORDLE_WORDS = Object.freeze([
  word('apple', '사과'),
  word('bread', '빵'),
  word('chair', '의자'),
  word('dream', '꿈; 바라던 일'),
  word('earth', '지구; 흙'),
  word('flame', '불꽃'),
  word('grape', '포도'),
  word('heart', '심장; 마음'),
  word('ivory', '상아; 아이보리색'),
  word('jelly', '젤리'),
  word('knife', '칼'),
  word('lemon', '레몬'),
  word('magic', '마법'),
  word('night', '밤'),
  word('ocean', '바다; 대양'),
  word('piano', '피아노'),
  word('queen', '여왕'),
  word('river', '강'),
  word('stone', '돌; 석재'),
  word('tiger', '호랑이'),
  word('union', '연합; 조합'),
  word('voice', '목소리'),
  word('water', '물'),
  word('youth', '젊음; 청년기'),
  word('zebra', '얼룩말'),
  word('angle', '각도; 관점'),
  word('beach', '해변'),
  word('cloud', '구름'),
  word('dance', '춤; 춤추다'),
  word('eagle', '독수리'),
  word('fairy', '요정'),
  word('giant', '거인; 거대한'),
  word('honey', '꿀'),
  word('image', '이미지; 형상'),
  word('jewel', '보석'),
  word('kneel', '무릎을 꿇다'),
  word('light', '빛; 가벼운'),
  word('money', '돈'),
  word('noble', '고귀한'),
  word('plant', '식물; 심다'),
  word('quiet', '조용한'),
  word('royal', '왕실의'),
  word('smile', '미소; 웃다'),
  word('train', '기차; 훈련하다'),
  word('uncle', '삼촌; 아저씨'),
  word('value', '가치'),
  word('whale', '고래'),
  word('xenon', '제논(원소)'),
  word('yield', '산출하다; 양보하다'),
  word('candy', '사탕'),
  word('brave', '용감한'),
  word('craft', '공예; 만들다'),
  word('daily', '매일의'),
  word('event', '사건; 행사'),
  word('faith', '믿음'),
  word('glory', '영광'),
  word('habit', '습관'),
  word('ideal', '이상적인; 이상'),
  word('judge', '판사; 판단하다'),
  word('karma', '업보; 인과'),
  word('lucky', '운이 좋은'),
  word('medal', '메달'),
  word('nurse', '간호사'),
  word('orbit', '궤도'),
  word('peace', '평화'),
  word('quest', '탐구; 임무'),
  word('robot', '로봇'),
  word('sugar', '설탕'),
  word('tower', '탑'),
  word('unity', '통합; 단결'),
  word('vivid', '생생한'),
  word('world', '세계'),
  word('yacht', '요트'),
  word('amber', '호박색; 호박 보석'),
  word('bloom', '꽃이 피다; 꽃'),
  word('charm', '매력; 부적'),
  word('delta', '삼각주; 델타'),
  word('ember', '불씨'),
  word('frost', '서리'),
  word('green', '초록색; 초록의'),
  word('house', '집'),
  word('inner', '안쪽의; 내면의'),
  word('jolly', '쾌활한'),
  word('koala', '코알라'),
  word('lunar', '달의'),
  word('mango', '망고'),
  word('north', '북쪽'),
  word('olive', '올리브'),
  word('pearl', '진주'),
  word('quick', '빠른'),
  word('rhyme', '운율; 운을 맞추다'),
  word('solar', '태양의'),
  word('trust', '신뢰; 믿다'),
  word('urban', '도시의'),
  word('visit', '방문하다; 방문'),
  word('woven', '짜인; 엮인'),
  word('young', '젊은'),
  word('altar', '제단'),
  word('badge', '배지; 휘장'),
  word('crown', '왕관'),
  word('dairy', '유제품의; 유제품 가게'),
  word('elbow', '팔꿈치'),
  word('field', '들판; 분야'),
  word('ghost', '유령'),
  word('hobby', '취미'),
  word('index', '색인; 지표'),
  word('laugh', '웃다; 웃음'),
  word('model', '모형; 모델'),
  word('novel', '소설; 새로운'),
  word('opera', '오페라'),
  word('proud', '자랑스러운'),
  word('ranch', '목장'),
  word('sheep', '양'),
  word('thorn', '가시'),
  word('usher', '안내하다; 안내원'),
  word('vapor', '증기'),
  word('witch', '마녀'),
  word('coral', '산호'),
  word('maple', '단풍나무'),
  word('slate', '석판; 점판암'),
  word('crane', '두루미; 기중기'),
  word('brick', '벽돌'),
  word('flute', '플루트'),
  word('glass', '유리; 잔'),
  word('mount', '산; 올라가다'),
  word('resin', '수지; 송진'),
  word('spice', '향신료'),
  word('trail', '오솔길; 흔적'),
  word('azure', '하늘색'),
  word('basin', '대야; 분지'),
  word('cider', '사과주; 사과 음료'),
  word('dough', '반죽'),
  word('elder', '나이가 많은 사람; 연장자'),
  word('fiber', '섬유'),
  word('grace', '우아함; 은혜'),
  word('humid', '습한'),
  word('inlet', '작은 만; 주입구'),
  word('joker', '농담꾼; 조커'),
  word('kayak', '카약'),
  word('lotus', '연꽃'),
  word('mimic', '흉내 내다'),
  word('nylon', '나일론'),
  word('oxide', '산화물'),
  word('pouch', '작은 주머니'),
  word('quilt', '누비이불'),
  word('raven', '까마귀'),
  word('saint', '성인; 성자'),
  word('tempo', '박자; 빠르기'),
  word('umbra', '그림자; 본영'),
  word('viper', '독사'),
  word('waltz', '왈츠'),
  word('yeast', '효모'),
  word('zesty', '상큼한; 활기찬')
]);

const WORDLE_EXTRA_GUESSES = Object.freeze([
  'adieu', 'aisle', 'alien', 'alone', 'arise', 'audio', 'baker', 'blaze', 'blush', 'brain',
  'brand', 'break', 'bride', 'bring', 'broad', 'brown', 'cabin', 'camel', 'cause', 'chase',
  'cheap', 'chess', 'chill', 'climb', 'clone', 'close', 'coast', 'count', 'cover', 'cream',
  'creek', 'crime', 'cross', 'crowd', 'cycle', 'demon', 'depth', 'diary', 'diner', 'dirty',
  'doubt', 'draft', 'drain', 'drive', 'eager', 'early', 'empty', 'entry', 'fable', 'faint',
  'feast', 'fence', 'fever', 'final', 'first', 'floor', 'focus', 'force', 'fresh', 'front',
  'fruit', 'ghost', 'globe', 'grain', 'grand', 'grant', 'grass', 'great', 'grind', 'group',
  'guard', 'guest', 'guide', 'happy', 'heavy', 'hinge', 'honor', 'horse', 'human', 'humor',
  'jumpy', 'large', 'later', 'learn', 'least', 'level', 'local', 'lodge', 'logic', 'loose',
  'lover', 'major', 'maker', 'march', 'match', 'metal', 'miner', 'minor', 'movie', 'music',
  'nerve', 'noise', 'panel', 'party', 'pilot', 'place', 'plain', 'plane', 'point', 'power',
  'press', 'price', 'pride', 'prime', 'print', 'proof', 'raise', 'reach', 'ready', 'right',
  'round', 'scale', 'score', 'serve', 'share', 'sharp', 'shift', 'shine', 'shirt', 'shock',
  'short', 'sight', 'skill', 'sleep', 'slice', 'smart', 'sound', 'space', 'speak', 'speed',
  'spend', 'sport', 'stack', 'stage', 'stand', 'start', 'steam', 'stick', 'storm', 'story',
  'sweet', 'table', 'taste', 'teach', 'thing', 'think', 'throw', 'tight', 'touch', 'trace',
  'track', 'trade', 'trial', 'truth', 'under', 'upper', 'vital', 'watch', 'white', 'whole',
  'woman', 'write'
]);

export class WordleService {
  constructor(store, options = {}) {
    this.store = store;
    this.words = normalizeWordEntries(options.words ?? WORDLE_WORDS);
    this.maxAttempts = normalizePositiveInteger(options.maxAttempts ?? WORDLE_MAX_ATTEMPTS, '최대 시도 횟수');
    this.dayOffsetMs = Number.isFinite(options.dayOffsetMs)
      ? Math.trunc(options.dayOffsetMs)
      : WORDLE_DAY_OFFSET_MS;
    this.selectWordIndex = options.selectWordIndex ?? selectDailyWordIndex;
    this.acceptedGuesses = buildAcceptedGuessSet({
      words: this.words,
      acceptedGuesses: options.acceptedGuesses ?? loadDefaultAcceptedGuesses()
    });
  }

  getDailyPuzzle({ now = Date.now() } = {}) {
    const day = getWordleDayInfo(now, this.dayOffsetMs);
    const index = normalizeWordIndex(
      this.selectWordIndex({
        dateKey: day.dateKey,
        dayIndex: day.dayIndex,
        words: this.words
      }),
      this.words.length
    );
    const entry = this.words[index];

    return {
      ...day,
      index,
      word: entry.word,
      entry: { ...entry },
      maxAttempts: this.maxAttempts
    };
  }

  async getPlayerStatus({ userId, now = Date.now() }) {
    return this.store.update((data) => {
      const state = ensureWordleState(data);
      const daily = this.getDailyPuzzle({ now });
      const session = getSessionForUser(state, daily.dateKey, userId);

      return {
        daily,
        session: cloneSession(session),
        maxAttempts: this.maxAttempts
      };
    });
  }

  async submitGuess({ guildId, userId, username = 'Unknown', guess, now = Date.now() }) {
    const normalizedGuess = normalizeGuess(guess);

    return this.store.update((data) => {
      const state = ensureWordleState(data);
      const daily = this.getDailyPuzzle({ now });
      const session = getOrCreateSession(state, daily.dateKey, userId, username, now);

      session.username = username || session.username || 'Unknown';

      if (session.status === 'solved') {
        return {
          accepted: false,
          blocked: 'solved',
          daily,
          rank: getUserRank(state, guildId, daily.dateKey, userId),
          session: cloneSession(session),
          maxAttempts: this.maxAttempts
        };
      }

      if (session.status === 'failed') {
        return {
          accepted: false,
          blocked: 'failed',
          daily,
          session: cloneSession(session),
          maxAttempts: this.maxAttempts
        };
      }

      if (!normalizedGuess.ok) {
        return {
          accepted: false,
          invalid: normalizedGuess.reason,
          daily,
          session: cloneSession(session),
          maxAttempts: this.maxAttempts
        };
      }

      if (!this.acceptedGuesses.has(normalizedGuess.word)) {
        return {
          accepted: false,
          invalid: 'not_in_dictionary',
          daily,
          session: cloneSession(session),
          maxAttempts: this.maxAttempts
        };
      }

      const feedback = scoreWordleGuess(normalizedGuess.word, daily.word);
      const attempt = {
        word: normalizedGuess.word,
        feedback,
        guessedAt: now
      };
      session.guesses.push(attempt);
      session.lastGuessAt = now;

      if (normalizedGuess.word === daily.word) {
        session.status = 'solved';
        session.completedAt = now;
        session.elapsedMs = Math.max(0, now - daily.dayStartMs);
        const rank = recordSolve(state, {
          guildId,
          dateKey: daily.dateKey,
          userId,
          username: session.username,
          attempts: session.guesses.length,
          completedAt: session.completedAt,
          elapsedMs: session.elapsedMs
        });

        return {
          accepted: true,
          solved: true,
          newlySolved: true,
          failed: false,
          daily,
          rank,
          attempt: cloneAttempt(attempt),
          session: cloneSession(session),
          maxAttempts: this.maxAttempts
        };
      }

      const failed = session.guesses.length >= this.maxAttempts;
      if (failed) {
        session.status = 'failed';
        session.completedAt = now;
        session.elapsedMs = Math.max(0, now - daily.dayStartMs);
      }

      return {
        accepted: true,
        solved: false,
        newlySolved: false,
        failed,
        daily,
        rank: null,
        attempt: cloneAttempt(attempt),
        session: cloneSession(session),
        maxAttempts: this.maxAttempts
      };
    });
  }

  async listTodayRankings({ guildId, now = Date.now(), limit = 10 }) {
    const normalizedLimit = Math.min(25, normalizePositiveInteger(limit, '표시 개수'));

    return this.store.update((data) => {
      const state = ensureWordleState(data);
      const daily = this.getDailyPuzzle({ now });
      const entries = getSortedSolves(state, guildId, daily.dateKey)
        .slice(0, normalizedLimit)
        .map((entry, index) => ({
          rank: index + 1,
          ...cloneSolveEntry(entry)
        }));

      return {
        daily,
        entries,
        total: getSortedSolves(state, guildId, daily.dateKey).length,
        limit: normalizedLimit
      };
    });
  }
}

export function scoreWordleGuess(guess, answer) {
  const normalizedGuess = normalizeGuess(guess);
  const normalizedAnswer = normalizeGuess(answer);

  if (!normalizedGuess.ok || !normalizedAnswer.ok) {
    throw new Error('워들 채점은 5글자 영어 단어만 사용할 수 있습니다.');
  }

  const guessLetters = [...normalizedGuess.word];
  const answerLetters = [...normalizedAnswer.word];
  const feedback = Array.from({ length: 5 }, () => 'absent');
  const remaining = new Map();

  for (let index = 0; index < answerLetters.length; index += 1) {
    if (guessLetters[index] === answerLetters[index]) {
      feedback[index] = 'correct';
      continue;
    }

    remaining.set(answerLetters[index], (remaining.get(answerLetters[index]) ?? 0) + 1);
  }

  for (let index = 0; index < guessLetters.length; index += 1) {
    if (feedback[index] === 'correct') continue;

    const letter = guessLetters[index];
    const count = remaining.get(letter) ?? 0;
    if (count <= 0) continue;

    feedback[index] = 'present';
    remaining.set(letter, count - 1);
  }

  return feedback;
}

export function getWordleDayInfo(now = Date.now(), dayOffsetMs = WORDLE_DAY_OFFSET_MS) {
  const shifted = now + dayOffsetMs;
  const dayIndex = Math.floor(shifted / DAY_MS);
  const dayStartMs = dayIndex * DAY_MS - dayOffsetMs;
  const nextResetAt = dayStartMs + DAY_MS;
  const dateKey = new Date(dayStartMs + dayOffsetMs).toISOString().slice(0, 10);

  return {
    dateKey,
    dayIndex,
    dayStartMs,
    nextResetAt,
    elapsedMs: Math.max(0, now - dayStartMs),
    remainingMs: Math.max(0, nextResetAt - now)
  };
}

function word(wordText, meaning) {
  return Object.freeze({
    word: wordText,
    meaning
  });
}

function normalizeWordEntries(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('워들 단어 목록이 비어 있습니다.');
  }

  const seen = new Set();
  return entries.map((entry) => {
    const normalized = normalizeGuess(entry?.word);
    if (!normalized.ok) {
      throw new Error(`워들 정답 단어는 5글자 영어 단어여야 합니다: ${entry?.word ?? '<empty>'}`);
    }
    if (seen.has(normalized.word)) {
      throw new Error(`워들 정답 단어가 중복되었습니다: ${normalized.word}`);
    }
    seen.add(normalized.word);

    return Object.freeze({
      word: normalized.word,
      meaning: String(entry.meaning || '뜻 정보 없음').trim()
    });
  });
}

function buildAcceptedGuessSet({ words, acceptedGuesses }) {
  const accepted = new Set(words.map((entry) => entry.word));

  for (const guess of acceptedGuesses ?? []) {
    const normalized = normalizeGuess(guess);
    if (normalized.ok) accepted.add(normalized.word);
  }

  return accepted;
}

function loadDefaultAcceptedGuesses() {
  try {
    return readFileSync(new URL('../../data/wordle-allowed-guesses.txt', import.meta.url), 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));
  } catch {
    return WORDLE_EXTRA_GUESSES;
  }
}

function normalizeGuess(guess) {
  const wordText = String(guess ?? '').trim().toLowerCase();

  if (!/^[a-z]+$/.test(wordText)) {
    return {
      ok: false,
      reason: 'only_letters'
    };
  }

  if (wordText.length !== 5) {
    return {
      ok: false,
      reason: 'length'
    };
  }

  return {
    ok: true,
    word: wordText
  };
}

function selectDailyWordIndex({ dateKey, dayIndex, words }) {
  const hash = hashString(`heeheebot-wordle-v1:${dateKey}:${dayIndex}`);
  return hash % words.length;
}

function hashString(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

function normalizeWordIndex(index, size) {
  const number = Number(index);
  if (!Number.isFinite(number) || size <= 0) return 0;
  return Math.abs(Math.trunc(number)) % size;
}

function ensureWordleState(data) {
  if (!data.wordle || typeof data.wordle !== 'object' || Array.isArray(data.wordle)) {
    data.wordle = {};
  }

  if (!data.wordle.sessions || typeof data.wordle.sessions !== 'object' || Array.isArray(data.wordle.sessions)) {
    data.wordle.sessions = {};
  }

  if (!data.wordle.scoreboards || typeof data.wordle.scoreboards !== 'object' || Array.isArray(data.wordle.scoreboards)) {
    data.wordle.scoreboards = {};
  }

  return data.wordle;
}

function getOrCreateSession(state, dateKey, userId, username, now) {
  const sessions = getSessionsForDay(state, dateKey);
  const key = normalizeUserId(userId);

  if (!sessions[key] || typeof sessions[key] !== 'object' || Array.isArray(sessions[key])) {
    sessions[key] = {
      userId: key,
      username: username || 'Unknown',
      status: 'playing',
      guesses: [],
      startedAt: now,
      lastGuessAt: 0,
      completedAt: 0,
      elapsedMs: 0
    };
  }

  sessions[key] = normalizeSession(sessions[key], key, username, now);
  return sessions[key];
}

function getSessionForUser(state, dateKey, userId) {
  const sessions = state.sessions?.[dateKey];
  if (!sessions || typeof sessions !== 'object' || Array.isArray(sessions)) return null;

  const key = normalizeUserId(userId);
  const session = sessions[key];
  if (!session || typeof session !== 'object' || Array.isArray(session)) return null;

  return normalizeSession(session, key, session.username, Date.now());
}

function getSessionsForDay(state, dateKey) {
  if (!state.sessions[dateKey] || typeof state.sessions[dateKey] !== 'object' || Array.isArray(state.sessions[dateKey])) {
    state.sessions[dateKey] = {};
  }

  return state.sessions[dateKey];
}

function normalizeSession(session, userId, username, now) {
  const status = ['playing', 'solved', 'failed'].includes(session.status)
    ? session.status
    : 'playing';
  session.userId = normalizeUserId(session.userId || userId);
  session.username = String(username || session.username || 'Unknown');
  session.status = status;
  session.guesses = Array.isArray(session.guesses)
    ? session.guesses.map(normalizeAttempt).filter(Boolean)
    : [];
  session.startedAt = normalizeNonNegativeStoredInteger(session.startedAt, now);
  session.lastGuessAt = normalizeNonNegativeStoredInteger(session.lastGuessAt, 0);
  session.completedAt = normalizeNonNegativeStoredInteger(session.completedAt, 0);
  session.elapsedMs = normalizeNonNegativeStoredInteger(session.elapsedMs, 0);
  return session;
}

function normalizeAttempt(attempt) {
  const normalized = normalizeGuess(attempt?.word);
  if (!normalized.ok) return null;

  const feedback = Array.isArray(attempt.feedback) && attempt.feedback.length === 5
    ? attempt.feedback.map((mark) => ['correct', 'present', 'absent'].includes(mark) ? mark : 'absent')
    : ['absent', 'absent', 'absent', 'absent', 'absent'];

  return {
    word: normalized.word,
    feedback,
    guessedAt: normalizeNonNegativeStoredInteger(attempt.guessedAt, 0)
  };
}

function recordSolve(state, {
  guildId,
  dateKey,
  userId,
  username,
  attempts,
  completedAt,
  elapsedMs
}) {
  const board = getScoreboardForDay(state, guildId, dateKey);
  const key = normalizeUserId(userId);

  if (!board.solves[key]) {
    board.solves[key] = {
      userId: key,
      username: username || 'Unknown',
      attempts: normalizePositiveInteger(attempts, '시도 횟수'),
      completedAt: normalizeNonNegativeStoredInteger(completedAt, 0),
      elapsedMs: normalizeNonNegativeStoredInteger(elapsedMs, 0)
    };
  } else {
    board.solves[key].username = username || board.solves[key].username || 'Unknown';
  }

  return getUserRank(state, guildId, dateKey, userId);
}

function getUserRank(state, guildId, dateKey, userId) {
  const sorted = getSortedSolves(state, guildId, dateKey);
  const key = normalizeUserId(userId);
  const index = sorted.findIndex((entry) => entry.userId === key);

  if (index < 0) return null;

  return {
    rank: index + 1,
    total: sorted.length,
    entry: cloneSolveEntry(sorted[index])
  };
}

function getSortedSolves(state, guildId, dateKey) {
  const board = getScoreboardForDay(state, guildId, dateKey);

  return Object.values(board.solves)
    .map(normalizeSolveEntry)
    .filter(Boolean)
    .sort((a, b) => {
      if (a.attempts !== b.attempts) return a.attempts - b.attempts;
      if (a.elapsedMs !== b.elapsedMs) return a.elapsedMs - b.elapsedMs;
      return a.completedAt - b.completedAt;
    });
}

function getScoreboardForDay(state, guildId, dateKey) {
  const normalizedGuildId = normalizeGuildId(guildId);

  if (!state.scoreboards[normalizedGuildId]
    || typeof state.scoreboards[normalizedGuildId] !== 'object'
    || Array.isArray(state.scoreboards[normalizedGuildId])) {
    state.scoreboards[normalizedGuildId] = {};
  }

  const guildBoards = state.scoreboards[normalizedGuildId];
  if (!guildBoards[dateKey] || typeof guildBoards[dateKey] !== 'object' || Array.isArray(guildBoards[dateKey])) {
    guildBoards[dateKey] = { solves: {} };
  }

  if (!guildBoards[dateKey].solves
    || typeof guildBoards[dateKey].solves !== 'object'
    || Array.isArray(guildBoards[dateKey].solves)) {
    guildBoards[dateKey].solves = {};
  }

  return guildBoards[dateKey];
}

function normalizeSolveEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;

  return {
    userId: normalizeUserId(entry.userId),
    username: String(entry.username || 'Unknown'),
    attempts: normalizePositiveInteger(entry.attempts || 1, '시도 횟수'),
    completedAt: normalizeNonNegativeStoredInteger(entry.completedAt, 0),
    elapsedMs: normalizeNonNegativeStoredInteger(entry.elapsedMs, 0)
  };
}

function cloneSession(session) {
  if (!session) return null;

  return {
    userId: session.userId,
    username: session.username,
    status: session.status,
    guesses: session.guesses.map(cloneAttempt),
    startedAt: session.startedAt,
    lastGuessAt: session.lastGuessAt,
    completedAt: session.completedAt,
    elapsedMs: session.elapsedMs
  };
}

function cloneAttempt(attempt) {
  return {
    word: attempt.word,
    feedback: [...attempt.feedback],
    guessedAt: attempt.guessedAt
  };
}

function cloneSolveEntry(entry) {
  return {
    userId: entry.userId,
    username: entry.username,
    attempts: entry.attempts,
    completedAt: entry.completedAt,
    elapsedMs: entry.elapsedMs
  };
}

function normalizeGuildId(guildId) {
  return String(guildId ?? 'global').trim() || 'global';
}

function normalizeUserId(userId) {
  const normalized = String(userId ?? '').trim();
  if (!normalized) throw new Error('워들 유저 ID가 필요합니다.');
  return normalized;
}

function normalizePositiveInteger(value, label) {
  const normalized = Number(value);

  if (!Number.isSafeInteger(normalized) || normalized <= 0) {
    throw new Error(`${label}은 1 이상의 정수여야 합니다.`);
  }

  return normalized;
}

function normalizeNonNegativeStoredInteger(value, fallback) {
  const normalized = Number(value);
  return Number.isSafeInteger(normalized) && normalized >= 0
    ? normalized
    : fallback;
}
