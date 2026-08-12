"use client";

import { useRef, useState } from "react";

export default function VoiceQuoteAssist({
  initialJobType = "",
  initialAmount = "",
  initialLocation = "",
}) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState(null);
  const [jobType, setJobType] = useState(initialJobType);
  const [amount, setAmount] = useState(initialAmount);
  const [location, setLocation] = useState(initialLocation);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = handleRecordingStop;

      recorder.start();
      setRecording(true);
    } catch (e) {
      console.error("Mic error:", e);
      setError(
        "Couldn't access your microphone - check your browser's permissions, or just type the details below."
      );
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    setRecording(false);
  }

  async function handleRecordingStop() {
    setProcessing(true);
    setError(null);

    const mimeType = mediaRecorderRef.current?.mimeType || "audio/webm";
    const blob = new Blob(chunksRef.current, { type: mimeType });
    const ext = mimeType.includes("mp4") ? "mp4" : "webm";

    const formData = new FormData();
    formData.append("audio", blob, `note.${ext}`);

    try {
      const res = await fetch("/api/quotes/voice-to-quote", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong with that recording.");
      } else {
        setTranscript(data.transcript || "");
        if (data.jobType) setJobType(data.jobType);
        if (data.amount !== null && data.amount !== undefined) {
          setAmount(String(data.amount));
        }
      }
    } catch (e) {
      console.error("Voice upload error:", e);
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setProcessing(false);
    }
  }

  async function enhanceDescription() {
    if (!jobType.trim()) return;
    setEnhancing(true);
    setError(null);
    try {
      const res = await fetch("/api/quotes/enhance-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobType }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Couldn't enhance that description.");
      } else if (data.jobType) {
        setJobType(data.jobType);
      }
    } catch (e) {
      console.error("Enhance error:", e);
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setEnhancing(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <button
        type="button"
        onClick={recording ? stopRecording : startRecording}
        disabled={processing}
        style={recording ? recordingButtonStyle : recordButtonStyle}
      >
        {processing
          ? "Processing recording..."
          : recording
          ? "⏺ Stop recording"
          : "🎙️ Record voice note"}
      </button>

      {error && <div style={errorBoxStyle}>{error}</div>}

      {transcript && (
        <div style={transcriptBoxStyle}>
          <strong>Heard:</strong> {transcript}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <input
          name="jobType"
          placeholder="Job type (e.g. Boiler service)"
          value={jobType}
          onChange={(e) => setJobType(e.target.value)}
          style={{ ...inputStyle, flex: 1 }}
        />
        <button
          type="button"
          onClick={enhanceDescription}
          disabled={enhancing || !jobType.trim()}
          style={enhanceButtonStyle}
        >
          {enhancing ? "..." : "✨"}
        </button>
      </div>
      <input
        name="amount"
        type="number"
        step="0.01"
        placeholder="Quoted amount (£)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
        style={inputStyle}
      />
      <textarea
        name="location"
        placeholder="Job location / address (optional)"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        rows={2}
        style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
      />
    </div>
  );
}

const inputStyle = {
  padding: "12px",
  borderRadius: 8,
  border: "1px solid #ddd",
  fontSize: 15,
  width: "100%",
  boxSizing: "border-box",
};

const recordButtonStyle = {
  background: "white",
  color: "#111",
  border: "1px solid #ddd",
  padding: "12px",
  borderRadius: 10,
  fontWeight: 600,
  fontSize: 14,
};

const recordingButtonStyle = {
  background: "#fee2e2",
  color: "#991b1b",
  border: "1px solid #fca5a5",
  padding: "12px",
  borderRadius: 10,
  fontWeight: 600,
  fontSize: 14,
};

const enhanceButtonStyle = {
  background: "white",
  color: "#111",
  border: "1px solid #ddd",
  padding: "12px 14px",
  borderRadius: 10,
  fontWeight: 600,
  fontSize: 16,
};

const errorBoxStyle = {
  background: "#fee2e2",
  color: "#991b1b",
  padding: 10,
  borderRadius: 8,
  fontSize: 13,
};

const transcriptBoxStyle = {
  background: "#f3f4f6",
  color: "#444",
  padding: 10,
  borderRadius: 8,
  fontSize: 13,
};
