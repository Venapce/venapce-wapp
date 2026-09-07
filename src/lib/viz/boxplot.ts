// Box plot → ECharts.
//
// Shares the histogram's query (the raw column, plus an optional group column —
// see builder.ts), and does the statistics here: quartiles by linear
// interpolation, whiskers at 1.5·IQR, and everything past them drawn as an
// outlier point. Superset's own box plot computes the same five numbers in its
// `post_processing` chain; keeping it client-side means the bin/whisker choice
// re-renders without a re-query, exactly like the histogram.

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

/** The five-number summary plus whatever falls outside the whiskers. */
interface Box {
  name: string
  min: number
  q1: number
  median: number
  q3: number
  max: number
  outliers: number[]
  count: number
}

/** Quantile of a sorted array, interpolating between neighbours (R type 7). */
function quantile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0]
  const pos = (sorted.length - 1) * p
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

function summarise(name: string, values: number[]): Box {
  const sorted = [...values].sort((a, b) => a - b)
  const q1 = quantile(sorted, 0.25)
  const median = quantile(sorted, 0.5)
  const q3 = quantile(sorted, 0.75)
  const iqr = q3 - q1
  const lowFence = q1 - 1.5 * iqr
  const highFence = q3 + 1.5 * iqr
  const inside = sorted.filter((v) => v >= lowFence && v <= highFence)
  return {
    name,
    min: inside.length ? inside[0] : sorted[0],
    q1,
    median,
    q3,
    max: inside.length ? inside[inside.length - 1] : sorted[sorted.length - 1],
    outliers: sorted.filter((v) => v < lowFence || v > highFence),
    count: sorted.length,
  }
}

export function boxPlotModel(s: BuilderState, result: ChartDataResult): RenderModel {
  const rows = result.data ?? []
  const o = s.histogram
  if (!rows.length || !o.column) return { kind: 'empty' }

  // Same shape as the histogram: values, kept per group.
  const groups = new Map<string, number[]>()
  let skipped = 0
  for (const r of rows) {
    const v = numOrNull(r[o.column])
    if (v == null) {
      skipped += 1
      continue
    }
    const key = o.groupby ? str(r[o.groupby]) : o.column
    const bucket = groups.get(key)
    if (bucket) bucket.push(v)
    else groups.set(key, [v])
  }
  if (!groups.size) return { kind: 'empty', note: `No numeric values in ${o.column}.` }

  const boxes = [...groups.entries()].map(([name, values]) => summarise(name, values))
  const categories = boxes.map((b) => b.name)
  const format = o.xFormat
  const outliers = boxes.flatMap((b, i) => b.outliers.map((v) => [i, v]))

  return {
    kind: 'echarts',
    note: skipped ? `${skipped} row${skipped > 1 ? 's' : ''} skipped: ${o.column} was not numeric.` : undefined,
    option: {
      color: PALETTE,
      grid: gridFor({
        legend: false,
        legendPosition: 'top',
        xTitle: o.groupby || o.column,
        yTitle: o.yAxisTitle || o.column,
        rotated: o.xAxisLabelRotation !== 0 || categories.length > 6,
      }),
      legend: legendConfig(false, 'top'),
      tooltip: {
        trigger: 'item',
        confine: true,
        formatter: (p: { seriesType: string; dataIndex: number; value: unknown[]; color: string; name: string }) => {
          if (p.seriesType === 'scatter') {
            const v = (p.value as number[])[1]
            return tooltipHeader(categories[(p.value as number[])[0]]) + tooltipRow(p.color, 'outlier', formatNumber(v, format))
          }
          const b = boxes[p.dataIndex]
          if (!b) return ''
          const line = (k: string, v: number) => tooltipRow(p.color, k, formatNumber(v, format))
          return (
            tooltipHeader(`${b.name} · ${b.count} value${b.count > 1 ? 's' : ''}`) +
            line('maximum', b.max) +
            line('Q3', b.q3) +
            line('median', b.median) +
            line('Q1', b.q1) +
            line('minimum', b.min) +
            (b.outliers.length ? line('outliers', b.outliers.length) : '')
          )
        },
      },
      xAxis: {
        type: 'category',
        data: categories,
        axisLabel: { rotate: o.xAxisLabelRotation || (categories.length > 6 ? 30 : 0), hideOverlap: true },
        axisTick: { alignWithLabel: true },
        ...axisName(o.groupby || o.column, 'x'),
      },
      yAxis: {
        type: 'value',
        axisLabel: valueAxisLabel(format),
        splitLine: { show: true },
        scale: true,
        ...axisName(o.yAxisTitle || o.column, 'y'),
      },
      series: [
        {
          name: o.column,
          type: 'boxplot',
          boxWidth: [10, 48],
          itemStyle: { color: PALETTE[0] + '33', borderColor: PALETTE[0], borderWidth: 1.5 },
          emphasis: { itemStyle: { borderWidth: 2.5 } },
          data: boxes.map((b) => [b.min, b.q1, b.median, b.q3, b.max]),
        },
        {
          name: 'outliers',
          type: 'scatter',
          symbolSize: 5,
          itemStyle: { color: PALETTE[4], opacity: 0.7 },
          data: outliers,
        },
      ],
    },
  }
}
