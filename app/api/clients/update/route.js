import { getCurrentTeamMember } from "../../../lib/auth";
import { canSeeClientDatabase } from "../../../lib/permissions";
import { getScopedDb } from "../../../lib/scopedSupabaseClient";
import { NextResponse } from "next/server";

export async function POST(req) {
  const currentMember = await getCurrentTeamMember();
  if (!canSeeClientDatabase(currentMember)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const form = await req.formData();
  const customerId = form.get("customerId");
  const name = (form.get("name") || "").toString().trim();
  const phone = (form.get("phone") || "").toString().trim();
  const email = (form.get("email") || "").toString().trim();
  const address = (form.get("address") || "").toString().trim();

  if (!customerId || !name) {
    return NextResponse.json({ error: "Missing customerId or name" }, { status: 400 });
  }

  const db = await getScopedDb(currentMember);
  const { error } = await db
    .from("customers")
    .update({
      name,
      phone: phone || null,
      email: email || null,
      address: address || null,
    })
    .eq("id", customerId);

  if (error) {
    console.error("Update client error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.redirect(new URL(`/clients/${customerId}`, req.url));
}
