// The builder's own state model and the translation to a Superset query_context.
// This is the framework-agnostic heart of the chart builder — it mirrors the job
// Superset's per-chart `buildQuery.ts` does (see SUPERSET-INTEGRATION-STUDY.md §2),
// including the `post_processing` chain (pivot / rolling / compare / resample /
// contribution / flatten) that gives the time-series family its real power.

import type {
  AdhocColumn,
  AdhocMetric,
  DatasetColumn,
  PostProcessingOp,
  QueryColumn,
  QueryContext,
  QueryFilter,
  QueryObject,
} from '@/api/types'

/**
 * The chart types this app renders natively. These are keys in the viz catalogue
 * (lib/vizCatalog.ts), which mirrors Superset's much larger registry — the
 * catalogue lists every Superset type, this union is the subset we can draw.
 */
export type VizType =
  // evolution — the time-series engine
  | 'timeseries'
  | 'timeseries_bar'
  | 'timeseries_area'
  | 'timeseries_step'
  | 'timeseries_scatter'
  | 'timeseries_smooth'
  | 'big_number_trendline'
  // correlation
  | 'scatter'
  | 'bubble'
  // distribution — raw values binned/summarised in the browser
  | 'histogram'
  | 'box_plot'
  // flow / hierarchy
  | 'tree'
  | 'sankey_v2'
  | 'graph_chart'
  // categorical — one query, N metrics over dimensions
  | 'bar'
  | 'line'
  | 'area'
  | 'pie'
  | 'rose'
  | 'funnel'
  | 'radar'
  | 'waterfall'
  | 'treemap_v2'
  | 'sunburst_v2'
  | 'heatmap_v2'
  | 'word_cloud'
  | 'table'
  | 'pivot_table_v2'
  | 'gauge_chart'
  | 'big_number'

/**
 * The renderer + query builder behind a viz type. Several catalogue entries share
 * one engine — exactly as Superset's line/bar/area/step/scatter time-series
 * plugins all share `Timeseries/transformProps`, differing only in defaults.
 */
export type VizEngine = 'timeseries' | 'scatter' | 'histogram' | 'tree' | 'categorical'

const ENGINE_OF: Record<VizType, VizEngine> = {
  timeseries: 'timeseries',
  timeseries_bar: 'timeseries',
  timeseries_area: 'timeseries',
  timeseries_step: 'timeseries',
  timeseries_scatter: 'timeseries',
  timeseries_smooth: 'timeseries',
  big_number_trendline: 'timeseries',
  scatter: 'scatter',
  bubble: 'scatter',
  histogram: 'histogram',
  box_plot: 'histogram',
  tree: 'tree',
  bar: 'categorical',
  line: 'categorical',
  area: 'categorical',
  pie: 'categorical',
  rose: 'categorical',
  funnel: 'categorical',
  radar: 'categorical',
  waterfall: 'categorical',
  treemap_v2: 'categorical',
  sunburst_v2: 'categorical',
  heatmap_v2: 'categorical',
  sankey_v2: 'categorical',
  graph_chart: 'categorical',
  word_cloud: 'categorical',
  table: 'categorical',
  pivot_table_v2: 'categorical',
  gauge_chart: 'categorical',
  big_number: 'categorical',
}

export const SUPPORTED_VIZ_TYPES = Object.keys(ENGINE_OF) as VizType[]

export function vizEngine(v: string): VizEngine {
  return ENGINE_OF[v as VizType] ?? 'categorical'
}

export const isSupportedViz = (v: string): v is VizType => v in ENGINE_OF

export const AGGREGATES = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COUNT_DISTINCT'] as const
export type Aggregate = (typeof AGGREGATES)[number]

export const FILTER_OPS = ['==', '!=', '>', '<', '>=', '<=', 'LIKE', 'IN', 'IS NOT NULL', 'IS NULL'] as const

// ---- Superset control vocabularies -----------------------------------------

/** ISO-8601 durations, exactly the values Superset's `time_grain_sqla` accepts. */
export const TIME_GRAINS: { value: string; label: string }[] = [
  { value: '', label: 'Original value' },
  { value: 'PT1S', label: 'Second' },
  { value: 'PT1M', label: 'Minute' },
  { value: 'PT5M', label: '5 minute' },
  { value: 'PT15M', label: '15 minute' },
  { value: 'PT30M', label: '30 minute' },
  { value: 'PT1H', label: 'Hour' },
  { value: 'P1D', label: 'Day' },
  { value: 'P1W', label: 'Week' },
  { value: 'P1M', label: 'Month' },
  { value: 'P3M', label: 'Quarter' },
  { value: 'P1Y', label: 'Year' },
]

/** Values understood by Superset's TEMPORAL_RANGE filter (free text is allowed too). */
export const TIME_RANGES: string[] = [
  'No filter',
  'Last day',
  'Last week',
  'Last month',
  'Last quarter',
  'Last year',
  'previous calendar week',
  'previous calendar month',
  'previous calendar year',
]

export const ROLLING_TYPES = ['None', 'mean', 'sum', 'std', 'cumsum'] as const
export type RollingType = (typeof ROLLING_TYPES)[number]

/** Time shifts for the comparison series — Superset's `time_offsets`. */
export const TIME_SHIFTS: string[] = [
  '',
  '1 day ago',
  '1 week ago',
  '4 weeks ago',
  '1 month ago',
  '1 quarter ago',
  '1 year ago',
]

export const COMPARISON_TYPES = ['values', 'difference', 'percentage', 'ratio'] as const
export type ComparisonType = (typeof COMPARISON_TYPES)[number]

export const RESAMPLE_METHODS = ['asfreq', 'zerofill', 'ffill', 'bfill', 'mean', 'median', 'sum'] as const
export type ResampleMethod = (typeof RESAMPLE_METHODS)[number]

/**
 * Resample rules are **pandas offset aliases**, not the ISO-8601 durations used
 * for `time_grain_sqla`. Superset hands `rule` straight to `df.resample(rule)`,
 * so a grain like `P1D` raises "Invalid frequency: P1D". These are the same
 * choices Superset's own Advanced Analytics panel offers.
 */
export const RESAMPLE_RULES: Array<{ value: string; label: string }> = [
  { value: '', label: 'None' },
  { value: '1T', label: 'Minute' },
  { value: '1H', label: 'Hour' },
  { value: '1D', label: 'Day' },
  { value: '7D', label: 'Week' },
  { value: '1MS', label: 'Month start' },
  { value: '1M', label: 'Month end' },
  { value: '1AS', label: 'Year start' },
  { value: '1A', label: 'Year end' },
]

export const CONTRIBUTION_MODES = [
  { value: '', label: 'None' },
  { value: 'row', label: 'Series (share of each timestamp)' },
  { value: 'column', label: 'Total (share of the whole series)' },
] as const

export const SERIES_STYLES = ['line', 'area', 'bar', 'scatter', 'step'] as const
export type SeriesStyle = (typeof SERIES_STYLES)[number]

export const SORT_SERIES_BY = ['name', 'sum', 'avg', 'min', 'max'] as const
export type SortSeriesBy = (typeof SORT_SERIES_BY)[number]

export const LEGEND_POSITIONS = ['top', 'bottom', 'left', 'right'] as const
export type LegendPosition = (typeof LEGEND_POSITIONS)[number]

export const TREE_LAYOUTS = ['orthogonal', 'radial'] as const
export const TREE_ORIENTS = ['LR', 'RL', 'TB', 'BT'] as const
export const TREE_SYMBOLS = ['emptyCircle', 'circle', 'rect', 'roundRect', 'triangle', 'diamond', 'none'] as const
export const LABEL_POSITIONS = ['top', 'right', 'bottom', 'left'] as const
export const HISTOGRAM_MODES = ['grouped', 'stacked', 'overlay'] as const
export type HistogramMode = (typeof HISTOGRAM_MODES)[number]

// ---- metrics / filters ------------------------------------------------------

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

// ---- per-viz option groups --------------------------------------------------

/** Time-series controls — the union of Superset's Data + Chart Options panels. */
export interface TimeSeriesOptions {
  seriesStyle: SeriesStyle
  stacked: boolean
  areaOpacity: number
  markers: boolean
  markerSize: number
  smooth: boolean
  showValues: boolean
  richTooltip: boolean
  dataZoom: boolean
  logAxis: boolean
  minorTicks: boolean
  legend: boolean
  legendPosition: LegendPosition
  sortSeriesBy: SortSeriesBy
  sortSeriesDesc: boolean
  xAxisTitle: string
  xAxisLabelRotation: number
  yAxisTitle: string
  yAxisFormat: string
  yAxisMin: number | null
  yAxisMax: number | null
  /** Advanced analytics — these become `post_processing` steps. */
  contributionMode: '' | 'row' | 'column'
  rollingType: RollingType
  rollingPeriods: number
  minPeriods: number
  comparisonShift: string
  comparisonType: ComparisonType
  resampleRule: string
  resampleMethod: ResampleMethod
}

export interface ScatterOptions {
  xMetric: MetricSpec | null
  yMetric: MetricSpec | null
  /** Optional third metric → bubble sizes. */
  sizeMetric: MetricSpec | null
  /** The column identifying one point (Superset's "entity"). */
  entity: string
  /** Optional column that colours the points. */
  series: string
  minBubbleSize: number
  maxBubbleSize: number
  opacity: number
  logX: boolean
  logY: boolean
  xFormat: string
  yFormat: string
  xAxisTitle: string
  yAxisTitle: string
  showLabels: boolean
  legend: boolean
  /** Least-squares fit drawn per series (computed in the browser). */
  trendline: boolean
}

export interface HistogramOptions {
  /** The numeric column whose distribution we draw. */
  column: string
  bins: number
  /** Optional column that splits the distribution into groups. */
  groupby: string
  mode: HistogramMode
  /** Show each bin as a share of the total instead of a raw count. */
  normalize: boolean
  cumulative: boolean
  showValues: boolean
  legend: boolean
  xAxisLabelRotation: number
  xFormat: string
  yAxisTitle: string
}

/** Label content on the slice-shaped families (pie / rose / funnel / treemap). */
export const CAT_LABEL_TYPES = [
  { value: 'name_percent', label: 'Name · %' },
  { value: 'name_value', label: 'Name · value' },
  { value: 'name', label: 'Name' },
  { value: 'value', label: 'Value' },
  { value: 'percent', label: 'Percent' },
  { value: 'none', label: 'Hidden' },
] as const
export type CatLabelType = (typeof CAT_LABEL_TYPES)[number]['value']

/**
 * Chart options shared by the categorical family — the one query shape (N
 * metrics over up to two dimensions) behind bar, pie, funnel, radar, treemap,
 * heatmap, sankey, gauge and the tables. Each renderer reads the handful of
 * fields that mean something to it and ignores the rest, the way Superset's
 * control panels overlap across its ECharts plugins.
 */
export interface CategoricalOptions {
  legend: boolean
  legendPosition: LegendPosition
  showValues: boolean
  valueFormat: string
  /** Order categories by the first metric instead of the query's own order. */
  sortBars: boolean
  /** Bars along the y-axis instead of the x-axis. */
  horizontal: boolean
  stacked: boolean
  /** Pie/rose: cut a hole in the middle. */
  donut: boolean
  labelType: CatLabelType
  xAxisTitle: string
  yAxisTitle: string
  xAxisLabelRotation: number
  /** Gauge bounds; a null max is derived from the value. */
  gaugeMin: number
  gaugeMax: number | null
  /** Hierarchy depth drawn by treemap / sunburst before collapsing. */
  hierarchyDepth: number
  /** Word cloud type sizes, in px. */
  minFontSize: number
  maxFontSize: number
}

export interface TreeOptions {
  idColumn: string
  parentColumn: string
  /** Label column; falls back to the id column. */
  nameColumn: string
  /** Optional metric attached to each node (shown in the tooltip). */
  metric: MetricSpec | null
  /** Draw the subtree under this node id only ('' = the natural root). */
  rootNode: string
  layout: (typeof TREE_LAYOUTS)[number]
  orient: (typeof TREE_ORIENTS)[number]
  symbol: (typeof TREE_SYMBOLS)[number]
  symbolSize: number
  nodeLabelPosition: (typeof LABEL_POSITIONS)[number]
  childLabelPosition: (typeof LABEL_POSITIONS)[number]
  /** Levels expanded initially; 0 = all. */
  initialDepth: number
  roam: boolean
  edgeShape: 'curve' | 'polyline'
}

export interface BuilderState {
  datasetId: number | null
  vizType: VizType
  dimensions: string[]
  metrics: MetricSpec[]
  filters: FilterSpec[]
  rowLimit: number
  orderDesc: boolean
  // -- temporal query controls (time-series) --
  xAxis: string
  timeGrain: string
  timeRange: string
  seriesLimit: number
  seriesLimitMetric: MetricSpec | null
  // -- per-viz option groups --
  ts: TimeSeriesOptions
  scatter: ScatterOptions
  histogram: HistogramOptions
  tree: TreeOptions
  cat: CategoricalOptions
}

export function defaultTimeSeriesOptions(): TimeSeriesOptions {
  return {
    seriesStyle: 'line',
    stacked: false,
    areaOpacity: 0.3,
    markers: false,
    markerSize: 6,
    smooth: true,
    showValues: false,
    richTooltip: true,
    dataZoom: false,
    logAxis: false,
    minorTicks: false,
    legend: true,
    legendPosition: 'top',
    sortSeriesBy: 'sum',
    sortSeriesDesc: true,
    xAxisTitle: '',
    xAxisLabelRotation: 0,
    yAxisTitle: '',
    yAxisFormat: '',
    yAxisMin: null,
    yAxisMax: null,
    contributionMode: '',
    rollingType: 'None',
    rollingPeriods: 7,
    minPeriods: 0,
    comparisonShift: '',
    comparisonType: 'values',
    resampleRule: '',
    resampleMethod: 'asfreq',
  }
}

export function defaultScatterOptions(): ScatterOptions {
  return {
    xMetric: null,
    yMetric: null,
    sizeMetric: null,
    entity: '',
    series: '',
    minBubbleSize: 8,
    maxBubbleSize: 48,
    opacity: 0.75,
    logX: false,
    logY: false,
    xFormat: '',
    yFormat: '',
    xAxisTitle: '',
    yAxisTitle: '',
    showLabels: false,
    legend: true,
    trendline: false,
  }
}

export function defaultHistogramOptions(): HistogramOptions {
  return {
    column: '',
    bins: 20,
    groupby: '',
    mode: 'grouped',
    normalize: false,
    cumulative: false,
    showValues: false,
    legend: true,
    xAxisLabelRotation: 0,
    xFormat: '',
    yAxisTitle: '',
  }
}

export function defaultCategoricalOptions(): CategoricalOptions {
  return {
    legend: true,
    legendPosition: 'top',
    showValues: false,
    valueFormat: '',
    sortBars: true,
    horizontal: false,
    stacked: false,
    donut: true,
    labelType: 'name_percent',
    xAxisTitle: '',
    yAxisTitle: '',
    xAxisLabelRotation: 0,
    gaugeMin: 0,
    gaugeMax: null,
    hierarchyDepth: 2,
    minFontSize: 12,
    maxFontSize: 48,
  }
}

export function defaultTreeOptions(): TreeOptions {
  return {
    idColumn: '',
    parentColumn: '',
    nameColumn: '',
    metric: null,
    rootNode: '',
    layout: 'orthogonal',
    orient: 'LR',
    symbol: 'emptyCircle',
    symbolSize: 8,
    nodeLabelPosition: 'left',
    childLabelPosition: 'right',
    initialDepth: 2,
    roam: false,
    edgeShape: 'curve',
  }
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
    xAxis: '',
    timeGrain: 'P1D',
    timeRange: 'No filter',
    seriesLimit: 0,
    seriesLimitMetric: null,
    ts: defaultTimeSeriesOptions(),
    scatter: defaultScatterOptions(),
    histogram: defaultHistogramOptions(),
    tree: defaultTreeOptions(),
    cat: defaultCategoricalOptions(),
  }
}

/**
 * Fill in anything a stored `builderState` predates. Charts saved before the
 * time-series / scatter / histogram / tree families existed only carry the old
 * fields, so every read path (restore, dashboard render) runs through this.
 */
export function normalizeState(raw: Partial<BuilderState> | null | undefined): BuilderState {
  const base = emptyBuilder()
  if (!raw) return base
  return {
    ...base,
    ...raw,
    dimensions: raw.dimensions ?? base.dimensions,
    metrics: raw.metrics ?? base.metrics,
    filters: raw.filters ?? base.filters,
    ts: { ...base.ts, ...(raw.ts ?? {}) },
    scatter: { ...base.scatter, ...(raw.scatter ?? {}) },
    histogram: { ...base.histogram, ...(raw.histogram ?? {}) },
    tree: { ...base.tree, ...(raw.tree ?? {}) },
    cat: { ...base.cat, ...(raw.cat ?? {}) },
  }
}

/** Human-readable label of a metric — this is also the key it appears under in the result rows. */
export function metricLabel(m: MetricSpec): string {
  if (m.kind === 'saved') return m.name
  if (m.kind === 'sql') return m.label || m.sql
  return m.label || `${m.aggregate}(${m.column})`
}

export function simpleMetric(column: string, aggregate: Aggregate = 'SUM'): MetricSpec {
  return { kind: 'simple', column, aggregate }
}

export const countMetric = (): MetricSpec => ({ kind: 'sql', sql: 'COUNT(*)', label: 'count' })

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

/** The metrics a viz type actually queries — the panel differs per family. */
export function activeMetrics(s: BuilderState): MetricSpec[] {
  const engine = vizEngine(s.vizType)
  if (engine === 'scatter') {
    return [s.scatter.xMetric, s.scatter.yMetric, s.scatter.sizeMetric].filter(Boolean) as MetricSpec[]
  }
  if (engine === 'histogram') return []
  if (engine === 'tree') return s.tree.metric ? [s.tree.metric] : []
  return s.metrics
}

// ---- query building ---------------------------------------------------------

/** The x-axis as Superset's ad-hoc `BASE_AXIS` column (this is what applies the grain). */
export function baseAxisColumn(s: BuilderState): AdhocColumn {
  return {
    expressionType: 'SQL',
    sqlExpression: s.xAxis,
    label: s.xAxis,
    columnType: 'BASE_AXIS',
    ...(s.timeGrain ? { timeGrain: s.timeGrain } : {}),
  }
}

/** Column label of the time-series x-axis in the returned rows. */
export const xAxisLabel = (s: BuilderState): string => s.xAxis

/** Metric label plus Superset's time-shift suffix, e.g. `count__1 year ago`. */
export const shiftedLabel = (label: string, shift: string): string => `${label}__${shift}`

/**
 * The `post_processing` chain for the time-series family, in the order Superset
 * itself applies it: pivot → rolling/cum → compare → resample → contribution →
 * flatten. Every step is optional; with all analytics off it is just
 * pivot + flatten, which is what turns long rows into one column per series.
 */
export function timeSeriesPostProcessing(s: BuilderState): PostProcessingOp[] {
  const ops: PostProcessingOp[] = []
  const labels = s.metrics.map(metricLabel)
  const shift = s.ts.comparisonShift
  const comparing = !!shift
  const allLabels = comparing ? [...labels, ...labels.map((l) => shiftedLabel(l, shift))] : labels

  ops.push({
    operation: 'pivot',
    options: {
      index: [xAxisLabel(s)],
      columns: [...s.dimensions],
      aggregates: Object.fromEntries(allLabels.map((l) => [l, { operator: 'mean' }])),
      drop_missing_columns: false,
    },
  })

  // `rolling` and `cum` run on the pivoted frame, whose columns are a MultiIndex
  // keyed by metric label. Both take a source -> target `columns` map naming the
  // metrics to operate on (the shifted labels too, when comparing). The older
  // `is_pivot_df: true` shorthand no longer exists — passing it raises
  // "rolling() got an unexpected keyword argument 'is_pivot_df'".
  const rollingColumns = Object.fromEntries(allLabels.map((l) => [l, l]))

  if (s.ts.rollingType === 'cumsum') {
    ops.push({ operation: 'cum', options: { operator: 'sum', columns: rollingColumns } })
  } else if (s.ts.rollingType !== 'None') {
    ops.push({
      operation: 'rolling',
      options: {
        rolling_type: s.ts.rollingType,
        window: Math.max(1, s.ts.rollingPeriods),
        min_periods: Math.max(0, s.ts.minPeriods),
        columns: rollingColumns,
      },
    })
  }

  if (comparing && s.ts.comparisonType !== 'values') {
    ops.push({
      operation: 'compare',
      options: {
        source_columns: labels,
        compare_columns: labels.map((l) => shiftedLabel(l, shift)),
        compare_type: s.ts.comparisonType,
        drop_original_columns: true,
      },
    })
  }

  if (s.ts.resampleRule) {
    const zerofill = s.ts.resampleMethod === 'zerofill'
    ops.push({
      operation: 'resample',
      options: {
        rule: s.ts.resampleRule,
        method: zerofill ? 'asfreq' : s.ts.resampleMethod,
        fill_value: zerofill ? 0 : null,
      },
    })
  }

  if (s.ts.contributionMode) {
    ops.push({ operation: 'contribution', options: { orientation: s.ts.contributionMode } })
  }

  ops.push({ operation: 'flatten' })
  return ops
}

function timeSeriesQuery(s: BuilderState): QueryObject {
  if (!s.xAxis) throw new Error('Pick an x-axis column for the time-series')
  if (!s.metrics.length) throw new Error('A time-series needs at least one metric')

  const metrics = s.metrics.map(toSupersetMetric)
  const columns: QueryColumn[] = [baseAxisColumn(s), ...s.dimensions]
  const filters = s.filters.filter((f) => f.col).map(toSupersetFilter)
  const timeRange = s.timeRange || 'No filter'
  // A time shift needs both ends of the window to line the offset series up, so
  // Superset rejects a comparison over an open range ("An enclosed time range
  // (both start and end) must be specified when using a Time Comparison").
  // Every other range in TIME_RANGES is enclosed; only 'No filter' is not.
  if (s.ts.comparisonShift && timeRange === 'No filter') {
    throw new Error('Pick a time range other than "No filter" to compare against a time shift')
  }
  filters.push({ col: s.xAxis, op: 'TEMPORAL_RANGE', val: timeRange })

  const q: QueryObject = {
    columns,
    metrics,
    filters,
    row_limit: s.rowLimit,
    order_desc: s.orderDesc,
    // No `is_timeseries` here on purpose. The x-axis arrives as a BASE_AXIS
    // adhoc column in `columns` (plus `time_grain_sqla`), which is the modern
    // generic-axis path. `is_timeseries` is the *legacy* flag, and Superset
    // pairs it with a `granularity`: models/helpers.py rejects the query with
    // "Datetime column not provided as part table configuration" when it is set
    // without one, and nothing back-fills it from the dataset's main_dttm_col.
    series_columns: [...s.dimensions],
    extras: { time_grain_sqla: s.timeGrain || undefined, where: '', having: '' },
    post_processing: timeSeriesPostProcessing(s),
    annotation_layers: [],
  }
  if (s.ts.comparisonShift) q.time_offsets = [s.ts.comparisonShift]
  if (s.seriesLimit > 0) {
    q.series_limit = s.seriesLimit
    const limitMetric = s.seriesLimitMetric ?? s.metrics[0]
    q.series_limit_metric = toSupersetMetric(limitMetric)
    q.orderby = [[toSupersetMetric(limitMetric), !s.orderDesc]]
  }
  return q
}

function scatterQuery(s: BuilderState): QueryObject {
  const o = s.scatter
  if (!o.xMetric || !o.yMetric) throw new Error('Scatter needs both an X and a Y metric')
  const metrics = activeMetrics(s).map(toSupersetMetric)
  // Entity and series may name the same column — Superset rejects duplicates.
  const columns = [...new Set([o.entity, o.series].filter(Boolean))]
  const q: QueryObject = {
    columns,
    metrics,
    filters: s.filters.filter((f) => f.col).map(toSupersetFilter),
    row_limit: s.rowLimit,
    order_desc: s.orderDesc,
    orderby: [[toSupersetMetric(o.sizeMetric ?? o.yMetric), !s.orderDesc]],
  }
  return q
}

/**
 * Histogram fetches the raw column (plus an optional group column) and bins in
 * the browser. That is what Superset's own histogram did for years, and it keeps
 * us off the `histogram` post-processing operator, which only exists on newer
 * Superset versions — so this works against any instance the backend can reach.
 */
function histogramQuery(s: BuilderState): QueryObject {
  const o = s.histogram
  if (!o.column) throw new Error('Pick a column to build the histogram from')
  return {
    columns: [...new Set([o.column, ...(o.groupby ? [o.groupby] : [])])],
    metrics: [],
    filters: s.filters.filter((f) => f.col).map(toSupersetFilter),
    row_limit: s.rowLimit,
    order_desc: false,
  }
}

function treeQuery(s: BuilderState): QueryObject {
  const o = s.tree
  if (!o.idColumn || !o.parentColumn) throw new Error('Tree needs an id column and a parent column')
  const cols = [o.idColumn, o.parentColumn, o.nameColumn].filter(Boolean)
  const columns = [...new Set(cols)]
  const metrics = o.metric ? [toSupersetMetric(o.metric)] : []
  const q: QueryObject = {
    columns,
    metrics,
    filters: s.filters.filter((f) => f.col).map(toSupersetFilter),
    row_limit: s.rowLimit,
    order_desc: s.orderDesc,
  }
  if (metrics.length) q.orderby = [[metrics[0], !s.orderDesc]]
  return q
}

/**
 * How many dimensions a categorical viz consumes, and what they stand for.
 * The builder panel labels its column picker from this, and `categoricalQuery`
 * refuses to run without the minimum — so a half-configured chart says what it
 * is missing instead of failing inside Superset.
 */
export interface DimensionSpec {
  min: number
  max: number
  label: string
  hint: string
  /** Shown as the Run blocker while the minimum isn't met. */
  missing: string
}

const DEFAULT_DIMENSION_SPEC: DimensionSpec = {
  min: 1,
  max: 1,
  label: 'Dimension (group by)',
  hint: 'One category per value of this column.',
  missing: 'Pick a dimension to group by',
}

const DIMENSION_SPECS: Partial<Record<VizType, DimensionSpec>> = {
  heatmap_v2: {
    min: 2,
    max: 2,
    label: 'X and Y dimensions',
    hint: 'The first is the x-axis, the second the y-axis; the metric colours each cell.',
    missing: 'Heatmap needs two dimensions — one per axis',
  },
  sankey_v2: {
    min: 2,
    max: 2,
    label: 'Source and target',
    hint: 'The first dimension is the source node, the second the target; the metric is the flow.',
    missing: 'Sankey needs two dimensions — source and target',
  },
  graph_chart: {
    min: 2,
    max: 2,
    label: 'Source and target',
    hint: 'Nodes are the values of both columns; the metric weighs each edge.',
    missing: 'A graph needs two dimensions — source and target',
  },
  pivot_table_v2: {
    min: 1,
    max: 2,
    label: 'Rows and columns',
    hint: 'The first dimension becomes the rows, the second the columns.',
    missing: 'Pick at least one dimension for the rows',
  },
  treemap_v2: {
    min: 1,
    max: 3,
    label: 'Hierarchy (outer → inner)',
    hint: 'Each dimension nests inside the one before it.',
    missing: 'Pick at least one dimension',
  },
  sunburst_v2: {
    min: 1,
    max: 3,
    label: 'Hierarchy (inner → outer)',
    hint: 'The first dimension is the inner ring, each next one wraps around it.',
    missing: 'Pick at least one dimension',
  },
  radar: {
    min: 1,
    max: 1,
    label: 'Group',
    hint: 'One polygon per value of this column; every metric is an axis.',
    missing: 'Pick the dimension each radar polygon stands for',
  },
  word_cloud: {
    min: 1,
    max: 1,
    label: 'Term',
    hint: 'Each value becomes a word, sized by the metric.',
    missing: 'Pick the column the words come from',
  },
  table: {
    min: 0,
    max: 8,
    label: 'Dimensions (group by)',
    hint: 'With no metrics at all the table returns raw records.',
    missing: '',
  },
  gauge_chart: { min: 0, max: 0, label: '', hint: '', missing: '' },
  big_number: { min: 0, max: 0, label: '', hint: '', missing: '' },
}

/** The dimension contract of a viz type (categorical family; safe for any key). */
export function dimensionSpec(v: string): DimensionSpec {
  return DIMENSION_SPECS[v as VizType] ?? DEFAULT_DIMENSION_SPEC
}

function categoricalQuery(s: BuilderState): QueryObject {
  const spec = dimensionSpec(s.vizType)
  const dimensions = s.dimensions.slice(0, spec.max)
  if (dimensions.length < spec.min) throw new Error(spec.missing)

  const isRawTable = s.vizType === 'table' && s.metrics.length === 0
  if (!isRawTable && !s.metrics.length) throw new Error('Add at least one metric')
  if (s.vizType === 'radar' && s.metrics.length < 2) {
    throw new Error('A radar chart needs at least two metrics — one per axis')
  }

  const metrics = isRawTable ? [] : s.metrics.map(toSupersetMetric)
  const q: QueryObject = {
    columns: dimensions,
    metrics,
    filters: s.filters.filter((f) => f.col).map(toSupersetFilter),
    row_limit: s.rowLimit,
    order_desc: s.orderDesc,
  }
  if (metrics.length > 0) q.orderby = [[metrics[0], !s.orderDesc]]
  return q
}

/** The `form_data` mirror of the state — advisory for `result_type: full`, but
 *  Superset logs and caches on it, and it keeps the payload self-describing. */
function formData(s: BuilderState): Record<string, unknown> {
  const base: Record<string, unknown> = {
    datasource: `${s.datasetId}__table`,
    viz_type: s.vizType,
    row_limit: s.rowLimit,
  }
  const engine = vizEngine(s.vizType)
  if (engine === 'timeseries') {
    return {
      ...base,
      x_axis: s.xAxis,
      time_grain_sqla: s.timeGrain || undefined,
      time_range: s.timeRange,
      metrics: s.metrics.map(metricLabel),
      groupby: s.dimensions,
      seriesType: s.ts.seriesStyle,
      contributionMode: s.ts.contributionMode || undefined,
      rolling_type: s.ts.rollingType,
      time_compare: s.ts.comparisonShift ? [s.ts.comparisonShift] : [],
      comparison_type: s.ts.comparisonType,
    }
  }
  if (engine === 'scatter') {
    return {
      ...base,
      x: s.scatter.xMetric ? metricLabel(s.scatter.xMetric) : undefined,
      y: s.scatter.yMetric ? metricLabel(s.scatter.yMetric) : undefined,
      size: s.scatter.sizeMetric ? metricLabel(s.scatter.sizeMetric) : undefined,
      entity: s.scatter.entity || undefined,
      series: s.scatter.series || undefined,
    }
  }
  if (engine === 'histogram') {
    return { ...base, column: s.histogram.column, bins: s.histogram.bins, groupby: s.histogram.groupby || undefined }
  }
  if (engine === 'tree') {
    return {
      ...base,
      id: s.tree.idColumn,
      parent: s.tree.parentColumn,
      name: s.tree.nameColumn || undefined,
      metric: s.tree.metric ? metricLabel(s.tree.metric) : undefined,
    }
  }
  return { ...base, groupby: s.dimensions, metrics: s.metrics.map(metricLabel) }
}

/** Translate builder state into the query_context POSTed to /api/v1/chart/data. */
export function buildQueryContext(state: BuilderState): QueryContext {
  const s = normalizeState(state)
  if (s.datasetId == null) throw new Error('Pick a dataset first')

  let query: QueryObject
  switch (vizEngine(s.vizType)) {
    case 'timeseries':
      query = timeSeriesQuery(s)
      break
    case 'scatter':
      query = scatterQuery(s)
      break
    case 'histogram':
      query = histogramQuery(s)
      break
    case 'tree':
      query = treeQuery(s)
      break
    default:
      query = categoricalQuery(s)
  }

  return {
    datasource: { id: s.datasetId, type: 'table' },
    force: false,
    queries: [query],
    form_data: formData(s),
    result_format: 'json',
    result_type: 'full',
  }
}

// ---- dataset-aware defaults -------------------------------------------------
// Picking a chart type should never leave the panel empty: these fill in the
// controls a family needs from what the dataset actually offers, the way
// Superset seeds its controls from the datasource.

const NUMERIC_TYPES = /^(BIG|SMALL|TINY)?INT|^INTEGER|^NUMERIC|^DECIMAL|^DOUBLE|^FLOAT|^REAL|^NUMBER|^LONG/i

export function isNumericColumn(c: DatasetColumn): boolean {
  return !c.is_dttm && !!c.type && NUMERIC_TYPES.test(c.type)
}

export function temporalColumns(cols: DatasetColumn[]): DatasetColumn[] {
  return cols.filter((c) => c.is_dttm)
}

/** The series style each time-series catalogue key starts out with. */
const SERIES_STYLE_OF: Partial<Record<VizType, SeriesStyle>> = {
  timeseries: 'line',
  timeseries_bar: 'bar',
  timeseries_area: 'area',
  timeseries_step: 'step',
  timeseries_scatter: 'scatter',
  timeseries_smooth: 'line',
  big_number_trendline: 'line',
}

/** Seed the controls a newly-picked viz type needs. Mutates `s` in place. */
export function applyVizDefaults(s: BuilderState, cols: DatasetColumn[]): void {
  const numeric = cols.filter(isNumericColumn)
  const groupable = cols.filter((c) => c.groupby !== false)

  switch (vizEngine(s.vizType)) {
    case 'timeseries': {
      const style = SERIES_STYLE_OF[s.vizType]
      if (style) s.ts.seriesStyle = style
      // The two headline variants of the line engine: one smoothed, one reduced
      // to a single figure with its history behind it.
      if (s.vizType === 'timeseries_smooth') s.ts.smooth = true
      if (s.vizType === 'timeseries_step') s.ts.smooth = false
      if (s.vizType === 'big_number_trendline') {
        s.dimensions = []
        s.metrics = s.metrics.slice(0, 1)
      }
      if (!s.xAxis) s.xAxis = temporalColumns(cols)[0]?.column_name ?? cols[0]?.column_name ?? ''
      if (!s.metrics.length) s.metrics = [countMetric()]
      break
    }
    case 'scatter': {
      if (!s.scatter.xMetric) s.scatter.xMetric = numeric[0] ? simpleMetric(numeric[0].column_name, 'AVG') : countMetric()
      if (!s.scatter.yMetric) {
        s.scatter.yMetric = numeric[1]
          ? simpleMetric(numeric[1].column_name, 'AVG')
          : numeric[0]
            ? simpleMetric(numeric[0].column_name, 'SUM')
            : countMetric()
      }
      if (s.vizType === 'bubble' && !s.scatter.sizeMetric) s.scatter.sizeMetric = countMetric()
      if (!s.scatter.entity) {
        const label = groupable.find((c) => !c.is_dttm) ?? groupable[0]
        s.scatter.entity = label?.column_name ?? ''
      }
      break
    }
    case 'histogram': {
      if (!s.histogram.column) s.histogram.column = numeric[0]?.column_name ?? cols[0]?.column_name ?? ''
      break
    }
    case 'tree': {
      const guess = (re: RegExp) => groupable.find((c) => re.test(c.column_name))?.column_name ?? ''
      if (!s.tree.idColumn) s.tree.idColumn = guess(/(^|_)id$/i) || groupable[0]?.column_name || ''
      if (!s.tree.parentColumn) s.tree.parentColumn = guess(/parent/i) || groupable[1]?.column_name || ''
      if (!s.tree.nameColumn) s.tree.nameColumn = guess(/name|title|label/i)
      break
    }
    default: {
      // Fill the dimension picker up to what the type needs, and trim what it
      // can't use, so switching bar → sankey → gauge always lands runnable.
      const spec = dimensionSpec(s.vizType)
      if (s.dimensions.length > spec.max) s.dimensions = s.dimensions.slice(0, spec.max)
      for (const c of groupable) {
        if (s.dimensions.length >= spec.min) break
        if (!s.dimensions.includes(c.column_name)) s.dimensions.push(c.column_name)
      }
      if (!s.metrics.length) s.metrics = [countMetric()]
      // A radar axis per metric — one metric draws a line, not a web. With no
      // numeric column to offer, leave it: the query blocker explains the gap.
      if (s.vizType === 'radar' && s.metrics.length < 2 && numeric.length) {
        const used = new Set(s.metrics.map(metricLabel))
        const next = numeric.map((c) => simpleMetric(c.column_name, 'AVG')).find((m) => !used.has(metricLabel(m)))
        if (next) s.metrics.push(next)
      }
    }
  }
}

/** The viz type to open a freshly-picked dataset with. */
export function defaultVizFor(cols: DatasetColumn[]): VizType {
  return temporalColumns(cols).length ? 'timeseries' : 'bar'
}
