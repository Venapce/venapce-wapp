<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Icon from '@/components/Icon.vue'
import AddDatasetDialog from '@/components/builder/AddDatasetDialog.vue'
import type { DatasetSummary } from '@/api/types'

// The builder's dataset list — datasets are browsed and registered right here
// instead of on a page of their own. Collapsed it shows the chosen dataset;
// expanded it is a searchable list with a "+" that registers a new table.
const props = defineProps<{
  datasets: DatasetSummary[]
  modelValue: number | null
  loading?: boolean
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', id: number): void
  /** A dataset was registered — the parent reloads the list, then selects it. */
  (e: 'created', id: number): void
  (e: 'refresh'): void
}>()

const search = ref('')
// Open while nothing is picked yet; picking collapses it back to one line.
const open = ref(props.modelValue == null)
const showAdd = ref(false)

const selected = computed(() => props.datasets.find((d) => d.id === props.modelValue) ?? null)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return props.datasets
  return props.datasets.filter((d) =>
    [d.table_name, d.schema, d.database?.database_name].some((f) => (f ?? '').toLowerCase().includes(q)),
  )
})

// A chart restored from the library arrives with its dataset already set.
watch(
  () => props.modelValue,
  (id) => {
    if (id != null) open.value = false
  },
)

function pick(d: DatasetSummary) {
  open.value = false
  search.value = ''
  if (d.id !== props.modelValue) emit('update:modelValue', d.id)
}

function created(id: number) {
  showAdd.value = false
  emit('created', id)
}
</script>

<template>
  <!-- While browsing, the picker claims the panel's spare height so the list
       runs to the bottom instead of leaving dead space under it. -->
  <div :class="open ? 'flex min-h-0 flex-1 flex-col' : ''">
    <div class="mb-1 flex shrink-0 items-center justify-between">
      <label class="label mb-0">Dataset</label>
      <div class="flex items-center gap-0.5">
        <button class="icon-btn-sm" title="Refresh datasets" :disabled="loading" @click="emit('refresh')">
          <Icon name="refresh" :size="14" :class="loading ? 'animate-spin' : ''" />
        </button>
        <button class="icon-btn-sm" title="Add dataset" @click="showAdd = true">
          <Icon name="plus" :size="14" />
        </button>
      </div>
    </div>

    <!-- Collapsed: a breadcrumb back to the list, then the dataset in use.
         Picking a dataset swaps this panel for the chart controls, so the way
         back has to be visible rather than implied. -->
    <div v-if="!open" class="flex items-center gap-1 rounded-lg border border-line bg-surface-2 px-1.5 py-1.5">
      <button
        class="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-fg-muted transition-colors hover:bg-accent-soft hover:text-accent"
        title="Back to the dataset list"
        @click="open = true"
      >
        <Icon name="chevronLeft" :size="13" />
        Datasets
      </button>
      <Icon name="chevronRight" :size="12" class="shrink-0 text-fg-subtle" />
      <span
        class="flex min-w-0 items-center gap-1.5 px-1 text-xs"
        :title="[selected?.table_name, selected?.schema, selected?.database?.database_name].filter(Boolean).join(' · ')"
      >
        <Icon name="database" :size="13" class="shrink-0 text-accent" />
        <span class="truncate font-medium text-fg">{{ selected?.table_name ?? 'Select a dataset' }}</span>
      </span>
    </div>

    <!-- Expanded: search + the list of registered datasets -->
    <template v-else>
      <div class="relative mb-1.5 shrink-0">
        <Icon name="search" :size="13" class="pointer-events-none absolute left-2 top-2 text-fg-subtle" />
        <input v-model="search" class="field !py-1 !pl-7 !text-xs" placeholder="Search datasets…" />
      </div>

      <p v-if="loading" class="px-1 py-2 text-xs text-fg-subtle">Loading datasets…</p>
      <div v-else-if="!datasets.length" class="rounded-lg border border-dashed border-line px-3 py-4 text-center">
        <p class="mb-2 text-xs text-fg-muted">No datasets registered yet.</p>
        <button class="btn-outline btn-sm" @click="showAdd = true"><Icon name="plus" :size="12" /> Add dataset</button>
      </div>
      <p v-else-if="!filtered.length" class="px-1 py-2 text-xs text-fg-subtle">No dataset matches “{{ search }}”.</p>

      <ul v-else class="min-h-0 flex-1 space-y-0.5 overflow-y-auto rounded-lg border border-line p-1">
        <li v-for="d in filtered" :key="d.id">
          <button
            class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors"
            :class="d.id === modelValue ? 'bg-accent-soft text-accent' : 'text-fg-muted hover:bg-accent-soft hover:text-fg'"
            @click="pick(d)"
          >
            <Icon name="database" :size="13" class="shrink-0" :class="d.id === modelValue ? '' : 'text-fg-subtle'" />
            <span class="min-w-0 flex-1">
              <span class="block truncate font-medium" :class="d.id === modelValue ? '' : 'text-fg'">{{ d.table_name }}</span>
              <span class="block truncate text-[11px] text-fg-subtle">
                {{ [d.schema, d.database?.database_name].filter(Boolean).join(' · ') || '—' }}
              </span>
            </span>
            <Icon v-if="d.id === modelValue" name="check" :size="13" class="shrink-0" />
          </button>
        </li>
      </ul>
    </template>

    <AddDatasetDialog :open="showAdd" @created="created" @close="showAdd = false" />
  </div>
</template>
