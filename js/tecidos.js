(function () {
  var GAMAS = {
    B: { filter: 'bliss', label: 'Bliss' },
    D: { filter: 'delta', label: 'Delta' },
    E: { filter: 'pele', label: 'Pele Extra' },
    P: { filter: 'pele', label: 'Pele Platina' }
  };

  var TEXTURE_LABELS = {
    default: 'Tecido',
    aveludado: 'Aveludado',
    alinhado: 'Alinhado',
    pele: 'Pele genuína'
  };

  var COLLECTIONS = [
    { id: 'artis', name: 'Artis', prefix: 'B', start: 6001, end: 6007, texture: 'alinhado' },
    { id: 'bella', name: 'Bella', prefix: 'B', start: 1057, end: 1063, texture: 'aveludado' },
    { id: 'carmen', name: 'Carmen', prefix: 'B', start: 1127, end: 1133, texture: 'alinhado' },
    { id: 'falcon', name: 'Falcon', prefix: 'B', start: 4092, end: 4098, texture: 'aveludado' },
    { id: 'funky', name: 'Funky', prefix: 'B', start: 4106, end: 4112, texture: 'aveludado' },
    { id: 'garby', name: 'Garby', prefix: 'B', start: 4078, end: 4084, texture: 'aveludado' },
    { id: 'grift', name: 'Grift', prefix: 'B', start: 4008, end: 4014, texture: 'alinhado' },
    { id: 'ifrane', name: 'Ifrane', prefix: 'B', start: 4036, end: 4042, texture: 'aveludado' },
    { id: 'jade', name: 'Jade', prefix: 'B', start: 1145, end: 1151, texture: 'aveludado' },
    { id: 'kamala', name: 'Kamala', prefix: 'B', start: 4071, end: 4077, texture: 'aveludado' },
    { id: 'kamala2', name: 'Kamala 2', prefix: 'B', start: 1138, end: 1144, texture: 'aveludado' },
    { id: 'karma', name: 'Karma', prefix: 'B', start: 4043, end: 4049, texture: 'alinhado' },
    { id: 'matchy', name: 'Matchy', prefix: 'B', start: 4085, end: 4091, texture: 'aveludado' },
    { id: 'mirage', name: 'Mirage', prefix: 'B', start: 4099, end: 4105, texture: 'aveludado' },
    { id: 'pisa', name: 'Pisa', prefix: 'B', start: 1113, end: 1119, texture: 'alinhado' },
    { id: 'prisma', name: 'Prisma', prefix: 'B', start: 4022, end: 4028, texture: 'aveludado' },
    { id: 'ramses', name: 'Ramses', prefix: 'B', start: 1015, end: 1021, texture: 'aveludado' },
    { id: 'rissani', name: 'Rissani', prefix: 'B', start: 4057, end: 4063, texture: 'alinhado' },
    { id: 'soft', name: 'Soft', prefix: 'B', start: 4015, end: 4021, texture: 'alinhado' },
    { id: 'stancy', name: 'Stancy', prefix: 'B', start: 4029, end: 4035, texture: 'aveludado' },
    { id: 'talia', name: 'Talia', prefix: 'B', start: 1043, end: 1049, texture: 'aveludado' },
    { id: 'touareg', name: 'Touareg', prefix: 'B', start: 1106, end: 1112, texture: 'aveludado' },
    { id: 'venturi', name: 'Venturi', prefix: 'B', start: 4050, end: 4056, texture: 'aveludado' },
    { id: 'zemy', name: 'Zemy', prefix: 'B', start: 4001, end: 4007, texture: 'aveludado' },
    { id: 'fumiko', name: 'Fumiko', prefix: 'D', start: 1001, end: 1007, texture: 'alinhado' },
    { id: 'madoka', name: 'Madoka', prefix: 'D', start: 4008, end: 4014, texture: 'alinhado' },
    { id: 'river', name: 'River', prefix: 'E', start: 1001, end: 1007, texture: 'pele' },
    { id: 'siza', name: 'Siza', prefix: 'P', start: 1001, end: 1007, texture: 'pele' }
  ];

  var CONFIGURATOR = (window.StoffusSite && window.StoffusSite.configurator) || '/Studio3D/app.html';
  var TEXTURE_REMOTE = (window.StoffusSite && window.StoffusSite.textureRemote) || '/Studio3D/assets/textures/';

  var grid = document.getElementById('fabrics-grid');
  var filters = document.getElementById('fabrics-filters');
  var countEl = document.getElementById('fabrics-count');
  var emptyEl = document.getElementById('fabrics-empty');
  var modal = document.getElementById('fabric-modal');
  var modalTitle = document.getElementById('fabric-modal-title');
  var modalGama = document.getElementById('fabric-modal-gama');
  var modalMeta = document.getElementById('fabric-modal-meta');
  var modalPreview = document.getElementById('fabric-modal-preview');
  var modalCode = document.getElementById('fabric-modal-code');
  var modalColors = document.getElementById('fabric-modal-colors');
  var modalConfig = document.getElementById('fabric-modal-config');

  if (!grid || !filters || !modal) return;

  var currentFilter = 'all';
  var lastFocus = null;

  function textureFolderName(col) {
    return col.name === 'Kamala 2' ? 'Kamala2' : col.name;
  }

  function textureUrl(col, fileIndex) {
    var file = encodeURIComponent(textureFolderName(col) + ' ' + fileIndex + '.jpg');
    return TEXTURE_REMOTE + file;
  }

  function colorCount(col) {
    return col.end - col.start + 1;
  }

  function colorCode(col, fileIndex) {
    return col.prefix + (col.start + fileIndex - 1);
  }

  function fabricIdFor(col, fileIndex) {
    var key = col.name.toLowerCase().replace(/\s/g, '');
    return key + '_' + colorCode(col, fileIndex);
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

  function renderCard(col) {
    var gama = GAMAS[col.prefix] || { label: col.prefix, filter: 'all' };
    var textureLabel = TEXTURE_LABELS[col.texture] || TEXTURE_LABELS.default;
    var colors = colorCount(col);
    var codeRange = col.prefix + col.start + ' – ' + col.prefix + col.end;

    var card = document.createElement('article');
    card.className = 'fabric-card';
    card.dataset.gama = gama.filter;
    card.dataset.id = col.id;

    card.innerHTML =
      '<button type="button" class="fabric-card__swatch" data-open-fabric="' + col.id + '" aria-label="Ver cores de ' + col.name + '">' +
        '<img src="' + cardThumb(col) + '" alt="Amostra ' + col.name + '" loading="lazy" decoding="async" />' +
        '<span class="fabric-card__gama" data-gama-prefix="' + col.prefix + '">' + gama.label + '</span>' +
        '<span class="fabric-card__hint">Ver cores</span>' +
      '</button>' +
      '<div class="fabric-card__body">' +
        '<h3 class="fabric-card__title">' + col.name + '</h3>' +
        '<p class="fabric-card__meta">' + textureLabel + ' · ' + colors + ' cores</p>' +
        '<p class="fabric-card__codes">' + codeRange + '</p>' +
        '<button type="button" class="fabric-card__link" data-open-fabric="' + col.id + '">Ver paleta de cores</button>' +
        '<a class="fabric-card__config" href="#" data-fabric-id="' + fabricIdFor(col, 1) + '">Ver no configurador</a>' +
      '</div>';

    var img = card.querySelector('.fabric-card__swatch img');
    if (img) {
      bindImageFallback(img, cardThumb(col), cardThumbFallback(col));
    }

    bindFabricConfiguratorClick(card.querySelector('.fabric-card__config'), fabricIdFor(col, 1));

    return card;
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
    if (modalConfig) {
      modalConfig.setAttribute('data-fabric-id', fabricIdFor(col, fileIndex));
    }

    modalColors.querySelectorAll('.fabric-color').forEach(function (el) {
      el.classList.toggle('is-active', el === btn);
    });
  }

  function openModal(col) {
    if (!col) return;

    var gama = GAMAS[col.prefix] || { label: col.prefix };
    var textureLabel = TEXTURE_LABELS[col.texture] || TEXTURE_LABELS.default;
    var colors = colorCount(col);

    modalTitle.textContent = col.name;
    modalGama.textContent = gama.label;
    modalMeta.textContent = textureLabel + ' · ' + colors + ' cores · ' + col.prefix + col.start + ' – ' + col.prefix + col.end;
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

  function getFiltered() {
    if (currentFilter === 'all') return COLLECTIONS.slice();
    return COLLECTIONS.filter(function (col) {
      var gama = GAMAS[col.prefix];
      return gama && gama.filter === currentFilter;
    });
  }

  function renderGrid() {
    var items = getFiltered();
    grid.innerHTML = '';

    items.forEach(function (col) {
      grid.appendChild(renderCard(col));
    });

    if (countEl) {
      countEl.textContent = items.length + (items.length === 1 ? ' colecção' : ' colecções');
    }

    if (emptyEl) {
      emptyEl.hidden = items.length > 0;
    }
  }

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
    filters.querySelectorAll('[data-filter]').forEach(function (el) {
      el.classList.toggle('is-active', el === btn);
      el.setAttribute('aria-pressed', el === btn ? 'true' : 'false');
    });
    renderGrid();
  });

  modal.addEventListener('click', function (e) {
    if (e.target.closest('[data-fabric-close]')) {
      closeModal();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (modal.hidden) return;
    if (e.key === 'Escape') closeModal();
  });

  if (modalConfig) {
    modalConfig.addEventListener('click', function () {
      var fabricId = modalConfig.getAttribute('data-fabric-id');
      if (fabricId) modalConfig.href = fabricConfiguratorUrl(fabricId);
    });
  }

  renderGrid();

  if (location.hash.length > 1) {
    var fromHash = getCollectionById(location.hash.slice(1));
    if (fromHash) openModal(fromHash);
  }
})();
