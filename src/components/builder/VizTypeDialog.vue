<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  matchesViz,
  VIZ_CATALOG,
  VIZ_CATEGORIES,
  type VizCategory,
} from '@/lib/vizCatalog'
import { isSupportedViz, type VizType } from '@/lib/builder'
import Icon from '@/components/Icon.vue'

// The "View all charts" dialog — the whole Superset catalogue, searchable and
// filterable by category, the way Superset's own chart-type modal works. Types
// Venapce doesn't render yet are listed but not selectable, so the gap is
// visible rather than hidden.
const props = defineProps<{ open: boolean; selected: string }>()
const emit = defineEmits<{ (e: 'select', key: VizType): void; (e: 'close'): void }>()

const search = ref('')
const category = ref<VizCategory | 'All' | 'Available now'>('All')

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      search.value = ''
      category.value = 'All'
      window.addEventListener('keydown', onKey)
    } else {
      window.removeEventListener('keydown', onKey)
    }
  },
)

onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

const filtered = computed(() =>
  VIZ_CATALOG.filter((e) => {
    if (category.value === 'Available now' && !e.supported) return false
    if (category.value !== 'All' && category.value !== 'Available now' && e.category !== category.value) return false
    return matchesViz(e, search.value)
  }),
)

const counts = computed(() => ({
  total: VIZ_CATALOG.length,
  supported: VIZ_CATALOG.filter((e) => e.supported).length,
}))

function choose(key: string, supported: boolean) {
  if (!supported || !isSupportedViz(key)) return
  emit('select', key)
  emit('close')
}
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
    @click.self="emit('close')"
  >
    <div class="card flex h-[80vh] w-full max-w-5xl flex-col overflow-hidden" role="dialog" aria-modal="true">
      <!-- header -->
      <header class="flex items-center gap-3 border-b border-line px-5 py-3">
        <div>
          <h2 class="text-sm font-semibold text-fg">Select a chart type</h2>
          <p class="text-xs text-fg-subtle">
            {{ counts.total }} types from Superset's registry · {{ counts.supported }} render natively here
          </p>
        </div>
        <div class="relative ml-auto">
          <Icon
            name="search"
            :size="14"
            class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle"
          />
          <input
            v-model="search"
            class="field w-64 !py-1.5 !pl-8 !text-xs"
            placeholder="Search charts…"
            autofocus
          />
        </div>
        <button class="icon-btn-sm" title="Close" aria-label="Close" @click="emit('close')">
          <Icon name="close" :size="15" />
        </button>
      </header>

      <div class="flex min-h-0 flex-1">
        <!-- category rail -->
        <nav class="w-44 shrink-0 overflow-y-auto border-r border-line bg-surface-2 py-2">
          <button
            v-for="c in ['All', 'Available now', ...VIZ_CATEGORIES]"
            :key="c"
            class="block w-full px-4 py-1.5 text-left text-xs"
            :class="
              category === c
                ? 'bg-accent-soft font-semibold text-accent'
                : 'text-fg-muted hover:bg-bg hover:text-fg'
            "
            @click="category = c as VizCategory | 'All' | 'Available now'"
          >
            {{ c }}
          </button>
        </nav>

        <!-- grid -->
        <div class="min-w-0 flex-1 overflow-y-auto p-4">
          <div class="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3">
            <button
              v-for="e in filtered"
              :key="e.key + e.supersetKey"
              class="flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors"
              :class="[
                selected === e.key
                  ? 'border-accent-border bg-accent-soft'
                  : 'border-line hover:border-accent-border hover:bg-bg',
                e.supported ? 'cursor-pointer' : 'cursor-not-allowed opacity-55',
              ]"
              :disabled="!e.supported"
              :title="e.supported ? e.description : `${e.description} — not rendered natively yet`"
              @click="choose(e.key, e.supported)"
            >
              <div class="flex items-center gap-2">
                <Icon
                  :name="e.icon"
                  :size="20"
                  :class="e.supported ? 'text-accent' : 'text-fg-subtle'"
                />
                <span class="truncate text-xs font-semibold text-fg">{{ e.name }}</span>
              </div>
              <p class="line-clamp-2 text-[11px] leading-snug text-fg-subtle">{{ e.description }}</p>
              <div class="mt-auto flex flex-wrap items-center gap-1 pt-1">
                <span class="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-fg-muted">{{ e.category }}</span>
                <span
                  v-if="e.deprecated"
                  class="inline-flex items-center gap-1 rounded bg-warning-soft px-1.5 py-0.5 text-[10px] text-warning"
                >
                  <Icon name="alert" :size="10" />
                  deprecated
                </span>
                <span
                  v-if="e.supported"
                  class="inline-flex items-center gap-1 rounded bg-success-soft px-1.5 py-0.5 text-[10px] text-success"
                >
                  <Icon name="check" :size="10" />
                  native
                </span>
                <span v-else class="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-fg-subtle">soon</span>
              </div>
            </button>
          </div>

          <p v-if="!filtered.length" class="py-10 text-center text-sm text-fg-subtle">
            No chart type matches “{{ search }}”.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
