<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useConnectionStore } from '@/stores/connection'
import { apiErr } from '@/api/venapce'
import Icon from '@/components/Icon.vue'
import FlomorphicLink from '@/components/FlomorphicLink.vue'
import type { Activity, FlowSummary, SubjectKind } from '@/api/types'

// "Run a flow on this row": pick one of the FloMorphic flows (listed live from
// FloMorphic), optionally name the activity, and launch. Each subject becomes
// one run + one `run` activity; the outcome lands on the row's timeline when
// the process ends. The flow author is responsible for reading the row's data
// model ($.row.…) and leaving a conclusion in $.outcome.
const props = defineProps<{
  open: boolean
  subjects: { kind: SubjectKind; id: number | string }[]
}>()
const emit = defineEmits<{ close: []; started: [activities: Activity[]] }>()

const conn = useConnectionStore()
const flows = ref<FlowSummary[]>([])
const loading = ref(false)
const error = ref('')
const search = ref('')
const selected = ref<FlowSummary | null>(null)
const title = ref('')
const input = ref('')
const running = ref(false)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return q ? flows.value.filter((f) => f.title.toLowerCase().includes(q) || f.id.toLowerCase().includes(q)) : flows.value
})

const subjectLabel = computed(() => {
  const s = props.subjects
  if (s.length === 1) return `${s[0]!.kind} #${s[0]!.id}`
  return `${s.length} rows`
})

const inputValid = computed(() => {
  const t = input.value.trim()
  if (!t) return true
  try {
    JSON.parse(t)
    return true
  } catch {
    return false
  }
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

async function run() {
  if (!selected.value || !inputValid.value) return
  running.value = true
  error.value = ''
  try {
    const res = await conn.client.runFlow({
      flowId: selected.value.id,
      subjects: props.subjects,
      title: title.value.trim() || undefined,
      input: input.value.trim() ? JSON.parse(input.value) : undefined,
    })
    if (res.error) error.value = res.error
    emit('started', res.activities)
    if (!res.error) emit('close')
  } catch (e) {
    error.value = apiErr(e)
  } finally {
    running.value = false
  }
}

watch(
  () => props.open,
  (o) => {
    if (o) {
      selected.value = null
      title.value = ''
      input.value = ''
      search.value = ''
      load()
    }
  },
)
onMounted(() => {
  if (props.open) load()
})
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" @click.self="emit('close')">
    <div class="card flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden">
      <div class="flex items-center gap-2 border-b border-line px-4 py-3">
        <Icon name="workflow" :size="16" class="text-accent" />
        <h2 class="text-sm font-semibold text-fg">Run a flow on {{ subjectLabel }}</h2>
        <button class="icon-btn-sm ml-auto" title="Close" @click="emit('close')"><Icon name="close" :size="14" /></button>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto p-4">
        <p class="mb-3 text-xs text-fg-muted">
          The row is handed to the flow as its context document — the flow reads it through
          <code class="font-mono">$.row</code> and leaves what it concludes in <code class="font-mono">$.outcome</code>
          (title, description, remediation, proof, facts, tags). The result shows up on the row's activity timeline
          when the run ends.
        </p>

        <div class="mb-2 flex items-center gap-2">
          <input v-model="search" class="field" placeholder="Search flows…" />
          <button class="icon-btn-sm" title="Reload flows" :disabled="loading" @click="load"><Icon name="refresh" :size="14" /></button>
        </div>
        <p v-if="error" class="mb-2 rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{{ error }}</p>
        <p v-if="loading" class="text-xs text-fg-subtle">Loading flows…</p>
        <div v-else-if="filtered.length === 0" class="rounded-md border border-dashed border-line p-4 text-center text-xs text-fg-subtle">
          No flows found. Design one in FloMorphic first.
        </div>
        <ul v-else class="max-h-64 divide-y divide-line overflow-y-auto rounded-md border border-line">
          <li
            v-for="f in filtered"
            :key="f.id"
            class="flex items-center gap-1 pr-2 transition-colors hover:bg-accent-soft"
            :class="selected?.id === f.id ? 'bg-accent-soft' : ''"
          >
            <button
              type="button"
              class="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm"
              :class="selected?.id === f.id ? 'text-accent' : 'text-fg'"
              @click="selected = f"
            >
              <Icon :name="selected?.id === f.id ? 'checkCircle' : 'workflow'" :size="14" class="shrink-0" />
              <span class="min-w-0 flex-1 truncate">{{ f.title }}</span>
              <span class="shrink-0 font-mono text-[10px] text-fg-subtle">{{ f.id }}</span>
            </button>
            <!-- Read the flow before handing it a row: a list of titles says
                 nothing about what the thing actually does. -->
            <FlomorphicLink kind="flow" :id="f.id" icon-only />
          </li>
        </ul>

        <div class="mt-4 grid gap-3">
          <label class="block">
            <span class="label">Activity title <span class="font-normal text-fg-subtle">(optional)</span></span>
            <input v-model="title" class="field" :placeholder="selected?.title || 'The flow\'s title'" />
          </label>
          <label class="block">
            <span class="label">Extra input <span class="font-normal text-fg-subtle">(optional JSON, available as $.input)</span></span>
            <textarea
              v-model="input"
              class="field min-h-[3.5rem] font-mono text-xs"
              :class="inputValid ? '' : 'border-danger'"
              placeholder='{ "threshold": "high" }'
            ></textarea>
            <span v-if="!inputValid" class="text-[11px] text-danger">Not valid JSON.</span>
          </label>
        </div>
      </div>

      <div class="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
        <button class="btn-ghost btn-sm" @click="emit('close')">Cancel</button>
        <button class="btn-primary btn-sm" :disabled="!selected || !inputValid || running" @click="run">
          <Icon name="play" :size="13" /> {{ running ? 'Starting…' : `Run on ${subjectLabel}` }}
        </button>
      </div>
    </div>
  </div>
</template>
