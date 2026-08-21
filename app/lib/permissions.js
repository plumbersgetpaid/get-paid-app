// Single, shared definition of "this person can see everything" - money,
// invoices, all jobs regardless of assignment, clients, settings. Kept
// in one place so every page checks the same rule the same way, rather
// than each page re-implementing its own version of "is this an owner or
// manager" that could quietly drift out of sync with the others over
// time.
export function canSeeEverything(member) {
  return member?.role === "owner" || member?.role === "manager";
}

// The human label for a role. The stored value stays "subcontractor" (changing
// it would break every existing row and all the role checks), but it's shown
// to users as "Team member" - clearer for construction, where "subcontractor"
// specifically means an external CIS trade, yet the role covers all non-manager
// staff. Use this anywhere a role is displayed, never the raw value.
export function roleLabel(role) {
  if (role === "subcontractor") return "Team member";
  if (role === "manager") return "Manager";
  if (role === "owner") return "Owner";
  return role || "";
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

// Deliberately NOT based on canSeeEverything() or any business role - a
// business owner has full control over their own business, but that's
// not the same thing as being trusted with the platform's own branding,
// which is shared across every business using the app. Only someone
// with is_platform_admin explicitly set true on their team_members row
// gets this - granted by hand via SQL, not through any UI, since it's
// meant to stay rare.
export function isPlatformAdmin(member) {
  return !!member?.is_platform_admin;
}
