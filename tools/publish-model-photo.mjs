import sharp from 'sharp';
import { mkdirSync, readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { renderCardThumb } from './lib/photo-card.mjs';
import { maybeRemoveBlackBackground } from './lib/photo-alpha.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const siteRoot = join(__dirname, '..');
const legacyRoot = join(__dirname, '..', '..');

const site = existsSync(join(siteRoot, 'data', 'models.json')) ? siteRoot : join(legacyRoot, 'site');

const modelId = process.argv[2];
const input = process.argv[3];
const slot = Math.max(1, parseInt(process.argv[4] || '1', 10) || 1);

if (!modelId || !input) {
  console.error('Uso: node publish-model-photo.mjs <modelo> <ficheiro-origem> [slot]');
  process.exit(1);
}

function photoOutputs(fileName) {
  const paths = [join(site, 'assets', 'photos', 'models', fileName)];
  const mirror = join(site, '..', 'assets', 'photos', 'models', fileName);
  if (existsSync(dirname(mirror))) {
    paths.push(mirror);
  }
  return paths;
}

function readCatalogSlot(id) {
  const modelsPath = join(site, 'data', 'models.json');
  const data = JSON.parse(readFileSync(modelsPath, 'utf8'));
  const model = (data.models || []).find((m) => m.id === id);
  return Number(model?.catalogSlot) || 1;
}

const catalogSlot = readCatalogSlot(modelId);

const meta = await sharp(input).metadata();
const targetW = meta.width;
const targetH = meta.height;

const processed = await maybeRemoveBlackBackground(input);

const baseName = `${modelId}-${slot}`;

for (const out of photoOutputs(`${baseName}.png`)) {
  mkdirSync(dirname(out), { recursive: true });
  await sharp(processed).toFile(out);
  console.log('OK', out);
}

const mdW = 720;
const mdH = Math.round((targetH / targetW) * mdW);
const mdBuffer = await sharp(processed)
  .resize(mdW, mdH, { kernel: sharp.kernel.lanczos3 })
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toBuffer();

for (const out of photoOutputs(`${baseName}-md.png`)) {
  mkdirSync(dirname(out), { recursive: true });
  await sharp(mdBuffer).toFile(out);
  console.log('OK', out);
}

if (slot === catalogSlot) {
  const fullPng = join(site, 'assets', 'photos', 'models', `${baseName}.png`);
  for (const out of photoOutputs(`${baseName}-sm.png`)) {
    const result = await renderCardThumb(fullPng, out, modelId, slot);
    console.log('OK', out, result.mode);
  }
}

console.log(`${modelId}: ${targetW}x${targetH} (+ sm card, md ${mdW}x${mdH})`);
