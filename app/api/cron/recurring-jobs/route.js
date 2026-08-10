import { supabaseAdmin } from "../../../lib/supabaseClient";
import { getBusinessSettings } from "../../../lib/getBusinessSettings";
import { createRecurringOccurrence } from "../../../lib/createRecurringOccurrence";
import { NextResponse } from "next/server";

// Designed to be called once a day, early morning, by a scheduler. Creates
// a real job (and optionally an invoice) for every recurring job whose
// next occurrence has arrived, then advances it to the following one.
export async function GET(req) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = supabaseAdmin();
  const todayStr = new Date().toISOString().slice(0, 10);
  const settings = await getBusinessSettings();

  const { data: due } = await db
    .from("recurring_jobs")
    .select("*")
    .eq("active", true)
    .lte("next_occurrence", todayStr);

  let created = 0;
  for (const r of due || []) {
    const result = await createRecurringOccurrence(db, settings, r);
    if (result.created) created += 1;
  }

  return NextResponse.json({ ok: true, created });
}
