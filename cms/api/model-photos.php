<?php
declare(strict_types=1);

require __DIR__ . '/../bootstrap.php';
require_once CMS_DIR . '/lib/ModelsData.php';
require_once CMS_DIR . '/lib/PhotoCrops.php';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    cms_require_auth();
    try {
        $data = cms_load_models_data();
    } catch (RuntimeException $e) {
        cms_json(['ok' => false, 'error' => $e->getMessage()], 500);
    }

    $models = [];
    foreach ($data['models'] as $model) {
        if (empty($model['photo'])) {
            continue;
        }
        $photoCount = max(1, (int) ($model['photoCount'] ?? 2));
        $catalogSlot = max(1, (int) ($model['catalogSlot'] ?? 1));
        $models[] = [
            'id' => $model['id'],
            'name' => $model['name'],
            'photoCount' => $photoCount,
            'catalogSlot' => min($catalogSlot, $photoCount),
            'photoOrder' => cms_normalize_photo_order($photoCount, $model['photoOrder'] ?? null),
            'slots' => cms_model_slots_payload($model['id'], $photoCount),
        ];
    }

    usort($models, static fn ($a, $b) => strcmp($a['name'], $b['name']));
    cms_json(['ok' => true, 'models' => $models]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    cms_require_auth();
    $input = json_decode(file_get_contents('php://input') ?: '{}', true);
    $action = (string) ($input['action'] ?? 'save');
    $modelId = trim((string) ($input['modelId'] ?? ''));

    if ($modelId === '' || !preg_match('/^[a-z0-9\-]+$/', $modelId)) {
        cms_json(['ok' => false, 'error' => 'Modelo inválido.'], 400);
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
        cms_json(['ok' => false, 'error' => 'Este modelo não usa fotos.'], 400);
    }

    if ($action === 'swap') {
        $slotA = (int) ($input['slotA'] ?? 0);
        $slotB = (int) ($input['slotB'] ?? 0);
        $photoCount = max(1, (int) ($model['photoCount'] ?? 2));
        if ($slotA < 1 || $slotB < 1 || $slotA > $photoCount || $slotB > $photoCount) {
            cms_json(['ok' => false, 'error' => 'Slots inválidos.'], 400);
        }
        cms_swap_model_photo_files($modelId, $slotA, $slotB);
        cms_swap_photo_crop_entries($modelId, $slotA, $slotB);

        $catalogSlot = (int) ($model['catalogSlot'] ?? 1);
        if ($catalogSlot === $slotA) {
            $data['models'][$index]['catalogSlot'] = $slotB;
        } elseif ($catalogSlot === $slotB) {
            $data['models'][$index]['catalogSlot'] = $slotA;
        }

        $order = cms_normalize_photo_order($photoCount, $model['photoOrder'] ?? null);
        $order = array_map(static function ($slot) use ($slotA, $slotB) {
            if ($slot === $slotA) {
                return $slotB;
            }
            if ($slot === $slotB) {
                return $slotA;
            }
            return $slot;
        }, $order);
        $data['models'][$index]['photoOrder'] = $order;

        if (!cms_save_models_data($data)) {
            cms_json(['ok' => false, 'error' => 'Não foi possível guardar models.json.'], 500);
        }

        $rebuild = cms_rebuild_card_thumbs($modelId);
        $cacheVersion = cms_bump_photo_card_version();
        cms_json([
            'ok' => true,
            'message' => 'Fotos trocadas entre slot ' . $slotA . ' e ' . $slotB . '.',
            'model' => $data['models'][$index],
            'rebuild' => $rebuild,
            'cacheVersion' => $cacheVersion,
        ]);
    }

    if ($action === 'delete') {
        $slot = max(1, min(6, (int) ($input['slot'] ?? 0)));
        $photoCount = max(1, (int) ($model['photoCount'] ?? 2));
        if ($slot < 1 || $slot > $photoCount) {
            cms_json(['ok' => false, 'error' => 'Slot inválido.'], 400);
        }

        $removed = cms_delete_model_photo_files($modelId, $slot);
        cms_delete_photo_crop_entry($modelId, $slot);

        $cacheVersion = null;
        $catalogSlot = (int) ($model['catalogSlot'] ?? 1);
        if ($slot === $catalogSlot) {
            $rebuild = cms_rebuild_card_thumbs($modelId);
            if ($rebuild['ok']) {
                $cacheVersion = cms_bump_photo_card_version();
            }
        }

        cms_json([
            'ok' => true,
            'message' => 'Foto ' . $slot . ' eliminada (' . $removed . ' ficheiros).',
            'removed' => $removed,
            'cacheVersion' => $cacheVersion,
        ]);
    }

    $photoCount = max(1, min(6, (int) ($input['photoCount'] ?? ($model['photoCount'] ?? 2))));
    $catalogSlot = max(1, min($photoCount, (int) ($input['catalogSlot'] ?? ($model['catalogSlot'] ?? 1))));
    $photoOrder = cms_normalize_photo_order($photoCount, $input['photoOrder'] ?? ($model['photoOrder'] ?? null));

    $data['models'][$index]['photoCount'] = $photoCount;
    $data['models'][$index]['catalogSlot'] = $catalogSlot;
    $data['models'][$index]['photoOrder'] = $photoOrder;

    if (!cms_save_models_data($data)) {
        cms_json(['ok' => false, 'error' => 'Não foi possível guardar models.json.'], 500);
    }

    $rebuild = null;
    $cacheVersion = null;
    if (!empty($input['rebuild'])) {
        $rebuild = cms_rebuild_card_thumbs($modelId);
        if (!$rebuild['ok']) {
            cms_json([
                'ok' => false,
                'error' => $rebuild['error'],
                'message' => 'Definições guardadas, mas a capa não foi regenerada.',
            ], 500);
        }
        $cacheVersion = cms_bump_photo_card_version();
    }

    cms_json([
        'ok' => true,
        'message' => 'Capa e galeria actualizadas.',
        'model' => $data['models'][$index],
        'rebuild' => $rebuild,
        'cacheVersion' => $cacheVersion,
    ]);
}

cms_json(['ok' => false, 'error' => 'Método inválido.'], 405);
