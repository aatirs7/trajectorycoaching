'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Shared nav for the founder console — the same tabs on every admin and ops page, so the
 * two stop feeling like separate areas. Rendered by both the /admin and /ops layouts.
 */
const ITEMS = [
  { href: '/admin', label: 'Dashboard', exact: true },
  { href: '/admin/coaches', label: 'Coaches' },
  { href: '/admin/students', label: 'Students' },
  { href: '/ops/applications', label: 'Applications' },
  { href: '/admin/reports', label: 'Reports' },
  { href: '/admin/users', label: 'Accounts' },
  { href: '/admin/integrations', label: 'Integrations' },
  { href: '/ops', label: 'Ops board', exact: true },
]

export function ConsoleNav() {
  const pathname = usePathname()

  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto">
      {ITEMS.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`shrink-0 border-b-2 px-3.5 py-2.5 text-sm transition-colors ${
              active
                ? 'border-gold font-medium text-ink'
                : 'border-transparent text-slate hover:text-ink'
            }`}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
