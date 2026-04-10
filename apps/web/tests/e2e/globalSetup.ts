import { Buffer } from 'node:buffer';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import qrcode from 'qrcode-generator';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GENERATED_DIR = path.resolve(__dirname, '.generated');
const VIDEO_FILE = path.join(GENERATED_DIR, 'fake-camera-qr.y4m');

const FRAME_WIDTH = 640;
const FRAME_HEIGHT = 640;
const FRAME_COUNT = 12;
const QR_PAYLOAD = 'VG-001';

const LUMA_BLACK = 16;
const LUMA_WHITE = 235;
const CHROMA_NEUTRAL = 128;

function buildQrLumaFrame(width: number, height: number, payload: string): Uint8Array {
  const qr = qrcode(0, 'L');
  qr.addData(payload, 'Byte');
  qr.make();

  const moduleCount = qr.getModuleCount();
  const quietZoneModules = 4;
  const totalModules = moduleCount + quietZoneModules * 2;
  const moduleSize = Math.max(8, Math.floor(Math.min(width, height) / (totalModules + 8)));
  const qrPixels = totalModules * moduleSize;
  const offsetX = Math.floor((width - qrPixels) / 2);
  const offsetY = Math.floor((height - qrPixels) / 2);

  const luma = new Uint8Array(width * height);
  luma.fill(LUMA_WHITE);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const inQrBounds =
        x >= offsetX && x < offsetX + qrPixels && y >= offsetY && y < offsetY + qrPixels;
      if (!inQrBounds) {
        continue;
      }

      const moduleX = Math.floor((x - offsetX) / moduleSize) - quietZoneModules;
      const moduleY = Math.floor((y - offsetY) / moduleSize) - quietZoneModules;

      const inQuietZone =
        moduleX < 0 || moduleY < 0 || moduleX >= moduleCount || moduleY >= moduleCount;
      if (inQuietZone) {
        continue;
      }

      const isDark = qr.isDark(moduleY, moduleX);
      luma[y * width + x] = isDark ? LUMA_BLACK : LUMA_WHITE;
    }
  }

  return luma;
}

function buildY4m(
  width: number,
  height: number,
  frameCount: number,
  lumaPlane: Uint8Array
): Buffer {
  const chromaWidth = width / 2;
  const chromaHeight = height / 2;
  const chromaPlaneSize = chromaWidth * chromaHeight;
  const chroma = Buffer.alloc(chromaPlaneSize, CHROMA_NEUTRAL);

  const header = Buffer.from(`YUV4MPEG2 W${width} H${height} F30:1 Ip A1:1 C420jpeg\n`, 'ascii');
  const frameHeader = Buffer.from('FRAME\n', 'ascii');
  const frame = Buffer.concat([frameHeader, Buffer.from(lumaPlane), chroma, chroma]);

  const frames = Array.from({ length: frameCount }, () => frame);
  return Buffer.concat([header, ...frames]);
}

export default async function globalSetup(): Promise<void> {
  await mkdir(GENERATED_DIR, { recursive: true });

  const lumaPlane = buildQrLumaFrame(FRAME_WIDTH, FRAME_HEIGHT, QR_PAYLOAD);
  const videoBuffer = buildY4m(FRAME_WIDTH, FRAME_HEIGHT, FRAME_COUNT, lumaPlane);

  await writeFile(VIDEO_FILE, videoBuffer);
}
