<?php
declare(strict_types=1);

require __DIR__ . '/../bootstrap.php';

$configured = is_file(CMS_DIR . '/config.php');

cms_json([
    'ok' => true,
    'configured' => $configured,
    'authenticated' => !empty($_SESSION['cms_auth']),
    'username' => $_SESSION['cms_user'] ?? null,
]);
