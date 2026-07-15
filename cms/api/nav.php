<?php
declare(strict_types=1);

require __DIR__ . '/../bootstrap.php';
cms_require_auth();

$navFile = CMS_DIR . '/data/nav.json';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (!is_file($navFile)) {
        cms_json(['ok' => true, 'nav' => cms_default_nav()]);
    }
    $raw = file_get_contents($navFile);
    $nav = json_decode($raw ?: '[]', true);
    cms_json(['ok' => true, 'nav' => is_array($nav) ? $nav : cms_default_nav()]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input') ?: '{}', true);
    $nav = $input['nav'] ?? null;
    if (!is_array($nav)) {
        cms_json(['ok' => false, 'error' => 'Dados invÃ¡lidos.'], 400);
    }

    $clean = [];
    foreach ($nav as $item) {
        if (!is_array($item)) {
            continue;
        }
        $label = trim((string) ($item['label'] ?? ''));
        $href = trim((string) ($item['href'] ?? ''));
        if ($label === '' || $href === '') {
            continue;
        }
        $clean[] = ['label' => $label, 'href' => $href];
    }

    if (!is_dir(CMS_DIR . '/data')) {
        mkdir(CMS_DIR . '/data', 0755, true);
    }

    $json = json_encode($clean, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false || file_put_contents($navFile, $json) === false) {
        cms_json(['ok' => false, 'error' => 'NÃ£o foi possÃ­vel guardar o menu.'], 500);
    }

    cms_sync_nav_to_pages($clean);
    cms_json(['ok' => true, 'message' => 'Menu guardado em todas as pÃ¡ginas.']);
}

cms_json(['ok' => false, 'error' => 'MÃ©todo invÃ¡lido.'], 405);

function cms_default_nav(): array
{
    return [
        ['label' => 'Empresa', 'href' => 'empresa.html'],
        ['label' => 'ColeÃ§Ãµes', 'href' => 'catalogo.html'],
        ['label' => 'Novidades', 'href' => 'novidades.html'],
        ['label' => 'Tecidos', 'href' => 'tecidos.html'],
        ['label' => 'Onde ver', 'href' => 'onde-comprar.html'],
        ['label' => 'Contactos', 'href' => 'contactos.html'],
        ['label' => 'Ãrea cliente', 'href' => 'area-cliente.html'],
    ];
}

function cms_sync_nav_to_pages(array $nav): void
{
    $files = glob(SITE_ROOT . '/*.html') ?: [];
    foreach ($files as $file) {
        if (basename($file) === '_template.html') {
            continue;
        }
        $html = file_get_contents($file);
        if ($html === false) {
            continue;
        }

        $desktop = cms_build_nav_html($nav, false);
        $mobile = cms_build_nav_html($nav, true);

        $html = preg_replace(
            '/<nav class="site-nav"[^>]*>.*?<\/nav>/s',
            '<nav class="site-nav" aria-label="Menu principal">' . $desktop . '</nav>',
            $html,
            1
        );

        $mobileBlock = '<nav class="mobile-nav" id="mobile-nav" aria-label="Menu mÃ³vel">' . $mobile
            . '<a class="btn btn--brand btn--lg" data-stoffus-configurator href="#">Abrir configurador</a></nav>';

        $html = preg_replace(
            '/<nav class="mobile-nav" id="mobile-nav"[^>]*>.*?<\/nav>/s',
            $mobileBlock,
            $html,
            1
        );

        file_put_contents($file, $html);
    }
}

function cms_build_nav_html(array $nav, bool $mobile): string
{
    $out = '';
    foreach ($nav as $item) {
        $label = htmlspecialchars($item['label'], ENT_QUOTES, 'UTF-8');
        $href = htmlspecialchars($item['href'], ENT_QUOTES, 'UTF-8');
        $out .= '<a href="' . $href . '">' . $label . '</a>';
    }
    return $out;
}
