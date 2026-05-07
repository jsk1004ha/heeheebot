import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getEconomyCommandPayloads,
  handleEconomyCommand
} from '../src/commands/economy.js';
import {
  getProfileBadgeAttachment,
  PROFILE_LEVEL_BADGES
} from '../src/systems/profile-assets.js';

test('경제 명령 payload는 경험치를 단일 표현으로 설명한다', () => {
  const payloads = getEconomyCommandPayloads();
  const profileCommand = payloads.find((command) => command.name === '프로필');
  const leaderboardCommand = payloads.find((command) => command.name === '랭킹');
  const currencyInfoCommand = payloads.find((command) => command.name === '재화정보');
  const exchangeCommand = payloads.find((command) => command.name === '환전');

  assert.ok(profileCommand);
  assert.ok(leaderboardCommand);
  assert.ok(currencyInfoCommand);
  assert.equal(exchangeCommand, undefined);
  assert.match(profileCommand.description, /레벨, 경험치, 골드, 성장 배지/);
  assert.ok(profileCommand.options.some((option) => option.name === '대상'));
  assert.match(leaderboardCommand.description, /레벨\/경험치 랭킹/);
  assert.match(currencyInfoCommand.description, /통합 골드|정산 기준|사용처/);
  assert.doesNotMatch(profileCommand.description, /누적|현재/);
  assert.doesNotMatch(leaderboardCommand.description, /누적|현재/);
});

test('프로필과 랭킹 출력은 전체 경험치를 경험치로 표시한다', async () => {
  const economy = {
    async getProfile() {
      return {
        userId: 'user-1',
        username: '테스터',
        level: 2,
        xp: 20,
        totalXp: 120,
        balance: 300,
        dailyStreak: 1
      };
    },
    async getLeaderboard() {
      return [
        {
          userId: 'user-1',
          username: '테스터',
          level: 2,
          totalXp: 120,
          balance: 300
        }
      ];
    }
  };

  const profileInteraction = createInteraction('프로필');
  const leaderboardInteraction = createInteraction('랭킹');

  await handleEconomyCommand(profileInteraction, economy);
  await handleEconomyCommand(leaderboardInteraction, economy);

  const profileReply = profileInteraction.replies[0];
  const profileContent = getReplyContent(profileReply);
  assert.match(profileContent, /경험치: \*\*120 XP\*\*/);
  assert.match(profileContent, /성장 카드/);
  assert.ok(profileReply.embeds[0].data.fields.length >= 5);
  assert.equal(profileReply.content, '🪪 **테스터님의 통합 프로필**');
  assert.match(profileContent, /성장 배지: 현재 \*\*SPROUT · 새싹 뉴비 배지\*\*/);
  assert.match(profileContent, /대표 배지 이미지: \*\*SPROUT · 새싹 뉴비 배지\*\*/);
  assert.match(profileContent, /다음 배지: \*\*RISING · 첫 별 견습 배지\*\*까지 4레벨/);
  assert.match(profileContent, /통합 성장 요약/);
  assert.match(profileContent, /RPG: \*\*미시작\*\*/);
  assert.match(profileContent, /검: \*\*\+0 기본 검\*\*/);
  assert.equal(profileReply.files[0].name, 'profile_badge_001_005.png');
  assert.equal(profileReply.embeds[0].data.title, 'SPROUT · 새싹 뉴비 배지');
  assert.equal(profileReply.embeds[0].data.image.url, 'attachment://profile_badge_001_005.png');
  assert.doesNotMatch(profileContent, /현재 레벨 경험치|누적 경험치|20 \/ 282/);
  assert.match(leaderboardInteraction.replies[0], /경험치 120 XP/);
  assert.doesNotMatch(leaderboardInteraction.replies[0], /누적 경험치 기준|누적 120 XP/);
});

test('프로필 출력은 이미지 성장 배지와 10레벨 간격 다음 목표를 보여준다', async () => {
  const economy = {
    async getProfile() {
      return {
        userId: 'user-10',
        username: '별지기',
        level: 10,
        xp: 0,
        totalXp: 1500,
        balance: 9000,
        dailyStreak: 4,
        community: {
          equippedTitle: 'vip',
          cosmetics: {
            badges: ['badge_luck']
          }
        }
      };
    }
  };
  const interaction = createInteraction('프로필');

  await handleEconomyCommand(interaction, economy);

  const reply = interaction.replies[0];
  const content = getReplyContent(reply);
  assert.match(content, /단계: \*\*견습\*\*/);
  assert.match(content, /성장 배지: 현재 \*\*RISING · 첫 별 견습 배지\*\* \/ 이전 배지 1개/);
  assert.match(content, /다음 배지: \*\*EMBER · 불씨 모험가 배지\*\*까지 1레벨/);
  assert.match(content, /칭호 \*\*VIP\*\*/);
  assert.match(content, /꾸미기 배지: 행운 배지/);
  assert.doesNotMatch(content, /🌱|✨|🌟|💫|🔥|👑|🌌|💎|🌈|🍀/);
  assert.equal(reply.files[0].name, 'profile_badge_006_010.png');
  assert.equal(reply.embeds[0].data.title, 'RISING · 첫 별 견습 배지');
  assert.equal(reply.embeds[0].data.image.url, 'attachment://profile_badge_006_010.png');
});

test('프로필 성장 배지는 레벨 구간과 영어 칭호형 문구를 가진다', () => {
  const expectedRanges = [
    [1, 5],
    [6, 10],
    ...Array.from({ length: 19 }, (_, index) => [11 + index * 10, 20 + index * 10])
  ];

  assert.deepEqual(
    PROFILE_LEVEL_BADGES.map((badge) => [badge.minLevel, badge.maxLevel]),
    expectedRanges
  );
  assert.equal(PROFILE_LEVEL_BADGES[0].badgeText, 'SPROUT');
  assert.equal(PROFILE_LEVEL_BADGES.at(-1).badgeText, 'RADIANT');

  const expectedFiles = new Map([
    [30, 'profile_badge_021_030.png'],
    [50, 'profile_badge_041_050.png'],
    [70, 'profile_badge_061_070.png'],
    [190, 'profile_badge_181_190.png'],
    [200, 'profile_badge_191_200.png']
  ]);
  for (const [level, fileName] of expectedFiles) {
    const attachment = getProfileBadgeAttachment(level);
    assert.ok(attachment, `${level}레벨 구간 배지 이미지가 있어야 합니다.`);
    assert.equal(attachment.name, fileName);
  }
});

test('고레벨 프로필은 현재 구간 배지와 다음 영어 칭호 배지를 보여준다', async () => {
  const economy = {
    async getProfile() {
      return {
        userId: 'user-190',
        username: '고인물',
        level: 190,
        xp: 0,
        totalXp: 999999,
        balance: 123456,
        dailyStreak: 99
      };
    }
  };
  const interaction = createInteraction('프로필');

  await handleEconomyCommand(interaction, economy);

  const reply = interaction.replies[0];
  const content = getReplyContent(reply);
  assert.match(content, /성장 배지: 현재 \*\*MYTHIC · 신화 전야 배지\*\* \/ 이전 배지 19개/);
  assert.match(content, /다음 배지: \*\*RADIANT · 무지개 신화 배지\*\*까지 1레벨/);
  assert.equal(reply.files[0].name, 'profile_badge_181_190.png');
});

test('프로필은 대상 유저와 RPG/검/주식/커뮤니티 통합 요약을 보여준다', async () => {
  const targetUser = {
    id: 'user-2',
    username: '대상유저'
  };
  const economyCalls = [];
  const stockCalls = [];
  const economy = {
    async getProfile(guildId, userId, username) {
      economyCalls.push({ guildId, userId, username });
      return {
        userId,
        username,
        level: 12,
        xp: 300,
        totalXp: 2200,
        balance: 15000,
        dailyStreak: 7,
        community: {
          stats: {
            missionsCompleted: 4
          },
          ownedTitles: ['vip', 'steady'],
          equippedTitle: 'vip',
          cosmetics: {
            badges: ['badge_luck', 'badge_gold']
          }
        },
        rpg: {
          startedAt: 1000,
          characterClass: 'warrior',
          characterGender: 'female',
          advancedClass: 'berserker',
          currentArea: 'cave',
          hp: 120,
          mp: 35,
          equipment: {},
          gearInventory: {},
          equippedGear: {},
          learnedSkills: [],
          wins: 8,
          losses: 2
        },
        sword: {
          level: 37,
          highestLevel: 42,
          refineStones: 5,
          protectionScrolls: 2,
          battleWins: 3,
          battleLosses: 1
        }
      };
    }
  };
  const stocks = {
    async getPortfolio(params) {
      stockCalls.push(params);
      return {
        totalAssets: 12000,
        positions: [{}, {}],
        leveragedPositions: [{}],
        unrealizedProfit: 300,
        realizedProfit: -120
      };
    }
  };
  const interaction = createInteraction('프로필', { targetUser });

  await handleEconomyCommand(interaction, economy, { stocks });

  assert.deepEqual(economyCalls, [
    { guildId: 'guild-1', userId: 'user-2', username: '대상유저' }
  ]);
  assert.deepEqual(stockCalls, [
    { guildId: 'guild-1', userId: 'user-2', username: '대상유저' }
  ]);

  const content = getReplyContent(interaction.replies[0]);
  assert.match(content, /\*\*대상유저님의 프로필\*\*/);
  assert.match(content, /RPG: \*\*여캐 전사 → 광전사\*\*/);
  assert.match(content, /지역 \*\*수정 동굴\*\*/);
  assert.match(content, /검: \*\*\+37 /);
  assert.match(content, /최고 \*\*\+42강\*\*/);
  assert.match(content, /커뮤니티: 칭호 \*\*VIP\*\* \/ 꾸미기 배지 \*\*2개\*\* \/ 보유 칭호 \*\*2개\*\* \/ 완료 미션 \*\*4개\*\*/);
  assert.match(content, /주식: 총자산 \*\*12,000골드\*\* \/ 보유 \*\*2종\*\* \/ 레버리지 \*\*1개\*\* \/ 평가손익 \*\*\+300골드\*\* \/ 실현손익 \*\*-120골드\*\*/);
});

test('재화정보 명령은 통합 골드 사용처와 기존 지갑 정산 기준을 안내한다', async () => {
  const interaction = createInteraction('재화정보');
  const handled = await handleEconomyCommand(interaction, {});

  assert.equal(handled, true);
  assert.match(interaction.replies[0], /골드/);
  assert.match(interaction.replies[0], /카지노/);
  assert.match(interaction.replies[0], /RPG/);
  assert.match(interaction.replies[0], /강화/);
  assert.match(interaction.replies[0], /주식/);
  assert.match(interaction.replies[0], /RPG 골드: 기존 잔액의 30%/);
  assert.match(interaction.replies[0], /강화 코인: 기존 잔액의 50%/);
  assert.match(interaction.replies[0], /실제 현금/);
  assert.doesNotMatch(interaction.replies[0], /\/환전/);
});

function createInteraction(commandName, options = {}) {
  return {
    commandName,
    guildId: 'guild-1',
    user: {
      id: 'user-1',
      username: '테스터'
    },
    replies: [],
    isChatInputCommand() {
      return true;
    },
    inGuild() {
      return true;
    },
    options: {
      getInteger() {
        return null;
      },
      getUser(name) {
        return name === '대상' ? options.targetUser ?? null : null;
      }
    },
    async reply(message) {
      this.replies.push(message);
    }
  };
}

function getReplyContent(reply) {
  if (typeof reply === 'string') return reply;

  const embedText = (reply.embeds ?? [])
    .map((embed) => [
      embed.data?.title,
      embed.data?.description,
      ...(embed.data?.fields ?? []).flatMap((field) => [field.name, field.value]),
      embed.data?.footer?.text
    ].filter(Boolean).join('\n'))
    .join('\n');

  return [reply.content, embedText].filter(Boolean).join('\n');
}
