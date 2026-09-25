/* オフラインでも起動できるように、アプリ本体だけキャッシュする。
   地図タイルは量が多いのでキャッシュしない（圏外では地図だけ出ない）。 */
const CACHE = 'rides-v1';
const SHELL = [
  './', './log.html', './index.html', './manifest.json', './icon.svg',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      // 1つ落ちても install ごと失敗させない
      .then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // 地図タイルは素通し
  if (/basemaps\.cartocdn\.com/.test(req.url)) return;

  // まずネットワーク、だめならキャッシュ（圏外での起動を担保）
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then(hit => {
        if (hit) return hit;
        // ページ遷移のときだけアプリ本体を返す。
        // JS/CSS にHTMLを返すと構文エラーでアプリごと壊れるので、素直に失敗させる。
        if (req.mode === 'navigate') return caches.match('./log.html');
        return Response.error();
      }))
  );
});
