import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ECONOMIC_ROLE_CONFIGS,
  ECONOMIC_ROLE_KEYS,
  calculateBorrowedLoanDebt,
  getEconomicRoleStateForUser,
  resolveEconomicRoleState,
  syncEconomicRoleForMember
} from '../src/systems/economic-roles.js';

test('경제 역할은 부채가 잔액보다 크면 10조 초과자도 노예를 우선 배정한다', () => {
  const richButInDebt = resolveEconomicRoleState({
    balance: '10000000000001',
    borrowedLoanDebt: '10000000000002'
  });
  const exactTenTrillion = resolveEconomicRoleState({
    balance: '10000000000000'
  });
  const overTenTrillion = resolveEconomicRoleState({
    balance: '10000000000001'
  });

  assert.equal(richButInDebt.key, ECONOMIC_ROLE_KEYS.SLAVE);
  assert.equal(richButInDebt.roleName, '노예');
  assert.equal(exactTenTrillion.key, ECONOMIC_ROLE_KEYS.REGULAR);
  assert.equal(overTenTrillion.key, ECONOMIC_ROLE_KEYS.TEN_TRILLION_CLUB);
  assert.equal(overTenTrillion.roleName, '10조 클럽');
});

test('빌린돈 합산은 유저 대출 잔액과 레버리지 채무를 모두 반영한다', async () => {
  const economy = {
    async getUserLoanStatus(input) {
      assert.equal(input.guildId, 'guild-1');
      assert.equal(input.userId, 'user-1');
      return {
        profile: {
          balance: 100,
          bankruptcy: { debt: 0 }
        },
        borrowedLoans: [
          { remaining: 30 },
          { totalDue: 25, repaid: 15 }
        ]
      };
    }
  };
  const stocks = {
    async getLeverageDebtSummary(input) {
      assert.equal(input.guildId, 'guild-1');
      assert.equal(input.userId, 'user-1');
      return {
        activeDebt: 50,
        bankruptcyDebt: 11
      };
    }
  };

  const state = await getEconomicRoleStateForUser({
    economy,
    stocks,
    guildId: 'guild-1',
    userId: 'user-1',
    username: '테스터',
    now: 1000
  });

  assert.equal(calculateBorrowedLoanDebt([{ remaining: 30 }, { totalDue: 25, repaid: 15 }]), 40);
  assert.equal(state.borrowedLoanDebt, 40);
  assert.equal(state.leverageDebt, 50);
  assert.equal(state.leverageBankruptcyDebt, 11);
  assert.equal(state.totalDebt, 101);
  assert.equal(state.key, ECONOMIC_ROLE_KEYS.SLAVE);
});

test('경제 역할 동기화는 역할 색을 보정하고 대상 역할 하나만 남긴다', async () => {
  const guild = createMockGuild([
    createMockRole('club-role', '10조 클럽', 123),
    createMockRole('regular-role', '일반인', 456)
  ]);
  const member = createMockMember('user-1', ['club-role', 'regular-role']);
  const economy = {
    async getUserLoanStatus() {
      return {
        profile: { balance: 10, bankruptcy: { debt: 0 } },
        borrowedLoans: [{ remaining: 11 }]
      };
    }
  };
  const stocks = {
    async getLeverageDebtSummary() {
      return { activeDebt: 0, bankruptcyDebt: 0 };
    }
  };

  const result = await syncEconomicRoleForMember({
    economy,
    stocks,
    guild,
    member,
    userId: 'user-1',
    username: '테스터'
  });

  const slaveRole = findRole(guild, '노예');
  const clubRole = findRole(guild, '10조 클럽');
  const regularRole = findRole(guild, '일반인');
  assert.equal(result.updated, true);
  assert.equal(result.state.key, ECONOMIC_ROLE_KEYS.SLAVE);
  assert.equal(slaveRole.color, ECONOMIC_ROLE_CONFIGS[ECONOMIC_ROLE_KEYS.SLAVE].color);
  assert.equal(clubRole.color, ECONOMIC_ROLE_CONFIGS[ECONOMIC_ROLE_KEYS.TEN_TRILLION_CLUB].color);
  assert.equal(regularRole.color, ECONOMIC_ROLE_CONFIGS[ECONOMIC_ROLE_KEYS.REGULAR].color);
  assert.deepEqual([...member.roleIds].sort(), [slaveRole.id].sort());
  assert.deepEqual(member.roleCalls, [
    ['remove', ['club-role', 'regular-role']],
    ['add', slaveRole.id]
  ]);
});

function createMockGuild(initialRoles = []) {
  const cache = new Map(initialRoles.map((role) => [role.id, role]));
  cache.find = (predicate) => [...cache.values()].find(predicate);
  let nextRoleId = 1;

  return {
    id: 'guild-1',
    roles: {
      cache,
      async create({ name, color }) {
        const role = createMockRole(`created-role-${nextRoleId++}`, name, color);
        cache.set(role.id, role);
        return role;
      }
    },
    members: {
      me: {
        permissions: {
          has() {
            return true;
          }
        }
      }
    }
  };
}

function createMockRole(id, name, color) {
  return {
    id,
    name,
    color,
    managed: false,
    async edit(options) {
      this.color = options.color;
      return this;
    }
  };
}

function createMockMember(userId, initialRoleIds = []) {
  const roleIds = new Set(initialRoleIds);
  const roleCalls = [];

  return {
    user: {
      id: userId,
      username: '테스터',
      bot: false
    },
    roleIds,
    roleCalls,
    roles: {
      cache: {
        has(roleId) {
          return roleIds.has(roleId);
        }
      },
      async add(roleId) {
        roleCalls.push(['add', roleId]);
        roleIds.add(roleId);
      },
      async remove(roleIdsToRemove) {
        const ids = Array.isArray(roleIdsToRemove) ? roleIdsToRemove : [roleIdsToRemove];
        roleCalls.push(['remove', ids]);
        for (const roleId of ids) roleIds.delete(roleId);
      }
    }
  };
}

function findRole(guild, name) {
  return [...guild.roles.cache.values()].find((role) => role.name === name);
}
