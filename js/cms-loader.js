(function () {
  if (location.search.indexOf('cms=1') === -1) return;
  var s = document.createElement('script');
  s.src = 'cms/preview.js';
  document.body.appendChild(s);
})();
