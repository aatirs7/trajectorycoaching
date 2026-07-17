import { z } from 'zod'

/** Coach-application option sets (spec sections 2–6). */
export const APP_FIELDS = [
  'Financial Services',
  'Technology',
  'Engineering',
  'Creative & Media',
  'Cybersecurity',
  'Other',
] as const

export const YEARS_EXPERIENCE = ['Less than 2', '2-4', '5-9', '10+'] as const
export const SESSIONS_PER_MONTH = ['1-5', '6-10', '11-20', '20+'] as const

export const AVAIL_TIMES = [
  { value: 'morning', label: 'Morning (before 12pm)' },
  { value: 'afternoon', label: 'Afternoon (12–5pm)' },
  { value: 'evening', label: 'Evening (after 5pm)' },
] as const

export const AVAIL_DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const

export const COACHING_TYPES = [
  'Resume/CV review',
  'Behavioral interview prep',
  'Technical interview prep',
  'Networking and outreach',
  'Breaking in / recruiting strategy',
  'Choosing a path or major',
  'Career switching',
  'Offer evaluation and negotiation',
  'Day-in-the-life / industry insight',
  'Portfolio or work-sample review',
  'Grad school / program applications',
  'Other',
] as const

export const EMPLOYER_CONCERNS = [
  { value: 'no', label: 'No' },
  { value: 'yes', label: 'Yes' },
  { value: 'unsure', label: 'Not sure' },
] as const

export const EMPLOYER_VISIBILITY = [
  { value: 'show_name', label: "Show my employer's name" },
  { value: 'describe_generally', label: 'Describe generally (e.g. Finance Professional)' },
] as const

export const START_TIMING = [
  { value: 'mid_august', label: 'Yes — once the platform is set (estimate: mid-August)' },
  { value: 'other', label: 'No / a different time' },
] as const

const nonEmpty = (label: string) => z.string().trim().min(1, `${label} is required`).max(2000)

/**
 * Full submission shape, re-validated server-side. The client form does per-step required
 * checks for flow, but this is the source of truth.
 */
export const applicationSchema = z
  .object({
    fullName: nonEmpty('Full name').max(120),
    email: z.string().trim().email('Enter a valid email'),

    field: z.enum(APP_FIELDS),
    fieldOther: z.string().trim().max(120).optional().or(z.literal('')),
    roleCompany: nonEmpty('Current role and company').max(200),
    yearsExperience: z.enum(YEARS_EXPERIENCE),
    linkedinUrl: nonEmpty('LinkedIn URL').max(300),

    sessionsPerMonth: z.enum(SESSIONS_PER_MONTH),
    days: z.array(z.enum(AVAIL_DAYS)).min(1, 'Pick at least one day'),
    times: z.array(z.enum(['morning', 'afternoon', 'evening'])).min(1, 'Pick at least one time'),
    startTiming: z.enum(['mid_august', 'other']),
    startOther: z.string().trim().max(300).optional().or(z.literal('')),

    rate30: nonEmpty('30-minute rate').max(60),
    rate45: z.string().trim().max(60).optional().or(z.literal('')),
    rate60: z.string().trim().max(60).optional().or(z.literal('')),
    openToSuggested: z.enum(['yes', 'no']),

    coachingTypes: z.array(z.enum(COACHING_TYPES)).min(1, 'Pick at least one'),
    coachingOther: z.string().trim().max(300).optional().or(z.literal('')),
    idealStudent: z.string().trim().max(1000).optional().or(z.literal('')),

    employerConcerns: z.enum(['no', 'yes', 'unsure']),
    employerConcernNote: z.string().trim().max(500).optional().or(z.literal('')),
    employerVisibility: z.enum(['show_name', 'describe_generally']),

    whyInterested: nonEmpty('This').max(2000),
    priorExperience: nonEmpty('This').max(2000),

    questions: z.string().trim().max(2000).optional().or(z.literal('')),
    anythingElse: z.string().trim().max(2000).optional().or(z.literal('')),
  })
  .superRefine((v, ctx) => {
    if (v.field === 'Other' && !v.fieldOther) {
      ctx.addIssue({ code: 'custom', path: ['fieldOther'], message: 'Tell us your field' })
    }
    if (v.coachingTypes.includes('Other') && !v.coachingOther) {
      ctx.addIssue({ code: 'custom', path: ['coachingOther'], message: 'Tell us what else' })
    }
    if (v.startTiming === 'other' && !v.startOther) {
      ctx.addIssue({ code: 'custom', path: ['startOther'], message: 'When could you start?' })
    }
  })

export type ApplicationInput = z.infer<typeof applicationSchema>

export const APPLICATION_STEPS = 8
