import { clerkMiddleware } from '@clerk/nextjs/server'

/**
 * Next.js 16 renamed the `middleware` file convention to `proxy` (the export is
 * `proxy`/default, not `middleware`). Clerk's own docs target proxy.ts for Next 16.
 *
 * This file does exactly ONE thing: attach Clerk's auth context to the request.
 *
 * There is deliberately no route protection here. Clerk now advises against auth checks
 * in middleware ("protect access as close to the resource as possible"), and
 * `createRouteMatcher()` is deprecated — it logs a runtime deprecation warning.
 *
 * It also fits the spec better: the §3 survey gate needs a database read, which does not
 * belong in a proxy that runs in front of the app. Gating lives at the resource, via
 * `requireRole()` in src/lib/auth/require-role.ts.
 */
export default clerkMiddleware()

export const config = {
  matcher: [
    // Everything except Next internals and static assets.
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for Clerk's auto-proxy path. `:path*` (not `(.*)`) also matches the
    // bare `/__clerk`, which the capture-group form misses.
    '/__clerk/:path*',
    '/(api|trpc)(.*)',
  ],
}
