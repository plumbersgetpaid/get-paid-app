import { getBusinessSettings } from "../../../lib/getBusinessSettings";
import { getTemplate, renderTemplate } from "../../../lib/getTemplate";
import { textToEmailHtml } from "../../../lib/emailHtml";
import { getEmailFrom } from "../../../lib/emailFrom";
import { Resend } from "resend";
import { NextResponse } from "next/server";

export async function POST(req) {
  const settings = await getBusinessSettings();

  if (!settings.google_review_link) {
    return NextResponse.redirect(new URL("/settings?testError=nolink", req.url), 303);
  }
  if (!settings.contact_email && !settings.contact_phone) {
    return NextResponse.redirect(new URL("/settings?testError=nocontact", req.url), 303);
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
  let emailErrorMessage = null;

  if (!settings.contact_email) {
    emailErrorMessage = "No contact email is set in Settings below.";
  } else if (!process.env.RESEND_API_KEY) {
    emailErrorMessage = "RESEND_API_KEY isn't set up in Vercel.";
  } else {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const html = `<div style="font-family:sans-serif; white-space:pre-wrap;">${textToEmailHtml(
        bodyText
      )}</div>`;
      const result = await resend.emails.send({
        from: getEmailFrom(settings.business_name),
        to: settings.contact_email.trim().toLowerCase(),
        subject: `[TEST] ${subject}`,
        html,
      });
      console.log("Test review email result:", JSON.stringify(result));

      if (result?.error) {
        emailErrorMessage = result.error.message || "Resend returned an error.";
        console.error("Test review email API error:", result.error);
      } else {
        emailSent = true;
      }
    } catch (e) {
      emailErrorMessage = e.message || "Unknown error sending the email.";
      console.error("Test review email threw:", e);
    }
  }

  const redirectUrl = new URL("/settings", req.url);
  redirectUrl.searchParams.set("testSent", emailSent ? "1" : "0");
  if (emailErrorMessage) {
    redirectUrl.searchParams.set("testErrorMsg", emailErrorMessage);
  }
  return NextResponse.redirect(redirectUrl, 303);
}
