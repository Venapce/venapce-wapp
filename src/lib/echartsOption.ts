// Transform a Superset /chart/data result into an Apache ECharts `option`.
// This is the same job Superset's own `transformProps.ts` does; here we keep a
// compact, framework-agnostic version for the chart types the sample supports.
// (See SUPERSET-INTEGRATION-STUDY.md §2 — reuse strategy A.)

import type { ChartDataResult } from '@/api/types'
import { metricLabel, type BuilderState, type MetricSpec } from './builder'

// A small, colorblind-safe categorical palette (Venapce-tinted).
export const PALETTE = ['#06b6d4', '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']

export interface RenderModel {
  /** 'echarts' → feed `option` to <v-chart>; the others are rendered by the component directly. */
  kind: 'echarts' | 'table' | 'big_number' | 'empty'
  option?: Record<string, unknown>
  table?: { colnames: string[]; rows: Array<Record<string, unknown>> }
  big?: { value: unknown; label: string }
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return Number.isFinite(n) ? n : 0
}

export function toRenderModel(state: BuilderState, result: ChartDataResult): RenderModel {
  const rows = result.data ?? []
  if (!rows.length) return { kind: 'empty' }

  const metricLabels = state.metrics.map((m: MetricSpec) => metricLabel(m))
  const dim = state.dimensions[0]

  const baseAxis = {
    grid: { left: 48, right: 24, top: 48, bottom: 56, containLabel: true },
    tooltip: { trigger: 'axis' as const },
    legend: { top: 8, type: 'scroll' as const },
    color: PALETTE,
  }

  switch (state.vizType) {
    case 'table':
      return { kind: 'table', table: { colnames: result.colnames ?? Object.keys(rows[0]), rows } }

    case 'big_number': {
      const label = metricLabels[0] ?? result.colnames?.[0] ?? 'value'
      return { kind: 'big_number', big: { value: rows[0]?.[label], label } }
    }

    case 'pie': {
      const label = metricLabels[0] ?? result.colnames?.[1]
      const data = rows.map((r) => ({ name: String(r[dim] ?? '∅'), value: num(r[label as string]) }))
      return {
        kind: 'echarts',
        option: {
          color: PALETTE,
          tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
          legend: { top: 8, type: 'scroll' },
          series: [
            {
              type: 'pie',
              radius: ['38%', '68%'],
              itemStyle: { borderColor: '#fff', borderWidth: 2 },
              label: { formatter: '{b}\n{d}%' },
              data,
            },
          ],
        },
      }
    }

    case 'bar':
    case 'line':
    case 'area': {
      const xData = rows.map((r) => String(r[dim] ?? '∅'))
      const chartType = state.vizType === 'bar' ? 'bar' : 'line'
      const series = metricLabels.map((label) => ({
        name: label,
        type: chartType,
        smooth: state.vizType !== 'bar',
        stack: state.vizType === 'area' ? 'total' : undefined,
        areaStyle: state.vizType === 'area' ? {} : undefined,
        emphasis: { focus: 'series' },
        data: rows.map((r) => num(r[label])),
      }))
      return {
        kind: 'echarts',
        option: {
          ...baseAxis,
          xAxis: { type: 'category', data: xData, axisLabel: { rotate: xData.length > 8 ? 30 : 0 } },
          yAxis: { type: 'value' },
          series,
        },
      }
    }

    default:
      return { kind: 'empty' }
  }
}
