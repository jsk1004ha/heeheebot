import { Colors, PermissionFlagsBits } from 'discord.js';
import {
  addMoney,
  compareMoney,
  subtractMoney,
  toCompatibleMoneyValue,
  toMoney
} from './money.js';

export const TEN_TRILLION_CLUB_THRESHOLD = 10_000_000_000_000n;

export const ECONOMIC_ROLE_KEYS = Object.freeze({
  SLAVE: 'slave',
  TEN_TRILLION_CLUB: 'ten_trillion_club',
  REGULAR: 'regular'
});

export const ECONOMIC_ROLE_CONFIGS = Object.freeze({
  [ECONOMIC_ROLE_KEYS.SLAVE]: Object.freeze({
    key: ECONOMIC_ROLE_KEYS.SLAVE,
    name: '노예',
    color: Colors.Grey
  }),
  [ECONOMIC_ROLE_KEYS.TEN_TRILLION_CLUB]: Object.freeze({
    key: ECONOMIC_ROLE_KEYS.TEN_TRILLION_CLUB,
    name: '10조 클럽',
    color: Colors.Gold
  }),
  [ECONOMIC_ROLE_KEYS.REGULAR]: Object.freeze({
    key: ECONOMIC_ROLE_KEYS.REGULAR,
    name: '일반인',
    color: Colors.Default
  })
});

const ECONOMIC_ROLE_CONFIG_LIST = Object.freeze(Object.values(ECONOMIC_ROLE_CONFIGS));

export function calculateBorrowedLoanDebt(loans = []) {
  if (!Array.isArray(loans)) return 0;
  return toCompatibleMoneyValue(addMoney(...loans.map(getLoanRemainingAmount)));
}

export function resolveEconomicRoleState({
  balance = 0,
  borrowedLoanDebt = 0,
  leverageDebt = 0,
  leverageBankruptcyDebt = 0
} = {}) {
  const balanceMoney = toMoney(balance);
  const borrowedLoanDebtMoney = toMoney(borrowedLoanDebt);
  const leverageDebtMoney = toMoney(leverageDebt);
  const leverageBankruptcyDebtMoney = toMoney(leverageBankruptcyDebt);
  const totalDebtMoney = borrowedLoanDebtMoney + leverageDebtMoney + leverageBankruptcyDebtMoney;
  const key = totalDebtMoney > balanceMoney
    ? ECONOMIC_ROLE_KEYS.SLAVE
    : balanceMoney > TEN_TRILLION_CLUB_THRESHOLD
      ? ECONOMIC_ROLE_KEYS.TEN_TRILLION_CLUB
      : ECONOMIC_ROLE_KEYS.REGULAR;
  const role = ECONOMIC_ROLE_CONFIGS[key];

  return {
    key,
    role,
    roleName: role.name,
    balance: toCompatibleMoneyValue(balanceMoney),
    borrowedLoanDebt: toCompatibleMoneyValue(borrowedLoanDebtMoney),
    leverageDebt: toCompatibleMoneyValue(leverageDebtMoney),
    leverageBankruptcyDebt: toCompatibleMoneyValue(leverageBankruptcyDebtMoney),
    totalDebt: toCompatibleMoneyValue(totalDebtMoney),
    tenTrillionClubThreshold: toCompatibleMoneyValue(TEN_TRILLION_CLUB_THRESHOLD)
  };
}

export async function getEconomicRoleStateForUser({
  economy,
  stocks = null,
  guildId,
  userId,
  username = 'Unknown',
  now = Date.now()
}) {
  if (typeof economy?.getUserLoanStatus !== 'function') {
    throw new Error('경제 역할 산정에는 대출 현황을 조회할 EconomyService가 필요합니다.');
  }

  const status = await economy.getUserLoanStatus({
    guildId,
    userId,
    username,
    now
  });
  const borrowedLoanDebt = calculateBorrowedLoanDebt(status.borrowedLoans);
  const profile = status.profile ?? {};
  let leverageDebt = 0;
  let leverageBankruptcyDebt = profile.bankruptcy?.debt ?? 0;
  let leverageSummary = null;

  if (typeof stocks?.getLeverageDebtSummary === 'function') {
    leverageSummary = await stocks.getLeverageDebtSummary({
      guildId,
      userId,
      username,
      now
    });
    leverageBankruptcyDebt = leverageSummary.bankruptcyDebt ?? leverageSummary.bankruptcy?.debt ?? leverageBankruptcyDebt;
    leverageDebt = leverageSummary.activeDebt ?? getActiveLeverageDebtFromSummary(leverageSummary, leverageBankruptcyDebt);
  }

  return {
    ...resolveEconomicRoleState({
      balance: profile.balance,
      borrowedLoanDebt,
      leverageDebt,
      leverageBankruptcyDebt
    }),
    borrowedLoans: status.borrowedLoans,
    leverageSummary
  };
}

export async function syncEconomicRoleForMember({
  economy,
  stocks = null,
  guild,
  member = null,
  userId = member?.user?.id,
  username = member?.user?.username ?? member?.displayName ?? 'Unknown',
  now = Date.now()
}) {
  const normalizedUserId = String(userId ?? '').trim();
  const targetGuild = guild ?? member?.guild ?? null;
  if (!targetGuild || !normalizedUserId) {
    return { updated: false, skipped: 'missing_guild_or_user' };
  }

  const targetMember = await resolveGuildMember(targetGuild, normalizedUserId, member);
  if (!targetMember) {
    return { updated: false, skipped: 'member_unavailable' };
  }
  if (targetMember.user?.bot) {
    return { updated: false, skipped: 'bot_member' };
  }

  if (!canManageRoles(targetGuild)) {
    return { updated: false, skipped: 'missing_manage_roles_permission' };
  }

  const state = await getEconomicRoleStateForUser({
    economy,
    stocks,
    guildId: targetGuild.id,
    userId: normalizedUserId,
    username,
    now
  });
  const roles = await ensureEconomicRoles(targetGuild);
  const targetRole = roles[state.key];
  if (!targetRole) {
    return { updated: false, skipped: 'target_role_unavailable', state };
  }

  const managedRoleIds = ECONOMIC_ROLE_CONFIG_LIST
    .map((config) => roles[config.key]?.id)
    .filter(Boolean);
  const removableRoleIds = managedRoleIds.filter((roleId) => roleId !== targetRole.id && hasMemberRole(targetMember, roleId));
  const needsAdd = !hasMemberRole(targetMember, targetRole.id);

  if (removableRoleIds.length > 0) {
    await targetMember.roles.remove(removableRoleIds, '경제 상태 역할 자동 정리');
  }
  if (needsAdd) {
    await targetMember.roles.add(targetRole.id, '경제 상태 역할 자동 배정');
  }

  return {
    updated: removableRoleIds.length > 0 || needsAdd,
    role: targetRole,
    state,
    removedRoleIds: removableRoleIds,
    addedRoleId: needsAdd ? targetRole.id : null
  };
}

async function ensureEconomicRoles(guild) {
  const roles = {};
  for (const config of ECONOMIC_ROLE_CONFIG_LIST) {
    roles[config.key] = await ensureEconomicRole(guild, config);
  }
  return roles;
}

async function ensureEconomicRole(guild, config) {
  const existing = findRoleByName(guild, config.name);
  const reason = '경제 상태 역할 자동 배정 시스템';
  const role = existing ?? await guild.roles.create({
    name: config.name,
    color: config.color,
    reason
  });

  if (!role.managed && role.color !== config.color && typeof role.edit === 'function') {
    await role.edit({ color: config.color }, reason);
  }

  return role;
}

function findRoleByName(guild, roleName) {
  const cache = guild?.roles?.cache;
  if (typeof cache?.find === 'function') {
    return cache.find((role) => role.name === roleName && !role.managed) ?? null;
  }

  return [...(cache?.values?.() ?? [])]
    .find((role) => role.name === roleName && !role.managed) ?? null;
}

async function resolveGuildMember(guild, userId, candidateMember) {
  if (typeof candidateMember?.roles?.add === 'function' && typeof candidateMember.roles.remove === 'function') {
    return candidateMember;
  }

  const cached = guild?.members?.cache?.get?.(userId) ?? null;
  if (typeof cached?.roles?.add === 'function' && typeof cached.roles.remove === 'function') {
    return cached;
  }

  if (typeof guild?.members?.fetch !== 'function') return null;

  const fetched = await guild.members.fetch(userId).catch(() => null);
  return typeof fetched?.roles?.add === 'function' && typeof fetched.roles.remove === 'function'
    ? fetched
    : null;
}

function canManageRoles(guild) {
  const permissions = guild?.members?.me?.permissions;
  if (!permissions || typeof permissions.has !== 'function') return true;
  return permissions.has(PermissionFlagsBits.ManageRoles);
}

function hasMemberRole(member, roleId) {
  return Boolean(member?.roles?.cache?.has?.(roleId));
}

function getLoanRemainingAmount(loan) {
  if (!loan || typeof loan !== 'object') return 0;
  if (loan.remaining !== undefined) return loan.remaining;

  const totalDue = toMoney(loan.totalDue ?? 0);
  const repaid = toMoney(loan.repaid ?? 0);
  return compareMoney(totalDue, repaid) > 0
    ? toCompatibleMoneyValue(subtractMoney(totalDue, repaid))
    : 0;
}

function getActiveLeverageDebtFromSummary(summary, bankruptcyDebt) {
  const debtTotal = toMoney(summary?.debtTotal ?? 0);
  const bankruptcyDebtMoney = toMoney(bankruptcyDebt ?? 0);
  return debtTotal > bankruptcyDebtMoney
    ? toCompatibleMoneyValue(subtractMoney(debtTotal, bankruptcyDebtMoney))
    : 0;
}
