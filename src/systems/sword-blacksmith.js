import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSwordAssetName } from './sword-assets.js';

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(CURRENT_DIR, '..', '..');
const BLACKSMITH_ASSET_ROOT = join(REPO_ROOT, 'assets', 'sword', 'blacksmith');

const BLACKSMITH_ASSET_FILES = Object.freeze({
  success: 'blacksmith_success.png',
  maintain: 'blacksmith_maintain.png',
  destroy: 'blacksmith_destroy.png'
});

const BLACKSMITH_TRIBUTE_ASSET_FILES = Object.freeze([
  'blacksmith_hisashiburi.png',
  'blacksmith_coffin_dance.png'
]);

const RECENT_BLACKSMITH_MESSAGE_LIMIT = 4;
const MAX_RECENT_BLACKSMITH_MESSAGE_KEYS = 256;
const recentBlacksmithMessagesByPool = new Map();

const BLACKSMITH_MESSAGE_TEMPLATES = Object.freeze({
  success: Object.freeze([
    '붙었다. 『{swordName}』이 +{afterLevel}의 열을 받아냈다. 방금 망치 소리, 꽤 비쌌다.',
    '좋다. 『{swordName}』의 날이 한 겹 더 선명해졌다. 오늘 불꽃은 주인 편이군.',
    '『{swordName}』이 모루 위에서 제대로 울었다. 이건 성공이라고 크게 적어도 된다.',
    '축하한다. 『{swordName}』이 망치 박자를 끝까지 따라왔다.',
    '불꽃이 갈라지더니 『{swordName}』 안으로 쏙 들어갔다. 예쁘게 붙었군.',
    '『{swordName}』이 한 단계 더 버텼다. 이 정도 손맛이면 대장장이 체면은 살았다.',
    '번쩍했다. 『{swordName}』이 방금 자기 이름값을 조금 더 올렸다.',
    '『{swordName}』의 균형이 좋아졌다. 휘두르면 소리부터 달라질 거다.',
    '망치가 닿는 순간 『{swordName}』이 먼저 대답했다. 이런 날은 기분이 좋지.',
    '『{swordName}』이 열을 잘 먹었다. 오늘 재료 상태가 아주 순하다.',
    '성공이다. 『{swordName}』의 칼등에 새 불꽃이 앉았다.',
    '『{swordName}』이 모루를 흔들었다. 방금 건 우연이 아니라 실력이라고 해두자.',
    '잘 붙었다. 『{swordName}』이 이제 전보다 한 박자 빠르게 빛난다.',
    '『{swordName}』이 말썽 없이 올라갔다. 오랜만에 검이 말을 잘 듣는군.',
    '오늘 대장간 공기가 좋다. 『{swordName}』이 그 공기를 전부 빨아먹었다.',
    '『{swordName}』의 결이 가지런해졌다. 이건 들고 나가서 자랑해도 된다.',
    '망치 한 번에 『{swordName}』의 기세가 달라졌다. 주인 운도 나쁘지 않군.',
    '『{swordName}』이 불꽃을 삼켰다. 다음 강화가 벌써 욕심나겠는데?',
    '성공. 『{swordName}』이 방금 모루 위에서 한 살 더 먹었다.',
    '『{swordName}』의 울림이 맑다. 이 소리는 터질 소리가 아니라 붙는 소리다.',
    '좋은 결과다. 『{swordName}』이 +{beforeLevel}에서 +{afterLevel}로 깔끔하게 넘어왔다.',
    '『{swordName}』이 주인을 실망시키지 않았다. 오늘 망치값은 했다.'
  ]),
  advancedSuccess: Object.freeze([
    '제련석이 제대로 녹았다. 『{swordName}』이 한 번에 +{gain}만큼 뛰어오른 건 꽤 큰 사건이다.',
    '『{swordName}』이 제련석 열기를 통째로 받아먹었다. 이래서 상급강화 맛을 보는 거지.',
    '상급 제련 성공이다. 『{swordName}』의 결이 여러 겹 동시에 맞물렸다.',
    '제련석 박자가 좋았다. 『{swordName}』이 모루 위에서 계단을 건너뛰었다.',
    '『{swordName}』이 새 검처럼 다시 섰다. 방금 상승은 평범한 강화가 아니다.',
    '한 번에 +{gain}. 『{swordName}』이 제련석을 먹고 성질까지 바뀌었다.',
    '제련석 불꽃이 길을 열었다. 『{swordName}』이 예상보다 훨씬 멀리 갔다.',
    '『{swordName}』이 상급강화 값을 했다. 오늘 모루가 아주 신났다.',
    '제련석이 아깝지 않다. 『{swordName}』이 +{beforeLevel}에서 +{afterLevel}까지 치고 올라갔다.',
    '상급강화 대성공이다. 『{swordName}』이 불꽃을 여러 번 접어 삼켰다.',
    '『{swordName}』의 속철이 크게 열렸다. 제련석 흐름이 완전히 맞았다.',
    '이 정도면 대장간 기록장에 남긴다. 『{swordName}』이 한 번에 판을 바꿨다.',
    '제련석 열기가 『{swordName}』의 칼끝까지 돌았다. 주인 운이 꽤 세군.',
    '『{swordName}』이 방금 등급표를 찢고 올라갔다. 상급강화답다.',
    '한 방이 컸다. 『{swordName}』이 모루 위에서 여러 계단을 한꺼번에 밟았다.',
    '제련석이 검 안에서 터졌다. 『{swordName}』이 더 날카로운 이름으로 바뀌었다.'
  ]),
  maintain: Object.freeze([
    '아깝군. 『{swordName}』이 거의 다듬어졌는데 마지막 박자를 밀어냈다.',
    '『{swordName}』이 망치 소리를 튕겨 냈다. 안 깨진 걸 다행으로 봐라.',
    '불꽃은 좋았는데 결이 잠깐 비틀렸다. 『{swordName}』은 다음 차례를 기다리는군.',
    '괜찮다. 『{swordName}』이 숨 한번 고른 거다. 검은 아직 멀쩡하다.',
    '망치가 삐끗했다. 『{swordName}』은 버텼고 내 자존심만 살짝 금 갔다.',
    '『{swordName}』이 고집을 부렸다. 붙진 않았지만 깨지지도 않았으니 절반은 이겼다.',
    '모루가 떨리긴 했는데 끝까지 안 넘어갔다. 『{swordName}』이 버틴 값은 했다.',
    '날은 섰는데 마지막 불꽃이 비켜 갔다. 『{swordName}』은 그대로다.',
    '『{swordName}』이 오늘은 신중하군. 강화는 미뤘지만 목숨은 건졌다.',
    '유지다. 『{swordName}』이 한 발 물러섰지만 재가 되진 않았다.',
    '『{swordName}』의 속철이 닫혔다. 다음 열기에는 좀 더 세게 두드려야겠다.',
    '망치가 쉬어 가자고 했다. 『{swordName}』은 아직 대장간을 떠나지 않았다.',
    '『{swordName}』이 버텼다. 실패라기보단 검이 간을 본 거라고 해두자.',
    '불꽃이 짧았다. 『{swordName}』은 그대로지만 다음엔 더 깊게 달궈 보자.',
    '『{swordName}』이 마지막 순간에 몸을 틀었다. 까다로운 검일수록 오래 간다.',
    '아슬아슬했다. 『{swordName}』이 부서질 뻔했지만 결국 제자리로 돌아왔다.',
    '『{swordName}』은 유지. 네 골드만 살짝 울고 검은 멀쩡하다.',
    '재료가 예민했다. 『{swordName}』이 오늘은 열을 끝까지 안 받는군.',
    '『{swordName}』이 모루를 이겼다. 붙지는 않았지만 버티는 것도 실력이다.',
    '숨 쉬어라. 『{swordName}』도 안 깨졌고 다음 기회도 남았다.',
    '『{swordName}』의 기운이 엇나갔다. 그래도 형태는 흐트러지지 않았다.',
    '이번 망치는 깊이가 부족했다. 『{swordName}』은 다음 한 방을 기다리는 중이다.'
  ]),
  destroy: Object.freeze([
    '미안하다. 『{swordName}』이 대장간 불꽃 속에서 재가 됐다. 그래도 처음부터 다시 세울 수 있다.',
    '터졌다. 『{swordName}』이 방금 모루 밑 전설 후보에서 쇳가루 후보로 바뀌었다.',
    '아프다. 『{swordName}』이 끝내 불꽃을 못 견뎠다. 오늘 대장간은 조용히 하자.',
    '『{swordName}』이 산산조각났다. 내 망치 탓은 아니고, 검이 먼저 겁먹은 거다.',
    '불꽃이 너무 깊게 물었다. 『{swordName}』이 버티기엔 오늘 운이 사나웠다.',
    '울지 마라. 『{swordName}』은 터졌지만 네 집념은 아직 안 터졌다.',
    '『{swordName}』의 속철이 갈라졌다. 대장간 바닥에 떨어진 건 내가 나중에 쓸어 담겠다.',
    '재가 됐다. 『{swordName}』의 이름은 기억해 두마. 다음 검이 복수하면 된다.',
    '큰 소리였다. 『{swordName}』이 무너질 때 대장간 천장까지 울렸다.',
    '『{swordName}』이 불꽃에 먹혔다. 오늘은 검보다 화로가 더 셌다.',
    '처음부터 다시 간다. 『{swordName}』의 실패도 다음 검의 재료가 될 거다.',
    '『{swordName}』이 터졌다. 그래도 모루는 남아 있고, 대장장이는 도망 안 간다.',
    '장례식은 짧게 하자. 『{swordName}』은 갔지만 강화 버튼은 살아 있다.',
    '『{swordName}』의 그릇이 열을 못 버텼다. 고강화의 냄새는 원래 매섭다.',
    '불꽃이 웃었다. 『{swordName}』은 못 웃었다. 대장간 분위기가 좀 무겁군.',
    '『{swordName}』이 가루가 됐다. 다음 검에는 이 경험까지 섞어서 두드리자.',
    '조문은 받겠다. 『{swordName}』이 사라진 자리에 새 모험이 생겼다.',
    '『{swordName}』이 무너졌다. 아프지만 이 판은 원래 모루와 배짱 싸움이다.',
    '터진 소리가 깔끔했다. 『{swordName}』은 졌고, 화로는 오늘 승리했다.',
    '『{swordName}』이 마지막까지 버티다 불꽃에 삼켜졌다. 다음엔 더 단단히 접자.'
  ]),
  protect: Object.freeze([
    '보호권이 먼저 뛰어들었다. 『{swordName}』은 흠집만 내고 살아남았다.',
    '『{swordName}』이 부서질 뻔했지만 보호권이 모루 앞을 막았다.',
    '좋은 종이를 썼군. 보호권 덕에 『{swordName}』이 오늘도 숨을 쉰다.',
    '불꽃이 물었지만 보호권이 대신 탔다. 『{swordName}』은 유지다.',
    '『{swordName}』은 살았다. 보호권은 장렬하게 산화했지만 값은 했다.',
    '망치가 위험했다. 보호권이 아니었으면 『{swordName}』은 지금 가루였다.',
    '『{swordName}』이 한 번 죽었다가 보호권 때문에 돌아왔다고 봐도 된다.',
    '보호권 발동. 『{swordName}』은 그대로고, 내 심장만 잠깐 멈췄다.'
  ])
});

export function getBlacksmithAssetAttachment(outcome = 'maintain') {
  const normalizedOutcome = normalizeBlacksmithOutcome(outcome);
  const fileName = BLACKSMITH_ASSET_FILES[normalizedOutcome];
  const filePath = join(BLACKSMITH_ASSET_ROOT, fileName);

  if (!existsSync(filePath)) return null;

  return {
    attachment: filePath,
    name: fileName
  };
}

export function getRandomBlacksmithTributeAssetAttachment(random = Math.random) {
  const index = Math.min(
    BLACKSMITH_TRIBUTE_ASSET_FILES.length - 1,
    Math.floor(normalizeRandom(random) * BLACKSMITH_TRIBUTE_ASSET_FILES.length)
  );
  const fileName = BLACKSMITH_TRIBUTE_ASSET_FILES[index];
  const filePath = join(BLACKSMITH_ASSET_ROOT, fileName);

  if (!existsSync(filePath)) return null;

  return {
    attachment: filePath,
    name: fileName
  };
}

export function formatBlacksmithEnhancementLine(result, random = Math.random) {
  return `🔨 **대장장이**: "${getBlacksmithEnhancementMessage(result, random)}"`;
}

export function getBlacksmithEnhancementMessage(result = {}, random = Math.random) {
  const templates = getBlacksmithMessageTemplates(result);
  const messages = templates.map((template) => renderBlacksmithMessageTemplate(template, result));

  return pickRandomMessage(messages, random);
}

function getBlacksmithMessageTemplates(result = {}) {
  if (result.outcome === 'success' && result.mode === 'advanced' && result.levelGain > 1) {
    return BLACKSMITH_MESSAGE_TEMPLATES.advancedSuccess;
  }

  if (result.outcome === 'protect') {
    return BLACKSMITH_MESSAGE_TEMPLATES.protect;
  }

  return BLACKSMITH_MESSAGE_TEMPLATES[result.outcome] ?? BLACKSMITH_MESSAGE_TEMPLATES.maintain;
}

function renderBlacksmithMessageTemplate(template, result = {}) {
  const context = createBlacksmithMessageContext(result);

  return template.replaceAll(/\{(\w+)\}/g, (_, key) => String(context[key] ?? ''));
}

function createBlacksmithMessageContext(result = {}) {
  const beforeLevel = Math.max(0, Number(result.beforeLevel) || 0);
  const afterLevel = Math.max(0, Number(result.afterLevel) || 0);
  const levelGain = Math.max(0, Number(result.levelGain) || Math.max(0, afterLevel - beforeLevel));

  return {
    beforeLevel,
    afterLevel,
    gain: levelGain,
    swordName: getResultSwordName(result)
  };
}

function getResultSwordName(result = {}) {
  const outcome = result?.outcome;
  const level = outcome === 'success'
    ? Math.max(0, Number(result.afterLevel) || 0)
    : Math.max(0, Number(result.beforeLevel) || 0);

  return getSwordAssetName(level);
}

function normalizeBlacksmithOutcome(outcome) {
  return Object.hasOwn(BLACKSMITH_ASSET_FILES, outcome) ? outcome : 'maintain';
}

function normalizeRandom(random) {
  const value = typeof random === 'function' ? random() : random;
  if (!Number.isFinite(value)) return 0;

  return Math.max(0, Math.min(0.999999, value));
}

function pickRandomMessage(messages, random = Math.random) {
  const candidates = Array.isArray(messages) ? messages.filter(Boolean) : [];
  if (candidates.length === 0) return '';

  const recentPoolKey = shouldAvoidRecentBlacksmithMessage(random, candidates)
    ? candidates.join('\u0001')
    : null;
  const availableMessages = recentPoolKey
    ? getAvailableBlacksmithMessages(candidates, recentPoolKey)
    : candidates;
  const index = Math.min(
    availableMessages.length - 1,
    Math.floor(normalizeRandom(random) * availableMessages.length)
  );
  const message = availableMessages[index];

  if (recentPoolKey) {
    rememberBlacksmithMessage(recentPoolKey, message, candidates.length);
  }

  return message;
}

function shouldAvoidRecentBlacksmithMessage(random, messages) {
  return messages.length > 1 && typeof random === 'function' && random === Math.random;
}

function getAvailableBlacksmithMessages(messages, poolKey) {
  const recentMessages = recentBlacksmithMessagesByPool.get(poolKey);
  if (!recentMessages?.length) return messages;

  const availableMessages = messages.filter((message) => !recentMessages.includes(message));
  return availableMessages.length > 0 ? availableMessages : messages;
}

function rememberBlacksmithMessage(poolKey, message, poolSize) {
  const recentLimit = Math.min(RECENT_BLACKSMITH_MESSAGE_LIMIT, Math.max(1, poolSize - 1));
  const recentMessages = (recentBlacksmithMessagesByPool.get(poolKey) ?? [])
    .filter((recentMessage) => recentMessage !== message);
  recentMessages.push(message);

  while (recentMessages.length > recentLimit) {
    recentMessages.shift();
  }

  recentBlacksmithMessagesByPool.delete(poolKey);
  recentBlacksmithMessagesByPool.set(poolKey, recentMessages);

  while (recentBlacksmithMessagesByPool.size > MAX_RECENT_BLACKSMITH_MESSAGE_KEYS) {
    const oldestKey = recentBlacksmithMessagesByPool.keys().next().value;
    recentBlacksmithMessagesByPool.delete(oldestKey);
  }
}
