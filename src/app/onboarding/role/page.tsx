import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { RolePicker } from './role-picker'
import { requireUser } from '@/lib/auth/guards'
import type { Role } from '@/types/globals'

export const metadata = { title: 'Choose your path' }

/**
 * Spec §3 — role is chosen at signup and drives everything after.
 *
 * The role is written to Clerk publicMetadata by a server action (never the client), and
 * mirrors into Neon via ensureUser() + the user.updated webhook.
 *
 * The "already chosen?" check reads publicMetadata STRAIGHT FROM CLERK. Not the two
 * obvious alternatives, each of which is wrong here in a way that only shows up in use:
 *
 *  - sessionClaims.metadata.role is undefined until the Clerk Dashboard claims editor is
 *    configured (a dashboard step with no code equivalent), and the token is only
 *    reissued on refresh — so it's stale exactly when this page re-renders after
 *    setRole(). A user who'd already chosen would see the picker again, click, and hit
 *    "Role is already set." Stuck.
 *
 *  - The Neon mirror can't answer this question AT ALL: users.role is NOT NULL and
 *    ensureUser() defaults it to 'student', so "hasn't chosen yet" and "chose student"
 *    are indistinguishable there. Reading the mirror here would redirect every new user
 *    to the survey and make it impossible to sign up as a coach.
 *
 * publicMetadata is the only source that distinguishes unset from set, and it's
 * authoritative and fresh. Guards elsewhere read the mirror, which is correct for THEM:
 * by then a role exists.
 */
export default async function RolePage() {
  await requireUser()

  const clerkUser = await currentUser()
  const chosen = clerkUser?.publicMetadata?.role as Role | undefined

  // Role is set once; don't offer to switch sides of the marketplace.
  if (chosen === 'student') redirect('/onboarding/survey')
  if (chosen === 'coach') redirect('/coach')
  if (chosen === 'admin') redirect('/admin')

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-20">
      <div className="text-center">
        <p className="label-mono">Welcome</p>
        <h1 className="mt-3 text-4xl">How will you use Trajectory?</h1>
        <p className="mx-auto mt-3 max-w-prose text-slate">
          This sets up your account. You can&rsquo;t switch later, so pick the one that fits.
        </p>
      </div>

      <RolePicker />
    </main>
  )
}
