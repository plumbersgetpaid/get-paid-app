import { NextResponse } from "next/server";

export async function POST(req) {
  const form = await req.formData();
  const jobId = form.get("jobId");
  const dueDate = (form.get("dueDate") || "").toString();
  const amount = (form.get("amount") || "").toString();
  const note = (form.get("note") || "").toString().trim();

  const redirectUrl = new URL(`/jobs/complete/${jobId}`, req.url);
  if (dueDate) redirectUrl.searchParams.set("dueDate", dueDate);
  if (amount) redirectUrl.searchParams.set("amount", amount);

  // Nothing to enhance, or no API key set up yet - just bounce back with
  // whatever was typed, unchanged
  if (!note || !process.env.ANTHROPIC_API_KEY) {
    if (note) redirectUrl.searchParams.set("note", note);
    if (!process.env.ANTHROPIC_API_KEY) {
      redirectUrl.searchParams.set("aiError", "1");
    }
    return NextResponse.redirect(redirectUrl);
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

    redirectUrl.searchParams.set("note", enhanced || note);
  } catch (e) {
    console.error("AI enhance-note error:", e);
    redirectUrl.searchParams.set("note", note);
    redirectUrl.searchParams.set("aiError", "1");
  }

  return NextResponse.redirect(redirectUrl);
}
