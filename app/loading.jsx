// Shown the instant a navigation starts, while the server builds the page.
// The first version was too faint - white cards on the grey surface read
// as a blank screen, which is exactly the feeling this exists to prevent.
// This one sketches the page's real anatomy (title, cards with text
// lines) in visible grey, shimmering, so the second reads as "loading".
export default function Loading() {
  const line = (w, h = 12) => ({
    height: h,
    width: w,
    borderRadius: 4,
    background: "linear-gradient(90deg, #e3e3e6 25%, #d6d6da 42%, #e3e3e6 60%)",
    backgroundSize: "200% 100%",
    animation: "shimmer 1.2s linear infinite",
  });
  return (
    <main aria-busy="true">
      <div style={line(170, 24)} />
      {[3, 2, 3].map((rows, i) => (
        <div
          key={i}
          style={{
            background: "white",
            border: "1px solid #e2e2e2",
            borderRadius: 3,
            padding: "var(--card-pad, 16px)",
            marginTop: 14,
          }}
        >
          <div style={{ ...line(110, 10), marginBottom: 14 }} />
          {Array.from({ length: rows }).map((_, r) => (
            <div key={r} style={{ ...line(`${88 - r * 16}%`), marginTop: r ? 10 : 0 }} />
          ))}
        </div>
      ))}
      <style>{`@keyframes shimmer { from { background-position: 200% 0 } to { background-position: -200% 0 } }
@media (prefers-reduced-motion: reduce) { main[aria-busy] div { animation: none !important } }`}</style>
    </main>
  );
}
