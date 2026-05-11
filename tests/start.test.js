import { MessageFlags } from 'discord.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getStartCommandPayloads,
  handleStartCommand
} from '../src/commands/start.js';

test('시작하기 명령 payload는 처음 하는 유저용 가이드를 등록한다', () => {
  const [payload] = getStartCommandPayloads();

  assert.equal(payload.name, '시작하기');
  assert.match(payload.description, /처음|가이드|시작/);
  assert.equal(payload.options?.length ?? 0, 0);
});

test('시작하기는 새 유저에게 핵심 루트와 버튼을 보여준다', async () => {
  const interaction = createStartInteraction();

  const handled = await handleStartCommand(interaction, createServices());

  assert.equal(handled, true);
  assert.equal(interaction.replies.length, 1);
  assert.match(interaction.replies[0].content, /시작하기/);
  assert.match(interaction.replies[0].content, /출석 받기/);
  assert.match(interaction.replies[0].content, /RPG 시작/);
  assert.match(interaction.replies[0].content, /다음 추천/);
  assert.deepEqual(getButtonLabels(interaction.replies[0]), [
    '새로고침',
    '오늘할일',
    '시즌',
    '도움말'
  ]);
});

test('시작하기 버튼은 실행한 유저만 누를 수 있다', async () => {
  const interaction = createStartButtonInteraction('start:refresh:owner-1', {
    userId: 'other-1'
  });

  const handled = await handleStartCommand(interaction, createServices());

  assert.equal(handled, true);
  assert.equal(interaction.replies[0].flags, MessageFlags.Ephemeral);
  assert.match(interaction.replies[0].content, /명령어를 실행한 유저/);
});

function createServices({
  profile = {
    lastDailyDay: null,
    community: { stats: { commandsUsed: 0 } }
  },
  rpgStatus = { startedAt: 0 },
  swordStatus = { giftAvailable: true },
  fishingStatus = { stats: { totalCatches: 0 } },
  stockOverview = { tradeCount: 0, positions: [] },
  seasonOverview = { profile: { totalPoints: 0 } }
} = {}) {
  return {
    community: {
      async getOverview() {
        return { profile: profile.community };
      }
    },
    economy: {
      async getRpgStatus() {
        return rpgStatus;
      },
      async getSwordStatus() {
        return swordStatus;
      }
    },
    fishing: {
      async getProfile() {
        return fishingStatus;
      }
    },
    stocks: {
      async getPortfolio() {
        return stockOverview;
      }
    },
    seasons: {
      async getOverview() {
        return seasonOverview;
      }
    }
  };
}

function createStartInteraction() {
  const replies = [];

  return {
    commandName: '시작하기',
    guildId: 'guild-1',
    user: {
      id: 'user-1',
      username: '테스터'
    },
    replies,
    isButton() {
      return false;
    },
    isChatInputCommand() {
      return true;
    },
    inGuild() {
      return true;
    },
    async reply(payload) {
      replies.push(payload);
    }
  };
}

function createStartButtonInteraction(customId, { userId = 'user-1' } = {}) {
  const replies = [];
  const updates = [];

  return {
    customId,
    guildId: 'guild-1',
    user: {
      id: userId,
      username: '테스터'
    },
    replies,
    updates,
    isButton() {
      return true;
    },
    isChatInputCommand() {
      return false;
    },
    inGuild() {
      return true;
    },
    async reply(payload) {
      replies.push(payload);
    },
    async update(payload) {
      updates.push(payload);
    }
  };
}

function getButtonLabels(payload) {
  return (payload.components ?? [])
    .flatMap((row) => row.components ?? [])
    .map((component) => component.data?.label ?? component.label)
    .filter(Boolean);
}
