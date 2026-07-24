<?php
declare(strict_types=1);

/**
 * Planeamento de publicações Facebook / Instagram (multi-marca).
 * Marcas: stoffus | divinus
 */

function cms_social_brands(): array
{
    return [
        'stoffus' => [
            'id' => 'stoffus',
            'label' => 'Stoffus',
            'short' => 'Stoffus',
            'handle' => 'stoffus',
        ],
        'divinus' => [
            'id' => 'divinus',
            'label' => 'Divinus Confort',
            'short' => 'Divinus',
            'handle' => 'divinusconfort',
        ],
    ];
}

function cms_social_normalize_brand(?string $brand): string
{
    $brand = strtolower(trim((string) $brand));
    $brands = cms_social_brands();
    if ($brand !== '' && isset($brands[$brand])) {
        return $brand;
    }
    return 'stoffus';
}

function cms_social_data_file(?string $brand = null): string
{
    $brand = cms_social_normalize_brand($brand);
    return CMS_DIR . '/data/social-posts-' . $brand . '.json';
}

function cms_social_legacy_data_file(): string
{
    return CMS_DIR . '/data/social-posts.json';
}

function cms_social_media_dir(): string
{
    return CMS_DIR . '/data/social-media';
}

function cms_social_default_data(): array
{
    return [
        'posts' => [],
        'settings' => [
            'autoSplitSize' => 10,
            'defaultPlatforms' => ['facebook', 'instagram'],
            'defaultCaption' => '',
        ],
    ];
}

function cms_social_load(?string $brand = null): array
{
    $brand = cms_social_normalize_brand($brand);
    $file = cms_social_data_file($brand);

    // Migração: ficheiro antigo → Stoffus
    if ($brand === 'stoffus' && !is_file($file) && is_file(cms_social_legacy_data_file())) {
        $file = cms_social_legacy_data_file();
    }

    if (!is_file($file)) {
        return cms_social_default_data();
    }
    $raw = file_get_contents($file);
    $data = json_decode($raw !== false ? $raw : '', true);
    if (!is_array($data)) {
        return cms_social_default_data();
    }
    $base = cms_social_default_data();
    $data['posts'] = isset($data['posts']) && is_array($data['posts']) ? array_values($data['posts']) : [];
    $data['settings'] = array_merge($base['settings'], is_array($data['settings'] ?? null) ? $data['settings'] : []);
    return $data;
}

function cms_social_save(array $data, ?string $brand = null): void
{
    $brand = cms_social_normalize_brand($brand);
    $path = cms_social_data_file($brand);
    $dir = dirname($path);
    if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
        throw new RuntimeException('Não foi possível criar a pasta de dados.');
    }
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    if ($json === false) {
        throw new RuntimeException('Erro ao serializar publicações.');
    }
    if (file_put_contents($path, $json . "\n", LOCK_EX) === false) {
        throw new RuntimeException('Não foi possível guardar as publicações.');
    }
}

function cms_social_new_id(): string
{
    try {
        return bin2hex(random_bytes(8));
    } catch (Throwable $e) {
        return uniqid('p', true);
    }
}

/**
 * Credenciais Meta por marca.
 * Preferência: meta_accounts[brand]; fallback legado: meta → stoffus.
 */
function cms_social_meta_config_for(string $brand): array
{
    global $CMS_CONFIG;
    $brand = cms_social_normalize_brand($brand);
    $accounts = is_array($CMS_CONFIG['meta_accounts'] ?? null) ? $CMS_CONFIG['meta_accounts'] : [];
    $meta = is_array($accounts[$brand] ?? null) ? $accounts[$brand] : [];

    if ($brand === 'stoffus' && !$meta) {
        $legacy = is_array($CMS_CONFIG['meta'] ?? null) ? $CMS_CONFIG['meta'] : [];
        $meta = $legacy;
    }

    return [
        'page_id' => trim((string) ($meta['page_id'] ?? '')),
        'page_access_token' => trim((string) ($meta['page_access_token'] ?? '')),
        'instagram_business_id' => trim((string) ($meta['instagram_business_id'] ?? '')),
    ];
}

function cms_social_meta_ready(?string $brand = null): array
{
    $brand = cms_social_normalize_brand($brand);
    $meta = cms_social_meta_config_for($brand);
    $out = [
        'brand' => $brand,
        'configured' => $meta['page_id'] !== '' && $meta['page_access_token'] !== '',
        'instagram_ready' => false,
        'page_id' => $meta['page_id'],
        'instagram_business_id' => $meta['instagram_business_id'],
        'token_preview' => '',
    ];
    $out['instagram_ready'] = $out['configured'] && $meta['instagram_business_id'] !== '';
    if ($meta['page_access_token'] !== '') {
        $out['token_preview'] = substr($meta['page_access_token'], 0, 6) . '…' . substr($meta['page_access_token'], -4);
    }
    return $out;
}

function cms_social_accounts_status(): array
{
    $list = [];
    foreach (cms_social_brands() as $id => $info) {
        $ready = cms_social_meta_ready($id);
        $list[] = [
            'id' => $id,
            'label' => $info['label'],
            'short' => $info['short'],
            'handle' => $info['handle'],
            'configured' => $ready['configured'],
            'instagram_ready' => $ready['instagram_ready'],
        ];
    }
    return $list;
}

function cms_social_public_url(string $relativePath): string
{
    $relativePath = ltrim(str_replace('\\', '/', $relativePath), '/');
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = (string) ($_SERVER['HTTP_HOST'] ?? 'localhost');
    $script = str_replace('\\', '/', (string) ($_SERVER['SCRIPT_NAME'] ?? ''));
    $apiBase = preg_replace('#/[^/]+$#', '/', $script) ?: '/cms/api/';
    return $scheme . '://' . $host . $apiBase . 'social-file.php?f=' . rawurlencode($relativePath);
}

function cms_social_http_json(string $url, array $params = [], string $method = 'GET'): array
{
    $ch = curl_init();
    if ($ch === false) {
        throw new RuntimeException('cURL indisponível neste servidor.');
    }
    if ($method === 'GET' && $params) {
        $url .= (strpos($url, '?') === false ? '?' : '&') . http_build_query($params);
    }
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 60,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    if ($method === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $params);
    }
    $body = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    if ($body === false) {
        throw new RuntimeException('Pedido à Meta falhou: ' . $err);
    }
    $data = json_decode($body, true);
    if (!is_array($data)) {
        throw new RuntimeException('Resposta inválida da Meta (HTTP ' . $code . ').');
    }
    if (isset($data['error'])) {
        $msg = is_array($data['error'])
            ? (string) ($data['error']['message'] ?? 'Erro Meta')
            : (string) $data['error'];
        throw new RuntimeException($msg);
    }
    return $data;
}

function cms_social_publish_facebook(array $post, array $meta): string
{
    $token = $meta['page_access_token'];
    $pageId = $meta['page_id'];
    $caption = (string) ($post['caption'] ?? '');
    $media = $post['media'] ?? [];
    if (!is_array($media) || !$media) {
        throw new RuntimeException('Publicação sem imagens.');
    }

    $attached = [];
    foreach ($media as $rel) {
        $url = cms_social_public_url((string) $rel);
        $photo = cms_social_http_json(
            'https://graph.facebook.com/v21.0/' . rawurlencode($pageId) . '/photos',
            [
                'url' => $url,
                'published' => 'false',
                'access_token' => $token,
            ],
            'POST'
        );
        if (empty($photo['id'])) {
            throw new RuntimeException('Não foi possível carregar a foto no Facebook.');
        }
        $attached[] = ['media_fbid' => $photo['id']];
    }

    $params = [
        'message' => $caption,
        'access_token' => $token,
    ];
    foreach ($attached as $i => $item) {
        $params['attached_media[' . $i . ']'] = json_encode($item);
    }

    $feed = cms_social_http_json(
        'https://graph.facebook.com/v21.0/' . rawurlencode($pageId) . '/feed',
        $params,
        'POST'
    );
    if (empty($feed['id'])) {
        throw new RuntimeException('Facebook não devolveu ID da publicação.');
    }
    return (string) $feed['id'];
}

function cms_social_publish_instagram(array $post, array $meta): string
{
    $igId = $meta['instagram_business_id'];
    $token = $meta['page_access_token'];
    $caption = (string) ($post['caption'] ?? '');
    $media = $post['media'] ?? [];
    if (!is_array($media) || !$media) {
        throw new RuntimeException('Publicação sem imagens.');
    }
    if (count($media) > 10) {
        throw new RuntimeException('Instagram (API) aceita no máximo 10 imagens por carrossel.');
    }

    if (count($media) === 1) {
        $container = cms_social_http_json(
            'https://graph.facebook.com/v21.0/' . rawurlencode($igId) . '/media',
            [
                'image_url' => cms_social_public_url((string) $media[0]),
                'caption' => $caption,
                'access_token' => $token,
            ],
            'POST'
        );
        $creationId = (string) ($container['id'] ?? '');
    } else {
        $children = [];
        foreach ($media as $rel) {
            $child = cms_social_http_json(
                'https://graph.facebook.com/v21.0/' . rawurlencode($igId) . '/media',
                [
                    'image_url' => cms_social_public_url((string) $rel),
                    'is_carousel_item' => 'true',
                    'access_token' => $token,
                ],
                'POST'
            );
            if (empty($child['id'])) {
                throw new RuntimeException('Falha ao criar item do carrossel Instagram.');
            }
            $children[] = $child['id'];
        }
        $container = cms_social_http_json(
            'https://graph.facebook.com/v21.0/' . rawurlencode($igId) . '/media',
            [
                'media_type' => 'CAROUSEL',
                'children' => implode(',', $children),
                'caption' => $caption,
                'access_token' => $token,
            ],
            'POST'
        );
        $creationId = (string) ($container['id'] ?? '');
    }

    if ($creationId === '') {
        throw new RuntimeException('Instagram não devolveu contentor de media.');
    }

    usleep(1500000);

    $pub = cms_social_http_json(
        'https://graph.facebook.com/v21.0/' . rawurlencode($igId) . '/media_publish',
        [
            'creation_id' => $creationId,
            'access_token' => $token,
        ],
        'POST'
    );
    if (empty($pub['id'])) {
        throw new RuntimeException('Instagram não publicou o media.');
    }
    return (string) $pub['id'];
}

function cms_social_publish_post(array &$post, ?string $brand = null): void
{
    $brand = cms_social_normalize_brand($brand ?: ($post['brand'] ?? 'stoffus'));
    $meta = cms_social_meta_config_for($brand);
    if ($meta['page_id'] === '' || $meta['page_access_token'] === '') {
        $label = cms_social_brands()[$brand]['label'] ?? $brand;
        throw new RuntimeException('Meta não configurada para ' . $label . ' (meta_accounts em config.php).');
    }

    $platforms = $post['platforms'] ?? ['facebook'];
    if (!is_array($platforms)) {
        $platforms = ['facebook'];
    }
    $ids = is_array($post['metaPostIds'] ?? null) ? $post['metaPostIds'] : [];

    if (in_array('facebook', $platforms, true) && empty($ids['facebook'])) {
        $ids['facebook'] = cms_social_publish_facebook($post, $meta);
    }
    if (in_array('instagram', $platforms, true) && empty($ids['instagram'])) {
        if ($meta['instagram_business_id'] === '') {
            throw new RuntimeException('Falta instagram_business_id para ' . $brand . '.');
        }
        $ids['instagram'] = cms_social_publish_instagram($post, $meta);
    }

    $post['brand'] = $brand;
    $post['metaPostIds'] = $ids;
    $post['status'] = 'published';
    $post['publishedAt'] = date('c');
    $post['error'] = null;
}
