import assert from 'node:assert/strict';
import { MessageFlags } from 'discord.js';
import test from 'node:test';
import {
  isSupportedCommandInteraction,
  sendClaimableAchievementNotice
} from '../src/bot.js';

test('봇 라우팅은 RPG 선택 메뉴 상호작용도 처리 대상으로 인정한다', () => {
  assert.equal(isSupportedCommandInteraction({
    isChatInputCommand: () => false,
    isButton: () => false,
    isStringSelectMenu: () => true
  }), true);
});

test('봇 라우팅은 라이어게임 최종 추측 모달도 처리 대상으로 인정한다', () => {
  assert.equal(isSupportedCommandInteraction({
    isChatInputCommand: () => false,
    isButton: () => false,
    isModalSubmit: () => true,
    isStringSelectMenu: () => false
  }), true);
});

test('봇 라우팅은 명령/버튼/선택 메뉴가 아니면 무시한다', () => {
  assert.equal(isSupportedCommandInteraction({
    isChatInputCommand: () => false,
    isButton: () => false,
    isModalSubmit: () => false,
    isStringSelectMenu: () => false
  }), false);
});

test('명령 처리 후 새로 달성 가능한 업적은 followUp으로 짧게 안내한다', async () => {
  const interaction = createCommandInteraction('낚시');
  const community = {
    async getClaimableAchievements(input) {
      assert.equal(input.guildId, 'guild-1');
      assert.equal(input.userId, 'user-1');
      return {
        total: 2,
        achievements: [
          { title: '물비린내 입문' },
          { title: '대장장이의 악몽' }
        ]
      };
    }
  };

  const sent = await sendClaimableAchievementNotice(interaction, community, { debug() {}, error() {} });

  assert.equal(sent, true);
  assert.equal(interaction.followUps.length, 1);
  assert.equal(interaction.followUps[0].flags, MessageFlags.Ephemeral);
  assert.match(interaction.followUps[0].content, /달성 가능한 업적/);
  assert.match(interaction.followUps[0].content, /물비린내 입문/);
  assert.match(interaction.followUps[0].content, /\/업적 보기:수령 가능/);
});

test('/업적 명령 자체는 달성 가능 업적 followUp을 중복으로 보내지 않는다', async () => {
  const interaction = createCommandInteraction('업적');
  const community = {
    async getClaimableAchievements() {
      throw new Error('업적 명령에서는 조회하면 안 됨');
    }
  };

  const sent = await sendClaimableAchievementNotice(interaction, community, { debug() {}, error() {} });

  assert.equal(sent, false);
  assert.deepEqual(interaction.followUps, []);
});

function createCommandInteraction(commandName) {
  return {
    commandName,
    guildId: 'guild-1',
    user: {
      id: 'user-1',
      username: '테스터'
    },
    replied: true,
    followUps: [],
    isChatInputCommand() {
      return true;
    },
    inGuild() {
      return true;
    },
    async reply(payload) {
      this.repliedPayload = payload;
      this.replied = true;
    },
    async followUp(payload) {
      this.followUps.push(payload);
    }
  };
}
