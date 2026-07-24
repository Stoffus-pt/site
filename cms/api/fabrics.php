<?php
declare(strict_types=1);

require __DIR__ . '/../bootstrap.php';
require_once CMS_DIR . '/lib/FabricsData.php';
require_once CMS_DIR . '/lib/FabricsDraft2026.php';

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
        if ($action === 'draft_list') {
            $draft = cms_fabrics_draft_2026_list();
            cms_json([
                'ok' => true,
                'meta' => $draft['meta'],
                'collections' => $draft['collections'],
                'catalogDraftAvailable' => $draft['catalogDraftAvailable'],
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

        if ($action === 'update_all') {
            $items = $input['items'] ?? null;
            if (!is_array($items) || $items === []) {
                cms_json(['ok' => false, 'error' => 'Lista de colecções em falta.'], 400);
            }
            $result = cms_fabrics_update_many($items);
            $merged = cms_fabrics_list_merged();
            cms_json([
                'ok' => true,
                'count' => $result['count'],
                'ids' => $result['ids'],
                'synced' => $result['synced'],
                'message' => $result['count'] . ' colecções guardadas. ' . $result['syncMessage'],
                'collections' => $merged['collections'],
                'meta' => $merged['meta'],
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

        if ($action === 'draft_update') {
            $id = (string) ($input['id'] ?? '');
            $fields = [];
            foreach (['show', 'name', 'prefix', 'gama', 'specs', 'traits'] as $key) {
                if (array_key_exists($key, $input)) {
                    $fields[$key] = $input[$key];
                }
            }
            if ($fields === []) {
                cms_json(['ok' => false, 'error' => 'Nada para actualizar.'], 400);
            }
            $result = cms_fabrics_draft_2026_update($id, $fields);
            cms_json([
                'ok' => true,
                'collection' => $result['collection'],
                'message' => 'Rascunho 2026 actualizado (não afecta o site público).',
            ]);
        }

        if ($action === 'draft_update_all') {
            $items = $input['items'] ?? null;
            if (!is_array($items) || $items === []) {
                cms_json(['ok' => false, 'error' => 'Lista de colecções em falta.'], 400);
            }
            $result = cms_fabrics_draft_2026_update_many($items);
            cms_json([
                'ok' => true,
                'count' => $result['count'],
                'ids' => $result['ids'],
                'message' => $result['count'] . ' colecções guardadas no rascunho 2026 (site público inalterado).',
                'collections' => $result['collections'],
                'meta' => $result['meta'],
            ]);
        }

        cms_json(['ok' => false, 'error' => 'Acção inválida.'], 400);
    } catch (InvalidArgumentException $e) {
        cms_json(['ok' => false, 'error' => $e->getMessage()], 400);
    } catch (RuntimeException $e) {
        cms_json(['ok' => false, 'error' => $e->getMessage()], 500);
    }
}

cms_json(['ok' => false, 'error' => 'Método não permitido.'], 405);
