<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import '@/lib/echarts'
import type { RenderModel } from '@/lib/echartsOption'

const props = defineProps<{ model: RenderModel | null; loading?: boolean; error?: string }>()

const fmt = (v: unknown) => {
  if (v == null) return '—'
  if (typeof v === 'number') return v.toLocaleString()
  return String(v)
}
const bigValue = computed(() => fmt(props.model?.big?.value))
</script>

<template>
  <div class="relative h-full w-full">
    <!-- loading / error / empty states -->
    <div
      v-if="loading"
      class="absolute inset-0 z-10 flex items-center justify-center bg-[color-mix(in_srgb,var(--surface)_72%,transparent)] backdrop-blur-sm"
    >
      <span class="chip animate-pulse">Querying Superset…</span>
    </div>

    <div v-if="error" class="flex h-full items-center justify-center p-6">
      <p class="max-w-md text-center text-sm text-danger">{{ error }}</p>
    </div>

    <template v-else-if="model">
      <!-- ECharts (bar / line / area / pie) -->
      <VChart
        v-if="model.kind === 'echarts'"
        class="h-full w-full"
        :option="model.option"
        autoresize
      />

      <!-- Big number -->
      <div v-else-if="model.kind === 'big_number'" class="flex h-full flex-col items-center justify-center">
        <div class="text-6xl font-bold tracking-tight text-fg">{{ bigValue }}</div>
        <div class="mt-2 text-sm uppercase tracking-wide text-fg-muted">{{ model.big?.label }}</div>
      </div>

      <!-- Table -->
      <div v-else-if="model.kind === 'table'" class="h-full overflow-auto">
        <table class="min-w-full text-sm">
          <thead class="sticky top-0 bg-surface-2 text-left">
            <tr>
              <th
                v-for="c in model.table?.colnames"
                :key="c"
                class="whitespace-nowrap px-3 py-2 font-semibold text-fg-muted"
              >
                {{ c }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, i) in model.table?.rows"
              :key="i"
              class="border-t border-line hover:bg-bg"
            >
              <td v-for="c in model.table?.colnames" :key="c" class="whitespace-nowrap px-3 py-1.5">
                {{ fmt(row[c]) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Empty result -->
      <div v-else class="flex h-full items-center justify-center">
        <p class="text-sm text-fg-subtle">No rows returned.</p>
      </div>
    </template>

    <div v-else class="flex h-full items-center justify-center">
      <p class="text-sm text-fg-subtle">Configure a chart and run the query.</p>
    </div>
  </div>
</template>
