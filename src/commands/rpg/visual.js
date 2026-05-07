import { getRpgAssetAttachment } from '../../systems/rpg-assets.js';
import { createTextCardPayload } from '../ui.js';

export function createRpgVisualPayload(content, assetIds = [], extraPayload = {}) {
  const files = assetIds
    .filter(Boolean)
    .filter((assetId, index, values) => values.indexOf(assetId) === index)
    .map((assetId) => getRpgAssetAttachment(assetId))
    .filter(Boolean)
    // Embed cards can display one main image plus one thumbnail; extra files show as loose image dumps.
    .slice(0, 2);

  return createTextCardPayload({
    content,
    files,
    footerText: 'RPG 카드 · 아래 메뉴/버튼으로 다음 행동을 이어가세요',
    colorResolver: getRpgEmbedColor,
    extraPayload
  });
}

function getRpgEmbedColor(title, description) {
  const text = `${title}\n${description}`;

  if (/실패|패배|불가|만료|거절/.test(text)) return 0xef4444;
  if (/완료|승리|보상|학습|장착|전직|구매/.test(text)) return 0x22c55e;
  if (/상점|가챠|골드/.test(text)) return 0xf59e0b;
  if (/월드맵|탐험|지역|스토리/.test(text)) return 0x38bdf8;
  if (/전투|보스|레이드|대결|PvP/.test(text)) return 0xa855f7;

  return 0x7c3aed;
}
