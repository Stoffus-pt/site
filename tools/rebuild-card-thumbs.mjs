import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { renderCardThumb, resetCropsConfigCache } from './lib/photo-card.mjs';

resetCropsConfigCache();

const __dirname = dirname(fileURLToPath(import.meta.url));
const siteRoot = join(__dirname, '..');
const legacyRoot = join(__dirname, '..', '..');
const site = existsSync(join(siteRoot, 'data', 'models.json')) ? siteRoot : join(legacyRoot, 'site');

const dirs = [
  join(site, 'assets', 'photos', 'models'),
];
const mirrorDir = join(site, '..', 'assets', 'photos', 'models');
if (existsSync(mirrorDir)) {
  dirs.push(mirrorDir);
}

const siteDir = join(site, 'assets', 'photos', 'models');
const modelsPath = join(site, 'data', 'models.json');
const onlyId = process.argv[2] || '';

const modelsData = JSON.parse(readFileSync(modelsPath, 'utf8'));
const models = (modelsData.models || []).filter((m) => m.photo);

let count = 0;

for (const model of models) {
  const id = model.id;
  if (onlyId && id !== onlyId) continue;

  const photoCount = Math.max(1, Number(model.photoCount) || 2);
  let catalogSlot = Number(model.catalogSlot) || 1;
  if (catalogSlot < 1) catalogSlot = 1;
  if (catalogSlot > photoCount) catalogSlot = 1;

  const fullPath = join(siteDir, `${id}-${catalogSlot}.png`);
  if (!existsSync(fullPath)) {
    console.warn('SKIP', id, 'sem foto', `${id}-${catalogSlot}.png`);
    continue;
  }

  for (const dir of dirs) {
    const outPath = join(dir, `${id}-${catalogSlot}-sm.png`);
    const result = await renderCardThumb(fullPath, outPath, id, String(catalogSlot));
    console.log('OK', outPath.replace(root + '\\', ''), 'slot', catalogSlot, result.mode, `${result.cardW}x${result.cardH}`);
  }
  count += 1;
}

console.log('Concluído:', count, 'modelos');
