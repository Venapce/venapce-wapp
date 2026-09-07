<script setup lang="ts">
import { computed } from 'vue'
import type { DatasetColumn, DatasetMetric } from '@/api/types'
import {
  COMPARISON_TYPES,
  CONTRIBUTION_MODES,
  LEGEND_POSITIONS,
  RESAMPLE_METHODS,
  ROLLING_TYPES,
  SERIES_STYLES,
  SORT_SERIES_BY,
  TIME_GRAINS,
  TIME_RANGES,
  TIME_SHIFTS,
  type BuilderState,
} from '@/lib/builder'
import { NUMBER_FORMATS } from '@/lib/numberFormat'
import ControlSection from './ControlSection.vue'
import ColumnChips from './ColumnChips.vue'
import MetricEditor from './MetricEditor.vue'

// Superset's time-series panels, in full: the temporal query (x-axis, grain,
// range, series breakdown and limit), the chart options, and the advanced
// analytics that become `post_processing` steps on the query.
const props = defineProps<{
  state: BuilderState
  columns: DatasetColumn[]
  groupbyColumns: DatasetColumn[]
  savedMetrics: DatasetMetric[]
}>()

const temporalColumns = computed(() => {
  const dttm = props.columns.filter((c) => c.is_dttm)
  return dttm.length ? dttm : props.columns
})
</script>

<template>
  <div class="space-y-3">
    <ControlSection title="Time" hint="The x-axis column is bucketed by the grain, exactly as Superset does it.">
      <div>
        <label class="label">X-axis (temporal column)</label>
        <select v-model="state.xAxis" class="field !py-1.5 !text-xs">
          <option value="" disabled>Select a column</option>
          <option v-for="c in temporalColumns" :key="c.column_name" :value="c.column_name">
            {{ c.column_name }}<template v-if="c.is_dttm"> · time</template>
          </option>
        </select>
      </div>
      <div class="flex gap-2">
        <div class="flex-1">
          <label class="label">Time grain</label>
          <select v-model="state.timeGrain" class="field !py-1.5 !text-xs">
            <option v-for="g in TIME_GRAINS" :key="g.value" :value="g.value">{{ g.label }}</option>
          </select>
        </div>
        <div class="flex-1">
          <label class="label">Time range</label>
          <input v-model="state.timeRange" class="field !py-1.5 !text-xs" list="ts-ranges" placeholder="No filter" />
          <datalist id="ts-ranges">
            <option v-for="r in TIME_RANGES" :key="r" :value="r" />
          </datalist>
        </div>
      </div>
    </ControlSection>

    <ControlSection title="Series" hint="Each dimension value becomes its own line, via a pivot on the result frame.">
      <div>
        <label class="label">Breakdown dimensions</label>
        <ColumnChips
          :model-value="state.dimensions"
          :columns="groupbyColumns"
          @update:model-value="state.dimensions = $event"
        />
      </div>
      <div class="flex gap-2">
        <div class="w-24">
          <label class="label">Series limit</label>
          <input v-model.number="state.seriesLimit" type="number" min="0" class="field !py-1 !text-xs" />
        </div>
        <div class="min-w-0 flex-1">
          <label class="label">Rank series by</label>
          <MetricEditor
            :model-value="state.seriesLimitMetric"
            :columns="columns"
            :saved-metrics="savedMetrics"
            clearable
            @update:model-value="state.seriesLimitMetric = $event"
          />
        </div>
      </div>
      <div class="flex gap-2">
        <div class="flex-1">
          <label class="label">Sort series by</label>
          <select v-model="state.ts.sortSeriesBy" class="field !py-1 !text-xs">
            <option v-for="s in SORT_SERIES_BY" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>
        <label class="flex items-center gap-2 pb-1 text-xs text-fg-muted">
          <input v-model="state.ts.sortSeriesDesc" type="checkbox" class="rounded border-line-strong" />
          Desc
        </label>
      </div>
    </ControlSection>

    <ControlSection title="Chart options" :open="false">
      <div class="flex gap-2">
        <div class="flex-1">
          <label class="label">Series style</label>
          <select v-model="state.ts.seriesStyle" class="field !py-1 !text-xs">
            <option v-for="s in SERIES_STYLES" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>
        <div class="flex-1">
          <label class="label">Y-axis format</label>
          <select v-model="state.ts.yAxisFormat" class="field !py-1 !text-xs">
            <option v-for="f in NUMBER_FORMATS" :key="f.value" :value="f.value">{{ f.label }}</option>
          </select>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-fg-muted">
        <label class="flex items-center gap-2">
          <input v-model="state.ts.stacked" type="checkbox" class="rounded border-line-strong" /> Stacked
        </label>
        <label class="flex items-center gap-2">
          <input v-model="state.ts.smooth" type="checkbox" class="rounded border-line-strong" /> Smooth
        </label>
        <label class="flex items-center gap-2">
          <input v-model="state.ts.markers" type="checkbox" class="rounded border-line-strong" /> Markers
        </label>
        <label class="flex items-center gap-2">
          <input v-model="state.ts.showValues" type="checkbox" class="rounded border-line-strong" /> Show values
        </label>
        <label class="flex items-center gap-2">
          <input v-model="state.ts.richTooltip" type="checkbox" class="rounded border-line-strong" /> Rich tooltip
        </label>
        <label class="flex items-center gap-2">
          <input v-model="state.ts.dataZoom" type="checkbox" class="rounded border-line-strong" /> Zoom slider
        </label>
        <label class="flex items-center gap-2">
          <input v-model="state.ts.logAxis" type="checkbox" class="rounded border-line-strong" /> Log y-axis
        </label>
        <label class="flex items-center gap-2">
          <input v-model="state.ts.minorTicks" type="checkbox" class="rounded border-line-strong" /> Minor ticks
        </label>
        <label class="flex items-center gap-2">
          <input v-model="state.ts.legend" type="checkbox" class="rounded border-line-strong" /> Legend
        </label>
      </div>

      <div class="flex gap-2">
        <div class="flex-1">
          <label class="label">Legend position</label>
          <select v-model="state.ts.legendPosition" class="field !py-1 !text-xs" :disabled="!state.ts.legend">
            <option v-for="p in LEGEND_POSITIONS" :key="p" :value="p">{{ p }}</option>
          </select>
        </div>
        <div class="w-24">
          <label class="label">Area opacity</label>
          <input
            v-model.number="state.ts.areaOpacity"
            type="number"
            min="0"
            max="1"
            step="0.05"
            class="field !py-1 !text-xs"
          />
        </div>
        <div class="w-20">
          <label class="label">Marker</label>
          <input v-model.number="state.ts.markerSize" type="number" min="1" max="30" class="field !py-1 !text-xs" />
        </div>
      </div>

      <div class="flex gap-2">
        <div class="flex-1">
          <label class="label">X-axis title</label>
          <input v-model="state.ts.xAxisTitle" class="field !py-1 !text-xs" placeholder="(none)" />
        </div>
        <div class="w-24">
          <label class="label">Rotate</label>
          <input
            v-model.number="state.ts.xAxisLabelRotation"
            type="number"
            min="-90"
            max="90"
            step="15"
            class="field !py-1 !text-xs"
          />
        </div>
      </div>

      <div class="flex gap-2">
        <div class="flex-1">
          <label class="label">Y-axis title</label>
          <input v-model="state.ts.yAxisTitle" class="field !py-1 !text-xs" placeholder="(none)" />
        </div>
        <div class="w-20">
          <label class="label">Y min</label>
          <input v-model.number="state.ts.yAxisMin" type="number" class="field !py-1 !text-xs" placeholder="auto" />
        </div>
        <div class="w-20">
          <label class="label">Y max</label>
          <input v-model.number="state.ts.yAxisMax" type="number" class="field !py-1 !text-xs" placeholder="auto" />
        </div>
      </div>
    </ControlSection>

    <ControlSection
      title="Advanced analytics"
      hint="Each of these becomes a pandas step Superset runs on the result: rolling window, time shift, resample, contribution."
      :open="false"
    >
      <div>
        <label class="label">Contribution mode</label>
        <select v-model="state.ts.contributionMode" class="field !py-1 !text-xs">
          <option v-for="m in CONTRIBUTION_MODES" :key="m.value" :value="m.value">{{ m.label }}</option>
        </select>
      </div>

      <div class="flex gap-2">
        <div class="flex-1">
          <label class="label">Rolling window</label>
          <select v-model="state.ts.rollingType" class="field !py-1 !text-xs">
            <option v-for="r in ROLLING_TYPES" :key="r" :value="r">{{ r }}</option>
          </select>
        </div>
        <div class="w-20">
          <label class="label">Periods</label>
          <input
            v-model.number="state.ts.rollingPeriods"
            type="number"
            min="1"
            class="field !py-1 !text-xs"
            :disabled="state.ts.rollingType === 'None' || state.ts.rollingType === 'cumsum'"
          />
        </div>
        <div class="w-20">
          <label class="label">Min per.</label>
          <input
            v-model.number="state.ts.minPeriods"
            type="number"
            min="0"
            class="field !py-1 !text-xs"
            :disabled="state.ts.rollingType === 'None' || state.ts.rollingType === 'cumsum'"
          />
        </div>
      </div>

      <div class="flex gap-2">
        <div class="flex-1">
          <label class="label">Time shift</label>
          <input v-model="state.ts.comparisonShift" class="field !py-1 !text-xs" list="ts-shifts" placeholder="none" />
          <datalist id="ts-shifts">
            <option v-for="s in TIME_SHIFTS" :key="s" :value="s" />
          </datalist>
        </div>
        <div class="flex-1">
          <label class="label">Comparison</label>
          <select v-model="state.ts.comparisonType" class="field !py-1 !text-xs" :disabled="!state.ts.comparisonShift">
            <option v-for="c in COMPARISON_TYPES" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>
      </div>

      <div class="flex gap-2">
        <div class="flex-1">
          <label class="label">Resample rule</label>
          <select v-model="state.ts.resampleRule" class="field !py-1 !text-xs">
            <option value="">None</option>
            <option v-for="g in TIME_GRAINS.filter((t) => t.value)" :key="g.value" :value="g.value">
              {{ g.label }}
            </option>
          </select>
        </div>
        <div class="flex-1">
          <label class="label">Fill method</label>
          <select v-model="state.ts.resampleMethod" class="field !py-1 !text-xs" :disabled="!state.ts.resampleRule">
            <option v-for="m in RESAMPLE_METHODS" :key="m" :value="m">{{ m }}</option>
          </select>
        </div>
      </div>
    </ControlSection>
  </div>
</template>
