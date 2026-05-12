const DEFAULT_SETTINGS = Object.freeze({
  logChannelId: null,
  bannedWords: [],
  warningPunishment: null,
  autoSpamBan: Object.freeze({
    enabled: true,
    windowMs: 5_000,
    messageLimit: 8,
    duplicateLimit: 5,
    userSlowmodeDurationMs: 5 * 60 * 1000,
    banAfterOffenses: null,
    offenseResetMs: 5 * 60 * 1000
  })
});

const LEGACY_STRICT_AUTO_SPAM_BAN_SETTINGS = Object.freeze({
  enabled: true,
  windowMs: 5_000,
  messageLimit: 5,
  duplicateLimit: 3,
  userSlowmodeDurationMs: 10 * 60 * 1000,
  banAfterOffenses: 2,
  offenseResetMs: 10 * 60 * 1000
});

const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000;

export class ModerationService {
  constructor(store) {
    this.store = store;
  }

  async getSettings(guildId) {
    const data = await this.store.load();
    const moderation = getOrCreateModeration(data, guildId);
    return cloneSettings(moderation.settings);
  }

  async setLogChannel(guildId, channelId) {
    return this.store.update((data) => {
      const moderation = getOrCreateModeration(data, guildId);
      moderation.settings.logChannelId = channelId;
      return cloneSettings(moderation.settings);
    });
  }

  async addBannedWord(guildId, word) {
    const normalized = normalizeWord(word);

    if (!normalized) {
      throw new Error('금칙어는 비어 있을 수 없습니다.');
    }

    return this.store.update((data) => {
      const moderation = getOrCreateModeration(data, guildId);
      const exists = moderation.settings.bannedWords.some((item) => normalizeWord(item) === normalized);

      if (!exists) {
        moderation.settings.bannedWords.push(word.trim());
      }

      return cloneSettings(moderation.settings);
    });
  }

  async setWarningPunishment(guildId, threshold, action, durationMs = null) {
    const normalizedThreshold = Number(threshold);
    const normalizedAction = normalizeAction(action);

    if (!Number.isSafeInteger(normalizedThreshold) || normalizedThreshold < 1) {
      throw new Error('경고 횟수는 1 이상의 정수여야 합니다.');
    }

    if (!['mute', 'kick', 'ban'].includes(normalizedAction)) {
      throw new Error('처벌은 뮤트, 킥, 밴 중 하나여야 합니다.');
    }

    if (normalizedAction === 'mute') {
      if (!Number.isSafeInteger(durationMs) || durationMs < 1) {
        throw new Error('뮤트 처벌에는 시간이 필요합니다.');
      }

      if (durationMs > MAX_TIMEOUT_MS) {
        throw new Error('뮤트 시간은 최대 28일까지 가능합니다.');
      }
    }

    return this.store.update((data) => {
      const moderation = getOrCreateModeration(data, guildId);
      moderation.settings.warningPunishment = {
        threshold: normalizedThreshold,
        action: normalizedAction,
        durationMs: normalizedAction === 'mute' ? durationMs : null
      };

      return cloneSettings(moderation.settings);
    });
  }

  async addWarning({ guildId, userId, username, moderatorId, reason = '사유 없음', now = Date.now() }) {
    return this.store.update((data) => {
      const moderation = getOrCreateModeration(data, guildId);
      moderation.warnings[userId] ??= [];

      const warning = {
        id: createWarningId(now, moderation.warnings[userId].length + 1),
        userId,
        username,
        moderatorId,
        reason,
        createdAt: now
      };

      moderation.warnings[userId].push(warning);

      const count = moderation.warnings[userId].length;
      const punishment = getTriggeredPunishment(moderation.settings.warningPunishment, count);

      return {
        warning: cloneWarning(warning),
        count,
        punishment
      };
    });
  }

  async getWarnings(guildId, userId) {
    const data = await this.store.load();
    const moderation = getOrCreateModeration(data, guildId);
    return (moderation.warnings[userId] ?? []).map(cloneWarning);
  }

  async clearWarnings(guildId, userId) {
    return this.store.update((data) => {
      const moderation = getOrCreateModeration(data, guildId);
      const removed = moderation.warnings[userId]?.length ?? 0;
      moderation.warnings[userId] = [];
      return { removed };
    });
  }

  async recordMessageAndDetectSpam({ guildId, userId, username, content = '', now = Date.now() }) {
    return this.store.update((data) => {
      const moderation = getOrCreateModeration(data, guildId);
      const settings = moderation.settings.autoSpamBan;

      if (!settings.enabled) {
        return {
          detected: false,
          count: 0,
          duplicateCount: 0
        };
      }

      moderation.spam[userId] ??= {
        userId,
        username,
        messages: [],
        offenses: []
      };

      const spamState = moderation.spam[userId];
      spamState.username = username || spamState.username;
      spamState.offenses ??= [];
      spamState.messages = spamState.messages
        .filter((entry) => now - entry.createdAt <= settings.windowMs);
      spamState.messages.push({
        createdAt: now,
        normalizedContent: normalizeMessageContent(content)
      });

      const normalizedContent = normalizeMessageContent(content);
      const duplicateCount = normalizedContent
        ? spamState.messages.filter((entry) => entry.normalizedContent === normalizedContent).length
        : 0;
      const count = spamState.messages.length;
      const detected = count >= settings.messageLimit || duplicateCount >= settings.duplicateLimit;

      if (!detected) {
        return {
          detected: false,
          count,
          duplicateCount
        };
      }

      spamState.messages = [];
      spamState.offenses = spamState.offenses
        .filter((entry) => now - entry.createdAt <= settings.offenseResetMs);
      spamState.offenses.push({ createdAt: now });

      const offenseCount = spamState.offenses.length;
      const shouldBan = shouldAutoBanForSpam(settings, offenseCount);
      return {
        detected: true,
        count,
        duplicateCount,
        offenseCount,
        punishment: {
          action: shouldBan ? 'ban' : 'slowmode',
          durationMs: shouldBan ? null : settings.userSlowmodeDurationMs
        },
        reason: duplicateCount >= settings.duplicateLimit
          ? `자동 도배 감지: 같은 메시지 ${duplicateCount}회 반복`
          : `자동 도배 감지: ${Math.ceil(settings.windowMs / 1000)}초 내 메시지 ${count}개`
      };
    });
  }

  async findBannedWord(guildId, content) {
    const data = await this.store.load();
    const moderation = getOrCreateModeration(data, guildId);
    const normalizedContent = content.toLocaleLowerCase('ko-KR');

    return moderation.settings.bannedWords.find((word) =>
      normalizedContent.includes(word.toLocaleLowerCase('ko-KR'))
    ) ?? null;
  }
}

export function parseDuration(input) {
  if (typeof input !== 'string') {
    throw new Error('시간은 문자열이어야 합니다.');
  }

  const normalized = input.trim().toLocaleLowerCase('ko-KR').replace(/\s+/g, '');
  const match = normalized.match(/^(\d+)(초|분|시간|일|s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hour|hours|d|day|days)$/u);

  if (!match) {
    throw new Error('시간 형식은 예: 10분, 1시간, 2일, 30m 처럼 입력해주세요.');
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const unitMs = getUnitMs(unit);
  const durationMs = amount * unitMs;

  if (!Number.isSafeInteger(durationMs) || durationMs < 1) {
    throw new Error('시간 값이 올바르지 않습니다.');
  }

  if (durationMs > MAX_TIMEOUT_MS) {
    throw new Error('뮤트 시간은 최대 28일까지 가능합니다.');
  }

  return durationMs;
}

export function formatDurationMs(ms) {
  if (ms % (24 * 60 * 60 * 1000) === 0) return `${ms / (24 * 60 * 60 * 1000)}일`;
  if (ms % (60 * 60 * 1000) === 0) return `${ms / (60 * 60 * 1000)}시간`;
  if (ms % (60 * 1000) === 0) return `${ms / (60 * 1000)}분`;
  return `${Math.ceil(ms / 1000)}초`;
}

export function formatAction(action) {
  return {
    slowmode: '유저 슬로우모드',
    mute: '뮤트',
    kick: '킥',
    ban: '밴'
  }[action] ?? action;
}

function getOrCreateModeration(data, guildId) {
  data.guilds ??= {};
  data.guilds[guildId] ??= {};
  data.guilds[guildId].moderation ??= {
    settings: structuredClone(DEFAULT_SETTINGS),
    warnings: {},
    spam: {}
  };

  const moderation = data.guilds[guildId].moderation;
  const autoSpamBan = normalizeAutoSpamBanSettings(moderation.settings?.autoSpamBan);
  moderation.settings = {
    ...structuredClone(DEFAULT_SETTINGS),
    ...moderation.settings,
    bannedWords: moderation.settings?.bannedWords ?? [],
    autoSpamBan
  };
  moderation.warnings ??= {};
  moderation.spam ??= {};

  return moderation;
}

function normalizeAutoSpamBanSettings(settings = {}) {
  const merged = {
    ...structuredClone(DEFAULT_SETTINGS.autoSpamBan),
    ...settings
  };

  if (isLegacyStrictAutoSpamBanSettings(merged)) {
    return {
      ...merged,
      messageLimit: DEFAULT_SETTINGS.autoSpamBan.messageLimit,
      duplicateLimit: DEFAULT_SETTINGS.autoSpamBan.duplicateLimit,
      userSlowmodeDurationMs: DEFAULT_SETTINGS.autoSpamBan.userSlowmodeDurationMs,
      banAfterOffenses: DEFAULT_SETTINGS.autoSpamBan.banAfterOffenses,
      offenseResetMs: DEFAULT_SETTINGS.autoSpamBan.offenseResetMs
    };
  }

  return merged;
}

function isLegacyStrictAutoSpamBanSettings(settings) {
  return Object.entries(LEGACY_STRICT_AUTO_SPAM_BAN_SETTINGS)
    .every(([key, value]) => settings[key] === value);
}

function shouldAutoBanForSpam(settings, offenseCount) {
  return Number.isSafeInteger(settings.banAfterOffenses)
    && settings.banAfterOffenses > 0
    && offenseCount >= settings.banAfterOffenses;
}

function getTriggeredPunishment(warningPunishment, warningCount) {
  if (!warningPunishment) return null;
  if (warningCount < warningPunishment.threshold) return null;
  if (warningCount % warningPunishment.threshold !== 0) return null;

  return {
    action: warningPunishment.action,
    durationMs: warningPunishment.durationMs
  };
}

function normalizeAction(action) {
  return {
    뮤트: 'mute',
    mute: 'mute',
    킥: 'kick',
    kick: 'kick',
    밴: 'ban',
    ban: 'ban'
  }[String(action).trim().toLocaleLowerCase('ko-KR')];
}

function normalizeWord(word) {
  return String(word ?? '').trim().toLocaleLowerCase('ko-KR');
}

function normalizeMessageContent(content) {
  return String(content ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ko-KR');
}

function cloneSettings(settings) {
  return {
    logChannelId: settings.logChannelId,
    bannedWords: [...settings.bannedWords],
    warningPunishment: settings.warningPunishment
      ? { ...settings.warningPunishment }
      : null,
    autoSpamBan: { ...settings.autoSpamBan }
  };
}

function cloneWarning(warning) {
  return { ...warning };
}

function createWarningId(now, sequence) {
  return `${now.toString(36)}-${sequence.toString(36)}`;
}

function getUnitMs(unit) {
  if (['초', 's', 'sec', 'secs', 'second', 'seconds'].includes(unit)) return 1000;
  if (['분', 'm', 'min', 'mins', 'minute', 'minutes'].includes(unit)) return 60 * 1000;
  if (['시간', 'h', 'hr', 'hour', 'hours'].includes(unit)) return 60 * 60 * 1000;
  if (['일', 'd', 'day', 'days'].includes(unit)) return 24 * 60 * 60 * 1000;
  throw new Error('지원하지 않는 시간 단위입니다.');
}
