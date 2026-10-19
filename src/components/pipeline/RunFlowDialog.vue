<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useConnectionStore } from '@/stores/connection'
import { apiErr } from '@/api/venapce'
import Icon from '@/components/Icon.vue'
import FlomorphicLink from '@/components/FlomorphicLink.vue'
import type { Activity, FlowSummary, FlowTagOperation, SubjectKind } from '@/api/types'

// "Run a flow on this row": pick one of the FloMorphic flows (listed live from
// FloMorphic), optionally name the activity, and launch. Each subject becomes
// one run + one `run` activity; the outcome lands on the row's timeline when
// the process ends. The flow author is responsible for reading the row's data
// model ($.row.…) and leaving a conclusion in $.outcome.
//
// LABEL FILTER. A FloMorphic canvas is shared: an install with a few operations
// on it, plus whatever was drawn by hand, lists dozens of flows here, and an
// operator applying GDPR's finding review has no business scrolling past the fraud
// sweeps. Flows carry labels (a operation stamps its `flowTags` on the flows it
// installs), so filtering is a `tags=` on the list call — FloMorphic narrows it,
// which is why a filtered list cannot lose a flow off the end of the 200-row
// page.
//
// `activeTags` is the ONE piece of filter state, and both chip rows write to it:
// a operation chip replaces it with that operation's whole label set, a label
// chip toggles one label (match ANY — more labels means more flows, not fewer).
// A operation chip therefore reads as selected exactly when the active set IS
// its set, with no second ref to drift out of step.
//
// The filter is opt-in and always escapable: the dialog opens on every flow,
// exactly as it did before flows had labels, and "All flows" is the first chip
// in the row rather than something to go looking for.
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
// The installed operations and their labels, for the filter row. Derived from
// installed packages on the API side, so it loads even when FloMorphic is down
// — the filter still renders beside the error about the flow list.
const operations = ref<FlowTagOperation[]>([])
/** Labels declared by installed operations (from /api/flows/tags). */
const facetTags = ref<string[]>([])
/** Labels actually seen on flows loaded in this dialog — so a label someone put
 *  on a hand-drawn flow is filterable too, not just the ones a package declared.
 *  It only grows while the dialog is open: a narrowed list must not make the
 *  chip that narrowed it disappear. */
const seenTags = ref<string[]>([])
/** The active filter: match ANY of these labels. Empty is "all flows". */
const activeTags = ref<string[]>([])
const selected = ref<FlowSummary | null>(null)
const title = ref('')
const input = ref('')
const running = ref(false)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return q ? flows.value.filter((f) => f.title.toLowerCase().includes(q) || f.id.toLowerCase().includes(q)) : flows.value
})

/** The operation whose label set is exactly the active filter, if any — what
 *  highlights one operation chip and names the filter in the empty state. */
const activeOperation = computed(
  () =>
    operations.value.find(
      (op) => op.tags.length === activeTags.value.length && op.tags.every((t) => activeTags.value.includes(t)),
    ) ?? null,
)

/** The label chips to offer. A operation's identity label (`operation:<slug>`)
 *  is left out: that operation already has a chip of its own, under its real
 *  name, and offering both says the same thing twice in a worse way. */
const availableTags = computed(() => {
  const identity = new Set(operations.value.map((op) => `operation:${op.slug}`))
  const all = new Set([...facetTags.value, ...seenTags.value, ...activeTags.value])
  return [...all].filter((t) => !identity.has(t) || activeTags.value.includes(t)).sort()
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
    flows.value = await conn.client.listFlows('', activeTags.value)
    // Remember every label the list carried, so it stays offerable once the
    // list is narrowed past it.
    const next = new Set(seenTags.value)
    for (const f of flows.value) for (const t of f.tags ?? []) next.add(t)
    seenTags.value = [...next]
  } catch (e) {
    error.value = apiErr(e)
    flows.value = []
  } finally {
    loading.value = false
  }
}

// The filter menu. A failure here is not worth an error banner: without it the
// dialog still offers the labels it sees on the flows themselves.
async function loadOperations() {
  try {
    const facets = await conn.client.listFlowTags()
    operations.value = facets.operations
    facetTags.value = facets.tags
  } catch {
    operations.value = []
    facetTags.value = []
  }
}

/** Apply a filter and reload (the filter is FloMorphic's, not this list's),
 *  dropping a selected flow that the narrowed list no longer holds. */
async function applyFilter(tags: string[]) {
  activeTags.value = tags
  await load()
  if (selected.value && !flows.value.some((f) => f.id === selected.value?.id)) selected.value = null
}

/** Filter by one operation's whole label set — or by nothing, for "All flows". */
function filterByOperation(op: FlowTagOperation | null) {
  return applyFilter(op ? [...op.tags] : [])
}

/** Add or remove one label. Match ANY, so a second label widens the list. */
function toggleTag(tag: string) {
  return applyFilter(
    activeTags.value.includes(tag) ? activeTags.value.filter((t) => t !== tag) : [...activeTags.value, tag],
  )
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
      // Open unfiltered every time: the last operator's operation is not this
      // operator's, and a filter they did not set is a flow they cannot find.
      activeTags.value = []
      seenTags.value = []
      load()
      loadOperations()
    }
  },
)
onMounted(() => {
  if (props.open) {
    load()
    loadOperations()
  }
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

        <!-- Filter rows. Only drawn when there is something to narrow by — on a
             plain install with unlabelled flows they would be furniture.
             "All flows" leads, so clearing is never a hunt. -->
        <div v-if="operations.length" class="mb-2 flex flex-wrap items-center gap-1.5">
          <Icon name="box" :size="13" class="shrink-0 text-fg-subtle" title="Operations" />
          <button
            class="rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
            :class="activeTags.length === 0 ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-fg-muted hover:bg-accent-soft hover:text-accent'"
            title="Every flow on the FloMorphic canvas"
            @click="filterByOperation(null)"
          >
            All flows
          </button>
          <button
            v-for="op in operations"
            :key="op.slug"
            class="rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
            :class="
              activeOperation?.slug === op.slug
                ? 'bg-accent text-accent-fg'
                : 'bg-surface-2 text-fg-muted hover:bg-accent-soft hover:text-accent'
            "
            :title="`Only the flows ${op.name} installed (${op.tags.join(', ')})`"
            @click="filterByOperation(op)"
          >
            {{ op.name }}
          </button>
        </div>

        <!-- The labels themselves, as badges: finer than a whole operation (one
             operation's finding reviews, say) and the only way to reach a label
             someone put on a hand-drawn flow. Multi-select, match ANY — a
             second badge widens the list. -->
        <div v-if="availableTags.length" class="mb-2 flex flex-wrap items-center gap-1.5">
          <Icon name="tag" :size="13" class="shrink-0 text-fg-subtle" title="Labels" />
          <button
            v-for="t in availableTags"
            :key="t"
            class="rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors"
            :class="
              activeTags.includes(t)
                ? 'bg-accent text-accent-fg'
                : 'bg-surface-2 text-fg-muted hover:bg-accent-soft hover:text-accent'
            "
            :title="activeTags.includes(t) ? `Stop filtering by ${t}` : `Also show flows labelled ${t}`"
            @click="toggleTag(t)"
          >
            {{ t }}
          </button>
          <button
            v-if="activeTags.length"
            class="ml-0.5 inline-flex items-center gap-1 text-[11px] text-fg-subtle underline-offset-2 hover:text-accent hover:underline"
            title="Show every flow again"
            @click="filterByOperation(null)"
          >
            <Icon name="close" :size="10" /> Clear
          </button>
        </div>

        <div class="mb-2 flex items-center gap-2">
          <input v-model="search" class="field" placeholder="Search flows…" />
          <button class="icon-btn-sm" title="Reload flows" :disabled="loading" @click="load"><Icon name="refresh" :size="14" /></button>
        </div>
        <p v-if="error" class="mb-2 rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{{ error }}</p>
        <p v-if="loading" class="text-xs text-fg-subtle">Loading flows…</p>
        <!-- An empty filtered list is not an empty canvas; say which it is and
             offer the way back. -->
        <div
          v-else-if="filtered.length === 0 && activeTags.length"
          class="rounded-md border border-dashed border-line p-4 text-center text-xs text-fg-subtle"
        >
          No flow
          <template v-if="activeOperation">
            of <span class="font-medium text-fg">{{ activeOperation.name }}</span>
          </template>
          <template v-else>
            labelled <span class="font-medium text-fg">{{ activeTags.join(' or ') }}</span>
          </template>
          is on the canvas{{ search.trim() ? ' under that search' : ' yet' }}.
          <button class="ml-1 text-accent underline-offset-2 hover:underline" @click="filterByOperation(null)">
            Show all flows
          </button>
        </div>
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
              <!-- The flow's labels: which operation it belongs to, visible
                   without filtering by it first. -->
              <span v-if="f.tags?.length" class="hidden shrink-0 gap-1 sm:flex">
                <span v-for="t in f.tags.slice(0, 2)" :key="t" class="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] text-fg-muted">
                  {{ t }}
                </span>
                <span v-if="f.tags.length > 2" class="text-[10px] text-fg-subtle" :title="f.tags.join(', ')">
                  +{{ f.tags.length - 2 }}
                </span>
              </span>
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
