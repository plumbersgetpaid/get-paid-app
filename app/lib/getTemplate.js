import { supabaseAdmin } from "./supabaseClient";
import { getCurrentTeamMember } from "./auth";

const DEFAULTS = {
  quote: {
    subject: "Your quote for {{job_type}}",
    body: "Hi {{customer_name}},\n\nPlease find your quote below:\n\nJob: {{job_type}}\nQuoted price: £{{amount}}\n\nTake a look and let us know if you'd like to go ahead, and we'll get you booked in.\n\nAny questions, just get in touch.\n\nThanks,\n{{business_name}}",
  },
  invoice: {
    subject: "Invoice for {{job_type}}",
    body: "Hi {{customer_name}},\n\nThe job's complete - please find your invoice details below:\n\nJob: {{job_type}}\nAmount due: £{{amount}}\nDue date: {{due_date}}\n\nA PDF copy is attached.\n\nThanks,\n{{business_name}}",
  },
  chase_manual: {
    subject: "Payment reminder",
    body: "Hi {{customer_name}},\n\nThis is a reminder that payment of £{{amount}} was due {{due_date}}. Please arrange payment at your earliest convenience.\n\nA copy of the invoice is attached. Let us know if you have any questions.\n\nThanks,\n{{business_name}}",
  },
  chase_3day: {
    subject: "Payment reminder",
    body: "Hi {{customer_name}},\n\nA reminder that your invoice of £{{amount}} is now due. Please arrange payment when convenient, or let us know if you have any questions.\n\nThanks,\n{{business_name}}",
  },
  chase_7day: {
    subject: "Payment reminder - 7 days overdue",
    body: "Hi {{customer_name}},\n\nOur records show your invoice of £{{amount}} is now a week overdue. Please arrange payment as soon as possible.\n\nThanks,\n{{business_name}}",
  },
  chase_14day: {
    subject: "Payment reminder - overdue",
    body: "Hi {{customer_name}},\n\nYour invoice of £{{amount}} is now 2 weeks overdue. Please arrange payment urgently, or contact us if there's an issue we should know about.\n\nThanks,\n{{business_name}}",
  },
  booking_confirmation: {
    subject: "Booking confirmed - {{job_type}}",
    body: "Hi {{customer_name}},\n\nYou're booked in - here are the details:\n\nJob: {{job_type}}\nStart: {{start_date}} at {{start_time}}\nExpected duration: {{duration}}\n\nWe'll see you then. Let us know if anything changes on your end.\n\nThanks,\n{{business_name}}",
  },
  deposit_request: {
    subject: "Deposit for {{job_type}}",
    body: "Hi {{customer_name}},\n\nThanks for accepting the quote for {{job_type}}. To secure your booking, please send the deposit of £{{deposit_amount}}.\n\nThe remaining £{{balance_amount}} is due on completion.\n\nThanks,\n{{business_name}}",
  },
  deposit_chase: {
    subject: "Reminder: deposit for {{job_type}}",
    body: "Hi {{customer_name}},\n\nJust a gentle reminder about the deposit of £{{deposit_amount}} to secure your booking for {{job_type}}. Once it's through we're all set.\n\nAny questions, just reply to this email.\n\nThanks,\n{{business_name}}",
  },
  review_request: {
    subject: "Thanks for your payment",
    body: "Hi {{customer_name}},\n\nThanks for your payment.\n\nIf you were happy with the work, we'd really appreciate a quick Google review - it helps others find us and lets us know we're doing a good job.\n\n{{review_link}}\n\nThanks,\n{{business_name}}",
  },
  payment_note: {
    subject: "",
    body: "Alternatively, you can pay via bank transfer using the details below.",
  },
};

export async function getTemplate(key, businessId) {
  let resolvedBusinessId = businessId;
  if (!resolvedBusinessId) {
    const currentMember = await getCurrentTeamMember();
    resolvedBusinessId = currentMember?.business_id;
  }

  if (!resolvedBusinessId) {
    return DEFAULTS[key] || { subject: "", body: "" };
  }

  const db = supabaseAdmin();
  const { data } = await db
    .from("message_templates")
    .select("*")
    .eq("key", key)
    .eq("business_id", resolvedBusinessId)
    .maybeSingle();

  if (data?.body) {
    return { subject: data.subject || DEFAULTS[key]?.subject || "", body: data.body };
  }
  return DEFAULTS[key] || { subject: "", body: "" };
}

export function renderTemplate(str, vars) {
  if (!str) return "";
  return str.replace(/{{\s*(\w+)\s*}}/g, (_, token) => {
    const value = vars[token];
    return value !== undefined && value !== null ? String(value) : "";
  });
}

export const TEMPLATE_DEFAULTS = DEFAULTS;
