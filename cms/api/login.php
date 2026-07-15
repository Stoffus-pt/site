<?php
declare(strict_types=1);

require __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    cms_json(['ok' => false, 'error' => 'Método inválido.'], 405);
}

$input = json_decode(file_get_contents('php://input') ?: '{}', true);
$username = trim((string) ($input['username'] ?? ''));
$password = (string) ($input['password'] ?? '');

$hash = (string) ($CMS_CONFIG['password_hash'] ?? '');
$expectedUser = (string) ($CMS_CONFIG['username'] ?? 'stoffus');

if ($hash === '' || !is_file(CMS_DIR . '/config.php')) {
    cms_json(['ok' => false, 'error' => 'CMS não configurado.', 'needsSetup' => true], 400);
}

if ($username !== $expectedUser || !password_verify($password, $hash)) {
    cms_json(['ok' => false, 'error' => 'Credenciais inválidas.'], 401);
}

$_SESSION['cms_auth'] = true;
$_SESSION['cms_user'] = $username;

cms_json(['ok' => true, 'username' => $username]);
