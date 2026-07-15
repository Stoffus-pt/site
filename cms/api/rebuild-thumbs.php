<?php
declare(strict_types=1);

require __DIR__ . '/../bootstrap.php';
require_once CMS_DIR . '/lib/PhotoCrops.php';
cms_require_auth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    cms_json(['ok' => false, 'error' => 'Método inválido.'], 405);
}

$input = json_decode(file_get_contents('php://input') ?: '{}', true);
$modelId = trim((string) ($input['modelId'] ?? ''));

$rebuildResult = cms_rebuild_card_thumbs($modelId);
if (!$rebuildResult['ok']) {
    cms_json([
        'ok' => false,
        'error' => $rebuildResult['error'],
        'output' => $rebuildResult['output'] ?? '',
    ], 500);
}

$cacheVersion = cms_bump_photo_card_version();

cms_json([
    'ok' => true,
    'message' => $modelId !== ''
        ? 'Miniatura regenerada para ' . $modelId . '.'
        : 'Miniaturas do catálogo regeneradas.',
    'output' => $rebuildResult['output'] ?? '',
    'cacheVersion' => $cacheVersion,
]);
