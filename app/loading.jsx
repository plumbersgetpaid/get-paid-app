// Shown the instant a navigation starts, while the server builds the page.
// Before this existed there was no feedback at all - a ~1s wait with a
// frozen screen reads as "broken"; the same wait with a skeleton reads as
// "working". Matches the card shapes the real screens resolve into.
export default function Loading() {
  return (
    <main aria-busy="true">
      <div style={{ height: 28, width: 180, borderRadius: 4, background: "var(--pulse, #ececec)", animation: "pulse 1.1s ease-in-out infinite" }} />
      {[92, 140, 120].map((h, i) => (
        <div
          key={i}
          style={{
            height: h,
            borderRadius: 3,
            border: "1px solid #e8e8e8",
            background: "white",
            marginTop: 14,
            opacity: 0.7,
            animation: `pulse 1.1s ease-in-out ${i * 0.12}s infinite`,
          }}
        />
      ))}
      <style>{`@keyframes pulse { 0%,100% { opacity:.45 } 50% { opacity:.85 } }
@media (prefers-reduced-motion: reduce) { main[aria-busy] * { animation: none !important } }`}</style>
    </main>
  );
}
