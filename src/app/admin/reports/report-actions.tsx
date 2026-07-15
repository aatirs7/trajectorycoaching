'use client'

import { useActionState } from 'react'
import { type AdminState, setReportStatus } from '../actions'
import { Button } from '@/components/ui/button'

/** Spec §12 — work the report queue. */
export function ReportActions({
  reportId,
  status,
}: {
  reportId: string
  status: 'open' | 'reviewed' | 'actioned'
}) {
  const [state, action, pending] = useActionState<AdminState, FormData>(setReportStatus, {})

  return (
    <div className="mt-4 border-t border-line/15 pt-4">
      <div className="flex flex-wrap gap-2">
        {(['reviewed', 'actioned', 'open'] as const)
          .filter((s) => s !== status)
          .map((s) => (
            <form key={s} action={action}>
              <input type="hidden" name="reportId" value={reportId} />
              <input type="hidden" name="status" value={s} />
              <Button
                type="submit"
                size="sm"
                variant={s === 'actioned' ? 'default' : 'outline'}
                disabled={pending}
              >
                Mark {s}
              </Button>
            </form>
          ))}
      </div>

      {state.success ? <p className="mt-3 text-sm text-slate">{state.success}</p> : null}
      {state.error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
    </div>
  )
}
