import { getBusinessSettings } from "../../lib/getBusinessSettings";
import { formatCurrency } from "../../lib/formatCurrency";
import { getCurrentTeamMember } from "../../lib/auth";
import { canCreateRecurringJob } from "../../lib/permissions";
import { getScopedDb } from "../../lib/scopedSupabaseClient";
import { notFound } from "next/navigation";
import Link from "next/link";
import BackButton from "../../components/BackButton";
import ConfirmSubmitButton from "../../components/ConfirmSubmitButton";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function RecurringJobs() {
  // Also enforced centrally in middleware, but checked again here
  // directly - defense in depth, same pattern as Settings and Invoices
  const currentMember = await getCurrentTeamMember();
  if (!canCreateRecurringJob(currentMember)) {
    notFound();
  }

  const db = await getScopedDb(currentMember);
  const settings = await getBusinessSettings();

  const { data: rawRecurring } = await db
    .from("recurring_jobs")
    .select("*")
    .order("next_occurrence", { ascending: true });

  let recurring = rawRecurring || [];
  const customerIds = [...new Set(recurring.map((r) => r.customer_id))];
  const { data: customers } = customerIds.length
    ? await db.from("customers").select("id, name").in("id", customerIds)
    : { data: [] };
  const nameById = Object.fromEntries((customers || []).map((c) => [c.id, c.name]));
  recurring = recurring.map((r) => ({ ...r, customer_name: nameById[r.customer_id] || "Unknown" }));

  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <BackButton fallbackHref="/work?tab=jobs" />
        <h1 style={{ fontSize: 21, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>Recurring jobs</h1>
      </div>

      <Link href="/jobs/recurring/new" style={newButtonStyle}>
        + New recurring job
      </Link>

      {recurring.length === 0 && (
        <p style={{ color: "#888" }}>
          No recurring jobs set up yet - handy for regular maintenance,
          servicing contracts, or anything on a repeating schedule.
        </p>
      )}

      {recurring.map((r) => (
        <div key={r.id} style={cardStyle(r.active ? "#2563eb" : "#9ca3af")}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div style={{ fontWeight: 500 }}>{r.customer_name}</div>
            <div style={{ fontWeight: 500 }}>{formatCurrency(r.amount, settings.currency)}</div>
          </div>
          <div style={{ fontSize: 13, color: "#888" }}>
            {r.job_type || "Job"} · every {r.frequency_value} {r.frequency_unit}
          </div>
          <div style={{ fontSize: 13, color: r.active ? "#16a34a" : "#888", marginTop: 2 }}>
            {r.active
              ? `Next: ${new Date(r.next_occurrence).toLocaleDateString("en-GB", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}`
              : "Paused"}
            {r.confirm_time_later ? " · confirms time nearer the day" : ""}
          </div>
          {r.next_occurrence_time && (
            <div style={{ fontSize: 12, color: "#92400e", marginTop: 2 }}>
              Next occurrence set for {r.next_occurrence_time} (one-off)
            </div>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            <Link
              href={`/jobs/recurring/${r.id}/edit`}
              style={{ ...secondaryButtonStyle, textAlign: "center", textDecoration: "none" }}
            >
              Edit
            </Link>
            <form action="/api/jobs/recurring/pause" method="POST" style={{ flex: 1 }}>
              <input type="hidden" name="recurringId" value={r.id} />
              <input type="hidden" name="active" value={r.active ? "0" : "1"} />
              {/* Pausing stops future jobs being created, so it asks first.
                  Resuming doesn't - confirming that you'd like to switch
                  something back on is friction with nothing behind it. */}
              {r.active ? (
                <ConfirmSubmitButton
                  tone="neutral"
                  style={secondaryButtonStyle}
                  confirmText={`Pause the recurring job for ${r.customer_name}? No new jobs will be created until you resume it. Nothing already booked is affected.`}
                  confirmLabel="Yes, pause it"
                  cancelLabel="Keep it running"
                >
                  Pause
                </ConfirmSubmitButton>
              ) : (
                <button type="submit" style={secondaryButtonStyle}>
                  Resume
                </button>
              )}
            </form>
            <form action="/api/jobs/recurring/delete" method="POST" style={{ flex: 1 }}>
              <input type="hidden" name="recurringId" value={r.id} />
              <ConfirmSubmitButton
                style={deleteButtonStyle}
                confirmText={`Delete the recurring job for ${r.customer_name}? This removes the schedule for good - it can't be undone. Jobs already created from it stay where they are.`}
                confirmLabel="Yes, delete it"
                cancelLabel="Cancel"
              >
                Delete
              </ConfirmSubmitButton>
            </form>
          </div>
        </div>
      ))}
    </main>
  );
}

const newButtonStyle = {
  display: "block",
  textAlign: "center",
  background: "#000",
  color: "white",
  padding: "12px",
  borderRadius: 2,
  textDecoration: "none",
  fontWeight: 500,
  margin: "16px 0",
};

const cardStyle = (color) => ({
  background: "white",
  borderRadius: 2,
  padding: "var(--card-pad-tight, 14px)",
  marginBottom: 8,
  borderLeft: `4px solid ${color}`,
});

const secondaryButtonStyle = {
  width: "100%",
  background: "white",
  color: "#000",
  border: "1px solid #e2e2e2",
  padding: "8px 10px",
  borderRadius: 2,
  fontWeight: 500,
  fontSize: 13,
};

const deleteButtonStyle = {
  width: "100%",
  background: "white",
  color: "#b91c1c",
  border: "1px solid #fca5a5",
  padding: "8px 10px",
  borderRadius: 2,
  fontWeight: 500,
  fontSize: 13,
};
