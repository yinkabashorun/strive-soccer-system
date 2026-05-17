import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// GET /api/sync/contacts
//
// Pulls every contact from the configured GHL location and upserts them
// into the Supabase `leads` table keyed by ghl_contact_id so re-runs are
// safe. Returns a summary { synced, total, errors }.

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";
const PAGE_SIZE = 100;

type GHLContact = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  tags?: string[] | null;
  source?: string | null;
  dateAdded?: string | null;
  customFields?: unknown;
};

type GHLContactsPage = {
  contacts?: GHLContact[];
  meta?: {
    total?: number;
    currentPage?: number;
    nextPage?: number | null;
  };
};

type LeadRow = {
  ghl_contact_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  tags: string[];
  source: string | null;
  created_at: string;
};

type SyncError = { page: number; contactId?: string; message: string };

// Tags that signal "this contact is already a paying / converted client".
// Strive's GHL pipeline uses "won" as the terminal stage; we surface those
// as the priority list in the OS, so map them to status="Won" on ingest.
const WON_TAGS = new Set(["won", "client", "active client", "active-client", "active_client"]);

function deriveStatus(tags: string[]): string {
  for (const t of tags) {
    if (WON_TAGS.has(t.trim().toLowerCase())) return "Won";
  }
  return "New";
}

function mapContact(c: GHLContact): LeadRow {
  const name =
    [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || "Unknown";
  const tags = Array.isArray(c.tags) ? c.tags : [];
  return {
    ghl_contact_id: c.id,
    name,
    email: c.email || null,
    phone: c.phone || null,
    status: deriveStatus(tags),
    tags,
    source: c.source || null,
    created_at: c.dateAdded || new Date().toISOString(),
  };
}

async function fetchPage(
  apiKey: string,
  locationId: string,
  page: number,
): Promise<GHLContactsPage> {
  const url = new URL(`${GHL_BASE}/contacts/`);
  url.searchParams.set("locationId", locationId);
  url.searchParams.set("limit", String(PAGE_SIZE));
  url.searchParams.set("page", String(page));

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Version: GHL_VERSION,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`ghl_fetch_${res.status}: ${detail.slice(0, 400)}`);
  }

  return (await res.json()) as GHLContactsPage;
}

export async function GET() {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;

  if (!apiKey) {
    return NextResponse.json(
      { error: "GHL_API_KEY is not configured" },
      { status: 400 },
    );
  }
  if (!locationId) {
    return NextResponse.json(
      { error: "GHL_LOCATION_ID is not configured" },
      { status: 400 },
    );
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        error:
          "Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)",
      },
      { status: 400 },
    );
  }

  const db = supabase();
  const errors: SyncError[] = [];

  let total = 0;
  let synced = 0;
  let page = 1;

  while (true) {
    let pageData: GHLContactsPage;
    try {
      pageData = await fetchPage(apiKey, locationId, page);
    } catch (err) {
      const message = err instanceof Error ? err.message : "ghl_fetch_failed";
      console.error(`[sync/contacts] page ${page} fetch failed:`, message);
      errors.push({ page, message });
      break;
    }

    const contacts = pageData.contacts ?? [];
    const meta = pageData.meta ?? {};
    console.log(
      `[sync/contacts] page ${page}: fetched ${contacts.length} contacts ` +
        `(currentPage=${meta.currentPage ?? "?"}, nextPage=${meta.nextPage ?? "none"}, total=${meta.total ?? "?"})`,
    );

    if (contacts.length === 0) break;
    total += contacts.length;

    const rows: LeadRow[] = contacts.map(mapContact);

    // .select('*') forces PostgREST to refresh the schema cache for the
    // returned columns — works around stale-cache "column not found" errors
    // immediately after a migration. { count: 'exact' } gives us a verified
    // row count from Postgres rather than trusting the client array length.
    const { data, error: upsertErr, count } = await db
      .from("leads")
      .upsert(rows, {
        onConflict: "ghl_contact_id",
        ignoreDuplicates: false,
        count: "exact",
      })
      .select("*");

    if (upsertErr) {
      console.error(
        `[sync/contacts] page ${page} upsert failed:`,
        upsertErr.message,
      );
      errors.push({ page, message: `db: ${upsertErr.message}` });
    } else {
      const written = count ?? data?.length ?? rows.length;
      synced += written;
    }

    const next = meta.nextPage;
    if (next === null || next === undefined || next === 0) break;
    if (contacts.length < PAGE_SIZE) break;
    page = next;
  }

  console.log(
    `[sync/contacts] done · pages=${page} fetched=${total} synced=${synced} errors=${errors.length}`,
  );

  return NextResponse.json({ synced, total, errors });
}
