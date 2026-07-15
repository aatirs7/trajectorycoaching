import { redirect } from 'next/navigation'
import { RolePicker } from './role-picker'
import { requireUser } from '@/lib/auth/guards'
import { getRole } from '@/lib/auth/require-role'

export const metadata = { title: 'Choose your path' }

/**
 * Spec §3 — role is chosen at signup and drives everything after.
 *
 * The role is written to Clerk publicMetadata by a server action (never the client), and
 * mirrors back into Neon via the user.updated webhook.
 */
export default async function RolePage() {
  await requireUser()

  // Already chosen? Role is set once; don't offer to change sides of the marketplace.
  const role = await getRole()
  if (role === 'student') redirect('/onboarding/survey')
  if (role === 'coach') redirect('/coach')
  if (role === 'admin') redirect('/admin')

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-20">
      <p className="label-mono">Welcome</p>
      <h1 className="mt-3 text-4xl">How will you use Trajectory?</h1>
      <p className="mt-3 text-slate">
        This sets up your account. You can&rsquo;t switch later, so pick the one that fits.
      </p>

      <RolePicker />
    </main>
  )
}
