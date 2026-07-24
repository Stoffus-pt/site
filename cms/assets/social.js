/**
 * Módulo Redes — planeamento em bulk + calendário drag-and-drop.
 * Expõe window.StoffusSocial
 */
(function (global) {
  var state = {
    posts: [],
    settings: {
      autoSplitSize: 10,
      defaultPlatforms: ['facebook', 'instagram'],
      defaultCaption: '',
    },
    meta: { configured: false, instagram_ready: false },
    pool: [],
    weekStart: null,
    selectedPostId: null,
    previewSlide: 0,
    uploading: false,
  };

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  function startOfWeek(d) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var day = x.getDay();
    var diff = day === 0 ? -6 : 1 - day;
    x.setDate(x.getDate() + diff);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function addDays(d, n) {
    var x = new Date(d.getTime());
    x.setDate(x.getDate() + n);
    return x;
  }

  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
  }

  function fmtDayLabel(d) {
    var dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return dias[d.getDay()] + ' ' + d.getDate();
  }

  function fmtWeekRange(start) {
    var end = addDays(start, 6);
    var opts = { day: 'numeric', month: 'short' };
    return start.toLocaleDateString('pt-PT', opts) + ' — ' + end.toLocaleDateString('pt-PT', opts);
  }

  function toLocalInputValue(d) {
    var pad = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function dayKey(d) {
    var pad = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function parseDayKey(key) {
    var p = String(key || '').split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 12, 0, 0, 0);
  }

  function mediaUrl(path) {
    var rel = String(path || '').replace(/^\/+/, '').replace(/\\/g, '/');
    if (!rel) return '';
    // Endpoint PHP fiável (funciona com o router local e no alojamento)
    return 'api/social-file.php?f=' + encodeURIComponent(rel);
  }

  function api(path, options) {
    return global.StoffusCmsApi(path, options);
  }

  function toast(msg) {
    global.StoffusCmsToast(msg);
  }

  function load() {
    if (!state.weekStart) state.weekStart = startOfWeek(new Date());
    return api('social.php?action=list').then(function (data) {
      state.posts = data.posts || [];
      state.settings = Object.assign({}, state.settings, data.settings || {});
      state.meta = data.meta || state.meta;
    });
  }

  function selectedPaths() {
    return state.pool.filter(function (f) { return f.selected !== false; }).map(function (f) { return f.path; });
  }

  function renderStats() {
    var scheduled = state.posts.filter(function (p) { return p.status === 'scheduled'; }).length;
    var published = state.posts.filter(function (p) { return p.status === 'published'; }).length;
    var failed = state.posts.filter(function (p) { return p.status === 'failed'; }).length;
    return '<div class="cms-stat-row">' +
      '<div class="cms-stat"><strong>' + state.pool.length + '</strong><span>Na fila</span></div>' +
      '<div class="cms-stat"><strong>' + scheduled + '</strong><span>Agendadas</span></div>' +
      '<div class="cms-stat"><strong>' + published + '</strong><span>Publicadas</span></div>' +
      '<div class="cms-stat"><strong>' + failed + '</strong><span>Falhas</span></div>' +
      '</div>';
  }

  function renderPool() {
    if (!state.pool.length) {
      return '<p class="cms-hint">Ainda sem imagens. Arraste um lote (ex.: as 40 fotos da quarta).</p>';
    }
    return '<div class="cms-media-pool">' + state.pool.map(function (f, i) {
      var src = f.url || mediaUrl(f.path);
      return '<div class="cms-media-thumb' + (f.selected === false ? '' : ' is-selected') + '" data-pool-i="' + i + '" title="' + esc(f.name) + '">' +
        '<img src="' + esc(src) + '" alt="" loading="lazy" />' +
        '<button type="button" data-pool-remove="' + i + '" aria-label="Remover">×</button>' +
        '</div>';
    }).join('') + '</div>';
  }

  function postsForDay(day) {
    return state.posts.filter(function (p) {
      if (!p.scheduledAt) return false;
      var d = new Date(p.scheduledAt);
      return sameDay(d, day);
    }).sort(function (a, b) {
      return new Date(a.scheduledAt) - new Date(b.scheduledAt);
    });
  }

  function renderCalendar() {
    var start = state.weekStart;
    var days = [];
    var today = new Date();
    for (var i = 0; i < 7; i++) {
      var day = addDays(start, i);
      var posts = postsForDay(day);
      days.push(
        '<div class="cms-cal-day' + (sameDay(day, today) ? ' is-today' : '') + '" data-cal-day="' + dayKey(day) + '">' +
        '<div class="cms-cal-day__label"><span>' + esc(fmtDayLabel(day)) + '</span><span>' + posts.length + '</span></div>' +
        posts.map(function (p) {
          var thumbs = (p.media || []).slice(0, 3).map(function (m) {
            return '<img src="' + esc(mediaUrl(m)) + '" alt="" />';
          }).join('');
          var time = new Date(p.scheduledAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
          var plats = (p.platforms || []).map(function (x) { return x === 'instagram' ? 'IG' : 'FB'; }).join('+');
          return '<div class="cms-cal-post is-' + esc(p.status || 'draft') + (state.selectedPostId === p.id ? ' is-selected' : '') + '" draggable="true" data-post-id="' + esc(p.id) + '">' +
            '<div class="cms-cal-post__thumbs">' + thumbs + '</div>' +
            '<div class="cms-cal-post__meta">' + esc(time) + ' · ' + (p.media || []).length + ' fotos · ' + esc(plats) + '</div>' +
            '</div>';
        }).join('') +
        '</div>'
      );
    }
    return days.join('');
  }

  function renderPreview(post) {
    if (!post) {
      return '<div class="cms-preview-phone cms-preview-phone--empty">' +
        '<div class="cms-preview-phone__body">' +
        '<i class="fa-regular fa-images"></i>' +
        '<p><strong>Pré-visualização</strong></p>' +
        '<p>Clique numa publicação no calendário para ver aqui como fica no feed.</p>' +
        '</div></div>';
    }

    var media = post.media || [];
    if (state.previewSlide >= media.length) state.previewSlide = 0;
    if (state.previewSlide < 0) state.previewSlide = 0;
    var slide = media[state.previewSlide];
    var plats = post.platforms || [];
    var isIg = plats.indexOf('instagram') >= 0;
    var brand = isIg ? 'stoffus' : 'Stoffus';
    var when = '';
    try {
      when = new Date(post.scheduledAt).toLocaleString('pt-PT', {
        weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      });
    } catch (e) { when = ''; }

    var dots = media.map(function (_, i) {
      return '<button type="button" class="cms-preview-dot' + (i === state.previewSlide ? ' is-active' : '') + '" data-preview-slide="' + i + '" aria-label="Foto ' + (i + 1) + '"></button>';
    }).join('');

    return '<div class="cms-preview-phone" data-preview-post="' + esc(post.id) + '">' +
      '<div class="cms-preview-phone__chrome">' +
      '<span class="cms-preview-phone__plat">' +
      (isIg ? '<i class="fa-brands fa-instagram"></i> Instagram' : '<i class="fa-brands fa-facebook"></i> Facebook') +
      '</span>' +
      '<span class="cms-preview-phone__when">' + esc(when) + '</span>' +
      '</div>' +
      '<div class="cms-preview-phone__head">' +
      '<div class="cms-preview-phone__avatar">S</div>' +
      '<div><strong>' + esc(brand) + '</strong><span>Pré-visualização</span></div>' +
      '</div>' +
      '<div class="cms-preview-phone__media">' +
      (slide
        ? '<img src="' + esc(mediaUrl(slide)) + '" alt="Pré-visualização" />'
        : '<div class="cms-preview-phone__missing">Sem imagem</div>') +
      (media.length > 1
        ? '<button type="button" class="cms-preview-nav cms-preview-nav--prev" id="cms-preview-prev" aria-label="Anterior">‹</button>' +
          '<button type="button" class="cms-preview-nav cms-preview-nav--next" id="cms-preview-next" aria-label="Seguinte">›</button>' +
          '<div class="cms-preview-counter">' + (state.previewSlide + 1) + ' / ' + media.length + '</div>'
        : '') +
      '</div>' +
      (media.length > 1 ? '<div class="cms-preview-dots">' + dots + '</div>' : '') +
      '<div class="cms-preview-phone__caption">' +
      '<strong>' + esc(brand) + '</strong> ' +
      '<span id="cms-preview-caption-live">' + esc(post.caption || 'Sem legenda') + '</span>' +
      '</div>' +
      '<div class="cms-preview-phone__foot">' +
      '<span>' + media.length + ' foto' + (media.length === 1 ? '' : 's') + '</span>' +
      '<span>' + esc((plats.map(function (p) { return p === 'instagram' ? 'IG' : 'FB'; }).join(' · ')) || '—') + '</span>' +
      '</div></div>';
  }

  function renderDrawer() {
    var post = state.posts.find(function (p) { return p.id === state.selectedPostId; });
    if (!post) {
      return '<div class="cms-post-edit">' +
        '<p class="cms-hint" style="margin:0">Seleccione um cartão no calendário para editar e pré-visualizar.</p>' +
        '</div>';
    }
    var fb = (post.platforms || []).indexOf('facebook') >= 0;
    var ig = (post.platforms || []).indexOf('instagram') >= 0;
    var local = '';
    try {
      local = toLocalInputValue(new Date(post.scheduledAt));
    } catch (e) { local = ''; }

    return '<div class="cms-post-edit" data-drawer-id="' + esc(post.id) + '">' +
      '<h2>Editar publicação</h2>' +
      '<label class="cms-field"><span>Legenda</span><textarea id="cms-social-caption" rows="4" placeholder="Escreva a legenda…">' + esc(post.caption) + '</textarea></label>' +
      '<label class="cms-field"><span>Data e hora</span><input type="datetime-local" id="cms-social-when" value="' + esc(local) + '" /></label>' +
      '<div class="cms-pill-row" style="margin-bottom:.85rem">' +
      '<label class="cms-pill"><input type="checkbox" id="cms-social-fb"' + (fb ? ' checked' : '') + ' /> Facebook</label>' +
      '<label class="cms-pill"><input type="checkbox" id="cms-social-ig"' + (ig ? ' checked' : '') + ' /> Instagram</label>' +
      '</div>' +
      '<p class="cms-hint" style="margin:0 0 .85rem">Estado: <strong>' + esc(post.status) + '</strong>' +
      (post.error ? ' — ' + esc(post.error) : '') + '</p>' +
      '<div style="display:flex;flex-wrap:wrap;gap:.45rem">' +
      '<button type="button" class="cms-btn cms-btn--brand cms-btn--sm" id="cms-social-save-post">Guardar</button>' +
      '<button type="button" class="cms-btn cms-btn--ghost cms-btn--sm" id="cms-social-publish-now">Publicar agora</button>' +
      '<button type="button" class="cms-btn cms-btn--danger cms-btn--sm" id="cms-social-delete-post">Apagar</button>' +
      '</div></div>';
  }

  function render() {
    var metaBadge = state.meta.configured
      ? '<span class="cms-meta-badge is-ok"><i class="fa-brands fa-meta"></i> Meta ligada</span>'
      : '<span class="cms-meta-badge is-warn"><i class="fa-brands fa-meta"></i> Meta por configurar</span>';

    var selected = state.posts.find(function (p) { return p.id === state.selectedPostId; }) || null;

    return '<div class="cms-social">' +
      renderStats() +
      '<div class="cms-social__grid">' +
      '<section class="cms-surface">' +
      '<div style="display:flex;justify-content:space-between;gap:.75rem;align-items:flex-start;flex-wrap:wrap">' +
      '<div><h2>Lote de fotos</h2><p class="cms-hint">Arraste e largue. Depois partimos automaticamente em posts de até 10 fotos (limite da API Instagram).</p></div>' +
      metaBadge +
      '</div>' +
      '<div class="cms-drop" id="cms-social-drop">' +
      '<input type="file" id="cms-social-file" accept="image/jpeg,image/png,image/webp" multiple />' +
      '<strong>Largar fotos aqui</strong>' +
      '<span>JPG, PNG ou WebP · até 12 MB cada</span>' +
      '</div>' +
      renderPool() +
      '<div class="cms-social-toolbar">' +
      '<label class="cms-field"><span>Fotos / post</span><input class="cms-input" type="number" id="cms-social-split" min="1" max="10" value="' + esc(state.settings.autoSplitSize) + '" /></label>' +
      '<label class="cms-field"><span>Intervalo (h)</span><input class="cms-input" type="number" id="cms-social-interval" min="1" max="72" value="24" /></label>' +
      '<label class="cms-field"><span>Início</span><input class="cms-input" type="datetime-local" id="cms-social-start" /></label>' +
      '<button type="button" class="cms-btn cms-btn--brand" id="cms-social-split-btn">Partir e agendar</button>' +
      '</div>' +
      '<label class="cms-field" style="margin-top:1rem"><span>Legenda por defeito</span><textarea id="cms-social-default-caption" rows="2">' + esc(state.settings.defaultCaption) + '</textarea></label>' +
      '<p class="cms-hint">Anúncios (€40): continue a patrocinar no Meta Ads / Boost nos posts já publicados.</p>' +
      (!state.meta.configured
        ? '<p class="cms-hint">Para publicar automaticamente, configure <code>meta</code> em <code>cms/config.php</code>. As imagens têm de estar online (não em localhost).</p>'
        : '') +
      '</section>' +
      '<section class="cms-surface">' +
      '<div class="cms-cal-head">' +
      '<div><h2>Calendário</h2><h3>' + esc(fmtWeekRange(state.weekStart)) + '</h3></div>' +
      '<div style="display:flex;gap:.4rem;flex-wrap:wrap">' +
      '<button type="button" class="cms-btn cms-btn--ghost cms-btn--sm" id="cms-social-prev">← Semana</button>' +
      '<button type="button" class="cms-btn cms-btn--ghost cms-btn--sm" id="cms-social-today">Hoje</button>' +
      '<button type="button" class="cms-btn cms-btn--ghost cms-btn--sm" id="cms-social-next">Semana →</button>' +
      '<button type="button" class="cms-btn cms-btn--brand cms-btn--sm" id="cms-social-publish-due">Publicar vencidas</button>' +
      '</div></div>' +
      '<div class="cms-cal" id="cms-social-cal">' + renderCalendar() + '</div>' +
      '</section>' +
      '<section class="cms-surface cms-surface--preview">' +
      '<h2>Pré-visualização</h2>' +
      '<p class="cms-hint">Assim fica no feed (aproximação). Use as setas para percorrer o carrossel.</p>' +
      '<div class="cms-preview-wrap">' +
      renderPreview(selected) +
      renderDrawer() +
      '</div></section>' +
      '</div></div>';
  }

  function setDefaultStartInput() {
    var el = document.getElementById('cms-social-start');
    if (!el || el.value) return;
    var d = startOfWeek(new Date());
    // próxima quarta 10:00
    var wed = addDays(d, 2);
    wed.setHours(10, 0, 0, 0);
    if (wed < new Date()) wed = addDays(wed, 7);
    el.value = toLocalInputValue(wed);
  }

  function uploadFiles(fileList) {
    if (!fileList || !fileList.length) return;
    var fd = new FormData();
    Array.prototype.forEach.call(fileList, function (f) {
      fd.append('files[]', f);
    });
    state.uploading = true;
    toast('A carregar ' + fileList.length + ' foto(s)…');
    fetch('api/social-upload.php', { method: 'POST', body: fd, credentials: 'same-origin' })
      .then(function (res) {
        return res.text().then(function (text) {
          var data = {};
          try { data = JSON.parse(text); } catch (e) {
            throw { error: 'Resposta inválida do servidor.', detail: text.slice(0, 200) };
          }
          if (!res.ok) throw data;
          return data;
        });
      })
      .then(function (data) {
        (data.files || []).forEach(function (f) {
          state.pool.push({ path: f.path, name: f.name, selected: true, url: f.url || mediaUrl(f.path) });
        });
        if (data.errors && data.errors.length) {
          toast(data.errors[0]);
        } else if (!(data.files || []).length) {
          toast(data.error || 'Nenhuma imagem gravada.');
        } else {
          toast((data.files || []).length + ' foto(s) na fila');
        }
        global.StoffusCmsRerender();
      })
      .catch(function (err) {
        toast(err.error || err.detail || 'Falha no upload.');
      })
      .finally(function () { state.uploading = false; });
  }

  function bind() {
    setDefaultStartInput();

    var drop = document.getElementById('cms-social-drop');
    var fileInput = document.getElementById('cms-social-file');
    if (drop && fileInput) {
      ['dragenter', 'dragover'].forEach(function (ev) {
        drop.addEventListener(ev, function (e) {
          e.preventDefault();
          drop.classList.add('is-drag');
        });
      });
      ['dragleave', 'drop'].forEach(function (ev) {
        drop.addEventListener(ev, function (e) {
          e.preventDefault();
          drop.classList.remove('is-drag');
        });
      });
      drop.addEventListener('drop', function (e) {
        uploadFiles(e.dataTransfer && e.dataTransfer.files);
      });
      fileInput.addEventListener('change', function () {
        uploadFiles(fileInput.files);
        fileInput.value = '';
      });
    }

    document.querySelectorAll('[data-pool-i]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        if (e.target.closest('[data-pool-remove]')) return;
        var i = Number(el.getAttribute('data-pool-i'));
        state.pool[i].selected = state.pool[i].selected === false;
        el.classList.toggle('is-selected', state.pool[i].selected !== false);
      });
    });

    document.querySelectorAll('[data-pool-remove]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        state.pool.splice(Number(btn.getAttribute('data-pool-remove')), 1);
        global.StoffusCmsRerender();
      });
    });

    var splitBtn = document.getElementById('cms-social-split-btn');
    if (splitBtn) {
      splitBtn.onclick = function () {
        var paths = selectedPaths();
        if (!paths.length) {
          toast('Seleccione fotos na fila.');
          return;
        }
        var split = Number((document.getElementById('cms-social-split') || {}).value || 10);
        var interval = Number((document.getElementById('cms-social-interval') || {}).value || 24);
        var startAt = (document.getElementById('cms-social-start') || {}).value || '';
        var caption = (document.getElementById('cms-social-default-caption') || {}).value || '';
        api('social.php', {
          method: 'POST',
          body: {
            action: 'create_from_media',
            files: paths,
            splitSize: split,
            intervalHours: interval,
            startAt: startAt ? new Date(startAt).toISOString() : '',
            caption: caption,
            platforms: state.settings.defaultPlatforms,
          },
        }).then(function (data) {
          state.posts = data.posts || [];
          state.settings.defaultCaption = caption;
          state.settings.autoSplitSize = split;
          state.pool = [];
          toast((data.created || []).length + ' publicação(ões) criadas');
          api('social.php', {
            method: 'POST',
            body: { action: 'save_settings', settings: state.settings },
          });
          global.StoffusCmsRerender();
        }).catch(function (err) {
          toast(err.error || 'Erro ao agendar.');
        });
      };
    }

    var prev = document.getElementById('cms-social-prev');
    var next = document.getElementById('cms-social-next');
    var todayBtn = document.getElementById('cms-social-today');
    if (prev) prev.onclick = function () {
      state.weekStart = addDays(state.weekStart, -7);
      global.StoffusCmsRerender();
    };
    if (next) next.onclick = function () {
      state.weekStart = addDays(state.weekStart, 7);
      global.StoffusCmsRerender();
    };
    if (todayBtn) todayBtn.onclick = function () {
      state.weekStart = startOfWeek(new Date());
      global.StoffusCmsRerender();
    };

    var publishDue = document.getElementById('cms-social-publish-due');
    if (publishDue) {
      publishDue.onclick = function () {
        api('social.php', { method: 'POST', body: { action: 'publish_due' } })
          .then(function (data) {
            state.posts = data.posts || [];
            var n = (data.results || []).length;
            toast(n ? n + ' publicação(ões) processada(s)' : 'Nada vencido para publicar');
            global.StoffusCmsRerender();
          })
          .catch(function (err) { toast(err.error || 'Erro ao publicar.'); });
      };
    }

    document.querySelectorAll('[data-post-id]').forEach(function (el) {
      el.addEventListener('click', function () {
        var id = el.getAttribute('data-post-id');
        if (state.selectedPostId !== id) state.previewSlide = 0;
        state.selectedPostId = id;
        global.StoffusCmsRerender();
      });
      el.addEventListener('dragstart', function (e) {
        e.dataTransfer.setData('text/post-id', el.getAttribute('data-post-id'));
        e.dataTransfer.effectAllowed = 'move';
      });
    });

    var captionEl = document.getElementById('cms-social-caption');
    if (captionEl) {
      captionEl.addEventListener('input', function () {
        var live = document.getElementById('cms-preview-caption-live');
        if (live) live.textContent = captionEl.value || 'Sem legenda';
      });
    }

    var prevSlide = document.getElementById('cms-preview-prev');
    var nextSlide = document.getElementById('cms-preview-next');
    if (prevSlide) {
      prevSlide.onclick = function (e) {
        e.stopPropagation();
        var post = state.posts.find(function (p) { return p.id === state.selectedPostId; });
        var n = (post && post.media) ? post.media.length : 0;
        if (!n) return;
        state.previewSlide = (state.previewSlide - 1 + n) % n;
        global.StoffusCmsRerender();
      };
    }
    if (nextSlide) {
      nextSlide.onclick = function (e) {
        e.stopPropagation();
        var post = state.posts.find(function (p) { return p.id === state.selectedPostId; });
        var n = (post && post.media) ? post.media.length : 0;
        if (!n) return;
        state.previewSlide = (state.previewSlide + 1) % n;
        global.StoffusCmsRerender();
      };
    }
    document.querySelectorAll('[data-preview-slide]').forEach(function (btn) {
      btn.onclick = function (e) {
        e.stopPropagation();
        state.previewSlide = Number(btn.getAttribute('data-preview-slide')) || 0;
        global.StoffusCmsRerender();
      };
    });

    var fbCheck = document.getElementById('cms-social-fb');
    var igCheck = document.getElementById('cms-social-ig');
    function syncPlatformPreview() {
      var post = state.posts.find(function (p) { return p.id === state.selectedPostId; });
      if (!post) return;
      var captionElLive = document.getElementById('cms-social-caption');
      if (captionElLive) post.caption = captionElLive.value;
      var platforms = [];
      if (fbCheck && fbCheck.checked) platforms.push('facebook');
      if (igCheck && igCheck.checked) platforms.push('instagram');
      post.platforms = platforms;
      global.StoffusCmsRerender();
    }
    if (fbCheck) fbCheck.addEventListener('change', syncPlatformPreview);
    if (igCheck) igCheck.addEventListener('change', syncPlatformPreview);
    document.querySelectorAll('[data-cal-day]').forEach(function (dayEl) {
      dayEl.addEventListener('dragover', function (e) {
        e.preventDefault();
        dayEl.classList.add('is-over');
      });
      dayEl.addEventListener('dragleave', function () {
        dayEl.classList.remove('is-over');
      });
      dayEl.addEventListener('drop', function (e) {
        e.preventDefault();
        dayEl.classList.remove('is-over');
        var id = e.dataTransfer.getData('text/post-id');
        if (!id) return;
        var dayIso = dayEl.getAttribute('data-cal-day');
        var post = state.posts.find(function (p) { return p.id === id; });
        if (!post) return;
        var prev = post.scheduledAt ? new Date(post.scheduledAt) : new Date();
        var nextDate = parseDayKey(dayIso);
        nextDate.setHours(prev.getHours(), prev.getMinutes(), 0, 0);
        api('social.php', {
          method: 'POST',
          body: { action: 'update', id: id, post: { scheduledAt: nextDate.toISOString() } },
        }).then(function (data) {
          state.posts = data.posts || [];
          state.selectedPostId = id;
          toast('Data actualizada');
          global.StoffusCmsRerender();
        }).catch(function (err) { toast(err.error || 'Erro ao mover.'); });
      });
    });

    var savePost = document.getElementById('cms-social-save-post');
    if (savePost) {
      savePost.onclick = function () {
        var id = state.selectedPostId;
        var platforms = [];
        if (document.getElementById('cms-social-fb').checked) platforms.push('facebook');
        if (document.getElementById('cms-social-ig').checked) platforms.push('instagram');
        var when = document.getElementById('cms-social-when').value;
        api('social.php', {
          method: 'POST',
          body: {
            action: 'update',
            id: id,
            post: {
              caption: document.getElementById('cms-social-caption').value,
              scheduledAt: when ? new Date(when).toISOString() : undefined,
              platforms: platforms,
            },
          },
        }).then(function (data) {
          state.posts = data.posts || [];
          toast('Publicação guardada');
          global.StoffusCmsRerender();
        }).catch(function (err) { toast(err.error || 'Erro ao guardar.'); });
      };
    }

    var pubNow = document.getElementById('cms-social-publish-now');
    if (pubNow) {
      pubNow.onclick = function () {
        if (!confirm('Publicar agora no Meta?')) return;
        api('social.php', { method: 'POST', body: { action: 'publish', id: state.selectedPostId } })
          .then(function (data) {
            state.posts = data.posts || [];
            toast('Publicado');
            global.StoffusCmsRerender();
          })
          .catch(function (err) { toast(err.error || 'Falha na publicação.'); });
      };
    }

    var delPost = document.getElementById('cms-social-delete-post');
    if (delPost) {
      delPost.onclick = function () {
        if (!confirm('Apagar esta publicação do calendário?')) return;
        api('social.php', { method: 'POST', body: { action: 'delete', id: state.selectedPostId } })
          .then(function (data) {
            state.posts = data.posts || [];
            state.selectedPostId = null;
            toast('Publicação apagada');
            global.StoffusCmsRerender();
          })
          .catch(function (err) { toast(err.error || 'Erro ao apagar.'); });
      };
    }
  }

  global.StoffusSocial = {
    load: load,
    render: render,
    bind: bind,
  };
})(window);
