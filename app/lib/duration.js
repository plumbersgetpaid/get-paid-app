// Converts a duration value + unit into total hours, for scheduling maths.
// "months" is approximated as 30 days - fine for job-duration estimates,
// not meant for precise calendar arithmetic.
export function durationToHours(value, unit) {
  const n = Number(value) || 0;
  switch (unit) {
    case "minutes":
      return n / 60;
    case "hours":
      return n;
    case "days":
      return n * 24;
    case "weeks":
      return n * 24 * 7;
    case "months":
      return n * 24 * 30;
    default:
      return n;
  }
}
