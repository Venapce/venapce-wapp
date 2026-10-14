<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useConnectionStore } from '@/stores/connection'
import { apiErr } from '@/api/venapce'
import Icon from '@/components/Icon.vue'
import FlomorphicLink from '@/components/FlomorphicLink.vue'
import type { FlowSummary } from '@/api/types'

// "Link to an existing flow": bind a manifest flow key to a workflow already
// on the FloMorphic canvas — the path when the operator imported the file in
// FloMorphic themselves (the import dialog there does the plugin diff and
// review) and now tells Venapce which flow it became.
const props = defineProps<{ open: boolean; title: string }>()
const emit = defineEmits<{ close: []; pick: [flow: FlowSummary] }>()

const conn = useConnectionStore()
const flows = ref<FlowSummary[]>([])
const loading = ref(false)
const error = ref('')
const search = ref('')

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return q ? flows.value.filter((f) => f.title.toLowerCase().includes(q) || f.id.toLowerCase().includes(q)) : flows.value
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    flows.value = await conn.client.listFlows()
  } catch (e) {
    error.value = apiErr(e)
    flows.value = []
  } finally {
    loading.value = false
  }
}

watch(
  () => props.open,
  (o) => {
    if (o) {
      search.value = props.title
      load()
    }
  },
  { immediate: true },
)
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" @click.self="emit('close')">
    <div class="card flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden">
      <div class="flex items-center gap-2 border-b border-line px-4 py-3">
        <Icon name="link" :size="16" class="text-accent" />
        <h2 class="text-sm font-semibold text-fg">Link to a FloMorphic flow</h2>
        <button class="icon-btn-sm ml-auto" title="Close" @click="emit('close')"><Icon name="close" :size="14" /></button>
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto p-4">
        <div class="mb-2 flex items-center gap-2">
          <input v-model="search" class="field" placeholder="Search flows…" />
          <button class="icon-btn" title="Reload" :disabled="loading" @click="load"><Icon name="refresh" :size="14" /></button>
        </div>
        <p v-if="error" class="mb-2 rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{{ error }}</p>
        <p v-else-if="loading" class="text-xs text-fg-subtle">Loading flows…</p>
        <p v-else-if="filtered.length === 0" class="text-xs text-fg-subtle">No flow matches.</p>
        <ul v-else class="divide-y divide-line rounded-md border border-line">
          <li v-for="f in filtered" :key="f.id" class="flex items-center gap-1 pr-2 hover:bg-accent-soft">
            <button class="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left" @click="emit('pick', f)">
              <Icon name="workflow" :size="14" class="shrink-0 text-fg-subtle" />
              <span class="min-w-0 flex-1 truncate text-sm text-fg">{{ f.title }}</span>
              <span class="shrink-0 font-mono text-[10px] text-fg-subtle">{{ f.id }}</span>
            </button>
            <!-- Bind the right one: two flows of the same name are told apart
                 on the canvas, not in this list. -->
            <FlomorphicLink kind="flow" :id="f.id" icon-only />
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
