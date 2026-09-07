// Histogram → ECharts.
//
// The query returns the raw column (see builder.ts for why the binning is done
// here rather than through Superset's `histogram` post-processing operator), so
// this module owns the whole statistic: shared bin edges across every group,
// optional normalisation to a share, and an optional cumulative curve.

import type { ChartDataResult } from '@/api/types'
import type { BuilderState } from '@/lib/builder'
import { formatNumber } from '@/lib/numberFormat'
import {
  axisName,
  gridFor,
  legendConfig,
  numOrNull,
  PALETTE,
  str,
  tooltipHeader,
  tooltipRow,
  valueAxisLabel,
  type RenderModel,
} from './common'

export function histogramModel(s: BuilderState, result: ChartDataResult): RenderModel {
  const rows = result.data ?? []
  if (!rows.length) return { kind: 'empty' }

  const o = s.histogram
  if (!o.column) return { kind: 'empty' }

  // 1. Pull the numeric values out, keeping the group each belongs to.
  const values: number[] = []
  const groups = new Map<string, number[]>()
  let skipped = 0
  for (const r of rows) {
    const v = numOrNull(r[o.column])
    if (v == null) {
      skipped += 1
      continue
    }
    values.push(v)
    const key = o.groupby ? str(r[o.groupby]) : 'All'
    const bucket = groups.get(key)
    if (bucket) bucket.push(v)
    else groups.set(key, [v])
  }
  if (!values.length) return { kind: 'empty' }

  // 2. One set of edges for every group, so the bars line up.
  const binCount = Math.max(1, Math.min(200, Math.round(o.bins) || 20))
  let lo = Math.min(...values)
  let hi = Math.max(...values)
  if (lo === hi) {
    lo -= 0.5
    hi += 0.5
  }
  const width = (hi - lo) / binCount
  const edges = Array.from({ length: binCount + 1 }, (_, i) => lo + i * width)
  const labels = Array.from({ length: binCount }, (_, i) => `${fmtEdge(edges[i], o.xFormat)} – ${fmtEdge(edges[i + 1], o.xFormat)}`)

  const indexOf = (v: number): number => {
    const i = Math.floor((v - lo) / width)
    return Math.min(binCount - 1, Math.max(0, i)) // the top edge is inclusive
  }

  // 3. Count → normalise → accumulate, per group.
  const names = [...groups.keys()]
  const seriesData = names.map((name) => {
    const counts = new Array<number>(binCount).fill(0)
    for (const v of groups.get(name) ?? []) counts[indexOf(v)] += 1
    const total = counts.reduce((a, b) => a + b, 0) || 1
    let out = o.normalize ? counts.map((c) => c / total) : counts
    if (o.cumulative) {
      let running = 0
      out = out.map((c) => (running += c))
    }
    return { name, data: out }
  })

  const valueFormat = o.normalize ? '.1%' : ',d'
  const overlay = o.mode === 'overlay' && names.length > 1
  const series = seriesData.map((se, i) => ({
    name: se.name,
    type: 'bar',
    data: se.data,
    color: PALETTE[i % PALETTE.length],
    stack: o.mode === 'stacked' ? 'total' : undefined,
    barGap: overlay ? '-100%' : undefined,
    barCategoryGap: '12%',
    itemStyle: { opacity: overlay ? 0.55 : 1, borderRadius: [2, 2, 0, 0] },
    emphasis: { focus: 'series' },
    label: o.showValues
      ? { show: true, position: 'top', fontSize: 10, formatter: (p: { value: unknown }) => formatNumber(p.value, valueFormat) }
      : { show: false },
  }))

  const option: Record<string, unknown> = {
    color: PALETTE,
    grid: gridFor({
      legend: o.legend && names.length > 1,
      legendPosition: 'top',
      xTitle: o.column,
      yTitle: o.yAxisTitle,
      rotated: o.xAxisLabelRotation !== 0,
    }),
    legend: { ...legendConfig(o.legend && names.length > 1, 'top'), data: names },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      confine: true,
      formatter: (params: unknown) => {
        const list = (Array.isArray(params) ? params : [params]) as Array<{
          color: string
          seriesName: string
          value: unknown
          axisValue: string
        }>
        if (!list.length) return ''
        return (
          tooltipHeader(list[0].axisValue) +
          list.map((p) => tooltipRow(p.color, p.seriesName, formatNumber(p.value, valueFormat))).join('')
        )
      },
    },
    xAxis: {
      type: 'category',
      data: labels,
      axisLabel: { rotate: o.xAxisLabelRotation, hideOverlap: true, interval: 'auto' },
      axisTick: { alignWithLabel: true },
      ...axisName(o.column, 'x'),
    },
    yAxis: {
      type: 'value',
      axisLabel: valueAxisLabel(valueFormat),
      splitLine: { show: true },
      ...axisName(o.yAxisTitle || defaultYTitle(o.normalize, o.cumulative), 'y'),
    },
    series,
  }

  const note = skipped
    ? `${skipped} row${skipped > 1 ? 's' : ''} skipped: ${o.column} was not numeric.`
    : undefined
  return { kind: 'echarts', option, note }
}

function defaultYTitle(normalize: boolean, cumulative: boolean): string {
  const base = normalize ? 'Share' : 'Count'
  return cumulative ? `Cumulative ${base.toLowerCase()}` : base
}

function fmtEdge(v: number, format: string): string {
  return formatNumber(v, format || (Number.isInteger(v) ? ',d' : ''))
}
