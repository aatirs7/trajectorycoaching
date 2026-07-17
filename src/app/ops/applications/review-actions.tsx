'use client'

import { useActionState, useState } from 'react'
import { type ReviewState, reviewApplication } from './actions'
import { Button } from '@/components/ui/button'

export function ReviewActions({ id, status }: { id: string; status: string }) {
  const [state, action, pending] = useActionState<ReviewState, FormData>(reviewApplication, {})
  const [confirmReject, setConfirmReject] = useState(false)

  const decided = status === 'accepted' || status === 'rejected'

  return (
    <div className="mt-4 border-t border-line/15 pt-4">
      {!decided ? (
        confirmReject ? (
          <div className="space-y-2">
            <p className="text-sm text-slate">Decline this applicant?</p>
            <div className="flex flex-wrap gap-2">
              <form action={action}>
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="action" value="reject" />
                <input type="hidden" name="notify" value="true" />
                <Button type="submit" size="sm" variant="destructive" disabled={pending}>
                  Decline + email
                </Button>
              </form>
              <form action={action}>
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="action" value="reject" />
                <input type="hidden" name="notify" value="false" />
                <Button type="submit" size="sm" variant="outline" disabled={pending}>
                  Decline silently
                </Button>
              </form>
              <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmReject(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <form action={action}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="action" value="accept" />
              <Button type="submit" size="sm" disabled={pending}>
                Accept
              </Button>
            </form>
            {status !== 'reviewing' ? (
              <form action={action}>
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="action" value="reviewing" />
                <Button type="submit" size="sm" variant="outline" disabled={pending}>
                  Mark reviewing
                </Button>
              </form>
            ) : null}
            <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmReject(true)}>
              Reject
            </Button>
          </div>
        )
      ) : null}

      {state.success ? <p className="mt-2 text-sm text-slate">{state.success}</p> : null}
      {state.error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
    </div>
  )
}
