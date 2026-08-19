import { getCurrentTeamMember } from "../../../lib/auth";
import { canSeeClientDatabase } from "../../../lib/permissions";
import { getScopedDb } from "../../../lib/scopedSupabaseClient";
import { NextResponse } from "next/server";
import { claimRequest, releaseRequest } from "../../../lib/idempotency";

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

  // Retry protection: a resend of this exact action - flaky signal,
  // double-tap, browser resubmit, offline replay - is answered with the
  // success response instead of running twice. See lib/idempotency.js.
  const claim = await claimRequest(form.get("request_id"), currentMember.business_id, "clients/create");
  if (claim.duplicate) {
    return NextResponse.redirect(new URL("/clients", req.url), 303);
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
    await releaseRequest(claim);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.redirect(new URL("/clients", req.url), 303);
}
