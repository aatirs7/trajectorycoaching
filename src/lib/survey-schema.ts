import { z } from 'zod'

/**
 * Spec §7 — the mandatory student survey, exact questions.
 *
 * Shared by the client form and the server action. The server action re-parses; never
 * trust the client's copy.
 */

/** Q2's options depend on Q1 — the dependency a single pg enum can't express. */
export const HS_GRADES = ['9th grade', '10th grade', '11th grade', '12th grade'] as const

export const COLLEGE_YEARS = [
  'Freshman',
  'Sophomore',
  'Junior',
  'Senior',
  'Graduate student',
  'Recent grad',
] as const

/** Q9. */
export const HELP_OPTIONS = [
  'Internships',
  'Full-time recruiting',
  'Choosing a major',
  'Resume review',
  'Interview prep',
  'Networking',
  'Clubs & leadership',
  'Figuring out the right path',
  'College applications',
  'SAT/ACT',
  'Other',
] as const

/**
 * Q7 — "How set are you on that path?" (locked in ↔ exploring).
 *
 * Stored as a 1-5 smallint: a scale is filterable and rankable where adjective enums are
 * neither. OPEN QUESTION for Isaiah — confirm these labels.
 */
export const PATH_CERTAINTY_LABELS: Record<number, string> = {
  1: 'Just exploring',
  2: 'Leaning somewhere',
  3: 'Narrowed it down',
  4: 'Pretty set',
  5: 'Locked in',
}

const nonEmpty = (label: string) => z.string().trim().min(1, `${label} is required`).max(500)

/**
 * A discriminated union on education_level, which is what makes Q2's conditional options
 * enforceable server-side: a high schooler cannot submit "Sophomore" as a college year.
 */
export const surveySchema = z
  .discriminatedUnion('educationLevel', [
    z.object({
      educationLevel: z.literal('hs'),
      gradeYear: z.enum(HS_GRADES),
      /** Q4 is college-only; skippable for HS. */
      major: z.string().trim().max(200).optional().or(z.literal('')),
    }),
    z.object({
      educationLevel: z.literal('college'),
      gradeYear: z.enum(COLLEGE_YEARS),
      major: nonEmpty('Major or intended major').max(200),
    }),
  ])
  .and(
    z.object({
      school: nonEmpty('School name').max(200),
      careerInterest: nonEmpty('Field or career interest'),
      target: z.string().trim().max(500).optional().or(z.literal('')),
      pathCertainty: z.coerce.number().int().min(1).max(5),
      priorExperience: z.string().trim().max(2000).optional().or(z.literal('')),
      helpWith: z.array(z.enum(HELP_OPTIONS)).min(1, 'Pick at least one'),
      helpWithOther: z.string().trim().max(500).optional().or(z.literal('')),
      heardFrom: z.string().trim().max(500).optional().or(z.literal('')),
    }),
  )
  .superRefine((val, ctx) => {
    // Q9's "Other (+text)" branch: choosing Other without saying what it is makes the
    // answer useless, so require the text.
    if (val.helpWith.includes('Other') && !val.helpWithOther) {
      ctx.addIssue({
        code: 'custom',
        path: ['helpWithOther'],
        message: 'Tell us what else you want help with',
      })
    }
  })

export type SurveyInput = z.infer<typeof surveySchema>
