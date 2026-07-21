# MentorReach — handoff

**The living state of the system.** What exists, what is switched on, what is not, and what
is still undecided.

> **Update this at the end of a working session, before you stop** — one pass covering
> everything that changed, not a running commentary. If you shipped a feature, flipped an
> integration on, made an architectural decision, or hit a trap worth remembering, it
> belongs here before the session ends. A handoff doc that lags the code is worse than
> none, because it is trusted.

- **Architecture and conventions:** [`../AGENTS.md`](../AGENTS.md) — read that first
- **Product spec (source of truth for product decisions):** [`mentorreach-platform-spec.md`](mentorreach-platform-spec.md)
- **Where the build deviates from the spec, and why:** [`spec-coverage.md`](spec-coverage.md)

Last updated: **2026-07-21**

## Terminology: mentor, not coach

The product calls them **mentors**, everywhere: UI copy, routes (`/mentors`, `/mentor/*`),
emails, and the database (`mentor_profiles`, `mentor_id`, `user_role = 'mentor'`). The
legal documents define "Mentor" as the contracting party, so a split would have been a gap
a dispute could find.

The rename went all the way down on purpose. It was done while there were **zero real
mentors, students or sessions** — the cheapest it would ever be — because a half-rename,
where the UI says mentor and the schema says coach, is how a codebase becomes permanently
confusing.

`/coaches` and `/coach/*` **308-redirect** to their new paths, preserving the rest of the
path (`/coaches/<id>` → `/mentors/<id>`). Those redirects are load-bearing: `/coaches` was
one of three URLs submitted to Google Search Console and was being crawled when the rename
landed. Do not remove them.

Migrations `0013` and `0014` are hand-written `ALTER ... RENAME` statements. drizzle-kit
cannot tell a rename from a drop-and-create without an interactive prompt, and its
generated version would have destroyed every row.

---

## Where it runs

| | |
|---|---|
| Production | https://mentorreach.com |
| Repo | github.com/aatirs7/trajectorycoaching (deploys from `main`) |
| Vercel project | `trajectorycoaching` under `aatir-siddiquis-projects` |
| Database | Neon Postgres (`ep-summer-boat`), 13 migrations applied |
| DNS | Vercel nameservers (`ns1/ns2.vercel-dns.com`) |

Deploys are automatic from `main`. **Environment variable changes need a redeploy** —
`NEXT_PUBLIC_*` values are inlined at build time, so editing them in Vercel does nothing
until the next build.

---

## Integration status

`/admin/integrations` is the authoritative live check. This table is the summary.

| Integration | Status | Notes |
|---|---|---|
| Neon Postgres | **Live** | Required; app will not boot without it |
| Clerk | **Live (production instance)** | Google sign-in, claims editor, webhook all configured |
| Resend | **Live** | `mentorreach.com` verified; sends from `hello@mentorreach.com` |
| Vercel Blob | **Live** | Mentor headshot uploads |
| Stripe Connect | **Not configured** | No keys yet. Blocks all payment and booking |
| Zoom | **Not configured** | No Server-to-Server OAuth app yet. Blocks booking |
| Cron | **Live** | `CRON_SECRET` set; `vercel.json` runs `/api/cron` hourly |

**Booking is off.** `bookingEnabled()` is `stripe && zoom` and neither is configured, so the
Book button is disabled with an honest reason rather than failing at checkout.

### Clerk specifics that are easy to get wrong

- The **claims editor** (Sessions → Customize session token → `{ "metadata": "{{user.public_metadata}}" }`)
  is not code and does not carry over between instances. Without it `sessionClaims.metadata.role`
  is `undefined` and every gated page silently redirects to `/` — for everyone, including admins.
- **Live keys must never be in `.env.local`.** A `pk_live_` encodes its domain
  (`clerk.mentorreach.com`) and rejects `localhost`, and a duplicate key later in a `.env`
  file overrides the earlier one — so a live pair pasted at the bottom silently disables the
  test pair above it. `src/lib/env.ts` now throws in development if it finds one.
- The production instance has **its own users**. Development accounts do not exist there.
- Admin is granted out of band: `npx tsx scripts/make-admin.ts you@example.com`, then
  **sign out and back in** (the session token only reissues on refresh).

---

## What is built

### Marketplace
- Public browse (`/mentors`) and mentor profiles (`/mentors/[id]`), both indexable
- Mentor application (`/mentors/apply`) → admin review at `/ops/applications`
- Invite-based mentor onboarding (`/join/[token]`) with self-serve setup
- Mentors self-publish: no approval gate, checklist computed in `src/lib/mentor-publish.ts`
- Student survey gate — enforced at **booking**, not browsing

### Scheduling (native — Calendly was removed)
- Mentors declare weekly availability + blackout dates (`mentor_availability_rules`,
  `mentor_availability_blackouts`)
- `src/lib/scheduler.ts` generates bookable slots — pure and unit-tested, including a DST
  boundary case
- Booking is **pick a time → then pay**: a `session_holds` row reserves the slot for the
  30-minute Stripe checkout window
- Zoom meeting created per booking from one platform account, so mentors need no Zoom setup

### Money
- Stripe Connect destination charges: `application_fee_amount` is commission,
  `transfer_data.destination` is the mentor's Express account
- Commission frozen per (mentor, student) pair at first transaction — `UNIQUE(mentor_id, student_id)`
- Integer cents everywhere; `splitAmount()` derives payout as `amount − commission`
- 24-hour cancellation policy; **we** decide refunds, not any external tool

### Legal and consent
- Five documents at `/legal/*`, public and indexable, versioned with a content hash
- **Students and mentors** accept Terms + Privacy via a required checkbox at role
  selection; `setRole()` writes both acceptance rows server-side
- **Mentors** sign the Agreement and Handbook at `/mentor/agreement`, with the full text of
  both rendered inline on the page where they sign — a typed legal name, not a checkbox
  against a link
- `legal_acceptances` is append-only and records version, content hash, IP and user agent.
  Re-acceptance is a new row, never an update
- **Publishing requires a current-version signature**, enforced in `isMentorLive()` and
  mirrored in `liveMentorSql()` so browse and the checklist cannot disagree
- `/admin/agreements` — the register: every acceptance, filterable by document, flagging
  signatures made against an outdated version

### Internal
- `/ops` — shared founder task board, two-level hierarchy (workstream → sub-task)
- `/ops/overview` — per-founder dashboard: progress, completion timeline, open work.
  Click a founder to filter (`?who=Aatir`)
- `/ops/expenses` — business expense ledger. DB-backed (`expenses` table), founders-only.
  Log a spend (date, description, vendor, amount, category, who paid, receipt link, notes);
  summaries by month and by category; "owed back" tile totals unreimbursed personal spend
  per founder; CSV export of the current filter. Refunds/credits are negative amounts and
  net out on their own. All arithmetic is pure in `src/lib/expenses.ts` and unit-tested
  (`expenses.test.ts`, 29 cases) — money is integer cents, dates are stored as `date`
  strings (no timezone), and "this month" is computed in `America/New_York` (`BUSINESS_TZ`),
  not the viewer's zone. No relation to `sessions`/Stripe — that is revenue; this is spend.
- `/ops/llc` — Virginia LLC formation wizard (static, localStorage progress)
- `/admin/*` — mentors, students, accounts, reports, integrations
- Admin "view as mentor" — read-only preview via an httpOnly cookie, honored only for admins

### SEO
- `robots.txt` and a dynamic `sitemap.xml`, submitted and accepted in Google Search Console
- Open Graph + Twitter cards; generated share images, including a per-mentor card
- Structured data: Organization, WebSite, Person, Service, Offer, Breadcrumbs, FAQ
- 28 private routes marked `noindex`

**Seed mentors are excluded from all of it** — no sitemap entry, `noindex`, and no `Person`
structured data. Every mentor currently on the site is invented and carries a real employer's
name, so indexing them would ask Google to catalogue fabricated professionals under this
domain. `liveMentorSql()` still treats them as live, because "visible to a person" and "safe
to hand a crawler" are different questions.

---

## Known gaps and things that will bite

**The homepage claims mentors that do not exist.** The "Hand-picked mentors from Figma,
Evercore, SpaceX…" strip is derived from the live roster so it can never go stale — but the
roster is 6 seed profiles and **0 real mentors**. It is a false claim to human visitors, and
`noindex` does nothing about it. Either clear the seed data or hide the strip before any
real traffic arrives.

**Every public page renders per request.** `SiteHeader` calls Clerk's `auth()`, which reads
cookies and opts every route out of static rendering — homepage and mentor profiles included.
Not an indexing blocker, but TTFB is on the critical path.

**Industry landing pages are the next SEO lever, and must wait.** Built against 6 seed
mentors they would be thin auto-generated category pages, which is the doorway-page pattern
Google devalues. Onboard real mentors first.

**Neon holds users from BOTH Clerk instances.** Development and production are separate
Clerk instances sharing one database, so the same person can have two `users` rows with
different `clerk_id`s — `aatirsiddiqui1@gmail.com` currently does. Nothing breaks
(`UNIQUE(clerk_id)` holds and every guard reads by `clerk_id`), but the two identities do
not share data: sessions, links and acceptances recorded against the dev account are
invisible to the production one. Worth clearing the dev-era rows before launch.

**Consent gaps are detectable.** Recording terms/privacy acceptance is non-fatal in
`setRole()`, so a failed write leaves an account with a role and no consent record — the
exact gap the table exists to close. Three things make that visible rather than silent:
a greppable `[LEGAL-CONSENT-GAP]` error log, `usersMissingConsent()`, a warning panel on
`/admin/agreements`, and a `consentGaps` count on `/api/health` for monitoring.

Remediation is to **ask the person to accept again**, never to insert a row on their
behalf. We know the write failed; we do not know they ticked the box, and a consent record
we cannot evidence makes every other row less trustworthy.

**The Clerk sign-in card still reads "Trajectory Coaching."** That is the Clerk
*application name*, set per-instance in the dashboard, not in code — nothing in this repo
can fix it. It is the first thing a prospective mentor sees when signing up, and the nine
founding mentors have never seen the old brand. Change it on the production instance
before they are invited.

Note the repo and Vercel project are also still named `trajectorycoaching`. Those are
external identifiers, deliberately left alone: renaming the repo rewrites the git remote
and the Vercel project for no user-visible gain.

**Legal documents are drafts with unresolved placeholders.** `[LEGAL ENTITY NAME]`,
`[STATE]`, `[SUPPORT EMAIL]`, `[MAILING ADDRESS]`, the arbitration choice in the Terms and
the non-circumvention period in the Mentor Agreement all still need filling, and all five
need an attorney's review before anyone signs. A dev-only banner lists the unresolved
placeholders on each `/legal/*` page; it never renders in production.

**Editing a legal document requires a version bump.** Full procedure in
[`legal-version-bumps.md`](legal-version-bumps.md). `src/lib/legal.test.ts` locks each
document's SHA-256 to its version and fails if the text changes without one.

**Fill the legal placeholders BEFORE the founding mentors sign.** A version bump
unpublishes every mentor who signed the previous version — that is the intended behaviour
of the publishing gate. Doing it before anyone has signed costs nothing; doing it after
takes all nine offline until they re-sign.

---

## Open product decisions

Tracked in spec §14; these are the load-bearing ones.

- **§14.1 commission binding** — the per-pair reading is an assumption, quarantined in
  `src/lib/commission.ts` so a different answer is a one-file change plus a test update
- **§14.2 late cancel** — we assume the mentor keeps the payout; changing it is the
  `if (refundable)` branch in `src/lib/cancel.ts`
- **§7 Q7 `path_certainty`** — stored 1–5, labels need confirming
- **Zoom host model** — the platform account hosts; mentors get the `start_url`. Per-mentor
  Zoom accounts would be a `zoom.ts` change plus a `zoom_user_id` column

---

## Next steps, in order

1. **Stripe** — enable Connect, add keys, webhook at `/api/webhooks/stripe` for
   `checkout.session.completed`, `charge.refunded`, `account.updated`
2. **Zoom** — Server-to-Server OAuth app, all three credentials (booking needs Stripe *and* Zoom)
3. **Onboard the 9 founding mentors** — unblocks everything below
4. **Clear or hide the seed roster** once real mentors publish
5. **Industry landing pages**, once there are real people behind them
