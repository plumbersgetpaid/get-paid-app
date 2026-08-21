"use client";

import { useState, useRef, useEffect } from "react";

const EXAMPLES = [
  "How do I send a quote?",
  "How does chasing an unpaid invoice work?",
  "How do I add someone to my team?",
  "Can my team member see prices?",
];

export default function AskPatchUp() {
  const [messages, setMessages] = useState([]); // {role, content}
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function ask(question) {
    const q = question.trim();
    if (!q || busy) return;
    setError("");
    const priorHistory = messages;
    setMessages((m) => [...m, { role: "user", content: q }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/help/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, history: priorHistory }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Something went wrong. Try again.");
      } else {
        setMessages((m) => [...m, { role: "assistant", content: data.answer }]);
      }
    } catch {
      setError("Couldn't reach the server. Check your signal and try again.");
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ask(input);
    }
  }

  const empty = messages.length === 0;

  return (
    <section style={wrap}>
      <div ref={scrollRef} style={thread} aria-live="polite">
        {empty && (
          <div style={intro}>
            <p style={{ margin: "0 0 4px", fontWeight: 500, fontSize: 15 }}>
              Ask me anything about using PatchUp
            </p>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: "#6b6b6b" }}>
              I can explain how any feature works. For billing, account or
              anything not working, I&apos;ll point you to the PatchUp team.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {EXAMPLES.map((ex) => (
                <button key={ex} type="button" onClick={() => ask(ex)} style={chip}>
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={m.role === "user" ? userBubble : botBubble}>{m.content}</div>
          </div>
        ))}

        {busy && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{ ...botBubble, color: "#999" }}>Thinking…</div>
          </div>
        )}
      </div>

      {error && <div style={errorBox}>{error}</div>}

      <div style={inputRow}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type your question…"
          rows={1}
          style={textarea}
          disabled={busy}
        />
        <button type="button" onClick={() => ask(input)} disabled={busy || !input.trim()} style={sendBtn}>
          Send
        </button>
      </div>
    </section>
  );
}

const wrap = { display: "flex", flexDirection: "column", gap: 10, marginTop: 8 };
const thread = {
  background: "white",
  border: "1px solid #e2e2e2",
  borderRadius: 6,
  padding: 14,
  minHeight: 300,
  maxHeight: "58vh",
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: 10,
};
const intro = { padding: "6px 2px" };
const chip = {
  background: "#f5f5f4",
  border: "1px solid #e2e2e2",
  borderRadius: 999,
  padding: "8px 12px",
  fontSize: 13,
  color: "#000",
  cursor: "pointer",
  textAlign: "left",
};
const bubbleBase = {
  maxWidth: "85%",
  padding: "10px 13px",
  borderRadius: 12,
  fontSize: 14,
  lineHeight: 1.5,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};
const userBubble = { ...bubbleBase, background: "#000", color: "white", borderBottomRightRadius: 3 };
const botBubble = { ...bubbleBase, background: "#f5f5f4", color: "#111", borderBottomLeftRadius: 3 };
const errorBox = {
  background: "#fee2e2",
  color: "#991b1b",
  padding: 12,
  borderRadius: 4,
  fontSize: 13,
};
const inputRow = { display: "flex", gap: 8, alignItems: "flex-end" };
const textarea = {
  flex: 1,
  padding: "12px",
  borderRadius: 6,
  border: "1px solid #e2e2e2",
  fontSize: 15,
  fontFamily: "inherit",
  resize: "none",
  maxHeight: 120,
};
const sendBtn = {
  background: "#000",
  color: "white",
  padding: "12px 18px",
  borderRadius: 6,
  border: "none",
  fontWeight: 500,
  fontSize: 14,
  cursor: "pointer",
  whiteSpace: "nowrap",
};
