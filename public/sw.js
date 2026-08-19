// PatchUp service worker.
//
// Two jobs: receive push, and keep the offline day view (/field) working
// with no signal. It deliberately does NOT cache normal app pages - a
// jobs/invoices app must never show stale data as if it were current.
// The one navigation fallback is /field, which is explicit about being a
// saved copy.
const CACHE = "patchup-field-v1";
const PRECACHE = ["/field", "/icon-192.png", "/patchup-emblem.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Warm the /field shell and every static chunk it references, so the
// offline view hydrates even if the person never visited it online.
// FieldPackSync sends this after each pack refresh.
async function warmField() {
  const cache = await caches.open(CACHE);
  const res = await fetch("/field", { credentials: "same-origin" });
  if (!res.ok) return;
  const html = await res.clone().text();
  await cache.put("/field", res);
  const assets = [...new Set(html.match(/\/_next\/static\/[^"'\\ )]+/g) || [])];
  await Promise.all(
    assets.map(async (url) => {
      if (await cache.match(url)) return;
      try {
        const r = await fetch(url);
        if (r.ok) await cache.put(url, r);
      } catch {}
    })
  );
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "warm-field") event.waitUntil?.(warmField()) ?? warmField();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  // Hashed build assets are immutable - cache-first is always safe.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(request, copy));
            }
            return res;
          })
      )
    );
    return;
  }

  // Page navigations: always try the network (fresh data), and only when
  // it's unreachable fall back to the saved /field view.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match("/field");
        return (
          cached ||
          new Response("<h1>Offline</h1><p>No saved data on this device yet.</p>", {
            headers: { "Content-Type": "text/html" },
          })
        );
      })
    );
  }
});

// ── push (unchanged) ───────────────────────────────────────────────
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "PatchUp", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "PatchUp";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
