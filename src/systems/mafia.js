export const MAFIA_MIN_PLAYERS = 4;
export const MAFIA_MAX_PLAYERS = 16;

export const MAFIA_ROLES = Object.freeze({
  mafia: Object.freeze({ value: 'mafia', label: '마피아', team: 'mafia', nightAction: 'kill', privateChat: true }),
  citizen: Object.freeze({ value: 'citizen', label: '시민', team: 'citizens', nightAction: null, privateChat: false }),
  police: Object.freeze({ value: 'police', label: '경찰', team: 'citizens', nightAction: 'investigate', privateChat: true }),
  doctor: Object.freeze({ value: 'doctor', label: '의사', team: 'citizens', nightAction: 'protect', privateChat: true })
});

export const MAFIA_ROLE_DISTRIBUTIONS = Object.freeze([
  Object.freeze({ min: 4, max: 6, mafia: 1, police: 1, doctor: 1 }),
  Object.freeze({ min: 7, max: 9, mafia: 2, police: 1, doctor: 2 }),
  Object.freeze({ min: 10, max: 12, mafia: 2, police: 2, doctor: 2 }),
  Object.freeze({ min: 13, max: 16, mafia: 3, police: 2, doctor: 3 })
]);

const ROLE_ORDER = Object.freeze(['mafia', 'police', 'doctor', 'citizen']);

export class MafiaGame {
  constructor({ players, randomInt = defaultRandomInt, roleAssignments = null } = {}) {
    this.randomInt = randomInt;
    const normalizedPlayers = normalizePlayers(players);
    validatePlayerCount(normalizedPlayers.length);

    this.players = assignRoles(normalizedPlayers, randomInt, roleAssignments);
    this.round = 1;
    this.nightActions = {
      mafiaKills: new Map(),
      policeChecks: new Map(),
      doctorProtects: new Map()
    };
    this.votes = new Map();
    this.nightHistory = [];
    this.voteHistory = [];
  }

  get livingPlayers() {
    return this.players.filter((player) => player.alive);
  }

  get deadPlayers() {
    return this.players.filter((player) => !player.alive);
  }

  get roleCounts() {
    return countRoles(this.players);
  }

  get livingRoleCounts() {
    return countRoles(this.livingPlayers);
  }

  getPlayer(userId) {
    const normalizedUserId = normalizeText(userId);
    return this.players.find((player) => player.userId === normalizedUserId) ?? null;
  }

  getAssignment(userId) {
    const player = this.getPlayer(userId);
    if (!player) return null;

    const role = getRoleConfig(player.role);
    const sameRolePlayers = role.privateChat
      ? this.players.filter((candidate) => candidate.role === player.role)
      : [];

    return {
      player,
      role: player.role,
      roleLabel: role.label,
      team: role.team,
      teamLabel: role.team === 'mafia' ? '마피아 팀' : '시민 팀',
      nightAction: role.nightAction,
      sameRolePlayers
    };
  }

  getRoleGroups({ minSize = 2, aliveOnly = true } = {}) {
    const source = aliveOnly ? this.livingPlayers : this.players;
    return ROLE_ORDER
      .filter((role) => getRoleConfig(role).privateChat)
      .map((role) => ({
        role,
        label: getRoleConfig(role).label,
        players: source.filter((player) => player.role === role)
      }))
      .filter((group) => group.players.length >= minSize);
  }

  getNightActionActors() {
    return this.livingPlayers.filter((player) => getRoleConfig(player.role).nightAction);
  }

  getNightActionTargets(actorId) {
    const actor = this.getPlayer(actorId);
    if (!actor?.alive) return [];

    if (actor.role === 'mafia') {
      return this.livingPlayers.filter((player) => player.role !== 'mafia');
    }

    if (actor.role === 'police') {
      return this.livingPlayers.filter((player) => player.userId !== actor.userId);
    }

    if (actor.role === 'doctor') {
      return this.livingPlayers;
    }

    return [];
  }

  submitNightAction({ actorId, targetId }) {
    const actor = this.getPlayer(actorId);
    if (!actor) return rejected('not_player', '참가자만 밤 행동을 제출할 수 있습니다.');
    if (!actor.alive) return rejected('dead_actor', '사망자는 밤 행동을 할 수 없습니다.');

    const role = getRoleConfig(actor.role);
    if (!role.nightAction) return rejected('no_action', '이 역할은 밤 행동이 없습니다.');

    const targets = this.getNightActionTargets(actor.userId);
    const target = targets.find((candidate) => candidate.userId === normalizeText(targetId));
    if (!target) return rejected('invalid_target', '선택할 수 없는 대상입니다.');

    if (actor.role === 'mafia') {
      this.nightActions.mafiaKills.set(actor.userId, target.userId);
    } else if (actor.role === 'police') {
      this.nightActions.policeChecks.set(actor.userId, target.userId);
    } else if (actor.role === 'doctor') {
      this.nightActions.doctorProtects.set(actor.userId, target.userId);
    }

    const investigation = actor.role === 'police'
      ? { target, isMafia: target.role === 'mafia' }
      : null;

    return {
      accepted: true,
      actor,
      target,
      action: role.nightAction,
      investigation,
      complete: this.isNightActionComplete()
    };
  }

  hasSubmittedNightAction(userId) {
    const player = this.getPlayer(userId);
    if (!player) return false;
    if (player.role === 'mafia') return this.nightActions.mafiaKills.has(player.userId);
    if (player.role === 'police') return this.nightActions.policeChecks.has(player.userId);
    if (player.role === 'doctor') return this.nightActions.doctorProtects.has(player.userId);
    return true;
  }

  isNightActionComplete() {
    return this.getNightActionActors().every((actor) => {
      const targets = this.getNightActionTargets(actor.userId);
      return targets.length === 0 || this.hasSubmittedNightAction(actor.userId);
    });
  }

  resolveNight() {
    const protectedTargetIds = new Set(
      [...this.nightActions.doctorProtects.entries()]
        .filter(([actorId]) => this.getPlayer(actorId)?.alive)
        .map(([, targetId]) => targetId)
        .filter((targetId) => this.getPlayer(targetId)?.alive)
    );
    const attemptedKillIds = [...new Set(
      [...this.nightActions.mafiaKills.entries()]
        .filter(([actorId]) => this.getPlayer(actorId)?.alive)
        .map(([, targetId]) => targetId)
        .filter((targetId) => this.getPlayer(targetId)?.alive)
    )];
    const blocked = attemptedKillIds
      .filter((targetId) => protectedTargetIds.has(targetId))
      .map((targetId) => this.getPlayer(targetId));
    const killed = attemptedKillIds
      .filter((targetId) => !protectedTargetIds.has(targetId))
      .map((targetId) => this.killPlayer(targetId, { phase: 'night' }))
      .filter(Boolean);
    const policeResults = [...this.nightActions.policeChecks.entries()]
      .map(([actorId, targetId]) => {
        const actor = this.getPlayer(actorId);
        const target = this.getPlayer(targetId);
        if (!actor || !target) return null;
        return { actor, target, isMafia: target.role === 'mafia' };
      })
      .filter(Boolean);

    const result = {
      round: this.round,
      attemptedKills: attemptedKillIds.map((targetId) => this.getPlayer(targetId)).filter(Boolean),
      protectedPlayers: [...protectedTargetIds].map((targetId) => this.getPlayer(targetId)).filter(Boolean),
      blocked,
      killed,
      policeResults,
      win: this.checkWin()
    };

    this.nightHistory.push(result);
    this.clearNightActions();
    return result;
  }

  clearNightActions() {
    this.nightActions.mafiaKills.clear();
    this.nightActions.policeChecks.clear();
    this.nightActions.doctorProtects.clear();
  }

  clearVotes() {
    this.votes.clear();
  }

  castVote({ voterId, targetId }) {
    const voter = this.getPlayer(voterId);
    if (!voter) return rejected('not_player', '참가자만 투표할 수 있습니다.');
    if (!voter.alive) return rejected('dead_voter', '사망자는 투표할 수 없습니다.');

    const target = this.getPlayer(targetId);
    if (!target?.alive) return rejected('invalid_target', '살아있는 플레이어에게만 투표할 수 있습니다.');
    if (voter.userId === target.userId) return rejected('self_vote', '자기 자신에게는 투표할 수 없습니다.');

    this.votes.set(voter.userId, target.userId);
    return {
      accepted: true,
      voter,
      target,
      complete: this.isVotingComplete()
    };
  }

  isVotingComplete() {
    return this.livingPlayers.every((player) => this.votes.has(player.userId));
  }

  getVoteCounts() {
    const livingIds = new Set(this.livingPlayers.map((player) => player.userId));
    const counts = new Map(this.livingPlayers.map((player) => [player.userId, 0]));

    for (const [voterId, targetId] of this.votes.entries()) {
      if (livingIds.has(voterId) && counts.has(targetId)) {
        counts.set(targetId, counts.get(targetId) + 1);
      }
    }

    return this.livingPlayers.map((player) => ({
      player,
      count: counts.get(player.userId) ?? 0
    }));
  }

  resolveVote() {
    const counts = this.getVoteCounts();
    const livingCount = this.livingPlayers.length;
    const majority = Math.floor(livingCount / 2) + 1;
    const maxVotes = counts.reduce((max, entry) => Math.max(max, entry.count), 0);
    const tied = counts.filter((entry) => entry.count === maxVotes && maxVotes > 0);

    let executed = null;
    let reason = 'no_majority';
    if (maxVotes >= majority && tied.length === 1) {
      executed = this.killPlayer(tied[0].player.userId, { phase: 'vote' });
      reason = 'executed';
    } else if (maxVotes >= majority && tied.length > 1) {
      reason = 'tie';
    }

    const result = {
      round: this.round,
      counts,
      livingCount,
      majority,
      maxVotes,
      tied: tied.map((entry) => entry.player),
      executed,
      noExecution: !executed,
      reason,
      win: this.checkWin()
    };

    this.voteHistory.push(result);
    this.clearVotes();
    return result;
  }

  killPlayer(userId, { phase }) {
    const player = this.getPlayer(userId);
    if (!player?.alive) return null;

    player.alive = false;
    player.deathRound = this.round;
    player.deathPhase = phase;
    return player;
  }

  advanceRound() {
    this.round += 1;
    this.clearNightActions();
    this.clearVotes();
    return this.round;
  }

  checkWin() {
    const mafiaAlive = this.livingPlayers.filter((player) => player.role === 'mafia').length;
    const nonMafiaAlive = this.livingPlayers.length - mafiaAlive;

    if (mafiaAlive <= 0) {
      return {
        winner: 'citizens',
        reason: '모든 마피아가 사망했습니다.',
        mafiaAlive,
        nonMafiaAlive
      };
    }

    if (mafiaAlive >= nonMafiaAlive) {
      return {
        winner: 'mafia',
        reason: '마피아 수가 시민 팀 수 이상이 되었습니다.',
        mafiaAlive,
        nonMafiaAlive
      };
    }

    return null;
  }
}

export function getMafiaRoleDistribution(playerCount) {
  const count = Number(playerCount);
  const distribution = MAFIA_ROLE_DISTRIBUTIONS.find((candidate) => count >= candidate.min && count <= candidate.max);
  if (!distribution) {
    throw new Error(`마피아게임은 ${MAFIA_MIN_PLAYERS}~${MAFIA_MAX_PLAYERS}명으로 시작할 수 있습니다.`);
  }

  const citizen = count - distribution.mafia - distribution.police - distribution.doctor;
  if (citizen < 0) {
    throw new Error('역할 분포가 참가자 수보다 많습니다.');
  }

  return {
    mafia: distribution.mafia,
    police: distribution.police,
    doctor: distribution.doctor,
    citizen
  };
}

export function getMafiaRoleLabel(role) {
  return getRoleConfig(role).label;
}

export function getMafiaTeam(role) {
  return getRoleConfig(role).team;
}

function assignRoles(players, randomInt, roleAssignments) {
  if (roleAssignments) {
    const assignments = normalizeRoleAssignments(roleAssignments);
    return players.map((player) => createMafiaPlayer(player, assignments.get(player.userId) ?? 'citizen'));
  }

  const distribution = getMafiaRoleDistribution(players.length);
  const roles = [
    ...Array.from({ length: distribution.mafia }, () => 'mafia'),
    ...Array.from({ length: distribution.police }, () => 'police'),
    ...Array.from({ length: distribution.doctor }, () => 'doctor'),
    ...Array.from({ length: distribution.citizen }, () => 'citizen')
  ];
  const shuffledRoles = shuffle(roles, randomInt);

  return players.map((player, index) => createMafiaPlayer(player, shuffledRoles[index] ?? 'citizen'));
}

function normalizeRoleAssignments(roleAssignments) {
  const entries = roleAssignments instanceof Map
    ? [...roleAssignments.entries()]
    : Object.entries(roleAssignments ?? {});
  const normalized = new Map();

  for (const [userId, role] of entries) {
    const normalizedUserId = normalizeText(userId);
    const normalizedRole = normalizeRole(role);
    if (normalizedUserId && normalizedRole) normalized.set(normalizedUserId, normalizedRole);
  }

  return normalized;
}

function createMafiaPlayer(player, role) {
  return {
    ...player,
    role: normalizeRole(role) ?? 'citizen',
    alive: true,
    deathRound: null,
    deathPhase: null
  };
}

function normalizePlayers(players) {
  const seen = new Set();
  return [...(players ?? [])].map((player) => ({
    userId: normalizeText(player.userId),
    username: normalizeText(player.username) || '플레이어',
    bot: Boolean(player.bot)
  })).filter((player) => {
    if (!player.userId || player.bot || seen.has(player.userId)) return false;
    seen.add(player.userId);
    return true;
  });
}

function validatePlayerCount(count) {
  if (count < MAFIA_MIN_PLAYERS || count > MAFIA_MAX_PLAYERS) {
    throw new Error(`마피아게임은 ${MAFIA_MIN_PLAYERS}~${MAFIA_MAX_PLAYERS}명으로 시작할 수 있습니다.`);
  }
}

function countRoles(players) {
  return ROLE_ORDER.reduce((counts, role) => ({
    ...counts,
    [role]: players.filter((player) => player.role === role).length
  }), {});
}

function getRoleConfig(role) {
  return MAFIA_ROLES[normalizeRole(role)] ?? MAFIA_ROLES.citizen;
}

function normalizeRole(role) {
  const value = normalizeText(role).toLowerCase();
  return Object.hasOwn(MAFIA_ROLES, value) ? value : null;
}

function shuffle(items, randomInt) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function rejected(code, reason) {
  return { accepted: false, code, reason };
}

function normalizeText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function defaultRandomInt(max) {
  return Math.floor(Math.random() * max);
}
