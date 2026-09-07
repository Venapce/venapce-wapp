<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useConnectionStore } from '@/stores/connection'
import { apiErr } from '@/api/venapce'
import type { Chart, ChartDataResult, DatasetDetail, DatasetSummary } from '@/api/types'
import {
  FILTER_OPS,
  applyVizDefaults,
  buildQueryContext,
  countMetric,
  defaultVizFor,
  emptyBuilder,
  normalizeState,
  vizEngine,
  type MetricSpec,
  type VizType,
} from '@/lib/builder'
import { vizEntry } from '@/lib/vizCatalog'
import { toRenderModel } from '@/lib/echartsOption'
import ChartRenderer from '@/components/ChartRenderer.vue'
import Icon from '@/components/Icon.vue'
import VizTypePicker from '@/components/builder/VizTypePicker.vue'
import MetricEditor from '@/components/builder/MetricEditor.vue'
import ControlSection from '@/components/builder/ControlSection.vue'
import CategoricalControls from '@/components/builder/CategoricalControls.vue'
import TimeSeriesControls from '@/components/builder/TimeSeriesControls.vue'
import ScatterControls from '@/components/builder/ScatterControls.vue'
import HistogramControls from '@/components/builder/HistogramControls.vue'
import TreeControls from '@/components/builder/TreeControls.vue'
import SavedChartsDialog from '@/components/builder/SavedChartsDialog.vue'

const conn = useConnectionStore()
const client = computed(() => conn.client)
const route = useRoute()
const router = useRouter()

// Saved-chart state: title, the persisted id (null until first save), status.
const title = ref('')
const savedId = ref<number | null>(null)
const saving = ref(false)
const saveMsg = ref('')

// The saved-chart library: opened from the toolbar, where charts are also removed.
const charts = ref<Chart[]>([])
const showLibrary = ref(false)
const deletingId = ref<number | null>(null)
const libraryError = ref('')

const datasets = ref<DatasetSummary[]>([])
const detail = ref<DatasetDetail | null>(null)
const loadingDatasets = ref(false)
const loadingDetail = ref(false)

const state = reactive(emptyBuilder())

// The raw result is kept, so display-only controls (colours, formats, bins,
// tree layout…) re-render instantly and only query changes need a re-run.
const result = ref<ChartDataResult | null>(null)
const model = computed(() => (result.value ? toRenderModel(state, result.value) : null))
const running = ref(false)
const error = ref('')
const showQuery = ref(false)

const engine = computed(() => vizEngine(state.vizType))
const entry = computed(() => vizEntry(state.vizType))

// ---- columns / metrics available from the chosen dataset ----
const groupbyColumns = computed(() => (detail.value?.columns ?? []).filter((c) => c.groupby !== false))
const allColumns = computed(() => detail.value?.columns ?? [])
const savedMetrics = computed(() => detail.value?.metrics ?? [])

const queryContext = computed(() => {
  try {
    return state.datasetId != null ? buildQueryContext(state) : null
  } catch {
    return null
  }
})

/** Why the Run button is disabled, in the words of the control that's missing. */
const blocker = computed(() => {
  if (state.datasetId == null) return 'Pick a dataset'
  try {
    buildQueryContext(state)
    return ''
  } catch (e) {
    return (e as Error).message
  }
})

// ---- lifecycle ----
onMounted(async () => {
  await Promise.all([loadDatasets(), loadCharts()])
  const cid = Number(route.query.chartId)
  if (cid) await restoreChart(cid)
})

async function loadCharts() {
  try {
    charts.value = await client.value.listCharts()
  } catch (e) {
    libraryError.value = apiErr(e)
  }
}

// Load a saved chart back into the builder for editing (?chartId=…).
async function restoreChart(id: number) {
  try {
    const chart = await client.value.getChart(id)
    Object.assign(state, normalizeState(chart.builderState))
    title.value = chart.title
    savedId.value = chart.id
    saveMsg.value = ''
    if (state.datasetId != null) {
      loadingDetail.value = true
      detail.value = await client.value.dataset(state.datasetId)
      loadingDetail.value = false
      await run()
    }
  } catch (e) {
    error.value = errMsg(e)
  }
}

/** Open a chart from the library, keeping ?chartId= in step with the builder. */
async function openChart(chart: Chart) {
  showLibrary.value = false
  if (chart.id === savedId.value) return
  await restoreChart(chart.id)
  router.replace({ query: { ...route.query, chartId: String(chart.id) } })
}

/** Drop a saved chart. If it is the one on screen, the builder keeps the
 *  configuration but forgets the id — the next save creates a new chart. */
async function deleteChart(chart: Chart) {
  deletingId.value = chart.id
  libraryError.value = ''
  try {
    await client.value.deleteChart(chart.id)
    charts.value = charts.value.filter((c) => c.id !== chart.id)
    if (savedId.value === chart.id) {
      savedId.value = null
      saveMsg.value = 'Chart removed'
      const { chartId: _dropped, ...rest } = route.query
      router.replace({ query: rest })
    }
  } catch (e) {
    libraryError.value = apiErr(e)
  } finally {
    deletingId.value = null
  }
}

/** Start a fresh chart from the current dataset, leaving the saved one alone. */
function newChart() {
  savedId.value = null
  title.value = ''
  saveMsg.value = ''
  const { chartId: _dropped, ...rest } = route.query
  router.replace({ query: rest })
}

// Persist the current builder state as a native Venapce chart (create or update).
async function saveChart() {
  if (state.datasetId == null) {
    saveMsg.value = 'Pick a dataset first'
    return
  }
  saving.value = true
  saveMsg.value = ''
  try {
    const body = {
      title: title.value.trim() || `${detail.value?.table_name ?? 'chart'} · ${entry.value?.name ?? state.vizType}`,
      vizType: state.vizType,
      queryContext: buildQueryContext(state),
      builderState: JSON.parse(JSON.stringify(state)),
    }
    const chart = savedId.value
      ? await client.value.updateChart(savedId.value, body)
      : await client.value.createChart(body)
    savedId.value = chart.id
    title.value = chart.title
    saveMsg.value = 'Saved'
    // Keep the library in step so a fresh save is immediately removable there.
    const i = charts.value.findIndex((c) => c.id === chart.id)
    if (i === -1) charts.value.push(chart)
    else charts.value[i] = chart
  } catch (e) {
    saveMsg.value = apiErr(e)
  } finally {
    saving.value = false
  }
}

async function loadDatasets() {
  loadingDatasets.value = true
  try {
    datasets.value = await client.value.datasets()
  } catch (e) {
    error.value = errMsg(e)
  } finally {
    loadingDatasets.value = false
  }
}

async function selectDataset(id: number) {
  state.datasetId = id
  loadingDetail.value = true
  result.value = null
  error.value = ''
  try {
    detail.value = await client.value.dataset(id)
    // Reset the per-viz controls — they name columns of the previous dataset.
    Object.assign(state, {
      ...emptyBuilder(),
      datasetId: id,
      rowLimit: state.rowLimit,
      vizType: defaultVizFor(detail.value.columns),
    })
    state.metrics = [countMetric()]
    applyVizDefaults(state, detail.value.columns)
    await run()
  } catch (e) {
    error.value = errMsg(e)
  } finally {
    loadingDetail.value = false
  }
}

function selectViz(v: VizType) {
  state.vizType = v
  applyVizDefaults(state, allColumns.value)
  if (state.datasetId != null) run()
}

async function run() {
  if (state.datasetId == null) return
  running.value = true
  error.value = ''
  try {
    result.value = await client.value.chartData(buildQueryContext(state))
  } catch (e) {
    error.value = errMsg(e)
    result.value = null
  } finally {
    running.value = false
  }
}

// ---- metric helpers (the multi-metric families) ----
function addMetric() {
  const col = allColumns.value[0]?.column_name
  state.metrics.push(col ? { kind: 'simple', column: col, aggregate: 'SUM' } : countMetric())
}
function removeMetric(i: number) {
  state.metrics.splice(i, 1)
}
function setMetric(i: number, m: MetricSpec | null) {
  if (m) state.metrics[i] = m
  else removeMetric(i)
}

// ---- filter helpers ----
function addFilter() {
  state.filters.push({ col: allColumns.value[0]?.column_name ?? '', op: '==', val: '' })
}
function removeFilter(i: number) {
  state.filters.splice(i, 1)
}

function errMsg(e: unknown): string {
  const err = e as { response?: { data?: { message?: string } }; message?: string }
  return err.response?.data?.message ?? err.message ?? 'Query failed'
}
</script>

<template>
  <div class="grid h-full grid-cols-[340px_1fr]">
    <!-- ============ CONFIG PANEL ============ -->
    <section class="flex flex-col overflow-y-auto border-r border-line bg-surface">
      <header class="flex items-center gap-2 border-b border-line px-4 py-3">
        <div class="min-w-0">
          <h2 class="text-sm font-semibold text-fg">Chart Builder</h2>
          <p class="truncate text-xs text-fg-subtle">Live Superset data · rendered by ECharts</p>
        </div>
        <button class="icon-btn-sm ml-auto" title="Saved charts" @click="showLibrary = true">
          <Icon name="folder" :size="15" />
        </button>
        <button class="icon-btn-sm" title="New chart" :disabled="!savedId && !title" @click="newChart">
          <Icon name="plus" :size="15" />
        </button>
      </header>

      <div class="space-y-4 p-4">
        <!-- Dataset -->
        <div>
          <label class="label">Dataset</label>
          <select
            class="field"
            :value="state.datasetId ?? ''"
            :disabled="loadingDatasets"
            @change="selectDataset(Number(($event.target as HTMLSelectElement).value))"
          >
            <option value="" disabled>{{ loadingDatasets ? 'Loading…' : 'Select a dataset' }}</option>
            <option v-for="d in datasets" :key="d.id" :value="d.id">
              {{ d.table_name }}<template v-if="d.database"> · {{ d.database.database_name }}</template>
            </option>
          </select>
        </div>

        <template v-if="detail">
          <!-- Viz type: five tiles + the full catalogue dialog -->
          <VizTypePicker :model-value="state.vizType" @update:model-value="selectViz" />

          <!-- ---- per-family controls ---- -->
          <TimeSeriesControls
            v-if="engine === 'timeseries'"
            :state="state"
            :columns="allColumns"
            :groupby-columns="groupbyColumns"
            :saved-metrics="savedMetrics"
          />
          <ScatterControls
            v-else-if="engine === 'scatter'"
            :state="state"
            :columns="allColumns"
            :groupby-columns="groupbyColumns"
            :saved-metrics="savedMetrics"
          />
          <HistogramControls
            v-else-if="engine === 'histogram'"
            :state="state"
            :columns="allColumns"
            :groupby-columns="groupbyColumns"
          />
          <TreeControls
            v-else-if="engine === 'tree'"
            :state="state"
            :columns="allColumns"
            :groupby-columns="groupbyColumns"
            :saved-metrics="savedMetrics"
          />
          <CategoricalControls v-else :state="state" :groupby-columns="groupbyColumns" />

          <!-- Metrics — shared by the categorical and time-series families -->
          <div v-if="engine === 'categorical' || engine === 'timeseries'">
            <div class="mb-1 flex items-center justify-between">
              <label class="label mb-0">Metrics</label>
              <button class="icon-btn-sm" title="Add metric" @click="addMetric">
                <Icon name="plus" :size="14" />
              </button>
            </div>
            <div class="space-y-2">
              <div v-for="(m, i) in state.metrics" :key="i" class="relative">
                <MetricEditor
                  :model-value="m"
                  :columns="allColumns"
                  :saved-metrics="savedMetrics"
                  @update:model-value="setMetric(i, $event)"
                />
                <button
                  class="icon-btn-plain icon-btn--danger absolute right-1.5 top-1.5"
                  title="Remove metric"
                  @click="removeMetric(i)"
                >
                  <Icon name="trash" :size="14" />
                </button>
              </div>
              <p v-if="!state.metrics.length" class="text-xs text-fg-subtle">
                No metrics — a table will return raw records.
              </p>
            </div>
          </div>

          <!-- Filters -->
          <ControlSection title="Filters" :open="state.filters.length > 0">
            <button class="btn-sm btn-outline" @click="addFilter">
              <Icon name="filter" :size="13" />
              Add filter
            </button>
            <div class="space-y-2">
              <div v-for="(f, i) in state.filters" :key="i" class="flex items-center gap-1.5">
                <select v-model="f.col" class="field !py-1 !text-xs">
                  <option v-for="c in allColumns" :key="c.column_name" :value="c.column_name">
                    {{ c.column_name }}
                  </option>
                </select>
                <select v-model="f.op" class="field w-24 !py-1 !text-xs">
                  <option v-for="op in FILTER_OPS" :key="op" :value="op">{{ op }}</option>
                </select>
                <input
                  v-model="f.val"
                  class="field !py-1 !text-xs"
                  :disabled="f.op === 'IS NULL' || f.op === 'IS NOT NULL'"
                  placeholder="value"
                />
                <button class="icon-btn-plain icon-btn--danger" title="Remove filter" @click="removeFilter(i)">
                  <Icon name="trash" :size="14" />
                </button>
              </div>
            </div>
          </ControlSection>

          <!-- Row limit + order -->
          <div class="flex items-end gap-3">
            <div class="flex-1">
              <label class="label">Row limit</label>
              <input v-model.number="state.rowLimit" type="number" min="1" class="field tabular !py-1.5" />
            </div>
            <label class="flex items-center gap-2 pb-2 text-xs text-fg-muted">
              <input v-model="state.orderDesc" type="checkbox" class="rounded border-line-strong" />
              Order desc
            </label>
          </div>

          <div>
            <button class="btn-primary w-full" :disabled="running || !!blocker" @click="run">
              <Icon :name="running ? 'refresh' : 'play'" :size="15" :class="running ? 'animate-spin' : ''" />
              {{ running ? 'Running…' : 'Run query' }}
            </button>
            <p v-if="blocker" class="mt-1.5 flex items-center justify-center gap-1.5 text-[11px] text-warning">
              <Icon name="alert" :size="12" />
              {{ blocker }}
            </p>
          </div>
        </template>
      </div>
    </section>

    <!-- ============ PREVIEW ============ -->
    <section class="flex min-w-0 flex-col bg-bg">
      <header class="flex items-center gap-2.5 border-b border-line bg-surface px-5 py-2.5">
        <h3 class="text-sm font-semibold text-fg">Preview</h3>
        <span v-if="detail" class="chip-muted">
          <Icon name="database" :size="12" />
          {{ detail.table_name }}
        </span>
        <span v-if="entry" class="chip">
          <Icon :name="entry.icon" :size="13" />
          {{ entry.name }}
        </span>

        <div class="ml-auto flex items-center gap-2">
          <input v-model="title" class="field w-48 !py-1.5 !text-xs" placeholder="Chart title" />

          <button
            class="icon-btn icon-btn--primary"
            :title="savedId ? 'Update chart' : 'Save chart'"
            :disabled="saving || state.datasetId == null"
            @click="saveChart"
          >
            <Icon :name="saving ? 'refresh' : 'save'" :size="16" :class="saving ? 'animate-spin' : ''" />
          </button>
          <button class="icon-btn" title="Saved charts" @click="showLibrary = true">
            <Icon name="folder" :size="16" />
          </button>
          <button class="icon-btn" title="Re-run the query" :disabled="running || !!blocker" @click="run">
            <Icon name="refresh" :size="16" :class="running ? 'animate-spin' : ''" />
          </button>
          <button
            class="icon-btn"
            :class="showQuery ? 'icon-btn--active' : ''"
            :title="showQuery ? 'Hide query_context' : 'Inspect query_context'"
            :disabled="!queryContext"
            @click="showQuery = !showQuery"
          >
            <Icon name="code" :size="16" />
          </button>

          <span
            v-if="saveMsg"
            class="flex items-center gap-1.5 text-xs"
            :class="saveMsg === 'Saved' ? 'text-success' : 'text-danger'"
          >
            <Icon :name="saveMsg === 'Saved' ? 'check' : 'alert'" :size="13" />
            {{ saveMsg }}
          </span>
        </div>
      </header>

      <div class="flex-1 overflow-hidden p-5">
        <div class="card h-full p-3">
          <ChartRenderer :model="model" :loading="running || loadingDetail" :error="error" />
        </div>
      </div>

      <!-- query_context inspector — handy while testing against your instance -->
      <div v-if="showQuery" class="max-h-64 overflow-auto border-t border-line bg-surface-2 p-4">
        <pre class="text-xs leading-relaxed text-fg">{{ JSON.stringify(queryContext, null, 2) }}</pre>
      </div>
    </section>

    <SavedChartsDialog
      :open="showLibrary"
      :charts="charts"
      :current-id="savedId"
      :busy-id="deletingId"
      :error="libraryError"
      @close="showLibrary = false"
      @open="openChart"
      @delete="deleteChart"
    />
  </div>
</template>
