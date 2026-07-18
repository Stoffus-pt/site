/**
 * Completa fichas em data/models.json: medidas, opções, related e PDF do catálogo.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const path = join(root, 'data', 'models.json');
const data = JSON.parse(readFileSync(path, 'utf8'));

const CATALOG_PDF =
  'https://stoffus.pt/wp-content/uploads/2026/01/Catalogo.1EleganzaCollection_email.pdf';

const MEASUREMENTS = {
  relax: [
    { label: 'Profundidade', value: 'conforme módulos (consultar ficha)' },
    { label: 'Altura', value: 'conforme versão e costas' },
    { label: 'Composição', value: 'modular — chaise, canto e extensões' },
  ],
  fixed: [
    { label: 'Profundidade', value: 'conforme modelo' },
    { label: 'Altura', value: 'conforme costas e pés' },
    { label: 'Larguras', value: 'várias medidas sob consulta' },
  ],
  slide: [
    { label: 'Profundidade', value: 'com deslizamento do assento' },
    { label: 'Altura', value: 'conforme costas' },
    { label: 'Função', value: 'assento deslizante' },
  ],
  pendular: [
    { label: 'Profundidade', value: 'aprox. 105 cm (conforme versão)' },
    { label: 'Altura', value: 'aprox. 95 cm (conforme versão)' },
    { label: 'Movimento', value: 'pendular suave' },
  ],
  sofabed: [
    { label: 'Modo sofá', value: 'medidas conforme composição' },
    { label: 'Modo cama', value: 'abertura sob consulta' },
    { label: 'Função', value: 'sofá-cama' },
  ],
  armchair: [
    { label: 'Largura', value: 'conforme modelo' },
    { label: 'Profundidade', value: 'conforme modelo' },
    { label: 'Altura', value: 'conforme costas e pés' },
  ],
  banqueta: [
    { label: 'Larguras', value: '120, 140 e 150 cm' },
    { label: 'Base', value: 'metálica dourada de série' },
    { label: 'Opção', value: 'cofre interior (quando aplicável)' },
  ],
  pouf: [
    { label: 'Formato', value: 'conforme modelo' },
    { label: 'Altura', value: 'assento baixo / complemento' },
    { label: 'Uso', value: 'apoio de pés ou assento extra' },
  ],
  pet: [
    { label: 'Material', value: 'espuma macia e estável' },
    { label: 'Uso', value: 'sofá ou cama do pet' },
    { label: 'Acesso', value: 'facilita a subida com segurança' },
  ],
};

const OPTIONS = {
  relax: [
    'Configuração modular',
    'Centenas de revestimentos Eleganza',
    'Tecidos Easy Clean e Pet Friendly',
    'Orçamento PDF no Stoffus 3D',
  ],
  fixed: [
    'Linhas definidas e estrutura estável',
    'Centenas de revestimentos Eleganza',
    'Acabamentos e pés configuráveis',
  ],
  slide: [
    'Assento deslizante',
    'Centenas de revestimentos Eleganza',
    'Conforto para uso diário',
  ],
  pendular: [
    'Movimento pendular suave',
    'Centenas de revestimentos Eleganza',
    'Configuração no Stoffus 3D (quando disponível)',
  ],
  sofabed: [
    'Dupla função sofá e cama',
    'Centenas de revestimentos Eleganza',
    'Ideal para visitas e espaços versáteis',
  ],
  armchair: [
    'Conforto individual',
    'Centenas de revestimentos Eleganza',
    'Complemento ideal para sofá modular',
  ],
  banqueta: [
    'Três larguras disponíveis',
    'Base metálica dourada',
    'Opção cofre interior',
  ],
  pouf: [
    'Complemento versátil',
    'Centenas de revestimentos Eleganza',
    'Para sofá ou poltrona',
  ],
  pet: [
    'Espuma macia e estável',
    'Para sofá ou cama',
    'Facilita o acesso do pet',
  ],
};

const PREFERRED = new Set([
  ...(data.novidadesOrder || []),
  ...(data.featuredHome || []),
  ...(data.featuredClassic || []),
]);

function relatedFor(model, all) {
  const same = all.filter((m) => m.id !== model.id && m.type === model.type);
  const preferred = same.filter((m) => PREFERRED.has(m.id));
  const rest = same.filter((m) => !PREFERRED.has(m.id));
  const pool = preferred.concat(rest);
  const ids = pool.slice(0, 4).map((m) => m.id);
  if (ids.length >= 3) return ids;

  // Completar com outros tipos preferidos
  const extras = all
    .filter((m) => m.id !== model.id && !ids.includes(m.id) && PREFERRED.has(m.id))
    .slice(0, 4 - ids.length)
    .map((m) => m.id);
  return ids.concat(extras).slice(0, 4);
}

const models = data.models || [];
models.forEach((model) => {
  const type = model.type || 'relax';
  if (!Array.isArray(model.measurements) || !model.measurements.length) {
    model.measurements = (MEASUREMENTS[type] || MEASUREMENTS.relax).map((row) => ({ ...row }));
  }
  if (!Array.isArray(model.options) || !model.options.length) {
    model.options = (OPTIONS[type] || OPTIONS.relax).slice();
  }
  if (!Array.isArray(model.related) || !model.related.length) {
    model.related = relatedFor(model, models);
  }
  if (!model.pdf) {
    model.pdf = type === 'pet' ? '' : CATALOG_PDF;
  }
  if (model.pdf === '') delete model.pdf;
});

writeFileSync(path, JSON.stringify(data, null, 4) + '\n', 'utf8');
console.log(`Fichas actualizadas — ${models.length} modelos`);
