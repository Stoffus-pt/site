<?php
declare(strict_types=1);

session_start();

define('CMS_DIR', __DIR__);
define('SITE_ROOT', dirname(__DIR__));

$configFile = CMS_DIR . '/config.php';
if (!is_file($configFile)) {
    $configFile = CMS_DIR . '/config.example.php';
}

/** @var array{password_hash?:string,username?:string} $CMS_CONFIG */
$CMS_CONFIG = is_file($configFile) ? (include $configFile) : [];

function cms_json(array $data, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function cms_require_auth(): void
{
    if (empty($_SESSION['cms_auth'])) {
        cms_json(['ok' => false, 'error' => 'Não autenticado.'], 401);
    }
}

function cms_safe_page_name(string $name): string
{
    $name = basename($name);
    if (!preg_match('/^[a-z0-9][a-z0-9\-]*\.html$/i', $name)) {
        throw new InvalidArgumentException('Nome de página inválido.');
    }
    return $name;
}

function cms_page_path(string $name): string
{
    $name = cms_safe_page_name($name);
    $path = SITE_ROOT . DIRECTORY_SEPARATOR . $name;
    $real = realpath(dirname($path));
    $siteReal = realpath(SITE_ROOT);
    if ($real === false || $siteReal === false || strpos($real, $siteReal) !== 0) {
        throw new InvalidArgumentException('Caminho inválido.');
    }
    return SITE_ROOT . DIRECTORY_SEPARATOR . $name;
}

function cms_list_pages(): array
{
    $files = glob(SITE_ROOT . '/*.html') ?: [];
    $pages = [];
    foreach ($files as $file) {
        $base = basename($file);
        if ($base === '_template.html') {
            continue;
        }
        $pages[] = [
            'file' => $base,
            'slug' => preg_replace('/\.html$/', '', $base),
            'title' => cms_guess_title($file),
        ];
    }
    usort($pages, static function ($a, $b) {
        if ($a['file'] === 'index.html') {
            return -1;
        }
        if ($b['file'] === 'index.html') {
            return 1;
        }
        return strcmp($a['file'], $b['file']);
    });
    return $pages;
}

function cms_guess_title(string $filePath): string
{
    $html = @file_get_contents($filePath);
    if ($html === false) {
        return basename($filePath);
    }
    if (preg_match('/<title>(.*?)<\/title>/is', $html, $m)) {
        return trim(html_entity_decode($m[1], ENT_QUOTES | ENT_HTML5, 'UTF-8'));
    }
    return basename($filePath);
}

require_once CMS_DIR . '/lib/HtmlRegions.php';
