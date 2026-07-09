// ============================================================
// Image blob cache — LRU-limited to prevent unbounded memory
// Accessed by filesystem.js as window globals
// ============================================================

let _imgBlobCache = {};
let _dirHandleCache = {};
let _thumbCache = {};
const _cacheKeys = { img: [], thumb: [] }; // LRU order tracking
const _CACHE_MAX = 50; // max entries per cache

function _lruSet(cache, keys, key, value, max) {
  // Evict oldest if at capacity
  while (keys.length >= max) {
    const oldKey = keys.shift();
    if (cache[oldKey] && cache[oldKey].startsWith && cache[oldKey].startsWith("blob:")) {
      URL.revokeObjectURL(cache[oldKey]);
    }
    delete cache[oldKey];
  }
  // Update LRU order
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
