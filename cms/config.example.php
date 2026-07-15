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
];
