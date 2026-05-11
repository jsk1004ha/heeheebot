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

const BLACKSMITH_MESSAGES = Object.freeze({
  success: Object.freeze([
    '축하한다! 이건 망치가 아니라 불꽃이 붙인 명작이다.',
    '붙었다! 오늘 네 검은 모루 위에서 번쩍하고 태어났다.',
    '축하한다, 손맛이 아주 좋다. 이 검은 한동안 자랑해도 된다.',
    '불꽃이 대답했다. 이 강화는 성공할 운명이었어.',
    '명작 냄새가 난다. 방금 모루도 박수 친 거 봤냐?',
    '붙었다 붙었어! 오늘은 검도 너도 운이 살아 있다.',
    '번쩍했다! 이 정도면 대장장이 협회에 사진 보내야겠는데?',
    '축하한다. 방금 그 한 방은 나도 좀 멋있었다.'
  ]),
  maintain: Object.freeze([
    '아깝군, 거의 다듬어졌는데. 검 안쪽의 기운이 내 망치 박자를 밀어냈다. 오늘은 재료가 예민했던 걸로 하자.',
    '괜찮다. 검이 숨 한번 고른 거다, 다음 망치에 붙이면 된다.',
    '살았다! 이 정도면 실패가 아니라 검이 장난친 거다.',
    '망치가 삐끗했다. 검은 멀쩡하니 자존심만 수리하면 된다.',
    '다음엔 붙는다. 아마도. 아니, 내 망치가 그렇게 말한다.',
    '숨 쉬어라. 검도 안 깨졌고 네 돈만 살짝 울었다.',
    '괜찮아, 오늘 모루가 좀 까칠했다. 다음엔 달래서 때려 보자.',
    '유지라니 애매하군. 그래도 재가 안 된 걸 축하해라.',
    '망치가 쉬어 가자고 했다. 검은 아직 도망 안 갔다.',
    '날은 섰는데 마지막 불꽃이 비켜 갔다. 재료는 살아 있으니 다시 두드리면 된다.',
    '모루가 떨리긴 했는데 끝까지 안 넘어갔다. 나쁘지 않아, 다음 열기가 더 중요하다.',
    '검이 고집을 부렸다. 부러지진 않았으니 이번엔 버틴 값을 했다고 치자.'
  ]),
  destroy: Object.freeze([
    '미안하다. 검이 방금 재가 됐다. 그래도 처음부터 다시 전설 만들 수 있다.',
    '터졌다! 어... 울지 마라. 모루 밑에 희망은 아직 있다.',
    '재가 됐군. 내가 위로는 해주마, 놀림은 내일 하겠다.',
    '처음부터 다시 간다. 좋은 대장장이는 폐허에서도 검을 뽑는다.',
    '미안하다. 방금 소리는 실패가 아니라 새 출발의 종소리다.',
    '울지 마라. 검은 터졌지만 네 집념은 아직 안 터졌다.',
    '재료가 가루가 됐다. 다음 검은 그 쇳가루까지 섞어서 더 세게 만들자.',
    '터졌지만 끝은 아니다. 모루는 배신해도 대장장이는 남는다.'
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

export function getBlacksmithEnhancementMessage(result, random = Math.random) {
  const specialMessage = getSpecialBlacksmithMessage(result, random);
  if (specialMessage) return specialMessage;

  const outcome = result?.outcome;
  const messages = BLACKSMITH_MESSAGES[outcome] ?? BLACKSMITH_MESSAGES.maintain;

  return pickRandomMessage(messages, random);
}

function getSpecialBlacksmithMessage(result = {}, random = Math.random) {
  const beforeLevel = Math.max(0, Number(result.beforeLevel) || 0);
  const afterLevel = Math.max(0, Number(result.afterLevel) || 0);
  const swordName = getResultSwordName(result);

  if (result.outcome === 'success' && result.mode === 'advanced' && result.levelGain >= 5) {
    return pickRandomMessage([
      `제련석 열기가 『${swordName}』의 결을 제대로 열었다. 한 번에 이렇게 뛰는 건 나도 자주 못 본다!`,
      `『${swordName}』이 방금 새 검처럼 다시 태어났다. 오늘 모루가 제대로 미쳤군!`,
      `이건 그냥 강화가 아니다. 『${swordName}』이 제련석을 통째로 먹고 급이 바뀌었다!`
    ], random);
  }

  if (result.outcome === 'success' && result.mode === 'advanced' && result.levelGain >= 4) {
    return pickRandomMessage([
      `『${swordName}』이 모루 위에서 크게 숨을 쉬었다. 이 정도 상승이면 오늘 강화는 대성공이지.`,
      `제련석 박자가 제대로 맞았다. 『${swordName}』이 한 번에 여러 계단을 밟아 버렸군.`,
      `손맛이 묵직했다. 『${swordName}』이 방금 대장간 분위기를 바꿔 놨다.`
    ], random);
  }

  if (result.outcome === 'success' && result.mode === 'advanced' && result.levelGain >= 2) {
    return pickRandomMessage([
      `제련석 흐름이 『${swordName}』에 잘 맞았다. 보통 강화가 아니라 검이 계단을 뛰어넘은 날이다.`,
      `『${swordName}』이 예상보다 더 잘 받아먹었다. 이래서 상급강화를 하는 거지.`,
      `좋다. 『${swordName}』의 열이 식기도 전에 한 단계 더 뻗었다.`
    ], random);
  }

  if (result.outcome === 'success' && afterLevel >= 100) {
    return pickRandomMessage([
      `서버 전체에 알려라. 『${swordName}』, +100 전설이 모루에서 태어났다!`,
      `내 망치 인생 최고 기록이다. 『${swordName}』은 이제 검이 아니라 서버의 사건이다.`,
      `『${swordName}』을 더 두드리라니? 됐다. 이건 완성품이다.`
    ], random);
  }

  if (result.outcome === 'success' && afterLevel >= 80) {
    return pickRandomMessage([
      `『${swordName}』쯤 되면 검이 아니라 신화의 증표다. 내 망치도 떨릴 정도군.`,
      `이 고강화에서 붙었다고? 『${swordName}』도 주인도 배짱 하나는 인정한다.`,
      `『${swordName}』의 기운이 대장간 천장까지 찼다. 오늘은 운도 실력도 있었다.`
    ], random);
  }

  if (result.outcome === 'success' && afterLevel >= 50) {
    return pickRandomMessage([
      `『${swordName}』이 +50 고지를 넘겼다. 이제 이름값을 제대로 하기 시작했군.`,
      `절반을 넘긴 검은 눈빛부터 다르다. 『${swordName}』이 이제 주인을 고르는 수준이야.`,
      `좋은 소리였다. 『${swordName}』 안쪽에서 제대로 된 울림이 났다.`
    ], random);
  }

  if (result.outcome === 'success' && afterLevel >= 30) {
    return pickRandomMessage([
      `좋다. 『${swordName}』의 균형이 잡혔다. 이제 들고 다니면 검부터 눈에 띌 거다.`,
      `『${swordName}』이 제법 검다운 소리를 냈다. 이 정도면 사냥터에서도 안 꿀린다.`,
      `방금 불꽃은 괜찮았다. 『${swordName}』의 날이 한층 더 살아났군.`
    ], random);
  }

  if (result.outcome === 'success' && afterLevel >= 10) {
    return pickRandomMessage([
      `『${swordName}』의 날이 제대로 섰다. 이름에 어울리는 기운이 막 올라오는군.`,
      `초반 치고 좋다. 『${swordName}』이 슬슬 자기 이름을 증명하려 한다.`,
      `『${swordName}』이 망치 소리에 잘 따라왔다. 아직 갈 길은 있지만 방향은 맞다.`
    ], random);
  }

  if (result.outcome === 'success') {
    return pickRandomMessage([
      `『${swordName}』에 첫 불꽃은 잘 붙었다. 아직 시작이지만 손맛은 괜찮군.`,
      `좋아, 『${swordName}』이 첫 고비는 넘겼다. 망치가 가볍게 들어갔어.`,
      `『${swordName}』이 생각보다 말을 잘 듣는군. 이러면 다음도 욕심난다.`
    ], random);
  }

  if (result.outcome === 'destroy' && beforeLevel >= 80) {
    return pickRandomMessage([
      `장례식 준비해라... 『${swordName}』이 숯이 됐다. 조문은 내가 먼저 하마.`,
      `고강화의 기운이 너무 거칠었다. 『${swordName}』이 끝내 버티지 못했군.`,
      `이건 아프다. 『${swordName}』 정도면 대장간도 잠깐 조용해져야 한다.`
    ], random);
  }

  if (result.outcome === 'destroy' && beforeLevel >= 50) {
    return pickRandomMessage([
      `『${swordName}』이 크게 울고 무너졌다. 아프지만 이 정도 검은 다시 세울 가치가 있다.`,
      `불꽃이 너무 세게 물었다. 『${swordName}』이 버티기엔 오늘 운이 나빴다.`,
      `큰 검은 터지는 소리도 크군. 『${swordName}』의 이름은 기억해 두겠다.`
    ], random);
  }

  if (result.outcome === 'destroy' && beforeLevel >= 20) {
    return pickRandomMessage([
      `제법 버틴 『${swordName}』이었는데 끝내 불꽃을 못 견뎠다. 제련석은 건졌으니 다시 칼끝을 세워 보자.`,
      `『${swordName}』의 속철이 갈라졌다. 그래도 남은 재료로 다시 시작할 수는 있다.`,
      `아깝다. 『${swordName}』이 한 번만 더 버텼으면 모양이 나왔을 텐데.`
    ], random);
  }

  if (result.outcome === 'destroy') {
    return pickRandomMessage([
      `『${swordName}』의 그릇이 아직 얕았다. 내 망치 탓은 아니고, 검이 먼저 포기한 거다.`,
      `터졌다. 『${swordName}』이 아직 열을 받을 준비가 안 됐던 거지.`,
      `불꽃이 살짝 과했다. 아니, 『${swordName}』이 약했던 걸로 하자.`
    ], random);
  }

  if (result.outcome === 'maintain' && beforeLevel >= 80) {
    return pickRandomMessage([
      `거의 닿았다. 『${swordName}』 같은 고강화 검은 망치 한 번에도 성질을 부린다.`,
      `『${swordName}』이 버텼다. 붙진 않았지만 이 강화 수치에서 멀쩡한 것도 일이다.`,
      `고강화의 벽이 높군. 『${swordName}』이 오늘은 한 발 물러섰다.`
    ], random);
  }

  if (result.outcome === 'maintain' && beforeLevel >= 50) {
    return pickRandomMessage([
      `불꽃이 『${swordName}』 끝까지 돌았는데 마지막 결속이 모자랐다. 그래도 살아남은 게 실력이다.`,
      `『${swordName}』이 고집을 부렸다. 안 붙었지만 깨지지도 않았으니 절반은 이겼다.`,
      `마지막 망치가 살짝 얕았다. 『${swordName}』은 그대로니 다시 노려 보자.`
    ], random);
  }

  if (result.outcome === 'maintain' && beforeLevel >= 10) {
    return pickRandomMessage([
      `아깝군, 『${swordName}』이 거의 다듬어졌는데 마지막 박자를 밀어냈다. 오늘은 재료가 예민했던 걸로 하자.`,
      `『${swordName}』이 망치 소리를 튕겨 냈다. 안 깨진 걸 다행으로 봐라.`,
      `불꽃은 좋았는데 결이 잠깐 비틀렸다. 『${swordName}』은 다음 차례를 기다리는군.`
    ], random);
  }

  return null;
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
  const index = Math.min(
    messages.length - 1,
    Math.floor(normalizeRandom(random) * messages.length)
  );

  return messages[index];
}
