"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function NewJob() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    jobType: "",
    amount: "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);

    const { data: customer, error: custErr } = await supabase
      .from("customers")
      .insert({ name: form.name, phone: form.phone, email: form.email })
      .select()
      .single();

    if (custErr) {
      alert("Error saving customer: " + custErr.message);
      setSaving(false);
      return;
    }

    const { error: jobErr } = await supabase.from("jobs").insert({
      customer_id: customer.id,
      job_type: form.jobType,
      amount: parseFloat(form.amount),
      status: "in_progress",
    });

    if (jobErr) {
      alert("Error saving job: " + jobErr.message);
      setSaving(false);
      return;
    }

    router.push("/");
  }

  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          type="button"
          onClick={() => router.push("/")}
          aria-label="Back"
          style={backButtonStyle}
        >
          ←
        </button>
        <h1 style={{ fontSize: 20, margin: 0 }}>Add a job</h1>
      </div>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <input
          placeholder="Customer name"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          style={inputStyle}
        />
        <input
          placeholder="Phone (for SMS/WhatsApp chase)"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          style={inputStyle}
        />
        <input
          placeholder="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          style={inputStyle}
        />
        <input
          placeholder="Job type (e.g. Boiler service)"
          value={form.jobType}
          onChange={(e) => setForm({ ...form, jobType: e.target.value })}
          style={inputStyle}
        />
        <input
          placeholder="Amount (£)"
          type="number"
          step="0.01"
          required
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          style={inputStyle}
        />
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={() => router.push("/")}
            disabled={saving}
            style={cancelButtonStyle}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            style={{
              background: "#111",
              color: "white",
              padding: "14px",
              borderRadius: 10,
              border: "none",
              fontWeight: 600,
              flex: 1,
            }}
          >
            {saving ? "Saving..." : "Save job"}
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
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const cancelButtonStyle = {
  background: "white",
  color: "#111",
  padding: "14px",
  borderRadius: 10,
  border: "1px solid #ddd",
  fontWeight: 600,
  flex: 1,
};
