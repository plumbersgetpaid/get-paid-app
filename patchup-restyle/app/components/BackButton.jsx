"use client";

import { useRouter } from "next/navigation";

export default function BackButton({
  fallbackHref = "/",
  style,
  children = "←",
  forceFresh = false,
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (forceFresh) {
          // Skip Next's client-side "back" navigation entirely and do a
          // real hard reload instead. Used on pages where something might
          // have just changed that the destination needs to reflect
          // straight away - Next's client-side router cache can otherwise
          // serve a stale version of wherever you're going back to.
          window.location.href = fallbackHref;
          return;
        }
        if (window.history.length > 1) {
          router.back();
        } else {
          router.push(fallbackHref);
        }
      }}
      aria-label="Back"
      style={style || backButtonStyle}
    >
      {children}
    </button>
  );
}

const backButtonStyle = {
  background: "white",
  border: "1px solid #e2e2e2",
  borderRadius: 2,
  width: 36,
  height: 36,
  fontSize: 18,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  color: "#000",
};
