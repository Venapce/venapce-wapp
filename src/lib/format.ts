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

const PLATFORM_ICON: Record<string, string> = {
  linux: '🐧',
  windows: '🪟',
  darwin: '',
}

export function platformIcon(platform?: string): string {
  return PLATFORM_ICON[(platform ?? '').toLowerCase()] ?? '💻'
}
