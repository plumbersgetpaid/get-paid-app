// Returns today's date as YYYY-MM-DD in UK time (accounting for BST),
// regardless of what timezone the server process itself happens to be
// running in - Vercel's servers typically run in plain UTC with no
// daylight-saving adjustment, which can be up to an hour off real UK time.
export function getTodayInLondon() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
}

// "Now", expressed in the same frame scheduled times are stored in.
//
// scheduled_start / scheduled_end (and personal_events, recurring jobs) are
// written by parsing the user's London wall-clock string on a UTC server -
// new Date(`${date}T${time}:00`) - so a 16:00 London booking is stored as
// 16:00Z. Displays read that back without a timezone, so the user sees
// "16:00" again and everything looks right. The one thing that breaks is
// comparing those values against a real `new Date()`: during BST the stored
// time is an hour behind the true instant, so "running late" and "upcoming"
// flip an hour late for ~7 months of the year.
//
// This returns the current London wall-clock time in that same stored
// frame (wall-clock as if UTC), so comparisons line up all year. It is NOT
// a true instant and must only be compared against these stored wall-clock
// times, never against real UTC timestamps like trial_ends_at.
export function nowInLondonFrame() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  const hour = p.hour === "24" ? "00" : p.hour; // some engines emit 24 at midnight
  return new Date(`${p.year}-${p.month}-${p.day}T${hour}:${p.minute}:${p.second}Z`);
}
