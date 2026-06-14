import { LivePlayer } from './player.js';

function urlPath(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  try {
    return new URL(raw, location.href).pathname.toLowerCase();
  } catch (e) {
    return raw.split('?')[0].split('#')[0].toLowerCase();
  }
}

function inferStreamType(stream) {
  const path = urlPath(stream && stream.url);
  if (/\.m3u8$/i.test(path)) return 'hls';
  if (/\.flv$/i.test(path)) return 'flv';
  if (/\.ts$/i.test(path)) return 'ts';
  return String((stream && stream.type) || 'hls').toLowerCase();
}

function normalizeStream(stream) {
  if (!stream) return stream;
  stream.type = inferStreamType(stream);
  return stream;
}

function normalizeRoomStreams(room) {
  if (!room || !Array.isArray(room.streams)) return;
  room.streams = room.streams.map(normalizeStream);
  if (room.streamUrl && room.streams.length === 0) {
    room.streams.push(normalizeStream({
      name: '默认线路',
      type: 'hls',
      url: room.streamUrl,
      enabled: true,
      default: true,
      priority: 1
    }));
  }
}

function isSafariOrIOS() {
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua) && !/CriOS/.test(ua);
  return isIOS || isSafari;
}

function flvSupported() {
  const Flv = window.flvjs;
  return !!(Flv && Flv.isSupported && Flv.isSupported());
}

function isPlayableOnThisDevice(stream) {
  const type = inferStreamType(stream);
  if (type === 'ts') return false;
  if (type === 'flv') return !isSafariOrIOS() && flvSupported();
  return true;
}

function sortStreams(streams) {
  return (streams || []).slice().sort(function (a, b) {
    if (a.default && !b.default) return -1;
    if (!a.default && b.default) return 1;
    return (a.priority || 99) - (b.priority || 99);
  });
}

export function initPlayerStreamTypeFix() {
  if (!LivePlayer || LivePlayer.__streamTypeFixInstalled) return;
  LivePlayer.__streamTypeFixInstalled = true;

  const oldInit = LivePlayer.init;
  LivePlayer.init = function (options) {
    if (options && options.room) normalizeRoomStreams(options.room);
    const ret = oldInit.call(this, options);
    if (this.currentStreamIndex < 0 && this.streams && this.streams.length > 0) {
      const playable = this.streams.filter(isPlayableOnThisDevice);
      if (playable.length === 0) {
        const hasTs = this.streams.some(function (s) { return inferStreamType(s) === 'ts'; });
        this._showPlaceholder(hasTs ? 'TS 分片地址不能直接作为直播源，请填写 m3u8 或 flv 地址' : '当前设备不支持该播放源，请改用 m3u8 线路');
      }
    }
    return ret;
  };

  LivePlayer._getDefaultStream = function () {
    const sorted = sortStreams(this.streams).map(normalizeStream);
    const playable = sorted.filter(isPlayableOnThisDevice);
    return playable[0] || null;
  };

  const oldPlayStream = LivePlayer._playStream;
  LivePlayer._playStream = function (stream, idx) {
    normalizeStream(stream);
    const type = inferStreamType(stream);
    if (type === 'ts') {
      this._showPlaceholder('TS 分片地址不能直接作为直播源，请填写 m3u8 或 flv 地址');
      return;
    }
    return oldPlayStream.call(this, stream, idx);
  };

  LivePlayer._findNextStream = function (failedStream) {
    const streams = (this.streams || []).filter(isPlayableOnThisDevice);
    const failedIdx = streams.indexOf(failedStream);
    for (let i = failedIdx + 1; i < streams.length; i++) {
      if (streams[i] !== failedStream) return streams[i];
    }
    for (let j = 0; j < failedIdx; j++) {
      if (streams[j] !== failedStream) return streams[j];
    }
    return null;
  };
}
