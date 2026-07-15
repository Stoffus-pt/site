(function () {
  var site = window.StoffusSite || {};
  var d = site.downloads || {};

  document.querySelectorAll('[data-download="catalog-pdf"]').forEach(function (el) {
    if (d.catalogPdf) el.setAttribute('href', d.catalogPdf);
  });
  document.querySelectorAll('[data-download="price-xlsx"]').forEach(function (el) {
    if (d.priceXlsx) el.setAttribute('href', d.priceXlsx);
  });
  document.querySelectorAll('[data-download="warehouse-3d"]').forEach(function (el) {
    if (d.warehouse3d) el.setAttribute('href', d.warehouse3d);
  });
})();
