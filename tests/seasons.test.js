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

test('시즌 명령 payload는 정보, 랭킹, 보상 subcommand를 등록한다', () => {
  const [payload] = getSeasonCommandPayloads();

  assert.equal(payload.name, '시즌');
  assert.deepEqual(payload.options.map((option) => option.name), ['정보', '랭킹', '보상']);
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
