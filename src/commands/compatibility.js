import { MessageFlags, SlashCommandBuilder } from 'discord.js';

const HANGUL_BASE = 0xac00;
const HANGUL_END = 0xd7a3;
const HANGUL_CHO_COUNT = 19;
const HANGUL_JUNG_COUNT = 21;
const HANGUL_JONG_COUNT = 28;
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const MAX_DISPLAY_NAME_LENGTH = 80;

export const compatibilityCommands = [
  new SlashCommandBuilder()
    .setName('궁합')
    .setDescription('두 이름의 이름결, 리듬, 길이 균형으로 재미용 궁합을 계산합니다.')
    .addStringOption((option) =>
      option
        .setName('이름1')
        .setDescription('첫 번째 이름. 글자 수 제한 없이 입력할 수 있습니다.')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('이름2')
        .setDescription('두 번째 이름. 같은 조합은 항상 같은 결과가 나옵니다.')
        .setRequired(true)
    )
];

export function getCompatibilityCommandPayloads() {
  return compatibilityCommands.map((command) => command.toJSON());
}

export async function handleCompatibilityCommand(interaction) {
  if (!interaction.isChatInputCommand?.() || interaction.commandName !== '궁합') {
    return false;
  }

  const name1 = interaction.options.getString('이름1', true);
  const name2 = interaction.options.getString('이름2', true);

  try {
    const result = calculateCompatibility(name1, name2);
    await interaction.reply(createCompatibilityPayload(result));
  } catch (error) {
    await interaction.reply({
      content: error instanceof Error ? error.message : '이름 궁합을 계산하지 못했습니다.',
      flags: MessageFlags.Ephemeral
    });
  }

  return true;
}

export function calculateCompatibility(rawName1, rawName2) {
  const left = analyzeName(rawName1);
  const right = analyzeName(rawName2);
  const pairKey = [left.key, right.key].sort((a, b) => a.localeCompare(b, 'ko')).join('\u0000');
  const nameWave = hashString(`heehee:compatibility:${pairKey}`) % 101;
  const strokeHarmony = 100 - Math.abs(left.nameEnergy - right.nameEnergy);
  const rhythmHarmony = 100 - Math.abs(left.rhythm - right.rhythm);
  const lengthBalance = Math.max(0, 100 - Math.abs(left.length - right.length) * 12);
  const edgeSignal = calculateEdgeSignal(left, right);
  const sharedLetters = calculateSharedLetterScore(left, right);
  const components = {
    nameWave,
    strokeHarmony,
    rhythmHarmony,
    lengthBalance,
    edgeSignal,
    sharedLetters
  };

  let score = Math.round(
    nameWave * 0.42
    + strokeHarmony * 0.2
    + rhythmHarmony * 0.14
    + lengthBalance * 0.1
    + edgeSignal * 0.1
    + sharedLetters * 0.04
  );

  if (left.key === right.key) {
    score = Math.max(score, 96);
  }

  score = clamp(score, 0, 100);

  return {
    names: [left.displayName, right.displayName],
    score,
    tier: getCompatibilityTier(score),
    components
  };
}

export function formatCompatibilityResult(result) {
  const [name1, name2] = result.names.map(formatDisplayName);
  const componentText = [
    `이름파동 ${result.components.nameWave}`,
    `글자결 ${result.components.strokeHarmony}`,
    `리듬 ${result.components.rhythmHarmony}`,
    `길이균형 ${result.components.lengthBalance}`,
    `끝자락신호 ${result.components.edgeSignal}`,
    `공통글자 ${result.components.sharedLetters}`
  ].join(' · ');

  return [
    `${result.tier.emoji} **이름 궁합 결과**`,
    `**${name1}** × **${name2}** = **${result.score}%**`,
    `\`${createScoreBar(result.score)}\``,
    '',
    `등급: **${result.tier.label}**`,
    result.tier.message,
    '',
    `계산식: ${componentText}`,
    '※ 같은 이름 조합은 항상 같은 결과가 나오며, 순서를 바꿔도 같은 점수입니다. 재미용으로만 봐주세요!'
  ].join('\n');
}

export function normalizeCompatibilityName(rawName) {
  return String(rawName ?? '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

function createCompatibilityPayload(result) {
  return {
    content: formatCompatibilityResult(result),
    allowedMentions: { parse: [] }
  };
}

function analyzeName(rawName) {
  const displayName = normalizeCompatibilityName(rawName);
  if (!displayName) {
    throw new Error('이름은 공백만으로 입력할 수 없습니다. 한 글자 이상 입력해주세요.');
  }

  const key = displayName.toLocaleLowerCase('ko-KR');
  const chars = [...key].filter((char) => !/\s/u.test(char));
  if (chars.length === 0) {
    throw new Error('이름은 공백만으로 입력할 수 없습니다. 한 글자 이상 입력해주세요.');
  }

  let nameEnergySeed = 0;
  let rhythmSeed = 0;
  const signals = [];

  chars.forEach((char, index) => {
    const codePoint = char.codePointAt(0);
    const hangul = decomposeHangul(char);

    if (hangul) {
      const syllableEnergy = (hangul.cho + 1) * 3
        + (hangul.jung + 1) * 5
        + (hangul.jong + 1) * 7;
      nameEnergySeed += syllableEnergy * (index + 1);
      rhythmSeed += (hangul.cho + 1) + (hangul.jung + 1) * 4 + (hangul.jong > 0 ? 9 : 2);
      signals.push((hangul.cho * 7 + hangul.jung * 11 + hangul.jong * 13) % 12);
      return;
    }

    nameEnergySeed += ((codePoint % 97) + 1) * (index + 1);
    rhythmSeed += codePoint % 53;
    signals.push(codePoint % 12);
  });

  return {
    displayName,
    key,
    chars,
    distinctChars: new Set(chars),
    length: chars.length,
    nameEnergy: nameEnergySeed % 101,
    rhythm: (rhythmSeed + chars.length * 11) % 101,
    firstSignal: signals[0],
    lastSignal: signals[signals.length - 1]
  };
}

function decomposeHangul(char) {
  const codePoint = char.codePointAt(0);
  if (codePoint < HANGUL_BASE || codePoint > HANGUL_END) return null;

  const syllableIndex = codePoint - HANGUL_BASE;
  const cho = Math.floor(syllableIndex / (HANGUL_JUNG_COUNT * HANGUL_JONG_COUNT));
  const jung = Math.floor((syllableIndex % (HANGUL_JUNG_COUNT * HANGUL_JONG_COUNT)) / HANGUL_JONG_COUNT);
  const jong = syllableIndex % HANGUL_JONG_COUNT;

  if (cho < 0 || cho >= HANGUL_CHO_COUNT) return null;
  return { cho, jung, jong };
}

function calculateEdgeSignal(left, right) {
  const crossGap = Math.min(
    circularGap(left.firstSignal, right.lastSignal, 12),
    circularGap(left.lastSignal, right.firstSignal, 12)
  );

  return Math.round(100 - crossGap * (100 / 6));
}

function calculateSharedLetterScore(left, right) {
  const union = new Set([...left.distinctChars, ...right.distinctChars]);
  const commonCount = [...left.distinctChars].filter((char) => right.distinctChars.has(char)).length;

  return Math.round((commonCount / union.size) * 100);
}

function circularGap(a, b, size) {
  const gap = Math.abs(a - b);
  return Math.min(gap, size - gap);
}

function hashString(value) {
  let hash = FNV_OFFSET_BASIS;

  for (const char of value) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }

  hash ^= value.length;
  return hash >>> 0;
}

function getCompatibilityTier(score) {
  if (score >= 95) {
    return {
      emoji: '💞',
      label: '전설의 찰떡궁합',
      message: '이름결이 거의 같은 박자로 맞물립니다. 장난처럼 시작해도 케미가 오래 남는 조합이에요.'
    };
  }
  if (score >= 85) {
    return {
      emoji: '💘',
      label: '운명급 케미',
      message: '서로의 리듬을 잘 받아주는 조합입니다. 함께 있으면 분위기가 자연스럽게 살아나요.'
    };
  }
  if (score >= 70) {
    return {
      emoji: '💕',
      label: '꽤 잘 맞는 궁합',
      message: '다른 부분도 있지만 맞춰가는 재미가 큽니다. 먼저 말 걸면 의외로 잘 풀려요.'
    };
  }
  if (score >= 55) {
    return {
      emoji: '💗',
      label: '가능성 있는 궁합',
      message: '처음엔 평범해 보여도 공통 포인트를 찾으면 금방 가까워질 수 있는 조합입니다.'
    };
  }
  if (score >= 40) {
    return {
      emoji: '💫',
      label: '밀당형 궁합',
      message: '리듬이 살짝 엇갈립니다. 기대치를 낮추고 천천히 맞추면 재미있는 조합이 될 수 있어요.'
    };
  }
  if (score >= 25) {
    return {
      emoji: '🌙',
      label: '노력형 궁합',
      message: '서로의 속도가 다를 수 있습니다. 한 박자 쉬어가며 말하면 오해를 줄일 수 있어요.'
    };
  }

  return {
    emoji: '🧊',
    label: '반전 필요 궁합',
    message: '이름결만 보면 온도 차가 큽니다. 그래도 궁합표보다 실제 대화가 더 중요합니다.'
  };
}

function createScoreBar(score) {
  const filled = Math.round(score / 10);
  return `${'█'.repeat(filled)}${'░'.repeat(10 - filled)} ${score}%`;
}

function formatDisplayName(name) {
  const chars = [...name];
  const displayName = chars.length <= MAX_DISPLAY_NAME_LENGTH
    ? name
    : `${chars.slice(0, MAX_DISPLAY_NAME_LENGTH - 1).join('')}…`;

  return escapeDiscordMarkdown(displayName);
}

function escapeDiscordMarkdown(value) {
  return value.replace(/([\\`*_~|>])/g, '\\$1');
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
