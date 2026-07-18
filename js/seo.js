(function (global) {
  function publicBaseUrl() {
    var site = global.StoffusSite || {};
    if (site.isGithubPreview) return 'https://stoffus-pt.github.io/site';
    if (site.isLocal) {
      var path = location.pathname.replace(/\\/g, '/');
      var idx = path.indexOf('/site/');
      if (idx >= 0) return location.origin + path.slice(0, idx + 5);
      return location.origin || '';
    }
    return 'https://stoffus.pt';
  }

  function pageFile() {
    var path = location.pathname.replace(/\\/g, '/');
    var file = path.split('/').pop() || 'index.html';
    if (file === '') file = 'index.html';
    return file;
  }

  function absoluteAsset(path) {
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) return path;
    var base = publicBaseUrl().replace(/\/$/, '');
    return base + '/' + String(path).replace(/^\/+/, '');
  }

  function upsertMeta(attr, key, value) {
    if (!value) return;
    var sel = 'meta[' + attr + '="' + key + '"]';
    var el = document.querySelector(sel);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute('content', value);
  }

  function upsertLink(rel, href) {
    if (!href) return;
    var el = document.querySelector('link[rel="' + rel + '"]');
    if (!el) {
      el = document.createElement('link');
      el.setAttribute('rel', rel);
      document.head.appendChild(el);
    }
    el.setAttribute('href', href);
  }

  function applyPageSeo(opts) {
    opts = opts || {};
    var file = pageFile();
    var pageUrl = publicBaseUrl().replace(/\/$/, '') + '/' + file;
    if (opts.url) pageUrl = opts.url;

    upsertLink('canonical', pageUrl);
    upsertMeta('property', 'og:url', pageUrl);

    if (opts.title) {
      document.title = opts.title;
      upsertMeta('property', 'og:title', opts.title);
      upsertMeta('name', 'twitter:title', opts.title);
    }

    if (opts.description) {
      upsertMeta('name', 'description', opts.description);
      upsertMeta('property', 'og:description', opts.description);
      upsertMeta('name', 'twitter:description', opts.description);
    }

    if (opts.image) {
      var imgUrl = absoluteAsset(opts.image);
      upsertMeta('property', 'og:image', imgUrl);
      upsertMeta('name', 'twitter:image', imgUrl);
    }

    if (opts.type) upsertMeta('property', 'og:type', opts.type);
  }

  function applyDefaultOgImage() {
    var current = document.querySelector('meta[property="og:image"]');
    if (current && current.getAttribute('content') && current.getAttribute('content').indexOf('stoffus.pt/') === -1) {
      return;
    }
    applyPageSeo({ image: 'assets/brand/logo-horizontal.png' });
  }

  applyDefaultOgImage();
  function isModelDetailPage() {
    if (pageFile() === 'modelo.html') return true;
    if (global.__STOFFUS_MODEL_ID) return true;
    return /\/modelo\/[^\/]+\/?(?:index\.html)?$/i.test(location.pathname.replace(/\\/g, '/'));
  }
  if (!isModelDetailPage()) {
    applyPageSeo({});
  }

  global.StoffusSeo = {
    publicBaseUrl: publicBaseUrl,
    absoluteAsset: absoluteAsset,
    applyPageSeo: applyPageSeo
  };
})(window);
