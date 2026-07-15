import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { polishTransparentPng } from './photo-alpha.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CROPS_PATH = join(__dirname, '..', '..', 'data', 'photo-crops.json');

export const CARD_W = 420;
export const CARD_H = 315;
export const CARD_AR = CARD_W / CARD_H;

const DEFAULTS = {
  cardWidth: CARD_W,
  cardHeight: CARD_H,
  mode: 'cover',
  focusX: 0.5,
  focusY: 0.5,
  zoom: 1,
};

let cachedConfig = null;

export function resetCropsConfigCache() {
  cachedConfig = null;
}

export function loadCropsConfig() {
  if (cachedConfig) return cachedConfig;
  if (!existsSync(CROPS_PATH)) {
    cachedConfig = { ...DEFAULTS, crops: {} };
    return cachedConfig;
  }
  cachedConfig = JSON.parse(readFileSync(CROPS_PATH, 'utf8'));
  if (!cachedConfig.crops) cachedConfig.crops = {};
  return cachedConfig;
}

export function getCropSettings(modelId, slot) {
  const cfg = loadCropsConfig();
  const slotKey = String(slot);
  const entry = cfg.crops?.[modelId]?.[slotKey] || cfg.crops?.[modelId]?.[slot] || {};
  return {
    cardWidth: cfg.cardWidth || DEFAULTS.cardWidth,
    cardHeight: cfg.cardHeight || DEFAULTS.cardHeight,
    mode: 'cover',
    focusX: clamp01(entry.focusX ?? cfg.focusX ?? DEFAULTS.focusX),
    focusY: clamp01(entry.focusY ?? cfg.focusY ?? DEFAULTS.focusY),
    zoom: Math.max(1, Number(entry.zoom ?? cfg.zoom ?? DEFAULTS.zoom) || 1),
  };
}

function clamp01(n) {
  return Math.min(1, Math.max(0, Number(n) || 0.5));
}

export function computeCoverExtract(sw, sh, ar, focusX, focusY, zoom) {
  let cropW;
  let cropH;

  if (sw / sh > ar) {
    cropH = sh / zoom;
    cropW = cropH * ar;
  } else {
    cropW = sw / zoom;
    cropH = cropW / ar;
  }

  cropW = Math.min(sw, cropW);
  cropH = Math.min(sh, cropH);

  let left = focusX * sw - cropW / 2;
  let top = focusY * sh - cropH / 2;
  left = Math.max(0, Math.min(sw - cropW, left));
  top = Math.max(0, Math.min(sh - cropH, top));

  return {
    left: Math.round(left),
    top: Math.round(top),
    width: Math.round(cropW),
    height: Math.round(cropH),
  };
}

export async function renderCardThumb(fullPath, outPath, modelId, slot) {
  const settings = getCropSettings(modelId, slot);
  const cardW = settings.cardWidth;
  const cardH = settings.cardHeight;

  const input = sharp(fullPath).rotate();
  const meta = await input.metadata();
  const box = computeCoverExtract(
    meta.width,
    meta.height,
    cardW / cardH,
    settings.focusX,
    settings.focusY,
    settings.zoom,
  );

  await input
    .extract(box)
    .resize(cardW, cardH, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer()
    .then((buffer) => polishTransparentPng(buffer))
    .then((buffer) => sharp(buffer).toFile(outPath));

  return { cardW, cardH, mode: 'cover', settings };
}
