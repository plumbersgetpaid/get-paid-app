import { NextResponse } from "next/server";
import { getCurrentTeamMember } from "../../../lib/auth";
import { canInvoice } from "../../../lib/permissions";

export async function GET(req) {
  const currentMember = await getCurrentTeamMember();
  if (!canInvoice(currentMember)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") || "pdf";
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const month = searchParams.get("month");

  const target = new URL(
    format === "csv" ? "/api/invoices/export-csv" : "/api/invoices/bulk-pdf",
    req.url
  );
  if (start) target.searchParams.set("start", start);
  if (end) target.searchParams.set("end", end);
  if (month) target.searchParams.set("month", month);

  return NextResponse.redirect(target);
}
