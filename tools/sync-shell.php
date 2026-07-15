<?php
/**
 * Sincroniza cabeÃ§alho, menu, meta SEO, Ã­cones e scripts em todas as pÃ¡ginas HTML.
 * Executar: php tools/sync-shell.php
 */
declare(strict_types=1);

$siteRoot = dirname(__DIR__);
$navFile = $siteRoot . '/cms/data/nav.json';

$nav = json_decode(@file_get_contents($navFile) ?: '[]', true);
if (!is_array($nav) || !$nav) {
    $nav = [
        ['label' => 'Empresa', 'href' => 'empresa.html'],
        ['label' => 'ColeÃ§Ãµes', 'href' => 'catalogo.html'],
        ['label' => 'Novidades', 'href' => 'novidades.html'],
        ['label' => 'Tecidos', 'href' => 'tecidos.html'],
        ['label' => 'Onde ver', 'href' => 'onde-comprar.html'],
        ['label' => 'Contactos', 'href' => 'contactos.html'],
        ['label' => 'Ãrea cliente', 'href' => 'area-cliente.html'],
    ];
}

function build_nav_links(array $nav): string
{
    $out = '';
    foreach ($nav as $item) {
        $label = htmlspecialchars((string) ($item['label'] ?? ''), ENT_QUOTES, 'UTF-8');
        $href = htmlspecialchars((string) ($item['href'] ?? ''), ENT_QUOTES, 'UTF-8');
        if ($label === '' || $href === '') {
            continue;
        }
        $out .= "\n        <a href=\"{$href}\">{$label}</a>";
    }
    return $out . "\n      ";
}

function build_mobile_nav(array $nav): string
{
    $out = '';
    foreach ($nav as $item) {
        $label = htmlspecialchars((string) ($item['label'] ?? ''), ENT_QUOTES, 'UTF-8');
        $href = htmlspecialchars((string) ($item['href'] ?? ''), ENT_QUOTES, 'UTF-8');
        if ($label === '' || $href === '') {
            continue;
        }
        $out .= "\n    <a href=\"{$href}\">{$label}</a>";
    }
    return $out . "\n    ";
}

function menu_toggle_svg(): string
{
    return '<svg class="icon icon--menu" aria-hidden="true" viewBox="0 0 448 512" xmlns="http://www.w3.org/2000/svg"><path d="M0 96C0 78.3 14.3 64 32 64H416c17.7 0 32 14.3 32 32s-14.3 32-32 32H32C14.3 128 0 113.7 0 96zM0 256c0-17.7 14.3-32 32-32H416c17.7 0 32 14.3 32 32s-14.3 32-32 32H32c-17.7 0-32-14.3-32-32zM448 416c0 17.7-14.3 32-32 32H32c-17.7 0-32-14.3-32-32s14.3-32 32-32H416c17.7 0 32 14.3 32 32z"/></svg>';
}

function arrow_svg(): string
{
    return '<svg class="icon" aria-hidden="true" viewBox="0 0 448 512" xmlns="http://www.w3.org/2000/svg"><path d="M438.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-160-160c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L338.8 224 32 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l306.7 0L233.4 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l160-160z"/></svg>';
}

function json_ld(): string
{
    $json = [
        '@context' => 'https://schema.org',
        '@type' => 'FurnitureStore',
        'name' => 'Stoffus',
        'description' => 'IndÃºstria portuguesa de sofÃ¡s - Eleganza Collection',
        'url' => 'https://stoffus.pt',
        'telephone' => '+351-239-700-799',
        'email' => 'geral@stoffus.pt',
        'address' => [
            '@type' => 'PostalAddress',
            'streetAddress' => 'Parque de NegÃ³cios 7/8',
            'addressLocality' => 'Montemor-o-Velho',
            'postalCode' => '3140-258',
            'addressCountry' => 'PT',
        ],
    ];
    return '<script type="application/ld+json">' . json_encode($json, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . '</script>';
}

function patch_html(string $html, array $nav): string
{
    $desktop = build_nav_links($nav);
    $mobile = build_mobile_nav($nav);
    $toggle = menu_toggle_svg();

    $html = preg_replace(
        '/<nav class="site-nav"[^>]*>.*?<\/nav>/s',
        '<nav class="site-nav" aria-label="Menu principal">' . $desktop . '</nav>',
        $html,
        1
    ) ?? $html;

    $mobileBlock = '<nav class="mobile-nav" id="mobile-nav" aria-label="Menu mÃ³vel">' . $mobile
        . '<a class="btn btn--brand btn--lg" data-stoffus-configurator href="#">Abrir configurador</a></nav>';

    $html = preg_replace(
        '/<nav class="mobile-nav" id="mobile-nav"[^>]*>.*?<\/nav>/s',
        $mobileBlock,
        $html,
        1
    ) ?? $html;

    $html = preg_replace(
        '/<link rel="stylesheet" href="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome[^"]+"\s*\/?>/',
        '<link rel="stylesheet" href="css/icons.css" />',
        $html
    ) ?? $html;

    if (strpos($html, 'css/icons.css') === false && strpos($html, 'css/site.css') !== false) {
        $html = str_replace(
            '<link rel="stylesheet" href="css/site.css" />',
            '<link rel="stylesheet" href="css/icons.css" />' . "\n  " . '<link rel="stylesheet" href="css/site.css" />',
            $html
        );
    }

    $html = preg_replace(
        '/href="https:\/\/stoffus\.pt\/Studio3D\/app\.html"/',
        'data-stoffus-configurator href="#"',
        $html
    ) ?? $html;

    $html = preg_replace(
        '/<i class="fa-solid fa-bars" aria-hidden="true"><\/i>/',
        $toggle,
        $html
    ) ?? $html;

    $html = preg_replace(
        '/<i class="fa-solid fa-arrow-right" aria-hidden="true"><\/i>/',
        arrow_svg(),
        $html
    ) ?? $html;

    if (strpos($html, 'js/config.js') === false && strpos($html, 'js/site.js') !== false) {
        $html = str_replace(
            '<script src="js/site.js"></script>',
            '<script src="js/config.js"></script>' . "\n  " . '<script src="js/site.js"></script>',
            $html
        );
    }

    if (!preg_match('/property="og:title"/', $html) && preg_match('/<title>(.*?)<\/title>/s', $html, $m)) {
        $title = trim(html_entity_decode($m[1], ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        $desc = '';
        if (preg_match('/<meta name="description" content="([^"]*)"/', $html, $dm)) {
            $desc = $dm[1];
        }
        $og = "\n  " . '<meta property="og:type" content="website" />'
            . "\n  " . '<meta property="og:site_name" content="Stoffus" />'
            . "\n  " . '<meta property="og:title" content="' . htmlspecialchars($title, ENT_QUOTES, 'UTF-8') . '" />'
            . "\n  " . '<meta property="og:description" content="' . htmlspecialchars($desc, ENT_QUOTES, 'UTF-8') . '" />'
            . "\n  " . '<meta property="og:url" content="https://stoffus.pt/" />'
            . "\n  " . '<meta property="og:image" content="https://stoffus.pt/site/assets/brand/logo-horizontal.png" />'
            . "\n  " . '<meta name="twitter:card" content="summary_large_image" />';
        $html = preg_replace('/<meta name="theme-color"[^>]+>/', '$0' . $og, $html, 1) ?? $html;
    }

    if (strpos($html, 'application/ld+json') === false) {
        $html = str_replace('</body>', '  ' . json_ld() . "\n</body>", $html);
    }

    return $html;
}

$files = glob($siteRoot . '/*.html') ?: [];
$count = 0;
foreach ($files as $file) {
    if (basename($file) === '_template.html') {
        continue;
    }
    $html = file_get_contents($file);
    if ($html === false) {
        continue;
    }
    $next = patch_html($html, $nav);
    if ($next !== $html) {
        file_put_contents($file, $next);
        $count++;
        echo basename($file) . PHP_EOL;
    }
}

file_put_contents($navFile, json_encode($nav, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n");
echo "Actualizados: {$count} ficheiros\n";
