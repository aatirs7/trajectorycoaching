'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Card } from '@/components/ui/card'
import { setRole } from '@/lib/auth/set-role'
import type { Role } from '@/types/globals'

const CHOICES: Array<{ role: Extract<Role, 'student' | 'coach'>; title: string; blurb: string }> = [
  {
    role: 'student',
    title: "I'm a student",
    blurb:
      'Find someone who already has the job you want, and book time with them. We’ll ask a few questions first so we can point you at the right people.',
  },
  {
    role: 'coach',
    title: 'I want to coach',
    blurb:
      'Share what you know, set your own rates and hours, and get paid per session. Profiles are reviewed before they go live.',
  },
]

export function RolePicker() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [chosen, setChosen] = useState<Role | null>(null)

  function choose(role: Extract<Role, 'student' | 'coach'>) {
    setError(null)
    setChosen(role)

    startTransition(async () => {
      const result = await setRole(role)

      if (!result.ok) {
        setError(result.error)
        setChosen(null)
        return
      }

      // Clerk's session token only picks up the new claim on refresh, so a client-side
      // push would still read the old (empty) role and bounce us back here.
      window.location.href = role === 'student' ? '/onboarding/survey' : '/coach/setup'
    })
  }

  return (
    <div className="mt-10">
      <div className="grid gap-4 sm:grid-cols-2">
        {CHOICES.map((c) => (
          <Card
            key={c.role}
            role="button"
            tabIndex={0}
            aria-disabled={pending}
            onClick={() => !pending && choose(c.role)}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && !pending) {
                e.preventDefault()
                choose(c.role)
              }
            }}
            className={`cursor-pointer border-line/25 p-6 transition-colors hover:border-gold focus-visible:border-gold focus-visible:outline-none ${
              chosen === c.role ? 'border-gold' : ''
            } ${pending && chosen !== c.role ? 'opacity-50' : ''}`}
          >
            <h2 className="text-xl">{c.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate">{c.blurb}</p>
            <p className="label-mono mt-5">
              {pending && chosen === c.role ? 'Setting up…' : 'Choose'}
            </p>
          </Card>
        ))}
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}{' '}
          <button type="button" className="underline" onClick={() => router.refresh()}>
            Refresh
          </button>
        </p>
      ) : null}
    </div>
  )
}
