import type { RunErrorItem, RunErrorKind, RunErrors } from '@/api/types'

/**
 * A run's error ledger — what the engine recorded while the flow ran, lifted
 * off the FloMorphic process row and kept on the activity.
 *
 * A node error does not stop a flow: fractal records it and the run carries
 * on. So a run can report `finished` and still have hit a dozen things, and
 * the status alone cannot say so. These helpers are what let every view of a
 * run — the timeline, the table, the detail page — say it instead of reporting
 * a clean completion.
 */

/**
 * The activity's ledger, or null when there is nothing to show.
 *
 * Presence of the field is not the test: the backend stores `{}` for a clean
 * run and for every manual activity. Having a count is.
 */
export function runErrors(a: { errors?: RunErrors } | null | undefined): RunErrors | null {
  const errs = a?.errors
  if (!errs) return null
  const items = Array.isArray(errs.items) ? errs.items : []
  const count = errs.count || items.length
  if (count === 0) return null
  return { pid: errs.pid ?? '', count, items }
}

/** Normalized kind — anything the engine does not name is the flow's own. */
export function errorKind(item: RunErrorItem): RunErrorKind {
  return item.kind === 'system' ? 'system' : 'node'
}

/**
 * How many entries of each kind the ledger carries.
 *
 * Counted over the kept items, not `count`: the cap drops the tail, and a
 * split derived from what is in hand is the only one that adds up to what is
 * on screen.
 */
export function errorKindCounts(items: RunErrorItem[]): Record<RunErrorKind, number> {
  const counts: Record<RunErrorKind, number> = { node: 0, system: 0 }
  for (const item of items) counts[errorKind(item)] += 1
  return counts
}

/** Classes for a kind badge. The two are deliberately different tones: only one
 *  of them is something the flow author can act on. */
export function errorKindClass(kind: RunErrorKind): string {
  return kind === 'system'
    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
    : 'bg-red-500/15 text-red-600 dark:text-red-400'
}

/** One-line summary for a badge's tooltip — "3 errors … · 2 node, 1 system". */
export function errorSummary(errs: RunErrors): string {
  const { node, system } = errorKindCounts(errs.items)
  const parts: string[] = []
  if (node) parts.push(`${node} node`)
  if (system) parts.push(`${system} system`)
  const head = `${errs.count} error${errs.count === 1 ? '' : 's'} recorded during this run`
  return parts.length ? `${head} · ${parts.join(', ')}` : head
}

/** Clock time with seconds — the errors of one run land seconds apart, so a
 *  minute-resolution timestamp cannot order them. */
export function formatErrorTime(ms: number): string {
  if (!ms) return ''
  return new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
