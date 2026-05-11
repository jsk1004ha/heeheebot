import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';

export const POLL_NUMBER_EMOJIS = Object.freeze([
  '1️⃣',
  '2️⃣',
  '3️⃣',
  '4️⃣',
  '5️⃣',
  '6️⃣',
  '7️⃣',
  '8️⃣',
  '9️⃣'
]);

const MIN_POLL_OPTIONS = 2;
const MAX_POLL_OPTIONS = POLL_NUMBER_EMOJIS.length;
const POLL_BAR_LENGTH = 12;
const POLL_COLOR = 0x38bdf8;

export const pollCommands = [
  createPollCommand()
];

export function getPollCommandPayloads() {
  return pollCommands.map((command) => command.toJSON());
}

export async function handlePollCommand(interaction, pollManager, logger = console) {
  if (!interaction.isChatInputCommand?.() || interaction.commandName !== '투표') {
    return false;
  }

  if (!interaction.inGuild?.()) {
    await interaction.reply({
      content: '서버에서만 사용할 수 있는 명령어입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  let pollInput;
  try {
    pollInput = parsePollInteractionOptions(interaction);
  } catch (error) {
    await interaction.reply({
      content: `투표를 만들 수 없습니다: ${error.message}`,
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  const pendingPoll = createPollState({
    ...pollInput,
    creatorId: interaction.user.id,
    messageId: null
  });

  const replyPayload = createPollMessagePayload(pendingPoll);
  const replyResult = await interaction.reply({
    ...replyPayload,
    withResponse: true
  });
  const message = await resolvePollReplyMessage(interaction, replyResult);

  if (!message?.id) {
    logger.warn?.('Poll message was created but could not be fetched for reaction tracking.');
    return true;
  }

  const poll = pollManager.registerPoll({
    ...pendingPoll,
    messageId: message.id,
    channelId: message.channelId ?? interaction.channelId ?? null,
    guildId: interaction.guildId,
    message
  });

  await addPollReactions(message, poll.options.length, logger);
  return true;
}

export class PollManager {
  constructor({ logger = console } = {}) {
    this.logger = logger;
    this.polls = new Map();
  }

  registerPoll(input) {
    const poll = createPollState(input);
    this.polls.set(poll.messageId, poll);
    return poll;
  }

  getPoll(messageId) {
    return this.polls.get(messageId) ?? null;
  }

  deletePoll(messageId) {
    return this.polls.delete(messageId);
  }

  async handleReactionAdd(reaction, user) {
    return this.#handleReaction(reaction, user, 'add');
  }

  async handleReactionRemove(reaction, user) {
    return this.#handleReaction(reaction, user, 'remove');
  }

  async #handleReaction(reaction, user, action) {
    const resolvedReaction = await resolvePartial(reaction, this.logger);
    const resolvedUser = await resolvePartial(user, this.logger);

    if (!resolvedReaction || !resolvedUser || resolvedUser.bot) return false;

    const message = resolvedReaction.message;
    const poll = this.getPoll(message?.id);
    if (!poll) return false;

    const optionIndex = getPollOptionIndexFromReaction(resolvedReaction);
    if (optionIndex < 0 || optionIndex >= poll.options.length) return false;

    poll.message = message ?? poll.message;

    if (action === 'add') {
      await this.#addVote(poll, optionIndex, resolvedUser.id);
    } else {
      this.#removeVote(poll, optionIndex, resolvedUser.id);
    }

    await this.#refreshPollMessage(poll);
    return true;
  }

  async #addVote(poll, optionIndex, userId) {
    const previousSelections = poll.votes.get(userId) ?? new Set();

    if (poll.allowMultiple) {
      previousSelections.add(optionIndex);
      poll.votes.set(userId, previousSelections);
      return;
    }

    const removedIndexes = [...previousSelections].filter((index) => index !== optionIndex);
    poll.votes.set(userId, new Set([optionIndex]));

    await Promise.all(removedIndexes.map((index) =>
      removeUserReaction(poll.message, POLL_NUMBER_EMOJIS[index], userId, this.logger)
    ));
  }

  #removeVote(poll, optionIndex, userId) {
    const selections = poll.votes.get(userId);
    if (!selections) return;

    selections.delete(optionIndex);
    if (selections.size === 0) {
      poll.votes.delete(userId);
    } else {
      poll.votes.set(userId, selections);
    }
  }

  async #refreshPollMessage(poll) {
    if (typeof poll.message?.edit !== 'function') return;

    try {
      await poll.message.edit(createPollMessagePayload(poll));
    } catch (error) {
      this.logger.warn?.('Failed to refresh poll message:', error);
    }
  }
}

export function createPollState({
  messageId,
  channelId = null,
  guildId = null,
  creatorId,
  subject,
  options,
  allowMultiple,
  votes = new Map(),
  message = null,
  createdAt = Date.now()
}) {
  const normalizedOptions = normalizePollOptions(options);
  validatePollOptionCount(normalizedOptions);

  return {
    messageId,
    channelId,
    guildId,
    creatorId,
    subject: normalizePollText(subject, '투표 주제', 150),
    options: normalizedOptions,
    allowMultiple: Boolean(allowMultiple),
    votes: normalizePollVotes(votes),
    message,
    createdAt
  };
}

export function createPollMessagePayload(poll) {
  const counts = countPollVotes(poll);
  const totalSelections = counts.reduce((sum, count) => sum + count, 0);
  const participantCount = poll.votes.size;
  const embed = new EmbedBuilder()
    .setColor(POLL_COLOR)
    .setTitle(`📊 ${poll.subject}`)
    .setDescription([
      `선택 방식: **${poll.allowMultiple ? '복수 선택 가능' : '한 사람당 한 항목'}**`,
      `참여 방법: 아래 숫자 반응(${POLL_NUMBER_EMOJIS.slice(0, poll.options.length).join(' ')})을 눌러 투표하세요.`
    ].join('\n'))
    .setFooter({
      text: `참여자 ${participantCount.toLocaleString()}명 · 총 ${totalSelections.toLocaleString()}표`
    });

  poll.options.forEach((option, index) => {
    const count = counts[index] ?? 0;
    const percent = totalSelections > 0 ? (count / totalSelections) * 100 : 0;
    embed.addFields({
      name: `${POLL_NUMBER_EMOJIS[index]} ${option}`,
      value: [
        `득표 **${count.toLocaleString()}표** · **${formatPollPercent(percent)}**`,
        createPollBar(percent)
      ].join('\n'),
      inline: false
    });
  });

  return {
    embeds: [embed]
  };
}

export function parsePollInteractionOptions(interaction) {
  const subject = interaction.options.getString('주제', true);
  const allowMultiple = interaction.options.getBoolean('복수선택', true);
  const options = [];

  for (let index = 1; index <= MAX_POLL_OPTIONS; index += 1) {
    const value = interaction.options.getString(`항목${index}`);
    if (value !== null && value !== undefined) options.push(value);
  }

  const normalizedOptions = normalizePollOptions(options);
  validatePollOptionCount(normalizedOptions);

  return {
    subject,
    allowMultiple,
    options: normalizedOptions
  };
}

export function countPollVotes(poll) {
  const counts = Array.from({ length: poll.options.length }, () => 0);

  for (const selections of poll.votes.values()) {
    for (const optionIndex of selections) {
      if (optionIndex >= 0 && optionIndex < counts.length) {
        counts[optionIndex] += 1;
      }
    }
  }

  return counts;
}

export function getPollOptionIndexFromReaction(reaction) {
  const emojiName = reaction?.emoji?.name;
  return POLL_NUMBER_EMOJIS.indexOf(emojiName);
}

function createPollCommand() {
  const command = new SlashCommandBuilder()
    .setName('투표')
    .setDescription('숫자 반응으로 참여하는 투표를 만듭니다.')
    .addStringOption((option) =>
      option
        .setName('주제')
        .setDescription('투표 주제')
        .setMaxLength(150)
        .setRequired(true)
    )
    .addBooleanOption((option) =>
      option
        .setName('복수선택')
        .setDescription('여러 항목을 동시에 고를 수 있으면 true, 한 가지만 고르게 하려면 false')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('항목1')
        .setDescription('첫 번째 투표 항목')
        .setMaxLength(80)
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('항목2')
        .setDescription('두 번째 투표 항목')
        .setMaxLength(80)
        .setRequired(true)
    );

  for (let index = 3; index <= MAX_POLL_OPTIONS; index += 1) {
    command.addStringOption((option) =>
      option
        .setName(`항목${index}`)
        .setDescription(`${index}번째 투표 항목`)
        .setMaxLength(80)
    );
  }

  return command;
}

function normalizePollOptions(options) {
  const normalized = options
    .map((option, index) => normalizePollText(option, `항목${index + 1}`, 80))
    .filter(Boolean);

  return normalized;
}

function normalizePollText(value, label, maxLength) {
  const normalized = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (!normalized) {
    throw new Error(`${label}을(를) 비워둘 수 없습니다.`);
  }
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength - 1)}…`
    : normalized;
}

function validatePollOptionCount(options) {
  if (options.length < MIN_POLL_OPTIONS || options.length > MAX_POLL_OPTIONS) {
    throw new Error(`투표 항목은 ${MIN_POLL_OPTIONS}~${MAX_POLL_OPTIONS}개로 입력해 주세요.`);
  }
}

function normalizePollVotes(votes) {
  if (votes instanceof Map) {
    return new Map([...votes.entries()].map(([userId, selections]) => [
      userId,
      new Set(selections)
    ]));
  }

  return new Map();
}

function createPollBar(percent) {
  const filledLength = Math.round((Math.max(0, Math.min(100, percent)) / 100) * POLL_BAR_LENGTH);
  return `${'▰'.repeat(filledLength)}${'▱'.repeat(POLL_BAR_LENGTH - filledLength)}`;
}

function formatPollPercent(percent) {
  if (!Number.isFinite(percent) || percent <= 0) return '0%';
  return Number.isInteger(percent)
    ? `${percent.toFixed(0)}%`
    : `${percent.toFixed(1)}%`;
}

async function resolvePollReplyMessage(interaction, replyResult) {
  const possibleMessage = replyResult?.resource?.message ?? replyResult;
  if (possibleMessage?.id) return possibleMessage;

  if (typeof interaction.fetchReply === 'function') {
    return interaction.fetchReply();
  }

  return null;
}

async function addPollReactions(message, optionCount, logger) {
  if (typeof message.react !== 'function') return;

  for (const emoji of POLL_NUMBER_EMOJIS.slice(0, optionCount)) {
    try {
      await message.react(emoji);
    } catch (error) {
      logger.warn?.(`Failed to add poll reaction ${emoji}:`, error);
    }
  }
}

async function resolvePartial(entity, logger) {
  if (!entity?.partial || typeof entity.fetch !== 'function') return entity;

  try {
    return await entity.fetch();
  } catch (error) {
    logger.warn?.('Failed to fetch partial poll reaction entity:', error);
    return null;
  }
}

async function removeUserReaction(message, emoji, userId, logger) {
  const cachedReaction = findCachedReaction(message, emoji);
  if (typeof cachedReaction?.users?.remove !== 'function') return;

  try {
    await cachedReaction.users.remove(userId);
  } catch (error) {
    logger.warn?.(`Failed to remove previous single-choice poll reaction ${emoji}:`, error);
  }
}

function findCachedReaction(message, emoji) {
  const cache = message?.reactions?.cache;
  if (!cache) return null;

  const direct = typeof cache.get === 'function' ? cache.get(emoji) : null;
  if (direct) return direct;

  const values = typeof cache.values === 'function' ? cache.values() : [];
  for (const reaction of values) {
    if (reaction?.emoji?.name === emoji) return reaction;
  }

  return null;
}
