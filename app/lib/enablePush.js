// Turning on push for this device, shared by the account-page toggle and
// the one-time nudge banner. Returns:
//   { ok: true }        subscribed and registered with the server
//   { denied: true }    the person said no in the browser prompt (final -
//                       the browser won't ask again; only they can undo it
//                       in settings)
//   { error: string }   anything else, human-readable
export function urlBase64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function enablePushOnThisDevice(vapidPublicKey) {
  if (!vapidPublicKey) return { error: "Notifications aren't set up on the server yet." };
  try {
    const permission = await Notification.requestPermission();
    if (permission === "denied") return { denied: true };
    if (permission !== "granted") return { error: "Notifications weren't allowed." };

    const reg = await navigator.serviceWorker.ready;
    let sub;
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
    } catch {
      // A leftover subscription on a rotated key blocks new ones - clear
      // it and try once more.
      const stale = await reg.pushManager.getSubscription();
      if (stale) await stale.unsubscribe().catch(() => {});
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
    }

    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sub),
    });
    if (!res.ok) return { error: "Couldn't save this device. Try again." };
    return { ok: true };
  } catch (e) {
    console.error("Enable push failed:", e);
    // Surface what actually went wrong - "try again" against a permanent
    // condition (private window, push service unreachable) just loops.
    const detail = e?.message || e?.name || "";
    if (/denied|permission/i.test(detail)) {
      return { denied: true };
    }
    return {
      error: `Couldn't turn notifications on${detail ? ` (${detail})` : ""}. Private/incognito windows can't receive notifications - use a normal window.`,
    };
  }
}
