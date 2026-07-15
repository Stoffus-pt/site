(function () {
  if (!new URLSearchParams(location.search).has('cms')) return;

  var style = document.createElement('style');
  style.textContent =
    '[data-cms-region]{outline:2px dashed rgba(224,78,38,.45);outline-offset:4px;transition:outline .15s}' +
    '[data-cms-region].cms-active{outline:3px solid #e04e26;outline-offset:2px}' +
    '[data-cms-region].cms-editing{outline:3px solid #2f2f2f;cursor:text}' +
    '.cms-region-badge{position:absolute;z-index:9999;padding:.2rem .45rem;font:500 10px/1.2 Magistral,Segoe UI,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#fff;background:#e04e26;border-radius:2px;pointer-events:none}';
  document.head.appendChild(style);

  var regions = Array.prototype.slice.call(document.querySelectorAll('[data-cms-region]'));
  var badges = {};
  var activeId = null;
  var editing = false;

  function post(msg) {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(Object.assign({ source: 'stoffus-cms-preview' }, msg), '*');
    }
  }

  function placeBadge(el) {
    var id = el.getAttribute('data-cms-region');
    if (!id) return;
    var badge = badges[id];
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'cms-region-badge';
      badge.textContent = el.getAttribute('data-cms-label') || id;
      document.body.appendChild(badge);
      badges[id] = badge;
    }
    var rect = el.getBoundingClientRect();
    badge.style.top = window.scrollY + rect.top + 6 + 'px';
    badge.style.left = window.scrollX + rect.left + 6 + 'px';
    badge.style.display = rect.width ? 'block' : 'none';
  }

  function refreshBadges() {
    regions.forEach(placeBadge);
  }

  function setActive(id) {
    activeId = id;
    regions.forEach(function (el) {
      el.classList.toggle('cms-active', el.getAttribute('data-cms-region') === id);
    });
    refreshBadges();
  }

  function getRegionHtml(el) {
    return el.innerHTML.trim();
  }

  regions.forEach(function (el) {
    var id = el.getAttribute('data-cms-region');
    el.addEventListener('click', function (e) {
      if (editing) return;
      e.preventDefault();
      e.stopPropagation();
      setActive(id);
      post({ type: 'region-select', id: id, html: getRegionHtml(el) });
    });

    el.addEventListener('dblclick', function (e) {
      e.preventDefault();
      e.stopPropagation();
      editing = true;
      setActive(id);
      el.classList.add('cms-editing');
      el.setAttribute('contenteditable', 'true');
      el.focus();
      post({ type: 'region-edit-start', id: id });
    });

    el.addEventListener('input', function () {
      clearTimeout(el._cmsInputTimer);
      el._cmsInputTimer = setTimeout(function () {
        post({ type: 'region-change', id: id, html: getRegionHtml(el) });
      }, 200);
    });

    el.addEventListener('blur', function () {
      if (!editing) return;
      editing = false;
      el.classList.remove('cms-editing');
      el.removeAttribute('contenteditable');
      post({ type: 'region-change', id: id, html: getRegionHtml(el) });
      post({ type: 'region-edit-end', id: id });
    });
  });

  window.addEventListener('scroll', refreshBadges, { passive: true });
  window.addEventListener('resize', refreshBadges);
  refreshBadges();

  window.addEventListener('message', function (e) {
    var data = e.data || {};
    if (data.source !== 'stoffus-cms-admin') return;
    if (data.type === 'select-region') {
      var target = regions.find(function (el) {
        return el.getAttribute('data-cms-region') === data.id;
      });
      if (target) {
        setActive(data.id);
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
    if (data.type === 'refresh-badges') {
      refreshBadges();
    }
  });

  post({ type: 'preview-ready', regions: regions.map(function (el) {
    return {
      id: el.getAttribute('data-cms-region'),
      label: el.getAttribute('data-cms-label') || el.getAttribute('data-cms-region'),
      html: getRegionHtml(el),
    };
  }) });
})();
