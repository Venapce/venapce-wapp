<script setup lang="ts">
import { computed, ref } from 'vue'
import Icon from '@/components/Icon.vue'
import JsonTree from './JsonTree.vue'
import { docShape, isEmptyDoc } from '@/lib/pipeline'

// A card around one of a row's JSON documents (data / meta / ref): title,
// shape summary, and a toolbar — filter, expand/collapse, tree ⇄ raw, copy.
const props = withDefaults(
  defineProps<{
    title: string
    value: unknown
    hint?: string
    /** Start folded (the header stays). */
    collapsed?: boolean
    openDepth?: number
  }>(),
  { collapsed: false, openDepth: 2 },
)

const open = ref(!props.collapsed)
const mode = ref<'tree' | 'raw'>('tree')
const filter = ref('')
const depth = ref(props.openDepth)
const version = ref(0)
const copied = ref(false)

const empty = computed(() => isEmptyDoc(props.value))
const shape = computed(() => docShape(props.value))
const raw = computed(() => JSON.stringify(props.value ?? null, null, 2))

function expandAll() {
  depth.value = 99
  version.value++
}
function collapseAll() {
  depth.value = 0
  version.value++
}
async function copy() {
  try {
    await navigator.clipboard.writeText(raw.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1200)
  } catch {
    /* clipboard unavailable — nothing to do */
  }
}
</script>

<template>
  <section class="card overflow-hidden">
    <header class="flex flex-wrap items-center gap-2 border-b border-line bg-surface-2/60 px-3 py-2">
      <button class="flex items-center gap-1.5 text-sm font-semibold text-fg" @click="open = !open">
        <Icon :name="open ? 'chevronDown' : 'chevronRight'" :size="14" class="text-fg-subtle" />
        {{ title }}
      </button>
      <span v-if="shape" class="chip-muted">{{ shape }}</span>
      <span v-else class="text-[11px] italic text-fg-subtle">empty</span>
      <span v-if="hint" class="hidden text-[11px] text-fg-subtle lg:inline" :title="hint">— {{ hint }}</span>

      <div v-if="open && !empty" class="ml-auto flex items-center gap-1">
        <div v-if="mode === 'tree'" class="relative">
          <Icon name="search" :size="12" class="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-fg-subtle" />
          <input
            v-model="filter"
            class="h-7 w-40 rounded-md border border-line bg-surface pl-6 pr-2 text-xs text-fg outline-none placeholder:text-fg-subtle focus:border-accent"
            placeholder="Filter keys / values"
          />
        </div>
        <template v-if="mode === 'tree'">
          <button class="icon-btn-plain" title="Expand all" @click="expandAll">
            <Icon name="chevronsRight" :size="14" class="rotate-90" />
          </button>
          <button class="icon-btn-plain" title="Collapse all" @click="collapseAll">
            <Icon name="chevronsLeft" :size="14" class="rotate-90" />
          </button>
        </template>
        <div class="ml-1 flex overflow-hidden rounded-md border border-line text-[11px]">
          <button
            class="px-2 py-1"
            :class="mode === 'tree' ? 'bg-accent-soft text-accent' : 'text-fg-muted hover:bg-bg'"
            @click="mode = 'tree'"
          >
            Tree
          </button>
          <button
            class="px-2 py-1"
            :class="mode === 'raw' ? 'bg-accent-soft text-accent' : 'text-fg-muted hover:bg-bg'"
            @click="mode = 'raw'"
          >
            Raw
          </button>
        </div>
        <button class="icon-btn-plain" :title="copied ? 'Copied' : 'Copy JSON'" @click="copy">
          <Icon :name="copied ? 'check' : 'copy'" :size="14" />
        </button>
      </div>
    </header>

    <div v-if="open" class="max-h-[32rem] overflow-auto px-2 py-2">
      <p v-if="empty" class="px-2 py-4 text-center text-xs text-fg-subtle">Nothing here — the document is empty.</p>
      <JsonTree v-else-if="mode === 'tree'" :value="value" :open-depth="depth" :filter="filter" :version="version" />
      <pre v-else class="whitespace-pre-wrap break-all px-2 font-mono text-xs leading-5 text-fg">{{ raw }}</pre>
    </div>
  </section>
</template>
