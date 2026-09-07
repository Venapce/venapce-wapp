<script setup lang="ts">
import type { DatasetColumn, DatasetMetric } from '@/api/types'
import type { BuilderState } from '@/lib/builder'
import { NUMBER_FORMATS } from '@/lib/numberFormat'
import ControlSection from './ControlSection.vue'
import MetricEditor from './MetricEditor.vue'

// Superset's Bubble controls: entity, series, X/Y/size metrics, then the axis
// and bubble styling. With no size metric this is a plain scatter plot.
defineProps<{
  state: BuilderState
  columns: DatasetColumn[]
  groupbyColumns: DatasetColumn[]
  savedMetrics: DatasetMetric[]
}>()
</script>

<template>
  <div class="space-y-3">
    <ControlSection title="Points" hint="One row per entity; the series column colours the points.">
      <div class="flex gap-2">
        <div class="flex-1">
          <label class="label">Entity</label>
          <select v-model="state.scatter.entity" class="field !py-1 !text-xs">
            <option value="">(none)</option>
            <option v-for="c in groupbyColumns" :key="c.column_name" :value="c.column_name">
              {{ c.column_name }}
            </option>
          </select>
        </div>
        <div class="flex-1">
          <label class="label">Series (colour)</label>
          <select v-model="state.scatter.series" class="field !py-1 !text-xs">
            <option value="">(none)</option>
            <option v-for="c in groupbyColumns" :key="c.column_name" :value="c.column_name">
              {{ c.column_name }}
            </option>
          </select>
        </div>
      </div>
    </ControlSection>

    <ControlSection title="Metrics" hint="X and Y are required; a size metric turns the scatter into a bubble chart.">
      <MetricEditor
        label="X axis"
        :model-value="state.scatter.xMetric"
        :columns="columns"
        :saved-metrics="savedMetrics"
        @update:model-value="state.scatter.xMetric = $event"
      />
      <MetricEditor
        label="Y axis"
        :model-value="state.scatter.yMetric"
        :columns="columns"
        :saved-metrics="savedMetrics"
        @update:model-value="state.scatter.yMetric = $event"
      />
      <MetricEditor
        label="Bubble size"
        clearable
        :model-value="state.scatter.sizeMetric"
        :columns="columns"
        :saved-metrics="savedMetrics"
        @update:model-value="state.scatter.sizeMetric = $event"
      />
    </ControlSection>

    <ControlSection title="Chart options" :open="false">
      <div class="flex gap-2">
        <div class="flex-1">
          <label class="label">X format</label>
          <select v-model="state.scatter.xFormat" class="field !py-1 !text-xs">
            <option v-for="f in NUMBER_FORMATS" :key="f.value" :value="f.value">{{ f.label }}</option>
          </select>
        </div>
        <div class="flex-1">
          <label class="label">Y format</label>
          <select v-model="state.scatter.yFormat" class="field !py-1 !text-xs">
            <option v-for="f in NUMBER_FORMATS" :key="f.value" :value="f.value">{{ f.label }}</option>
          </select>
        </div>
      </div>

      <div class="flex gap-2">
        <div class="flex-1">
          <label class="label">X-axis title</label>
          <input v-model="state.scatter.xAxisTitle" class="field !py-1 !text-xs" placeholder="metric name" />
        </div>
        <div class="flex-1">
          <label class="label">Y-axis title</label>
          <input v-model="state.scatter.yAxisTitle" class="field !py-1 !text-xs" placeholder="metric name" />
        </div>
      </div>

      <div class="flex gap-2">
        <div class="w-20">
          <label class="label">Min size</label>
          <input v-model.number="state.scatter.minBubbleSize" type="number" min="1" class="field !py-1 !text-xs" />
        </div>
        <div class="w-20">
          <label class="label">Max size</label>
          <input v-model.number="state.scatter.maxBubbleSize" type="number" min="2" class="field !py-1 !text-xs" />
        </div>
        <div class="w-24">
          <label class="label">Opacity</label>
          <input
            v-model.number="state.scatter.opacity"
            type="number"
            min="0.1"
            max="1"
            step="0.05"
            class="field !py-1 !text-xs"
          />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-fg-muted">
        <label class="flex items-center gap-2">
          <input v-model="state.scatter.logX" type="checkbox" class="rounded border-line-strong" /> Log X
        </label>
        <label class="flex items-center gap-2">
          <input v-model="state.scatter.logY" type="checkbox" class="rounded border-line-strong" /> Log Y
        </label>
        <label class="flex items-center gap-2">
          <input v-model="state.scatter.showLabels" type="checkbox" class="rounded border-line-strong" /> Point labels
        </label>
        <label class="flex items-center gap-2">
          <input v-model="state.scatter.legend" type="checkbox" class="rounded border-line-strong" /> Legend
        </label>
        <label class="col-span-2 flex items-center gap-2">
          <input v-model="state.scatter.trendline" type="checkbox" class="rounded border-line-strong" />
          Trend line (least-squares fit per series)
        </label>
      </div>
    </ControlSection>
  </div>
</template>
