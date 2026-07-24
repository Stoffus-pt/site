/**
 * Módulo Redes — planeamento em bulk + calendário + gestão de publicações.
 * Expõe window.StoffusSocial
 */
(function (global) {
  var state = {
    brand: 'stoffus',
    brands: [
      { id: 'stoffus', label: 'Stoffus', short: 'Stoffus', configured: false },
      { id: 'divinus', label: 'Divinus Confort', short: 'Divinus', configured: false },
    ],
    posts: [],
    settings: {
      autoSplitSize: 10,
      defaultPlatforms: ['facebook', 'instagram'],
      defaultCaption: '',
    },
    meta: { configured: false, instagram_ready: false },
    pool: [],
    weekStart: null,
    calView: 'week',
    targetDay: null,
    selectedPostId: null,
    previewSlide: 0,
    listFilter: 'all',
    uploading: false,
    metaFormOpen: false,
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
    if (!a || !b) return false;
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

  function startOfMonth(d) {
    return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
  }

  function ensureAnchor() {
    if (!state.weekStart) state.weekStart = startOfWeek(new Date());
    return state.weekStart;
  }

  function calendarTitle() {
    var anchor = ensureAnchor();
    if (state.calView === 'year') {
      return String(anchor.getFullYear());
    }
    if (state.calView === 'month') {
      return anchor.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
    }
    return fmtWeekRange(startOfWeek(anchor));
  }

  function navLabel(dir) {
    var map = {
      week: dir < 0 ? '← Semana' : 'Semana →',
      month: dir < 0 ? '← Mês' : 'Mês →',
      year: dir < 0 ? '← Ano' : 'Ano →',
    };
    return map[state.calView] || map.week;
  }

  function shiftCalendar(dir) {
    var a = ensureAnchor();
    if (state.calView === 'year') {
      state.weekStart = new Date(a.getFullYear() + dir, a.getMonth(), 1);
    } else if (state.calView === 'month') {
      state.weekStart = new Date(a.getFullYear(), a.getMonth() + dir, 1);
    } else {
      state.weekStart = addDays(startOfWeek(a), dir * 7);
    }
  }

  function postsInMonth(year, month) {
    return state.posts.filter(function (p) {
      if (!p.scheduledAt) return false;
      var d = new Date(p.scheduledAt);
      return d.getFullYear() === year && d.getMonth() === month;
    });
  }

  function renderDayCell(day, opts) {
    opts = opts || {};
    var today = new Date();
    var target = ensureTargetDay();
    var posts = postsForDay(day);
    var isTarget = sameDay(day, target);
    var outside = !!opts.outside;
    var compact = !!opts.compact;
    var maxPosts = compact ? 2 : 8;

    var html = '<div class="cms-cal-day' +
      (sameDay(day, today) ? ' is-today' : '') +
      (isTarget ? ' is-target' : '') +
      (outside ? ' is-outside' : '') +
      (compact ? ' is-compact' : '') +
      '" data-cal-day="' + dayKey(day) + '" title="Clique para escolher este dia">' +
      '<div class="cms-cal-day__label">' +
      '<span>' + (compact ? day.getDate() : esc(fmtDayLabel(day))) + '</span>' +
      '<span>' + (isTarget ? '●' : posts.length) + '</span></div>';

    if (!compact) {
      html += isTarget
        ? '<div class="cms-cal-day__pick">Dia escolhido</div>'
        : '<div class="cms-cal-day__pick">Clique para agendar aqui</div>';
    }

    posts.slice(0, maxPosts).forEach(function (p) {
      var thumbs = (p.media || []).slice(0, compact ? 1 : 3).map(function (m) {
        return '<img src="' + esc(mediaUrl(m)) + '" alt="" />';
      }).join('');
      var time = new Date(p.scheduledAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
      var plats = platformsOf(p).map(function (x) { return x === 'instagram' ? 'IG' : 'FB'; }).join('+');
      html += '<div class="cms-cal-post is-' + esc(p.status || 'draft') +
        (state.selectedPostId === p.id ? ' is-selected' : '') +
        '" draggable="true" data-post-id="' + esc(p.id) + '">' +
        '<div class="cms-cal-post__thumbs">' + thumbs + '</div>' +
        (compact
          ? '<div class="cms-cal-post__meta">' + esc(time) + '</div>'
          : '<div class="cms-cal-post__meta">' + esc(time) + ' · ' + (p.media || []).length + ' · ' + esc(plats || '—') +
            ' · ' + esc(statusLabel(p.status)) + '</div>') +
        '</div>';
    });
    if (posts.length > maxPosts) {
      html += '<div class="cms-cal-day__more">+' + (posts.length - maxPosts) + '</div>';
    }
    html += '</div>';
    return html;
  }

  function renderWeekView() {
    var start = startOfWeek(ensureAnchor());
    var days = [];
    for (var i = 0; i < 7; i++) {
      days.push(renderDayCell(addDays(start, i)));
    }
    return '<div class="cms-cal cms-cal--week">' + days.join('') + '</div>';
  }

  function renderMonthView() {
    var anchor = ensureAnchor();
    var first = startOfMonth(anchor);
    var gridStart = startOfWeek(first);
    var headers = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    var html = '<div class="cms-cal-weekdays">' +
      headers.map(function (h) { return '<span>' + h + '</span>'; }).join('') +
      '</div><div class="cms-cal cms-cal--month">';

    for (var i = 0; i < 42; i++) {
      var day = addDays(gridStart, i);
      var outside = day.getMonth() !== anchor.getMonth();
      html += renderDayCell(day, { outside: outside, compact: true });
    }
    html += '</div>';
    return html;
  }

  function renderYearView() {
    var year = ensureAnchor().getFullYear();
    var html = '<div class="cms-cal cms-cal--year">';
    for (var m = 0; m < 12; m++) {
      var count = postsInMonth(year, m).length;
      var label = new Date(year, m, 1).toLocaleDateString('pt-PT', { month: 'long' });
      var isCurrent = (new Date().getFullYear() === year && new Date().getMonth() === m);
      var isAnchor = ensureAnchor().getMonth() === m && ensureAnchor().getFullYear() === year;
      html += '<button type="button" class="cms-cal-month-card' +
        (isCurrent ? ' is-today' : '') +
        (isAnchor ? ' is-target' : '') +
        '" data-cal-month="' + year + '-' + m + '">' +
        '<strong>' + esc(label) + '</strong>' +
        '<span>' + count + ' publicação' + (count === 1 ? '' : 'ões') + '</span>' +
        '</button>';
    }
    html += '</div>';
    return html;
  }

  function renderCalendar() {
    if (state.calView === 'year') return renderYearView();
    if (state.calView === 'month') return renderMonthView();
    return renderWeekView();
  }

  function renderCalViewSwitch() {
    var views = [
      { id: 'week', label: 'Semana' },
      { id: 'month', label: 'Mês' },
      { id: 'year', label: 'Ano' },
    ];
    return '<div class="cms-cal-views">' +
      views.map(function (v) {
        return '<button type="button" class="cms-cal-view-btn' +
          (state.calView === v.id ? ' is-active' : '') +
          '" data-cal-view="' + v.id + '">' + v.label + '</button>';
      }).join('') +
      '</div>';
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
    return 'api/social-file.php?f=' + encodeURIComponent(rel);
  }

  function api(path, options) {
    return global.StoffusCmsApi(path, options);
  }

  function toast(msg) {
    global.StoffusCmsToast(msg);
  }

  function statusLabel(st) {
    if (st === 'published') return 'Publicada';
    if (st === 'failed') return 'Falhou';
    if (st === 'draft') return 'Rascunho';
    return 'Agendada';
  }

  function platformsOf(post) {
    return Array.isArray(post && post.platforms) ? post.platforms.slice() : [];
  }

  function hasPlatform(list, name) {
    return list.indexOf(name) >= 0;
  }

  function ensureTargetDay() {
    if (!state.targetDay) {
      var d = startOfWeek(new Date());
      var wed = addDays(d, 2);
      wed.setHours(10, 0, 0, 0);
      if (wed < new Date()) wed = addDays(wed, 7);
      state.targetDay = wed;
    }
    return state.targetDay;
  }

  function currentBrandInfo() {
    return state.brands.find(function (b) { return b.id === state.brand; }) || {
      id: state.brand,
      label: state.brand,
      short: state.brand,
      handle: state.brand,
    };
  }

  function load() {
    if (!state.weekStart) state.weekStart = startOfWeek(new Date());
    ensureTargetDay();
    return api('social.php?action=list&brand=' + encodeURIComponent(state.brand)).then(function (data) {
      state.posts = data.posts || [];
      state.settings = Object.assign({}, state.settings, data.settings || {});
      state.meta = data.meta || state.meta;
      if (data.brands && data.brands.length) state.brands = data.brands;
      if (data.brand) state.brand = data.brand;
      if (!state.settings.defaultPlatforms || !state.settings.defaultPlatforms.length) {
        state.settings.defaultPlatforms = ['facebook', 'instagram'];
      }
      if (state.meta && !state.meta.configured) {
        state.metaFormOpen = true;
      }
    });
  }

  function switchBrand(brandId) {
    if (brandId === state.brand) return;
    state.brand = brandId;
    state.pool = [];
    state.selectedPostId = null;
    state.previewSlide = 0;
    state.listFilter = 'all';
    load().then(function () {
      toast('A gerir: ' + (currentBrandInfo().label || brandId));
      global.StoffusCmsRerender();
    }).catch(function (err) {
      toast(err.error || 'Erro ao mudar de marca.');
    });
  }

  function apiBrandBody(extra) {
    return Object.assign({ brand: state.brand }, extra || {});
  }

  function selectedPaths() {
    return state.pool.filter(function (f) { return f.selected !== false; }).map(function (f) { return f.path; });
  }

  function filteredPosts() {
    var list = state.posts.slice().sort(function (a, b) {
      return new Date(a.scheduledAt || 0) - new Date(b.scheduledAt || 0);
    });
    if (state.listFilter === 'all') return list;
    return list.filter(function (p) { return p.status === state.listFilter; });
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

  function renderPlatformToggles(idPrefix, selected) {
    var fb = hasPlatform(selected, 'facebook');
    var ig = hasPlatform(selected, 'instagram');
    return '<div class="cms-platform-toggles" role="group" aria-label="Redes">' +
      '<button type="button" class="cms-platform-btn' + (fb ? ' is-on' : '') + '" data-platform-toggle="facebook" data-platform-scope="' + idPrefix + '">' +
      '<i class="fa-brands fa-facebook"></i> Facebook</button>' +
      '<button type="button" class="cms-platform-btn' + (ig ? ' is-on' : '') + '" data-platform-toggle="instagram" data-platform-scope="' + idPrefix + '">' +
      '<i class="fa-brands fa-instagram"></i> Instagram</button>' +
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
      return sameDay(new Date(p.scheduledAt), day);
    }).sort(function (a, b) {
      return new Date(a.scheduledAt) - new Date(b.scheduledAt);
    });
  }

  function renderPostsList() {
    var filters = [
      { id: 'all', label: 'Todas' },
      { id: 'scheduled', label: 'Agendadas' },
      { id: 'published', label: 'Publicadas' },
      { id: 'failed', label: 'Falhas' },
      { id: 'draft', label: 'Rascunhos' },
    ];
    var posts = filteredPosts();
    var html = '<div class="cms-posts-list">' +
      '<div class="cms-posts-list__head">' +
      '<h2>Publicações</h2>' +
      '<div class="cms-tabs cms-tabs--sub">' +
      filters.map(function (f) {
        return '<button type="button" class="cms-tab' + (state.listFilter === f.id ? ' is-active' : '') +
          '" data-list-filter="' + f.id + '">' + f.label + '</button>';
      }).join('') +
      '</div></div>';

    if (!posts.length) {
      html += '<p class="cms-hint">Nenhuma publicação neste filtro.</p></div>';
      return html;
    }

    html += '<div class="cms-posts-list__rows">';
    posts.forEach(function (p) {
      var when = '';
      try {
        when = new Date(p.scheduledAt).toLocaleString('pt-PT', {
          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
        });
      } catch (e) { when = '—'; }
      var thumb = (p.media && p.media[0]) ? mediaUrl(p.media[0]) : '';
      var plats = platformsOf(p).map(function (x) { return x === 'instagram' ? 'IG' : 'FB'; }).join(' · ');
      html += '<button type="button" class="cms-post-row' +
        (state.selectedPostId === p.id ? ' is-selected' : '') +
        '" data-post-id="' + esc(p.id) + '">' +
        (thumb ? '<img src="' + esc(thumb) + '" alt="" />' : '<span class="cms-post-row__ph"></span>') +
        '<span class="cms-post-row__body">' +
        '<strong>' + esc(when) + '</strong>' +
        '<span>' + (p.media || []).length + ' fotos · ' + esc(plats || 'sem rede') + ' · ' + esc(statusLabel(p.status)) + '</span>' +
        '<span class="cms-post-row__cap">' + esc((p.caption || '').slice(0, 80) || 'Sem legenda') + '</span>' +
        '</span></button>';
    });
    html += '</div></div>';
    return html;
  }

  function renderPreview(post) {
    if (!post) {
      return '<div class="cms-preview-phone cms-preview-phone--empty">' +
        '<div class="cms-preview-phone__body">' +
        '<i class="fa-regular fa-images"></i>' +
        '<p><strong>Pré-visualização</strong></p>' +
        '<p>Escolha uma publicação na lista ou no calendário.</p>' +
        '</div></div>';
    }

    var media = post.media || [];
    if (state.previewSlide >= media.length) state.previewSlide = 0;
    if (state.previewSlide < 0) state.previewSlide = 0;
    var slide = media[state.previewSlide];
    var plats = platformsOf(post);
    var isIg = hasPlatform(plats, 'instagram');
    var info = currentBrandInfo();
    var brand = isIg ? (info.handle || info.short || 'marca') : (info.label || 'Marca');
    var when = '';
    try {
      when = new Date(post.scheduledAt).toLocaleString('pt-PT', {
        weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      });
    } catch (e) { when = ''; }

    var dots = media.map(function (_, i) {
      return '<button type="button" class="cms-preview-dot' + (i === state.previewSlide ? ' is-active' : '') +
        '" data-preview-slide="' + i + '" aria-label="Foto ' + (i + 1) + '"></button>';
    }).join('');

    return '<div class="cms-preview-phone">' +
      '<div class="cms-preview-phone__chrome">' +
      '<span>' + (isIg
        ? '<i class="fa-brands fa-instagram"></i> Instagram'
        : '<i class="fa-brands fa-facebook"></i> Facebook') + '</span>' +
      '<span>' + esc(when) + '</span></div>' +
      '<div class="cms-preview-phone__head">' +
      '<div class="cms-preview-phone__avatar">S</div>' +
      '<div><strong>' + esc(brand) + '</strong><span>' + esc(statusLabel(post.status)) + '</span></div></div>' +
      '<div class="cms-preview-phone__media">' +
      (slide
        ? '<img src="' + esc(mediaUrl(slide)) + '" alt="Pré-visualização" />'
        : '<div class="cms-preview-phone__missing">Sem imagem</div>') +
      (media.length > 1
        ? '<button type="button" class="cms-preview-nav cms-preview-nav--prev" id="cms-preview-prev">‹</button>' +
          '<button type="button" class="cms-preview-nav cms-preview-nav--next" id="cms-preview-next">›</button>' +
          '<div class="cms-preview-counter">' + (state.previewSlide + 1) + ' / ' + media.length + '</div>'
        : '') +
      '</div>' +
      (media.length > 1 ? '<div class="cms-preview-dots">' + dots + '</div>' : '') +
      '<div class="cms-preview-phone__caption"><strong>' + esc(brand) + '</strong> ' +
      '<span id="cms-preview-caption-live">' + esc(post.caption || 'Sem legenda') + '</span></div>' +
      '<div class="cms-preview-phone__foot"><span>' + media.length + ' fotos</span>' +
      '<span>' + esc(plats.map(function (p) { return p === 'instagram' ? 'IG' : 'FB'; }).join(' · ') || '—') +
      '</span></div></div>';
  }

  function renderDrawer() {
    var post = state.posts.find(function (p) { return p.id === state.selectedPostId; });
    if (!post) {
      return '<div class="cms-post-edit"><p class="cms-hint" style="margin:0">' +
        'Seleccione uma publicação para editar dia, redes e legenda.</p></div>';
    }

    var local = '';
    try { local = toLocalInputValue(new Date(post.scheduledAt)); } catch (e) { local = ''; }
    var published = post.status === 'published';

    return '<div class="cms-post-edit" data-drawer-id="' + esc(post.id) + '">' +
      '<h2>Editar publicação</h2>' +
      '<p class="cms-hint" style="margin:0 0 .75rem">Estado: <strong>' + esc(statusLabel(post.status)) + '</strong>' +
      (post.error ? ' — ' + esc(post.error) : '') + '</p>' +
      '<label class="cms-field"><span>Legenda</span>' +
      '<textarea id="cms-social-caption" rows="4">' + esc(post.caption) + '</textarea></label>' +
      '<label class="cms-field"><span>Data e hora</span>' +
      '<input type="datetime-local" id="cms-social-when" value="' + esc(local) + '" /></label>' +
      '<div class="cms-field"><span>Publicar em</span>' +
      renderPlatformToggles('edit', platformsOf(post)) +
      '<p class="cms-hint">Clique para ligar/desligar Facebook e Instagram.</p></div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:.45rem">' +
      '<button type="button" class="cms-btn cms-btn--brand cms-btn--sm" id="cms-social-save-post">Guardar alterações</button>' +
      '<button type="button" class="cms-btn cms-btn--ghost cms-btn--sm" id="cms-social-move-target">Mover para o dia escolhido</button>' +
      (!published
        ? '<button type="button" class="cms-btn cms-btn--ghost cms-btn--sm" id="cms-social-publish-now">Publicar agora</button>'
        : '<button type="button" class="cms-btn cms-btn--ghost cms-btn--sm" id="cms-social-requeue">Voltar a agendar</button>') +
      (post.status === 'failed'
        ? '<button type="button" class="cms-btn cms-btn--ghost cms-btn--sm" id="cms-social-publish-now">Tentar de novo</button>'
        : '') +
      '<button type="button" class="cms-btn cms-btn--danger cms-btn--sm" id="cms-social-delete-post">Apagar do CMS</button>' +
      '</div>' +
      (published
        ? '<p class="cms-hint">Já publicada no Meta. «Voltar a agendar» só muda o estado no CMS (não apaga no Facebook/Instagram).</p>'
        : '<p class="cms-hint">Para mudar o dia: altere a data acima, use «Mover para o dia escolhido», ou arraste no calendário.</p>') +
      '</div>';
  }

  function renderBrandSwitcher() {
    return '<div class="cms-brand-switch" role="tablist" aria-label="Marca">' +
      state.brands.map(function (b) {
        return '<button type="button" class="cms-brand-btn' + (state.brand === b.id ? ' is-active' : '') +
          '" data-brand="' + esc(b.id) + '">' +
          '<strong>' + esc(b.short || b.label) + '</strong>' +
          '<span>' + (b.configured ? 'Meta OK' : 'Meta por configurar') + '</span>' +
          '</button>';
      }).join('') +
      '</div>';
  }

  function renderMetaConfig() {
    var info = currentBrandInfo();
    var meta = state.meta || {};
    var open = !!state.metaFormOpen;
    return '<section class="cms-surface cms-meta-config">' +
      '<div class="cms-meta-config__head">' +
      '<div><h2>Configuração Meta · ' + esc(info.label) + '</h2>' +
      '<p class="cms-hint">Page ID e token da Página. O token completo nunca é mostrado depois de guardado.</p></div>' +
      '<button type="button" class="cms-btn cms-btn--ghost cms-btn--sm" id="cms-meta-toggle">' +
      (open ? 'Fechar' : 'Configurar Meta') + '</button></div>' +
      (open
        ? '<div class="cms-meta-config__form">' +
          '<label class="cms-field"><span>Page ID</span>' +
          '<input class="cms-input" type="text" id="cms-meta-page-id" value="' + esc(meta.page_id || '') +
          '" placeholder="Ex.: 232459563473506" autocomplete="off" /></label>' +
          '<label class="cms-field"><span>Page Access Token' +
          (meta.has_token ? ' <em>(actual: ' + esc(meta.token_preview || '••••') + ')</em>' : '') +
          '</span>' +
          '<input class="cms-input" type="password" id="cms-meta-token" value="" ' +
          'placeholder="' + (meta.has_token ? 'Deixe vazio para manter o token actual' : 'Cole o token da Página') +
          '" autocomplete="new-password" /></label>' +
          '<label class="cms-field"><span>Instagram Business ID (opcional)</span>' +
          '<input class="cms-input" type="text" id="cms-meta-ig" value="' + esc(meta.instagram_business_id || '') +
          '" placeholder="Deixe vazio por agora" autocomplete="off" /></label>' +
          '<label class="cms-pill"><input type="checkbox" id="cms-meta-clear-token" /> Apagar token guardado</label>' +
          '<div style="display:flex;flex-wrap:wrap;gap:.45rem;margin-top:.75rem">' +
          '<button type="button" class="cms-btn cms-btn--brand cms-btn--sm" id="cms-meta-save">Guardar Meta</button>' +
          '</div>' +
          '<p class="cms-hint">Para publicar, o CMS tem de estar online (a Meta precisa de ler as imagens por URL público).</p>' +
          '</div>'
        : '') +
      '</section>';
  }

  function render() {
    var info = currentBrandInfo();
    var metaBadge = state.meta.configured
      ? '<span class="cms-meta-badge is-ok"><i class="fa-brands fa-meta"></i> Meta · ' + esc(info.short) + '</span>'
      : '<span class="cms-meta-badge is-warn"><i class="fa-brands fa-meta"></i> Meta · ' + esc(info.short) + ' por configurar</span>';

    var selected = state.posts.find(function (p) { return p.id === state.selectedPostId; }) || null;
    var target = ensureTargetDay();
    var targetLabel = target.toLocaleDateString('pt-PT', {
      weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
    });

    return '<div class="cms-social">' +
      renderBrandSwitcher() +
      renderMetaConfig() +
      renderStats() +
      '<div class="cms-social__grid">' +

      '<section class="cms-surface">' +
      '<div style="display:flex;justify-content:space-between;gap:.75rem;align-items:flex-start;flex-wrap:wrap">' +
      '<div><h2>1. Lote de fotos · ' + esc(info.label) + '</h2>' +
      '<p class="cms-hint">Conteúdo desta marca fica separado da outra. Arraste imagens e escolha as redes.</p></div>' +
      metaBadge + '</div>' +
      '<div class="cms-drop" id="cms-social-drop">' +
      '<input type="file" id="cms-social-file" accept="image/jpeg,image/png,image/webp,image/gif" multiple />' +
      '<strong>Largar fotos aqui</strong><span>JPG, PNG ou WebP · até 12 MB cada</span></div>' +
      renderPool() +
      '<div class="cms-field" style="margin-top:1rem"><span>Publicar em</span>' +
      renderPlatformToggles('batch', state.settings.defaultPlatforms || []) +
      '</div>' +
      '<div class="cms-social-toolbar">' +
      '<label class="cms-field"><span>Fotos / post</span>' +
      '<input class="cms-input" type="number" id="cms-social-split" min="1" max="10" value="' +
      esc(state.settings.autoSplitSize) + '" /></label>' +
      '<label class="cms-field"><span>Intervalo (h)</span>' +
      '<input class="cms-input" type="number" id="cms-social-interval" min="1" max="72" value="24" /></label>' +
      '<label class="cms-field"><span>Hora no dia escolhido</span>' +
      '<input class="cms-input" type="datetime-local" id="cms-social-start" value="' +
      esc(toLocalInputValue(target)) + '" /></label>' +
      '</div>' +
      '<div class="cms-target-banner">' +
      '<div><strong>Dia de início · ' + esc(info.short) + '</strong><span>' + esc(targetLabel) + '</span>' +
      '<em>Clique num dia no calendário para mudar.</em></div>' +
      '<button type="button" class="cms-btn cms-btn--brand" id="cms-social-split-btn">Partir e agendar</button>' +
      '</div>' +
      '<label class="cms-field" style="margin-top:1rem"><span>Legenda por defeito</span>' +
      '<textarea id="cms-social-default-caption" rows="2">' + esc(state.settings.defaultCaption) +
      '</textarea></label>' +
      (!state.meta.configured
        ? '<p class="cms-hint">Configure a Meta acima (botão «Configurar Meta») para esta marca.</p>'
        : '') +
      '</section>' +

      '<section class="cms-surface">' +
      '<div class="cms-cal-head">' +
      '<div><h2>2. Calendário · ' + esc(info.short) + '</h2><h3>' + esc(calendarTitle()) + '</h3>' +
      '<p class="cms-hint" style="margin:.35rem 0 0">Alterne Semana / Mês / Ano. Clique num dia para o escolher.</p></div>' +
      '<div class="cms-cal-toolbar">' +
      renderCalViewSwitch() +
      '<div style="display:flex;gap:.4rem;flex-wrap:wrap">' +
      '<button type="button" class="cms-btn cms-btn--ghost cms-btn--sm" id="cms-social-prev">' + esc(navLabel(-1)) + '</button>' +
      '<button type="button" class="cms-btn cms-btn--ghost cms-btn--sm" id="cms-social-today">Hoje</button>' +
      '<button type="button" class="cms-btn cms-btn--ghost cms-btn--sm" id="cms-social-next">' + esc(navLabel(1)) + '</button>' +
      '<button type="button" class="cms-btn cms-btn--brand cms-btn--sm" id="cms-social-publish-due">Publicar vencidas</button>' +
      '</div></div></div>' +
      '<div id="cms-social-cal">' + renderCalendar() + '</div>' +
      renderPostsList() +
      '</section>' +

      '<section class="cms-surface cms-surface--preview">' +
      '<h2>3. Pré-visualização</h2>' +
      '<p class="cms-hint">Edite aqui a data, as redes e a legenda da publicação seleccionada.</p>' +
      '<div class="cms-preview-wrap">' + renderPreview(selected) + renderDrawer() + '</div>' +
      '</section>' +

      '</div></div>';
  }

  function selectPost(id, jumpWeek) {
    if (state.selectedPostId !== id) state.previewSlide = 0;
    state.selectedPostId = id;
    var post = state.posts.find(function (p) { return p.id === id; });
    if (jumpWeek && post && post.scheduledAt) {
      state.weekStart = startOfWeek(new Date(post.scheduledAt));
      state.targetDay = new Date(post.scheduledAt);
    }
    global.StoffusCmsRerender();
  }

  function movePostToDay(id, dayKeyStr) {
    var post = state.posts.find(function (p) { return p.id === id; });
    if (!post) return;
    var prev = post.scheduledAt ? new Date(post.scheduledAt) : new Date();
    var nextDate = parseDayKey(dayKeyStr);
    nextDate.setHours(prev.getHours(), prev.getMinutes(), 0, 0);
    var patch = { scheduledAt: nextDate.toISOString() };
    if (post.status === 'published') {
      // Só move a data de referência no CMS; não republica
    } else if (post.status === 'failed' || post.status === 'draft') {
      patch.status = 'scheduled';
    }
    api('social.php', {
      method: 'POST',
      body: apiBrandBody({ action: 'update', id: id, post: patch }),
    }).then(function (data) {
      state.posts = data.posts || [];
      state.selectedPostId = id;
      state.targetDay = nextDate;
      toast('Movida para ' + nextDate.toLocaleDateString('pt-PT'));
      global.StoffusCmsRerender();
    }).catch(function (err) { toast(err.error || 'Erro ao mover.'); });
  }

  function readEditPlatforms() {
    var plats = [];
    document.querySelectorAll('[data-platform-scope="edit"].is-on').forEach(function (btn) {
      plats.push(btn.getAttribute('data-platform-toggle'));
    });
    return plats;
  }

  function uploadFiles(fileList) {
    if (!fileList || !fileList.length) return;
    var fd = new FormData();
    fd.append('brand', state.brand);
    Array.prototype.forEach.call(fileList, function (f) { fd.append('files[]', f); });
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
        if (data.errors && data.errors.length) toast(data.errors[0]);
        else if (!(data.files || []).length) toast(data.error || 'Nenhuma imagem gravada.');
        else toast((data.files || []).length + ' foto(s) na fila');
        global.StoffusCmsRerender();
      })
      .catch(function (err) { toast(err.error || err.detail || 'Falha no upload.'); })
      .finally(function () { state.uploading = false; });
  }

  function bind() {
    document.querySelectorAll('[data-brand]').forEach(function (btn) {
      btn.onclick = function () {
        switchBrand(btn.getAttribute('data-brand'));
      };
    });

    var metaToggle = document.getElementById('cms-meta-toggle');
    if (metaToggle) {
      metaToggle.onclick = function () {
        state.metaFormOpen = !state.metaFormOpen;
        global.StoffusCmsRerender();
      };
    }

    var metaSave = document.getElementById('cms-meta-save');
    if (metaSave) {
      metaSave.onclick = function () {
        var pageId = ((document.getElementById('cms-meta-page-id') || {}).value || '').trim();
        var token = ((document.getElementById('cms-meta-token') || {}).value || '').trim();
        var ig = ((document.getElementById('cms-meta-ig') || {}).value || '').trim();
        var clearToken = !!(document.getElementById('cms-meta-clear-token') || {}).checked;
        if (!pageId && !token && !ig && !clearToken && !state.meta.has_token) {
          toast('Indique pelo menos o Page ID e o token.');
          return;
        }
        if (!pageId) {
          toast('O Page ID é obrigatório.');
          return;
        }
        if (!state.meta.has_token && !token && !clearToken) {
          toast('Cole o Page Access Token.');
          return;
        }
        api('social.php', {
          method: 'POST',
          body: apiBrandBody({
            action: 'save_meta',
            page_id: pageId,
            page_access_token: token,
            instagram_business_id: ig,
            clear_token: clearToken,
          }),
        }).then(function (data) {
          state.meta = data.meta || state.meta;
          if (data.brands) state.brands = data.brands;
          state.metaFormOpen = false;
          toast(state.meta.configured ? 'Meta guardada' : 'Meta actualizada (ainda incompleta)');
          global.StoffusCmsRerender();
        }).catch(function (err) {
          toast(err.error || 'Erro ao guardar Meta.');
        });
      };
    }

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

    // Toggle FB / IG (lote ou edição) — sem re-render imediato no lote
    document.querySelectorAll('[data-platform-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var scope = btn.getAttribute('data-platform-scope');
        var name = btn.getAttribute('data-platform-toggle');
        btn.classList.toggle('is-on');
        var on = [];
        document.querySelectorAll('[data-platform-scope="' + scope + '"].is-on').forEach(function (b) {
          on.push(b.getAttribute('data-platform-toggle'));
        });
        if (!on.length) {
          btn.classList.add('is-on');
          toast('Escolha pelo menos uma rede.');
          return;
        }
        if (scope === 'batch') {
          state.settings.defaultPlatforms = on;
        } else if (scope === 'edit') {
          var post = state.posts.find(function (p) { return p.id === state.selectedPostId; });
          if (post) {
            post.platforms = on;
            // Actualizar só o chrome da pré-visualização
            global.StoffusCmsRerender();
          }
        }
      });
    });

    var startInput = document.getElementById('cms-social-start');
    if (startInput) {
      startInput.addEventListener('change', function () {
        if (!startInput.value) return;
        state.targetDay = new Date(startInput.value);
        state.weekStart = startOfWeek(state.targetDay);
        global.StoffusCmsRerender();
      });
    }

    var splitBtn = document.getElementById('cms-social-split-btn');
    if (splitBtn) {
      splitBtn.onclick = function () {
        var paths = selectedPaths();
        if (!paths.length) {
          toast('Seleccione fotos na fila.');
          return;
        }
        var platforms = state.settings.defaultPlatforms || [];
        if (!platforms.length) {
          toast('Escolha Facebook e/ou Instagram.');
          return;
        }
        var split = Number((document.getElementById('cms-social-split') || {}).value || 10);
        var interval = Number((document.getElementById('cms-social-interval') || {}).value || 24);
        var startAt = (document.getElementById('cms-social-start') || {}).value || '';
        if (!startAt && state.targetDay) startAt = toLocalInputValue(state.targetDay);
        var caption = (document.getElementById('cms-social-default-caption') || {}).value || '';
        api('social.php', {
          method: 'POST',
          body: apiBrandBody({
            action: 'create_from_media',
            files: paths,
            splitSize: split,
            intervalHours: interval,
            startAt: startAt ? new Date(startAt).toISOString() : '',
            caption: caption,
            platforms: platforms,
          }),
        }).then(function (data) {
          state.posts = data.posts || [];
          state.settings.defaultCaption = caption;
          state.settings.autoSplitSize = split;
          state.pool = [];
          if (data.created && data.created[0]) {
            state.selectedPostId = data.created[0].id;
            state.listFilter = 'scheduled';
          }
          toast((data.created || []).length + ' publicação(ões) criadas');
          api('social.php', {
            method: 'POST',
            body: apiBrandBody({ action: 'save_settings', settings: state.settings }),
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
      shiftCalendar(-1);
      global.StoffusCmsRerender();
    };
    if (next) next.onclick = function () {
      shiftCalendar(1);
      global.StoffusCmsRerender();
    };
    if (todayBtn) todayBtn.onclick = function () {
      var now = new Date();
      state.weekStart = state.calView === 'week' ? startOfWeek(now) : startOfMonth(now);
      if (state.calView === 'year') state.weekStart = new Date(now.getFullYear(), 0, 1);
      global.StoffusCmsRerender();
    };

    document.querySelectorAll('[data-cal-view]').forEach(function (btn) {
      btn.onclick = function () {
        var view = btn.getAttribute('data-cal-view');
        if (!view || view === state.calView) return;
        state.calView = view;
        if (view === 'week') state.weekStart = startOfWeek(ensureAnchor());
        else if (view === 'month') state.weekStart = startOfMonth(ensureAnchor());
        else state.weekStart = new Date(ensureAnchor().getFullYear(), 0, 1);
        global.StoffusCmsRerender();
      };
    });

    document.querySelectorAll('[data-cal-month]').forEach(function (btn) {
      btn.onclick = function () {
        var parts = String(btn.getAttribute('data-cal-month') || '').split('-');
        var y = Number(parts[0]);
        var m = Number(parts[1]);
        if (isNaN(y) || isNaN(m)) return;
        state.calView = 'month';
        state.weekStart = new Date(y, m, 1);
        global.StoffusCmsRerender();
      };
    });

    var publishDue = document.getElementById('cms-social-publish-due');
    if (publishDue) {
      publishDue.onclick = function () {
        api('social.php', { method: 'POST', body: apiBrandBody({ action: 'publish_due' }) })
          .then(function (data) {
            state.posts = data.posts || [];
            var n = (data.results || []).length;
            toast(n ? n + ' publicação(ões) processada(s)' : 'Nada vencido para publicar');
            global.StoffusCmsRerender();
          })
          .catch(function (err) { toast(err.error || 'Erro ao publicar.'); });
      };
    }

    document.querySelectorAll('[data-list-filter]').forEach(function (btn) {
      btn.onclick = function () {
        state.listFilter = btn.getAttribute('data-list-filter');
        global.StoffusCmsRerender();
      };
    });

    // Clique no dia = escolher dia de agendamento do próximo lote
    document.querySelectorAll('[data-cal-day]').forEach(function (dayEl) {
      dayEl.addEventListener('click', function (e) {
        if (e.target.closest('[data-post-id]')) return;
        var key = dayEl.getAttribute('data-cal-day');
        var day = parseDayKey(key);
        var prev = state.targetDay || new Date();
        day.setHours(prev.getHours(), prev.getMinutes(), 0, 0);
        state.targetDay = day;
        toast('Dia escolhido: ' + day.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' }));
        global.StoffusCmsRerender();
      });

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
        movePostToDay(id, dayEl.getAttribute('data-cal-day'));
      });
    });

    document.querySelectorAll('[data-post-id]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        selectPost(el.getAttribute('data-post-id'), true);
      });
      if (el.classList.contains('cms-cal-post')) {
        el.addEventListener('dragstart', function (e) {
          e.dataTransfer.setData('text/post-id', el.getAttribute('data-post-id'));
          e.dataTransfer.effectAllowed = 'move';
        });
      }
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

    var savePost = document.getElementById('cms-social-save-post');
    if (savePost) {
      savePost.onclick = function () {
        var id = state.selectedPostId;
        var platforms = readEditPlatforms();
        if (!platforms.length) {
          toast('Escolha pelo menos uma rede.');
          return;
        }
        var when = document.getElementById('cms-social-when').value;
        var post = state.posts.find(function (p) { return p.id === id; });
        var patch = {
          caption: document.getElementById('cms-social-caption').value,
          platforms: platforms,
        };
        if (when) {
          patch.scheduledAt = new Date(when).toISOString();
          if (post && post.status !== 'published') patch.status = 'scheduled';
        }
        api('social.php', {
          method: 'POST',
          body: apiBrandBody({ action: 'update', id: id, post: patch }),
        }).then(function (data) {
          state.posts = data.posts || [];
          if (when) state.targetDay = new Date(when);
          toast('Publicação guardada');
          global.StoffusCmsRerender();
        }).catch(function (err) { toast(err.error || 'Erro ao guardar.'); });
      };
    }

    var moveTarget = document.getElementById('cms-social-move-target');
    if (moveTarget) {
      moveTarget.onclick = function () {
        if (!state.selectedPostId || !state.targetDay) return;
        movePostToDay(state.selectedPostId, dayKey(state.targetDay));
      };
    }

    var pubNow = document.getElementById('cms-social-publish-now');
    if (pubNow) {
      pubNow.onclick = function () {
        // Guardar plataformas/legenda antes de publicar
        var platforms = readEditPlatforms();
        var caption = (document.getElementById('cms-social-caption') || {}).value || '';
        var when = (document.getElementById('cms-social-when') || {}).value || '';
        var prep = {
          caption: caption,
          platforms: platforms.length ? platforms : undefined,
        };
        if (when) prep.scheduledAt = new Date(when).toISOString();

        var go = function () {
          if (!confirm('Publicar agora no Meta?')) return;
          api('social.php', { method: 'POST', body: apiBrandBody({ action: 'publish', id: state.selectedPostId }) })
            .then(function (data) {
              state.posts = data.posts || [];
              state.listFilter = 'published';
              toast('Publicado');
              global.StoffusCmsRerender();
            })
            .catch(function (err) { toast(err.error || 'Falha na publicação.'); });
        };

        api('social.php', {
          method: 'POST',
          body: apiBrandBody({ action: 'update', id: state.selectedPostId, post: prep }),
        }).then(function (data) {
          state.posts = data.posts || [];
          go();
        }).catch(function () { go(); });
      };
    }

    var requeue = document.getElementById('cms-social-requeue');
    if (requeue) {
      requeue.onclick = function () {
        var when = (document.getElementById('cms-social-when') || {}).value || '';
        var platforms = readEditPlatforms();
        api('social.php', {
          method: 'POST',
          body: apiBrandBody({
            action: 'update',
            id: state.selectedPostId,
            post: {
              status: 'scheduled',
              caption: (document.getElementById('cms-social-caption') || {}).value || '',
              platforms: platforms,
              scheduledAt: when ? new Date(when).toISOString() : undefined,
            },
          }),
        }).then(function (data) {
          state.posts = data.posts || [];
          state.listFilter = 'scheduled';
          toast('Voltou ao estado agendada');
          global.StoffusCmsRerender();
        }).catch(function (err) { toast(err.error || 'Erro.'); });
      };
    }

    var delPost = document.getElementById('cms-social-delete-post');
    if (delPost) {
      delPost.onclick = function () {
        if (!confirm('Apagar esta publicação do CMS? (Não remove do Facebook/Instagram se já estiver online.)')) return;
        api('social.php', { method: 'POST', body: apiBrandBody({ action: 'delete', id: state.selectedPostId }) })
          .then(function (data) {
            state.posts = data.posts || [];
            state.selectedPostId = null;
            toast('Publicação apagada do CMS');
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
