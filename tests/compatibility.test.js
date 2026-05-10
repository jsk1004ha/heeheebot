import { MessageFlags } from 'discord.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateCompatibility,
  formatCompatibilityResult,
  getCompatibilityCommandPayloads,
  handleCompatibilityCommand,
  normalizeCompatibilityName
} from '../src/commands/compatibility.js';

test('궁합 명령 payload는 이름 두 개를 필수 문자열로 받는다', () => {
  const [payload] = getCompatibilityCommandPayloads();

  assert.equal(payload.name, '궁합');
  assert.match(payload.description, /궁합|계산/);
  assert.deepEqual(payload.options.map((option) => option.name), ['이름1', '이름2']);
  assert.equal(payload.options[0].required, true);
  assert.equal(payload.options[1].required, true);
  assert.match(payload.options[0].description, /글자 수 제한 없이/);
  assert.doesNotMatch(payload.options[0].description, /3글자/);
});

test('궁합 계산은 같은 이름 조합에 항상 같은 점수를 반환하고 순서에도 흔들리지 않는다', () => {
  const first = calculateCompatibility('김희희', '박토끼');
  const repeat = calculateCompatibility('김희희', '박토끼');
  const reversed = calculateCompatibility('박토끼', '김희희');

  assert.equal(first.score, repeat.score);
  assert.deepEqual(first.components, repeat.components);
  assert.equal(first.score, reversed.score);
  assert.deepEqual(first.components, reversed.components);
  assert.ok(first.score >= 0 && first.score <= 100);
});

test('궁합 계산은 세 글자가 아닌 이름도 처리하고 계산 요소를 남긴다', () => {
  const result = calculateCompatibility('알렉산더대왕', '이순신장군님');
  const message = formatCompatibilityResult(result);

  assert.ok(result.score >= 0 && result.score <= 100);
  assert.equal(Object.keys(result.components).length, 6);
  assert.match(message, /이름파동/);
  assert.match(message, /글자결/);
  assert.match(message, /길이균형/);
  assert.match(message, /공통글자/);
  assert.match(message, /알렉산더대왕/);
  assert.match(message, /이순신장군님/);
});

test('궁합 이름 정규화는 공백을 정리하되 길이를 세 글자로 제한하지 않는다', () => {
  assert.equal(normalizeCompatibilityName('  홍   길동과친구  '), '홍 길동과친구');
});

test('궁합 명령 핸들러는 결과와 계산식을 답장한다', async () => {
  const interaction = createCompatibilityInteraction({
    stringOptions: {
      이름1: '토끼',
      이름2: '고양이친구'
    }
  });

  const handled = await handleCompatibilityCommand(interaction);

  assert.equal(handled, true);
  assert.equal(interaction.replies.length, 1);
  assert.match(interaction.replies[0].content, /이름 궁합 결과/);
  assert.match(interaction.replies[0].content, /\d+%/);
  assert.match(interaction.replies[0].content, /계산식:/);
  assert.deepEqual(interaction.replies[0].allowedMentions, { parse: [] });
});

test('궁합 명령 핸들러는 공백 이름을 거부한다', async () => {
  const interaction = createCompatibilityInteraction({
    stringOptions: {
      이름1: '   ',
      이름2: '고양이'
    }
  });

  const handled = await handleCompatibilityCommand(interaction);

  assert.equal(handled, true);
  assert.equal(interaction.replies[0].flags, MessageFlags.Ephemeral);
  assert.match(interaction.replies[0].content, /공백만/);
});

test('궁합 핸들러는 다른 명령을 처리하지 않는다', async () => {
  const interaction = createCompatibilityInteraction({
    commandName: '운세',
    stringOptions: {
      이름1: '희희',
      이름2: '토끼'
    }
  });

  assert.equal(await handleCompatibilityCommand(interaction), false);
  assert.equal(interaction.replies.length, 0);
});

function createCompatibilityInteraction({
  commandName = '궁합',
  stringOptions = {}
} = {}) {
  return {
    commandName,
    user: { id: 'user-1', username: '테스터' },
    replies: [],
    isChatInputCommand: () => true,
    isButton: () => false,
    inGuild: () => true,
    options: {
      getString: (name) => stringOptions[name]
    },
    async reply(payload) {
      this.replies.push(payload);
    }
  };
}
