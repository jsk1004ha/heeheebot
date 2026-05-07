import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createSqliteStore } from '../src/storage/sqlite-store.js';
import {
  formatMealMessage,
  getMealCommandPayloads,
  handleMealCommand
} from '../src/commands/meals.js';
import {
  INCHEON_SCIENCE_HIGH_SCHOOL,
  MealService,
  buildNeisMealUrl,
  formatKoreaDate,
  getNextKoreaMidnightDelay,
  parseNeisMealResponse,
  scheduleDailyMealAnnouncements
} from '../src/systems/meals.js';

test('급식 명령 payload는 /급식을 등록한다', () => {
  const payloads = getMealCommandPayloads();
  const mealPayload = payloads.find((payload) => payload.name === '급식');
  const autoMealPayload = payloads.find((payload) => payload.name === '자동급식');

  assert.ok(mealPayload);
  assert.ok(autoMealPayload);
  assert.match(mealPayload.description, /인천과학고등학교/);
  assert.deepEqual(autoMealPayload.options.map((option) => option.name), ['설정', '해제', '상태']);
});

test('나이스 급식 URL은 인천과학고등학교 코드로 고정된다', () => {
  const url = new URL(buildNeisMealUrl({
    date: '20260507',
    apiKey: 'test-key'
  }));

  assert.equal(url.origin + url.pathname, 'https://open.neis.go.kr/hub/mealServiceDietInfo');
  assert.equal(url.searchParams.get('KEY'), 'test-key');
  assert.equal(url.searchParams.get('Type'), 'json');
  assert.equal(url.searchParams.get('ATPT_OFCDC_SC_CODE'), 'E10');
  assert.equal(url.searchParams.get('SD_SCHUL_CODE'), '7310058');
  assert.equal(url.searchParams.get('MLSV_YMD'), '20260507');
  assert.equal(INCHEON_SCIENCE_HIGH_SCHOOL.name, '인천과학고등학교');
});

test('급식 서비스는 한국 날짜로 오늘 식단을 조회하고 식사 순서대로 정리한다', async () => {
  let requestedUrl = null;
  const service = new MealService({
    now: () => Date.parse('2026-05-06T15:30:00Z'),
    fetchFn: async (url) => {
      requestedUrl = new URL(url);
      return {
        ok: true,
        async json() {
          return createMealApiResponse();
        }
      };
    }
  });

  const result = await service.getTodayMeals();

  assert.equal(requestedUrl.searchParams.get('MLSV_YMD'), '20260507');
  assert.equal(result.date, '20260507');
  assert.deepEqual(result.meals.map((meal) => meal.mealName), ['조식', '중식']);
  assert.deepEqual(result.meals[0].dishes, ['토스트 & 우유 (1.2.5.6)', '사과']);
  assert.equal(result.meals[1].calories, '700 Kcal');
});

test('급식 메시지는 조식/중식/석식 섹션과 메뉴를 표시한다', () => {
  const message = formatMealMessage(parseNeisMealResponse(createMealApiResponse(), '20260507'));

  assert.match(message, /인천과학고등학교 급식/);
  assert.match(message, /2026-05-07/);
  assert.match(message, /\*\*조식\*\* \/ 500 Kcal/);
  assert.match(message, /- 토스트 & 우유/);
  assert.match(message, /\*\*중식\*\* \/ 700 Kcal/);
  assert.match(message, /알레르기/);
});

test('급식 명령 핸들러는 오늘 급식 응답을 반환한다', async () => {
  const interaction = createInteraction('급식');
  const handled = await handleMealCommand(interaction, {
    async getTodayMeals() {
      return parseNeisMealResponse(createMealApiResponse(), '20260507');
    }
  });

  assert.equal(handled, true);
  assert.match(interaction.replies[0], /인천과학고등학교 급식/);
  assert.match(interaction.replies[0], /볶음밥/);
});

test('자동급식 명령은 서버별 알림 채널을 설정, 확인, 해제한다', async () => {
  const fixture = await createFixture();

  try {
    const setInteraction = createInteraction('자동급식', {
      guildId: 'guild-1',
      subcommand: '설정',
      channel: { id: 'channel-1' }
    });
    const statusInteraction = createInteraction('자동급식', {
      guildId: 'guild-1',
      subcommand: '상태'
    });
    const unsetInteraction = createInteraction('자동급식', {
      guildId: 'guild-1',
      subcommand: '해제'
    });

    await handleMealCommand(setInteraction, fixture.meals);
    assert.match(setInteraction.replies[0], /<#channel-1>/);
    assert.deepEqual(await fixture.meals.listAutoAnnouncementTargets(), [
      { guildId: 'guild-1', channelId: 'channel-1' }
    ]);

    await handleMealCommand(statusInteraction, fixture.meals);
    assert.equal(statusInteraction.replies[0].ephemeral, true);
    assert.match(statusInteraction.replies[0].content, /<#channel-1>/);

    await handleMealCommand(unsetInteraction, fixture.meals);
    assert.match(unsetInteraction.replies[0], /해제/);
    assert.deepEqual(await fixture.meals.listAutoAnnouncementTargets(), []);
  } finally {
    await fixture.cleanup();
  }
});

test('자동급식 설정은 서버별로 저장된다', async () => {
  const fixture = await createFixture();

  try {
    await fixture.meals.setAutoAnnouncementChannel('guild-1', 'channel-1');
    await fixture.meals.setAutoAnnouncementChannel('guild-2', 'channel-2');

    assert.deepEqual(await fixture.meals.getAutoAnnouncementSettings('guild-1'), {
      autoAnnouncementChannelId: 'channel-1'
    });
    assert.deepEqual(await fixture.meals.listAutoAnnouncementTargets(), [
      { guildId: 'guild-1', channelId: 'channel-1' },
      { guildId: 'guild-2', channelId: 'channel-2' }
    ]);

    await fixture.meals.disableAutoAnnouncement('guild-1');
    assert.deepEqual(await fixture.meals.listAutoAnnouncementTargets(), [
      { guildId: 'guild-2', channelId: 'channel-2' }
    ]);
  } finally {
    await fixture.cleanup();
  }
});

test('급식 데이터가 없으면 빈 급식 결과로 처리한다', () => {
  const result = parseNeisMealResponse({
    RESULT: {
      CODE: 'INFO-200',
      MESSAGE: '해당하는 데이터가 없습니다.'
    }
  }, '20260507');

  assert.deepEqual(result.meals, []);
  assert.match(formatMealMessage(result), /등록된 급식 정보가 없습니다/);
});

test('한국시간 날짜와 다음 자정까지 남은 시간을 계산한다', () => {
  assert.equal(formatKoreaDate(Date.parse('2026-05-06T15:00:00Z')), '20260507');
  assert.equal(getNextKoreaMidnightDelay(Date.parse('2026-05-06T14:59:30Z')), 30_000);
  assert.equal(getNextKoreaMidnightDelay(Date.parse('2026-05-06T15:00:00Z')), 24 * 60 * 60 * 1000);
});

test('급식 자동 알림 스케줄러는 자정마다 전송 작업을 예약한다', async () => {
  const scheduled = [];
  const cleared = [];
  let sent = 0;

  const stop = scheduleDailyMealAnnouncements({
    now: () => Date.parse('2026-05-06T14:59:30Z'),
    setTimeoutFn: (callback, delayMs) => {
      const timer = { callback, delayMs };
      scheduled.push(timer);
      return timer;
    },
    clearTimeoutFn: (timer) => {
      cleared.push(timer);
    },
    async sendAnnouncement() {
      sent += 1;
    }
  });

  assert.equal(scheduled[0].delayMs, 30_000);

  await scheduled[0].callback();

  assert.equal(sent, 1);
  assert.equal(scheduled.length, 2);

  stop();

  assert.deepEqual(cleared, [scheduled[1]]);
});

function createMealApiResponse() {
  return {
    mealServiceDietInfo: [
      {
        head: [
          { list_total_count: 2 },
          {
            RESULT: {
              CODE: 'INFO-000',
              MESSAGE: '정상 처리되었습니다.'
            }
          }
        ]
      },
      {
        row: [
          {
            MMEAL_SC_CODE: '2',
            MMEAL_SC_NM: '중식',
            DDISH_NM: '볶음밥<br/>시금치국 (5.6)',
            CAL_INFO: '700 Kcal',
            NTR_INFO: '탄수화물(g) : 1<br/>단백질(g) : 2',
            MLSV_FGR: 250
          },
          {
            MMEAL_SC_CODE: '1',
            MMEAL_SC_NM: '조식',
            DDISH_NM: '토스트 &amp; 우유 (1.2.5.6)<br/>사과',
            CAL_INFO: '500 Kcal',
            NTR_INFO: '탄수화물(g) : 3<br/>단백질(g) : 4',
            MLSV_FGR: 190
          }
        ]
      }
    ]
  };
}

async function createFixture() {
  const directory = await mkdtemp(join(tmpdir(), 'heeheebot-meals-'));
  const store = createSqliteStore(join(directory, 'profiles.sqlite'));
  const meals = new MealService({
    store,
    fetchFn: async () => ({
      ok: true,
      async json() {
        return createMealApiResponse();
      }
    })
  });

  return {
    meals,
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

function createInteraction(commandName, {
  guildId = 'guild-1',
  subcommand = null,
  channel = null
} = {}) {
  return {
    commandName,
    guildId,
    replies: [],
    isChatInputCommand() {
      return true;
    },
    inGuild() {
      return Boolean(guildId);
    },
    options: {
      getSubcommand() {
        return subcommand;
      },
      getChannel() {
        return channel;
      }
    },
    async reply(message) {
      this.replies.push(message);
    }
  };
}
