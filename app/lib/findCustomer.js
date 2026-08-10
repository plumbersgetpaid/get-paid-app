// Looks for an existing customer to reuse, but only on a genuinely strong
// signal: an exact match on BOTH email and phone. Anything weaker (just an
// email, just a phone, or just a name) creates a new customer instead -
// the duplicate-flagging system on the Clients pages will pick up any
// real duplicate for a human to review and merge, which is safer than the
// system silently deciding two records are the same person and attaching
// a job to the wrong one.
export async function findExistingCustomer(db, { email, phone }) {
  const trimmedEmail = (email || "").trim();
  const trimmedPhone = (phone || "").trim();

  if (!trimmedEmail || !trimmedPhone) {
    return null;
  }

  try {
    const { data, error } = await db
      .from("customers")
      .select("*")
      .ilike("email", trimmedEmail)
      .eq("phone", trimmedPhone)
      .limit(1)
      .maybeSingle();
    if (error) console.error("findExistingCustomer lookup error:", error);
    if (data) return data;
  } catch (e) {
    console.error("findExistingCustomer lookup threw:", e);
  }

  return null;
}
