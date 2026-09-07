<script setup lang="ts">
import type { DatasetColumn } from '@/api/types'

// Multi-select over dataset columns, as toggleable chips.
const props = defineProps<{ modelValue: string[]; columns: DatasetColumn[]; max?: number }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string[]): void }>()

function toggle(col: string) {
  const next = [...props.modelValue]
  const i = next.indexOf(col)
  if (i >= 0) next.splice(i, 1)
  else {
    if (props.max && next.length >= props.max) return
    next.push(col)
  }
  emit('update:modelValue', next)
}
</script>

<template>
  <div class="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-md border border-line p-2">
    <button
      v-for="c in columns"
      :key="c.column_name"
      class="rounded-full px-2.5 py-1 text-xs"
      :class="
        modelValue.includes(c.column_name)
          ? 'bg-accent text-accent-fg'
          : 'bg-surface-2 text-fg-muted hover:bg-bg'
      "
      @click="toggle(c.column_name)"
    >
      {{ c.column_name }}
    </button>
    <span v-if="!columns.length" class="text-xs text-fg-subtle">No columns available.</span>
  </div>
</template>
