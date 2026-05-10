import assert from 'node:assert/strict';
import test from 'node:test';
import {
  POLL_NUMBER_EMOJIS,
  PollManager,
  countPollVotes,
  getPollCommandPayloads,
  handlePollCommand
} from '../src/commands/poll.js';

test('투표 명령 payload는 주제, 복수선택, 2~9개 항목을 등록한다', () => {
  const [payload] = getPollCommandPayloads();

  assert.equal(payload.name, '투표');
  assert.match(payload.description, /반응|투표/);

  const optionNames = payload.options.map((option) => option.name);
  assert.deepEqual(optionNames, [
    '주제',
    '복수선택',
    '항목1',
    '항목2',
    '항목3',
    '항목4',
    '항목5',
    '항목6',
    '항목7',
    '항목8',
    '항목9'
  ]);
  assert.equal(payload.options.find((option) => option.name === '주제').required, true);
  assert.equal(payload.options.find((option) => option.name === '복수선택').required, true);
  assert.equal(payload.options.find((option) => option.name === '항목1').required, true);
  assert.equal(payload.options.find((option) => option.name === '항목2').required, true);
  assert.equal(payload.options.find((option) => option.name === '항목9').required, false);
});

test('투표 명령은 embed를 만들고 항목 수만큼 숫자 반응을 붙인다', async () => {
  const pollManager = new PollManager();
  const message = createPollMessage();
  const interaction = createPollInteraction({
    message,
    stringOptions: {
      주제: '점심 메뉴',
      항목1: '김치찌개',
      항목2: '돈까스',
      항목3: '국밥'
    },
    booleanOptions: {
      복수선택: true
    }
  });

  const handled = await handlePollCommand(interaction, pollManager);

  assert.equal(handled, true);
  assert.equal(interaction.replies.length, 1);
  assert.equal(interaction.replies[0].fetchReply, true);
  assert.match(interaction.replies[0].embeds[0].data.title, /점심 메뉴/);
  assert.match(interaction.replies[0].embeds[0].data.description, /복수 선택 가능/);
  assert.equal(interaction.replies[0].embeds[0].data.fields.length, 3);
  assert.deepEqual(message.reacted, POLL_NUMBER_EMOJIS.slice(0, 3));

  const poll = pollManager.getPoll(message.id);
  assert.equal(poll.subject, '점심 메뉴');
  assert.equal(poll.allowMultiple, true);
  assert.deepEqual(poll.options, ['김치찌개', '돈까스', '국밥']);
});

test('복수 선택 투표는 반응 추가/제거로 득표수와 퍼센트 그래프를 갱신한다', async () => {
  const pollManager = new PollManager();
  const message = createPollMessage();
  pollManager.registerPoll({
    messageId: message.id,
    guildId: 'guild-1',
    channelId: 'channel-1',
    creatorId: 'owner-1',
    subject: '간식',
    options: ['과자', '빵'],
    allowMultiple: true,
    message
  });

  assert.equal(await pollManager.handleReactionAdd(createReaction(message, '1️⃣'), createUser('user-a')), true);
  assert.equal(await pollManager.handleReactionAdd(createReaction(message, '2️⃣'), createUser('user-b')), true);

  let latest = message.edits.at(-1);
  assert.match(latest.embeds[0].data.fields[0].value, /1표/);
  assert.match(latest.embeds[0].data.fields[0].value, /50%/);
  assert.match(latest.embeds[0].data.fields[1].value, /1표/);
  assert.match(latest.embeds[0].data.fields[1].value, /50%/);

  assert.equal(await pollManager.handleReactionRemove(createReaction(message, '1️⃣'), createUser('user-a')), true);
  latest = message.edits.at(-1);
  assert.match(latest.embeds[0].data.fields[0].value, /0표/);
  assert.match(latest.embeds[0].data.fields[1].value, /1표/);
  assert.match(latest.embeds[0].data.fields[1].value, /100%/);
});

test('단일 선택 투표는 새 선택만 집계하고 이전 숫자 반응 제거를 시도한다', async () => {
  const pollManager = new PollManager();
  const removed = [];
  const message = createPollMessage({ removed });
  const poll = pollManager.registerPoll({
    messageId: message.id,
    guildId: 'guild-1',
    channelId: 'channel-1',
    creatorId: 'owner-1',
    subject: '한 가지만',
    options: ['항목1', '항목2', '항목3'],
    allowMultiple: false,
    message
  });

  await pollManager.handleReactionAdd(createReaction(message, '1️⃣'), createUser('user-a'));
  await pollManager.handleReactionAdd(createReaction(message, '2️⃣'), createUser('user-a'));

  assert.deepEqual(countPollVotes(poll), [0, 1, 0]);
  assert.deepEqual(removed, [{ emoji: '1️⃣', userId: 'user-a' }]);
  assert.match(message.edits.at(-1).embeds[0].data.fields[0].value, /0표/);
  assert.match(message.edits.at(-1).embeds[0].data.fields[1].value, /1표/);
  assert.match(message.edits.at(-1).embeds[0].data.description, /한 사람당 한 항목/);
});

function createPollInteraction({
  message,
  stringOptions = {},
  booleanOptions = {}
} = {}) {
  return {
    commandName: '투표',
    guildId: 'guild-1',
    channelId: 'channel-1',
    user: { id: 'owner-1', username: '희희' },
    replies: [],
    isChatInputCommand: () => true,
    inGuild: () => true,
    options: {
      getString(name, required = false) {
        const value = stringOptions[name] ?? null;
        if (required && value === null) throw new Error(`${name} required`);
        return value;
      },
      getBoolean(name, required = false) {
        const value = booleanOptions[name] ?? null;
        if (required && value === null) throw new Error(`${name} required`);
        return value;
      }
    },
    async reply(payload) {
      this.replies.push(payload);
      return message;
    }
  };
}

function createPollMessage({ removed = [] } = {}) {
  const reactionsCache = new Map();
  const message = {
    id: 'poll-message-1',
    channelId: 'channel-1',
    reacted: [],
    edits: [],
    reactions: {
      cache: reactionsCache
    },
    async react(emoji) {
      this.reacted.push(emoji);
      reactionsCache.set(emoji, {
        emoji: { name: emoji },
        users: {
          async remove(userId) {
            removed.push({ emoji, userId });
          }
        }
      });
    },
    async edit(payload) {
      this.edits.push(payload);
      return this;
    }
  };

  for (const emoji of POLL_NUMBER_EMOJIS) {
    if (!reactionsCache.has(emoji)) {
      reactionsCache.set(emoji, {
        emoji: { name: emoji },
        users: {
          async remove(userId) {
            removed.push({ emoji, userId });
          }
        }
      });
    }
  }

  return message;
}

function createReaction(message, emoji) {
  return {
    emoji: { name: emoji },
    message
  };
}

function createUser(id) {
  return {
    id,
    bot: false
  };
}
