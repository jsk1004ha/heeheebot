import { MessageFlags } from 'discord.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getHelpCommandPayloads,
  handleHelpCommand
} from '../src/commands/help.js';

test('도움말 명령 payload는 분류 선택과 통합 도움말 이름을 등록한다', () => {
  const [payload] = getHelpCommandPayloads();

  assert.equal(payload.name, '도움말');
  assert.match(payload.description, /명령어/);
  assert.equal(payload.options[0].name, '분류');
  assert.ok(payload.options[0].choices.some((choice) => choice.value === 'rpg'));
  assert.ok(payload.options[0].choices.some((choice) => choice.value === 'sword'));
  assert.ok(payload.options[0].choices.some((choice) => choice.value === 'season'));
});

test('도움말 명령은 카테고리 버튼과 선택 분류 embed를 보여준다', async () => {
  const interaction = createHelpInteraction({
    stringOptions: { 분류: 'sword' }
  });
  const gameInteraction = createHelpInteraction({
    stringOptions: { 분류: 'games' }
  });

  const handled = await handleHelpCommand(interaction);
  await handleHelpCommand(gameInteraction);

  assert.equal(handled, true);
  assert.equal(interaction.replies.length, 1);
  assert.match(interaction.replies[0].embeds[0].data.title, /검/);
  assert.match(interaction.replies[0].embeds[0].data.description, /검강화|검도감/);
  const gameHelpText = gameInteraction.replies[0].embeds[0].data.fields.map((field) => field.value).join('\n');
  assert.match(gameHelpText, /\/낚시도감/);
  assert.match(gameHelpText, /\/희진일기/);
  assert.equal(interaction.replies[0].components.length >= 1, true);
  const buttonLabels = interaction.replies[0].components.flatMap((row) =>
    row.components.map((component) => component.data.label)
  );
  assert.ok(buttonLabels.includes('RPG'));
  assert.ok(buttonLabels.includes('검'));
  assert.ok(buttonLabels.includes('주식'));
  assert.ok(buttonLabels.includes('시즌'));
});

test('도움말 버튼은 실행한 유저만 분류를 바꿀 수 있다', async () => {
  const updates = [];
  const replies = [];
  const ownerButton = createHelpButtonInteraction({
    customId: 'help:rpg:user-1',
    userId: 'user-1',
    updates,
    replies
  });
  const otherButton = createHelpButtonInteraction({
    customId: 'help:stock:user-1',
    userId: 'user-2',
    updates,
    replies
  });

  assert.equal(await handleHelpCommand(ownerButton), true);
  assert.equal(await handleHelpCommand(otherButton), true);

  assert.match(updates[0].embeds[0].data.title, /RPG/);
  assert.equal(replies[0].flags, MessageFlags.Ephemeral);
  assert.match(replies[0].content, /실행한 유저만/);
});

function createHelpInteraction({ stringOptions = {} } = {}) {
  return {
    commandName: '도움말',
    guildId: 'guild-1',
    user: { id: 'user-1', username: '희희' },
    replies: [],
    isChatInputCommand: () => true,
    isButton: () => false,
    inGuild: () => true,
    options: {
      getString: (name) => stringOptions[name] ?? null
    },
    async reply(payload) {
      this.replies.push(payload);
    }
  };
}

function createHelpButtonInteraction({
  customId,
  userId,
  updates,
  replies
}) {
  return {
    customId,
    guildId: 'guild-1',
    user: { id: userId, username: '희희' },
    isChatInputCommand: () => false,
    isButton: () => true,
    inGuild: () => true,
    async update(payload) {
      updates.push(payload);
    },
    async reply(payload) {
      replies.push(payload);
    }
  };
}
