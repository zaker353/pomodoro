// 離線快取:第一次開啟後,之後沒網路也能用
const CACHE_PREFIX = "pomo-";
const CACHE = CACHE_PREFIX + "v12";
const FILES = [
  "./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png",
  "./sounds/rain.mp3", "./sounds/ocean.mp3", "./sounds/cafe.mp3",
  "./sounds/fire.mp3", "./sounds/thunder.mp3",
  "./sounds/stream.mp3", "./sounds/birds.mp3", "./sounds/night.mp3",
  "./sounds/wind.mp3", "./sounds/train.mp3",
  "./sounds/white.mp3", "./sounds/pink.mp3",
  "./sounds/library.mp3", "./sounds/keyboard.mp3", "./sounds/fan.mp3",
  "./sounds/cat.mp3", "./sounds/snow.mp3", "./sounds/clock.mp3",
  "./sounds/brown.mp3", "./sounds/plane.mp3", "./sounds/falls.mp3",
  "./sounds/dryer.mp3", "./sounds/window.mp3", "./sounds/bowl.mp3"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

// 清掉「自己的」舊版快取。
// ⚠️ 一定要用前綴過濾。CacheStorage 是整個網域共用的,而 zaker353.github.io 上還有
// 英文學習(langlearn-*)與塔羅(tarot-*)。若刪掉所有不是自己的快取,會把那兩個 App
// 的離線功能整包清空,使用者離線時就打不開它們(2026-07-15 稽核抓到,三支都犯同一個錯)。
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k.startsWith(CACHE_PREFIX) && k !== CACHE)
            .map(k => caches.delete(k))
      )
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
