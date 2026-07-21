import 'server-only'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The legal documents, their versions, and a stable hash of what each one actually says.
 *
 * WHY A HASH AND NOT JUST A VERSION: an acceptance row records that someone agreed, but a
 * version number alone cannot prove WHAT they agreed to — anyone can edit a markdown file
 * without touching its frontmatter, and every prior acceptance silently starts pointing at
 * text nobody ever saw. The hash makes that detectable, and `npm test` fails when a
 * document's content changes without a version bump (see legal.test.ts).
 *
 * Documents are read from disk rather than imported, so the raw markdown is never bundled
 * into a client component by accident.
 */
export const LEGAL_KEYS = [
  'terms',
  'privacy',
  'refunds',
  'mentor_agreement',
  'mentor_handbook',
] as const

export type LegalKey = (typeof LEGAL_KEYS)[number]

/** Keys that require a typed signature rather than a checkbox. */
export const SIGNATURE_KEYS: readonly LegalKey[] = ['mentor_agreement', 'mentor_handbook']

type DocMeta = { file: string; slug: string }

const FILES: Record<LegalKey, DocMeta> = {
  terms: { file: 'terms-of-service.md', slug: 'terms' },
  privacy: { file: 'privacy-policy.md', slug: 'privacy' },
  refunds: { file: 'refund-policy.md', slug: 'refunds' },
  mentor_agreement: { file: 'mentor-agreement.md', slug: 'mentor-agreement' },
  mentor_handbook: { file: 'mentor-handbook.md', slug: 'mentor-handbook' },
}

export type LegalDocument = {
  key: LegalKey
  slug: string
  title: string
  version: string
  effectiveDate: string
  /** Markdown body, frontmatter removed. */
  content: string
  /** SHA-256 of the body — the evidence of exactly what was agreed to. */
  contentHash: string
  /** Unresolved `[BRACKET]` placeholders still in the text. */
  placeholders: string[]
}

const CONTENT_DIR = join(process.cwd(), 'src/content/legal')

/**
 * Parsed once per process. These files cannot change at runtime — they ship with the
 * build — so re-reading and re-hashing on every request would be pure waste on a page
 * that is otherwise trivially cheap.
 */
const cache = new Map<LegalKey, LegalDocument>()

/**
 * Deliberately minimal frontmatter parsing: three known scalar keys, no nesting, no YAML
 * dependency. Adding gray-matter for `title: Terms of Service` would be a package to
 * audit and update for something a regex handles exactly.
 */
function parse(key: LegalKey, raw: string): LegalDocument {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw.replace(/\r\n/g, '\n'))
  if (!match) throw new Error(`legal/${FILES[key].file}: missing frontmatter block`)

  const [, front, body] = match
  const field = (name: string) => {
    const m = new RegExp(`^${name}:\\s*(.+)$`, 'm').exec(front!)
    if (!m) throw new Error(`legal/${FILES[key].file}: frontmatter is missing "${name}"`)
    return m[1]!.trim()
  }

  const content = body!.trim()

  /**
   * A bracketed token NOT followed by "(" — markdown links are `[text](url)`, and the
   * cross-references between these documents are real links that must not be flagged.
   */
  const placeholders = [...new Set([...content.matchAll(/\[[^\]\n]{1,60}\](?!\()/g)].map((m) => m[0]))]

  return {
    key,
    slug: FILES[key].slug,
    title: field('title'),
    version: field('version'),
    effectiveDate: field('effective_date'),
    content,
    contentHash: createHash('sha256').update(content, 'utf8').digest('hex'),
    placeholders,
  }
}

export function getDocument(key: LegalKey): LegalDocument {
  const hit = cache.get(key)
  if (hit) return hit

  const raw = readFileSync(join(CONTENT_DIR, FILES[key].file), 'utf8')
  const doc = parse(key, raw)
  cache.set(key, doc)
  return doc
}

export function allDocuments(): LegalDocument[] {
  return LEGAL_KEYS.map(getDocument)
}

/** Slug → key, for the /legal/[slug] route. Returns null for an unknown slug. */
export function keyForSlug(slug: string): LegalKey | null {
  return LEGAL_KEYS.find((k) => FILES[k].slug === slug) ?? null
}

export function isLegalKey(v: unknown): v is LegalKey {
  return typeof v === 'string' && (LEGAL_KEYS as readonly string[]).includes(v)
}
