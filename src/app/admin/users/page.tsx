import { clerkClient } from '@clerk/nextjs/server'
import { desc } from 'drizzle-orm'
import { SuspendActions } from './suspend-actions'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { db } from '@/db'
import { users } from '@/db/schema'
import { requireAdmin } from '@/lib/auth/guards'

export const metadata = { title: 'Accounts' }
export const dynamic = 'force-dynamic'

/**
 * Spec §12 — "suspend/remove any account".
 *
 * Suspension state is read from CLERK, not our mirror: Clerk owns identity, and its
 * `banned` flag is the thing that actually blocks sign-in. Reading it from Neon would
 * let the two drift and show a "suspended" user who can still log in.
 */
export default async function AdminUsersPage() {
  await requireAdmin()

  const rows = await db.query.users.findMany({
    orderBy: [desc(users.createdAt)],
    limit: 200,
  })

  // One Clerk call for the page rather than one per row.
  let bannedClerkIds = new Set<string>()
  let clerkReachable = true

  try {
    const client = await clerkClient()
    const list = await client.users.getUserList({ limit: 500 })
    bannedClerkIds = new Set(list.data.filter((u) => u.banned).map((u) => u.id))
  } catch (err) {
    console.error('[admin/users] could not read Clerk user list', err)
    clerkReachable = false
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-14">
      <div className="text-center">
        <p className="label-mono">Admin</p>
        <h1 className="mt-3 text-4xl">Accounts</h1>
        <p className="mx-auto mt-3 max-w-prose text-slate">
        Suspending signs someone out immediately and blocks them from signing back in. For
          coaches it also pulls their profile out of browse.
        </p>
      </div>

      {!clerkReachable ? (
        <Card className="mt-8 border-gold bg-secondary p-5">
          <p className="text-sm">
            Couldn&rsquo;t reach Clerk, so suspension status below may be out of date.
          </p>
        </Card>
      ) : null}

      <div className="mt-8 space-y-3">
        {rows.map((u) => {
          const suspended = bannedClerkIds.has(u.clerkId)
          return (
            <Card key={u.id} className="border-line/20 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg leading-snug">{u.fullName ?? 'Unnamed'}</h2>
                  <p className="text-sm text-slate">{u.email}</p>
                  <p className="mt-1 font-mono text-[11px] text-slate uppercase">
                    joined {u.createdAt.toLocaleDateString('en-US', { dateStyle: 'medium' })}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {suspended ? <Badge variant="destructive">suspended</Badge> : null}
                  <Badge variant="secondary">{u.role}</Badge>
                </div>
              </div>

              {u.role === 'admin' ? (
                <p className="mt-4 border-t border-line/15 pt-4 text-sm text-slate">
                  Admins are managed from the Clerk dashboard.
                </p>
              ) : (
                <div className="mt-4 border-t border-line/15 pt-4">
                  <SuspendActions
                    userId={u.id}
                    name={u.fullName ?? u.email}
                    suspended={suspended}
                  />
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </main>
  )
}
