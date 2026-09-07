// Time-series → ECharts. The counterpart of Superset's
// plugin-chart-echarts/src/Timeseries/transformProps.ts.
//
// The rows arriving here have already been pivoted and flattened by Superset's
// post-processing chain (see builder.ts), so the frame is one x column plus one
// column per series — including the rolling / compare / contribution results.

import type { ChartDataResult } from '@/api/types'
import { metricLabel, type BuilderState } from '@/lib/builder'
import { formatNumber } from '@/lib/numberFormat'
import {
  axisBounds,
  axisName,
  axisTooltip,
  gridFor,
  isTemporal,
  legendConfig,
  numOrNull,
  PALETTE,
  seriesColumns,
  sortSeries,
  str,
  timeValue,
  valueAxisLabel,
  type RenderModel,
} from './common'

interface Series {
  name: string
  values: Array<number | null>
}

/**
 * Superset's `flatten` names a pivoted column "<metric>, <dimension>". With a
 * single metric that prefix is noise on every series, so drop it — the same
 * thing Superset's `rename` operator does before flattening.
 */
function seriesLabeller(s: BuilderState): (col: string) => string {
  if (s.metrics.length !== 1 || !s.dimensions.length) return (col) => col
  const prefix = `${metricLabel(s.metrics[0])}, `
  return (col) => (col.startsWith(prefix) ? col.slice(prefix.length) : col)
}

export function timeSeriesModel(s: BuilderState, result: ChartDataResult): RenderModel {
  const rows = result.data ?? []
  if (!rows.length) return { kind: 'empty' }

  const o = s.ts
  const xLabel = s.xAxis
  const temporal = isTemporal(result, xLabel)
  const cols = seriesColumns(result, [xLabel])
  if (!cols.length) return { kind: 'empty' }

  // Superset returns the pivoted frame in index order, but a resample or a
  // time shift can leave it unsorted — sort on the axis so lines don't zigzag.
  const ordered = [...rows].sort((a, b) => {
    if (temporal) return (timeValue(a[xLabel]) ?? 0) - (timeValue(b[xLabel]) ?? 0)
    return String(a[xLabel]).localeCompare(String(b[xLabel]))
  })

  const xValues = ordered.map((r) => (temporal ? timeValue(r[xLabel]) : str(r[xLabel])))
  const label = seriesLabeller(s)
  const series: Series[] = cols.map((c) => ({ name: label(c), values: ordered.map((r) => numOrNull(r[c])) }))
  const sorted = sortSeries(series, o.sortSeriesBy, o.sortSeriesDesc)

  // Same query, a different reading of it: the latest value as a headline, with
  // the series it came from drawn small behind it.
  if (s.vizType === 'big_number_trendline') return bigNumberTrendModel(s, sorted[0], xValues, temporal)

  // A share-of-total chart is a percentage by construction, so default the axis
  // format to one unless the user picked something explicit.
  const percentish = !!o.contributionMode || (!!o.comparisonShift && o.comparisonType === 'percentage')
  const valueFormat = o.yAxisFormat || (percentish ? '.1%' : '')

  const stacked = o.stacked && o.seriesStyle !== 'scatter'
  const rotated = o.xAxisLabelRotation !== 0

  const echartsSeries = sorted.map((se, i) => {
    const color = PALETTE[i % PALETTE.length]
    const data = se.values.map((v, j) => (temporal ? [xValues[j], v] : v))
    const common = {
      name: se.name,
      color,
      data,
      emphasis: { focus: 'series' },
      label: o.showValues
        ? { show: true, position: 'top', formatter: (p: { value: unknown }) =>
            formatNumber(Array.isArray(p.value) ? p.value[1] : p.value, valueFormat) }
        : { show: false },
    }

    if (o.seriesStyle === 'bar') {
      return { ...common, type: 'bar', stack: stacked ? 'total' : undefined, barMaxWidth: 40 }
    }
    if (o.seriesStyle === 'scatter') {
      return { ...common, type: 'scatter', symbolSize: o.markerSize || 6 }
    }
    const isArea = o.seriesStyle === 'area'
    return {
      ...common,
      type: 'line',
      step: o.seriesStyle === 'step' ? 'start' : false,
      smooth: o.seriesStyle === 'step' ? false : o.smooth,
      showSymbol: o.markers,
      symbolSize: o.markerSize,
      connectNulls: false,
      lineStyle: { width: 2 },
      stack: stacked ? 'total' : undefined,
      areaStyle: isArea ? { opacity: o.areaOpacity } : undefined,
    }
  })

  const option: Record<string, unknown> = {
    color: PALETTE,
    grid: gridFor({
      legend: o.legend,
      legendPosition: o.legendPosition,
      xTitle: o.xAxisTitle,
      yTitle: o.yAxisTitle,
      dataZoom: o.dataZoom,
      rotated,
    }),
    legend: { ...legendConfig(o.legend, o.legendPosition), data: sorted.map((x) => x.name) },
    tooltip: axisTooltip({ temporal, grain: s.timeGrain, format: valueFormat, rich: o.richTooltip }),
    xAxis: {
      type: temporal ? 'time' : 'category',
      ...(temporal ? {} : { data: xValues, boundaryGap: o.seriesStyle === 'bar' }),
      axisLabel: { rotate: o.xAxisLabelRotation, hideOverlap: true },
      axisTick: { show: true },
      minorTick: { show: o.minorTicks },
      minorSplitLine: { show: o.minorTicks },
      ...axisName(o.xAxisTitle, 'x'),
    },
    yAxis: {
      type: o.logAxis ? 'log' : 'value',
      axisLabel: valueAxisLabel(valueFormat),
      splitLine: { show: true },
      minorTick: { show: o.minorTicks },
      minorSplitLine: { show: o.minorTicks },
      ...axisBounds(o.yAxisMin, o.yAxisMax),
      ...axisName(o.yAxisTitle, 'y'),
    },
    series: echartsSeries,
  }

  if (o.dataZoom) {
    option.dataZoom = [
      { type: 'inside', filterMode: 'none' },
      { type: 'slider', height: 22, bottom: o.legend && o.legendPosition === 'bottom' ? 34 : 6 },
    ]
  }

  return { kind: 'echarts', option }
}

/**
 * Superset's "Big Number with Trendline": the most recent point of the first
 * series as the figure, the whole series as the sparkline under it. The
 * sparkline is a normal ECharts option — <ChartRenderer> draws it in the strip
 * below the number.
 */
function bigNumberTrendModel(
  s: BuilderState,
  series: Series | undefined,
  xValues: Array<number | string | null>,
  temporal: boolean,
): RenderModel {
  const format = s.ts.yAxisFormat
  if (!series) return { kind: 'empty' }

  const points = series.values
    .map((v, i) => ({ x: xValues[i], y: v }))
    .filter((p) => p.y != null && p.x != null)
  const last = points[points.length - 1]

  const spark: Record<string, unknown> = {
    color: [PALETTE[0]],
    grid: { left: 2, right: 2, top: 6, bottom: 2, containLabel: false },
    xAxis: {
      type: temporal ? 'time' : 'category',
      show: false,
      boundaryGap: false,
      ...(temporal ? {} : { data: points.map((p) => p.x) }),
    },
    yAxis: { type: 'value', show: false, scale: true },
    tooltip: axisTooltip({ temporal, grain: s.timeGrain, format, rich: true }),
    series: [
      {
        name: series.name,
        type: 'line',
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2 },
        areaStyle: { opacity: 0.18 },
        data: points.map((p) => (temporal ? [p.x, p.y] : p.y)),
      },
    ],
  }

  return { kind: 'big_number', big: { value: last?.y, label: series.name, format, spark } }
}
