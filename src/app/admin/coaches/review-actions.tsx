'use client'

import { useActionState, useState } from 'react'
import { type AdminState, approveCoach, rejectCoach, setCoachStatus } from '../actions'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

/** Spec §12 — approve / reject a pending coach. */
export function PendingActions({ profileId }: { profileId: string }) {
  const [approveState, approve, approving] = useActionState<AdminState, FormData>(approveCoach, {})
  const [rejectState, reject, rejecting] = useActionState<AdminState, FormData>(rejectCoach, {})
  const [showReject, setShowReject] = useState(false)

  const message = approveState.success ?? rejectState.success
  const error = approveState.error ?? rejectState.error

  return (
    <div className="mt-4 border-t border-line/15 pt-4">
      {showReject ? (
        <form action={reject}>
          <input type="hidden" name="profileId" value={profileId} />
          <Textarea
            name="reason"
            rows={2}
            placeholder="Optional. Included in the email to them."
            aria-label="Reason for rejection"
          />
          <div className="mt-2 flex gap-2">
            <Button type="submit" size="sm" variant="destructive" disabled={rejecting}>
              {rejecting ? 'Sending…' : 'Confirm rejection'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowReject(false)}>
              Back
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex gap-2">
          <form action={approve}>
            <input type="hidden" name="profileId" value={profileId} />
            <Button type="submit" size="sm" disabled={approving}>
              {approving ? 'Approving…' : 'Approve'}
            </Button>
          </form>
          <Button size="sm" variant="ghost" onClick={() => setShowReject(true)}>
            Reject
          </Button>
        </div>
      )}

      {message ? <p className="mt-3 text-sm text-slate">{message}</p> : null}
      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/** Spec §12 — suspend / reinstate a live coach. */
export function StatusActions({
  profileId,
  status,
}: {
  profileId: string
  status: 'approved' | 'suspended' | 'pending'
}) {
  const [state, action, pending] = useActionState<AdminState, FormData>(setCoachStatus, {})

  const next = status === 'approved' ? 'suspended' : 'approved'

  return (
    <form action={action} className="mt-4 border-t border-line/15 pt-4">
      <input type="hidden" name="profileId" value={profileId} />
      <input type="hidden" name="status" value={next} />
      <Button
        type="submit"
        size="sm"
        variant={next === 'suspended' ? 'destructive' : 'default'}
        disabled={pending}
      >
        {pending ? 'Working…' : next === 'suspended' ? 'Suspend' : 'Reinstate'}
      </Button>
      {state.success ? <p className="mt-3 text-sm text-slate">{state.success}</p> : null}
      {state.error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}
