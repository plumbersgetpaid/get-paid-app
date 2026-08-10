import Link from "next/link";

export default function NewRecurringJob() {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Link href="/jobs/recurring" aria-label="Back" style={backButtonStyle}>
          ←
        </Link>
        <h1 style={{ fontSize: 20, margin: 0 }}>Recurring job</h1>
      </div>

      <p style={{ fontSize: 13, color: "#888", marginTop: 8 }}>
        Set this up once and it'll automatically appear on the calendar (and
        optionally invoice itself) on a repeating schedule - no need to
        re-create it each time.
      </p>

      <form
        action="/api/jobs/recurring/create"
        method="POST"
        style={{ display: "grid", gap: 12, marginTop: 16 }}
      >
        <input name="name" placeholder="Customer name" required style={inputStyle} />
        <input name="phone" placeholder="Phone (optional)" style={inputStyle} />
        <input name="email" type="email" placeholder="Email (optional)" style={inputStyle} />
        <input name="jobType" placeholder="Job type (e.g. Boiler service)" style={inputStyle} />
        <input name="location" placeholder="Job location / address (optional)" style={inputStyle} />
        <input
          name="amount"
          type="number"
          step="0.01"
          placeholder="Price (£) - what to charge each time"
          style={inputStyle}
        />

        <label style={{ fontSize: 13, color: "#666" }}>
          First occurrence
          <input
            type="date"
            name="startDate"
            defaultValue={today}
            required
            style={{ ...inputStyle, marginTop: 6 }}
          />
        </label>

        <label style={{ fontSize: 13, color: "#666" }}>
          Repeats every
          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <input
              type="number"
              name="frequencyValue"
              min="1"
              defaultValue="1"
              required
              style={{ ...inputStyle, flex: 1 }}
            />
            <select name="frequencyUnit" defaultValue="months" style={{ ...inputStyle, flex: 2 }}>
              <option value="weeks">Week(s)</option>
              <option value="months">Month(s)</option>
              <option value="years">Year(s)</option>
            </select>
          </div>
          <span style={{ fontSize: 12, color: "#888" }}>
            e.g. every 3 months for quarterly, every 12 months for yearly
          </span>
        </label>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 14,
            background: "white",
            padding: 12,
            borderRadius: 8,
          }}
        >
          <input type="checkbox" name="autoInvoice" value="1" />
          Automatically send an invoice each time (not just book the job in)
        </label>

        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <Link href="/jobs/recurring" style={cancelButtonStyle}>
            Cancel
          </Link>
          <button type="submit" style={submitButtonStyle}>
            Save recurring job
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
  width: "100%",
  boxSizing: "border-box",
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
  background: "#16a34a",
  color: "white",
  padding: "14px",
  borderRadius: 10,
  border: "none",
  fontWeight: 600,
  flex: 2,
};
