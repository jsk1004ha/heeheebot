# Fishing Asset Pipeline

낚시 물고기 이미지는 `agent-sprite-forge`의 `$generate2dsprite`를 사용해 생성한다.
현재 manifest는 `src/systems/fishing-assets.js`에서 145종 전체를 제공한다.

## Discord에서 배치 확인

```text
/낚시에셋 등급:전체 개수:8 시작:0
/낚시에셋 등급:히든 개수:10
/낚시에셋 등급:전설 개수:11
```

각 항목은 다음 정보를 제공한다.

- `fish_<id>` 에셋 id
- 물고기 이름/등급
- 출력 경로 `assets/fishing/fish/<rarity>/<fish-id>`
- `$generate2dsprite` 프롬프트

## 생성 규칙

1. 각 물고기는 `single asset` 아이콘으로 생성한다.
2. 배경은 후처리를 위해 반드시 `#FF00FF` 단색을 사용한다.
3. 텍스트, UI 프레임, 워터마크는 넣지 않는다.
4. 출력물은 `assets/fishing/fish/<rarity>/<fish-id>/`에 둔다.
5. 나중에 게임 출력에서 `fish.assetId`를 이미지 파일 경로로 매핑한다.

## 배치 규모

- 전체: 145종
- 일반 공개 물고기: 135종
- 히든 물고기: 10종

히든 물고기의 존재는 asset manifest에는 있지만 획득 방법은 문서화하지 않는다.
