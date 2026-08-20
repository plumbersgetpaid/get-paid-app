"use client";

import { useRef, useState } from "react";
import Link from "next/link";

// The shared review-before-send bar used by the three creation flows that
// touch a customer: New quote, Quick book, and New recurring job. Renders
// the Cancel + submit row; tapping submit first shows a card of exactly
// what's about to happen - who, how much, and crucially WHETHER THE
// CUSTOMER WILL BE EMAILED. Unticking "let the client know" (or leaving
// email blank) is a legitimate choice, but it must never be a silent one:
// the card says so in amber, and "Go back" is the way to change it.
//
// Reads values straight off the surrounding <form>, so it needs no wiring
// to the inputs. Server-rendered forms get a native submit; a client parent
// can pass onConfirm/busy to run its own fetch-based submit instead.
export default function ConfirmSendBar({
  variant, // "quote" | "quickbook" | "recurring"
  exclusiveVatRate = null, // number when the business types before-VAT prices; null = inclusive; undefined = unknown (label the figure "as entered")
  cancelHref,
  submitLabel,
  confirmLabel,
  busy = false, // client parents: their submitting state
  onConfirm, // client parents: (formEl) => void; otherwise native submit
}) {
  const btnRef = useRef(null);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);

  const [summary, setSummary] = useState(null);

  const fmt = (n) =>
    `£${Number(n).toLocaleString("en-GB", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const fmtDate = (d) =>
    new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
    });

  function openConfirm() {
    const form = btnRef.current?.closest("form");
    if (!form) return;
    if (!form.reportValidity()) return;

    const fd = new FormData(form);
    const get = (k) => (fd.get(k) || "").toString().trim();

    const typed = parseFloat(get("amount"));
    const rate = typeof exclusiveVatRate === "number" ? exclusiveVatRate : 0;
    const total =
      typeof exclusiveVatRate === "number" && Number.isFinite(typed)
        ? Math.round(typed * (1 + rate / 100) * 100) / 100
        : typed;

    const email = get("email");
    const notify = variant === "quote" ? true : fd.get("notifyEmail") === "1";

    const rows = [];
    rows.push({ label: "Customer", value: get(variant === "quickbook" ? "customerName" : "name") || "—" });
    const jobType = get("jobType");
    if (jobType) rows.push({ label: "Job", value: jobType });

    if (Number.isFinite(total)) {
      const amountLabel =
        variant === "quote"
          ? "Quote total"
          : variant === "recurring"
            ? "Price each time"
            : "Price";
      rows.push({
        label: exclusiveVatRate === undefined ? `${amountLabel} (as entered)` : amountLabel,
        value: `${fmt(total)}${typeof exclusiveVatRate === "number" ? " inc VAT" : ""}`,
        strong: true,
      });
    }

    if (variant === "quote") {
      const d = get("proposedDate");
      if (d) rows.push({ label: "Proposed date", value: `${fmtDate(d)} at ${get("proposedTime") || "09:00"}` });
    }
    if (variant === "quickbook") {
      const d = get("startDate");
      if (d) rows.push({ label: "Booked for", value: `${fmtDate(d)} at ${get("startTime") || "09:00"}` });
    }
    if (variant === "recurring") {
      const n = get("frequencyValue") || "1";
      const unit = get("frequencyUnit") || "months";
      rows.push({ label: "Repeats", value: `every ${n} ${n === "1" ? unit.replace(/s$/, "") : unit}` });
      const d = get("startDate");
      if (d) rows.push({ label: "First visit", value: fmtDate(d) });
    }

    // The email disclaimer - the part that must never be silent.
    let emailLine;
    let emailOk;
    if (variant === "quote") {
      emailOk = !!email;
      emailLine = email
        ? `The quote will be emailed to ${email} straight away.`
        : "No email entered - the quote will be saved in PatchUp but NOT emailed to the customer.";
    } else if (variant === "quickbook") {
      emailOk = !!email && notify;
      emailLine = !email
        ? "No email entered - the customer won't get a booking confirmation."
        : notify
          ? `A booking confirmation will be emailed to ${email}.`
          : "You've turned the email off - the customer won't get a booking confirmation. Go back and tick “Email” if they should.";
    } else {
      emailOk = !!email && notify;
      emailLine = !email
        ? "No email entered - the customer won't get an email when each visit is booked in."
        : notify
          ? `A booking confirmation will be emailed to ${email} each time a visit is booked in.`
          : "You've turned the email off - the customer won't get an email when each visit is booked in. Go back and tick “Email” if they should.";
    }

    setSummary({ rows, emailLine, emailOk });
    setConfirming(true);
  }

  function confirmAndSend() {
    const form = btnRef.current?.closest("form");
    if (!form) return;
    if (onConfirm) {
      // Client parent owns the submit (and its busy/error states) - close
      // the card so any error message it renders is visible.
      setConfirming(false);
      onConfirm(form);
      return;
    }
    setSending(true);
    form.requestSubmit ? form.requestSubmit() : form.submit();
  }

  const isBusy = busy || sending;

  return (
    <>
      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <Link href={cancelHref} style={cancelButtonStyle}>
          Cancel
        </Link>
        <button type="button" ref={btnRef} onClick={openConfirm} disabled={isBusy} style={submitButtonStyle}>
          {isBusy ? "Saving..." : submitLabel}
        </button>
      </div>

      {confirming && summary && (
        <div style={overlayStyle} role="dialog" aria-modal="true" aria-label="Confirm before sending">
          <div style={cardStyle}>
            <div style={{ fontWeight: 500, fontSize: 16, marginBottom: 12 }}>
              {variant === "quote"
                ? "Ready to send this quote?"
                : variant === "quickbook"
                  ? "Ready to book this in?"
                  : "Ready to save this recurring job?"}
            </div>

            {summary.rows.map((r) => (
              <div key={r.label} style={rowStyle}>
                <span style={labelStyle}>{r.label}</span>
                <span style={r.strong ? { fontWeight: 600 } : undefined}>{r.value}</span>
              </div>
            ))}

            <p
              style={{
                fontSize: 13,
                color: summary.emailOk ? "#666" : "#b45309",
                margin: "12px 0 16px",
                lineHeight: 1.5,
              }}
            >
              {summary.emailLine}
            </p>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={isBusy}
                style={{ ...cancelButtonStyle, flex: 1 }}
              >
                Go back
              </button>
              <button
                type="button"
                onClick={confirmAndSend}
                disabled={isBusy}
                style={{ ...submitButtonStyle, flex: 2 }}
              >
                {isBusy ? "Sending..." : confirmLabel}
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
  flex: 2,
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
