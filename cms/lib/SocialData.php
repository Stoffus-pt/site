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
            'logo' => 'assets/brands/stoffus-logo.png',
            'mark' => 'assets/brands/stoffus-mark.png',
            'color' => '#e04e26',
        ],
        'divinus' => [
            'id' => 'divinus',
            'label' => 'Divinus Confort',
            'short' => 'Divinus',
            'handle' => 'divinusconfort',
            'logo' => 'assets/brands/divinus-logo.png',
            'mark' => 'assets/brands/divinus-mark.png',
            'color' => '#00a8d6',
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
 * Ordem: ficheiro CMS (data/meta-accounts.json) → config.php meta_accounts → legado meta.
 */
function cms_social_meta_accounts_file(): string
{
    return CMS_DIR . '/data/meta-accounts.json';
}

function cms_social_meta_accounts_stored(): array
{
    $file = cms_social_meta_accounts_file();
    if (!is_file($file)) {
        return [];
    }
    $raw = file_get_contents($file);
    $data = json_decode($raw !== false ? $raw : '', true);
    return is_array($data) ? $data : [];
}

function cms_social_meta_accounts_save(array $accounts): void
{
    $dir = dirname(cms_social_meta_accounts_file());
    if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
        throw new RuntimeException('Não foi possível criar a pasta de dados.');
    }
    $clean = [];
    foreach (cms_social_brands() as $id => $_info) {
        $row = is_array($accounts[$id] ?? null) ? $accounts[$id] : [];
        $clean[$id] = [
            'page_id' => trim((string) ($row['page_id'] ?? '')),
            'page_access_token' => trim((string) ($row['page_access_token'] ?? '')),
            'instagram_business_id' => trim((string) ($row['instagram_business_id'] ?? '')),
        ];
    }
    $json = json_encode($clean, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    if ($json === false) {
        throw new RuntimeException('Erro ao serializar credenciais Meta.');
    }
    if (file_put_contents(cms_social_meta_accounts_file(), $json . "\n", LOCK_EX) === false) {
        throw new RuntimeException('Não foi possível guardar as credenciais Meta.');
    }
}

function cms_social_meta_config_for(string $brand): array
{
    global $CMS_CONFIG;
    $brand = cms_social_normalize_brand($brand);

    $stored = cms_social_meta_accounts_stored();
    $fromCms = is_array($stored[$brand] ?? null) ? $stored[$brand] : [];

    $accounts = is_array($CMS_CONFIG['meta_accounts'] ?? null) ? $CMS_CONFIG['meta_accounts'] : [];
    $fromConfig = is_array($accounts[$brand] ?? null) ? $accounts[$brand] : [];

    if ($brand === 'stoffus' && !$fromConfig) {
        $legacy = is_array($CMS_CONFIG['meta'] ?? null) ? $CMS_CONFIG['meta'] : [];
        $fromConfig = $legacy;
    }

    // CMS (painel) tem prioridade se tiver page_id ou token; senão config.php
    $pageId = trim((string) ($fromCms['page_id'] ?? ''));
    $token = trim((string) ($fromCms['page_access_token'] ?? ''));
    $ig = trim((string) ($fromCms['instagram_business_id'] ?? ''));

    if ($pageId === '' && $token === '' && $ig === '') {
        $pageId = trim((string) ($fromConfig['page_id'] ?? ''));
        $token = trim((string) ($fromConfig['page_access_token'] ?? ''));
        $ig = trim((string) ($fromConfig['instagram_business_id'] ?? ''));
    } else {
        // Preencher campos em falta a partir do config
        if ($pageId === '') {
            $pageId = trim((string) ($fromConfig['page_id'] ?? ''));
        }
        if ($token === '') {
            $token = trim((string) ($fromConfig['page_access_token'] ?? ''));
        }
        if ($ig === '') {
            $ig = trim((string) ($fromConfig['instagram_business_id'] ?? ''));
        }
    }

    return [
        'page_id' => $pageId,
        'page_access_token' => $token,
        'instagram_business_id' => $ig,
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
    $out['has_token'] = $meta['page_access_token'] !== '';
    $out['source'] = is_file(cms_social_meta_accounts_file()) ? 'cms' : 'config';
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
            'logo' => (string) ($info['logo'] ?? ''),
            'mark' => (string) ($info['mark'] ?? ''),
            'color' => (string) ($info['color'] ?? ''),
            'configured' => $ready['configured'],
            'instagram_ready' => $ready['instagram_ready'],
        ];
    }
    return $list;
}

/**
 * Últimas publicações da página Facebook (Graph API).
 *
 * @return list<array{id:string,message:string,created_time:string,permalink_url:string}>
 */
function cms_social_meta_page_history(string $brand, int $limit = 25): array
{
    $meta = cms_social_meta_config_for($brand);
    $pageId = $meta['page_id'];
    $token = $meta['page_access_token'];
    if ($pageId === '' || $token === '') {
        throw new RuntimeException('Meta desta marca ainda não está configurada.');
    }
    $limit = max(1, min(50, $limit));
    $data = cms_social_http_json(
        'https://graph.facebook.com/v21.0/' . rawurlencode($pageId) . '/posts',
        [
            'fields' => 'id,message,created_time,permalink_url',
            'limit' => $limit,
            'access_token' => $token,
        ]
    );
    $out = [];
    foreach (($data['data'] ?? []) as $row) {
        if (!is_array($row)) {
            continue;
        }
        $out[] = [
            'id' => (string) ($row['id'] ?? ''),
            'message' => (string) ($row['message'] ?? ''),
            'created_time' => (string) ($row['created_time'] ?? ''),
            'permalink_url' => (string) ($row['permalink_url'] ?? ''),
        ];
    }
    return $out;
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
    $method = strtoupper($method);
    if (($method === 'GET' || $method === 'DELETE') && $params) {
        $url .= (strpos($url, '?') === false ? '?' : '&') . http_build_query($params);
    }
    $opts = [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 60,
        CURLOPT_SSL_VERIFYPEER => true,
    ];
    if ($method === 'POST') {
        $opts[CURLOPT_POST] = true;
        $opts[CURLOPT_POSTFIELDS] = $params;
    } elseif ($method === 'DELETE') {
        $opts[CURLOPT_CUSTOMREQUEST] = 'DELETE';
    }
    curl_setopt_array($ch, $opts);
    $body = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    if ($body === false) {
        throw new RuntimeException('Pedido à Meta falhou: ' . $err);
    }
    $data = json_decode($body, true);
    if (!is_array($data)) {
        if ($body === 'true' || trim((string) $body) === 'true') {
            return ['success' => true];
        }
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

/**
 * Apaga a publicação no Facebook / Instagram (se houver IDs Meta guardados).
 * @return array{facebook:?bool,instagram:?bool,errors:string[]}
 */
function cms_social_delete_from_meta(array $post, ?string $brand = null): array
{
    $brand = cms_social_normalize_brand($brand ?: ($post['brand'] ?? 'stoffus'));
    $meta = cms_social_meta_config_for($brand);
    $result = [
        'facebook' => null,
        'instagram' => null,
        'errors' => [],
    ];

    if ($meta['page_access_token'] === '') {
        $result['errors'][] = 'Meta sem token para ' . $brand . '.';
        return $result;
    }

    $ids = is_array($post['metaPostIds'] ?? null) ? $post['metaPostIds'] : [];
    $token = $meta['page_access_token'];

    if (!empty($ids['facebook'])) {
        try {
            cms_social_http_json(
                'https://graph.facebook.com/v21.0/' . rawurlencode((string) $ids['facebook']),
                ['access_token' => $token],
                'DELETE'
            );
            $result['facebook'] = true;
        } catch (Throwable $e) {
            $result['facebook'] = false;
            $result['errors'][] = 'Facebook: ' . $e->getMessage();
        }
    }

    if (!empty($ids['instagram'])) {
        try {
            cms_social_http_json(
                'https://graph.facebook.com/v21.0/' . rawurlencode((string) $ids['instagram']),
                ['access_token' => $token],
                'DELETE'
            );
            $result['instagram'] = true;
        } catch (Throwable $e) {
            $result['instagram'] = false;
            $result['errors'][] = 'Instagram: ' . $e->getMessage();
        }
    }

    if (empty($ids['facebook']) && empty($ids['instagram'])) {
        $result['errors'][] = 'Sem IDs Meta guardados — só é possível apagar no CMS.';
    }

    return $result;
}

/**
 * Remove um post da lista local, opcionalmente apagando também no Meta.
 * @return array{ok:bool,meta:?array,error:?string}
 */
function cms_social_remove_post(array &$posts, string $id, bool $deleteMeta, string $brand): array
{
    $idx = null;
    $target = null;
    foreach ($posts as $i => $p) {
        if (($p['id'] ?? '') === $id) {
            $idx = $i;
            $target = $p;
            break;
        }
    }
    if ($idx === null || !is_array($target)) {
        return ['ok' => false, 'meta' => null, 'error' => 'Publicação não encontrada.'];
    }

    $metaResult = null;
    if ($deleteMeta) {
        $metaResult = cms_social_delete_from_meta($target, $brand);
    }

    array_splice($posts, $idx, 1);
    return ['ok' => true, 'meta' => $metaResult, 'error' => null];
}
