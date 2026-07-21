import { notFound } from 'next/navigation'
import { LegalBody } from './legal-body'
import { LEGAL_KEYS, getDocument, keyForSlug } from '@/lib/legal'
import { absoluteUrl } from '@/lib/seo'

/**
 * The legal documents, public and indexable.
 *
 * Deliberately NOT behind auth: a prospective mentor has to be able to read the Mentor
 * Agreement before deciding whether to sign up, and a student has to be able to read the
 * Terms before creating an account. Gating them would defeat their purpose.
 */
export function generateStaticParams() {
  return LEGAL_KEYS.map((k) => ({ slug: getDocument(k).slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const key = keyForSlug(slug)
  if (!key) return { title: 'Not found' }

  const doc = getDocument(key)
  return {
    title: doc.title,
    description: `${doc.title} for MentorReach. Version ${doc.version}, effective ${doc.effectiveDate}.`,
    alternates: { canonical: `/legal/${doc.slug}` },
    openGraph: { title: `${doc.title} · MentorReach`, url: `/legal/${doc.slug}` },
  }
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const key = keyForSlug(slug)
  if (!key) notFound()

  const doc = getDocument(key)
  const effective = new Date(`${doc.effectiveDate}T00:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })

  return (
    <main className="mx-auto w-full max-w-[46rem] flex-1 px-6 py-14">
      <header className="text-center">
        <p className="label-mono">Legal</p>
        <h1 className="mt-3 text-4xl leading-tight">{doc.title}</h1>
        <p className="mt-4 font-mono text-xs tracking-wide text-slate uppercase">
          Version {doc.version} · Effective {effective}
        </p>
      </header>

      {/*
       * Development-only. These documents still contain bracketed placeholders like
       * [LEGAL ENTITY NAME] that must be filled before launch — shipping them would mean
       * publishing a contract with blanks in it. The warning is loud locally and absent in
       * production, because a visitor seeing "this document is unfinished" is worse than
       * the placeholder itself.
       */}
      {process.env.NODE_ENV !== 'production' && doc.placeholders.length > 0 ? (
        <div className="mt-8 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          <p className="font-mono text-xs tracking-wide text-destructive uppercase">
            Dev only · {doc.placeholders.length} unresolved placeholder
            {doc.placeholders.length === 1 ? '' : 's'}
          </p>
          <p className="mt-2 font-mono text-xs leading-relaxed break-words text-ink/80">
            {doc.placeholders.join('  ')}
          </p>
          <p className="mt-2 text-xs text-slate">
            Fill these in before launch. This banner never renders in production.
          </p>
        </div>
      ) : null}

      <LegalBody markdown={doc.content} />

      <footer className="mt-14 border-t border-line/15 pt-6 text-center">
        <p className="text-xs leading-relaxed text-slate">
          Version {doc.version}, effective {effective}. Prior versions are retained for anyone who
          accepted them.
        </p>
      </footer>

      {/*
       * Structured data so the documents are understood as policy pages rather than
       * generic marketing content.
       */}
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: doc.title,
            url: absoluteUrl(`/legal/${doc.slug}`),
            datePublished: doc.effectiveDate,
            version: doc.version,
            isPartOf: { '@id': absoluteUrl('/#website') },
            publisher: { '@id': absoluteUrl('/#organization') },
          }).replace(/</g, '\\u003c'),
        }}
      />
    </main>
  )
}
