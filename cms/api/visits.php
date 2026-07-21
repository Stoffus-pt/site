<?php
declare(strict_types=1);

/**
 * Contador público de visitas do site.
 * Continua a partir do número histórico do site anterior (3.377.596).
 */
require __DIR__ . '/../bootstrap.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

const VISITS_BASE = 3377596;

function visits_file(): string
{
    $dir = CMS_DIR . '/data';
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    return $dir . '/visits-count.json';
}

function visits_read(): int
{
    $path = visits_file();
    if (!is_file($path)) {
        return VISITS_BASE;
    }
    $raw = file_get_contents($path);
    $data = json_decode($raw ?: '{}', true);
    if (!is_array($data)) {
        return VISITS_BASE;
    }
    $count = (int) ($data['count'] ?? VISITS_BASE);
    return max(VISITS_BASE, $count);
}

function visits_write(int $count): bool
{
    $path = visits_file();
    $payload = json_encode([
        'count' => $count,
        'updatedAt' => date('c'),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($payload === false) {
        return false;
    }
    return file_put_contents($path, $payload . "\n", LOCK_EX) !== false;
}

$action = (string) ($_GET['action'] ?? $_POST['action'] ?? 'get');

if ($action === 'get') {
    cms_json([
        'ok' => true,
        'count' => visits_read(),
    ]);
}

if ($action === 'hit') {
    $path = visits_file();
    $fp = @fopen($path, 'c+');
    if ($fp === false) {
        cms_json(['ok' => false, 'error' => 'Não foi possível abrir o contador.'], 500);
    }

    if (!flock($fp, LOCK_EX)) {
        fclose($fp);
        cms_json(['ok' => false, 'error' => 'Contador ocupado.'], 503);
    }

    $size = filesize($path);
    $raw = ($size !== false && $size > 0) ? fread($fp, $size) : '';
    $data = json_decode($raw ?: '{}', true);
    if (!is_array($data)) {
        $data = [];
    }
    $count = max(VISITS_BASE, (int) ($data['count'] ?? VISITS_BASE));
    $count++;
    $payload = json_encode([
        'count' => $count,
        'updatedAt' => date('c'),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, $payload . "\n");
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);

    cms_json([
        'ok' => true,
        'count' => $count,
    ]);
}

cms_json(['ok' => false, 'error' => 'Acção inválida.'], 400);
