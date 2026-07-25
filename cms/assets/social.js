/**
 * Módulo Redes — planeamento em bulk + calendário + gestão de publicações.
 * Expõe window.StoffusSocial
 */
(function (global) {
  var state = {
    brand: 'stoffus',
    brands: [
      {
        id: 'stoffus', label: 'Stoffus', short: 'Stoffus', configured: false,
        logo: 'assets/brands/stoffus-logo.png', mark: 'assets/brands/stoffus-mark.png', color: '#e04e26',
      },
      {
        id: 'divinus', label: 'Divinus Confort', short: 'Divinus', configured: false,
        logo: 'assets/brands/divinus-logo.png', mark: 'assets/brands/divinus-mark.png', color: '#00a8d6',
      },
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
    calView: 'month',
    targetDay: null,
    selectedPostId: null,
    previewSlide: 0,
    listFilter: 'all',
    listSort: 'newest',
    listQuery: '',
    listPage: 1,
    panelView: 'calendar',
    metaHistory: [],
    metaHistoryLoading: false,
    metaHistoryError: '',
    uploading: false,
    metaFormOpen: false,
    discoveredPages: [],
    discoverMap: { stoffus: '', divinus: '' },
    discoverWarning: '',
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
    if (state.calView === 'week') return fmtWeekRange(startOfWeek(anchor));
    return anchor.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
  }

  function shiftCalendar(dir) {
    var a = ensureAnchor();
    if (state.calView === 'week') {
      state.weekStart = addDays(startOfWeek(a), dir * 7);
    } else {
      state.weekStart = new Date(a.getFullYear(), a.getMonth() + dir, 1);
    }
  }

  function postWhen(p) {
    if (!p) return null;
    if (p.status === 'published' && p.publishedAt) {
      try { return new Date(p.publishedAt); } catch (e) { /* fallthrough */ }
    }
    if (p.scheduledAt) {
      try { return new Date(p.scheduledAt); } catch (e2) { /* fallthrough */ }
    }
    if (p.createdAt) {
      try { return new Date(p.createdAt); } catch (e3) { return null; }
    }
    return null;
  }

  function canDragPost(p) {
    var st = (p && p.status) || '';
    return st === 'scheduled' || st === 'draft' || st === 'failed';
  }

  function postsForDay(day) {
    return state.posts.filter(function (p) {
      var when = postWhen(p);
      return when && sameDay(when, day);
    }).sort(function (a, b) {
      return (postWhen(a) || 0) - (postWhen(b) || 0);
    });
  }

  function renderCalPostChip(p, compact) {
    var when = postWhen(p);
    var time = '—';
    try {
      time = when.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { /* ignore */ }
    var thumb = (p.media && p.media[0]) ? mediaUrl(p.media[0]) : '';
    var drag = canDragPost(p);
    var n = (p.media || []).length;
    return '<div class="cms-board-post is-' + esc(p.status || 'draft') +
      (state.selectedPostId === p.id ? ' is-selected' : '') +
      (drag ? ' is-draggable' : '') +
      (compact ? ' is-compact' : '') +
      '" data-post-id="' + esc(p.id) + '"' +
      (drag ? ' draggable="true"' : '') +
      ' title="' + esc(statusLabel(p.status) + ' · ' + time + (drag ? ' · arraste para outro dia' : '')) + '">' +
      (thumb ? '<img src="' + esc(thumb) + '" alt="" loading="lazy" />' : '<span class="cms-board-post__ph"></span>') +
      '<span class="cms-board-post__txt">' +
      '<strong>' + esc(time) + '</strong>' +
      (!compact ? '<em>' + esc(statusLabel(p.status)) + (n ? ' · ' + n + 'º' : '') + '</em>' : '') +
      '</span></div>';
  }

  function renderBoardDay(day, opts) {
    opts = opts || {};
    var today = new Date();
    var target = ensureTargetDay();
    var posts = postsForDay(day);
    var outside = !!opts.outside;
    var maxShow = opts.compact ? 3 : 6;
    var html = '<div class="cms-board-day' +
      (sameDay(day, today) ? ' is-today' : '') +
      (sameDay(day, target) ? ' is-target' : '') +
      (outside ? ' is-outside' : '') +
      (posts.length ? ' has-posts' : '') +
      '" data-cal-day="' + dayKey(day) + '">' +
      '<div class="cms-board-day__head">' +
      '<span class="cms-board-day__num">' + day.getDate() + '</span>' +
      (sameDay(day, target) ? '<span class="cms-board-day__badge">Início</span>' : '') +
      (posts.length ? '<span class="cms-board-day__count">' + posts.length + '</span>' : '') +
      '</div><div class="cms-board-day__posts">';

    posts.slice(0, maxShow).forEach(function (p) {
      html += renderCalPostChip(p, !!opts.compact);
    });
    if (posts.length > maxShow) {
      html += '<div class="cms-board-day__more">+' + (posts.length - maxShow) + ' mais</div>';
    }
    html += '</div></div>';
    return html;
  }

  function renderMonthBoard() {
    var anchor = ensureAnchor();
    var first = startOfMonth(anchor);
    var gridStart = startOfWeek(first);
    var headers = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    var html = '<div class="cms-board-weekdays">' +
      headers.map(function (h) { return '<span>' + h + '</span>'; }).join('') +
      '</div><div class="cms-board cms-board--month">';
    for (var i = 0; i < 42; i++) {
      var day = addDays(gridStart, i);
      html += renderBoardDay(day, {
        outside: day.getMonth() !== anchor.getMonth(),
        compact: true,
      });
    }
    html += '</div>';
    return html;
  }

  function renderWeekBoard() {
    var start = startOfWeek(ensureAnchor());
    var headers = [];
    var cells = [];
    for (var i = 0; i < 7; i++) {
      var day = addDays(start, i);
      headers.push('<span>' + esc(day.toLocaleDateString('pt-PT', { weekday: 'short' }).replace('.', '')) + '</span>');
      cells.push(renderBoardDay(day, { compact: false }));
    }
    return '<div class="cms-board-weekdays">' + headers.join('') + '</div>' +
      '<div class="cms-board cms-board--week">' + cells.join('') + '</div>';
  }

  function renderSelectedDayPanel() {
    var target = ensureTargetDay();
    var posts = postsForDay(target);
    var dayTitle = target.toLocaleDateString('pt-PT', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
    var html = '<div class="cms-board-side">' +
      '<div class="cms-board-side__head">' +
      '<div><h3>' + esc(dayTitle) + '</h3>' +
      '<p class="cms-hint" style="margin:.2rem 0 0">Dia de início dos novos lotes. Clique noutro dia no calendário para mudar.</p></div>' +
      '<button type="button" class="cms-btn cms-btn--ghost cms-btn--sm" id="cms-social-publish-due">Publicar vencidas</button>' +
      '</div>';

    if (!posts.length) {
      html += '<div class="cms-day-empty"><p><strong>Sem posts neste dia</strong></p>' +
        '<p>Agende um lote ou arraste um post agendado para aqui.</p></div></div>';
      return html;
    }

    html += '<div class="cms-agenda-cards">' +
      posts.map(function (p) {
        var thumbs = (p.media || []).slice(0, 3).map(function (m) {
          return '<img src="' + esc(mediaUrl(m)) + '" alt="" />';
        }).join('');
        var when = postWhen(p);
        var time = '—';
        try {
          time = when.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
        } catch (e) { /* ignore */ }
        var plats = platformsOf(p).map(function (x) { return x === 'instagram' ? 'IG' : 'FB'; }).join(' · ');
        var drag = canDragPost(p);
        return '<button type="button" class="cms-agenda-card is-' + esc(p.status || 'draft') +
          (state.selectedPostId === p.id ? ' is-selected' : '') +
          '" ' + (drag ? 'draggable="true" ' : '') + 'data-post-id="' + esc(p.id) + '">' +
          '<div class="cms-agenda-card__thumbs">' + (thumbs || '<span class="cms-agenda-card__ph"></span>') + '</div>' +
          '<div class="cms-agenda-card__body">' +
          '<strong>' + esc(time) + ' · ' + esc(statusLabel(p.status)) + '</strong>' +
          '<span>' + (p.media || []).length + ' foto(s) · ' + esc(plats || 'sem rede') +
          (drag ? ' · arrastável' : '') + '</span>' +
          '<em>' + esc((p.caption || 'Sem legenda').slice(0, 90)) + '</em>' +
          '</div></button>';
      }).join('') +
      '</div></div>';
    return html;
  }

  function renderCalendar() {
    var title = calendarTitle();
    return '<div class="cms-agenda">' +
      '<div class="cms-board-toolbar">' +
      '<div class="cms-board-legend" aria-label="Legenda">' +
      '<span class="cms-leg is-scheduled">Agendada</span>' +
      '<span class="cms-leg is-published">Publicada</span>' +
      '<span class="cms-leg is-draft">Rascunho</span>' +
      '<span class="cms-leg is-failed">Falhou</span>' +
      '</div>' +
      '<div class="cms-cal-views">' +
      '<button type="button" class="cms-cal-view-btn' + (state.calView === 'month' ? ' is-active' : '') +
      '" data-cal-view="month">Mês</button>' +
      '<button type="button" class="cms-cal-view-btn' + (state.calView === 'week' ? ' is-active' : '') +
      '" data-cal-view="week">Semana</button>' +
      '</div></div>' +
      '<div class="cms-agenda__nav">' +
      '<button type="button" class="cms-btn cms-btn--ghost cms-btn--sm" id="cms-social-prev">' +
      (state.calView === 'week' ? '← Semana' : '← Mês') + '</button>' +
      '<div class="cms-agenda__range"><strong>' + esc(title) + '</strong>' +
      '<button type="button" class="cms-btn cms-btn--ghost cms-btn--sm" id="cms-social-today">Hoje</button></div>' +
      '<button type="button" class="cms-btn cms-btn--ghost cms-btn--sm" id="cms-social-next">' +
      (state.calView === 'week' ? 'Semana →' : 'Mês →') + '</button>' +
      '</div>' +
      '<p class="cms-board-tip">Clique num dia para o escolher · Arraste <em>agendadas / rascunhos</em> entre dias · Clique num post para editar</p>' +
      (state.calView === 'week' ? renderWeekBoard() : renderMonthBoard()) +
      renderSelectedDayPanel() +
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

  function openImageLightbox(urls) {
    var list = (urls || []).filter(Boolean);
    if (!list.length) return;
    var idx = 0;
    var old = document.getElementById('cms-lightbox');
    if (old) old.remove();

    var overlay = document.createElement('div');
    overlay.id = 'cms-lightbox';
    overlay.className = 'cms-lightbox';
    overlay.innerHTML =
      '<button type="button" class="cms-lightbox__close" aria-label="Fechar">×</button>' +
      (list.length > 1
        ? '<button type="button" class="cms-lightbox__nav cms-lightbox__nav--prev" aria-label="Anterior">‹</button>' +
          '<button type="button" class="cms-lightbox__nav cms-lightbox__nav--next" aria-label="Seguinte">›</button>'
        : '') +
      '<img class="cms-lightbox__img" alt="" />' +
      '<div class="cms-lightbox__count"></div>';
    document.body.appendChild(overlay);

    var img = overlay.querySelector('.cms-lightbox__img');
    var count = overlay.querySelector('.cms-lightbox__count');
    function show(i) {
      idx = (i + list.length) % list.length;
      img.src = list[idx];
      if (count) count.textContent = (idx + 1) + ' / ' + list.length;
    }
    function close() { overlay.remove(); }

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay || e.target.classList.contains('cms-lightbox__close')) close();
    });
    var prev = overlay.querySelector('.cms-lightbox__nav--prev');
    var next = overlay.querySelector('.cms-lightbox__nav--next');
    if (prev) prev.onclick = function (e) { e.stopPropagation(); show(idx - 1); };
    if (next) next.onclick = function (e) { e.stopPropagation(); show(idx + 1); };
    show(0);
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
    state.listQuery = '';
    state.listPage = 1;
    state.metaHistory = [];
    state.metaHistoryError = '';
    load().then(function () {
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
    var q = String(state.listQuery || '').trim().toLowerCase();
    var list = state.posts.slice().filter(function (p) {
      if (state.listFilter !== 'all' && p.status !== state.listFilter) return false;
      if (!q) return true;
      var cap = String(p.caption || '').toLowerCase();
      var id = String(p.id || '').toLowerCase();
      return cap.indexOf(q) >= 0 || id.indexOf(q) >= 0;
    });
    list.sort(function (a, b) {
      var da = new Date(a.publishedAt || a.scheduledAt || a.createdAt || 0).getTime();
      var db = new Date(b.publishedAt || b.scheduledAt || b.createdAt || 0).getTime();
      return state.listSort === 'oldest' ? da - db : db - da;
    });
    return list;
  }

  function facebookPostUrl(post) {
    var ids = post && post.metaPostIds;
    if (!ids || !ids.facebook) return '';
    var fbId = String(ids.facebook);
    // Formato pageId_postId ou só postId
    if (fbId.indexOf('_') >= 0) {
      return 'https://www.facebook.com/' + fbId.replace('_', '/posts/');
    }
    return 'https://www.facebook.com/' + encodeURIComponent(fbId);
  }

  function fmtDateTime(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('pt-PT', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch (e) {
      return '—';
    }
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

  function postHasMetaIds(post) {
    var ids = post && post.metaPostIds;
    if (!ids || typeof ids !== 'object') return false;
    return !!(ids.facebook || ids.instagram);
  }

  function confirmDeletePost(post) {
    if (!post) return { ok: false, deleteMeta: false };
    var onMeta = post.status === 'published' || postHasMetaIds(post);
    if (!onMeta) {
      return {
        ok: confirm('Apagar esta publicação do CMS?'),
        deleteMeta: false,
      };
    }
    var choice = confirm(
      'Esta publicação pode estar no Facebook/Instagram.\n\n' +
      'OK = apagar no CMS e no Meta\n' +
      'Cancelar = não apagar'
    );
    if (!choice) return { ok: false, deleteMeta: false };
    return { ok: true, deleteMeta: true };
  }

  function deletePostById(id, deleteMeta) {
    return api('social.php', {
      method: 'POST',
      body: apiBrandBody({ action: 'delete', id: id, delete_meta: !!deleteMeta }),
    }).then(function (data) {
      state.posts = data.posts || [];
      if (state.selectedPostId === id) state.selectedPostId = null;
      var meta = data.meta_delete;
      if (deleteMeta && meta && meta.errors && meta.errors.length) {
        toast('Apagada no CMS. Meta: ' + meta.errors[0]);
      } else if (deleteMeta) {
        toast('Apagada no CMS e no Meta');
      } else {
        toast('Publicação apagada do CMS');
      }
      global.StoffusCmsRerender();
    });
  }

  function loadMetaHistory(silent) {
    if (!state.meta.configured) {
      if (!silent) toast('Configure a Meta desta marca primeiro.');
      return Promise.resolve();
    }
    state.metaHistoryLoading = true;
    state.metaHistoryError = '';
    if (!silent) global.StoffusCmsRerender();
    return api('social.php?action=meta_history&brand=' + encodeURIComponent(state.brand) + '&limit=40')
      .then(function (data) {
        state.metaHistory = data.posts || [];
        state.metaHistoryError = '';
        if (!silent) {
          if (!state.metaHistory.length) toast('Sem publicações recentes na página Facebook.');
          else toast(state.metaHistory.length + ' publicação(ões) do Facebook');
        }
      })
      .catch(function (err) {
        state.metaHistory = [];
        state.metaHistoryError = err.error || 'Não foi possível carregar o histórico do Facebook.';
        if (!silent) toast(state.metaHistoryError);
      })
      .finally(function () {
        state.metaHistoryLoading = false;
        global.StoffusCmsRerender();
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
    var perPage = 15;
    var totalPages = Math.max(1, Math.ceil(posts.length / perPage));
    if (state.listPage > totalPages) state.listPage = totalPages;
    if (state.listPage < 1) state.listPage = 1;
    var pagePosts = posts.slice((state.listPage - 1) * perPage, state.listPage * perPage);
    var draftCount = state.posts.filter(function (p) { return p.status === 'draft'; }).length;
    var publishedCount = state.posts.filter(function (p) { return p.status === 'published'; }).length;
    var expanded = state.panelView === 'history';

    var html = '<div class="cms-posts-list' + (expanded ? ' is-expanded' : '') + '">' +
      '<div class="cms-posts-list__head">' +
      '<div><h2>Publicações</h2>' +
      '<p class="cms-hint" style="margin:0">No Facebook (página) e no CMS (criadas aqui).</p></div>' +
      '<div class="cms-tabs cms-tabs--sub">' +
      filters.map(function (f) {
        var n = f.id === 'all' ? state.posts.length : state.posts.filter(function (p) { return p.status === f.id; }).length;
        return '<button type="button" class="cms-tab' + (state.listFilter === f.id ? ' is-active' : '') +
          '" data-list-filter="' + f.id + '">' + f.label + ' (' + n + ')</button>';
      }).join('') +
      '</div></div>';

    // --- Facebook (já publicados na Página) ---
    html += '<div class="cms-meta-history">' +
      '<div class="cms-meta-history__head">' +
      '<div><h3>No Facebook · ' + esc(currentBrandInfo().short) + '</h3>' +
      '<p class="cms-hint" style="margin:.2rem 0 0">Posts já na Página (feitos no CMS ou no Facebook).</p></div>' +
      '<button type="button" class="cms-btn cms-btn--ghost cms-btn--sm" id="cms-meta-history-load">' +
      (state.metaHistoryLoading ? 'A carregar…' : 'Actualizar') + '</button></div>';

    if (!state.meta.configured) {
      html += '<p class="cms-hint">Configure a Meta desta marca para ver e apagar posts da Página.</p>';
    } else if (state.metaHistoryError) {
      html += '<p class="cms-status is-error">' + esc(state.metaHistoryError) + '</p>';
    } else if (state.metaHistoryLoading && !(state.metaHistory && state.metaHistory.length)) {
      html += '<p class="cms-hint">A carregar publicações do Facebook…</p>';
    } else if (state.metaHistory && state.metaHistory.length) {
      html += '<div class="cms-meta-history__rows">';
      state.metaHistory.forEach(function (item) {
        var href = item.permalink_url || ('https://www.facebook.com/' + item.id);
        var imgs = Array.isArray(item.images) && item.images.length
          ? item.images
          : (item.full_picture ? [item.full_picture] : []);
        var thumb = imgs[0] || '';
        var more = imgs.length > 1 ? '<em>+' + (imgs.length - 1) + '</em>' : '';
        html += '<div class="cms-meta-history__row">' +
          (thumb
            ? '<button type="button" class="cms-meta-history__thumb" data-meta-lightbox="' +
              esc(imgs.join('|')) + '" title="Ver imagens">' +
              '<img src="' + esc(thumb) + '" alt="" loading="lazy" />' + more + '</button>'
            : '<span class="cms-meta-history__ph"></span>') +
          '<a href="' + esc(href) + '" target="_blank" rel="noopener" data-stop>' +
          '<strong>' + esc(fmtDateTime(item.created_time)) + '</strong>' +
          '<span>' + esc((item.message || 'Sem texto').slice(0, 140)) + '</span></a>' +
          '<button type="button" class="cms-btn cms-btn--danger cms-btn--sm" data-delete-meta-id="' +
          esc(item.id) + '" title="Apagar no Facebook">Apagar</button>' +
          '</div>';
      });
      html += '</div>';
    } else {
      html += '<p class="cms-hint">Ainda sem dados. Clique em <em>Actualizar</em> para carregar da Página.</p>';
    }
    html += '</div>';

    // --- CMS ---
    html += '<div class="cms-posts-list__tools">' +
      '<input class="cms-input" type="search" id="cms-list-query" value="' + esc(state.listQuery) +
      '" placeholder="Pesquisar no CMS…" />' +
      '<select class="cms-input" id="cms-list-sort">' +
      '<option value="newest"' + (state.listSort === 'newest' ? ' selected' : '') + '>Mais recentes</option>' +
      '<option value="oldest"' + (state.listSort === 'oldest' ? ' selected' : '') + '>Mais antigas</option>' +
      '</select></div>';

    html += '<div class="cms-posts-list__actions">' +
      '<strong class="cms-posts-list__sub">No CMS (' + state.posts.length + ')</strong>';
    if (draftCount > 0) {
      html += '<button type="button" class="cms-btn cms-btn--danger cms-btn--sm" id="cms-social-delete-drafts">' +
        'Apagar rascunhos (' + draftCount + ')</button>';
    }
    if (publishedCount > 0) {
      html += '<button type="button" class="cms-btn cms-btn--danger cms-btn--sm" id="cms-social-delete-published">' +
        'Apagar publicadas CMS + Meta (' + publishedCount + ')</button>';
    }
    html += '</div>';

    if (!pagePosts.length) {
      html += '<p class="cms-hint">Nenhuma publicação criada neste CMS' +
        (state.listQuery ? ' / pesquisa' : '') +
        '. Os posts antigos do Facebook estão na secção acima.</p></div>';
      return html;
    }

    html += '<div class="cms-posts-list__rows">';
    pagePosts.forEach(function (p) {
      var whenLabel = p.status === 'published' ? 'Publicada' : 'Agendada';
      var when = fmtDateTime(p.publishedAt || p.scheduledAt);
      var created = fmtDateTime(p.createdAt);
      var thumb = (p.media && p.media[0]) ? mediaUrl(p.media[0]) : '';
      var plats = platformsOf(p).map(function (x) { return x === 'instagram' ? 'IG' : 'FB'; }).join(' · ');
      var fbUrl = facebookPostUrl(p);
      html += '<div class="cms-post-row' +
        (state.selectedPostId === p.id ? ' is-selected' : '') +
        '" data-post-id="' + esc(p.id) + '">' +
        (thumb ? '<img src="' + esc(thumb) + '" alt="" />' : '<span class="cms-post-row__ph"></span>') +
        '<span class="cms-post-row__body">' +
        '<strong>' + esc(whenLabel) + ': ' + esc(when) + '</strong>' +
        '<span>' + (p.media || []).length + ' fotos · ' + esc(plats || 'sem rede') + ' · ' +
        esc(statusLabel(p.status)) + (postHasMetaIds(p) ? ' · no Meta' : '') +
        ' · criada ' + esc(created) + '</span>' +
        '<span class="cms-post-row__cap">' + esc((p.caption || '').slice(0, 140) || 'Sem legenda') + '</span>' +
        (fbUrl ? '<a class="cms-post-row__link" href="' + esc(fbUrl) + '" target="_blank" rel="noopener" data-stop>Ver no Facebook</a>' : '') +
        '</span>' +
        '<button type="button" class="cms-btn cms-btn--danger cms-btn--sm cms-post-row__del" data-delete-post="' +
        esc(p.id) + '" title="Apagar">×</button>' +
        '</div>';
    });
    html += '</div>';

    if (totalPages > 1) {
      html += '<div class="cms-posts-pager">' +
        '<button type="button" class="cms-btn cms-btn--ghost cms-btn--sm" id="cms-list-prev"' +
        (state.listPage <= 1 ? ' disabled' : '') + '>← Anterior</button>' +
        '<span>Página ' + state.listPage + ' / ' + totalPages + '</span>' +
        '<button type="button" class="cms-btn cms-btn--ghost cms-btn--sm" id="cms-list-next"' +
        (state.listPage >= totalPages ? ' disabled' : '') + '>Seguinte →</button></div>';
    }

    html += '</div>';
    return html;
  }

  function composePreviewPost() {
    var paths = selectedPaths();
    if (!paths.length) return null;
    var split = Math.max(1, Math.min(10, Number(state.settings.autoSplitSize) || 10));
    var target = ensureTargetDay();
    return {
      id: '__compose__',
      status: 'compose',
      caption: state.settings.defaultCaption || '',
      scheduledAt: target.toISOString(),
      platforms: (state.settings.defaultPlatforms || []).slice(),
      media: paths.slice(0, split),
    };
  }

  function renderPreview(post, opts) {
    opts = opts || {};
    var isCompose = !!opts.compose || (post && post.status === 'compose');
    if (!post) {
      return '<div class="cms-preview-phone cms-preview-phone--empty">' +
        '<div class="cms-preview-phone__body">' +
        '<i class="fa-regular fa-images"></i>' +
        '<p><strong>Pré-visualização do post</strong></p>' +
        '<p>Adicione fotos ao lote para ver como fica no telemóvel.</p>' +
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
    var mark = brandMarkUrl(info);
    var when = '';
    try {
      when = new Date(post.scheduledAt).toLocaleString('pt-PT', {
        weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      });
    } catch (e) { when = ''; }

    var statusTxt = isCompose ? 'Em criação' : statusLabel(post.status);
    var chromeNet = isIg
      ? '<i class="fa-brands fa-instagram"></i> Instagram'
      : '<i class="fa-brands fa-facebook"></i> Facebook';
    if (isCompose && plats.length > 1) {
      chromeNet = '<i class="fa-brands fa-facebook"></i>/<i class="fa-brands fa-instagram"></i> Redes';
    }

    var dots = media.map(function (_, i) {
      return '<button type="button" class="cms-preview-dot' + (i === state.previewSlide ? ' is-active' : '') +
        '" data-preview-slide="' + i + '" aria-label="Foto ' + (i + 1) + '"></button>';
    }).join('');

    var slideSrc = '';
    if (slide) {
      var poolHit = state.pool.find(function (f) { return f.path === slide; });
      slideSrc = (poolHit && poolHit.url) ? poolHit.url : mediaUrl(slide);
    }

    return '<div class="cms-preview-phone' + (isCompose ? ' is-compose' : '') + '">' +
      '<div class="cms-preview-phone__chrome">' +
      '<span>' + chromeNet + '</span>' +
      '<span>' + esc(when) + '</span></div>' +
      '<div class="cms-preview-phone__head">' +
      (mark
        ? '<img class="cms-preview-phone__avatar-img" src="' + esc(mark) + '" alt="" />'
        : '<div class="cms-preview-phone__avatar">' + esc((info.short || 'S').charAt(0)) + '</div>') +
      '<div><strong>' + esc(brand) + '</strong><span>' + esc(statusTxt) + '</span></div></div>' +
      (isCompose
        ? '<p class="cms-preview-compose-note">1.º post do lote · ' + media.length +
          ' de ' + selectedPaths().length + ' foto(s) seleccionada(s)</p>'
        : '') +
      '<div class="cms-preview-phone__media">' +
      (slideSrc
        ? '<img src="' + esc(slideSrc) + '" alt="Pré-visualização" />'
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
      return '';
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
        ? '<button type="button" class="cms-btn cms-btn--ghost cms-btn--sm" id="cms-social-save-draft">Guardar como rascunho</button>'
        : '') +
      (!published
        ? '<button type="button" class="cms-btn cms-btn--ghost cms-btn--sm" id="cms-social-publish-now">Publicar agora</button>'
        : '<button type="button" class="cms-btn cms-btn--ghost cms-btn--sm" id="cms-social-requeue">Voltar a agendar</button>') +
      (post.status === 'failed'
        ? '<button type="button" class="cms-btn cms-btn--ghost cms-btn--sm" id="cms-social-publish-now">Tentar de novo</button>'
        : '') +
      '<button type="button" class="cms-btn cms-btn--danger cms-btn--sm" id="cms-social-delete-post">' +
      (published || postHasMetaIds(post) ? 'Apagar CMS + Meta' : 'Apagar do CMS') +
      '</button>' +
      (published || postHasMetaIds(post)
        ? '<button type="button" class="cms-btn cms-btn--ghost cms-btn--sm" id="cms-social-delete-cms-only">Só no CMS</button>'
        : '') +
      '</div>' +
      (published
        ? '<p class="cms-hint">«Apagar CMS + Meta» remove também do Facebook/Instagram (se o ID estiver guardado). «Só no CMS» mantém online na Meta.</p>'
        : '<p class="cms-hint">Para mudar o dia: altere a data acima, use «Mover para o dia escolhido», ou arraste no calendário.</p>') +
      '</div>';
  }

  function brandLogoUrl(b) {
    return (b && b.logo) ? b.logo : '';
  }

  function brandMarkUrl(b) {
    return (b && (b.mark || b.logo)) ? (b.mark || b.logo) : '';
  }

  function renderBrandSwitcher() {
    return '<div class="cms-brand-switch" role="tablist" aria-label="Marca">' +
      state.brands.map(function (b) {
        var logo = brandLogoUrl(b);
        var mark = brandMarkUrl(b);
        return '<button type="button" class="cms-brand-btn cms-brand-btn--' + esc(b.id) +
          (state.brand === b.id ? ' is-active' : '') +
          '" data-brand="' + esc(b.id) + '" aria-selected="' + (state.brand === b.id ? 'true' : 'false') + '">' +
          '<span class="cms-brand-btn__visual">' +
          (logo
            ? '<img class="cms-brand-btn__logo" src="' + esc(logo) + '" alt="' + esc(b.label || b.short) + '" />'
            : '<img class="cms-brand-btn__mark" src="' + esc(mark) + '" alt="" />') +
          '</span>' +
          '<span class="cms-brand-btn__meta">' +
          '<strong>' + esc(b.short || b.label) + '</strong>' +
          '<span>' + (b.configured ? 'Meta OK' : 'Meta por configurar') + '</span>' +
          '</span></button>';
      }).join('') +
      '</div>';
  }

  function guessPageForBrand(brandId, pages) {
    var needles = brandId === 'divinus'
      ? ['divinus', 'confort']
      : ['stoffus'];
    for (var i = 0; i < pages.length; i++) {
      var name = String(pages[i].name || '').toLowerCase();
      for (var n = 0; n < needles.length; n++) {
        if (name.indexOf(needles[n]) >= 0) return pages[i].id;
      }
    }
    return pages[0] ? pages[0].id : '';
  }

  function renderMetaConfig() {
    var info = currentBrandInfo();
    var meta = state.meta || {};
    var open = !!state.metaFormOpen;
    var pages = state.discoveredPages || [];
    var map = state.discoverMap || { stoffus: '', divinus: '' };
    var divinusOk = !!(state.brands.find(function (b) { return b.id === 'divinus' && b.configured; }));
    var stoffusOk = !!(state.brands.find(function (b) { return b.id === 'stoffus' && b.configured; }));

    var discoverHtml = '';
    if (pages.length) {
      discoverHtml = '<div class="cms-meta-discover">' +
        (state.discoverWarning
          ? '<p class="cms-status is-error">' + esc(state.discoverWarning) + '</p>'
          : '') +
        '<p class="cms-hint" style="margin:0 0 .5rem"><strong>' + pages.length +
        ' página(s)</strong> no token:</p>' +
        '<ul class="cms-meta-page-list">' +
        pages.map(function (p) {
          return '<li><strong>' + esc(p.name) + '</strong> · ID ' + esc(p.id) +
            (p.instagram_business_id ? ' · IG ligado' : '') + '</li>';
        }).join('') +
        '</ul>' +
        state.brands.map(function (b) {
          return '<label class="cms-field"><span>Marca «' + esc(b.label) + '» → Página</span>' +
            '<select class="cms-input" data-discover-brand="' + esc(b.id) + '">' +
            '<option value="">— Não associar —</option>' +
            pages.map(function (p) {
              var sel = map[b.id] === p.id ? ' selected' : '';
              return '<option value="' + esc(p.id) + '"' + sel + '>' +
                esc(p.name) + ' (' + esc(p.id) + ')</option>';
            }).join('') +
            '</select></label>';
        }).join('') +
        '<button type="button" class="cms-btn cms-btn--brand cms-btn--sm" id="cms-meta-import" style="margin-top:.5rem">' +
        'Guardar Stoffus + Divinus</button></div>';
    }

    var missingBanner = '';
    if (!divinusOk || !stoffusOk) {
      missingBanner = '<div class="cms-meta-missing">' +
        (!stoffusOk ? '<span>Stoffus sem Meta</span>' : '<span class="is-ok">Stoffus OK</span>') +
        (!divinusOk ? '<span>Divinus sem Meta — associe a Página abaixo</span>' : '<span class="is-ok">Divinus OK</span>') +
        '</div>';
    }

    return '<section class="cms-surface cms-meta-config">' +
      '<div class="cms-meta-config__head">' +
      '<div><h2>Configuração Meta · Stoffus Socials</h2>' +
      '<p class="cms-hint">Use um <strong>User Access Token</strong> (não o token de uma Página só) e autorize Stoffus e Divinus Confort.</p></div>' +
      '<button type="button" class="cms-btn cms-btn--ghost cms-btn--sm" id="cms-meta-toggle">' +
      (open ? 'Fechar' : 'Configurar Meta') + '</button></div>' +
      missingBanner +
      (open
        ? '<div class="cms-meta-config__form">' +
          '<div class="cms-meta-import-box">' +
          '<label class="cms-field"><span>User Access Token (Stoffus Socials)</span>' +
          '<input class="cms-input" type="password" id="cms-meta-user-token" value="" ' +
          'placeholder="Graph API Explorer → Generate Access Token (User)" autocomplete="new-password" /></label>' +
          '<div style="display:flex;flex-wrap:wrap;gap:.4rem">' +
          '<button type="button" class="cms-btn cms-btn--brand cms-btn--sm" id="cms-meta-discover">Carregar páginas do token</button>' +
          '</div>' +
          '<p class="cms-hint">Se só aparecer a Stoffus: no Explorer volte a autorizar e <strong>marque também Divinus Confort</strong> na lista de Páginas.</p>' +
          discoverHtml +
          '<hr class="cms-meta-hr" />' +
          '<p class="cms-hint"><strong>Divinus pelo Page ID</strong> (se já souber o ID da Página)</p>' +
          '<label class="cms-field"><span>Page ID Divinus Confort</span>' +
          '<input class="cms-input" type="text" id="cms-meta-divinus-page-id" value="" ' +
          'placeholder="ID numérico da Página Divinus no Facebook" autocomplete="off" /></label>' +
          '<button type="button" class="cms-btn cms-btn--ghost cms-btn--sm" id="cms-meta-resolve-divinus">' +
          'Associar este ID à Divinus com o token acima</button>' +
          '</div>' +
          '<hr class="cms-meta-hr" />' +
          '<p class="cms-hint"><strong>Ajuste manual · ' + esc(info.label) + '</strong></p>' +
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
          '<label class="cms-pill"><input type="checkbox" id="cms-meta-clear-token" /> Apagar token guardado desta marca</label>' +
          '<div style="display:flex;flex-wrap:wrap;gap:.45rem;margin-top:.75rem">' +
          '<button type="button" class="cms-btn cms-btn--ghost cms-btn--sm" id="cms-meta-save">Guardar só ' +
          esc(info.short) + '</button>' +
          '</div>' +
          '<p class="cms-hint">Para publicar, o CMS tem de estar online (URL público das imagens).</p>' +
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
    var composePost = composePreviewPost();
    var target = ensureTargetDay();
    var targetLabel = target.toLocaleDateString('pt-PT', {
      weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
    });

    return '<div class="cms-social' + (selected ? ' has-edit' : '') + '" data-social-brand="' + esc(state.brand) + '">' +
      renderBrandSwitcher() +
      renderMetaConfig() +
      renderStats() +
      '<div class="cms-social__grid">' +

      '<section class="cms-surface cms-surface--compose">' +
      '<div class="cms-compose">' +
      '<div class="cms-compose__form">' +
      '<div style="display:flex;justify-content:space-between;gap:.75rem;align-items:flex-start;flex-wrap:wrap">' +
      '<div><h2>Criar post · ' + esc(info.label) + '</h2>' +
      '<p class="cms-hint">1) Fotos · 2) Redes e legenda · 3) Escolha o dia na Agenda · 4) Agendar</p></div>' +
      metaBadge + '</div>' +
      '<div class="cms-drop" id="cms-social-drop">' +
      '<input type="file" id="cms-social-file" accept="image/jpeg,image/png,image/webp,image/gif" multiple />' +
      '<strong>Largar fotos aqui</strong><span>JPG, PNG ou WebP · até 12 MB cada</span></div>' +
      renderPool() +
      '<div class="cms-field" style="margin-top:1rem"><span>Publicar em</span>' +
      renderPlatformToggles('batch', state.settings.defaultPlatforms || []) +
      '</div>' +
      '<label class="cms-field" style="margin-top:1rem"><span>Legenda</span>' +
      '<textarea id="cms-social-default-caption" rows="3" placeholder="Escreva a legenda — vê-se na pré-visualização">' +
      esc(state.settings.defaultCaption) +
      '</textarea></label>' +
      '<div class="cms-social-toolbar">' +
      '<label class="cms-field"><span>Fotos por post</span>' +
      '<input class="cms-input" type="number" id="cms-social-split" min="1" max="10" value="' +
      esc(state.settings.autoSplitSize) + '" /></label>' +
      '<label class="cms-field"><span>Intervalo entre posts (h)</span>' +
      '<input class="cms-input" type="number" id="cms-social-interval" min="1" max="72" value="24" /></label>' +
      '<label class="cms-field"><span>Hora de início</span>' +
      '<input class="cms-input" type="datetime-local" id="cms-social-start" value="' +
      esc(toLocalInputValue(target)) + '" /></label>' +
      '</div>' +
      '<div class="cms-target-banner">' +
      '<div><strong>Começa em</strong><span>' + esc(targetLabel) + '</span>' +
      '<em>Clique num dia no calendário para mudar.</em></div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:.4rem">' +
      '<button type="button" class="cms-btn cms-btn--ghost" id="cms-social-draft-btn">Só rascunho</button>' +
      '<button type="button" class="cms-btn cms-btn--brand" id="cms-social-split-btn">Agendar lote</button>' +
      '</div></div>' +
      (!state.meta.configured
        ? '<p class="cms-hint">Configure a Meta acima (botão «Configurar Meta») para esta marca.</p>'
        : '') +
      '</div>' +
      '<aside class="cms-compose__preview">' +
      '<h2>Pré-visualização</h2>' +
      '<p class="cms-hint">Como fica o post enquanto o cria.</p>' +
      renderPreview(composePost, { compose: true }) +
      '</aside>' +
      '</div></section>' +

      '<section class="cms-surface">' +
      '<div class="cms-cal-head">' +
      '<div><h2>Agenda · ' + esc(info.short) + '</h2>' +
      '<p class="cms-hint" style="margin:.35rem 0 0">' +
      (state.panelView === 'calendar'
        ? 'Calendário com todos os posts. Arraste agendadas e rascunhos entre dias.'
        : 'Lista e histórico do Facebook desta marca.') +
      '</p></div>' +
      '<div class="cms-panel-views">' +
      '<button type="button" class="cms-cal-view-btn' + (state.panelView === 'calendar' ? ' is-active' : '') +
      '" data-panel-view="calendar">Calendário</button>' +
      '<button type="button" class="cms-cal-view-btn' + (state.panelView === 'history' ? ' is-active' : '') +
      '" data-panel-view="history">Lista</button>' +
      '</div></div>' +
      (state.panelView === 'calendar'
        ? '<div id="cms-social-cal">' + renderCalendar() + '</div>'
        : renderPostsList()) +
      '</section>' +

      (selected
        ? '<section class="cms-surface cms-surface--preview">' +
          '<h2>3. Editar publicação</h2>' +
          '<p class="cms-hint">Ajuste data, redes e legenda da publicação seleccionada na agenda.</p>' +
          renderDrawer() +
          '</section>'
        : '') +

      '</div></div>';
  }

  function selectPost(id, jumpWeek) {
    if (state.selectedPostId !== id) state.previewSlide = 0;
    state.selectedPostId = id;
    var post = state.posts.find(function (p) { return p.id === id; });
    var when = postWhen(post);
    if (jumpWeek && when) {
      state.targetDay = when;
      state.weekStart = state.calView === 'week' ? startOfWeek(when) : startOfMonth(when);
    }
    global.StoffusCmsRerender();
  }

  function movePostToDay(id, dayKeyStr) {
    var post = state.posts.find(function (p) { return p.id === id; });
    if (!post) return;
    if (!canDragPost(post)) {
      toast('Só pode arrastar agendadas, rascunhos ou falhas.');
      return;
    }
    var prev = postWhen(post) || new Date();
    var nextDate = parseDayKey(dayKeyStr);
    nextDate.setHours(prev.getHours(), prev.getMinutes(), 0, 0);
    var patch = { scheduledAt: nextDate.toISOString() };
    if (post.status === 'failed' || post.status === 'draft') {
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
    document.querySelectorAll('.cms-brand-btn[data-brand]').forEach(function (btn) {
      btn.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
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

    var metaDiscover = document.getElementById('cms-meta-discover');
    if (metaDiscover) {
      metaDiscover.onclick = function () {
        var token = ((document.getElementById('cms-meta-user-token') || {}).value || '').trim();
        if (!token) {
          toast('Cole o token da Meta (User Access Token).');
          return;
        }
        toast('A carregar páginas…');
        api('social.php', {
          method: 'POST',
          body: { action: 'discover_pages', brand: state.brand, access_token: token },
        }).then(function (data) {
          state.discoveredPages = data.pages || [];
          state.discoverWarning = data.warning || '';
          state.discoverMap = {
            stoffus: guessPageForBrand('stoffus', state.discoveredPages),
            divinus: guessPageForBrand('divinus', state.discoveredPages),
          };
          if (state.discoverMap.stoffus && state.discoverMap.stoffus === state.discoverMap.divinus) {
            var other = state.discoveredPages.find(function (p) {
              return p.id !== state.discoverMap.stoffus;
            });
            if (other) state.discoverMap.divinus = other.id;
            else state.discoverMap.divinus = '';
          }
          if (state.discoveredPages.length < 2) {
            state.discoverWarning = (state.discoverWarning ? state.discoverWarning + ' ' : '') +
              'Só veio ' + state.discoveredPages.length +
              ' página. Para a Divinus, regenere o User Token e marque também «Divinus Confort».';
          }
          toast(state.discoveredPages.length + ' página(s) encontradas');
          global.StoffusCmsRerender();
        }).catch(function (err) {
          toast(err.error || 'Não foi possível listar as páginas.');
        });
      };
    }

    var metaResolveDivinus = document.getElementById('cms-meta-resolve-divinus');
    if (metaResolveDivinus) {
      metaResolveDivinus.onclick = function () {
        var token = ((document.getElementById('cms-meta-user-token') || {}).value || '').trim();
        var pageId = ((document.getElementById('cms-meta-divinus-page-id') || {}).value || '').trim();
        if (!token) {
          toast('Cole o User Access Token acima.');
          return;
        }
        if (!pageId) {
          toast('Indique o Page ID da Divinus.');
          return;
        }
        api('social.php', {
          method: 'POST',
          body: {
            action: 'resolve_page',
            brand: 'divinus',
            target_brand: 'divinus',
            access_token: token,
            page_id: pageId,
          },
        }).then(function (data) {
          if (data.brands) state.brands = data.brands;
          if (state.brand === 'divinus') state.meta = data.meta || state.meta;
          else {
            // Actualizar badge da lista de marcas; meta da marca actual via reload
            load().then(function () { global.StoffusCmsRerender(); });
          }
          toast('Divinus associada: ' + ((data.page && data.page.name) || pageId));
          global.StoffusCmsRerender();
        }).catch(function (err) {
          toast(err.error || 'Não foi possível associar a Divinus.');
        });
      };
    }

    document.querySelectorAll('[data-discover-brand]').forEach(function (sel) {
      sel.onchange = function () {
        var brand = sel.getAttribute('data-discover-brand');
        state.discoverMap[brand] = sel.value || '';
      };
    });

    var metaImport = document.getElementById('cms-meta-import');
    if (metaImport) {
      metaImport.onclick = function () {
        var pages = state.discoveredPages || [];
        if (!pages.length) {
          toast('Carregue primeiro as páginas do token.');
          return;
        }
        var assignments = {};
        ['stoffus', 'divinus'].forEach(function (brandId) {
          var pageId = (state.discoverMap || {})[brandId] || '';
          var page = pages.find(function (p) { return p.id === pageId; });
          if (page) {
            assignments[brandId] = {
              page_id: page.id,
              page_access_token: page.access_token,
              instagram_business_id: page.instagram_business_id || '',
            };
          }
        });
        if (!Object.keys(assignments).length) {
          toast('Escolha pelo menos uma Página para uma marca.');
          return;
        }
        api('social.php', {
          method: 'POST',
          body: { action: 'import_pages', brand: state.brand, assignments: assignments },
        }).then(function (data) {
          if (data.brands) state.brands = data.brands;
          state.meta = data.meta || state.meta;
          state.discoveredPages = [];
          state.metaFormOpen = false;
          var ok = (data.brands || []).filter(function (b) { return b.configured; }).length;
          toast(ok + ' marca(s) com Meta OK');
          global.StoffusCmsRerender();
        }).catch(function (err) {
          toast(err.error || 'Erro ao importar páginas.');
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
        state.previewSlide = 0;
        global.StoffusCmsRerender();
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
          global.StoffusCmsRerender();
        } else if (scope === 'edit') {
          var post = state.posts.find(function (p) { return p.id === state.selectedPostId; });
          if (post) {
            post.platforms = on;
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
    var draftBtn = document.getElementById('cms-social-draft-btn');

    function createFromPool(asDraft) {
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
          status: asDraft ? 'draft' : 'scheduled',
        }),
      }).then(function (data) {
        state.posts = data.posts || [];
        state.settings.defaultCaption = caption;
        state.settings.autoSplitSize = split;
        state.pool = [];
        if (data.created && data.created[0]) {
          state.selectedPostId = data.created[0].id;
          state.listFilter = asDraft ? 'draft' : 'scheduled';
        }
        toast((data.created || []).length + (asDraft ? ' rascunho(s) criado(s)' : ' publicação(ões) criadas'));
        api('social.php', {
          method: 'POST',
          body: apiBrandBody({ action: 'save_settings', settings: state.settings }),
        });
        global.StoffusCmsRerender();
      }).catch(function (err) {
        toast(err.error || 'Erro ao criar.');
      });
    }

    if (splitBtn) splitBtn.onclick = function () { createFromPool(false); };
    if (draftBtn) draftBtn.onclick = function () { createFromPool(true); };

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
      state.targetDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(),
        (state.targetDay || now).getHours(), (state.targetDay || now).getMinutes(), 0, 0);
      global.StoffusCmsRerender();
    };

    document.querySelectorAll('[data-cal-view]').forEach(function (btn) {
      btn.onclick = function () {
        var view = btn.getAttribute('data-cal-view');
        if (!view || view === state.calView) return;
        state.calView = view;
        var anchor = ensureTargetDay();
        state.weekStart = view === 'week' ? startOfWeek(anchor) : startOfMonth(anchor);
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
        state.listPage = 1;
        global.StoffusCmsRerender();
      };
    });

    document.querySelectorAll('[data-panel-view]').forEach(function (btn) {
      btn.onclick = function () {
        var view = btn.getAttribute('data-panel-view');
        if (!view || view === state.panelView) return;
        state.panelView = view;
        if (view === 'history') {
          state.listPage = 1;
          global.StoffusCmsRerender();
          loadMetaHistory(true);
          return;
        }
        global.StoffusCmsRerender();
      };
    });

    var listQuery = document.getElementById('cms-list-query');
    if (listQuery) {
      listQuery.addEventListener('input', function () {
        state.listQuery = listQuery.value || '';
        state.listPage = 1;
        clearTimeout(listQuery._t);
        listQuery._t = setTimeout(function () {
          var pos = listQuery.selectionStart;
          global.StoffusCmsRerender();
          var el = document.getElementById('cms-list-query');
          if (el) {
            el.focus();
            try { el.setSelectionRange(pos, pos); } catch (e2) { /* ignore */ }
          }
        }, 280);
      });
    }

    var listSort = document.getElementById('cms-list-sort');
    if (listSort) {
      listSort.onchange = function () {
        state.listSort = listSort.value === 'oldest' ? 'oldest' : 'newest';
        state.listPage = 1;
        global.StoffusCmsRerender();
      };
    }

    var listPrev = document.getElementById('cms-list-prev');
    var listNext = document.getElementById('cms-list-next');
    if (listPrev) {
      listPrev.onclick = function () {
        if (state.listPage <= 1) return;
        state.listPage -= 1;
        global.StoffusCmsRerender();
      };
    }
    if (listNext) {
      listNext.onclick = function () {
        state.listPage += 1;
        global.StoffusCmsRerender();
      };
    }

    var metaHistoryBtn = document.getElementById('cms-meta-history-load');
    if (metaHistoryBtn) {
      metaHistoryBtn.onclick = function () { loadMetaHistory(false); };
    }

    document.querySelectorAll('[data-delete-meta-id]').forEach(function (btn) {
      btn.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        var id = btn.getAttribute('data-delete-meta-id');
        if (!id) return;
        if (!confirm('Apagar esta publicação no Facebook?\n\nEsta acção não se pode desfazer.')) return;
        api('social.php', {
          method: 'POST',
          body: apiBrandBody({ action: 'delete_meta_post', meta_post_id: id }),
        }).then(function (data) {
          if (data.posts) state.posts = data.posts;
          state.metaHistory = (state.metaHistory || []).filter(function (p) { return p.id !== id; });
          toast('Publicação apagada no Facebook');
          global.StoffusCmsRerender();
        }).catch(function (err) {
          toast(err.error || 'Erro ao apagar no Facebook.');
        });
      };
    });

    document.querySelectorAll('[data-meta-lightbox]').forEach(function (btn) {
      btn.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        var list = String(btn.getAttribute('data-meta-lightbox') || '').split('|').filter(Boolean);
        if (!list.length) return;
        openImageLightbox(list);
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
        state.weekStart = state.calView === 'week' ? startOfWeek(day) : startOfMonth(day);
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
        if (e.target.closest('[data-delete-post]')) return;
        if (e.target.closest('[data-stop]')) return;
        e.stopPropagation();
        selectPost(el.getAttribute('data-post-id'), true);
      });
      if (el.classList.contains('cms-board-post') || el.classList.contains('cms-agenda-card')) {
        if (el.getAttribute('draggable') === 'true') {
          el.addEventListener('dragstart', function (e) {
            e.dataTransfer.setData('text/post-id', el.getAttribute('data-post-id'));
            e.dataTransfer.effectAllowed = 'move';
            el.classList.add('is-dragging');
          });
          el.addEventListener('dragend', function () {
            el.classList.remove('is-dragging');
          });
        }
      }
    });

    document.querySelectorAll('[data-delete-post]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = btn.getAttribute('data-delete-post');
        var post = state.posts.find(function (p) { return p.id === id; });
        var conf = confirmDeletePost(post);
        if (!conf.ok) return;
        deletePostById(id, conf.deleteMeta).catch(function (err) {
          toast(err.error || 'Erro ao apagar.');
        });
      });
    });

    var deleteDrafts = document.getElementById('cms-social-delete-drafts');
    if (deleteDrafts) {
      deleteDrafts.onclick = function () {
        if (!confirm('Apagar todos os rascunhos desta marca?')) return;
        api('social.php', {
          method: 'POST',
          body: apiBrandBody({ action: 'delete_many', status: 'draft', delete_meta: false }),
        }).then(function (data) {
          state.posts = data.posts || [];
          if (state.selectedPostId) {
            var still = state.posts.some(function (p) { return p.id === state.selectedPostId; });
            if (!still) state.selectedPostId = null;
          }
          state.listFilter = 'draft';
          toast('Rascunhos apagados');
          global.StoffusCmsRerender();
        }).catch(function (err) { toast(err.error || 'Erro ao apagar.'); });
      };
    }

    var deletePublished = document.getElementById('cms-social-delete-published');
    if (deletePublished) {
      deletePublished.onclick = function () {
        if (!confirm('Apagar TODAS as publicações desta marca no CMS e no Meta (Facebook/Instagram)?\n\nEsta acção não se pode desfazer.')) return;
        api('social.php', {
          method: 'POST',
          body: apiBrandBody({ action: 'delete_many', status: 'published', delete_meta: true }),
        }).then(function (data) {
          state.posts = data.posts || [];
          state.selectedPostId = null;
          state.listFilter = 'published';
          toast((data.removed || 0) + ' publicação(ões) processada(s)');
          global.StoffusCmsRerender();
        }).catch(function (err) { toast(err.error || 'Erro ao apagar.'); });
      };
    }

    var captionDefault = document.getElementById('cms-social-default-caption');
    if (captionDefault) {
      captionDefault.addEventListener('input', function () {
        state.settings.defaultCaption = captionDefault.value || '';
        var live = document.getElementById('cms-preview-caption-live');
        if (live) live.textContent = captionDefault.value || 'Sem legenda';
      });
    }

    var splitInput = document.getElementById('cms-social-split');
    if (splitInput) {
      splitInput.addEventListener('change', function () {
        var n = Math.max(1, Math.min(10, Number(splitInput.value) || 10));
        state.settings.autoSplitSize = n;
        splitInput.value = String(n);
        state.previewSlide = 0;
        global.StoffusCmsRerender();
      });
    }

    var captionEl = document.getElementById('cms-social-caption');
    if (captionEl) {
      captionEl.addEventListener('input', function () {
        var live = document.getElementById('cms-preview-caption-live');
        if (live) live.textContent = captionEl.value || 'Sem legenda';
      });
    }

    function previewMediaCount() {
      var compose = composePreviewPost();
      if (compose && compose.media) return compose.media.length;
      var post = state.posts.find(function (p) { return p.id === state.selectedPostId; });
      return (post && post.media) ? post.media.length : 0;
    }

    var prevSlide = document.getElementById('cms-preview-prev');
    var nextSlide = document.getElementById('cms-preview-next');
    if (prevSlide) {
      prevSlide.onclick = function (e) {
        e.stopPropagation();
        var n = previewMediaCount();
        if (!n) return;
        state.previewSlide = (state.previewSlide - 1 + n) % n;
        global.StoffusCmsRerender();
      };
    }
    if (nextSlide) {
      nextSlide.onclick = function (e) {
        e.stopPropagation();
        var n = previewMediaCount();
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

    var saveDraft = document.getElementById('cms-social-save-draft');
    if (saveDraft) {
      saveDraft.onclick = function () {
        var id = state.selectedPostId;
        var platforms = readEditPlatforms();
        var when = (document.getElementById('cms-social-when') || {}).value || '';
        api('social.php', {
          method: 'POST',
          body: apiBrandBody({
            action: 'update',
            id: id,
            post: {
              caption: (document.getElementById('cms-social-caption') || {}).value || '',
              platforms: platforms,
              status: 'draft',
              scheduledAt: when ? new Date(when).toISOString() : undefined,
            },
          }),
        }).then(function (data) {
          state.posts = data.posts || [];
          state.listFilter = 'draft';
          toast('Guardado como rascunho');
          global.StoffusCmsRerender();
        }).catch(function (err) { toast(err.error || 'Erro ao guardar.'); });
      };
    }

    var delPost = document.getElementById('cms-social-delete-post');
    if (delPost) {
      delPost.onclick = function () {
        var post = state.posts.find(function (p) { return p.id === state.selectedPostId; });
        var onMeta = post && (post.status === 'published' || postHasMetaIds(post));
        if (onMeta) {
          if (!confirm('Apagar no CMS e também no Facebook/Instagram?')) return;
          deletePostById(state.selectedPostId, true).catch(function (err) {
            toast(err.error || 'Erro ao apagar.');
          });
        } else {
          if (!confirm('Apagar esta publicação do CMS?')) return;
          deletePostById(state.selectedPostId, false).catch(function (err) {
            toast(err.error || 'Erro ao apagar.');
          });
        }
      };
    }

    var delCmsOnly = document.getElementById('cms-social-delete-cms-only');
    if (delCmsOnly) {
      delCmsOnly.onclick = function () {
        if (!confirm('Apagar só no CMS? A publicação continua no Facebook/Instagram.')) return;
        deletePostById(state.selectedPostId, false).catch(function (err) {
          toast(err.error || 'Erro ao apagar.');
        });
      };
    }
  }

  global.StoffusSocial = {
    load: load,
    render: render,
    bind: bind,
  };
})(window);
