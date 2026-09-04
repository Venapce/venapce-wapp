<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useConnectionStore } from '@/stores/connection'
import { apiErr } from '@/api/venapce'
import type { DatasetDetail, DatasetSummary } from '@/api/types'
import {
  AGGREGATES,
  FILTER_OPS,
  VIZ_TYPES,
  buildQueryContext,
  emptyBuilder,
  type Aggregate,
  type MetricSpec,
} from '@/lib/builder'
import { toRenderModel, type RenderModel } from '@/lib/echartsOption'
import ChartRenderer from '@/components/ChartRenderer.vue'

const conn = useConnectionStore()
const client = computed(() => conn.client)
const route = useRoute()

// Saved-chart state: title, the persisted id (null until first save), status.
const title = ref('')
const savedId = ref<number | null>(null)
const saving = ref(false)
const saveMsg = ref('')

const datasets = ref<DatasetSummary[]>([])
const detail = ref<DatasetDetail | null>(null)
const loadingDatasets = ref(false)
const loadingDetail = ref(false)

const state = reactive(emptyBuilder())

const model = ref<RenderModel | null>(null)
const running = ref(false)
const error = ref('')
const showQuery = ref(false)

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

// ---- lifecycle ----
onMounted(async () => {
  await loadDatasets()
  const cid = Number(route.query.chartId)
  if (cid) await restoreChart(cid)
})

// Load a saved chart back into the builder for editing (?chartId=…).
async function restoreChart(id: number) {
  try {
    const chart = await client.value.getChart(id)
    Object.assign(state, chart.builderState)
    title.value = chart.title
    savedId.value = chart.id
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
      title: title.value.trim() || `${detail.value?.table_name ?? 'chart'} · ${state.vizType}`,
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
  state.dimensions = []
  loadingDetail.value = true
  model.value = null
  try {
    detail.value = await client.value.dataset(id)
    // Sensible defaults: first groupby col as dimension, COUNT(*) metric.
    const firstDim = groupbyColumns.value[0]?.column_name
    state.dimensions = firstDim ? [firstDim] : []
    state.metrics = [{ kind: 'sql', sql: 'COUNT(*)', label: 'count' }]
    await run()
  } catch (e) {
    error.value = errMsg(e)
  } finally {
    loadingDetail.value = false
  }
}

async function run() {
  if (state.datasetId == null) return
  running.value = true
  error.value = ''
  try {
    const result = await client.value.chartData(buildQueryContext(state))
    model.value = toRenderModel(state, result)
  } catch (e) {
    error.value = errMsg(e)
    model.value = null
  } finally {
    running.value = false
  }
}

// ---- dimension helpers ----
function toggleDimension(col: string) {
  const i = state.dimensions.indexOf(col)
  if (i >= 0) state.dimensions.splice(i, 1)
  else state.dimensions.push(col)
}

// ---- metric helpers ----
function addMetric() {
  const col = allColumns.value[0]?.column_name
  state.metrics.push(col ? { kind: 'simple', column: col, aggregate: 'SUM' } : { kind: 'sql', sql: 'COUNT(*)', label: 'count' })
}
function removeMetric(i: number) {
  state.metrics.splice(i, 1)
}
function setMetricKind(kind: MetricSpec['kind'], i: number) {
  if (kind === 'saved') state.metrics[i] = { kind: 'saved', name: savedMetrics.value[0]?.metric_name ?? '' }
  else if (kind === 'sql') state.metrics[i] = { kind: 'sql', sql: 'COUNT(*)', label: 'count' }
  else state.metrics[i] = { kind: 'simple', column: allColumns.value[0]?.column_name ?? '', aggregate: 'SUM' }
}

// ---- filter helpers ----
function addFilter() {
  state.filters.push({ col: allColumns.value[0]?.column_name ?? '', op: '==', val: '' })
}
function removeFilter(i: number) {
  state.filters.splice(i, 1)
}

// Re-run automatically when the viz type flips (cheap, no re-query needed sometimes,
// but the transform depends on state so we just re-query for correctness).
watch(
  () => state.vizType,
  () => {
    if (model.value || state.datasetId != null) run()
  },
)

function errMsg(e: unknown): string {
  const err = e as { response?: { data?: { message?: string } }; message?: string }
  return err.response?.data?.message ?? err.message ?? 'Query failed'
}
</script>

<template>
  <div class="grid h-full grid-cols-[340px_1fr]">
    <!-- ============ CONFIG PANEL ============ -->
    <section class="flex flex-col overflow-y-auto border-r border-line bg-surface">
      <header class="border-b border-line px-4 py-3">
        <h2 class="text-sm font-semibold text-fg">Chart Builder</h2>
        <p class="text-xs text-fg-subtle">Data comes live from Superset · rendered by ECharts</p>
      </header>

      <div class="space-y-5 p-4">
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
          <!-- Viz type -->
          <div>
            <label class="label">Visualization</label>
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="v in VIZ_TYPES"
                :key="v.value"
                class="flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-xs"
                :class="
                  state.vizType === v.value
                    ? 'border-accent-border bg-accent-soft text-accent'
                    : 'border-line text-fg-muted hover:bg-bg'
                "
                @click="state.vizType = v.value"
              >
                <span class="text-base">{{ v.icon }}</span>{{ v.label }}
              </button>
            </div>
          </div>

          <!-- Dimensions -->
          <div v-if="state.vizType !== 'big_number'">
            <label class="label">Dimensions (group by)</label>
            <div class="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-md border border-line p-2">
              <button
                v-for="c in groupbyColumns"
                :key="c.column_name"
                class="rounded-full px-2.5 py-1 text-xs"
                :class="
                  state.dimensions.includes(c.column_name)
                    ? 'bg-accent text-accent-fg'
                    : 'bg-surface-2 text-fg-muted hover:bg-surface-2'
                "
                @click="toggleDimension(c.column_name)"
              >
                {{ c.column_name }}
              </button>
            </div>
          </div>

          <!-- Metrics -->
          <div>
            <div class="mb-1 flex items-center justify-between">
              <label class="label mb-0">Metrics</label>
              <button class="text-xs font-medium text-accent hover:underline" @click="addMetric">+ Add</button>
            </div>
            <div class="space-y-2">
              <div v-for="(m, i) in state.metrics" :key="i" class="rounded-md border border-line p-2">
                <div class="mb-2 flex items-center gap-2">
                  <select
                    class="field !py-1 !text-xs"
                    :value="m.kind"
                    @change="setMetricKind(($event.target as HTMLSelectElement).value as MetricSpec['kind'], i)"
                  >
                    <option value="simple">Aggregate</option>
                    <option value="saved" :disabled="!savedMetrics.length">Saved metric</option>
                    <option value="sql">Custom SQL</option>
                  </select>
                  <button class="ml-auto text-fg-subtle hover:text-danger" @click="removeMetric(i)">✕</button>
                </div>

                <div v-if="m.kind === 'simple'" class="flex gap-2">
                  <select v-model="m.aggregate" class="field !py-1 !text-xs">
                    <option v-for="a in AGGREGATES" :key="a" :value="a as Aggregate">{{ a }}</option>
                  </select>
                  <select v-model="m.column" class="field !py-1 !text-xs">
                    <option v-for="c in allColumns" :key="c.column_name" :value="c.column_name">
                      {{ c.column_name }}
                    </option>
                  </select>
                </div>

                <div v-else-if="m.kind === 'saved'">
                  <select v-model="m.name" class="field !py-1 !text-xs">
                    <option v-for="sm in savedMetrics" :key="sm.metric_name" :value="sm.metric_name">
                      {{ sm.verbose_name || sm.metric_name }}
                    </option>
                  </select>
                </div>

                <div v-else class="space-y-1.5">
                  <input v-model="m.sql" class="field !py-1 !text-xs" placeholder="COUNT(*)" />
                  <input v-model="m.label" class="field !py-1 !text-xs" placeholder="label" />
                </div>
              </div>
            </div>
          </div>

          <!-- Filters -->
          <div>
            <div class="mb-1 flex items-center justify-between">
              <label class="label mb-0">Filters</label>
              <button class="text-xs font-medium text-accent hover:underline" @click="addFilter">+ Add</button>
            </div>
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
                <button class="text-fg-subtle hover:text-danger" @click="removeFilter(i)">✕</button>
              </div>
            </div>
          </div>

          <!-- Row limit + order -->
          <div class="flex items-end gap-3">
            <div class="flex-1">
              <label class="label">Row limit</label>
              <input v-model.number="state.rowLimit" type="number" min="1" class="field !py-1.5" />
            </div>
            <label class="flex items-center gap-2 pb-2 text-xs text-fg-muted">
              <input v-model="state.orderDesc" type="checkbox" class="rounded border-line-strong" />
              Order desc
            </label>
          </div>

          <button class="btn-primary w-full" :disabled="running" @click="run">
            {{ running ? 'Running…' : 'Run query' }}
          </button>
        </template>
      </div>
    </section>

    <!-- ============ PREVIEW ============ -->
    <section class="flex min-w-0 flex-col bg-bg">
      <header class="flex items-center gap-3 border-b border-line bg-surface px-5 py-3">
        <h3 class="text-sm font-semibold text-fg">Preview</h3>
        <span v-if="detail" class="chip">{{ detail.table_name }}</span>
        <div class="ml-auto flex items-center gap-2">
          <input v-model="title" class="field w-44 !py-1 !text-xs" placeholder="Chart title" />
          <button
            class="btn-primary !px-3 !py-1 text-xs"
            :disabled="saving || state.datasetId == null"
            @click="saveChart"
          >
            {{ saving ? 'Saving…' : savedId ? 'Update' : 'Save chart' }}
          </button>
          <span
            v-if="saveMsg"
            class="text-xs"
            :class="saveMsg === 'Saved' ? 'text-success' : 'text-danger'"
          >
            {{ saveMsg }}
          </span>
          <button
            class="btn-ghost !px-2 !py-1 text-xs"
            :disabled="!queryContext"
            @click="showQuery = !showQuery"
          >
            {{ showQuery ? 'Hide' : 'View' }} query_context
          </button>
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
  </div>
</template>
