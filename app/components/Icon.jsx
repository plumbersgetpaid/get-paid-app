// Monochrome line icons, replacing the emoji the app used to use.
//
// Emoji were quick to build with and are genuinely legible, but they
// render in each platform's own multicoloured style, which pulled the
// whole app toward "consumer" and away from something a firm would put
// in front of a client. These inherit currentColor instead, so they sit
// inside the black-and-white identity and can be recoloured per state.
//
// All drawn on a 24x24 grid with a 1.7 stroke so they look like one
// family rather than a pile of clip art.

const paths = {
  home: <path d="M3.5 10.5 12 3.5l8.5 7M5.5 9.6V20h13V9.6" />,
  work: (
    <>
      <rect x="5" y="4.5" width="14" height="16" rx="1.6" />
      <path d="M9 3.6h6v2.6H9zM8.6 11h6.8M8.6 15h4.4" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5.5" width="16" height="14.5" rx="1.6" />
      <path d="M4 10h16M8.5 3.5v3M15.5 3.5v3" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M4.8 20c0-3.6 3.2-5.6 7.2-5.6s7.2 2 7.2 5.6" />
    </>
  ),
  // Sliders rather than a cog: at 16px a cog's teeth detach from the
  // body and it starts reading as a sun. Sliders stay legible small.
  settings: (
    <>
      <path d="M4 7h16M4 12h16M4 17h16" />
      <circle cx="9" cy="7" r="2.1" fill="#fff" />
      <circle cx="15" cy="12" r="2.1" fill="#fff" />
      <circle cx="8" cy="17" r="2.1" fill="#fff" />
    </>
  ),
  job: (
    <path d="M15.5 3.5a5 5 0 0 0-6.4 6.4L3.5 15.5a2 2 0 0 0 2.8 2.8l5.6-5.6a5 5 0 0 0 6.4-6.4l-3 3-2.4-2.4z" />
  ),
  pin: (
    <>
      <path d="M12 21s6-5.7 6-10.2A6 6 0 0 0 6 10.8C6 15.3 12 21 12 21z" />
      <circle cx="12" cy="10.6" r="2.2" />
    </>
  ),
  money: (
    <>
      <rect x="2.8" y="6" width="18.4" height="12" rx="1.6" />
      <circle cx="12" cy="12" r="2.6" />
    </>
  ),
  repeat: <path d="M4 9a6 6 0 0 1 10.5-4M20 15a6 6 0 0 1-10.5 4M4 5v4h4M20 19v-4h-4" />,
  doc: (
    <>
      <path d="M13.5 3.5H7a1.6 1.6 0 0 0-1.6 1.6v13.8A1.6 1.6 0 0 0 7 20.5h10a1.6 1.6 0 0 0 1.6-1.6V8.6z" />
      <path d="M13.5 3.5v5h5M8.6 13h6.8M8.6 16.4h4.4" />
    </>
  ),
  warning: <path d="M12 4.2 2.8 19.6h18.4zM12 10v4M12 16.6v.4" />,
  plus: <path d="M12 5.5v13M5.5 12h13" />,
};

export default function Icon({ name, size = 19, color = "currentColor", strokeWidth = 1.7 }) {
  const d = paths[name];
  if (!d) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      {d}
    </svg>
  );
}
