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
import {
  FishingService,
  getFishCount,
  getFishConfig,
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

test('낚시 명령 payload는 요청한 명령들을 등록한다', () => {
  const payloads = getFishingCommandPayloads();
  const names = payloads.map((command) => command.name);
  const teamCommand = payloads.find((command) => command.name === '물고기팀설정');
  const fishOption = teamCommand.options.find((option) => option.name === '물고기');

  assert.deepEqual(names, ['낚시', '낚시강화', '잠수', '물고기팀설정', '물고기배틀']);
  assert.equal(teamCommand.options.length, 2);
  assert.equal(fishOption.choices, undefined);
  assert.equal(fishOption.max_length, 50);
  assert.equal(payloads.find((command) => command.name === '물고기배틀').options.length, 2);
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

test('낚시는 결정적 난수로 물고기를 잡고 인벤토리와 포인트를 갱신한다', async () => {
  const fixture = await createFixture({ randomInt: sequenceRandom(1, 0, 20) });

  try {
    const result = await fixture.fishing.catchFish(createInput({ now: 10_000 }));

    assert.equal(result.fishId, 'crucian_carp');
    assert.equal(result.size, 20);
    assert.equal(result.pointsGained, 11);
    assert.equal(result.profile.inventory.crucian_carp, 1);
    assert.equal(result.profile.collection.crucian_carp, 10_000);
    assert.equal(result.profile.bestFish.crucian_carp.size, 20);
    assert.equal(result.profile.stats.totalCatches, 1);
    assert.equal(result.profile.stats.fishingPoints, 11);
  } finally {
    await fixture.cleanup();
  }
});

test('히든 물고기는 카탈로그에 존재하고 조건이 맞으면 낚일 수 있다', async () => {
  const fixture = await createFixture({ randomInt: maxRandom });

  try {
    await seedFishingProfile(fixture.store, {
      rodLevel: 20,
      fishingPoints: 1_000,
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
      fishingPoints: 100_000
    });

    const success = await fixture.fishing.enhanceRod(createInput({ now: 20_000 }));
    assert.equal(success.outcome, 'success');
    assert.equal(success.beforeLevel, 5);
    assert.equal(success.afterLevel, 6);

    const maintain = await fixture.fishing.enhanceRod(createInput({ now: 30_000 }));
    assert.equal(maintain.outcome, 'maintain');
    assert.equal(maintain.beforeLevel, 6);
    assert.equal(maintain.afterLevel, 6);

    const destroyed = await fixture.fishing.enhanceRod(createInput({ now: 40_000 }));
    assert.equal(destroyed.outcome, 'destroy');
    assert.equal(destroyed.beforeLevel, 6);
    assert.equal(destroyed.afterLevel, 1);
    assert.equal(destroyed.profile.rod.destroyedCount, 1);

    await seedFishingProfile(fixture.store, {
      rodLevel: 20,
      fishingPoints: 100_000
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
    assert.equal(claimed.profile.idle.startedAt, 0);
    assert.equal(claimed.profile.idle.totalMinutes, 720);
    assert.equal(claimed.profile.stats.totalCatches, 24);
    assert.ok(claimed.profile.stats.fishingPoints >= claimed.pointsGained);
  } finally {
    await fixture.cleanup();
  }
});

test('물고기팀설정은 보유 물고기만 팀에 넣고 물고기배틀은 전적을 기록한다', async () => {
  const fixture = await createFixture({ randomInt: minRandom });

  try {
    await seedFishingProfile(fixture.store, {
      rodLevel: 20,
      fishingPoints: 1000,
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
    const handled = await handleFishingCommand(interaction, fixture.fishing);
    const payload = interaction.lastReply;

    assert.equal(handled, true);
    assert.equal(typeof payload, 'object');
    assert.match(payload.embeds[0].data.title, /낚시 성공/);
    assert.match(payload.embeds[0].data.description, /붕어/);
    assert.equal(payload.embeds[0].data.image.url, 'attachment://icon.png');
    assert.deepEqual(payload.files, [getFishConfig('붕어').imagePath]);
    assert.equal(payload.content, undefined);
    assert.equal(payload.embeds[0].data.footer, undefined);
    assert.doesNotMatch(payload.embeds[0].data.description, /이미지 에셋|fish_/);
  } finally {
    await fixture.cleanup();
  }
});

test('낚시 카드 버튼은 같은 유저가 낚시와 강화 흐름을 이어가게 한다', async () => {
  const fixture = await createFixture({ randomInt: sequenceRandom(1, 0, 20, 1) });

  try {
    await seedFishingProfile(fixture.store, { fishingPoints: 100_000 });
    const interaction = createInteraction('낚시');
    await handleFishingCommand(interaction, fixture.fishing);

    const row = interaction.lastReply.components[0];
    assert.deepEqual(row.components.map((component) => component.data.label), ['낚시', '낚싯대 강화']);

    const updates = [];
    const replies = [];
    const fishButton = createFishingButtonInteraction({
      customId: 'fishing_quick:fish:user-1',
      updates,
      replies
    });
    await handleFishingCommand(fishButton, fixture.fishing);

    assert.match(updates[0].embeds[0].data.title, /낚시 성공/);
    assert.deepEqual(
      updates[0].components[0].components.map((component) => component.data.label),
      ['낚시', '낚싯대 강화']
    );

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
      fishingPoints: 100_000
    });

    const interaction = createInteraction('낚시강화');
    const handled = await handleFishingCommand(interaction, fixture.fishing);
    const payload = interaction.lastReply;

    assert.equal(handled, true);
    assert.match(payload.embeds[0].data.title, /낚싯대 강화/);
    assert.match(payload.embeds[0].data.description, /성공/);
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
  await store.update((data) => {
    data.guilds ??= {};
    data.guilds['guild-1'] ??= {};
    data.guilds['guild-1'].fishing ??= { users: {} };
    data.guilds['guild-1'].fishing.users['user-1'] = {
      userId: 'user-1',
      username: '테스터',
      rod: {
        level: overrides.rodLevel ?? 1,
        destroyedCount: 0,
        totalEnhancementAttempts: 0,
        lastEnhancedAt: 0
      },
      inventory: overrides.inventory ?? {},
      bestFish: overrides.bestFish ?? {},
      collection: {},
      idle: {
        startedAt: 0,
        lastClaimedAt: 0,
        totalMinutes: 0
      },
      team: [],
      battle: {
        wins: 0,
        losses: 0,
        draws: 0,
        lastBattleAt: 0
      },
      stats: {
        totalCatches: overrides.totalCatches ?? 0,
        fishingPoints: overrides.fishingPoints ?? 0
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
  const fishing = new FishingService(store, options);

  return {
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
