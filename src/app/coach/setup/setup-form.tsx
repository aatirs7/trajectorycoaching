'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useActionState, useState } from 'react'
import { type CoachSetupState, saveCoachProfile, uploadHeadshotAction } from './actions'
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
import { INDUSTRIES, SESSION_LENGTHS } from '@/lib/coach-schema'

type Existing = {
  industry: string
  currentTitle: string
  bio: string
  headshotUrl: string | null
  linkedinUrl: string | null
  employerNote: string | null
  calendlySchedulingUrl: string | null
  displayEmployerGenerally: boolean
  generalTitle: string | null
  handbookSignedName: string | null
  handbookSignedAt: string | null
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

/**
 * Photo upload — its own form/action so a large image can't take the text save down with
 * it. Only works once a profile row exists (the action says so), so for a brand-new coach
 * we tell them to save details first.
 */
function PhotoUploader({ existing }: { existing: Existing }) {
  const [state, action, pending] = useActionState<CoachSetupState, FormData>(uploadHeadshotAction, {})
  const err = state.errors ?? {}

  return (
    <div className="border-t border-line/15 pt-7 text-center">
      <Label className="text-base font-normal text-ink">Your photo</Label>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate">
        A real photo of you. Students book a person, so this is required before your profile
        goes live.
      </p>

      <div className="mx-auto mt-4 flex w-full max-w-md flex-col items-center gap-4">
        {existing?.headshotUrl ? (
          <Image
            src={existing.headshotUrl}
            alt="Your current headshot"
            width={112}
            height={112}
            className="size-28 rounded-full border border-line/20 object-cover"
          />
        ) : (
          <div className="flex size-28 items-center justify-center rounded-full border border-dashed border-line/40 text-sm text-slate">
            No photo
          </div>
        )}

        {existing ? (
          <form action={action} className="flex w-full flex-col items-center gap-3">
            <input
              type="file"
              name="photo"
              accept="image/jpeg,image/png,image/webp"
              required
              className="block w-full text-sm text-slate file:mr-3 file:rounded-md file:border file:border-line/25 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:text-ink"
            />
            <Button type="submit" size="sm" variant="outline" disabled={pending}>
              {pending ? 'Uploading…' : existing.headshotUrl ? 'Replace photo' : 'Upload photo'}
            </Button>
          </form>
        ) : (
          <p className="text-sm text-slate">Save your details below first, then add a photo.</p>
        )}

        {err.photo?.length ? (
          <p role="alert" className="text-sm text-destructive">
            {err.photo[0]}
          </p>
        ) : null}
        {state.message ? <p className="text-sm text-slate">{state.message}</p> : null}
      </div>
    </div>
  )
}

/** Values pre-filled from an accepted application, used only when there's no profile yet. */
export type Prefill = {
  industry?: string
  currentTitle?: string
  displayEmployerGenerally?: boolean
} | null

export function CoachSetupForm({ existing, prefill }: { existing: Existing; prefill?: Prefill }) {
  const [state, action, pending] = useActionState<CoachSetupState, FormData>(saveCoachProfile, {})

  const [lengths, setLengths] = useState<number[]>(
    existing?.offerings.map((o) => o.lengthMinutes) ?? [30],
  )
  const [generalDisplay, setGeneralDisplay] = useState(
    existing?.displayEmployerGenerally ?? prefill?.displayEmployerGenerally ?? false,
  )

  const err = state.errors ?? {}
  const priceFor = (len: number) => {
    const cents = existing?.offerings.find((o) => o.lengthMinutes === len)?.priceCents
    return cents ? (cents / 100).toString() : ''
  }

  return (
    <div className="mt-10 space-y-7">
      <PhotoUploader existing={existing} />

      <form action={action} className="space-y-7">
        <Field label="What field are you in?" errors={err.industry}>
          <Select name="industry" defaultValue={existing?.industry ?? prefill?.industry} required>
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
            defaultValue={existing?.currentTitle ?? prefill?.currentTitle}
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
          label="Your Calendly link"
          hint="Students see a read-only preview of your availability. They’ll still book through us, and you’ll get a private link per paid session."
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
          label="LinkedIn URL"
          hint="Optional. Helpful context for students."
          htmlFor="linkedinUrl"
          errors={err.linkedinUrl}
        >
          <Input
            id="linkedinUrl"
            name="linkedinUrl"
            defaultValue={existing?.linkedinUrl ?? ''}
            placeholder="linkedin.com/in/you"
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
          label="How should your employer show on your profile?"
          hint="Some coaches can't show their firm's name publicly."
          errors={err.generalTitle}
        >
          <div className="space-y-2">
            {[
              { value: 'show_name', label: 'Show my current role and company' },
              { value: 'describe_generally', label: 'Describe generally (e.g. Finance Professional)' },
            ].map((o) => {
              const checked = (o.value === 'describe_generally') === generalDisplay
              return (
                <label
                  key={o.value}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors ${
                    checked ? 'border-gold bg-secondary' : 'border-line/25 hover:border-line/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="employerVisibility"
                    value={o.value}
                    checked={checked}
                    onChange={() => setGeneralDisplay(o.value === 'describe_generally')}
                    className="sr-only"
                  />
                  <span aria-hidden className={`size-3.5 rounded-full border-2 ${checked ? 'border-gold bg-gold' : 'border-line/40'}`} />
                  {o.label}
                </label>
              )
            })}
            {generalDisplay ? (
              <Input
                name="generalTitle"
                defaultValue={existing?.generalTitle ?? ''}
                placeholder="Finance Professional"
                aria-label="General title to show instead of your employer"
                className="mt-2"
              />
            ) : (
              <input type="hidden" name="generalTitle" value="" />
            )}
          </div>
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

        {/* Handbook agreement — a typed signature, required to publish and reviewable in
            admin. Once signed it's locked; re-editing the form never re-signs. */}
        <div className="border-t border-line/15 pt-7 text-center">
          <Label className="text-base font-normal text-ink">Sign the Coach Handbook</Label>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate">
            Read the{' '}
            <Link
              href="/coach/handbook"
              target="_blank"
              className="underline decoration-gold underline-offset-4"
            >
              Coach Handbook
            </Link>
            , then type your full legal name to agree to it.
          </p>

          <div className="mx-auto mt-4 w-full max-w-md text-left">
            {existing?.handbookSignedName ? (
              <p className="rounded-lg border border-line/20 bg-secondary p-3 text-sm text-slate">
                Signed by <span className="font-medium text-ink">{existing.handbookSignedName}</span>
                {existing.handbookSignedAt ? (
                  <> on {new Date(existing.handbookSignedAt).toLocaleDateString('en-US', { dateStyle: 'long' })}</>
                ) : null}
                .
              </p>
            ) : (
              <>
                <Input
                  name="handbookSignedName"
                  placeholder="Your full legal name"
                  aria-label="Type your full legal name to sign the Coach Handbook"
                />
                <p className="mt-2 text-xs text-slate">
                  Typing your name here is your signature and agreement to the handbook.
                </p>
              </>
            )}
          </div>
        </div>

        <div className="border-t border-line/15 pt-7 text-center">
          {state.message ? (
            <p role="alert" className="mb-3 text-sm text-destructive">
              {state.message}
            </p>
          ) : null}
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? 'Saving…' : existing ? 'Save changes' : 'Save and continue'}
          </Button>
          <p className="mx-auto mt-3 max-w-md text-sm text-slate">
            Your profile goes live automatically once everything on your checklist is done.
            There’s no waiting on approval.
          </p>
        </div>
      </form>
    </div>
  )
}
