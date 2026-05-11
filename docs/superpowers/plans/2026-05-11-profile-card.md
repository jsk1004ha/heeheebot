# Profile Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/프로필` into a cleaner game-character-card style Discord embed while preserving profile data, badge image attachments, target-user lookup, and existing economy behavior.

**Architecture:** Keep the implementation inside `src/commands/economy.js`, because profile command formatting already lives there. Replace line-slicing embed fields with explicit profile card sections so the UI is stable and easier to test. Update `tests/economy-command.test.js` to assert the new card sections and unchanged behavior.

**Tech Stack:** Node.js ES modules, `discord.js` `EmbedBuilder`, Node test runner (`node --test`).

---

## File Structure

- Modify: `src/commands/economy.js`
  - Replace `createProfileEmbedFields(profileText)` line slicing with explicit card-section fields.
  - Add `createProfileCardSections(profile, context)`.
  - Keep `formatProfile(profile, context)` as text fallback by joining those same sections.
  - Keep existing RPG/검/주식/커뮤니티 summary helpers unless a small formatting tweak is needed.
- Modify: `tests/economy-command.test.js`
  - Update profile expectations from old “성장 카드/통합 성장 요약” layout to game-card fields.
  - Keep assertions for badge image attachment, target user lookup, stock context, and hidden internal IDs.

---

### Task 1: Lock the new game-card profile shape in tests

**Files:**
- Modify: `tests/economy-command.test.js`

- [ ] **Step 1: Update the baseline profile card assertions**

In the test `프로필과 랭킹 출력은 전체 경험치를 경험치로 표시한다`, replace old layout assertions with these expectations:

```js
assert.match(profileContent, /🎮 캐릭터 카드/);
assert.match(profileContent, /Lv\. \*\*2\*\* · 등급 \*\*뉴비\*\*/);
assert.match(profileContent, /대표 배지 \*\*SPROUT · 새싹 뉴비 배지\*\*/);
assert.match(profileContent, /골드 \*\*300골드\*\* · 출석 \*\*1일\*\*/);
assert.match(profileContent, /⚔️ RPG 캐릭터/);
assert.match(profileContent, /RPG: \*\*미시작\*\*/);
assert.match(profileContent, /🗡️ 검 성장/);
assert.match(profileContent, /검: \*\*\+0 기본 검\*\*/);
assert.match(profileContent, /🎖️ 성장\/정산/);
```

Keep these existing assertions in the same test:

```js
assert.ok(profileReply.embeds[0].data.fields.length >= 5);
assert.equal(profileReply.content, '🪪 **테스터님의 통합 프로필**');
assert.equal(profileReply.files[0].name, 'profile_badge_001_005.png');
assert.equal(profileReply.embeds[0].data.image.url, 'attachment://profile_badge_001_005.png');
assert.doesNotMatch(profileContent, /현재 레벨 경험치|누적 경험치|20 \/ 282/);
assert.match(leaderboardInteraction.replies[0], /경험치 120 XP/);
```

- [ ] **Step 2: Update the level-10 profile assertions**

In `프로필 출력은 이미지 성장 배지와 10레벨 간격 다음 목표를 보여준다`, assert the new hero and growth fields:

```js
assert.match(content, /Lv\. \*\*10\*\* · 등급 \*\*견습\*\*/);
assert.match(content, /대표 배지 \*\*RISING · 첫 별 견습 배지\*\*/);
assert.match(content, /다음 배지 \*\*EMBER · 불씨 모험가 배지\*\*까지 1레벨/);
assert.match(content, /칭호 \*\*VIP\*\*/);
assert.match(content, /꾸미기 배지: 행운 배지/);
assert.match(content, /🎖️ 성장\/정산/);
assert.doesNotMatch(content, /🌱|✨|🌟|💫|🔥|👑|🌌|💎|🌈|🍀/);
```

Keep attachment assertions:

```js
assert.equal(reply.files[0].name, 'profile_badge_006_010.png');
assert.equal(reply.embeds[0].data.image.url, 'attachment://profile_badge_006_010.png');
```

- [ ] **Step 3: Update the high-level badge assertions**

In the high-level profile test, replace old `성장 배지:` and `다음 배지:` text with:

```js
assert.match(content, /대표 배지 \*\*MYTHIC · 신화 전야 배지\*\*/);
assert.match(content, /이전 배지 19개/);
assert.match(content, /다음 배지 \*\*RADIANT · 무지개 신화 배지\*\*까지 1레벨/);
```

- [ ] **Step 4: Update the integrated profile test assertions**

In `프로필은 대상 유저와 RPG/검/주식/커뮤니티 통합 요약을 보여준다`, keep the target lookup assertions and add field-level expectations:

```js
assert.match(content, /🎮 캐릭터 카드/);
assert.match(content, /⚔️ RPG 캐릭터/);
assert.match(content, /여성 검사 → 버서커/);
assert.match(content, /🗡️ 검 성장/);
assert.match(content, /📈 자산\/주식/);
assert.match(content, /총자산 \*\*42,000골드\*\*/);
assert.match(content, /🏅 커뮤니티/);
assert.match(content, /완료 미션 \*\*4개\*\*/);
```

- [ ] **Step 5: Run the focused test and confirm it fails before implementation**

Run:

```bash
npm test -- tests/economy-command.test.js
```

Expected: FAIL because the old formatter still emits the old `성장 카드`/`통합 성장 요약` layout.

---

### Task 2: Implement explicit profile card sections

**Files:**
- Modify: `src/commands/economy.js`

- [ ] **Step 1: Replace `createProfileReplyPayload` field construction**

Use explicit sections instead of line slicing:

```js
export function createProfileReplyPayload(profile, context = {}) {
  const sections = createProfileCardSections(profile, context);
  const profileText = formatProfile(profile, context);
  const displayBadge = getDisplayProfileLevelBadge(profile.level);
  const attachment = getProfileBadgeAttachment(displayBadge);

  if (!attachment) return profileText;

  const tier = getProfileLevelTier(profile.level);
  const embed = new EmbedBuilder()
    .setTitle(`${profile.username} · Lv.${normalizeProfileLevel(profile.level)} ${tier.title}`)
    .setDescription(`대표 배지: **${displayBadge.badgeText} · ${displayBadge.name}**`)
    .addFields(sections)
    .setImage(`attachment://${attachment.name}`)
    .setColor(tier.color)
    .setFooter({ text: `${tier.aura} · 프로필 성장 배지 이미지` });

  return {
    content: `🪪 **${profile.username}님의 통합 프로필**`,
    embeds: [embed],
    files: [attachment]
  };
}
```

- [ ] **Step 2: Delete old `createProfileEmbedFields(profileText)`**

Remove the old line-slicing helper entirely. It depends on old line positions and makes future card changes fragile.

- [ ] **Step 3: Add `createProfileCardSections(profile, context)`**

Add this helper near `formatProfile`:

```js
function createProfileCardSections(profile, context = {}) {
  const level = normalizeProfileLevel(profile.level);
  const tier = getProfileLevelTier(level);
  const displayBadge = getDisplayProfileLevelBadge(level);
  const migrationText = profile.currencyMigration?.convertedGold > 0
    ? `기존 전용 지갑 정산 **+${formatCurrencyAmount(profile.currencyMigration.convertedGold, 'main')}**`
    : '기존 전용 지갑 **정산 완료**';
  const titleText = getEquippedTitleText(profile);

  return [
    {
      name: '🎮 캐릭터 카드',
      value: [
        `**${profile.username}**${titleText}`,
        `Lv. **${level}** · 등급 **${tier.title}**`,
        `대표 배지 **${displayBadge.badgeText} · ${displayBadge.name}**`,
        `골드 **${formatCurrencyAmount(profile.balance, 'main')}** · 출석 **${normalizeProfileCount(profile.dailyStreak).toLocaleString()}일**`,
        `다음 배지 ${formatNextBadgeTarget(level)}`
      ].join('\n')
    },
    { name: '⚔️ RPG 캐릭터', value: formatRpgProfileSummary(profile) },
    { name: '🗡️ 검 성장', value: formatSwordProfileSummary(profile) },
    { name: '📈 자산/주식', value: formatStockProfileSummary(context) },
    { name: '🏅 커뮤니티', value: formatCommunityProfileSummary(profile) },
    {
      name: '🎖️ 성장/정산',
      value: [
        `성장 배지: ${formatLevelBadgeGallery(level)}`,
        `대표 배지 이미지: ${formatDisplayBadgeText(level)}`,
        `카드 효과: **${tier.aura}**`,
        migrationText
      ].join('\n')
    }
  ];
}
```

- [ ] **Step 4: Make `formatProfile` reuse the same sections**

Replace the old border-based string with:

```js
export function formatProfile(profile, context = {}) {
  return createProfileCardSections(profile, context)
    .map((section) => `${section.name}\n${section.value}`)
    .join('\n\n');
}
```

- [ ] **Step 5: Run the focused test**

Run:

```bash
npm test -- tests/economy-command.test.js
```

Expected: PASS.

---

### Task 3: Regression verification and commit

**Files:**
- Modify: `src/commands/economy.js`
- Modify: `tests/economy-command.test.js`

- [ ] **Step 1: Syntax check changed files**

Run:

```bash
node --check src/commands/economy.js
node --check tests/economy-command.test.js
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 2: Run focused and full tests**

Run:

```bash
npm test -- tests/economy-command.test.js
npm test
```

Expected:
- economy-command tests pass.
- full suite passes.

- [ ] **Step 3: Commit implementation**

Run:

```bash
git add src/commands/economy.js tests/economy-command.test.js docs/superpowers/plans/2026-05-11-profile-card.md
git commit -m "Make profile cards read like game character sheets" \
  -m "The profile command now builds explicit game-card sections instead of slicing a long text blob into embed fields." \
  -m "Constraint: Preserve badge image attachments, target-user lookup, stock context, and existing profile data sources" \
  -m "Rejected: Add a separate profile renderer module | current command owns the formatting and the change is narrow" \
  -m "Confidence: high" \
  -m "Scope-risk: narrow" \
  -m "Directive: Keep profile card fields explicit; do not reintroduce line-position slicing" \
  -m "Tested: node --check src/commands/economy.js tests/economy-command.test.js" \
  -m "Tested: git diff --check" \
  -m "Tested: npm test -- tests/economy-command.test.js" \
  -m "Tested: npm test"
```

Expected: commit succeeds with only the plan, command formatter, and economy-command test changes.

---

## Self-Review

- Spec coverage: The plan covers game-card hero, RPG/검/주식/커뮤니티 fields, growth/settlement field, badge attachment preservation, target user behavior, and tests.
- Placeholder scan: No TBD/TODO/fill-later placeholders are present.
- Type consistency: The plan uses existing helper names from `src/commands/economy.js` and adds only `createProfileCardSections(profile, context)`.
