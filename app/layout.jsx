export const metadata = {
  title: "Get Paid",
  description: "Never chase an invoice by hand again",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          margin: 0,
          background: "#f6f7f9",
          color: "#111",
        }}
      >
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "16px" }}>
          {children}
        </div>
      </body>
    </html>
  );
}
