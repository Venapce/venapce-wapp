<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Icon from '@/components/Icon.vue'

// One node of the JSON tree: a key, a value, and — for objects and arrays — its
// children. Recursive. Primitives print with a colour per type and a small
// type tag on the right (Compass-style), containers show a count and fold.
const props = defineProps<{
  name: string
  value: unknown
  depth: number
  /** Nodes shallower than this start open. */
  openDepth: number
  /** Bumped by the parent to reset every node's open state to openDepth. */
  version: number
  /** Live filter: nodes whose subtree contains no match are hidden. */
  filter: string
}>()

type Kind = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null' | 'date' | 'url'

function kindOf(v: unknown): Kind {
  if (v === null || v === undefined) return 'null'
  if (Array.isArray(v)) return 'array'
  if (typeof v === 'object') return 'object'
  if (typeof v === 'number') return 'number'
  if (typeof v === 'boolean') return 'boolean'
  if (typeof v === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v) && !Number.isNaN(Date.parse(v))) return 'date'
    if (/^https?:\/\/\S+$/.test(v)) return 'url'
  }
  return 'string'
}

const kind = computed<Kind>(() => kindOf(props.value))
const isContainer = computed(() => kind.value === 'object' || kind.value === 'array')

const children = computed<[string, unknown][]>(() => {
  if (kind.value === 'array') return (props.value as unknown[]).map((v, i) => [String(i), v])
  if (kind.value === 'object') return Object.entries(props.value as Record<string, unknown>)
  return []
})

const open = ref(props.depth < props.openDepth)
watch(
  () => props.version,
  () => (open.value = props.depth < props.openDepth),
)

// Filtering: a node stays visible when its key or (for primitives) its value
// contains the query, or when any descendant does. A match forces the path
// to it open so the hit is reachable.
const q = computed(() => props.filter.trim().toLowerCase())

function subtreeMatches(name: string, v: unknown): boolean {
  if (!q.value) return true
  if (name.toLowerCase().includes(q.value)) return true
  const k = kindOf(v)
  if (k === 'array' || k === 'object') {
    const entries = k === 'array' ? (v as unknown[]).map((x, i) => [String(i), x] as const) : Object.entries(v as object)
    return entries.some(([n, x]) => subtreeMatches(n, x))
  }
  return String(v).toLowerCase().includes(q.value)
}

const visible = computed(() => subtreeMatches(props.name, props.value))
const selfMatch = computed(
  () =>
    !!q.value &&
    (props.name.toLowerCase().includes(q.value) ||
      (!isContainer.value && String(props.value).toLowerCase().includes(q.value))),
)
const effectiveOpen = computed(() => open.value || (!!q.value && visible.value))

// Long strings are clipped in the tree and expanded on click.
const LONG = 120
const expanded = ref(false)
const text = computed(() => (kind.value === 'null' ? 'null' : String(props.value)))
const clipped = computed(() => kind.value === 'string' && text.value.length > LONG && !expanded.value)
const shown = computed(() => (clipped.value ? text.value.slice(0, LONG) + '…' : text.value))

const typeLabel = computed(() => {
  switch (kind.value) {
    case 'object':
      return `Object · ${children.value.length}`
    case 'array':
      return `Array · ${children.value.length}`
    case 'number':
      return Number.isInteger(props.value) ? 'Int' : 'Double'
    case 'boolean':
      return 'Boolean'
    case 'null':
      return 'Null'
    case 'date':
      return 'Date'
    case 'url':
      return 'URL'
    default:
      return 'String'
  }
})

const valueClass: Record<Kind, string> = {
  object: 'text-fg-subtle',
  array: 'text-fg-subtle',
  string: 'text-success',
  date: 'text-warning',
  url: 'text-accent underline decoration-dotted',
  number: 'text-accent',
  boolean: 'text-danger',
  null: 'text-fg-subtle italic',
}
</script>

<template>
  <div v-if="visible">
    <div
      class="group flex min-w-0 items-start gap-1 rounded px-1 py-[3px] text-xs leading-5 hover:bg-bg"
      :class="{ 'cursor-pointer': isContainer, 'bg-warning-soft/40': selfMatch }"
      :style="{ paddingLeft: `${depth * 14 + 4}px` }"
      @click="isContainer && (open = !open)"
    >
      <span class="flex w-4 shrink-0 items-center justify-center pt-1 text-fg-subtle">
        <Icon v-if="isContainer" :name="effectiveOpen ? 'chevronDown' : 'chevronRight'" :size="12" />
      </span>
      <span class="shrink-0 font-mono font-medium text-fg">{{ name }}</span>
      <span class="shrink-0 text-fg-subtle">:</span>

      <!-- container summary -->
      <span v-if="isContainer" class="min-w-0 truncate font-mono text-fg-subtle">
        <template v-if="kind === 'array'">[{{ children.length }}]</template>
        <template v-else>{ {{ children.length }} }</template>
      </span>
      <!-- primitive value -->
      <span
        v-else
        class="min-w-0 break-all font-mono"
        :class="valueClass[kind]"
        :title="clipped ? 'Click to expand' : undefined"
        @click.stop="clipped && (expanded = true)"
      >
        <template v-if="kind === 'string' || kind === 'date'">"{{ shown }}"</template>
        <a v-else-if="kind === 'url'" :href="text" target="_blank" rel="noopener" @click.stop>{{ shown }}</a>
        <template v-else>{{ shown }}</template>
      </span>

      <span
        class="ml-auto shrink-0 pl-3 text-[10px] uppercase tracking-wide text-fg-subtle opacity-0 group-hover:opacity-100"
      >
        {{ typeLabel }}
      </span>
    </div>

    <div v-if="isContainer && effectiveOpen" class="relative">
      <!-- guide line under the fold toggle -->
      <span class="absolute bottom-1 top-0 w-px bg-line" :style="{ left: `${depth * 14 + 12}px` }" />
      <JsonNode
        v-for="[k, v] in children"
        :key="k"
        :name="k"
        :value="v"
        :depth="depth + 1"
        :open-depth="openDepth"
        :version="version"
        :filter="filter"
      />
      <div
        v-if="children.length === 0"
        class="py-[3px] font-mono text-[11px] italic text-fg-subtle"
        :style="{ paddingLeft: `${(depth + 1) * 14 + 24}px` }"
      >
        empty
      </div>
    </div>
  </div>
</template>
