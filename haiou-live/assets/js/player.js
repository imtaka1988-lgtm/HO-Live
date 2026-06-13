/**
 * 海鸥直播 V4.1 — 播放器模块
 *
 * 职责：
 *   1. 读取直播间 streams[] 多线路配置
 *   2. Safari/iOS 原生 HLS 播放
 *   3. Chrome/Edge/Firefox 使用本地 hls.js 播放
 *   4. 线路切换（主线路 → 备用 → 自动降级）
 *   5. 播放失败提示与自动切换
 *   6. FLV 线路仅 PC 端展示，点击提示暂未启用
 *   7. streamUrl 后向兼容（自动转为单条 HLS 线路）
 *
 * 依赖：
 *   assets/vendor/hls.min.js（本地优先，Hls 全局变量）
 */

(function (window) {
  'use strict';

  var HlsLib = window.Hls; // hls.js 全局
  var FlvLib = window.flvjs; // flv.js 全局

  // ===================== 工具函数 =====================

  /** 检测是否为 iOS / Safari */
  function isSafariOrIOS() {
    var ua = navigator.userAgent;
    var isIOS = /iPad|iPhone|iPod/.test(ua);
    var isSafari = /Safari/.test(ua) && !/Chrome/.test(ua) && !/CriOS/.test(ua);
    return isIOS || isSafari;
  }

  /** 检测是否为移动端（含 iPad） */
  function isMobile() {
    return /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent) || window.innerWidth <= 780;
  }

  /** HTML 转义 */
  function esc(s) {
    return String(s).replace(/[&<>'"]/g, function (c) {
      return { '&': '&', '<': '<', '>': '>', "'": '&#39;', '"': '"' }[c];
    });
  }

  // ===================== 线路规范化 =====================

  /**
   * 将 room 数据中的 streamUrl / streams 规范化为统一的 streams[] 结构
   * @param {Object} room 直播间数据
   * @returns {Array} streams[]
   */
  function normalizeStreams(room) {
    if (room.streams && Array.isArray(room.streams) && room.streams.length > 0) {
      return room.streams.filter(function (s) { return s.enabled !== false; });
    }
    if (room.streamUrl) {
      return [{
        name: '高清模式',
        type: 'hls',
        url: room.streamUrl,
        provider: 'default',
        enabled: true,
        default: true,
        priority: 1
      }];
    }
    return [];
  }

  // ===================== LivePlayer 核心 =====================

  var LivePlayer = {
    /** 当前 HLS 实例 */
    hlsInstance: null,
    /** 当前使用的视频元素 */
    videoEl: null,
    /** 当前线路列表 */
    streams: [],
    /** 当前线路索引 */
    currentStreamIndex: -1,
    /** 当前直播间 */
    room: null,
    /** 容器元素 */
    container: null,
    /** 是否已销毁 */
    destroyed: false,
    /** 手机端线路按钮自动隐藏定时器 */
    _mobileLineTimer: null,
    /** 线路切换器容器元素 */
    _lineSwitcherEl: null,

    /**
     * 初始化播放器
     * @param {Object} options
     *   - videoEl: HTMLVideoElement（必须）
     *   - container: 用于挂载线路切换 UI 的容器元素
     *   - room: 直播间数据对象
     *   - onError: 全局错误回调
     */
    init: function (options) {
      if (!options || !options.videoEl) return;
      this.destroyed = false;
      this.videoEl = options.videoEl;
      this.container = options.container || options.videoEl.parentNode;
      this.room = options.room || {};
      this.onError = options.onError || null;
      this.streams = normalizeStreams(this.room);

      if (this.streams.length === 0) {
        this._showPlaceholder('暂无可用的播放线路');
        return;
      }

      // 线路切换 UI 已禁用 — 设备自动选源
      this._renderLineSwitcher();

      // 选择默认线路
      var defaultStream = this._getDefaultStream();
      if (defaultStream) {
        this._playStream(defaultStream, this.streams.indexOf(defaultStream));
      }

      // 手机端点击显示逻辑已随线路按钮一同禁用
      // this._bindMobileControls();
    },

    /** 获取默认线路（按 default + priority 排序） */
    _getDefaultStream: function () {
      var sorted = this.streams.slice().sort(function (a, b) {
        if (a.default && !b.default) return -1;
        if (!a.default && b.default) return 1;
        return (a.priority || 99) - (b.priority || 99);
      });
      if (isMobile()) {
        sorted = sorted.filter(function (s) { return s.type !== 'flv'; });
      }
      return sorted[0] || null;
    },

    /** 播放指定线路 */
    _playStream: function (stream, idx) {
      var self = this;
      if (!stream || !stream.url) return;

      this._destroyHls();

      this.currentStreamIndex = idx;
      this._hidePlaceholder();

      if (stream.type === 'hls') {
        this._playHLS(stream);
      } else if (stream.type === 'flv') {
        this._playFLV(stream);
      } else {
        this.videoEl.src = stream.url;
        this.videoEl.play().catch(function () {});
      }

      this._updateLineButtons(idx);
    },

    /** HLS 播放 */
    _playHLS: function (stream) {
      var self = this;
      var video = this.videoEl;

      if (isSafariOrIOS() || video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = stream.url;
        video.play().catch(function () {
          self._onStreamError(stream);
        });
        return;
      }

      if (HlsLib && HlsLib.isSupported()) {
        var hls = new HlsLib({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 90
        });
        hls.loadSource(stream.url);
        hls.attachMedia(video);
        hls.on(HlsLib.Events.MANIFEST_PARSED, function () {
          video.play().catch(function () {});
        });
        hls.on(HlsLib.Events.ERROR, function (event, data) {
          if (data.fatal) {
            switch (data.type) {
              case HlsLib.ErrorTypes.NETWORK_ERROR:
                console.warn('[Player] 网络错误，尝试切换线路');
                self._onStreamError(stream);
                break;
              case HlsLib.ErrorTypes.MEDIA_ERROR:
                console.warn('[Player] 媒体错误，尝试恢复');
                hls.recoverMediaError();
                break;
              default:
                console.warn('[Player] 致命错误');
                self._onStreamError(stream);
                break;
            }
          }
        });
        this.hlsInstance = hls;
      } else {
        video.src = stream.url;
        video.play().catch(function () {
          self._onStreamError(stream);
        });
      }
    },

    /** FLV 播放：最小接入版 */
    _playFLV: function (stream) {
      var self = this;
      var video = this.videoEl;
      var Flv = window.flvjs;

      console.log('[Player] 尝试 FLV 播放：', stream && stream.url);

      if (!Flv || !Flv.isSupported || !Flv.isSupported()) {
        console.warn('[Player] 当前浏览器不支持 FLV，自动切换下一条线路');
        this._onStreamError(stream);
        return;
      }

      try {
        var flvPlayer = Flv.createPlayer({
          type: 'flv',
          url: stream.url,
          isLive: true,
          cors: true
        }, {
          enableWorker: false,
          lazyLoad: false,
          stashInitialSize: 128
        });

        this.flvInstance = flvPlayer;

        video.muted = true;
        video.autoplay = true;
        video.playsInline = true;

        flvPlayer.attachMediaElement(video);
        flvPlayer.load();

        video.play().then(function () {
          self._hidePlaceholder();
          console.log('[Player] FLV 静音自动播放成功');
        }).catch(function (err) {
          console.warn('[Player] FLV 播放失败，自动切换下一条线路：', err);
          self._onStreamError(stream);
        });

        flvPlayer.on(Flv.Events.ERROR, function (type, detail, info) {
          console.warn('[Player] FLV ERROR，自动切换下一条线路:', type, detail, info);
          self._onStreamError(stream);
        });
      } catch (e) {
        console.warn('[Player] FLV 初始化失败，自动切换下一条线路：', e);
        self._onStreamError(stream);
      }
    },

    /** 销毁当前 HLS 实例 */
    _destroyHls: function () {
      if (this.hlsInstance) {
        this.hlsInstance.detachMedia();
        this.hlsInstance.destroy();
        this.hlsInstance = null;
      }

      if (this.flvInstance) {
        try {
          this.flvInstance.pause();
          this.flvInstance.unload();
          this.flvInstance.detachMediaElement();
          this.flvInstance.destroy();
        } catch (e) {}
        this.flvInstance = null;
      }

      if (this.videoEl) {
        this.videoEl.pause();
        this.videoEl.removeAttribute('src');
        this.videoEl.load();
      }
    },

    /** 线路播放失败处理 */
    _onStreamError: function (failedStream) {
      if (this.destroyed) return;
      var next = this._findNextStream(failedStream);
      if (next) {
        console.log('[Player] 自动切换到：' + next.name);
        this._playStream(next, this.streams.indexOf(next));
      } else {
        this._showPlaceholder('当前线路不可用，请切换线路');
      }
    },

    /** 查找下一条可用线路 */
    _findNextStream: function (failedStream) {
      var streams = this.streams;
      if (isMobile()) {
        streams = streams.filter(function (s) { return s.type !== 'flv'; });
      }
      var failedIdx = streams.indexOf(failedStream);
      for (var i = failedIdx + 1; i < streams.length; i++) {
        if (streams[i] !== failedStream) return streams[i];
      }
      for (var j = 0; j < failedIdx; j++) {
        if (streams[j] !== failedStream) return streams[j];
      }
      return null;
    },

    /**
     * 切换线路（外部调用）— 保留供内部错误恢复使用
     * @param {number} idx streams 数组索引
     */
    switchTo: function (idx) {
      if (idx >= 0 && idx < this.streams.length) {
        this._playStream(this.streams[idx], idx);
        if (isMobile() && this._lineSwitcherEl) {
          this._lineSwitcherEl.classList.remove('is-open');
          this._startMobileLineTimer();
        }
      }
    },

    // ===================== UI 渲染 =====================

    /** 渲染线路切换按钮 — 已禁用，设备自动选源 */
    _renderLineSwitcher: function () {
      return;
      /* 以下保留以便后续恢复线路切换功能
      var self = this;
      var displayStreams = this.streams;
      if (isMobile()) {
        displayStreams = this.streams.filter(function (s) { return s.type !== 'flv'; });
      }
      if (displayStreams.length <= 1) return;

      var old = this.container && this.container.querySelector('.player-line-switcher');
      if (old) old.remove();

      var wrapper = document.createElement('div');
      wrapper.className = 'player-line-switcher';
      this._lineSwitcherEl = wrapper;

      var current = self.streams[self.currentStreamIndex >= 0 ? self.currentStreamIndex : 0] || displayStreams[0];
      var btn = document.createElement('button');
      btn.className = 'line-current-btn';
      btn.textContent = current.name;
      wrapper.appendChild(btn);

      var menu = document.createElement('div');
      menu.className = 'line-menu';
      displayStreams.forEach(function (stream, i) {
        var item = document.createElement('div');
        item.textContent = stream.name;
        item.dataset.streamIdx = self.streams.indexOf(stream);
        item.addEventListener('click', function (e) {
          e.stopPropagation();
          self.switchTo(parseInt(this.dataset.streamIdx, 10));
          menu.style.display = 'none';
          btn.textContent = stream.name;
        });
        menu.appendChild(item);
      });
      wrapper.appendChild(menu);

      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
      });
      document.addEventListener('click', function (e) {
        if (!wrapper.contains(e.target)) menu.style.display = 'none';
      });

      this.container.appendChild(wrapper);
      */
    },

    /** 更新线路按钮文案 — 无按钮时为空操作 */
    _updateLineButtons: function (activeIdx) {
      var btn = this.container && this.container.querySelector('.line-current-btn');
      if (btn && this.streams[activeIdx]) {
        btn.textContent = this.streams[activeIdx].name;
      }
      var menu = this.container && this.container.querySelector('.line-menu');
      if (menu) menu.style.display = 'none';
      if (isMobile() && this._lineSwitcherEl) {
        this._lineSwitcherEl.classList.remove('is-open');
        this._startMobileLineTimer();
      }
    },

    // ===================== 手机端线路按钮自动显示/隐藏（已随按钮禁用） =====================

    _bindMobileControls: function () {
      var self = this;
      if (!isMobile() || !this.container) return;

      this.container.addEventListener('click', function (e) {
        if (self._lineSwitcherEl && self._lineSwitcherEl.contains(e.target)) return;
        self._showMobileLineControls();
      });
      this.container.addEventListener('touchend', function (e) {
        if (self._lineSwitcherEl && self._lineSwitcherEl.contains(e.target)) return;
        self._showMobileLineControls();
      });
    },

    _showMobileLineControls: function () {
      if (!this.container) return;
      this._clearMobileLineTimer();
      this.container.classList.add('mobile-controls-visible');
      var self = this;
      this._mobileLineTimer = setTimeout(function () {
        if (self.container) {
          self.container.classList.remove('mobile-controls-visible');
        }
      }, 3000);
    },

    _startMobileLineTimer: function () {
      this._showMobileLineControls();
    },

    _clearMobileLineTimer: function () {
      if (this._mobileLineTimer) {
        clearTimeout(this._mobileLineTimer);
        this._mobileLineTimer = null;
      }
    },

    /** 显示占位提示 */
    _showPlaceholder: function (msg) {
      var ph = this.videoEl && this.videoEl.parentNode && this.videoEl.parentNode.querySelector('.video-placeholder');
      if (!ph) {
        if (this.videoEl && this.videoEl.parentNode) {
          ph = document.createElement('div');
          ph.className = 'video-placeholder';
          ph.style.cssText = 'color:#fff;text-align:center;position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:5;';
          this.videoEl.parentNode.appendChild(ph);
        }
      }
      if (ph) {
        ph.innerHTML = '<b>' + esc(msg) + '</b>';
        ph.style.display = 'flex';
      }
      if (this.videoEl) {
        this.videoEl.style.display = 'none';
      }
    },

    /** 隐藏占位提示 */
    _hidePlaceholder: function () {
      var ph = this.videoEl && this.videoEl.parentNode && this.videoEl.parentNode.querySelector('.video-placeholder');
      if (ph) {
        ph.style.display = 'none';
      }
      if (this.videoEl) {
        this.videoEl.style.display = '';
      }
    },

    /** 销毁播放器 */
    destroy: function () {
      this.destroyed = true;
      this._destroyHls();
      this._clearMobileLineTimer();
      this.streams = [];
      this.currentStreamIndex = -1;
      this.room = null;
      this._lineSwitcherEl = null;
      var ui = this.container && this.container.querySelector('.player-line-switcher');
      if (ui) ui.remove();
      if (this.container) {
        this.container.classList.remove('mobile-controls-visible');
      }
    }
  };

  window.LivePlayer = LivePlayer;

})(window);

var LivePlayer = window.LivePlayer;
export { LivePlayer };
