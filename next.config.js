/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        // One address, not two. The app also answers on its *.vercel.app
        // deployment URL, which browsers treat as a completely separate
        // site: separate logins, separate cookies, separate home-screen
        // installs, separate offline packs. Anyone who bookmarks that URL
        // lives a second life there. Permanently send everything to the
        // real domain (localhost is untouched - this matches by host).
        source: "/:path*",
        has: [{ type: "host", value: "get-paid-app-five.vercel.app" }],
        destination: "https://app.getpatchup.co.uk/:path*",
        permanent: true,
      },
    ];
  },
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
      {
        // Same bfcache issue, now showing up on the team permissions
        // screen - a confirmed, successful save followed by pressing back
        // was showing the pre-save state, exactly the same symptom as the
        // Clients pages above and almost certainly the same cause.
        source: "/settings/team/:path*",
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
