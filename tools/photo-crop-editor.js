(function () {
  var CARD_W = 420;
  var CARD_H = 315;

  var embedded = /[?&]cms=1/.test(location.search);
  if (embedded) document.body.classList.add('is-embedded');

  var modelSelect = document.getElementById('model-select');
  var slotSelect = document.getElementById('slot-select');
  var zoomRange = document.getElementById('zoom-range');
  var zoomVal = document.getElementById('zoom-val');
  var stage = document.getElementById('stage');
  var stageImg = document.getElementById('stage-img');
  var stageFrame = document.getElementById('stage-frame');
  var jsonOut = document.getElementById('json-out');
  var statusEl = document.getElementById('status');
  var dragHint = document.getElementById('drag-hint');
  var slotHint = document.getElementById('slot-hint');
  var cmsActions = document.getElementById('cms-actions');

  var config = null;
  var models = [];
  var photoMeta = {};
  var cmsAuth = false;
  var current = {
    focusX: 0.5,
    focusY: 0.5,
    zoom: 1,
  };
  var imgW = 0;
  var imgH = 0;
  var dragging = false;
  var dragStart = null;

  function setStatus(msg) {
    statusEl.textContent = msg || '';
  }

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function defaultConfig() {
    return {
      cardWidth: CARD_W,
      cardHeight: CARD_H,
      defaultMode: 'cover',
      crops: {},
    };
  }

  function syncJsonOut() {
    jsonOut.value = JSON.stringify(config, null, 2);
  }

  function getModelId() {
    return modelSelect.value;
  }

  function getSlot() {
    return slotSelect.value;
  }

  function cmsApi(path, options) {
    options = options || {};
    return fetch('/cms/api/' + path, {
      method: options.method || 'GET',
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
      credentials: 'same-origin',
    }).then(function (res) {
      return res.text().then(function (text) {
        var data = {};
        if (text) {
          try {
            data = JSON.parse(text);
          } catch (e) {
            throw { error: 'Resposta inválida do CMS.' };
          }
        }
        if (!res.ok) throw data;
        return data;
      });
    });
  }

  function updateCmsUi() {
    if (cmsActions) cmsActions.hidden = !cmsAuth;
    if (embedded && cmsAuth) {
      var manual = document.getElementById('manual-actions');
      if (manual) manual.hidden = true;
    }
    if (embedded && !cmsAuth) {
      setStatus('Inicie sessão no CMS para guardar directamente no servidor.');
    }
  }

  function catalogSlotFor(modelId) {
    var meta = photoMeta[modelId];
    return meta ? String(meta.catalogSlot || 1) : '1';
  }

  function updateSlotHint() {
    if (!slotHint) return;
    var catalogSlot = catalogSlotFor(getModelId());
    if (getSlot() === catalogSlot) {
      slotHint.textContent = 'Esta foto (slot ' + catalogSlot + ') é a capa do catálogo e homepage.';
      slotHint.style.color = '';
    } else {
      slotHint.textContent = 'A capa do catálogo é o slot ' + catalogSlot + '. Escolha esse slot para editar o corte do cartão, ou mude a capa em «Capa e galeria».';
      slotHint.style.color = '#e84c26';
    }
  }

  function applyCurrentCrop() {
    current.zoom = Number(zoomRange.value);
  }

  function applyCacheVersion(version) {
    if (!version) return;
    window.__PHOTO_CARD_V = version;
  }

  function loadEntryFromConfig() {
    var id = getModelId();
    var slot = getSlot();
    var entry = (config.crops[id] && config.crops[id][slot]) || {};
    current.focusX = entry.focusX != null ? entry.focusX : 0.5;
    current.focusY = entry.focusY != null ? entry.focusY : 0.5;
    current.zoom = entry.zoom != null ? entry.zoom : 1;

    zoomRange.value = String(current.zoom);
    zoomVal.textContent = Number(current.zoom).toFixed(2);
    updateSlotHint();
  }

  function saveEntryToConfig() {
    applyCurrentCrop();
    var id = getModelId();
    var slot = getSlot();
    if (!config.crops[id]) config.crops[id] = {};
    config.crops[id][slot] = {
      focusX: round3(current.focusX),
      focusY: round3(current.focusY),
      zoom: round3(current.zoom),
    };
    syncJsonOut();
  }

  function round3(n) {
    return Math.round(n * 1000) / 1000;
  }

  function publishCrop(rebuildOnly) {
    applyCurrentCrop();
    if (!rebuildOnly) saveEntryToConfig();
    var modelId = getModelId();
    var catalogSlot = catalogSlotFor(modelId);
    if (getSlot() !== catalogSlot) {
      return Promise.reject({
        error: 'A capa do catálogo usa o slot ' + catalogSlot + '. Mude para esse slot ou altere a capa em «Capa e galeria».',
      });
    }
    if (rebuildOnly) {
      return cmsApi('rebuild-thumbs.php', {
        method: 'POST',
        body: { modelId: modelId },
      }).then(function (data) {
        applyCacheVersion(data.cacheVersion);
        return data;
      });
    }
    return cmsApi('photo-crops.php', {
      method: 'POST',
      body: {
        config: config,
        modelId: modelId,
        rebuild: true,
      },
    }).then(function (data) {
      applyCacheVersion(data.cacheVersion);
      return data;
    });
  }

  function innerBox() {
    var rect = stage.getBoundingClientRect();
    return {
      left: 0,
      top: 0,
      width: rect.width,
      height: rect.height,
    };
  }

  function layoutFrame() {
    var box = innerBox();
    stageFrame.style.left = box.left + 'px';
    stageFrame.style.top = box.top + 'px';
    stageFrame.style.width = box.width + 'px';
    stageFrame.style.height = box.height + 'px';
  }

  function computeCoverCrop(iw, ih, ar, focusX, focusY, zoom) {
    var cropW;
    var cropH;
    var z = Math.max(1, zoom);

    if (iw / ih > ar) {
      cropH = ih / z;
      cropW = cropH * ar;
    } else {
      cropW = iw / z;
      cropH = cropW / ar;
    }

    cropW = Math.min(iw, cropW);
    cropH = Math.min(ih, cropH);

    var left = focusX * iw - cropW / 2;
    var top = focusY * ih - cropH / 2;
    left = Math.max(0, Math.min(iw - cropW, left));
    top = Math.max(0, Math.min(ih - cropH, top));

    return { left: left, top: top, cropW: cropW, cropH: cropH };
  }

  function layoutImage() {
    if (!imgW || !imgH) return;
    var box = innerBox();
    var ar = box.width / box.height;
    var crop = computeCoverCrop(imgW, imgH, ar, current.focusX, current.focusY, current.zoom);
    var scale = box.width / crop.cropW;
    stageImg.style.width = (imgW * scale) + 'px';
    stageImg.style.height = (imgH * scale) + 'px';
    stageImg.style.left = (box.left - crop.left * scale) + 'px';
    stageImg.style.top = (box.top - crop.top * scale) + 'px';
    stageImg.style.transform = 'none';
  }

  function updatePreview() {
    current.zoom = Number(zoomRange.value);
    zoomVal.textContent = current.zoom.toFixed(2);
    layoutFrame();
    layoutImage();
    dragHint.textContent = 'Arraste a imagem para escolher o ponto de foco dentro do cartão.';
  }

  function loadImage() {
    var id = getModelId();
    var slot = getSlot();
    var url = '../assets/photos/models/' + id + '-' + slot + '.png?v=' + Date.now();
    stageImg.hidden = true;
    stageImg.onload = function () {
      imgW = stageImg.naturalWidth;
      imgH = stageImg.naturalHeight;
      stageImg.hidden = false;
      loadEntryFromConfig();
      updatePreview();
    };
    stageImg.onerror = function () {
      stageImg.hidden = true;
      setStatus('Foto não encontrada: ' + id + '-' + slot + '.png');
    };
    stageImg.src = url;
  }

  function pointerDown(e) {
    dragging = true;
    dragStart = { x: e.clientX, y: e.clientY, focusX: current.focusX, focusY: current.focusY };
    stage.classList.add('is-dragging');
  }

  function pointerMove(e) {
    if (!dragging || !dragStart) return;
    var rect = stage.getBoundingClientRect();
    var dx = (e.clientX - dragStart.x) / rect.width;
    var dy = (e.clientY - dragStart.y) / rect.height;
    current.focusX = clamp(dragStart.focusX - dx, 0, 1);
    current.focusY = clamp(dragStart.focusY - dy, 0, 1);
    layoutImage();
  }

  function pointerUp() {
    dragging = false;
    dragStart = null;
    stage.classList.remove('is-dragging');
  }

  function bindStageDrag() {
    stage.addEventListener('pointerdown', pointerDown);
    window.addEventListener('pointermove', pointerMove);
    window.addEventListener('pointerup', pointerUp);
  }

  function populateModels(data) {
    models = (data.models || []).filter(function (m) { return m.photo; });
    models.sort(function (a, b) { return a.name.localeCompare(b.name, 'pt'); });
    modelSelect.innerHTML = models.map(function (m) {
      return '<option value="' + m.id + '">' + m.name + '</option>';
    }).join('');
  }

  function loadCropsConfig() {
    if (cmsAuth) {
      return cmsApi('photo-crops.php').then(function (data) {
        return data.config || defaultConfig();
      });
    }
    return fetch('../data/photo-crops.json')
      .then(function (r) { return r.ok ? r.json() : defaultConfig(); })
      .catch(function () { return defaultConfig(); });
  }

  function init() {
    cmsApi('me.php').then(function (data) {
      cmsAuth = !!data.authenticated;
      updateCmsUi();
    }).catch(function () {
      cmsAuth = false;
      updateCmsUi();
    }).finally(function () {
      var loaders = [
        fetch('../data/models.json').then(function (r) { return r.json(); }),
        loadCropsConfig(),
      ];
      if (cmsAuth) {
        loaders.push(cmsApi('model-photos.php').then(function (data) {
          (data.models || []).forEach(function (m) { photoMeta[m.id] = m; });
        }).catch(function () {}));
      }
      Promise.all(loaders).then(function (results) {
        populateModels(results[0]);
        config = results[1] || defaultConfig();
        if (!config.crops) config.crops = {};
        syncJsonOut();
        updateSlotHint();
        loadImage();
      }).catch(function () {
        setStatus('Abra esta página via servidor local (ex.: ABRIR-CMS.bat) para carregar modelos e fotos.');
      });
    });
  }

  modelSelect.addEventListener('change', loadImage);
  slotSelect.addEventListener('change', function () {
    updateSlotHint();
    loadImage();
  });
  zoomRange.addEventListener('input', updatePreview);
  window.addEventListener('resize', updatePreview);

  document.getElementById('reset-entry').addEventListener('click', function () {
    var id = getModelId();
    var slot = getSlot();
    if (config.crops[id]) delete config.crops[id][slot];
    loadEntryFromConfig();
    updatePreview();
    syncJsonOut();
    setStatus('Predefinição reposta para ' + id + '.');
  });

  document.getElementById('download-json').addEventListener('click', function () {
    syncJsonOut();
    var blob = new Blob([jsonOut.value], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'photo-crops.json';
    a.click();
    URL.revokeObjectURL(a.href);
    setStatus('JSON descarregado.');
  });

  document.getElementById('copy-json').addEventListener('click', function () {
    syncJsonOut();
    navigator.clipboard.writeText(jsonOut.value).then(function () {
      setStatus('JSON copiado.');
    });
  });

  document.getElementById('rebuild-thumb').addEventListener('click', function () {
    var btn = document.getElementById('rebuild-thumb');
    btn.disabled = true;
    publishCrop(true).then(function (data) {
      setStatus((data.message || 'Miniatura regenerada.') + ' Actualize o catálogo (Ctrl+F5).');
      loadImage();
    }).catch(function (err) {
      setStatus(err.error || 'Erro ao regenerar miniatura.');
    }).finally(function () {
      btn.disabled = false;
    });
  });

  document.getElementById('save-rebuild').addEventListener('click', function () {
    var btn = document.getElementById('save-rebuild');
    btn.disabled = true;
    publishCrop(false).then(function (data) {
      setStatus((data.message || 'Publicado no site.') + ' Abra o catálogo e actualize (Ctrl+F5).');
      loadImage();
    }).catch(function (err) {
      setStatus(err.error || 'Erro ao publicar no site.');
    }).finally(function () {
      btn.disabled = false;
    });
  });

  bindStageDrag();
  init();
})();
