import Link from 'next/link'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Renders a legal document in the site's type system.
 *
 * react-markdown rather than a hand-rolled parser, and rather than `dangerouslySetInnerHTML`
 * with a markdown-to-HTML library: it builds a React tree and never injects raw HTML, so a
 * document can't smuggle markup into the page. For text with legal effect, a parser that
 * silently mangles a clause is a worse failure than a dependency.
 *
 * remark-gfm is required, not optional — the Privacy Policy's subprocessor list is a GFM
 * table, and without the plugin it renders as pipe-separated gibberish.
 *
 * Every element is mapped explicitly. Tailwind's typography plugin isn't installed, and
 * adding it to style five pages would pull a whole design system in alongside the one the
 * project already has in globals.css.
 */
export function LegalBody({ markdown }: { markdown: string }) {
  return (
    <div className="mt-12">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h2 className="mt-12 scroll-mt-6 text-2xl leading-snug">{children}</h2>
          ),
          h2: ({ children }) => (
            <h2 className="mt-12 scroll-mt-6 border-t border-line/15 pt-8 text-2xl leading-snug">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-8 scroll-mt-6 text-lg leading-snug">{children}</h3>
          ),
          p: ({ children }) => (
            <p className="mt-4 leading-relaxed text-ink/90">{children}</p>
          ),
          ul: ({ children }) => <ul className="mt-4 space-y-2">{children}</ul>,
          ol: ({ children }) => <ol className="mt-4 space-y-2">{children}</ol>,
          li: ({ children }) => (
            <li className="relative pl-5 leading-relaxed text-ink/90 before:absolute before:top-[0.7em] before:left-0 before:h-px before:w-2.5 before:bg-gold">
              {children}
            </li>
          ),
          strong: ({ children }) => <strong className="font-medium text-ink">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          hr: () => <hr className="mt-10 border-line/15" />,
          /*
           * The DRAFT notices are blockquotes. Styled as a visible caution rather than a
           * decorative pull-quote, because that is what they are.
           */
          blockquote: ({ children }) => (
            <div className="mt-6 rounded-xl border border-gold/40 bg-sand px-5 py-4 text-sm leading-relaxed text-slate [&>p]:mt-0 [&>p+p]:mt-2">
              {children}
            </div>
          ),
          a: ({ href, children }) => {
            const target = href ?? '#'
            const className =
              'text-ink underline decoration-gold underline-offset-4 hover:decoration-2'

            // Internal cross-references between documents get client-side navigation;
            // anything external opens safely in a new tab.
            if (target.startsWith('/')) {
              return (
                <Link href={target} className={className}>
                  {children}
                </Link>
              )
            }
            return (
              <a href={target} target="_blank" rel="noopener noreferrer" className={className}>
                {children}
              </a>
            )
          },
          /* Scrolls on its own so a wide table never makes the page scroll sideways. */
          table: ({ children }) => (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[34rem] border-collapse text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-line/30 px-3 py-2 text-left font-mono text-[10px] tracking-widest text-slate uppercase">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-line/12 px-3 py-2.5 align-top leading-relaxed text-ink/90">
              {children}
            </td>
          ),
          code: ({ children }) => (
            <code className="rounded bg-sand px-1.5 py-0.5 font-mono text-[0.85em]">{children}</code>
          ),
        }}
      >
        {markdown}
      </Markdown>
    </div>
  )
}
