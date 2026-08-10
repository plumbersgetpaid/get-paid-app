import { getBusinessSettings } from "../../../lib/getBusinessSettings";
import { getTemplate, renderTemplate } from "../../../lib/getTemplate";
import { textToEmailHtml } from "../../../lib/emailHtml";
import { sendWhatsAppMessage } from "../../../lib/sendWhatsApp";
import { Resend } from "resend";
import { NextResponse } from "next/server";

export async function POST(req) {
  const settings = await getBusinessSettings();

  if (!settings.google_review_link) {
    return NextResponse.redirect(new URL("/settings?testError=nolink", req.url));
  }
  if (!settings.contact_email && !settings.contact_phone) {
    return NextResponse.redirect(new URL("/settings?testError=nocontact", req.url));
  }

  const template = await getTemplate("review_request");
  const vars = {
    customer_name: "Test Customer",
    business_name: settings.business_name,
    review_link: settings.google_review_link,
  };
  const bodyText = renderTemplate(template.body, vars);
  const subject = renderTemplate(template.subject, vars) || "Thanks for your payment!";

  let emailSent = false;

  if (settings.contact_email && process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const html = `<div style="font-family:sans-serif; white-space:pre-wrap;">${textToEmailHtml(
        bodyText
      )}</div>`;
      await resend.emails.send({
        from: `${settings.business_name} <onboarding@resend.dev>`,
        to: settings.contact_email,
        subject: `[TEST] ${subject}`,
        html,
      });
      emailSent = true;
    } catch (e) {
      console.error("Test review email error:", e);
    }
  }

  if (settings.contact_phone) {
    await sendWhatsAppMessage(settings.contact_phone, `[TEST]\n\n${bodyText}`);
  }

  return NextResponse.redirect(
    new URL(`/settings?testSent=${emailSent ? "1" : "0"}`, req.url)
  );
}
