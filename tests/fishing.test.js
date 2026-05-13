import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  getFishingCommandPayloads,
  handleFishingCommand
} from '../src/commands/fishing.js';
import { createSqliteStore } from '../src/storage/sqlite-store.js';
import { EconomyService } from '../src/systems/economy.js';
import {
  FishingService,
  getFishCount,
  getFishConfig,
  getFishDiscoveryXp,
  getFishOptions,
  getMaxIdleRewardMs
} from '../src/systems/fishing.js';
import {
  formatFishingAssetLine,
  getFishingAssetBatch,
  getFishingAssetCount,
  getFishingAssetRarityCounts,
  getFishingRodAssetForLevel,
  getFishingRodAssets
} from '../src/systems/fishing-assets.js';
import { SEASON_POINT_SOURCES } from '../src/systems/seasons.js';

test('낚시 명령 payload는 요청한 명령들을 등록한다', () => {
  const payloads = getFishingCommandPayloads();
  const names = payloads.map((command) => command.name);
  const teamCommand = payloads.find((command) => command.name === '물고기팀설정');
  const fishOption = teamCommand.options.find((option) => option.name === '물고기');

  assert.deepEqual(names, ['낚시', '낚시도감', '낚시강화', '잠수', '물고기팀설정', '물고기배틀']);
  assert.equal(teamCommand.options.length, 2);
  assert.equal(fishOption.choices, undefined);
  assert.equal(fishOption.max_length, 50);
  assert.doesNotMatch(payloads.find((command) => command.name === '낚시').description, /포인트|점수/);
  assert.deepEqual(
    payloads.find((command) => command.name === '낚시도감').options[0].choices.map((choice) => choice.name),
    ['전체', '일반', '고급', '희귀', '영웅', '전설', '히든']
  );
  assert.match(payloads.find((command) => command.name === '낚시강화').description, /골드/);
  assert.doesNotMatch(payloads.find((command) => command.name === '낚시강화').description, /포인트/);
  assert.equal(payloads.find((command) => command.name === '물고기배틀').options.length, 1);
  assert.equal(payloads.some((command) => command.name === '낚시에셋'), false);
});

test('낚시 에셋 manifest는 agent-sprite-forge 프롬프트와 출력 경로를 전종 제공한다', () => {
  const firstBatch = getFishingAssetBatch({ limit: 3 });
  const hiddenBatch = getFishingAssetBatch({ rarity: 'hidden', limit: 20 });
  const counts = getFishingAssetRarityCounts();

  assert.equal(getFishingAssetCount(), getFishCount());
  assert.equal(getFishingAssetCount({ includeHidden: false }), getFishCount({ includeHidden: false }));
  assert.equal(hiddenBatch.length, 10);
  assert.equal(counts.hidden, 10);
  assert.ok(firstBatch.every((asset) => asset.skill === '$generate2dsprite'));
  assert.ok(firstBatch.every((asset) => asset.outputDir.startsWith('assets/fishing/fish/')));
  assert.ok(firstBatch.every((asset) => existsSync(asset.imagePath)));
  assert.ok(existsSync(getFishConfig('붕어').imagePath));
  assert.match(firstBatch[0].prompt, /#FF00FF/);
  assert.match(formatFishingAssetLine(firstBatch[0]), /fish_/);
});

test('낚싯대 이미지 에셋은 강화 단계별로 연결되어 있다', () => {
  const rodAssets = getFishingRodAssets();

  assert.equal(rodAssets.length, 20);
  assert.ok(rodAssets.every((asset) => asset.skill === '$generate2dsprite'));
  assert.ok(rodAssets.every((asset) => existsSync(asset.imagePath)));

  for (let level = 1; level <= 20; level += 1) {
    const asset = getFishingRodAssetForLevel(level);
    assert.equal(asset.id, `rod_${String(level).padStart(2, '0')}`);
    assert.equal(asset.level, level);
    assert.match(asset.imagePath, new RegExp(`level-${String(level).padStart(2, '0')}/icon\\.png$`));
  }

  assert.equal(new Set(rodAssets.map((asset) => asset.imagePath)).size, 20);
});

test('물고기 카탈로그는 100종 이상과 히든 물고기를 포함하고 선택지는 디스코드 제한 안에 둔다', () => {
  assert.ok(getFishCount() >= 100);
  assert.ok(getFishCount({ includeHidden: false }) >= 100);
  assert.equal(getFishCount() > getFishCount({ includeHidden: false }), true);
  assert.equal(getFishOptions().length, 25);
});

test('낚시는 신규 도감 등록 물고기에 발견 보너스 XP를 한 번만 지급한다', async () => {
  const fixture = await createFixture({ randomInt: sequenceRandom(1, 0, 20, 1, 0, 21) });

  try {
    const result = await fixture.fishing.catchFish(createInput({ now: 10_000 }));
    const discoveryXp = getFishDiscoveryXp('붕어');

    assert.equal(result.fishId, 'crucian_carp');
    assert.equal(result.size, 20);
    assert.equal(result.pointsGained, undefined);
    assert.equal(result.newDiscovery, true);
    assert.equal(result.discoveryXpGained, discoveryXp);
    assert.equal(result.discoveryXpReward.xpGained, discoveryXp);
    assert.equal(result.discoveryXpReward.profile.totalXp, discoveryXp);
    assert.equal(result.profile.inventory.crucian_carp, 1);
    assert.equal(result.profile.collection.crucian_carp, 10_000);
    assert.equal(result.profile.bestFish.crucian_carp.size, 20);
    assert.equal(result.profile.stats.totalCatches, 1);
    assert.equal(result.profile.stats.fishingPoints, undefined);

    const repeated = await fixture.fishing.catchFish(createInput({ now: 20_000 }));
    const economyProfile = await fixture.economy.getProfile('guild-1', 'user-1', '테스터');

    assert.equal(repeated.fishId, 'crucian_carp');
    assert.equal(repeated.newDiscovery, false);
    assert.equal(repeated.discoveryXpGained, 0);
    assert.equal(repeated.discoveryXpReward, undefined);
    assert.equal(repeated.profile.inventory.crucian_carp, 2);
    assert.equal(repeated.profile.collection.crucian_carp, 10_000);
    assert.equal(economyProfile.totalXp, discoveryXp);
  } finally {
    await fixture.cleanup();
  }
});

test('낚시 프로필은 사용자 기준으로 모든 서버에서 공유된다', async () => {
  const fixture = await createFixture({ randomInt: sequenceRandom(1, 0, 20) });

  try {
    const caught = await fixture.fishing.catchFish({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '공유어부',
      now: 10_000
    });
    const otherGuildProfile = await fixture.fishing.getProfile('guild-2', 'user-1', '공유어부');
    const summary = await fixture.economy.getAccountLinkSummary({
      guildId: 'guild-2',
      userId: 'user-1',
      username: '공유어부'
    });
    const data = await fixture.store.load();

    assert.equal(caught.fishId, 'crucian_carp');
    assert.equal(otherGuildProfile.inventory.crucian_carp, 1);
    assert.equal(otherGuildProfile.collection.crucian_carp, 10_000);
    assert.equal(otherGuildProfile.bestFish.crucian_carp.size, 20);
    assert.equal(otherGuildProfile.stats.totalCatches, 1);
    assert.equal(summary.required, false);
    assert.equal(data.fishing.users['user-1'].inventory.crucian_carp, 1);
  } finally {
    await fixture.cleanup();
  }
});

test('히든 물고기는 카탈로그에 존재하고 조건이 맞으면 낚일 수 있다', async () => {
  const fixture = await createFixture({ randomInt: maxRandom });

  try {
    await seedFishingProfile(fixture.store, {
      rodLevel: 20,
      totalCatches: 777
    });

    const result = await fixture.fishing.catchFish(createInput({ now: 12_345 }));

    assert.equal(result.rarity, 'hidden');
    assert.equal(result.fish.hidden, true);
    assert.match(result.fish.label, /해룡|피쉬|붕어|물고기|고래|잉어|도미|메기|블루핀/);
    assert.equal(result.profile.inventory[result.fishId], 1);
  } finally {
    await fixture.cleanup();
  }
});

test('낚싯대 강화는 성공, 유지, 파괴와 20강 상한을 처리한다', async () => {
  const fixture = await createFixture({ randomInt: sequenceRandom(1, 7000, 9900) });

  try {
    await seedFishingProfile(fixture.store, {
      rodLevel: 5,
      balance: 100_000
    });

    const success = await fixture.fishing.enhanceRod(createInput({ now: 20_000 }));
    assert.equal(success.outcome, 'success');
    assert.equal(success.beforeLevel, 5);
    assert.equal(success.afterLevel, 6);
    assert.equal(success.goldBalanceBefore, 100_000);
    assert.equal(success.goldBalanceAfter, 99_900);
    assert.equal(success.profile.stats.fishingPoints, undefined);

    const maintain = await fixture.fishing.enhanceRod(createInput({ now: 30_000 }));
    assert.equal(maintain.outcome, 'maintain');
    assert.equal(maintain.beforeLevel, 6);
    assert.equal(maintain.afterLevel, 6);
    assert.equal(maintain.goldBalanceAfter, 99_660);

    const destroyed = await fixture.fishing.enhanceRod(createInput({ now: 40_000 }));
    assert.equal(destroyed.outcome, 'destroy');
    assert.equal(destroyed.beforeLevel, 6);
    assert.equal(destroyed.afterLevel, 1);
    assert.equal(destroyed.profile.rod.destroyedCount, 1);
    assert.equal(destroyed.goldBalanceAfter, 99_420);

    await seedFishingProfile(fixture.store, {
      rodLevel: 20,
      balance: 100_000
    });
    const capped = await fixture.fishing.enhanceRod(createInput({ now: 50_000 }));
    assert.equal(capped.capped, true);
    assert.equal(capped.afterLevel, 20);
  } finally {
    await fixture.cleanup();
  }
});

test('잠수는 토글 방식으로 시작하고 최대 12시간 보상을 정산한다', async () => {
  const fixture = await createFixture({ randomInt: minRandom });

  try {
    const started = await fixture.fishing.toggleIdle(createInput({ now: 1_000 }));
    const claimed = await fixture.fishing.toggleIdle(createInput({ now: 24 * 60 * 60 * 1000 + 1_000 }));

    assert.equal(started.action, 'started');
    assert.equal(claimed.action, 'claimed');
    assert.equal(claimed.cappedElapsedMs, getMaxIdleRewardMs());
    assert.equal(claimed.minutes, 720);
    assert.equal(claimed.fishCount, 24);
    assert.equal(claimed.discoveries.length, 1);
    assert.equal(claimed.discoveryXpGained, getFishConfig('붕어').value);
    assert.equal(claimed.discoveryXpReward.xpGained, getFishConfig('붕어').value);
    assert.equal(claimed.profile.idle.startedAt, 0);
    assert.equal(claimed.profile.idle.totalMinutes, 720);
    assert.equal(claimed.profile.stats.totalCatches, 24);
    assert.equal(claimed.pointsGained, undefined);
    assert.equal(claimed.profile.stats.fishingPoints, undefined);
  } finally {
    await fixture.cleanup();
  }
});

test('물고기팀설정은 보유 물고기만 팀에 넣고 물고기배틀은 전적을 기록한다', async () => {
  const fixture = await createFixture({ randomInt: minRandom });

  try {
    await seedFishingProfile(fixture.store, {
      rodLevel: 20,
      inventory: {
        dragonfish: 1,
        kraken_spawn: 1,
        golden_carp: 1
      },
      bestFish: {
        dragonfish: { size: 300, caughtAt: 1 },
        kraken_spawn: { size: 220, caughtAt: 1 },
        golden_carp: { size: 90, caughtAt: 1 }
      }
    });
    await seedFishingProfile(fixture.store, {
      userId: 'user-2',
      username: '상대어부',
      rodLevel: 1,
      inventory: {
        carp: 1
      },
      bestFish: {
        carp: { size: 40, caughtAt: 1 }
      },
      team: [
        { slot: 1, fishId: 'carp' }
      ]
    });

    await assert.rejects(
      () => fixture.fishing.setTeamSlot(createInput({ slot: 1, fishId: '붕어' })),
      /보유하고 있지 않습니다/
    );

    const first = await fixture.fishing.setTeamSlot(createInput({ slot: 1, fishId: 'dragonfish' }));
    await fixture.fishing.setTeamSlot(createInput({ slot: 2, fishId: 'kraken_spawn' }));
    await fixture.fishing.setTeamSlot(createInput({ slot: 3, fishId: 'golden_carp' }));

    assert.equal(first.team[0].fish.label, '용왕의 물고기');

    const battle = await fixture.fishing.battleFishTeam(createInput({ difficulty: 'hard', now: 60_000 }));

    assert.equal(battle.winner, 'player');
    assert.equal(battle.opponentUserId, 'user-2');
    assert.equal(battle.opponentLabel, '상대어부 팀');
    assert.equal(battle.opponentProfile.userId, 'user-2');
    assert.equal(battle.profile.battle.wins, 1);
    assert.equal(battle.profile.battle.losses, 0);
    assert.ok(battle.log.length > 0);
  } finally {
    await fixture.cleanup();
  }
});

test('낚시 명령 핸들러는 /낚시 응답을 이미지 embed 카드로 반환한다', async () => {
  const fixture = await createFixture({ randomInt: sequenceRandom(1, 0, 20) });

  try {
    const interaction = createInteraction('낚시');
    const seasons = createSeasonSpy();
    const handled = await handleFishingCommand(interaction, fixture.fishing, { seasons });
    const payload = interaction.lastReply;

    assert.equal(handled, true);
    assert.equal(typeof payload, 'object');
    assert.match(payload.embeds[0].data.title, /낚시 성공/);
    assert.doesNotMatch(payload.embeds[0].data.title, /<@/);
    assert.match(payload.embeds[0].data.description, /<@user-1>/);
    assert.match(payload.embeds[0].data.description, /붕어/);
    assert.match(payload.embeds[0].data.description, /새 물고기 발견/);
    assert.match(payload.embeds[0].data.description, /\+8 XP/);
    assert.equal(payload.embeds[0].data.image.url, 'attachment://icon.png');
    assert.deepEqual(payload.files, [getFishConfig('붕어').imagePath]);
    assert.equal(payload.content, undefined);
    assert.equal(payload.embeds[0].data.footer, undefined);
    assert.doesNotMatch(payload.embeds[0].data.description, /이미지 에셋|fish_/);
    assert.deepEqual(seasons.awards.map(({ source, points }) => ({ source, points })), [
      { source: SEASON_POINT_SOURCES.FISHING_CATCH, points: 20 }
    ]);
    assert.match(payload.embeds[0].data.description, /시즌: 테스트 시즌/);
  } finally {
    await fixture.cleanup();
  }
});


test('낚시 시즌 포인트 지급 실패는 기록하고 기본 낚시 응답은 유지한다', async () => {
  const fixture = await createFixture({ randomInt: sequenceRandom(1, 0, 20) });

  try {
    const interaction = createInteraction('낚시');
    const logs = [];
    const logger = { debug: (...args) => logs.push(args) };
    const seasons = createRejectingSeasonSpy();

    const handled = await handleFishingCommand(interaction, fixture.fishing, { seasons, logger });

    assert.equal(handled, true);
    assert.match(interaction.lastReply.embeds[0].data.title, /낚시 성공/);
    assert.match(interaction.lastReply.embeds[0].data.description, /붕어/);
    assert.doesNotMatch(interaction.lastReply.embeds[0].data.description, /시즌:/);
    assert.equal(logs.length, 1);
    assert.match(logs[0][0], /Failed to award fishing season points/);
  } finally {
    await fixture.cleanup();
  }
});

test('낚시도감은 수집률, 희귀도 진행도, 최고 크기를 embed 카드로 보여준다', async () => {
  const fixture = await createFixture();

  try {
    await seedFishingProfile(fixture.store, {
      inventory: {
        crucian_carp: 2,
        dragonfish: 1
      },
      bestFish: {
        crucian_carp: { size: 31, caughtAt: 10_000 },
        dragonfish: { size: 300, caughtAt: 20_000 }
      },
      collection: {
        crucian_carp: 10_000,
        dragonfish: 20_000
      },
      totalCatches: 3
    });

    const interaction = createInteraction('낚시도감', { 희귀도: 'legendary' });
    const handled = await handleFishingCommand(interaction, fixture.fishing);
    const payload = interaction.lastReply;
    const description = payload.embeds[0].data.description;

    assert.equal(handled, true);
    assert.match(payload.embeds[0].data.title, /낚시 도감/);
    assert.match(description, new RegExp(`진행도: \\*\\*2/${getFishCount({ includeHidden: false })}종`));
    assert.match(description, /그래프: `█/);
    assert.match(description, /전설 1\/11/);
    assert.match(description, /현재 보기: \*\*전설\*\* · 페이지 \*\*1\/1\*\*/);
    assert.match(description, /\* 용왕의 물고기 전설 최고 300cm/);
    assert.match(description, /\* \?\?\? 전설 \?\?\?/);
    assert.doesNotMatch(description, /dragonfish|fish_dragonfish/);
    assert.deepEqual(
      payload.components[0].components.map((component) => component.data.label),
      ['낚시', '낚싯대 강화', '도감']
    );
  } finally {
    await fixture.cleanup();
  }
});

test('낚시도감은 미발견 물고기 이름을 숨기고 히든 물고기는 잡기 전까지 제외한다', async () => {
  const fixture = await createFixture();

  try {
    await seedFishingProfile(fixture.store, {
      inventory: {
        mackerel: 1
      },
      bestFish: {
        mackerel: { size: 44, caughtAt: 10_000 }
      },
      collection: {
        mackerel: 10_000
      },
      totalCatches: 1
    });

    const interaction = createInteraction('낚시도감', { 희귀도: 'common' });
    await handleFishingCommand(interaction, fixture.fishing);
    const description = interaction.lastReply.embeds[0].data.description;

    assert.match(description, /\* 고등어 일반 최고 44cm/);
    assert.match(description, /\* \?\?\? 일반 \?\?\?/);
    assert.doesNotMatch(description, /잉어 일반 \?\?\?|붕어 일반 \?\?\?/);
    assert.doesNotMatch(description, /히든 0\/10|\?\?\? 히든 \?\?\?/);

    await seedFishingProfile(fixture.store, {
      inventory: {
        hidden_fish_1: 1
      },
      bestFish: {
        hidden_fish_1: { size: 404, caughtAt: 20_000 }
      },
      collection: {
        hidden_fish_1: 20_000
      },
      totalCatches: 1
    });

    const hiddenInteraction = createInteraction('낚시도감', { 희귀도: 'hidden' });
    await handleFishingCommand(hiddenInteraction, fixture.fishing);
    const hiddenDescription = hiddenInteraction.lastReply.embeds[0].data.description;

    assert.match(hiddenDescription, /히든 1\/1/);
    assert.match(hiddenDescription, /\* 안개고래 히든 최고 404cm/);
    assert.doesNotMatch(hiddenDescription, /\* \?\?\? 히든 \?\?\?/);
  } finally {
    await fixture.cleanup();
  }
});

test('낚시도감은 페이지 버튼으로 긴 목록을 넘긴다', async () => {
  const fixture = await createFixture();

  try {
    await seedFishingProfile(fixture.store);

    const interaction = createInteraction('낚시도감');
    await handleFishingCommand(interaction, fixture.fishing);
    const payload = interaction.lastReply;
    const pageRow = payload.components[1];

    assert.match(payload.embeds[0].data.description, /현재 보기: \*\*전체\*\* · 페이지 \*\*1\/12\*\*/);
    assert.deepEqual(
      pageRow.components.map((component) => component.data.label),
      ['이전', '다음']
    );
    assert.equal(pageRow.components[0].data.disabled, true);
    assert.equal(pageRow.components[1].data.disabled, false);

    const updates = [];
    const replies = [];
    const nextButton = createFishingButtonInteraction({
      customId: pageRow.components[1].data.custom_id,
      updates,
      replies
    });
    const handled = await handleFishingCommand(nextButton, fixture.fishing);

    assert.equal(handled, true);
    assert.equal(replies.length, 0);
    assert.equal(updates.length, 1);
    assert.match(updates[0].embeds[0].data.description, /현재 보기: \*\*전체\*\* · 페이지 \*\*2\/12\*\*/);
    assert.equal(updates[0].components[1].components[0].data.disabled, false);
  } finally {
    await fixture.cleanup();
  }
});

test('물고기배틀 명령은 상대 유저를 실제 멘션으로 표시하고 허용 멘션을 제한한다', async () => {
  const fixture = await createFixture({ randomInt: minRandom });

  try {
    await seedFishingProfile(fixture.store, {
      inventory: { dragonfish: 1 },
      bestFish: { dragonfish: { size: 300, caughtAt: 1 } },
      team: [{ slot: 1, fishId: 'dragonfish' }]
    });
    await seedFishingProfile(fixture.store, {
      userId: 'user-2',
      username: '상대어부',
      inventory: { carp: 1 },
      bestFish: { carp: { size: 40, caughtAt: 1 } },
      team: [{ slot: 1, fishId: 'carp' }]
    });

    const interaction = createInteraction('물고기배틀', {
      상대: {
        id: 'user-2',
        username: '상대어부',
        bot: false
      }
    });
    const handled = await handleFishingCommand(interaction, fixture.fishing);

    assert.equal(handled, true);
    assert.match(interaction.lastReply.content, /<@user-1>/);
    assert.match(interaction.lastReply.content, /<@user-2>/);
    assert.doesNotMatch(interaction.lastReply.content, /\\[object Object\\]/);
    assert.deepEqual(interaction.lastReply.allowedMentions, {
      parse: [],
      users: ['user-1', 'user-2']
    });
    assert.doesNotMatch(interaction.lastReply.content, /포인트|점수/);
  } finally {
    await fixture.cleanup();
  }
});

test('랜덤 물고기배틀은 다른 서버에 있는 같은 전역 낚시 기록도 상대로 찾는다', async () => {
  const fixture = await createFixture({ randomInt: minRandom });

  try {
    await seedFishingProfile(fixture.store, {
      guildId: 'guild-1',
      userId: 'user-1',
      username: '테스터',
      inventory: { dragonfish: 1 },
      bestFish: { dragonfish: { size: 300, caughtAt: 1 } },
      team: [{ slot: 1, fishId: 'dragonfish' }]
    });
    await seedFishingProfile(fixture.store, {
      guildId: 'guild-2',
      userId: 'user-2',
      username: '상대어부',
      inventory: { carp: 1 },
      bestFish: { carp: { size: 40, caughtAt: 1 } },
      team: [{ slot: 1, fishId: 'carp' }]
    });

    await fixture.fishing.getProfile('guild-2', 'user-2', '상대어부');
    const result = await fixture.fishing.battleFishTeam(createInput({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '테스터',
      now: 50_000
    }));
    const data = await fixture.store.load();

    assert.equal(result.opponentUserId, 'user-2');
    assert.equal(result.opponentProfile.username, '상대어부');
    assert.equal(data.fishing.users['user-2'].team[0].fishId, 'carp');
    assert.equal(data.guilds['guild-2'].fishing?.users?.['user-2'], undefined);
  } finally {
    await fixture.cleanup();
  }
});

test('낚시 카드 버튼은 같은 유저가 낚시와 강화 흐름을 이어가게 한다', async () => {
  const fixture = await createFixture({ randomInt: sequenceRandom(1, 0, 20, 1) });

  try {
    await seedFishingProfile(fixture.store);
    const interaction = createInteraction('낚시');
    await handleFishingCommand(interaction, fixture.fishing);

    const row = interaction.lastReply.components[0];
    assert.deepEqual(row.components.map((component) => component.data.label), ['낚시', '낚싯대 강화', '도감']);

    const updates = [];
    const replies = [];
    const fishButton = createFishingButtonInteraction({
      customId: 'fishing_quick:fish:user-1',
      updates,
      replies
    });
    const seasons = createSeasonSpy();
    await handleFishingCommand(fishButton, fixture.fishing, { seasons });

    assert.equal(updates.length, 0);
    assert.match(replies[0].embeds[0].data.title, /낚시 성공/);
    assert.deepEqual(seasons.awards.map(({ source, points }) => ({ source, points })), [
      { source: SEASON_POINT_SOURCES.FISHING_CATCH, points: 20 }
    ]);
    assert.match(replies[0].embeds[0].data.description, /시즌: 테스트 시즌/);
    assert.doesNotMatch(replies[0].embeds[0].data.description, /이미지 에셋|fish_/);
    assert.deepEqual(
      replies[0].components[0].components.map((component) => component.data.label),
      ['낚시', '낚싯대 강화', '도감']
    );

    const codexButton = createFishingButtonInteraction({
      customId: 'fishing_quick:codex:user-1',
      updates,
      replies
    });
    await handleFishingCommand(codexButton, fixture.fishing);

    assert.equal(updates.length, 0);
    assert.match(replies[1].embeds[0].data.title, /낚시 도감/);
    assert.match(replies[1].embeds[0].data.description, /진행도/);

    const blocked = createFishingButtonInteraction({
      customId: 'fishing_quick:enhance:user-1',
      userId: 'other-user',
      updates: [],
      replies: []
    });
    await handleFishingCommand(blocked, fixture.fishing);
    assert.match(blocked.replies[0].content, /명령어를 실행한 유저만/);
  } finally {
    await fixture.cleanup();
  }
});

test('낚시강화 응답은 낚싯대 이미지를 embed 카드로 첨부하고 에셋 id를 노출하지 않는다', async () => {
  const fixture = await createFixture({ randomInt: sequenceRandom(1) });

  try {
    await seedFishingProfile(fixture.store, {
      rodLevel: 4,
      balance: 100_000
    });

    const interaction = createInteraction('낚시강화');
    const handled = await handleFishingCommand(interaction, fixture.fishing);
    const payload = interaction.lastReply;

    assert.equal(handled, true);
    assert.match(payload.embeds[0].data.title, /낚싯대 강화/);
    assert.match(payload.embeds[0].data.description, /성공/);
    assert.match(payload.embeds[0].data.description, /초급 청동 릴 낚싯대/);
    assert.match(payload.embeds[0].data.description, /사용 골드: \*\*80골드\*\*/);
    assert.match(payload.embeds[0].data.description, /남은 골드: \*\*99,920골드\*\*/);
    assert.doesNotMatch(payload.embeds[0].data.description, /포인트|점수|사용 포인트|남은 포인트/);
    assert.doesNotMatch(payload.embeds[0].data.description, /rod_|이미지 에셋/);
    assert.equal(payload.embeds[0].data.image.url, 'attachment://icon.png');
    assert.equal(payload.embeds[0].data.footer, undefined);
    assert.deepEqual(payload.files, [getFishingRodAssetForLevel(5).imagePath]);
  } finally {
    await fixture.cleanup();
  }
});

test('낚시에셋 명령은 사용자 명령으로 처리하지 않는다', async () => {
  const interaction = createInteraction('낚시에셋');

  const handled = await handleFishingCommand(interaction, {});

  assert.equal(handled, false);
  assert.equal(interaction.replies.length, 0);
});

function createInput(overrides = {}) {
  return {
    guildId: 'guild-1',
    userId: 'user-1',
    username: '테스터',
    ...overrides
  };
}

function createInteraction(commandName, options = {}) {
  return {
    commandName,
    guildId: 'guild-1',
    user: {
      id: 'user-1',
      username: '테스터'
    },
	    replies: [],
	    lastReply: null,
    isChatInputCommand() {
      return true;
    },
    inGuild() {
      return true;
    },
    options: {
      getInteger(name) {
        return options[name] ?? null;
      },
      getString(name) {
        return options[name] ?? null;
      },
      getUser(name) {
        return options[name] ?? null;
      }
    },
	    async reply(message) {
	      this.lastReply = message;
	      this.replies.push(typeof message === 'string' ? message : message.content);
	    }
	  };
}

function createFishingButtonInteraction({
  customId,
  userId = 'user-1',
  username = '테스터',
  updates = [],
  replies = []
}) {
  return {
    customId,
    guildId: 'guild-1',
    user: { id: userId, username },
    updates,
    replies,
    isChatInputCommand() {
      return false;
    },
    isButton() {
      return true;
    },
    inGuild() {
      return true;
    },
    async update(payload) {
      updates.push(payload);
    },
    async reply(payload) {
      replies.push(payload);
    }
  };
}


async function seedFishingProfile(store, overrides = {}) {
  const userId = overrides.userId ?? 'user-1';
  const guildId = overrides.guildId ?? 'guild-1';
  await store.update((data) => {
    data.guilds ??= {};
    data.guilds[guildId] ??= {};
    data.guilds[guildId].users ??= {};
    data.guilds[guildId].users[userId] = {
      userId,
      username: overrides.username ?? '테스터',
      level: 1,
      xp: 0,
      totalXp: 0,
      balance: overrides.balance ?? 0,
      wallets: {},
      createdAt: 1
    };
    data.guilds[guildId].fishing ??= { users: {} };
    data.guilds[guildId].fishing.users[userId] = {
      userId,
      username: overrides.username ?? '테스터',
      rod: {
        level: overrides.rodLevel ?? 1,
        destroyedCount: 0,
        totalEnhancementAttempts: 0,
        lastEnhancedAt: 0
      },
      inventory: overrides.inventory ?? {},
      bestFish: overrides.bestFish ?? {},
      collection: overrides.collection ?? {},
      idle: {
        startedAt: 0,
        lastClaimedAt: 0,
        totalMinutes: 0
      },
      team: overrides.team ?? [],
      battle: {
        wins: 0,
        losses: 0,
        draws: 0,
        lastBattleAt: 0
      },
      stats: {
        totalCatches: overrides.totalCatches ?? 0
      },
      createdAt: 1
    };
  });
}

function sequenceRandom(...values) {
  let index = 0;
  return (min, max) => {
    if (index >= values.length) return min;
    const value = values[index++];
    assert.ok(
      value >= min && value <= max,
      `random value ${value} outside range ${min}-${max}`
    );
    return value;
  };
}

function minRandom(min) {
  return min;
}

function maxRandom(_min, max) {
  return max;
}

async function createFixture(options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'heeheebot-fishing-'));
  const store = createSqliteStore(join(directory, 'profiles.sqlite'));
  const economy = options.economy ?? new EconomyService(store);
  const fishing = new FishingService(store, {
    ...options,
    economy
  });

  return {
    economy,
    fishing,
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

function createSeasonSpy() {
  const awards = [];
  return {
    awards,
    async awardPoints(input) {
      awards.push(input);
      return {
        awarded: true,
        points: input.points,
        requestedPoints: input.points,
        totalPoints: input.points,
        sourceLabel: '테스트 시즌',
        newlyClaimableRewards: []
      };
    }
  };
}

function createRejectingSeasonSpy() {
  return {
    async awardPoints() {
      throw new Error('season ledger unavailable');
    }
  };
}
