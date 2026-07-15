import Link from 'next/link'

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line/15">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-8">
        <div>
          <p className="font-display text-base">Trajectory</p>
          <p className="mt-1 text-sm text-slate">Own your trajectory.</p>
        </div>

        <nav className="flex flex-wrap gap-5 text-sm text-slate">
          <Link href="/coaches" className="hover:text-ink">
            Browse coaches
          </Link>
          <Link href="/sign-up" className="hover:text-ink">
            Become a coach
          </Link>
        </nav>
      </div>
    </footer>
  )
}
