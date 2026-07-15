(function (global) {
  var host = location.hostname;
  var isLocal = host === 'localhost' || host === '127.0.0.1' || host === '';
  var isGithubPreview = host.endsWith('.github.io');
  var onlineTextures = 'https://stoffus.pt/Studio3D/assets/textures/';

  var onlineConfigurator = 'https://stoffus.pt/Studio3D/app.html';

  // Com ABRIR-CMS.bat (router na raiz): /Studio3D/app.html funciona em local.
  // Pré-visualização GitHub Pages: configurador continua no stoffus.pt.
  function configuratorBase() {
    if (isGithubPreview) {
      return onlineConfigurator;
    }
    if (isLocal) {
      var port = location.port || '';
      if (port === '8080') {
        return '/Studio3D/app.html';
      }
      return onlineConfigurator;
    }
    return '/Studio3D/app.html';
  }

  function textureRemoteBase() {
    if (isGithubPreview) {
      return onlineTextures;
    }
    if (isLocal) {
      var port = location.port || '';
      if (port === '8080') {
        return '/Studio3D/assets/textures/';
      }
      return onlineTextures;
    }
    return '/Studio3D/assets/textures/';
  }

  function encodeCfgState(parts) {
    try {
      return btoa(parts.join('|'));
    } catch (e) {
      return '';
    }
  }

  function encodeCfg(modelId) {
    return encodeCfgState([modelId, '', 'black_matte', 0, 'L', '']);
  }

  function encodeCfgFabric(fabricId, modelId) {
    if (!fabricId) return '';
    var mid = modelId || pickRandomModelId();
    return encodeCfgState([mid, fabricId, 'black_matte', 0, 'L', '']);
  }

  var modelIds = null;

  function pickRandomModelId() {
    var ids = modelIds && modelIds.length ? modelIds : ['brittany', 'athena', 'enzo', 'magic'];
    return ids[Math.floor(Math.random() * ids.length)];
  }

  function loadModelIds() {
    if (modelIds) return Promise.resolve(modelIds);
    return fetch('data/models.json')
      .then(function (res) {
        if (!res.ok) throw new Error('models.json');
        return res.json();
      })
      .then(function (data) {
        modelIds = (data.models || []).map(function (m) { return m.id; }).filter(Boolean);
        return modelIds;
      })
      .catch(function () {
        modelIds = ['brittany', 'athena', 'enzo', 'magic'];
        return modelIds;
      });
  }

  loadModelIds();

  global.StoffusSite = {
    isLocal: isLocal,
    isGithubPreview: isGithubPreview,
    siteRoot: (isLocal || isGithubPreview) ? (location.origin || '') : 'https://stoffus.pt',
    org: {
      name: 'Stoffus',
      legalName: 'Stoffus - Indústria Portuguesa de Sofás',
      url: 'https://stoffus.pt',
      phone: '+351239700799',
      email: 'geral@stoffus.pt',
      address: {
        street: 'Parque de Negócios 7/8',
        city: 'Montemor-o-Velho',
        postalCode: '3140-258',
        country: 'PT'
      }
    },
    configurator: configuratorBase(),
    configuratorForModel: function (modelId) {
      if (!modelId) return configuratorBase();
      var cfg = encodeCfg(modelId);
      return cfg ? configuratorBase() + '?cfg=' + encodeURIComponent(cfg) : configuratorBase();
    },
    configuratorForFabric: function (fabricId, modelId) {
      if (!fabricId) return configuratorBase();
      var cfg = encodeCfgFabric(fabricId, modelId);
      return cfg ? configuratorBase() + '?cfg=' + encodeURIComponent(cfg) : configuratorBase();
    },
    pickRandomModelId: pickRandomModelId,
    loadModelIds: loadModelIds,
    modelPage: function (modelId) {
      return 'modelo.html?id=' + encodeURIComponent(modelId);
    },
    applyLinks: function () {
      var base = configuratorBase();
      document.querySelectorAll('[data-stoffus-configurator]').forEach(function (el) {
        el.setAttribute('href', base);
      });
      document.querySelectorAll('[data-stoffus-configurator-model]').forEach(function (el) {
        var id = el.getAttribute('data-stoffus-configurator-model') || '';
        el.setAttribute('href', global.StoffusSite.configuratorForModel(id));
      });
    },
    downloads: {
      catalogPdf: 'https://stoffus.pt/wp-content/uploads/2026/01/Catalogo.1EleganzaCollection_email.pdf',
      priceXlsx: 'https://stoffus.pt/wp-content/uploads/2026/02/Tabela-de-Precos-Stoffus-Eleganza-Collection.xlsx',
      warehouse3d: 'https://3dwarehouse.sketchup.com/by/stoffus#models'
    },
    textureRemote: textureRemoteBase()
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      global.StoffusSite.applyLinks();
    });
  } else {
    global.StoffusSite.applyLinks();
  }
})(window);
