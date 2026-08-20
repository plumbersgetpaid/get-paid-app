import { NextResponse } from "next/server";
import { getCurrentTeamMember } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabaseClient";
import { PATCHUP_GUIDE } from "../../../lib/helpKnowledge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// "Ask PatchUp" — the in-app help assistant. It answers how-to questions about
// using PatchUp, grounded strictly on the guide in lib/helpKnowledge.js, and
// hands anything human (billing, account, legal, bugs) to the PatchUp team.
// Every question is logged (help_questions) as product feedback.
const SYSTEM_PROMPT = `You are "Ask PatchUp", the friendly in-app help assistant inside the PatchUp app for UK tradespeople.

Your job: answer questions about HOW TO USE PatchUp, using ONLY the information in the GUIDE below. Write in warm, plain British English. Keep answers short — a couple of sentences, or a few short numbered steps when explaining how to do something. Sound like a helpful colleague, not a manual.

Hard rules:
- Use ONLY the GUIDE. Never invent features, screens, buttons, prices or steps that aren't in it.
- If the answer isn't in the GUIDE, or you're not sure, say so honestly and suggest they email the PatchUp team at hello@getpatchup.co.uk. Don't guess.
- For anything that needs a person — a billing or payment problem, changing/refunding/cancelling a subscription, account access issues, a bug or something not working, or legal/tax/accounting questions — do NOT try to resolve it yourself. Say something like: "That's one for the PatchUp team — drop them a line at hello@getpatchup.co.uk and they'll get you sorted."
- Only answer questions about PatchUp. If asked something unrelated, gently say you can only help with using PatchUp.
- Never ask for or repeat passwords, card numbers or other sensitive details.

GUIDE:
${PATCHUP_GUIDE}`;

export async function POST(req) {
  const currentMember = await getCurrentTeamMember();
  if (!currentMember) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Help isn't set up yet — email hello@getpatchup.co.uk in the meantime." },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => null);
  const question = (body?.question || "").toString().trim();
  if (!question) {
    return NextResponse.json({ error: "Ask a question first." }, { status: 400 });
  }
  if (question.length > 1000) {
    return NextResponse.json({ error: "That's a bit long — try a shorter question." }, { status: 400 });
  }

  // Keep a little conversation context for follow-ups, but bounded: only the
  // last few turns, only the two valid roles, only string content.
  const history = Array.isArray(body?.history) ? body.history.slice(-6) : [];
  const messages = [];
  for (const m of history) {
    const role = m?.role === "assistant" ? "assistant" : m?.role === "user" ? "user" : null;
    const content = (m?.content || "").toString().trim();
    if (role && content) messages.push({ role, content: content.slice(0, 1000) });
  }
  messages.push({ role: "user", content: question });

  let answer;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });
    const data = await res.json();
    answer = data?.content?.[0]?.text?.trim();
  } catch (e) {
    console.error("Ask PatchUp error:", e);
    return NextResponse.json(
      { error: "Something went wrong — try again, or email hello@getpatchup.co.uk." },
      { status: 500 }
    );
  }

  if (!answer) {
    return NextResponse.json(
      { error: "Couldn't answer that one — email hello@getpatchup.co.uk and the team will help." },
      { status: 502 }
    );
  }

  // Log the question (and answer) as product feedback — best-effort, never
  // blocks the reply. Scoped by business so it's covered by data deletion.
  try {
    const db = supabaseAdmin();
    await db.from("help_questions").insert({
      business_id: currentMember.business_id,
      team_member_id: currentMember.id,
      question,
      answer,
    });
  } catch (e) {
    console.error("Ask PatchUp: question log failed (non-fatal):", e?.message);
  }

  return NextResponse.json({ answer });
}
