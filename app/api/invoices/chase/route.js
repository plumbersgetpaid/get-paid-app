import { supabaseAdmin } from "../../../lib/supabaseClient";
import { generateInvoicePdfBytes } from "../../../lib/generateInvoicePdf";
import { getBusinessSettings } from "../../../lib/getBusinessSettings";
import { getTemplate, renderTemplate } from "../../../lib/getTemplate";
import { Resend } from "resend";
import { NextResponse } from "next/server";

// Lets the plumber chase a specific invoice on demand, on top of the
// automatic daily chase cron job.
export async function POST(req) {
  const form = await req.formData();
  const invoiceId = form.get("invoiceId");

  if (!invoiceId) {
    return NextResponse.json({ error: "Missing invoiceId" }, { status: 400 });
  }

  const db = supabaseAdmin();

  const { data: inv, error: fetchErr } = await db
    .from("outstanding_invoices")
    .select("*")
    .eq("invoice_id", invoiceId)
    .single();

  if (fetchErr || !inv) {
    console.error("Chase lookup error:", fetchErr);
    return NextResponse.json({ error: "Invoice not found" }, { status: 400 });
  }

  if (inv.email && process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    try {
      const settings = await getBusinessSettings();
      const business = {
        businessName: settings.business_name,
        accentColor: settings.accent_color,
        logoUrl: settings.logo_url,
        contactEmail: settings.contact_email,
        contactPhone: settings.contact_phone,
        invoiceNote: settings.invoice_note,
        headerTagline: settings.header_tagline,
        paymentTerms: settings.payment_terms,
        bankDetails: settings.bank_details,
      };

      const pdfBytes = await generateInvoicePdfBytes({
        invoiceIdShort: inv.invoice_id.slice(0, 8).toUpperCase(),
        customerName: inv.customer_name,
        customerEmail: inv.email,
        customerPhone: inv.phone,
        jobType: inv.job_type,
        amount: inv.amount,
        dueDate: inv.due_date,
        status: "unpaid",
        business,
      });

      const template = await getTemplate("chase_manual");
      const vars = {
        customer_name: inv.customer_name,
        amount: inv.amount,
        due_date: inv.due_date,
        business_name: settings.business_name,
      };
      const subject = renderTemplate(template.subject, vars) || "Payment reminder";
      const bodyText = renderTemplate(template.body, vars);
      const html = `<div style="font-family:sans-serif; white-space:pre-wrap;">${bodyText.replace(
        /\n/g,
        "<br/>"
      )}</div>`;

      await resend.emails.send({
        // Using Resend's test sending address for now - swap this for your
        // own verified domain once you're ready to send to real customers.
        from: `${settings.business_name} <onboarding@resend.dev>`,
        to: inv.email,
        subject,
        html,
        attachments: [
          {
            filename: `invoice-${inv.invoice_id.slice(0, 8)}.pdf`,
            content: Buffer.from(pdfBytes),
          },
        ],
      });

      await db.from("chase_log").insert({
        invoice_id: inv.invoice_id,
        message: bodyText,
        channel: "email",
      });
    } catch (e) {
      console.error("Manual chase send error:", e);
    }
  } else {
    console.log("Skipped manual chase - no email on file or Resend key missing");
  }

  return NextResponse.redirect(new URL("/", req.url));
}
