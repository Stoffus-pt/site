import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { maybeRemoveBlackBackground } from './lib/photo-alpha.mjs';
import { renderCardThumb } from './lib/photo-card.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..');

const modelId = process.argv[2];
const slot = Math.max(1, parseInt(process.argv[3] || '1', 10) || 1);

if (!modelId) {
  console.error('Uso: node reprocess-model-photo.mjs <modelo> [slot]');
  process.exit(1);
}

function readCatalogSlot(id) {
  const modelsPath = join(root, 'site', 'data', 'models.json');
  const data = JSON.parse(readFileSync(modelsPath, 'utf8'));
  const model = (data.models || []).find((m) => m.id === id);
  return Number(model?.catalogSlot) || 1;
}

const catalogSlot = readCatalogSlot(modelId);
const baseName = `${modelId}-${slot}`;
const sourcePath = join(root, 'site', 'assets', 'photos', 'models', `${baseName}.png`);

if (!existsSync(sourcePath)) {
  console.error('Ficheiro não encontrado:', sourcePath);
  process.exit(1);
}

const processed = await maybeRemoveBlackBackground(sourcePath);
const meta = await sharp(processed).metadata();
const targetW = meta.width;
const targetH = meta.height;

for (const rel of [
  join('site', 'assets', 'photos', 'models', `${baseName}.png`),
  join('assets', 'photos', 'models', `${baseName}.png`),
]) {
  const out = join(root, rel);
  await sharp(processed).toFile(out);
  console.log('OK', out, meta.hasAlpha ? 'com alpha' : 'sem alpha');
}

const mdW = 720;
const mdH = Math.round((targetH / targetW) * mdW);
const mdBuffer = await sharp(processed)
  .resize(mdW, mdH, { kernel: sharp.kernel.lanczos3 })
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toBuffer();

for (const rel of [
  join('site', 'assets', 'photos', 'models', `${baseName}-md.png`),
  join('assets', 'photos', 'models', `${baseName}-md.png`),
]) {
  const out = join(root, rel);
  await sharp(mdBuffer).toFile(out);
  console.log('OK', out);
}

if (slot === catalogSlot) {
  for (const rel of [
    join('site', 'assets', 'photos', 'models', `${baseName}-sm.png`),
    join('assets', 'photos', 'models', `${baseName}-sm.png`),
  ]) {
    const out = join(root, rel);
    const fullPng = join(root, 'site', 'assets', 'photos', 'models', `${baseName}.png`);
    const result = await renderCardThumb(fullPng, out, modelId, slot);
    console.log('OK', out, result.mode);
  }
}

console.log(`${modelId} slot ${slot}: ${targetW}x${targetH}`);
