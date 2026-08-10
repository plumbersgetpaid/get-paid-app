// Looks for an existing customer matching by email or phone first (the
// most reliable signal that this is genuinely the same person), falling
// back to an exact name match only if neither was provided. Returns the
// matching customer row, or null if nothing matches.
//
// Uses separate, safe query-builder lookups rather than a single combined
// filter string - combined filters can silently misbehave on values
// containing dots (very common in real email addresses), and a failure
// here should never be allowed to block the customer/job being created.
export async function findExistingCustomer(db, { name, email, phone }) {
  const trimmedEmail = (email || "").trim();
  const trimmedPhone = (phone || "").trim();
  const trimmedName = (name || "").trim();

  if (trimmedEmail) {
    try {
      const { data, error } = await db
        .from("customers")
        .select("*")
        .ilike("email", trimmedEmail)
        .limit(1)
        .maybeSingle();
      if (error) console.error("findExistingCustomer email lookup error:", error);
      if (data) return data;
    } catch (e) {
      console.error("findExistingCustomer email lookup threw:", e);
    }
  }

  if (trimmedPhone) {
    try {
      const { data, error } = await db
        .from("customers")
        .select("*")
        .eq("phone", trimmedPhone)
        .limit(1)
        .maybeSingle();
      if (error) console.error("findExistingCustomer phone lookup error:", error);
      if (data) return data;
    } catch (e) {
      console.error("findExistingCustomer phone lookup threw:", e);
    }
  }

  if (trimmedName) {
    try {
      const { data, error } = await db
        .from("customers")
        .select("*")
        .ilike("name", trimmedName)
        .limit(1)
        .maybeSingle();
      if (error) console.error("findExistingCustomer name lookup error:", error);
      if (data) return data;
    } catch (e) {
      console.error("findExistingCustomer name lookup threw:", e);
    }
  }

  return null;
}
