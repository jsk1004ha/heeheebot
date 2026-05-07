import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { PROFILE_LEVEL_BADGES } from '../src/systems/profile-assets.js';

const WIDTH = 256;
const HEIGHT = 256;
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_DIR = join(REPO_ROOT, 'assets', 'profile', 'badges');

const FONT = {
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
  A: ['010', '101', '111', '101', '101'],
  B: ['110', '101', '110', '101', '110'],
  C: ['111', '100', '100', '100', '111'],
  D: ['110', '101', '101', '101', '110'],
  E: ['111', '100', '110', '100', '111'],
  F: ['111', '100', '110', '100', '100'],
  G: ['111', '100', '101', '101', '111'],
  H: ['101', '101', '111', '101', '101'],
  I: ['111', '010', '010', '010', '111'],
  J: ['001', '001', '001', '101', '111'],
  K: ['101', '101', '110', '101', '101'],
  L: ['100', '100', '100', '100', '111'],
  M: ['101', '111', '111', '101', '101'],
  N: ['101', '111', '111', '111', '101'],
  O: ['111', '101', '101', '101', '111'],
  P: ['111', '101', '111', '100', '100'],
  Q: ['111', '101', '101', '111', '001'],
  R: ['110', '101', '110', '101', '101'],
  S: ['111', '100', '111', '001', '111'],
  T: ['111', '010', '010', '010', '010'],
  U: ['101', '101', '101', '101', '111'],
  V: ['101', '101', '101', '101', '010'],
  W: ['101', '101', '111', '111', '101'],
  X: ['101', '101', '010', '101', '101'],
  Y: ['101', '101', '010', '010', '010'],
  Z: ['111', '001', '010', '100', '111'],
  '.': ['0', '0', '0', '0', '1'],
  ' ': ['0', '0', '0', '0', '0']
};

const EDGE_SAMPLES = Object.freeze([
  [0.25, 0.25],
  [0.75, 0.25],
  [0.25, 0.75],
  [0.75, 0.75]
]);

mkdirSync(OUTPUT_DIR, { recursive: true });
cleanPngs(OUTPUT_DIR);

for (const badge of PROFILE_LEVEL_BADGES) {
  const pixels = createCanvas(WIDTH, HEIGHT);
  const palette = getPalette(badge.level);
  drawBackground(pixels, palette, badge.level);
  drawOuterAura(pixels, palette, badge.level);
  drawBadgeShape(pixels, palette, badge.level);
  if (badge.level === 5) {
    drawSprout(pixels, palette);
  } else {
    drawLevelOrnament(pixels, palette, badge.level);
  }
  drawNamePlate(pixels, palette, badge.level);
  drawPixelText(pixels, badge.badgeText, 128, 208, getBadgeTextScale(badge.badgeText), [248, 250, 252, 255], [15, 23, 42, 180]);
  drawShine(pixels, badge.level);
  writeFileSync(join(OUTPUT_DIR, badge.fileName), encodePng(pixels, WIDTH, HEIGHT));
}

writeFileSync(join(REPO_ROOT, 'assets', 'profile', 'manifest.json'), `${JSON.stringify({
  badges: PROFILE_LEVEL_BADGES.map((badge) => ({
    minLevel: badge.minLevel,
    maxLevel: badge.maxLevel,
    name: badge.name,
    badgeText: badge.badgeText,
    file: `badges/${badge.fileName}`
  }))
}, null, 2)}\n`);


function cleanPngs(directory) {
  if (!existsSync(directory)) return;
  for (const fileName of readdirSync(directory)) {
    if (fileName.endsWith('.png')) rmSync(join(directory, fileName));
  }
}

function getBadgeTextScale(text) {
  if (text.length >= 8) return 4;
  if (text.length >= 7) return 4;
  return 5;
}

function createCanvas(width, height) {
  return new Uint8Array(width * height * 4);
}

function getPalette(level) {
  const palettes = [
    [[18, 64, 52], [87, 199, 133], [187, 247, 208]],
    [[31, 41, 85], [90, 167, 255], [191, 219, 254]],
    [[88, 38, 24], [239, 92, 68], [254, 202, 138]],
    [[18, 70, 92], [56, 189, 248], [186, 230, 253]],
    [[59, 31, 91], [217, 70, 239], [245, 208, 254]],
    [[22, 58, 76], [82, 183, 255], [186, 230, 253]],
    [[42, 32, 89], [124, 108, 255], [221, 214, 254]],
    [[15, 75, 92], [112, 224, 255], [207, 250, 254]],
    [[92, 50, 15], [255, 184, 77], [254, 215, 170]],
    [[88, 28, 87], [255, 95, 191], [251, 207, 232]]
  ];
  const index = getPaletteIndex(level, palettes.length);
  const [dark, mid, light] = palettes[index];
  return { dark, mid, light };
}


function getPaletteIndex(level, paletteCount) {
  const maxLevel = Math.max(1, Number(level) || 1);
  if (maxLevel <= 5) return 0;
  if (maxLevel <= 10) return 1;
  if (maxLevel <= 20) return 2;
  if (maxLevel <= 30) return 3;
  if (maxLevel <= 40) return 4;
  if (maxLevel <= 60) return 5;
  if (maxLevel <= 80) return 6;
  if (maxLevel <= 100) return 7;
  if (maxLevel <= 150) return 8;
  return Math.min(paletteCount - 1, 9);
}

function drawBackground(pixels, palette, level) {
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const dx = x - WIDTH / 2;
      const dy = y - HEIGHT / 2;
      const distance = Math.min(1, Math.sqrt(dx * dx + dy * dy) / 180);
      const radial = Math.atan2(dy, dx);
      const burst = Math.max(0, Math.cos(radial * 12 + level / 7)) * 0.18;
      const wave = Math.sin((x + y + level * 3) / 14) * 0.08;
      const color = mix(
        mix(palette.light, palette.mid, 0.42),
        palette.dark,
        Math.max(0, distance + wave - burst)
      );
      setPixel(pixels, x, y, [...color, 255]);
    }
  }
}

function drawOuterAura(pixels, palette, level) {
  const rayCount = Math.min(36, 12 + Math.floor(level / 8));
  for (let index = 0; index < rayCount; index += 1) {
    const angle = (index / rayCount) * Math.PI * 2 + level / 37;
    const inner = 74 + (index % 3) * 5;
    const outer = 122 + (index % 2) * 14;
    drawLine(
      pixels,
      128 + Math.cos(angle) * inner,
      118 + Math.sin(angle) * inner,
      128 + Math.cos(angle) * outer,
      118 + Math.sin(angle) * outer,
      [...palette.light, level >= 80 ? 130 : 90],
      level >= 100 ? 3 : 2
    );
  }

  const auraRings = Math.min(8, 2 + Math.floor(level / 30));
  for (let index = 0; index < auraRings; index += 1) {
    drawCircleStroke(pixels, 128, 118, 108 + index * 7, [...palette.light, 125 - index * 11], 2);
  }
}

function drawBadgeShape(pixels, palette, level) {
  const sides = level >= 100 ? 10 : level >= 50 ? 8 : 6;
  const shadow = regularPolygon(132, 122, 98, sides, -Math.PI / 2);
  const outer = regularPolygon(128, 118, 99, sides, -Math.PI / 2);
  const bevel = regularPolygon(128, 118, 91, sides, -Math.PI / 2 + Math.PI / sides / 2);
  const face = regularPolygon(128, 118, 78, sides, -Math.PI / 2);
  const inner = regularPolygon(128, 118, 65, sides, -Math.PI / 2 + Math.PI / sides);

  fillPolygon(pixels, shadow, [2, 6, 23, 125]);
  fillPolygon(pixels, outer, [248, 250, 252, 255]);
  fillPolygon(pixels, regularPolygon(128, 118, 95, sides, -Math.PI / 2), [...palette.light, 255]);
  fillPolygon(pixels, bevel, [...mix(palette.light, palette.mid, 0.35), 255]);
  fillPolygon(pixels, face, [...palette.mid, 255]);
  fillPolygon(pixels, inner, [15, 23, 42, 235]);
  strokePolygon(pixels, outer, [255, 255, 255, 255], 4);
  strokePolygon(pixels, face, [...palette.light, 245], 3);
  strokePolygon(pixels, inner, [248, 250, 252, 210], 2);

  const rings = Math.min(9, Math.floor(level / 30) + 2);
  for (let index = 0; index < rings; index += 1) {
    drawCircleStroke(pixels, 128, 118, 106 + index * 5, [...palette.light, Math.max(42, 160 - index * 18)], 2);
  }
}

function drawSprout(pixels, palette) {
  fillEllipse(pixels, 128, 152, 48, 16, 0, [91, 52, 26, 255]);
  fillEllipse(pixels, 128, 146, 38, 11, 0, [146, 93, 44, 255]);
  drawCircleStroke(pixels, 128, 118, 56, [220, 252, 231, 230], 4);
  drawCircleStroke(pixels, 128, 118, 66, [134, 239, 172, 150], 3);

  drawLine(pixels, 128, 150, 126, 96, [20, 83, 45, 255], 13);
  drawLine(pixels, 128, 150, 126, 96, [134, 239, 172, 255], 8);
  drawLine(pixels, 126, 102, 102, 82, [20, 83, 45, 255], 7);
  drawLine(pixels, 128, 101, 154, 80, [20, 83, 45, 255], 7);

  fillEllipse(pixels, 99, 84, 43, 22, -0.55, [20, 83, 45, 255]);
  fillEllipse(pixels, 102, 82, 38, 18, -0.55, [74, 222, 128, 255]);
  fillEllipse(pixels, 155, 82, 45, 22, 0.55, [20, 83, 45, 255]);
  fillEllipse(pixels, 154, 80, 40, 18, 0.55, [134, 239, 172, 255]);
  fillEllipse(pixels, 129, 68, 25, 39, 0, [20, 83, 45, 255]);
  fillEllipse(pixels, 128, 65, 20, 33, 0, [187, 247, 208, 255]);

  drawLine(pixels, 84, 81, 108, 82, [240, 253, 244, 190], 2);
  drawLine(pixels, 171, 78, 148, 81, [240, 253, 244, 190], 2);
  fillCircle(pixels, 145, 99, 5, [240, 253, 244, 210]);
  fillCircle(pixels, 113, 103, 4, [240, 253, 244, 190]);
  drawLine(pixels, 116, 156, 107, 169, [187, 247, 208, 150], 2);
  drawLine(pixels, 140, 156, 151, 169, [187, 247, 208, 150], 2);
}

function drawLevelOrnament(pixels, palette, level) {
  const spikes = Math.min(16, 6 + Math.floor(level / 20));
  const outerRadius = Math.min(68, 38 + Math.floor(level / 4));
  const innerRadius = Math.max(16, outerRadius * 0.48);
  fillPolygon(pixels, starPolygon(128, 118, outerRadius + 14, innerRadius + 8, spikes), [248, 250, 252, 160]);
  fillPolygon(pixels, starPolygon(128, 118, outerRadius, innerRadius, spikes), [...palette.light, 255]);
  fillPolygon(pixels, starPolygon(128, 118, outerRadius - 11, innerRadius + 3, spikes), [...palette.mid, 255]);
  fillPolygon(pixels, starPolygon(128, 118, outerRadius - 24, innerRadius * 0.8, spikes), [248, 250, 252, 210]);
  fillCircle(pixels, 128, 118, Math.max(22, outerRadius / 2.6), [...palette.light, 240]);
  fillCircle(pixels, 128, 118, Math.max(16, outerRadius / 3.4), [...palette.dark, 255]);
  drawGemFacet(pixels, 128, 118, Math.max(12, outerRadius / 4), palette);

  if (level >= 50) {
    drawCrown(pixels, 128, 59, palette);
  }

  if (level >= 100) {
    drawPrestigeFrame(pixels, palette, level);
    drawCircleStroke(pixels, 128, 118, 75, [255, 255, 255, 180], 3);
  }

  if (level >= 150) {
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
      const x1 = 128 + Math.cos(angle) * 76;
      const y1 = 118 + Math.sin(angle) * 76;
      const x2 = 128 + Math.cos(angle) * 102;
      const y2 = 118 + Math.sin(angle) * 102;
      drawLine(pixels, x1, y1, x2, y2, [...palette.light, 180], 3);
    }
  }

  if (level >= 200) {
    drawCircleStroke(pixels, 128, 118, 91, [255, 255, 255, 230], 4);
    drawCircleStroke(pixels, 128, 118, 119, [...palette.light, 180], 4);
  }
}

function drawPrestigeFrame(pixels, palette, level) {
  const sides = level >= 150 ? 12 : 10;
  const rotation = -Math.PI / 2 + Math.PI / sides;
  const outer = regularPolygon(128, 118, 116, sides, rotation);
  const inner = regularPolygon(128, 118, 104, sides, rotation + Math.PI / sides);

  strokePolygon(pixels, outer, [255, 255, 255, 170], 3);
  strokePolygon(pixels, inner, [...palette.light, 190], 3);
  fillPolygon(pixels, starPolygon(128, 118, 104, 88, sides), [...palette.light, 62]);

  for (let index = 0; index < sides; index += 1) {
    const angle = rotation + (index / sides) * Math.PI * 2;
    drawPrestigeTab(pixels, 128, 118, angle, index % 2 === 0 ? 112 : 101, palette, level);
  }

  if (level >= 150) {
    strokePolygon(pixels, regularPolygon(128, 118, 124, sides, -Math.PI / 2), [...palette.light, 140], 2);
  }

  if (level >= 200) {
    fillPolygon(pixels, starPolygon(128, 118, 123, 111, 24), [255, 255, 255, 42]);
  }
}

function drawPrestigeTab(pixels, cx, cy, angle, radius, palette, level) {
  const centerX = cx + Math.cos(angle) * radius;
  const centerY = cy + Math.sin(angle) * radius;
  const tangentX = -Math.sin(angle);
  const tangentY = Math.cos(angle);
  const radialX = Math.cos(angle);
  const radialY = Math.sin(angle);
  const halfWidth = level >= 150 ? 8 : 7;
  const halfHeight = level >= 150 ? 5 : 4;
  const points = [
    [
      centerX + tangentX * -halfWidth + radialX * -halfHeight,
      centerY + tangentY * -halfWidth + radialY * -halfHeight
    ],
    [
      centerX + tangentX * halfWidth + radialX * -halfHeight,
      centerY + tangentY * halfWidth + radialY * -halfHeight
    ],
    [
      centerX + tangentX * (halfWidth + 3) + radialX * halfHeight,
      centerY + tangentY * (halfWidth + 3) + radialY * halfHeight
    ],
    [
      centerX + tangentX * -(halfWidth + 3) + radialX * halfHeight,
      centerY + tangentY * -(halfWidth + 3) + radialY * halfHeight
    ]
  ];

  fillPolygon(pixels, points, [...palette.mid, 235]);
  fillPolygon(pixels, points.map(([x, y]) => [
    cx + (x - cx) * 0.96,
    cy + (y - cy) * 0.96
  ]), [...palette.light, 205]);
  strokePolygon(pixels, points, [255, 255, 255, 190], 1.5);
  drawLine(
    pixels,
    centerX - tangentX * (halfWidth - 2),
    centerY - tangentY * (halfWidth - 2),
    centerX + tangentX * (halfWidth - 2),
    centerY + tangentY * (halfWidth - 2),
    [255, 255, 255, 105],
    1.5
  );
}

function drawGemFacet(pixels, cx, cy, radius, palette) {
  const top = [[cx, cy - radius], [cx + radius, cy], [cx, cy + radius], [cx - radius, cy]];
  fillPolygon(pixels, top, [248, 250, 252, 235]);
  fillPolygon(pixels, [[cx, cy - radius], [cx + radius, cy], [cx, cy]], [...palette.light, 255]);
  fillPolygon(pixels, [[cx + radius, cy], [cx, cy + radius], [cx, cy]], [...palette.mid, 255]);
  fillPolygon(pixels, [[cx, cy + radius], [cx - radius, cy], [cx, cy]], [...palette.dark, 255]);
  strokePolygon(pixels, top, [255, 255, 255, 230], 2);
}

function drawCrown(pixels, cx, cy, palette) {
  const crown = [
    [cx - 33, cy + 24],
    [cx - 28, cy - 4],
    [cx - 11, cy + 11],
    [cx, cy - 13],
    [cx + 11, cy + 11],
    [cx + 28, cy - 4],
    [cx + 33, cy + 24]
  ];
  fillPolygon(pixels, crown, [255, 244, 173, 255]);
  fillPolygon(pixels, crown.map(([x, y]) => [x, y + 5]), [...palette.mid, 120]);
  fillRect(pixels, cx - 31, cy + 20, 62, 10, [245, 158, 11, 255]);
  fillCircle(pixels, cx - 28, cy - 4, 5, [255, 255, 255, 230]);
  fillCircle(pixels, cx, cy - 13, 6, [255, 255, 255, 240]);
  fillCircle(pixels, cx + 28, cy - 4, 5, [255, 255, 255, 230]);
}

function drawNamePlate(pixels, palette, level) {
  const plate = [
    [57, 197],
    [199, 197],
    [211, 216],
    [199, 235],
    [57, 235],
    [45, 216]
  ];
  fillPolygon(pixels, plate, [15, 23, 42, 230]);
  strokePolygon(pixels, plate, [...palette.light, 230], level >= 100 ? 3 : 2);
  fillRect(pixels, 66, 201, 124, 3, [255, 255, 255, 95]);
}

function drawShine(pixels, level) {
  const count = Math.min(34, 8 + Math.floor(level / 8));
  for (let index = 0; index < count; index += 1) {
    const angle = ((index * 137 + level) % 360) * Math.PI / 180;
    const radius = 29 + ((index * 29 + level) % 106);
    const x = 128 + Math.cos(angle) * radius;
    const y = 118 + Math.sin(angle) * radius;
    const size = index % 4 === 0 ? 7 : 4;
    drawLine(pixels, x - size, y, x + size, y, [255, 255, 255, 190], 1);
    drawLine(pixels, x, y - size, x, y + size, [255, 255, 255, 190], 1);
    if (level >= 80 && index % 5 === 0) {
      fillCircle(pixels, x, y, 2, [255, 255, 255, 185]);
    }
  }
}

function drawPixelText(pixels, text, centerX, y, scale, color, shadowColor) {
  const glyphs = [...text].map((char) => FONT[char] ?? FONT[' ']);
  const width = glyphs.reduce((sum, glyph) => sum + glyph[0].length * scale + scale, -scale);
  let x = Math.round(centerX - width / 2);
  drawPixelTextAt(pixels, glyphs, x + 2, y + 2, scale, shadowColor);
  drawPixelTextAt(pixels, glyphs, x, y, scale, color);
}

function drawPixelTextAt(pixels, glyphs, x, y, scale, color) {
  let cursor = x;
  for (const glyph of glyphs) {
    for (let row = 0; row < glyph.length; row += 1) {
      for (let column = 0; column < glyph[row].length; column += 1) {
        if (glyph[row][column] !== '1') continue;
        fillRect(pixels, cursor + column * scale, y + row * scale, scale, scale, color);
      }
    }
    cursor += glyph[0].length * scale + scale;
  }
}

function regularPolygon(cx, cy, radius, sides, rotation = 0) {
  return Array.from({ length: sides }, (_, index) => {
    const angle = rotation + (index / sides) * Math.PI * 2;
    return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius];
  });
}

function starPolygon(cx, cy, outerRadius, innerRadius, points) {
  return Array.from({ length: points * 2 }, (_, index) => {
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    const angle = -Math.PI / 2 + (index / (points * 2)) * Math.PI * 2;
    return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius];
  });
}

function fillPolygon(pixels, points, color) {
  const minY = Math.floor(Math.min(...points.map((point) => point[1])));
  const maxY = Math.ceil(Math.max(...points.map((point) => point[1])));
  const minX = Math.floor(Math.min(...points.map((point) => point[0])));
  const maxX = Math.ceil(Math.max(...points.map((point) => point[0])));

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      let covered = 0;
      for (const [sampleX, sampleY] of EDGE_SAMPLES) {
        if (isPointInPolygon(x + sampleX, y + sampleY, points)) covered += 1;
      }
      if (covered > 0) {
        setPixel(pixels, x, y, withCoverage(color, covered / EDGE_SAMPLES.length));
      }
    }
  }
}

function strokePolygon(pixels, points, color, width) {
  for (let index = 0; index < points.length; index += 1) {
    const nextIndex = (index + 1) % points.length;
    drawLine(pixels, points[index][0], points[index][1], points[nextIndex][0], points[nextIndex][1], color, width);
  }
}

function fillEllipse(pixels, cx, cy, rx, ry, rotation, color) {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  for (let y = Math.floor(cy - rx - ry); y <= Math.ceil(cy + rx + ry); y += 1) {
    for (let x = Math.floor(cx - rx - ry); x <= Math.ceil(cx + rx + ry); x += 1) {
      let covered = 0;
      for (const [sampleX, sampleY] of EDGE_SAMPLES) {
        const dx = x + sampleX - cx;
        const dy = y + sampleY - cy;
        const localX = dx * cos + dy * sin;
        const localY = -dx * sin + dy * cos;
        if ((localX * localX) / (rx * rx) + (localY * localY) / (ry * ry) <= 1) {
          covered += 1;
        }
      }
      if (covered > 0) {
        setPixel(pixels, x, y, withCoverage(color, covered / EDGE_SAMPLES.length));
      }
    }
  }
}

function fillCircle(pixels, cx, cy, radius, color) {
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y += 1) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x += 1) {
      let covered = 0;
      for (const [sampleX, sampleY] of EDGE_SAMPLES) {
        const dx = x + sampleX - cx;
        const dy = y + sampleY - cy;
        if (dx * dx + dy * dy <= radius * radius) covered += 1;
      }
      if (covered > 0) {
        setPixel(pixels, x, y, withCoverage(color, covered / EDGE_SAMPLES.length));
      }
    }
  }
}

function drawCircleStroke(pixels, cx, cy, radius, color, width) {
  const half = width / 2;
  for (let y = Math.floor(cy - radius - width); y <= Math.ceil(cy + radius + width); y += 1) {
    for (let x = Math.floor(cx - radius - width); x <= Math.ceil(cx + radius + width); x += 1) {
      let covered = 0;
      for (const [sampleX, sampleY] of EDGE_SAMPLES) {
        const distance = Math.sqrt((x + sampleX - cx) ** 2 + (y + sampleY - cy) ** 2);
        if (Math.abs(distance - radius) <= half) covered += 1;
      }
      if (covered > 0) {
        setPixel(pixels, x, y, withCoverage(color, covered / EDGE_SAMPLES.length));
      }
    }
  }
}

function drawLine(pixels, x1, y1, x2, y2, color, width = 1) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
  for (let step = 0; step <= steps; step += 1) {
    const t = steps === 0 ? 0 : step / steps;
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t;
    fillCircle(pixels, x, y, width / 2, color);
  }
}

function fillRect(pixels, x, y, width, height, color) {
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      setPixel(pixels, x + column, y + row, color);
    }
  }
}

function setPixel(pixels, x, y, color) {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || px >= WIDTH || py < 0 || py >= HEIGHT) return;
  const offset = (py * WIDTH + px) * 4;
  const alpha = (color[3] ?? 255) / 255;
  const inverse = 1 - alpha;
  pixels[offset] = Math.round(color[0] * alpha + pixels[offset] * inverse);
  pixels[offset + 1] = Math.round(color[1] * alpha + pixels[offset + 1] * inverse);
  pixels[offset + 2] = Math.round(color[2] * alpha + pixels[offset + 2] * inverse);
  pixels[offset + 3] = Math.round(255 * alpha + pixels[offset + 3] * inverse);
}

function isPointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    const intersects = ((yi > y) !== (yj > y))
      && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function withCoverage(color, coverage) {
  return [
    color[0],
    color[1],
    color[2],
    Math.round((color[3] ?? 255) * coverage)
  ];
}

function mix(a, b, t) {
  return [
    Math.round(a[0] * (1 - t) + b[0] * t),
    Math.round(a[1] * (1 - t) + b[1] * t),
    Math.round(a[2] * (1 - t) + b[2] * t)
  ];
}

function encodePng(pixels, width, height) {
  const scanlines = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    scanlines[rowStart] = 0;
    Buffer.from(pixels.buffer, y * width * 4, width * 4).copy(scanlines, rowStart + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', Buffer.concat([
      uint32(width),
      uint32(height),
      Buffer.from([8, 6, 0, 0, 0])
    ])),
    chunk('IDAT', deflateSync(scanlines)),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const body = Buffer.concat([typeBuffer, data]);
  return Buffer.concat([uint32(data.length), body, uint32(crc32(body))]);
}

function uint32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0);
  return buffer;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
