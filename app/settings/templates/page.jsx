import Link from "next/link";
import BackButton from "../../components/BackButton";
import TemplateForm from "./TemplateForm";
import { TEMPLATE_DEFAULTS } from "../../lib/getTemplate";
import { getCurrentTeamMember } from "../../lib/auth";
import { canSeeEverything } from "../../lib/permissions";
import { getScopedDb } from "../../lib/scopedSupabaseClient";
import { notFound } from "next/navigation";

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
    description: "Sent when you book a job in, by email.",
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
    key: "deposit_request",
    label: "Deposit request",
    description: "Sent automatically when a customer accepts a quote that asked for a deposit.",
    placeholders: ["customer_name", "business_name", "job_type", "deposit_amount", "balance_amount"],
  },
  {
    key: "deposit_chase",
    label: "Deposit reminder",
    description: "Sent when you tap 'Chase deposit' on a job still awaiting its deposit.",
    placeholders: ["customer_name", "business_name", "job_type", "deposit_amount"],
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
  // Same rule as the main Settings page - this is business-wide
  // configuration, checked here on the server regardless of whether the
  // link to it was ever shown
  const currentMember = await getCurrentTeamMember();
  if (!canSeeEverything(currentMember)) {
    notFound();
  }

  const db = await getScopedDb(currentMember);
  const { data: rows } = await db.from("message_templates").select("*");
  const rowByKey = Object.fromEntries((rows || []).map((r) => [r.key, r]));

  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <BackButton fallbackHref="/settings" />
        <h1 style={{ fontSize: 21, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>Message templates</h1>
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
            <div style={{ fontWeight: 500, fontSize: 15 }}>{info.label}</div>
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

const cardStyle = {
  background: "white",
  borderRadius: 3,
  padding: "var(--card-pad, 16px)",
  marginBottom: 14,
  border: "1px solid #e2e2e2",
};

const labelStyle = {
  display: "grid",
  gap: 6,
  fontSize: 12,
  color: "#666",
  fontWeight: 500,
};

const inputStyle = {
  padding: "10px",
  borderRadius: 2,
  border: "1px solid #e2e2e2",
  fontSize: 14,
  fontWeight: 400,
  color: "#000",
  width: "100%",
  boxSizing: "border-box",
};

const saveButtonStyle = {
  background: "#000",
  color: "white",
  padding: "10px",
  borderRadius: 2,
  border: "none",
  fontWeight: 500,
  fontSize: 13,
};

const savedBannerStyle = {
  background: "#dcfce7",
  color: "#166534",
  padding: 8,
  borderRadius: 2,
  fontSize: 12,
  marginBottom: 10,
};
