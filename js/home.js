(function () {
  function initHero(data) {
    var feature = data && data.heroFeature;
    if (!feature || !feature.model) return;

    var model = StoffusModels.byId(data, feature.model);
    if (!model || !model.photo) return;

    var slotIndex = Math.max(1, Number(feature.slot) || 1);
    var slots = StoffusModels.modelPhotoSlots(model);
    var slot = slots[slotIndex - 1] || slots[0];
    if (!slot) return;

    var site = window.StoffusSite || {};
    var pageUrl = site.modelPage ? site.modelPage(model.id) : ('modelo.html?id=' + model.id);
    var link = document.getElementById('hero-feature-link');
    var img = document.getElementById('hero-feature-photo');
    var tag = document.getElementById('hero-feature-tag');
    var label = document.getElementById('hero-label');
    var typePart = String(model.tag || '').split('·').pop().trim();

    if (link) link.href = pageUrl;
    if (tag) tag.textContent = model.name + (typePart ? ' · ' + typePart : '');
    if (label && model.novidade) label.textContent = 'Novidade · Eleganza Collection';

    if (img) {
      img.src = slot.png;
      img.alt = (model.type === 'pet' ? '' : (model.type === 'banqueta' ? 'Banqueta ' : (model.type === 'pouf' ? 'Puff ' : 'Sofá '))) + model.name + ' — Eleganza Collection';
      img.dataset.fallback = slot.png;
      img.dataset.iconFallback = slot.icon;
      StoffusModels.bindImageFallback(img);
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

  StoffusModels.load().then(function (data) {
    initHero(data);
    initNovidades(data);
  });
})();
