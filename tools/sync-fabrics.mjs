/**
 * Sincroniza colecções de tecidos do catálogo Studio3D → site/data/fabrics.json
 * Fonte: data/catalog/catalog-published.json ou catalog-draft.json
 * Overrides só do site: site/data/fabrics-site.json (capas, textos, visibilidade)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const siteRoot = join(__dirname, '..');
const projectRoot = join(siteRoot, '..');

const catalogCandidates = [
  join(projectRoot, 'data', 'catalog', 'catalog-published.json'),
  join(projectRoot, 'data', 'catalog', 'catalog-draft.json'),
  join(projectRoot, 'render-desktop', 'studio-bundle', 'data', 'catalog', 'catalog-published.json'),
];

const GAMA_ORDER = ['bliss', 'delta', 'fashion', 'pele'];

const GAMAS = {
  B: { filter: 'bliss', label: 'Bliss' },
  D: { filter: 'delta', label: 'Delta' },
  F: { filter: 'fashion', label: 'Fashion' },
  E: { filter: 'pele', label: 'Pele Extra' },
  P: { filter: 'pele', label: 'Pele Platina' },
};

const TEXTURE_LABELS = {
  default: 'Tecido',
  aveludado: 'Aveludado',
  alinhado: 'Alinhado',
  pele: 'Pele genuína',
};

const SKIP_NAMES = new Set(['tecidocliente', 'tecido cliente']);

function guessTexture(name) {
  const n = String(name || '').toLowerCase();
  const aveludado = [
    'bella', 'falcon', 'funky', 'garby', 'ifrane', 'jade', 'kamala', 'kamala2',
    'matchy', 'mirage', 'prisma', 'ramses', 'stancy', 'talia', 'touareg', 'venturi', 'zemy',
  ];
  const alinhado = ['artis', 'carmen', 'fumiko', 'grift', 'karma', 'madoka', 'pisa', 'rissani', 'soft'];
  if (['river', 'siza', 'pele'].some((k) => n.includes(k))) return 'pele';
  if (aveludado.some((k) => n.includes(k))) return 'aveludado';
  if (alinhado.some((k) => n.includes(k))) return 'alinhado';
  return 'default';
}

function collectionId(name) {
  return String(name || '').toLowerCase().replace(/\s+/g, '');
}

function textureFolderName(name) {
  return name === 'Kamala 2' ? 'Kamala2' : name;
}

function loadCatalog() {
  for (const path of catalogCandidates) {
    if (!existsSync(path)) continue;
    const data = JSON.parse(readFileSync(path, 'utf8'));
    return { path, data };
  }
  throw new Error('Catálogo não encontrado (catalog-published.json / catalog-draft.json).');
}

function loadSiteOverrides() {
  const path = join(siteRoot, 'data', 'fabrics-site.json');
  if (!existsSync(path)) return { path: null, overrides: {} };
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  return { path, overrides: raw.collections || {} };
}

const SPEC_KEYS = ['composicao', 'largura', 'peso', 'abrasao', 'borboto'];

function mapSpecs(override, catalogCol) {
  const fromOverride = override?.specs && typeof override.specs === 'object' ? override.specs : {};
  const fromCatalog = catalogCol?.specs && typeof catalogCol.specs === 'object' ? catalogCol.specs : {};
  const specs = {};
  for (const key of SPEC_KEYS) {
    const value = fromOverride[key] ?? fromCatalog[key] ?? '';
    specs[key] = value == null ? '' : String(value).trim();
  }
  return specs;
}

function mapCollection(col, override) {
  const id = collectionId(col.name);
  const prefix = String(col.prefix || '').toUpperCase();
  const start = Number(col.start);
  const end = Number(col.end);
  if (!id || !prefix || !Number.isFinite(start) || !Number.isFinite(end)) return null;

  const texture = col.fabricType || col.texture || guessTexture(col.name);
  const gama = GAMAS[prefix] || { filter: 'all', label: prefix };

  return {
    id,
    name: col.name,
    prefix,
    start,
    end,
    texture,
    textureFolder: textureFolderName(col.name),
    gama: gama.filter,
    gamaLabel: gama.label,
    colorCount: end - start + 1,
    show: override?.show !== false,
    cover: override?.cover || null,
    description: override?.description || null,
    specs: mapSpecs(override, col),
  };
}

const { path: catalogPath, data: catalog } = loadCatalog();
const { path: overridePath, overrides } = loadSiteOverrides();

const collections = (catalog.collections || [])
  .filter((col) => !SKIP_NAMES.has(collectionId(col.name)))
  .filter((col) => col.enabled !== false)
  .map((col) => mapCollection(col, overrides[collectionId(col.name)]))
  .filter(Boolean);
  // Mantém também show:false — o site filtra na UI; o CMS precisa de os ver para voltar a activar.

collections.sort((a, b) => {
  const oa = GAMA_ORDER.indexOf(a.gama);
  const ob = GAMA_ORDER.indexOf(b.gama);
  const rankA = oa === -1 ? GAMA_ORDER.length : oa;
  const rankB = ob === -1 ? GAMA_ORDER.length : ob;
  if (rankA !== rankB) return rankA - rankB;
  return a.name.localeCompare(b.name, 'pt-PT');
});

const output = {
  meta: {
    syncedAt: new Date().toISOString(),
    catalogSource: catalogPath.replace(/\\/g, '/'),
    overrideSource: overridePath ? overridePath.replace(/\\/g, '/').split('/site/').pop() : null,
    catalogVersion: catalog.meta?.catalogVersion || null,
    collectionCount: collections.length,
  },
  gamas: GAMAS,
  textureLabels: TEXTURE_LABELS,
  collections,
};

const outPath = join(siteRoot, 'data', 'fabrics.json');
writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n', 'utf8');
console.log(`fabrics.json — ${collections.length} colecções (de ${catalogPath})`);
