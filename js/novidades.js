(function () {
  var grid = document.getElementById('novidades-grid');
  var countEl = document.getElementById('novidades-count');
  if (!grid) return;

  StoffusModels.load().then(function (data) {
    var models = StoffusModels.novidades(data);
    var types = StoffusModels.typeLabels(data);

    models.forEach(function (model) {
      grid.appendChild(StoffusModels.renderCatalogCard(model, {
        types: types,
        linkLabel: 'Ver novidade',
        configLabel: 'Configurar em 3D'
      }));
    });

    if (countEl) {
      countEl.textContent = models.length + (models.length === 1 ? ' novidade' : ' novidades');
    }
  });
})();
