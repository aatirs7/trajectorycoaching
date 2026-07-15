'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { submitSurvey, type SurveyState } from './actions'
import {
  COLLEGE_YEARS,
  HELP_OPTIONS,
  HS_GRADES,
  PATH_CERTAINTY_LABELS,
} from '@/lib/survey-schema'

type Existing = {
  educationLevel: 'hs' | 'college'
  gradeYear: string
  school: string
  major: string | null
  careerInterest: string
  target: string | null
  pathCertainty: number
  priorExperience: string | null
  helpWith: string[]
  helpWithOther: string | null
  heardFrom: string | null
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
    <div className="border-t border-line/15 pt-7">
      <Label htmlFor={htmlFor} className="text-base font-normal text-ink">
        {label}
      </Label>
      {hint ? <p className="mt-1 text-sm text-slate">{hint}</p> : null}
      <div className="mt-3">{children}</div>
      {errors?.length ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {errors[0]}
        </p>
      ) : null}
    </div>
  )
}

export function SurveyForm({ existing }: { existing: Existing }) {
  const [state, action, pending] = useActionState<SurveyState, FormData>(submitSurvey, {})

  // Q2's options depend on Q1, so this has to be live client state rather than a
  // server round-trip.
  const [level, setLevel] = useState<'hs' | 'college' | ''>(existing?.educationLevel ?? '')
  const [help, setHelp] = useState<string[]>(existing?.helpWith ?? [])

  const err = state.errors ?? {}

  function toggleHelp(option: string, checked: boolean) {
    setHelp((prev) => (checked ? [...prev, option] : prev.filter((h) => h !== option)))
  }

  return (
    <form action={action} className="mt-10 space-y-7">
      {/* Q1 */}
      <div>
        <Label className="text-base font-normal text-ink">
          Are you in high school or college?
        </Label>
        <RadioGroup
          name="educationLevel"
          value={level}
          onValueChange={(v) => setLevel(v as 'hs' | 'college')}
          className="mt-3 flex gap-6"
          required
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="hs" id="lvl-hs" />
            <Label htmlFor="lvl-hs" className="font-normal">
              High school
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="college" id="lvl-college" />
            <Label htmlFor="lvl-college" className="font-normal">
              College
            </Label>
          </div>
        </RadioGroup>
        {err.educationLevel?.length ? (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {err.educationLevel[0]}
          </p>
        ) : null}
      </div>

      {/* Q2 — options depend on Q1 */}
      {level ? (
        <Field label={level === 'hs' ? 'What grade are you in?' : 'What year are you?'} errors={err.gradeYear}>
          <RadioGroup
            name="gradeYear"
            defaultValue={existing?.gradeYear}
            className="grid grid-cols-2 gap-2 sm:grid-cols-3"
            required
          >
            {(level === 'hs' ? HS_GRADES : COLLEGE_YEARS).map((g) => (
              <div key={g} className="flex items-center gap-2">
                <RadioGroupItem value={g} id={`grade-${g}`} />
                <Label htmlFor={`grade-${g}`} className="font-normal">
                  {g}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </Field>
      ) : null}

      {/* Q3 */}
      <Field label="What school do you go to?" htmlFor="school" errors={err.school}>
        <Input id="school" name="school" defaultValue={existing?.school} required maxLength={200} />
      </Field>

      {/* Q4 — college only */}
      {level === 'college' ? (
        <Field label="What's your major, or intended major?" htmlFor="major" errors={err.major}>
          <Input id="major" name="major" defaultValue={existing?.major ?? ''} maxLength={200} />
        </Field>
      ) : null}

      {/* Q5 */}
      <Field
        label="What field or career are you interested in?"
        htmlFor="careerInterest"
        errors={err.careerInterest}
      >
        <Input
          id="careerInterest"
          name="careerInterest"
          defaultValue={existing?.careerInterest}
          placeholder="Investment banking, software, medicine…"
          required
        />
      </Field>

      {/* Q6 */}
      <Field
        label="Any specific company, industry, or role you're targeting?"
        hint="Optional."
        htmlFor="target"
        errors={err.target}
      >
        <Input id="target" name="target" defaultValue={existing?.target ?? ''} />
      </Field>

      {/* Q7 */}
      <Field label="How set are you on that path?" errors={err.pathCertainty}>
        <RadioGroup
          name="pathCertainty"
          defaultValue={String(existing?.pathCertainty ?? 3)}
          className="grid gap-2"
          required
        >
          {Object.entries(PATH_CERTAINTY_LABELS).map(([value, label]) => (
            <div key={value} className="flex items-center gap-2">
              <RadioGroupItem value={value} id={`pc-${value}`} />
              <Label htmlFor={`pc-${value}`} className="font-normal">
                {label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </Field>

      {/* Q8 */}
      <Field
        label="Any internships, jobs, or relevant experience so far?"
        hint="Optional."
        htmlFor="priorExperience"
        errors={err.priorExperience}
      >
        <Textarea
          id="priorExperience"
          name="priorExperience"
          defaultValue={existing?.priorExperience ?? ''}
          rows={3}
        />
      </Field>

      {/* Q9 */}
      <Field label="What do you want help with?" hint="Pick as many as apply." errors={err.helpWith}>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {HELP_OPTIONS.map((option) => (
            <div key={option} className="flex items-center gap-2">
              <Checkbox
                id={`help-${option}`}
                name="helpWith"
                value={option}
                defaultChecked={help.includes(option)}
                onCheckedChange={(c) => toggleHelp(option, c === true)}
              />
              <Label htmlFor={`help-${option}`} className="font-normal">
                {option}
              </Label>
            </div>
          ))}
        </div>

        {help.includes('Other') ? (
          <div className="mt-3">
            <Input
              name="helpWithOther"
              defaultValue={existing?.helpWithOther ?? ''}
              placeholder="Tell us what else"
              aria-label="What else do you want help with?"
            />
            {err.helpWithOther?.length ? (
              <p role="alert" className="mt-2 text-sm text-destructive">
                {err.helpWithOther[0]}
              </p>
            ) : null}
          </div>
        ) : null}
      </Field>

      {/* Q10 */}
      <Field
        label="How did you hear about Trajectory?"
        hint="Optional."
        htmlFor="heardFrom"
        errors={err.heardFrom}
      >
        <Input id="heardFrom" name="heardFrom" defaultValue={existing?.heardFrom ?? ''} />
      </Field>

      <div className="border-t border-line/15 pt-7">
        {state.message ? (
          <p role="alert" className="mb-3 text-sm text-destructive">
            {state.message}
          </p>
        ) : null}
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? 'Saving…' : 'Finish and browse coaches'}
        </Button>
      </div>
    </form>
  )
}
