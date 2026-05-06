import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
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
      durationMs: null,
      slowmodeSeconds: 10
    });
    assert.equal(third.offenseCount, 1);
    assert.deepEqual(repeated.punishment, {
      action: 'ban',
      durationMs: null,
      slowmodeSeconds: null
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
      durationMs: null,
      slowmodeSeconds: 10
    });
    assert.equal(result.offenseCount, 1);
    assert.match(result.reason, /5초 내 메시지 5개/);
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
