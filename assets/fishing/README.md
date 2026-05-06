# Fishing Generated Assets

`agent-sprite-forge`로 생성한 낚시 물고기 이미지를 이 폴더 아래에 둔다.

권장 구조:

```text
assets/fishing/fish/<rarity>/<fish-id>/
  raw-sheet.png
  raw-sheet-clean.png
  sheet-transparent.png
  frames/
  pipeline-meta.json
  prompt-used.txt
```

- 에셋 id와 프롬프트는 `src/systems/fishing-assets.js`를 기준으로 관리한다.
- 모든 물고기 시스템 id는 `src/systems/fishing.js`의 `assetId: fish_<id>`와 연결된다.
- 히든 물고기도 manifest에는 포함되지만 게임 내 획득 조건은 공개하지 않는다.
- 원본 생성물 임시 보관은 `assets/fishing/_incoming/`을 사용한다.
