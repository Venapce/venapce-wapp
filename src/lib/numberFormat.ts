// Axis / label number formatting.
//
// Superset leans on d3-format strings ('.1%', '$,.2f', 'SI'). Rather than pull
// d3-format in for a handful of cases, the builder offers a fixed menu of the
// formats that actually get used, and this module implements them. The keys are
// the d3 strings Superset uses, so a saved chart stays readable if we ever swap
// the implementation for d3-format itself.

export interface NumberFormatOption {
  value: string
  label: string
}

export const NUMBER_FORMATS: NumberFormatOption[] = [
  { value: '', label: 'Adaptive (smart)' },
  { value: ',d', label: 'Integer · 1,234' },
  { value: ',.1f', label: 'Decimal · 1,234.5' },
  { value: ',.2f', label: 'Decimal · 1,234.56' },
  { value: 'SI', label: 'SI suffix · 1.2k' },
  { value: '.1%', label: 'Percent · 12.3%' },
  { value: '.2%', label: 'Percent · 12.34%' },
  { value: '$,.2f', label: 'Currency · $1,234.56' },
  { value: '.3~s', label: 'Bytes-ish · 1.23M' },
]

const SI_UNITS = [
  { limit: 1e12, suffix: 'T' },
  { limit: 1e9, suffix: 'G' },
  { limit: 1e6, suffix: 'M' },
  { limit: 1e3, suffix: 'k' },
]

function si(n: number, digits: number): string {
  const abs = Math.abs(n)
  for (const u of SI_UNITS) {
    if (abs >= u.limit) return `${trimZeros((n / u.limit).toFixed(digits))}${u.suffix}`
  }
  return trimZeros(n.toFixed(abs < 1 && abs > 0 ? digits : 0))
}

function trimZeros(s: string): string {
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s
}

const grouped = (n: number, digits: number): string =>
  n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })

/**
 * "Adaptive": the shape Superset's SMART_NUMBER uses — compact for large
 * magnitudes, a couple of significant decimals for small ones, and no trailing
 * noise in between.
 */
export function smartNumber(n: number): string {
  if (!Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  if (abs === 0) return '0'
  if (abs >= 1e3) return si(n, 2)
  if (abs >= 1) return trimZeros(n.toFixed(2))
  if (abs >= 0.001) return trimZeros(n.toFixed(4))
  return n.toExponential(2)
}

/** Format `value` with one of NUMBER_FORMATS' keys. Unknown keys fall back to adaptive. */
export function formatNumber(value: unknown, format = ''): string {
  const n = typeof value === 'number' ? value : parseFloat(String(value))
  if (!Number.isFinite(n)) return value == null ? '—' : String(value)
  switch (format) {
    case ',d':
      return Math.round(n).toLocaleString()
    case ',.1f':
      return grouped(n, 1)
    case ',.2f':
      return grouped(n, 2)
    case 'SI':
      return si(n, 1)
    case '.3~s':
      return si(n, 2)
    case '.1%':
      return `${grouped(n * 100, 1)}%`
    case '.2%':
      return `${grouped(n * 100, 2)}%`
    case '$,.2f':
      return `$${grouped(n, 2)}`
    default:
      return smartNumber(n)
  }
}

/** A formatter closure — handy for ECharts `axisLabel.formatter` / tooltips. */
export const numberFormatter = (format = '') => (value: unknown) => formatNumber(value, format)

/** Epoch-ms (Superset's temporal wire format) or ISO string → a compact axis label. */
export function formatTemporal(value: unknown, grain = ''): string {
  const d = toDate(value)
  if (!d) return String(value ?? '—')
  const sub = /^PT/.test(grain)
  const opts: Intl.DateTimeFormatOptions = sub
    ? { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
    : grain === 'P1Y'
      ? { year: 'numeric' }
      : grain === 'P1M' || grain === 'P3M'
        ? { year: 'numeric', month: 'short' }
        : { year: 'numeric', month: 'short', day: 'numeric' }
  return d.toLocaleString(undefined, opts)
}

export function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value
  if (typeof value === 'number') return new Date(value)
  if (typeof value === 'string') {
    const n = Number(value)
    const d = Number.isFinite(n) && value.trim() !== '' ? new Date(n) : new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}
