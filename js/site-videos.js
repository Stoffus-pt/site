(function () {
  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function parsePlaylist(el) {
    var raw = el.getAttribute('data-playlist');
    if (!raw) return [];
    try {
      var list = JSON.parse(raw);
      return Array.isArray(list) ? list.filter(function (item) { return item && item.src; }) : [];
    } catch (e) {
      return [];
    }
  }

  function isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  function requestFs(node) {
    if (node.requestFullscreen) return node.requestFullscreen();
    if (node.webkitRequestFullscreen) return node.webkitRequestFullscreen();
    return Promise.reject();
  }

  function exitFs() {
    if (document.exitFullscreen) return document.exitFullscreen();
    if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
    return Promise.resolve();
  }

  function initPlayer(root) {
    var video = root.querySelector('video');
    if (!video) return;

    var playlist = parsePlaylist(root);
    var labelEl = root.querySelector('[data-video-label]');
    var stepEl = root.querySelector('[data-video-step]');
    var btnPrev = root.querySelector('[data-video-prev]');
    var btnNext = root.querySelector('[data-video-next]');
    var btnFs = root.querySelector('[data-video-fs]');
    var index = 0;
    var reduce = prefersReducedMotion();

    function current() {
      return playlist[index] || null;
    }

    function updateChrome() {
      var item = current();
      if (labelEl) labelEl.textContent = item && item.label ? item.label : '';
      if (stepEl) {
        stepEl.textContent = playlist.length > 1
          ? (index + 1) + ' / ' + playlist.length
          : '';
      }
      if (btnPrev) btnPrev.disabled = playlist.length < 2;
      if (btnNext) btnNext.disabled = playlist.length < 2;
      if (btnFs) {
        btnFs.setAttribute('aria-pressed', isFullscreen() && (document.fullscreenElement === root || document.webkitFullscreenElement === root) ? 'true' : 'false');
        btnFs.title = isFullscreen() ? 'Sair de ecrã cheio' : 'Ecrã cheio';
        var text = btnFs.querySelector('[data-fs-label]');
        if (text) text.textContent = isFullscreen() ? 'Sair' : 'Ecrã cheio';
      }
    }

    function loadClip(i, autoplay) {
      if (!playlist.length) return;
      index = ((i % playlist.length) + playlist.length) % playlist.length;
      var item = current();
      video.loop = playlist.length === 1;
      if (item.poster) video.setAttribute('poster', item.poster);
      video.src = item.src;
      video.load();
      updateChrome();
      if (autoplay && !reduce) {
        video.play().catch(function () {});
      }
    }

    function playWhenVisible() {
      if (reduce) return;
      if (!('IntersectionObserver' in window)) {
        loadClip(0, true);
        return;
      }
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          loadClip(0, true);
          observer.disconnect();
        });
      }, { rootMargin: '140px' });
      observer.observe(root);
    }

    video.addEventListener('ended', function () {
      if (playlist.length < 2) return;
      loadClip(index + 1, true);
    });

    if (btnPrev) {
      btnPrev.addEventListener('click', function () {
        loadClip(index - 1, true);
      });
    }
    if (btnNext) {
      btnNext.addEventListener('click', function () {
        loadClip(index + 1, true);
      });
    }
    if (btnFs) {
      btnFs.addEventListener('click', function () {
        if (isFullscreen() && (document.fullscreenElement === root || document.webkitFullscreenElement === root)) {
          exitFs().catch(function () {});
          return;
        }
        requestFs(root).catch(function () {
          if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
        });
      });
    }

    document.addEventListener('fullscreenchange', updateChrome);
    document.addEventListener('webkitfullscreenchange', updateChrome);

    if (playlist.length) {
      // Pré-carregar o primeiro clip no src sem autoplay até estar visível
      var first = playlist[0];
      if (first.poster) video.setAttribute('poster', first.poster);
      video.removeAttribute('src');
      while (video.firstChild) video.removeChild(video.firstChild);
      updateChrome();
      if (video.hasAttribute('autoplay')) {
        loadClip(0, !reduce);
      } else {
        playWhenVisible();
      }
    } else if (!reduce && video.hasAttribute('autoplay')) {
      video.play().catch(function () {});
    } else if (!reduce) {
      if ('IntersectionObserver' in window) {
        var obs = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            video.setAttribute('preload', 'metadata');
            video.play().catch(function () {});
            obs.disconnect();
          });
        }, { rootMargin: '140px' });
        obs.observe(video);
      }
    }
  }

  document.querySelectorAll('[data-site-playlist]').forEach(initPlayer);

  // Vídeos simples (ex.: AR) sem playlist
  (function lazySimpleVideos() {
    var reduce = prefersReducedMotion();
    var videos = document.querySelectorAll('.config-block__video:not([data-site-playlist] *), .s3d-demo__video:not([data-site-playlist] *)');
    // querySelector :not with descendant is invalid in some browsers - use filter instead
    videos = Array.prototype.filter.call(
      document.querySelectorAll('.config-block__video, .s3d-demo__video'),
      function (video) { return !video.closest('[data-site-playlist]'); }
    );
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
