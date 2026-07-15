<?php
declare(strict_types=1);

require __DIR__ . '/../bootstrap.php';
require_once CMS_DIR . '/lib/ModelsData.php';
require_once CMS_DIR . '/lib/PhotoCrops.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    cms_json(['ok' => false, 'error' => 'Método inválido.'], 405);
}

cms_require_auth();

$modelId = trim((string) ($_POST['modelId'] ?? ''));
$slot = max(1, min(6, (int) ($_POST['slot'] ?? 1)));

if (!cms_validate_model_id($modelId)) {
    cms_json(['ok' => false, 'error' => 'Modelo inválido.'], 400);
}

if (empty($_FILES['photo']) || !is_array($_FILES['photo'])) {
    cms_json(['ok' => false, 'error' => 'Nenhuma imagem enviada.'], 400);
}

$file = $_FILES['photo'];
if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    cms_json(['ok' => false, 'error' => 'Erro no envio do ficheiro.'], 400);
}

$tmpName = (string) ($file['tmp_name'] ?? '');
$original = (string) ($file['name'] ?? '');
$size = (int) ($file['size'] ?? 0);

if ($size <= 0 || $size > 20 * 1024 * 1024) {
    cms_json(['ok' => false, 'error' => 'Imagem demasiado grande (máx. 20 MB).'], 400);
}

$ext = strtolower(pathinfo($original, PATHINFO_EXTENSION));
$allowed = ['png', 'jpg', 'jpeg', 'webp'];
if (!in_array($ext, $allowed, true)) {
    cms_json(['ok' => false, 'error' => 'Formato não suportado. Use PNG, JPG ou WebP.'], 400);
}

try {
    $data = cms_load_models_data();
} catch (RuntimeException $e) {
    cms_json(['ok' => false, 'error' => $e->getMessage()], 500);
}

$index = cms_find_model_index($data, $modelId);
if ($index === null) {
    cms_json(['ok' => false, 'error' => 'Modelo não encontrado.'], 404);
}

$model = $data['models'][$index];
if (empty($model['photo'])) {
    cms_json(['ok' => false, 'error' => 'Este modelo não usa fotos. Active «Usa fotos» no editor do modelo.'], 400);
}

$photoCount = max(1, (int) ($model['photoCount'] ?? 2));
if ($slot > $photoCount) {
    cms_json(['ok' => false, 'error' => 'Slot ' . $slot . ' não existe. Aumente o número de fotos do modelo.'], 400);
}

$inbox = cms_cms_inbox_dir();
if (!is_dir($inbox) && !mkdir($inbox, 0755, true)) {
    cms_json(['ok' => false, 'error' => 'Não foi possível preparar a pasta de upload.'], 500);
}

$stored = $inbox . DIRECTORY_SEPARATOR . $modelId . '-upload-' . uniqid('', true) . '.' . $ext;
if (!move_uploaded_file($tmpName, $stored)) {
    cms_json(['ok' => false, 'error' => 'Não foi possível guardar a imagem enviada.'], 500);
}

$result = cms_publish_model_photo($modelId, $stored, $slot);
@unlink($stored);

if (!$result['ok']) {
    cms_json([
        'ok' => false,
        'error' => $result['error'] ?? 'Erro ao publicar.',
        'output' => $result['output'] ?? '',
    ], 500);
}

$cacheVersion = null;
$catalogSlot = max(1, (int) ($model['catalogSlot'] ?? 1));
if ($slot === $catalogSlot) {
    $cacheVersion = cms_bump_photo_card_version();
}

cms_json([
    'ok' => true,
    'message' => 'Foto ' . $slot . ' publicada para «' . ($model['name'] ?? $modelId) . '».',
    'slot' => $slot,
    'exists' => cms_model_photo_exists($modelId, $slot),
    'cacheVersion' => $cacheVersion,
    'output' => $result['output'] ?? '',
]);
