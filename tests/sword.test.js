import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  createSwordReplyPayload,
  getSwordCommandPayloads,
  handleSwordCommand
} from '../src/commands/sword.js';
import { createSqliteStore } from '../src/storage/sqlite-store.js';
import { EconomyService } from '../src/systems/economy.js';
import {
  getSwordAssetAttachment,
  getSwordAssetLabel,
  getSwordAssetName
} from '../src/systems/sword-assets.js';
import {
  getAdvancedSwordEnhanceConfig,
  getSwordEnhanceConfig,
  getSwordSellValue,
  resolveSwordEnhancement
} from '../src/systems/sword.js';

const DAY_MS = 24 * 60 * 60 * 1000;

test('검 명령 payload는 강화, 보호권, 업적, 판매, 랭킹, 배틀, 선물받기, 묵념을 등록한다', () => {
  const payloads = getSwordCommandPayloads();

  assert.deepEqual(payloads.map((command) => command.name), [
    '검강화',
    '검상급강화',
    '검정보',
    '검보호권',
    '검업적',
    '검판매',
    '검랭킹',
    '검배틀',
    '선물받기',
    '묵념'
  ]);
  assert.equal(payloads[3].options[0].name, '수량');
  assert.equal(payloads[4].options[0].name, '업적');
  assert.equal(payloads[6].options[0].name, '종류');
  assert.equal(payloads[6].options[0].choices.length, 3);
  assert.equal(payloads[7].options[0].name, '상대');
  assert.equal(payloads[7].options[0].required, false);
});

test('묵념 명령은 검을 잃은 분위기와 랜덤 대장장이 사진을 공개 메시지로 보낸다', async () => {
  const replies = [];
  const interaction = createSwordInteraction({
    commandName: '묵념',
    replies
  });

  const handled = await handleSwordCommand(interaction, {}, silentLogger);

  assert.equal(handled, true);
  assert.equal(replies.length, 1);
  assert.equal(replies[0].ephemeral, undefined);
  assert.match(replies[0].content, /묵념/);
  assert.match(replies[0].content, /<@user-1>/);
  assert.match(replies[0].content, /검/);
  assert.equal(replies[0].files.length, 1);
  assert.ok([
    'blacksmith_hisashiburi.png',
    'blacksmith_coffin_dance.png'
  ].includes(replies[0].files[0].name));
  assert.equal(replies[0].embeds[0].data.image.url, `attachment://${replies[0].files[0].name}`);
});

test('검 강화 확률표는 1~100강 확장표와 상급강화 보정을 따른다', () => {
  assert.deepEqual(pickRates(getSwordEnhanceConfig(0)), [100, 0, 0]);
  assert.deepEqual(pickRates(getSwordEnhanceConfig(35)), [80, 10, 10]);
  assert.deepEqual(pickRates(getSwordEnhanceConfig(95)), [8, 81, 11]);
  assert.equal(getSwordEnhanceConfig(100).blocked, true);
  assert.deepEqual(pickRates(getAdvancedSwordEnhanceConfig(90)), [27, 73, 0]);
  assert.equal(getAdvancedSwordEnhanceConfig(91).blocked, true);
});

test('검 강화 결과는 성공, 유지, 파괴와 파괴 보상을 계산한다', () => {
  const success = resolveSwordEnhancement({
    level: 0,
    randomInt: () => 1
  });
  const maintain = resolveSwordEnhancement({
    level: 40,
    randomInt: () => 80
  });
  const destroyed = resolveSwordEnhancement({
    level: 95,
    randomInt: () => 100
  });
  const advanced = resolveSwordEnhancement({
    level: 90,
    mode: 'advanced',
    randomInt: () => 100
  });

  assert.equal(success.outcome, 'success');
  assert.equal(success.afterLevel, 1);
  assert.equal(maintain.outcome, 'maintain');
  assert.equal(maintain.afterLevel, 40);
  assert.equal(destroyed.outcome, 'destroy');
  assert.equal(destroyed.afterLevel, 0);
  assert.equal(destroyed.refineStoneReward, 4);
  assert.equal(advanced.outcome, 'maintain');
  assert.equal(advanced.afterLevel, 90);
  assert.throws(
    () => resolveSwordEnhancement({ level: 91, mode: 'advanced' }),
    /90 이하/
  );
});

test('검 이미지 에셋은 레벨 이름과 256px PNG 첨부를 제공한다', () => {
  const first = getSwordAssetAttachment(1);
  const hundred = getSwordAssetAttachment(100);

  assert.equal(getSwordAssetName(1), '도훈검');
  assert.equal(getSwordAssetName(100), '희희검');
  assert.equal(getSwordAssetLabel(0), '+0 기본 검');
  assert.equal(first.name, 'sword_001.png');
  assert.equal(hundred.name, 'sword_100.png');
  assert.equal(existsSync(first.attachment), true);
  assert.equal(existsSync(hundred.attachment), true);
});

test('대장장이 이미지 에셋은 결과별 검강화 응답용 PNG로 제공된다', () => {
  for (const fileName of [
    'blacksmith_success.png',
    'blacksmith_maintain.png',
    'blacksmith_destroy.png',
    'blacksmith_hisashiburi.png',
    'blacksmith_coffin_dance.png'
  ]) {
    const blacksmithPath = join(process.cwd(), 'assets', 'sword', 'blacksmith', fileName);
    assert.equal(existsSync(blacksmithPath), true);
  }

  const tributeMeta = JSON.parse(readFileSync(
    join(process.cwd(), 'assets', 'sword', 'blacksmith', 'tribute', 'hisashiburi', 'asset.json'),
    'utf8'
  ));
  assert.equal(tributeMeta.generatedWith, 'agent-sprite-forge:$generate2dsprite');
});

test('검 응답 payload는 현재 검 이미지를 embed attachment로 붙인다', () => {
  const payload = createSwordReplyPayload('강화 결과', 1, '현재 검 — +1 도훈검');

  assert.equal(payload.content, '강화 결과');
  assert.equal(payload.files[0].name, 'sword_001.png');
  assert.equal(payload.embeds[0].data.title, '현재 검 — +1 도훈검');
  assert.equal(payload.embeds[0].data.image.url, 'attachment://sword_001.png');
  assert.equal(payload.embeds[0].data.footer, undefined);
});

test('검강화 명령 응답은 강화 단계 이미지와 대장장이 축하 메시지를 포함한다', async () => {
  const replies = [];
  const interaction = createSwordInteraction({
    commandName: '검강화',
    replies
  });
  const economy = {
    async enhanceSword() {
      return swordEnhancementResult({
        beforeLevel: 0,
        afterLevel: 1
      });
    }
  };

  const handled = await handleSwordCommand(interaction, economy, silentLogger);

  assert.equal(handled, true);
  assert.equal(replies.length, 1);
  assert.match(replies[0].content, /현재 검: \*\*\+1 도훈검\*\*/);
  assert.match(replies[0].content, /대장장이/);
  assert.match(replies[0].content, /축하|붙었다|명작|불꽃|번쩍/);
  assert.equal(replies[0].files[0].name, 'sword_001.png');
  assert.equal(replies[0].files.some((file) => file.name === 'blacksmith_success.png'), true);
  assert.equal(replies[0].embeds[0].data.image.url, 'attachment://sword_001.png');
  assert.equal(replies[0].embeds[0].data.thumbnail.url, 'attachment://blacksmith_success.png');
});

test('검강화 실패 계열 응답은 대장장이 위로와 놀림 메시지를 구분한다', async () => {
  const maintain = await replyWithEnhancementResult(swordEnhancementResult({
    beforeLevel: 40,
    afterLevel: 40,
    outcome: 'maintain',
    roll: 80
  }));
  const destroyed = await replyWithEnhancementResult(swordEnhancementResult({
    beforeLevel: 95,
    afterLevel: 0,
    outcome: 'destroy',
    roll: 100,
    refineStoneReward: 4
  }));

  assert.match(maintain.content, /대장장이/);
  assert.match(maintain.content, /괜찮|다음|살았다|망치|숨/);
  assert.match(destroyed.content, /대장장이/);
  assert.match(destroyed.content, /미안|재가|터졌|울지|처음부터|장례식|숯|조문/);
  assert.equal(maintain.files.some((file) => file.name === 'blacksmith_maintain.png'), true);
  assert.equal(destroyed.files.some((file) => file.name === 'blacksmith_destroy.png'), true);
});

test('고강화 성공과 파괴는 대장장이 특수 멘트를 우선한다', async () => {
  const hundred = await replyWithEnhancementResult(swordEnhancementResult({
    beforeLevel: 99,
    afterLevel: 100,
    outcome: 'success'
  }));
  const funeral = await replyWithEnhancementResult(swordEnhancementResult({
    beforeLevel: 95,
    afterLevel: 0,
    outcome: 'destroy',
    roll: 100
  }));

  assert.match(hundred.content, /서버 전체|전설이 모루|검의 신화/);
  assert.match(funeral.content, /장례식|숯|조문/);
});

test('검정보 명령은 현재 검, 다음 강화, 판매가를 보여준다', async () => {
  const replies = [];
  const interaction = createSwordInteraction({
    commandName: '검정보',
    replies
  });
  const economy = {
    async getSwordStatus() {
      return swordStatusResult({
        level: 12,
        highestLevel: 15,
        refineStones: 4,
        balance: 5_000
      });
    }
  };

  const handled = await handleSwordCommand(interaction, economy, silentLogger);

  assert.equal(handled, true);
  assert.match(replies[0].content, /검정보/);
  assert.match(replies[0].content, /현재 검: \*\*\+12/);
  assert.match(replies[0].content, /다음 일반 강화: \*\*\+12 → \+13\*\*/);
  assert.match(replies[0].content, /보호권: \*\*0개\*\*/);
  assert.match(replies[0].content, /판매 예상가: \*\*1,014골드\*\*/);
  assert.equal(replies[0].files[0].name, 'sword_012.png');
});

test('검보호권 명령은 돈으로 파괴 방지권을 구매한다', async () => {
  const replies = [];
  const interaction = createSwordInteraction({
    commandName: '검보호권',
    replies,
    integerOptions: { 수량: 2 }
  });
  const economy = {
    async buySwordProtectionScrolls(payload) {
      assert.equal(payload.quantity, 2);
      return {
        quantity: 2,
        unitCost: 15_000,
        totalCost: 30_000,
        profile: {
          balance: 20_000,
          sword: {
            level: 12,
            protectionScrolls: 2,
            refineStones: 0
          }
        }
      };
    }
  };

  const handled = await handleSwordCommand(interaction, economy, silentLogger);

  assert.equal(handled, true);
  assert.match(replies[0].content, /검 보호권 구매/);
  assert.match(replies[0].content, /보호권 \+2개/);
  assert.match(replies[0].content, /골드: \*\*20,000골드\*\*/);
});

test('검업적 명령은 달성 현황을 보여주고 선택하면 보상을 수령한다', async () => {
  const listReplies = [];
  const claimReplies = [];
  const listInteraction = createSwordInteraction({
    commandName: '검업적',
    replies: listReplies
  });
  const claimInteraction = createSwordInteraction({
    commandName: '검업적',
    replies: claimReplies,
    stringOptions: { 업적: 'sword_level_50' }
  });
  const economy = {
    async getSwordAchievements() {
      return {
        achievements: [
          {
            id: 'sword_level_50',
            title: '+50 달성',
            description: '검 최고 강화 +50 달성',
            complete: true,
            claimed: false,
            progressText: '+50 / +50',
            rewardText: '5,000골드, 보호권 2개'
          },
          {
            id: 'sword_destroy_5',
            title: '터져도 다시',
            description: '검 파괴 5회',
            complete: false,
            claimed: false,
            progressText: '1 / 5',
            rewardText: '보호권 3개'
          }
        ]
      };
    },
    async claimSwordAchievement(payload) {
      assert.equal(payload.achievementId, 'sword_level_50');
      return {
        achievement: {
          title: '+50 달성',
          rewardText: '5,000골드, 보호권 2개'
        },
        profile: {
          balance: 5_000,
          sword: {
            protectionScrolls: 2,
            refineStones: 0
          }
        }
      };
    }
  };

  await handleSwordCommand(listInteraction, economy, silentLogger);
  await handleSwordCommand(claimInteraction, economy, silentLogger);

  assert.match(listReplies[0], /검 업적/);
  assert.match(listReplies[0], /수령 가능/);
  assert.match(claimReplies[0], /업적 보상 수령/);
  assert.match(claimReplies[0], /\+50 달성/);
});

test('검판매 명령은 판매 전 확인 버튼을 먼저 보여준다', async () => {
  const replies = [];
  let sold = false;
  const interaction = createSwordInteraction({
    commandName: '검판매',
    replies
  });
  const economy = {
    async getSwordStatus() {
      return swordStatusResult({
        level: 12,
        highestLevel: 12,
        balance: 5_000
      });
    },
    async sellSword() {
      sold = true;
    }
  };

  const handled = await handleSwordCommand(interaction, economy, silentLogger);

  assert.equal(handled, true);
  assert.equal(sold, false);
  assert.equal(replies.length, 1);
  assert.match(replies[0].content, /검판매 확인/);
  assert.match(replies[0].content, /판매 예상가: \*\*1,014골드\*\*/);
  assert.equal(replies[0].components[0].components[0].data.custom_id, 'sword_sell_confirm:user-1');
  assert.equal(replies[0].components[0].components[1].data.custom_id, 'sword_sell_cancel:user-1');
  assert.equal(replies[0].files[0].name, 'sword_012.png');
});

test('검판매 확인 버튼은 같은 유저만 판매를 확정하고 취소 버튼은 정산하지 않는다', async () => {
  const updates = [];
  const replies = [];
  const confirm = createSwordButtonInteraction({
    customId: 'sword_sell_confirm:user-1',
    updates,
    replies
  });
  const economy = {
    async sellSword() {
      return swordSaleResult();
    }
  };

  const handled = await handleSwordCommand(confirm, economy, silentLogger);

  assert.equal(handled, true);
  assert.equal(updates.length, 1);
  assert.match(updates[0].content, /검판매/);
  assert.match(updates[0].content, /판매 금액: \*\*750골드\*\*/);
  assert.match(updates[0].content, /현재 검: \*\*\+0 기본 검\*\*/);
  assert.equal(updates[0].components.length, 0);
  assert.equal(updates[0].files[0].name, 'sword_012.png');

  const blocked = createSwordButtonInteraction({
    customId: 'sword_sell_confirm:other-user',
    updates: [],
    replies: []
  });
  await handleSwordCommand(blocked, economy, silentLogger);
  assert.match(blocked.replies[0].content, /판매 확인 버튼은 명령어를 실행한 유저만/);

  const cancelUpdates = [];
  const cancel = createSwordButtonInteraction({
    customId: 'sword_sell_cancel:user-1',
    updates: cancelUpdates,
    replies: []
  });
  await handleSwordCommand(cancel, {
    async sellSword() {
      throw new Error('취소는 판매하면 안 됨');
    }
  }, silentLogger);
  assert.match(cancelUpdates[0].content, /검 판매를 취소했습니다/);
  assert.equal(cancelUpdates[0].components.length, 0);
});

test('검랭킹 명령은 최고강화, 판매금, 파괴횟수 랭킹을 출력한다', async () => {
  const replies = [];
  const interaction = createSwordInteraction({
    commandName: '검랭킹',
    replies,
    stringOptions: { 종류: 'saleEarnings' },
    integerOptions: { 개수: 3 }
  });
  const economy = {
    async getSwordLeaderboard(guildId, category, limit) {
      return [
        { username: '판매왕', metric: 3000, sword: { highestLevel: 20, saleEarnings: 3000, destructions: 1 } },
        { username: '상인', metric: 1000, sword: { highestLevel: 12, saleEarnings: 1000, destructions: 0 } }
      ].slice(0, limit);
    }
  };

  const handled = await handleSwordCommand(interaction, economy, silentLogger);

  assert.equal(handled, true);
  assert.match(replies[0], /검 판매금 랭킹/);
  assert.match(replies[0], /1\. \*\*판매왕\*\* — 3,000골드/);
});

test('검 랭킹 서비스는 카테고리별 상위 유저를 정렬한다', async () => {
  const fixture = await createFixture();

  try {
    await seedProfile(fixture.store, {
      userId: 'user-1',
      username: '최고검',
      sword: { level: 10, highestLevel: 70, saleEarnings: 100, destructions: 1 }
    });
    await seedProfile(fixture.store, {
      userId: 'user-2',
      username: '판매왕',
      sword: { level: 0, highestLevel: 30, saleEarnings: 5_000, destructions: 2 }
    });
    await seedProfile(fixture.store, {
      userId: 'user-3',
      username: '파괴왕',
      sword: { level: 1, highestLevel: 20, saleEarnings: 1_000, destructions: 9 }
    });

    const highest = await fixture.economy.getSwordLeaderboard('guild-1', 'highestLevel', 3);
    const sales = await fixture.economy.getSwordLeaderboard('guild-1', 'saleEarnings', 3);
    const destroyed = await fixture.economy.getSwordLeaderboard('guild-1', 'destructions', 3);

    assert.equal(highest[0].username, '최고검');
    assert.equal(highest[0].metric, 70);
    assert.equal(sales[0].username, '판매왕');
    assert.equal(sales[0].metric, 5_000);
    assert.equal(destroyed[0].username, '파괴왕');
    assert.equal(destroyed[0].metric, 9);
  } finally {
    await fixture.cleanup();
  }
});

test('유저 검배틀 명령은 수락 버튼 없이 즉시 자동 정산한다', async () => {
  const replies = [];
  const target = {
    id: 'target',
    username: '상대',
    bot: false,
    toString() {
      return '<@target>';
    }
  };
  let receivedBattle = null;
  const interaction = createSwordInteraction({
    commandName: '검배틀',
    replies,
    target
  });
  const economy = {
    async playSwordPvpBattle(payload) {
      receivedBattle = payload;
      return swordPvpResult();
    }
  };

  const handled = await handleSwordCommand(interaction, economy, silentLogger);

  assert.equal(handled, true);
  assert.equal(receivedBattle.challenger.userId, 'user-1');
  assert.equal(receivedBattle.opponent.userId, 'target');
  assert.equal(replies.length, 1);
  assert.match(replies[0].content, /검배틀 결과/);
  assert.equal(replies[0].components, undefined);
});

test('선물받기는 하루 한 번 제련석을 지급하고 기존 프로필에 검 상태를 채운다', async () => {
  const fixture = await createFixture();

  try {
    await fixture.store.update((data) => {
      data.guilds['guild-1'] = {
        users: {
          'user-1': legacyProfile('user-1', '검사')
        }
      };
    });

    const first = await fixture.economy.claimSwordGift({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '검사',
      now: 1_000
    });
    const duplicate = await fixture.economy.claimSwordGift({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '검사',
      now: 2_000
    });
    const nextDay = await fixture.economy.claimSwordGift({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '검사',
      now: DAY_MS + 1_000
    });

    assert.equal(first.claimed, true);
    assert.equal(first.giftStones, 3);
    assert.equal(first.profile.sword.level, 0);
    assert.equal(first.profile.sword.refineStones, 3);
    assert.equal(duplicate.claimed, false);
    assert.equal(duplicate.profile.sword.refineStones, 3);
    assert.equal(nextDay.claimed, true);
    assert.equal(nextDay.profile.sword.refineStones, 6);
  } finally {
    await fixture.cleanup();
  }
});

test('검 강화 서비스는 돈과 제련석을 원자적으로 갱신한다', async () => {
  const fixture = await createFixture({ randomInt: () => 1 });

  try {
    await seedProfile(fixture.store, {
      userId: 'user-1',
      username: '강화러',
      balance: 1_000,
      sword: { level: 0, refineStones: 1 }
    });

    const normal = await fixture.economy.enhanceSword({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '강화러',
      now: 10_000
    });
    const advanced = await fixture.economy.advancedEnhanceSword({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '강화러',
      now: 20_000
    });

    assert.equal(normal.outcome, 'success');
    assert.equal(normal.profile.sword.level, 1);
    assert.equal(normal.profile.balance, 900);
    assert.equal(normal.profile.sword.normalAttempts, 1);
    assert.equal(advanced.outcome, 'success');
    assert.equal(advanced.profile.sword.level, 2);
    assert.equal(advanced.profile.sword.refineStones, 0);
    assert.equal(advanced.profile.sword.advancedAttempts, 1);
    assert.equal(advanced.profile.sword.highestLevel, 2);
    assert.equal(advanced.profile.balance, 775);
  } finally {
    await fixture.cleanup();
  }
});

test('검 보호권은 일반 강화 파괴를 막고 보호권만 소모한다', async () => {
  const fixture = await createFixture({ randomInt: () => 100 });

  try {
    await seedProfile(fixture.store, {
      userId: 'user-1',
      username: '보호러',
      balance: 20_000,
      sword: {
        level: 95,
        highestLevel: 95,
        refineStones: 0,
        protectionScrolls: 1
      }
    });

    const result = await fixture.economy.enhanceSword({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '보호러',
      now: 10_000
    });

    assert.equal(result.outcome, 'protect');
    assert.equal(result.beforeLevel, 95);
    assert.equal(result.afterLevel, 95);
    assert.equal(result.profile.sword.level, 95);
    assert.equal(result.profile.sword.protectionScrolls, 0);
    assert.equal(result.profile.sword.destructions, 0);
    assert.equal(result.profile.sword.refineStones, 0);
    assert.equal(result.profile.sword.protectedDestructions, 1);
  } finally {
    await fixture.cleanup();
  }
});

test('검 보호권 구매와 업적 보상은 프로필에 누적된다', async () => {
  const fixture = await createFixture();

  try {
    await seedProfile(fixture.store, {
      userId: 'user-1',
      username: '업적러',
      balance: 50_000,
      sword: {
        level: 50,
        highestLevel: 50
      }
    });

    const purchase = await fixture.economy.buySwordProtectionScrolls({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '업적러',
      quantity: 2
    });
    const claimed = await fixture.economy.claimSwordAchievement({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '업적러',
      achievementId: 'sword_level_50',
      now: 20_000
    });

    assert.equal(purchase.totalCost, 30_000);
    assert.equal(purchase.profile.balance, 20_000);
    assert.equal(purchase.profile.sword.protectionScrolls, 2);
    assert.equal(claimed.profile.balance, 25_000);
    assert.equal(claimed.profile.sword.protectionScrolls, 4);
    assert.equal(claimed.profile.sword.claimedAchievements.sword_level_50, 20_000);
    await assert.rejects(
      () => fixture.economy.claimSwordAchievement({
        guildId: 'guild-1',
        userId: 'user-1',
        username: '업적러',
        achievementId: 'sword_level_50',
        now: 30_000
      }),
      /이미 보상을 받은/
    );
  } finally {
    await fixture.cleanup();
  }
});

test('검 판매 서비스는 판매 금액을 지급하고 검 레벨만 초기화한다', async () => {
  const fixture = await createFixture();

  try {
    await seedProfile(fixture.store, {
      userId: 'user-1',
      username: '판매러',
      balance: 5_000,
      sword: {
        level: 12,
        highestLevel: 15,
        refineStones: 4,
        battleWins: 2,
        normalAttempts: 20
      }
    });

    const result = await fixture.economy.sellSword({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '판매러',
      now: 30_000
    });

    assert.equal(result.beforeLevel, 12);
    assert.equal(result.saleValue, 1_014);
    assert.equal(result.profile.balance, 6_014);
    assert.equal(result.profile.sword.level, 0);
    assert.equal(result.profile.sword.highestLevel, 15);
    assert.equal(result.profile.sword.refineStones, 4);
    assert.equal(result.profile.sword.battleWins, 2);
    assert.equal(result.profile.sword.normalAttempts, 20);
    assert.equal(result.profile.sword.soldCount, 1);
    assert.equal(result.profile.sword.saleEarnings, 1_014);
    assert.equal(result.profile.sword.lastSoldAt, 30_000);
  } finally {
    await fixture.cleanup();
  }
});

test('기본 검은 판매할 수 없다', async () => {
  const fixture = await createFixture();

  try {
    await seedProfile(fixture.store, {
      userId: 'user-1',
      username: '기본검',
      balance: 5_000,
      sword: { level: 0, highestLevel: 3 }
    });

    await assert.rejects(
      () => fixture.economy.sellSword({
        guildId: 'guild-1',
        userId: 'user-1',
        username: '기본검'
      }),
      /판매할 검이 없습니다/
    );
  } finally {
    await fixture.cleanup();
  }
});

test('고강화 검 파괴는 레벨을 0으로 만들고 최고 강화와 제련석 보상을 남긴다', async () => {
  const fixture = await createFixture({ randomInt: () => 100 });

  try {
    await seedProfile(fixture.store, {
      userId: 'user-1',
      username: '파괴러',
      balance: 20_000,
      sword: { level: 95, highestLevel: 95, refineStones: 0 }
    });

    const result = await fixture.economy.enhanceSword({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '파괴러',
      now: 10_000
    });

    assert.equal(result.outcome, 'destroy');
    assert.equal(result.profile.sword.level, 0);
    assert.equal(result.profile.sword.highestLevel, 95);
    assert.equal(result.profile.sword.refineStones, 4);
    assert.equal(result.profile.sword.destructions, 1);
  } finally {
    await fixture.cleanup();
  }
});

test('랜덤 검배틀은 상대 없이 진행되고 승리 보상과 하루 제한, 제련석 일일 상한을 적용한다', async () => {
  const fixture = await createFixture({ randomInt: (min) => min });

  try {
    await seedProfile(fixture.store, {
      userId: 'user-1',
      username: '배틀러',
      balance: 0,
      level: 5,
      sword: { level: 50, highestLevel: 50 }
    });

    let last = null;
    for (let index = 0; index < 10; index += 1) {
      last = await fixture.economy.playSwordRandomBattle({
        guildId: 'guild-1',
        userId: 'user-1',
        username: '배틀러',
        now: 10_000
      });
      assert.equal(last.battled, true);
      assert.equal(last.won, true);
    }
    const blocked = await fixture.economy.playSwordRandomBattle({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '배틀러',
      now: 20_000
    });

    assert.equal(last.profile.sword.battleWins, 10);
    assert.equal(last.profile.sword.battlesToday, 10);
    assert.equal(last.profile.sword.battleStonesToday, 3);
    assert.equal(last.profile.sword.refineStones, 3);
    assert.equal(last.profile.balance > 0, true);
    assert.equal(blocked.battled, false);
  } finally {
    await fixture.cleanup();
  }
});

test('유저 검배틀은 양쪽 일일 횟수를 쓰고 승자만 돈과 경험치를 얻는다', async () => {
  const fixture = await createFixture({ randomInt: (min) => min });

  try {
    await seedProfile(fixture.store, {
      userId: 'challenger',
      username: '도전자',
      balance: 0,
      level: 1,
      sword: { level: 20, highestLevel: 20 }
    });
    await seedProfile(fixture.store, {
      userId: 'opponent',
      username: '상대',
      balance: 100,
      level: 1,
      sword: { level: 0, highestLevel: 0 }
    });

    const result = await fixture.economy.playSwordPvpBattle({
      guildId: 'guild-1',
      challenger: { userId: 'challenger', username: '도전자' },
      opponent: { userId: 'opponent', username: '상대' },
      now: 10_000
    });

    assert.equal(result.winnerUserId, 'challenger');
    assert.equal(result.challenger.balance, result.rewards.money + result.levelReward);
    assert.equal(result.challenger.totalXp, result.rewards.xp);
    assert.equal(result.challenger.sword.battleWins, 1);
    assert.equal(result.challenger.sword.battlesToday, 1);
    assert.equal(result.opponent.balance, 100);
    assert.equal(result.opponent.sword.battleLosses, 1);
    assert.equal(result.opponent.sword.battlesToday, 1);
  } finally {
    await fixture.cleanup();
  }
});

async function createFixture(options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'heeheebot-sword-'));
  const store = createSqliteStore(join(directory, 'profiles.sqlite'));
  const economy = new EconomyService(store, options);

  return {
    economy,
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

async function seedProfile(store, {
  guildId = 'guild-1',
  userId,
  username,
  level = 1,
  xp = 0,
  totalXp = 0,
  balance = 0,
  wallets = {},
  sword = {}
}) {
  await store.update((data) => {
    data.guilds[guildId] ??= {};
    data.guilds[guildId].users ??= {};
    data.guilds[guildId].users[userId] = {
      ...legacyProfile(userId, username),
      level,
      xp,
      totalXp,
      balance,
      wallets: {
        casinoChips: 0,
        rpgGold: 0,
        swordCoins: 0,
        stockCash: 0,
        ...wallets
      },
      currencyMigration: { unifiedGoldVersion: 1, unifiedGoldAt: 1 },
      sword
    };
  });
}

function legacyProfile(userId, username) {
  return {
    userId,
    username,
    level: 1,
    xp: 0,
    totalXp: 0,
    balance: 0,
    wallets: {
      swordCoins: 0
    },
    lastMessageRewardAt: 0,
    lastDailyAt: 0,
    lastDailyDay: null,
    dailyStreak: 0,
    lastFirstMessageBonusDay: null,
    createdAt: 1
  };
}

function pickRates(config) {
  return [config.successRate, config.maintainRate, config.destroyRate];
}

function createSwordInteraction({
  commandName,
  replies,
  target = null,
  stringOptions = {},
  integerOptions = {}
}) {
  return {
    commandName,
    guildId: 'guild-1',
    user: {
      id: 'user-1',
      username: '검사',
      toString() {
        return '<@user-1>';
      }
    },
    isButton() {
      return false;
    },
    isChatInputCommand() {
      return true;
    },
    inGuild() {
      return true;
    },
    options: {
      getUser(name) {
        return name === '상대' ? target : null;
      },
      getString(name) {
        return stringOptions[name] ?? null;
      },
      getInteger(name) {
        return integerOptions[name] ?? null;
      }
    },
    async reply(payload) {
      replies.push(payload);
    }
  };
}

function createSwordButtonInteraction({
  customId,
  userId = 'user-1',
  username = '검사',
  updates,
  replies
}) {
  return {
    customId,
    guildId: 'guild-1',
    updates,
    replies,
    user: {
      id: userId,
      username,
      toString() {
        return `<@${userId}>`;
      }
    },
    isButton() {
      return true;
    },
    isChatInputCommand() {
      return false;
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

async function replyWithEnhancementResult(result) {
  const replies = [];
  const interaction = createSwordInteraction({
    commandName: '검강화',
    replies
  });
  const economy = {
    async enhanceSword() {
      return result;
    }
  };

  await handleSwordCommand(interaction, economy, silentLogger);

  return replies[0];
}

function swordStatusResult({
  level,
  highestLevel,
  refineStones = 0,
  protectionScrolls = 0,
  balance = 0,
  soldCount = 0,
  saleEarnings = 0,
  destructions = 0
}) {
  return {
    profile: {
      userId: 'user-1',
      username: '검사',
      balance,
      sword: {
        level,
        highestLevel,
        refineStones,
        protectionScrolls,
        soldCount,
        saleEarnings,
        destructions,
        battleWins: 0,
        battleLosses: 0,
        normalAttempts: 0,
        advancedAttempts: 0
      }
    },
    saleValue: getSwordSellValue(level),
    normalEnhance: getSwordEnhanceConfig(level),
    advancedEnhance: getAdvancedSwordEnhanceConfig(level),
    giftAvailable: true,
    giftRemainingMs: 0,
    battleRemaining: 10,
    battleStoneRemaining: 3
  };
}

function swordSaleResult() {
  return {
    beforeLevel: 12,
    saleValue: 750,
    profile: {
      balance: 5_750,
      sword: {
        level: 0,
        highestLevel: 12,
        refineStones: 2,
        soldCount: 1,
        saleEarnings: 750
      }
    }
  };
}

function swordEnhancementResult({
  beforeLevel,
  afterLevel,
  outcome = 'success',
  roll = 1,
  refineStoneReward = 0
}) {
  return {
    min: 0,
    max: 4,
    level: beforeLevel,
    targetLevel: beforeLevel + 1,
    mode: 'normal',
    modeLabel: '일반 강화',
    blocked: false,
    successRate: 100,
    maintainRate: 0,
    destroyRate: 0,
    moneyCost: 100,
    stoneCost: 0,
    beforeLevel,
    afterLevel,
    roll,
    outcome,
    outcomeLabel: {
      success: '강화',
      maintain: '유지',
      destroy: '파괴',
      protect: '보호'
    }[outcome] ?? outcome,
    refineStoneReward,
    profile: {
      userId: 'user-1',
      username: '검사',
      balance: 900,
      sword: {
        level: afterLevel,
        highestLevel: afterLevel,
        refineStones: 0
      }
    }
  };
}

function swordPvpResult() {
  return {
    battled: true,
    type: 'pvp',
    winnerUserId: 'user-1',
    loserUserId: 'target',
    battle: {
      challenger: {
        power: 20,
        swordLevel: 1,
        level: 1,
        roll: 10
      },
      opponent: {
        power: 5,
        swordLevel: 0,
        level: 1,
        roll: 1
      }
    },
    rewards: {
      xp: 20,
      money: 50,
      refineStones: 1
    },
    remainingBattles: {
      challenger: 9,
      opponent: 9
    },
    leveledUp: false,
    levelReward: 0,
    challenger: {
      userId: 'user-1',
      username: '검사',
      level: 1,
      balance: 50,
      sword: {
        level: 1
      }
    },
    opponent: {
      userId: 'target',
      username: '상대',
      level: 1,
      balance: 0,
      sword: {
        level: 0
      }
    }
  };
}

const silentLogger = {
  error() {}
};
