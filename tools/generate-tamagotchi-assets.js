import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, inflateSync } from 'node:zlib';

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(CURRENT_DIR, '..');
const OUTPUT_ROOT = join(REPO_ROOT, 'assets', 'tamagotchi');
const SOURCE_IMAGE = join(OUTPUT_ROOT, 'source', 'heejin.png');
const SKIN_ROOT = join(OUTPUT_ROOT, 'skins');
const DECOR_ROOT = join(OUTPUT_ROOT, 'decorations');
const PREVIEW_ROOT = join(OUTPUT_ROOT, 'preview');
const MANIFEST_PATH = join(OUTPUT_ROOT, 'manifest.json');
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const GROWTH_STAGES = Object.freeze([
  stage('egg', '알', 0, 'warm speckled egg waiting to hatch'),
  stage('infant', '유아기', 1, 'tiny baby Heejin pet with soft round body'),
  stage('child', '유년기', 3, 'playful child Heejin pet'),
  stage('teen', '청소년기', 7, 'sparkly teen Heejin pet'),
  stage('adult', '성년기', 14, 'fully grown Heejin Tamagotchi pet')
]);

const SKINS = Object.freeze([
  skin('classic', '기본 희진', 'source-palette cozy pink pet', '#ff8fb8', 'classic'),
  skin('ribbon', '왕리본 희진', 'giant ribbon and rosy cheeks', '#ff5fa2', 'ribbon'),
  skin('bunny', '토끼 희진', 'soft bunny ears', '#ffd6e8', 'bunny'),
  skin('cat', '고양이 희진', 'cat ears and whiskers', '#f7b267', 'cat'),
  skin('pajama', '잠옷 희진', 'sleepy pajama cap', '#a6c8ff', 'pajama'),
  skin('sailor', '세일러 희진', 'navy sailor collar', '#6aa9ff', 'sailor'),
  skin('strawberry', '딸기 희진', 'strawberry hood', '#ff5d6c', 'strawberry'),
  skin('heart', '하트 희진', 'heart aura', '#ff6fae', 'heart'),
  skin('star', '별빛 희진', 'star hairpin', '#ffd166', 'star'),
  skin('winter', '겨울 희진', 'winter scarf', '#9be7ff', 'winter'),
  skin('spring', '봄꽃 희진', 'flower crown', '#b7ef8a', 'spring'),
  skin('summer', '여름 희진', 'sunny beach hat', '#ffe066', 'summer'),
  skin('autumn', '가을 희진', 'autumn leaf hood', '#d98236', 'autumn'),
  skin('angel', '천사 희진', 'halo and tiny wings', '#fff1a8', 'angel'),
  skin('devil', '악마 희진', 'tiny cute horns', '#d4515d', 'devil'),
  skin('royal', '공주 희진', 'small crown', '#c9a0ff', 'royal'),
  skin('cosmic', '우주 희진', 'space helmet stars', '#8f7cff', 'cosmic'),
  skin('gamer', '게이머 희진', 'pixel headset', '#70e0d4', 'gamer'),
  skin('chef', '셰프 희진', 'chef hat and apron', '#f8f8f8', 'chef'),
  skin('raincoat', '우비 희진', 'yellow rain hood', '#ffd23f', 'raincoat'),
  skin('school', '스쿨 희진', 'school ribbon tie', '#7aa2ff', 'school'),
  skin('cloud', '구름 희진', 'cloud hoodie', '#d9f3ff', 'cloud'),
  skin('cherry', '체리 희진', 'cherry hair pin', '#ff3b58', 'cherry'),
  skin('mint', '민트 희진', 'mint pastel outfit', '#7ef0c1', 'mint')
]);

const DECORATIONS = Object.freeze([
  decor('rice_bowl', '따끈한 밥그릇', 'food', 'warm rice bowl for feeding'),
  decor('strawberry_milk', '딸기우유', 'food', 'cute strawberry milk carton'),
  decor('cake_slice', '케이크 조각', 'food', 'pink cake slice'),
  decor('cookie_box', '쿠키 상자', 'food', 'small cookie snack box'),
  decor('toy_ball', '통통 공', 'toy', 'bouncy toy ball'),
  decor('gamepad', '미니 게임패드', 'toy', 'tiny retro gamepad'),
  decor('rabbit_plush', '토끼 인형', 'toy', 'rabbit plush friend'),
  decor('cat_plush', '고양이 인형', 'toy', 'cat plush friend'),
  decor('bubble_bath', '버블 목욕통', 'care', 'bubble bath tub'),
  decor('comb', '분홍 빗', 'care', 'pink comb'),
  decor('cleaning_spray', '반짝 청소 스프레이', 'care', 'sparkle cleaning spray'),
  decor('medicine_bottle', '하트 약병', 'care', 'medicine bottle with heart label'),
  decor('thermometer', '체온계', 'care', 'tiny thermometer'),
  decor('cozy_bed', '폭신 침대', 'room', 'cozy pixel bed'),
  decor('star_blanket', '별 담요', 'room', 'star pattern blanket'),
  decor('heart_cushion', '하트 쿠션', 'room', 'heart cushion'),
  decor('flower_pot', '꽃 화분', 'room', 'small flower pot'),
  decor('desk_lamp', '무드 램프', 'room', 'warm desk lamp'),
  decor('mirror', '반짝 거울', 'room', 'cute hand mirror'),
  decor('photo_frame', '희진 액자', 'room', 'mini framed portrait'),
  decor('music_note', '음표 스피커', 'room', 'music note speaker'),
  decor('camera', '즉석 카메라', 'tool', 'instant camera'),
  decor('magic_wand', '마법봉', 'tool', 'sparkly magic wand'),
  decor('umbrella', '노란 우산', 'tool', 'yellow umbrella'),
  decor('crown', '미니 왕관', 'tool', 'tiny crown'),
  decor('school_bag', '작은 책가방', 'tool', 'small school bag'),
  decor('book', '분홍 일기장', 'tool', 'pink diary book'),
  decor('fishing_rod', '미니 낚싯대', 'tool', 'tiny fishing rod'),
  decor('keyboard', '하트 키보드', 'tool', 'heart keyboard'),
  decor('star_mobile', '별 모빌', 'room', 'hanging star mobile'),
  decor('cloud_rug', '구름 러그', 'room', 'soft cloud rug'),
  decor('snack_tray', '간식 트레이', 'food', 'assorted snack tray')
]);

function main() {
  mkdirSync(SKIN_ROOT, { recursive: true });
  mkdirSync(DECOR_ROOT, { recursive: true });
  mkdirSync(PREVIEW_ROOT, { recursive: true });

  const source = readPng(SOURCE_IMAGE);
  const palette = samplePalette(source);
  const referencePath = join(PREVIEW_ROOT, 'heejin-reference-pixel.png');
  writePng(createPixelReference(source, 128), referencePath);

  const skins = SKINS.map((config, index) => {
    const imagePath = join(SKIN_ROOT, `${config.id}.png`);
    const stageEntries = GROWTH_STAGES.map((growthStage) => {
      const stageImagePath = join(SKIN_ROOT, config.id, `${growthStage.id}.png`);
      writePng(drawSkin(config, palette, index, growthStage), stageImagePath);
      return {
        id: growthStage.id,
        label: growthStage.label,
        minAgeDays: growthStage.minAgeDays,
        imagePath: toRepoPath(stageImagePath)
      };
    });
    writePng(drawSkin(config, palette, index, GROWTH_STAGES.at(-1)), imagePath);
    return {
      ...config,
      imagePath: toRepoPath(imagePath),
      stages: stageEntries
    };
  });

  const decorations = DECORATIONS.map((config, index) => {
    const imagePath = join(DECOR_ROOT, `${config.id}.png`);
    writePng(drawDecoration(config, palette, index), imagePath);
    return {
      ...config,
      imagePath: toRepoPath(imagePath)
    };
  });

  const skinPreviewPath = join(PREVIEW_ROOT, 'heejin-skins-contact-sheet.png');
  const stagePreviewPath = join(PREVIEW_ROOT, 'heejin-growth-stages.png');
  const decorPreviewPath = join(PREVIEW_ROOT, 'heejin-tools-contact-sheet.png');
  writePng(makeContactSheet(skins.map((item) => readPng(join(REPO_ROOT, item.imagePath))), 6), skinPreviewPath);
  writePng(makeContactSheet(skins[0].stages.map((item) => readPng(join(REPO_ROOT, item.imagePath))), 5), stagePreviewPath);
  writePng(makeContactSheet(decorations.map((item) => readPng(join(REPO_ROOT, item.imagePath))), 8), decorPreviewPath);

  const manifest = {
    generatedAt: new Date().toISOString(),
    sourceImage: toRepoPath(SOURCE_IMAGE),
    style: 'cute pixel-art Tamagotchi sprites derived from the source photo palette',
    palette,
    stages: GROWTH_STAGES,
    reference: {
      imagePath: toRepoPath(referencePath)
    },
    previews: {
      growthStages: toRepoPath(stagePreviewPath),
      skins: toRepoPath(skinPreviewPath),
      decorations: toRepoPath(decorPreviewPath)
    },
    skins,
    decorations
  };

  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  writeFileSync(join(OUTPUT_ROOT, 'README.md'), buildReadme(manifest), 'utf8');
  console.log(`Generated ${skins.length} Heejin skins across ${GROWTH_STAGES.length} growth stages and ${decorations.length} decorations in ${toRepoPath(OUTPUT_ROOT)}.`);
}

function stage(id, label, minAgeDays, prompt) {
  return Object.freeze({ id, label, minAgeDays, prompt });
}

function skin(id, label, prompt, accent, style) {
  return Object.freeze({ id, label, prompt, accent, style });
}

function decor(id, label, category, prompt) {
  return Object.freeze({ id, label, category, prompt });
}

function toRepoPath(filePath) {
  return relative(REPO_ROOT, filePath).split('\\').join('/');
}

function buildReadme(manifest) {
  return [
    '# 희진 다마고치 에셋',
    '',
    '`tools/generate-tamagotchi-assets.js`가 `희진.png`의 색상 팔레트를 샘플링해서 만든 귀여운 도트 스타일 PNG 에셋입니다.',
    '',
    `- 성장 단계: ${manifest.stages.map((stageConfig) => stageConfig.label).join(' → ')}`,
    `- 스킨: ${manifest.skins.length}개`,
    `- 단계별 스킨 이미지: ${manifest.skins.length * manifest.stages.length}개`,
    `- 꾸미기/도구: ${manifest.decorations.length}개`,
    `- 원본 기반 도트 레퍼런스: \`${manifest.reference.imagePath}\``,
    '',
    '재생성:',
    '',
    '```bash',
    'node tools/generate-tamagotchi-assets.js',
    '```',
    ''
  ].join('\n');
}

function readPng(filePath) {
  const buffer = readFileSync(filePath);
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error(`${filePath} is not a PNG file.`);
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idatChunks = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }

  if (bitDepth !== 8 || ![2, 6].includes(colorType) || interlace !== 0) {
    throw new Error(`Unsupported PNG format: bitDepth=${bitDepth}, colorType=${colorType}, interlace=${interlace}`);
  }

  const sourceBytesPerPixel = colorType === 6 ? 4 : 3;
  const rowLength = width * sourceBytesPerPixel;
  const inflated = inflateSync(Buffer.concat(idatChunks));
  const reconstructed = Buffer.alloc(height * rowLength);
  let inputOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[inputOffset];
    inputOffset += 1;
    const rowOffset = y * rowLength;
    const previousRowOffset = (y - 1) * rowLength;

    for (let x = 0; x < rowLength; x += 1) {
      const raw = inflated[inputOffset];
      inputOffset += 1;
      const left = x >= sourceBytesPerPixel ? reconstructed[rowOffset + x - sourceBytesPerPixel] : 0;
      const up = y > 0 ? reconstructed[previousRowOffset + x] : 0;
      const upLeft = y > 0 && x >= sourceBytesPerPixel ? reconstructed[previousRowOffset + x - sourceBytesPerPixel] : 0;
      reconstructed[rowOffset + x] = (raw + predict(filter, left, up, upLeft)) & 0xff;
    }
  }

  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0, j = 0; i < reconstructed.length; i += sourceBytesPerPixel, j += 4) {
    data[j] = reconstructed[i];
    data[j + 1] = reconstructed[i + 1];
    data[j + 2] = reconstructed[i + 2];
    data[j + 3] = colorType === 6 ? reconstructed[i + 3] : 255;
  }

  return { width, height, data };
}

function predict(filter, left, up, upLeft) {
  if (filter === 0) return 0;
  if (filter === 1) return left;
  if (filter === 2) return up;
  if (filter === 3) return Math.floor((left + up) / 2);
  if (filter === 4) return paeth(left, up, upLeft);
  throw new Error(`Unsupported PNG filter ${filter}`);
}

function paeth(left, up, upLeft) {
  const p = left + up - upLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - up);
  const pc = Math.abs(p - upLeft);
  if (pa <= pb && pa <= pc) return left;
  if (pb <= pc) return up;
  return upLeft;
}

function writePng(canvas, filePath) {
  mkdirSync(dirname(filePath), { recursive: true });
  const raw = Buffer.alloc(canvas.height * (canvas.width * 4 + 1));
  for (let y = 0; y < canvas.height; y += 1) {
    const rowStart = y * (canvas.width * 4 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < canvas.width * 4; x += 1) {
      raw[rowStart + 1 + x] = canvas.data[y * canvas.width * 4 + x];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(canvas.width, 0);
  ihdr.writeUInt32BE(canvas.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  writeFileSync(filePath, Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0))
  ]));
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBuffer.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return chunk;
}

let crcTable = null;
function crc32(buffer) {
  if (!crcTable) {
    crcTable = Array.from({ length: 256 }, (_, index) => {
      let crc = index;
      for (let bit = 0; bit < 8; bit += 1) {
        crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
      }
      return crc >>> 0;
    });
  }

  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function samplePalette(image) {
  const pixels = [];
  const stride = Math.max(1, Math.floor(Math.sqrt(image.width * image.height / 9000)));
  for (let y = 0; y < image.height; y += stride) {
    for (let x = 0; x < image.width; x += stride) {
      const [r, g, b, a] = pixelAt(image, x, y);
      if (a < 32) continue;
      const brightness = (r + g + b) / 3;
      const saturation = Math.max(r, g, b) - Math.min(r, g, b);
      pixels.push({ r, g, b, brightness, saturation });
    }
  }

  pixels.sort((a, b) => a.brightness - b.brightness);
  const dark = averageColor(pixels.slice(0, Math.max(1, Math.floor(pixels.length * 0.18))), [72, 49, 52]);
  const light = averageColor(pixels.slice(Math.floor(pixels.length * 0.72)), [245, 211, 196]);
  const mid = averageColor(pixels.slice(Math.floor(pixels.length * 0.35), Math.floor(pixels.length * 0.65)), [206, 126, 142]);
  const saturated = [...pixels].sort((a, b) => b.saturation - a.saturation);
  const accent = averageColor(saturated.slice(0, Math.max(1, Math.floor(saturated.length * 0.12))), [255, 143, 184]);

  return {
    sourceDark: rgbToHex(darken(dark, 0.82)),
    sourceMid: rgbToHex(mid),
    sourceLight: rgbToHex(lighten(light, 1.04)),
    sourceAccent: rgbToHex(lighten(accent, 1.05)),
    outline: '#4b3038',
    blush: '#ff9ebc',
    shadow: '#00000033'
  };
}

function averageColor(items, fallback) {
  if (items.length === 0) return fallback;
  const total = items.reduce((sum, item) => {
    sum[0] += item.r;
    sum[1] += item.g;
    sum[2] += item.b;
    return sum;
  }, [0, 0, 0]);
  return total.map((value) => Math.round(value / items.length));
}

function rgbToHex([r, g, b]) {
  return `#${[r, g, b].map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0')).join('')}`;
}

function hexToRgba(hex, alpha = 255) {
  const normalized = hex.replace('#', '');
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return [r, g, b, alpha];
}

function lighten(color, factor) {
  return color.map((value) => clamp(value * factor + 255 * (factor - 1) * 0.15, 0, 255));
}

function darken(color, factor) {
  return color.map((value) => clamp(value * factor, 0, 255));
}

function createCanvas(width, height, background = [0, 0, 0, 0]) {
  const data = new Uint8ClampedArray(width * height * 4);
  const canvas = { width, height, data };
  fillRect(canvas, 0, 0, width, height, background);
  return canvas;
}

function createPixelReference(source, size) {
  const canvas = createCanvas(size, size, [255, 236, 244, 255]);
  const cropSize = Math.min(source.width, source.height);
  const cropX = Math.floor((source.width - cropSize) / 2);
  const cropY = Math.floor((source.height - cropSize) / 2);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const startX = cropX + Math.floor(x * cropSize / size);
      const endX = cropX + Math.floor((x + 1) * cropSize / size);
      const startY = cropY + Math.floor(y * cropSize / size);
      const endY = cropY + Math.floor((y + 1) * cropSize / size);
      setPixel(canvas, x, y, averageRegion(source, startX, startY, Math.max(1, endX - startX), Math.max(1, endY - startY)));
    }
  }

  return canvas;
}

function averageRegion(image, x, y, width, height) {
  const sum = [0, 0, 0, 0];
  let count = 0;
  for (let yy = y; yy < y + height; yy += 1) {
    for (let xx = x; xx < x + width; xx += 1) {
      const pixel = pixelAt(image, clamp(xx, 0, image.width - 1), clamp(yy, 0, image.height - 1));
      sum[0] += pixel[0];
      sum[1] += pixel[1];
      sum[2] += pixel[2];
      sum[3] += pixel[3];
      count += 1;
    }
  }
  return sum.map((value) => Math.round(value / count));
}

function drawSkin(config, palette, index, growthStage = GROWTH_STAGES.at(-1)) {
  const canvas = createCanvas(160, 160, [0, 0, 0, 0]);
  const sourceLight = hexToRgba(palette.sourceLight);
  const sourceMid = hexToRgba(palette.sourceMid);
  const sourceDark = hexToRgba(palette.sourceDark);
  const accent = hexToRgba(config.accent);
  const outline = hexToRgba(palette.outline);
  const blush = hexToRgba(palette.blush);
  const pastelBg = mixColor(accent, [255, 255, 255, 255], 0.82);

  if (growthStage.id === 'egg') {
    drawEggStage(canvas, accent, outline, sourceLight, sourceMid, pastelBg, index);
    return canvas;
  }

  if (growthStage.id === 'infant') {
    drawInfantStage(canvas, accent, outline, sourceLight, sourceDark, blush, pastelBg, index);
    return canvas;
  }

  drawPixelOval(canvas, 80, 146, 42, 9, [0, 0, 0, 44], 4);
  drawPixelOval(canvas, 80, 84, 50, 58, outline, 4);
  drawPixelOval(canvas, 80, 84, 45, 53, sourceLight, 4);
  drawPixelOval(canvas, 80, 55, 43, 28, sourceDark, 4);
  fillRect(canvas, 40, 50, 12, 36, sourceDark);
  fillRect(canvas, 108, 50, 12, 36, sourceDark);
  fillRect(canvas, 50, 40, 60, 14, sourceDark);
  fillRect(canvas, 48, 70, 10, 12, sourceMid);
  fillRect(canvas, 102, 70, 10, 12, sourceMid);

  drawPixelOval(canvas, 80, 118, 34, 24, outline, 4);
  drawPixelOval(canvas, 80, 116, 29, 20, accent, 4);
  fillRect(canvas, 60, 101, 40, 10, mixColor(accent, [255, 255, 255, 255], 0.35));

  drawFace(canvas, outline, blush);
  addBaseSparkles(canvas, pastelBg, index);
  drawStyle(canvas, config.style, accent, outline, sourceLight, sourceDark, sourceMid);
  drawGrowthStageDetails(canvas, growthStage.id, accent, outline, sourceLight);
  return canvas;
}

function drawEggStage(canvas, accent, outline, sourceLight, sourceMid, pastelBg, index) {
  drawPixelOval(canvas, 80, 143, 38, 8, [0, 0, 0, 42], 4);
  drawPixelOval(canvas, 80, 84, 43, 58, outline, 4);
  drawPixelOval(canvas, 80, 84, 37, 52, sourceLight, 4);
  fillRect(canvas, 51, 78, 12, 8, sourceMid);
  fillRect(canvas, 95, 62, 14, 8, accent);
  fillRect(canvas, 71, 103, 10, 8, accent);
  fillRect(canvas, 60, 44, 16, 5, outline);
  fillRect(canvas, 73, 49, 5, 12, outline);
  fillRect(canvas, 78, 61, 15, 5, outline);
  fillRect(canvas, 93, 66, 5, 10, outline);
  drawHeart(canvas, 82, 92, accent, 0.58);
  addBaseSparkles(canvas, pastelBg, index);
}

function drawInfantStage(canvas, accent, outline, sourceLight, sourceDark, blush, pastelBg, index) {
  drawPixelOval(canvas, 80, 140, 34, 7, [0, 0, 0, 42], 4);
  drawPixelOval(canvas, 80, 88, 39, 43, outline, 4);
  drawPixelOval(canvas, 80, 88, 34, 38, sourceLight, 4);
  drawPixelOval(canvas, 80, 58, 30, 18, sourceDark, 4);
  fillRect(canvas, 55, 60, 9, 23, sourceDark);
  fillRect(canvas, 96, 60, 9, 23, sourceDark);
  drawPixelOval(canvas, 80, 119, 27, 19, outline, 4);
  drawPixelOval(canvas, 80, 117, 23, 15, accent, 4);
  drawFace(canvas, outline, blush);
  drawPixelOval(canvas, 80, 102, 8, 7, [255, 236, 245, 255], 2);
  fillRect(canvas, 76, 100, 8, 4, outline);
  drawHeart(canvas, 117, 49, accent, 0.55);
  addBaseSparkles(canvas, pastelBg, index);
}

function drawGrowthStageDetails(canvas, stageId, accent, outline, sourceLight) {
  if (stageId === 'child') {
    drawPixelOval(canvas, 34, 125, 12, 12, outline, 3);
    drawPixelOval(canvas, 34, 125, 8, 8, accent, 3);
    fillRect(canvas, 50, 111, 13, 13, [255, 247, 180, 255]);
    fillRect(canvas, 55, 107, 4, 21, outline);
  } else if (stageId === 'teen') {
    drawStar(canvas, 113, 31, accent, 0.7);
    fillRect(canvas, 43, 104, 74, 8, [255, 255, 255, 210]);
    fillRect(canvas, 52, 128, 56, 6, accent);
  } else if (stageId === 'adult') {
    drawPixelOval(canvas, 122, 109, 12, 17, sourceLight, 4);
    fillRect(canvas, 118, 105, 12, 4, outline);
    drawSparkle(canvas, 33, 45, accent);
  }
}

function drawFace(canvas, outline, blush) {
  fillRect(canvas, 60, 78, 8, 12, outline);
  fillRect(canvas, 92, 78, 8, 12, outline);
  fillRect(canvas, 63, 78, 2, 3, [255, 255, 255, 255]);
  fillRect(canvas, 95, 78, 2, 3, [255, 255, 255, 255]);
  fillRect(canvas, 54, 94, 12, 6, blush);
  fillRect(canvas, 94, 94, 12, 6, blush);
  fillRect(canvas, 74, 96, 12, 4, outline);
  fillRect(canvas, 78, 100, 4, 4, outline);
}

function addBaseSparkles(canvas, color, index) {
  const points = [
    [21 + (index % 4) * 2, 31], [132 - (index % 3) * 3, 32],
    [28, 120 - (index % 5)], [132, 116 + (index % 4)]
  ];
  for (const [x, y] of points) drawSparkle(canvas, x, y, color);
}

function drawStyle(canvas, style, accent, outline, sourceLight, sourceDark, sourceMid) {
  if (style === 'classic') {
    drawHeart(canvas, 118, 44, accent);
  } else if (style === 'ribbon') {
    drawBow(canvas, 80, 31, accent, outline);
  } else if (style === 'bunny') {
    drawEar(canvas, 48, 27, -1, accent, outline);
    drawEar(canvas, 112, 27, 1, accent, outline);
  } else if (style === 'cat') {
    drawTriangle(canvas, 47, 38, 19, 24, outline);
    drawTriangle(canvas, 48, 43, 13, 15, accent);
    drawTriangle(canvas, 94, 38, 19, 24, outline);
    drawTriangle(canvas, 99, 43, 13, 15, accent);
    fillRect(canvas, 45, 90, 18, 3, outline);
    fillRect(canvas, 97, 90, 18, 3, outline);
  } else if (style === 'pajama') {
    fillRect(canvas, 52, 31, 52, 14, accent);
    fillRect(canvas, 92, 21, 18, 18, accent);
    drawPixelOval(canvas, 112, 24, 8, 8, [255, 255, 255, 255], 4);
    fillRect(canvas, 58, 108, 44, 9, mixColor(accent, [255, 255, 255, 255], 0.45));
  } else if (style === 'sailor') {
    fillRect(canvas, 52, 104, 56, 10, [255, 255, 255, 255]);
    fillRect(canvas, 58, 114, 44, 8, [45, 77, 150, 255]);
    drawTriangle(canvas, 70, 111, 20, 22, [45, 77, 150, 255]);
  } else if (style === 'strawberry') {
    fillRect(canvas, 48, 33, 64, 19, accent);
    drawLeaf(canvas, 76, 24, [89, 184, 95, 255]);
    for (const seed of [[58, 39], [74, 44], [91, 38], [103, 46]]) fillRect(canvas, seed[0], seed[1], 4, 4, [255, 236, 160, 255]);
  } else if (style === 'heart') {
    drawHeart(canvas, 36, 46, accent);
    drawHeart(canvas, 116, 36, accent);
    drawHeart(canvas, 122, 118, accent);
  } else if (style === 'star') {
    drawStar(canvas, 105, 39, accent);
    drawStar(canvas, 33, 117, accent);
  } else if (style === 'winter') {
    fillRect(canvas, 50, 103, 60, 12, accent);
    fillRect(canvas, 98, 110, 12, 24, accent);
    drawPixelOval(canvas, 80, 36, 34, 13, [255, 255, 255, 255], 4);
  } else if (style === 'spring') {
    for (const flower of [[55, 38], [72, 31], [89, 31], [106, 39]]) drawFlower(canvas, flower[0], flower[1], accent);
  } else if (style === 'summer') {
    fillRect(canvas, 42, 31, 76, 10, accent);
    fillRect(canvas, 57, 18, 46, 18, accent);
    fillRect(canvas, 62, 24, 36, 5, [255, 180, 94, 255]);
  } else if (style === 'autumn') {
    drawLeaf(canvas, 57, 34, accent);
    drawLeaf(canvas, 96, 35, [198, 91, 44, 255]);
    fillRect(canvas, 56, 106, 48, 10, [143, 92, 56, 255]);
  } else if (style === 'angel') {
    fillRect(canvas, 62, 19, 36, 6, accent);
    fillRect(canvas, 57, 25, 46, 4, [255, 255, 255, 255]);
    drawWing(canvas, 24, 82, -1);
    drawWing(canvas, 136, 82, 1);
  } else if (style === 'devil') {
    drawTriangle(canvas, 51, 32, 15, 20, accent);
    drawTriangle(canvas, 94, 32, 15, 20, accent);
    fillRect(canvas, 70, 116, 20, 7, [86, 36, 48, 255]);
  } else if (style === 'royal') {
    drawCrown(canvas, 63, 20, accent, outline);
  } else if (style === 'cosmic') {
    drawPixelOval(canvas, 80, 76, 58, 63, [181, 212, 255, 88], 4);
    drawStar(canvas, 35, 32, [255, 241, 153, 255]);
    drawStar(canvas, 124, 53, [255, 241, 153, 255]);
    fillRect(canvas, 52, 112, 56, 12, [48, 39, 92, 255]);
  } else if (style === 'gamer') {
    fillRect(canvas, 42, 64, 10, 34, outline);
    fillRect(canvas, 108, 64, 10, 34, outline);
    fillRect(canvas, 50, 50, 60, 8, accent);
    fillRect(canvas, 108, 94, 18, 5, accent);
  } else if (style === 'chef') {
    drawPixelOval(canvas, 63, 29, 17, 14, [255, 255, 255, 255], 4);
    drawPixelOval(canvas, 82, 25, 20, 17, [255, 255, 255, 255], 4);
    drawPixelOval(canvas, 101, 30, 17, 14, [255, 255, 255, 255], 4);
    fillRect(canvas, 55, 40, 54, 12, [255, 255, 255, 255]);
    fillRect(canvas, 68, 110, 24, 20, [255, 255, 255, 255]);
  } else if (style === 'raincoat') {
    fillRect(canvas, 45, 31, 70, 24, accent);
    drawPixelOval(canvas, 80, 57, 41, 28, accent, 4);
    fillRect(canvas, 56, 109, 48, 16, accent);
  } else if (style === 'school') {
    fillRect(canvas, 55, 106, 50, 16, [43, 64, 112, 255]);
    drawBow(canvas, 80, 109, accent, outline, 0.55);
  } else if (style === 'cloud') {
    drawPixelOval(canvas, 52, 41, 21, 15, accent, 4);
    drawPixelOval(canvas, 76, 35, 29, 19, accent, 4);
    drawPixelOval(canvas, 105, 42, 22, 15, accent, 4);
    fillRect(canvas, 52, 43, 62, 12, accent);
  } else if (style === 'cherry') {
    drawCherry(canvas, 101, 34, accent);
    fillRect(canvas, 60, 110, 40, 8, [255, 246, 250, 255]);
  } else if (style === 'mint') {
    fillRect(canvas, 50, 103, 60, 14, accent);
    fillRect(canvas, 62, 118, 36, 10, mixColor(accent, [255, 255, 255, 255], 0.5));
  }

  fillRect(canvas, 52, 129, 56, 4, mixColor(sourceMid, sourceDark, 0.35));
}

function drawDecoration(config, palette, index) {
  const canvas = createCanvas(96, 96, [0, 0, 0, 0]);
  const accent = hexToRgba(['#ff8fb8', '#ffd166', '#7ef0c1', '#9be7ff', '#c9a0ff', '#f7b267'][index % 6]);
  const outline = hexToRgba(palette.outline);
  const light = hexToRgba(palette.sourceLight);
  const dark = hexToRgba(palette.sourceDark);
  drawDecorBackdrop(canvas, accent, index);
  drawPixelOval(canvas, 48, 84, 30, 7, [0, 0, 0, 36], 3);

  switch (config.id) {
    case 'rice_bowl':
      drawBowl(canvas, 28, 50, accent, outline); break;
    case 'strawberry_milk':
      drawCarton(canvas, 32, 24, [255, 188, 212, 255], outline); break;
    case 'cake_slice':
      drawCake(canvas, 24, 43, accent, outline); break;
    case 'cookie_box':
      drawBox(canvas, 23, 38, [222, 162, 94, 255], outline); break;
    case 'toy_ball':
      drawPixelOval(canvas, 48, 51, 24, 24, outline, 3); drawPixelOval(canvas, 48, 51, 20, 20, accent, 3); fillRect(canvas, 29, 48, 38, 6, [255, 255, 255, 190]); break;
    case 'gamepad':
      drawGamepad(canvas, 21, 43, accent, outline); break;
    case 'rabbit_plush':
      drawPlush(canvas, 48, 52, 'rabbit', accent, outline); break;
    case 'cat_plush':
      drawPlush(canvas, 48, 52, 'cat', accent, outline); break;
    case 'bubble_bath':
      drawTub(canvas, 18, 48, [135, 216, 255, 255], outline); break;
    case 'comb':
      fillRect(canvas, 24, 34, 46, 12, accent); for (let x = 28; x < 68; x += 6) fillRect(canvas, x, 46, 3, 26, outline); break;
    case 'cleaning_spray':
      drawSpray(canvas, 35, 29, [130, 232, 204, 255], outline); break;
    case 'medicine_bottle':
      drawBottle(canvas, 36, 22, [255, 255, 255, 255], outline); drawHeart(canvas, 47, 52, [255, 111, 174, 255], 0.55); break;
    case 'thermometer':
      fillRect(canvas, 44, 18, 9, 50, [255, 255, 255, 255]); fillRect(canvas, 47, 24, 3, 36, [244, 72, 88, 255]); drawPixelOval(canvas, 48, 70, 10, 10, [244, 72, 88, 255], 2); break;
    case 'cozy_bed':
      drawBed(canvas, 18, 42, accent, outline); break;
    case 'star_blanket':
      fillRect(canvas, 21, 43, 54, 30, accent); drawStar(canvas, 45, 54, [255, 241, 153, 255], 0.7); fillRect(canvas, 18, 70, 60, 8, outline); break;
    case 'heart_cushion':
      drawHeart(canvas, 48, 48, accent, 1.4); break;
    case 'flower_pot':
      drawFlowerPot(canvas, 37, 31, accent, outline); break;
    case 'desk_lamp':
      drawLamp(canvas, 35, 27, [255, 224, 120, 255], outline); break;
    case 'mirror':
      drawPixelOval(canvas, 48, 42, 22, 26, outline, 3); drawPixelOval(canvas, 48, 42, 17, 21, [190, 230, 255, 255], 3); fillRect(canvas, 44, 66, 8, 18, outline); break;
    case 'photo_frame':
      drawFrame(canvas, 24, 23, light, outline, dark); break;
    case 'music_note':
      drawMusic(canvas, 37, 22, accent, outline); break;
    case 'camera':
      drawCamera(canvas, 22, 39, accent, outline); break;
    case 'magic_wand':
      drawWand(canvas, 28, 30, accent, outline); break;
    case 'umbrella':
      drawUmbrella(canvas, 22, 25, accent, outline); break;
    case 'crown':
      drawCrown(canvas, 27, 31, accent, outline, 1.25); break;
    case 'school_bag':
      drawBag(canvas, 28, 30, accent, outline); break;
    case 'book':
      drawBook(canvas, 26, 32, accent, outline); break;
    case 'fishing_rod':
      fillRect(canvas, 25, 71, 48, 4, outline); fillRect(canvas, 68, 38, 4, 34, outline); fillRect(canvas, 58, 36, 13, 3, [180, 220, 255, 255]); drawPixelOval(canvas, 58, 50, 5, 7, [135, 216, 255, 255], 2); break;
    case 'keyboard':
      drawKeyboard(canvas, 18, 45, accent, outline); break;
    case 'star_mobile':
      fillRect(canvas, 28, 20, 40, 4, outline); for (const point of [[32, 42], [49, 55], [66, 40]]) { fillRect(canvas, point[0], 24, 2, point[1] - 24, outline); drawStar(canvas, point[0], point[1], [255, 241, 153, 255], 0.65); } break;
    case 'cloud_rug':
      drawPixelOval(canvas, 35, 59, 20, 13, [224, 246, 255, 255], 3); drawPixelOval(canvas, 52, 54, 25, 16, [224, 246, 255, 255], 3); drawPixelOval(canvas, 65, 61, 18, 12, [224, 246, 255, 255], 3); break;
    case 'snack_tray':
      drawTray(canvas, 22, 51, accent, outline); break;
    default:
      drawSparkle(canvas, 48, 48, accent);
  }

  drawDecorPolish(canvas, accent, index);
  return canvas;
}

function drawDecorBackdrop(canvas, accent, index) {
  const glow = mixColor(accent, [255, 255, 255, 255], 0.68);
  drawPixelOval(canvas, 48, 52, 39, 34, [glow[0], glow[1], glow[2], 58], 4);
  if (index % 3 === 0) {
    drawPixelOval(canvas, 48, 52, 42, 36, [255, 255, 255, 34], 4);
  }
}

function drawDecorPolish(canvas, accent, index) {
  drawSparkle(canvas, 17 + (index % 4) * 3, 21 + (index % 3) * 3, [255, 255, 255, 180]);
  if (index % 2 === 0) {
    drawTinyHeart(canvas, 74, 22 + (index % 5), accent);
  } else {
    drawTinyStar(canvas, 73, 23 + (index % 5), [255, 241, 153, 220]);
  }
  fillRect(canvas, 32, 78, 32, 3, [255, 255, 255, 65]);
}

function drawTinyHeart(canvas, cx, cy, color) {
  drawHeart(canvas, cx, cy, [color[0], color[1], color[2], 210], 0.38);
}

function drawTinyStar(canvas, cx, cy, color) {
  drawStar(canvas, cx, cy, color, 0.42);
}

function makeContactSheet(images, columns) {
  const cell = Math.max(96, ...images.map((image) => Math.max(image.width, image.height)));
  const rows = Math.ceil(images.length / columns);
  const canvas = createCanvas(columns * cell, rows * cell, [255, 240, 247, 255]);
  images.forEach((image, index) => {
    const x = (index % columns) * cell + Math.floor((cell - image.width) / 2);
    const y = Math.floor(index / columns) * cell + Math.floor((cell - image.height) / 2);
    blit(canvas, image, x, y);
  });
  return canvas;
}

function pixelAt(image, x, y) {
  const offset = (y * image.width + x) * 4;
  return [image.data[offset], image.data[offset + 1], image.data[offset + 2], image.data[offset + 3]];
}

function setPixel(canvas, x, y, color) {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
  const offset = (Math.floor(y) * canvas.width + Math.floor(x)) * 4;
  const alpha = (color[3] ?? 255) / 255;
  if (alpha >= 1) {
    canvas.data[offset] = color[0];
    canvas.data[offset + 1] = color[1];
    canvas.data[offset + 2] = color[2];
    canvas.data[offset + 3] = color[3] ?? 255;
    return;
  }
  const inverse = 1 - alpha;
  canvas.data[offset] = Math.round(color[0] * alpha + canvas.data[offset] * inverse);
  canvas.data[offset + 1] = Math.round(color[1] * alpha + canvas.data[offset + 1] * inverse);
  canvas.data[offset + 2] = Math.round(color[2] * alpha + canvas.data[offset + 2] * inverse);
  canvas.data[offset + 3] = Math.round((color[3] ?? 255) + canvas.data[offset + 3] * inverse);
}

function fillRect(canvas, x, y, width, height, color) {
  for (let yy = Math.floor(y); yy < Math.floor(y + height); yy += 1) {
    for (let xx = Math.floor(x); xx < Math.floor(x + width); xx += 1) {
      setPixel(canvas, xx, yy, color);
    }
  }
}

function drawPixelOval(canvas, cx, cy, rx, ry, color, block = 4) {
  for (let y = cy - ry; y <= cy + ry; y += block) {
    for (let x = cx - rx; x <= cx + rx; x += block) {
      const nx = (x + block / 2 - cx) / rx;
      const ny = (y + block / 2 - cy) / ry;
      if (nx * nx + ny * ny <= 1) fillRect(canvas, x, y, block, block, color);
    }
  }
}

function drawTriangle(canvas, x, y, width, height, color) {
  for (let yy = 0; yy < height; yy += 1) {
    const rowWidth = Math.floor(width * (yy / Math.max(1, height - 1)));
    fillRect(canvas, x + Math.floor((width - rowWidth) / 2), y + yy, rowWidth, 1, color);
  }
}

function drawHeart(canvas, cx, cy, color, scale = 1) {
  const s = Math.max(1, Math.round(4 * scale));
  const pattern = [
    [0, 1, 1, 0, 1, 1, 0],
    [1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1],
    [0, 1, 1, 1, 1, 1, 0],
    [0, 0, 1, 1, 1, 0, 0],
    [0, 0, 0, 1, 0, 0, 0]
  ];
  const startX = cx - Math.floor(pattern[0].length * s / 2);
  const startY = cy - Math.floor(pattern.length * s / 2);
  pattern.forEach((row, y) => row.forEach((value, x) => {
    if (value) fillRect(canvas, startX + x * s, startY + y * s, s, s, color);
  }));
}

function drawStar(canvas, cx, cy, color, scale = 1) {
  const s = Math.max(1, Math.round(4 * scale));
  const pattern = [
    [0, 0, 1, 0, 0],
    [0, 1, 1, 1, 0],
    [1, 1, 1, 1, 1],
    [0, 1, 1, 1, 0],
    [0, 1, 0, 1, 0]
  ];
  const startX = cx - Math.floor(pattern[0].length * s / 2);
  const startY = cy - Math.floor(pattern.length * s / 2);
  pattern.forEach((row, y) => row.forEach((value, x) => {
    if (value) fillRect(canvas, startX + x * s, startY + y * s, s, s, color);
  }));
}

function drawSparkle(canvas, cx, cy, color) {
  fillRect(canvas, cx, cy - 8, 4, 20, color);
  fillRect(canvas, cx - 8, cy, 20, 4, color);
  fillRect(canvas, cx - 4, cy - 4, 12, 12, [255, 255, 255, 170]);
}

function drawBow(canvas, cx, cy, color, outline, scale = 1) {
  const s = scale;
  fillRect(canvas, cx - 26 * s, cy - 9 * s, 22 * s, 18 * s, outline);
  fillRect(canvas, cx + 4 * s, cy - 9 * s, 22 * s, 18 * s, outline);
  fillRect(canvas, cx - 22 * s, cy - 6 * s, 18 * s, 12 * s, color);
  fillRect(canvas, cx + 4 * s, cy - 6 * s, 18 * s, 12 * s, color);
  fillRect(canvas, cx - 5 * s, cy - 7 * s, 10 * s, 14 * s, color);
}

function drawEar(canvas, cx, cy, direction, color, outline) {
  drawPixelOval(canvas, cx, cy, 10, 28, outline, 4);
  drawPixelOval(canvas, cx + direction * 1, cy + 2, 6, 22, [255, 220, 235, 255], 4);
  fillRect(canvas, cx - 5, cy + 21, 10, 13, color);
}

function drawLeaf(canvas, x, y, color) {
  fillRect(canvas, x + 8, y, 6, 24, [77, 111, 57, 255]);
  drawPixelOval(canvas, x, y + 7, 14, 8, color, 3);
  drawPixelOval(canvas, x + 18, y + 10, 14, 8, color, 3);
}

function drawFlower(canvas, x, y, color) {
  drawPixelOval(canvas, x - 5, y, 6, 6, color, 2);
  drawPixelOval(canvas, x + 5, y, 6, 6, color, 2);
  drawPixelOval(canvas, x, y - 5, 6, 6, color, 2);
  drawPixelOval(canvas, x, y + 5, 6, 6, color, 2);
  fillRect(canvas, x - 2, y - 2, 4, 4, [255, 230, 96, 255]);
}

function drawWing(canvas, cx, cy, direction) {
  drawPixelOval(canvas, cx, cy, 19, 26, [255, 255, 255, 230], 4);
  fillRect(canvas, cx + direction * 3, cy - 8, 16 * direction, 7, [226, 237, 255, 255]);
  fillRect(canvas, cx + direction * 3, cy + 5, 13 * direction, 7, [226, 237, 255, 255]);
}

function drawCrown(canvas, x, y, color, outline, scale = 1) {
  const s = scale;
  fillRect(canvas, x, y + 19 * s, 38 * s, 9 * s, outline);
  fillRect(canvas, x + 4 * s, y + 16 * s, 30 * s, 8 * s, color);
  drawTriangle(canvas, x + 2 * s, y, 10 * s, 20 * s, color);
  drawTriangle(canvas, x + 14 * s, y - 3 * s, 11 * s, 23 * s, color);
  drawTriangle(canvas, x + 28 * s, y, 10 * s, 20 * s, color);
}

function drawCherry(canvas, x, y, color) {
  fillRect(canvas, x - 4, y - 13, 4, 17, [62, 134, 67, 255]);
  fillRect(canvas, x + 8, y - 15, 4, 20, [62, 134, 67, 255]);
  drawPixelOval(canvas, x - 7, y + 5, 8, 8, color, 2);
  drawPixelOval(canvas, x + 9, y + 5, 8, 8, color, 2);
}

function drawBowl(canvas, x, y, color, outline) {
  fillRect(canvas, x + 4, y - 17, 34, 13, [255, 255, 255, 255]);
  drawPixelOval(canvas, x + 21, y, 27, 17, outline, 3);
  drawPixelOval(canvas, x + 21, y - 3, 22, 12, color, 3);
}

function drawCarton(canvas, x, y, color, outline) {
  fillRect(canvas, x, y + 14, 32, 44, outline);
  fillRect(canvas, x + 4, y + 18, 24, 36, color);
  drawTriangle(canvas, x, y, 32, 17, outline);
  drawTriangle(canvas, x + 4, y + 4, 24, 13, color);
  drawHeart(canvas, x + 16, y + 39, [255, 79, 135, 255], 0.55);
}

function drawCake(canvas, x, y, color, outline) {
  drawTriangle(canvas, x, y, 52, 30, outline);
  drawTriangle(canvas, x + 4, y + 4, 44, 23, color);
  fillRect(canvas, x + 9, y + 13, 31, 5, [255, 255, 255, 255]);
  fillRect(canvas, x + 14, y - 8, 4, 12, [255, 220, 101, 255]);
}

function drawBox(canvas, x, y, color, outline) {
  fillRect(canvas, x, y, 50, 36, outline);
  fillRect(canvas, x + 4, y + 4, 42, 28, color);
  for (const point of [[x + 13, y + 14], [x + 29, y + 19], [x + 37, y + 11]]) drawPixelOval(canvas, point[0], point[1], 4, 4, [107, 65, 45, 255], 2);
}

function drawGamepad(canvas, x, y, color, outline) {
  fillRect(canvas, x, y, 54, 25, outline);
  fillRect(canvas, x + 4, y + 4, 46, 17, color);
  fillRect(canvas, x + 10, y + 10, 14, 4, outline);
  fillRect(canvas, x + 15, y + 5, 4, 14, outline);
  drawPixelOval(canvas, x + 38, y + 11, 4, 4, outline, 2);
  drawPixelOval(canvas, x + 46, y + 15, 4, 4, outline, 2);
}

function drawPlush(canvas, cx, cy, type, color, outline) {
  if (type === 'rabbit') {
    drawEar(canvas, cx - 10, cy - 27, -1, color, outline);
    drawEar(canvas, cx + 10, cy - 27, 1, color, outline);
  } else {
    drawTriangle(canvas, cx - 23, cy - 31, 15, 20, outline);
    drawTriangle(canvas, cx + 7, cy - 31, 15, 20, outline);
  }
  drawPixelOval(canvas, cx, cy - 8, 25, 26, outline, 3);
  drawPixelOval(canvas, cx, cy - 8, 21, 22, color, 3);
  fillRect(canvas, cx - 9, cy - 13, 5, 6, outline);
  fillRect(canvas, cx + 7, cy - 13, 5, 6, outline);
  fillRect(canvas, cx - 4, cy, 8, 4, outline);
}

function drawTub(canvas, x, y, color, outline) {
  fillRect(canvas, x, y, 60, 24, outline);
  fillRect(canvas, x + 5, y + 5, 50, 14, color);
  for (const point of [[x + 10, y - 8], [x + 25, y - 12], [x + 43, y - 7]]) drawPixelOval(canvas, point[0], point[1], 7, 7, [255, 255, 255, 230], 2);
}

function drawSpray(canvas, x, y, color, outline) {
  fillRect(canvas, x + 8, y, 18, 10, outline);
  fillRect(canvas, x, y + 13, 34, 46, outline);
  fillRect(canvas, x + 5, y + 18, 24, 36, color);
  fillRect(canvas, x + 34, y + 7, 18, 5, outline);
  drawSparkle(canvas, x + 56, y + 21, [255, 255, 255, 220]);
}

function drawBottle(canvas, x, y, color, outline) {
  fillRect(canvas, x + 10, y, 14, 12, outline);
  fillRect(canvas, x, y + 12, 34, 52, outline);
  fillRect(canvas, x + 5, y + 17, 24, 42, color);
}

function drawBed(canvas, x, y, color, outline) {
  fillRect(canvas, x, y + 16, 64, 28, outline);
  fillRect(canvas, x + 5, y + 21, 54, 18, color);
  fillRect(canvas, x + 7, y, 23, 20, [255, 255, 255, 255]);
  fillRect(canvas, x + 4, y + 43, 8, 12, outline);
  fillRect(canvas, x + 52, y + 43, 8, 12, outline);
}

function drawFlowerPot(canvas, x, y, color, outline) {
  fillRect(canvas, x + 13, y + 21, 4, 25, [72, 140, 75, 255]);
  drawFlower(canvas, x + 15, y + 13, [255, 117, 170, 255]);
  fillRect(canvas, x, y + 43, 34, 24, outline);
  fillRect(canvas, x + 5, y + 47, 24, 16, color);
}

function drawLamp(canvas, x, y, color, outline) {
  drawTriangle(canvas, x, y, 34, 24, outline);
  drawTriangle(canvas, x + 4, y + 4, 26, 17, color);
  fillRect(canvas, x + 15, y + 24, 5, 32, outline);
  fillRect(canvas, x + 4, y + 56, 28, 7, outline);
}

function drawFrame(canvas, x, y, color, outline, dark) {
  fillRect(canvas, x, y, 48, 48, outline);
  fillRect(canvas, x + 5, y + 5, 38, 38, [255, 230, 240, 255]);
  drawPixelOval(canvas, x + 24, y + 22, 12, 13, color, 3);
  fillRect(canvas, x + 14, y + 33, 20, 6, dark);
}

function drawMusic(canvas, x, y, color, outline) {
  fillRect(canvas, x + 24, y, 6, 46, outline);
  fillRect(canvas, x + 30, y, 20, 6, outline);
  drawPixelOval(canvas, x + 19, y + 46, 12, 9, color, 3);
  drawPixelOval(canvas, x + 46, y + 36, 12, 9, color, 3);
}

function drawCamera(canvas, x, y, color, outline) {
  fillRect(canvas, x, y, 55, 32, outline);
  fillRect(canvas, x + 5, y + 6, 45, 21, color);
  fillRect(canvas, x + 9, y - 8, 15, 8, outline);
  drawPixelOval(canvas, x + 30, y + 16, 11, 11, outline, 3);
  drawPixelOval(canvas, x + 30, y + 16, 7, 7, [180, 226, 255, 255], 2);
}

function drawWand(canvas, x, y, color, outline) {
  for (let i = 0; i < 42; i += 1) fillRect(canvas, x + i, y + 38 - i, 4, 4, outline);
  drawStar(canvas, x + 47, y - 7, color, 0.8);
  drawSparkle(canvas, x + 18, y + 17, [255, 255, 255, 220]);
}

function drawUmbrella(canvas, x, y, color, outline) {
  drawPixelOval(canvas, x + 29, y + 25, 31, 22, outline, 4);
  fillRect(canvas, x, y + 25, 58, 10, color);
  fillRect(canvas, x + 27, y + 35, 5, 34, outline);
  fillRect(canvas, x + 27, y + 66, 17, 5, outline);
}

function drawBag(canvas, x, y, color, outline) {
  fillRect(canvas, x + 12, y, 24, 16, outline);
  fillRect(canvas, x, y + 12, 48, 50, outline);
  fillRect(canvas, x + 5, y + 17, 38, 40, color);
  fillRect(canvas, x + 16, y + 31, 16, 8, [255, 255, 255, 180]);
}

function drawBook(canvas, x, y, color, outline) {
  fillRect(canvas, x, y, 46, 38, outline);
  fillRect(canvas, x + 4, y + 4, 18, 30, color);
  fillRect(canvas, x + 24, y + 4, 18, 30, mixColor(color, [255, 255, 255, 255], 0.35));
  fillRect(canvas, x + 22, y + 4, 3, 30, outline);
}

function drawKeyboard(canvas, x, y, color, outline) {
  fillRect(canvas, x, y, 62, 25, outline);
  fillRect(canvas, x + 4, y + 4, 54, 17, color);
  for (let yy = 0; yy < 2; yy += 1) for (let xx = 0; xx < 6; xx += 1) fillRect(canvas, x + 8 + xx * 8, y + 8 + yy * 7, 5, 4, [255, 255, 255, 220]);
}

function drawTray(canvas, x, y, color, outline) {
  fillRect(canvas, x, y + 16, 56, 12, outline);
  fillRect(canvas, x + 5, y + 18, 46, 6, color);
  drawPixelOval(canvas, x + 15, y + 8, 8, 8, [255, 221, 118, 255], 2);
  drawPixelOval(canvas, x + 31, y + 5, 8, 8, [255, 132, 160, 255], 2);
  drawPixelOval(canvas, x + 45, y + 9, 8, 8, [138, 222, 165, 255], 2);
}

function blit(canvas, image, offsetX, offsetY) {
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const pixel = pixelAt(image, x, y);
      if (pixel[3] > 0) setPixel(canvas, offsetX + x, offsetY + y, pixel);
    }
  }
}

function mixColor(a, b, ratio = 0.5) {
  return [
    Math.round(a[0] * (1 - ratio) + b[0] * ratio),
    Math.round(a[1] * (1 - ratio) + b[1] * ratio),
    Math.round(a[2] * (1 - ratio) + b[2] * ratio),
    Math.round((a[3] ?? 255) * (1 - ratio) + (b[3] ?? 255) * ratio)
  ];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

main();
