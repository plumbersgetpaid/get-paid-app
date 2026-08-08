import { supabaseAdmin } from "../../../lib/supabaseClient";
import { NextResponse } from "next/server";

export async function POST(req) {
  const form = await req.formData();
  const jobId = form.get("jobId");

  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  const db = supabaseAdmin();

  const { error } = await db
    .from("jobs")
    .update({ status: "declined", declined_at: new Date().toISOString() })
    .eq("id", jobId);

  if (error) {
    console.error("Decline quote error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.redirect(new URL("/", req.url));
}
