import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  getSeasonCommandPayloads,
  handleSeasonCommand
} from '../src/commands/seasons.js';
import { createSqliteStore } from '../src/storage/sqlite-store.js';
import {
  DEFAULT_SEASON_ID,
  SEASON_POINT_SOURCES,
  SeasonService
} from '../src/systems/seasons.js';

test('시즌 명령 payload는 정보, 랭킹, 보상, 과제 subcommand를 등록한다', () => {
  const [payload] = getSeasonCommandPayloads();

  assert.equal(payload.name, '시즌');
  assert.deepEqual(payload.options.map((option) => option.name), ['정보', '랭킹', '보상', '과제', '과제보상']);
});

test('시즌 서비스는 포인트, 일일 상한, 보상 수령, 랭킹을 저장한다', async () => {
  const fixture = await createFixture();

  try {
    const first = await fixture.seasons.awardPoints({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      source: SEASON_POINT_SOURCES.RPG_BATTLE_WIN,
      points: 120,
      now: 10_000
    });
    const capped = await fixture.seasons.awardPoints({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      source: SEASON_POINT_SOURCES.SWORD_BATTLE_WIN,
      points: 500,
      now: 10_000
    });
    await fixture.seasons.awardPoints({
      guildId: 'guild-1',
      userId: 'user-2',
      username: '검사',
      source: SEASON_POINT_SOURCES.SWORD_ENHANCE,
      points: 80,
      now: 10_000
    });

    const overview = await fixture.seasons.getOverview({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      now: 10_000
    });
    const claim = await fixture.seasons.claimRewards({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      now: 10_000
    });
    const leaderboard = await fixture.seasons.getLeaderboard({
      guildId: 'guild-1',
      limit: 5
    });

    assert.equal(first.awarded, true);
    assert.equal(first.points, 120);
    assert.equal(capped.points, 180, '하루 300점 상한까지만 추가 지급한다');
    assert.equal(capped.capped, true);
    assert.equal(overview.season.id, DEFAULT_SEASON_ID);
    assert.equal(overview.profile.totalPoints, 300);
    assert.equal(overview.rewards.filter((reward) => reward.claimable).length, 2);
    assert.deepEqual(claim.claimed.map((reward) => reward.id), ['season_spark', 'season_blaze']);
    assert.equal(leaderboard[0].username, '용사');
    assert.equal(leaderboard[0].points, 300);
  } finally {
    await fixture.cleanup();
  }
});

test('시즌 명령은 현재 시즌, 랭킹, 보상 수령을 응답한다', async () => {
  const fixture = await createFixture();

  try {
    await fixture.seasons.awardPoints({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      source: SEASON_POINT_SOURCES.RPG_BATTLE_WIN,
      points: 160
    });

    const info = createSeasonInteraction('정보');
    const ranking = createSeasonInteraction('랭킹');
    const reward = createSeasonInteraction('보상');

    assert.equal(await handleSeasonCommand(info, fixture.seasons), true);
    assert.equal(await handleSeasonCommand(ranking, fixture.seasons), true);
    assert.equal(await handleSeasonCommand(reward, fixture.seasons), true);

    assert.match(info.replies[0], /희희봇 시즌/);
    assert.match(info.replies[0], /160점/);
    assert.match(ranking.replies[0], /시즌 랭킹/);
    assert.match(reward.replies[0], /시즌 보상 수령/);
    assert.match(reward.replies[0], /시즌 불씨/);
  } finally {
    await fixture.cleanup();
  }
});

test('시즌 과제는 일일/주간 활동 진행도와 중복 없는 보상 수령을 저장한다', async () => {
  const fixture = await createFixture();
  const now = Date.UTC(2026, 4, 7, 12);

  try {
    await fixture.seasons.awardPoints({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      source: SEASON_POINT_SOURCES.RPG_BATTLE_WIN,
      points: 25,
      now
    });
    await fixture.seasons.awardPoints({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      source: SEASON_POINT_SOURCES.SWORD_ENHANCE,
      points: 15,
      now
    });

    const board = await fixture.seasons.getChallenges({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      now
    });
    const claim = await fixture.seasons.claimChallengeRewards({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      now
    });
    const secondClaim = await fixture.seasons.claimChallengeRewards({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      now
    });
    const after = await fixture.seasons.getChallenges({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      now
    });

    assert.deepEqual(
      board.daily.filter((challenge) => challenge.claimable).map((challenge) => challenge.id),
      ['daily_rpg_battle', 'daily_sword_enhance']
    );
    assert.equal(board.weekly.find((challenge) => challenge.id === 'weekly_any_activity').progress, 40);
    assert.deepEqual(claim.claimed.map((challenge) => challenge.id), ['daily_rpg_battle', 'daily_sword_enhance']);
    assert.equal(claim.totalRewardPoints, 50);
    assert.equal(claim.award.points, 50);
    assert.equal(secondClaim.claimed.length, 0);
    assert.equal(after.daily.find((challenge) => challenge.id === 'daily_rpg_battle').claimed, true);
    assert.equal(after.profile.totalPoints, 90);
  } finally {
    await fixture.cleanup();
  }
});

test('시즌 과제 명령은 진행도와 수령 결과를 응답한다', async () => {
  const fixture = await createFixture();

  try {
    await fixture.seasons.awardPoints({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      source: SEASON_POINT_SOURCES.RPG_BATTLE_WIN,
      points: 25
    });

    const board = createSeasonInteraction('과제');
    const claim = createSeasonInteraction('과제보상');

    assert.equal(await handleSeasonCommand(board, fixture.seasons), true);
    assert.equal(await handleSeasonCommand(claim, fixture.seasons), true);

    assert.match(board.replies[0], /시즌 과제/);
    assert.match(board.replies[0], /오늘의 첫 전투/);
    assert.match(board.replies[0], /25 \/ 25점/);
    assert.match(claim.replies[0], /시즌 과제 보상/);
    assert.match(claim.replies[0], /오늘의 첫 전투/);
  } finally {
    await fixture.cleanup();
  }
});

test('시즌 과제 보너스는 반복 활동 일일 상한에 막히지 않는다', async () => {
  const fixture = await createFixture();

  try {
    await fixture.seasons.awardPoints({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사',
      source: SEASON_POINT_SOURCES.RPG_BATTLE_WIN,
      points: 300
    });

    const claim = await fixture.seasons.claimChallengeRewards({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사'
    });
    const overview = await fixture.seasons.getOverview({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '용사'
    });

    assert.equal(claim.claimed.find((challenge) => challenge.id === 'daily_rpg_battle')?.rewardPoints, 30);
    assert.equal(claim.award.points >= 30, true);
    assert.equal(overview.profile.totalPoints > 300, true);
  } finally {
    await fixture.cleanup();
  }
});

test('시즌 과제는 낚시, 주식, 커뮤니티, 업적 출처를 진행도에 반영한다', async () => {
  const fixture = await createFixture();
  const now = Date.UTC(2026, 4, 11, 12);

  try {
    await fixture.seasons.awardPoints({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '시즌러',
      source: SEASON_POINT_SOURCES.FISHING_CATCH,
      points: 20,
      now
    });
    await fixture.seasons.awardPoints({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '시즌러',
      source: SEASON_POINT_SOURCES.STOCK_TRADE,
      points: 15,
      now
    });
    await fixture.seasons.awardPoints({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '시즌러',
      source: SEASON_POINT_SOURCES.ACHIEVEMENT_EARN,
      points: 10,
      now
    });

    const board = await fixture.seasons.getChallenges({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '시즌러',
      now
    });

    assert.equal(board.daily.find((challenge) => challenge.id === 'daily_fishing_catch').claimable, true);
    assert.equal(board.daily.find((challenge) => challenge.id === 'daily_stock_trade').claimable, true);
    assert.equal(board.daily.find((challenge) => challenge.id === 'daily_achievement_earn').claimable, true);
    assert.equal(board.weekly.find((challenge) => challenge.id === 'weekly_three_categories').progress, 3);
  } finally {
    await fixture.cleanup();
  }
});

async function createFixture() {
  const directory = await mkdtemp(join(tmpdir(), 'heeheebot-seasons-'));
  const store = createSqliteStore(join(directory, 'profiles.sqlite'));
  const seasons = new SeasonService(store);

  return {
    seasons,
    store,
    async cleanup() {
      store.close();
      await rm(directory, {
        recursive: true,
        force: true
      });
    }
  };
}

function createSeasonInteraction(subcommand) {
  const replies = [];

  return {
    guildId: 'guild-1',
    commandName: '시즌',
    user: {
      id: 'user-1',
      username: '용사'
    },
    replies,
    isChatInputCommand() {
      return true;
    },
    inGuild() {
      return true;
    },
    options: {
      getSubcommand() {
        return subcommand;
      }
    },
    async reply(payload) {
      replies.push(typeof payload === 'string' ? payload : payload.content);
    }
  };
}
