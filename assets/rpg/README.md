# RPG Generated Assets

`agent-sprite-forge`로 생성한 RPG 이미지 결과물을 이 폴더 아래에 둔다.

현재 기본 RPG manifest 전체 생성 완료:

- `asset-manifest.json`: 생성/후처리 결과 manifest
- `preview/contact-sheet.png`: 전체 에셋 검수용 미리보기
- 영웅/몬스터/보스: `raw/raw-sheet.png`, `processed/sheet-transparent.png`, `processed/animation.gif`
- 아이템: `raw/raw-sheet.png`, `processed/clean.png`
- 맵: `raw/background.png`

권장 구조:

```text
assets/rpg/heroes/<hero>/<action>/
assets/rpg/heroes/female/<hero>/<action>/
assets/rpg/monsters/<monster>/<action>/
assets/rpg/maps/<map>/
assets/rpg/items/<item>/
assets/rpg/fx/<effect>/
```

생성할 에셋 id와 프롬프트는 `src/systems/rpg-assets.js`를 기준으로 관리한다.
남캐는 기존 `hero_<class>_idle`, 여캐는 `hero_female_<class>_idle` id를 사용한다.
