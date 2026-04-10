// Inline cache-bust recovery: runs before any module is loaded.
// If assets are served with wrong MIME / 500 (stale edge-cache corruption),
// wipe all CacheStorage entries and hard-reload once.
(function () {
  var BUST_KEY = '__myapi_cache_bust_v1__';
  if (sessionStorage.getItem(BUST_KEY)) return; // already tried once this tab
  window.__myapiAssetError = function () {
    sessionStorage.setItem(BUST_KEY, '1');
    if ('caches' in window) {
      caches.keys().then(function (keys) {
        Promise.all(keys.map(function (k) { return caches.delete(k); })).then(function () {
          window.location.reload(true);
        });
      }).catch(function () { window.location.reload(true); });
    } else {
      window.location.reload(true);
    }
  };
})();
