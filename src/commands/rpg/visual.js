import { getRpgAssetAttachment } from '../../systems/rpg-assets.js';
import { createTextCardPayload } from '../ui.js';

const RPG_CARD_DESCRIPTION_MAX_LENGTH = 1_800;
const RPG_CARD_TAIL_LINE_COUNT = 4;

export function createRpgVisualPayload(content, assetIds = [], extraPayload = {}) {
  const {
    mentionUserIds = [],
    mentionContent = null,
    allowedMentions = null,
    ...cleanExtraPayload
  } = extraPayload ?? {};
  const files = assetIds
    .filter(Boolean)
    .filter((assetId, index, values) => values.indexOf(assetId) === index)
    .map((assetId) => getRpgAssetAttachment(assetId))
    .filter(Boolean)
    // Embed cards can display one main image plus one thumbnail; extra files show as loose image dumps.
    .slice(0, 2);

  return createTextCardPayload({
    content: compactRpgCardContent(content),
    files,
    footerText: 'RPG 카드 · 아래 메뉴/버튼으로 다음 행동을 이어가세요',
    colorResolver: getRpgEmbedColor,
    extraPayload: addMentionNotificationPayload(cleanExtraPayload, {
      mentionUserIds,
      mentionContent,
      allowedMentions
    })
  });
}

function addMentionNotificationPayload(extraPayload, {
  mentionUserIds = [],
  mentionContent = null,
  allowedMentions = null
} = {}) {
  const nextPayload = { ...extraPayload };
  const userIds = normalizeMentionUserIds(mentionUserIds);

  if (userIds.length === 0) {
    if (allowedMentions) nextPayload.allowedMentions = allowedMentions;
    return nextPayload;
  }

  if (nextPayload.content === undefined) {
    nextPayload.content = mentionContent || userIds.map((userId) => `<@${userId}>`).join(' ');
  }

  nextPayload.allowedMentions = {
    ...(allowedMentions ?? {}),
    parse: (allowedMentions?.parse ?? []).filter((type) => type !== 'users'),
    users: normalizeMentionUserIds([
      ...(allowedMentions?.users ?? []),
      ...userIds
    ])
  };

  return nextPayload;
}

function normalizeMentionUserIds(userIds) {
  return [...new Set((Array.isArray(userIds) ? userIds : [userIds])
    .map((userId) => String(userId ?? '').trim())
    .filter(Boolean))];
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

function compactRpgCardContent(content) {
  const lines = String(content ?? '').split('\n');
  const title = lines.shift() ?? 'RPG';
  const description = lines.join('\n').trim();

  if (description.length <= RPG_CARD_DESCRIPTION_MAX_LENGTH) {
    return [title, description].filter(Boolean).join('\n');
  }

  const tailLines = lines.slice(-RPG_CARD_TAIL_LINE_COUNT);
  let tail = tailLines.join('\n').trim();
  const omittedCount = Math.max(0, lines.length - tailLines.length);
  const notice = `… 일부 내용 생략 (${omittedCount.toLocaleString()}줄). 자세한 목록은 해당 명령을 다시 열거나 선택 메뉴를 사용하세요.`;
  const reserved = notice.length + (tail ? tail.length + 2 : 0);
  const budget = Math.max(200, RPG_CARD_DESCRIPTION_MAX_LENGTH - reserved);
  const head = [];
  let used = 0;

  for (let index = 0; index < lines.length - tailLines.length; index += 1) {
    const line = lines[index];
    const nextUsed = used + line.length + (head.length > 0 ? 1 : 0);
    if (nextUsed > budget) break;
    head.push(line);
    used = nextUsed;
  }

  const compactDescription = [
    ...head,
    notice,
    tail
  ].filter(Boolean).join('\n');

  if (compactDescription.length <= RPG_CARD_DESCRIPTION_MAX_LENGTH) {
    return [title, compactDescription].join('\n');
  }

  tail = tail.slice(0, Math.max(0, RPG_CARD_DESCRIPTION_MAX_LENGTH - notice.length - 4));
  return [title, notice, tail].filter(Boolean).join('\n');
}
