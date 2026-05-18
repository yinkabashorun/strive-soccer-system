"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, CloudDownload, Loader2 } from "lucide-react";

type SyncResponse = {
  synced?: number;
  total?: number;
  errors?: Array<{ page: number; contactId?: string; message: string }>;
  error?: string;
};

type Status =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "ok"; synced: number; total: number; errorCount: number }
  | { kind: "error"; message: string };

export function SyncContactsButton() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function run() {
    setStatus({ kind: "running" });
    try {
      const res = await fetch("/api/sync/contacts");
      const data = (await res.json().catch(() => ({}))) as SyncResponse;
      if (!res.ok) {
        setStatus({
          kind: "error",
          message: data.error || `Sync failed (${res.status})`,
        });
        return;
      }
      setStatus({
        kind: "ok",
        synced: data.synced ?? 0,
        total: data.total ?? 0,
        errorCount: data.errors?.length ?? 0,
      });
      startTransition(() => router.refresh());
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "request_failed",
      });
    }
  }

  const running = status.kind === "running";

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={run}
        disabled={running}
        className="btn-accent disabled:opacity-60"
      >
        {running ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Syncing GHL contacts…
          </>
        ) : (
          <>
            <CloudDownload className="h-4 w-4" />
            Sync GHL Contacts
          </>
        )}
      </button>

      {status.kind === "ok" && (
        <div className="inline-flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/[0.06] px-3 py-2 text-xs text-bone">
          <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
          Synced {status.synced} of {status.total} contacts
          {status.errorCount > 0 && (
            <span className="text-red-300">
              · {status.errorCount} page error{status.errorCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
      )}

      {status.kind === "error" && (
        <div className="inline-flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.05] px-3 py-2 text-xs text-red-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{status.message}</span>
        </div>
      )}
    </div>
  );
}
