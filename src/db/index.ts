import 'server-only'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { env } from '@/lib/env'
import * as schema from './schema'

/**
 * Driver choice: neon-http (not node-postgres, not neon-serverless).
 *
 * Vercel functions don't reuse connections across invocations, so a pg.Pool leaks
 * connections until Neon's limit is hit. HTTP has the lowest cold-start cost for the
 * one-or-two-queries-per-request shape of Phase 0 and most of Phase 1.
 *
 * THE CATCH: neon-http does NOT support interactive transactions
 * (`db.transaction(async tx => …)`). It does support `db.batch()` — multiple
 * statements in one atomic round-trip. Phase 1's booking flow (insert
 * coach_student_links + insert sessions atomically) is expressible as a batch().
 *
 * If a future route genuinely needs an interactive transaction, add a SECOND export
 * here backed by `drizzle-orm/neon-serverless` (WebSocket Pool) and use it only for
 * that route. One-file change, paid for at the right time — don't preemptively adopt
 * WebSockets to buy a transaction we may never need.
 */
type Db = ReturnType<typeof create>

function create() {
  return drizzle({ client: neon(env.DATABASE_URL), schema })
}

let cached: Db | null = null

function getDb(): Db {
  if (!cached) cached = create()
  return cached
}

/**
 * Constructed on FIRST USE, not at import — for the same reason env validation is lazy
 * (see the comment in lib/env.ts). `next build` evaluates every module to collect page
 * data, so building the client at module scope would read env.DATABASE_URL at BUILD time
 * and fail the build on a deploy that hasn't had its variables set yet.
 *
 * The Proxy keeps the ergonomics of a plain export (`db.query.users…`, `db.insert(…)`)
 * while deferring the connection. Methods are bound to the real instance so drizzle's
 * internal `this` still resolves.
 */
export const db = new Proxy({} as Db, {
  get: (_target, prop: string | symbol) => {
    const instance = getDb()
    const value = Reflect.get(instance, prop, instance)
    return typeof value === 'function' ? value.bind(instance) : value
  },
})

export { schema }
