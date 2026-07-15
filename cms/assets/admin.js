(function () {
  var app = document.getElementById('app');
  var state = {
    view: 'loading',
    user: null,
    configured: false,
    pages: [],
    currentFile: null,
    pageData: null,
    regions: {},
    nav: [],
    status: '',
    statusType: '',
  };

  function api(path, options) {
    options = options || {};
    return fetch('api/' + path, {
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
            throw {
              error: 'O PHP não respondeu correctamente. Use ABRIR-CMS.bat (recomendado) em vez do Five Server.',
              detail: text.slice(0, 240),
            };
          }
        }
        if (!res.ok) throw data;
        return data;
      });
    });
  }

  function toast(msg) {
    var el = document.createElement('div');
    el.className = 'cms-toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 2800);
  }

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  function setStatus(msg, type) {
    state.status = msg;
    state.statusType = type || '';
    if (state.view === 'editor') {
      updateEditorChrome();
    } else {
      render();
    }
  }

  function updateEditorChrome() {
    if (state.view !== 'editor') return;
    document.querySelectorAll('[data-region]').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-region') === state.activeRegion);
    });
    var status = document.querySelector('.cms-sidebar .cms-status');
    if (status) {
      status.textContent = state.status || '';
      status.className = 'cms-status' + (state.statusType ? ' is-' + state.statusType : '');
    }
  }

  function boot() {
    api('me.php').then(function (data) {
      state.configured = !!data.configured;
      state.user = data.username;
      if (!data.configured) {
        state.view = 'setup';
      } else if (!data.authenticated) {
        state.view = 'login';
      } else {
        state.view = 'dashboard';
        loadPages();
        loadNav();
      }
      render();
    }).catch(function () {
      state.view = 'login';
      render();
    });
  }

  function loadPages() {
    return api('pages.php?action=list').then(function (data) {
      state.pages = data.pages || [];
      render();
    });
  }

  function loadNav() {
    return api('nav.php').then(function (data) {
      state.nav = data.nav || [];
    });
  }

  function openEditor(file) {
    state.currentFile = file;
    state.view = 'editor';
    state.regions = {};
    state.activeRegion = null;
    state.previewReady = false;
    render();
    api('pages.php?action=get&file=' + encodeURIComponent(file)).then(function (data) {
      state.pageData = data.data;
      (data.data.regions || []).forEach(function (r) {
        state.regions[r.id] = r.html;
      });
      render();
      initIframe(true);
    }).catch(function (err) {
      setStatus(err.error || 'Erro ao carregar.', 'error');
    });
  }

  function initIframe(force) {
    var iframe = document.getElementById('cms-preview-frame');
    if (!iframe || !state.currentFile) return;
    var nextSrc = '../' + state.currentFile + '?cms=1';
    if (!force && iframe.dataset.cmsSrc === nextSrc && state.previewReady) return;
    iframe.dataset.cmsSrc = nextSrc;
    state.previewReady = false;
    iframe.src = nextSrc;
  }

  window.addEventListener('message', function (e) {
    var data = e.data || {};
    if (data.source !== 'stoffus-cms-preview') return;

    if (data.type === 'region-select') {
      state.regions[data.id] = data.html;
      state.activeRegion = data.id;
      updateEditorChrome();
    }

    if (data.type === 'region-change') {
      state.regions[data.id] = data.html;
    }

    if (data.type === 'preview-ready') {
      state.previewReady = true;
      (data.regions || []).forEach(function (r) {
        if (state.regions[r.id] === undefined) state.regions[r.id] = r.html;
      });
    }
  });

  function postToPreview(msg) {
    var iframe = document.getElementById('cms-preview-frame');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage(Object.assign({ source: 'stoffus-cms-admin' }, msg), '*');
    }
  }

  function savePage() {
    if (!state.currentFile || !state.pageData) return;
    var regions = Object.keys(state.regions).map(function (id) {
      return { id: id, html: state.regions[id] };
    });
    api('pages.php', {
      method: 'POST',
      body: {
        action: 'save',
        file: state.currentFile,
        title: document.getElementById('cms-meta-title').value,
        description: document.getElementById('cms-meta-description').value,
        regions: regions,
      },
    }).then(function () {
      toast('Página guardada');
      setStatus('Alterações guardadas no servidor.', 'ok');
      initIframe(true);
    }).catch(function (err) {
      setStatus(err.error || 'Erro ao guardar.', 'error');
    });
  }

  function saveNav() {
    api('nav.php', { method: 'POST', body: { nav: state.nav } }).then(function () {
      toast('Menu actualizado');
      setStatus('Menu sincronizado em todas as páginas.', 'ok');
    }).catch(function (err) {
      setStatus(err.error || 'Erro ao guardar menu.', 'error');
    });
  }

  function renderLogin() {
    return '<div class="cms-login"><div class="cms-card"><h1>CMS Stoffus</h1><p>Inicie sessão para editar o site.</p>' +
      '<form id="cms-login-form">' +
      '<label class="cms-field"><span>Utilizador</span><input name="username" value="stoffus" required /></label>' +
      '<label class="cms-field"><span>Palavra-passe</span><input type="password" name="password" required /></label>' +
      '<button class="cms-btn cms-btn--brand" type="submit" style="width:100%">Entrar</button>' +
      '</form><p class="cms-hint" id="cms-login-error"></p></div></div>';
  }

  function renderSetup() {
    return '<div class="cms-login"><div class="cms-card"><h1>Configurar CMS</h1><p>Primeira utilização - defina o utilizador e palavra-passe do painel.</p>' +
      '<form id="cms-setup-form">' +
      '<label class="cms-field"><span>Utilizador</span><input name="username" value="stoffus" required /></label>' +
      '<label class="cms-field"><span>Palavra-passe</span><input type="password" name="password" minlength="8" required /></label>' +
      '<button class="cms-btn cms-btn--brand" type="submit" style="width:100%">Criar acesso</button>' +
      '</form><p class="cms-hint" id="cms-setup-error"></p></div></div>';
  }

  function renderDashboard() {
    var tab = state.dashboardTab || 'pages';
    var html = '<div class="cms-shell">' +
      '<div class="cms-topbar"><div class="cms-topbar__title">CMS Stoffus</div>' +
      '<div class="cms-topbar__actions">' +
      '<a class="cms-btn cms-btn--ghost" href="../index.html" target="_blank">Ver site</a>' +
      '<button class="cms-btn cms-btn--ghost" id="cms-logout" type="button">Sair</button></div></div>' +
      '<div class="cms-tabs">' +
      '<button class="cms-tab' + (tab === 'pages' ? ' is-active' : '') + '" data-tab="pages" type="button">Páginas</button>' +
      '<button class="cms-tab' + (tab === 'nav' ? ' is-active' : '') + '" data-tab="nav" type="button">Menu</button>' +
      '<button class="cms-tab' + (tab === 'catalog' ? ' is-active' : '') + '" data-tab="catalog" type="button">Catálogo</button>' +
      '</div><div class="cms-panel">';

    if (tab === 'pages') {
      html += '<div style="margin-bottom:1rem;display:flex;gap:.5rem;flex-wrap:wrap">' +
        '<button class="cms-btn cms-btn--brand" id="cms-new-page" type="button">Nova página</button></div><div class="cms-pages">';
      state.pages.forEach(function (p) {
        html += '<article class="cms-page-card"><h3>' + esc(p.title) + '</h3><p>' + esc(p.file) + '</p>' +
          '<div class="cms-page-card__actions">' +
          '<button class="cms-btn cms-btn--brand" type="button" data-edit="' + esc(p.file) + '">Editar</button>' +
          '<a class="cms-btn cms-btn--ghost" href="../' + esc(p.file) + '" target="_blank">Ver</a>' +
          (p.file !== 'index.html' ? '<button class="cms-btn cms-btn--danger" type="button" data-delete="' + esc(p.file) + '">Apagar</button>' : '') +
          '</div></article>';
      });
      html += '</div>';
    } else if (tab === 'catalog') {
      var photoTool = state.photoTool || 'models';
      html += '<div class="cms-tabs cms-tabs--sub">' +
        '<button class="cms-tab' + (photoTool === 'models' ? ' is-active' : '') + '" data-photo-tool="models" type="button">Modelos e fotos</button>' +
        '<button class="cms-tab' + (photoTool === 'slots' ? ' is-active' : '') + '" data-photo-tool="slots" type="button">Capa e galeria</button>' +
        '<button class="cms-tab' + (photoTool === 'crop' ? ' is-active' : '') + '" data-photo-tool="crop" type="button">Corte da capa</button>' +
        '</div>';
      if (photoTool === 'crop') {
        html += '<p class="cms-hint">Ajuste o enquadramento da foto de capa (catálogo). Use o slot definido em «Capa e galeria».</p>' +
          '<iframe class="cms-photos-frame" title="Editor de cortes" src="../tools/photo-crop-editor.html?cms=1"></iframe>';
      } else if (photoTool === 'slots') {
        html += '<p class="cms-hint">Escolha a foto de capa, a ordem na página do modelo, ou troque fotos entre slots.</p>' +
          '<iframe class="cms-photos-frame" title="Capa e galeria" src="../tools/photo-slots.html?cms=1"></iframe>';
      } else {
        html += '<p class="cms-hint">Crie modelos, carregue ou elimine fotos. Depois ajuste capa e corte nas outras secções.</p>' +
          '<iframe class="cms-photos-frame" title="Modelos e fotos" src="../tools/model-manager.html?cms=1"></iframe>';
      }
    } else {
      html += '<p class="cms-hint">Edite as ligações do menu principal. Ao guardar, actualiza todas as páginas.</p><div class="cms-nav-list" id="cms-nav-list">';
      state.nav.forEach(function (item, i) {
        html += '<div class="cms-nav-row" data-nav-index="' + i + '">' +
          '<input value="' + esc(item.label) + '" data-nav-label />' +
          '<input value="' + esc(item.href) + '" data-nav-href />' +
          '<button class="cms-btn cms-btn--danger" type="button" data-nav-remove="' + i + '">×</button></div>';
      });
      html += '</div><div style="margin-top:1rem;display:flex;gap:.5rem">' +
        '<button class="cms-btn cms-btn--ghost" id="cms-nav-add" type="button">Adicionar item</button>' +
        '<button class="cms-btn cms-btn--brand" id="cms-nav-save" type="button">Guardar menu</button></div>';
    }

    html += '<p class="cms-status' + (state.statusType ? ' is-' + state.statusType : '') + '">' + esc(state.status) + '</p></div></div>';
    return html;
  }

  function renderEditor() {
    var regions = state.pageData ? state.pageData.regions || [] : [];
    var sidebar = regions.map(function (r) {
      return '<button type="button" class="cms-region-btn' + (state.activeRegion === r.id ? ' is-active' : '') + '" data-region="' + esc(r.id) + '">' + esc(r.label) + '</button>';
    }).join('');

    return '<div class="cms-shell">' +
      '<div class="cms-topbar"><div class="cms-topbar__title">A editar: ' + esc(state.currentFile) + '</div>' +
      '<div class="cms-topbar__actions">' +
      '<button class="cms-btn cms-btn--ghost" id="cms-back" type="button">← Voltar</button>' +
      '<a class="cms-btn cms-btn--ghost" href="../' + esc(state.currentFile) + '" target="_blank">Ver página</a>' +
      '<button class="cms-btn cms-btn--brand" id="cms-save" type="button">Guardar</button></div></div>' +
      '<div class="cms-editor cms-panel">' +
      '<aside class="cms-sidebar"><h2>Secções</h2>' + (sidebar || '<p class="cms-hint">Sem secções editáveis nesta página.</p>') +
      '<p class="cms-hint">Clique numa secção na pré-visualização ou na lista. Duplo-clique na pré-visualização para editar texto.</p>' +
      '<div class="cms-meta"><h2>SEO</h2>' +
      '<label class="cms-field"><span>Título</span><input id="cms-meta-title" value="' + esc(state.pageData && state.pageData.title) + '" /></label>' +
      '<label class="cms-field"><span>Descrição</span><textarea id="cms-meta-description" rows="3">' + esc(state.pageData && state.pageData.description) + '</textarea></label>' +
      '</div><p class="cms-status' + (state.statusType ? ' is-' + state.statusType : '') + '">' + esc(state.status) + '</p></aside>' +
      '<div class="cms-preview"><iframe id="cms-preview-frame" title="Pré-visualização"></iframe></div></div></div>';
  }

  function render() {
    if (state.view === 'loading') {
      app.innerHTML = '<div class="cms-login"><p>A carregar…</p></div>';
      return;
    }
    if (state.view === 'setup') app.innerHTML = renderSetup();
    else if (state.view === 'login') app.innerHTML = renderLogin();
    else if (state.view === 'editor') app.innerHTML = renderEditor();
    else app.innerHTML = renderDashboard();
    bind();
  }

  function bind() {
    var loginForm = document.getElementById('cms-login-form');
    if (loginForm) {
      loginForm.onsubmit = function (e) {
        e.preventDefault();
        var fd = new FormData(loginForm);
        api('login.php', {
          method: 'POST',
          body: { username: fd.get('username'), password: fd.get('password') },
        }).then(function () {
          state.view = 'dashboard';
          loadPages();
          loadNav();
          render();
        }).catch(function (err) {
          var el = document.getElementById('cms-login-error');
          if (el) el.textContent = err.error || 'Erro ao entrar.';
        });
      };
    }

    var setupForm = document.getElementById('cms-setup-form');
    if (setupForm) {
      setupForm.onsubmit = function (e) {
        e.preventDefault();
        var fd = new FormData(setupForm);
        api('setup.php', {
          method: 'POST',
          body: { username: fd.get('username'), password: fd.get('password') },
        }).then(function () {
          state.view = 'dashboard';
          state.configured = true;
          loadPages();
          loadNav();
          render();
        }).catch(function (err) {
          var el = document.getElementById('cms-setup-error');
          if (el) el.textContent = err.error || err.detail || 'Erro na configuração.';
        });
      };
    }

    document.querySelectorAll('[data-tab]').forEach(function (btn) {
      btn.onclick = function () {
        state.dashboardTab = btn.getAttribute('data-tab');
        state.status = '';
        render();
      };
    });

    document.querySelectorAll('[data-photo-tool]').forEach(function (btn) {
      btn.onclick = function () {
        state.photoTool = btn.getAttribute('data-photo-tool');
        render();
      };
    });

    var logout = document.getElementById('cms-logout');
    if (logout) logout.onclick = function () {
      api('logout.php', { method: 'POST' }).finally(function () {
        state.view = 'login';
        render();
      });
    };

    document.querySelectorAll('[data-edit]').forEach(function (btn) {
      btn.onclick = function () { openEditor(btn.getAttribute('data-edit')); };
    });

    document.querySelectorAll('[data-delete]').forEach(function (btn) {
      btn.onclick = function () {
        var file = btn.getAttribute('data-delete');
        if (!confirm('Apagar ' + file + '?')) return;
        api('pages.php', { method: 'POST', body: { action: 'delete', file: file } })
          .then(loadPages)
          .then(function () { toast('Página apagada'); });
      };
    });

    var newPage = document.getElementById('cms-new-page');
    if (newPage) newPage.onclick = function () {
      var slug = prompt('Nome da página (ex: novidades):');
      if (!slug) return;
      var title = prompt('Título da página:', 'Nova página');
      api('pages.php', { method: 'POST', body: { action: 'create', slug: slug, title: title || 'Nova página' } })
        .then(function (data) { return loadPages().then(function () { openEditor(data.file); }); });
    };

    document.querySelectorAll('[data-region]').forEach(function (btn) {
      btn.onclick = function () {
        state.activeRegion = btn.getAttribute('data-region');
        postToPreview({ type: 'select-region', id: state.activeRegion });
        updateEditorChrome();
      };
    });

    var saveBtn = document.getElementById('cms-save');
    if (saveBtn) saveBtn.onclick = savePage;

    var backBtn = document.getElementById('cms-back');
    if (backBtn) backBtn.onclick = function () {
      state.view = 'dashboard';
      state.currentFile = null;
      state.pageData = null;
      state.status = '';
      render();
    };

    var navAdd = document.getElementById('cms-nav-add');
    if (navAdd) navAdd.onclick = function () {
      state.nav.push({ label: 'Nova ligação', href: '#' });
      render();
    };

    document.querySelectorAll('[data-nav-remove]').forEach(function (btn) {
      btn.onclick = function () {
        state.nav.splice(Number(btn.getAttribute('data-nav-remove')), 1);
        render();
      };
    });

    var navSave = document.getElementById('cms-nav-save');
    if (navSave) navSave.onclick = function () {
      var rows = document.querySelectorAll('.cms-nav-row');
      state.nav = Array.prototype.map.call(rows, function (row) {
        return {
          label: row.querySelector('[data-nav-label]').value.trim(),
          href: row.querySelector('[data-nav-href]').value.trim(),
        };
      }).filter(function (item) { return item.label && item.href; });
      saveNav();
    };

    if (state.view === 'editor' && state.pageData) {
      var frame = document.getElementById('cms-preview-frame');
      if (frame && !frame.src) initIframe(true);
    }
  }

  boot();
})();
