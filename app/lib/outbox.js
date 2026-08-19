import { outboxPut, outboxAll, outboxDelete } from "./fieldPackStore";

// The offline outbox: field actions performed with no signal, stored on
// the device and replayed when the connection returns.
//
// Safety rests on two things. Each entry carries the request_id the
// action would have sent anyway, so a replay the server already received
// (response lost mid-flight) is answered once and never applied twice
// (see lib/idempotency.js). And a server REJECTION is never silently
// dropped - the entry is marked failed with the server's reason and shown
// on /field for the person to retry or discard.

const MAX_ENTRIES = 50;

// Queue an action from the FormData it would have posted. File values are
// stored as blobs (IndexedDB structured-clones them); everything else as
// strings. Returns false when the outbox is full.
export async function queueAction({ requestId, endpoint, label, formData }) {
  const all = await outboxAll();
  if (all.length >= MAX_ENTRIES) return false;

  const fields = [];
  const files = [];
  for (const [name, value] of formData.entries()) {
    if (typeof value === "string") fields.push([name, value]);
    else files.push({ name, fileName: value.name || "photo.jpg", type: value.type, blob: value });
  }

  await outboxPut({
    requestId,
    endpoint,
    label,
    fields,
    files,
    createdAt: new Date().toISOString(),
    status: "pending",
    error: null,
  });
  return true;
}

export const listOutbox = async () =>
  (await outboxAll()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));

export const countPending = async () =>
  (await outboxAll()).filter((e) => e.status === "pending").length;

export const removeOutboxEntry = outboxDelete;

export async function retryOutboxEntry(requestId) {
  const all = await outboxAll();
  const entry = all.find((e) => e.requestId === requestId);
  if (!entry) return;
  entry.status = "pending";
  entry.error = null;
  await outboxPut(entry);
  return syncOutbox();
}

let syncing = false;

// Replays pending entries oldest-first. Stops at the first sign of being
// offline (retry next time) or of an expired session (sending someone
// else's saved work after a login change would be wrong - the person is
// asked to log in first).
export async function syncOutbox() {
  if (syncing) return { busy: true };
  syncing = true;
  try {
    const entries = (await listOutbox()).filter((e) => e.status === "pending");
    let sent = 0;

    for (const entry of entries) {
      const formData = new FormData();
      for (const [name, value] of entry.fields) formData.append(name, value);
      for (const f of entry.files) formData.append(f.name, f.blob, f.fileName);

      let res;
      try {
        res = await fetch(entry.endpoint, { method: "POST", body: formData });
      } catch {
        return { sent, offline: true }; // still no signal - try again later
      }

      // The proxy answers an expired session with a redirect to /login;
      // fetch follows it, so a "successful" response can actually be the
      // login page. That must never count as delivered.
      if (res.redirected && new URL(res.url).pathname.startsWith("/login")) {
        return { sent, authNeeded: true };
      }

      if (res.ok) {
        await outboxDelete(entry.requestId);
        sent += 1;
        continue;
      }

      let reason = `Server said no (${res.status})`;
      try {
        const data = await res.json();
        if (data?.error) reason = data.error;
      } catch {}
      entry.status = "failed";
      entry.error = reason;
      await outboxPut(entry);
      // keep going - one rejected entry shouldn't strand the rest
    }

    return { sent };
  } finally {
    syncing = false;
  }
}
