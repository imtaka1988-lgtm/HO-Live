(function () {
  'use strict';

  function isSafariOrIOS() {
    var ua = navigator.userAgent || '';
    var isIOS = /iPad|iPhone|iPod/.test(ua);
    var isSafari = /Safari/.test(ua) && !/Chrome/.test(ua) && !/CriOS/.test(ua) && !/FxiOS/.test(ua);
    return isIOS || isSafari;
  }

  function isMobileBrowser() {
    return /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent || '') || window.innerWidth <= 780;
  }

  function installFix() {
    var LivePlayer = window.LivePlayer;

    if (!LivePlayer || !LivePlayer._playHLS) {
      setTimeout(installFix, 30);
      return;
    }

    if (LivePlayer.__mobileAutoplayFixInstalled) return;
    LivePlayer.__mobileAutoplayFixInstalled = true;

    var originalPlayHLS = LivePlayer._playHLS;

    LivePlayer._playHLS = function (stream, token) {
      var self = this;
      var video = this.videoEl;

      if (!video || !stream || !stream.url) {
        return originalPlayHLS.call(this, stream, token);
      }

      if (isSafariOrIOS()) {
        video.playsInline = true;
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        video.preload = 'auto';
        video.src = stream.url;
        video.load();

        var hasRealError = false;
        var hideReady = function () {
          if (!hasRealError && self._hidePlaceholder) self._hidePlaceholder();
        };

        var onError = function () {
          hasRealError = true;
          console.warn('[Player] native HLS load failed:', stream && stream.url);
          self._onStreamError(stream, token);
        };

        video.addEventListener('loadedmetadata', hideReady, { once: true });
        video.addEventListener('canplay', hideReady, { once: true });
        video.addEventListener('error', onError, { once: true });

        var p = video.play();
        if (p && p.catch) {
          p.catch(function (err) {
            console.warn('[Player] wait for user play:', err && (err.name || err.message) || err);
            if (self._hidePlaceholder) self._hidePlaceholder();
          });
        }
        return;
      }

      originalPlayHLS.call(this, stream, token);

      if (isMobileBrowser() && video && video.play) {
        try {
          var retry = video.play();
          if (retry && retry.catch) {
            retry.catch(function (err) {
              console.warn('[Player] wait for user hlsjs play:', err && (err.name || err.message) || err);
              if (self._hidePlaceholder) self._hidePlaceholder();
            });
          }
        } catch (e) {}
      }
    };

    console.log('[Player] mobile hls fix installed');
  }

  installFix();
})();
