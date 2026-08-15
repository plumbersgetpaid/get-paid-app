// Single, shared definition of "this person can see everything" - money,
// invoices, all jobs regardless of assignment, clients, settings. Kept
// in one place so every page checks the same rule the same way, rather
// than each page re-implementing its own version of "is this an owner or
// manager" that could quietly drift out of sync with the others over
// time.
export function canSeeEverything(member) {
  return member?.role === "owner" || member?.role === "manager";
}

// Below this point: per-capability checks for a subcontractor. Every one
// of these is owner/manager-first - canSeeEverything() short-circuits to
// true before the specific column is even looked at, so an owner or
// manager is never affected by these at all, regardless of what's set on
// their own row (which for them is meaningless anyway - the column only
// has real effect on a subcontractor's own row).
//
// Each function name matches its own database column 1:1 deliberately -
// canInvoice() reads can_invoice, canReschedule() reads can_reschedule,
// and so on - so there's no separate mapping to keep in sync by hand
// between what's stored and what's checked.

export function canInvoice(member) {
  return canSeeEverything(member) || !!member?.can_invoice;
}

export function canSeeClientDatabase(member) {
  return canSeeEverything(member) || !!member?.can_see_client_database;
}

export function canCreateQuote(member) {
  return canSeeEverything(member) || !!member?.can_create_quote;
}

export function canCreateJob(member) {
  return canSeeEverything(member) || !!member?.can_create_job;
}

export function canCreateRecurringJob(member) {
  return canSeeEverything(member) || !!member?.can_create_recurring_job;
}

export function canReschedule(member) {
  return canSeeEverything(member) || !!member?.can_reschedule;
}
