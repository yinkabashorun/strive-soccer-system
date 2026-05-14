# Strive OS

The internal operating system and content engine for **Strive Soccer** —
a modern soccer training brand focused on ball mastery, creativity, composure,
and slowing the game down.

This is not a CRM. This is not a landing page builder. GoHighLevel and Manus
already do those jobs. **Strive OS sits at the center** — the operating
system that connects every tool, every coach, every player, every post.

## What it does

| Module | What |
|---|---|
| **Command Center** | Daily schedule, leads, unpaid players, course sales, content perf, coach tasks. |
| **Sessions** | Roster, capacity, coach assignment, mobile-first sideline check-in, progress notes. |
| **Players** | Every player, every package, every payment, every coach note. |
| **Course** | Launch-out tile to the hosted $67 Ball Mastery course. OS handles commerce; course handles experience. |
| **AI Content Engine** | One-tap hooks, scripts, voiceovers, captions. Idea → Scripted → Edited → Posted → Viral pipeline. |
| **Player Portal** | Premium parent/player experience — schedule, balance, progress, course access. |
| **Integrations** | GHL webhooks, Supabase, Stripe, Higgsfield, Manus. |

## Stack

- **Next.js 14** (App Router)
- **Tailwind CSS** — dark, premium, sport-luxury aesthetic
- **Framer Motion** — subtle, cinematic motion
- **Supabase** — backend (env-gated; mock data until wired)
- **Stripe-ready** — checkout architecture
- **GHL-aware** — `/api/ghl/webhook` mapper

## Run

```bash
cp .env.example .env.local   # wire Supabase, GHL, Stripe, course URL
npm install
npm run dev
```

Open `http://localhost:3000`.

The app runs on rich mock data out of the box so you can see the entire
operating system without any backend wired.

## Architecture principle

```
 Manus (pages) ─▶ GoHighLevel (CRM) ─▶ Strive OS (operating system)
                                              │
                          Higgsfield ─▶ Content Engine ─▶ TikTok / IG
```

GHL is the source of truth for **leads + automations**. Strive OS reads from
GHL via webhooks, owns the **operations layer** (sessions, players, payments,
content), and renders the **premium experience** (coach UI, player portal,
content engine).

## Long-term vision

Strive OS is the operating system for a future nationally recognized football
brand — premium local training + a scalable online education/media company.
