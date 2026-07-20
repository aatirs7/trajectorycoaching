import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { requireCoach } from '@/lib/auth/guards'

export const metadata = { title: 'Resources' }

/**
 * The coach's resource hub — everything they have in one place. Doubles as the final
 * onboarding step's destination and a permanent link from the dashboard. Deliberately a
 * plain page of cards, not an overlay tour.
 */
export default async function CoachResourcesPage() {
  // requireCoach so an admin previewing (view-as) also sees it; it renders no coach data.
  await requireCoach()

  const groups: Array<{ title: string; items: Array<{ href: string; label: string; blurb: string; external?: boolean }> }> = [
    {
      title: 'Your coaching',
      items: [
        { href: '/coach', label: 'Dashboard', blurb: 'Your publish checklist, sessions, and referral link.' },
        { href: '/coach/setup', label: 'Edit your profile', blurb: 'Update your field, role, bio, photo, and rates.' },
        { href: '/sessions', label: 'Your sessions', blurb: 'Upcoming and past bookings.' },
        { href: '/coach/payouts', label: 'Payouts', blurb: 'Manage your Stripe payout account.' },
      ],
    },
    {
      title: 'Standards & support',
      items: [
        { href: '/coach/handbook', label: 'Coach Handbook', blurb: 'How sessions run, the code of conduct, payments, and cancellations.' },
        { href: 'mailto:support@mentorreach.com', label: 'Get help', blurb: 'Questions about anything? Email us.', external: true },
      ],
    },
  ]

  return (
    <main className="mx-auto w-full max-w-4xl flex-1">
      <div className="text-center">
        <p className="label-mono">Resources</p>
        <h1 className="mt-2 text-3xl sm:text-4xl">Everything you have</h1>
        <p className="mx-auto mt-2 max-w-prose text-slate">
          The tools, standards, and support that come with coaching on MentorReach.
        </p>
      </div>

      {groups.map((g) => (
        <section key={g.title} className="mt-8">
          <h2 className="text-center text-2xl">{g.title}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {g.items.map((item) => (
              <Card key={item.href} className="border-line/20 p-5">
                {item.external ? (
                  <a
                    href={item.href}
                    className="text-lg underline decoration-transparent underline-offset-4 hover:decoration-gold"
                  >
                    {item.label}
                  </a>
                ) : (
                  <Link
                    href={item.href}
                    className="text-lg underline decoration-transparent underline-offset-4 hover:decoration-gold"
                  >
                    {item.label}
                  </Link>
                )}
                <p className="mt-1 text-sm text-slate">{item.blurb}</p>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </main>
  )
}
