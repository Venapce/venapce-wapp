// The chart-type catalogue.
//
// Superset's viz registry lives in its *frontend* (each plugin registers itself
// at build time) — there is no REST endpoint that enumerates it, so this module
// mirrors the registry instead: every type Superset ships, with its real
// `viz_type` key, category and deprecation status.
//
// `supported: true` means Venapce renders it natively (lib/viz/*). The rest are
// listed so the picker shows the whole landscape — and so adding one later is a
// matter of writing its engine, not rediscovering the catalogue.
//
// `icon` names a glyph in lib/icons.ts — one small drawing of the chart itself,
// which is what the picker tiles and the dialog cards show.

import { isSupportedViz, type VizType } from './builder'

export type VizCategory =
  | 'Popular'
  | 'Evolution'
  | 'Correlation'
  | 'Distribution'
  | 'Flow'
  | 'KPI'
  | 'Map'
  | 'Part of a Whole'
  | 'Ranking'
  | 'Statistical'
  | 'Table'
  | 'Text'

export interface VizCatalogEntry {
  /** The key stored in `BuilderState.vizType` (and in a saved chart's `vizType`). */
  key: string
  name: string
  category: VizCategory
  /** A glyph name from lib/icons.ts. */
  icon: string
  description: string
  /** The `viz_type` Superset itself uses for this chart. */
  supersetKey: string
  /** Superset marks these as legacy — kept visible, flagged, never recommended. */
  deprecated?: boolean
  /** Extra search terms. */
  tags?: string[]
}

const entries: VizCatalogEntry[] = [
  // ---- natively supported: evolution ---------------------------------------
  {
    key: 'timeseries',
    name: 'Time-series Line',
    category: 'Evolution',
    icon: 'chartLine',
    supersetKey: 'echarts_timeseries_line',
    description: 'Metrics over a temporal axis, with time grain, series breakdown and advanced analytics.',
    tags: ['line', 'time', 'trend'],
  },
  {
    key: 'timeseries_bar',
    name: 'Time-series Bar',
    category: 'Evolution',
    icon: 'chartBar',
    supersetKey: 'echarts_timeseries_bar',
    description: 'The time-series engine drawn as bars — stack them to compare composition over time.',
    tags: ['bar', 'column', 'time'],
  },
  {
    key: 'timeseries_area',
    name: 'Time-series Area',
    category: 'Evolution',
    icon: 'chartArea',
    supersetKey: 'echarts_area',
    description: 'Filled time-series, stacked or overlaid — good for share-of-total over time.',
    tags: ['area', 'stacked', 'time'],
  },
  {
    key: 'timeseries_step',
    name: 'Stepped Line',
    category: 'Evolution',
    icon: 'chartStep',
    supersetKey: 'echarts_timeseries_step',
    description: 'Time-series where the value holds until it changes — states, counters, gauges.',
    tags: ['step', 'state', 'time'],
  },
  {
    key: 'timeseries_smooth',
    name: 'Smooth Line',
    category: 'Evolution',
    icon: 'chartSmooth',
    supersetKey: 'echarts_timeseries_smooth',
    description: 'The time-series line with its curves smoothed — trends over noisy sampling.',
    tags: ['smooth', 'curve', 'time'],
  },
  {
    key: 'timeseries_scatter',
    name: 'Time-series Scatter',
    category: 'Evolution',
    icon: 'chartScatter',
    supersetKey: 'echarts_timeseries_scatter',
    description: 'Individual points over time, with no line joining them — sparse or event-like series.',
    tags: ['scatter', 'points', 'time'],
  },
  {
    key: 'waterfall',
    name: 'Waterfall Chart',
    category: 'Evolution',
    icon: 'chartWaterfall',
    supersetKey: 'waterfall',
    description: 'Sequential positive and negative contributions, closing on the running total.',
    tags: ['bridge', 'delta', 'contribution'],
  },

  // ---- natively supported: correlation & distribution ----------------------
  {
    key: 'scatter',
    name: 'Scatter Plot',
    category: 'Correlation',
    icon: 'chartScatter',
    supersetKey: 'echarts_timeseries_scatter',
    description: 'One metric against another, coloured by a dimension, with an optional trend line.',
    tags: ['correlation', 'xy', 'regression'],
  },
  {
    key: 'bubble',
    name: 'Bubble Chart',
    category: 'Correlation',
    icon: 'chartBubble',
    supersetKey: 'bubble_v2',
    description: 'A scatter plot whose points are sized by a third metric.',
    tags: ['bubble', 'size', 'correlation'],
  },
  {
    key: 'heatmap_v2',
    name: 'Heatmap',
    category: 'Correlation',
    icon: 'chartHeatmap',
    supersetKey: 'heatmap_v2',
    description: 'A metric across two dimensions, each cell coloured by magnitude.',
    tags: ['matrix', 'density', 'cross'],
  },
  {
    key: 'histogram',
    name: 'Histogram',
    category: 'Distribution',
    icon: 'chartHistogram',
    supersetKey: 'histogram',
    description: 'The distribution of a numeric column, binned — per group, normalised or cumulative.',
    tags: ['distribution', 'bins', 'frequency'],
  },
  {
    key: 'box_plot',
    name: 'Box Plot',
    category: 'Distribution',
    icon: 'chartBoxplot',
    supersetKey: 'box_plot',
    description: 'Quartiles, 1.5·IQR whiskers and outliers, per group.',
    tags: ['quartile', 'median', 'outlier', 'iqr'],
  },

  // ---- natively supported: flow & hierarchy --------------------------------
  {
    key: 'tree',
    name: 'Tree Chart',
    category: 'Flow',
    icon: 'chartTree',
    supersetKey: 'tree_chart',
    description: 'A parent/child hierarchy, orthogonal or radial, expandable node by node.',
    tags: ['hierarchy', 'parent', 'org'],
  },
  {
    key: 'sankey_v2',
    name: 'Sankey Diagram',
    category: 'Flow',
    icon: 'chartSankey',
    supersetKey: 'sankey_v2',
    description: 'Flow volumes between a source and a target dimension, sized by the metric.',
    tags: ['flow', 'source', 'target'],
  },
  {
    key: 'graph_chart',
    name: 'Graph Chart',
    category: 'Flow',
    icon: 'chartGraph',
    supersetKey: 'graph_chart',
    description: 'A force-directed network of nodes and edges, weighted by the metric.',
    tags: ['network', 'force', 'nodes', 'edges'],
  },

  // ---- natively supported: part of a whole ---------------------------------
  {
    key: 'pie',
    name: 'Pie Chart',
    category: 'Part of a Whole',
    icon: 'chartPie',
    supersetKey: 'pie',
    description: 'One metric split across a dimension, as a pie or a donut.',
    tags: ['donut', 'share'],
  },
  {
    key: 'rose',
    name: 'Nightingale Rose',
    category: 'Part of a Whole',
    icon: 'chartRose',
    supersetKey: 'rose',
    description: 'A pie whose slices vary in radius rather than angle.',
    tags: ['polar', 'nightingale', 'share'],
  },
  {
    key: 'funnel',
    name: 'Funnel Chart',
    category: 'Part of a Whole',
    icon: 'chartFunnel',
    supersetKey: 'funnel',
    description: 'Stage-by-stage drop-off, ordered from the widest stage down.',
    tags: ['stages', 'conversion', 'drop-off'],
  },
  {
    key: 'treemap_v2',
    name: 'Treemap',
    category: 'Part of a Whole',
    icon: 'chartTreemap',
    supersetKey: 'treemap_v2',
    description: 'Nested rectangles sized by a metric — up to three dimensions deep.',
    tags: ['nested', 'hierarchy', 'area'],
  },
  {
    key: 'sunburst_v2',
    name: 'Sunburst Chart',
    category: 'Part of a Whole',
    icon: 'chartSunburst',
    supersetKey: 'sunburst_v2',
    description: 'Nested rings for a hierarchy of dimensions, inner ring outward.',
    tags: ['nested', 'hierarchy', 'radial'],
  },

  // ---- natively supported: ranking -----------------------------------------
  {
    key: 'bar',
    name: 'Bar Chart',
    category: 'Ranking',
    icon: 'chartBar',
    supersetKey: 'echarts_timeseries_bar',
    description: 'Categorical bars, one series per metric — vertical or horizontal, stacked or not.',
    tags: ['category', 'column'],
  },
  {
    key: 'line',
    name: 'Line Chart',
    category: 'Evolution',
    icon: 'chartLine',
    supersetKey: 'echarts_timeseries_line',
    description: 'A line over a categorical axis, one series per metric.',
    tags: ['category'],
  },
  {
    key: 'area',
    name: 'Area Chart',
    category: 'Evolution',
    icon: 'chartArea',
    supersetKey: 'echarts_area',
    description: 'Stacked area over a categorical axis.',
    tags: ['stacked'],
  },
  {
    key: 'radar',
    name: 'Radar Chart',
    category: 'Ranking',
    icon: 'chartRadar',
    supersetKey: 'radar',
    description: 'Several metrics per group on a spider web — one axis per metric.',
    tags: ['spider', 'web', 'multivariate'],
  },
  {
    key: 'word_cloud',
    name: 'Word Cloud',
    category: 'Ranking',
    icon: 'chartWordCloud',
    supersetKey: 'word_cloud',
    description: 'Terms sized by a metric.',
    tags: ['terms', 'tags', 'text'],
  },

  // ---- natively supported: KPI & tables ------------------------------------
  {
    key: 'big_number',
    name: 'Big Number',
    category: 'KPI',
    icon: 'chartBigNumber',
    supersetKey: 'big_number_total',
    description: 'A single headline metric.',
    tags: ['kpi', 'metric', 'total'],
  },
  {
    key: 'big_number_trendline',
    name: 'Big Number with Trendline',
    category: 'KPI',
    icon: 'chartTrendline',
    supersetKey: 'big_number',
    description: 'The latest value of a time-series as a headline, with its history behind it.',
    tags: ['kpi', 'sparkline', 'trend'],
  },
  {
    key: 'gauge_chart',
    name: 'Gauge Chart',
    category: 'KPI',
    icon: 'chartGauge',
    supersetKey: 'gauge_chart',
    description: 'One metric against a range, as a dial.',
    tags: ['kpi', 'dial', 'target'],
  },
  {
    key: 'table',
    name: 'Table',
    category: 'Table',
    icon: 'chartTable',
    supersetKey: 'table',
    description: 'Raw records or an aggregate grid — the most flexible way to read a dataset.',
    tags: ['grid', 'records'],
  },
  {
    key: 'pivot_table_v2',
    name: 'Pivot Table',
    category: 'Table',
    icon: 'chartPivot',
    supersetKey: 'pivot_table_v2',
    description: 'Two dimensions cross-tabulated, with a total per row.',
    tags: ['cross-tab', 'grid', 'matrix'],
  },

  // ---- catalogued, not yet rendered natively --------------------------------
  { key: 'mixed_timeseries', name: 'Mixed Chart', category: 'Evolution', icon: 'chartMixed', supersetKey: 'mixed_timeseries', description: 'Two queries on one temporal axis — e.g. bars plus a line.' },
  { key: 'compare', name: 'Time-series Percent Change', category: 'Evolution', icon: 'chartPercent', supersetKey: 'compare', description: 'Each series as a percentage change from its first value.' },
  { key: 'time_pivot', name: 'Time-series Period Pivot', category: 'Evolution', icon: 'chartClock', supersetKey: 'time_pivot', description: 'One line per period, overlaid to compare cycles.' },
  { key: 'horizon', name: 'Horizon Chart', category: 'Evolution', icon: 'chartHorizon', supersetKey: 'horizon', description: 'Many series in little vertical space, using banded colour.' },
  { key: 'cal_heatmap', name: 'Calendar Heatmap', category: 'Distribution', icon: 'chartCalendar', supersetKey: 'cal_heatmap', description: 'A value per day laid out as a calendar.' },
  { key: 'time_table', name: 'Time-series Table', category: 'Table', icon: 'chartTimeTable', supersetKey: 'time_table', description: 'Metrics with inline sparklines and period comparisons.' },
  { key: 'parallel_coordinates', name: 'Parallel Coordinates', category: 'Correlation', icon: 'chartParallel', supersetKey: 'para', description: 'Each record as a line crossing several metric axes.' },
  { key: 'heatmap', name: 'Heatmap (legacy)', category: 'Correlation', icon: 'chartHeatmap', supersetKey: 'heatmap', description: 'The pre-ECharts heatmap.', deprecated: true },
  { key: 'partition', name: 'Partition Chart', category: 'Part of a Whole', icon: 'chartPartition', supersetKey: 'partition', description: 'Hierarchical partitions of a total.' },
  { key: 'sunburst', name: 'Sunburst (legacy)', category: 'Part of a Whole', icon: 'chartSunburst', supersetKey: 'sunburst', description: 'The pre-ECharts sunburst.', deprecated: true },
  { key: 'treemap', name: 'Treemap (legacy)', category: 'Part of a Whole', icon: 'chartTreemap', supersetKey: 'treemap', description: 'The pre-ECharts treemap.', deprecated: true },
  { key: 'chord', name: 'Chord Diagram', category: 'Flow', icon: 'chartChord', supersetKey: 'chord', description: 'Circular flows between categories.', deprecated: true },
  { key: 'sankey', name: 'Sankey (legacy)', category: 'Flow', icon: 'chartSankey', supersetKey: 'sankey', description: 'The pre-ECharts sankey.', deprecated: true },
  { key: 'event_flow', name: 'Event Flow', category: 'Flow', icon: 'chartEventFlow', supersetKey: 'event_flow', description: 'Event sequences per entity over time.', deprecated: true },
  { key: 'pop_kpi', name: 'Big Number with Time Comparison', category: 'KPI', icon: 'chartCompare', supersetKey: 'pop_kpi', description: 'A headline metric against the same period previously.' },
  { key: 'bullet', name: 'Bullet Chart', category: 'KPI', icon: 'chartBullet', supersetKey: 'bullet', description: 'A metric against target and qualitative ranges.', deprecated: true },
  { key: 'pivot_table', name: 'Pivot Table (legacy)', category: 'Table', icon: 'chartPivot', supersetKey: 'pivot_table', description: 'The pre-v2 pivot table.', deprecated: true },
  { key: 'dist_bar', name: 'Bar Chart (legacy)', category: 'Ranking', icon: 'chartBar', supersetKey: 'dist_bar', description: 'The pre-ECharts distribution bar chart.', deprecated: true },
  { key: 'nvd3_line', name: 'Line Chart (legacy)', category: 'Evolution', icon: 'chartLine', supersetKey: 'line', description: 'The pre-ECharts NVD3 line chart.', deprecated: true },
  { key: 'nvd3_area', name: 'Area Chart (legacy)', category: 'Evolution', icon: 'chartArea', supersetKey: 'area', description: 'The pre-ECharts NVD3 area chart.', deprecated: true },
  { key: 'nvd3_bar', name: 'Time-series Bar (legacy)', category: 'Evolution', icon: 'chartBar', supersetKey: 'bar', description: 'The pre-ECharts NVD3 bar chart.', deprecated: true },
  { key: 'dual_line', name: 'Dual Axis Line (legacy)', category: 'Evolution', icon: 'chartMixed', supersetKey: 'dual_line', description: 'Two metrics on independent y-axes.', deprecated: true },
  { key: 'line_multi', name: 'Multiple Line Charts', category: 'Evolution', icon: 'chartLine', supersetKey: 'line_multi', description: 'Several line charts sharing one axis.', deprecated: true },
  { key: 'bubble_legacy', name: 'Bubble Chart (legacy)', category: 'Correlation', icon: 'chartBubble', supersetKey: 'bubble', description: 'The pre-ECharts bubble chart.', deprecated: true },
  { key: 'histogram_legacy', name: 'Histogram (legacy)', category: 'Distribution', icon: 'chartHistogram', supersetKey: 'histogram', description: 'The pre-ECharts histogram.', deprecated: true },
  { key: 'paired_ttest', name: 'Paired t-test Table', category: 'Statistical', icon: 'chartTtest', supersetKey: 'paired_ttest', description: 'Significance tests between groups.' },
  { key: 'world_map', name: 'World Map', category: 'Map', icon: 'chartWorldMap', supersetKey: 'world_map', description: 'A metric per country.' },
  { key: 'country_map', name: 'Country Map', category: 'Map', icon: 'chartCountryMap', supersetKey: 'country_map', description: 'A metric per region within one country.' },
  { key: 'deck_scatter', name: 'deck.gl Scatterplot', category: 'Map', icon: 'chartMapPin', supersetKey: 'deck_scatter', description: 'Geo points on a deck.gl map.' },
  { key: 'deck_grid', name: 'deck.gl Grid', category: 'Map', icon: 'chartMapGrid', supersetKey: 'deck_grid', description: 'Points aggregated into map grid cells.' },
  { key: 'deck_hex', name: 'deck.gl Hexagon', category: 'Map', icon: 'chartMapHex', supersetKey: 'deck_hex', description: 'Points aggregated into hexagonal bins.' },
  { key: 'deck_screengrid', name: 'deck.gl Screen Grid', category: 'Map', icon: 'chartMapGrid', supersetKey: 'deck_screengrid', description: 'Density in screen-space cells.' },
  { key: 'deck_path', name: 'deck.gl Path', category: 'Map', icon: 'chartMapPath', supersetKey: 'deck_path', description: 'Routes and traces on a map.' },
  { key: 'deck_polygon', name: 'deck.gl Polygon', category: 'Map', icon: 'chartMapPolygon', supersetKey: 'deck_polygon', description: 'Shaded regions on a map.' },
  { key: 'deck_arc', name: 'deck.gl Arc', category: 'Map', icon: 'chartMapArc', supersetKey: 'deck_arc', description: 'Origin/destination arcs.' },
  { key: 'deck_geojson', name: 'deck.gl GeoJSON', category: 'Map', icon: 'chartMapLayers', supersetKey: 'deck_geojson', description: 'Arbitrary GeoJSON layers.' },
  { key: 'deck_heatmap', name: 'deck.gl Heatmap', category: 'Map', icon: 'chartMapHeat', supersetKey: 'deck_heatmap', description: 'Geo density as a heat surface.' },
  { key: 'deck_contour', name: 'deck.gl Contour', category: 'Map', icon: 'chartMapContour', supersetKey: 'deck_contour', description: 'Density contour bands on a map.' },
  { key: 'deck_multi', name: 'deck.gl Multiple Layers', category: 'Map', icon: 'chartMapLayers', supersetKey: 'deck_multi', description: 'Several deck.gl layers on one map.' },
  { key: 'mapbox', name: 'MapBox', category: 'Map', icon: 'chartCountryMap', supersetKey: 'mapbox', description: 'The original MapBox cluster map.', deprecated: true },
  { key: 'markup', name: 'Markup', category: 'Text', icon: 'chartMarkup', supersetKey: 'markup', description: 'Free HTML/markdown on a dashboard.' },
  { key: 'separator', name: 'Separator', category: 'Text', icon: 'chartSeparator', supersetKey: 'separator', description: 'A titled divider between dashboard sections.' },
  { key: 'handlebars', name: 'Handlebars', category: 'Text', icon: 'chartBraces', supersetKey: 'handlebars', description: 'Rows rendered through a Handlebars template.' },
  { key: 'filter_box', name: 'Filter Box', category: 'Text', icon: 'chartFilterBox', supersetKey: 'filter_box', description: 'Superseded by native dashboard filters.', deprecated: true },
]

/** Every catalogue entry, with the "can we draw it" flag resolved. */
export const VIZ_CATALOG: Array<VizCatalogEntry & { supported: boolean }> = entries.map((e) => ({
  ...e,
  supported: isSupportedViz(e.key),
}))

/** The tiles shown inline in the builder — everything else lives in the dialog. */
export const POPULAR_VIZ: VizType[] = ['timeseries', 'bar', 'table', 'big_number', 'pie']

export const VIZ_CATEGORIES: VizCategory[] = [
  'Evolution',
  'Correlation',
  'Distribution',
  'Flow',
  'KPI',
  'Map',
  'Part of a Whole',
  'Ranking',
  'Statistical',
  'Table',
  'Text',
]

const byKey = new Map(VIZ_CATALOG.map((e) => [e.key, e]))

export function vizEntry(key: string): (VizCatalogEntry & { supported: boolean }) | undefined {
  return byKey.get(key)
}

export const vizName = (key: string): string => vizEntry(key)?.name ?? key

/** The glyph for a chart type — falls back to a generic chart, never to nothing. */
export const vizIcon = (key: string): string => vizEntry(key)?.icon ?? 'chartBar'

/** Free-text match over name, category, description and tags. */
export function matchesViz(entry: VizCatalogEntry, needle: string): boolean {
  if (!needle) return true
  const q = needle.trim().toLowerCase()
  return [entry.name, entry.category, entry.description, entry.key, entry.supersetKey, ...(entry.tags ?? [])]
    .join(' ')
    .toLowerCase()
    .includes(q)
}

export const SUPPORTED_COUNT = VIZ_CATALOG.filter((e) => e.supported).length
