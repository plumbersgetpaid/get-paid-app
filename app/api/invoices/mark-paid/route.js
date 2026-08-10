import { supabaseAdmin } from "../../../lib/supabaseClient";
import { getBusinessSettings } from "../../../lib/getBusinessSettings";
import { getTemplate, renderTemplate } from "../../../lib/getTemplate";
import { sendWhatsAppMessage } from "../../../lib/sendWhatsApp";
import { Resend } from "resend";
import { NextResponse } from "next/server";

export async function POST(req) {
  const form = await req.formData();
  const invoiceId = form.get("invoiceId");

  if (!invoiceId) {
    return NextResponse.json({ error: "Missing invoiceId" }, { status: 400 });
  }

  const db = supabaseAdmin();

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

  // Keep the job status in sync with the invoice
  if (invoice?.job_id) {
    await db.from("jobs").update({ status: "paid" }).eq("id", invoice.job_id);
  }

  // Automatic thank-you + Google review request - fully hands-off, only
  // sends if a review link has been set up in Settings. A failure here
  // should never block the payment itself being recorded.
  if (invoice?.job_id) {
    try {
      const settings = await getBusinessSettings();
      if (settings.send_review_requests && settings.google_review_link) {
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
            const html = `<div style="font-family:sans-serif; white-space:pre-wrap;">${bodyText.replace(
              /\n/g,
              "<br/>"
            )}</div>`;
            await resend.emails.send({
              from: `${settings.business_name} <onboarding@resend.dev>`,
              to: customer.email,
              subject,
              html,
            });
          }

          if (customer.phone) {
            await sendWhatsAppMessage(customer.phone, bodyText);
          }
        }
      }
    } catch (e) {
      console.error("Review request send error:", e);
    }
  }

  return NextResponse.redirect(new URL("/", req.url));
}
