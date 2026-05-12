const ACCOUNT_STATE_KEY = 'accounts';
const ACCOUNT_SELECT_ID_PREFIX = 'guild:';
const LINKED_FEATURE_KEYS = Object.freeze(['fishing', 'stocks', 'mining']);
const LINKED_FEATURE_LABELS = Object.freeze({
  account: '계정',
  fishing: '낚시',
  stocks: '주식',
  mining: '광산'
});

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
  const legacyCandidates = getLegacyAccountCandidates(data, normalizedUserId, {
    includeLinkedFeatures: true
  });

  if (!accountState.users[normalizedUserId]) {
    if (legacyCandidates.length > 1) {
      throw new AccountSelectionRequiredError(createAccountLinkSummaryFromCandidates({
        guildId: normalizedGuildId,
        userId: normalizedUserId,
        username,
        candidates: legacyCandidates
      }));
    }

    accountState.users[normalizedUserId] = legacyCandidates[0]?.accountProfile
      ?? createDefaultProfile(normalizedUserId, username || 'Unknown', now);
  }

  for (const candidate of legacyCandidates) {
    touchAccountGuildMembership(data, candidate.guildId, normalizedUserId, candidate.profile?.username ?? username, now);
  }
  touchAccountGuildMembership(data, normalizedGuildId, normalizedUserId, username, now);
  promoteLinkedFeatureProfiles(data, {
    userId: normalizedUserId,
    username,
    selectedGuildId: legacyCandidates.length === 1 ? legacyCandidates[0].guildId : null,
    now
  });
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
  const selectionCandidates = getAccountSelectionCandidates(data, normalizedUserId);
  const legacyCandidates = selectionCandidates.filter((candidate) => candidate.source === 'guild');

  if (accountState?.users?.[normalizedUserId]) {
    if (legacyCandidates.length > 1) {
      return createAccountLinkSummaryFromCandidates({
        guildId: normalizedGuildId,
        userId: normalizedUserId,
        username,
        candidates: legacyCandidates
      });
    }

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

  if (legacyCandidates.length <= 1) {
    return {
      required: false,
      linked: legacyCandidates.length === 1,
      userId: normalizedUserId,
      guildId: normalizedGuildId,
      candidates: legacyCandidates.map(summarizeAccountCandidate)
    };
  }

  return createAccountLinkSummaryFromCandidates({
    guildId: normalizedGuildId,
    userId: normalizedUserId,
    username,
    candidates: legacyCandidates
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

  const selectedProfile = selected.accountProfile
    ?? accountState.users[normalizedUserId]
    ?? { userId: normalizedUserId, username, createdAt: now };
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
  promoteLinkedFeatureProfiles(data, {
    userId: normalizedUserId,
    username: username || selectedProfile.username,
    selectedGuildId: selected.guildId,
    now,
    force: true
  });
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

export function getOrCreateLinkedFeatureUserProfile(data, {
  featureKey,
  guildId,
  userId,
  username = 'Unknown',
  now = Date.now(),
  createDefaultProfile
}) {
  const normalizedUserId = normalizeId(userId, '유저');
  const normalizedGuildId = normalizeId(guildId, '서버');
  const normalizedFeatureKey = normalizeFeatureKey(featureKey);
  const featureState = getOrCreateFeatureState(data, normalizedFeatureKey);
  const legacyCandidates = getLegacyFeatureUserCandidates(data, normalizedUserId, normalizedFeatureKey);
  const selectedLegacyCandidate = legacyCandidates.length === 1
    && legacyCandidates[0].guildId === normalizedGuildId
    ? legacyCandidates[0]
    : null;

  if (!featureState.users[normalizedUserId]) {
    if (legacyCandidates.length > 1) {
      throw new AccountSelectionRequiredError(createAccountLinkSummaryFromCandidates({
        guildId: normalizedGuildId,
        userId: normalizedUserId,
        username,
        candidates: legacyCandidates
      }));
    }

    featureState.users[normalizedUserId] = legacyCandidates[0]?.profile
      ?? createDefaultProfile(normalizedUserId, username || 'Unknown', now);
  } else if (selectedLegacyCandidate && selectedLegacyCandidate.profile !== featureState.users[normalizedUserId]) {
    featureState.users[normalizedUserId] = selectedLegacyCandidate.profile;
  }

  for (const candidate of legacyCandidates) {
    touchAccountGuildMembership(data, candidate.guildId, normalizedUserId, candidate.profile?.username ?? username, now);
  }
  touchAccountGuildMembership(data, normalizedGuildId, normalizedUserId, username, now);
  deleteLegacyFeatureUserProfiles(data, normalizedUserId, normalizedFeatureKey);

  const profile = featureState.users[normalizedUserId];
  profile.userId = normalizedUserId;
  profile.username = username || profile.username || 'Unknown';
  profile.createdAt = normalizeNonNegativeInteger(profile.createdAt) || now;
  return profile;
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
      profile: accountState.users[userId],
      accountProfile: accountState.users[userId],
      featureKeys: ['account']
    });
  }

  candidates.push(...getLegacyAccountCandidates(data, userId, {
    includeLinkedFeatures: true
  }));
  return candidates;
}

function getLegacyAccountCandidates(data, userId, {
  includeLinkedFeatures = false
} = {}) {
  const candidatesByGuildId = new Map();

  for (const [guildId, guild] of Object.entries(data?.guilds ?? {})) {
    const accountProfile = guild?.users?.[userId];
    if (accountProfile && typeof accountProfile === 'object') {
      candidatesByGuildId.set(guildId, {
        id: `${ACCOUNT_SELECT_ID_PREFIX}${guildId}`,
        source: 'guild',
        guildId,
        profile: accountProfile,
        accountProfile,
        featureKeys: ['account'],
        featureProfiles: { account: accountProfile }
      });
    }
  }

  if (!includeLinkedFeatures) return [...candidatesByGuildId.values()];

  for (const featureKey of LINKED_FEATURE_KEYS) {
    for (const candidate of getLegacyFeatureUserCandidates(data, userId, featureKey)) {
      const existing = candidatesByGuildId.get(candidate.guildId);
      if (existing) {
        existing.featureKeys = [...new Set([...(existing.featureKeys ?? []), featureKey])];
        existing.featureProfiles ??= {};
        existing.featureProfiles[featureKey] = candidate.profile;
        existing.profile ??= candidate.profile;
        continue;
      }

      candidatesByGuildId.set(candidate.guildId, candidate);
    }
  }

  return [...candidatesByGuildId.values()];
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
  const featureLabels = (candidate.featureKeys ?? [])
    .map((key) => LINKED_FEATURE_LABELS[key])
    .filter(Boolean);
  const featureText = featureLabels.length > 0
    ? ` · ${featureLabels.join('/')}`
    : '';
  const sourceLabel = candidate.source === 'global'
    ? '통합 계정'
    : `서버 ${shortId(candidate.guildId)}${featureText}`;

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
    description: `Lv.${level} · ${totalXp.toLocaleString()} XP · ${balance.toLocaleString()}골드${featureText}${createdAt ? ` · 생성 ${formatDate(createdAt)}` : ''}`.slice(0, 100)
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

function getOrCreateFeatureState(data, featureKey) {
  const normalizedFeatureKey = normalizeFeatureKey(featureKey);
  data[normalizedFeatureKey] ??= {};
  data[normalizedFeatureKey].users ??= {};
  return data[normalizedFeatureKey];
}

function getLegacyFeatureUserCandidates(data, userId, featureKey) {
  const normalizedFeatureKey = normalizeFeatureKey(featureKey);
  return Object.entries(data?.guilds ?? {})
    .filter(([, guild]) =>
      guild?.[normalizedFeatureKey]?.users?.[userId]
      && typeof guild[normalizedFeatureKey].users[userId] === 'object'
      && !isMirroredLinkedFeatureProfile(data, guild, normalizedFeatureKey, userId)
    )
    .map(([guildId, guild]) => {
      const profile = guild[normalizedFeatureKey].users[userId];
      return {
        id: `${ACCOUNT_SELECT_ID_PREFIX}${guildId}`,
        source: 'guild',
        guildId,
        profile,
        accountProfile: guild?.users?.[userId],
        featureKeys: [
          ...(guild?.users?.[userId] ? ['account'] : []),
          normalizedFeatureKey
        ],
        featureProfiles: {
          ...(guild?.users?.[userId] ? { account: guild.users[userId] } : {}),
          [normalizedFeatureKey]: profile
        }
      };
    });
}

function promoteLinkedFeatureProfiles(data, {
  userId,
  username = 'Unknown',
  selectedGuildId = null,
  now = Date.now(),
  force = false
}) {
  for (const featureKey of LINKED_FEATURE_KEYS) {
    const featureState = getOrCreateFeatureState(data, featureKey);
    const legacyCandidates = getLegacyFeatureUserCandidates(data, userId, featureKey);
    if (!featureState.users[userId]) {
      const selected = selectedGuildId
        ? legacyCandidates.find((candidate) => candidate.guildId === selectedGuildId)
        : null;
      const candidate = selected ?? (legacyCandidates.length === 1 ? legacyCandidates[0] : null);
      if (candidate) {
        featureState.users[userId] = candidate.profile;
      }
    } else if (legacyCandidates.length === 1
      && (!selectedGuildId || legacyCandidates[0].guildId === selectedGuildId)
      && legacyCandidates[0].profile !== featureState.users[userId]) {
      featureState.users[userId] = legacyCandidates[0].profile;
    }

    if (!featureState.users[userId]) continue;
    if (!force && legacyCandidates.length > 1 && !selectedGuildId) continue;

    const profile = featureState.users[userId];
    profile.userId = userId;
    profile.username = username || profile.username || 'Unknown';
    profile.createdAt = normalizeNonNegativeInteger(profile.createdAt) || now;
    deleteLegacyFeatureUserProfiles(data, userId, featureKey);
  }
}

function deleteLegacyFeatureUserProfiles(data, userId, featureKey) {
  const normalizedFeatureKey = normalizeFeatureKey(featureKey);
  for (const guild of Object.values(data?.guilds ?? {})) {
    if (guild?.[normalizedFeatureKey]?.users && Object.hasOwn(guild[normalizedFeatureKey].users, userId)) {
      delete guild[normalizedFeatureKey].users[userId];
    }
    if (guild?.[normalizedFeatureKey]?.linkedUsers && Object.hasOwn(guild[normalizedFeatureKey].linkedUsers, userId)) {
      delete guild[normalizedFeatureKey].linkedUsers[userId];
    }
  }
}

function isMirroredLinkedFeatureProfile(data, guild, featureKey, userId) {
  if (guild?.[featureKey]?.linkedUsers?.[userId] !== true) return false;
  const globalProfile = data?.[featureKey]?.users?.[userId];
  const guildProfile = guild?.[featureKey]?.users?.[userId];
  return areJsonEquivalent(globalProfile, guildProfile);
}

function areJsonEquivalent(left, right) {
  if (!left || !right) return false;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return left === right;
  }
}

function normalizeFeatureKey(featureKey) {
  const normalized = String(featureKey ?? '').trim();
  if (!LINKED_FEATURE_KEYS.includes(normalized)) {
    throw new Error(`알 수 없는 연동 기능입니다: ${normalized || '없음'}`);
  }
  return normalized;
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
