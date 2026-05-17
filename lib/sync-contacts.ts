// Shared GHL contact-sync logic.
//
// Both the manual button (/api/sync/contacts) and the daily cron
// (/api/cron/sync-contacts) call runContactsSync() so they behave
// identically — same pagination, same mapping, same upsert, same logging.

import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { statusFromTags } from "@/lib/ghl";

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";
const PAGE_SIZE = 100;

export type GHLContact = {
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

export type LeadRow = {
  ghl_contact_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  tags: string[];
  source: string | null;
  created_at: string;
};

export type SyncError = { page: number; contactId?: string; message: string };

export type SyncResult = {
  synced: number;
  total: number;
  errors: SyncError[];
  wonAdded: number;
};

export type SyncOutcome =
  | { ok: true; result: SyncResult }
  | { ok: false; status: number; error: string };

function mapContact(c: GHLContact): LeadRow {
  const name =
    [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || "Unknown";
  const tags = Array.isArray(c.tags) ? c.tags : [];
  return {
    ghl_contact_id: c.id,
    name,
    email: c.email || null,
    phone: c.phone || null,
    status: statusFromTags(tags),
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

export async function runContactsSync(): Promise<SyncOutcome> {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;

  if (!apiKey) {
    return { ok: false, status: 400, error: "GHL_API_KEY is not configured" };
  }
  if (!locationId) {
    return {
      ok: false,
      status: 400,
      error: "GHL_LOCATION_ID is not configured",
    };
  }
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      status: 400,
      error:
        "Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)",
    };
  }

  const db = supabase();
  const errors: SyncError[] = [];

  let total = 0;
  let synced = 0;
  let wonAdded = 0;
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
    wonAdded += rows.filter((r) => r.status === "Won").length;

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
    `[sync/contacts] done · pages=${page} fetched=${total} synced=${synced} ` +
      `wonAdded=${wonAdded} errors=${errors.length}`,
  );

  return { ok: true, result: { synced, total, errors, wonAdded } };
}
