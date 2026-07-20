<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# MentorReach

A Preply-style two-sided coaching marketplace. **The source of truth is
[`docs/mentorreach-platform-spec.md`](docs/mentorreach-platform-spec.md)** — read it before
making product decisions. Section references below (§4, §6, …) point into it.

Motto: "Reach the people who've been there."

## Hard rules (spec §2) — enforce in logic, not just docs

1. **All payment happens on-platform.** No off-platform arrangements at any commission
   tier. Calendly handles time selection only; money always flows through Stripe Connect.
2. **Commission attribution is frozen and dumb by design.** Set once per (coach, student)
   pair at first transaction, never re-evaluated, no manual overrides, no case-by-case.
   Enforced by `UNIQUE(coach_id, student_id)` on `coach_student_links` — there is
   physically nowhere to put a second commission value for a pair. All attribution logic
   lives in `src/lib/commission.ts` and nowhere else.
3. **Students are gated behind the survey — at BOOKING, not browsing.** Browse is public;
   booking requires `student_surveys.completed_at IS NOT NULL`. (Intentional change from a
   literal §2.3 — see docs/spec-coverage.md.)
4. **Coaches self-publish; there is no approval gate.** A real coach's profile goes live
   automatically once their checklist is complete (photo, field, role, bio, ≥1 offering,
   Calendly, Stripe payouts, handbook ack) — all computed in `src/lib/coach-publish.ts`.
   `coach_profiles.status` is now only an admin kill switch (`suspended`). Seed/demo
   coaches are exempt (live unless suspended). This is an intentional change from the
   spec's §2.4 approval gate — see docs/spec-coverage.md.

## Stack

Next.js 16 (App Router) · Neon Postgres · Drizzle · Clerk · Stripe Connect · Calendly ·
Resend · Vercel · Tailwind 4 + shadcn/ui.

## Conventions that will bite you if you don't know them

- **`src/proxy.ts`, not `middleware.ts`.** Next 16 renamed the convention. The proxy only
  attaches Clerk's auth context; it does no route protection. Gate at the resource with
  `requireRole()`. `createRouteMatcher()` is deprecated — don't reintroduce it.
- **`ClerkProvider` goes inside `<body>`.** Clerk Core 3 changed this.
- **`auth()` and `clerkClient()` are async.** Await them.
- **Clerk is the source of truth for identity/role; Neon's `users.role` is a one-way
  mirror** so we can JOIN/WHERE without an API call. Never write a role to Neon without
  writing Clerk first. Two paths keep it fresh — the webhook
  (`src/app/api/webhooks/clerk/route.ts`) and `ensureUser()` — made commutative by
  `UNIQUE(clerk_id)`. Read the comments in `src/lib/auth/ensure-user.ts` before touching
  either.
- **There is no `tailwind.config.ts`.** Tailwind 4 is CSS-first; the theme lives in
  `src/app/globals.css`.
- **Brand hexes are declared once**, in `:root` in `globals.css`, and every shadcn
  semantic token aliases them. Never hardcode a brand hex anywhere else. If a component
  needs to look on-brand, it should already.
- **All `coach_id` / `student_id` columns reference `users.id`**, never
  `coach_profiles.id`. Join to profiles via `coach_profiles.user_id`.
- **Money is integer cents.** Never float, never `numeric`. `splitAmount()` derives payout
  as `amount − commission`; don't "fix" it into two independent roundings or the
  `sessions_amount_split_balances` CHECK will eventually fire on a rounding cent.
- **The DB driver is `neon-http`, which has no interactive transactions.** Use
  `db.batch()`. See the comment in `src/db/index.ts` before reaching for
  `db.transaction()`.

## Commands

```bash
npm run dev          # Next dev server
npm run typecheck    # tsc --noEmit
npm run lint
npm test             # commission unit tests
npm run db:generate  # emit SQL from schema — review the file it writes
npm run db:migrate   # apply to Neon (uses the UNPOOLED url)
npm run db:studio
```

Migrations are `generate` + `migrate`, run manually, with `drizzle/` committed. They do
**not** run in the Vercel build — concurrent preview builds would race DDL against one
database. `db:push` is for local scratch against a Neon branch only.

## Integrations are optional by design

`src/lib/env.ts` splits env vars into two tiers. **Required** (Neon, Clerk) fail at boot.
**Optional** (Stripe, Calendly, Resend, cron) are checked at point of use via
`requireEnv()`, so the app builds and runs without them and each feature degrades with an
honest message instead of a crash.

This is deliberate — it let the platform be built before the accounts existed — and it is
a hazard at launch, because a missing key looks like a quiet feature gap rather than an
error. **`/admin/integrations` is the check.** Never move an optional key's validation to
module scope; a top-level throw breaks `next build` and every page that transitively
imports it.

## Launch checklist (when the keys land)

1. Fill `.env.local` (see the tiers in that file), then mirror every var into Vercel.
2. Set `NEXT_PUBLIC_APP_URL` to the real origin — Stripe return URLs, Calendly webhook
   registration, and every email link are built from it.
3. Clerk: claims editor (`{ "metadata": "{{user.public_metadata}}" }`) + webhook at
   `/api/webhooks/clerk`.
4. Stripe: enable Connect; webhook at `/api/webhooks/stripe` for
   `checkout.session.completed`, `charge.refunded`, `account.updated`.
5. Calendly: Teams org; run `ensureWebhookSubscription()` once per environment; set the
   org cancellation cutoff to 24h so its UX matches §11 (it is NOT the authority — we
   decide refunds).
6. Cron: `CRON_SECRET` set; `vercel.json` already schedules `/api/cron` hourly.
7. Make yourself admin: set `publicMetadata.role = "admin"` in the Clerk dashboard, then
   **sign out and back in** — the session token only reissues on refresh.
8. Verify at `/admin/integrations` that everything reads Live.

## Unresolved with the client

Spec §14 plus schema-shaped questions are open — see `docs/mentorreach-platform-spec.md`
§14 and the comments in `src/db/schema/`. The ones that are load-bearing:

- **§14.1 commission binding** — the per-pair reading is an ASSUMPTION. It's quarantined
  in `src/lib/commission.ts` (pure, no I/O, no callers except `getOrCreateLink`) so a
  different answer is a one-file change plus a test update.
- **§14.2 late cancel** — we assume the coach keeps the payout. Changing it is the
  `if (refundable)` branch in `src/lib/cancel.ts`.
- **§7 Q7 `path_certainty`** — stored 1–5; labels in `src/lib/survey-schema.ts` need
  confirming.
- **§10 vs §11 `refunded` vs `canceled_free`** — read contradictorily; built as sequential
  (intent → confirmed by `charge.refunded`), not alternative.
