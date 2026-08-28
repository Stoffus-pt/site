(function () {
  var root = document.getElementById('fabric-mockup');
  if (!root) return;

  var mockupBox = root.querySelector('.fabric-mockup');
  var textureImg = document.getElementById('fabric-mockup-img');
  var captionEl = document.getElementById('fabric-mockup-caption');
  var collectionSelect = document.getElementById('fabric-mockup-collection');
  var colorsEl = document.getElementById('fabric-mockup-colors');
  var configBtn = document.getElementById('fabric-mockup-config');

  if (!textureImg || !collectionSelect || !colorsEl) return;

  var COLLECTIONS = [];
  var activeCol = null;
  var activeIndex = 1;

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

  function configuratorUrl(fabricId) {
    if (window.StoffusSite && window.StoffusSite.configuratorForFabric) {
      return window.StoffusSite.configuratorForFabric(fabricId);
    }
    return (window.StoffusSite && window.StoffusSite.configurator) || '/Studio3D/app.html';
  }

  function cardThumb(col) {
    if (col.cover) return col.cover;
    if (window.StoffusSite && window.StoffusSite.isGithubPreview) {
      return textureUrl(col, 1);
    }
    return 'assets/photos/tecidos/' + col.id + '.jpg';
  }

  function applyTexture(url, alt) {
    textureImg.alt = alt || 'Tecido aplicado no mockup';
    textureImg.classList.add('is-loading');
    textureImg.onload = function () {
      textureImg.classList.remove('is-loading');
    };
    textureImg.onerror = function () {
      textureImg.classList.remove('is-loading');
    };
    textureImg.src = url;
  }

  function updateCaption(col, fileIndex) {
    if (!captionEl || !col) return;
    var code = colorCode(col, fileIndex);
    captionEl.textContent = col.name + ' · ' + code;
  }

  function updateConfigLink(col, fileIndex) {
    if (!configBtn || !col) return;
    var fabricId = fabricIdFor(col, fileIndex);
    configBtn.href = configuratorUrl(fabricId);
    configBtn.setAttribute('data-fabric-id', fabricId);
  }

  function renderColors(col) {
    colorsEl.innerHTML = '';
    var total = colorCount(col);
    var maxVisible = Math.min(total, 24);
    var fragment = document.createDocumentFragment();

    for (var i = 1; i <= maxVisible; i++) {
      (function (fileIndex) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'fabric-mockup__color' + (fileIndex === activeIndex ? ' is-active' : '');
        btn.setAttribute('aria-label', col.name + ' ' + colorCode(col, fileIndex));
        btn.setAttribute('aria-pressed', fileIndex === activeIndex ? 'true' : 'false');

        var img = document.createElement('img');
        img.src = textureUrl(col, fileIndex);
        img.alt = '';
        img.loading = 'lazy';
        img.decoding = 'async';
        btn.appendChild(img);

        btn.addEventListener('click', function () {
          selectColor(col, fileIndex);
        });

        fragment.appendChild(btn);
      })(i);
    }

    if (total > maxVisible) {
      var more = document.createElement('p');
      more.className = 'fabric-mockup__more';
      more.textContent = '+' + (total - maxVisible) + ' cores — abra a colecção no catálogo';
      fragment.appendChild(more);
    }

    colorsEl.appendChild(fragment);
  }

  function selectColor(col, fileIndex, options) {
    options = options || {};
    activeCol = col;
    activeIndex = fileIndex;
    var url = textureUrl(col, fileIndex);
    applyTexture(url, col.name + ' ' + colorCode(col, fileIndex));
    updateCaption(col, fileIndex);
    updateConfigLink(col, fileIndex);
    if (options.syncSelect !== false && collectionSelect.value !== col.id) {
      collectionSelect.value = col.id;
    }
    renderColors(col);
    if (mockupBox) mockupBox.classList.add('is-ready');

    if (options.scroll) {
      root.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function selectCollection(colId) {
    var col = null;
    for (var i = 0; i < COLLECTIONS.length; i++) {
      if (COLLECTIONS[i].id === colId) {
        col = COLLECTIONS[i];
        break;
      }
    }
    if (!col) return;
    activeIndex = 1;
    selectColor(col, 1);
  }

  function buildCollectionSelect() {
    collectionSelect.innerHTML = '';
    COLLECTIONS.forEach(function (col) {
      var opt = document.createElement('option');
      opt.value = col.id;
      opt.textContent = col.name;
      collectionSelect.appendChild(opt);
    });

    collectionSelect.addEventListener('change', function () {
      selectCollection(collectionSelect.value);
    });
  }

  function init(data) {
    COLLECTIONS = (data.collections || []).filter(function (col) {
      return col && col.show !== false;
    });

    if (!COLLECTIONS.length) {
      root.hidden = true;
      return;
    }

    buildCollectionSelect();

    var preferred = COLLECTIONS[0];
    var featured = ['artis', 'falcon', 'garby', 'prisma', 'mirage', 'soft'];
    for (var i = 0; i < featured.length; i++) {
      for (var j = 0; j < COLLECTIONS.length; j++) {
        if (COLLECTIONS[j].id === featured[i]) {
          preferred = COLLECTIONS[j];
          break;
        }
      }
    }

    collectionSelect.value = preferred.id;
    selectCollection(preferred.id);

    // Pré-carregar miniatura local como fallback rápido
    if (preferred && textureImg && !textureImg.complete) {
      var fallback = new Image();
      fallback.onload = function () {
        if (textureImg.classList.contains('is-loading') && !textureImg.naturalWidth) {
          textureImg.src = fallback.src;
        }
      };
      fallback.src = cardThumb(preferred);
    }
  }

  window.StoffusFabricMockup = {
    apply: function (col, fileIndex, options) {
      if (!col) return;
      selectColor(col, fileIndex || 1, Object.assign({ syncSelect: true, scroll: false }, options || {}));
    },
    setFromCollection: function (col, fileIndex) {
      this.apply(col, fileIndex, { scroll: true });
    },
    highlight: function () {
      var section = root.closest('.fabric-mockup-section') || root;
      section.classList.add('is-highlight');
      window.setTimeout(function () {
        section.classList.remove('is-highlight');
      }, 1200);
    },
  };

  fetch('data/fabrics.json')
    .then(function (res) {
      if (!res.ok) throw new Error('fabrics.json');
      return res.json();
    })
    .then(init)
    .catch(function () {
      root.hidden = true;
    });
})();
