<script setup lang="ts">
import type { DatasetColumn, DatasetMetric } from '@/api/types'
import {
  LABEL_POSITIONS,
  TREE_LAYOUTS,
  TREE_ORIENTS,
  TREE_SYMBOLS,
  type BuilderState,
} from '@/lib/builder'
import ControlSection from './ControlSection.vue'
import MetricEditor from './MetricEditor.vue'

// Superset's Tree controls: the id/parent/name triple that defines the
// hierarchy, an optional metric per node, plus the ECharts layout options.
defineProps<{
  state: BuilderState
  columns: DatasetColumn[]
  groupbyColumns: DatasetColumn[]
  savedMetrics: DatasetMetric[]
}>()
</script>

<template>
  <div class="space-y-3">
    <ControlSection title="Hierarchy" hint="Rows form an adjacency list: each row names a node and its parent.">
      <div>
        <label class="label">Id column</label>
        <select v-model="state.tree.idColumn" class="field !py-1 !text-xs">
          <option value="" disabled>Select a column</option>
          <option v-for="c in groupbyColumns" :key="c.column_name" :value="c.column_name">{{ c.column_name }}</option>
        </select>
      </div>
      <div>
        <label class="label">Parent column</label>
        <select v-model="state.tree.parentColumn" class="field !py-1 !text-xs">
          <option value="" disabled>Select a column</option>
          <option v-for="c in groupbyColumns" :key="c.column_name" :value="c.column_name">{{ c.column_name }}</option>
        </select>
      </div>
      <div>
        <label class="label">Name column</label>
        <select v-model="state.tree.nameColumn" class="field !py-1 !text-xs">
          <option value="">(use the id)</option>
          <option v-for="c in groupbyColumns" :key="c.column_name" :value="c.column_name">{{ c.column_name }}</option>
        </select>
      </div>
      <div>
        <label class="label">Root node id</label>
        <input v-model="state.tree.rootNode" class="field !py-1 !text-xs" placeholder="(natural root)" />
      </div>
      <div>
        <label class="label">Metric (optional)</label>
        <MetricEditor
          clearable
          :model-value="state.tree.metric"
          :columns="columns"
          :saved-metrics="savedMetrics"
          @update:model-value="state.tree.metric = $event"
        />
      </div>
    </ControlSection>

    <ControlSection title="Chart options" :open="false">
      <div class="flex gap-2">
        <div class="flex-1">
          <label class="label">Layout</label>
          <select v-model="state.tree.layout" class="field !py-1 !text-xs">
            <option v-for="l in TREE_LAYOUTS" :key="l" :value="l">{{ l }}</option>
          </select>
        </div>
        <div class="flex-1">
          <label class="label">Orientation</label>
          <select
            v-model="state.tree.orient"
            class="field !py-1 !text-xs"
            :disabled="state.tree.layout === 'radial'"
          >
            <option v-for="o in TREE_ORIENTS" :key="o" :value="o">{{ o }}</option>
          </select>
        </div>
      </div>

      <div class="flex gap-2">
        <div class="flex-1">
          <label class="label">Node symbol</label>
          <select v-model="state.tree.symbol" class="field !py-1 !text-xs">
            <option v-for="s in TREE_SYMBOLS" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>
        <div class="w-20">
          <label class="label">Size</label>
          <input v-model.number="state.tree.symbolSize" type="number" min="1" max="40" class="field !py-1 !text-xs" />
        </div>
        <div class="w-24">
          <label class="label">Open depth</label>
          <input v-model.number="state.tree.initialDepth" type="number" min="0" class="field !py-1 !text-xs" />
        </div>
      </div>

      <div class="flex gap-2">
        <div class="flex-1">
          <label class="label">Node label</label>
          <select v-model="state.tree.nodeLabelPosition" class="field !py-1 !text-xs">
            <option v-for="p in LABEL_POSITIONS" :key="p" :value="p">{{ p }}</option>
          </select>
        </div>
        <div class="flex-1">
          <label class="label">Leaf label</label>
          <select v-model="state.tree.childLabelPosition" class="field !py-1 !text-xs">
            <option v-for="p in LABEL_POSITIONS" :key="p" :value="p">{{ p }}</option>
          </select>
        </div>
      </div>

      <div class="flex gap-4 text-xs text-fg-muted">
        <label class="flex items-center gap-2">
          <input v-model="state.tree.roam" type="checkbox" class="rounded border-line-strong" /> Pan &amp; zoom
        </label>
        <label class="flex items-center gap-2">
          <input
            type="checkbox"
            class="rounded border-line-strong"
            :checked="state.tree.edgeShape === 'polyline'"
            @change="state.tree.edgeShape = ($event.target as HTMLInputElement).checked ? 'polyline' : 'curve'"
          />
          Straight edges
        </label>
      </div>
    </ControlSection>
  </div>
</template>
