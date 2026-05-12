import {
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder
} from 'discord.js';

const HELP_CATEGORIES = Object.freeze({
  home: Object.freeze({
    label: '전체',
    emoji: '📚',
    title: '희희봇 통합 도움말',
    description: [
      '자주 쓰는 명령어를 분류별 버튼으로 바로 확인합니다.',
      '`/프로필`에서 통합 성장 상태를 보고, 아래 버튼으로 RPG·검·주식·생활 기능을 골라보세요.'
    ].join('\n'),
    fields: Object.freeze([
      { name: '처음 시작', value: '`/시작하기` `/오늘할일` `/도움말 분류:시즌`' },
      { name: '성장/프로필', value: '`/프로필` `/출석` `/랭킹` `/재화정보`' },
      { name: '전투 성장', value: '`/rpg 메뉴` `/rpg 사냥` `/검강화` `/검배틀` `/검도감` `/시즌 정보`' },
      { name: '경제/놀이', value: '`/주식 시세` `/주식 보유` `/낚시` `/카지노정보` `/희진다마고치`' }
    ])
  }),
  season: Object.freeze({
    label: '시즌',
    emoji: '🏆',
    title: '통합 시즌 도움말',
    description: 'RPG, 검 강화, 검배틀 같은 여러 콘텐츠를 하나의 시즌 포인트와 시즌 칭호/한정 배지 보상으로 묶는 장기 이벤트입니다.',
    fields: Object.freeze([
      { name: '기본', value: '`/시즌 정보` — 내 점수, 오늘 획득량, 보상 현황 확인' },
      { name: '경쟁', value: '`/시즌 랭킹` — 서버 시즌 포인트 순위 확인' },
      { name: '과제', value: '`/시즌 과제` `/시즌 과제보상` — 오늘/주간 시즌 목표와 보너스 포인트 수령' },
      { name: '보상', value: '`/시즌 보상` — 시즌 칭호, 한정 배지, 프로필 배지 수령' }
    ])
  }),
  rpg: Object.freeze({
    label: 'RPG',
    emoji: '🧙',
    title: 'RPG 도움말',
    description: '캐릭터를 키우고 전직, 스킬트리, 장비, 레이드까지 이어가는 성장 루프입니다.',
    fields: Object.freeze([
      { name: '시작/상태', value: '`/rpg 시작` `/rpg 튜토리얼` `/rpg 메뉴` `/rpg 프로필` `/rpg 지역`' },
      { name: '성장 루프', value: '`/rpg 사냥` `/rpg 탐사` `/rpg 던전` `/rpg 휴식` `/rpg 일일`' },
      { name: '장비/성장 관리', value: '`/rpg 인벤토리` `/rpg 장비` `/rpg 강화` `/rpg 상점` `/rpg 제작` `/rpg 거래소`' },
      { name: '심화', value: '`/rpg 스토리` `/rpg 도감` `/rpg 전직` `/rpg 보스` `/rpg 레이드` `/rpg 길드레이드`' }
    ])
  }),
  sword: Object.freeze({
    label: '검',
    emoji: '🗡️',
    title: '검 강화 도움말',
    description: '`/검강화`로 100강까지 키우고 `/검도감`으로 해금 기록을 확인합니다.',
    fields: Object.freeze([
      { name: '강화', value: '`/검강화` `/검상급강화` `/검정보` `/선물받기`' },
      { name: '수집/보상', value: '`/검도감` `/검업적` `/검판매` `/검보호권`' },
      { name: '대결', value: '`/검배틀 상대:@유저` 또는 상대 없이 기존 유저 랜덤배틀' }
    ])
  }),
  stock: Object.freeze({
    label: '주식',
    emoji: '📈',
    title: '가상주식 도움말',
    description: '골드로 가상주식을 사고팔고, 시세 화면 버튼으로 시장 흐름을 빠르게 넘겨봅니다.',
    fields: Object.freeze([
      { name: '조회', value: '`/주식 시세` `/주식 전체시세` `/주식 신규상장` `/주식 보유`' },
      { name: '거래', value: '`/주식 매수` `/주식 매도` `/주식 지정가매수` `/주식 지정가매도`' },
      { name: '심화', value: '`/주식 차트` `/주식 뉴스` `/주식 배당금` `/주식 알림설정` `/주식 레버리지진입`' }
    ])
  }),
  life: Object.freeze({
    label: '생활',
    emoji: '🎒',
    title: '생활/서버 도움말',
    description: '학교 급식, 시간표, 오늘 정보, 커뮤니티 활동처럼 서버에서 자주 쓰는 편의 기능입니다.',
    fields: Object.freeze([
      { name: '생활 정보', value: '`/급식` `/자동급식 상태` `/시간표` `/오늘할일` `/운세` `/선택` `/투표`' },
      { name: '전역 업적/커뮤니티', value: '`/업적` `/칭호` `/미션` `/복권` `/서버이벤트` `/활동요약` `/끝말잇기` `/초성게임`' },
      { name: '관리/안전', value: '`/청소` `/경고` 등 서버 권한 명령은 권한이 있을 때만 사용됩니다.' }
    ])
  }),
  games: Object.freeze({
    label: '놀이',
    emoji: '🎮',
    title: '놀이/미니게임 도움말',
    description: '골드와 성장 루프를 가볍게 즐기는 미니게임 묶음입니다.',
    fields: Object.freeze([
      { name: '낚시', value: '`/낚시` `/낚시도감` `/낚시강화` `/잠수` `/물고기팀설정` `/물고기배틀`' },
      { name: '카지노', value: '`/카지노정보` `/슬롯` `/이모지경마` `/블랙잭` `/스크래치복권` 등 카지노 명령' },
      { name: '우노', value: '`/우노 시작` — 버튼으로 방을 만들고 기본 스태킹+Seven-O 또는 No Mercy 모드로 진행' },
      { name: '라이어게임', value: '`/라이어게임 시작` `/라이어게임 제출` — 주제만 공개하고 자기 차례에 명령어로 설명을 제출하는 추리 파티 게임' },
      { name: '초성게임', value: '`/초성게임 시작` — 랜덤 2글자 초성을 보고 채팅에서 가장 먼저 단어 맞히기' },
      { name: '워들', value: '`/워들 도전` `/워들 상태` `/워들 랭킹` — 하루 한 번 비공개 영어 단어 퍼즐' },
      { name: '숫자야구', value: '`/숫자야구 도전` `/숫자야구 상태` — 판마다 랜덤 4자리 숫자를 8번 안에 맞히면 XP와 골드 지급' },
      { name: '희진 다마고치', value: '`/희진다마고치` `/희진방` `/희진앨범` `/희진일기` `/희진방문` `/희진퀘스트`' },
      { name: '기타', value: '`/선택 옵션:김밥, 라면, 돈까스` — 최대 100개 후보 중 하나를 골라요.\n`/궁합 이름1:<이름> 이름2:<이름>` — 글자 수 제한 없이 재미용 이름 궁합을 봅니다.' }
    ])
  })
});

const HELP_CATEGORY_CHOICES = Object.freeze(
  Object.entries(HELP_CATEGORIES).map(([value, category]) => ({
    name: `${category.emoji} ${category.label}`,
    value
  }))
);

export const helpCommands = [
  new SlashCommandBuilder()
    .setName('도움말')
    .setDescription('희희봇 명령어를 카테고리별 버튼으로 확인합니다.')
    .addStringOption((option) =>
      option
        .setName('분류')
        .setDescription('먼저 열어볼 도움말 분류')
        .addChoices(...HELP_CATEGORY_CHOICES)
    )
];

export function getHelpCommandPayloads() {
  return helpCommands.map((command) => command.toJSON());
}

export async function handleHelpCommand(interaction) {
  if (interaction.isButton?.() && interaction.customId?.startsWith('help:')) {
    return handleHelpButton(interaction);
  }

  if (!interaction.isChatInputCommand?.() || interaction.commandName !== '도움말') {
    return false;
  }

  const category = interaction.options.getString('분류') ?? 'home';
  await interaction.reply(createHelpPayload(category, interaction.user.id));
  return true;
}

async function handleHelpButton(interaction) {
  const [, category, ownerId] = interaction.customId.split(':');

  if (ownerId && interaction.user.id !== ownerId) {
    await interaction.reply({
      content: '이 도움말 버튼은 명령어를 실행한 유저만 사용할 수 있습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  await interaction.update(createHelpPayload(category, interaction.user.id));
  return true;
}

function createHelpPayload(categoryId = 'home', userId = null) {
  const safeCategoryId = HELP_CATEGORIES[categoryId] ? categoryId : 'home';
  const category = HELP_CATEGORIES[safeCategoryId];
  const embed = new EmbedBuilder()
    .setTitle(`${category.emoji} ${category.title}`)
    .setDescription(category.description)
    .setColor(getHelpCategoryColor(safeCategoryId))
    .setFooter({ text: '버튼으로 분류를 바꾸거나 /도움말 분류:<이름>으로 바로 열 수 있어요.' });

  for (const field of category.fields) {
    embed.addFields({ ...field, inline: false });
  }

  return {
    embeds: [embed],
    components: createHelpRows(userId, safeCategoryId)
  };
}

function createHelpRows(userId, activeCategoryId) {
  const entries = Object.entries(HELP_CATEGORIES);
  return [
    entries.slice(0, 3),
    entries.slice(3)
  ].map((group) =>
    new ActionRowBuilder().addComponents(
      ...group.map(([id, category]) =>
        new ButtonBuilder()
          .setCustomId(`help:${id}:${userId ?? 'public'}`)
          .setLabel(category.label)
          .setEmoji(category.emoji)
          .setStyle(id === activeCategoryId ? ButtonStyle.Primary : ButtonStyle.Secondary)
      )
    )
  );
}

function getHelpCategoryColor(categoryId) {
  return {
    home: 0x38bdf8,
    season: 0xfacc15,
    rpg: 0xa855f7,
    sword: 0xf59e0b,
    stock: 0x22c55e,
    life: 0x60a5fa,
    games: 0xec4899
  }[categoryId] ?? 0x38bdf8;
}
