// Transform a Superset /chart/data result into an Apache ECharts `option`.
// This is the same job Superset's own `transformProps.ts` does; the entry point
// dispatches on viz type, with one module per chart family under ./viz.
// (See SUPERSET-INTEGRATION-STUDY.md §2 — reuse strategy A.)

import type { ChartDataResult } from '@/api/types'
import { normalizeState, vizEngine, type BuilderState } from './builder'
import { PALETTE, type RenderModel } from './viz/common'
import { boxPlotModel } from './viz/boxplot'
import { categoricalModel } from './viz/categorical'
import { histogramModel } from './viz/histogram'
import { scatterModel } from './viz/scatter'
import { timeSeriesModel } from './viz/timeseries'
import { treeModel } from './viz/tree'

export { PALETTE }
export type { RenderModel }

export function toRenderModel(rawState: BuilderState, result: ChartDataResult): RenderModel {
  const state = normalizeState(rawState)
  const rows = result.data ?? []
  if (!rows.length) return { kind: 'empty' }

  switch (vizEngine(state.vizType)) {
    case 'timeseries':
      return timeSeriesModel(state, result)
    case 'scatter':
      return scatterModel(state, result)
    case 'histogram':
      // The distribution engine fetches raw values; what it draws with them
      // differs — bins for the histogram, quartiles for the box plot.
      return state.vizType === 'box_plot' ? boxPlotModel(state, result) : histogramModel(state, result)
    case 'tree':
      return treeModel(state, result)
    default:
      return categoricalModel(state, result)
  }
}
