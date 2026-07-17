<?php
declare(strict_types=1);

require __DIR__ . '/../bootstrap.php';
require_once CMS_DIR . '/lib/ModelsData.php';
require_once CMS_DIR . '/lib/PhotoCrops.php';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    cms_require_auth();
    $action = (string) ($_GET['action'] ?? 'list');
    $modelId = trim((string) ($_GET['modelId'] ?? ''));

    try {
        $data = cms_load_models_data();
    } catch (RuntimeException $e) {
        cms_json(['ok' => false, 'error' => $e->getMessage()], 500);
    }

    if ($action === 'get') {
        if (!cms_validate_model_id($modelId)) {
            cms_json(['ok' => false, 'error' => 'Modelo inválido.'], 400);
        }
        $index = cms_find_model_index($data, $modelId);
        if ($index === null) {
            cms_json(['ok' => false, 'error' => 'Modelo não encontrado.'], 404);
        }
        $model = $data['models'][$index];
        $photoCount = max(1, (int) ($model['photoCount'] ?? ($model['photo'] ? 2 : 0)));
        cms_json([
            'ok' => true,
            'model' => $model,
            'slots' => !empty($model['photo']) ? cms_model_slots_payload($modelId, $photoCount) : [],
            'types' => $data['types'] ?? [],
        ]);
    }

    $models = array_map(static function (array $model) {
        $photoCount = max(0, (int) ($model['photoCount'] ?? ($model['photo'] ? 2 : 0)));
        $payload = [
            'id' => $model['id'],
            'name' => $model['name'],
            'type' => $model['type'] ?? '',
            'tag' => $model['tag'] ?? '',
            'photo' => !empty($model['photo']),
            'novidade' => !empty($model['novidade']),
            'configurator' => array_key_exists('configurator', $model) ? !empty($model['configurator']) : true,
            'photoCutout' => !empty($model['photoCutout']),
            'description' => $model['description'] ?? '',
        ];
        if (!empty($model['photo'])) {
            $payload['photoCount'] = max(1, $photoCount);
            $payload['catalogSlot'] = max(1, min($payload['photoCount'], (int) ($model['catalogSlot'] ?? 1)));
            $payload['photoOrder'] = cms_normalize_photo_order($payload['photoCount'], $model['photoOrder'] ?? null);
            $payload['slots'] = cms_model_slots_payload($model['id'], $payload['photoCount']);
        }
        return $payload;
    }, $data['models']);

    usort($models, static fn ($a, $b) => strcmp($a['name'], $b['name']));

    cms_json([
        'ok' => true,
        'types' => $data['types'] ?? [],
        'models' => $models,
    ]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    cms_require_auth();
    $input = json_decode(file_get_contents('php://input') ?: '{}', true);
    if (!is_array($input)) {
        cms_json(['ok' => false, 'error' => 'Pedido inválido.'], 400);
    }

    $action = (string) ($input['action'] ?? '');

    try {
        $data = cms_load_models_data();
    } catch (RuntimeException $e) {
        cms_json(['ok' => false, 'error' => $e->getMessage()], 500);
    }

    if ($action === 'create') {
        try {
            $model = cms_sanitize_model_payload($input, true);
        } catch (InvalidArgumentException $e) {
            cms_json(['ok' => false, 'error' => $e->getMessage()], 400);
        }

        if (cms_find_model_index($data, $model['id']) !== null) {
            cms_json(['ok' => false, 'error' => 'Já existe um modelo com este ID.'], 409);
        }

        $defaults = [
            'name' => $model['name'] ?? ucfirst($model['id']),
            'type' => $model['type'] ?? 'relax',
            'tag' => $model['tag'] ?? '',
            'photo' => $model['photo'] ?? true,
            'novidade' => $model['novidade'] ?? false,
            'configurator' => $model['configurator'] ?? true,
            'description' => $model['description'] ?? '',
            'measurements' => $model['measurements'] ?? [],
            'options' => $model['options'] ?? [],
            'related' => $model['related'] ?? [],
            'pdf' => $model['pdf'] ?? '',
        ];

        if (!empty($defaults['photo'])) {
            $defaults['photoCount'] = max(1, (int) ($model['photoCount'] ?? 1));
            $defaults['catalogSlot'] = max(1, min($defaults['photoCount'], (int) ($model['catalogSlot'] ?? 1)));
            $defaults['photoOrder'] = cms_normalize_photo_order($defaults['photoCount'], $model['photoOrder'] ?? null);
            if (!empty($model['photoCutout'])) {
                $defaults['photoCutout'] = true;
            }
        } else {
            $defaults['configurator'] = false;
        }

        if (($defaults['type'] ?? '') === 'pet') {
            $defaults['configurator'] = false;
        }

        $entry = array_merge(['id' => $model['id']], $defaults);
        $data['models'][] = $entry;

        if (!cms_save_models_data($data)) {
            cms_json(['ok' => false, 'error' => 'Não foi possível guardar models.json.'], 500);
        }

        cms_json([
            'ok' => true,
            'message' => 'Modelo «' . $entry['name'] . '» criado.',
            'model' => $entry,
        ]);
    }

    if ($action === 'update') {
        $modelId = trim((string) ($input['modelId'] ?? ''));
        if (!cms_validate_model_id($modelId)) {
            cms_json(['ok' => false, 'error' => 'Modelo inválido.'], 400);
        }

        $index = cms_find_model_index($data, $modelId);
        if ($index === null) {
            cms_json(['ok' => false, 'error' => 'Modelo não encontrado.'], 404);
        }

        try {
            $patch = cms_sanitize_model_payload($input, false);
        } catch (InvalidArgumentException $e) {
            cms_json(['ok' => false, 'error' => $e->getMessage()], 400);
        }

        unset($patch['id']);
        $updated = array_merge($data['models'][$index], $patch);

        if (!empty($updated['photo'])) {
            $photoCount = max(1, (int) ($updated['photoCount'] ?? 1));
            $updated['photoCount'] = $photoCount;
            $updated['catalogSlot'] = max(1, min($photoCount, (int) ($updated['catalogSlot'] ?? 1)));
            $updated['photoOrder'] = cms_normalize_photo_order($photoCount, $updated['photoOrder'] ?? null);
            if (empty($updated['photoCutout'])) {
                unset($updated['photoCutout']);
            }
        } else {
            unset($updated['photoCount'], $updated['catalogSlot'], $updated['photoOrder'], $updated['photoCutout']);
            $updated['configurator'] = false;
        }

        if (($updated['type'] ?? '') === 'pet') {
            $updated['configurator'] = false;
        }

        if (array_key_exists('novidade', $input)) {
            if (!empty($input['novidade'])) {
                if (!isset($data['novidadesOrder']) || !is_array($data['novidadesOrder'])) {
                    $data['novidadesOrder'] = [];
                }
                if (!in_array($modelId, $data['novidadesOrder'], true)) {
                    $data['novidadesOrder'][] = $modelId;
                }
            } elseif (isset($data['novidadesOrder']) && is_array($data['novidadesOrder'])) {
                $data['novidadesOrder'] = array_values(array_filter(
                    $data['novidadesOrder'],
                    static fn ($id) => $id !== $modelId
                ));
            }
        }

        $data['models'][$index] = $updated;

        if (!cms_save_models_data($data)) {
            cms_json(['ok' => false, 'error' => 'Não foi possível guardar models.json.'], 500);
        }

        cms_json([
            'ok' => true,
            'message' => 'Modelo actualizado.',
            'model' => $updated,
        ]);
    }

    if ($action === 'delete') {
        $modelId = trim((string) ($input['modelId'] ?? ''));
        if (!cms_validate_model_id($modelId)) {
            cms_json(['ok' => false, 'error' => 'Modelo inválido.'], 400);
        }

        $index = cms_find_model_index($data, $modelId);
        if ($index === null) {
            cms_json(['ok' => false, 'error' => 'Modelo não encontrado.'], 404);
        }

        $name = (string) ($data['models'][$index]['name'] ?? $modelId);
        array_splice($data['models'], $index, 1);
        cms_remove_model_from_lists($data, $modelId);

        if (!empty($input['deletePhotos'])) {
            cms_delete_all_model_photos($modelId);
        }

        if (!cms_save_models_data($data)) {
            cms_json(['ok' => false, 'error' => 'Não foi possível guardar models.json.'], 500);
        }

        cms_json([
            'ok' => true,
            'message' => 'Modelo «' . $name . '» removido do catálogo.',
        ]);
    }

    cms_json(['ok' => false, 'error' => 'Acção inválida.'], 400);
}

cms_json(['ok' => false, 'error' => 'Método inválido.'], 405);
