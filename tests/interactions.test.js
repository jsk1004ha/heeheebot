import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { MessageFlags } from 'discord.js';
import {
  guardInteractionResponse,
  safeReplyToInteraction
} from '../src/commands/interactions.js';

const quietLogger = {
  debug() {},
  warn() {}
};

test('interaction guard는 느린 슬래시 명령을 자동 defer하고 이후 reply를 editReply로 완료한다', async () => {
  const interaction = createInteraction();
  const guard = guardInteractionResponse(interaction, {
    deferAfterMs: 5,
    logger: quietLogger
  });

  await delay(20);
  await interaction.reply({
    content: '완료',
    withResponse: true
  });
  guard.stop();

  assert.equal(guard.autoDeferred, true);
  assert.deepEqual(interaction.calls, ['deferReply', 'editReply']);
  assert.deepEqual(interaction.edited, { content: '완료' });
  assert.equal(interaction.replies.length, 0);
});

test('interaction guard는 빠른 직접 reply에는 자동 defer를 보내지 않는다', async () => {
  const interaction = createInteraction();
  const guard = guardInteractionResponse(interaction, {
    deferAfterMs: 20,
    logger: quietLogger
  });

  await interaction.reply('즉시 완료');
  await delay(30);
  guard.stop();

  assert.equal(guard.autoDeferred, false);
  assert.deepEqual(interaction.calls, ['reply']);
  assert.deepEqual(interaction.replies, ['즉시 완료']);
});

test('interaction guard는 자동 defer 뒤 비공개 reply를 followUp으로 보낸다', async () => {
  const interaction = createInteraction();
  const guard = guardInteractionResponse(interaction, {
    deferAfterMs: 5,
    logger: quietLogger
  });

  await delay(20);
  await interaction.reply({
    content: '비공개 오류',
    flags: MessageFlags.Ephemeral,
    withResponse: true
  });
  guard.stop();

  assert.equal(guard.autoDeferred, true);
  assert.deepEqual(interaction.calls, ['deferReply', 'followUp']);
  assert.deepEqual(interaction.followUps, [{
    content: '비공개 오류',
    flags: MessageFlags.Ephemeral
  }]);
  assert.equal(interaction.edited, null);
});

test('safeReplyToInteraction은 deferred 초기 응답을 일반 메시지는 editReply로, 비공개 메시지는 followUp으로 처리한다', async () => {
  const publicInteraction = createInteraction({ deferred: true });
  const privateInteraction = createInteraction({ deferred: true });

  assert.equal(await safeReplyToInteraction(publicInteraction, '공개 완료'), true);
  assert.equal(await safeReplyToInteraction(privateInteraction, {
    content: '비공개 완료',
    flags: MessageFlags.Ephemeral
  }), true);

  assert.deepEqual(publicInteraction.calls, ['editReply']);
  assert.deepEqual(publicInteraction.edited, { content: '공개 완료' });
  assert.deepEqual(privateInteraction.calls, ['followUp']);
  assert.deepEqual(privateInteraction.followUps, [{
    content: '비공개 완료',
    flags: MessageFlags.Ephemeral
  }]);
});

function createInteraction({ deferred = false, replied = false } = {}) {
  return {
    commandName: '느린명령',
    deferred,
    replied,
    calls: [],
    replies: [],
    followUps: [],
    edited: null,
    isChatInputCommand: () => true,
    async deferReply() {
      this.calls.push('deferReply');
      this.deferred = true;
    },
    async reply(payload) {
      this.calls.push('reply');
      this.replied = true;
      this.replies.push(payload);
      return payload;
    },
    async editReply(payload) {
      this.calls.push('editReply');
      this.replied = true;
      this.edited = typeof payload === 'string' ? { content: payload } : payload;
      return this.edited;
    },
    async followUp(payload) {
      this.calls.push('followUp');
      this.followUps.push(payload);
      return payload;
    }
  };
}
