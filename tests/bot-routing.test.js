import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Events, MessageFlags } from 'discord.js';
import { SEASON_POINT_SOURCES } from '../src/systems/seasons.js';
import test from 'node:test';
import {
  createBot,
  isSupportedCommandInteraction,
  shouldDeferBeforeCommandHandling,
  shouldDeferPrivatelyBeforeCommandHandling,
  sendAutomaticAchievementNotice
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

test('봇 라우팅은 오래 걸릴 수 있는 버튼/선택 메뉴도 처리 전에 즉시 defer한다', () => {
  assert.equal(shouldDeferBeforeCommandHandling({
    isChatInputCommand: () => false,
    isModalSubmit: () => false,
    isButton: () => true,
    isStringSelectMenu: () => false,
    customId: 'sword_quick:enhance:user-1'
  }), true);

  assert.equal(shouldDeferBeforeCommandHandling({
    isChatInputCommand: () => false,
    isModalSubmit: () => false,
    isButton: () => true,
    isStringSelectMenu: () => false,
    customId: 'mafia_night:game-1'
  }), true);

  assert.equal(shouldDeferBeforeCommandHandling({
    isChatInputCommand: () => false,
    isModalSubmit: () => false,
    isButton: () => false,
    isStringSelectMenu: () => true,
    customId: 'account_link_select:user-1'
  }), true);
});

test('계정연동 명령은 비공개 선택 메뉴가 공개 placeholder를 지우지 않도록 사전 defer하지 않는다', () => {
  assert.equal(shouldDeferBeforeCommandHandling({
    isChatInputCommand: () => true,
    isModalSubmit: () => false,
    commandName: '계정연동'
  }), false);
});

test('우노 손패 명령은 비공개 손패 메시지가 사라지지 않도록 사전 defer하지 않는다', () => {
  assert.equal(shouldDeferBeforeCommandHandling({
    isChatInputCommand: () => true,
    isModalSubmit: () => false,
    commandName: '우노',
    options: {
      getSubcommand: () => '손패'
    }
  }), false);

  assert.equal(shouldDeferBeforeCommandHandling({
    isChatInputCommand: () => true,
    isModalSubmit: () => false,
    commandName: '우노',
    options: {
      getSubcommand: () => '내기'
    }
  }), true);
});

test('라이어바 손패 명령도 비공개 손패 메시지가 사라지지 않도록 사전 defer하지 않는다', () => {
  assert.equal(shouldDeferBeforeCommandHandling({
    isChatInputCommand: () => true,
    isModalSubmit: () => false,
    commandName: '라이어바',
    options: {
      getSubcommand: () => '손패'
    }
  }), false);

  assert.equal(shouldDeferBeforeCommandHandling({
    isChatInputCommand: () => true,
    isModalSubmit: () => false,
    commandName: '라이어바',
    options: {
      getSubcommand: () => '내기'
    }
  }), true);
});

test('워들과 숫자야구는 비공개 결과 명령이라 사전 공개 defer를 하지 않는다', () => {
  assert.equal(shouldDeferBeforeCommandHandling({
    isChatInputCommand: () => true,
    isModalSubmit: () => false,
    commandName: '워들'
  }), false);

  assert.equal(shouldDeferBeforeCommandHandling({
    isChatInputCommand: () => true,
    isModalSubmit: () => false,
    commandName: '숫자야구'
  }), false);
});

test('워들과 숫자야구는 라우터에서 처음부터 비공개 defer를 선점한다', () => {
  assert.equal(shouldDeferPrivatelyBeforeCommandHandling({
    isChatInputCommand: () => true,
    commandName: '워들'
  }), true);

  assert.equal(shouldDeferPrivatelyBeforeCommandHandling({
    isChatInputCommand: () => true,
    commandName: '숫자야구'
  }), true);

  assert.equal(shouldDeferPrivatelyBeforeCommandHandling({
    isChatInputCommand: () => true,
    commandName: '우노'
  }), false);
});

test('/워들 도전은 봇 라우팅에서 비공개 defer 원본을 채워 제출 처리한다', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'heeheebot-bot-wordle-'));
  const bot = createBot({
    databasePath: join(directory, 'profiles.sqlite'),
    legacyJsonPath: join(directory, 'missing.json'),
    logger: quietLogger
  });

  try {
    const interaction = createWordleCommandInteraction('crane');
    const [listener] = bot.client.listeners(Events.InteractionCreate);

    await listener(interaction);

    assert.deepEqual(interaction.calls.map(([name]) => name), ['deferReply', 'editReply']);
    assert.equal(interaction.calls[0][1].flags, MessageFlags.Ephemeral);
    assert.equal(interaction.replies.length, 0);
    assert.equal(interaction.edits.length, 1);
    assert.match(interaction.edits[0].content, /제출 완료: \*\*CRANE\*\*/);
    assert.match(interaction.edits[0].content, /🟩|🟨|⬛/);
  } finally {
    bot.client.destroy();
    bot.economy.store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('봇 라우팅은 모달을 띄워야 하는 라이어게임 버튼은 사전 defer하지 않는다', () => {
  assert.equal(shouldDeferBeforeCommandHandling({
    isChatInputCommand: () => false,
    isModalSubmit: () => false,
    isButton: () => true,
    isStringSelectMenu: () => false,
    customId: 'liar_guess:game-1'
  }), false);
});

test('명령 처리 후 새 업적은 자동 지급 안내로 표시한다', async () => {
  const interaction = createCommandInteraction('낚시');
  const community = {
    async grantCompletedAchievements(input) {
      assert.equal(input.guildId, 'guild-1');
      assert.equal(input.userId, 'user-1');
      return {
        totalClaimed: 2,
        totalCoins: 300,
        totalXp: 110,
        displayed: [
          { title: '물비린내 입문' },
          { title: '대장장이의 악몽' }
        ],
        hiddenCount: 0
      };
    }
  };

  const seasons = createSeasonSpy();

  const sent = await sendAutomaticAchievementNotice(interaction, community, { debug() {}, error() {} }, seasons);

  assert.equal(sent, true);
  assert.deepEqual(seasons.awards.map(({ source, points }) => ({ source, points })), [
    { source: SEASON_POINT_SOURCES.ACHIEVEMENT_EARN, points: 20 }
  ]);
  assert.equal(interaction.followUps.length, 1);
  assert.equal(interaction.followUps[0].flags, MessageFlags.Ephemeral);
  assert.match(interaction.followUps[0].content, /자동 수령/);
  assert.match(interaction.followUps[0].content, /물비린내 입문/);
  assert.match(interaction.followUps[0].content, /300골드/);
  assert.match(interaction.followUps[0].content, /시즌: 테스트 시즌/);
});

test('낚시 빠른 버튼 처리 후 새 업적도 자동 지급 안내로 표시한다', async () => {
  const interaction = createButtonInteraction('fishing_quick:fish:user-1');
  const community = {
    async grantCompletedAchievements(input) {
      assert.equal(input.guildId, 'guild-1');
      assert.equal(input.userId, 'user-1');
      return {
        totalClaimed: 1,
        totalCoins: 120,
        totalXp: 40,
        displayed: [
          { title: '강태공 입문' }
        ],
        hiddenCount: 0
      };
    }
  };
  const seasons = createSeasonSpy();

  const sent = await sendAutomaticAchievementNotice(interaction, community, { debug() {}, error() {} }, seasons);

  assert.equal(sent, true);
  assert.deepEqual(seasons.awards.map(({ source, points }) => ({ source, points })), [
    { source: SEASON_POINT_SOURCES.ACHIEVEMENT_EARN, points: 10 }
  ]);
  assert.equal(interaction.followUps.length, 1);
  assert.equal(interaction.followUps[0].flags, MessageFlags.Ephemeral);
  assert.match(interaction.followUps[0].content, /자동 수령/);
  assert.match(interaction.followUps[0].content, /강태공 입문/);
  assert.match(interaction.followUps[0].content, /시즌: 테스트 시즌/);
});

test('소유자 RPG 보상 버튼은 자동 업적 지급 대상이다', async () => {
  const interaction = createButtonInteraction('rpg_daily:user-1:field_training');
  const community = {
    async grantCompletedAchievements(input) {
      assert.equal(input.guildId, 'guild-1');
      assert.equal(input.userId, 'user-1');
      return {
        totalClaimed: 1,
        totalCoins: 0,
        totalXp: 50,
        displayed: [
          { title: '의뢰 해결사' }
        ],
        hiddenCount: 0
      };
    }
  };
  const seasons = createSeasonSpy();

  const sent = await sendAutomaticAchievementNotice(interaction, community, { debug() {}, error() {} }, seasons);

  assert.equal(sent, true);
  assert.deepEqual(seasons.awards.map(({ source, points }) => ({ source, points })), [
    { source: SEASON_POINT_SOURCES.ACHIEVEMENT_EARN, points: 10 }
  ]);
  assert.equal(interaction.followUps.length, 1);
  assert.match(interaction.followUps[0].content, /의뢰 해결사/);
});

test('다른 유저의 RPG 버튼은 자동 업적 지급을 시도하지 않는다', async () => {
  const interaction = createButtonInteraction('rpg_daily:owner-1:field_training');
  const community = {
    async grantCompletedAchievements() {
      throw new Error('다른 유저 RPG 버튼에서는 지급하면 안 됨');
    }
  };

  const sent = await sendAutomaticAchievementNotice(interaction, community, { debug() {}, error() {} });

  assert.equal(sent, false);
  assert.deepEqual(interaction.followUps, []);
});

test('소유자 검증이 불가능한 RPG 세션 버튼은 자동 업적 지급을 시도하지 않는다', async () => {
  const interaction = createButtonInteraction('rpg_boss_action:session-1:attack');
  const community = {
    async grantCompletedAchievements() {
      throw new Error('세션 소유자 확인 전에는 지급하면 안 됨');
    }
  };

  const sent = await sendAutomaticAchievementNotice(interaction, community, { debug() {}, error() {} });

  assert.equal(sent, false);
  assert.deepEqual(interaction.followUps, []);
});

test('조회 전용 버튼은 자동 업적 지급을 시도하지 않는다', async () => {
  const interaction = createButtonInteraction('start:refresh:user-1');
  const community = {
    async grantCompletedAchievements() {
      throw new Error('조회 전용 버튼에서는 지급하면 안 됨');
    }
  };

  const sent = await sendAutomaticAchievementNotice(interaction, community, { debug() {}, error() {} });

  assert.equal(sent, false);
  assert.deepEqual(interaction.followUps, []);
});

test('/업적 명령 자체는 자동 업적 followUp을 중복으로 보내지 않는다', async () => {
  const interaction = createCommandInteraction('업적');
  const community = {
    async grantCompletedAchievements() {
      throw new Error('업적 명령에서는 지급하면 안 됨');
    }
  };

  const sent = await sendAutomaticAchievementNotice(interaction, community, { debug() {}, error() {} });

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

function createWordleCommandInteraction(guess) {
  return {
    commandName: '워들',
    guildId: 'guild-1',
    channelId: 'channel-1',
    user: {
      id: 'user-1',
      username: '테스터'
    },
    deferred: false,
    replied: false,
    calls: [],
    replies: [],
    edits: [],
    followUps: [],
    isAutocomplete() {
      return false;
    },
    isChatInputCommand() {
      return true;
    },
    isModalSubmit() {
      return false;
    },
    isButton() {
      return false;
    },
    isStringSelectMenu() {
      return false;
    },
    inGuild() {
      return true;
    },
    options: {
      getSubcommand() {
        return '도전';
      },
      getString(name, required = false) {
        const value = name === '단어' ? guess : null;
        if (required && value === null) throw new Error(`missing string option: ${name}`);
        return value;
      }
    },
    async deferReply(payload) {
      this.calls.push(['deferReply', payload]);
      this.deferred = true;
    },
    async reply(payload) {
      this.calls.push(['reply', payload]);
      this.replies.push(payload);
      this.replied = true;
    },
    async editReply(payload) {
      this.calls.push(['editReply', payload]);
      this.edits.push(payload);
      this.replied = true;
    },
    async followUp(payload) {
      this.calls.push(['followUp', payload]);
      this.followUps.push(payload);
    },
    async deleteReply() {
      this.calls.push(['deleteReply']);
      this.deleted = true;
    }
  };
}

function createButtonInteraction(customId) {
  return {
    customId,
    guildId: 'guild-1',
    user: {
      id: 'user-1',
      username: '테스터'
    },
    replied: true,
    followUps: [],
    isChatInputCommand() {
      return false;
    },
    isButton() {
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

const quietLogger = {
  log() {},
  warn() {},
  error() {},
  debug() {}
};

function createSeasonSpy() {
  const awards = [];
  return {
    awards,
    async awardPoints(input) {
      awards.push(input);
      return {
        awarded: true,
        points: input.points,
        requestedPoints: input.points,
        totalPoints: input.points,
        sourceLabel: '테스트 시즌',
        newlyClaimableRewards: []
      };
    }
  };
}
