const ACCOUNT_STATE_KEY = 'accounts';
const ACCOUNT_SELECT_ID_PREFIX = 'guild:';

export const ACCOUNT_LINK_SELECT_CUSTOM_ID_PREFIX = 'account_link_select';

export class AccountSelectionRequiredError extends Error {
  constructor(summary) {
    super('여러 서버에 같은 유저의 계정이 있어 사용할 계정을 먼저 선택해야 합니다.');
    this.name = 'AccountSelectionRequiredError';
    this.accountSelectionRequired = true;
    this.summary = summary;
  }
}

export function isAccountSelectionRequiredError(error) {
  return Boolean(error?.accountSelectionRequired);
}

export function getOrCreateLinkedAccountProfile(data, {
  guildId,
  userId,
  username = 'Unknown',
  now = Date.now(),
  createDefaultProfile
}) {
  const normalizedUserId = normalizeId(userId, '유저');
  const normalizedGuildId = normalizeId(guildId, '서버');
  data.guilds ??= {};
  data.guilds[normalizedGuildId] ??= {};
  const accountState = getOrCreateAccountState(data);
  const legacyCandidates = getLegacyAccountCandidates(data, normalizedUserId);

  if (!accountState.users[normalizedUserId]) {
    if (legacyCandidates.length > 1) {
      throw new AccountSelectionRequiredError(createAccountLinkSummaryFromCandidates({
        guildId: normalizedGuildId,
        userId: normalizedUserId,
        username,
        candidates: legacyCandidates
      }));
    }

    accountState.users[normalizedUserId] = legacyCandidates[0]?.profile
      ?? createDefaultProfile(normalizedUserId, username || 'Unknown', now);
  }

  for (const candidate of legacyCandidates) {
    touchAccountGuildMembership(data, candidate.guildId, normalizedUserId, candidate.profile?.username ?? username, now);
  }
  touchAccountGuildMembership(data, normalizedGuildId, normalizedUserId, username, now);
  deleteLegacyGuildProfiles(data, normalizedUserId);

  const profile = accountState.users[normalizedUserId];
  profile.userId = normalizedUserId;
  profile.username = username || profile.username || 'Unknown';
  profile.createdAt = normalizeNonNegativeInteger(profile.createdAt) || now;

  return profile;
}

export function getAccountLinkSummary(data, {
  guildId,
  userId,
  username = 'Unknown'
}) {
  const normalizedUserId = normalizeId(userId, '유저');
  const normalizedGuildId = normalizeId(guildId, '서버');
  const accountState = getExistingAccountState(data);

  if (accountState?.users?.[normalizedUserId]) {
    return {
      required: false,
      linked: true,
      userId: normalizedUserId,
      guildId: normalizedGuildId,
      candidates: [summarizeAccountCandidate({
        id: `global:${normalizedUserId}`,
        source: 'global',
        guildId: null,
        profile: accountState.users[normalizedUserId]
      })]
    };
  }

  const candidates = getLegacyAccountCandidates(data, normalizedUserId);
  if (candidates.length <= 1) {
    return {
      required: false,
      linked: candidates.length === 1,
      userId: normalizedUserId,
      guildId: normalizedGuildId,
      candidates: candidates.map(summarizeAccountCandidate)
    };
  }

  return createAccountLinkSummaryFromCandidates({
    guildId: normalizedGuildId,
    userId: normalizedUserId,
    username,
    candidates
  });
}

export function resolveLinkedAccountSelection(data, {
  guildId,
  userId,
  username = 'Unknown',
  selectedAccountId,
  now = Date.now()
}) {
  const normalizedUserId = normalizeId(userId, '유저');
  const normalizedGuildId = normalizeId(guildId, '서버');
  const accountState = getOrCreateAccountState(data);
  const candidates = getAccountSelectionCandidates(data, normalizedUserId);
  const selected = candidates.find((candidate) => candidate.id === selectedAccountId);

  if (!selected) {
    throw new Error('선택한 계정을 찾을 수 없습니다. `/계정연동`을 다시 실행해주세요.');
  }

  const selectedProfile = selected.profile;
  selectedProfile.userId = normalizedUserId;
  selectedProfile.username = username || selectedProfile.username || 'Unknown';
  selectedProfile.createdAt = normalizeNonNegativeInteger(selectedProfile.createdAt) || now;
  accountState.users[normalizedUserId] = selectedProfile;

  const legacyGuildIds = new Set();
  for (const candidate of candidates) {
    if (candidate.guildId) {
      legacyGuildIds.add(candidate.guildId);
      touchAccountGuildMembership(
        data,
        candidate.guildId,
        normalizedUserId,
        candidate.profile?.username ?? selectedProfile.username,
        now
      );
    }
  }
  touchAccountGuildMembership(data, normalizedGuildId, normalizedUserId, username || selectedProfile.username, now);
  deleteLegacyGuildProfiles(data, normalizedUserId);

  accountState.resolutions ??= {};
  accountState.resolutions[normalizedUserId] = {
    userId: normalizedUserId,
    selectedAccountId: selected.id,
    selectedGuildId: selected.guildId,
    deletedAccountCount: Math.max(0, candidates.length - 1),
    resolvedAt: now
  };

  return {
    userId: normalizedUserId,
    guildId: normalizedGuildId,
    selected: summarizeAccountCandidate(selected),
    candidateCount: candidates.length,
    deletedAccountCount: Math.max(0, candidates.length - 1),
    linkedGuildIds: [...legacyGuildIds, normalizedGuildId]
  };
}

export function touchAccountGuildMembership(data, guildId, userId, username = 'Unknown', now = Date.now()) {
  const normalizedGuildId = normalizeId(guildId, '서버');
  const normalizedUserId = normalizeId(userId, '유저');
  const accountState = getOrCreateAccountState(data);
  accountState.guilds ??= {};
  accountState.guilds[normalizedGuildId] ??= { users: {} };
  accountState.guilds[normalizedGuildId].users ??= {};

  const existing = accountState.guilds[normalizedGuildId].users[normalizedUserId] ?? {};
  accountState.guilds[normalizedGuildId].users[normalizedUserId] = {
    userId: normalizedUserId,
    username: username || existing.username || 'Unknown',
    linkedAt: normalizeNonNegativeInteger(existing.linkedAt) || now,
    lastSeenAt: now
  };
}

export function getAccountUserIdsForGuild(data, guildId) {
  const normalizedGuildId = normalizeId(guildId, '서버');
  return [...new Set([
    ...Object.keys(data?.[ACCOUNT_STATE_KEY]?.guilds?.[normalizedGuildId]?.users ?? {}),
    ...Object.keys(data?.guilds?.[normalizedGuildId]?.users ?? {})
  ])];
}

export function getLinkedAccountUsername(data, userId, fallback = 'Unknown') {
  const normalizedUserId = String(userId ?? '').trim();
  if (!normalizedUserId) return fallback;

  const accountProfile = data?.[ACCOUNT_STATE_KEY]?.users?.[normalizedUserId];
  if (accountProfile?.username) return accountProfile.username;

  for (const guild of Object.values(data?.guilds ?? {})) {
    const legacyProfile = guild?.users?.[normalizedUserId];
    if (legacyProfile?.username) return legacyProfile.username;
  }

  for (const guildAccount of Object.values(data?.[ACCOUNT_STATE_KEY]?.guilds ?? {})) {
    const membership = guildAccount?.users?.[normalizedUserId];
    if (membership?.username) return membership.username;
  }

  return fallback;
}

export function deleteLegacyGuildProfiles(data, userId) {
  const normalizedUserId = normalizeId(userId, '유저');
  for (const guild of Object.values(data?.guilds ?? {})) {
    if (guild?.users && Object.hasOwn(guild.users, normalizedUserId)) {
      delete guild.users[normalizedUserId];
    }
  }
}

function getAccountSelectionCandidates(data, userId) {
  const accountState = getExistingAccountState(data);
  const candidates = [];

  if (accountState?.users?.[userId]) {
    candidates.push({
      id: `global:${userId}`,
      source: 'global',
      guildId: null,
      profile: accountState.users[userId]
    });
  }

  candidates.push(...getLegacyAccountCandidates(data, userId));
  return candidates;
}

function getLegacyAccountCandidates(data, userId) {
  return Object.entries(data?.guilds ?? {})
    .filter(([, guild]) => guild?.users?.[userId] && typeof guild.users[userId] === 'object')
    .map(([guildId, guild]) => ({
      id: `${ACCOUNT_SELECT_ID_PREFIX}${guildId}`,
      source: 'guild',
      guildId,
      profile: guild.users[userId]
    }));
}

function createAccountLinkSummaryFromCandidates({
  guildId,
  userId,
  username,
  candidates
}) {
  return {
    required: true,
    linked: false,
    userId,
    guildId,
    username,
    candidates: candidates.map(summarizeAccountCandidate)
  };
}

function summarizeAccountCandidate(candidate) {
  const profile = candidate.profile ?? {};
  const level = normalizePositiveInteger(profile.level, 1);
  const totalXp = normalizeNonNegativeInteger(profile.totalXp);
  const balance = normalizeNonNegativeInteger(profile.balance);
  const createdAt = normalizeNonNegativeInteger(profile.createdAt);
  const username = profile.username || 'Unknown';
  const sourceLabel = candidate.source === 'global'
    ? '통합 계정'
    : `서버 ${shortId(candidate.guildId)}`;

  return {
    id: candidate.id,
    source: candidate.source,
    guildId: candidate.guildId,
    username,
    level,
    totalXp,
    balance,
    createdAt,
    label: `${sourceLabel} · ${username}`.slice(0, 100),
    description: `Lv.${level} · ${totalXp.toLocaleString()} XP · ${balance.toLocaleString()}골드${createdAt ? ` · 생성 ${formatDate(createdAt)}` : ''}`.slice(0, 100)
  };
}

function getOrCreateAccountState(data) {
  data[ACCOUNT_STATE_KEY] ??= {};
  data[ACCOUNT_STATE_KEY].users ??= {};
  data[ACCOUNT_STATE_KEY].guilds ??= {};
  return data[ACCOUNT_STATE_KEY];
}

function getExistingAccountState(data) {
  return data?.[ACCOUNT_STATE_KEY] ?? null;
}

function normalizeId(value, label) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(`${label} ID가 없습니다.`);
  return normalized;
}

function normalizeNonNegativeInteger(value) {
  const normalized = Number(value);
  return Number.isSafeInteger(normalized) && normalized >= 0 ? normalized : 0;
}

function normalizePositiveInteger(value, fallback) {
  const normalized = Number(value);
  return Number.isSafeInteger(normalized) && normalized > 0 ? normalized : fallback;
}

function shortId(value) {
  const text = String(value ?? '');
  if (text.length <= 8) return text || '알 수 없음';
  return `${text.slice(0, 4)}…${text.slice(-4)}`;
}

function formatDate(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}
