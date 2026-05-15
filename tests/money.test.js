import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addMoney,
  compareMoney,
  formatMoney,
  multiplyMoneyFloor,
  normalizeStoredMoney,
  subtractMoney,
  toMoney,
  toMoneyString,
  toSafeProjectionNumber
} from '../src/systems/money.js';

test('money helper는 safe number와 거대 문자열을 BigInt로 정규화한다', () => {
  assert.equal(toMoney(100), 100n);
  assert.equal(toMoney('900719925474099199999'), 900719925474099199999n);
  assert.equal(toMoneyString('900719925474099199999'), '900719925474099199999');
  assert.equal(normalizeStoredMoney(' 000123 '), '123');
  assert.equal(normalizeStoredMoney('not money'), 0);
});

test('money helper는 한국식 큰 단위 입력을 정수 골드로 정규화한다', () => {
  assert.equal(toMoney('1억'), 100_000_000n);
  assert.equal(toMoney('1조'), 1_000_000_000_000n);
  assert.equal(toMoney('1경'), 10_000_000_000_000_000n);
  assert.equal(toMoney('1억5000만'), 150_000_000n);
  assert.equal(toMoney('1조 2억 3000만 4000'), 1_000_230_004_000n);
  assert.equal(toMoney('1,234'), 1_234n);
});

test('money helper는 무량대수까지 한국식 큰 단위를 정규화한다', () => {
  const largeUnits = [
    ['해', 20],
    ['자', 24],
    ['양', 28],
    ['구', 32],
    ['간', 36],
    ['정', 40],
    ['재', 44],
    ['극', 48],
    ['항하사', 52],
    ['아승기', 56],
    ['나유타', 60],
    ['불가사의', 64],
    ['무량대수', 68]
  ];

  for (const [unit, exponent] of largeUnits) {
    assert.equal(toMoney(`1${unit}`), 10n ** BigInt(exponent));
  }

  assert.equal(toMoney('1해 2345경'), (10n ** 20n) + 2345n * (10n ** 16n));
  assert.equal(
    toMoney('1무량대수 2불가사의 3나유타 4아승기 5항하사'),
    (10n ** 68n)
      + 2n * (10n ** 64n)
      + 3n * (10n ** 60n)
      + 4n * (10n ** 56n)
      + 5n * (10n ** 52n)
  );
});

test('money helper는 정수 돈 연산과 비교를 정확하게 처리한다', () => {
  assert.equal(addMoney('900719925474099199999', 2).toString(), '900719925474099200001');
  assert.equal(subtractMoney('900719925474099200001', 2).toString(), '900719925474099199999');
  assert.equal(multiplyMoneyFloor(100n, 19_000n, 10_000n), 190n);
  assert.equal(multiplyMoneyFloor('900719925474099199999', 20n), 18_014_398_509_481_983_999_980n);
  assert.equal(compareMoney('10000000000000000000', '9') > 0, true);
});

test('money helper는 표시와 SQLite projection을 분리한다', () => {
  assert.equal(formatMoney('12345678901234567890'), '12,345,678,901,234,567,890');
  assert.equal(formatMoney('900719925474099200001', { unit: '골드' }), '900,719,925,474,099,200,001골드');
  assert.equal(toSafeProjectionNumber('900719925474099200001'), Number.MAX_SAFE_INTEGER);
  assert.equal(toSafeProjectionNumber('12345'), 12345);
});

test('money helper는 public 입력의 음수와 소수 돈을 거부한다', () => {
  assert.throws(() => toMoney('-1'), /0 이상의 정수/);
  assert.throws(() => toMoney(1.5), /0 이상의 정수/);
  assert.throws(() => toMoney('1.5억'), /0 이상의 정수/);
  assert.throws(() => toMoney('억'), /0 이상의 정수/);
  assert.throws(() => subtractMoney(1, 2), /0 미만/);
});
