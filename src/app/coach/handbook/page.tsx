import Link from 'next/link'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'

export const metadata = {
  title: 'Coach Handbook',
  description:
    'How we expect coaches to operate on MentorReach. Completing onboarding means you agree to these standards.',
}

/**
 * Public, no login — an invited coach reads this before signing up, and the onboarding
 * checklist links here for the required acknowledgment. Presented as a guide (jump nav,
 * a session-lifecycle timeline, conduct cards) rather than a wall of prose. Content is
 * authored in the site's type system so it uses the real heading/label styles.
 */
export default function CoachHandbookPage() {
  return (
    <main className="flex-1">
      <div className="mx-auto w-full max-w-3xl">
        {/* Hero */}
        <header className="rounded-2xl border border-line/20 bg-sand p-8 text-center sm:p-10">
          <p className="label-mono">For coaches</p>
          <h1 className="mt-3 text-4xl leading-tight sm:text-5xl">Coach Handbook</h1>
          <p className="mx-auto mt-4 max-w-prose leading-relaxed text-slate">
            How we expect coaches to operate on MentorReach. Completing onboarding means you agree
            to these standards. Read it once. It&rsquo;s short on purpose.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Meta>~4 min read</Meta>
            <Meta>Required to publish</Meta>
            <Meta>Last reviewed 2026</Meta>
          </div>
        </header>

        {/* Jump nav */}
        <nav aria-label="Sections" className="mt-6 flex flex-wrap justify-center gap-2">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="rounded-full border border-line/25 px-3.5 py-1.5 text-sm text-slate transition-colors hover:border-gold hover:text-ink"
            >
              {s.nav}
            </a>
          ))}
        </nav>

        {/* What we are */}
        <Section id="what-we-are" eyebrow="Start here" title="What we are">
          <P>
            MentorReach connects students with people who already have the job or seat they are
            aiming for. Students come here for honest, specific, useful conversations. Not
            motivation, not fluff, not a sales pitch. Your value is that you did the thing they are
            trying to do, and you will tell them the truth about it.
          </P>
          <P className="text-ink">Everything below protects that.</P>
        </Section>

        {/* Session lifecycle — a timeline */}
        <Section
          id="a-session"
          eyebrow="The work"
          title="How a session runs"
          intro="Three moments, one standard: come prepared, be useful, follow through."
        >
          <ol className="mt-2 space-y-4">
            {LIFECYCLE.map((phase, i) => (
              <li
                key={phase.title}
                className="relative rounded-xl border border-line/20 bg-raised p-5 pl-14"
              >
                <span
                  aria-hidden
                  className="absolute top-5 left-5 flex size-6 items-center justify-center rounded-full bg-ink font-mono text-xs text-paper"
                >
                  {i + 1}
                </span>
                <h3 className="font-display text-lg">{phase.title}</h3>
                <Bullets items={phase.items} className="mt-3" />
              </li>
            ))}
          </ol>
        </Section>

        {/* Code of conduct — rule grid */}
        <Section
          id="conduct"
          eyebrow="Non-negotiable"
          title="Code of conduct"
          intro="These are not suggestions. Breaking them can get you removed."
        >
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {CONDUCT.map((rule) => (
              <div key={rule.title} className="rounded-xl border border-line/20 p-4">
                <p className="font-medium text-ink">{rule.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-slate">{rule.body}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Payments */}
        <Section id="payments" eyebrow="Getting paid" title="Payments">
          <Bullets
            items={[
              'You set your own rates and the session lengths you offer.',
              'Payment runs through Stripe. After each completed session, your earnings are paid out to your connected account automatically, so you never chase an invoice.',
              'MentorReach takes a platform commission on each session. The rest is yours.',
              'You are an independent contractor, not an employee. You handle your own taxes on what you earn, and Stripe provides your tax documentation directly.',
            ]}
          />
        </Section>

        {/* Cancellations */}
        <Section
          id="cancellations"
          eyebrow="Time & no-shows"
          title="Cancellations and reschedules"
        >
          <Bullets
            items={[
              'Students can cancel or reschedule free up to 24 hours before a session. Inside 24 hours, the session is non-refundable and you are paid for the held time.',
              'The same 24-hour standard applies to you. Cancel or reschedule with as much notice as possible.',
              'A no-show on your part is the fastest way off the platform. Students trusted you with their time and money.',
            ]}
          />
        </Section>

        {/* Removal — warning callout */}
        <section id="removal" className="mt-10 scroll-mt-6">
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center sm:p-8">
            <p className="label-mono text-destructive">Grounds for removal</p>
            <h2 className="mt-2 font-display text-2xl leading-snug">What gets you removed</h2>
            <p className="mx-auto mt-3 max-w-prose leading-relaxed text-ink/90">
              We personally selected every coach here, and we will remove anyone who breaks that
              trust. Grounds for removal include off-platform payment, misrepresenting your
              background, any form of harassment or discrimination, repeated late cancellations or
              no-shows, and sharing what students tell you in confidence.
            </p>
          </div>
        </section>

        {/* Closing */}
        <Section id="the-bar" eyebrow="The point" title="The bar we hold">
          <P>
            We tell students that a session here is a real conversation with someone who did the
            thing they are trying to do, and that we personally review every coach before they
            join. Your job is to make that true every single time. If every student leaves thinking{' '}
            <em>that was worth it, and that person was honest with me</em>, we are doing this right.
          </P>
        </Section>

        {/* Acknowledgment */}
        <div className="mt-12 rounded-2xl border border-line/20 bg-secondary p-8 text-center">
          <p className="font-display text-xl">You agree to the handbook when you complete onboarding.</p>
          <Button asChild size="lg" className="mt-5">
            <Link href="/coach/setup">Continue setup</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}

/* ---- Content ------------------------------------------------------------ */

const SECTIONS = [
  { id: 'what-we-are', nav: 'What we are' },
  { id: 'a-session', nav: 'A session' },
  { id: 'conduct', nav: 'Conduct' },
  { id: 'payments', nav: 'Payments' },
  { id: 'cancellations', nav: 'Cancellations' },
  { id: 'removal', nav: 'Removal' },
  { id: 'the-bar', nav: 'The bar' },
]

const LIFECYCLE: Array<{ title: string; items: string[] }> = [
  {
    title: 'Before a session',
    items: [
      'Read the student’s survey and goals before you join. You have their year, field, and what they asked for help with, so don’t make them repeat it.',
      'Be on time. Join at the scheduled minute, not five past.',
      'If you can’t make it, cancel or reschedule at least 24 hours ahead so the student isn’t left waiting.',
    ],
  },
  {
    title: 'During a session',
    items: [
      'Lead with substance. The student paid for your specific experience, so give them the real version, including the parts that are uncomfortable to hear.',
      'Be direct and honest. If their resume isn’t landing or their target is unrealistic, say so plainly and kindly.',
      'Keep it actionable. They should leave with clear next steps, not vague encouragement.',
      'Stay in your lane. Speak to what you actually know; if something is outside your experience, say so rather than guessing.',
    ],
  },
  {
    title: 'After a session',
    items: [
      'Leave brief session notes when it helps the student remember what to do next. Optional, but appreciated.',
      'Don’t promise ongoing free help outside the platform. If they want more time, they book more time.',
    ],
  },
]

const CONDUCT: Array<{ title: string; body: string }> = [
  {
    title: 'Everything stays on-platform',
    body: 'All scheduling and all payment happen through MentorReach. Never arrange sessions or take payment off-platform, at any commission tier. Being asked to, or asking a student to, is a serious violation.',
  },
  {
    title: 'Be who you say you are',
    body: 'Represent your role, employer, and experience accurately. No inflation, no borrowed credentials.',
  },
  {
    title: 'No guarantees',
    body: 'You don’t promise a job, an admission, an offer, or any specific outcome. You share experience and honest guidance, and nothing more is promised.',
  },
  {
    title: 'Confidentiality',
    body: 'What a student shares with you stays between you. Don’t repeat, share, or post anything from a session.',
  },
  {
    title: 'Professional conduct always',
    body: 'No harassment, no discrimination, no romantic or sexual advances, no pressure. Treat every student with respect regardless of background.',
  },
  {
    title: 'No outside solicitation',
    body: 'Don’t use sessions to recruit students into other services, sell them something, or push them off the platform.',
  },
]

/* ---- Primitives --------------------------------------------------------- */

function Section({
  id,
  eyebrow,
  title,
  intro,
  children,
}: {
  id: string
  eyebrow: string
  title: string
  intro?: string
  children: ReactNode
}) {
  return (
    <section id={id} className="mt-10 scroll-mt-6">
      <div className="text-center">
        <p className="label-mono">{eyebrow}</p>
        <h2 className="mt-2 font-display text-2xl leading-snug">{title}</h2>
        {intro ? <p className="mx-auto mt-2 max-w-prose text-slate">{intro}</p> : null}
      </div>
      <div className="mt-5 space-y-3">{children}</div>
    </section>
  )
}

function P({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`max-w-prose leading-relaxed text-ink/90 ${className}`}>{children}</p>
}

function Meta({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-line/30 bg-paper/60 px-3 py-1 font-mono text-xs text-slate">
      {children}
    </span>
  )
}

function Bullets({ items, className = '' }: { items: string[]; className?: string }) {
  return (
    <ul className={`space-y-2.5 ${className}`}>
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 leading-relaxed text-ink/90">
          <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-gold" />
          <span className="max-w-prose">{item}</span>
        </li>
      ))}
    </ul>
  )
}
