<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import '@/lib/echarts'
import type { RenderModel } from '@/lib/echartsOption'
import { applyChartTheme } from '@/lib/viz/theme'
import { formatNumber } from '@/lib/numberFormat'
import { useUiStore } from '@/stores/ui'
import Icon from '@/components/Icon.vue'

const props = defineProps<{ model: RenderModel | null; loading?: boolean; error?: string }>()
const ui = useUiStore()

const fmt = (v: unknown) => {
  if (v == null) return '—'
  if (typeof v === 'number') return v.toLocaleString()
  return String(v)
}
const isNumber = (v: unknown) => typeof v === 'number'
const bigValue = computed(() => formatNumber(props.model?.big?.value, props.model?.big?.format))

// Re-themed whenever the option or the resolved theme changes, so the chart
// follows the light/dark toggle without a re-query.
const themedOption = computed(() =>
  props.model?.option ? applyChartTheme(props.model.option, ui.isDark) : undefined,
)
// The sparkline under a "big number with trendline" is themed the same way.
const themedSpark = computed(() =>
  props.model?.big?.spark ? applyChartTheme(props.model.big.spark, ui.isDark) : undefined,
)
</script>

<template>
  <div class="relative h-full w-full">
    <!-- loading / error / empty states -->
    <div
      v-if="loading"
      class="absolute inset-0 z-10 flex items-center justify-center bg-[color-mix(in_srgb,var(--surface)_72%,transparent)] backdrop-blur-sm"
    >
      <span class="chip animate-pulse">
        <Icon name="refresh" :size="13" class="animate-spin" />
        Querying Superset…
      </span>
    </div>

    <div v-if="error" class="flex h-full items-center justify-center p-6">
      <p class="flex max-w-md items-start gap-2 text-center text-sm text-danger">
        <Icon name="alert" :size="16" class="mt-0.5" />
        <span class="text-left">{{ error }}</span>
      </p>
    </div>

    <template v-else-if="model">
      <!-- ECharts: every chart family that draws on a canvas -->
      <div v-if="model.kind === 'echarts'" class="flex h-full w-full flex-col">
        <VChart class="min-h-0 w-full flex-1" :option="themedOption" autoresize />
        <p v-if="model.note" class="shrink-0 px-2 pt-1 text-[11px] text-fg-subtle">{{ model.note }}</p>
      </div>

      <!-- Big number, with the trendline sparkline when the type carries one -->
      <div v-else-if="model.kind === 'big_number'" class="flex h-full flex-col">
        <div class="flex flex-1 flex-col items-center justify-center">
          <div class="tabular text-6xl font-bold tracking-tight text-fg">{{ bigValue }}</div>
          <div class="mt-2 text-sm uppercase tracking-wide text-fg-muted">{{ model.big?.label }}</div>
        </div>
        <VChart v-if="themedSpark" class="h-24 w-full shrink-0" :option="themedSpark" autoresize />
      </div>

      <!-- Word cloud: DOM, not canvas (see viz/categorical.ts) -->
      <div
        v-else-if="model.kind === 'wordcloud'"
        class="flex h-full flex-wrap content-center items-center justify-center gap-x-4 gap-y-1 overflow-auto p-4"
      >
        <span
          v-for="(w, i) in model.words"
          :key="`${w.text}-${i}`"
          class="cursor-default font-semibold leading-tight transition-opacity hover:opacity-70"
          :style="{ fontSize: `${w.size}px`, color: w.color }"
          :title="w.title"
        >
          {{ w.text }}
        </span>
      </div>

      <!-- Table (also the pivot table) -->
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
              <td
                v-for="c in model.table?.colnames"
                :key="c"
                class="whitespace-nowrap px-3 py-1.5"
                :class="isNumber(row[c]) ? 'tabular text-right' : ''"
              >
                {{ fmt(row[c]) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Empty result -->
      <div v-else class="flex h-full flex-col items-center justify-center gap-1">
        <p class="text-sm text-fg-subtle">No rows returned.</p>
        <p v-if="model.note" class="text-xs text-fg-subtle">{{ model.note }}</p>
      </div>
    </template>

    <div v-else class="flex h-full flex-col items-center justify-center gap-2 text-fg-subtle">
      <Icon name="chartBar" :size="28" />
      <p class="text-sm">Configure a chart and run the query.</p>
    </div>
  </div>
</template>
