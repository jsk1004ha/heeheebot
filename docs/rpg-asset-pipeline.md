# RPG Asset Pipeline

이 프로젝트의 RPG 이미지는 `agent-sprite-forge`의 두 skill을 기준으로 배치 생성한다.

- `$generate2dsprite`: 영웅, 몬스터, 아이템, FX 같은 투명 스프라이트
- `$generate2dmap`: 전투 배경, 필드, 던전, 맵 프리뷰

## 원칙

1. 무작정 한 번에 많이 만들지 말고 `src/systems/rpg-assets.js`의 manifest에서 배치 단위로 생성한다.
2. 스프라이트 원본은 solid `#FF00FF` 배경으로 만들고, forge 스크립트로 투명화/프레임 분할/QC를 수행한다.
3. 영웅/몬스터 애니메이션은 기본 `2x2`, 대형 몬스터는 `3x3`을 우선 사용한다.
4. 전투 배경은 캐릭터가 없는 `baked_scene_mode` 배경으로 만들고, 캐릭터/몬스터는 별도 스프라이트로 얹는다.
5. 생성물은 manifest의 `outputDir` 아래에 저장한다.

## Discord RPG 연결 방식

RPG 전투 결과는 아래 에셋 id를 반환한다.

- `battle.assets.hero`
- `battle.assets.monster`
- `battle.assets.background`

보스전/레이드도 같은 구조를 사용한다. 탐험/던전은 이벤트별 `assets`와 드랍 장비의
`assetId`를 반환한다. 가챠/상점 장비는 `getRpgItemConfig(...).assetId`와
`src/systems/rpg-assets.js`의 manifest id를 연결한다.

현재 기본 manifest의 PNG/GIF 파일은 `assets/rpg/asset-manifest.json`에 생성 결과가 기록되어 있다.
런타임은 `getRpgAssetAttachment(id)`로 id를 manifest의 파일 경로와 연결하고, `/rpg` 응답에
Discord attachment 파일로 붙인다.

현재 이미지 첨부가 연결된 대표 흐름:

- `/rpg 시작`, `/rpg 상태`: 저장된 직업/성별의 영웅 스프라이트
- `/rpg 전투`, `/rpg 보스`, `/rpg 레이드`: 배경 + 영웅 + 몬스터/보스 + 드랍 장비
- `/rpg 탐험`, `/rpg 던전`: 지역 배경 + 이벤트 몬스터/드랍 장비
- `/rpg 인벤토리`, `/rpg 장비`, `/rpg 전리품`, `/rpg 가챠`: 아이템/장비 아이콘

## 생성 완료된 기본 세트

- 영웅 14종: 직업별 남캐/여캐 idle 스프라이트
- 몬스터/보스 11종
- 전투 배경 3종
- 아이템 아이콘 9종
- 전체 검수용 contact sheet: `assets/rpg/preview/contact-sheet.png`

스프라이트는 forge 후처리 결과로 투명 PNG sheet와 GIF를 함께 가진다. 아이템은 `processed/clean.png`,
맵은 `raw/background.png`를 런타임 연결 대상으로 사용한다.

캐릭터 외형 id 규칙:

- 남캐: `hero_<class>_idle`
- 여캐: `hero_female_<class>_idle`

`/rpg 시작`은 `직업`과 `성별`을 함께 받아 `profile.rpg.characterGender`에 저장한다. 전투/보스전은
저장된 성별을 기준으로 `battle.assets.hero`를 결정한다.

## 배치 확인

Discord에서 다음 명령으로 다음 생성 후보를 볼 수 있다.

```text
/rpg 에셋 종류:전체 개수:8
/rpg 에셋 종류:몬스터 개수:10
/rpg 에셋 종류:맵 개수:3
/rpg 가챠 배너:일반 소환 횟수:1
```

각 항목의 첫 프롬프트를 그대로 `$generate2dsprite` 또는 `$generate2dmap` 실행에 사용할 수 있다.
새 에셋을 추가할 때도 `src/systems/rpg-assets.js`에 먼저 등록하고, 생성 후
`assets/rpg/asset-manifest.json`과 개별 `asset.json`을 갱신한다.

## 현재 manifest 위치

```text
src/systems/rpg-assets.js
```

여기에 새 몬스터, 보스, 지역, 아이템, 스킬 FX를 계속 추가하면 이미지 생산량을 제한 없이 확장할 수 있다.
