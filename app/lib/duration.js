// Computes the end Date for a job booking. Minutes/hours are always linear
// time. For days/weeks/months, if includeWeekends is false, Saturdays and
// Sundays don't count toward the duration (so "1 week" = 5 working days).
export function computeScheduleEnd(start, durationValue, durationUnit, includeWeekends = true) {
  const n = Number(durationValue) || 0;

  if (durationUnit === "minutes" || durationUnit === "hours") {
    const hours = durationUnit === "minutes" ? n / 60 : n;
    return new Date(start.getTime() + hours * 60 * 60 * 1000);
  }

  let totalDays;
  if (durationUnit === "weeks") totalDays = n * 7;
  else if (durationUnit === "months") totalDays = n * 30;
  else totalDays = n; // "days"

  if (includeWeekends) {
    return new Date(start.getTime() + totalDays * 24 * 60 * 60 * 1000);
  }

  // Step forward day by day, only counting Mon-Fri toward the duration
  let remaining = totalDays;
  let current = new Date(start);
  while (remaining > 0) {
    current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
    const day = current.getDay(); // 0 = Sunday, 6 = Saturday
    if (day !== 0 && day !== 6) {
      remaining -= 1;
    }
  }
  return current;
}
