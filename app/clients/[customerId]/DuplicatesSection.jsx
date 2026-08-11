"use client";

import { useState } from "react";
import DuplicateRow from "./DuplicateRow";

export default function DuplicatesSection({ customerId, customerName, initialDuplicates }) {
  const [duplicates, setDuplicates] = useState(initialDuplicates);

  function handleResolved(dupeId) {
    setDuplicates((prev) => prev.filter((d) => d.id !== dupeId));
  }

  if (duplicates.length === 0) return null;

  return (
    <section style={duplicateCardStyle}>
      <div style={{ fontWeight: 700, color: "#b91c1c", marginBottom: 8 }}>
        ⚠️ Possible duplicate{duplicates.length > 1 ? "s" : ""}
      </div>
      {duplicates.map((dupe) => (
        <DuplicateRow
          key={dupe.id}
          customerId={customerId}
          customerName={customerName}
          dupe={dupe}
          onResolved={() => handleResolved(dupe.id)}
        />
      ))}
    </section>
  );
}

const duplicateCardStyle = {
  background: "#fef2f2",
  border: "1px solid #fecaca",
  borderRadius: 12,
  padding: 16,
  marginBottom: 16,
};
