<script setup lang="ts">
import { AGGREGATES, metricLabel, type Aggregate, type MetricSpec } from '@/lib/builder'
import type { DatasetColumn, DatasetMetric } from '@/api/types'

// One metric: a saved metric, a column + aggregate, or raw SQL — the three
// shapes Superset's metric popover offers.
const props = defineProps<{
  modelValue: MetricSpec | null
  columns: DatasetColumn[]
  savedMetrics: DatasetMetric[]
  label?: string
  /** Show a "none" option (optional metrics like bubble size). */
  clearable?: boolean
}>()
const emit = defineEmits<{ (e: 'update:modelValue', v: MetricSpec | null): void }>()

function setKind(kind: MetricSpec['kind'] | 'none') {
  if (kind === 'none') return emit('update:modelValue', null)
  if (kind === 'saved') {
    return emit('update:modelValue', { kind: 'saved', name: props.savedMetrics[0]?.metric_name ?? '' })
  }
  if (kind === 'sql') return emit('update:modelValue', { kind: 'sql', sql: 'COUNT(*)', label: 'count' })
  emit('update:modelValue', { kind: 'simple', column: props.columns[0]?.column_name ?? '', aggregate: 'SUM' })
}

function patch(part: Partial<Record<string, unknown>>) {
  if (!props.modelValue) return
  emit('update:modelValue', { ...props.modelValue, ...part } as MetricSpec)
}
</script>

<template>
  <div class="rounded-md border border-line p-2">
    <div class="mb-2 flex items-center gap-2">
      <span v-if="label" class="text-[11px] font-semibold text-fg-muted">{{ label }}</span>
      <select
        class="field min-w-0 flex-1 !py-1 !text-xs"
        :value="modelValue?.kind ?? 'none'"
        @change="setKind(($event.target as HTMLSelectElement).value as MetricSpec['kind'] | 'none')"
      >
        <option v-if="clearable" value="none">None</option>
        <option value="simple">Aggregate</option>
        <option value="saved" :disabled="!savedMetrics.length">Saved metric</option>
        <option value="sql">Custom SQL</option>
      </select>
      <!-- Row actions (e.g. remove) sit beside the select, never over it. -->
      <slot name="actions" />
    </div>

    <div v-if="modelValue?.kind === 'simple'" class="flex gap-2">
      <select
        class="field !py-1 !text-xs"
        :value="modelValue.aggregate"
        @change="patch({ aggregate: ($event.target as HTMLSelectElement).value as Aggregate })"
      >
        <option v-for="a in AGGREGATES" :key="a" :value="a">{{ a }}</option>
      </select>
      <select
        class="field !py-1 !text-xs"
        :value="modelValue.column"
        @change="patch({ column: ($event.target as HTMLSelectElement).value })"
      >
        <option v-for="c in columns" :key="c.column_name" :value="c.column_name">{{ c.column_name }}</option>
      </select>
    </div>

    <div v-else-if="modelValue?.kind === 'saved'">
      <select
        class="field !py-1 !text-xs"
        :value="modelValue.name"
        @change="patch({ name: ($event.target as HTMLSelectElement).value })"
      >
        <option v-for="sm in savedMetrics" :key="sm.metric_name" :value="sm.metric_name">
          {{ sm.verbose_name || sm.metric_name }}
        </option>
      </select>
    </div>

    <div v-else-if="modelValue?.kind === 'sql'" class="space-y-1.5">
      <input
        class="field !py-1 !text-xs"
        placeholder="COUNT(*)"
        :value="modelValue.sql"
        @input="patch({ sql: ($event.target as HTMLInputElement).value })"
      />
      <input
        class="field !py-1 !text-xs"
        placeholder="label"
        :value="modelValue.label"
        @input="patch({ label: ($event.target as HTMLInputElement).value })"
      />
    </div>

    <p v-if="modelValue" class="mt-1 truncate text-[10px] text-fg-subtle">→ {{ metricLabel(modelValue) }}</p>
  </div>
</template>
