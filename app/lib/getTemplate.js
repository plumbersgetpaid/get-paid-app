import { supabaseAdmin } from "./supabaseClient";

// Fallback copy if a template hasn't been saved yet (or the row is missing) -
// keeps every email working even before the tradie has customized anything
const DEFAULTS = {
  quote: {
    subject: "Quote for {{job_type}}",
    body: "Hi {{customer_name}},\n\nThanks for the opportunity to quote for your job. Here are the details:\n\nJob: {{job_type}}\nQuoted price: £{{amount}}\n\nLet us know if you'd like to go ahead and we'll get it booked in.\n\nThanks,\n{{business_name}}",
  },
  invoice: {
    subject: "Invoice for {{job_type}}",
    body: "Hi {{customer_name}},\n\nThanks for your business. Here's your invoice:\n\nJob: {{job_type}}\nAmount due: £{{amount}}\nDue date: {{due_date}}\n\nA PDF copy of this invoice is attached.\n\nThanks,\n{{business_name}}",
  },
  chase_manual: {
    subject: "Payment reminder",
    body: "Hi {{customer_name}}, just chasing up your invoice of £{{amount}}, due {{due_date}}. Please let us know if you have any questions.\n\nA copy of the invoice is attached.\n\nThanks,\n{{business_name}}",
  },
  chase_3day: {
    subject: "Payment reminder",
    body: "Hi {{customer_name}}, just a friendly reminder that your invoice of £{{amount}} is now due. Let us know if you have any questions!",
  },
  chase_7day: {
    subject: "Payment reminder",
    body: "Hi {{customer_name}}, your invoice of £{{amount}} is now a week overdue. Please arrange payment when you get a chance.",
  },
  chase_14day: {
    subject: "Payment reminder",
    body: "Hi {{customer_name}}, this is a follow-up that your invoice of £{{amount}} is 2 weeks overdue. Please get in touch to sort payment.",
  },
  booking_confirmation: {
    subject: "Booking confirmed - {{job_type}}",
    body: "Hi {{customer_name}},\n\nJust confirming we've got you booked in:\n\nJob: {{job_type}}\nStart: {{start_date}} at {{start_time}}\nExpected duration: {{duration}}\n\nSee you then!\n\nThanks,\n{{business_name}}",
  },
};

export async function getTemplate(key) {
  const db = supabaseAdmin();
  const { data } = await db
    .from("message_templates")
    .select("*")
    .eq("key", key)
    .single();

  if (data?.body) {
    return { subject: data.subject || DEFAULTS[key]?.subject || "", body: data.body };
  }
  return DEFAULTS[key] || { subject: "", body: "" };
}

// Replaces {{token}} placeholders with values from `vars`. Unknown tokens
// are replaced with an empty string rather than left in place.
export function renderTemplate(str, vars) {
  if (!str) return "";
  return str.replace(/{{\s*(\w+)\s*}}/g, (_, token) => {
    const value = vars[token];
    return value !== undefined && value !== null ? String(value) : "";
  });
}

export const TEMPLATE_DEFAULTS = DEFAULTS;
