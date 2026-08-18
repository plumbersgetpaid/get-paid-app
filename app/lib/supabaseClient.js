import { createClient } from "@supabase/supabase-js";

// There is deliberately no browser-side client here. Nothing in the app
// queries Supabase from the browser - every read goes through a server
// route that checks the session first - and the Aug 2026 audit found the
// anon key could read more than assumed (the outstanding_invoices view,
// plus three tables with RLS never enabled). Server-only access means
// the anon key's reach no longer depends on every table's RLS being
// perfect.

// Used only in server-side code (API routes) - has full access, never expose to browser
export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
