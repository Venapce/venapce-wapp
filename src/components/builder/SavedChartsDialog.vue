<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { Chart } from '@/api/types'
import { vizIcon, vizName } from '@/lib/vizCatalog'
import Icon from '@/components/Icon.vue'

// The saved-chart library: open one back into the builder, or remove it. Delete
// asks for a second click on the row itself rather than a browser confirm —
// the chart being removed stays visible while you decide.
const props = defineProps<{
  open: boolean
  charts: Chart[]
  currentId: number | null
  busyId?: number | null
  error?: string
}>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'open', chart: Chart): void
  (e: 'delete', chart: Chart): void
}>()

const search = ref('')
const pendingId = ref<number | null>(null)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return props.charts
  return props.charts.filter((c) =>
    `${c.title} ${vizName(c.vizType)} ${c.vizType}`.toLowerCase().includes(q),
  )
})

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      search.value = ''
      pendingId.value = null
      window.addEventListener('keydown', onKey)
    } else {
      window.removeEventListener('keydown', onKey)
    }
  },
)
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

function confirmDelete(chart: Chart) {
  if (pendingId.value !== chart.id) {
    pendingId.value = chart.id
    return
  }
  pendingId.value = null
  emit('delete', chart)
}
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
    @click.self="emit('close')"
  >
    <div class="card flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden" role="dialog" aria-modal="true">
      <header class="flex items-center gap-3 border-b border-line px-5 py-3">
        <div>
          <h2 class="text-sm font-semibold text-fg">Saved charts</h2>
          <p class="text-xs text-fg-subtle">
            {{ charts.length }} chart{{ charts.length === 1 ? '' : 's' }} · open one to edit, or remove it
          </p>
        </div>
        <div class="relative ml-auto">
          <Icon
            name="search"
            :size="14"
            class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle"
          />
          <input v-model="search" class="field w-56 !py-1.5 !pl-8 !text-xs" placeholder="Search charts…" />
        </div>
        <button class="icon-btn-sm" title="Close" aria-label="Close" @click="emit('close')">
          <Icon name="close" :size="15" />
        </button>
      </header>

      <p v-if="error" class="bg-danger-soft px-5 py-2 text-xs text-danger">{{ error }}</p>

      <div class="min-h-0 flex-1 overflow-y-auto p-3">
        <p v-if="!charts.length" class="px-2 py-8 text-center text-sm text-fg-subtle">
          Nothing saved yet — build a chart and hit save.
        </p>
        <p v-else-if="!filtered.length" class="px-2 py-8 text-center text-sm text-fg-subtle">
          No chart matches “{{ search }}”.
        </p>

        <ul class="space-y-1.5">
          <li
            v-for="c in filtered"
            :key="c.id"
            class="flex items-center gap-3 rounded-lg border px-3 py-2"
            :class="
              c.id === currentId
                ? 'border-accent-border bg-accent-soft'
                : 'border-line hover:border-accent-border hover:bg-bg'
            "
          >
            <Icon :name="vizIcon(c.vizType)" :size="18" class="text-fg-muted" />
            <button class="min-w-0 flex-1 text-left" @click="emit('open', c)">
              <span class="block truncate text-sm font-medium text-fg">{{ c.title }}</span>
              <span class="block truncate text-[11px] text-fg-subtle">
                {{ vizName(c.vizType) }} · #{{ c.id }}
                <template v-if="c.id === currentId"> · open in the builder</template>
              </span>
            </button>

            <template v-if="pendingId === c.id">
              <span class="text-[11px] font-medium text-danger">Remove?</span>
              <button
                class="icon-btn-sm icon-btn--danger"
                title="Confirm remove"
                :disabled="busyId === c.id"
                @click="confirmDelete(c)"
              >
                <Icon name="check" :size="15" />
              </button>
              <button class="icon-btn-sm" title="Keep" @click="pendingId = null">
                <Icon name="close" :size="15" />
              </button>
            </template>
            <template v-else>
              <button class="icon-btn-sm" title="Open in builder" @click="emit('open', c)">
                <Icon name="pencil" :size="15" />
              </button>
              <button
                class="icon-btn-sm icon-btn--danger"
                title="Remove chart"
                :disabled="busyId === c.id"
                @click="confirmDelete(c)"
              >
                <Icon name="trash" :size="15" />
              </button>
            </template>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
