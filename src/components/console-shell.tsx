import { ConsoleNav } from './console-nav'

/**
 * The founder console frame: a title bar + shared nav on top of every admin and ops page,
 * so /admin and /ops read as one area rather than two. Both layouts (which also gate to
 * admin) wrap their children in this.
 */
export function ConsoleShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-line/15 bg-sand">
        <div className="mx-auto w-full max-w-5xl px-6">
          <div className="flex items-center gap-2.5 pt-6">
            <span className="font-display text-lg">Trajectory Console</span>
            <span className="label-mono">Founders</span>
          </div>
          <div className="mt-4">
            <ConsoleNav />
          </div>
        </div>
      </div>
      {children}
    </div>
  )
}

/**
 * Consistent left-aligned page header for console pages. Replaces the old per-page
 * centered headers so everything lines up.
 */
export function ConsoleHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl">{title}</h1>
        {description ? <p className="mt-2 max-w-prose text-sm text-slate">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
