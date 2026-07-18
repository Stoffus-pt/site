import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const models = JSON.parse(readFileSync(join(root, 'data', 'models.json'), 'utf8'));
const base = 'https://stoffus.pt';

const staticPages = [
  'index.html',
  'catalogo.html',
  'novidades.html',
  'tecidos.html',
  'onde-comprar.html',
  'contactos.html',
  'empresa.html',
  'stoffus-3d.html',
  'area-cliente.html',
  'privacidade.html',
  'modelo.html',
];

const urls = staticPages.map((file) => ({
  loc: `${base}/${file}`,
  changefreq: file === 'index.html' ? 'weekly' : 'monthly',
  priority: file === 'index.html' ? '1.0' : '0.8',
}));

(models.models || []).forEach((model) => {
  urls.push({
    loc: `${base}/modelo/${encodeURIComponent(model.id)}/`,
    changefreq: 'monthly',
    priority: '0.7',
  });
});

const xml =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls
    .map(
      (u) =>
        '  <url>\n' +
        `    <loc>${u.loc}</loc>\n` +
        `    <changefreq>${u.changefreq}</changefreq>\n` +
        `    <priority>${u.priority}</priority>\n` +
        '  </url>'
    )
    .join('\n') +
  '\n</urlset>\n';

writeFileSync(join(root, 'sitemap.xml'), xml, 'utf8');
console.log(`sitemap.xml — ${urls.length} URLs`);
