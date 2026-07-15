import { SignInButton, UserButton } from '@clerk/nextjs'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { getDbUser } from '@/lib/auth/ensure-user'
import { hasCompletedSurvey } from '@/lib/auth/guards'
import { unreadCount } from '@/lib/notifications'

/**
 * Spec §3 — "hides coach-only/admin-only surfaces".
 *
 * This is presentation only. Every destination re-checks authorization at the resource,
 * because hiding a link is not access control.
 */
export async function SiteHeader() {
  const user = await getDbUser()

  const [surveyDone, unread] = user
    ? await Promise.all([
        user.role === 'student' ? hasCompletedSurvey(user.id) : Promise.resolve(true),
        unreadCount(user.id),
      ])
    : [false, 0]

  return (
    <header className="border-b border-line/15">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="font-display text-lg tracking-tight">
          Trajectory
        </Link>

        <nav className="flex items-center gap-1">
          {user ? (
            <>
              {/* §2.3: no browse link until the survey is done — the page would bounce them. */}
              {user.role === 'student' && surveyDone ? (
                <NavLink href="/coaches">Browse</NavLink>
              ) : null}

              {user.role === 'coach' ? <NavLink href="/coach">Coaching</NavLink> : null}
              {user.role === 'admin' ? <NavLink href="/admin">Admin</NavLink> : null}

              {user.role !== 'admin' ? <NavLink href="/sessions">Sessions</NavLink> : null}

              <NavLink href="/notifications">
                Notifications
                {unread > 0 ? (
                  <span className="ml-1.5 rounded-full bg-gold px-1.5 py-0.5 font-mono text-[10px] text-ink">
                    {unread}
                  </span>
                ) : null}
              </NavLink>

              <div className="ml-2">
                <UserButton />
              </div>
            </>
          ) : (
            <>
              <SignInButton mode="modal">
                <Button variant="ghost" size="sm">
                  Sign in
                </Button>
              </SignInButton>
              <Button asChild size="sm">
                <Link href="/sign-up">Get started</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-1.5 text-sm text-slate transition-colors hover:bg-secondary hover:text-ink"
    >
      {children}
    </Link>
  )
}
