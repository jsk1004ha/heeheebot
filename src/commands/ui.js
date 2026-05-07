import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} from 'discord.js';

export function createButtonRows(buttons, { maxPerRow = 5, maxRows = 5 } = {}) {
  const rows = [];
  const safeMaxPerRow = Math.min(5, Math.max(1, Math.floor(Number(maxPerRow) || 5)));
  const safeMaxRows = Math.min(5, Math.max(1, Math.floor(Number(maxRows) || 5)));
  const safeButtons = buttons.filter(Boolean).slice(0, safeMaxPerRow * safeMaxRows);

  for (let index = 0; index < safeButtons.length; index += safeMaxPerRow) {
    rows.push(new ActionRowBuilder().addComponents(...safeButtons.slice(index, index + safeMaxPerRow)));
  }

  return rows;
}

export function createPagedButtonRow({
  previousCustomId,
  nextCustomId,
  previousLabel = '이전',
  nextLabel = '다음',
  pageIndex,
  pageCount,
  previousStyle = ButtonStyle.Secondary,
  nextStyle = ButtonStyle.Primary
}) {
  const currentPage = Math.max(0, Math.floor(Number(pageIndex) || 0));
  const totalPages = Math.max(1, Math.floor(Number(pageCount) || 1));

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(previousCustomId)
      .setLabel(shortenComponentText(previousLabel, 80))
      .setStyle(previousStyle)
      .setDisabled(currentPage <= 0),
    new ButtonBuilder()
      .setCustomId(nextCustomId)
      .setLabel(shortenComponentText(nextLabel, 80))
      .setStyle(nextStyle)
      .setDisabled(currentPage >= totalPages - 1)
  );
}

export function shortenComponentText(value, maxLength = 100) {
  const text = String(value ?? '');
  const safeMaxLength = Math.max(1, Math.floor(Number(maxLength) || 100));
  return text.length > safeMaxLength
    ? `${text.slice(0, safeMaxLength - 1)}…`
    : text;
}

export function formatUserMention(userOrId, fallback = '알 수 없는 유저') {
  if (userOrId && typeof userOrId === 'object') {
    if (userOrId.id) return `<@${String(userOrId.id).trim()}>`;

    const rendered = String(userOrId).trim();
    if (rendered && rendered !== '[object Object]') return rendered;

    return userOrId.username ?? fallback;
  }

  const id = String(userOrId ?? '').trim();
  if (!id) return fallback;
  if (/^<@!?\d+>$/.test(id)) return id;
  return `<@${id}>`;
}

export function createAllowedMentionsForUsers(userIds) {
  return {
    parse: [],
    users: normalizeMentionUserIds(userIds)
  };
}

export function createTextCardPayload({
  content,
  files = [],
  components = [],
  footerText = null,
  color = 0x7c3aed,
  colorResolver = null,
  extraPayload = {}
}) {
  const [rawTitle, ...bodyLines] = String(content).split('\n');
  const title = rawTitle.replace(/\*\*/g, '').slice(0, 256);
  const description = bodyLines.join('\n').trim() || rawTitle;
  const embed = new EmbedBuilder()
    .setColor(typeof colorResolver === 'function' ? colorResolver(title, description) : color)
    .setTitle(title)
    .setDescription(truncateEmbedDescription(description));

  if (footerText) {
    embed.setFooter({ text: footerText });
  }
  if (files[0]) {
    embed.setImage(`attachment://${files[0].name}`);
  }
  if (files[1]) {
    embed.setThumbnail(`attachment://${files[1].name}`);
  }

  return {
    embeds: [embed],
    files,
    ...(components.length > 0 ? { components } : {}),
    ...extraPayload
  };
}

export function truncateEmbedDescription(text, maxLength = 4096) {
  const normalized = String(text || '').trim();
  const safeMaxLength = Math.max(1, Math.floor(Number(maxLength) || 4096));
  return normalized.length > safeMaxLength
    ? `${normalized.slice(0, safeMaxLength - 1)}…`
    : normalized;
}

function normalizeMentionUserIds(userIds) {
  const rawIds = Array.isArray(userIds) ? userIds : [userIds];
  return [...new Set(rawIds
    .map((userId) => String(userId ?? '').trim())
    .filter(Boolean))];
}
