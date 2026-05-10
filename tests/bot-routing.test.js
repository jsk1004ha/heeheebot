import assert from 'node:assert/strict';
import test from 'node:test';
import { isSupportedCommandInteraction } from '../src/bot.js';

test('봇 라우팅은 RPG 선택 메뉴 상호작용도 처리 대상으로 인정한다', () => {
  assert.equal(isSupportedCommandInteraction({
    isChatInputCommand: () => false,
    isButton: () => false,
    isStringSelectMenu: () => true
  }), true);
});

test('봇 라우팅은 라이어게임 최종 추측 모달도 처리 대상으로 인정한다', () => {
  assert.equal(isSupportedCommandInteraction({
    isChatInputCommand: () => false,
    isButton: () => false,
    isModalSubmit: () => true,
    isStringSelectMenu: () => false
  }), true);
});

test('봇 라우팅은 명령/버튼/선택 메뉴가 아니면 무시한다', () => {
  assert.equal(isSupportedCommandInteraction({
    isChatInputCommand: () => false,
    isButton: () => false,
    isModalSubmit: () => false,
    isStringSelectMenu: () => false
  }), false);
});
