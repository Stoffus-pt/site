<?php
declare(strict_types=1);

require __DIR__ . '/../bootstrap.php';
require_once CMS_DIR . '/lib/SocialData.php';

cms_require_auth();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    cms_json(['ok' => false, 'error' => 'Método inválido.'], 405);
}

// Aceitar files[] (PHP → files) ou file
$files = null;
if (!empty($_FILES['files'])) {
    $files = $_FILES['files'];
} elseif (!empty($_FILES['file'])) {
    $files = $_FILES['file'];
}

if ($files === null) {
    $keys = array_keys($_FILES);
    cms_json([
        'ok' => false,
        'error' => 'Nenhum ficheiro enviado.',
        'detail' => 'Chaves recebidas: ' . ($keys ? implode(', ', $keys) : '(vazio)'),
    ], 422);
}

// Normalizar multi-upload
$items = [];
if (is_array($files['name'])) {
    $count = count($files['name']);
    for ($i = 0; $i < $count; $i++) {
        $items[] = [
            'name' => $files['name'][$i],
            'type' => $files['type'][$i] ?? '',
            'tmp_name' => $files['tmp_name'][$i],
            'error' => $files['error'][$i],
            'size' => $files['size'][$i],
        ];
    }
} else {
    $items[] = $files;
}

$allowed = [
    'image/jpeg' => 'jpg',
    'image/jpg' => 'jpg',
    'image/pjpeg' => 'jpg',
    'image/png' => 'png',
    'image/webp' => 'webp',
    'image/gif' => 'gif',
];

$subdir = date('Y') . '/' . date('m');
$destDir = cms_social_media_dir() . DIRECTORY_SEPARATOR . date('Y') . DIRECTORY_SEPARATOR . date('m');
if (!is_dir($destDir) && !mkdir($destDir, 0755, true) && !is_dir($destDir)) {
    cms_json(['ok' => false, 'error' => 'Não foi possível criar a pasta de media.'], 500);
}

$saved = [];
$errors = [];

foreach ($items as $item) {
    $label = (string) ($item['name'] ?? 'ficheiro');
    if ((int) $item['error'] !== UPLOAD_ERR_OK) {
        $errors[] = $label . ': erro de upload (' . (int) $item['error'] . ').';
        continue;
    }
    if ((int) $item['size'] > 12 * 1024 * 1024) {
        $errors[] = $label . ': máximo 12 MB.';
        continue;
    }
    if (!is_uploaded_file((string) $item['tmp_name'])) {
        $errors[] = $label . ': ficheiro temporário inválido.';
        continue;
    }

    $mime = '';
    if (class_exists('finfo')) {
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mime = (string) ($finfo->file($item['tmp_name']) ?: '');
    }
    if ($mime === '' || $mime === 'application/octet-stream') {
        $mime = (string) ($item['type'] ?? '');
    }
    // Fallback por extensão (ex.: alguns Windows / HEIC convertidos)
    if (!isset($allowed[$mime])) {
        $extGuess = strtolower(pathinfo($label, PATHINFO_EXTENSION));
        $byExt = [
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'png' => 'image/png',
            'webp' => 'image/webp',
            'gif' => 'image/gif',
        ];
        if (isset($byExt[$extGuess])) {
            $mime = $byExt[$extGuess];
        }
    }

    if (!isset($allowed[$mime])) {
        $errors[] = $label . ': tipo não suportado (' . ($mime ?: 'desconhecido') . '). Use JPG, PNG ou WebP.';
        continue;
    }

    $ext = $allowed[$mime];
    try {
        $name = bin2hex(random_bytes(8)) . '.' . $ext;
    } catch (Throwable $e) {
        $name = uniqid('img', true) . '.' . $ext;
    }
    $target = $destDir . DIRECTORY_SEPARATOR . $name;
    if (!move_uploaded_file($item['tmp_name'], $target)) {
        $errors[] = $label . ': falha ao gravar no disco.';
        continue;
    }

    $rel = $subdir . '/' . $name;
    $saved[] = [
        'path' => $rel,
        'url' => 'api/social-file.php?f=' . rawurlencode($rel),
        'name' => $label,
        'size' => (int) $item['size'],
    ];
}

cms_json([
    'ok' => count($saved) > 0,
    'files' => $saved,
    'errors' => $errors,
]);
