# 프로필 카드 게임 캐릭터 카드식 개편 디자인

## 목표

`/프로필` 응답을 긴 텍스트 요약이 아니라, 디스코드에서 바로 읽히는 **게임 캐릭터 카드**처럼 보이게 바꾼다. 기존 성장 배지 이미지, 대상 유저 조회, RPG/검/주식/커뮤니티 통합 요약은 유지한다.

## 현재 구조

- 프로필 응답 생성: `src/commands/economy.js`
  - `createProfileReplyPayload(profile, context)`
  - `formatProfile(profile, context)`
  - `createProfileEmbedFields(profileText)`
  - `formatRpgProfileSummary`, `formatSwordProfileSummary`, `formatStockProfileSummary`, `formatCommunityProfileSummary`
- 관련 테스트: `tests/economy-command.test.js`
  - 프로필 명령 설명
  - 성장 배지 이미지/다음 목표
  - 대상 유저 프로필
  - RPG/검/주식/커뮤니티 통합 요약

## 사용자 방향

선택된 방향은 **게임 캐릭터 카드식**이다.

의도:
- RPG와 검 성장 시스템이 커졌으므로 “내 캐릭터 카드” 느낌을 강화한다.
- 정보는 줄이지 않고, 한눈에 덩어리별로 읽히게 재배치한다.
- 과한 장문 설명과 장식성 테두리는 줄인다.

## 카드 구조

### 1. 상단 히어로

임베드 제목과 첫 필드에서 핵심 상태를 보여준다.

포함 정보:
- 플레이어 이름
- 장착 칭호
- 레벨과 성장 티어
- 대표 성장 배지
- 골드
- 연속 출석
- 다음 배지까지 남은 레벨

예시 톤:

```text
Lv.42 · 영웅
대표 배지: HEROIC · 별빛 기사 배지
골드 123,456G · 출석 12일
다음 배지까지 3레벨
```

### 2. 핵심 성장 블록

각 콘텐츠를 별도 필드로 나눈다.

#### ⚔️ RPG 캐릭터

표시:
- 직업/성별/전직
- 현재 지역
- 전투력
- HP/MP
- 전적

#### 🗡️ 검 성장

표시:
- 현재 검 이름
- 최고 강화
- 제련석
- 보호권
- 배틀 전적

#### 📈 자산/주식

표시:
- 총자산
- 보유 종목 수
- 레버리지 포지션 수
- 평가손익
- 실현손익

주식 서비스가 없으면 짧게 `연동 없음`으로 표시하고, 실패 시 에러 메시지를 짧게 남긴다.

#### 🏅 커뮤니티

표시:
- 장착 칭호
- 꾸미기 배지 수
- 보유 칭호 수
- 완료 미션 수

### 3. 성장/정산 필드

아래쪽에는 보조 정보를 압축한다.

포함:
- 기존 전용 지갑 정산 여부
- 성장 배지 갤러리 요약
- 대표 배지 이미지 이름

## 비주얼 규칙

- 기존 성장 배지 이미지는 유지한다.
- 임베드 색상은 현재 `getProfileLevelTier(level).color`를 유지한다.
- 카드 본문은 5개 안팎 필드로 정리한다.
- “통합 성장 요약” 같은 큰 문단형 제목은 줄이고, 콘텐츠별 필드 제목으로 의미를 대신한다.
- 이모지는 기능 구분에만 쓴다. 장식용 이모지를 반복하지 않는다.
- 테스트에서 금지한 랜덤 장식 이모지 목록은 계속 노출하지 않는다.

## 데이터 흐름

1. `handleEconomyCommand`가 대상 유저 프로필과 주식 context를 조회한다.
2. `createProfileReplyPayload`가 프로필 카드 payload를 만든다.
3. 기존 `formatProfile` 또는 새 helper가 카드용 sections를 만든다.
4. `EmbedBuilder`가 sections를 Discord embed fields로 구성한다.
5. 성장 배지 attachment가 있으면 기존처럼 embed image로 붙인다.

## 경계와 구현 방침

- 새 DB 필드는 추가하지 않는다.
- 새 dependency는 추가하지 않는다.
- 기존 profile-assets 시스템을 그대로 사용한다.
- 프로필 카드 표시 로직은 `src/commands/economy.js` 안에서 최소 변경으로 진행한다.
- summary helper들은 가능하면 문자열 포맷만 바꾸고, 계산 로직은 유지한다.
- 테스트는 기존 의미를 유지하되 새 카드 문구 기준으로 갱신한다.

## 에러 처리

- 주식 context 조회 실패는 현재처럼 프로필 전체 실패로 만들지 않고, 주식 필드에 짧게 표시한다.
- 성장 배지 attachment가 없는 경우도 현재처럼 텍스트 응답으로 동작한다.
- 대상 유저 조회와 allowed mentions 동작은 바꾸지 않는다.

## 테스트 계획

- `tests/economy-command.test.js` 갱신
  - `/프로필`이 게임 카드 필드를 가진다.
  - 성장 배지 이미지 attachment가 유지된다.
  - 대상 유저 프로필 조회가 유지된다.
  - RPG/검/주식/커뮤니티 정보가 각 필드로 표시된다.
  - 내부 ID나 금지된 장식 이모지가 노출되지 않는다.
- 검증 명령
  - `npm test -- tests/economy-command.test.js`
  - 필요 시 `npm test`

## 비범위

- 프로필 전용 신규 이미지 생성은 하지 않는다.
- RPG/검/주식/커뮤니티 데이터 모델은 바꾸지 않는다.
- 랭킹/송금/재화정보 UI는 이번 범위가 아니다.
