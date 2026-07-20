import { SignInButton, UserButton } from '@clerk/nextjs'
import { auth } from '@clerk/nextjs/server'
import Image from 'next/image'
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
 *
 * TWO SEPARATE QUESTIONS, two separate sources — do not collapse them:
 *
 *   "Is this person signed in?"  → CLERK (`auth()`). Clerk is the source of truth for
 *      identity. Answering this from our Neon mirror is a bug: on a brand-new account the
 *      mirror row may not exist yet (the user.created webhook hasn't landed, and
 *      ensureUser() on the page races this component's query), so a genuinely signed-in
 *      user would be shown "Sign in".
 *
 *   "What can they see?"         → the Neon mirror, for role. If it hasn't landed yet we
 *      simply render no role-specific links for that one paint; the next navigation has
 *      them. Showing the wrong auth state is a bug; briefly showing fewer nav links isn't.
 *
 * Auth state is resolved on the server rather than with <Show>, so there's no
 * signed-out flash — and we need the role for the nav in the same pass anyway.
 */
export async function SiteHeader() {
  const { userId } = await auth()

  // Only touch the database when Clerk says there's someone to look up.
  const user = userId ? await getDbUser() : null

  const [surveyDone, unread] = user
    ? await Promise.all([
        user.role === 'student' ? hasCompletedSurvey(user.id) : Promise.resolve(true),
        unreadCount(user.id),
      ])
    : [false, 0]

  return (
    <header className="border-b border-line/15">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" aria-label="MentorReach home" className="flex items-center">
          {/*
           * Horizontal lockup (mark + wordmark), transparent PNG, trimmed to its artwork
           * so there is no dead margin inflating the box. Sized by HEIGHT with width auto
           * so the aspect ratio can never be squashed by a later tweak — the intrinsic
           * 1041x241 is passed to next/image purely so it can reserve space and avoid CLS.
           *
           * The mark is ink navy, so this only works on a light surface. The footer
           * wordmark stays live text for that reason.
           */}
          <Image
            src="/logo-mentorreach.png"
            alt="MentorReach"
            width={1041}
            height={241}
            priority
            className="h-9 w-auto"
          />
        </Link>

        <nav className="flex items-center gap-1">
          {userId ? (
            <>
              {/*
               * §2.3: no browse link for a student until the survey is done, because the
               * page would only bounce them back to it. Admins get the link regardless:
               * requireStudent() lets them through to inspect student surfaces, so
               * hiding it would just mean typing the URL.
               */}
              {(user?.role === 'student' && surveyDone) || user?.role === 'admin' ? (
                <NavLink href="/coaches">Browse</NavLink>
              ) : null}

              {user?.role === 'coach' ? <NavLink href="/coach">Coaching</NavLink> : null}
              {user?.role === 'admin' ? <NavLink href="/admin">Admin</NavLink> : null}

              {user && user.role !== 'admin' ? <NavLink href="/sessions">Sessions</NavLink> : null}

              {user ? (
                <NavLink href="/notifications">
                  Notifications
                  {unread > 0 ? (
                    <span className="ml-1.5 rounded-full bg-gold px-1.5 py-0.5 font-mono text-[10px] text-ink">
                      {unread}
                    </span>
                  ) : null}
                </NavLink>
              ) : null}

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
