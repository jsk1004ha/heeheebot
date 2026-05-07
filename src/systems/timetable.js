const COMCIGAN_TIMETABLE_ENDPOINT = 'http://comci.net:4082/36179';
const DEFAULT_PREVIOUS_STAMP = '0';
const DEFAULT_REVISION = 1;
const DEFAULT_SPLIT_FACTOR = 100;
const DEFAULT_PERIOD_COUNT = 8;
const MAX_PERIOD_COUNT = 12;

export const WEEK_DAYS = Object.freeze(['월', '화', '수', '목', '금']);

export const INCHEON_SCIENCE_HIGH_COMCIGAN_SCHOOL = Object.freeze({
  id: 86416,
  region: '인천',
  name: '인천과학고등학교'
});

export class TimetableService {
  constructor({
    fetchFn = globalThis.fetch,
    school = INCHEON_SCIENCE_HIGH_COMCIGAN_SCHOOL
  } = {}) {
    if (typeof fetchFn !== 'function') {
      throw new Error('시간표 정보를 불러오려면 fetch 함수가 필요합니다.');
    }

    this.fetchFn = fetchFn;
    this.school = school;
  }

  async getTimetable({
    grade,
    classNumber,
    previousStamp = DEFAULT_PREVIOUS_STAMP,
    revision = DEFAULT_REVISION
  } = {}) {
    const request = normalizeTimetableRequest({ grade, classNumber });
    const response = await this.fetchFn(buildComciganTimetableUrl({
      schoolId: this.school.id,
      previousStamp,
      revision
    }));

    if (!response.ok) {
      throw new Error(`컴시간 시간표 요청 실패 (${response.status})`);
    }

    const text = await readResponseText(response);
    const data = parseComciganJson(text);

    return parseComciganTimetable(data, {
      ...request,
      school: this.school
    });
  }
}

export function buildComciganTimetableUrl({
  schoolId = INCHEON_SCIENCE_HIGH_COMCIGAN_SCHOOL.id,
  previousStamp = DEFAULT_PREVIOUS_STAMP,
  revision = DEFAULT_REVISION
} = {}) {
  const token = Buffer
    .from(`73629_${schoolId}_${previousStamp}_${revision}`, 'utf8')
    .toString('base64');
  const url = new URL(COMCIGAN_TIMETABLE_ENDPOINT);
  url.search = token;
  return url.toString();
}

export function parseComciganJson(text) {
  const raw = String(text ?? '');
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');

  if (start === -1 || end === -1 || end < start) {
    throw new Error('컴시간 응답에서 JSON 데이터를 찾을 수 없습니다.');
  }

  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch (error) {
    throw new Error(`컴시간 JSON 파싱 실패: ${error.message}`);
  }
}

export function parseComciganTimetable(data, {
  grade,
  classNumber,
  school = INCHEON_SCIENCE_HIGH_COMCIGAN_SCHOOL
} = {}) {
  const request = normalizeTimetableRequest({ grade, classNumber });
  const availableClassCount = getAvailableClassCount(data, request.grade);

  if (availableClassCount < request.classNumber) {
    throw new Error(`${school.name} ${request.grade}학년 ${request.classNumber}반 시간표가 없습니다. 선택 가능한 반: 1~${availableClassCount}`);
  }

  const timetable = Object.fromEntries(WEEK_DAYS.map((dayName, index) => [
    dayName,
    decodeComciganDay(data, {
      grade: request.grade,
      classNumber: request.classNumber,
      dayIndex: index + 1
    })
  ]));

  return {
    school,
    grade: request.grade,
    classNumber: request.classNumber,
    className: `${request.grade}-${request.classNumber}`,
    weekStartDate: cleanComciganText(data?.시작일) || null,
    updatedAt: cleanComciganText(data?.자료244) || null,
    timetable
  };
}

export function decodeComciganSlot(rawSlot, data) {
  const slot = normalizeSlotValue(rawSlot);

  if (slot <= DEFAULT_SPLIT_FACTOR) {
    return null;
  }

  const splitFactor = getSplitFactor(data);
  const teacherIndex = splitFactor === DEFAULT_SPLIT_FACTOR
    ? Math.floor(slot / splitFactor)
    : slot % splitFactor;
  const rawSubjectIndex = splitFactor === DEFAULT_SPLIT_FACTOR
    ? slot % splitFactor
    : Math.floor(slot / splitFactor);
  const subjectIndex = rawSubjectIndex % splitFactor;

  return {
    slot,
    subjectIndex,
    teacherIndex,
    subject: cleanComciganText(data?.자료492?.[subjectIndex] ?? data?.자료492?.[rawSubjectIndex]) || '미지정 과목',
    teacher: cleanComciganText(data?.자료446?.[teacherIndex]) || null
  };
}

function decodeComciganDay(data, { grade, classNumber, dayIndex }) {
  const dailyDay = data?.자료147?.[grade]?.[classNumber]?.[dayIndex] ?? [];
  const originalDay = data?.자료481?.[grade]?.[classNumber]?.[dayIndex] ?? [];
  const periodCount = getPeriodCount(data, {
    grade,
    dayIndex,
    dailyDay,
    originalDay
  });

  return Array.from({ length: periodCount }, (_, index) => {
    const period = index + 1;
    const dailySlot = dailyDay?.[period] ?? 0;
    const originalSlot = originalDay?.[period] ?? 0;
    const decoded = decodeComciganSlot(dailySlot, data);

    return {
      period,
      label: getPeriodLabel(data, period),
      subject: decoded?.subject ?? null,
      teacher: decoded?.teacher ?? null,
      changed: Boolean(decoded) && normalizeSlotValue(dailySlot) !== normalizeSlotValue(originalSlot),
      empty: !decoded
    };
  });
}

function normalizeTimetableRequest({ grade, classNumber }) {
  const normalizedGrade = Number(grade);
  const normalizedClassNumber = Number(classNumber);

  if (!Number.isInteger(normalizedGrade) || normalizedGrade < 1 || normalizedGrade > 3) {
    throw new Error('학년은 1~3 사이의 정수여야 합니다.');
  }

  if (!Number.isInteger(normalizedClassNumber) || normalizedClassNumber < 1) {
    throw new Error('반은 1 이상의 정수여야 합니다.');
  }

  return {
    grade: normalizedGrade,
    classNumber: normalizedClassNumber
  };
}

function getAvailableClassCount(data, grade) {
  const declaredClassCount = Number(data?.학급수?.[grade]) || 0;
  const virtualClassCount = Number(data?.가상학급수?.[grade]) || 0;
  const actualClassCount = Math.max(0, declaredClassCount - virtualClassCount);

  if (actualClassCount > 0) {
    return actualClassCount;
  }

  const gradeTimetables = data?.자료147?.[grade] ?? data?.자료481?.[grade] ?? [];
  return Math.max(0, gradeTimetables.length - 1);
}

function getPeriodCount(data, { grade, dayIndex, dailyDay, originalDay }) {
  const declared = Number(data?.요일별시수?.[grade]?.[dayIndex])
    || Number(data?.요일별시수?.[dayIndex])
    || 0;
  const timeLabelCount = Array.isArray(data?.일과시간) ? data.일과시간.length : 0;
  const arrayPeriodCount = Math.max(
    Array.isArray(dailyDay) ? dailyDay.length - 1 : 0,
    Array.isArray(originalDay) ? originalDay.length - 1 : 0
  );

  return Math.min(
    MAX_PERIOD_COUNT,
    Math.max(1, declared, timeLabelCount, arrayPeriodCount, DEFAULT_PERIOD_COUNT)
  );
}

function getPeriodLabel(data, period) {
  return cleanComciganText(data?.일과시간?.[period - 1]) || `${period}교시`;
}

function getSplitFactor(data) {
  const splitFactor = Number(data?.분리) || DEFAULT_SPLIT_FACTOR;
  return splitFactor > 0 ? splitFactor : DEFAULT_SPLIT_FACTOR;
}

function normalizeSlotValue(value) {
  return Number(value) || 0;
}

function cleanComciganText(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function readResponseText(response) {
  if (typeof response.text === 'function') {
    return response.text();
  }

  if (typeof response.arrayBuffer === 'function') {
    return new TextDecoder('utf-8').decode(await response.arrayBuffer());
  }

  throw new Error('컴시간 응답 본문을 읽을 수 없습니다.');
}
