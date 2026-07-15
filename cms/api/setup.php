<?php
declare(strict_types=1);

require __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    cms_json(['ok' => false, 'error' => 'Método inválido.'], 405);
}

if (is_file(CMS_DIR . '/config.php')) {
    cms_json(['ok' => false, 'error' => 'CMS já configurado.'], 400);
}

$input = json_decode(file_get_contents('php://input') ?: '{}', true);
if (!is_array($input)) {
    $input = [];
}
if (empty($input['password']) && !empty($_POST['password'])) {
    $input = $_POST;
}

$password = (string) ($input['password'] ?? '');
$username = trim((string) ($input['username'] ?? 'stoffus'));

if ($username === '') {
    cms_json(['ok' => false, 'error' => 'Indique o utilizador.'], 400);
}

if (strlen($password) < 8) {
    cms_json(['ok' => false, 'error' => 'A palavra-passe deve ter pelo menos 8 caracteres.'], 400);
}

if (!is_writable(CMS_DIR)) {
    cms_json(['ok' => false, 'error' => 'A pasta cms/ não tem permissão de escrita.'], 500);
}

$hash = password_hash($password, PASSWORD_DEFAULT);
if ($hash === false) {
    cms_json(['ok' => false, 'error' => 'Não foi possível gerar a palavra-passe.'], 500);
}
$content = "<?php\nreturn [\n    'username' => " . var_export($username, true) . ",\n    'password_hash' => " . var_export($hash, true) . ",\n];\n";

if (file_put_contents(CMS_DIR . '/config.php', $content) === false) {
    cms_json(['ok' => false, 'error' => 'Não foi possível criar config.php.'], 500);
}

$_SESSION['cms_auth'] = true;
$_SESSION['cms_user'] = $username;

cms_json(['ok' => true, 'username' => $username]);
