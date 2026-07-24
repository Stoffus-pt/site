<?php
/**
 * Router para desenvolvimento local do site Stoffus:
 *   php -S 127.0.0.1:8080 router.php
 * (executar na pasta site/)
 */
declare(strict_types=1);

$root = __DIR__;
$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$uri = urldecode($uri);

function serve_file(string $path): bool
{
    if (!is_file($path)) {
        return false;
    }

    $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    $types = [
        'html' => 'text/html; charset=utf-8',
        'css' => 'text/css; charset=utf-8',
        'js' => 'application/javascript; charset=utf-8',
        'json' => 'application/json; charset=utf-8',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'webp' => 'image/webp',
        'gif' => 'image/gif',
        'svg' => 'image/svg+xml',
        'ico' => 'image/x-icon',
        'woff' => 'font/woff',
        'woff2' => 'font/woff2',
        'ttf' => 'font/ttf',
        'pdf' => 'application/pdf',
    ];

    header('Content-Type: ' . ($types[$ext] ?? 'application/octet-stream'));
    if (str_ends_with(str_replace('\\', '/', $path), '/js/photo-card-v.js')) {
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('Pragma: no-cache');
    }
    readfile($path);
    return true;
}

// CMS (PHP + estáticos)
if (str_starts_with($uri, '/cms')) {
    // /cms e /cms/ → painel
    if ($uri === '/cms' || $uri === '/cms/') {
        require $root . '/cms/index.php';
        return true;
    }

    $cmsPath = $root . str_replace('/', DIRECTORY_SEPARATOR, $uri);

    // Nunca servir credenciais / dados sensíveis por URL directo
    $baseName = strtolower(basename($cmsPath));
    if (
        $baseName === 'meta-accounts.json'
        || $baseName === 'config.php'
        || preg_match('/^social-posts(-.*)?\.json$/', $baseName)
    ) {
        http_response_code(403);
        header('Content-Type: text/plain; charset=utf-8');
        echo '403 - Acesso negado';
        return true;
    }

    // Scripts PHP do CMS (inclui api/social-file.php?f=…)
    if (is_file($cmsPath) && str_ends_with(strtolower($cmsPath), '.php')) {
        require $cmsPath;
        return true;
    }

    // CSS, JS, imagens, etc. dentro de /cms/
    if (serve_file($cmsPath)) {
        return true;
    }

    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    echo '404 CMS - ' . $uri;
    return true;
}

// Site público
if ($uri === '/' || $uri === '') {
    $uri = '/index.html';
}

$siteFile = $root . str_replace('/', DIRECTORY_SEPARATOR, $uri);
if (serve_file($siteFile)) {
    return true;
}

http_response_code(404);
header('Content-Type: text/plain; charset=utf-8');
echo "404 - " . $uri;
return true;
