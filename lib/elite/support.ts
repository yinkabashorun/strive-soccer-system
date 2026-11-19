// One address for help, used by the Account page, the Support page and the
// legal pages. It is the public contact already printed on the privacy
// policy and the terms.
export const SUPPORT_EMAIL = "coach@strivesoccer100x.com";

// "Report a concern" opens an email with the subject filled in, so a
// report is never mistaken for an ordinary question.
export function concernMailto(name: string): string {
  const subject = `Report a concern${name.trim() ? ` (${name.trim()})` : ""}`;
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}
