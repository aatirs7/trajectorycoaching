/**
 * Send one real email through Resend, to prove the integration works.
 *
 *   npm run email:test -- you@example.com
 *   npm run email:test -- you@example.com coach-approved
 *
 * Every template is rendered with realistic sample data, so you can see what each one
 * actually looks like in a real client — Gmail and Outlook both mangle HTML email in
 * ways no preview tool reproduces.
 *
 * WHY THIS RENDERS THE TEMPLATE ITSELF INSTEAD OF CALLING lib/email/client.ts:
 * that module imports `server-only`, whose default entry throws the moment it is
 * imported outside a server component. The obvious fix — running tsx with
 * `--conditions=react-server`, which maps `server-only` to an empty module — swaps one
 * failure for another: under that condition Resend's bundled renderer can no longer
 * resolve @react-email/render, and every send dies with "Failed to render React
 * component". The two requirements are mutually exclusive.
 *
 * So this renders to HTML here and posts that. What it verifies is what actually breaks
 * in practice: the API key, the from-domain, and whether each template renders. The
 * skip-and-log behaviour of sendEmail() is covered by the app itself.
 */
import { config } from 'dotenv'

config({ path: '.env.local' })

import { render } from '@react-email/components'
import type { ReactElement } from 'react'
import { Resend } from 'resend'
import {
  ApplicationAcceptedEmail,
  ApplicationReceivedEmail,
  BookingConfirmedEmail,
  CoachApprovedEmail,
  CoachInviteEmail,
  CoachRejectedEmail,
  SessionCanceledEmail,
  SessionReminderEmail,
} from '../src/lib/email/templates'

const APP = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '') ?? 'http://localhost:3000'

/** Sample data is deliberately realistic — placeholder text hides layout problems. */
const SAMPLES: Record<string, { subject: string; react: () => ReactElement }> = {
  'coach-invite': {
    subject: 'You’re invited to coach on MentorReach',
    react: () =>
      CoachInviteEmail({
        firstName: 'Isaiah',
        inviteUrl: `${APP}/join/sample-invite-token`,
        inviterName: 'Aatir Siddiqui',
      }),
  },
  'application-received': {
    subject: 'We got your MentorReach coach application',
    react: () => ApplicationReceivedEmail({ firstName: 'Nadia' }),
  },
  'application-accepted': {
    subject: 'You’re in — set up your MentorReach coaching profile',
    react: () =>
      ApplicationAcceptedEmail({ firstName: 'Nadia', setupUrl: `${APP}/join/sample-invite-token` }),
  },
  'coach-approved': {
    subject: 'You’re approved to coach on MentorReach',
    react: () => CoachApprovedEmail({ coachName: 'Nadia', payoutsUrl: `${APP}/coach/payouts` }),
  },
  'coach-rejected': {
    subject: 'An update on your MentorReach application',
    react: () => CoachRejectedEmail({ coachName: 'Nadia' }),
  },
  'booking-confirmed': {
    subject: 'Your session with Nadia Haddad is booked',
    react: () =>
      BookingConfirmedEmail({
        studentName: 'Sam',
        coachName: 'Nadia Haddad',
        lengthMinutes: 30,
        startsAt: 'Tuesday, 5 August at 4:00 PM EDT',
        amount: '$60.00',
        manageUrl: `${APP}/sessions`,
        cancellationDeadline: 'Monday, 4 August at 4:00 PM EDT',
        joinUrl: 'https://zoom.us/j/0000000000',
      }),
  },
  'session-reminder': {
    subject: 'Reminder: your session with Nadia Haddad',
    react: () =>
      SessionReminderEmail({
        recipientName: 'Sam',
        otherPartyName: 'Nadia Haddad',
        startsAt: 'tomorrow at 4:00 PM EDT',
        manageUrl: `${APP}/sessions`,
      }),
  },
  'session-canceled': {
    subject: 'Your MentorReach session was canceled',
    react: () =>
      SessionCanceledEmail({
        recipientName: 'Sam',
        otherPartyName: 'Nadia Haddad',
        startsAt: 'Tuesday, 5 August at 4:00 PM EDT',
        refunded: true,
      }),
  },
}

const to = process.argv[2]
const which = process.argv[3] ?? 'coach-invite'

if (!to) {
  console.error('Usage: npm run email:test -- you@example.com [template]\n')
  console.error(`Templates: ${Object.keys(SAMPLES).join(', ')}`)
  process.exit(1)
}

const sample = SAMPLES[which]
if (!sample) {
  console.error(`Unknown template "${which}".\nTemplates: ${Object.keys(SAMPLES).join(', ')}`)
  process.exit(1)
}

async function main() {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM

  if (!apiKey || !from) {
    console.error(
      'RESEND_API_KEY and EMAIL_FROM must both be set in .env.local.\n' +
        'The app skips sends silently when they are missing, which is what this script exists to catch.',
    )
    process.exit(1)
  }

  console.log(`from:     ${from}`)
  console.log(`to:       ${to}`)
  console.log(`template: ${which}\n`)

  const html = await render(sample!.react())
  const { error } = await new Resend(apiKey).emails.send({
    from,
    to: to!,
    subject: sample!.subject,
    html,
  })

  if (!error) {
    console.log('Sent. Check the inbox, and the spam folder if it is not there.')
    return
  }

  console.error(`Not sent: ${error.message}`)

  /**
   * The two failures that actually happen on a fresh Resend account, named explicitly
   * because the API's own message for each is terse enough to be misread as a bug.
   */
  if (/domain|from/i.test(error.message)) {
    console.error(
      '\nEMAIL_FROM must use a domain verified in Resend. Until mentorreach.com is\n' +
        'verified there, onboarding@resend.dev is the only sender that works.',
    )
  }
  if (/testing|own email/i.test(error.message)) {
    console.error(
      '\nResend restricts unverified accounts to sending only to the address that owns\n' +
        'the account. Verify a domain to send anywhere else.',
    )
  }
  process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
