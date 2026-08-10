"use client";

import { useEffect } from "react";

// If this page gets shown via the browser's back/forward cache (e.g. after
// submitting the form and then pressing Back), force a fresh reload instead
// of silently showing the stale, already-submitted form - otherwise
// resubmitting it would create a duplicate entry.
export default function ReloadOnBack() {
  useEffect(() => {
    function handlePageShow(event) {
      if (event.persisted) {
        window.location.reload();
      }
    }
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  return null;
}
