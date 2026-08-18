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
  const name = (form.get("name") || "").toString().trim();
  const phone = (form.get("phone") || "").toString().trim();
  const email = (form.get("email") || "").toString().trim();
  const address = (form.get("address") || "").toString().trim();

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const db = await getScopedDb(currentMember);
  const { error } = await db.from("customers").insert({
    name,
    phone: phone || null,
    email: email || null,
    address: address || null,
    business_id: currentMember.business_id,
  });

  if (error) {
    console.error("Create client error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.redirect(new URL("/clients", req.url), 303);
}
