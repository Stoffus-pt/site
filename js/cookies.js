(function (global) {
  var STORAGE_KEY = 'stoffus_cookie_consent';

  function hasConsent() {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function setConsent() {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch (e) {}
  }

  function createBanner() {
    if (hasConsent() || document.getElementById('cookie-banner')) return;

    var banner = document.createElement('div');
    banner.id = 'cookie-banner';
    banner.className = 'cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Privacidade e cookies');
    banner.innerHTML =
      '<div class="cookie-banner__inner container">' +
        '<p>Este site utiliza cookies essenciais e, com o seu consentimento, localização GPS no formulário «Onde ver». ' +
        '<a href="privacidade.html">Política de privacidade</a>.</p>' +
        '<div class="cookie-banner__actions">' +
          '<button type="button" class="btn btn--brand" id="cookie-accept">Aceitar</button>' +
          '<a class="btn btn--outline" href="privacidade.html">Saber mais</a>' +
        '</div>' +
      '</div>';

    document.body.appendChild(banner);
    document.body.classList.add('has-cookie-banner');

    document.getElementById('cookie-accept').addEventListener('click', function () {
      setConsent();
      banner.remove();
      document.body.classList.remove('has-cookie-banner');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createBanner);
  } else {
    createBanner();
  }

  global.StoffusCookies = { hasConsent: hasConsent, setConsent: setConsent };
})(window);
