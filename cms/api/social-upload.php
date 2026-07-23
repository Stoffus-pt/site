<?php
declare(strict_types=1);

require __DIR__ . '/../bootstrap.php';
require_once CMS_DIR . '/lib/SocialData.php';

cms_require_auth();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    cms_json(['ok' => false, 'error' => 'Método inválido.'], 405);
}

if (empty($_FILES['files'])) {
    cms_json(['ok' => false, 'error' => 'Nenhum ficheiro enviado.'], 422);
}

$files = $_FILES['files'];
// Normalizar multi-upload
$items = [];
if (is_array($files['name'])) {
    $count = count($files['name']);
    for ($i = 0; $i < $count; $i++) {
        $items[] = [
            'name' => $files['name'][$i],
            'type' => $files['type'][$i],
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
    'image/png' => 'png',
    'image/webp' => 'webp',
];

$subdir = date('Y/m');
$destDir = cms_social_media_dir() . '/' . $subdir;
if (!is_dir($destDir) && !mkdir($destDir, 0755, true) && !is_dir($destDir)) {
    cms_json(['ok' => false, 'error' => 'Não foi possível criar a pasta de media.'], 500);
}

$saved = [];
$errors = [];

foreach ($items as $item) {
    if ((int) $item['error'] !== UPLOAD_ERR_OK) {
        $errors[] = ($item['name'] ?? 'ficheiro') . ': erro de upload.';
        continue;
    }
    if ((int) $item['size'] > 12 * 1024 * 1024) {
        $errors[] = ($item['name'] ?? 'ficheiro') . ': máximo 12 MB.';
        continue;
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($item['tmp_name']) ?: '';
    if (!isset($allowed[$mime])) {
        $errors[] = ($item['name'] ?? 'ficheiro') . ': tipo não suportado.';
        continue;
    }

    $ext = $allowed[$mime];
    $name = bin2hex(random_bytes(8)) . '.' . $ext;
    $target = $destDir . '/' . $name;
    if (!move_uploaded_file($item['tmp_name'], $target)) {
        $errors[] = ($item['name'] ?? 'ficheiro') . ': falha ao gravar.';
        continue;
    }

    $rel = $subdir . '/' . $name;
    $saved[] = [
        'path' => $rel,
        'url' => 'data/social-media/' . $rel,
        'name' => (string) ($item['name'] ?? $name),
        'size' => (int) $item['size'],
    ];
}

cms_json([
    'ok' => count($saved) > 0,
    'files' => $saved,
    'errors' => $errors,
]);
