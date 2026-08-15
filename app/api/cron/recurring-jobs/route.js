import { supabaseAdmin } from "../../../lib/supabaseClient";
import { getBusinessSettings } from "../../../lib/getBusinessSettings";
import { createRecurringOccurrence } from "../../../lib/createRecurringOccurrence";
import { NextResponse } from "next/server";

export async function GET(req) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = supabaseAdmin();
  const todayStr = new Date().toISOString().slice(0, 10);

  const { data: due } = await db
    .from("recurring_jobs")
    .select("*")
    .eq("active", true)
    .lte("next_occurrence", todayStr);

  const settingsByBusiness = new Map();
  let created = 0;
  for (const r of due || []) {
    if (!settingsByBusiness.has(r.business_id)) {
      settingsByBusiness.set(r.business_id, await getBusinessSettings(r.business_id));
    }
    const settings = settingsByBusiness.get(r.business_id);
    const result = await createRecurringOccurrence(db, settings, r);
    if (result.created) created += 1;
  }

  return NextResponse.json({ ok: true, created });
}
