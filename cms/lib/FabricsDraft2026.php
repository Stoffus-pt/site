<?php
declare(strict_types=1);

/**
 * Rascunho colecção tecidos 2026 (site) — editável no CMS sem afectar o catálogo activo.
 */

function cms_fabrics_draft_2026_path(): string
{
    return SITE_ROOT . '/data/fabrics-2026-draft.json';
}

function cms_fabrics_catalog_draft_2026_path(): string
{
    // Fora da pasta site/ (projecto Studio3D) — pode não existir em produção FTP
    return dirname(SITE_ROOT) . '/data/catalog/fabrics-2026-draft.json';
}

function cms_fabrics_draft_2026_load(): array
{
    $path = cms_fabrics_draft_2026_path();
    if (!is_file($path)) {
        throw new RuntimeException('Rascunho 2026 não encontrado (data/fabrics-2026-draft.json).');
    }
    $raw = file_get_contents($path);
    $data = json_decode($raw ?: '{}', true);
    if (!is_array($data) || !isset($data['collections']) || !is_array($data['collections'])) {
        throw new RuntimeException('fabrics-2026-draft.json inválido.');
    }
    return $data;
}

function cms_fabrics_draft_2026_save(array $data): void
{
    $path = cms_fabrics_draft_2026_path();
    $dir = dirname($path);
    if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
        throw new RuntimeException('Não foi possível criar a pasta de dados.');
    }
    if (!isset($data['meta']) || !is_array($data['meta'])) {
        $data['meta'] = [];
    }
    $data['meta']['updatedAt'] = gmdate('c');
    $data['meta']['status'] = 'draft-only';
    $data['meta']['collectionCount'] = count($data['collections'] ?? []);

    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        throw new RuntimeException('Erro ao serializar o rascunho 2026.');
    }
    if (file_put_contents($path, $json . "\n") === false) {
        throw new RuntimeException('Não foi possível gravar o rascunho 2026.');
    }
}

/**
 * @return array<string, array<string, mixed>>
 */
function cms_fabrics_catalog_draft_2026_index(): array
{
    $path = cms_fabrics_catalog_draft_2026_path();
    if (!is_file($path)) {
        return [];
    }
    $raw = file_get_contents($path);
    $data = json_decode($raw ?: '{}', true);
    if (!is_array($data) || empty($data['collections']) || !is_array($data['collections'])) {
        return [];
    }

    $out = [];
    foreach ($data['collections'] as $col) {
        if (!is_array($col) || empty($col['name'])) {
            continue;
        }
        $id = strtolower(preg_replace('/\s+/', '', (string) $col['name']));
        $colors = [];
        if (!empty($col['colors']) && is_array($col['colors'])) {
            foreach ($col['colors'] as $c) {
                if (!is_array($c)) {
                    continue;
                }
                $colors[] = [
                    'fileIndex' => (int) ($c['fileIndex'] ?? 0),
                    'code' => (string) ($c['code'] ?? ''),
                    'supplierRef' => (string) ($c['supplierRef'] ?? ''),
                ];
            }
        }
        $out[$id] = [
            'name' => (string) $col['name'],
            'prefix' => (string) ($col['prefix'] ?? ''),
            'gama' => (string) ($col['gama'] ?? ''),
            'fabricType' => (string) ($col['fabricType'] ?? 'default'),
            'start' => (int) ($col['start'] ?? 0),
            'end' => (int) ($col['end'] ?? 0),
            'colorCount' => count($colors) ?: max(0, (int) ($col['end'] ?? 0) - (int) ($col['start'] ?? 0) + 1),
            'codes' => array_values(array_filter(array_map(static fn($c) => $c['code'], $colors))),
            'colors' => $colors,
        ];
    }
    return $out;
}

function cms_fabrics_draft_2026_list(): array
{
    $draft = cms_fabrics_draft_2026_load();
    $catalogIndex = cms_fabrics_catalog_draft_2026_index();
    $items = [];

    foreach ($draft['collections'] as $id => $col) {
        if (!is_array($col)) {
            continue;
        }
        $id = (string) $id;
        $cat = $catalogIndex[$id] ?? null;
        $specs = cms_fabrics_normalize_specs(isset($col['specs']) && is_array($col['specs']) ? $col['specs'] : []);
        $traits = [];
        if (!empty($col['traits']) && is_array($col['traits'])) {
            foreach ($col['traits'] as $t) {
                $t = trim((string) $t);
                if ($t !== '') {
                    $traits[] = $t;
                }
            }
        }

        $items[] = [
            'id' => $id,
            'name' => (string) ($col['name'] ?? ($cat['name'] ?? $id)),
            'prefix' => (string) ($col['prefix'] ?? ($cat['prefix'] ?? '')),
            'gama' => (string) ($col['gama'] ?? ($cat['gama'] ?? '')),
            'gamaLabel' => (string) ($col['gama'] ?? ($cat['gama'] ?? '')),
            'show' => !isset($col['show']) || !empty($col['show']),
            'specs' => $specs,
            'traits' => $traits,
            'sourcePdf' => (string) ($col['sourcePdf'] ?? ''),
            'fabricType' => (string) ($cat['fabricType'] ?? ($col['fabricType'] ?? 'default')),
            'start' => (int) ($cat['start'] ?? ($col['start'] ?? 0)),
            'end' => (int) ($cat['end'] ?? ($col['end'] ?? 0)),
            'colorCount' => (int) ($cat['colorCount'] ?? ($col['colorCount'] ?? 0)),
            'codes' => $cat['codes'] ?? ($col['codes'] ?? []),
            'isNew' => !is_file(SITE_ROOT . '/data/fabrics.json') ? true : !cms_fabrics_draft_is_in_active($id),
        ];
    }

    usort($items, static function (array $a, array $b): int {
        $ga = (string) ($a['gama'] ?? '');
        $gb = (string) ($b['gama'] ?? '');
        if ($ga !== $gb) {
            return strcmp($ga, $gb);
        }
        return strcasecmp((string) $a['name'], (string) $b['name']);
    });

    return [
        'meta' => $draft['meta'] ?? [],
        'collections' => $items,
        'catalogDraftAvailable' => $catalogIndex !== [],
    ];
}

function cms_fabrics_draft_is_in_active(string $id): bool
{
    static $activeIds = null;
    if ($activeIds === null) {
        $activeIds = [];
        try {
            $catalog = cms_load_fabrics_catalog();
            foreach ($catalog['collections'] as $col) {
                if (is_array($col) && !empty($col['id'])) {
                    $activeIds[(string) $col['id']] = true;
                }
            }
        } catch (Throwable $e) {
            $activeIds = [];
        }
    }
    return isset($activeIds[$id]);
}

/**
 * @param array<string, mixed> $fields
 * @return array{id:string,collection:array<string,mixed>}
 */
function cms_fabrics_draft_2026_update(string $id, array $fields): array
{
    $id = strtolower(trim($id));
    if ($id === '' || !preg_match('/^[a-z0-9][a-z0-9\-]*$/', $id)) {
        throw new InvalidArgumentException('ID de colecção inválido.');
    }

    $draft = cms_fabrics_draft_2026_load();
    if (!isset($draft['collections'][$id]) || !is_array($draft['collections'][$id])) {
        throw new InvalidArgumentException('Colecção não existe no rascunho 2026.');
    }

    $current = $draft['collections'][$id];

    if (array_key_exists('show', $fields)) {
        $current['show'] = !empty($fields['show']);
    }
    if (array_key_exists('name', $fields)) {
        $name = trim((string) $fields['name']);
        if ($name !== '') {
            $current['name'] = $name;
        }
    }
    if (array_key_exists('prefix', $fields)) {
        $current['prefix'] = strtoupper(trim((string) $fields['prefix']));
    }
    if (array_key_exists('gama', $fields)) {
        $current['gama'] = strtoupper(trim((string) $fields['gama']));
    }
    if (array_key_exists('specs', $fields) && is_array($fields['specs'])) {
        $current['specs'] = cms_fabrics_normalize_specs($fields['specs']);
    }
    if (array_key_exists('traits', $fields) && is_array($fields['traits'])) {
        $traits = [];
        foreach ($fields['traits'] as $t) {
            $t = trim((string) $t);
            if ($t === '') {
                continue;
            }
            if (in_array($t, ['easyClean', 'antibacterial', 'petFriendly'], true)) {
                $traits[] = $t;
            }
        }
        $current['traits'] = array_values(array_unique($traits));
    }

    $current['specsStatus'] = 'ok';
    $draft['collections'][$id] = $current;
    cms_fabrics_draft_2026_save($draft);

    $list = cms_fabrics_draft_2026_list();
    $item = null;
    foreach ($list['collections'] as $col) {
        if ($col['id'] === $id) {
            $item = $col;
            break;
        }
    }

    return [
        'id' => $id,
        'collection' => $item ?? $current,
    ];
}

/**
 * @param list<array<string, mixed>> $items
 * @return array{count:int,ids:list<string>,collections:list<array<string,mixed>>,meta:array<string,mixed>}
 */
function cms_fabrics_draft_2026_update_many(array $items): array
{
    $ids = [];
    foreach ($items as $item) {
        if (!is_array($item)) {
            continue;
        }
        $id = (string) ($item['id'] ?? '');
        $fields = [];
        foreach (['show', 'name', 'prefix', 'gama', 'specs', 'traits'] as $key) {
            if (array_key_exists($key, $item)) {
                $fields[$key] = $item[$key];
            }
        }
        if ($id === '' || $fields === []) {
            continue;
        }
        $result = cms_fabrics_draft_2026_update($id, $fields);
        $ids[] = $result['id'];
    }

    if ($ids === []) {
        throw new InvalidArgumentException('Nenhuma colecção válida para guardar.');
    }

    $list = cms_fabrics_draft_2026_list();
    return [
        'count' => count($ids),
        'ids' => $ids,
        'collections' => $list['collections'],
        'meta' => $list['meta'],
    ];
}
