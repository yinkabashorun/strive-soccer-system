// The line at the bottom of Settings: the app's version and its build
// number, so "which build are you on?" has an answer on the phone itself.
// The build number is the one typed into the TestFlight workflow; it is
// written into app.json before the app is built.
export function versionLine(version?: string | null, build?: string | null): string {
  const v = version?.trim();
  const b = build?.trim();
  return ["Strive Elite", v || null, b ? `(${b})` : null].filter(Boolean).join(" ");
}
