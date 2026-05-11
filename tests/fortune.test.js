import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  formatFortuneResult
} from '../src/commands/fortune.js';
import {
  FORTUNE_MESSAGES,
  FortuneService
} from '../src/systems/fortune.js';

const EXPECTED_FORTUNE_KINDS = [
  '大吉(대길)',
  '吉(길)',
  '中吉(중길)',
  '小吉(소길)',
  '末吉(말길)',
  '凶(흉)',
  '大凶(대흉)'
];

test('운세 글귀는 7단계 길흉 분류가 섞인 350개 직접 작성 목록이다', () => {
  const kinds = new Set(FORTUNE_MESSAGES.map((fortune) => fortune.kind));

  assert.equal(FORTUNE_MESSAGES.length, 350);
  assert.deepEqual([...kinds].sort(), [...EXPECTED_FORTUNE_KINDS].sort());
  assert.equal(FORTUNE_MESSAGES.every((fortune) => EXPECTED_FORTUNE_KINDS.includes(fortune.kind)), true);

  const countsByKind = FORTUNE_MESSAGES.reduce((counts, fortune) => {
    counts.set(fortune.kind, (counts.get(fortune.kind) ?? 0) + 1);
    return counts;
  }, new Map());
  assert.deepEqual(
    EXPECTED_FORTUNE_KINDS.map((kind) => countsByKind.get(kind)),
    EXPECTED_FORTUNE_KINDS.map(() => 50)
  );
});

test('운세 문구는 직접 쓴 자연스러운 존댓말 문장이다', () => {
  const normalizedTexts = FORTUNE_MESSAGES.map((fortune) => normalizeText(fortune.text));
  assert.equal(new Set(normalizedTexts).size, FORTUNE_MESSAGES.length);

  const sentenceCounts = new Map();
  for (const text of normalizedTexts) {
    for (const sentence of splitSentences(text)) {
      sentenceCounts.set(sentence, (sentenceCounts.get(sentence) ?? 0) + 1);
    }
  }

  const maxSentenceRepeat = Math.max(...sentenceCounts.values());
  assert.ok(maxSentenceRepeat <= 10, `같은 문장이 ${maxSentenceRepeat}번 반복됩니다.`);

  const bannedPatterns = [
    /대길(?:의 흐름)?입니다/,
    /길입니다/,
    /중길(?:의 흐름)?입니다/,
    /소길(?:의 흐름)?입니다/,
    /말길(?:의 흐름)?입니다/,
    /흉(?:의 흐름)?입니다/,
    /대흉(?:의 흐름)?입니다/,
    /흐름입니다/,
    /쪽에 .* 들어오는/,
    /포인트:/,
    /마무리:/,
    /입니다는/,
    /습니다는/,
    /필요 없은/,
    /없은/,
    /듣은/,
    /풀립니다까지/,
    /풀립니다로/,
    /스트레칭와/,
    /은\(는\)/,
    /운은 .* 운/,
    /기대보다 분명한 성과/
  ];

  for (const fortune of FORTUNE_MESSAGES) {
    assert.ok(fortune.text.length >= 35, `운세가 너무 짧습니다: ${fortune.text}`);
    assert.ok(fortune.text.length <= 190, `운세가 너무 깁니다: ${fortune.text}`);
    assert.match(fortune.text, /(니다|세요|겁니다)\./);
    for (const pattern of bannedPatterns) {
      assert.doesNotMatch(fortune.text, pattern, fortune.text);
    }
  }
});

test('운세 출력 문장은 예시처럼 충분한 길이의 자연스러운 단락이다', () => {
  for (const fortune of FORTUNE_MESSAGES) {
    const text = renderFortuneForTest(fortune, 'today');

    assert.ok(text.length >= 120, `출력 운세가 너무 짧습니다: ${text}`);
    assert.ok(text.length <= 360, `출력 운세가 너무 깁니다: ${text}`);
    assert.ok(splitSentences(text).length >= 3, `운세가 단락처럼 읽히지 않습니다: ${text}`);
    assert.doesNotMatch(text, /어제은|어제이|어제을|모레|내일은 쉬세요|어제는 쉬세요|오늘은 쉬세요/);
  }
});

test('운세 등급별 문구 강도는 길흉 감각과 맞아야 한다', () => {
  const messagesByKind = groupMessagesByKind(FORTUNE_MESSAGES);
  const expectations = [
    {
      kind: '大吉(대길)',
      pattern: /좋은|성사|성과|기회|인정|해결|도움|성공|반가운|수익|합격|칭찬|회복|축하|득점|선물/,
      label: '확실한 호재'
    },
    {
      kind: '吉(길)',
      pattern: /좋|무난|괜찮|도움|안정|편안|기분|소득|정리|순조|가볍|나아/,
      label: '무난한 호재'
    },
    {
      kind: '中吉(중길)',
      pattern: /조건|차분|천천|준비|확인|정리|기회|좋은|도움|나아|맞추|기준|단계/,
      label: '조건부 호재'
    },
    {
      kind: '小吉(소길)',
      pattern: /작은|소소|가벼|조금|짧은|하나|기본|유지|챙기|무난|편안/,
      label: '작지만 분명한 이득'
    },
    {
      kind: '末吉(말길)',
      pattern: /늦게|천천|기다|후반|저녁|나중|끝에|미루|시간|조금씩|뒤에/,
      label: '늦게 풀리는 감각'
    },
    {
      kind: '凶(흉)',
      pattern: /주의|조심|피하|미루|멈추|위험|손해|실수|오해|무리|확인|쉬는|줄이|신중|안전|낫|중요|바로 답하지|내려놓|백업|거절|다치|무겁|조용|문제|부담|변수|대충|지치|기본|끊깁|예민|피곤|폭발|일찍|비교|숫자|화면|소음|서운함|가능한|식사|좋습니다|마세요|수 있습니다/,
      label: '분명한 주의'
    },
    {
      kind: '大凶(대흉)',
      pattern: /피하|미루|멈추|금물|위험|손해|분쟁|취소|보류|쉬세요|하지 마세요|조심|큰|크게|안전|문제|확인|중요|피곤|놓치|무거워|비교|세게|오래|마세요/,
      label: '강한 경고'
    }
  ];

  for (const { kind, pattern, label } of expectations) {
    const misses = messagesByKind
      .get(kind)
      .filter((fortune) => !pattern.test(fortune.text));

    assert.deepEqual(
      misses,
      [],
      `${kind} 문구는 ${label}이 느껴져야 합니다.`
    );
  }
});

test('같은 유저와 같은 날짜의 운세는 누가 보더라도 항상 같다', () => {
  const fortune = new FortuneService();
  const now = Date.UTC(2026, 4, 6, 0, 0, 0);

  const selfView = fortune.getDailyFortune({
    guildId: 'guild-1',
    userId: 'user-1',
    username: '본인',
    date: 'today',
    now
  });
  const otherView = fortune.getDailyFortune({
    guildId: 'guild-1',
    userId: 'user-1',
    username: '다른이름',
    date: 'today',
    now
  });

  assert.equal(selfView.dateKey, '2026-05-06');
  assert.equal(selfView.index, otherView.index);
  assert.equal(selfView.kind, otherView.kind);
  assert.equal(selfView.text, otherView.text);
});

test('어제운세는 한국시간 기준 전날 날짜를 사용한다', () => {
  const fortune = new FortuneService();
  const now = Date.UTC(2026, 4, 6, 0, 0, 0);

  const yesterday = fortune.getDailyFortune({
    guildId: 'guild-1',
    userId: 'user-1',
    username: '테스터',
    date: 'yesterday',
    now
  });

  assert.equal(yesterday.label, '어제 운세');
  assert.equal(yesterday.dateKey, '2026-05-05');
});

test('내일운세는 한국시간 기준 다음날 날짜를 사용한다', () => {
  const fortune = new FortuneService();
  const now = Date.UTC(2026, 4, 6, 0, 0, 0);

  const tomorrow = fortune.getDailyFortune({
    guildId: 'guild-1',
    userId: 'user-1',
    username: '테스터',
    date: 'tomorrow',
    now
  });

  assert.equal(tomorrow.label, '내일 운세');
  assert.equal(tomorrow.dateKey, '2026-05-07');
});

test('내일운세와 어제운세는 본문 날짜 표현도 선택한 날짜에 맞춘다', () => {
  const fortune = new FortuneService({
    fortunes: [
      {
        kind: '행운',
        text: '{dayTopic} 마음먹기에 따라서 모든 것이 순조롭게 풀리는 날입니다. 주변의 도움도 기대되니 천천히 움직이세요.'
      }
    ]
  });
  const now = Date.UTC(2026, 4, 6, 0, 0, 0);

  const tomorrow = fortune.getDailyFortune({
    guildId: 'guild-1',
    userId: 'user-1',
    date: 'tomorrow',
    now
  });
  const yesterday = fortune.getDailyFortune({
    guildId: 'guild-1',
    userId: 'user-1',
    date: 'yesterday',
    now
  });

  assert.match(tomorrow.text, /^내일은/);
  assert.doesNotMatch(tomorrow.text, /오늘은/);
  assert.match(yesterday.text, /^어제는/);
  assert.doesNotMatch(yesterday.text, /오늘은/);
});

test('운세 출력은 날짜 치환 흔적 없이 오늘/어제/내일 문맥을 유지한다', () => {
  const fortune = new FortuneService();
  const now = Date.UTC(2026, 4, 11, 0, 0, 0);

  for (const date of ['today', 'yesterday', 'tomorrow']) {
    for (let userNumber = 1; userNumber <= 60; userNumber += 1) {
      const result = fortune.getDailyFortune({
        guildId: 'guild-1',
        userId: `user-${userNumber}`,
        date,
        now
      });

      assert.doesNotMatch(
        result.text,
        /어제은|어제이|어제을|모레|내일은 쉬세요|어제는 쉬세요|오늘은 쉬세요/,
        `${date}: ${result.text}`
      );
    }
  }
});

test('운세 응답은 예시처럼 행운의 숫자를 함께 보여준다', () => {
  const content = formatFortuneResult({
    fortune: {
      username: '테스터',
      label: '내일 운세',
      dateKey: '2026-05-07',
      kind: '吉(길)',
      text: '내일은 주변의 도움도 기대되는 하루입니다.',
      luckyNumber: 14
    },
    target: { toString: () => '<@user-1>' },
    viewer: { toString: () => '<@user-1>' },
    xpResult: null
  });

  assert.match(content, /행운의 숫자 ✨\n14/);
});

test('오늘운세는 같은 유저의 어제운세 문구를 반복하지 않는다', () => {
  const fortune = new FortuneService();
  const now = Date.UTC(2026, 4, 6, 0, 0, 0);

  const today = fortune.getDailyFortune({
    guildId: 'guild-1',
    userId: 'user-1',
    username: '테스터',
    date: 'today',
    now
  });
  const yesterday = fortune.getDailyFortune({
    guildId: 'guild-1',
    userId: 'user-1',
    username: '테스터',
    date: 'yesterday',
    now
  });

  assert.notEqual(today.index, yesterday.index);
  assert.notEqual(today.text, yesterday.text);
});

test('운세 후보가 적어도 연속된 날짜에는 같은 운세가 나오지 않는다', () => {
  const fortune = new FortuneService({
    fortunes: [
      { kind: '행운', text: '첫 번째 운세' },
      { kind: '불운', text: '두 번째 운세' }
    ]
  });
  const day = 24 * 60 * 60 * 1000;

  for (let offset = 1; offset <= 14; offset += 1) {
    const previous = fortune.getDailyFortune({
      guildId: 'guild-1',
      userId: 'user-1',
      date: 'today',
      now: day * offset
    });
    const current = fortune.getDailyFortune({
      guildId: 'guild-1',
      userId: 'user-1',
      date: 'today',
      now: day * (offset + 1)
    });

    assert.notEqual(current.index, previous.index);
    assert.notEqual(current.text, previous.text);
  }
});

test('/운세 명령은 오늘운세, 어제운세, 내일운세 선택지를 제공한다', async () => {
  const source = await readFile(new URL('../src/commands/fortune.js', import.meta.url), 'utf8');

  assert.match(source, /\.setName\('운세'\)/);
  assert.match(source, /name: '오늘운세', value: 'today'/);
  assert.match(source, /name: '어제운세', value: 'yesterday'/);
  assert.match(source, /name: '내일운세', value: 'tomorrow'/);
  assert.match(source, /\.setName\('대상'\)/);
});

function normalizeText(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function splitSentences(text) {
  return text
    .split(/(?<=[.!?。]|다\.|요\.|니다\.|세요\.)\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function groupMessagesByKind(fortunes) {
  return fortunes.reduce((messagesByKind, fortune) => {
    const messages = messagesByKind.get(fortune.kind) ?? [];
    messages.push(fortune);
    messagesByKind.set(fortune.kind, messages);
    return messagesByKind;
  }, new Map());
}

function renderFortuneForTest(fortune, date = 'today') {
  return new FortuneService({ fortunes: [fortune] }).getDailyFortune({
    guildId: 'guild-1',
    userId: 'user-1',
    date,
    now: Date.UTC(2026, 4, 6, 0, 0, 0)
  }).text;
}
