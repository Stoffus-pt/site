# Rascunho tecidos 2026 (site)

Ficheiro: `fabrics-2026-draft.json`  
Specs extraídas dos PDFs em `Novas Laminas 2026/`.

## Estado

- **Rascunho apenas** — o site público continua a usar `fabrics.json` + `fabrics-site.json` (colecção actual).
- Pareado com `data/catalog/fabrics-2026-draft.json` (configurador).
- Quando activarem a colecção 2026: copiar `specs` (e traits) para o CMS / `fabrics-site.json` e `npm run fabrics:sync`.

## Regenerar

```bash
node tools/build-site-fabrics-2026-draft.mjs
```

## Cobertura

Ver `meta.withSpecs` / `meta.missingSpecs` dentro do JSON.
