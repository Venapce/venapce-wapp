// The builder's own state model and the translation to a Superset query_context.
// This is the framework-agnostic heart of the chart builder — mirrors the job
// Superset's per-chart `buildQuery.ts` does (see SUPERSET-INTEGRATION-STUDY.md §2).

import type { AdhocMetric, QueryContext, QueryFilter, QueryObject } from '@/api/types'

export type VizType = 'bar' | 'line' | 'area' | 'pie' | 'table' | 'big_number'

export const VIZ_TYPES: { value: VizType; label: string; icon: string }[] = [
  { value: 'bar', label: 'Bar', icon: '▊' },
  { value: 'line', label: 'Line', icon: '╱' },
  { value: 'area', label: 'Area', icon: '◣' },
  { value: 'pie', label: 'Pie', icon: '◐' },
  { value: 'table', label: 'Table', icon: '▦' },
  { value: 'big_number', label: 'Big Number', icon: '#' },
]

export const AGGREGATES = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COUNT_DISTINCT'] as const
export type Aggregate = (typeof AGGREGATES)[number]

export const FILTER_OPS = ['==', '!=', '>', '<', '>=', '<=', 'LIKE', 'IN', 'IS NOT NULL', 'IS NULL'] as const

/** A metric as the builder UI models it (before translation to Superset's shape). */
export type MetricSpec =
  | { kind: 'saved'; name: string }
  | { kind: 'simple'; column: string; aggregate: Aggregate; label?: string }
  | { kind: 'sql'; sql: string; label: string }

export interface FilterSpec {
  col: string
  op: (typeof FILTER_OPS)[number]
  val: string
}

export interface BuilderState {
  datasetId: number | null
  vizType: VizType
  dimensions: string[]
  metrics: MetricSpec[]
  filters: FilterSpec[]
  rowLimit: number
  orderDesc: boolean
}

export function emptyBuilder(): BuilderState {
  return {
    datasetId: null,
    vizType: 'bar',
    dimensions: [],
    metrics: [{ kind: 'sql', sql: 'COUNT(*)', label: 'count' }],
    filters: [],
    rowLimit: 100,
    orderDesc: true,
  }
}

/** Human-readable label of a metric — this is also the key it appears under in the result rows. */
export function metricLabel(m: MetricSpec): string {
  if (m.kind === 'saved') return m.name
  if (m.kind === 'sql') return m.label || m.sql
  return m.label || `${m.aggregate}(${m.column})`
}

function toSupersetMetric(m: MetricSpec): AdhocMetric {
  if (m.kind === 'saved') return m.name
  if (m.kind === 'sql') {
    return { expressionType: 'SQL', sqlExpression: m.sql, label: metricLabel(m), hasCustomLabel: true }
  }
  return {
    expressionType: 'SIMPLE',
    column: { column_name: m.column },
    aggregate: m.aggregate,
    label: metricLabel(m),
    hasCustomLabel: !!m.label,
  }
}

function toSupersetFilter(f: FilterSpec): QueryFilter {
  if (f.op === 'IS NULL' || f.op === 'IS NOT NULL') return { col: f.col, op: f.op, val: null }
  if (f.op === 'IN') {
    return { col: f.col, op: f.op, val: f.val.split(',').map((s) => s.trim()).filter(Boolean) }
  }
  return { col: f.col, op: f.op, val: f.val }
}

/**
 * Translate builder state into the query_context POSTed to /api/v1/chart/data.
 * `table` with no metrics becomes a raw-records query (columns only).
 */
export function buildQueryContext(s: BuilderState): QueryContext {
  if (s.datasetId == null) throw new Error('Pick a dataset first')

  const isRawTable = s.vizType === 'table' && s.metrics.length === 0
  const metrics = isRawTable ? [] : s.metrics.map(toSupersetMetric)
  const filters = s.filters.filter((f) => f.col).map(toSupersetFilter)

  const query: QueryObject = {
    columns: [...s.dimensions],
    metrics,
    filters,
    row_limit: s.rowLimit,
    order_desc: s.orderDesc,
  }
  if (metrics.length > 0) query.orderby = [[metrics[0], !s.orderDesc]]

  return {
    datasource: { id: s.datasetId, type: 'table' },
    force: false,
    queries: [query],
    // form_data is not strictly required for result_type "full", but Superset
    // is happier with a datasource + viz_type present.
    form_data: { datasource: `${s.datasetId}__table`, viz_type: s.vizType },
    result_format: 'json',
    result_type: 'full',
  }
}
