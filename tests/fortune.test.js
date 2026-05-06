import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  FORTUNE_MESSAGES,
  FortuneService
} from '../src/systems/fortune.js';

test('운세 글귀는 행운/주의/불운이 섞인 400개 목록이다', () => {
  const kinds = new Set(FORTUNE_MESSAGES.map((fortune) => fortune.kind));

  assert.equal(FORTUNE_MESSAGES.length, 400);
  assert.deepEqual([...kinds].sort(), ['불운', '주의', '행운'].sort());
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

test('/운세 명령은 오늘운세와 어제운세 선택지를 제공한다', async () => {
  const source = await readFile(new URL('../src/commands/fortune.js', import.meta.url), 'utf8');

  assert.match(source, /\.setName\('운세'\)/);
  assert.match(source, /name: '오늘운세', value: 'today'/);
  assert.match(source, /name: '어제운세', value: 'yesterday'/);
  assert.match(source, /\.setName\('대상'\)/);
});
