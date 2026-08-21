// PatchUp service worker.
//
// Two jobs: receive push, and keep the offline day view (/field) working
// with no signal. It deliberately does NOT cache normal app pages - a
// jobs/invoices app must never show stale data as if it were current.
// The one navigation fallback is /field, which is explicit about being a
// saved copy.
// Bumped to v2 (Aug 2026) to force installed phones to purge the cached
// /field shell + old JS chunks and re-precache the current build - this is
// how the field double-VAT completion fix reaches devices that have been
// offline since it shipped, rather than waiting for a chance re-warm.
const CACHE = "patchup-field-v2";
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
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Navigation preload: the browser starts the network request in
      // parallel with waking this worker, instead of after it. Without
      // this, every navigation pays the worker's cold-start as pure
      // added latency - the "app feels slower" report after v2 shipped.
      if (self.registration.navigationPreload) {
        try { await self.registration.navigationPreload.enable(); } catch {}
      }
      // Purge superseded caches so a version bump actually frees the old
      // shell/chunks (they otherwise accumulate forever) and the new CACHE
      // re-precaches on install.
      try {
        const keys = await caches.keys();
        await Promise.all(
          keys.filter((k) => k.startsWith("patchup-field-") && k !== CACHE).map((k) => caches.delete(k))
        );
      } catch {}
      await self.clients.claim();
    })()
  );
});

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
  if (event.data?.type !== "warm-field") return;
  // waitUntil exists on message events and returns undefined, so the old
  // `waitUntil?.(warmField()) ?? warmField()` ran warmField() TWICE - two
  // /field fetches and two asset-warming passes on exactly the metered
  // mobile connections the offline layer is built for. Call it once.
  if (event.waitUntil) event.waitUntil(warmField());
  else warmField();
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

  // Page navigations: always try the network (fresh data; preload runs it
  // in parallel with worker wake-up), and only when it's unreachable fall
  // back to the saved /field view.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return (await event.preloadResponse) || (await fetch(request));
        } catch {
          const cached = await caches.match("/field");
          return (
            cached ||
            new Response("<h1>Offline</h1><p>No saved data on this device yet.</p>", {
              headers: { "Content-Type": "text/html" },
            })
          );
        }
      })()
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
