import { MessageFlags, SlashCommandBuilder } from 'discord.js';

export const MIN_CHOICE_OPTIONS = 2;
export const MAX_CHOICE_OPTIONS = 100;
export const CHOICE_INPUT_OPTION_NAME = '옵션';
export const CHOICE_INPUT_MAX_LENGTH = 6000;
export const CHOICE_OPTION_MAX_LENGTH = 80;

const choiceCommands = [
  new SlashCommandBuilder()
    .setName('선택')
    .setDescription('점심 메뉴처럼 여러 옵션 중 하나를 무작위로 골라줍니다.')
    .addStringOption((option) =>
      option
        .setName(CHOICE_INPUT_OPTION_NAME)
        .setDescription('2~100개 후보. 쉼표/줄바꿈/공백 또는 (후보1) (후보2) 형식으로 구분')
        .setRequired(true)
        .setMaxLength(CHOICE_INPUT_MAX_LENGTH)
    )
];

export function getChoiceCommandPayloads() {
  return choiceCommands.map((command) => command.toJSON());
}

export async function handleChoiceCommand(interaction, { random = Math.random } = {}) {
  if (!interaction.isChatInputCommand?.() || interaction.commandName !== '선택') {
    return false;
  }

  try {
    const result = chooseFromOptions(
      interaction.options.getString(CHOICE_INPUT_OPTION_NAME, true),
      { random }
    );
    await interaction.reply(createChoicePayload(result));
  } catch (error) {
    await interaction.reply({
      content: `선택할 수 없습니다: ${error.message}`,
      flags: MessageFlags.Ephemeral
    });
  }

  return true;
}

export function chooseFromOptions(rawOptions, { random = Math.random } = {}) {
  const options = parseChoiceOptions(rawOptions);
  const selectedIndex = pickOptionIndex(options.length, random);

  return {
    options,
    selected: options[selectedIndex],
    selectedIndex
  };
}

export function parseChoiceOptions(rawOptions) {
  const input = normalizeChoiceInput(rawOptions);
  if (!input) {
    throw new Error('옵션을 2개 이상 입력해 주세요. 예: `김밥, 라면, 돈까스`');
  }

  const parenthesizedOptions = parseParenthesizedOptions(input);
  const candidates = parenthesizedOptions ?? splitChoiceInput(input);
  const options = candidates
    .map(normalizeChoiceOption)
    .filter(Boolean);

  validateChoiceOptions(options);
  return options;
}

export function formatChoiceResult(result) {
  const pickedNumber = result.selectedIndex + 1;

  return [
    '🎲 **선택 결과**',
    `후보 ${result.options.length.toLocaleString()}개 중 **${pickedNumber.toLocaleString()}번**을 골랐어요.`,
    `👉 **${result.selected}**`
  ].join('\n');
}

function createChoicePayload(result) {
  return {
    content: formatChoiceResult(result),
    allowedMentions: { parse: [] }
  };
}

function normalizeChoiceInput(rawOptions) {
  return String(rawOptions ?? '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim();
}

function parseParenthesizedOptions(input) {
  const matches = [...input.matchAll(/\(([^()]+)\)/gu)];
  if (matches.length < MIN_CHOICE_OPTIONS) return null;

  const remainder = input
    .replace(/\(([^()]+)\)/gu, '')
    .replace(/[\s,，、;；|]+/gu, '');
  if (remainder.length > 0) return null;

  return matches.map((match) => match[1]);
}

function splitChoiceInput(input) {
  if (/[\n\r,，、;；|]/u.test(input)) {
    return input.split(/[\n\r,，、;；|]+/u);
  }

  return input.split(/\s+/u);
}

function normalizeChoiceOption(option) {
  return String(option ?? '')
    .trim()
    .replace(/\s+/g, ' ');
}

function validateChoiceOptions(options) {
  if (options.length < MIN_CHOICE_OPTIONS || options.length > MAX_CHOICE_OPTIONS) {
    throw new Error(`옵션은 ${MIN_CHOICE_OPTIONS}~${MAX_CHOICE_OPTIONS}개로 입력해 주세요.`);
  }

  const tooLongOption = options.find((option) =>
    [...option].length > CHOICE_OPTION_MAX_LENGTH
  );
  if (tooLongOption) {
    throw new Error(`각 옵션은 ${CHOICE_OPTION_MAX_LENGTH}자 이하로 입력해 주세요: ${tooLongOption.slice(0, 20)}…`);
  }
}

function pickOptionIndex(optionCount, random) {
  const value = Number(random());
  const bounded = Number.isFinite(value)
    ? Math.max(0, Math.min(value, Number.MAX_VALUE))
    : 0;

  return Math.min(optionCount - 1, Math.floor(bounded * optionCount));
}
