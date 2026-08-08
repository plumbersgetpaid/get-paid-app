import { supabaseAdmin } from "../../../lib/supabaseClient";
import { generateInvoicePdfBytes } from "../../../lib/generateInvoicePdf";
import { Resend } from "resend";
import { NextResponse } from "next/server";

// This route is designed to be called once a day by a scheduler
// (Vercel Cron, or an n8n workflow). It finds overdue invoices and
// sends an escalating reminder message.

export async function GET(req) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = supabaseAdmin();
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

  const { data: outstanding } = await db
    .from("outstanding_invoices")
    .select("*");

  let sent = 0;

  for (const inv of outstanding || []) {
    const daysOverdue = inv.days_overdue;
    let message = null;

    // Escalating tone based on how overdue the invoice is
    if (daysOverdue === 3) {
      message = `Hi ${inv.customer_name}, just a friendly reminder that your invoice of £${inv.amount} is now due. Let us know if you have any questions!`;
    } else if (daysOverdue === 7) {
      message = `Hi ${inv.customer_name}, your invoice of £${inv.amount} is now a week overdue. Please arrange payment when you get a chance.`;
    } else if (daysOverdue === 14) {
      message = `Hi ${inv.customer_name}, this is a follow-up that your invoice of £${inv.amount} is 2 weeks overdue. Please get in touch to sort payment.`;
    }

    if (message && inv.email && resend) {
      const pdfBytes = await generateInvoicePdfBytes({
        invoiceIdShort: inv.invoice_id.slice(0, 8).toUpperCase(),
        customerName: inv.customer_name,
        customerEmail: inv.email,
        customerPhone: inv.phone,
        jobType: inv.job_type,
        amount: inv.amount,
        dueDate: inv.due_date,
        status: "unpaid",
      });

      await resend.emails.send({
        // Using Resend's test sending address for now - swap this for your
        // own verified domain once you're ready to send to real customers.
        from: "Get Paid <onboarding@resend.dev>",
        to: inv.email,
        subject: "Payment reminder",
        html: `<p>${message}</p><p>A copy of the invoice is attached.</p>`,
        attachments: [
          {
            filename: `invoice-${inv.invoice_id.slice(0, 8)}.pdf`,
            content: Buffer.from(pdfBytes),
          },
        ],
      });

      await db.from("chase_log").insert({
        invoice_id: inv.invoice_id,
        message,
        channel: "email",
      });

      sent++;
    }

    // To also send via SMS/WhatsApp, add Twilio logic here using inv.phone
  }

  return NextResponse.json({ ok: true, sent });
}
