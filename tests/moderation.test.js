import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  getModerationCommandPayloads,
  handleModerationCommand,
  inspectMessageForModeration
} from '../src/commands/moderation.js';
import { createSqliteStore } from '../src/storage/sqlite-store.js';
import {
  ModerationService,
  formatDurationMs,
  parseDuration
} from '../src/systems/moderation.js';

test('시간 문자열을 밀리초로 변환한다', () => {
  assert.equal(parseDuration('10분'), 10 * 60 * 1000);
  assert.equal(parseDuration('1시간'), 60 * 60 * 1000);
  assert.equal(parseDuration('2일'), 2 * 24 * 60 * 60 * 1000);
  assert.equal(parseDuration('30m'), 30 * 60 * 1000);
  assert.equal(formatDurationMs(10 * 60 * 1000), '10분');
});

test('로그 채널과 금칙어 설정을 저장한다', async () => {
  const fixture = await createFixture();

  try {
    await fixture.moderation.setLogChannel('guild-1', 'channel-1');
    const settings = await fixture.moderation.addBannedWord('guild-1', '나쁜말');
    const duplicated = await fixture.moderation.addBannedWord('guild-1', '나쁜말');

    assert.equal(settings.logChannelId, 'channel-1');
    assert.equal(settings.autoSpamBan.enabled, true);
    assert.equal(settings.autoSpamBan.userSlowmodeDurationMs, parseDuration('10분'));
    assert.deepEqual(duplicated.bannedWords, ['나쁜말']);
    assert.equal(await fixture.moderation.findBannedWord('guild-1', '이건 나쁜말 입니다'), '나쁜말');
  } finally {
    await fixture.cleanup();
  }
});

test('짧은 시간에 같은 메시지를 반복하면 먼저 슬로우모드를 반환하고 재적발 때 밴한다', async () => {
  const fixture = await createFixture();

  try {
    const first = await fixture.moderation.recordMessageAndDetectSpam(createSpamInput(1, '도배'));
    const second = await fixture.moderation.recordMessageAndDetectSpam(createSpamInput(2, '도배'));
    const third = await fixture.moderation.recordMessageAndDetectSpam(createSpamInput(3, '도배'));
    await fixture.moderation.recordMessageAndDetectSpam(createSpamInput(4, '도배'));
    await fixture.moderation.recordMessageAndDetectSpam(createSpamInput(5, '도배'));
    const repeated = await fixture.moderation.recordMessageAndDetectSpam(createSpamInput(6, '도배'));

    assert.equal(first.detected, false);
    assert.equal(second.detected, false);
    assert.equal(third.detected, true);
    assert.deepEqual(third.punishment, {
      action: 'slowmode',
      durationMs: parseDuration('10분')
    });
    assert.equal(third.offenseCount, 1);
    assert.deepEqual(repeated.punishment, {
      action: 'ban',
      durationMs: null
    });
    assert.equal(repeated.offenseCount, 2);
    assert.match(third.reason, /같은 메시지 3회 반복/);
  } finally {
    await fixture.cleanup();
  }
});

test('짧은 시간에 메시지를 너무 많이 보내면 먼저 슬로우모드를 반환한다', async () => {
  const fixture = await createFixture();

  try {
    let result;
    for (let sequence = 1; sequence <= 5; sequence += 1) {
      result = await fixture.moderation.recordMessageAndDetectSpam(createSpamInput(sequence, `내용 ${sequence}`));
    }

    assert.equal(result.detected, true);
    assert.deepEqual(result.punishment, {
      action: 'slowmode',
      durationMs: parseDuration('10분')
    });
    assert.equal(result.offenseCount, 1);
    assert.match(result.reason, /5초 내 메시지 5개/);
  } finally {
    await fixture.cleanup();
  }
});

test('도배 자동 대응은 채널 전체가 아니라 해당 유저만 10분 슬로우모드로 제한한다', async () => {
  const fixture = await createFixture();

  try {
    const timeoutCalls = [];
    let rateLimitCalled = false;
    let deleted = false;
    const message = createModerationMessage({
      content: '도배',
      channel: {
        async setRateLimitPerUser() {
          rateLimitCalled = true;
          throw new Error('채널 슬로우모드는 호출되면 안 됩니다.');
        }
      },
      timeoutCalls,
      onDelete() {
        deleted = true;
      }
    });

    await inspectMessageForModeration(message, fixture.moderation);
    await inspectMessageForModeration(message, fixture.moderation);
    const result = await inspectMessageForModeration(message, fixture.moderation);

    assert.equal(result.blocked, true);
    assert.equal(result.spam, true);
    assert.equal(deleted, true);
    assert.equal(rateLimitCalled, false);
    assert.deepEqual(timeoutCalls, [
      {
        userId: 'user-1',
        durationMs: parseDuration('10분'),
        reason: '자동 도배 감지: 같은 메시지 3회 반복'
      }
    ]);
  } finally {
    await fixture.cleanup();
  }
});

test('관리 명령 payload는 유저 슬로우모드 해제 명령을 등록한다', () => {
  const commandNames = getModerationCommandPayloads().map((command) => command.name);
  assert.ok(commandNames.includes('슬로우모드풀기'));
});

test('슬로우모드풀기 명령은 대상 유저의 타임아웃을 해제한다', async () => {
  const fixture = await createFixture();

  try {
    const timeoutCalls = [];
    const replies = [];
    const interaction = createModerationInteraction({
      commandName: '슬로우모드풀기',
      timeoutCalls,
      replies
    });

    const handled = await handleModerationCommand(interaction, fixture.moderation);

    assert.equal(handled, true);
    assert.deepEqual(timeoutCalls, [
      {
        userId: 'user-1',
        durationMs: null,
        reason: '유저 슬로우모드 해제'
      }
    ]);
    assert.equal(replies[0], '✅ <@user-1>님의 유저 슬로우모드를 해제했습니다.');
  } finally {
    await fixture.cleanup();
  }
});

test('언밴 명령은 원시 유저 ID도 멘션 형식으로 응답한다', async () => {
  const fixture = await createFixture();

  try {
    const replies = [];
    const unbanCalls = [];
    const interaction = createModerationInteraction({
      commandName: '언밴',
      timeoutCalls: [],
      replies,
      stringOptions: { 유저id: '123456789012345678' },
      guild: createGuild({ timeoutCalls: [], unbanCalls })
    });

    const handled = await handleModerationCommand(interaction, fixture.moderation);

    assert.equal(handled, true);
    assert.deepEqual(unbanCalls, ['123456789012345678']);
    assert.equal(replies[0], '✅ <@123456789012345678> 유저의 밴을 해제했습니다.');
  } finally {
    await fixture.cleanup();
  }
});

test('경고 3회마다 설정된 처벌을 반환한다', async () => {
  const fixture = await createFixture();

  try {
    await fixture.moderation.setWarningPunishment('guild-1', 3, '뮤트', parseDuration('10분'));

    const first = await fixture.moderation.addWarning(createWarningInput(1));
    const second = await fixture.moderation.addWarning(createWarningInput(2));
    const third = await fixture.moderation.addWarning(createWarningInput(3));
    const fourth = await fixture.moderation.addWarning(createWarningInput(4));
    const fifth = await fixture.moderation.addWarning(createWarningInput(5));
    const sixth = await fixture.moderation.addWarning(createWarningInput(6));

    assert.equal(first.punishment, null);
    assert.equal(second.punishment, null);
    assert.deepEqual(third.punishment, {
      action: 'mute',
      durationMs: parseDuration('10분')
    });
    assert.equal(fourth.punishment, null);
    assert.equal(fifth.punishment, null);
    assert.deepEqual(sixth.punishment, {
      action: 'mute',
      durationMs: parseDuration('10분')
    });
  } finally {
    await fixture.cleanup();
  }
});

test('경고 확인과 삭제가 동작한다', async () => {
  const fixture = await createFixture();

  try {
    await fixture.moderation.addWarning(createWarningInput(1));
    await fixture.moderation.addWarning(createWarningInput(2));

    const warnings = await fixture.moderation.getWarnings('guild-1', 'user-1');
    const cleared = await fixture.moderation.clearWarnings('guild-1', 'user-1');
    const after = await fixture.moderation.getWarnings('guild-1', 'user-1');

    assert.equal(warnings.length, 2);
    assert.equal(cleared.removed, 2);
    assert.deepEqual(after, []);
  } finally {
    await fixture.cleanup();
  }
});

function createWarningInput(sequence) {
  return {
    guildId: 'guild-1',
    userId: 'user-1',
    username: '테스터',
    moderatorId: 'mod-1',
    reason: `사유 ${sequence}`,
    now: 1000 + sequence
  };
}

function createSpamInput(sequence, content) {
  return {
    guildId: 'guild-1',
    userId: 'user-1',
    username: '테스터',
    content,
    now: 1000 + sequence * 500
  };
}

function createModerationMessage({
  content,
  channel = {},
  timeoutCalls,
  onDelete = () => {}
}) {
  return {
    inGuild: () => true,
    author: createUser(),
    content,
    deletable: true,
    async delete() {
      onDelete();
    },
    channel,
    client: {
      user: {
        id: 'bot-1'
      }
    },
    guild: createGuild({ timeoutCalls })
  };
}

function createModerationInteraction({
  commandName,
  timeoutCalls,
  replies,
  stringOptions = {},
  guild = createGuild({ timeoutCalls })
}) {
  return {
    isChatInputCommand: () => true,
    commandName,
    inGuild: () => true,
    guildId: 'guild-1',
    guild,
    user: createUser('mod-1'),
    options: {
      getUser(name, required) {
        assert.equal(name, '유저');
        assert.equal(required, true);
        return createUser();
      },
      getString(name, required) {
        assert.equal(required, true);
        return stringOptions[name] ?? null;
      }
    },
    async reply(payload) {
      replies.push(payload);
    }
  };
}

function createGuild({ timeoutCalls, unbanCalls = [] }) {
  return {
    id: 'guild-1',
    members: {
      async fetch(userId) {
        return {
          async timeout(durationMs, reason) {
            timeoutCalls.push({ userId, durationMs, reason });
          }
        };
      },
      async ban() {
        throw new Error('밴은 호출되면 안 됩니다.');
      },
      async unban(userId) {
        unbanCalls.push(userId);
      }
    },
    channels: {
      cache: new Map(),
      async fetch() {
        return null;
      }
    }
  };
}

function createUser(id = 'user-1') {
  return {
    id,
    username: id === 'user-1' ? '테스터' : '관리자',
    bot: false,
    toString() {
      return `<@${id}>`;
    }
  };
}

async function createFixture() {
  const directory = await mkdtemp(join(tmpdir(), 'heeheebot-mod-'));
  const store = createSqliteStore(join(directory, 'profiles.sqlite'));
  const moderation = new ModerationService(store);

  return {
    moderation,
    store,
    async cleanup() {
      store.close();
      await rm(directory, {
        recursive: true,
        force: true
      });
    }
  };
}
