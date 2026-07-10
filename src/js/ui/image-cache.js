// ============================================================
// 图片 Blob 缓存 — 使用 LRU 策略限制内存增长
// 由 filesystem.js 通过 window 全局变量访问
// ============================================================

let _imgBlobCache = {};
let _dirHandleCache = {};
let _thumbCache = {};
const _cacheKeys = { img: [], thumb: [] }; // LRU 顺序追踪
const _CACHE_MAX = 50; // 每个缓存最大条目数

function _lruSet(cache, keys, key, value, max) {
  // 达到容量上限时淘汰最旧的条目
  while (keys.length >= max) {
    const oldKey = keys.shift();
    if (cache[oldKey] && cache[oldKey].startsWith && cache[oldKey].startsWith("blob:")) {
      URL.revokeObjectURL(cache[oldKey]);
    }
    delete cache[oldKey];
  }
  // 更新 LRU 顺序
  const idx = keys.indexOf(key);
  if (idx >= 0) keys.splice(idx, 1);
  keys.push(key);
  cache[key] = value;
}

function _lruGet(cache, keys, key) {
  if (key in cache) {
    const idx = keys.indexOf(key);
    if (idx >= 0) keys.splice(idx, 1);
    keys.push(key);
    return cache[key];
  }
  return undefined;
}

window._imgBlobCacheGet = function (key) { return _lruGet(_imgBlobCache, _cacheKeys.img, key); };
window._imgBlobCacheSet = function (key, value) { _lruSet(_imgBlobCache, _cacheKeys.img, key, value, _CACHE_MAX); };
window._thumbCacheGet = function (key) { return _lruGet(_thumbCache, _cacheKeys.thumb, key); };
window._thumbCacheSet = function (key, value) { _lruSet(_thumbCache, _cacheKeys.thumb, key, value, _CACHE_MAX); };
window._imgBlobCache = _imgBlobCache;
window._dirHandleCache = _dirHandleCache;
window._thumbCache = _thumbCache;
