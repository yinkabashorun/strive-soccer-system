import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { LeadStatusPicker } from "@/components/LeadStatusPicker";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export const revalidate = 0;
export const dynamic = "force-dynamic";

type Lead = {
  id: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  source: string;
  interest: string;
  status: string;
  tags: string[] | null;
  created_at: string;
};

async function getLeads(): Promise<Lead[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const db = supabase();
    const { data, error } = await db
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data as Lead[]) ?? [];
  } catch {
    return [];
  }
}

export default async function LeadsPage() {
  const leads = await getLeads();

  return (
    <div>
      <PageHeader
        eyebrow="Leads"
        title="Every lead from GHL."
        subtitle="Contacts synced automatically from GoHighLevel when created. Tap any row to view, change status without leaving the list."
      />

      <div className="card overflow-hidden">
        <div className="hidden grid-cols-12 gap-3 border-b border-white/5 px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-muted md:grid">
          <div className="col-span-3">Name</div>
          <div className="col-span-3">Contact</div>
          <div className="col-span-2">Source</div>
          <div className="col-span-1">Interest</div>
          <div className="col-span-3">Status</div>
        </div>

        {leads.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <div className="mx-auto max-w-sm">
              <div className="chip mx-auto">Empty</div>
              <h3 className="h-display mt-3 text-xl font-semibold">
                No leads yet.
              </h3>
              <p className="mt-2 text-sm text-muted">
                {isSupabaseConfigured()
                  ? "Create a contact in GoHighLevel — it'll appear here within seconds."
                  : "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to start syncing leads from GHL."}
              </p>
            </div>
          </div>
        ) : (
          leads.map((lead) => (
            <div
              key={lead.id}
              className="group relative grid grid-cols-1 gap-3 border-b border-white/5 px-5 py-4 transition-colors last:border-b-0 hover:bg-white/[0.02] md:grid-cols-12"
            >
              <Link
                href={`/leads/${lead.id}`}
                aria-label={`Open ${lead.name || "lead"}`}
                className="absolute inset-0 z-0"
              />

              <div className="relative z-10 col-span-3 flex items-center gap-3 pointer-events-none">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent">
                  {(lead.first_name?.[0] ?? lead.name?.[0] ?? "?").toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-semibold">{lead.name || "Unknown"}</div>
                  <div className="text-xs text-muted">
                    {new Date(lead.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>

              <div className="relative z-10 col-span-3 flex flex-col justify-center gap-0.5 pointer-events-none">
                {lead.email && (
                  <div className="truncate text-xs text-muted">{lead.email}</div>
                )}
                {lead.phone && (
                  <div className="text-xs text-muted">{lead.phone}</div>
                )}
                {!lead.email && !lead.phone && (
                  <div className="text-xs text-muted/60">No contact info</div>
                )}
              </div>

              <div className="relative z-10 col-span-2 flex items-center pointer-events-none">
                <span className="chip">{lead.source}</span>
              </div>

              <div className="relative z-10 col-span-1 flex items-center text-xs text-muted pointer-events-none">
                {lead.interest}
              </div>

              <div className="relative z-10 col-span-3 flex items-center justify-between gap-3">
                <div className="pointer-events-auto">
                  <LeadStatusPicker
                    leadId={lead.id}
                    initialStatus={lead.status}
                    compact
                  />
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-bone pointer-events-none" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
