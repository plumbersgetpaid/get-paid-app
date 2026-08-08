"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{
        display: "block",
        width: "100%",
        background: "#111",
        color: "white",
        border: "none",
        padding: "14px",
        borderRadius: 10,
        fontWeight: 600,
        fontSize: 15,
        cursor: "pointer",
      }}
    >
      Download as PDF
    </button>
  );
}
