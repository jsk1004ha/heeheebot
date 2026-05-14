import {
  toCompatibleMoneyValue,
  toMoney
} from '../systems/money.js';

const MONEY_INPUT_MAX_LENGTH = 40;
const MONEY_INPUT_EXAMPLE_TEXT = '예: 1억, 1조, 1경';

export function configureMoneyStringOption({
  name,
  description,
  required = false,
  maxLength = MONEY_INPUT_MAX_LENGTH
}) {
  return (option) => {
    const configured = option
      .setName(name)
      .setDescription(appendMoneyInputExample(description))
      .setMaxLength(maxLength);

    return required ? configured.setRequired(true) : configured;
  };
}

export function getMoneyInputOption(interaction, name, {
  required = false,
  label = name
} = {}) {
  const stringValue = interaction.options?.getString?.(name);
  const integerValue = stringValue == null ? interaction.options?.getInteger?.(name) : null;
  const value = stringValue ?? integerValue;

  if (value === null || value === undefined || value === '') {
    if (required) {
      throw new Error(`${label}을 입력해주세요.`);
    }
    return null;
  }

  return toCompatibleMoneyValue(toMoney(value, label));
}

function appendMoneyInputExample(description) {
  const text = String(description ?? '').trim();
  if (text.includes('예:') || text.includes('1억')) return text;
  return `${text} (${MONEY_INPUT_EXAMPLE_TEXT})`;
}
