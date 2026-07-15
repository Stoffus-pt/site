<?php
declare(strict_types=1);

function cms_models_path(): string
{
    return SITE_ROOT . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'models.json';
}

function cms_load_models_data(): array
{
    $path = cms_models_path();
    if (!is_file($path)) {
        throw new RuntimeException('models.json não encontrado.');
    }
    $data = json_decode((string) file_get_contents($path), true);
    if (!is_array($data)) {
        throw new RuntimeException('models.json inválido.');
    }
    if (!isset($data['models']) || !is_array($data['models'])) {
        $data['models'] = [];
    }
    return $data;
}

function cms_save_models_data(array $data): bool
{
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        return false;
    }
    return file_put_contents(cms_models_path(), $json . "\n") !== false;
}

function cms_find_model_index(array $data, string $modelId): ?int
{
    foreach ($data['models'] as $index => $model) {
        if (($model['id'] ?? '') === $modelId) {
            return $index;
        }
    }
    return null;
}

function cms_model_photo_dirs(): array
{
    $root = dirname(SITE_ROOT);
    return [
        SITE_ROOT . DIRECTORY_SEPARATOR . 'assets' . DIRECTORY_SEPARATOR . 'photos' . DIRECTORY_SEPARATOR . 'models',
        $root . DIRECTORY_SEPARATOR . 'assets' . DIRECTORY_SEPARATOR . 'photos' . DIRECTORY_SEPARATOR . 'models',
    ];
}

function cms_swap_model_photo_files(string $modelId, int $slotA, int $slotB): void
{
    if ($slotA === $slotB) {
        return;
    }

    $suffixes = ['.png', '-md.png', '-sm.png', '.webp'];
    foreach (cms_model_photo_dirs() as $dir) {
        if (!is_dir($dir)) {
            continue;
        }
        foreach ($suffixes as $suffix) {
            $fileA = $dir . DIRECTORY_SEPARATOR . $modelId . '-' . $slotA . $suffix;
            $fileB = $dir . DIRECTORY_SEPARATOR . $modelId . '-' . $slotB . $suffix;
            if (!is_file($fileA) && !is_file($fileB)) {
                continue;
            }
            $tmp = $dir . DIRECTORY_SEPARATOR . $modelId . '-swap-' . uniqid('', true) . $suffix;
            if (is_file($fileA)) {
                rename($fileA, $tmp);
            }
            if (is_file($fileB)) {
                rename($fileB, $fileA);
            }
            if (is_file($tmp)) {
                rename($tmp, $fileB);
            }
        }
    }
}

function cms_swap_photo_crop_entries(string $modelId, int $slotA, int $slotB): void
{
    require_once CMS_DIR . '/lib/PhotoCrops.php';
    $path = cms_photo_crops_path();
    if (!is_file($path)) {
        return;
    }
    $config = json_decode((string) file_get_contents($path), true);
    if (!is_array($config)) {
        return;
    }
    if (!isset($config['crops'][$modelId]) || !is_array($config['crops'][$modelId])) {
        return;
    }
    $keyA = (string) $slotA;
    $keyB = (string) $slotB;
    $entryA = $config['crops'][$modelId][$keyA] ?? null;
    $entryB = $config['crops'][$modelId][$keyB] ?? null;
    if ($entryA !== null) {
        $config['crops'][$modelId][$keyB] = $entryA;
    } else {
        unset($config['crops'][$modelId][$keyB]);
    }
    if ($entryB !== null) {
        $config['crops'][$modelId][$keyA] = $entryB;
    } else {
        unset($config['crops'][$modelId][$keyA]);
    }
    $json = json_encode(cms_validate_photo_crops($config), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json !== false) {
        file_put_contents($path, $json . "\n");
    }
}

function cms_normalize_photo_order(int $photoCount, ?array $photoOrder): array
{
    $order = [];
    foreach ($photoOrder ?? [] as $slot) {
        $slot = (int) $slot;
        if ($slot >= 1 && $slot <= $photoCount && !in_array($slot, $order, true)) {
            $order[] = $slot;
        }
    }
    for ($slot = 1; $slot <= $photoCount; $slot++) {
        if (!in_array($slot, $order, true)) {
            $order[] = $slot;
        }
    }
    return $order;
}

function cms_model_photo_suffixes(): array
{
    return ['.png', '-md.png', '-sm.png', '.webp'];
}

function cms_model_photo_exists(string $modelId, int $slot): bool
{
    foreach (cms_model_photo_dirs() as $dir) {
        $path = $dir . DIRECTORY_SEPARATOR . $modelId . '-' . $slot . '.png';
        if (is_file($path)) {
            return true;
        }
    }
    return false;
}

function cms_delete_model_photo_files(string $modelId, int $slot): int
{
    $removed = 0;
    foreach (cms_model_photo_dirs() as $dir) {
        if (!is_dir($dir)) {
            continue;
        }
        foreach (cms_model_photo_suffixes() as $suffix) {
            $path = $dir . DIRECTORY_SEPARATOR . $modelId . '-' . $slot . $suffix;
            if (is_file($path) && @unlink($path)) {
                $removed += 1;
            }
        }
    }
    return $removed;
}

function cms_delete_photo_crop_entry(string $modelId, int $slot): void
{
    require_once CMS_DIR . '/lib/PhotoCrops.php';
    $path = cms_photo_crops_path();
    if (!is_file($path)) {
        return;
    }
    $config = json_decode((string) file_get_contents($path), true);
    if (!is_array($config) || !isset($config['crops'][$modelId])) {
        return;
    }
    unset($config['crops'][$modelId][(string) $slot]);
    if ($config['crops'][$modelId] === []) {
        unset($config['crops'][$modelId]);
    }
    $json = json_encode(cms_validate_photo_crops($config), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json !== false) {
        file_put_contents($path, $json . "\n");
    }
}

function cms_delete_all_model_photos(string $modelId, int $maxSlot = 6): void
{
    for ($slot = 1; $slot <= $maxSlot; $slot++) {
        cms_delete_model_photo_files($modelId, $slot);
    }
    require_once CMS_DIR . '/lib/PhotoCrops.php';
    $path = cms_photo_crops_path();
    if (!is_file($path)) {
        return;
    }
    $config = json_decode((string) file_get_contents($path), true);
    if (!is_array($config)) {
        return;
    }
    unset($config['crops'][$modelId]);
    $json = json_encode(cms_validate_photo_crops($config), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json !== false) {
        file_put_contents($path, $json . "\n");
    }
}

function cms_remove_model_from_lists(array &$data, string $modelId): void
{
    foreach (['novidadesOrder', 'featuredHome'] as $key) {
        if (!isset($data[$key]) || !is_array($data[$key])) {
            continue;
        }
        $data[$key] = array_values(array_filter($data[$key], static fn ($id) => $id !== $modelId));
    }
    if (isset($data['heroFeature']['model']) && $data['heroFeature']['model'] === $modelId) {
        unset($data['heroFeature']);
    }
}

function cms_validate_model_id(string $modelId): bool
{
    return $modelId !== '' && (bool) preg_match('/^[a-z0-9][a-z0-9\-]*$/', $modelId);
}

function cms_sanitize_model_payload(array $input, bool $isCreate = false): array
{
    $model = [];
    if ($isCreate) {
        $model['id'] = strtolower(trim((string) ($input['id'] ?? '')));
        if (!cms_validate_model_id($model['id'])) {
            throw new InvalidArgumentException('ID inválido. Use letras minúsculas, números e hífen (ex: pouff-yan).');
        }
    }

    if (array_key_exists('name', $input)) {
        $model['name'] = trim((string) $input['name']);
        if ($model['name'] === '') {
            throw new InvalidArgumentException('Nome obrigatório.');
        }
    }

    if (array_key_exists('type', $input)) {
        $type = trim((string) $input['type']);
        if ($type === '') {
            throw new InvalidArgumentException('Tipo obrigatório.');
        }
        $model['type'] = $type;
    }

    if (array_key_exists('tag', $input)) {
        $model['tag'] = trim((string) $input['tag']);
    }

    if (array_key_exists('description', $input)) {
        $model['description'] = trim((string) $input['description']);
    }

    if (array_key_exists('photo', $input)) {
        $model['photo'] = !empty($input['photo']);
    }

    if (array_key_exists('novidade', $input)) {
        $model['novidade'] = !empty($input['novidade']);
    }

    if (array_key_exists('configurator', $input)) {
        $model['configurator'] = !empty($input['configurator']);
    }

    if (array_key_exists('photoCutout', $input)) {
        if (!empty($input['photoCutout'])) {
            $model['photoCutout'] = true;
        } else {
            $model['photoCutout'] = false;
        }
    }

    if (array_key_exists('photoCount', $input)) {
        $model['photoCount'] = max(1, min(6, (int) $input['photoCount']));
    }

    if (array_key_exists('catalogSlot', $input)) {
        $model['catalogSlot'] = max(1, min(6, (int) $input['catalogSlot']));
    }

    if (array_key_exists('photoOrder', $input) && is_array($input['photoOrder'])) {
        $count = max(1, (int) ($model['photoCount'] ?? $input['photoCount'] ?? 2));
        $model['photoOrder'] = cms_normalize_photo_order($count, $input['photoOrder']);
    }

    return $model;
}

function cms_model_slots_payload(string $modelId, int $photoCount): array
{
    $slots = [];
    for ($slot = 1; $slot <= $photoCount; $slot++) {
        $slots[] = [
            'slot' => $slot,
            'exists' => cms_model_photo_exists($modelId, $slot),
        ];
    }
    return $slots;
}
