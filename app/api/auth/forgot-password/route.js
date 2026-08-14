import { supabaseAdmin } from "../../../lib/supabaseClient";
import { getBusinessSettings } from "../../../lib/getBusinessSettings";
import { getEmailFrom } from "../../../lib/emailFrom";
import { textToEmailHtml } from "../../../lib/emailHtml";
import { Resend } from "resend";
import { NextResponse } from "next/server";

function generateResetToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function POST(req) {
  const form = await req.formData();
  const email = (form.get("email") || "").toString().trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ error: "Enter your email" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: member } = await db
    .from("team_members")
    .select("id, name")
    .eq("email", email)
    .eq("is_active", true)
    .maybeSingle();

  if (member && process.env.RESEND_API_KEY) {
    try {
      const token = generateResetToken();
      const expires = new Date(Date.now() + 60 * 60 * 1000);

      await db
        .from("team_members")
        .update({ reset_token: token, reset_token_expires: expires.toISOString() })
        .eq("id", member.id);

      const settings = await getBusinessSettings();
      const resetUrl = new URL(`/reset-password?token=${token}`, req.url).toString();
      const resend = new Resend(process.env.RESEND_API_KEY);

      const bodyText = `Hi ${member.name},\n\nSomeone (hopefully you) asked to reset the password for your ${
        settings.business_name
      } account. Tap the link below to choose a new one - it expires in an hour:\n\n${resetUrl}\n\nIf you didn't ask for this, you can just ignore this email - your password hasn't been changed.`;
      const html = `<div style="font-family:sans-serif; white-space:pre-wrap;">${textToEmailHtml(
        bodyText
      )}</div>`;

      await resend.emails.send({
        from: getEmailFrom(settings.business_name),
        to: email,
        subject: "Reset your password",
        html,
      });
    } catch (err) {
      console.error("Forgot password error:", err);
    }
  }

  return NextResponse.json({
    ok: true,
    message: "If that email has an account, a reset link is on its way.",
  });
}
