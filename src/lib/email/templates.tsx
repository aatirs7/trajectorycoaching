import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { ReactNode } from 'react'
import { POLICY_HEADING, policySentence } from '../policy-copy'

/**
 * Spec §12 email templates, §1 brand.
 *
 * Brand hexes are inlined here rather than referenced from globals.css on purpose:
 * email clients don't support CSS variables or external stylesheets. This is the ONE
 * sanctioned place to repeat the palette — keep it in sync with globals.css :root.
 */
const INK = '#0E1826'
const PAPER = '#F6F3EC'
const GOLD = '#C89B3C'
const SLATE = '#5B6472'
const LINE = '#2E4057'

const main = { backgroundColor: PAPER, fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif" }
const container = { margin: '0 auto', padding: '32px 24px', maxWidth: '560px' }
const brand = {
  fontSize: '12px',
  letterSpacing: '0.12em',
  textTransform: 'uppercase' as const,
  color: SLATE,
  fontFamily: "'IBM Plex Mono',ui-monospace,monospace",
}
const h1 = {
  color: INK,
  fontSize: '26px',
  lineHeight: '1.25',
  margin: '12px 0 16px',
  fontFamily: "'Fraunces',Georgia,serif",
}
const h2 = {
  color: INK,
  fontSize: '17px',
  lineHeight: '1.3',
  margin: '0 0 8px',
  fontFamily: "'Fraunces',Georgia,serif",
}
const text = { color: INK, fontSize: '15px', lineHeight: '1.6', margin: '0 0 14px' }
const muted = { ...text, color: SLATE, fontSize: '13px' }
const hr = { borderColor: LINE, opacity: 0.2, margin: '24px 0' }
const button = {
  display: 'inline-block',
  backgroundColor: INK,
  color: PAPER,
  padding: '11px 20px',
  borderRadius: '8px',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: 500,
}
const detailRow = { ...text, margin: '0 0 6px' }

function Shell({ preview, children }: { preview: string; children: ReactNode }) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={brand}>MentorReach</Text>
          {children}
          <Hr style={hr} />
          <Text style={muted}>Reach the people who&rsquo;ve been there.</Text>
        </Container>
      </Body>
    </Html>
  )
}

export function BookingConfirmedEmail(props: {
  studentName: string
  coachName: string
  lengthMinutes: number
  startsAt: string
  amount: string
  manageUrl: string
  /** §11 deadline label (start minus 24h), already formatted. */
  cancellationDeadline?: string
  /** Zoom join link for the meeting, when it was created. */
  joinUrl?: string
}) {
  return (
    <Shell preview={`Your session with ${props.coachName} is booked`}>
      <Heading style={h1}>Your session is booked</Heading>
      <Text style={text}>Hi {props.studentName},</Text>
      <Text style={text}>
        You&rsquo;re confirmed with {props.coachName}. Details are below, and you&rsquo;ll
        join over Zoom.
      </Text>
      <Section style={{ margin: '20px 0' }}>
        <Text style={detailRow}>
          <strong>Coach:</strong> {props.coachName}
        </Text>
        <Text style={detailRow}>
          <strong>When:</strong> {props.startsAt}
        </Text>
        <Text style={detailRow}>
          <strong>Length:</strong> {props.lengthMinutes} minutes
        </Text>
        <Text style={detailRow}>
          <strong>Paid:</strong> {props.amount}
        </Text>
        {props.joinUrl ? (
          <Text style={detailRow}>
            <strong>Zoom:</strong>{' '}
            <Link href={props.joinUrl} style={{ color: LINE }}>
              {props.joinUrl}
            </Link>
          </Text>
        ) : null}
      </Section>
      <Link href={props.manageUrl} style={button}>
        View session
      </Link>

      <Hr style={hr} />

      {/* §11 — the same policy the student acknowledged at checkout, now with the
          concrete deadline, which only exists once a time has been picked. */}
      <Heading as="h2" style={h2}>
        {POLICY_HEADING}
      </Heading>
      <Text style={text}>{policySentence(props.cancellationDeadline)}</Text>
    </Shell>
  )
}

export function PaymentReceivedEmail(props: {
  studentName: string
  coachName: string
  amount: string
  scheduleUrl: string
}) {
  return (
    <Shell preview="Payment received, now pick your time">
      <Heading style={h1}>Payment received: pick your time</Heading>
      <Text style={text}>Hi {props.studentName},</Text>
      <Text style={text}>
        We&rsquo;ve received {props.amount} for your session with {props.coachName}. One
        step left: choose a time that works for you.
      </Text>
      <Link href={props.scheduleUrl} style={button}>
        Choose a time
      </Link>
      <Text style={muted}>
        This scheduling link is single-use and tied to this session. Your seat isn&rsquo;t
        held until you pick a time.
      </Text>
    </Shell>
  )
}

export function SessionCanceledEmail(props: {
  recipientName: string
  otherPartyName: string
  startsAt: string
  refunded: boolean
}) {
  return (
    <Shell preview="Session canceled">
      <Heading style={h1}>Session canceled</Heading>
      <Text style={text}>Hi {props.recipientName},</Text>
      <Text style={text}>
        Your session with {props.otherPartyName} on {props.startsAt} has been canceled.
      </Text>
      <Text style={text}>
        {props.refunded
          ? 'Because it was canceled at least 24 hours ahead, a full refund is on its way. It typically lands in 5–10 business days.'
          : 'Because it was canceled within 24 hours of the start time, it is non-refundable under our cancellation policy.'}
      </Text>
    </Shell>
  )
}

export function SessionReminderEmail(props: {
  recipientName: string
  otherPartyName: string
  startsAt: string
  manageUrl: string
}) {
  return (
    <Shell preview={`Reminder: your session with ${props.otherPartyName}`}>
      <Heading style={h1}>Your session is coming up</Heading>
      <Text style={text}>Hi {props.recipientName},</Text>
      <Text style={text}>
        A reminder that you&rsquo;re meeting {props.otherPartyName} on {props.startsAt}.
      </Text>
      <Link href={props.manageUrl} style={button}>
        View session
      </Link>
      <Text style={muted}>
        It&rsquo;s now inside the 24-hour window, so this session is non-refundable.
      </Text>
    </Shell>
  )
}

export function CoachApprovedEmail(props: { coachName: string; payoutsUrl: string }) {
  return (
    <Shell preview="You're approved to coach on MentorReach">
      <Heading style={h1}>You&rsquo;re approved</Heading>
      <Text style={text}>Hi {props.coachName},</Text>
      <Text style={text}>
        Your profile has been reviewed and approved. One step before students can book
        you: connect your payout account so we can pay you out after each session.
      </Text>
      <Link href={props.payoutsUrl} style={button}>
        Set up payouts
      </Link>
      <Text style={muted}>
        Set your weekly availability too, and students can book you into those times — we
        create the Zoom meeting for each session automatically.
      </Text>
    </Shell>
  )
}

export function CoachRejectedEmail(props: { coachName: string; reason?: string }) {
  return (
    <Shell preview="An update on your MentorReach application">
      <Heading style={h1}>An update on your application</Heading>
      <Text style={text}>Hi {props.coachName},</Text>
      <Text style={text}>
        Thanks for applying to coach on MentorReach. We&rsquo;re not moving forward with
        your profile at this time.
      </Text>
      {props.reason ? <Text style={text}>{props.reason}</Text> : null}
      <Text style={muted}>
        If you think this was a mistake, reply to this email and we&rsquo;ll take another
        look.
      </Text>
    </Shell>
  )
}

export function ApplicationReceivedEmail(props: { firstName: string }) {
  return (
    <Shell preview="We got your MentorReach coach application">
      <Heading style={h1}>Application received</Heading>
      <Text style={text}>Hi {props.firstName},</Text>
      <Text style={text}>
        Thanks for your interest in coaching with MentorReach. We&rsquo;ve got your
        application and we&rsquo;ll follow up once we&rsquo;ve reviewed it.
      </Text>
      <Text style={muted}>No action needed from you right now.</Text>
    </Shell>
  )
}

export function NewApplicationEmail(props: {
  fullName: string
  field: string
  roleCompany: string
  reviewUrl: string
}) {
  return (
    <Shell preview={`New coach application: ${props.fullName}`}>
      <Heading style={h1}>New coach application</Heading>
      <Text style={text}>
        <strong>{props.fullName}</strong> — {props.field}
      </Text>
      <Text style={text}>{props.roleCompany}</Text>
      <Link href={props.reviewUrl} style={{ ...button, backgroundColor: GOLD, color: INK }}>
        Review it
      </Link>
    </Shell>
  )
}

export function CoachInviteEmail(props: { firstName?: string; inviteUrl: string; inviterName?: string }) {
  return (
    <Shell preview="You're invited to coach on MentorReach">
      <Heading style={h1}>You&rsquo;re invited to coach</Heading>
      <Text style={text}>{props.firstName ? `Hi ${props.firstName},` : 'Hi,'}</Text>
      <Text style={text}>
        {props.inviterName ? `${props.inviterName} invited you` : 'You&rsquo;ve been invited'} to
        join MentorReach as a coach. Follow the link to create your account and we&rsquo;ll walk you
        through setup — your profile, rates, calendar, and payouts. Your profile goes live
        automatically once it&rsquo;s complete.
      </Text>
      <Link href={props.inviteUrl} style={button}>
        Accept your invite
      </Link>
      <Text style={muted}>
        This link is unique to you. If you weren&rsquo;t expecting it, you can ignore this email.
      </Text>
    </Shell>
  )
}

export function ApplicationAcceptedEmail(props: { firstName: string; setupUrl: string }) {
  return (
    <Shell preview="You're in — set up your MentorReach coaching profile">
      <Heading style={h1}>You&rsquo;re in</Heading>
      <Text style={text}>Hi {props.firstName},</Text>
      <Text style={text}>
        We&rsquo;d love to have you coach on MentorReach. Create your account and set up your
        profile — add a photo, confirm your rates, connect payouts and your calendar — and
        you&rsquo;ll go live automatically. We&rsquo;ve pre-filled what we can from your
        application.
      </Text>
      <Link href={props.setupUrl} style={button}>
        Set up your profile
      </Link>
    </Shell>
  )
}

export function NewReportEmail(props: {
  reportId: string
  category: string
  reportedUserName: string
  adminUrl: string
}) {
  return (
    <Shell preview="New report filed">
      <Heading style={h1}>New report filed</Heading>
      <Text style={text}>
        A report was filed against <strong>{props.reportedUserName}</strong> under{' '}
        <strong>{props.category}</strong>.
      </Text>
      <Link href={props.adminUrl} style={{ ...button, backgroundColor: GOLD, color: INK }}>
        Review it
      </Link>
      <Text style={muted}>Report {props.reportId}</Text>
    </Shell>
  )
}
