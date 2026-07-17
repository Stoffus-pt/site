(function () {
  var root = document.getElementById('modelo-page');
  if (!root) return;

  var params = new URLSearchParams(location.search);
  var modelId = String(params.get('id') || '').toLowerCase();

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function renderThumb(slot, index, isActive) {
    return (
      '<button type="button" class="model-detail__thumb' + (isActive ? ' is-active' : '') + '" ' +
        'role="tab" aria-selected="' + (isActive ? 'true' : 'false') + '" ' +
        'aria-label="' + esc(slot.alt) + '" data-photo-index="' + index + '">' +
        '<img src="' + slot.src + '" alt="" loading="lazy" decoding="async" ' +
          'data-fallback="' + slot.png + '" data-icon-fallback="' + slot.icon + '" />' +
      '</button>'
    );
  }

  function wirePhotoGallery(pageRoot, slots) {
    var heroImg = pageRoot.querySelector('#model-hero-photo');
    var thumbs = pageRoot.querySelectorAll('.model-detail__thumb');
    if (!heroImg || !thumbs.length) return;

    function selectPhoto(index) {
      var slot = slots[index];
      if (!slot) return;
      StoffusModels.applyPhotoSlot(heroImg, slot);
      thumbs.forEach(function (btn, i) {
        var active = i === index;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
      });
    }

    thumbs.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var index = Number(btn.dataset.photoIndex);
        if (!Number.isNaN(index)) selectPhoto(index);
      });
    });

    if (slots.length === 1) {
      thumbs[0].parentElement.classList.add('model-photo-thumbs--single');
    }
  }

  function renderMeasurements(rows) {
    if (!Array.isArray(rows) || !rows.length) return '';
    var body = rows.map(function (row) {
      return (
        '<div class="model-specs__row">' +
          '<dt>' + esc(row.label) + '</dt>' +
          '<dd>' + esc(row.value) + '</dd>' +
        '</div>'
      );
    }).join('');
    return (
      '<section class="model-panel" aria-labelledby="model-medidas-title">' +
        '<h2 id="model-medidas-title">Medidas</h2>' +
        '<dl class="model-specs">' + body + '</dl>' +
      '</section>'
    );
  }

  function renderOptions(options, fallbackHtml) {
    if (Array.isArray(options) && options.length) {
      return (
        '<section class="model-panel" aria-labelledby="model-opcoes-title">' +
          '<h2 id="model-opcoes-title">Opções</h2>' +
          '<ul class="config-block__list">' +
            options.map(function (opt) { return '<li>' + esc(opt) + '</li>'; }).join('') +
          '</ul>' +
        '</section>'
      );
    }
    return fallbackHtml || '';
  }

  function renderRelated(data, model) {
    var ids = Array.isArray(model.related) ? model.related : [];
    var related = ids
      .map(function (id) { return StoffusModels.byId(data, id); })
      .filter(function (m) { return m && m.id !== model.id; })
      .slice(0, 4);

    if (!related.length) {
      var sameType = (data.models || []).filter(function (m) {
        return m.id !== model.id && m.type === model.type && m.photo;
      }).slice(0, 4);
      related = sameType;
    }

    if (!related.length) return '';

    var cards = related.map(function (m) {
      return StoffusModels.renderCollectionCard(m).outerHTML;
    }).join('');

    return (
      '<section class="section section--warm" aria-labelledby="model-related-title">' +
        '<div class="container">' +
          '<div class="section-head section-head--center">' +
            '<span class="label">Sugestões</span>' +
            '<h2 id="model-related-title">Também pode gostar</h2>' +
          '</div>' +
          '<div class="collections">' + cards + '</div>' +
        '</div>' +
      '</section>'
    );
  }

  StoffusModels.load().then(function (data) {
    var model = StoffusModels.byId(data, modelId);
    if (!model) {
      root.innerHTML =
        '<div class="container section">' +
          '<h1>Modelo não encontrado</h1>' +
          '<p><a href="catalogo.html">Voltar ao catálogo</a></p>' +
        '</div>';
      document.title = 'Modelo não encontrado | Stoffus';
      return;
    }

    var types = StoffusModels.typeLabels(data);
    var typeLabel = types[model.type] || model.type;
    var site = window.StoffusSite || {};
    var configUrl = site.configuratorForModel ? site.configuratorForModel(model.id) : site.configurator;
    var photoSlots = StoffusModels.modelPhotoSlots(model);
    var primary = photoSlots[0];
    var showConfig = model.configurator !== false && model.type !== 'pet';
    var isPet = model.type === 'pet';
    var isBanqueta = model.type === 'banqueta';
    var isPouf = model.type === 'pouf';

    var productLabel = isPet
      ? model.name
      : (isBanqueta ? ('Banqueta ' + model.name) : (isPouf ? ('Puff ' + model.name) : ('Sofá ' + model.name)));

    document.title = model.name + ' | Stoffus - Eleganza Collection';
    var metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', model.description || (productLabel + ' - Eleganza Collection Stoffus.'));
    if (window.StoffusSeo) {
      StoffusSeo.applyPageSeo({
        title: document.title,
        description: model.description || (productLabel + ' - Eleganza Collection Stoffus.'),
        image: primary.png || primary.src,
        type: 'product',
        url: StoffusSeo.publicBaseUrl().replace(/\/$/, '') + '/modelo.html?id=' + encodeURIComponent(model.id)
      });
    }

    var thumbsHtml = photoSlots.map(function (slot, index) {
      return renderThumb(slot, index, index === 0);
    }).join('');

    var pdfBtn = model.pdf
      ? '<a class="btn btn--outline btn--lg" href="' + esc(model.pdf) + '" target="_blank" rel="noopener">PDF do modelo</a>'
      : '';

    var heroActions = showConfig
      ? '<a class="btn btn--brand btn--lg" href="' + configUrl + '">Configurar em 3D</a>' +
        '<a class="btn btn--outline btn--lg" href="tecidos.html">Ver tecidos</a>' + pdfBtn
      : '<a class="btn btn--brand btn--lg" href="onde-comprar.html">Onde ver</a>' +
        '<a class="btn btn--outline btn--lg" href="contactos.html">Contactar Stoffus</a>' + pdfBtn;

    var detailText = isPet
      ? 'Produto em espuma pensado para o conforto do seu pet. Peça indicação de onde ver o modelo e obter informação sobre medidas, cores e disponibilidade.'
      : isBanqueta
      ? 'Banqueta fabricada em Portugal, disponível em três larguras e centenas de revestimentos. No Stoffus 3D escolha tecido, tamanho e versão com ou sem cofre interior.'
      : isPouf
      ? (model.description || 'Puff fabricado em Portugal, disponível em centenas de revestimentos. Complemento ideal para a zona de estar.')
      : (showConfig
        ? 'Fabricado em Portugal, com centenas de revestimentos em tecido e pele. Configure módulos, medidas e acabamentos no Stoffus 3D e leve a ideia pronta à visita.'
        : 'Fabricado em Portugal, com centenas de revestimentos em tecido e pele. Este modelo está disponível para ver e encomendar através da nossa rede de lojas parceiras — peça indicação de visita.');

    var defaultOptionsHtml = isPet
      ? '<ul class="config-block__list">' +
          '<li>Espuma macia e estável</li>' +
          '<li>Para colocar no sofá ou na cama</li>' +
          '<li>Facilita o acesso do pet com segurança</li>' +
        '</ul>'
      : isBanqueta
      ? '<ul class="config-block__list">' +
          '<li>Três larguras: 120, 140 e 150 cm</li>' +
          '<li>Base metálica dourada de série</li>' +
          '<li>Opção cofre interior com acolchoamento</li>' +
        '</ul>'
      : isPouf
      ? '<ul class="config-block__list">' +
          '<li>Formato redondo, linhas contemporâneas</li>' +
          '<li>Centenas de tecidos e peles disponíveis</li>' +
          '<li>Complemento versátil para sofá ou poltrona</li>' +
        '</ul>'
      : '<ul class="config-block__list">' +
          (showConfig
            ? '<li>Configuração modular (quando aplicável)</li>' +
              '<li>Tecidos Easy Clean, Pet Friendly e antibacteriano</li>' +
              '<li>Orçamento PDF e partilha por link ou QR</li>'
            : '<li>Disponível em lojas parceiras Stoffus</li>' +
              '<li>Centenas de tecidos e peles Eleganza</li>' +
              '<li>Peça indicação de visita na sua zona</li>') +
        '</ul>';

    var optionsBlock = renderOptions(model.options, '<div class="model-panel"><h2>Destaques</h2>' + defaultOptionsHtml + '</div>');
    var measuresBlock = renderMeasurements(model.measurements);
    var relatedBlock = renderRelated(data, model);

    var detailActions = showConfig
      ? '<a class="btn btn--brand" href="' + configUrl + '">Abrir no configurador</a>' +
        '<a class="btn btn--outline" href="onde-comprar.html">Onde ver</a>' +
        (model.pdf ? '<a class="btn btn--outline" href="' + esc(model.pdf) + '" target="_blank" rel="noopener">Descarregar PDF</a>' : '')
      : '<a class="btn btn--brand" href="onde-comprar.html">Onde ver</a>' +
        '<a class="btn btn--outline" href="contactos.html">Pedir informação</a>' +
        (model.pdf ? '<a class="btn btn--outline" href="' + esc(model.pdf) + '" target="_blank" rel="noopener">Descarregar PDF</a>' : '');

    root.innerHTML =
      '<section class="catalog-hero model-hero" aria-label="' + esc(model.name) + '">' +
        '<div class="container catalog-hero__inner">' +
          '<div class="catalog-hero__copy">' +
            '<div class="model-hero__labels">' +
              '<span class="label">' + esc(typeLabel) + '</span>' +
              (model.novidade ? '<span class="badge-novidade">Novidade</span>' : '') +
            '</div>' +
            '<h1>' + esc(model.name) + '</h1>' +
            '<p class="catalog-hero__lead">' + esc(model.description || '') + '</p>' +
            '<div class="model-hero__actions">' + heroActions + '</div>' +
          '</div>' +
          '<div class="model-hero__media">' +
            '<img id="model-hero-photo" src="' + primary.src + '" alt="' + esc(primary.alt) + '" width="1024" height="576" fetchpriority="high" ' +
              'data-fallback="' + primary.png + '" data-icon-fallback="' + primary.icon + '" />' +
            '<div class="model-photo-thumbs" role="tablist" aria-label="Fotografias do modelo">' +
              thumbsHtml +
            '</div>' +
          '</div>' +
        '</div>' +
      '</section>' +
      '<section class="section" aria-label="Detalhes">' +
        '<div class="container model-detail model-detail--rich">' +
          '<div class="model-detail__gallery" role="tablist" aria-label="Seleccionar fotografia">' +
            thumbsHtml +
          '</div>' +
          '<div class="model-detail__info">' +
            '<span class="label">Eleganza Collection</span>' +
            '<h2>' + esc(model.tag) + '</h2>' +
            '<p>' + detailText + '</p>' +
            measuresBlock +
            optionsBlock +
            '<div class="model-detail__actions">' + detailActions + '</div>' +
          '</div>' +
        '</div>' +
      '</section>' +
      relatedBlock;

    root.querySelectorAll('img[data-fallback]').forEach(function (img) {
      StoffusModels.bindImageFallback(img);
    });

    wirePhotoGallery(root, photoSlots);
  });
})();
