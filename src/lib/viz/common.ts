// Shared pieces of the row → ECharts `option` transforms.
//
// Superset does this per plugin in `transformProps.ts`; the equivalents live in
// this folder, one module per chart family, all returning a `RenderModel`.

import { COLTYPE_TEMPORAL, type ChartDataResult } from '@/api/types'
import { formatNumber, formatTemporal, toDate } from '@/lib/numberFormat'
import type { LegendPosition } from '@/lib/builder'

/** A small, colourblind-safe categorical palette (Venapce-tinted). */
export const PALETTE = [
  '#06b6d4',
  '#6366f1',
  '#f59e0b',
  '#10b981',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#84cc16',
  '#f97316',
  '#0ea5e9',
  '#a855f7',
]

export interface RenderModel {
  /** 'echarts' → feed `option` to <v-chart>; the others are rendered by the component directly. */
  kind: 'echarts' | 'table' | 'big_number' | 'wordcloud' | 'empty'
  option?: Record<string, unknown>
  table?: { colnames: string[]; rows: Array<Record<string, unknown>> }
  /** A headline figure, optionally with a sparkline option behind it. */
  big?: { value: unknown; label: string; format?: string; spark?: Record<string, unknown> }
  /** Word cloud terms, pre-sized (no ECharts extension needed to draw them). */
  words?: Array<{ text: string; value: number; size: number; color: string; title: string }>
  /** Non-fatal note shown under the chart (e.g. "3 rows skipped: no parent"). */
  note?: string
}

export const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return Number.isFinite(n) ? n : 0
}

/** Like `num`, but keeps "not a number" distinguishable from a real zero. */
export const numOrNull = (v: unknown): number | null => {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return Number.isFinite(n) ? n : null
}

export const str = (v: unknown): string => (v == null || v === '' ? '∅' : String(v))

/** Is this result column temporal, per Superset's `coltypes`? */
export function isTemporal(result: ChartDataResult, colname: string): boolean {
  const i = result.colnames?.indexOf(colname) ?? -1
  if (i < 0 || !result.coltypes) return false
  return result.coltypes[i] === COLTYPE_TEMPORAL
}

/** Every returned column except the ones the chart consumed for its axes. */
export function seriesColumns(result: ChartDataResult, exclude: string[]): string[] {
  const rows = result.data ?? []
  const cols = result.colnames?.length ? result.colnames : Object.keys(rows[0] ?? {})
  return cols.filter((c) => !exclude.includes(c))
}

// ---- layout ---------------------------------------------------------------

export function legendConfig(show: boolean, position: LegendPosition): Record<string, unknown> {
  if (!show) return { show: false }
  const base = { show: true, type: 'scroll', icon: 'roundRect', itemWidth: 12, itemHeight: 8 }
  switch (position) {
    case 'bottom':
      return { ...base, bottom: 0, left: 'center' }
    case 'left':
      return { ...base, left: 0, top: 'middle', orient: 'vertical' }
    case 'right':
      return { ...base, right: 0, top: 'middle', orient: 'vertical' }
    default:
      return { ...base, top: 0, left: 'center' }
  }
}

/** Grid insets that leave room for the legend, axis titles and a zoom slider. */
export function gridFor(opts: {
  legend: boolean
  legendPosition: LegendPosition
  xTitle?: string
  yTitle?: string
  dataZoom?: boolean
  rotated?: boolean
}): Record<string, unknown> {
  const { legend, legendPosition } = opts
  return {
    containLabel: true,
    left: legend && legendPosition === 'left' ? 110 : opts.yTitle ? 56 : 20,
    right: legend && legendPosition === 'right' ? 120 : 24,
    top: legend && legendPosition === 'top' ? 34 : 20,
    bottom:
      (legend && legendPosition === 'bottom' ? 34 : 8) +
      (opts.dataZoom ? 42 : 0) +
      (opts.xTitle ? 22 : 0) +
      (opts.rotated ? 18 : 0),
  }
}

/** Axis-title config in the style Superset renders (offset, muted, centred). */
export function axisName(title: string, axis: 'x' | 'y'): Record<string, unknown> {
  if (!title) return {}
  return axis === 'x'
    ? { name: title, nameLocation: 'middle', nameGap: 32 }
    : { name: title, nameLocation: 'middle', nameGap: 52, nameRotate: 90 }
}

export const valueAxisLabel = (format: string) => ({ formatter: (v: unknown) => formatNumber(v, format) })

/** Bounds applied to a value axis; `null` lets ECharts pick. */
export function axisBounds(min: number | null, max: number | null): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (min != null && Number.isFinite(min)) out.min = min
  if (max != null && Number.isFinite(max)) out.max = max
  return out
}

// ---- tooltips -------------------------------------------------------------

const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)

export const marker = (color: string) =>
  `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:6px"></span>`

export function tooltipRow(color: string, name: string, value: string): string {
  return `<div style="display:flex;gap:12px;align-items:center;justify-content:space-between">
    <span>${marker(color)}${escapeHtml(name)}</span><b>${escapeHtml(value)}</b></div>`
}

export function tooltipHeader(text: string): string {
  return `<div style="margin-bottom:4px;font-weight:600">${escapeHtml(text)}</div>`
}

/** Axis-trigger tooltip listing every series at the hovered x. */
export function axisTooltip(opts: { temporal: boolean; grain?: string; format: string; rich: boolean }) {
  return {
    trigger: opts.rich ? 'axis' : 'item',
    axisPointer: { type: 'cross', label: { show: false } },
    confine: true,
    formatter: (params: unknown) => {
      const list = Array.isArray(params) ? params : [params]
      if (!list.length) return ''
      const first = list[0] as { axisValue?: unknown; value?: unknown }
      const head = opts.temporal
        ? formatTemporal(axisValueOf(first), opts.grain)
        : str(first.axisValue ?? '')
      const body = list
        .map((p) => {
          const q = p as { color: string; seriesName: string; value: unknown }
          const v = Array.isArray(q.value) ? q.value[1] : q.value
          return tooltipRow(q.color, q.seriesName, formatNumber(v, opts.format))
        })
        .join('')
      return tooltipHeader(head) + body
    },
  }
}

function axisValueOf(p: { axisValue?: unknown; value?: unknown }): unknown {
  if (p.axisValue != null) return p.axisValue
  return Array.isArray(p.value) ? p.value[0] : p.value
}

/** Sort a set of named number arrays the way Superset's "Sort series" control does. */
export function sortSeries<T extends { name: string; values: Array<number | null> }>(
  series: T[],
  by: 'name' | 'sum' | 'avg' | 'min' | 'max',
  desc: boolean,
): T[] {
  const score = (s: T): number => {
    const vs = s.values.filter((v): v is number => v != null)
    if (!vs.length) return 0
    switch (by) {
      case 'sum':
        return vs.reduce((a, b) => a + b, 0)
      case 'avg':
        return vs.reduce((a, b) => a + b, 0) / vs.length
      case 'min':
        return Math.min(...vs)
      case 'max':
        return Math.max(...vs)
      default:
        return 0
    }
  }
  const sorted = [...series]
  if (by === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name))
  else sorted.sort((a, b) => score(a) - score(b))
  return desc ? sorted.reverse() : sorted
}

/** Epoch-ms for a temporal cell, or `null` when it isn't a date. */
export function timeValue(v: unknown): number | null {
  const d = toDate(v)
  return d ? d.getTime() : null
}
