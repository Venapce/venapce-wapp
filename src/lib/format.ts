// Small display helpers shared by the Nodes / Issues / Stage tables.

/** "just now", "6m ago", "3h ago", "2d ago" from an ISO timestamp. */
export function relativeTime(iso?: string): string {
  if (!iso) return '—'
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return '—'
  const s = Math.round((Date.now() - t) / 1000)
  if (s < 45) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  return `${d}d ago`
}

/** A node is "online" if osctrl saw it within the last 5 minutes. */
export function isOnline(lastSeen?: string): boolean {
  if (!lastSeen) return false
  return Date.now() - new Date(lastSeen).getTime() < 5 * 60_000
}

/** Byte counts as osctrl serves them (a string for node memory, a number for
 *  bytes received) rendered as a human size — "46.5 GB" rather than a raw
 *  49904668672. Non-numeric values are passed through untouched, since older
 *  osquery builds report memory as free text. */
export function formatBytes(v?: string | number): string {
  if (v == null || v === '') return '—'
  const n = typeof v === 'number' ? v : Number(String(v).trim())
  if (!Number.isFinite(n)) return String(v)
  if (n < 1024) return `${n} B`
  const units = ['KB', 'MB', 'GB', 'TB', 'PB']
  let val = n / 1024
  let i = 0
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024
    i++
  }
  return `${val < 10 ? val.toFixed(1) : Math.round(val)} ${units[i]}`
}
