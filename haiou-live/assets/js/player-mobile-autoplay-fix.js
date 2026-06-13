/**
 * 海鸥直播 — 移动端自动播放兼容补丁
 *
 * 目的：
 * 1. iPhone / iPad / Safari 原生 HLS 自动播放失败时，不再误判为线路不可用。
 * 2. 安卓/移动端浏览器自动播放被拦截时，保留播放器和 controls，让用户手动点击播放。
 * 3. 只修正移动端/原生 HLS 的误判，不改播放源、不改聊天室、不改后台接口。
 */
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

    LivePlayer._playHLS = function (stream) {
      var self = this;
      var video = this.videoEl;

      if (!video || !stream || !stream.url) {
        return originalPlayHLS.call(this, stream);
      }

      var nativeHls = isSafariOrIOS() || video.canPlayType('application/vnd.apple.mpegurl');

      // Safari/iOS/部分原生 HLS 浏览器：自动播放失败不代表线路坏。
      if (nativeHls) {
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
          console.warn('[Player] 原生 HLS 加载失败，切换线路:', stream && stream.url);
          self._onStreamError(stream);
        };

        video.addEventListener('loadedmetadata', hideReady, { once: true });
        video.addEventListener('canplay', hideReady, { once: true });
        video.addEventListener('error', onError, { once: true });

        var p = video.play();
        if (p && p.catch) {
          p.catch(function (err) {
            // 苹果/安卓移动端常见：NotAllowedError 自动播放限制。
            // 这不是线路错误，保留 controls，等待用户手动点击播放。
            console.warn('[Player] 移动端等待用户手动播放:', err && (err.name || err.message) || err);
            if (self._hidePlaceholder) self._hidePlaceholder();
          });
        }
        return;
      }

      // 安卓 Chrome 等 hls.js 分支保留原逻辑；原逻辑本身不会把 play() 拒绝当作线路错误。
      originalPlayHLS.call(this, stream);

      // 额外兜底：移动端自动播放被浏览器拦截时，不显示“线路不可用”。
      if (isMobileBrowser() && video && video.play) {
        try {
          var retry = video.play();
          if (retry && retry.catch) {
            retry.catch(function (err) {
              console.warn('[Player] 移动端 hls.js 等待用户手动播放:', err && (err.name || err.message) || err);
              if (self._hidePlaceholder) self._hidePlaceholder();
            });
          }
        } catch (e) {}
      }
    };

    console.log('[Player] mobile autoplay fix installed');
  }

  installFix();
})();
