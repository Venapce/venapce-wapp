// Scatter / bubble → ECharts. Superset splits these into two plugins (Scatter
// and Bubble); here it is one chart whose third metric is optional: with a size
// metric you get Superset's bubble chart, without it a plain scatter.

import type { ChartDataResult } from '@/api/types'
import { metricLabel, type BuilderState } from '@/lib/builder'
import { formatNumber } from '@/lib/numberFormat'
import {
  axisBounds,
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

/** One plotted point: [x, y, sizeValue, entity label]. */
type Point = [number, number, number, string]

export function scatterModel(s: BuilderState, result: ChartDataResult): RenderModel {
  const rows = result.data ?? []
  if (!rows.length) return { kind: 'empty' }

  const o = s.scatter
  if (!o.xMetric || !o.yMetric) return { kind: 'empty' }
  const xKey = metricLabel(o.xMetric)
  const yKey = metricLabel(o.yMetric)
  const sizeKey = o.sizeMetric ? metricLabel(o.sizeMetric) : ''

  // Group into one ECharts series per value of the colour column.
  const groups = new Map<string, Point[]>()
  let skipped = 0
  for (const r of rows) {
    const x = numOrNull(r[xKey])
    const y = numOrNull(r[yKey])
    if (x == null || y == null) {
      skipped += 1
      continue
    }
    const size = sizeKey ? numOrNull(r[sizeKey]) ?? 0 : 0
    const entity = o.entity ? str(r[o.entity]) : ''
    const key = o.series ? str(r[o.series]) : 'All'
    const bucket = groups.get(key)
    const point: Point = [x, y, size, entity]
    if (bucket) bucket.push(point)
    else groups.set(key, [point])
  }
  if (!groups.size) return { kind: 'empty' }

  // Bubble radius scales with the square root of the value, so the *area* is
  // proportional to it — the same thing Superset's bubble plugin does.
  const sizes = sizeKey ? [...groups.values()].flat().map((p) => p[2]) : []
  const maxSize = sizes.length ? Math.max(...sizes) : 0
  const minSize = sizes.length ? Math.min(...sizes) : 0
  const symbolSize = (p: unknown): number => {
    if (!sizeKey) return o.minBubbleSize
    const v = Array.isArray(p) ? Number(p[2]) : 0
    if (!Number.isFinite(v) || maxSize <= minSize) return (o.minBubbleSize + o.maxBubbleSize) / 2
    const t = Math.sqrt((v - minSize) / (maxSize - minSize))
    return o.minBubbleSize + t * (o.maxBubbleSize - o.minBubbleSize)
  }

  const names = [...groups.keys()]
  const series: Record<string, unknown>[] = names.map((name, i) => ({
    name,
    type: 'scatter',
    color: PALETTE[i % PALETTE.length],
    data: groups.get(name),
    symbolSize,
    itemStyle: { opacity: o.opacity, borderColor: 'rgba(0,0,0,.25)', borderWidth: 1 },
    emphasis: { focus: 'series', itemStyle: { opacity: 1 } },
    label: o.showLabels
      ? { show: true, position: 'top', fontSize: 10, formatter: (p: { value: Point }) => p.value[3] }
      : { show: false },
  }))

  if (o.trendline) {
    names.forEach((name, i) => {
      const fit = leastSquares(groups.get(name) ?? [])
      if (!fit) return
      series.push({
        name: `${name} · trend`,
        type: 'line',
        color: PALETTE[i % PALETTE.length],
        data: fit,
        symbol: 'none',
        lineStyle: { type: 'dashed', width: 2, opacity: 0.85 },
        tooltip: { show: false },
        silent: true,
        legendHoverLink: false,
      })
    })
  }

  const option: Record<string, unknown> = {
    color: PALETTE,
    grid: gridFor({
      legend: o.legend,
      legendPosition: 'top',
      xTitle: o.xAxisTitle || xKey,
      yTitle: o.yAxisTitle || yKey,
    }),
    legend: { ...legendConfig(o.legend && (names.length > 1 || !!o.series), 'top'), data: names },
    tooltip: {
      trigger: 'item',
      confine: true,
      formatter: (p: unknown) => {
        const q = p as { color: string; seriesName: string; value: Point }
        const [x, y, size, entity] = q.value
        const head = entity || q.seriesName
        let body = tooltipRow(q.color, o.xAxisTitle || xKey, formatNumber(x, o.xFormat))
        body += tooltipRow(q.color, o.yAxisTitle || yKey, formatNumber(y, o.yFormat))
        if (sizeKey) body += tooltipRow(q.color, sizeKey, formatNumber(size))
        if (o.series) body += tooltipRow(q.color, o.series, q.seriesName)
        return tooltipHeader(head) + body
      },
    },
    xAxis: {
      type: o.logX ? 'log' : 'value',
      scale: true,
      axisLabel: valueAxisLabel(o.xFormat),
      splitLine: { show: true },
      ...axisBounds(null, null),
      ...axisName(o.xAxisTitle || xKey, 'x'),
    },
    yAxis: {
      type: o.logY ? 'log' : 'value',
      scale: true,
      axisLabel: valueAxisLabel(o.yFormat),
      splitLine: { show: true },
      ...axisName(o.yAxisTitle || yKey, 'y'),
    },
    series,
  }

  const note = skipped ? `${skipped} row${skipped > 1 ? 's' : ''} skipped: X or Y was not a number.` : undefined
  return { kind: 'echarts', option, note }
}

/** Ordinary least-squares fit, returned as the two endpoints of the line. */
function leastSquares(points: Point[]): Array<[number, number]> | null {
  if (points.length < 2) return null
  const n = points.length
  let sx = 0
  let sy = 0
  let sxy = 0
  let sxx = 0
  for (const [x, y] of points) {
    sx += x
    sy += y
    sxy += x * y
    sxx += x * x
  }
  const denom = n * sxx - sx * sx
  if (denom === 0) return null
  const slope = (n * sxy - sx * sy) / denom
  const intercept = (sy - slope * sx) / n
  const xs = points.map((p) => p[0])
  const lo = Math.min(...xs)
  const hi = Math.max(...xs)
  return [
    [lo, slope * lo + intercept],
    [hi, slope * hi + intercept],
  ]
}
