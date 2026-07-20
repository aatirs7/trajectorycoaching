/**
 * Seed demo coaches so browse has something to show in a walkthrough.
 *
 *   npx tsx scripts/seed-demo.ts          # insert (idempotent)
 *   npx tsx scripts/seed-demo.ts --undo   # remove every seeded row
 *
 * SAFETY / HONESTY:
 * - Every seeded user's clerk_id starts with SEED_PREFIX, so this data is trivially
 *   identifiable and removable, and it can never collide with a real Clerk id.
 * - These accounts CANNOT sign in — no matching Clerk user exists. They exist only to
 *   populate browse.
 * - Every row is written with is_seed = true. That flag is what lets these profiles
 *   carry generated portraits: resolveHeadshot() in src/lib/headshot.ts refuses to render
 *   a placeholder face on any profile WITHOUT it, so a real coach can never show a fake
 *   face while the site claims every coach is verified against their employer.
 * - Portraits are generated (i.pravatar.cc), not photographs of real people. They're
 *   deterministic per coach, so the same demo coach always has the same face.
 * - --undo refuses to touch anything without the prefix.
 *
 * Builds its own DB client rather than importing src/db, which is 'server-only' and
 * throws outside the Next runtime.
 */
import { config } from 'dotenv'

config({ path: '.env.local' })

import { neon } from '@neondatabase/serverless'
import { and, eq, like } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from '../src/db/schema'
import { coachOfferings, coachProfiles, users } from '../src/db/schema'
import { seedHeadshotUrl } from '../src/lib/headshot'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set — check .env.local')

const db = drizzle({ client: neon(url), schema })

const SEED_PREFIX = 'seed_demo_'

type DemoCoach = {
  slug: string
  fullName: string
  email: string
  industry: string
  currentTitle: string
  bio: string
  linkedinUrl: string
  employerNote?: string
  referralCode: string
  /** Short tags for the card, drawn from what the bio actually says they help with. */
  specialties: string[]
  offerings: Array<{ lengthMinutes: number; priceCents: number }>
}

const COACHES: DemoCoach[] = [
  {
    slug: 'maya-rao',
    fullName: 'Maya Rao',
    email: 'maya.rao@demo.mentorreach.com',
    industry: 'Financial Services',
    currentTitle: 'Investment Banking Analyst at Evercore',
    bio: "I went through SA recruiting from a non-target and got there without a network, so I know exactly how opaque this process feels from the outside.\n\nI help with: reading a deal on your resume the way a banker will, the technical set that actually comes up in a first round, and how to network without sounding like a script. I'm blunt about whether your story is landing — that's the useful part.",
    linkedinUrl: 'https://www.linkedin.com/in/example-maya-rao',
    employerNote: 'Cannot discuss live deals or anything non-public.',
    referralCode: 'MRDEMO01',
    specialties: ["Non-target","SA recruiting","Networking"],
    offerings: [
      { lengthMinutes: 30, priceCents: 7500 },
      { lengthMinutes: 60, priceCents: 13000 },
    ],
  },
  {
    slug: 'daniel-osei',
    fullName: 'Daniel Osei',
    email: 'daniel.osei@demo.mentorreach.com',
    industry: 'Technology',
    currentTitle: 'Senior Software Engineer at Stripe',
    bio: "I've been on both sides of about 200 interview loops now, most recently as an interviewer at Stripe.\n\nWhat I'm actually useful for: figuring out why you're getting rejected after the onsite, system design when you've never designed a system, and deciding between offers. If your fundamentals are fine and something else is going wrong, I can usually find it in one session.",
    linkedinUrl: 'https://www.linkedin.com/in/example-daniel-osei',
    referralCode: 'DODEMO02',
    specialties: ["Interview prep","System design","Offer negotiation"],
    offerings: [
      { lengthMinutes: 30, priceCents: 6500 },
      { lengthMinutes: 45, priceCents: 9000 },
      { lengthMinutes: 60, priceCents: 11000 },
    ],
  },
  {
    slug: 'jordan-whitfield',
    fullName: 'Jordan Whitfield',
    email: 'jordan.w@demo.mentorreach.com',
    industry: 'Technology',
    currentTitle: 'Group Product Manager at Figma',
    bio: "I switched into PM from design, so I'm a good person to talk to if you don't have the 'standard' background and are wondering whether that's fatal. It isn't, usually.\n\nI help with breaking into APM programs, PM interview loops, and the thing nobody tells you: how to talk about work you did on a team without either overclaiming or disappearing from your own story.",
    linkedinUrl: 'https://www.linkedin.com/in/example-jordan-whitfield',
    referralCode: 'JWDEMO04',
    specialties: ["APM programs","Career switching","PM interviews"],
    offerings: [
      { lengthMinutes: 30, priceCents: 7000 },
      { lengthMinutes: 60, priceCents: 12500 },
    ],
  },
  {
    slug: 'ravi-kapoor',
    fullName: 'Ravi Kapoor',
    email: 'ravi.kapoor@demo.mentorreach.com',
    industry: 'Engineering',
    currentTitle: 'Mechanical Engineer at SpaceX',
    bio: "I went from a state-school ME degree to SpaceX, and I've screened a lot of new-grad applications since.\n\nI help with the stuff that actually gets an engineering resume past the first filter: framing your projects and internships so they read as real engineering, what hardware interviews actually test, and whether the roles you're chasing match what you've built. I'll tell you if your portfolio is doing the work or just taking up space.",
    linkedinUrl: 'https://www.linkedin.com/in/example-ravi-kapoor',
    referralCode: 'RKDEMO08',
    specialties: ["New-grad hiring", "Portfolio projects", "Hardware interviews"],
    offerings: [
      { lengthMinutes: 30, priceCents: 6000 },
      { lengthMinutes: 60, priceCents: 11000 },
    ],
  },
  {
    slug: 'zoe-bennett',
    fullName: 'Zoe Bennett',
    email: 'zoe.bennett@demo.mentorreach.com',
    industry: 'Creative & Media',
    currentTitle: 'Senior Art Director at Wieden+Kennedy',
    bio: "I hire and mentor juniors at a big agency, and I broke in without a fancy design school myself.\n\nI help with the parts of a creative career nobody explains: what a book actually needs to land an agency interview, how to talk about your work without either underselling or overclaiming, and whether the reel or portfolio you have is ready or a round away. Blunt, useful feedback, not politeness.",
    linkedinUrl: 'https://www.linkedin.com/in/example-zoe-bennett',
    referralCode: 'ZBDEMO09',
    specialties: ["Portfolio review", "Breaking into agencies", "Reel & book"],
    offerings: [
      { lengthMinutes: 30, priceCents: 5500 },
      { lengthMinutes: 45, priceCents: 8000 },
    ],
  },
  {
    slug: 'nadia-haddad',
    fullName: 'Nadia Haddad',
    email: 'nadia.haddad@demo.mentorreach.com',
    industry: 'Cybersecurity',
    currentTitle: 'Senior Security Engineer at CrowdStrike',
    bio: "I came into security through a help desk job and a lot of CTFs, not a CS degree, so I have opinions about which certs are worth your money and which are not.\n\nI help with breaking into blue team or offensive security, what a SOC role is actually like day to day, and building a home lab that gives you something real to talk about. If you're deciding between security and general software, I can give you the honest tradeoff.",
    linkedinUrl: 'https://www.linkedin.com/in/example-nadia-haddad',
    employerNote: 'Nothing about customers, incidents, or internal tooling.',
    referralCode: 'NHDEMO07',
    specialties: ["Blue team","Certs & home lab","Breaking in"],
    offerings: [
      { lengthMinutes: 30, priceCents: 6000 },
      { lengthMinutes: 60, priceCents: 10500 },
    ],
  },
]

async function undo() {
  const seeded = await db.query.users.findMany({
    where: like(users.clerkId, `${SEED_PREFIX}%`),
  })

  if (!seeded.length) {
    console.log('No seeded rows found. Nothing to remove.')
    return
  }

  for (const u of seeded) {
    // Belt and braces: never delete anything without the prefix, even if the query above
    // were somehow wrong.
    if (!u.clerkId.startsWith(SEED_PREFIX)) continue

    await db.delete(coachOfferings).where(eq(coachOfferings.coachId, u.id))
    await db.delete(coachProfiles).where(eq(coachProfiles.userId, u.id))
    await db.delete(users).where(and(eq(users.id, u.id), like(users.clerkId, `${SEED_PREFIX}%`)))
  }

  console.log(`Removed ${seeded.length} seeded coaches.`)
}

async function seed() {
  for (const c of COACHES) {
    const clerkId = `${SEED_PREFIX}${c.slug}`

    const [user] = await db
      .insert(users)
      .values({ clerkId, role: 'coach', email: c.email, fullName: c.fullName })
      .onConflictDoUpdate({
        target: users.clerkId,
        set: { email: c.email, fullName: c.fullName, role: 'coach' },
      })
      .returning()

    /**
     * Deterministic per coach: same demo coach, same face, every reseed. Keyed on the
     * stable slug rather than the uuid so re-running after an --undo doesn't reshuffle
     * everyone's portrait.
     */
    const headshotUrl = seedHeadshotUrl(c.slug)

    await db
      .insert(coachProfiles)
      .values({
        userId: user.id,
        industry: c.industry,
        currentTitle: c.currentTitle,
        bio: c.bio,
        headshotUrl,
        specialties: c.specialties,
        linkedinUrl: c.linkedinUrl,
        employerNote: c.employerNote ?? null,
        referralCode: c.referralCode,
        // Demo coaches are pre-approved so browse has something in it. Real coaches
        // still default to 'pending' — this bypasses nothing in the app itself.
        status: 'approved',
        approvedAt: new Date(),
        // The flag that permits the generated portrait above. Without it, resolveHeadshot()
        // would (correctly) refuse to render it.
        isSeed: true,
      })
      .onConflictDoUpdate({
        target: coachProfiles.userId,
        set: {
          industry: c.industry,
          currentTitle: c.currentTitle,
          bio: c.bio,
          headshotUrl,
          specialties: c.specialties,
          linkedinUrl: c.linkedinUrl,
          status: 'approved',
          isSeed: true,
        },
      })

    for (const o of c.offerings) {
      await db
        .insert(coachOfferings)
        .values({ coachId: user.id, lengthMinutes: o.lengthMinutes, priceCents: o.priceCents })
        .onConflictDoUpdate({
          target: [coachOfferings.coachId, coachOfferings.lengthMinutes],
          set: { priceCents: o.priceCents, isActive: true },
        })
    }

    console.log(`  ✓ ${c.fullName} — ${c.industry}`)
  }

  console.log(`\nSeeded ${COACHES.length} demo coaches.`)
  console.log(`Remove them any time with:  npx tsx scripts/seed-demo.ts --undo`)
}

const main = process.argv.includes('--undo') ? undo : seed

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
