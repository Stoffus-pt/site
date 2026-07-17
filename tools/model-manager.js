(function () {
  if (/[?&]cms=1/.test(location.search)) document.body.classList.add('is-embedded');

  var modelListEl = document.getElementById('model-list');
  var editorEl = document.getElementById('editor');
  var statusEl = document.getElementById('status');
  var newModelBtn = document.getElementById('new-model-btn');

  var types = {};
  var models = [];
  var selectedId = null;
  var isCreating = false;

  function setStatus(msg) {
    statusEl.textContent = msg || '';
  }

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
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

  function uploadPhoto(modelId, slot, file) {
    var fd = new FormData();
    fd.append('modelId', modelId);
    fd.append('slot', String(slot));
    fd.append('photo', file);
    return fetch('/cms/api/photo-upload.php', {
      method: 'POST',
      body: fd,
      credentials: 'same-origin',
    }).then(function (res) {
      return res.text().then(function (text) {
        var data = {};
        if (text) {
          try { data = JSON.parse(text); } catch (e) { throw { error: 'Resposta inválida no upload.' }; }
        }
        if (!res.ok) throw data;
        return data;
      });
    });
  }

  function applyCacheVersion(version) {
    if (version) window.__PHOTO_CARD_V = version;
  }

  function isImageFile(file) {
    if (!file) return false;
    if (/^image\/(png|jpe?g|webp)$/i.test(file.type || '')) return true;
    return /\.(png|jpe?g|webp)$/i.test(file.name || '');
  }

  function publishFile(model, slot, file) {
    if (!isImageFile(file)) {
      setStatus('Formato não suportado. Use PNG, JPG ou WebP.');
      return Promise.reject();
    }
    setStatus('A carregar foto ' + slot + '…');
    return uploadPhoto(model.id, slot, file).then(function (data) {
      applyCacheVersion(data.cacheVersion);
      setStatus(data.message || 'Foto ' + slot + ' publicada.');
      return data;
    }).catch(function (err) {
      var detail = err.output ? '\n' + err.output : '';
      setStatus((err.error || 'Erro no upload.') + detail);
      throw err;
    });
  }

  function publishManyFiles(model, files) {
    var count = Math.max(1, Number(model.photoCount) || 1);
    var queue = files.filter(isImageFile).slice(0, count);
    if (!queue.length) {
      setStatus('Nenhuma imagem válida. Use PNG, JPG ou WebP.');
      return Promise.resolve();
    }

    var chain = Promise.resolve();
    queue.forEach(function (file, index) {
      var slot = index + 1;
      chain = chain.then(function () {
        setStatus('A carregar foto ' + slot + ' de ' + queue.length + '…');
        return uploadPhoto(model.id, slot, file).then(function (data) {
          applyCacheVersion(data.cacheVersion);
        });
      });
    });

    return chain.then(function () {
      setStatus(queue.length + ' foto(s) publicada(s).');
      return refreshModels(true);
    }).catch(function (err) {
      var detail = err.output ? '\n' + err.output : '';
      setStatus((err.error || 'Erro no upload.') + detail);
      return refreshModels(true);
    });
  }

  function firstOpenSlot(model) {
    var count = Math.max(1, Number(model.photoCount) || 1);
    var slots = model.slots || [];
    for (var s = 1; s <= count; s++) {
      var info = slots.find(function (item) { return item.slot === s; });
      if (!info || !info.exists) return s;
    }
    return 1;
  }

  function bindDropTarget(el, onDrop) {
    if (!el) return;

    function clearDrag() {
      el.classList.remove('is-dragover');
    }

    el.addEventListener('dragenter', function (e) {
      e.preventDefault();
      e.stopPropagation();
      el.classList.add('is-dragover');
    });

    el.addEventListener('dragover', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      el.classList.add('is-dragover');
    });

    el.addEventListener('dragleave', function (e) {
      e.preventDefault();
      if (e.relatedTarget && el.contains(e.relatedTarget)) return;
      clearDrag();
    });

    el.addEventListener('drop', function (e) {
      e.preventDefault();
      e.stopPropagation();
      clearDrag();
      var files = e.dataTransfer ? Array.prototype.slice.call(e.dataTransfer.files || []) : [];
      onDrop(files);
    });
  }

  function refreshModels(keepSelection) {
    return cmsApi('models.php').then(function (data) {
      types = data.types || {};
      models = data.models || [];
      renderModelList();
      if (keepSelection && selectedId) {
        var still = models.find(function (m) { return m.id === selectedId; });
        if (still) {
          renderEditor(still);
          return;
        }
      }
      if (isCreating) {
        renderCreateForm();
      } else if (models.length && !selectedId) {
        selectModel(models[0].id);
      } else if (selectedId) {
        var current = models.find(function (m) { return m.id === selectedId; });
        if (current) renderEditor(current);
        else {
          selectedId = null;
          editorEl.innerHTML = '<p class="empty-state">Seleccione um modelo ou crie um novo.</p>';
        }
      }
    });
  }

  function renderModelList() {
    modelListEl.innerHTML = models.map(function (m) {
      return '<button type="button" class="model-item' + (m.id === selectedId && !isCreating ? ' is-active' : '') + '" data-id="' + esc(m.id) + '">' +
        esc(m.name) +
        '<small>' + esc(m.type) + (m.photo ? ' · ' + (m.photoCount || 1) + ' foto(s)' : ' · ícone') + '</small>' +
      '</button>';
    }).join('');

    modelListEl.querySelectorAll('.model-item').forEach(function (btn) {
      btn.addEventListener('click', function () {
        isCreating = false;
        selectModel(btn.getAttribute('data-id'));
      });
    });
  }

  function selectModel(id) {
    selectedId = id;
    isCreating = false;
    var model = models.find(function (m) { return m.id === id; });
    if (!model) return;
    renderModelList();
    renderEditor(model);
  }

  function typeOptions(selected) {
    return Object.keys(types).map(function (key) {
      return '<option value="' + esc(key) + '"' + (key === selected ? ' selected' : '') + '>' + esc(types[key]) + '</option>';
    }).join('');
  }

  function photoUrl(modelId, slot) {
    return '../assets/photos/models/' + modelId + '-' + slot + '.png?v=' + Date.now();
  }

  function renderPhotoSlots(model) {
    if (!model.photo) {
      return '<p class="hint">Este modelo usa ícone em vez de fotos. Active «Usa fotografias» para carregar imagens.</p>';
    }

    var count = Math.max(1, Number(model.photoCount) || 1);
    var slots = model.slots || [];
    var html = '<div class="photos-dropzone" id="photos-dropzone">' +
      '<p class="photos-dropzone__label"><strong>Arraste imagens para aqui</strong> — uma foto cai no slot respectivo; várias fotos preenchem os slots 1, 2, 3…</p>' +
      '<div class="slots">';

    for (var slot = 1; slot <= count; slot++) {
      var info = slots.find(function (s) { return s.slot === slot; }) || { slot: slot, exists: false };
      var isCover = slot === (Number(model.catalogSlot) || 1);
      html += '<article class="slot-card' + (info.exists ? '' : ' is-empty') + '" data-drop-slot="' + slot + '">';
      if (info.exists) {
        html += '<img src="' + photoUrl(model.id, slot) + '" alt="" loading="lazy" />';
      } else {
        html += '<div class="slot-placeholder">Largar aqui</div>';
      }
      html += '<div class="slot-card__meta"><strong>Foto ' + slot + '</strong>' +
        esc(model.id) + '-' + slot + '.png' +
        (isCover ? '<span class="badge">Capa do catálogo</span>' : '') +
        '<span class="hint">Arraste ou clique em Carregar</span>' +
      '</div>' +
      '<div class="slot-actions">' +
        '<label class="btn btn--outline"><input type="file" accept="image/png,image/jpeg,image/webp" data-upload="' + slot + '" />Carregar</label>' +
        (info.exists ? '<button type="button" class="btn btn--danger" data-delete="' + slot + '">Eliminar</button>' : '') +
      '</div></article>';
    }

    html += '</div></div>';
    html += '<p class="hint">PNG «sem fundo» com preto sólido: transparência automática. Capa do catálogo em «Capa e galeria».</p>';
    return html;
  }

  function renderEditor(model) {
    editorEl.innerHTML =
      '<div class="panel">' +
        '<h2>' + esc(model.name) + '</h2>' +
        '<form id="model-form">' +
          '<div class="grid2">' +
            '<label>ID (URL)<input type="text" name="id" value="' + esc(model.id) + '" readonly /></label>' +
            '<label>Nome<input type="text" name="name" value="' + esc(model.name) + '" required /></label>' +
          '</div>' +
          '<div class="grid2">' +
            '<label>Tipo<select name="type">' + typeOptions(model.type) + '</select></label>' +
            '<label>Etiqueta (tag)<input type="text" name="tag" value="' + esc(model.tag) + '" placeholder="Puff · Cilíndrico" /></label>' +
          '</div>' +
          '<label>Descrição<textarea name="description">' + esc(model.description) + '</textarea></label>' +
          '<label>Medidas (uma por linha: Etiqueta | Valor)<textarea name="measurements" rows="4" placeholder="Largura | a partir de 220 cm">' + esc(measurementsToText(model.measurements)) + '</textarea></label>' +
          '<label>Opções (uma por linha)<textarea name="options" rows="4" placeholder="Movimento pendular">' + esc((model.options || []).join('\n')) + '</textarea></label>' +
          '<div class="grid2">' +
            '<label>Também gosta de (IDs separados por vírgula)<input type="text" name="related" value="' + esc((model.related || []).join(', ')) + '" placeholder="altieri, oasis, syros" /></label>' +
            '<label>PDF do modelo (caminho)<input type="text" name="pdf" value="' + esc(model.pdf || '') + '" placeholder="assets/pdfs/magnum.pdf" /></label>' +
          '</div>' +
          '<div class="checks">' +
            '<label><input type="checkbox" name="photo"' + (model.photo ? ' checked' : '') + ' /> Usa fotografias</label>' +
            '<label><input type="checkbox" name="novidade"' + (model.novidade ? ' checked' : '') + ' /> Novidade</label>' +
            '<label><input type="checkbox" name="configurator"' + (model.configurator !== false ? ' checked' : '') + ' /> Configurador 3D</label>' +
            '<label><input type="checkbox" name="photoCutout"' + (model.photoCutout ? ' checked' : '') + ' /> Capa recortada (sem fundo)</label>' +
          '</div>' +
          '<div class="grid2">' +
            '<label>N.º de fotos<input type="number" name="photoCount" min="1" max="6" value="' + esc(model.photoCount || 1) + '"' + (model.photo ? '' : ' disabled') + ' /></label>' +
            '<label>Slot da capa<input type="number" name="catalogSlot" min="1" max="6" value="' + esc(model.catalogSlot || 1) + '"' + (model.photo ? '' : ' disabled') + ' /></label>' +
          '</div>' +
          '<div class="row">' +
            '<button type="submit" class="btn btn--brand">Guardar modelo</button>' +
            '<button type="button" class="btn btn--danger" id="delete-model-btn">Apagar modelo</button>' +
            '<a class="btn btn--outline" href="../modelo.html?id=' + esc(model.id) + '" target="_blank">Ver página</a>' +
          '</div>' +
        '</form>' +
      '</div>' +
      '<div class="panel"><h2>Fotografias</h2>' + renderPhotoSlots(model) + '</div>';

    bindEditor(model);
  }

  function renderCreateForm() {
    isCreating = true;
    selectedId = null;
    renderModelList();

    editorEl.innerHTML =
      '<div class="panel">' +
        '<h2>Novo modelo</h2>' +
        '<form id="model-form">' +
          '<div class="grid2">' +
            '<label>ID (URL)<input type="text" name="id" placeholder="ex: yan" pattern="[a-z0-9\\-]+" required /><span class="hint">Minúsculas, números e hífen. Usado em modelo.html?id=…</span></label>' +
            '<label>Nome<input type="text" name="name" placeholder="Yan" required /></label>' +
          '</div>' +
          '<div class="grid2">' +
            '<label>Tipo<select name="type">' + typeOptions('pouf') + '</select></label>' +
            '<label>Etiqueta (tag)<input type="text" name="tag" placeholder="Puff · Cilíndrico" /></label>' +
          '</div>' +
          '<label>Descrição<textarea name="description" placeholder="Texto curto para a página do modelo."></textarea></label>' +
          '<label>Medidas (Etiqueta | Valor)<textarea name="measurements" rows="3" placeholder="Largura | a partir de 220 cm"></textarea></label>' +
          '<label>Opções (uma por linha)<textarea name="options" rows="3"></textarea></label>' +
          '<div class="grid2">' +
            '<label>Também gosta de (IDs)<input type="text" name="related" placeholder="altieri, oasis" /></label>' +
            '<label>PDF do modelo<input type="text" name="pdf" placeholder="assets/pdfs/modelo.pdf" /></label>' +
          '</div>' +
          '<div class="checks">' +
            '<label><input type="checkbox" name="photo" checked /> Usa fotografias</label>' +
            '<label><input type="checkbox" name="novidade" /> Novidade</label>' +
            '<label><input type="checkbox" name="configurator" checked /> Configurador 3D</label>' +
            '<label><input type="checkbox" name="photoCutout" /> Capa recortada (sem fundo)</label>' +
          '</div>' +
          '<div class="grid2">' +
            '<label>N.º de fotos<input type="number" name="photoCount" min="1" max="6" value="1" /></label>' +
            '<label>Slot da capa<input type="number" name="catalogSlot" min="1" max="6" value="1" /></label>' +
          '</div>' +
          '<button type="submit" class="btn btn--brand">Criar modelo</button>' +
        '</form>' +
        '<p class="hint">Depois de criar, carregue as fotos na secção abaixo (aparece ao seleccionar o modelo).</p>' +
      '</div>';

    bindCreateForm();
  }

  function measurementsToText(rows) {
    if (!Array.isArray(rows) || !rows.length) return '';
    return rows.map(function (row) {
      return String((row && row.label) || '').trim() + ' | ' + String((row && row.value) || '').trim();
    }).join('\n');
  }

  function parseMeasurements(text) {
    return String(text || '').split(/\r\n|\r|\n/).map(function (line) {
      line = line.trim();
      if (!line) return null;
      var parts = line.split('|');
      if (parts.length === 1) parts = line.split(/\t|:|;/);
      return {
        label: String(parts[0] || '').trim(),
        value: String(parts.slice(1).join('|') || '').trim(),
      };
    }).filter(function (row) {
      return row && (row.label || row.value);
    });
  }

  function formPayload(form) {
    var fd = new FormData(form);
    return {
      id: String(fd.get('id') || '').trim().toLowerCase(),
      name: String(fd.get('name') || '').trim(),
      type: String(fd.get('type') || 'relax'),
      tag: String(fd.get('tag') || '').trim(),
      description: String(fd.get('description') || '').trim(),
      measurements: parseMeasurements(fd.get('measurements')),
      options: String(fd.get('options') || '').split(/\r\n|\r|\n/).map(function (s) { return s.trim(); }).filter(Boolean),
      related: String(fd.get('related') || '').split(/[\s,;]+/).map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean),
      pdf: String(fd.get('pdf') || '').trim(),
      photo: !!form.querySelector('[name=photo]').checked,
      novidade: !!form.querySelector('[name=novidade]').checked,
      configurator: !!form.querySelector('[name=configurator]').checked,
      photoCutout: !!form.querySelector('[name=photoCutout]').checked,
      photoCount: Number(fd.get('photoCount')) || 1,
      catalogSlot: Number(fd.get('catalogSlot')) || 1,
    };
  }

  function bindCreateForm() {
    var form = document.getElementById('model-form');
    var photoCheck = form.querySelector('[name=photo]');
    photoCheck.addEventListener('change', function () {
      var on = photoCheck.checked;
      form.querySelector('[name=photoCount]').disabled = !on;
      form.querySelector('[name=catalogSlot]').disabled = !on;
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var payload = formPayload(form);
      setStatus('A criar modelo…');
      cmsApi('models.php', { method: 'POST', body: Object.assign({ action: 'create' }, payload) })
        .then(function (data) {
          isCreating = false;
          selectedId = payload.id;
          setStatus(data.message || 'Modelo criado.');
          return refreshModels(true);
        })
        .catch(function (err) {
          setStatus(err.error || 'Erro ao criar modelo.');
        });
    });
  }

  function bindEditor(model) {
    var form = document.getElementById('model-form');
    var photoCheck = form.querySelector('[name=photo]');
    photoCheck.addEventListener('change', function () {
      var on = photoCheck.checked;
      form.querySelector('[name=photoCount]').disabled = !on;
      form.querySelector('[name=catalogSlot]').disabled = !on;
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var payload = formPayload(form);
      setStatus('A guardar…');
      cmsApi('models.php', {
        method: 'POST',
        body: {
          action: 'update',
          modelId: model.id,
          name: payload.name,
          type: payload.type,
          tag: payload.tag,
          description: payload.description,
          measurements: payload.measurements,
          options: payload.options,
          related: payload.related,
          pdf: payload.pdf,
          photo: payload.photo,
          novidade: payload.novidade,
          configurator: payload.configurator,
          photoCutout: payload.photoCutout,
          photoCount: payload.photoCount,
          catalogSlot: payload.catalogSlot,
        },
      }).then(function (data) {
        setStatus(data.message || 'Modelo guardado.');
        return refreshModels(true);
      }).catch(function (err) {
        setStatus(err.error || 'Erro ao guardar.');
      });
    });

    var deleteBtn = document.getElementById('delete-model-btn');
    deleteBtn.addEventListener('click', function () {
      if (!confirm('Apagar «' + model.name + '» do catálogo?\n\nOpcionalmente elimina também os ficheiros de foto.')) return;
      var deletePhotos = confirm('Eliminar também os ficheiros de foto deste modelo?');
      setStatus('A apagar…');
      cmsApi('models.php', {
        method: 'POST',
        body: { action: 'delete', modelId: model.id, deletePhotos: deletePhotos },
      }).then(function (data) {
        selectedId = null;
        setStatus(data.message || 'Modelo apagado.');
        return refreshModels(false);
      }).catch(function (err) {
        setStatus(err.error || 'Erro ao apagar.');
      });
    });

    editorEl.querySelectorAll('[data-upload]').forEach(function (input) {
      input.addEventListener('change', function () {
        var file = input.files && input.files[0];
        if (!file) return;
        var slot = Number(input.getAttribute('data-upload'));
        publishFile(model, slot, file).then(function () {
          return refreshModels(true);
        }).catch(function () {});
        input.value = '';
      });
    });

    bindDropTarget(document.getElementById('photos-dropzone'), function (files) {
      if (files.length === 1) {
        var slot = firstOpenSlot(model);
        publishFile(model, slot, files[0]).then(function () {
          return refreshModels(true);
        }).catch(function () {});
        return;
      }
      publishManyFiles(model, files);
    });

    editorEl.querySelectorAll('[data-drop-slot]').forEach(function (card) {
      var slot = Number(card.getAttribute('data-drop-slot'));
      bindDropTarget(card, function (files) {
        if (!files.length) return;
        card.classList.add('is-uploading');
        publishFile(model, slot, files[0]).then(function () {
          return refreshModels(true);
        }).catch(function () {}).then(function () {
          card.classList.remove('is-uploading');
        });
      });
    });

    editorEl.querySelectorAll('[data-delete]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var slot = Number(btn.getAttribute('data-delete'));
        if (!confirm('Eliminar foto ' + slot + ' de «' + model.name + '»?')) return;
        setStatus('A eliminar foto…');
        cmsApi('model-photos.php', {
          method: 'POST',
          body: { action: 'delete', modelId: model.id, slot: slot },
        }).then(function (data) {
          applyCacheVersion(data.cacheVersion);
          setStatus(data.message || 'Foto eliminada.');
          return refreshModels(true);
        }).catch(function (err) {
          setStatus(err.error || 'Erro ao eliminar.');
        });
      });
    });
  }

  newModelBtn.addEventListener('click', renderCreateForm);

  cmsApi('me.php').then(function (auth) {
    if (!auth.authenticated) {
      setStatus('Inicie sessão no CMS para guardar alterações.');
    }
    return refreshModels(false);
  }).catch(function () {
    setStatus('Abra via CMS (ABRIR-CMS.bat) com sessão iniciada.');
    refreshModels(false);
  });
})();
