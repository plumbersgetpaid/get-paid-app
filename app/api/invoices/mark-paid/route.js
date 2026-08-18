import { getBusinessSettings } from "../../../lib/getBusinessSettings";
import { getTemplate, renderTemplate } from "../../../lib/getTemplate";
import { textToEmailHtml } from "../../../lib/emailHtml";
import { getEmailFrom } from "../../../lib/emailFrom";
import { getCurrentTeamMember } from "../../../lib/auth";
import { canInvoice } from "../../../lib/permissions";
import { getScopedDb } from "../../../lib/scopedSupabaseClient";
import { Resend } from "resend";
import { NextResponse } from "next/server";

export async function POST(req) {
  const currentMember = await getCurrentTeamMember();
  if (!canInvoice(currentMember)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const form = await req.formData();
  const invoiceId = form.get("invoiceId");

  if (!invoiceId) {
    return NextResponse.json({ error: "Missing invoiceId" }, { status: 400 });
  }

  const db = await getScopedDb(currentMember);

  const { data: invoice, error: invErr } = await db
    .from("invoices")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", invoiceId)
    .select("job_id")
    .single();

  if (invErr) {
    console.error("Mark paid error:", invErr);
    return NextResponse.json({ error: invErr.message }, { status: 400 });
  }

  if (invoice?.job_id) {
    await db.from("jobs").update({ status: "paid" }).eq("id", invoice.job_id);
  }

  if (invoice?.job_id) {
    try {
      const settings = await getBusinessSettings();
      if (settings.google_review_link) {
        const { data: job } = await db
          .from("jobs")
          .select("customer_id")
          .eq("id", invoice.job_id)
          .single();

        const { data: customer } = job?.customer_id
          ? await db.from("customers").select("*").eq("id", job.customer_id).single()
          : { data: null };

        if (customer) {
          const template = await getTemplate("review_request");
          const vars = {
            customer_name: customer.name,
            business_name: settings.business_name,
            review_link: settings.google_review_link,
          };
          const bodyText = renderTemplate(template.body, vars);
          const subject = renderTemplate(template.subject, vars) || "Thanks for your payment!";

          if (customer.email && process.env.RESEND_API_KEY) {
            const resend = new Resend(process.env.RESEND_API_KEY);
            const html = `<div style="font-family:sans-serif; white-space:pre-wrap;">${textToEmailHtml(
              bodyText
            )}</div>`;
            await resend.emails.send({
              from: getEmailFrom(settings.business_name),
              to: customer.email,
              replyTo: settings.contact_email || undefined,
              subject,
              html,
            });
          }
        }
      }
    } catch (e) {
      console.error("Review request send error:", e);
    }
  }

  return NextResponse.redirect(new URL("/", req.url));
}
