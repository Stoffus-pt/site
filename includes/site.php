<?php
declare(strict_types=1);

/**
 * Fragmentos PHP reutilizáveis (para páginas .php futuras ou includes server-side).
 */

function site_nav_items(): array
{
    $navFile = dirname(__DIR__) . '/cms/data/nav.json';
    if (is_file($navFile)) {
        $nav = json_decode(file_get_contents($navFile) ?: '[]', true);
        if (is_array($nav) && $nav) {
            return $nav;
        }
    }
    return [
        ['label' => 'Empresa', 'href' => 'empresa.html'],
        ['label' => 'Coleções', 'href' => 'catalogo.html'],
        ['label' => 'Novidades', 'href' => 'novidades.html'],
        ['label' => 'Tecidos', 'href' => 'tecidos.html'],
        ['label' => 'Onde ver', 'href' => 'onde-comprar.html'],
        ['label' => 'Contactos', 'href' => 'contactos.html'],
        ['label' => 'Área cliente', 'href' => 'area-cliente.html'],
    ];
}

function site_configurator_href(string $modelId = ''): string
{
    $base = '/Studio3D/app.html';
    if ($modelId === '') {
        return $base;
    }
    $state = $modelId . '||black_matte|0|L||0';
    return $base . '?cfg=' . rawurlencode(base64_encode($state));
}
