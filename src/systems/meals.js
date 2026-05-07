const NEIS_MEAL_ENDPOINT = 'https://open.neis.go.kr/hub/mealServiceDietInfo';
const KOREA_TIME_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const INCHEON_SCIENCE_HIGH_SCHOOL = Object.freeze({
  name: '인천과학고등학교',
  educationOfficeCode: 'E10',
  schoolCode: '7310058'
});

export class MealService {
  constructor({
    store = null,
    fetchFn = globalThis.fetch,
    apiKey = null,
    now = () => Date.now()
  } = {}) {
    if (typeof fetchFn !== 'function') {
      throw new Error('급식 정보를 불러오려면 fetch 함수가 필요합니다.');
    }

    this.store = store;
    this.fetchFn = fetchFn;
    this.apiKey = apiKey;
    this.now = now;
  }

  async getTodayMeals() {
    return this.getDailyMeals({
      date: formatKoreaDate(this.now())
    });
  }

  async getDailyMeals({ date = formatKoreaDate(this.now()) } = {}) {
    const mealDate = normalizeMealDate(date);
    const response = await this.fetchFn(buildNeisMealUrl({
      date: mealDate,
      apiKey: this.apiKey
    }));

    if (!response.ok) {
      throw new Error(`나이스 급식 API 요청 실패 (${response.status})`);
    }

    return parseNeisMealResponse(await response.json(), mealDate);
  }

  async setAutoAnnouncementChannel(guildId, channelId) {
    assertStoreConfigured(this.store);
    return this.store.update((data) => {
      const settings = getOrCreateMealSettings(data, guildId);
      settings.autoAnnouncementChannelId = channelId;
      return cloneMealSettings(settings);
    });
  }

  async disableAutoAnnouncement(guildId) {
    assertStoreConfigured(this.store);
    return this.store.update((data) => {
      const settings = getOrCreateMealSettings(data, guildId);
      settings.autoAnnouncementChannelId = null;
      return cloneMealSettings(settings);
    });
  }

  async getAutoAnnouncementSettings(guildId) {
    assertStoreConfigured(this.store);
    const data = await this.store.load();
    return cloneMealSettings(getOrCreateMealSettings(data, guildId));
  }

  async listAutoAnnouncementTargets() {
    assertStoreConfigured(this.store);
    const data = await this.store.load();
    return Object.entries(data.guilds ?? {})
      .map(([guildId, guild]) => ({
        guildId,
        channelId: guild.meals?.settings?.autoAnnouncementChannelId ?? null
      }))
      .filter((target) => target.channelId);
  }
}

export function buildNeisMealUrl({
  date,
  apiKey = null,
  school = INCHEON_SCIENCE_HIGH_SCHOOL
}) {
  const url = new URL(NEIS_MEAL_ENDPOINT);

  if (apiKey) {
    url.searchParams.set('KEY', apiKey);
  }

  url.searchParams.set('Type', 'json');
  url.searchParams.set('pIndex', '1');
  url.searchParams.set('pSize', '100');
  url.searchParams.set('ATPT_OFCDC_SC_CODE', school.educationOfficeCode);
  url.searchParams.set('SD_SCHUL_CODE', school.schoolCode);
  url.searchParams.set('MLSV_YMD', normalizeMealDate(date));

  return url.toString();
}

export function parseNeisMealResponse(data, date) {
  const result = data?.RESULT
    ?? data?.mealServiceDietInfo?.[0]?.head?.find((entry) => entry.RESULT)?.RESULT
    ?? null;

  if (result && result.CODE !== 'INFO-000') {
    if (result.CODE === 'INFO-200') {
      return createMealResult(date, []);
    }

    throw new Error(result.MESSAGE || `나이스 급식 API 오류: ${result.CODE}`);
  }

  const rows = data?.mealServiceDietInfo?.[1]?.row ?? [];

  if (!Array.isArray(rows)) {
    return createMealResult(date, []);
  }

  const meals = rows
    .map((row) => ({
      mealCode: row.MMEAL_SC_CODE,
      mealName: row.MMEAL_SC_NM,
      dishes: splitNeisHtmlLines(row.DDISH_NM),
      calories: cleanText(row.CAL_INFO),
      nutrition: splitNeisHtmlLines(row.NTR_INFO),
      servedPeople: Number(row.MLSV_FGR) || 0
    }))
    .sort((a, b) => Number(a.mealCode) - Number(b.mealCode));

  return createMealResult(date, meals);
}

export function formatKoreaDate(date = Date.now()) {
  const timestamp = date instanceof Date ? date.getTime() : Number(date);
  const koreaDate = new Date(timestamp + KOREA_TIME_OFFSET_MS);
  const year = koreaDate.getUTCFullYear();
  const month = String(koreaDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(koreaDate.getUTCDate()).padStart(2, '0');

  return `${year}${month}${day}`;
}

export function formatDisplayDate(date) {
  const normalized = normalizeMealDate(date);
  return `${normalized.slice(0, 4)}-${normalized.slice(4, 6)}-${normalized.slice(6, 8)}`;
}

export function getNextKoreaMidnightDelay(now = Date.now()) {
  const timestamp = now instanceof Date ? now.getTime() : Number(now);
  const koreaTimestamp = timestamp + KOREA_TIME_OFFSET_MS;
  const nextKoreaDayStart = (Math.floor(koreaTimestamp / DAY_MS) + 1) * DAY_MS;

  return nextKoreaDayStart - koreaTimestamp;
}

export function scheduleDailyMealAnnouncements({
  sendAnnouncement,
  now = () => Date.now(),
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
  logger = console
}) {
  let timer = null;
  let stopped = false;

  const scheduleNext = () => {
    timer = setTimeoutFn(async () => {
      if (stopped) return;

      try {
        await sendAnnouncement();
      } catch (error) {
        logger.error('Failed to send daily meal announcement:', error);
      }

      if (!stopped) {
        scheduleNext();
      }
    }, getNextKoreaMidnightDelay(now()));

    if (timer && typeof timer.unref === 'function') {
      timer.unref();
    }
  };

  scheduleNext();

  return () => {
    stopped = true;
    if (timer) {
      clearTimeoutFn(timer);
    }
  };
}

function createMealResult(date, meals) {
  return {
    school: INCHEON_SCIENCE_HIGH_SCHOOL,
    date: normalizeMealDate(date),
    meals
  };
}

function getOrCreateMealSettings(data, guildId) {
  data.guilds ??= {};
  data.guilds[guildId] ??= {};
  data.guilds[guildId].meals ??= {};
  data.guilds[guildId].meals.settings = {
    autoAnnouncementChannelId: null,
    ...data.guilds[guildId].meals.settings
  };

  return data.guilds[guildId].meals.settings;
}

function cloneMealSettings(settings) {
  return {
    autoAnnouncementChannelId: settings.autoAnnouncementChannelId ?? null
  };
}

function assertStoreConfigured(store) {
  if (!store) {
    throw new Error('급식 자동 알림 설정 저장소가 준비되지 않았습니다.');
  }
}

function normalizeMealDate(date) {
  if (date instanceof Date) {
    return formatKoreaDate(date);
  }

  const normalized = String(date ?? '').replaceAll('-', '');

  if (!/^\d{8}$/.test(normalized)) {
    throw new Error('급식 날짜는 YYYYMMDD 형식이어야 합니다.');
  }

  return normalized;
}

function splitNeisHtmlLines(value) {
  return String(value ?? '')
    .split(/<br\s*\/?>/i)
    .map(cleanText)
    .filter(Boolean);
}

function cleanText(value) {
  return decodeHtmlEntities(String(value ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim());
}

function decodeHtmlEntities(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'");
}
