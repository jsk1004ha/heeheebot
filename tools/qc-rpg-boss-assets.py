#!/usr/bin/env python3
"""QC RPG boss sprite assets for forge provenance and runtime crop safety."""
import json
import sys
from pathlib import Path

from PIL import Image, ImageSequence

MANIFEST = Path('assets/rpg/asset-manifest.json')
EDGE_MARGIN_MIN = 2


def frame_margins(frame):
    rgba = frame.convert('RGBA')
    bbox = rgba.getchannel('A').getbbox()
    if not bbox:
        return None
    x0, y0, x1, y1 = bbox
    width, height = rgba.size
    return (x0, y0, width - x1, height - y1)


def main():
    manifest = json.loads(MANIFEST.read_text())
    failures = []
    checked = 0

    for asset in manifest.get('assets', []):
        asset_id = asset.get('id', '')
        if not asset_id.startswith('boss_'):
            continue
        checked += 1

        source = str(asset.get('source') or '')
        if source == 'local-procedural-raid-assets' or not source.startswith('/home/jio/.codex/generated_images/'):
            failures.append(f'{asset_id}: source is not generated image provenance: {source!r}')

        animation = Path(asset.get('animation') or '')
        if not animation.exists():
            failures.append(f'{asset_id}: animation missing: {animation}')
            continue

        try:
            image = Image.open(animation)
        except Exception as exc:  # pragma: no cover - defensive diagnostics
            failures.append(f'{asset_id}: animation cannot be opened: {animation}: {exc}')
            continue

        frame_count = 0
        for frame_number, frame in enumerate(ImageSequence.Iterator(image), start=1):
            frame_count += 1
            margins = frame_margins(frame)
            if margins is None:
                failures.append(f'{asset_id}: frame {frame_number} is empty')
                continue
            if min(margins) < EDGE_MARGIN_MIN:
                failures.append(f'{asset_id}: frame {frame_number} touches runtime edge, margins={margins}')

        if frame_count == 0:
            failures.append(f'{asset_id}: animation has no frames')

    if checked == 0:
        failures.append('no boss assets found in RPG manifest')

    if failures:
        print('RPG boss asset QC failed:')
        for failure in failures:
            print(f'- {failure}')
        return 1

    print(f'RPG boss asset QC passed: {checked} boss animation assets have generated-image provenance and >= {EDGE_MARGIN_MIN}px runtime edge margins.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
