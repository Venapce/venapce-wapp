// Shared vocabulary of the Stage → Findings → Issues tables: the value sets a
// row's lifecycle fields take, the badge colour each maps to, and the field
// specs the detail pages use to render + edit a row. Kept in one place so the
// three list views and three detail pages agree on what a "high" or a
// "promoted" looks like.
import type { IssueSeverity } from '@/api/types'

export const SEVERITIES: IssueSeverity[] = ['critical', 'high', 'medium', 'low', 'info']

export const SEVERITY_CLASS: Record<string, string> = {
  critical: 'bg-danger-soft text-danger',
  high: 'bg-danger-soft text-danger',
  medium: 'bg-warning-soft text-warning',
  low: 'bg-surface-2 text-fg-muted',
  info: 'bg-accent-soft text-accent',
}

export const DISPOSITIONS = ['pending', 'promoted', 'held', 'dropped']

export const DISPOSITION_CLASS: Record<string, string> = {
  pending: 'bg-warning-soft text-warning',
  promoted: 'bg-success-soft text-success',
  held: 'bg-accent-soft text-accent',
  dropped: 'bg-surface-2 text-fg-subtle',
}

// Findings lifecycle: from "a process said so" to "a person agreed" (or not).
export const FINDING_STATUSES = ['new', 'triaged', 'confirmed', 'false_positive', 'promoted', 'dismissed']

export const FINDING_STATUS_CLASS: Record<string, string> = {
  new: 'bg-warning-soft text-warning',
  triaged: 'bg-accent-soft text-accent',
  confirmed: 'bg-danger-soft text-danger',
  false_positive: 'bg-surface-2 text-fg-subtle',
  promoted: 'bg-success-soft text-success',
  dismissed: 'bg-surface-2 text-fg-subtle',
}

// Issue status is free text (FloMorphic drives it); these are the suggestions
// offered in the editor and the colours for the common ones.
export const ISSUE_STATUSES = ['open', 'proceed', 'in_progress', 'blocked', 'resolved', 'closed']

export const ISSUE_STATUS_CLASS: Record<string, string> = {
  open: 'bg-warning-soft text-warning',
  proceed: 'bg-accent-soft text-accent',
  in_progress: 'bg-accent-soft text-accent',
  blocked: 'bg-danger-soft text-danger',
  resolved: 'bg-success-soft text-success',
  closed: 'bg-surface-2 text-fg-subtle',
}

export const CONFIDENCES = ['low', 'medium', 'high']

export const CATEGORIES = ['anomaly', 'vulnerability', 'misconfiguration', 'malware', 'policy', 'exposure', 'integrity', 'identity']

// Each lifecycle value has its own glyph, so a "critical" or a "promoted" reads
// at a glance even before the colour does (and the colours repeat: critical
// and high share red, which the icon then tells apart).
export const SEVERITY_ICON: Record<string, string> = {
  critical: 'alertOctagon',
  high: 'alert',
  medium: 'alertCircle',
  low: 'arrowDownCircle',
  info: 'info',
}

export const DISPOSITION_ICON: Record<string, string> = {
  pending: 'clock',
  promoted: 'arrowUpRight',
  held: 'pause',
  dropped: 'trash',
}

export const FINDING_STATUS_ICON: Record<string, string> = {
  new: 'sparkle',
  triaged: 'eye',
  confirmed: 'checkCircle',
  false_positive: 'xCircle',
  promoted: 'arrowUpRight',
  dismissed: 'minusCircle',
}

export const ISSUE_STATUS_ICON: Record<string, string> = {
  open: 'circleDot',
  proceed: 'play',
  in_progress: 'loader',
  blocked: 'ban',
  resolved: 'checkCircle',
  closed: 'archive',
}

/** One lookup for <Badge kind=…>: the colour map + icon map of each lifecycle field. */
export const BADGE_KINDS = {
  severity: { classes: SEVERITY_CLASS, icons: SEVERITY_ICON, fallbackIcon: 'info' },
  disposition: { classes: DISPOSITION_CLASS, icons: DISPOSITION_ICON, fallbackIcon: 'inbox' },
  'finding-status': { classes: FINDING_STATUS_CLASS, icons: FINDING_STATUS_ICON, fallbackIcon: 'circleDot' },
  'issue-status': { classes: ISSUE_STATUS_CLASS, icons: ISSUE_STATUS_ICON, fallbackIcon: 'circleDot' },
} as const

export type BadgeKind = keyof typeof BADGE_KINDS

/** Badge class for a lifecycle value, with a neutral fallback for unknown values. */
export function badgeClass(map: Record<string, string>, value?: string): string {
  return (value && map[value]) || 'bg-surface-2 text-fg-muted'
}

/** "false_positive" → "false positive" for display. */
export function humanize(v?: string): string {
  return (v ?? '').replace(/_/g, ' ')
}

// ---- field specs for the detail editors ----

export type FieldKind = 'text' | 'textarea' | 'select' | 'suggest' | 'tags' | 'json' | 'number'

export interface FieldSpec {
  key: string
  label: string
  kind: FieldKind
  /** Options for select / suggestions for suggest. */
  options?: string[]
  /** Hint under the input. */
  hint?: string
  /** Render in monospace (identifiers, sources). */
  mono?: boolean
}

// The free-form documents every pipeline row carries, in the order the pages
// show them. `data` first — it's what the row IS; `meta` and `ref` explain it.
export const JSON_DOCS: { key: 'data' | 'meta' | 'ref'; label: string; hint: string }[] = [
  { key: 'data', label: 'Data', hint: 'The payload / evidence itself — whatever the producer delivered.' },
  { key: 'meta', label: 'Meta', hint: 'Enrichment and context attached by later processes.' },
  { key: 'ref', label: 'Reference', hint: 'Provenance: where this row came from and how it was made.' },
]

/** True for an absent / empty document ({} , [] , null, ""). */
export function isEmptyDoc(v: unknown): boolean {
  if (v == null || v === '') return true
  if (Array.isArray(v)) return v.length === 0
  if (typeof v === 'object') return Object.keys(v as object).length === 0
  return false
}

/** Short shape summary of a document for table cells: "3 keys", "12 items", "text". */
export function docShape(v: unknown): string {
  if (isEmptyDoc(v)) return ''
  if (Array.isArray(v)) return `${v.length} item${v.length === 1 ? '' : 's'}`
  if (typeof v === 'object') {
    const n = Object.keys(v as object).length
    return `${n} key${n === 1 ? '' : 's'}`
  }
  return typeof v
}

/** Route location for a pipeline row's detail page. */
export function rowRoute(kind: 'stage' | 'finding' | 'issue', id: number | string) {
  const name = kind === 'stage' ? 'stage-detail' : kind === 'finding' ? 'finding-detail' : 'issue-detail'
  return { name, params: { id: String(id) } }
}

/** A typed link is "set" when it is a positive id (the backend uses 0 for none). */
export function hasLink(id?: number | string | null): boolean {
  return id != null && id !== '' && id !== 0 && id !== '0'
}
