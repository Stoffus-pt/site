(function () {
  var FADE_MS = 550;

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

  function isFullscreenFor(root) {
    var fs = document.fullscreenElement || document.webkitFullscreenElement;
    return fs === root;
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
    var btnFs = root.querySelector('[data-video-fs]');
    if (!video) return;

    var playlist = parsePlaylist(root);
    var index = 0;
    var reduce = prefersReducedMotion();
    var switching = false;
    var fadeArmed = false;
    var shouldLoop = root.getAttribute('data-loop') !== 'false';
    var pingpong = root.getAttribute('data-pingpong') === 'true' && !reduce;
    var scrubRaf = null;
    var scrubLast = 0;

    function current() {
      return playlist[index] || null;
    }

    function stopReverseScrub() {
      if (scrubRaf) {
        cancelAnimationFrame(scrubRaf);
        scrubRaf = null;
      }
    }

    function startReverseScrub() {
      stopReverseScrub();
      try { video.pause(); } catch (e) {}
      scrubLast = performance.now();

      function frame(now) {
        var dt = Math.min(0.05, (now - scrubLast) / 1000);
        scrubLast = now;
        var next = video.currentTime - dt;
        if (next <= 0.02) {
          stopReverseScrub();
          try { video.currentTime = 0; } catch (e2) {}
          video.play().catch(function () {});
          return;
        }
        try { video.currentTime = next; } catch (e3) {}
        scrubRaf = requestAnimationFrame(frame);
      }

      scrubRaf = requestAnimationFrame(frame);
    }

    function updateFsButton() {
      if (!btnFs) return;
      var on = isFullscreenFor(root);
      btnFs.setAttribute('aria-pressed', on ? 'true' : 'false');
      btnFs.setAttribute('aria-label', on ? 'Sair de ecrã cheio' : 'Ecrã cheio');
      btnFs.title = on ? 'Sair de ecrã cheio' : 'Ecrã cheio';
      root.classList.toggle('is-fullscreen', on);
    }

    function applyClip(i, autoplay) {
      if (!playlist.length) return;
      stopReverseScrub();
      index = ((i % playlist.length) + playlist.length) % playlist.length;
      var item = current();
      video.loop = shouldLoop && !pingpong && playlist.length === 1;
      fadeArmed = false;
      if (item.poster) video.setAttribute('poster', item.poster);
      else video.removeAttribute('poster');
      video.src = item.src;
      video.load();
      if (autoplay && !reduce) {
        video.play().catch(function () {});
      }
    }

    function goTo(i, autoplay) {
      if (!playlist.length || switching) return;
      if (reduce || playlist.length < 2) {
        applyClip(i, autoplay);
        return;
      }

      switching = true;
      root.classList.add('is-fading');

      window.setTimeout(function () {
        applyClip(i, false);
        var onReady = function () {
          video.removeEventListener('loadeddata', onReady);
          requestAnimationFrame(function () {
            root.classList.remove('is-fading');
            if (autoplay && !reduce) {
              video.play().catch(function () {});
            }
            switching = false;
          });
        };
        if (video.readyState >= 2) onReady();
        else video.addEventListener('loadeddata', onReady);
      }, FADE_MS);
    }

    function playWhenVisible() {
      if (reduce) return;
      if (!('IntersectionObserver' in window)) {
        applyClip(0, true);
        return;
      }
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          applyClip(0, true);
          observer.disconnect();
        });
      }, { rootMargin: '140px' });
      observer.observe(root);
    }

    video.addEventListener('timeupdate', function () {
      if (switching || reduce || playlist.length < 2 || fadeArmed || pingpong) return;
      if (!video.duration || !isFinite(video.duration)) return;
      var left = video.duration - video.currentTime;
      if (left <= FADE_MS / 1000 + 0.05) {
        fadeArmed = true;
        goTo(index + 1, true);
      }
    });

    video.addEventListener('ended', function () {
      if (pingpong) {
        startReverseScrub();
        return;
      }
      if (!shouldLoop && playlist.length === 1) {
        try {
          video.pause();
          if (video.duration && isFinite(video.duration)) {
            video.currentTime = Math.max(0, video.duration - 0.04);
          }
        } catch (e) {}
        return;
      }
      if (switching || playlist.length < 2) return;
      goTo(index + 1, true);
    });

    video.addEventListener('play', function () {
      stopReverseScrub();
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stopReverseScrub();
    });

    if (btnFs) {
      btnFs.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (isFullscreenFor(root)) {
          exitFs().catch(function () {});
          return;
        }
        requestFs(root).catch(function () {
          if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
        });
      });
    }

    document.addEventListener('fullscreenchange', updateFsButton);
    document.addEventListener('webkitfullscreenchange', updateFsButton);

    if (playlist.length) {
      var first = playlist[0];
      if (first.poster) video.setAttribute('poster', first.poster);
      video.removeAttribute('src');
      while (video.firstChild) video.removeChild(video.firstChild);
      updateFsButton();
      if (video.hasAttribute('autoplay')) applyClip(0, !reduce);
      else playWhenVisible();
    }
  }

  document.querySelectorAll('[data-site-playlist]').forEach(initPlayer);

  (function lazySimpleVideos() {
    var reduce = prefersReducedMotion();
    var videos = Array.prototype.filter.call(
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
