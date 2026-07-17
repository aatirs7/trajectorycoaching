'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  createTask,
  deleteTask,
  moveTask,
  setTaskStatus,
  toggleThisWeek,
  updateTask,
} from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  OPS_CATEGORIES,
  OPS_OWNERS,
  OPS_STATUSES,
  type OpsCategory,
  type OpsOwner,
  type OpsStatus,
  STATUS_LABEL,
  ownerTone,
} from '@/lib/ops-schema'

export type OpsTaskView = {
  id: string
  title: string
  details: string | null
  category: string
  owner: string
  status: OpsStatus
  thisWeek: boolean
}

type OwnerFilter = 'All' | OpsOwner

export function OpsBoard({ tasks }: { tasks: OpsTaskView[] }) {
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('All')
  const [hideDone, setHideDone] = useState(true)
  const [pending, start] = useTransition()

  // Run a server action (they take FormData) and refresh via revalidatePath.
  const run = (fn: (fd: FormData) => Promise<unknown>, fd: FormData) => start(() => void fn(fd))

  const visible = useMemo(
    () => tasks.filter((t) => ownerFilter === 'All' || t.owner === ownerFilter),
    [tasks, ownerFilter],
  )

  const doneCount = tasks.filter((t) => t.status === 'done').length
  const thisWeek = visible.filter((t) => t.thisWeek && t.status !== 'done')

  return (
    <main className={`flex-1 ${pending ? 'opacity-90' : ''}`}>
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-3xl">Ops board</h1>
          <p className="font-display text-xl text-slate">
            {doneCount} of {tasks.length} done
          </p>
        </div>

        {/* Controls */}
        <div className="mt-6 flex flex-wrap items-center gap-4 border-y border-line/15 py-4">
          <div className="flex items-center gap-1.5">
            {(['All', ...OPS_OWNERS] as OwnerFilter[]).map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setOwnerFilter(o)}
                className={`rounded-full px-3 py-1 text-sm transition-colors ${
                  ownerFilter === o ? 'bg-ink text-paper' : 'text-slate hover:text-ink'
                }`}
              >
                {o}
              </button>
            ))}
          </div>
          <label className="ml-auto flex items-center gap-2 text-sm text-slate">
            <input
              type="checkbox"
              checked={hideDone}
              onChange={(e) => setHideDone(e.target.checked)}
              className="size-4 accent-gold"
            />
            Hide completed
          </label>
        </div>

        <div className="mt-8">
        {/* This week strip */}
        {thisWeek.length > 0 ? (
          <div className="mb-10 rounded-2xl bg-ink p-6 text-paper">
            <p className="font-mono text-xs tracking-widest text-gold uppercase">This week</p>
            <ul className="mt-4 space-y-2">
              {thisWeek.map((t) => (
                <li key={t.id} className="flex items-center gap-3 text-sm">
                  <span aria-hidden className="text-gold">
                    ★
                  </span>
                  <span className="flex-1">{t.title}</span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] tracking-wide uppercase ${ownerTone(
                      t.owner,
                    )}`}
                  >
                    {t.owner}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {OPS_CATEGORIES.map((category) => {
          const rows = visible.filter((t) => t.category === category)
          const shown = hideDone ? rows.filter((t) => t.status !== 'done') : rows
          const hiddenDone = rows.length - shown.length
          const done = rows.filter((t) => t.status === 'done').length

          return (
            <section key={category} className="mb-12">
              <div className="flex items-baseline justify-between border-b border-line/15 pb-2">
                <h2 className="font-display text-2xl">{category}</h2>
                <span className="font-mono text-xs tracking-wide text-slate">
                  {done}/{rows.length}
                </span>
              </div>

              <ul className="mt-4 space-y-2">
                {shown.map((t, i) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    isFirst={i === 0}
                    isLast={i === shown.length - 1}
                    run={run}
                    pending={pending}
                  />
                ))}
              </ul>

              {hideDone && hiddenDone > 0 ? (
                <p className="mt-3 text-xs text-slate">
                  {hiddenDone} done, hidden. Untick “Hide completed” to show.
                </p>
              ) : null}

              <AddTask category={category} run={run} pending={pending} />
            </section>
          )
        })}
        </div>
      </div>
    </main>
  )
}

function TaskRow({
  task,
  isFirst,
  isLast,
  run,
  pending,
}: {
  task: OpsTaskView
  isFirst: boolean
  isLast: boolean
  run: (fn: (fd: FormData) => Promise<unknown>, fd: FormData) => void
  pending: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const done = task.status === 'done'

  function fd(extra: Record<string, string>) {
    const f = new FormData()
    f.set('id', task.id)
    for (const [k, v] of Object.entries(extra)) f.set(k, v)
    return f
  }

  if (editing) {
    return (
      <li className="rounded-lg border border-line/25 bg-raised p-4">
        <form
          action={(f) => {
            run(updateTask, f)
            setEditing(false)
          }}
          className="space-y-3"
        >
          <input type="hidden" name="id" value={task.id} />
          <Input name="title" defaultValue={task.title} required aria-label="Title" />
          <Textarea
            name="details"
            defaultValue={task.details ?? ''}
            rows={2}
            placeholder="Details (optional)"
            aria-label="Details"
          />
          <div className="flex items-center gap-2">
            <select
              name="owner"
              defaultValue={task.owner}
              aria-label="Owner"
              className="rounded-md border border-line/25 bg-raised px-2 py-1.5 text-sm"
            >
              {OPS_OWNERS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            <Button type="submit" size="sm" disabled={pending}>
              Save
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </li>
    )
  }

  return (
    <li className="rounded-lg border border-line/15 bg-raised">
      <div className="flex items-start gap-3 p-3">
        <button
          type="button"
          onClick={() => run(setTaskStatus, fd({ status: done ? 'todo' : 'done' }))}
          aria-label={done ? 'Mark not done' : 'Mark done'}
          className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
            done ? 'border-gold bg-gold text-ink' : 'border-line/40 text-transparent hover:border-gold'
          }`}
        >
          ✓
        </button>

        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className={`block text-left text-sm ${done ? 'text-slate line-through' : 'text-ink'}`}
          >
            {task.title}
          </button>

          {expanded && task.details ? (
            <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-line text-slate">
              {task.details}
            </p>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 font-mono text-[10px] tracking-wide uppercase ${ownerTone(
                task.owner,
              )}`}
            >
              {task.owner}
            </span>

            <select
              value={task.status}
              onChange={(e) => run(setTaskStatus, fd({ status: e.target.value }))}
              aria-label="Status"
              className="rounded-md border border-line/20 bg-transparent px-1.5 py-0.5 text-xs text-slate"
            >
              {OPS_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => run(toggleThisWeek, fd({}))}
              aria-label={task.thisWeek ? 'Unstar' : 'Star for this week'}
              className={`text-sm ${task.thisWeek ? 'text-gold' : 'text-line/40 hover:text-gold'}`}
            >
              ★
            </button>

            <span className="ml-auto flex items-center gap-1 text-xs text-slate">
              {!isFirst ? (
                <button type="button" onClick={() => run(moveTask, fd({ dir: 'up' }))} aria-label="Move up" className="hover:text-ink">
                  ↑
                </button>
              ) : null}
              {!isLast ? (
                <button type="button" onClick={() => run(moveTask, fd({ dir: 'down' }))} aria-label="Move down" className="hover:text-ink">
                  ↓
                </button>
              ) : null}
              <button type="button" onClick={() => setEditing(true)} className="hover:text-ink">
                Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm('Delete this task?')) run(deleteTask, fd({}))
                }}
                className="hover:text-destructive"
              >
                Delete
              </button>
            </span>
          </div>
        </div>
      </div>
    </li>
  )
}

function AddTask({
  category,
  run,
  pending,
}: {
  category: OpsCategory
  run: (fn: (fd: FormData) => Promise<unknown>, fd: FormData) => void
  pending: boolean
}) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 text-sm text-slate underline decoration-gold underline-offset-4 hover:text-ink"
      >
        + Add a task
      </button>
    )
  }

  return (
    <form
      action={(f) => {
        run(createTask, f)
        setOpen(false)
      }}
      className="mt-3 space-y-2 rounded-lg border border-line/25 bg-raised p-3"
    >
      <input type="hidden" name="category" value={category} />
      <Input name="title" placeholder="Task title" required aria-label="New task title" />
      <Textarea name="details" rows={2} placeholder="Details (optional)" aria-label="Details" />
      <div className="flex items-center gap-2">
        <select
          name="owner"
          defaultValue="Unassigned"
          aria-label="Owner"
          className="rounded-md border border-line/25 bg-raised px-2 py-1.5 text-sm"
        >
          {OPS_OWNERS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" disabled={pending}>
          Add
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
