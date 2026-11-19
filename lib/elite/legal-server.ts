// Reading and writing the recorded agreement (elite_consents, 068).
import { createServiceClient } from "./supabase/server";
import { LEGAL_VERSION, needsConsent, type ConsentSource } from "./legal";

// Must this account accept the current Terms before going on? Answers
// "no" whenever the record cannot be read (no database, a failed query),
// so a hiccup can never lock a family out of their training.
export async function consentDue(profileId: string): Promise<boolean> {
  const admin = createServiceClient();
  if (!admin) return false;
  const { data, error } = await admin
    .from("elite_consents")
    .select("version")
    .eq("profile_id", profileId);
  if (error || !data) return false;
  return needsConsent(data.map((r) => r.version as string));
}

// Record that this account accepted the current version. Safe to repeat:
// one row per account per version.
export async function recordConsent(input: {
  profileId: string;
  source: ConsentSource;
  guardianName?: string | null;
  userAgent?: string | null;
}): Promise<boolean> {
  const admin = createServiceClient();
  if (!admin) return false;
  const { error } = await admin.from("elite_consents").upsert(
    {
      profile_id: input.profileId,
      version: LEGAL_VERSION,
      source: input.source,
      guardian_name: input.guardianName ?? null,
      user_agent: (input.userAgent ?? "").slice(0, 300) || null,
    },
    { onConflict: "profile_id,version", ignoreDuplicates: true }
  );
  return !error;
}
