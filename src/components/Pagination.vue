<script setup lang="ts">
import { computed } from 'vue'
import Icon from '@/components/Icon.vue'

// The one pager every list view shares. Shows the row range on the left and,
// on the right, first/prev/next/last as icon buttons around a short run of
// numbered pages (windowed with ellipses so long lists don't sprawl). Purely
// presentational — the parent owns `page` and decides whether a page change
// means a re-fetch (Nodes) or a client-side slice (Issues, Stage).
const props = withDefaults(
  defineProps<{
    page: number
    totalPages: number
    totalItems: number
    pageSize: number
    /** Numbered pages shown either side of the current one. */
    siblings?: number
  }>(),
  { siblings: 1 },
)

const emit = defineEmits<{ 'update:page': [page: number] }>()

// 1-indexed row range for the current page ("1–50 of 128").
const rangeStart = computed(() => (props.totalItems === 0 ? 0 : (props.page - 1) * props.pageSize + 1))
const rangeEnd = computed(() => Math.min(props.page * props.pageSize, props.totalItems))

// Page numbers to render, with '…' where a run is skipped. Always keeps the
// first and last page reachable by number.
const pages = computed<(number | '…')[]>(() => {
  const total = Math.max(1, props.totalPages)
  const span = props.siblings * 2 + 5 // first + … + window + … + last
  if (total <= span) return Array.from({ length: total }, (_, i) => i + 1)

  const lo = Math.max(2, props.page - props.siblings)
  const hi = Math.min(total - 1, props.page + props.siblings)
  const out: (number | '…')[] = [1]
  if (lo > 2) out.push('…')
  for (let p = lo; p <= hi; p++) out.push(p)
  if (hi < total - 1) out.push('…')
  out.push(total)
  return out
})

function go(p: number) {
  const next = Math.min(Math.max(1, p), Math.max(1, props.totalPages))
  if (next !== props.page) emit('update:page', next)
}
</script>

<template>
  <nav class="flex flex-wrap items-center gap-3 text-sm text-fg-muted" aria-label="Pagination">
    <span class="tabular">
      <span class="font-medium text-fg">{{ rangeStart }}–{{ rangeEnd }}</span>
      <span class="text-fg-subtle"> of </span>
      <span class="font-medium text-fg">{{ totalItems }}</span>
    </span>

    <div class="ml-auto flex items-center gap-1">
      <button class="pager-btn" :disabled="page <= 1" aria-label="First page" title="First page" @click="go(1)">
        <Icon name="chevronsLeft" :size="15" :width="2" />
      </button>
      <button class="pager-btn" :disabled="page <= 1" aria-label="Previous page" title="Previous page" @click="go(page - 1)">
        <Icon name="chevronLeft" :size="15" :width="2" />
      </button>

      <template v-for="(p, i) in pages" :key="i">
        <span v-if="p === '…'" class="w-6 select-none text-center text-fg-subtle">…</span>
        <button
          v-else
          class="pager-btn tabular"
          :class="p === page ? 'pager-btn-active' : ''"
          :aria-current="p === page ? 'page' : undefined"
          @click="go(p)"
        >
          {{ p }}
        </button>
      </template>

      <button
        class="pager-btn"
        :disabled="page >= totalPages"
        aria-label="Next page"
        title="Next page"
        @click="go(page + 1)"
      >
        <Icon name="chevronRight" :size="15" :width="2" />
      </button>
      <button
        class="pager-btn"
        :disabled="page >= totalPages"
        aria-label="Last page"
        title="Last page"
        @click="go(totalPages)"
      >
        <Icon name="chevronsRight" :size="15" :width="2" />
      </button>
    </div>
  </nav>
</template>
