'use client'

import { useActionState } from 'react'
import { REPORT_CATEGORIES, type ReportState, submitReport } from './actions'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

/** Spec §12 — the report form. */
export function ReportForm({
  reportedUserId,
  reportedName,
  sessionId,
}: {
  reportedUserId: string
  reportedName: string
  sessionId?: string
}) {
  const [state, action, pending] = useActionState<ReportState, FormData>(submitReport, {})

  if (state.success) {
    return (
      <Card className="mt-8 border-line/20 p-6">
        <p>{state.success}</p>
      </Card>
    )
  }

  return (
    <form action={action} className="mt-8 space-y-6">
      <input type="hidden" name="reportedUserId" value={reportedUserId} />
      {sessionId ? <input type="hidden" name="sessionId" value={sessionId} /> : null}

      <div>
        <Label className="text-base font-normal">What happened?</Label>
        <Select name="category" required>
          <SelectTrigger className="mt-2 w-full sm:w-80">
            <SelectValue placeholder="Pick a category" />
          </SelectTrigger>
          <SelectContent>
            {REPORT_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="description" className="text-base font-normal">
          Tell us more
        </Label>
        <p className="mt-1 text-sm text-slate">
          Specifics help: dates, what was said, anything we can verify.
        </p>
        <Textarea id="description" name="description" rows={6} required className="mt-2" />
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? 'Sending…' : `Report ${reportedName}`}
      </Button>
    </form>
  )
}
