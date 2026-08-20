import { NextResponse } from "next/server";
import { getCurrentTeamMember } from "../../../../lib/auth";

export async function POST(req) {
  // Defense in depth: the proxy already requires a session for this path,
  // but a single-layer gate is fragile - if proxy.js ever fails to load,
  // this must not become an anonymous relay on our API keys. Checked
  // in-route like every other mutating endpoint.
  const currentMember = await getCurrentTeamMember();
  if (!currentMember) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const form = await req.formData();
  const note = (form.get("note") || "").toString().trim();

  // Nothing to enhance, or no API key set up yet - just hand back whatever
  // was typed, unchanged
  if (!note) {
    return NextResponse.json({ note: "" });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ note, error: "AI isn't set up yet" }, { status: 200 });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [
          {
            role: "user",
            content: `A tradesperson adjusted an invoice price from the original quote and jotted a rough note explaining why, to be shown to the customer on the invoice. Rewrite it as a short, professional 1-2 sentence explanation in plain British English. Do not invent any details that aren't in the note, and do not add a greeting or sign-off - reply with only the improved sentence, nothing else.\n\nRough note: "${note}"`,
          },
        ],
      }),
    });

    const data = await response.json();
    const enhanced = data?.content?.[0]?.text?.trim();

    return NextResponse.json({ note: enhanced || note });
  } catch (e) {
    console.error("AI enhance-note error:", e);
    return NextResponse.json({ note, error: "Couldn't reach the AI just now" });
  }
}
