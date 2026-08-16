"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// If this page gets shown via the browser's back/forward cache (e.g. after
// submitting a form and then pressing Back), force a fresh re-fetch of
// this route's data instead of silently showing a stale snapshot.
// router.refresh() rather than a full window.location.reload() - the
// same route-level refresh already used elsewhere for this exact
// purpose, without the side effect of reloading the entire browser tab.
//
// Deliberately a single, page-level component rather than logic
// duplicated inside a component that might itself be rendered many
// times on one page (e.g. once per row in a list) - one listener per
// page, not one per row.
export default function ReloadOnBack() {
  const router = useRouter();

  useEffect(() => {
    function handlePageShow(event) {
      if (event.persisted) {
        router.refresh();
      }
    }
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [router]);

  return null;
}
