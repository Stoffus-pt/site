(function () {
  var grid = document.getElementById('fabrics-grid');
  var filters = document.getElementById('fabrics-filters');
  var searchEl = document.getElementById('fabrics-search');
  var paginationEl = document.getElementById('fabrics-pagination');
  var countEl = document.getElementById('fabrics-count');
  var emptyEl = document.getElementById('fabrics-empty');
  var modal = document.getElementById('fabric-modal');
  var modalTitle = document.getElementById('fabric-modal-title');
  var modalGama = document.getElementById('fabric-modal-gama');
  var modalMeta = document.getElementById('fabric-modal-meta');
  var modalSpecs = document.getElementById('fabric-modal-specs');
  var modalPreview = document.getElementById('fabric-modal-preview');
  var modalZoom = document.getElementById('fabric-modal-zoom');
  var modalCode = document.getElementById('fabric-modal-code');
  var modalColors = document.getElementById('fabric-modal-colors');
  var modalConfig = document.getElementById('fabric-modal-config');
  var viewer = document.getElementById('fabric-viewer');
  var viewerImg = document.getElementById('fabric-viewer-img');
  var viewerCanvas = document.getElementById('fabric-viewer-canvas');
  var viewerCaption = document.getElementById('fabric-viewer-caption');
  var viewerLevel = document.getElementById('fabric-viewer-level');
  var viewerIn = document.getElementById('fabric-viewer-in');
  var viewerOut = document.getElementById('fabric-viewer-out');
  var viewerReset = document.getElementById('fabric-viewer-reset');

  if (!grid || !filters || !modal) return;

  var PAGE_SIZE = 18;
  var SPEC_LABELS = [
    { key: 'composicao', label: 'Composição' },
    { key: 'largura', label: 'Largura' },
    { key: 'peso', label: 'Peso' },
    { key: 'abrasao', label: 'Abrasão' },
    { key: 'borboto', label: 'Borboto' },
  ];

  var GAMA_ORDER = ['bliss', 'delta', 'fashion', 'pele'];

  function sortCollections(list) {
    return list.slice().sort(function (a, b) {
      var oa = GAMA_ORDER.indexOf(a.gama);
      var ob = GAMA_ORDER.indexOf(b.gama);
      if (oa === -1) oa = GAMA_ORDER.length;
      if (ob === -1) ob = GAMA_ORDER.length;
      if (oa !== ob) return oa - ob;
      return a.name.localeCompare(b.name, 'pt-PT');
    });
  }

  var CONFIGURATOR = (window.StoffusSite && window.StoffusSite.configurator) || '/Studio3D/app.html';
  var GAMAS = {};
  var TEXTURE_LABELS = { default: 'Tecido' };
  var COLLECTIONS = [];
  var currentFilter = 'all';
  var searchQuery = '';
  var currentPage = 1;
  var lastFocus = null;
  var mediaObserver = null;

  function textureRemoteBase() {
    return (window.StoffusSite && window.StoffusSite.textureRemote) || 'https://stoffus.pt/Studio3D/assets/textures/';
  }

  function textureUrl(col, fileIndex) {
    var folder = col.textureFolder || col.name;
    var file = encodeURIComponent(folder + ' ' + fileIndex + '.jpg');
    return textureRemoteBase() + file;
  }

  function colorCount(col) {
    return col.colorCount || (col.end - col.start + 1);
  }

  function colorCode(col, fileIndex) {
    return col.prefix + (col.start + fileIndex - 1);
  }

  function fabricIdFor(col, fileIndex) {
    return col.id + '_' + colorCode(col, fileIndex);
  }

  function fabricConfiguratorUrl(fabricId) {
    if (window.StoffusSite && window.StoffusSite.configuratorForFabric) {
      return window.StoffusSite.configuratorForFabric(fabricId);
    }
    return CONFIGURATOR;
  }

  function bindFabricConfiguratorClick(link, fabricId) {
    if (!link || !fabricId) return;
    link.setAttribute('data-fabric-id', fabricId);
    if (!link.getAttribute('href')) link.setAttribute('href', '#');
    link.addEventListener('click', function () {
      link.href = fabricConfiguratorUrl(fabricId);
    });
  }

  function cardThumb(col) {
    if (col.cover) return col.cover;
    if (window.StoffusSite && window.StoffusSite.isGithubPreview) {
      return textureUrl(col, 1);
    }
    return 'assets/photos/tecidos/' + col.id + '.jpg';
  }

  function cardThumbFallback(col) {
    return textureUrl(col, 1);
  }

  function bindImageFallback(img, primary, fallback) {
    img.addEventListener('error', function onError() {
      if (fallback && img.src.indexOf(fallback) === -1) {
        img.src = fallback;
        return;
      }
      img.removeEventListener('error', onError);
    });
    img.src = primary;
  }

  function gamaFor(col) {
    if (col.gamaLabel) {
      return { filter: col.gama || 'all', label: col.gamaLabel };
    }
    return GAMAS[col.prefix] || { label: col.prefix, filter: col.gama || 'all' };
  }

  function specValue(col, key) {
    var specs = col && col.specs ? col.specs : {};
    var value = specs[key];
    if (value == null) return '';
    return String(value).trim();
  }

  function parseBorboto(value) {
    if (!value) return null;
    var match = String(value).replace(',', '.').match(/(\d+(?:\.\d+)?)/);
    if (!match) return null;
    var num = Number(match[1]);
    if (!Number.isFinite(num)) return null;
    if (num > 5 && num <= 50) num = num / 10;
    return Math.max(0, Math.min(5, num));
  }

  function renderBorboto(value) {
    var score = parseBorboto(value);
    if (score == null) {
      return '<span class="fabric-tech__empty">—</span>';
    }
    var filled = Math.round(score);
    var stars = '';
    for (var i = 1; i <= 4; i++) {
      stars += '<span class="fabric-tech__star' + (i <= filled ? ' is-on' : '') + '" aria-hidden="true">★</span>';
    }
    return (
      '<span class="fabric-tech__pilling" title="Borboto ' + score.toFixed(1) + '">' +
        '<span class="fabric-tech__knob" aria-hidden="true"></span>' +
        '<span class="fabric-tech__stars">' + stars + '</span>' +
        '<span class="fabric-tech__score">' + score.toFixed(1) + '</span>' +
      '</span>'
    );
  }

  function fillModalSpecs(col) {
    if (!modalSpecs) return;
    SPEC_LABELS.forEach(function (item) {
      var dd = modalSpecs.querySelector('[data-spec="' + item.key + '"]');
      if (!dd) return;
      var value = specValue(col, item.key);
      if (item.key === 'borboto') {
        dd.innerHTML = value ? renderBorboto(value) : '<span class="fabric-tech__empty">—</span>';
      } else {
        dd.textContent = value || '—';
      }
      dd.classList.toggle('is-empty', !value);
    });
  }

  function collectionVideo(col) {
    if (col.video) return col.video;
    if (col.previewVideo) return col.previewVideo;
    return '';
  }

  function renderCard(col, index) {
    var gama = gamaFor(col);
    var textureLabel = TEXTURE_LABELS[col.texture] || TEXTURE_LABELS.default;
    var colors = colorCount(col);
    var videoSrc = collectionVideo(col);
    var primaryTexture = textureUrl(col, 1);

    var card = document.createElement('article');
    card.className = 'fabric-showcase';
    card.dataset.gama = gama.filter;
    card.dataset.id = col.id;
    card.style.setProperty('--fabric-delay', ((index % 6) * 0.75) + 's');

    var mediaHtml = '';
    if (videoSrc) {
      mediaHtml +=
        '<video class="fabric-showcase__video" muted loop playsinline preload="metadata" poster="' + cardThumb(col) + '">' +
          '<source src="' + videoSrc + '" type="video/mp4" />' +
        '</video>';
    }

    card.innerHTML =
      '<button type="button" class="fabric-showcase__btn" data-open-fabric="' + col.id + '" aria-label="Abrir colecção ' + col.name + '">' +
        '<div class="fabric-showcase__media">' +
          mediaHtml +
          '<img class="fabric-showcase__texture' + (videoSrc ? ' fabric-showcase__texture--fallback' : '') + '" src="' + primaryTexture + '" alt="" loading="lazy" decoding="async" />' +
          '<span class="fabric-showcase__shade" aria-hidden="true"></span>' +
        '</div>' +
        '<div class="fabric-showcase__caption">' +
          '<span class="fabric-showcase__gama" data-gama-prefix="' + col.prefix + '">' + gama.label + '</span>' +
          '<h3 class="fabric-showcase__title">' + col.name + '</h3>' +
          '<p class="fabric-showcase__meta">' + textureLabel + ' · ' + colors + ' cores</p>' +
        '</div>' +
      '</button>';

    var img = card.querySelector('.fabric-showcase__texture');
    if (img) {
      bindImageFallback(img, primaryTexture, cardThumbFallback(col));
    }

    bindShowcaseMedia(card);
    return card;
  }

  function bindShowcaseMedia(card) {
    var media = card.querySelector('.fabric-showcase__media');
    var video = card.querySelector('.fabric-showcase__video');
    if (!media) return;

    if (video) {
      video.addEventListener('loadeddata', function () {
        media.classList.add('has-video');
      });
      card.addEventListener('mouseenter', function () {
        video.play().catch(function () {});
      });
      card.addEventListener('mouseleave', function () {
        video.pause();
        video.currentTime = 0;
      });
    }

    if (mediaObserver) {
      mediaObserver.observe(media);
    }
  }

  function initMediaObserver() {
    if (!('IntersectionObserver' in window)) return;
    mediaObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var video = entry.target.querySelector('.fabric-showcase__video');
        if (!video) return;
        if (entry.isIntersecting) {
          video.play().catch(function () {});
        } else {
          video.pause();
        }
      });
    }, { threshold: 0.4 });
  }

  function getCollectionById(id) {
    for (var i = 0; i < COLLECTIONS.length; i++) {
      if (COLLECTIONS[i].id === id) return COLLECTIONS[i];
    }
    return null;
  }

  function setPreview(col, fileIndex, btn) {
    var code = colorCode(col, fileIndex);
    var url = textureUrl(col, fileIndex);

    modalPreview.src = url;
    modalPreview.alt = col.name + ' ' + code;
    modalCode.textContent = code;
    if (modalZoom) {
      modalZoom.setAttribute('aria-label', 'Ampliar ' + col.name + ' ' + code);
    }
    if (modalConfig) {
      modalConfig.setAttribute('data-fabric-id', fabricIdFor(col, fileIndex));
    }

    modalColors.querySelectorAll('.fabric-color').forEach(function (el) {
      el.classList.toggle('is-active', el === btn);
    });

    if (viewer && !viewer.hidden) {
      openViewer(col.name + ' ' + code, url);
    }
  }

  var viewerState = {
    scale: 1,
    x: 0,
    y: 0,
    dragging: false,
    lastX: 0,
    lastY: 0,
  };

  function applyViewerTransform() {
    if (!viewerImg) return;
    viewerImg.style.transform =
      'translate(' + viewerState.x + 'px, ' + viewerState.y + 'px) scale(' + viewerState.scale + ')';
    if (viewerLevel) {
      viewerLevel.textContent = Math.round(viewerState.scale * 100) + '%';
    }
  }

  function setViewerZoom(next) {
    viewerState.scale = Math.max(1, Math.min(4, next));
    if (viewerState.scale === 1) {
      viewerState.x = 0;
      viewerState.y = 0;
    }
    applyViewerTransform();
  }

  function openViewer(caption, url) {
    if (!viewer || !viewerImg) return;
    viewerImg.src = url;
    viewerImg.alt = caption || '';
    if (viewerCaption) viewerCaption.textContent = caption || '';
    viewerState.scale = 1;
    viewerState.x = 0;
    viewerState.y = 0;
    applyViewerTransform();
    viewer.hidden = false;
    viewer.setAttribute('aria-hidden', 'false');
  }

  function closeViewer() {
    if (!viewer || viewer.hidden) return;
    viewer.hidden = true;
    viewer.setAttribute('aria-hidden', 'true');
    viewerState.dragging = false;
    if (viewerCanvas) viewerCanvas.classList.remove('is-dragging');
  }

  function openModal(col) {
    if (!col) return;

    modal.dataset.collectionId = col.id;

    var gama = gamaFor(col);
    var textureLabel = TEXTURE_LABELS[col.texture] || TEXTURE_LABELS.default;
    var colors = colorCount(col);

    modalTitle.textContent = col.name;
    modalGama.textContent = gama.label;
    modalMeta.textContent = textureLabel + ' · ' + colors + ' cores · ' + col.prefix + col.start + ' – ' + col.prefix + col.end;
    fillModalSpecs(col);
    if (modalSpecs && 'open' in modalSpecs) modalSpecs.open = false;
    if (modalConfig) {
      modalConfig.setAttribute('data-fabric-id', fabricIdFor(col, 1));
    }
    modalColors.innerHTML = '';

    for (var i = 1; i <= colors; i++) {
      (function (fileIndex) {
        var code = colorCode(col, fileIndex);
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'fabric-color';
        btn.dataset.fileIndex = String(fileIndex);
        btn.setAttribute('aria-label', col.name + ' ' + code);
        btn.innerHTML =
          '<img src="' + textureUrl(col, fileIndex) + '" alt="" loading="lazy" decoding="async" />' +
          '<span>' + code + '</span>';

        var thumb = btn.querySelector('img');
        if (thumb && fileIndex === 1) {
          bindImageFallback(thumb, cardThumb(col), cardThumbFallback(col));
        }

        btn.addEventListener('click', function () {
          setPreview(col, fileIndex, btn);
        });

        modalColors.appendChild(btn);

        if (fileIndex === 1) {
          setPreview(col, 1, btn);
        }
      })(i);
    }

    lastFocus = document.activeElement;
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    history.replaceState(null, '', '#' + col.id);
    modal.querySelector('.fabric-modal__close').focus();
  }

  function closeModal() {
    closeViewer();
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (location.hash) {
      history.replaceState(null, '', location.pathname + location.search);
    }
    if (lastFocus && typeof lastFocus.focus === 'function') {
      lastFocus.focus();
    }
  }

  function normalizeSearch(value) {
    return String(value || '').trim().toLowerCase();
  }

  function matchesSearch(col, query) {
    if (!query) return true;
    var hay = [col.name, col.id, col.prefix, col.gamaLabel, col.gama].join(' ').toLowerCase();
    return hay.indexOf(query) !== -1;
  }

  function getFiltered() {
    var query = normalizeSearch(searchQuery);
    return COLLECTIONS.filter(function (col) {
      var gama = gamaFor(col);
      if (currentFilter !== 'all' && gama.filter !== currentFilter) return false;
      return matchesSearch(col, query);
    });
  }

  function renderPagination(totalPages) {
    if (!paginationEl) return;
    if (totalPages <= 1) {
      paginationEl.hidden = true;
      paginationEl.innerHTML = '';
      return;
    }

    paginationEl.hidden = false;
    var html = '';

    if (currentPage > 1) {
      html += '<button type="button" class="fabrics-pagination__btn" data-page="' + (currentPage - 1) + '" aria-label="Página anterior">‹</button>';
    }

    for (var p = 1; p <= totalPages; p++) {
      html += '<button type="button" class="fabrics-pagination__btn' + (p === currentPage ? ' is-active' : '') + '" data-page="' + p + '"' +
        (p === currentPage ? ' aria-current="page"' : '') + '>' + p + '</button>';
    }

    if (currentPage < totalPages) {
      html += '<button type="button" class="fabrics-pagination__btn" data-page="' + (currentPage + 1) + '" aria-label="Página seguinte">›</button>';
    }

    paginationEl.innerHTML = html;
  }

  function renderGrid() {
    var items = getFiltered();
    var totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));

    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    var start = (currentPage - 1) * PAGE_SIZE;
    var pageItems = items.slice(start, start + PAGE_SIZE);

    grid.innerHTML = '';
    pageItems.forEach(function (col, index) {
      grid.appendChild(renderCard(col, start + index));
    });

    if (countEl) {
      countEl.textContent = items.length + (items.length === 1 ? ' colecção' : ' colecções');
    }

    if (emptyEl) {
      emptyEl.hidden = items.length > 0;
    }

    renderPagination(totalPages);
  }

  function bindUi() {
    grid.addEventListener('click', function (e) {
      var trigger = e.target.closest('[data-open-fabric]');
      if (!trigger) return;
      var col = getCollectionById(trigger.dataset.openFabric);
      if (col) openModal(col);
    });

    filters.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-filter]');
      if (!btn) return;

      currentFilter = btn.dataset.filter;
      currentPage = 1;
      filters.querySelectorAll('[data-filter]').forEach(function (el) {
        el.classList.toggle('is-active', el === btn);
        el.setAttribute('aria-pressed', el === btn ? 'true' : 'false');
      });
      renderGrid();
    });

    if (searchEl) {
      searchEl.addEventListener('input', function () {
        searchQuery = searchEl.value;
        currentPage = 1;
        renderGrid();
      });
    }

    if (paginationEl) {
      paginationEl.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-page]');
        if (!btn) return;
        currentPage = Number(btn.dataset.page || 1);
        renderGrid();
        grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    modal.addEventListener('click', function (e) {
      if (e.target.closest('[data-fabric-close]')) {
        closeModal();
      }
    });

    if (modalZoom) {
      modalZoom.addEventListener('click', function () {
        openViewer(modalPreview.alt || modalCode.textContent, modalPreview.src);
      });
    }

    if (viewer) {
      viewer.addEventListener('click', function (e) {
        if (e.target.closest('[data-viewer-close]')) closeViewer();
      });
    }

    if (viewerIn) {
      viewerIn.addEventListener('click', function () {
        setViewerZoom(viewerState.scale + 0.25);
      });
    }
    if (viewerOut) {
      viewerOut.addEventListener('click', function () {
        setViewerZoom(viewerState.scale - 0.25);
      });
    }
    if (viewerReset) {
      viewerReset.addEventListener('click', function () {
        setViewerZoom(1);
      });
    }

    if (viewerCanvas) {
      viewerCanvas.addEventListener('wheel', function (e) {
        if (!viewer || viewer.hidden) return;
        e.preventDefault();
        setViewerZoom(viewerState.scale + (e.deltaY < 0 ? 0.15 : -0.15));
      }, { passive: false });

      viewerCanvas.addEventListener('pointerdown', function (e) {
        if (!viewer || viewer.hidden) return;
        viewerState.dragging = true;
        viewerState.lastX = e.clientX;
        viewerState.lastY = e.clientY;
        viewerCanvas.classList.add('is-dragging');
        viewerCanvas.setPointerCapture(e.pointerId);
      });

      viewerCanvas.addEventListener('pointermove', function (e) {
        if (!viewerState.dragging) return;
        viewerState.x += e.clientX - viewerState.lastX;
        viewerState.y += e.clientY - viewerState.lastY;
        viewerState.lastX = e.clientX;
        viewerState.lastY = e.clientY;
        applyViewerTransform();
      });

      function endDrag(e) {
        if (!viewerState.dragging) return;
        viewerState.dragging = false;
        viewerCanvas.classList.remove('is-dragging');
        try { viewerCanvas.releasePointerCapture(e.pointerId); } catch (err) {}
      }

      viewerCanvas.addEventListener('pointerup', endDrag);
      viewerCanvas.addEventListener('pointercancel', endDrag);
    }

    document.addEventListener('keydown', function (e) {
      if (viewer && !viewer.hidden) {
        if (e.key === 'Escape') {
          e.preventDefault();
          closeViewer();
          return;
        }
        if (e.key === '+' || e.key === '=') setViewerZoom(viewerState.scale + 0.25);
        if (e.key === '-' || e.key === '_') setViewerZoom(viewerState.scale - 0.25);
        if (e.key === '0') setViewerZoom(1);
        return;
      }
      if (modal.hidden) return;
      if (e.key === 'Escape') closeModal();
    });

    if (modalConfig) {
      modalConfig.addEventListener('click', function () {
        var fabricId = modalConfig.getAttribute('data-fabric-id');
        if (fabricId) modalConfig.href = fabricConfiguratorUrl(fabricId);
      });
    }
  }

  function init(data) {
    GAMAS = data.gamas || {};
    TEXTURE_LABELS = data.textureLabels || TEXTURE_LABELS;
    COLLECTIONS = sortCollections((data.collections || []).filter(function (col) {
      return col && col.show !== false;
    }));

    initMediaObserver();
    bindUi();
    renderGrid();

    if (location.hash.length > 1) {
      var fromHash = getCollectionById(location.hash.slice(1));
      if (fromHash) openModal(fromHash);
    }
  }

  fetch('data/fabrics.json')
    .then(function (res) {
      if (!res.ok) throw new Error('fabrics.json');
      return res.json();
    })
    .then(init)
    .catch(function () {
      if (countEl) countEl.textContent = 'Catálogo indisponível';
      if (emptyEl) {
        emptyEl.hidden = false;
        emptyEl.textContent = 'Não foi possível carregar o catálogo de tecidos.';
      }
    });
})();
