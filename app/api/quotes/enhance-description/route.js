import { NextResponse } from "next/server";

export async function POST(req) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "AI isn't set up yet - add ANTHROPIC_API_KEY in Vercel." },
      { status: 400 }
    );
  }

  const { jobType } = await req.json();
  const text = (jobType || "").toString().trim();

  if (!text) {
    return NextResponse.json({ error: "Nothing to enhance" }, { status: 400 });
  }

  try {
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 100,
        messages: [
          {
            role: "user",
            content: `A UK tradesperson typed a rough job description for a customer quote. Rewrite it as a short, professional description (a few words to one short sentence), in plain British English. Do not invent details that aren't there, do not add a price, and reply with ONLY the improved description, nothing else.\n\nRough description: "${text}"`,
          },
        ],
      }),
    });

    const claudeData = await claudeRes.json();
    const enhanced = claudeData?.content?.[0]?.text?.trim();

    return NextResponse.json({ jobType: enhanced || text });
  } catch (e) {
    console.error("Enhance description error:", e);
    return NextResponse.json(
      { error: "Something went wrong enhancing that description." },
      { status: 500 }
    );
  }
}
