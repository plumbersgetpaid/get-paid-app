import { supabaseAdmin } from "../../../lib/supabaseClient";
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

  const message =
    inv.days_overdue > 0
      ? `Hi ${inv.customer_name}, just chasing up your invoice of £${inv.amount}, which is now ${inv.days_overdue} day(s) overdue. Please let us know if you have any questions.`
      : `Hi ${inv.customer_name}, just a reminder that your invoice of £${inv.amount} is due on ${inv.due_date}. Thanks!`;

  if (inv.email && process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    try {
      await resend.emails.send({
        // Using Resend's test sending address for now - swap this for your
        // own verified domain once you're ready to send to real customers.
        from: "Get Paid <onboarding@resend.dev>",
        to: inv.email,
        subject: "Payment reminder",
        html: `<p>${message}</p>`,
      });

      await db.from("chase_log").insert({
        invoice_id: inv.invoice_id,
        message,
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
