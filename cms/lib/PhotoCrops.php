<?php
declare(strict_types=1);

function cms_photo_crops_path(): string
{
    return SITE_ROOT . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'photo-crops.json';
}

function cms_photo_card_version_js_path(): string
{
    return SITE_ROOT . DIRECTORY_SEPARATOR . 'js' . DIRECTORY_SEPARATOR . 'photo-card-v.js';
}

function cms_default_photo_crops(): array
{
    return [
        'cardWidth' => 420,
        'cardHeight' => 315,
        'defaultMode' => 'cover',
        'crops' => [],
    ];
}

function cms_validate_photo_crops(array $data): array
{
    $clean = [
        'cardWidth' => max(100, min(2000, (int) ($data['cardWidth'] ?? 420))),
        'cardHeight' => max(100, min(2000, (int) ($data['cardHeight'] ?? 315))),
        'defaultMode' => 'cover',
        'crops' => [],
    ];

    foreach ($data['crops'] ?? [] as $modelId => $slots) {
        if (!is_string($modelId) || !preg_match('/^[a-z0-9\-]+$/', $modelId)) {
            continue;
        }
        if (!is_array($slots)) {
            continue;
        }

        $cleanSlots = [];
        foreach ($slots as $slot => $entry) {
            if (!is_array($entry)) {
                continue;
            }
            $slotKey = (string) $slot;
            $cleanSlots[$slotKey] = [
                'focusX' => round(max(0, min(1, (float) ($entry['focusX'] ?? 0.5))), 3),
                'focusY' => round(max(0, min(1, (float) ($entry['focusY'] ?? 0.5))), 3),
                'zoom' => round(max(1, min(5, (float) ($entry['zoom'] ?? 1))), 3),
            ];
        }

        if ($cleanSlots !== []) {
            $clean['crops'][$modelId] = $cleanSlots;
        }
    }

    return $clean;
}

function cms_write_photo_card_version(string $version): bool
{
    $js = "window.__PHOTO_CARD_V='" . addslashes($version) . "';\n";
    if (file_put_contents(cms_photo_card_version_js_path(), $js) === false) {
        return false;
    }

    $modelsFile = SITE_ROOT . DIRECTORY_SEPARATOR . 'js' . DIRECTORY_SEPARATOR . 'models.js';
    if (!is_file($modelsFile)) {
        return true;
    }

    $content = file_get_contents($modelsFile);
    if ($content === false) {
        return false;
    }

    $updated = preg_replace(
        "/var PHOTO_CARD_V = '[^']+'/",
        "var PHOTO_CARD_V = '" . addslashes($version) . "'",
        $content,
        1
    );

    if ($updated === null) {
        return false;
    }

    return file_put_contents($modelsFile, $updated) !== false;
}

function cms_bump_photo_card_version(): ?string
{
    $modelsFile = SITE_ROOT . DIRECTORY_SEPARATOR . 'js' . DIRECTORY_SEPARATOR . 'models.js';
    $current = '1';

    if (is_file($modelsFile)) {
        $content = file_get_contents($modelsFile);
        if ($content !== false && preg_match("/PHOTO_CARD_V = '([^']+)'/", $content, $matches)) {
            $current = $matches[1];
        }
    }

    $new = date('Ymd') . 'a';
    if (preg_match('/^(\d{8})(.*)$/', $current, $parts)) {
        $suffix = $parts[2] !== '' ? $parts[2] : 'a';
        $last = substr($suffix, -1);
        $next = chr(ord($last) + 1);
        if ($next > 'z') {
            $next = 'a';
        }
        $new = date('Ymd') . $next;
    }

    if (!cms_write_photo_card_version($new)) {
        return null;
    }

    return $new;
}

function cms_node_binary(): string
{
    static $resolved = null;
    if ($resolved !== null) {
        return $resolved;
    }

    $where = shell_exec('where node 2>nul');
    if (is_string($where) && trim($where) !== '') {
        $lines = preg_split('/\R/', trim($where));
        if (!empty($lines[0]) && is_file($lines[0])) {
            $resolved = $lines[0];
            return $resolved;
        }
    }

    $fallback = 'C:\\Program Files\\nodejs\\node.exe';
    if (is_file($fallback)) {
        $resolved = $fallback;
        return $resolved;
    }

    $resolved = 'node';
    return $resolved;
}

function cms_tools_script(string $filename): ?string
{
    $local = SITE_ROOT . DIRECTORY_SEPARATOR . 'tools' . DIRECTORY_SEPARATOR . $filename;
    if (is_file($local)) {
        return $local;
    }

    $legacy = dirname(SITE_ROOT) . DIRECTORY_SEPARATOR . 'site' . DIRECTORY_SEPARATOR . 'tools' . DIRECTORY_SEPARATOR . $filename;
    if (is_file($legacy)) {
        return $legacy;
    }

    return null;
}

function cms_rebuild_card_thumbs(string $modelId = ''): array
{
    if ($modelId !== '' && !preg_match('/^[a-z0-9\-]+$/', $modelId)) {
        return ['ok' => false, 'error' => 'Modelo inválido.', 'output' => ''];
    }

    $script = cms_tools_script('rebuild-card-thumbs.mjs');
    if ($script === null) {
        return ['ok' => false, 'error' => 'Script rebuild-card-thumbs.mjs não encontrado.', 'output' => ''];
    }

    $node = cms_node_binary();
    $cmd = escapeshellarg($node) . ' ' . escapeshellarg($script);
    if ($modelId !== '') {
        $cmd .= ' ' . escapeshellarg($modelId);
    }

    $output = [];
    $exitCode = 0;
    exec($cmd . ' 2>&1', $output, $exitCode);
    $text = trim(implode("\n", $output));

    if ($exitCode !== 0) {
        return [
            'ok' => false,
            'error' => 'Não foi possível regenerar as miniaturas.',
            'output' => $text,
        ];
    }

    return ['ok' => true, 'output' => $text];
}

function cms_publish_model_photo(string $modelId, string $sourcePath, int $slot): array
{
    if (!preg_match('/^[a-z0-9\-]+$/', $modelId)) {
        return ['ok' => false, 'error' => 'Modelo inválido.', 'output' => ''];
    }
    if (!is_file($sourcePath)) {
        return ['ok' => false, 'error' => 'Ficheiro de origem não encontrado.', 'output' => ''];
    }

    $script = cms_tools_script('publish-model-photo.mjs');
    if ($script === null) {
        return ['ok' => false, 'error' => 'Script publish-model-photo.mjs não encontrado.', 'output' => ''];
    }

    $node = cms_node_binary();
    $cmd = escapeshellarg($node) . ' ' . escapeshellarg($script) . ' '
        . escapeshellarg($modelId) . ' ' . escapeshellarg($sourcePath) . ' ' . (int) $slot;

    $output = [];
    $exitCode = 0;
    exec($cmd . ' 2>&1', $output, $exitCode);
    $text = trim(implode("\n", $output));

    if ($exitCode !== 0) {
        $detail = $text !== '' ? $text : 'Verifique se Node.js está instalado.';
        return [
            'ok' => false,
            'error' => 'Não foi possível publicar a foto.',
            'output' => $detail,
        ];
    }

    return ['ok' => true, 'output' => $text];
}

function cms_cms_inbox_dir(): string
{
    return SITE_ROOT . DIRECTORY_SEPARATOR . 'assets' . DIRECTORY_SEPARATOR . 'inbox';
}
