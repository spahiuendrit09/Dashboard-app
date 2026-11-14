/* Service Worker: macht die App offline-fähig.
   Bei einer neuen Version von Hand VERSION erhöhen, dann wird der alte Speicher geleert. */
const VERSION = "v1";
const SHELL = `shell-${VERSION}`;
const RUNTIME = `runtime-${VERSION}`;
const MAX_RUNTIME = 150;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(["/", "/manifest.webmanifest", "/icons/icon-192.png"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== RUNTIME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cache) {
  const keys = await cache.keys();
  if (keys.length > MAX_RUNTIME) {
    await Promise.all(keys.slice(0, keys.length - MAX_RUNTIME).map((k) => cache.delete(k)));
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  /* Fremde Server (Kurse, Wetter, Wechselkurse) gehen immer direkt ins Netz */
  if (url.origin !== self.location.origin) return;

  /* Seiten: erst Netz, ohne Netz die gespeicherte Startseite */
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put("/", copy));
          return res;
        })
        .catch(() => caches.match("/").then((r) => r || Response.error())),
    );
    return;
  }

  /* Dateien: sofort aus dem Speicher, im Hintergrund erneuern */
  event.respondWith(
    caches.open(RUNTIME).then(async (cache) => {
      const hit = await cache.match(req);
      const net = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone()).then(() => trim(cache));
          return res;
        })
        .catch(() => undefined);
      return hit || (await net) || Response.error();
    }),
  );
});
