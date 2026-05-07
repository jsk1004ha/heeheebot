import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createButtonRows,
  createPagedButtonRow,
  shortenComponentText
} from '../src/commands/ui.js';

test('공통 UI helper는 버튼 row 분할과 페이지 버튼 생성을 제공한다', () => {
  const buttons = Array.from({ length: 7 }, (_, index) => ({
    data: { custom_id: `button-${index}` }
  }));
  const rows = createButtonRows(buttons, { maxPerRow: 5 });
  const pageRow = createPagedButtonRow({
    previousCustomId: 'prev',
    nextCustomId: 'next',
    previousLabel: '이전 10개',
    nextLabel: '다음 10개',
    pageIndex: 0,
    pageCount: 3
  });

  assert.equal(rows.length, 2);
  assert.equal(rows[0].components.length, 5);
  assert.equal(rows[1].components.length, 2);
  assert.equal(pageRow.components[0].data.disabled, true);
  assert.equal(pageRow.components[1].data.disabled, false);
  assert.equal(shortenComponentText('가'.repeat(105), 100).length, 100);
});
