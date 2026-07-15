(function () {
  if (/[?&]cms=1/.test(location.search)) document.body.classList.add('is-embedded');

  var modelSelect = document.getElementById('model-select');
  var photoCountEl = document.getElementById('photo-count');
  var catalogSlotEl = document.getElementById('catalog-slot');
  var slotsEl = document.getElementById('slots');
  var statusEl = document.getElementById('status');

  var models = [];
  var current = null;
  var galleryOrder = [];

  function setStatus(msg) {
    statusEl.textContent = msg || '';
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
          try { data = JSON.parse(text); } catch (e) { throw { error: 'Resposta inválida do CMS.' }; }
        }
        if (!res.ok) throw data;
        return data;
      });
    });
  }

  function applyCacheVersion(version) {
    if (version) window.__PHOTO_CARD_V = version;
  }

  function getPhotoCount() {
    return Number(photoCountEl.value) || 1;
  }

  function fillCatalogOptions() {
    var count = getPhotoCount();
    catalogSlotEl.innerHTML = '';
    for (var i = 1; i <= count; i++) {
      var opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = 'Foto ' + i;
      catalogSlotEl.appendChild(opt);
    }
    if (current) {
      var slot = Math.min(Number(current.catalogSlot) || 1, count);
      catalogSlotEl.value = String(slot);
    }
  }

  function normalizeOrder(count) {
    var order = galleryOrder.slice();
    order = order.filter(function (slot, index) {
      return slot >= 1 && slot <= count && order.indexOf(slot) === index;
    });
    for (var s = 1; s <= count; s++) {
      if (order.indexOf(s) === -1) order.push(s);
    }
    galleryOrder = order;
  }

  function photoUrl(modelId, slot) {
    return '../assets/photos/models/' + modelId + '-' + slot + '.png?v=' + Date.now();
  }

  function renderSlots() {
    var count = getPhotoCount();
    normalizeOrder(count);
    fillCatalogOptions();
    var catalogSlot = Number(catalogSlotEl.value) || 1;
    var modelId = modelSelect.value;

    slotsEl.innerHTML = galleryOrder.map(function (slot, index) {
      var isCover = slot === catalogSlot;
      var slotInfo = (current.slots || []).find(function (s) { return s.slot === slot; });
      var hasPhoto = slotInfo ? slotInfo.exists : true;
      return '<article class="slot-card' + (isCover ? ' is-cover' : '') + (hasPhoto ? '' : ' is-empty') + '">' +
        (hasPhoto
          ? '<img src="' + photoUrl(modelId, slot) + '" alt="" loading="lazy" />'
          : '<div style="width:120px;aspect-ratio:4/3;display:grid;place-items:center;background:#f0eeec;color:#6b6568;font-size:.72rem;text-align:center">Sem foto</div>') +
        '<div class="slot-card__meta">' +
          '<strong>Foto ' + slot + '</strong>' +
          'Ficheiro: ' + modelId + '-' + slot + '.png' +
          (isCover ? '<span class="badge">Capa do catálogo</span>' : '') +
          (index === 0 ? '<span class="badge">Abre na página do modelo</span>' : '') +
          (!hasPhoto ? '<span class="badge">Carregue em Modelos e fotos</span>' : '') +
        '</div>' +
        '<div class="slot-actions">' +
          '<button type="button" class="btn btn--outline" data-move-up="' + index + '"' + (index === 0 ? ' disabled' : '') + '>Subir</button>' +
          '<button type="button" class="btn btn--outline" data-move-down="' + index + '"' + (index === galleryOrder.length - 1 ? ' disabled' : '') + '>Descer</button>' +
          '<button type="button" class="btn btn--outline" data-swap="' + slot + '">Trocar com…</button>' +
        '</div>' +
      '</article>';
    }).join('');

    slotsEl.querySelectorAll('[data-move-up]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var i = Number(btn.getAttribute('data-move-up'));
        var tmp = galleryOrder[i - 1];
        galleryOrder[i - 1] = galleryOrder[i];
        galleryOrder[i] = tmp;
        renderSlots();
      });
    });

    slotsEl.querySelectorAll('[data-move-down]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var i = Number(btn.getAttribute('data-move-down'));
        var tmp = galleryOrder[i + 1];
        galleryOrder[i + 1] = galleryOrder[i];
        galleryOrder[i] = tmp;
        renderSlots();
      });
    });

    slotsEl.querySelectorAll('[data-swap]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var slotA = Number(btn.getAttribute('data-swap'));
        var slotB = prompt('Trocar foto ' + slotA + ' com qual slot? (número)');
        if (!slotB) return;
        slotB = Number(slotB);
        if (slotB < 1 || slotB > getPhotoCount() || slotB === slotA) {
          setStatus('Slot inválido.');
          return;
        }
        swapSlots(slotA, slotB);
      });
    });
  }

  function loadModel(modelId) {
    current = models.find(function (m) { return m.id === modelId; }) || null;
    if (!current) return;
    photoCountEl.value = String(current.photoCount || 2);
    galleryOrder = (current.photoOrder || []).slice();
    normalizeOrder(getPhotoCount());
    catalogSlotEl.value = String(current.catalogSlot || 1);
    renderSlots();
  }

  function swapSlots(slotA, slotB) {
    setStatus('A trocar fotos…');
    cmsApi('model-photos.php', {
      method: 'POST',
      body: { action: 'swap', modelId: modelSelect.value, slotA: slotA, slotB: slotB },
    }).then(function (data) {
      applyCacheVersion(data.cacheVersion);
      return refreshModels().then(function () {
        loadModel(modelSelect.value);
        setStatus(data.message || 'Fotos trocadas.');
      });
    }).catch(function (err) {
      setStatus(err.error || 'Erro ao trocar fotos.');
    });
  }

  function refreshModels() {
    return cmsApi('model-photos.php').then(function (data) {
      models = data.models || [];
      modelSelect.innerHTML = models.map(function (m) {
        return '<option value="' + m.id + '">' + m.name + '</option>';
      }).join('');
    });
  }

  function saveSettings() {
    var modelId = modelSelect.value;
    setStatus('A publicar…');
    cmsApi('model-photos.php', {
      method: 'POST',
      body: {
        modelId: modelId,
        photoCount: getPhotoCount(),
        catalogSlot: Number(catalogSlotEl.value),
        photoOrder: galleryOrder,
        rebuild: true,
      },
    }).then(function (data) {
      applyCacheVersion(data.cacheVersion);
      return refreshModels().then(function () {
        loadModel(modelId);
        setStatus((data.message || 'Publicado.') + ' Actualize o catálogo (Ctrl+F5).');
      });
    }).catch(function (err) {
      setStatus(err.error || 'Erro ao publicar.');
    });
  }

  photoCountEl.addEventListener('change', function () {
    normalizeOrder(getPhotoCount());
    renderSlots();
  });

  catalogSlotEl.addEventListener('change', renderSlots);
  modelSelect.addEventListener('change', function () { loadModel(modelSelect.value); });
  document.getElementById('save-btn').addEventListener('click', saveSettings);

  cmsApi('me.php').then(function (auth) {
    if (!auth.authenticated) {
      setStatus('Inicie sessão no CMS para guardar alterações.');
    }
    return refreshModels();
  }).then(function () {
    if (models.length) loadModel(models[0].id);
  }).catch(function () {
    setStatus('Abra via CMS (ABRIR-CMS.bat) com sessão iniciada.');
  });
})();
