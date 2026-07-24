<?php
declare(strict_types=1);

/**
 * Serve imagens do módulo Redes (pré-visualização CMS + URL pública para a Meta).
 * Uso: /cms/api/social-file.php?f=2026/07/abc.jpg
 */
require __DIR__ . '/../bootstrap.php';
require_once CMS_DIR . '/lib/SocialData.php';

$rel = (string) ($_GET['f'] ?? '');
$rel = str_replace('\\', '/', $rel);
$rel = ltrim($rel, '/');

if ($rel === '' || strpos($rel, '..') !== false || !preg_match('#^[0-9]{4}/[0-9]{2}/[a-zA-Z0-9._-]+$#', $rel)) {
    http_response_code(400);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Pedido inválido.';
    exit;
}

$path = cms_social_media_dir() . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $rel);
$realMedia = realpath(cms_social_media_dir());
$realFile = realpath($path);

if ($realMedia === false || $realFile === false || strpos($realFile, $realMedia) !== 0 || !is_file($realFile)) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Ficheiro não encontrado.';
    exit;
}

$ext = strtolower(pathinfo($realFile, PATHINFO_EXTENSION));
$types = [
    'jpg' => 'image/jpeg',
    'jpeg' => 'image/jpeg',
    'png' => 'image/png',
    'webp' => 'image/webp',
    'gif' => 'image/gif',
];

header('Content-Type: ' . ($types[$ext] ?? 'application/octet-stream'));
header('Cache-Control: public, max-age=86400');
header('Content-Length: ' . (string) filesize($realFile));
readfile($realFile);
exit;
