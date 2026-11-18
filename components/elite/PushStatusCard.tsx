import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { pushStatusLine, type PushStatus } from "@/lib/elite/install";
import { cn } from "@/lib/utils";

// Push notifications at a glance, next to the plan builder and app errors
// cards: are the keys set, and how many active players have a device on.
// Amber until at least one player has turned them on.
export function PushStatusCard({ status }: { status: PushStatus }) {
  const { ok, line } = pushStatusLine(status);
  return (
    <div className={cn("elite-card p-5", !ok && "border-amber-300/30 bg-amber-300/[0.04]")}>
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
        Push notifications
        {ok ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
        ) : (
          <AlertTriangle className="h-3.5 w-3.5 text-amber-200" />
        )}
      </div>
      <p className={cn("mt-1.5 text-sm", ok ? "text-white/70" : "text-amber-100")}>{line}</p>
    </div>
  );
}
