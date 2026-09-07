<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { GridLayout, GridItem } from 'grid-layout-plus'
import { useConnectionStore } from '@/stores/connection'
import type { Chart, Dashboard, DashboardCell } from '@/api/types'
import DashboardChartCard from '@/components/DashboardChartCard.vue'
import Icon from '@/components/Icon.vue'
import { vizIcon, vizName } from '@/lib/vizCatalog'
import { apiErr } from '@/api/venapce'

const conn = useConnectionStore()
const route = useRoute()
const router = useRouter()

interface GridItemModel {
  i: string
  x: number
  y: number
  w: number
  h: number
  chartId: number
}

const dashboards = ref<Dashboard[]>([])
const charts = ref<Chart[]>([])
const loading = ref(true)
const saving = ref(false)
const error = ref('')

const activeId = ref<number | null>(null)
const items = ref<GridItemModel[]>([])
const editMode = ref(route.query.edit === '1')
let seq = 0
// Serialized layout at load/save time — used to detect unsaved changes.
let baseline = '[]'

const chartsById = computed(() => Object.fromEntries(charts.value.map((c) => [c.id, c])))
const active = computed(() => dashboards.value.find((d) => d.id === activeId.value) ?? null)

/** Layout the grid currently holds, in the persisted cell shape. */
const currentLayout = computed<DashboardCell[]>(() =>
  items.value.map((it) => ({ chartId: it.chartId, x: it.x, y: it.y, w: it.w, h: it.h })),
)
const dirty = computed(() => JSON.stringify(currentLayout.value) !== baseline)

/** Charts not yet placed on the active dashboard (offered in the edit palette). */
const availableCharts = computed(() => {
  const placed = new Set(items.value.map((it) => it.chartId))
  return charts.value.filter((c) => !placed.has(c.id))
})

/** Rebuild the editable grid model from a dashboard's stored layout. */
function loadLayout(d: Dashboard | null) {
  items.value = (d?.layout ?? []).map((c) => ({
    i: `i${seq++}`,
    x: c.x,
    y: c.y,
    w: c.w,
    h: c.h,
    chartId: c.chartId,
  }))
  baseline = JSON.stringify(currentLayout.value)
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [list, chartList] = await Promise.all([
      conn.client.listDashboards(),
      conn.client.listCharts(),
    ])
    dashboards.value = list
    charts.value = chartList
    const wanted = Number(route.query.d)
    const start = list.find((d) => d.id === wanted) ?? list[0] ?? null
    activeId.value = start?.id ?? null
    loadLayout(start)
    syncQuery()
  } catch (e) {
    error.value = apiErr(e)
  } finally {
    loading.value = false
  }
}

/** Keep the active dashboard + edit flag in the URL so views are shareable. */
function syncQuery() {
  const query: Record<string, string> = {}
  if (activeId.value != null) query.d = String(activeId.value)
  if (editMode.value) query.edit = '1'
  router.replace({ query })
}

function confirmLeave(): boolean {
  return !dirty.value || window.confirm('Discard unsaved layout changes?')
}

function selectDashboard(d: Dashboard) {
  if (d.id === activeId.value || !confirmLeave()) return
  activeId.value = d.id
  loadLayout(d)
  syncQuery()
}

function toggleEdit() {
  editMode.value = !editMode.value
  syncQuery()
}

function addChart(chart: Chart) {
  const bottom = items.value.reduce((m, it) => Math.max(m, it.y + it.h), 0)
  items.value.push({ i: `i${seq++}`, x: 0, y: bottom, w: 6, h: 8, chartId: chart.id })
}

function removeItem(i: string) {
  items.value = items.value.filter((it) => it.i !== i)
}

async function save() {
  if (!active.value) return
  saving.value = true
  error.value = ''
  try {
    const updated = await conn.client.updateDashboard(active.value.id, {
      title: active.value.title,
      layout: currentLayout.value,
    })
    const idx = dashboards.value.findIndex((d) => d.id === updated.id)
    if (idx !== -1) dashboards.value[idx] = updated
    baseline = JSON.stringify(currentLayout.value)
  } catch (e) {
    error.value = apiErr(e)
  } finally {
    saving.value = false
  }
}

async function createDashboard() {
  if (!confirmLeave()) return
  const title = window.prompt('Dashboard name', 'New dashboard')?.trim()
  if (!title) return
  try {
    const d = await conn.client.createDashboard({ title, layout: [] })
    dashboards.value.push(d)
    activeId.value = d.id
    loadLayout(d)
    editMode.value = true
    syncQuery()
  } catch (e) {
    error.value = apiErr(e)
  }
}

async function renameDashboard() {
  if (!active.value) return
  const title = window.prompt('Rename dashboard', active.value.title)?.trim()
  if (!title || title === active.value.title) return
  try {
    const updated = await conn.client.updateDashboard(active.value.id, {
      title,
      layout: currentLayout.value,
    })
    const idx = dashboards.value.findIndex((d) => d.id === updated.id)
    if (idx !== -1) dashboards.value[idx] = updated
    baseline = JSON.stringify(currentLayout.value)
  } catch (e) {
    error.value = apiErr(e)
  }
}

async function removeDashboard() {
  const d = active.value
  if (!d || !window.confirm(`Delete "${d.title}"?`)) return
  try {
    await conn.client.deleteDashboard(d.id)
    dashboards.value = dashboards.value.filter((x) => x.id !== d.id)
    const next = dashboards.value[0] ?? null
    activeId.value = next?.id ?? null
    loadLayout(next)
    syncQuery()
  } catch (e) {
    error.value = apiErr(e)
  }
}

// If another view navigates here with a ?d= target, honor it.
watch(
  () => route.query.d,
  (d) => {
    const id = Number(d)
    if (id && id !== activeId.value) {
      const target = dashboards.value.find((x) => x.id === id)
      if (target) selectDashboard(target)
    }
  },
)

onMounted(load)
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Dashboard badge bar -->
    <header class="shrink-0 border-b border-line bg-surface px-6 pt-4">
      <div class="flex items-center gap-2">
        <h1 class="text-lg font-semibold text-fg">Dashboards</h1>
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button
          v-for="d in dashboards"
          :key="d.id"
          class="badge-pill"
          :class="d.id === activeId ? 'badge-pill--active' : ''"
          @click="selectDashboard(d)"
        >
          {{ d.title }}
          <span class="ml-1 text-[10px] opacity-60">{{ d.layout.length }}</span>
        </button>
        <button class="badge-pill badge-pill--add" @click="createDashboard">
          <Icon name="plus" :size="12" />
          New
        </button>
      </div>
    </header>

    <p v-if="error" class="bg-danger-soft px-6 py-2 text-sm text-danger">{{ error }}</p>

    <!-- Active dashboard toolbar -->
    <div
      v-if="active"
      class="flex shrink-0 items-center gap-2 border-b border-line bg-surface px-6 py-2"
    >
      <h2 class="text-sm font-semibold text-fg">{{ active.title }}</h2>
      <button class="icon-btn-sm" title="Rename dashboard" @click="renameDashboard">
        <Icon name="pencil" :size="14" />
      </button>
      <span v-if="dirty" class="flex items-center gap-1.5 text-xs text-warning">
        <Icon name="alert" :size="12" />
        Unsaved changes
      </span>

      <div class="ml-auto flex items-center gap-2">
        <button
          class="icon-btn-sm"
          :class="editMode ? 'icon-btn--active' : ''"
          :title="editMode ? 'Done editing' : 'Arrange charts'"
          @click="toggleEdit"
        >
          <Icon :name="editMode ? 'check' : 'sliders'" :size="14" />
        </button>
        <button
          v-if="editMode"
          class="icon-btn-sm icon-btn--danger"
          title="Delete dashboard"
          @click="removeDashboard"
        >
          <Icon name="trash" :size="14" />
        </button>
        <button class="btn-primary !py-1 text-xs" :disabled="saving || !dirty" @click="save">
          <Icon :name="saving ? 'refresh' : 'save'" :size="14" :class="saving ? 'animate-spin' : ''" />
          {{ saving ? 'Saving…' : 'Save' }}
        </button>
      </div>
    </div>

    <div class="flex min-h-0 flex-1">
      <!-- Edit palette: charts available to add -->
      <aside
        v-if="editMode && active"
        class="w-64 shrink-0 overflow-y-auto border-r border-line bg-surface p-3"
      >
        <h2 class="label mb-2">Add charts</h2>
        <p v-if="!charts.length" class="text-xs text-fg-subtle">
          No saved charts yet.
          <RouterLink :to="{ name: 'builder' }" class="text-accent hover:underline">Build one →</RouterLink>
        </p>
        <p v-else-if="!availableCharts.length" class="text-xs text-fg-subtle">
          All your charts are on this dashboard.
        </p>
        <div class="space-y-2">
          <button
            v-for="c in availableCharts"
            :key="c.id"
            class="flex w-full items-center gap-2 rounded-md border border-line px-3 py-2 text-left text-xs hover:border-accent-border hover:bg-accent-soft"
            :title="`Add ${c.title} (${vizName(c.vizType)})`"
            @click="addChart(c)"
          >
            <Icon :name="vizIcon(c.vizType)" :size="16" class="text-fg-muted" />
            <span class="truncate font-medium text-fg">{{ c.title }}</span>
            <Icon name="plus" :size="14" class="ml-auto text-fg-subtle" />
          </button>
        </div>
        <p class="mt-4 text-[11px] leading-relaxed text-fg-subtle">
          Click a chart to place it. Drag any chart's header to move it and its corner to resize.
          Save when done.
        </p>
      </aside>

      <!-- The live, movable dashboard grid -->
      <div class="min-h-0 flex-1 overflow-auto bg-bg p-4">
        <p v-if="loading" class="text-sm text-fg-subtle">Loading…</p>

        <div
          v-else-if="!dashboards.length"
          class="card p-8 text-center text-sm text-fg-muted"
        >
          No dashboards yet.
          <button class="text-accent hover:underline" @click="createDashboard">Create one →</button>
        </div>

        <div
          v-else-if="!items.length"
          class="grid h-full place-items-center rounded-lg border-2 border-dashed border-line-strong text-sm text-fg-subtle"
        >
          <span v-if="editMode">Click a chart on the left to place it here.</span>
          <span v-else>
            This dashboard is empty.
            <button class="text-accent hover:underline" @click="toggleEdit">Add charts →</button>
          </span>
        </div>

        <GridLayout
          v-else
          v-model:layout="items"
          :col-num="12"
          :row-height="40"
          :margin="[12, 12]"
          :is-draggable="true"
          :is-resizable="true"
          :responsive="false"
        >
          <GridItem
            v-for="it in items"
            :key="it.i"
            :x="it.x"
            :y="it.y"
            :w="it.w"
            :h="it.h"
            :i="it.i"
            drag-allow-from=".drag-handle"
          >
            <DashboardChartCard v-if="chartsById[it.chartId]" :chart="chartsById[it.chartId]">
              <template v-if="editMode" #actions>
                <button
                  class="icon-btn-plain icon-btn--danger"
                  title="Remove from dashboard"
                  @pointerdown.stop
                  @click="removeItem(it.i)"
                >
                  <Icon name="close" :size="14" />
                </button>
              </template>
            </DashboardChartCard>
            <div
              v-else
              class="flex h-full items-center justify-center rounded-lg border border-dashed border-line-strong bg-surface text-xs text-fg-subtle"
            >
              <Icon name="alert" :size="14" class="mr-1.5" />
              chart #{{ it.chartId }} was deleted
              <button
                v-if="editMode"
                class="icon-btn-plain icon-btn--danger ml-1.5"
                title="Remove from dashboard"
                @click="removeItem(it.i)"
              >
                <Icon name="close" :size="14" />
              </button>
            </div>
          </GridItem>
        </GridLayout>
      </div>
    </div>
  </div>
</template>

<style scoped>
.badge-pill {
  @apply rounded-full border border-line bg-bg px-3 py-1 text-xs font-medium text-fg-muted transition-colors hover:border-accent-border hover:text-fg;
}
.badge-pill--active {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
}
.badge-pill--add {
  @apply inline-flex items-center gap-1.5 border-dashed text-fg-subtle;
}
</style>
