import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  createTamagotchiReplyPayload,
  getTamagotchiCommandPayloads,
  handleTamagotchiAutocomplete,
  handleTamagotchiCommand
} from '../src/commands/tamagotchi.js';
import { createSqliteStore } from '../src/storage/sqlite-store.js';
import {
  getTamagotchiAssetSummary,
  getTamagotchiDecorations,
  getTamagotchiGrowthStages,
  getTamagotchiManifest,
  getTamagotchiSkins,
  validateTamagotchiManifest
} from '../src/systems/tamagotchi-assets.js';
import { TamagotchiService } from '../src/systems/tamagotchi.js';

const HOUR_MS = 60 * 60 * 1000;
const quietLogger = { error() {} };

test('희진 다마고치 명령 payload는 상태, 스킨, 꾸미기, 여가만 등록한다', () => {
  const payloads = getTamagotchiCommandPayloads();

  assert.deepEqual(payloads.map((command) => command.name), [
    '희진다마고치',
    '희진스킨',
    '희진꾸미기',
    '희진여가'
  ]);

  const petCommand = payloads.find((command) => command.name === '희진다마고치');
  const leisureCommand = payloads.find((command) => command.name === '희진여가');
  const skinCommand = payloads.find((command) => command.name === '희진스킨');
  const decorationCommand = payloads.find((command) => command.name === '희진꾸미기');
  assert.ok(petCommand.options[0].choices.some((choice) => choice.value === 'feed'));
  assert.ok(leisureCommand.options[0].choices.some((choice) => choice.value === 'reels'));
  assert.ok(leisureCommand.options[0].choices.some((choice) => choice.value === 'heeheebot'));
  assert.ok(leisureCommand.options[0].choices.some((choice) => choice.value === 'djmax'));
  assert.ok(leisureCommand.options[0].choices.some((choice) => choice.value === 'monkey'));
  assert.ok(leisureCommand.options[0].choices.some((choice) => choice.value === 'tease_monkey'));
  assert.equal(skinCommand.options[0].autocomplete, true);
  assert.equal(decorationCommand.options[0].autocomplete, true);
  assert.equal(skinCommand.options[0].choices, undefined);
  assert.equal(decorationCommand.options[0].choices, undefined);
  assert.equal(payloads.some((command) => command.name === '희진에셋'), false);
});

test('희진 다마고치 에셋은 원본 기반 단계별 도트 스킨과 많은 PNG 스킨/도구를 제공한다', () => {
  const summary = getTamagotchiAssetSummary();
  const skins = getTamagotchiSkins();
  const decorations = getTamagotchiDecorations();
  const stages = getTamagotchiGrowthStages();

  assert.ok(summary.referencePath.endsWith('heejin-reference-pixel.png'));
  assert.deepEqual(stages.map((stage) => stage.label), ['알', '유아기', '유년기', '청소년기', '성년기']);
  assert.equal(summary.stageCount, 5);
  assert.ok(skins.length >= 20);
  assert.ok(decorations.length >= 25);
  assert.equal(existsSync(join(process.cwd(), summary.referencePath)), true);
  assert.equal(existsSync(join(process.cwd(), summary.growthStagePreviewPath)), true);

  for (const asset of [...skins, ...decorations]) {
    assert.equal(existsSync(join(process.cwd(), asset.imagePath)), true, asset.imagePath);
  }
  for (const skin of skins) {
    assert.equal(skin.stages.length, 5);
    for (const stage of skin.stages) {
      assert.equal(existsSync(join(process.cwd(), stage.imagePath)), true, stage.imagePath);
    }
  }
});

test('희진 다마고치 필수 에셋 manifest가 깨지면 조용히 빈 카탈로그로 대체하지 않는다', () => {
  assert.throws(
    () => validateTamagotchiManifest({
      reference: { imagePath: 'assets/tamagotchi/preview/heejin-reference-pixel.png' },
      stages: [],
      skins: [],
      decorations: []
    }),
    /성장 단계/
  );
  assert.throws(
    () => validateTamagotchiManifest({
      reference: {},
      stages: [{ id: 'egg', label: '알', minAgeDays: 0 }],
      skins: [{ id: 'classic', label: '기본 희진' }],
      decorations: [{ id: 'rice_bowl', label: '밥그릇' }]
    }),
    /레퍼런스/
  );

  const validManifest = JSON.parse(JSON.stringify(getTamagotchiManifest()));
  assert.throws(
    () => validateTamagotchiManifest({
      ...validManifest,
      skins: [
        {
          ...validManifest.skins[0],
          stages: validManifest.skins[0].stages.filter((stage) => stage.id !== 'adult')
        }
      ]
    }),
    /단계 이미지/
  );
  assert.throws(
    () => validateTamagotchiManifest({
      ...validManifest,
      decorations: [
        {
          ...validManifest.decorations[0],
          imagePath: 'assets/tamagotchi/missing-decoration.png'
        }
      ]
    }),
    /이미지/
  );
});

test('희진 다마고치는 케어로 회복하고 장시간 방치하면 죽으며 부활할 수 있다', async () => {
  const fixture = createFixture({
    neglectDeathMs: 2 * HOUR_MS,
    fullnessDecayPerHour: 25,
    happinessDecayPerHour: 25,
    cleanlinessDecayPerHour: 25,
    energyDecayPerHour: 25,
    healthDecayPerLowNeedPerHour: 25
  });

  try {
    const first = await fixture.tamagotchi.getStatus(context({ now: 0 }));
    const played = await fixture.tamagotchi.care(context({ action: 'play', now: 10_000 }));
    const neglected = await fixture.tamagotchi.getStatus(context({ now: 3 * HOUR_MS }));
    const failedCare = await fixture.tamagotchi.care(context({ action: 'feed', now: 3 * HOUR_MS + 1_000 }));
    const revived = await fixture.tamagotchi.care(context({ action: 'revive', now: 3 * HOUR_MS + 2_000 }));

    assert.equal(first.pet.status, 'alive');
    assert.equal(played.performed, true);
    assert.ok(played.pet.stats.happiness >= first.pet.stats.happiness);
    assert.equal(neglected.pet.status, 'dead');
    assert.equal(failedCare.performed, false);
    assert.match(failedCare.eventMessage, /부활/);
    assert.equal(revived.pet.status, 'alive');
    assert.equal(revived.pet.counters.revivals, 1);
  } finally {
    fixture.cleanup();
  }
});

test('살아있는 희진은 부활 명령을 회복 꼼수로 쓰지 못한다', async () => {
  const fixture = createFixture();

  try {
    const revived = await fixture.tamagotchi.care(context({ action: 'revive', now: 0 }));

    assert.equal(revived.performed, false);
    assert.equal(revived.pet.status, 'alive');
    assert.equal(revived.pet.counters.revivals, 0);
    assert.match(revived.eventMessage, /살아있어요/);
  } finally {
    fixture.cleanup();
  }
});

test('희진 다마고치는 같은 행동 연타를 쿨다운으로 막는다', async () => {
  const fixture = createFixture({ actionCooldownMs: 60_000 });

  try {
    const first = await fixture.tamagotchi.care(context({ action: 'feed', now: 0 }));
    const blocked = await fixture.tamagotchi.care(context({ action: 'feed', now: 10_000 }));
    const ready = await fixture.tamagotchi.care(context({ action: 'feed', now: 61_000 }));

    assert.equal(first.performed, true);
    assert.equal(blocked.performed, false);
    assert.ok(blocked.cooldown.remainingMs > 0);
    assert.match(blocked.eventMessage, /뒤에 다시/);
    assert.equal(blocked.pet.counters.feeds, 1);
    assert.equal(ready.performed, true);
    assert.equal(ready.pet.counters.feeds, 2);
  } finally {
    fixture.cleanup();
  }
});

test('기존 병든 희진 기록은 schemaVersion과 안전한 병 시작 시각으로 마이그레이션된다', async () => {
  const fixture = createFixture();

  try {
    await fixture.store.update((data) => {
      data.guilds['guild-1'] = {
        tamagotchi: {
          users: {
            'user-1': {
              userId: 'user-1',
              username: '기존희진',
              status: 'alive',
              createdAt: 0,
              lastUpdatedAt: 0,
              lastCareAt: 0,
              stats: {
                fullness: 60,
                happiness: 60,
                cleanliness: 60,
                energy: 60,
                health: 60,
                affection: 10
              },
              cosmetic: {},
              conditions: {
                sick: true,
                illnessStartedAt: null,
                illnessReason: null
              },
              counters: {}
            }
          }
        }
      };
    });

    const migrated = await fixture.tamagotchi.getStatus(context({ now: 123_000 }));

    assert.equal(migrated.pet.schemaVersion, 1);
    assert.equal(migrated.pet.conditions.sick, true);
    assert.equal(migrated.pet.conditions.illnessStartedAt, 123_000);
  } finally {
    fixture.cleanup();
  }
});

test('기존 건강한 희진 기록은 병 시작 시각을 임의로 만들지 않는다', async () => {
  const fixture = createFixture();

  try {
    await fixture.store.update((data) => {
      data.guilds['guild-1'] = {
        tamagotchi: {
          users: {
            'user-1': {
              userId: 'user-1',
              username: '건강희진',
              status: 'alive',
              createdAt: 0,
              lastUpdatedAt: 0,
              lastCareAt: 0,
              stats: {
                fullness: 80,
                happiness: 80,
                cleanliness: 80,
                energy: 80,
                health: 80,
                affection: 10
              },
              cosmetic: {},
              conditions: {},
              counters: {}
            }
          }
        }
      };
    });

    const migrated = await fixture.tamagotchi.getStatus(context({ now: 123_000 }));

    assert.equal(migrated.pet.schemaVersion, 1);
    assert.equal(migrated.pet.conditions.sick, false);
    assert.equal(migrated.pet.conditions.illnessStartedAt, null);
    assert.equal(migrated.pet.conditions.illnessReason, null);
  } finally {
    fixture.cleanup();
  }
});

test('잘못 관리하면 희진이 병들고 병을 오래 방치하면 질병 사망한다', async () => {
  const fixture = createFixture({
    neglectDeathMs: 100 * HOUR_MS,
    fullnessDecayPerHour: 50,
    happinessDecayPerHour: 50,
    cleanlinessDecayPerHour: 50,
    energyDecayPerHour: 50,
    healthDecayPerLowNeedPerHour: 8,
    sicknessHealthDecayPerHour: 50,
    illnessDeathMs: HOUR_MS
  });

  try {
    await fixture.tamagotchi.getStatus(context({ now: 0 }));
    const sick = await fixture.tamagotchi.getStatus(context({ now: 2 * HOUR_MS }));
    const dead = await fixture.tamagotchi.getStatus(context({ now: 4 * HOUR_MS }));

    assert.equal(sick.pet.conditions.sick, true);
    assert.match(sick.pet.conditions.illnessReason, /병/);
    assert.equal(dead.pet.status, 'dead');
    assert.match(dead.pet.deathReason, /병/);
  } finally {
    fixture.cleanup();
  }
});

test('여가는 행복/애정과 피로 트레이드오프를 주고 원숭이 계열도 기록한다', async () => {
  const fixture = createFixture();

  try {
    const first = await fixture.tamagotchi.getStatus(context({ now: 0 }));
    const reels = await fixture.tamagotchi.leisure(context({ leisureId: 'reels', now: 1_000 }));
    const monkey = await fixture.tamagotchi.leisure(context({ leisureId: 'monkey', now: 2_000 }));
    const tease = await fixture.tamagotchi.leisure(context({ leisureId: 'tease_monkey', now: 3_000 }));

    assert.ok(reels.pet.stats.happiness > first.pet.stats.happiness);
    assert.equal(monkey.pet.counters.leisure.monkey, 1);
    assert.equal(tease.pet.counters.leisure.tease_monkey, 1);
    assert.ok(tease.pet.stats.health < monkey.pet.stats.health);
  } finally {
    fixture.cleanup();
  }
});

test('오늘의 돌봄 미션은 케어 루프를 만들고 경제 보상 없이 추억 조각을 준다', async () => {
  const fixture = createFixture({
    actionCooldownMs: 0,
    leisureCooldownMs: 0,
    randomEventEveryActions: 0,
    dailyRewardMemoryShards: 2
  });

  try {
    await fixture.tamagotchi.care(context({ action: 'feed', now: 0 }));
    await fixture.tamagotchi.care(context({ action: 'play', now: 1_000 }));
    await fixture.tamagotchi.care(context({ action: 'clean', now: 2_000 }));
    const complete = await fixture.tamagotchi.leisure(context({ leisureId: 'walk', now: 3_000 }));

    assert.equal(complete.daily.complete, true);
    assert.equal(complete.daily.rewardClaimed, true);
    assert.equal(complete.codex.memoryShards, 2);
    assert.equal(complete.codex.dailyCompletions, 1);
    assert.equal(Object.hasOwn(complete.pet, 'balance'), false);
    assert.match(complete.eventMessage, /오늘의 돌봄 완료/);
    assert.match(complete.recentEvents[0].title, /오늘의 돌봄/);
  } finally {
    fixture.cleanup();
  }
});

test('랜덤 사건은 상태와 도감만 바꾸고 골드 경제를 건드리지 않는다', async () => {
  const fixture = createFixture({
    actionCooldownMs: 0,
    randomEventEveryActions: 2
  });

  try {
    await fixture.tamagotchi.care(context({ action: 'feed', now: 0 }));
    const evented = await fixture.tamagotchi.care(context({ action: 'play', now: 1_000 }));

    assert.ok(evented.randomEvent);
    assert.equal(evented.codex.eventCount, 1);
    assert.equal(evented.codex.memoryShards, 1);
    assert.equal(evented.recentEvents[0].type, 'random');
    assert.equal(Object.hasOwn(evented.pet, 'money'), false);
    assert.equal(Object.hasOwn(evented.pet, 'balance'), false);
    assert.match(evented.eventMessage, /랜덤 사건/);
  } finally {
    fixture.cleanup();
  }
});

test('만족도와 특화 행동은 청소년기/성년기 성장 분기를 결정하고 저장한다', async () => {
  const fixture = createFixture({
    neglectDeathMs: 1_000 * 24 * HOUR_MS,
    fullnessDecayPerHour: 0,
    happinessDecayPerHour: 0,
    cleanlinessDecayPerHour: 0,
    energyDecayPerHour: 0,
    healthDecayPerLowNeedPerHour: 0
  });

  try {
    await fixture.tamagotchi.getStatus(context({ now: 0 }));
    for (let index = 0; index < 8; index += 1) {
      await fixture.tamagotchi.care(context({ action: 'feed', now: 10_000 + index }));
    }

    const teen = await fixture.tamagotchi.getStatus(context({ now: 8 * 24 * HOUR_MS }));
    const adult = await fixture.tamagotchi.getStatus(context({ now: 15 * 24 * HOUR_MS }));

    assert.equal(teen.growthStage.id, 'teen');
    assert.equal(teen.pet.growth.teenBranchId, 'gourmet');
    assert.equal(teen.growthBranch.id, 'gourmet');
    assert.ok(teen.codex.discoveredBranches.includes('gourmet'));
    assert.equal(adult.growthStage.id, 'adult');
    assert.ok(adult.pet.growth.adultBranchId);
    assert.ok(adult.pet.growth.branchHistory.length >= 2);
    assert.ok(adult.growthProfile.satisfactionScore >= 45);
    assert.ok(adult.codex.branchCount >= 1);
  } finally {
    fixture.cleanup();
  }
});

test('희진 다마고치는 스킨과 꾸미기를 장착하고 버튼으로 순환한다', async () => {
  const fixture = createFixture();

  try {
    const skinned = await fixture.tamagotchi.equipSkin(context({ skinId: 'bunny', now: 1 }));
    const decorated = await fixture.tamagotchi.equipDecoration(context({ decorationId: 'cozy_bed', now: 2 }));
    const cycledSkin = await fixture.tamagotchi.cycleSkin(context({ now: 3 }));
    const cycledDecoration = await fixture.tamagotchi.cycleDecoration(context({ now: 4 }));

    assert.equal(skinned.pet.cosmetic.skinId, 'bunny');
    assert.equal(decorated.pet.cosmetic.decorationId, 'cozy_bed');
    assert.notEqual(cycledSkin.pet.cosmetic.skinId, 'bunny');
    assert.notEqual(cycledDecoration.pet.cosmetic.decorationId, 'cozy_bed');
  } finally {
    fixture.cleanup();
  }
});

test('희진 다마고치 응답 payload는 도트 이미지 첨부와 주인 전용 버튼을 포함한다', async () => {
  const fixture = createFixture();

  try {
    const result = await fixture.tamagotchi.getStatus(context({ now: 0 }));
    const payload = createTamagotchiReplyPayload(testUser(), result);

    assert.equal(payload.files.length, 2);
    assert.equal(payload.embeds[0].data.image.url, `attachment://${payload.files[0].name}`);
    assert.equal(payload.components.length, 4);
    assert.ok(payload.components.every((row) => row.components.length <= 5));
    assert.match(payload.embeds[0].data.description, /추천 행동/);
    assert.match(payload.embeds[0].data.description, /오늘의 돌봄/);
    assert.match(payload.embeds[0].data.description, /성장도감/);
    assert.match(payload.components[0].components[0].data.custom_id, /^heejin_pet:feed:user-1$/);
    assert.match(payload.components[2].components[0].data.custom_id, /^heejin_pet:leisure_reels:user-1$/);
  } finally {
    fixture.cleanup();
  }
});

test('희진에셋 명령은 사용자 명령으로 처리하지 않는다', async () => {
  const fixture = createFixture();

  try {
    const interaction = createChatInputInteraction('희진에셋');
    const handled = await handleTamagotchiCommand(interaction, fixture.tamagotchi, quietLogger);

    assert.equal(handled, false);
    assert.equal(interaction.replies.length, 0);
  } finally {
    fixture.cleanup();
  }
});

test('희진 스킨/꾸미기 autocomplete는 25개 초과 카탈로그도 직접 검색한다', async () => {
  const skinInteraction = createAutocompleteInteraction('희진스킨', '스킨', '민트');
  const decorInteraction = createAutocompleteInteraction('희진꾸미기', '장식', 'snack');

  const handledSkin = await handleTamagotchiAutocomplete(skinInteraction);
  const handledDecor = await handleTamagotchiAutocomplete(decorInteraction);

  assert.equal(handledSkin, true);
  assert.equal(handledDecor, true);
  assert.ok(skinInteraction.responses[0].some((choice) => choice.value === 'mint'));
  assert.ok(decorInteraction.responses[0].some((choice) => choice.value === 'snack_tray'));
  assert.ok(decorInteraction.responses[0].length <= 25);
});

test('희진 다마고치 슬래시 명령과 버튼은 상태 메시지를 보내고 버튼 주인을 검증한다', async () => {
  const fixture = createFixture();

  try {
    const slash = createChatInputInteraction('희진다마고치');
    const handledSlash = await handleTamagotchiCommand(slash, fixture.tamagotchi, quietLogger);
    const feedCustomId = slash.replies[0].components[0].components[0].data.custom_id;

    const button = createButtonInteraction(feedCustomId);
    const handledButton = await handleTamagotchiCommand(button, fixture.tamagotchi, quietLogger);

    const stranger = createButtonInteraction(feedCustomId, { userId: 'other-user' });
    const handledStranger = await handleTamagotchiCommand(stranger, fixture.tamagotchi, quietLogger);

    assert.equal(handledSlash, true);
    assert.equal(slash.replies.length, 1);
    assert.ok(slash.replies[0].files.length >= 1);
    assert.equal(handledButton, true);
    assert.equal(button.updates.length, 1);
    assert.match(button.updates[0].content, /먹었어요/);
    assert.equal(handledStranger, true);
    assert.equal(stranger.replies[0].ephemeral, true);
    assert.match(stranger.replies[0].content, /주인만/);
  } finally {
    fixture.cleanup();
  }
});

function createFixture(options = {}) {
  const store = createSqliteStore(':memory:');
  return {
    store,
    tamagotchi: new TamagotchiService(store, options),
    cleanup() {
      store.close();
    }
  };
}

function context(overrides = {}) {
  return {
    guildId: 'guild-1',
    userId: 'user-1',
    username: '테스터',
    ...overrides
  };
}

function testUser(overrides = {}) {
  return {
    id: 'user-1',
    username: '테스터',
    toString() {
      return '@테스터';
    },
    ...overrides
  };
}

function createChatInputInteraction(commandName, optionValues = {}) {
  return {
    commandName,
    guildId: 'guild-1',
    user: testUser(),
    replies: [],
    isChatInputCommand() {
      return true;
    },
    isButton() {
      return false;
    },
    inGuild() {
      return true;
    },
    options: {
      getString(name, required = false) {
        const value = optionValues[name] ?? null;
        if (required && value === null) throw new Error(`Missing required option ${name}`);
        return value;
      }
    },
    async reply(payload) {
      this.replies.push(payload);
      this.replied = true;
    },
    async followUp(payload) {
      this.replies.push(payload);
    }
  };
}

function createButtonInteraction(customId, options = {}) {
  return {
    customId,
    guildId: 'guild-1',
    user: testUser({ id: options.userId ?? 'user-1' }),
    replies: [],
    updates: [],
    isChatInputCommand() {
      return false;
    },
    isButton() {
      return true;
    },
    inGuild() {
      return true;
    },
    async reply(payload) {
      this.replies.push(payload);
      this.replied = true;
    },
    async update(payload) {
      this.updates.push(payload);
    },
    async followUp(payload) {
      this.replies.push(payload);
    }
  };
}

function createAutocompleteInteraction(commandName, focusedName, focusedValue) {
  return {
    commandName,
    responses: [],
    isAutocomplete() {
      return true;
    },
    options: {
      getFocused(withName) {
        return withName ? { name: focusedName, value: focusedValue } : focusedValue;
      }
    },
    async respond(choices) {
      this.responses.push(choices);
    }
  };
}
