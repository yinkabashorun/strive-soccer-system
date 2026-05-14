import { PageHeader } from "@/components/PageHeader";

export default function SettingsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Settings"
        title="Workspace · Strive OS"
        subtitle="Configure integrations, team access, and brand defaults from one place."
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="card p-5">
          <div className="chip">Brand</div>
          <h3 className="h-display mt-2 text-lg font-semibold">Strive Soccer</h3>
          <p className="mt-1 text-xs text-muted">
            Modern soccer training brand — ball mastery, creativity, composure.
          </p>
        </div>
        <div className="card p-5">
          <div className="chip">Team</div>
          <h3 className="h-display mt-2 text-lg font-semibold">Coaches</h3>
          <p className="mt-1 text-xs text-muted">
            Yinka (Founder) · Daniel · Ops
          </p>
        </div>
        <div className="card p-5 md:col-span-2">
          <div className="chip">Environment</div>
          <p className="mt-2 text-xs text-muted">
            Copy <code className="kbd">.env.example</code> →{" "}
            <code className="kbd">.env.local</code> and fill in Supabase, GHL,
            Stripe, and your course URL. The OS works offline with mock data
            until those are wired.
          </p>
        </div>
      </div>
    </div>
  );
}
