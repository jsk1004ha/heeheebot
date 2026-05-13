import { MessageFlags } from 'discord.js';
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
import { getBlacksmithEnhancementMessage } from '../src/systems/sword-blacksmith.js';
import {
  getSwordAssetAttachment,
  getSwordAssetLabel,
  getSwordAssetName
} from '../src/systems/sword-assets.js';
import {
  SWORD_DESTRUCTION_SUCCESS_BONUS_DURATION_MS,
  SWORD_DESTRUCTION_SUCCESS_BONUS_MAX_BASIS_POINTS,
  SWORD_DESTRUCTION_SUCCESS_BONUS_MIN_BASIS_POINTS,
  applySwordSuccessBonus,
  getAdvancedSwordEnhanceConfig,
  getSwordEnhanceConfig,
  getSwordSellValue,
  resolveSwordEnhancement
} from '../src/systems/sword.js';

const DAY_MS = 24 * 60 * 60 * 1000;

test('검 명령 payload는 강화, 도감, 보호권, 업적, 판매, 랭킹, 배틀, 선물받기, 묵념을 등록한다', () => {
  const payloads = getSwordCommandPayloads();

  assert.deepEqual(payloads.map((command) => command.name), [
    '검강화',
    '검상급강화',
    '검정보',
    '검도감',
    '검보호권',
    '검업적',
    '검판매',
    '검랭킹',
    '검배틀',
    '선물받기',
    '묵념'
  ]);
  assert.equal(payloads[4].options[0].name, '수량');
  assert.equal(payloads[5].options[0].name, '업적');
  assert.equal(payloads[7].options[0].name, '종류');
  assert.equal(payloads[7].options[0].choices.length, 3);
  assert.equal(payloads[8].options[0].name, '상대');
  assert.equal(payloads[8].options[0].required, false);
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
  assert.equal(replies[0].flags, undefined);
  assert.match(replies[0].content, /묵념/);
  assert.match(replies[0].content, /<@user-1>/);
  assert.doesNotMatch(replies[0].content, /방금 터졌거나|언젠가 터질|모든 검과 제련석/);
  assert.equal(replies[0].files.length, 1);
  assert.ok([
    'blacksmith_hisashiburi.png',
    'blacksmith_coffin_dance.png'
  ].includes(replies[0].files[0].name));
  assert.equal(replies[0].embeds[0].data.image.url, `attachment://${replies[0].files[0].name}`);
});

test('자동 defer된 검 명령 실패 안내는 원본 응답을 편집해 바로 사라지지 않게 한다', async () => {
  const replies = [];
  const edits = [];
  const followUps = [];
  let deleted = false;
  const interaction = createSwordInteraction({
    commandName: '검강화',
    replies
  });
  interaction.deferred = true;
  interaction.replied = false;
  interaction.editReply = async (payload) => {
    edits.push(payload);
    interaction.replied = true;
    return payload;
  };
  interaction.followUp = async (payload) => {
    followUps.push(payload);
    return payload;
  };
  interaction.deleteReply = async () => {
    deleted = true;
  };
  const economy = {
    async enhanceSword() {
      throw new Error('골드가 부족합니다. 필요 금액: 100코인');
    }
  };

  const handled = await handleSwordCommand(interaction, economy, silentLogger);

  assert.equal(handled, true);
  assert.deepEqual(replies, []);
  assert.equal(followUps.length, 0);
  assert.equal(deleted, false);
  assert.equal(edits.length, 1);
  assert.equal(edits[0].flags, undefined);
  assert.match(edits[0].content, /골드가 부족합니다\. 필요 금액: 100코인/);
});

test('검 강화 확률표는 1~100강 확장표와 상급강화 보정을 따른다', () => {
  assert.deepEqual(pickRates(getSwordEnhanceConfig(0)), [95, 5, 0]);
  assert.deepEqual(pickRates(getSwordEnhanceConfig(35)), [70, 20, 10]);
  assert.deepEqual(pickRates(getSwordEnhanceConfig(95)), [5, 84, 11]);
  assert.equal(getSwordEnhanceConfig(100).blocked, true);
  assert.deepEqual(pickRates(getAdvancedSwordEnhanceConfig(90)), [23, 77, 0]);
  assert.equal(getAdvancedSwordEnhanceConfig(91).blocked, true);
});

test('검강화 성공률은 낮은 단계도 너무 높지 않고 유지 확률이 체감된다', () => {
  assert.deepEqual(pickRates(getSwordEnhanceConfig(5)), [93, 7, 0]);
  assert.deepEqual(pickRates(getSwordEnhanceConfig(10)), [90, 10, 0]);
  assert.deepEqual(pickRates(getSwordEnhanceConfig(25)), [78, 12, 10]);
  assert.deepEqual(pickRates(getSwordEnhanceConfig(50)), [45, 45, 10]);
  assert.deepEqual(pickRates(getSwordEnhanceConfig(90)), [8, 82, 10]);
});

test('일반 검강화도 낮은 단계부터 유지 확률을 가진다', () => {
  for (let level = 0; level < 100; level += 1) {
    const config = getSwordEnhanceConfig(level);

    assert.ok(config.maintainRate > 0, `+${level} 일반 강화 유지 확률이 없다`);
    assert.equal(
      config.successRate + config.maintainRate + config.destroyRate,
      100,
      `+${level} 일반 강화 확률 합계가 100이 아니다`
    );
  }
});

test('검 파괴 추가 확률은 성공률을 올리고 유지 확률에서 먼저 차감한다', () => {
  const bonusRate = 2.5;
  const lowLevel = applySwordSuccessBonus(
    getSwordEnhanceConfig(0),
    bonusRate
  );
  const highLevel = applySwordSuccessBonus(
    getSwordEnhanceConfig(95),
    bonusRate
  );

  assert.equal(SWORD_DESTRUCTION_SUCCESS_BONUS_MIN_BASIS_POINTS < SWORD_DESTRUCTION_SUCCESS_BONUS_MAX_BASIS_POINTS, true);
  assert.deepEqual(pickRates(lowLevel), [97.5, 2.5, 0]);
  assert.equal(lowLevel.baseSuccessRate, 95);
  assert.equal(lowLevel.successBonusRate, 2.5);
  assert.deepEqual(pickRates(highLevel), [7.5, 81.5, 11]);
  assert.equal(highLevel.baseMaintainRate, 84);
});

test('상급강화는 어떤 구간에서도 일반 강화보다 성공률이 낮아지지 않는다', () => {
  for (let level = 0; level <= 90; level += 1) {
    const normal = getSwordEnhanceConfig(level);
    const advanced = getAdvancedSwordEnhanceConfig(level);

    assert.equal(advanced.destroyRate, 0, `+${level} 상급강화는 파괴가 없어야 한다`);
    assert.equal(advanced.targetLevel, Math.min(level + 1, 100));
    assert.equal(advanced.maxTargetLevel, Math.min(level + 5, 100));
    assert.ok(
      advanced.successRate >= normal.successRate,
      `+${level} 상급강화 성공률 ${advanced.successRate}%가 일반 ${normal.successRate}%보다 낮다`
    );
  }
});

test('검 강화 결과는 성공, 유지, 파괴와 파괴 보상을 계산한다', () => {
  const success = resolveSwordEnhancement({
    level: 0,
    randomInt: () => 1
  });
  const lowMaintain = resolveSwordEnhancement({
    level: 0,
    randomInt: () => 99
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
  assert.equal(lowMaintain.outcome, 'maintain');
  assert.equal(lowMaintain.afterLevel, 0);
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

test('상급강화 성공은 낮은 확률로 한 번에 최대 +5 강화 단계를 올린다', () => {
  const normalSuccess = resolveSwordEnhancement({
    level: 40,
    mode: 'advanced',
    randomInt: sequenceRandom([1, 100])
  });
  const greatSuccess = resolveSwordEnhancement({
    level: 40,
    mode: 'advanced',
    randomInt: sequenceRandom([1, 20])
  });
  const criticalSuccess = resolveSwordEnhancement({
    level: 40,
    mode: 'advanced',
    randomInt: sequenceRandom([1, 14])
  });
  const heroicSuccess = resolveSwordEnhancement({
    level: 40,
    mode: 'advanced',
    randomInt: sequenceRandom([1, 6])
  });
  const legendarySuccess = resolveSwordEnhancement({
    level: 40,
    mode: 'advanced',
    randomInt: sequenceRandom([1, 2])
  });
  const cappedSuccess = resolveSwordEnhancement({
    level: 90,
    mode: 'advanced',
    randomInt: sequenceRandom([1, 2])
  });

  assert.equal(normalSuccess.levelGain, 1);
  assert.equal(normalSuccess.afterLevel, 41);
  assert.equal(greatSuccess.levelGain, 2);
  assert.equal(greatSuccess.afterLevel, 42);
  assert.equal(criticalSuccess.levelGain, 3);
  assert.equal(criticalSuccess.afterLevel, 43);
  assert.equal(heroicSuccess.levelGain, 4);
  assert.equal(heroicSuccess.afterLevel, 44);
  assert.equal(legendarySuccess.levelGain, 5);
  assert.equal(legendarySuccess.afterLevel, 45);
  assert.equal(cappedSuccess.levelGain, 5);
  assert.equal(cappedSuccess.afterLevel, 95);
});

test('대장장이 멘트는 구간별 3개 풀이 아니라 결과별 큰 공통 풀에서 나온다', () => {
  const cases = [
    {
      result: {
        outcome: 'success',
        mode: 'advanced',
        beforeLevel: 0,
        afterLevel: 5,
        levelGain: 5
      },
      swordName: '바람결에 첫 예기를 드러낸 청동 수호검'
    },
    {
      result: {
        outcome: 'maintain',
        mode: 'normal',
        beforeLevel: 30,
        afterLevel: 30,
        levelGain: 0
      },
      swordName: '전갈자리의 독성과 밤을 품은 흑침검'
    },
    {
      result: {
        outcome: 'destroy',
        mode: 'normal',
        beforeLevel: 80,
        afterLevel: 0,
        levelGain: 0
      },
      swordName: '모든 별자리의 축복을 받은 천궁검'
    }
  ];

  for (const { result, swordName } of cases) {
    const messages = Array.from({ length: 20 }, (_, index) =>
      getBlacksmithEnhancementMessage(result, (index + 0.1) / 20)
    );

    assert.ok(
      new Set(messages).size >= 10,
      `${result.outcome} 멘트 후보가 너무 적다: ${new Set(messages).size}개`
    );
    assert.ok(
      messages.every((message) => message.includes(swordName)),
      `${result.outcome} 멘트에 검 이름이 빠졌다`
    );
  }
});

test('대장장이 멘트는 최근 같은 문장을 바로 반복하지 않는다', () => {
  const originalRandom = Math.random;
  Math.random = () => 0;

  try {
    const result = {
      outcome: 'maintain',
      mode: 'normal',
      beforeLevel: 30,
      afterLevel: 30,
      levelGain: 0
    };
    const messages = [
      getBlacksmithEnhancementMessage(result),
      getBlacksmithEnhancementMessage(result),
      getBlacksmithEnhancementMessage(result)
    ];

    assert.equal(new Set(messages).size, messages.length);
  } finally {
    Math.random = originalRandom;
  }
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
  assert.match(tributeMeta.noTextPolicy, /NO text/);
  assert.doesNotMatch(tributeMeta.prompt, /hisashiburi|long time no see/i);
  assert.equal(
    ImageSize.fromFile(join(process.cwd(), 'assets', 'sword', 'blacksmith', 'blacksmith_hisashiburi.png')),
    '512x512'
  );
  assert.equal(
    ImageSize.fromFile(join(process.cwd(), 'assets', 'sword', 'blacksmith', 'blacksmith_coffin_dance.png')),
    '512x512'
  );
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
  assert.match(replies[0].content, /〖🔥강화 성공🔥 \+0 → \+1〗/);
  assert.match(replies[0].content, /획득 검: \[\+1 도훈검\]/);
  assert.match(replies[0].content, /대장장이/);
  assert.match(replies[0].content, /축하|붙었다|명작|불꽃|번쩍|도훈검|망치|말을 잘 듣/);
  assert.equal(replies[0].files[0].name, 'sword_001.png');
  assert.equal(replies[0].files.some((file) => file.name === 'blacksmith_success.png'), true);
  assert.equal(replies[0].embeds[0].data.image.url, 'attachment://sword_001.png');
  assert.equal(replies[0].embeds[0].data.thumbnail.url, 'attachment://blacksmith_success.png');
});

test('검강화 응답 버튼은 같은 유저가 강화와 판매 흐름을 이어가게 한다', async () => {
  const replies = [];
  const updates = [];
  const interaction = createSwordInteraction({ commandName: '검강화', replies });
  let enhanceCalls = 0;
  const economy = {
    async enhanceSword() {
      enhanceCalls += 1;
      return swordEnhancementResult({ beforeLevel: enhanceCalls - 1, afterLevel: enhanceCalls });
    },
    async getSwordStatus() {
      return swordStatusResult({ level: 12, highestLevel: 12, balance: 5_000 });
    }
  };

  await handleSwordCommand(interaction, economy, silentLogger);

  const components = replies[0].components[0].components;
  assert.deepEqual(components.map((component) => component.data.label), ['검강화', '상급강화', '검판매']);

  const enhanceReplies = [];
  const enhanceButton = createSwordButtonInteraction({
    customId: 'sword_quick:enhance:user-1',
    updates,
    replies: enhanceReplies
  });
  await handleSwordCommand(enhanceButton, economy, silentLogger);

  assert.equal(enhanceCalls, 2);
  assert.equal(updates.length, 0);
  assert.match(enhanceReplies[0].content, /획득 검: \[\+2 /);
  assert.deepEqual(
    enhanceReplies[0].components[0].components.map((component) => component.data.label),
    ['검강화', '상급강화', '검판매']
  );

  const saleButton = createSwordButtonInteraction({
    customId: 'sword_quick:sell:user-1',
    updates,
    replies: []
  });
  await handleSwordCommand(saleButton, economy, silentLogger);

  assert.match(updates[0].content, /검판매 확인/);
  assert.equal(updates[0].components[0].components[0].data.custom_id, 'sword_sell_confirm:user-1');
});

test('검강화 실패 계열 응답은 대장장이 위로와 놀림 메시지를 구분한다', async () => {
  const maintain = await replyWithEnhancementResult(swordEnhancementResult({
    beforeLevel: 3,
    afterLevel: 3,
    outcome: 'maintain',
    roll: 1
  }));
  const destroyed = await replyWithEnhancementResult(swordEnhancementResult({
    beforeLevel: 95,
    afterLevel: 0,
    outcome: 'destroy',
    roll: 100,
    refineStoneReward: 4
  }));

  assert.match(maintain.content, /대장장이/);
  assert.match(maintain.content, /아깝군|거의|망치|재료|기운|검|모루|유지|불꽃|살았다|숨/);
  assert.match(destroyed.content, /대장장이/);
  assert.match(destroyed.content, /미안|재가|터졌|터졌다|터진|산산조각|겁먹|깊게|울지|처음부터|장례식|숯|조문|가루|무너졌|무너질|무너졌다|삼켜졌다|불꽃|아프다|조용|고강화|갈라졌|속철|큰 소리|먹혔다|버티다|화로|그릇|못 웃었다/);
  assert.equal(maintain.files.some((file) => file.name === 'blacksmith_maintain.png'), true);
  assert.equal(destroyed.files.some((file) => file.name === 'blacksmith_destroy.png'), true);
});

test('상급강화 대성공 응답은 제련석과 추가 확률을 게임식 문장으로 보여준다', async () => {
  const reply = await replyWithEnhancementResult(swordEnhancementResult({
    beforeLevel: 0,
    afterLevel: 5,
    mode: 'advanced',
    modeLabel: '상급 강화',
    moneyCost: 2_000,
    stoneCost: 10,
    successRate: 98,
    maintainRate: 2,
    successBonusRate: 3,
    successBonus: {
      rate: 3,
      remainingMs: 4 * 60 * 1000
    }
  }));

  assert.match(reply.content, /〖🌠 상급강화 \+0 → \+5〗/);
  assert.match(reply.content, /사용 제련석: -10개/);
  assert.match(reply.content, /대성공 \+5/);
  assert.match(reply.content, /추가 확률 \+3\.00%p/);
  assert.match(reply.content, /제련석|상급강화|한 번에|여러|치고 올라|계단|대성공/);
});

test('고강화 성공과 파괴도 검 이름이 들어간 공통 멘트를 쓴다', async () => {
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

  assert.match(hundred.content, /희희검/);
  assert.match(funeral.content, /모든 세계선의 왕좌 위에 군림하는 초월검/);
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
  assert.match(replies[0].content, /다음 상급 강화: \*\*\+12 → \+13~\+17\*\*/);
  assert.match(replies[0].content, /보호권: \*\*0개\*\*/);
  assert.match(replies[0].content, /판매 예상가: \*\*1,014골드\*\*/);
  assert.ok(replies[0].content.split('\n').filter((line) => line.trim()).length <= 7);
  assert.equal(replies[0].files[0].name, 'sword_012.png');
});

test('검도감 명령은 최고 강화 기준으로 해금 검과 다음 잠금을 보여준다', async () => {
  const replies = [];
  const interaction = createSwordInteraction({
    commandName: '검도감',
    replies
  });
  const economy = {
    async getSwordStatus() {
      return swordStatusResult({
        level: 37,
        highestLevel: 42,
        refineStones: 4,
        balance: 5_000
      });
    }
  };

  const handled = await handleSwordCommand(interaction, economy, silentLogger);

  assert.equal(handled, true);
  assert.match(replies[0].content, /검도감/);
  assert.match(replies[0].content, /해금: \*\*42\/100\*\*/);
  assert.match(replies[0].content, /현재 검: \*\*\+37 /);
  assert.match(replies[0].content, /최고 해금: \*\*\+42 /);
  assert.match(replies[0].content, /다음 잠금: \*\*\+43 /);
  assert.match(replies[0].content, /최근 해금/);
  assert.equal((replies[0].content.match(/최고 해금/g) ?? []).length, 1);
  assert.ok(replies[0].content.split('\n').filter((line) => line.trim()).length <= 6);
  assert.equal(replies[0].files[0].name, 'sword_042.png');
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
  assert.match(replies[0].content, /<@user-1>/);
  assert.match(replies[0].content, /<@target>/);
  assert.deepEqual(replies[0].allowedMentions, {
    parse: [],
    users: ['user-1', 'target']
  });
  assert.equal(replies[0].components, undefined);
});

test('검 강화와 검배틀은 시즌 포인트를 지급하고 응답에 표시한다', async () => {
  const replies = [];
  const awards = [];
  const seasons = {
    async awardPoints(payload) {
      awards.push(payload);
      return {
        awarded: true,
        capped: false,
        points: payload.points,
        requestedPoints: payload.points,
        totalPoints: awards.reduce((sum, award) => sum + award.points, 0),
        sourceLabel: payload.source === 'sword_enhance' ? '검 강화' : '검배틀 승리',
        newlyClaimableRewards: []
      };
    }
  };
  const interaction = createSwordInteraction({
    commandName: '검강화',
    replies
  });
  const battle = createSwordInteraction({
    commandName: '검배틀',
    replies
  });
  const economy = {
    async enhanceSword() {
      return swordEnhancementResult({
        beforeLevel: 0,
        afterLevel: 1,
        outcome: 'success'
      });
    },
    async playSwordRandomBattle() {
      return {
        ...swordRandomBattleResult(),
        won: true
      };
    }
  };

  await handleSwordCommand(interaction, economy, silentLogger, { seasons });
  await handleSwordCommand(battle, economy, silentLogger, { seasons });

  assert.deepEqual(awards.map((award) => award.source), ['sword_enhance', 'sword_battle_win']);
  assert.match(replies[0].content, /시즌: 검 강화 \+5점/);
  assert.match(replies[1].content, /시즌: 검배틀 승리 \+20점/);
  assert.match(replies[1].content, /상대 유저: <@user-2>/);
  assert.deepEqual(replies[1].allowedMentions, {
    parse: [],
    users: ['user-1', 'user-2']
  });
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
    assert.equal(advanced.levelGain, 5);
    assert.equal(advanced.profile.sword.level, 6);
    assert.equal(advanced.profile.sword.refineStones, 0);
    assert.equal(advanced.profile.sword.advancedAttempts, 1);
    assert.equal(advanced.profile.sword.highestLevel, 6);
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

test('일반 강화 파괴는 짧은 시간 동안 다른 유저에게 랜덤 성공 추가 확률을 만든다', async () => {
  const fixture = await createFixture({ randomInt: sequenceRandom([100, 275, 64]) });

  try {
    await seedProfile(fixture.store, {
      userId: 'user-1',
      username: '파괴러',
      balance: 20_000,
      sword: { level: 95, highestLevel: 95, refineStones: 0 }
    });
    await seedProfile(fixture.store, {
      userId: 'user-2',
      username: '수혜자',
      balance: 20_000,
      sword: { level: 40, highestLevel: 40, refineStones: 0 }
    });

    const destroyed = await fixture.economy.enhanceSword({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '파괴러',
      now: 10_000
    });
    const sourceStatus = await fixture.economy.getSwordStatus({
      guildId: 'guild-1',
      userId: 'user-1',
      username: '파괴러',
      now: 11_000
    });
    const receiverStatus = await fixture.economy.getSwordStatus({
      guildId: 'guild-1',
      userId: 'user-2',
      username: '수혜자',
      now: 11_000
    });
    const boosted = await fixture.economy.enhanceSword({
      guildId: 'guild-1',
      userId: 'user-2',
      username: '수혜자',
      now: 11_000
    });
    const expiredStatus = await fixture.economy.getSwordStatus({
      guildId: 'guild-1',
      userId: 'user-2',
      username: '수혜자',
      now: 10_000 + SWORD_DESTRUCTION_SUCCESS_BONUS_DURATION_MS + 1
    });

    assert.equal(destroyed.outcome, 'destroy');
    assert.equal(destroyed.triggeredSuccessBonus.rate, 2.75);
    assert.equal(destroyed.triggeredSuccessBonus.durationMs, SWORD_DESTRUCTION_SUCCESS_BONUS_DURATION_MS);
    assert.equal(sourceStatus.successBonus, null);
    assert.equal(receiverStatus.successBonus.rate, 2.75);
    assert.equal(receiverStatus.normalEnhance.successBonusRate, 2.75);
    assert.equal(boosted.successBonusRate, 2.75);
    assert.equal(boosted.baseSuccessRate, 62);
    assert.equal(boosted.successRate, 64.75);
    assert.equal(boosted.outcome, 'success');
    assert.equal(boosted.profile.sword.level, 41);
    assert.equal(expiredStatus.successBonus, null);
    assert.equal(expiredStatus.normalEnhance.successBonusRate, 0);
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
    await seedProfile(fixture.store, {
      userId: 'user-2',
      username: '랜덤상대',
      balance: 0,
      level: 1,
      sword: { level: 0, highestLevel: 0 }
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
      assert.equal(last.opponent.userId, 'user-2');
      assert.equal(last.opponent.username, '랜덤상대');
      assert.equal(last.opponent.npc, false);
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

function sequenceRandom(values) {
  const queue = [...values];
  return () => {
    if (queue.length === 0) throw new Error('sequenceRandom queue exhausted');
    return queue.shift();
  };
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
  refineStoneReward = 0,
  mode = 'normal',
  modeLabel = mode === 'advanced' ? '상급 강화' : '일반 강화',
  moneyCost = 100,
  stoneCost = 0,
  successRate = 100,
  maintainRate = 0,
  destroyRate = 0,
  successBonusRate = 0,
  successBonus = null,
  triggeredSuccessBonus = null
}) {
  const levelGain = outcome === 'success'
    ? Math.max(0, afterLevel - beforeLevel)
    : 0;
  return {
    min: 0,
    max: 4,
    level: beforeLevel,
    targetLevel: beforeLevel + 1,
    maxTargetLevel: Math.max(beforeLevel + 1, afterLevel),
    mode,
    modeLabel,
    blocked: false,
    successRate,
    maintainRate,
    destroyRate,
    baseSuccessRate: successRate - successBonusRate,
    baseMaintainRate: maintainRate + successBonusRate,
    baseDestroyRate: destroyRate,
    successBonusRate,
    successBonus,
    triggeredSuccessBonus,
    moneyCost,
    stoneCost,
    beforeLevel,
    afterLevel,
    levelGain,
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

function swordRandomBattleResult() {
  return {
    battled: true,
    type: 'random',
    won: true,
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
    opponent: {
      userId: 'user-2',
      username: '랜덤상대',
      level: 1,
      sword: {
        level: 0
      }
    },
    rewards: {
      xp: 20,
      money: 50,
      refineStones: 1
    },
    remainingBattles: 9,
    leveledUp: false,
    levelReward: 0,
    profile: {
      userId: 'user-1',
      username: '검사',
      level: 1,
      balance: 50,
      sword: {
        level: 1,
        battleWins: 1,
        battleLosses: 0
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

const ImageSize = {
  fromFile(path) {
    const buffer = readFileSync(path);
    return `${buffer.readUInt32BE(16)}x${buffer.readUInt32BE(20)}`;
  }
};
