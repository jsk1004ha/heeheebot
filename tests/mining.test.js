import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  getMiningCommandPayloads,
  handleMiningCommand
} from '../src/commands/mining.js';
import { createSqliteStore } from '../src/storage/sqlite-store.js';
import { EconomyService } from '../src/systems/economy.js';
import {
  MiningService,
  getActiveMineCooldownMs,
  getMaxPickaxeLevel,
  getOreConfig,
  getOreCount,
  getOreDiscoveryXp,
  getOreOptions
} from '../src/systems/mining.js';
import { getMiningPickaxeAssetForLevel } from '../src/systems/mining-assets.js';
import { SEASON_POINT_SOURCES } from '../src/systems/seasons.js';

test('광산 명령 payload는 버튼형 채굴/판매/시세 UI 진입점을 한 명령어로 등록한다', () => {
  const [payload] = getMiningCommandPayloads();
  const actionOption = payload.options.find((option) => option.name === '행동');
  const oreOption = payload.options.find((option) => option.name === '광석');

  assert.equal(payload.name, '광산');
  assert.match(payload.description, /채굴|판매|시세/);
  assert.deepEqual(actionOption.choices.map((choice) => choice.value), [
    'mine',
    'codex',
    'enhance',
    'idle',
    'sell',
    'market'
  ]);
  assert.equal(oreOption.max_length, 50);
});

test('광산 카탈로그는 50종 광석, 100강 곡괭이, 초단위 채굴 간격을 제공한다', () => {
  assert.equal(getOreCount(), 50);
  assert.equal(getOreCount({ includeHidden: false }), 45);
  assert.equal(getOreOptions().length, 25);
  assert.equal(getMaxPickaxeLevel(), 100);
  assert.equal(getActiveMineCooldownMs(), 3_000);
  assert.equal(getOreConfig('구리광석').label, '구리광석');
  assert.equal(getOreConfig('copper_ore').label, '구리광석');
  assert.equal(getOreConfig('stone_fragment').value, 10);
  assert.equal(getOreConfig('stone_fragment').priceMin, 10);
  assert.equal(getOreConfig('stone_fragment').priceMax, 50);
  assert.equal(getOreConfig('hidden_dawn_core').value, 5_000_000);
  assert.equal(getOreConfig('hidden_dawn_core').priceMax, 5_000_000);
});

test('채굴은 초단위 쿨다운을 적용하고 계속 캘수록 연속 보너스를 올린다', async () => {
  const fixture = await createFixture({ randomInt: minRandom });

  try {
    const first = await fixture.mining.mineOre(createInput({ now: 10_000 }));
    const cooldown = await fixture.mining.mineOre(createInput({ now: 11_000 }));

    assert.equal(first.cooldown, false);
    assert.equal(first.oreId, 'stone_fragment');
    assert.equal(first.profile.focus.streak, 1);
    assert.equal(cooldown.cooldown, true);
    assert.equal(cooldown.remainingMs, 2_000);
    assert.equal(cooldown.profile.inventory.stone_fragment, first.quantity);

    let latest = first;
    for (let index = 1; index < 10; index += 1) {
      latest = await fixture.mining.mineOre(createInput({ now: 10_000 + index * getActiveMineCooldownMs() }));
    }

    assert.equal(latest.cooldown, false);
    assert.equal(latest.profile.focus.streak, 10);
    assert.equal(latest.focusBonusBps, 500);
    assert.equal(latest.profile.focus.bestStreak, 10);
    assert.ok(latest.profile.stats.totalOrePieces >= 10);
  } finally {
    await fixture.cleanup();
  }
});

test('광석 첫 발견은 도감 등록과 XP 보상을 한 번만 지급한다', async () => {
  const fixture = await createFixture({ randomInt: minRandom });

  try {
    const first = await fixture.mining.mineOre(createInput({ now: 20_000 }));
    const repeated = await fixture.mining.mineOre(createInput({ now: 23_000 }));
    const economyProfile = await fixture.economy.getProfile('guild-1', 'user-1', '테스터');
    const discoveryXp = getOreDiscoveryXp('stone_fragment');

    assert.equal(first.newDiscovery, true);
    assert.equal(first.discoveryXpGained, discoveryXp);
    assert.equal(first.discoveryXpReward.xpGained, discoveryXp);
    assert.equal(repeated.newDiscovery, false);
    assert.equal(repeated.discoveryXpGained, 0);
    assert.equal(repeated.discoveryXpReward, undefined);
    assert.equal(economyProfile.totalXp, discoveryXp);
  } finally {
    await fixture.cleanup();
  }
});

test('광석 시세는 시장 tick마다 주식처럼 랜덤 변동 이력을 남긴다', async () => {
  const fixture = await createFixture({ randomInt: maxRandom, marketTickMs: 1_000 });

  try {
    const initial = await fixture.mining.getMarket({ guildId: 'guild-1', now: 1_000, includeHidden: true });
    const changed = await fixture.mining.getMarket({ guildId: 'guild-1', now: 2_000, includeHidden: true });

    assert.equal(initial.tickIndex, 0);
    assert.equal(changed.tickIndex, 1);
    assert.ok(changed.ores.some((quote) => quote.changeBps > 0));
    assert.ok(changed.ores.some((quote) => quote.history.length >= 2));
  } finally {
    await fixture.cleanup();
  }
});


test('히든 광석은 조건을 더 늦게 열고 낮은 확률 대신 대형 잭팟으로 지급한다', async () => {
  const lockedFixture = await createFixture({ randomInt: maxRandom });
  const unlockedFixture = await createFixture({ randomInt: maxRandom });

  try {
    await seedMiningProfile(lockedFixture.store, {
      pickaxeLevel: 79,
      totalMines: 500,
      streak: 49,
      lastMinedAt: 97_000
    });
    const locked = await lockedFixture.mining.mineOre(createInput({ now: 100_000, ignoreCooldown: true }));

    await seedMiningProfile(unlockedFixture.store, {
      pickaxeLevel: 80,
      totalMines: 500,
      streak: 49,
      lastMinedAt: 97_000
    });
    const unlocked = await unlockedFixture.mining.mineOre(createInput({ now: 100_000, ignoreCooldown: true }));

    assert.notEqual(locked.rarity, 'hidden');
    assert.equal(unlocked.rarity, 'hidden');
    assert.equal(unlocked.oreId, 'hidden_dawn_core');
    assert.equal(unlocked.quote.price, 5_000_000);
    assert.equal(unlocked.estimatedValue, 15_000_000);
  } finally {
    await lockedFixture.cleanup();
    await unlockedFixture.cleanup();
  }
});

test('광석 판매는 UI 판매용 preview를 만들고 주식 파산 부채 자동상환과 연결된다', async () => {
  const fixture = await createFixture({ randomInt: minRandom });

  try {
    await seedMiningProfile(fixture.store, {
      inventory: {
        hidden_dawn_core: 2,
        stone_fragment: 3
      },
      stockDebt: 5_000_000
    });

    const preview = await fixture.mining.getSellPreview(createInput({ limit: 5, now: 50_000 }));
    const result = await fixture.mining.sellOre(createInput({ oreId: 'hidden_dawn_core', quantity: 'all', now: 50_000 }));
    const data = await fixture.store.load();

    assert.equal(preview.totalQuantity, 5);
    assert.equal(preview.entries[0].oreId, 'hidden_dawn_core');
    assert.equal(result.totalQuantity, 2);
    assert.equal(result.gross, 10_000_000);
    assert.equal(result.receipt.repayment, 2_500_000);
    assert.equal(result.receipt.net, 7_500_000);
    assert.equal(result.receipt.bankruptcy.debt, 2_500_000);
    assert.equal(result.receipt.balance, 7_500_000);
    assert.equal(data.mining.users['user-1'].inventory.hidden_dawn_core, undefined);
    assert.equal(data.accounts.users['user-1'].stockBankruptcy.debt, 2_500_000);
  } finally {
    await fixture.cleanup();
  }
});

test('광산 명령은 채굴 결과를 버튼 UI와 에셋 첨부로 보여주고 시즌 포인트를 지급한다', async () => {
  const fixture = await createFixture({ randomInt: minRandom });
  const seasons = createSeasonSpy();
  const interaction = createInteraction('광산');

  try {
    const handled = await handleMiningCommand(interaction, fixture.mining, { seasons });
    const payload = interaction.replies[0];
    const buttonLabels = payload.components.flatMap((row) => row.components.map((component) => component.data.label));

    assert.equal(handled, true);
    assert.match(payload.embeds[0].data.title, /광산 채굴 성공/);
    assert.match(payload.embeds[0].data.description, /연속 채굴/);
    assert.equal(payload.embeds[0].data.image.url, 'attachment://icon.png');
    assert.deepEqual(payload.files, [getOreConfig('stone_fragment').imagePath]);
    assert.ok(existsSync(payload.files[0]));
    assert.deepEqual(buttonLabels, ['채굴', '판매', '곡괭이 강화', '도감', '시세']);
    assert.equal(seasons.awards[0].source, SEASON_POINT_SOURCES.MINING_MINE);
    assert.equal(seasons.awards[0].points, 10);
  } finally {
    await fixture.cleanup();
  }
});

test('광산 버튼 판매소는 전부 판매와 광석별 판매 버튼을 제공한다', async () => {
  const fixture = await createFixture({ randomInt: minRandom });
  const interaction = createMiningButtonInteraction({ customId: 'mining_quick:sell:user-1' });

  try {
    await seedMiningProfile(fixture.store, {
      inventory: {
        stone_fragment: 2,
        copper_ore: 1
      }
    });

    const handled = await handleMiningCommand(interaction, fixture.mining);
    const payload = interaction.replies[0];
    const rows = payload.components.map((row) => row.components.map((component) => component.data));

    assert.equal(handled, true);
    assert.match(payload.embeds[0].data.title, /광석 판매소/);
    assert.match(payload.embeds[0].data.description, /주식 파산 부채/);
    assert.ok(rows[1].some((button) => button.label === '전부 판매'));
    assert.ok(rows[1].some((button) => String(button.custom_id).startsWith('mining_sell:ore:user-1:')));
  } finally {
    await fixture.cleanup();
  }
});

test('곡괭이 강화 명령은 100강 에셋과 골드 비용을 연결한다', async () => {
  const fixture = await createFixture({ randomInt: sequenceRandom(1) });
  const interaction = createInteraction('광산', { stringOptions: { 행동: 'enhance' } });

  try {
    await seedMiningProfile(fixture.store, { balance: 100_000, pickaxeLevel: 99 });

    const handled = await handleMiningCommand(interaction, fixture.mining);
    const payload = interaction.replies[0];

    assert.equal(handled, true);
    assert.match(payload.embeds[0].data.title, /곡괭이 강화/);
    assert.match(payload.embeds[0].data.description, /\+100/);
    assert.equal(payload.embeds[0].data.image.url, 'attachment://icon.png');
    assert.deepEqual(payload.files, [getMiningPickaxeAssetForLevel(100).imagePath]);
  } finally {
    await fixture.cleanup();
  }
});

function createInput(overrides = {}) {
  return {
    guildId: 'guild-1',
    userId: 'user-1',
    username: '테스터',
    ...overrides
  };
}

function createInteraction(commandName, { stringOptions = {}, integerOptions = {} } = {}) {
  return {
    commandName,
    guildId: 'guild-1',
    user: { id: 'user-1', username: '테스터' },
    replies: [],
    isChatInputCommand: () => true,
    isButton: () => false,
    inGuild: () => true,
    options: {
      getString: (name) => stringOptions[name] ?? null,
      getInteger: (name) => integerOptions[name] ?? null
    },
    async reply(payload) {
      this.replies.push(payload);
    }
  };
}

function createMiningButtonInteraction({ customId, userId = 'user-1', username = '테스터' }) {
  return {
    customId,
    guildId: 'guild-1',
    user: { id: userId, username },
    replies: [],
    updates: [],
    isChatInputCommand: () => false,
    isButton: () => true,
    inGuild: () => true,
    async reply(payload) {
      this.replies.push(payload);
    },
    async update(payload) {
      this.updates.push(payload);
    }
  };
}

async function seedMiningProfile(store, overrides = {}) {
  const userId = overrides.userId ?? 'user-1';
  const guildId = overrides.guildId ?? 'guild-1';
  const username = overrides.username ?? '테스터';
  await store.update((data) => {
    data.accounts ??= { users: {}, guilds: {} };
    data.accounts.users ??= {};
    data.accounts.guilds ??= {};
    data.accounts.guilds[guildId] ??= { users: {} };
    data.accounts.guilds[guildId].users[userId] = {
      userId,
      username,
      linkedAt: 1,
      lastSeenAt: 1
    };
    data.accounts.users[userId] = {
      userId,
      username,
      level: 1,
      xp: 0,
      totalXp: 0,
      balance: overrides.balance ?? 0,
      wallets: {},
      stockBankruptcy: {
        debt: overrides.stockDebt ?? 0,
        paid: 0,
        count: overrides.stockDebt ? 1 : 0,
        lastAt: overrides.stockDebt ? 1 : 0
      },
      createdAt: 1
    };
    data.mining ??= { users: {} };
    data.mining.users ??= {};
    data.mining.users[userId] = {
      userId,
      username,
      pickaxe: {
        level: overrides.pickaxeLevel ?? 1,
        highestLevel: overrides.pickaxeLevel ?? 1,
        destroyedCount: 0,
        totalEnhancementAttempts: 0,
        lastEnhancedAt: 0
      },
      inventory: overrides.inventory ?? {},
      bestOre: overrides.bestOre ?? {},
      collection: overrides.collection ?? {},
      idle: { startedAt: 0, lastClaimedAt: 0, totalMinutes: 0 },
      focus: {
        streak: overrides.streak ?? 0,
        bestStreak: overrides.bestStreak ?? overrides.streak ?? 0,
        lastMinedAt: overrides.lastMinedAt ?? 0
      },
      stats: {
        totalMines: overrides.totalMines ?? 0,
        totalOrePieces: overrides.totalOrePieces ?? 0,
        totalSold: 0,
        totalSalesValue: 0
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
    assert.ok(value >= min && value <= max, `random value ${value} outside range ${min}-${max}`);
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
  const directory = await mkdtemp(join(tmpdir(), 'heeheebot-mining-'));
  const store = createSqliteStore(join(directory, 'profiles.sqlite'));
  const economy = options.economy ?? new EconomyService(store);
  const mining = new MiningService(store, {
    ...options,
    economy
  });

  return {
    economy,
    mining,
    store,
    async cleanup() {
      store.close();
      await rm(directory, { recursive: true, force: true });
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
        sourceLabel: '광산 테스트 시즌',
        newlyClaimableRewards: []
      };
    }
  };
}
