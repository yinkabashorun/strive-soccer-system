import { ClipboardList } from "lucide-react";
import type { Player } from "@/lib/elite/types";
import { EnvToggle } from "./EnvToggle";
import { GenderToggle } from "./GenderToggle";
import { ContactInfoEditor } from "./ContactInfoEditor";

// Snapshot of what the player told us at intake, plus coach-editable
// contact info and training environment. Gives the coach the context they
// need before building a plan.
export function IntakePanel({ player }: { player: Player }) {
  const self = player.self_assessment ?? {};
  const selfEntries = Object.entries(self);

  const rows: [string, string][] = [];
  if (player.club) rows.push(["Club", player.club]);
  if (player.dominant_foot) rows.push(["Dominant foot", player.dominant_foot]);
  if (player.parent_name) rows.push(["Parent", player.parent_name]);
  const hasIntake = rows.length > 0 || selfEntries.length > 0;

  return (
    <div className="elite-card p-5">
      <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
        <ClipboardList className="h-3.5 w-3.5" /> Intake
      </div>

      {/* Coach-editable: only way to fix a wrong/missing parent email or
          phone, e.g. for players who signed up before phone capture existed */}
      <ContactInfoEditor
        playerId={player.id}
        initialEmail={player.parent_email ?? ""}
        initialPhone={player.parent_phone ?? ""}
        initialPlayerPhone={player.player_phone ?? ""}
      />

      {/* Coach-editable: flips wall/goal days in the next generated plan,
          and lets AI copy use correct pronouns once gender is set */}
      <div className="mb-3 space-y-2 border-b border-white/6 pb-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-white/40">Wall nearby</span>
          <EnvToggle playerId={player.id} field="has_wall" value={player.has_wall ?? null} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-white/40">Goal nearby</span>
          <EnvToggle playerId={player.id} field="has_goal" value={player.has_goal ?? null} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-white/40">Boy / girl</span>
          <GenderToggle playerId={player.id} value={player.gender ?? null} />
        </div>
      </div>

      {!hasIntake ? (
        <p className="text-sm text-white/35">
          This player hasn&apos;t completed onboarding yet.
        </p>
      ) : (
        <>
          <div className="space-y-2 text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-3">
                <span className="text-white/40">{label}</span>
                <span className="text-right text-white/75">{value}</span>
              </div>
            ))}
          </div>

          {selfEntries.length > 0 && (
            <div className="mt-4 border-t border-white/6 pt-3">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
                Self-assessment at intake
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selfEntries.map(([metric, value]) => (
                  <span
                    key={metric}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-white/70"
                  >
                    {metric}
                    <span className="font-display font-bold text-white/90">
                      {value as number}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
