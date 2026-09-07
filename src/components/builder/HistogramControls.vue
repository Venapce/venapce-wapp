<script setup lang="ts">
import { computed } from 'vue'
import type { DatasetColumn } from '@/api/types'
import { HISTOGRAM_MODES, type BuilderState } from '@/lib/builder'
import { NUMBER_FORMATS } from '@/lib/numberFormat'
import ControlSection from './ControlSection.vue'

// The distribution engine fetches the raw column and summarises it in the
// browser, so bins, normalisation and the cumulative toggle apply instantly —
// no re-query. The box plot shares the same query and column pickers, but bins
// mean nothing to it: it draws quartiles, so those controls stay hidden.
const props = defineProps<{ state: BuilderState; columns: DatasetColumn[]; groupbyColumns: DatasetColumn[] }>()

const isBox = computed(() => props.state.vizType === 'box_plot')
</script>

<template>
  <div class="space-y-3">
    <ControlSection
      title="Distribution"
      :hint="
        isBox
          ? 'Whiskers reach 1.5×IQR; anything beyond is drawn as an outlier. Row limit caps how many values are sampled.'
          : 'Row limit caps how many values are sampled — raise it for a smoother shape.'
      "
    >
      <div>
        <label class="label">Column</label>
        <select v-model="state.histogram.column" class="field !py-1.5 !text-xs">
          <option value="" disabled>Select a numeric column</option>
          <option v-for="c in columns" :key="c.column_name" :value="c.column_name">
            {{ c.column_name }}<template v-if="c.type"> · {{ c.type }}</template>
          </option>
        </select>
      </div>

      <div class="flex gap-2">
        <div v-if="!isBox" class="w-24">
          <label class="label">Bins</label>
          <input v-model.number="state.histogram.bins" type="number" min="1" max="200" class="field !py-1 !text-xs" />
        </div>
        <div class="min-w-0 flex-1">
          <label class="label">{{ isBox ? 'One box per' : 'Group by' }}</label>
          <select v-model="state.histogram.groupby" class="field !py-1 !text-xs">
            <option value="">(none)</option>
            <option v-for="c in groupbyColumns" :key="c.column_name" :value="c.column_name">
              {{ c.column_name }}
            </option>
          </select>
        </div>
      </div>

      <div v-if="!isBox" class="flex gap-2">
        <div class="flex-1">
          <label class="label">Group display</label>
          <select v-model="state.histogram.mode" class="field !py-1 !text-xs" :disabled="!state.histogram.groupby">
            <option v-for="m in HISTOGRAM_MODES" :key="m" :value="m">{{ m }}</option>
          </select>
        </div>
      </div>

      <div v-if="!isBox" class="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-fg-muted">
        <label class="flex items-center gap-2">
          <input v-model="state.histogram.normalize" type="checkbox" class="rounded border-line-strong" />
          Normalise
        </label>
        <label class="flex items-center gap-2">
          <input v-model="state.histogram.cumulative" type="checkbox" class="rounded border-line-strong" />
          Cumulative
        </label>
        <label class="flex items-center gap-2">
          <input v-model="state.histogram.showValues" type="checkbox" class="rounded border-line-strong" />
          Show values
        </label>
        <label class="flex items-center gap-2">
          <input v-model="state.histogram.legend" type="checkbox" class="rounded border-line-strong" /> Legend
        </label>
      </div>
    </ControlSection>

    <ControlSection title="Chart options" :open="false">
      <div class="flex gap-2">
        <div class="flex-1">
          <label class="label">{{ isBox ? 'Value format' : 'Bin label format' }}</label>
          <select v-model="state.histogram.xFormat" class="field !py-1 !text-xs">
            <option v-for="f in NUMBER_FORMATS" :key="f.value" :value="f.value">{{ f.label }}</option>
          </select>
        </div>
        <div class="w-24">
          <label class="label">Rotate</label>
          <input
            v-model.number="state.histogram.xAxisLabelRotation"
            type="number"
            min="-90"
            max="90"
            step="15"
            class="field !py-1 !text-xs"
          />
        </div>
      </div>
      <div>
        <label class="label">Y-axis title</label>
        <input v-model="state.histogram.yAxisTitle" class="field !py-1 !text-xs" placeholder="Count / Share" />
      </div>
    </ControlSection>
  </div>
</template>
