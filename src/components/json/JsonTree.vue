<script setup lang="ts">
import { computed } from 'vue'
import JsonNode from './JsonNode.vue'

// Compass-style explorer for a free-form JSON document. The value may be any
// shape — object, array or scalar — because every pipeline producer has its
// own model. Renders the root's entries as foldable nodes; the toolbar (in
// JsonPanel) drives open depth and the filter through props.
const props = withDefaults(
  defineProps<{
    value: unknown
    /** Nodes shallower than this start open. */
    openDepth?: number
    /** Live filter query. */
    filter?: string
    /** Bump to reset open state. */
    version?: number
  }>(),
  { openDepth: 2, filter: '', version: 0 },
)

// The root itself is not a node — its entries are. A scalar root is shown as
// a single unnamed value.
const entries = computed<[string, unknown][]>(() => {
  const v = props.value
  if (Array.isArray(v)) return v.map((x, i) => [String(i), x])
  if (v && typeof v === 'object') return Object.entries(v as Record<string, unknown>)
  return [['value', v]]
})
</script>

<template>
  <div class="min-w-0 select-text">
    <JsonNode
      v-for="[k, v] in entries"
      :key="k"
      :name="k"
      :value="v"
      :depth="0"
      :open-depth="openDepth"
      :version="version"
      :filter="filter"
    />
  </div>
</template>
