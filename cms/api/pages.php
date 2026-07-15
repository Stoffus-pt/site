<?php
declare(strict_types=1);

require __DIR__ . '/../bootstrap.php';
cms_require_auth();

$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method === 'GET') {
        $action = $_GET['action'] ?? 'list';

        if ($action === 'list') {
            cms_json(['ok' => true, 'pages' => cms_list_pages()]);
        }

        if ($action === 'get') {
            $file = (string) ($_GET['file'] ?? '');
            $path = cms_page_path($file);
            $data = HtmlRegions::loadPage($path);
            cms_json([
                'ok' => true,
                'file' => cms_safe_page_name($file),
                'data' => $data,
                'previewUrl' => '../' . cms_safe_page_name($file) . '?cms=1',
            ]);
        }

        cms_json(['ok' => false, 'error' => 'Acção inválida.'], 400);
    }

    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input') ?: '{}', true);
        $action = (string) ($input['action'] ?? 'save');

        if ($action === 'save') {
            $file = (string) ($input['file'] ?? '');
            $path = cms_page_path($file);
            HtmlRegions::savePage($path, [
                'title' => (string) ($input['title'] ?? ''),
                'description' => (string) ($input['description'] ?? ''),
                'regions' => $input['regions'] ?? [],
            ]);
            cms_json(['ok' => true, 'message' => 'Página guardada.']);
        }

        if ($action === 'create') {
            $slug = strtolower(trim((string) ($input['slug'] ?? '')));
            $slug = preg_replace('/[^a-z0-9\-]+/', '-', $slug) ?? '';
            $slug = trim($slug, '-');
            if ($slug === '' || $slug === 'index') {
                throw new InvalidArgumentException('Slug inválido.');
            }
            $file = $slug . '.html';
            $path = cms_page_path($file);
            if (is_file($path)) {
                throw new RuntimeException('Já existe uma página com esse nome.');
            }
            $template = SITE_ROOT . '/_template.html';
            if (!is_file($template)) {
                throw new RuntimeException('Modelo _template.html em falta.');
            }
            $title = trim((string) ($input['title'] ?? 'Nova página'));
            $html = file_get_contents($template);
            if ($html === false) {
                throw new RuntimeException('Não foi possível ler o modelo.');
            }
            $html = str_replace('__PAGE_TITLE__', htmlspecialchars($title, ENT_QUOTES, 'UTF-8'), $html);
            $html = str_replace('__PAGE_DESCRIPTION__', htmlspecialchars($title, ENT_QUOTES, 'UTF-8'), $html);
            if (file_put_contents($path, $html) === false) {
                throw new RuntimeException('Não foi possível criar a página.');
            }
            cms_json(['ok' => true, 'file' => $file]);
        }

        if ($action === 'delete') {
            $file = (string) ($input['file'] ?? '');
            if ($file === 'index.html') {
                throw new RuntimeException('Não pode apagar a homepage.');
            }
            $path = cms_page_path($file);
            if (!unlink($path)) {
                throw new RuntimeException('Não foi possível apagar a página.');
            }
            cms_json(['ok' => true, 'message' => 'Página apagada.']);
        }

        cms_json(['ok' => false, 'error' => 'Acção inválida.'], 400);
    }

    cms_json(['ok' => false, 'error' => 'Método inválido.'], 405);
} catch (Throwable $e) {
    cms_json(['ok' => false, 'error' => $e->getMessage()], 400);
}
