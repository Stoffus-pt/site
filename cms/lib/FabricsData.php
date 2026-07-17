<?php
declare(strict_types=1);

/**
 * Overrides de tecidos no site (capas, textos, visibilidade).
 * Fonte de verdade das colecções: Studio3D → tools/sync-fabrics.mjs → data/fabrics.json
 */

function cms_fabrics_site_path(): string
{
    return SITE_ROOT . '/data/fabrics-site.json';
}

function cms_fabrics_catalog_path(): string
{
    return SITE_ROOT . '/data/fabrics.json';
}

function cms_load_fabrics_site(): array
{
    $path = cms_fabrics_site_path();
    if (!is_file($path)) {
        return ['collections' => []];
    }
    $raw = file_get_contents($path);
    $data = json_decode($raw ?: '{}', true);
    if (!is_array($data)) {
        throw new RuntimeException('fabrics-site.json inválido.');
    }
    if (!isset($data['collections']) || !is_array($data['collections'])) {
        $data['collections'] = [];
    }
    return $data;
}

function cms_save_fabrics_site(array $data): void
{
    $path = cms_fabrics_site_path();
    $dir = dirname($path);
    if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
        throw new RuntimeException('Não foi possível criar a pasta de dados.');
    }
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        throw new RuntimeException('Erro ao serializar fabrics-site.json.');
    }
    if (file_put_contents($path, $json . "\n") === false) {
        throw new RuntimeException('Não foi possível gravar fabrics-site.json.');
    }
}

function cms_load_fabrics_catalog(): array
{
    $path = cms_fabrics_catalog_path();
    if (!is_file($path)) {
        return [
            'meta' => [],
            'gamas' => [],
            'textureLabels' => [],
            'collections' => [],
        ];
    }
    $raw = file_get_contents($path);
    $data = json_decode($raw ?: '{}', true);
    if (!is_array($data)) {
        throw new RuntimeException('fabrics.json inválido.');
    }
    if (!isset($data['collections']) || !is_array($data['collections'])) {
        $data['collections'] = [];
    }
    return $data;
}

function cms_fabrics_list_merged(): array
{
    $catalog = cms_load_fabrics_catalog();
    $site = cms_load_fabrics_site();
    $overrides = $site['collections'] ?? [];

    $items = [];
    foreach ($catalog['collections'] as $col) {
        if (!is_array($col) || empty($col['id'])) {
            continue;
        }
        $id = (string) $col['id'];
        $override = isset($overrides[$id]) && is_array($overrides[$id]) ? $overrides[$id] : [];
        $items[] = [
            'id' => $id,
            'name' => (string) ($col['name'] ?? $id),
            'prefix' => (string) ($col['prefix'] ?? ''),
            'start' => (int) ($col['start'] ?? 0),
            'end' => (int) ($col['end'] ?? 0),
            'gama' => (string) ($col['gama'] ?? ''),
            'gamaLabel' => (string) ($col['gamaLabel'] ?? ''),
            'texture' => (string) ($col['texture'] ?? 'default'),
            'colorCount' => (int) ($col['colorCount'] ?? 0),
            'show' => array_key_exists('show', $override) ? !empty($override['show']) : (!isset($col['show']) || !empty($col['show'])),
            'cover' => isset($override['cover']) ? (string) $override['cover'] : (isset($col['cover']) ? (string) $col['cover'] : ''),
            'description' => isset($override['description']) ? (string) $override['description'] : (isset($col['description']) ? (string) $col['description'] : ''),
            'hasOverride' => $override !== [],
        ];
    }

    return [
        'meta' => $catalog['meta'] ?? [],
        'gamas' => $catalog['gamas'] ?? [],
        'collections' => $items,
    ];
}

/**
 * Actualiza overrides e regenera fabrics.json se o sync Node estiver disponível.
 */
function cms_fabrics_update_override(string $id, array $fields): array
{
    $id = strtolower(trim($id));
    if ($id === '' || !preg_match('/^[a-z0-9][a-z0-9\-]*$/', $id)) {
        throw new InvalidArgumentException('ID de colecção inválido.');
    }

    $site = cms_load_fabrics_site();
    $current = isset($site['collections'][$id]) && is_array($site['collections'][$id])
        ? $site['collections'][$id]
        : [];

    if (array_key_exists('show', $fields)) {
        $current['show'] = !empty($fields['show']);
    }
    if (array_key_exists('cover', $fields)) {
        $cover = trim((string) $fields['cover']);
        if ($cover === '') {
            unset($current['cover']);
        } else {
            $current['cover'] = $cover;
        }
    }
    if (array_key_exists('description', $fields)) {
        $desc = trim((string) $fields['description']);
        if ($desc === '') {
            unset($current['description']);
        } else {
            $current['description'] = $desc;
        }
    }

    // Remover override vazio
    $clean = [];
    if (array_key_exists('show', $current)) {
        $clean['show'] = !empty($current['show']);
    }
    if (!empty($current['cover'])) {
        $clean['cover'] = (string) $current['cover'];
    }
    if (!empty($current['description'])) {
        $clean['description'] = (string) $current['description'];
    }

    if ($clean === []) {
        unset($site['collections'][$id]);
    } else {
        $site['collections'][$id] = $clean;
    }

    cms_save_fabrics_site($site);
    $sync = cms_fabrics_try_sync();

    return [
        'id' => $id,
        'override' => $clean,
        'synced' => $sync['ok'],
        'syncMessage' => $sync['message'],
    ];
}

function cms_fabrics_try_sync(): array
{
    $script = SITE_ROOT . '/tools/sync-fabrics.mjs';
    if (!is_file($script)) {
        return ['ok' => false, 'message' => 'Script sync-fabrics.mjs não encontrado.'];
    }

    $node = 'node';
    $cmd = escapeshellarg($node) . ' ' . escapeshellarg($script) . ' 2>&1';
    $output = [];
    $code = 0;
    @exec($cmd, $output, $code);

    if ($code !== 0) {
        return [
            'ok' => false,
            'message' => 'Sync falhou (Node pode não estar no servidor). Overrides gravados; execute npm run fabrics:sync localmente.',
            'output' => implode("\n", $output),
        ];
    }

    return [
        'ok' => true,
        'message' => implode("\n", $output) ?: 'fabrics.json actualizado.',
    ];
}
