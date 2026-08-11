import Link from "next/link";
import BackButton from "../../components/BackButton";
import TemplateForm from "./TemplateForm";
import { supabaseAdmin } from "../../lib/supabaseClient";
import { TEMPLATE_DEFAULTS } from "../../lib/getTemplate";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const TEMPLATE_INFO = [
  {
    key: "quote",
    label: "New quote",
    description: "Sent when you create a quote for a customer.",
    placeholders: ["customer_name", "job_type", "amount", "business_name"],
  },
  {
    key: "invoice",
    label: "Invoice (job complete)",
    description: "Sent when you mark a job done.",
    placeholders: [
      "customer_name",
      "job_type",
      "amount",
      "due_date",
      "business_name",
    ],
  },
  {
    key: "chase_manual",
    label: "Manual chase",
    description: "Sent when you tap \"Chase now\" on an invoice.",
    placeholders: ["customer_name", "amount", "due_date", "business_name"],
  },
  {
    key: "chase_3day",
    label: "Auto chase - 3 days overdue",
    description: "Sent automatically once, 3 days after an invoice is overdue.",
    placeholders: ["customer_name", "amount", "business_name"],
  },
  {
    key: "chase_7day",
    label: "Auto chase - 7 days overdue",
    description: "Sent automatically once, a week after an invoice is overdue.",
    placeholders: ["customer_name", "amount", "business_name"],
  },
  {
    key: "chase_14day",
    label: "Auto chase - 14 days overdue",
    description: "Sent automatically once, 2 weeks after an invoice is overdue.",
    placeholders: ["customer_name", "amount", "business_name"],
  },
  {
    key: "booking_confirmation",
    label: "Booking confirmation",
    description: "Sent when you book a job in, by email and/or WhatsApp.",
    placeholders: [
      "customer_name",
      "job_type",
      "start_date",
      "start_time",
      "duration",
      "business_name",
    ],
  },
  {
    key: "review_request",
    label: "Review request",
    description: "Sent automatically once an invoice is marked as paid.",
    placeholders: ["customer_name", "business_name", "review_link"],
  },
  {
    key: "payment_note",
    label: "Payment link note",
    description:
      "Small print shown alongside \"Pay now\" on the invoice PDF and in emails, whenever an invoice has a payment link attached.",
    placeholders: [],
    noSubject: true,
  },
];

export default async function TemplatesSettings() {
  const db = supabaseAdmin();
  const { data: rows } = await db.from("message_templates").select("*");
  const rowByKey = Object.fromEntries((rows || []).map((r) => [r.key, r]));

  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <BackButton fallbackHref="/settings" />
        <h1 style={{ fontSize: 20, margin: 0 }}>Message templates</h1>
      </div>

      <p style={{ fontSize: 13, color: "#888", marginTop: 8 }}>
        Every automated email, written the way you'd say it. Use the
        placeholders shown under each one - they'll be swapped for the real
        details when it's sent.
      </p>

      {TEMPLATE_INFO.map((info) => {
        const saved = rowByKey[info.key];
        const defaults = TEMPLATE_DEFAULTS[info.key] || {};
        const subjectValue = saved?.subject ?? defaults.subject ?? "";
        const bodyValue = saved?.body ?? defaults.body ?? "";

        return (
          <section key={info.key} style={cardStyle}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{info.label}</div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 10 }}>
              {info.description}
            </div>

            <TemplateForm
              templateKey={info.key}
              subjectValue={subjectValue}
              bodyValue={bodyValue}
              noSubject={!!info.noSubject}
              rows={info.noSubject ? 3 : 6}
            />

            {info.placeholders.length > 0 && (
              <div style={{ fontSize: 11, color: "#888", marginTop: 8 }}>
                Placeholders:{" "}
                {info.placeholders.map((p) => `{{${p}}}`).join("  ")}
              </div>
            )}
          </section>
        );
      })}
    </main>
  );
}

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

const cardStyle = {
  background: "white",
  borderRadius: 12,
  padding: 16,
  marginBottom: 14,
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
};

const labelStyle = {
  display: "grid",
  gap: 6,
  fontSize: 12,
  color: "#666",
  fontWeight: 600,
};

const inputStyle = {
  padding: "10px",
  borderRadius: 8,
  border: "1px solid #ddd",
  fontSize: 14,
  fontWeight: 400,
  color: "#111",
  width: "100%",
  boxSizing: "border-box",
};

const saveButtonStyle = {
  background: "#111",
  color: "white",
  padding: "10px",
  borderRadius: 8,
  border: "none",
  fontWeight: 600,
  fontSize: 13,
};

const savedBannerStyle = {
  background: "#dcfce7",
  color: "#166534",
  padding: 8,
  borderRadius: 8,
  fontSize: 12,
  marginBottom: 10,
};
