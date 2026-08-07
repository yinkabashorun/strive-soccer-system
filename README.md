# Strive Elite

**The premium coaching platform for Strive Soccer FC.** Not a generic coaching
app — a complete development system that makes parents feel they're buying a
program, not just private sessions.

Personalized coaching · weekly homework · progress tracking · film analysis ·
AI session notes · parent reports · accountability. Built to feel like Apple,
Nike Training Club, and Duolingo combined — and to onboard 30 paying clients.

> This repo also contains **Strive OS**, the internal coach operations + content
> engine, now living at [`/os`](#strive-os-internal-tool). Strive Elite is the
> new player/parent-facing product and owns the root of the app.

---

## ✨ Runs instantly in demo mode

The app ships with **rich seed data for five realistic players** and a full
demo login. With **no environment variables set at all**, you can deploy to
Vercel and immediately tour the entire experience:

- Visit `/login` (or `/signup`) → **Enter as Player** or **Enter as Coach**.
- Everything renders — dashboard, homework (tap to complete), progress charts,
  film upload, coach roster, player profiles, and the **AI session-notes
  studio** (uses a smart offline fallback until an API key is added).

Wire the services below to switch demo mode off and go fully live.

---

## Tech stack

- **Next.js 14** (App Router) · **TypeScript** (strict)
- **Tailwind CSS** — black / white / light-gray minimal, Strive accent, Barlow +
  Barlow Condensed brand type
- **Supabase** — Postgres + Auth (email/password) + Storage + RLS
- **Stripe** — monthly subscription + one-time session + webhooks
- **Claude API** (`@anthropic-ai/sdk`) — turns plain-English session notes into a
  full weekly plan
- **Vercel** — deployment

> The Master Prompt calls for Next.js 15. This codebase is pinned to the stable
> **Next 14.2** App Router that the existing Strive OS build already runs on, to
> keep the live dribbling-course funnel working. All Strive Elite code is
> App-Router idiomatic and upgrades to 15 cleanly.

---

## Project structure

```
app/
  layout.tsx                  Root: brand fonts (Barlow / Barlow Condensed)
  (marketing)/                Public site — landing, pricing, about, contact
  (auth)/                     login, signup (role selection + demo entry)
  (player)/                   Player app (auth-protected)
    dashboard/ homework/ progress/ film/
  (coach)/                    Coach app (auth-protected)
    coach/                    Roster dashboard
    coach/players/[id]/       Player profile + AI session-notes studio
  (public)/                   Legacy $97 dribbling-course funnel (kept live)
  (app)/                      Legacy Strive OS internal tool (now at /os)
  api/elite/
    ai/session-notes/         Claude → structured weekly plan
    stripe/checkout/          Create Checkout Session (sub + one-time)
    stripe/webhook/           Sync subscription status
    contact/                  Contact form sink (+ optional GHL forward)

components/elite/             Strive Elite design system + feature components
lib/elite/
  supabase/                   Browser / server / middleware SSR clients
  types.ts                    Domain model (mirrors the SQL schema)
  demo.ts                     Five-player demo dataset (demo mode)
  data.ts                     Data access (Supabase, falls back to demo)
  session.ts                  Viewer/role resolution (real auth or demo cookie)
  ai-coach.ts                 Claude session-notes engine + offline fallback
  auth-actions.ts             Sign out / demo entry (server actions)
  player-actions.ts           Homework toggle, film, messages
  coach-actions.ts            Edit fields, notes, messages, apply AI plan

supabase/migrations/
  005_strive_elite.sql        Full schema + RLS + storage bucket + triggers
scripts/seed-elite.mjs        Provision coach + 5 players as real auth users
middleware.ts                 Session refresh + route protection
```

---

## Environment variables

Copy `.env.example` → `.env.local`. All are optional for demo mode.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Turns on real auth + data |
| `SUPABASE_SERVICE_ROLE_KEY` | Stripe webhook writes + seed script (server only) |
| `NEXT_PUBLIC_APP_URL` | Base URL for Stripe redirect/callbacks |
| `ANTHROPIC_API_KEY` | Enables Claude session-notes generation |
| `ANTHROPIC_MODEL` | Optional model override (defaults to a current Claude model) |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Payments + webhook verification |
| `STRIVE_PRICE_MONTHLY` / `STRIVE_PRICE_ELITE` / `STRIVE_PRICE_SESSION` | Stripe Price IDs for the plans |

---

## Access control (paid mentorship)

Strive Elite is invite-only. Nobody buys their way in by simply registering:

- **Coaches** are provisioned only by you (the seed script / Supabase). There is
  **no public path to a coach account** — the signup form is player-only.
- **Players** can only create an account by redeeming a **single-use invite
  code**. Generate codes from the coach dashboard (*Invite a client*) and hand
  one out after a client pays. Redeeming a code creates their account already
  **provisioned and active** — and confirms their email automatically, so there's
  no confirmation-link step.
- **Revoking access**: set a client to *Paused* on their profile (or their
  Stripe subscription lapses) and they immediately hit a "membership paused"
  screen instead of the program.
- Row-Level Security still guarantees a player only ever sees their own data.

**Onboard a paying client in 3 steps:** collect payment → open the coach
dashboard, *Invite a client*, copy the code → send them the code and the
`/signup` link. Done.

> Requires `SUPABASE_SERVICE_ROLE_KEY` (server-only) so redemption can create
> confirmed accounts. Apply migration `006_invite_codes.sql` alongside `005`.

## Connect Supabase

1. Create a project at [supabase.com](https://supabase.com). Copy the **Project
   URL**, **anon key**, and **service_role key** into `.env.local`.
2. Run the schema: open the **SQL Editor** and paste
   `supabase/migrations/005_strive_elite.sql` (or `supabase db push`). This
   creates every `elite_*` table (namespaced to coexist with Strive OS),
   Row-Level-Security policies, the `elite-film` storage bucket, and the
   trigger that creates an `elite_profiles` row on sign-up.
3. **Auth → Providers → Email**: enable email/password. For the fastest demo,
   turn *Confirm email* off (sign-ups get a session immediately).
4. Seed real demo accounts (optional):
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
     node scripts/seed-elite.mjs
   ```
   Creates **coach@strivesoccerfc.com** + five players, all with password
   `StriveElite!25`.

Roles: sign-up writes a `role` (`player` or `coach`) into user metadata; the
trigger copies it to `profiles.role`. RLS then scopes every read/write — a
player sees only their own data; a coach sees their whole squad.

---

## Stripe setup

1. In the Stripe dashboard create three **Prices**: monthly (recurring), academy
   (recurring), single session (one-time). Put their IDs in `STRIVE_PRICE_*`.
2. Add `STRIPE_SECRET_KEY`.
3. Create a webhook pointing at `https://<your-domain>/api/elite/stripe/webhook`
   for `checkout.session.completed` and `customer.subscription.*` events. Put
   the signing secret in `STRIPE_WEBHOOK_SECRET`.
4. The pricing page's buttons call `/api/elite/stripe/checkout`. Until Stripe is
   wired, they gracefully route users into sign-up instead of erroring.

---

## Deploy to Vercel

1. Import the repo into Vercel.
2. Add the environment variables above (demo mode needs none).
3. Deploy. `vercel.json` already sets function durations for the AI + cron
   routes. The Stripe webhook route reads the raw body correctly on Node runtime.
4. Point your Stripe webhook + Supabase auth redirect URLs at the deployed
   domain.

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build (passes clean)
npm run typecheck  # strict TS, no errors
```

---

## Demo accounts

| Mode | How | Sees |
|---|---|---|
| **Demo (no Supabase)** | `/login` → *Enter as Player* / *Enter as Coach* | Full seed data, all features |
| **Real (seeded)** | `coach@strivesoccerfc.com` · players `marcus@strivedemo.com` … | Live data, password `StriveElite!25` |

---

## Strive OS (internal tool)

The original coach operations + content engine still lives here, moved to
**`/os`** so Strive Elite can own the root. It reads GHL webhooks and drives the
AI content engine and the live **$97 dribbling-course funnel** at
`/dribbling-course`. See the module table below.

| Module | What |
|---|---|
| **Command Center** (`/os`) | Daily schedule, leads, unpaid players, course sales, content perf. |
| **Sessions / Players / Leads** | Roster, packages, payments, coach notes, CRM. |
| **AI Content Engine** (`/content`) | Hooks, scripts, voiceovers, captions. |
| **Course Ad Library** (`/admin/course-ads`) | Ready-to-run ad copy for the funnel. |

---

_For the Players. By the Players. · Strive Soccer FC · DMV_
