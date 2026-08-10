// Returns today's date as YYYY-MM-DD in UK time (accounting for BST),
// regardless of what timezone the server process itself happens to be
// running in - Vercel's servers typically run in plain UTC with no
// daylight-saving adjustment, which can be up to an hour off real UK time.
export function getTodayInLondon() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
}
