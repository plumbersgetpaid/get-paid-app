import twilio from "twilio";

// UK-focused phone formatting: converts a loosely-typed number like
// "07503 332114" into WhatsApp/Twilio's required E.164 format "+447503332114"
function formatPhoneForWhatsApp(phone) {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("0")) return `+44${digits.slice(1)}`;
  return `+${digits}`;
}

export async function sendWhatsAppMessage(toPhone, body) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_FROM; // e.g. "whatsapp:+14155238886"

  if (!accountSid || !authToken || !fromNumber) {
    console.log("Skipped WhatsApp send - Twilio isn't set up yet");
    return { skipped: true };
  }

  const to = formatPhoneForWhatsApp(toPhone);
  if (!to) {
    console.log("Skipped WhatsApp send - no valid phone number on file");
    return { skipped: true };
  }

  try {
    const client = twilio(accountSid, authToken);
    await client.messages.create({
      from: fromNumber,
      to: `whatsapp:${to}`,
      body,
    });
    return { sent: true };
  } catch (e) {
    console.error("WhatsApp send error:", e);
    return { error: e.message };
  }
}
