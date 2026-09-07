// The categorical family → ECharts.
//
// One query shape — N metrics over up to three dimensions — feeds every chart
// in here: bars and lines, the part-of-a-whole set (pie, rose, funnel, treemap,
// sunburst), the two-dimension set (heatmap, sankey, graph), the tables, and the
// single-figure set (gauge, big number). Superset splits these across a dozen
// plugins that all call the same `buildQuery`; the split here is by function
// inside one module, so the shared pieces (labels, sorting, formatting) are
// written once.

import type { ChartDataResult } from '@/api/types'
import { metricLabel, type BuilderState, type CatLabelType, type MetricSpec } from '@/lib/builder'
import { formatNumber } from '@/lib/numberFormat'
import {
  axisName,
  gridFor,
  legendConfig,
  num,
  PALETTE,
  str,
  tooltipHeader,
  tooltipRow,
  valueAxisLabel,
  type RenderModel,
} from './common'

/** The rows, the metric labels and the dimensions a categorical chart works on. */
interface CatFrame {
  rows: Array<Record<string, unknown>>
  labels: string[]
  dims: string[]
  format: string
}

function frame(s: BuilderState, result: ChartDataResult): CatFrame {
  const labels = s.metrics.map((m: MetricSpec) => metricLabel(m))
  const rows = [...(result.data ?? [])]
  const primary = labels[0]
  // Superset already orders by the first metric, but flipping the sort control
  // shouldn't cost a round trip, so the ordering is (re)applied here.
  if (s.cat.sortBars && primary) rows.sort((a, b) => num(b[primary]) - num(a[primary]))
  return { rows, labels, dims: s.dimensions, format: s.cat.valueFormat }
}

const fmt = (v: unknown, format: string) => formatNumber(v, format)

/** ECharts label config for the slice-shaped families. */
function sliceLabel(type: CatLabelType, format: string) {
  if (type === 'none') return { show: false }
  const show = { show: true, fontSize: 11 }
  switch (type) {
    case 'name':
      return { ...show, formatter: '{b}' }
    case 'value':
      return { ...show, formatter: (p: { value: unknown }) => fmt(p.value, format) }
    case 'percent':
      return { ...show, formatter: '{d}%' }
    case 'name_value':
      return { ...show, formatter: (p: { name: string; value: unknown }) => `${p.name}\n${fmt(p.value, format)}` }
    default:
      return { ...show, formatter: '{b}\n{d}%' }
  }
}

/** Tooltip for the item-triggered families (pie, funnel, treemap, sunburst…). */
function itemTooltip(format: string, withPercent = true) {
  return {
    trigger: 'item',
    confine: true,
    formatter: (p: { name: string; value: unknown; percent?: number; color?: string }) =>
      tooltipRow(
        p.color ?? PALETTE[0],
        p.name,
        withPercent && p.percent != null ? `${fmt(p.value, format)} (${p.percent}%)` : fmt(p.value, format),
      ),
  }
}

export function categoricalModel(s: BuilderState, result: ChartDataResult): RenderModel {
  const f = frame(s, result)
  if (!f.rows.length) return { kind: 'empty' }

  switch (s.vizType) {
    case 'table':
      return tableModel(result)
    case 'pivot_table_v2':
      return pivotModel(f)
    case 'big_number':
      return bigNumberModel(f, result)
    case 'gauge_chart':
      return gaugeModel(s, f)
    case 'pie':
    case 'rose':
      return pieModel(s, f)
    case 'funnel':
      return funnelModel(s, f)
    case 'radar':
      return radarModel(s, f)
    case 'waterfall':
      return waterfallModel(s, f)
    case 'treemap_v2':
      return treemapModel(s, f)
    case 'sunburst_v2':
      return sunburstModel(s, f)
    case 'heatmap_v2':
      return heatmapModel(s, f)
    case 'sankey_v2':
      return sankeyModel(f)
    case 'graph_chart':
      return graphModel(s, f)
    case 'word_cloud':
      return wordCloudModel(s, f)
    default:
      return barModel(s, f)
  }
}

// ---- bars / lines / areas ---------------------------------------------------

function barModel(s: BuilderState, f: CatFrame): RenderModel {
  const o = s.cat
  const dim = f.dims[0]
  const categories = f.rows.map((r) => str(r[dim]))
  const chartType = s.vizType === 'bar' ? 'bar' : 'line'
  const isArea = s.vizType === 'area'
  const flipped = o.horizontal && chartType === 'bar'

  const series = f.labels.map((label, i) => ({
    name: label,
    type: chartType,
    color: PALETTE[i % PALETTE.length],
    smooth: chartType === 'line',
    stack: o.stacked || isArea ? 'total' : undefined,
    areaStyle: isArea ? { opacity: 0.3 } : undefined,
    barMaxWidth: 48,
    itemStyle: chartType === 'bar' ? { borderRadius: flipped ? [0, 3, 3, 0] : [3, 3, 0, 0] } : undefined,
    emphasis: { focus: 'series' },
    label: o.showValues
      ? {
          show: true,
          position: flipped ? 'right' : 'top',
          fontSize: 10,
          formatter: (p: { value: unknown }) => fmt(p.value, f.format),
        }
      : { show: false },
    data: f.rows.map((r) => num(r[label])),
  }))

  const categoryAxis = {
    type: 'category',
    data: categories,
    axisLabel: {
      rotate: flipped ? 0 : o.xAxisLabelRotation || (categories.length > 8 ? 30 : 0),
      hideOverlap: true,
    },
    axisTick: { alignWithLabel: true },
    ...axisName(o.xAxisTitle, flipped ? 'y' : 'x'),
  }
  const valueAxis = {
    type: 'value',
    axisLabel: valueAxisLabel(f.format),
    splitLine: { show: true },
    ...axisName(o.yAxisTitle, flipped ? 'x' : 'y'),
  }

  return {
    kind: 'echarts',
    option: {
      color: PALETTE,
      grid: gridFor({
        legend: o.legend && f.labels.length > 1,
        legendPosition: o.legendPosition,
        xTitle: flipped ? o.yAxisTitle : o.xAxisTitle,
        yTitle: flipped ? o.xAxisTitle : o.yAxisTitle,
        rotated: !flipped && categories.length > 8,
      }),
      legend: { ...legendConfig(o.legend && f.labels.length > 1, o.legendPosition), data: f.labels },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: chartType === 'bar' ? 'shadow' : 'line' },
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
            list.map((p) => tooltipRow(p.color, p.seriesName, fmt(p.value, f.format))).join('')
          )
        },
      },
      xAxis: flipped ? valueAxis : categoryAxis,
      yAxis: flipped ? categoryAxis : valueAxis,
      series,
    },
  }
}

// ---- part of a whole --------------------------------------------------------

function pieModel(s: BuilderState, f: CatFrame): RenderModel {
  const o = s.cat
  const dim = f.dims[0]
  const label = f.labels[0]
  const data = f.rows.map((r) => ({ name: str(r[dim]), value: num(r[label]) }))
  const rose = s.vizType === 'rose'

  return {
    kind: 'echarts',
    option: {
      color: PALETTE,
      tooltip: itemTooltip(f.format),
      legend: legendConfig(o.legend, o.legendPosition),
      series: [
        {
          type: 'pie',
          radius: rose ? ['18%', '76%'] : o.donut ? ['38%', '68%'] : '70%',
          roseType: rose ? 'area' : undefined,
          center: ['50%', o.legend && o.legendPosition === 'top' ? '56%' : '50%'],
          itemStyle: { borderWidth: 2, borderRadius: rose ? 3 : 4 },
          label: sliceLabel(o.labelType, f.format),
          labelLine: { length: 8, length2: 8 },
          data,
        },
      ],
    },
  }
}

function funnelModel(s: BuilderState, f: CatFrame): RenderModel {
  const o = s.cat
  const dim = f.dims[0]
  const label = f.labels[0]
  // A funnel only reads as one when the stages descend.
  const data = f.rows
    .map((r) => ({ name: str(r[dim]), value: num(r[label]) }))
    .sort((a, b) => b.value - a.value)

  return {
    kind: 'echarts',
    option: {
      color: PALETTE,
      tooltip: itemTooltip(f.format),
      legend: legendConfig(o.legend, o.legendPosition),
      series: [
        {
          type: 'funnel',
          top: o.legend && o.legendPosition === 'top' ? 40 : 16,
          bottom: o.legend && o.legendPosition === 'bottom' ? 40 : 16,
          left: '10%',
          width: '80%',
          minSize: '12%',
          gap: 2,
          sort: 'descending',
          itemStyle: { borderWidth: 1, borderRadius: 2 },
          label: { ...sliceLabel(o.labelType, f.format), position: 'inside' },
          data,
        },
      ],
    },
  }
}

/** A node of the {name, value, children} tree treemap and sunburst both eat. */
interface TreeNode {
  name: string
  value: number
  children?: TreeNode[]
}

/** Roll the flat rows up into the dimension hierarchy, summing the metric. */
function hierarchy(f: CatFrame): TreeNode[] {
  const label = f.labels[0]
  const dims = f.dims.length ? f.dims : []
  const roots: TreeNode[] = []
  const index = new Map<string, TreeNode>()

  for (const row of f.rows) {
    const value = num(row[label])
    const path: string[] = []
    let siblings = roots
    for (const [depth, d] of dims.entries()) {
      const name = str(row[d])
      path.push(name)
      const key = JSON.stringify(path)
      let node = index.get(key)
      if (!node) {
        node = { name, value: 0 }
        index.set(key, node)
        siblings.push(node)
      }
      node.value += value
      if (depth < dims.length - 1) {
        if (!node.children) node.children = []
        siblings = node.children
      }
    }
  }
  return roots
}

function treemapModel(s: BuilderState, f: CatFrame): RenderModel {
  const o = s.cat
  return {
    kind: 'echarts',
    option: {
      color: PALETTE,
      tooltip: itemTooltip(f.format, false),
      series: [
        {
          type: 'treemap',
          roam: false,
          nodeClick: 'zoomToNode',
          breadcrumb: { show: f.dims.length > 1, bottom: 2, emptyItemWidth: 20 },
          leafDepth: Math.max(1, Math.min(f.dims.length, o.hierarchyDepth)),
          label: { show: o.labelType !== 'none', formatter: '{b}', fontSize: 11 },
          upperLabel: { show: f.dims.length > 1, height: 18, fontSize: 10 },
          itemStyle: { borderColor: 'transparent', borderWidth: 1, gapWidth: 2 },
          levels: [
            { itemStyle: { gapWidth: 3, borderWidth: 0 } },
            { colorSaturation: [0.35, 0.6], itemStyle: { gapWidth: 1, borderColorSaturation: 0.6 } },
            { colorSaturation: [0.3, 0.5], itemStyle: { gapWidth: 1, borderColorSaturation: 0.6 } },
          ],
          data: hierarchy(f),
        },
      ],
    },
  }
}

function sunburstModel(s: BuilderState, f: CatFrame): RenderModel {
  const o = s.cat
  return {
    kind: 'echarts',
    option: {
      color: PALETTE,
      tooltip: itemTooltip(f.format, false),
      series: [
        {
          type: 'sunburst',
          radius: ['12%', '92%'],
          emphasis: { focus: 'ancestor' },
          itemStyle: { borderWidth: 1.5 },
          label: { show: o.labelType !== 'none', minAngle: 8, fontSize: 10, rotate: 'radial' },
          data: hierarchy(f),
        },
      ],
    },
  }
}

// ---- ranking / statistical --------------------------------------------------

function radarModel(s: BuilderState, f: CatFrame): RenderModel {
  const o = s.cat
  const dim = f.dims[0]
  // One axis per metric, each scaled to the largest value it carries.
  const indicator = f.labels.map((label) => ({
    name: label,
    max: Math.max(...f.rows.map((r) => num(r[label])), 0) * 1.05 || 1,
  }))
  const data = f.rows.map((r, i) => ({
    name: str(r[dim]),
    value: f.labels.map((label) => num(r[label])),
    itemStyle: { color: PALETTE[i % PALETTE.length] },
    areaStyle: { opacity: 0.15 },
    lineStyle: { width: 2 },
  }))

  return {
    kind: 'echarts',
    option: {
      color: PALETTE,
      tooltip: {
        trigger: 'item',
        confine: true,
        formatter: (p: { name: string; value: number[]; color: string }) =>
          tooltipHeader(p.name) +
          f.labels.map((label, i) => tooltipRow(p.color, label, fmt(p.value?.[i], f.format))).join(''),
      },
      legend: { ...legendConfig(o.legend, o.legendPosition), data: data.map((d) => d.name) },
      radar: {
        indicator,
        center: ['50%', '54%'],
        radius: '62%',
        axisName: { fontSize: 11 },
        splitArea: { areaStyle: { opacity: 0.04 } },
      },
      series: [{ type: 'radar', symbolSize: 4, data }],
    },
  }
}

function waterfallModel(s: BuilderState, f: CatFrame): RenderModel {
  const o = s.cat
  const dim = f.dims[0]
  const label = f.labels[0]
  // A waterfall is a sequence, not a ranking: order by the category itself.
  const rows = [...f.rows].sort((a, b) => str(a[dim]).localeCompare(str(b[dim])))

  const categories = rows.map((r) => str(r[dim]))
  const deltas = rows.map((r) => num(r[label]))
  const base: number[] = []
  const rises: Array<number | '-'> = []
  const falls: Array<number | '-'> = []
  let running = 0
  for (const d of deltas) {
    base.push(d >= 0 ? running : running + d)
    rises.push(d >= 0 ? d : '-')
    falls.push(d < 0 ? -d : '-')
    running += d
  }
  // The closing column is what makes the sequence add up on screen.
  categories.push('Total')
  base.push(0)
  rises.push('-')
  falls.push('-')
  const totals: Array<number | '-'> = categories.map((_, i) => (i === categories.length - 1 ? running : '-'))

  const valueLabel = o.showValues
    ? { show: true, position: 'top', fontSize: 10, formatter: (p: { value: unknown }) => fmt(p.value, f.format) }
    : { show: false }

  return {
    kind: 'echarts',
    option: {
      color: [PALETTE[3], PALETTE[4], PALETTE[1]],
      grid: gridFor({
        legend: o.legend,
        legendPosition: o.legendPosition,
        xTitle: o.xAxisTitle,
        yTitle: o.yAxisTitle,
        rotated: categories.length > 8,
      }),
      legend: { ...legendConfig(o.legend, o.legendPosition), data: ['Increase', 'Decrease', 'Total'] },
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
          const real = list.filter((p) => p.seriesName !== 'base' && p.value !== '-' && p.value != null)
          if (!real.length) return ''
          const p = real[0]
          const signed = p.seriesName === 'Decrease' ? -num(p.value) : num(p.value)
          return tooltipHeader(p.axisValue) + tooltipRow(p.color, p.seriesName, fmt(signed, f.format))
        },
      },
      xAxis: {
        type: 'category',
        data: categories,
        axisLabel: { rotate: o.xAxisLabelRotation || (categories.length > 8 ? 30 : 0), hideOverlap: true },
        ...axisName(o.xAxisTitle, 'x'),
      },
      yAxis: { type: 'value', axisLabel: valueAxisLabel(f.format), ...axisName(o.yAxisTitle, 'y') },
      series: [
        {
          name: 'base',
          type: 'bar',
          stack: 'wf',
          silent: true,
          itemStyle: { color: 'transparent' },
          emphasis: { itemStyle: { color: 'transparent' } },
          data: base,
        },
        { name: 'Increase', type: 'bar', stack: 'wf', barMaxWidth: 48, label: valueLabel, data: rises },
        { name: 'Decrease', type: 'bar', stack: 'wf', barMaxWidth: 48, label: valueLabel, data: falls },
        { name: 'Total', type: 'bar', stack: 'wf', barMaxWidth: 48, label: valueLabel, data: totals },
      ],
    },
  }
}

// ---- two-dimension families -------------------------------------------------

function heatmapModel(s: BuilderState, f: CatFrame): RenderModel {
  const o = s.cat
  const [xDim, yDim] = f.dims
  const label = f.labels[0]
  const xs = [...new Set(f.rows.map((r) => str(r[xDim])))]
  const ys = [...new Set(f.rows.map((r) => str(r[yDim])))]
  const data = f.rows.map((r) => [xs.indexOf(str(r[xDim])), ys.indexOf(str(r[yDim])), num(r[label])])
  const values = data.map((d) => d[2])

  return {
    kind: 'echarts',
    option: {
      grid: { containLabel: true, left: 16, right: 16, top: 16, bottom: 56 },
      tooltip: {
        trigger: 'item',
        confine: true,
        formatter: (p: { value: number[]; color: string }) =>
          tooltipHeader(`${xs[p.value[0]]} · ${ys[p.value[1]]}`) +
          tooltipRow(p.color, label, fmt(p.value[2], f.format)),
      },
      xAxis: {
        type: 'category',
        data: xs,
        splitArea: { show: true },
        axisLabel: { rotate: o.xAxisLabelRotation || (xs.length > 8 ? 30 : 0), hideOverlap: true },
        ...axisName(o.xAxisTitle || xDim, 'x'),
      },
      yAxis: {
        type: 'category',
        data: ys,
        splitArea: { show: true },
        ...axisName(o.yAxisTitle || yDim, 'y'),
      },
      visualMap: {
        min: Math.min(...values, 0),
        max: Math.max(...values, 1),
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 4,
        itemHeight: 90,
        textStyle: { fontSize: 10 },
        inRange: { color: ['#0b3a4a', PALETTE[0], PALETTE[8], '#fcd34d', PALETTE[2]] },
      },
      series: [
        {
          type: 'heatmap',
          data,
          label: {
            show: o.showValues,
            fontSize: 10,
            formatter: (p: { value: number[] }) => fmt(p.value[2], f.format),
          },
          itemStyle: { borderWidth: 1, borderColor: 'transparent' },
          emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,.35)' } },
        },
      ],
    },
  }
}

/**
 * Sankey demands a DAG: one cycle and ECharts throws instead of drawing. Links
 * that would close a loop are dropped and reported in the chart's note, so a
 * messy dataset degrades to "most of the flows" rather than to a blank panel.
 */
function acyclicLinks(links: Array<{ source: string; target: string; value: number }>) {
  const kept: Array<{ source: string; target: string; value: number }> = []
  const edges = new Map<string, Set<string>>()
  const reaches = (from: string, to: string): boolean => {
    const seen = new Set<string>()
    const stack = [from]
    while (stack.length) {
      const node = stack.pop() as string
      if (node === to) return true
      if (seen.has(node)) continue
      seen.add(node)
      for (const next of edges.get(node) ?? []) stack.push(next)
    }
    return false
  }

  let dropped = 0
  for (const l of links) {
    if (l.source === l.target || reaches(l.target, l.source)) {
      dropped += 1
      continue
    }
    kept.push(l)
    const set = edges.get(l.source) ?? new Set<string>()
    set.add(l.target)
    edges.set(l.source, set)
  }
  return { kept, dropped }
}

function sankeyModel(f: CatFrame): RenderModel {
  const [srcDim, tgtDim] = f.dims
  const label = f.labels[0]
  const raw = f.rows
    .map((r) => ({ source: str(r[srcDim]), target: str(r[tgtDim]), value: num(r[label]) }))
    .filter((l) => l.value > 0)
  const { kept, dropped } = acyclicLinks(raw)
  if (!kept.length) return { kind: 'empty', note: 'Every flow was a self-link or closed a cycle.' }

  const names = [...new Set(kept.flatMap((l) => [l.source, l.target]))]
  return {
    kind: 'echarts',
    note: dropped ? `${dropped} link${dropped > 1 ? 's' : ''} dropped: they would close a cycle.` : undefined,
    option: {
      color: PALETTE,
      tooltip: {
        trigger: 'item',
        confine: true,
        formatter: (p: { name: string; value: unknown; color: string }) =>
          tooltipRow(p.color, p.name, fmt(p.value, f.format)),
      },
      series: [
        {
          type: 'sankey',
          left: 8,
          right: 8,
          top: 12,
          bottom: 12,
          nodeGap: 10,
          nodeWidth: 14,
          draggable: false,
          emphasis: { focus: 'adjacency' },
          label: { fontSize: 11 },
          lineStyle: { color: 'gradient', opacity: 0.35, curveness: 0.5 },
          data: names.map((name, i) => ({ name, itemStyle: { color: PALETTE[i % PALETTE.length] } })),
          links: kept,
        },
      ],
    },
  }
}

function graphModel(s: BuilderState, f: CatFrame): RenderModel {
  const o = s.cat
  const [srcDim, tgtDim] = f.dims
  const label = f.labels[0]
  const weight = new Map<string, number>()
  const links = f.rows.map((r) => {
    const source = str(r[srcDim])
    const target = str(r[tgtDim])
    const value = num(r[label])
    weight.set(source, (weight.get(source) ?? 0) + value)
    weight.set(target, (weight.get(target) ?? 0) + value)
    return { source, target, value }
  })

  // Node size tracks its share of the traffic, floored so small nodes stay hittable.
  const max = Math.max(...weight.values(), 1)
  const nodes = [...weight.entries()].map(([name, w], i) => ({
    name,
    value: w,
    symbolSize: 10 + (w / max) * 34,
    itemStyle: { color: PALETTE[i % PALETTE.length] },
  }))

  return {
    kind: 'echarts',
    option: {
      color: PALETTE,
      tooltip: {
        trigger: 'item',
        confine: true,
        formatter: (p: { name: string; value: unknown; color: string }) =>
          tooltipRow(p.color, p.name, fmt(p.value, f.format)),
      },
      series: [
        {
          type: 'graph',
          layout: 'force',
          roam: true,
          draggable: true,
          force: { repulsion: 220, edgeLength: [60, 160], gravity: 0.08 },
          label: { show: o.labelType !== 'none', position: 'right', fontSize: 11 },
          labelLayout: { hideOverlap: true },
          edgeSymbol: ['none', 'arrow'],
          edgeSymbolSize: 7,
          lineStyle: { opacity: 0.45, width: 1.2, curveness: 0.12 },
          emphasis: { focus: 'adjacency', lineStyle: { width: 2.5 } },
          data: nodes,
          links,
        },
      ],
    },
  }
}

// ---- single figure ----------------------------------------------------------

function gaugeModel(s: BuilderState, f: CatFrame): RenderModel {
  const o = s.cat
  const label = f.labels[0]
  const value = num(f.rows[0]?.[label])
  const min = o.gaugeMin
  const max = o.gaugeMax ?? Math.max(min + 1, Math.ceil(value * 1.25))

  return {
    kind: 'echarts',
    option: {
      series: [
        {
          type: 'gauge',
          min,
          max,
          startAngle: 210,
          endAngle: -30,
          radius: '88%',
          progress: { show: true, width: 14, itemStyle: { color: PALETTE[0] } },
          axisLine: { lineStyle: { width: 14 } },
          axisTick: { distance: -18, length: 5 },
          splitLine: { distance: -22, length: 10 },
          axisLabel: { distance: 24, fontSize: 10, formatter: (v: number) => fmt(v, f.format) },
          pointer: { width: 4, itemStyle: { color: PALETTE[0] } },
          anchor: { show: true, size: 12, itemStyle: { color: PALETTE[0] } },
          detail: {
            valueAnimation: true,
            offsetCenter: [0, '58%'],
            fontSize: 26,
            fontWeight: 600,
            formatter: (v: number) => fmt(v, f.format),
          },
          title: { offsetCenter: [0, '84%'], fontSize: 11 },
          data: [{ value, name: label }],
        },
      ],
    },
  }
}

function bigNumberModel(f: CatFrame, result: ChartDataResult): RenderModel {
  const label = f.labels[0] ?? result.colnames?.[0] ?? 'value'
  return { kind: 'big_number', big: { value: f.rows[0]?.[label], label, format: f.format } }
}

// ---- tables -----------------------------------------------------------------

function tableModel(result: ChartDataResult): RenderModel {
  const rows = result.data ?? []
  return { kind: 'table', table: { colnames: result.colnames ?? Object.keys(rows[0] ?? {}), rows } }
}

/**
 * Pivot: rows are the first dimension, columns the (optional) second crossed
 * with every metric, plus a row total. Superset does this server-side with its
 * `pivot` operator; one dimension deep it is cheaper and more predictable here.
 */
function pivotModel(f: CatFrame): RenderModel {
  const [rowDim, colDim] = f.dims
  const rowKeys = [...new Set(f.rows.map((r) => str(r[rowDim])))]
  const colKeys = colDim ? [...new Set(f.rows.map((r) => str(r[colDim])))] : ['']
  const cellKey = (row: string, col: string, metric: string) => JSON.stringify([row, col, metric])

  const cells = new Map<string, number>()
  for (const r of f.rows) {
    for (const label of f.labels) {
      const key = cellKey(str(r[rowDim]), colDim ? str(r[colDim]) : '', label)
      cells.set(key, (cells.get(key) ?? 0) + num(r[label]))
    }
  }

  const single = f.labels.length === 1
  const colnames = [rowDim]
  const columns: Array<{ name: string; col: string; label: string }> = []
  for (const col of colKeys) {
    for (const label of f.labels) {
      const name = colDim ? (single ? col : `${col} · ${label}`) : label
      colnames.push(name)
      columns.push({ name, col, label })
    }
  }
  colnames.push('Total')

  const rows = rowKeys.map((rk) => {
    const out: Record<string, unknown> = { [rowDim]: rk }
    let total = 0
    for (const c of columns) {
      const v = cells.get(cellKey(rk, c.col, c.label))
      out[c.name] = v ?? null
      total += v ?? 0
    }
    out.Total = total
    return out
  })
  return { kind: 'table', table: { colnames, rows } }
}

// ---- word cloud -------------------------------------------------------------

/**
 * The ECharts word-cloud lives in an extension package the core build doesn't
 * carry, so the cloud is plain DOM: terms scaled between the configured font
 * sizes, then interleaved big/small so the heavy ones don't all queue up at the
 * top. <ChartRenderer> lays them out.
 */
function wordCloudModel(s: BuilderState, f: CatFrame): RenderModel {
  const o = s.cat
  const dim = f.dims[0]
  const label = f.labels[0]
  const items = f.rows.map((r) => ({ text: str(r[dim]), value: num(r[label]) })).filter((w) => w.value > 0)
  if (!items.length) return { kind: 'empty' }

  const values = items.map((w) => w.value)
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min || 1
  const lo = Math.max(8, o.minFontSize)
  const hi = Math.max(lo + 4, o.maxFontSize)

  const ranked = items
    .slice()
    .sort((a, b) => b.value - a.value)
    .map((w, i) => ({
      text: w.text,
      value: w.value,
      // sqrt keeps the biggest term from swallowing the panel.
      size: Math.round(lo + Math.sqrt((w.value - min) / span) * (hi - lo)),
      color: PALETTE[i % PALETTE.length],
      title: `${w.text}: ${fmt(w.value, f.format)}`,
    }))

  // Deterministic scatter: take from the front and the back of the ranking in turn.
  const words: typeof ranked = []
  for (let head = 0, tail = ranked.length - 1; head <= tail; head += 1, tail -= 1) {
    words.push(ranked[head])
    if (head !== tail) words.push(ranked[tail])
  }
  return { kind: 'wordcloud', words }
}
