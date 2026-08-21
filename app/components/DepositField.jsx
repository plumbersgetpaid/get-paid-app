"use client";

import { useState } from "react";

// The per-job deposit option (quote + quick-book forms). Deliberately NOT a
// business-wide setting: every tradesperson has their own feel for which
// jobs need a deposit, so it's a tick box and an amount, decided per job.
// The amount is the literal £ the customer will be asked to send (no VAT
// arithmetic applied - it's a payment, not a price).
//
// hasBankDetails: whether Settings has bank details saved. Without them, the
// payment link becomes REQUIRED - a deposit request must never go out with
// no way to pay it.
export default function DepositField({ hasBankDetails = false }) {
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
            style={inputStyle}
          />
          <span style={{ fontSize: 12, color: "#888" }}>
            The exact amount the customer will be asked to send. It&apos;s
            requested when they accept - the quote just states it - and the
            final invoice deducts it automatically.
          </span>
          <input
            name="depositPaymentLink"
            type="url"
            required={!hasBankDetails}
            placeholder={
              hasBankDetails
                ? "Payment link (optional) - e.g. a Stripe or GoCardless link"
                : "Payment link (required) - e.g. a Stripe or GoCardless link"
            }
            style={inputStyle}
          />
          {hasBankDetails ? (
            <span style={{ fontSize: 12, color: "#888" }}>
              The deposit request email includes this link and/or your bank
              details from Settings. The link also pre-fills the final
              invoice.
            </span>
          ) : (
            <span style={{ fontSize: 12, color: "#dc2626", fontWeight: 500 }}>
              You have no bank details saved, so a payment link is required -
              otherwise the customer has no way to send the deposit. Either
              paste a link here, or add your bank details under Settings
              first.
            </span>
          )}
        </>
      )}
    </div>
  );
}

const inputStyle = {
  padding: 12,
  borderRadius: 2,
  border: "1px solid #e2e2e2",
  fontSize: 15,
  width: "100%",
  boxSizing: "border-box",
};
