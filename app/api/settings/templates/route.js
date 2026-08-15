import { getCurrentTeamMember } from "../../../lib/auth";
import { canSeeEverything } from "../../../lib/permissions";
import { getScopedDb } from "../../../lib/scopedSupabaseClient";
import { NextResponse } from "next/server";

export async function POST(req) {
  const currentMember = await getCurrentTeamMember();
  if (!canSeeEverything(currentMember)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const form = await req.formData();
  const key = form.get("key");
  const subject = (form.get("subject") || "").toString();
  const body = (form.get("body") || "").toString();

  if (!key || !body.trim()) {
    return NextResponse.json({ error: "Missing key or body" }, { status: 400 });
  }

  const db = await getScopedDb(currentMember);
  const { error } = await db.from("message_templates").upsert(
    {
      key,
      business_id: currentMember.business_id,
      subject,
      body,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "business_id,key" }
  );

  if (error) {
    console.error("Save template error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
