import Link from "next/link";
import { Mail, MessageSquare, Phone, Star, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Avatar } from "@/components/Avatar";
import { LeadStatusPicker } from "@/components/LeadStatusPicker";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { timeAgo } from "@/lib/utils";

export const revalidate = 0;
export const dynamic = "force-dynamic";

type Lead = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  source: string | null;
  tags: string[] | null;
  created_at: string;
};

async function getWonClients(): Promise<Lead[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const db = supabase();
    const { data, error } = await db
      .from("leads")
      .select("id, name, email, phone, status, source, tags, created_at")
      .eq("status", "Won")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data as Lead[]) ?? [];
  } catch {
    return [];
  }
}

export default async function ClientsPage() {
  const clients = await getWonClients();

  return (
    <div>
      <PageHeader
        eyebrow="Priority · Active clients"
        title="The people you train."
        subtitle="Contacts that came through the Strive Soccer pipeline and closed as Won. These are paying — focus here first."
        actions={
          <Link href="/integrations" className="btn">
            <TrendingUp className="h-4 w-4" />
            Sync from GHL
          </Link>
        }
      />

      {clients.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="Active clients" value={String(clients.length)} />
            <StatTile
              label="With email"
              value={String(clients.filter((c) => c.email).length)}
            />
            <StatTile
              label="With phone"
              value={String(clients.filter((c) => c.phone).length)}
            />
            <StatTile
              label="Most recent"
              value={clients[0] ? timeAgo(clients[0].created_at) : "—"}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {clients.map((c) => (
              <ClientCard key={c.id} client={c} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ClientCard({ client }: { client: Lead }) {
  return (
    <div className="card relative overflow-hidden p-5">
      <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-accent/10 blur-3xl" />
      <div className="relative">
        <div className="flex items-start gap-3">
          <Avatar name={client.name || "?"} color="#2a2a2f" size={44} />
          <div className="min-w-0 flex-1">
            <Link
              href={`/leads/${client.id}`}
              className="block truncate text-base font-semibold hover:text-accent"
            >
              {client.name || "Unknown"}
            </Link>
            <div className="mt-0.5 text-[11px] text-muted">
              {client.source ?? "Direct"} · joined {timeAgo(client.created_at)}
            </div>
          </div>
          <span className="chip-accent">
            <Star className="h-3 w-3" />
            Won
          </span>
        </div>

        {(client.tags ?? []).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {(client.tags ?? []).slice(0, 4).map((t) => (
              <span key={t} className="chip text-[10px]">
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          {client.email ? (
            <a
              href={`mailto:${client.email}`}
              className="btn h-9 text-xs"
              title={client.email}
            >
              <Mail className="h-3.5 w-3.5" />
              <span className="truncate">Email</span>
            </a>
          ) : (
            <span className="btn h-9 text-xs opacity-40">
              <Mail className="h-3.5 w-3.5" />
              No email
            </span>
          )}
          {client.phone ? (
            <a
              href={`tel:${client.phone}`}
              className="btn-accent h-9 text-xs"
              title={client.phone}
            >
              <Phone className="h-3.5 w-3.5" />
              <span className="truncate">Call</span>
            </a>
          ) : (
            <span className="btn h-9 text-xs opacity-40">
              <Phone className="h-3.5 w-3.5" />
              No phone
            </span>
          )}
        </div>

        {client.phone && (
          <a
            href={`sms:${client.phone}`}
            className="btn-ghost mt-2 inline-flex w-full justify-center text-[11px]"
          >
            <MessageSquare className="h-3 w-3" />
            Send a quick text
          </a>
        )}

        <div className="mt-4 border-t border-white/5 pt-3">
          <LeadStatusPicker
            leadId={client.id}
            initialStatus={client.status}
            compact
          />
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
        {label}
      </div>
      <div className="h-display mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card relative overflow-hidden p-12 text-center">
      <div className="absolute inset-0 dot-grid opacity-20" />
      <div className="relative mx-auto max-w-md">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent/10 text-accent">
          <Star className="h-6 w-6" />
        </div>
        <h3 className="h-display mt-4 text-xl font-semibold">
          No active clients yet.
        </h3>
        <p className="mt-2 text-sm text-muted">
          Run the bulk GHL sync from{" "}
          <Link href="/integrations" className="text-accent hover:underline">
            Integrations
          </Link>{" "}
          — contacts tagged <code className="kbd">won</code> in your Strive
          pipeline land here as priority clients.
        </p>
        <Link href="/integrations" className="btn-accent mt-6">
          <TrendingUp className="h-4 w-4" />
          Open Integrations
        </Link>
      </div>
    </div>
  );
}
