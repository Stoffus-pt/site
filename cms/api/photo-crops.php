<?php
declare(strict_types=1);

require __DIR__ . '/../bootstrap.php';
require_once CMS_DIR . '/lib/PhotoCrops.php';

$cropsFile = cms_photo_crops_path();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (!is_file($cropsFile)) {
        cms_json(['ok' => true, 'config' => cms_default_photo_crops()]);
    }
    $raw = file_get_contents($cropsFile);
    $config = json_decode($raw ?: '{}', true);
    cms_json([
        'ok' => true,
        'config' => is_array($config) ? cms_validate_photo_crops($config) : cms_default_photo_crops(),
    ]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    cms_require_auth();

    $input = json_decode(file_get_contents('php://input') ?: '{}', true);
    $config = $input['config'] ?? $input;
    $modelId = trim((string) ($input['modelId'] ?? ''));
    $rebuild = !empty($input['rebuild']);

    if (!is_array($config)) {
        cms_json(['ok' => false, 'error' => 'Dados inválidos.'], 400);
    }

    $clean = cms_validate_photo_crops($config);
    $json = json_encode($clean, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        cms_json(['ok' => false, 'error' => 'Não foi possível serializar a configuração.'], 500);
    }

    $dir = dirname($cropsFile);
    if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
        cms_json(['ok' => false, 'error' => 'Não foi possível criar a pasta de dados.'], 500);
    }

    if (file_put_contents($cropsFile, $json . "\n") === false) {
        cms_json(['ok' => false, 'error' => 'Não foi possível guardar photo-crops.json.'], 500);
    }

    $response = [
        'ok' => true,
        'message' => 'Configuração de cortes guardada.',
        'cacheVersion' => null,
        'rebuild' => null,
    ];

    if ($rebuild) {
        $rebuildResult = cms_rebuild_card_thumbs($modelId);
        $response['rebuild'] = $rebuildResult;
        if (!$rebuildResult['ok']) {
            cms_json([
                'ok' => false,
                'error' => $rebuildResult['error'],
                'message' => 'JSON guardado, mas a miniatura não foi regenerada.',
                'output' => $rebuildResult['output'] ?? '',
            ], 500);
        }
        $response['message'] = $modelId !== ''
            ? 'Corte guardado e miniatura regenerada para ' . $modelId . '.'
            : 'Cortes guardados e miniaturas regeneradas.';
    }

    $response['cacheVersion'] = cms_bump_photo_card_version();
    cms_json($response);
}

cms_json(['ok' => false, 'error' => 'Método inválido.'], 405);
