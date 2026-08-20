"use client";

import { useRef, useState } from "react";
import Link from "next/link";

// The Cancel + "Send quote" row, with the same review-before-send card as
// job completion: sending a quote emails the customer immediately, so the
// button first shows what's about to go out (customer, total, where it's
// emailed) and only "Confirm & send" actually submits. Reads the values
// straight off the surrounding form, so it needs no wiring to the inputs.
export default function ConfirmSendQuote({ exclusiveVatRate }) {
  const btnRef = useRef(null);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [summary, setSummary] = useState(null);

  function openConfirm() {
    const form = btnRef.current?.closest("form");
    if (!form) return;
    // Run the browser's own required-field validation first, exactly as a
    // real submit would.
    if (!form.reportValidity()) return;

    const fd = new FormData(form);
    const typed = parseFloat(fd.get("amount"));
    const rate = exclusiveVatRate ? Number(exclusiveVatRate) : 0;
    // In before-VAT entry mode the typed figure is net - the customer's
    // quote shows the grossed-up total, so that's what the card shows.
    const total = exclusiveVatRate
      ? Math.round(typed * (1 + rate / 100) * 100) / 100
      : typed;

    const proposedDate = fd.get("proposedDate");
    setSummary({
      name: (fd.get("name") || "").toString().trim(),
      email: (fd.get("email") || "").toString().trim(),
      jobType: (fd.get("jobType") || "").toString().trim(),
      total: Number.isFinite(total) ? total : null,
      proposed: proposedDate
        ? `${new Date(`${proposedDate}T00:00:00`).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
          })} at ${fd.get("proposedTime") || "09:00"}`
        : null,
    });
    setConfirming(true);
  }

  function confirmAndSend() {
    const form = btnRef.current?.closest("form");
    if (!form) return;
    setSending(true);
    // Native submit - the normal POST to /api/jobs/create, request_id and
    // all. Validation already ran in openConfirm.
    form.submit();
  }

  const fmt = (n) =>
    `£${Number(n).toLocaleString("en-GB", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <>
      <div style={{ display: "flex", gap: 10 }}>
        <Link href="/" style={cancelButtonStyle}>
          Cancel
        </Link>
        <button type="button" ref={btnRef} onClick={openConfirm} style={submitButtonStyle}>
          Send quote
        </button>
      </div>

      {confirming && summary && (
        <div style={overlayStyle} role="dialog" aria-modal="true" aria-label="Confirm quote">
          <div style={cardStyle}>
            <div style={{ fontWeight: 500, fontSize: 16, marginBottom: 12 }}>
              Ready to send this quote?
            </div>

            <div style={rowStyle}>
              <span style={labelStyle}>Customer</span>
              <span>{summary.name || "—"}</span>
            </div>
            {summary.jobType && (
              <div style={rowStyle}>
                <span style={labelStyle}>Job</span>
                <span>{summary.jobType}</span>
              </div>
            )}
            {summary.total !== null && (
              <div style={rowStyle}>
                <span style={labelStyle}>Quote total</span>
                <span style={{ fontWeight: 600 }}>
                  {fmt(summary.total)}
                  {exclusiveVatRate ? " inc VAT" : ""}
                </span>
              </div>
            )}
            {summary.proposed && (
              <div style={rowStyle}>
                <span style={labelStyle}>Proposed date</span>
                <span>{summary.proposed}</span>
              </div>
            )}

            <p
              style={{
                fontSize: 13,
                color: summary.email ? "#666" : "#b45309",
                margin: "12px 0 16px",
                lineHeight: 1.5,
              }}
            >
              {summary.email
                ? `The quote will be emailed to ${summary.email} straight away.`
                : "No email entered - the quote will be saved in PatchUp but NOT emailed to the customer."}
            </p>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={sending}
                style={{ ...cancelButtonStyle, flex: 1 }}
              >
                Go back
              </button>
              <button
                type="button"
                onClick={confirmAndSend}
                disabled={sending}
                style={{ ...submitButtonStyle, flex: 2 }}
              >
                {sending ? "Sending..." : "Confirm & send quote"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const cancelButtonStyle = {
  background: "white",
  color: "#000",
  padding: "14px",
  borderRadius: 2,
  border: "1px solid #e2e2e2",
  fontWeight: 500,
  flex: 1,
  textAlign: "center",
  textDecoration: "none",
  fontSize: 15,
};

const submitButtonStyle = {
  background: "#000",
  color: "white",
  padding: "14px",
  borderRadius: 2,
  border: "none",
  fontWeight: 500,
  flex: 1,
  fontSize: 15,
};

const overlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  zIndex: 100,
};

const cardStyle = {
  background: "white",
  borderRadius: 8,
  padding: 20,
  width: "100%",
  maxWidth: 420,
  boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
};

const rowStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  fontSize: 14,
  padding: "7px 0",
  borderBottom: "1px solid #f0f0f0",
};

const labelStyle = {
  color: "#888",
  fontSize: 13,
};
