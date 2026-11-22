import { getViewer } from "@/lib/elite/session";
import { redirect } from "next/navigation";
import { getMessages, getPlayer } from "@/lib/elite/data";
import { featureOn } from "@/lib/elite/tiers";
import { sendPlayerMessage } from "@/lib/elite/player-actions";
import { MessageThread } from "@/components/elite/MessageThread";
import Link from "next/link";
import { ChevronRight, Clapperboard } from "lucide-react";
import { TourGuide } from "@/components/elite/TourGuide";

export const metadata = { title: "Your coach · Strive Elite" };

export default async function MessagesPage() {
  const viewer = await getViewer();
  if (!viewer?.playerId) return null;
  // Not in every offer (Strive Pro, 074): an old link lands on Home.
  const player = await getPlayer(viewer.playerId);
  if (!featureOn(player?.tier, "coachChat")) redirect("/dashboard");
  const messages = await getMessages(viewer.playerId);

  async function send(body: string) {
    "use server";
    return sendPlayerMessage(body);
  }

  return (
    <div className="space-y-5">
      <header className="pr-24">
        <h1 className="m-head text-[40px] leading-none">Coach</h1>
        <p className="mt-2 text-[14px] leading-snug text-white/60">
          Questions, wins, clips to talk through. Message your coach directly.
        </p>
      </header>

      {viewer.demo && <TourGuide page="coach" />}

      {/* The Film Room lives here and on Home, not as a tab of its own. */}
      {featureOn(player?.tier, "filmRoom") && (
        <Link href="/film" className="press m-card flex min-h-[64px] items-center gap-3.5 px-4 py-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-fill-2 text-bone">
            <Clapperboard className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-bone">Film Room</span>
            <span className="block truncate text-[13px] text-white/60">This week&apos;s session and your clips</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-white/50" />
        </Link>
      )}

      <div className="m-card p-5">
        <MessageThread
          messages={messages}
          meRole="player"
          meName={viewer.profile.full_name}
          send={send}
          placeholder="Message your coach…"
          emptyLine="No messages yet. Ask your coach anything about your training, and the answer comes back right here."
        />
      </div>
    </div>
  );
}
