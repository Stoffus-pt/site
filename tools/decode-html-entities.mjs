import { readFileSync, writeFileSync } from 'node:fs';

const ENTITIES = {
  aacute: 'á', Aacute: 'Á', eacute: 'é', Eacute: 'É',
  iacute: 'í', Iacute: 'Í', oacute: 'ó', Oacute: 'Ó',
  uacute: 'ú', Uacute: 'Ú', atilde: 'ã', Atilde: 'Ã',
  otilde: 'õ', Otilde: 'Õ', ccedil: 'ç', Ccedil: 'Ç',
  acirc: 'â', Acirc: 'Â', ecirc: 'ê', Ecirc: 'Ê',
  ocirc: 'ô', Ocirc: 'Ô', agrave: 'à', Agrave: 'À',
  nbsp: ' ', middot: '·', mdash: '—', ndash: '–', hellip: '…', copy: '©',
};

function decode(html) {
  let out = html.replace(/&amp;([a-zA-Z]+);/g, '&$1;');
  out = out.replace(/&([a-zA-Z]+);/g, (match, name) => {
    if (Object.prototype.hasOwnProperty.call(ENTITIES, name)) return ENTITIES[name];
    return match;
  });
  return out;
}

for (const file of process.argv.slice(2)) {
  const before = readFileSync(file, 'utf8');
  const after = decode(before);
  writeFileSync(file, after, 'utf8');
  const left = after.match(/&[a-zA-Z]+;/g) || [];
  console.log(file, 'restantes:', left.length, left.slice(0, 8).join(' '));
}
