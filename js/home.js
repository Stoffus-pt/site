(function () {
  function initHero(data) {
    var feature = data && data.heroFeature;
    if (!feature || !feature.model) return;

    var model = StoffusModels.byId(data, feature.model);
    if (!model) return;

    var site = window.StoffusSite || {};
    var pageUrl = site.modelPage ? site.modelPage(model.id) : ('modelo.html?id=' + model.id);
    var link = document.getElementById('hero-feature-link');
    var video = document.getElementById('hero-feature-video');
    var label = document.getElementById('hero-label');
    var typePart = String(model.tag || '').split('·').pop().trim();

    if (link) {
      link.href = pageUrl;
      link.textContent = model.name + (typePart ? ' · ' + typePart : '');
    }
    if (label && model.novidade) label.textContent = 'Novidade · Eleganza Collection';
    if (video) {
      video.setAttribute(
        'aria-label',
        (model.type === 'pet' ? '' : (model.type === 'banqueta' ? 'Banqueta ' : (model.type === 'pouf' ? 'Puff ' : 'Sofá '))) +
          model.name + ' — Eleganza Collection'
      );
    }
  }

  function initNovidades(data) {
    var grid = document.getElementById('home-novidades-grid');
    if (!grid) return;

    var models = StoffusModels.featuredHome(data);
    if (!models.length) models = StoffusModels.novidades(data).slice(0, 4);

    models.forEach(function (model, index) {
      var card = StoffusModels.renderCollectionCard(model);
      if (index === 0) card.classList.add('collection-card--feature');
      grid.appendChild(card);
    });
  }

  function initClassic(data) {
    var grid = document.getElementById('home-colecoes-grid');
    if (!grid) return;

    var ids = (data && data.featuredClassic) || ['brittany', 'athena', 'bartini', 'enzo', 'fiori'];
    var models = ids.map(function (id) { return StoffusModels.byId(data, id); }).filter(Boolean);

    models.forEach(function (model, index) {
      var card = StoffusModels.renderCollectionCard(model);
      if (index === 0) card.classList.add('collection-card--feature');
      grid.appendChild(card);
    });
  }

  StoffusModels.load().then(function (data) {
    initHero(data);
    initNovidades(data);
    initClassic(data);
  });
})();
