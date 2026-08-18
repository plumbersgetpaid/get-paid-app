import { cronAuthorized } from "../../../lib/requireCron";
import { supabaseAdmin } from "../../../lib/supabaseClient";
import { getBusinessSettings } from "../../../lib/getBusinessSettings";
import { getEmailFrom } from "../../../lib/emailFrom";
import { formatCurrency } from "../../../lib/formatCurrency";
import { textToEmailHtml } from "../../../lib/emailHtml";
import { Resend } from "resend";
import { NextResponse } from "next/server";

// The evening brief: one email per business, sent the evening before, with
// everything the tradesperson would otherwise have to open the app to see.
//
// Replaces the old jobs-only 7am reminder. Three sections, and the email is
// skipped entirely for a business with nothing in any of them - a brief
// that arrives saying "nothing" trains people to ignore it.
//
//   - Tomorrow's jobs (the schedule)
//   - Invoices due tomorrow (money landing)
//   - Quotes still awaiting a reply (chase these)
//
// Runs on the service-role client, so every query is grouped and each
// business is only ever sent its own rows - never another business's.

// Tomorrow's date in London, as YYYY-MM-DD. Scheduled times are stored as
// London wall-clock (see lib/today.js), so the day window is built in the
// same frame.
function londonDatePlusDays(days) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  const d = new Date(`${p.year}-${p.month}-${p.day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function GET(req) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = supabaseAdmin();
  const tomorrow = londonDatePlusDays(1);

  const [{ data: jobs }, { data: invoices }, { data: quotes }] = await Promise.all([
    db
      .from("jobs")
      .select("business_id, customer_id, job_type, scheduled_start")
      .eq("status", "in_progress")
      .gte("scheduled_start", `${tomorrow}T00:00:00`)
      .lte("scheduled_start", `${tomorrow}T23:59:59`),
    db
      .from("invoices")
      .select("business_id, amount, job_id")
      .eq("status", "unpaid")
      .eq("due_date", tomorrow),
    db.from("jobs").select("business_id, customer_id, job_type").eq("status", "quote_sent"),
  ]);

  // Resolve customer names in one query across everything we'll render.
  const custIds = new Set();
  for (const j of jobs || []) custIds.add(j.customer_id);
  for (const q of quotes || []) custIds.add(q.customer_id);
  const invJobIds = (invoices || []).map((i) => i.job_id).filter(Boolean);
  const { data: invJobs } = invJobIds.length
    ? await db.from("jobs").select("id, customer_id").in("id", invJobIds)
    : { data: [] };
  for (const j of invJobs || []) custIds.add(j.customer_id);
  const jobCustomer = Object.fromEntries((invJobs || []).map((j) => [j.id, j.customer_id]));

  const { data: customers } = custIds.size
    ? await db.from("customers").select("id, name").in("id", [...custIds])
    : { data: [] };
  const nameById = Object.fromEntries((customers || []).map((c) => [c.id, c.name]));

  // Bucket every section by business.
  const byBusiness = new Map();
  const bucket = (id) => {
    if (!byBusiness.has(id)) byBusiness.set(id, { jobs: [], invoices: [], quotes: [] });
    return byBusiness.get(id);
  };
  for (const j of jobs || []) bucket(j.business_id).jobs.push(j);
  for (const i of invoices || []) bucket(i.business_id).invoices.push(i);
  for (const q of quotes || []) bucket(q.business_id).quotes.push(q);

  const timeOf = (iso) =>
    new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  let sent = 0;
  for (const [businessId, data] of byBusiness) {
    if (!data.jobs.length && !data.invoices.length && !data.quotes.length) continue;

    const settings = await getBusinessSettings(businessId);
    if (!settings.contact_email || !process.env.RESEND_API_KEY) continue;

    const sections = [];

    if (data.jobs.length) {
      const lines = [...data.jobs]
        .sort((a, b) => new Date(a.scheduled_start) - new Date(b.scheduled_start))
        .map((j) => `${timeOf(j.scheduled_start)} — ${nameById[j.customer_id] || "Customer"} (${j.job_type || "Job"})`);
      sections.push(`TOMORROW'S JOBS (${data.jobs.length})\n${lines.join("\n")}`);
    }

    if (data.invoices.length) {
      const total = data.invoices.reduce((s, i) => s + Number(i.amount || 0), 0);
      const lines = data.invoices.map((i) => {
        const name = nameById[jobCustomer[i.job_id]] || "Customer";
        return `${formatCurrency(i.amount, settings.currency)} — ${name}`;
      });
      sections.push(
        `INVOICES DUE TOMORROW (${formatCurrency(total, settings.currency)})\n${lines.join("\n")}`
      );
    }

    if (data.quotes.length) {
      const lines = data.quotes.map(
        (q) => `${nameById[q.customer_id] || "Customer"} (${q.job_type || "Job"})`
      );
      sections.push(
        `QUOTES AWAITING A REPLY (${data.quotes.length})\n${lines.join("\n")}\nChase or mark these on the Work screen.`
      );
    }

    const bodyText = `Evening ${settings.business_name || ""}, here's tomorrow at a glance:\n\n${sections.join(
      "\n\n"
    )}`;

    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: getEmailFrom(settings.business_name),
        to: settings.contact_email,
        subject: `Tomorrow: ${data.jobs.length} job${data.jobs.length === 1 ? "" : "s"}${
          data.invoices.length ? `, ${data.invoices.length} invoice due` : ""
        }`,
        html: `<div style="font-family:sans-serif; white-space:pre-wrap; line-height:1.5;">${textToEmailHtml(
          bodyText
        )}</div>`,
      });
      sent += 1;
    } catch (e) {
      console.error("Daily brief email error for", businessId, e);
    }
  }

  return NextResponse.json({ ok: true, businessesEmailed: sent });
}
