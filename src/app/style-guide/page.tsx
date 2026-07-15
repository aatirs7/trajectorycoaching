import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export const metadata = { title: 'Style guide' }

/**
 * Phase 0 brand proof (spec §1). Internal — not linked from anywhere.
 *
 * The load-bearing assertion on this page is the UNSTYLED <Button> below: it renders
 * ink-on-paper with no brand classes at all. That's what proves the token remap in
 * globals.css actually took, i.e. the difference between "the brand tokens exist" and
 * §1's "apply platform-wide, not just homepage."
 */
const SWATCHES = [
  { name: 'ink', hex: '#0E1826', use: 'headings, primary', className: 'bg-ink' },
  { name: 'paper', hex: '#F6F3EC', use: 'background', className: 'bg-paper' },
  { name: 'gold', hex: '#C89B3C', use: 'accent', className: 'bg-gold' },
  { name: 'slate', hex: '#5B6472', use: 'muted text', className: 'bg-slate' },
  { name: 'line', hex: '#2E4057', use: 'borders', className: 'bg-line' },
]

export default function StyleGuidePage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <div className="text-center">
        <p className="label-mono">Internal</p>
        <h1 className="mt-3 text-4xl">Style guide</h1>
        <p className="mx-auto mt-3 max-w-prose text-slate">
          Brand tokens and type specimens for Trajectory Coaching. Own your trajectory.
        </p>
      </div>

      <section className="mt-14">
        <h2 className="text-2xl">Color</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {SWATCHES.map((s) => (
            <div key={s.name} className="flex items-center gap-4 rounded-lg border border-line/20 p-3">
              <div className={`${s.className} size-14 shrink-0 rounded-md border border-line/20`} />
              <div>
                <p className="font-mono text-sm">
                  --{s.name} <span className="text-slate">{s.hex}</span>
                </p>
                <p className="text-sm text-slate">{s.use}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-2xl">Type</h2>
        <div className="mt-6 space-y-6">
          <div>
            <p className="label-mono">Fraunces / headings &amp; logo</p>
            <p className="mt-2 font-display text-3xl">Own your trajectory.</p>
          </div>
          <div>
            <p className="label-mono">Inter / body</p>
            <p className="mt-2 max-w-prose">
              Coaching from people who already have the job you want. Book a session, get a
              straight answer, and move.
            </p>
          </div>
          <div>
            <p className="label-mono">IBM Plex Mono / labels &amp; tags</p>
            <p className="mt-2 font-mono text-sm">INVESTMENT BANKING · 30 MIN · $75</p>
          </div>
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-2xl">Components</h2>
        <p className="mt-2 max-w-prose text-sm text-slate">
          None of these carry brand classes. They inherit the palette because the shadcn
          semantic tokens are aliases of the brand tokens.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button>Book a session</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
        </div>

        <Card className="mt-8 max-w-sm">
          <CardHeader>
            <CardTitle>Coach card</CardTitle>
            <CardDescription>Separated by a rule, not a shadow.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="demo-email">Email</Label>
            <Input id="demo-email" type="email" placeholder="you@school.edu" />
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
