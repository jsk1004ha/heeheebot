import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(CURRENT_DIR, '..', '..');
const BLACKSMITH_ASSET_PATH = join(REPO_ROOT, 'assets', 'sword', 'blacksmith', 'blacksmith.png');

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
    '괜찮다. 검이 숨 한번 고른 거다, 다음 망치에 붙이면 된다.',
    '살았다! 이 정도면 실패가 아니라 검이 장난친 거다.',
    '망치가 삐끗했다. 검은 멀쩡하니 자존심만 수리하면 된다.',
    '다음엔 붙는다. 아마도. 아니, 내 망치가 그렇게 말한다.',
    '숨 쉬어라. 검도 안 깨졌고 네 돈만 살짝 울었다.',
    '괜찮아, 오늘 모루가 좀 까칠했다. 다음엔 달래서 때려 보자.',
    '유지라니 애매하군. 그래도 재가 안 된 걸 축하해라.',
    '망치가 쉬어 가자고 했다. 검은 아직 도망 안 갔다.'
  ]),
  destroy: Object.freeze([
    '미안하다. 검이 방금 재가 됐다. 그래도 처음부터 다시 전설 만들 수 있다.',
    '터졌다! 어... 울지 마라. 모루 밑에 희망은 아직 있다.',
    '재가 됐군. 내가 위로는 해주마, 놀림은 내일 하겠다.',
    '처음부터 다시 간다. 좋은 대장장이는 폐허에서도 검을 뽑는다.',
    '미안하다. 방금 소리는 실패가 아니라 새 출발의 종소리다.',
    '울지 마라. 검은 터졌지만 네 집념은 아직 안 터졌다.',
    '재료가 별이 됐다. 다음 검은 그 별빛으로 더 세게 만들자.',
    '터졌지만 끝은 아니다. 모루는 배신해도 대장장이는 남는다.'
  ])
});

export function getBlacksmithAssetAttachment() {
  if (!existsSync(BLACKSMITH_ASSET_PATH)) return null;

  return {
    attachment: BLACKSMITH_ASSET_PATH,
    name: 'blacksmith.png'
  };
}

export function formatBlacksmithEnhancementLine(result) {
  return `🔨 **대장장이**: "${getBlacksmithEnhancementMessage(result)}"`;
}

export function getBlacksmithEnhancementMessage(result) {
  const outcome = result?.outcome;
  const messages = BLACKSMITH_MESSAGES[outcome] ?? BLACKSMITH_MESSAGES.maintain;
  const seed = getMessageSeed(result);

  return messages[seed % messages.length];
}

function getMessageSeed(result = {}) {
  const beforeLevel = Math.max(0, Number(result.beforeLevel) || 0);
  const afterLevel = Math.max(0, Number(result.afterLevel) || 0);
  const roll = Math.max(0, Number(result.roll) || 0);
  const modeOffset = result.mode === 'advanced' ? 97 : 31;

  return beforeLevel * 17 + afterLevel * 11 + roll * 5 + modeOffset;
}
