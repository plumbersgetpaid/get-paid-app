export function canSeeEverything(member) {
  return member?.role === "owner" || member?.role === "manager";
}
