import { readFileSync } from 'node:fs';

export const LIAR_GAME_MIN_PLAYERS = 4;
export const LIAR_GAME_MAX_PLAYERS = 10;

export const LIAR_GAME_MODES = Object.freeze({
  normal: Object.freeze({
    value: 'normal',
    label: '일반',
    description: '라이어는 자신이 라이어라는 것만 알고 제시어는 모릅니다.'
  }),
  hard: Object.freeze({
    value: 'hard',
    label: '어려움',
    description: '역할을 공개하지 않고, 라이어도 같은 주제의 다른 제시어를 받습니다.'
  })
});

const DEFAULT_WORD_BANK_URL = new URL('../../data/liar-game-words.json', import.meta.url);
const MAX_DESCRIPTION_LENGTH = 300;

let defaultWordBank = null;

export class LiarGame {
  constructor({
    players,
    wordBank = loadLiarGameWordBank(),
    mode = LIAR_GAME_MODES.normal.value,
    categoryId = null,
    turnCount = 1,
    randomInt = defaultRandomInt
  }) {
    this.players = normalizePlayers(players);
    validatePlayerCount(this.players.length);

    this.wordBank = normalizeWordBank(wordBank);
    this.mode = getLiarGameMode(mode);
    this.turnCount = normalizeTurnCount(turnCount);
    this.randomInt = randomInt;
    this.category = chooseCategory(this.wordBank, categoryId, randomInt);
    this.targetWord = chooseWord(this.category.words, randomInt);
    this.liarUserId = choosePlayer(this.players, randomInt).userId;
    this.liarWord = this.mode.value === LIAR_GAME_MODES.hard.value
      ? chooseDifferentWord(this.category.words, this.targetWord, randomInt)
      : null;
    this.turnOrder = shufflePlayers(this.players, randomInt);
    this.turns = createTurns(this.turnOrder, this.turnCount);
    this.currentTurnIndex = 0;
    this.descriptions = [];
    this.votes = new Map();
    this.finalGuess = null;
  }

  get currentTurn() {
    return this.turns[this.currentTurnIndex] ?? null;
  }

  get isDescriptionComplete() {
    return this.currentTurnIndex >= this.turns.length;
  }

  get liar() {
    return this.players.find((player) => player.userId === this.liarUserId) ?? null;
  }

  getAssignment(userId) {
    const player = this.getPlayer(userId);
    if (!player) return null;

    const isLiar = player.userId === this.liarUserId;
    return {
      player,
      isLiar,
      category: this.category,
      mode: this.mode,
      word: isLiar
        ? this.mode.value === LIAR_GAME_MODES.hard.value ? this.liarWord : null
        : this.targetWord
    };
  }

  getPlayer(userId) {
    return this.players.find((player) => player.userId === userId) ?? null;
  }

  submitDescription({ userId, text }) {
    const current = this.currentTurn;
    if (!current) {
      return { accepted: false, code: 'complete', reason: '이미 설명 단계가 끝났습니다.' };
    }

    if (current.player.userId !== userId) {
      return { accepted: false, code: 'not_turn', reason: '현재 설명 차례가 아닙니다.' };
    }

    const description = normalizeDescription(text);
    if (!description) {
      return { accepted: false, code: 'empty', reason: '설명을 비워둘 수 없습니다.' };
    }

    const entry = {
      player: current.player,
      round: current.round,
      text: description,
      skipped: false
    };
    this.descriptions.push(entry);
    this.currentTurnIndex += 1;

    return {
      accepted: true,
      entry,
      completed: this.isDescriptionComplete,
      nextTurn: this.currentTurn
    };
  }

  skipCurrentDescription(reason = '시간 초과') {
    const current = this.currentTurn;
    if (!current) return null;

    const entry = {
      player: current.player,
      round: current.round,
      text: reason,
      skipped: true
    };
    this.descriptions.push(entry);
    this.currentTurnIndex += 1;

    return {
      entry,
      completed: this.isDescriptionComplete,
      nextTurn: this.currentTurn
    };
  }

  clearVotes() {
    this.votes.clear();
  }

  castVote({ voterId, targetId, allowedTargetIds = null }) {
    const voter = this.getPlayer(voterId);
    if (!voter) {
      return { accepted: false, code: 'not_player', reason: '참가자만 투표할 수 있습니다.' };
    }

    const target = this.getPlayer(targetId);
    if (!target) {
      return { accepted: false, code: 'invalid_target', reason: '투표 대상이 아닙니다.' };
    }

    const allowed = allowedTargetIds ? new Set(allowedTargetIds) : null;
    if (allowed && !allowed.has(targetId)) {
      return { accepted: false, code: 'invalid_target', reason: '이번 투표의 후보가 아닙니다.' };
    }

    if (voterId === targetId) {
      return { accepted: false, code: 'self_vote', reason: '자기 자신에게는 투표할 수 없습니다.' };
    }

    this.votes.set(voterId, targetId);
    return { accepted: true, voter, target };
  }

  getVoteCounts(allowedTargetIds = null) {
    const allowed = allowedTargetIds ? new Set(allowedTargetIds) : null;
    const targets = this.players.filter((player) => !allowed || allowed.has(player.userId));
    const counts = new Map(targets.map((player) => [player.userId, 0]));

    for (const targetId of this.votes.values()) {
      if (counts.has(targetId)) {
        counts.set(targetId, counts.get(targetId) + 1);
      }
    }

    return targets.map((player) => ({
      player,
      count: counts.get(player.userId) ?? 0
    }));
  }

  isVotingComplete(allowedTargetIds = null) {
    const allowed = allowedTargetIds ? new Set(allowedTargetIds) : null;
    return this.players.every((player) => {
      const targetId = this.votes.get(player.userId);
      return targetId && (!allowed || allowed.has(targetId));
    });
  }

  resolveVote(allowedTargetIds = null) {
    const counts = this.getVoteCounts(allowedTargetIds);
    const totalVotes = [...this.votes.values()].filter((targetId) => counts.some((entry) => entry.player.userId === targetId)).length;
    const maxVotes = counts.reduce((max, entry) => Math.max(max, entry.count), 0);

    if (totalVotes === 0 || maxVotes === 0) {
      return {
        noVotes: true,
        totalVotes,
        counts,
        tiedUserIds: [],
        accused: null,
        accusedIsLiar: false
      };
    }

    const tied = counts.filter((entry) => entry.count === maxVotes).map((entry) => entry.player);
    return {
      noVotes: false,
      totalVotes,
      counts,
      tiedUserIds: tied.map((player) => player.userId),
      tie: tied.length > 1,
      accused: tied.length === 1 ? tied[0] : null,
      accusedIsLiar: tied.length === 1 && tied[0].userId === this.liarUserId
    };
  }

  submitFinalGuess(guess) {
    const normalizedGuess = normalizeLiarGuess(guess);
    const normalizedAnswer = normalizeLiarGuess(this.targetWord);
    const correct = normalizedGuess === normalizedAnswer;

    this.finalGuess = {
      guess: String(guess ?? '').trim(),
      correct
    };

    return this.finalGuess;
  }
}

export function loadLiarGameWordBank(url = DEFAULT_WORD_BANK_URL) {
  if (url === DEFAULT_WORD_BANK_URL && defaultWordBank) return defaultWordBank;

  const parsed = JSON.parse(readFileSync(url, 'utf8'));
  const wordBank = normalizeWordBank(parsed);

  if (url === DEFAULT_WORD_BANK_URL) defaultWordBank = wordBank;
  return wordBank;
}

export function getLiarGameCategoryChoices(wordBank = loadLiarGameWordBank()) {
  return normalizeWordBank(wordBank).categories.map((category) => ({
    name: category.name,
    value: category.id
  }));
}

export function getLiarGameMode(value = LIAR_GAME_MODES.normal.value) {
  return LIAR_GAME_MODES[value] ?? LIAR_GAME_MODES.normal;
}

export function normalizeLiarGuess(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('ko-KR');
}

function normalizeWordBank(wordBank) {
  const categories = Array.isArray(wordBank?.categories) ? wordBank.categories : [];
  const normalizedCategories = categories.map((category) => ({
    id: normalizeIdentifier(category.id),
    name: normalizeText(category.name),
    words: normalizeWords(category.words)
  })).filter((category) => category.id && category.name && category.words.length >= 2);

  if (normalizedCategories.length < 1) {
    throw new Error('라이어게임 제시어 카테고리가 필요합니다.');
  }

  return { categories: normalizedCategories };
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
  if (count < LIAR_GAME_MIN_PLAYERS || count > LIAR_GAME_MAX_PLAYERS) {
    throw new Error(`라이어게임은 ${LIAR_GAME_MIN_PLAYERS}~${LIAR_GAME_MAX_PLAYERS}명으로 시작할 수 있습니다.`);
  }
}

function normalizeTurnCount(value) {
  const count = Number(value);
  return count === 2 ? 2 : 1;
}

function chooseCategory(wordBank, categoryId, randomInt) {
  if (categoryId) {
    const category = wordBank.categories.find((candidate) => candidate.id === categoryId);
    if (category) return category;
  }

  return wordBank.categories[randomInt(wordBank.categories.length)];
}

function chooseWord(words, randomInt) {
  return words[randomInt(words.length)];
}

function chooseDifferentWord(words, targetWord, randomInt) {
  const candidates = words.filter((word) => word !== targetWord);
  return candidates[randomInt(candidates.length)];
}

function choosePlayer(players, randomInt) {
  return players[randomInt(players.length)];
}

function shufflePlayers(players, randomInt) {
  const shuffled = [...players];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function createTurns(players, turnCount) {
  return Array.from({ length: turnCount }, (_, roundIndex) =>
    players.map((player) => ({ player, round: roundIndex + 1 }))
  ).flat();
}

function normalizeWords(words) {
  return [...new Set((Array.isArray(words) ? words : [])
    .map((word) => normalizeText(word))
    .filter(Boolean))];
}

function normalizeDescription(text) {
  const normalized = normalizeText(text);
  return normalized.length > MAX_DESCRIPTION_LENGTH
    ? `${normalized.slice(0, MAX_DESCRIPTION_LENGTH - 1)}…`
    : normalized;
}

function normalizeIdentifier(value) {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function defaultRandomInt(max) {
  return Math.floor(Math.random() * max);
}
