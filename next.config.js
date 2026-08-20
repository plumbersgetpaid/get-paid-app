/** @type {import('next').NextConfig} */
const nextConfig = {
  // Native-feel tab switching. By default every navigation refetches the
  // whole page from the server (~a second); with staleTimes, a page you
  // saw in the last 30-60s renders instantly from the client cache while
  // anything older refetches. This is the same trade native trade-apps
  // make (theirs show LOCAL data and sync in the background - far staler
  // than a minute). Our own mutations still appear immediately: every
  // create/update path busts this cache via revalidatePath or a full
  // 303 navigation.
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 60,
    },
  },
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
        // Baseline security headers on every response. The big one is
        // frame denial: without it the app could be embedded in a hostile
        // iframe and its one-click POST forms clickjacked. The rest are
        // standard hardening with no functional cost. (A full CSP is
        // deliberately not attempted here - Next's inline runtime makes a
        // strict one fragile; revisit with nonce support if ever needed.)
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), geolocation=(), payment=()" },
        ],
      },
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
