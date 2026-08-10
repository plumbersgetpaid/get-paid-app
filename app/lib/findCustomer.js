// Looks for an existing customer matching by email or phone first (the
// most reliable signal that this is genuinely the same person), falling
// back to an exact name match only if neither was provided. Returns the
// matching customer row, or null if nothing matches.
export async function findExistingCustomer(db, { name, email, phone }) {
  const trimmedEmail = (email || "").trim();
  const trimmedPhone = (phone || "").trim();

  if (trimmedEmail || trimmedPhone) {
    const orParts = [];
    if (trimmedEmail) orParts.push(`email.ilike.${trimmedEmail}`);
    if (trimmedPhone) orParts.push(`phone.eq.${trimmedPhone}`);

    const { data } = await db
      .from("customers")
      .select("*")
      .or(orParts.join(","))
      .limit(1)
      .maybeSingle();

    if (data) return data;
  }

  const trimmedName = (name || "").trim();
  if (trimmedName) {
    const { data } = await db
      .from("customers")
      .select("*")
      .ilike("name", trimmedName)
      .limit(1)
      .maybeSingle();

    if (data) return data;
  }

  return null;
}
