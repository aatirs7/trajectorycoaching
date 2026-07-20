import Link from 'next/link'

/**
 * Ink block, deliberately. An ivory footer on an ivory page just dissolves — the page
 * needs a bottom edge. Depth from a color block, not a shadow (§1).
 */
export function SiteFooter() {
  return (
    <footer className="mt-auto bg-ink text-paper">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-start justify-between gap-8 px-6 py-12">
        <div>
          <p className="font-display text-xl">MentorReach</p>
          <p className="mt-1.5 text-sm text-paper/60">Reach the people who&rsquo;ve been there.</p>
          <span className="mt-4 block h-px w-10 bg-gold" />
        </div>

        <nav className="flex flex-wrap gap-x-10 gap-y-3 text-sm">
          <div className="space-y-2">
            <p className="font-mono text-[10px] tracking-widest text-gold uppercase">Students</p>
            <Link href="/coaches" className="block text-paper/70 hover:text-paper">
              Browse coaches
            </Link>
            <Link href="/sessions" className="block text-paper/70 hover:text-paper">
              Your sessions
            </Link>
          </div>
          <div className="space-y-2">
            <p className="font-mono text-[10px] tracking-widest text-gold uppercase">Coaches</p>
            <Link href="/coaches/apply" className="block text-paper/70 hover:text-paper">
              Become a coach
            </Link>
            <Link href="/coach/handbook" className="block text-paper/70 hover:text-paper">
              Coach handbook
            </Link>
            <Link href="/coach" className="block text-paper/70 hover:text-paper">
              Your coaching
            </Link>
          </div>
        </nav>
      </div>

      <div className="border-t border-paper/10">
        <div className="mx-auto w-full max-w-5xl px-6 py-5">
          <p className="text-xs text-paper/40">
            © {new Date().getFullYear()} MentorReach
          </p>
        </div>
      </div>
    </footer>
  )
}
