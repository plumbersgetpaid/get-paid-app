// PatchUp service worker.
//
// Intentionally minimal. It exists so the app is installable and so there's
// a registration to attach push notifications to later. It does NOT cache
// app responses - a job/invoice app serving stale data from an old cache
// would be worse than briefly offline - so there's no fetch caching here.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
