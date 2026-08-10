// Returns the "from" address used for every outgoing email. Defaults to
// Resend's shared testing address, which works fine for development but
// is more likely to be flagged as spam for real customer emails, since it
// pairs a business name with an unrelated shared testing domain.
//
// Once a domain is verified with Resend, set RESEND_FROM_ADDRESS in Vercel
// (e.g. "noreply@yourbusiness.co.uk") and every email switches over
// automatically - no code changes needed.
export function getEmailFrom(businessName) {
  const address = process.env.RESEND_FROM_ADDRESS || "onboarding@resend.dev";
  return `${businessName} <${address}>`;
}
