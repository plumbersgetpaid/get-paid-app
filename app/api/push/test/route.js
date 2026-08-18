import { getCurrentTeamMember } from "../../../lib/auth";
import { sendPushToMember } from "../../../lib/push";
import { NextResponse } from "next/server";

// Sends a test notification to the logged-in member's own devices, so they
// can confirm notifications work end to end.
export async function POST() {
  const currentMember = await getCurrentTeamMember();
  if (!currentMember) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  const result = await sendPushToMember(currentMember.id, {
    title: "PatchUp",
    body: "Notifications are on. This is what a nudge looks like.",
    url: "/",
  });
  return NextResponse.json({ ok: true, ...result });
}
