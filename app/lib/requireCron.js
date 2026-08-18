// Shared authorisation for the cron routes.
//
// Every cron route used to hand-roll:
//   if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) ...
// which fails OPEN when CRON_SECRET is unset: the expected value becomes
// the literal string "Bearer undefined", so anyone sending that header is
// authorised - on routes that delete whole businesses and email customers.
//
// This fails CLOSED: no secret configured means nobody gets in, and the
// check lives in one place so a new cron route can't forget it or drift.
export function cronAuthorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET is not set - refusing every cron request");
    return false;
  }
  return req.headers.get("authorization") === `Bearer ${secret}`;
}
