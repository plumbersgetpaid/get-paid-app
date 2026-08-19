"use client";

import { useEffect, useState } from "react";

// A hidden request_id for retry protection (see lib/idempotency.js).
//
// Generated once per mounted form: hammering submit, a browser resubmit,
// or a flaky connection retrying all send the SAME id, so the server runs
// the action once. Loading the page again mounts a fresh field with a new
// id, so intentionally repeating an action still works.
//
// Set in an effect rather than at render, so the server-rendered HTML and
// the hydrated client agree (an empty value until mount just means those
// few milliseconds fall back to no-dedup, same as before this existed).
export default function RequestIdField() {
  const [id, setId] = useState("");
  useEffect(() => {
    setId(crypto.randomUUID());
  }, []);
  return <input type="hidden" name="request_id" value={id} readOnly />;
}
