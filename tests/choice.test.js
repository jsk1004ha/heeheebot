import { MessageFlags } from 'discord.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_CHOICE_OPTIONS,
  chooseFromOptions,
  getChoiceCommandPayloads,
  handleChoiceCommand,
  parseChoiceOptions
} from '../src/commands/choice.js';

test('선택 명령 payload는 옵션 문자열 하나로 2~100개 후보를 받는다', () => {
  const [payload] = getChoiceCommandPayloads();

  assert.equal(payload.name, '선택');
  assert.match(payload.description, /무작위|골라/);
  assert.equal(payload.options.length, 1);
  assert.equal(payload.options[0].name, '옵션');
  assert.equal(payload.options[0].required, true);
  assert.match(payload.options[0].description, /2~100/);
});

test('선택 옵션 파서는 쉼표, 공백, 괄호 구분을 지원한다', () => {
  assert.deepEqual(parseChoiceOptions('김밥, 라면, 돈까스'), ['김밥', '라면', '돈까스']);
  assert.deepEqual(parseChoiceOptions('김밥 라면 돈까스'), ['김밥', '라면', '돈까스']);
  assert.deepEqual(parseChoiceOptions('(제육 볶음) (돈까스) (국밥)'), ['제육 볶음', '돈까스', '국밥']);
});

test('선택 옵션은 최대 100개까지 허용하고 101개는 거부한다', () => {
  const hundredOptions = Array.from({ length: MAX_CHOICE_OPTIONS }, (_, index) => `메뉴${index + 1}`);
  assert.equal(parseChoiceOptions(hundredOptions.join(',')).length, MAX_CHOICE_OPTIONS);

  const tooManyOptions = [...hundredOptions, '메뉴101'];
  assert.throws(
    () => parseChoiceOptions(tooManyOptions.join(',')),
    /2~100/
  );
});

test('선택 계산은 주어진 난수로 후보 하나를 고른다', () => {
  const result = chooseFromOptions('김밥, 라면, 돈까스', { random: () => 0.99 });

  assert.equal(result.selected, '돈까스');
  assert.equal(result.selectedIndex, 2);
});

test('선택 명령 핸들러는 결과를 답장하고 멘션을 허용하지 않는다', async () => {
  const interaction = createChoiceInteraction({
    stringOptions: {
      옵션: '김밥, 라면, @everyone'
    }
  });

  const handled = await handleChoiceCommand(interaction, { random: () => 0.99 });

  assert.equal(handled, true);
  assert.equal(interaction.replies.length, 1);
  assert.match(interaction.replies[0].content, /선택 결과/);
  assert.match(interaction.replies[0].content, /@everyone/);
  assert.deepEqual(interaction.replies[0].allowedMentions, { parse: [] });
});

test('선택 명령 핸들러는 후보가 부족하면 비공개 오류를 답한다', async () => {
  const interaction = createChoiceInteraction({
    stringOptions: {
      옵션: '김밥'
    }
  });

  const handled = await handleChoiceCommand(interaction);

  assert.equal(handled, true);
  assert.equal(interaction.replies.length, 1);
  assert.equal(interaction.replies[0].flags, MessageFlags.Ephemeral);
  assert.match(interaction.replies[0].content, /2~100|2개 이상/);
});

test('선택 핸들러는 다른 명령을 처리하지 않는다', async () => {
  const interaction = createChoiceInteraction({
    commandName: '궁합',
    stringOptions: {
      옵션: '김밥, 라면'
    }
  });

  assert.equal(await handleChoiceCommand(interaction), false);
  assert.equal(interaction.replies.length, 0);
});

function createChoiceInteraction({
  commandName = '선택',
  stringOptions = {}
} = {}) {
  return {
    commandName,
    user: { id: 'user-1', username: '테스터' },
    replies: [],
    isChatInputCommand: () => true,
    inGuild: () => true,
    options: {
      getString(name, required = false) {
        const value = stringOptions[name] ?? null;
        if (required && value === null) throw new Error(`${name} required`);
        return value;
      }
    },
    async reply(payload) {
      this.replies.push(payload);
    }
  };
}
