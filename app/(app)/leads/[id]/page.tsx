import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  AtSign,
  CalendarClock,
  Mail,
  Phone,
  Tag,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Avatar } from "@/components/Avatar";
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
  ghl_contact_id?: string | null;
};

async function getLead(id: string): Promise<Lead | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const db = supabase();
    const { data, error } = await db
      .from("leads")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data as Lead) ?? null;
  } catch {
    return null;
  }
}

export default async function LeadDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const lead = await getLead(params.id);
  if (!lead) return notFound();

  const created = new Date(lead.created_at);
  const tags = lead.tags ?? [];

  return (
    <div>
      <Link
        href="/leads"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted hover:text-bone"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to leads
      </Link>

      <PageHeader
        eyebrow={`Lead · ${lead.source}`}
        title={lead.name || "Unknown lead"}
        subtitle={`Captured ${created.toLocaleString()} · interested in ${lead.interest}`}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="card p-6 lg:col-span-2">
          <div className="flex items-center gap-5">
            <Avatar name={lead.name || "?"} color="#2a2a2f" size={64} className="text-sm" />
            <div className="min-w-0">
              <div className="chip">Contact</div>
              <h2 className="h-display mt-2 truncate text-2xl font-semibold">
                {lead.name || "Unknown"}
              </h2>
              <div className="mt-1 text-xs text-muted">
                {lead.first_name || lead.last_name
                  ? `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim()
                  : "No name on record"}
              </div>
            </div>
          </div>

          <div className="divider my-5" />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DetailRow
              icon={<Mail className="h-4 w-4" />}
              label="Email"
              value={lead.email}
              href={lead.email ? `mailto:${lead.email}` : undefined}
            />
            <DetailRow
              icon={<Phone className="h-4 w-4" />}
              label="Phone"
              value={lead.phone}
              href={lead.phone ? `tel:${lead.phone}` : undefined}
            />
            <DetailRow
              icon={<AtSign className="h-4 w-4" />}
              label="Source"
              value={lead.source}
            />
            <DetailRow
              icon={<CalendarClock className="h-4 w-4" />}
              label="Captured"
              value={created.toLocaleString()}
            />
          </div>

          {tags.length > 0 && (
            <>
              <div className="divider my-5" />
              <div className="flex items-start gap-2">
                <Tag className="mt-1 h-4 w-4 text-muted" />
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <span key={t} className="chip">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}
        </section>

        <section className="space-y-4">
          <div className="card p-5">
            <div className="chip">Pipeline</div>
            <h3 className="h-display mt-2 text-lg font-semibold">Status</h3>
            <p className="mt-1 text-xs text-muted">
              Move this lead through the funnel. Updates sync to Supabase.
            </p>
            <div className="mt-4">
              <LeadStatusPicker leadId={lead.id} initialStatus={lead.status} />
            </div>
          </div>

          <div className="card p-5">
            <div className="chip">Interest</div>
            <h3 className="h-display mt-2 text-lg font-semibold">
              {lead.interest}
            </h3>
            <p className="mt-1 text-xs text-muted">
              Pulled from the GHL tag the contact came in with.
            </p>
          </div>

          {lead.ghl_contact_id && (
            <div className="card p-5">
              <div className="chip">GHL</div>
              <h3 className="h-display mt-2 text-lg font-semibold">Linked contact</h3>
              <code className="mt-2 block break-all rounded-lg border border-white/5 bg-black/40 p-2 font-mono text-[11px] text-muted">
                {lead.ghl_contact_id}
              </code>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
  href?: string;
}) {
  const display = value && value.trim() ? value : "—";
  const body = (
    <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-ink-200/40 p-3">
      <span className="text-muted">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
          {label}
        </div>
        <div className="mt-0.5 truncate text-sm">{display}</div>
      </div>
    </div>
  );
  if (href && value) {
    return (
      <a href={href} className="block transition-colors hover:opacity-90">
        {body}
      </a>
    );
  }
  return body;
}
