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
  assert.throws(() => subtractMoney(1, 2), /0 미만/);
});
