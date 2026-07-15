'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { type CoachSetupState, saveCoachProfile } from './actions'
import { INDUSTRIES, SESSION_LENGTHS } from '@/lib/coach-schema'

type Existing = {
  industry: string
  currentTitle: string
  bio: string
  headshotUrl: string | null
  linkedinUrl: string
  employerNote: string | null
  calendlySchedulingUrl: string | null
  offerings: Array<{ lengthMinutes: number; priceCents: number }>
} | null

function Field({
  label,
  hint,
  htmlFor,
  errors,
  children,
}: {
  label: string
  hint?: string
  htmlFor?: string
  errors?: string[]
  children: React.ReactNode
}) {
  /** Label and hint centred; the input itself left-aligned in a centred block. */
  return (
    <div className="border-t border-line/15 pt-7 text-center">
      <Label htmlFor={htmlFor} className="text-base font-normal text-ink">
        {label}
      </Label>
      {hint ? <p className="mx-auto mt-1 max-w-md text-sm text-slate">{hint}</p> : null}
      <div className="mt-4 flex justify-center">
        <div className="w-full max-w-md text-left">{children}</div>
      </div>
      {errors?.length ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {errors[0]}
        </p>
      ) : null}
    </div>
  )
}

export function CoachSetupForm({ existing }: { existing: Existing }) {
  const [state, action, pending] = useActionState<CoachSetupState, FormData>(saveCoachProfile, {})

  const [lengths, setLengths] = useState<number[]>(
    existing?.offerings.map((o) => o.lengthMinutes) ?? [30],
  )

  const err = state.errors ?? {}
  const priceFor = (len: number) => {
    const cents = existing?.offerings.find((o) => o.lengthMinutes === len)?.priceCents
    return cents ? (cents / 100).toString() : ''
  }

  return (
    <form action={action} className="mt-10 space-y-7">
      <Field label="What field are you in?" errors={err.industry}>
        <Select name="industry" defaultValue={existing?.industry} required>
          <SelectTrigger className="w-full sm:w-80">
            <SelectValue placeholder="Pick your field" />
          </SelectTrigger>
          <SelectContent>
            {INDUSTRIES.map((i) => (
              <SelectItem key={i} value={i}>
                {i}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field
        label="What's your current role?"
        hint="Title and company. This is what students see first."
        htmlFor="currentTitle"
        errors={err.currentTitle}
      >
        <Input
          id="currentTitle"
          name="currentTitle"
          defaultValue={existing?.currentTitle}
          placeholder="Analyst at Goldman Sachs"
          required
        />
      </Field>

      <Field
        label="Your bio"
        hint="What you help with, and the experience behind it. This is the main thing students read."
        htmlFor="bio"
        errors={err.bio}
      >
        <Textarea id="bio" name="bio" defaultValue={existing?.bio} rows={7} required />
      </Field>

      <Field
        label="LinkedIn URL"
        hint="Required. We verify your stated employer before approving your profile."
        htmlFor="linkedinUrl"
        errors={err.linkedinUrl}
      >
        <Input
          id="linkedinUrl"
          name="linkedinUrl"
          defaultValue={existing?.linkedinUrl}
          placeholder="linkedin.com/in/you"
          required
        />
      </Field>

      <Field
        label="Headshot URL"
        hint="Optional for now. Paste a link to a photo."
        htmlFor="headshotUrl"
        errors={err.headshotUrl}
      >
        <Input id="headshotUrl" name="headshotUrl" defaultValue={existing?.headshotUrl ?? ''} />
      </Field>

      <Field
        label="Your Calendly link"
        hint="Optional. Students see a read-only preview of your availability. They’ll still book through us, and you’ll get a private link per paid session."
        htmlFor="calendlySchedulingUrl"
        errors={err.calendlySchedulingUrl}
      >
        <Input
          id="calendlySchedulingUrl"
          name="calendlySchedulingUrl"
          defaultValue={existing?.calendlySchedulingUrl ?? ''}
          placeholder="calendly.com/your-name"
        />
      </Field>

      <Field
        label="Anything we should know about your employer?"
        hint="Optional. E.g. restrictions on what you can discuss publicly."
        htmlFor="employerNote"
        errors={err.employerNote}
      >
        <Textarea
          id="employerNote"
          name="employerNote"
          defaultValue={existing?.employerNote ?? ''}
          rows={2}
        />
      </Field>

      <Field
        label="Sessions you offer"
        hint="Pick the lengths and set your rate for each. You keep 70 to 80%, shown on your dashboard."
        errors={err.offerings ?? err._form}
      >
        <div className="space-y-3">
          {SESSION_LENGTHS.map((len) => {
            const checked = lengths.includes(len)
            return (
              <div key={len} className="flex items-center gap-3">
                <Checkbox
                  id={`len-${len}`}
                  name="lengthMinutes"
                  value={String(len)}
                  checked={checked}
                  onCheckedChange={(c) =>
                    setLengths((prev) =>
                      c === true ? [...prev, len] : prev.filter((l) => l !== len),
                    )
                  }
                />
                <Label htmlFor={`len-${len}`} className="w-24 font-normal">
                  {len} minutes
                </Label>

                <div className="flex items-center gap-1.5">
                  <span className="text-slate">$</span>
                  <Input
                    name={`price_${len}`}
                    defaultValue={priceFor(len)}
                    disabled={!checked}
                    inputMode="decimal"
                    placeholder="75"
                    className="w-28"
                    aria-label={`Price for a ${len} minute session, in dollars`}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </Field>

      <div className="border-t border-line/15 pt-7 text-center">
        {state.message ? (
          <p role="alert" className="mb-3 text-sm text-destructive">
            {state.message}
          </p>
        ) : null}
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? 'Saving…' : existing ? 'Save changes' : 'Submit for review'}
        </Button>
        {!existing ? (
          <p className="mx-auto mt-3 max-w-md text-sm text-slate">
            We review every profile before it goes live, usually within a couple of days.
          </p>
        ) : null}
      </div>
    </form>
  )
}
