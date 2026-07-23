<?php
declare(strict_types=1);

/**
 * Copie para config.php e altere a palavra-passe.
 * Gerar hash: php -r "echo password_hash('A_SUA_PASSWORD', PASSWORD_DEFAULT);"
 */
return [
    'username' => 'stoffus',
    // Palavra-passe inicial: stoffus-cms (altere após o primeiro login)
    'password_hash' => '$2y$10$8Yq0vJm5xqH0nGqG0nGqGuK8xqH0nGqG0nGqG0nGqG0nGqG0nGqG0m',

    /**
     * Meta (Facebook Page + Instagram Business) — opcional.
     * Necessário para «Publicar agora» / «Publicar vencidas» no separador Redes.
     * Nunca faça commit do config.php com tokens reais.
     *
     * page_id: ID da Página Facebook
     * page_access_token: token de longa duração da Página (com permissões pages_manage_posts, instagram_content_publish, etc.)
     * instagram_business_id: ID do Instagram Business ligado à Página
     */
    'meta' => [
        'page_id' => '',
        'page_access_token' => '',
        'instagram_business_id' => '',
    ],
];
