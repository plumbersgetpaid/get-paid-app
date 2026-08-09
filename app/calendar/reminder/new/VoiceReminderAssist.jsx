"use client";

import { useRef, useState } from "react";

export default function VoiceReminderAssist({
  initialTitle = "",
  initialNotes = "",
  initialDate = "",
  initialTime = "09:00",
  initialDuration = "0.5",
  initialDurationUnit = "hours",
}) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState(null);

  const [title, setTitle] = useState(initialTitle);
  const [notes, setNotes] = useState(initialNotes);
  const [startDate, setStartDate] = useState(initialDate);
  const [startTime, setStartTime] = useState(initialTime);
  const [duration, setDuration] = useState(initialDuration);
  const [durationUnit, setDurationUnit] = useState(initialDurationUnit);

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
        "Couldn't access your microphone - check permissions, or fill this in manually below."
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
      const res = await fetch("/api/calendar/reminder/voice", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong with that recording.");
      } else {
        setTranscript(data.transcript || "");
        if (data.title) setTitle(data.title);
        if (data.notes) setNotes(data.notes);
        if (data.startDate) setStartDate(data.startDate);
        if (data.startTime) setStartTime(data.startTime);
        if (data.durationValue !== null && data.durationValue !== undefined) {
          setDuration(String(data.durationValue));
        }
        if (data.durationUnit) setDurationUnit(data.durationUnit);
      }
    } catch (e) {
      console.error("Voice upload error:", e);
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setProcessing(false);
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
          : "🎙️ Add by voice"}
      </button>

      {error && <div style={errorBoxStyle}>{error}</div>}

      {transcript && (
        <div style={transcriptBoxStyle}>
          <strong>Heard:</strong> {transcript}
        </div>
      )}

      <input
        name="title"
        placeholder="What's the reminder? (e.g. Get fuel)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        style={inputStyle}
      />
      <textarea
        name="notes"
        placeholder="Notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        style={{ ...inputStyle, resize: "vertical" }}
      />

      <div style={{ display: "flex", gap: 10 }}>
        <label style={{ flex: 1, fontSize: 12, color: "#666" }}>
          Date
          <input
            type="date"
            name="startDate"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
            style={inputStyle}
          />
        </label>
        <label style={{ flex: 1, fontSize: 12, color: "#666" }}>
          Time
          <input
            type="time"
            name="startTime"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
            style={inputStyle}
          />
        </label>
      </div>

      <label style={{ fontSize: 12, color: "#666" }}>
        Duration
        <div style={{ display: "flex", gap: 10 }}>
          <input
            type="number"
            name="durationValue"
            min="0.25"
            step="0.25"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            required
            style={{ ...inputStyle, flex: 2 }}
          />
          <select
            name="durationUnit"
            value={durationUnit}
            onChange={(e) => setDurationUnit(e.target.value)}
            style={{ ...inputStyle, flex: 1 }}
          >
            <option value="minutes">Minutes</option>
            <option value="hours">Hours</option>
            <option value="days">Days</option>
            <option value="weeks">Weeks</option>
            <option value="months">Months</option>
          </select>
        </div>
      </label>
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
  marginTop: 4,
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
