(function () {
  if (/[?&]cms=1/.test(location.search)) document.body.classList.add('is-embedded');

  var listEl = document.getElementById('list');
  var statusEl = document.getElementById('status');
  var modeNoteEl = document.getElementById('mode-note');
  var filterQ = document.getElementById('filter-q');
  var filterGama = document.getElementById('filter-gama');
  var filterShow = document.getElementById('filter-show');
  var filterNew = document.getElementById('filter-new');
  var collections = [];
  var mode = 'active';
  var textureBase = 'https://stoffus.pt/Studio3D/assets/textures/';

  var TRAITS = [
    { id: 'easyClean', label: 'Easy Clean' },
    { id: 'antibacterial', label: 'Antibacteriano' },
    { id: 'petFriendly', label: 'Pet Friendly' },
  ];

  function isDraft() {
    return mode === 'draft';
  }

  function setStatus(msg, type) {
    statusEl.textContent = msg || '';
    statusEl.className = 'status' + (type ? ' is-' + type : '');
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

  function thumbUrl(col) {
    if (col.cover) return '../' + col.cover.replace(/^\//, '');
    var folder = col.name === 'Kamala 2' ? 'Kamala2' : col.name;
    return textureBase + encodeURIComponent(folder + ' 1.jpg');
  }

  function fillGamaFilter(items) {
    var seen = {};
    var options = ['<option value="">Todas as gamas</option>'];
    items.forEach(function (col) {
      if (!col.gama || seen[col.gama]) return;
      seen[col.gama] = true;
      options.push('<option value="' + esc(col.gama) + '">' + esc(col.gamaLabel || col.gama) + '</option>');
    });
    filterGama.innerHTML = options.join('');
  }

  function updateModeUi() {
    document.body.classList.toggle('is-draft', isDraft());
    document.body.classList.toggle('is-active', !isDraft());
    filterNew.hidden = !isDraft();
    document.querySelectorAll('.tab').forEach(function (tab) {
      var on = tab.getAttribute('data-mode') === mode;
      tab.classList.toggle('is-active', on);
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    if (isDraft()) {
      modeNoteEl.textContent =
        'Rascunho da colecção 2026: edita specs e traits sem afectar o site público. Quando activares a colecção, estes dados serão importados.';
      document.getElementById('status-hint').textContent =
        'Grava no ficheiro de rascunho — o catálogo activo não muda.';
    } else {
      modeNoteEl.textContent =
        'Colecções activas no site: visibilidade, capa e características técnicas. O sync regenera fabrics.json quando o Node estiver disponível.';
      document.getElementById('status-hint').textContent =
        'Preenche os campos e grava tudo de uma vez.';
    }
  }

  function filtered() {
    var q = String(filterQ.value || '').trim().toLowerCase();
    var gama = filterGama.value;
    var show = filterShow.value;
    var neu = filterNew.value;
    return collections.filter(function (col) {
      if (gama && col.gama !== gama) return false;
      if (show === '1' && !col.show) return false;
      if (show === '0' && col.show) return false;
      if (isDraft() && neu === '1' && !col.isNew) return false;
      if (isDraft() && neu === '0' && col.isNew) return false;
      if (!q) return true;
      return (col.name + ' ' + col.id + ' ' + col.prefix).toLowerCase().indexOf(q) !== -1;
    });
  }

  function traitsHtml(col) {
    var selected = col.traits || [];
    return (
      '<div class="traits field-traits">' +
      TRAITS.map(function (t) {
        var on = selected.indexOf(t.id) >= 0;
        return (
          '<label class="checks">' +
            '<input type="checkbox" name="trait-' + esc(t.id) + '"' + (on ? ' checked' : '') + ' /> ' +
            esc(t.label) +
          '</label>'
        );
      }).join('') +
      '</div>'
    );
  }

  function render() {
    var items = filtered();
    listEl.innerHTML = items.map(function (col) {
      var range = '';
      if (col.start || col.end) {
        range = ' · ' + esc(col.prefix) + col.start + '–' + esc(col.prefix) + col.end;
      }
      var colors = col.colorCount ? ' · ' + esc(col.colorCount) + ' cores' : '';
      var pdf = isDraft() && col.sourcePdf ? ' · ' + esc(col.sourcePdf) : '';
      return (
        '<article class="card" data-id="' + esc(col.id) + '">' +
          '<img src="' + esc(thumbUrl(col)) + '" alt="" loading="lazy" decoding="async" />' +
          '<div>' +
            '<h3>' + esc(col.name) +
              (col.show ? '' : ' <span class="badge badge--off">Oculta</span>') +
              (col.hasOverride ? ' <span class="badge">Override</span>' : '') +
              (isDraft() && col.isNew ? ' <span class="badge badge--new">Nova</span>' : '') +
            '</h3>' +
            '<p class="meta">' + esc(col.gamaLabel || col.gama || '—') +
              (col.prefix ? ' · ' + esc(col.prefix) : '') +
              range + colors + pdf + '</p>' +
            '<label class="checks"><input type="checkbox" name="show"' + (col.show ? ' checked' : '') + ' /> ' +
              (isDraft() ? 'Incluir na colecção 2026' : 'Visível no site') + '</label>' +
            '<label class="field-cover">Capa (caminho relativo)<input type="text" name="cover" value="' +
              esc(col.cover || '') + '" placeholder="assets/photos/tecidos/' + esc(col.id) + '.jpg" /></label>' +
            traitsHtml(col) +
            '<div class="specs">' +
              '<label>Composição<input type="text" name="composicao" value="' + esc((col.specs && col.specs.composicao) || '') + '" placeholder="ex.: 100% poliéster" /></label>' +
              '<label>Largura<input type="text" name="largura" value="' + esc((col.specs && col.specs.largura) || '') + '" placeholder="ex.: 140 cm" /></label>' +
              '<label>Peso<input type="text" name="peso" value="' + esc((col.specs && col.specs.peso) || '') + '" placeholder="ex.: 320 g/m²" /></label>' +
              '<label>Abrasão<input type="text" name="abrasao" value="' + esc((col.specs && col.specs.abrasao) || '') + '" placeholder="ex.: 40.000 ciclos Martindale" /></label>' +
              '<label>Borboto<input type="text" name="borboto" value="' + esc((col.specs && col.specs.borboto) || '') + '" placeholder="ex.: 4.0" /></label>' +
            '</div>' +
          '</div>' +
          '<div class="actions">' +
            '<button type="button" class="btn btn--brand" data-save>Guardar</button>' +
          '</div>' +
        '</article>'
      );
    }).join('') || '<p class="status">Nenhuma colecção com estes filtros.</p>';
  }

  function load() {
    setStatus('A carregar…');
    var action = isDraft() ? 'draft_list' : 'list';
    return cmsApi('fabrics.php?action=' + action).then(function (data) {
      collections = data.collections || [];
      fillGamaFilter(collections);
      render();
      var meta = data.meta || {};
      if (isDraft()) {
        var neu = collections.filter(function (c) { return c.isNew; }).length;
        setStatus(
          (meta.collectionCount || collections.length) + ' no rascunho · ' + neu + ' novas' +
            (data.catalogDraftAvailable ? ' · códigos do catálogo 2026 disponíveis' : ''),
          'ok'
        );
      } else {
        setStatus((meta.collectionCount || collections.length) + ' colecções · sync ' + (meta.syncedAt || '—'), 'ok');
      }
    }).catch(function (err) {
      setStatus(err.error || 'Erro ao carregar tecidos.', 'err');
    });
  }

  function cardPayload(card) {
    var payload = {
      id: card.getAttribute('data-id'),
      show: !!card.querySelector('[name=show]').checked,
      specs: {
        composicao: card.querySelector('[name=composicao]').value,
        largura: card.querySelector('[name=largura]').value,
        peso: card.querySelector('[name=peso]').value,
        abrasao: card.querySelector('[name=abrasao]').value,
        borboto: card.querySelector('[name=borboto]').value,
      },
    };
    if (isDraft()) {
      payload.traits = TRAITS.filter(function (t) {
        var el = card.querySelector('[name=trait-' + t.id + ']');
        return el && el.checked;
      }).map(function (t) { return t.id; });
    } else {
      var coverEl = card.querySelector('[name=cover]');
      payload.cover = coverEl ? coverEl.value : '';
      payload.description = '';
    }
    return payload;
  }

  function saveOne(card) {
    var payload = Object.assign({
      action: isDraft() ? 'draft_update' : 'update',
    }, cardPayload(card));
    var id = payload.id;
    setStatus('A guardar ' + id + '…');
    return cmsApi('fabrics.php', { method: 'POST', body: payload }).then(function (data) {
      var idx = collections.findIndex(function (c) { return c.id === id; });
      if (idx >= 0 && data.collection) collections[idx] = data.collection;
      render();
      var msg = data.message || 'Guardado.';
      if (!isDraft() && payload.show === false) msg = 'Oculto no site. ' + msg;
      setStatus(msg, isDraft() || data.synced ? 'ok' : '');
    }).catch(function (err) {
      setStatus(err.error || 'Erro ao guardar.', 'err');
    });
  }

  function saveAll() {
    var cards = Array.prototype.slice.call(listEl.querySelectorAll('.card[data-id]'));
    if (!cards.length) {
      setStatus('Não há colecções visíveis para guardar.', 'err');
      return;
    }
    var items = cards.map(cardPayload);
    setStatus('A guardar ' + items.length + ' colecções…');
    cmsApi('fabrics.php', {
      method: 'POST',
      body: {
        action: isDraft() ? 'draft_update_all' : 'update_all',
        items: items,
      },
    }).then(function (data) {
      if (data.collections) collections = data.collections;
      fillGamaFilter(collections);
      render();
      setStatus(data.message || (items.length + ' colecções guardadas.'), isDraft() || data.synced ? 'ok' : '');
    }).catch(function (err) {
      setStatus(err.error || 'Erro ao guardar todos.', 'err');
    });
  }

  function setMode(next) {
    if (next !== 'active' && next !== 'draft') return;
    if (mode === next) return;
    mode = next;
    filterNew.value = '';
    updateModeUi();
    load();
  }

  listEl.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-save]');
    if (!btn) return;
    var card = btn.closest('[data-id]');
    if (!card) return;
    saveOne(card);
  });

  listEl.addEventListener('change', function (e) {
    var input = e.target.closest('input[name=show]');
    if (!input) return;
    var card = input.closest('[data-id]');
    if (!card) return;
    saveOne(card);
  });

  document.querySelectorAll('.tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      setMode(tab.getAttribute('data-mode'));
    });
  });

  document.getElementById('btn-save-all').addEventListener('click', saveAll);
  document.getElementById('btn-save-all-bottom').addEventListener('click', saveAll);

  document.getElementById('btn-reload').addEventListener('click', load);
  document.getElementById('btn-sync').addEventListener('click', function () {
    if (isDraft()) return;
    setStatus('A sincronizar…');
    cmsApi('fabrics.php', { method: 'POST', body: { action: 'sync' } }).then(function (data) {
      collections = data.collections || collections;
      fillGamaFilter(collections);
      render();
      setStatus(data.message || 'Sincronizado.', 'ok');
    }).catch(function (err) {
      setStatus((err.error || err.message || 'Sync falhou.') + (err.output ? '\n' + err.output : ''), 'err');
    });
  });

  [filterQ, filterGama, filterShow, filterNew].forEach(function (el) {
    el.addEventListener('input', render);
    el.addEventListener('change', render);
  });

  updateModeUi();
  load();
})();
