<?php
declare(strict_types=1);

require __DIR__ . '/../bootstrap.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    cms_json(['ok' => false, 'error' => 'Método inválido.'], 405);
}

$input = json_decode(file_get_contents('php://input') ?: '{}', true);
if (!is_array($input)) {
    cms_json(['ok' => false, 'error' => 'JSON inválido.'], 400);
}

$type = trim((string) ($input['type'] ?? 'contact'));
$name = trim((string) ($input['name'] ?? ''));
$email = trim((string) ($input['email'] ?? ''));
$phone = trim((string) ($input['phone'] ?? ''));
$place = trim((string) ($input['place'] ?? ''));
$postal = trim((string) ($input['postal'] ?? ''));
$topic = trim((string) ($input['topic'] ?? ''));
$message = trim((string) ($input['message'] ?? ''));
$coords = trim((string) ($input['coords'] ?? ''));
$maps = trim((string) ($input['maps'] ?? ''));

if ($name === '') {
    cms_json(['ok' => false, 'error' => 'Indique o nome.'], 422);
}

if ($type === 'visit') {
    if ($phone === '') {
        cms_json(['ok' => false, 'error' => 'Indique o telefone.'], 422);
    }
    if ($place === '' && $coords === '') {
        cms_json(['ok' => false, 'error' => 'Indique a localização.'], 422);
    }
} else {
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        cms_json(['ok' => false, 'error' => 'Email inválido.'], 422);
    }
    if ($message === '') {
        cms_json(['ok' => false, 'error' => 'Indique a mensagem.'], 422);
    }
}

$entry = [
    'ts' => date('c'),
    'type' => $type,
    'name' => $name,
    'email' => $email,
    'phone' => $phone,
    'place' => $place,
    'postal' => $postal,
    'topic' => $topic,
    'message' => $message,
    'coords' => $coords,
    'maps' => $maps,
    'ip' => (string) ($_SERVER['REMOTE_ADDR'] ?? ''),
    'ua' => substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 240),
];

$dir = CMS_DIR . '/data/leads';
if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
    cms_json(['ok' => false, 'error' => 'Não foi possível guardar o pedido.'], 500);
}

$file = $dir . '/' . date('Y-m-d') . '.jsonl';
$line = json_encode($entry, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n";
if (@file_put_contents($file, $line, FILE_APPEND | LOCK_EX) === false) {
    cms_json(['ok' => false, 'error' => 'Não foi possível guardar o pedido.'], 500);
}

$to = 'geral@stoffus.pt';
if ($type === 'contact' && $topic !== '' && filter_var($topic, FILTER_VALIDATE_EMAIL)) {
    $to = $topic;
}

$subject = $type === 'visit'
    ? 'Pedido de visita — site Stoffus'
    : 'Contacto site Stoffus';

$bodyLines = [
    'Novo pedido via site Stoffus',
    '',
    'Tipo: ' . $type,
    'Nome: ' . $name,
];
if ($email !== '') $bodyLines[] = 'Email: ' . $email;
if ($phone !== '') $bodyLines[] = 'Telefone: ' . $phone;
if ($place !== '') $bodyLines[] = 'Localização: ' . $place;
if ($postal !== '') $bodyLines[] = 'Código postal: ' . $postal;
if ($coords !== '') $bodyLines[] = 'Coordenadas: ' . $coords;
if ($maps !== '') $bodyLines[] = 'Mapa: ' . $maps;
if ($topic !== '' && $type === 'contact') $bodyLines[] = 'Destino: ' . $topic;
if ($message !== '') {
    $bodyLines[] = '';
    $bodyLines[] = 'Mensagem:';
    $bodyLines[] = $message;
}
$bodyLines[] = '';
$bodyLines[] = 'Data: ' . $entry['ts'];

$headers = ['Content-Type: text/plain; charset=UTF-8'];
if ($email !== '') {
    $headers[] = 'Reply-To: ' . $email;
}

@mail($to, '=?UTF-8?B?' . base64_encode($subject) . '?=', implode("\n", $bodyLines), implode("\r\n", $headers));

cms_json(['ok' => true, 'message' => 'Pedido recebido. Entraremos em contacto em breve.']);
