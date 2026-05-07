import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatTimetableMessage,
  getTimetableCommandPayloads,
  handleTimetableCommand
} from '../src/commands/timetable.js';
import {
  INCHEON_SCIENCE_HIGH_COMCIGAN_SCHOOL,
  TimetableService,
  buildComciganTimetableUrl,
  decodeComciganSlot,
  parseComciganJson,
  parseComciganTimetable
} from '../src/systems/timetable.js';

test('시간표 명령 payload는 /시간표와 학년/반/요일 옵션을 등록한다', () => {
  const payloads = getTimetableCommandPayloads();
  const timetablePayload = payloads.find((payload) => payload.name === '시간표');

  assert.ok(timetablePayload);
  assert.match(timetablePayload.description, /인천과학고등학교/);

  const [grade, classNumber, weekday] = timetablePayload.options;
  assert.equal(grade.name, '학년');
  assert.equal(grade.required, true);
  assert.equal(grade.min_value, 1);
  assert.equal(grade.max_value, 3);
  assert.equal(classNumber.name, '반');
  assert.equal(classNumber.required, true);
  assert.equal(classNumber.min_value, 1);
  assert.equal(weekday.name, '요일');
  assert.deepEqual(weekday.choices.map((choice) => choice.value), ['all', '월', '화', '수', '목', '금']);
});

test('컴시간 시간표 URL은 인천과학고등학교 id로 base64 토큰을 만든다', () => {
  const url = new URL(buildComciganTimetableUrl());

  assert.equal(url.origin + url.pathname, 'http://comci.net:4082/36179');
  assert.equal(url.search.slice(1), 'NzM2MjlfODY0MTZfMF8x');
  assert.equal(INCHEON_SCIENCE_HIGH_COMCIGAN_SCHOOL.id, 86416);
  assert.equal(INCHEON_SCIENCE_HIGH_COMCIGAN_SCHOOL.name, '인천과학고등학교');
});

test('컴시간 JSON 파서는 뒤에 붙은 패딩 문자를 무시한다', () => {
  assert.deepEqual(parseComciganJson('xx {"학교명":"인천과학고등학교"}\u0000\u0000'), {
    학교명: '인천과학고등학교'
  });
  assert.throws(() => parseComciganJson('no json here'), /JSON 데이터를 찾을 수 없습니다/);
});

test('컴시간 슬롯은 과목과 교사로 디코딩된다', () => {
  const fixture = createComciganFixture();

  assert.deepEqual(decodeComciganSlot(101, fixture), {
    slot: 101,
    subjectIndex: 1,
    teacherIndex: 1,
    subject: '국어',
    teacher: '김옙*'
  });
  assert.equal(decodeComciganSlot(0, fixture), null);
});

test('컴시간 시간표는 학년/반별 요일과 변경 여부를 해석한다', () => {
  const result = parseComciganTimetable(createComciganFixture(), {
    grade: 1,
    classNumber: 1
  });

  assert.equal(result.school.name, '인천과학고등학교');
  assert.equal(result.className, '1-1');
  assert.equal(result.weekStartDate, '2026-05-04');
  assert.equal(result.updatedAt, '2026-05-07 08:50:22');
  assert.deepEqual(result.timetable.월.slice(0, 3), [
    {
      period: 1,
      label: '1교시',
      subject: '국어',
      teacher: '김옙*',
      changed: false,
      empty: false
    },
    {
      period: 2,
      label: '2교시',
      subject: '수학',
      teacher: '박몽*',
      changed: true,
      empty: false
    },
    {
      period: 3,
      label: '3교시',
      subject: null,
      teacher: null,
      changed: false,
      empty: true
    }
  ]);
  assert.equal(result.timetable.화[0].subject, '영어');
});

test('컴시간 시간표는 없는 반을 거부한다', () => {
  assert.throws(() => parseComciganTimetable(createComciganFixture(), {
    grade: 1,
    classNumber: 3
  }), /1학년 3반 시간표가 없습니다. 선택 가능한 반: 1~2/);
});

test('시간표 서비스는 fetch 결과를 읽어 시간표로 변환한다', async () => {
  let requestedUrl = null;
  const service = new TimetableService({
    fetchFn: async (url) => {
      requestedUrl = new URL(url);
      return {
        ok: true,
        status: 200,
        async text() {
          return `${JSON.stringify(createComciganFixture())}\u0000\u0000`;
        }
      };
    }
  });

  const result = await service.getTimetable({ grade: 1, classNumber: 1 });

  assert.equal(requestedUrl.search.slice(1), 'NzM2MjlfODY0MTZfMF8x');
  assert.equal(result.className, '1-1');
  assert.equal(result.timetable.월[1].subject, '수학');
});

test('시간표 메시지는 전체 요일과 변경 표시를 출력한다', () => {
  const result = parseComciganTimetable(createComciganFixture(), {
    grade: 1,
    classNumber: 1
  });
  const message = formatTimetableMessage(result);

  assert.match(message, /인천과학고등학교 1-1 시간표/);
  assert.match(message, /시작일: 2026-05-04/);
  assert.match(message, /갱신: 2026-05-07 08:50:22/);
  assert.match(message, /\*\*월\*\*/);
  assert.match(message, /1교시: 국어 \(김옙\*\)/);
  assert.match(message, /2교시: 수학 \(박몽\*\) 🔁/);
  assert.match(message, /\*\*금\*\*/);
  assert.match(message, /🔁 표시/);
});

test('시간표 메시지는 특정 요일만 출력할 수 있다', () => {
  const result = parseComciganTimetable(createComciganFixture(), {
    grade: 1,
    classNumber: 1
  });
  const message = formatTimetableMessage(result, { weekday: '화' });

  assert.match(message, /\*\*화\*\*/);
  assert.match(message, /영어/);
  assert.doesNotMatch(message, /\*\*월\*\*/);
  assert.doesNotMatch(message, /국어/);
});

test('시간표 명령 핸들러는 학년/반을 조회해 응답한다', async () => {
  const interaction = createInteraction({
    integers: { 학년: 1, 반: 1 },
    strings: { 요일: '월' }
  });
  const handled = await handleTimetableCommand(interaction, {
    async getTimetable(request) {
      assert.deepEqual(request, { grade: 1, classNumber: 1 });
      return parseComciganTimetable(createComciganFixture(), request);
    }
  });

  assert.equal(handled, true);
  assert.match(interaction.replies[0], /인천과학고등학교 1-1 시간표/);
  assert.match(interaction.replies[0], /국어/);
  assert.doesNotMatch(interaction.replies[0], /영어/);
});

test('시간표 명령 핸들러는 deferReply를 지원하면 먼저 defer 후 editReply한다', async () => {
  const interaction = createInteraction({
    supportsDefer: true
  });
  const handled = await handleTimetableCommand(interaction, {
    async getTimetable(request) {
      assert.equal(interaction.deferred, true);
      return parseComciganTimetable(createComciganFixture(), request);
    }
  });

  assert.equal(handled, true);
  assert.equal(interaction.deferCount, 1);
  assert.equal(interaction.replies.length, 0);
  assert.match(interaction.edits[0], /인천과학고등학교 1-1 시간표/);
});

test('시간표 명령 핸들러는 오류를 ephemeral 응답으로 돌려준다', async () => {
  const interaction = createInteraction();
  const handled = await handleTimetableCommand(interaction, {
    async getTimetable() {
      throw new Error('테스트 실패');
    }
  });

  assert.equal(handled, true);
  assert.equal(interaction.replies[0].ephemeral, true);
  assert.match(interaction.replies[0].content, /테스트 실패/);
});

function createComciganFixture() {
  const daily = createGrid();
  const original = createGrid();

  daily[1][1][1][1] = 101;
  original[1][1][1][1] = 101;
  daily[1][1][1][2] = 202;
  original[1][1][1][2] = 101;
  daily[1][1][2][1] = 303;
  original[1][1][2][1] = 303;

  return {
    학교명: '인천과학고등학교',
    지역명: '인천',
    시작일: '2026-05-04',
    자료244: '2026-05-07 08:50:22',
    분리: 100,
    학급수: [0, 2, 1, 1],
    가상학급수: [0, 0, 0, 0],
    요일별시수: [0, 8, 8, 8, 8, 8],
    일과시간: ['1교시', '2교시', '3교시', '4교시', '5교시', '6교시', '7교시', '8교시'],
    자료492: ['', '국어', '수학', '영어'],
    자료446: ['', '김옙*', '박몽*', '이롬*'],
    자료147: daily,
    자료481: original
  };
}

function createGrid() {
  return Array.from({ length: 4 }, () =>
    Array.from({ length: 4 }, () =>
      Array.from({ length: 6 }, () => Array.from({ length: 9 }, () => 0))
    )
  );
}

function createInteraction({
  commandName = '시간표',
  integers = { 학년: 1, 반: 1 },
  strings = {},
  supportsDefer = false
} = {}) {
  const interaction = {
    commandName,
    deferred: false,
    replied: false,
    deferCount: 0,
    replies: [],
    edits: [],
    isChatInputCommand() {
      return true;
    },
    options: {
      getInteger(name) {
        return integers[name];
      },
      getString(name) {
        return strings[name] ?? null;
      }
    },
    async reply(payload) {
      this.replied = true;
      this.replies.push(payload);
    }
  };

  if (supportsDefer) {
    interaction.deferReply = async function deferReply() {
      this.deferred = true;
      this.deferCount += 1;
    };
    interaction.editReply = async function editReply(payload) {
      this.edits.push(payload);
    };
  }

  return interaction;
}
