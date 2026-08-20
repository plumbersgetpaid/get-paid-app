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

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "Voice booking isn't set up yet - add OPENAI_API_KEY in Vercel." },
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
        { error: "Couldn't transcribe that recording. Try again or enter it manually." },
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

    const now = new Date();
    const todayLabel = now.toLocaleDateString("en-GB", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

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
            content: `A UK tradesperson is booking a job into their calendar and spoke a rough voice note about when it's happening. Today is ${todayLabel}. Reply with ONLY a JSON object, no markdown fences, no explanation, in this exact shape: {"startDate": "YYYY-MM-DD", "startTime": "HH:MM" (24-hour), "durationValue": a plain number, "durationUnit": "minutes", "hours", "days", "weeks", or "months", "location": "the job's address or location if mentioned, or null"}. Pick whichever unit best matches how they described it. If no duration was mentioned, use 2 hours. If no time was mentioned, use "09:00".\n\nTranscript: "${transcript}"`,
          },
        ],
      }),
    });

    const claudeData = await claudeRes.json();
    const rawText = claudeData?.content?.[0]?.text || "{}";
    const cleaned = rawText.replace(/```json|```/g, "").trim();

    let location = null;
    let startDate = null;
    let startTime = null;
    let durationValue = null;
    let durationUnit = null;
    try {
      const parsed = JSON.parse(cleaned);
      startDate = parsed.startDate || null;
      startTime = parsed.startTime || null;
      durationValue = parsed.durationValue ?? null;
      durationUnit = parsed.durationUnit || null;
      location = parsed.location || null;
    } catch (e) {
      console.error("Could not parse schedule extraction:", rawText);
    }

    return NextResponse.json({
      transcript,
      startDate,
      startTime,
      durationValue,
      durationUnit,
      location,
    });
  } catch (e) {
    console.error("Voice schedule error:", e);
    return NextResponse.json(
      { error: "Something went wrong processing that recording." },
      { status: 500 }
    );
  }
}
