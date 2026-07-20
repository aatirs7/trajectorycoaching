import type { OpsCategory, OpsOwner, OpsStatus } from './ops-schema'

/**
 * Initial ops-board contents, from the spec. Inserted once, only if the tasks table is
 * empty (see seedOpsBoard in the /ops actions), so editing on the live board is never
 * clobbered by a reseed. Statuses reflect what's actually true so the board is accurate
 * on first load.
 */
export type OpsSeedTask = {
  title: string
  owner: OpsOwner
  status: OpsStatus
  details?: string
  thisWeek?: boolean
}

export const OPS_SEED: Record<OpsCategory, OpsSeedTask[]> = {
  'Business & Legal': [
    { title: 'Form the LLC (two-member: Aatir + Isaiah)', owner: 'Both', status: 'todo', details: 'File Articles of Organization in home state (~$50-200 online).' },
    { title: 'Draft and sign the Operating Agreement', owner: 'Both', status: 'todo', details: "Encodes the 60/40 split (Isaiah-leaning), each person's role, how decisions get made, and exit terms. Template is fine; both sign." },
    { title: 'Get an EIN from the IRS', owner: 'Both', status: 'todo', details: 'Free, online, instant. Needed for the bank account and Stripe.' },
    { title: 'Open a business bank account', owner: 'Both', status: 'todo', details: 'In the LLC name; needs EIN + filed articles. All MentorReach money flows through it.' },
    { title: 'Move Stripe and the domain under the LLC', owner: 'Aatir', status: 'todo', details: 'Once the bank account and EIN exist.' },
    { title: 'Legal docs: Terms, Privacy Policy, Mentor Agreement', owner: 'Isaiah', status: 'todo', details: 'Isaiah drafts the content; Aatir adds the pages.' },
    { title: 'Confirm coach tax handling', owner: 'Both', status: 'done', details: 'Resolved: coaches are independent contractors; Stripe issues their 1099-K through Connect. The LLC does not 1099 coaches and only reports the commission it keeps.' },
    { title: 'Review the business model', owner: 'Both', status: 'todo', details: 'Sanity-check pricing, commission tiers, and unit economics.' },
    { title: 'Finalize responsibility split', owner: 'Both', status: 'in_progress', details: 'Working split ~60/40 Isaiah-leaning. Aatir = tech/product + cyber mentoring; Isaiah = marketing, social, legal-doc content, recruiting; shared = LLC and business. Formalize in the Operating Agreement.' },
  ],
  'Website & Product': [
    { title: 'Remove employer-verification claims site-wide', owner: 'Aatir', status: 'in_progress', details: 'Spec ready; being removed now.' },
    { title: 'Switch to broad categories, show only populated', owner: 'Aatir', status: 'in_progress', details: 'Financial Services / Technology / Engineering / Creative & Media / Cybersecurity.' },
    { title: 'Self-serve coach onboarding (auto-publish, drop approval gate)', owner: 'Aatir', status: 'in_progress', details: 'Building now.' },
    { title: 'Coach handbook page + acknowledgment', owner: 'Aatir', status: 'in_progress', details: 'Content drafted; /coach/handbook plus a required "read and agree" checkbox before publish.' },
    { title: 'Tier-based pricing (50 completed sessions unlocks higher rate caps)', owner: 'Aatir', status: 'todo', details: 'Not yet specced.' },
    { title: 'Logo + branded email, transparent, added to site', owner: 'Aatir', status: 'todo', details: "Aatir's logo as a transparent PNG; add to header/footer." },
    { title: 'Verify the is_seed photo guardrail', owner: 'Aatir', status: 'todo', details: 'Test a real coach with no photo shows initials, never a placeholder face.' },
    { title: 'Confirm booking-deadline timezone', owner: 'Aatir', status: 'todo', details: "Ensure the cancellation deadline uses the session start time in the student's timezone." },
    { title: 'Check react-email deprecation', owner: 'Aatir', status: 'todo', details: 'Low priority; confirm the package consolidation before scaling email.' },
    { title: 'Build the ops / to-do board', owner: 'Aatir', status: 'in_progress', details: 'This page.' },
    { title: 'Domain mentorreach.com on Vercel', owner: 'Aatir', status: 'done' },
    { title: 'Dispute-proof cancellation microcopy', owner: 'Aatir', status: 'done', details: 'Homepage, checkout ack + checkbox, and confirmation email.' },
    { title: 'Public browse, gate at booking', owner: 'Aatir', status: 'done' },
    { title: 'Design polish (section rhythm, type scale, placeholder imagery, card tags)', owner: 'Aatir', status: 'done' },
  ],
  'Founding Coaches': [
    { title: 'Send onboarding emails to all 9 coaches', owner: 'Both', status: 'todo', details: 'Blocked until the verification-copy removal, broad categories, and self-serve onboarding are live. Use the short nudge email.' },
    { title: 'Onboard Ethan Viju (Technology)', owner: 'Both', status: 'todo', details: 'Ethanmviju@live.com' },
    { title: 'Onboard Push Patel (Technology)', owner: 'Both', status: 'todo', details: 'patelp6352@gmail.com' },
    { title: 'Onboard Langston Holly (Financial Services)', owner: 'Both', status: 'todo', details: 'lholly1@outlook.com' },
    { title: 'Onboard Omar McKinney (Financial Services)', owner: 'Both', status: 'todo', details: 'omarmckinney13@gmail.com' },
    { title: 'Onboard Tamara Farrell (Financial Services)', owner: 'Both', status: 'todo', details: 'tamaramfarrell@gmail.com' },
    { title: 'Onboard Vivek Boojala (Financial Services)', owner: 'Both', status: 'todo', details: 'Vivek.boojala@gmail.com' },
    { title: 'Onboard Sagar Sapkota (Engineering)', owner: 'Both', status: 'todo', details: 'ssagar.ssapkota@gmail.com' },
    { title: 'Onboard Sarah Floyd (Financial Services)', owner: 'Both', status: 'todo', details: 'Sarahfloyd4911@gmail.com' },
    { title: 'Onboard Pablo Soto (Creative & Media)', owner: 'Both', status: 'todo', details: 'Pabloesoto@outlook.com' },
  ],
  'Marketing & Social': [
    { title: 'Create the Facebook page', owner: 'Isaiah', status: 'todo' },
    { title: 'Create the Instagram account', owner: 'Isaiah', status: 'todo' },
    { title: 'Create the Twitter/X account', owner: 'Isaiah', status: 'todo' },
    { title: 'Evaluate buying an existing IG account', owner: 'Isaiah', status: 'todo', details: "Caution: this breaks Instagram's ToS, risks a ban, and bought followers tend to be dead weight that hurt reach. A clean handle grown from scratch is safer." },
    { title: 'Scope marketing plan / services', owner: 'Isaiah', status: 'todo' },
    { title: 'Target international students', owner: 'Both', status: 'todo', details: 'Students abroad looking for US-based mentors. Validate demand, then build positioning and outreach.' },
  ],
}
