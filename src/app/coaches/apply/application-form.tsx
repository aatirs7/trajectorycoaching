'use client'

import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'
import { submitApplication } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  APP_FIELDS,
  AVAIL_DAYS,
  AVAIL_TIMES,
  COACHING_TYPES,
  EMPLOYER_CONCERNS,
  EMPLOYER_VISIBILITY,
  SESSIONS_PER_MONTH,
  START_TIMING,
  YEARS_EXPERIENCE,
} from '@/lib/application-schema'

type Form = {
  fullName: string
  email: string
  field: string
  fieldOther: string
  roleCompany: string
  yearsExperience: string
  linkedinUrl: string
  sessionsPerMonth: string
  days: string[]
  times: string[]
  startTiming: string
  startOther: string
  rate30: string
  rate45: string
  rate60: string
  openToSuggested: string
  coachingTypes: string[]
  coachingOther: string
  idealStudent: string
  employerConcerns: string
  employerConcernNote: string
  employerVisibility: string
  whyInterested: string
  priorExperience: string
  questions: string
  anythingElse: string
}

const EMPTY: Form = {
  fullName: '', email: '', field: '', fieldOther: '', roleCompany: '', yearsExperience: '',
  linkedinUrl: '', sessionsPerMonth: '', days: [], times: [], startTiming: '', startOther: '',
  rate30: '', rate45: '', rate60: '', openToSuggested: '', coachingTypes: [], coachingOther: '',
  idealStudent: '', employerConcerns: '', employerVisibility: '', employerConcernNote: '',
  whyInterested: '', priorExperience: '', questions: '', anythingElse: '',
}

const STORAGE_KEY = 'mentorreach_coach_application'
const TOTAL = 8

export function ApplicationForm() {
  const [form, setForm] = useState<Form>(EMPTY)
  const [step, setStep] = useState(1)
  const [touched, setTouched] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  // Persist in-progress answers so a refresh doesn't wipe the form (real app, not an
  // artifact — localStorage is fine here).
  useEffect(() => {
    // Restore saved answers AFTER mount, not in a useState initializer: reading
    // localStorage during the initial (server-matched) render would cause a hydration
    // mismatch. This one-time post-mount setState is the intended pattern here.
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setForm({ ...EMPTY, ...JSON.parse(saved) })
    } catch {
      /* ignore */
    }
  }, [])
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(form))
    } catch {
      /* ignore */
    }
  }, [form])

  const set = <K extends keyof Form>(k: K, val: Form[K]) => setForm((f) => ({ ...f, [k]: val }))
  const toggle = (k: 'days' | 'times' | 'coachingTypes', val: string) =>
    setForm((f) => ({
      ...f,
      [k]: f[k].includes(val) ? f[k].filter((x) => x !== val) : [...f[k], val],
    }))

  function stepValid(s: number): boolean {
    switch (s) {
      case 1:
        return true
      case 2:
        return (
          !!form.fullName.trim() &&
          /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim()) &&
          !!form.field &&
          (form.field !== 'Other' || !!form.fieldOther.trim()) &&
          !!form.roleCompany.trim() &&
          !!form.yearsExperience &&
          !!form.linkedinUrl.trim()
        )
      case 3:
        return (
          !!form.sessionsPerMonth &&
          form.days.length > 0 &&
          form.times.length > 0 &&
          !!form.startTiming &&
          (form.startTiming !== 'other' || !!form.startOther.trim())
        )
      case 4:
        return !!form.rate30.trim() && !!form.openToSuggested
      case 5:
        return (
          form.coachingTypes.length > 0 &&
          (!form.coachingTypes.includes('Other') || !!form.coachingOther.trim())
        )
      case 6:
        return !!form.employerConcerns && !!form.employerVisibility
      case 7:
        return !!form.whyInterested.trim() && !!form.priorExperience.trim()
      case 8:
        return true
      default:
        return false
    }
  }

  function next() {
    if (!stepValid(step)) {
      setTouched(true)
      return
    }
    setTouched(false)
    setStep((s) => Math.min(s + 1, TOTAL))
  }
  function back() {
    setTouched(false)
    setStep((s) => Math.max(s - 1, 1))
  }

  function submit() {
    if (!stepValid(8)) return
    setError(null)
    start(async () => {
      const res = await submitApplication({
        ...form,
        // Coerce to the schema's expected literal unions.
        openToSuggested: form.openToSuggested,
        times: form.times,
        days: form.days,
        coachingTypes: form.coachingTypes,
      })
      if (res.ok) {
        try {
          localStorage.removeItem(STORAGE_KEY)
        } catch {
          /* ignore */
        }
        setDone(true)
      } else {
        setError(res.error ?? 'Something went wrong. Please try again.')
      }
    })
  }

  if (done) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <p className="label-mono">Application received</p>
        <h1 className="text-section mt-3">Thanks — we&rsquo;ve got it</h1>
        <p className="mx-auto mt-4 max-w-prose leading-relaxed text-slate">
          We&rsquo;ll review your application and follow up by email. No action needed from
          you right now.
        </p>
        <Button asChild size="lg" className="mt-8">
          <Link href="/">Back to MentorReach</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col lg:flex-row">
      {/* Progress panel */}
      <aside className="relative overflow-hidden bg-ink px-6 py-10 text-paper lg:w-[36%] lg:px-12 lg:py-16">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -left-24 size-[28rem] rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--gold), transparent 70%)' }}
        />
        <div className="relative lg:sticky lg:top-16">
          <p className="font-mono text-xs tracking-widest text-gold uppercase">
            Section {step} of {TOTAL}
          </p>
          <h1 className="mt-4 font-display text-3xl leading-tight lg:text-4xl">
            Coach with MentorReach
          </h1>
          <p className="mt-4 max-w-sm leading-relaxed text-paper/60">
            This is your application to join. It takes about 5 to 10 minutes. We&rsquo;ll
            follow up once we&rsquo;ve reviewed it.
          </p>
          <div className="mt-8 flex gap-1.5" aria-hidden>
            {Array.from({ length: TOTAL }, (_, i) => (
              <span
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i < step ? 'bg-gold' : 'bg-paper/15'
                }`}
              />
            ))}
          </div>
        </div>
      </aside>

      {/* Steps */}
      <div className="flex flex-1 items-start justify-center px-6 py-12 lg:py-16">
        <div className="w-full max-w-lg">
          {step === 1 ? (
            <StepShell title="Thanks for your interest">
              <p className="leading-relaxed text-slate">
                Thanks for your interest in coaching with MentorReach. This takes about 5 to 10
                minutes. We&rsquo;ll follow up once we&rsquo;ve reviewed your application.
              </p>
            </StepShell>
          ) : null}

          {step === 2 ? (
            <StepShell title="About you">
              <TextField label="Full name" value={form.fullName} onChange={(v) => set('fullName', v)} required />
              <TextField
                label="Email"
                type="email"
                value={form.email}
                onChange={(v) => set('email', v)}
                required
              />
              <SelectField
                label="Field / industry"
                value={form.field}
                onChange={(v) => set('field', v)}
                options={APP_FIELDS.map((f) => ({ value: f, label: f }))}
                required
              />
              {form.field === 'Other' ? (
                <TextField label="Your field" value={form.fieldOther} onChange={(v) => set('fieldOther', v)} required />
              ) : null}
              <TextField
                label="Current role and company"
                value={form.roleCompany}
                onChange={(v) => set('roleCompany', v)}
                placeholder="Analyst at Evercore"
                required
              />
              <SelectField
                label="Years of experience in your field"
                value={form.yearsExperience}
                onChange={(v) => set('yearsExperience', v)}
                options={YEARS_EXPERIENCE.map((y) => ({ value: y, label: y }))}
                required
              />
              <TextField
                label="LinkedIn URL"
                value={form.linkedinUrl}
                onChange={(v) => set('linkedinUrl', v)}
                placeholder="linkedin.com/in/you"
                required
              />
            </StepShell>
          ) : null}

          {step === 3 ? (
            <StepShell
              title="Availability & capacity"
              note="Just a general sense — you’ll set your exact hours once you’re set up."
            >
              <SelectField
                label="Sessions per month you could realistically commit to"
                value={form.sessionsPerMonth}
                onChange={(v) => set('sessionsPerMonth', v)}
                options={SESSIONS_PER_MONTH.map((s) => ({ value: s, label: s }))}
                required
              />
              <ChipGroup
                label="Which days generally work for you?"
                required
                selected={form.days}
                onToggle={(v) => toggle('days', v)}
                options={AVAIL_DAYS.map((d) => ({ value: d, label: d }))}
              />
              <ChipGroup
                label="Which times generally work for you?"
                required
                selected={form.times}
                onToggle={(v) => toggle('times', v)}
                options={AVAIL_TIMES.map((t) => ({ value: t.value, label: t.label }))}
              />
              <RadioField
                label='When can you start? (If you select "Other", please input a date.)'
                value={form.startTiming}
                onChange={(v) => set('startTiming', v)}
                options={START_TIMING.map((s) => ({ value: s.value, label: s.label }))}
                required
              />
              {form.startTiming === 'other' ? (
                <TextField
                  label="Please enter a date"
                  value={form.startOther}
                  onChange={(v) => set('startOther', v)}
                  placeholder="e.g. September 1, or in 4 weeks"
                  required
                />
              ) : null}
            </StepShell>
          ) : null}

          {step === 4 ? (
            <StepShell title="Pricing">
              <TextField label="Rate per 30-minute session" value={form.rate30} onChange={(v) => set('rate30', v)} placeholder="$55-65" required />
              <TextField label="Rate per 45-minute session (optional)" value={form.rate45} onChange={(v) => set('rate45', v)} />
              <TextField label="Rate per 60-minute session (optional)" value={form.rate60} onChange={(v) => set('rate60', v)} />
              <RadioField
                label="Open to MentorReach suggesting a standard rate if your initial number is outside our typical range?"
                value={form.openToSuggested}
                onChange={(v) => set('openToSuggested', v)}
                options={[
                  { value: 'yes', label: 'Yes' },
                  { value: 'no', label: 'No' },
                ]}
                required
              />
            </StepShell>
          ) : null}

          {step === 5 ? (
            <StepShell title="What you'd offer">
              <ChipGroup
                label="What coaching could you bring? Select all that apply."
                required
                selected={form.coachingTypes}
                onToggle={(v) => toggle('coachingTypes', v)}
                options={COACHING_TYPES.map((c) => ({ value: c, label: c }))}
              />
              {form.coachingTypes.includes('Other') ? (
                <TextField label="What else?" value={form.coachingOther} onChange={(v) => set('coachingOther', v)} required />
              ) : null}
              <TextAreaField
                label="A specific type of student you feel best equipped to help? (optional)"
                value={form.idealStudent}
                onChange={(v) => set('idealStudent', v)}
              />
            </StepShell>
          ) : null}

          {step === 6 ? (
            <StepShell title="Employer & visibility">
              <RadioField
                label="Would your current employer have any issues with your name/title being associated with paid coaching on an outside platform?"
                value={form.employerConcerns}
                onChange={(v) => set('employerConcerns', v)}
                options={EMPLOYER_CONCERNS.map((e) => ({ value: e.value, label: e.label }))}
                required
              />
              <TextField
                label="Anything to add? (optional)"
                value={form.employerConcernNote}
                onChange={(v) => set('employerConcernNote', v)}
              />
              <RadioField
                label="On your profile, would you rather show your employer's name or a general description?"
                value={form.employerVisibility}
                onChange={(v) => set('employerVisibility', v)}
                options={EMPLOYER_VISIBILITY.map((e) => ({ value: e.value, label: e.label }))}
                required
              />
            </StepShell>
          ) : null}

          {step === 7 ? (
            <StepShell title="Fit & motivation">
              <TextAreaField label="Why are you interested in coaching with MentorReach?" value={form.whyInterested} onChange={(v) => set('whyInterested', v)} required />
              <TextAreaField
                label="Do you have experience with mentoring, coaching, or tutoring? (Not an issue if you don't.)"
                value={form.priorExperience}
                onChange={(v) => set('priorExperience', v)}
                required
              />
            </StepShell>
          ) : null}

          {step === 8 ? (
            <StepShell title="Anything else">
              <TextAreaField label="Do you have any questions for us? (optional)" value={form.questions} onChange={(v) => set('questions', v)} />
              <TextAreaField label="Anything else you'd want us to know? (optional)" value={form.anythingElse} onChange={(v) => set('anythingElse', v)} />
            </StepShell>
          ) : null}

          {touched && !stepValid(step) ? (
            <p role="alert" className="mt-6 text-sm text-destructive">
              Please fill in the required fields to continue.
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="mt-6 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div className="mt-10 flex items-center gap-3">
            {step > 1 ? (
              <Button type="button" variant="ghost" onClick={back} disabled={pending}>
                Back
              </Button>
            ) : null}
            {step < TOTAL ? (
              <Button type="button" size="lg" onClick={next} className="ml-auto">
                {step === 1 ? 'Start' : 'Continue'}
              </Button>
            ) : (
              <Button type="button" size="lg" onClick={submit} disabled={pending} className="ml-auto">
                {pending ? 'Submitting…' : 'Submit application'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StepShell({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-display text-2xl leading-snug lg:text-3xl">{title}</h2>
      {note ? <p className="mt-2 text-sm text-slate">{note}</p> : null}
      <div className="mt-7 space-y-6">{children}</div>
    </div>
  )
}

function FieldWrap({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-sm font-normal text-ink">
        {label}
        {required ? <span className="text-slate"> *</span> : null}
      </Label>
      <div className="mt-2">{children}</div>
    </div>
  )
}

function TextField({
  label, value, onChange, type = 'text', placeholder, required,
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean
}) {
  return (
    <FieldWrap label={label} required={required}>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-11 text-base" />
    </FieldWrap>
  )
}

function TextAreaField({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <FieldWrap label={label} required={required}>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={4} className="text-base" />
    </FieldWrap>
  )
}

function SelectField({
  label, value, onChange, options, required,
}: {
  label: string; value: string; onChange: (v: string) => void; options: Array<{ value: string; label: string }>; required?: boolean
}) {
  return (
    <FieldWrap label={label} required={required}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-md border border-line/25 bg-raised px-3 text-base"
      >
        <option value="">Choose…</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldWrap>
  )
}

function RadioField({
  label, value, onChange, options, required,
}: {
  label: string; value: string; onChange: (v: string) => void; options: Array<{ value: string; label: string }>; required?: boolean
}) {
  return (
    <FieldWrap label={label} required={required}>
      <div className="space-y-2">
        {options.map((o) => {
          const checked = value === o.value
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              aria-pressed={checked}
              className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                checked ? 'border-gold bg-secondary' : 'border-line/25 hover:border-line/50'
              }`}
            >
              {o.label}
              <span aria-hidden className={`size-3.5 shrink-0 rounded-full border-2 ${checked ? 'border-gold bg-gold' : 'border-line/40'}`} />
            </button>
          )
        })}
      </div>
    </FieldWrap>
  )
}

function ChipGroup({
  label, options, selected, onToggle, required,
}: {
  label: string; options: Array<{ value: string; label: string }>; selected: string[]; onToggle: (v: string) => void; required?: boolean
}) {
  return (
    <FieldWrap label={label} required={required}>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const checked = selected.includes(o.value)
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onToggle(o.value)}
              aria-pressed={checked}
              className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                checked ? 'border-gold bg-secondary text-ink' : 'border-line/25 text-slate hover:border-line/50'
              }`}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </FieldWrap>
  )
}
