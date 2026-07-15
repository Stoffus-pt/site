<?php
declare(strict_types=1);

/**
 * Lê e grava regiões editáveis (data-cms-region) em páginas HTML.
 */
final class HtmlRegions
{
    public static function loadPage(string $filePath): array
    {
        if (!is_file($filePath)) {
            throw new RuntimeException('Página não encontrada.');
        }

        $html = file_get_contents($filePath);
        if ($html === false) {
            throw new RuntimeException('Não foi possível ler a página.');
        }

        $dom = self::createDom($html);
        $xpath = new DOMXPath($dom);

        $title = '';
        $titleNodes = $dom->getElementsByTagName('title');
        if ($titleNodes->length > 0) {
            $title = trim($titleNodes->item(0)->textContent ?? '');
        }

        $description = '';
        $metaNodes = $xpath->query("//meta[@name='description']");
        if ($metaNodes && $metaNodes->length > 0) {
            $meta = $metaNodes->item(0);
            if ($meta instanceof DOMElement) {
                $description = trim($meta->getAttribute('content'));
            }
        }

        $regions = [];
        $regionNodes = $xpath->query('//*[@data-cms-region]');
        if ($regionNodes) {
            foreach ($regionNodes as $node) {
                if (!$node instanceof DOMElement) {
                    continue;
                }
                $id = trim($node->getAttribute('data-cms-region'));
                if ($id === '') {
                    continue;
                }
                $regions[] = [
                    'id' => $id,
                    'label' => trim($node->getAttribute('data-cms-label')) ?: $id,
                    'html' => self::innerHtml($dom, $node),
                ];
            }
        }

        return [
            'title' => $title,
            'description' => $description,
            'regions' => $regions,
        ];
    }

    public static function savePage(string $filePath, array $payload): void
    {
        if (!is_file($filePath)) {
            throw new RuntimeException('Página não encontrada.');
        }

        $html = file_get_contents($filePath);
        if ($html === false) {
            throw new RuntimeException('Não foi possível ler a página.');
        }

        $backup = $filePath . '.bak-' . date('Ymd-His');
        if (!copy($filePath, $backup)) {
            throw new RuntimeException('Não foi possível criar cópia de segurança.');
        }

        $dom = self::createDom($html);
        $xpath = new DOMXPath($dom);

        if (!empty($payload['title'])) {
            $titleNodes = $dom->getElementsByTagName('title');
            if ($titleNodes->length > 0) {
                $titleNodes->item(0)->textContent = (string) $payload['title'];
            }
        }

        if (array_key_exists('description', $payload)) {
            $metaNodes = $xpath->query("//meta[@name='description']");
            if ($metaNodes && $metaNodes->length > 0) {
                $meta = $metaNodes->item(0);
                if ($meta instanceof DOMElement) {
                    $meta->setAttribute('content', (string) $payload['description']);
                }
            }
        }

        $regions = $payload['regions'] ?? [];
        if (is_array($regions)) {
            foreach ($regions as $region) {
                if (!is_array($region)) {
                    continue;
                }
                $id = trim((string) ($region['id'] ?? ''));
                if ($id === '') {
                    continue;
                }
                $regionNodes = $xpath->query("//*[@data-cms-region='" . self::xpathEscape($id) . "']");
                if (!$regionNodes || $regionNodes->length === 0) {
                    continue;
                }
                $node = $regionNodes->item(0);
                if ($node instanceof DOMElement) {
                    self::setInnerHtml($dom, $node, (string) ($region['html'] ?? ''));
                }
            }
        }

        $output = self::saveDom($dom);
        if (file_put_contents($filePath, $output) === false) {
            throw new RuntimeException('Não foi possível guardar a página.');
        }
    }

    private static function createDom(string $html): DOMDocument
    {
        $dom = new DOMDocument('1.0', 'UTF-8');
        $dom->preserveWhiteSpace = false;
        $dom->formatOutput = false;
        libxml_use_internal_errors(true);
        $dom->loadHTML('<?xml encoding="UTF-8">' . $html, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
        libxml_clear_errors();
        return $dom;
    }

    private static function saveDom(DOMDocument $dom): string
    {
        $html = $dom->saveHTML();
        if ($html === false) {
            throw new RuntimeException('Erro ao serializar HTML.');
        }
        $html = preg_replace('/^<\?xml encoding="UTF-8"\?>\s*/', '', $html) ?? $html;
        return $html;
    }

    private static function innerHtml(DOMDocument $dom, DOMElement $element): string
    {
        $html = '';
        foreach ($element->childNodes as $child) {
            $html .= $dom->saveHTML($child);
        }
        return trim($html);
    }

    private static function setInnerHtml(DOMDocument $dom, DOMElement $element, string $html): void
    {
        while ($element->firstChild) {
            $element->removeChild($element->firstChild);
        }

        if ($html === '') {
            return;
        }

        $tmp = new DOMDocument('1.0', 'UTF-8');
        libxml_use_internal_errors(true);
        $tmp->loadHTML(
            '<?xml encoding="UTF-8"><div id="cms-wrap">' . $html . '</div>',
            LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD
        );
        libxml_clear_errors();
        $wrap = $tmp->getElementById('cms-wrap');
        if (!$wrap) {
            $element->appendChild($dom->createTextNode(strip_tags($html)));
            return;
        }
        foreach (iterator_to_array($wrap->childNodes) as $child) {
            $element->appendChild($dom->importNode($child, true));
        }
    }

    private static function xpathEscape(string $value): string
    {
        if (strpos($value, "'") === false) {
            return $value;
        }
        if (strpos($value, '"') === false) {
            return '"' . $value . '"';
        }
        return "concat('" . str_replace("'", "',\"'\",'", $value) . "')";
    }
}
