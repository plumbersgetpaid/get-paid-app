"use client";

export default function DeleteJobButton({ jobId }) {
  function handleSubmit(e) {
    const confirmed = window.confirm(
      "Delete this job permanently? This can't be undone - the client record stays, but this job and its notes/photos are gone for good."
    );
    if (!confirmed) {
      e.preventDefault();
    }
  }

  return (
    <form action="/api/jobs/delete" method="POST" onSubmit={handleSubmit}>
      <input type="hidden" name="jobId" value={jobId} />
      <button type="submit" style={deleteButtonStyle}>
        🗑️ Delete this job permanently
      </button>
    </form>
  );
}

const deleteButtonStyle = {
  width: "100%",
  display: "block",
  textAlign: "center",
  background: "white",
  color: "#b91c1c",
  border: "1px solid #fca5a5",
  padding: "14px",
  borderRadius: 10,
  fontWeight: 600,
  fontSize: 15,
};
