# MentorReach — Platform Build Spec

**Owner:** Aatir (full tech backend)
**Purpose:** Buildable, phased spec for a Preply-style two-sided coaching marketplace. Written to be fed to Claude Code / Opus as the source of truth.

---

## 0. Stack (locked)

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) |
| DB | Neon Postgres |
| ORM | Drizzle |
| Auth | Clerk (role-based) |
| Payments | Stripe Connect (Express accounts for coaches) |
| Booking / scheduling | Calendly (MentorReach-owned Teams org, coaches as hosts) |
| Email | Resend + React Email |
| Hosting | Vercel (GitHub-connected auto-deploy) |
| UI | Tailwind + shadcn/ui |

Deviates from Isaiah's brief (Supabase + Netlify) on purpose. Same product, my stack, since I maintain it. Nothing in the brief requires Supabase.

---

## 1. Brand tokens (apply platform-wide, not just homepage)

```
--ink:    #0E1826   /* dark navy, headings, primary */
--paper:  #F6F3EC   /* ivory background */
--gold:   #C89B3C   /* accent */
--slate:  #5B6472   /* muted text */
--line:   #2E4057   /* borders */
```

Fonts: **Fraunces** (headings/logo), **Inter** (body), **IBM Plex Mono** (small uppercase labels/tags).
Motto: **"Reach the people who've been there."**
Feel: warm, editorial, generous whitespace, soft rounded corners, no heavy shadows. Not a SaaS-dashboard look. This is a full rebuild, not a reskin of the current live site.

---

## 2. Hard rules (non-negotiable, enforce in logic not just docs)

1. **All payment happens on-platform.** No off-platform arrangements at any commission tier. Calendly handles time selection only; money always flows through Stripe Connect.
2. **Commission attribution is frozen and dumb by design.** Set once, never re-evaluated per booking, no manual overrides, no case-by-case. (See §6.)
3. **Students are gated behind the survey.** No browsing or booking until the in-app survey is complete.
4. **Coaches are gated behind approval.** New coach profiles are `pending` and invisible/unbookable until an admin approves.

---

## 3. Roles & onboarding

Role is chosen at signup (Clerk) and drives everything after.

**Student path:** sign up → mandatory in-app survey (§7) → survey completion unlocks browse/book.
**Coach path:** sign up → profile setup (§5) → `pending` → admin approval → live.
**Admin:** internal role, gated `/admin` routes.

Gating implementation: Clerk session + a `users.role` mirror in Neon. Middleware blocks students without a completed survey and hides coach-only/admin-only surfaces.

---

## 4. Data model (core tables)

Drizzle / Postgres. Names indicative; refine on build.

```
users
  id, clerk_id (unique), role (enum: student|coach|admin),
  email, full_name, created_at

student_surveys
  id, user_id (fk, unique), education_level (hs|college),
  grade_year, school, major (nullable), career_interest,
  target (nullable), path_certainty, prior_experience (nullable),
  help_with (jsonb array), heard_from (nullable), completed_at

coach_profiles
  id, user_id (fk, unique), industry, current_role, bio,
  headshot_url, linkedin_url, employer_note,
  referral_code (unique), calendly_user_uri,
  stripe_account_id, status (enum: pending|approved|suspended),
  approved_at, approved_by

coach_offerings
  id, coach_id (fk), length_minutes (30|45|60), price_cents
  -- a coach may have multiple

coach_student_links
  id, coach_id (fk), student_id (fk),
  commission_bps (2000 | 3000),   -- frozen at first binding
  sourced_via (enum: referral|platform),
  created_at
  UNIQUE(coach_id, student_id)

sessions
  id, coach_id (fk), student_id (fk), offering_id (fk),
  amount_cents, commission_cents, coach_payout_cents,
  status (enum: paid_unscheduled | booked | rescheduled |
          completed | canceled_free | canceled_late | refunded),
  stripe_payment_intent_id,
  calendly_event_uri (nullable), calendly_invitee_uri (nullable),
  scheduled_start (nullable), scheduled_end (nullable),
  created_at, canceled_at (nullable)

session_notes
  id, session_id (fk), coach_id (fk), body, created_at

reports
  id, reporter_id (fk), reported_user_id (fk),
  session_id (nullable), category, description,
  status (enum: open|reviewed|actioned), created_at

notifications
  id, user_id (fk), type, payload (jsonb), read_at, created_at

-- Phase 1.5
subscriptions
  id, student_id (fk), coach_id (fk),
  stripe_subscription_id, credits_remaining,
  status, current_period_end
```

---

## 5. Coach profile (setup form)

Name, photo, industry/field, current role, bio (what they help with + experience), session lengths offered + rate per length, LinkedIn URL (required for vetting), employer note. Referral code auto-generated. Calendly host link captured (or coach added to the MentorReach Calendly org and their event types created — see §9). Availability lives entirely in Calendly; no custom calendar.

---

## 6. Commission & referral attribution

Two tiers: **30%** platform-sourced, **20%** coach-sourced. Calculated per transaction from a frozen relationship value, never recomputed.

**Binding logic (keep it this rigid):**
- At student signup, capture `referred_by_coach_id` from a referral code if one was used (nullable, immutable after signup).
- The first time a student transacts with a given coach, create the `coach_student_links` row and freeze `commission_bps`:
  - if `coach_id == student.referred_by_coach_id` → **2000 bps (20%)**
  - else → **3000 bps (30%)**
- Every future session between that pair reads the frozen value. No re-evaluation, no overrides.

> **CONFIRM WITH ISAIAH (assumption made):** A referral code identifies exactly one coach, so a referred student is 20% *with that coach only*; every other coach they book is 30% (platform-sourced). A student who signs up with no code is 30% with everyone, permanently. This is the simplest reading of "determined once at signup" + "no case-by-case." Flagging in case he meant something else.

---

## 7. Mandatory student survey (in-app, exact questions)

Required step of student signup. Store in `student_surveys`. Gate browse/book on `completed_at`.

1. High school or college? (choice)
2. Grade/year? (choice, depends on Q1)
3. School name (text)
4. If college: major or intended major (text, skippable for HS)
5. What field/career are you interested in? (text)
6. Specific company, industry, or role you're targeting? (text, optional)
7. How set are you on that path? (choice: locked in ↔ exploring)
8. Internships / jobs / relevant experience so far? (text, optional)
9. What do you want help with? (checkboxes, multi): Internships, Full-time recruiting, Choosing a major, Resume review, Interview prep, Networking, Clubs & leadership, Figuring out the right path, College applications, SAT/ACT, Other (+text)
10. How did you hear about MentorReach? (text, optional)

---

## 8. Browse & book

**Browse:** grid of coach cards (photo, name, industry, bio snippet, starting price, rating once reviews exist). Filters: industry/field, price, session length. "View schedule" opens the coach's embedded Calendly.

**Coach profile page:** full bio, background, what they help with, rates, and the booking action.

**Booking flow (the important sequence):**
1. Student picks coach + session length.
2. Stripe Connect payment on-platform (§10). On success, create `sessions` row as `paid_unscheduled`.
3. Backend generates a **single-use Calendly scheduling link** for that coach's matching event type, tagged with `utm_content=<session_id>`.
4. Student picks a time in Calendly.
5. Calendly `invitee.created` webhook fires → match `session_id` from the tracking param → set `scheduled_start/end`, store Calendly URIs, move session to `booked`.

Payment before scheduling guarantees no unpaid holds and gives a clean object to correlate against.

---

## 9. Calendly integration

**Account model:** MentorReach owns a Calendly Teams org. Each approved coach is a host with event types matching their offered lengths (30/45/60). This keeps API access and webhooks centralized under one account rather than scattered across coaches' personal Calendlys.

**Needed capabilities (confirm current plan tier on Calendly's pricing/docs):** API access, webhook subscriptions, single-use scheduling links, UTM/tracking params echoed in webhook payloads.

**Correlation:** single-use link carries `utm_content=<session_id>`; Calendly returns it in the `invitee.created` payload under tracking. That is the join key back to the `sessions` row.

**Cancellation alignment:** set Calendly's cancellation cutoff to 24h so its UX matches our refund policy (§11). Refund eligibility is still decided by us in the webhook handler based on timing, not by Calendly.

**Webhooks to handle:**
- `invitee.created` → `booked`, store schedule + URIs.
- `invitee.canceled` → run cancellation logic (§11): `canceled_free` (≥24h, refund) or `canceled_late` (<24h, no refund).
- Reschedule → update `scheduled_start/end`, set `rescheduled`.

---

## 10. Stripe Connect flow

Coaches onboard as **Express** connected accounts (link surfaced at/after approval). MentorReach is the platform.

**Charge (destination charge, auto-split):**
- Create a PaymentIntent for the full session price.
- `application_fee_amount` = commission (from frozen `commission_bps`).
- `transfer_data.destination` = coach's `stripe_account_id`.
- Stripe routes coach payout automatically and keeps our fee. Store `commission_cents` and `coach_payout_cents` on the session.

**Refund (≥24h cancel):** refund the PaymentIntent; the transfer + application fee reverse. Session → `refunded` (via `canceled_free`).

**Late cancel / no-show (<24h):** no refund. Session → `canceled_late`.

> **CONFIRM WITH ISAIAH (assumption made):** on a late cancel / no-show the coach keeps the payout (that's the point of the penalty — student forfeits, coach is compensated for the held slot). Flag if he wants it to instead sweep back to the platform.

---

## 11. Session state machine & policies

States: `paid_unscheduled → booked → (rescheduled) → completed`, with cancel branches `canceled_free` (≥24h, full refund) and `canceled_late` (<24h or no-show, no refund).

- Free reschedule/cancel ≥24h before start.
- Inside 24h: no refund, no credit.
- No-show = late cancel.
- `completed` set after `scheduled_end` passes (cron/scheduled job) unless canceled.

---

## 12. Dashboards, notes, notifications, trust & safety

- **Coaching Sessions dashboard** (both roles): upcoming + past, with status.
- **Session notes:** coach can leave brief post-session notes visible to that student (optional feature, always available).
- **Notifications:** in-app `notifications` rows + Resend email for: booking confirmation, session reminder, coach approval status, new report. (Real-time not required for v1; email + in-app list is enough.)
- **Reports:** simple form for either party → `reports` → admin review queue.
- **Vetting:** LinkedIn URL required on coach profile; admin verifies stated employer before approval (manual).
- **Admin powers:** approve/reject coaches, review reports, suspend/remove any account.

---

## 13. Phasing

### Phase 0 — Foundation
Repo, Next.js App Router, Neon + Drizzle, Clerk with roles, Tailwind + shadcn/ui, brand tokens + fonts, Vercel deploy, env/secrets, core schema migration.

### Phase 1 — v1 (launchable)
Role selection • student survey + gating • coach profile/offerings/referral code • Calendly org setup + coach event types • admin approval queue + suspend/remove • browse/search/filter + coach cards + profile page • Calendly embed ("view schedule") • **booking → Stripe Connect payment → single-use Calendly link → webhook sync** • session state machine + 24h cancel/refund • sessions dashboard (both roles) • session notes • reports + admin review • email notifications (Resend) • full brand applied.

### Phase 1.5 — post-launch
Subscriptions / credit packages (Stripe Subscriptions + credits ledger + "no mid-cycle refund of unused credits, cancel stops future billing") • in-app messaging (start async/email, upgrade to real-time later) • automated reminders (24h / 1h).

### Phase 2 — later
Public reviews/ratings • real-time availability filter in browse • optional flat annual coach membership fee • native in-platform video (Zoom/Meet via Calendly is fine until then).

---

## 14. Open questions for Isaiah (before build)

1. Commission binding interpretation — confirm the per-pair reading in §6.
2. Late cancel / no-show — coach keeps payout? (§10)
3. Calendly org model — OK to run one MentorReach Teams account with coaches as hosts, vs. coaches connecting their own? (Affects vetting + API access.)
4. Coach Stripe onboarding — self-serve at approval, or admin-assisted for the first cohort?
5. Domain — keep `mentorreach.com` on the new Vercel deploy (move DNS), or stage on a subdomain first?
