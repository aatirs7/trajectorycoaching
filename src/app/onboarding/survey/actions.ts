'use server'

import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { studentSurveys } from '@/db/schema'
import { requireUser } from '@/lib/auth/guards'
import { surveySchema } from '@/lib/survey-schema'

export type SurveyState = {
  errors?: Record<string, string[]>
  message?: string
}

/**
 * Spec §7 — save the survey and unlock browse/book (§2.3).
 *
 * Authorization lives here rather than in a proxy: Server Actions are POSTs to whatever
 * route they're used on, so a matcher can silently stop covering them.
 */
export async function submitSurvey(_prev: SurveyState, formData: FormData): Promise<SurveyState> {
  const user = await requireUser()

  if (user.role !== 'student') {
    return { message: 'Only students fill out the survey.' }
  }

  const raw = {
    educationLevel: formData.get('educationLevel'),
    gradeYear: formData.get('gradeYear'),
    school: formData.get('school'),
    major: formData.get('major') ?? '',
    careerInterest: formData.get('careerInterest'),
    target: formData.get('target') ?? '',
    pathCertainty: formData.get('pathCertainty'),
    priorExperience: formData.get('priorExperience') ?? '',
    helpWith: formData.getAll('helpWith'),
    helpWithOther: formData.get('helpWithOther') ?? '',
    heardFrom: formData.get('heardFrom') ?? '',
  }

  const parsed = surveySchema.safeParse(raw)

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      message: 'Please fix the highlighted answers.',
    }
  }

  const v = parsed.data

  const values = {
    userId: user.id,
    educationLevel: v.educationLevel,
    gradeYear: v.gradeYear,
    school: v.school,
    major: v.major || null,
    careerInterest: v.careerInterest,
    target: v.target || null,
    pathCertainty: v.pathCertainty,
    priorExperience: v.priorExperience || null,
    helpWith: v.helpWith as string[],
    helpWithOther: v.helpWithOther || null,
    heardFrom: v.heardFrom || null,
    // §2.3: this timestamp IS the gate. Setting it is what unlocks browse/book.
    completedAt: new Date(),
  }

  // Upsert on the unique user_id so a resubmit updates rather than violating it.
  await db
    .insert(studentSurveys)
    .values(values)
    .onConflictDoUpdate({ target: studentSurveys.userId, set: values })

  redirect('/coaches')
}

/** Load an in-progress or completed survey so the form can be resumed/edited. */
export async function getMySurvey() {
  const user = await requireUser()
  return db.query.studentSurveys.findFirst({ where: eq(studentSurveys.userId, user.id) })
}
