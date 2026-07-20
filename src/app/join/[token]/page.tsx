import { eq } from 'drizzle-orm'
import Link from 'next/link'
import { ClaimButton } from './claim-button'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { db } from '@/db'
import { coachInvites } from '@/db/schema'
import { ensureUser } from '@/lib/auth/ensure-user'

export const metadata = { title: 'Your coach invite' }
export const dynamic = 'force-dynamic'

/** Kept out of the component body so the render stays pure (the authoritative expiry check
 *  is in claimInvite). */
function isExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return false
  return expiresAt.getTime() < Date.now()
}

/**
 * Coach invite landing (/join/<token>). The token is the capability: it's unguessable and
 * carries no data in the URL. Signed-out visitors are sent to sign-up/in with a redirect
 * back here; signed-in visitors claim it, which makes them a coach and starts onboarding.
 */
export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const invite = await db.query.coachInvites.findFirst({ where: eq(coachInvites.token, token) })

  const invalid = !invite || invite.status === 'revoked' || isExpired(invite.expiresAt)

  if (invalid) {
    return (
      <Frame>
        <h1 className="text-3xl">This invite isn&rsquo;t valid</h1>
        <p className="mt-3 text-slate">
          It may have been revoked or expired. If you think that&rsquo;s a mistake, ask whoever
          invited you for a fresh link.
        </p>
        <div className="mt-8">
          <Button asChild variant="outline">
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </Frame>
    )
  }

  const user = await ensureUser()
  const alreadyUsed =
    invite.status === 'accepted' && invite.acceptedUserId && invite.acceptedUserId !== user?.id

  if (alreadyUsed) {
    return (
      <Frame>
        <h1 className="text-3xl">This invite has already been used</h1>
        <p className="mt-3 text-slate">
          If that was you, just sign in to pick up where you left off.
        </p>
        <div className="mt-8">
          <Button asChild>
            <Link href="/sign-in">Sign in</Link>
          </Button>
        </div>
      </Frame>
    )
  }

  const greeting = invite.fullName ? invite.fullName.split(/\s+/)[0] : null
  const redirectBack = encodeURIComponent(`/join/${token}`)

  return (
    <Frame>
      <p className="label-mono">You&rsquo;re invited</p>
      <h1 className="mt-3 text-4xl">
        {greeting ? `Welcome, ${greeting}` : 'Welcome to MentorReach'}
      </h1>
      <p className="mx-auto mt-4 max-w-prose text-slate">
        You&rsquo;ve been invited to coach on MentorReach. We&rsquo;ll set you up with a profile,
        your rates, a calendar, and payouts — about ten minutes, and your profile goes live
        automatically once it&rsquo;s complete.
      </p>

      <Card className="mx-auto mt-8 max-w-md border-line/20 p-6">
        {user ? (
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-slate">Signed in as {user.email}.</p>
            <ClaimButton token={token} />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <Button asChild size="lg">
              <Link href={`/sign-up?redirect_url=${redirectBack}`}>Create your account</Link>
            </Button>
            <p className="text-sm text-slate">
              Already have an account?{' '}
              <Link
                href={`/sign-in?redirect_url=${redirectBack}`}
                className="underline decoration-gold underline-offset-4 hover:text-ink"
              >
                Sign in
              </Link>
            </p>
          </div>
        )}
      </Card>
    </Frame>
  )
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-20 text-center">{children}</main>
  )
}
