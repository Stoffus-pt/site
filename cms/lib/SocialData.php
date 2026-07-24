<?php
declare(strict_types=1);

/**
 * Planeamento de publicações Facebook / Instagram (ficheiros locais + Meta API opcional).
 */

function cms_social_data_file(): string
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

function cms_social_load(): array
{
    $file = cms_social_data_file();
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

function cms_social_save(array $data): void
{
    $dir = dirname(cms_social_data_file());
    if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
        throw new RuntimeException('Não foi possível criar a pasta de dados.');
    }
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    if ($json === false) {
        throw new RuntimeException('Erro ao serializar publicações.');
    }
    if (file_put_contents(cms_social_data_file(), $json . "\n", LOCK_EX) === false) {
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

function cms_social_meta_config(): array
{
    global $CMS_CONFIG;
    $meta = is_array($CMS_CONFIG['meta'] ?? null) ? $CMS_CONFIG['meta'] : [];
    return [
        'page_id' => trim((string) ($meta['page_id'] ?? '')),
        'page_access_token' => trim((string) ($meta['page_access_token'] ?? '')),
        'instagram_business_id' => trim((string) ($meta['instagram_business_id'] ?? '')),
        'configured' => false,
    ];
}

function cms_social_meta_ready(): array
{
    $meta = cms_social_meta_config();
    $meta['configured'] = $meta['page_id'] !== '' && $meta['page_access_token'] !== '';
    $meta['instagram_ready'] = $meta['configured'] && $meta['instagram_business_id'] !== '';
    // Nunca expor o token completo ao frontend
    $meta['token_preview'] = $meta['page_access_token'] !== ''
        ? (substr($meta['page_access_token'], 0, 6) . '…' . substr($meta['page_access_token'], -4))
        : '';
    unset($meta['page_access_token']);
    return $meta;
}

function cms_social_public_url(string $relativePath): string
{
    $relativePath = ltrim(str_replace('\\', '/', $relativePath), '/');
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = (string) ($_SERVER['HTTP_HOST'] ?? 'localhost');
    $script = str_replace('\\', '/', (string) ($_SERVER['SCRIPT_NAME'] ?? ''));
    // /site/cms/api/social.php → /site/cms/api/
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

/**
 * Publica um post na Page do Facebook (álbum/feed).
 */
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

/**
 * Publica no Instagram (1 foto ou carrossel até 10).
 */
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

    // Aguardar processamento breve
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

function cms_social_publish_post(array &$post): void
{
    global $CMS_CONFIG;
    $metaFull = is_array($CMS_CONFIG['meta'] ?? null) ? $CMS_CONFIG['meta'] : [];
    $meta = [
        'page_id' => trim((string) ($metaFull['page_id'] ?? '')),
        'page_access_token' => trim((string) ($metaFull['page_access_token'] ?? '')),
        'instagram_business_id' => trim((string) ($metaFull['instagram_business_id'] ?? '')),
    ];
    if ($meta['page_id'] === '' || $meta['page_access_token'] === '') {
        throw new RuntimeException('Meta não configurada em config.php (page_id + page_access_token).');
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
            throw new RuntimeException('Falta instagram_business_id em config.php.');
        }
        $ids['instagram'] = cms_social_publish_instagram($post, $meta);
    }

    $post['metaPostIds'] = $ids;
    $post['status'] = 'published';
    $post['publishedAt'] = date('c');
    $post['error'] = null;
}
