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
     * Contas Meta por marca (Redes no CMS).
     * Cada marca tem a sua Página Facebook + Instagram Business.
     * Nunca faça commit do config.php com tokens reais.
     */
    'meta_accounts' => [
        'stoffus' => [
            'page_id' => '',
            'page_access_token' => '',
            'instagram_business_id' => '',
        ],
        'divinus' => [
            'page_id' => '',
            'page_access_token' => '',
            'instagram_business_id' => '',
        ],
    ],

    /**
     * Legado (opcional): se meta_accounts.stoffus estiver vazio, usa-se isto para Stoffus.
     */
    'meta' => [
        'page_id' => '',
        'page_access_token' => '',
        'instagram_business_id' => '',
    ],
];
