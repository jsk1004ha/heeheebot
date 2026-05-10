export const NUMBER_BASEBALL_DIGIT_COUNT = 4;
export const NUMBER_BASEBALL_MAX_ATTEMPTS = 8;

export class NumberBaseballService {
  constructor(store, options = {}) {
    this.store = store;
    this.digitCount = normalizeDigitCount(options.digitCount ?? NUMBER_BASEBALL_DIGIT_COUNT);
    this.maxAttempts = normalizePositiveInteger(options.maxAttempts ?? NUMBER_BASEBALL_MAX_ATTEMPTS, '최대 시도 횟수');
    this.randomSecret = options.randomSecret ?? createRandomSecret;
  }

  async getPlayerStatus({ guildId, userId }) {
    return this.store.update((data) => {
      const state = ensureNumberBaseballState(data);
      const slot = getSlotForUser(state, guildId, userId);
      const session = slot.current
        ? normalizeSession(slot.current, normalizeGuildId(guildId), normalizeUserId(userId), slot.current.username, Date.now(), this)
        : null;

      return {
        session: cloneSession(session),
        lastSession: cloneSession(slot.last ? normalizeSession(slot.last, normalizeGuildId(guildId), normalizeUserId(userId), slot.last.username, Date.now(), this) : null),
        digitCount: this.digitCount,
        maxAttempts: this.maxAttempts
      };
    });
  }

  async submitGuess({ guildId, userId, username = 'Unknown', guess, now = Date.now() }) {
    const normalizedGuess = normalizeGuess(guess, this.digitCount);

    return this.store.update((data) => {
      const state = ensureNumberBaseballState(data);
      const slot = getSlotForUser(state, guildId, userId);
      const normalizedGuildId = normalizeGuildId(guildId);
      const normalizedUserId = normalizeUserId(userId);

      if (!normalizedGuess.ok) {
        const currentSession = slot.current
          ? normalizeSession(slot.current, normalizedGuildId, normalizedUserId, username, now, this)
          : null;

        return {
          accepted: false,
          invalid: normalizedGuess.reason,
          startedNewGame: false,
          session: cloneSession(currentSession),
          digitCount: this.digitCount,
          maxAttempts: this.maxAttempts
        };
      }

      const session = getOrCreateCurrentSession({
        slot,
        guildId: normalizedGuildId,
        userId: normalizedUserId,
        username,
        now,
        service: this
      });

      session.username = username || session.username || 'Unknown';

      const score = scoreNumberBaseballGuess(normalizedGuess.number, session.answer);
      const attempt = {
        number: normalizedGuess.number,
        strikes: score.strikes,
        balls: score.balls,
        guessedAt: now
      };
      session.guesses.push(attempt);
      session.lastGuessAt = now;

      if (score.strikes === this.digitCount) {
        session.status = 'solved';
        session.completedAt = now;
        session.elapsedMs = Math.max(0, now - session.startedAt);
        slot.last = cloneSession(session);
        slot.current = null;

        return {
          accepted: true,
          solved: true,
          newlySolved: true,
          failed: false,
          startedNewGame: session.guesses.length === 1,
          attempt: cloneAttempt(attempt),
          session: cloneSession(session),
          digitCount: this.digitCount,
          maxAttempts: this.maxAttempts
        };
      }

      const failed = session.guesses.length >= this.maxAttempts;
      if (failed) {
        session.status = 'failed';
        session.completedAt = now;
        session.elapsedMs = Math.max(0, now - session.startedAt);
        slot.last = cloneSession(session);
        slot.current = null;
      }

      return {
        accepted: true,
        solved: false,
        newlySolved: false,
        failed,
        newlyFailed: failed,
        startedNewGame: session.guesses.length === 1,
        attempt: cloneAttempt(attempt),
        session: cloneSession(session),
        digitCount: this.digitCount,
        maxAttempts: this.maxAttempts
      };
    });
  }
}

export function scoreNumberBaseballGuess(guess, answer) {
  const normalizedGuess = normalizeSecret(guess, String(answer ?? '').length || NUMBER_BASEBALL_DIGIT_COUNT, '추측 숫자');
  const normalizedAnswer = normalizeSecret(answer, normalizedGuess.length, '정답 숫자');
  let strikes = 0;
  let balls = 0;

  for (let index = 0; index < normalizedGuess.length; index += 1) {
    const digit = normalizedGuess[index];
    if (digit === normalizedAnswer[index]) {
      strikes += 1;
    } else if (normalizedAnswer.includes(digit)) {
      balls += 1;
    }
  }

  return {
    strikes,
    balls,
    outs: strikes === 0 && balls === 0 ? 1 : 0
  };
}

function ensureNumberBaseballState(data) {
  if (!data.numberBaseball || typeof data.numberBaseball !== 'object' || Array.isArray(data.numberBaseball)) {
    data.numberBaseball = {};
  }

  if (!data.numberBaseball.players
    || typeof data.numberBaseball.players !== 'object'
    || Array.isArray(data.numberBaseball.players)) {
    data.numberBaseball.players = {};
  }

  return data.numberBaseball;
}

function getSlotForUser(state, guildId, userId) {
  const key = createPlayerKey(guildId, userId);
  if (!state.players[key] || typeof state.players[key] !== 'object' || Array.isArray(state.players[key])) {
    state.players[key] = {
      current: null,
      last: null,
      gamesStarted: 0
    };
  }

  const slot = state.players[key];
  slot.current = slot.current && typeof slot.current === 'object' && !Array.isArray(slot.current)
    ? slot.current
    : null;
  slot.last = slot.last && typeof slot.last === 'object' && !Array.isArray(slot.last)
    ? slot.last
    : null;
  slot.gamesStarted = normalizeNonNegativeStoredInteger(slot.gamesStarted, 0);
  return slot;
}

function getOrCreateCurrentSession({ slot, guildId, userId, username, now, service }) {
  if (slot.current) {
    slot.current = normalizeSession(slot.current, guildId, userId, username, now, service);
    return slot.current;
  }

  slot.gamesStarted += 1;
  slot.current = createSession({
    guildId,
    userId,
    username,
    now,
    gameNumber: slot.gamesStarted,
    answer: service.randomSecret({
      guildId,
      userId,
      username,
      digitCount: service.digitCount,
      gameNumber: slot.gamesStarted,
      now
    }),
    service
  });
  return slot.current;
}

function createSession({ guildId, userId, username, now, gameNumber, answer, service }) {
  return normalizeSession({
    id: `nb-${now}-${gameNumber}`,
    guildId,
    userId,
    username: username || 'Unknown',
    gameNumber,
    answer,
    status: 'playing',
    guesses: [],
    startedAt: now,
    lastGuessAt: 0,
    completedAt: 0,
    elapsedMs: 0
  }, guildId, userId, username, now, service);
}

function normalizeSession(session, guildId, userId, username, now, service) {
  const status = ['playing', 'solved', 'failed'].includes(session.status)
    ? session.status
    : 'playing';
  session.id = String(session.id || `nb-${session.startedAt || now}`);
  session.guildId = normalizeGuildId(session.guildId || guildId);
  session.userId = normalizeUserId(session.userId || userId);
  session.username = String(username || session.username || 'Unknown');
  session.gameNumber = normalizeNonNegativeStoredInteger(session.gameNumber, 0);
  session.answer = normalizeSecret(session.answer, service.digitCount, '숫자야구 정답');
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
  const number = String(attempt?.number ?? '').trim();
  if (!/^\d+$/.test(number)) return null;

  return {
    number,
    strikes: clampStoredInteger(attempt.strikes, 0, number.length),
    balls: clampStoredInteger(attempt.balls, 0, number.length),
    guessedAt: normalizeNonNegativeStoredInteger(attempt.guessedAt, 0)
  };
}

function normalizeGuess(guess, digitCount) {
  const number = String(guess ?? '').trim().replace(/[\s,._-]+/g, '');

  if (!/^\d+$/.test(number)) {
    return {
      ok: false,
      reason: 'only_digits'
    };
  }

  if (number.length !== digitCount) {
    return {
      ok: false,
      reason: 'length'
    };
  }

  if (new Set([...number]).size !== number.length) {
    return {
      ok: false,
      reason: 'duplicate_digits'
    };
  }

  return {
    ok: true,
    number
  };
}

function normalizeSecret(value, digitCount, label) {
  const normalized = normalizeGuess(value, digitCount);
  if (!normalized.ok) {
    throw new Error(`${label}은 서로 다른 숫자 ${digitCount}개여야 합니다.`);
  }
  return normalized.number;
}

function createRandomSecret({ digitCount }) {
  const remainingDigits = Array.from({ length: 10 }, (_, index) => String(index));
  const selected = [];

  for (let index = 0; index < digitCount; index += 1) {
    const digitIndex = Math.floor(Math.random() * remainingDigits.length);
    selected.push(remainingDigits.splice(digitIndex, 1)[0]);
  }

  return selected.join('');
}

function normalizeDigitCount(value) {
  const normalized = normalizePositiveInteger(value, '숫자 개수');
  if (normalized > 10) {
    throw new Error('숫자야구 숫자 개수는 10개 이하만 사용할 수 있습니다.');
  }
  return normalized;
}

function normalizePositiveInteger(value, label) {
  const normalized = Number(value);

  if (!Number.isSafeInteger(normalized) || normalized <= 0) {
    throw new Error(`${label}은 1 이상의 정수여야 합니다.`);
  }

  return normalized;
}

function createPlayerKey(guildId, userId) {
  return `${normalizeGuildId(guildId)}:${normalizeUserId(userId)}`;
}

function normalizeGuildId(guildId) {
  return String(guildId ?? 'global').trim() || 'global';
}

function normalizeUserId(userId) {
  const normalized = String(userId ?? '').trim();
  if (!normalized) throw new Error('숫자야구 유저 ID가 필요합니다.');
  return normalized;
}

function normalizeNonNegativeStoredInteger(value, fallback) {
  const normalized = Number(value);
  return Number.isSafeInteger(normalized) && normalized >= 0
    ? normalized
    : fallback;
}

function clampStoredInteger(value, min, max) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized)) return min;
  return Math.min(max, Math.max(min, normalized));
}

function cloneSession(session) {
  if (!session) return null;

  return {
    id: session.id,
    guildId: session.guildId,
    userId: session.userId,
    username: session.username,
    gameNumber: session.gameNumber,
    answer: session.answer,
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
    number: attempt.number,
    strikes: attempt.strikes,
    balls: attempt.balls,
    guessedAt: attempt.guessedAt
  };
}
