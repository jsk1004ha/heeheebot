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

test('interaction guard는 명령 처리 전에 즉시 defer할 수 있다', async () => {
  const interaction = createInteraction();
  const debugLogs = [];
  const guard = guardInteractionResponse(interaction, {
    deferAfterMs: 1_000,
    logger: {
      debug(...args) {
        debugLogs.push(args);
      },
      warn() {}
    }
  });

  assert.equal(await guard.deferNow(), true);
  await interaction.reply('완료');
  guard.stop();

  assert.equal(guard.autoDeferred, false);
  assert.deepEqual(interaction.calls, ['deferReply', 'editReply']);
  assert.deepEqual(interaction.edited, { content: '완료' });
  assert.deepEqual(debugLogs, []);
});

test('interaction guard는 defer 원본을 공개 응답으로 채운 뒤 비공개 followUp이 원본을 삭제하지 않는다', async () => {
  const interaction = createInteraction({
    canDeleteReply: true,
    editMarksReplied: false
  });
  const guard = guardInteractionResponse(interaction, {
    deferAfterMs: 1_000,
    logger: quietLogger
  });

  assert.equal(await guard.deferNow(), true);
  await interaction.reply('낚시 결과');
  assert.equal(await safeReplyToInteraction(interaction, {
    content: '업적 자동 수령',
    flags: MessageFlags.Ephemeral
  }), true);
  guard.stop();

  assert.deepEqual(interaction.calls, ['deferReply', 'editReply', 'followUp']);
  assert.deepEqual(interaction.edited, { content: '낚시 결과' });
  assert.deepEqual(interaction.followUps, [{
    content: '업적 자동 수령',
    flags: MessageFlags.Ephemeral
  }]);
  assert.equal(interaction.deleted, false);
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

test('interaction guard는 느린 버튼 업데이트를 자동 deferUpdate하고 editReply로 완료한다', async () => {
  const interaction = createComponentInteraction();
  const guard = guardInteractionResponse(interaction, {
    deferAfterMs: 5,
    logger: quietLogger
  });

  await delay(20);
  await interaction.update({
    content: '버튼 업데이트 완료',
    withResponse: true
  });
  guard.stop();

  assert.equal(guard.autoDeferred, true);
  assert.deepEqual(interaction.calls, ['deferUpdate', 'editReply']);
  assert.deepEqual(interaction.edited, { content: '버튼 업데이트 완료' });
  assert.equal(interaction.updates.length, 0);
});

test('interaction guard는 모달 표시 전에 자동 defer 타이머를 취소한다', async () => {
  const interaction = createComponentInteraction();
  const guard = guardInteractionResponse(interaction, {
    deferAfterMs: 20,
    logger: quietLogger
  });

  await interaction.showModal({ title: '최종 추측' });
  await delay(30);
  guard.stop();

  assert.equal(guard.autoDeferred, false);
  assert.deepEqual(interaction.calls, ['showModal']);
  assert.deepEqual(interaction.modal, { title: '최종 추측' });
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

test('safeReplyToInteraction은 deferUpdate 된 컴포넌트 응답을 followUp으로 보낸다', async () => {
  const interaction = createComponentInteraction();
  const guard = guardInteractionResponse(interaction, {
    deferAfterMs: 1_000,
    logger: quietLogger
  });

  assert.equal(await guard.deferNow(), true);
  assert.equal(await safeReplyToInteraction(interaction, '버튼 처리 완료'), true);
  guard.stop();

  assert.deepEqual(interaction.calls, ['deferUpdate', 'followUp']);
  assert.deepEqual(interaction.followUps, [{ content: '버튼 처리 완료' }]);
  assert.equal(interaction.edited, null);
});

function createInteraction({
  deferred = false,
  replied = false,
  canDeleteReply = false,
  editMarksReplied = true
} = {}) {
  const interaction = {
    commandName: '느린명령',
    deferred,
    replied,
    deleted: false,
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
      if (editMarksReplied) this.replied = true;
      this.edited = typeof payload === 'string' ? { content: payload } : payload;
      return this.edited;
    },
    async followUp(payload) {
      this.calls.push('followUp');
      this.followUps.push(payload);
      return payload;
    }
  };

  if (canDeleteReply) {
    interaction.deleteReply = async function deleteReply() {
      this.calls.push('deleteReply');
      this.deleted = true;
    };
  }

  return interaction;
}

function createComponentInteraction() {
  return {
    customId: 'test:button',
    deferred: false,
    replied: false,
    calls: [],
    updates: [],
    followUps: [],
    edited: null,
    modal: null,
    isChatInputCommand: () => false,
    isButton: () => true,
    isStringSelectMenu: () => false,
    async deferUpdate() {
      this.calls.push('deferUpdate');
      this.deferred = true;
    },
    async update(payload) {
      this.calls.push('update');
      this.replied = true;
      this.updates.push(payload);
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
    },
    async showModal(modal) {
      this.calls.push('showModal');
      this.replied = true;
      this.modal = modal;
    }
  };
}
