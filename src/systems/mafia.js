export const MAFIA_MIN_PLAYERS = 4;
export const MAFIA_MAX_PLAYERS = 12;

export const MAFIA_ROLES = Object.freeze({
  mafia: 'mafia',
  police: 'police',
  doctor: 'doctor',
  citizen: 'citizen'
});

export const MAFIA_TEAMS = Object.freeze({
  mafia: 'mafia',
  citizens: 'citizens'
});

const ROLE_LABELS = Object.freeze({
  [MAFIA_ROLES.mafia]: '마피아',
  [MAFIA_ROLES.police]: '경찰',
  [MAFIA_ROLES.doctor]: '의사',
  [MAFIA_ROLES.citizen]: '시민'
});

const ROLE_EMOJIS = Object.freeze({
  [MAFIA_ROLES.mafia]: '🔪',
  [MAFIA_ROLES.police]: '🔎',
  [MAFIA_ROLES.doctor]: '💊',
  [MAFIA_ROLES.citizen]: '👤'
});

let nextMafiaGameSequence = 1;

export class MafiaGame {
  constructor({
    id = createMafiaGameId(Date.now()),
    guildId = 'guild',
    channelId = 'channel',
    players,
    revealGhostRoles = false,
    roleAssignments = null,
    randomInt = defaultRandomInt,
    now = () => Date.now()
  }) {
    const normalizedPlayers = normalizeMafiaPlayers(players);
    if (normalizedPlayers.length < MAFIA_MIN_PLAYERS || normalizedPlayers.length > MAFIA_MAX_PLAYERS) {
      throw new Error(`마피아 게임은 ${MAFIA_MIN_PLAYERS}~${MAFIA_MAX_PLAYERS}명이어야 합니다.`);
    }

    this.id = id;
    this.guildId = normalizeId(guildId, 'guildId');
    this.channelId = normalizeId(channelId, 'channelId');
    this.players = normalizedPlayers.map((player) => ({
      ...player,
      role: null,
      alive: true,
      eliminatedAt: null,
      eliminatedBy: null
    }));
    this.revealGhostRoles = Boolean(revealGhostRoles);
    this.randomInt = randomInt;
    this.now = now;
    this.phase = 'setup';
    this.dayNumber = 0;
    this.nightNumber = 0;
    this.winner = null;
    this.completedReason = null;
    this.nightActions = createEmptyNightActions();
    this.nominationVotes = new Map();
    this.approvalVotes = new Map();
    this.approvalCandidateId = null;
    this.events = [];
    this.createdAt = this.now();
    this.updatedAt = this.createdAt;

    this.#assignRoles(roleAssignments);
    this.startNight();
  }

  get alivePlayers() {
    return this.players.filter((player) => player.alive);
  }

  get deadPlayers() {
    return this.players.filter((player) => !player.alive);
  }

  get aliveMafia() {
    return this.alivePlayers.filter((player) => player.role === MAFIA_ROLES.mafia);
  }

  get aliveCitizensTeam() {
    return this.alivePlayers.filter((player) => player.role !== MAFIA_ROLES.mafia);
  }

  get mafiaPlayers() {
    return this.players.filter((player) => player.role === MAFIA_ROLES.mafia);
  }

  get policePlayer() {
    return this.players.find((player) => player.role === MAFIA_ROLES.police) ?? null;
  }

  get doctorPlayer() {
    return this.players.find((player) => player.role === MAFIA_ROLES.doctor) ?? null;
  }

  get roleCounts() {
    return countRoles(this.players);
  }

  getAssignment(userId) {
    const player = this.getPlayer(userId);
    if (!player) return null;

    return {
      player: publicPlayer(player),
      role: player.role,
      roleLabel: formatMafiaRoleLabel(player.role),
      roleEmoji: formatMafiaRoleEmoji(player.role),
      team: player.role === MAFIA_ROLES.mafia ? MAFIA_TEAMS.mafia : MAFIA_TEAMS.citizens,
      mafiaTeammates: player.role === MAFIA_ROLES.mafia
        ? this.mafiaPlayers.map(publicPlayer)
        : []
    };
  }

  getPlayer(userId) {
    const normalizedUserId = String(userId);
    return this.players.find((player) => player.userId === normalizedUserId) ?? null;
  }

  requirePlayer(userId) {
    const player = this.getPlayer(userId);
    if (!player) throw new Error('이 마피아 게임의 참가자가 아닙니다.');
    return player;
  }

  startNight() {
    if (this.winner) {
      this.phase = 'ended';
      return;
    }

    this.phase = 'night';
    this.nightNumber += 1;
    this.nightActions = createEmptyNightActions();
    this.nominationVotes.clear();
    this.approvalVotes.clear();
    this.approvalCandidateId = null;
    this.updatedAt = this.now();
  }

  castNightAction({ userId, targetId }) {
    if (this.phase !== 'night') {
      throw new Error('현재 밤 행동 시간이 아닙니다.');
    }

    const actor = this.requireAlivePlayer(userId);
    const target = this.requireAlivePlayer(targetId);

    if (actor.role === MAFIA_ROLES.citizen) {
      throw new Error('시민은 밤에 사용할 능력이 없습니다.');
    }

    if (actor.role === MAFIA_ROLES.mafia) {
      if (target.role === MAFIA_ROLES.mafia) {
        throw new Error('마피아는 같은 마피아를 처형 대상으로 지정할 수 없습니다.');
      }

      this.nightActions.mafiaVotes.set(actor.userId, target.userId);
      this.nightActions.mafiaVoteSequence.push({
        actorId: actor.userId,
        targetId: target.userId,
        sequence: this.nightActions.mafiaVoteSequence.length + 1
      });
      this.updatedAt = this.now();
      return {
        accepted: true,
        type: 'mafia',
        actor: publicPlayer(actor),
        target: publicPlayer(target),
        complete: this.isNightActionComplete()
      };
    }

    if (actor.role === MAFIA_ROLES.police) {
      if (actor.userId === target.userId) {
        throw new Error('경찰은 자기 자신을 조사할 수 없습니다.');
      }
      if (this.nightActions.police) {
        throw new Error('경찰은 이미 이번 밤 조사를 마쳤습니다.');
      }

      this.nightActions.police = {
        actorId: actor.userId,
        targetId: target.userId,
        targetIsMafia: target.role === MAFIA_ROLES.mafia
      };
      this.updatedAt = this.now();
      return {
        accepted: true,
        type: 'police',
        actor: publicPlayer(actor),
        target: publicPlayer(target),
        targetIsMafia: target.role === MAFIA_ROLES.mafia,
        complete: this.isNightActionComplete()
      };
    }

    if (actor.role === MAFIA_ROLES.doctor) {
      if (this.nightActions.doctor) {
        throw new Error('의사는 이미 이번 밤 치료 대상을 정했습니다.');
      }

      this.nightActions.doctor = {
        actorId: actor.userId,
        targetId: target.userId
      };
      this.updatedAt = this.now();
      return {
        accepted: true,
        type: 'doctor',
        actor: publicPlayer(actor),
        target: publicPlayer(target),
        complete: this.isNightActionComplete()
      };
    }

    throw new Error('알 수 없는 역할입니다.');
  }

  isNightActionComplete() {
    if (this.phase !== 'night') return false;

    const aliveMafia = this.aliveMafia;
    const mafiaComplete = aliveMafia.length === 0
      || aliveMafia.every((player) => this.nightActions.mafiaVotes.has(player.userId));
    const police = this.policePlayer;
    const policeComplete = !police?.alive || Boolean(this.nightActions.police);
    const doctor = this.doctorPlayer;
    const doctorComplete = !doctor?.alive || Boolean(this.nightActions.doctor);

    return mafiaComplete && policeComplete && doctorComplete;
  }

  resolveNight() {
    if (this.phase !== 'night') {
      throw new Error('현재 밤을 정산할 수 없습니다.');
    }

    const killCandidate = this.#resolveMafiaTarget();
    const protectedId = this.nightActions.doctor?.targetId ?? null;
    let death = null;
    let protectedTarget = null;
    let reason = 'no_target';

    if (killCandidate) {
      if (killCandidate.userId === protectedId) {
        protectedTarget = publicPlayer(killCandidate);
        reason = 'protected';
      } else {
        death = this.#eliminatePlayer(killCandidate.userId, 'night');
        reason = 'killed';
      }
    }

    const result = {
      phase: 'night',
      nightNumber: this.nightNumber,
      killTarget: killCandidate ? publicPlayer(killCandidate) : null,
      protectedTarget,
      death,
      reason,
      police: this.nightActions.police ? {
        target: publicPlayer(this.requirePlayer(this.nightActions.police.targetId)),
        targetIsMafia: this.nightActions.police.targetIsMafia
      } : null
    };

    this.nightActions = createEmptyNightActions();
    this.#updateWinner();

    if (!this.winner) {
      this.phase = 'day_discussion';
      this.dayNumber += 1;
    }

    this.events.push(result);
    this.updatedAt = this.now();
    return result;
  }

  beginNominationVote() {
    if (this.phase !== 'day_discussion') {
      throw new Error('현재 자유투표를 시작할 수 없습니다.');
    }

    this.phase = 'nomination';
    this.nominationVotes.clear();
    this.updatedAt = this.now();
  }

  castNominationVote({ voterId, targetId }) {
    if (this.phase !== 'nomination') {
      throw new Error('현재 자유투표 시간이 아닙니다.');
    }

    const voter = this.requireAlivePlayer(voterId);
    const target = this.requireAlivePlayer(targetId);
    if (voter.userId === target.userId) {
      throw new Error('자기 자신에게는 투표할 수 없습니다.');
    }

    this.nominationVotes.set(voter.userId, target.userId);
    this.updatedAt = this.now();
    return {
      accepted: true,
      voter: publicPlayer(voter),
      target: publicPlayer(target),
      complete: this.isNominationVoteComplete(),
      tally: this.getNominationTally()
    };
  }

  isNominationVoteComplete() {
    return this.phase === 'nomination' && this.nominationVotes.size >= this.alivePlayers.length;
  }

  getNominationTally() {
    return createTargetTally(this.alivePlayers, this.nominationVotes, this.players);
  }

  resolveNominationVote() {
    if (this.phase !== 'nomination') {
      throw new Error('현재 자유투표를 정산할 수 없습니다.');
    }

    const tally = this.getNominationTally();
    const votedEntries = tally.filter((entry) => entry.count > 0);
    let result;

    if (votedEntries.length === 0) {
      result = {
        phase: 'nomination',
        noVotes: true,
        tie: false,
        candidate: null,
        tiedUserIds: [],
        tally
      };
      this.startNight();
      return result;
    }

    const maxCount = Math.max(...votedEntries.map((entry) => entry.count));
    const leaders = votedEntries.filter((entry) => entry.count === maxCount);

    if (leaders.length !== 1) {
      result = {
        phase: 'nomination',
        noVotes: false,
        tie: true,
        candidate: null,
        tiedUserIds: leaders.map((entry) => entry.player.userId),
        tally
      };
      this.startNight();
      return result;
    }

    this.phase = 'approval';
    this.approvalCandidateId = leaders[0].player.userId;
    this.approvalVotes.clear();
    this.updatedAt = this.now();

    return {
      phase: 'nomination',
      noVotes: false,
      tie: false,
      candidate: leaders[0].player,
      tiedUserIds: [],
      tally
    };
  }

  castApprovalVote({ voterId, approve }) {
    if (this.phase !== 'approval') {
      throw new Error('현재 찬반투표 시간이 아닙니다.');
    }

    const voter = this.requireAlivePlayer(voterId);
    this.approvalVotes.set(voter.userId, Boolean(approve));
    this.updatedAt = this.now();
    return {
      accepted: true,
      voter: publicPlayer(voter),
      approve: Boolean(approve),
      candidate: publicPlayer(this.requirePlayer(this.approvalCandidateId)),
      complete: this.isApprovalVoteComplete(),
      tally: this.getApprovalTally()
    };
  }

  isApprovalVoteComplete() {
    return this.phase === 'approval' && this.approvalVotes.size >= this.alivePlayers.length;
  }

  getApprovalTally() {
    const yes = [];
    const no = [];

    for (const [voterId, approve] of this.approvalVotes.entries()) {
      const voter = this.getPlayer(voterId);
      if (!voter) continue;
      (approve ? yes : no).push(publicPlayer(voter));
    }

    return {
      candidate: this.approvalCandidateId ? publicPlayer(this.requirePlayer(this.approvalCandidateId)) : null,
      yes,
      no,
      yesCount: yes.length,
      noCount: no.length,
      totalVotes: yes.length + no.length
    };
  }

  resolveApprovalVote() {
    if (this.phase !== 'approval') {
      throw new Error('현재 찬반투표를 정산할 수 없습니다.');
    }

    const tally = this.getApprovalTally();
    let death = null;
    let executed = false;

    if (tally.yesCount > tally.noCount && tally.yesCount > 0) {
      death = this.#eliminatePlayer(this.approvalCandidateId, 'trial');
      executed = true;
    }

    const result = {
      phase: 'approval',
      candidate: tally.candidate,
      tally,
      executed,
      death
    };

    this.approvalVotes.clear();
    this.approvalCandidateId = null;
    this.#updateWinner();

    if (!this.winner) {
      this.startNight();
    }

    this.events.push(result);
    this.updatedAt = this.now();
    return result;
  }

  end(reason = 'cancelled') {
    this.phase = 'ended';
    this.completedReason = reason;
    this.updatedAt = this.now();
  }

  requireAlivePlayer(userId) {
    const player = this.requirePlayer(userId);
    if (!player.alive) throw new Error('이미 사망한 참가자는 행동할 수 없습니다.');
    return player;
  }

  #assignRoles(roleAssignments) {
    const assignmentMap = roleAssignments ? normalizeRoleAssignments(roleAssignments) : null;

    if (assignmentMap) {
      for (const player of this.players) {
        const role = assignmentMap.get(player.userId);
        if (!role) throw new Error(`${player.username}님의 역할 배정이 없습니다.`);
        player.role = role;
      }
      validateRequiredRoles(this.players);
      return;
    }

    const composition = getMafiaRoleComposition(this.players.length);
    const roles = [
      ...Array.from({ length: composition.mafia }, () => MAFIA_ROLES.mafia),
      ...Array.from({ length: composition.police }, () => MAFIA_ROLES.police),
      ...Array.from({ length: composition.doctor }, () => MAFIA_ROLES.doctor),
      ...Array.from({ length: composition.citizen }, () => MAFIA_ROLES.citizen)
    ];
    const shuffledPlayers = shuffle(this.players, this.randomInt);

    shuffledPlayers.forEach((player, index) => {
      player.role = roles[index];
    });
  }

  #resolveMafiaTarget() {
    if (this.nightActions.mafiaVotes.size === 0) return null;

    const counts = new Map();
    for (const targetId of this.nightActions.mafiaVotes.values()) {
      counts.set(targetId, (counts.get(targetId) ?? 0) + 1);
    }

    const maxCount = Math.max(...counts.values());
    const tiedTargetIds = [...counts.entries()]
      .filter(([, count]) => count === maxCount)
      .map(([targetId]) => targetId);

    let targetId = tiedTargetIds[0];
    if (tiedTargetIds.length > 1) {
      const latestTieVote = [...this.nightActions.mafiaVoteSequence]
        .reverse()
        .find((entry) => tiedTargetIds.includes(entry.targetId));
      targetId = latestTieVote?.targetId ?? targetId;
    }

    const target = this.getPlayer(targetId);
    return target?.alive ? target : null;
  }

  #eliminatePlayer(userId, eliminatedBy) {
    const player = this.requireAlivePlayer(userId);
    player.alive = false;
    player.eliminatedAt = this.now();
    player.eliminatedBy = eliminatedBy;

    return {
      player: publicPlayer(player),
      role: this.revealGhostRoles ? player.role : null,
      roleLabel: this.revealGhostRoles ? formatMafiaRoleLabel(player.role) : null,
      eliminatedBy
    };
  }

  #updateWinner() {
    const mafiaCount = this.aliveMafia.length;
    const citizenTeamCount = this.aliveCitizensTeam.length;

    if (mafiaCount === 0) {
      this.winner = MAFIA_TEAMS.citizens;
      this.completedReason = 'all_mafia_eliminated';
      this.phase = 'ended';
      return this.winner;
    }

    if (mafiaCount >= citizenTeamCount) {
      this.winner = MAFIA_TEAMS.mafia;
      this.completedReason = 'mafia_parity';
      this.phase = 'ended';
      return this.winner;
    }

    return null;
  }
}

export function getMafiaRoleComposition(playerCount) {
  const count = Number(playerCount);
  if (!Number.isInteger(count) || count < MAFIA_MIN_PLAYERS || count > MAFIA_MAX_PLAYERS) {
    throw new Error(`마피아 게임은 ${MAFIA_MIN_PLAYERS}~${MAFIA_MAX_PLAYERS}명이어야 합니다.`);
  }

  const mafia = count <= 5 ? 1 : count <= 8 ? 2 : 3;
  const police = 1;
  const doctor = 1;
  const citizen = count - mafia - police - doctor;

  return { mafia, police, doctor, citizen };
}

export function formatMafiaRoleLabel(role) {
  return ROLE_LABELS[role] ?? String(role);
}

export function formatMafiaRoleEmoji(role) {
  return ROLE_EMOJIS[role] ?? '❔';
}

export function publicPlayer(player) {
  return {
    userId: player.userId,
    username: player.username,
    bot: Boolean(player.bot),
    alive: player.alive !== false
  };
}

export function normalizeMafiaPlayers(players) {
  if (!Array.isArray(players)) {
    throw new Error('참가자 목록이 필요합니다.');
  }

  const seen = new Set();
  return players.map((player) => {
    const userId = normalizeId(player.userId ?? player.id, 'userId');
    if (seen.has(userId)) throw new Error('중복된 참가자가 있습니다.');
    seen.add(userId);
    return {
      userId,
      username: String(player.username ?? player.displayName ?? player.globalName ?? userId),
      bot: Boolean(player.bot)
    };
  });
}

function createTargetTally(targetPlayers, votes, allPlayers) {
  const playersById = new Map(allPlayers.map((player) => [player.userId, player]));
  return targetPlayers.map((target) => {
    const voters = [...votes.entries()]
      .filter(([, targetId]) => targetId === target.userId)
      .map(([voterId]) => playersById.get(voterId))
      .filter(Boolean)
      .map(publicPlayer);

    return {
      player: publicPlayer(target),
      count: voters.length,
      voters
    };
  });
}

function createEmptyNightActions() {
  return {
    mafiaVotes: new Map(),
    mafiaVoteSequence: [],
    police: null,
    doctor: null
  };
}

function countRoles(players) {
  return Object.freeze({
    mafia: players.filter((player) => player.role === MAFIA_ROLES.mafia).length,
    police: players.filter((player) => player.role === MAFIA_ROLES.police).length,
    doctor: players.filter((player) => player.role === MAFIA_ROLES.doctor).length,
    citizen: players.filter((player) => player.role === MAFIA_ROLES.citizen).length
  });
}

function normalizeRoleAssignments(roleAssignments) {
  const entries = roleAssignments instanceof Map
    ? [...roleAssignments.entries()]
    : Object.entries(roleAssignments);
  const normalized = new Map();

  for (const [userId, role] of entries) {
    if (!Object.values(MAFIA_ROLES).includes(role)) {
      throw new Error(`알 수 없는 마피아 역할입니다: ${role}`);
    }
    normalized.set(String(userId), role);
  }

  return normalized;
}

function validateRequiredRoles(players) {
  const counts = countRoles(players);
  if (counts.mafia < 1) throw new Error('마피아 역할이 최소 1명 필요합니다.');
  if (counts.police > 1) throw new Error('경찰은 최대 1명입니다.');
  if (counts.doctor > 1) throw new Error('의사는 최대 1명입니다.');
}

function shuffle(items, randomInt) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index);
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function normalizeId(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    throw new Error(`${fieldName} 값이 필요합니다.`);
  }
  return String(value);
}

function defaultRandomInt(min, max) {
  const low = Math.ceil(min);
  const high = Math.floor(max);
  return Math.floor(Math.random() * (high - low + 1)) + low;
}

function createMafiaGameId(now) {
  return `mafia-${Number(now).toString(36)}-${nextMafiaGameSequence++}`;
}
