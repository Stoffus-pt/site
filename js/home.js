(function () {
  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function initHeroMedia() {
    var video = document.getElementById('hero-feature-video');
    var staticEl = document.getElementById('hero-feature-static');
    if (!video || !staticEl) return;

    if (prefersReducedMotion()) {
      video.hidden = true;
      video.removeAttribute('autoplay');
      try { video.pause(); } catch (e) {}
      staticEl.hidden = false;
      return;
    }

    staticEl.hidden = true;
    video.hidden = false;
    var play = video.play();
    if (play && typeof play.catch === 'function') {
      play.catch(function () {
        video.hidden = true;
        staticEl.hidden = false;
      });
    }
  }

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
    var video = document.getElementById('hero-feature-video');
    var tag = document.getElementById('hero-feature-tag');
    var label = document.getElementById('hero-label');
    var typePart = String(model.tag || '').split('·').pop().trim();
    var webp = String(slot.png || '').replace(/\.png$/i, '.webp');

    if (link) link.href = pageUrl;
    if (tag) tag.textContent = model.name + ' · Stoffus 3D';
    if (label && model.novidade) label.textContent = 'Novidade · Eleganza Collection';

    if (video) {
      video.setAttribute('poster', webp);
      video.setAttribute('aria-label', 'Stoffus 3D — ' + model.name);
    }

    if (img) {
      img.removeAttribute('srcset');
      img.removeAttribute('sizes');
      img.src = slot.png;
      img.alt = (model.type === 'pet' ? '' : (model.type === 'banqueta' ? 'Banqueta ' : (model.type === 'pouf' ? 'Puff ' : 'Sofá '))) + model.name + ' — Eleganza Collection';
      img.dataset.fallback = slot.png;
      img.dataset.iconFallback = slot.icon;
      StoffusModels.bindImageFallback(img);

      var source = img.parentElement && img.parentElement.querySelector('source[type="image/webp"]');
      if (source) source.setAttribute('srcset', webp);
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

  initHeroMedia();

  StoffusModels.load().then(function (data) {
    initHero(data);
    initNovidades(data);
    initClassic(data);
  });
})();
