(function () {
  var toggle = document.getElementById('menu-toggle');
  var mobileNav = document.getElementById('mobile-nav');
  if (toggle && mobileNav) {
    toggle.addEventListener('click', function () {
      var open = mobileNav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.style.overflow = open ? 'hidden' : '';
    });

    mobileNav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        mobileNav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });
  }

  var path = location.pathname.split('/').pop() || 'index.html';
  if (path === '') path = 'index.html';
  document.querySelectorAll('.site-nav a, .mobile-nav a').forEach(function (link) {
    var href = link.getAttribute('href') || '';
    if (href === path) link.classList.add('is-active');
  });

  document.querySelectorAll('a[href="area-cliente.html"]').forEach(function (link) {
    if (/Área cliente/i.test(link.textContent)) link.textContent = 'Downloads';
  });

  document.querySelectorAll('.footer-bottom').forEach(function (el) {
    if (el.querySelector('.footer-legal')) return;
    var legal = document.createElement('span');
    legal.className = 'footer-legal';
    legal.innerHTML = '<a href="privacidade.html">Privacidade</a>';
    el.appendChild(legal);
  });

  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  (function lazySiteVideos() {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var videos = document.querySelectorAll('.config-block__video, .s3d-demo__video');
    if (!videos.length) return;

    function play(video) {
      if (reduce) {
        video.removeAttribute('autoplay');
        try { video.pause(); } catch (e) {}
        return;
      }
      video.setAttribute('preload', 'metadata');
      video.play().catch(function () {});
    }

    if (reduce || !('IntersectionObserver' in window)) {
      videos.forEach(play);
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        play(entry.target);
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '140px' });

    videos.forEach(function (video) {
      if (video.hasAttribute('autoplay')) play(video);
      else observer.observe(video);
    });
  })();
})();
