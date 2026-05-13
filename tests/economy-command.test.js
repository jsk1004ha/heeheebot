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
  const accountLinkCommand = payloads.find((command) => command.name === '계정연동');
  const loanCommand = payloads.find((command) => command.name === '돈빌리기');
  const exchangeCommand = payloads.find((command) => command.name === '환전');

  assert.ok(profileCommand);
  assert.ok(leaderboardCommand);
  assert.ok(currencyInfoCommand);
  assert.ok(accountLinkCommand);
  assert.ok(loanCommand);
  assert.equal(payloads.find((command) => command.name === '돈빌리기수락'), undefined);
  assert.equal(payloads.find((command) => command.name === '돈빌리기결정'), undefined);
  assert.equal(payloads.find((command) => command.name === '돈갚기'), undefined);
  assert.equal(exchangeCommand, undefined);
  assert.match(profileCommand.description, /레벨, 경험치, 골드, 성장 배지/);
  assert.ok(profileCommand.options.some((option) => option.name === '대상'));
  assert.ok(loanCommand.options.some((option) => option.name === '행동'));
  assert.ok(loanCommand.options.find((option) => option.name === '행동').choices.some((choice) => choice.value === 'status'));
  assert.notEqual(loanCommand.options.find((option) => option.name === '대상').required, true);
  assert.ok(loanCommand.options.some((option) => option.name === '상환방식'));
  assert.ok(loanCommand.options.some((option) => option.name === '이자방식'));
  assert.ok(loanCommand.options.some((option) => option.name === '이자기간'));
  assert.ok(loanCommand.options.some((option) => option.name === '선택'));
  assert.ok(loanCommand.options.some((option) => option.name === '돈'));
  assert.match(leaderboardCommand.description, /레벨\/경험치 랭킹/);
  assert.match(currencyInfoCommand.description, /통합 골드|정산 기준|사용처/);
  assert.match(accountLinkCommand.description, /계정/);
  assert.doesNotMatch(profileCommand.description, /누적|현재/);
  assert.doesNotMatch(leaderboardCommand.description, /누적|현재/);
});

test('계정연동 명령은 중복 계정 선택 메뉴를 표시한다', async () => {
  const economy = {
    async getAccountLinkSummary() {
      return {
        required: true,
        candidates: [
          {
            id: 'guild:guild-1',
            label: '서버 guild-1 · 첫계정',
            description: 'Lv.2 · 100 XP · 100골드'
          },
          {
            id: 'guild:guild-2',
            label: '서버 guild-2 · 둘째계정',
            description: 'Lv.5 · 1,000 XP · 900골드'
          }
        ]
      };
    }
  };
  const interaction = createInteraction('계정연동');

  await handleEconomyCommand(interaction, economy);

  const reply = interaction.replies[0];
  const row = reply.components[0].toJSON();
  assert.match(reply.content, /계정이 여러 서버에서 발견/);
  assert.equal(reply.components.length, 1);
  assert.equal(row.components[0].custom_id, 'account_link_select:user-1');
  assert.deepEqual(
    row.components[0].options.map((option) => option.value),
    ['guild:guild-1', 'guild:guild-2']
  );
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
  assert.match(profileContent, /🎮 캐릭터 카드/);
  assert.ok(profileReply.embeds[0].data.fields.length >= 5);
  assert.equal(profileReply.content, '🪪 **테스터님의 통합 프로필**');
  assert.match(profileContent, /Lv\. \*\*2\*\* · 등급 \*\*뉴비\*\*/);
  assert.match(profileContent, /대표 배지 \*\*SPROUT · 새싹 뉴비 배지\*\*/);
  assert.match(profileContent, /골드 \*\*300골드\*\* · 출석 \*\*1일\*\*/);
  assert.match(profileContent, /⚔️ RPG 캐릭터/);
  assert.match(profileContent, /RPG: \*\*미시작\*\*/);
  assert.match(profileContent, /🗡️ 검 성장/);
  assert.match(profileContent, /검: \*\*\+0 기본 검\*\*/);
  assert.match(profileContent, /🎖️ 성장\/정산/);
  assert.equal(profileReply.files[0].name, 'profile_badge_001_005.png');
  assert.equal(profileReply.embeds[0].data.title, '테스터 · Lv.2 뉴비');
  assert.equal(profileReply.embeds[0].data.image.url, 'attachment://profile_badge_001_005.png');
  assert.doesNotMatch(profileContent, /현재 레벨 경험치|누적 경험치|20 \/ 282/);
  assert.match(leaderboardInteraction.replies[0], /경험치 120 XP/);
  assert.doesNotMatch(leaderboardInteraction.replies[0], /누적 경험치 기준|누적 120 XP/);
});

test('송금 응답은 대상 유저를 원시 객체가 아니라 실제 멘션으로 표시한다', async () => {
  const calls = [];
  const economy = {
    async transfer(payload) {
      calls.push(payload);
      return {
        amount: payload.amount,
        from: { balance: 900 }
      };
    }
  };
  const targetUser = {
    id: 'user-2',
    username: '받는사람',
    bot: false
  };
  const interaction = createInteraction('송금', {
    targetUser,
    integerOptions: { 금액: 100 }
  });

  await handleEconomyCommand(interaction, economy);

  assert.equal(calls[0].toUserId, 'user-2');
  assert.match(interaction.replies[0].content, /<@user-2>/);
  assert.doesNotMatch(interaction.replies[0].content, /\[object Object\]/);
  assert.deepEqual(interaction.replies[0].allowedMentions, {
    parse: [],
    users: ['user-2']
  });
});

test('돈빌리기 명령은 대상/금액/기간/상환방식을 대출 요청으로 전달한다', async () => {
  const calls = [];
  const economy = {
    async requestUserLoan(payload) {
      calls.push(payload);
      return {
        request: {
          amount: payload.amount,
          termMs: payload.termHours * 60 * 60 * 1000,
          repaymentMode: payload.repaymentMode
        }
      };
    }
  };
  const targetUser = {
    id: 'user-2',
    username: '대출자',
    bot: false
  };
  const interaction = createInteraction('돈빌리기', {
    targetUser,
    integerOptions: { 돈: 500, 기간: 12 },
    stringOptions: { 상환방식: 'installment' }
  });

  await handleEconomyCommand(interaction, economy);

  assert.deepEqual(calls[0], {
    guildId: 'guild-1',
    borrowerUserId: 'user-1',
    borrowerUsername: '테스터',
    lenderUserId: 'user-2',
    lenderUsername: '대출자',
    amount: 500,
    termHours: 12,
    repaymentMode: 'installment'
  });
  assert.match(interaction.replies[0].content, /<@user-2>/);
  assert.match(interaction.replies[0].content, /매번 조금씩 갚기/);
});

test('돈빌리기 요청은 빌려줄 유저에게 DM 알림을 보낸다', async () => {
  const sent = [];
  const economy = {
    async requestUserLoan(payload) {
      return {
        request: {
          amount: payload.amount,
          termMs: payload.termHours * 60 * 60 * 1000,
          repaymentMode: payload.repaymentMode
        }
      };
    }
  };
  const targetUser = {
    id: 'user-2',
    username: '대출자',
    bot: false,
    async send(payload) {
      sent.push(payload);
    }
  };
  const interaction = createInteraction('돈빌리기', {
    targetUser,
    integerOptions: { 돈: 500, 기간: 12 },
    stringOptions: { 상환방식: 'installment' }
  });

  await handleEconomyCommand(interaction, economy);

  assert.equal(sent.length, 1);
  assert.match(sent[0].content, /돈을 빌려달라고 요청/);
  assert.match(sent[0].content, /500골드/);
  assert.match(sent[0].content, /이자기간:24/);
  assert.deepEqual(sent[0].allowedMentions, {
    parse: [],
    users: ['user-1']
  });
  assert.match(interaction.replies[0].content, /DM 알림을 보냈습니다/);
});

test('돈빌리기 현황은 대상 없이 내 대출과 빌려준 대출을 보여준다', async () => {
  const calls = [];
  const economy = {
    async getUserLoanStatus(payload) {
      calls.push(payload);
      return {
        target: null,
        borrowedLoans: [
          {
            lenderUserId: 'lender',
            lenderUsername: '빌려준사람',
            principal: 1_000,
            totalDue: 1_200,
            remaining: 700,
            interestBps: 1_000,
            interestPeriodMs: 12 * 60 * 60 * 1000,
            interestType: 'simple',
            dueAt: 3_600_000,
            overdue: false,
            repaymentMode: 'lump_sum'
          }
        ],
        outgoingRequests: [],
        lentLoans: [
          {
            borrowerUserId: 'borrower',
            borrowerUsername: '빌린사람',
            principal: 500,
            totalDue: 550,
            remaining: 550,
            interestBps: 500,
            interestPeriodMs: 24 * 60 * 60 * 1000,
            interestType: 'compound',
            dueAt: 7_200_000,
            overdue: true,
            repaymentMode: 'installment'
          }
        ],
        incomingRequests: [
          {
            borrowerUserId: 'pending',
            borrowerUsername: '요청자',
            lenderUserId: 'user-1',
            lenderUsername: '테스터',
            amount: 300,
            totalDue: 0,
            termMs: 3_600_000,
            repaymentMode: 'lump_sum',
            status: 'requested'
          }
        ]
      };
    }
  };
  const interaction = createInteraction('돈빌리기', {
    stringOptions: { 행동: 'status' }
  });

  await handleEconomyCommand(interaction, economy);

  assert.equal(calls[0].userId, 'user-1');
  assert.equal(calls[0].targetUserId, undefined);
  assert.match(interaction.replies[0].content, /돈빌리기 현황/);
  assert.match(interaction.replies[0].content, /빌려준사람/);
  assert.match(interaction.replies[0].content, /빌린사람/);
  assert.match(interaction.replies[0].content, /내 조건 제시 필요/);
});

test('돈빌리기수락과 결정 명령은 이자 조건과 최종 선택을 처리한다', async () => {
  const calls = [];
  const economy = {
    async offerUserLoan(payload) {
      calls.push(['offer', payload]);
      return {
        offer: {
          amount: 1_000,
          totalDue: 1_100,
          interestPeriodMs: payload.interestPeriodHours * 60 * 60 * 1000,
          interestType: payload.interestType,
          termMs: 3_600_000,
          repaymentMode: 'lump_sum'
        }
      };
    },
    async decideUserLoan(payload) {
      calls.push(['decide', payload]);
      return {
        accepted: true,
        loan: {
          principal: 1_000,
          totalDue: 1_100,
          interestBps: 1_000,
          interestPeriodMs: 12 * 60 * 60 * 1000,
          interestType: 'simple',
          dueAt: 3_600_000,
          repaymentMode: 'lump_sum'
        }
      };
    }
  };
  const targetUser = {
    id: 'user-2',
    username: '상대',
    bot: false
  };

  await handleEconomyCommand(createInteraction('돈빌리기', {
    targetUser,
    integerOptions: { 이자: 10, 이자기간: 12 },
    stringOptions: { 행동: 'offer', 이자방식: 'simple' }
  }), economy);
  const decisionInteraction = createInteraction('돈빌리기', {
    targetUser,
    stringOptions: { 행동: 'decide', 선택: 'accept' }
  });
  await handleEconomyCommand(decisionInteraction, economy);

  assert.equal(calls[0][0], 'offer');
  assert.equal(calls[0][1].borrowerUserId, 'user-2');
  assert.equal(calls[0][1].interestPercent, 10);
  assert.equal(calls[0][1].interestPeriodHours, 12);
  assert.equal(calls[0][1].interestType, 'simple');
  assert.equal(calls[1][0], 'decide');
  assert.equal(calls[1][1].lenderUserId, 'user-2');
  assert.equal(calls[1][1].accept, true);
  assert.match(decisionInteraction.replies[0].content, /만기 후 수익 35% 자동 상환/);
  assert.match(decisionInteraction.replies[0].content, /이자 주기: \*\*12시간 0분\*\*/);
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
  assert.match(content, /Lv\. \*\*10\*\* · 등급 \*\*견습\*\*/);
  assert.match(content, /대표 배지 \*\*RISING · 첫 별 견습 배지\*\*/);
  assert.match(content, /다음 배지 \*\*EMBER · 불씨 모험가 배지\*\*까지 1레벨/);
  assert.match(content, /칭호 \*\*VIP\*\*/);
  assert.match(content, /꾸미기 배지: 행운 배지/);
  assert.match(content, /🎖️ 성장\/정산/);
  assert.doesNotMatch(content, /🌱|✨|🌟|💫|🔥|👑|🌌|💎|🌈|🍀/);
  assert.equal(reply.files[0].name, 'profile_badge_006_010.png');
  assert.equal(reply.embeds[0].data.title, '별지기 · Lv.10 견습');
  assert.equal(reply.embeds[0].data.image.url, 'attachment://profile_badge_006_010.png');
});

test('프로필은 시즌 보상 프로필 배지를 이름으로 표시하고 내부 id를 숨긴다', async () => {
  const economy = {
    async getProfile() {
      return {
        userId: 'user-season',
        username: '시즌러',
        level: 12,
        xp: 0,
        totalXp: 2200,
        balance: 5000,
        dailyStreak: 2,
        community: {
          ownedTitles: ['season_dungeon_title'],
          equippedTitle: 'season_dungeon_title',
          cosmetics: {
            badges: ['season_spark', 'season_hero_profile']
          }
        }
      };
    }
  };
  const interaction = createInteraction('프로필');

  await handleEconomyCommand(interaction, economy);

  const content = getReplyContent(interaction.replies[0]);
  assert.match(content, /칭호 \*\*던전 개척자\*\*/);
  assert.match(content, /꾸미기 배지: 시즌 불씨 \/ 시즌 영웅 프로필 배지/);
  assert.doesNotMatch(content, /season_spark|season_hero_profile|season_dungeon_title/);
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
  assert.match(content, /대표 배지 \*\*MYTHIC · 신화 전야 배지\*\*/);
  assert.match(content, /이전 배지 19개/);
  assert.match(content, /다음 배지 \*\*RADIANT · 무지개 신화 배지\*\*까지 1레벨/);
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
          schemaVersion: 'heehee-rpg-v1',
          level: 25,
          xp: 0,
          totalXp: 0,
          startedAt: 1000,
          characterClass: 'warrior',
          primaryClass: 'warrior',
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
  assert.match(content, /대상유저/);
  assert.match(content, /🎮 캐릭터 카드/);
  assert.match(content, /⚔️ RPG 캐릭터/);
  assert.match(content, /여캐 검사 → 광전사/);
  assert.match(content, /지역 \*\*버려진 은광\*\*/);
  assert.match(content, /🗡️ 검 성장/);
  assert.match(content, /검: \*\*\+37 /);
  assert.match(content, /최고 \*\*\+42강\*\*/);
  assert.match(content, /📈 자산\/주식/);
  assert.match(content, /총자산 \*\*12,000골드\*\*/);
  assert.match(content, /🏅 커뮤니티/);
  assert.match(content, /칭호 \*\*VIP\*\*/);
  assert.match(content, /완료 미션 \*\*4개\*\*/);
});

test('대상 유저 프로필은 이미 defer된 interaction을 editReply로 완료한다', async () => {
  const targetUser = {
    id: 'user-2',
    username: '대상유저'
  };
  const economy = {
    async getProfile() {
      return {
        userId: 'user-2',
        username: '대상유저',
        level: 1,
        xp: 0,
        totalXp: 0,
        balance: 0,
        dailyStreak: 0
      };
    }
  };
  const interaction = createInteraction('프로필', {
    targetUser,
    deferred: true,
    throwOnReply: true
  });

  await handleEconomyCommand(interaction, economy);

  assert.equal(interaction.replies.length, 0);
  assert.equal(interaction.edits.length, 1);
  assert.match(getReplyContent(interaction.edits[0]), /대상유저님의 프로필/);
});

test('재화정보 명령은 통합 골드 사용처와 기존 지갑 정산 기준을 안내한다', async () => {
  const interaction = createInteraction('재화정보');
  const handled = await handleEconomyCommand(interaction, {});

  assert.equal(handled, true);
  assert.match(interaction.replies[0], /골드/);
  assert.match(interaction.replies[0], /카지노/);
  assert.match(interaction.replies[0], /RPG/);
  assert.match(interaction.replies[0], /강화/);
  assert.match(interaction.replies[0], /낚시강화/);
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
    deferred: options.deferred ?? false,
    replied: options.replied ?? false,
    replies: [],
    edits: [],
    followUps: [],
    isChatInputCommand() {
      return true;
    },
    inGuild() {
      return true;
    },
    options: {
      getInteger(name) {
        return options.integerOptions?.[name] ?? null;
      },
      getString(name) {
        return options.stringOptions?.[name] ?? null;
      },
      getUser(name) {
        return name === '대상' ? options.targetUser ?? null : null;
      }
    },
    async reply(message) {
      if (options.throwOnReply) {
        throw new Error('reply should not be used');
      }
      this.replied = true;
      this.replies.push(message);
    },
    async editReply(message) {
      this.replied = true;
      this.edits.push(message);
    },
    async followUp(message) {
      this.followUps.push(message);
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
