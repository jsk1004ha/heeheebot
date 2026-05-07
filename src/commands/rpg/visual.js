import { getRpgAssetAttachment } from '../../systems/rpg-assets.js';
import { createTextCardPayload } from '../ui.js';

const RPG_CARD_DESCRIPTION_MAX_LENGTH = 1_200;

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
    footerText: 'RPG · 버튼으로 이어가기',
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
  const bodyLines = lines
    .map((line) => line.trim())
    .filter(Boolean);
  const description = bodyLines.join('\n').trim();

  if (description.length <= RPG_CARD_DESCRIPTION_MAX_LENGTH) {
    return [title, description].filter(Boolean).join('\n');
  }

  return [
    title,
    `${description.slice(0, RPG_CARD_DESCRIPTION_MAX_LENGTH - 1)}…`
  ].join('\n');
}
