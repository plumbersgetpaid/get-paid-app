"use client";

import { useState } from "react";

// The per-job deposit option (quote + quick-book forms). Deliberately NOT a
// business-wide setting: every tradesperson has their own feel for which
// jobs need a deposit, so it's a tick box and an amount, decided per job.
// The amount is the literal £ the customer will be asked to send (no VAT
// arithmetic applied - it's a payment, not a price).
export default function DepositField() {
  const [on, setOn] = useState(false);

  return (
    <div style={{ background: "white", padding: 12, borderRadius: 2, display: "grid", gap: 8 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
        <input
          type="checkbox"
          name="askDeposit"
          value="1"
          checked={on}
          onChange={(e) => setOn(e.target.checked)}
        />
        Ask for a deposit
      </label>
      {on && (
        <>
          <input
            name="depositAmount"
            type="number"
            step="0.01"
            min="0.01"
            required
            placeholder="Deposit amount (£)"
            style={{
              padding: 12,
              borderRadius: 2,
              border: "1px solid #e2e2e2",
              fontSize: 15,
              width: "100%",
              boxSizing: "border-box",
            }}
          />
          <span style={{ fontSize: 12, color: "#888" }}>
            The exact amount the customer will be asked to send. It&apos;s
            requested when they accept - the quote just states it - and the
            final invoice deducts it automatically.
          </span>
        </>
      )}
    </div>
  );
}
