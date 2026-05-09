import { MessageFlags } from 'discord.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getTodayCommandPayloads,
  handleTodayCommand
} from '../src/commands/today.js';

test('오늘할일 명령 payload는 통합 일일 체크리스트를 등록한다', () => {
  const [payload] = getTodayCommandPayloads();

  assert.equal(payload.name, '오늘할일');
  assert.match(payload.description, /오늘|할 일|체크/);
  assert.equal(payload.options?.length ?? 0, 0);
});

test('오늘할일은 출석, 운세, 커뮤니티 미션, RPG 일일, 검 선물, 학교 바로가기를 보여준다', async () => {
  const interaction = createTodayInteraction();
  const handled = await handleTodayCommand(interaction, createServices({
    profile: {
      lastDailyDay: 20_000,
      lastFortuneXpDay: 20_000,
      dailyStreak: 4
    },
    dailyMissions: [
      mission('daily_checkin', '출석 찍기', true, false, '완료'),
      mission('daily_fortune', '운세 확인', true, true, '완료'),
      mission('daily_lottery', '복권 한 장', false, false, '0 / 1장')
    ],
    rpgDailyMissions: [
      rpgMission('field_training', '전장 훈련', 2, 2, true, false),
      rpgMission('route_scout', '정찰 의뢰', 0, 1, false, false)
    ],
    swordStatus: {
      giftAvailable: true,
      battleRemaining: 7,
      battleStoneRemaining: 3
    },
    seasonOverview: {
      profile: { totalPoints: 160 },
      daily: { earned: 40, cap: 300, remaining: 260 },
      rewards: [
        { label: '시즌 불씨', claimable: true, claimed: false, requiredPoints: 50 },
        { label: '시즌 화염', claimable: false, claimed: false, requiredPoints: 150 }
      ]
    },
    seasonChallenges: {
      daily: [
        { label: '오늘의 첫 전투', completed: true, claimable: true, claimed: false },
        { label: '대장장이 출근도장', completed: false, claimable: false, claimed: false }
      ],
      weekly: [
        { label: '주간 시즌 러너', completed: false, claimable: false, claimed: false }
      ]
    }
  }));

  assert.equal(handled, true);
  assert.equal(interaction.replies.length, 1);
  assert.match(interaction.replies[0].content, /오늘 할 일/);
  assert.match(interaction.replies[0].content, /출석 보상/);
  assert.match(interaction.replies[0].content, /운세 XP/);
  assert.match(interaction.replies[0].content, /커뮤니티 일일 미션/);
  assert.match(interaction.replies[0].content, /RPG 일일 의뢰/);
  assert.match(interaction.replies[0].content, /검 선물/);
  assert.match(interaction.replies[0].content, /시즌 포인트/);
  assert.match(interaction.replies[0].content, /시즌 불씨/);
  assert.match(interaction.replies[0].content, /시즌 과제/);
  assert.match(interaction.replies[0].content, /오늘 1\/2개/);
  assert.match(interaction.replies[0].content, /\/급식/);
  assert.match(interaction.replies[0].content, /\/시간표/);
  assert.match(interaction.replies[0].content, /보상 가능 \*\*1개\*\*/);
  assert.match(interaction.replies[0].content, /\/재화정보/);
  assert.doesNotMatch(interaction.replies[0].content, /\/환전/);
  assert.ok(getCustomIds(interaction.replies[0]).includes('today_checkin:user-1'));
  assert.ok(getCustomIds(interaction.replies[0]).includes('today_missions:user-1'));
  assert.ok(getCustomIds(interaction.replies[0]).includes('rpg_quick:user-1:daily'));
  assert.ok(getCustomIds(interaction.replies[0]).includes('rpg_quick:user-1:menu'));
});

test('오늘할일 출석 버튼은 출석을 수령하고 새 체크리스트로 갱신한다', async () => {
  const interaction = createTodayButtonInteraction('today_checkin:user-1');
  const services = createServices({
    profile: { lastDailyDay: null, lastFortuneXpDay: null, dailyStreak: 0 },
    dailyMissions: [],
    rpgDailyMissions: [],
    swordStatus: { giftAvailable: false, giftRemainingMs: 60_000, battleRemaining: 10, battleStoneRemaining: 5 },
    claimDailyResult: {
      claimed: true,
      xpGained: 100,
      reward: 500,
      streak: 1,
      profile: { lastDailyDay: 20_001, lastFortuneXpDay: null, dailyStreak: 1 }
    }
  });

  const handled = await handleTodayCommand(interaction, services);

  assert.equal(handled, true);
  assert.equal(services.economy.claimedDaily, true);
  assert.equal(interaction.updates.length, 1);
  assert.match(interaction.updates[0].content, /출석 완료/);
  assert.match(interaction.updates[0].content, /\+100 XP/);
  assert.match(interaction.updates[0].content, /\+500원/);
});

test('다른 유저는 오늘할일 버튼을 누를 수 없다', async () => {
  const interaction = createTodayButtonInteraction('today_checkin:owner-1', {
    userId: 'other-1'
  });
  const handled = await handleTodayCommand(interaction, createServices());

  assert.equal(handled, true);
  assert.equal(interaction.replies[0].flags, MessageFlags.Ephemeral);
  assert.match(interaction.replies[0].content, /명령어를 실행한 유저/);
});

function mission(id, title, completed, claimed, progress) {
  return {
    id,
    title,
    description: `${title} 설명`,
    completed,
    claimed,
    progress,
    reward: { xp: 20, coins: 100 }
  };
}

function rpgMission(id, label, current, required, complete, claimed) {
  return {
    id,
    label,
    description: `${label} 설명`,
    current,
    required,
    complete,
    claimed,
    canClaim: complete && !claimed,
    rewards: { xp: 100, coins: 200, items: {} }
  };
}

function createServices({
  profile = { lastDailyDay: null, lastFortuneXpDay: null, dailyStreak: 0 },
  dailyMissions = [],
  weeklyMissions = [],
  rpgDailyMissions = [],
  swordStatus = { giftAvailable: true, battleRemaining: 10, battleStoneRemaining: 5 },
  claimDailyResult = null,
  claimMissionsResult = null,
  seasonOverview = null,
  seasonChallenges = null
} = {}) {
  const economy = {
    claimedDaily: false,
    async getRpgStatus() {
      return {
        profile,
        dailyMissions: rpgDailyMissions,
        cooldownRemainingMs: 0,
        currentArea: { label: '초록 숲' }
      };
    },
    async getSwordStatus() {
      return swordStatus;
    },
    async claimDaily() {
      this.claimedDaily = true;
      return claimDailyResult ?? {
        claimed: false,
        remainingMs: 60_000,
        profile
      };
    }
  };

  const community = {
    claimedMissions: false,
    async getOverview() {
      return {
        missions: {
          daily: dailyMissions,
          weekly: weeklyMissions
        }
      };
    },
    async claimMissions() {
      this.claimedMissions = true;
      return claimMissionsResult ?? {
        claimed: [],
        totalCoins: 0,
        totalXp: 0
      };
    }
  };

  const seasons = seasonOverview
    ? {
        async getOverview() {
          return seasonOverview;
        },
        async getChallenges() {
          return seasonChallenges;
        }
      }
    : null;

  return { economy, community, seasons };
}

function createTodayInteraction() {
  const replies = [];

  return {
    commandName: '오늘할일',
    guildId: 'guild-1',
    user: {
      id: 'user-1',
      username: '테스터'
    },
    replies,
    isButton() {
      return false;
    },
    isChatInputCommand() {
      return true;
    },
    inGuild() {
      return true;
    },
    async reply(payload) {
      replies.push(payload);
    }
  };
}

function createTodayButtonInteraction(customId, { userId = 'user-1' } = {}) {
  const replies = [];
  const updates = [];

  return {
    customId,
    guildId: 'guild-1',
    user: {
      id: userId,
      username: '테스터'
    },
    replies,
    updates,
    isButton() {
      return true;
    },
    isChatInputCommand() {
      return false;
    },
    inGuild() {
      return true;
    },
    async reply(payload) {
      replies.push(payload);
    },
    async update(payload) {
      updates.push(payload);
    }
  };
}

function getCustomIds(payload) {
  return (payload.components ?? [])
    .flatMap((row) => row.components ?? [])
    .map((component) => component.data?.custom_id ?? component.custom_id)
    .filter(Boolean);
}
