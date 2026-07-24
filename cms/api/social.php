<?php
declare(strict_types=1);

require __DIR__ . '/../bootstrap.php';
require_once CMS_DIR . '/lib/SocialData.php';

cms_require_auth();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = '';
$input = [];

if ($method === 'GET') {
    $action = (string) ($_GET['action'] ?? 'list');
    $brand = cms_social_normalize_brand((string) ($_GET['brand'] ?? 'stoffus'));
} else {
    $input = json_decode(file_get_contents('php://input') ?: '{}', true);
    if (!is_array($input)) {
        cms_json(['ok' => false, 'error' => 'JSON inválido.'], 400);
    }
    $action = (string) ($input['action'] ?? '');
    $brand = cms_social_normalize_brand((string) ($input['brand'] ?? 'stoffus'));
}

try {
    if ($method === 'GET' && $action === 'list') {
        $data = cms_social_load($brand);
        cms_json([
            'ok' => true,
            'brand' => $brand,
            'brands' => cms_social_accounts_status(),
            'posts' => $data['posts'],
            'settings' => $data['settings'],
            'meta' => cms_social_meta_ready($brand),
        ]);
    }

    if ($method !== 'POST') {
        cms_json(['ok' => false, 'error' => 'Método inválido.'], 405);
    }

    $data = cms_social_load($brand);

    if ($action === 'save_settings') {
        $settings = is_array($input['settings'] ?? null) ? $input['settings'] : [];
        $split = (int) ($settings['autoSplitSize'] ?? $data['settings']['autoSplitSize']);
        $data['settings']['autoSplitSize'] = max(1, min(10, $split));
        $platforms = $settings['defaultPlatforms'] ?? $data['settings']['defaultPlatforms'];
        if (!is_array($platforms)) {
            $platforms = ['facebook', 'instagram'];
        }
        $data['settings']['defaultPlatforms'] = array_values(array_intersect($platforms, ['facebook', 'instagram']));
        if (!$data['settings']['defaultPlatforms']) {
            $data['settings']['defaultPlatforms'] = ['facebook'];
        }
        $data['settings']['defaultCaption'] = trim((string) ($settings['defaultCaption'] ?? ''));
        cms_social_save($data, $brand);
        cms_json(['ok' => true, 'brand' => $brand, 'settings' => $data['settings']]);
    }

    if ($action === 'create_from_media') {
        $files = $input['files'] ?? [];
        if (!is_array($files) || !$files) {
            cms_json(['ok' => false, 'error' => 'Indique as imagens.'], 422);
        }
        $files = array_values(array_filter(array_map('strval', $files)));
        $split = (int) ($input['splitSize'] ?? $data['settings']['autoSplitSize']);
        $split = max(1, min(10, $split));
        $platforms = $input['platforms'] ?? $data['settings']['defaultPlatforms'];
        if (!is_array($platforms)) {
            $platforms = ['facebook', 'instagram'];
        }
        $platforms = array_values(array_intersect($platforms, ['facebook', 'instagram']));
        $caption = trim((string) ($input['caption'] ?? $data['settings']['defaultCaption']));
        $startAt = trim((string) ($input['startAt'] ?? ''));
        $intervalHours = max(1, min(72, (int) ($input['intervalHours'] ?? 24)));

        $chunks = array_chunk($files, $split);
        $baseTs = $startAt !== '' ? strtotime($startAt) : strtotime('next wednesday 10:00');
        if ($baseTs === false) {
            $baseTs = time() + 3600;
        }

        $created = [];
        foreach ($chunks as $i => $chunk) {
            $ts = $baseTs + ($i * $intervalHours * 3600);
            $post = [
                'id' => cms_social_new_id(),
                'brand' => $brand,
                'caption' => $caption,
                'platforms' => $platforms ?: ['facebook'],
                'media' => $chunk,
                'scheduledAt' => date('c', $ts),
                'status' => 'scheduled',
                'publishedAt' => null,
                'metaPostIds' => [],
                'error' => null,
                'createdAt' => date('c'),
            ];
            $data['posts'][] = $post;
            $created[] = $post;
        }
        cms_social_save($data, $brand);
        cms_json(['ok' => true, 'brand' => $brand, 'created' => $created, 'posts' => $data['posts']]);
    }

    if ($action === 'update') {
        $id = trim((string) ($input['id'] ?? ''));
        $patch = is_array($input['post'] ?? null) ? $input['post'] : [];
        if ($id === '') {
            cms_json(['ok' => false, 'error' => 'ID em falta.'], 422);
        }
        $found = false;
        foreach ($data['posts'] as &$post) {
            if (($post['id'] ?? '') !== $id) {
                continue;
            }
            $found = true;
            if (isset($patch['caption'])) {
                $post['caption'] = trim((string) $patch['caption']);
            }
            if (isset($patch['scheduledAt'])) {
                $ts = strtotime((string) $patch['scheduledAt']);
                if ($ts === false) {
                    cms_json(['ok' => false, 'error' => 'Data inválida.'], 422);
                }
                $post['scheduledAt'] = date('c', $ts);
                if (($post['status'] ?? '') !== 'published') {
                    $post['status'] = 'scheduled';
                }
            }
            if (isset($patch['platforms']) && is_array($patch['platforms'])) {
                $post['platforms'] = array_values(array_intersect($patch['platforms'], ['facebook', 'instagram']));
            }
            if (isset($patch['media']) && is_array($patch['media'])) {
                $post['media'] = array_values(array_map('strval', $patch['media']));
                if (count($post['media']) > 10) {
                    cms_json(['ok' => false, 'error' => 'Máximo 10 imagens por publicação (API Instagram).'], 422);
                }
            }
            if (isset($patch['status'])) {
                $st = (string) $patch['status'];
                if (in_array($st, ['draft', 'scheduled', 'published', 'failed'], true)) {
                    $post['status'] = $st;
                }
            }
            $post['brand'] = $brand;
            break;
        }
        unset($post);
        if (!$found) {
            cms_json(['ok' => false, 'error' => 'Publicação não encontrada.'], 404);
        }
        cms_social_save($data, $brand);
        cms_json(['ok' => true, 'brand' => $brand, 'posts' => $data['posts']]);
    }

    if ($action === 'delete') {
        $id = trim((string) ($input['id'] ?? ''));
        $data['posts'] = array_values(array_filter($data['posts'], static function ($p) use ($id) {
            return ($p['id'] ?? '') !== $id;
        }));
        cms_social_save($data, $brand);
        cms_json(['ok' => true, 'brand' => $brand, 'posts' => $data['posts']]);
    }

    if ($action === 'publish') {
        $id = trim((string) ($input['id'] ?? ''));
        $found = false;
        foreach ($data['posts'] as &$post) {
            if (($post['id'] ?? '') !== $id) {
                continue;
            }
            $found = true;
            try {
                cms_social_publish_post($post, $brand);
            } catch (Throwable $e) {
                $post['status'] = 'failed';
                $post['error'] = $e->getMessage();
                cms_social_save($data, $brand);
                cms_json(['ok' => false, 'error' => $e->getMessage(), 'posts' => $data['posts']], 500);
            }
            break;
        }
        unset($post);
        if (!$found) {
            cms_json(['ok' => false, 'error' => 'Publicação não encontrada.'], 404);
        }
        cms_social_save($data, $brand);
        cms_json(['ok' => true, 'brand' => $brand, 'posts' => $data['posts']]);
    }

    if ($action === 'publish_due') {
        $now = time();
        $results = [];
        foreach ($data['posts'] as &$post) {
            $status = $post['status'] ?? '';
            if ($status !== 'scheduled') {
                continue;
            }
            $ts = strtotime((string) ($post['scheduledAt'] ?? ''));
            if ($ts === false || $ts > $now) {
                continue;
            }
            try {
                cms_social_publish_post($post, $brand);
                $results[] = ['id' => $post['id'], 'ok' => true];
            } catch (Throwable $e) {
                $post['status'] = 'failed';
                $post['error'] = $e->getMessage();
                $results[] = ['id' => $post['id'], 'ok' => false, 'error' => $e->getMessage()];
            }
        }
        unset($post);
        cms_social_save($data, $brand);
        cms_json(['ok' => true, 'brand' => $brand, 'results' => $results, 'posts' => $data['posts']]);
    }

    cms_json(['ok' => false, 'error' => 'Acção inválida.'], 400);
} catch (Throwable $e) {
    cms_json(['ok' => false, 'error' => $e->getMessage()], 500);
}
