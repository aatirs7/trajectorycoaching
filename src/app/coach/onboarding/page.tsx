import { and, eq, inArray } from 'drizzle-orm'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AboutStep, FinishButton, HandbookStep, SessionsStep } from './onboarding-steps'
import { AvailabilityEditor } from '../availability/availability-editor'
import { PhotoUploader } from '../setup/fields/photo-uploader'
import { ResumeUploader } from '../setup/fields/resume-uploader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { db } from '@/db'
import {
  coachApplications,
  coachAvailabilityBlackouts,
  coachAvailabilityRules,
  coachInvites,
  coachOfferings,
  coachProfiles,
  users,
} from '@/db/schema'
import { requireUser } from '@/lib/auth/guards'
import { readViewAsCoachId } from '@/lib/auth/view-as'
import { INDUSTRIES } from '@/lib/coach-schema'
import { hasRealPhoto } from '@/lib/coach-publish'

export const metadata = { title: 'Get set up' }
export const dynamic = 'force-dynamic'

const STEPS = [
  { key: 'welcome', label: 'Welcome' },
  { key: 'about', label: 'About you' },
  { key: 'photo', label: 'Photo & resume' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'calendar', label: 'Availability' },
  { key: 'payouts', label: 'Payouts' },
  { key: 'handbook', label: 'Handbook' },
  { key: 'done', label: 'All set' },
] as const

type StepKey = (typeof STEPS)[number]['key']

/**
 * The guided coach onboarding. One step at a time; each substantive step reuses the same
 * validators and write helpers as /coach/setup (which stays as the returning-coach edit
 * surface). Admins can preview it read-only via "view as coach".
 */
export default async function CoachOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>
}) {
  const user = await requireUser()

  // Resolve whose onboarding we're rendering: the coach's own, or (for an admin) the coach
  // they're previewing read-only.
  let coachUserId = user.id
  let coachEmail = user.email
  let viewAs = false

  if (user.role === 'admin') {
    const targetId = await readViewAsCoachId()
    if (!targetId) redirect('/admin/coaches')
    const [targetUser, targetProfile] = await Promise.all([
      db.query.users.findFirst({ where: eq(users.id, targetId) }),
      db.query.coachProfiles.findFirst({ where: eq(coachProfiles.userId, targetId), columns: { id: true } }),
    ])
    if (!targetUser || !targetProfile) redirect('/admin/coaches')
    coachUserId = targetUser.id
    coachEmail = targetUser.email
    viewAs = true
  } else if (user.role === 'student') {
    redirect('/onboarding/survey')
  } else if (user.role !== 'coach') {
    redirect('/')
  }

  const profile = await db.query.coachProfiles.findFirst({
    where: eq(coachProfiles.userId, coachUserId),
  })
  const offerings = profile
    ? await db.query.coachOfferings.findMany({
        where: and(eq(coachOfferings.coachId, coachUserId), eq(coachOfferings.isActive, true)),
      })
    : []
  const [availabilityRules, blackouts] = profile
    ? await Promise.all([
        db.query.coachAvailabilityRules.findMany({ where: eq(coachAvailabilityRules.coachId, coachUserId) }),
        db.query.coachAvailabilityBlackouts.findMany({ where: eq(coachAvailabilityBlackouts.coachId, coachUserId) }),
      ])
    : [[], []]

  // Prefill (only before a profile exists): an accepted application, else a coach invite.
  let prefill: { industry?: string; currentTitle?: string; displayEmployerGenerally?: boolean } | null = null
  if (!profile && !viewAs) {
    const app = await db.query.coachApplications.findFirst({
      where: and(eq(coachApplications.email, coachEmail), eq(coachApplications.status, 'accepted')),
    })
    if (app) {
      prefill = {
        industry: INDUSTRIES.includes(app.field as (typeof INDUSTRIES)[number]) ? app.field : undefined,
        currentTitle: app.roleCompany,
        displayEmployerGenerally: app.employerVisibility === 'describe_generally',
      }
    } else {
      const inv = await db.query.coachInvites.findFirst({
        where: and(eq(coachInvites.email, coachEmail), inArray(coachInvites.status, ['pending', 'accepted'])),
      })
      if (inv) {
        prefill = {
          industry:
            inv.prefillField && INDUSTRIES.includes(inv.prefillField as (typeof INDUSTRIES)[number])
              ? inv.prefillField
              : undefined,
          currentTitle: inv.prefillTitle ?? undefined,
        }
      }
    }
  }

  const done: Record<StepKey, boolean> = {
    welcome: Boolean(profile),
    about: Boolean(profile?.currentTitle && profile?.bio),
    photo: hasRealPhoto(profile?.headshotUrl ?? null, profile?.isSeed ?? false),
    sessions: offerings.length > 0,
    calendar: availabilityRules.length > 0,
    payouts: Boolean(profile?.stripePayoutsEnabled),
    handbook: Boolean(profile?.handbookAckAt),
    done: Boolean(profile?.onboardingCompletedAt),
  }

  const requested = (await searchParams).step as StepKey | undefined
  const validRequested = requested && STEPS.some((s) => s.key === requested) ? requested : undefined
  // Default: first incomplete data step, else the finish.
  const firstIncomplete =
    (['about', 'photo', 'sessions', 'calendar', 'payouts', 'handbook'] as StepKey[]).find((k) => !done[k]) ??
    'done'
  const active: StepKey = validRequested ?? (profile ? firstIncomplete : 'welcome')

  const index = STEPS.findIndex((s) => s.key === active)
  const prev = index > 0 ? STEPS[index - 1] : null

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-14">
      {/* Progress */}
      <div className="flex items-center justify-center gap-1.5">
        {STEPS.map((s, i) => (
          <span
            key={s.key}
            aria-hidden
            className={`h-1.5 rounded-full transition-all ${
              i === index ? 'w-8 bg-gold' : done[s.key] ? 'w-4 bg-gold/60' : 'w-4 bg-line/20'
            }`}
          />
        ))}
      </div>
      <p className="mt-4 text-center label-mono">
        Step {index + 1} of {STEPS.length}
      </p>

      <div className="mt-8">
        {active === 'welcome' ? (
          <WelcomeStep />
        ) : active === 'about' ? (
          <StepFrame title="About you" intro="The essentials students see first.">
            <AboutStep
              values={{
                industry: profile?.industry ?? null,
                currentTitle: profile?.currentTitle ?? null,
                bio: profile?.bio ?? null,
                linkedinUrl: profile?.linkedinUrl ?? null,
                employerNote: profile?.employerNote ?? null,
                displayEmployerGenerally: profile?.displayEmployerGenerally ?? false,
                generalTitle: profile?.generalTitle ?? null,
              }}
              prefill={prefill}
            />
          </StepFrame>
        ) : active === 'photo' ? (
          <StepFrame title="Photo & resume" intro="A real photo is required. A resume is optional and just for us.">
            <div className="space-y-10">
              <PhotoUploader
                headshotUrl={profile?.headshotUrl ?? null}
                canUpload={Boolean(profile) && !viewAs}
                readOnlyNote={viewAs ? 'Read-only preview.' : undefined}
              />
              <ResumeUploader
                resumeUrl={profile?.resumeUrl ?? null}
                canUpload={Boolean(profile) && !viewAs}
                readOnlyNote={viewAs ? 'Read-only preview.' : undefined}
              />
              <div className="text-center">
                <Button asChild size="lg">
                  <Link href="/coach/onboarding?step=sessions">Continue</Link>
                </Button>
              </div>
            </div>
          </StepFrame>
        ) : active === 'sessions' ? (
          <StepFrame title="Sessions & pricing" intro="Set the lengths you offer and your rate for each.">
            <SessionsStep offerings={offerings.map((o) => ({ lengthMinutes: o.lengthMinutes, priceCents: o.priceCents }))} />
          </StepFrame>
        ) : active === 'calendar' ? (
          <StepFrame title="Your availability" intro="Set the hours you’re open to coach. We create the Zoom meeting when someone books.">
            <AvailabilityEditor
              rules={availabilityRules.map((r) => ({ id: r.id, weekday: r.weekday, startMinute: r.startMinute, endMinute: r.endMinute }))}
              blackouts={blackouts.map((b) => ({ id: b.id, day: b.day }))}
              settings={{
                timezone: profile?.timezone ?? 'America/New_York',
                bufferMinutes: profile?.bookingBufferMinutes ?? 0,
                minNoticeHours: profile?.minNoticeHours ?? 12,
                maxBookingsPerDay: profile?.maxBookingsPerDay ?? null,
              }}
              readOnly={viewAs}
            />
            <div className="mt-8 text-center">
              <Button asChild size="lg">
                <Link href="/coach/onboarding?step=payouts">Continue</Link>
              </Button>
            </div>
          </StepFrame>
        ) : active === 'payouts' ? (
          <StepFrame title="Payouts" intro="Connect Stripe so we can pay you after each session.">
            <PayoutsStep enabled={Boolean(profile?.stripePayoutsEnabled)} />
          </StepFrame>
        ) : active === 'handbook' ? (
          <StepFrame title="The Coach Handbook" intro="The standards every coach agrees to.">
            <HandbookStep
              signedName={profile?.handbookSignedName ?? null}
              signedAt={profile?.handbookAckAt?.toISOString() ?? null}
            />
          </StepFrame>
        ) : (
          <DoneStep viewAs={viewAs} />
        )}
      </div>

      {prev && active !== 'welcome' ? (
        <p className="mt-10 text-center">
          <Link
            href={`/coach/onboarding?step=${prev.key}`}
            className="text-sm text-slate underline decoration-gold underline-offset-4 hover:text-ink"
          >
            ← Back to {prev.label.toLowerCase()}
          </Link>
        </p>
      ) : null}
    </main>
  )
}

function StepFrame({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-center">
        <h1 className="text-3xl">{title}</h1>
        <p className="mx-auto mt-2 max-w-prose text-slate">{intro}</p>
      </div>
      <div className="mt-8">{children}</div>
    </div>
  )
}

function WelcomeStep() {
  return (
    <div className="text-center">
      <p className="label-mono">Welcome to MentorReach</p>
      <h1 className="mt-3 text-4xl">Let&rsquo;s get you set up</h1>
      <p className="mx-auto mt-4 max-w-prose text-slate">
        This takes about ten minutes. You&rsquo;ll add your profile and photo, set your rates,
        connect your calendar and payouts, and sign the handbook. Your profile goes live
        automatically the moment everything&rsquo;s done. There&rsquo;s no waiting on approval.
      </p>
      <Card className="mx-auto mt-8 max-w-md border-line/20 p-6 text-left">
        <p className="label-mono">Have these handy</p>
        <ul className="mt-3 space-y-1.5 text-sm text-slate">
          <li>· A real photo of yourself</li>
          <li>· Your resume or LinkedIn (optional)</li>
          <li>· The rates you want to charge</li>
          <li>· The weekly hours you&rsquo;re free to coach</li>
        </ul>
      </Card>
      <div className="mt-8">
        <Button asChild size="lg">
          <Link href="/coach/onboarding?step=about">Let&rsquo;s go</Link>
        </Button>
      </div>
    </div>
  )
}

function PayoutsStep({ enabled }: { enabled: boolean }) {
  return (
    <div className="space-y-6 text-center">
      {enabled ? (
        <p className="text-sm text-slate">✓ Your payouts are set up.</p>
      ) : (
        <p className="mx-auto max-w-md text-sm text-slate">
          We use Stripe to pay you out after each session. Connecting takes a couple of minutes
          and opens in the same tab. Come back here when you&rsquo;re done.
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild variant="outline">
          <Link href="/coach/payouts">{enabled ? 'Manage payouts' : 'Set up payouts'}</Link>
        </Button>
        <Button asChild size="lg">
          <Link href="/coach/onboarding?step=handbook">Continue</Link>
        </Button>
      </div>
    </div>
  )
}

function DoneStep({ viewAs }: { viewAs: boolean }) {
  const resources = [
    { href: '/coach', label: 'Your dashboard', blurb: 'Your checklist, sessions, and referral link.' },
    { href: '/coach/handbook', label: 'Coach Handbook', blurb: 'The standards and how sessions run.' },
    { href: '/coach/payouts', label: 'Payouts', blurb: 'Manage your Stripe payout account.' },
    { href: '/sessions', label: 'Your sessions', blurb: 'Upcoming and past bookings.' },
    { href: '/coach/setup', label: 'Edit your profile', blurb: 'Update anything, anytime.' },
    { href: '/coach/resources', label: 'Resources', blurb: 'Everything in one place.' },
  ]
  return (
    <div className="text-center">
      <p className="label-mono">All set</p>
      <h1 className="mt-3 text-4xl">You&rsquo;re ready</h1>
      <p className="mx-auto mt-4 max-w-prose text-slate">
        Here&rsquo;s everything you have. Your profile publishes automatically once every
        checklist item is green.
      </p>
      <div className="mt-8 grid gap-4 text-left sm:grid-cols-2">
        {resources.map((r) => (
          <Card key={r.href} className="border-line/20 p-5">
            <Link href={r.href} className="text-lg underline decoration-transparent underline-offset-4 hover:decoration-gold">
              {r.label}
            </Link>
            <p className="mt-1 text-sm text-slate">{r.blurb}</p>
          </Card>
        ))}
      </div>
      <div className="mt-10">
        {viewAs ? (
          <p className="text-sm text-slate">You&rsquo;re previewing this coach read-only.</p>
        ) : (
          <FinishButton />
        )}
      </div>
    </div>
  )
}
