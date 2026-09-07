<script setup lang="ts">
import { computed } from 'vue'
import type { DatasetColumn } from '@/api/types'
import {
  CAT_LABEL_TYPES,
  LEGEND_POSITIONS,
  dimensionSpec,
  type BuilderState,
} from '@/lib/builder'
import { NUMBER_FORMATS } from '@/lib/numberFormat'
import ControlSection from './ControlSection.vue'
import ColumnChips from './ColumnChips.vue'

// The categorical family shares one query but not one control panel: a gauge
// has no dimensions, a treemap has three, only bars can lie on their side. Each
// control below declares which types it belongs to, so the panel shows exactly
// what the chosen chart can act on.
const props = defineProps<{ state: BuilderState; groupbyColumns: DatasetColumn[] }>()

const viz = computed(() => props.state.vizType)
const spec = computed(() => dimensionSpec(viz.value))
const has = (...types: string[]) => computed(() => types.includes(viz.value))

const showDimensions = computed(() => spec.value.max > 0)
const showAxes = has('bar', 'line', 'area', 'waterfall', 'heatmap_v2')
const showLegend = has('bar', 'line', 'area', 'pie', 'rose', 'funnel', 'radar', 'waterfall')
const showValues = has('bar', 'line', 'area', 'waterfall', 'heatmap_v2')
const showSlices = has('pie', 'rose', 'funnel', 'treemap_v2', 'sunburst_v2', 'graph_chart')
const showBars = has('bar')
const showDonut = has('pie')
const showGauge = has('gauge_chart')
const showDepth = has('treemap_v2')
const showWords = has('word_cloud')
const showFormat = computed(() => !['table', 'pivot_table_v2'].includes(viz.value))
const showSort = computed(() => !['table', 'waterfall', 'gauge_chart', 'big_number'].includes(viz.value))
</script>

<template>
  <div class="space-y-3">
    <ControlSection v-if="showDimensions" title="Dimensions" :hint="spec.hint">
      <div>
        <label class="label">{{ spec.label }}</label>
        <ColumnChips
          :model-value="state.dimensions"
          :columns="groupbyColumns"
          :max="spec.max"
          @update:model-value="state.dimensions = $event"
        />
        <p v-if="spec.max > 1" class="mt-1 text-[11px] text-fg-subtle">
          {{ state.dimensions.length }} of up to {{ spec.max }} selected · order matters
        </p>
      </div>
    </ControlSection>

    <ControlSection title="Chart options" :open="false">
      <!-- legend -->
      <div v-if="showLegend" class="flex items-end gap-2">
        <label class="flex flex-1 items-center gap-2 pb-2 text-xs text-fg-muted">
          <input v-model="state.cat.legend" type="checkbox" class="rounded border-line-strong" />
          Legend
        </label>
        <div class="flex-1">
          <label class="label">Position</label>
          <select v-model="state.cat.legendPosition" class="field !py-1 !text-xs" :disabled="!state.cat.legend">
            <option v-for="p in LEGEND_POSITIONS" :key="p" :value="p">{{ p }}</option>
          </select>
        </div>
      </div>

      <!-- bars -->
      <div v-if="showBars" class="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-fg-muted">
        <label class="flex items-center gap-2">
          <input v-model="state.cat.horizontal" type="checkbox" class="rounded border-line-strong" />
          Horizontal
        </label>
        <label class="flex items-center gap-2">
          <input v-model="state.cat.stacked" type="checkbox" class="rounded border-line-strong" />
          Stacked
        </label>
      </div>

      <div class="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-fg-muted">
        <label v-if="showValues" class="flex items-center gap-2">
          <input v-model="state.cat.showValues" type="checkbox" class="rounded border-line-strong" />
          Show values
        </label>
        <label v-if="showDonut" class="flex items-center gap-2">
          <input v-model="state.cat.donut" type="checkbox" class="rounded border-line-strong" />
          Donut
        </label>
        <label v-if="showSort" class="flex items-center gap-2">
          <input v-model="state.cat.sortBars" type="checkbox" class="rounded border-line-strong" />
          Sort by metric
        </label>
      </div>

      <!-- labels + number format -->
      <div class="flex gap-2">
        <div v-if="showSlices" class="flex-1">
          <label class="label">Labels</label>
          <select v-model="state.cat.labelType" class="field !py-1 !text-xs">
            <option v-for="l in CAT_LABEL_TYPES" :key="l.value" :value="l.value">{{ l.label }}</option>
          </select>
        </div>
        <div v-if="showFormat" class="flex-1">
          <label class="label">Value format</label>
          <select v-model="state.cat.valueFormat" class="field !py-1 !text-xs">
            <option v-for="f in NUMBER_FORMATS" :key="f.value" :value="f.value">{{ f.label }}</option>
          </select>
        </div>
      </div>

      <!-- gauge range -->
      <div v-if="showGauge" class="flex gap-2">
        <div class="flex-1">
          <label class="label">Gauge min</label>
          <input v-model.number="state.cat.gaugeMin" type="number" class="field !py-1 !text-xs" />
        </div>
        <div class="flex-1">
          <label class="label">Gauge max</label>
          <input
            :value="state.cat.gaugeMax ?? ''"
            type="number"
            class="field !py-1 !text-xs"
            placeholder="auto"
            @input="
              state.cat.gaugeMax =
                ($event.target as HTMLInputElement).value === ''
                  ? null
                  : Number(($event.target as HTMLInputElement).value)
            "
          />
        </div>
      </div>

      <!-- treemap depth -->
      <div v-if="showDepth">
        <label class="label">Levels drawn</label>
        <input v-model.number="state.cat.hierarchyDepth" type="number" min="1" max="3" class="field !py-1 !text-xs" />
      </div>

      <!-- word cloud type sizes -->
      <div v-if="showWords" class="flex gap-2">
        <div class="flex-1">
          <label class="label">Min font</label>
          <input v-model.number="state.cat.minFontSize" type="number" min="8" max="40" class="field !py-1 !text-xs" />
        </div>
        <div class="flex-1">
          <label class="label">Max font</label>
          <input v-model.number="state.cat.maxFontSize" type="number" min="12" max="96" class="field !py-1 !text-xs" />
        </div>
      </div>

      <!-- axes -->
      <template v-if="showAxes">
        <div class="flex gap-2">
          <div class="min-w-0 flex-1">
            <label class="label">X-axis title</label>
            <input v-model="state.cat.xAxisTitle" class="field !py-1 !text-xs" placeholder="(none)" />
          </div>
          <div class="w-20">
            <label class="label">Rotate</label>
            <input
              v-model.number="state.cat.xAxisLabelRotation"
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
          <input v-model="state.cat.yAxisTitle" class="field !py-1 !text-xs" placeholder="(none)" />
        </div>
      </template>
    </ControlSection>
  </div>
</template>
