import { getViewer } from "@/lib/elite/session";
import { getMessages } from "@/lib/elite/data";
import { sendPlayerMessage } from "@/lib/elite/player-actions";
import { MessageThread } from "@/components/elite/MessageThread";
import { MessageSquare } from "lucide-react";
import { TourGuide } from "@/components/elite/TourGuide";

export const metadata = { title: "Your coach · Strive Elite" };

export default async function MessagesPage() {
  const viewer = await getViewer();
  if (!viewer?.playerId) return null;
  const messages = await getMessages(viewer.playerId);

  async function send(body: string) {
    "use server";
    return sendPlayerMessage(body);
  }

  return (
    <div className="space-y-5">
      {viewer.demo && <TourGuide page="coach" />}

      <header className="animate-fade-up">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
          <MessageSquare className="h-3.5 w-3.5 text-accent" /> Direct line
        </div>
        <h1 className="mt-1 font-display text-3xl font-black sm:text-4xl">
          Your coach
        </h1>
        <p className="mt-2 text-white/50">
          Questions, wins, clips to talk through — message your coach directly.
        </p>
      </header>

      <div className="elite-card p-5">
        <MessageThread
          messages={messages}
          meRole="player"
          meName={viewer.profile.full_name}
          send={send}
          placeholder="Message your coach…"
        />
      </div>
    </div>
  );
}
