(function () {
  var toggle = document.getElementById('menu-toggle');
  var mobileNav = document.getElementById('mobile-nav');
  if (toggle && mobileNav) {
    toggle.addEventListener('click', function () {
      var open = mobileNav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.style.overflow = open ? 'hidden' : '';
    });

    mobileNav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        mobileNav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });
  }

  var path = location.pathname.split('/').pop() || 'index.html';
  if (path === '') path = 'index.html';
  document.querySelectorAll('.site-nav a, .mobile-nav a').forEach(function (link) {
    var href = link.getAttribute('href') || '';
    if (href === path) link.classList.add('is-active');
  });

  document.querySelectorAll('a[href="area-cliente.html"]').forEach(function (link) {
    if (/Área cliente/i.test(link.textContent)) link.textContent = 'Downloads';
  });

  document.querySelectorAll('.footer-bottom').forEach(function (el) {
    if (el.querySelector('.footer-legal')) return;
    var legal = document.createElement('span');
    legal.className = 'footer-legal';
    legal.innerHTML = '<a href="privacidade.html">Privacidade</a>';
    el.appendChild(legal);
  });

  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // Contador de visitas (continua a partir do site anterior)
  (function initVisitCounter() {
    var SEED = 3377596;
    var SESSION_KEY = 'stoffus_site_visit_hit';

    function formatVisits(n) {
      var num = Math.max(0, Math.floor(Number(n) || 0));
      return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    function apiBase() {
      var site = window.StoffusSite || {};
      if (site.isGithubPreview) return '';
      if (site.isLocal) {
        var port = location.port || '';
        if (port === '8080') return '/cms/api';
      }
      return 'cms/api';
    }

    function render(count) {
      document.querySelectorAll('[data-visit-count]').forEach(function (el) {
        el.textContent = formatVisits(count);
      });
    }

    function ensureSlot() {
      document.querySelectorAll('.footer-bottom').forEach(function (el) {
        if (el.querySelector('.footer-visits')) return;
        var span = document.createElement('span');
        span.className = 'footer-visits';
        span.innerHTML = 'Visitas: <strong data-visit-count>' + formatVisits(SEED) + '</strong>';
        el.insertBefore(span, el.firstChild);
      });
    }

    function loadStatic() {
      return fetch('data/visits.json', { credentials: 'omit' })
        .then(function (res) {
          if (!res.ok) throw new Error('visits.json');
          return res.json();
        })
        .then(function (data) {
          var count = Math.max(SEED, Number(data && data.count) || SEED);
          render(count);
        })
        .catch(function () {
          render(SEED);
        });
    }

    ensureSlot();

    var site = window.StoffusSite || {};
    if (site.isGithubPreview) {
      loadStatic();
      return;
    }

    var base = apiBase().replace(/\/$/, '');
    if (!base) {
      loadStatic();
      return;
    }

    var already = false;
    try {
      already = !!sessionStorage.getItem(SESSION_KEY);
    } catch (e) {}

    fetch(base + '/visits.php?action=' + (already ? 'get' : 'hit'), {
      method: 'GET',
      credentials: 'omit',
      headers: { Accept: 'application/json' },
    })
      .then(function (res) {
        if (!res.ok) throw new Error('visits api');
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.ok) throw new Error('visits payload');
        var count = Math.max(SEED, Number(data.count) || SEED);
        if (!already) {
          try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (e2) {}
        }
        render(count);
      })
      .catch(function () {
        loadStatic();
      });
  })();
})();
