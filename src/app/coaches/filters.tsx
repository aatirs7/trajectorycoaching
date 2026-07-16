'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SESSION_LENGTHS } from '@/lib/coach-schema'

/**
 * Spec §8 — browse filters: industry/field, price, session length.
 *
 * Filter state lives in the URL, not React state: it survives a refresh, is shareable,
 * and lets the server component do the filtering against the database rather than
 * shipping every coach to the client and filtering there.
 */
const ANY = '__any'

export function BrowseFilters({ industries }: { industries: string[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  function apply(key: string, value: string | null) {
    const next = new URLSearchParams(searchParams.toString())

    if (!value || value === ANY) next.delete(key)
    else next.set(key, value)

    startTransition(() => {
      router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false })
    })
  }

  const hasFilters = ['industry', 'maxPrice', 'length'].some((k) => searchParams.get(k))

  return (
    <div className="mt-8 flex flex-wrap items-end justify-center gap-4 border-y border-line/15 py-5">
      <div>
        <Label htmlFor="f-industry" className="label-mono block text-center">
          Field
        </Label>
        <Select
          value={searchParams.get('industry') ?? ANY}
          onValueChange={(v) => apply('industry', v)}
        >
          <SelectTrigger id="f-industry" className="mt-2 w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any field</SelectItem>
            {industries.map((i) => (
              <SelectItem key={i} value={i}>
                {i}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="f-length" className="label-mono block text-center">
          Length
        </Label>
        <Select value={searchParams.get('length') ?? ANY} onValueChange={(v) => apply('length', v)}>
          <SelectTrigger id="f-length" className="mt-2 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any length</SelectItem>
            {SESSION_LENGTHS.map((l) => (
              <SelectItem key={l} value={String(l)}>
                {l} minutes
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="f-price" className="label-mono block text-center">
          Max price
        </Label>
        <div className="mt-2 flex items-center gap-1.5">
          <span className="text-slate">$</span>
          <Input
            id="f-price"
            inputMode="decimal"
            defaultValue={searchParams.get('maxPrice') ?? ''}
            placeholder="Any"
            className="w-28"
            // Commit on blur/Enter rather than per keystroke — a query per character
            // would hammer the database for no benefit.
            onBlur={(e) => apply('maxPrice', e.target.value.trim() || null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                apply('maxPrice', e.currentTarget.value.trim() || null)
              }
            }}
          />
        </div>
      </div>

      {hasFilters ? (
        <Button
          variant="ghost"
          onClick={() => startTransition(() => router.replace(pathname, { scroll: false }))}
          disabled={pending}
        >
          Clear
        </Button>
      ) : null}
    </div>
  )
}
