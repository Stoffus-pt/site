/**
 * Gera páginas limpas modelo/<id>/index.html (SEO + URLs amigáveis).
 * Usa <base href="../../"> para assets e fetch relativos funcionarem.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(readFileSync(join(root, 'data', 'models.json'), 'utf8'));
const template = readFileSync(join(root, 'modelo.html'), 'utf8');

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

let count = 0;
for (const model of data.models || []) {
  const id = model.id;
  const dir = join(root, 'modelo', id);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const title = `${model.name} | Stoffus - Eleganza Collection`;
  const desc = model.description || `${model.name} — Eleganza Collection Stoffus.`;
  const img = model.photo
    ? `https://stoffus.pt/assets/photos/models/${id}-1.png`
    : `https://stoffus.pt/assets/icons/${id}.webp`;
  const canonical = `https://stoffus.pt/modelo/${id}/`;

  let html = template
    .replace(
      /<meta name="description" content="[^"]*" \/>/,
      `<meta name="description" content="${esc(desc)}" />`
    )
    .replace(
      /<meta property="og:title" content="[^"]*" \/>/,
      `<meta property="og:title" content="${esc(title)}" />`
    )
    .replace(
      /<meta property="og:description" content="[^"]*" \/>/,
      `<meta property="og:description" content="${esc(desc)}" />`
    )
    .replace(
      /<meta property="og:url" content="[^"]*" \/>/,
      `<meta property="og:url" content="${canonical}" />`
    )
    .replace(
      /<meta property="og:image" content="[^"]*" \/>/,
      `<meta property="og:image" content="${esc(img)}" />`
    )
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`);

  if (!html.includes('rel="canonical"')) {
    html = html.replace(
      '</title>',
      `</title>\n  <link rel="canonical" href="${canonical}" />`
    );
  }

  if (!html.includes('<base ')) {
    html = html.replace('<head>', '<head>\n  <base href="../../" />');
  }

  html = html.replace(
    '<script src="js/modelo.js"></script>',
    `<script>window.__STOFFUS_MODEL_ID=${JSON.stringify(id)};</script>\n  <script src="js/modelo.js"></script>`
  );

  writeFileSync(join(dir, 'index.html'), html, 'utf8');
  count += 1;
}

console.log(`Geradas ${count} páginas em modelo/<id>/`);
