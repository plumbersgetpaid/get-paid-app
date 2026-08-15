export default function NotFound() {
  return (
    <main style={wrapStyle}>
      <section style={cardStyle}>
        <svg
          width="240"
          height="150"
          viewBox="0 0 240 150"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="A pipe that doesn't connect to anything"
        >
          <rect x="10" y="52" width="78" height="32" rx="4" fill="#171717" />
          <rect x="10" y="52" width="78" height="7" rx="3" fill="#3a3a3a" />
          <rect x="76" y="47" width="16" height="42" rx="4" fill="#0a0a0a" />

          <rect x="152" y="80" width="78" height="32" rx="4" fill="#171717" />
          <rect x="152" y="80" width="78" height="7" rx="3" fill="#3a3a3a" />
          <rect x="148" y="75" width="16" height="42" rx="4" fill="#0a0a0a" />

          <g transform="translate(84,96)">
            <g className="gp-drip">
              <path
                d="M0,-14 C8,-4 10,4 10,8 A10,10 0 1,1 -10,8 C-10,4 -8,-4 0,-14 Z"
                fill="#d97706"
              />
            </g>
          </g>
        </svg>

        <h1 style={headingStyle}>This pipe doesn't lead anywhere</h1>
        <p style={bodyStyle}>
          Whatever you were looking for isn't here - it might have moved, or
          you might not have access to it.
        </p>

        <a href="/" style={buttonStyle}>
          Back to Today
        </a>
      </section>

      <style>{`
        @keyframes gp-drip-fall {
          0% { transform: translateY(0); opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { transform: translateY(12px); opacity: 0; }
        }
        .gp-drip {
          animation: gp-drip-fall 2.6s ease-in infinite;
          transform-box: fill-box;
          transform-origin: center;
        }
        @media (prefers-reduced-motion: reduce) {
          .gp-drip {
            animation: none;
          }
        }
      `}</style>
    </main>
  );
}

const wrapStyle = {
  minHeight: "70vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px 16px",
};

const cardStyle = {
  background: "white",
  borderRadius: 16,
  padding: "36px 28px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  textAlign: "center",
  maxWidth: 340,
  width: "100%",
};

const headingStyle = {
  fontSize: 19,
  fontWeight: 700,
  color: "#111",
  margin: "20px 0 8px",
};

const bodyStyle = {
  fontSize: 14,
  color: "#888",
  lineHeight: 1.5,
  margin: "0 0 24px",
};

const buttonStyle = {
  display: "inline-block",
  background: "#111",
  color: "white",
  padding: "14px 28px",
  borderRadius: 10,
  border: "none",
  fontWeight: 600,
  fontSize: 15,
  textDecoration: "none",
};
