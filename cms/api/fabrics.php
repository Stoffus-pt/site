<?php
declare(strict_types=1);

require __DIR__ . '/../bootstrap.php';
require_once CMS_DIR . '/lib/FabricsData.php';

cms_require_auth();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $action = (string) ($_GET['action'] ?? 'list');

    try {
        if ($action === 'list') {
            $merged = cms_fabrics_list_merged();
            cms_json([
                'ok' => true,
                'meta' => $merged['meta'],
                'gamas' => $merged['gamas'],
                'collections' => $merged['collections'],
            ]);
        }
        cms_json(['ok' => false, 'error' => 'Acção inválida.'], 400);
    } catch (RuntimeException $e) {
        cms_json(['ok' => false, 'error' => $e->getMessage()], 500);
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input') ?: '{}', true);
    if (!is_array($input)) {
        cms_json(['ok' => false, 'error' => 'Pedido inválido.'], 400);
    }

    $action = (string) ($input['action'] ?? '');

    try {
        if ($action === 'update') {
            $id = (string) ($input['id'] ?? '');
            $fields = [];
            if (array_key_exists('show', $input)) {
                $fields['show'] = $input['show'];
            }
            if (array_key_exists('cover', $input)) {
                $fields['cover'] = $input['cover'];
            }
            if (array_key_exists('description', $input)) {
                $fields['description'] = $input['description'];
            }
            if (array_key_exists('specs', $input) && is_array($input['specs'])) {
                $fields['specs'] = $input['specs'];
            }
            if ($fields === []) {
                cms_json(['ok' => false, 'error' => 'Nada para actualizar.'], 400);
            }
            $result = cms_fabrics_update_override($id, $fields);
            $merged = cms_fabrics_list_merged();
            $item = null;
            foreach ($merged['collections'] as $col) {
                if ($col['id'] === $result['id']) {
                    $item = $col;
                    break;
                }
            }
            cms_json([
                'ok' => true,
                'collection' => $item,
                'synced' => $result['synced'],
                'message' => $result['syncMessage'],
            ]);
        }

        if ($action === 'sync') {
            $sync = cms_fabrics_try_sync();
            $merged = cms_fabrics_list_merged();
            cms_json([
                'ok' => $sync['ok'],
                'message' => $sync['message'],
                'output' => $sync['output'] ?? null,
                'collections' => $merged['collections'],
                'meta' => $merged['meta'],
            ], $sync['ok'] ? 200 : 500);
        }

        cms_json(['ok' => false, 'error' => 'Acção inválida.'], 400);
    } catch (InvalidArgumentException $e) {
        cms_json(['ok' => false, 'error' => $e->getMessage()], 400);
    } catch (RuntimeException $e) {
        cms_json(['ok' => false, 'error' => $e->getMessage()], 500);
    }
}

cms_json(['ok' => false, 'error' => 'Método não permitido.'], 405);
