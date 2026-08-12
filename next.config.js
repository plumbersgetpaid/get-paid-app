/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // The Clients pages have repeatedly shown stale "possible duplicate"
        // data after actions like merging - the most likely explanation is
        // the browser's own back-forward cache (bfcache) restoring an old
        // snapshot of the page without asking the server again, which none
        // of our in-app navigation fixes can reach since that's a
        // browser-level behaviour, not something Next.js's router controls.
        // no-store tells the browser never to keep or reuse a cached copy
        // of these pages at all, closing that gap directly.
        source: "/clients/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};
module.exports = nextConfig;
