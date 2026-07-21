(function () {
  if (/[?&]cms=1/.test(location.search)) document.body.classList.add('is-embedded');

  var listEl = document.getElementById('list');
  var statusEl = document.getElementById('status');
  var filterQ = document.getElementById('filter-q');
  var filterGama = document.getElementById('filter-gama');
  var filterShow = document.getElementById('filter-show');
  var collections = [];
  var textureBase = 'https://stoffus.pt/Studio3D/assets/textures/';

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

  function filtered() {
    var q = String(filterQ.value || '').trim().toLowerCase();
    var gama = filterGama.value;
    var show = filterShow.value;
    return collections.filter(function (col) {
      if (gama && col.gama !== gama) return false;
      if (show === '1' && !col.show) return false;
      if (show === '0' && col.show) return false;
      if (!q) return true;
      return (col.name + ' ' + col.id + ' ' + col.prefix).toLowerCase().indexOf(q) !== -1;
    });
  }

  function render() {
    var items = filtered();
    listEl.innerHTML = items.map(function (col) {
      return (
        '<article class="card" data-id="' + esc(col.id) + '">' +
          '<img src="' + esc(thumbUrl(col)) + '" alt="" loading="lazy" decoding="async" />' +
          '<div>' +
            '<h3>' + esc(col.name) +
              (col.show ? '' : ' <span class="badge badge--off">Oculta</span>') +
              (col.hasOverride ? ' <span class="badge">Override</span>' : '') +
            '</h3>' +
            '<p class="meta">' + esc(col.gamaLabel || col.gama) + ' · ' + esc(col.prefix) + col.start + '–' + esc(col.prefix) + col.end +
              ' · ' + esc(col.colorCount) + ' cores</p>' +
            '<label class="checks"><input type="checkbox" name="show"' + (col.show ? ' checked' : '') + ' /> Visível no site</label>' +
            '<label>Capa (caminho relativo)<input type="text" name="cover" value="' + esc(col.cover || '') + '" placeholder="assets/photos/tecidos/' + esc(col.id) + '.jpg" /></label>' +
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
    return cmsApi('fabrics.php?action=list').then(function (data) {
      collections = data.collections || [];
      fillGamaFilter(collections);
      render();
      var meta = data.meta || {};
      setStatus((meta.collectionCount || collections.length) + ' colecções · sync ' + (meta.syncedAt || '—'), 'ok');
    }).catch(function (err) {
      setStatus(err.error || 'Erro ao carregar tecidos.', 'err');
    });
  }

  function cardPayload(card) {
    return {
      id: card.getAttribute('data-id'),
      show: !!card.querySelector('[name=show]').checked,
      cover: card.querySelector('[name=cover]').value,
      description: '',
      specs: {
        composicao: card.querySelector('[name=composicao]').value,
        largura: card.querySelector('[name=largura]').value,
        peso: card.querySelector('[name=peso]').value,
        abrasao: card.querySelector('[name=abrasao]').value,
        borboto: card.querySelector('[name=borboto]').value,
      },
    };
  }

  function saveOne(card) {
    var payload = Object.assign({ action: 'update' }, cardPayload(card));
    var id = payload.id;
    setStatus('A guardar ' + id + '…');
    return cmsApi('fabrics.php', { method: 'POST', body: payload }).then(function (data) {
      var idx = collections.findIndex(function (c) { return c.id === id; });
      if (idx >= 0 && data.collection) collections[idx] = data.collection;
      render();
      setStatus(data.message || 'Guardado.', data.synced ? 'ok' : '');
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
      body: { action: 'update_all', items: items },
    }).then(function (data) {
      if (data.collections) collections = data.collections;
      fillGamaFilter(collections);
      render();
      setStatus(data.message || (items.length + ' colecções guardadas.'), data.synced ? 'ok' : '');
    }).catch(function (err) {
      setStatus(err.error || 'Erro ao guardar todos.', 'err');
    });
  }

  listEl.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-save]');
    if (!btn) return;
    var card = btn.closest('[data-id]');
    if (!card) return;
    saveOne(card);
  });

  document.getElementById('btn-save-all').addEventListener('click', saveAll);
  document.getElementById('btn-save-all-bottom').addEventListener('click', saveAll);

  document.getElementById('btn-reload').addEventListener('click', load);
  document.getElementById('btn-sync').addEventListener('click', function () {
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

  [filterQ, filterGama, filterShow].forEach(function (el) {
    el.addEventListener('input', render);
    el.addEventListener('change', render);
  });

  load();
})();
