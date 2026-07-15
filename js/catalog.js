(function () {
  var grid = document.getElementById('catalog-grid');
  var filters = document.getElementById('catalog-filters');
  var countEl = document.getElementById('catalog-count');
  var emptyEl = document.getElementById('catalog-empty');
  if (!grid || !filters) return;

  var currentFilter = 'all';
  var catalogData = null;

  var TYPE_ORDER = ['relax', 'fixed', 'slide', 'pendular', 'sofabed', 'armchair', 'banqueta', 'pouf', 'pet'];

  function typeRank(type) {
    var i = TYPE_ORDER.indexOf(type);
    return i === -1 ? TYPE_ORDER.length : i;
  }

  function novidadeRank(data, id) {
    var order = (data && data.novidadesOrder) || [];
    var i = order.indexOf(id);
    return i === -1 ? order.length : i;
  }

  function compareCatalogModels(a, b, data) {
    if (!!a.novidade !== !!b.novidade) return a.novidade ? -1 : 1;

    if (a.novidade && b.novidade) {
      var nr = novidadeRank(data, a.id) - novidadeRank(data, b.id);
      if (nr !== 0) return nr;
    }

    var tr = typeRank(a.type) - typeRank(b.type);
    if (tr !== 0) return tr;

    return String(a.name || a.id).localeCompare(String(b.name || b.id), 'pt-PT');
  }

  function sortCatalogModels(models, data) {
    return models.slice().sort(function (a, b) {
      return compareCatalogModels(a, b, data);
    });
  }

  function getFilteredModels() {
    var models = StoffusModels.all(catalogData);
    if (currentFilter !== 'all') {
      models = models.filter(function (m) { return m.type === currentFilter; });
    }
    return sortCatalogModels(models, catalogData);
  }

  function renderGrid() {
    var models = getFilteredModels();
    var types = StoffusModels.typeLabels(catalogData);
    grid.innerHTML = '';

    models.forEach(function (model) {
      grid.appendChild(StoffusModels.renderCatalogCard(model, { types: types }));
    });

    if (countEl) {
      countEl.textContent = models.length + (models.length === 1 ? ' modelo' : ' modelos');
    }
    if (emptyEl) emptyEl.hidden = models.length > 0;
  }

  filters.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-filter]');
    if (!btn) return;
    currentFilter = btn.dataset.filter;
    filters.querySelectorAll('[data-filter]').forEach(function (el) {
      el.classList.toggle('is-active', el === btn);
      el.setAttribute('aria-pressed', el === btn ? 'true' : 'false');
    });
    renderGrid();
  });

  StoffusModels.load().then(function (data) {
    catalogData = data;
    renderGrid();
  });
})();
