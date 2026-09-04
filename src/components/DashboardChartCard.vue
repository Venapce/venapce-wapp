<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useConnectionStore } from '@/stores/connection'
import type { Chart } from '@/api/types'
import { toRenderModel, type RenderModel } from '@/lib/echartsOption'
import ChartRenderer from '@/components/ChartRenderer.vue'
import { apiErr } from '@/api/venapce'

// Renders one saved chart live: fetches its data through the backend proxy and
// transforms it with the same renderer the builder uses.
const props = defineProps<{ chart: Chart }>()
const conn = useConnectionStore()

const model = ref<RenderModel | null>(null)
const loading = ref(false)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const result = await conn.client.chartData(props.chart.queryContext)
    model.value = toRenderModel(props.chart.builderState, result)
  } catch (e) {
    error.value = apiErr(e)
    model.value = null
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => props.chart, load)
defineExpose({ reload: load })
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
    <div class="drag-handle flex items-center gap-2 border-b border-line px-3 py-2">
      <span class="truncate text-xs font-semibold text-fg-muted">{{ chart.title }}</span>
      <span class="chip ml-auto shrink-0 !px-1.5 !py-0.5 !text-[10px]">{{ chart.vizType }}</span>
      <slot name="actions" />
    </div>
    <div class="min-h-0 flex-1 p-2">
      <ChartRenderer :model="model" :loading="loading" :error="error" />
    </div>
  </div>
</template>
