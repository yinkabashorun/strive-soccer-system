"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getViewer } from "./session";
import { agreementComplete, cleanGuardianName } from "./legal";
import { recordConsent } from "./legal-server";

export type AgreeState = { error: string | null };

// The in-app agreement screen: a parent or guardian ticks both boxes and
// types their name, the acceptance is recorded, and the app opens.
export async function acceptAgreement(_prev: AgreeState, formData: FormData): Promise<AgreeState> {
  const viewer = await getViewer();
  if (!viewer || viewer.demo) redirect("/login");

  if (
    !agreementComplete({
      guardian: formData.get("guardian") === "on",
      terms: formData.get("terms") === "on",
    })
  ) {
    return { error: "Tick both boxes to continue." };
  }
  const name = cleanGuardianName(formData.get("guardian_name"));
  if (!name) return { error: "Type the full name of the parent or guardian who is agreeing." };

  const ok = await recordConsent({
    profileId: viewer.profile.id,
    source: "in_app",
    guardianName: name,
    userAgent: headers().get("user-agent"),
  });
  if (!ok) return { error: "That did not save. Check your connection and try again." };

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
