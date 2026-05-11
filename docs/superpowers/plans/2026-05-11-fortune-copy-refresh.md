# Fortune Copy Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/운세` copy longer, more natural, and date-aware so 오늘/내일/어제 outputs read like deliberate fortune paragraphs instead of short generic fragments.

**Architecture:** Keep deterministic fortune selection in `src/systems/fortune.js`, but separate the selected fortune's meaning from the rendered date wording. Replace brittle global text replacement with tokenized, date-aware rendering and refresh the fortune corpus into longer curated paragraphs inspired by the user's examples. Keep `/운세` response formatting simple: title, grade, paragraph, lucky number, XP line.

**Tech Stack:** Node.js ES modules, `node:test`, existing Discord slash command code, no new dependencies.

---

## Current Problem Summary

- Current `FORTUNE_MESSAGES` entries are mostly 1-2 short sentences and often read like generic advice.
- Many entries hard-code `오늘`, so `/운세 날짜:내일운세` can show a sentence that says “오늘은…”.
- The previous quick fix used string replacement (`오늘` -> `내일`, `내일` -> `모레`), but that can make awkward sentences like “중요한 일은 회복한 뒤 처리하고 내일은 쉬세요” -> “... 어제는 쉬세요”.
- The right fix is not to blindly replace all date words. Fortune messages should be written with an explicit `{day}` token only where the selected date should appear.

## File Structure

- Modify: `src/systems/fortune.js`
  - Owns fortune date choices, deterministic fortune selection, lucky number selection, token rendering, and the fortune corpus.
- Modify: `src/commands/fortune.js`
  - Owns Discord response formatting. Should display lucky number and leave copy rendering to the service.
- Modify: `tests/fortune.test.js`
  - Adds regression tests for date-aware wording, corpus length/naturalness, and lucky number rendering.
- Do not modify: unrelated economy XP behavior unless tests prove regression.

---

### Task 1: Lock the date-wording regression with token-based tests

**Files:**
- Modify: `tests/fortune.test.js`

- [ ] **Step 1: Replace the brittle date replacement test with token-rendering expectations**

Add or update this test in `tests/fortune.test.js`:

```js
test('운세 본문은 선택한 날짜 토큰만 자연스럽게 렌더링한다', () => {
  const fortune = new FortuneService({
    fortunes: [
      {
        kind: '吉(길)',
        text: '{dayTopic} 마음먹기에 따라서 모든 것이 순조롭게 풀리는 날입니다. 주변의 도움도 기대되니 천천히 움직이세요.'
      }
    ]
  });
  const now = Date.UTC(2026, 4, 6, 0, 0, 0);

  const today = fortune.getDailyFortune({ guildId: 'guild-1', userId: 'user-1', date: 'today', now });
  const tomorrow = fortune.getDailyFortune({ guildId: 'guild-1', userId: 'user-1', date: 'tomorrow', now });
  const yesterday = fortune.getDailyFortune({ guildId: 'guild-1', userId: 'user-1', date: 'yesterday', now });

  assert.match(today.text, /^오늘은 /);
  assert.match(tomorrow.text, /^내일은 /);
  assert.match(yesterday.text, /^어제는 /);
  assert.doesNotMatch(tomorrow.text, /모레/);
  assert.doesNotMatch(yesterday.text, /어제은|어제이|어제을/);
});
```

- [ ] **Step 2: Run the focused test and verify it fails before implementation**

Run:

```bash
npm test -- tests/fortune.test.js
```

Expected before implementation: FAIL because `{dayTopic}` is not rendered or the previous global replacement still behaves incorrectly.

---

### Task 2: Implement safe fortune token rendering

**Files:**
- Modify: `src/systems/fortune.js`

- [ ] **Step 1: Replace global date-word replacement with explicit token rendering**

In `FORTUNE_DATE_CHOICES`, keep date metadata and add particle-ready words:

```js
export const FORTUNE_DATE_CHOICES = Object.freeze({
  today: Object.freeze({ label: '오늘 운세', dayOffset: 0, dayWord: '오늘' }),
  yesterday: Object.freeze({ label: '어제 운세', dayOffset: -1, dayWord: '어제' }),
  tomorrow: Object.freeze({ label: '내일 운세', dayOffset: 1, dayWord: '내일' })
});
```

Add renderer helpers near the bottom of `src/systems/fortune.js`:

```js
function renderFortuneText(text, dateChoice) {
  const day = dateChoice.dayWord;
  return String(text)
    .replaceAll('{day}', day)
    .replaceAll('{dayTopic}', `${day}${getTopicParticle(day)}`)
    .replaceAll('{daySubject}', `${day}${getSubjectParticle(day)}`)
    .replaceAll('{dayObject}', `${day}${getObjectParticle(day)}`);
}

function getTopicParticle(word) {
  return hasFinalConsonant(word) ? '은' : '는';
}

function getSubjectParticle(word) {
  return hasFinalConsonant(word) ? '이' : '가';
}

function getObjectParticle(word) {
  return hasFinalConsonant(word) ? '을' : '를';
}

function hasFinalConsonant(word) {
  const text = String(word);
  const lastCharCode = text.charCodeAt(text.length - 1);
  if (lastCharCode < 0xac00 || lastCharCode > 0xd7a3) return false;
  return (lastCharCode - 0xac00) % 28 !== 0;
}
```

- [ ] **Step 2: Use the renderer in `getDailyFortune`**

Change the returned text field to:

```js
text: renderFortuneText(fortune.text, dateChoice),
luckyNumber: getLuckyNumber({ guildId, userId, dateKey })
```

Keep deterministic lucky number helper:

```js
function getLuckyNumber({ guildId, userId, dateKey }) {
  return getStableIndex(`${guildId}:${userId}:${dateKey}:lucky-number`, 99) + 1;
}
```

- [ ] **Step 3: Run focused test**

Run:

```bash
npm test -- tests/fortune.test.js
```

Expected: token-rendering test passes. Other corpus tests may fail until Task 3 updates copy.

---

### Task 3: Refresh the fortune corpus into longer natural paragraphs

**Files:**
- Modify: `src/systems/fortune.js`
- Modify: `tests/fortune.test.js`

- [ ] **Step 1: Update corpus quality tests to match the new copy target**

In `tests/fortune.test.js`, update the naturalness checks:

```js
for (const fortune of FORTUNE_MESSAGES) {
  assert.ok(fortune.text.length >= 95, `운세가 너무 짧습니다: ${fortune.text}`);
  assert.ok(fortune.text.length <= 260, `운세가 너무 깁니다: ${fortune.text}`);
  assert.match(fortune.text, /(니다|세요|겁니다)\./);
  assert.match(fortune.text, /\{day(?:Topic|Subject|Object)?\}|오늘|하루|시간|마음|주변|선택|조언|기운/);
}
```

Also add a test that forbids awkward leftover fragments:

```js
test('운세 본문은 어색한 날짜 치환 흔적을 남기지 않는다', () => {
  const fortune = new FortuneService();
  const now = Date.UTC(2026, 4, 6, 0, 0, 0);

  for (const date of ['today', 'tomorrow', 'yesterday']) {
    for (let user = 1; user <= 40; user += 1) {
      const result = fortune.getDailyFortune({
        guildId: 'guild-1',
        userId: `user-${user}`,
        date,
        now
      });

      assert.doesNotMatch(result.text, /어제은|어제이|어제을|내일은 쉬세요|어제는 쉬세요|모레/);
    }
  }
});
```

- [ ] **Step 2: Rewrite entries to use `{dayTopic}` where the selected date should appear**

Replace short entries like:

```js
createFortune("吉(길)", "오늘은 무난하게 좋은 방향으로 흘러갑니다. 큰 욕심만 줄이면 작은 소득을 안정적으로 챙깁니다."),
```

with longer, more natural entries like:

```js
createFortune("吉(길)", "{dayTopic} 모든 일이 극적으로 풀리는 날은 아니지만, 차분히 순서를 잡으면 기대보다 안정적인 결과를 얻을 수 있습니다. 주변의 작은 도움을 가볍게 여기지 말고, 감사 표현을 바로 전하면 관계의 기운도 함께 좋아집니다."),
```

Rewrite by grade with these tone rules:

- `大吉(대길)`: 확실히 좋은 흐름, 기회, 인정, 도움. 들뜨기보다 잘 잡으라는 말투.
- `吉(길)`: 무난한 호재, 안정, 편안한 성과. 너무 과장하지 않기.
- `中吉(중길)`: 조건부 호재. 준비, 확인, 순서, 조언을 강조.
- `小吉(소길)`: 작지만 실질적인 이득. 작은 친절, 정리, 휴식, 대화.
- `末吉(말길)`: 늦게 풀리는 운. 오전/초반이 답답해도 후반에 안정.
- `凶(흉)`: 조심, 미루기, 충돌 회피. 겁주기보다 안전한 행동 제시.
- `大凶(대흉)`: 강한 경고. 금전/관계/무리한 결정 보류, 쉬기.

Do not use one-line fragments. Each fortune should be 2-3 connected sentences and feel like a paragraph.

- [ ] **Step 3: Keep corpus count stable**

Run:

```bash
node - <<'NODE'
import { FORTUNE_MESSAGES } from './src/systems/fortune.js';
const counts = FORTUNE_MESSAGES.reduce((map, fortune) => map.set(fortune.kind, (map.get(fortune.kind) ?? 0) + 1), new Map());
console.log(FORTUNE_MESSAGES.length, Object.fromEntries(counts));
NODE
```

Expected:

```text
350 { '大吉(대길)': 50, '吉(길)': 50, '中吉(중길)': 50, '小吉(소길)': 50, '末吉(말길)': 50, '凶(흉)': 50, '大凶(대흉)': 50 }
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
npm test -- tests/fortune.test.js
```

Expected: PASS.

---

### Task 4: Improve `/운세` response format with lucky number

**Files:**
- Modify: `src/commands/fortune.js`
- Modify: `tests/fortune.test.js`

- [ ] **Step 1: Add response formatting test**

Add:

```js
test('운세 응답은 행운의 숫자를 본문 아래에 보여준다', () => {
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
```

- [ ] **Step 2: Implement format change**

In `src/commands/fortune.js`, include:

```js
fortune.text,
'',
'행운의 숫자 ✨',
String(fortune.luckyNumber)
```

inside the main `lines` array before XP bonus lines.

- [ ] **Step 3: Run focused tests**

Run:

```bash
npm test -- tests/fortune.test.js
```

Expected: PASS.

---

### Task 5: Manual sample review before final verification

**Files:**
- No code changes expected unless sample review finds awkward sentences.

- [ ] **Step 1: Print sample outputs for all date modes**

Run:

```bash
node - <<'NODE'
import { FortuneService } from './src/systems/fortune.js';
const fortune = new FortuneService();
const now = Date.UTC(2026, 4, 11, 0, 0, 0);
for (const date of ['today', 'tomorrow', 'yesterday']) {
  console.log('\n===', date, '===');
  for (let i = 1; i <= 20; i += 1) {
    const result = fortune.getDailyFortune({ guildId: 'guild-1', userId: `sample-${i}`, date, now });
    console.log(`${i}. [${result.kind}] ${result.text} / 행운의 숫자 ${result.luckyNumber}`);
  }
}
NODE
```

Expected review checklist:

- No `오늘은` inside tomorrow/yesterday result unless the sentence is explicitly comparing dates and still natural.
- No `어제은`, `어제이`, `어제을`.
- No `모레` caused by blind replacement.
- Most samples feel like 2-3 sentence fortune paragraphs, not one-line task tips.
- Bad-luck entries still give useful behavior advice instead of just scolding.

- [ ] **Step 2: Fix awkward samples immediately**

If sample output contains an awkward sentence, edit that exact `createFortune(...)` text in `src/systems/fortune.js` and rerun the sample command.

---

### Task 6: Full verification and commit

**Files:**
- Commit only implementation/test files touched for fortune work.
- Do not accidentally commit unrelated plan files from other work unless the user explicitly wants them included.

- [ ] **Step 1: Check diff**

Run:

```bash
git status -sb
git diff --stat
git diff --check
```

Expected: no whitespace errors. Changed files should be limited to fortune implementation/tests unless the user approved wider cleanup.

- [ ] **Step 2: Run full test suite**

Run:

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit with Lore protocol**

Use a message shaped like:

```bash
git add src/systems/fortune.js src/commands/fortune.js tests/fortune.test.js
git commit -m "Make fortune copy date-aware and natural" \
  -m "The fortune corpus previously mixed hard-coded 오늘 wording with tomorrow/yesterday modes, and the short entries read more like generic task tips than fortune paragraphs. This change renders explicit date tokens, adds deterministic lucky numbers, and refreshes copy quality tests around longer natural paragraphs." \
  -m "Constraint: No new dependencies; fortune selection must remain deterministic per user/date." \
  -m "Rejected: Blind string replacement of 오늘/내일 | it creates awkward phrases such as 어제은 or unintended 모레 references." \
  -m "Confidence: high" \
  -m "Scope-risk: moderate" \
  -m "Directive: Future fortune text should use {dayTopic}/{daySubject}/{dayObject} tokens instead of hard-coding 오늘 when date mode matters." \
  -m "Tested: npm test -- tests/fortune.test.js; npm test" \
  -m "Not-tested: Live Discord rendering"
```

- [ ] **Step 4: Push only if requested**

Run only if the user asks for push:

```bash
git push
```
