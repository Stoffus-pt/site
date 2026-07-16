(function (global) {
  var cache = null;

  function typeLabels(data) {
    return (data && data.types) || {};
  }

  function allModels(data) {
    return (data && data.models) || [];
  }

  var MODEL_ID_ALIASES = { syrus: 'syros' };

  function byId(data, id) {
    var key = MODEL_ID_ALIASES[id] || id;
    return allModels(data).find(function (m) { return m.id === key; }) || null;
  }

  function novidades(data) {
    var order = (data && data.novidadesOrder) || [];
    var map = {};
    allModels(data).forEach(function (m) {
      if (m.novidade) map[m.id] = m;
    });
    return order.map(function (id) { return map[id]; }).filter(Boolean);
  }

  function featuredHome(data) {
    var ids = (data && data.featuredHome) || [];
    return ids.map(function (id) { return byId(data, id); }).filter(Boolean);
  }

  function modelImageFallback(model) {
    return 'assets/icons/' + model.id + '.webp';
  }

  function modelPhotoPath(model, slot) {
    var id = model.id;
    var photos = Array.isArray(model.photos) ? model.photos : [];
    var custom = photos[slot - 1];
    if (custom) {
      return /^assets\//.test(custom) ? custom : 'assets/' + custom.replace(/^\/+/, '');
    }
    if (slot === 1 && model.photoHero) {
      return /^assets\//.test(model.photoHero)
        ? model.photoHero
        : 'assets/' + String(model.photoHero).replace(/^\/+/, '');
    }
    return 'assets/photos/models/' + id + '-' + slot + '.webp';
  }

  function modelPhotoFullPng(model, slot) {
    var id = model.id;
    var photos = Array.isArray(model.photos) ? model.photos : [];
    var custom = photos[slot - 1];
    if (custom) {
      var path = /^assets\//.test(custom) ? custom : 'assets/' + custom.replace(/^\/+/, '');
      return path.replace(/\.webp$/i, '.png');
    }
    return 'assets/photos/models/' + id + '-' + slot + '.png';
  }

  function modelPhotoPngFallback(model, slot) {
    return modelPhotoFullPng(model, slot);
  }

  var PHOTO_CARD_V = (typeof window !== 'undefined' && window.__PHOTO_CARD_V) || '20260714w';

  function modelPhotoSmPng(model, slot) {
    return modelPhotoFullPng(model, slot).replace(/\.png$/i, '-sm.png') + '?v=' + PHOTO_CARD_V;
  }

  function modelPhotoMdPng(model, slot) {
    return modelPhotoFullPng(model, slot).replace(/\.png$/i, '-md.png') + '?v=' + PHOTO_CARD_V;
  }

  function modelImage(model) {
    if (model.photo) return modelPhotoPath(model, 1);
    return modelImageFallback(model);
  }

  function modelPhotoSlotCount(model) {
    var n = Number(model.photoCount);
    if (n > 0) return n;
    var photos = Array.isArray(model.photos) ? model.photos : [];
    if (photos.length) return photos.length;
    return model.photo ? 2 : 0;
  }

  function modelCatalogSlot(model) {
    var count = modelPhotoSlotCount(model);
    var slot = Number(model.catalogSlot) || 1;
    if (slot < 1) slot = 1;
    if (slot > count) slot = count;
    return slot;
  }

  function modelPhotoOrder(model) {
    var count = modelPhotoSlotCount(model);
    var order = Array.isArray(model.photoOrder) ? model.photoOrder.slice() : [];
    var cleaned = [];
    order.forEach(function (slot) {
      slot = Number(slot);
      if (slot >= 1 && slot <= count && cleaned.indexOf(slot) === -1) {
        cleaned.push(slot);
      }
    });
    for (var s = 1; s <= count; s++) {
      if (cleaned.indexOf(s) === -1) cleaned.push(s);
    }
    return cleaned;
  }

  function productAltPrefix(model) {
    if (model.type === 'pet') return '';
    if (model.type === 'banqueta') return 'Banqueta ';
    if (model.type === 'pouf') return 'Puff ';
    return 'Sofá ';
  }

  function modelPhotoSlots(model) {
    var icon = modelImageFallback(model);
    var prefix = productAltPrefix(model);
    if (!model.photo) {
      return [{ src: icon, png: icon, icon: icon, alt: prefix + model.name }];
    }
    var count = modelPhotoSlotCount(model);
    var order = modelPhotoOrder(model);
    return order.map(function (slot) {
      return {
        slot: slot,
        src: modelPhotoPath(model, slot),
        png: modelPhotoPngFallback(model, slot),
        icon: icon,
        alt: prefix + model.name + ' - foto ' + slot
      };
    });
  }

  function bindImageFallback(img) {
    if (!img) return;
    img.addEventListener('error', function onError() {
      var tried = img.dataset.tried || '';
      if (img.dataset.fallback && tried.indexOf('png') === -1) {
        img.dataset.tried = tried + 'png';
        img.src = img.dataset.fallback;
        return;
      }
      if (img.dataset.iconFallback && tried.indexOf('icon') === -1) {
        img.dataset.tried = tried + 'icon';
        img.src = img.dataset.iconFallback;
        img.classList.add('is-icon');
      }
    });
  }

  function applyPhotoSlot(img, slot) {
    if (!img || !slot) return;
    img.src = slot.src;
    img.alt = slot.alt;
    img.dataset.fallback = slot.png;
    img.dataset.iconFallback = slot.icon;
    delete img.dataset.tried;
    img.classList.remove('is-icon');
  }

  function hasConfigurator(model) {
    return model.configurator !== false && model.type !== 'pet';
  }

  function modelCardImage(model) {
    if (!model.photo) return modelImage(model);
    return modelPhotoSmPng(model, modelCatalogSlot(model));
  }

  function modelCardImageFallback(model) {
    if (!model.photo) return modelImageFallback(model);
    return modelPhotoMdPng(model, modelCatalogSlot(model));
  }

  function catalogTagLabel(model) {
    var tag = model.tag || '';
    if (!model.novidade) return tag;
    return tag.replace(/^Novidade\s*·\s*/i, '').trim() || tag;
  }

  function novidadeBadgeHtml(className) {
    return '<span class="' + className + '" aria-label="Novidade">Novidade</span>';
  }

  function modelCatalogIsCutout(model) {
    if (model.photoCutout) return true;
    if (!model.photo) return false;
    return Number(model.catalogSlot) > 1;
  }

  function renderCatalogCard(model, opts) {
    opts = opts || {};
    var site = global.StoffusSite || {};
    var types = opts.types || {};
    var typeLabel = types[model.type] || model.type;
    var pageUrl = site.modelPage ? site.modelPage(model.id) : ('modelo.html?id=' + model.id);
    var configUrl = site.configuratorForModel ? site.configuratorForModel(model.id) : site.configurator;
    var imgPrimary = modelCardImage(model);
    var imgFallback = modelCardImageFallback(model);
    var imgIcon = modelImageFallback(model);
    var linkLabel = opts.linkLabel || 'Ver modelo';
    var configLabel = opts.configLabel || 'Configurar em 3D';
    var showConfig = hasConfigurator(model);
    var altPrefix = productAltPrefix(model);
    var secondaryLink = showConfig
      ? '<a class="catalog-card__link catalog-card__link--muted" href="' + configUrl + '">' + configLabel + '</a>'
      : '<a class="catalog-card__link catalog-card__link--muted" href="onde-comprar.html">Onde ver</a>';

    var card = document.createElement('article');
    card.className = 'catalog-card' + (model.novidade ? ' catalog-card--novidade' : '');
    card.dataset.type = model.type;
    card.dataset.id = model.id;

    var cutoutClass = modelCatalogIsCutout(model) ? ' catalog-card__media--cutout' : '';

    card.innerHTML =
      '<a class="catalog-card__media' + cutoutClass + '" href="' + pageUrl + '" aria-label="Ver ' + model.name + '">' +
        '<img src="' + imgPrimary + '" alt="' + altPrefix + model.name + ' - Eleganza Collection" loading="lazy" decoding="async" data-fallback="' + imgFallback + '" data-icon-fallback="' + imgIcon + '" />' +
        '<span class="catalog-card__badge">' + typeLabel + '</span>' +
        (model.novidade ? novidadeBadgeHtml('catalog-card__badge catalog-card__badge--novidade') : '') +
      '</a>' +
      '<div class="catalog-card__body">' +
        '<h3 class="catalog-card__title"><a href="' + pageUrl + '">' + model.name + '</a></h3>' +
        '<p class="catalog-card__tag">' + catalogTagLabel(model) + '</p>' +
        '<div class="catalog-card__actions">' +
          '<a class="catalog-card__link" href="' + pageUrl + '">' + linkLabel + '</a>' +
          secondaryLink +
        '</div>' +
      '</div>';

    bindImageFallback(card.querySelector('img'));
    return card;
  }

  function renderCollectionCard(model) {
    var site = global.StoffusSite || {};
    var pageUrl = site.modelPage ? site.modelPage(model.id) : ('modelo.html?id=' + model.id);
    // Cartões grandes da homepage: PNG completo (não a miniatura 420px)
    var slot = modelCatalogSlot(model);
    var imgPrimary = model.photo ? modelPhotoFullPng(model, slot) : modelImage(model);
    var imgFallback = model.photo ? modelPhotoMdPng(model, slot) : modelImageFallback(model);
    var imgIcon = modelImageFallback(model);

    var card = document.createElement('a');
    card.className = 'collection-card' + (model.novidade ? ' collection-card--novidade' : '');
    card.href = pageUrl;
    card.innerHTML =
      '<img src="' + imgPrimary + '" alt="' + productAltPrefix(model) + model.name + ' - Eleganza Collection" loading="lazy" decoding="async" data-fallback="' + imgFallback + '" data-icon-fallback="' + imgIcon + '" />' +
      (model.novidade ? novidadeBadgeHtml('collection-card__badge-novidade') : '') +
      '<div class="collection-card__veil"></div>' +
      '<div class="collection-card__name">' +
        '<h3>' + model.name + '</h3>' +
        '<span>' + catalogTagLabel(model) + '</span>' +
      '</div>';

    bindImageFallback(card.querySelector('img'));
    return card;
  }

  function load() {
    if (cache) return Promise.resolve(cache);
    return fetch('data/models.json?v=' + encodeURIComponent(PHOTO_CARD_V))
      .then(function (res) {
        if (!res.ok) throw new Error('models.json');
        return res.json();
      })
      .then(function (data) {
        cache = data;
        return data;
      });
  }

  global.StoffusModels = {
    load: load,
    typeLabels: typeLabels,
    all: allModels,
    byId: byId,
    novidades: novidades,
    featuredHome: featuredHome,
    modelImage: modelImage,
    modelImageFallback: modelImageFallback,
    modelPhotoSlots: modelPhotoSlots,
    modelCatalogSlot: modelCatalogSlot,
    modelPhotoOrder: modelPhotoOrder,
    applyPhotoSlot: applyPhotoSlot,
    renderCatalogCard: renderCatalogCard,
    renderCollectionCard: renderCollectionCard,
    bindImageFallback: bindImageFallback
  };
})(window);
