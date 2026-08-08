import Link from "next/link";

export default function NewQuote() {
  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Link href="/" aria-label="Back" style={backButtonStyle}>
          ←
        </Link>
        <h1 style={{ fontSize: 20, margin: 0 }}>New quote</h1>
      </div>

      <p style={{ fontSize: 13, color: "#888", marginTop: 8 }}>
        This sends the customer a quote. Once they accept, it'll move into
        "Jobs in progress" and you can invoice them when the work's done.
      </p>

      <form
        action="/api/jobs/create"
        method="POST"
        style={{ display: "grid", gap: 12, marginTop: 16 }}
      >
        <input name="name" placeholder="Customer name" required style={inputStyle} />
        <input
          name="phone"
          placeholder="Phone (for SMS/WhatsApp chase)"
          style={inputStyle}
        />
        <input name="email" type="email" placeholder="Email" style={inputStyle} />
        <input
          name="jobType"
          placeholder="Job type (e.g. Boiler service)"
          style={inputStyle}
        />
        <input
          name="amount"
          type="number"
          step="0.01"
          placeholder="Quoted amount (£)"
          required
          style={inputStyle}
        />
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/" style={cancelButtonStyle}>
            Cancel
          </Link>
          <button type="submit" style={submitButtonStyle}>
            Send quote
          </button>
        </div>
      </form>
    </main>
  );
}

const inputStyle = {
  padding: "12px",
  borderRadius: 8,
  border: "1px solid #ddd",
  fontSize: 15,
};

const backButtonStyle = {
  background: "white",
  border: "1px solid #ddd",
  borderRadius: 8,
  width: 36,
  height: 36,
  fontSize: 18,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  color: "#111",
};

const cancelButtonStyle = {
  background: "white",
  color: "#111",
  padding: "14px",
  borderRadius: 10,
  border: "1px solid #ddd",
  fontWeight: 600,
  flex: 1,
  textAlign: "center",
  textDecoration: "none",
};

const submitButtonStyle = {
  background: "#111",
  color: "white",
  padding: "14px",
  borderRadius: 10,
  border: "none",
  fontWeight: 600,
  flex: 1,
};
