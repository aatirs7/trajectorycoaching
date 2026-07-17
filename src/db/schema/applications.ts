import { boolean, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

/**
 * Coach applications — the public pre-vetting front door (/coaches/apply). NOT a coach
 * profile: an applicant has no account until Aatir/Isaiah accept them and they go through
 * the existing self-serve setup, which pre-fills from this row by matching email.
 *
 * Free-text/status fields are plain `text` with app validation (see src/lib/
 * application-schema.ts) rather than pg enums — internal review data that will churn.
 */
export const coachApplications = pgTable(
  'coach_applications',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // contact
    fullName: text('full_name').notNull(),
    email: text('email').notNull(),

    // background
    field: text('field').notNull(),
    fieldOther: text('field_other'),
    roleCompany: text('role_company').notNull(),
    yearsExperience: text('years_experience').notNull(),
    linkedinUrl: text('linkedin_url').notNull(),

    // availability
    sessionsPerMonth: text('sessions_per_month').notNull(),
    /** { days: string[], times: string[] } */
    availability: jsonb('availability').$type<{ days: string[]; times: string[] }>().notNull(),
    startTiming: text('start_timing').notNull(), // "mid_august" | "other"
    startOther: text('start_other'),

    // pricing
    rate30: text('rate_30').notNull(),
    rate45: text('rate_45'),
    rate60: text('rate_60'),
    openToSuggested: boolean('open_to_suggested').notNull(),

    // offer
    coachingTypes: jsonb('coaching_types').$type<string[]>().notNull(),
    coachingOther: text('coaching_other'),
    idealStudent: text('ideal_student'),

    // employer
    employerConcerns: text('employer_concerns').notNull(), // "no" | "yes" | "unsure"
    employerConcernNote: text('employer_concern_note'),
    employerVisibility: text('employer_visibility').notNull(), // "show_name" | "describe_generally"

    // motivation
    whyInterested: text('why_interested').notNull(),
    priorExperience: text('prior_experience').notNull(),

    // wrap
    questions: text('questions'),
    anythingElse: text('anything_else'),

    // meta
    status: text('status').notNull().default('new'), // new | reviewing | accepted | rejected
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true, mode: 'date' }),
    reviewedBy: text('reviewed_by'),
  },
  (t) => [index('coach_applications_status_created_idx').on(t.status, t.createdAt)],
)
