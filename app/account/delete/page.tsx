import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { DeleteAccountForm } from "@/components/elite/DeleteAccountForm";
import { getViewer } from "@/lib/elite/session";
import { DELETE_BLOCKED_MESSAGE, deleteGate } from "@/lib/elite/account";
import { trackerFor } from "@/lib/elite/tracker-server";

export const metadata = { title: "Delete my account · Strive Elite" };

// "Delete my account": what goes, what does not, the password, one button.
// Self-serve and immediate, with nobody to email or call (App Review
// Guideline 5.1.1(v)).
export default async function DeleteAccountPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/account/delete");
  const gate = deleteGate(viewer);
  // A free training log account (069) has no plan, clips or billing, so
  // its list says what it actually holds.
  const free = !viewer.demo && (await trackerFor(viewer)) !== null;
  const isPlayer = viewer.role === "player" && !free;

  return (
    <div className="min-h-[100svh] bg-black text-bone">
      <div className="mx-auto w-full max-w-xl px-4 pb-16 pt-[calc(1.25rem+env(safe-area-inset-top))] sm:px-6">
        <Link
          href="/account"
          className="inline-flex h-11 items-center gap-1 pr-3 text-[15px] font-medium text-white/70"
        >
          <ChevronLeft className="h-5 w-5" /> Account
        </Link>

        <h1 className="mt-3 font-display text-4xl font-black uppercase leading-none">
          Delete my account
        </h1>

        {!gate.allowed ? (
          <p className="mt-4 text-[15px] leading-relaxed text-white/75">
            {DELETE_BLOCKED_MESSAGE[gate.reason]}
          </p>
        ) : (
          <>
            <p className="mt-4 text-[15px] leading-relaxed text-white/75">
              This is permanent and happens right away. It cannot be undone.
            </p>

            <div className="mt-6 rounded-3xl border border-white/[0.08] bg-white/[0.03] p-5">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
                What is deleted
              </h2>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] text-white/80">
                <li>Your login.</li>
                {isPlayer ? (
                  <>
                    <li>The player&apos;s profile, training weeks and history.</li>
                    <li>Progress, time trained and achievements.</li>
                    <li>Every message with the coach.</li>
                    <li>Every clip and video the player uploaded.</li>
                  </>
                ) : free ? (
                  <li>Your profile, your quiz answers and every entry in your training log.</li>
                ) : (
                  <li>Your coach profile and your access to the roster.</li>
                )}
              </ul>

              <h2 className="mt-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
                What is not
              </h2>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] text-white/80">
                {isPlayer && (
                  <>
                    <li>
                      Payment records. They are held by our payment processor and kept as long
                      as tax and accounting rules require.
                    </li>
                    <li>
                      Monthly billing. Deleting the account does not stop a payment by itself. We
                      are told the moment you delete, and we stop it.
                    </li>
                  </>
                )}
                <li>Texts already delivered to your phone.</li>
              </ul>
            </div>

            <div className="mt-6">
              <DeleteAccountForm />
            </div>

            <div className="mt-5 text-center">
              <Link href="/account" className="tap text-[15px] font-medium text-white/70 underline-offset-4 hover:underline">
                Keep my account
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
