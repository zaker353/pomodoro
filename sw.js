// 離線快取:第一次開啟後,之後沒網路也能用
const CACHE = "pomo-v4";
const FILES = [
  "./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png",
  "./sounds/rain.mp3", "./sounds/ocean.mp3", "./sounds/cafe.mp3",
  "./sounds/fire.mp3", "./sounds/thunder.mp3",
  "./sounds/stream.mp3", "./sounds/birds.mp3", "./sounds/night.mp3",
  "./sounds/wind.mp3", "./sounds/train.mp3"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  e.respondWith(
    fetch(e.request).then(res => {
      // 有網路:拿新版並更新快取
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(e.request)) // 沒網路:用快取
  );
});
