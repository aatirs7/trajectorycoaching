import { z } from 'zod'

/** Spec §5 — coach profile setup. Shared by the client form and the server action. */

/**
 * The single source of truth for coach fields.
 *
 * Open set by design — `text` in the DB, so adding one is not a migration. Browse's
 * filter reads the DISTINCT industries actually in use rather than this list, so a new
 * entry shows up there as soon as one approved coach picks it.
 *
 * Cybersecurity is its own field, deliberately not folded under Software engineering:
 * the recruiting path, the interviews and the employers are different, and a student
 * filtering for it would not find the right coach under a generic tech label.
 */
export const INDUSTRIES = [
  'Financial Services',
  'Technology',
  'Engineering',
  'Creative & Media',
  'Cybersecurity',
] as const

/** Spec §5/§9 — Calendly event types are created to match these. */
export const SESSION_LENGTHS = [30, 45, 60] as const

const MIN_PRICE_CENTS = 500 // $5 — below this Stripe fees eat the whole transaction
const MAX_PRICE_CENTS = 100_000 // $1,000 — a typo guard, not a policy

/**
 * LinkedIn is now OPTIONAL. We select coaches personally by invitation and no longer
 * claim to verify anyone's employer, so this is just useful context, not a gate. When
 * present it must be a linkedin.com URL; blank is fine.
 */
const linkedinUrl = z
  .string()
  .trim()
  .refine(
    (v) => {
      if (!v) return true
      try {
        const u = new URL(v.startsWith('http') ? v : `https://${v}`)
        return u.hostname.replace(/^www\./, '').endsWith('linkedin.com')
      } catch {
        return false
      }
    },
    { message: 'Must be a linkedin.com URL' },
  )
  .transform((v) => (v && !v.startsWith('http') ? `https://${v}` : v))
  .optional()
  .or(z.literal(''))

export const offeringSchema = z.object({
  lengthMinutes: z.coerce.number().int().refine((v) => SESSION_LENGTHS.includes(v as 30 | 45 | 60), {
    message: 'Length must be 30, 45, or 60 minutes',
  }),
  priceCents: z.coerce
    .number()
    .int('Price must be a whole number of cents')
    .min(MIN_PRICE_CENTS, 'Minimum session price is $5')
    .max(MAX_PRICE_CENTS, 'Maximum session price is $1,000'),
})

/**
 * Spec §8/§9 — the coach's PUBLIC Calendly page, for the read-only "view schedule"
 * embed. Distinct from the API user URI: the API URI can't be iframed and the public
 * slug can't be derived from it, so the coach supplies this directly.
 *
 * Validated to calendly.com so we never iframe an arbitrary attacker-supplied origin.
 */
const calendlySchedulingUrl = z
  .string()
  .trim()
  .refine(
    (v) => {
      if (!v) return true
      try {
        const u = new URL(v.startsWith('http') ? v : `https://${v}`)
        return u.hostname.replace(/^www\./, '') === 'calendly.com'
      } catch {
        return false
      }
    },
    { message: 'Must be a calendly.com link' },
  )
  .transform((v) => (v && !v.startsWith('http') ? `https://${v}` : v))
  .optional()
  .or(z.literal(''))

export const coachProfileSchema = z.object({
  industry: z.string().trim().min(1, 'Pick your field').max(120),
  currentTitle: z.string().trim().min(1, 'Your current role is required').max(160),
  calendlySchedulingUrl,
  bio: z
    .string()
    .trim()
    .min(80, 'Give students something to go on: at least 80 characters')
    .max(2000),
  headshotUrl: z.string().trim().url('Must be a valid URL').optional().or(z.literal('')),
  linkedinUrl,
  employerNote: z.string().trim().max(500).optional().or(z.literal('')),
  /** From the application §6 — how the employer shows on the public profile. */
  employerVisibility: z.enum(['show_name', 'describe_generally']).default('show_name'),
  generalTitle: z.string().trim().max(160).optional().or(z.literal('')),
  offerings: z
    .array(offeringSchema)
    .min(1, 'Offer at least one session length')
    .max(SESSION_LENGTHS.length)
    .refine(
      (list) => new Set(list.map((o) => o.lengthMinutes)).size === list.length,
      { message: 'Each session length can only be listed once' },
    ),
})

export type CoachProfileInput = z.infer<typeof coachProfileSchema>

export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100)
}

/** Parse a user-typed dollar amount ("75", "$75.50") into integer cents. */
export function parsePriceToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null
  return Math.round(Number.parseFloat(cleaned) * 100)
}
