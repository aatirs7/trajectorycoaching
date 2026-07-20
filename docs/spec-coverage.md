# Spec coverage — where each requirement lives

Maps `mentorreach-platform-spec.md` to the code, so this can be audited rather than taken
on trust. Sections refer to the spec.

## §2 Hard rules — enforced in logic, not docs

| Rule | Where it's enforced |
|---|---|
| §2.1 All payment on-platform | Only path to a session is Stripe Checkout (`lib/booking.ts`). `sessions` can only be created by the `checkout.session.completed` webhook. "Asked to pay off-platform" is a first-class report category (`app/report/actions.ts`). |
| §2.2 Commission frozen, no overrides | `UNIQUE(coach_id, student_id)` on `coach_student_links` — there is physically nowhere to put a second rate for a pair. `getOrCreateLink()` reads before it ever computes. All logic in `lib/commission.ts`, pure, no I/O. |
| §2.3 Students gated behind survey | **Gates BOOKING, not browsing** — see "Intentional change" below. `requireStudent()` in `lib/auth/guards.ts` gates on `completed_at IS NOT NULL` (not row existence), enforced inside the booking server action and `/book/complete`. |
| §2.4 Coaches gated behind approval | `coach_profiles.status` **DEFAULT 'pending'** (a DB default, not an app decision). `browseCoaches()`/`getPublicCoach()` only ever return `approved`. Re-checked at the money path in `createCheckout()`. |

## §3–§12

| Spec | Implementation |
|---|---|
| §3 Roles & onboarding | `app/onboarding/role`, `lib/auth/set-role.ts` (server action → Clerk `publicMetadata`; `admin` not self-assignable). Guards in `lib/auth/guards.ts`. |
| §4 Data model | `src/db/schema/*`. Deviations documented inline — see "Schema deviations" below. |
| §5 Coach profile | `app/coach/setup`, `lib/coach-schema.ts`. Referral code auto-generated (`lib/auth/referral.ts`). |
| §6 Commission & referral | `lib/commission.ts` (pure + tested), `lib/booking.ts#getOrCreateLink`, `app/r/[code]/route.ts`, `lib/auth/referral.ts`. |
| §7 Student survey | `app/onboarding/survey`, `lib/survey-schema.ts` — discriminated union on `education_level` makes Q2's conditional options enforceable server-side. |
| §8 Browse & book | `lib/browse.ts`, `app/coaches`, `app/coaches/[id]`, `lib/booking.ts`, `app/book/complete`. |
| §9 Calendly | `lib/calendly.ts`, `app/api/webhooks/calendly/route.ts`. Correlation is `utm_content=<session_id>` echoed back under `tracking`. |
| §10 Stripe Connect | `lib/stripe.ts`, `lib/booking.ts`, `app/api/webhooks/stripe/route.ts`, `app/coach/payouts`. Destination charge: `application_fee_amount` + `transfer_data.destination`. |
| §11 State machine & policy | `lib/sessions.ts` (pure, tested), `lib/cancel.ts`, `app/api/cron/route.ts`. |
| §12 Dashboards, notes, notifications, trust & safety | `app/sessions`, `app/notifications`, `app/report`, `app/admin/*`, `lib/notifications.ts`, `lib/email/*`. |

## Intentional change: coaches self-publish, no approval gate

**Deviates from §2.4 / §3.** The spec gates coaches behind manual admin approval (`pending`
→ approved). We personally select coaches by invitation and no longer run any automated
verification, so a review *queue* buys nothing and just delays invited coaches.

**Now:** a real coach's profile publishes ITSELF the moment its checklist is complete —
photo (their own upload), field, current role, bio, ≥1 session length + price, Calendly
connected, Stripe payouts enabled, and Coach Handbook acknowledged. All computed in
`src/lib/coach-publish.ts` (`isCoachLive`), mirrored as a SQL condition in `lib/browse.ts`
so browse and the checklist can't disagree. `coach_profiles.status` is now only an admin
kill switch (`suspended`); nothing blocks initial go-live.

**Verification claims removed.** No page says coaches are "verified against an employer".
The signal is honest and softer: "Hand-picked. We personally review every coach before
they join." LinkedIn is now optional context, not a gate.

**The photo guardrail is load-bearing here.** A real coach cannot publish without their
own uploaded photo, and `is_seed` + `resolveHeadshot()`/`hasRealPhoto()` mean a
placeholder face can never satisfy that requirement or render on a real profile — covered
by `src/lib/coach-publish.test.ts` and `src/lib/headshot.test.ts`. Photo upload uses Vercel
Blob (optional integration: `BLOB_READ_WRITE_TOKEN`); real coaches can't complete the
checklist until it's connected, the same way booking needs Stripe.

Seed/demo coaches are exempt from the checklist (live unless suspended) — they exist to
populate browse and carry placeholder faces, which is why `is_seed` gates both.

## Intentional change: browse is public, booking is gated

**Deviates from a literal §2.3 / §3.** §3 says middleware "blocks students without a
completed survey", which taken at face value puts a sign-in wall in front of `/coaches`
and `/coaches/[id]`.

That was built first and was wrong. It put a wall in front of the exact page the homepage
exists to send people to, made every coach profile invisible to search engines, and asked
a stranger to create an account and answer ten questions before seeing a single price. It
broke the homepage's own promise.

**Now:** `/coaches` and `/coaches/[id]` are public and read-only. Booking requires sign-in
plus a completed survey, enforced in `startBooking` (`app/coaches/[id]/actions.ts`) and at
`/book/complete` — not merely in the UI, since a Server Action is a POST that can be
replayed without the page rendering.

**Why this preserves the rule rather than breaking it:** §2.3's purpose is that we know
who a student is *before they transact*. That is intact. Reading a public profile costs
nothing and reveals nothing; the survey still stands between a student and their first
booking. `bookingGate()` in `lib/auth/guards.ts` computes what's missing so the panel can
ask for exactly that, instead of redirecting a stranger into a wall.

## Placeholder imagery, and the guardrail on it

Demo coaches carry generated portraits (`i.pravatar.cc`) so browse doesn't look empty in a
walkthrough. This is only safe because of one rule, enforced in data rather than by
discipline:

**A real coach profile can never render a generated face.** `coach_profiles.is_seed`
(DEFAULT false) marks demo rows, and `resolveHeadshot()` in `src/lib/headshot.ts` is the
single place an avatar is resolved. It refuses any known placeholder host on a non-seed
profile and falls back to initials — even if the URL was pasted in by a coach, copied from
seed data, or restored from a bad backup.

That matters because the site tells students every coach is "verified against their stated
employer". A stock face on a supposedly-vetted profile isn't a cosmetic slip; it makes the
vetting claim false at the most visible point on the page. Covered by
`src/lib/headshot.test.ts`.

The hero image (`picsum.photos`) is deliberately abstract, never a face: a generated face
there would imply a person who doesn't exist on a page promising real ones. Both hosts are
allowlisted in `next.config.ts` and **should be removed when real assets land**.

## Deliberate deviations, and why

- **`coach_profiles.current_role` → `current_title`** — `CURRENT_ROLE` is a reserved
  Postgres keyword, and `users.role` already means something entirely different.
- **Added `users.referred_by_coach_id`** — §6 requires it; §4 omits it.
- **Added `coach_offerings.is_active`** — `sessions.offering_id` references offerings with
  `onDelete: 'restrict'`, so a hard delete would orphan session history.
- **Added `sessions.link_id`** — makes commission provenance a join rather than an
  archaeology exercise. Supports the §2.2 audit story.
- **Added `student_surveys.help_with_other`** — §7 Q9 offers "Other (+text)" with no column
  in §4.
- **Added `sessions.reminder_sent_at`** — a time window is not an idempotency key; an
  hourly reminder job would otherwise re-send every tick.
- **Added `coach_profiles.calendly_scheduling_url`** — the API URI can't be iframed and the
  public slug can't be derived from it, so the §8 embed needs its own value.
- **`subscriptions` deferred** — §4 lists it under Phase 1.5; its shape depends on the
  undecided credits-ledger design.
- **`refunded` vs `canceled_free` built as sequential, not alternative** — §10 and §11 read
  contradictorily. `canceled_free` = intent at cancel time; `refunded` = fact once
  `charge.refunded` confirms. Refunds are async and need a state for the gap.

## Known limitations

- **Calendly event types are created by the coach, not by us.** §9 says "their event types
  created". Calendly has since added a Create Event Type endpoint, but its exact request
  shape couldn't be verified against live docs, and a wrong body would fail at runtime
  while looking like a working feature — on the path that decides whether a paid student
  can book. The lookup (`findEventTypeByDuration`) handles coach-created types and fails
  loudly. See the note in `lib/calendly.ts`.
- **Headshots are URLs, not uploads.** `<img>` with an arbitrary host, so `next/image` is
  bypassed. Revisit when images are hosted by us.
- **Stripe Checkout is hosted (redirect), not embedded.** §2.1 means "no off-platform
  arrangements" — money still flows through Stripe Connect with our application fee. An
  embedded Payment Element would give more brand control at the cost of owning the
  PaymentIntent lifecycle.

## Not built (explicitly out of scope per §13)

- **Phase 1.5** — subscriptions/credits, in-app messaging. (Reminders, listed under 1.5,
  ARE built, since §12 requires the notification.)
- **Phase 2** — public reviews/ratings, real-time availability filter in browse, annual
  coach membership fee, native in-platform video.

## Open questions that change code

| Question | The one place to change |
|---|---|
| §14.1 commission binding | `lib/commission.ts#resolveCommission` + its tests |
| §14.2 late cancel / no-show payout | the `if (refundable)` branch in `lib/cancel.ts` |
| §14.3 Calendly org model | `lib/calendly.ts` |
| §14.4 coach Stripe onboarding | `app/coach/payouts` builds the self-serve path, which an admin can also walk a coach through — a superset of either answer |
| §14.5 domain | blocks promoting Clerk to a production instance; dev keys until then |
| §7 Q7 `path_certainty` labels | `lib/survey-schema.ts#PATH_CERTAINTY_LABELS` |
