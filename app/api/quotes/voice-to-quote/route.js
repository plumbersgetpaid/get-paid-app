import { NextResponse } from "next/server";

export async function POST(req) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "Voice notes aren't set up yet - add OPENAI_API_KEY in Vercel." },
      { status: 400 }
    );
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "AI isn't set up yet - add ANTHROPIC_API_KEY in Vercel." },
      { status: 400 }
    );
  }

  const form = await req.formData();
  const audio = form.get("audio");

  if (!audio || typeof audio === "string") {
    return NextResponse.json({ error: "No audio received" }, { status: 400 });
  }

  try {
    // 1. Transcribe the audio with OpenAI
    const whisperForm = new FormData();
    whisperForm.append("file", audio, audio.name || "note.webm");
    whisperForm.append("model", "gpt-4o-mini-transcribe");

    const transcribeRes = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: whisperForm,
      }
    );

    if (!transcribeRes.ok) {
      const errText = await transcribeRes.text();
      console.error("Transcription error:", errText);
      return NextResponse.json(
        { error: "Couldn't transcribe that recording. Try again or type it instead." },
        { status: 400 }
      );
    }

    const transcribeData = await transcribeRes.json();
    const transcript = (transcribeData.text || "").trim();

    if (!transcript) {
      return NextResponse.json(
        { error: "Didn't catch anything in that recording - try again." },
        { status: 400 }
      );
    }

    // 2. Ask Claude to pull out a job type and a price from the transcript
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
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
            content: `A UK tradesperson recorded a rough spoken voice note describing a job they're about to quote for. Turn it into two fields for a quote form. Reply with ONLY a JSON object, no markdown fences, no explanation, in this exact shape: {"jobType": "short professional description of the job, a few words to one short sentence", "amount": a plain number with no currency symbol if a price was mentioned, otherwise null}. Do not invent a price if none was said.\n\nTranscript: "${transcript}"`,
          },
        ],
      }),
    });

    const claudeData = await claudeRes.json();
    const rawText = claudeData?.content?.[0]?.text || "{}";
    const cleaned = rawText.replace(/```json|```/g, "").trim();

    let jobType = null;
    let amount = null;
    try {
      const parsed = JSON.parse(cleaned);
      jobType = parsed.jobType || null;
      amount = parsed.amount ?? null;
    } catch (e) {
      console.error("Could not parse AI extraction result:", rawText);
    }

    return NextResponse.json({ transcript, jobType, amount });
  } catch (e) {
    console.error("Voice-to-quote error:", e);
    return NextResponse.json(
      { error: "Something went wrong processing that recording." },
      { status: 500 }
    );
  }
}
